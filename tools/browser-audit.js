/* ─────────────────────────────────────────────────────────────────────────
   Browser test harness (optional, not part of the website build)
   -------------------------------------------------------------------------
   These scripts drive the site in headless Chromium to verify URL
   personalisation, layout at every breakpoint and interaction edge cases.

     npm i puppeteer
     python3 -m http.server 8000 --directory .      # serve the project
     node tools/browser-audit.js phoneP "Anjali Rao"
     node tools/browser-edgecases.js

   Nothing here ships to GitHub Pages — you can delete the tools/ folder.
   ───────────────────────────────────────────────────────────────────────── */
/* Multi-viewport layout audit for Wish_Acknowledgement.VR
   node audit.js [viewport] [name] [--reduced] [--no-shots] */
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = {
  desktop: { width: 1920, height: 1080, deviceScaleFactor: 1 },
  laptop:  { width: 1280, height: 800, deviceScaleFactor: 1 },
  tabL:    { width: 1180, height: 820, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  tabP:    { width: 820, height: 1180, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  phoneP:  { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  phoneSm: { width: 320, height: 568, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  phoneL:  { width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
};

const vpName = process.argv[2] || 'phoneP';
const name = process.argv[3] === undefined ? 'Vijay' : process.argv[3];
const reduced = process.argv.includes('--reduced');
const noShots = process.argv.includes('--no-shots');
const vp = VIEWPORTS[vpName];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none']
  });
  const page = await browser.newPage();
  await page.setViewport(vp);
  if (reduced) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);

  const problems = [];
  page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`[console.error] ${m.text()}`);
  });

  const url = 'http://localhost:8000/index.html' + (name ? `?name=${encodeURIComponent(name)}` : '');
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

  const title = await page.title();
  const shot = async (tag) => {
    if (noShots) return;
    await page.screenshot({ path: path.join(OUT, `${vpName}-${tag}.png`) });
  };

  // ── drive the whole flow, measuring each scene as it appears
  const measure = () => page.evaluate(() => {
    const vw = window.innerWidth, vh = window.innerHeight;
    const active = document.querySelector('.scene.is-active');
    const issues = [];

    active.querySelectorAll('*').forEach((el) => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      const label = (el.className && String(el.className).split(' ')[0]) || el.tagName;
      // decorative layers are clipped by their parents on purpose
      const DECORATIVE = ['cta__halo', 'cta__ring', 'reveal__sweep', 'bg', 'flash'];
      if (DECORATIVE.some((c) => el.classList.contains(c))) return;

      if (r.right > vw + 1.5 || r.left < -1.5) {
        issues.push(`H-OVERFLOW ${label} L${Math.round(r.left)} R${Math.round(r.right)} vw${vw}`);
      }
      // clipped text (single-line boxes with ellipsis or hidden overflow losing pixels)
      if (el.children.length === 0 && el.textContent.trim() && cs.overflow !== 'visible') {
        if (el.scrollWidth > el.clientWidth + 2 && cs.textOverflow !== 'ellipsis' && cs.overflowX !== 'auto') {
          issues.push(`CLIPPED ${label} "${el.textContent.trim().slice(0, 22)}" ${el.scrollWidth}>${el.clientWidth}`);
        }
      }
      // wrapped single-word breaks inside readout/status values
      if (el.classList.contains('readout__val') || el.classList.contains('status__val')) {
        if (el.scrollWidth > el.clientWidth + 1) issues.push(`VAL-OVERFLOW ${label} "${el.textContent}"`);
        const lh = parseFloat(cs.lineHeight);
        if (el.getBoundingClientRect().height > lh * 2.4) issues.push(`VAL-TALL ${label} "${el.textContent.slice(0, 18)}"`);
      }
    });

    // vertical fit
    const overflowY = active.scrollHeight - active.clientHeight;

    return {
      scene: active.dataset.scene,
      vw, vh,
      overflowY,
      issues,
      sender: document.querySelector('.sender__name')?.textContent,
      title: document.title,
      clocks: {
        hud: document.getElementById('hud-clock').textContent,
        countdown: document.getElementById('hud-countdown')?.textContent
      },
      visibleName: (() => {
        const el = document.querySelector('.scene.is-active .signature__name');
        return el ? el.textContent : null;
      })()
    };
  });

  const report = [];
  const step = async (tag, ms) => {
    await wait(ms);
    const m = await measure();
    report.push({ tag, ...m });
    await shot(tag);
  };

  await step('1-boot', 1500);
  await step('2-reveal', 3600);
  await step('3-detect', 3800);
  await page.evaluate(() => document.getElementById('btn-acknowledge').click());
  await step('4-burst', 1300);
  await step('5-result', 2200);
  await page.evaluate(() => document.getElementById('btn-continue').click());
  await step('6-final', 1800);

  // ── extra checks
  const extras = await page.evaluate(() => {
    const out = {};
    out.fxObjects = {
      hasVR: !!window.VR, hasFx: !!(window.VR && window.VR.fx),
      audioEnabled: window.VR.audio.isEnabled()
    };
    out.docTitle = document.title;
    out.senderSlots = [...document.querySelectorAll('[data-name-slot]')].map((n) => n.textContent);
    // tap-target sanity on interactive elements
    out.smallTargets = [...document.querySelectorAll('button')]
      .filter((b) => b.offsetParent !== null)
      .map((b) => ({ t: b.id || b.className, h: Math.round(b.getBoundingClientRect().height) }))
      .filter((x) => x.h < 28);
    return out;
  });

  // keyboard path: SPACE from final → replay
  await page.keyboard.press('Space');
  await wait(2600);
  const afterReplay = await page.evaluate(() => {
    const a = document.querySelector('.scene.is-active');
    return { scene: a.dataset.scene, logLines: document.querySelectorAll('#boot-log .log__line').length };
  });

  console.log(`\n══ ${vpName} ${vp.width}x${vp.height} · name="${name}" ${reduced ? '· reduced-motion' : ''}`);
  console.log(`   document.title → ${title}`);
  report.forEach((r) => {
    const flag = (r.issues.length || r.overflowY > 2) ? '⚠️ ' : '✅';
    console.log(`   ${flag} ${r.tag.padEnd(10)} scene=${String(r.scene).padEnd(7)} scrollOverflowY=${r.overflowY}`);
    r.issues.forEach((i) => console.log(`        · ${i}`));
  });
  console.log(`   extras          →`, JSON.stringify(extras));
  if (extras.smallTargets.length) console.log(`   ⚠️ small targets →`, JSON.stringify(extras.smallTargets));
  console.log(`   after SPACE     →`, JSON.stringify(afterReplay));
  if (problems.length) {
    console.log('   ⚠️ errors:'); problems.forEach((p) => console.log('      -', p));
  } else console.log('   ✅ no page errors');

  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
