/* osu-mode-standard.js —— 圆圈点击 / 滑条 / 转盘 */
var OSU = window.Osu = window.Osu || {};

(function () {
  'use strict';
  var S = OSU.S;
  var U = OSU.util;

  var APPROACH = 1.15;
  var OX = 0, OY = 0, SCALE = 1;
  var spinCount = 0, spinCur = null;
  var rings = [];   /* 命中涟漪（osu 的 hit explosion 简化版） */

  var M = OSU.modes.std = {
    id: 'std',
    canvas: { w: 860, h: 520 },
    keys: ['KeyZ', 'KeyX', 'Space'],
    labels: ['点击'],

    build: function (chart) {
      S.keys = M.keys; S.labels = M.labels; S.held = [false];
      spinCount = 0; spinCur = null;
      var out = [], seq = 0;
      for (var i = 0; i < chart.objects.length; i++) {
        var o = chart.objects[i];
        seq = seq >= 9 ? 1 : seq + 1;
        if (o.type === 'circle') {
          out.push({ time: o.time, x: o.x, y: o.y, type: 'circle', weight: 1, idx: seq });
        } else if (o.type === 'spinner') {
          out.push({ time: o.time, endTime: Math.max(o.endTime, o.time + 0.6), type: 'spinner', weight: 1, spins: 0 });
        } else {
          out.push({
            time: o.time, endTime: Math.max(o.endTime, o.time + 0.2),
            x: o.x, y: o.y, ex: o.endX == null ? o.x : o.endX, ey: o.endY == null ? o.y : o.endY,
            type: 'slider', weight: 1, ticks: 0, ticksDone: 0, holding: false
          });
        }
      }
      return out;
    },

    reset: function () { spinCount = 0; spinCur = null; rings = []; },

    /* 命中涟漪 */
    ring: function (x, y, col) {
      rings.push({ x: x, y: y, t: performance.now(), col: col || OSU.pal().secondary });
      if (rings.length > 14) rings.shift();
    },

    layout: function (l) {
      SCALE = Math.min(l.w / 512, l.h / 384) * 0.96;
      OX = (l.w - 512 * SCALE) / 2;
      OY = (l.h - 384 * SCALE) / 2;
      M.lastLayout = l;
    },

    mx: function (x) { return OX + x * SCALE; },
    my: function (y) { return OY + y * SCALE; },
    radius: function () { return (58 - 3.2 * (S.cs || 4)) * SCALE; },

    hitPoint: function (n) {
      var l = M.lastLayout || { w: M.canvas.w, h: M.canvas.h };
      M.layout(l);
      if (n.type === 'spinner') return { x: l.w / 2, y: l.h / 2 };
      return { x: M.mx(n.x), y: M.my(n.y) };
    },

    /* 光标距音符中心的距离 */
    distTo: function (n) {
      return Math.hypot(S.cursor.x - M.mx(n.x), S.cursor.y - M.my(n.y));
    },

    press: function (lane, t) {
      var rad = M.radius();
      /* 转盘优先 */
      for (var i = 0; i < S.notes.length; i++) {
        var n = S.notes[i];
        if (n.type !== 'spinner' || n.judged) continue;
        if (t >= n.time - U.win('MEH') / 1000 && t <= n.endTime) {
          if (!n.spinStart) n.spinStart = t;
          n.spins++;
          OSU.audio.sliderTick();
          return;
        }
      }

      var best = null, bd = 1e9;
      for (var k = 0; k < S.notes.length; k++) {
        var o = S.notes[k];
        if (o.judged) continue;
        if (o.type === 'spinner') continue;
        if (o.type === 'slider' && o.holding) continue;
        if (o.time < t - 0.6) continue;
        if (o.time > t + 0.6) break;
        if (M.distTo(o) > rad * 1.15) continue;
        var d = Math.abs(t - o.time);
        if (d < bd) { bd = d; best = o; }
      }
      if (!best) return;
      var diffMs = (t - best.time) * 1000;
      var res = U.judge(diffMs);
      if (res === 'MISS') return;
      var p = M.hitPoint(best);
      if (best.type === 'slider') {
        best.holding = true;
        best.headJudged = true;
        best.ticks = Math.max(2, Math.round((best.endTime - best.time) / 0.2));
        best.ticksDone = 0;
        OSU.addHit(res, p.x, p.y);
        OSU.recordHit(diffMs);
        M.ring(p.x, p.y);
      } else {
        best.judged = true;
        OSU.addHit(res, p.x, p.y);
        OSU.recordHit(diffMs);
        M.ring(p.x, p.y);
      }
    },

    /* 松手即结束当前滑条：按松手位置判尾（osu 里松手就不再跟随，尾判按距离） */
    release: function () {
      for (var i = 0; i < S.notes.length; i++) {
        var n = S.notes[i];
        if (n.type !== 'slider' || !n.holding) continue;
        M.endSlider(n);
        return;
      }
    },

    endSlider: function (n) {
      n.holding = false;
      n.judged = true;
      var rad = M.radius();
      var ex = M.mx(n.ex), ey = M.my(n.ey);
      var db = Math.hypot(S.cursor.x - ex, S.cursor.y - ey);
      if (db < rad * 1.0) { OSU.addHit('PERFECT', ex, ey); M.ring(ex, ey); }
      else if (db < rad * 2.2) OSU.addHit('GREAT', ex, ey);
      else if (db < rad * 3.4) OSU.addHit('GOOD', ex, ey);
      else OSU.addMiss(ex, ey);
    },

    autoPlay: function (t) {
      for (var i = 0; i < S.notes.length; i++) {
        var n = S.notes[i];
        if (n.judged) continue;
        var p = { x: 0, y: 0 };
        if (n.type === 'circle' && t >= n.time) {
          n.judged = true;
          p = M.hitPoint(n);
          S.cursor.x = p.x; S.cursor.y = p.y;
          OSU.addHit('PERFECT', p.x, p.y);
          M.ring(p.x, p.y);
        } else if (n.type === 'slider') {
          if (!n.holding && t >= n.time) {
            n.holding = true; n.headJudged = true;
            n.ticks = Math.max(2, Math.round((n.endTime - n.time) / 0.12));
            n.ticksDone = 0;
            p = M.hitPoint(n);
            S.cursor.x = p.x; S.cursor.y = p.y;
            OSU.addHit('PERFECT', p.x, p.y);
            M.ring(p.x, p.y);
          }
          if (n.holding) {
            var f = U.clamp((t - n.time) / (n.endTime - n.time), 0, 1);
            S.cursor.x = M.mx(U.lerp(n.x, n.ex, f));
            S.cursor.y = M.my(U.lerp(n.y, n.ey, f));
          }
        } else if (n.type === 'spinner' && t >= n.time - 0.1) {
          S.cursor.x = M.lastLayout.w / 2; S.cursor.y = M.lastLayout.h / 2;
        }
      }
    },

    update: function (t) {
      var mw = U.win('MISS') / 1000;
      var rad = M.radius();
      for (var i = 0; i < S.notes.length; i++) {
        var n = S.notes[i];
        if (n.time > t + 1.4) break;
        if (n.judged) continue;
        var p = M.hitPoint(n);
        if (n.type === 'circle') {
          if (t > n.time + mw) { n.judged = true; OSU.addMiss(p.x, p.y); }
        } else if (n.type === 'slider') {
          if (!n.holding) {
            if (t > n.time + mw) { n.judged = true; OSU.addMiss(p.x, p.y); }
          } else {
            /* 光标跟随：按距离累计 tick */
            var f = U.clamp((t - n.time) / (n.endTime - n.time), 0, 1);
            var cx = M.mx(U.lerp(n.x, n.ex, f)), cy = M.my(U.lerp(n.y, n.ey, f));
            var need = Math.floor(f * n.ticks);
            while (n.ticksDone < need) {
              n.ticksDone++;
              var dd = Math.hypot(S.cursor.x - cx, S.cursor.y - cy);
              if (dd < rad) { OSU.addHit('GREAT', cx, cy); OSU.audio.sliderTick(); }
              else OSU.addMiss(cx, cy);
            }
            if (t >= n.endTime) M.endSlider(n);
          }
        } else if (n.type === 'spinner') {
          if (t > n.endTime) {
            n.judged = true;
            if (n.spins >= 4) OSU.addHit('PERFECT', p.x, p.y);
            else if (n.spins >= 1) OSU.addHit('GOOD', p.x, p.y);
            else OSU.addMiss(p.x, p.y);
          }
        }
      }
    },

    draw: function (ctx, t, l) {
      M.layout(l);
      var pal = OSU.pal();
      var rad = M.radius();
      var ar = APPROACH;

      /* 只画时间窗内的音符（import 大谱面时避免每帧遍历几千个） */
      var from = OSU.util.bisect(S.notes, t - 0.45);
      for (var i = from; i < S.notes.length; i++) {
        var n = S.notes[i];
        var dt = n.time - t;
        if (dt > ar) break;

        if (n.type === 'circle') {
          if (n.judged || dt < -0.35) continue;
          var x = M.mx(n.x), y = M.my(n.y);
          var a = U.clamp(1 - dt / ar, 0.18, 1);
          /* 外圈：从 3 倍半径向内收到圆边缘（osu 的 approach circle 行为） */
          var cr = rad * (1 + 2 * U.clamp(dt / ar, 0, 1));

          ctx.beginPath(); ctx.arc(x, y, rad, 0, 6.283);
          ctx.fillStyle = U.rgba(pal.primary, .52); ctx.fill();
          ctx.strokeStyle = U.rgba(pal.text, .85); ctx.lineWidth = 3; ctx.stroke();

          ctx.beginPath(); ctx.arc(x, y, rad * .62, 0, 6.283);
          ctx.strokeStyle = U.rgba(pal.secondary, .55); ctx.lineWidth = 1.5; ctx.stroke();

          ctx.globalAlpha = a;
          ctx.beginPath(); ctx.arc(x, y, cr, 0, 6.283);
          ctx.strokeStyle = pal.text; ctx.lineWidth = 2.5; ctx.stroke();
          ctx.globalAlpha = 1;

          ctx.fillStyle = U.rgba(pal.text, .92);
          ctx.font = '700 ' + Math.round(rad * .78) + 'px "Share Tech Mono", monospace';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(String(n.idx || 1), x, y + 1);
        } else if (n.type === 'slider') {
          if (n.judged || dt < -0.35) continue;
          var x1 = M.mx(n.x), y1 = M.my(n.y), x2 = M.mx(n.ex), y2 = M.my(n.ey);
          var ang = Math.atan2(y2 - y1, x2 - x1);
          var tr = rad * 0.46;
          /* 轨道：外描边 + 内层，接近 osu 的细长滑条 */
          ctx.strokeStyle = U.rgba(pal.secondary, .85); ctx.lineWidth = tr * 2.1;
          ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
          ctx.strokeStyle = U.rgba(pal.primary, n.holding ? .8 : .6); ctx.lineWidth = tr * 1.4;
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();

          /* 头 */
          ctx.beginPath(); ctx.arc(x1, y1, rad * .78, 0, 6.283);
          ctx.fillStyle = U.rgba(pal.primary, .45); ctx.fill();
          ctx.strokeStyle = U.rgba(pal.text, .9); ctx.lineWidth = 2.5; ctx.stroke();
          /* 尾 */
          ctx.beginPath(); ctx.arc(x2, y2, rad * .6, 0, 6.283);
          ctx.strokeStyle = U.rgba(pal.text, .7); ctx.lineWidth = 2.5; ctx.stroke();

          /* 接近环也画在滑条头 */
          if (!n.holding) {
            ctx.globalAlpha = U.clamp(1 - dt / ar, .2, 1);
            ctx.beginPath(); ctx.arc(x1, y1, rad * (1 + 2 * U.clamp(dt / ar, 0, 1)), 0, 6.283);
            ctx.strokeStyle = pal.text; ctx.lineWidth = 2; ctx.stroke();
            ctx.globalAlpha = 1;
          }

          /* 滑条球（跟随时） */
          if (n.holding) {
            var f = U.clamp((t - n.time) / (n.endTime - n.time), 0, 1);
            var bx = U.lerp(x1, x2, f), by = U.lerp(y1, y2, f);
            ctx.beginPath(); ctx.arc(bx, by, rad * .34, 0, 6.283);
            ctx.fillStyle = '#fff'; ctx.fill();
            ctx.strokeStyle = U.rgba(pal.secondary, .8); ctx.lineWidth = 2; ctx.stroke();
          }
        } else {
          /* spinner */
          if (n.judged || dt > ar || t > n.endTime) continue;
          var cx = l.w / 2, cy = l.h / 2;
            ctx.save();
            ctx.strokeStyle = U.rgba(pal.secondary, .8);
            ctx.lineWidth = 6;
            ctx.beginPath(); ctx.arc(cx, cy, rad * 2.1, 0, 6.283); ctx.stroke();
            ctx.setLineDash([12, 10]);
            ctx.lineDashOffset = -t * 90;
            ctx.strokeStyle = U.rgba(pal.text, .5);
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(cx, cy, rad * 2.4, 0, 6.283); ctx.stroke();
            ctx.restore();
            ctx.fillStyle = pal.text;
            ctx.font = '700 15px "Share Tech Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText('SPIN  ' + n.spins, cx, cy - rad * 2.7);
        }
      }

      /* 命中涟漪（淡出后清除） */
      var now = performance.now();
      for (var j = rings.length - 1; j >= 0; j--) {
        var rg = rings[j];
        var age = (now - rg.t) / 300;
        if (age >= 1) { rings.splice(j, 1); continue; }
        ctx.globalAlpha = 1 - age;
        ctx.beginPath(); ctx.arc(rg.x, rg.y, rad * (1 + age * 0.55), 0, 6.283);
        ctx.strokeStyle = rg.col; ctx.lineWidth = 3; ctx.stroke();
        ctx.beginPath(); ctx.arc(rg.x, rg.y, rad * (0.9 - age * 0.5), 0, 6.283);
        ctx.fillStyle = U.rgba(rg.col, .18 - age * .12); ctx.fill();
        ctx.globalAlpha = 1;
      }

      /* combo 数字跟随光标（osu 的观感） */
      if (S.combo >= 2) {
        ctx.fillStyle = U.rgba(pal.text, .55);
        ctx.font = '700 18px "Share Tech Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(S.combo + 'x', S.cursor.x, S.cursor.y + rad * 2.4);
        ctx.textAlign = 'left';
      }
    }
  };
})();
