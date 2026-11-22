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

八、修订记录（v1.4，设置面板 / 手感）
  1. osu! 设置面板重做为 lazer 结构（新文件 js/osu/osu-settings.js，html/osu/osu.html 只留壳）：
     左侧六类导航（GENERAL / AUDIO / GRAPHICS / GAMEPLAY / INPUT / MAINTENANCE），
     右侧分页，滑杆 + 胶囊开关 + 键位胶囊，移动端自动改成顶部横排分类。
     选项（存 localStorage osu_settings）：
       AUDIO：主音量 / 音乐音量 / 音效音量（分别接到 master / musicBus / sfx 增益）+ 延迟校准入口
       GRAPHICS：背景暗度（0–100% 实时叠黑）、背景模糊（重建背景时 blur 9px）、滚动速度 80–160%
                （影响 std 的 approach 收缩速度与 mania 下落速度，100% = 原版手感）
       GAMEPLAY：打击误差条、连击数字跟随光标、判定文字 / 命中光效 / 显示 FPS
       INPUT：mania 4K、taiko DON/KAT、std 三组键位，可点按钮再按键重绑（写 osu_keybinds）
       MAINTENANCE：恢复默认设置 / 重置键位 / 退出 osu!
     游玩 HUD：右上角 FPS（可关），底部中央打击误差条（最近 10 次判定，绿/黄/红三段 + 平均偏差刻度）。
  2. 音频模块拆出 musicBus 与 sfxScale，音乐（含演示曲合成）与音效分别受音量滑杆控制。
  3. 贪吃蛇手感：改为固定步长 + 插值渲染（每帧在上一格与本格之间插值，不再格子跳），
     方向键按下即时转向（不再排队等下一步），初始 130ms 递减到 70ms；
     DPR 缩放画布、网格预渲染到离屏画布、蛇头去掉每帧 shadowBlur —— 画质更清晰，帧率回到 60。
  4. 2048 手感：改成 tile 池 + 绝对定位（width 25% + translate 百分比），
     滑动 110ms cubic-bezier 过渡、合并块弹跳（scale 1.16）、新块出现缩放；
     键盘连按 45ms 节流、触屏滑动 16px 即触发且可连续滑动；
     撤销重建棋盘，得分改为按合并值累加。

九、修订记录（v1.5，交互修复 / 双语 / 下载页）
  1. 覆盖层交互失效的总根因：css/style.css 里 #preloader 是 fixed + z-index:9999，
     要等 window load 才淡出、兜底动画 5 秒后才 pointer-events:none，
     导致 osu / gamehub 打开后所有 pointerdown 被它吃掉（滑不动、点不动）。
     修法：style.css 末尾追加 body.osu-open / .market-open / .gamehub-open 时 #preloader
     强制 display:none !important。修后 2048 / 贪吃蛇的全屏滑动才真正生效。
  2. GameHub 手势重写（js/gamehub/gamehub-core.js）：
     一次手势只走一步 —— pointerdown 记录起点、18px 锁主轴、44px 位移才发一次方向，
     pointerup 里"位移小 + 时长 <500ms"才算轻点；setPointerCapture 防丢事件。
     2048 与贪吃蛇都支持整块画布（含四周留白）滑动，箭头 pad 已删除。
  3. 贪吃蛇（game-snake.js）：删除转向队列，方向键 / 手势即时生效（只拦 180° 反向与撞身），
     死亡当前帧定格（不再留半格），满屏时判"通关"并显示分数，重置后自动恢复循环。
  4. 2048（game-2048.js）：pendingQ 队列（最多排 2 步），新块延后 110ms 与合并动画同帧出现。
  5. 主题跟随：站点主题类挂在 <html> 上，GH.colors 缓存键改为 html+body 双类名，
     并每 800ms 巡检 html.className，主页换主题时覆盖层配色（含贪吃蛇 canvas）即时跟着换；
     实测 theme-paper → 主色 #4a3728、theme-cyber → #8a2be2。
  6. 事件绑定改事件委托：GameHub 顶栏 / 卡片绑在 #gamehub-app 上，DOM 重建也不丢；
     脚本 URL 全部加 ?v=1.4 版本号，避免浏览器拿旧缓存脚本（这会让"改了没效果"）。
  7. osu 中英切换（新文件 js/osu/osu-i18n.js，存 osu_lang）：
     顶栏 #osu-lang 一键切换，菜单 / 四模式描述 / 选曲 / 暂停 / 结果 / 下载页 / 返回共 26 条文案，
     中文侧真正中文化（游玩 / 导入 .OSZ / 下载谱面 / 设置 / 开始 ▶ / 已暂停 …）；
     切换后先重绘菜单再套字典，避免被重绘覆盖。GameHub 同样有 gh_lang。
  8. 时钟兜底（osu-game.js + osu-audio.js）：AudioContext 被挂起时用墙钟推进 songTime，
     谱面不再"静止不动"（此前 mania 看起来"谱子不显示"就是这个 + 演示谱 lead 2s 的双重结果）。
  9. taiko 连续长条（osu-mode-taiko.js）：drumroll 重绘为一条圆角胶囊（右端封口、内部按进度填充、
     命中数字在条上方、打完 0.45s 淡出），按住一键连续结算（取最近一段 roll），
     实测按住 Z 十四次采样 hits 0→13 连续不断。
 10. mania 1–10K：设置里可选 1–10 键，KEYMAP / LABELS 全档位齐备，init 时按列数重排。
 11. 帧率：HUD 显示真实渲染帧率，帧率上限可调（不限 / 240 / 144 / 120 / 60 / 30），
     实测设 30 后 HUD 显示 30；上限只跳渲染、不阻塞输入。
 12. 下载页复刻 osu! 网页版：搜索框 + All / Latest / Ranked 三个 tab + 卡片（封面、模式、★、时长、BPM、
     RANKED 标签、DOWNLOAD 胶囊）；打开即自动拉一轮；镜像顺序 osu.direct 优先（nerinyan 530、catboy 连不上），
     请求带 6s 超时与逐个降级。

十、修订记录（v1.6，判定 / 计分 / 曲库 / 视觉）
  1. 血条与失败判定：miss 扣血改为按谱面 HP drain 计算（HP5 约 -5/次，HP10 约 -8/次），
     命中回血照旧；**血条见底当帧判定 FAILED**（No Fail 除外），不再"掉光了还能继续打"。
  2. 计分换成 osu! ScoreV2（官方规则）：
     总分 = 20% 连击分 + 80% 准度分，再乘模组倍率。
     连击分 = 200000 × 累计连击参数 / 满分连击参数；单条连击参数 = 判定值 × f(combo)，
     f：combo≤1 → 0.5，2–400 → log₄(combo)，>400 → log₄400。
     判定值按 300 / 300 / 100 / 50 / 25 体系，准确率同权重（300=1、100=1/3、50=1/6、25=1/12）。
     模组倍率：HR 1.10、DT 1.20、FL 1.12、HD 1.06、EZ/HT 0.5。
  3. pp：结果页显示 pp 与星级。官方 pp 需要 aim/speed strain，这里用星级+长度+准确率+连击+模组做近似
     （5★ 2 分钟全连约 240pp 量级），标 EST。实测演示谱全 Perfect → 1,000,000 分 / 100% / 242pp。
  4. 暂停恢复：点 RESUME 后先 3-2-1 倒计时（大字号 + 背景虚化），再恢复循环与音频，和 osu! 一致。
  5. 四张模式卡配图：img/osu/mode-std|taiko|catch|mania.jpg（纯色渐变 + 极简几何，各 ~35KB），
     卡片上叠暗化渐变保证字可读，切主题时仍跟随站点色。
  6. 曲库持久化：导入的谱面（含音频 blob、背景图）写进 IndexedDB（loopzlx-osu / library），
     刷新页面、重开站点都还在；启动自动恢复并在日志里打 LIBRARY restored。
  7. 一张谱面集多个难度：.osz 里所有 .osu 全部解析，按物件数排序成难度列表，
     选曲右侧列出「难度 + 星级」，点哪张玩哪张；卡片显示 3 DIFFS 之类的数量。
  8. 删除与清空：选曲卡片右上角 × （第一次点变 SURE? 二次确认）逐张删除；
     设置 MAINTENANCE 页新增「清除缓存歌曲」，点两次确认，并明写"会清除所有导入歌曲与音频缓存、不可恢复"。
  9. 下载页搜索补全：All / Latest / Ranked 三个 tab 真正生效（本地按 status 过滤）、
     limit 24 + 分页「加载更多」、纯数字直连谱面集 ID、镜像超时 7s 逐个降级、右上显示结果计数。
 10. 中英切换补全：顶栏改成和主页一致的 EN / ZH 两组按钮（当前语言高亮）；
     菜单、模式描述、选曲、难度、下载页、暂停、结果、设置分类与各行标题/描述、toast 全部双语；
     设置面板按中文原文查表替换英文，语言切换即时重绘。
 11. 站点防复制：contextmenu / copy / cut / dragstart / selectstart 全部拦截，body user-select:none；
     输入框、文本框保留原生行为（可选中、可粘贴）。

