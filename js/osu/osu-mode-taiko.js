/* osu-mode-taiko.js —— 鼓点模式（don / kat / drumroll） */
var OSU = window.Osu = window.Osu || {};

(function () {
  'use strict';
  var S = OSU.S;
  var U = OSU.util;

  var APPROACH = 1.1;
  var rolls = [];

  var M = OSU.modes.taiko = {
    id: 'taiko',
    canvas: { w: 860, h: 520 },
    /* lane 0 = don（红），lane 1 = kat（蓝）；与 osu taiko 的双色键一致 */
    keys: ['KeyZ', 'KeyX'],
    labels: ['DON', 'KAT'],

    build: function (chart) {
      S.keys = M.keys; S.labels = M.labels; S.held = [false, false];
      var out = [];
      for (var i = 0; i < chart.objects.length; i++) {
        var o = chart.objects[i];
        var kat = (o.hitSound & 10) !== 0;   // whistle(2) / clap(8) → kat
        if (o.type === 'circle') {
          out.push({ time: o.time, kat: kat, type: 'hit', weight: 1 });
        } else {
          out.push({ time: o.time, endTime: o.endTime, kat: kat, type: 'roll', weight: 1, hits: 0 });
        }
      }
      return out;
    },

    reset: function () { rolls = []; M.flashDon = 0; M.flashKat = 0; },

    /* 判定圈命中闪光 */
    flash: function (isKat) { if (isKat) M.flashKat = performance.now(); else M.flashDon = performance.now(); },

    press: function (lane, t) {
      /* 先处理进行中的 roll：按一次算一次命中 */
      for (var r = 0; r < S.notes.length; r++) {
        var rn = S.notes[r];
        if (rn.type !== 'roll' || rn.judged) continue;
        if (t >= rn.time && t <= rn.endTime) {
          rn.hits++;
          if (t - (rn.lastHit || 0) > 0.07) {
            rn.lastHit = t;
            OSU.addHit('GREAT', M.hitPoint(rn).x, M.hitPoint(rn).y);
            if (rn.kat) OSU.audio.kat(); else OSU.audio.don();
          }
          return;
        }
      }

      var best = null, bd = 1e9;
      for (var i = 0; i < S.notes.length; i++) {
        var n = S.notes[i];
        if (n.judged || n.type !== 'hit') continue;
        if (n.time < t - 0.7) continue;
        if (n.time > t + 0.7) break;
        var d = Math.abs(t - n.time);
        if (d < bd) { bd = d; best = n; }
      }
      if (!best) return;
      var diffMs = (t - best.time) * 1000;
      var res = U.judge(diffMs);
      if (res === 'MISS') return;

      /* 颜色必须对：don 键打 don、kat 键打 kat，打错按 miss（osu 的错色行为） */
      var want = lane === 1 ? 1 : 0;
      if ((best.kat ? 1 : 0) !== want) {
        best.judged = true;
        var pm = M.hitPoint(best);
        OSU.addMiss(pm.x, pm.y);
        return;
      }

      best.judged = true;
      var p = M.hitPoint(best);
      OSU.addHit(res, p.x, p.y);
      OSU.recordHit(diffMs);
      M.flash(best.kat);
      if (best.kat) OSU.audio.kat(); else OSU.audio.don();
    },

    release: function () {},

    autoPlay: function (t) {
      for (var i = 0; i < S.notes.length; i++) {
        var n = S.notes[i];
        if (n.judged) continue;
        if (n.type === 'hit' && t >= n.time) {
          n.judged = true;
          M.flash(n.kat);
          OSU.addHit('PERFECT', M.hitPoint(n).x, M.hitPoint(n).y);
        } else if (n.type === 'roll') {
          if (t >= n.time && t <= n.endTime) {
            if (t - (n.lastHit || 0) > 0.09) {
              n.lastHit = t;
              OSU.addHit('GREAT', M.hitPoint(n).x, M.hitPoint(n).y);
            }
          } else if (t > n.endTime) {
            n.judged = true;
            OSU.addHit('PERFECT', M.hitPoint(n).x, M.hitPoint(n).y);
          }
        }
      }
    },

    update: function (t) {
      var mw = U.win('MISS') / 1000;
      for (var i = 0; i < S.notes.length; i++) {
        var n = S.notes[i];
        if (n.time > t + 1.6) break;
        if (n.judged) continue;
        var p = M.hitPoint(n);
        if (n.type === 'hit') {
          if (t > n.time + mw) { n.judged = true; OSU.addMiss(p.x, p.y); }
        } else {
          if (!n.started && t >= n.time) { n.started = true; }
          if (t > n.endTime + mw) {
            n.judged = true;
            if (n.hits === 0) OSU.addMiss(p.x, p.y, true);
            else OSU.addHit('GOOD', p.x, p.y);
          }
        }
      }
    },

    hitPoint: function (n) {
      var l = M.lastLayout || { w: M.canvas.w, h: M.canvas.h };
      return { x: l.w * 0.17, y: n.kat ? l.h * 0.36 : l.h * 0.64 };
    },

    draw: function (ctx, t, l) {
      M.lastLayout = l;
      var pal = OSU.pal();
      var jx = l.w * 0.17;
      var yDon = l.h * 0.64, yKat = l.h * 0.36;
      var pps = (l.w - jx) / APPROACH;
      var r = Math.min(l.h * 0.075, 44);

      /* 判定圈（don 红 / kat 蓝，命中后向外扩散一圈） */
      var now = performance.now();
      [[yDon, '#ff5566', M.flashDon, 'DON'], [yKat, '#44aaff', M.flashKat, 'KAT']].forEach(function (pair) {
        var yy = pair[0], col = pair[1];
        ctx.beginPath(); ctx.arc(jx, yy, r, 0, 6.283);
        ctx.strokeStyle = U.rgba(col, .9); ctx.lineWidth = 4; ctx.stroke();

        ctx.beginPath(); ctx.arc(jx, yy, r * .74, 0, 6.283);
        ctx.fillStyle = U.rgba(col, .16); ctx.fill();

        var age = (now - (pair[2] || 0)) / 420;
        if (age >= 0 && age < 1) {
          ctx.globalAlpha = 1 - age;
          ctx.beginPath(); ctx.arc(jx, yy, r * (1 + age * 0.9), 0, 6.283);
          ctx.strokeStyle = U.rgba(col, .8); ctx.lineWidth = 3; ctx.stroke();
          ctx.globalAlpha = 1;
        }


      });

      /* 轨道参考线（与 don / kat 判定圈同高） */
      ctx.strokeStyle = U.rgba(pal.primary, .22);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(jx + r, yKat); ctx.lineTo(l.w, yKat); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(jx + r, yDon); ctx.lineTo(l.w, yDon); ctx.stroke();

      /* 音符 */
      for (var i = 0; i < S.notes.length; i++) {
        var n = S.notes[i];
        if (n.time - t > 2.6) break;
        if (n.judged) continue;
        var yy = n.kat ? yKat : yDon;
        var x = jx + (n.time - t) * pps;
        if (n.type === 'roll') {
          var xEnd = jx + (n.endTime - t) * pps;
          var w0 = Math.max(6, xEnd - x);
          if (xEnd < -20 || x > l.w + 40) continue;
          ctx.fillStyle = U.rgba(n.kat ? '#66ccff' : '#ffcc22', .55);
          ctx.fillRect(x, yy - r * 0.42, w0, r * 0.84);
          ctx.strokeStyle = U.rgba(pal.text, .5);
          ctx.lineWidth = 2;
          ctx.strokeRect(x, yy - r * 0.42, w0, r * 0.84);
          /* 连打条内的点阵，贴近 osu 的 drumroll */
          ctx.fillStyle = U.rgba(pal.text, .45);
          var dotStep = Math.max(14, r * 0.62);
          for (var dx = r * 0.6; dx < w0 - r * 0.3; dx += dotStep) {
            ctx.beginPath(); ctx.arc(x + dx, yy, 2.2, 0, 6.283); ctx.fill();
          }
          if (n.hits) {
            ctx.fillStyle = '#fff';
            ctx.font = '700 13px "Share Tech Mono", monospace';
            ctx.fillText(n.hits, x + 6, yy - r * 0.6);
          }
          continue;
        }
        if (x < -r || x > l.w + r) continue;
        var rad = r * 0.92;
        ctx.beginPath();
        ctx.arc(x, yy, rad, 0, 6.283);
        ctx.fillStyle = n.kat ? 'rgba(80,190,255,.75)' : 'rgba(255,150,120,.78)';
        ctx.fill();
        ctx.strokeStyle = n.kat ? '#66ccff' : '#ff5555';
        ctx.lineWidth = 3;
        ctx.stroke();
        if (n.kat) {  /* kat 内圈 */
          ctx.beginPath(); ctx.arc(x, yy, rad * 0.42, 0, 6.283);
          ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2; ctx.stroke();
        } else {      /* don 内圈 */
          ctx.beginPath(); ctx.arc(x, yy, rad * 0.38, 0, 6.283);
          ctx.fillStyle = 'rgba(255,230,160,.9)'; ctx.fill();
        }
      }

      /* 键位提示改到下方 pads，画布内不再重复 */
    }
  };
})();
