/* LOOPZLX service worker —— 核心文件预缓存 + 运行时按需缓存 */
var CACHE = 'lzx-v6';
var CORE = [
  './', './index.html', './load.html', './manifest.json',
  './assets/icon-192.png', './assets/icon-512.png', './assets/og.png',
  './css/style.css', './html/home/home.html',
  './js/home/core/main.js', './js/home/core/audio-player.js',
  './js/home/core/achievements.js', './js/home/core/ui-extras.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); }).catch(function () {}));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return; // 外链（行情/音频）交给浏览器

  var isCode = /\.(html|js|css|json)$/.test(url.pathname) || url.pathname === '/';
  if (isCode) {
    /* 代码走网络优先，断网回落缓存 —— 改代码能立刻生效 */
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () { return caches.match(req).then(function (r) { return r || caches.match('./load.html'); }); })
    );
    return;
  }
  /* 图片/字体走缓存优先 */
  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () { return hit; });
    })
  );
});
