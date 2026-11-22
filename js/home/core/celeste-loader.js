/* celeste-loader.js —— 蔚蓝覆盖层（懒加载片段 + 脚本串行 + 生命周期）
   触发：MORE 菜单 / GameHub 卡片 data-celeste-open / `warp celeste`。 */
(function () {
    'use strict';

    var FRAG = 'html/celeste/celeste.html';
    var CSS = 'css/celeste.css';
    var SCRIPTS = [
        'js/celeste/celeste-core.js',
        'js/celeste/celeste-settings.js',
        'js/celeste/celeste-player.js',
        'js/celeste/celeste-level.js',
        'js/celeste/celeste-render.js',
        'js/celeste/celeste-ui.js',
        'js/celeste/celeste-boot.js',
        'js/celeste/celeste-editor.js'
    ];
    var VER = '?v=1.13';

    var loaded = false;
    var isOpen = false;
    var app = null;

    function $(s) { return document.querySelector(s); }

    function log(msg) {
        try {
            if (window.addLog) window.addLog(msg);
            document.dispatchEvent(new CustomEvent('celeste:log', { detail: msg }));
        } catch (e) {}
    }

    function ensureCSS() {
        if (document.querySelector('link[data-celeste-css]')) return;
        var l = document.createElement('link');
        l.rel = 'stylesheet';
        l.href = CSS + VER;
        l.setAttribute('data-celeste-css', '1');
        document.head.appendChild(l);
    }

    function loadScripts(i) {
        if (i >= SCRIPTS.length) return Promise.resolve();
        return new Promise(function (res, rej) {
            var s = document.createElement('script');
            s.src = SCRIPTS[i] + VER;
            s.onload = function () { res(loadScripts(i + 1)); };
            s.onerror = function () { rej(new Error(SCRIPTS[i])); };
            document.body.appendChild(s);
        });
    }

    function build() {
        return fetch(FRAG, { cache: 'no-cache' })
            .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.text(); })
            .then(function (html) {
                var slot = $('#celeste-slot');
                if (!slot) throw new Error('#celeste-slot missing');
                slot.innerHTML = html;
                ensureCSS();
                return loadScripts(0);
            })
            .then(function () {
                app = new Celeste.App();
                app.init();
                loaded = true;
            });
    }

    function open() {
        if (isOpen) return;
        var layer = $('#celeste-layer');
        if (!layer) return;
        isOpen = true;
        document.body.classList.add('celeste-open');
        document.body.style.overflow = 'hidden';
        layer.classList.add('is-open');
        layer.setAttribute('aria-hidden', 'false');
        var cmd = document.getElementById('danmaku-input');
        if (cmd) cmd.blur();

        if (loaded) {
            app.start();
            app.setThemeByDom();
            app.resize();
            log('CELESTE · 继续');
            return;
        }
        build().then(function () {
            app.start();
            app.setThemeByDom();
            app.resize();
        }).catch(function (err) {
            console.error('[celeste]', err);
            log('Error: celeste 载入失败');
            close();
        });
    }

    function close() {
        if (!isOpen) return;
        isOpen = false;
        var layer = $('#celeste-layer');
        if (layer) {
            layer.classList.remove('is-open');
            layer.setAttribute('aria-hidden', 'true');
        }
        document.body.classList.remove('celeste-open');
        document.body.style.overflow = '';
        if (app && app.running) app.stop();
        log('CELESTE · 已退出，回到主页');
    }

    function toggle() { isOpen ? close() : open(); }

    document.addEventListener('click', function (e) {
        var el = e.target.closest && e.target.closest('[data-celeste-open]');
        if (!el) return;
        e.preventDefault();
        closeMobileMenu();
        open();
    });

    function closeMobileMenu() {
        var menu = document.getElementById('mobile-menu');
        if (menu) { menu.classList.add('hidden'); menu.classList.remove('flex'); }
        var mt = document.getElementById('menu-toggle');
        if (mt) { mt.innerHTML = '<i class="fas fa-bars"></i>'; mt.setAttribute('aria-expanded', 'false'); }
    }

    window.CelesteWarp = {
        open: open,
        close: close,
        toggle: toggle,
        isOpen: function () { return isOpen; },
        isLoaded: function () { return loaded; },
        app: function () { return app; }
    };
    /* 站点其它模块（GameHub 卡片等）也可直接调用 */
    window.openCeleste = open;
})();
