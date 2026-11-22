/* celeste-level.js —— 关卡（矩形拼装成瓦片地形）+ 实体（尖刺 / 弹簧 / 冲刺水晶 / 草莓 / 终点）
   关卡全部用 tile 坐标手写，8px 一格；改地图只要改 LEVEL 里的 rects。 */
(function () {
    'use strict';
    var Celeste = window.Celeste;
    var C = Celeste.C;

    /* ---------------- 关卡数据 ---------------- */
    /* rects: [x, y, w, h]（tile）；spikes: [x, y, w, dir]  dir: 'up'|'down'|'left'|'right' */
    /* 关卡：按 Celeste 第一章 Forsaken City (1A) 的房间尺寸与教学节奏手工重建的复刻版，
       不是官方 .bin 里的原始像素数据（原始关卡为二进制关卡文件，本站没有该文件）。
       世界 120×44 格（1A 单房间是 40×23），横向串 3 个房间宽，纵向多留一层给塔。 */
    /* 1A 首房间（Awake）：40×23 格，和原版房间尺寸一致。
       左端低地起步 → 中段两级台阶抬起 → 高台平地 → 右端小落差 → 出口门，
       上方留一个悬空平台放草莓。整间不设尖刺，对应原版开局的教学房间。 */
    var LEVEL = {
        name: 'FORSAKEN CITY 1A',
        w: 40, h: 23,
        spawn: [4 * 8, 20 * 8 - 11],

        checkpoints: [],

        rects: [
            /* 地形一律画成“落地实心块”，不做悬空薄板，观感才像原版地面 */
            [0, 20, 14, 3],          /* 左段地面，顶 160 */
            [10, 18, 5, 5],          /* 第一级台阶，顶 144，实心到地 */
            [13, 16, 16, 7],         /* 高台主体，顶 128，x 13..28 */
            [22, 14, 4, 1],          /* 悬空草莓平台，顶 112（高台 128 → 抬 16px 可跳 */
            [28, 18, 4, 5],          /* 右段降一级，顶 144 */
            [32, 20, 8, 3],          /* 出口地面，顶 160 */
            /* 左右边界 */
            [0, 0, 1, 23], [39, 0, 1, 23]
        ],

        spikes: [],

        springs: [],

        crystals: [],

        berries: [
            [24, 13]                 /* 悬空平台上 */
        ],

        goal: [36, 16]
    };

    function Level(data) {
        this.data = data;
        this.map = new Celeste.Tilemap(data.w, data.h);
        data.rects.forEach(function (r) { this.map.setRect(r[0], r[1], r[2], r[3], 1); }, this);
        this.map.bake();
        this.map.spawn = { x: data.spawn[0], y: data.spawn[1] };
        this.spikes = data.spikes.map(function (s) {
            return { x: s[0] * C.TILE, y: s[1] * C.TILE, w: s[2] * C.TILE, h: C.TILE, dir: s[3] };
        });
        this.springs = data.springs.map(function (s) {
            return { x: s[0] * C.TILE, y: s[1] * C.TILE, w: C.TILE * 2, h: C.TILE, t: 0, cd: 0 };
        });
        this.crystals = data.crystals.map(function (s) {
            return { x: s[0] * C.TILE + 4, y: s[1] * C.TILE + 4, r: 5, cd: 0, pop: 1 };
        });
        this.berries = data.berries.map(function (s) {
            return { x: s[0] * C.TILE + 4, y: s[1] * C.TILE + 4, taken: false, t: 0 };
        });
        this.checkpoints = (data.checkpoints || []).map(function (s) {
            return { x: s[0] * C.TILE, y: s[1] * C.TILE, w: 8, h: 8, on: false, t: 0 };
        });
        this.goal = { x: data.goal[0] * C.TILE, y: data.goal[1] * C.TILE, w: 8, h: 32 };
        this.time = 0;
        this.deaths = 0;
        this.berriesGot = 0;
        this.finished = false;
        this.finishTimer = 0;
        this.shake = 0;
    }

    Level.prototype.reset = function () {
        this.time = 0; this.deaths = 0; this.berriesGot = 0;
        this.finished = false; this.finishTimer = 0;
        this.berries.forEach(function (b) { b.taken = false; });
        this.checkpoints.forEach(function (c) { c.on = false; });
        this.crystals.forEach(function (c) { c.cd = 0; c.pop = 1; });
        this.springs.forEach(function (s) { s.t = 0; s.cd = 0; });
        this.activeCheckpoint = null;
    };

    function overlap(a, b) {
        return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }
    Level.prototype.rectOverlap = overlap;

    /* 实体更新 + 玩家交互，返回事件（供 UI / 音效用） */
    Level.prototype.update = function (dt, player, particles) {
        /* 关卡计时在 celeste-boot.js 里统一推进，这里不再重复累加 */
        var ev = [];
        var p = player.rect();

        /* 尖刺：内缩 2px 判定，避免擦边就死 */
        for (var i = 0; i < this.spikes.length; i++) {
            var s = this.spikes[i];
            var inner = { x: s.x + 3, y: s.y + (s.dir === 'up' ? 5 : 1), w: s.w - 6, h: s.h - 5 };
            if (overlap(p, inner) && !(window.Celeste.mods && window.Celeste.mods.invincible)) player.kill();
        }

        /* 弹簧 */
        for (var j = 0; j < this.springs.length; j++) {
            var sp = this.springs[j];
            sp.t = Math.max(0, sp.t - dt * 6);
            if (sp.cd > 0) sp.cd -= dt;
            if (sp.cd <= 0 && overlap(p, { x: sp.x, y: sp.y - 2, w: sp.w, h: sp.h })) {
                player.vy = C.SPRING_SPEED;
                player.varJumpTimer = 0.2; player.varJumpSpeed = player.vy;
                player.state = 'normal';
                sp.t = 1; sp.cd = 0.3;
                particles.burst(sp.x + sp.w / 2, sp.y, 10, 50, C.PAL.spring);
                ev.push('spring');
            }
        }

        /* 冲刺水晶：补满冲刺 */
        for (var k = 0; k < this.crystals.length; k++) {
            var c = this.crystals[k];
            if (c.cd > 0) {
                c.cd -= dt;
                c.pop = Math.max(0, c.pop - dt * 2);
                if (c.cd <= 0) c.pop = 1;
            }
            if (c.cd <= 0) {
                var dx = p.x + p.w / 2 - c.x, dy = p.y + p.h / 2 - c.y;
                if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
                    player.dashes = player.maxDashes;
                    player.stamina = C.CLIMB_MAX_STAMINA;
                    c.cd = 1.6;
                    particles.burst(c.x, c.y, 12, 48, C.PAL.crystal);
                    ev.push('crystal');
                }
            }
        }

        /* 草莓 */
        for (var b = 0; b < this.berries.length; b++) {
            var bb = this.berries[b];
            bb.t += dt;
            if (!bb.taken) {
                if (Math.abs(p.x + p.w / 2 - bb.x) < 8 && Math.abs(p.y + p.h / 2 - bb.y) < 9) {
                    bb.taken = true;
                    this.berriesGot++;
                    particles.burst(bb.x, bb.y, 10, 40, C.PAL.berry);
                    ev.push('berry');
                }
            }
        }

        /* 检查点：碰到就把重生点挪到这里 */
        for (var ci = 0; ci < this.checkpoints.length; ci++) {
            var cp = this.checkpoints[ci];
            cp.t += dt;
            if (!cp.on && overlap(p, cp)) {
                cp.on = true;
                player.spawnAt = { x: cp.x - 1, y: cp.y + cp.h - 11 };
                this.activeCheckpoint = cp;
                particles.burst(cp.x + 4, cp.y + 6, 10, 34, C.PAL.goal);
                ev.push('checkpoint');
            }
        }

        /* 终点 */
        if (!this.finished && overlap(p, this.goal)) {
            this.finished = true;
            this.finishTimer = 0;
            ev.push('finish');
        }
        if (this.finished) {
            this.finishTimer += dt;
            if (this.finishTimer > 2.4) { /* 通关后自动复位，可继续刷 */ }
        }

        return ev;
    };


    /* ---------------- 额外内置图（v5.1） ---------------------------- */
    var GAP = {
        name: 'GAP GAUNTLET',
        w: 64, h: 26,
        spawn: [16, 149],
        rects: [
            [0, 20, 10, 6], [14, 20, 8, 6],
            [22, 18, 6, 2], [28, 16, 6, 2],
            [34, 20, 10, 6], [44, 18, 4, 2], [48, 16, 4, 2],
            [52, 14, 12, 2],
            [0, 0, 1, 26], [63, 0, 1, 26]
        ],
        spikes: [],
        springs: [[40, 19]],
        crystals: [[40, 18]],
        berries: [[24, 17], [46, 17]],
        checkpoints: [[16, 19], [34, 19]],
        goal: [58, 12]
    };

    var TOWER = {
        name: 'TOWER CLIMB',
        w: 48, h: 40,
        spawn: [16, 261],
        rects: [
            [0, 34, 48, 6],
            [4, 32, 4, 2], [9, 30, 4, 2], [14, 28, 4, 2], [19, 26, 4, 2],
            [24, 24, 4, 2], [29, 22, 4, 2], [34, 20, 4, 2], [39, 18, 4, 2],
            [43, 16, 5, 2],
            [0, 0, 1, 40], [47, 0, 1, 40]
        ],
        spikes: [],
        springs: [],
        crystals: [[9, 29]],
        berries: [[34, 19], [44, 15]],
        checkpoints: [[20, 33], [29, 21]],
        goal: [44, 14]
    };

    /* 关卡选择用：点一下直接载入 */
    Celeste.LEVELS = [
        { id: '1a', name: LEVEL.name, data: LEVEL },
        { id: 'gap', name: GAP.name, data: GAP },
        { id: 'tower', name: TOWER.name, data: TOWER }
    ];

    Celeste.Level = Level;
    Celeste.LEVEL = LEVEL;
})();
