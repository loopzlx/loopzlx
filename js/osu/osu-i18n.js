/* osu-i18n.js —— osu! 覆盖层的中英切换（独立于 GameHub，存 localStorage osu_lang） */
var OSUN = window.Osu = window.Osu || {};

(function () {
  'use strict';

  var KEY = 'osu_lang';

  var D = {
    zh: {
      'menu.play': '游玩',
      'menu.import': '导入 .OSZ',
      'menu.download': '下载谱面',
      'menu.settings': '设置',
      'mode.std.tag': 'AIM 定位',
      'mode.std.desc': '精准锁定 · 环环命中',
      'mode.taiko.tag': 'DRUM 鼓击',
      'mode.taiko.desc': '双色连打 · 鼓点炸裂',
      'mode.catch.tag': 'CATCH 接果',
      'mode.catch.desc': '瞬息横移 · 全果收齐',
      'mode.mania.tag': 'KEYS 键阵',
      'mode.mania.desc': '多轨齐发 · 十指风暴',
      'menu.hint': '选一个模式进入选曲 · 演示谱面可直接游玩',
      'select.tip': '选一张谱面 → 开始',
      'select.start': '开始 ▶',
      'play.quit': '✕ 退出',
      'play.pause': '❚❚ 暂停',
      'pause.title': '已暂停',
      'pause.resume': '继续',
      'pause.retry': '重来',
      'pause.quit': '退出',
      'result.retry': '重来',
      'result.card': '成绩卡',
      'result.replay': '回放',
      'result.menu': '返回菜单',
      'dl.search': '搜索歌名 / 谱师 / 谱面集 ID',
      'dl.all': '全部',
      'dl.latest': '最新',
      'dl.ranked': '已 Ranked',
      'dl.back': '← 菜单',
      'dl.download': '下载',
      'common.back': '← 菜单',
      'common.home': '← 主页',
      'select.empty': '这个模式还没有谱面，点右上 IMPORT 导入 .osz',
      'select.diffs': '难度',
      'select.deleted': '已删除',
      'select.objects': '个物件',
      'select.mappedby': '谱师',
      'set.clear': '清除缓存歌曲',
      'set.clearDesc': '删除全部已导入的谱面（含音频与背景），此操作不可恢复；内置演示谱不受影响',
      'set.clearWarn': '警告：将清除所有导入歌曲与音频缓存，且无法恢复（演示谱保留）',
      'set.cleared': '已清除所有导入歌曲',
      'set.clearBtn': '清除曲库',
      'set.clearSure': '确认清除？点第二次执行',
      'dl.reading': '正在读取谱面包…',
      'dl.fail': '导入失败',
      'dl.pick': '请选择 .osz 或 .osu（可同时带音频）',
      'dl.imported': '已导入',
      'dl.searching': '搜索中…',
      'dl.noresult': '没有结果',
      'dl.unreachable': '接口不可达 · 可直接输入谱面集 ID（纯数字）下载',
      'dl.more': '加载更多',
      'dl.direct': '直接下载 · 谱面集',
      'result.pp': 'pp（估算）',
      'result.score': '分',
      'pause.countdown': '继续',
      'np.open': '选择 ▸',
      'np.sets': '套',
      'dl.nomore': '没有更多了',
      'dl.failed': '下载失败',
      'parse.fail': '谱面解析失败',
      'calib.tap': '跟着节拍敲击（空格 / 点击）…',
      'calib.avg': '平均偏移',
      'calib.hint': '跟着节拍敲空格或点击此处',
      'calib.apply': '应用偏移',
      'calib.clear': '清零',
      'calib.applied': '偏移已应用',
      'calib.cleared': '偏移已清零'
    },
    en: {
      'menu.play': 'PLAY',
      'menu.import': 'IMPORT .OSZ',
      'menu.download': 'DOWNLOAD',
      'menu.settings': 'SETTINGS',
      'mode.std.tag': 'AIM',
      'mode.std.desc': 'precision aim · every circle on point',
      'mode.taiko.tag': 'DRUM',
      'mode.taiko.desc': 'dual-color strikes · thunder beat',
      'mode.catch.tag': 'CATCH',
      'mode.catch.desc': 'lightning reflexes · full fruit parade',
      'mode.mania.tag': 'KEYS',
      'mode.mania.desc': 'multi-lane storm · ten-finger barrage',
      'menu.hint': 'pick a mode to browse songs · demo charts are playable',
      'select.tip': 'pick a beatmap → START',
      'select.start': 'START ▶',
      'play.quit': '✕ QUIT',
      'play.pause': '❚❚ PAUSE',
      'pause.title': 'PAUSED',
      'pause.resume': 'RESUME',
      'pause.retry': 'RETRY',
      'pause.quit': 'QUIT',
      'result.retry': 'RETRY',
      'result.card': 'SCORE CARD',
      'result.replay': 'REPLAY',
      'result.menu': 'MENU',
      'dl.search': 'search title / mapper / beatmapset id',
      'dl.all': 'All',
      'dl.latest': 'Latest',
      'dl.ranked': 'Ranked',
      'dl.back': '← MENU',
      'dl.download': 'DOWNLOAD',
      'common.back': '← MENU',
      'common.home': '← HOME',
      'select.empty': 'no beatmaps in this mode yet · hit IMPORT to load an .osz',
      'select.diffs': 'DIFFICULTIES',
      'select.deleted': 'deleted',
      'select.objects': 'objects',
      'select.mappedby': 'mapped by',
      'set.clear': 'Clear cached songs',
      'set.clearDesc': 'Deletes every imported beatmap (audio + background included). This cannot be undone; the built-in demos stay.',
      'set.clearWarn': 'Warning: this wipes all imported songs and audio cache permanently (demos are kept).',
      'set.cleared': 'all imported songs cleared',
      'set.clearBtn': 'CLEAR LIBRARY',
      'set.clearSure': 'SURE? click again',
      'dl.reading': 'reading beatmap package…',
      'dl.fail': 'import failed',
      'dl.pick': 'choose an .osz or .osu file (audio optional)',
      'dl.imported': 'imported',
      'dl.searching': 'searching…',
      'dl.noresult': 'no results',
      'dl.unreachable': 'mirrors unreachable · type a beatmapset id (digits) to download directly',
      'dl.more': 'Load more',
      'dl.direct': 'DIRECT DOWNLOAD · SET',
      'result.pp': 'pp (estimated)',
      'result.score': 'score',
      'pause.countdown': 'resume',
      'np.open': 'SELECT ▸',
      'np.sets': 'SETS',
      'dl.nomore': 'no more results',
      'dl.failed': 'download failed',
      'parse.fail': 'beatmap parse failed',
      'calib.tap': 'tap along to the beat (space / click)…',
      'calib.avg': 'average offset',
      'calib.hint': 'tap space or click here on the beat',
      'calib.apply': 'APPLY OFFSET',
      'calib.clear': 'CLEAR',
      'calib.applied': 'offset applied',
      'calib.cleared': 'offset cleared'
    }
  };

  var cur = 'zh';
  var I = OSUN.i18n = {};

  function siteLang() {
    try {
      var s = window.localStorage.getItem('lang') || window.localStorage.getItem('site_lang') || window.localStorage.getItem('gh_lang');
      if (s && /en/i.test(s)) return 'en';
      if (s && /zh/i.test(s)) return 'zh';
    } catch (e) {}
    return (document.documentElement.lang || '').toLowerCase().indexOf('en') === 0 ? 'en' : 'zh';
  }

  I.lang = function () { return cur; };
  I.t = function (k) {
    var d = D[cur] || D.zh;
    return d[k] != null ? d[k] : (D.zh[k] != null ? D.zh[k] : k);
  };

  I.load = function () {
    var s = null;
    try { s = window.localStorage.getItem(KEY); } catch (e) {}
    cur = (s === 'en' || s === 'zh') ? s : siteLang();
    I.apply();
    setTimeout(function () { I.apply(); }, 0);
    return cur;
  };

  I.set = function (lang) {
    cur = lang === 'en' ? 'en' : 'zh';
    try { window.localStorage.setItem(KEY, cur); } catch (e) {}
    /* 先重绘（重绘会覆盖静态文案），再统一套一遍字典 */
    if (OSUN.ui && OSUN.ui.renderMenu) OSUN.ui.renderMenu();
    if (OSUN.ui && OSUN.ui.renderSelect && OSUN.S && OSUN.S.view === 'select') OSUN.ui.renderSelect();
    I.apply();
    setTimeout(function () { I.apply(); }, 0);
  };

  I.toggle = function () { I.set(cur === 'zh' ? 'en' : 'zh'); };

  I.apply = function () {
    Array.prototype.forEach.call(document.querySelectorAll('#osu-layer [data-o]'), function (n) {
      var k = n.getAttribute('data-o');
      if (n.hasAttribute('data-o-ph')) n.setAttribute('placeholder', I.t(k));
      else n.textContent = I.t(k);
    });
    /* 语言按钮组（和主页 .lang-switch 一样：EN / ZH 两个，当前语言高亮） */
    var sw = document.getElementById('osu-lang-switch');
    if (sw) {
      Array.prototype.forEach.call(sw.querySelectorAll('[data-olang]'), function (b) {
        b.classList.toggle('active', b.getAttribute('data-olang') === cur);
      });
    }
    if (OSUN.settings && OSUN.settings.refresh) OSUN.settings.refresh();
  };
})();
