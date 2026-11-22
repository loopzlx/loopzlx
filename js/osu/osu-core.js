/* osu-core.js —— 命名空间 / 常量 / 共享状态 / 判定与计分
   所有 osu 模块都挂在 window.Osu 上；各文件内部用 IIFE，避免污染站点全局。 */
var OSU = window.Osu = window.Osu || {};

(function () {
  'use strict';

  OSU.modes = OSU.modes || {};   /* 模式注册表：各 osu-mode-*.js 往里挂 */

  var C = OSU.C = {
    MODES: ['std', 'taiko', 'catch', 'mania'],
    MODE_CN: { std: 'osu!', taiko: 'osu!taiko', catch: 'osu!catch', mania: 'osu!mania' },
    MODE_ICON: { std: '◯', taiko: '◐', catch: '❥', mania: '▤' },
    MODE_COLOR: { std: '#ff66aa', taiko: '#ffcc22', catch: '#66ccff', mania: '#b066ff' },
    /* 五档判定（基于 OD=5），随 OD 缩放 */
    /* v = ScoreV2 的判定数值（300 / 100 / 50 体系），与 osu! 一致 */
    JUDGE: [
      { key: 'PERFECT', ms: 40, color: '#ff66aa', hp: 1.2, v: 300 },
      { key: 'GREAT', ms: 80, color: '#b066ff', hp: 0.8, v: 300 },
      { key: 'GOOD', ms: 130, color: '#33ff66', hp: 0.3, v: 100 },
      { key: 'OK', ms: 190, color: '#a78bcc', hp: 0.0, v: 50 },
      { key: 'MEH', ms: 240, color: '#888888', hp: -1.2, v: 25 }
    ],
    /* std / catch 用 3 档判定（对应 osu! 的 300 / 100 / 50）：最高是 GREAT，没有 PERFECT */
    JUDGE_STD: [
      { key: 'GREAT', ms: 40, color: '#ff66aa', hp: 1.2, v: 300 },
      { key: 'OK', ms: 130, color: '#ffd166', hp: 0.3, v: 100 },
      { key: 'MEH', ms: 200, color: '#8a8a8a', hp: 0.0, v: 50 }
    ],
    /* 模式内部档位 → std 判定名的映射（std/catch 的 addHit 传的是老档名） */
    STD_MAP: { PERFECT: 'GREAT', GREAT: 'OK', GOOD: 'MEH' },
    MISS_COLOR: '#ff3355',
    ICON: { PERFECT: '★', GREAT: '◆', GOOD: '●', OK: '▲', MEH: '·', MISS: '×', BREAK: '⨯' },
    TOTAL_SCORE: 1000000,
    MODS: [
      { id: 'EZ', name: 'Easy', mult: .5, cat: 'reduce', desc: '扩大判定窗口' },
      { id: 'NF', name: 'No Fail', mult: .5, cat: 'reduce', desc: '不会失败' },
      { id: 'HT', name: 'Half Time', mult: .5, cat: 'reduce', desc: '0.75× 速度' },
      { id: 'HR', name: 'Hard Rock', mult: 1, cat: 'increase', desc: 'OD×1.4' },
      { id: 'HD', name: 'Hidden', mult: 1, cat: 'increase', desc: '音符提前淡出' },
      { id: 'FL', name: 'Flashlight', mult: 1, cat: 'increase', desc: '视野受限' },
      { id: 'DT', name: 'Double Time', mult: 1, cat: 'increase', desc: '1.5× 速度' },
      { id: 'SD', name: 'Sudden Death', mult: 1, cat: 'increase', desc: 'Miss 即失败' },
      { id: 'AT', name: 'Auto', mult: 1, cat: 'auto', desc: '自动游玩' }
    ],
    MOD_EXCLUSIVE: [['EZ', 'HR'], ['HT', 'DT'], ['HD', 'FL'], ['SD', 'AT']]
  };

  var S = OSU.S = {
    view: 'menu',      // menu | select | play | result | settings | download | calib
    mode: 'mania',     // std | taiko | catch | mania
    running: false, paused: false, failed: false, demo: true,
    songTime: 0, songEnd: 0, songStartAt: 0,
    notes: [], judged: 0, combo: 0, maxCombo: 0, score: 0,
    counts: {}, health: 70, displayHealth: 70,
    od: 5, cs: 4, hp: 5, bpm: 0,
    mods: {}, speed: 1,
    song: null, chart: null,
    hitErrors: [], lastFrame: 0, loopId: 0,
    keys: [], labels: [], held: [], pointerAt: -1,
    cursor: { x: 0, y: 0, down: false, inside: false },
    plateX: 0.5,
    previewBlobUrl: null
  };

  /* ---------- 主题色：读取站点 CSS 变量，让 osu 界面跟随 loopzlx 主题 ---------- */
  function cssVar(name, fb) {
    try {
      var v = getComputedStyle(document.body || document.documentElement).getPropertyValue(name);
      v = (v || '').trim();
      return v || fb;
    } catch (e) { return fb; }
  }
  /* 每个模式自己的主题色：std 紫、taiko 橙、catch 青、mania 蓝（游玩画面按模式换色） */
  var MODE_ACCENT = {
    std: ['#ff66aa', '#ff2e88'],
    taiko: ['#ffcc22', '#ff9d00'],
    catch: ['#66ccff', '#00a8e8'],
    mania: ['#b066ff', '#8a3dff']
  };
  /* ---------- 皮肤包：覆盖强调色与判定色，不随站点主题漂移 ---------- */
  var DEFAULT_JUDGE = C.JUDGE.map(function (j) { return j.color; });
  var SKINS = OSU.SKINS = {
    auto: { id: 'auto', name: 'AUTO', cn: '跟随主题', accent: null, judge: null },
    frost: {
      id: 'frost', name: 'FROST', cn: '霜蓝', accent: ['#5ec8ff', '#2b8dff'],
      judge: { PERFECT: '#d6f7ff', GREAT: '#5ec8ff', GOOD: '#3fd0a5', OK: '#8fb8ce', MEH: '#6d8595' }
    },
    ember: {
      id: 'ember', name: 'EMBER', cn: '余烬', accent: ['#ffa53d', '#ff4b2b'],
      judge: { PERFECT: '#ffd9a8', GREAT: '#ffa53d', GOOD: '#ff7a59', OK: '#c8956a', MEH: '#8a6a5a' }
    },
    neon: {
      id: 'neon', name: 'NEON', cn: '霓虹', accent: ['#7dffb0', '#18e0a8'],
      judge: { PERFECT: '#eaffd6', GREAT: '#7dffb0', GOOD: '#4fe3ff', OK: '#66d9c2', MEH: '#5c8a80' }
    },
    mono: {
      id: 'mono', name: 'MONO', cn: '单色', accent: ['#e8e8e8', '#8a8a8a'],
      judge: { PERFECT: '#ffffff', GREAT: '#dcdcdc', GOOD: '#b8b8b8', OK: '#909090', MEH: '#6a6a6a' }
    }
  };
  var SKIN_KEY = 'osu.skin';

  OSU.skinId = function () {
    try {
      var id = localStorage.getItem(SKIN_KEY) || 'auto';
      return SKINS[id] ? id : 'auto';
    } catch (e) { return 'auto'; }
  };
  OSU.skin = function () { return SKINS[OSU.skinId()] || SKINS.auto; };
  OSU.setSkin = function (id) {
    if (!SKINS[id]) id = 'auto';
    try { localStorage.setItem(SKIN_KEY, id); } catch (e) {}
    OSU.applySkin();
    paletteCache = {};
    OSU.log && OSU.log('SKIN // ' + (SKINS[id].name || id));
  };
  OSU.applySkin = function () {
    var sk = OSU.skin();
    C.JUDGE.forEach(function (j, i) {
      j.color = (sk.judge && sk.judge[j.key]) || DEFAULT_JUDGE[i];
    });
    var app = document.getElementById('osu-app');
    if (app) app.setAttribute('data-skin', sk.id);
  };

  var paletteCache = {};

  OSU.isLight = function () {
    var cl = (document.documentElement.className || '') + ' ' + ((document.body && document.body.className) || '');
    return /theme-paper|theme-sneaker/.test(cl);
  };

  OSU.pal = function (force) {
    var mode = (OSU.S && OSU.S.running) ? OSU.S.mode : '';
    var light = OSU.isLight();
    var key = (mode || '-') + (light ? '|L' : '|D');
    if (paletteCache[key] && !force) return paletteCache[key];
    var base = {
      primary: cssVar('--primary', '#8a2be2'),
      secondary: cssVar('--secondary', '#ff69b4'),
      bg: cssVar('--bg-base', '#050208'),
      text: cssVar('--text-main', '#f0f4f8'),
      dim: cssVar('--text-muted', '#a78bcc'),
      glass: cssVar('--glass-bg', 'rgba(15,8,25,.75)'),
      line: cssVar('--glass-border', 'rgba(138,43,226,.35)'),
      light: light
    };
    var acc = MODE_ACCENT[mode];
    if (acc) { base.primary = acc[0]; base.secondary = acc[1]; }
    var skin = OSU.skin();
    if (skin && skin.accent) { base.primary = skin.accent[0]; base.secondary = skin.accent[1]; }
    /* 浅色主题：游玩底色走主题亮底，文字/描边用深色，避免"白字压在米白上" */
    if (light) {
      base.text = cssVar('--text-main', '#2c1e12');
      base.dim = cssVar('--text-muted', '#8c6a4f');
      base.bg = cssVar('--bg-base', '#f4ebd9');
    }
    paletteCache[key] = base;
    return base;
  };
  OSU.resetPal = function () { paletteCache = {}; };

  /* ---------- 工具 ---------- */
  var U = OSU.util = {
    clamp: function (v, a, b) { return v < a ? a : (v > b ? b : v); },
    lerp: function (a, b, t) { return a + (b - a) * t; },
    fmt: function (n) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); },
    time: function (sec) {
      sec = Math.max(0, sec);
      var m = Math.floor(sec / 60), s = Math.floor(sec % 60);
      return m + ':' + (s < 10 ? '0' : '') + s;
    },
    /* 颜色字符串缓存：避免每帧重复解析 hex（std/taiko 每帧会调用上百次） */
    rgbaCache: {},
    rgba: function (hex, a) {
      var key = hex + '|' + a;
      var hit = U.rgbaCache[key];
      if (hit) return hit;
      var h = (hex || '#fff').replace('#', '');
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      var n = parseInt(h, 16);
      var out = 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
      var keys = U._rgbaN || 0;
      if (++keys > 400) { U.rgbaCache = {}; U._rgbaN = 0; } else { U._rgbaN = keys; }
      U.rgbaCache[key] = out;
      return out;
    },

    /* 二分：返回第一个 time >= t 的下标（notes 已按时间排序） */
    bisect: function (list, t) {
      var lo = 0, hi = list.length - 1, ans = list.length;
      while (lo <= hi) {
        var mid = (lo + hi) >> 1;
        if (list[mid].time >= t) { ans = mid; hi = mid - 1; } else { lo = mid + 1; }
      }
      return ans;
    },
    /** 判定窗口（毫秒，单边），按 osu! 原版公式推导：
        std   300 总宽 79.5-3.5*OD、100 139.5-8*OD、50 199.5-10*OD
        mania 320 64-3*OD、100 97-3*OD、50 127-3*OD
        taiko 用比 std 略宽的同形公式（和 taiko 手感接近）
        EZ 让 OD 减半、HR 让 OD ×1.4（封顶 10）；DT/HT 不改变真实毫秒窗口。 */
    win: function (res) {
      var od = S.od || 5;
      if (S.mods.EZ) od = od * 0.5;
      if (S.mods.HR) od = Math.min(10, od * 1.4);
      var a, b, c, d;
      if (S.mode === 'mania') {
        /* osu!mania 官方窗口（值是「半径」，判定用 |diff| ≤ win 比较，不要再除 2）：
           GREAT 64-3OD / GOOD 97-3OD / OK 127-3OD / MEH 151-3OD，PERFECT 固定 ±16ms 不随 OD 变。
           旧版 PERFECT 取 a*0.55（OD5 只有 13.5ms）+ 这里又除 2，等于把窗口砍一半，
           踩得很准也只给 GREAT —— 现已按官方半径恢复。 */
        a = 64 - 3 * od; b = 97 - 3 * od; c = 127 - 3 * od; d = 151 - 3 * od;
      } else if (S.mode === 'taiko') {
        a = (58 - 3.5 * od) / 2; b = (130 - 8 * od) / 2; c = (190 - 10 * od) / 2;
        d = c;
      } else {
        a = (79.5 - 3.5 * od) / 2; b = (139.5 - 8 * od) / 2; c = (199.5 - 10 * od) / 2;
        d = c;
      }
      a = Math.max(6, a); b = Math.max(a + 3, b); c = Math.max(b + 4, c); d = Math.max(c + 2, d);
      var w = {
        PERFECT: S.mode === 'mania' ? 16 : a,   /* mania 固定 16ms，其余模式最高档就是 a */
        GREAT: a,
        GOOD: b,
        OK: c,
        MEH: d,
        MISS: d
      };
      var v = w[res];
      return v != null ? v : d;
    },
    judge: function (diffMs) {
      /* 校准偏移：玩家整体偏早/偏晚多少 ms，判定前统一补偿（设置 → 音频 → 校准） */
      var off = (OSU.settings && OSU.settings.num) ? OSU.settings.num('hitOffset', 0) : 0;
      if (off) diffMs = diffMs - off;
      var a = Math.abs(diffMs);
      for (var i = 0; i < C.JUDGE.length; i++) {
        if (a <= OSU.util.win(C.JUDGE[i].key)) return C.JUDGE[i].key;
      }
      return 'MISS';
    },
    judgeOf: function (res) {
      var table = U.judgeTable();
      for (var i = 0; i < table.length; i++) if (table[i].key === res) return table[i];
      return null;
    },
    judgeTable: function () {
      return OSU.usesStdJudge() ? C.JUDGE_STD : C.JUDGE;
    }
  };

  /* ---------- 计分（osu! ScoreV2）/ 血条 / 弹窗 / 粒子 ---------- */

  /* ScoreV2：单条的连击参数 = 判定值 × f(combo)
     f: combo<=1 → .5；2..400 → log4(combo)；>400 → log4(400)。满分里 combo 部分占 20%，acc 占 80%。 */
  /* 判定档位的得分权重（0–1，以 320 为基准）：分数与 acc 共用这一张表，
     全 PERFECT 时 comboPart/accPart 都正好吃满，总分 = 1,000,000 */
  OSU.weightOf = function (key) {
    var w = OSU.usesStdJudge()
      ? { GREAT: 1, OK: 1 / 3, MEH: 1 / 6 }
      : { PERFECT: 1, GREAT: 300 / 320, GOOD: 200 / 320, OK: 100 / 320, MEH: 50 / 320 };
    var v = w[key];
    return v == null ? 0 : v;
  };

  function comboF(c) {
    if (c <= 1) return 0.5;
    var v = Math.log(Math.min(c, 400)) / Math.log(4);
    return v;
  }
  OSU.comboF = comboF;

  OSU.maxComboParams = function (n) {
    var sum = 0;
    for (var i = 1; i <= n; i++) sum += comboF(i);
    return Math.max(1, 320 * sum);
  };

  var MOD_MULT = { HR: 1.10, DT: 1.20, FL: 1.12, HD: 1.06, EZ: 0.5, HT: 0.5 };

  OSU.modMult = function () {
    var m = 1;
    for (var k in S.mods) if (S.mods[k] && MOD_MULT[k]) m *= MOD_MULT[k];
    return m;
  };

  /* ScoreV2 当前总分 = 20% 连击分 + 80% 准度分，再乘模组倍率。
     两个分量都按「全谱」归一，所以分数从 0 随判定累积，SS 恰好 1,000,000。
     之前的 accPart 用「已判定部分的准确率」（开局就是 100%），一进图分数直接 80 万、
     打一个 miss 又断崖式掉，和官方行为不符。 */
  OSU.scoreNow = function () {
    var total = OSU.totalObjects ? Math.max(1, OSU.totalObjects()) : 1;
    var cSum = S.comboParams || 0;
    var maxCP = S.maxComboParams || 1;
    var comboPart = 200000 * Math.min(1, cSum / maxCP);
    var accPart = 800000 * Math.min(1, (S.accSum || 0) / total);
    return Math.round((comboPart + accPart) * OSU.modMult());
  };

  /* 星级：没有真实的 strain 计算，用密度/od/长度做近似（也用于 pp 基准） */
  /* 星级：按模式各自的难度模型估算（之前四个模式共用一条密度公式，内置演示谱被算成 ★5.5 明显偏高）
     - mania：NPS × 键数系数（键越多越难读）
     - taiko：纯 NPS（节奏密度）
     - catch：NPS + 少量 OD
     - std：NPS × 滑条占比 + OD */
  OSU.starRating = function (chart) {
    if (!chart || !chart.objects) return 1;
    var objs = chart.objects, n = objs.length || 1;
    var dur = Math.max(1, chart.length || 30);
    var nps = n / dur;
    var od = chart.od || 5;
    var mode = chart.mode || 'std';
    var stars;
    if (mode === 'mania') {
      var cols = Math.max(1, chart.cs || 4);
      stars = 0.55 + 0.85 * Math.pow(nps, 0.92) * Math.pow(cols / 4, 0.28) + od * 0.055;
    } else if (mode === 'taiko') {
      stars = 0.55 + 1.05 * Math.pow(nps, 0.82) + od * 0.06;
    } else if (mode === 'catch') {
      stars = 0.55 + 0.95 * Math.pow(nps, 0.80) + od * 0.06;
    } else {
      var sl = 0;
      for (var i = 0; i < objs.length; i++) if (objs[i].type === 'slider' || objs[i].type === 'hold') sl++;
      var slFrac = n ? sl / n : 0;
      stars = 0.95 + 0.90 * Math.pow(nps, 0.80) * (1 + slFrac * 0.55) + od * 0.06;
    }
    return U.clamp(Math.round(stars * 100) / 100, 1, 9.9);
  };

  /* pp 估算：官方公式需要 aim / speed strain，这里用星级 + 长度 + acc + combo + mods 近似，
     数值对齐社区经验（5★ 2 分钟全连约 200–250pp）。结果页标注 EST。 */
  OSU.pp = function (chart) {
    var stars = OSU.starRating(chart);
    var lenSec = Math.min(420, Math.max(20, (chart && chart.length) || 60));
    var acc = OSU.acc() / 100;
    var total = Math.max(1, Math.round(OSU.totalObjects()));
    var comboFrac = Math.min(1, (S.maxCombo || 0) / total);
    var base = 2.6 * Math.pow(stars, 2.5) * (1 + 0.004 * lenSec);
    var pp = base * Math.pow(acc, 5.6) * (0.6 + 0.4 * comboFrac) * OSU.modMult();
    if (S.failed) pp = 0;
    return Math.max(0, Math.round(pp));
  };

  /* std / catch：把 PERFECT→GREAT、GREAT→OK、GOOD→MEH，让最高档就叫 GREAT */
  OSU.usesStdJudge = function () {
    return S.mode === 'std' || S.mode === 'catch';
  };
  OSU.normJudge = function (res) {
    if (!OSU.usesStdJudge()) return res;
    return C.STD_MAP[res] || res;
  };

  OSU.addHit = function (res, x, y) {
    res = OSU.normJudge(res);
    var j = U.judgeOf(res);
    if (!j) return;
    S.combo++; if (S.combo > S.maxCombo) S.maxCombo = S.combo;
    S.counts[res] = (S.counts[res] || 0) + 1;
    S.judged++;
    var hwv = OSU.weightOf(j.key);
    S.comboParams = (S.comboParams || 0) + hwv * 320 * comboF(S.combo);
    S.accSum = (S.accSum || 0) + hwv;
    S.score = OSU.scoreNow();
    S.health = U.clamp(S.health + j.hp, 0, 100);
    OSU.popup(res, j.color, x, y);
    OSU.spark(x, y, j.color);
    OSU.audio.hitSfx(res);
    if (OSU.replay && OSU.replay.active()) {
      var ji = C.JUDGE.indexOf(j);
      OSU.replay.record(ji < 0 ? 0 : ji, x, y, S.songTime);
    }
  };

  OSU.addMiss = function (x, y, isBreak) {
    S.combo = 0;
    S.counts[isBreak ? 'BREAK' : 'MISS'] = (S.counts[isBreak ? 'BREAK' : 'MISS'] || 0) + 1;
    S.judged++;
    /* 扣血量随谱面的 HP drain 走：HP5 约 -5，HP10 约 -8 */
    var drain = 2.4 + (S.hp || 5) * 0.55;
    S.health = U.clamp(S.health - (isBreak ? 2 : drain), 0, 100);
    S.score = OSU.scoreNow();
    OSU.popup(isBreak ? 'BREAK' : 'MISS', C.MISS_COLOR, x, y);
    OSU.spark(x, y, C.MISS_COLOR);
    if (S.mods.SD && !S.mods.NF) S.failed = true;
    if (S.health <= 0 && !S.mods.NF) S.failed = true;   /* 血条见底 → 判定失败 */
    if (OSU.replay && OSU.replay.active()) OSU.replay.record(isBreak ? 6 : 5, x, y, S.songTime);
  };

  /* 准确率按 osu! 的 300/100/50 权重：300=1、100=1/3、50=1/6、25=1/12，Miss=0 */
  OSU.acc = function () {
    var num = 0;
    var w = OSU.usesStdJudge()
      ? { GREAT: 1, OK: 1 / 3, MEH: 1 / 6 }
      : { PERFECT: 1, GREAT: 300 / 320, GOOD: 200 / 320, OK: 100 / 320, MEH: 50 / 320 };
    for (var k in S.counts) if (w[k] && S.counts[k]) num += S.counts[k] * w[k];
    return S.judged > 0 ? num / S.judged * 100 : 100;
  };
  OSU.rankOf = function (acc, failed) {
    if (failed) return 'F';
    if (acc >= 99.5) return 'SS';
    if (acc >= 95) return 'S';
    if (acc >= 90) return 'A';
    if (acc >= 80) return 'B';
    if (acc >= 70) return 'C';
    return 'D';
  };
  OSU.rankColor = function (r) {
    return { SS: '#f5f5f5', S: '#ffcc22', A: '#33ff66', B: '#66ccff', C: '#b066ff', D: '#ff3355', F: '#ff3355' }[r] || '#fff';
  };

  var popups = [], sparks = [];
  OSU.popup = function (name, color, x, y) {
    popups.push({ name: name, color: color, t: performance.now(), x: x, y: y });
    if (popups.length > 6) popups.shift();
  };
  OSU.fxPopups = function () { return popups.slice(-3); };
  OSU.resetFx = function () { popups = []; sparks = []; };
  OSU.updateFx = function (dt) {
    for (var i = popups.length - 1; i >= 0; i--) {
      if (performance.now() - popups[i].t > 620) popups.splice(i, 1);
    }
    for (var j = sparks.length - 1; j >= 0; j--) {
      var p = sparks[j];
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 780 * dt; p.life -= dt * 2.4;
      if (p.life <= 0) sparks.splice(j, 1);
    }
  };
  OSU.spark = function (x, y, color) {
    if (OSU.settings && !OSU.settings.on('hitLight')) return;
    for (var i = 0; i < 5; i++) {
      sparks.push({ x: x, y: y, vx: (Math.random() - .5) * 300, vy: -Math.random() * 200 - 60, life: 1, color: color });
    }
  };
  OSU.drawSparks = function (ctx) {
    for (var i = 0; i < sparks.length; i++) {
      var p = sparks[i];
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, 3 * p.life + 1, 0, 6.284); ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  /* ---------- 目标（音符）通用操作 ---------- */
  OSU.totalObjects = function () {
    var t = 0;
    for (var i = 0; i < S.notes.length; i++) t += (S.notes[i].weight || 1);
    return t;
  };

  /* 记录点（用于 replay / UR） */
  OSU.recordHit = function (diffMs) {
    if (!isFinite(diffMs)) return;
    S.hitErrors.push(diffMs);
    if (S.hitErrors.length > 60) S.hitErrors.shift();
  };

  /* 曲库存储 */
  OSU.store = {
    load: function (key, fb) {
      try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fb; } catch (e) { return fb; }
    },
    save: function (key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }
  };

  /* 内置演示谱（每种模式一条，无需导入即可玩） */
  OSU.DEMO = (function () {
    var LIMIT = 2.0;                 /* 前导 */
    var BPM = 120, BEAT = 60 / BPM, BAR = BEAT * 4, BARS = 12;

    /* mania 4K：四分音符为主，个别小节八分（比原版慢一档） */
    var mania = [];
    var pattern = ["x...x...", "x...x...", "x..x....", "x..x....", "x.x.x...", "x...x.x.", "x.x.x...", "x.x.x.x."];
    var laneSeq = [0, 2, 1, 3, 2, 0, 3, 1];
    var li = 0;
    for (var b = 0; b < BARS; b++) {
      var pat = pattern[b % pattern.length];
      for (var s = 0; s < 8; s++) {
        if (pat[s] === '.') continue;
        mania.push({ lane: laneSeq[li++ % laneSeq.length], time: LIMIT + b * BAR + s * (BEAT / 2), type: 'tap' });
      }
    }
    /* taiko：每拍一下，don/kat 按小节型交替；每 4 小节一个连打 */
    var taiko = [];
    var tpat = [[0, 1, 0, 1], [1, 0, 1, 1], [0, 1, 1, 0], [1, 1, 0, 0]];
    for (var b2 = 0; b2 < BARS; b2++) {
      var row = tpat[b2 % tpat.length];
      for (var s2 = 0; s2 < 4; s2++) {
        taiko.push({ time: LIMIT + b2 * BAR + s2 * BEAT, kat: row[s2] === 1, type: 'circle', x: 256, y: 192, hitSound: row[s2] === 1 ? 2 : 0 });
      }
      if (b2 % 4 === 3) {
        /* 鼓奏（drumroll）：1.25 秒长条，按住即可连续出货 */
        taiko.push({ time: LIMIT + b2 * BAR + 3 * BEAT + BEAT * 0.5, endTime: LIMIT + b2 * BAR + 6 * BEAT, kat: false, type: 'slider', x: 256, y: 192, hitSound: 0 });
      }
    }

    /* catch：每拍一个水果，左右来回；每 4 小节一串果汁 */
    var cth = [];
    var xs = [0.5, 0.28, 0.72, 0.42, 0.62, 0.2, 0.8, 0.5];
    for (var b3 = 0; b3 < BARS; b3++) {
      for (var s3 = 0; s3 < 4; s3++) {
        cth.push({ time: LIMIT + b3 * BAR + s3 * BEAT, x: xs[(b3 * 4 + s3) % xs.length] * 512, y: 192, type: 'circle', hitSound: 0 });
      }
      if (b3 % 4 === 2) {
        cth.push({
          time: LIMIT + b3 * BAR + 4 * BEAT, x: 0.22 * 512, y: 192,
          type: 'slider', endX: 0.78 * 512, endY: 192,
          endTime: LIMIT + b3 * BAR + 4 * BEAT + BEAT * 1.2, hitSound: 0
        });
      }
    }

    /* std：每小节 3 个圆圈（0 / 1.5 / 3 拍），每 3 小节一条滑条 */
    var std = [];
    var SLOTS = [[104, 104], [256, 84], [408, 104], [180, 190], [332, 190], [92, 280], [256, 300], [420, 276]];
    var si = 0;
    for (var b4 = 0; b4 < BARS; b4++) {
      var hasSlider = (b4 % 3 === 2);
      for (var s4 = 0; s4 < 3; s4++) {
        if (hasSlider && s4 === 1) continue;      /* 滑条小节少放一个圆，避免叠在一起 */
        var sp = SLOTS[si++ % SLOTS.length];
        var tt = [0, 1.5, 3][s4];
        std.push({ time: LIMIT + b4 * BAR + tt * BEAT, type: 'circle', x: sp[0], y: sp[1] });
      }
      if (hasSlider) {
        std.push({ time: LIMIT + b4 * BAR + 2.0 * BEAT, type: 'slider', x: 150, y: 246, endX: 366, endY: 246, endTime: LIMIT + b4 * BAR + 3.6 * BEAT });
      }
    }

    var sortFn = function (a, c) { return a.time - c.time; };
    mania.sort(sortFn); taiko.sort(sortFn); cth.sort(sortFn); std.sort(sortFn);

    var LEN = BARS * BAR;
    return {
      bpm: BPM, limit: LIMIT, bars: BARS, steps: BARS * 16,
      std: { title: 'Neon Drift', artist: 'LOOPZLX Sound', version: 'Easy', objects: std, length: LEN + LIMIT, demo: true },
      taiko: { title: 'Taiko Pulse', artist: 'LOOPZLX Sound', version: 'Muzukashii', objects: taiko, length: LEN + LIMIT, demo: true },
      catch: { title: 'Fruit Cascade', artist: 'LOOPZLX Sound', version: 'Salad', objects: cth, length: LEN + LIMIT, demo: true },
      mania: { title: 'Four Lane Rush', artist: 'LOOPZLX Sound', version: '4K Easy', objects: mania, length: LEN + LIMIT, demo: true }
    };
  })();

})();
