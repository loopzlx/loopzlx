LOOPZLX · 行情模块（覆盖层 Overlay 版）接入说明
==============================================

一、文件清单（按原目录结构覆盖/新增）
  新增  html/market/market.html          行情片段（返回键 + <section id="market">，不是独立页面）
  新增  js/home/core/market-loader.js    覆盖层开关 + 片段懒加载
  覆盖  html/home/home.html              新增 #market-layer 覆盖层；导航 MARKET 移入「More」下拉
  覆盖  load.html                        在 main.js 之后挂载 market-loader.js
  覆盖  css/style.css                    行情样式 + 覆盖层 + More 下拉 + 主题化光标
  覆盖  js/home/core/market.js           行情渲染 / 轮询 / 银行金条估算 / pause·resume

  未改动：index.html、js/home/core/main.js、js/home/core/audio-player.js

二、打开与关闭（不跳转页面）
  打开：桌面点导航 More▾ → Market Feed；移动端点菜单里的 MARKET。
        首次打开才 fetch 片段并加载 market.js（懒加载，主页不会提前请求行情）。
  关闭：左上角 ← Back/返回、Esc、导航 Home。
  打开期间：body 锁滚动，导航只保留 Home / EN·ZH / 主题 / Contact；
        日志窗与音乐播放器属于全局 HUD（层级更高），照常显示且可用；
        关闭时自动 pause 轮询，再次打开 resume 并立即拉一次。
        打开期间导航自动套用 .scrolled 同款液态玻璃底（半透明 nav-bg + blur18px saturate180%）。

三、数据说明
  LIVE  api.gold-api.com 的 XAU / XAG，30 秒轮询。
  EST   银行金条/银条 = 伦敦现货 × 人民币汇率 ÷ 31.1035 × 溢价（建行 1.0198 / 工行 1.0261 / 中行 1.0204 / 银条 1.10）。
  其余 黄金 T+D、沪金、沪银、白银 T+D 为交易所日频快照（无免费实时源）。
  汇率 open.er-api.com 日频参考价，面板右上角显示 REF 日期；周末伦敦金银休市，LIVE 报价保持收盘价不动，属正常。

四、运行方式
  必须用 http 服务（Live Server / python3 -m http.server），否则片段 fetch 会被拦截。

LOOPZLX · osu! 四模式模块（覆盖层 Overlay 版）接入说明
====================================================

一、文件清单（新增为主，不产生新页面）
  新增  html/osu/osu.html            osu! 覆盖层片段（lazer 排版：菜单 / 选曲 / 游玩 / 结算 / 设置 / 下载）
  新增  css/osu.css                  全部样式，作用域 #osu-app，主题变量自动跟随站点
  新增  js/osu/osu-core.js           常量、状态 S、判定窗口、粒子、四模式 DEMO 谱
  新增  js/osu/osu-audio.js          音频上下文、Sfx、歌曲播放、DEMO 合成音
  新增  js/osu/osu-beatmap.js        .osu / .osz 解析，生成各模式音符
  新增  js/osu/osu-mode-standard.js  std：圆圈 / 滑条 / 转盘
  新增  js/osu/osu-mode-taiko.js     taiko：don / kat / 连打
  新增  js/osu/osu-mode-catch.js     catch：水果 / 滑条掉落 + 接盘
  新增  js/osu/osu-mode-mania.js     mania：1–9K 竖版轨道 + hold
  新增  js/osu/osu-game.js           主循环、渲染、HUD、暂停/结算
  新增  js/osu/osu-ui.js             视图切换、曲库、mods、键位、校准、在线下载
  新增  js/osu/osu-boot.js           键盘/鼠标/触屏输入绑定、boot
  新增  js/home/core/osu-loader.js   懒加载 + 打开/关闭控制器（window.OsuWarp）
  覆盖  html/home/home.html          More▾ 增 osu! Kernel 入口、移动菜单增 osu!、新增 #osu-layer
  覆盖  load.html                    market-loader 之后串 osu-loader.js
  覆盖  js/home/core/main.js         删 /root；/matrix 不再强制切主题；/warp 改为打开覆盖层；支持无斜杠 warp osu

二、打开与关闭（不跳转页面）
  指令：/warp osu、warp osu、/warp osu! 三种写法都行，或点 More▾ → osu! Kernel。
  关闭：左上 ← HOME（直接回主页）、Esc（非游玩视图）、游玩中 ← MENU 回选曲。
  打开期间：body 锁滚动，站点导航隐藏，音乐与日志淡出但音乐继续播放（不打断）。
  首次打开才加载 10 个 JS + JSZip CDN（懒加载），之后常驻内存，秒开。

三、四模式与操作
  osu!std   鼠标/触屏点击圆圈，按住拖滑条；键盘 Z/X 或空格敲击。
  osu!taiko  红键（Z / ←）don，蓝键（X / →）kat，长条连打。
  osu!catch  ← →（或鼠标左右）移动接盘。
  osu!mania  1–9K，默认 4K 为 D F J K，可在 SETTINGS 里重绑并存 localStorage。
  每个模式都内置 DEMO 曲（合成音）可立即试玩；也可 IMPORT .osz、DOWNLOAD 镜像检索。

