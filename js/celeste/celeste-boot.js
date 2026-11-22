/* celeste-boot.js —— 游戏生命周期与主循环 */
(function () {
    'use strict';
    var Celeste = window.Celeste;
    var C = Celeste.C;

    var LIGHT_THEMES = ['theme-paper', 'theme-sneaker', 'theme-sunset'];

    var GHOST_KEY = 'celeste.ghost.v1';
    function ghostLoad() { try { return JSON.parse(localStorage.getItem(GHOST_KEY) || '{}') || {}; } catch (e) { return {}; } }
    function ghostSave(o) { try { localStorage.setItem(GHOST_KEY, JSON.stringify(o)); } catch (e) {} }

    function App() {
        this.level = null;
        this.player = null;
        this.rec = [];            /* 本次跑的轨迹，用于生成影子 */
        this.splits = [];         /* 检查点分段计时 */
        this.ghost = null;        /* 上一 PB 的影子 */
        this.ghostIdx = 0;
        this.particles = null;
        this.renderer = null;
        this.ui = null;
        this.sfx = null;
        this.input = null;
        this.running = false;
        this.paused = false;
        this.elapsed = 0;
        this.raf = 0;
        this.lastTs = 0;
        this.flash = 0;
        this.deadHold = 0;
        this.acc = 0;
        this.step = 1 / 60;          /* 逻辑固定 60fps，与原版一致 */
        this.loop = this.loop.bind(this);
    }

    /* 最佳成绩：按关卡名分开存 */
    var PB_KEY = 'celeste.pb.v1';
    function pbLoad() {
        try { return JSON.parse(window.localStorage.getItem(PB_KEY) || '{}') || {}; } catch (e) { return {}; }
    }
    function pbSave(o) {
        try { window.localStorage.setItem(PB_KEY, JSON.stringify(o)); } catch (e) {}
    }
    Celeste.pbAll = pbLoad;

    App.prototype.init = function () {
        var data = Celeste.LEVEL;
        this.level = new Celeste.Level(data);
        this.particles = new Celeste.Particles(260);
        this.player = new Celeste.Player(this.level.map, this.particles);
        var canvas = document.getElementById('cl-canvas');
        this.renderer = new Celeste.Renderer(canvas);
        this.ui = new Celeste.UI(this);
        this.sfx = new Celeste.Sfx();
        this.input = new Celeste.Input();
        if (Celeste.settings) Celeste.mods = Celeste.settings.mods;
        this.pad = null;
        this.setThemeByDom();
        this.appEl = document.getElementById('celeste-app');
        this.bindKeys();
        this.loadGhost((data && data.name) || 'LEVEL');
        this.renderer.snapCam(this.player, this.level.map);
        this.resize();
        window.addEventListener('resize', this.resize.bind(this));
    };

    App.prototype.resize = function () {
        var canvas = document.getElementById('cl-canvas');
        var stage = document.getElementById('cl-stage');
        if (!canvas || !stage) return;
        var availW = stage.clientWidth - 28;
        var availH = stage.clientHeight - 28;
        if (availW <= 0 || availH <= 0) return;
        var f = Math.min(availW / C.VW, availH / C.VH);
        var scale = Math.floor(f * 2) / 2;      /* 半整数缩放，兼顾清晰与铺满 */
        if (scale < 1) scale = f;
        var w = Math.round(C.VW * scale), h = Math.round(C.VH * scale);
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        var frame = canvas.parentElement;
        if (frame) { frame.style.width = w + 'px'; frame.style.height = h + 'px'; }
    };

    App.prototype.setThemeByDom = function () {
        var cls = (document.documentElement.className || '') + ' ' + (document.body.className || '');
        var light = LIGHT_THEMES.some(function (t) { return cls.indexOf(t) >= 0; });
        if (this.renderer) this.renderer.setTheme(light);
        var frame = document.querySelector('.cl-frame');
        if (frame) frame.setAttribute('data-light', light ? '1' : '0');
    };

    App.prototype.bindKeys = function () {
        var self = this;
        this.keyHandler = function (e) {
            /* 设置面板打开时不要抢 ESC；r 键留给玩家自定义，不再绑重启 */
            var sheet = document.getElementById('cl-sheet');
            if (e.key === 'Escape' && !document.fullscreenElement && !(sheet && !sheet.hidden)) {
                self.togglePause();
            }
        };
    };

    App.prototype.start = function () {
        if (this.running) return;
        this.running = true;
        this.input.attach();
        document.addEventListener('keydown', this.keyHandler);
        this.lastTs = performance.now();
        this.raf = requestAnimationFrame(this.loop);
        this.log('CELESTE · FORSAKEN CITY 1A 已载入（60fps 固定步长）');
    };

    App.prototype.stop = function () {
        this.running = false;
        cancelAnimationFrame(this.raf);
        this.input.detach();
        document.removeEventListener('keydown', this.keyHandler);
        this.paused = false;
        this.deadHold = 0;
        this.flash = 0;
        this.acc = 0;
        if (this.input) this.input.beginFrame();
        if (this.ui) this.ui.showPause(false);
    };

    /* 换图：重建 level 与 player，其余（渲染/UI/输入/音效）复用 */
    App.prototype.loadLevel = function (data) {
        if (!data) return;
        this.level = new Celeste.Level(data);
        this.particles.list.length = 0;
        this.player = new Celeste.Player(this.level.map, this.particles);
        this.player.spawnAt = { x: this.level.map.spawn.x, y: this.level.map.spawn.y };
        this.player.reset();
        this.levelName = data.name || 'CUSTOM';
        var subEl = document.querySelector('#celeste-app .cl-sub');
        if (subEl) subEl.textContent = this.levelName + ' · 手感复刻';
        this.finishedOnce = null;
        this.rec = [];
        this.ghostIdx = 0;
        this.splits = [];
        this.loadGhost((data && data.name) || 'LEVEL');
        this.deadHold = 0; this.flash = 0; this.acc = 0; this.paused = false;
        if (this.ui) { this.ui.showPause(false); this.ui.overEl.hidden = true; }
        if (this.renderer) this.renderer.snapCam(this.player, this.level.map);
        this.log('CELESTE · 载入关卡 ' + this.levelName);
    };

    App.prototype.restart = function () {
        this.level.reset();
        this.player.spawnAt = { x: this.level.map.spawn.x, y: this.level.map.spawn.y };
        this.player.reset();
        this.particles.list.length = 0;
        this.deadHold = 0;
        this.flash = 0;
        this.finishedOnce = null;              /* 否则重玩一次不会再弹通关面板 */
        this.rec = [];
        this.ghostIdx = 0;
        this.splits = [];
        this.acc = 0;
        if (this.input) { this.input.beginFrame(); this.input.beginFrame(); }
        this.paused = false;
        if (this.ui) { this.ui.showPause(false); this.ui.overEl.hidden = true; }
        this.renderer.snapCam(this.player, this.level.map);
        this.loadGhost((this.level.data && this.level.data.name) || this.levelName || 'LEVEL');
        this.log('CELESTE · 关卡重置');
    };

    App.prototype.loadGhost = function (name) {
        this.ghost = null;
        this.ghostIdx = 0;
        var gs = ghostLoad();
        var g = gs[name];
        if (!g || !g.f || g.f.length < 10) return;
        this.ghost = { name: name, t: g.t, d: g.d || 0, f: g.f };
        this.log('CELESTE · 影子已载入 ' + Celeste.fmtTime(g.t) + '（与最佳成绩同步跑）');
    };

    App.prototype.togglePause = function () {
        if (this.level && this.level.finished) return;
        this.paused = !this.paused;
        if (this.ui) this.ui.showPause(this.paused);
        this.log(this.paused ? 'CELESTE · 暂停' : 'CELESTE · 继续');
    };

    App.prototype.log = function (m) {
        try {
            if (window.addLog) window.addLog(m);
            document.dispatchEvent(new CustomEvent('celeste:log', { detail: m }));
        } catch (e) {}
    };

    App.prototype.loop = function (ts) {
        if (!this.running) return;
        var dt = Math.min(0.1, (ts - this.lastTs) / 1000 || 0.016);
        this.lastTs = ts;

        if (document.hidden) {                 /* 切到别的标签页就停逻辑，回来不追帧 */
            this.acc = 0;
            this.input.beginFrame();
            this.draw();
            this.raf = requestAnimationFrame(this.loop);
            return;
        }

        if (this.paused) {
            this.input.beginFrame();        /* 只清掉这一帧攒下的按下，不做逻辑 */
        } else {
            this.input.beginFrame();
            var frameInput = { x: 0, y: 0, jump: false, jumpPressed: false, dashPressed: false, demoPressed: false, grab: false };
            frameInput.x = this.input.x;
            frameInput.y = this.input.y;
            frameInput.jump = this.input.jump;
            frameInput.jumpPressed = this.input.jumpPressed;
            frameInput.dashPressed = this.input.dashPressed;
            frameInput.demoPressed = this.input.demoPressed;
            frameInput.grab = this.input.grab;

            /* 键盘与触控可并用：方向合并归一化，短按边沿不丢 */
            var touch = this.appEl && this.appEl._touch;
            if (touch) {
                var ix = Math.max(-1, Math.min(1, frameInput.x + (touch.x || 0)));
                var iy = Math.max(-1, Math.min(1, frameInput.y + (touch.y || 0)));
                var il = Math.sqrt(ix * ix + iy * iy);
                if (il > 1) { ix /= il; iy /= il; }
                frameInput.x = ix; frameInput.y = iy;
                frameInput.jump = frameInput.jump || touch.jump;
                frameInput.grab = frameInput.grab || touch.grab;
                frameInput.jumpPressed = frameInput.jumpPressed || touch.jumpPressed;
                frameInput.dashPressed = frameInput.dashPressed || touch.dashPressed;
                frameInput.demoPressed = frameInput.demoPressed || touch.demoPressed;
                touch.jumpPressed = false; touch.dashPressed = false; touch.demoPressed = false;
            }

            /* 固定步长：一帧里跑 0–4 个 1/60 步，按下类事件只在第一步生效 */
            this.acc += dt;
            var steps = 0;
            var presses = {
                jump: frameInput.jumpPressed,
                dash: frameInput.dashPressed,
                demo: frameInput.demoPressed
            };
            while (this.acc >= this.step && steps < 4) {
                frameInput.jumpPressed = steps === 0 && presses.jump;
                frameInput.dashPressed = steps === 0 && presses.dash;
                frameInput.demoPressed = steps === 0 && presses.demo;
                this.update(this.step, frameInput);
                this.acc -= this.step;
                steps++;
            }
            if (this.acc > this.step) this.acc = 0;   /* 卡帧后不追帧，避免瞬移 */
        }

        this.draw();
        this.raf = requestAnimationFrame(this.loop);
    };

    App.prototype.update = function (dt, input) {
        var pl = this.player;

        if (pl.dead) {
            this.deadHold -= dt;
            this.particles.update(dt);
            if (this.deadHold <= 0) {
                this.level.deaths++;
                this.player.respawn();
                this.flash = 1;
                this.renderer.snapCam(pl, this.level.map);
                this.log('CELESTE · 死亡 #' + this.level.deaths + ' → 重来');
            }
            return;
        }

        if (this.level.finished) {
            this.particles.update(dt);
            this.level.time += 0;
            if (this.finishedOnce !== this.level) {
                this.finishedOnce = this.level;
                this.sfx.play('finish');

                /* 记录 PB（按关卡名） */
                var lvName = (this.level.data && this.level.data.name) || this.levelName || 'LEVEL';
                var pbs = pbLoad(), prev = pbs[lvName];
                var isPB = !prev || this.level.time < prev.t;
                if (isPB) {
                    pbs[lvName] = {
                        t: this.level.time, d: this.level.deaths,
                        b: this.level.berriesGot, at: Date.now()
                    };
                    pbSave(pbs);
                }
                this.ui.showOver(this.level, isPB ? this.level.time : prev.t, isPB, this.splits);

                if (window.LZXAch) {
                    window.LZXAch.unlock('celeste-clear');
                    if (this.level.deaths === 0) window.LZXAch.unlock('celeste-perfect');
                    if (this.level.berries && this.level.berries.length &&
                        this.level.berriesGot >= this.level.berries.length) {
                        window.LZXAch.unlock('celeste-berry');
                    }
                    if (lvName && Celeste.LEVEL && lvName !== Celeste.LEVEL.name) window.LZXAch.unlock('celeste-editor');
                }
                this.log('CELESTE · 登顶 ' + lvName + ' 用时 ' + Celeste.fmtTime(this.level.time) +
                    ' · 死亡 ' + this.level.deaths + ' · 草莓 ' + this.level.berriesGot + '/' + this.level.berries.length);
                if (isPB) {
                    this.log('CELESTE · 新纪录 ' + Celeste.fmtTime(this.level.time));
                    /* 存这次的轨迹当影子（只留最佳） */
                    if (this.rec && this.rec.length > 10) {
                        var gs = ghostLoad();
                        gs[lvName] = { t: this.level.time, d: this.level.deaths, f: this.rec.slice(0, 60 * 60 * 5) };
                        ghostSave(gs);
                    }
                }
                if (this.ui && this.ui.refreshLevelPane) this.ui.refreshLevelPane();
            }
            return;
        }

        /* 轨迹录制（逻辑帧 = 60fps），用于最佳成绩影子回放 */
        if (this.rec.length < 60 * 60 * 5) {
            this.rec.push([Math.round(pl.x * 2) / 2, Math.round(pl.y * 2) / 2, pl.facing > 0 ? 1 : 0]);
        }
        if (this.ghost) this.ghostIdx++;

        var wasGround = pl.onGround;
        var wasDashing = pl.state === 'dash';
        this.level.time += dt;
        pl.update(dt, input);
        if (pl.state === 'dash' && !wasDashing) this.sfx.play('dash');
        for (var ei = 0; ei < pl.events.length; ei++) {
            var e = pl.events[ei];
            if (e === 'jump') this.sfx.play('jump');
            else if (e === 'walljump' || e === 'climbjump') this.sfx.play('walljump');
            else if (e === 'super' || e === 'superwall') this.sfx.play('doublejump');
        }
        if (pl.dead) {
            this.deadHold = 0.55;
            this.sfx.play('death');
            return;
        }
        if (pl.onGround && !wasGround && Math.abs(pl.vy) < 1) this.sfx.play('land');

        var ev = this.level.update(dt, pl, this.particles);
        for (var i = 0; i < ev.length; i++) {
            if (ev[i] === 'crystal') this.sfx.play('crystal');
            if (ev[i] === 'berry') this.sfx.play('berry');
            if (ev[i] === 'spring') this.sfx.play('walljump');
            if (ev[i] === 'checkpoint') {
                this.splits.push({ t: this.level.time, d: this.level.deaths });
                this.sfx.play('spring');
                this.log('CELESTE · 分段 ' + this.splits.length + ' · ' + Celeste.fmtTime(this.level.time));
            }
        }

        this.particles.update(dt);
        this.renderer.follow(pl, this.level.map, dt);
        this.ui.update(this.level, pl);
        if (this.flash > 0) this.flash -= dt * 3.2;
    };

    App.prototype.draw = function () {
        var r = this.renderer, lv = this.level, pl = this.player;
        r.draw(lv, pl, this.particles, { shake: this.deadHold > 0 ? 0.6 : 0 });
        if (this.flash > 0) r.flash(r.ctx, Math.max(0, this.flash) * 0.55);
        this.drawGhost();
    };

    App.prototype.drawGhost = function () {
        var g = this.ghost;
        if (!g || !g.f || !g.f.length) return;
        var i = Math.min(this.ghostIdx, g.f.length - 1);
        var a = g.f[i], b = g.f[Math.min(i + 1, g.f.length - 1)];
        if (!a) return;
        /* 两帧之间线性插值，避免 60fps 影子看起来一顿一顿 */
        var k = 0; /* 逻辑帧与绘制帧 1:1，直接取值 */
        var ctx = this.renderer.ctx, cam = this.renderer.cam;
        var px = a[0] - cam.x, py = a[1] - cam.y;
        ctx.save();
        ctx.globalAlpha = 0.34;
        ctx.fillStyle = '#69e6ff';
        ctx.fillRect(Math.round(px), Math.round(py), 8, 11);
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#b9f4ff';
        ctx.fillRect(Math.round(px) + (a[2] ? 5 : 1), Math.round(py) - 1, 4, 3);
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = '#69e6ff';
        for (var t = 1; t <= 4; t++) {
            var q = g.f[Math.max(0, i - t * 3)];
            if (!q) break;
            ctx.fillRect(Math.round(q[0] - cam.x), Math.round(q[1] - cam.y), 8, 11);
        }
        ctx.restore();
    };

    Celeste.App = App;
})();
