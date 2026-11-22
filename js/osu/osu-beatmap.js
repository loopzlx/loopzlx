/* osu-beatmap.js —— .osu 解析 / .osz 解包 / 曲目对象 / 各模式谱面构建入口 */
var OSU = window.Osu = window.Osu || {};

(function () {
  'use strict';
  var S = OSU.S;

  var B = OSU.bm = {};

  /* ---------------- .osu 文本解析 ---------------- */
  B.parseOsu = function (text, fallbackVersion) {
    function meta(key) {
      var m = text.match(new RegExp('^\\s*' + key + '\\s*:\\s*(.+?)\\s*$', 'm'));
      return m ? m[1].trim() : '';
    }
    function num(key, fb) {
      var v = parseFloat(meta(key));
      return isFinite(v) ? v : fb;
    }

    var modeNum = parseInt(meta('Mode') || '0', 10);
    var mode = ['std', 'taiko', 'catch', 'mania'][modeNum] || 'std';
    var cs = num('CircleSize', 4);

    /* BPM：取第一条非继承绿线的 beatLength */
    var bpm = 0;
    var tp = text.split('[TimingPoints]')[1];
    if (tp) {
      tp = tp.split('[')[0];
      var lines = tp.split('\n');
      for (var i = 0; i < lines.length; i++) {
        var p = lines[i].split(',');
        if (p.length < 2) continue;
        var beat = parseFloat(p[1]);
        if (isFinite(beat) && beat > 0) { bpm = Math.round(60000 / beat); break; }
      }
    }

    /* 背景图 */
    var bgName = null;
    var ev = text.split('[Events]')[1];
    if (ev) {
      ev = ev.split('[')[0];
      var m = ev.match(/^\s*0\s*,\s*0\s*,\s*"([^"]+)"/m);
      if (m) bgName = m[1];
    }

    /* 物件 */
    var ho = text.split('[HitObjects]')[1] || '';
    ho = ho.split('[Colours]')[0];
    var objects = [];
    var lines2 = ho.split('\n');
    for (var k = 0; k < lines2.length; k++) {
      var line = lines2[k].trim();
      if (!line || line.charAt(0) === '/') continue;
      var q = line.split(',');
      if (q.length < 5) continue;
      var x = parseInt(q[0], 10), y = parseInt(q[1], 10), time = parseInt(q[2], 10), type = parseInt(q[3], 10);
      if (!isFinite(x) || !isFinite(time)) continue;
      var hs = parseInt(q[4], 10) || 0;
      var obj = { x: x, y: y, time: time / 1000, hitSound: hs, type: 'circle' };

      if (type & 128) {                     /* mania hold */
        obj.type = 'hold';
        var endT = parseInt((q[5] || '').split(':')[0], 10) / 1000;
        obj.endTime = isFinite(endT) && endT > obj.time ? endT : obj.time;
      } else if (type & 2) {                /* slider */
        obj.type = 'slider';
        var curve = q[5] || '';
        var slides = parseInt(q[6], 10) || 1;
        var length = parseFloat(q[7]) || 0;
        var beatMs = isFinite(bpm) && bpm > 0 ? 60000 / bpm : 500;
        var pts = [];
        var cs2 = curve.split('|');
        for (var ci = 1; ci < cs2.length; ci++) {
          var xy = cs2[ci].split(':');
          if (xy.length >= 2) pts.push({ x: parseFloat(xy[0]), y: parseFloat(xy[1]) });
        }
        obj.endX = pts.length ? pts[pts.length - 1].x : x;
        obj.endY = pts.length ? pts[pts.length - 1].y : y;
        obj.pts = pts;
        obj.slides = slides;
        obj.length = length;
        /* 近似：滑块总时长 = (length/100 拍) × 单拍毫秒 × 折返次数 */
        var durMs = (length / 100) * beatMs * (slides || 1);
        obj.endTime = obj.time + Math.max(0.2, durMs / 1000);
      } else if (type & 8) {                /* spinner */
        obj.type = 'spinner';
        var endT2 = parseInt((q[5] || '').split(':')[0], 10) / 1000;
        obj.endTime = isFinite(endT2) ? endT2 : obj.time + 2;
        obj.x = null; obj.y = null;
      } else {
        obj.type = 'circle';
      }
      objects.push(obj);
    }
    objects.sort(function (a, c) { return a.time - c.time; });

    return {
      mode: mode, cs: cs, bpm: bpm,
      od: num('OverallDifficulty', 5),
      hp: num('HPDrainRate', 5),
      title: meta('Title') || 'Untitled',
      artist: meta('Artist') || 'Unknown',
      creator: meta('Creator') || '—',
      version: meta('Version') || fallbackVersion || 'Normal',
      audioName: meta('AudioFilename'),
      previewTime: Math.max(0, num('PreviewTime', 0) / 1000),
      bgName: bgName,
      objects: objects,
      length: objects.length ? objects[objects.length - 1].time + 2 : 0
    };
  };

  /* ---------------- .osz 解包 ---------------- */
  B.readOsz = function (file, onProgress) {
    return new Promise(function (resolve, reject) {
      if (!file) { reject(new Error('no file')); return; }
      if (!/\.osz$/i.test(file.name)) {
        /* 单个 .osu：直接读文本 */
        if (/\.osu$/i.test(file.name)) {
          var fr = new FileReader();
          fr.onload = function () { resolve({ osuText: String(fr.result), osuTexts: [String(fr.result)], audioBlob: null, bgBlob: null }); };
          fr.onerror = reject;
          fr.readAsText(file);
          return;
        }
        reject(new Error('不支持的文件类型'));
        return;
      }
      /* JSZip 现在是按需拉取：没有就先把它取回来，再走一遍解包 */
      if (!window.JSZip) {
        if (!window.OsuLoadZip) { reject(new Error('JSZip 未加载')); return; }
        window.OsuLoadZip().then(function () {
          window.OsuBeatmap.readOsz(file, onProgress).then(resolve, reject);
        }, function () { reject(new Error('JSZip 加载失败')); });
        return;
      }
      JSZip.loadAsync(file).then(function (zip) {
        var osuEntries = [], audioEntry = null, bgEntry = null;
        var names = Object.keys(zip.files);
        for (var i = 0; i < names.length; i++) {
          var n = names[i];
          if (/\.osu$/i.test(n) && !zip.files[n].dir) osuEntries.push(zip.files[n]);
          if (/\.(mp3|ogg|wav)$/i.test(n)) audioEntry = audioEntry || zip.files[n];
          if (/\.(jpg|jpeg|png)$/i.test(n)) bgEntry = bgEntry || zip.files[n];
        }
        if (!osuEntries.length) { reject(new Error('.osz 内没有 .osu 文件')); return; }
        /* 一个 .osz 里常有多张难度（Easy/Normal/Hard…），全部读出来 */
        return Promise.all([
          Promise.all(osuEntries.map(function (e) {
            return e.async('text').then(function (txt) { return { text: txt, name: e.name }; });
          })),
          audioEntry ? audioEntry.async('blob') : Promise.resolve(null),
          bgEntry ? bgEntry.async('blob') : Promise.resolve(null)
        ]).then(function (arr) {
          resolve({
            osuText: arr[0][0] ? arr[0][0].text : '',
            osuTexts: arr[0].map(function (x) { return x.text; }),
            osuNames: arr[0].map(function (x) { return x.name; }),
            audioBlob: arr[1], bgBlob: arr[2], zipName: file.name
          });
        });
      }).catch(reject);
    });
  };

  /* ---------------- 曲库存档（IndexedDB：刷新后导入的歌还在） ---------------- */
  var DB_NAME = 'loopzlx-osu', DB_STORE = 'library', dbPromise = null;

  function db() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!('indexedDB' in window)) { reject(new Error('no indexedDB')); return; }
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        var d = req.result;
        if (!d.objectStoreNames.contains(DB_STORE)) d.createObjectStore(DB_STORE, { keyPath: 'id' });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('idb error')); };
    });
    return dbPromise;
  }

  function tx(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (resolve, reject) {
        var t = d.transaction(DB_STORE, mode);
        var store = t.objectStore(DB_STORE);
        var out = fn(store);
        t.oncomplete = function () { resolve(out && out.result !== undefined ? out.result : out); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error); };
      });
    });
  }

  B.storeItem = function (item) {
    var rec = {
      id: item.id, mode: item.mode, title: item.title, artist: item.artist,
      creator: item.creator, charts: item.charts, dl: item.dl || 0,
      audioBlob: item.audioBlob || null, bgBlob: item.bgBlob || null, zipName: item.zipName || '',
      savedAt: Date.now()
    };
    return tx('readwrite', function (s) { return s.put(rec); }).catch(function () { return null; });
  };

  B.allItems = function () {
    return tx('readonly', function (s) { return s.getAll(); }).catch(function () { return []; });
  };

  B.deleteItem = function (id) {
    return tx('readwrite', function (s) { return s.delete(id); }).catch(function () { return null; });
  };

  B.clearItems = function () {
    return tx('readwrite', function (s) { return s.clear(); }).catch(function () { return null; });
  };

  /* ---------------- 构建游戏音符 ---------------- */
  B.buildNotes = function (chart, modeKey) {
    var impl = OSU.modes[modeKey];
    if (!impl || !impl.build) return [];
    var notes = impl.build(chart);
    notes.sort(function (a, c) { return (a.time || 0) - (c.time || 0); });
    return notes;
  };

  /* 演示谱 → 统一 chart 结构 */
  B.demoChart = function (modeKey) {
    var d = OSU.DEMO[modeKey];
    return {
      mode: modeKey, title: d.title, artist: d.artist, version: d.version,
      creator: 'LOOPZLX', cs: modeKey === 'mania' ? (OSU.settings ? OSU.settings.maniaK() : 4) : 4,
      od: 5, hp: 5, bpm: OSU.DEMO.bpm,
      objects: d.objects, length: d.length, demo: true
    };
  };

})();
