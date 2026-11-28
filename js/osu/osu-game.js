/* osu-game.js —— 主循环 / 开始 / 暂停 / 结算 */
var OSU = window.Osu = window.Osu || {};

(function () {
  'use strict';
  var S = OSU.S;
  var U = OSU.util;

  var cv = null, ctx = null, dpr = 1;
  var wrapEl = null, hudEl = null, hud = {};
  var bgCanvas = null, bgKey = '';
  var fpsEl = null, fpsFrames = 0, fpsT0 = 0;
  var fpsValEl = null, fpsMsEl = null, fpsGraph = null, fpsGctx = null;
  var fpsTimes = [], fpsLastRenderAt = 0, fpsPrevAt = 0;

  var G = OSU.game = {};

  G.attach = function () {
    cv = document.getElementById('osu-cv');
    wrapEl = document.getElementById('osu-board-wrap');
    hudEl = document.getElementById('osu-hud');
    if (!cv) return;
    ctx = cv.getContext('2d');
    fpsEl = document.getElementById('osu-hud-fps');
    fpsValEl = document.getElementById('osu-fps-val');
    fpsMsEl = document.getElementById('osu-fps-ms');
    fpsGraph = document.getElementById('osu-fps-graph');
    if (fpsGraph) fpsGctx = fpsGraph.getContext('2d');
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

    if (OSU.applySkin) OSU.applySkin();
    var impl = OSU.modes[modeKey];
    impl.reset();
    S.notes = OSU.bm.buildNotes(chart, modeKey);
    S.od = chart.od || 5;
    S.cs = chart.cs || 4;
    S.hp = chart.hp || 5;
    S.bpm = chart.bpm || 0;

    S.combo = 0; S.maxCombo = 0; S.score = 0; S.judged = 0; S.counts = {};
    S.comboParams = 0; S.accSum = 0; S.vSum = 0;
    S.maxComboParams = OSU.maxComboParams(Math.max(1, Math.round(OSU.totalObjects())));
    S.countdown = 0;
    S.hitErrors = []; S.health = 70; S.displayHealth = 70; S.failed = false; S.paused = false;
    S.songTime = 0;
    if (G.view) { S.cursor.x = G.view.w / 2; S.cursor.y = G.view.h * 0.45; }
    fpsFrames = 0; fpsT0 = 0; fpsTimes = []; fpsLastRenderAt = 0; fpsPrevAt = 0;
    G.drawFpsGraph();
    if (fpsEl) fpsEl.style.display = (OSU.settings && OSU.settings.on('showFps')) ? 'block' : 'none';
    hudCache = { score: -1, combo: -1, acc: -1, prog: -1, hp: -1 };
    OSU.resetFx && OSU.resetFx();

    var last = 0;
    for (var i = 0; i < S.notes.length; i++) {
      var n = S.notes[i];
      last = Math.max(last, n.endTime || n.time);
    }
    S.songEnd = last + 2.2;

    var lead = chart.demo ? 1.0 : 1.6;   /* 演示谱前导缩短，进游戏 2 秒内就能看见第一批音符 */
    OSU.audio.init();
    S.songStartAt = OSU.audio.now() + lead;
    OSU.audio.resetDemoSynth();

    /* 播放伴奏 */
    OSU.audio.stopBuffer();
    if (chart.song && chart.song.bufferRef) {
      OSU.audio.playBuffer(chart.song.bufferRef, S.speed, 0, S.songStartAt);
    }
    /* 时钟：优先音频时钟，音频被挂起时用墙钟推进（否则谱面停在原地不动） */
    S.clockMode = '';
    S.clockSkew = 0;
    S.songTime = -lead;

    /* pad 提示 + 模式标签 */
    OSU.ui.buildPads(modeKey);
    var label = document.getElementById('osu-play-mode');
    if (label) label.textContent = (OSU.C.MODE_CN[modeKey] || modeKey) + ' · ' + (chart.version || '');

    S.replay = null;
    S.replayMode = false;
    if (OSU.replay && OSU.replay.syncBar) OSU.replay.syncBar();
    if (OSU.replay) {
      if (!chart.replay && !chart.demo) OSU.replay.begin(chart, modeKey);
      else OSU.replay.abort();
    }
    S.running = true;
    S.lastFrame = performance.now();
    S.loopId++;
    requestAnimationFrame(G.loop);
    OSU.log('START // ' + (chart.title || 'untitled') + ' [' + modeKey.toUpperCase() + ']');
  };

  G.songTime = function () {
    if (S.replay && OSU.replay && OSU.replay.clock) { S.songTime = OSU.replay.clock(); return S.songTime; }   /* 回放用自己的时钟：可倍速、可拖动 */
    var speed = S.speed || 1;
    var live = OSU.audio.isLive ? OSU.audio.isLive() : false;
    if (live) {
      var raw = (OSU.audio.now() - S.songStartAt) * speed;
      if (S.clockMode !== 'audio') {            /* 从墙钟切回音频：记下偏移，避免跳帧 */
        S.clockSkew = (S.songTime || 0) - raw;
        S.clockMode = 'audio';
      }
      S.songTime = raw + (S.clockSkew || 0);
    } else {
      /* 音频上下文未运行（浏览器策略 / 暂停后残留）：用墙钟继续，谱面照常走 */
      var dt = S.lastFrame ? Math.min(0.05, (performance.now() - S.lastFrame) / 1000) : 0;
      S.songTime = (S.songTime || 0) + dt * speed;
      S.clockMode = 'wall';
    }
    return S.songTime;
  };

  /* 按键瞬间的歌曲时间：直接读音频时钟，并扣掉事件到本帧的排队延迟。
     之前判定用 S.songTime（上一帧刷的值），60fps 下误差最多 16.7ms、33fps 下 30ms，
     足够把准点的 PERFECT 打成 GREAT —— 这就是「判定偏移」的根源。 */
  G.timeAtPerf = function (perfTs) {
    var speed = S.speed || 1;
    var now = (typeof perfTs === 'number' && perfTs > 0) ? perfTs : performance.now();
    var lag = Math.max(0, Math.min(0.1, (performance.now() - now) / 1000));
    var live = OSU.audio.isLive ? OSU.audio.isLive() : false;
    if (live) {
      var raw = (OSU.audio.now() - lag) - (S.songStartAt || 0);
      return raw * speed + (S.clockSkew || 0);
    }
    return (S.songTime || 0) - lag * speed;
  };

  G.timeNow = function () { return G.songTime(); };

  G.loop = function () {
    if (!S.running || S.paused) return;
    if (document.hidden) {            /* 后台标签页不推谱面，省电；回来不跳时间 */
      S.fpsLastFrameAt = 0;
      var hid = S.loopId;
      requestAnimationFrame(function () { if (S.loopId === hid) G.loop(); });
      return;
    }
    var id = S.loopId;
    requestAnimationFrame(function () { if (S.loopId === id) G.loop(); });

    var now = performance.now();

    /* ---- 帧率上限（osu!lazer 的 Frame limiter）---- */
    var limit = OSU.settings ? OSU.settings.num('fpsLimit', 0) : 0;
    if (limit > 0) {
      var interval = 1000 / limit;
      if (now - fpsLastRenderAt < interval - 1.2) return;   // 本帧丢弃，下一帧再来
      fpsLastRenderAt = now;
    }

    var dt = S.lastFrame ? Math.min(0.05, (now - S.lastFrame) / 1000) : 0.016;

    S.songTime = G.songTime();
    S.lastFrame = now;
    var impl = OSU.modes[S.mode];

    /* ---- FPS 统计：数值 + 帧时间 + 波形 ---- */
    if (fpsPrevAt) {
      var ft = now - fpsPrevAt;
      if (ft < 200) { fpsTimes.push(ft); if (fpsTimes.length > 90) fpsTimes.shift(); }
    }
    fpsPrevAt = now;
    if (fpsEl) {
      fpsFrames++;
      if (!fpsT0) fpsT0 = now;
      if (now - fpsT0 > 500) {
        var avg = fpsFrames * 1000 / (now - fpsT0);
        if (fpsValEl) fpsValEl.textContent = String(Math.round(avg));
        if (fpsMsEl) fpsMsEl.textContent = (1000 / Math.max(1, avg)).toFixed(1) + ' ms';
        else fpsEl.textContent = Math.round(avg) + ' FPS';
        var target = limit > 0 ? limit : 60;
        fpsEl.classList.toggle('is-low', avg < target * 0.9);
        G.drawFpsGraph();
        fpsFrames = 0; fpsT0 = now;
      }
      fpsEl.style.display = (OSU.settings && OSU.settings.on('showFps')) ? 'block' : 'none';
    }

    /* ---- 回放：判定由录制事件驱动，输入不接管 ---- */
    if (S.replay) {
      OSU.replay.tick(S.songTime);
      S.displayHealth += (S.health - S.displayHealth) * Math.min(1, dt * 10);
      G.render();
      G.updateHud();
      if (S.songTime > S.songEnd) {
        OSU.replay.endCleanup();
        G.quit();
      }
      return;
    }

    if (S.demo) OSU.audio.demoSynth(S.songTime, S.speed);
    if (S.mods.AT && !S.paused) impl.autoPlay(S.songTime);
    if (impl.tick) impl.tick(dt);
    if (!S.mods.AT) impl.update(S.songTime);
    else if (impl.update) impl.update(S.songTime);
    OSU.updateFx(dt);

    if (S.health <= 0 && !S.mods.NF) S.failed = true;   /* 血条见底就是失败，不是"还能继续" */
    if (S.failed && !S.mods.NF) { G.finish(true); return; }
    S.displayHealth += (S.health - S.displayHealth) * Math.min(1, dt * 10);

    G.render();
    G.updateHud();

    if (S.songTime > S.songEnd) G.finish(false);
  };

  /* FPS 波形：最近 90 帧的帧时间（越低越好），带 16.7ms 基准线 */
  G.drawFpsGraph = function () {
    if (!fpsGraph || !fpsGctx) return;
    var w = fpsGraph.width, h = fpsGraph.height;
    var c = fpsGctx;
    c.clearRect(0, 0, w, h);
    var pal = OSU.pal();
    c.fillStyle = U.rgba(pal.text, .06);
    c.fillRect(0, 0, w, h);
    /* 16.7ms / 33.3ms 参考线 */
    var maxMs = 40;
    [16.7, 33.3].forEach(function (ms) {
      var y = h - (ms / maxMs) * h;
      c.fillStyle = U.rgba(pal.text, ms === 16.7 ? .35 : .16);
      c.fillRect(0, Math.round(y) + .5, w, 1);
    });
    if (!fpsTimes.length) return;
    var step = w / Math.max(1, fpsTimes.length - 1);
    c.beginPath();
    for (var i = 0; i < fpsTimes.length; i++) {
      var v = Math.min(maxMs, fpsTimes[i]);
      var x = i * step, y = h - (v / maxMs) * h;
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.strokeStyle = pal.secondary;
    c.lineWidth = 1.4;
    c.stroke();
  };

  G.render = function () {
    var impl = OSU.modes[S.mode];
    var l = G.view;
    var pal = OSU.pal();
    /* 背景（渐变 + 网格）只在尺寸/主题变化时重画一次，每帧只 drawImage */
    var blurOn = OSU.settings ? OSU.settings.on('bgBlur') : 0;
    var light = pal.light;
    var key = Math.round(l.w) + 'x' + Math.round(l.h) + '|' + pal.primary + '|' + (blurOn ? 'b' : '-') + (light ? '|L' : '|D');
    if (bgKey !== key || !bgCanvas) {
      bgKey = key;
      var pm = (window.devicePixelRatio || 1) > 1 ? Math.min(2, window.devicePixelRatio) : 1;
      bgCanvas = document.createElement('canvas');
      bgCanvas.width = Math.round(l.w * pm);
      bgCanvas.height = Math.round(l.h * pm);
      var b = bgCanvas.getContext('2d');
      b.setTransform(pm, 0, 0, pm, 0, 0);
      if (blurOn && 'filter' in b) b.filter = 'blur(9px)';
      var bg = b.createLinearGradient(0, 0, 0, l.h);
      if (light) {
        /* 浅色主题：游玩底色跟着页面走（纸色/白），音符用深描边，不再一块黑 */
        bg.addColorStop(0, U.rgba(pal.primary, .03));
        bg.addColorStop(.55, U.rgba(pal.bg, .99));
        bg.addColorStop(1, U.rgba(pal.bg, 1));
      } else {
        bg.addColorStop(0, U.rgba(pal.primary, .10));
        bg.addColorStop(1, 'rgba(0,0,0,.55)');
      }
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

    /* 背景暗度（lazer 的 background dim） */
    var dim = OSU.settings ? OSU.settings.num('bgDim', 50) / 100 : 0.5;
    if (dim > 0.01) {
      ctx.fillStyle = light
        ? 'rgba(255,255,255,' + Math.min(1, dim * 0.35) + ')'
        : 'rgba(0,0,0,' + Math.min(1, dim) + ')';
      ctx.fillRect(0, 0, l.w, l.h);
    }

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

    /* 打击误差条（lazer 的 hit error meter） */
    if (OSU.settings && OSU.settings.on('hitError')) G.drawHitError(ctx, l, pal);

    /* 判定弹窗 */
    var pw = performance.now();
    for (var i = 0; i < 6; i++) { }
    ctx.textAlign = 'center';
    ctx.font = '700 20px "Share Tech Mono", monospace';
    /* 由 core 的 popups 队列绘制（最近 3 条） */
    if (OSU.fxPopups && (!OSU.settings || OSU.settings.on('judgeText'))) {
      var list = OSU.fxPopups();
      var it = list[list.length - 1];
      if (it) {
        var age = (pw - it.t) / 620;
        ctx.globalAlpha = Math.max(0, 1 - age);
        ctx.fillStyle = it.color;
        if (pal.light) {
          /* 浅色主题：判定字加一层深色描边才看得清（粉色字压米白几乎看不见） */
          ctx.shadowBlur = 0;
          ctx.lineWidth = 3.4;
          ctx.strokeStyle = 'rgba(24,14,6,.8)';
        } else {
          ctx.shadowColor = it.color; ctx.shadowBlur = 16;
          ctx.lineWidth = 0;
        }
        /* 判定文字跟随击打点（osu 的判定贴在音符附近），无坐标时才落回底部中央 */
        var px = (it.x != null && isFinite(it.x) && it.x > 0) ? it.x : l.w / 2;
        var py = (it.y != null && isFinite(it.y) && it.y > 0) ? it.y - 46 : l.h * 0.70;
        if (pal.light) ctx.strokeText(it.name, px, py - age * 22);
        ctx.fillText(it.name, px, py - age * 22);
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'left';
  };

  /* 底部中央的打击误差条：左早右晚，±200ms 满量程 */
  G.drawHitError = function (ctx, l, pal) {
    var errs = S.hitErrors || [];
    if (!errs.length) return;
    var w = Math.min(400, l.w * 0.56), h = 18;
    var cx = l.w / 2, y = l.h - h - 10, max = 200;
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = U.rgba(pal.text, .05);
    ctx.fillRect(cx - w / 2, y, w, h);
    /* ±100 / ±200 刻度 */
    ctx.fillStyle = U.rgba(pal.text, .18);
    [0.5, 1].forEach(function (f) {
      ctx.fillRect(cx - w / 2 * f, y, 1, h);
      ctx.fillRect(cx + w / 2 * f, y, 1, h);
    });
    /* 中线 */
    ctx.fillStyle = U.rgba(pal.text, .4);
    ctx.fillRect(cx - 0.5, y - 3, 1, h + 6);
    /* 最近 10 次判定点，越新越亮 */
    var n = Math.min(errs.length, 10);
    for (var i = 0; i < n; i++) {
      var v = errs[errs.length - n + i];
      var px = cx + U.clamp(v / max, -1, 1) * (w / 2 - 5);
      var fresh = (i + 1) / n;
      ctx.globalAlpha = 0.25 + 0.75 * fresh;
      ctx.fillStyle = Math.abs(v) < 40 ? '#6ee7a7' : (Math.abs(v) < 100 ? '#ffd166' : '#ff6b81');
      ctx.beginPath();
      ctx.arc(px, y + h / 2, 3.1, 0, 6.283);
      ctx.fill();
    }
    /* 平均偏差指示 */
    var sum = 0;
    for (var k = 0; k < n; k++) sum += errs[errs.length - n + k];
    var avg = sum / n;
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = U.rgba(pal.secondary, .9);
    ctx.fillRect(cx + U.clamp(avg / max, -1, 1) * (w / 2 - 5) - 1, y - 4, 2, h + 8);
    ctx.globalAlpha = 1;
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

  var resumeTimer = 0;

  G.pause = function (force) {
    if (!S.running) return;
    if (S.paused && !force) return G.resume();
    if (resumeTimer) { clearInterval(resumeTimer); resumeTimer = 0; }
    S.countdown = 0;
    OSU.ui.showCountdown(0);
    S.paused = true;
    OSU.audio.suspend();
    OSU.ui.showPause(true);
  };

  /* 和 osu! 一样：继续前先 3-2-1 再进入，别一按就砸下来 */
  G.resume = function () {
    if (!S.running || resumeTimer) return;
    OSU.ui.showPause(false);
    var n = 3;
    S.countdown = n;
    OSU.ui.showCountdown(n);
    resumeTimer = setInterval(function () {
      n--;
      S.countdown = n;
      OSU.ui.showCountdown(n);
      if (n > 0) return;
      clearInterval(resumeTimer);
      resumeTimer = 0;
      S.countdown = 0;
      S.paused = false;
      OSU.audio.resume();
      S.lastFrame = performance.now();
      /* 音频/墙钟在暂停期间都没走，切回音频时钟时由 clockSkew 自动吸收偏差 */
      requestAnimationFrame(G.loop);
    }, 1000);
  };

  G.quit = function () {
    if (resumeTimer) { clearInterval(resumeTimer); resumeTimer = 0; }
    S.countdown = 0;
    OSU.ui.showCountdown(0);
    S.running = false;
    S.paused = false;
    S.loopId++;
    OSU.audio.stopBuffer();
    OSU.ui.showPause(false);
    OSU.ui.showView('menu');
  };

  G.finish = function (isFailed) {
    if (!S.running) return;
    if (resumeTimer) { clearInterval(resumeTimer); resumeTimer = 0; }
    S.running = false;
    S.loopId++;
    OSU.audio.stopBuffer();
    OSU.audio.suspend();
    if (OSU.replay && OSU.replay.active()) {
      OSU.replay.save(S.chart, { score: S.score, acc: OSU.acc(), maxCombo: S.maxCombo, failed: isFailed });
    }
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
