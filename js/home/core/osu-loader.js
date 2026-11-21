/* osu-loader.js —— 把 html/osu/osu.html 片段以覆盖层方式注入主页，不跳转页面
   触发：指令栏 `warp osu` / 任意带 data-osu-open 的入口。 */
(function () {
    'use strict';

    var APP_ROOT = 'html/osu/osu.html';
    var CSS_PATH = 'css/osu.css';
    var JS_PATH = 'js/osu/';
    var SCRIPTS = [
        'osu-core.js', 'osu-audio.js', 'osu-beatmap.js',
        'osu-mode-mania.js', 'osu-mode-taiko.js', 'osu-mode-catch.js', 'osu-mode-standard.js',
        'osu-game.js', 'osu-ui.js', 'osu-boot.js'
    ];
    var JSZIP = 'https://fastly.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';

    var loaded = false;     // 片段 + 脚本是否已就绪
    var busy = false;       // 正在加载
    var isOpen = false;

    function $(sel) { return document.querySelector(sel); }

    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            var s = document.createElement('script');
            s.src = src;
            s.async = false;
            s.onload = function () { resolve(); };
            s.onerror = function () { reject(new Error('script fail: ' + src)); };
            document.head.appendChild(s);
        });
    }

    function ensureCSS() {
        if (document.querySelector('link[data-osu-css]')) return;
        var l = document.createElement('link');
        l.rel = 'stylesheet';
        l.href = CSS_PATH;
        l.setAttribute('data-osu-css', '1');
        document.head.appendChild(l);
    }

    function bootChain() {
        var chain = Promise.resolve();
        if (!window.JSZip) {
            chain = chain.then(function () { return loadScript(JSZIP).catch(function () { console.warn('[osu] JSZip 加载失败，.osz 导入不可用'); }); });
        }
        SCRIPTS.forEach(function (f) {
            chain = chain.then(function () { return loadScript(JS_PATH + f); });
        });
        return chain.then(function () {
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
        loading.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;' +
            'font:700 13px/1.6 monospace;letter-spacing:.24em;color:var(--secondary,#ff69b4);background:rgba(0,0,0,.82);z-index:71';
        loading.textContent = 'BOOTING osu! KERNEL…';
        layer.appendChild(loading);

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
