/* celeste-core.js —— 常量 / 输入 / 瓦片碰撞 / 粒子
   参考 Celeste（蔚蓝）Player.cs 的公开物理参数与状态机结构用 JS 重写，
   不是德文原码移植：数值按 8px 瓦片、320×180 逻辑分辨率调校，手感对齐原作。 */
(function () {
    'use strict';
    var Celeste = window.Celeste = window.Celeste || {};

    /* ---------------- 常量（单位：像素 / 秒） ---------------- */
    var C = Celeste.C = {
        VW: 320, VH: 180,          /* 逻辑分辨率（原作同尺寸） */
        TILE: 8,

        /* ---- 以下数值全部取自 Celeste Player.cs 常量区，未做调参 ---- */
        MaxRun: 90, RunAccel: 1000, RunReduce: 400,
        AirMult: 0.65,
        Gravity: 900, MaxFall: 160, FastMaxFall: 240, FastMaxAccel: 300,
        HalfGravThreshold: 40,
        JumpSpeed: -105, JumpHBoost: 40,
        VarJumpTime: 0.2, JumpGraceTime: 0.1, JumpBuffer: 0.15,
        CeilingVarJumpGrace: 0.05,
        UpwardCornerCorrection: 4,
        WallJumpCheckDist: 3, WallJumpForceTime: 0.16,
        WallJumpHSpeed: 130,                 /* MaxRun + JumpHBoost */
        WallSlideStartMax: 20, WallSlideTime: 1.2, WallSpeedRetentionTime: 0.06,
        DashboardMoveTime: 0.3,
        SuperJumpH: 260, SuperJumpSpeed: -105,
        SuperWallJumpSpeed: -160, SuperWallJumpVarTime: 0.25,
        SuperWallJumpForceTime: 0.2, SuperWallJumpH: 170,
        DashSpeed: 240, EndDashSpeed: 160, EndDashUpMult: 0.75,
        DashTime: 0.15, DashCooldown: 0.2, DashRefillCooldown: 0.1,
        DashHJumpThruNudge: 6, DashCornerCorrection: 4,
        DashVFloorSnapDist: 3, DashAttackTime: 0.3,
        DuckFriction: 500, DuckCorrectCheck: 4, DuckCorrectSlide: 50,
        DodgeSlideSpeedMult: 1.2,
        DuckSuperJumpXMult: 1.25, DuckSuperJumpYMult: 0.5,
        ClimbMaxStamina: 110,
        ClimbUpCost: 100 / 2.2, ClimbStillCost: 10, ClimbJumpCost: 110 / 4,
        ClimbUpSpeed: -45, ClimbDownSpeed: 80, ClimbSlipSpeed: 30,
        ClimbAccel: 900, ClimbGrabYMult: 0.2,
        ClimbCheckDist: 2, ClimbUpCheckDist: 2, ClimbNoMoveTime: 0.1,
        ClimbTiredThreshold: 20,
        ClimbHopY: -120, ClimbHopX: 100, ClimbHopForceTime: 0.2,
        ClimbJumpBoostTime: 0.2, ClimbHopNoWindTime: 0.3,
        SpringSpeed: -330, SpringVarJumpTime: 0.2,
        LaunchSpeed: 280, LaunchCancelThreshold: 220,

        /* ---- 旧键名保留（渲染 / 关卡 / UI 仍在用） ---- */
        RUN_MAX: 90, RUN_ACCEL: 1000, RUN_REDUCE: 400, AIR_MULT: 0.65,
        GRAVITY: 900, MAX_FALL: 160, FAST_MAX_FALL: 240, HALF_GRAV_THRESHOLD: 40,
        JUMP_SPEED: -105, JUMP_H: 40, VAR_JUMP_TIME: 0.2, JUMP_GRACE: 0.1, JUMP_BUFFER: 0.15,
        WALL_JUMP_H: 130, WALL_JUMP_FORCE_TIME: 0.16,
        DASH_SPEED: 240, END_DASH_SPEED: 160, DASH_TIME: 0.15, DASH_COOLDOWN: 0.2, DASH_REFILL_CD: 0.1,
        SUPER_JUMP_H: 260, SUPER_WJ_H: 170, SPRING_SPEED: -330,
        CLIMB_MAX_STAMINA: 110, CLIMB_UP_COST: 100 / 2.2, CLIMB_DOWN_COST: 30,
        CLIMB_STILL_COST: 10, CLIMB_JUMP_COST: 27.5,
        CLIMB_UP_SPEED: -45, CLIMB_DOWN_SPEED: 80, CLIMB_SLIP_SPEED: 30, CLIMB_GRAB_Y_MULT: 0.2,
        CORNER_CORRECT: 4,
        /* 配色（暗色主题为主，浅色主题由 CSS 变量覆盖不了 canvas，这里给两套） */
        PAL: {
            sky0: '#150c22', sky1: '#241436',
            tile: '#2d1c45', tileTop: '#4a2f6d', tileEdge: '#6b4a96',
            spike: '#e8e2ff', body: '#efe9ff', eye: '#1b1026',
            hair: '#e0455f', hair2: '#b5304a',
            crystal: '#57e0c8', crystalCore: '#c8fff4',
            spring: '#f2c14e', berry: '#ff5b7f', goal: '#8ee7ff',
            skin: '#ffe0c8', coat: '#4f86c6', pants: '#3a2c52', pack: '#8a5a34',
            dust: 'rgba(200,180,255,.55)'
        }
    };

    /* ---------------- 输入 ---------------- */
    function Input() {
        var down = {};
        var pressed = {};
        var self = this;
        this.x = 0; this.y = 0;
        this.jump = false; this.jumpPressed = false;
        this.dashPressed = false; this.grab = false; this.demoPressed = false;

        /* 键位表来自 Celeste.settings（可自定义），拿不到就退回默认 */
        var FALLBACK = {
            left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'],
            up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
            jump: ['Space', 'KeyK'], dash: ['KeyZ', 'KeyJ'],
            grab: ['ShiftLeft', 'KeyL'], demo: ['KeyX']
        };
        function actionOf(code) {
            var K = (window.Celeste.settings && window.Celeste.settings.keys) || FALLBACK;
            for (var a in K) {
                if (!Object.prototype.hasOwnProperty.call(K, a)) continue;
                if (K[a] && K[a].indexOf(code) >= 0) return a;
            }
            return null;
        }

        function onKey(e) {
            var k = actionOf(e.code);
            if (!k) return;
            /* 默认键位顺手拦住浏览器行为（空格滚动 / 方向键滚），
               自定义键同样拦（否则绑到 F5、Backspace 会刷新或后退），
               但带 Ctrl / Cmd / Alt 的组合放过去，避免连 F12、Ctrl+W 一起吃了 */
            if (!e.ctrlKey && !e.metaKey && !e.altKey) e.preventDefault();
            if (!down[k]) pressed[k] = true;
            down[k] = true;
        }
        function onKeyUp(e) {
            var k = actionOf(e.code);
            if (!k) return;
            down[k] = false;
        }

        var onBlur = function () { down = {}; pressed = {}; self.x = 0; self.y = 0; };
        this.attach = function () {
            this.detach();                    /* 重复 attach 不叠加监听 */
            window.addEventListener('keydown', onKey);
            window.addEventListener('keyup', onKeyUp);
            window.addEventListener('blur', onBlur);
            this._attached = true;
        };
        this.detach = function () {
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('keyup', onKeyUp);
            window.removeEventListener('blur', onBlur);
            this._attached = false;
        };

        /* 手柄：接上就自动生效，走标准映射（A 跳 / B 冲 / X 抓 / Y 蹲冲 / 十字键或左摇杆方向） */
        var padHeld = {};
        function pollPad() {
            if (!navigator.getGamepads) return;
            var gps = null;
            try { gps = navigator.getGamepads(); } catch (e) { return; }
            var gp = null, i;
            for (i = 0; gps && i < gps.length; i++) if (gps[i] && gps[i].connected) { gp = gps[i]; break; }
            if (!gp) {
                for (var kk in padHeld) { if (padHeld[kk]) { down[kk] = false; padHeld[kk] = false; } }
                return;
            }
            function btn(n) { var b = gp.buttons[n]; return !!(b && (b.pressed || (b.value || 0) > 0.5)); }
            var ax = gp.axes && gp.axes.length > 0 ? gp.axes[0] : 0;
            var ay = gp.axes && gp.axes.length > 1 ? gp.axes[1] : 0;
            var dz = 0.4;
            var state = {
                left: ax < -dz || btn(14), right: ax > dz || btn(15),
                up: ay < -dz || btn(12), down: ay > dz || btn(13),
                jump: btn(0), dash: btn(1), grab: btn(2) || btn(4), demo: btn(3)
            };
            for (var a in state) {
                if (state[a]) {
                    if (!down[a]) pressed[a] = true;
                    down[a] = true; padHeld[a] = true;
                } else if (padHeld[a]) {
                    down[a] = false; padHeld[a] = false;
                }
            }
        }

        this.beginFrame = function () {
            pollPad();                        /* 手柄先写进 down/pressed，和键盘共用同一张表 */
            self.x = (down.right ? 1 : 0) - (down.left ? 1 : 0);
            self.y = (down.down ? 1 : 0) - (down.up ? 1 : 0);
            self.grab = !!down.grab;
            self.jump = !!down.jump ? 1 : 0;
            self.jumpPressed = !!pressed.jump;
            self.dashPressed = !!pressed.dash;
            self.demoPressed = !!pressed.demo;
            pressed = {};
        };

        /* 触屏：主区域拖动=方向，右侧虚拟键 */
        this.applyTouch = function (v) {
            self.x = v.x; self.y = v.y; self.grab = v.grab;
            self.jump = v.jump ? 1 : 0;
            self.jumpPressed = v.jumpPressed;
            self.dashPressed = v.dashPressed;
            self.demoPressed = v.demoPressed;
        };
    }
    Celeste.Input = Input;

    /* ---------------- 瓦片地图 ---------------- */
    function Tilemap(wTiles, hTiles) {
        this.w = wTiles; this.h = hTiles;
        this.cols = wTiles;
        this.rows = hTiles;
        this.solid = new Uint8Array(wTiles * hTiles);   /* 1 = 实心 */
        this.deco = new Uint8Array(wTiles * hTiles);    /* 0 空 1 实心 2 实心内 3 顶面亮线 */
    this.pw = wTiles * C.TILE; this.ph = hTiles * C.TILE;
    this.outSolid = false;                          /* 越界是否实心 */
    this.outKind = 1;
    this.bounds = [];
    this.style = 'rock';
    this.spawn = { x: 16, y: 0 };
    this.entities = [];
    this.name = '';
    this.sky = null;
    this.extra = {};
    this.kind = null;
    this.mods = null;
    this.mods2 = null;
    this.lastClip = null;
    this.occlusions = [];
    this.shapeBlocked = null;
    this.saveData = null;
    this.vsp = null;
    this.zIndex = 0;
    this.bg = null;
    this.fg = null;
  }
    Celeste.Tilemap = Tilemap;

    Tilemap.prototype.idx = function (tx, ty) { return ty * this.cols + tx; };

    Tilemap.prototype.setRect = function (tx, ty, tw, th, v) {
        for (var y = ty; y < ty + th; y++) {
            for (var x = tx; x < tx + tw; x++) {
                if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) continue;
                this.solid[y * this.cols + x] = v;
            }
        }
    };

    Tilemap.prototype.tileSolid = function (tx, ty) {
        if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return this.outSolid;
        return this.solid[ty * this.cols + tx] === 1;
    };

    Tilemap.prototype.solidAt = function (px, py) {
        return this.tileSolid(Math.floor(px / C.TILE), Math.floor(py / C.TILE));
    };

    /* AABB 与地形是否有重叠：先做瓦片范围粗判，再逐瓦片 */
    Tilemap.prototype.overlaps = function (x, y, w, h) {
        var t0x = Math.floor(x / C.TILE), t1x = Math.floor((x + w - 1) / C.TILE);
        var t0y = Math.floor(y / C.TILE), t1y = Math.floor((y + h - 1) / C.TILE);
        for (var ty = t0y; ty <= t1y; ty++) {
            for (var tx = t0x; tx <= t1x; tx++) {
                if (this.tileSolid(tx, ty)) return true;
            }
        }
        return false;
    };

    /* 计算每个实心格的描边类型：邻接空格的边亮 */
    Tilemap.prototype.bake = function () {
        var d = this.deco;
        for (var y = 0; y < this.rows; y++) {
            for (var x = 0; x < this.cols; x++) {
                var i = y * this.cols + x;
                if (!this.solid[i]) { d[i] = 0; continue; }
                var t = !this.tileSolid(x, y - 1);
                var b = !this.tileSolid(x, y + 1);
                var l = !this.tileSolid(x - 1, y);
                var r = !this.tileSolid(x + 1, y);
                d[i] = (t || b || l || r) ? 1 : 2;
            }
        }
    };

    /* ---------------- 粒子 ---------------- */
    function Particles(max) {
        this.max = max || 240;
        this.list = [];
    }
    Particles.prototype.spawn = function (x, y, vx, vy, life, color, size) {
        if (this.list.length >= this.max) this.list.shift();
        this.list.push({
            x: x, y: y, vx: vx, vy: vy,
            life: life, max: life, color: color || C.PAL.dust,
            size: size || 1, grav: 0
        });
    };
    Particles.prototype.burst = function (x, y, n, speed, color) {
        for (var i = 0; i < n; i++) {
            var a = Math.random() * Math.PI * 2;
            var s = speed * (0.35 + Math.random() * 0.9);
            this.spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.35 + Math.random() * 0.45, color, 1);
        }
    };
    Particles.prototype.update = function (dt) {
        for (var i = this.list.length - 1; i >= 0; i--) {
            var p = this.list[i];
            p.life -= dt;
            if (p.life <= 0) { this.list.splice(i, 1); continue; }
            p.x += p.vx * dt; p.y += p.vy * dt;
            p.vx *= 0.94; p.vy *= 0.94;
        }
    };
    Particles.prototype.draw = function (ctx, ox, oy) {
        for (var i = 0; i < this.list.length; i++) {
            var p = this.list[i];
            ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.max));
            ctx.fillStyle = p.color;
            ctx.fillRect(Math.round(p.x - ox), Math.round(p.y - oy), p.size, p.size);
        }
        ctx.globalAlpha = 1;
    };
    Celeste.Particles = Particles;

    /* ---------------- 小工具 ---------------- */
    Celeste.approach = function (val, target, maxDelta) {
        return val > target ? Math.max(val - maxDelta, target) : Math.min(val + maxDelta, target);
    };
    Celeste.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
    Celeste.lerp = function (a, b, t) { return a + (b - a) * t; };

    Celeste.C = C;
})();
