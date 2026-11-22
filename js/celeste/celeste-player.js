/* celeste-player.js —— 玩家（Madeline）
   按 Celeste Source/Player/Player.cs 逐段重写：常量、变量、状态机分支顺序与算式一一对应。
   NormalUpdate / ClimbUpdate / DashUpdate / Jump / SuperJump / WallJump / SuperWallJump /
   ClimbJump / StartDash / OnCollideH / OnCollideV 的运算次序与原文件相同。
   未实现（本作没有对应物件）：Holding、Water、SwapBlock、DreamBlock、StarFly、LiftBoost。 */
(function () {
    'use strict';
    var Celeste = window.Celeste;
    var C = Celeste.C;
    var app = Celeste.approach;

    var StNormal = 0, StClimb = 1, StDash = 2, STAND_H = 11, DEFAULTS = { infDash: false, gravity: 1, runMult: 1, ice: false, springy: false };

    /* MOD / 异变模式参数；未开启时全部取原版常量，运动逻辑不变 */
    function MOD(k) {
        var m = window.Celeste.mods;
        if (!m || m[k] === undefined) return DEFAULTS[k];
        return m[k];
    }
    var STATE_NAMES = ['normal', 'climb', 'dash'];

    function Player(map, particles) {
        this.map = map;
        this.particles = particles;
        this.w = 8; this.h = 11;          /* 站立 hitbox 8×11，蹲下 8×6 */
        this.duckH = 6;
        this.respawnAt = { x: map.spawn.x, y: map.spawn.y };
        this.hair = [];
        for (var i = 0; i < 5; i++) this.hair.push({ x: this.x || 0, y: this.y || 0 });
        this.reset();

        /* 兼容旧字段（渲染 / 关卡 / UI 仍在用 vx vy facing state stamina dashes spawnAt） */
        var self = this;
        function alias(name, get, set) {
            Object.defineProperty(self, name, { get: get, set: set, configurable: true });
        }
        alias('vx', function () { return self.Speed.x; }, function (v) { self.Speed.x = v; });
        alias('vy', function () { return self.Speed.y; }, function (v) { self.Speed.y = v; });
        alias('facing', function () { return self.Facing; }, function (v) { self.Facing = v; });
        alias('state', function () { return STATE_NAMES[self.State]; }, function (v) { self.State = Math.max(0, STATE_NAMES.indexOf(v)); });
        alias('stamina', function () { return self.Stamina; }, function (v) { self.Stamina = v; });
        alias('dashes', function () { return self.Dashes; }, function (v) { self.Dashes = v; });
        alias('spawnAt', function () { return self.respawnAt; }, function (v) { self.respawnAt = v; });
        alias('spawnX', function () { return self.respawnAt.x; }, function (v) { self.respawnAt.x = v; });
        alias('spawnY', function () { return self.respawnAt.y; }, function (v) { self.respawnAt.y = v; });
    }
    Celeste.Player = Player;

    Player.prototype.reset = function () {
        this.x = this.respawnAt.x; this.y = this.respawnAt.y;
        this.Speed = { x: 0, y: 0 };
        this.Facing = 1;
        this.State = StNormal;
        this.Ducking = false;
        this.h = 11;
        this.onGround = true;
        this.wallSlideDir = 0;
        this.maxFall = C.MaxFall;
        this.Stamina = C.ClimbMaxStamina;
        this.Dashes = 1; this.maxDashes = 1;
        this.dashCooldownTimer = 0;
        this.dashRefillCooldownTimer = 0;
        this.dashTimer = 0;
        this.DashDir = { x: 0, y: 0 };
        this.dashAttackTimer = 0;
        this.beforeDashSpeed = { x: 0, y: 0 };
        this.varJumpTimer = 0; this.varJumpSpeed = 0;
        this.jumpGraceTimer = 0; this.jumpBufferTimer = 0; this.jumpBuffered = false;
        this.wallSlideTimer = 0;
        this.wallSpeedRetentionTimer = 0; this.wallSpeedRetained = 0;
        this.wallBoostTimer = 0; this.wallBoostDir = 0;
        this.forceMoveX = 0; this.forceMoveXTimer = 0;
        this.climbNoMoveTimer = 0; this.lastClimbMove = 0;
        this.autoJump = false; this.autoJumpTimer = 0;
        this.moveX = 0;
        this.dead = false; this.deadTimer = 0; this.deadReason = '';
        this.runTimer = 0;
        this.trail = [];
        this.squish = 1;
        this.landedThisFrame = false;
        this.events = [];
        this.input = null;
        for (var i = 0; i < this.hair.length; i++) {
            this.hair[i].x = this.x + 4; this.hair[i].y = this.y + 2;
        }
    };

    /* ---------------- 地形查询 ---------------- */
    Player.prototype.climbBoundsCheck = function (dir) {
        return this.x + dir * C.ClimbCheckDist >= 0 && this.x + this.w + dir * C.ClimbCheckDist < this.map.pw;
    };
    /* 朝 dir 方向 2px 处是否有实心（ClimbCheck） */
    Player.prototype.climbCheck = function (dir, yAdd) {
        if (!this.climbBoundsCheck(dir)) return false;
        var px = this.x + (dir > 0 ? this.w + C.ClimbCheckDist - 1 : -C.ClimbCheckDist);
        return this.map.overlaps(px, this.y + (yAdd || 0), 1, this.h - 1);
    };
    Player.prototype.wallJumpCheck = function (dir) {
        if (!this.climbBoundsCheck(dir)) return false;
        var px = this.x + (dir > 0 ? this.w + C.WallJumpCheckDist - 1 : -C.WallJumpCheckDist);
        return this.map.overlaps(px, this.y + 1, 1, this.h - 2);
    };
    Player.prototype.touchWall = function (dir) {
        var px = this.x + (dir > 0 ? this.w : -1);
        return this.map.overlaps(px, this.y + 1, 1, this.h - 2);
    };

    /* ---------------- 位移 + 碰撞回调（Actor.MoveH / MoveV） ---------------- */
    Player.prototype.moveH = function (amount) {
        if (!amount) return false;
        var sign = amount > 0 ? 1 : -1;
        var step = Math.abs(amount);
        while (step > 0) {
            var m = Math.min(1, step);
            this.x += sign * m; step -= m;
            if (this.map.overlaps(this.x, this.y, this.w, this.h)) {
                this.x -= sign * m;
                /* UpwardCornerCorrection：撞墙时若向上抬 ≤4px 可过，就抬过去 */
                if (this.Speed.y <= 0 && this.State !== StDash) {
                    for (var i = 1; i <= C.UpwardCornerCorrection; i++) {
                        if (!this.map.overlaps(this.x + sign, this.y - i, this.w, this.h)) {
                            this.y -= i; this.x += sign;
                            return true;
                        }
                    }
                }
                this.onCollideH();
                return true;
            }
        }
        return false;
    };

    Player.prototype.moveV = function (amount) {
        if (!amount) return false;
        var sign = amount > 0 ? 1 : -1;
        var step = Math.abs(amount);
        while (step > 0) {
            var m = Math.min(1, step);
            this.y += sign * m; step -= m;
            if (this.map.overlaps(this.x, this.y, this.w, this.h)) {
                this.y -= sign * m;
                this.onCollideV(sign);
                return true;
            }
        }
        return false;
    };

    Player.prototype.onCollideV = function (sign) {
        if (sign < 0) {
            /* 撞天花板：上升速度直接归零。之前只在 varJumpTimer 小时归零，
               剩下的情况会保留 -105 的上升速度，导致贴着天花板每帧互推 */
            if (this.Speed.y < 0) this.Speed.y = 0;
            this.Speed.y = Math.min(this.Speed.y, 0);
            this.varJumpTimer = 0;
            this.autoJump = false;
            this.wallSpeedRetentionTimer = 0;
        } else {
            this.Speed.y = 0;
            this.dashAttackTimer = 0;
            if (!this.onGround) this.events.push('land');
        }
    };

    Player.prototype.onCollideH = function () {
        /* Dash 撞墙：地面可蹲滑；空中做 4px 角修正 */
        if (this.State === StDash) {
            if (this.onGround && this.DashDir.x !== 0) {
                this.Ducking = true; this.setDuck();
                return;
            }
            if (this.Speed.y === 0 && this.Speed.x !== 0) {
                var sx = this.Speed.x > 0 ? 1 : -1;
                for (var i = 1; i <= C.DashCornerCorrection; i++) {
                    for (var j = 1; j >= -1; j -= 2) {
                        if (!this.map.overlaps(this.x + sx, this.y + i * j, this.w, this.h)) {
                            this.y += i * j; this.x += sx;
                            return;
                        }
                    }
                }
            }
        }
        /* 墙速保留（WallSpeedRetention）：贴墙 0.06s 内记住撞墙前速度，方便墙跳 */
        if (this.wallSpeedRetentionTimer <= 0) {
            this.wallSpeedRetained = this.Speed.x;
            this.wallSpeedRetentionTimer = C.WallSpeedRetentionTime;
        }
        this.Speed.x = 0;
        this.dashAttackTimer = 0;
    };

    /* 蹲下 / 站起时改 hitbox，脚底位置不动 */
    Player.prototype.setDuck = function () {
        if (this.Ducking) {
            if (this.h === this.duckH) return;
            this.y += this.h - this.duckH;
            this.h = this.duckH;
        } else {
            if (this.h === STAND_H) return;
            var grow = STAND_H - this.h;          /* 站起后头顶会多占的高度 */
            if (this.map.overlaps(this.x, this.y - grow, this.w, grow)) {
                this.Ducking = true;              /* 头顶有东西，钻不出来 */
                return;
            }
            this.y -= grow;
            this.h = STAND_H;
        }
    };

    /* ---------------- 每帧更新 ---------------- */
    Player.prototype.update = function (dt, input) {
        if (this.dead) { this.deadTimer -= dt; return; }
        this.input = input;
        dt = Math.min(dt, 1 / 30);
        this.events.length = 0;

        var moveX = input.x, moveY = input.y;
        this.moveX = moveX;
        if (this.forceMoveXTimer > 0) {
            this.forceMoveXTimer -= dt;
            moveX = this.forceMoveX;
            this.moveX = moveX;
        }

        /* 跳跃输入：jumpPressed = 真边沿（墙跳 / 冲刺 / 抓墙用），
           jumpWanted = 边沿 + 0.15s 缓冲（只在起跳判定用），落地前提前按也算数 */
        if (input.jumpPressed) { this.jumpBufferTimer = C.JumpBuffer; this.jumpBuffered = true; }
        else if (this.jumpBufferTimer > 0) { this.jumpBufferTimer -= dt; }
        if (this.jumpBufferTimer <= 0) this.jumpBuffered = false;
        var jumpPressed = !!input.jumpPressed;
        /* 原版 Celeste：跳跃只响应按下边沿与短暂输入缓冲，不支持按住跳跃自动连跳。
           按住 jump 仅影响可变跳高；落地后必须重新按下才能起跳。 */
        var jumpWanted = !!this.jumpBuffered;

        /* 计时器 */
        if (this.dashCooldownTimer > 0) this.dashCooldownTimer -= dt;
        if (this.dashRefillCooldownTimer > 0) this.dashRefillCooldownTimer -= dt;
        if (this.dashAttackTimer > 0) this.dashAttackTimer -= dt;
        if (this.jumpGraceTimer > 0) this.jumpGraceTimer -= dt;
        if (this.wallBoostTimer > 0) this.wallBoostTimer -= dt;
        if (this.wallSlideTimer > 0) this.wallSlideTimer -= dt;
        if (this.varJumpTimer > 0) this.varJumpTimer -= dt;
        if (this.autoJumpTimer > 0) this.autoJumpTimer -= dt;

        this.landedThisFrame = false;

        /* Facing 必须在状态机之前按输入更新（原版顺序）。
           放在状态机之后的话，dash 中按反方向再按跳，SuperJump() 里读到的是
           上一帧朝向 → 反向 super dash / 反向 wavedash 永远弹不出去。 */
        if (moveX !== 0 && this.State !== StClimb) this.Facing = moveX;

        /* 状态机：只算 Speed */
        if (this.State === StDash) this.DashUpdate(dt, moveX, moveY, jumpPressed, jumpWanted);
        else if (this.State === StClimb) this.ClimbUpdate(dt, moveX, moveY, jumpPressed);
        else this.NormalUpdate(dt, moveX, moveY, jumpPressed, jumpWanted);

        /* 位移 */
        this.moveH(this.Speed.x * dt);
        this.moveV(this.Speed.y * dt);

        /* 地形状态 */
        var wasGround = this.onGround;
        this.onGround = this.map.overlaps(this.x, this.y + this.h, this.w, 1);
        this.landedThisFrame = this.onGround && !wasGround;
        if (this.onGround) {
            this.jumpGraceTimer = C.JumpGraceTime;
            if (this.Dashes < this.maxDashes && this.dashRefillCooldownTimer <= 0) this.Dashes = this.maxDashes;
        }

        /* 墙面滑降朝向 */
        if (!this.onGround && this.touchWall(this.Facing) &&
            (moveX === this.Facing || (moveX === 0 && input.grab)) && moveY !== 1) {
            if (this.Speed.y >= 0 && this.wallSlideTimer > 0) this.wallSlideDir = this.Facing;
        } else if (this.onGround) {
            this.wallSlideDir = 0;
            this.wallSlideTimer = C.WallSlideTime;
        }

        /* 爬墙时贴住墙（原版 ClimbBegin 里那段 Position += Facing） */
        if (this.State === StClimb) this.snapToWall();

        /* Wall Speed Retention（原版逻辑：反向即取消；前方无墙则把速度还回去后立刻结束） */
        if (this.wallSpeedRetentionTimer > 0) {
            if (Math.sign(this.Speed.x) === -Math.sign(this.wallSpeedRetained)) {
                this.wallSpeedRetentionTimer = 0;
            } else if (!this.touchWall(Math.sign(this.wallSpeedRetained) || 1)) {
                this.Speed.x = this.wallSpeedRetained;
                this.wallSpeedRetentionTimer = 0;
            } else {
                this.wallSpeedRetentionTimer -= dt;
            }
        }

        /* 掉出世界底面即死。之前是 ph+40，掉进缺口要下坠近 1 秒才判死，
           观感像是卡住了，收紧到世界底面上方 8px */
        if (this.y > this.map.ph - 8) this.kill('fall');

        for (var t = 0; t < this.trail.length; t++) this.trail[t].a -= dt * 3.6;
        if (this.trail.length > 7) this.trail.splice(0, this.trail.length - 7);
        this.updateHair(dt);
        this.squish += (1 - this.squish) * Math.min(1, dt * 14);
    };

    Player.prototype.snapToWall = function () {
        if (!this.touchWall(this.Facing)) {
            this.x += this.Facing;
            if (this.map.overlaps(this.x, this.y, this.w, this.h)) this.x -= this.Facing;
        }
    };

    /* ---------------- NormalUpdate（对齐 Player.cs） ---------------- */
    Player.prototype.NormalUpdate = function (dt, moveX, moveY, jumpPressed, jumpWanted) {
        var inp = this.input;
        this.State = StNormal;

        /* 抓墙 → Climb */
        if (inp.grab && !this.Ducking) {
            if (this.Speed.y >= 0 && Math.sign(this.Speed.x) !== -this.Facing) {
                if (this.climbCheck(this.Facing)) {
                    this.Ducking = false;
                    this.State = StClimb; this.climbBegin();
                    return;
                }
                if (moveY < 1) {
                    for (var i = 1; i <= C.ClimbUpCheckDist; i++) {
                        if (!this.map.overlaps(this.x, this.y - i, this.w, this.h) && this.climbCheck(this.Facing, -i)) {
                            this.y -= i;
                            this.Ducking = false;
                            this.State = StClimb; this.climbBegin();
                            return;
                        }
                    }
                }
            }
        }

        /* 蹲冲（自定义键，默认 X） */
        if (inp.demoPressed && this.Dashes > 0 && this.dashCooldownTimer <= 0) {
            this.DemoDash();
            return;
        }

        /* 冲刺 */
        if (this.Dashes > 0 && this.dashCooldownTimer <= 0 && inp.dashPressed) {
            this.StartDash(moveX, moveY);
            return;
        }

        /* 蹲下 / 起蹲 */
        if (this.Ducking) {
            if (this.onGround && moveY !== 1) {
                this.Ducking = false; this.setDuck();   /* setDuck 会检查头顶空间，钻不出来就继续蹲 */
                if (!this.Ducking) this.squish = 1.2;
            }
        } else if (this.onGround && moveY === 1 && this.Speed.y >= 0) {
            this.Ducking = true; this.setDuck();
            this.squish = 0.7;
        }

        /* 水平 */
        if (this.Ducking && this.onGround) {
            this.Speed.x = app(this.Speed.x, 0, C.DuckFriction * (MOD('ice') ? 0.25 : 1) * dt);
        } else {
            var mult = this.onGround ? 1 : C.AirMult;
            var max = C.MaxRun * MOD('runMult');
            if (Math.abs(this.Speed.x) > max && Math.sign(this.Speed.x) === moveX) {
                this.Speed.x = app(this.Speed.x, max * moveX, C.RunReduce * mult * dt);
            } else {
                this.Speed.x = app(this.Speed.x, max * moveX, C.RunAccel * (MOD('ice') ? 0.3 : 1) * mult * dt);
            }
        }

        /* 垂直 */
        {
            /* 下落上限（Fast Fall） */
            if (moveY === 1 && this.Speed.y >= this.maxFall) {
                this.maxFall = app(this.maxFall, C.FastMaxFall, C.FastMaxAccel * dt);
            } else {
                this.maxFall = app(this.maxFall, C.MaxFall, C.FastMaxAccel * dt);
            }

            if (!this.onGround) {
                var maxFallSpeed = this.maxFall;

                /* 贴墙滑降：上限被压到 20 */
                if ((moveX === this.Facing || (moveX === 0 && inp.grab)) && moveY !== 1) {
                    if (this.Speed.y >= 0 && this.wallSlideTimer > 0 && this.climbBoundsCheck(this.Facing) &&
                        this.touchWall(this.Facing)) {
                        this.Ducking = false; this.setDuck();
                        this.wallSlideDir = this.Facing;
                    }
                    if (this.wallSlideDir !== 0) {
                        var t = this.wallSlideTimer / C.WallSlideTime;
                        maxFallSpeed = C.MaxFall + (C.WallSlideStartMax - C.MaxFall) * t;
                    }
                }

                var gravMult = (Math.abs(this.Speed.y) < C.HalfGravThreshold && (inp.jump || this.autoJump)) ? 0.5 : 1;
                this.Speed.y = app(this.Speed.y, maxFallSpeed, C.Gravity * MOD('gravity') * gravMult * dt);
            }

            /* 变量跳跃：按住跳就把上升速度钳回 varJumpSpeed（原版正是这句让跳高恒为 21px） */
            if (this.varJumpTimer > 0) {
                if (this.autoJump || inp.jump) this.Speed.y = Math.min(this.Speed.y, this.varJumpSpeed);
                else this.varJumpTimer = 0;
            }

            /* 起跳（缓冲窗口内的按下也算，落地瞬间不用再按一次） */
            if (jumpWanted) {
                if (this.jumpGraceTimer > 0) {
                    this.Jump();
                    this.jumpBufferTimer = 0; this.jumpBuffered = false;
                } else if (this.wallJumpCheck(1)) {
                    if (this.Facing === 1 && inp.grab && this.Stamina > 0) this.ClimbJump(-1);
                    else if (this.dashAttackTimer > 0 && this.DashDir.x === 0 && this.DashDir.y === -1) this.SuperWallJump(-1);
                    else this.WallJump(-1);
                    this.jumpBufferTimer = 0; this.jumpBuffered = false;
                } else if (this.wallJumpCheck(-1)) {
                    if (this.Facing === -1 && inp.grab && this.Stamina > 0) this.ClimbJump(1);
                    else if (this.dashAttackTimer > 0 && this.DashDir.x === 0 && this.DashDir.y === -1) this.SuperWallJump(1);
                    else this.WallJump(1);
                    this.jumpBufferTimer = 0; this.jumpBuffered = false;
                }
            }
        }

        /* 跑动扬尘 */
        if (this.onGround && Math.abs(this.Speed.x) > 60) {
            this.runTimer += dt;
            if (this.runTimer > 0.16) {
                this.runTimer = 0;
                this.particles.spawn(this.x + 4, this.y + this.h - 1, -this.Speed.x * 0.15, -10, 0.28, C.PAL.dust, 1);
            }
        }
    };

    /* ---------------- Jump 系列 ---------------- */
    Player.prototype.Jump = function () {
        this.jumpGraceTimer = 0;
        this.varJumpTimer = C.VarJumpTime;
        this.autoJump = false;
        this.dashAttackTimer = 0;
        this.wallSlideTimer = C.WallSlideTime;
        this.wallBoostTimer = 0;
        this.Speed.x += C.JumpHBoost * this.moveX;
        this.Speed.y = C.JumpSpeed * (MOD('springy') ? 1.35 : 1);
        this.varJumpSpeed = this.Speed.y;
        this.squish = 1.4;
        this.particles.burst(this.x + 4, this.y + this.h, 5, 20, C.PAL.dust);
        this.events.push('jump');
    };

    Player.prototype.SuperJump = function () {
        this.jumpGraceTimer = 0;
        this.varJumpTimer = C.VarJumpTime;
        this.autoJump = false;
        this.dashAttackTimer = 0;
        this.wallSlideTimer = C.WallSlideTime;
        this.wallBoostTimer = 0;
        this.Speed.x = C.SuperJumpH * this.Facing;
        this.Speed.y = C.SuperJumpSpeed;
        if (this.Ducking) {
            this.Ducking = false; this.setDuck();
            this.Speed.x *= C.DuckSuperJumpXMult;
            this.Speed.y *= C.DuckSuperJumpYMult;
        }
        this.varJumpSpeed = this.Speed.y;
        this.squish = 1.4;
        this.particles.burst(this.x + 4, this.y + this.h, 9, 30, C.PAL.crystal);
        this.events.push('super');
    };

    Player.prototype.WallJump = function (dir) {
        this.Ducking = false; this.setDuck();
        this.jumpGraceTimer = 0;
        this.varJumpTimer = C.VarJumpTime;
        this.autoJump = false;
        this.dashAttackTimer = 0;
        this.wallSlideTimer = C.WallSlideTime;
        this.wallBoostTimer = 0;
        if (this.moveX !== 0) {
            this.forceMoveX = dir;
            this.forceMoveXTimer = C.WallJumpForceTime;
        }
        this.Speed.x = C.WallJumpHSpeed * dir;
        this.Speed.y = C.JumpSpeed;
        this.varJumpSpeed = this.Speed.y;
        this.squish = 1.35;
        this.particles.burst(this.x + (dir > 0 ? 0 : 8), this.y + this.h / 2, 6, 26, C.PAL.dust);
        this.events.push('walljump');
    };

    Player.prototype.SuperWallJump = function (dir) {
        this.Ducking = false; this.setDuck();
        this.jumpGraceTimer = 0;
        this.varJumpTimer = C.SuperWallJumpVarTime;
        this.autoJump = false;
        this.dashAttackTimer = 0;
        this.wallSlideTimer = C.WallSlideTime;
        this.wallBoostTimer = 0;
        this.Speed.x = C.SuperWallJumpH * dir;
        this.Speed.y = C.SuperWallJumpSpeed;
        this.varJumpSpeed = this.Speed.y;
        this.squish = 1.35;
        this.particles.burst(this.x + (dir > 0 ? 0 : 8), this.y + this.h / 2, 9, 30, C.PAL.crystal);
        this.events.push('superwall');
    };

    Player.prototype.ClimbJump = function (dir) {
        if (!this.onGround) this.Stamina -= C.ClimbJumpCost;
        this.Jump();
        if (this.moveX === 0) {
            this.wallBoostDir = -this.Facing;
            this.wallBoostTimer = C.ClimbJumpBoostTime;
        }
        this.events.push('climbjump');
    };

    /* DemoDash：原版里的蹲冲（duck dash）。蹲下 hitbox 只有 6 高，
       贴地朝面向方向冲 0.15s / 240，用来钻一格高的缝。 */
    Player.prototype.DemoDash = function () {
        if (this.Dashes <= 0 || this.dashCooldownTimer > 0) return false;
        /* 只有贴地才蹲：空中改 hitbox 会把身体往下挪 5px，容易插进地形 */
        if (this.onGround && !this.Ducking) { this.Ducking = true; this.setDuck(); }
        this.StartDash(this.Facing, 0, true);
        this.events.push('demodash');
        return true;
    };

    /* ---------------- StartDash（DashBegin + DashCoroutine） ---------------- */
    Player.prototype.StartDash = function (moveX, moveY, demo) {
        var dirX = moveX, dirY = moveY;
        if (!dirX && !dirY) dirX = this.Facing;

        this.dashStartedOnGround = this.onGround;
        this.dashCooldownTimer = C.DashCooldown;
        this.dashRefillCooldownTimer = C.DashRefillCooldown;
        this.wallSlideTimer = C.WallSlideTime;
        this.dashAttackTimer = C.DashAttackTime;
        this.beforeDashSpeed = { x: this.Speed.x, y: this.Speed.y };
        if (!MOD('infDash')) this.Dashes--;
        this.State = StDash;
        this.dashTimer = C.DashTime;
        this.trail = [];

        var nx = dirX * C.DashSpeed, ny = dirY * C.DashSpeed;
        if (Math.sign(this.beforeDashSpeed.x) === Math.sign(nx) && Math.abs(this.beforeDashSpeed.x) > Math.abs(nx)) {
            nx = this.beforeDashSpeed.x;
        }
        this.Speed.x = nx; this.Speed.y = ny;
        this.DashDir = { x: dirX, y: dirY };
        if (dirX !== 0) this.Facing = Math.sign(dirX);

        /* Dash Slide：地面 + 斜下 → 蹲着滑 */
        if (this.onGround && this.DashDir.x !== 0 && this.DashDir.y > 0 && this.Speed.y > 0) {
            this.DashDir.x = Math.sign(this.DashDir.x);
            this.DashDir.y = 0;
            this.Speed.y = 0;
            this.Speed.x *= C.DodgeSlideSpeedMult;
            this.Ducking = true; this.setDuck();
        }
        if (!demo && !this.onGround && this.Ducking) { this.Ducking = false; this.setDuck(); }

        this.squish = 0.65;
        this.particles.burst(this.x + 4, this.y + this.h / 2, 14, 55, C.PAL.crystal);
        this.events.push('dash');
    };

    Player.prototype.DashUpdate = function (dt, moveX, moveY, jumpPressed, jumpWanted) {
        /* 冲刺中按跳（原版顺序）：纯上冲 → 超级墙跳；其余方向只要还贴着地（grace 内）→ 超级跳。
           斜下冲（wavedash）因此也能在贴地瞬间起跳，而不是等到 dash 完全结束。 */
        if (this.DashDir.x === 0 && this.DashDir.y === -1) {
            if (jumpWanted) {
                if (this.wallJumpCheck(1)) {
                    this.SuperWallJump(-1); this.jumpBufferTimer = 0; this.jumpBuffered = false;
                    this.State = StNormal; return;
                }
                if (this.wallJumpCheck(-1)) {
                    this.SuperWallJump(1); this.jumpBufferTimer = 0; this.jumpBuffered = false;
                    this.State = StNormal; return;
                }
            }
        } else if (jumpWanted) {
            if (this.jumpGraceTimer > 0) {
                this.SuperJump(); this.jumpBufferTimer = 0; this.jumpBuffered = false;
                this.State = StNormal; return;
            }
            if (this.wallJumpCheck(1)) { this.WallJump(-1); this.jumpBufferTimer = 0; this.jumpBuffered = false; this.State = StNormal; return; }
            if (this.wallJumpCheck(-1)) { this.WallJump(1); this.jumpBufferTimer = 0; this.jumpBuffered = false; this.State = StNormal; return; }
        }

        /* 冲刺期间速度锁定 */
        this.Speed.x = this.DashDir.x * C.DashSpeed;
        this.Speed.y = this.DashDir.y * C.DashSpeed;
        this.trail.push({ x: this.x, y: this.y, a: 1 });

        this.dashTimer -= dt;
        if (this.dashTimer <= 0) {
            this.trail.push({ x: this.x, y: this.y, a: 1 });
            this.autoJump = true; this.autoJumpTimer = 0;
            if (this.DashDir.y <= 0) {
                this.Speed.x = this.DashDir.x * C.EndDashSpeed;
                this.Speed.y = this.DashDir.y * C.EndDashSpeed;
            }
            if (this.Speed.y < 0) this.Speed.y *= C.EndDashUpMult;
            this.State = StNormal;
            this.events.push('dashend');
        }
    };

    /* ---------------- ClimbUpdate ---------------- */
    Player.prototype.climbBegin = function () {
        this.autoJump = false;
        this.Speed.x = 0;
        this.Speed.y *= C.ClimbGrabYMult;
        this.wallSlideTimer = C.WallSlideTime;
        this.climbNoMoveTimer = C.ClimbNoMoveTime;
        this.wallBoostTimer = 0;
        this.lastClimbMove = 0;
        this.events.push('grab');
    };

    Player.prototype.ClimbUpdate = function (dt, moveX, moveY, jumpPressed) {
        this.climbNoMoveTimer -= dt;
        var inp = this.input;

        if (this.onGround) this.Stamina = C.ClimbMaxStamina;      /* 地面回体力 */

        /* 墙跳 / 攀爬跳 */
        if (jumpPressed) {
            if (moveX === -this.Facing) this.WallJump(-this.Facing);
            else this.ClimbJump(-this.Facing);
            this.State = StNormal;
            return;
        }

        /* 冲刺 */
        if (inp.dashPressed && this.Dashes > 0 && this.dashCooldownTimer <= 0) {
            this.StartDash(moveX, moveY);
            return;
        }

        /* 松手 / 反向推：都脱墙 */
        if (!inp.grab) { this.State = StNormal; this.events.push('letgo'); return; }
        if (moveX === -this.Facing) { this.State = StNormal; this.events.push('letgo'); return; }

        /* 墙没了（爬过边缘） */
        if (!this.touchWall(this.Facing)) {
            this.State = StNormal;
            if (this.Speed.y < 0) {
                this.Speed.y = C.ClimbHopY;
                this.Speed.x = this.Facing * C.ClimbHopX;
                this.forceMoveX = this.Facing;
                this.forceMoveXTimer = C.ClimbHopForceTime;
                this.events.push('climbhop');
            }
            return;
        }

        /* 攀爬速度 */
        var target = 0, trySlip = false;
        if (this.climbNoMoveTimer <= 0) {
            if (moveY === -1) {
                target = C.ClimbUpSpeed;
                if (this.map.overlaps(this.x, this.y - 1, this.w, this.h)) {
                    if (this.Speed.y < 0) this.Speed.y = 0;
                    target = 0; trySlip = true;
                }
            } else if (moveY === 1) {
                target = C.ClimbDownSpeed;
                if (this.onGround) { if (this.Speed.y > 0) this.Speed.y = 0; target = 0; }
                else this.particles.spawn(this.x + (this.Facing > 0 ? 8 : 0), this.y + 4, -this.Facing * 6, 6, 0.25, C.PAL.dust, 1);
            } else {
                trySlip = true;
            }
        } else {
            trySlip = true;
        }
        this.lastClimbMove = Math.sign(target);

        /* 手在边缘之上又没有下按 → 打滑 */
        if (trySlip && !this.map.overlaps(this.x + (this.Facing > 0 ? this.w - 2 : 0), this.y - 2, 2, 4)) {
            target = C.ClimbSlipSpeed;
        }

        this.Speed.y = app(this.Speed.y, target, C.ClimbAccel * dt);

        /* 向下限位 */
        if (moveY !== 1 && this.Speed.y > 0 &&
            !this.map.overlaps(this.x + (this.Facing > 0 ? this.w - 1 : 0), this.y + this.h, 1, 1)) {
            this.Speed.y = 0;
        }

        /* 体力 */
        if (this.climbNoMoveTimer <= 0) {
            if (this.lastClimbMove === -1) this.Stamina -= C.ClimbUpCost * dt;
            else if (this.lastClimbMove === 0) this.Stamina -= C.ClimbStillCost * dt;
        }
        if (this.Stamina <= 0) { this.State = StNormal; this.events.push('tired'); }

        this.Speed.x = 0;
    };

    /* ---------------- 死亡 / 重生 ---------------- */
    Player.prototype.kill = function (reason) {
        if (this.dead) return;
        this.dead = true;
        this.deadTimer = 0.55;
        this.deadReason = reason || 'spike';
        this.particles.burst(this.x + 4, this.y + 4, 22, 70, C.PAL.hair);
        this.events.push('death');
    };

    Player.prototype.respawn = function () {
        this.dead = false;
        this.reset();
    };

    /* 头发：发根在头顶，后 4 段用固定段长跟随 */
    Player.prototype.updateHair = function (dt) {
        var headX = this.x + (this.Facing > 0 ? 5.5 : 2.5);
        var headY = this.y + 1.5;
        this.hair[0].x = headX; this.hair[0].y = headY;
        for (var i = 1; i < this.hair.length; i++) {
            var prev = this.hair[i - 1], cur = this.hair[i];
            cur.x += (-this.Facing * 18 + this.Speed.x * 0.06) * dt;
            cur.y += (12 + this.Speed.y * 0.05) * dt;
            var dx = prev.x - cur.x, dy = prev.y - cur.y;
            var d = Math.sqrt(dx * dx + dy * dy) || 1;
            var maxD = 2.2;
            if (d > maxD) {
                cur.x = prev.x - (dx / d) * maxD;
                cur.y = prev.y - (dy / d) * maxD;
            }
        }
    };

    Player.prototype.rect = function () { return { x: this.x, y: this.y, w: this.w, h: this.h }; };
})();
