/* ─────────────────────────────────────────────────────────────────────────
   WCAG contrast check for the site palette (development helper).
   axe-core marks most text here as "incomplete" because it sits over
   gradients and canvas, so the palette is verified numerically instead.

     node tools/contrast-check.js

   Nothing here ships to GitHub Pages — you can delete the tools/ folder.
   ───────────────────────────────────────────────────────────────────────── */
/* WCAG contrast verification for the Wish_Acknowledgement.VR palette.
   axe-core reports "incomplete" for this design because most text sits over
   gradients/canvas, so we verify the palette mathematically instead. */
const PAIRS = [
  // [label, foreground, background]
  ['body text        (--c-ink)      on page',  '#eaf2ff', '#060418'],
  ['body text        (--c-ink)      on glass', '#eaf2ff', '#12162f'],
  ['labels           (--c-dim)      on page',  '#9aa8d0', '#060418'],
  ['labels           (--c-dim)      on glass', '#9aa8d0', '#12162f'],
  ['HUD / meta       (--c-dim-2)    on page',  '#7f8cba', '#060418'],
  ['HUD / meta       (--c-dim-2)    on glass', '#7f8cba', '#12162f'],
  ['status accepted  (--c-green)    on glass', '#4df0b0', '#12162f'],
  ['status energy    (--c-pink)     on glass', '#ff6bb5', '#12162f'],
  ['status amber     (--c-amber)    on glass', '#ffcb6b', '#12162f'],
  ['status trip ok   (--c-green)    on glass', '#4df0b0', '#12162f'],
  ['status live      (--c-cyan)     on glass', '#27e6ff', '#12162f'],
  ['pill text        (#7ff3ff)      on glass', '#7ff3ff', '#12162f'],
  ['cta label        (#ffffff)      on cta bg', '#ffffff', '#1b2350'],
  ['cta sub          (rgba .68 ink) on cta bg', '#a8b4cc', '#1b2350'],
  ['button (--c-dim)                on glass', '#9aa8d0', '#12162f']
];

function srgbToLinear(c) {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function luminance(hex) {
  const v = hex.replace('#', '');
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function ratio(fg, bg) {
  const a = luminance(fg), b = luminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

console.log('WCAG 2.1 contrast ratios (normal text needs ≥ 4.5:1, large ≥ 3:1)\n');
let worst = Infinity;
PAIRS.forEach(([label, fg, bg]) => {
  const r = ratio(fg, bg);
  const level = r >= 7 ? 'AAA' : r >= 4.5 ? 'AA ' : r >= 3 ? 'AA-large' : 'FAIL';
  if (r < 4.5) worst = Math.min(worst, r);
  console.log(`  ${r.toFixed(2).padStart(5)}:1  ${level.padEnd(8)} ${label}`);
  }
);
console.log('\n  lowest ratio below 4.5 →', worst === Infinity ? 'none 🎉' : worst.toFixed(2) + ':1');
