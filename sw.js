const CACHE = 'hannou-v11';

self.addEventListener('install', e => {
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

// オンライン時は常にネットワークから取得してキャッシュを更新する。
// オフライン時だけキャッシュを使う。GETのみ対象。
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE)
            .then(cache => cache.put(e.request, clone))
            .catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});
