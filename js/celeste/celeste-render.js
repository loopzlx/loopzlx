/* celeste-render.js —— 320×180 逻辑分辨率的像素渲染（相机跟随 + 视差背景 + 瓦片描边） */
(function () {
    'use strict';
    var Celeste = window.Celeste;
    var C = Celeste.C;

    var DARK = C.PAL;
    var LIGHT = {
        sky0: '#f7f2ff', sky1: '#dccbf4',
        tile: '#8a6fb4', tileTop: '#63458c', tileEdge: '#4d3273',
        spike: '#2f1f48', body: '#ffffff', eye: '#1c1130',
        hair: '#d93b55', hair2: '#a52a41',
        crystal: '#12907c', crystalCore: '#085a4d',
        skin: '#ffe0c8', coat: '#3d6b9c', pants: '#33283f', pack: '#8a5a34',
        spring: '#c8880f', berry: '#d92f50', goal: '#1f7f96',
        dust: 'rgba(75,45,120,.55)'
    };

    /* 内部分辨率倍率：逻辑仍是 320×180（物理常量不动），画布按 SUP 倍超采样，
       配合下面按半像素绘制的 16×22 精灵，边缘更细、不像以前那样一块一块糊在一起 */
    var SUP = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ? 1 : 2;

    function Renderer(canvas) {
        this.canvas = canvas;
        this.SUP = SUP;
        this.canvas.width = C.VW * SUP;
        this.canvas.height = C.VH * SUP;
        this.ctx = canvas.getContext('2d', { alpha: false });
        this.ctx.imageSmoothingEnabled = false;
        this.cam = { x: 0, y: 0 };
        this.pal = DARK;
        this.stars = [];
        for (var i = 0; i < 60; i++) {
            this.stars.push({
                x: Math.random() * C.VW * 2.4,
                y: Math.random() * C.VH,
                s: Math.random() < 0.25 ? 2 : 1,
                a: 0.25 + Math.random() * 0.5
            });
        }
        this.pillars = [];
        for (var j = 0; j < 18; j++) {
            this.pillars.push({
                x: j * 46 + (j * 37 % 23),
                w: 10 + (j * 13 % 18),
                h: 30 + (j * 29 % 70)
            });
        }
    }

    Renderer.prototype.setTheme = function (light) {
        this.light = !!light;
        this.pal = light ? LIGHT : DARK;
    };

    Renderer.prototype.follow = function (player, map, dt) {
        var tx = player.x + player.w / 2 - C.VW / 2;
        var ty = player.y + player.h / 2 - C.VH / 2 + 6;
        tx = Math.max(0, Math.min(tx, map.pw - C.VW));
        ty = Math.max(0, Math.min(ty, map.ph - C.VH));
        var lerp = 1 - Math.pow(0.0016, dt);
        if (!this._inited) { this.cam.x = tx; this.cam.y = ty; this._inited = true; }
        this.cam.x += (tx - this.cam.x) * lerp;
        this.cam.y += (ty - this.cam.y) * lerp;
    };

    Renderer.prototype.snapCam = function (player, map) {
        this._inited = false;
        this.cam.x = Math.max(0, Math.min(player.x + player.w / 2 - C.VW / 2, map.pw - C.VW));
        this.cam.y = Math.max(0, Math.min(player.y + player.h / 2 - C.VH / 2 + 6, map.ph - C.VH));
        this._inited = true;
    };

    Renderer.prototype.draw = function (level, player, particles, opts) {
        opts = opts || {};
        var ctx = this.ctx, pal = this.pal;
        ctx.setTransform(SUP, 0, 0, SUP, 0, 0);
        var camX = Math.round(this.cam.x), camY = Math.round(this.cam.y);
        var shake = opts.shake || 0;
        if (shake > 0) {
            camX += Math.round((Math.random() - 0.5) * shake * 4);
            camY += Math.round((Math.random() - 0.5) * shake * 4);
        }

        /* 天空 */
        var g = ctx.createLinearGradient(0, 0, 0, C.VH);
        g.addColorStop(0, pal.sky1);
        g.addColorStop(1, pal.sky0);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, C.VW, C.VH);

        /* 远景星点 */
        ctx.globalAlpha = 0.9;
        for (var s = 0; s < this.stars.length; s++) {
            var st = this.stars[s];
            var sx = ((st.x - camX * 0.18) % (C.VW * 2.4) + C.VW * 2.4) % (C.VW * 2.4);
            if (sx > C.VW + 2) continue;
            ctx.globalAlpha = st.a * (0.6 + 0.4 * Math.sin((performance.now() / 900) + st.x));
            ctx.fillStyle = pal.body;
            ctx.fillRect(Math.round(sx), Math.round(st.y - camY * 0.06), st.s, st.s);
        }
        ctx.globalAlpha = 1;

        /* 远景石柱剪影（视差 0.35） */
        ctx.fillStyle = this.light ? 'rgba(120,90,170,.16)' : 'rgba(255,255,255,.055)';
        for (var p = 0; p < this.pillars.length; p++) {
            var pl = this.pillars[p];
            var px = Math.round(pl.x - camX * 0.35);
            ctx.fillRect(px, C.VH - pl.h + Math.round(-camY * 0.12), pl.w, pl.h);
        }

        /* -------------- 瓦片 -------------- */
        var T = C.TILE;
        var tx0 = Math.floor(camX / T), tx1 = Math.ceil((camX + C.VW) / T);
        var ty0 = Math.floor(camY / T), ty1 = Math.ceil((camY + C.VH) / T);
        var map = level.map;
        for (var ty = ty0; ty <= ty1; ty++) {
            for (var tx = tx0; tx <= tx1; tx++) {
                if (!map.tileSolid(tx, ty)) continue;
                var px2 = tx * T - camX, py2 = ty * T - camY;
                ctx.fillStyle = pal.tile;
                ctx.fillRect(px2, py2, T, T);
                /* 稀疏噪点：只有约 1/4 的 tile 落一个 2px 暗点，避免地面变成棋盘格 */
                var hs = ((tx * 73856093) ^ (ty * 19349663)) >>> 0;
                if ((hs & 3) === 0) {
                    ctx.globalAlpha = 0.10;
                    ctx.fillStyle = pal.tileEdge;
                    ctx.fillRect(px2 + ((hs >>> 4) & 1) * 4 + 1, py2 + ((hs >>> 5) & 1) * 4 + 1, 2, 2);
                    ctx.globalAlpha = 1;
                }
                if (!map.tileSolid(tx, ty + 1)) {
                    ctx.fillStyle = 'rgba(0,0,0,.22)';
                    ctx.fillRect(px2, py2 + T - 3, T, 3);
                }
                /* 露出的边描亮线 */
                if (!map.tileSolid(tx, ty - 1)) {
                    ctx.fillStyle = pal.tileTop;
                    ctx.fillRect(px2, py2, T, 1.5);
                    ctx.fillStyle = pal.tileEdge;
                    ctx.globalAlpha = 0.75;
                    ctx.fillRect(px2, py2, T, 1);
                    ctx.globalAlpha = 1;
                }
                if (!map.tileSolid(tx - 1, ty)) {
                    ctx.fillStyle = pal.tileTop;
                    ctx.fillRect(px2, py2, 1, T);
                }
                if (!map.tileSolid(tx + 1, ty)) {
                    ctx.fillStyle = pal.tileTop;
                    ctx.fillRect(px2 + T - 1, py2, 1, T);
                }
            }
        }

        /* -------------- 实体 -------------- */
        var i;
        /* 尖刺 */
        for (i = 0; i < level.spikes.length; i++) {
            var sp = level.spikes[i];
            var nx = sp.x - camX, ny = sp.y - camY;
            if (nx > C.VW || nx + sp.w < -8) continue;
            ctx.fillStyle = pal.spike;
            var cells = Math.max(1, Math.round(sp.w / T));
            for (var c = 0; c < cells; c++) {
                var cx = nx + c * T;
                for (var sub = 0; sub < 1; sub++) {
                    var sbx = cx + sub * T;
                    if (sp.dir === 'up') {
                        ctx.beginPath();
                        ctx.moveTo(sbx + 0.5, ny + T);
                        ctx.lineTo(sbx + T / 2, ny + 1.5);
                        ctx.lineTo(sbx + T / 2 - 0.5, ny + T);
                        ctx.closePath();
                        ctx.fill();
                    } else if (sp.dir === 'down') {
                        ctx.beginPath();
                        ctx.moveTo(sbx + 0.5, ny);
                        ctx.lineTo(sbx + T / 4, ny + T - 2);
                        ctx.lineTo(sbx + T / 2 - 0.5, ny);
                        ctx.closePath();
                        ctx.fill();
                    }
                }
            }
        }

        /* 弹簧 */
        for (i = 0; i < level.springs.length; i++) {
            var spr = level.springs[i];
            var spx = spr.x - camX, spy = spr.y - camY;
            var squish = spr.t > 0 ? 4 * spr.t : 0;
            ctx.fillStyle = pal.spring;
            ctx.fillRect(spx + 1, spy + 5 + squish, spr.w - 2, 3 - squish / 2);
            ctx.fillStyle = pal.tileEdge;
            ctx.fillRect(spx + 2, spy + 3 + squish, spr.w - 4, 2);
        }

        /* 冲刺水晶 */
        for (i = 0; i < level.crystals.length; i++) {
            var cr = level.crystals[i];
            var on = cr.cd <= 0;
            var bob = Math.sin(level.time * 2 + i) * 1.5;
            ctx.globalAlpha = on ? 1 : 0.25;
            ctx.fillStyle = pal.crystal;
            var ccx = cr.x - camX, ccy = cr.y - camY + bob;
            ctx.beginPath();
            ctx.moveTo(ccx, ccy - 6); ctx.lineTo(ccx + 5, ccy); ctx.lineTo(ccx, ccy + 6); ctx.lineTo(ccx - 5, ccy);
            ctx.closePath(); ctx.fill();
            if (on) {
                ctx.fillStyle = pal.crystalCore;
                ctx.fillRect(Math.round(ccx) - 1, Math.round(ccy) - 2, 2, 3);
            }
            ctx.globalAlpha = 1;
        }

        /* 草莓 */
        for (i = 0; i < level.berries.length; i++) {
            var be = level.berries[i];
            if (be.taken) continue;
            var bx = be.x - camX, by = be.y - camY + Math.sin(level.time * 2.4 + i * 2) * 1.5;
            /* 草莓：像素心形 + 暗边 + 高光 + 绿蒂（半像素对齐，2 倍分辨率下更清楚） */
            var bxq = Math.round(bx * 2) / 2, byq = Math.round(by * 2) / 2;
            ctx.fillStyle = pal.crystalCore;
            ctx.fillRect(bxq - 2.5, byq - 1.5, 5, 4);
            ctx.fillRect(bxq - 1.5, byq - 2.5, 3, 1);
            ctx.fillRect(bxq - 1.5, byq + 2.5, 3, 1);
            ctx.fillStyle = pal.berry;
            ctx.fillRect(bxq - 1.5, byq - 1.5, 3, 3);
            ctx.fillRect(bxq - 2, byq - 0.5, 4, 2);
            ctx.fillRect(bxq - 1, byq + 1.5, 2, 1);
            ctx.fillStyle = 'rgba(255,255,255,.75)';
            ctx.fillRect(bxq - 1.5, byq - 1, 0.5, 0.5);
            ctx.fillStyle = this.light ? '#2f8f4a' : '#4e9e5f';
            ctx.fillRect(bxq - 1.5, byq - 3, 3, 0.5);
            ctx.fillRect(bxq - 0.5, byq - 3.5, 1, 0.5);
        }

        /* 检查点灯柱 */
        for (i = 0; i < level.checkpoints.length; i++) {
            var cp = level.checkpoints[i];
            var cpx = cp.x - camX, cpy = cp.y - camY;
            ctx.globalAlpha = cp.on ? 0.9 : 0.35;
            ctx.fillStyle = cp.on ? pal.goal : pal.tileEdge;
            ctx.fillRect(cpx + 3, cpy + 2, 2, 22);
            ctx.fillRect(cpx + 2, cpy, 4, 3);
            ctx.globalAlpha = 1;
        }

        /* 终点旗 */
        var gx = level.goal.x - camX, gy = level.goal.y - camY;
        ctx.fillStyle = pal.goal;
        ctx.globalAlpha = 0.18 + 0.06 * Math.sin(level.time * 3);
        ctx.fillRect(gx - 6, gy, 20, level.goal.h + 8);
        ctx.globalAlpha = 1;
        ctx.fillStyle = pal.tileEdge;
        ctx.fillRect(gx, gy, 2, level.goal.h);
        ctx.fillStyle = pal.goal;
        ctx.beginPath();
        ctx.moveTo(gx + 2, gy + 2);
        ctx.lineTo(gx + 14, gy + 8);
        ctx.lineTo(gx + 2, gy + 15);
        ctx.closePath(); ctx.fill();

        /* 冲刺残影 */
        if (player.trail) {
            for (i = 0; i < player.trail.length; i++) {
                var tr = player.trail[i];
                if (tr.a <= 0) continue;
                ctx.globalAlpha = tr.a * 0.22;
                ctx.fillStyle = pal.body;
                ctx.fillRect(Math.round(tr.x - camX), Math.round(tr.y - camY), player.w, player.h);
            }
            ctx.globalAlpha = 1;
        }

        /* 粒子 */
        particles.draw(ctx, camX, camY);

        /* -------------- 玩家 -------------- */
        if (!player.dead) this.drawPlayer(ctx, player, camX, camY, level.time);
        /* 调试碰撞框：玩家 hitbox + 脚下 1px 地面检测线 */
        var dbg = (window.Celeste.settings && window.Celeste.settings.mods && window.Celeste.settings.mods.debugHit);
        if (dbg) {
            ctx.save();
            ctx.strokeStyle = '#ff2bd6';
            ctx.lineWidth = 1;
            ctx.strokeRect(Math.round(player.x - camX) + 0.5, Math.round(player.y - camY) + 0.5, player.w - 1, player.h - 1);
            ctx.strokeStyle = 'rgba(120,255,180,.85)';
            ctx.beginPath();
            ctx.moveTo(Math.round(player.x - camX) - 3, Math.round(player.y + player.h - camY) + 1.5);
            ctx.lineTo(Math.round(player.x - camX) + player.w + 3, Math.round(player.y + player.h - camY) + 1.5);
            ctx.stroke();
            ctx.restore();
        }
        if (!player.dead) {
            this.drawStamina(ctx, player, camX, camY);
            this.drawSpeedo(ctx, player, camX, camY);
        }
    };

    /* Madeline 像素图：16×22（= 8×11 逻辑像素的 2 倍细分）/ 蹲下 16×12。
       H 亮发 h 暗发 S 皮肤 E 眼睛 M 嘴 C 外套 c 外套暗 B 背包 b 背包暗 P 裤 p 裤暗 */
    var SPR_STAND = [
        '....HHHHHHHH....',
        '...HHHHHHHHHH...',
        '...HHHHHHHHHH...',
        '...HHHSSSSHHH...',
        '...HHSSSSSSHH...',
        '...HHSSSSSSHh...',
        '...HHSSESSESh...',
        '...HHSSSSSSHh...',
        '...HHSSMMSSHh...',
        '...HHSSSSSSHh...',
        '....HSSSSSH.....',
        '....CCCCCCC.....',
        '...CCCCCCCCC....',
        '..BCCCCCCCCC....',
        '..BBCCCCCCCc....',
        '..BBCCCCCCCc....',
        '...CCCCCCCc.....',
        '....PPPPPP......',
        '....PPPPPP......',
        '....PP..PP......',
        '....PP..PP......',
        '...PPP..PPP.....'
    ];
    var SPR_DUCK = [
        '....HHHHHHHH....',
        '...HHHHHHHHHH...',
        '...HHHSSSSHHH...',
        '...HHSSSSSSHH...',
        '...HHSSESSESH...',
        '...HHSSSSSSHH...',
        '..BCCCCCCCCCH...',
        '.BBCCCCCCCCCc...',
        '.BBCCCCCCCCCc...',
        '..PPPPPPPPPP....',
        '..PPPPPPPPPP....',
        '...PP....PP.....'
    ];

    Renderer.prototype.drawPlayer = function (ctx, pl, camX, camY, t) {
        var pal = this.pal;
        var px = pl.x - camX, py = pl.y - camY;
        var f = pl.facing > 0 ? 1 : -1;
        var H = 0.5;                                   /* 精灵一格 = 半个逻辑像素 */

        if (pl.state === 'dash') {
            ctx.globalAlpha = 0.18;
            ctx.fillStyle = pal.crystal;
            ctx.fillRect(px - 1, py - 1, pl.w + 2, pl.h + 2);
            ctx.globalAlpha = 1;
        }

        /* 头发：发根在头顶，后面每段 1px 连成像素马尾 */
        var hc = this.light ? '#c03a52' : '#e0455f';
        var hc2 = this.light ? '#8d2338' : '#a82c45';
        for (var i = pl.hair.length - 1; i > 0; i--) {
            var hx = pl.hair[i].x - camX, hy = pl.hair[i].y - camY;
            ctx.fillStyle = (i % 2) ? hc2 : hc;
            ctx.fillRect(Math.round(hx * 2) / 2, Math.round(hy * 2) / 2, 1, 1);
        }

        var rows = pl.h <= 7 ? SPR_DUCK : SPR_STAND;
        var colors = {
            H: hc, h: hc2, S: pal.skin, E: pal.eye, M: this.light ? '#93405c' : '#7d2b45',
            C: pal.coat, c: this.light ? '#2c5178' : '#3d6b9c',
            B: pal.pack, b: this.light ? '#6d4526' : '#6f4729',
            P: pal.pants, p: pal.pants
        };
        for (var r = 0; r < rows.length; r++) {
            var line = rows[r];
            for (var c = 0; c < line.length; c++) {
                var ch = line.charAt(c);
                if (ch === '.') continue;
                ctx.fillStyle = colors[ch] || pal.body;
                var ccx = f > 0 ? c : (line.length - 1 - c);
                ctx.fillRect(px + ccx * H, py + r * H, H, H);
            }
        }

        /* 浅色主题下补一圈外描边，避免白皮肤融进背景 */
        if (this.light) {
            ctx.globalAlpha = 0.45;
            ctx.strokeStyle = '#3c2a5c';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(px - 0.25, py - 0.25, pl.w + 0.5, pl.h + 0.5);
            ctx.globalAlpha = 1;
        }
    };

    /* 头顶速度计（MOD 开关）：白字黑边，横向 / 纵向各自可单独开关 */
    Renderer.prototype.drawSpeedo = function (ctx, pl, camX, camY) {
        var mods = window.Celeste.mods || {};
        var showX = !!mods.speedX, showY = !!mods.speedY;
        if (!showX && !showY) return;

        var vals = [];
        if (showX) vals.push([pl.Speed.x, 'X']);
        if (showY) vals.push([pl.Speed.y, 'Y']);

        var bx = Math.round((pl.x - camX) + pl.w / 2);
        var by = Math.round(pl.y - camY) - 4;

        ctx.save();
        ctx.font = 'bold 4.5px ui-monospace, "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.lineWidth = 1.3;
        ctx.strokeStyle = '#000';
        ctx.fillStyle = '#fff';
        for (var i = 0; i < vals.length; i++) {
            var v = Math.round(vals[i][0]);
            var txt = (v > 0 ? '+' : (v < 0 ? '-' : '')) + Math.abs(v);
            var ty = by - (vals.length - 1 - i) * 7;
            ctx.strokeText(txt, bx, ty);
            ctx.fillText(txt, bx, ty);
        }
        ctx.restore();
    };

    /* 头顶体力条：爬墙体力（ClimbMaxStamina 110），满格不显示，避免挡视线 */
    Renderer.prototype.drawStamina = function (ctx, pl, camX, camY) {
        var mods = window.Celeste.mods || {};
        if (mods.stamina === false) return;
        var max = C.ClimbMaxStamina;
        var v = Math.max(0, Math.min(1, pl.Stamina / max));
        if (v >= 0.999 && pl.state !== 'climb') return;

        var mods2 = window.Celeste.mods || {};
        var speedOn = !!(mods2.speedX || mods2.speedY);
        var w = 14, h = 1.5;
        var x0 = Math.round((pl.x - camX) + pl.w / 2 - w / 2);
        var y0 = Math.round(pl.y - camY) - (speedOn ? 13 : 8);

        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,.75)';
        ctx.fillRect(x0 - 0.5, y0 - 0.5, w + 1, h + 1);
        var col = v > 0.55 ? '#6ee7a8' : (v > 0.28 ? '#f2c94c' : '#ef5b6b');
        ctx.fillStyle = col;
        ctx.fillRect(x0, y0, Math.max(0, w * v), h);
        ctx.restore();
    };

    Renderer.prototype.flash = function (ctx, alpha) {
        ctx.setTransform(SUP, 0, 0, SUP, 0, 0);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, C.VW, C.VH);
        ctx.globalAlpha = 1;
    };

    Celeste.Renderer = Renderer;
})();
