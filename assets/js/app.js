/* ══════════════════════════════════════════════════════════════════════════
   VR.app — Wish_Acknowledgement.VR
   --------------------------------------------------------------------------
   Flow:  boot sequence  →  sender identified  →  wish detected
          →  FRIENDSHIP TEST  →  FRIENDSHIP REVEAL
          →  ACKNOWLEDGE WISH  →  receipt  →  sign-off

   One URL, unlimited friends: the sender name comes from
   ?name=PERSON (URLSearchParams, encoding handled by the browser).
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const U = VR.utils;
  const A = VR.audio;
  const FX = VR.fx;

  /* ── Configuration ───────────────────────────────────────────────────── */
  const CONFIG = {
    fallbackName: 'Friend',
    eventMonth: 8,
    eventDay: 30,
    signature: 'Volam Rakshith',
    brand: 'VR Developments',
    typingSpeed: 12,
    maxNameLength: 42
  };

  /** Colour triplets shared with the FX engine for DOM-anchored effects. */
  const RGB = {
    cyan: '39,230,255',
    violet: '124,92,255',
    magenta: '255,47,208'
  };

  const MODULES = [
    'WISH PROTOCOL',
    'TRIP SUBSYSTEM',
    'BLESSING DECODER',
    'THANK-YOU ENGINE',
    'VIBE CALIBRATOR'
  ];

  const CHANNELS = [
    'WHATSAPP',
    'INSTAGRAM DM',
    'SMS',
    'VOICE NOTE',
    'PHONE CALL',
    'IN PERSON',
    'EMAIL',
    'TELEPATHY',
    'CARRIER PIGEON'
  ];

  /* ── DOM references ──────────────────────────────────────────────────── */
  const dom = {
    scenes: {
      boot:       document.getElementById('scene-boot'),
      detect:     document.getElementById('scene-detect'),
      friendship: document.getElementById('scene-friendship'),
      result:     document.getElementById('scene-result'),
      final:      document.getElementById('scene-final')
    },

    bootLog:      document.getElementById('boot-log'),
    bootBar:      document.getElementById('boot-bar'),
    bootPct:      document.getElementById('boot-pct'),
    bootState:    document.getElementById('boot-state'),
    bootHint:     document.getElementById('boot-hint'),
    bootViewLog:  document.getElementById('boot-view-log'),
    bootViewName: document.getElementById('boot-view-name'),
    revealName:   document.getElementById('reveal-name'),
    revealLine:   document.getElementById('reveal-line'),

    wishPanel:    document.getElementById('wish-panel'),
    wishReadout:  document.getElementById('wish-readout'),
    cta:          document.getElementById('btn-acknowledge'),

    friendshipPanel:       document.getElementById('friendship-panel'),
    btnTestFriendship:     document.getElementById('btn-test-friendship'),
    friendshipReveal:      document.getElementById('friendship-reveal'),
    btnFriendshipContinue: document.getElementById('btn-friendship-continue'),

    statusList:   document.getElementById('status-list'),
    resultTitle:  document.getElementById('result-title'),
    resultStamp:  document.getElementById('result-stamp'),
    receiptId:    document.getElementById('receipt-id'),

    btnSkip:      document.getElementById('btn-skip'),
    btnSound:     document.getElementById('btn-sound'),
    btnContinue:  document.getElementById('btn-continue'),
    btnCopy:      document.getElementById('btn-copy'),
    btnReplayA:   document.getElementById('btn-replay-a'),
    btnReplayB:   document.getElementById('btn-replay-b'),

    hudClock:     document.getElementById('hud-clock'),
    hudCountdown: document.getElementById('hud-countdown'),
    hudYear:      document.getElementById('hud-year'),
    finalClock:   document.getElementById('final-clock'),

    toast:        document.getElementById('toast'),
    toastText:    document.getElementById('toast-text'),
    srStatus:     document.getElementById('sr-status')
  };

  /* ── Application state ───────────────────────────────────────────────── */
  const ctx = {
    sender: CONFIG.fallbackName,
    hasNameParam: false,

    scene: 'boot',

    bootController: null,
    skipRequested: false,
    bootComplete: false,

    friendshipTested: false,

    acknowledging: false,
    acknowledged: false,

    receiptId: '',
    channel: '',
    receiveCount: 1,

    toastTimer: 0
  };

  /* ══════════════════════════════════════════════════════════════════════
     1 · URL PERSONALIZATION
     ══════════════════════════════════════════════════════════════════════ */

  /**
   * Read ?name=PERSON_NAME from the URL.
   */
  function readSenderFromUrl() {
    let raw = '';

    try {
      const params = new URLSearchParams(window.location.search);
      raw = (params.get('name') || '').trim();

      if (!raw) {
        const hash = window.location.hash || '';
        const qIndex = hash.indexOf('?');

        if (qIndex > -1) {
          raw = (
            new URLSearchParams(hash.slice(qIndex)).get('name') || ''
          ).trim();
        }
      }
    } catch (_) {
      raw = '';
    }

    raw = raw
      .replace(/[\u0000-\u001F\u007F<>]/g, '')
      .replace(/\s+/g, ' ');

    if (!raw) {
      return {
        name: CONFIG.fallbackName,
        found: false
      };
    }

    const isFlatCase =
      raw === raw.toUpperCase() ||
      raw === raw.toLowerCase();

    if (isFlatCase) {
      raw = raw
        .split(' ')
        .map((word) =>
          word.charAt(0).toUpperCase() +
          word.slice(1).toLowerCase()
        )
        .join(' ');
    }

    if (raw.length > CONFIG.maxNameLength) {
      raw =
        raw.slice(0, CONFIG.maxNameLength).trim() +
        '…';
    }

    return {
      name: raw,
      found: true
    };
  }

  /** Waive "you already wished me" — a repeat wish is just extra love. */
  function registerReceive() {
    const key = `wish-ack:${ctx.sender.toLowerCase()}`;

    try {
      const seen =
        Number(sessionStorage.getItem(key) || 0) + 1;

      sessionStorage.setItem(key, String(seen));
      ctx.receiveCount = seen;
    } catch (_) {
      ctx.receiveCount = 1;
    }
  }

  /* ══════════════════════════════════════════════════════════════════════
     2 · SHARED UI HELPERS
     ══════════════════════════════════════════════════════════════════════ */

  function announce(message) {
    if (dom.srStatus) {
      dom.srStatus.textContent = message;
    }
  }

  function haptic(pattern) {
    if (
      FX.reduced ||
      typeof navigator.vibrate !== 'function'
    ) {
      return;
    }

    try {
      navigator.vibrate(pattern);
    } catch (_) {}
  }

  function showToast(message, duration = 2400) {
    if (!dom.toast) return;

    dom.toast.hidden = false;
    dom.toastText.textContent = message;

    requestAnimationFrame(() => {
      dom.toast.classList.add('is-visible');
    });

    clearTimeout(ctx.toastTimer);

    ctx.toastTimer = setTimeout(() => {
      dom.toast.classList.remove('is-visible');

      setTimeout(() => {
        dom.toast.hidden = true;
      }, 320);
    }, duration);
  }

  /** Short chromatic glitch on an element. */
  function glitch(node, times = 2) {
    if (!node || FX.reduced) return;

    let remaining = times;

    const fire = () => {
      node.classList.remove('is-glitching');

      void node.offsetWidth;

      node.classList.add('is-glitching');

      if (--remaining > 0) {
        setTimeout(fire, 520);
      }
    };

    fire();
  }

  /** Write sender name into every [data-name-slot]. */
  function paintName() {
    U.qsa('[data-name-slot]').forEach((node) => {
      node.textContent = ctx.sender;
      node.setAttribute('data-text', ctx.sender);
      node.setAttribute('title', ctx.sender);
      U.fitName(node, ctx.sender);
    });
  }

  function setScene(name, { force = false } = {}) {
    const next = dom.scenes[name];

    if (!next || (ctx.scene === name && !force)) {
      return;
    }

    Object.keys(dom.scenes).forEach((key) => {
      const scene = dom.scenes[key];

      if (!scene || scene === next) return;

      if (scene.classList.contains('is-active')) {
        scene.classList.add('is-leaving');

        setTimeout(() => {
          scene.classList.remove('is-leaving');
        }, 700);
      }

      scene.classList.remove('is-active');
    });

    next.classList.add('is-active');
    next.scrollTop = 0;

    if (name !== 'boot') {
      haptic(12);
    }

    ctx.scene = name;

    const labels = {
      boot: 'System initialization',
      detect: `Birthday wish detected from ${ctx.sender}`,
      friendship: 'Friendship analysis',
      result: 'Wish acknowledged',
      final: 'Acknowledgement complete'
    };

    announce(labels[name] || name);
  }

  function focusSoon(node) {
    if (
      !node ||
      !window.matchMedia('(pointer: fine)').matches
    ) {
      return;
    }

    setTimeout(() => {
      node.focus({ preventScroll: true });
    }, 420);
  }

  const titleCase = (str) => str.toUpperCase();

  function pickChannel() {
    if (!ctx.channel) {
      ctx.channel = U.pick(CHANNELS);
    }

    return ctx.channel;
  }

  /* ══════════════════════════════════════════════════════════════════════
     3 · HUD CLOCK + COUNTDOWN
     ══════════════════════════════════════════════════════════════════════ */

  function daysUntilEvent(from = new Date()) {
    const year = from.getFullYear();

    let target = new Date(
      year,
      CONFIG.eventMonth,
      CONFIG.eventDay,
      0,
      0,
      0
    );

    const isToday =
      from.getMonth() === CONFIG.eventMonth &&
      from.getDate() === CONFIG.eventDay;

    if (isToday) {
      return {
        today: true,
        days: 0,
        hours: 0,
        minutes: 0
      };
    }

    if (target < from) {
      target = new Date(
        year + 1,
        CONFIG.eventMonth,
        CONFIG.eventDay,
        0,
        0,
        0
      );
    }

    const diff = target - from;

    return {
      today: false,
      days: Math.floor(diff / 86400000),
      hours: Math.floor(
        (diff % 86400000) / 3600000
      ),
      minutes: Math.floor(
        (diff % 3600000) / 60000
      )
    };
  }

  function startClock() {
    const tick = () => {
      const now = new Date();
      const clock = U.formatClock(now);

      if (dom.hudClock) {
        dom.hudClock.textContent = clock;
      }

      if (dom.finalClock) {
        dom.finalClock.textContent = clock;
      }

      if (dom.hudYear) {
        dom.hudYear.textContent =
          String(now.getFullYear());
      }

      if (dom.hudCountdown) {
        const t = daysUntilEvent(now);

        dom.hudCountdown.textContent = t.today
          ? 'CELEBRATION LIVE'
          : `T-${t.days}D ${String(t.hours).padStart(2, '0')}H ${String(t.minutes).padStart(2, '0')}M`;
      }
    };

    tick();
    setInterval(tick, 1000);
  }

  /* ══════════════════════════════════════════════════════════════════════
     4 · BOOT SEQUENCE
     ══════════════════════════════════════════════════════════════════════ */

  function bootLines() {
    return [
      {
        text: 'INITIALIZING…',
        chip: 'OK'
      },
      {
        text: 'MODULE: ' + U.pick(MODULES),
        chip: 'OK'
      },
      {
        text: 'CONNECTING…',
        chip: 'LINK UP'
      },
      {
        text: 'BIRTHDAY EVENT DETECTED — 30 SEPT',
        chip: 'CONFIRMED'
      },
      {
        text: 'INCOMING WISH DETECTED',
        chip: 'DECRYPTED'
      },
      {
        text: 'IDENTIFYING SENDER…',
        chip: 'MATCH'
      }
    ];
  }

  function setProgress(percent) {
    const value = U.clamp(percent, 0, 100);

    if (dom.bootBar) {
      dom.bootBar.style.width = `${value}%`;
    }

    if (dom.bootPct) {
      dom.bootPct.textContent =
        `${Math.round(value)}%`;
    }
  }

  async function addLogLine(
    line,
    signal,
    { instant = false } = {}
  ) {
    const row = U.el('li', 'log__line');

    row.appendChild(
      U.el('span', 'log__glyph', '▸')
    );

    const text = U.el('span', 'log__text');
    row.appendChild(text);

    const chip = U.el(
      'span',
      'log__chip',
      '…'
    );

    chip.classList.add('is-live');
    row.appendChild(chip);

    dom.bootLog.appendChild(row);

    dom.bootLog.scrollTop =
      dom.bootLog.scrollHeight;

    if (instant || FX.reduced) {
      text.textContent = line.text;
    } else {
      await U.typeInto(
        text,
        line.text,
        {
          speed: CONFIG.typingSpeed,
          jitter: 11,
          signal
        }
      );

      if (!signal.aborted) {
        await U.delay(
          U.rand(30, 70),
          signal
        );
      }
    }

    chip.classList.remove('is-live');
    chip.classList.add('is-done');
    chip.textContent = line.chip;

    if (ctx.scene === 'boot') {
      A.sfx.ok();
    }

    dom.bootLog.scrollTop =
      dom.bootLog.scrollHeight;

    return row;
  }

  function flushBootLog(lines) {
    lines = lines || bootLines();

    U.clear(dom.bootLog);

    lines.forEach((line) => {
      const row = U.el(
        'li',
        'log__line'
      );

      row.style.animationDuration = '1ms';

      row.appendChild(
        U.el(
          'span',
          'log__glyph',
          '▸'
        )
      );

      row.appendChild(
        U.el(
          'span',
          'log__text',
          line.text
        )
      );

      const chip = U.el(
        'span',
        'log__chip is-done',
        line.chip
      );

      chip.style.opacity = '1';

      row.appendChild(chip);
      dom.bootLog.appendChild(row);
    });

    setProgress(100);
  }

  async function runBootSequence() {
    ctx.bootController =
      new AbortController();

    const { signal } =
      ctx.bootController;

    const lines = bootLines();
    const total = lines.length;

    for (let i = 0; i < total; i++) {
      if (ctx.skipRequested) {
        break;
      }

      setProgress(
        (i / total) * 88
      );

      if (
        i === 4 &&
        !ctx.skipRequested
      ) {
        A.sfx.detect();

        if (dom.bootState) {
          dom.bootState.textContent =
            'WISH INBOUND';
        }

        glitch(
          dom.bootState,
          1
        );

        FX.pulse(
          window.innerWidth * 0.5,
          window.innerHeight * 0.42,
          RGB.cyan,
          0.7
        );
      }

      await addLogLine(
        lines[i],
        signal
      );
    }

    if (ctx.skipRequested) {
      flushBootLog(lines);
    }

    setProgress(100);

    await U.delay(
      FX.reduced ? 120 : 260
    );

    if (dom.bootState) {
      dom.bootState.textContent =
        'IDENTITY RESOLVED';
    }

    await showIdentityReveal();
  }

  /* ── Identity reveal ─────────────────────────────────────────────────── */
  async function showIdentityReveal() {
    if (dom.bootHint) {
      dom.bootHint.classList.add(
        'is-hidden'
      );
    }

    dom.bootViewLog.classList.add(
      'is-done'
    );

    dom.bootViewLog.setAttribute(
      'aria-hidden',
      'true'
    );

    dom.bootViewName.setAttribute(
      'aria-hidden',
      'false'
    );

    glitch(
      dom.revealName,
      1
    );

    await U.delay(
      ctx.skipRequested ? 40 : 260
    );

    const perChar =
      ctx.sender.length
        ? Math.min(
            46,
            Math.round(
              700 / ctx.sender.length
            )
          )
        : 46;

    const speed =
      ctx.skipRequested || FX.reduced
        ? 0
        : perChar;

    let keyTicker = 0;

    if (speed) {
      A.sfx.tick();

      keyTicker = setInterval(
        () => A.sfx.key(),
        Math.max(
          60,
          speed * 2
        )
      );
    }

    await U.typeInto(
      dom.revealName,
      ctx.sender,
      {
        speed,
        jitter: 12,
        glitch: true
      }
    );

    clearInterval(keyTicker);

    U.fitName(
      dom.revealName,
      ctx.sender
    );

    await U.delay(
      ctx.skipRequested ? 20 : 60
    );

    dom.bootViewName.classList.add(
      'is-active'
    );

    U.fitName(
      dom.revealName,
      ctx.sender
    );

    const rect =
      dom.revealName.getBoundingClientRect();

    FX.burst(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
      {
        count: 52,
        speed: 9,
        ringCount: 2,
        glowCount: 14
      }
    );

    glitch(
      dom.revealName,
      2
    );

    A.sfx.boom();

    if (dom.revealLine) {
      const own =
        await (async () => {
          if (!ctx.hasNameParam) {
            return 'Generic sender profile loaded. No name tag detected — the wish still counts.';
          }

          return ctx.receiveCount > 1
            ? `Welcome back. This is wish #${ctx.receiveCount} from you. The system is keeping count.`
            : 'Identity confirmed. Preparing acknowledgement interface…';
        })();

      const lineSpeed =
        own.length
          ? Math.min(
              13,
              Math.round(
                750 / own.length
              )
            )
          : 13;

      await U.typeInto(
        dom.revealLine,
        own,
        {
          speed:
            ctx.skipRequested
              ? 0
              : lineSpeed,
          jitter: 6
        }
      );
    }

    announce(
      `Sender identified: ${ctx.sender}`
    );

    ctx.bootComplete = true;

    if (dom.btnSkip) {
      dom.btnSkip.hidden = true;
    }

    await U.delay(
      ctx.skipRequested ? 200 : 560
    );

    goToDetect();
  }

  /** Skip / fast-forward affordance for the intro. */
  function requestSkip() {
    if (
      ctx.bootComplete ||
      ctx.skipRequested
    ) {
      return;
    }

    ctx.skipRequested = true;

    if (ctx.bootController) {
      ctx.bootController.abort();
    }

    if (dom.btnSkip) {
      dom.btnSkip.hidden = true;
    }
  }

  /* ══════════════════════════════════════════════════════════════════════
     5 · SCENE 2 — WISH DETECTED
     ══════════════════════════════════════════════════════════════════════ */

  function buildReadout() {
    const t = daysUntilEvent();

    const countdown = t.today
      ? 'TODAY — TRIP IMMINENT'
      : `${t.days}D ${String(t.hours).padStart(2, '0')}H TO GO`;

    const items = [
      {
        key: 'SENDER ID',
        value: titleCase(ctx.sender),
        state: 'live',
        span: 'full',
        priority: 1
      },
      {
        key: 'WISH TYPE',
        value: 'BIRTHDAY (CLASSIC)',
        state: '',
        priority: 1
      },
      {
        key: 'CHANNEL',
        value: pickChannel(),
        state: '',
        priority: 1
      },
      {
        key: 'TRIP STATUS',
        value: 'CONFIRMED',
        state: 'ok',
        priority: 1
      },
      {
        key: 'ENCRYPTION',
        value: 'OFF (BIRTHDAY)',
        state: 'fun',
        priority: 1
      },
      {
        key: 'RECEIVE COUNT',
        value:
          ctx.receiveCount > 1
            ? `×${ctx.receiveCount} — EXTRA LOVE`
            : '×1',
        state:
          ctx.receiveCount > 1
            ? 'fun'
            : '',
        priority:
          ctx.receiveCount > 1
            ? 2
            : 3
      },
      {
        key: 'SIGNAL QUALITY',
        value: 'EXCELLENT',
        state: 'live',
        priority: 3
      },
      {
        key: 'COUNTDOWN',
        value: countdown,
        state: '',
        priority: 2
      }
    ];

    U.clear(dom.wishReadout);

    items.forEach((item, i) => {
      const row = U.el(
        'li',
        'readout__item'
      );

      if (item.state) {
        row.dataset.state =
          item.state;
      }

      if (item.span) {
        row.dataset.span =
          item.span;
      }

      row.dataset.priority =
        String(
          item.priority || 2
        );

      row.appendChild(
        U.el(
          'span',
          'readout__key',
          item.key
        )
      );

      row.appendChild(
        U.el(
          'span',
          'readout__val',
          item.value
        )
      );

      row.style.animationDelay =
        `${80 + i * 70}ms`;

      dom.wishReadout.appendChild(
        row
      );
    });
  }

  function goToDetect() {
    paintName();
    buildReadout();

    setScene('detect');

    A.sfx.detect();

    const rect =
      dom.wishPanel.getBoundingClientRect();

    FX.pulse(
      rect.left + rect.width / 2,
      rect.top + rect.height * 0.35,
      RGB.cyan,
      0.9
    );

    glitch(
      dom.wishPanel.querySelector(
        '.sender__name'
      ),
      1
    );

    setTimeout(() => {
      if (dom.cta) {
        dom.cta.classList.add(
          'is-ready'
        );
      }
    }, 900);

    focusSoon(dom.cta);

    announce(
      `Birthday wish detected from ${ctx.sender}. Activate the acknowledge button to continue.`
    );
  }

  /* ══════════════════════════════════════════════════════════════════════
     6 · FRIENDSHIP TEST
     ----------------------------------------------------------------------
     No MCQs yet.

     Current behavior:
       ACKNOWLEDGE WISH
              ↓
       FRIENDSHIP TEST
              ↓
       TEST FRIENDSHIP
              ↓
       REVEAL
              ↓
       CONTINUE
              ↓
       existing acknowledgement processing
     ══════════════════════════════════════════════════════════════════════ */

  function goToFriendship() {
    setScene('friendship');

    ctx.friendshipTested = false;

    if (dom.friendshipReveal) {
      dom.friendshipReveal.hidden = true;
    }

    if (dom.btnFriendshipContinue) {
      dom.btnFriendshipContinue.hidden = true;
      dom.btnFriendshipContinue.classList.remove(
        'is-ready'
      );
    }

    if (dom.btnTestFriendship) {
      dom.btnTestFriendship.classList.remove(
        'is-testing',
        'is-done',
        'is-ready'
      );

      const label =
        dom.btnTestFriendship.querySelector(
          '.cta__label'
        );

      const sub =
        dom.btnTestFriendship.querySelector(
          '.cta__sub'
        );

      if (label) {
        label.textContent =
          'TEST FRIENDSHIP';
      }

      if (sub) {
        sub.textContent =
          'Begin relationship analysis';
      }
    }

    if (dom.friendshipPanel) {
      const rect =
        dom.friendshipPanel.getBoundingClientRect();

      FX.pulse(
        rect.left + rect.width / 2,
        rect.top + rect.height * 0.35,
        RGB.violet,
        0.9
      );

      glitch(
        dom.friendshipPanel,
        1
      );
    }

    A.sfx.detect();

    setTimeout(() => {
      if (dom.btnTestFriendship) {
        dom.btnTestFriendship.classList.add(
          'is-ready'
        );
      }
    }, 650);

    focusSoon(
      dom.btnTestFriendship
    );

    announce(
      'Friendship test ready. Begin relationship analysis.'
    );
  }

  async function runFriendshipTest() {
    if (
      ctx.friendshipTested ||
      !dom.btnTestFriendship
    ) {
      return;
    }

    ctx.friendshipTested = true;

    const button =
      dom.btnTestFriendship;

    const label =
      button.querySelector(
        '.cta__label'
      );

    const sub =
      button.querySelector(
        '.cta__sub'
      );

    button.classList.remove(
      'is-ready'
    );

    button.classList.add(
      'is-testing'
    );

    if (label) {
      label.textContent =
        'SCANNING…';
    }

    if (sub) {
      sub.textContent =
        'Checking friendship parameters';
    }

    announce(
      'Scanning relationship data.'
    );

    A.sfx.charge(0.75);

    haptic([
      12,
      50,
      12,
      50,
      18
    ]);

    if (dom.friendshipPanel) {
      const rect =
        dom.friendshipPanel.getBoundingClientRect();

      FX.pulse(
        rect.left + rect.width / 2,
        rect.top + rect.height * 0.45,
        RGB.violet,
        0.8
      );

      if (!FX.reduced) {
        FX.implode(
          rect.left + rect.width / 2,
          rect.top + rect.height * 0.45,
          {
            count: 30,
            radius: 240,
            speed: 7
          }
        );
      }
    }

    await U.delay(
      FX.reduced ? 150 : 1000
    );

    if (label) {
      label.textContent =
        'RESULT READY ✓';
    }

    if (sub) {
      sub.textContent =
        'Analysis complete';
    }

    button.classList.remove(
      'is-testing'
    );

    if (dom.friendshipReveal) {
      dom.friendshipReveal.hidden =
        false;
    }

    A.sfx.boom();

    haptic([
      24,
      40,
      70
    ]);

    if (dom.friendshipPanel) {
      const rect =
        dom.friendshipPanel.getBoundingClientRect();

      FX.burst(
        rect.left + rect.width / 2,
        rect.top + rect.height * 0.55,
        {
          count: 42,
          speed: 8,
          ringCount: 2,
          glowCount: 12
        }
      );
    }

    glitch(
      dom.friendshipPanel,
      2
    );

    announce(
      'Friendship result: We are best friends.'
    );

    await U.delay(
      FX.reduced ? 100 : 500
    );

    if (dom.btnFriendshipContinue) {
      dom.btnFriendshipContinue.hidden =
        false;

      dom.btnFriendshipContinue.classList.add(
        'is-ready'
      );
    }

    announce(
      'Friendship result complete. Continue to process the birthday wish.'
    );

    focusSoon(
      dom.btnFriendshipContinue
    );
  }

  /* ══════════════════════════════════════════════════════════════════════
     7 · THE ACKNOWLEDGEMENT
     ══════════════════════════════════════════════════════════════════════ */

  function animateCharge(
    node,
    duration
  ) {
    return new Promise((resolve) => {
      if (FX.reduced) {
        node.style.setProperty(
          '--charge',
          '100%'
        );

        return resolve();
      }

      const start =
        performance.now();

      const frame = (now) => {
        const t =
          U.clamp(
            (now - start) /
              duration,
            0,
            1
          );

        const eased =
          t * t * (3 - 2 * t);

        node.style.setProperty(
          '--charge',
          `${(eased * 100).toFixed(1)}%`
        );

        if (t < 1) {
          requestAnimationFrame(
            frame
          );
        } else {
          resolve();
        }
      };

      requestAnimationFrame(
        frame
      );
    });
  }

  async function acknowledgeWish() {
    if (
      ctx.acknowledging ||
      ctx.acknowledged
    ) {
      return;
    }

    ctx.acknowledging = true;

    /*
     * The acknowledgement happens after the friendship reveal.
     * The same existing button and animation are preserved.
     */

    if (dom.friendshipPanel) {
      dom.friendshipPanel.classList.add(
        'is-charging'
      );
    }

    await U.delay(
      FX.reduced ? 80 : 180
    );

    setScene('detect');

    const label =
      dom.cta.querySelector(
        '.cta__label'
      );

    const sub =
      dom.cta.querySelector(
        '.cta__sub'
      );

    const rect =
      dom.cta.getBoundingClientRect();

    const cx =
      rect.left +
      rect.width / 2;

    const cy =
      rect.top +
      rect.height / 2;

    dom.cta.classList.remove(
      'is-ready'
    );

    dom.cta.classList.add(
      'is-charging'
    );

    dom.wishPanel.classList.add(
      'is-charging'
    );

    if (label) {
      label.textContent =
        'PROCESSING WISH…';
    }

    if (sub) {
      sub.textContent =
        'Verifying happiness levels · do not close the terminal';
    }

    announce(
      'Processing wish.'
    );

    A.sfx.charge(0.95);

    haptic([
      10,
      60,
      14,
      60,
      18
    ]);

    if (!FX.reduced) {
      let waves = 0;

      const gather =
        setInterval(() => {
          FX.implode(
            cx,
            cy,
            {
              count: 18,
              radius: 240,
              speed: 8
            }
          );

          if (++waves > 5) {
            clearInterval(
              gather
            );
          }
        }, 155);
    }

    await animateCharge(
      dom.cta,
      950
    );

    dom.cta.classList.remove(
      'is-charging'
    );

    dom.wishPanel.classList.remove(
      'is-charging'
    );

    dom.cta.classList.add(
      'is-done'
    );

    if (label) {
      label.textContent =
        'ACKNOWLEDGED ✓';
    }

    if (sub) {
      sub.textContent =
        'Wish logged permanently';
    }

    A.sfx.boom();

    haptic([
      26,
      40,
      80
    ]);

    FX.celebrate(
      cx,
      cy
    );

    glitch(
      dom.wishPanel,
      2
    );

    await U.delay(
      FX.reduced
        ? 200
        : 700
    );

    ctx.acknowledged = true;
    ctx.acknowledging = false;

    buildReceipt();

    setScene('result');

    A.sfx.chime();

    runResultSequence();
  }

  /* ══════════════════════════════════════════════════════════════════════
     8 · SCENE 4 — RECEIPT
     ══════════════════════════════════════════════════════════════════════ */

  function makeReceiptId() {
    const now =
      new Date();

    const stamp =
      `${now.getFullYear()}${String(
        now.getMonth() + 1
      ).padStart(2, '0')}${String(
        now.getDate()
      ).padStart(2, '0')}`;

    const rand =
      String(
        Math.floor(
          Math.random() * 9000
        ) + 1000
      );

    return `VR-${stamp}-${rand}`;
  }

  function statusRows() {
    const rows = [
      {
        key: 'WISH STATUS',
        value: 'ACCEPTED',
        state: 'ok',
        priority: 1
      },
      {
        key: 'SENDER',
        value: 'VERIFIED',
        state: 'ok',
        priority: 1
      },
      {
        key: 'BIRTHDAY ENERGY',
        value: '+100',
        state: 'fun',
        priority: 1
      },
      {
        key: 'SYSTEM STATUS',
        value: 'HAPPY',
        state: 'ok',
        priority: 1
      },
      {
        key: 'TRIP PROTOCOL',
        value: 'MANDATORY',
        state: 'warn',
        priority: 2
      },
      {
        key: 'AGE INCREMENT',
        value: 'APPLIED SILENTLY',
        state: 'warn',
        priority: 2
      },
      {
        key: 'WISH ARCHIVE',
        value: 'PERMANENT ∞',
        state: 'live',
        priority: 3
      }
    ];

    if (ctx.receiveCount > 1) {
      rows.push({
        key: 'DUPLICATE CHECK',
        value:
          `NOT A PROBLEM (×${ctx.receiveCount})`,
        state: 'fun',
        priority: 3
      });
    }

    rows.push({
      key: 'EXIT CODE',
      value: '0 — SUCCESS',
      state: 'ok',
      priority: 3
    });

    return rows;
  }

  function buildReceipt() {
    ctx.receiptId =
      ctx.receiptId ||
      makeReceiptId();

    if (dom.receiptId) {
      dom.receiptId.textContent =
        ctx.receiptId;
    }

    const rows =
      statusRows();

    U.clear(
      dom.statusList
    );

    rows.forEach((row) => {
      const li =
        U.el(
          'li',
          'status__row'
        );

      li.dataset.state =
        row.state;

      li.dataset.priority =
        String(
          row.priority || 2
        );

      li.appendChild(
        U.el(
          'span',
          'status__key',
          row.key
        )
      );

      li.appendChild(
        U.el(
          'span',
          'status__dots',
          ''
        )
      );

      li.appendChild(
        U.el(
          'span',
          'status__val',
          row.value
        )
      );

      dom.statusList.appendChild(
        li
      );
    });
  }

  function runResultSequence() {
    dom.resultStamp.classList.remove(
      'is-in'
    );

    void dom.resultStamp.offsetWidth;

    dom.resultStamp.classList.add(
      'is-in'
    );

    glitch(
      dom.resultTitle,
      3
    );

    const rows =
      U.qsa(
        '.status__row',
        dom.statusList
      );

    rows.forEach(
      (row, i) => {
        setTimeout(() => {
          row.classList.add(
            'is-in'
          );

          if (i % 2 === 0) {
            A.sfx.tick();
          }

          if (
            i ===
            rows.length - 1
          ) {
            setTimeout(() => {
              dom.btnContinue.classList.add(
                'is-ready'
              );

              announce(
                'Wish acknowledged. Press continue for your receipt.'
              );
            }, 320);
          }
        },
        FX.reduced
          ? i * 40
          : 420 + i * 190
        );
      }
    );

    focusSoon(
      dom.btnContinue
    );
  }

  /* ══════════════════════════════════════════════════════════════════════
     9 · SCENE 5 — SIGN-OFF
     ══════════════════════════════════════════════════════════════════════ */

  function goToFinal() {
    setScene('final');

    A.sfx.chime();

    glitch(
      dom.scenes.final.querySelector(
        '.signature__name'
      ),
      2
    );

    setTimeout(() => {
      FX.throwConfetti(
        null,
        {
          count: 90
        }
      );
    }, 260);

    const vrmark =
      dom.scenes.final.querySelector(
        '.vrbrand__mark'
      );

    if (vrmark) {
      const rect =
        vrmark.getBoundingClientRect();

      setTimeout(() => {
        FX.pulse(
          rect.left +
            rect.width / 2,
          rect.top +
            rect.height / 2,
          RGB.magenta,
          0.8
        );
      }, 520);
    }

    showToast(
      'Wish archived permanently. No refunds.'
    );

    focusSoon(
      dom.btnCopy
    );
  }

  /* ══════════════════════════════════════════════════════════════════════
     10 · COPY RECEIPT
     ══════════════════════════════════════════════════════════════════════ */

  function receiptText() {
    const lines = [
      '┌─ WISH ACKNOWLEDGEMENT RECEIPT ─────────────',
      `│ TERMINAL ....... Wish_Acknowledgement.VR`,
      `│ RECEIPT ID ..... ${ctx.receiptId}`,
      `│ SENDER ......... ${ctx.sender}`,
      `│ ACKNOWLEDGED AT  ${new Date().toLocaleString()}`,
      '├────────────────────────────────────────────',
      '│ WISH STATUS .... ACCEPTED',
      '│ SENDER ......... VERIFIED',
      '│ BIRTHDAY ENERGY  +100',
      '│ SYSTEM STATUS .. HAPPY',
      '│ WISH ARCHIVE ... PERMANENT',
      '├────────────────────────────────────────────',
      `│ SIGNED ......... ${CONFIG.signature}`,
      `│ BRAND .......... ${CONFIG.brand}`,
      '└────────────────────────────────────────────'
    ];

    return lines.join('\n');
  }

  async function copyReceipt() {
    const ok =
      await U.copyText(
        receiptText()
      );

    if (ok) {
      A.sfx.ok();

      dom.btnCopy.classList.add(
        'is-ready'
      );

      showToast(
        'Receipt copied to clipboard'
      );
    } else {
      A.sfx.deny();

      showToast(
        'Copy blocked by the browser — long-press to select manually'
      );
    }
  }

  /* ══════════════════════════════════════════════════════════════════════
     11 · REPLAY + RESET
     ══════════════════════════════════════════════════════════════════════ */

  function resetExperience() {
    if (ctx.bootController) {
      ctx.bootController.abort();
    }

    FX.clear();
    A.sfx.ok();

    /* ── Reset state ─────────────────────────────────────────────────── */
    ctx.skipRequested = false;
    ctx.bootComplete = false;

    ctx.friendshipTested = false;

    ctx.acknowledging = false;
    ctx.acknowledged = false;

    ctx.receiptId = '';
    ctx.channel = '';

    /* ── Reset boot DOM ──────────────────────────────────────────────── */
    U.clear(
      dom.bootLog
    );

    setProgress(0);

    dom.bootViewLog.classList.remove(
      'is-done'
    );

    dom.bootViewLog.setAttribute(
      'aria-hidden',
      'false'
    );

    dom.bootViewName.classList.remove(
      'is-active'
    );

    dom.bootViewName.setAttribute(
      'aria-hidden',
      'true'
    );

    dom.bootHint.classList.remove(
      'is-hidden'
    );

    dom.revealName.textContent = '';

    dom.revealName.setAttribute(
      'data-text',
      ''
    );

    dom.revealLine.textContent = '';

    if (dom.bootState) {
      dom.bootState.textContent =
        'COLD START';
    }

    /* ── Reset acknowledgement button ───────────────────────────────── */
    dom.cta.classList.remove(
      'is-charging',
      'is-done',
      'is-ready'
    );

    dom.cta.querySelector(
      '.cta__label'
    ).textContent =
      'ACKNOWLEDGE WISH';

    dom.cta.querySelector(
      '.cta__sub'
    ).innerHTML =
      'Tap to process<span class="kbd-hint"> · or press <kbd>SPACE</kbd></span>';

    /* ── Reset friendship screen ────────────────────────────────────── */
    if (dom.friendshipPanel) {
      dom.friendshipPanel.classList.remove(
        'is-charging'
      );
    }

    if (dom.friendshipReveal) {
      dom.friendshipReveal.hidden =
        true;
    }

    if (dom.btnTestFriendship) {
      dom.btnTestFriendship.classList.remove(
        'is-testing',
        'is-done',
        'is-ready'
      );

      const label =
        dom.btnTestFriendship.querySelector(
          '.cta__label'
        );

      const sub =
        dom.btnTestFriendship.querySelector(
          '.cta__sub'
        );

      if (label) {
        label.textContent =
          'TEST FRIENDSHIP';
      }

      if (sub) {
        sub.textContent =
          'Begin relationship analysis';
      }
    }

    if (dom.btnFriendshipContinue) {
      dom.btnFriendshipContinue.hidden =
        true;

      dom.btnFriendshipContinue.classList.remove(
        'is-ready'
      );
    }

    /* ── Reset receipt ───────────────────────────────────────────────── */
    dom.resultStamp.classList.remove(
      'is-in'
    );

    dom.btnContinue.classList.remove(
      'is-ready'
    );

    U.clear(
      dom.statusList
    );

    /* ── Return to boot ──────────────────────────────────────────────── */
    setScene(
      'boot',
      {
        force: true
      }
    );

    dom.btnSkip.hidden = false;

    requestAnimationFrame(() => {
      setTimeout(
        runBootSequence,
        420
      );
    });
  }

  /* ══════════════════════════════════════════════════════════════════════
     12 · WIRING
     ══════════════════════════════════════════════════════════════════════ */

  function bindEvents() {

    /* ── HUD ─────────────────────────────────────────────────────────── */
    dom.btnSound.addEventListener(
      'click',
      () => {
        const on =
          A.setEnabled(
            !A.isEnabled()
          );

        dom.btnSound.setAttribute(
          'aria-pressed',
          String(on)
        );

        dom.btnSound.title =
          on
            ? 'Sound on — tap to mute'
            : 'Sound off (default)';

        if (on) {
          showToast(
            'Audio online · SFX enabled',
            1600
          );
        }
      }
    );

    dom.btnSkip.addEventListener(
      'click',
      (e) => {
        e.stopPropagation();

        requestSkip();

        showToast(
          'Intro skipped',
          1200
        );
      }
    );

    /* ── Primary flow ────────────────────────────────────────────────── */

    /*
     * IMPORTANT:
     * The old ACKNOWLEDGE WISH button now opens the friendship test.
     */
    dom.cta.addEventListener(
      'click',
      goToFriendship
    );

    dom.cta.addEventListener(
      'pointerenter',
      () => A.sfx.tick()
    );

    /*
     * Friendship test button.
     */
    if (dom.btnTestFriendship) {
      dom.btnTestFriendship.addEventListener(
        'click',
        runFriendshipTest
      );
    }

    /*
     * Friendship reveal → existing acknowledgement.
     */
    if (dom.btnFriendshipContinue) {
      dom.btnFriendshipContinue.addEventListener(
        'click',
        acknowledgeWish
      );
    }

    /* ── Existing result/final actions ───────────────────────────────── */
    dom.btnContinue.addEventListener(
      'click',
      goToFinal
    );

    dom.btnCopy.addEventListener(
      'click',
      copyReceipt
    );

    dom.btnReplayA.addEventListener(
      'click',
      resetExperience
    );

    dom.btnReplayB.addEventListener(
      'click',
      resetExperience
    );

    /* ══════════════════════════════════════════════════════════════════
       KEYBOARD
       ══════════════════════════════════════════════════════════════════ */

    document.addEventListener(
      'keydown',
      (e) => {
        const tag =
          (e.target &&
            e.target.tagName) ||
          '';

        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA'
        ) {
          return;
        }

        if (
          e.key === ' ' ||
          e.key === 'Enter'
        ) {
          const action = {
            boot: () =>
              requestSkip(),

            detect: () =>
              goToFriendship(),

            friendship: () => {
              if (
                !ctx.friendshipTested
              ) {
                runFriendshipTest();
              } else if (
                dom.btnFriendshipContinue &&
                !dom.btnFriendshipContinue.hidden
              ) {
                acknowledgeWish();
              }
            },

            result: () =>
              goToFinal(),

            final: null
          }[ctx.scene];

          if (action) {
            e.preventDefault();
            action();
          }
        }

        if (
          e.key === 'm' ||
          e.key === 'M'
        ) {
          dom.btnSound.click();
        }
      }
    );

    /* ── Tap/click anywhere ─────────────────────────────────────────── */
    document.addEventListener(
      'pointerdown',
      (e) => {
        if (
          !(e.target instanceof Element) ||
          e.target.closest(
            'button, a'
          )
        ) {
          return;
        }

        if (
          ctx.scene === 'boot'
        ) {
          requestSkip();
          return;
        }

        if (
          Math.random() < 0.75
        ) {
          FX.pulse(
            e.clientX,
            e.clientY,
            U.pick([
              RGB.cyan,
              RGB.violet,
              RGB.magenta
            ]),
            0.7
          );
        }
      },
      {
        passive: true
      }
    );

    /* ── Ambient sparkles ────────────────────────────────────────────── */
    if (!FX.reduced) {
      setInterval(() => {
        if (
          document.hidden ||
          FX.lowPower
        ) {
          return;
        }

        if (
          ctx.scene === 'boot'
        ) {
          return;
        }

        FX.pulse(
          U.rand(
            window.innerWidth * 0.1,
            window.innerWidth * 0.9
          ),
          U.rand(
            window.innerHeight * 0.15,
            window.innerHeight * 0.85
          ),
          U.pick([
            RGB.cyan,
            RGB.violet,
            RGB.magenta
          ]),
          0.45
        );
      }, 4200);
    }

    /* ── Reduced motion profile ─────────────────────────────────────── */
    const motionQuery =
      U.reducedMotionQuery();

    if (
      motionQuery &&
      motionQuery.addEventListener
    ) {
      motionQuery.addEventListener(
        'change',
        () => window.location.reload()
      );
    }
  }

  /* ══════════════════════════════════════════════════════════════════════
     13 · BOOTSTRAP
     ══════════════════════════════════════════════════════════════════════ */

  function init() {

    /* Personalization first */
    const sender =
      readSenderFromUrl();

    ctx.sender =
      sender.name;

    ctx.hasNameParam =
      sender.found;

    registerReceive();

    /* Low-power / reduced-motion profile */
    const lowPower =
      U.isLowPowerDevice();

    if (lowPower) {
      document.body.classList.add(
        'is-low-power'
      );
    }

    document.title =
      ctx.hasNameParam
        ? `Wish_Acknowledgement.VR · ${ctx.sender}`
        : 'Wish_Acknowledgement.VR';

    startClock();

    paintName();

    FX.init({
      lowPower
    });

    bindEvents();

    /* Friendly console signature */
    console.log(
      '%cWish_Acknowledgement.VR%c\nBuilt by Volam Rakshith · VR Developments\nSender: ' +
        ctx.sender +
        (
          ctx.hasNameParam
            ? ' (from ?name=)'
            : ' (generic fallback)'
        ),
      'font:700 16px system-ui;color:#27e6ff;text-shadow:0 0 12px #27e6ff',
      'color:#9aa8d0'
    );

    /* Run intro */
    U.whenIdle(
      () => runBootSequence(),
      900
    );
  }

  if (
    document.readyState ===
    'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      init,
      {
        once: true
      }
    );
  } else {
    init();
  }

})();
