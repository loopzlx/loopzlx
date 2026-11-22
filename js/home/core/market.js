/* =========================================================
   Market Feed · 行情模块
   依赖：无（原生 JS），配色取自站点 CSS 变量
   ========================================================= */
(function () {
    'use strict';

    var $ = function (id) { return document.getElementById(id); };
    function L() { return document.documentElement.lang === 'zh-CN' ? 'zh' : 'en'; }
    function T(o) { return o[L()] || o.en; }

    function fmt(v, d) {
        var s = Number(v).toFixed(d === undefined ? 2 : d).split('.');
        s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return s.join('.');
    }
    function sgn(v, d) { return (v > 0 ? '+' : '') + Number(v).toFixed(d === undefined ? 2 : d); }
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function refDate(str) {
        var d = new Date(str);
        if (isNaN(d.getTime())) return String(str).slice(0, 16);
        return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
    }
    function clock(dt) { return pad(dt.getHours()) + ':' + pad(dt.getMinutes()) + ':' + pad(dt.getSeconds()); }

    /* ---------- 数据 ---------- */
    var METALS = [
        { n: { en: 'London Gold Spot', zh: '伦敦金现' }, s: { en: 'Intl spot · USD/oz', zh: '国际现货 · 美元/盎司' },
          v: 3569.48, dp: 2, c: -1.04, d: -37.66, live: 'XAU', base: 3607.14 },
        { n: { en: 'Gold T+D', zh: '黄金 T+D' }, s: { en: 'SGE spot · CNY/g', zh: '上海金交所 · 元/克' },
          v: 767.53, dp: 2, c: 0.04, d: 0.30 },
        { n: { en: 'SHFE Gold', zh: '沪金主力' }, s: { en: 'SHFE futures · CNY/g', zh: '上海黄金期货 · 元/克' },
          v: 767.92, dp: 2, c: -1.30, d: -10.14 },
        { n: { en: 'CCB Gold Bar', zh: '建行投资金条' }, s: { en: 'Bank bar · est · CNY/g', zh: '银行金条 · 估算 · 元/克' },
          v: 780.80, dp: 2, c: -5.17, d: -42.58, est: 1.0198 },
        { n: { en: 'ICBC Gold Bar', zh: '工行如意金条' }, s: { en: 'Bank bar · est · CNY/g', zh: '银行金条 · 估算 · 元/克' },
          v: 785.65, dp: 2, c: -4.45, d: -36.58, est: 1.0261 },
        { n: { en: 'London Silver Spot', zh: '伦敦银现' }, s: { en: 'Intl spot · USD/oz', zh: '国际现货 · 美元/盎司' },
          v: 42.077, dp: 3, c: -1.11, d: -0.474, live: 'XAG', base: 42.551 },
        { n: { en: 'Silver T+D', zh: '白银 T+D' }, s: { en: 'SGE spot · CNY/kg', zh: '上海白银现货 · 元/千克' },
          v: 9933, dp: 0, c: -2.40, d: -244 },
        { n: { en: 'SHFE Silver', zh: '沪银主力' }, s: { en: 'SHFE futures · CNY/kg', zh: '上海白银期货 · 元/千克' },
          v: 9972, dp: 0, c: -3.86, d: -400 }
    ];

    var FX = [
        { code: 'USD', n: { en: 'US Dollar', zh: '美元' }, v: 6.6710, prev: 6.6950, lo: 6.6674, hi: 6.6810 },
        { code: 'EUR', n: { en: 'Euro', zh: '欧元' }, v: 7.3347, prev: 7.3158, lo: 7.3092, hi: 7.3447 },
        { code: 'JPY', n: { en: 'Yen', zh: '日元' }, v: 0.04207, prev: 0.04176, lo: 0.04171, hi: 0.04213 },
        { code: 'GBP', n: { en: 'Pound', zh: '英镑' }, v: 8.7573, prev: 8.7308, lo: 8.7245, hi: 8.7719 },
        { code: 'HKD', n: { en: 'HK Dollar', zh: '港元' }, v: 0.8521, prev: 0.8502, lo: 0.8498, hi: 0.8524 },
        { code: 'AUD', n: { en: 'Aus Dollar', zh: '澳元' }, v: 4.4543, prev: 4.4408, lo: 4.4326, hi: 4.4603 },
        { code: 'CAD', n: { en: 'Can Dollar', zh: '加元' }, v: 4.6664, prev: 4.6475, lo: 4.6468, hi: 4.6707 },
        { code: 'SGD', n: { en: 'SG Dollar', zh: '新加坡元' }, v: 5.1840, prev: 5.1609, lo: 5.1600, hi: 5.1867 },
        { code: 'KRW', n: { en: 'Won', zh: '韩元' }, v: 0.004988, prev: 0.004998, lo: 0.004978, hi: 0.005008 },
        { code: 'CHF', n: { en: 'Swiss Franc', zh: '瑞士法郎' }, v: 7.9517, prev: 7.9009, lo: 7.8964, hi: 7.9745 }
    ];

    var GOLD_S = [3634.8, 3609.8, 3603.6, 3558.5, 3541.9, 3546.7, 3531.4, 3545.5, 3559.3, 3571.6, 3580.6, 3567.9, 3590.8, 3577.0, 3576.9, 3574.7];
    var SILVER_S = [43.055, 42.56, 42.44, 41.75, 41.56, 41.76, 41.35, 41.74, 42.005, 42.19, 42.42, 42.135, 42.535, 42.22, 42.215, 42.03];
    var T_LABEL = ['18:00', '19:00', '20:00', '21:00', '22:00', '23:00', '00:00', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00', '07:00', '08:00', '09:00'];

    var tickId = null, fxId = null, hiddenByHost = false;
    var LIVE = { on: true, interval: 30, left: 30, err: 0, at: null, xau: null, xag: null, hist: { XAU: [], XAG: [] }, usdcny: 6.6710, fxAt: null };

    /* 加密：数据源 CoinGecko 公开接口，读不到就显示 —（不编假数） */
    var CRYPTO = [
        { sym: 'BTC', n: { en: 'Bitcoin', zh: '比特币' } },
        { sym: 'ETH', n: { en: 'Ethereum', zh: '以太坊' } },
        { sym: 'XPT', n: { en: 'Platinum', zh: '铂金现货' } }
    ];
    var ALERT_KEY = 'mk.alerts.v1';
    var ALOG_KEY = 'mk.alertlog.v1';
    var HIST_KEY = 'mk.hist.v1';
    var ALL_SYMS = ['XAU', 'XAG', 'BTC', 'ETH', 'XPT'];

    function valOf(sym) {
        if (sym === 'XAU') return LIVE.xau;
        if (sym === 'XAG') return LIVE.xag;
        var c = CRYPTO.filter(function (k) { return k.sym === sym; })[0];
        return c ? c.v : null;
    }
    var CACHE_KEY = 'mk.cache.v1';
    function saveCache() {
        try {
            var o = {};
            ALL_SYMS.forEach(function (k) {
                var v = valOf(k);
                if (isFinite(v)) o[k] = { v: v, at: Date.now() };
            });
            localStorage.setItem(CACHE_KEY, JSON.stringify(o));
        } catch (e) {}
    }
    function restoreCache() {
        try {
            var o = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') || {};
            ALL_SYMS.forEach(function (k) {
                if (!o[k] || !isFinite(o[k].v)) return;
                if (k === 'XAU') { if (LIVE.xau === null) LIVE.xau = o[k].v; }
                else if (k === 'XAG') { if (LIVE.xag === null) LIVE.xag = o[k].v; }
                else {
                    var c = CRYPTO.filter(function (x) { return x.sym === k; })[0];
                    if (c && !isFinite(c.v)) { c.v = o[k].v; c.cached = true; c.at = o[k].at || null; }
                }
            });
        } catch (e) {}
    }

    function nameOf(sym) {
        if (sym === 'XAU') return { en: 'Gold', zh: '黄金' };
        if (sym === 'XAG') return { en: 'Silver', zh: '白银' };
        var c = CRYPTO.filter(function (k) { return k.sym === sym; })[0];
        return c ? c.n : { en: sym, zh: sym };
    }
    function fmtAny(sym, v) {
        if (!isFinite(v)) return '—';
        return fmt(v, v >= 1000 ? 0 : (v >= 10 ? 2 : 4));
    }

    /* 走势历史落盘：刷新不丢，最多保留 120 点 */
    function saveHist() {
        try {
            var o = {};
            ALL_SYMS.forEach(function (k) {
                var h = LIVE.hist[k];
                if (h && h.length) o[k] = h.slice(-120);
            });
            localStorage.setItem(HIST_KEY, JSON.stringify(o));
        } catch (e) {}
    }
    function loadHist() {
        try {
            var o = JSON.parse(localStorage.getItem(HIST_KEY) || '{}') || {};
            ALL_SYMS.forEach(function (k) {
                if (Array.isArray(o[k]) && o[k].length) LIVE.hist[k] = o[k].slice(-120);
            });
        } catch (e) {}
    }
    function pushHist(sym, v) {
        var h = LIVE.hist[sym] = LIVE.hist[sym] || [];
        h.push(v);
        if (h.length > 120) h.shift();
    }
    function loadAlerts() { try { return JSON.parse(localStorage.getItem(ALERT_KEY) || '{}') || {}; } catch (e) { return {}; } }
    function saveAlerts(o) { try { localStorage.setItem(ALERT_KEY, JSON.stringify(o)); } catch (e) {} }

    /* ---------- 通用 ---------- */
    function deltaEl(v, text) {
        var cls = v > 0 ? 'up' : (v < 0 ? 'down' : '');
        var arrow = v > 0 ? '▲' : (v < 0 ? '▼' : '=');
        return '<span class="mk-delta ' + cls + '">' + arrow + ' ' + text + '</span>';
    }

    /* ---------- 盘面表 ---------- */
    function renderTable() {
        var box = $('mk-table');
        if (!box) return;
        var head = '<div class="mk-tr is-head">' +
            '<span class="mk-tname">' + (L() === 'zh' ? '品种' : 'INSTRUMENT') + '</span>' +
            '<span class="mk-lead"></span>' +
            '<span class="mk-tprice">' + (L() === 'zh' ? '最新价' : 'LAST') + '</span>' +
            '<span class="mk-tsub">' + (L() === 'zh' ? '涨跌' : 'CHG') + '</span>' +
            '<span class="mk-tchg">' + (L() === 'zh' ? '涨跌幅' : 'CHG%') + '</span></div>';
        var rows = METALS.map(function (m) {
            var live = m.live ? '<span class="mk-tag">LIVE</span>' : (m.est ? '<span class="mk-tag mk-tag-est">EST</span>' : '');
            var dcol = m.d > 0 ? 'var(--mkt-up)' : 'var(--mkt-down)';
            return '<div class="mk-tr">' +
              '<div class="mk-tname"><span>' + T(m.n) + live + '</span><em>' + T(m.s) + '</em></div>' +
              '<span class="mk-lead"></span>' +
              '<div class="mk-tprice">' + fmt(m.v, m.dp) + '</div>' +
              '<div class="mk-tsub" style="color:' + dcol + '">' + sgn(m.d, Math.abs(m.d) < 10 ? 3 : 2) + '</div>' +
              '<div class="mk-tchg">' + deltaEl(m.c, Math.abs(m.c).toFixed(2) + '%') + '</div>' +
            '</div>';
        }).join('');
        box.innerHTML = head + rows;
    }

    /* ---------- 汇率 ---------- */
    function fxDisp(v) { return v >= 0.01 ? v.toFixed(4) : v.toFixed(6); }
    function renderFx() {
        var box = $('mk-fx');
        if (!box) return;
        box.innerHTML = FX.map(function (f) {
            var pos = (f.v - f.lo) / (f.hi - f.lo);
            if (!isFinite(pos)) pos = .5;
            pos = Math.max(3, Math.min(97, pos * 100));
            var chg = (f.v / f.prev - 1) * 100;
            var valStr = fxDisp(f.v);
            return '<div class="mk-fx-card">' +
              '<div class="mk-fx-top"><span>' + T(f.n) + '</span><span>' + f.code + '</span></div>' +
              '<div class="mk-fx-val' + (valStr.length >= 7 ? ' sm' : '') + '">' + valStr + '</div>' +
              '<div class="mk-fx-foot">' + deltaEl(chg, Math.abs(chg).toFixed(2) + '%') + '</div>' +
              '<div class="mk-fx-prev">' + (L() === 'zh' ? '昨收 ' : 'PREV ') + fxDisp(f.prev) + '</div>' +
              '<div class="mk-range"><i style="left:' + pos.toFixed(1) + '%"></i></div>' +
              '<div class="mk-rng-lbl"><span>' + fxDisp(f.lo) + '</span><span>' + fxDisp(f.hi) + '</span></div>' +
            '</div>';
        }).join('');
    }

    /* ---------- 排行 ---------- */
    function renderRank(animate) {
        var boxM = $('mk-rank-metal'), boxF = $('mk-rank-fx');
        if (!boxM || !boxF) return;

        var ml = METALS.slice().sort(function (a, b) { return b.c - a.c; });
        var fl = FX.map(function (f) { return { n: f.n, c: (f.v / f.prev - 1) * 100 }; })
                   .sort(function (a, b) { return b.c - a.c; });
        var mM = Math.max.apply(null, ml.map(function (x) { return Math.abs(x.c); })) || 1;
        var fM = Math.max.apply(null, fl.map(function (x) { return Math.abs(x.c); })) || 1;

        function rows(list, max) {
            return list.map(function (d) {
                var v = d.c, w = Math.max(1.5, Math.abs(v) / max * 50);
                var side = v >= 0 ? 'p' : 'n';
                return '<div class="mk-bar-row">' +
                  '<span class="n">' + T(d.n) + '</span>' +
                  '<span class="mk-bar-track"><span class="mk-bar-fill ' + side + '" data-w="' + w + '"></span></span>' +
                  '<span class="mk-bar-val ' + side + '">' + sgn(v, 2) + '%</span></div>';
            }).join('');
        }

        var wrap = document.querySelector('.mk-rank');
        if (wrap) wrap.classList.toggle('mk-noanim', animate === false);
        boxM.innerHTML = rows(ml, mM);
        boxF.innerHTML = rows(fl, fM);

        var paint = function () {
            document.querySelectorAll('.mk-bar-fill').forEach(function (b) {
                b.style.width = b.getAttribute('data-w') + '%';
            });
        };
        if (animate === false) paint();
        else requestAnimationFrame(function () { setTimeout(paint, 80); });
    }

    /* ---------- 折线 ---------- */
    function drawChart(svg, data, opts) {
        if (!svg) return;
        var W = 560, H = 200, L0 = 46, R0 = 12, T0 = 16, B0 = 24;
        var min = Math.min.apply(null, data), max = Math.max.apply(null, data);
        var span = (max - min) || 1;
        min -= span * .14; max += span * .14;
        var step = (W - L0 - R0) / (data.length - 1);
        var X = function (i) { return L0 + i * step; };
        var Y = function (v) { return T0 + (max - v) / (max - min) * (H - T0 - B0); };
        var pts = data.map(function (v, i) { return [X(i), Y(v)]; });
        var d = 'M' + pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' L');
        var area = d + ' L' + (W - R0) + ',' + (H - B0) + ' L' + L0 + ',' + (H - B0) + ' Z';

        var grid = '';
        for (var g = 0; g <= 3; g++) {
            var y = T0 + (H - T0 - B0) * g / 3, val = max - (max - min) * g / 3;
            grid += '<line x1="' + L0 + '" y1="' + y.toFixed(1) + '" x2="' + (W - R0) + '" y2="' + y.toFixed(1) + '" stroke="var(--glass-border)" stroke-width="1"/>' +
                    '<text class="mk-axis-text" x="' + (L0 - 8) + '" y="' + (y + 3.5).toFixed(1) + '" text-anchor="end">' + val.toFixed(opts.dp) + '</text>';
        }
        var xl = [0, Math.floor((data.length - 1) / 2), data.length - 1].map(function (i) {
            var anchor = i === 0 ? 'start' : (i === data.length - 1 ? 'end' : 'middle');
            return '<text class="mk-axis-text" x="' + X(i).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="' + anchor + '">' + T_LABEL[i] + '</text>';
        }).join('');

        var last = pts[pts.length - 1], gid = opts.gid;
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svg.innerHTML =
            '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
              '<stop offset="0%" stop-color="var(--primary)" stop-opacity=".28"/>' +
              '<stop offset="100%" stop-color="var(--primary)" stop-opacity="0"/>' +
            '</linearGradient></defs>' +
            grid + xl +
            '<path d="' + area + '" fill="url(#' + gid + ')"/>' +
            '<path d="' + d + '" fill="none" stroke="var(--secondary)" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>' +
            '<circle cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="7" fill="var(--secondary)" opacity=".18"/>' +
            '<circle cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="3" fill="var(--secondary)"/>';
    }

    /* ---------- 银行金条 / 银条：由现货折算推算（EST） ---------- */
    var PREV_XAU = 3607.14, PREV_XAG = 42.551;
    var PREM_CCB = 1.0198, PREM_ICBC = 1.0261, PREM_BOC = 1.0204, PREM_SILVER = 1.06;

    function cnyGold(xau) { return xau * LIVE.usdcny / 31.1035; }        // CNY / g
    function cnySilver(xag) { return xag * LIVE.usdcny / 31.1035 * 1000; }  // CNY / kg

    function deriveBars() {
        if (LIVE.xau == null) return;
        var nowG = cnyGold(LIVE.xau), prevG = cnyGold(PREV_XAU);
        var setBar = function (mIdx, prem, idText, idChg) {
            var m = METALS[mIdx];
            var v = nowG * prem, pv = prevG * prem;
            m.v = v; m.d = v - pv; m.c = (v / pv - 1) * 100;
            var el = $(idText);
            if (el) el.textContent = fmt(v, 2);
            var ce = $(idChg);
            if (ce) {
                ce.className = 'mk-delta ' + (m.c > 0 ? 'up' : 'down');
                ce.innerHTML = (m.c > 0 ? '▲ ' : '▼ ') + Math.abs(m.c).toFixed(2) + '%';
            }
            return v;
        };
        var ccb = setBar(3, PREM_CCB, 'mk-bar-gold', 'mk-bar-gold-chg');
        var icbc = setBar(4, PREM_ICBC, null, null);
        var boc = nowG * PREM_BOC;

        var icbcEl = $('mk-bar-icbc');
        if (icbcEl) icbcEl.textContent = fmt(icbc, 2) + ' · ' + sgn(METALS[4].c, 2) + '%';
        var bocEl = $('mk-bar-boc');
        if (bocEl) bocEl.textContent = fmt(boc, 2) + ' · ' + sgn((boc / (prevG * PREM_BOC) - 1) * 100, 2) + '%';

        if (LIVE.xag == null) return;
        /* 银条和金条统一按「元/克」报价，公斤价只作为副标展示（原来主数字是 /KG，
           和金条的 /G 并排时容易被误读成"银条比金条还贵"） */
        var nowG2 = cnyGold(LIVE.xag), prevG2 = cnyGold(PREV_XAG);
        var sv = nowG2 * PREM_SILVER, sc = (sv / (prevG2 * PREM_SILVER) - 1) * 100;
        var se = $('mk-bar-silver');
        if (se) se.textContent = fmt(sv, 2);
        var skg = $('mk-bar-silver-kg');
        if (skg) skg.textContent = '≈ ' + fmt(sv * 1000, 0) + ' CNY / KG';
        var sce = $('mk-bar-silver-chg');
        if (sce) {
            sce.className = 'mk-delta ' + (sc > 0 ? 'up' : 'down');
            sce.innerHTML = (sc > 0 ? '▲ ' : '▼ ') + Math.abs(sc).toFixed(2) + '%';
        }
        var shfe = $('mk-bar-shfe'), td = $('mk-bar-td');
        if (shfe) shfe.textContent = fmt(METALS[7].v, 0) + ' · ' + sgn(METALS[7].c, 2) + '%';
        if (td) td.textContent = fmt(METALS[6].v, 0) + ' · ' + sgn(METALS[6].c, 2) + '%';
        void ccb;
    }

    /* ---------- 实时 ---------- */
    function pushHist(k, v) { var a = LIVE.hist[k]; a.push(v); if (a.length > 50) a.shift(); }

    function drawSpark(svg, hist) {
        if (!svg) return;
        var d = hist.slice(-40);
        if (!d.length) { svg.innerHTML = ''; return; }
        if (d.length === 1) d = [d[0], d[0]];
        var min = Math.min.apply(null, d), max = Math.max.apply(null, d), span = (max - min) || 1;
        var W = 170, H = 46, p = 6;
        var pts = d.map(function (v, i) {
            return [i / (d.length - 1) * W, H - p - (v - min) / span * (H - p * 2)];
        });
        var path = pts.map(function (q, i) { return (i ? 'L' : 'M') + q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join(' ');
        var last = pts[pts.length - 1];
        svg.innerHTML =
            '<path d="' + path + '" fill="none" stroke="var(--primary)" stroke-width="1.4" stroke-linejoin="round" opacity=".9"/>' +
            '<circle cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="2.4" fill="var(--secondary)"/>';
    }

    function renderLive() {
        if (LIVE.xau != null) {
            var e1 = $('mk-xau');
            e1.innerHTML = fmt(LIVE.xau, 2) + '<small>USD / OZ</small>';
            e1.classList.remove('flash'); void e1.offsetWidth; e1.classList.add('flash');
            var c1 = (LIVE.xau - 3607.14) / 3607.14 * 100;
            $('mk-xau-chg').innerHTML = deltaEl(c1, Math.abs(c1).toFixed(2) + '%') +
                ' <span class="mk-sub">' + sgn(LIVE.xau - 3607.14, 2) + '</span>';
            $('mk-xau-cny').textContent = '≈ ' + (LIVE.xau * LIVE.usdcny / 31.1035).toFixed(2) + ' CNY / G';
            drawSpark($('mk-xau-spark'), LIVE.hist.XAU);
            var mx = $('mk-metal-xau');
            if (mx) mx.textContent = fmt(LIVE.xau, 2) + ' · ' + sgn(c1, 2) + '%';
            METALS[0].v = LIVE.xau;
            METALS[0].c = c1;
            METALS[0].d = LIVE.xau - METALS[0].base;
        }
        if (LIVE.xag != null) {
            var e2 = $('mk-xag');
            e2.innerHTML = fmt(LIVE.xag, 2) + '<small>USD / OZ</small>';
            e2.classList.remove('flash'); void e2.offsetWidth; e2.classList.add('flash');
            var c2 = (LIVE.xag - 42.551) / 42.551 * 100;
            $('mk-xag-chg').innerHTML = deltaEl(c2, Math.abs(c2).toFixed(2) + '%') +
                ' <span class="mk-sub">' + sgn(LIVE.xag - 42.551, 2) + '</span>';
            $('mk-xag-cny').textContent = '≈ ' + (LIVE.xag * LIVE.usdcny / 31.1035).toFixed(2) + ' CNY / G';
            drawSpark($('mk-xag-spark'), LIVE.hist.XAG);
            var ms = $('mk-metal-xag');
            if (ms) ms.textContent = fmt(LIVE.xag, 3) + ' · ' + sgn(c2, 2) + '%';
            METALS[5].v = LIVE.xag;
            METALS[5].c = c2;
            METALS[5].d = LIVE.xag - METALS[5].base;
        }
        deriveBars();
        renderTable();
        renderRank(false);
    }

    function pollMetals() {
        if (!LIVE.on || !window.fetch) return;
        var get = function (sym) {
            return fetch('https://api.gold-api.com/price/' + sym, { cache: 'no-store' })
              .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
        };
        Promise.all([get('XAU'), get('XAG')]).then(function (res) {
            LIVE.xau = res[0].price;
            LIVE.xag = res[1].price;
            LIVE.at = new Date(res[0].updatedAt || Date.now());
            pushHist('XAU', LIVE.xau);
            pushHist('XAG', LIVE.xag);
            LIVE.err = 0;
            LIVE.okAt = Date.now();
            saveHist();
            saveCache();
            renderLive();
            renderRatio();
            renderStatus();
        }).catch(function () {
            LIVE.err++;
            renderStatus();
        });
    }

    function fmtCoin(v) {
        if (!isFinite(v)) return '—';
        return v >= 1000 ? fmt(v, 0) : (v >= 1 ? fmt(v, 2) : fmt(v, 4));
    }

    function renderCrypto() {
        CRYPTO.forEach(function (c) {
            /* 只有超过 90s 没拿到新值才算过期，偶发一次失败不显示 LAST */
            var stale = c.cached || !c.at || (Date.now() - c.at > 90000);
            var priceEl = $('mk-' + c.sym.toLowerCase());
            if (!priceEl) return;
            priceEl.innerHTML = isFinite(c.v)
                ? fmtCoin(c.v) + '<small>USD</small>'
                : '<span class="mk-pending">SYNCING<span>…</span></span>';
            var chg = $('mk-' + c.sym.toLowerCase() + '-chg');
            if (chg) {
                chg.innerHTML = stale
                    ? '<span class="mk-delta">LAST' + (c.at ? ' ' + clock(new Date(c.at)) : '') + '</span>'
                    : (typeof c.c === 'number' && isFinite(c.c))
                    ? deltaEl(c.c, (c.c > 0 ? '+' : '') + c.c.toFixed(2) + '% CHG')
                    : '';
            }
            var sub = $('mk-' + c.sym.toLowerCase() + '-sub');
            if (sub) {
                sub.textContent = isFinite(c.v) && LIVE.usdcny
                    ? '≈ ' + fmt(c.v * LIVE.usdcny, 0) + ' CNY'
                    : 'WAITING FOR FEED';
            }
            drawSpark($('mk-' + c.sym.toLowerCase() + '-spark'), LIVE.hist[c.sym] || []);
        });
        renderRatio();
    }

    function notify(text) {
        try {
            var el = document.createElement('div');
            el.className = 'lzx-ach in';
            el.innerHTML = '<b>!</b><div><span>价格提醒</span><em>PRICE ALERT</em><p>' + text + '</p></div>';
            var holder = document.getElementById('lzx-ach-stack');
            if (!holder) {
                holder = document.createElement('div');
                holder.id = 'lzx-ach-stack';
                holder.className = 'lzx-ach-stack';
                document.body.appendChild(holder);
            }
            holder.appendChild(el);
            setTimeout(function () {
                el.classList.remove('in');
                setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 420);
            }, 4000);
        } catch (e) {}
    }

    function loadAlog() { try { return JSON.parse(localStorage.getItem(ALOG_KEY) || '[]') || []; } catch (e) { return []; } }
    function saveAlog(a) { try { localStorage.setItem(ALOG_KEY, JSON.stringify(a.slice(0, 20))); } catch (e) {} }
    function pushAlog(sym, price, target, dir) {
        var a = loadAlog();
        a.unshift({ t: Date.now(), sym: sym, v: price, a: target, d: dir });
        saveAlog(a);
    }
    function renderAlog() {
        var box = document.getElementById('mk-alog');
        if (!box) return;
        var a = loadAlog();
        if (!a.length) {
            box.innerHTML = '<div class="mk-alog-empty">' + (L() === 'zh' ? '还没有触发过提醒。' : 'No alerts fired yet.') + '</div>';
            return;
        }
        box.innerHTML = a.slice(0, 6).map(function (row) {
            var d = new Date(row.t);
            var hh = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
            var date = (d.getMonth() + 1) + '/' + d.getDate();
            return '<div class="mk-alog-row"><span class="mk-alog-t">' + date + ' ' + hh + '</span>' +
                   '<b class="' + (row.d === 'up' ? 'up' : 'down') + '">' + row.sym + '</b>' +
                   '<span class="mk-alog-p">' + fmtAny(row.sym, row.v) + '</span>' +
                   '<em>' + (row.d === 'up' ? '↑ ' : '↓ ') + fmtAny(row.sym, row.a) + '</em></div>';
        }).join('');
    }

    function checkAlerts() {
        var alerts = loadAlerts();
        var changed = false;
        ALL_SYMS.forEach(function (sym) {
            var a = alerts[sym];
            if (!a || !isFinite(a.v)) return;
            var v = valOf(sym);
            if (!isFinite(v)) return;
            var prev = a.prev;
            if (!isFinite(prev)) { a.prev = v; changed = true; return; }
            var crossed = (prev < a.v && v >= a.v) || (prev > a.v && v <= a.v);
            if (crossed) {
                var nm = nameOf(sym);
                notify(nm.zh + ' ' + sym + ' ' + (v >= a.v ? '上穿 ↑ ' : '下穿 ↓ ') + fmtAny(sym, a.v) +
                       (sym === 'XAU' || sym === 'XAG' ? ' USD/oz' : ' USD') + '，现价 ' + fmtAny(sym, v));
                a.prev = v;
                a.hit = Date.now();
                pushAlog(sym, v, a.v, v >= a.v ? 'up' : 'down');
                renderAlog();
                changed = true;
            } else {
                a.prev = v;
            }
        });
        if (changed) saveAlerts(alerts);
        paintAlertBtns();
        renderAlog();
    }

    function paintAlertBtns() {
        var alerts = loadAlerts();
        Array.prototype.forEach.call(document.querySelectorAll('.mk-alert'), function (btn) {
            var sym = btn.getAttribute('data-alert');
            var on = !!alerts[sym];
            btn.classList.toggle('on', on);
            btn.title = on ? ('提醒价 ' + fmtAny(sym, alerts[sym].v) + '（点击修改）') : '设置价格提醒';
        });
    }

    /* 金银比 */
    function renderRatio() {
        var val = $('mk-ratio'), state = $('mk-ratio-state'), bar = $('mk-ratio-bar');
        if (!val) return;
        var xau = LIVE.xau, xag = LIVE.xag;
        if (!isFinite(xau) || !isFinite(xag) || !xag) { val.textContent = '—'; return; }
        var r = xau / xag;
        val.textContent = r.toFixed(1);
        var label, cls;
        if (r > 90) { label = L() === 'zh' ? '银相对便宜' : 'SILVER CHEAP'; cls = 'hi'; }
        else if (r < 70) { label = L() === 'zh' ? '金相对便宜' : 'GOLD CHEAP'; cls = 'lo'; }
        else { label = L() === 'zh' ? '区间中枢' : 'MID RANGE'; cls = 'mid'; }
        if (state) { state.textContent = label; state.className = cls; }
        if (bar) bar.style.width = Math.max(2, Math.min(100, (r - 40) / 80 * 100)) + '%';
        if (bar) bar.style.background = cls === 'hi' ? 'var(--secondary)' : cls === 'lo' ? 'var(--primary)' : 'var(--text-muted)';
    }

    /* 换算器 */
    function cnyRateOf(code) {
        if (code === 'CNY') return 1;
        var f = FX.filter(function (x) { return x.code === code; })[0];
        return f ? f.v : null;
    }
    function renderConvert() {
        var inEl = $('mk-conv-in'), from = $('mk-conv-from'), to = $('mk-conv-to'), out = $('mk-conv-out');
        if (!inEl || !from || !to || !out) return;
        var amt = parseFloat(inEl.value);
        if (!isFinite(amt)) amt = 0;
        var rf = cnyRateOf(from.value), rt = cnyRateOf(to.value);
        if (!rf || !rt) { out.textContent = '—'; return; }
        var res = amt * rf / rt;
        out.innerHTML = '<b>' + fmt(res, res >= 1000 ? 2 : 4) + '</b><small>' + to.value + '</small>' +
                        '<em>' + from.value + ' → ' + to.value + ' @ ' + fmt(rf / rt, 4) + '</em>';
    }
    function initConvert() {
        var from = $('mk-conv-from'), to = $('mk-conv-to'), inEl = $('mk-conv-in');
        if (!from || !to || !inEl || from.dataset.ready === '1') return;
        from.dataset.ready = '1';
        var codes = ['CNY'].concat(FX.map(function (f) { return f.code; }));
        from.innerHTML = codes.map(function (c) { return '<option value="' + c + '">' + c + '</option>'; }).join('');
        to.innerHTML = from.innerHTML;
        from.value = 'USD';
        to.value = 'CNY';
        from.addEventListener('change', renderConvert);
        to.addEventListener('change', renderConvert);
        inEl.addEventListener('input', renderConvert);
        var wrap = from.closest('.mk-tool');
        if (wrap) {
            wrap.addEventListener('click', function (e) {
                var sw = e.target.closest('[data-swap]');
                if (sw) {
                    var a = from.value; from.value = to.value; to.value = a;
                    renderConvert();
                    return;
                }
                var q = e.target.closest('[data-quick]');
                if (q) { inEl.value = q.getAttribute('data-quick'); renderConvert(); }
            });
        }
        renderConvert();
    }

    /* 免费行情接口并发会被限流：三个币种改成串行 + 指数退避重试，
       失败也不清空卡片，回落到上一次成功值并打 LAST 标记 */
    function fetchPrice(sym, tries) {
        tries = tries || 0;
        return fetch('https://api.gold-api.com/price/' + sym, { cache: 'no-store' })
          .then(function (r) {
              if (!r.ok) throw new Error('HTTP ' + r.status);
              return r.json();
          })
          .catch(function (err) {
              if (tries >= 2) throw err;
              return new Promise(function (res) { setTimeout(res, 700 + tries * 900); })
                .then(function () { return fetchPrice(sym, tries + 1); });
          });
    }
    var cryptoBusy = false;
    function pollCrypto() {
        if (!LIVE.on || !window.fetch || cryptoBusy) return;
        cryptoBusy = true;
        var i = 0, ok = 0;
        function next() {
            if (i >= CRYPTO.length) {
                cryptoBusy = false;
                renderCrypto();
                checkAlerts();
                saveHist();
                saveCache();
                return;
            }
            var c = CRYPTO[i++];
            fetchPrice(c.sym).then(function (x) {
                if (x && isFinite(x.price)) {
                    var prev = isFinite(c.v) ? c.v : null;
                    c.v = x.price;
                    c.cached = false;
                    c.at = Date.now();
                    if (prev) c.c = (c.v - prev) / prev * 100;
                    pushHist(c.sym, c.v);
                    ok++;
                }
                renderCrypto();
            }).catch(function () {
                /* 单次失败不清空、也不立刻打 LAST：交给下面的 90s 数据年龄判断 */
                renderCrypto();
            }).then(function () { setTimeout(next, 260); });
        }
        next();
    }

    function pollFx() {
        fetch('https://open.er-api.com/v6/latest/USD', { cache: 'no-store' })
          .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
          .then(function (d) {
              if (!d || !d.rates || !d.rates.CNY) throw new Error('no rates');
              LIVE.usdcny = d.rates.CNY;
              LIVE.fxAt = new Date();
              LIVE.fxDay = d.time_last_update_utc || d.time_last_update || null;
              var refEl = $('mk-fx-ref');
              if (refEl) {
                  refEl.textContent = LIVE.fxDay ? 'REF ' + refDate(LIVE.fxDay) : 'REF —';
              }
              FX.forEach(function (f) {
                  var rt = d.rates[f.code];
                  if (!rt) return;
                  var v = d.rates.CNY / rt;
                  if (!isFinite(v) || v <= 0) return;
                  f.v = v;
                  if (v < f.lo) f.lo = v;
                  if (v > f.hi) f.hi = v;
              });
              renderFx();
              renderRank(false);
              renderLive();
              renderStatus();
          }).catch(function () { renderStatus(); });
    }

    function renderStatus() {
        var bar = $('mk-status'), txt = $('mk-status-text');
        if (!bar || !txt) return;
        bar.classList.remove('is-off', 'is-err', 'is-stale');
        var staleMin = LIVE.okAt ? (Date.now() - LIVE.okAt) / 60000 : 0;
        if (staleMin > 10) bar.classList.add('is-stale');
        if (!LIVE.on) {
            bar.classList.add('is-off');
            txt.textContent = 'PAUSED · LAST ' + (LIVE.at ? clock(LIVE.at) : '--:--:--');
            return;
        }
        if (LIVE.err > 0) {
            bar.classList.add('is-err');
            txt.textContent = 'OFFLINE · SNAPSHOT · RETRY ' + LIVE.left + 'S';
            return;
        }
        txt.textContent = 'LIVE · SYNC ' + (LIVE.at ? clock(LIVE.at) : '--:--:--') + ' · NEXT ' + LIVE.left + 'S';
    }

    /* ---------- 初始化 ---------- */
    function init() {
        if (!$('mk-table')) return;
        // 用日内小时线打底，让 sparkline 一进页面就有形态
        LIVE.hist.XAU = GOLD_S.slice(-16);
        LIVE.hist.XAG = SILVER_S.slice(-16);
        loadHist();
        restoreCache();
        LIVE.xau = METALS[0].v; LIVE.xag = METALS[5].v;
        renderTable();
        renderFx();
        deriveBars();
        renderRank();
        drawChart($('mk-chart-xau'), GOLD_S, { dp: 0, gid: 'mkGoldGrad' });
        drawChart($('mk-chart-xag'), SILVER_S, { dp: 1, gid: 'mkSilverGrad' });

        var toggle = $('mk-toggle');
        if (toggle) toggle.addEventListener('click', function () {
            LIVE.on = !LIVE.on;
            LIVE.left = LIVE.interval;
            toggle.textContent = LIVE.on ? 'PAUSE' : 'RESUME';
            renderStatus();
        });
        var sync = $('mk-refresh');
        if (sync) sync.addEventListener('click', function () {
            if (!LIVE.on) return;
            LIVE.left = LIVE.interval;
            pollMetals();
            pollFx();
        });

        tickId = setInterval(function () {
            if (!LIVE.on) return;
            LIVE.left--;
            if (LIVE.left <= 0) {
                LIVE.left = LIVE.interval;
                if (!document.hidden) pollMetals();
            }
            renderStatus();
        }, 1000);
        fxId = setInterval(function () { if (LIVE.on && !document.hidden) pollFx(); }, 600000);

        initConvert();
        paintAlertBtns();
        renderRatio();
        renderAlog();
        var alertClr = $('mk-alert-clear');
        if (alertClr) alertClr.addEventListener('click', function () { saveAlog([]); renderAlog(); });
        renderStatus();
        pollFx();
        pollMetals();
        pollCrypto();
        setInterval(function () { if (LIVE.on && !document.hidden) pollCrypto(); }, 120000);

        /* 提醒按钮 */
        Array.prototype.forEach.call(document.querySelectorAll('.mk-alert'), function (btn) {
            btn.addEventListener('click', function () {
                var sym = btn.getAttribute('data-alert');
                var alerts = loadAlerts();
                var cur = alerts[sym] ? alerts[sym].v : null;
                var input = window.prompt(sym + ' 提醒价（USD，留空清除）' + (cur ? '，当前设置 ' + cur : ''), cur ? String(cur) : '');
                if (input === null) return;
                var v = parseFloat(input);
                if (!input.trim()) { delete alerts[sym]; saveAlerts(alerts); btn.classList.remove('on'); notify(sym + ' 提醒已清除'); return; }
                if (!isFinite(v) || v <= 0) { notify('价格格式不对'); return; }
                alerts[sym] = { v: v, prev: c && isFinite(c.v) ? c.v : null, hit: 0 };
                saveAlerts(alerts);
                btn.classList.add('on');
                notify(sym + ' 到 ' + fmtCoin(v) + ' 时提醒你');
            });
            var alerts = loadAlerts();
            if (alerts[btn.getAttribute('data-alert')]) btn.classList.add('on');
        });

        // 双语重渲染
        new MutationObserver(function (m) {
            if (m[0].attributeName === 'lang') {
                renderTable(); renderFx(); renderRank(false); renderLive(); renderCrypto();
                initConvert(); renderConvert(); renderRatio(); paintAlertBtns(); renderAlog();
            }
        }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    }

    window.MarketFeed = {
        pause: function () {
            hiddenByHost = true;
            if (tickId) { clearInterval(tickId); tickId = null; }
        },
        resume: function () {
            if (!hiddenByHost) return;
            hiddenByHost = false;
            if (!tickId) {
                tickId = setInterval(function () {
                    if (!LIVE.on) return;
                    LIVE.left--;
                    if (LIVE.left <= 0) {
                        LIVE.left = LIVE.interval;
                        if (!document.hidden) pollMetals();
                    }
                    renderStatus();
                }, 1000);
            }
            LIVE.left = LIVE.interval;
            renderStatus();
            if (!document.hidden) { pollMetals(); }
        }
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