十一、修订记录（v1.7 —— 浅色自适应 / 语言全量 / 搜索网格 / 判定严格）
  1. 浅色主题（theme-paper / theme-sneaker）下的 osu 主菜单：
     模式卡内文字强制白色（压在配图上），卡片压暗层在浅色主题里加深到 10%→48%，
     卡片描边、阴影、日志区、空态文字全部改用主题变量，不再出现"灰字压暗图看不清"。
  2. 语言切换彻底对齐主页：顶栏语言控件改成和主页同一个 .lang-switch / .lang-btn 胶囊（EN / ZH）；
     菜单、选曲、下载、设置、暂停、结算、toast、校准提示、FPS 上限按钮、清缓存文案全部双语，
     英文态扫描可见文本 0 条中文残留。
  3. 左下角歌单卡（nowplaying）重写：封面 + 标题 + 作者/模式 + 难度/星级/时长/BPM 标签 + 右侧 LIB 数量与 SELECT 入口，
     整卡可点，点一下直接进选曲；无歌时显示 DEMO 卡片。
  4. 打开 osu 自动暂停主页背景音乐（window.pauseSiteAudio，同步更新播放按钮与播放条状态）。
  5. 搜索页 UI 复刻 osu 官网：封面网格卡片（16:9 封面 + ★ 徽标 + 标题/作者/mapper + 模式/时长/BPM/RANKED + DOWNLOAD）。
     修复「加载更多」真实 bug：镜像的分页参数应是 offset 而不是 p，且按钮事件重复触发导致第二页被判成重复而直接消失；
     现在 50 → 100 → 150 连续加载，去重、无更多提示、搜完移除按钮都正常。
  6. std 模式优化：去掉圆圈里的编号（原版没有），中心改为淡点；滑条加"已跟随进度"亮色叠加；
     命中后 0.2s 放大淡出收尾。
  7. 电脑端 FPS 显示从右上角移到右下角（竖向：FPS / ms + 迷你曲线），设置里文案同步改成"右下角"。
  8. mania 下落键去重影：去掉音符 shadowBlur 与判定线下方的拖尾块，改画 2px 高光边，判定线光晕 18 → 10。
  9. 判定窗口按 osu! 官方公式重写（std / taiko / mania 各自的 a/b/c 三点窗口，OD 缩放、EZ 0.5、HR ×1.4 封顶 10，
   DT/HT 不缩放，PERFECT 取 a×0.55），比之前更严；配合 miss 扣血，HP 归零仍直接判失败。
 10. 缓存：osu-loader 里脚本与样式版本号提到 ?v=1.8，避免浏览器继续吃旧的 JS / CSS。

十二、修订记录（v1.8 —— 四模式主题自适应 + 点歌选难度）
  1. 模式各自的配色：std 粉、taiko 橙、catch 青、mania 紫，游玩画面按当前模式取色（pal 按 mode + 主题双层缓存），
     不再是四个模式都吃站点主色。
  2. 浅色主题（paper / sneaker）下游玩界面整体自适应：底色走主题亮底 + 模式色淡晕，背景 dim 改为少量提白；
     HUD（分数/连击/准确率/HP/进度）改深墨色，判定字加深色描边，pad 与 QUIT/PAUSE 改浅底深字；
     画布加一圈描边 + 柔和外阴影，不再是浅色页面里一块突兀的黑。
  3. mania 细化：浅色下音符改成"模式色深→亮"渐变 + 1.4px 深边（原来白→紫在浅底上几乎看不见）；
     去掉画布内底部那组 D/F/J/K 字母（页面下方 pad 已经标了键，画布里再画一层会和 FPS 计数叠住）；
     FPS 计数器收窄（曲线 92×16），浅色主题下换成浅玻璃 + 深字。
  4. std 细化：描边在浅色下减淡减细，命中收尾动画保留。
  5. 点歌曲选难度：多难度谱面集在歌曲行下面直接展开难度条（`Easy ★8.0 / Normal ★8.5 / Hard ★8.7`），
     点一下就切难度并同步右侧详情与开局谱面；再次点歌曲行可收起。右侧详情依旧保留难度列表（双入口）。
  6. 在线下载 / 本地导入的 .osz 都走同一套解析：包内所有 .osu 全部导入成一个谱面集的多难度；
     谱面缺 `Version:` 字段时用文件名兜底（map_Easy.osu → Easy），不再全都叫 Normal。
  7. 缓存版本号提到 ?v=2.0。

十三、修订记录（v1.9 —— 星级重算 / 判定线对齐 / 三模式细化 / 校准可用）
  1. 星级不再用单一 sqrt(density) 公式（那会把 4 个模式的 demo 谱全算成 ★5.5）。改为分模式：
     mania 按 NPS + 键数，taiko / catch 按 NPS，std 另乘滑条占比；结果保留两位，OD 只占很小的权重。
     当前内置 demo 谱：std ★2.49 / taiko ★2.84 / catch ★2.84 / mania ★2.23。
  2. mania 判定位置：音符底边在时间到点时正好压在判定线上（`yHead - nh`），判定仍是 U.judge 的官方时间窗口，
     视觉与判定一致，不再出现"看得见打不到"。
  3. taiko 改成 osu!taiko 的单行轨道：don / kat 同一水平线，只有一个判定圈（颜色随最近一次命中在红/蓝之间切），
     原来上下两条轨道改成一条；浅色主题下音符用更实的填充 + 深色描边。
  4. catch：接盘上沿贴住判定带（原来盘子沉在判定线下方约 40px），水果加 1.6px 暗描边；
     连击数画在接盘上方。
  5. std：spinner 加旋转进度弧 + 外圈剩余时间收缩 + 中央 `SPIN n`。
  6. taiko 中央显示 `Nx` 连击（≥10 才出现）。
  7. 校准（设置 → 音频 → Start calibration）原本只定义了 calibTap 却没绑任何事件，点/按空格毫无反应。
     现在面板内点击、空格 / 回车 / Z / X 都算一击，实时显示平均偏移（`Nx` 次数），
     新增 APPLY OFFSET（把平均偏移写进 `osu_settings.hitOffset`，±120ms 钳制）与 CLEAR（清零）；
     `U.judge` 判定前按 hitOffset 补偿，中英文案同步。
  8. 缓存版本号提到 ?v=2.4。

十四、修订记录（v2.0 —— 对齐 osu! 原版 UI）
  1. taiko 游玩区改成一条横贯全宽的窄深带（高度 ≈ 2.9 倍音符半径），判定圈与音符半径整体缩小一档
     （h*0.075→h*0.055，上限 44→32），上下不再占满整个画布；don / kat 都在这条带子里走。
     音符改成 osu!taiko 皮肤的"实色圆 + 白圈"，don 中心小实心圆、kat 中心白圈，深带上对比清晰。
  2. std：hitcircle / slider head / tail 改成"白圈 + 一层暗底"（两个主题都像 osu 的默认皮肤）；
     滑条轨道加白色描边 + 内侧赛道双层，头尾都收成圆头；approach circle 改白圈。
  3. catch：判定带由原来的 6px 厚色块改成接盘上沿一条细亮线 + 上方渐隐高光；水果统一加 1.8px 描边
     （暗色白边 / 浅色深边），不再糊成一团。
  4. mania：暗色主题下音符补 1.4px 白色细边，和浅色主题的深边对称。
  5. resume 倒计时重做（学 osu!）：去掉全屏模糊，只压暗 34%；数字换成"放大 2.1 倍 → 收到正常 → 淡出"的
     1s 动画，下方加一行 RESUME 小字（中英同步）；不再出现数字闪一下就消失的突兀感。
  6. 缓存版本号提到 ?v=2.7。

十五、修订记录（v2.1 —— 覆盖层顶栏统一主题切换 + 多歌单滚动）
  1. main.js 暴露 `window.CyberTheme`（next / current / list），market / osu / gamehub 三个覆盖层的顶栏都加了
     与 home 同一个调色盘按钮，点一下走同一套主题循环（Cyber → Sweet Pink → Hacker → Sneaker → Sunset →
     Ocean → Paper），切完不关覆盖层、不跳页。
     - osu：#osu-theme-btn（顶栏 EN·ZH 后面的圆形图标按钮），切完在 osu 日志和 toast 里打出主题名
     - gamehub：#gh-theme（顶栏最左侧按钮），切完写 GH log
     - market：#mk-theme（.mk-layer-top 右侧 THEME 按钮），切完写主日志
  2. 歌单从 2 组扩到 5 组共 17 首：SONGS / CHILL_FLOW / SYNTHWAVE / NIGHT_DRIVE / LOFI_KERNEL，
     组标题右侧加曲目数徽标；示例音频统一用 soundhelix 的 1–16 号（可直接播）。
  3. 歌单面板固定高度 `min(58vh, 400px)`，列表区内部上下滚动（overscroll-behavior: contain、
     iOS 惯性滚动、细滚动条），一次只预览一屏，超出部分滑动查看。
  4. 组改成手风琴：点开一组其余自动收起，再点当前组收起；切换曲目时列表只滚动自身，不带动整页。
  5. load.html 的 style.css / audio-player / main / 三个 loader 都加了 ?v=3.0；osu 内部资源同步 ?v=3.0。

十六、修订记录（v2.2 —— 歌单支持二级文件夹）
  1. 歌单结构支持 group → folders → tracks：group 可以只放曲目（如 SONGS），也可以再分一层文件夹。
     当前 5 组共 17 首，其中 CHILL_FLOW / SYNTHWAVE / NIGHT_DRIVE / LOFI_KERNEL 各分两个文件夹
     （SLOW·AMBIENT / VECTOR·CASSETTE / ROUTE 9·TUNNEL / DUST·STATIC）。
  2. 文件夹渲染成二级条目：左侧竖线缩进、folder 图标（展开变 folder-open）、右侧曲目数徽标与箭头。
  3. 折叠规则：一级 group 手风琴（一次只开一组），二级 folder 在同组内手风琴（一次只开一个文件夹）；
     展开组时自动打开该组第一个文件夹，展开文件夹时图标的 open 状态同步。
  4. 播放索引按展平顺序不变（17 首连续），点任意文件夹里的曲目仍能正确切歌并高亮。
  5. load.html / osu-loader 版本号提到 ?v=3.3。

十七、修订记录（v2.3 —— 银条报价口径统一）
  1. 问题：银条卡主数字原来按「元/千克」显示（约 9,722），旁边金条按「元/克」（776.50），
     两个数字并排容易被误读成"银条比金条还贵十几倍"。其实 9,722 元/公斤 = 9.72 元/克，完全正常。
  2. 现在银条主数字改按「元/克」报价（约 9.37），与金条同口径；下面加一行副标「≈ 9,369 CNY / KG」
     保留公斤价习惯用法。金银比显示约 83，符合实际。
  3. 银条溢价系数从 1.10 收到 1.06（银行投资银条常见 5–8% 溢价），避免估值偏高。
  4. load.html 版本号提到 ?v=3.4。

