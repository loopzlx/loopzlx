/* gamehub-core.js —— GameHub 骨架：视图切换 / 顶栏 / 提示 / 日志 */
(function () {
    'use strict';

    var GH = window.GH = window.GH || {};
    GH.isOpen = false;
    GH.view = 'hub';

    function $(id) { return document.getElementById(id); }
    GH.$ = $;

    GH.views = { hub: 'gh-hub', g2048: 'gh-g2048', mines: 'gh-mines', snake: 'gh-snake' };

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

    function bindTop() {
        var home = $('gh-top-home');
        var back = $('gh-top-back');
        if (home) home.addEventListener('click', function () {
            if (window.GameHubWarp && window.GameHubWarp.close) window.GameHubWarp.close();
        });
        if (back) back.addEventListener('click', function () {
            if (GH.view === 'hub') {
                if (window.GameHubWarp && window.GameHubWarp.close) window.GameHubWarp.close();
            } else {
                GH.show('hub');
            }
        });
        Array.prototype.forEach.call(document.querySelectorAll('#gh-hub .gh-card'), function (card) {
            card.addEventListener('click', function () { GH.show(card.getAttribute('data-game')); });
        });
    }

    /* 方向键 pads：交给当前游戏处理 */
    function bindPads() {
        var map = { 'gh-2048-pads': 'g2048', 'gh-snake-pads': 'snake' };
        Object.keys(map).forEach(function (boxId) {
            var box = $(boxId);
            if (!box) return;
            box.addEventListener('click', function (e) {
                var pad = e.target.closest('.gh-pad');
                if (!pad) return;
                var dir = pad.getAttribute('data-dir');
                if (map[boxId] === 'g2048' && GH.G2048) GH.G2048.move(dir);
                if (map[boxId] === 'snake' && GH.Snake) GH.Snake.turn(dir);
            });
        });
    }

    GH.boot = function () {
        if (GH.booted) return;
        GH.booted = true;
        bindTop();
        bindPads();
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
})();
