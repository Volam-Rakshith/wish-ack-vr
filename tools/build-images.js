/* ─────────────────────────────────────────────────────────────────────────
   Renders the share assets from tools/og-card.html and tools/app-icon.html:
     assets/img/og-cover.png            1200 × 630  (WhatsApp / X / Slack / Discord)
     assets/img/app-icon-512.png         512 × 512  (PWA / manifest)
     assets/img/apple-touch-icon.png     180 × 180  (iOS home screen)

   Usage:  npm i puppeteer && node tools/build-images.js
   Run it only when the brand design changes — the PNGs are committed.
   ───────────────────────────────────────────────────────────────────────── */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'img');

const JOBS = [
  { src: 'tools/og-card.html',   out: 'og-cover.png',          width: 1200, height: 630 },
  { src: 'tools/app-icon.html',  out: 'app-icon-512.png',      width: 512,  height: 512 },
  { src: 'tools/app-icon.html',  out: 'apple-touch-icon.png',  width: 180,  height: 180 }
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none']
  });

  for (const job of JOBS) {
    const page = await browser.newPage();
    await page.setViewport({ width: job.width, height: job.height, deviceScaleFactor: 1 });
    await page.goto('file://' + path.join(ROOT, job.src), { waitUntil: 'networkidle0', timeout: 30000 });

    // make sure the webfonts have actually painted before capturing
    await page.evaluate(() => document.fonts && document.fonts.ready);
    await new Promise((r) => setTimeout(r, 350));

    const target = path.join(OUT, job.out);
    await page.screenshot({ path: target, type: 'png' });

    const kb = (fs.statSync(target).size / 1024).toFixed(1);
    console.log(`✔ ${job.out.padEnd(24)} ${job.width}×${job.height}  ${kb} KB`);
    await page.close();
  }

  await browser.close();
  console.log('\nAssets written to assets/img/ — remember to regenerate the single-file build.');
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
