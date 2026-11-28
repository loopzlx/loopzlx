/* LOOPZLX service worker —— 由 tools/build.mjs 生成，请改本模板而不是 sw.js
 * 预缓存全站静态文件（离线可用 osu / Celeste / GameHub），运行时按需补缓存。 */
var CACHE = '__CACHE__';
var CORE = __CORE__;

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      /* 逐个添加：某个文件缺失不会让整个预缓存失败（addAll 是全有或全无） */
      return Promise.all(CORE.map(function (u) { return c.add(u).catch(function () {}); }));
    }).then(function () { return self.skipWaiting(); })
  );
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
  if (url.origin !== location.origin) return; // 外链（音频/CDN）交给浏览器

  /* ?v= 只是破缓存用：离线匹配时忽略查询串，否则带版本号的请求永远命不中预缓存 */
  var MATCH = { ignoreSearch: true };
  var isCode = /\.(html|js|css|json)$/.test(url.pathname) || url.pathname.slice(-1) === '/';
  if (isCode) {
    /* 代码走网络优先，断网回落缓存 —— 改代码能立刻生效 */
    e.respondWith(
      fetch(req).then(function (res) {
        if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
        return res;
      }).catch(function () { return caches.match(req, MATCH).then(function (r) { return r || caches.match('./load.html', MATCH); }); })
    );
    return;
  }
  /* 图片/字体走缓存优先 */
  e.respondWith(
    caches.match(req, MATCH).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
        return res;
      });
    })
  );
});