十八、修订记录（v3.0 —— Minecraft 1.8.9 覆盖层挂载）
  1. 新增 #mc-layer / #mc-slot / html/minecraft/mc.html / css/mc.css / js/home/core/mc-loader.js：
     独立覆盖层，用 iframe 就地跑本地客户端（不跳页），顶栏 RELOAD / FULL / HOME，打开时收起站点导航与 HUD。
  2. 入口三处：MORE 菜单「Minecraft 1.8.9」、移动端菜单同名项、GameHub 首页新增 MINECRAFT 卡片
     （点卡片先关 GH 再拉 mc 层）；指令 `warp mc` / `warp minecraft` 也能拉起。
  3. 客户端走本地文件 mc/index.html。文件不存在时（HEAD 404）覆盖层显示引导卡：去哪下载、
     解压后怎么改名、放哪、如何重新检测；不会被当成加载失败。
  4. 关闭时把 iframe 置 about:blank，避免 MC 在后台继续吃 CPU；再次打开不重载，保留当前存档进度。
  5. mc/ 目录附 README.txt 说明客户端来源（EaglercraftX 1.8.8 WASM，Java 版 1.8.9 经 TeaVM 编译，约 40 MB）。

十八·补（v3.1 —— 客户端 / 模组版可切换）
  1. mc-loader.js 从「单一 mc/index.html」改成「候选客户端表」：逐个 HEAD 探测，
     存在的才进顶栏下拉框（只有 1 个可用时下拉自动隐藏）。
  2. 候选与固定放置路径：
       mc/index.html               原版 EaglercraftX 1.8.8（WASM）
       mc/mods/eaglerforge.html    EaglerForge 客户端模组加载器版
       mc/mods/resent.html         Resent Client（PvP / QoL 整合）
       mc/mods/modpack.html        模组整合包
       mc/mods/custom1.html / custom2.html  自备
  3. 选择写入 localStorage('mc_client')，下次打开自动回到上次那个客户端；
     切换只换 iframe.src，不重建覆盖层。
  4. 官方客户端不支持 Forge（反射 + 字节码改写，TeaVM 编译产物无法执行）；
     带模组的要放社区编译版（EaglerForge / Resent / modpack）。
  5. mc/README.txt 同步改写为「原版 + 模组版」两段放置说明。

十九、v4.0 —— 移除 Minecraft，新增「蔚蓝」覆盖层
  1. 按用户要求回退：删除 mc/ 目录、html/minecraft/、css/mc.css、js/home/core/mc-loader.js，
     以及首页 MORE 菜单 / 移动菜单 / GameHub 卡片 / `warp mc` 分支 / load.html 里的 mc 加载器。
  2. 新增 Celeste（蔚蓝）覆盖层，按 Celeste Player.cs 的公开物理参数与状态机结构用 JS 重写（非源码搬运）：
       js/celeste/celeste-core.js    常量 / 输入 / 瓦片碰撞 / 粒子
       js/celeste/celeste-player.js  Normal / Dash / Climb 三段状态机、变量跳跃、土狼时间、
                                     跳跃缓冲、八方向冲刺、抓墙体力、尾随头发
       js/celeste/celeste-level.js   关卡与实体（尖刺 / 弹簧 / 冲刺水晶 / 草莓 / 检查点 / 终点）
       js/celeste/celeste-render.js  320×180 像素渲染、相机跟随、视差背景、瓦片描边
       js/celeste/celeste-ui.js      HUD / 暂停 / 通关面板 / 触屏虚拟键 / WebAudio 音效
       js/celeste/celeste-boot.js    主循环、死亡与重生、主题联动
       css/celeste.css, html/celeste/celeste.html, js/home/core/celeste-loader.js
  3. 操作：← → 移动，SPACE 跳（按住跳更高），Z 冲刺（方向 = 输入方向，无输入默认前冲），
     SHIFT 抓墙（消耗体力，体力耗尽会滑落）。移动端自动出现左右方向键 + JUMP/DASH/GRAB。
  4. 关卡「FORGOTTEN PATH」：起点地面 → 台阶 → 连续上升台阶塔 → 弹簧 → 顶层终点，
     3 颗草莓、3 个检查点（碰到后死亡从这里重来）、2 个冲刺水晶（补满冲刺与体力）。
  5. 入口：MORE 菜单「蔚蓝」、移动端菜单、GameHub 卡片 CELESTE、指令 `warp celeste`。
  6. 顶栏含主题切换（与站点一致），浅色主题（paper / sneaker / sunset）自动切换 canvas 调色板与描边，
     HUD 收起导航与音频播放器、日志窗。

二十、v4.2 —— 蔚蓝手感按 Player.cs 原文重写
  1. 上一版（v4.0/v4.1）是「照参数近似调」，跳跃初速自己定成 -190、边跳边吃重力，
     导致跳得又高又飘。这一版按 Source/Player/Player.cs 的原文顺序重算：
       - 起跳只给 Speed.Y = JumpSpeed(-105)，同时设 varJumpTimer = 0.2、varJumpSpeed = -105；
       - 每帧先按 Gravity 逼近，再执行 if (varJumpTimer>0 && 按住跳) Speed.Y = Min(Speed.Y, varJumpSpeed)；
         所以上升速度被钳在 -105，跳高恒为 21px（约 2.6 格），松手才结束。
  2. 补齐原版机制：WallSlide（贴墙下落压到 20，最长 1.2s）、WallSpeedRetention(0.06s)、
     UpwardCornerCorrection(4)、Dash 角修正(4)、Dash Slide(×1.2 蹲滑)、
     SuperJump(260/蹲跳×1.25/×0.5)、SuperWallJump(-160/0.25s/170)、
     ClimbJump(27.5 体力 + wallBoost)、ClimbHop、蹲下 hitbox 8×6、FastFall(160→240)。
  3. 顺带修的两处 bug：
       - 死亡计数在「死亡当帧」与「重生帧」各加一次，已去掉重复；
       - 蹲下后松开方向键起不来（站起空间检测算错），已改为只检测头顶新增的 5px。
  4. 关卡重排：原台阶每级 3 格（24px）跳不上去，改为每级 2 格（16px），共 5 级塔 + 顶层终点；
     起点地面与第二段接成一片，去掉原来的 16px 竖井。
  5. 版本号升到 4.2（load.html），celeste 脚本串 ?v=1.2。

二十一、v4.3 —— 60fps / 玛德琳 / 自定义按键 / 触屏布局 / MOD
  1. 逻辑固定 60fps：主循环改成累加器 + 1/60 固定步长（每帧最多补 4 步，卡帧不追帧），
     渲染仍跟 rAF。物理行为与原版 60fps 一致，不再随显示器刷新率漂移。
  2. 人物换成像素玛德琳：8×11 像素网格手绘（红发 / 白脸 / 蓝外套 / 深色裤子 / 棕色背包），
     蹲下切 8×6 版式；马尾改成贴头的 2px 方块链。
  3. 电脑端不再显示方向键：虚拟键默认只在 (hover:none)+(pointer:coarse) 出现，
     桌面是 display:none；需要时在设置里选「总是显示」。
  4. 自定义按键（设置 → 按键）：左/右/上/下/跳跃/冲刺/抓墙/蹲冲 八个动作，主副键各一，
     点「绑定」后按任意键即改，重复的键会从其它动作里自动摘掉，存 localStorage。
  5. 蹲冲 DemoDash（默认 X）：蹲下并朝面向方向冲刺（hitbox 8×6，240 / 0.15s），
     用来贴地钻一格缝；冲刺中按跳仍是超级跳。
  6. 触屏布局自定义（设置 → 触屏布局）：8 个键位按画面比例存（0–1），
     「编辑布局」进入后拖方块改位置、拖右下角把手改尺寸，可增删键位；
     「导出 .js」生成 window.Celeste.setTouchLayout({...}) 文件，「导入布局」可读 .js / .json。
  7. MOD（设置 → MOD，默认全关 = 原版手感）：
       速度计        头顶显示 X / Y 两行速度值 + 双向条（横向、纵向都画）
       无限冲刺      冲刺不扣 dashes
       尖刺免疫      撞尖刺不死
       冰面          加速与摩擦降到 0.3 / 0.25
       弹簧腿        起跳初速 ×1.35
       重力倍率 0–2 / 跑速倍率 0.5–2（滑块）
  8. 顺手修的：关卡计时被 boot 与 Level.update 各加一次，导致 2 倍速；塔顶尖刺改成空数组
     （起跳只有 21–28px，尖刺会把台阶变成随机死亡点）。
  9. 版本号：load.html 4.3，celeste 脚本串 ?v=1.3，新增 js/celeste/celeste-settings.js。

二十二、v4.4 —— 触控改成摇杆
  1. 触屏默认布局改成「左下摇杆 + 右手 4 个动作键」，不再有方向键方块：
       摇杆直径按短边百分比（vmin）存，任何屏幕比例下都是正圆，不会变椭圆。
  2. 摇杆输出按八方向量化（死区默认 0.26）：推右 = x 1，推下 = y 1（蹲），
       斜推 = x/y 同时给值，与键盘完全同一套输入口径，不改任何运动逻辑。
       死区可在设置 → 触屏布局里用滑块调（0.10–0.55）。
  3. 两种摇杆模式同时支持：
       固定底座 —— 按在摇杆上，底座不动；
       浮动底座 —— 按在左下区域（含画布外的黑边）任意位置，底座直接挪到指尖，松手弹回原位，
       适合手机拇指够不到角落的情况。
  4. 多点触控：按键与摇杆都按 pointerId 独立记录，一根手指推摇杆、另一根按 JUMP/DASH/DEMO
       互不干扰（旧实现一根手指抬起会误清另一根的按键状态）。
  5. 按键按下有 8ms 轻震动（设备支持才触发）；触摸坐标与 pointer 捕获都做了，
       手指滑出按钮不会掉键，划出手势也不会被页面滚动取消（补了 touch-action:none）。
  6. 编辑布局时摇杆也能拖、也能改大小（把手按短边像素换算）；跳过按钮就不会误触摇杆。
  7. 导出 .js 现在带 stick 字段：window.Celeste.setTouchLayout({stick:{x,y,w,dead,on}, buttons:[...]})，
       只给 stick 不给 buttons 也算合法；导入同样支持缺字段自动补默认。
  8. 版本号：load.html 4.4。

