/* celeste-ui.js —— HUD / 暂停 / 通关 / 触屏按键（可编辑布局）/ 设置面板 / 音效 */
(function () {
    'use strict';
    var Celeste = window.Celeste;
    var C = Celeste.C;

    function fmtTime(t) {
        var m = Math.floor(t / 60);
        var s = t - m * 60;
        var ss = s.toFixed(3);
        if (s < 10) ss = '0' + ss;
        return m + ':' + ss;
    }
    Celeste.fmtTime = fmtTime;

    function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

    function UI(app) {
        this.app = app;
        this.appEl = document.getElementById('celeste-app');
        this.timeEl = document.getElementById('cl-time');
        this.deathEl = document.getElementById('cl-deaths');
        this.berryEl = document.getElementById('cl-berries');
        this.dashEl = document.getElementById('cl-dashes');
        this.pauseEl = document.getElementById('cl-paused');
        this.overEl = document.getElementById('cl-over');
        this.overTime = document.getElementById('cl-over-time');
        this.overDeaths = document.getElementById('cl-over-deaths');
        this.overBerries = document.getElementById('cl-over-berries');
        this.overPB = document.getElementById('cl-over-pb');
        this.overSplits = document.getElementById('cl-over-splits');
        this.sheet = document.getElementById('cl-sheet');
        this.last = { t: -1, d: -1, b: -1, dash: -1 };
        this.held = {};
        this.editing = false;
        this.bind();
        this.buildPad();
        this.buildSettings();
        this.buildKeyOverlay();
        this.updateHint();
    }

    UI.prototype.buildKeyOverlay = function () {
        var el = document.getElementById('cl-keys');
        if (!el) {
            el = document.createElement('div');
            el.id = 'cl-keys';
            el.className = 'cl-keys';
            el.innerHTML = ['left', 'right', 'up', 'down', 'jump', 'dash', 'grab', 'demo'].map(function (k) {
                return '<i data-k="' + k + '">' + k.toUpperCase() + '</i>';
            }).join('');
            document.getElementById('celeste-app').appendChild(el);
        }
        this.keyEl = el;
    };

    UI.prototype.bind = function () {
        var self = this;
        var app = this.app;

        document.getElementById('cl-home').addEventListener('click', function () {
            if (window.CelesteWarp) window.CelesteWarp.close();
        });
        document.getElementById('cl-restart').addEventListener('click', function () { app.restart(); });
        document.getElementById('cl-pause').addEventListener('click', function () { app.togglePause(); });
        document.getElementById('cl-full').addEventListener('click', function () {
            var stage = document.getElementById('cl-stage');
            if (document.fullscreenElement) { document.exitFullscreen(); return; }
            if (stage && stage.requestFullscreen) stage.requestFullscreen();
        });
        var theme = document.getElementById('cl-theme');
        if (theme) theme.addEventListener('click', function () {
            if (window.CyberTheme && window.CyberTheme.next) {
                var t = window.CyberTheme.next();
                app.log('THEME · ' + String(t).replace('theme-', ''));
                app.setThemeByDom();
            }
        });
        document.getElementById('cl-over-again').addEventListener('click', function () {
            self.overEl.hidden = true;
            app.restart();
        });
        document.getElementById('cl-over-home').addEventListener('click', function () {
            if (window.CelesteWarp) window.CelesteWarp.close();
        });
    };

    /* ---------------- 触屏按键：从 settings.pad 生成，支持拖动编辑 ---------------- */
    UI.prototype.buildPad = function () {
        var self = this;
        var frame = document.querySelector('.cl-frame');
        if (!frame) return;

        var pad = document.createElement('div');
        pad.className = 'cl-pad';
        frame.appendChild(pad);
        this.padEl = pad;
        this.held = {};
        this.ptrs = {};                       /* pointerId → 动作名，多点各自独立 */
        this.stickVec = { x: 0, y: 0, len: 0 };
        this.stickPid = null;
        this.applyForce();
        this.renderPad();

        document.addEventListener('celeste:padchange', function () { self.renderPad(); });

        /* 绑在整个 app 上而不是 pad 上：pad 空白处 pointer-events:none 会穿透，
           而且真实手机画布外还有黑边，拇指点在黑边上也要能起摇杆 */
        var host = this.appEl || frame;
        host.addEventListener('pointerdown', function (e) {
            if (!self.padEl || getComputedStyle(self.padEl).display === 'none') return;   /* 桌面不用虚拟键 */
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            if (e.target.closest('.cl-sheet') || e.target.closest('.cl-pad-editbar') ||
                e.target.closest('.cl-top') || e.target.closest('.cl-hud')) return;
            var stickEl = e.target.closest('.cl-stick');
            var btn = e.target.closest('.cl-pad-btn');

            if (self.editing) {                        /* 编辑态：拖位置 / 拖把手 */
                if (stickEl) self.startDrag(e, stickEl);
                else if (btn) self.startDrag(e, btn);
                return;
            }

            if (btn) {
                e.preventDefault();
                var k = btn.getAttribute('data-k');
                if (!self.held[k]) {
                    if (k === 'jump' || k === 'dash' || k === 'demo') self.press(k);
                    if (navigator.vibrate) { try { navigator.vibrate(8); } catch (er) {} }
                }
                self.ptrs[e.pointerId] = k;
                try { btn.setPointerCapture(e.pointerId); } catch (er) {}
                self.recalcHeld();
                return;
            }

            /* 摇杆：按在摇杆上用它自己的底座，按在左下屏幕任意位置就地生成 */
            var rect = host.getBoundingClientRect();
            if (stickEl) {
                e.preventDefault();
                if (self.stickPid !== null) return;
                self.startStick(e, null);
            } else if (e.clientX < rect.left + rect.width * 0.55 && e.clientY > rect.top + rect.height * 0.32 && self.stickPid === null) {
                e.preventDefault();
                self.startStick(e, { x: e.clientX, y: e.clientY });
            }
        }, { passive: false });

        function pointerUp(e) {
            if (self.ptrs[e.pointerId] === undefined) return;
            delete self.ptrs[e.pointerId];
            self.recalcHeld();
        }
        host.addEventListener('pointerup', pointerUp, true);
        host.addEventListener('pointercancel', pointerUp, true);

        this.touchRefresh = function () { self.recalcHeld(); };
    };

    /* 从指针表重算哪些动作被按住 */
    UI.prototype.recalcHeld = function () {
        var h = {};
        for (var id in this.ptrs) {
            if (!Object.prototype.hasOwnProperty.call(this.ptrs, id)) continue;
            h[this.ptrs[id]] = true;
        }
        this.held = h;
        var pad = this.padEl;
        if (pad) {
            Array.prototype.forEach.call(pad.querySelectorAll('.cl-pad-btn'), function (b) {
                b.classList.toggle('hot', !!h[b.getAttribute('data-k')]);
            });
        }
        this.refreshTouch();
    };

    /* 摇杆：origin 为空 = 用固定底座；给了坐标 = 底座挪到指尖（松手弹回） */
    UI.prototype.startStick = function (e, origin) {
        var self = this;
        var el = this.stickEl;
        if (!el) return;

        var rect = el.getBoundingClientRect();
        var radius = rect.width / 2;
        var cx, cy;
        if (origin) {
            var hostRect = (this.padEl || el).getBoundingClientRect();
            if (el.__lx === undefined) { el.__lx = el.style.left; el.__ly = el.style.top; }
            el.style.left = (origin.x - hostRect.left - radius) + 'px';
            el.style.top = (origin.y - hostRect.top - radius) + 'px';
            el.classList.add('float');
            cx = origin.x; cy = origin.y;
        } else {
            cx = rect.left + radius;
            cy = rect.top + radius;
        }

        var pid = e.pointerId;
        this.stickPid = pid;
        el.classList.add('hot');
        var knob = el.querySelector('.cl-stick-knob');

        function vec(dx, dy) {
            var len = Math.sqrt(dx * dx + dy * dy);
            if (len > 1) { dx /= len; dy /= len; len = 1; }
            self.stickVec = { x: dx, y: dy, len: len };
            if (knob) knob.style.transform = 'translate(' + Math.round(dx * radius) + 'px,' + Math.round(dy * radius) + 'px)';
            self.refreshTouch();
        }
        function move(ev) {
            if (ev.pointerId !== pid) return;
            ev.preventDefault();
            vec((ev.clientX - cx) / radius, (ev.clientY - cy) / radius);
        }
        function up(ev) {
            if (ev.pointerId !== pid) return;
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up, true);
            window.removeEventListener('pointercancel', up, true);
            self.stickPid = null;
            el.classList.remove('hot');
            if (el.__lx !== undefined) {
                el.classList.remove('float');
                el.style.left = el.__lx;
                el.style.top = el.__ly;
                el.__lx = el.__ly = undefined;
            }
            if (knob) knob.style.transform = '';
            vec(0, 0);
        }
        window.addEventListener('pointermove', move, { passive: false });
        window.addEventListener('pointerup', up, true);
        window.addEventListener('pointercancel', up, true);
        if (origin) vec(0, 0);
        else vec((e.clientX - cx) / radius, (e.clientY - cy) / radius);
    };

    UI.prototype.applyForce = function () {
        if (!this.padEl) return;
        var S = Celeste.settings;
        this.padEl.setAttribute('data-force', (S.padOn || 'auto'));
    };

    UI.prototype.renderPad = function () {
        var self = this;
        var pad = this.padEl;
        if (!pad) return;
        var S = Celeste.settings;
        pad.innerHTML = '';

        /* 摇杆 */
        var stick = S.pad.stick;
        if (stick && stick.on !== false) {
            var st = document.createElement('div');
            st.className = 'cl-stick';
            st.style.left = (stick.x * 100) + '%';
            st.style.top = (stick.y * 100) + '%';
            st.style.width = 'calc(' + (stick.w * 100) + 'vmin)';
            st.innerHTML = '<i class="cl-stick-cross v"></i><i class="cl-stick-cross h"></i>' +
                '<span class="cl-stick-ring"></span><span class="cl-stick-knob"></span>';
            st.__data = stick;
            var hd = document.createElement('span');
            hd.className = 'cl-handle';
            st.appendChild(hd);
            pad.appendChild(st);
            st.__stickRoot = true;
            this.stickEl = st;
        }

        (S.pad.buttons || []).forEach(function (b) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'cl-pad-btn';
            btn.setAttribute('data-k', b.k);
            btn.textContent = b.label || (S.label && S.label[b.k]) || b.k;
            btn.style.left = (b.x * 100) + '%';
            btn.style.top = (b.y * 100) + '%';
            btn.style.width = (b.w * 100) + '%';
            btn.style.height = (b.h * 100) + '%';
            btn.__data = b;

            var hd2 = document.createElement('span');
            hd2.className = 'cl-handle';
            btn.appendChild(hd2);

            pad.appendChild(btn);
        });
        if (this.editing) pad.classList.add('editing');
        this.recalcHeld();
    };

    /* 拖动改位置 / 右下角把手改尺寸（按钮按宽高比，摇杆按短边 vmin） */
    UI.prototype.startDrag = function (e, el) {
        e.preventDefault();
        var b = el.__data;
        if (!b) return;
        var isStick = !!el.__stickRoot;
        var rect = this.padEl.getBoundingClientRect();
        var short = Math.min(rect.width, rect.height);
        var sizing = e.target.classList && e.target.classList.contains('cl-handle');
        var sx = e.clientX, sy = e.clientY;
        var ox = b.x, oy = b.y, ow = b.w, oh = b.h;

        function move(ev) {
            var dx = (ev.clientX - sx) / rect.width;
            var dy = (ev.clientY - sy) / rect.height;
            if (sizing) {
                if (isStick) {
                    var dpx = Math.max(ev.clientX - sx, ev.clientY - sy) * 2;
                    b.w = clamp(ow + dpx / short, 0.12, 0.7);
                    el.style.width = 'calc(' + (b.w * 100) + 'vmin)';
                } else {
                    b.w = clamp(ow + dx, 0.05, 1 - b.x);
                    b.h = clamp(oh + dy, 0.05, 1 - b.y);
                    el.style.width = (b.w * 100) + '%';
                    el.style.height = (b.h * 100) + '%';
                }
            } else if (isStick) {
                b.x = clamp(ox + dx, 0, 0.9);
                b.y = clamp(oy + dy, 0, 0.9);
                el.style.left = (b.x * 100) + '%';
                el.style.top = (b.y * 100) + '%';
            } else {
                b.x = clamp(ox + dx, 0, 1 - b.w);
                b.y = clamp(oy + dy, 0, 1 - b.h);
                el.style.left = (b.x * 100) + '%';
                el.style.top = (b.y * 100) + '%';
            }
        }
        function up() {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up, true);
            window.removeEventListener('pointercancel', up, true);
        }
        window.addEventListener('pointermove', move, { passive: false });
        window.addEventListener('pointerup', up, true);
        window.addEventListener('pointercancel', up, true);
    };

    UI.prototype.press = function (k) {
        this.appEl._press = this.appEl._press || {};
        this.appEl._press[k] = true;
    };

    UI.prototype.axisOf = function (v, dead) {
        var a = Math.abs(v);
        if (a <= dead) return 0;
        return (v < 0 ? -1 : 1) * clamp((a - dead) / Math.max(0.01, 1 - dead), 0, 1);
    };

    UI.prototype.refreshTouch = function () {
        var p = this.appEl._press || {};
        this.appEl._press = {};
        /* 上一帧的“按下”如果还没被主循环消费（boot 会把它置 false），必须留住：
           轻点往往在 16ms 内就抬起，抬指时重建 _touch 会把刚按下的信号吃掉 */
        var prev = this.appEl._touch || {};
        var S = Celeste.settings;
        var h = this.held || {};
        var kx = (h.right ? 1 : 0) - (h.left ? 1 : 0);
        var ky = (h.down ? 1 : 0) - (h.up ? 1 : 0);
        var st = this.stickVec || { x: 0, y: 0 };
        var dead = (S.pad.stick && S.pad.stick.dead) || 0.26;
        var sx = this.axisOf(st.x, dead), sy = this.axisOf(st.y, dead);
        var tx = clamp(kx + sx, -1, 1), ty = clamp(ky + sy, -1, 1);
        var tl = Math.sqrt(tx * tx + ty * ty); if (tl > 1) { tx /= tl; ty /= tl; }
        this.appEl._touch = {
            x: tx,
            y: ty,
            jump: !!h.jump,
            grab: !!h.grab,
            jumpPressed: !!p.jump || !!prev.jumpPressed,
            dashPressed: !!p.dash || !!prev.dashPressed,
            demoPressed: !!p.demo || !!prev.demoPressed
        };
    };

    UI.prototype.enterEdit = function () {
        this.editing = true;
        this.renderPad();
        this.padEl.classList.add('editing');
        var bar = document.createElement('div');
        bar.className = 'cl-pad-editbar';
        bar.innerHTML = '<button type="button" class="cl-btn">完成</button>' +
            '<button type="button" class="cl-btn">取消</button>' +
            '<button type="button" class="cl-btn">清空</button>';
        var self = this;
        bar.children[0].addEventListener('click', function () {
            Celeste.settings.save(); self.exitEdit(true);
            self.app.log('CELESTE · 触屏布局已保存');
        });
        bar.children[1].addEventListener('click', function () {
            self.exitEdit(false);
        });
        bar.children[2].addEventListener('click', function () {
            Celeste.settings.pad.buttons = [];
            self.renderPad();
        });
        this.padEl.appendChild(bar);
        this.editBar = bar;
        if (this.sheet) this.sheet.hidden = true;
        this.app.paused = false;                    /* 面板藏起来了，别把游戏冻在暂停里 */
        this.showPause(false);
        this.app.log('CELESTE · 布局编辑：拖动方块改位置，右下角改大小');
    };

    UI.prototype.exitEdit = function (save) {
        this.editing = false;
        if (!save && this.padSnapshot) Celeste.settings.pad = this.padSnapshot;
        if (this.editBar && this.editBar.parentNode) this.editBar.parentNode.removeChild(this.editBar);
        this.editBar = null;
        if (this.padEl) this.padEl.classList.remove('editing');
        this.renderPad();
        /* 编辑结束：如果设置面板还开着就继续暂停，否则交还给玩家 */
        var sheetOpen = this.sheet && !this.sheet.hidden;
        this.app.paused = sheetOpen ? true : !!this.sheetWasPaused;
        this.showPause(false);
    };

    /* ---------------- 设置面板 ---------------- */
    UI.prototype.buildLevelPane = function () {
        var self = this;
        var box = document.getElementById('cl-level-list');
        var nameOfLevel = function () {
            var a = self.app, lv = a && a.level;
            return (lv && lv.data && lv.data.name) || '—';
        };
        function refresh() {
            if (!box) return;
            var pbs = Celeste.pbAll ? Celeste.pbAll() : {};
            var built = Celeste.LEVELS || [];
            var custom = null;
            try {
                var raw = window.localStorage.getItem('celeste.custom.v1');
                if (raw) custom = window.__clUnpackToLevel ? null : null;
                /* 只取名字，不解析整图 */
                var o = raw ? JSON.parse(raw) : null;
                if (o && o.name) custom = { name: o.name, kind: '自定义' };
            } catch (e) {}
            var cur = nameOfLevel();
            var rows = built.map(function (lv) {
                var pb = pbs[lv.name];
                return '<button type="button" class="cl-row cl-lv-row' + (lv.name === cur ? ' on' : '') +
                    '" data-lv="' + lv.id + '"><span>' + lv.name + ' <i>内置</i></span><b>' +
                    (pb ? fmtTime(pb.t) : '—') + '</b></button>';
            });
            if (custom) rows.push('<div class="cl-row"><span>' + custom.name + ' <i>自定义</i></span><b>' +
                (pbs[custom.name] ? fmtTime(pbs[custom.name].t) : '—') + '</b></div>');
            rows.push('<div class="cl-row cl-lv-tip"><span>点一下内置关卡名即可直接载入</span><b></b></div>');
            box.innerHTML = rows.join('');
            Array.prototype.forEach.call(box.querySelectorAll('[data-lv]'), function (btn) {
                btn.addEventListener('click', function () {
                    var id = btn.getAttribute('data-lv');
                    var it = (Celeste.LEVELS || []).filter(function (x) { return x.id === id; })[0];
                    if (!it) return;
                    self.sheet.hidden = true;
                    self.app.paused = false;
                    self.app.loadLevel(it.data);
                    self.app.start();
                    refresh();
                });
            });
        }
        self.refreshLevelPane = refresh;

        var edit = document.getElementById('cl-level-edit');
        if (edit) edit.addEventListener('click', function () {
            self.sheet.hidden = true;
            self.app.paused = false;
            if (Celeste.Editor) Celeste.Editor.open();
            refresh();
        });
        var oneA = document.getElementById('cl-level-1a');
        if (oneA) oneA.addEventListener('click', function () {
            self.sheet.hidden = true;
            self.app.loadLevel(Celeste.LEVEL);
            self.app.start();
        });
        var custom = document.getElementById('cl-level-custom');
        if (custom) custom.addEventListener('click', function () {
            var raw = null;
            try { raw = window.localStorage.getItem('celeste.custom.v1'); } catch (e) {}
            if (!raw) { window.alert ? window.alert('还没有保存过自定义图') : 0; return; }
            try {
                var o = JSON.parse(raw);
                var jsonLevel = window.__clUnpackToLevel ? window.__clUnpackToLevel(o) : null;
                if (!jsonLevel) return;
                self.sheet.hidden = true;
                self.app.loadLevel(jsonLevel);
                self.app.start();
            } catch (e) {}
        });
        var clear = document.getElementById('cl-level-clear');
        if (clear) clear.addEventListener('click', function () {
            try { window.localStorage.removeItem('celeste.custom.v1'); } catch (e) {}
            refresh();
        });
        refresh();
    };

    UI.prototype.buildSettings = function () {
        var self = this;
        var S = Celeste.settings;
        this.buildLevelPane();

        var open = document.getElementById('cl-set');
        if (open) open.addEventListener('click', function () {
            self.sheet.hidden = false;
            self.sheetWasPaused = self.app.paused;
            self.app.paused = true;                       /* 设置时冻结 */
            self.renderKeys();
        });
        var close = document.getElementById('cl-sheet-close');
        if (close) close.addEventListener('click', function () {
            self.sheet.hidden = true;
            self.app.paused = self.sheetWasPaused || false;
        });
        if (this.sheet) this.sheet.addEventListener('click', function (e) {
            if (e.target === self.sheet) {
                self.sheet.hidden = true;
                self.app.paused = self.sheetWasPaused || false;
            }
        });

        /* tab */
        var tabs = this.sheet ? this.sheet.querySelectorAll('.cl-sheet-tabs button') : [];
        Array.prototype.forEach.call(tabs, function (btn) {
            btn.addEventListener('click', function () {
                Array.prototype.forEach.call(tabs, function (b) { b.classList.remove('on'); });
                btn.classList.add('on');
                var name = btn.getAttribute('data-tab');
                Array.prototype.forEach.call(self.sheet.querySelectorAll('.cl-pane'), function (p) {
                    p.hidden = p.getAttribute('data-pane') !== name;
                });
            });
        });

        /* 触屏布局工具 */
        var padOn = document.getElementById('cl-pad-on');
        if (padOn) {
            padOn.value = S.padOn || 'auto';
            padOn.addEventListener('change', function () {
                S.padOn = padOn.value; S.save(); self.applyForce();
            });
        }
        var stickOn = document.getElementById('cl-pad-stick');
        if (stickOn) {
            stickOn.checked = !(S.pad.stick && S.pad.stick.on === false);
            stickOn.addEventListener('change', function () {
                if (!S.pad.stick) S.pad.stick = { x: 0.05, y: 0.50, w: 0.28, dead: 0.26, on: true };
                S.pad.stick.on = stickOn.checked;
                S.save(); self.renderPad();
            });
        }
        var deadR = document.getElementById('cl-pad-dead');
        var deadV = document.getElementById('cl-pad-dead-v');
        if (deadR) {
            deadR.value = (S.pad.stick && S.pad.stick.dead) || 0.26;
            if (deadV) deadV.textContent = (+deadR.value).toFixed(2);
            deadR.addEventListener('input', function () {
                if (!S.pad.stick) S.pad.stick = { x: 0.05, y: 0.50, w: 0.28, dead: 0.26, on: true };
                S.pad.stick.dead = +deadR.value;
                if (deadV) deadV.textContent = (+deadR.value).toFixed(2);
                S.save(); self.refreshTouch();
            });
        }
        var edit = document.getElementById('cl-pad-edit');
        if (edit) edit.addEventListener('click', function () {
            self.padSnapshot = JSON.parse(JSON.stringify(S.pad));
            self.enterEdit();
        });
        var addBtn = document.getElementById('cl-pad-add-btn');
        if (addBtn) addBtn.addEventListener('click', function () {
            var sel = document.getElementById('cl-pad-add');
            var k = sel ? sel.value : 'jump';
            S.pad.buttons.push({
                k: k, label: (S.label && S.label[k]) || k,
                x: 0.4, y: 0.4, w: 0.14, h: 0.11
            });
            self.renderPad(); S.save();
        });
        var savePad = document.getElementById('cl-pad-save');
        if (savePad) savePad.addEventListener('click', function () { S.save(); self.app.log('CELESTE · 布局已保存'); });
        var resetPad = document.getElementById('cl-pad-reset');
        if (resetPad) resetPad.addEventListener('click', function () { S.resetPad(); self.renderPad(); });
        var exportPad = document.getElementById('cl-pad-export');
        if (exportPad) exportPad.addEventListener('click', function () { S.exportPad(); });
        var importInput = document.getElementById('cl-pad-import');
        if (importInput) importInput.addEventListener('change', function () {
            var f = importInput.files && importInput.files[0];
            if (!f) return;
            var rd = new FileReader();
            rd.onload = function () {
                S.importPad(String(rd.result), function (ok) {
                    self.app.log(ok ? 'CELESTE · 布局已导入' : 'CELESTE · 导入失败：不是有效布局');
                    if (ok) self.renderPad();
                });
            };
            rd.readAsText(f);
            importInput.value = '';
        });

        /* MOD */
        var bindCheck = function (id, key, after) {
            var el = document.getElementById(id);
            if (!el) return;
            el.checked = !!S.mods[key];
            el.addEventListener('change', function () {
                S.mods[key] = el.checked; S.save();
                if (after) after(el.checked);
            });
        };
        bindCheck('cl-mod-speedX', 'speedX');
        bindCheck('cl-mod-speedY', 'speedY');
        bindCheck('cl-mod-stamina', 'stamina');
        bindCheck('cl-mod-infDash', 'infDash');
        bindCheck('cl-mod-invincible', 'invincible');
        bindCheck('cl-mod-ice', 'ice');
        bindCheck('cl-mod-springy', 'springy');
        bindCheck('cl-mod-keyOverlay', 'keyOverlay');
        bindCheck('cl-mod-debugHit', 'debugHit');

        var bindRange = function (id, key, out) {
            var el = document.getElementById(id);
            var lb = document.getElementById(out);
            if (!el) return;
            el.value = S.mods[key];
            if (lb) lb.textContent = Number(S.mods[key]).toFixed(2);
            el.addEventListener('input', function () {
                S.mods[key] = +el.value; S.save();
                if (lb) lb.textContent = (+el.value).toFixed(2);
            });
        };
        bindRange('cl-mod-gravity', 'gravity', 'cl-mod-gravity-v');
        bindRange('cl-mod-runMult', 'runMult', 'cl-mod-run-v');

        var resetMods = document.getElementById('cl-mod-reset');
        if (resetMods) resetMods.addEventListener('click', function () {
            S.resetMods();
            ['speedX', 'speedY', 'infDash', 'invincible', 'ice', 'springy'].forEach(function (k) {
                var el = document.getElementById('cl-mod-' + k);
                if (el) el.checked = false;
            });
            var st = document.getElementById('cl-mod-stamina');
            if (st) st.checked = true;
            var g = document.getElementById('cl-mod-gravity'), r = document.getElementById('cl-mod-runMult');
            var gv = document.getElementById('cl-mod-gravity-v'), rv = document.getElementById('cl-mod-run-v');
            if (g) g.value = 1; if (gv) gv.textContent = '1.00';
            if (r) r.value = 1; if (rv) rv.textContent = '1.00';
            self.app.log('CELESTE · MOD 已重置（原版手感）');
        });
    };

    UI.prototype.renderKeys = function () {
        var self = this;
        var S = Celeste.settings;
        var list = document.getElementById('cl-keys-list');
        if (!list) return;
        list.innerHTML = '';
        Object.keys(S.keys).forEach(function (a) {
            var row = document.createElement('div');
            row.className = 'cl-kv-row';
            var nm = document.createElement('span');
            nm.textContent = (S.label && S.label[a]) || a;
            var k1 = document.createElement('b');
            k1.textContent = S.keyLabel(S.keys[a][0]);
            var k2 = document.createElement('b');
            k2.textContent = S.keyLabel(S.keys[a][1]);
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'cl-btn';
            btn.textContent = '绑定';
            btn.addEventListener('click', function () { self.captureKey(a, btn); });
            row.appendChild(nm); row.appendChild(k1); row.appendChild(k2); row.appendChild(btn);
            list.appendChild(row);
        });
    };

    UI.prototype.captureKey = function (action, btn) {
        var self = this;
        var S = Celeste.settings;
        var old = btn.textContent;
        btn.textContent = '按下按键…';
        var handler = function (e) {
            e.preventDefault();
            e.stopPropagation();
            document.removeEventListener('keydown', handler, true);
            if (e.code === 'Escape') { btn.textContent = old; return; }
            var code = e.code;
            /* 从其它动作里摘掉同一个键，避免一键多义 */
            Object.keys(S.keys).forEach(function (k) {
                if (k === action) return;
                var rest = S.keys[k].filter(function (c) { return c !== code; });
                if (!rest.length) return;           /* 别把别的动作抢成空，那它就永久失灵了 */
                S.keys[k] = rest;
            });
            S.keys[action] = [code];
            S.save();
            self.renderKeys();
            self.updateHint();
            self.app.log('CELESTE · ' + ((S.label && S.label[action]) || action) + ' → ' + S.keyLabel(code));
        };
        document.addEventListener('keydown', handler, true);
    };

    /* 画面左下角的键位提示随自定义键位更新 */
    UI.prototype.updateHint = function () {
        var el = document.getElementById('cl-keys-hint');
        var S = Celeste.settings;
        if (!el || !S) return;
        var k = function (a) { return S.keyLabel(S.keys[a][0]) + (S.keys[a][1] ? '/' + S.keyLabel(S.keys[a][1]) : ''); };
        el.innerHTML = '<span><b>' + k('left') + ' ' + k('right') + '</b> 移动</span>' +
            '<span><b>' + k('jump') + '</b> 跳</span>' +
            '<span><b>' + k('dash') + '</b> 冲刺</span>' +
            '<span><b>' + k('grab') + '</b> 抓墙</span>' +
            '<span><b>' + k('demo') + '</b> 蹲冲</span>';
    };

    UI.prototype.update = function (level, player) {
        var t = level.time, d = level.deaths, b = level.berriesGot, dash = player.dashes;
        /* 时间只按 10ms 刷新，60fps 下 DOM 写入从每秒 60 次降到 10 次 */
        var tt = Math.floor(t * 100) / 100;
        if (tt !== this.last.t) { this.timeEl.textContent = fmtTime(t); this.last.t = tt; }
        if (d !== this.last.d) { this.deathEl.textContent = d; this.last.d = d; }
        if (b !== this.last.b) { this.berryEl.textContent = b + '/3'; this.last.b = b; }
        if (dash !== this.last.dash) {
            var html = '';
            for (var i = 0; i < player.maxDashes; i++) {
                html += '<span class="cl-dash-dot' + (i < dash ? ' on' : '') + '"></span>';
            }
            this.dashEl.innerHTML = html;
            this.last.dash = dash;
        }

        /* 按键显示叠层（速通用，设置里开） */
        if (this.keyEl) {
            var mods = (Celeste.settings && Celeste.settings.mods) || {};
            var show = !!mods.keyOverlay;
            this.keyEl.classList.toggle('show', show);
            if (show) {
                var inp = this.app.input || {};
                var st = {
                    left: inp.x < -0.3, right: inp.x > 0.3,
                    up: inp.y < -0.3, down: inp.y > 0.3,
                    jump: !!inp.jump, dash: !!inp.dashPressed,
                    grab: !!inp.grab, demo: !!inp.demoPressed
                };
                Array.prototype.forEach.call(this.keyEl.children, function (b) {
                    b.classList.toggle('on', !!st[b.getAttribute('data-k')]);
                });
            }
        }
    };

    UI.prototype.showPause = function (on) {
        if (this.pauseEl) this.pauseEl.hidden = !on;
    };

    UI.prototype.showOver = function (level, best, isPB, splits) {
        this.overTime.textContent = fmtTime(level.time);
        this.overDeaths.textContent = level.deaths;
        this.overBerries.textContent = level.berriesGot + '/3';
        if (this.overPB) {
            this.overPB.textContent = best ? fmtTime(best) : '—';
            this.overPB.parentNode.classList.toggle('new', !!isPB);
        }
        if (this.overSplits) {
            var list = (splits && splits.length) ? splits : [];
            if (!list.length) {
                this.overSplits.innerHTML = '';
                this.overSplits.hidden = true;
            } else {
                this.overSplits.hidden = false;
                var prevT = 0;
                this.overSplits.innerHTML = '<span class="cl-sp-head">SPLITS · ' + list.length + ' CP</span>' +
                    list.map(function (c, i) {
                        var seg = c.t - prevT;
                        prevT = c.t;
                        return '<div class="cl-sp-row"><em>CP' + (i + 1) + '</em><b>' + fmtTime(c.t) +
                            '</b><i>+' + fmtTime(seg) + '</i></div>';
                    }).join('') +
                    '<div class="cl-sp-row cl-sp-last"><em>FINISH</em><b>' + fmtTime(level.time) +
                    '</b><i>+' + fmtTime(level.time - prevT) + '</i></div>';
            }
        }
        this.overEl.hidden = false;
    };

    /* ---------------- 迷你音效（WebAudio 合成，无外部资源） ---------------- */
    function Sfx() {
        this.ctx = null;
        this.on = true;
    }
    Sfx.prototype.ensure = function () {
        if (!this.ctx) {
            try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.on = false; }
        }
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
        return this.ctx;
    };
    Sfx.prototype.blip = function (freq, dur, type, gain) {
        if (!this.on) return;
        var ctx = this.ensure();
        if (!ctx) return;
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type || 'square';
        o.frequency.value = freq;
        g.gain.value = gain == null ? 0.06 : gain;
        o.connect(g); g.connect(ctx.destination);
        var t0 = ctx.currentTime;
        g.gain.setValueAtTime(g.gain.value, t0);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.start(t0); o.stop(t0 + dur);
    };
    Sfx.prototype.play = function (name) {
        switch (name) {
            case 'jump': this.blip(420, 0.09, 'triangle', 0.05); break;
            case 'doublejump': this.blip(520, 0.1, 'triangle', 0.05); break;
            case 'walljump': this.blip(300, 0.1, 'square', 0.05); break;
            case 'dash': this.blip(700, 0.14, 'sawtooth', 0.04); break;
            case 'land': this.blip(120, 0.06, 'sine', 0.05); break;
            case 'death': this.blip(180, 0.25, 'sawtooth', 0.05); break;
            case 'crystal': this.blip(880, 0.12, 'triangle', 0.05); break;
            case 'berry': this.blip(1100, 0.16, 'sine', 0.06); break;
            case 'finish': this.blip(760, 0.4, 'triangle', 0.05); break;
        }
    };
    Celeste.Sfx = Sfx;
    Celeste.UI = UI;
})();
