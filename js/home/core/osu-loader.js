/* osu-loader.js —— 把 html/osu/osu.html 片段以覆盖层方式注入主页，不跳转页面
   触发：指令栏 `warp osu` / 任意带 data-osu-open 的入口。 */
(function () {
    'use strict';

    var APP_ROOT = 'html/osu/osu.html';
    var CSS_PATH = 'css/osu.css';
    var JS_PATH = 'js/osu/';
    var SCRIPTS = [
        'osu-core.js', 'osu-audio.js', 'osu-beatmap.js', 'osu-settings.js', 'osu-i18n.js',
        'osu-mode-mania.js', 'osu-mode-taiko.js', 'osu-mode-catch.js', 'osu-mode-standard.js',
        'osu-replay.js', 'osu-game.js', 'osu-ui.js', 'osu-boot.js'
    ];
    var JSZIP = ['https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js', 'https://fastly.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js'];

    var loaded = false;     // 片段 + 脚本是否已就绪
    var busy = false;       // 正在加载
    var isOpen = false;

    function $(sel) { return document.querySelector(sel); }

    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            var s = document.createElement('script');
            s.src = src + '?v=3.6';  /* 版本号：避免浏览器拿旧的缓存脚本 */
            s.async = false;
            s.onload = function () { resolve(); };
            s.onerror = function () { reject(new Error('script fail: ' + src)); };
            var timer = setTimeout(function(){ s.onload = s.onerror = null; s.remove(); reject(new Error('script timeout: '+src)); }, 12000);
            s.onload = function () { clearTimeout(timer); resolve(); };
            s.onerror = function () { clearTimeout(timer); reject(new Error('script fail: ' + src)); };
            document.head.appendChild(s);
        });
    }

    function ensureCSS() {
        if (document.querySelector('link[data-osu-css]')) return;
        var l = document.createElement('link');
        l.rel = 'stylesheet';
        l.href = CSS_PATH + '?v=3.6';
        l.setAttribute('data-osu-css', '1');
        document.head.appendChild(l);
    }

    /* JSZip 只在导入 .osz 时才拉（3MB 远程包曾把 osu 启动拖到 4s+） */
    var zipPromise = null;
    function ensureZip() {
        if (window.JSZip) return Promise.resolve(window.JSZip);
        if (!zipPromise) {
            zipPromise = (function tryMirror(i){ if(i>=JSZIP.length) return Promise.reject(new Error('所有 JSZip CDN 均失败')); return loadScript(JSZIP[i]).then(function(){ if(window.JSZip) return window.JSZip; throw new Error('JSZip not exposed'); }).catch(function(){ return tryMirror(i+1); }); })(0)
              .catch(function (e) { zipPromise = null; console.warn('[osu] JSZip 加载失败，.osz 导入暂不可用'); throw e; });
        }
        return zipPromise;
    }
    window.OsuLoadZip = ensureZip;

    function bootChain() {
        /* 先加载核心命名空间，其余模块并行（省 2s+ 启动时间） */
        return loadScript(JS_PATH + 'osu-core.js')
          .then(function () {
              var rest = SCRIPTS.filter(function (f) { return f !== 'osu-core.js' && f !== 'osu-boot.js'; });
              return Promise.all(rest.map(function (f) { return loadScript(JS_PATH + f); }));
          })
          .then(function () { return loadScript(JS_PATH + 'osu-boot.js'); })
          .then(function () {
              if (window.OsuApp && window.OsuApp.boot) window.OsuApp.boot();
              loaded = true;
          });
    }

    function build() {
        return fetch(APP_ROOT, { cache: 'no-cache' })
            .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.text(); })
            .then(function (html) {
                var slot = $('#osu-slot');
                if (!slot) throw new Error('#osu-slot missing');
                slot.innerHTML = html;
                ensureCSS();
                return bootChain();
            });
    }

    function log(msg) {
        if (window.OSU && window.OSU.log) window.OSU.log(msg);
    }

    // 站点日志窗外发一条，跟站点风格保持一致
    function siteLog(msg) {
        try {
            if (window.addLog) { window.addLog(msg); return; }
            var ev = new CustomEvent('osu:log', { detail: msg });
            document.dispatchEvent(ev);
        } catch (e) {}
    }

    function open() {
        if (isOpen) return;
        var layer = $('#osu-layer');
        if (!layer) return;

        isOpen = true;
        /* 进 osu 就把主页背景音乐停掉，别和谱面音频打架 */
        if (window.pauseSiteAudio) {
            var stopped = window.pauseSiteAudio();
            if (stopped) siteLog('Audio: 主页音乐已暂停（进入 osu!）');
        }
        document.body.classList.add('osu-open');
        document.body.style.overflow = 'hidden';
        var cmd = document.getElementById('danmaku-input');
        if (cmd) cmd.blur();

        if (loaded) {
            layer.classList.add('is-open');
            layer.setAttribute('aria-hidden', 'false');
            if (window.OsuApp && window.OsuApp.onOpen) window.OsuApp.onOpen();
            siteLog('System: osu! kernel mounted');
            return;
        }

        busy = true;
        layer.classList.add('is-open');
        layer.setAttribute('aria-hidden', 'false');
        var loading = document.createElement('div');
        loading.className = 'osu-boot-hint';
        loading.style.cssText = 'position:fixed;inset:60px 0 0 0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;' +
            'font:700 13px/1.6 monospace;letter-spacing:.24em;color:var(--secondary,#ff69b4);' +
            'background:rgba(0,0,0,.82);z-index:71;pointer-events:none;transition:opacity .3s';
        loading.innerHTML = 'BOOTING osu! KERNEL…' +
            '<small style="font-size:9px;opacity:.55;letter-spacing:.2em">顶栏 ← HOME 可随时退出</small>';
        layer.appendChild(loading);
        /* 兜底：任何异常都别让提示板永久挡住界面（顶栏也不再被盖住） */
        setTimeout(function () {
            if (loading.parentNode && !loaded) {
                try { if (window.OsuApp && window.OsuApp.boot) window.OsuApp.boot(); loaded = true; } catch (e) {}
                loading.parentNode.removeChild(loading);
            }
        }, 7000);

        build().then(function () {
            busy = false;
            if (loading.parentNode) loading.parentNode.removeChild(loading);
            if (window.OsuApp && window.OsuApp.onOpen) window.OsuApp.onOpen();
            siteLog('System: osu! kernel mounted');
        }).catch(function (err) {
            busy = false;
            if (loading.parentNode) loading.parentNode.removeChild(loading);
            console.error('[osu]', err);
            close();
            siteLog('Error: osu! kernel mount failed');
        });
    }

    function close() {
        if (!isOpen) return;
        isOpen = false;
        var layer = $('#osu-layer');
        if (layer) {
            layer.classList.remove('is-open');
            layer.setAttribute('aria-hidden', 'true');
        }
        document.body.classList.remove('osu-open');
        document.body.style.overflow = '';
        if (window.OsuApp && window.OsuApp.onClose) window.OsuApp.onClose();
        siteLog('System: osu! kernel unmounted');
    }

    function toggle() { isOpen ? close() : open(); }

    /* 事件委托：任何 data-osu-open 元素都能拉起 */
    document.addEventListener('click', function (e) {
        var el = e.target.closest && e.target.closest('[data-osu-open]');
        if (!el) return;
        e.preventDefault();
        open();
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && isOpen) {
            // 游戏中 Esc 交给引擎暂停；其余视图 Esc 关闭面板
            var view = window.OSU && window.OSU.S ? window.OSU.S.view : 'menu';
            if (view === 'play') return;
            close();
        }
    });

    window.OsuWarp = {
        open: open,
        close: close,
        toggle: toggle,
        isOpen: function () { return isOpen; },
        isLoaded: function () { return loaded; }
    };

    if (window.OSU) window.OSU.isOpen = function () { return isOpen; };
})();
