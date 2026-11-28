/* v5.0 站点级增强：频谱可视化 / 主题选择器 / 成就墙 / 动效开关 / PWA 注册 */
(function () {
    'use strict';

    var $ = function (id) { return document.getElementById(id); };
    var LIGHT = ['theme-sneaker', 'theme-paper'];

    var THEMES = [
        { id: 'theme-cyber', n: 'CYBER', zh: '赛博紫' },
        { id: 'theme-hacker', n: 'HACKER', zh: '终端绿' },
        { id: 'theme-ocean', n: 'OCEAN', zh: '深海蓝' },
        { id: 'theme-sunset', n: 'SUNSET', zh: '落日橙' },
        { id: 'theme-sweet-pink', n: 'SWEET', zh: '樱粉' },
        { id: 'theme-sneaker', n: 'SNEAKER', zh: '浅灰' },
        { id: 'theme-paper', n: 'PAPER', zh: '纸白' },
        { id: 'theme-synthwave', n: 'SYNTHWAVE', zh: '合成波' }
    ];

    /* ---------------- 1. 频谱可视化 ---------------- */
    function initSpectrum() {
        var audio = $('bg-audio');
        var wrap = $('audio-wrapper');
        if (!audio || !wrap || wrap.dataset.spec === '1') return;
        wrap.dataset.spec = '1';

        var cv = document.createElement('canvas');
        cv.className = 'lzx-spec';
        cv.id = 'lzx-spec';
        wrap.appendChild(cv);
        var ctx = cv.getContext('2d');

        /* 注意：不要 createMediaElementSource。
           音频来自第三方 CDN（无 CORS 头），一旦接进 WebAudio 图，输出会变成全 0 →
           听不到声音。这里改用「跟播放进度同步的合成波形」，任何音源都能出声。 */
        var amp = 0;

        /* 读主题色 */
        var col = [167, 139, 250];
        /* --primary 在各主题里是 #rrggbb / rgb() / hsl() 混着写的，
           统一丢给 canvas 解析，别再做只认 rgb 的正则 */
        var probe = document.createElement('canvas').getContext('2d');
        function toRgb(str) {
            if (!str) return null;
            probe.fillStyle = '#000';
            probe.fillStyle = str;
            var v = probe.fillStyle;
            if (typeof v !== 'string') return null;
            if (v.charAt(0) === '#') {
                if (v.length === 4) v = '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
                return [parseInt(v.substr(1, 2), 16), parseInt(v.substr(3, 2), 16), parseInt(v.substr(5, 2), 16)];
            }
            var n = v.match(/[0-9.]+/g);
            return n && n.length >= 3 ? [+n[0], +n[1], +n[2]] : null;
        }
        function readColor() {
            try {
                var cs = getComputedStyle(document.documentElement);
                var c = toRgb(cs.getPropertyValue('--primary').trim());
                if (c) col = c;
            } catch (e) {}
        }
        readColor();

        var W = 0, H = 0, dpr = 1, t = 0;
        var cvL = -1, cvW = -1, cvB = -1, cvBlend = '';
        var playerEl = $('audio-container');
        /* 频谱宽度/位置跟随播放器实际尺寸，不再写死 432px */
        function layout() {
            /* canvas 已经在播放器容器内部，宽度 100% 自动对齐；只处理像素密度与混合模式 */
            var W2 = wrap.clientWidth;
            if (!W2 || W2 < 10) return;
            var isLight = LIGHT.some(function (c) { return document.documentElement.classList.contains(c); });
            var blend = isLight ? 'normal' : 'screen';
            if (blend !== cvBlend) { cv.style.mixBlendMode = blend; cv.style.opacity = isLight ? '.62' : '.9'; cvBlend = blend; }
            if (W2 !== W) resize();
        }
        function resize() {
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            W = cv.clientWidth || 320;
            H = cv.clientHeight || 26;
            cv.width = Math.round(W * dpr);
            cv.height = Math.round(H * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        var BARS = 34, vals = new Array(BARS).fill(0);
        var gradY = null, gradH = -1, gradKey = '', lastSpec = 0, specRaf = 0;
        function scheduleFrame() { if (!specRaf && !document.hidden && !(window.LZXPower && window.LZXPower.on()) && wrap.classList.contains('is-visible')) specRaf = requestAnimationFrame(frame); }
        function frame(ts) {
            specRaf = 0;
            if (document.hidden) return;
            /* 播放器收起（首屏未下滑）时不必画：这块以前是 60fps 无上限 + 每帧 34 个渐变的常驻开销 */
            if (!wrap.classList.contains('is-visible')) return;
            ts = ts || performance.now();
            if (ts - lastSpec < 42) { scheduleFrame(); return; }
            lastSpec = ts;
            layout();
            t += 0.06;
            ctx.clearRect(0, 0, W, H);

            var playing = !audio.paused && !audio.ended;
            if (playing) {
                var now = audio.currentTime || 0;
                var sum = 0;
                for (var b = 0; b < BARS; b++) {
                    /* 多条不同频率的正弦叠加 + 低频包络，做出"有段落感"的波形 */
                    var v = 0.30
                          + 0.20 * Math.sin(now * 2.3 + b * 0.55)
                          + 0.13 * Math.sin(now * 6.7 + b * 1.9)
                          + 0.09 * Math.sin(now * 13.1 + b * 3.2)
                          + 0.05 * Math.sin(t * 0.7 + b * 0.9);
                    v = v < 0.04 ? 0.04 : (v > 1 ? 1 : v);
                    sum += v;
                    vals[b] += (v - vals[b]) * (v > vals[b] ? 0.5 : 0.18);
                }
                amp = sum / BARS;
            } else {
                amp *= 0.9;
                for (var i2 = 0; i2 < BARS; i2++) {
                    var idle = 0.1 + 0.055 * (1 + Math.sin(t + i2 * 0.42)) + (amp > 0.02 ? amp * 0.5 : 0);
                    vals[i2] += (idle - vals[i2]) * 0.12;
                }
            }

            /* 一条渐变复用到底：之前每帧建 34 个 createLinearGradient，是首页卡顿的大头 */
            if (!gradY || gradH !== H || gradKey !== col.join(',')) {
                gradY = ctx.createLinearGradient(0, H, 0, 0);
                gradY.addColorStop(0, 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',0.95)');
                gradY.addColorStop(1, 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',0.12)');
                gradH = H; gradKey = col.join(',');
            }
            var gap = W / BARS;
            ctx.fillStyle = gradY;
            for (var k = 0; k < BARS; k++) {
                var h = Math.max(2, Math.min(H - 1, vals[k] * (H - 2) * 1.6));
                var x = k * gap + gap * 0.24;
                var w = gap * 0.52;
                ctx.fillRect(x, H - h, w, h);
            }
            scheduleFrame();
        }
        layout();
        resize();
        window.addEventListener('resize', function () { layout(); resize(); });
        setTimeout(resize, 400);
        scheduleFrame();
        document.addEventListener('visibilitychange', scheduleFrame);
        if (window.MutationObserver) new MutationObserver(scheduleFrame).observe(wrap, { attributes: true, attributeFilter: ['class'] });
        if (window.IntersectionObserver) new IntersectionObserver(scheduleFrame, { threshold: 0.05 }).observe(wrap);

        /* 主题切换后重取颜色 */
        var lastTheme = document.documentElement.className;
        setInterval(function () {
            if (document.documentElement.className !== lastTheme) { lastTheme = document.documentElement.className; readColor(); layout(); }
        }, 800);
    }

    /* ---------------- 2. 主题选择器 / 设置面板 ---------------- */
    function initThemePicker() {
        var isOpen = false, box = null;

        function motionOn() { return localStorage.getItem('lzx.motion') !== 'off'; }

        function build() {
            box = document.createElement('div');
            box.className = 'lzx-picker';
            box.innerHTML =
                '<div class="lzx-picker-card">' +
                  '<div class="lzx-picker-head"><span>APPEARANCE // <b id="lzx-pk-cur">' +
                    (window.CyberTheme ? window.CyberTheme.current().replace('theme-', '').toUpperCase() : '') +
                  '</b></span><i class="fas fa-times" id="lzx-pk-x"></i></div>' +
                  '<div class="lzx-pk-grid">' +
                    THEMES.map(function (t) {
                        return '<button class="lzx-pk-item" data-theme="' + t.id + '">' +
                          '<span class="lzx-pk-prev" data-t="' + t.id + '"><b></b><i></i></span>' +
                          '<span class="lzx-pk-meta"><em>' + t.n + '</em><i>' + t.zh + '</i></span>' +
                          '<span class="lzx-pk-check">✓</span></button>';
                    }).join('') +
                  '</div>' +
                  '<div class="lzx-pk-row">' +
                    '<span>动画特效 MOTION</span>' +
                    '<button class="lzx-pk-toggle" id="lzx-pk-motion"></button>' +
                  '</div>' +
                  '<div class="lzx-pk-row">' +
                    '<span>低功耗 LOW POWER</span>' +
                    '<button class="lzx-pk-toggle" id="lzx-pk-power"></button>' +
                  '</div>' +
                  '<div class="lzx-pk-row">' +
                    '<span>记住分区 RESUME</span>' +
                    '<button class="lzx-pk-toggle" id="lzx-pk-resume"></button>' +
                  '</div>' +
                  '<div class="lzx-pk-row">' +
                    '<span>成就 ACHIEVEMENTS</span>' +
                    '<button class="lzx-pk-mini" id="lzx-pk-ach">OPEN</button>' +
                  '</div>' +
                '</div>';
            document.body.appendChild(box);

            box.addEventListener('click', function (e) {
                if (e.target === box || e.target.id === 'lzx-pk-x') { close(); return; }
                var it = e.target.closest('.lzx-pk-item');
                if (it) {
                    var id = it.dataset.theme;
                    if (window.CyberTheme && window.CyberTheme.set) window.CyberTheme.set(id);
                    else {
                        THEMES.forEach(function (t) { document.documentElement.classList.remove(t.id); });
                        document.documentElement.classList.add(id);
                        localStorage.setItem('theme', id);
                    }
                    try { localStorage.setItem('lzx.theme', id); } catch (e2) {}
                    var cur = $('lzx-pk-cur');
                    if (cur) cur.textContent = id.replace('theme-', '').toUpperCase();
                    paint();
                    return;
                }
                if (e.target.id === 'lzx-pk-motion') { toggleMotion(); return; }
                if (e.target.id === 'lzx-pk-power') { LZXPower.toggle(); paint(); return; }
                if (e.target.id === 'lzx-pk-resume') {
                    var on = window.LZXView ? !window.LZXView.remember() : false;
                    if (window.LZXView) window.LZXView.setRemember(on);
                    paintResume();
                    return;
                }
                if (e.target.id === 'lzx-pk-ach') { close(); openAchWall(); return; }
            });
            paint();
        }

        function paint() {
            if (!box) return;
            var cur = window.CyberTheme ? window.CyberTheme.current() : localStorage.getItem('theme');
            box.querySelectorAll('.lzx-pk-item').forEach(function (el) {
                el.classList.toggle('on', el.dataset.theme === cur);
            });
            var mo = $('lzx-pk-motion');
            if (mo) {
                mo.classList.toggle('on', motionOn());
                mo.textContent = motionOn() ? 'ON' : 'OFF';
            }
            var pw = $('lzx-pk-power');
            if (pw) { pw.classList.toggle('on', LZXPower.on()); pw.textContent = LZXPower.on() ? 'ON' : 'OFF'; }
            paintResume();
        }

        function paintResume() {
            var r = $('lzx-pk-resume');
            if (!r) return;
            var on = window.LZXView ? window.LZXView.remember() : true;
            r.classList.toggle('on', on);
            r.textContent = on ? 'ON' : 'OFF';
        }

        function open() {
            if (!box) build();
            paint();
            /* 先让浏览器完成一次样式计算，再切 .show，opacity 过渡才会生效；
               直接切类会「先黑后现」闪一下。 */
            if (!box.classList.contains('show')) {
                void box.offsetWidth;
                requestAnimationFrame(function () { box.classList.add('show'); });
            }
            isOpen = true;
        }
        function close() { if (box) box.classList.remove('show'); isOpen = false; }

        setTimeout(function () { if (!box) build(); }, 1500);

        ['theme-toggle', 'mobile-theme-toggle'].forEach(function (id) {
            var btn = $(id);
            if (!btn) return;
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                isOpen ? close() : open();
            }, true);
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && isOpen) close();
        });

        window.LZXAppearance = { open: open, close: close, motionOn: motionOn };
    }

    /* ---------------- 3a. 低功耗模式 ----------------
       停掉所有 JS 驱动的循环（数字雨 / 贡献墙蛇 / 频谱）+ 关毛玻璃与 CSS 动画。
       存 lzx.lowpower = 'on' | 'off'；没存过时：系统开了「省流量」才自动开启。 */
    var LZXPower = window.LZXPower = (function () {
        function stored() { try { return localStorage.getItem('lzx.lowpower'); } catch (e) { return null; } }
        function auto() { var c = navigator.connection; return !!(c && c.saveData); }
        function on() { var v = stored(); return v === 'on' ? true : v === 'off' ? false : auto(); }
        function apply() {
            document.documentElement.classList.toggle('lzx-lowpower', on());
            try { document.dispatchEvent(new CustomEvent('lzx:power', { detail: { on: on() } })); } catch (e) {}
        }
        function set(v) { try { localStorage.setItem('lzx.lowpower', v ? 'on' : 'off'); } catch (e) {} apply(); }
        return { on: on, set: set, toggle: function () { set(!on()); return on(); }, apply: apply };
    })();
    LZXPower.apply();

    /* ---------------- 3. 动效开关 ---------------- */
    function applyMotion() {
        var off = localStorage.getItem('lzx.motion') === 'off';
        var sys = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        document.documentElement.classList.toggle('lzx-reduce', off || (sys && localStorage.getItem('lzx.motion') !== 'on'));
    }
    function toggleMotion() {
        var off = localStorage.getItem('lzx.motion') === 'off';
        localStorage.setItem('lzx.motion', off ? 'on' : 'off');
        applyMotion();
        var mo = $('lzx-pk-motion');
        if (mo) { mo.classList.toggle('on', !off); mo.textContent = off ? 'ON' : 'OFF'; }
    }

    /* ---------------- 4. 成就墙 ---------------- */
    var wall = null, wallOpen = false;

    function initAchEntry() {
        /* 顶栏加奖杯按钮 */
        var anchor = $('theme-toggle');
        if (anchor && !$('ach-toggle')) {
            var b = document.createElement('button');
            b.id = 'ach-toggle';
            b.className = 'theme-toggle';
            b.title = 'Achievements';
            b.innerHTML = '<i class="fas fa-trophy"></i>';
            anchor.parentNode.insertBefore(b, anchor);
            b.addEventListener('click', openAchWall);
        }
        /* 手机端 */
        var mAnchor = $('mobile-theme-toggle');
        if (mAnchor && !$('m-ach-toggle')) {
            var mb = document.createElement('button');
            mb.id = 'm-ach-toggle';
            mb.className = 'theme-toggle';
            mb.title = 'Achievements';
            mb.innerHTML = '<i class="fas fa-trophy"></i>';
            mAnchor.parentNode.insertBefore(mb, mAnchor);
            mb.addEventListener('click', openAchWall);
        }
    }

    function openAchWall() {
        if (!window.LZXAch) return;
        if (!wall) {
            wall = document.createElement('div');
            wall.className = 'lzx-achwall';
            document.body.appendChild(wall);
            wall.addEventListener('click', function (e) {
                if (e.target === wall || e.target.closest('.lzx-aw-x')) closeAchWall();
            });
            document.addEventListener('keydown', function (e) {
                if (e.key === 'Escape' && wallOpen) closeAchWall();
            });
        }
        renderAchWall();
        void wall.offsetWidth;
        requestAnimationFrame(function () { wall.classList.add('show'); });
        document.body.classList.add('lzx-modal');
        wallOpen = true;
    }
    function closeAchWall() {
        if (wall) wall.classList.remove('show');
        document.body.classList.remove('lzx-modal');
        wallOpen = false;
    }

    var wallLang = 'en';

    function renderAchWall() {
        var list = window.LZXAch.list();
        var total = window.LZXAch.total();
        var zh = (window.LZXAch.lang ? window.LZXAch.lang() : (document.documentElement.lang === 'zh-CN' ? 'zh' : 'en')) === 'zh';
        var done = list.filter(function (a) { return a.at; });
        var todo = list.filter(function (a) { return !a.at; });
        var n = done.length;
        var pct = total ? n / total : 0;
        var R = 26, CIRC = 2 * Math.PI * R;

        function card(a) {
            var date = '';
            if (a.at) {
                var d = new Date(a.at);
                date = d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0');
            }
            var main = zh ? a.zh : a.en;
            var sub = zh ? a.en : a.zh;
            var desc = zh ? a.desc : (a.descEn || a.desc);
            return '<div class="lzx-aw-item ' + (a.at ? 'on' : '') + '">' +
              '<span class="lzx-aw-badge">' + (a.icon || '◆') + '</span>' +
              '<div class="lzx-aw-body">' +
                '<div class="lzx-aw-line"><b>' + main + '</b><span>' + sub + '</span></div>' +
                '<p>' + desc + '</p>' +
                (date ? '<em class="lzx-aw-date">' + date + '</em>' : '') +
              '</div>' +
            '</div>';
        }

        var T = zh ? {
            title: '成就墙', titleSub: 'ACHIEVEMENTS',
            unlocked: '已解锁 ', locked: '待解锁 ',
            secOn: '已解锁 / UNLOCKED', secOff: '待解锁 / LOCKED',
            allClear: 'ALL CLEAR',
            footDone: '全部完成 — 没有更多可解锁的了',
            footTodo: '继续探索 · 每个覆盖层里都藏着成就',
            close: '关闭'
        } : {
            title: 'ACHIEVEMENTS', titleSub: 'ACHIEVEMENT WALL',
            unlocked: 'UNLOCKED ', locked: 'LOCKED ',
            secOn: 'UNLOCKED', secOff: 'LOCKED',
            allClear: 'ALL CLEAR',
            footDone: 'All done — nothing left to unlock',
            footTodo: 'Keep exploring · every overlay hides a few',
            close: 'Close'
        };

        wall.innerHTML =
            '<div class="lzx-aw-card">' +
              '<div class="lzx-aw-head">' +
                '<div class="lzx-aw-title"><b>' + T.title + '</b><em>' + T.titleSub + '</em></div>' +
                '<div class="lzx-aw-prog">' +
                  '<svg viewBox="0 0 64 64" aria-hidden="true">' +
                    '<circle cx="32" cy="32" r="' + R + '" class="ring-bg"/>' +
                    '<circle cx="32" cy="32" r="' + R + '" class="ring-fg" stroke-dasharray="' + (CIRC * pct).toFixed(1) + ' ' + CIRC.toFixed(1) + '"/>' +
                  '</svg>' +
                  '<div class="lzx-aw-prog-num"><b>' + n + '</b><span>/' + total + '</span></div>' +
                '</div>' +
                '<button class="lzx-aw-x" aria-label="' + T.close + '">×</button>' +
              '</div>' +
              '<div class="lzx-aw-sum">' +
                '<span class="on">' + T.unlocked + done.length + '</span>' +
                '<span>' + T.locked + todo.length + '</span>' +
                '<em>' + (n === total ? T.allClear : Math.round(pct * 100) + '% COMPLETE') + '</em>' +
              '</div>' +
              (done.length ? '<div class="lzx-aw-sec">' + T.secOn + '</div><div class="lzx-aw-grid">' + done.map(card).join('') + '</div>' : '') +
              (todo.length ? '<div class="lzx-aw-sec">' + T.secOff + '</div><div class="lzx-aw-grid dim">' + todo.map(card).join('') + '</div>' : '') +
              '<div class="lzx-aw-foot">' + (n === total ? T.footDone : T.footTodo) + '</div>' +
            '</div>';
        wallLang = zh ? 'zh' : 'en';
    }

    /* ---------------- 5. PWA ---------------- */
    function initPWA() {
        if (!('serviceWorker' in navigator)) return;
        if (location.protocol === 'file:') return;
        try {
            navigator.serviceWorker.register('./sw.js').catch(function () {});
        } catch (e) {}
    }


    /* ---------------- 6. GitHub 贡献墙（自动贪吃蛇） ---------------- */
    function initGHWall() {
        var wall = document.getElementById('gh-wall');
        var cv = document.getElementById('gh-canvas');
        if (!wall || !cv) return;
        var ctx = cv.getContext('2d');
        var COLS = 53, ROWS = 7;
        var visCols = COLS, startCol = 0;

        var cells = [];          /* 0-4 贡献等级 */
        var litAt = [];          /* 被蛇吃掉的格子点亮时间，用于淡入 */
        var eatenAt = [];        /* 被吃掉后留下的空洞，2.6s 后慢慢回填（snk 那种吃格子） */
        var baseTotal = 0;
        var remoteOK = false;
        var showRemote = false;

        var snake = null;
        var raf = 0, prevTs = 0;

        function syncVis() {
            visCols = (window.innerWidth < 768) ? 26 : COLS;
            startCol = COLS - visCols;
        }

        function mulberry(seed) {
            return function () {
                seed |= 0; seed = seed + 0x6D2B79F5 | 0;
                var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
                t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
                return ((t ^ t >>> 14) >>> 0) / 4294967296;
            };
        }

        /* 本地示例：刻意做得「满」一点，看起来有内容 */
        function buildLocal() {
            var r = mulberry(20261121);
            for (var w = 0; w < COLS; w++) {
                for (var d = 0; d < ROWS; d++) {
                    var weekend = (d === 0 || d === 5 || d === 6);
                    var p = weekend ? 0.62 : 0.95;
                    var lv = 0;
                    if (r() < p) {
                        var q = r();
                        lv = q < 0.3 ? 2 : q < 0.62 ? 3 : 4;
                    }
                    cells[d * COLS + w] = lv;
                }
            }
            baseTotal = cells.reduce(function (a, b) { return a + (b ? b * 3 : 0); }, 0);
        }

        function applyContribs(list) {
            var map = {};
            list.forEach(function (c) { if (c && c.date) map[c.date] = c; });
            var today = new Date(); today.setHours(0, 0, 0, 0);
            var dow = today.getDay();
            var start = new Date(today.getTime() - ((COLS - 1) * 7 + dow) * 86400000);
            var total = 0;
            for (var col = 0; col < COLS; col++) {
                for (var row = 0; row < ROWS; row++) {
                    var d = new Date(start.getTime() + (col * 7 + row) * 86400000);
                    var k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
                    var c = map[k];
                    cells[row * COLS + col] = c ? Math.max(0, Math.min(4, c.level != null ? c.level : (c.count ? 1 : 0))) : 0;
                    if (c) total += (c.count || 0);
                }
            }
            baseTotal = total;
        }

        function setSub(txt) { var e = document.getElementById('gh-sub'); if (e) e.textContent = txt; }

        /* 拉真实数据；失败就老老实实说不行，不假装 */
        function loadRemote(onDone) {
            var urls = [
                'https://github-contributions-api.jogruber.de/v4/loopzlx?y=last',
                'https://github-contributions-api.deno.dev/loopzlx',
                'https://github-contributions-api.deno.dev/loopzlx?y=last'
            ];
            var idx = 0;
            function tryNext() {
                if (idx >= urls.length) { if (onDone) onDone(false); return; }
                var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
                var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 6500);
                fetch(urls[idx++], ctrl ? { signal: ctrl.signal, cache: 'no-store' } : { cache: 'no-store' })
                    .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
                    .then(function (j) {
                        clearTimeout(timer);
                        var list = j && (j.contributions || j.data);
                        if (!list || !list.length) throw new Error('empty');
                        applyContribs(list);
                        remoteOK = true;
                        if (onDone) onDone(true);
                    })
                    .catch(function () { clearTimeout(timer); tryNext(); });
            }
            tryNext();
        }

        /* ---------- 颜色工具 ---------- */
        function toRgb(str, fallback) {
            try {
                var c = document.createElement('canvas').getContext('2d');
                c.fillStyle = '#000'; c.fillStyle = str;
                var v = c.fillStyle;
                if (v.charAt(0) !== '#') return fallback;
                return [parseInt(v.substr(1, 2), 16), parseInt(v.substr(3, 2), 16), parseInt(v.substr(5, 2), 16)];
            } catch (e) { return fallback; }
        }
        var palCache = null, palCls = '';
        function palette() {
            /* 每帧读 getComputedStyle 很贵：主题类不变就复用上次的结果 */
            var cls = document.documentElement.className;
            if (palCache && cls === palCls) return palCache;
            palCls = cls;
            palCache = {
                primary: toRgb(getComputedStyle(document.documentElement).getPropertyValue('--primary').trim(), [138, 43, 226]),
                secondary: toRgb(getComputedStyle(document.documentElement).getPropertyValue('--secondary').trim(), [255, 0, 255]),
                muted: toRgb(getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim(), [120, 120, 140])
            };
            return palCache;
        }
        function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
        function levelColor(lv, P) {
            if (lv <= 0) return rgba(P.muted, 0.16);
            return rgba(P.primary, [0.26, 0.42, 0.66, 0.95][Math.min(lv, 4) - 1]);
        }

        /* ---------- 尺寸 / 绘制 ---------- */
        var mCache = null, mKey = '';
        function metrics() {
            syncVis();
            /* 每帧读 clientWidth 会打断布局缓存：宽度/可视列数不变就复用上次结果 */
            var w = cv.clientWidth || (wall.clientWidth - 40);
            var key = Math.round(w) + ':' + visCols;
            if (mCache && key === mKey) return mCache;
            mKey = key;
            var gap = Math.max(1, Math.round(w / visCols * 0.16));
            var cell = (w - gap * (visCols - 1)) / visCols;
            var h = cell * ROWS + gap * (ROWS - 1);
            mCache = { w: w, cell: cell, gap: gap, h: h };
            return mCache;
        }
        function roundRect(c, x, y, w, h, r) {
            r = Math.max(0.5, Math.min(r, w / 2, h / 2));
            c.beginPath();
            c.moveTo(x + r, y);
            c.arcTo(x + w, y, x + w, y + h, r);
            c.arcTo(x + w, y + h, x, y + h, r);
            c.arcTo(x, y + h, x, y, r);
            c.arcTo(x, y, x + w, y, r);
            c.closePath(); c.fill();
        }


        var gcv = null, gctx = null, gDirty = true, gKey = '', gTick = 0;
        function renderGrid(P, m, dpr, now, W, H) {
            if (!gcv) { gcv = document.createElement('canvas'); gctx = gcv.getContext('2d'); }
            if (gcv.width !== W || gcv.height !== H) { gcv.width = W; gcv.height = H; gDirty = true; }
            /* 空洞会淡出，需要低频刷新：每 ~140ms 重画一次网格 */
            var tk = Math.floor(now / 140);
            if (tk !== gTick) {
                gTick = tk;
                for (var q = 0; q < eatenAt.length; q++) {
                    if (eatenAt[q] && now - eatenAt[q] < 2600) { gDirty = true; break; }
                }
                for (var q2 = 0; q2 < litAt.length; q2++) {
                    if (litAt[q2]) { gDirty = true; break; }
                }
            }
            if (!gDirty) return;
            gDirty = false;
            gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            gctx.clearRect(0, 0, m.w, m.h);
            for (var d = 0; d < ROWS; d++) {
                for (var w = startCol; w < COLS; w++) {
                    var idx = d * COLS + w;
                    var lv = cells[idx];
                    var x = (w - startCol) * (m.cell + m.gap), y = d * (m.cell + m.gap);
                    if (litAt[idx]) {
                        var k = Math.min(1, (now - litAt[idx]) / 420);
                        if (k >= 1) { litAt[idx] = 0; lv = Math.max(lv, 4); }
                        else {
                            gctx.fillStyle = rgba(P.secondary, 0.95 - k * 0.35);
                            roundRect(gctx, x, y, m.cell, m.cell, m.cell * 0.22);
                            continue;
                        }
                    }
                    var eat = eatenAt[idx] ? (now - eatenAt[idx]) / 2600 : 2;
                    if (eat < 1) {
                        gctx.fillStyle = 'rgba(255,255,255,0.028)';
                        roundRect(gctx, x, y, m.cell, m.cell, m.cell * 0.18);
                        gctx.strokeStyle = rgba(P.primary, 0.30 * (1 - eat));
                        gctx.lineWidth = 1;
                        gctx.stroke();
                        continue;
                    }
                    gctx.fillStyle = levelColor(lv, P);
                    roundRect(gctx, x, y, m.cell, m.cell, m.cell * 0.18);
                }
            }
        }

        var lastW = 0, lastH = 0, lastDpr = 0;
        function draw(ts) {
            var P = palette();
            var m = metrics();
            if (!m.w || m.w < 24 || m.h < 12) return;   /* 容器还没宽度就别画，避免只画出上半截 */
            var dpr = Math.min(window.devicePixelRatio || 1, 2);
            var W = Math.round(m.w * dpr), H = Math.round(m.h * dpr);
            if (W !== lastW || H !== lastH || dpr !== lastDpr) {
                cv.width = W; cv.height = H;
                cv.style.height = Math.round(m.h) + 'px';
                var daysEl = wall.querySelector('.gh-wall-days');
                if (daysEl && window.innerWidth >= 768) daysEl.style.height = Math.round(m.h) + 'px';
                lastW = W; lastH = H; lastDpr = dpr;
                gDirty = true;
            }
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, m.w, m.h);

            var now = Date.now();
            /* 静态网格画到离屏画布，只在数据/尺寸/主题变化时重画 —— 每帧只贴图，省掉 370 次圆角绘制 */
            renderGrid(P, m, dpr, now, W, H);
            if (gcv.width) ctx.drawImage(gcv, 0, 0, m.w, m.h);

            if (snake) {
                var pulse = 0.55 + 0.45 * Math.sin(now / 260);
                if (snake.food) {
                    /* 不再用 shadowBlur 做发光（每帧模糊极耗，平板/手机直接掉帧）：
                       改成「一层大的半透明圆 + 一层实心圆」，视觉接近但不走滤镜 */
                    var fx0 = (snake.food.x - startCol) * (m.cell + m.gap);
                    var fy0 = snake.food.y * (m.cell + m.gap);
                    var fcx = fx0 + m.cell / 2, fcy = fy0 + m.cell / 2;
                    ctx.fillStyle = rgba(P.secondary, 0.10 + 0.10 * pulse);
                    ctx.beginPath(); ctx.arc(fcx, fcy, m.cell * (0.85 + 0.12 * pulse), 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = rgba(P.secondary, 0.55 + 0.35 * pulse);
                    ctx.beginPath(); ctx.arc(fcx, fcy, m.cell * 0.32, 0, Math.PI * 2); ctx.fill();
                }

                var p = snake.progress;
                /* 每步先快后慢一点，脖子不会硬生生停住 */
                var pe = p;
                var pts = [];
                var phase = now / 210;
                var nx = -snake.dir.y, ny = snake.dir.x;
                for (var i = snake.body.length - 1; i >= 0; i--) {
                    var cur = snake.body[i];
                    var nxt = (i === 0) ? snake.nextCell : snake.body[i - 1];
                    var px = cur.x + ((nxt ? nxt.x : cur.x) - cur.x) * pe;
                    var py = cur.y + ((nxt ? nxt.y : cur.y) - cur.y) * pe;
                    var sway = i === 0 ? 0 : Math.sin(phase - i * 0.85) * m.cell * 0.10 * (i / snake.body.length + 0.25);
                    pts.push({
                        x: (px - startCol) * (m.cell + m.gap) + m.cell / 2 + nx * sway,
                        y: py * (m.cell + m.gap) + m.cell / 2 + ny * sway
                    });
                }
                if (pts.length === 1) pts.push({ x: pts[0].x, y: pts[0].y });

                /* 外层柔光 */
                ctx.save();
                ctx.lineJoin = 'round'; ctx.lineCap = 'round';
                ctx.strokeStyle = rgba(P.secondary, 0.26);
                ctx.lineWidth = m.cell * 0.92;
                strokePath(ctx, pts);
                ctx.restore();

                /* 主体：头亮尾淡的一整条 */
                var g = ctx.createLinearGradient(pts[0].x, pts[0].y, pts[pts.length - 1].x, pts[pts.length - 1].y);
                g.addColorStop(0, rgba(P.primary, 0.32));
                g.addColorStop(0.6, rgba(P.primary, 0.86));
                g.addColorStop(1, rgba(P.secondary, 1));
                ctx.save();
                ctx.lineJoin = 'round'; ctx.lineCap = 'round';
                ctx.lineWidth = m.cell * 0.72;
                ctx.strokeStyle = g;
                strokePath(ctx, pts);
                ctx.restore();

                /* 脑袋 + 眼睛，朝着前进方向 */
                var hp = pts[pts.length - 1], hx = hp.x, hy = hp.y, d = snake.dir;
                ctx.fillStyle = rgba(P.secondary, 1);
                var hr = m.cell * (0.455 + 0.025 * Math.sin(now / 170));
                ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI * 2); ctx.fill();
                var ox = -d.y * m.cell * 0.17, oy = d.x * m.cell * 0.17;
                ctx.fillStyle = 'rgba(10,10,18,.9)';
                ctx.beginPath(); ctx.arc(hx + ox + d.x * m.cell * 0.12, hy + oy + d.y * m.cell * 0.12, Math.max(0.9, m.cell * 0.08), 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(hx - ox + d.x * m.cell * 0.12, hy - oy + d.y * m.cell * 0.12, Math.max(0.9, m.cell * 0.08), 0, Math.PI * 2); ctx.fill();
            }
        }

        function strokePath(c, pts) {
            if (!pts.length) return;
            c.beginPath();
            c.moveTo(pts[0].x, pts[0].y);
            for (var i = 1; i < pts.length; i++) {
                var a = pts[i - 1], b = pts[i];
                /* 用二次曲线把拐角磨圆，看起来更"活" */
                c.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
                c.lineTo(b.x, b.y);
            }
            c.stroke();
        }

        /* ---------- 自动贪吃蛇：自己找豆吃，撞不到就随机拐弯 ---------- */
        function freeCell(x, y, body) {
            if (x < startCol || x >= COLS || y < 0 || y >= ROWS) return false;
            for (var i = 0; i < body.length - 1; i++) if (body[i].x === x && body[i].y === y) return false;
            return true;
        }
        function pickFood(body) {
            var used = {};
            body.forEach(function (b) { used[b.x + ',' + b.y] = 1; });
            for (var k = 0; k < 300; k++) {
                var x = startCol + Math.floor(Math.random() * visCols), y = Math.floor(Math.random() * ROWS);
                if (!used[x + ',' + y]) return { x: x, y: y };
            }
            return { x: Math.floor(visCols / 2) + startCol, y: 3 };
        }
        function chooseDir() {
            var head = snake.body[0];
            var cand = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }].filter(function (d) {
                return freeCell(head.x + d.x, head.y + d.y, snake.body);
            });
            if (!cand.length) return null;
            /* 不允许 180° 掉头（除非只剩这一条路） */
            var notBack = cand.filter(function (d) { return !(d.x === -snake.dir.x && d.y === -snake.dir.y); });
            if (notBack.length) cand = notBack;
            var food = snake.food || head;
            var best = null, bestD = 1e9;
            cand.forEach(function (d) {
                var dist = Math.abs(head.x + d.x - food.x) + Math.abs(head.y + d.y - food.y);
                dist += Math.random() * 2.2;      /* 一点随机，避免每次都死板贴边 */
                if (dist < bestD) { bestD = dist; best = d; }
            });
            return best || cand[0];
        }

        function stepSnake() {
            var d = chooseDir();
            if (!d) { resetSnake(); return; }
            snake.dir = d;
            snake.nextCell = { x: snake.body[0].x + d.x, y: snake.body[0].y + d.y };
            snake.body.unshift({ x: snake.nextCell.x, y: snake.nextCell.y });
            var idx = snake.nextCell.y * COLS + snake.nextCell.x;
            if (snake.food && snake.nextCell.x === snake.food.x && snake.nextCell.y === snake.food.y) {
                litAt[idx] = Date.now();
                eatenAt[idx] = Date.now();
                gDirty = true;
                snake.boostUntil = Date.now() + 700;
                cells[idx] = 4;
                snake.score++;
                updateScore();
                snake.food = pickFood(snake.body);
                if (snake.score >= 45) { resetSnake(); return; }
            }
            while (snake.body.length > snake.len) snake.body.pop();
            snake.nextCell = { x: snake.body[0].x + snake.dir.x, y: snake.body[0].y + snake.dir.y };
            snake.progress = 0;
        }

        function resetSnake() {
            var cy = 3, cx = startCol + Math.floor(visCols * 0.3);
            snake.body = [{ x: cx, y: cy }, { x: cx - 1, y: cy }, { x: cx - 2, y: cy }, { x: cx - 3, y: cy }];
            snake.dir = { x: 1, y: 0 };
            snake.len = 4;
            snake.score = 0;
            snake.progress = 0;
            snake.nextCell = { x: cx + 1, y: cy };
            snake.food = pickFood(snake.body);
            updateScore();
        }

        /* 蛇/网格跑在 rAF 里，贡献墙滚出视口后就不该再占帧 */
        var ghOnScreen = true;
        if (window.IntersectionObserver) {
            new IntersectionObserver(function (es) {
                ghOnScreen = es[0].isIntersecting;
                if (ghOnScreen && !raf) { prevTs = 0; raf = requestAnimationFrame(loop); }
            }, { threshold: 0.05 }).observe(wall);
        }

        document.addEventListener('lzx:power', function (e) { if (!e.detail.on && ghOnScreen && !raf) { prevTs = 0; raf = requestAnimationFrame(loop); } });
        var lastPaint = 0;
        var FRAME_CAP = (window.matchMedia && window.matchMedia('(pointer:coarse)').matches) || window.innerWidth < 820;
        function loop(ts) {
            if (!ghOnScreen || (window.LZXPower && window.LZXPower.on())) { raf = 0; return; }
            if (!prevTs) prevTs = ts;
            var minGap = !snake ? 140 : (FRAME_CAP ? 30 : 0);
            if (minGap && ts - lastPaint < minGap) { raf = requestAnimationFrame(loop); return; }
            lastPaint = ts;
            var dt = Math.min(64, ts - prevTs);
            prevTs = ts;
            if (snake) {
                var stepMs = (snake.boostUntil && Date.now() < snake.boostUntil) ? snake.stepMs * 0.72 : snake.stepMs;
                snake.progress += dt / stepMs;
                while (snake.progress >= 1) { snake.progress -= 1; stepSnake(); if (!snake) break; }
            }
            draw(ts);
            raf = requestAnimationFrame(loop);
        }

        function startSnake() {
            snake = { body: [], dir: { x: 1, y: 0 }, nextCell: null, len: 4, score: 0, progress: 0, stepMs: 96, food: null };
            resetSnake();
            var btn = document.getElementById('gh-snake-toggle');
            if (btn) { btn.classList.add('on'); btn.title = 'Snake running'; }
        }
        function stopSnake() {
            snake = null;
            var btn = document.getElementById('gh-snake-toggle');
            if (btn) btn.classList.remove('on');
        }

        /* ---------- 统计 / 文案 ---------- */
        function fillStats() {
            var streak = 0, run = 0, best = 0, activeDays = 0;
            for (var d = 0; d < ROWS; d++) {
                for (var w = 0; w < COLS; w++) {
                    var lv = cells[d * COLS + w];
                    if (lv > 0) {
                        activeDays++; run++;
                        if (run > streak) streak = run;
                        var v = lv * 3;
                        if (v > best) best = v;
                    } else run = 0;
                }
            }
            var zh = document.documentElement.lang === 'zh-CN';
            var e1 = document.getElementById('gh-stat-streak');
            var e2 = document.getElementById('gh-stat-best');
            var e3 = document.getElementById('gh-stat-rate');
            if (e1) e1.textContent = streak + (zh ? ' 天' : 'd');
            if (e2) e2.textContent = best + '×';
            if (e3) e3.textContent = Math.round(activeDays / (COLS * ROWS) * 100) + '%';
        }
        function updateScore() {
            var sc = document.getElementById('gh-score');
            if (sc) sc.innerHTML = '<b>' + (snake ? snake.score : 0) + '</b><span>SCORE</span>';
            var tot = document.getElementById('gh-total');
            if (tot) {
                var zh = document.documentElement.lang === 'zh-CN';
                tot.textContent = (baseTotal + (snake ? snake.score * 3 : 0)).toLocaleString() + (zh ? ' 次贡献 · 近一年' : ' contributions · past year');
            }
        }

        /* ---------- 月份 / 交互 ---------- */
        function renderMonths() {
            var box = document.getElementById('gh-months');
            if (!box) return;
            var now = new Date();
            var names = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
            syncVis();
            var N = (visCols === COLS) ? 8 : 4, html = '';
            for (var i = 0; i < N; i++) {
                var wIdx = startCol + Math.round(i * (visCols - 1) / (N - 1));
                var d = new Date(now.getTime() - (COLS - 1 - wIdx) * 7 * 86400000);
                html += '<span style="left:' + ((wIdx - startCol) / Math.max(1, visCols - 1) * 100).toFixed(2) + '%">' + names[d.getMonth()] + '</span>';
            }
            box.innerHTML = html;
        }

        var snakeBtn = document.getElementById('gh-snake-toggle');
        if (snakeBtn) snakeBtn.addEventListener('click', function () { if (snake) stopSnake(); else startSnake(); });

        /* 很小的入口：切换「本地满墙」↔「我的真实 GitHub 贡献」 */
        var srcBtn = document.getElementById('gh-src-toggle');
        if (srcBtn) srcBtn.addEventListener('click', function () {
            if (!showRemote) {
                srcBtn.classList.add('on');
                srcBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                setSub('FETCHING GITHUB…');
                loadRemote(function (ok) {
                    srcBtn.innerHTML = ok ? 'GH' : 'GH';
                    if (ok) {
                        showRemote = true;
                        setSub('LIVE · GITHUB.COM/LOOPZLX · PAST YEAR');
                        srcBtn.classList.add('on');
                    } else {
                        showRemote = false;
                        srcBtn.classList.remove('on');
                        setSub('GITHUB UNREACHABLE · LOCAL SAMPLE');
                    }
                    fillStats(); updateScore(); draw();
                });
            } else {
                showRemote = false;
                srcBtn.classList.remove('on');
                buildLocal();
                setSub('FULL SAMPLE · TAP GH FOR LIVE DATA');
                fillStats(); updateScore(); draw();
            }
        });

        var lastThemeCls = document.documentElement.className;
        var lastLang = document.documentElement.lang;
        setInterval(function () {
            if (document.documentElement.className !== lastThemeCls) { lastThemeCls = document.documentElement.className; gDirty = true; draw(); }
            if (document.documentElement.lang !== lastLang) { lastLang = document.documentElement.lang; fillStats(); updateScore(); }
        }, 800);

        window.addEventListener('resize', function () { renderMonths(); draw(); });

        buildLocal();
        renderMonths();
        renderStack();
        fillStats();
        updateScore();
        setSub('FULL SAMPLE · TAP GH FOR LIVE DATA');
        draw();
        setTimeout(draw, 300);
        prevTs = 0;
        startSnake();
        raf = requestAnimationFrame(loop);
        window.LZXSnake = { start: startSnake, stop: stopSnake };
    }

    /* B 方案：语言占比 + 最近提交（全部来自真实数据，不再写死） */
    var STACK_FILES = [
        'css/celeste.css', 'css/gamehub.css', 'css/osu.css',
        'css/style.css', 'html/celeste/celeste.html', 'html/gamehub/gamehub.html',
        'html/home/home.html', 'html/osu/osu.html',
        'index.html', 'js/celeste/celeste-boot.js', 'js/celeste/celeste-core.js',
        'js/celeste/celeste-editor.js', 'js/celeste/celeste-level.js', 'js/celeste/celeste-player.js',
        'js/celeste/celeste-render.js', 'js/celeste/celeste-settings.js', 'js/celeste/celeste-ui.js',
        'js/gamehub/game-2048.js', 'js/gamehub/gamehub-core.js', 'js/gamehub/gamehub-i18n.js',
        'js/gamehub/game-minesweeper.js', 'js/gamehub/game-snake.js', 'js/home/core/achievements.js',
        'js/home/core/audio-player.js', 'js/home/core/celeste-loader.js', 'js/home/core/gamehub-loader.js',
        'js/home/core/main.js',
        'js/home/core/osu-loader.js', 'js/home/core/toolkit.js', 'js/home/core/ui-extras.js',
        'js/osu/osu-audio.js', 'js/osu/osu-beatmap.js', 'js/osu/osu-boot.js',
        'js/osu/osu-core.js', 'js/osu/osu-game.js', 'js/osu/osu-i18n.js',
        'js/osu/osu-mode-catch.js', 'js/osu/osu-mode-mania.js', 'js/osu/osu-mode-standard.js',
        'js/osu/osu-mode-taiko.js', 'js/osu/osu-replay.js', 'js/osu/osu-settings.js',
        'js/osu/osu-ui.js', 'load.html', 'README.txt',
        'sw.js'
    ];
    var STACK_LABEL = { js: 'JAVASCRIPT', css: 'CSS', html: 'HTML', txt: 'DOCS', md: 'DOCS' };
    var stackCache = null;

    /* v6.7.1：一次性把四行组装好，宽度直接写死进 style。
       之前用 setTimeout 逐行补宽度：浏览器一旦节流/丢定时器，条就永远是 0 宽，
       看起来像「MIX 只剩一行」。现在没有任何异步依赖，渲染即成品。 */
    function stackRender(rows) {
        var box = document.getElementById('gh-stack-bars');
        if (!box) return;
        if (!rows || rows.length < 2) return;   /* 探测失败别用残缺结果覆盖完整快照 */
        var html = '';
        rows.forEach(function (d, i) {
            var v = Math.max(0, Math.min(100, Number(d.v) || 0));
            /* 行内只写宽度：颜色/渐变交给 CSS 类，行内 var() 在部分 WebView 上会失效，
               导致某一行的条完全看不见；opacity 递减也会让最后一行淡到像丢了。 */
            html += '<div class="gh-stack-row">'
                + '<span class="gh-stack-name">' + d.n + '</span>'
                + '<span class="gh-stack-track">'
                + '<i class="gh-stack-fill" style="width:' + v + '%"></i>'
                + '</span>'
                + '<span class="gh-stack-val">' + v + '%</span>'
                + '</div>';
        });
        box.innerHTML = html;
    }

    function renderStack() {
        if (stackCache) { stackRender(stackCache); return; }
        /* 先给一份按本地快照统计的真实值，HTTP 探测成功后再覆盖 */
        stackRender([
            { n: 'JAVASCRIPT', v: 64 }, { n: 'CSS', v: 20 }, { n: 'HTML', v: 8 }, { n: 'DOCS', v: 8 }
        ]);
        var sizes = {};
        Promise.all(STACK_FILES.map(function (f) {
            return fetch(f, { method: 'HEAD', cache: 'no-store' }).then(function (r) {
                if (!r.ok) return 0;
                return Number(r.headers.get('Content-Length') || 0);
            }).catch(function () { return 0; });
        })).then(function (list) {
            var agg = {};
            STACK_FILES.forEach(function (f, i) {
                if (!list[i]) return;
                var ext = f.split('.').pop().toLowerCase();
                var key = ext === 'txt' || ext === 'md' ? 'txt' : ext;
                agg[key] = (agg[key] || 0) + list[i];
            });
            var total = 0; Object.keys(agg).forEach(function (k) { total += agg[k]; });
            if (!total) return;
            var rows = Object.keys(agg).map(function (k) {
                return { k: k, v: Math.round(agg[k] / total * 100) };
            }).sort(function (a, b) { return b.v - a.v; }).slice(0, 4);
            stackCache = rows.map(function (r) { return { n: STACK_LABEL[r.k] || r.k.toUpperCase(), v: r.v }; });
            stackRender(stackCache);
        });
        /* 仓库数量 / 星 / 置顶：ungh 镜像（GitHub API 匿名限流时仍可用） */
        fetch('https://ungh.cc/users/loopzlx/repos', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
            var repos = (j && j.repos) || [];
            if (!repos.length) return;
            var stars = repos.reduce(function (a, b) { return a + (b.stars || 0); }, 0);
            var last = repos[0] && repos[0].pushedAt ? repos[0].pushedAt : '';
            var note = document.getElementById('gh-stack-note');
            if (note) {
                var zh = document.documentElement.lang === 'zh-CN';
                note.textContent = repos.length + (zh ? ' 个仓库 · ★ ' : (repos.length === 1 ? ' repo · ★ ' : ' repos · ★ ')) + stars + (zh ? ' · 置顶 1' : ' · 1 pinned');
            }
            var repoEl = document.getElementById('gh-stack-repo');
            if (repoEl && repos[0].repo) repoEl.textContent = repos[0].repo;
            if (last) {
                var em = document.querySelector('.gh-stack-last em');
                if (em) em.textContent = '· ' + relTime(last) + ' ago';
            }
        }).catch(function () {
            fetch('https://api.github.com/users/loopzlx/repos', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (repos) {
                if (!Array.isArray(repos) || !repos.length) return;
                var note = document.getElementById('gh-stack-note');
                if (note) note.textContent = repos.length + ' repos · ★ ' + repos.reduce(function (a, b) { return a + (b.stargazers_count || 0); }, 0);
            }).catch(function () { });
        });
    }

    function relTime(iso) {
        var t = Date.parse(iso); if (!t) return '';
        var h = Math.max(0, Math.round((Date.now() - t) / 3600000));
        if (h < 1) return 'now';
        if (h < 24) return h + 'h';
        return Math.round(h / 24) + 'd';
    }

    /* 播放器：首屏不显示，往下滑淡入；进入任一覆盖层常驻 */
    function initPlayerReveal() {
        var wrap = document.getElementById('audio-wrapper');
        if (!wrap) return;
        var OVERLAY = ['osu-open', 'gamehub-open', 'celeste-open'];
        var logWin = document.getElementById('log-window');
        function sync() {
            var overlay = OVERLAY.some(function (c) { return document.body.classList.contains(c); });
            var show = overlay || window.scrollY > 240 || window.innerHeight < 520;
            wrap.classList.toggle('is-visible', show);
            /* 日志窗现在在「I/O 接口」命令行下方，属于文档流，常显，不参与浮层显隐；
               于是它再也不会压住 STACK MIX 的 bar / 百分比。 */
            if (logWin && logWin.classList.contains('is-visible') && !logWin.closest('#transmission')) {
                logWin.classList.remove('is-visible');
            }
        }
        window.addEventListener('scroll', sync, { passive: true });
        window.addEventListener('resize', sync);
        setInterval(sync, 500);
        sync();
    }

    function boot() {
        applyMotion();
        initSpectrum();
        initPlayerReveal();
        initThemePicker();
        initAchEntry();
        initPWA();
        initGHWall();
        /* 语言切换时若成就墙正开着，直接重绘一遍（不再显示中英混排） */
        setInterval(function () {
            if (!wallOpen || !wall) return;
            var cur = (window.LZXAch && window.LZXAch.lang) ? window.LZXAch.lang() : (document.documentElement.lang === 'zh-CN' ? 'zh' : 'en');
            if (cur !== wallLang) renderAchWall();
        }, 700);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 60); });
    else setTimeout(boot, 60);

    window.LZXUIExtras = { achWall: openAchWall };
})();
