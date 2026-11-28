/* celeste-settings.js —— 设置存储：键位映射 / 触屏布局 / MOD 与异变模式
   全部落在 localStorage('celeste.settings.v2')，导入导出走独立文件，不改动站点其它配置。 */
(function () {
    'use strict';
    var Celeste = window.Celeste;
    var KEY = 'celeste.settings.v2';

    /* ---------------- 默认键位（每个动作一组 keyCode，第一个是主键） ---------------- */
    var DEFAULT_KEYS = {
        left: ['ArrowLeft', 'KeyA'],
        right: ['ArrowRight', 'KeyD'],
        up: ['ArrowUp', 'KeyW'],
        down: ['ArrowDown', 'KeyS'],
        jump: ['Space', 'KeyK'],
        dash: ['KeyZ', 'KeyJ'],
        grab: ['ShiftLeft', 'KeyL'],
        demo: ['KeyX']
    };

    var ACTION_LABEL = {
        left: '左移', right: '右移', up: '上', down: '下 / 蹲',
        jump: '跳跃', dash: '冲刺', grab: '抓墙', demo: '蹲冲 DemoDash'
    };

    /* ---------------- 默认触屏布局 ----------------
       坐标 x/y 是相对画面宽高的 0–1；按钮 w/h 也是比例；
       stick.w 是「短边百分比」（0.26 = 26vmin），保证任何屏幕比例下都是正圆。 */
    var DEFAULT_PAD = {
        stick: { x: 0.055, y: 0.56, w: 0.30, dead: 0.20, on: true },
        buttons: [
            { k: 'jump', x: 0.835, y: 0.66, w: 0.145, h: 0.235, label: 'JUMP' },
            { k: 'dash', x: 0.685, y: 0.49, w: 0.125, h: 0.165, label: 'DASH' },
            { k: 'grab', x: 0.685, y: 0.685, w: 0.125, h: 0.165, label: 'GRAB' },
            { k: 'demo', x: 0.685, y: 0.865, w: 0.125, h: 0.115, label: 'DEMO' }
        ]
    };

    /* ---------------- MOD / 异变模式默认（全关 = 原版手感） ---------------- */
    var DEFAULT_MODS = {
        speedX: false,       /* 头顶横向速度（白字黑边） */
        speedY: false,       /* 头顶纵向速度（白字黑边） */
        stamina: true,       /* 头顶体力条（爬墙体力 110） */
        infDash: false,      /* 无限冲刺 */
        gravity: 1,          /* 重力倍率 0–2 */
        runMult: 1,          /* 跑速倍率 0–2 */
        ice: false,          /* 冰面：加速/减速变慢 */
        invincible: false,   /* 尖刺免疫 */
        springy: false       /* 弹簧腿：跳跃初速 ×1.35 */
    };

    function clone(o) { return JSON.parse(JSON.stringify(o)); }

    var raw = null;
    try { raw = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { raw = null; }

    var S = {
        keys: (raw && raw.keys) ? merge(DEFAULT_KEYS, raw.keys) : clone(DEFAULT_KEYS),
        pad: (raw && raw.pad && raw.pad.buttons && raw.pad.buttons.length) ? normPad(raw.pad) : clone(DEFAULT_PAD),
        mods: (raw && raw.mods) ? merge(DEFAULT_MODS, raw.mods) : clone(DEFAULT_MODS),
        padOn: (raw && raw.padOn !== undefined) ? raw.padOn : null   /* null = 自动判定 */,
        label: ACTION_LABEL
    };

    if (!S.pad.stick) S.pad.stick = clone(DEFAULT_PAD.stick);
    /* 旧版单一 speed 开关迁移成横向 / 纵向两个 */
    if (raw && raw.mods && raw.mods.speed && !raw.mods.speedX && !raw.mods.speedY) {
        S.mods.speedX = true; S.mods.speedY = true;
    }

    function merge(base, over) {
        var out = clone(base);
        for (var k in over) if (Object.prototype.hasOwnProperty.call(over, k)) out[k] = over[k];
        return out;
    }

    /* 布局归一化：补齐缺省字段，兼容旧版（纯方向键）布局 */
    function normPad(d) {
        var out = { buttons: [] };
        var arr = (d && d.buttons) || [];
        arr.forEach(function (b) {
            if (!b || !b.k) return;
            out.buttons.push({
                k: b.k, label: b.label || (ACTION_LABEL[b.k] || b.k),
                x: +b.x || 0, y: +b.y || 0,
                w: +b.w || 0.12, h: +b.h || 0.10
            });
        });
        if (d && d.stick) {
            out.stick = { x: +d.stick.x || 0, y: +d.stick.y || 0, w: +d.stick.w || 0.26, dead: +d.stick.dead || 0.26, on: d.stick.on !== false };
        }
        return out;
    }
    S.normPad = normPad;

    S.save = function () {
        try {
            localStorage.setItem(KEY, JSON.stringify({ keys: S.keys, pad: S.pad, mods: S.mods, padOn: S.padOn }));
        } catch (e) {}
    };
    /* 回归虚拟摇杆：检测此前默认方向十字布局并迁移回摇杆+动作键。
       只迁移明显属于默认 D-pad 的布局；用户自定义位置保留。 */
    if (raw && raw.pad && Array.isArray(raw.pad.buttons) && raw.pad.buttons.some(function (b) { return ['left','right','up','down'].indexOf(b.k) >= 0; })) {
        var actionOnly = raw.pad.buttons.filter(function (b) { return ['jump','dash','grab','demo'].indexOf(b.k) >= 0; });
        if (actionOnly.length >= 3) { S.pad = clone(DEFAULT_PAD); S.save(); }
    }
    S.resetKeys = function () { S.keys = clone(DEFAULT_KEYS); S.save(); };
    S.resetPad = function () { S.pad = clone(DEFAULT_PAD); S.save(); };
    S.resetMods = function () { S.mods = clone(DEFAULT_MODS); S.save(); };

    /* 键码 → 可读文本 */
    S.keyLabel = function (code) {
        if (!code) return '—';
        var map = {
            ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
            Space: 'SPACE', ShiftLeft: 'LSHIFT', ShiftRight: 'RSHIFT',
            ControlLeft: 'LCTRL', ControlRight: 'RCTRL', AltLeft: 'LALT', AltRight: 'RALT',
            Enter: 'ENTER', Tab: 'TAB', Backspace: 'BKSP', CapsLock: 'CAPS',
            Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'",
            BracketLeft: '[', BracketRight: ']', Backslash: '\\', Minus: '-', Equal: '=',
            Backquote: '`'
        };
        if (map[code]) return map[code];
        if (code.indexOf('Key') === 0) return code.slice(3);
        if (code.indexOf('Digit') === 0) return code.slice(5);
        if (code.indexOf('Numpad') === 0) return 'NUM' + code.slice(6);
        if (code.indexOf('F') === 0 && /^F\d+$/.test(code)) return code;
        return code.toUpperCase();
    };

    /* ---------------- 触屏布局：导出 / 导入 ---------------- */
    S.exportPad = function () {
        var body = '/* Celeste 触屏布局 · 由 LOOPZLX 导出 */\n' +
            'window.Celeste.setTouchLayout(' + JSON.stringify(S.pad, null, 2) + ');\n';
        var url = URL.createObjectURL(new Blob([body], { type: 'text/javascript;charset=utf-8' }));
        var a = document.createElement('a');
        a.href = url; a.download = 'celeste-pad.js';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    };

    S.importPad = function (text, cb) {
        var data = null;
        try { data = JSON.parse(text); } catch (e) {}

        /* 从 .js 文本里抠出 setTouchLayout({...}) 的那个对象（括号配平后按 JSON 解析） */
        if (!data) {
            var m = String(text).match(/setTouchLayout\s*\(/);
            if (m) {
                var from = m.index + m[0].length;
                var depth = 0, end = -1;
                for (var i = from; i < text.length; i++) {
                    var ch = text.charAt(i);
                    if (ch === '{') depth++;
                    else if (ch === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
                }
                if (end > 0) { try { data = JSON.parse(text.slice(from, end)); } catch (e1) { data = null; } }
            }
        }

        /* 不再把导入文本当脚本执行（new Function 能访问 window / localStorage）；只接受 JSON 或 setTouchLayout({...}) 里的对象 */

        if (!data) { cb(false); return; }
        if (!data.buttons || !data.buttons.length) {
            if (!data.stick) { cb(false); return; }       /* 只给摇杆没给按钮也算合法 */
        }
        S.pad = normPad(data);
        if (!S.pad.stick) S.pad.stick = clone(DEFAULT_PAD.stick);
        S.save();
        document.dispatchEvent(new CustomEvent('celeste:padchange'));
        cb(true);
    };

    Celeste.settings = S;
    Celeste.setTouchLayout = function (d) {
        if (!d) return;
        S.pad = normPad(d);
        if (!S.pad.stick) S.pad.stick = clone(DEFAULT_PAD.stick);
        S.save();
        document.dispatchEvent(new CustomEvent('celeste:padchange'));
    };
})();
