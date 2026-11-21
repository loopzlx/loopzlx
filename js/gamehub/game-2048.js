/* game-2048.js —— 4×4 合并数字，支持撤销（20 步历史） */
(function () {
    'use strict';
    var GH = window.GH = window.GH || {};
    var M = GH.G2048 = {};

    var N = 4, SIZE = N * N;
    var BEST_KEY = 'gh_2048_best';
    var grid = [], score = 0, best = 0, hist = [], over = false, won = false;
    var cells = [];     // 复用的 DOM 节点，只改 class / text，避免每步重建

    function $(id) { return document.getElementById(id); }

    function empty() { var a = []; for (var i = 0; i < SIZE; i++) a.push(0); return a; }

    function buildBoard() {
        var board = $('gh-2048-board');
        if (!board || cells.length) return;
        board.innerHTML = '';
        for (var i = 0; i < SIZE; i++) {
            var d = document.createElement('div');
            d.className = 'gh-cell';
            board.appendChild(d);
            cells.push(d);
        }
    }

    function render(mergeIdx) {
        for (var i = 0; i < SIZE; i++) {
            var v = grid[i];
            var c = cells[i];
            var cls = 'gh-cell';
            if (v) {
                if (v === 2) cls += ' t2';
                else if (v === 4) cls += ' t4';
                else if (v === 8) cls += ' t8';
                else if (v === 16) cls += ' t16';
                else if (v === 32) cls += ' t32';
                else if (v === 64) cls += ' t64';
                else if (v === 128) cls += ' t128';
                else if (v === 256) cls += ' t256';
                else if (v === 512) cls += ' t512';
                else if (v === 1024) cls += ' t1024';
                else cls += ' t2048plus';
            }
            c.className = cls;
            c.textContent = v ? String(v) : '';
        }
        var s = $('gh-2048-score'); if (s) s.textContent = String(score);
        var b = $('gh-2048-best'); if (b) b.textContent = String(best);
        var u = $('gh-2048-undo'); if (u) u.disabled = !hist.length;
        var ou = $('gh-2048-over-undo'); if (ou) ou.disabled = !hist.length;
    }

    function emptyIdx() {
        var list = [];
        for (var i = 0; i < SIZE; i++) if (!grid[i]) list.push(i);
        return list;
    }

    function addTile() {
        var list = emptyIdx();
        if (!list.length) return;
        var idx = list[Math.floor(Math.random() * list.length)];
        grid[idx] = Math.random() < 0.9 ? 2 : 4;
    }

    function saveBest() {
        if (score > best) {
            best = score;
            try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) {}
        }
    }

    function newGame() {
        grid = empty();
        score = 0;
        hist = [];
        over = false;
        won = false;
        addTile(); addTile();
        var ov = $('gh-2048-over');
        if (ov) ov.classList.remove('is-on');
        render();
        GH.log && GH.log('2048 · new game');
    }

    /* 按方向把一维行/列取出来 → 向左压合并 → 写回 */
    function indices(dir, line) {
        var out = [];
        for (var i = 0; i < N; i++) {
            var r, c;
            if (dir === 'left') { r = line; c = i; }
            else if (dir === 'right') { r = line; c = N - 1 - i; }
            else if (dir === 'up') { r = i; c = line; }
            else { r = N - 1 - i; c = line; }
            out.push(r * N + c);
        }
        return out;
    }

    function slideLine(idx) {
        var vals = [];
        for (var i = 0; i < idx.length; i++) if (grid[idx[i]]) vals.push(grid[idx[i]]);
        var merged = [], gained = 0, made = false;
        for (var j = 0; j < vals.length; j++) {
            if (j + 1 < vals.length && vals[j] === vals[j + 1]) {
                var v = vals[j] * 2;
                merged.push(v);
                gained += v;
                if (v === 2048) won = true;
                j++;
            } else merged.push(vals[j]);
        }
        while (merged.length < idx.length) merged.push(0);
        for (var k = 0; k < idx.length; k++) {
            if (grid[idx[k]] !== merged[k]) made = true;
            grid[idx[k]] = merged[k];
        }
        score += gained;
        return made;
    }

    function canMove() {
        for (var i = 0; i < SIZE; i++) if (!grid[i]) return true;
        for (var r = 0; r < N; r++) {
            for (var c = 0; c < N; c++) {
                var v = grid[r * N + c];
                if (c + 1 < N && grid[r * N + c + 1] === v) return true;
                if (r + 1 < N && grid[(r + 1) * N + c] === v) return true;
            }
        }
        return false;
    }

    M.move = function (dir) {
        if (!grid.length || over) return;
        var snapshot = { g: grid.slice(), s: score };
        var made = false;
        for (var line = 0; line < N; line++) if (slideLine(indices(dir, line))) made = true;
        if (!made) return;
        hist.push(snapshot);
        if (hist.length > 20) hist.shift();
        addTile();
        saveBest();
        render();
        if (won && !GH['2048_won_shown']) {
            GH['2048_won_shown'] = true;
            GH.toast('2048 REACHED');
            GH.log && GH.log('2048 · reached 2048!');
        }
        if (!canMove()) {
            over = true;
            var ov = $('gh-2048-over');
            var txt = $('gh-2048-over-text');
            if (txt) txt.textContent = 'NO MORE MOVES · ' + score;
            if (ov) ov.classList.add('is-on');
            GH.log && GH.log('2048 · game over · ' + score);
        }
    };

    M.undo = function () {
        if (!hist.length) { GH.toast('NO HISTORY'); return; }
        var s = hist.pop();
        grid = s.g.slice();
        score = s.s;
        over = false;
        var ov = $('gh-2048-over');
        if (ov) ov.classList.remove('is-on');
        render();
        GH.toast('UNDO');
    };

    M.boot = function () {
        buildBoard();
        try { best = parseInt(localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) { best = 0; }
        newGame();

        var undo = $('gh-2048-undo'), news = $('gh-2048-new');
        var ou = $('gh-2048-over-undo'), on = $('gh-2048-over-new');
        if (undo) undo.addEventListener('click', M.undo);
        if (ou) ou.addEventListener('click', M.undo);
        if (news) news.addEventListener('click', function () { newGame(); GH.toast('NEW GAME'); });
        if (on) on.addEventListener('click', function () { newGame(); });

        document.addEventListener('keydown', function (e) {
            if (!GH.isOpen || GH.view !== 'g2048') return;
            var k = e.key.toLowerCase();
            var dir = '';
            if (k === 'arrowleft' || k === 'a') dir = 'left';
            else if (k === 'arrowright' || k === 'd') dir = 'right';
            else if (k === 'arrowup' || k === 'w') dir = 'up';
            else if (k === 'arrowdown' || k === 's') dir = 'down';
            else if (k === 'z') { e.preventDefault(); M.undo(); return; }
            if (dir) { e.preventDefault(); M.move(dir); }
        });

        /* 触屏滑动 */
        var board = $('gh-2048-board');
        var sx = 0, sy = 0, tracking = false;
        if (board) {
            board.addEventListener('touchstart', function (e) {
                if (!e.touches.length) return;
                sx = e.touches[0].clientX; sy = e.touches[0].clientY; tracking = true;
            }, { passive: true });
            board.addEventListener('touchend', function (e) {
                if (!tracking) return;
                tracking = false;
                var t = e.changedTouches[0];
                var dx = t.clientX - sx, dy = t.clientY - sy;
                if (Math.abs(dx) < 26 && Math.abs(dy) < 26) return;
                if (Math.abs(dx) > Math.abs(dy)) M.move(dx > 0 ? 'right' : 'left');
                else M.move(dy > 0 ? 'down' : 'up');
            }, { passive: true });
        }
    };

    M.onShow = function (active) {
        if (active) render();
    };
})();