二十三、v4.5 —— 修按键失灵 / 体力条 / 画面细化 / 速度计重做
  1. 按键失灵（真 bug，已修）：触屏轻点常在 16ms 内就抬起，抬指会重建 _touch，
     把刚按下还没被主循环消费的 jumpPressed 直接覆盖成 false，于是点击丢帧。
     现在 refreshTouch 会保留上一帧未消费的 jump/dash/demo 按下信号。
     实测：20 次极快轻点 20 次起跳；按下只 8ms 的单次点击也 100% 生效。
  2. 体力条：新增头顶体力条（ClimbMaxStamina = 110），满格且不在爬墙时自动隐藏；
     >55% 绿、>28% 黄、更低转红。注意顶栏那组小圆点是「剩余冲刺次数」，不是体力。
  3. 画面细化：画布改 2 倍超采样（内部 640×360，逻辑仍是 320×180，物理常量一个没动），
     玛德琳从 8×11 重画成 16×22 的细分像素图（红发分层、眼睛、嘴、外套明暗、背包带），
     蹲姿 16×12；草莓改成像素心形 + 深色描边 + 高光 + 绿蒂；地面瓦片加稀疏 2px 噪点
     （约 1/4 tile 才落一个点，避免变成棋盘格）。
  4. 速度计重做：白字 + 黑描边（不铺底面板），横向 / 纵向各自独立开关，
     0 值不显示正负号；体力条会自动避让到速度计上方。
  5. MOD 面板同步：速度计拆成「横向速度 / 纵向速度」两项，新增「体力条」项；
     旧存档里的 speed 开关会自动迁移成横纵都开。
  6. 版本号：load.html 4.5。

二十四、v4.6 —— 修「冲刺后跳不起来」与「落地不能及时连跳」
  1. 冲刺中按跳（wavedash / superdash）：
     原来 DashUpdate 只在「水平冲刺」时给 SuperJump，「纯竖直上冲」时给 SuperWallJump，
     其余方向（含斜下冲 = wavedash）按跳只走普通墙跳分支，贴地时什么都不发生，于是感觉「跳不起来」。
     现在按原版判定顺序重排：纯上冲 → 超级墙跳；其余任意方向只要 jumpGraceTimer > 0（还贴着地）
     → 立刻 SuperJump 并切回 Normal。斜下冲落地瞬间按跳因此能弹起来，不再等 dash 完全结束。
     实测：地面斜下冲后按跳 → 触发 super 事件，水平速度 295（SuperJumpH 260 + 助跑），
     蹲姿时走 DuckSuperJump（x×1.25 / y×0.5）。
  2. 落地连跳：
     跳跃输入拆成两路 —— jumpPressed 是真正的按下边沿（墙跳 / 冲刺 / 抓墙用，避免缓冲期反复触发）；
     jumpWanted = 边沿 + 0.15s 缓冲（只用于起跳判定）。落地前 0.15s 内按跳会被记住，
     落地那一帧立刻起跳，不用掐帧。
     JumpBuffer 从 0.08 提到 0.15（0.08 只有 5 帧，手机端很难卡准）。
     起跳成功后缓冲立即清零，不会出现一次按下连跳两下。
  3. 按住不放仍然只跳一次（原版行为：要连跳必须松手再按），没有改成自动弹跳。
  4. 回归：桌面连点 8 次 8 次起跳；落地前预按 4 轮 4 次接上；
     手机端 8ms 轻点 6/6 起跳、摇杆右推 vx=90；关卡 0 死 9.45s 通关，无报错。
  5. 版本号：load.html 4.6，celeste-loader VER 1.4。

二十五、v4.7 —— 全量排 bug（结构 / 输入 / 状态机 / 关卡 / UI）
  1. 结构（严重）：celeste.html 里 <header class="cl-top"> 用 </div> 收尾，标签不闭合，
     浏览器把 .cl-stage 整个塞进了 header；再加上 .cl-shell 压根没有 CSS，
     外壳高度由 canvas 内容反推，于是 resize() 只算出 2 倍缩放——画面缩成 640×360、
     地图只显示左上角一块。修：改成 </header>，并给 .cl-shell 补
     flex:1 / height:100% / min-height:0。桌面恢复 1280×720，缩放窗口时实时跟随。
  2. 输入：Input.attach 每次重开覆盖层都再叠一套 keydown 监听（三次开关后一次按键触发三次），
     现在 attach 先 detach；blur 只清 down 不清 pressed、detach 不解绑 blur，一并修掉；
     自定义键位以前不 preventDefault，绑到 F5 / Backspace 会刷新页面或后退，
     改成「无 Ctrl / Cmd / Alt 修饰时一律拦」；旧常量 C.JUMP_BUFFER 还停在 0.08，同步成 0.15。
  3. 玩家状态机：
     - 空中按蹲冲会强行蹲下，hitbox 从 11 缩到 6、身体下移 5px，直接塞进地形；改成只在贴地时蹲。
     - 撞天花板原本只在 varJumpTimer < 0.05 时把速度归零，其余情况保留 -105 的上升速度，
       贴着天花板每帧互推；改成撞头直接归零（实测碰撞只发生一次）。
     - moveH 的 4px 向上角修正只抬身子不推进，修完还卡在同一面墙；改成修正后推进一格。
     - 攀爬时按反向方向键不脱墙（原版会脱）；补上。
     - 冲刺残影的衰减写在渲染里，暂停时也在掉、还和帧率绑死；移到 player.update 按 dt 衰减。
     - 站立高度 11 硬编码在多处，收成常量 STAND_H。
  4. 关卡：
     - 弹簧没有冷却，站上去会每帧被弹一次；加 0.3s 冷却，实测在弹簧上待 2s 能正常站住/弹走。
     - 检查点重生高度用玩家「当时」的 h，蹲着过点时重生点会被压低 5px 埋进地面；固定按站立 high 算。
     - Level.reset 不清水晶冷却、弹簧压缩、activeCheckpoint；补齐。
  5. 主循环：
     - restart 不重置 finishedOnce，重玩一次后再通关不弹面板、也不放通关音；
     - 暂停期间不调 beginFrame，按键在 pressed 里攒着，恢复瞬间会补一次跳/冲刺；
     - stop() 后 deadHold / flash / acc 残留；
     - 玩家动作完全没声音（跳、墙跳、超级跳），只有关卡事件有音效；接上。
  6. UI：
     - 设置面板点「编辑布局」后面板收起但 paused 一直是 true，布局编辑完游戏卡死在暂停；已修。
     - 拖拽改尺寸只解绑 pointerup，pointercancel 会漏监听；补上。
     - 重置 MOD 时两个数值 label 没判空，缺元素就抛错；加判空。
     - 计时每帧写一次 DOM（60 次/秒），改成按 10ms 节流（手机省电）。
     - 改键时会把别的动作的两个键都抢走，那个动作就永久失灵；改成至少给对方留一个。
  7. 渲染细节：浅色调色板里皮肤/外套/裤/背包重复定义了两遍；速度计用全角减号，
     等宽字体里会渲染成豆腐块，改成 ASCII '-';体力条在只开一个速度计时避让距离调准。
  8. 验证：随机按键 fuzz 30s（地面段）+ 6 个墙角/塔边点位各 40 次按键，
     0 次进入实心格、0 次 NaN、0 报错；爬墙/反向脱墙/体力扣减、检查点重生、暂停输入、
     设置面板编辑回复、三次开关后单次按键、两次通关弹面板、「再来一次」归零、
     桌面 0 死 12.97s 通关、手机 8ms 轻点 5/5、摇杆 vx=90、双指并发、浅色主题均通过。
  9. 版本号：load.html 4.7，celeste-loader VER 1.5。

二十六、v4.8 —— 初始地图换成 1A
  1. 关卡替换：celeste-level.js 的 LEVEL 从 100×64 的 FORGOTTEN PATH 换成
     FORSAKEN CITY 1A（120×44）。这不是官方 1A 的原始关卡数据 —— 官方关卡是
     二进制 .bin，本站没有该文件，所以按 1A 的房间尺寸（单房间 40×23 格、8px 一格）、
     城市紫蓝配色与教学节奏手工重建：
       - 房间 1：起点平地 + 两级小台阶 + 3 颗草莓路线；
       - 32px 缺口：正版开局第一个要 dash 的地方，缺口前放一颗水晶补 dash；
       - 房间 2：三级台阶 + 弹簧（台顶 240，弹起 60px）；
       - 房间 3：8 级缓坡阶梯塔（每级 16px、横移 3 格），从 288 爬到 160；
       - 顶段 → 终点平台（顶 144），终点旗在右上。
     3 个检查点、3 颗草莓、2 颗水晶，起跳高度仍是 21px（按住）/28px（松手），
     台阶每级控制在 16px 才能上。
  2. 修掉设计里的一处坑：平台不能垂直叠在同一 x 上，否则是一面实心墙
     （第一版塔就是叠的，跳不上去也看不出问题）；改成每级横移 3 格后正常。
  3. 掉出世界判定：原来是 map.ph+40，掉进缺口要下坠近 1 秒才判死，像卡住；
     收紧到世界底面上方 8px。
  4. 文案：顶栏副标题改 FORSAKEN CITY 1A，boot 载入日志同步；版本 load.html 4.83、
     celeste-loader VER 1.6。
  5. 三个 dash 变体实测结论（不改代码即可用）：
       - 反向 super dash：地面向左 dash 后反向按跳，走 Facing，vx≈234 朝右；
       - 反向 wave dash：贴地斜下 dash 后反向按跳，vx≈299（260×1.25 衰减）；
       - ultra dash：斜下 dash 落地 Speed.x 保留 240（DashUpdate 只在 DashDir.y<=0 时
         重置），之后按 RunReduce 400/s 衰减，约 0.4s 回到 90 —— 与原版一致，
         没有额外的加速补丁。
  6. 验证：新地图桌面 0 死 22.08s 自动通关、fuzz 25s 0 违规 0 报错、
     三次开关后单次按键正常、暂停不累积输入、手机触屏摇杆 vx=90 / 按钮跳正常。

