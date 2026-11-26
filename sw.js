const CACHE = 'bucket-list-v5';
const ASSETS = [
  './',
  './index.html',
  './style.css?v=5',
  './app.js?v=5',
  './manifest.json',
  './images/hero.jpg',
  './images/bucket-30f.png',
  './images/bucket-30b.png',
  './images/bucket-40.png',
  './images/bucket-50.png',
  './images/bucket-60.png',
  './images/btn-add.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  // HTML は「まずネット」。新しい版をすぐ受け取れるようにする
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // それ以外は「まずキャッシュ」
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }))
  );
});
