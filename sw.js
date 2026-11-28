/* LOOPZLX service worker —— 由 tools/build.mjs 生成，请改本模板而不是 sw.js
 * 预缓存全站静态文件（离线可用 osu / Celeste / GameHub），运行时按需补缓存。 */
var CACHE = 'lzx-v7.3.0';
var CORE = [
  "./",
  "./assets/avatar.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/og.png",
  "./avatar.png",
  "./css/celeste.css",
  "./css/gamehub.css",
  "./css/osu.css",
  "./css/style.css",
  "./css/tailwind.local.css",
  "./html/celeste/celeste.html",
  "./html/gamehub/gamehub.html",
  "./html/home/home.html",
  "./html/osu/osu.html",
  "./img/osu/mode-catch.jpg",
  "./img/osu/mode-mania.jpg",
  "./img/osu/mode-std.jpg",
  "./img/osu/mode-taiko.jpg",
  "./img/projects/celeste-layer-cyber.svg",
  "./img/projects/celeste-layer-light.svg",
  "./img/projects/cyber-terminal-cyber.svg",
  "./img/projects/cyber-terminal-light.svg",
  "./img/projects/game-hub-cyber.svg",
  "./img/projects/game-hub-light.svg",
  "./img/projects/neural-matrix-cyber.svg",
  "./img/projects/neural-matrix-light.svg",
  "./img/projects/osu-kernel-cyber.svg",
  "./img/projects/osu-kernel-light.svg",
  "./img/projects/wiki-cyber.svg",
  "./img/projects/wiki-light.svg",
  "./index.html",
  "./js/celeste/celeste-boot.js",
  "./js/celeste/celeste-core.js",
  "./js/celeste/celeste-editor.js",
  "./js/celeste/celeste-level.js",
  "./js/celeste/celeste-player.js",
  "./js/celeste/celeste-render.js",
  "./js/celeste/celeste-settings.js",
  "./js/celeste/celeste-ui.js",
  "./js/gamehub/game-2048.js",
  "./js/gamehub/game-minesweeper.js",
  "./js/gamehub/game-snake.js",
  "./js/gamehub/gamehub-core.js",
  "./js/gamehub/gamehub-i18n.js",
  "./js/home/core/achievements.js",
  "./js/home/core/audio-player.js",
  "./js/home/core/celeste-loader.js",
  "./js/home/core/gamehub-loader.js",
  "./js/home/core/main.js",
  "./js/home/core/osu-loader.js",
  "./js/home/core/qr.js",
  "./js/home/core/toolkit.js",
  "./js/home/core/ui-extras.js",
  "./js/osu/osu-audio.js",
  "./js/osu/osu-beatmap.js",
  "./js/osu/osu-boot.js",
  "./js/osu/osu-core.js",
  "./js/osu/osu-game.js",
  "./js/osu/osu-i18n.js",
  "./js/osu/osu-mode-catch.js",
  "./js/osu/osu-mode-mania.js",
  "./js/osu/osu-mode-standard.js",
  "./js/osu/osu-mode-taiko.js",
  "./js/osu/osu-replay.js",
  "./js/osu/osu-settings.js",
  "./js/osu/osu-ui.js",
  "./load.html",
  "./manifest.json",
  "./wiki.html"
];

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
