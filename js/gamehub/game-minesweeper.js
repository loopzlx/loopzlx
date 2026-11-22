/* game-minesweeper.js —— 扫雷：三档难度、首击安全、右键/长按插旗、计时 */
(function () {
    'use strict';
    var GH = window.GH = window.GH || {};
    var M = GH.Mines = {};

    var DIFF = {
        easy:   { cols: 9,  rows: 9,  mines: 10, label: '初级' },
        medium: { cols: 16, rows: 16, mines: 40, label: '中级' },
        hard:   { cols: 30, rows: 16, mines: 99, label: '高级' }
    };

    var diff = 'easy', cols = 9, rows = 9, mineTotal = 10;
    var board = [],      // {mine, open, flag, near}
        nodes = [],
        started = false, dead = false, cleared = false,
        openCount = 0, flagCount = 0, timer = 0, clock = 0;

    function $(id) { return document.getElementById(id); }
    function t(k) { return GH.t ? GH.t(k) : k; }
    var lastOver = { text: '', on: false };

    function idx(r, c) { return r * cols + c; }

    function resetData() {
        board = [];
        for (var i = 0; i < cols * rows; i++) board.push({ mine: false, open: false, flag: false, near: 0 });
        nodes = [];
        started = false; dead = false; cleared = false;
        openCount = 0; flagCount = 0; clock = 0;
        clearInterval(timer); timer = 0;
        var t = $('gh-mines-time'); if (t) t.textContent = '0';
        var ov = $('gh-mines-over'); if (ov) ov.classList.remove('is-on');
        paintLeft();
    }

    function paintLeft() {
        var el = $('gh-mines-left');
        if (el) el.textContent = String(Math.max(0, mineTotal - flagCount));
    }

    function neighbors(i) {
        var r = Math.floor(i / cols), c = i % cols, out = [];
        for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) {
            if (!dr && !dc) continue;
            var rr = r + dr, cc = c + dc;
            if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) out.push(idx(rr, cc));
        }
        return out;
    }

    /* 首次点击后再布雷，保证首击与其邻格无雷 */
    function layMines(safeIdx) {
        var safe = [safeIdx].concat(neighbors(safeIdx));
        var pool = [];
        for (var i = 0; i < board.length; i++) if (safe.indexOf(i) < 0) pool.push(i);
        var need = Math.min(mineTotal, pool.length);
        for (var k = 0; k < need; k++) {
            var pick = Math.floor(Math.random() * pool.length);
            board[pool[pick]].mine = true;
            pool.splice(pick, 1);
        }
        for (var j = 0; j < board.length; j++) {
            if (board[j].mine) continue;
            var n = neighbors(j), count = 0;
            for (var m = 0; m < n.length; m++) if (board[n[m]].mine) count++;
            board[j].near = count;
        }
    }

    function tickStart() {
        if (timer) return;
        timer = setInterval(function () {
            clock++;
            var t = $('gh-mines-time');
            if (t) t.textContent = String(clock);
        }, 1000);
    }

    function drawNode(i) {
        var cell = board[i], el = nodes[i];
        if (!el) return;
        var cls = 'gh-mine';
        var txt = '';
        if (cell.open) {
            cls += ' is-open';
            if (cell.mine) { cls += ' is-boom'; txt = '✹'; }
            else if (cell.near) { cls += ' n' + cell.near; txt = String(cell.near); }
            el.disabled = true;
        } else if (cell.flag) { cls += ' is-flag'; txt = '⚑'; }
        el.className = cls;
        el.textContent = txt;
    }

    function reveal(i) {
        if (dead || cleared) return;
        var cell = board[i];
        if (cell.open || cell.flag) return;
        if (!started) { started = true; layMines(i); tickStart(); }

        if (cell.mine) {
            cell.open = true;
            drawNode(i);
            dead = true;
            clearInterval(timer); timer = 0;
            for (var k = 0; k < board.length; k++) if (board[k].mine && !board[k].flag) { board[k].open = true; drawNode(k); }
            var ov = $('gh-mines-over'), tx = $('gh-mines-over-text');
            if (tx) tx.textContent = t('mines.boom') + ' · ' + clock + 's';
            if (ov) ov.classList.add('is-on');
            GH.log && GH.log('mines · boom at ' + clock + 's');
            return;
        }

        /* 0 格自动洪水展开（用栈，不用递归） */
        var stack = [i];
        while (stack.length) {
            var cur = stack.pop();
            var c2 = board[cur];
            if (c2.open || c2.flag) continue;
            c2.open = true;
            openCount++;
            drawNode(cur);
            if (!c2.near) {
                var nb = neighbors(cur);
                for (var n = 0; n < nb.length; n++) if (!board[nb[n]].open && !board[nb[n]].flag) stack.push(nb[n]);
            }
        }
        if (openCount >= board.length - mineTotal) {
            cleared = true;
            clearInterval(timer); timer = 0;
            var ov2 = $('gh-mines-over'), tx2 = $('gh-mines-over-text');
            if (tx2) tx2.textContent = t('mines.cleared') + ' · ' + clock + 's';
            if (ov2) ov2.classList.add('is-on');
            if (window.LZXAch) window.LZXAch.unlock('gh-sweep');
            GH.log && GH.log('mines · cleared in ' + clock + 's');
        }
    }

    function toggleFlag(i) {
        if (dead || cleared) return;
        var cell = board[i];
        if (cell.open) return;
        cell.flag = !cell.flag;
        flagCount += cell.flag ? 1 : -1;
        drawNode(i);
        paintLeft();
    }

    function build() {
        cols = DIFF[diff].cols; rows = DIFF[diff].rows; mineTotal = DIFF[diff].mines;
        resetData();
        var wrap = $('gh-mines-board');
        if (!wrap) return;
        wrap.style.gridTemplateColumns = 'repeat(' + cols + ', var(--gh-mine, 28px))';
        wrap.innerHTML = '';
        var frag = document.createDocumentFragment();
        for (var i = 0; i < cols * rows; i++) {
            var el = document.createElement('button');
            el.type = 'button';
            el.className = 'gh-mine';
            el.setAttribute('data-i', String(i));
            frag.appendChild(el);
            nodes.push(el);
        }
        wrap.appendChild(frag);
    }

    M.boot = function () {
        build();

        var wrap = $('gh-mines-board');
        var pressTimer = 0, suppressClickUntil = 0;

        /* 指针事件：鼠标右键插旗；触屏长按插旗 */
        wrap.addEventListener('contextmenu', function (e) {
            e.preventDefault();
            var el = e.target.closest('.gh-mine');
            if (!el) return;
            toggleFlag(parseInt(el.getAttribute('data-i'), 10));
            if (typeof navigator.vibrate === 'function') navigator.vibrate(18);
        });

        wrap.addEventListener('pointerdown', function (e) {
            var el = e.target.closest('.gh-mine');
            if (!el || e.button !== 0) return;
            var i = parseInt(el.getAttribute('data-i'), 10);
            clearTimeout(pressTimer);
            if (e.pointerType === 'mouse') return;
            pressTimer = setTimeout(function () {
                suppressClickUntil = Date.now() + 450;
                toggleFlag(i);
                if (typeof navigator.vibrate === 'function') navigator.vibrate(18);
            }, 480);
        });
        wrap.addEventListener('pointerup', function () { clearTimeout(pressTimer); });
        wrap.addEventListener('pointercancel', function () { clearTimeout(pressTimer); });

        /* 单击（鼠标与触屏统一走 click；长按插旗后短暂抑制） */
        wrap.addEventListener('click', function (e) {
            if (Date.now() < suppressClickUntil) return;
            var el = e.target.closest('.gh-mine');
            if (!el) return;
            reveal(parseInt(el.getAttribute('data-i'), 10));
        });

        Array.prototype.forEach.call(document.querySelectorAll('#gh-mines-diff .gh-chip'), function (chip) {
            chip.addEventListener('click', function () {
                diff = chip.getAttribute('data-diff');
                Array.prototype.forEach.call(document.querySelectorAll('#gh-mines-diff .gh-chip'), function (c) {
                    c.classList.toggle('is-on', c === chip);
                });
                build();
                GH.log && GH.log('mines · ' + DIFF[diff].label + ' ' + cols + '×' + rows + ' / ' + mineTotal);
            });
        });

        var restart = $('gh-mines-restart'), orestart = $('gh-mines-over-restart');
        if (restart) restart.addEventListener('click', function () { build(); GH.toast('RESTART'); });
        if (orestart) orestart.addEventListener('click', function () { build(); });
    };

    M.onShow = function (active) {
        if (!active && timer) { clearInterval(timer); timer = 0; }
    };

    M.onLang = function () {
        var tx = $('gh-mines-over-text');
        if (tx && (dead || cleared)) tx.textContent = (dead ? t('mines.boom') : t('mines.cleared')) + ' · ' + clock + 's';
    };

    M.onTheme = function () {};
})();
