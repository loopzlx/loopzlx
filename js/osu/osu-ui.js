/* osu-ui.js —— lazer 风格界面：主菜单 / 选曲 / 设置 / 下载 / 结果 / 曲库 */
var OSU = window.Osu = window.Osu || {};

(function () {
  'use strict';
  var S = OSU.S;
  var U = OSU.util;
  var C = OSU.C;

  var UI = OSU.ui = {};

  var library = OSU.library = [];
  var selected = null;      // 当前选中的曲目
  var viewMode = 'mania';   // 选曲页当前模式

  function $(id) { return document.getElementById(id); }
  function on(el, ev, fn) { if (el) el.addEventListener(ev, fn); }

  /* ---------------- 日志 ---------------- */
  OSU.log = function (msg) {
    var box = $('osu-log');
    if (!box) return;
    var line = document.createElement('div');
    var t = new Date();
    line.className = 'osu-log-line';
    line.textContent = '[' + String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0') + ':' + String(t.getSeconds()).padStart(2, '0') + '] ' + msg;
    box.appendChild(line);
    while (box.children.length > 40) box.removeChild(box.firstChild);
    box.scrollTop = box.scrollHeight;
  };

  /* ---------------- 视图 ---------------- */
  var VIEWS = ['menu', 'select', 'play', 'result', 'settings', 'download'];

  UI.showView = function (name) {
    S.view = name;
    VIEWS.forEach(function (v) {
      var el = $('osu-' + v);
      if (el) el.classList.toggle('is-on', v === name);
    });
    if (name === 'select') UI.renderSelect();
    if (name === 'menu') UI.renderMenu();
    var back = $('osu-top-back');
    if (back) back.style.display = name === 'menu' ? 'none' : 'inline-flex';
    var home = $('osu-top-home');
    if (home) home.style.display = 'inline-flex';
  };

  /* ---------------- 主菜单 ---------------- */
  UI.renderMenu = function () {
    var row = $('osu-mode-cards');
    if (!row) return;
    row.querySelectorAll('.osu-mode-card').forEach(function (card) {
      card.classList.toggle('is-active', card.dataset.mode === viewMode);
    });
    var np = $('osu-nowplaying');
    if (np) {
      var d = OSU.bm.demoChart(viewMode);
      np.querySelector('.np-title').textContent = d.title;
      np.querySelector('.np-sub').textContent = d.artist + ' · ' + C.MODE_CN[viewMode];
      var cov = np.querySelector('.np-cover');
      cov.style.background = 'linear-gradient(135deg,' + C.MODE_COLOR[viewMode] + ',rgba(0,0,0,.2))';
    }
  };

  UI.setBrowsedMode = function (m) {
    viewMode = m;
    UI.renderMenu();
  };

  /* ---------------- 选曲 ---------------- */
  var listScroll = 0;

  function songsForMode(mode) {
    var out = [];
    if (mode === 'demo-all') {
      C.MODES.forEach(function (m) { out.push({ demo: true, chart: OSU.bm.demoChart(m), mode: m }); });
      return out;
    }
    out.push({ demo: true, chart: OSU.bm.demoChart(mode), mode: mode });
    for (var i = 0; i < library.length; i++) {
      var it = library[i];
      if (it.chart.mode === mode) out.push(it);
    }
    return out;
  }

  UI.renderSelect = function () {
    var mode = viewMode;
    var list = $('osu-song-list');
    if (!list) return;
    var items = songsForMode(mode);
    list.innerHTML = '';
    items.forEach(function (it, idx) {
      var card = document.createElement('button');
      card.className = 'osu-song-card' + (idx === 0 ? ' is-sel' : '');
      card.innerHTML =
        '<div class="song-cover" style="background:linear-gradient(135deg,' + C.MODE_COLOR[mode] + ',rgba(0,0,0,.25))">' + C.MODE_ICON[mode] + '</div>' +
        '<div class="song-text"><div class="song-title">' + it.chart.title + '</div>' +
        '<div class="song-meta">' + it.chart.artist + ' · ' + it.chart.version + '</div></div>' +
        '<div class="song-badge">' + (it.demo ? 'DEMO' : 'OSZ') + '</div>';
      card.addEventListener('click', function () {
        selected = it;
        list.querySelectorAll('.osu-song-card').forEach(function (c) { c.classList.remove('is-sel'); });
        card.classList.add('is-sel');
        UI.renderDetail();
      });
      list.appendChild(card);
    });
    if (!items.length) list.innerHTML = '<div class="osu-empty">这个模式还没有谱面，点右上「IMPORT」导入 .osz</div>';
    selected = items[0] || null;
    var tabs = $('osu-mode-row-select');
    if (tabs) tabs.querySelectorAll('[data-mode]').forEach(function (b) { b.classList.toggle('is-on', b.dataset.mode === mode); });
    UI.renderDetail();
    UI.renderMods();
  };

  function starRating(chart) {
    var n = chart.objects.length || 1;
    var dur = Math.max(1, chart.length || 30);
    var density = n / dur;
    var stars = U.clamp(1.5 + Math.sqrt(density) * 3.2 + (chart.od || 5) / 8, 1, 9.9);
    return stars.toFixed(1);
  }

  UI.renderDetail = function () {
    var box = $('osu-detail');
    if (!box) return;
    if (!selected) { box.classList.add('is-empty'); return; }
    box.classList.remove('is-empty');
    var c = selected.chart;
    box.querySelector('[data-d="title"]').textContent = c.title;
    box.querySelector('[data-d="artist"]').textContent = c.artist + ' — ' + c.version;
    box.querySelector('[data-d="mapper"]').textContent = 'mapped by ' + (c.creator || 'LOOPZLX');
    box.querySelector('[data-d="stars"]').textContent = '★ ' + starRating(c);
    box.querySelector('[data-d="objects"]').textContent = (c.objects.length || 0) + ' objects';
    box.querySelector('[data-d="len"]').textContent = U.time(c.length || 30);
    box.querySelector('[data-d="bpm"]').textContent = (c.bpm || 150) + ' BPM';
    box.querySelector('[data-d="mode"]').textContent = C.MODE_CN[c.mode] || c.mode;
    var cover = box.querySelector('.osu-detail-cover');
    cover.style.background = 'linear-gradient(135deg,' + C.MODE_COLOR[c.mode] + ',rgba(0,0,0,.35))';
    cover.textContent = C.MODE_ICON[c.mode];
  };

  /* ---------------- Mods ---------------- */
  function modIds() { return Object.keys(S.mods).filter(function (k) { return S.mods[k]; }); }

  function applyMods() {
    S.mods = {};
    $('osu-mods').querySelectorAll('.osu-mod.is-on').forEach(function (el) { S.mods[el.dataset.mod] = true; });
    S.speed = S.mods.DT ? 1.5 : (S.mods.HT ? 0.75 : 1);
    var mult = 1;
    modIds().forEach(function (k) {
      var d = C.MODS.filter(function (m) { return m.id === k; })[0];
      if (d) mult *= d.mult;
    });
    var lab = $('osu-mod-mult');
    if (lab) lab.textContent = mult.toFixed(2) + '×';
    UI.renderMods();
  }

  UI.renderMods = function () {
    var box = $('osu-mods');
    if (!box || box.dataset.built) { UI.syncMods(); return; }
    box.innerHTML = '';
    C.MODS.forEach(function (m) {
      var el = document.createElement('button');
      el.className = 'osu-mod';
      el.dataset.mod = m.id;
      el.innerHTML = '<b>' + m.id + '</b><span>' + m.name + '</span>';
      el.title = m.desc;
      el.addEventListener('click', function () {
        /* 互斥组处理 */
        var group = C.MOD_EXCLUSIVE.filter(function (g) { return g.indexOf(m.id) >= 0; })[0];
        if (group && !el.classList.contains('is-on')) {
          group.forEach(function (g) {
            if (g !== m.id) {
              var other = box.querySelector('[data-mod="' + g + '"]');
              if (other) other.classList.remove('is-on');
            }
          });
        }
        el.classList.toggle('is-on');
        applyMods();
        OSU.log('MOD ' + m.id + (el.classList.contains('is-on') ? ' ON' : ' OFF'));
      });
      box.appendChild(el);
    });
    box.dataset.built = '1';
    UI.syncMods();
  };

  UI.syncMods = function () {
    var box = $('osu-mods');
    if (!box) return;
    box.querySelectorAll('.osu-mod').forEach(function (el) {
      el.classList.toggle('is-on', !!S.mods[el.dataset.mod]);
    });
  };

  /* ---------------- Pads ---------------- */
  UI.buildPads = function (modeKey) {
    var pads = $('osu-pads');
    if (!pads) return;
    var impl = OSU.modes[modeKey];
    pads.innerHTML = '';
    pads.className = 'osu-pads pads-' + modeKey;
    if (modeKey === 'mania') {
      for (var i = 0; i < impl.cols; i++) {
        var el = document.createElement('div');
        el.className = 'osu-pad';
        el.dataset.lane = i;
        el.textContent = impl.labels[i] || '';
        pads.appendChild(el);
      }
      UI.bindPads();
    } else if (modeKey === 'taiko') {
      /* DON / KAT 两个键，和 osu taiko 的双色键一致 */
      [['DON', 'Z', 0, 'don'], ['KAT', 'X', 1, 'kat']].forEach(function (cfg) {
        var b = document.createElement('div');
        b.className = 'osu-pad osu-pad-' + cfg[3];
        b.dataset.lane = cfg[2];
        b.innerHTML = '<span class="pad-key">' + cfg[0] + '</span><span class="pad-hint">' + cfg[1] + '</span>';
        pads.appendChild(b);
      });
      UI.bindPads();
    } else if (modeKey === 'catch') {
      ['←', '→'].forEach(function (t, i) {
        var b = document.createElement('div');
        b.className = 'osu-pad';
        b.dataset.lane = i;
        b.textContent = t;
        pads.appendChild(b);
      });
      UI.bindPads();
    } else {
      var click = document.createElement('div');
      click.className = 'osu-pad osu-pad-wide';
      click.dataset.lane = 0;
      click.textContent = 'TAP / SPIN';
      pads.appendChild(click);
      UI.bindPads();
    }
  };

  UI.bindPads = function () {
    var pads = $('osu-pads');
    if (!pads) return;
    pads.querySelectorAll('.osu-pad').forEach(function (el) {
      var lane = Number(el.dataset.lane);
      function down(e) {
        e.preventDefault();
        el.classList.add('is-down');
        OSU.input.press(lane, true);
      }
      function up(e) {
        el.classList.remove('is-down');
        OSU.input.release(lane);
      }
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('pointerleave', function (e) { if (el.classList.contains('is-down')) up(e); });
    });
  };

  /* ---------------- 结算 / 暂停 / 加载 ---------------- */
  UI.showResult = function (failed) {
    var acc = OSU.acc();
    var rank = OSU.rankOf(acc, failed);
    var box = $('osu-result');
    if (!box) return;
    box.querySelector('#osu-result-rank').textContent = rank;
    box.querySelector('#osu-result-rank').style.color = OSU.rankColor(rank);
    box.querySelector('#osu-result-title').textContent = failed ? 'FAILED' : 'RESULT';
    var cnt = S.counts;
    box.querySelector('#osu-result-stats').innerHTML =
      '<div class="osu-res-score">' + U.fmt(Math.min(C.TOTAL_SCORE, S.score)) + '</div>' +
      '<div class="osu-res-acc">' + acc.toFixed(2) + '% <small>ACC</small></div>' +
      '<div class="osu-res-grid">' +
      '<div><b>' + (cnt.PERFECT || 0) + '</b><span>PERFECT</span></div>' +
      '<div><b>' + (cnt.GREAT || 0) + '</b><span>GREAT</span></div>' +
      '<div><b>' + (cnt.GOOD || 0) + '</b><span>GOOD</span></div>' +
      '<div><b>' + (cnt.OK || 0) + '</b><span>OK</span></div>' +
      '<div><b>' + (cnt.MEH || 0) + '</b><span>MEH</span></div>' +
      '<div><b>' + ((cnt.MISS || 0) + (cnt.BREAK || 0)) + '</b><span>MISS</span></div>' +
      '</div>' +
      '<div class="osu-res-sub">max combo ' + S.maxCombo + ' · ' + (modIds().join('') || 'NM') + '</div>';
    UI.showView('result');
    OSU.log('FINISH // ' + rank + ' · ' + acc.toFixed(2) + '%');
  };

  UI.showPause = function (on) {
    var p = $('osu-pause');
    if (p) p.classList.toggle('is-on', !!on);
  };

  UI.loading = function (on, text) {
    var l = $('osu-loading');
    if (!l) return;
    l.classList.toggle('is-on', !!on);
    var t = l.querySelector('.osu-loading-text');
    if (t && text) t.textContent = text;
  };

  /* ---------------- 曲库 / 导入 ---------------- */
  UI.addChart = function (chart, audioBlob, bgUrl, zipName) {
    var it = {
      demo: false, chart: chart, audioBlob: audioBlob, bgUrl: bgUrl, zipName: zipName || ''
    };
    library.push(it);
    OSU.log('IMPORT // ' + chart.title + ' [' + chart.mode + '] · ' + chart.objects.length + ' objects');
    return it;
  };

  UI.openImport = function () {
    var inp = $('osu-file');
    if (inp) inp.click();
  };

  UI.handleFiles = function (files) {
    var list = Array.prototype.slice.call(files || []);
    if (!list.length) return;
    var osuFile = list.filter(function (f) { return /\.osu$/i.test(f.name); })[0];
    var audioFile = list.filter(function (f) { return /^audio\//i.test(f.type) || /\.(mp3|ogg|wav)$/i.test(f.name); })[0];
    var oszFile = list.filter(function (f) { return /\.osz$/i.test(f.name); })[0];

    UI.loading(true, 'READING PACKAGE…');
    if (oszFile) {
      OSU.bm.readOsz(oszFile).then(function (r) {
        return finish(r.osuText, r.audioBlob, r.bgBlob, oszFile.name);
      }).catch(function (err) {
        UI.loading(false);
        UI.toast('导入失败：' + err.message);
      });
    } else if (osuFile) {
      var fr = new FileReader();
      fr.onload = function () {
        finish(String(fr.result), audioFile || null, null, osuFile.name);
      };
      fr.readAsText(osuFile);
    } else {
      UI.loading(false);
      UI.toast('请选择 .osz 或 .osu（可同时带音频）');
    }

    function finish(osuText, audioBlob, bgBlob, name) {
      var chart = OSU.bm.parseOsu(osuText);
      var bgUrl = bgBlob ? URL.createObjectURL(bgBlob) : null;
      var done = function (blob) {
        var item = UI.addChart(chart, blob, bgUrl, name);
        if (blob) {
          OSU.audio.decode(blob).then(function (buf) { item.bufferRef = buf; }).catch(function () {});
        }
        UI.loading(false);
        UI.toast('已导入 ' + chart.title);
        UI.setBrowsedMode(chart.mode);
        UI.showView('select');
      };
      if (!audioBlob && chart.audioName) {
        /* .osz 里的音频已随包提供 */
      }
      done(audioBlob);
    }
  };

  UI.toast = function (msg) {
    var t = $('osu-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(UI._toastT);
    UI._toastT = setTimeout(function () { t.classList.remove('is-on'); }, 2600);
    OSU.log(msg);
  };

  /* ---------------- 在线下载 ---------------- */
  var SEARCH_API = [
    function (q, m) { return 'https://api.nerinyan.moe/search?q=' + encodeURIComponent(q) + '&m=' + m + '&limit=15'; },
    function (q, m) { return 'https://catboy.best/api/v2/search?query=' + encodeURIComponent(q) + '&m=' + m + '&limit=15'; },
    function (q, m) { return 'https://osu.direct/api/v2/search?query=' + encodeURIComponent(q) + '&m=' + m + '&limit=15'; }
  ];
  var MODE_NUM = { std: 0, taiko: 1, catch: 2, mania: 3 };

  UI.search = function (q) {
    var out = $('osu-search-results');
    var st = $('osu-download-status');
    if (!out) return;
    out.innerHTML = '<div class="osu-empty">SEARCHING…</div>';
    var m = MODE_NUM[viewMode] == null ? 0 : MODE_NUM[viewMode];
    var urls = SEARCH_API.map(function (f) { return f(q || '', m); });
    var tried = 0;

    function attempt(i) {
      if (i >= urls.length) {
        out.innerHTML = '<div class="osu-empty">接口不可达，请直接输入谱面集 ID（纯数字）。</div>';
        if (st) st.textContent = '';
        return;
      }
      fetch(urls[i]).then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function (data) {
          var sets = Array.isArray(data) ? data : (data.beatmapsets || []);
          render(sets);
        })
        .catch(function () { attempt(i + 1); });
    }
    attempt(0);

    function render(sets) {
      out.innerHTML = '';
      if (!sets.length) { out.innerHTML = '<div class="osu-empty">没有结果</div>'; return; }
      sets.forEach(function (s) {
        var row = document.createElement('div');
        row.className = 'osu-search-row';
        var title = s.title || s.Title || '?';
        var artist = s.artist || s.Artist || '';
        var id = s.id || s.SetID || s.SetId;
        row.innerHTML = '<div class="row-main"><b>' + title + '</b><span>' + artist + '</span></div>' +
          '<button class="osu-btn small">DL</button>';
        row.querySelector('button').addEventListener('click', function () {
          UI.downloadSet(id, title);
        });
        out.appendChild(row);
      });
    }
  };

  UI.downloadSet = function (id, title) {
    var st = $('osu-download-status');
    if (st) st.textContent = '正在下载 #' + id + ' …';
    var urls = [
      'https://api.nerinyan.moe/d/' + id,
      'https://catboy.best/d/' + id,
      'https://osu.direct/api/d/' + id
    ];
    var i = 0;
    function next() {
      if (i >= urls.length) { if (st) st.textContent = '下载失败，请稍后再试。'; return; }
      var u = urls[i++];
      fetch(u).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.blob();
      }).then(function (blob) {
        var file = new File([blob], 'beatmapset-' + id + '.osz', { type: 'application/zip' });
        UI.handleFiles([file]);
        if (st) st.textContent = '已下载 ' + title;
      }).catch(function () { next(); });
    }
    next();
  };

  /* ---------------- 设置：键位 / 校准 ---------------- */
  var captureKey = null;

  UI.renderKeybinds = function () {
    var box = $('osu-keybinds');
    if (!box) return;
    box.innerHTML = '';
    var cols = 4;
    var kb = OSU.store.load('osu_keybinds', {});
    var keys = (kb[cols] && kb[cols].length === cols) ? kb[cols] : ['KeyD', 'KeyF', 'KeyJ', 'KeyK'];
    keys.forEach(function (k, i) {
      var b = document.createElement('button');
      b.className = 'osu-key';
      b.textContent = labelOf(k);
      b.addEventListener('click', function () {
        captureKey = { lane: i, btn: b };
        b.textContent = '…';
        b.classList.add('is-capturing');
      });
      box.appendChild(b);
    });

    var reset = document.createElement('button');
    reset.className = 'osu-key osu-key-reset';
    reset.textContent = 'RESET';
    reset.addEventListener('click', function () {
      OSU.store.save('osu_keybinds', {});
      UI.renderKeybinds();
      UI.toast('键位已重置');
    });
    box.appendChild(reset);
  };

  function labelOf(code) {
    if (!code) return '?';
    if (code === 'Space') return '⌴';
    return code.replace('Key', '').replace('Semicolon', ';').replace('Arrow', '');
  }

  UI.onKeyCapture = function (e) {
    if (!captureKey) return false;
    var kb = OSU.store.load('osu_keybinds', {});
    if (!kb[4]) kb[4] = ['KeyD', 'KeyF', 'KeyJ', 'KeyK'];
    kb[4][captureKey.lane] = e.code;
    OSU.store.save('osu_keybinds', kb);
    OSU.modes.mania.setCols(4, kb);
    captureKey.btn.classList.remove('is-capturing');
    captureKey.btn.textContent = labelOf(e.code);
    captureKey = null;
    OSU.log('KEYBIND // lane ' + 0 + ' → ' + e.code);
    return true;
  };

  /* 延迟校准（简化：以敲击偏差给建议） */
  var calib = { beats: [], start: 0, timer: 0, idx: 0 };

  UI.startCalib = function () {
    var box = $('osu-calib');
    if (!box) return;
    box.classList.add('is-on');
    calib.beats = []; calib.idx = 0;
    var status = box.querySelector('.calib-status');
    status.textContent = '跟着节拍敲击（空格 / 点击）…';
    OSU.audio.init();
    calib.timer = setInterval(function () {
      calib.idx++;
      OSU.audio.tick();
      calib.start = OSU.audio.now();
      var pulse = box.querySelector('.calib-pulse');
      pulse.classList.remove('beat');
      void pulse.offsetWidth;
      pulse.classList.add('beat');
    }, 600);
  };

  UI.calibTap = function () {
    if (!calib.start) return;
    var off = (OSU.audio.now() - calib.start) * 1000;
    if (off > 300) off -= 600;
    calib.beats.push(off);
    var avg = calib.beats.reduce(function (a, b) { return a + b; }, 0) / calib.beats.length;
    var box = $('osu-calib');
    if (box) box.querySelector('.calib-status').textContent = '平均偏移 ' + Math.round(avg) + ' ms（' + calib.beats.length + ' 次）';
  };

  UI.closeCalib = function () {
    clearInterval(calib.timer);
    calib.timer = 0;
    var box = $('osu-calib');
    if (box) box.classList.remove('is-on');
  };

  /* ---------------- 事件绑定 ---------------- */
  UI.init = function () {
    UI.renderMods();
    UI.renderKeybinds();
    UI.renderMenu();
    UI.showView('menu');

    on($('osu-mode-cards'), 'click', function (e) {
      var card = e.target.closest('.osu-mode-card');
      if (!card) return;
      viewMode = card.dataset.mode;
      OSU.log('MODE // ' + C.MODE_CN[viewMode]);
      UI.showView('select');
    });

    on($('osu-btn-play'), 'click', function () { UI.showView('select'); });
    on($('osu-btn-settings'), 'click', function () { UI.showView('settings'); });
    on($('osu-btn-download'), 'click', function () { UI.showView('download'); UI.search(''); });
    on($('osu-btn-import'), 'click', UI.openImport);
    on($('osu-file'), 'change', function (e) { UI.handleFiles(e.target.files); e.target.value = ''; });

    on($('osu-btn-start'), 'click', function () {
      if (!selected) return;
      var c = selected.chart;
      if (selected.bufferRef) c.song = { bufferRef: selected.bufferRef };
      else if (selected.audioBlob && !c.song) {
        UI.loading(true, 'DECODING AUDIO…');
        OSU.audio.decode(selected.audioBlob).then(function (buf) {
          selected.bufferRef = buf;
          c.song = { bufferRef: buf };
          UI.loading(false);
          OSU.game.start(c, c.mode);
        }).catch(function () {
          UI.loading(false);
          OSU.game.start(c, c.mode);
        });
        return;
      }
      OSU.game.start(c, c.mode);
    });

    on($('osu-btn-pause'), 'click', function () { OSU.game.pause(); });
    on($('osu-btn-quit'), 'click', function () { OSU.game.quit(); });
    on($('osu-pause-resume'), 'click', function () { OSU.game.resume(); });
    on($('osu-pause-retry'), 'click', function () { OSU.game.resume(); OSU.game.start(S.chart, S.mode); });
    on($('osu-pause-menu'), 'click', function () { OSU.game.quit(); });
    on($('osu-btn-retry'), 'click', function () { OSU.game.start(S.chart, S.mode); });
    on($('osu-btn-tomenu'), 'click', function () { UI.showView('menu'); });
    on($('osu-settings-back'), 'click', function () { UI.showView('menu'); });
    on($('osu-btn-calib'), 'click', UI.startCalib);
    on($('osu-btn-calib-close'), 'click', UI.closeCalib);
    on($('osu-calib'), 'click', function (e) { if (e.target.id !== 'osu-btn-calib-close') UI.calibTap(); });
    on($('osu-download-back'), 'click', function () { UI.showView('menu'); });
    on($('osu-search-btn'), 'click', function () { UI.search($('osu-search-input').value.trim()); });
    on($('osu-search-input'), 'keydown', function (e) { if (e.key === 'Enter') UI.search(e.target.value.trim()); });
    on($('osu-top-back'), 'click', function () { if (S.view === 'play') OSU.game.quit(); else UI.showView('menu'); });
    on($('osu-top-home'), 'click', function () {
      if (window.OsuWarp && window.OsuWarp.close) window.OsuWarp.close();
    });
    on($('osu-sound-btn'), 'click', function () {
      OSU.audio.setMuted(!OSU.audio.muted);
      var b = $('osu-sound-btn');
      if (b) b.textContent = OSU.audio.muted ? '×' : '♪';
      OSU.log('AUDIO // ' + (OSU.audio.muted ? 'muted' : 'on'));
    });
    on($('osu-mode-row-select'), 'click', function (e) {
      var b = e.target.closest('[data-mode]');
      if (!b) return;
      viewMode = b.dataset.mode;
      $('osu-mode-row-select').querySelectorAll('button').forEach(function (x) { x.classList.toggle('is-on', x === b); });
      UI.renderSelect();
    });
  };

})();
