(function () {
    'use strict';

    const themes = ['theme-cyber', 'theme-sweet-pink', 'theme-hacker', 'theme-sneaker', 'theme-sunset', 'theme-ocean', 'theme-paper'];
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

    const projectList = [
        { cat: 'dev', title: 'Cyber Terminal', en: 'CLI Portfolio', zh: '终端作品集',
          imgCyber: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=800&auto=format&fit=crop', 
          imgSneaker: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?q=80&w=800&auto=format&fit=crop' },
        { cat: 'parkour', title: 'Flow Archive', en: 'Urban Movement', zh: '城市影像',
          imgCyber: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=800&auto=format&fit=crop',
          imgSneaker: 'https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb?q=80&w=800&auto=format&fit=crop' },
        { cat: 'dev', title: 'Neural Matrix', en: 'SVG Data Viz', zh: '数据可视化',
          imgCyber: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=800&auto=format&fit=crop',
          imgSneaker: 'https://images.unsplash.com/photo-1507238692062-8a444c0f8b6b?q=80&w=800&auto=format&fit=crop' }
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

    function setLang(lang) {
        if (!config[lang] || lang === currentLang) return;
        currentLang = lang;
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
                img.style.opacity = '0';
                const tempImg = new Image();
                tempImg.onload = () => { img.src = newSrc; img.style.opacity = '1'; };
                tempImg.onerror = () => { img.style.opacity = '1'; addLog('Warning: Image load failed'); };
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

    function initMatrix() {
        if (!mCanvas || !mCtx) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = window.innerWidth, h = window.innerHeight;
        mCanvas.width = Math.floor(w * dpr);
        mCanvas.height = Math.floor(h * dpr);
        mCanvas.style.width = w + 'px';
        mCanvas.style.height = h + 'px';
        mCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const cols = Math.max(1, Math.floor(w / 18));
        mDrops = new Array(cols).fill(1);
    }

    function refreshMatrixColor() {
        try {
            const c = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
            matrixColor = c || '#8a2be2';
            if(['theme-sneaker', 'theme-paper'].includes(currentTheme)) matrixColor = '#9ca3af';
        } catch (e) { matrixColor = '#8a2be2'; }
    }

    function startMatrix() {
        if (matrixRunning || !mCtx) return;
        if (prefersReducedMotion()) { addLog('System: Motion reduced — matrix stream skipped'); return; }
        matrixRunning = true;
        initMatrix();
        refreshMatrixColor();
        mCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        matrixRaf = requestAnimationFrame(drawMatrix);
    }

    function drawMatrix() {
        if (!matrixRunning || !mCtx) { matrixRaf = null; return; }
        const w = window.innerWidth, h = window.innerHeight;
        const isLight = ['theme-sneaker', 'theme-paper'].includes(currentTheme);
        mCtx.fillStyle = isLight ? 'rgba(243,244,246,0.1)' : 'rgba(0,0,0,.05)';
        mCtx.fillRect(0, 0, w, h);
        mCtx.fillStyle = matrixColor;
        mCtx.font = '18px monospace';
        mDrops.forEach((y, i) => {
            mCtx.fillText(String.fromCharCode(Math.floor(Math.random() * 128)), i * 18, y * 18);
            if (y * 18 > h && Math.random() > 0.975) mDrops[i] = 0;
            mDrops[i]++;
        });
        matrixRaf = requestAnimationFrame(drawMatrix);
    }

    function stopMatrix() {
        matrixRunning = false;
        if (matrixRaf) cancelAnimationFrame(matrixRaf);
        matrixRaf = null;
    }

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

    function switchTheme() {
        const html = document.documentElement;
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
                    addLog('Warp: osu! kernel mounted (in-page)');
                } else {
                    addLog('Error: osu! kernel offline');
                }
            } else if (target === 'gamehub' || target === 'game') {
                if (window.GameHubWarp && window.GameHubWarp.open) {
                    window.GameHubWarp.open();
                    addLog('Warp: gamehub mounted (in-page)');
                } else {
                    addLog('Error: gamehub offline');
                }
            } else if (target === 'market') {
                const trigger = document.querySelector('[data-market-open]');
                if (trigger) {
                    trigger.click();
                    addLog('Warp: market feed mounted (in-page)');
                } else {
                    addLog('Error: market feed offline');
                }
            } else { addLog('Error: Unknown warp target — try "warp osu / warp gamehub"'); }
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
        }
    };

    function switchThemeTo(targetTheme) {
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
            
            // 调用独立的音频模块
            if (window.CyberAudioPlayer) {
                window.CyberAudioPlayer.init(addLog);
            }

            setLang('en');
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
            if (di) di.addEventListener('keydown', e => { if (e.key === 'Enter') sendDanmaku(); });

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

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();