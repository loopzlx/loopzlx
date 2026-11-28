/* gamehub-loader.js —— GameHub 覆盖层懒加载控制器（不跳转页面）
   触发：`warp gamehub` / 任意带 data-gamehub-open 的入口。 */
(function () {
    'use strict';

    var APP_ROOT = 'html/gamehub/gamehub.html';
    var CSS_PATH = 'css/gamehub.css';
    var JS_PATH = 'js/gamehub/';
    var SCRIPTS = ['gamehub-i18n.js', 'gamehub-core.js', 'game-2048.js', 'game-minesweeper.js', 'game-snake.js'];

    var loaded = false;
    var busy = false;
    var isOpen = false;

    function $(sel) { return document.querySelector(sel); }

    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            var s = document.createElement('script');
            s.src = src + '?v=7.3.0';  /* 版本号：避免浏览器拿旧的缓存脚本 */
            s.async = false;
            s.onload = function () { resolve(); };
            s.onerror = function () { reject(new Error('script fail: ' + src)); };
            document.head.appendChild(s);
        });
    }

    function ensureCSS() {
        if (document.querySelector('link[data-gamehub-css]')) return;
        var l = document.createElement('link');
        l.rel = 'stylesheet';
        l.href = CSS_PATH;
        l.setAttribute('data-gamehub-css', '1');
        document.head.appendChild(l);
    }

    function bootChain() {
        var chain = Promise.resolve();
        SCRIPTS.forEach(function (f) {
            chain = chain.then(function () { return loadScript(JS_PATH + f); });
        });
        return chain.then(function () {
            if (window.GH && window.GH.boot) window.GH.boot();
            loaded = true;
        });
    }

    function build() {
        return fetch(APP_ROOT, { cache: 'no-cache' })
            .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.text(); })
            .then(function (html) {
                var slot = $('#gamehub-slot');
                if (!slot) throw new Error('#gamehub-slot missing');
                slot.innerHTML = html;
                ensureCSS();
                return bootChain();
            });
    }

    function siteLog(msg) {
        try {
            if (window.addLog) { window.addLog(msg); return; }
            document.dispatchEvent(new CustomEvent('gamehub:log', { detail: msg }));
        } catch (e) {}
    }

    function onOpen() {
        if (window.GH) {
            window.GH.isOpen = true;
            if (window.GH.onOpen) window.GH.onOpen();
            if (window.GH.log) window.GH.log('MOUNTED · overlay');
        }
    }

    function onClose() {
        if (window.GH) {
            window.GH.isOpen = false;
            if (window.GH.Snake && window.GH.Snake.pauseAll) window.GH.Snake.pauseAll();
            if (window.GH.Mines && window.GH.Mines.onShow) window.GH.Mines.onShow(false);
        }
    }

    function open() {
        if (isOpen) return;
        var layer = $('#gamehub-layer');
        if (!layer) return;

        isOpen = true;
        document.body.classList.add('gamehub-open');
        document.body.style.overflow = 'hidden';
        var cmd = document.getElementById('danmaku-input');
        if (cmd) cmd.blur();

        if (loaded) {
            layer.classList.add('is-open');
            layer.setAttribute('aria-hidden', 'false');
            onOpen();
            siteLog('System: gamehub mounted');
            return;
        }

        busy = true;
        layer.classList.add('is-open');
        layer.setAttribute('aria-hidden', 'false');
        var loading = document.createElement('div');
        loading.className = 'gh-boot-hint';
        loading.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;' +
            'font:700 13px/1.6 monospace;letter-spacing:.24em;color:var(--secondary,#ff69b4);background:rgba(0,0,0,.82);z-index:71';
        loading.textContent = 'BOOTING GAMEHUB…';
        layer.appendChild(loading);

        build().then(function () {
            busy = false;
            if (loading.parentNode) loading.parentNode.removeChild(loading);
            onOpen();
            siteLog('System: gamehub mounted');
        }).catch(function (err) {
            busy = false;
            if (loading.parentNode) loading.parentNode.removeChild(loading);
            console.error('[gamehub]', err);
            close();
            siteLog('Error: gamehub mount failed');
        });
    }

    function close() {
        if (!isOpen) return;
        isOpen = false;
        var layer = $('#gamehub-layer');
        if (layer) {
            layer.classList.remove('is-open');
            layer.setAttribute('aria-hidden', 'true');
        }
        document.body.classList.remove('gamehub-open');
        document.body.style.overflow = '';
        onClose();
        siteLog('System: gamehub unmounted');
    }

    function toggle() { isOpen ? close() : open(); }

    document.addEventListener('click', function (e) {
        var el = e.target.closest && e.target.closest('[data-gamehub-open]');
        if (!el) return;
        e.preventDefault();
        open();
    });

    if (window.GH) window.GH.isOpen = false;

    window.GameHubWarp = {
        open: open,
        close: close,
        toggle: toggle,
        isOpen: function () { return isOpen; },
        isLoaded: function () { return loaded; }
    };
})();
