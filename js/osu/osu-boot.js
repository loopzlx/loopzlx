/* osu-boot.js —— 输入、指针、初始化，对外暴露 window.OsuApp */
var OSU = window.Osu = window.Osu || {};

(function () {
  'use strict';
  var S = OSU.S;
  var U = OSU.util;

  /* ---------------- 统一输入 ---------------- */
  var I = OSU.input = {};

  function canPlay() { return S.running && !S.paused; }

  I.press = function (lane, fromPad) {
    if (!canPlay()) return;
    var impl = OSU.modes[S.mode];
    if (!impl) return;
    S.held[lane] = true;
    impl.press(lane, S.songTime);
  };

  I.release = function (lane) {
    S.held[lane] = false;
    if (!S.running) return;
    var impl = OSU.modes[S.mode];
    if (impl && impl.release) impl.release(lane, S.songTime);
  };

  I.pointer = function (x, y) {
    S.cursor.x = x; S.cursor.y = y;
    if (S.mode === 'catch') {
      var l = OSU.game.view;
      S.plateX = l ? U.clamp(x / l.w, 0.02, 0.98) : 0.5;
    }
  };

  I.tap = function () {
    if (!canPlay()) return;
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
    if (S.mode === 'std') return KB.std.indexOf(code) >= 0 ? 0 : -1;
    if (S.mode === 'taiko') {
      /* lane 0 = don（Z/F/←/空格），lane 1 = kat（X/J/→） */
      if (KB.taiko[0] === code || code === 'KeyZ' || code === 'KeyF' || code === 'ArrowLeft' || code === 'Space') return 0;
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
      I.press(lane, false);
    });

    window.addEventListener('keyup', function (e) {
      if (!OSU.isOpen || !OSU.isOpen()) return;
      var lane = laneOf(e.code);
      if (lane < 0) return;
      e.preventDefault();
      I.release(lane);
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
    bindKeys();
    bindCanvas();
    OSU.log('BOOT // powered by anonymous LZ kernel');
    OSU.log('ENGINE // modes: std / taiko / catch / mania');
  };

  /* loader 通过这些接口控制打开 / 关闭 / 重开 */
  window.OsuApp = {
    boot: OSU.boot,
    onOpen: function () {
      S.view = 'menu';
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
