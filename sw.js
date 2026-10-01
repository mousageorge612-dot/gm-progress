const CACHE = 'gm-progress-v3';
const FILES = [
  './', './index.html', './manifest.webmanifest',
  './assets/styles.css', './assets/app.js',
  './assets/img/logo.png', './assets/img/icon-192.png', './assets/img/icon-512.png', './assets/img/apple-touch-icon.png',
  './assets/img/coach-outdoor.jpg', './assets/img/coach-gym.jpg', './assets/img/coach-mirror.jpg',
  './assets/fonts/cairo-arabic-400-normal.woff2', './assets/fonts/cairo-arabic-700-normal.woff2', './assets/fonts/cairo-arabic-900-normal.woff2',
  './assets/fonts/cairo-latin-400-normal.woff2', './assets/fonts/cairo-latin-700-normal.woff2', './assets/fonts/cairo-latin-900-normal.woff2'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
