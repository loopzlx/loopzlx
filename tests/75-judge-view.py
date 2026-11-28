import os, tempfile
PORT = os.environ.get("PORT", "8770")
OUT_DIR = os.environ.get("OUT_DIR", tempfile.gettempdir())
#!/usr/bin/env python3
"""v5.3 自检：osu!std 三档判定（无 PERFECT）+ 分区记忆（刷新回到原分区）+ 音频有声。"""
import asyncio, sys
from playwright.async_api import async_playwright

BASE = f"http://localhost:{PORT}"
ok = True


NET = os.environ.get("LZX_NET", "1") != "0"   # run.sh 探测不到外网时置 0


NET_AUDIO = True


def check(name, cond, detail="", net=False):
    global ok
    if net and not (NET and NET_AUDIO):                         # 依赖外网（音频直链 / GitHub API）的检查，离线环境跳过
        print("  skip " + name + "  (offline)")
        return
    print(("  ok   " if cond else "  FAIL ") + name + ("  " + str(detail) if detail else ""))
    if not cond:
        ok = False


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(os.environ.get("CHROMIUM") or None), args=["--no-sandbox"])

        pg = await b.new_page(viewport={"width": 1440, "height": 900})
        cors = []
        pg.on("console", lambda m: cors.append(m.text) if ("CORS" in m.text or "zeroes" in m.text) else None)
        await pg.goto(BASE + "/load.html")
        await pg.wait_for_timeout(7000)
        global NET
        if NET:   # 浏览器里真能访问外网才跑依赖外网的检查（命令行能连不代表无头浏览器能连）
            NET = await pg.evaluate("() => fetch('https://api.github.com/').then(() => true).catch(() => false)")
            global NET_AUDIO   # 音乐直链的域名（网盘解析服务）单独探测：GitHub 通不代表它通
            NET_AUDIO = await pg.evaluate("() => fetch('https://lz.qaiu.top/', { mode: 'no-cors' }).then(() => true).catch(() => false)")

        # --- 音频 ---
        audio = await pg.evaluate("""async () => {
            const au = document.querySelector('audio');
            if (!au) return null;
            au.muted = false; au.volume = 1;
            try { await au.play(); } catch (e) { return 'playfail:' + e.message; }
            await new Promise(r => setTimeout(r, 1200));
            return { t: au.currentTime, paused: au.paused };
        }""")
        check("audio 能播放", isinstance(audio, dict) and audio and audio["t"] > 0.2, audio, net=True)
        check("无 CORS 零输出警告", len(cors) == 0, cors[:1], net=True)

        # --- std 判定 ---
        await pg.evaluate("() => window.OsuWarp.open()")
        await pg.wait_for_function("() => window.OSU && OSU.game && OSU.S", timeout=45000)
        r = await pg.evaluate("""() => {
            OSU.game.start(OSU.bm.demoChart('std'), 'std');
            OSU.addHit('PERFECT', 0, 0); OSU.addHit('GREAT', 0, 0);
            OSU.addHit('GOOD', 0, 0); OSU.addHit('MISS', 0, 0);
            return { counts: Object.assign({}, OSU.S.counts), norm: OSU.normJudge('PERFECT') };
        }""")
        c = r["counts"]
        check("std 无 PERFECT", "PERFECT" not in c, c)
        check("std 三档齐全", all(k in c for k in ("GREAT", "OK", "MEH")), c)
        check("PERFECT 归一为 GREAT", r["norm"] == "GREAT", r["norm"])

        t = await pg.evaluate("""() => {
            OSU.game.start(OSU.bm.demoChart('taiko'), 'taiko');
            OSU.addHit('PERFECT', 0, 0);
            return Object.assign({}, OSU.S.counts);
        }""")
        check("taiko 仍保留 PERFECT", "PERFECT" in t, t)

        # --- 分区记忆 ---
        last = await pg.evaluate("() => localStorage.getItem('lzx.lastview')")
        check("写入 lzx.lastview", last == "osu", last)
        await pg.reload()
        await pg.wait_for_timeout(9000)
        back = await pg.evaluate("""() => {
            return { open: document.body.classList.contains('osu-open'),
                     view: localStorage.getItem('lzx.lastview'),
                     osu: !!window.OSU };
        }""")
        check("刷新后自动回到 osu", back["open"] and back["osu"], back)
        on = await pg.evaluate("() => window.LZXView && window.LZXView.remember")
        check("记住分区开关可读", on is True or on == "1" or on is None, on)

        # --- 成就墙 / 主题面板结构 ---
        await pg.evaluate("() => { document.body.classList.remove('osu-open'); }")
        await pg.evaluate("() => window.LZXUIExtras.achWall()")
        await pg.wait_for_timeout(600)
        aw = await pg.evaluate("""() => ({
            items: document.querySelectorAll('.lzx-aw-item').length,
            badge: document.querySelectorAll('.lzx-aw-badge').length,
            ring: !!(document.querySelector('.lzx-aw-prog .ring-fg')),
            nan: /NaN/.test(document.querySelector('.lzx-aw-sum').textContent)
        })""")
        check("成就墙 18 项 + 徽章 + 环形", aw["items"] == 18 and aw["badge"] == 18 and aw["ring"], aw)
        check("成就墙无 NaN", aw["nan"] is False, aw)

        await pg.evaluate("() => document.querySelector('.lzx-aw-x').click()")
        await pg.wait_for_timeout(300)
        await pg.evaluate("() => document.getElementById('theme-toggle').click()")
        await pg.wait_for_timeout(500)
        pk = await pg.evaluate("""() => ({
            items: document.querySelectorAll('.lzx-pk-item').length,
            prev: document.querySelectorAll('.lzx-pk-prev').length,
            resume: !!document.getElementById('lzx-pk-resume')
        })""")
        check("主题面板 8 项 + 预览块 + RESUME 开关",
              pk["items"] == 8 and pk["prev"] == 8 and pk["resume"], pk)

        await b.close()

    # --- 手机端不溢出 / 底部层不重叠 ---
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(os.environ.get("CHROMIUM") or None), args=["--no-sandbox"])
        m = await b.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
        await m.goto(BASE + "/load.html")
        await m.wait_for_timeout(6500)
        box = await m.evaluate("""() => {
            const de = document.documentElement;
            const r = el => { const b = el.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; };
            const pl = document.querySelector('.audio-player-wrapper');
            const lw = document.getElementById('log-window');
            /* 日志窗口现在随页面滚动（非 fixed），不会浮在播放器上；只有它是 fixed 时才需要比较矩形是否相交 */
            const lwFixed = lw && getComputedStyle(lw).position === 'fixed';
            const a = pl && r(pl), c = lw && r(lw);
            const hit = (a && c && lwFixed) ? !(a[2] <= c[0] || c[2] <= a[0] || a[3] <= c[1] || c[3] <= a[1]) : false;
            return { sw: de.scrollWidth, cw: de.clientWidth,
                     overlap: (pl && lw) ? hit : null,
                     blurred: getComputedStyle(lw).backdropFilter };
        }""")
        check("390px 无横向溢出", box["sw"] <= box["cw"] + 2, box)
        check("播放器与日志不重叠", box["overlap"] is False, box)
        check("手机端关掉 backdrop-filter", box["blurred"] in ("none", ""), box["blurred"])
        await b.close()

    print("PASS" if ok else "FAIL")
    sys.exit(0 if ok else 1)


asyncio.run(main())
