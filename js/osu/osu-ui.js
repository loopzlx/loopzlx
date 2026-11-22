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
  var localFilter = 'all';
  var FAVORITES_KEY = 'osu_local_favorites_v1';
  var RECENT_KEY = 'osu_local_recent_v1';
  function readSet(key) { try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (e) { return {}; } }
  var favorites = readSet(FAVORITES_KEY), recentPlays = readSet(RECENT_KEY);
  function isFavorite(it) { return !!favorites[String(it.id)]; }
  function toggleFavorite(it) { var id = String(it.id); if (favorites[id]) delete favorites[id]; else favorites[id] = Date.now(); try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites)); } catch (e) {} UI.renderSelect(); }
  function recordPlay(it, chart) { var id = String(it.id); recentPlays[id] = { at: Date.now(), mode: chart.mode || S.mode, title: chart.title || '' }; try { localStorage.setItem(RECENT_KEY, JSON.stringify(recentPlays)); } catch (e) {} }

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
      if (el) { el.classList.toggle('is-on', v === name); if (v === name) { el.classList.remove('osu-view-enter'); void el.offsetWidth; el.classList.add('osu-view-enter'); } }
    });
    if (name === 'select') UI.renderSelect();
    if (name === 'menu') UI.renderMenu();
    if (name === 'settings' && OSU.settings && OSU.settings.mount) OSU.settings.mount();
    if (name === 'download') {
      /* 打开下载页自动拉一轮，不让它是一张空白页 */
      var list = $('osu-search-results');
      if (list && !list.children.length) UI.search($('osu-search-input') ? $('osu-search-input').value.trim() : '');
    }
    var back = $('osu-top-back');
    if (back) back.style.display = name === 'menu' ? 'none' : 'inline-flex';
    var home = $('osu-top-home');
    if (home) home.style.display = 'inline-flex';
  };


  /* ---------------- 选曲试听 ---------------- */
  var previewAudio = null, previewUrl = null, previewTimer = null, previewItemId = null, previewSeekDragging = false;
  function previewTime(sec) { sec = Math.max(0, Math.floor(Number(sec) || 0)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }
  function updatePreviewProgress() { var a = previewAudio, seek = $('osu-preview-seek'); if (!a || !seek) return; var d = Number(a.duration); if (!isFinite(d) || d <= 0) return; if (!previewSeekDragging) seek.value = String(Math.round(Math.max(0, Math.min(d, a.currentTime)) / d * 1000)); var cur = $('osu-preview-current'), rem = $('osu-preview-remaining'); if (cur) cur.textContent = previewTime(a.currentTime); if (rem) rem.textContent = '−' + previewTime(Math.max(0, d - a.currentTime)); seek.disabled = false; }
  function stopPreview() {
    if (previewTimer) { clearTimeout(previewTimer); previewTimer = null; }
    if (previewAudio) { previewAudio.pause(); previewAudio.currentTime = 0; previewAudio.src = ''; previewAudio = null; }
    if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
    previewItemId = null; previewSeekDragging = false;
    var seek = $('osu-preview-seek'); if (seek) { seek.value = '0'; seek.disabled = true; } var cur = $('osu-preview-current'); if (cur) cur.textContent = '0:00'; var rem = $('osu-preview-remaining'); if (rem) rem.textContent = '−0:00';
    var btn = $('osu-preview-toggle');
    if (btn) { btn.disabled = !selected || !selected.audioBlob; btn.classList.remove('is-playing'); btn.querySelector('.preview-icon').textContent = '▶'; btn.querySelector('.preview-label').textContent = 'PREVIEW'; }
    var status = $('osu-preview-status');
    if (status) status.textContent = selected && selected.audioBlob ? 'READY' : 'NO AUDIO';
  }
  function togglePreview() {
    if (!selected || !selected.audioBlob) return;
    if (previewAudio && previewItemId === selected.id) {
      if (!previewAudio.paused) { previewAudio.pause(); if (previewTimer) { clearTimeout(previewTimer); previewTimer = null; } }
      else { previewAudio.play().then(function () { previewTimer = setTimeout(stopPreview, 25000); }).catch(function () {}); }
      updatePreviewUI(); return;
    }
    stopPreview();
    previewItemId = selected.id;
    previewUrl = URL.createObjectURL(selected.audioBlob);
    previewAudio = new Audio(previewUrl);
    previewAudio.volume = $('osu-preview-volume') ? Number($('osu-preview-volume').value) : 0.65;
    previewAudio.addEventListener('ended', stopPreview);
    previewAudio.addEventListener('timeupdate', updatePreviewProgress);
    previewAudio.addEventListener('loadedmetadata', updatePreviewProgress);
    previewAudio.addEventListener('seeked', updatePreviewProgress);
    previewAudio.addEventListener('error', function () { var st = $('osu-preview-status'); if (st) st.textContent = 'AUDIO ERROR'; });
    previewAudio.currentTime = Math.max(0, Number(curChart().previewTime || 0));
    var start = function () { previewAudio.play().then(function () { previewTimer = setTimeout(stopPreview, 25000); updatePreviewUI(); }).catch(function () { var st = $('osu-preview-status'); if (st) st.textContent = 'TAP TO PLAY'; }); };
    if (previewAudio.readyState >= 2) start(); else previewAudio.addEventListener('canplay', start, { once: true });
  }
  function updatePreviewUI() {
    var btn = $('osu-preview-toggle');
    if (!btn) return;
    var playing = !!(previewAudio && !previewAudio.paused);
    btn.classList.toggle('is-playing', playing);
    btn.querySelector('.preview-icon').textContent = playing ? 'Ⅱ' : '▶';
    btn.querySelector('.preview-label').textContent = playing ? 'PAUSE' : 'PREVIEW';
    var st = $('osu-preview-status'); if (st) st.textContent = playing ? 'PLAYING' : 'PAUSED';
  }

  /* ---------------- 主菜单 ---------------- */
  UI.renderMenu = function () {
    var row = $('osu-mode-cards');
    if (!row) return;
    row.querySelectorAll('.osu-mode-card').forEach(function (card) {
      card.classList.toggle('is-active', card.dataset.mode === viewMode);
    });
    var np = $('osu-nowplaying');
    if (!np) return;
    /* 左下角"歌单"卡：当前选中曲（或该模式的演示谱）的封面 / 难度 / 星级 / 时长 + 曲库数量 */
    var pick = (selected && selected.charts) ? selected : null;
    if (!pick || pick.mode !== viewMode) {
      pick = { demo: true, charts: [OSU.bm.demoChart(viewMode)], dl: 0, mode: viewMode };
    }
    var c = pick.charts[pick.dl || 0] || pick.charts[0];
    if (!c) return;
    np.querySelector('.np-title').textContent = c.title || '—';
    np.querySelector('.np-sub').textContent = (c.artist || '') + ' · ' + (C.MODE_CN[viewMode] || viewMode);

    var cov = np.querySelector('.np-cover');
    var imgUrl = pick.bgUrl || ('img/osu/mode-' + viewMode + '.jpg');
    cov.style.backgroundImage = 'linear-gradient(180deg, rgba(0,0,0,.18), rgba(0,0,0,.55)), url("' + imgUrl + '")';
    cov.style.backgroundSize = 'cover, cover';
    cov.style.backgroundPosition = 'center, center';
    cov.textContent = pick.bgUrl ? '' : '';

    var chips = np.querySelector('.np-chips');
    if (chips) {
      chips.innerHTML =
        '<span class="np-chip">' + (c.version || 'Normal') + '</span>' +
        (pick.charts.length > 1 ? '<span class="np-chip">' + pick.charts.length + ' ' + t('select.diffs', 'DIFFS') + '</span>' : '') +
        '<span class="np-chip np-stars">★ ' + OSU.starRating(c).toFixed(1) + '</span>' +
        '<span class="np-chip">' + U.time(c.length || 30) + '</span>' +
        '<span class="np-chip">' + (c.bpm || 120) + ' BPM</span>';
    }
    var lib = np.querySelector('.np-lib');
    if (lib) lib.textContent = 'LIB ' + library.length + ' ' + (OSU.i18n ? OSU.i18n.t('np.sets') : 'SETS');
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
      C.MODES.forEach(function (m) { out.push({ demo: true, id: 'demo-' + m, charts: [OSU.bm.demoChart(m)], dl: 0, mode: m }); });
      return out;
    }
    out.push({ demo: true, id: 'demo-' + mode, charts: [OSU.bm.demoChart(mode)], dl: 0, mode: mode });
    for (var i = 0; i < library.length; i++) {
      var it = library[i];
      if (it.mode === mode) out.push(it);
    }
    return out;
  }

  function curChart() {
    if (!selected) return null;
    return selected.charts[selected.dl || 0];
  }
  UI.curChart = curChart;
  var diffOpenId = 0;

  function diffStars(c) { return OSU.starRating(c).toFixed(1); }
  function diffColor(stars) { return stars < 2 ? '#8bd3ff' : stars < 4 ? '#9ee493' : stars < 5.3 ? '#ffd166' : stars < 6.5 ? '#ff9b71' : '#ff6bcb'; }

  UI.renderSelect = function () {
    var mode = viewMode;
    var list = $('osu-song-list');
    if (!list) return;
    var items = songsForMode(mode);
    var keepId = selected && selected.id;
    var query = ($('osu-local-search') && $('osu-local-search').value || '').trim().toLowerCase();
    var sort = $('osu-local-sort') ? $('osu-local-sort').value : 'recent';
    items = items.filter(function (it) { var c = it.charts[it.dl || 0] || {}; var hay = [c.title,c.artist,c.creator,c.version,c.mode,c.bpm,c.od,c.cs,it.zipName].join(' ').toLowerCase(); if (localFilter === 'fav' && !isFavorite(it)) return false; if (localFilter === 'recent' && !recentPlays[String(it.id)]) return false; return !query || hay.indexOf(query) >= 0; });
    if (sort === 'recent') items.sort(function (a,b) { return library.indexOf(b)-library.indexOf(a); });
    if (sort === 'played') items.sort(function (a,b) { return (recentPlays[String(b.id)] && recentPlays[String(b.id)].at || 0) - (recentPlays[String(a.id)] && recentPlays[String(a.id)].at || 0); });
    if (sort === 'title') items.sort(function (a,b) { return String(a.charts[a.dl||0].title||'').localeCompare(String(b.charts[b.dl||0].title||'')); });
    if (sort === 'stars') items.sort(function (a,b) { return OSU.starRating(b.charts[b.dl||0])-OSU.starRating(a.charts[a.dl||0]); });
    if (sort === 'bpm') items.sort(function (a,b) { return (b.charts[b.dl||0].bpm||0)-(a.charts[a.dl||0].bpm||0); });
    list.innerHTML = '';
    var fixed = null;
    items.forEach(function (it) {
      var c = it.charts[it.dl || 0];
      var card = document.createElement('button');
      card.className = 'osu-song-card';
      card.dataset.id = it.id;
      var rating = OSU.starRating(c);
      var starTier = rating < 2 ? 'low' : rating < 4 ? 'mid' : rating < 6 ? 'high' : 'expert';
      var coverStyle = it.bgUrl
        ? 'background-image:linear-gradient(0deg,rgba(20,20,24,.2),rgba(20,20,24,.05)),url("' + it.bgUrl + '")'
        : 'background:linear-gradient(135deg,' + C.MODE_COLOR[mode] + ',rgba(0,0,0,.25))';
      card.innerHTML =
        '<div class="song-cover" style="' + coverStyle + '">' + (it.bgUrl ? '' : C.MODE_ICON[mode]) + '</div>' +
        '<div class="song-text"><div class="song-title">' + c.title + '</div>' +
        '<div class="song-meta">' + c.artist + ' · ' + (it.charts.length > 1 ? it.charts.length + ' ' + (OSU.i18n ? OSU.i18n.t('select.diffs') : 'DIFFS') : c.version) + '</div></div>' +
        '<div class="song-rating ' + starTier + '">★ ' + rating.toFixed(2) + '</div>' +
        '<div class="song-badge">' + (it.demo ? 'DEMO' : 'OSZ') + '</div>' +
        (it.demo ? '' : '<span class="song-del" title="删除这张谱面">×</span>');
      var fav = document.createElement('span');
      fav.className = 'song-fav' + (isFavorite(it) ? ' is-on' : ''); fav.textContent = isFavorite(it) ? '★' : '☆'; fav.title = 'Toggle favorite';
      card.appendChild(fav);
      card.addEventListener('click', function (e) {
        if (e.target.closest('.song-del')) return;
        if (e.target.closest('.song-fav')) { e.preventDefault(); e.stopPropagation(); toggleFavorite(it); return; }
        selected = it;
        if (it.charts.length > 1) {
          /* 多难度：直接在行下面展开难度，点一下就切（osu 选曲的 diff picker） */
          diffOpenId = (diffOpenId === it.id ? 0 : it.id);
          it.dl = it.dl || 0;
          UI.renderSelect();
          return;
        }
        it.dl = it.dl || 0;
        list.querySelectorAll('.osu-song-card').forEach(function (c2) { c2.classList.remove('is-sel'); });
        card.classList.add('is-sel');
        UI.renderDetail();
      });
      var del = card.querySelector('.song-del');
      if (del) {
        var armed = false;
        del.addEventListener('click', function (e) {
          e.stopPropagation();
          if (!armed) { armed = true; del.textContent = 'SURE?'; del.classList.add('is-armed'); return; }
          UI.removeItem(it);
        });
      }
      list.appendChild(card);
      if (keepId ? it.id === keepId : items[0] === it) { fixed = it; card.classList.add('is-sel'); }

      if (diffOpenId === it.id && it.charts.length > 1) {
        var pick = document.createElement('div');
        pick.className = 'osu-diff-pick';
        it.charts.forEach(function (cc, ci) {
          var db = document.createElement('button');
          db.type = 'button';
          db.className = 'osu-diff-btn' + ((it.dl || 0) === ci ? ' is-on' : '');
          db.innerHTML = '<b>' + (cc.version || ('Diff ' + (ci + 1))) + '</b><span>★ ' + OSU.starRating(cc).toFixed(1) + '</span>';
          db.addEventListener('click', function (ev) {
            ev.stopPropagation();
            it.dl = ci;
            selected = it;
            UI.renderSelect();
            UI.renderDetail();
          });
          pick.appendChild(db);
        });
        list.appendChild(pick);
      }
    });
    if (!items.length) list.innerHTML = '<div class="osu-empty">' + (query ? 'No beatmaps match your search.' : (OSU.i18n ? OSU.i18n.t('select.empty') : '这个模式还没有谱面，点右上 IMPORT 导入 .osz')) + '</div>'; 
    var nextSelected = fixed || items[0] || null;
    if (selected && nextSelected && selected.id !== nextSelected.id) stopPreview();
    selected = nextSelected;
    if (selected) selected.dl = selected.dl || 0;
    var tabs = $('osu-mode-row-select');
    if (tabs) tabs.querySelectorAll('[data-mode]').forEach(function (b) { b.classList.toggle('is-on', b.dataset.mode === mode); });
    UI.renderDetail();
    UI.renderMods();
  };

  UI.renderDetail = function () {
    var box = $('osu-detail');
    if (!box) return;
    if (!selected) { box.classList.add('is-empty'); return; }
    box.classList.remove('is-empty');
    var c = curChart();
    if (!c) return;
    var previewBtn = $('osu-preview-toggle');
    if (previewBtn) previewBtn.disabled = !selected.audioBlob;
    var previewStatus = $('osu-preview-status');
    if (previewStatus && !(previewAudio && previewItemId === selected.id)) previewStatus.textContent = selected.audioBlob ? 'READY' : 'NO AUDIO';
    box.querySelector('[data-d="title"]').textContent = c.title;
    box.querySelector('[data-d="artist"]').textContent = c.artist + ' — ' + c.version;
    box.querySelector('[data-d="mapper"]').textContent = (OSU.i18n ? OSU.i18n.t('select.mappedby') : 'mapped by') + ' ' + (c.creator || 'LOOPZLX');
    box.querySelector('[data-d="stars"]').textContent = '★ ' + diffStars(c);
    box.querySelector('[data-d="objects"]').textContent = (c.objects.length || 0) + ' ' + (OSU.i18n ? OSU.i18n.t('select.objects') : 'objects');
    box.querySelector('[data-d="len"]').textContent = U.time(c.length || 30);
    box.querySelector('[data-d="bpm"]').textContent = (c.bpm || 150) + ' BPM';
    box.querySelector('[data-d="mode"]').textContent = C.MODE_CN[c.mode] || c.mode;
    var cover = box.querySelector('.osu-detail-cover');
    cover.style.background = selected.bgUrl
      ? 'linear-gradient(0deg,rgba(20,20,24,.88),rgba(20,20,24,.12)),url("' + selected.bgUrl + '") center / cover'
      : 'linear-gradient(0deg,rgba(20,20,24,.72),rgba(0,0,0,.12)),url(\"img/osu/mode-' + c.mode + '.jpg\") center / cover, linear-gradient(135deg,' + C.MODE_COLOR[c.mode] + ',rgba(0,0,0,.35))';
    cover.textContent = selected.bgUrl ? '' : C.MODE_ICON[c.mode];
    box.classList.toggle('has-real-cover', !!selected.bgUrl);
    box.style.setProperty('--diff-accent', diffColor(OSU.starRating(c)));
    var starNode = box.querySelector('[data-d=stars]');
    if (starNode) starNode.style.color = diffColor(OSU.starRating(c));

    /* 难度列表：一张谱面集里的所有难度都能选 */
    var diffs = box.querySelector('#osu-diffs');
    if (!diffs) {
      diffs = document.createElement('div');
      diffs.id = 'osu-diffs';
      diffs.className = 'osu-diffs';
      box.querySelector('.osu-detail-main').appendChild(diffs);
    }
    diffs.innerHTML = '';
    if (selected.charts.length > 1) {
      var head = document.createElement('div');
      head.className = 'osu-diffs-head';
      head.textContent = (OSU.i18n ? OSU.i18n.t('select.diffs') : 'DIFFICULTIES') + ' · ' + selected.charts.length;
      diffs.appendChild(head);
      selected.charts.forEach(function (d, i) {
        var b = document.createElement('button');
        b.className = 'osu-diff' + (i === (selected.dl || 0) ? ' is-on' : '');
        b.innerHTML = '<span class="diff-name">' + d.version + '</span><span class="diff-stars">★ ' + OSU.starRating(d).toFixed(1) + '</span>';
        b.addEventListener('click', function () {
          selected.dl = i;
          UI.renderDetail();
        });
        diffs.appendChild(b);
      });
    }
  };

  /* ---------------- 曲库增删 ---------------- */
  UI.getItem = function (id) {
    for (var i = 0; i < library.length; i++) if (library[i].id === id) return library[i];
    return null;
  };

  UI.removeItem = function (item) {
    if (!item || item.demo) return;
    var i = library.indexOf(item);
    if (i >= 0) library.splice(i, 1);
    if (item.bgUrl) { try { URL.revokeObjectURL(item.bgUrl); } catch (e) {} }
    OSU.bm.deleteItem(item.id);
    OSU.log('DELETE // ' + item.title);
    UI.toast((OSU.i18n ? OSU.i18n.t('select.deleted') : '已删除') + ' · ' + item.title);
    UI.renderSelect();
  };

  UI.clearLibrary = function () {
    for (var i = 0; i < library.length; i++) {
      if (library[i].bgUrl) { try { URL.revokeObjectURL(library[i].bgUrl); } catch (e) {} }
    }
    library.length = 0;
    selected = null;
    OSU.bm.clearItems();
    OSU.log('CLEAR // library wiped');
    UI.toast(OSU.i18n ? OSU.i18n.t('set.cleared') : '已清除所有导入歌曲');
    UI.renderSelect();
  };

  /* 启动时从 IndexedDB 恢复 */
  UI.loadLibrary = function () {
    return OSU.bm.allItems().then(function (rows) {
      library.length = 0;
      rows.forEach(function (r) {
        var bgUrl = r.bgBlob ? URL.createObjectURL(r.bgBlob) : null;
        library.push({
          id: r.id, demo: false, mode: r.mode, title: r.title, artist: r.artist,
          charts: r.charts || [], dl: r.dl || 0,
          audioBlob: r.audioBlob || null, bgBlob: r.bgBlob || null, bgUrl: bgUrl,
          zipName: r.zipName || ''
        });
      });
      if (rows.length) OSU.log('LIBRARY // restored ' + rows.length + ' set(s)');
      if (S.view === 'select') UI.renderSelect();
      return rows.length;
    });
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
  /* ---- 本地成绩：PB 与排行榜（都存 localStorage，无后端） ---- */
  var PB_BASE = 'osu.best.v2', BOARD_BASE = 'osu.board.v1', HISTORY_BASE = 'osu.history.v1';
  var PROF_KEY = 'osu.profile';

  /* ---- 多档案：每套档案独立存 PB 与本地榜，切档即换一整套成绩 ---- */
  function profile() {
    try { return window.localStorage.getItem(PROF_KEY) || 'main'; } catch (e) { return 'main'; }
  }
  function setProfile(name) {
    name = String(name || 'main').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 12) || 'main';
    try { window.localStorage.setItem(PROF_KEY, name); } catch (e) {}
    return name;
  }
  function suffixed(base) { var p = profile(); return p && p !== 'main' ? base + '.' + p : base; }
  function PB_KEY_() { return suffixed(PB_BASE); }
  function BOARD_KEY_() { return suffixed(BOARD_BASE); }
  function HISTORY_KEY_() { return suffixed(HISTORY_BASE); }
  UI.profile = profile;
  UI.setProfile = setProfile;
  UI.profiles = function () {
    var out = [];
    try {
      for (var i = 0; i < window.localStorage.length; i++) {
        var k = window.localStorage.key(i);
        if (k === PB_BASE || k === BOARD_BASE || k.indexOf(PB_BASE + '.') === 0 || k.indexOf(BOARD_BASE + '.') === 0) {
          var name = (k === PB_BASE || k === BOARD_BASE) ? 'main' : k.replace(PB_BASE + '.', '').replace(BOARD_BASE + '.', '');
          if (out.indexOf(name) < 0) out.push(name);
        }
      }
    } catch (e) {}
    if (out.indexOf(profile()) < 0) out.unshift(profile());
    return out.sort();
  };

  function readJson(key, fb) {
    try { var v = window.localStorage.getItem(key); return v ? JSON.parse(v) : fb; } catch (e) { return fb; }
  }
  function writeJson(key, val) {
    try { window.localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }
  function chartKey() {
    var c = S.chart || {};
    return [S.mode || 'std', c.title || '', c.version || ''].join('|');
  }

  function rollScore(el, to) {
    if (!el) return;
    var reduce = document.documentElement.classList.contains('lzx-reduce') ||
      (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (reduce) { el.textContent = U.fmt(to); return; }
    var t0 = performance.now(), dur = 700;
    function step(t) {
      var k = Math.min(1, (t - t0) / dur);
      var e = 1 - Math.pow(1 - k, 3);
      el.textContent = U.fmt(Math.round(to * e));
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  UI.showResult = function (failed) {
    if (window.LZXAch) { window.LZXAch.bump('osu-plays', 1, 'osu-10-play', 10); var played = readSet('osu_modes_played_v1'); played[S.mode] = 1; try { localStorage.setItem('osu_modes_played_v1', JSON.stringify(played)); } catch (e) {} if (['std','taiko','catch','mania'].every(function (m) { return played[m]; })) window.LZXAch.unlock('osu-four-modes'); }
    var acc = OSU.acc();
    var rank = OSU.rankOf(acc, failed);
    var box = $('osu-result');
    if (!box) return;
    box.querySelector('#osu-result-rank').textContent = rank;
    box.querySelector('#osu-result-rank').style.color = OSU.rankColor(rank);
    box.querySelector('#osu-result-title').textContent = failed ? 'FAILED' : 'RESULT';
    var cnt = S.counts;
    var pp = OSU.pp(S.chart);
    var stars = OSU.starRating(S.chart);
    var stdJudge = OSU.usesStdJudge && OSU.usesStdJudge();
    var cntAll = stdJudge ? {
      GREAT: cnt.GREAT || 0, OK: cnt.OK || 0, MEH: cnt.MEH || 0,
      MISS: (cnt.MISS || 0) + (cnt.BREAK || 0)
    } : {
      PERFECT: cnt.PERFECT || 0, GREAT: cnt.GREAT || 0, GOOD: cnt.GOOD || 0,
      OK: cnt.OK || 0, MEH: cnt.MEH || 0, MISS: (cnt.MISS || 0) + (cnt.BREAK || 0)
    };
    var totalJ = Object.keys(cntAll).reduce(function (a, k) { return a + cntAll[k]; }, 0) || 1;
    var distCol = stdJudge
      ? { GREAT: '#ff66aa', OK: '#ffd166', MEH: '#9a9a9a', MISS: '#ff4d6d' }
      : { PERFECT: '#7ce0ff', GREAT: '#8ee36b', GOOD: '#ffd866', OK: '#ffa94d', MEH: '#ff8787', MISS: '#ff4d6d' };
    var distBar = '<div class="osu-res-dist">' +
      Object.keys(cntAll).filter(function (k) { return cntAll[k] > 0; }).map(function (k) {
        return '<span style="width:' + (cntAll[k] / totalJ * 100).toFixed(2) + '%;background:' + distCol[k] + '"></span>';
      }).join('') + '</div>';
    var distLegend = '<div class="osu-res-dist-legend">' + Object.keys(cntAll).map(function (k) {
      return '<i style="color:' + distCol[k] + '">' + k + ' ' + cntAll[k] + '</i>';
    }).join('') + '</div>';

    box.querySelector('#osu-result-stats').innerHTML =
      '<div class="osu-res-score" data-to="' + S.score + '">' + U.fmt(S.score) + '</div>' +
      '<div class="osu-res-ppline"><b class="osu-res-pp">' + pp + '</b> pp <small>EST</small>' +
        '<span class="osu-res-stars">★ ' + stars.toFixed(1) + '</span></div>' +
      '<div class="osu-res-acc">' + acc.toFixed(2) + '% <small>ACC</small></div>' +
      '<div class="osu-res-grid' + (stdJudge ? ' is-std' : '') + '">' +
      (stdJudge
        ? '<div><b>' + (cnt.GREAT || 0) + '</b><span>GREAT</span></div>' +
          '<div><b>' + (cnt.OK || 0) + '</b><span>OK</span></div>' +
          '<div><b>' + (cnt.MEH || 0) + '</b><span>MEH</span></div>' +
          '<div><b>' + ((cnt.MISS || 0) + (cnt.BREAK || 0)) + '</b><span>MISS</span></div>'
        : '<div><b>' + (cnt.PERFECT || 0) + '</b><span>PERFECT</span></div>' +
          '<div><b>' + (cnt.GREAT || 0) + '</b><span>GREAT</span></div>' +
          '<div><b>' + (cnt.GOOD || 0) + '</b><span>GOOD</span></div>' +
          '<div><b>' + (cnt.OK || 0) + '</b><span>OK</span></div>' +
          '<div><b>' + (cnt.MEH || 0) + '</b><span>MEH</span></div>' +
          '<div><b>' + ((cnt.MISS || 0) + (cnt.BREAK || 0)) + '</b><span>MISS</span></div>') +
      '</div>' +
      distBar + distLegend +
      '<div class="osu-res-sub">max combo ' + S.maxCombo + ' · ' + (modIds().join('') || 'NM') + ' · SCORE V2</div>';
    rollScore(box.querySelector('.osu-res-score'), S.score);
    /* ---- PB、本地排行榜、成绩卡、成就 ---- */
    var key = chartKey();
    var pbs = readJson(PB_KEY_(), {});
    var prev = pbs[key];
    var isPB = !failed && (!prev || S.score > prev.score);
    if (isPB) {
      pbs[key] = {
        score: S.score, acc: acc, rank: rank, combo: S.maxCombo,
        stars: stars, pp: pp, mode: S.mode, at: Date.now()
      };
      writeJson(PB_KEY_(), pbs);
    }

    var board = readJson(BOARD_KEY_(), []);
    if (!failed) {
      board.push({
        key: key, title: (S.chart && S.chart.title) || '', ver: (S.chart && S.chart.version) || '',
        mode: S.mode, score: S.score, acc: acc, rank: rank, combo: S.maxCombo, at: Date.now()
      });
      board.sort(function (a, b) { return b.score - a.score; });
      board = board.slice(0, 30);
      writeJson(BOARD_KEY_(), board);
    }
    /* osu! 本地个人成绩历史：包含失败局，按谱面保存最近 100 次记录。 */
    var history = readJson(HISTORY_KEY_(), []);
    history.unshift({ key: key, title: (S.chart && S.chart.title) || '', ver: (S.chart && S.chart.version) || '',
      mode: S.mode, score: S.score, acc: acc, rank: rank, combo: S.maxCombo, failed: !!failed,
      mods: modIds().join('') || 'NM', at: Date.now() });
    history = history.slice(0, 100);
    writeJson(HISTORY_KEY_(), history);

    var extra = document.getElementById('osu-result-extra');
    if (extra) {
      var best = pbs[key];
      var top = board.filter(function (r) { return r.key === key; }).slice(0, 5);
      var html = '<div class="osu-res-pb' + (isPB ? ' new' : '') + '">' +
        '<span>BEST</span><b>' + (best ? U.fmt(best.score) : '—') + '</b>' +
        '<em>' + (best ? best.acc.toFixed(2) + '% · ' + best.rank : '') + '</em>' +
        (isPB ? '<i>NEW RECORD</i>' : '') + '</div>';
      if (top.length > 1) {
        html += '<div class="osu-res-board"><span>LOCAL TOP</span>';
        top.forEach(function (r, i) {
          html += '<div class="osu-res-row"><b>#' + (i + 1) + '</b><em>' + U.fmt(r.score) +
            '</em><i>' + r.acc.toFixed(2) + '% · ' + r.rank + '</i></div>';
        });
        html += '</div>';
      }
      var recent = history.filter(function (r) { return r.key === key; }).slice(0, 5);
      if (recent.length) {
        html += '<div class="osu-res-board osu-res-history"><span>RECENT PLAYS</span>';
        recent.forEach(function (r, i) {
          var when = new Date(r.at);
          var dateLabel = when.toLocaleDateString() + ' ' + when.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
          html += '<div class="osu-res-row"><b>' + (i + 1) + '</b><em>' + U.fmt(r.score) +
            '</em><i>' + r.acc.toFixed(2) + '% · ' + r.rank + (r.failed ? ' · FAIL' : '') +
            ' · ' + r.mods + ' · ' + dateLabel + '</i></div>';
        });
        html += '</div>';
      }
      extra.innerHTML = html;
    }

    if (window.LZXAch && !failed) {
      window.LZXAch.bump('osu-play', 1, 'osu-10-play', 10);
      if (rank === 'SS' || rank === 'SS+' || rank === 'X' || rank === 'XH') window.LZXAch.unlock('osu-ss');
      else if (rank === 'S' || rank === 'SH') window.LZXAch.unlock('osu-s');
    }

    /* 回放按钮：只有这次成绩刚好对应刚录下的回放时才亮 */
    var rpBtn = document.getElementById('osu-btn-replay');
    if (rpBtn) {
      var canReplay = !!(OSU.replay && OSU.replay.matches(S.score, (S.chart && S.chart.title) || ''));
      rpBtn.hidden = !canReplay;
      if (canReplay && !rpBtn.__bound) {
        rpBtn.__bound = 1;
        rpBtn.addEventListener('click', function () { OSU.replay.play(0); });
      }
    }

    UI.showView('result');
    OSU.log('FINISH // ' + rank + ' · ' + acc.toFixed(2) + '%');
  };

  /* 成绩卡：画成 1200×630 的分享图，直接下载 */
  UI.makeScoreCard = function () {
    var acc = OSU.acc();
    var rank = OSU.rankOf(acc, S.failed);
    var c = S.chart || {};
    var cv = document.createElement('canvas');
    cv.width = 1200; cv.height = 630;
    var g = cv.getContext('2d');
    var bg = g.createLinearGradient(0, 0, 1200, 630);
    bg.addColorStop(0, '#0a0612'); bg.addColorStop(.55, '#160a26'); bg.addColorStop(1, '#20102f');
    g.fillStyle = bg; g.fillRect(0, 0, 1200, 630);
    g.strokeStyle = 'rgba(138,43,226,.65)'; g.lineWidth = 3; g.strokeRect(24, 24, 1152, 582);
    g.fillStyle = '#8a2be2'; g.fillRect(24, 24, 1152, 6);

    g.fillStyle = 'rgba(255,255,255,.55)';
    g.font = '500 22px ui-monospace, monospace';
    g.fillText('LOOPZLX · osu! RESULT', 64, 96);

    g.fillStyle = '#fff';
    g.font = '700 62px system-ui, sans-serif';
    g.fillText(String(c.title || 'Untitled').slice(0, 22), 64, 178);
    g.fillStyle = 'rgba(255,255,255,.6)';
    g.font = '400 26px ui-monospace, monospace';
    g.fillText('[' + String(c.version || '') + ']  ·  ' + (c.artist || '') + '  ·  ' + (S.mode || 'std').toUpperCase(), 64, 216);

    var rc = OSU.rankColor(rank);
    g.fillStyle = rc;
    g.font = '800 190px ui-monospace, monospace';
    g.fillText(rank, 860, 350);
    g.strokeStyle = rc; g.lineWidth = 4;
    g.beginPath(); g.arc(930, 268, 118, 0, Math.PI * 2); g.stroke();

    var rows = [
      ['SCORE', U.fmt(S.score)],
      ['ACCURACY', acc.toFixed(2) + '%'],
      ['MAX COMBO', String(S.maxCombo) + 'x'],
      ['PP', String(OSU.pp(c)) + ' EST']
    ];
    rows.forEach(function (r, i) {
      var y = 372 + i * 58;
      g.fillStyle = 'rgba(255,255,255,.45)'; g.font = '400 20px ui-monospace, monospace';
      g.fillText(r[0], 64, y);
      g.fillStyle = '#fff'; g.font = '600 36px ui-monospace, monospace';
      g.fillText(r[1], 260, y);
    });

    g.fillStyle = 'rgba(255,255,255,.34)'; g.font = '400 18px ui-monospace, monospace';
    g.fillText('mods ' + ((typeof modIds === 'function' ? modIds().join('') : '') || 'NM') +
      '  ·  ' + new Date().toLocaleString(), 64, 596);

    try {
      var a = document.createElement('a');
      a.href = cv.toDataURL('image/png');
      a.download = 'osu-result-' + (c.title || 'score').replace(/[^\w一-龥-]+/g, '_') + '.png';
      a.click();
      OSU.log('CARD // 成绩卡已导出');
    } catch (e) { OSU.log('CARD // 导出失败'); }
  };

  UI.showCountdown = function (n) {
    var el = $('osu-countdown');
    if (!el) return;
    if (!n) { el.classList.remove('is-on', 'beat'); el.textContent = ''; return; }
    /* 学 osu! 的 resume 倒计时：大数字 + 下方一行小字，数字本身做"放大→收缩→淡出" */
    el.innerHTML = '<span class="cd-num">' + n + '</span><span class="cd-label">' +
      t('pause.countdown', 'resume') + '</span>';
    el.classList.add('is-on');
    el.classList.remove('beat');
    void el.offsetWidth;
    el.classList.add('beat');
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
  UI.addChart = function (charts, audioBlob, bgBlob, bgUrl, zipName) {
    var head = charts[0];
    var item = {
      id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      demo: false, mode: head.mode, title: head.title, artist: head.artist,
      creator: head.creator, charts: charts, dl: 0,
      audioBlob: audioBlob || null, bgBlob: bgBlob || null, bgUrl: bgUrl || null,
      zipName: zipName || ''
    };
    library.push(item);
    OSU.bm.storeItem(item);
    OSU.log('IMPORT // ' + head.title + ' [' + head.mode + '] · ' + charts.length + ' diff(s) · ' + head.objects.length + ' objects');
    return item;
  };

  UI.openImport = function () {
    var inp = $('osu-file');
    if (inp) inp.click();
  };

  var pendingSelectVersion = null;
  UI.handleFiles = function (files) {
    var list = Array.prototype.slice.call(files || []).filter(function (f) { return f && /\.(osz|osu)$/i.test(f.name); });
    if (!list.length) { UI.toast('请选择 .osz 或 .osu 文件'); return; }
    var packages = list.filter(function (f) { return /\.osz$/i.test(f.name); });
    var singles = list.filter(function (f) { return /\.osu$/i.test(f.name); });
    var sharedAudio = Array.prototype.slice.call(files || []).filter(function (f) { return /\.(mp3|ogg|wav|m4a)$/i.test(f.name); });
    UI.loading(true, 'IMPORTING ' + list.length + ' FILE(S)…');
    var imported = 0, errors = [];
    var tasks = packages.map(function (file) {
      var read = OSU.bm.readOsz(file);
      return Promise.race([read, new Promise(function (_, reject) { setTimeout(function(){ reject(new Error('导入超时')); }, 30000); })])
        .then(function (r) { return finish(r.osuTexts || [r.osuText], r.audioBlob, r.bgBlob, file.name, r.osuNames); })
        .catch(function (e) { errors.push(file.name + ': ' + (e.message || 'failed')); });
    });
    singles.forEach(function (file) {
      tasks.push(new Promise(function (resolve) {
        var fr = new FileReader();
        fr.onload = function () { finish([String(fr.result)], sharedAudio[0] || null, null, file.name).then(resolve); };
        fr.onerror = function () { errors.push(file.name + ': read failed'); resolve(); };
        fr.readAsText(file);
      }));
    });
    return Promise.all(tasks).then(function () {
      UI.loading(false);
      if (imported) UI.toast('导入完成 · ' + imported + ' 个谱面集' + (errors.length ? ' · ' + errors.length + ' 个失败' : ''));
      else UI.toast(errors.join(' / ') || '没有可导入的有效谱面');
      if (errors.length) OSU.log('IMPORT WARN // ' + errors.join(' | '));
    }).catch(function(e){ UI.loading(false); UI.toast('导入异常：'+(e.message||e)); });

    function finish(texts, audioBlob, bgBlob, name, names) {
      return Promise.resolve().then(function () {
        var parsed = [];
        (texts || []).forEach(function (t, idx) {
          var fallback = names && names[idx] ? String(names[idx]).replace(/\.osu$/i, '').replace(/^.*?\s*[-–]\s*/, '').replace(/^map[_\s-]*/i, '') : '';
          try { var chart = OSU.bm.parseOsu(t, fallback); if (chart.objects.length) parsed.push(chart); } catch (e) { OSU.log('PARSE WARN // ' + (name || '') + ' · ' + e.message); }
        });
        if (!parsed.length) { errors.push((name || 'file') + ': no valid hitobjects'); return; }
        /* 单次导入保持同一游戏模式，避免把跨模式混合包错误混在一张列表里 */
        var mode = parsed[0].mode;
        var charts = parsed.filter(function (c) { return c.mode === mode; });
        var seen = Object.create(null);
        charts = charts.filter(function (c) { var key = c.version + '|' + c.objects.length; if (seen[key]) return false; seen[key] = 1; return true; });
        charts.sort(function (a, b) { return a.objects.length - b.objects.length; });
        var signature = [charts[0].title, charts[0].artist, charts[0].creator, charts.map(function (c) { return c.version; }).join(',')].join('|').toLowerCase();
        if (library.some(function (it) { return [it.title,it.artist,it.creator,(it.charts || []).map(function (c) { return c.version; }).join(',')].join('|').toLowerCase() === signature; })) {
          errors.push((name || charts[0].title) + ': already imported'); return;
        }
        var bgUrl = bgBlob ? URL.createObjectURL(bgBlob) : null;
        var item = UI.addChart(charts, audioBlob, bgBlob, bgUrl, name);
        imported++;
        if (window.LZXAch) window.LZXAch.unlock('osu-import');
        if (audioBlob) OSU.audio.decode(audioBlob).then(function (buf) { item.bufferRef = buf; charts.forEach(function (c) { c.song = { bufferRef: buf }; }); }).catch(function () {});
        UI.setBrowsedMode(mode); selected = item; if (pendingSelectVersion) { var pv = pendingSelectVersion; pendingSelectVersion = null; var pi = charts.findIndex(function (cc) { return cc.version === pv; }); if (pi >= 0) selected.dl = pi; } UI.showView('select');
        if (window.OSU && OSU.i18n) OSU.i18n.apply();
      });
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
    function (q, m, o) { return 'https://osu.direct/api/v2/search?query=' + encodeURIComponent(q) + '&m=' + m + '&limit=24&offset=' + (o || 0); },
    function (q, m, o) { return 'https://api.nerinyan.moe/search?q=' + encodeURIComponent(q) + '&m=' + m; },
    function (q, m, o) { return 'https://catboy.best/api/v2/search?query=' + encodeURIComponent(q) + '&m=' + m + '&limit=24&offset=' + (o || 0); },
    function (q, m, o) { return 'https://osu.direct/api/search?q=' + encodeURIComponent(q) + '&m=' + m; }
  ];

  /* 带超时的 fetch：某个镜像挂住时不要在搜索页干等 */
  function timedFetch(url, ms) {
    var ctrl = ('AbortController' in window) ? new AbortController() : null;
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        if (ctrl) ctrl.abort();
        reject(new Error('timeout'));
      }, ms || 6000);
      fetch(url, ctrl ? { signal: ctrl.signal } : {}).then(function (r) {
        clearTimeout(timer);
        r.ok ? resolve(r) : reject(new Error('http ' + r.status));
      }).catch(function (e) { clearTimeout(timer); reject(e); });
    });
  }
  var MODE_NUM = { std: 0, taiko: 1, catch: 2, mania: 3 };

  var seenIds = {};
  var webMode = 3;      /* 下载页当前模式：0 std / 1 taiko / 2 catch / 3 mania */
  var webStatus = 'all'; /* all / ranked / loved / qualified / pending / graveyard / wip */
  var webSort = 'relevance';
  var searchOffset = 0, searchQ = '', searchTotal = 0, searchSeq = 0;

  UI.setWebMode = function (m) {
    webMode = m;
    searchOffset = 0;
    var row = $('osu-web-modes');
    if (row) row.querySelectorAll('[data-wmode]').forEach(function (b) {
      b.classList.toggle('is-on', Number(b.getAttribute('data-wmode')) === m);
    });
    UI.search($('osu-search-input') ? $('osu-search-input').value.trim() : '');
  };

  UI.setWebStatus = function (st) {
    webStatus = st || 'all';
    var tabs = document.querySelectorAll('.osu-web-tabs [data-wtab]');
    Array.prototype.forEach.call(tabs, function (t) {
      t.classList.toggle('is-on', t.getAttribute('data-wtab') === webStatus);
    });
    searchOffset = 0;
    UI.search($('osu-search-input') ? $('osu-search-input').value.trim() : '');
  };

  function esc(str) {
    return String(str == null ? '' : str).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
    });
  }

  function t(k, fb) { return OSU.i18n ? OSU.i18n.t(k) : fb; }

  function ensureSetModal() {
    var m = document.getElementById('osu-set-modal'); if (m) return m;
    m = document.createElement('div'); m.id = 'osu-set-modal'; m.className = 'osu-set-modal';
    m.innerHTML = '<div class="osu-set-modal-backdrop"></div><section class="osu-set-modal-panel" role="dialog" aria-modal="true"><button class="osu-set-modal-close" aria-label="Close">×</button><div class="osu-set-modal-content"></div></section>';
    document.body.appendChild(m);
    m.querySelector('.osu-set-modal-backdrop').addEventListener('click', function(){m.classList.remove('is-open');});
    m.querySelector('.osu-set-modal-close').addEventListener('click', function(){m.classList.remove('is-open');});
    return m;
  }
  function valAny(obj, keys, fallback) { for (var i=0;i<keys.length;i++) if (obj && obj[keys[i]] != null) return obj[keys[i]]; return fallback; }
  function fmtDuration(sec) { sec=Number(sec)||0; return Math.floor(sec/60)+':'+('0'+Math.floor(sec%60)).slice(-2); }
  function openSetDetails(set) {
    var modal=ensureSetModal(), body=modal.querySelector('.osu-set-modal-content'), id=valAny(set,['id','SetID','SetId'],'?');
    var title=valAny(set,['title','Title'],'Unknown'), artist=valAny(set,['artist','Artist'],'');
    var maps=Array.isArray(set.beatmaps)?set.beatmaps.slice():[];
    body.innerHTML='<div class="osu-set-modal-title">'+esc(title)+'</div><div class="osu-set-modal-sub">'+esc(artist)+' · mapped by '+esc(valAny(set,['creator','Creator'],'—'))+' · #'+esc(id)+'</div><div class="osu-set-modal-state">Loading full beatmap details…</div><div class="osu-set-modal-diffs"></div><div class="osu-set-modal-actions"><button class="osu-set-download-all">DOWNLOAD FULL SET (.OSZ)</button><button class="osu-set-download-selected" disabled>IMPORT SELECTED DIFFICULTY</button></div>';
    modal.classList.add('is-open'); var chosen=null;
    function draw() {
      var list=body.querySelector('.osu-set-modal-diffs'); list.innerHTML='';
      if (!maps.length) {list.innerHTML='<div class="osu-set-modal-state">No difficulty metadata returned.</div>';return;}
      maps.sort(function(a,b){return Number(a.difficulty_rating||a.stars||0)-Number(b.difficulty_rating||b.stars||0);});
      maps.forEach(function(bm){var name=valAny(bm,['version','difficulty_name','name'],'Difficulty'); var stars=valAny(bm,['difficulty_rating','star_rating','stars'],null); var stats=bm.cs!=null||bm.ar!=null||bm.accuracy!=null||bm.drain!=null;
        var status=valAny(bm,['status'],valAny(set,['status'],'unknown'));
        var row=document.createElement('button');row.className='osu-set-diff-row'+(chosen===bm?' is-selected':'');
        row.innerHTML='<div class="osu-set-diff-name">'+esc(name)+'<small>'+esc(status)+'</small></div><div class="osu-set-diff-star">★ '+(stars==null?'—':Number(stars).toFixed(2))+'</div><div class="osu-set-diff-stats">CS '+esc(valAny(bm,['cs','circle_size'],'—'))+' · AR '+esc(valAny(bm,['ar','approach_rate'],'—'))+' · OD '+esc(valAny(bm,['accuracy','od'],'—'))+' · HP '+esc(valAny(bm,['drain','hp'],'—'))+'</div><div class="osu-set-diff-stats">'+esc(valAny(bm,['bpm'],'—'))+' BPM · '+fmtDuration(valAny(bm,['total_length','length'],'0'))+'</div>';
        row.addEventListener('click',function(){chosen=bm;list.querySelectorAll('.osu-set-diff-row').forEach(function(r){r.classList.remove('is-selected');});row.classList.add('is-selected');body.querySelector('.osu-set-download-selected').disabled=false;});list.appendChild(row);
      });
      body.querySelector('.osu-set-modal-state').textContent=maps.length+' difficulties · details from search provider';
    }
    draw();
    // Fetch an expanded set payload where the provider supports it.
    var detailUrls=['https://osu.direct/api/v2/beatmapsets/'+id,'https://api.nerinyan.moe/beatmapsets/'+id];
    if(!maps.length){(function tryDetail(i){if(i>=detailUrls.length)return;timedFetch(detailUrls[i],6500).then(function(r){return r.json();}).then(function(d){var expanded=d.beatmapset||d; if(expanded.beatmaps&&expanded.beatmaps.length){maps=expanded.beatmaps;draw();}}).catch(function(){tryDetail(i+1);});})(0);}
    body.querySelector('.osu-set-download-all').addEventListener('click',function(){modal.classList.remove('is-open');UI.downloadSet(id,title);});
    body.querySelector('.osu-set-download-selected').addEventListener('click',function(){if(!chosen)return;pendingSelectVersion=valAny(chosen,['version','difficulty_name','name'],'');modal.classList.remove('is-open');UI.downloadSet(id,title+' · '+pendingSelectVersion);});
  }

  UI.search = function (q, isMore) {
    var out = $('osu-search-results');
    var st = $('osu-download-status');
    if (!out) return;
    q = q || '';
    if (!isMore) { searchQ = q; searchOffset = 0; searchTotal = 0; searchSeq++; }
    var seq = searchSeq;

    /* 纯数字：直接按谱面集 ID 下载，跳过搜索 */
    if (/^\d+$/.test(q)) {
      out.innerHTML = '<div class="osu-empty">' + t('dl.direct', 'DIRECT DOWNLOAD · SET') + ' #' + esc(q) + '</div>';
      UI.downloadSet(Number(q), 'Set #' + q);
      return;
    }

    if (!isMore) out.innerHTML = '<div class="osu-empty">' + t('dl.searching', 'SEARCHING…') + '</div>';
    var urls = SEARCH_API.map(function (f) { return f(searchQ, webMode, searchOffset); });

    function attempt(i) {
      if (i >= urls.length) {
        if (seq !== searchSeq) return;
        if (!isMore) out.innerHTML = '<div class="osu-empty">' + t('dl.unreachable', 'mirrors unreachable') + '</div>';
        if (st) st.textContent = '';
        return;
      }
      timedFetch(urls[i], 7000).then(function (r) { return r.json(); })
        .then(function (data) {
          if (seq !== searchSeq) return;
          var sets = Array.isArray(data) ? data : (data.beatmapsets || data.sets || data.results || data.data || data.items || (data.result && data.result.beatmapsets) || []);
          if (!Array.isArray(sets)) sets = [];
          if (sets.length && sets[0].beatmapset) sets = sets.map(function(x){return x.beatmapset;});
          if (!sets.length && i < urls.length - 1) { attempt(i + 1); return; }
          render(sets);
        })
        .catch(function (err) {
          if (window.console && console.warn) console.warn('[osu.search] mirror ' + i + ' failed:', err && (err.message || err));
          attempt(i + 1);
        });
    }
    attempt(0);

    function render(sets) {
      if (seq !== searchSeq) return;
      var rawLen = sets.length;
      /* Status filter + local sort; mirrors may not implement identical query params. */
      var statusAliases = { ranked: ['ranked','approved'], loved: ['loved'], qualified: ['qualified'], pending: ['pending'], graveyard: ['graveyard'], wip: ['wip','work in progress'] };
      if (webStatus !== 'all') sets = sets.filter(function (s) {
        var stt = String(s.status || (s.beatmaps && s.beatmaps[0] && s.beatmaps[0].status) || '').toLowerCase();
        if (!stt && s.ranked) stt = 'ranked';
        return !stt || (statusAliases[webStatus] || []).indexOf(stt) >= 0;
      });
      var sortVal = webSort;
      if (sortVal !== 'relevance') sets.sort(function (a,b) {
        var titleA=String(a.title||a.Title||''), titleB=String(b.title||b.Title||''), artistA=String(a.artist||a.Artist||''), artistB=String(b.artist||b.Artist||'');
        var bmA=(a.beatmaps||[])[0]||{}, bmB=(b.beatmaps||[])[0]||{};
        if(sortVal==='title') return titleA.localeCompare(titleB);
        if(sortVal==='artist') return artistA.localeCompare(artistB)||titleA.localeCompare(titleB);
        if(sortVal==='stars') return Number(b.star_rating||b.stars||bmB.difficulty_rating||0)-Number(a.star_rating||a.stars||bmA.difficulty_rating||0);
        if(sortVal==='bpm') return Number(b.bpm||bmB.bpm||0)-Number(a.bpm||bmA.bpm||0);
        if(sortVal==='updated') return String(b.last_updated||b.updated_at||'').localeCompare(String(a.last_updated||a.updated_at||''));
        if(sortVal==='newest') return Number(b.id||b.SetID||0)-Number(a.id||a.SetID||0);
        return 0;
      });
      if (!isMore) { out.innerHTML = ''; seenIds = {}; }
      if (!sets.length) { if (!isMore) out.innerHTML = '<div class="osu-empty">' + t('dl.noresult', 'NO RESULTS') + '</div>'; return; }
      /* 分页请求有镜像会重复返回同一批，这里按 id 去重，避免"加载更多"刷出一堆一样的卡 */
      var fresh = sets.filter(function (s2) {
        var key2 = (s2.id || s2.SetID || '') + '|' + (s2.title || '');
        if (seenIds[key2]) return false;
        seenIds[key2] = 1; return true;
      });
      if (isMore && !fresh.length) {
        UI.toast(t('dl.nomore', '没有更多了'));
        var oldMore = out.querySelector('.osu-more');
        if (oldMore) oldMore.remove();
        if (st) st.textContent = searchTotal + ' sets';
        return;
      }
      searchOffset += rawLen;
      sets = fresh;
      searchTotal += sets.length;
      var modeIcon = ['◯', '◐', '❥', '▤'][webMode] || '▤';
      sets.forEach(function (s) {
        var title = s.title || s.Title || '?';
        var artist = s.artist || s.Artist || '';
        var creator = s.creator || s.Creator || '';
        var id = s.id || s.SetID || s.SetId;
        var MODE_NAME = ['osu', 'taiko', 'fruits', 'mania'][webMode] || 'osu';
        var bms = s.beatmaps || [];
        var pick = null;
        for (var bi = 0; bi < bms.length; bi++) { if (bms[bi].mode === MODE_NAME) { pick = bms[bi]; break; } }
        if (!pick && bms.length) pick = bms[0];
        var stars = s.star_rating || s.stars || (pick && pick.difficulty_rating) || null;
        var cover = (s.covers && (s.covers.card || s.covers.list || s.covers.cover)) || '';
        var secs = s.length_total || s.total_length || (pick && pick.total_length) || 0;
        var len = secs ? Math.floor(secs / 60) + ':' + ('0' + Math.floor(secs % 60)).slice(-2) : '';
        var bpm = s.bpm || (pick && pick.bpm) || 0;
        var ranked = !!(s.ranked || s.status === 'ranked' || s.status === 'approved' || (pick && pick.status === 'ranked'));

        var card = document.createElement('div');
        card.className = 'osu-web-card';
        card.innerHTML =
          '<div class="osu-web-cover" style="' + (cover
            ? 'background-image:url(' + JSON.stringify(cover).replace(/"/g, '') + ');'
            : 'background:linear-gradient(135deg,' + (C.MODE_COLOR[['std','taiko','catch','mania'][webMode]] || '#8a2be2') + ',rgba(0,0,0,.35));') + '">' +
            (cover ? '' : '<span>' + modeIcon + '</span>') +
            '<b class="cover-stars">' + (stars ? '★ ' + Number(stars).toFixed(1) : '') + '</b>' +
          '</div>' +
          '<div class="osu-web-meta">' +
            '<div class="w-title">' + esc(title) + '</div>' +
            '<div class="w-artist">by ' + esc(artist) + '</div>' +
            '<div class="w-mapper">mapped by ' + esc(creator || '—') + '</div>' +
          '</div>' +
          '<div class="osu-web-tags"><span class="w-mode">' + (['osu!', 'taiko', 'catch', 'mania'][webMode]) + '</span>' +
            (len ? '<em>' + len + '</em>' : '') + (bpm ? '<em>' + bpm + ' BPM</em>' : '') +
            (ranked ? '<em class="w-ranked">RANKED</em>' : '<em class="w-status">' + esc(String(s.status || (pick && pick.status) || 'UNKNOWN').toUpperCase()) + '</em>') + (bms.length ? '<em>' + bms.length + ' difficulties</em>' : '') + '</div>' +
          '<button class="osu-web-dl" title="下载 .osz">' + (OSU.i18n ? OSU.i18n.t('dl.download') : 'DOWNLOAD') + '</button>';
        card.addEventListener('click', function (ev) { if (ev.target.closest('.osu-web-dl')) return; openSetDetails(s); });
        card.querySelector('.osu-web-dl').addEventListener('click', function (ev) { ev.stopPropagation(); openSetDetails(s); });
        out.appendChild(card);
      });

      /* 加载更多：结果满了 25 条就给下一页 */
      var more = out.querySelector('.osu-more');
      if (more) more.remove();
      if (sets.length >= 20) {
        var mb = document.createElement('button');
        mb.className = 'osu-btn osu-more';
        mb.textContent = t('dl.more', 'Load more');
        mb.addEventListener('click', function () {
          UI.search(searchQ, true);
        });
        out.appendChild(mb);
      }
      if (st) st.textContent = searchTotal + ' sets';
    }
  };

  UI.downloadSet = function (id, title) {
    var st = $('osu-download-status');
    if (st) st.textContent = 'DOWNLOADING #' + id + ' …';
    var urls = [
      'https://osu.direct/api/d/' + id,
      'https://api.nerinyan.moe/d/' + id,
      'https://catboy.best/d/' + id
    ];
    var i = 0;
    function next() {
      if (i >= urls.length) { if (st) st.textContent = '下载失败 · FAILED'; return; }
      var u = urls[i++];
      timedFetch(u, 18000).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.blob();
      }).then(function (blob) {
        var file = new File([blob], 'beatmapset-' + id + '.osz', { type: 'application/zip' });
        return UI.handleFiles([file]).then(function(){ if (st) st.textContent = 'OK · ' + title; });
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
      UI.toast(t('set.keysreset', '键位已重置'));
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
    status.textContent = '' + t('calib.tap', '跟着节拍敲击（空格 / 点击）…') + '';
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
    calib.avg = avg;
    var box = $('osu-calib');
    if (box) box.querySelector('.calib-status').textContent = t('calib.avg', '平均偏移') + ' ' + Math.round(avg) + ' ms (' + calib.beats.length + 'x)';
  };

  UI.applyCalib = function () {
    if (!calib.beats.length) { UI.toast(t('calib.tap', '先跟着节拍敲几下')); return; }
    /* 正常人不会偏 120ms 以上，超出多为脚本/输入延迟异常，钳一下防止把判定带偏 */
    var v = Math.max(-120, Math.min(120, Math.round(calib.avg * 10) / 10));
    OSU.settings.set('hitOffset', v);
    UI.toast(t('calib.applied', '偏移已应用') + ' ' + v + ' ms');
  };

  UI.clearCalib = function () {
    OSU.settings.set('hitOffset', 0);
    UI.toast(t('calib.cleared', '偏移已清零'));
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
    UI.loadLibrary();

    on($('osu-mode-cards'), 'click', function (e) {
      var card = e.target.closest('.osu-mode-card');
      if (!card) return;
      viewMode = card.dataset.mode;
      OSU.log('MODE // ' + C.MODE_CN[viewMode]);
      UI.showView('select');
    });

    on($('osu-btn-play'), 'click', function () { UI.showView('select'); });
    on($('osu-nowplaying'), 'click', function () { viewMode = viewMode || 'mania'; UI.showView('select'); });
    on($('osu-btn-settings'), 'click', function () { UI.showView('settings'); });
    on($('osu-btn-download'), 'click', function () {
      UI.showView('download');
      UI.setWebMode(MODE_NUM[viewMode] == null ? 3 : MODE_NUM[viewMode]);
    });
    on($('osu-btn-import'), 'click', UI.openImport);
    on($('osu-file'), 'change', function (e) { UI.handleFiles(e.target.files); e.target.value = ''; });
    var dropArea = $('osu-select');
    if (dropArea) { on(dropArea, 'dragover', function (e) { e.preventDefault(); dropArea.classList.add('osu-drop-active'); }); on(dropArea, 'dragleave', function (e) { if (!dropArea.contains(e.relatedTarget)) dropArea.classList.remove('osu-drop-active'); }); on(dropArea, 'drop', function (e) { e.preventDefault(); dropArea.classList.remove('osu-drop-active'); UI.handleFiles(e.dataTransfer.files); }); }
    on($('osu-btn-start'), 'click', function () {
      stopPreview();
      if (!selected) return;
      var c = UI.curChart();
      if (!c) return;
      if (selected.bufferRef) c.song = { bufferRef: selected.bufferRef };
      else if (selected.audioBlob && !c.song) {
        UI.loading(true, 'DECODING AUDIO…');
        OSU.audio.decode(selected.audioBlob).then(function (buf) {
          selected.bufferRef = buf;
          c.song = { bufferRef: buf };
          UI.loading(false);
          recordPlay(selected, c);
          OSU.game.start(c, c.mode);
        }).catch(function () {
          UI.loading(false);
          recordPlay(selected, c);
          OSU.game.start(c, c.mode);
        });
        return;
      }
      recordPlay(selected, c);
      OSU.game.start(c, c.mode);
    });

    on($('osu-btn-pause'), 'click', function () { OSU.game.pause(); });
    on($('osu-btn-quit'), 'click', function () { OSU.game.quit(); });
    on($('osu-pause-resume'), 'click', function () { OSU.game.resume(); });
    on($('osu-pause-retry'), 'click', function () { OSU.game.resume(); OSU.game.start(S.chart, S.mode); });
    on($('osu-pause-menu'), 'click', function () { OSU.game.quit(); });
    on($('osu-btn-retry'), 'click', function () { OSU.game.start(S.chart, S.mode); });
    on($('osu-btn-card'), 'click', function () { UI.makeScoreCard(); });
    on($('osu-btn-tomenu'), 'click', function () { UI.showView('menu'); });
    on($('osu-settings-back'), 'click', function () { UI.showView('menu'); });
    on($('osu-btn-calib'), 'click', UI.startCalib);
    /* 校准：面板打开时点脉冲 / 按空格都算一击（之前只定义了 calibTap，没人调用） */
    var calibBox = $('osu-calib');
    on(calibBox, 'click', function (e) {
      if (!calibBox.classList.contains('is-on')) return;
      if (e.target.closest('button')) return;
      UI.calibTap();
    });
    document.addEventListener('keydown', function (e) {
      if (!calibBox || !calibBox.classList.contains('is-on')) return;
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyZ' || e.code === 'KeyX') {
        e.preventDefault();
        UI.calibTap();
      }
    });
    on($('osu-btn-calib-apply'), 'click', UI.applyCalib);
    on($('osu-btn-calib-reset'), 'click', UI.clearCalib);
    on($('osu-btn-calib-close'), 'click', UI.closeCalib);
    on($('osu-btn-calib-close'), 'click', UI.closeCalib);
    on($('osu-calib'), 'click', function (e) { if (e.target.id !== 'osu-btn-calib-close') UI.calibTap(); });
    on($('osu-download-back'), 'click', function () { UI.showView('menu'); });
    on($('osu-search-btn'), 'click', function () { UI.search($('osu-search-input').value.trim()); });
    on($('osu-search-input'), 'keydown', function (e) { if (e.key === 'Enter') UI.search(e.target.value.trim()); });
    on($('osu-web-sort'), 'change', function (e) { webSort = e.target.value || 'relevance'; searchOffset = 0; UI.search($('osu-search-input').value.trim()); });
    on(document.querySelector('.osu-web-tabs'), 'click', function (e) {
      var t2 = e.target.closest('[data-wtab]');
      if (t2) UI.setWebStatus(t2.getAttribute('data-wtab'));
    });
    on($('osu-web-modes'), 'click', function (e) {
      var b = e.target.closest('[data-wmode]');
      if (!b) return;
      UI.setWebMode(Number(b.getAttribute('data-wmode')));
    });
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
    on($('osu-preview-toggle'), 'click', togglePreview);
    on($('osu-preview-volume'), 'input', function (e) { if (previewAudio) previewAudio.volume = Number(e.target.value); });
    on($('osu-preview-seek'), 'input', function (e) { if (!previewAudio || !isFinite(previewAudio.duration) || previewAudio.duration <= 0) return; previewSeekDragging = true; var t = previewAudio.duration * Number(e.target.value) / 1000; var cur = $('osu-preview-current'), rem = $('osu-preview-remaining'); if (cur) cur.textContent = previewTime(t); if (rem) rem.textContent = '−' + previewTime(previewAudio.duration - t); });
    on($('osu-preview-seek'), 'change', function (e) { if (previewAudio && isFinite(previewAudio.duration) && previewAudio.duration > 0) previewAudio.currentTime = previewAudio.duration * Number(e.target.value) / 1000; previewSeekDragging = false; updatePreviewProgress(); });
    on($('osu-local-search'), 'input', function () { UI.renderSelect(); });
    on($('osu-local-sort'), 'change', function () { UI.renderSelect(); });
    on($('osu-local-filter'), 'click', function (e) { var b = e.target.closest('[data-local-filter]'); if (!b) return; localFilter = b.dataset.localFilter; this.querySelectorAll('[data-local-filter]').forEach(function (x) { x.classList.toggle('is-on', x === b); }); UI.renderSelect(); });
    on($('osu-mode-row-select'), 'click', function (e) {
      var b = e.target.closest('[data-mode]');
      if (!b) return;
      viewMode = b.dataset.mode;
      if (window.LZXAch) { try { var modes = JSON.parse(localStorage.getItem('lzx.osu.modes') || '{}'); modes[viewMode] = 1; localStorage.setItem('lzx.osu.modes', JSON.stringify(modes)); if (modes.std && modes.taiko && modes.catch && modes.mania) window.LZXAch.unlock('osu-four-modes'); } catch (_) {} }
      $('osu-mode-row-select').querySelectorAll('button').forEach(function (x) { x.classList.toggle('is-on', x === b); });
      UI.renderSelect();
    });
  };

})();
