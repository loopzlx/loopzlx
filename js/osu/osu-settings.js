/* osu-settings.js —— osu!lazer 风格设置面板（分类 + 滑杆 + 开关 + 键位 + 维护） */
var OSUS = window.Osu = window.Osu || {};

(function () {
  'use strict';

  var KEY = 'osu_settings';
  var DEF = {
    master: 75,      // 主音量 %
    music: 80,       // 音乐 %
    sfx: 85,         // 音效 %
    bgDim: 50,       // 背景暗度 %
    bgBlur: 0,       // 背景模糊
    scroll: 100,     // 滚动速度 %（100 = 默认）
    showFps: 0,      // 显示帧率
    hitError: 1,     // 打击误差条
    comboNum: 1,     // 连击数字跟随光标
    hitLight: 1,     // 命中光效
    judgeText: 1,    // 判定文字
    maniaKeys: 4,    // mania 键数 1–10K
    fpsLimit: 0,     // 帧率上限：0 = 不限制
    hitOffset: 0     // 校准得到的平均偏移（ms），判定前补偿
  };

  var cur = {};
  var mounted = false;
  var activeTab = 'general';

  var SET = OSUS.settings = {};
  SET.DEF = DEF;

  function load() {
    var raw = null;
    try { raw = JSON.parse(window.localStorage.getItem(KEY) || 'null'); } catch (e) {}
    cur = {};
    Object.keys(DEF).forEach(function (k) {
      cur[k] = (raw && typeof raw[k] === 'number') ? raw[k] : DEF[k];
    });
  }
  load();

  SET.get = function (k) {
    if (k in cur) return cur[k];
    return DEF[k];
  };
  SET.all = function () { return cur; };
  SET.num = function (k, d) { var v = SET.get(k); return typeof v === 'number' ? v : d; };
  SET.on = function (k) { return !!SET.get(k); };

  function persist() {
    try { window.localStorage.setItem(KEY, JSON.stringify(cur)); } catch (e) {}
  }

  SET.set = function (k, v) {
    cur[k] = v;
    persist();
    SET.apply();
  };

  SET.reset = function () {
    cur = {};
    Object.keys(DEF).forEach(function (k) { cur[k] = DEF[k]; });
    persist();
    SET.apply();
    SET.refresh();
    if (OSUS.log) OSUS.log('SETTINGS // restored defaults');
  };

  /* 把设置推给音频与渲染层 */
  SET.apply = function () {
    if (OSUS.audio && OSUS.audio.applyMix) {
      OSUS.audio.applyMix({ master: cur.master, music: cur.music, sfx: cur.sfx });
    }
  };

  /* ---------------- 键位 ---------------- */
  var KBKEY = 'osu_keybinds';
  var MANIA_DEF = {
    1: ['Space'],
    2: ['KeyF', 'KeyJ'],
    3: ['KeyD', 'KeyF', 'KeyJ'],
    4: ['KeyD', 'KeyF', 'KeyJ', 'KeyK'],
    5: ['KeyD', 'KeyF', 'Space', 'KeyJ', 'KeyK'],
    6: ['KeyS', 'KeyD', 'KeyF', 'KeyJ', 'KeyK', 'KeyL'],
    7: ['KeyS', 'KeyD', 'KeyF', 'Space', 'KeyJ', 'KeyK', 'KeyL'],
    8: ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon'],
    9: ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'Space', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon'],
    10: ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon']
  };
  var KB_DEF = { taiko: ['KeyZ', 'KeyX'], std: ['KeyZ', 'KeyX'] };

  function kbLoad() {
    var kb = null;
    try { kb = JSON.parse(window.localStorage.getItem(KBKEY) || 'null'); } catch (e) {}
    kb = kb || {};
    for (var n = 1; n <= 10; n++) {
      if (!kb[n] || kb[n].length !== n) kb[n] = MANIA_DEF[n].slice();
    }
    if (!kb.taiko || kb.taiko.length !== 2) kb.taiko = KB_DEF.taiko.slice();
    if (!kb.std || kb.std.length !== 2) kb.std = KB_DEF.std.slice();
    return kb;
  }
  function kbSave(kb) {
    try { window.localStorage.setItem(KBKEY, JSON.stringify(kb)); } catch (e) {}
  }
  SET.keys = function () { return kbLoad(); };
  SET.keyDef = KB_DEF;
  SET.maniaDef = MANIA_DEF;
  SET.maniaK = function () {
    var n = Math.round(SET.num('maniaKeys', 4));
    return n < 1 ? 1 : (n > 10 ? 10 : n);
  };

  function keyLabel(code) {
    if (!code) return '?';
    var map = { Space: 'SPACE', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Semicolon: ';', Quote: "'", Comma: ',', Period: '.' };
    if (map[code]) return map[code];
    return code.replace('Key', '').replace('Digit', '').replace('Numpad', 'NUM');
  }

  /* ---------------- UI ---------------- */
  var TABS = [
    { k: 'general', n: 'GENERAL', cn: '通用' },
    { k: 'audio', n: 'AUDIO', cn: '音频' },
    { k: 'graphics', n: 'GRAPHICS', cn: '画面' },
    { k: 'gameplay', n: 'GAMEPLAY', cn: '游玩' },
    { k: 'input', n: 'INPUT', cn: '输入' },
    { k: 'maintenance', n: 'MAINTENANCE', cn: '维护' }
  ];

  function el(tag, cls, text) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (text != null) d.textContent = text;
    return d;
  }

  function rowBox(title, desc) {
    var row = el('div', 'osu-set-row');
    var left = el('div', 'osu-set-info');
    left.appendChild(el('div', 'osu-set-name', title));
    if (desc) left.appendChild(el('div', 'osu-set-desc', desc));
    row.appendChild(left);
    return row;
  }

  function rr(lo, hi, v) {
    var r = el('div', 'osu-range');
    var input = el('input', 'osu-range-input');
    input.type = 'range';
    input.min = String(lo); input.max = String(hi); input.value = String(v);
    var val = el('span', 'osu-range-val', v + '%');
    r.appendChild(input); r.appendChild(val);
    return { box: r, input: input, val: val };
  }

  function addSlider(page, key, title, desc, lo, hi, fmt) {
    var row = rowBox(title, desc);
    var r = rr(lo, hi, cur[key]);
    r.val.textContent = fmt ? fmt(cur[key]) : cur[key] + '%';
    r.input.addEventListener('input', function () {
      var v = Number(r.input.value);
      r.val.textContent = fmt ? fmt(v) : v + '%';
      SET.set(key, v);
    });
    row.appendChild(r.box);
    page.appendChild(row);
  }

  function addToggle(page, key, title, desc) {
    var row = rowBox(title, desc);
    var sw = el('button', 'osu-switch');
    sw.type = 'button';
    function paint() {
      var on = SET.on(key);
      sw.classList.toggle('is-on', on);
      sw.setAttribute('aria-pressed', on ? 'true' : 'false');
      sw.innerHTML = '<i></i>';
    }
    paint();
    sw.addEventListener('click', function () {
      SET.set(key, SET.on(key) ? 0 : 1);
      paint();
    });
    row.appendChild(sw);
    page.appendChild(row);
  }

  var FPS_LIMITS = [
    { v: 0, label: '不限制', en: 'Unlimited' },
    { v: 240, label: '240', en: '240 FPS' },
    { v: 144, label: '144', en: '144 FPS' },
    { v: 120, label: '120', en: '120 FPS' },
    { v: 60, label: '60', en: '60 FPS' },
    { v: 30, label: '30', en: '30 FPS' }
  ];

  function addFpsLimit(page) {
    var row = rowBox('帧率上限', '和 osu!lazer 的 Frame limiter 一样：限制渲染帧率可以省电 / 稳定帧时间');
    var box = el('div', 'osu-chips');
    FPS_LIMITS.forEach(function (o) {
      var labTxt = (OSUS.i18n && OSUS.i18n.lang() === 'en') ? o.en : o.label;
      var b = el('button', 'osu-chip' + (SET.num('fpsLimit', 0) === o.v ? ' is-on' : ''), labTxt);
      b.type = 'button';
      b.setAttribute('title', o.en);
      b.addEventListener('click', function () {
        SET.set('fpsLimit', o.v);
        Array.prototype.forEach.call(box.children, function (c) { c.classList.remove('is-on'); });
        b.classList.add('is-on');
        if (OSUS.log) OSUS.log('FRAME LIMIT // ' + (o.v ? o.v + ' fps' : 'unlimited'));
      });
      box.appendChild(b);
    });
    row.appendChild(box);
    page.appendChild(row);
  }

  function addAction(page, title, desc, label, fn) {
    var row = rowBox(title, desc);
    var b = el('button', 'osu-btn', label);
    b.type = 'button';
    b.addEventListener('click', fn);
    row.appendChild(b);
    page.appendChild(row);
  }

  function addProfile(page) {
    var row = rowBox('本地档案', '每套档案独立保存 PB 与本地榜；切档等于换一整套成绩，互不污染');
    var box = el('div', 'osu-chips');
    var list = (OSUS.ui && OSUS.ui.profiles) ? OSUS.ui.profiles() : ['main'];
    var cur = (OSUS.ui && OSUS.ui.profile) ? OSUS.ui.profile() : 'main';
    list.forEach(function (name) {
      var b = el('button', 'osu-chip' + (cur === name ? ' is-on' : ''), name.toUpperCase());
      b.type = 'button';
      b.addEventListener('click', function () {
        if (OSUS.ui && OSUS.ui.setProfile) OSUS.ui.setProfile(name);
        render();
        if (OSUS.log) OSUS.log('PROFILE // ' + name.toUpperCase());
      });
      box.appendChild(b);
    });
    var nb = el('button', 'osu-chip osu-chip-add', '+ NEW');
    nb.type = 'button';
    nb.addEventListener('click', function () {
      var name = window.prompt('新档案名（字母/数字/下划线，≤12 字符）', 'alt');
      if (!name) return;
      if (OSUS.ui && OSUS.ui.setProfile) OSUS.ui.setProfile(name);
      render();
      if (OSUS.log) OSUS.log('PROFILE // ' + name.toUpperCase() + ' created');
    });
    box.appendChild(nb);
    row.appendChild(box);
    page.appendChild(row);
  }

  function addSkin(page) {
    var row = rowBox('皮肤配色', '覆盖强调色与判定色，不跟随站点主题；AUTO 表示跟随当前主题');
    var box = el('div', 'osu-chips osu-skin-chips');
    var SK = OSUS.SKINS || {};
    var curId = OSUS.skinId ? OSUS.skinId() : 'auto';
    Object.keys(SK).forEach(function (id) {
      var sk = SK[id];
      var b = el('button', 'osu-chip osu-skin-chip' + (curId === id ? ' is-on' : ''));
      b.type = 'button';
      var dots = sk.accent
        ? '<i style="background:' + sk.accent[0] + '"></i><i style="background:' + sk.accent[1] + '"></i>'
        : '<i class="auto-a"></i><i class="auto-b"></i>';
      b.innerHTML = dots + '<span>' + sk.name + '</span>';
      b.setAttribute('title', sk.cn || sk.name);
      b.addEventListener('click', function () {
        if (OSUS.setSkin) OSUS.setSkin(id);
        render();
      });
      box.appendChild(b);
    });
    row.appendChild(box);
    page.appendChild(row);
  }

  function addKeys(page) {
    var kb = kbLoad();
    var K = SET.maniaK();

    /* 键数选择：1K – 10K */
    var krow = rowBox('osu!mania 键数', '1K – 10K，切换后立即生效（导入谱面时以谱面 CircleSize 为准）');
    var kchips = el('div', 'osu-chips');
    for (var n = 1; n <= 10; n++) {
      (function (num) {
        var b = el('button', 'osu-chip' + (num === K ? ' is-on' : ''), num + 'K');
        b.type = 'button';
        b.addEventListener('click', function () {
          SET.set('maniaKeys', num);
          if (OSUS.modes && OSUS.modes.mania) OSUS.modes.mania.setCols(num, kbLoad());
          SET.refresh();
        });
        kchips.appendChild(b);
      })(n);
    }
    krow.appendChild(kchips);
    page.appendChild(krow);

    var groups = [
      { k: 'mania', n: K, name: 'osu!mania ' + K + 'K', keys: kb[K], hint: '点击按钮再按键即可重绑' },
      { k: 'taiko', name: 'osu!taiko', keys: kb.taiko, hint: 'DON / KAT' },
      { k: 'std', name: 'osu!std', keys: kb.std, hint: '左右键（也可用鼠标）' }
    ];

    groups.forEach(function (g) {
      var row = rowBox(g.name, g.hint);
      var box = el('div', 'osu-keybinds');
      g.keys.forEach(function (code, i) {
        var b = el('button', 'osu-key', keyLabel(code));
        b.type = 'button';
        b.addEventListener('click', function () {
          capture = { group: g.k, lane: i, btn: b, n: g.n };
          b.textContent = '…';
          b.classList.add('is-capturing');
        });
        box.appendChild(b);
      });
      row.appendChild(box);
      page.appendChild(row);
    });

    var resetRow = rowBox('重置键位', '恢复为 mania D F J K / taiko Z X');
    var rb = el('button', 'osu-btn', 'RESET KEYS');
    rb.type = 'button';
    rb.addEventListener('click', function () {
      var d = {};
      for (var q = 1; q <= 10; q++) d[q] = MANIA_DEF[q].slice();
      d.taiko = KB_DEF.taiko.slice();
      d.std = KB_DEF.std.slice();
      kbSave(d);
      SET.refresh();
      if (OSUS.ui && OSUS.ui.toast) OSUS.ui.toast('键位已重置');
      if (OSUS.modes && OSUS.modes.mania) OSUS.modes.mania.setCols(SET.maniaK(), kbLoad());
    });
    resetRow.appendChild(rb);
    page.appendChild(resetRow);
  }

  var capture = null;

  document.addEventListener('keydown', function (e) {
    if (!capture) return;
    e.preventDefault();
    e.stopPropagation();
    var kb = kbLoad();
    if (capture.group === 'mania') kb[capture.n][capture.lane] = e.code;
    else kb[capture.group][capture.lane] = e.code;
    kbSave(kb);
    capture.btn.textContent = keyLabel(e.code);
    capture.btn.classList.remove('is-capturing');
    if (capture.group === 'mania' && OSUS.modes && OSUS.modes.mania) OSUS.modes.mania.setCols(capture.n, kb);
    if (OSUS.log) OSUS.log('KEYBIND // ' + capture.group + '[' + capture.lane + '] → ' + e.code);
    capture = null;
  }, true);

  function buildPage(tab) {
    var page = el('div', 'osu-set-page');
    page.setAttribute('data-page', tab);

    if (tab === 'general') {
      addProfile(page);
      addToggle(page, 'judgeText', '显示判定文字', 'PERFECT / GREAT / MISS 等弹字');
      addToggle(page, 'showFps', '显示帧率', '游玩界面右下角显示实时 FPS');
      addToggle(page, 'hitLight', '命中光效', '打击时的粒子与扩散环');
      var tip = el('p', 'osu-set-tip', 'osu!lazer 的皮肤、音频设备、语言等系统级选项在此为浏览器实现版：字体与配色跟随站点主题，音频设备由浏览器接管。');
      page.appendChild(tip);
    }

    if (tab === 'audio') {
      addSlider(page, 'master', '主音量', '总输出增益', 0, 100);
      addSlider(page, 'music', '音乐音量', '谱面 / 演示曲音量', 0, 100);
      addSlider(page, 'sfx', '音效音量', '打击音、滑块 tick、判定音', 0, 100);
      addAction(page, '延迟校准', '敲击节拍，测出输入与音频的偏移', '开始校准', function () {
        if (OSUS.ui && OSUS.ui.startCalib) OSUS.ui.startCalib();
      });
    }

    if (tab === 'graphics') {
      addSlider(page, 'bgDim', '背景暗度', '0% 原图 · 100% 全黑', 0, 100);
      addToggle(page, 'bgBlur', '背景模糊', '模糊游玩背景，让音符更清楚');
      addSlider(page, 'scroll', '滚动速度', '影响 std 打圈收缩与 mania 下落速度', 80, 160);
      var note = el('p', 'osu-set-tip', '滚动速度 100% 对应 osu! 标准 AR 表现；调高会让前奏更短、判断更紧。');
      page.appendChild(note);
      addFpsLimit(page);
      addSkin(page);
    }

    if (tab === 'gameplay') {
      addToggle(page, 'hitError', '打击误差条', '游玩时显示最近判定的偏差（左早右晚）');
      addToggle(page, 'comboNum', '连击数字跟随光标', 'std / catch 的 combo 显示在指针旁');
      addToggle(page, 'showFps', '显示帧率', '游玩界面右下角显示实时 FPS');
    }

    if (tab === 'input') addKeys(page);

    if (tab === 'maintenance') {
      addAction(page, '恢复默认设置', '音效、画面、游玩选项全部回到默认', 'RESTORE', function () { SET.reset(); });
      addAction(page, '清空自定义键位', '只重置按键，不影响其他选项', 'RESET KEYS', function () {
        var d = {};
        for (var q = 1; q <= 10; q++) d[q] = MANIA_DEF[q].slice();
        d.taiko = KB_DEF.taiko.slice();
        d.std = KB_DEF.std.slice();
        kbSave(d);
        SET.refresh();
        if (OSUS.modes && OSUS.modes.mania) OSUS.modes.mania.setCols(SET.maniaK(), kbLoad());
        if (OSUS.ui && OSUS.ui.toast) OSUS.ui.toast('键位已重置');
      });
      addAction(page, '退出 osu!', '卸载覆盖层回到主页（等同顶栏 HOME）', 'EXIT', function () {
        if (window.OsuWarp) window.OsuWarp.close();
      });

      /* 清除缓存歌曲：二次确认，说清后果再动手 */
      var warnRow = rowBox('清除缓存歌曲', '删除全部已导入的谱面（含音频与背景），此操作不可恢复；内置演示谱不受影响', '');
      var clsBtn = el('button', 'osu-btn danger', 'CLEAR LIBRARY');
      clsBtn.type = 'button';
      var armT = 0;
      clsBtn.addEventListener('click', function () {
        if (!clsBtn.classList.contains('is-armed')) {
          clsBtn.classList.add('is-armed');
          clsBtn.textContent = '确认清除？点第二次执行';
          warnRow.querySelector('.osu-set-desc').textContent = '警告：将清除所有导入歌曲与音频缓存，且无法恢复（演示谱保留）';
          clearTimeout(armT);
          armT = setTimeout(function () {
            clsBtn.classList.remove('is-armed');
            clsBtn.textContent = 'CLEAR LIBRARY';
          }, 4000);
          return;
        }
        clearTimeout(armT);
        clsBtn.classList.remove('is-armed');
        clsBtn.textContent = 'CLEAR LIBRARY';
        if (OSUS.ui && OSUS.ui.clearLibrary) OSUS.ui.clearLibrary();
        warnRow.querySelector('.osu-set-desc').textContent = '已清除全部导入歌曲';
      });
      warnRow.appendChild(clsBtn);
      page.appendChild(warnRow);

      var p = el('p', 'osu-set-tip', '设置与键位保存在 localStorage（osu_settings / osu_keybinds）；导入的谱面和音频已存进浏览器 IndexedDB，刷新、重开站点都还在，可在选曲页逐张删除，或在这里一键清空。');
      page.appendChild(p);
    }

    return page;
  }

  /* 设置面板的英文文案（按中文原文查表替换，避免给每项都加字段） */
  var EN = {
    '显示判定文字': 'Judgement text', 'PERFECT / GREAT / MISS 等弹字': 'pop-up PERFECT / GREAT / MISS',
    '显示帧率': 'Show FPS', '游玩界面右下角显示实时 FPS': 'live FPS counter in the bottom-right',
    '命中光效': 'Hit lighting', '打击时的粒子与扩散环': 'particles and shockwave on every hit',
    '背景模糊': 'Background blur', '模糊游玩背景，让音符更清楚': 'blur the playfield so notes stand out',
    '打击误差条': 'Hit error meter', '游玩时显示最近判定的偏差（左早右晚）': 'recent timing offsets (early left, late right)',
    '连击数字跟随光标': 'Combo counter follows cursor', 'std / catch 的 combo 显示在指针旁': 'combo shown next to the pointer in std / catch',
    '主音量': 'Master volume', '总输出增益': 'overall output gain',
    '音乐音量': 'Music volume', '谱面 / 演示曲音量': 'beatmap / demo track level',
    '音效音量': 'Effects volume', '打击音、滑块 tick、判定音': 'hit sounds, slider ticks, judgements',
    '背景暗度': 'Background dim', '0% 原图 · 100% 全黑': '0% original · 100% fully black',
    '滚动速度': 'Scroll speed', '影响 std 打圈收缩与 mania 下落速度': 'approach rate in std, fall speed in mania',
    '延迟校准': 'Delay calibration', '敲击节拍，测出输入与音频的偏移': 'tap to the beat to measure input latency',
    '恢复默认设置': 'Restore defaults', '音效、画面、游玩选项全部回到默认': 'reset audio, graphics and gameplay options',
    '清空自定义键位': 'Reset keybinds', '只重置按键，不影响其他选项': 'only the keys, nothing else',
    '退出 osu!': 'Exit osu!', '卸载覆盖层回到主页（等同顶栏 HOME）': 'unload the overlay back to home',
    '清除缓存歌曲': 'Clear cached songs', '删除全部已导入的谱面（含音频与背景），此操作不可恢复；内置演示谱不受影响': 'delete every imported beatmap (audio + background). cannot be undone; demos stay',
    'MANIA 键位': 'MANIA keys', '点击按钮再按键即可重绑': 'click a key then press the new one',
    '重置键位': 'Reset keybinds', '恢复为 mania D F J K / taiko Z X': 'back to mania D F J K / taiko Z X',
    '设置与键位保存在 localStorage（osu_settings / osu_keybinds）；导入的谱面和音频已存进浏览器 IndexedDB，刷新、重开站点都还在，可在选曲页逐张删除，或在这里一键清空。':
      'Settings and keybinds live in localStorage (osu_settings / osu_keybinds). Imported beatmaps and audio are stored in IndexedDB, so they survive reloads — delete them one by one in the song list or wipe everything here.',
    '警告：将清除所有导入歌曲与音频缓存，且无法恢复（演示谱保留）': 'WARNING: this wipes all imported songs and audio cache permanently (demos are kept)',
    '已清除全部导入歌曲': 'all imported songs cleared',
    '确认清除？点第二次执行': 'SURE? click again',
    '帧率上限': 'Frame limit', '和 osu!lazer 的 Frame limiter 一样：限制渲染帧率可以省电 / 稳定帧时间': 'same idea as lazer\'s frame limiter: cap the render rate to save power / steady frame time',
    'osu!mania 键数': 'osu!mania key count', '1K – 10K，切换后立即生效（导入谱面时以谱面 CircleSize 为准）': '1K – 10K, applied immediately (imported maps still use their own CircleSize)',
    '左右键（也可用鼠标）': 'left / right (mouse works too)',
    '开始校准': 'Start calibration',
    '键位已重置': 'keybinds reset',
    '滚动速度 100% 对应 osu! 标准 AR 表现；调高会让前奏更短、判断更紧。': '100% matches standard AR; higher shortens the lead-in and tightens the read.',
    'osu!lazer 的皮肤、音频设备、语言等系统级选项在此为浏览器实现版：字体与配色跟随站点主题，音频设备由浏览器接管。': 'lazer\'s skin / audio device / language options are browser-side here: fonts and colors follow the site theme, audio output is owned by the browser.',
    '跟着节拍敲击（空格 / 点击）…': 'tap along to the beat (space / click)…',
    'MANIA 键位': 'MANIA keys'
  };

  function applyLang(cats, body) {
    var en = OSUS.i18n && OSUS.i18n.lang() === 'en';
    if (cats) {
      Array.prototype.forEach.call(cats.querySelectorAll('.tab-cn'), function (n) {
        n.style.display = en ? 'none' : '';
      });
    }
    if (!en || !body) return;
    Array.prototype.forEach.call(body.querySelectorAll('.osu-set-name, .osu-set-desc, .osu-set-tip, .osu-set-row .osu-btn'), function (n) {
      var txt = n.textContent.trim();
      if (EN[txt]) n.textContent = EN[txt];
    });
  }

  function render() {
    var cats = document.getElementById('osu-set-cats');
    var body = document.getElementById('osu-set-pages');
    if (!cats || !body) return;

    cats.innerHTML = '';
    TABS.forEach(function (t) {
      var b = el('button', 'osu-set-tab' + (t.k === activeTab ? ' is-on' : ''));
      b.type = 'button';
      b.innerHTML = '<span class="tab-en">' + t.n + '</span><span class="tab-cn">' + t.cn + '</span>';
      b.addEventListener('click', function () {
        activeTab = t.k;
        render();
      });
      cats.appendChild(b);
    });

    body.innerHTML = '';
    body.appendChild(buildPage(activeTab));
    applyLang(cats, body);
  }

  SET.refresh = function () { if (mounted) render(); };

  SET.mount = function () {
    if (!mounted) {
      mounted = true;
      render();
    } else render();
    SET.apply();
  };
})();

  /* 挂载即应用皮肤（覆盖层打开后如果有 #osu-app，data-skin 立刻生效） */
  try { if (OSUS.applySkin) OSUS.applySkin(); } catch (e) {}
