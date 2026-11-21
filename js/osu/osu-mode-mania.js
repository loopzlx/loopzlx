/* osu-mode-mania.js —— 4K~9K 竖直下落模式 */
var OSU = window.Osu = window.Osu || {};

(function () {
  'use strict';
  var S = OSU.S;
  var U = OSU.util;

  var KEYMAP = {
    1: ['KeyD'], 2: ['KeyF', 'KeyJ'], 3: ['KeyD', 'KeyF', 'KeyJ'],
    4: ['KeyD', 'KeyF', 'KeyJ', 'KeyK'],
    5: ['KeyD', 'KeyF', 'Space', 'KeyJ', 'KeyK'],
    6: ['KeyS', 'KeyD', 'KeyF', 'KeyJ', 'KeyK', 'KeyL'],
    7: ['KeyS', 'KeyD', 'KeyF', 'Space', 'KeyJ', 'KeyK', 'KeyL'],
    8: ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon'],
    9: ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'Space', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon']
  };
  var LABELS = {
    1: ['D'], 2: ['F', 'J'], 3: ['D', 'F', 'J'], 4: ['D', 'F', 'J', 'K'],
    5: ['D', 'F', '⌴', 'J', 'K'], 6: ['S', 'D', 'F', 'J', 'K', 'L'],
    7: ['S', 'D', 'F', '⌴', 'J', 'K', 'L'], 8: ['A', 'S', 'D', 'F', 'J', 'K', 'L', ';'],
    9: ['A', 'S', 'D', 'F', '⌴', 'J', 'K', 'L', ';']
  };

  var JUDGE_Y_RATE = 0.86;
  var APPROACH = 1.15;      // 秒：音符走完全屏的时间

  var holds = [];           // 当前按住的 note（按 lane）

  var M = OSU.modes.mania = {
    id: 'mania',
    canvas: { w: 512, h: 680 },
    cols: 4,
    keys: KEYMAP[4],
    labels: LABELS[4],

    setCols: function (cols, custom) {
      var c = U.clamp(Math.round(cols || 4), 1, 9);
      M.cols = c;
      M.keys = (custom && custom[c] && custom[c].length === c) ? custom[c] : KEYMAP[c].slice();
      M.labels = M.keys.map(function (k) { return k === 'Space' ? '⌴' : k.replace('Key', '').replace('Semicolon', ';'); });
      M.canvas.w = c <= 4 ? 512 : Math.max(40, Math.floor(560 / c)) * c;
      S.keys = M.keys; S.labels = M.labels; S.held = new Array(c).fill(false);
      holds = new Array(c).fill(null).map(function () { return []; });
      return M;
    },

    build: function (chart) {
      M.setCols(chart.cs || 4, OSU.store.load('osu_keybinds', {}));
      var w = 512 / M.cols;
      var out = [];
      for (var i = 0; i < chart.objects.length; i++) {
        var o = chart.objects[i];
        var lane = (o.lane != null) ? U.clamp(o.lane, 0, M.cols - 1) : U.clamp(Math.floor(o.x / w), 0, M.cols - 1);
        if (o.type === 'hold') out.push({ lane: lane, time: o.time, endTime: o.endTime, type: 'hold', weight: 2 });
        else if (o.type === 'slider') out.push({ lane: lane, time: o.time, endTime: o.endTime, type: 'hold', weight: 2 });
        else if (o.type === 'spinner') out.push({ lane: lane, time: o.time, endTime: o.endTime, type: 'hold', weight: 2 });
        else out.push({ lane: lane, time: o.time, type: 'tap', weight: 1 });
      }
      return out;
    },

    reset: function () {
      holds = new Array(M.cols).fill(null).map(function () { return []; });
    },

    /* ---- 输入 ---- */
    press: function (lane, t) {
      var best = null, bestDiff = 1e9;
      for (var i = 0; i < S.notes.length; i++) {
        var n = S.notes[i];
        if (n.judged || n.lane !== lane) continue;
        if (n.time < t - 0.6) continue;
        if (n.time > t + 0.6) break;
        if (n.type === 'hold' && n.headJudged) continue;
        var d = Math.abs(t - n.time);
        if (d < bestDiff) { bestDiff = d; best = n; }
      }
      if (!best) return;
      var diffMs = (t - best.time) * 1000;
      var res = U.judge(diffMs);
      if (Math.abs(diffMs) > U.win('MEH')) return;
      if (res === 'MISS') return;

      var p = M.hitPoint(best);
      if (best.type === 'tap') {
        best.judged = true;
        OSU.addHit(res, p.x, p.y);
        OSU.recordHit(diffMs);
      } else {
        if (Math.abs(diffMs) > U.win('MEH')) return;
        best.headJudged = true; best.holding = true;
        holds[lane].push(best);
        OSU.addHit(res, p.x, p.y);
      }
    },

    release: function (lane, t) {
      var arr = holds[lane];
      if (!arr || !arr.length) return;
      var snap = arr.slice();
      for (var i = 0; i < snap.length; i++) {
        var n = snap[i];
        if (!n.holding) continue;
        var p = M.hitPoint(n);
        if (t < n.endTime - U.win('MISS') / 1000) {
          n.holding = false; n.judged = true; n.broken = true;
          OSU.addMiss(p.x, p.y, true);
        } else {
          n.holding = false; n.judged = true; n.fadeOut = t;
          OSU.addHit('PERFECT', p.x, p.y);
        }
      }
      holds[lane] = [];
    },

    autoPlay: function (t) {
      for (var i = 0; i < S.notes.length; i++) {
        var n = S.notes[i];
        if (n.judged && (!n.holding || t < n.endTime)) { if (n.holding && t >= n.endTime) { n.holding = false; n.judged = true; n.fadeOut = t; OSU.addHit('PERFECT', 0, 0); } continue; }
        if (n.judged) continue;
        if (n.type === 'tap') {
          if (t >= n.time) { n.judged = true; OSU.addHit('PERFECT', M.hitPoint(n).x, M.hitPoint(n).y); }
        } else if (!n.headJudged && t >= n.time) {
          n.headJudged = true; n.holding = true;
          holds[n.lane].push(n);
          OSU.addHit('PERFECT', M.hitPoint(n).x, M.hitPoint(n).y);
        }
      }
    },

    update: function (t) {
      var mw = U.win('MISS') / 1000;
      for (var i = 0; i < S.notes.length; i++) {
        var n = S.notes[i];
        if (n.judged) continue;
        var p = M.hitPoint(n);
        if (n.type === 'tap') {
          if (t > n.time + mw) { n.judged = true; OSU.addMiss(p.x, p.y); }
        } else if (!n.headJudged) {
          if (t > n.time + mw) { n.headJudged = true; n.judged = true; n.broken = true; OSU.addMiss(p.x, p.y); }
        } else if (n.holding && t >= n.endTime) {
          n.holding = false; n.judged = true; n.fadeOut = t;
          holds[n.lane].splice(holds[n.lane].indexOf(n), 1);
          OSU.addHit('PERFECT', p.x, p.y);
        }
      }
    },

    hitPoint: function (n) {
      var l = M.lastLayout || { w: M.canvas.w, h: M.canvas.h };
      var lw = l.w / M.cols;
      return { x: n.lane * lw + lw / 2, y: l.h * JUDGE_Y_RATE };
    },

    /* ---- 绘制 ---- */
    roundRect: function (ctx, x, y, w, h, r) {
      ctx.beginPath();
      if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); }
      else {
        ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
      }
      ctx.closePath();
    },

    draw: function (ctx, t, l) {
      M.lastLayout = l;
      var lw = l.w / M.cols, jy = l.h * JUDGE_Y_RATE;
      var pal = OSU.pal();
      var pps = (jy - 0) / APPROACH;

      /* 轨道 */
      for (var c = 0; c < M.cols; c++) {
        ctx.fillStyle = c % 2 ? U.rgba(pal.primary, .07) : 'rgba(255,255,255,.02)';
        ctx.fillRect(c * lw, 0, lw, l.h);
      }
      /* 按下高亮 */
      for (var c2 = 0; c2 < M.cols; c2++) {
        if (!S.held[c2]) continue;
        var g = ctx.createLinearGradient(0, 0, 0, jy);
        g.addColorStop(0, U.rgba(pal.secondary, 0));
        g.addColorStop(1, U.rgba(pal.secondary, .28));
        ctx.fillStyle = g;
        ctx.fillRect(c2 * lw, 0, lw, jy);
      }
      /* 分隔线 */
      ctx.strokeStyle = U.rgba(pal.primary, .25);
      ctx.lineWidth = 1;
      for (var c3 = 1; c3 < M.cols; c3++) {
        ctx.beginPath(); ctx.moveTo(c3 * lw, 0); ctx.lineTo(c3 * lw, l.h); ctx.stroke();
      }
      /* 判定线 */
      ctx.save();
      ctx.shadowColor = pal.primary; ctx.shadowBlur = 18;
      var jg = ctx.createLinearGradient(0, 0, l.w, 0);
      jg.addColorStop(0, U.rgba(pal.secondary, .5));
      jg.addColorStop(.5, pal.primary);
      jg.addColorStop(1, U.rgba(pal.secondary, .5));
      ctx.fillStyle = jg;
      ctx.fillRect(0, jy - 2, l.w, 4);
      ctx.restore();

      /* 音符（只画进入视野的，import 大谱面时省掉大量绘制） */
      var nh = Math.min(26, Math.max(14, (jy / APPROACH) * 0.11));
      var from = OSU.util.bisect(S.notes, t - 0.35);
      for (var i = from; i < S.notes.length; i++) {
        var n = S.notes[i];
        if (n.time - t > APPROACH + 0.6) break;
        if (n.judged && n.fadeOut == null && n.broken == null) continue;
        var yHead = jy - (n.time - t) * pps;
        var x0 = n.lane * lw + 2, w0 = lw - 4;

        if (n.type === 'hold') {
          var yEnd = jy - (n.endTime - t) * pps;
          var top = Math.min(yHead, yEnd), bot = Math.max(yHead, yEnd);
          if (bot < -60 || top > l.h + 60) continue;
          var hg = ctx.createLinearGradient(0, top, 0, bot);
          hg.addColorStop(0, U.rgba(pal.secondary, .85));
          hg.addColorStop(1, U.rgba(pal.primary, .85));
          ctx.fillStyle = n.broken ? 'rgba(90,30,50,.8)' : hg;
          M.roundRect(ctx, x0, top, w0, Math.max(4, bot - top), 6);
          ctx.fillStyle = n.holding ? '#fff' : pal.secondary;
          M.roundRect(ctx, x0, yHead - nh / 2, w0, nh, 5);
          /* 尾端 */
          ctx.fillStyle = pal.primary;
          M.roundRect(ctx, x0, yEnd - 3, w0, 6, 3);
        } else {
          if (yHead < -nh || yHead > l.h + nh) continue;
          var ng = ctx.createLinearGradient(0, yHead - nh / 2, 0, yHead + nh / 2);
          ng.addColorStop(0, '#ffffff');
          ng.addColorStop(1, pal.secondary);
          ctx.fillStyle = ng;
          ctx.shadowColor = pal.secondary; ctx.shadowBlur = 12;
          M.roundRect(ctx, x0, yHead - nh / 2, w0, nh, 5);
          ctx.shadowBlur = 0;
        }
      }

      /* 底部按键提示 */
      var labelY = l.h - 22;
      ctx.font = '600 12px "Share Tech Mono", monospace';
      ctx.textAlign = 'center';
      for (var c4 = 0; c4 < M.cols; c4++) {
        ctx.fillStyle = S.held[c4] ? pal.secondary : U.rgba(pal.text, .35);
        ctx.fillText(M.labels[c4] || '', c4 * lw + lw / 2, labelY);
      }
      ctx.textAlign = 'left';
    }
  };

  M.setCols(4);
})();
