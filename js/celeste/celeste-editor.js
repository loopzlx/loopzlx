/* celeste-editor.js —— 关卡编辑器
   在覆盖层里就地编辑地形与实体，可保存到本地、导出 JSON、导入 JSON、直接试玩。
   存的是 tile 位图（solid），导出时按行合并成 LEVEL 需要的 rects。 */
(function () {
  'use strict';
  /* 写入 innerHTML 前转义（名称 / 段位 / 币种码等可能来自存档码、分享链接或外部接口） */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  var Celeste = window.Celeste;
  var C = Celeste.C;

  var KEY = 'celeste.custom.v1';

  var TOOLS = [
    { id: 'solid', zh: '地面' },
    { id: 'erase', zh: '橡皮' },
    { id: 'spike', zh: '尖刺' },
    { id: 'spring', zh: '弹簧' },
    { id: 'crystal', zh: '水晶' },
    { id: 'berry', zh: '草莓' },
    { id: 'checkpoint', zh: '检查点' },
    { id: 'spawn', zh: '出生点' },
    { id: 'goal', zh: '终点' }
  ];

  function emptyDoc(w, h) {
    return {
      name: 'CUSTOM',
      w: w, h: h,
      solid: new Uint8Array(w * h),
      ents: { spikes: [], springs: [], crystals: [], berries: [], checkpoints: [] },
      spawn: [5, 35],
      goal: [106, 16]
    };
  }

  /* LEVEL（rects 格式）→ 编辑器文档 */
  function fromLevel(lv) {
    var d = emptyDoc(lv.w, lv.h);
    /* 从内置图起步时换个名字，免得存回去被当成同一张图（PB 会串） */
    d.name = 'MY ' + (lv.name || 'LEVEL');
    (lv.rects || []).forEach(function (r) {
      for (var y = r[1]; y < r[1] + r[3]; y++) {
        for (var x = r[0]; x < r[0] + r[2]; x++) {
          if (x >= 0 && y >= 0 && x < d.w && y < d.h) d.solid[y * d.w + x] = 1;
        }
      }
    });
    d.ents.spikes = (lv.spikes || []).slice();
    d.ents.springs = (lv.springs || []).slice();
    d.ents.crystals = (lv.crystals || []).slice();
    d.ents.berries = (lv.berries || []).slice();
    d.ents.checkpoints = (lv.checkpoints || []).slice();
    if (lv.spawn) d.spawn = [Math.round(lv.spawn[0] / C.TILE), Math.round((lv.spawn[1] + 11) / C.TILE)];
    if (lv.goal) d.goal = lv.goal.slice();
    return d;
  }

  /* 编辑器文档 → LEVEL（行优先合并连续实心格） */
  function toLevel(d) {
    var rects = [];
    for (var y = 0; y < d.h; y++) {
      var x = 0;
      while (x < d.w) {
        if (d.solid[y * d.w + x]) {
          var s = x;
          while (x < d.w && d.solid[y * d.w + x]) x++;
          rects.push([s, y, x - s, 1]);
        } else x++;
      }
    }
    return {
      name: d.name || 'CUSTOM',
      w: d.w, h: d.h,
      spawn: [d.spawn[0] * C.TILE, d.spawn[1] * C.TILE - 11],
      rects: rects,
      spikes: d.ents.spikes.slice(),
      springs: d.ents.springs.slice(),
      crystals: d.ents.crystals.slice(),
      berries: d.ents.berries.slice(),
      checkpoints: d.ents.checkpoints.slice(),
      goal: d.goal.slice()
    };
  }

  /* 序列化（solid 用 0/1 字符串，方便 JSON 体积小） */
  function pack(d) {
    var rows = [];
    for (var y = 0; y < d.h; y++) {
      var s = '';
      for (var x = 0; x < d.w; x++) s += d.solid[y * d.w + x] ? '1' : '0';
      rows.push(s);
    }
    return {
      v: 1, name: d.name, w: d.w, h: d.h, solid: rows,
      ents: d.ents, spawn: d.spawn, goal: d.goal
    };
  }

  function unpack(o) {
    if (!o || !o.w || !o.h) return null;
    var d = emptyDoc(o.w, o.h);
    d.name = o.name || 'CUSTOM';
    d.ents = o.ents || d.ents;
    d.ents.spikes = d.ents.spikes || [];
    d.ents.springs = d.ents.springs || [];
    d.ents.crystals = d.ents.crystals || [];
    d.ents.berries = d.ents.berries || [];
    d.ents.checkpoints = d.ents.checkpoints || [];
    d.spawn = o.spawn || d.spawn;
    d.goal = o.goal || d.goal;
    if (typeof o.solid === 'string') o.solid = o.solid.split('\n');
    if (Array.isArray(o.solid)) {
      for (var y = 0; y < d.h; y++) {
        var row = o.solid[y] || '';
        for (var x = 0; x < d.w; x++) if (row.charAt(x) === '1') d.solid[y * d.w + x] = 1;
      }
    }
    return d;
  }

  var doc = null, tool = 'solid', canvas = null, ctx = null, box = null, undoStack = [], redoStack = [], sel = null;
  var LIB_KEY = 'celeste.lib.v1';
  var hashUsed = false;

  function libRead() { try { return JSON.parse(window.localStorage.getItem(LIB_KEY) || '[]') || []; } catch (e) { return []; } }
  function libWrite(a) { try { window.localStorage.setItem(LIB_KEY, JSON.stringify(a)); } catch (e) {} }

  /* 关卡自检：返回致命问题数组（空 = 可以试玩） */
  function validate(d) {
    var errs = [];
    if (!d) return ['关卡数据为空'];
    var sp = d.spawn;
    if (sp[0] < 1 || sp[0] >= d.w - 1 || sp[1] < 1 || sp[1] >= d.h - 1) errs.push('出生点在边界上或被切掉');
    /* spawn 的 y 是脚下那格（角色站在它上面），所以埋墙判定要看上方两格 */
    var above1 = (sp[1] - 1) >= 0 ? d.solid[(sp[1] - 1) * d.w + sp[0]] : 0;
    var above2 = (sp[1] - 2) >= 0 ? d.solid[(sp[1] - 2) * d.w + sp[0]] : 0;
    if (above1 && above2) errs.push('出生点头顶两格是实心地形，角色会被卡住');
    var belowOk = (sp[1] >= d.h) ? 1 : d.solid[Math.min(d.h - 1, sp[1]) * d.w + sp[0]];
    if (!belowOk) errs.push('出生点脚下没有地面');
    var gl = d.goal;
    if (!gl || gl[0] <= 0 || gl[1] <= 0) errs.push('没有终点');
    /* 终点下方 4 格内要有地面，否则跳上去会直接掉出世界 */
    var ground = false;
    for (var y = gl[1] + 4; y < Math.min(d.h, gl[1] + 9); y++) {
      for (var dx = 0; dx < 4; dx++) {
        if (d.solid[y * d.w + Math.min(d.w - 1, gl[0] + dx)]) { ground = true; break; }
      }
      if (ground) break;
    }
    if (!ground) errs.push('终点下方没有落脚点');
    /* 实体悬空（非地面/尖刺）提示，非致命 */
    var ents = d.ents || {};
    ['springs', 'crystals', 'berries', 'checkpoints'].forEach(function (k) {
      (ents[k] || []).forEach(function (e) {
        if (e[0] < 0 || e[0] >= d.w || e[1] < 0 || e[1] >= d.h) errs.push(k + ' 有实体在地图外');
      });
    });
    return errs;
  }

  function b64e(str) {
    return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64d(s) {
    s = String(s).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return decodeURIComponent(escape(atob(s)));
  }

  function load() {
    doc = null;
    try {
      var raw = window.localStorage.getItem(KEY);
      if (raw) doc = unpack(JSON.parse(raw));
    } catch (e) { doc = null; }
    if (!doc) doc = fromLevel(Celeste.LEVEL);
  }

  function save() {
    try { window.localStorage.setItem(KEY, JSON.stringify(pack(doc))); } catch (e) {}
  }

  function build() {
    box = document.createElement('div');
    box.className = 'cl-edit';
    box.hidden = true;
    box.innerHTML =
      '<div class="cl-edit-bar">' +
        '<span class="cl-edit-brand">LEVEL EDITOR</span>' +
        '<input id="cl-edit-name" class="cl-edit-name" type="text" spellcheck="false" value="CUSTOM">' +
        '<div class="cl-edit-tools"></div>' +
        '<button type="button" class="cl-btn" id="cl-edit-undo">撤销</button>' +
        '<button type="button" class="cl-btn" id="cl-edit-redo">重做</button>' +
        '<button type="button" class="cl-btn" id="cl-edit-play">试玩</button>' +
        '<button type="button" class="cl-btn primary" id="cl-edit-save">保存</button>' +
        '<button type="button" class="cl-btn" id="cl-edit-export">导出 JSON</button>' +
        '<button type="button" class="cl-btn" id="cl-edit-share">分享链接</button>' +
        '<button type="button" class="cl-btn" id="cl-edit-lib">图库</button>' +
        '<label class="cl-btn" id="cl-edit-import-label">导入<input type="file" id="cl-edit-import" accept=".json,application/json" hidden></label>' +
        '<button type="button" class="cl-btn" id="cl-edit-reset">载入 1A</button>' +
        '<button type="button" class="cl-btn" id="cl-edit-close">✕</button>' +
      '</div>' +
      '<div class="cl-edit-wrap"><canvas id="cl-edit-canvas"></canvas></div>' +
      '<div class="cl-edit-hint">左键绘制 · 拖动连续画 · 网格 8px · 「试玩」会立刻把当前图装载进游戏</div>';

    document.getElementById('celeste-app').appendChild(box);
    canvas = box.querySelector('#cl-edit-canvas');
    ctx = canvas.getContext('2d');

    var toolsEl = box.querySelector('.cl-edit-tools');
    TOOLS.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'cl-btn cl-edit-tool' + (t.id === tool ? ' on' : '');
      b.textContent = t.zh;
      b.setAttribute('data-tool', t.id);
      b.addEventListener('click', function () {
        tool = t.id;
        Array.prototype.forEach.call(toolsEl.children, function (c) { c.classList.remove('on'); });
        b.classList.add('on');
      });
      toolsEl.appendChild(b);
    });

    var nameEl = box.querySelector('#cl-edit-name');
    nameEl.addEventListener('input', function () { doc.name = nameEl.value.trim() || 'CUSTOM'; });

    function applyDoc(d) {
      doc = d;
      nameEl.value = doc.name;
      draw();
    }
    box.querySelector('#cl-edit-undo').addEventListener('click', function () {
      if (!undoStack.length) return;
      redoStack.push(unpack(JSON.parse(JSON.stringify(pack(doc)))));
      applyDoc(undoStack.pop());
      flash('已撤销');
    });
    box.querySelector('#cl-edit-redo').addEventListener('click', function () {
      if (!redoStack.length) return;
      undoStack.push(unpack(JSON.parse(JSON.stringify(pack(doc)))));
      applyDoc(redoStack.pop());
      flash('已重做');
    });
    /* 快捷键：Ctrl+Z 撤销 / Ctrl+Shift+Z 或 Ctrl+Y 重做 */
    box.addEventListener('keydown', function (e) {
      if (!(e.ctrlKey || e.metaKey)) return;
      var k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); box.querySelector('#cl-edit-undo').click(); }
      else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); box.querySelector('#cl-edit-redo').click(); }
    });
    box.querySelector('#cl-edit-close').addEventListener('click', function () { close(); });
    box.querySelector('#cl-edit-reset').addEventListener('click', function () {
      pushUndo();
      doc = fromLevel(Celeste.LEVEL);
      nameEl.value = doc.name;
      draw();
    });
    box.querySelector('#cl-edit-save').addEventListener('click', function () {
      save();
      flash('已保存到本地');
    });
    box.querySelector('#cl-edit-play').addEventListener('click', function () {
      var errs = validate(doc);
      if (errs.length) { flash('⚠ ' + errs.join(' / ')); return; }
      save();
      var app = window.CelesteWarp && window.CelesteWarp.app && window.CelesteWarp.app();
      if (!app) { flash('游戏还没起'); return; }
      app.loadLevel(toLevel(doc));
      close();
      app.start();
    });

    box.querySelector('#cl-edit-share').addEventListener('click', function () {
      var errs = validate(doc);
      if (errs.length) { flash('⚠ ' + errs.join(' / ')); return; }
      var url = location.origin + location.pathname + '#lv=' + b64e(JSON.stringify(pack(doc)));
      try { window.history.replaceState(null, '', '#lv=' + b64e(JSON.stringify(pack(doc)))); } catch (er) {}
      var done = function () { flash('分享链接已复制到剪贴板'); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done, function () { showShare(url); });
      } else showShare(url);
    });

    function showShare(url) {
      var ov = box.querySelector('.cl-edit-sharebox');
      if (!ov) {
        ov = document.createElement('div');
        ov.className = 'cl-edit-sharebox';
        ov.innerHTML = '<div class="cl-edit-sharecard"><b>SHARE LINK</b>' +
          '<textarea readonly></textarea>' +
          '<div><button type="button" class="cl-btn" data-copy>复制</button>' +
          '<button type="button" class="cl-btn" data-close>关闭</button></div></div>';
        box.appendChild(ov);
        ov.addEventListener('click', function (e) {
          if (e.target === ov || e.target.hasAttribute('data-close')) ov.classList.remove('show');
          if (e.target.hasAttribute('data-copy')) {
            var ta = ov.querySelector('textarea');
            ta.select();
            try { document.execCommand('copy'); flash('已复制'); } catch (er) {}
            ov.classList.remove('show');
          }
        });
      }
      ov.querySelector('textarea').value = url;
      ov.classList.add('show');
    }

    box.querySelector('#cl-edit-lib').addEventListener('click', function () { openLib(); });
    box.querySelector('#cl-edit-export').addEventListener('click', function () {
      var json = JSON.stringify(pack(doc), null, 1);
      var blob = new Blob([json], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (doc.name || 'level') + '.json';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
      flash('已导出 ' + (a.download));
    });
    box.querySelector('#cl-edit-import').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        try {
          var o = JSON.parse(String(fr.result));
          var d2 = unpack(o);
          if (!d2 && o && o.rects) d2 = fromLevel(o);      /* 也接受 LEVEL 格式 */
          if (!d2) throw new Error('bad json');
          pushUndo();
          doc = d2;
          nameEl.value = doc.name;
          draw();
          flash('导入成功');
        } catch (er) {
          flash('导入失败：' + er.message);
        }
      };
      fr.readAsText(f);
      e.target.value = '';
    });
    /* 绘制 */
    var drawing = false;
    function tileAt(e) {
      var r = canvas.getBoundingClientRect();
      var x = Math.floor((e.clientX - r.left) / (r.width / doc.w));
      var y = Math.floor((e.clientY - r.top) / (r.height / doc.h));
      if (x < 0 || y < 0 || x >= doc.w || y >= doc.h) return null;
      return [x, y];
    }
    function apply(t) {
      if (!t) return;
      var x = t[0], y = t[1];
      if (tool === 'solid') { doc.solid[y * doc.w + x] = 1; }
      else if (tool === 'erase') { doc.solid[y * doc.w + x] = 0; }
      else if (tool === 'spawn') { doc.spawn = [x, y]; }
      else if (tool === 'goal') { doc.goal = [x, y]; }
      else {
        var list = doc.ents[tool === 'spike' ? 'spikes' : tool + 's'];
        if (!list) return;
        for (var i = 0; i < list.length; i++) {
          if (list[i][0] === x && list[i][1] === y) { list.splice(i, 1); draw(); return; }
        }
        list.push(tool === 'spike' ? [x, y, 1, 'up'] : [x, y]);
      }
      draw();
    }
    canvas.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      pushUndo();
      drawing = true;
      try { canvas.setPointerCapture(e.pointerId); } catch (er) {}
      apply(tileAt(e));
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!drawing) return;
      if (tool !== 'solid' && tool !== 'erase') return;   /* 实体只放一个格 */
      apply(tileAt(e));
    });
    window.addEventListener('pointerup', function () { drawing = false; });
    canvas.addEventListener('pointercancel', function () { drawing = false; });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    canvas.addEventListener('pointerdown', function (e) {
      if (e.button === 2) {         /* 右键 = 擦 */
        e.preventDefault();
        pushUndo();
        var t = tileAt(e);
        if (t) { doc.solid[t[1] * doc.w + t[0]] = 0; draw(); }
      }
    });
  }

  function openLib() {
    var lib = libRead();
    var ov = box.querySelector('.cl-edit-libbox');
    if (!ov) {
      ov = document.createElement('div');
      ov.className = 'cl-edit-libbox';
      box.appendChild(ov);
      ov.addEventListener('click', function (e) {
        if (e.target === ov || e.target.hasAttribute('data-close')) { ov.classList.remove('show'); return; }
        var act = e.target.getAttribute('data-act');
        var idx = e.target.getAttribute('data-idx');
        if (!act || idx === null) return;
        var l = libRead();
        var item = l[+idx];
        if (!item) return;
        if (act === 'load') {
          pushUndo();
          var d2 = unpack(item.data);
          if (d2) { applyDocSafe(d2); }
          ov.classList.remove('show');
          flash('已载入「' + item.name + '」');
        } else if (act === 'del') {
          l.splice(+idx, 1);
          libWrite(l);
          openLib();
        } else if (act === 'dup') {
          var copy = JSON.parse(JSON.stringify(item));
          copy.name = item.name + ' COPY';
          copy.at = Date.now();
          l.push(copy);
          libWrite(l);
          openLib();
        }
      });
    }
    ov.innerHTML = '<div class="cl-edit-libcard"><b>LEVEL LIBRARY // ' + lib.length + '</b>' +
      '<div class="cl-edit-liblist">' +
      (lib.length ? lib.map(function (it, i) {
        return '<div class="cl-edit-librow"><span>' + esc(it.name) + '</span>' +
          '<em>' + new Date(it.at).toLocaleDateString() + '</em>' +
          '<i data-act="load" data-idx="' + i + '">载入</i>' +
          '<i data-act="dup" data-idx="' + i + '">复制</i>' +
          '<i data-act="del" data-idx="' + i + '">删除</i></div>';
      }).join('') : '<div class="cl-edit-libempty">还没有存档 —— 先点「存到图库」</div>') +
      '</div>' +
      '<div class="cl-edit-libfoot"><button type="button" class="cl-btn primary" data-act="save-cur">存到图库</button>' +
      '<button type="button" class="cl-btn" data-close>关闭</button></div></div>';
    ov.classList.add('show');
    var saveCur = ov.querySelector('[data-act="save-cur"]');
    if (saveCur) saveCur.addEventListener('click', function () {
      var l2 = libRead();
      var nm = doc.name || 'CUSTOM';
      var found = false;
      l2.forEach(function (it) { if (it.name === nm) { it.data = pack(doc); it.at = Date.now(); found = true; } });
      if (!found) l2.push({ name: nm, at: Date.now(), data: pack(doc) });
      libWrite(l2);
      openLib();
      flash('已存入图库：' + nm);
    });
  }

  function applyDocSafe(d) {
    doc = d;
    if (box) box.querySelector('#cl-edit-name').value = doc.name;
    draw();
  }

  function pushUndo() {
    undoStack.push(unpack(JSON.parse(JSON.stringify(pack(doc)))));
    if (undoStack.length > 20) undoStack.shift();
    redoStack.length = 0;
  }

  function flash(msg) {
    var el = box && box.querySelector('.cl-edit-hint');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('hot');
    setTimeout(function () { el.classList.remove('hot'); }, 1200);
  }

  function resizeCanvas() {
    if (!canvas || !doc) return;
    var host = canvas.parentElement;
    var W = host.clientWidth, H = host.clientHeight;
    var ts = Math.floor(Math.min(W / doc.w, H / doc.h));
    if (ts < 2) ts = 2;
    canvas.width = doc.w * ts; canvas.height = doc.h * ts;
    canvas.style.width = doc.w * ts + 'px';
    canvas.style.height = doc.h * ts + 'px';
    canvas.__ts = ts;
    draw();
  }

  function draw() {
    if (!ctx || !doc) return;
    var ts = canvas.__ts || 8;
    var w = canvas.width, h = canvas.height;
    var light = document.querySelector('.cl-frame') &&
      document.querySelector('.cl-frame').getAttribute('data-light') === '1';
    ctx.clearRect(0, 0, w, h);
    /* 背景 + 网格 */
    ctx.fillStyle = light ? '#f7f4ef' : '#120a20';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = light ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.10)';
    ctx.lineWidth = 1;
    for (var gx = 0; gx <= doc.w; gx += 5) {
      ctx.beginPath(); ctx.moveTo(gx * ts, 0); ctx.lineTo(gx * ts, h); ctx.stroke();
    }
    for (var gy = 0; gy <= doc.h; gy += 5) {
      ctx.beginPath(); ctx.moveTo(0, gy * ts); ctx.lineTo(w, gy * ts); ctx.stroke();
    }
    /* 地形 */
    for (var y = 0; y < doc.h; y++) {
      for (var x = 0; x < doc.w; x++) {
        if (!doc.solid[y * doc.w + x]) continue;
        ctx.fillStyle = light ? '#e3d9ea' : '#3b2a58';
        ctx.fillRect(x * ts, y * ts, ts, ts);
        ctx.fillStyle = light ? 'rgba(0,0,0,.10)' : 'rgba(255,255,255,.18)';
        ctx.fillRect(x * ts, y * ts, ts, 1);
      }
    }
    /* 实体 */
    function dot(list, color, size) {
      for (var i = 0; i < list.length; i++) {
        var p = list[i];
        ctx.fillStyle = color;
        var s = (size || 1) * ts;
        ctx.fillRect(p[0] * ts + (ts - s) / 2, p[1] * ts + (ts - s) / 2, s, s);
      }
    }
    dot(doc.ents.spikes, '#ef4444', 1);
    dot(doc.ents.springs, '#fbbf24', 2);
    dot(doc.ents.crystals, '#34d399', 1);
    dot(doc.ents.berries, '#f472b6', 1);
    dot(doc.ents.checkpoints, '#60a5fa', 1);
    /* 出生点 */
    ctx.strokeStyle = '#a78bfa';
    ctx.lineWidth = Math.max(2, ts / 4);
    ctx.beginPath();
    ctx.arc(doc.spawn[0] * ts + ts / 2, doc.spawn[1] * ts + ts / 2, ts / 2 - 1, 0, Math.PI * 2);
    ctx.stroke();
    /* 终点 */
    ctx.fillStyle = '#22d3ee';
    ctx.fillRect(doc.goal[0] * ts, doc.goal[1] * ts, 2, 4 * ts);
    ctx.beginPath();
    ctx.moveTo(doc.goal[0] * ts + 2, doc.goal[1] * ts);
    ctx.lineTo(doc.goal[0] * ts + 2 + ts * 2, doc.goal[1] * ts + ts);
    ctx.lineTo(doc.goal[0] * ts + 2, doc.goal[1] * ts + 2 * ts);
    ctx.fill();
  }

  Celeste.Editor = {
    open: function () {
      if (!box) build();
      load();
      undoStack.length = 0;
      redoStack.length = 0;
      tryHash();
      box.querySelector('#cl-edit-name').value = doc.name;
      box.hidden = false;
      var app = window.CelesteWarp && window.CelesteWarp.app && window.CelesteWarp.app();
      if (app) app.stop();          /* 编辑时不跑逻辑，免得格子跟玩家打架 */
      setTimeout(resizeCanvas, 30);
      window.addEventListener('resize', resizeCanvas);
    },
    close: close,
    toLevel: function () { return toLevel(doc); },
    /* 给 UI 的「载入自定义图」用：把打包数据直接翻成 LEVEL */
    toLevelFromPacked: function (o) {
      var d = unpack(o);
      return d ? toLevel(d) : null;
    },
    levels: function () {
      var out = [{ name: Celeste.LEVEL.name, kind: '内置' }];
      try {
        var raw = window.localStorage.getItem(KEY);
        if (raw) { var o = unpack(JSON.parse(raw)); if (o) out.push({ name: o.name, kind: '自定义' }); }
      } catch (e) {}
      return out;
    }
  };

  window.__clUnpackToLevel = function (o) {
    var d = unpack(o);
    return d ? toLevel(d) : null;
  };

  /* 打开链接里带 #lv=<base64> 时，直接载入对方分享的关卡 */
  function tryHash() {
    if (hashUsed) return;
    var m = (location.hash || '').match(/lv=([^&]+)/);
    if (!m) return;
    hashUsed = true;
    try {
      var o = JSON.parse(b64d(m[1]));
      var d = unpack(o);
      if (!d) return;
      doc = d;
      if (box) box.querySelector('#cl-edit-name').value = doc.name;
      setTimeout(function () { draw(); flash('已载入分享关卡「' + d.name + '」'); }, 40);
    } catch (e) {}
  }

  function close() {
    if (box) box.hidden = true;
    window.removeEventListener('resize', resizeCanvas);
    var app = window.CelesteWarp && window.CelesteWarp.app && window.CelesteWarp.app();
    if (app && !app.running) app.start();      /* 关掉编辑器就把游戏跑起来 */
  }

  load();
})();
