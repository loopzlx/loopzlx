/* osu-game.js —— 主循环 / 开始 / 暂停 / 结算 */
var OSU = window.Osu = window.Osu || {};

(function () {
  'use strict';
  var S = OSU.S;
  var U = OSU.util;

  var cv = null, ctx = null, dpr = 1;
  var wrapEl = null, hudEl = null, hud = {};
  var bgCanvas = null, bgKey = '';

  var G = OSU.game = {};

  G.attach = function () {
    cv = document.getElementById('osu-cv');
    wrapEl = document.getElementById('osu-board-wrap');
    hudEl = document.getElementById('osu-hud');
    if (!cv) return;
    ctx = cv.getContext('2d');
    hud = {
      score: hudEl && hudEl.querySelector('[data-hud="score"]'),
      combo: hudEl && hudEl.querySelector('[data-hud="combo"]'),
      acc: hudEl && hudEl.querySelector('[data-hud="acc"]'),
      prog: hudEl && hudEl.querySelector('[data-hud="prog"]'),
      hp: hudEl && hudEl.querySelector('[data-hud="hp"]')
    };
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    G.resize();
    window.addEventListener('resize', function () { G.resize(); });
  };

  G.resize = function () {
    var impl = OSU.modes[S.mode] || OSU.modes.mania;
    var base = impl.canvas;
    var boxW = wrapEl ? wrapEl.clientWidth : 860;
    var boxH = wrapEl ? wrapEl.clientHeight : 520;
    var ratio = base.w / base.h;
    var w = boxW, h = boxW / ratio;
    if (h > boxH) { h = boxH; w = boxH * ratio; }
    G.view = { w: w, h: h };
    if (!cv) return;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    cv.style.width = Math.round(w) + 'px';
    cv.style.height = Math.round(h) + 'px';
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bgKey = '';   /* 尺寸变了，背景缓存失效 */
  };

  /* 逻辑坐标 ←→ 画布像素 */
  G.toCanvas = function (e) {
    if (!cv || !cv.getBoundingClientRect) return { x: 0, y: 0 };
    var r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (G.view.w / r.width), y: (e.clientY - r.top) * (G.view.h / r.height) };
  };

  G.start = function (chart, modeKey) {
    S.mode = modeKey;
    S.chart = chart;
    S.demo = !!chart.demo;
    S.view = 'play';
    OSU.ui.showView('play');
    OSU.game.resize();

    var impl = OSU.modes[modeKey];
    impl.reset();
    S.notes = OSU.bm.buildNotes(chart, modeKey);
    S.od = chart.od || 5;
    S.cs = chart.cs || 4;
    S.hp = chart.hp || 5;
    S.bpm = chart.bpm || 0;

    S.combo = 0; S.maxCombo = 0; S.score = 0; S.judged = 0; S.counts = {};
    S.hitErrors = []; S.health = 70; S.displayHealth = 70; S.failed = false; S.paused = false;
    S.songTime = 0;
    hudCache = { score: -1, combo: -1, acc: -1, prog: -1, hp: -1 };
    OSU.resetFx && OSU.resetFx();

    var last = 0;
    for (var i = 0; i < S.notes.length; i++) {
      var n = S.notes[i];
      last = Math.max(last, n.endTime || n.time);
    }
    S.songEnd = last + 2.2;

    var lead = chart.demo ? OSU.DEMO.limit : 1.6;
    OSU.audio.init();
    S.songStartAt = OSU.audio.now() + lead;
    OSU.audio.resetDemoSynth();

    /* 播放伴奏 */
    OSU.audio.stopBuffer();
    if (chart.song && chart.song.bufferRef) {
      OSU.audio.playBuffer(chart.song.bufferRef, S.speed, 0, S.songStartAt);
    }

    /* pad 提示 + 模式标签 */
    OSU.ui.buildPads(modeKey);
    var label = document.getElementById('osu-play-mode');
    if (label) label.textContent = (OSU.C.MODE_CN[modeKey] || modeKey) + ' · ' + (chart.version || '');

    S.running = true;
    S.lastFrame = performance.now();
    S.loopId++;
    requestAnimationFrame(G.loop);
    OSU.log('START // ' + (chart.title || 'untitled') + ' [' + modeKey.toUpperCase() + ']');
  };

  G.songTime = function () {
    var raw = (OSU.audio.now() - S.songStartAt) * (S.speed || 1);
    return raw < -OSU.DEMO.limit ? -OSU.DEMO.limit : raw;
  };

  G.loop = function () {
    if (!S.running || S.paused) return;
    var id = S.loopId;
    requestAnimationFrame(function () { if (S.loopId === id) G.loop(); });

    var now = performance.now();
    var dt = S.lastFrame ? Math.min(0.05, (now - S.lastFrame) / 1000) : 0.016;
    S.lastFrame = now;

    S.songTime = G.songTime();
    var impl = OSU.modes[S.mode];

    if (S.demo) OSU.audio.demoSynth(S.songTime, S.speed);
    if (S.mods.AT && !S.paused) impl.autoPlay(S.songTime);
    if (impl.tick) impl.tick(dt);
    if (!S.mods.AT) impl.update(S.songTime);
    else if (impl.update) impl.update(S.songTime);
    OSU.updateFx(dt);

    if (S.failed && !S.mods.NF) { G.finish(true); return; }
    S.displayHealth += (S.health - S.displayHealth) * Math.min(1, dt * 10);

    G.render();
    G.updateHud();

    if (S.songTime > S.songEnd) G.finish(false);
  };

  G.render = function () {
    var impl = OSU.modes[S.mode];
    var l = G.view;
    var pal = OSU.pal();
    /* 背景（渐变 + 网格）只在尺寸/主题变化时重画一次，每帧只 drawImage */
    var key = Math.round(l.w) + 'x' + Math.round(l.h) + '|' + pal.primary;
    if (bgKey !== key || !bgCanvas) {
      bgKey = key;
      var pm = (window.devicePixelRatio || 1) > 1 ? Math.min(2, window.devicePixelRatio) : 1;
      bgCanvas = document.createElement('canvas');
      bgCanvas.width = Math.round(l.w * pm);
      bgCanvas.height = Math.round(l.h * pm);
      var b = bgCanvas.getContext('2d');
      b.setTransform(pm, 0, 0, pm, 0, 0);
      var bg = b.createLinearGradient(0, 0, 0, l.h);
      bg.addColorStop(0, U.rgba(pal.primary, .10));
      bg.addColorStop(1, 'rgba(0,0,0,.55)');
      b.fillStyle = bg;
      b.fillRect(0, 0, l.w, l.h);
      b.strokeStyle = U.rgba(pal.primary, .10);
      b.lineWidth = 1;
      var step = 48;
      b.beginPath();
      for (var gx = 0; gx < l.w; gx += step) { b.moveTo(gx, 0); b.lineTo(gx, l.h); }
      for (var gy = 0; gy < l.h; gy += step) { b.moveTo(0, gy); b.lineTo(l.w, gy); }
      b.stroke();
    }
    ctx.drawImage(bgCanvas, 0, 0, l.w, l.h);

    impl.draw(ctx, S.songTime, l);
    OSU.drawSparks(ctx);

    /* 光标（std / catch 可视化） */
    if (S.mode === 'std' || S.mode === 'catch') {
      ctx.beginPath();
      ctx.arc(S.cursor.x, S.cursor.y, 7, 0, 6.283);
      ctx.strokeStyle = U.rgba(pal.secondary, .8);
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    /* 判定弹窗 */
    var pw = performance.now();
    for (var i = 0; i < 6; i++) { }
    ctx.textAlign = 'center';
    ctx.font = '700 20px "Share Tech Mono", monospace';
    /* 由 core 的 popups 队列绘制（最近 3 条） */
    if (OSU.fxPopups) {
      var list = OSU.fxPopups();
      var it = list[list.length - 1];
      if (it) {
        var age = (pw - it.t) / 620;
        ctx.globalAlpha = Math.max(0, 1 - age);
        ctx.fillStyle = it.color;
        ctx.shadowColor = it.color; ctx.shadowBlur = 16;
        /* 判定文字跟随击打点（osu 的判定贴在音符附近），无坐标时才落回底部中央 */
        var px = (it.x != null && isFinite(it.x) && it.x > 0) ? it.x : l.w / 2;
        var py = (it.y != null && isFinite(it.y) && it.y > 0) ? it.y - 46 : l.h * 0.70;
        ctx.fillText(it.name, px, py - age * 22);
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'left';
  };

  var hudCache = { score: -1, combo: -1, acc: -1, prog: -1, hp: -1 };
  G.updateHud = function () {
    if (!hudEl) return;
    var acc = OSU.acc();
    if (hud.score && hudCache.score !== S.score) { hud.score.textContent = U.fmt(S.score); hudCache.score = S.score; }
    if (hud.combo && hudCache.combo !== S.combo) { hud.combo.textContent = S.combo + 'x'; hudCache.combo = S.combo; }
    if (hud.acc && Math.abs(hudCache.acc - acc) > 0.005) { hud.acc.textContent = acc.toFixed(2) + '%'; hudCache.acc = acc; }
    var frac = S.songEnd ? U.clamp(S.songTime / S.songEnd, 0, 1) : 0;
    if (hud.prog && Math.abs(hudCache.prog - frac) > 0.002) { hud.prog.style.width = (frac * 100).toFixed(2) + '%'; hudCache.prog = frac; }
    var hpf = U.clamp(S.displayHealth, 0, 100);
    if (hud.hp && Math.abs(hudCache.hp - hpf) > 0.3) { hud.hp.style.width = hpf.toFixed(1) + '%'; hudCache.hp = hpf; }
  };

  G.pause = function (force) {
    if (!S.running) return;
    if (S.paused && !force) return G.resume();
    S.paused = true;
    OSU.audio.suspend();
    OSU.ui.showPause(true);
  };

  G.resume = function () {
    if (!S.running) return;
    S.paused = false;
    OSU.audio.resume();
    S.lastFrame = performance.now();
    OSU.ui.showPause(false);
    requestAnimationFrame(G.loop);
  };

  G.quit = function () {
    S.running = false;
    S.paused = false;
    S.loopId++;
    OSU.audio.stopBuffer();
    OSU.ui.showPause(false);
    OSU.ui.showView('menu');
  };

  G.finish = function (isFailed) {
    if (!S.running) return;
    S.running = false;
    S.loopId++;
    OSU.audio.stopBuffer();
    OSU.audio.suspend();
    /* 未判定的对象补 miss */
    for (var i = 0; i < S.notes.length; i++) {
      var n = S.notes[i];
      if (n.judged) continue;
      n.judged = true;
      if (n.headJudged && n.holding) { n.holding = false; continue; }
      OSU.addMiss(0, 0);
    }
    OSU.ui.showResult(isFailed);
  };

})();
