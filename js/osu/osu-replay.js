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
  R.play = function (idx, opt) {
    opt = opt || {};
    var arr = read();
    var rec = arr[idx || 0];
    if (!rec || !rec.chart) { OSU.log && OSU.log('REPLAY // 没有可回放的记录'); return false; }
    var chart = fullChart(rec.chart);
    chart.demo = false;
    S.speed = rec.speed || 1;
    S.mods = rec.mods || {};
    OSU.game.start(chart, rec.mode);
    S.replay = { ev: rec.events, i: 0, rec: rec, idx: idx || 0, meta: { title: rec.title, version: rec.version },
                 t: S.songTime || 0, lastPerf: 0, rate: opt.rate || 1, hold: !!opt.hold };
    S.replayMode = true;
    R.syncBar();
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
    updateBar(false);
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
  R.endCleanup = function () { S.replay = null; S.replayMode = false; R.syncBar(); };

  /* ---------------- 回放时钟 / 拖动 / 倍速 ---------------- */
  var RATES = [0.5, 1, 1.5, 2, 4];
  var bar = null, dragging = false, lastBarAt = 0;

  /* 回放自己的时钟：真实流逝时间 × 谱面变速 × 回放倍速；单次最多推进 0.1s，切后台回来不跳 */
  R.clock = function () {
    var r = S.replay;
    if (!r) return S.songTime || 0;
    var now = performance.now();
    var dt = r.lastPerf ? Math.min(0.1, (now - r.lastPerf) / 1000) : 0;
    r.lastPerf = now;
    if (!r.hold && !dragging) r.t += dt * (S.speed || 1) * (r.rate || 1);
    return r.t;
  };

  function noop() {}
  var saved = null;
  function quiet(on) {   /* 快进重演时不要出声 / 不要溅一屏粒子 */
    if (on) {
      saved = { h: OSU.audio.hitSfx, p: OSU.popup, s: OSU.spark };
      OSU.audio.hitSfx = noop; OSU.popup = noop; OSU.spark = noop;
    } else if (saved) {
      OSU.audio.hitSfx = saved.h; OSU.popup = saved.p; OSU.spark = saved.s; saved = null;
    }
  }

  /* 跳到 t 秒：往回跳要重建整局状态，所以统一重开 + 把 t 之前的录制事件静音重演一遍 */
  R.seek = function (t) {
    var r = S.replay;
    if (!r) return;
    var keep = { rate: r.rate, hold: r.hold }, idx = r.idx;
    var tgt = Math.max(-1.6, Math.min(t, S.songEnd || t));
    quiet(true);
    try {
      if (!R.play(idx, keep)) return;
      var n = S.replay;
      n.t = tgt; S.songTime = tgt;
      R.tick(tgt);
    } finally { quiet(false); }
    if (OSU.resetFx) OSU.resetFx();
    S.displayHealth = S.health;
    updateBar(true);
  };

  function fmt(sec) { sec = Math.max(0, Math.floor(sec)); return Math.floor(sec / 60) + ':' + ('0' + (sec % 60)).slice(-2); }

  function buildBar() {
    if (bar) return bar;
    var play = document.getElementById('osu-play');
    if (!play) return null;
    bar = document.createElement('div');
    bar.id = 'osu-replay-bar';
    bar.className = 'osu-replay-bar';
    bar.hidden = true;
    bar.innerHTML =
      '<button type="button" class="osu-btn ghost small" id="orp-toggle" aria-label="Pause / play replay">❚❚</button>' +
      '<input type="range" id="orp-seek" min="0" max="1000" step="1" value="0" aria-label="Replay position">' +
      '<span class="orp-time" id="orp-time">0:00 / 0:00</span>' +
      '<span class="orp-rates" id="orp-rates">' + RATES.map(function (v) {
        return '<button type="button" class="orp-rate" data-rate="' + v + '">' + v + '×</button>';
      }).join('') + '</span>';
    var wrap = document.getElementById('osu-board-wrap');
    play.insertBefore(bar, wrap || null);

    var seek = bar.querySelector('#orp-seek'), tog = bar.querySelector('#orp-toggle');
    function posToTime() { return (seek.value / 1000) * (S.songEnd || 0); }
    seek.addEventListener('input', function () {
      dragging = true;
      bar.querySelector('#orp-time').textContent = fmt(posToTime()) + ' / ' + fmt(S.songEnd || 0);
    });
    seek.addEventListener('change', function () { dragging = false; R.seek(posToTime()); seek.blur(); });
    tog.addEventListener('click', function () { if (S.replay) { S.replay.hold = !S.replay.hold; updateBar(true); } });
    bar.querySelector('#orp-rates').addEventListener('click', function (e) {
      var b = e.target.closest('.orp-rate');
      if (b && S.replay) { S.replay.rate = parseFloat(b.dataset.rate) || 1; updateBar(true); }
    });
    /* ← → 快退 / 快进 5 秒，空格暂停（回放里不接管输入，这几个键不会和玩法冲突）；捕获阶段先于玩法的按键监听 */
    window.addEventListener('keydown', function (e) {
      if (!S.replay || !S.running) return;
      if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        e.preventDefault(); e.stopImmediatePropagation();
        R.seek(S.replay.t + (e.code === 'ArrowLeft' ? -5 : 5));
      } else if (e.code === 'Space') {
        e.preventDefault(); e.stopImmediatePropagation();
        S.replay.hold = !S.replay.hold; updateBar(true);
      }
    }, true);
    return bar;
  }

  function updateBar(force) {
    var r = S.replay;
    if (!bar || !r) return;
    var now = performance.now();
    if (!force && now - lastBarAt < 80) return;
    lastBarAt = now;
    var end = S.songEnd || 1;
    if (!dragging) {
      bar.querySelector('#orp-seek').value = String(Math.round(Math.max(0, Math.min(1, r.t / end)) * 1000));
      bar.querySelector('#orp-time').textContent = fmt(r.t) + ' / ' + fmt(end);
    }
    bar.querySelector('#orp-toggle').textContent = r.hold ? '▶' : '❚❚';
    var rs = bar.querySelectorAll('.orp-rate');
    for (var i = 0; i < rs.length; i++) rs[i].classList.toggle('is-on', parseFloat(rs[i].dataset.rate) === (r.rate || 1));
  }

  /* 有回放就显示控制条，没有就藏起来（G.start / endCleanup / play 都会调） */
  R.syncBar = function () {
    var b = buildBar();
    if (!b) return;
    b.hidden = !S.replay;
    dragging = false;
    if (S.replay) updateBar(true);
  };

  /* 结果页用于判断"这次成绩是否有回放可看" */
  R.matches = function (score, title) {
    var rec = read()[0];
    if (!rec) return false;
    return Math.abs((rec.score || 0) - (score || 0)) < 2 && (!title || rec.title === title);
  };
})();
