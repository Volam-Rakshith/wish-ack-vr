/* ══════════════════════════════════════════════════════════════════════════
   VR.fx — canvas effects engine
   --------------------------------------------------------------------------
   Two stacked canvases keep the workload balanced:

     #fx-back   ambient star field + drifting energy dust   (composite 'lighter')
     #fx-front  pointer trails, bursts, energy rings, confetti  (interactive)

   Performance notes
   · Glows are pre-rendered 64px radial-gradient sprites drawn with drawImage
     (far cheaper than per-frame createRadialGradient calls).
   · Hard particle caps + a low-power profile that halves every budget.
   · The rAF loop hibernates when there is nothing to draw.
   ══════════════════════════════════════════════════════════════════════════ */
VR.fx = (function () {
  'use strict';

  const U = VR.utils;

  /* ── Palette (RGB triplets so we can build rgba() strings fast) ──────── */
  const PALETTE = {
    cyan:    '39,230,255',
    blue:    '43,107,255',
    violet:  '124,92,255',
    magenta: '255,47,208',
    pink:    '255,107,181',
    white:   '255,255,255',
    green:   '77,240,176',
    amber:   '255,203,107'
  };
  const BURST_COLORS = [PALETTE.cyan, PALETTE.violet, PALETTE.magenta, PALETTE.blue, PALETTE.white];
  const CONFETTI_COLORS = ['#27e6ff', '#7c5cff', '#ff2fd0', '#ff6bb5', '#4df0b0', '#ffcb6b', '#ffffff'];

  /* ── State ───────────────────────────────────────────────────────────── */
  const state = {
    w: 0, h: 0, dpr: 1,
    running: false,
    lowPower: false,
    reduced: false,
    rafId: 0,
    last: 0,
    ambientDirty: true
  };

  let cvBack, cvFront, ctxBack, ctxFront;
  let spotEl = null;
  let spotRaf = 0;
  let glowSprites = {};
  let resizeRaf = 0;

  const stars = [];        // ambient field (parallax + twinkle)
  const glows = [];        // additive glow-sprite particles (front canvas)
  const sparks = [];       // additive line sparks
  const rings = [];        // expanding energy rings
  const confetti = [];     // celebration confetti (no additive blending)

  // Budgets (scaled down for low-power / reduced motion)
  const budget = { glows: 420, sparks: 340, rings: 22, confetti: 220, stars: 300 };

  const pointer = {
    x: 0, y: 0, vx: 0, vy: 0,
    active: false, down: false, lastMove: -9999, trailTick: 0, hue: 0
  };

  /* ── Glow sprite cache ───────────────────────────────────────────────── */
  function makeGlowSprite(rgb) {
    const size = 64;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grd.addColorStop(0, `rgba(${rgb},1)`);
    grd.addColorStop(0.28, `rgba(${rgb},.55)`);
    grd.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
    return c;
  }

  function getSprite(rgb) {
    if (!glowSprites[rgb]) glowSprites[rgb] = makeGlowSprite(rgb);
    return glowSprites[rgb];
  }

  /* ── Boot ────────────────────────────────────────────────────────────── */
  function init(options = {}) {
    cvBack = document.getElementById('fx-back');
    cvFront = document.getElementById('fx-front');
    if (!cvBack || !cvFront) return;

    spotEl = document.getElementById('bg-spot');
    ctxBack = cvBack.getContext('2d');
    ctxFront = cvFront.getContext('2d', { alpha: true });
    if (!ctxBack || !ctxFront) return;

    state.reduced = U.prefersReducedMotion();
    state.lowPower = !!options.lowPower;

    if (state.lowPower) {
      budget.glows = 220;
      budget.sparks = 170;
      budget.rings = 12;
      budget.confetti = 110;
      budget.stars = 130;
    }

    Object.values(PALETTE).forEach(getSprite);   // warm the sprite cache
    resize();
    buildStars();

    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('orientationchange', onResize, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);

    if (window.PointerEvent) {
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      window.addEventListener('pointerdown', onPointerDown, { passive: true });
      window.addEventListener('pointerup', onPointerUp, { passive: true });
      document.addEventListener('pointerleave', onPointerLeave, { passive: true });

      // The "cursor aura" only makes sense where there is a real pointer.
      const finePointer = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
      if (finePointer && !state.reduced) document.body.classList.add('has-pointer');
    }

    state.running = true;
    state.last = performance.now();
    state.rafId = requestAnimationFrame(loop);
  }

  /* ── Sizing ──────────────────────────────────────────────────────────── */
  function onResize() {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0;
      resize();
      buildStars();
    });
  }

  function resize() {
    state.w = window.innerWidth;
    state.h = window.innerHeight;
    const maxDpr = state.lowPower ? 1.5 : 1.9;
    state.dpr = Math.min(window.devicePixelRatio || 1, maxDpr);

    [cvBack, cvFront].forEach((cv) => {
      cv.width = Math.floor(state.w * state.dpr);
      cv.height = Math.floor(state.h * state.dpr);
    });
    ctxBack.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    ctxFront.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  }

  /* ── Ambient star field ──────────────────────────────────────────────── */
  function buildStars() {
    const density = state.lowPower ? 7600 : 3400;      // px² per star
    const count = U.clamp(Math.round((state.w * state.h) / density), 50, budget.stars);
    stars.length = 0;

    const buckets = [
      { rgb: PALETTE.white, weight: 0.72 },
      { rgb: PALETTE.cyan, weight: 0.2 },
      { rgb: PALETTE.magenta, weight: 0.08 }
    ];

    for (let i = 0; i < count; i++) {
      const roll = Math.random();
      let acc = 0, rgb = PALETTE.white;
      for (const b of buckets) { acc += b.weight; if (roll <= acc) { rgb = b.rgb; break; } }

      const z = U.rand(0.22, 1);                        // depth → parallax + speed
      const dust = Math.random() < 0.055;
      stars.push({
        x: U.rand(0, state.w),
        y: U.rand(0, state.h),
        z,
        r: dust ? U.rand(9, 22) : U.rand(0.5, 1.7) * z,
        base: dust ? U.rand(0.16, 0.34) : U.rand(0.3, 0.85),
        tw: U.rand(0, U.TAU),
        tws: U.rand(0.4, 1.7),
        rgb,
        dust,
        vy: U.rand(0.12, 0.42) * (dust ? 0.5 : 1)
      });
    }
  }

  function renderAmbient(time, dt) {
    if (!state.ambientDirty && state.reduced) return;
    ctxBack.clearRect(0, 0, state.w, state.h);

    const px = (pointer.x - state.w / 2);
    const py = (pointer.y - state.h / 2);

    ctxBack.globalCompositeOperation = 'lighter';

    // small stars batched per colour bucket (1 fill call per colour)
    const buckets = {};
    for (const s of stars) {
      if (s.dust) continue;
      const offX = s.x + px * 0.014 * s.z;
      const offY = s.y + py * 0.010 * s.z;
      const alpha = s.base * (0.62 + 0.38 * Math.sin(time * 0.0012 * s.tws + s.tw));
      const b = buckets[s.rgb] || (buckets[s.rgb] = { path: new Path2D(), alphas: [] });
      b.path.moveTo(offX + s.r, offY);
      b.path.arc(offX, offY, s.r, 0, U.TAU);
      b.alphas.push(alpha);
    }
    for (const rgb in buckets) {
      // average alpha keeps this to a single draw call per colour
      const list = buckets[rgb].alphas;
      const avg = list.reduce((a, b) => a + b, 0) / (list.length || 1);
      ctxBack.fillStyle = `rgba(${rgb},${avg.toFixed(3)})`;
      ctxBack.fill(buckets[rgb].path);
    }

    // drifting dust glows
    for (const s of stars) {
      if (!s.dust) continue;
      const offX = s.x + px * 0.02 * s.z;
      const offY = s.y + py * 0.014 * s.z;
      const alpha = s.base * (0.7 + 0.3 * Math.sin(time * 0.0009 * s.tws + s.tw));
      ctxBack.globalAlpha = alpha;
      const size = s.r * 4;
      ctxBack.drawImage(getSprite(s.rgb), offX - size / 2, offY - size / 2, size, size);
    }
    ctxBack.globalAlpha = 1;
    ctxBack.globalCompositeOperation = 'source-over';

    // animate (skipped entirely when the user prefers reduced motion)
    if (state.reduced) { state.ambientDirty = false; return; }
    for (const s of stars) {
      s.y -= s.vy * dt;
      if (s.y < -30) { s.y = state.h + 30; s.x = U.rand(0, state.w); }
    }
  }

  /* ── Spawners ────────────────────────────────────────────────────────── */

  /** Radial spark + glow explosion. */
  function burst(x, y, options = {}) {
    if (state.reduced && !options.allowReduced) return;
    ensureRunning();

    // Calm profile: motion-sensitive users get one clean expanding ring.
    if (state.reduced) {
      pushRing({ x, y, r: 10, rMax: 180, life: 50, rgb: U.pick(options.colors || BURST_COLORS),
                 width: 2, ripple: false });
      return;
    }
    const {
      count = 64,
      speed = 8,
      spread = 1,
      colors = BURST_COLORS,
      size = [1, 3],
      life = [34, 82],
      ringCount = 2,
      glowCount = 18
    } = options;

    const scale = state.lowPower ? 0.55 : 1;
    const n = Math.round(count * scale);

    for (let i = 0; i < n; i++) {
      const angle = U.rand(0, U.TAU) * spread + (1 - spread) * U.rand(0, U.TAU);
      const vel = U.rand(speed * 0.25, speed);
      pushSpark({
        x, y,
        vx: Math.cos(angle) * vel,
        vy: Math.sin(angle) * vel,
        life: U.rand(life[0], life[1]),
        rgb: U.pick(colors),
        width: U.rand(size[0], size[1]),
        drag: 0.945
      });
    }

    for (let i = 0; i < Math.round(glowCount * scale); i++) {
      const angle = U.rand(0, U.TAU);
      const vel = U.rand(1, speed * 0.42);
      pushGlow({
        x, y,
        vx: Math.cos(angle) * vel,
        vy: Math.sin(angle) * vel,
        life: U.rand(26, 58),
        rgb: U.pick(colors),
        size: U.rand(14, 46),
        drag: 0.93,
        peak: 0.85
      });
    }

    for (let i = 0; i < Math.round(ringCount * scale); i++) {
      pushRing({
        x, y,
        r: 6 + i * 5,
        rMax: U.rand(110, 240) + i * 40,
        life: U.rand(42, 62),
        rgb: U.pick(colors),
        width: U.rand(1.2, 2.6),
        ripple: true
      });
    }
  }

  /** Quick, gentle pulse — used when a screen / element arrives. */
  function pulse(x, y, rgb = PALETTE.cyan, strength = 1) {
    if (state.reduced) return;
    ensureRunning();
    const scale = state.lowPower ? 0.5 : 1;
    for (let i = 0; i < Math.round(20 * strength * scale); i++) {
      const angle = U.rand(0, U.TAU);
      const vel = U.rand(2.5, 7.5) * strength;
      pushSpark({
        x, y, vx: Math.cos(angle) * vel, vy: Math.sin(angle) * vel,
        life: U.rand(20, 46), rgb, width: U.rand(1, 2.2), drag: 0.94
      });
    }
    pushRing({ x, y, r: 8, rMax: 150 * strength, life: 40, rgb, width: 1.8, ripple: true });
  }

  /**
   * Implosion: particles spawn on a ring and fly *inward* toward the point.
   * Used while the acknowledge button "charges up".
   */
  function implode(x, y, options = {}) {
    if (state.reduced) return;
    ensureRunning();
    const { count = 20, radius = 210, speed = 7, colors = BURST_COLORS } = options;
    const n = Math.round(count * (state.lowPower ? 0.6 : 1));

    for (let i = 0; i < n; i++) {
      const angle = U.rand(0, U.TAU);
      const dist = radius * U.rand(0.5, 1.15);
      const v = speed * U.rand(0.7, 1.35);
      pushSpark({
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        vx: -Math.cos(angle) * v,
        vy: -Math.sin(angle) * v,
        life: U.rand(16, 32),
        rgb: U.pick(colors),
        width: U.rand(1, 2.2),
        drag: 0.999
      });
    }
    pushGlow({ x, y, vx: 0, vy: 0, life: 24, rgb: U.pick(colors), size: 64, drag: 1, peak: 0.5 });
  }

  /** Confetti shower. `origin` optional — otherwise it rains from the top. */
  function throwConfetti(origin = null, options = {}) {
    if (state.reduced) return;
    ensureRunning();
    const scale = state.lowPower ? 0.5 : 1;
    const n = Math.round((options.count || 150) * scale);

    for (let i = 0; i < n; i++) {
      const fromPoint = !!origin;
      const x = fromPoint ? origin.x + U.rand(-40, 40) : U.rand(0, state.w);
      const y = fromPoint ? origin.y + U.rand(-20, 20) : U.rand(-160, -10);
      const angle = fromPoint ? U.rand(0, U.TAU) : U.rand(Math.PI * 0.15, Math.PI * 0.85);
      const speed = fromPoint ? U.rand(6, 17) : U.rand(1, 4.5);

      if (confetti.length > budget.confetti) confetti.shift();
      confetti.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: fromPoint ? Math.sin(angle) * speed - U.rand(3, 9) : speed,
        w: U.rand(4, 9),
        h: U.rand(6, 13),
        rot: U.rand(0, U.TAU),
        spin: U.rand(-0.22, 0.22),
        sway: U.rand(0.02, 0.09),
        swayPhase: U.rand(0, U.TAU),
        gravity: U.rand(0.17, 0.31),
        drag: 0.988,
        color: U.pick(CONFETTI_COLORS),
        life: U.rand(150, 320),
        shape: Math.random() < 0.26 ? 'circle' : 'rect'
      });
    }
  }

  /** Full celebration: shockwave + sparks + confetti. */
  function celebrate(x, y) {
    flashScreen(x, y);
    burst(x, y, { count: 120, speed: 13, ringCount: 3, glowCount: 30, allowReduced: true });
    throwConfetti({ x, y }, { count: 170 });
    // second wave, slightly delayed, rains from above
    setTimeout(() => {
      burst(x, y, { count: 60, speed: 9, ringCount: 1, glowCount: 12, allowReduced: true });
      throwConfetti(null, { count: 110 });
    }, 320);
    if (VR.audio) VR.audio.sfx.sparkle();
  }

  /** White/pink screen flash — the DOM element handles the animation. */
  function flashScreen(x, y) {
    const flash = document.getElementById('flash');
    if (!flash || state.reduced) return;
    flash.style.setProperty('--fx-x', `${(x / state.w) * 100}%`);
    flash.style.setProperty('--fx-y', `${(y / state.h) * 100}%`);
    flash.classList.remove('is-firing');
    void flash.offsetWidth;                        // restart the CSS animation
    flash.classList.add('is-firing');
    setTimeout(() => flash.classList.remove('is-firing'), 900);
  }

  /* ── Pool helpers ────────────────────────────────────────────────────── */
  /** Make sure the rAF loop is alive before queuing new work. */
  function ensureRunning() {
    if (!state.running) start();
  }

  function pushGlow(p) {
    if (glows.length >= budget.glows) glows.shift();
    p.max = p.life;
    glows.push(p);
  }
  function pushSpark(p) {
    if (sparks.length >= budget.sparks) sparks.shift();
    p.max = p.life;
    sparks.push(p);
  }
  function pushRing(p) {
    if (rings.length >= budget.rings) rings.shift();
    p.max = p.life;
    p.phase = 0;
    rings.push(p);
  }

  /* ── Pointer interaction ─────────────────────────────────────────────── */
  function onPointerMove(e) {
    if (e.pointerType === 'touch' && pointer.down) return;   // keep taps clean
    const x = e.clientX, y = e.clientY;
    const dx = x - pointer.x, dy = y - pointer.y;

    pointer.vx = dx;
    pointer.vy = dy;
    pointer.x = x;
    pointer.y = y;
    pointer.active = true;
    pointer.lastMove = performance.now();

    if (spotEl && !state.reduced) {
      if (!spotRaf) {
        spotRaf = requestAnimationFrame(() => {
          spotRaf = 0;
          spotEl.style.transform = `translate3d(${pointer.x}px, ${pointer.y}px, 0)`;
        });
      }
    }

    if (state.reduced) return;

    const dist = Math.min(160, Math.hypot(dx, dy));
    if (dist < 1) return;
    ensureRunning();

    pointer.trailTick += dist;
    const spacing = state.lowPower ? 26 : 15;

    while (pointer.trailTick > spacing) {
      pointer.trailTick -= spacing;
      pointer.hue = (pointer.hue + 1) % 3;
      const rgb = [PALETTE.cyan, PALETTE.violet, PALETTE.magenta][pointer.hue];
      pushGlow({
        x: x - dx * U.rand(0.1, 0.6) + U.rand(-3, 3),
        y: y - dy * U.rand(0.1, 0.6) + U.rand(-3, 3),
        vx: dx * 0.06 + U.rand(-0.6, 0.6),
        vy: dy * 0.06 + U.rand(-0.6, 0.6) - 0.2,
        life: U.rand(18, 40),
        rgb,
        size: U.rand(12, 30),
        drag: 0.93,
        peak: 0.55
      });
      if (Math.random() < 0.2) {
        pushSpark({
          x, y,
          vx: U.rand(-1.6, 1.6), vy: U.rand(-1.8, 0.6),
          life: U.rand(14, 30), rgb: PALETTE.white, width: U.rand(0.8, 1.6), drag: 0.95
        });
      }
    }
  }

  function onPointerDown(e) {
    pointer.down = true;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
  }

  function onPointerUp() { pointer.down = false; }

  function onPointerLeave() {
    pointer.active = false;
    document.body.classList.remove('has-pointer');
  }

  /* ── Update + render ─────────────────────────────────────────────────── */
  function loop(now) {
    state.rafId = requestAnimationFrame(loop);
    const dt = Math.min(2.6, (now - state.last) / 16.6667);
    state.last = now;

    renderAmbient(now, dt);
    renderFront(now, dt);

    // hibernate when the ambient field is static and every pool is empty
    const idle = state.reduced && !glows.length && !sparks.length && !rings.length && !confetti.length;
    if (idle) stop();
  }

  function renderFront(time, dt) {
    const wanders = glows.length || sparks.length || rings.length || confetti.length;
    const pointerFresh = pointer.active && (time - pointer.lastMove) < 420;
    const dirty = wanders || pointerFresh;

    if (!dirty && !state.frontWasDirty) return;
    ctxFront.clearRect(0, 0, state.w, state.h);
    state.frontWasDirty = dirty;
    if (!dirty) return;

    /* rings */
    if (rings.length) {
      ctxFront.globalCompositeOperation = 'lighter';
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.phase += dt;
        r.life -= dt;
        const t = 1 - r.life / r.max;
        const radius = U.lerp(r.r, r.rMax, 1 - Math.pow(1 - t, 2.6));
        const alpha = Math.max(0, (1 - t) * (1 - t) * 0.9);
        if (r.life <= 0) { rings.splice(i, 1); continue; }
        ctxFront.beginPath();
        ctxFront.arc(r.x, r.y, radius, 0, U.TAU);
        ctxFront.strokeStyle = `rgba(${r.rgb},${alpha.toFixed(3)})`;
        ctxFront.lineWidth = r.width * (1 - t * 0.6);
        ctxFront.stroke();
        if (r.ripple) {
          ctxFront.beginPath();
          ctxFront.arc(r.x, r.y, radius * 0.72, 0, U.TAU);
          ctxFront.strokeStyle = `rgba(${r.rgb},${(alpha * 0.35).toFixed(3)})`;
          ctxFront.lineWidth = r.width * 0.6;
          ctxFront.stroke();
        }
      }
    }

    /* glow particles */
    if (glows.length) {
      ctxFront.globalCompositeOperation = 'lighter';
      for (let i = glows.length - 1; i >= 0; i--) {
        const p = glows[i];
        p.life -= dt;
        if (p.life <= 0) { glows.splice(i, 1); continue; }
        const t = p.life / p.max;
        const alpha = Math.pow(t, 1.35) * (p.peak ?? 1);
        p.vx *= p.drag; p.vy *= p.drag;
        p.x += p.vx * dt; p.y += p.vy * dt;

        const size = p.size * (1.25 - t * 0.35);
        ctxFront.globalAlpha = alpha;
        ctxFront.drawImage(getSprite(p.rgb), p.x - size / 2, p.y - size / 2, size, size);
      }
      ctxFront.globalAlpha = 1;
    }

    /* sparks (motion-stretched additive lines) */
    if (sparks.length) {
      ctxFront.globalCompositeOperation = 'lighter';
      ctxFront.lineCap = 'round';
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.life -= dt;
        if (s.life <= 0) { sparks.splice(i, 1); continue; }
        const t = s.life / s.max;
        s.vx *= s.drag; s.vy *= s.drag;
        s.vy += 0.03 * dt;                         // faint downward pull
        s.x += s.vx * dt; s.y += s.vy * dt;

        const len = Math.min(26, Math.hypot(s.vx, s.vy) * 2.6);
        ctxFront.strokeStyle = `rgba(${s.rgb},${(t * 0.95).toFixed(3)})`;
        ctxFront.lineWidth = s.width * t;
        ctxFront.beginPath();
        ctxFront.moveTo(s.x, s.y);
        ctxFront.lineTo(s.x - s.vx * (len / (Math.hypot(s.vx, s.vy) || 1)) * 0.5,
                        s.y - s.vy * (len / (Math.hypot(s.vx, s.vy) || 1)) * 0.5);
        ctxFront.stroke();
      }
    }

    /* confetti (normal blending so the colours read properly) */
    if (confetti.length) {
      ctxFront.globalCompositeOperation = 'source-over';
      for (let i = confetti.length - 1; i >= 0; i--) {
        const c = confetti[i];
        c.life -= dt;
        c.vy += c.gravity * dt;
        c.vx *= c.drag;
        c.vy *= 0.999;
        c.swayPhase += c.sway * dt * 3;
        c.rot += c.spin * dt;
        c.x += (c.vx + Math.sin(c.swayPhase) * 0.9) * dt;
        c.y += c.vy * dt;

        if (c.life <= 0 || c.y > state.h + 60) { confetti.splice(i, 1); continue; }

        const fade = c.life < 30 ? c.life / 30 : 1;
        ctxFront.save();
        ctxFront.globalAlpha = fade;
        ctxFront.translate(c.x, c.y);
        ctxFront.rotate(c.rot);
        ctxFront.fillStyle = c.color;
        if (c.shape === 'circle') {
          ctxFront.beginPath();
          ctxFront.arc(0, 0, c.w * 0.5, 0, U.TAU);
          ctxFront.fill();
        } else {
          ctxFront.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
        }
        ctxFront.restore();
      }
      ctxFront.globalAlpha = 1;
    }

    /* cursor aura — a soft halo that lingers briefly after the last move */
    if (pointerFresh && !state.reduced) {
      const age = (time - pointer.lastMove) / 420;
      ctxFront.globalCompositeOperation = 'lighter';
      ctxFront.globalAlpha = (1 - age) * 0.4;
      const size = state.lowPower ? 70 : 96;
      ctxFront.drawImage(getSprite(PALETTE.cyan), pointer.x - size / 2, pointer.y - size / 2, size, size);
      ctxFront.globalAlpha = 0.28 * (1 - age);
      ctxFront.drawImage(getSprite(PALETTE.magenta),
        pointer.x - size * 0.3, pointer.y - size * 0.3, size * 0.6, size * 0.6);
      ctxFront.globalAlpha = 1;
    }
  }

  /* ── Lifecycle ───────────────────────────────────────────────────────── */
  function start() {
    if (state.running) return;
    state.running = true;
    state.last = performance.now();
    cancelAnimationFrame(state.rafId);
    state.rafId = requestAnimationFrame(loop);
  }

  function stop() {
    state.running = false;
    cancelAnimationFrame(state.rafId);
  }

  function onVisibility() {
    if (document.hidden) stop();
    else if (!state.reduced || glows.length || sparks.length || rings.length || confetti.length) start();
  }

  function clear() {
    glows.length = sparks.length = rings.length = confetti.length = 0;
    ctxFront && ctxFront.clearRect(0, 0, state.w, state.h);
  }

  return {
    init, burst, pulse, implode, throwConfetti, celebrate, flashScreen, clear, start, stop,
    get reduced() { return state.reduced; },
    get lowPower() { return state.lowPower; }
  };
})();
