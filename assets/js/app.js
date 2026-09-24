/* ══════════════════════════════════════════════════════════════════════════
   VR.app — Wish_Acknowledgement.VR
   --------------------------------------------------------------------------
   Flow:
   boot → sender identified → wish detected
   → ACKNOWLEDGE WISH charging animation
   → FRIENDSHIP TEST
   → FRIENDSHIP RESULT
   → receipt
   → sign-off
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const U = VR.utils;
  const A = VR.audio;
  const FX = VR.fx;

  /* ── Extra friendship-stage styling ──────────────────────────────────── */
  const friendshipStyle = document.createElement('style');

  friendshipStyle.textContent = `
    .scene--friendship {
      --scene-col: 620px;
    }

    .scene--friendship-reveal {
      --scene-col: 680px;
    }

    .panel--friendship,
    .panel--friendship-reveal {
      position: relative;
      overflow: hidden;
    }

    .panel--friendship {
      display: grid;
      gap: clamp(14px, 2vh, 22px);
      padding: clamp(18px, 4vw, 30px);
      border: 1px solid var(--line);
      border-radius: var(--r-xl);
      background: var(--glass);
      box-shadow:
        0 0 0 1px rgba(255,255,255,.03) inset,
        0 40px 120px -60px rgba(39,230,255,.55),
        0 30px 90px -50px rgba(0,0,0,.9);
      backdrop-filter: blur(14px) saturate(130%);
      -webkit-backdrop-filter: blur(14px) saturate(130%);
    }

    .friendship__pill {
      width: fit-content;
      justify-self: center;
    }

    .friendship__title {
      text-align: center;
      font-family: var(--font-display);
      font-size: clamp(1.15rem, 3.5vw, 1.8rem);
      line-height: 1.15;
      letter-spacing: .06em;
      color: var(--c-ink);
      text-shadow:
        0 0 18px rgba(39,230,255,.22);
      animation: friendship-title-pulse 2.2s ease-in-out infinite;
    }

    @keyframes friendship-title-pulse {
      0%,100% {
        opacity: .78;
        text-shadow: 0 0 12px rgba(39,230,255,.15);
      }
      50% {
        opacity: 1;
        text-shadow:
          0 0 24px rgba(39,230,255,.45),
          0 0 42px rgba(124,92,255,.18);
      }
    }

    .friendship__scanline {
      position: absolute;
      left: 0;
      right: 0;
      top: 0;
      height: 2px;
      background: linear-gradient(
        90deg,
        transparent,
        var(--c-cyan),
        var(--c-magenta),
        transparent
      );
      box-shadow:
        0 0 16px rgba(39,230,255,.8),
        0 0 30px rgba(255,47,208,.35);
      opacity: .8;
      animation: friendship-scan 2.8s linear infinite;
      pointer-events: none;
    }

    @keyframes friendship-scan {
      0% {
        transform: translateY(-10px);
        opacity: 0;
      }
      12% {
        opacity: 1;
      }
      88% {
        opacity: 1;
      }
      100% {
        transform: translateY(560px);
        opacity: 0;
      }
    }

    .friendship__stats {
      display: grid;
      gap: 13px;
    }

    .friendship__stat {
      display: grid;
      gap: 7px;
      opacity: 0;
      transform: translateX(-14px);
    }

    .friendship__stat.is-visible {
      animation: friendship-stat-in 520ms var(--ease) forwards;
    }

    @keyframes friendship-stat-in {
      to {
        opacity: 1;
        transform: none;
      }
    }

    .friendship__stat-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      color: var(--c-dim);
      font-size: clamp(10px, .5vw + 9px, 13px);
      letter-spacing: .08em;
      text-transform: uppercase;
    }

    .friendship__stat-head strong {
      min-width: 4ch;
      text-align: right;
      color: var(--c-cyan);
      font-variant-numeric: tabular-nums;
      text-shadow: 0 0 12px rgba(39,230,255,.45);
    }

    .friendship__bar {
      position: relative;
      height: 9px;
      overflow: hidden;
      border: 1px solid rgba(126,170,255,.18);
      border-radius: 999px;
      background: rgba(4,5,18,.82);
      box-shadow:
        inset 0 0 14px rgba(39,230,255,.07);
    }

    .friendship__fill {
      display: block;
      width: 0%;
      height: 100%;
      border-radius: inherit;
      background:
        linear-gradient(
          90deg,
          var(--c-cyan),
          var(--c-violet) 55%,
          var(--c-magenta)
        );
      box-shadow:
        0 0 12px rgba(39,230,255,.6),
        0 0 22px rgba(124,92,255,.28);
      transform-origin: left center;
      transition: width 70ms linear;
      position: relative;
    }

    .friendship__fill::after {
      content: "";
      position: absolute;
      inset: 0;
      background:
        linear-gradient(
          90deg,
          transparent,
          rgba(255,255,255,.8),
          transparent
        );
      transform: translateX(-100%);
      animation: friendship-fill-glint 1.15s linear infinite;
    }

    @keyframes friendship-fill-glint {
      to {
        transform: translateX(100%);
      }
    }

    .friendship__strength {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 13px 14px;
      border: 1px solid var(--line-soft);
      border-radius: var(--r-md);
      background: rgba(5,7,22,.55);
      box-shadow: inset 0 0 28px rgba(39,230,255,.035);
      font-size: clamp(10px, .5vw + 9px, 12px);
      letter-spacing: .1em;
      text-transform: uppercase;
    }

    .friendship__strength span {
      color: var(--c-dim-2);
    }

    .friendship__strength strong {
      color: var(--c-amber);
      text-align: right;
      transition:
        color 350ms ease,
        text-shadow 350ms ease,
        transform 350ms var(--ease);
    }

    .friendship__strength.is-tested strong {
      color: var(--c-green);
      text-shadow:
        0 0 14px rgba(77,240,176,.5);
      transform: scale(1.04);
    }

    .friendship__status {
      text-align: center;
      color: var(--c-dim-2);
      font-size: 10px;
      letter-spacing: .13em;
      text-transform: uppercase;
      min-height: 1.4em;
    }

    .friendship__status.is-scanning {
      color: var(--c-cyan);
      animation: friendship-status-pulse 800ms ease-in-out infinite;
    }

    @keyframes friendship-status-pulse {
      50% {
        opacity: .35;
      }
    }

    .friendship__status.is-complete {
      color: var(--c-green);
      text-shadow: 0 0 12px rgba(77,240,176,.4);
    }

    .friendship__actions {
      margin-top: 2px;
    }

    #btn-test-friendship.is-scanning {
      pointer-events: none;
      filter: saturate(1.3);
    }

    #btn-test-friendship.is-scanning .btn__label::after {
      content: "";
      display: inline-block;
      width: .75em;
      height: .75em;
      margin-left: .65em;
      border: 2px solid currentColor;
      border-right-color: transparent;
      border-radius: 50%;
      vertical-align: -.08em;
      animation: friendship-spinner 650ms linear infinite;
    }

    @keyframes friendship-spinner {
      to {
        transform: rotate(360deg);
      }
    }

    .panel--friendship-reveal {
      display: grid;
      justify-items: center;
      align-content: center;
      gap: clamp(14px, 2.4vh, 24px);
      min-height: min(560px, 72vh);
      padding: clamp(26px, 5vw, 48px);
      border: 1px solid rgba(124,92,255,.25);
      border-radius: var(--r-xl);
      background:
        radial-gradient(
          circle at 50% 45%,
          rgba(124,92,255,.12),
          transparent 58%
        ),
        var(--glass);
      box-shadow:
        0 0 0 1px rgba(255,255,255,.03) inset,
        0 40px 130px -60px rgba(255,47,208,.45),
        0 30px 90px -50px rgba(0,0,0,.9);
      backdrop-filter: blur(16px) saturate(135%);
      -webkit-backdrop-filter: blur(16px) saturate(135%);
    }

    .friendship-reveal__scan {
      position: absolute;
      inset: 0;
      pointer-events: none;
      background:
        repeating-linear-gradient(
          to bottom,
          transparent 0 7px,
          rgba(39,230,255,.035) 8px,
          transparent 9px
        );
      opacity: .55;
      animation: reveal-scan 5s linear infinite;
    }

    @keyframes reveal-scan {
      from {
        transform: translateY(-18px);
      }
      to {
        transform: translateY(18px);
      }
    }

    .friendship-reveal__terminal {
      width: 100%;
      display: flex;
      justify-content: space-between;
      gap: 14px;
      color: var(--c-dim-2);
      font-size: 9px;
      letter-spacing: .16em;
      text-transform: uppercase;
      border-bottom: 1px solid var(--line-soft);
      padding-bottom: 12px;
    }

    .friendship-reveal__title,
    .friendship-reveal__joke,
    .friendship-reveal__final {
      position: relative;
      z-index: 1;
      text-align: center;
      opacity: 0;
      transform: translateY(14px) scale(.96);
    }

    .friendship-reveal__title {
      font-family: var(--font-display);
      font-size: clamp(1.6rem, 6vw, 3rem);
      line-height: 1;
      letter-spacing: .02em;
      color: var(--c-ink);
    }

    .friendship-reveal__joke {
      color: var(--c-cyan-soft);
      font-size: clamp(1rem, 2.8vw, 1.35rem);
      letter-spacing: .06em;
    }

    .friendship-reveal__final {
      font-family: var(--font-display);
      font-weight: 700;
      font-size: clamp(1.35rem, 4.4vw, 2.25rem);
      line-height: 1.12;
      background:
        linear-gradient(
          100deg,
          #fff,
          var(--c-cyan-soft),
          #b9a9ff,
          #ff8ad4,
          #fff
        );
      background-size: 220% 100%;
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      -webkit-text-fill-color: transparent;
      animation: friendship-final-sheen 4s linear infinite;
    }

    @keyframes friendship-final-sheen {
      from {
        background-position: 0% 50%;
      }
      to {
        background-position: 220% 50%;
      }
    }

    .friendship-reveal__title.is-visible {
      animation: reveal-title-in 650ms var(--ease) forwards;
    }

    .friendship-reveal__joke.is-visible {
      animation: reveal-title-in 650ms var(--ease) 260ms forwards;
    }

    .friendship-reveal__final.is-visible {
      animation:
        reveal-final-in 800ms var(--ease) 560ms forwards,
        friendship-final-glow 1.8s ease-in-out 1.35s infinite;
    }

    @keyframes reveal-title-in {
      0% {
        opacity: 0;
        transform: translateY(18px) scale(.94);
        filter: blur(7px);
      }
      100% {
        opacity: 1;
        transform: none;
        filter: none;
      }
    }

    @keyframes reveal-final-in {
      0% {
        opacity: 0;
        transform: translateY(22px) scale(.88);
        filter: blur(10px);
      }
      70% {
        opacity: 1;
        transform: translateY(-3px) scale(1.025);
      }
      100% {
        opacity: 1;
        transform: none;
        filter: none;
      }
    }

    @keyframes friendship-final-glow {
      0%,100% {
        filter: drop-shadow(0 0 8px rgba(39,230,255,.15));
      }
      50% {
        filter:
          drop-shadow(0 0 20px rgba(39,230,255,.4))
          drop-shadow(0 0 32px rgba(255,47,208,.18));
      }
    }

    .friendship-reveal__pulse {
      position: relative;
      z-index: 1;
      width: 90px;
      height: 90px;
      display: grid;
      place-items: center;
    }

    .friendship-reveal__pulse span {
      position: absolute;
      width: 12px;
      height: 12px;
      border: 1px solid var(--c-cyan);
      border-radius: 50%;
      opacity: 0;
      animation: friendship-pulse 2.2s ease-out infinite;
    }

    .friendship-reveal__pulse span:nth-child(2) {
      animation-delay: .7s;
    }

    .friendship-reveal__pulse span:nth-child(3) {
      animation-delay: 1.4s;
    }

    @keyframes friendship-pulse {
      0% {
        width: 10px;
        height: 10px;
        opacity: .75;
        box-shadow: 0 0 12px rgba(39,230,255,.7);
      }
      100% {
        width: 86px;
        height: 86px;
        opacity: 0;
        box-shadow: 0 0 30px rgba(255,47,208,0);
      }
    }

    .friendship-reveal__actions {
      position: relative;
      z-index: 2;
      opacity: 0;
      transform: translateY(12px);
      transition:
        opacity 500ms var(--ease),
        transform 500ms var(--ease);
    }

    .friendship-reveal__actions.is-ready {
      opacity: 1;
      transform: none;
    }

    @media (max-width: 560px) {
      .friendship__strength {
        align-items: flex-start;
        flex-direction: column;
      }

      .friendship__strength strong {
        text-align: left;
      }

      .friendship-reveal__terminal {
        flex-direction: column;
        text-align: center;
      }

      .panel--friendship-reveal {
        min-height: 500px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .friendship__title,
      .friendship__scanline,
      .friendship__fill::after,
      .friendship-reveal__scan,
      .friendship-reveal__final,
      .friendship-reveal__pulse span {
        animation: none !important;
      }

      .friendship-reveal__title,
      .friendship-reveal__joke,
      .friendship-reveal__final {
        opacity: 1;
        transform: none;
        filter: none;
      }
    }
  `;

  document.head.appendChild(friendshipStyle);


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
      boot: document.getElementById('scene-boot'),
      detect: document.getElementById('scene-detect'),
      friendship: document.getElementById('scene-friendship'),
      friendshipReveal: document.getElementById('scene-friendship-reveal'),
      result: document.getElementById('scene-result'),
      final: document.getElementById('scene-final')
    },

    bootLog: document.getElementById('boot-log'),
    bootBar: document.getElementById('boot-bar'),
    bootPct: document.getElementById('boot-pct'),
    bootState: document.getElementById('boot-state'),
    bootHint: document.getElementById('boot-hint'),
    bootViewLog: document.getElementById('boot-view-log'),
    bootViewName: document.getElementById('boot-view-name'),
    revealName: document.getElementById('reveal-name'),
    revealLine: document.getElementById('reveal-line'),

    wishPanel: document.getElementById('wish-panel'),
    wishReadout: document.getElementById('wish-readout'),
    cta: document.getElementById('btn-acknowledge'),

    friendshipPanel: document.getElementById('friendship-panel'),
    friendshipStats: document.querySelectorAll('.friendship__stat'),
    friendshipStrength: document.getElementById('friendship-strength'),
    friendshipStatus: document.getElementById('friendship-status'),
    btnTestFriendship: document.getElementById('btn-test-friendship'),

    friendshipReveal: document.getElementById('friendship-reveal'),
    friendshipRevealTitle: document.querySelector('.friendship-reveal__title'),
    friendshipRevealJoke: document.querySelector('.friendship-reveal__joke'),
    friendshipRevealFinal: document.querySelector('.friendship-reveal__final'),
    friendshipRevealActions: document.querySelector('.friendship-reveal__actions'),
    btnFriendshipContinue: document.getElementById('btn-friendship-continue'),

    statusList: document.getElementById('status-list'),
    resultTitle: document.getElementById('result-title'),
    resultStamp: document.getElementById('result-stamp'),
    receiptId: document.getElementById('receipt-id'),

    btnSkip: document.getElementById('btn-skip'),
    btnSound: document.getElementById('btn-sound'),
    btnContinue: document.getElementById('btn-continue'),
    btnCopy: document.getElementById('btn-copy'),
    btnReplayA: document.getElementById('btn-replay-a'),
    btnReplayB: document.getElementById('btn-replay-b'),

    hudClock: document.getElementById('hud-clock'),
    hudCountdown: document.getElementById('hud-countdown'),
    hudYear: document.getElementById('hud-year'),
    finalClock: document.getElementById('final-clock'),

    toast: document.getElementById('toast'),
    toastText: document.getElementById('toast-text'),
    srStatus: document.getElementById('sr-status')
  };


  /* ── Application state ───────────────────────────────────────────────── */
  const ctx = {
    sender: CONFIG.fallbackName,
    hasNameParam: false,
    scene: 'boot',

    bootController: null,
    skipRequested: false,
    bootComplete: false,

    acknowledging: false,
    acknowledged: false,

    friendshipTesting: false,
    friendshipTested: false,

    receiptId: '',
    channel: '',
    receiveCount: 1,

    toastTimer: 0,
    friendshipTimers: []
  };


  /* ══════════════════════════════════════════════════════════════════════
     1 · URL PERSONALIZATION
     ══════════════════════════════════════════════════════════════════════ */

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

    requestAnimationFrame(() =>
      dom.toast.classList.add('is-visible')
    );

    clearTimeout(ctx.toastTimer);

    ctx.toastTimer = setTimeout(() => {
      dom.toast.classList.remove('is-visible');

      setTimeout(() => {
        dom.toast.hidden = true;
      }, 320);
    }, duration);
  }


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

      if (!scene || scene === next) {
        return;
      }

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

      detect:
        `Birthday wish detected from ${ctx.sender}`,

      friendship:
        'Friendship relationship analysis',

      'friendship-reveal':
        'Friendship test result',

      result:
        'Wish acknowledged',

      final:
        'Acknowledgement complete'
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
      node.focus({
        preventScroll: true
      });
    }, 420);
  }


  const titleCase = (str) =>
    str.toUpperCase();


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
    const value = U.clamp(
      percent,
      0,
      100
    );

    if (dom.bootBar) {
      dom.bootBar.style.width =
        `${value}%`;
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
    const row =
      U.el('li', 'log__line');

    row.appendChild(
      U.el('span', 'log__glyph', '▸')
    );

    const text =
      U.el('span', 'log__text');

    row.appendChild(text);

    const chip =
      U.el('span', 'log__chip', '…');

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
      const row =
        U.el('li', 'log__line');

      row.style.animationDuration =
        '1ms';

      row.appendChild(
        U.el('span', 'log__glyph', '▸')
      );

      row.appendChild(
        U.el(
          'span',
          'log__text',
          line.text
        )
      );

      const chip =
        U.el(
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

      keyTicker =
        setInterval(
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
        !ctx.hasNameParam
          ? 'Generic sender profile loaded. No name tag detected — the wish still counts.'
          : ctx.receiveCount > 1
            ? `Welcome back. This is wish #${ctx.receiveCount} from you. The system is keeping count.`
            : 'Identity confirmed. Preparing acknowledgement interface…';

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
      ctx.skipRequested
        ? 200
        : 560
    );

    goToDetect();
  }


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
     5 · WISH DETECTED
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

    U.clear(
      dom.wishReadout
    );

    items.forEach(
      (item, i) => {
        const row =
          U.el(
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
      }
    );
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
     6 · ACKNOWLEDGE WISH
     IMPORTANT: ORIGINAL CHARGING ANIMATION PRESERVED
     ══════════════════════════════════════════════════════════════════════ */

  function animateCharge(
    node,
    duration
  ) {
    return new Promise(
      (resolve) => {

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
              (now - start) / duration,
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
            requestAnimationFrame(frame);
          } else {
            resolve();
          }
        };

        requestAnimationFrame(frame);
      }
    );
  }


  async function acknowledgeWish() {
    if (
      ctx.acknowledging ||
      ctx.acknowledged
    ) {
      return;
    }

    ctx.acknowledging = true;

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

    /* ORIGINAL CHARGING ANIMATION */
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
            clearInterval(gather);
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

    /*
      IMPORTANT:
      Do NOT jump directly to receipt.
      The new friendship sequence starts here.
    */
    goToFriendship();
  }


  /* ══════════════════════════════════════════════════════════════════════
     7 · FRIENDSHIP TEST
     ══════════════════════════════════════════════════════════════════════ */

  function clearFriendshipTimers() {
    ctx.friendshipTimers.forEach(
      (timer) => clearTimeout(timer)
    );

    ctx.friendshipTimers = [];
  }


  function resetFriendshipVisuals() {
    clearFriendshipTimers();

    if (dom.friendshipStats) {
      dom.friendshipStats.forEach(
        (stat) => {
          stat.classList.remove(
            'is-visible'
          );

          const fill =
            stat.querySelector(
              '.friendship__fill'
            );

          const value =
            stat.querySelector(
              '.friendship__value'
            );

          if (fill) {
            fill.style.width = '0%';
          }

          if (value) {
            value.textContent = '0%';
          }
        }
      );
    }

    if (dom.friendshipStrength) {
      dom.friendshipStrength.textContent =
        'NOT TESTED YET';

      const box =
        dom.friendshipStrength.closest(
          '.friendship__strength'
        );

      if (box) {
        box.classList.remove(
          'is-tested'
        );
      }
    }

    if (dom.friendshipStatus) {
      dom.friendshipStatus.textContent =
        'SYSTEM READY · WAITING FOR TEST';

      dom.friendshipStatus.classList.remove(
        'is-scanning',
        'is-complete'
      );
    }

    if (dom.btnTestFriendship) {
      dom.btnTestFriendship.classList.remove(
        'is-scanning'
      );

      dom.btnTestFriendship.disabled =
        false;

      const label =
        dom.btnTestFriendship.querySelector(
          '.btn__label'
        );

      if (label) {
        label.textContent =
          'TEST FRIENDSHIP';
      }
    }
  }


  function goToFriendship() {
    resetFriendshipVisuals();

    setScene(
      'friendship'
    );

    A.sfx.chime();

    if (dom.friendshipPanel) {
      const rect =
        dom.friendshipPanel.getBoundingClientRect();

      FX.pulse(
        rect.left + rect.width / 2,
        rect.top + rect.height * .3,
        RGB.violet,
        1
      );

      glitch(
        dom.friendshipPanel,
        2
      );
    }

    if (dom.friendshipStats) {
      dom.friendshipStats.forEach(
        (stat, index) => {
          const timer =
            setTimeout(() => {
              stat.classList.add(
                'is-visible'
              );
            }, 180 + index * 130);

          ctx.friendshipTimers.push(
            timer
          );
        }
      );
    }

    const readyTimer =
      setTimeout(() => {
        focusSoon(
          dom.btnTestFriendship
        );
      }, 700);

    ctx.friendshipTimers.push(
      readyTimer
    );

    announce(
      'Friendship analysis ready. Press TEST FRIENDSHIP to begin.'
    );
  }


  function animateFriendshipScore(
    stat,
    target,
    duration
  ) {
    return new Promise(
      (resolve) => {

        const fill =
          stat.querySelector(
            '.friendship__fill'
          );

        const value =
          stat.querySelector(
            '.friendship__value'
          );

        if (!fill || !value) {
          resolve();
          return;
        }

        if (FX.reduced) {
          fill.style.width =
            `${target}%`;

          value.textContent =
            `${target}%`;

          resolve();
          return;
        }

        const start =
          performance.now();

        const frame = (now) => {
          const t =
            U.clamp(
              (now - start) / duration,
              0,
              1
            );

          const eased =
            t * t * (3 - 2 * t);

          const current =
            Math.round(
              eased * target
            );

          fill.style.width =
            `${current}%`;

          value.textContent =
            `${current}%`;

          if (t < 1) {
            requestAnimationFrame(frame);
          } else {
            resolve();
          }
        };

        requestAnimationFrame(
          frame
        );
      }
    );
  }


  async function testFriendship() {
    if (
      ctx.friendshipTesting ||
      ctx.friendshipTested
    ) {
      return;
    }

    ctx.friendshipTesting = true;

    if (dom.btnTestFriendship) {
      dom.btnTestFriendship.disabled =
        true;

      dom.btnTestFriendship.classList.add(
        'is-scanning'
      );

      const label =
        dom.btnTestFriendship.querySelector(
          '.btn__label'
        );

      if (label) {
        label.textContent =
          'SCANNING…';
      }
    }

    if (dom.friendshipStatus) {
      dom.friendshipStatus.textContent =
        'SCANNING RELATIONSHIP DATA · PLEASE WAIT';

      dom.friendshipStatus.classList.add(
        'is-scanning'
      );
    }

    announce(
      'Scanning relationship data.'
    );

    A.sfx.charge(1.2);

    haptic([
      12,
      50,
      12,
      50,
      20
    ]);

    if (
      dom.friendshipPanel &&
      !FX.reduced
    ) {
      const rect =
        dom.friendshipPanel.getBoundingClientRect();

      FX.pulse(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
        RGB.cyan,
        1.2
      );

      let pulses = 0;

      const scanPulse =
        setInterval(() => {

          FX.implode(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
            {
              count: 16,
              radius: 260,
              speed: 7
            }
          );

          pulses++;

          if (pulses >= 6) {
            clearInterval(
              scanPulse
            );
          }

        }, 170);

      ctx.friendshipTimers.push(
        scanPulse
      );
    }

    const stats =
      Array.from(
        dom.friendshipStats || []
      );

    for (const stat of stats) {
      const target =
        Number(
          stat.dataset.score || 0
        );

      await animateFriendshipScore(
        stat,
        target,
        FX.reduced ? 150 : 850
      );

      A.sfx.tick();

      if (!FX.reduced) {
        const rect =
          stat.getBoundingClientRect();

        FX.pulse(
          rect.right - 35,
          rect.top + rect.height / 2,
          RGB.cyan,
          .35
        );
      }

      await U.delay(
        FX.reduced
          ? 40
          : 130
      );
    }

    await U.delay(
      FX.reduced
        ? 100
        : 400
    );

    if (dom.friendshipStatus) {
      dom.friendshipStatus.textContent =
        'ANALYSIS COMPLETE · RELATIONSHIP DATA VERIFIED';

      dom.friendshipStatus.classList.remove(
        'is-scanning'
      );

      dom.friendshipStatus.classList.add(
        'is-complete'
      );
    }

    if (dom.friendshipStrength) {
      dom.friendshipStrength.textContent =
        'TEST COMPLETE';

      const box =
        dom.friendshipStrength.closest(
          '.friendship__strength'
        );

      if (box) {
        box.classList.add(
          'is-tested'
        );
      }
    }

    ctx.friendshipTested = true;
    ctx.friendshipTesting = false;

    if (dom.btnTestFriendship) {
      dom.btnTestFriendship.classList.remove(
        'is-scanning'
      );

      dom.btnTestFriendship.disabled =
        true;

      const label =
        dom.btnTestFriendship.querySelector(
          '.btn__label'
        );

      if (label) {
        label.textContent =
          'TEST COMPLETE ✓';
      }
    }

    A.sfx.boom();

    haptic([
      25,
      45,
      90
    ]);

    if (dom.friendshipPanel) {
      const rect =
        dom.friendshipPanel.getBoundingClientRect();

      FX.celebrate(
        rect.left + rect.width / 2,
        rect.top + rect.height * .45
      );

      glitch(
        dom.friendshipPanel,
        2
      );
    }

    announce(
      'Friendship analysis complete.'
    );

    /*
      The user specifically wanted the results on the NEXT stage.
      We therefore do NOT reveal the best-friends message here.
    */

    const nextButtonTimer =
      setTimeout(() => {
        goToFriendshipReveal();
      }, FX.reduced ? 500 : 1100);

    ctx.friendshipTimers.push(
      nextButtonTimer
    );
  }


  /* ══════════════════════════════════════════════════════════════════════
     8 · FRIENDSHIP RESULT / REVEAL
     ══════════════════════════════════════════════════════════════════════ */

  function resetFriendshipReveal() {
    if (dom.friendshipRevealTitle) {
      dom.friendshipRevealTitle.classList.remove(
        'is-visible'
      );
    }

    if (dom.friendshipRevealJoke) {
      dom.friendshipRevealJoke.classList.remove(
        'is-visible'
      );
    }

    if (dom.friendshipRevealFinal) {
      dom.friendshipRevealFinal.classList.remove(
        'is-visible'
      );
    }

    if (dom.friendshipRevealActions) {
      dom.friendshipRevealActions.classList.remove(
        'is-ready'
      );
    }
  }


  function goToFriendshipReveal() {
    clearFriendshipTimers();

    resetFriendshipReveal();

    setScene(
      'friendship-reveal'
    );

    A.sfx.chime();

    if (dom.friendshipReveal) {
      const rect =
        dom.friendshipReveal.getBoundingClientRect();

      FX.burst(
        rect.left + rect.width / 2,
        rect.top + rect.height * .48,
        {
          count: 44,
          speed: 8,
          ringCount: 2,
          glowCount: 12
        }
      );
    }

    if (dom.friendshipRevealTitle) {
      setTimeout(() => {
        dom.friendshipRevealTitle.classList.add(
          'is-visible'
        );

        A.sfx.tick();
      }, 180);
    }

    if (dom.friendshipRevealJoke) {
      setTimeout(() => {
        dom.friendshipRevealJoke.classList.add(
          'is-visible'
        );

        A.sfx.tick();
      }, FX.reduced ? 100 : 500);
    }

    if (dom.friendshipRevealFinal) {
      setTimeout(() => {
        dom.friendshipRevealFinal.classList.add(
          'is-visible'
        );

        A.sfx.boom();

        haptic([
          20,
          40,
          80
        ]);

        if (!FX.reduced) {
          const rect =
            dom.friendshipRevealFinal.getBoundingClientRect();

          FX.celebrate(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2
          );
        }
      }, FX.reduced ? 180 : 820);
    }

    const readyTimer =
      setTimeout(() => {

        if (dom.friendshipRevealActions) {
          dom.friendshipRevealActions.classList.add(
            'is-ready'
          );
        }

        focusSoon(
          dom.btnFriendshipContinue
        );

      }, FX.reduced ? 500 : 1600);

    ctx.friendshipTimers.push(
      readyTimer
    );

    announce(
      'Friendship test result: We are best friends.'
    );
  }


  function continueAfterFriendship() {
    if (!ctx.friendshipTested) {
      return;
    }

    buildReceipt();

    setScene(
      'result'
    );

    A.sfx.chime();

    runResultSequence();
  }


  /* ══════════════════════════════════════════════════════════════════════
     9 · RECEIPT
     ══════════════════════════════════════════════════════════════════════ */

  function makeReceiptId() {
    const now = new Date();

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
          : 420 + i * 190);

      }
    );

    focusSoon(
      dom.btnContinue
    );
  }


  /* ══════════════════════════════════════════════════════════════════════
     10 · FINAL / SIGN-OFF
     ══════════════════════════════════════════════════════════════════════ */

  function goToFinal() {
    setScene(
      'final'
    );

    A.sfx.chime();

    glitch(
      dom.scenes.final.querySelector(
        '.signature__name'
      ),
      2
    );

    setTimeout(
      () =>
        FX.throwConfetti(
          null,
          {
            count: 90
          }
        ),
      260
    );

    const vrmark =
      dom.scenes.final.querySelector(
        '.vrbrand__mark'
      );

    if (vrmark) {
      const rect =
        vrmark.getBoundingClientRect();

      setTimeout(
        () =>
          FX.pulse(
            rect.left +
              rect.width / 2,
            rect.top +
              rect.height / 2,
            RGB.magenta,
            0.8
          ),
        520
      );
    }

    showToast(
      'Wish archived permanently. No refunds.'
    );

    focusSoon(
      dom.btnCopy
    );
  }


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

    clearFriendshipTimers();

    FX.clear();

    A.sfx.ok();

    ctx.skipRequested = false;
    ctx.bootComplete = false;
    ctx.acknowledging = false;
    ctx.acknowledged = false;

    ctx.friendshipTesting = false;
    ctx.friendshipTested = false;

    ctx.receiptId = '';
    ctx.channel = '';

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

    dom.revealName.textContent =
      '';

    dom.revealName.setAttribute(
      'data-text',
      ''
    );

    dom.revealLine.textContent =
      '';

    if (dom.bootState) {
      dom.bootState.textContent =
        'COLD START';
    }

    dom.cta.classList.remove(
      'is-charging',
      'is-done',
      'is-ready'
    );

    dom.cta.style.setProperty(
      '--charge',
      '0%'
    );

    dom.cta.querySelector(
      '.cta__label'
    ).textContent =
      'ACKNOWLEDGE WISH';

    dom.cta.querySelector(
      '.cta__sub'
    ).innerHTML =
      'Tap to process<span class="kbd-hint"> · or press <kbd>SPACE</kbd></span>';

    dom.resultStamp.classList.remove(
      'is-in'
    );

    dom.btnContinue.classList.remove(
      'is-ready'
    );

    U.clear(
      dom.statusList
    );

    resetFriendshipVisuals();
    resetFriendshipReveal();

    setScene(
      'boot',
      {
        force: true
      }
    );

    dom.btnSkip.hidden =
      false;

    requestAnimationFrame(
      () =>
        setTimeout(
          runBootSequence,
          420
        )
    );
  }


  /* ══════════════════════════════════════════════════════════════════════
     12 · WIRING
     ══════════════════════════════════════════════════════════════════════ */

  function bindEvents() {

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


    dom.cta.addEventListener(
      'click',
      acknowledgeWish
    );


    dom.cta.addEventListener(
      'pointerenter',
      () => A.sfx.tick()
    );


    dom.btnTestFriendship.addEventListener(
      'click',
      testFriendship
    );


    dom.btnFriendshipContinue.addEventListener(
      'click',
      continueAfterFriendship
    );


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


    /* Keyboard */
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
              acknowledgeWish(),

            friendship: () =>
              testFriendship(),

            'friendship-reveal': () =>
              continueAfterFriendship(),

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


    /* Tap/click anywhere */
    document.addEventListener(
      'pointerdown',
      (e) => {

        if (
          !(e.target instanceof Element) ||
          e.target.closest('button, a')
        ) {
          return;
        }

        if (ctx.scene === 'boot') {
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


    /* Ambient sparkles */
    if (!FX.reduced) {

      setInterval(
        () => {

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
              window.innerWidth * .1,
              window.innerWidth * .9
            ),

            U.rand(
              window.innerHeight * .15,
              window.innerHeight * .85
            ),

            U.pick([
              RGB.cyan,
              RGB.violet,
              RGB.magenta
            ]),

            0.45
          );

        },
        4200
      );
    }


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

    const sender =
      readSenderFromUrl();

    ctx.sender =
      sender.name;

    ctx.hasNameParam =
      sender.found;

    registerReceive();

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
