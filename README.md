# AgenticWeb · agenticuantico.dev.ar

Public website and web app of **AgentiCuántico**, an agentic AI platform made in Argentina.
Static site (HTML + CSS + ES modules), **no build step**, served by GitHub Pages at
**https://agenticuantico.dev.ar**.

> This repository is **public**. It must never contain API keys, tokens, personal data or
> the private brain logic. The private brain and the backend live in the private repo
> `AgenticDev`. Only the backend's deployed URL is referenced here (`app/config.js`).

## What's inside

| Path | What it is |
| --- | --- |
| `index.html` | Landing: hero with Three.js neural/quantum field, live 3D Agent demo, what it does, use cases, how it works (animated pipeline), technology, privacy, pricing (ARS/USD), investors (vision + roadmap), FAQ, footer |
| `app/` | Product app: chat assistant UI (sidebar with conversations, new chat, search, agent selector, markdown + code blocks, attach/voice buttons, settings, account/plan menu, plans & checkout, optional talking avatar) |
| `app/config.js` | `API_BASE` (backend URL). **Empty = demo mode** |
| `assets/js/config.js` | `TTS_PROXY_URL`, voice tuning and **PRICING** (editable) |
| `assets/js/avatar.js` | Procedural 3D avatar (head, eyes, eyelids, lips/jaw, hands with finger joints) |
| `assets/js/lipsync.js` | Text → viseme timeline (a/e/i/o/u, m/b/p, f/v…) re-synced by speech boundary events |
| `assets/js/tts.js` | Pluggable TTS: Web Speech (default), premium proxy (ElevenLabs), silent |
| `assets/js/agent.js` | Glue: voice engine + lip sync + avatar |
| `assets/js/brain.js` | Public FAQ matcher (keywords/intents) over `assets/data/knowledge.<lang>.json` |
| `assets/js/hero3d.js` | Hero particle field (performance-aware) |
| `assets/js/i18n.js`, `assets/i18n/*.json`, `app/i18n/*.json` | i18n engine + dictionaries (es-AR default, en, pt-BR) |
| `assets/vendor/three/` | three.js r170 vendored locally (MIT). No CDN dependency |
| `legal/` | Privacy (Ley 25.326), terms, cookies |
| `sw.js`, `manifest.webmanifest` | PWA (installable, offline shell) — ready to wrap as a TWA |
| `CNAME`, `.nojekyll`, `404.html`, `robots.txt`, `sitemap.xml` | GitHub Pages + SEO |
| `tools/` | Dev-only helpers: static checks, e2e tests, generators for legal pages / knowledge / app dictionaries |

## Deploy on GitHub Pages (custom domain)

1. Push `main` to `agenticuantico/AgenticWeb`.
2. GitHub → **Settings → Pages** → *Build and deployment* → Source: **Deploy from a branch** → Branch **`main`** / folder **`/ (root)`** → Save.
3. **Custom domain**: `agenticuantico.dev.ar` (the `CNAME` file already contains it) → Save → wait for the DNS check.
4. Tick **Enforce HTTPS** once the certificate is issued.

DNS must point the apex to GitHub Pages (A records `185.199.108.153`, `185.199.109.153`,
`185.199.110.153`, `185.199.111.153`, or ALIAS/CNAME-flattening to `agenticuantico.github.io`).

`.github/workflows/check.yml` runs the static checks on every push. `.github/workflows/pages.yml`
is an **optional** manual Actions deploy, only if you switch Pages' source to "GitHub Actions".
(Pushing workflow files with a personal token requires the `workflow` scope.)

## Configuration

### Prices (`assets/js/config.js` → `PRICING`)

```js
USD_ARS: 1560,        // BNA official sell rate, Oct 30, 2026
ARS_ROUNDING: 100,    // ARS rounded to the nearest 100
PLANS: [
  { id: 'free',    name: 'Gratis',  usd: 0,  arsFixed: null },
  { id: 'pro',     name: 'Pro',     usd: 10, arsFixed: null },  // → ARS 15.600
  { id: 'empresa', name: 'Empresa', usd: 30, arsFixed: null }   // → ARS 46.800 (proposed default)
]
```