二十七、v4.9 —— 全做（成就 / 终端 / 编辑器 / 成绩体系 / 行情扩币）
-------------------------------------------------------------------------
本轮把上一版列的清单整体落地，八块改动互相挂钩，版本号统一 ?v=4.9，
celeste-loader VER 升到 ?v=1.7。

  1. 跨模块成就系统（新文件 js/home/core/achievements.js）
     全局 window.LZXAch，14 条成就：FIRST JUMP / MODULE RUNNER（四个模块都进过）/
     CITIZEN（通关 1A）/ PURIST（0 死通关）/ BERRY PICKER（吃满草莓）/ LEVEL DESIGNER
     （自制图通关）/ S RANK / SS RANK / CARTOGRAPHER（导入 osu 谱面）/ 2048 /
     SWEEPER / SNAKE 20 / TERMINAL REGULAR（终端 10 条命令）/ NIGHT OWL。
     解锁时右下角弹终端风格横幅 + WebAudio 蜂鸣 + 派发 lzx:ach 事件；横幅进
     #lzx-ach-stack 容器纵向堆叠，多条不重叠。存档 lzx.ach.v1 / .seen / .cnt.*。

  2. 终端增强
     新增 12 条命令：/ls /goto /theme /lang /ach /stats /clear /whoami /date /uptime
     /coffee /reset-ach（/goto home 复位回首页，/goto 其余等于 /warp）。
     输入框加 ↑↓ 历史（lzx.hist，30 条）与 Tab 补全；命令次数计入成就。
     四个 data-*-open 入口点击时记账，用于 MODULE RUNNER。

  3. 命令面板与快捷键速查
     ⌘/Ctrl+K 呼出命令面板（模糊过滤、↑↓ 选择、Enter 执行）；? 呼出快捷键速查表；
     / 聚焦终端输入；1/2/3/4 直接 warp 四个模块（覆盖层打开时禁用）；Esc 关闭。

  4. Celeste 关卡编辑器（新文件 js/celeste/celeste-editor.js）
     右下角工具条：地面/橡皮/尖刺/弹簧/水晶/草莓/检查点/出生点/终点，左键画、
     右键擦，撤销栈 15 步；可 试玩 / 保存（celeste.custom.v1）/ 导出 JSON /
     导入 JSON / 载入 1A。写到 Level 数据格式（solid 合并成 rects），试玩直接
     loadLevel 进游戏。Celeste 设置面板新增第 4 个页签「关卡」，列出内置图 +
     自制图与各自 PB，可一键载入或清空。

  5. Celeste 换图 / PB / 手柄
     App.loadLevel(data) 支持运行时换图（重建 Level + Player，重置计时与死亡）；
     通关写 PB（celeste.pb.v1，更快才覆盖），结算面板新增 BEST 一格，破纪录标 NEW。
     手柄走标准映射：A 跳 / B 冲 / X 抓 / Y 蹲冲，十字键与左摇杆都可，死区 0.4，
     与键盘共用同一套 down/pressed。

  6. osu 成绩体系
     结算后写 PB（osu.best.v2，按 模式|曲名|难度）与本地榜（osu.board.v1，前 30 条），
     面板新增 BEST 行（破纪录 NEW RECORD）+ LOCAL TOP5。新增 SCORE CARD 按钮，
     canvas 1200×630 深紫渐变卡（rank / score / acc / combo / pp / mods / 时间），
     直接下载 PNG。S、SS 判定同时解锁成就。

  7. GameHub 成就挂钩
     2048 出现 2048 方块、扫雷全清、贪吃蛇 20 分 各解锁一条成就。

  8. 行情扩币 + 价格提醒
     market 新增 BTC / ETH / 铂金现货（XPT）三格并排卡，各带 24H 变化与迷你走势，
     点右上 ◔ 设阈值（prompt 输入，留空清除），穿越时弹提醒横幅。数据源用
     api.gold-api.com（与本页金银同一接口，实测 BTC 57,281 / ETH 1,616 / XPT 1,286；
     注意 CoinGecko / Binance / Coinbase 在本机网络不可达，SOL 该接口不提供，
     故第三格用铂金）。

  9. 后台省电
     Celeste 与 osu 主循环在 document.hidden 时停止推进逻辑（只留 rAF 续帧），
     切回标签页不跳时间；market 轮询本来就有 hidden 判断。

 10. 验证
     - 终端 t1：12 条命令全通、/theme paper 生效、面板与速查表开关正常；
     - 编辑器 cl1：打开/画格/保存/试玩；cl2：自制小图通关 → BEST 0:00.517 带 NEW，
       4 条成就同解锁；
     - os2：结算 BEST + LOCAL TOP5 + 成绩卡；all1：行情三格真实价格、提醒按钮 3 个；
     - final1：1A 自动通关 0 死 15.18s、PB 显示 0:15.183、osu 开谱 8s 无报错；
       全程 0 报错。
     仍未做：osu 回放录制/重播、GameHub 跨游戏统一排行榜（各游戏仍各自显示 best）。

二十八、v5.0 —— 站点层增强 / osu 结算可视化 / 行情工具 / Celeste 影子与编辑器升级
-------------------------------------------------------------------------
本轮把"还能优化什么"那份清单里的一档与二档大部分落地，版本号统一 ?v=5.0，
celeste-loader VER 升到 ?v=1.8。新增文件：js/home/core/ui-extras.js、manifest.json、
sw.js、assets/icon-192|512.png、assets/og.png。

一、站点层
  1. 频谱可视化（新 ui-extras.js）：播放器上方一条 34 根柱子的实时频谱，
     WebAudio AnalyserNode 取 FFT；未播放时是低幅呼吸波形，颜色跟 --primary 变。
     跨域音频（部分直链）会导致频谱取值为 0，此时自动退化为装饰波形，播放不受影响。
  2. 主题选择器：点导航调色盘不再"循环下一套"，改为弹出 7 套主题网格
     （CYBER / HACKER / OCEAN / SUNSET / SWEET / SNEAKER / PAPER）+ 色条预览，
     记住到 localStorage.theme；面板里还有「动画特效」开关与「成就」入口。
     全局动效开关写 lzx.motion=off 后给 html 加 .lzx-reduce，全站动画降到近乎静止，
     与系统 prefers-reduced-motion 同时生效。
  3. 成就墙：顶栏新增奖杯按钮（手机端也有一枚），弹出 14 条成就卡片：
     进度条 + 已解锁/未解锁灰化 + 解锁日期；底部显示 ALL CLEAR 状态。
  4. PWA：manifest.json（standalone、紫色主题色、192/512 图标）、sw.js
     （代码文件 network-first 保证改完即时生效，图片字体 cache-first；
     离线时回落到缓存与 load.html）。页面加载后自动注册。
  5. 分享预览：index.html 补齐 description / theme-color / manifest / 图标 /
     og:* / twitter:*，新增 1200×630 品牌 OG 图（assets/og.png）与 LZX 方形图标。
  6. 播放器控制：新增 上一首 / 下一首 / 随机 / 循环（关·全部·单曲）/ 音量弹条，
     结束曲按循环模式走（单曲重放、全部循环、关则停在最后一首）；
     对外暴露 CyberAudioPlayer.next/prev/toggleShuffle/cycleRepeat/setVolume/state。

二、osu
  7. 结算判定分布：300/100/50/… 六档（PERFECT/GREAT/GOOD/OK/MEH/MISS）按比例画
     一条彩色堆叠条 + 图例计数，比单看 ACC 直观；分数做 700ms 缓出滚动
     （.lzx-reduce 或系统减少动效时直接显示终值）。
     注：屏幕/音频 offset 校准向导与 master/music/sfx 分轨音量在更早版本已存在。

三、行情
  8. 金银比卡片：XAU/XAG 现价比值，带 70–90 区间判读（>90 银相对便宜，
     <70 金相对便宜）与滑条位标；随金银轮询实时刷新。
  9. 汇率换算器：8 种货币 + CNY 互转，输入即算，SWAP 一键对调，100/1K/10K 快捷键；
     汇率来自 open.er-api，算价随轮询更新。
 10. 提醒统一：金银两格也加 ◔ 阈值按钮（原来只有 BTC/ETH/XPT 有），
     5 个品种共用 mk.alerts.v1，穿越时弹终端风提醒；按钮有阈值会高亮。
 11. 断流兜底：每次成功后把价格写 mk.cache.v1，接口临时失败时显示上次值并标 LAST；
     走势历史写 mk.hist.v1（每品种最多 120 点），刷新页面走势不归零；
     超过 10 分钟没更新，状态灯降透明度标 STALE。

四、Celeste
 12. Ghost 影子（celeste-boot）：每逻辑帧录制玩家轨迹（x/y/朝向，最多 5 分钟），
     破 PB 时把轨迹按关卡名存 celeste.ghost.v1；重开/换图后自动载入，
     半透明青色影子带拖尾与最佳成绩同步跑完。死亡与暂停时影子同步停住。
 13. 编辑器重做：撤销旁边加「重做」，Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y 也走同一栈。
 14. 关卡自检：试玩与分享前跑 validate —— 出生点是否在边界、头顶两格是否埋墙、
     脚下是否有地面、终点是否存在、终点下方是否有落脚点，问题直接写在底栏。
 15. 分享链接：一键把整张图压成 base64 塞进 #lv=，复制到剪贴板（无剪贴板权限时
     弹文本框手动复制）；对方打开带 hash 的链接，点开编辑器就是这张图。
 16. 图库：celeste.lib.v1 多图存档，「存到图库 / 载入 / 复制副本 / 删除」，
     同名覆盖，列表显示存档时间。

五、验证
  - 主题面板 7 项、切 paper/ocean 生效、Esc 关闭；成就墙 14 张卡；频谱 canvas
    360×26 正常渲染；播放器随机+循环状态 state()= {shuffle:true,repeat:1}；
  - market：金银比 86.1 MID RANGE，100 USD→667.10 CNY、1000→6,691.98、
    对调后 1000 CNY→149.4326 USD，提醒按钮 5 个，0 报错；
  - 编辑器：撤销/重做提示正常、自检能拦下埋墙的出生点、分享链接 7.5KB hash 生成、
    图库存档出现「MY FORSAKEN CITY 1A」；
  - ghost：自动通关 11.88s 录制 713 帧 → 落盘 → restart 后载入，影子随跑前进；
  - 移动端（390×844）：播放器宽 350 不溢出、手机端隐藏上一首/下一首、面板两列；
  - service worker 注册成功 1 个；终端 /ls 仍正常；全程 0 报错。

六、本轮未做（下一批继续）
  - Celeste 常驻计时 HUD 与检查点分段 split；
  - 速通按键显示叠层 / 碰撞框调试开关；
  - 更多内置关卡（多图章节选择）；
  - GameHub 续局、2048 撤销一步、扫雷旗子计数；
  - osu 多本地档案与皮肤配色包；
  - 自动化测试脚本入库（tests/ + run.sh）。

