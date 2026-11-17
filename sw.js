// オフラインでもアプリ本体を開けるようにするService Worker
// ファイルを更新したら VERSION を上げる
const VERSION = 'midori-v5';
const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';
const ASSETS = ['./', 'index.html', 'manifest.webmanifest', 'config.js', 'icon-192.png', 'icon-512.png',
  FB + 'firebase-app-compat.js', FB + 'firebase-database-compat.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(ASSETS.map(u => c.add(u).catch(() => {})))));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Firebase SDK（gstatic）はキャッシュ優先
  if (url.href.startsWith(FB)) {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => {
      const cp = res.clone(); caches.open(VERSION).then(c => c.put(req, cp)); return res;
    })));
    return;
  }
  // 自サイトのファイルはネット優先（3秒で諦めてキャッシュ）→更新がすぐ反映される
  if (url.origin === location.origin) {
    e.respondWith(new Promise(resolve => {
      let done = false;
      const fallback = () => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html'));
      const t = setTimeout(() => { if (!done) { done = true; resolve(fallback()); } }, 3000);
      fetch(req).then(res => {
        clearTimeout(t);
        const cp = res.clone(); caches.open(VERSION).then(c => c.put(req, cp));
        if (!done) { done = true; resolve(res); }
      }).catch(() => { clearTimeout(t); if (!done) { done = true; resolve(fallback()); } });
    }));
  }
});
