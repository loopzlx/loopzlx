/* game-2048.js —— 4×4 合并数字：滑动动画 / 合并弹跳 / 输入队列 / 撤销 20 步
   手势由 gamehub-core.js 的整屏 pointer 手势统一分发（dir / tap），桌面端鼠标拖拽同样生效 */
(function () {
    'use strict';
    var GH = window.GH = window.GH || {};
    var M = GH.G2048 = {};

    var N = 4, SIZE = N * N;
    var BEST_KEY = 'gh_2048_best';
    var SAVE_KEY = 'gh_2048_save_v1';
    var TRANS = 110;       // 与 CSS transition 时长保持一致

    var grid = [], score = 0, best = 0, hist = [], over = false, wonShown = false;
    var tiles = [];        // 每格一个 { el, face, v }，空格为 null
    var boardEl = null, layer = null;
    var busy = false, pendingQ = [];    // 过渡期间的输入排队（最多 2 步），避免连按丢步
    function $(id) { return document.getElementById(id); }
    function t(k) { return GH.t ? GH.t(k) : k; }
    function zero() { var a = []; for (var i = 0; i < SIZE; i++) a.push(0); return a; }
    function rc(i) { return { r: Math.floor(i / N), c: i % N }; }
    function xy(i) { var p = rc(i); return 'translate(' + (p.c * 100) + '%,' + (p.r * 100) + '%)'; }

    function tierClass(v) {
        if (!v) return '';
        if (v <= 1024) return 't' + v;
        return 't2048plus';
    }

    function makeTile(v, idx, isNew) {
        var el = document.createElement('div');
        el.className = 'gh-tile' + (isNew ? ' is-new' : '');
        var face = document.createElement('div');
        face.className = 'gh-tile-face ' + tierClass(v);
        face.textContent = String(v);
        el.appendChild(face);
        el.style.transform = xy(idx);
        var t2 = { el: el, face: face, v: v };
        layer.appendChild(el);
        tiles[idx] = t2;
        return t2;
    }

    function setFace(tl, v, pop) {
        tl.v = v;
        tl.face.className = 'gh-tile-face ' + tierClass(v);
        tl.face.textContent = String(v);
        if (pop) {
            tl.el.classList.remove('is-merged');
            void tl.el.offsetWidth;
            tl.el.classList.add('is-merged');
        }
    }

    /* 背景空格 */
    function buildBg() {
        var bg = $('gh-2048-bg');
        if (!bg || bg.children.length) return;
        for (var i = 0; i < SIZE; i++) {
            var d = document.createElement('div');
            d.className = 'gh-cell';
            bg.appendChild(d);
        }
    }

    function paintHud() {
        var s = $('gh-2048-score'); if (s) s.textContent = String(score);
        var b = $('gh-2048-best'); if (b) b.textContent = String(best);
        var u = $('gh-2048-undo'); if (u) u.disabled = !hist.length;
        var ou = $('gh-2048-over-undo'); if (ou) ou.disabled = !hist.length;
    }

    function addRandomTile() {
        var free = [];
        for (var i = 0; i < SIZE; i++) if (!grid[i]) free.push(i);
        if (!free.length) return;
        var idx = free[Math.floor(Math.random() * free.length)];
        var v = Math.random() < 0.9 ? 2 : 4;
        grid[idx] = v;
        makeTile(v, idx, true);
    }

    function saveBest() {
        if (score > best) { best = score; try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) {} }
        if (window.LZXAch) {
            for (var gi = 0; gi < grid.length; gi++) { if (grid[gi] >= 2048) { window.LZXAch.unlock('gh-2048'); break; } }
        }
    }

    function clearBoard() {
        grid = zero();
        tiles = [];
        if (layer) layer.innerHTML = '';
        var ov = $('gh-2048-over');
        if (ov) ov.classList.remove('is-on');
    }

    function saveGame() {
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify({ g: grid, s: score, o: over, h: hist.slice(-3) }));
        } catch (e) {}
    }
    function loadGame() {
        try {
            var o = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
            if (!o || !o.g || o.g.length !== SIZE) return false;
            if (!o.g.some(function (v) { return v > 0; })) return false;
            grid = o.g.slice();
            score = o.s || 0;
            over = !!o.o;
            hist = Array.isArray(o.h) ? o.h : [];
            rebuildFromState();
            paintHud();
            if (over) {
                var ov = $('gh-2048-over'), tx = $('gh-2048-over-text');
                if (tx) tx.textContent = (GH.t ? GH.t('over.moves') : 'NO MORE MOVES · ') + score;
                if (ov) ov.classList.add('is-on');
            }
            GH.log && GH.log('2048 · resumed · ' + score);
            return true;
        } catch (e) { return false; }
    }

    function newGame() {
        clearBoard();
        score = 0; hist = []; over = false; wonShown = false; M.wonFlag = false;
        try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
        busy = false; pendingQ = [];
        addRandomTile(); addRandomTile();
        paintHud();
        GH.log && GH.log('2048 · new game');
    }

    /* 每行/列按方向取索引（正序 = 移动方向的最前方） */
    function lineIdx(dir, k) {
        var out = [];
        for (var i = 0; i < N; i++) {
            if (dir === 'left') out.push(k * N + i);
            else if (dir === 'right') out.push(k * N + (N - 1 - i));
            else if (dir === 'up') out.push(i * N + k);
            else out.push((N - 1 - i) * N + k);
        }
        return out;
    }

    M.move = function (dir) {
        if (!grid.length || over) return;
        if (busy) { pendingQ.push(dir); if (pendingQ.length > 2) pendingQ.shift(); return; }   // 动画中：排队
        busy = true;

        var snapshot = { g: grid.slice(), s: score };
        var moved = false, merges = [], absorbed = [], gained = 0;

        for (var k = 0; k < N; k++) {
            var cells = lineIdx(dir, k);
            var items = [];
            for (var i = 0; i < N; i++) {
                var ci = cells[i];
                if (grid[ci] && tiles[ci]) items.push({ v: grid[ci], tile: tiles[ci], from: ci });
            }
            var res = [];
            for (var j = 0; j < items.length; j++) {
                var top = res[res.length - 1];
                if (top && top.v === items[j].v && !top.merged) {
                    top.v *= 2;
                    top.merged = true;
                    top.absorb.push(items[j].tile);
                    gained += top.v;
                    if (top.v >= 2048) wonShown = true;
                    moved = true;
                } else {
                    res.push({ v: items[j].v, tile: items[j].tile, from: items[j].from, merged: false, absorb: [] });
                }
            }
            for (var c = 0; c < N; c++) tiles[cells[c]] = null;
            for (var d = 0; d < N; d++) grid[cells[d]] = 0;

            for (var m = 0; m < res.length; m++) {
                var target = cells[m];
                var r = res[m];
                if (r.from !== target) moved = true;
                r.absorb.forEach(function (at) {
                    at.el.style.transform = xy(target);
                    absorbed.push(at.el);
                });
                r.tile.el.style.transform = xy(target);
                grid[target] = r.v;
                tiles[target] = r.tile;
                if (r.merged) merges.push({ tile: r.tile, v: r.v });
                else if (r.tile.v !== r.v) setFace(r.tile, r.v, false);
            }
        }

        if (!moved) {
            busy = false; pendingQ = [];
            return;
        }

        hist.push(snapshot);
        if (hist.length > 20) hist.shift();
        score = snapshot.s + gained;
        saveBest();

        setTimeout(function () {
            merges.forEach(function (mg) { setFace(mg.tile, mg.v, true); });
            addRandomTile();          /* 等滑动动画落定后再冒新块，跟手不突兀 */
        }, TRANS);

        setTimeout(function () {
            absorbed.forEach(function (el) { if (el.parentNode) el.parentNode.removeChild(el); });
        }, TRANS + 20);

        paintHud();

        if (wonShown && !M.wonFlag) {
            M.wonFlag = true;
            GH.toast(GH.t ? GH.t('toast.reached') : '2048 REACHED');
            GH.log && GH.log('2048 · reached 2048');
        }

        /* 动画结束后结算：还能不能动 / 处理排队的下一步 */
        setTimeout(function () {
            busy = false;
            if (!canMove()) {
                over = true;
                pendingQ = [];
                var ov = $('gh-2048-over'), tx = $('gh-2048-over-text');
                if (tx) tx.textContent = (GH.t ? GH.t('over.moves') : 'NO MORE MOVES · ') + score;
                if (ov) ov.classList.add('is-on');
                GH.log && GH.log('2048 · game over · ' + score);
                return;
            }
            if (pendingQ.length) M.move(pendingQ.shift());
            saveGame();
        }, TRANS + 30);
    };

    /* 手势 / 键盘统一入口 */
    M.dir = function (d) { M.move(d); };
    M.onTheme = function () {};

    function canMove() {
        for (var i = 0; i < SIZE; i++) if (!grid[i]) return true;
        for (var r = 0; r < N; r++) {
            for (var c = 0; c < N; c++) {
                var v = grid[r * N + c];
                if (!v) continue;
                if (c + 1 < N && grid[r * N + c + 1] === v) return true;
                if (r + 1 < N && grid[(r + 1) * N + c] === v) return true;
            }
        }
        return false;
    }

    function rebuildFromState() {
        if (layer) layer.innerHTML = '';
        tiles = [];
        for (var i = 0; i < SIZE; i++) {
            if (grid[i]) makeTile(grid[i], i, false);
        }
    }

    M.undo = function () {
        if (!hist.length) { GH.toast(GH.t ? GH.t('toast.nohistory') : 'NO HISTORY'); return; }
        var s = hist.pop();
        grid = s.g.slice();
        score = s.s;
        over = false;
        busy = false; pendingQ = [];
        rebuildFromState();
        paintHud();
        var ov = $('gh-2048-over');
        if (ov) ov.classList.remove('is-on');
        GH.toast(GH.t ? GH.t('toast.undo') : 'UNDO');
    };

    M.boot = function () {
        boardEl = $('gh-2048-board');
        layer = $('gh-2048-tiles');
        buildBg();
        try { best = parseInt(localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) { best = 0; }
        if (!loadGame()) newGame();

        var undo = $('gh-2048-undo'), news = $('gh-2048-new');
        var ou = $('gh-2048-over-undo'), on = $('gh-2048-over-new');
        if (undo) undo.addEventListener('click', M.undo);
        if (ou) ou.addEventListener('click', M.undo);
        if (news) news.addEventListener('click', function () { newGame(); GH.toast(GH.t ? GH.t('toast.newgame') : 'NEW GAME'); });
        if (on) on.addEventListener('click', function () { newGame(); });

        document.addEventListener('keydown', function (e) {
            if (!GH.isOpen || GH.view !== 'g2048') return;
            var k = e.key.toLowerCase();
            if (k === 'arrowleft' || k === 'a') { e.preventDefault(); M.move('left'); }
            else if (k === 'arrowright' || k === 'd') { e.preventDefault(); M.move('right'); }
            else if (k === 'arrowup' || k === 'w') { e.preventDefault(); M.move('up'); }
            else if (k === 'arrowdown' || k === 's') { e.preventDefault(); M.move('down'); }
            else if (k === 'z' || k === 'backspace') { e.preventDefault(); M.undo(); }
        });
    };

    M.onShow = function (active) {
        if (active) {
            paintHud();
            /* 回到 2048 时把键盘焦点从按钮上摘掉，避免空格/方向键误触 */
            if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
        }
    };

    M.onLang = function () {
        if (over) {
            var tx = $('gh-2048-over-text');
            if (tx) tx.textContent = (GH.t ? GH.t('over.moves') : 'NO MORE MOVES · ') + score;
        }
    };

    M.wonFlag = false;
})();
