/* ══════════════════════════════════════════════════════════════════════════
   VR.utils — tiny shared helpers
   No dependencies. Everything hangs off the global `VR` namespace.
   ══════════════════════════════════════════════════════════════════════════ */
window.VR = window.VR || {};

VR.utils = (function () {
  'use strict';

  /* ── DOM ─────────────────────────────────────────────────────────────── */
  const qs  = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /** Create an element with classes + text in one call. */
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }

  /* ── Math ────────────────────────────────────────────────────────────── */
  const clamp   = (v, min, max) => (v < min ? min : v > max ? max : v);
  const lerp    = (a, b, t) => a + (b - a) * t;
  const rand    = (min, max) => min + Math.random() * (max - min);
  const randInt = (min, max) => Math.floor(rand(min, max + 1));
  const pick    = (arr) => arr[(Math.random() * arr.length) | 0];
  const TAU     = Math.PI * 2;

  /* ── Timing ──────────────────────────────────────────────────────────── */
  /** Promise-based delay that resolves early (and safely) on abort. */
  function delay(ms, signal) {
    return new Promise((resolve) => {
      if (signal && signal.aborted) return resolve();
      const id = setTimeout(done, ms);
      function done() {
        clearTimeout(id);
        if (signal) signal.removeEventListener('abort', done);
        resolve();
      }
      if (signal) signal.addEventListener('abort', done, { once: true });
    });
  }

  const reducedMotionQuery = () =>
    window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  const prefersReducedMotion = () => !!(reducedMotionQuery() && reducedMotionQuery().matches);

  /** Cheap "this device is probably modest" heuristic. */
  function isLowPowerDevice() {
    if (prefersReducedMotion()) return true;
    const cores = navigator.hardwareConcurrency || 4;
    const mem = navigator.deviceMemory || navigator.deviceMemory === 0 ? navigator.deviceMemory : undefined;
    const smallScreen = Math.min(window.innerWidth, window.innerHeight) < 420;
    const saveData = navigator.connection && navigator.connection.saveData;
    return !!saveData || cores <= 4 || smallScreen || (mem !== undefined && mem <= 4);
  }

  /* ── Text typing ─────────────────────────────────────────────────────── */
  /**
   * Type `text` into `node` character by character.
   * - keeps `data-text` in sync so the CSS glitch layers show the same string
   * - resolves instantly when the user prefers reduced motion, or when
   *   `signal` aborts (used by the "skip intro" affordance)
   */
  async function typeInto(node, text, options = {}) {
    const { speed = 42, jitter = 26, signal, glitch = false } = options;

    const finish = () => {
      node.textContent = text;
      if (glitch) node.setAttribute('data-text', text);
    };

    node.textContent = '';
    if (glitch) node.setAttribute('data-text', '');

    if (prefersReducedMotion() || speed <= 0) {
      finish();
      return;
    }

    for (let i = 0; i < text.length; i++) {
      if (signal && signal.aborted) { finish(); return; }
      node.textContent = text.slice(0, i + 1);
      if (glitch) node.setAttribute('data-text', node.textContent);
      await delay(speed + Math.random() * jitter, signal);
    }
    finish();
  }

  /**
   * Pick a size class so long names never overflow their column.
   * Measures with the real font stack through an offscreen canvas.
   */
  let measureCtx = null;

  /** Inner content width of an element (its own box minus padding). */
  function innerWidth(node) {
    if (!node) return 0;
    const cs = getComputedStyle(node);
    return node.clientWidth - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0);
  }

  function fitName(node, text) {
    const classes = ['name--md', 'name--lg', 'name--xl'];
    classes.forEach((c) => node.classList.remove(c));

    const styles = getComputedStyle(node);
    const parent = node.parentElement;
    const available =
      (parent ? innerWidth(parent) : 0) ||
      innerWidth(node) ||
      window.innerWidth * 0.84;

    if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
    measureCtx.font = `${styles.fontWeight} 100px ${styles.fontFamily}`;

    // px width at a 100px font, scaled to the clamped font-size actually in use
    const fontSize = parseFloat(styles.fontSize) || 48;
    const at100 = measureCtx.measureText(text).width;
    const predicted = (at100 / 100) * fontSize;

    // 6% safety margin: fallback fonts are often wider than the webfont
    const budget = available * 0.94;
    if (predicted <= budget) return;

    const over = predicted / budget;
    if (over < 1.4) node.classList.add('name--md');
    else if (over < 2.2) node.classList.add('name--lg');
    else node.classList.add('name--xl');
  }

  /* ── Misc ────────────────────────────────────────────────────────────── */
  function formatClock(date = new Date()) {
    const p = (n) => String(n).padStart(2, '0');
    return `${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
  }

  /** Copy text to the clipboard with a legacy fallback. Resolves to boolean. */
  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) { /* fall through to legacy path */ }

    try {
      const ta = el('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return !!ok;
    } catch (_) {
      return false;
    }
  }

  /** Fire a callback once the browser is idle (or after a short fallback). */
  function whenIdle(cb, timeout = 1200) {
    if ('requestIdleCallback' in window) window.requestIdleCallback(cb, { timeout });
    else setTimeout(cb, 320);
  }

  return {
    qs, qsa, el, clear,
    clamp, lerp, rand, randInt, pick, TAU,
    delay, reducedMotionQuery, prefersReducedMotion, isLowPowerDevice,
    typeInto, fitName, formatClock, copyText, whenIdle
  };
})();