======================================================================
二十九、v5.1 —— 第二批：多内置关卡 / More 精简 / 速通辅助 / 续局
======================================================================

一、入口精简
- 顶栏 More 面板删掉 Celeste 一项（现只剩 osu! / MARKET / GAMEHUB 三项）；
  Celeste 入口统一收到 GameHub 的 4 张卡片里（`.gh-card-cel`），点卡片就地起覆盖层。

二、Celeste 多内置关卡
- `celeste-level.js` 新增 `Celeste.LEVELS`：FORSAKEN CITY 1A（原图）+ GAP GAUNTLET
  （64×26，两段 32px 缺口 + 阶梯 + 弹簧）+ TOWER CLIMB（48×40，八级阶梯塔，每级横移
  一格半避免叠成实心墙）。两张小图出生点都校验过：出生即站立、右移不掉。
- 设置面板「关卡」页签列表改由 `Celeste.LEVELS` 渲染，内置关卡行可直接点击载入
  （当前关卡高亮，右侧显示该图 PB）。顶部副标题随载入图改名。

三、速通与调试辅助
- 结算面板新增分段表（`#cl-over-splits`）：每过 checkpoint 记一次时间，结算按段列出
  CP 与 FINISH 的相对/累计时间，破 PB 时一起对比。
- 按键叠层：mods 页签新增「按键叠层」开关，右下角实时高亮当前按下的方向/跳/冲刺/抓/演示键。
- 碰撞框调试：mods 页签新增「碰撞框」，开启后在玩家外画品红 hitbox、脚下画绿线（地面检测）。

四、GameHub 续局
- 2048 每步结算后写入 `gh_2048_save_v1`，重开站点再进 2048 自动恢复盘面与分数
  （`2048 · resumed` 会写进终端日志），新局清档。扫雷/贪吃蛇一局时长较短，暂未接续局。

五、回归测试入库
- `tests/` 收 7 个 Playwright 脚本（冒烟 / 外壳 / market / 编辑器 / ghost / Celeste / 玩法）
  与 `tests/run.sh`（自带 http.server，可传 PORT，逐个跑完打印末 8 行）。

六、本轮未做
- osu 多本地档案（PB/本地榜仍单档）、osu 皮肤配色包；
- 扫雷/贪吃蛇续局；
- 版本号已升到 ?v=5.1，celeste-loader VER = ?v=1.9。

======================================================================
三十、v5.2 —— osu 回放 / 多档案 / 皮肤包 / 存档码 / 自检
======================================================================

一、osu! 成绩回放（`js/osu/osu-replay.js`，新文件）
- 录制：判定出口 `OSU.addHit / OSU.addMiss` 统一挂钩，把每次判定记成
  `[时间, 判定码, x, y]`（时间单位秒，与 songTime 一致），一局最多 6000 条。
- 存盘：结束时连同精简谱面（objects 深拷贝）写入 `osu.replay.v1`，只保留最近 2 局；
  配额写不进时自动退化为只留 1 局。
- 回放：`game loop` 检测到 `S.replay` 后走回放分支——输入不接管，判定完全由录制事件驱动，
  因此分数/连击/准确率与原局一致；配 `markNote()` 让音符按判定消失。
- 入口：结算页新增 REPLAY 按钮（仅当这次成绩刚好对上最近录下的回放时出现），打完自动回菜单。

二、osu! 多本地档案
- PB 与本地榜从固定 key 改为按档案加后缀：`osu.best.v2` / `osu.best.v2.<name>`、
  `osu.board.v1` / `osu.board.v1.<name>`，当前档案存 `osu.profile`（默认 main）。
- 设置 → GENERAL 新增「本地档案」：列出已存在的档案 chip，点即切档，`+ NEW` 新建（≤12 字符）。

三、osu! 皮肤包
- 五套：AUTO（跟随站点主题）/ FROST 霜蓝 / EMBER 余烬 / NEON 霓虹 / MONO 单色，
  存 `osu.skin`；`OSU.applySkin()` 同时覆盖外壳 CSS 变量（`#osu-app[data-skin]`）与
  `C.JUDGE` 判定色，AUTO 时还原默认判定色。
- 设置 → GRAPHICS 新增「皮肤配色」chip（带双色块预览）。

四、存档码（`js/home/core/toolkit.js`，新文件）
- 白名单导出：osu PB/榜/设置/档案/皮肤、celeste PB/自制图/图库/影子/设置、
  gamehub 三个 best + 2048 续局、market 提醒与历史、成就、主题、动效开关等；
  排除缓存类（mk.cache）与临时态。
- 编码：JSON → gzip（CompressionStream）→ base64url → `LZX1G-…-<8位FNV校验>`；
  无压缩环境退化为 `LZX1R-`。导入先校验版本与校验位，截断即拒绝。
- 合并而非覆盖：PB/最佳取更优、osu 榜合并去重取前 10、成就并集、自制图按 name 去重，
  其余保留本机。导入前弹确认，列出将写入/将跳过项。
- 入口：More →「About / Diag」面板的「存档码」页（生成/复制/下载 .txt/校验/导入），
  以及终端 `/save` `/load`。

五、/diag 自检 + 关于面板
- 14 项检查：localStorage 可写、6 个模块挂载（osu/gamehub/market/celeste/成就/主题/播放器）、
  Service Worker、帧率（无头环境降级为提示）、资源版本与缺失、运行时错误计数、存档体积、环境 UA。
- 终端 `/diag` 逐条打日志；面板「自检」页可复制完整报告。
- 「关于」页：版本、架构、模块、存储、字体 + 快捷键表。

六、终端命令扩充到 24 条
- 新增 `/diag` `/about` `/save` `/load` `/pb`（列各模块个人最佳），帮助表与命令面板同步。

七、其它
- 首屏：load.html 加了骨架屏（LOOPZLX + 进度条 + booting kernel），fetch 完自动替换；
  字体 preconnect + style 预加载。
- 无障碍：`:focus-visible` 焦点环；启动后自动给无文本按钮补 `aria-label`/`title`
  （图标名映射表）；覆盖层补 `role="dialog" aria-modal`。
- Celeste：窄屏不再隐藏按键叠层，改为 980px 下两行小键（480px 再收一档）。
- market：新增「提醒历史」卡（`mk.alertlog.v1`，最多 20 条，显示时间/品种/触发价/目标价，可清空）。
- OG：`og:image` / `twitter:image` 改成绝对地址 `https://loopzlx.dev/assets/og.png`（部署域名不同需再改）。
- 头像：补 `avatar.png`（根目录与 assets 各一份），修掉首页 404。
- 版本号：load.html/index.html 全部 `?v=5.2`，osu-loader `?v=3.3`，celeste-loader `?v=1.10`。

八、本轮未做
- 扫雷/贪吃蛇续局；
- 回放暂不支持拖动进度条与倍速（可暂停/继续，倍速改 S.speed 会影响回放时钟）。

三十一、v5.3 —— osu!std 判定对齐 / 分区记忆 / 音乐修声 / 手机端 / 性能
一、osu!standard 判定改成三档（对齐 osu!lazer 的 std 体感）
- std 不再有 PERFECT：最高即 GREAT。
  新判定表：GREAT（300 分，回血 1.2）、OK（100 分，回血 0.3）、MEH（50 分，不回血），外加 MISS。
- 内部映射 `STD_MAP`：PERFECT→GREAT、GREAT→OK、GOOD→MEH，
  `OSU.addHit` 入口统一 `OSU.normJudge()` 归一化，谱面/回放里残留的老判定名也不会漏。
- 准确率按模式分权重：std 的 GREAT=1、OK=1/3、MEH=1/6。
- 结算页分布条同样分模式渲染：std 只出 GREAT / OK / MEH / MISS 四格
  （配色 #ff66aa / #ffd166 / #9a9a9a / #ff4d6d），taiko / mania 仍保留原六档。
- `OSU.judgeTable()` / `OSU.usesStdJudge()` 供 UI 与回放共用同一张表。

二、分区记忆（刷新不再被弹回主界面）
- 新增 `LZXView`（main.js 末尾）：`MutationObserver` 观察 body 的 `xxx-open` class，
  只在覆盖层打开时把当前分区写进 `lzx.lastview`（market / osu / gamehub / celeste）。
- 启动后 1.1s 读回上次分区并自动调用对应 `open()`，成功后终端打
  `Resume: <view> restored (last session)`。
- 主题面板新增「记住分区 RESUME」开关（`lzx.rememberview`，`'0'` 关闭），
  对外 `window.LZXView = { last, remember, setRemember, forget }`。

三、音乐没声音：根因在频谱，不在链接
- 症状：点播放进度照走但完全无声，控制台报
  `MediaElementAudioSource outputs zeroes due to CORS access restrictions`。
- 根因是 v5.0 的频谱可视化把跨域音源接进了 WebAudio 图（`createMediaElementSource`），
  浏览器为防泄漏把输出压成 0。
- 修复：彻底不接管音频链路，频谱改成「跟 `audio.currentTime` 同步的合成波形」
  （多正弦叠加 + 播放时能量增强、暂停降到 0.35 倍）。实测 `currentTime` 正常推进、无 CORS 警告。

四、成就墙 / 主题面板重做（此前被评为「太丑」）
- 成就墙：标题 + SVG 环形进度（按完成率画 `stroke-dasharray`，带 glow）+ 中心 n/总；
  下方「已解锁 / 待解锁」统计与百分比；已解锁、待解锁分两组渲染；
  卡片改成 2 列「圆形徽章 + 中文/英文/描述 + 日期」，锁态用虚线边 + 半透明，
  页脚随是否全清切换文案。
- 主题选择器：每项前面加 52×38 主题预览块（上半主色渐变、下半底色 + 网格纹理，
  7 套主题各自硬编码预览色），选中态双环 + 右侧对勾。
- 两处都补了 ≤640px 单列媒体查询（成就卡单列、预览块 38×28、标题与环形缩档）。

五、手机端适配
- 播放器贴底占满（left/right 10px），日志窗口上移到 `bottom: 84px` 并收窄到 44vw，
  两者不再互相压住；成就提示条从右下角挪到顶部，不盖播放器。
- 手机端整体关闭 `backdrop-filter`（实时模糊是手机 GPU 最大开销），面板改半透明实色。
- 触屏最小点击区：导航/主题/More 40px，播放器小按钮 30px。
- 首页主标题、hero 间距、osu 模式卡在 390px 下不再溢出（`scrollWidth == clientWidth`）。

