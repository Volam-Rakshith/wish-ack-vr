# Wish_Acknowledgement.VR

An interactive, futuristic **birthday-response terminal** — the link you send back to friends
after they wish you. It boots like a system, identifies the sender from the URL, and lets them
push one big glowing button to officially "acknowledge" their wish.

Built by **Volam Rakshith** · a **VR Developments** mini-project.

---

## ✨ What it does

| Stage | What the sender sees |
| --- | --- |
| 1 · Boot | `Wish_Acknowledgement.VR` types itself in, followed by a fast system log: `INITIALIZING… → CONNECTING… → BIRTHDAY EVENT DETECTED → INCOMING WISH DETECTED → IDENTIFYING SENDER…` |
| 2 · Reveal | Their **name** slams onto the screen with a shockwave, glitch and light sweep |
| 3 · Detect | `BIRTHDAY WISH DETECTED`, sender readout cards, and one big **ACKNOWLEDGE WISH** button |
| 4 · Acknowledge | Charging meter → energy implosion → particle burst → confetti → screen flash → success chime |
| 5 · Receipt | `WISH ACKNOWLEDGED ✓` plus a funny system receipt (`BIRTHDAY ENERGY … +100`, `SYSTEM STATUS … HAPPY`, `AGE INCREMENT … APPLIED SILENTLY`) |
| 6 · Sign-off | `Wish Acknowledgement Complete.` · **Volam Rakshith** · animated **VR Developments** brand mark |

Extras: live HUD clock, countdown to 30 September, receipt-ID generator, copy-receipt button,
replay, sound toggle (off by default), skip-intro, full keyboard support.

---

## 🔗 Personalisation — one URL, unlimited friends

The website reads the sender name from the URL query parameter:

```
https://YOUR-SITE/index.html?name=Vijay
https://YOUR-SITE/index.html?name=Anjali%20Rao
https://YOUR-SITE/index.html?name=Arjun
```

* Uses `URLSearchParams`, so spaces and non-English names (`?name=Jos%C3%A9`) work out of the box.
* Missing / empty / whitespace-only `name` → graceful generic fallback (`Friend`).
* Long names are automatically scaled down so they never overflow or clip.
* Nothing is stored server-side — there is no server. No tracking, no cookies, no login.

> Tip: shorten and prettify your links with any free URL shortener (GitHub Pages URLs are long),
> or use a `?name=` query param on a short domain if you have one.

---

## 🚀 Deploy to GitHub Pages

1. Create a repository (name it whatever you like, e.g. `wish-acknowledgement`) — *you* choose the
   owner/name, nothing here assumes a specific account or URL.
2. Upload the whole folder (or push it):

   ```
   git init
   git add .
   git commit -m "Wish_Acknowledgement.VR"
   git branch -M main
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

3. In the repo: **Settings → Pages → Build and deployment**
   * Source: **Deploy from a branch**
   * Branch: **main** · Folder: **/ (root)**
   * Save.
4. Wait a minute, then open the Pages URL GitHub gives you and append `?name=YourFriend`.

`index.html` sits at the repository root, so no extra build configuration is needed.
`.nojekyll` is included so GitHub Pages serves every file as-is.

### Single-file build (optional)

`Wish_Acknowledgement.VR.single-file.html` is the entire experience — CSS and JavaScript inlined —
in one file. Handy for sharing without hosting (WhatsApp, AirDrop, email, USB) or for opening from
the file system. Regenerate it after editing anything in `assets/`:

```bash
python3 tools/build-standalone.py
```

Opening it from disk works in Chrome/Edge/Firefox, query parameter included:
`file:///…/Wish_Acknowledgement.VR.single-file.html?name=Vijay`.
GitHub Pages should still use `index.html` + `assets/` — that is the primary build.

---

## 🖼 Link previews & home-screen icon

`assets/img/og-cover.png` is already wired up as the Open Graph / Twitter card, so a pasted link
shows the branded terminal card instead of a bare URL. The tag uses a **relative** path, which
modern chat clients resolve on their own. If your preview ever comes up blank, open `index.html`
and replace the `og:image` line with the absolute URL of your site:

```html
<meta property="og:image" content="https://YOUR-PAGES-URL/assets/img/og-cover.png" />
```

Chat apps cache previews aggressively — to re-check after a change, append a query string
(`?name=Vijay&v=2`) or test the link in a fresh chat.

`site.webmanifest` + the icons mean friends can use **Add to Home Screen** and get the VR mark as
an app tile. To restyle the assets later, edit `tools/og-card.html` / `tools/app-icon.html` and run:

```bash
npm i puppeteer
node tools/build-images.js
```

---

## 🗂 Project structure

