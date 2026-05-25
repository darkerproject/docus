/* Dokus Service Worker — minimal offline shell.
   Strategy: network-first for same-origin GETs (so updates apply fast), with
   cache fallback when offline. Cross-origin requests (CDN libs) are not
   handled here — the browser cache and the CDN's own caching handle those.

   Update flow: a new worker does NOT skipWaiting() automatically. It stays in
   the "waiting" state so the page can show a "Nueva versión disponible"
   banner; when the user taps "Actualizar", the page sends a SKIP_WAITING
   message and this worker activates, clears old caches and takes over. */

const CACHE = 'dokus-v6';
const CORE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon-180.png',
  './icons/favicon-32.png'
];

self.addEventListener('install', event => {
  // No skipWaiting() here on purpose — see the update-flow note above.
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(CORE)).catch(() => {})
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Sent by the page when the user taps "Actualizar" on the update banner.
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Only handle same-origin requests; let CDN libs go straight through.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then(hit => hit || caches.match('./index.html'))
      )
  );
});