六、性能
- 数字雨：加帧闸（移动/触屏 30fps、桌面 50fps），移动端 DPR 上限 1.4、列距 22px；
  字形改为每帧取一次随机、循环改 for 减少函数调用。
- 覆盖层打开时数字雨不再重绘，把 CPU/GPU 全留给 osu / celeste / 游戏；
  页面隐藏时仍按原逻辑停 rAF。
- 手机端去掉 14 处 `backdrop-filter`。

七、其它
- 首页右上角内核标签由写死的 `KERNEL_V4.4_OS` 改成 `KERNEL_V5.3_OS`（`#kernel-ver`）。
- 版本号：load.html/index.html 全部 `?v=5.3`，osu-loader `?v=3.4`，celeste-loader `?v=1.11`。

三十二、v5.3 修正批次（按反馈调整）
一、Celeste 1A 地图
- 旧版是 120×44 三个房间横拼的“自制复刻”，观感和原版首房差太远。
- 现改为与原版房间尺寸一致的 40×23 单房间：左端低地起步 → 两级 16px 台阶 →
  高台平地（顶 128）→ 右端降一级 → 出口门（goal 立在 160 地面）。
- 地形全部改成“落地实心块”（原来薄板悬空，看着像浮空平台）。
- 悬空草莓平台顶 112，比高台高 16px，一次跳够得着；整间不设尖刺，对应原版开局教学房。

二、播放器
- 桌面宽度 432 → 384，小按钮 24px、标题 104px、播放键 42px，三列不再互相挤压
  （此前标题被截断、时间压到进度条上）。
- 手机端不再横穿整屏：宽度 min(238px, 100vw-20px)，只占左下角一截。

三、日志栏
- 手机端移到底部右侧、播放器上方（bottom 78px），不再压播放器也不再压头像。

四、主题面板位置
- 桌面改成右上角下拉锚定（top 76 / right 26），遮罩变透明、去掉模糊，
  点击面板外仍可关闭；不再整屏居中。手机端保持居中卡片。

五、切主题“闪一下”
- 原因一：切主题时所有元素同时跑 transition。现在切换瞬间给 `<html>` 加 `.lzx-notrans`
  （420ms 内禁用全部过渡与动画）。
- 原因二：项目封面图切换时先 `opacity:0` 淡出再淡入。现在改为预载完成后直接换 src，
  不再淡出。
- 播放器内部顺带去掉了唱片圆盘动画。

六、首屏
- `#home` 从垂直居中改为上移（桌面 padding-top: 11vh，手机 14vh）。

三十三、v5.4 —— 成就抽屉 / 启动不闪主题 / 频谱对齐 / 分区记忆修正
一、成就墙改成右侧抽屉
- 不再居中悬浮：贴右、满高、左侧圆角，从右滑入；手机端变成底部上滑整屏抽屉。
- 卡片列表由 2 列改 1 列，描述与英文名不再被截断。

二、启动第一帧不再闪默认主题
- index.html 启动页（原本写死黑底绿字）+ load.html 骨架屏（原本写死紫/粉）全部改成读 localStorage 的主题色：
  启动页在 <head> 内联脚本里按 theme 映射出 --lz-bg / --lz-fg / --lz-2 / --lz-grid；
  骨架屏改用 --bg-base / --primary / --secondary / --text-main，带默认兜底。
- 现在用非默认主题打开，第一帧就是自己的颜色。

三、频谱跟着播放器和主题走
- 宽度不再写死 432px：每帧按 #audio-container 的实际 rect 同步 left / width / bottom，和下面音乐条左右对齐、间距 6px。
- 深色主题用 `mix-blend-mode: screen`，浅色主题自动切 `normal` 并把透明度降到 .55，避免在浅底上看不见。
- 切主题时（800ms 轮询）同步重取颜色并重排。

四、分区记忆修正
- 原来是「只在有覆盖层打开时写记录」，关掉覆盖层回主页后旧值还留着 → 一刷新又被拽回 osu / market。
- 现在 MutationObserver 每次 body class 变化都记录：所有覆盖层都关闭时写回 `home`，并且只在变化时写盘。
- 实测：进 osu → 关闭 → 刷新 → 停在主页。

五、顺手修掉的 bug
- 首页雷达图的 `<polygon points="200,200 200,200 200,200 200,200 200,200,200">` 少一个逗号，
  控制台一直报 `Unexpected end of attribute`，已改为 5 个点。
- market 覆盖层打开时底部播放器 / 频谱 / 日志仍在，会压在行情卡上 → 打开 market 时整组 HUD 收起。
- 桌面成就提示条原本在右下角和日志窗口重叠 → 移到右上（top 96px）。

三十四、v5.5 —— 频谱配色 / market 顶部错位 / 面板打开闪烁
一、音乐条上方的频谱现在真的跟主题走
- 根因：`readColor()` 用正则只认 `rgb(...)`，而各主题的 `--primary` 全是 `#8a2be2` 这类 hex，
  于是颜色永远解析失败、一直停在默认紫。
- 改为把颜色字符串丢给 canvas 的 `fillStyle` 归一化（hex / rgb / hsl 都吃），再取 RGB。
- 实测：cyber #8a2be2、ocean #00b4d8、sunset #ff6b35、paper #4a3728，切主题即时生效。
- 顺带把柱高 ×1.6（之前只有 4px，像一排虚线）。
- 布局改为「值变了才写样式」，不再每帧触发一次重排。

二、market 顶部 UI 重叠
- `.mk-layer-top` 原来是 `position: sticky; top: 0` 且带 86–96px 的上内边距，
  滚动时整个头部（BACK / MARKET FEED / THEME）会压到行情卡上。
- 改成普通文档流，顶部留白统一由 `.mk-layer { padding-top: 104px(+safe-area) }` 提供；
  导航条背景改近乎不透明（bg-base 94%），内容滚到下方时不再从导航里透出来。
- 覆盖层背景补 86% 底色，主页的 LOOPZLX 大字不再透出来混在行情里。

三、打开主题面板那一瞬的闪
- 面板原本是「首次点击才 build」，几十个节点的 DOM 一次性插入会造成一帧卡顿闪烁 →
  改为启动 1.5s 后静默预热构建，点击时只切 `show`。
- 卡片入场动画从「位移 + 缩放」改成纯 opacity 淡入（.16s）。

三十五、歌单新增 PHONK 分组
- js/home/core/audio-player.js 的 playlists 里插入 PHONK 分组（2 首，总曲目 19）：
  In Your Heart(PHONK) / SØRIXEN（FLAC，02:50）、Eyes In This Feeling / Eric_Enyou（MP3，03:24）。
- 时长是用 ffprobe 读真实文件得到的（170.3s / 204.3s），不是估的，播放器不会出现「00:00 / --:--」。
- 实测直链可直接 <audio> 播放：点开后 currentTime 正常推进（1.2s → 4.2s），duration 170.30s，error code 0。
  服务器返回 octet-stream，靠 URL 里的 .flac/.mp3 后缀识别，无需额外处理。

三十六、歌单「点开是空白」的 bug（PHONK 打不开就是这个）
- 现象：点 PHONK 组头，箭头转了、组也算展开了，但下面一片空白，看不见歌。
- 根因：渲染时内层 <ul class="playlist-tracks"> 只有在「组的第一个」时才会带 open 类，
  其余组的 ul 一直是 display:none。而点组头时只给外层 .playlist-group-body 加了 open，
  内层 ul 没打开 → body 高度实测 0px。SONGS 是首组、初始就带 open，所以只有它正常。
- 修法：无文件夹的组，内层 ul 一律常带 open（显隐完全交给父级 body 控制）；
  点组头展开时再兜底把组内所有 ul 打开一次。
- 实测：修前 body 高 0px → 修后 109px，两首都在；点 In Your Heart 后 currentTime 0.83 → 3.33，
  duration 170.30，error 0。

三十七、成就墙支持中英切换
- 原来成就只有中文标题 + 中文描述，英文标题只当副标题摆着，切到 EN 还是满屏中文。
- achievements.js：14 条定义全部补 descEn（英文描述），新增 LZXAch.lang() 读 documentElement.lang；
  unlock 弹的 toast 也按语言来（主标题用当前语言，另一语言作副行，描述跟着变）。
- ui-extras.js：renderAchWall 整块按语言出词——标题、进度汇总（UNLOCKED/LOCKED 或 已解锁/待解锁）、
  分区标题、完成率、底部提示、关闭按钮 aria，全都有两套。
  卡片主行按语言、副行显示另一种语言灰字，描述按语言。
- 成就墙开着时切语言不用关掉重开：700ms 轮询 documentElement.lang，变了就重绘一次。
- 顺手修：list() 之前没返回 icon，卡片左侧徽章一直显示兜底的 ◆，现在是各自的图标。
- 实测：EN 模式「ACHIEVEMENTS / ACHIEVEMENT WALL / UNLOCKED 0 / LOCKED 14 / First Jump / Open any overlay」；
  切 ZH 后同一面板即时变成「成就墙 / 已解锁 0 / 待解锁 14 / 初次跃迁 / 打开任意一个覆盖层」。

三十八、语言记忆 + SYNTHWAVE 加 8 首
一、语言记忆
- setLang() 里写 localStorage `lzx.lang`；启动时读它，是 zh 就直接按中文初始化，
  同时把 .lang-btn 的 active 先摆到 ZH 上，避免启动时先英文再跳中文。
- 实测：选中中文后刷新，documentElement.lang 仍是 zh-CN，导航/文案全中文。

二、SYNTHWAVE / 新增 RETROWAVE 文件夹（8 首，总曲目 17 → 27）
  Locke / Pylot (05:26)
  Moments in Time / Timecop1983 (04:18)
  New Retrowave / Gerard Requena (05:15)
  Signals / Lazer Boomerang (04:27)
  SimpsonWave1995 / Tax Evader & Resonance Hub & FrankJavCee (02:21, FLAC)
  Synthwave Cassette (1985) / FrankJavCee (03:37)
  Teenage Dreams / Lazer Boomerang (05:43)
  Time to Pretend / Lazer Boomerang (05:15)