```
wish-acknowledgement-vr/
├── index.html                       # markup: HUD, four scenes, SVG brand mark (inline)
├── site.webmanifest                 # lets friends install it to their home screen
├── Wish_Acknowledgement.VR.single-file.html   # optional 1-file build (generated)
├── .nojekyll                        # tells GitHub Pages to skip Jekyll processing
├── LICENSE                          # MIT
├── README.md
├── tools/                           # development helpers — safe to delete
│   ├── build-standalone.py          # inlines CSS + JS into the single-file build
│   ├── build-images.js              # renders the share assets from the HTML sources
│   ├── og-card.html                 # 1200×630 link-preview design source
│   ├── app-icon.html                # 512×512 icon design source
│   ├── browser-audit.js             # headless layout/overflow audit (7 viewports)
│   ├── browser-edgecases.js         # URL + interaction edge-case tests
│   └── contrast-check.js            # WCAG palette verification
└── assets/
    ├── css/
    │   └── style.css       # design tokens, layout, components, effects, responsive + a11y
    ├── js/
    │   ├── utils.js        # small shared helpers (DOM, timing, typing, text fitting)
    │   ├── audio.js        # Web Audio sound design (synthesised, off by default)
    │   ├── fx.js           # canvas VFX engine: stars, trails, bursts, rings, confetti
    │   └── app.js          # flow controller: boot → detect → acknowledge → receipt → sign-off
    └── img/
        ├── og-cover.png           # 1200×630 link preview (WhatsApp / X / Slack / Discord)
        ├── app-icon-512.png       # home-screen / PWA icon
        └── apple-touch-icon.png   # 180×180 iOS icon
```

No frameworks, no build step, no backend, no API keys, no accounts. Vanilla HTML/CSS/JS only.
The only optional third-party request is the Google Fonts stylesheet; if it is blocked the page
falls back to system fonts and still looks right (and works fully offline).

---

## ⚙️ Configuration

Everything personal lives at the top of `assets/js/app.js`:

```js
const CONFIG = {
  fallbackName: 'Friend',        // used when ?name= is missing
  eventMonth: 8,                 // September (JS months are 0-indexed)
  eventDay: 30,
  signature: 'Volam Rakshith',
  brand: 'VR Developments',
  typingSpeed: 12,               // boot log speed (ms per character)
  maxNameLength: 42
};
```

Change the event date and the HUD countdown / "BIRTHDAY EVENT DETECTED" line follow automatically.
Colors live as CSS custom properties in `:root` at the top of `style.css`.

---

## ⚡ Performance & accessibility

* **Two-layer canvas**: an ambient star field behind the content and an interactive layer
  (pointer trails, bursts, confetti) above it. Glows use pre-rendered sprites and additive
  blending — no per-frame gradient allocation.
* **Adaptive budget**: particle counts, star density and device-pixel-ratio are halved on
  low-power devices (`hardwareConcurrency`, `deviceMemory`, `saveData`, small screens, Safari).
* **Hibernating render loop**: the rAF loop stops when nothing is on screen; it also pauses
  when the tab is hidden.
* `prefers-reduced-motion: reduce` → near-instant boot, no particle storms, single-ring
  acknowledgements, no glitch layers.
* Keyboard: `SPACE` / `ENTER` drives the current scene, `M` toggles sound. Tap-to-skip during
  the intro. Real focus rings, ARIA live-region announcements, and a `<noscript>` fallback.
* Sound is **off by default** and is generated with the Web Audio API — no audio files to host.

---

## 📱 Tested viewports

Desktop 1920×1080 / 1440×900 / 1280×800 · tablet 1180×820 & 820×1180 · phones 430 / 390 / 360 /
320 px wide · landscape phones 844×390 · reduced-motion mode. Text is automatically scaled to fit
and low-priority info rows drop out on short screens so the main button is always reachable.

---

## 🧪 Testing (optional)

The `tools/` folder ships the headless-browser harness used while building this — a full
layout audit across seven viewports plus URL/interaction edge-case tests:

```bash
npm i puppeteer
python3 -m http.server 8000 --directory .
node tools/browser-audit.js phoneP "Anjali Rao"   # layout report + screenshots per viewport
node tools/browser-edgecases.js                   # ?name= handling, skip, replay, copy, double-tap…
node tools/contrast-check.js                      # WCAG contrast ratios for the palette
```

Current status: **0 axe-core violations** across all four scenes at desktop + phone widths,
**0 layout overflows** at every tested viewport, and every palette pair passes WCAG AA.
These helpers are development-only; GitHub Pages never serves them.

---

## 🤝 Sharing it

Send each friend their own link:

```
Hey! You wished me — now please complete the official paperwork:
https://YOUR-SITE/index.html?name=THEIRNAME
```

---

## 📄 License

MIT — see [LICENSE](LICENSE). Do whatever you like with it; a credit is always appreciated.

**Wish_Acknowledgement.VR** · interactive web by **VR Developments**
