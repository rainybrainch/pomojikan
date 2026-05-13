// ぽもじかん ── Service Worker v1.0
// 戦略：
//   - 同一オリジン HTML: stale-while-revalidate（即返し + 裏で更新）
//   - 同一オリジン アセット (svg/json/html): cache-first
//   - Google Fonts: cache-first
//   - api.github.com: ネットワークのみ（Gist 同期）
//   - その他 cross-origin: network-first

const CACHE_NAME = 'pomojikan-v29-46';
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg',
  './icon-maskable.svg',
  './og.svg',
  './screenshot.svg',
  './screenshot-wide.svg',
  './privacy.html',
  './404.html',
  './help.html',
  './changelog.html',
  './license.html',
  './words-kanji.js',
  './words-jukugo.js',
  './words-general.js',
  './words-nature.js',
  './words-life.js',
  './words-onomatopoeia.js',
  './words-history.js',
  './words-mythology.js',
  './words-medical.js',
  './words-modern.js',
  './words-world.js',
  './words-legal.js',
  './words-classical.js',
  './words-otaku.js',
  './words-science.js',
  './words-cooking.js',
  './words-music.js',
  './words-arts.js',
  './words-people.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE).catch(() => {/* 一部失敗してもOK */}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function staleWhileRevalidate(req) {
  return caches.match(req).then((cached) => {
    const fetchPromise = fetch(req).then((res) => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, clone));
      }
      return res;
    }).catch(() => cached);
    return cached || fetchPromise;
  });
}

function cacheFirst(req) {
  return caches.match(req).then((cached) => {
    if (cached) return cached;
    return fetch(req).then((res) => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, clone));
      }
      return res;
    });
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Gist API は絶対キャッシュしない
  if (url.hostname === 'api.github.com' || url.hostname.endsWith('githubusercontent.com')) return;

  // Google Fonts: cache-first
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(req));
    return;
  }

  // 同一オリジン
  if (url.origin === self.location.origin) {
    // HTML: stale-while-revalidate（古いキャッシュをすぐ返しつつ裏で更新）
    if (req.destination === 'document' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
      event.respondWith(
        staleWhileRevalidate(req).catch(() => caches.match('./index.html'))
      );
      return;
    }
    // その他のアセット: cache-first
    event.respondWith(cacheFirst(req));
    return;
  }

  // 他オリジン: ネットワーク優先
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});

// メッセージ受け取り：即時更新を強制
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
