/* osu-mode-catch.js —— 接水果模式 */
var OSU = window.Osu = window.Osu || {};

(function () {
  'use strict';
  var S = OSU.S;
  var U = OSU.util;

  var APPROACH = 1.05;
  var PLATE_W = 0.13;      // 相对画宽
  var TRAVEL = 0.86;       // 判定线位置（相对高）

  var kbLeft = false, kbRight = false;

  var M = OSU.modes.catch = {
    id: 'catch',
    canvas: { w: 860, h: 520 },
    keys: ['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'],
    labels: ['←', '→'],

    build: function (chart) {
      S.keys = M.keys; S.labels = M.labels; S.held = [false, false];
      S.plateX = 0.5;
      var out = [], ci = 0;
      for (var i = 0; i < chart.objects.length; i++) {
        var o = chart.objects[i];
        var nx = (o.x == null ? 256 : o.x) / 512;
        if (o.type === 'circle') {
          out.push({ time: o.time, x: U.clamp(nx, 0.02, 0.98), type: 'fruit', weight: 1, ci: ci++ });
        } else if (o.type === 'spinner') {
          out.push({ time: o.time, x: 0.5, type: 'fruit', weight: 1, banana: true, ci: ci++ });
        } else {
          var ex = (o.endX == null ? o.x : o.endX) / 512;
          var dur = Math.max(0.12, o.endTime - o.time);
          var steps = Math.max(2, Math.min(12, Math.round(dur / 0.09)));
          for (var k = 0; k <= steps; k++) {
            var f = k / steps;
            out.push({
              time: o.time + dur * f,
              x: U.clamp(U.lerp(nx, ex, f), 0.02, 0.98),
              type: k === 0 || k === steps ? 'fruit' : 'drop',
              weight: k === 0 ? 1 : 0.35,
              ci: k === 0 ? ci++ : (k === steps ? ci++ : -1)
            });
          }
        }
      }
      return out;
    },

    reset: function () { S.plateX = 0.5; kbLeft = kbRight = false; },

    press: function (lane) {
      if (lane === 0) kbLeft = true;
      if (lane === 1) kbRight = true;
    },
    release: function (lane) {
      if (lane === 0) kbLeft = false;
      if (lane === 1) kbRight = false;
    },

    tick: function (dt) {
      var v = 1.55 * dt;
      if (kbLeft) S.plateX -= v;
      if (kbRight) S.plateX += v;
      S.plateX = U.clamp(S.plateX, 0.02, 0.98);
    },

    isAuto: function () { return false; },

    autoPlay: function (t) {
      /* Auto：盘子跟随最近的音符 */
      var target = 0.5;
      for (var i = 0; i < S.notes.length; i++) {
        var n = S.notes[i];
        if (n.judged) continue;
        if (n.time >= t - 0.5) { target = n.x; break; }
      }
      /* Auto：逐音符对齐落点后再判定，同帧多个水果也能全接 */
      for (var i = 0; i < S.notes.length; i++) {
        var n = S.notes[i];
        if (n.judged || t < n.time) continue;
        S.plateX = n.x;
        M.judgeOne(n);
      }
      if (S.notes.length) S.plateX = target;
    },

    /* 单音符判定（按当前接盘位置分档） */
    judgeOne: function (n) {
      n.judged = true;
      var d = Math.abs(S.plateX - n.x);
      var p = M.hitPoint(n);
      if (d <= PLATE_W * 0.55) { OSU.addHit('PERFECT', p.x, p.y); OSU.audio.catchFruit(1); }
      else if (d <= PLATE_W * 0.95) { OSU.addHit('GREAT', p.x, p.y); OSU.audio.catchFruit(0); }
      else if (d <= PLATE_W * 1.5) { OSU.addHit('GOOD', p.x, p.y); }
      else { OSU.addMiss(p.x, p.y); M.missAt = performance.now(); }
    },

    /* 逐音符判定：到点即接 */
    catchCheck: function (t) {
      for (var i = 0; i < S.notes.length; i++) {
        var n = S.notes[i];
        if (n.judged || t < n.time) continue;
        M.judgeOne(n);
      }
    },

    update: function (t) {
      if (S.mods.AT) return;
      M.catchCheck(t);
    },

    hitPoint: function (n) {
      var l = M.lastLayout || { w: M.canvas.w, h: M.canvas.h };
      return { x: n.x * l.w, y: l.h * TRAVEL };
    },

    draw: function (ctx, t, l) {
      M.lastLayout = l;
      var pal = OSU.pal();
      var jy = l.h * TRAVEL;
      var pps = (jy + 40) / APPROACH;

      /* 判定带：osu!catch 就是接盘上沿一条细亮线，不要整条厚色块 */
      var bandG = ctx.createLinearGradient(0, jy - 10, 0, jy + 2);
      bandG.addColorStop(0, U.rgba(pal.secondary, 0));
      bandG.addColorStop(1, U.rgba(pal.secondary, pal.light ? .16 : .22));
      ctx.fillStyle = bandG;
      ctx.fillRect(0, jy - 10, l.w, 12);
      ctx.strokeStyle = pal.light ? 'rgba(30,20,12,.45)' : 'rgba(255,255,255,.55)';
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(0, jy); ctx.lineTo(l.w, jy); ctx.stroke();

      /* 水果（只画进入屏幕的） */
      var from = OSU.util.bisect(S.notes, t - 0.6);
      for (var i = from; i < S.notes.length; i++) {
        var n = S.notes[i];
        if (n.time - t > APPROACH + 0.4) break;
        if (n.judged) continue;
        var y = jy - (n.time - t) * pps;
        if (y > l.h + 30) continue;
        var x = n.x * l.w;
        var rad = n.type === 'drop' ? 11 : 17;
        var CI = ['#ff4d6d', '#ff9f43', '#ffe14d', '#5ddc7b', '#4db8ff', '#c266ff'];
        var hue = n.banana ? '#ffd24d' : (n.type === 'drop' ? '#9ce8ff' : CI[(n.ci || 0) % CI.length]);
        ctx.save();
        ctx.shadowColor = hue; ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.arc(x, y, rad, 0, 6.283);
        ctx.fillStyle = hue; ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = pal.light ? 'rgba(0,0,0,.28)' : 'rgba(255,255,255,.75)';
        ctx.lineWidth = 1.8; ctx.stroke();
        ctx.beginPath(); ctx.arc(x - rad * .3, y - rad * .32, rad * .28, 0, 6.283);
        ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fill();
        ctx.restore();
      }

      /* 接盘 */
      var pw = l.w * PLATE_W;
      var px = S.plateX * l.w;
      var py = jy + 24;   /* 接盘上沿贴在判定带上，水果落到带子正好进碗 */
      ctx.save();
      var missAge = (performance.now() - (M.missAt || 0)) / 380;
      var hot = missAge >= 0 && missAge < 1;
      ctx.shadowColor = hot ? '#ff3355' : pal.primary;
      ctx.shadowBlur = 18;
      var pg = ctx.createLinearGradient(0, py - 14, 0, py + 8);
      pg.addColorStop(0, hot ? 'rgba(255,90,110,.95)' : U.rgba(pal.secondary, .95));
      pg.addColorStop(1, hot ? 'rgba(240,40,70,.95)' : U.rgba(pal.primary, .95));
      ctx.fillStyle = pg;
      ctx.beginPath();
      M.platePath(ctx, px, py, pw);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,.5)';
      ctx.lineWidth = 2;
      ctx.beginPath(); M.platePath(ctx, px, py, pw); ctx.stroke();

      /* combo 数字（设置里的「连击数字跟随光标」对 catch 也生效） */
      if (S.combo >= 2 && (!OSU.settings || OSU.settings.on('comboNum'))) {
        ctx.textAlign = 'center';
        ctx.font = '700 20px "Share Tech Mono", monospace';
        ctx.fillStyle = U.rgba(pal.text, pal.light ? .7 : .55);
        ctx.fillText(S.combo + 'x', px, py - 32);
      }

      ctx.textAlign = 'center';
      ctx.font = '600 12px "Share Tech Mono", monospace';
      ctx.fillStyle = U.rgba(pal.text, .4);
      ctx.fillText('← → ARROWS  /  MOUSE', l.w / 2, l.h - 6);
      ctx.textAlign = 'left';
    },

    /* 接盘：碗形（上沿平、底部收成弧，接近 osu 的 catcher） */
    platePath: function (ctx, px, py, pw) {
      var hw = pw / 2, top = py - 14;
      ctx.moveTo(px - hw, top);
      ctx.lineTo(px + hw, top);
      ctx.quadraticCurveTo(px + hw * 0.88, py + 12, px, py + 18);
      ctx.quadraticCurveTo(px - hw * 0.88, py + 12, px - hw, top);
      ctx.closePath();
    }
  };
})();