四、说明与限制
  曲库只在内存里，刷新页面即清空（浏览器不允许静默写本地库）。
  在线下载走 api.nerinyan.moe / catboy.best / osu.direct 三个公共镜像，网络不通时只影响下载页。
  判定窗口基准 PERFECT40 / GREAT80 / GOOD130 / OK190 / MEH240 ms，随 OD 与 mod 缩放。
  银色/纸色浅主题下颜色取自站点 CSS 变量（--bg-base / --primary / --text-main），会自动换成深字浅底。

五、修订记录（v1.1，按 osu! 行为与性能回修）
  1. osu!std 的 approach circle 改为从 3 倍半径向内收到圆边缘（之前是反向外扩）；
     滑条松手即结束并立即判尾，不再"松手还在跟随"；滑条 tick 密度从 0.12s 放宽到 0.2s。
  2. 内置曲全部降到 Easy / Muzukashii / Salad 难度：BPM 150→120，长度 20→12 小节，
     std 每小节 3 个圆 + 每 3 小节一条滑条；taiko 每拍一下；catch 每拍一个水果；
     mania 保持 4K 但去掉最密的八分连打。合成音与谱面共用同一 BPM，仍然对拍。
  3. 性能：打开 osu 时对主页底层加 content-visibility:hidden（站点自身的 matrix 画布与
     滤镜不再重绘），实测本站环境 11fps → 61fps；颜色字符串加缓存；背景渐变+网格改为
     离屏 canvas 只画一次；HUD 只在数值变化时写 DOM；四个模式的绘制都按时间窗二分裁剪
     （2400 音符的压力谱仍 61fps）。
  4. 视觉贴近 osu：std 滑条改为细轨道 + 头尾圆 + 白色滑条球；catch 接盘改成碗形、水果
     六色轮换；taiko 轨道参考线与 don/kat 判定圈同高，底部键位提示不再压住 HUD。

六、修订记录（v1.2，按键与观感向原版靠）
  taiko 键位：原来只有一个 TAP 键，don/kat 不分，已拆成双色双键——
    DON：Z / F / ← / 空格；KAT：X / J / →
    打错颜色按 miss 处理（与原版一致），pads 显示 DON(Z) / KAT(X) 两个大键，
    画布内不再重复键位文字，判定圈改成红/蓝两色并带命中扩散。
  std：命中加涟漪，combo 数字跟随光标，判定文字贴在击打点上方。
  catch：miss 时接盘闪红；mania：note 与长条改圆角。
  判定弹字统一改为跟随击打点（原来固定画布中央）。

七、修订记录（v1.3，小屏按键修复 + GameHub）
  1. taiko 双键在小屏（≤720px，平板竖屏/手机）被拆成上下两行：媒体查询里的
     `.osu-pads{display:grid}` 覆盖了 `.pads-taiko{display:flex}`，变成单列。已补
     `.osu-pads.pads-taiko{grid-template-columns:1fr 1fr;grid-auto-flow:column}`，
     现在窄屏也是 DON | KAT 并排、各占一半宽；红/蓝圈内的两点杂色粒子同步减量。
  2. 性能：画布每帧不再 clearRect（背景贴图已全覆盖）；miss 粒子 7→5；
     `#osu-app` 的两条 color-mix radial 合并进唯一的 `#osu-app::before` 叠层（opacity .3），
     深/浅主题都只算一次渐变。四模式 Auto 连测仍稳定 61fps。

  3. 新增 GameHub 小游戏合集（同样是不跳转页面的覆盖层）：
     文件：html/gamehub/gamehub.html、css/gamehub.css、
           js/gamehub/{gamehub-core,game-2048,game-minesweeper,game-snake}.js、
           js/home/core/gamehub-loader.js（懒加载，接在 osu-loader 之后）。
     打开：More▾ → GameHub，或指令 /warp gamehub（warp game）。
     结构：顶栏 ← HOME（关掉覆盖层回主页）+ ← MENU（游戏内退回街机选择页；
           在街机页时这个键隐藏，避免和 HOME 重复）。
     2048：4×4，方向键/WASD/触屏滑动/屏幕方向键，Z 或 UNDO 按钮撤销（20 步历史），
           最高分存 localStorage（gh_2048_best）。
     扫雷：三级难度 9×9/10 雷、16×16/40 雷、16×30/99 雷；首次点击及其邻格保证安全；
           左键揭、右键或触屏长按插旗、0 自动洪水展开、计时从首击开始。
     贪吃蛇：20×20 网格 canvas，方向键/WASD/触屏滑动；每 50 分加速一档（130ms→65ms），
           最高分存 localStorage（gh_snake_best）；空格暂停。
     离开 GameHub 或切到别的游戏时，贪吃蛇的 requestAnimationFrame 与扫雷计时都会停，
     不占 CPU；实测覆盖层打开时 61fps。
