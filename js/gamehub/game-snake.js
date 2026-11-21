/* game-snake.js —— 贪吃蛇：canvas 网格、逐格加速、最高分本地存档 */
(function () {
    'use strict';
    var GH = window.GH = window.GH || {};
    var M = GH.Snake = {};

    var COLS = 20, ROWS = 20, CELL = 30;
    var BEST_KEY = 'gh_snake_best';

    var cv, ctx, raf = 0, last = 0, acc = 0, stepMs = 130;
    var snake = [], dir = { x: 1, y: 0 }, queued = [], food = { x: 0, y: 0 };
    var score = 0, best = 0, dead = false, paused = false, active = false;

    function $(id) { return document.getElementById(id); }

    function paintHud() {
        var s = $('gh-snake-score'); if (s) s.textContent = String(score);
        var b = $('gh-snake-best'); if (b) b.textContent = String(best);
        var p = $('gh-snake-pause'); if (p) p.textContent = paused ? 'RESUME' : 'PAUSE';
    }

    function spawnFood() {
        var free = [];
        for (var y = 0; y < ROWS; y++) for (var x = 0; x < COLS; x++) {
            var hit = false;
            for (var i = 0; i < snake.length; i++) if (snake[i].x === x && snake[i].y === y) { hit = true; break; }
            if (!hit) free.push({ x: x, y: y });
        }
        if (!free.length) return;
        food = free[Math.floor(Math.random() * free.length)];
    }

    function reset() {
        snake = [{ x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }];
        dir = { x: 1, y: 0 };
        queued = [];
        score = 0; stepMs = 130; dead = false; paused = false;
        spawnFood();
        paintHud();
        var ov = $('gh-snake-over'); if (ov) ov.classList.remove('is-on');
        draw();
    }

    function draw() {
        if (!ctx) return;
        ctx.clearRect(0, 0, cv.width, cv.height);
        /* 网格 */
        ctx.strokeStyle = 'rgba(255,255,255,.05)';
        ctx.lineWidth = 1;
        for (var g = 1; g < COLS; g++) {
            ctx.beginPath(); ctx.moveTo(g * CELL + .5, 0); ctx.lineTo(g * CELL + .5, ROWS * CELL); ctx.stroke();
        }
        for (var h = 1; h < ROWS; h++) {
            ctx.beginPath(); ctx.moveTo(0, h * CELL + .5); ctx.lineTo(COLS * CELL, h * CELL + .5); ctx.stroke();
        }
        /* 食物 */
        ctx.fillStyle = '#ff5d8f';
        ctx.beginPath();
        ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, CELL * 0.34, 0, Math.PI * 2);
        ctx.fill();
        /* 蛇 */
        for (var i = snake.length - 1; i >= 0; i--) {
            var s = snake[i];
            var t = i / Math.max(1, snake.length - 1);
            ctx.fillStyle = i === 0 ? 'rgba(255,255,255,.95)' : 'rgba(140, 210, 255, ' + (0.9 - t * 0.55) + ')';
            ctx.beginPath();
            var pad = i === 0 ? 2 : 3;
            ctx.roundRect ? ctx.roundRect(s.x * CELL + pad, s.y * CELL + pad, CELL - pad * 2, CELL - pad * 2, 5)
                          : ctx.rect(s.x * CELL + pad, s.y * CELL + pad, CELL - pad * 2, CELL - pad * 2);
            ctx.fill();
        }
    }

    function step() {
        if (queued.length) dir = queued.shift();
        var head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
        if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) return gameOver();
        for (var i = 0; i < snake.length - 1; i++) if (snake[i].x === head.x && snake[i].y === head.y) return gameOver();
        snake.unshift(head);
        if (head.x === food.x && head.y === food.y) {
            score += 10;
            if (score > best) { best = score; try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) {} }
            stepMs = Math.max(65, 130 - Math.floor(score / 50) * 10);
            spawnFood();
            paintHud();
        } else snake.pop();
        draw();
    }

    function gameOver() {
        dead = true;
        var ov = $('gh-snake-over'), tx = $('gh-snake-over-text');
        if (tx) tx.textContent = 'GAME OVER · ' + score;
        if (ov) ov.classList.add('is-on');
        GH.log && GH.log('snake · over · ' + score);
    }

    function loop(ts) {
        if (!active) return;
        if (!last) last = ts;
        var dt = Math.min(100, ts - last);
        last = ts;
        if (!paused && !dead) {
            acc += dt;
            while (acc >= stepMs) { acc -= stepMs; if (!dead) step(); }
        }
        raf = requestAnimationFrame(loop);
    }

    function startLoop() {
        if (raf) return;
        last = 0; acc = 0;
        raf = requestAnimationFrame(loop);
    }

    function stopLoop() {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
    }

    M.turn = function (d) {
        if (dead || paused || !snake.length) return;
        var v = { left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, up: { x: 0, y: -1 }, down: { x: 0, y: 1 } }[d];
        if (!v) return;
        var base = queued.length ? queued[queued.length - 1] : dir;
        if (v.x === -base.x && v.y === -base.y) return;   // 禁止反向
        if (v.x === base.x && v.y === base.y) return;
        if (queued.length < 2) queued.push(v);
    };

    M.boot = function () {
        cv = $('gh-snake-cv');
        if (!cv) return;
        cv.width = COLS * CELL;
        cv.height = ROWS * CELL;
        ctx = cv.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        try { best = parseInt(localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) { best = 0; }
        reset();

        var pause = $('gh-snake-pause');
        if (pause) pause.addEventListener('click', function () {
            if (dead) return;
            paused = !paused;
            paintHud();
            GH.toast(paused ? 'PAUSED' : 'RESUME');
        });
        var nw = $('gh-snake-new'), on = $('gh-snake-over-new');
        if (nw) nw.addEventListener('click', function () { reset(); startLoop(); GH.toast('NEW GAME'); });
        if (on) on.addEventListener('click', function () { reset(); startLoop(); });

        document.addEventListener('keydown', function (e) {
            if (!GH.isOpen || GH.view !== 'snake') return;
            var k = e.key.toLowerCase();
            if (k === 'arrowleft' || k === 'a') { e.preventDefault(); M.turn('left'); }
            else if (k === 'arrowright' || k === 'd') { e.preventDefault(); M.turn('right'); }
            else if (k === 'arrowup' || k === 'w') { e.preventDefault(); M.turn('up'); }
            else if (k === 'arrowdown' || k === 's') { e.preventDefault(); M.turn('down'); }
            else if (k === ' ') { e.preventDefault(); if (!dead) { paused = !paused; paintHud(); } }
        });

        var sx = 0, sy = 0;
        cv.addEventListener('touchstart', function (e) {
            if (!e.touches.length) return;
            sx = e.touches[0].clientX; sy = e.touches[0].clientY;
        }, { passive: true });
        cv.addEventListener('touchend', function (e) {
            var t = e.changedTouches[0];
            var dx = t.clientX - sx, dy = t.clientY - sy;
            if (Math.abs(dx) < 22 && Math.abs(dy) < 22) return;
            M.turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
        }, { passive: true });
    };

    M.onShow = function (on) {
        active = on;
        if (on) { startLoop(); draw(); }
        else stopLoop();
    };

    /* 覆盖层关闭时由 loader 调用 */
    M.pauseAll = function () { stopLoop(); };
    M.resumeAll = function () { if (active) startLoop(); };
})();