Set `arsFixed: 16000` (for example) to fix an ARS price manually. The pricing cards, the
`/app` plans page and the Agent's FAQ answers all read from here. Mercado Pago charges ARS,
PayPal charges USD. **Keep the backend in sync** (`PRICE_*` vars in the Worker's
`wrangler.toml` and the PayPal plan amounts).

### Backend (`app/config.js` → `API_BASE`)

Empty → **demo mode**: answers come from the local public FAQ with simulated streaming,
conversations stay in `localStorage`, login and payments show a "backend not connected"
notice. Set it to the deployed Worker URL (e.g. `https://api.agenticuantico.dev.ar`) to
enable streaming chat, magic-link/Google login, plan gating and subscriptions. The CSP
already allows `connect-src https:`.

### Premium voice (`assets/js/config.js` → `TTS_PROXY_URL`)

The avatar speaks with the browser's Web Speech voices by default. The voice picker prefers
`es-AR`, then `es-419` / `es-US` / `es-MX`…, and favours names containing *Natural*, *Neural*
or *Google* (same logic for `en` and `pt-BR`; the voice follows the selected language).

To use a premium voice (ElevenLabs) **never put the API key in the frontend**. Deploy the
proxy from the private repo (`AgenticDev/tools/elevenlabs-proxy`, a Cloudflare Worker that
reads `ELEVENLABS_API_KEY` from its secrets) and set:

```js
TTS_PROXY_URL: 'https://tts.agenticuantico.dev.ar'
```

Contract: `POST {text, lang}` → `audio/mpeg`. When set, the app decodes the audio, plays it
through an `AnalyserNode` and drives the mouth from its amplitude combined with the text
viseme timeline scaled to the audio duration. If the proxy fails, it falls back to the
browser voice automatically.

## Lip sync on Android Chrome

Android Chrome often skips `onboundary` and sometimes `onstart`/`onend` for network voices.
The engine therefore: splits text into short chunks (avoids the ~15 s cut-off), starts the
viseme timeline from an estimate if `onstart` doesn't arrive, re-anchors and adapts the speed
whenever a `boundary` event arrives, and uses a watchdog so the avatar never gets stuck talking.

## Local development & tests

No build. Any static server works, e.g. `python3 -m http.server 8080` and open
`http://localhost:8080/`.

```bash
node tools/check.mjs                         # i18n parity, mailto, CNAME, secret patterns
npm i -D playwright sharp && npx playwright install chromium
node tools/e2e.mjs ../screens                # 5 viewports: 375x812, 768x1024, 1280x800, 1366x768, 1920x1080
ONLY=phone-375x812 node tools/e2e.mjs        # one viewport
```

The e2e suite checks: no console errors, no horizontal overflow, language switch (es-AR → en →
pt-BR, keyboard too), exact mailto, ARS/USD toggle, avatar renders and its mouth moves when
`speak()` is called (mocked `speechSynthesis`), es-AR voice selection, app demo chat with
markdown/code, localStorage, mobile drawer, plans with Mercado Pago (ARS) / PayPal (USD),
legal pages, 404, service worker, and the static fallback without WebGL.

Generators (output is committed): `python3 tools/build-static-pages.py` (legal + 404),
`python3 tools/knowledge-src.py` (Agent FAQ), `python3 tools/app-i18n-src.py` (app strings).

## Accessibility & performance

Mobile-first; skip link; keyboard-operable language listbox, agent selector, menus and dialogs;
ARIA live regions for the chat; visible focus; WCAG-AA contrast on the dark theme;
`prefers-reduced-motion` respected (static hero frame, softer avatar motion). Three.js loads
**after first paint** on idle; particle counts and pixel ratio drop on phones; rendering pauses
offscreen and in background tabs; a CSS gradient / SVG avatar is shown without WebGL.

## Android app

The future Play Store app should be a clean **TWA (Trusted Web Activity)** of this PWA
(`/manifest.webmanifest`, `start_url: /app/`). No APK is hosted or linked here.

## Legal

Contact: agenticuantico@gmail.com · Commercial inquiries use the subject **"Consulta Comercial"**.
