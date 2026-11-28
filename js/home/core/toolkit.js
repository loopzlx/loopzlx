/* toolkit.js —— v5.2
 * 存档码（导出/导入/合并）、/diag 自检、关于面板、无障碍补丁
 * 依赖：无（可选 window.LZXAch / window.CyberTheme）
 */
(function () {
    'use strict';
  /* 写入 innerHTML 前转义（名称 / 段位 / 币种码等可能来自存档码、分享链接或外部接口） */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

    if (window.LZXTool) return;

    var T = window.LZXTool = {};
    var VERSION = '1.0';

    /* ============================== 白名单 ============================== */
    /* 会被打包进存档码的 key（成绩、进度、偏好）；临时缓存类一律排除 */
    var KEYS = [
        'osu.best.v2', 'osu.board.v1', 'osu.history.v1', 'osu_settings', 'osu_keybinds', 'osu.profile', 'osu.skin', 'osu_lang', 'osu_local_favorites_v1', 'osu_local_recent_v1', 'osu.replay.v1', 'osu_modes_played_v1', 'lzx.osu.modes',
        'celeste.pb.v1', 'celeste.custom.v1', 'celeste.lib.v1', 'celeste.ghost.v1', 'celeste.settings.v2', 'celeste.keys.v1',
        'gh_2048_best', 'gh_2048_save_v1', 'gh_snake_best', 'gh_snake_save_v1', 'gh_mines_best', 'gh_mines_save_v1', 'gh_lang',
        'lzx.ach.v1', 'lzx.ach.seen', 'lzx.ach.total',
        'lzx.theme', 'theme', 'lzx.motion', 'lzx.lowpower', 'lzx.visits', 'lzx.lang', 'lzx.hist', 'lzx.lastview', 'lzx.rememberview', 'lzx.uid', 'site_lang', 'lang'
    ];
    var PREFIX_KEYS = ['lzx.ach.cnt.', 'osu.best.v2.', 'osu.board.v1.', 'osu.history.v1.'];
    /* 体积大、可选的（默认勾选） */
    var HEAVY = ['celeste.custom.v1', 'celeste.lib.v1', 'celeste.ghost.v1', 'osu.board.v1', 'osu.replay.v1'];

    function isKey(k) {
        if (KEYS.indexOf(k) >= 0) return true;
        for (var i = 0; i < PREFIX_KEYS.length; i++) if (k.indexOf(PREFIX_KEYS[i]) === 0) return true;
        return false;
    }

    function collect(includeHeavy) {
        var d = {};
        try {
            for (var i = 0; i < localStorage.length; i++) {
                var k = localStorage.key(i);
                if (!isKey(k) || /(^|\.)cache|__lzx_probe/i.test(k)) continue;
                if (!includeHeavy && HEAVY.indexOf(k) >= 0) continue;
                var v = localStorage.getItem(k);
                if (v != null) d[k] = v;
            }
        } catch (e) {}
        return d;
    }

    /* ============================== 编码 ============================== */
    function b64u(u8) {
        var s = '', i;
        for (i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
        return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
    function unb64u(str) {
        str = str.replace(/-/g, '+').replace(/_/g, '/');
        while (str.length % 4) str += '=';
        var s = atob(str), u8 = new Uint8Array(s.length), i;
        for (i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
        return u8;
    }
    function fnv(s) {
        var h = 0x811c9dc5;
        for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
        return ('0000000' + h.toString(16)).slice(-8);
    }

    async function pack(obj) {
        var json = JSON.stringify(obj);
        var bytes = new TextEncoder().encode(json);
        var gz = null;
        try {
            if (typeof CompressionStream === 'function') {
                var st = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
                gz = new Uint8Array(await new Response(st).arrayBuffer());
            }
        } catch (e) { gz = null; }
        var prefix = gz ? 'LZX1G' : 'LZX1R';
        return prefix + '-' + b64u(gz || bytes) + '-' + fnv(json);
    }

    async function unpack(code) {
        code = String(code || '').replace(/\s+/g, '');
        var m = code.match(/^LZX1([GR])-([A-Za-z0-9_-]+)-([0-9a-f]{8})$/);
        if (!m) throw new Error('格式不对（应以 LZX1G- / LZX1R- 开头，末尾 8 位校验）');
        var u8 = unb64u(m[2]), text;
        if (m[1] === 'G') {
            if (typeof DecompressionStream !== 'function') throw new Error('当前浏览器不支持解压，请用 Chrome');
            var st = new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'));
            text = await new Response(st).text();
        } else {
            text = new TextDecoder().decode(u8);
        }
        if (fnv(text) !== m[3]) throw new Error('校验失败：存档码可能被截断或改动过');
        var obj = JSON.parse(text);
        if (!obj || obj.app !== 'lzx' || !obj.data) throw new Error('这不是 LOOPZLX 的存档码');
        if (obj.v > 2) throw new Error('存档版本过高（v' + obj.v + '），请用更新的站点导入');
        return obj;
    }

    /* ============================== 合并 ============================== */
    function numMax(a, b) {
        var x = parseFloat(a), y = parseFloat(b);
        if (!isFinite(x)) return b;
        if (!isFinite(y)) return a;
        return x >= y ? a : b;
    }
    function numMin(a, b) {
        var x = parseFloat(a), y = parseFloat(b);
        if (!isFinite(x)) return b;
        if (!isFinite(y)) return a;
        return x <= y ? a : b;
    }
    function jsonTry(s) { try { return JSON.parse(s); } catch (e) { return null; } }

    /* 返回 { value, action: 'write'|'keep' } */
    function mergeValue(key, local, incoming) {
        if (local == null) return { value: incoming, action: 'write' };
        if (/settings|keybind|skin|lang|theme|motion|lowpower|profile|favorites|recent|lastview|rememberview/.test(key)) return { value: incoming, action: 'write' };

        /* 纯数字型最佳值 */
        if (/^gh_(2048|snake|mines)_best$/.test(key) || key === 'lzx.ach.total') {
            var w = numMax(local, incoming);
            return { value: w === local ? local : incoming, action: w === local ? 'keep' : 'write' };
        }

        var lo = jsonTry(local), inc = jsonTry(incoming);

        /* osu PB：{beatmapKey: score} */
        if (key === 'osu.best.v2' && lo && inc && typeof lo === 'object' && typeof inc === 'object') {
            var merged = {}, changed = false, k;
            for (k in lo) merged[k] = lo[k];
            for (k in inc) {
                if (!(k in merged)) { merged[k] = inc[k]; changed = true; }
                else {
                    var a = merged[k], b = inc[k];
                    var sa = typeof a === 'object' ? (a.score || a.s || 0) : a;
                    var sb = typeof b === 'object' ? (b.score || b.s || 0) : b;
                    if (parseFloat(sb) > parseFloat(sa)) { merged[k] = b; changed = true; }
                }
            }
            return { value: JSON.stringify(merged), action: changed ? 'write' : 'keep' };
        }

        /* Celeste PB：{关卡: 时间}，越小越好 */
        if (key === 'celeste.pb.v1' && lo && inc && typeof lo === 'object' && typeof inc === 'object') {
            var m2 = {}, c2 = false, kk;
            for (kk in lo) m2[kk] = lo[kk];
            for (kk in inc) {
                if (!(kk in m2)) { m2[kk] = inc[kk]; c2 = true; }
                else if (numMin(m2[kk], inc[kk]) === inc[kk] && inc[kk] !== m2[kk]) { m2[kk] = inc[kk]; c2 = true; }
            }
            return { value: JSON.stringify(m2), action: c2 ? 'write' : 'keep' };
        }

        /* osu 本地榜：数组，按分数去重取前 10 */
        if (key === 'osu.board.v1' && Array.isArray(lo) && Array.isArray(inc)) {
            var all = lo.concat(inc).filter(function (x) { return x && (x.score || x.s); });
            var seen = {}, out = [];
            all.sort(function (p, q) { return (q.score || q.s || 0) - (p.score || p.s || 0); });
            for (var j = 0; j < all.length && out.length < 10; j++) {
                var sig = (all[j].beatmap || all[j].mod || '') + '|' + (all[j].score || all[j].s);
                if (seen[sig]) continue;
                seen[sig] = 1; out.push(all[j]);
            }
            var nLocal = lo.length, nOut = out.length;
            return { value: JSON.stringify(out), action: nOut > nLocal ? 'write' : 'keep' };
        }

        /* 成就：对象并集，保留更早的解锁时间 */
        if ((key === 'lzx.ach.v1' || key === 'lzx.ach.seen') && lo && inc && typeof lo === 'object') {
            var m3 = {}, c3 = false, k3;
            for (k3 in lo) m3[k3] = lo[k3];
            for (k3 in inc) {
                if (!(k3 in m3)) { m3[k3] = inc[k3]; c3 = true; }
                else if (inc[k3] && lo[k3] && String(inc[k3]) < String(lo[k3])) { m3[k3] = inc[k3]; c3 = true; }
                else if (!lo[k3] && inc[k3]) { m3[k3] = inc[k3]; c3 = true; }
            }
            return { value: JSON.stringify(m3), action: c3 ? 'write' : 'keep' };
        }

        /* 自制图 / 图库：按 name 去重，本地优先 */
        if ((key === 'celeste.custom.v1' || key === 'celeste.lib.v1') && Array.isArray(lo) && Array.isArray(inc)) {
            var names = {}, add = 0;
            lo.forEach(function (x) { if (x && x.name) names[x.name] = 1; });
            var res = lo.slice();
            inc.forEach(function (x) {
                if (!x) return;
                if (x.name && names[x.name]) return;
                if (x.name) names[x.name] = 1;
                res.push(x); add++;
            });
            return { value: JSON.stringify(res), action: add ? 'write' : 'keep' };
        }

        /* 其它（设置/主题/提醒）：保留本机 */
        return { value: local, action: 'keep' };
    }

    /* osu 曲库在 IndexedDB：可选加入存档码（Blob 转 dataURL，恢复为 Blob） */
    function blobToDataURL(blob) {
        if (!blob) return Promise.resolve(null);
        return new Promise(function (resolve, reject) {
            var fr = new FileReader(); fr.onload = function () { resolve(fr.result); }; fr.onerror = function () { reject(fr.error); }; fr.readAsDataURL(blob);
        });
    }
    function dataURLToBlob(data) {
        if (!data) return null;
        var m = String(data).match(/^data:([^;,]+)?;base64,(.*)$/); if (!m) return null;
        var raw = atob(m[2]), bytes = new Uint8Array(raw.length); for (var i=0;i<raw.length;i++) bytes[i]=raw.charCodeAt(i);
        return new Blob([bytes], {type:m[1] || 'application/octet-stream'});
    }
    function readOsuLibrary() {
        return new Promise(function (resolve) {
            if (!window.indexedDB) return resolve([]);
            var req = indexedDB.open('loopzlx-osu', 1);
            req.onerror = function () { resolve([]); };
            req.onupgradeneeded = function () { if (!req.result.objectStoreNames.contains('library')) req.result.createObjectStore('library', {keyPath:'id'}); };
            req.onsuccess = function () { var d=req.result; try { var tx=d.transaction('library','readonly'), get=tx.objectStore('library').getAll(); get.onsuccess=async function(){
                var list=get.result||[]; try { for(var i=0;i<list.length;i++){list[i].audioBlobData=await blobToDataURL(list[i].audioBlob);list[i].bgBlobData=await blobToDataURL(list[i].bgBlob);delete list[i].audioBlob;delete list[i].bgBlob;} resolve(list); } catch(e){resolve([]);} d.close();
            }; get.onerror=function(){resolve([]);d.close();}; } catch(e){resolve([]);d.close();} };
        });
    }
    function writeOsuLibrary(list) {
        if (!Array.isArray(list) || !list.length || !window.indexedDB) return Promise.resolve(0);
        return new Promise(function(resolve){ var req=indexedDB.open('loopzlx-osu',1); req.onerror=function(){resolve(0);}; req.onupgradeneeded=function(){if(!req.result.objectStoreNames.contains('library'))req.result.createObjectStore('library',{keyPath:'id'});}; req.onsuccess=function(){var d=req.result;try{var tx=d.transaction('library','readwrite'),s=tx.objectStore('library'),n=0;list.forEach(function(rec){var x=Object.assign({},rec);x.audioBlob=dataURLToBlob(x.audioBlobData);x.bgBlob=dataURLToBlob(x.bgBlobData);delete x.audioBlobData;delete x.bgBlobData;s.put(x);n++;});tx.oncomplete=function(){d.close();resolve(n);};tx.onerror=function(){d.close();resolve(0);};}catch(e){d.close();resolve(0);}}; });
    }

    /* ============================== 导出 / 导入 API ============================== */
    /* ---- 分享链接 / 二维码 ---- */
    var QR_SRC = (function () {
        var s = document.currentScript, q = (s && s.src && s.src.match(/\?v=[0-9.]+/)) || [''];
        return 'js/home/core/qr.js' + q[0];
    })();
    function loadQR() {
        if (window.LZXQR) return Promise.resolve(window.LZXQR);
        return new Promise(function (resolve, reject) {
            var s = document.createElement('script');
            s.src = QR_SRC; s.onload = function () { resolve(window.LZXQR); };
            s.onerror = function () { reject(new Error('二维码模块加载失败')); };
            document.head.appendChild(s);
        });
    }
    /* 存档放在 URL 的 # 片段里：片段不会随请求发给任何服务器，只有打开链接的浏览器能读到 */
    T.shareLink = function (code) { return location.href.split('#')[0].split('?')[0] + '#lzx=' + code; };

    T.exportCode = async function (includeHeavy) {
        var data = collect(includeHeavy !== false);
        var library = includeHeavy !== false ? await readOsuLibrary() : [];
        var count = Object.keys(data).length + (library.length ? 1 : 0);
        if (!count) throw new Error('本地还没有任何存档');
        var code = await pack({ v: 2, at: Date.now(), app: 'lzx', ver: VERSION, data: data, osuLibrary: library });
        return { code: code, count: count, libraryCount: library.length, bytes: code.length };
    };

    T.inspectCode = async function (code) {
        var obj = await unpack(code);
        var data = obj.data, keys = Object.keys(data).filter(isKey), heavy = 0;
        keys.forEach(function (k) { if (HEAVY.indexOf(k) >= 0) heavy++; });
        return { at: obj.at, keys: keys, heavy: heavy, libraryCount: (obj.osuLibrary || []).length, ver: obj.ver };
    };

    /* apply=true 才真正写入；否则只返回预览 */
    T.importCode = async function (code, apply) {
        var obj = await unpack(code);
        var rawData = obj.data || {}, data = {}, writes = [], keeps = [], k;
        /* 只收白名单 key + 字符串值，防止存档码往 localStorage 写任意键 */
        Object.keys(rawData).forEach(function (key) {
            if (isKey(key) && typeof rawData[key] === 'string') data[key] = rawData[key];
        });
        var current = {};
        for (k in data) current[k] = localStorage.getItem(k);
        for (k in data) {
            var r = mergeValue(k, current[k], data[k]);
            (r.action === 'write' ? writes : keeps).push(k);
        }
        if (apply) {
            writes.forEach(function (key) {
                var r = mergeValue(key, current[key], data[key]);
                try { localStorage.setItem(key, r.value); } catch (e) {}
            });
            /* 设置类 / 偏好类从存档同步；PB 与计数仍按合并规则 */
            Object.keys(data).forEach(function(key){ if (/settings|keybind|skin|lang|theme|motion|lowpower|profile|favorites|recent|lastview|rememberview/i.test(key) && data[key] != null) { try{localStorage.setItem(key,data[key]);}catch(e){} } });
        }
        var libCount = 0; if (apply && obj.osuLibrary && obj.osuLibrary.length) libCount = await writeOsuLibrary(obj.osuLibrary);
        return { writes: writes, keeps: keeps, total: Object.keys(data).length, libraryCount: libCount, incomingLibraryCount: (obj.osuLibrary || []).length };
    };

    /* ============================== 自检 /diag ============================== */
    function bytesOfStorage() {
        var n = 0;
        try {
            for (var i = 0; i < localStorage.length; i++) {
                var k = localStorage.key(i);
                n += k.length + (localStorage.getItem(k) || '').length;
            }
        } catch (e) {}
        return n;
    }
    function kb(n) { return (n / 1024).toFixed(1) + ' KB'; }

    function measureFps() {
        return new Promise(function (resolve) {
            var frames = 0, t0 = performance.now();
            function tick() {
                frames++;
                if (performance.now() - t0 >= 700) resolve(Math.round(frames * 1000 / (performance.now() - t0)));
                else requestAnimationFrame(tick);
            }
            requestAnimationFrame(tick);
            setTimeout(function () { resolve(Math.round(frames * 1000 / (performance.now() - t0))); }, 900);
        });
    }

    var errCount = 0, errLast = '';
    window.addEventListener('error', function (e) { errCount++; errLast = (e.message || '') + ' @ ' + (e.filename || '').split('/').pop() + ':' + (e.lineno || 0); });
    window.addEventListener('unhandledrejection', function (e) { errCount++; errLast = 'promise: ' + String(e.reason).slice(0, 80); });

    T.diag = async function () {
        var rows = [], ok = 0, bad = 0;
        function add(name, state, detail) {
            rows.push({ name: name, state: state, detail: detail || '' });
            if (state === 'ok') ok++; else if (state === 'fail') bad++;
        }

        /* 1. 存储 */
        try { localStorage.setItem('__lzx_probe', '1'); localStorage.removeItem('__lzx_probe'); add('localStorage', 'ok', kb(bytesOfStorage())); }
        catch (e) { add('localStorage', 'fail', '不可写（可能是隐私模式 / 配额满）'); }

        /* 2. 模块 */
        [['osu', window.OsuWarp], ['gamehub', window.GameHubWarp], ['celeste', window.CelesteWarp], ['achievements', window.LZXAch], ['theme', window.CyberTheme], ['player', window.CyberAudioPlayer]].forEach(function (p) {
            add('module:' + p[0], p[1] ? 'ok' : 'fail', p[1] ? '' : '未挂载');
        });

        /* 3. Service Worker / 离线 */
        if ('serviceWorker' in navigator) {
            try {
                var regs = await navigator.serviceWorker.getRegistrations();
                add('serviceWorker', regs.length ? 'ok' : 'warn', regs.length ? (navigator.serviceWorker.controller ? 'controlling' : 'registered') : '未注册（file:// 下正常）');
            } catch (e) { add('serviceWorker', 'warn', '查询失败'); }
        } else add('serviceWorker', 'warn', '浏览器不支持');

        /* 4. 渲染性能 */
        try {
            var fps = await measureFps();
            var headless = /HeadlessChrome/.test(navigator.userAgent);
            add('fps', fps >= 50 ? 'ok' : (fps >= 30 ? 'warn' : (headless ? 'warn' : 'fail')),
                fps + ' fps' + (fps < 30 && headless ? '（无头/后台环境偏低属正常）' : ''));
        } catch (e) { add('fps', 'warn', '无法测量'); }

        /* 5. 资源版本与缺失 */
        try {
            var res = performance.getEntriesByType('resource') || [];
            var ver = '0';
            res.forEach(function (r) {
                var m = r.name.match(/\?v=([0-9.]+)/);
                if (m && (parseFloat(m[1]) || 0) > (parseFloat(ver) || 0)) ver = m[1];
            });
            add('assetVersion', ver === '0' ? 'warn' : 'ok', 'v=' + (ver === '0' ? '未标注' : ver) + ' · ' + res.length + ' 资源');
            var failed = res.filter(function (r) { return r.transferSize === 0 && r.duration > 0 && /\.js|\.css/.test(r.name); });
            if (failed.length) add('missingAssets', 'warn', failed.length + ' 个脚本/样式未取到');
        } catch (e) {}

        /* 6. 运行时错误 */
        add('runtimeErrors', errCount === 0 ? 'ok' : 'fail', errCount ? (errCount + ' 次 · ' + errLast) : '0');

        /* 7. 存档体积 */
        try {
            var heavy = 0;
            HEAVY.forEach(function (k) { heavy += (localStorage.getItem(k) || '').length; });
            add('saveFootprint', heavy > 300000 ? 'warn' : 'ok', '存档码源 ' + kb(bytesOfStorage()) + ' / 大件 ' + kb(heavy));
        } catch (e) {}

        /* 8. 环境 */
        var ua = navigator.userAgent;
        var envName = 'browser';
        if (/Edg\/([0-9.]+)/.test(ua)) envName = 'Edge ' + RegExp.$1;
        else if (/Chrome\/([0-9.]+)/.test(ua)) envName = 'Chrome ' + RegExp.$1;
        else if (/Firefox\/([0-9.]+)/.test(ua)) envName = 'Firefox ' + RegExp.$1;
        else if (/Version\/([0-9.]+).*Safari/.test(ua)) envName = 'Safari ' + RegExp.$1;
        add('env', 'ok', envName + ' · ' + window.innerWidth + '×' + window.innerHeight);

        return { rows: rows, ok: ok, bad: bad, at: Date.now() };
    };

    /* ============================== 面板 UI ============================== */
    var wrap = null, curTab = 'about';

    function el(tag, cls, html) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (html != null) e.innerHTML = html;
        return e;
    }

    function build() {
        wrap = el('div', 'lzx-tool');
        wrap.hidden = true;
        wrap.innerHTML =
            '<div class="lzx-tool-box">' +
            '  <div class="lzx-tool-head">' +
            '    <div class="lzx-tool-tabs">' +
            '      <button data-tab="about" class="on">关于</button>' +
            '      <button data-tab="save">存档码</button>' +
            '      <button data-tab="diag">自检</button>' +
            '    </div>' +
            '    <button class="lzx-tool-x" aria-label="关闭">×</button>' +
            '  </div>' +
            '  <div class="lzx-tool-body"></div>' +
            '</div>';
        document.body.appendChild(wrap);

        wrap.addEventListener('click', function (e) {
            if (e.target === wrap) close();
            var tabBtn = e.target.closest('[data-tab]');
            if (tabBtn) switchTab(tabBtn.getAttribute('data-tab'));
            if (e.target.closest('.lzx-tool-x')) close();
        });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !wrap.hidden) close(); });

        switchTab(curTab);
    }

    function switchTab(name) {
        curTab = name;
        wrap.querySelectorAll('.lzx-tool-tabs button').forEach(function (b) {
            b.classList.toggle('on', b.getAttribute('data-tab') === name);
        });
        var body = wrap.querySelector('.lzx-tool-body');
        body.innerHTML = '';
        if (name === 'about') renderAbout(body);
        else if (name === 'save') renderSave(body);
        else renderDiag(body);
    }

    function renderAbout(body) {
        var res = performance.getEntriesByType('resource') || [];
        var ver = '0';
        res.forEach(function (r) {
            var m = r.name.match(/\?v=([0-9.]+)/);
            if (m && (parseFloat(m[1]) || 0) > (parseFloat(ver) || 0)) ver = m[1];
        });
        if (ver === '0') ver = '?';
        body.innerHTML =
            '<div class="lzx-tool-pane">' +
            '  <div class="lzx-about-hero"><b>LOOPZLX</b><span>CYBER NEXUS TERMINAL</span></div>' +
            '  <div class="lzx-about-rows">' +
            '    <div><span>版本</span><b>v' + ver + '</b></div>' +
            '    <div><span>架构</span><b>静态单页 + 按需注入覆盖层</b></div>' +
            '    <div><span>模块</span><b>osu! · gamehub · celeste</b></div>' +
            '    <div><span>存储</span><b>localStorage（无服务端）</b></div>' +
            '    <div><span>字体</span><b>Orbitron / Share Tech Mono</b></div>' +
            '  </div>' +
            '  <div class="lzx-about-keys">' +
            '    <div class="lzx-about-keys-t">快捷键</div>' +
            '    <div class="lzx-kk"><kbd>Cmd/Ctrl</kbd>+<kbd>K</kbd><span>命令面板</span></div>' +
            '    <div class="lzx-kk"><kbd>Esc</kbd><span>关闭当前覆盖层</span></div>' +
            '    <div class="lzx-kk"><kbd>?</kbd><span>快捷键速查</span></div>' +
            '    <div class="lzx-kk"><kbd>/</kbd><span>聚焦终端输入</span></div>' +
            '  </div>' +
            '  <div class="lzx-about-tip">终端里还藏着 <b>/diag</b> · <b>/save</b> · <b>/load</b> · <b>/pb</b>，试试看。</div>' +
            '</div>';
    }

    function renderSave(body) {
        body.innerHTML =
            '<div class="lzx-tool-pane">' +
            '  <div class="lzx-save-note">存档码把成绩、成就、自制图打包成一段文本，贴到另一台设备就能导回来；也可以生成<b>分享链接 / 二维码</b>，手机扫一下就能打开并提示导入。<b>不会上传任何服务器</b>（链接把存档放在 # 之后，只有打开它的浏览器能读到）。</div>' +
            '  <label class="lzx-save-opt"><input type="checkbox" id="lzx-save-heavy" checked> 包含大件数据：自制图、Celeste 图库/影子、osu 回放与导入曲库（可能很长）</label>' +
            '  <div class="lzx-save-btns">' +
            '    <button id="lzx-do-export">生成存档码</button>' +
            '    <button id="lzx-do-copy" disabled>复制</button>' +
            '    <button id="lzx-do-dl" disabled>下载 .txt</button>' +
            '    <button id="lzx-do-link" disabled>复制分享链接</button>' +
            '    <button id="lzx-do-qr" disabled>二维码</button>' +
            '  </div>' +
            '  <div id="lzx-qr-box" class="lzx-qr-box" hidden></div>' +
            '  <textarea id="lzx-code-out" class="lzx-code" readonly placeholder="点「生成存档码」"></textarea>' +
            '  <div class="lzx-save-sep"></div>' +
            '  <textarea id="lzx-code-in" class="lzx-code" placeholder="在这里粘贴存档码"></textarea>' +
            '  <div class="lzx-save-btns">' +
            '    <button id="lzx-do-check">校验</button>' +
            '    <button id="lzx-do-import" disabled>导入并合并</button>' +
            '  </div>' +
            '  <div id="lzx-save-msg" class="lzx-save-msg"></div>' +
            '</div>';

        var out = body.querySelector('#lzx-code-out');
        var inp = body.querySelector('#lzx-code-in');
        var msg = body.querySelector('#lzx-save-msg');
        var heavy = body.querySelector('#lzx-save-heavy');
        var copyBtn = body.querySelector('#lzx-do-copy');
        var dlBtn = body.querySelector('#lzx-do-dl');
        var impBtn = body.querySelector('#lzx-do-import');
        var linkBtn = body.querySelector('#lzx-do-link');
        var qrBtn = body.querySelector('#lzx-do-qr');
        var qrBox = body.querySelector('#lzx-qr-box');

        function say(text, cls) { msg.className = 'lzx-save-msg' + (cls ? ' ' + cls : ''); msg.textContent = text; }

        body.querySelector('#lzx-do-export').addEventListener('click', async function () {
            try {
                var r = await T.exportCode(heavy.checked);
                out.value = r.code;
                copyBtn.disabled = dlBtn.disabled = linkBtn.disabled = qrBtn.disabled = false;
                qrBox.hidden = true; qrBox.innerHTML = '';
                say('已打包 ' + r.count + ' 项' + (r.libraryCount ? ' · osu 曲库 ' + r.libraryCount + ' 套' : '') + '，' + (r.bytes / 1024).toFixed(1) + ' KB 文本', 'ok');
            } catch (e) { say(String(e.message || e), 'bad'); }
        });
        copyBtn.addEventListener('click', async function () {
            try { await navigator.clipboard.writeText(out.value); say('已复制到剪贴板', 'ok'); }
            catch (e) {
                out.select(); document.execCommand('copy'); say('已复制（兼容模式）', 'ok');
            }
        });
        linkBtn.addEventListener('click', async function () {
            var link = T.shareLink(out.value);
            var note = link.length > 8000 ? '（链接很长 ' + (link.length / 1024).toFixed(1) + ' KB，部分聊天软件会截断，建议改用下载 / 取消大件数据）' : '';
            try { await navigator.clipboard.writeText(link); say('分享链接已复制' + note, link.length > 8000 ? 'bad' : 'ok'); }
            catch (e) { out.value = link; out.select(); document.execCommand('copy'); out.value = link.split('#lzx=')[1]; say('分享链接已复制（兼容模式）' + note, 'ok'); }
        });
        qrBtn.addEventListener('click', async function () {
            if (!qrBox.hidden) { qrBox.hidden = true; return; }
            try {
                var Q = await loadQR();
                var svg = Q.svg(T.shareLink(out.value), { border: 3 });
                if (!svg) { say('存档太大，二维码装不下（上限约 2.9 KB）。取消勾选「包含大件数据」再生成，或改用复制 / 下载。', 'bad'); return; }
                qrBox.innerHTML = svg + '<div class="lzx-qr-cap">用手机相机扫码 → 打开页面 → 核对后点「导入并合并」</div>';
                qrBox.hidden = false;
                say('二维码已生成（含 ' + (out.value.length / 1024).toFixed(1) + ' KB 存档）', 'ok');
            } catch (e) { say(String(e.message || e), 'bad'); }
        });
        dlBtn.addEventListener('click', function () {
            var blob = new Blob([out.value], { type: 'text/plain' });
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'loopzlx-save-' + new Date().toISOString().slice(0, 10) + '.txt';
            a.click();
            setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
        });
        body.querySelector('#lzx-do-check').addEventListener('click', async function () {
            try {
                var info = await T.inspectCode(inp.value);
                var d = new Date(info.at || Date.now());
                say('有效存档 · ' + info.keys.length + ' 项 · 生成于 ' + d.toLocaleString() + (info.heavy ? ' · 含 ' + info.heavy + ' 项大件' : '') + (info.libraryCount ? ' · osu 曲库 ' + info.libraryCount + ' 套' : ''), 'ok');
                impBtn.disabled = false;
            } catch (e) { say(String(e.message || e), 'bad'); impBtn.disabled = true; }
        });
        impBtn.addEventListener('click', async function () {
            try {
                var r = await T.importCode(inp.value, false);
                var go = window.confirm('将写入 ' + r.writes.length + ' 项，保留本机更优的 ' + r.keeps.length + ' 项。\n\n写入：' + (r.writes.slice(0, 6).join('\n') || '（无）') + '\n\n继续？');
                if (!go) { say('已取消', 'ok'); return; }
                var r2 = await T.importCode(inp.value, true);
                say('导入完成 · 写入 ' + r2.writes.length + ' 项，跳过 ' + r2.keeps.length + ' 项' + (r2.libraryCount ? ' · 恢复 osu 曲库 ' + r2.libraryCount + ' 套' : '') + '。刷新页面生效。', 'ok');
                if (window.LZXAch && window.LZXAch.toast) window.LZXAch.toast('存档已合并 · ' + r2.writes.length + ' 项');
            } catch (e) { say(String(e.message || e), 'bad'); }
        });
    }

    async function renderDiag(body) {
        body.innerHTML = '<div class="lzx-tool-pane"><div class="lzx-diag-run">正在自检…</div></div>';
        var r = await T.diag();
        var pane = body.querySelector('.lzx-tool-pane');
        var html = '<div class="lzx-diag-sum">' + (r.bad ? '<b class="bad">' + r.bad + ' 项异常</b>' : '<b class="ok">全部通过</b>') + ' · ' + r.ok + ' 项正常</div><div class="lzx-diag-rows">';
        r.rows.forEach(function (row) {
            html += '<div class="lzx-diag-row ' + row.state + '"><i>' + (row.state === 'ok' ? '●' : row.state === 'warn' ? '▲' : '✕') + '</i><span>' + esc(row.name) + '</span><em>' + esc(row.detail || (row.state === 'ok' ? 'ok' : '')) + '</em></div>';
        });
        html += '</div><div class="lzx-diag-foot"><button id="lzx-diag-again">重新自检</button><button id="lzx-diag-copy">复制报告</button></div>';
        pane.innerHTML = html;
        pane.querySelector('#lzx-diag-again').addEventListener('click', function () { renderDiag(body); });
        pane.querySelector('#lzx-diag-copy').addEventListener('click', function () {
            var text = r.rows.map(function (x) { return '[' + x.state + '] ' + x.name + ' — ' + x.detail; }).join('\n');
            navigator.clipboard.writeText(text).then(function () { pane.querySelector('#lzx-diag-copy').textContent = '已复制'; });
        });
    }

    function open(tab) {
        if (!wrap) build();
        wrap.hidden = false;
        document.body.classList.add('lzx-tool-open');
        if (tab) switchTab(tab);
    }
    function close() {
        if (!wrap) return;
        wrap.hidden = true;
        document.body.classList.remove('lzx-tool-open');
    }
    T.open = function (tab) { open(tab || 'about'); };

    /* 打开 …#lzx=<存档码> 的链接：弹出存档面板、预填并校验；绝不自动写入，必须用户点「导入并合并」确认 */
    function consumeShareHash() {
        var m = /^#lzx=([A-Za-z0-9_.\-]+)$/.exec(location.hash || '');
        if (!m) return;
        try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}   // 地址栏不留存档，刷新也不会重复弹
        open('save');
        var inp = document.getElementById('lzx-code-in'), chk = document.getElementById('lzx-do-check');
        if (!inp || !chk) return;
        inp.value = m[1];
        var note = document.querySelector('.lzx-save-note');
        if (note) note.insertAdjacentHTML('afterbegin', '<b class="lzx-share-flag">检测到分享链接里的存档：请核对内容，确认后再点「导入并合并」（不会自动覆盖）。</b><br>');
        chk.click();
    }
    setTimeout(consumeShareHash, 700);
    T.close = close;
    T.tabs = function (name) { if (wrap && !wrap.hidden) switchTab(name); };

    /* ============================== 无障碍补丁 ============================== */
    var ICON_LABEL = {
        'github': 'GitHub', 'bilibili': '哔哩哔哩', 'twitter': 'Twitter', 'qq': 'QQ', 'weixin': '微信',
        'gamepad': '游戏中心', 'music': '播放器', 'palette': '切换主题', 'trophy': '成就',
        'arrow-up': '回到顶部', 'chevron-up': '展开', 'chevron-down': '收起', 'xmark': '关闭',
        'bars': '菜单', 'sun': '浅色主题', 'moon': '深色主题', 'volume-high': '音量',
        'play': '播放', 'pause': '暂停', 'stop': '停止', 'forward': '下一首', 'backward': '上一首',
        'shuffle': '随机播放', 'repeat': '循环', 'search': '搜索', 'download': '下载',
        'circle-play': '开始游戏', 'house': '返回首页', 'gear': '设置', 'check': '确认',
        'plus': '新增', 'trash': '删除', 'pen': '编辑', 'copy': '复制', 'share': '分享',
        'rotate-left': '撤销', 'rotate-right': '重做', 'volume-xmark': '静音', 'sliders': '设置'
    };

    function labelFrom(el) {
        var t = (el.getAttribute('title') || '').trim();
        if (t) return t;
        var txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (txt) return txt.slice(0, 24);
        var cls = Array.prototype.slice.call(el.classList).join(' ');
        var m = cls.match(/fa-([a-z0-9-]+)/);
        if (m) {
            var n = m[1].replace(/^fa-/, '').replace(/-/g, '-');
            if (ICON_LABEL[n]) return ICON_LABEL[n];
            return n.replace(/-/g, ' ');
        }
        var id = el.id || '';
        if (id) return id.replace(/(\w)(\w*)/g, function (a, b, c) { return b.toUpperCase() + c; }).replace(/-/g, ' ');
        return null;
    }

    function a11yScan() {
        var nodes = document.querySelectorAll('button, a, [role="button"], input[type="text"], input[type="range"]');
        nodes.forEach(function (el) {
            if (el.__lzxA11y) return;
            el.__lzxA11y = 1;
            var label = el.getAttribute('aria-label') || el.getAttribute('title');
            if (!label) {
                var guess = labelFrom(el);
                if (guess) { el.setAttribute('aria-label', guess); if (!el.getAttribute('title') && !(el.textContent || '').trim()) el.setAttribute('title', guess); }
            }
            /* 纯图标按钮补 title 供鼠标悬停提示 */
            if (!el.getAttribute('title') && !(el.textContent || '').trim() && el.getAttribute('aria-label')) {
                el.setAttribute('title', el.getAttribute('aria-label'));
            }
        });
        /* 覆盖层容器补角色，方便读屏识别为对话框 */
        ['osu-layer', 'gamehub-layer', 'celeste-layer', 'cl-set', 'cl-over'].forEach(function (id) {
            var n = document.getElementById(id);
            if (n && !n.getAttribute('role')) { n.setAttribute('role', 'dialog'); n.setAttribute('aria-modal', 'true'); }
        });
    }

    var scanQueued = false;
    function scheduleScan() {
        if (scanQueued) return;
        scanQueued = true;
        setTimeout(function () { scanQueued = false; try { a11yScan(); } catch (e) {} }, 250);
    }

    T.a11y = function () { scheduleScan(); };

    /* ============================== 启动 ============================== */
    function boot() {
        /* 面板入口：More 面板里的 ABOUT 链接（home.html 中定义） */
        document.addEventListener('click', function (e) {
            var trig = e.target.closest('[data-lzx-tool]');
            if (trig) { e.preventDefault(); open(trig.getAttribute('data-lzx-tool')); return; }
            if (e.target.closest('#lzx-tool-open')) { open('about'); }
        });
        a11yScan();
        scheduleScan();
        /* 覆盖层/菜单开关后重新扫描 */
        document.addEventListener('transitionend', scheduleScan, true);
        setTimeout(a11yScan, 2000);
        setTimeout(a11yScan, 5000);

        window.addEventListener('keydown', function (e) {
            /* Alt+A 直达关于/自检，方便没入口时也能开 */
            if (e.altKey && (e.key === 'a' || e.key === 'A')) { e.preventDefault(); open('about'); }
        });

        if (window.console) console.log('[LZXTool] ready v' + VERSION);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
