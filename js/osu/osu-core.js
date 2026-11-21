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
    JUDGE: [
      { key: 'PERFECT', ms: 40, color: '#ff66aa', hp: 1.2, score: 320 },
      { key: 'GREAT', ms: 80, color: '#b066ff', hp: 0.8, score: 300 },
      { key: 'GOOD', ms: 130, color: '#33ff66', hp: 0.3, score: 200 },
      { key: 'OK', ms: 190, color: '#a78bcc', hp: 0.0, score: 100 },
      { key: 'MEH', ms: 240, color: '#888888', hp: -1.2, score: 50 }
    ],
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
      var v = getComputedStyle(document.documentElement).getPropertyValue(name);
      v = (v || '').trim();
      return v || fb;
    } catch (e) { return fb; }
  }
  var paletteCache = null;
  OSU.pal = function (force) {
    if (paletteCache && !force) return paletteCache;
    paletteCache = {
      primary: cssVar('--primary', '#8a2be2'),
      secondary: cssVar('--secondary', '#ff69b4'),
      bg: cssVar('--bg-base', '#050208'),
      text: cssVar('--text-main', '#f0f4f8'),
      dim: cssVar('--text-muted', '#a78bcc'),
      glass: cssVar('--glass-bg', 'rgba(15,8,25,.75)'),
      line: cssVar('--glass-border', 'rgba(138,43,226,.35)')
    };
    return paletteCache;
  };
  OSU.resetPal = function () { paletteCache = null; };

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
    /** 判定窗口（毫秒），随 OD 缩放 */
    win: function (res) {
      var base = 0;
      for (var i = 0; i < C.JUDGE.length; i++) if (C.JUDGE[i].key === res) { base = C.JUDGE[i].ms; break; }
      if (res === 'MISS') base = 260;
      var scale = 1 + (5 - S.od) * 0.075;          // OD 高窗口小
      if (S.mods.EZ) scale *= 1.4;
      if (S.mods.HR) scale *= 0.8;
      if (S.mods.DT) scale *= 0.85;
      return base * scale;
    },
    judge: function (diffMs) {
      var a = Math.abs(diffMs);
      for (var i = 0; i < C.JUDGE.length; i++) {
        if (a <= OSU.util.win(C.JUDGE[i].key)) return C.JUDGE[i].key;
      }
      return 'MISS';
    },
    judgeOf: function (res) {
      for (var i = 0; i < C.JUDGE.length; i++) if (C.JUDGE[i].key === res) return C.JUDGE[i];
      return null;
    }
  };

  /* ---------- 计分 / 血条 / 弹窗 / 粒子 ---------- */
  OSU.addHit = function (res, x, y) {
    var j = U.judgeOf(res);
    if (!j) return;
    S.combo++; if (S.combo > S.maxCombo) S.maxCombo = S.combo;
    S.counts[res] = (S.counts[res] || 0) + 1;
    S.judged++;
    S.score += j.score * (1 + Math.min(S.combo, 60) / 60 * 0.6);
    S.health = U.clamp(S.health + j.hp, 0, 100);
    OSU.popup(res, j.color, x, y);
    OSU.spark(x, y, j.color);
    OSU.audio.hitSfx(res);
  };

  OSU.addMiss = function (x, y, isBreak) {
    S.combo = 0;
    S.counts[isBreak ? 'BREAK' : 'MISS'] = (S.counts[isBreak ? 'BREAK' : 'MISS'] || 0) + 1;
    S.judged++;
    S.health = U.clamp(S.health - (isBreak ? 6 : 4.5), 0, 100);
    OSU.popup(isBreak ? 'BREAK' : 'MISS', C.MISS_COLOR, x, y);
    OSU.spark(x, y, C.MISS_COLOR);
    if (S.mods.SD && !S.mods.NF) S.failed = true;
  };

  OSU.acc = function () {
    var num = 0;
    var w = { PERFECT: 1, GREAT: 0.92, GOOD: 0.6, OK: 0.32, MEH: 0.1 };
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
  OSU.recordHit = function (diffMs) { if (isFinite(diffMs)) S.hitErrors.push(diffMs); };

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
        taiko.push({ time: LIMIT + b2 * BAR + 3 * BEAT + BEAT * 0.5, endTime: LIMIT + b2 * BAR + 4 * BEAT, kat: false, type: 'slider', x: 256, y: 192, hitSound: 0 });
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
