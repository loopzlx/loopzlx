/* osu-boot.js —— 输入、指针、初始化，对外暴露 window.OsuApp */
var OSU = window.Osu = window.Osu || {};

(function () {
  'use strict';
  var S = OSU.S;
  var U = OSU.util;

  /* ---------------- 统一输入 ---------------- */
  var I = OSU.input = {};

  function canPlay() { return S.running && !S.paused; }

  /* Auto（AT）mod：判定由 autoPlay 全自动驱动，此时彻底忽略真人按键 / 触屏 / 指针，
     否则误触会在已有 PERFECT 的谱面上打出 GOOD/MEH/MISS，把 100% 拉下来。 */
  function isAuto() { return !!S.mods.AT; }

  function tAt(perfTs) {
    return (OSU.game && OSU.game.timeAtPerf) ? OSU.game.timeAtPerf(perfTs) : S.songTime;
  }

  I.press = function (lane, fromPad, perfTs) {
    if (!canPlay() || isAuto()) return;
    var impl = OSU.modes[S.mode];
    if (!impl) return;
    S.held[lane] = true;
    /* 用事件真实时间戳换算歌曲时间，不再用上一帧的缓存值 */
    impl.press(lane, tAt(perfTs));
  };

  I.release = function (lane, perfTs) {
    S.held[lane] = false;
    if (!S.running || isAuto()) return;
    var impl = OSU.modes[S.mode];
    if (impl && impl.release) impl.release(lane, tAt(perfTs));
  };

  I.pointer = function (x, y) {
    /* Auto 下光标 / 接盘位置由 autoPlay 接管，真人指针不再覆盖，避免接住位置偏移 */
    if (isAuto()) return;
    S.cursor.x = x; S.cursor.y = y;
    if (S.mode === 'catch') {
      var l = OSU.game.view;
      S.plateX = l ? U.clamp(x / l.w, 0.02, 0.98) : 0.5;
    }
  };

  I.tap = function () {
    if (!canPlay() || isAuto()) return;
    var impl = OSU.modes[S.mode];
    if (impl && impl.press) impl.press(0, S.songTime);
  };

  /* ---------------- 键位映射 ---------------- */
  var KB = {
    mania: null,        // 用 S.keys（可自定义）
    taiko: ['KeyZ', 'KeyF', 'ArrowLeft', 'Space', 'KeyX', 'KeyJ', 'ArrowRight', 'KeyD'],
    catch: ['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'],
    std: ['KeyZ', 'KeyX', 'Space', 'KeyF', 'KeyJ']
  };

  function userKeys() {
    return (OSU.settings && OSU.settings.keys) ? OSU.settings.keys() : null;
  }

  function laneOf(code) {
    if (S.view !== 'play') return -1;
    if (S.mode === 'mania') {
      for (var i = 0; i < S.keys.length; i++) if (S.keys[i] === code) return i;
      return -1;
    }
    if (S.mode === 'catch') {
      if (code === 'ArrowLeft' || code === 'KeyA') return 0;
      if (code === 'ArrowRight' || code === 'KeyD') return 1;
      return -1;
    }
    var uk = userKeys();
    if (S.mode === 'std') {
      if (KB.std.indexOf(code) >= 0) return 0;
      if (uk && uk.std && uk.std.indexOf(code) >= 0) return 0;
      return -1;
    }
    if (S.mode === 'taiko') {
      /* lane 0 = don，lane 1 = kat；自定义键位优先，默认键位同时可用 */
      if (uk && uk.taiko) {
        if (uk.taiko[0] === code) return 0;
        if (uk.taiko[1] === code) return 1;
      }
      if (code === 'KeyZ' || code === 'KeyF' || code === 'ArrowLeft' || code === 'Space') return 0;
      if (code === 'KeyX' || code === 'KeyJ' || code === 'ArrowRight' || code === 'KeyD') return 1;
      return -1;
    }
    return -1;
  }

  function bindKeys() {
    window.addEventListener('keydown', function (e) {
      if (!OSU.isOpen || !OSU.isOpen()) return;
      /* 设置页抓键 */
      if (S.view === 'settings') {
        if (OSU.ui.onKeyCapture && OSU.ui.onKeyCapture(e)) { e.preventDefault(); }
        if (e.code === 'Escape') { OSU.ui.showView('menu'); }
        return;
      }
      if (e.code === 'Escape') {
        if (S.view === 'play') { e.preventDefault(); OSU.game.pause(); return; }
        if (S.view === 'settings') { OSU.ui.showView('menu'); return; }
        if (S.view === 'download') { OSU.ui.showView('menu'); return; }
        return;
      }
      if (e.code === 'Space' && S.view === 'calib') { OSU.ui.calibTap(); return; }
      var lane = laneOf(e.code);
      if (lane < 0) return;
      e.preventDefault();
      if (e.repeat) return;
      I.press(lane, false, e.timeStamp);
    });

    window.addEventListener('keyup', function (e) {
      if (!OSU.isOpen || !OSU.isOpen()) return;
      var lane = laneOf(e.code);
      if (lane < 0) return;
      e.preventDefault();
      I.release(lane, e.timeStamp);
    });

    window.addEventListener('blur', function () {
      for (var i = 0; i < 9; i++) { if (S.held[i]) I.release(i); }
    });
  }

  function bindCanvas() {
    var cv = document.getElementById('osu-cv');
    if (!cv) return;

    function pos(e) { return OSU.game.toCanvas(e); }

    cv.addEventListener('pointermove', function (e) {
      var p = pos(e);
      I.pointer(p.x, p.y);
    });
    cv.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      var p = pos(e);
      I.pointer(p.x, p.y);
      if (S.mode === 'std') I.tap();
      else if (S.mode === 'catch') { /* 盘子跟随光标，无需点击 */ }
      else I.press(0, false);
    });
    cv.addEventListener('pointerup', function () { I.release(0); });
    cv.addEventListener('pointerleave', function () { I.release(0); });
  }

  /* ---------------- 初始化 ---------------- */
  OSU.isOpen = function () { return !!(window.OsuWarp && window.OsuWarp.isOpen()); };

  OSU.boot = function () {
    OSU.game.attach();
    OSU.ui.init();
    if (OSU.applySkin) OSU.applySkin();
    bindKeys();
    bindCanvas();
    if (OSU.i18n) OSU.i18n.load();
    var langSw = document.getElementById('osu-lang-switch');
    if (langSw) langSw.addEventListener('click', function (e) {
      var b = e.target.closest('[data-olang]');
      if (b && OSU.i18n) OSU.i18n.set(b.getAttribute('data-olang'));
    });
    OSU.log('BOOT // powered by anonymous LZ kernel');
    OSU.log('ENGINE // modes: std / taiko / catch / mania');
  };

  /* loader 通过这些接口控制打开 / 关闭 / 重开 */
  window.OsuApp = {
    boot: OSU.boot,
    onOpen: function () {
      S.view = 'menu';
      if (OSU.i18n && OSU.i18n.apply) OSU.i18n.apply();
      if (OSU.settings && OSU.settings.apply) OSU.settings.apply();
      OSU.game.resize();
      setTimeout(function () { OSU.game.resize(); OSU.ui.renderMenu(); }, 60);
      OSU.audio.init();
    },
    onClose: function () {
      if (S.running) OSU.game.quit();
      OSU.audio.stopBuffer();
      OSU.audio.suspend();
    },
    startDemo: function (mode) { OSU.game.start(OSU.bm.demoChart(mode || 'mania'), mode || 'mania'); }
  };

})();
