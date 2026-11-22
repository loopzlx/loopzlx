/* gamehub-i18n.js —— GameHub 中英切换（所有游戏共用一份字典，存 localStorage gh_lang） */
(function () {
    'use strict';

    var GH = window.GH = window.GH || {};
    var KEY = 'gh_lang';

    var DICT = {
        zh: {
            'top.home': '← 主页',
            'top.menu': '← 菜单',
            'top.lang': 'EN',
            'hub.hero': '选择一台街机',
            'hub.select': '选择一个游戏',
            'card.2048.desc': '滑动合并数字 · 支持撤销',
            'card.mines.desc': '三种难度 · 左键揭 / 右键旗',
            'card.snake.desc': '经典贪吃蛇 · 越吃越快',
            'card.celeste.desc': '蔚蓝手感复刻 · 冲刺 / 墙跳',
            'common.score': '得分',
            'common.best': '最高',
            'common.time': '用时',
            'common.mines': '剩余雷',
            'common.undo': '↺ 撤销',
            'common.new': '新局',
            'common.pause': '暂停',
            'common.resume': '继续',
            'common.restart': '重开',
            '2048.over': '无法再移动',
            '2048.newGame': '新的一局',
            '2048.hint': '在屏幕任意位置滑动 / 方向键或 WASD / 鼠标拖拽',
            'mines.easy': '初级 9×9 · 10',
            'mines.medium': '中级 16×16 · 40',
            'mines.hard': '高级 16×30 · 99',
            'mines.boom': '踩雷了',
            'mines.cleared': '全部清空',
            'mines.again': '再来一局',
            'mines.hint': '左键揭开 · 右键或长按插旗 · 数字为周围雷数 · 点数字可快速展开',
            'snake.over': '游戏结束',
            'snake.again': '再来一局',
            'snake.win': '满屏通关 · ',
            'snake.hint': '整屏滑动 / 方向键或 WASD / 点击转向 · 空格暂停',
            'toast.newgame': '新的一局',
            'toast.undo': '已撤销',
            'toast.nohistory': '没有可撤销的步骤',
            'toast.paused': '已暂停',
            'toast.resume': '继续',
            'toast.reached': '达成 2048',
            'toast.restart': '已重开',
            'over.prefix': '游戏结束 · ',
            'over.moves': '无法再移动 · '
        },
        en: {
            'top.home': '← HOME',
            'top.menu': '← MENU',
            'top.lang': '中文',
            'hub.hero': 'SELECT A CABINET',
            'hub.select': 'SELECT A GAME',
            'card.2048.desc': 'Merge numbers by sliding · undo',
            'card.mines.desc': 'Three levels · click reveal / right-click flag',
            'card.snake.desc': 'Classic snake · speeds up as you grow',
            'card.celeste.desc': 'Celeste-style physics · dash / wall jump',
            'common.score': 'SCORE',
            'common.best': 'BEST',
            'common.time': 'TIME',
            'common.mines': 'MINES',
            'common.undo': '↺ UNDO',
            'common.new': 'NEW',
            'common.pause': 'PAUSE',
            'common.resume': 'RESUME',
            'common.restart': 'RESTART',
            '2048.over': 'NO MORE MOVES',
            '2048.newGame': 'NEW GAME',
            '2048.hint': 'Swipe anywhere / arrow keys or WASD / mouse drag',
            'mines.easy': 'EASY 9×9 · 10',
            'mines.medium': 'MEDIUM 16×16 · 40',
            'mines.hard': 'HARD 16×30 · 99',
            'mines.boom': 'BOOM',
            'mines.cleared': 'CLEARED',
            'mines.again': 'PLAY AGAIN',
            'mines.hint': 'Left click reveal · right click or long-press flag · numbers count nearby mines',
            'snake.over': 'GAME OVER',
            'snake.again': 'PLAY AGAIN',
            'snake.win': 'BOARD FULL · ',
            'snake.hint': 'Swipe anywhere / arrow keys or WASD / click to steer · space pauses',
            'toast.newgame': 'NEW GAME',
            'toast.undo': 'UNDO',
            'toast.nohistory': 'NO HISTORY',
            'toast.paused': 'PAUSED',
            'toast.resume': 'RESUME',
            'toast.reached': '2048 REACHED',
            'toast.restart': 'RESTART',
            'over.prefix': 'GAME OVER · ',
            'over.moves': 'NO MORE MOVES · '
        }
    };

    var I = GH.i18n = {};
    var cur = 'zh';

    function siteLang() {
        try {
            var saved = window.localStorage.getItem('lang') || window.localStorage.getItem('site_lang');
            if (saved && /en/i.test(saved)) return 'en';
            if (saved && /zh/i.test(saved)) return 'zh';
        } catch (e) {}
        var active = document.querySelector('.lang-btn.active');
        if (active) {
            var txt = (active.textContent || '').toLowerCase();
            if (/en/.test(txt)) return 'en';
            if (/中|zh/.test(txt)) return 'zh';
        }
        var htmlLang = (document.documentElement.lang || '').toLowerCase();
        return htmlLang.indexOf('en') === 0 ? 'en' : 'zh';
    }

    I.load = function () {
        var saved = null;
        try { saved = window.localStorage.getItem(KEY); } catch (e) {}
        cur = (saved === 'en' || saved === 'zh') ? saved : siteLang();
        I.apply();
        /* DOM 可能刚注入，下一帧再刷一遍，保证首屏文案和语言一致 */
        setTimeout(function () { I.apply(); }, 0);
        return cur;
    };

    I.lang = function () { return cur; };

    I.t = function (key) {
        var d = DICT[cur] || DICT.zh;
        if (d[key] != null) return d[key];
        return (DICT.zh[key] != null ? DICT.zh[key] : key);
    };

    I.set = function (lang) {
        cur = (lang === 'en') ? 'en' : 'zh';
        try { window.localStorage.setItem(KEY, cur); } catch (e) {}
        I.apply();
        if (GH.G2048 && GH.G2048.onLang) GH.G2048.onLang();
        if (GH.Mines && GH.Mines.onLang) GH.Mines.onLang();
        if (GH.Snake && GH.Snake.onLang) GH.Snake.onLang();
    };

    I.toggle = function () { I.set(cur === 'zh' ? 'en' : 'zh'); };

    /* 静态文本（data-i18n）与属性（data-i18n-ph / data-i18n-title） */
    I.apply = function () {
        /* 用 document 作用域，避免 getElementById 拿到占位节点 */
        var nodes = document.querySelectorAll('#gamehub-app [data-i18n]');
        Array.prototype.forEach.call(nodes, function (n) {
            n.textContent = I.t(n.getAttribute('data-i18n'));
        });
        var ph = document.querySelectorAll('#gamehub-app [data-i18n-title]');
        Array.prototype.forEach.call(ph, function (n) {
            n.setAttribute('title', I.t(n.getAttribute('data-i18n-title')));
        });
        var btn = document.getElementById('gh-lang');
        if (btn) {
            btn.textContent = I.t('top.lang');
            btn.setAttribute('title', cur === 'zh' ? 'Switch to English' : '切换为中文');
        }
    };

    GH.t = function (k) { return I.t(k); };
})();
