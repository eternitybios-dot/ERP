const CACHE = 'hannou-v14';

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

// 通知タップでアプリを開く（既に開いていればフォーカス）
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if ('focus' in c) return c.focus();
      }
      return clients.openWindow('./');
    })
  );
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
