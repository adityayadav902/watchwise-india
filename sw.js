/*
 * Service worker: makes the app shell installable and available offline.
 * - Only same-origin GET requests are handled (network first, cache as fallback).
 * - API calls, YouTube thumbnails and fonts are cross-origin and are NEVER intercepted
 *   or cached here, so live ranking data is not stored by the service worker.
 * Bump VERSION whenever you change any shipped file so installed apps pick up the update.
 */
const VERSION = 'v1';
const CACHE = 'watchwise-shell-' + VERSION;
const SHELL = [
  './',
  'index.html',
  'css/styles.css',
  'js/config.js',
  'js/data.js',
  'js/api.js',
  'js/app.js',
  'js/pwa.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('watchwise-shell-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req, { ignoreSearch: true }).then((hit) => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))
      )
  );
});
