// NamaSound+ Service Worker
// 自分のシェル（index.html / manifest / アイコン）だけを管理する。
// 各子アプリ（NamaMeto / NamaChu / NamaHam）はそれぞれのSWで自前管理されるため、ここでは関与しない。

const CACHE_NAME = 'namasoundplus-cache-auto';

const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './NamaSoundPlus192.png',
  './NamaSoundPlus512.png',
  './NamaSoundPlus1024.png'
];

// インストール
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

// 古いキャッシュを掃除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ネットワークファースト（自スコープのみ）
self.addEventListener('fetch', (event) => {
  if (!event.request.url.startsWith('http')) return;

  // 自スコープ外（子アプリへのリクエスト）は完全にスルー
  const scope = self.registration.scope;
  if (!event.request.url.startsWith(scope)) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
