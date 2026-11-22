/* gamehub-core.js —— GameHub 骨架：视图切换 / 顶栏 / 主题色 / 全屏手势 / 中英切换 / 提示 */
(function () {
    'use strict';

    var GH = window.GH = window.GH || {};
    GH.isOpen = false;
    GH.view = 'hub';

    function $(id) { return document.getElementById(id); }
    GH.$ = $;

    GH.views = { hub: 'gh-hub', g2048: 'gh-g2048', mines: 'gh-mines', snake: 'gh-snake' };

    /* ---------------- 主题色：跟随主页主题变量 ---------------- */
    var colorCache = null, colorKey = '';

    GH.colors = function (force) {
        /* 站点主题类挂在 <html> 上（:root），body 上没有，两者一起做缓存键 */
        var key = (document.documentElement.className || '') + '|' + (document.body.className || '');
        if (colorCache && !force && key === colorKey) return colorCache;
        colorKey = key;
        function v(name, fb) {
            try {
                var s = getComputedStyle(document.body || document.documentElement).getPropertyValue(name);
                s = (s || '').trim();
                return s || fb;
            } catch (e) { return fb; }
        }
        colorCache = {
            primary: v('--primary', '#8a2be2'),
            secondary: v('--secondary', '#ff69b4'),
            text: v('--text-main', '#f0f4f8'),
            muted: v('--text-muted', '#a78bcc'),
            bg: v('--bg-base', '#050208'),
            line: v('--glass-border', 'rgba(138,43,226,.35)')
        };
        return colorCache;
    };

    /* 主题切换后让 canvas 类游戏重刷配色 */
    function refreshTheme() {
        GH.colors(true);
        if (GH.Snake && GH.Snake.onTheme) GH.Snake.onTheme();
        if (GH.G2048 && GH.G2048.onTheme) GH.G2048.onTheme();
    }
    GH.refreshTheme = refreshTheme;
    /* 站点切主题时会改 <html> 的 class：监听一下，覆盖层开着也能跟着变 */
    var lastThemeClass = document.documentElement.className;
    setInterval(function () {
        var now = document.documentElement.className;
        if (now !== lastThemeClass) {
            lastThemeClass = now;
            refreshTheme();
            if (GH.i18n && GH.i18n.apply) GH.i18n.apply();
        }
    }, 800);

    GH.show = function (name) {
        if (!GH.views[name]) name = 'hub';
        Object.keys(GH.views).forEach(function (k) {
            var v = $(GH.views[k]);
            if (v) v.classList.toggle('is-on', k === name);
        });
        GH.view = name;
        var back = $('gh-top-back');
        if (back) back.style.display = name === 'hub' ? 'none' : '';
        if (name !== 'hub') { try { GH.log('OPEN · ' + name); } catch (e) {} }
        /* 只让当前游戏跑循环，其余停表 */
        if (GH.G2048 && GH.G2048.onShow) GH.G2048.onShow(name === 'g2048');
        if (GH.Mines && GH.Mines.onShow) GH.Mines.onShow(name === 'mines');
        if (GH.Snake && GH.Snake.onShow) GH.Snake.onShow(name === 'snake');
        if (GH.i18n && GH.i18n.apply) GH.i18n.apply();
    };

    var toastTimer = 0;
    GH.toast = function (msg) {
        var t = $('gh-toast');
        if (!t) return;
        t.textContent = msg;
        t.classList.add('is-on');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { t.classList.remove('is-on'); }, 1600);
    };

    GH.log = function (msg) {
        var box = $('gh-log');
        if (!box) return;
        var line = document.createElement('div');
        var d = new Date();
        var p = function (n) { return (n < 10 ? '0' : '') + n; };
        line.textContent = '[' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()) + '] ' + msg;
        box.insertBefore(line, box.firstChild);
        while (box.children.length > 30) box.removeChild(box.lastChild);
    };

    /* ---------------- 全屏手势：整块覆盖层都能滑动 / 点击转向 ----------------
       一次手势只发有限次方向（2048 一次一步，蛇一次一转向），避免一次滑动连跳好几格；
       鼠标拖拽与触屏走同一套 pointer 事件，桌面端同样可用。 */
    var G = GH.gesture = {
        active: false, ox: 0, oy: 0, sx: 0, sy: 0, id: -1, moved: false, t0: 0,
        axis: null, sent: 0, max: 1, first: 18, step: 44
    };

    function dirOf(dx, dy) {
        return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    }

    /* 当前游戏接收手势（扫雷用指针本身，不参与滑动） */
    function target() {
        if (!GH.isOpen) return null;
        if (GH.view === 'g2048') return GH.G2048;
        if (GH.view === 'snake') return GH.Snake;
        return null;
    }

    function ignoreStart(e) {
        var t = e.target;
        if (!t || !t.closest) return false;
        if (t.closest('#gamehub-app .gh-btn, #gamehub-app .gh-chip, #gamehub-app .gh-over, #gamehub-app .gh-card, #gamehub-app .gh-mine, #gamehub-app button, #gamehub-app input')) return true;
        return false;
    }

    function bindGesture() {
        var app = $('gamehub-app');
        if (!app) return;

        app.addEventListener('pointerdown', function (e) {
            if (!target() || ignoreStart(e)) return;
            G.active = true; G.moved = false; G.id = e.pointerId;
            G.ox = e.clientX; G.oy = e.clientY;
            G.sx = e.clientX; G.sy = e.clientY;
            G.axis = null; G.sent = 0;
            G.max = (GH.view === 'snake') ? 1 : 1;   /* 一次手势只给一步，防连跳 */
            G.t0 = performance.now();
            if (app.setPointerCapture && e.pointerId != null) {
                try { app.setPointerCapture(e.pointerId); } catch (err) {}
            }
        }, true);

        app.addEventListener('pointermove', function (e) {
            if (!G.active || e.pointerId !== G.id) return;
            var t = target();
            if (!t || !t.dir) return;
            if (G.sent >= G.max) return;
            var tdx = e.clientX - G.sx, tdy = e.clientY - G.sy;
            if (!G.axis) {
                if (Math.abs(tdx) < G.first && Math.abs(tdy) < G.first) return;
                G.axis = Math.abs(tdx) > Math.abs(tdy) ? 'x' : 'y';
            }
            var d = G.axis === 'x' ? tdx : tdy;
            if (Math.abs(d) < G.step) return;          /* 超过阈值才认一次 */
            t.dir(dirOf(tdx, tdy));
            G.sent++;
            G.moved = true;
        }, true);

        function end(e) {
            if (!G.active) return;
            if (e && e.pointerId != null && G.id >= 0 && e.pointerId !== G.id) return;
            G.active = false; G.id = -1; G.axis = null;
            var t = target();
            if (!t) return;
            /* 轻点（位移小、时间短）→ 交给游戏“点击转向 / 点到即走” */
            var moved = Math.abs((e && e.clientX != null ? e.clientX : G.sx) - G.sx) > G.first ||
                Math.abs((e && e.clientY != null ? e.clientY : G.sy) - G.sy) > G.first;
            if (!G.moved && !moved && t.tap && performance.now() - G.t0 < 500) t.tap(e ? e.clientX : G.sx, e ? e.clientY : G.sy);
        }
        app.addEventListener('pointerup', end, true);
        app.addEventListener('pointercancel', end, true);
    }

    /* ---------------- 顶栏 / 卡片（事件委托：DOM 被重建也不会丢绑定） ---------------- */
    function bindTop() {
        var app = $('gamehub-app');
        if (!app) return;
        app.addEventListener('click', function (e) {
            var t = e.target;
            if (!t || !t.closest) return;
            var el = t.closest('#gamehub-app .gh-card, #gamehub-app button');
            if (!el) return;
            /* 独立覆盖层入口（Celeste）：先关 GH 再拉那一层 */
            if (t.closest('#gamehub-app [data-celeste-open]')) {
                if (window.GameHubWarp && window.GameHubWarp.close) window.GameHubWarp.close();
                if (window.CelesteWarp && window.CelesteWarp.open) {
                    setTimeout(function () { window.CelesteWarp.open(); }, 260);
                }
                return;
            }
            if (el.classList.contains('gh-card')) {
                var g = el.getAttribute('data-game');
                if (g) GH.show(g);
                return;
            }
            var id = el.id;
            if (id === 'gh-theme') {
                if (window.CyberTheme && window.CyberTheme.next) {
                    var tn = window.CyberTheme.next();
                    try { GH.log('THEME · ' + String(tn).replace('theme-', '')); } catch (e) {}
                }
                return;
            }
            if (id === 'gh-lang') { if (GH.i18n) GH.i18n.toggle(); return; }
            if (id === 'gh-top-home') {
                if (window.GameHubWarp && window.GameHubWarp.close) window.GameHubWarp.close();
                return;
            }
            if (id === 'gh-top-back') {
                if (GH.view === 'hub') {
                    if (window.GameHubWarp && window.GameHubWarp.close) window.GameHubWarp.close();
                } else GH.show('hub');
            }
        });
    }

    GH.boot = function () {
        if (GH.booted) return;
        GH.booted = true;
        GH.colors(true);
        if (GH.i18n) GH.i18n.load();
        bindTop();
        bindGesture();
        if (GH.G2048 && GH.G2048.boot) GH.G2048.boot();
        if (GH.Mines && GH.Mines.boot) GH.Mines.boot();
        if (GH.Snake && GH.Snake.boot) GH.Snake.boot();
        document.addEventListener('keydown', function (e) {
            if (!GH.isOpen) return;
            if (e.key === 'Escape') {
                e.preventDefault();
                if (GH.view === 'hub') {
                    if (window.GameHubWarp && window.GameHubWarp.close) window.GameHubWarp.close();
                } else GH.show('hub');
            }
        });
        GH.show('hub');
        GH.log('GameHub ready · 3 games');
    };

    /* 每次打开时刷新主题色（站点可能已切主题） */
    GH.onOpen = function () {
        refreshTheme();
        if (GH.i18n) GH.i18n.apply();
        GH.show('hub');
    };
})();
