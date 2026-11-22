/* game-snake.js —— 贪吃蛇：插值滑动、转向队列、主题配色、整屏手势
   手感要点：
   1) 方向输入排队（最多 2 个），按“队列末尾”校验 180° 反向 —— 快速 右→上→左 不会把自己撞死；
   2) 渲染按上一格→本格插值，画布按显示尺寸 × DPR 重新分配，笔记本/平板都清晰；
   3) 手势由 gamehub-core 整屏分发（dir），轻点按画布坐标换算成方向（tap）。 */
(function () {
    'use strict';
    var GH = window.GH = window.GH || {};
    var M = GH.Snake = {};

    var COLS = 20, ROWS = 20;
    var BEST_KEY = 'gh_snake_best';

    var cv, ctx, dpr = 1, raf = 0, last = 0, acc = 0, stepMs = 130;
    var cell = 28, cssW = 560, cssH = 560;
    var bgCv = null, bgKey = '';
    var snake = [], prevSnake = [], dir = { x: 1, y: 0 }, queue = [];
    var food = { x: 0, y: 0 };
    var score = 0, best = 0, dead = false, paused = false, active = false, eatFlash = 0;
    var pal = null, palKey = '';

    function $(id) { return document.getElementById(id); }
    function t(k) { return GH.t ? GH.t(k) : k; }

    function paintHud() {
        var s = $('gh-snake-score'); if (s) s.textContent = String(score);
        var b = $('gh-snake-best'); if (b) b.textContent = String(best);
        var p = $('gh-snake-pause');
        if (p) p.textContent = paused ? t('common.resume') : t('common.pause');
    }

    function colors() {
        var c = GH.colors ? GH.colors() : null;
        var key = (c ? c.primary + c.secondary + c.text : '') + (document.body.className || '');
        if (pal && key === palKey) return pal;
        palKey = key;
        pal = c || { primary: '#8a2be2', secondary: '#ff69b4', text: '#f0f4f8', muted: '#a78bcc', bg: '#050208' };
        return pal;
    }

    function occupied(x, y) {
        for (var i = 0; i < snake.length; i++) if (snake[i].x === x && snake[i].y === y) return true;
        return false;
    }

    function spawnFood() {
        var free = [];
        for (var y = 0; y < ROWS; y++) for (var x = 0; x < COLS; x++) if (!occupied(x, y)) free.push({ x: x, y: y });
        if (!free.length) { win(); return; }
        food = free[Math.floor(Math.random() * free.length)];
    }

    function win() {
        dead = true;
        var ov = $('gh-snake-over'), tx = $('gh-snake-over-text');
        if (tx) tx.textContent = t('snake.win') + score;
        if (ov) ov.classList.add('is-on');
    }

    function reset() {
        snake = [{ x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }];
        prevSnake = snake.map(function (s) { return { x: s.x, y: s.y }; });
        dir = { x: 1, y: 0 }; queue = [];
        score = 0; stepMs = 130; dead = false; paused = false; acc = 0; eatFlash = 0;
        spawnFood();
        paintHud();
        var ov = $('gh-snake-over'); if (ov) ov.classList.remove('is-on');
        draw(0);
        if (active) startLoop();
    }

    /* ---------------- 尺寸：跟显示尺寸走，避免缩放糊 ---------------------------- */
    function layout() {
        if (!cv) return;
        var w = cv.clientWidth || 560;
        var hRatio = ROWS / COLS;
        cssW = w;
        cssH = Math.round(w * hRatio);
        dpr = Math.min(1.65, window.devicePixelRatio || 1);
        cell = cssW / COLS;
        cv.width = Math.round(cssW * dpr);
        cv.height = Math.round(cssH * dpr);
        if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        bgCv = null; bgKey = '';
        draw(dead ? 1 : acc / stepMs);
    }

    /* ---------------- 绘制 ---------------- */
    function roundRect(c, x, y, w, h, r) {
        if (c.roundRect) { c.roundRect(x, y, w, h, r); return; }
        c.beginPath();
        c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
        c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
        c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y);
        c.closePath();
    }

    function buildBg() {
        var c = colors();
        var key = cssW + 'x' + cssH + '|' + c.line + '|' + dpr;
        if (bgCv && key === bgKey) return;
        bgKey = key;
        bgCv = document.createElement('canvas');
        bgCv.width = Math.round(cssW * dpr);
        bgCv.height = Math.round(cssH * dpr);
        var bx = bgCv.getContext('2d');
        bx.setTransform(dpr, 0, 0, dpr, 0, 0);
        /* 棋盘格：比纯线网格更像街机 */
        for (var y = 0; y < ROWS; y++) {
            for (var x = 0; x < COLS; x++) {
                bx.fillStyle = (x + y) % 2 ? 'rgba(255,255,255,.016)' : 'rgba(255,255,255,.038)';
                bx.fillRect(x * cell, y * cell, cell, cell);
            }
        }
        bx.strokeStyle = 'rgba(255,255,255,.035)';
        bx.lineWidth = 1;
        bx.beginPath();
        for (var g = 1; g < COLS; g++) { bx.moveTo(Math.round(g * cell) + .5, 0); bx.lineTo(Math.round(g * cell) + .5, cssH); }
        for (var h = 1; h < ROWS; h++) { bx.moveTo(0, Math.round(h * cell) + .5); bx.lineTo(cssW, Math.round(h * cell) + .5); }
        bx.stroke();
    }

    function draw(alpha) {
        if (!ctx) return;
        buildBg();
        var c = colors();
        ctx.clearRect(0, 0, cssW, cssH);
        ctx.drawImage(bgCv, 0, 0, cssW, cssH);

        /* 食物：呼吸 + 外圈光晕 */
        var pulse = 1 + Math.sin(performance.now() / 260) * 0.07;
        var fx = (food.x + .5) * cell, fy = (food.y + .5) * cell;
        var rr = cell * 0.34 * pulse;
        var glow = ctx.createRadialGradient(fx, fy, 0, fx, fy, cell * 0.85);
        glow.addColorStop(0, c.secondary);
        glow.addColorStop(.45, 'rgba(255,255,255,0)');
        ctx.globalAlpha = .22;
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(fx, fy, cell * 0.85, 0, 6.283); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = c.secondary;
        ctx.beginPath(); ctx.arc(fx, fy, rr, 0, 6.283); ctx.fill();

        /* 蛇：上一格 → 本格插值 */
        var n = snake.length;
        for (var i = n - 1; i >= 0; i--) {
            var cur = snake[i];
            var pre = prevSnake[i] || cur;
            var px = (pre.x + (cur.x - pre.x) * alpha) * cell;
            var py = (pre.y + (cur.y - pre.y) * alpha) * cell;
            var inset = i === 0 ? cell * 0.07 : cell * 0.1;
            var size = cell - inset * 2;

            if (i === 0) {
                ctx.globalAlpha = .16;
                ctx.fillStyle = c.secondary;
                ctx.beginPath(); ctx.arc(px + cell / 2, py + cell / 2, cell * 0.48, 0, 6.283); ctx.fill();
                ctx.globalAlpha = 1;
                ctx.fillStyle = c.text;
            } else {
                var k = i / Math.max(1, n - 1);
                ctx.globalAlpha = 0.95 - k * 0.45;
                ctx.fillStyle = c.primary;
            }
            ctx.beginPath();
            roundRect(ctx, px + inset, py + inset, size, size, i === 0 ? cell * 0.26 : cell * 0.2);
            ctx.fill();
            ctx.globalAlpha = 1;

            /* 眼睛朝当前方向 */
            if (i === 0) {
                var ex = px + cell / 2, ey = py + cell / 2;
                var nx = dir.x, ny = dir.y, side = cell * 0.16, fwd = cell * 0.18;
                ctx.fillStyle = c.bg || '#050208';
                ctx.beginPath(); ctx.arc(ex + nx * fwd - ny * side, ey + ny * fwd - nx * side, cell * 0.075, 0, 6.283); ctx.fill();
                ctx.beginPath(); ctx.arc(ex + nx * fwd + ny * side, ey + ny * fwd + nx * side, cell * 0.075, 0, 6.283); ctx.fill();
            }
        }

        /* 吃食扩散环 */
        if (eatFlash > 0) {
            ctx.globalAlpha = eatFlash;
            ctx.strokeStyle = c.secondary;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(fx, fy, cell * (0.4 + (1 - eatFlash) * 0.8), 0, 6.283);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
    }

    /* ---------------- 逻辑 ---------------- */
    /* 即时转向：按下就生效，不排队；只拦 180° 反向和“转过去正好撞自己” */
    function blockedByBody(v) {
        var hx = snake[0].x + v.x, hy = snake[0].y + v.y;
        for (var i = 1; i < snake.length - 1; i++) {
            if (snake[i].x === hx && snake[i].y === hy) return true;
        }
        return false;
    }

    function turn(d) {
        if (dead || paused || !snake.length) return false;
        var v = { left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, up: { x: 0, y: -1 }, down: { x: 0, y: 1 } }[d];
        if (!v) return false;
        if (v.x === -dir.x && v.y === -dir.y) return false;
        if (v.x === dir.x && v.y === dir.y) return false;
        if (blockedByBody(v)) return false;
        dir = v; queue = [];
        return true;
    }

    function step() {
        if (queue.length) {
            dir = queue.shift();
        }
        prevSnake = snake.map(function (s) { return { x: s.x, y: s.y }; });
        var head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
        if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) return gameOver();

        for (var i = 0; i < snake.length - 1; i++) {
            if (snake[i].x === head.x && snake[i].y === head.y) return gameOver();
        }
        snake.unshift(head);

        if (head.x === food.x && head.y === food.y) {
            score += 10;
            if (score > best) { best = score; try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) {} }
            if (window.LZXAch) { if (score >= 20) window.LZXAch.unlock('gh-snake-20'); if (score >= 50) window.LZXAch.unlock('gh-snake-50'); }
            stepMs = Math.max(70, 130 - Math.floor(score / 40) * 8);
            eatFlash = 1;
            spawnFood();
            paintHud();
            prevSnake.unshift({ x: head.x, y: head.y });
        } else snake.pop();
    }

    function gameOver() {
        dead = true;
        queue = [];
        acc = 0;
        draw(1);                 /* 定格在撞上的那一格，不留半格 */
        var ov = $('gh-snake-over'), tx = $('gh-snake-over-text');
        if (tx) tx.textContent = t('over.prefix') + score;
        if (ov) ov.classList.add('is-on');
        GH.log && GH.log('snake · over · ' + score);
    }

    function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

    function loop(ts) {
        if (!active) return;
        raf = requestAnimationFrame(loop);
        if (!last) last = ts;
        var dt = Math.min(50, ts - last);
        last = ts;

        if (!paused && !dead) {
            acc += dt;
            var guard = 0;
            while (acc >= stepMs && guard++ < 6) { acc -= stepMs; if (!dead) step(); }
        } else acc = Math.min(acc, stepMs);
        if (eatFlash > 0) eatFlash = Math.max(0, eatFlash - dt / 260);

        draw(clamp(acc / stepMs, 0, 1));
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

    /* ---------------- 对外接口（手势 / 键盘 / 按钮） ---------------- */
    M.turn = turn;
    M.dir = turn;
    /* 供测试 / 外部读取当前状态 */
    M.state = function () {
      return { dir: { x: dir.x, y: dir.y }, score: score, dead: dead, paused: paused, len: snake.length, stepMs: stepMs };
    };

    /* 轻点画布：朝点击位置相对蛇头的方向转 */
    M.tap = function (cx, cy) {
        if (!cv || dead || paused) return;
        var r = cv.getBoundingClientRect();
        if (cx == null || cy == null) { cx = r.left + r.width / 2; cy = r.top + r.height / 2; }
        var hx = r.left + (snake[0].x + .5) * (r.width / COLS);
        var hy = r.top + (snake[0].y + .5) * (r.height / ROWS);
        var dx = cx - hx, dy = cy - hy;
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    };

    M.togglePause = function () {
        if (dead) return;
        paused = !paused;
        paintHud();
        GH.toast(paused ? t('toast.paused') : t('toast.resume'));
    };

    M.boot = function () {
        cv = $('gh-snake-cv');
        if (!cv) return;
        ctx = cv.getContext('2d');
        try { best = parseInt(localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) { best = 0; }
        reset();
        layout();

        if (window.ResizeObserver) {
            new ResizeObserver(function () { layout(); }).observe(cv);
        } else {
            window.addEventListener('resize', layout);
        }

        var pause = $('gh-snake-pause');
        if (pause) pause.addEventListener('click', M.togglePause);
        var nw = $('gh-snake-new'), on = $('gh-snake-over-new');
        if (nw) nw.addEventListener('click', function () { reset(); startLoop(); GH.toast(t('toast.newgame')); });
        if (on) on.addEventListener('click', function () { reset(); startLoop(); });

        document.addEventListener('keydown', function (e) {
            if (!GH.isOpen || GH.view !== 'snake') return;
            var k = e.key.toLowerCase();
            if (k === 'arrowleft' || k === 'a') { e.preventDefault(); turn('left'); }
            else if (k === 'arrowright' || k === 'd') { e.preventDefault(); turn('right'); }
            else if (k === 'arrowup' || k === 'w') { e.preventDefault(); turn('up'); }
            else if (k === 'arrowdown' || k === 's') { e.preventDefault(); turn('down'); }
            else if (k === ' ' || k === 'p') { e.preventDefault(); M.togglePause(); }
        });
    };

    M.onShow = function (onShow) {
        active = !!onShow;
        if (onShow) { layout(); startLoop(); }
        else stopLoop();
    };

    M.onTheme = function () { bgCv = null; bgKey = ''; draw(clamp(acc / stepMs, 0, 1)); };

    M.onLang = function () {
        paintHud();
        if (dead) {
            var tx = $('gh-snake-over-text');
            if (tx) tx.textContent = t('over.prefix') + score;
        }
    };

    M.pauseAll = function () { stopLoop(); };
    M.resumeAll = function () { if (active) startLoop(); };
})();
