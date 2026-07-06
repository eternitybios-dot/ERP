const CACHE = 'hannou-v24';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/budoux.js',
  './js/app.js',
  './js/storage.js',
  './js/scoring.js',
  './js/chart.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).catch(() => {}));
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

function fetchAndCache(request) {
  return fetch(request).then(response => {
    if (response.ok) {
      const clone = response.clone();
      caches.open(CACHE).then(cache => cache.put(request, clone)).catch(() => {});
    }
    return response;
  });
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).origin !== location.origin) return;

  // HTML（起動）はネットワーク優先＝コード更新を確実に拾う。オフライン時はキャッシュ
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetchAndCache(e.request).catch(() =>
        caches.match(e.request).then(c => c || caches.match('./index.html'))
      )
    );
    return;
  }

  // アセットはキャッシュ即時表示＋裏で更新（起動を速く。更新は次回起動で反映）
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fresh = fetchAndCache(e.request).catch(() => cached);
      return cached || fresh;
    })
  );
});
