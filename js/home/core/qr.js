/* qr.js —— 零依赖二维码生成器（字节模式，纠错等级 M，放不下自动降到 L，版本 1–40）
 * 用法：LZXQR.svg(text) → SVG 字符串；放不下返回 null。  LZXQR.matrix(text) → {size, get(x,y)} | null
 * 算法参照 ISO/IEC 18004：Reed–Solomon（GF(256) 0x11D）、8 种掩码按罚分择优。 */
(function () {
    'use strict';

    /* 每块纠错码字数 / 块数（索引 = 版本 1..40；0 位占位）。0 = Low，1 = Medium */
    var ECPB = [
        [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
        [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28]
    ];
    var NBLK = [
        [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
        [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49]
    ];
    var FMT_BITS = [1, 0];   /* 格式信息里的纠错等级位：L=01，M=00 */

    function rawModules(ver) {
        var r = (16 * ver + 128) * ver + 64;
        if (ver >= 2) {
            var na = Math.floor(ver / 7) + 2;
            r -= (25 * na - 10) * na - 55;
            if (ver >= 7) r -= 36;
        }
        return r;
    }
    function dataCodewords(ver, e) { return Math.floor(rawModules(ver) / 8) - ECPB[e][ver] * NBLK[e][ver]; }

    /* ---- Reed–Solomon ---- */
    function gmul(x, y) {
        var z = 0;
        for (var i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; }
        return z & 0xFF;
    }
    function rsDivisor(deg) {
        var r = [], i, j;
        for (i = 0; i < deg - 1; i++) r.push(0);
        r.push(1);
        var root = 1;
        for (i = 0; i < deg; i++) {
            for (j = 0; j < r.length; j++) {
                r[j] = gmul(r[j], root);
                if (j + 1 < r.length) r[j] ^= r[j + 1];
            }
            root = gmul(root, 2);
        }
        return r;
    }
    function rsRemainder(data, div) {
        var r = div.map(function () { return 0; });
        data.forEach(function (b) {
            var f = b ^ r.shift();
            r.push(0);
            div.forEach(function (c, i) { r[i] ^= gmul(c, f); });
        });
        return r;
    }

    function addEccAndInterleave(data, ver, e) {
        var nb = NBLK[e][ver], el = ECPB[e][ver];
        var raw = Math.floor(rawModules(ver) / 8);
        var nShort = nb - raw % nb, shortLen = Math.floor(raw / nb);
        var blocks = [], div = rsDivisor(el), i, k = 0;
        for (i = 0; i < nb; i++) {
            var dat = data.slice(k, k + shortLen - el + (i < nShort ? 0 : 1));
            k += dat.length;
            var ecc = rsRemainder(dat, div);
            if (i < nShort) dat.push(0);
            blocks.push(dat.concat(ecc));
        }
        var out = [];
        for (i = 0; i < blocks[0].length; i++) {
            blocks.forEach(function (b, j) { if (i !== shortLen - el || j >= nShort) out.push(b[i]); });
        }
        return out;
    }

    function utf8(text) {
        if (window.TextEncoder) return Array.prototype.slice.call(new TextEncoder().encode(text));
        var s = unescape(encodeURIComponent(text)), o = [];
        for (var i = 0; i < s.length; i++) o.push(s.charCodeAt(i));
        return o;
    }

    function bit(x, i) { return ((x >>> i) & 1) !== 0; }

    function build(bytes, ver, e) {
        var size = ver * 4 + 17, i, j;
        var m = [], fn = [];
        for (i = 0; i < size; i++) { m.push(new Array(size).fill(false)); fn.push(new Array(size).fill(false)); }
        function setFn(x, y, dark) { m[y][x] = dark; fn[y][x] = true; }

        /* 数据位流 */
        var bits = [];
        function put(val, len) { for (var b = len - 1; b >= 0; b--) bits.push((val >>> b) & 1); }
        put(4, 4); put(bytes.length, ver < 10 ? 8 : 16);
        bytes.forEach(function (b) { put(b, 8); });
        var cap = dataCodewords(ver, e) * 8;
        put(0, Math.min(4, cap - bits.length));
        put(0, (8 - bits.length % 8) % 8);
        for (var pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) put(pad, 8);
        var data = [];
        for (i = 0; i < bits.length; i += 8) {
            var v = 0; for (j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
            data.push(v);
        }
        var all = addEccAndInterleave(data, ver, e);

        /* 功能图形 */
        for (i = 0; i < size; i++) { setFn(6, i, i % 2 === 0); setFn(i, 6, i % 2 === 0); }
        function finder(cx, cy) {
            for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
                var d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy;
                if (x >= 0 && x < size && y >= 0 && y < size) setFn(x, y, d !== 2 && d !== 4);
            }
        }
        finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
        var pos = [];
        if (ver > 1) {
            var na = Math.floor(ver / 7) + 2;
            var step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (na * 2 - 2)) * 2;
            pos = [6];
            for (var p = size - 7; pos.length < na; p -= step) pos.splice(1, 0, p);
        }
        pos.forEach(function (cx, a) {
            pos.forEach(function (cy, b) {
                if ((a === 0 && b === 0) || (a === 0 && b === pos.length - 1) || (a === pos.length - 1 && b === 0)) return;
                for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) setFn(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
            });
        });
        function drawFormat(mask) {
            var d = (FMT_BITS[e] << 3) | mask, rem = d;
            for (var r = 0; r < 10; r++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
            var b = ((d << 10) | rem) ^ 0x5412, k;
            for (k = 0; k <= 5; k++) setFn(8, k, bit(b, k));
            setFn(8, 7, bit(b, 6)); setFn(8, 8, bit(b, 7)); setFn(7, 8, bit(b, 8));
            for (k = 9; k < 15; k++) setFn(14 - k, 8, bit(b, k));
            for (k = 0; k < 8; k++) setFn(size - 1 - k, 8, bit(b, k));
            for (k = 8; k < 15; k++) setFn(8, size - 15 + k, bit(b, k));
            setFn(8, size - 8, true);
        }
        drawFormat(0);
        if (ver >= 7) {
            var rem = ver;
            for (i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
            var vb = (ver << 12) | rem;
            for (i = 0; i < 18; i++) {
                var dark = bit(vb, i), a = size - 11 + i % 3, b2 = Math.floor(i / 3);
                setFn(a, b2, dark); setFn(b2, a, dark);
            }
        }

        /* 数据区蛇形填充 */
        var k2 = 0;
        for (var right = size - 1; right >= 1; right -= 2) {
            if (right === 6) right = 5;
            for (var vert = 0; vert < size; vert++) {
                for (j = 0; j < 2; j++) {
                    var x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
                    if (!fn[y][x] && k2 < all.length * 8) { m[y][x] = bit(all[k2 >>> 3], 7 - (k2 & 7)); k2++; }
                }
            }
        }

        function applyMask(mask) {
            for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) {
                var inv;
                switch (mask) {
                    case 0: inv = (x + y) % 2 === 0; break;
                    case 1: inv = y % 2 === 0; break;
                    case 2: inv = x % 3 === 0; break;
                    case 3: inv = (x + y) % 3 === 0; break;
                    case 4: inv = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
                    case 5: inv = x * y % 2 + x * y % 3 === 0; break;
                    case 6: inv = (x * y % 2 + x * y % 3) % 2 === 0; break;
                    default: inv = ((x + y) % 2 + x * y % 3) % 2 === 0;
                }
                if (!fn[y][x] && inv) m[y][x] = !m[y][x];
            }
        }
        function penalty() {
            var score = 0, x, y, run, line, dark = 0;
            var pA = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], pB = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
            function scan(get) {
                for (var a = 0; a < size; a++) {
                    run = 1;
                    line = [];
                    for (var b = 0; b < size; b++) {
                        var v = get(a, b) ? 1 : 0;
                        line.push(v);
                        if (b > 0) {
                            if (v === line[b - 1]) { run++; if (run === 5) score += 3; else if (run > 5) score++; } else run = 1;
                        }
                    }
                    for (var s = 0; s + 11 <= size; s++) {
                        var ma = true, mb = true;
                        for (var t = 0; t < 11 && (ma || mb); t++) { if (line[s + t] !== pA[t]) ma = false; if (line[s + t] !== pB[t]) mb = false; }
                        if (ma || mb) score += 40;
                    }
                }
            }
            scan(function (a, b) { return m[a][b]; });
            scan(function (a, b) { return m[b][a]; });
            for (y = 0; y < size - 1; y++) for (x = 0; x < size - 1; x++) {
                var c = m[y][x];
                if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) score += 3;
            }
            for (y = 0; y < size; y++) for (x = 0; x < size; x++) if (m[y][x]) dark++;
            var total = size * size;
            score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
            return score;
        }
        var best = 0, bestScore = Infinity;
        for (var mk = 0; mk < 8; mk++) {
            applyMask(mk); drawFormat(mk);
            var sc = penalty();
            if (sc < bestScore) { bestScore = sc; best = mk; }
            applyMask(mk);   /* 异或还原 */
        }
        applyMask(best); drawFormat(best);
        return { size: size, get: function (x, y) { return x >= 0 && y >= 0 && x < size && y < size && m[y][x]; } };
    }

    /* 选能放下的最小版本；优先 M，放不下再退到 L */
    function matrix(text) {
        var bytes = utf8(String(text));
        for (var e = 1; e >= 0; e--) {
            for (var ver = 1; ver <= 40; ver++) {
                var need = 4 + (ver < 10 ? 8 : 16) + bytes.length * 8;
                if (need <= dataCodewords(ver, e) * 8) return build(bytes, ver, e);
            }
        }
        return null;
    }

    function svg(text, opt) {
        opt = opt || {};
        var q = matrix(text);
        if (!q) return null;
        var border = opt.border == null ? 4 : opt.border, n = q.size + border * 2;
        var d = '', x, y, run;
        for (y = 0; y < q.size; y++) {
            for (x = 0; x < q.size; x++) {
                if (!q.get(x, y)) continue;
                run = 1; while (x + run < q.size && q.get(x + run, y)) run++;
                d += 'M' + (x + border) + ',' + (y + border) + 'h' + run + 'v1h-' + run + 'z';
                x += run - 1;
            }
        }
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n + ' ' + n + '" shape-rendering="crispEdges" role="img" aria-label="' + (opt.label || 'QR code') + '">' +
            '<rect width="' + n + '" height="' + n + '" fill="' + (opt.light || '#fff') + '"/><path d="' + d + '" fill="' + (opt.dark || '#000') + '"/></svg>';
    }

    window.LZXQR = { svg: svg, matrix: matrix, maxBytes: function () { return dataCodewords(40, 0) - 3; } };
})();
