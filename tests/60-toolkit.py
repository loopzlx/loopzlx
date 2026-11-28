import asyncio
import os, tempfile
PORT = os.environ.get("PORT", "8770")
OUT_DIR = os.environ.get("OUT_DIR", tempfile.gettempdir())
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(os.environ.get("CHROMIUM") or None), args=["--no-sandbox"])
        pg = await b.new_page(viewport={"width":1440,"height":900})
        errs=[]; pg.on("pageerror", lambda e: errs.append("E:"+str(e)))
        await pg.goto(f"http://localhost:{PORT}/load.html"); await pg.wait_for_timeout(7000)
        # 骨架是否被替换
        print("skel:", await pg.evaluate("()=>!!document.querySelector('.lzx-skel')"))
        print("tool:", await pg.evaluate("()=>!!window.LZXTool"))
        # 终端 /diag
        await pg.fill('#danmaku-input', '/diag')
        await pg.press('#danmaku-input', 'Enter')
        await pg.wait_for_timeout(2500)
        log = await pg.evaluate("()=>document.getElementById('log-window').innerText")
        print("diaglog:", " | ".join([l for l in log.split('\n') if 'ok]' in l or 'FAIL' in l or 'Self-check' in l][-6:]))
        # 关于面板
        await pg.evaluate("()=>window.LZXTool.open('about')")
        await pg.wait_for_timeout(400)
        print("about rows:", await pg.evaluate("()=>document.querySelectorAll('.lzx-about-rows > div').length"))
        await pg.screenshot(path=os.path.join(OUT_DIR, "v52-about.png"))
        # 存档码导出
        r = await pg.evaluate("async()=>{const r=await window.LZXTool.exportCode(true);return [r.count, r.bytes];}")
        print("export:", r)
        # 切到存档页导出并校验
        await pg.evaluate("()=>window.LZXTool.tabs('save')")
        await pg.wait_for_timeout(300)
        await pg.evaluate("()=>document.getElementById('lzx-do-export').click()")
        await pg.wait_for_timeout(900)
        code = await pg.evaluate("()=>document.getElementById('lzx-code-out').value")
        print("code head:", code[:22], "len", len(code))
        print("prefix:", await pg.evaluate("()=>document.getElementById('lzx-save-msg').textContent"))
        # 校验自己生成的码
        await pg.evaluate("(c)=>{document.getElementById('lzx-code-in').value=c;}", code)
        await pg.evaluate("()=>document.getElementById('lzx-do-check').click()")
        await pg.wait_for_timeout(800)
        print("check:", await pg.evaluate("()=>document.getElementById('lzx-save-msg').textContent"))
        # 自检页
        await pg.evaluate("()=>window.LZXTool.tabs('diag')")
        await pg.wait_for_timeout(2200)
        print("diag rows:", await pg.evaluate("()=>document.querySelectorAll('.lzx-diag-row').length"), 
              "sum:", await pg.evaluate("()=>document.querySelector('.lzx-diag-sum').textContent"))
        print("diag detail:", (await pg.evaluate("()=>[...document.querySelectorAll('.lzx-diag-row')].map(r=>r.className.replace('lzx-diag-row ','')+':'+r.querySelector('span').textContent+':'+r.querySelector('em').textContent)")).__str__()[:400])
        await pg.screenshot(path=os.path.join(OUT_DIR, "v52-diag.png"))
        await pg.evaluate("()=>window.LZXTool.close()")
        # 无障碍
        print("aria:", await pg.evaluate("()=>[document.querySelectorAll('[aria-label]').length, document.querySelectorAll('button, a').length]"))
        print("errs:", errs[:4])
        await b.close()
asyncio.run(main())
