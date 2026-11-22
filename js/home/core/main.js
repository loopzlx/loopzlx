(function () {
    'use strict';

    const themes = ['theme-cyber', 'theme-sweet-pink', 'theme-hacker', 'theme-sneaker', 'theme-sunset', 'theme-ocean', 'theme-paper', 'theme-synthwave'];
    let currentTheme = localStorage.getItem('theme') || 'theme-cyber';
    let currentLang = 'en';

    let progress = 0;
    const progressBar = document.getElementById('load-progress');
    const percentText = document.getElementById('load-percent');
    const preloader = document.getElementById('preloader');
    if (progressBar && percentText) {
        const loadInterval = setInterval(() => {
            progress += Math.random() * 20;
            if (progress >= 100) {
                progress = 100;
                clearInterval(loadInterval);
                if (preloader) preloader.classList.add('hidden');
            }
            progressBar.style.width = progress + '%';
            percentText.textContent = Math.floor(progress) + '%';
        }, 100);
    }

    const CyberClock = (function () {
        let intervalId = null;
        let lang = 'en';

        function render() {
            const clock = document.getElementById('live-clock');
            const dateEl = document.getElementById('live-date');
            if (!clock || !dateEl) return;

            const now = new Date();
            const h = String(now.getUTCHours()).padStart(2, '0');
            const m = String(now.getUTCMinutes()).padStart(2, '0');
            const s = String(now.getUTCSeconds()).padStart(2, '0');
            
            clock.innerHTML = `${h}:${m}:${s} <span class="text-[9px] font-normal opacity-50">UTC</span>`;

            const weeks = { en: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'], zh: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] };
            const y = now.getUTCFullYear(), mo = String(now.getUTCMonth() + 1).padStart(2, '0'), d = String(now.getUTCDate()).padStart(2, '0');
            
            dateEl.textContent = `${y}.${mo}.${d} ${weeks[lang][now.getUTCDay()]}`;
        }

        return {
            start() { render(); if (intervalId) clearInterval(intervalId); intervalId = setInterval(render, 1000); },
            stop() { if (intervalId) clearInterval(intervalId); },
            setLang(newLang) { lang = newLang; render(); }
        };
    })();

    const config = {
        zh: { quote: "“代码构建逻辑，跑酷打破重力，设计连接你我。”", words: ["前端工程师", "跑酷玩家", "界面架构师"] },
        en: { quote: '"Code shapes the logic. Movement defies gravity. Design bridges the gap."', words: ["Frontend Engineer", "Traceur", "Interface Architect"] }
    };

    const radarData = [
        { en: "Code", zh: "编程", val: 0.95 }, { en: "Design", zh: "设计", val: 0.82 },
        { en: "Motion", zh: "动效", val: 0.75 }, { en: "Flow", zh: "流动", val: 0.90 },
        { en: "Visual", zh: "视觉", val: 0.85 }, { en: "Logic", zh: "逻辑", val: 0.88 }
    ];

    function makeColorSvg(base, accent, mark) {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400"><rect width="600" height="400" fill="${base}"/><circle cx="480" cy="90" r="170" fill="${accent}" opacity=".13"/><path d="M0 300 L600 170 L600 400 L0 400Z" fill="${accent}" opacity=".10"/><rect x="44" y="44" width="512" height="312" fill="none" stroke="${accent}" opacity=".32"/><text x="60" y="330" font-family="monospace" font-size="26" fill="${accent}" opacity=".8">LZX / ${mark}</text></svg>`;
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }

    const projectList = [
        { cat: 'dev', title: 'Cyber Terminal', en: 'CLI Portfolio', zh: '终端作品集',
          imgCyber: makeColorSvg('#120b20','#8a2be2','01'), imgSneaker: makeColorSvg('#f4eee7','#d2a87a','01') },
        { cat: 'parkour', title: 'Flow Archive', en: 'Urban Movement', zh: '城市影像',
          imgCyber: makeColorSvg('#07131b','#19c7a4','02'), imgSneaker: makeColorSvg('#e8f0ec','#5cae9a','02') },
        { cat: 'dev', title: 'Neural Matrix', en: 'SVG Data Viz', zh: '数据可视化',
          imgCyber: makeColorSvg('#10141f','#4f78ff','03'), imgSneaker: makeColorSvg('#edf0f8','#8299d9','03') }
    ];

    let typingWords = config.en.words;
    let typeTimer = null, wI = 0, cI = 0, isDeleting = false;
    let matrixRunning = false, matrixRaf = null, matrixWasRunning = false;
    let matrixColor = '#8a2be2'; 
    let discoTimer = null, gravityTimer = null;
    let glitchTimer = null, vibrateTimer = null, echoTimer = null;
    let helpRunning = false;
    let mDrops = [];

    const $ = id => document.getElementById(id);
    const logContent = $('log-content');
    const logMode = $('log-mode');
    const typingEl = $('typing-text');
    const mCanvas = $('matrix-canvas');
    const mCtx = mCanvas ? mCanvas.getContext('2d') : null;
    const dCont = $('danmaku-container');

    function prefersReducedMotion() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }

    function addLog(msg) {
        if (!logContent) return;
        const now = new Date().toLocaleTimeString('en-GB', { hour12: false });
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        let color = 'var(--text-main)';
        if (/Critical|FAILURE|WARNING|Error/i.test(msg)) color = 'var(--secondary)';
        if (/Execute|SUCCESS|Active|Granted/i.test(msg)) color = 'var(--primary)';
        const time = document.createElement('span');
        time.className = 'log-time';
        time.textContent = '[' + now + ']';
        const text = document.createElement('span');
        text.style.color = color;
        text.textContent = String(msg).toUpperCase();
        entry.append(time, document.createTextNode(' '), text);
        logContent.appendChild(entry);
        while (logContent.children.length > 100) logContent.removeChild(logContent.firstChild);
        logContent.scrollTop = logContent.scrollHeight;
    }

    function setLang(lang, force) {
        if (!config[lang] || (lang === currentLang && !force)) return;
        currentLang = lang;
        try { localStorage.setItem('lzx.lang', lang); } catch (e) {}
        document.documentElement.lang = (lang === 'zh') ? 'zh-CN' : 'en';
        const els = document.querySelectorAll('[data-en], [data-en-ph], #about-quote');
        els.forEach(el => el.classList.add('lang-fade-out'));

        setTimeout(() => {
            document.querySelectorAll('[data-original]').forEach(n => { n.textContent = n.dataset.original; delete n.dataset.original; });
            document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.lang === lang));
            document.querySelectorAll('[data-en]').forEach(el => {
                const v = el.getAttribute('data-' + lang);
                if (v === null) return;
                let hasElementChild = false;
                el.childNodes.forEach(n => { if (n.nodeType === 1) hasElementChild = true; });
                if (hasElementChild) { el.childNodes.forEach(n => { if (n.nodeType === 3 && n.textContent.trim()) n.textContent = v; }); } 
                else { el.textContent = v; }
            });
            document.querySelectorAll('[data-en-ph]').forEach(el => {
                const v = el.getAttribute('data-' + lang + '-ph');
                if (v !== null) el.placeholder = v;
            });
            const quote = $('about-quote');
            if (quote) quote.textContent = config[lang].quote;
            
            typingWords = config[lang].words;
            restartTyping();
            renderSkillList();
            updateRadarLabels();
            CyberClock.setLang(lang);
            addLog('System: Switched to ' + lang.toUpperCase());
            els.forEach(el => el.classList.remove('lang-fade-out'));
        }, 150);
    }

    function renderSkillList() {
        const el = $('skill-list');
        if (!el) return;
        el.innerHTML = radarData.map(d => `<div class="flex justify-between border-b border-white/5 pb-2"><span>${currentLang === 'en' ? d.en : d.zh}</span><span style="color:var(--secondary)">${Math.round(d.val * 100)}%</span></div>`).join('');
    }

    function restartTyping() { clearTimeout(typeTimer); wI = 0; cI = 0; isDeleting = false; if (typingEl) typingEl.textContent = ''; type(); }
    function type() {
        if (!typingEl) return;
        clearTimeout(typeTimer);
        const word = typingWords[wI] || '';
        typingEl.textContent = isDeleting ? word.substring(0, cI - 1) : word.substring(0, cI + 1);
        cI = isDeleting ? cI - 1 : cI + 1;
        let speed = isDeleting ? 50 : 120;
        if (!isDeleting && cI === word.length) { speed = 2000; isDeleting = true; }
        else if (isDeleting && cI === 0) { isDeleting = false; wI = (wI + 1) % typingWords.length; speed = 500; }
        typeTimer = setTimeout(type, speed);
    }

    const RADAR_CX = 200, RADAR_CY = 200, RADAR_R = 140;
    const radarAngle = i => i * Math.PI * 2 / radarData.length - Math.PI / 2;

    function initRadar() {
        const grids = $('radar-grids'), axes = $('radar-axes'), labels = $('radar-labels');
        if (!grids || !axes || !labels) return;
        grids.innerHTML = ''; axes.innerHTML = ''; labels.innerHTML = '';
        const SVG_NS = 'http://www.w3.org/2000/svg';
        for (let lvl = 1; lvl <= 5; lvl++) {
            const rr = RADAR_R / 5 * lvl;
            const pts = radarData.map((_, i) => `${RADAR_CX + rr * Math.cos(radarAngle(i))},${RADAR_CY + rr * Math.sin(radarAngle(i))}`).join(' ');
            const poly = document.createElementNS(SVG_NS, 'polygon');
            poly.setAttribute('points', pts); poly.setAttribute('fill', 'none'); poly.setAttribute('stroke', 'var(--glass-border)');
            grids.appendChild(poly);
        }
        radarData.forEach((d, i) => {
            const line = document.createElementNS(SVG_NS, 'line');
            line.setAttribute('x1', RADAR_CX); line.setAttribute('y1', RADAR_CY);
            line.setAttribute('x2', RADAR_CX + RADAR_R * Math.cos(radarAngle(i)));
            line.setAttribute('y2', RADAR_CY + RADAR_R * Math.sin(radarAngle(i)));
            line.setAttribute('stroke', 'var(--glass-border)');
            axes.appendChild(line);
            const txt = document.createElementNS(SVG_NS, 'text');
            txt.setAttribute('x', RADAR_CX + (RADAR_R + 32) * Math.cos(radarAngle(i)));
            txt.setAttribute('y', RADAR_CY + (RADAR_R + 28) * Math.sin(radarAngle(i)));
            txt.setAttribute('text-anchor', 'middle'); txt.setAttribute('dominant-baseline', 'middle');
            txt.setAttribute('class', 'radar-label'); txt.setAttribute('data-id', i);
            txt.setAttribute('fill', 'var(--text-main)');
            labels.appendChild(txt);
        });
        updateRadarLabels();
        const svg = $('radar-svg');
        if (!svg) { animateRadar(); return; }
        let animated = false;
        const run = () => { if (animated) return; animated = true; animateRadar(); };
        if ('IntersectionObserver' in window) {
            const io = new IntersectionObserver(entries => { entries.forEach(e => { if (e.isIntersecting) { run(); io.disconnect(); } }); }, { threshold: 0.2 });
            io.observe(svg);
        } else { run(); }
    }

    function updateRadarLabels() {
        document.querySelectorAll('.radar-label').forEach(el => {
            const d = radarData[Number(el.getAttribute('data-id'))];
            if (d) el.textContent = currentLang === 'en' ? d.en : d.zh;
        });
    }

    function animateRadar() {
        const area = $('radar-value-area');
        if (!area) return;
        const apply = (e) => {
            area.setAttribute('points', radarData.map((d, i) => {
                const rr = RADAR_R * d.val * e;
                return `${RADAR_CX + rr * Math.cos(radarAngle(i))},${RADAR_CY + rr * Math.sin(radarAngle(i))}`;
            }).join(' '));
        };
        if (prefersReducedMotion()) { apply(1); return; }
        const start = performance.now(), DURATION = 1200;
        function frame(now) {
            const p = Math.min((now - start) / DURATION, 1);
            const e = 1 - Math.pow(1 - p, 3);
            apply(e);
            if (p < 1) requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
    }

    function makeFallbackSvg(title) {
        const safeTitle = String(title).replace(/[<>&"]/g, '');
        const isLight = ['theme-sneaker', 'theme-paper'].includes(currentTheme);
        const bg = isLight ? '#f3f4f6' : '#0a0a0a';
        const fg = isLight ? '#111111' : '#ffffff';
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="${bg}"/><text x="300" y="200" fill="${fg}" font-family="monospace" font-size="20" text-anchor="middle" dominant-baseline="middle" opacity="0.7">${safeTitle}</text></svg>`;
        return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
    }

    function initProjects() {
        const grid = $('project-grid');
        if (!grid) return;
        grid.innerHTML = projectList.map((p) => `
            <div class="project-item reveal glass-card rounded-2xl md:rounded-[2.5rem] overflow-hidden group" data-category="${p.cat}">
                <div class="h-48 md:h-60 bg-gray-800 relative overflow-hidden">
                    <img src="${p.imgCyber}" data-cyber="${p.imgCyber}" data-sneaker="${p.imgSneaker}" alt="${p.title}" loading="lazy" width="600" height="400" class="w-full h-full object-cover">
                </div>
                <div class="p-6 md:p-8">
                    <h3 class="text-lg md:text-xl font-bold text-white mb-2 uppercase tracking-wide">${p.title}</h3>
                    <p class="text-gray-400 text-sm font-light mb-0" data-en="${p.en}" data-zh="${p.zh}">${p.en}</p>
                </div>
            </div>`).join('');
        grid.querySelectorAll('img').forEach(img => {
            img.addEventListener('error', function handler() {
                this.removeEventListener('error', handler);
                this.classList.add('is-fallback');
                this.src = makeFallbackSvg(this.alt);
            });
        });
    }

    function updateProjectImages() {
        const isLightTheme = ['theme-sneaker', 'theme-paper'].includes(currentTheme);
        document.querySelectorAll('.project-item img').forEach(img => {
            if (img.classList.contains('is-fallback')) return;
            const newSrc = isLightTheme ? img.dataset.sneaker : img.dataset.cyber;
            if (img.src !== newSrc && newSrc) {
                // 预载成功后一次性替换：不做淡出淡入，避免切主题时画面“闪一下”
                const tempImg = new Image();
                tempImg.onload = () => {
                    img.style.transition = 'none';
                    img.src = newSrc;
                    img.style.opacity = '1';
                    requestAnimationFrame(() => { img.style.transition = ''; });
                };
                tempImg.onerror = () => {
                    /* 外链图（unsplash）偶发抖动：先重试一次再报，避免日志里莫名出现 Warning */
                    if (!tempImg.dataset.retry) { tempImg.dataset.retry = '1'; tempImg.src = newSrc; return; }
                    addLog('Warning: Image load failed');
                };
                tempImg.src = newSrc;
            }
        });
    }

    function initFilters() {
        const btns = document.querySelectorAll('.filter-btn');
        btns.forEach(btn => {
            btn.addEventListener('click', () => {
                btns.forEach(b => { b.classList.remove('active', 'text-white'); b.classList.add('text-gray-500'); b.setAttribute('aria-pressed', 'false'); });
                btn.classList.add('active', 'text-white'); btn.classList.remove('text-gray-500'); btn.setAttribute('aria-pressed', 'true');
                const filter = btn.dataset.filter;
                document.querySelectorAll('.project-item').forEach(item => {
                    item.style.display = (filter === 'all' || item.dataset.category === filter) ? '' : 'none';
                });
                addLog('Filter: ' + String(filter).toUpperCase());
            });
        });
    }

    function createD(text, isSelf) {
        if (!dCont) return;
        const el = document.createElement('div');
        el.className = 'danmaku-item';
        el.textContent = text;
        const top = Math.random() * 60 + 5, dur = Math.random() * 5 + 10;
        const reduceMotion = prefersReducedMotion();
        const actualDur = reduceMotion ? 6 : dur;
        el.style.top = top + '%';
        el.style.animationDuration = actualDur + 's';
        if (isSelf) {
            el.style.color = 'var(--secondary)';
            el.style.fontSize = '18px';
            if(!['theme-sneaker', 'theme-paper'].includes(currentTheme)) el.style.textShadow = '0 0 10px var(--secondary)';
        }
        dCont.appendChild(el);
        setTimeout(() => el.remove(), actualDur * 1000);
    }

    const IS_COARSE = (window.matchMedia && window.matchMedia('(pointer:coarse)').matches) || window.innerWidth < 820;
    let matrixCell = 18;
    let matrixGlyph = String.fromCharCode(Math.floor(Math.random() * 128));
    let matrixLast = 0;
    function layerOpen() {
        return document.body.classList.contains('osu-open')
            || document.body.classList.contains('market-open')
            || document.body.classList.contains('gamehub-open')
            || document.body.classList.contains('celeste-open');
    }
    function initMatrix() {
        if (!mCanvas || !mCtx) return;
        // 移动端 / 触屏设备降低渲染分辨率与列密度，省电省帧
        const dpr = Math.min(window.devicePixelRatio || 1, IS_COARSE ? 1.4 : 2);
        const w = window.innerWidth, h = window.innerHeight;
        mCanvas.width = Math.floor(w * dpr);
        mCanvas.height = Math.floor(h * dpr);
        mCanvas.style.width = w + 'px';
        mCanvas.style.height = h + 'px';
        mCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        matrixCell = IS_COARSE ? 22 : 18;
        const cols = Math.max(1, Math.floor(w / matrixCell));
        mDrops = new Array(cols).fill(1);
    }

    function refreshMatrixColor() {
        try {
            const c = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
            matrixColor = c || '#8a2be2';
            if(['theme-sneaker', 'theme-paper'].includes(currentTheme)) matrixColor = '#9ca3af';
        } catch (e) { matrixColor = '#8a2be2'; }
    }

    function scheduleMatrix() { if (matrixRunning && !matrixRaf && !document.hidden && !layerOpen()) matrixRaf = requestAnimationFrame(drawMatrix); }
    function startMatrix() {
        if (matrixRunning || !mCtx) return;
        if (prefersReducedMotion()) { addLog('System: Motion reduced — matrix stream skipped'); return; }
        matrixRunning = true;
        initMatrix();
        refreshMatrixColor();
        mCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        scheduleMatrix();
    }

    function drawMatrix(ts) {
        matrixRaf = null;
        if (!matrixRunning || !mCtx || document.hidden || layerOpen()) return;
        matrixRaf = requestAnimationFrame(drawMatrix);
        // 限帧：移动端 30fps，桌面 50fps（肉眼足够，省一半以上绘制开销）
        const budget = IS_COARSE ? 1000 / 24 : 1000 / 40;
        const now = ts || performance.now();
        if (now - matrixLast < budget - 1) return;
        matrixLast = now;
        const w = window.innerWidth, h = window.innerHeight;
        const cell = matrixCell;
        const isLight = ['theme-sneaker', 'theme-paper'].includes(currentTheme);
        mCtx.fillStyle = isLight ? 'rgba(243,244,246,0.1)' : 'rgba(0,0,0,.05)';
        mCtx.fillRect(0, 0, w, h);
        matrixGlyph = String.fromCharCode(32 + Math.floor(Math.random() * 94));
        mCtx.fillStyle = matrixColor;
        mCtx.font = cell + 'px monospace';
        for (var i = 0; i < mDrops.length; i++) {
            var y = mDrops[i];
            mCtx.fillText(matrixGlyph, i * cell, y * cell);
            if (y * cell > h && Math.random() > 0.975) { mDrops[i] = 0; }
            mDrops[i]++;
        }
    }

    function stopMatrix() {
        matrixRunning = false;
        if (matrixRaf) cancelAnimationFrame(matrixRaf);
        matrixRaf = null;
    }
    document.addEventListener('visibilitychange', function () {
        if (document.hidden && matrixRaf) { cancelAnimationFrame(matrixRaf); matrixRaf = null; }
        else scheduleMatrix();
    });
    if (window.MutationObserver) new MutationObserver(scheduleMatrix).observe(document.body, { attributes: true, attributeFilter: ['class'] });

    function resetGravity() { document.querySelectorAll('.gravity-applied').forEach(el => { el.style.transform = ''; el.classList.remove('gravity-applied'); }); }

    function resetAll() {
        document.documentElement.className = 'theme-cyber scroll-smooth';
        currentTheme = 'theme-cyber';
        document.body.style.filter = 'none';
        document.body.style.animation = 'none';
        if (logMode) logMode.textContent = 'STABLE';
        stopMatrix();
        refreshMatrixColor();
        if (mCanvas) { mCanvas.style.opacity = '0'; mCanvas.style.background = 'transparent'; }
        if (discoTimer) { clearInterval(discoTimer); discoTimer = null; }
        if (gravityTimer) { clearTimeout(gravityTimer); gravityTimer = null; }
        if (glitchTimer) { clearTimeout(glitchTimer); glitchTimer = null; }
        if (vibrateTimer) { clearTimeout(vibrateTimer); vibrateTimer = null; }
        if (echoTimer) { clearTimeout(echoTimer); echoTimer = null; }
        resetGravity();
        document.querySelectorAll('[data-original]').forEach(node => { node.textContent = node.dataset.original; delete node.dataset.original; });
        document.querySelectorAll('h1, h2, .glass-card').forEach(el => { el.style.textShadow = ''; });
        document.documentElement.style.removeProperty('--primary');
        document.documentElement.style.removeProperty('--secondary');
        updateProjectImages();
        localStorage.setItem('theme', 'theme-cyber');
        addLog('System: All parameters reset');
    }

    /* 覆盖层（market / osu / gamehub）的顶栏也要能切主题，这里把 switchTheme 暴露出去 */
    window.CyberTheme = {
        next: function () { switchTheme(); return currentTheme; },
        set: function (name) {
            if (!themes.includes(name)) return currentTheme;
            switchThemeTo(name);
            addLog('Theme: ' + name.replace('theme-', '').toUpperCase());
            return currentTheme;
        },
        current: function () { return currentTheme; },
        list: themes
    };

    function switchTheme() {
        const html = document.documentElement;
        muteTransitions();
        html.classList.remove(currentTheme);
        let idx = themes.indexOf(currentTheme);
        idx = (idx + 1) % themes.length;
        currentTheme = themes[idx];
        html.classList.add(currentTheme);
        localStorage.setItem('theme', currentTheme);
        
        document.body.classList.remove('hacker-mode');
        if (matrixRunning) refreshMatrixColor();
        document.querySelectorAll('.radar-label').forEach(el => el.setAttribute('fill', 'var(--text-main)'));
        updateProjectImages();
        addLog('Theme: Switched to ' + currentTheme.replace('theme-', '').toUpperCase());
    }

    const commands = {
        /* /root 已移除：强制切 hacker 主题会破坏当前主题观感 */
        '/matrix': () => { startMatrix(); if (mCanvas) { mCanvas.style.opacity = '1'; } refreshMatrixColor(); addLog('System: Matrix stream engaged'); },
        '/echo': () => {
            document.querySelectorAll('h1, h2, .glass-card').forEach(el => { el.style.textShadow = '5px 5px 0 var(--primary), -5px -5px 0 var(--secondary)'; });
            addLog('Effect: Visual echo synchronized');
            if (echoTimer) clearTimeout(echoTimer);
            echoTimer = setTimeout(() => { document.querySelectorAll('h1, h2, .glass-card').forEach(el => { el.style.textShadow = ''; }); echoTimer = null; }, 10000);
        },
        '/vibrate': () => {
            document.body.style.animation = 'shake .2s infinite';
            if (vibrateTimer) clearTimeout(vibrateTimer);
            vibrateTimer = setTimeout(() => { document.body.style.animation = 'none'; vibrateTimer = null; }, 3000);
            addLog('Warning: Shake active');
        },
        '/gravity': () => {
            document.querySelectorAll('.reveal, .glass-card, .project-item, h1, h2, p, img').forEach(el => {
                el.classList.add('gravity-applied');
                el.style.transform = `translate(${(Math.random() - 0.5) * 400}px, ${Math.random() * 400}px) rotate(${(Math.random() - 0.5) * 180}deg)`;
            });
            if (gravityTimer) clearTimeout(gravityTimer);
            gravityTimer = setTimeout(() => { resetGravity(); gravityTimer = null; }, 5000);
            addLog('Warning: Gravity engine failure');
        },
        '/glitch': () => {
            document.body.style.filter = 'contrast(1.5) saturate(2) hue-rotate(45deg)';
            document.body.style.animation = 'v-flicker .06s infinite';
            if (glitchTimer) clearTimeout(glitchTimer);
            glitchTimer = setTimeout(() => { document.body.style.filter = 'none'; document.body.style.animation = 'none'; glitchTimer = null; }, 3000);
            addLog('Critical: Data corruption detected');
        },
        '/binary': () => {
            document.querySelectorAll('h1, h2, p, a, span').forEach(node => {
                if (node.closest('#log-window') || node.id === 'typing-text' || node.id === 'logo-main' || node.children.length > 0 || node.dataset.original) return;
                node.dataset.original = node.textContent;
                node.textContent = node.textContent.replace(/[^\s]/g, () => Math.floor(Math.random() * 10));
            });
            addLog('System: Language deconstructed');
        },
        '/warp': (arg) => {
            const target = String(arg || '').toLowerCase().replace('!', '').trim();
            if (target === 'osu') {
                if (window.OsuWarp && window.OsuWarp.open) {
                    window.OsuWarp.open();
                    if (window.LZXAch) window.LZXAch.visit('osu');
                    addLog('Warp: osu! kernel mounted (in-page)');
                } else {
                    addLog('Error: osu! kernel offline');
                }
            } else if (target === 'gamehub' || target === 'game') {
                if (window.GameHubWarp && window.GameHubWarp.open) {
                    window.GameHubWarp.open();
                    if (window.LZXAch) window.LZXAch.visit('gamehub');
                    addLog('Warp: gamehub mounted (in-page)');
                } else {
                    addLog('Error: gamehub offline');
                }
            } else if (target === 'market') {
                const trigger = document.querySelector('[data-market-open]');
                if (trigger) {
                    trigger.click();
                    if (window.LZXAch) window.LZXAch.visit('market');
                    addLog('Warp: market feed mounted (in-page)');
                } else {
                    addLog('Error: market feed offline');
                }
            } else if (target === 'celeste') {
                if (window.CelesteWarp) {
                    window.CelesteWarp.open();
                    if (window.LZXAch) window.LZXAch.visit('celeste');
                    addLog('Warp: celeste mounted (in-page)');
                } else {
                    addLog('Error: celeste offline');
                }
            } else { addLog('Error: Unknown warp target — try "warp osu / warp gamehub / warp celeste"'); }
        },
        '/exit': () => { resetAll(); addLog('Session reset'); },
        '/help': async () => {
            if (helpRunning) return;
            helpRunning = true;
            addLog('Available commands:');
            for (const key of Object.keys(commands).filter(k => k !== '/help')) {
                await new Promise(r => setTimeout(r, 120));
                addLog('Cmd: ' + key);
            }
            helpRunning = false;
        },

        /* ---- 实用命令（v4.9） ---- */
        '/ls': () => {
            addLog('Modules: market · osu! · gamehub · celeste');
            addLog('Jump with /goto <market|osu|gamehub|celeste|home>');
        },
        '/goto': (arg) => {
            const t = String(arg || '').toLowerCase().replace('!', '').trim();
            if (t === 'home' || t === 'top') { resetAll(); window.scrollTo({ top: 0, behavior: 'smooth' }); addLog('Warp: home'); return; }
            if (t === 'game') { commands['/warp']('gamehub'); return; }
            if (t === 'market' || t === 'osu' || t === 'gamehub' || t === 'celeste') { commands['/warp'](t); return; }
            addLog('Error: /goto <market|osu|gamehub|celeste|home>');
        },
        '/theme': (arg) => {
            const names = ['cyber', 'hacker', 'ocean', 'paper', 'sneaker', 'sunset', 'sweet'];
            const t = String(arg || '').toLowerCase().replace('theme-', '').trim();
            if (!t) { addLog('Themes: ' + names.join(' · ')); return; }
            if (!names.includes(t)) { addLog('Error: unknown theme, try /theme ' + names.join('|')); return; }
            switchThemeTo('theme-' + t);
            addLog('Theme: Switched to ' + t.toUpperCase());
        },
        '/lang': (arg) => {
            const t = String(arg || '').toLowerCase().trim();
            if (t !== 'zh' && t !== 'en') { addLog('Usage: /lang zh|en'); return; }
            setLang(t);
        },
        '/ach': () => {
            if (!window.LZXAch) { addLog('Error: achievements offline'); return; }
            const n = window.LZXAch.count(), total = window.LZXAch.total();
            addLog('Achievements: ' + n + '/' + total);
            window.LZXAch.list().forEach(a => {
                if (a.at) addLog('  [' + a.id + '] ' + a.zh + ' — ' + a.desc);
            });
        },
        '/stats': () => {
            const rows = [];
            try {
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (!/best|pb|record|high/i.test(k)) continue;
                    let v = localStorage.getItem(k);
                    if (v && v.length > 26) { try { v = JSON.stringify(JSON.parse(v)); } catch (e) {} }
                    rows.push(k + ' = ' + String(v).slice(0, 40));
                }
            } catch (e) {}
            addLog('Local records: ' + (rows.length || 0));
            rows.slice(0, 8).forEach(r => addLog('  ' + r));
            if (!rows.length) addLog('  (none yet — go play something)');
        },
        '/clear': () => {
            const box = $('log-window');
            if (box) box.innerHTML = '';
            addLog('Log cleared');
        },
        '/whoami': () => {
            let visits = 0;
            try { visits = parseInt(localStorage.getItem('lzx.visits') || '0', 10) + 1; localStorage.setItem('lzx.visits', String(visits)); } catch (e) {}
            addLog('guest@loopzlx — uid ' + (localStorage.getItem('lzx.uid') || 'anonymous'));
            addLog('Shell: LZX-KERNEL · visits: ' + visits);
        },
        '/date': () => {
            const d = new Date();
            addLog('Local time: ' + d.toString().replace(/ GMT.*/, '') + ' (UTC' + (d.getTimezoneOffset() <= 0 ? '+' : '-') + Math.abs(d.getTimezoneOffset() / 60) + ')');
        },
        '/uptime': () => {
            const t = Math.round(performance.now() / 1000);
            addLog('Session uptime: ' + Math.floor(t / 60) + 'm ' + (t % 60) + 's');
        },
        '/coffee': () => {
            addLog('       ( (');
            addLog('        ) )');
            addLog('      ........');
            addLog('      |      |]');
            addLog('      \\      /');
            addLog('       `----\'');
            addLog('Now brewing. Caffeine module engaged.');
        },
        '/diag': async () => {
            if (!window.LZXTool) { addLog('Error: diagnostics offline'); return; }
            addLog('Running self-check…');
            var r = await window.LZXTool.diag();
            addLog('Self-check: ' + (r.bad ? r.bad + ' FAILED / ' : '') + r.ok + ' OK');
            r.rows.forEach(function (row) {
                addLog('  ' + (row.state === 'ok' ? '[ok]  ' : row.state === 'warn' ? '[warn]' : '[FAIL]') + ' ' + row.name + (row.detail ? ' — ' + row.detail : ''));
            });
            if (r.bad) addLog('Hint: 打开 /about 面板的「自检」页可复制完整报告');
        },
        '/about': () => {
            if (!window.LZXTool) { addLog('Error: toolkit offline'); return; }
            window.LZXTool.open('about');
            addLog('Panel: about / shortcuts');
        },
        '/save': () => {
            if (!window.LZXTool) { addLog('Error: toolkit offline'); return; }
            window.LZXTool.open('save');
            addLog('Panel: save code (导出/导入)');
        },
        '/load': () => {
            if (!window.LZXTool) { addLog('Error: toolkit offline'); return; }
            window.LZXTool.open('save');
            addLog('Hint: 在「存档码」页粘贴旧的存档码，先校验再导入');
        },
        '/pb': () => {
            var rows = [];
            try {
                var opb = JSON.parse(localStorage.getItem('osu.best.v2') || '{}');
                var n = Object.keys(opb).length;
                var mx = 0;
                Object.keys(opb).forEach(function (k) { var v = opb[k]; var sc = (v && typeof v === 'object') ? (v.score || 0) : v; if (sc > mx) mx = sc; });
                rows.push(['osu!', n + ' 张图 · 最高 ' + (mx ? mx.toLocaleString() : '—')]);
            } catch (e) {}
            try {
                var cpb = JSON.parse(localStorage.getItem('celeste.pb.v1') || '{}');
                Object.keys(cpb).forEach(function (k) { rows.push(['celeste · ' + k, (parseFloat(cpb[k]) || 0).toFixed(2) + 's']); });
            } catch (e) {}
            [['2048', 'gh_2048_best'], ['snake', 'gh_snake_best'], ['mines', 'gh_mines_best']].forEach(function (p) {
                var v = localStorage.getItem(p[1]);
                if (v != null) rows.push([p[0], v]);
            });
            addLog('Personal bests:');
            if (!rows.length) addLog('  (none yet — go play something)');
            rows.forEach(function (r) { addLog('  ' + r[0] + ' — ' + r[1]); });
        },
        '/reset-ach': (arg) => {
            if (!window.LZXAch) { addLog('Error: achievements offline'); return; }
            if (String(arg || '').trim().toLowerCase() !== 'yes') { addLog('Warning: /reset-ach yes 会把成就清空'); return; }
            window.LZXAch.reset();
            addLog('Achievements reset');
        }
    };

    /* 切主题时短暂关掉所有过渡：避免整页元素同时渐变、出现“闪一下”的观感 */
    let themeNoTransTimer = null;
    function muteTransitions() {
        const html = document.documentElement;
        html.classList.add('lzx-notrans');
        if (themeNoTransTimer) clearTimeout(themeNoTransTimer);
        themeNoTransTimer = setTimeout(() => html.classList.remove('lzx-notrans'), 420);
    }

    function switchThemeTo(targetTheme) {
        muteTransitions();
        document.documentElement.classList.remove(currentTheme);
        currentTheme = targetTheme;
        document.documentElement.classList.add(currentTheme);
        localStorage.setItem('theme', currentTheme);
        if (matrixRunning) refreshMatrixColor();
        updateProjectImages();
    }

    function sendDanmaku() {
        const inputEl = $('danmaku-input');
        if (!inputEl) return;
        const raw = inputEl.value.trim();
        if (!raw) return;
        // 兼容不带斜杠的 warp（warp osu / warp osu!）
        const bareWarp = raw.match(/^warp\s+(.+)$/i);
        if (bareWarp) {
            addLog('Execute: /warp ' + bareWarp[1]);
            commands['/warp'](bareWarp[1]);
            inputEl.value = '';
            return;
        }
        /* 历史（最多 30 条）+ 终端积极度计数 */
        try {
            const hist = window.__lzxCmdHist ? window.__lzxCmdHist() : null;
            if (hist) {
                if (hist[hist.length - 1] !== raw) hist.push(raw);
                if (hist.length > 30) hist.shift();
                localStorage.setItem('lzx.hist', JSON.stringify(hist));
            }
        } catch (e) {}
        if (window.LZXAch) window.LZXAch.bump('cmd', 1, 'terminal-10', 10);

        if (raw.startsWith('/')) {
            const parts = raw.split(/\s+/);
            const cmd = parts[0].toLowerCase();
            const arg = parts.slice(1).join(' ');
            const fn = commands[cmd];
            addLog('Execute: ' + cmd + (arg ? ' ' + arg : ''));
            if (fn) fn(arg); else addLog('Error: Unknown command');
        } else {
            createD(raw, true);
            addLog('Broadcast: "' + raw.substring(0, 12) + '..."');
        }
        inputEl.value = '';
    }

    /* ---- 命令面板（Cmd/Ctrl+K）与快捷键速查（?） ---- */
    const PALETTE_DESC = {
        '/warp': '进入一个模块（osu / gamehub / market / celeste）',
        '/goto': '跳到模块或回到首页（/goto home）',
        '/ls': '列出所有模块',
        '/theme': '切换主题（/theme paper 等）',
        '/lang': '切换语言（/lang zh|en）',
        '/ach': '查看成就进度',
        '/stats': '查看本地最佳记录',
        '/clear': '清空终端日志',
        '/whoami': '显示来访身份与会话信息',
        '/date': '显示本地时间',
        '/uptime': '显示本次会话已运行多久',
        '/coffee': '泡一杯咖啡',
        '/reset-ach': '重置成就（/reset-ach yes）',
        '/diag': '跑一遍站点自检（存储/模块/帧率/报错）',
        '/about': '打开关于面板（版本 / 快捷键）',
        '/save': '导出存档码（成绩 + 成就打包成文本）',
        '/load': '导入存档码（先校验再合并）',
        '/pb': '列出各模块个人最佳',
        '/matrix': '数字雨',
        '/glitch': '画面故障',
        '/gravity': '重力失效',
        '/shake': '屏幕震动',
        '/vibrate': '手机震动（支持的设备）',
        '/echo': '回显一段文字',
        '/help': '列出全部命令',
        '/binary': '文字转二进制',
        '/exit': '复位画面特效'
    };

    function initPalette() {
        let wrap = null, input = null, listEl = null, all = [], shown = [], sel = 0;

        function build() {
            wrap = document.createElement('div');
            wrap.className = 'lzx-pal';
            wrap.innerHTML = '<div class="lzx-pal-box">' +
                '<div class="lzx-pal-title">COMMAND PALETTE <span>⌘/Ctrl + K</span></div>' +
                '<input class="lzx-pal-in" type="text" placeholder="输入命令或模块名…" spellcheck="false">' +
                '<div class="lzx-pal-list"></div>' +
                '<div class="lzx-pal-hint">↑↓ 选择 · Enter 执行 · Esc 关闭</div></div>';
            document.body.appendChild(wrap);
            input = wrap.querySelector('.lzx-pal-in');
            listEl = wrap.querySelector('.lzx-pal-list');

            wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
            input.addEventListener('input', () => render(input.value));
            input.addEventListener('keydown', e => {
                if (e.key === 'Escape') { close(); return; }
                if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(shown.length - 1, sel + 1); paint(); }
                if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); paint(); }
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const it = shown[sel];
                    if (!it) return;
                    close();
                    it.run();
                }
            });
        }

        function render(q) {
            q = String(q || '').trim().toLowerCase();
            shown = all.filter(it => !q || it.label.toLowerCase().includes(q) || (it.desc || '').toLowerCase().includes(q));
            sel = 0;
            paint();
        }

        function paint() {
            if (!listEl) return;
            listEl.innerHTML = '';
            if (!shown.length) { listEl.innerHTML = '<div class="lzx-pal-empty">没有匹配项</div>'; return; }
            shown.forEach((it, i) => {
                const row = document.createElement('div');
                row.className = 'lzx-pal-row' + (i === sel ? ' on' : '');
                row.innerHTML = '<b>' + it.label + '</b><em>' + (it.desc || '') + '</em>';
                row.addEventListener('mouseenter', () => { sel = i; paint(); });
                row.addEventListener('click', () => { close(); it.run(); });
                listEl.appendChild(row);
            });
        }

        function open() {
            if (!wrap) build();
            all = Object.keys(commands).map(k => ({
                label: k, desc: PALETTE_DESC[k] || '',
                run: () => { addLog('Execute: ' + k); commands[k](); }
            }));
            all = all.concat([
                { label: 'market', desc: '行情面板', run: () => commands['/warp']('market') },
                { label: 'osu!', desc: '音游覆盖层', run: () => commands['/warp']('osu') },
                { label: 'gamehub', desc: '小游戏中心', run: () => commands['/warp']('gamehub') },
                { label: 'celeste', desc: '蔚蓝覆盖层', run: () => commands['/warp']('celeste') },
                { label: 'home', desc: '回到主页顶部', run: () => commands['/goto']('home') }
            ]);
            render('');
            wrap.classList.add('open');
            setTimeout(() => input.focus(), 30);
        }

        function close() {
            if (wrap) wrap.classList.remove('open');
            if (input) input.value = '';
        }

        document.addEventListener('keydown', e => {
            if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
                e.preventDefault();
                if (wrap && wrap.classList.contains('open')) close(); else open();
            }
        });
        window.__lzxPalette = { open: open, close: close };
    }

    function initHotkeys() {
        const rows = [
            ['⌘ / Ctrl + K', '命令面板（所有命令与模块）'],
            ['?', '这张速查表'],
            ['/', '把焦点跳到终端输入框'],
            ['↑ / ↓', '终端里翻命令历史'],
            ['Tab', '补全命令'],
            ['1 / 2 / 3 / 4', '快速打开 market / osu! / gamehub / celeste'],
            ['Esc', '关闭当前面板']
        ];
        const wrap = document.createElement('div');
        wrap.className = 'lzx-keys';
        wrap.innerHTML = '<div class="lzx-keys-box"><h3>SHORTCUTS</h3>' +
            rows.map(r => '<div class="lzx-keys-row"><b>' + r[0] + '</b><em>' + r[1] + '</em></div>').join('') +
            '<div class="lzx-keys-hint">按 Esc 或点击空白处关闭</div></div>';
        document.body.appendChild(wrap);
        wrap.addEventListener('click', e => { if (e.target === wrap) wrap.classList.remove('open'); });

        const map = { '1': 'market', '2': 'osu', '3': 'gamehub', '4': 'celeste' };
        document.addEventListener('keydown', e => {
            const tag = (e.target && e.target.tagName) || '';
            const typing = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable);
            if (e.key === 'Escape') { wrap.classList.remove('open'); if (window.__lzxPalette) window.__lzxPalette.close(); return; }
            if (typing) return;
            if (e.key === '?') { e.preventDefault(); wrap.classList.toggle('open'); return; }
            if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
                const di = $('danmaku-input');
                if (di) { e.preventDefault(); di.focus(); }
                return;
            }
            const anyOverlay = document.body.classList.contains('osu-open') ||
                document.body.classList.contains('gamehub-open') ||
                document.body.classList.contains('celeste-open') ||
                document.body.classList.contains('market-open');
            if (anyOverlay) return;
            if (map[e.key] && !e.ctrlKey && !e.metaKey && !e.altKey) {
                commands['/warp'](map[e.key]);
            }
        });
    }

    function initMenu() {
        const toggle = $('menu-toggle'), menu = $('mobile-menu');
        if (!toggle || !menu) return;
        function setMenu(show) {
            menu.classList.toggle('hidden', !show);
            menu.classList.toggle('flex', show);
            toggle.innerHTML = show ? '<i class="fas fa-times"></i>' : '<i class="fas fa-bars"></i>';
            toggle.setAttribute('aria-expanded', String(show));
        }
        toggle.addEventListener('click', () => setMenu(menu.classList.contains('hidden')));
        menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenu(false)));
    }

    function init() {
        try {
            initProjects();
            initFilters();
            initRadar();
            initMenu();
            initPalette();
            initHotkeys();
            
            // 调用独立的音频模块
            if (window.CyberAudioPlayer) {
                window.CyberAudioPlayer.init(addLog);
            }

            /* 语言记忆：上次选的中文，刷新后仍然是中文 */
            var savedLang = 'en';
            try { savedLang = (localStorage.getItem('lzx.lang') === 'zh') ? 'zh' : 'en'; } catch (e) { savedLang = 'en'; }
            document.documentElement.lang = (savedLang === 'zh') ? 'zh-CN' : 'en';
            if (savedLang === 'zh') {
                document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.lang === 'zh'));
            }
            setLang(savedLang, true);   /* 强制跑一次初始化：打字机 / 技能条 / 雷达标签 */
            CyberClock.start();

            document.querySelectorAll('.lang-btn').forEach(btn => btn.addEventListener('click', () => setLang(btn.dataset.lang)));

            const tBtn = $('theme-toggle');
            const mBtn = $('mobile-theme-toggle');
            if(tBtn) tBtn.addEventListener('click', switchTheme);
            if(mBtn) mBtn.addEventListener('click', switchTheme);
            updateProjectImages();

            const bc = $('broadcast-btn');
            if (bc) bc.addEventListener('click', sendDanmaku);
            const di = $('danmaku-input');
            if (di) {
                /* ↑↓ 翻历史、Tab 补全命令（v4.9） */
                let hist = [], hi = -1;
                try { hist = JSON.parse(localStorage.getItem('lzx.hist') || '[]') || []; } catch (e) { hist = []; }
                window.__lzxCmdHist = () => hist;
                di.addEventListener('keydown', e => {
                    if (e.key === 'Enter') { sendDanmaku(); hi = -1; return; }
                    if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        if (!hist.length) return;
                        hi = (hi < 0) ? hist.length - 1 : Math.max(0, hi - 1);
                        di.value = hist[hi]; return;
                    }
                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        if (hi < 0) return;
                        hi++;
                        if (hi >= hist.length) { hi = -1; di.value = ''; }
                        else di.value = hist[hi];
                        return;
                    }
                    if (e.key === 'Tab') {
                        e.preventDefault();
                        const v = di.value.trim();
                        if (!v.startsWith('/') || v.includes(' ')) return;
                        const hits = Object.keys(commands).filter(k => k.startsWith(v));
                        if (hits.length === 1) di.value = hits[0] + ' ';
                        else if (hits.length > 1) addLog('Match: ' + hits.join(' · '));
                    }
                });
            }
            /* 点击打开覆盖层记为一次访问 */
            document.addEventListener('click', e => {
                if (!window.LZXAch || !e.target || !e.target.closest) return;
                const el = e.target.closest('[data-market-open],[data-osu-open],[data-gamehub-open],[data-celeste-open]');
                if (!el) return;
                if (el.hasAttribute('data-market-open')) window.LZXAch.visit('market');
                else if (el.hasAttribute('data-osu-open')) window.LZXAch.visit('osu');
                else if (el.hasAttribute('data-gamehub-open')) window.LZXAch.visit('gamehub');
                else window.LZXAch.visit('celeste');
            }, true);

            window.addEventListener('scroll', () => {
                const nav = $('main-nav');
                if (nav) nav.classList.toggle('scrolled', window.scrollY > 50);
            }, { passive: true });

            window.addEventListener('resize', () => { if (matrixRunning) initMatrix(); });

            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    if (matrixRunning) { matrixWasRunning = true; stopMatrix(); }
                } else if (matrixWasRunning) {
                    matrixWasRunning = false;
                    startMatrix();
                }
            });

            addLog('Kernel: OS initialization successful');
            setInterval(() => {
                if (document.hidden) return;
                const pool = ['Sync OK', 'Buffer stable', 'Link active'];
                addLog('Monitor: ' + pool[Math.floor(Math.random() * pool.length)]);
            }, 6000);
        } catch (err) {
            console.error('[Cyber] init error:', err);
        } finally {
            const reveals = Array.from(document.querySelectorAll('.reveal'));
            const vh = window.innerHeight || document.documentElement.clientHeight;
            reveals.forEach(el => {
                const r = el.getBoundingClientRect();
                if (r.top < vh && r.bottom > 0) el.classList.add('active');
            });
            if ('IntersectionObserver' in window) {
                const observer = new IntersectionObserver(entries => {
                    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('active'); });
                }, { threshold: 0.1 });
                reveals.forEach(el => observer.observe(el));
            } else {
                reveals.forEach(el => el.classList.add('active'));
            }
            document.body.classList.add('js-ready');
            console.log('%c[Cyber] UI ready', 'color:#00ff41;font-weight:bold');
        }
    }

    /* ------- 让外部模块能一键暂停底部音乐播放器（进 osu 时自动停） ------- */
    window.pauseSiteAudio = function () {
        try {
            var a = document.getElementById('bg-audio');
            if (!a || a.paused) return false;
            a.pause();
            var icon = document.getElementById('play-icon');
            if (icon) icon.className = 'fas fa-play';
            var box = document.getElementById('audio-container');
            if (box) box.classList.remove('playing');
            return true;
        } catch (e) { return false; }
    };

    /* ------- 站点防复制 / 防右键（输入框、文本框仍可正常选中输入） ------- */
    function isEditable(el) {
        if (!el || !el.closest) return false;
        return !!el.closest('input, textarea, [contenteditable="true"]');
    }
    document.addEventListener('contextmenu', function (e) {
        if (isEditable(e.target)) return;     /* 输入框里保留原生菜单，方便粘贴 */
        e.preventDefault();
    });
    ['copy', 'cut'].forEach(function (ev) {
        document.addEventListener(ev, function (e) {
            if (isEditable(e.target)) return;
            e.preventDefault();
        });
    });
    document.addEventListener('dragstart', function (e) {
        if (isEditable(e.target)) return;
        e.preventDefault();
    });
    document.addEventListener('selectstart', function (e) {
        if (isEditable(e.target)) return;
        e.preventDefault();
    });

    /* ---- v5.3 分区记忆：刷新 / 重开站点后回到上次所在的覆盖层 ---- */
    (function () {
        var VIEW_KEY = 'lzx.lastview';
        var REMEMBER_KEY = 'lzx.rememberview';
        var MAP = { 'market-open': 'market', 'osu-open': 'osu', 'gamehub-open': 'gamehub', 'celeste-open': 'celeste' };
        var last = null;
        try { last = localStorage.getItem(VIEW_KEY); } catch (e) {}

        function remember() {
            try { return localStorage.getItem(REMEMBER_KEY) !== '0'; } catch (e) { return true; }
        }
        function record() {
            var cls = document.body.classList, cur = 'home';
            Object.keys(MAP).forEach(function (c) { if (cls.contains(c)) cur = MAP[c]; });
            if (cur === last) return;
            last = cur;
            try { localStorage.setItem(VIEW_KEY, cur); } catch (e) {}
        }
        function restore() {
            if (!remember() || !last || last === 'home') return;
            var openers = {
                osu: function () { window.OsuWarp && window.OsuWarp.open(); },
                gamehub: function () { window.GameHubWarp && window.GameHubWarp.open(); },
                celeste: function () { window.CelesteWarp && window.CelesteWarp.open(); },
                market: function () {
                    var t = document.querySelector('[data-market-open]');
                    if (t) t.click();
                }
            };
            if (!openers[last]) return;
            setTimeout(function () {
                try { openers[last](); addLog('Resume: ' + last + ' restored (last session)'); } catch (e) {}
            }, 1100);
        }

        /* 覆盖层打开/切换/关闭都记录：全部关闭时写回 home，
           否则「进过 osu → 回主页 → 刷新」会被错误地拽回 osu */
        try {
            new MutationObserver(function () { record(); })
                .observe(document.body, { attributes: true, attributeFilter: ['class'] });
        } catch (e) {}

        window.LZXView = {
            last: function () { return last; },
            remember: remember,
            setRemember: function (on) {
                try { localStorage.setItem(REMEMBER_KEY, on ? '1' : '0'); } catch (e) {}
            },
            forget: function () { try { localStorage.removeItem(VIEW_KEY); } catch (e) {} }
        };
        restore();
    })();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();