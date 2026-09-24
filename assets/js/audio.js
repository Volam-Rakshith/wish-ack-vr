/* ══════════════════════════════════════════════════════════════════════════
   VR.audio — micro sound design, synthesised with the Web Audio API
   --------------------------------------------------------------------------
   · No asset files, no network requests, no libraries.
   · OFF BY DEFAULT. Every method is a no-op until the user enables sound
     with the HUD speaker button (audio also only resumes after a gesture,
     which is what iOS/Safari require).
   ══════════════════════════════════════════════════════════════════════════ */
VR.audio = (function () {
  'use strict';

  let ctx = null;             // AudioContext
  let master = null;          // master gain
  let noiseBuffer = null;     // reused white-noise buffer
  let enabled = false;

  /* ── Graph setup (lazy: only on first user gesture) ──────────────────── */
  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;

    try {
      ctx = new AC();
    } catch (_) {
      return null;
    }

    master = ctx.createGain();
    master.gain.value = 0.85;

    // gentle ceiling so stacking effects never clips
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.ratio.value = 12;

    master.connect(limiter).connect(ctx.destination);
    noiseBuffer = buildNoiseBuffer(ctx, 1.2);
    return ctx;
  }

  function buildNoiseBuffer(ac, seconds) {
    const length = Math.max(1, Math.floor(ac.sampleRate * seconds));
    const buffer = ac.createBuffer(1, length, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function ready() {
    return enabled && !!ensure() && ctx.state !== 'closed';
  }

  /* ── Primitives ──────────────────────────────────────────────────────── */

  /** Single oscillator note with an exponential decay envelope. */
  function tone({ freq = 440, to = null, type = 'sine', dur = 0.14, gain = 0.16, at = 0 }) {
    if (!ready()) return;
    const t0 = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);

    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.012, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(g).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  /** Filtered noise: UI "tick", whoosh, impact body. */
  function noise({ dur = 0.25, gain = 0.16, freq = 900, to = null, q = 1.1, at = 0, type = 'bandpass' }) {
    if (!ready()) return;
    const t0 = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t0);
    if (to) filter.frequency.exponentialRampToValueAtTime(Math.max(60, to), t0 + dur);
    filter.Q.value = q;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    src.connect(filter).connect(g).connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  /** Short stack of notes — used for the success chime. */
  function arpeggio(freqs, { step = 0.075, dur = 0.4, gain = 0.13, type = 'triangle' } = {}) {
    freqs.forEach((f, i) => tone({ freq: f, type, dur, gain: gain / (1 + i * 0.18), at: i * step }));
  }

  /* ── Public sound effects ────────────────────────────────────────────── */
  const sfx = {
    /** soft UI tick for text / hover feedback */
    tick() { tone({ freq: 1500, type: 'square', dur: 0.035, gain: 0.035 }); },

    /** terminal keypress while the boot log types */
    key() { tone({ freq: 2100 + Math.random() * 500, type: 'square', dur: 0.022, gain: 0.022 }); },

    /** line completed */
    ok() { tone({ freq: 1180, to: 1760, type: 'sine', dur: 0.11, gain: 0.07 }); },

    /** incoming-wish alert */
    detect() {
      tone({ freq: 320, to: 900, type: 'sawtooth', dur: 0.32, gain: 0.075 });
      tone({ freq: 640, to: 1500, type: 'sine', dur: 0.3, gain: 0.05, at: 0.06 });
    },

    /** power-charge riser while ACKNOWLEDGE is being processed */
    charge(dur = 0.95) {
      tone({ freq: 90, to: 1500, type: 'sawtooth', dur, gain: 0.09 });
      noise({ dur, gain: 0.05, freq: 220, to: 5200, q: 0.8 });
    },

    /** impact */
    boom() {
      tone({ freq: 150, to: 42, type: 'sine', dur: 0.75, gain: 0.3 });
      noise({ dur: 0.5, gain: 0.13, freq: 1400, to: 120, q: 0.7, type: 'lowpass' });
    },

    /** the win chime */
    chime() {
      arpeggio([523.25, 659.25, 783.99, 1046.5, 1318.5], { step: 0.072, dur: 0.55, gain: 0.15 });
    },

    /** soft sparkle, used by confetti pops */
    sparkle() {
      const f = 1400 + Math.random() * 1400;
      tone({ freq: f, to: f * 1.6, type: 'triangle', dur: 0.1, gain: 0.03 });
    },

    /** negative / system-refusal blip */
    deny() { tone({ freq: 220, to: 120, type: 'square', dur: 0.16, gain: 0.06 }); }
  };

  /* ── Controls ────────────────────────────────────────────────────────── */
  function setEnabled(on) {
    enabled = !!on;
    if (enabled) {
      const ac = ensure();
      if (ac && ac.state === 'suspended') ac.resume();
      sfx.ok();               // confirmation blip the moment sound is switched on
    }
    return enabled;
  }

  const isEnabled = () => enabled;

  /** Suspend while the tab is hidden (saves battery, avoids ghost tails). */
  function handleVisibility() {
    if (!ctx) return;
    if (document.hidden) ctx.suspend?.();
    else if (enabled) ctx.resume?.();
  }
  document.addEventListener('visibilitychange', handleVisibility);

  return { sfx, setEnabled, isEnabled, ready };
})();
