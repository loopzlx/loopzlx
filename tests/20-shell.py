import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/local/bin/chromium", args=["--no-sandbox"])
        pg = await b.new_page(viewport={"width":1440,"height":900})
        errs=[]; pg.on("pageerror", lambda e: errs.append("E:"+str(e)))
        pg.on("console", lambda m: errs.append("C:"+m.text) if m.type=="error" else None)
        await pg.goto("http://localhost:8770/load.html"); await pg.wait_for_timeout(7500)
        print("spec:", await pg.evaluate("()=>{const c=document.getElementById('lzx-spec');return c?[c.width,c.height,c.clientWidth]:null}"))
        print("extras:", await pg.evaluate("()=>!!window.LZXUIExtras"))
        # 主题面板
        await pg.click("#theme-toggle"); await pg.wait_for_timeout(500)
        print("picker:", await pg.evaluate("()=>!!document.querySelector('.lzx-picker.show')"),
              await pg.evaluate("()=>document.querySelectorAll('.lzx-pk-item').length"))
        await pg.screenshot(path="/tmp/v5-picker.png")
        await pg.click(".lzx-pk-item[data-theme=theme-paper]"); await pg.wait_for_timeout(700)
        print("theme:", await pg.evaluate("()=>document.documentElement.className + '|' + localStorage.getItem('theme')"))
        await pg.screenshot(path="/tmp/v5-paper.png")
        await pg.keyboard.press("Escape"); await pg.wait_for_timeout(300)
        print("picker closed:", await pg.evaluate("()=>!document.querySelector('.lzx-picker.show')"))
        # 成就墙
        await pg.click("#ach-toggle"); await pg.wait_for_timeout(500)
        print("wall:", await pg.evaluate("()=>document.querySelectorAll('.lzx-achwall.show .lzx-aw-item').length"))
        await pg.screenshot(path="/tmp/v5-wall.png")
        await pg.keyboard.press("Escape"); await pg.wait_for_timeout(200)
        # 播放器
        print("btns:", await pg.evaluate("()=>['prev-btn','next-btn','shuffle-btn','repeat-btn','vol-btn','vol-range'].filter(i=>!document.getElementById(i))"))
        await pg.click("#shuffle-btn"); await pg.click("#repeat-btn"); await pg.wait_for_timeout(200)
        print("state:", await pg.evaluate("()=>CyberAudioPlayer.state()"))
        # 切回深色
        await pg.evaluate("()=>CyberTheme.set('theme-cyber')"); await pg.wait_for_timeout(600)
        print("errs:", errs[:6])
        await b.close()
asyncio.run(main())
