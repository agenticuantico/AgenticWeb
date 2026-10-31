/* AgentiCuántico service worker: offline shell + sensible caching. Bump VERSION on deploy. */
const VERSION = 'ac-v1-2026-10-31';
const SHELL = `shell-${VERSION}`;
const RUNTIME = `runtime-${VERSION}`;
const PRECACHE = [
  '/', '/index.html', '/404.html', '/manifest.webmanifest', '/favicon.ico',
  '/assets/css/main.css', '/assets/img/sprite.svg', '/assets/img/favicon.svg', '/assets/img/icon-192.png',
  '/assets/js/main.js', '/assets/js/i18n.js', '/assets/js/flags.js', '/assets/js/config.js', '/assets/js/pricing.js', '/assets/js/page.js',
  '/assets/i18n/es-AR.json', '/assets/i18n/en.json', '/assets/i18n/pt-BR.json',
  '/app/', '/app/index.html', '/app/app.css', '/app/app.js', '/app/config.js', '/app/markdown.js', '/app/api.js',
  '/app/i18n/es-AR.json', '/app/i18n/en.json', '/app/i18n/pt-BR.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== RUNTIME).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                 // never cache POST (chat, billing, TTS)
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;  // backend/API and third parties go straight to network
  if (req.mode === 'navigate') {                    // HTML: network-first, offline fallback
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(RUNTIME).then((c) => c.put(req, copy)); return res; })
      .catch(() => caches.match(req).then((r) => r || caches.match(url.pathname.startsWith('/app') ? '/app/' : '/'))));
    return;
  }
  if (url.pathname.startsWith('/assets/vendor/')) { // versioned vendor libs: cache-first
    e.respondWith(caches.match(req).then((r) => r || fetch(req).then((res) => { const copy = res.clone(); caches.open(RUNTIME).then((c) => c.put(req, copy)); return res; })));
    return;
  }
  // Everything else: stale-while-revalidate
  e.respondWith(caches.match(req).then((cached) => {
    const net = fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(RUNTIME).then((c) => c.put(req, copy)); } return res; }).catch(() => cached);
    return cached || net;
  }));
});
