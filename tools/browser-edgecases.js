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
/* URL personalization + interaction edge-case tests */
const puppeteer = require('puppeteer');

const CASES = [
  { url: 'index.html?name=Vijay', expect: 'Vijay', label: 'plain' },
  { url: 'index.html?name=Anjali%20Rao', expect: 'Anjali Rao', label: 'encoded space' },
  { url: 'index.html?name=JOS%C3%89%20M%C3%9CLLER', expect: 'José Müller', label: 'utf-8 diacritics' },
  { url: 'index.html?name=arjun', expect: 'Arjun', label: 'lowercase → title case' },
  { url: 'index.html?name=A%20B%20C', expect: 'A B C', label: 'short tokens' },
  { url: 'index.html', expect: 'Friend', label: 'no param → fallback' },
  { url: 'index.html?name=', expect: 'Friend', label: 'empty param → fallback' },
  { url: 'index.html?name=%20%20%20', expect: 'Friend', label: 'whitespace param → fallback' },
  { url: 'index.html?name=%3Cscript%3Ealert(1)%3C%2Fscript%3E', expect: 'Scriptalert(1)/script', label: 'XSS attempt sanitised' },
  { url: 'index.html?name=Subrahmanyam%20Venkata%20Raghava%20Chakravarthy%20Jr%20The%20Third', expect: null, label: 'very long name (fit check)' },
  { url: 'index.html?other=1&name=Priya&x=2', expect: 'Priya', label: 'param among others' },
  { url: 'index.html?NAME=Priya', expect: 'Friend', label: 'case-sensitive key' }
];

(async () => {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  for (const c of CASES) {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('http://localhost:8000/' + c.url, { waitUntil: 'domcontentloaded' });
    await wait(6500);

    const got = await page.evaluate(() => {
      const reveal = document.getElementById('reveal-name');
      const sender = document.querySelector('[data-name-slot]');
      const long = document.querySelector('.reveal__name');
      const cs = long ? getComputedStyle(long) : null;
      return {
        reveal: reveal.textContent,
        sender: sender.textContent,
        scene: document.querySelector('.scene.is-active').dataset.scene,
        xss: !!document.querySelector('script[data-xss]') || document.body.innerHTML.includes('alert(1)') === false ? 'clean' : 'INJECTED',
        sizeClass: long ? [...long.classList].filter((k) => k.startsWith('name--')).join(',') || 'base' : '',
        revealWidth: Math.round(long.getBoundingClientRect().width),
        revealFontSize: cs ? Math.round(parseFloat(cs.fontSize)) : 0,
        panelW: Math.round(document.querySelector('.panel').getBoundingClientRect().width)
      };
    });

    const expected = c.expect;
    const pass = expected === null
      ? (got.reveal === got.sender && got.revealWidth <= got.panelW * 1.05)
      : got.reveal === expected && got.sender === expected;

    console.log(`${pass ? '✅' : '❌'} ${c.label.padEnd(30)} url="${c.url}"`);
    console.log(`     reveal="${got.reveal}" slot="${got.sender}" ${got.sizeClass} fs=${got.revealFontSize}px w=${got.revealWidth}≤${Math.round(got.panelW)} scene=${got.scene} ${errors.length ? 'ERR:' + errors[0] : ''}`);
    await page.close();
  }

  /* ── interaction edge cases on a single page ── */
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:8000/index.html?name=Vijay', { waitUntil: 'domcontentloaded' });

  // skip button during boot
  await wait(900);
  await page.evaluate(() => document.getElementById('btn-skip').click());
  await wait(2600);
  const afterSkip = await page.evaluate(() => ({
    scene: document.querySelector('.scene.is-active').dataset.scene,
    skipHidden: document.getElementById('btn-skip').hidden,
    logLines: document.querySelectorAll('#boot-log .log__line').length
  }));
  console.log('\n' + (afterSkip.scene === 'detect' ? '✅' : '❌') + ' skip intro →', JSON.stringify(afterSkip));

  // sound toggle
  await page.evaluate(() => document.getElementById('btn-sound').click());
  const sound = await page.evaluate(() => ({
    pressed: document.getElementById('btn-sound').getAttribute('aria-pressed'),
    enabled: window.VR.audio.isEnabled()
  }));
  console.log((sound.enabled ? '✅' : '❌') + ' sound toggle →', JSON.stringify(sound));

  // double-click the CTA: must process exactly once
  await page.evaluate(() => {
    const b = document.getElementById('btn-acknowledge');
    b.click(); b.click(); b.click();
  });
  await wait(3200);
  const afterAck = await page.evaluate(() => ({
    scene: document.querySelector('.scene.is-active').dataset.scene,
    rows: document.querySelectorAll('.status__row').length,
    id: document.getElementById('receipt-id').textContent
  }));
  console.log((afterAck.scene === 'result' ? '✅' : '❌') + ' triple-click acknowledge →', JSON.stringify(afterAck));

  // continue → final, then copy
  await page.evaluate(() => document.getElementById('btn-continue').click());
  await wait(1500);
  await page.evaluate(() => document.getElementById('btn-copy').click());
  await wait(600);
  const toast = await page.evaluate(() => ({
    visible: document.getElementById('toast').classList.contains('is-visible'),
    text: document.getElementById('toast-text').textContent,
    scene: document.querySelector('.scene.is-active').dataset.scene
  }));
  console.log((toast.scene === 'final' ? '✅' : '❌') + ' copy receipt →', JSON.stringify(toast));

  // replay
  await page.evaluate(() => document.getElementById('btn-replay-b').click());
  await wait(1000);
  const replayStart = await page.evaluate(() => ({
    scene: document.querySelector('.scene.is-active').dataset.scene,
    logLines: document.querySelectorAll('#boot-log .log__line').length,
    title: document.title
  }));
  await wait(7000);
  const replayEnd = await page.evaluate(() => ({
    scene: document.querySelector('.scene.is-active').dataset.scene,
    sender: document.querySelector('[data-name-slot]').textContent,
    ctaLabel: document.querySelector('.cta__label').textContent
  }));
  console.log((replayEnd.sender === 'Vijay' ? '✅' : '❌') + ' replay →', JSON.stringify(replayStart), '→', JSON.stringify(replayEnd));

  console.log(errs.length ? '❌ page errors: ' + errs.join(' | ') : '✅ no page errors across all cases');
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
