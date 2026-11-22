/* osu-replay.js —— 成绩回放（录制判定事件流，回放时只重演判定、不接管输入）
 * 录制：osu-core 的 addHit / addMiss 会调 OSU.replay.record()
 * 回放：game loop 检测 S.replay，走 OSU.replay.tick()，判定事件由录制驱动
 */
var OSU = window.Osu = window.Osu || {};

(function () {
  'use strict';
  var KEY = 'osu.replay.v1';
  var MAX_KEEP = 2;
  var S = OSU.S;
  var live = null;

  var R = OSU.replay = {};
  var CODE = ['PERFECT', 'GREAT', 'GOOD', 'OK', 'MEH', 'MISS', 'BREAK'];

  /* ---------------- 录制 ---------------- */
  R.begin = function (chart, mode) {
    live = {
      events: [], mode: mode,
      title: (chart && chart.title) || 'untitled',
      version: (chart && chart.version) || '',
      startedAt: Date.now()
    };
  };
  R.record = function (code, x, y, t) {
    if (!live) return;
    if (live.events.length > 6000) return;
    var tt = Math.round(t != null ? t : (S.songTime || 0));
    live.events.push([tt, code, Math.round(x || 0), Math.round(y || 0)]);
  };
  R.active = function () { return !!live; };
  R.abort = function () { live = null; };

  function clone(v) { try { return JSON.parse(JSON.stringify(v)); } catch (e) { return []; } }

  function slimChart(chart) {
    if (!chart) return null;
    return {
      title: chart.title, artist: chart.artist, version: chart.version,
      bpm: chart.bpm, length: chart.length, od: chart.od, cs: chart.cs, hp: chart.hp,
      objects: clone(chart.objects || []), demo: false, replay: 1
    };
  }
  function fullChart(sc) {
    if (!sc) return null;
    return {
      title: sc.title, artist: sc.artist, version: sc.version,
      bpm: sc.bpm, length: sc.length, od: sc.od, cs: sc.cs, hp: sc.hp,
      objects: clone(sc.objects || []), replay: 1, demo: false
    };
  }

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]') || []; } catch (e) { return []; }
  }
  function write(arr) {
    try { localStorage.setItem(KEY, JSON.stringify(arr)); } catch (e) {
      /* 配额满：只留最新一条，再不行就放弃存谱面 */
      try {
        var one = arr.slice(0, 1);
        localStorage.setItem(KEY, JSON.stringify(one));
      } catch (e2) {}
    }
  }

  R.save = function (chart, meta) {
    if (!live || !live.events.length) return null;
    var rec = {
      v: 1, at: live.startedAt, mode: live.mode,
      title: live.title, version: live.version,
      score: Math.round((meta && meta.score) || S.score || 0),
      acc: meta && meta.acc, maxCombo: (meta && meta.maxCombo) || S.maxCombo || 0,
      mods: S.mods || {}, speed: S.speed || 1,
      dur: Math.round(S.songTime || 0),
      events: live.events,
      chart: slimChart(chart)
    };
    var arr = read();
    arr.unshift(rec);
    write(arr.slice(0, MAX_KEEP));
    live = null;
    return rec;
  };

  R.list = function () { return read(); };
  R.latest = function () { return read()[0] || null; };
  R.clear = function () { try { localStorage.removeItem(KEY); } catch (e) {} };

  /* ---------------- 回放 ---------------- */
  R.play = function (idx) {
    var arr = read();
    var rec = arr[idx || 0];
    if (!rec || !rec.chart) { OSU.log && OSU.log('REPLAY // 没有可回放的记录'); return false; }
    var chart = fullChart(rec.chart);
    chart.demo = false;
    S.speed = rec.speed || 1;
    S.mods = rec.mods || {};
    OSU.game.start(chart, rec.mode);
    S.replay = { ev: rec.events, i: 0, rec: rec, meta: { title: rec.title, version: rec.version } };
    S.replayMode = true;
    var lbl = document.getElementById('osu-play-mode');
    if (lbl) lbl.textContent = 'REPLAY · ' + (rec.title || '') + ' · ' + (rec.mode || '').toUpperCase();
    OSU.log && OSU.log('REPLAY // ' + (rec.title || '') + ' · ' + rec.events.length + ' 判定');
    return true;
  };

  /* 回放中把已判定的音符标记为 consumed，让画面正确消失 */
  function markNote(t, res) {
    var best = null, bestD = 1e9, i;
    for (i = 0; i < S.notes.length; i++) {
      var n = S.notes[i];
      if (n.judged) continue;
      var d = Math.abs((n.time || 0) - t);
      if (d < bestD) { bestD = d; best = n; }
      if (d > 0.26) break;
    }
    if (best && bestD < 0.3) { best.judged = true; best.judgeKey = res; }
  }

  R.tick = function (t) {
    var r = S.replay;
    if (!r) return;
    var guard = 0;
    while (r.i < r.ev.length && r.ev[r.i][0] <= t && guard++ < 200) {
      var e = r.ev[r.i++];
      var res = CODE[e[1]] || 'PERFECT';
      if (e[1] >= 5) {
        markNote(e[0], e[1] === 6 ? 'BREAK' : 'MISS');
        OSU.addMiss(e[2], e[3], e[1] === 6);
      } else {
        markNote(e[0], res);
        OSU.addHit(res, e[2], e[3]);
      }
    }
  };

  R.inReplay = function () { return !!S.replay; };
  R.endCleanup = function () { S.replay = null; S.replayMode = false; };

  /* 结果页用于判断"这次成绩是否有回放可看" */
  R.matches = function (score, title) {
    var rec = read()[0];
    if (!rec) return false;
    return Math.abs((rec.score || 0) - (score || 0)) < 2 && (!title || rec.title === title);
  };
})();
