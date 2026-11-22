/* osu-mode-taiko.js —— 鼓点模式（don / kat / drumroll） */
var OSU = window.Osu = window.Osu || {};

(function () {
  'use strict';
  var S = OSU.S;
  var U = OSU.util;

  var APPROACH = 1.1;
  var rolls = [];

  /* 滚奏单次命中：按住键时由 update 自动续打（连打会更快） */
  function rollHit(n, t, manual) {
    if (!n || n.judged) return;
    var gap = manual ? 0.04 : 0.09;
    if (t - (n.lastHit || -1e9) < gap) return;
    n.lastHit = t;
    n.hits = (n.hits || 0) + 1;
    if (manual && M.flash) M.flash(n.kat);
    if (n.kat) OSU.audio.kat(); else OSU.audio.don();
  }

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

    rollHit: function (n, t, manual) { rollHit(n, t, manual); },

    /* 判定圈命中闪光 */
    flash: function (isKat) { if (isKat) M.flashKat = performance.now(); else M.flashDon = performance.now(); },

    press: function (lane, t) {
      /* 进行中的 drumroll：取最近的一段记一次命中，但不再 return —— 滚奏期间照样能打普通音符 */
      var targetRoll = null, rollGap = 1e9;
      for (var r = 0; r < S.notes.length; r++) {
        var rn = S.notes[r];
        if (rn.type !== 'roll' || rn.judged) continue;
        if (rn.time > t + 0.4) break;
        if (t >= rn.time - 0.08 && t <= rn.endTime) {
          var gap = Math.abs(t - rn.time);
          if (gap < rollGap) { rollGap = gap; targetRoll = rn; }
        }
      }
      if (targetRoll) rollHit(targetRoll, t, true);

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
          if (t >= n.time && t <= n.endTime) rollHit(n, t, false);
          else if (t > n.endTime) {
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
          /* 长条进行中：对应颜色的键按住就持续出货（osu 里按住 / 连打都可） */
          if (t >= n.time && t <= n.endTime) {
            var held = S.held[n.kat ? 1 : 0] || S.held[0] || S.held[1];
            if (held) rollHit(n, t, false);
          }
          if (t > n.endTime + mw) {
            n.judged = true;
            n.fadeOut = t;
            var need = Math.max(2, Math.round((n.endTime - n.time) * 6));
            if (!n.hits) OSU.addMiss(p.x, p.y, true);
            else if (n.hits >= need) OSU.addHit('PERFECT', p.x, p.y);
            else OSU.addHit('GOOD', p.x, p.y);
          }
        }
      }
    },

    /* 长条的圆角胶囊路径（左右都为半圆封口） */
    rollPath: function (ctx, x, y, w, h, strokeOnly) {
      var rr = h / 2;
      if (w < h) w = h;
      ctx.beginPath();
      if (ctx.roundRect) { ctx.roundRect(x, y, w, h, rr); return; }
      ctx.moveTo(x + rr, y);
      ctx.lineTo(x + w - rr, y);
      ctx.arc(x + w - rr, y + rr, rr, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(x + rr, y + h);
      ctx.arc(x + rr, y + rr, rr, Math.PI / 2, Math.PI * 1.5);
      ctx.closePath();
    },

    hitPoint: function (n) {
      var l = M.lastLayout || { w: M.canvas.w, h: M.canvas.h };
      /* osu!taiko 是单行轨道：don / kat 都在同一条线上，只有颜色和内圈不同 */
      return { x: l.w * 0.17, y: l.h * 0.52 };
    },

    draw: function (ctx, t, l) {
      M.lastLayout = l;
      var pal = OSU.pal();
      var jx = l.w * 0.17;
      var yLine = l.h * 0.52;

      var pps = (l.w - jx) / APPROACH;
      /* 判定圈/音符半径：比之前小一档，轨道带上下更紧凑（接近 osu!taiko 那条窄带的比例） */
      var r = Math.min(l.h * 0.055, 32);
      var bandH = r * 2.9;

      /* 判定圈（don 红 / kat 蓝，命中后向外扩散一圈） */
      /* 轨道带：osu!taiko 的游玩区就是一条横贯全宽的窄深带，音符只在带子里走 */
      ctx.fillStyle = pal.light ? 'rgba(46,34,24,.82)' : 'rgba(8,6,16,.82)';
      ctx.fillRect(0, yLine - bandH / 2, l.w, bandH);
      ctx.strokeStyle = pal.light ? 'rgba(0,0,0,.35)' : U.rgba(pal.primary, .35);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, yLine - bandH / 2); ctx.lineTo(l.w, yLine - bandH / 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, yLine + bandH / 2); ctx.lineTo(l.w, yLine + bandH / 2); ctx.stroke();

      var now = performance.now();
      /* 判定圈：单圈，最近一次命中是 don 就红、kat 就蓝 */
      var lastDon = M.flashDon || 0, lastKat = M.flashKat || 0;
      var ringCol = lastKat > lastDon ? '#44aaff' : '#ff5566';
      var ringFlash = Math.max(lastDon, lastKat);
      ctx.beginPath(); ctx.arc(jx, yLine, r, 0, 6.283);
      ctx.strokeStyle = 'rgba(255,255,255,.92)'; ctx.lineWidth = 4.5; ctx.stroke();  /* 白圈打底，几乎就是 osu!taiko 皮肤的判定圈 */
      ctx.beginPath(); ctx.arc(jx, yLine, r, 0, 6.283);
      ctx.strokeStyle = U.rgba(ringCol, .95); ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath(); ctx.arc(jx, yLine, r * .74, 0, 6.283);
      ctx.fillStyle = U.rgba(ringCol, .14); ctx.fill();
      var age = (now - ringFlash) / 420;
      if (age >= 0 && age < 1) {
        ctx.globalAlpha = 1 - age;
        ctx.beginPath(); ctx.arc(jx, yLine, r * (1 + age * 0.9), 0, 6.283);
        ctx.strokeStyle = U.rgba(ringCol, .8); ctx.lineWidth = 3; ctx.stroke();
        ctx.globalAlpha = 1;
      }

      /* 中央 combo 数字（osu!taiko 的连击数也在画面中央偏上） */
      if (S.combo >= 10) {
        ctx.textAlign = 'center';
        ctx.font = '800 26px "Share Tech Mono", monospace';
        ctx.fillStyle = U.rgba(pal.text, pal.light ? .8 : .7);
        ctx.fillText(S.combo + 'x', l.w * 0.5, l.h * 0.5);
        ctx.textAlign = 'left';
      }

      /* 轨道参考线（单行） */
      ctx.strokeStyle = U.rgba(pal.primary, .28);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(jx + r, yLine); ctx.lineTo(l.w, yLine); ctx.stroke();

      /* 音符 */
      for (var i = 0; i < S.notes.length; i++) {
        var n = S.notes[i];
        if (n.time - t > 2.6) break;
        if (n.judged) continue;
        var yy = yLine;
        var x = jx + (n.time - t) * pps;
        if (n.type === 'roll') {
          /* drumroll：粗胶囊 + 两端圆头，整条连续不断，越过判定圈的部分自然被吃掉 */
          var xHead = jx + (n.time - t) * pps;
          var xEnd = jx + (n.endTime - t) * pps;
          var rightCap = l.w + 70;
          if (xEnd < jx - 6 || xHead > rightCap) continue;
          if (n.judged && n.fadeOut != null && t - n.fadeOut > 0.45) continue;

          var rollH = r * 1.18;
          var left = Math.max(jx - rollH / 2, Math.min(xHead, rightCap));
          var right = Math.min(rightCap, Math.max(xEnd, jx + 2));
          if (right < left) right = left;
          var fade = (n.judged && n.fadeOut != null) ? Math.max(0, 1 - (t - n.fadeOut) / 0.45) : 1;
          var col = n.kat ? '#66ccff' : '#ffcc22';

          ctx.globalAlpha = fade;
          /* 未打部分 */
          ctx.fillStyle = U.rgba(col, .26);
          M.rollPath(ctx, left, yy - rollH / 2, right - left, rollH);
          ctx.fill();
          /* 已完成部分（按住 / 连打推进） */
          var prog = Math.min(1, Math.max(0, (t - n.time) / Math.max(0.001, n.endTime - n.time)));
          var fillW = (right - left) * prog;
          if (fillW > 0.5) {
            ctx.fillStyle = U.rgba(col, .82);
            M.rollPath(ctx, left, yy - rollH / 2, fillW, rollH);
            ctx.fill();
          }
          /* 描边 + 右端封口圆（左端由判定圈遮住） */
          ctx.strokeStyle = 'rgba(255,255,255,.55)';
          ctx.lineWidth = 2;
          M.rollPath(ctx, left, yy - rollH / 2, Math.max(2, right - left), rollH);
          ctx.stroke();
          if (right < rightCap) {
            ctx.beginPath();
            ctx.arc(right - rollH / 2, yy, rollH / 2, 0, 6.283);
            ctx.strokeStyle = 'rgba(255,255,255,.55)';
            ctx.stroke();
          }
          /* 点阵（osu 的 drumroll 内点） */
          ctx.fillStyle = 'rgba(255,255,255,.45)';
          var dotStep = Math.max(13, r * 0.55);
          for (var dx = left + rollH / 2; dx < right - rollH / 2; dx += dotStep) {
            ctx.beginPath(); ctx.arc(dx, yy, 2, 0, 6.283); ctx.fill();
          }
          if (n.hits) {
            ctx.fillStyle = '#fff';
            ctx.font = '700 12px "Share Tech Mono", monospace';
            ctx.fillText(String(n.hits), jx + 6, yy - rollH / 2 - 6);
          }
          ctx.globalAlpha = 1;
          continue;
        }
        if (x < -r || x > l.w + r) continue;
        var rad = r * 0.92;
        ctx.beginPath();
        ctx.arc(x, yy, rad, 0, 6.283);
        ctx.fillStyle = n.kat ? '#3fb6f2' : '#f25361';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.9)';
        ctx.lineWidth = 2.6;
        ctx.stroke();
        if (n.kat) {  /* kat：内侧白圈 */
          ctx.beginPath(); ctx.arc(x, yy, rad * 0.5, 0, 6.283);
          ctx.strokeStyle = 'rgba(255,255,255,.62)'; ctx.lineWidth = 2; ctx.stroke();
        } else {      /* don：内侧小实心圆（osu 原版 hitcircle 的同心圆感） */
          ctx.beginPath(); ctx.arc(x, yy, rad * 0.42, 0, 6.283);
          ctx.fillStyle = 'rgba(255,240,200,.95)'; ctx.fill();
        }
      }

      /* 键位提示改到下方 pads，画布内不再重复 */
    }
  };
})();
