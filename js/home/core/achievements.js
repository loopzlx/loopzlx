/* achievements.js —— 跨模块成就系统
   任何模块只要调 window.LZXAch.unlock('osu-s') 就记一条，右下角弹终端风格提示条。
   记录存在 localStorage 的 lzx.ach.v1，不依赖后端。 */
(function () {
  'use strict';

  var KEY = 'lzx.ach.v1';

  var DEFS = [
    { id: 'first-warp', icon: '◇', zh: '初次跃迁', en: 'First Jump', desc: '打开任意一个覆盖层', descEn: 'Open any overlay' },
    { id: 'all-warp', icon: '◈', zh: '三界通游', en: 'All Portals', desc: 'osu! / gamehub / celeste 各打开过一次', descEn: 'Visit osu! / gamehub / celeste at least once each' },
    { id: 'celeste-clear', icon: '▲', zh: '登顶', en: 'Summit', desc: '通关蔚蓝', descEn: 'Clear Celeste' },
    { id: 'celeste-perfect', icon: '★', zh: '无伤登顶', en: 'Deathless', desc: '0 死亡通关蔚蓝', descEn: 'Clear Celeste with zero deaths' },
    { id: 'celeste-berry', icon: '●', zh: '贪吃', en: 'Berry Picker', desc: '一次吃满全部草莓', descEn: 'Collect every berry in a single run' },
    { id: 'celeste-editor', icon: '✎', zh: '造物主', en: 'Level Maker', desc: '自己做一张蔚蓝关卡并通关', descEn: 'Build your own Celeste level and clear it' },
    { id: 'osu-s', icon: 'S', zh: 'S 级演奏', en: 'S Rank', desc: 'osu! 任一模式拿到 S', descEn: 'Get an S rank in any osu! mode' },
    { id: 'osu-ss', icon: '✸', zh: '完美节拍', en: 'SS Rank', desc: 'osu! 拿到 SS / SS+', descEn: 'Get SS or SS+ in osu!' },
    { id: 'osu-import', icon: '⇣', zh: '自带谱面', en: 'Bring Your Own', desc: '导入一首自己的 .osu / .osz', descEn: 'Import your own .osu / .osz beatmap' },
    { id: 'gh-2048', icon: '▣', zh: '2048', en: '2048', desc: '2048 合成出 2048', descEn: 'Merge your way up to the 2048 tile' },
    { id: 'gh-sweep', icon: '✱', zh: '扫雷老兵', en: 'Sweeper', desc: '通关一局扫雷', descEn: 'Win a game of minesweeper' },
    { id: 'gh-snake-20', icon: '≈', zh: '长蛇', en: 'Long Snake', desc: '贪吃蛇吃到 20 分', descEn: 'Reach 20 points in snake' },
    { id: 'terminal-10', icon: '>', zh: '终端常客', en: 'Terminal Regular', desc: '在终端里敲过 10 条命令', descEn: 'Run 10 commands in the terminal' },
    { id: 'night-owl', icon: '☾', zh: '夜猫子', en: 'Night Owl', desc: '凌晨 0–5 点还在站里', descEn: 'Be on the site between midnight and 5 AM' },
    { id: 'osu-four-modes', icon: '四', zh: '全模式玩家', en: 'All Modes', desc: '分别启动 osu!、taiko、catch、mania', descEn: 'Play all four osu! modes' },
    { id: 'osu-10-play', icon: '♫', zh: '节奏常客', en: 'Rhythm Regular', desc: '完成 10 次 osu! 游玩', descEn: 'Finish 10 osu! plays' },
    { id: 'gh-snake-50', icon: '∞', zh: '蛇王', en: 'Snake Master', desc: '贪吃蛇达到 50 分', descEn: 'Reach 50 points in snake' },
    { id: 'explorer', icon: '⌖', zh: '探索者', en: 'Explorer', desc: '访问主页所有精选模块', descEn: 'Explore every featured section' }
  ];

  /* 当前语言：主页切语言时会把 documentElement.lang 设成 zh-CN / en */
  function isZh() {
    var l = document.documentElement.lang || 'en';
    return /^zh/i.test(l);
  }

  var byId = {};
  DEFS.forEach(function (d) { byId[d.id] = d; });

  var state = {};
  try { state = JSON.parse(window.localStorage.getItem(KEY) || '{}') || {}; } catch (e) { state = {}; }

  function persist() {
    try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  var beepCtx = null;
  function beep() {
    try {
      if (!beepCtx) beepCtx = new (window.AudioContext || window.webkitAudioContext)();
      var o = beepCtx.createOscillator(), g = beepCtx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(740, beepCtx.currentTime);
      o.frequency.exponentialRampToValueAtTime(1180, beepCtx.currentTime + 0.12);
      g.gain.setValueAtTime(0.0001, beepCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.12, beepCtx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, beepCtx.currentTime + 0.28);
      o.connect(g); g.connect(beepCtx.destination);
      o.start(); o.stop(beepCtx.currentTime + 0.3);
    } catch (e) {}
  }

  function stack() {
    var el = document.getElementById('lzx-ach-stack');
    if (!el) {
      el = document.createElement('div');
      el.id = 'lzx-ach-stack';
      el.className = 'lzx-ach-stack';
      document.body.appendChild(el);
    }
    return el;
  }

  function toast(d) {
    if (!document.body) return;
    var el = document.createElement('div');
    el.className = 'lzx-ach';
    var zh = isZh();
    el.innerHTML = '<b>' + (d.icon || '◆') + '</b><div><span>' + (zh ? d.zh : d.en) +
      '</span><em>' + (zh ? d.en : d.zh) + '</em><p>' + (zh ? d.desc : (d.descEn || d.desc)) + '</p></div>';
    stack().appendChild(el);
    requestAnimationFrame(function () { el.classList.add('in'); });
    setTimeout(function () {
      el.classList.remove('in');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 420);
    }, 3400);
  }

  /* 一次性：打开过哪些模块 */
  var seen = {};
  try { seen = JSON.parse(window.localStorage.getItem('lzx.ach.seen') || '{}') || {}; } catch (e) { seen = {}; }

  var API = {
    defs: DEFS,
    lang: function () { return isZh() ? 'zh' : 'en'; },
    state: state,
    has: function (id) { return !!state[id]; },
    count: function () { return Object.keys(state).length; },
    total: function () { return DEFS.length; },

    unlock: function (id) {
      var d = byId[id];
      if (!d || state[id]) return false;
      state[id] = Date.now();
      persist();
      toast(d);
      beep();
      try {
        window.dispatchEvent(new CustomEvent('lzx:ach', { detail: { id: id, def: d } }));
      } catch (e) {}
      return true;
    },

    /* 记录某模块被打开过；三个都开过就解锁 all-warp */
    visit: function (id) {
      if (!id || seen[id]) return;
      seen[id] = 1;
      try { window.localStorage.setItem('lzx.ach.seen', JSON.stringify(seen)); } catch (e) {}
      API.unlock('first-warp');
      if (seen.osu && seen.gamehub && seen.celeste) API.unlock('all-warp');
    },

    /* 计数器型成就：terminal-10 */
    bump: function (name, n, id, need) {
      var k = 'lzx.ach.cnt.' + name, v = 0;
      try { v = parseInt(window.localStorage.getItem(k), 10) || 0; } catch (e) { v = 0; }
      v += (n || 1);
      try { window.localStorage.setItem(k, String(v)); } catch (e) {}
      if (v >= need) API.unlock(id);
      return v;
    },

    /* 凌晨时段的一次性检查 */
    checkTime: function () {
      var h = new Date().getHours();
      if (h >= 0 && h < 5) API.unlock('night-owl');
    },

    list: function () {
      return DEFS.map(function (d) {
        return { id: d.id, icon: d.icon, zh: d.zh, en: d.en, desc: d.desc, descEn: d.descEn, at: state[d.id] || 0 };
      });
    },

    reset: function () {
      state = {};
      persist();
      try { window.localStorage.removeItem('lzx.ach.seen'); } catch (e) {}
      seen = {};
    }
  };

  window.LZXAch = API;

  /* 站点一打开就算一次访问 */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', API.checkTime);
  } else {
    API.checkTime();
  }
})();