- 时长全部是下载后用 ffprobe 读的真实值（325.9 / 258.0 / 314.6 / 266.7 / 141.2 / 217.4 / 343.0 / 314.6 秒）。
- 实测：SYNTHWAVE 组展开显示 3 个文件夹 VECTOR(2) / CASSETTE(2) / RETROWAVE(8)；
  展开 RETROWAVE 高度 442px、8 首齐全；点 Locke 播放 duration 325.88、currentTime 正常推进、error 0。

三十九、清掉示例歌单 + 取消失效自动跳歌
一、歌单只留真正要听的
- 删掉全部 SoundHelix 占位曲（16 首）和随之清空的组：CHILL_FLOW / NIGHT_DRIVE / LOFI_KERNEL 整组移除，
  SYNTHWAVE 里的 VECTOR、CASSETTE 两个假文件夹也移除，8 首真实曲目直接放进 SYNTHWAVE 组（少一层点击）。
- 现在 11 首、3 组：PHONK(2) / SYNTHWAVE(8) / SONGS(1，月揺)。
- 之前「点开是空白」的修复依然有效（无文件夹的组 ul 常带 open）。

二、取消「音源失效自动跳下一首」
- 原来 markOffline 里有一段 logic：failed 就 500ms 后 loadTrack(stepIndex(1))，还会累计 failStreak，
  结果一首没版权的歌会把整个列表一路跳到底。
- 现在改成只就地标记：容器进 no-signal、去掉 playing、歌名显示 OFFLINE、播放键变警告图标、日志一句
  「Audio source offline — playback stopped」，不动 currentTrackIndex。
- 另外「no-signal 状态下点播放键」原来是跳下一首，现在是重新加载当前这首（重试），不再替你换歌。
- 实测：故意把 src 改成不存在的路径触发 error，300ms 后歌名仍然是 OFFLINE 而不是下一首的歌名，索引没动。

四十、月揺换成真实直链 + SONGS 置顶
- 月揺(Tsukiyura) 原来走 lz.qaiu.top 蓝奏云代理（很不稳），换成 pdf3 直链，时长 ffprobe 实测 176.4s = 02:56。
- SONGS 组移到 playlists 最前面，因此它也是默认展开、第一首（loadTrack(0)）就是月揺。
- 实测：点播放键 currentTime 2.38 → 4.89 正常推进，duration 176.40、error 0；组顺序 SONGS(1) / PHONK(2) / SYNTHWAVE(8)。

四十一、换头像
- 用户给的 512×512 像素草莓（透明底）替换 avatar.png；原图内容框 320×416 不是正方形，
  直接塞进 rounded-full 会被圆裁切掉两侧和顶部叶子。
- 处理：裁到内容包围盒 → 居中放进正方形画布（内容占 86%）→ NEAREST 放大到 512。
  这样草莓完整落在圆形里、四角空白也不会露出白底。
- 同时更新 assets/avatar.png 副本，并把 favicon（assets/icon-192.png / icon-512.png）换成同一个草莓。
- 实测：hero-avatar 自然尺寸 512、显示 112px、complete=true。

四十二、v5.6 首页大改：两栏 + GitHub 贡献墙（还能玩贪吃蛇）
一、布局
- 原来首屏是「头像 - 名字 - 社交 - 打字机」垂直居中一列。现在拆成 .hero-grid 两栏：
  左栏头像/名字/社交/打字机全部左对齐；右栏放 GitHub 贡献墙卡片。
- ≥1024 真正两栏（左 1fr / 右 clamp(340px,42%,560px)，gap 48）；
  768–1023 平板单栏但整体靠左，贡献墙落到名字下面（满宽）；
  手机 < 768 仍然居中堆叠（头像居中、卡片占满宽）。
- 1024–1199 名字字号降到 64px，避免大字撞到右栏（实测 1080 屏原来会重叠 76px）。
- 顶部那条 NEURAL LINK / UTC 时钟原来是 absolute，头像左移后会压在头像上；
  桌面改成文档流放在 hero 上方（768 以下仍保持原来浮在顶部）。

二、贡献墙
- 53 周 × 7 天伪数据（固定 seed，刷新不变，看起来像真的），五档配色走主题变量，
  圆角方格、月份标签按周索引绝对定位（8 个；窄屏 4 个）、星期标签用 7 行 grid 对齐。
- 统计行：最长连续 streak、单日最高 best day、活跃率 active。
- 窄屏只画最近 26 周，格子才不会缩成一排点。

三、贪吃蛇
- 点击卡片右上 SNAKE（或按空格）开始，方向键 / WASD 操控，手机给了四个方向小按钮。
- 蛇在贡献墙格子上跑，吃掉的格子直接点亮成「已贡献」，右上 SCORE 累加、总数跟着涨；
  撞墙或咬到自己显示 GAME OVER + 得分，1.6 秒后复位。
- 只有首页可见且没有覆盖层打开时才接管键盘；输入框里打字不受影响。

四、顺手修
- 启动时 setLang('en') 因为「语言没变」直接 return，导致打字机 / 技能条 / 雷达标签压根没初始化，
  首页光标孤零零立着。改成 setLang(lang, force)，启动时强制跑一次初始化。
- 打字机加 "> " 提示符，高度改 min-height，窄屏换行不会溢出。
- 手机端右下角日志窗会压住贡献墙，<768 直接不显示（桌面照旧）。

实测：1440 头像/名字 left=70、卡片 left=824，无重叠；820 平板全左对齐（24 / 24 / 552）；
1080 笔记本左 24 卡片 623 无重叠；390 手机卡片不溢出、格子可点、蛇能跑。

四十三、v5.7 左栏排版 + 接真实 GitHub 数据
一、左栏排版（用户说「左边排版好奇怪」）
- 原因：头像孤零零一个大圆、名字单独一行、社交和打字机各隔 24–32px，竖向节奏松散。
- 现在头像与一块身份标签横排（PORTFOLIO // 2026 / UI · WEB · MOTION / ● OPEN FOR WORK），
  头像 112 → 96，名字 8xl → 7xl、行高 .92 并紧贴头像，社交与打字机上移。
- 坑：头像 class 里还留着 Tailwind 的 mx-auto，在 flex 里会吃掉剩余空间把标签块推到最右边；
  桌面端用 `margin: 0 !important` 覆盖掉。
- 手机不动排版：hover 隐藏标签块、头像仍然居中。

二、电脑端靠左还是靠右？
- 选靠左。原因：右栏已经有贡献墙这一大块「数据」，文字若也靠右，两块重量都压在右半屏，
  左半屏反而空；现在是「左文字 / 右数据」的标准双栏平衡。

三、接真实 GitHub 贡献数据（username: loopzlx）
- 三级回退：jogruber v4 API（?y=last）→ deno.dev 镜像（两个变体）→ 都失败则用本地种子数据。
- 成功：按真实日期重排成 53×7（周日是第 0 行，跟 GitHub 一致），baseTotal 用真实 count 求和，
  副标题显示 `LIVE · GITHUB.COM/LOOPZLX · PAST YEAR`。
- 失败：副标题显示 `LOCAL · OFFLINE SAMPLE DATA`，不弹窗、不报错，界面照常。
- 每个源 6.5s 超时（AbortController），不会卡住首屏。
- 说明：开发环境的出网被限制（ERR_TUNNEL_CONNECTION_FAILED），本地只验证到回退分支；
  真实浏览器网络正常时会走 LIVE 分支。

四十四、v5.8 首页：满贡献墙 + 自动贪吃蛇 + 赞助入口
1. 默认贡献墙改为"满墙"本地示例数据（53×7，工作日 95% / 周末 62% 点亮，2,730+ contributions、79% ACTIVE、64d streak），副标题提示 "FULL SAMPLE · TAP GH FOR LIVE DATA"。
2. 右上角两个 24×22 小按钮：手柄图标切自动蛇开关，GH 按钮拉真实 GitHub 数据（三级源回退，失败回落本地样例）。
3. 贪吃蛇改为全自动：rAF 主循环（stepMs 128ms、dt 上限 64ms），AI 选路（不越界/不撞身/不 180° 掉头 → 朝食物最近 + 随机抖动），吃完点亮格子（420ms 光晕淡入），绘制用 progress 插值 + 头部发光、尾巴 alpha 递减，观感顺滑灵动。方向键按钮已彻底移除。
4. 名字下方新增赞助胶囊入口（https://github.com/sponsors/loopzlx，位于打字机之后）。
5. 排版：桌面两栏居中、grid 收窄到 1180 并收窄列间距，卡片与左栏垂直居中对齐；平板 <1024 单栏靠左、卡片满宽；手机 ≤767 全部居中（头像/名字/社交/打字机/赞助）。

四十五、v1.8 —— Auto 模式输入隔离 + 模式卡配图焕新
1. 问题：开启 Auto（AT）自动游玩后，真人按键 / 触屏点击 / 指针仍会进入各模式的 impl.press()，
   误触会在已被 autoPlay 打成 PERFECT 的谱面上再打出 GOOD/MEH/MISS（taiko 打错颜色直接 Miss、
   mania 早松手断 hold、std 点偏降档），导致自动回放拿不到 100%。
2. 修法（js/osu/osu-boot.js 输入层统一拦截）：新增 isAuto() 判断，I.press / I.release / I.tap /
   I.pointer 在 S.mods.AT 时直接 return，判定完全交给 autoPlay；屏幕 pads 按钮走同一输入层，一并被隔离。
3. Auto 满档补齐（js/osu/osu-mode-standard.js）：滑条 tick、滑条尾判、转盘在 AT 下一律 PERFECT，
   不再按光标距离降级；四模式连测：狂点键盘 + 画布乱点，ACC 均为 100.00%，无 MISS、无断连。
4. 四张模式卡配图重做为霓虹炫技插画（img/osu/mode-*.jpg，1280×720）：
   std 洋红光环 + 流光滑条、taiko 金红双鼓 + 音波、catch 青绿水果 + 接盘、mania 紫蓝轨道 + 下落键阵；
   卡片右上角新增模式徽章（AIM / DRUM / CATCH / KEYS），各模式独立色相；中英双语文案同步升级
   （js/osu/osu-i18n.js、html/osu/osu.html、css/osu.css）。
5. sw.js 缓存版本 lzx-v5 → lzx-v6，旧图缓存随 activate 清理，回访不会再看到旧配图。
