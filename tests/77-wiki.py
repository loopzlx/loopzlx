import asyncio
import os, tempfile
PORT = os.environ.get("PORT", "8770")
OUT_DIR = os.environ.get("OUT_DIR", tempfile.gettempdir())
from playwright.async_api import async_playwright
fails = []
def check(name, ok, info=""):
    print(("PASS " if ok else "FAIL ") + name, info if not ok else "")
    if not ok: fails.append(name)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(os.environ.get("CHROMIUM") or None), args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 1440, "height": 900})
        pg = await ctx.new_page()
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/load.html"); await pg.wait_for_timeout(7000)
        n = await pg.evaluate("()=>document.querySelectorAll('#project-grid .project-item').length")
        check("6 project cards", n == 6, n)
        check("wiki card present", await pg.evaluate("()=>!!document.querySelector('.project-item[data-act=wiki]')"))
        imgs = await pg.evaluate("()=>[...document.querySelectorAll('#project-grid img')].map(i=>i.complete&&i.naturalWidth>0)")
        check("all covers loaded", all(imgs) and len(imgs) == 6, imgs)
        check("More menu has wiki link", await pg.evaluate("()=>!!document.querySelector('#more-panel a[href=\"wiki.html\"]')"))
        check("no market leftovers", await pg.evaluate("()=>!document.querySelector('[data-market-open],#market-layer')"))
        await pg.evaluate("()=>document.querySelector('.project-item[data-act=wiki]').click()"); await pg.wait_for_timeout(1200)
        check("wiki window open", await pg.evaluate("()=>!!document.querySelector('.lzx-wiki.open') && document.body.classList.contains('wiki-open')"))
        fr = [f for f in pg.frames if f.url.endswith("wiki.html?embed=1&t=dark")]
        check("wiki iframe loaded", len(fr) == 1, [f.url for f in pg.frames])
        w = fr[0]; werrs = []
        check("embed class", await w.evaluate("()=>document.documentElement.classList.contains('embed')"))
        check("wiki sections", await w.evaluate("()=>document.querySelectorAll('.art').length") >= 15)
        await w.fill("#q", "/gravity"); await w.wait_for_timeout(200)
        check("wiki search filters rows", await w.evaluate("()=>document.querySelectorAll('#commands tbody tr:not([hidden])').length") == 1)
        check("wiki 26 commands", await w.evaluate("()=>document.querySelectorAll('#commands tbody tr:not(.grp)').length") == 26)
        await pg.keyboard.press("Escape"); await pg.keyboard.press("Escape"); await pg.wait_for_timeout(300)
        check("Esc closes window", await pg.evaluate("()=>!document.querySelector('.lzx-wiki.open')"))
        await pg.click("#more-btn"); await pg.click("#more-panel a[href='wiki.html']"); await pg.wait_for_timeout(500)
        check("More link opens window", await pg.evaluate("()=>!!document.querySelector('.lzx-wiki.open')"))
        await w.evaluate("()=>document.getElementById('q').blur()"); await w.evaluate("()=>parent.postMessage('lzx-wiki-close', location.origin)"); await pg.wait_for_timeout(300)
        check("close message from iframe", await pg.evaluate("()=>!document.querySelector('.lzx-wiki.open')"))
        n = await pg.evaluate("()=>window.CyberAudioPlayer && window.CyberAudioPlayer.tracks ? window.CyberAudioPlayer.tracks().length : -1")
        check("playlist has 44 tracks", n == 44, n)
        check("no page errors", not errs, errs)
        await b.close()
    raise SystemExit(1 if fails else 0)
asyncio.run(main())
