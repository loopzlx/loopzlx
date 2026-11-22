import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/local/bin/chromium", args=["--no-sandbox"])
        pg = await b.new_page(viewport={"width":1440,"height":900})
        errs=[]
        pg.on("pageerror", lambda e: errs.append("E:"+str(e)))
        pg.on("console", lambda m: errs.append("C:"+m.text[:90]) if m.type=="error" and 'polygon' not in m.text and '404' not in m.text else None)
        await pg.goto("http://localhost:8770/load.html"); await pg.wait_for_timeout(7500)
        print("A page:", await pg.evaluate("()=>[!!window.LZXAch,!!window.LZXUIExtras,!!window.CyberTheme,document.querySelectorAll('nav button').length]"))
        print("B sw:", await pg.evaluate("()=>navigator.serviceWorker.getRegistrations().then(r=>r.length)"))
        # 主题循环仍工作（原按钮被拦截改开面板）
        await pg.click("#theme-toggle"); await pg.wait_for_timeout(300)
        await pg.click(".lzx-pk-item[data-theme=theme-ocean]"); await pg.wait_for_timeout(600)
        print("C theme:", await pg.evaluate("()=>document.documentElement.className"))
        await pg.evaluate("()=>CyberTheme.set('theme-cyber')"); await pg.wait_for_timeout(400)
        # 终端仍工作
        await pg.fill("#danmaku-input","/ls"); await pg.press("#danmaku-input","Enter"); await pg.wait_for_timeout(500)
        print("D term:", await pg.evaluate("()=>document.getElementById('log-content').textContent.slice(-60)"))
        # 移动端视口检查控件
        await pg.set_viewport_size({"width":390,"height":844}); await pg.wait_for_timeout(600)
        print("E mobile:", await pg.evaluate("()=>{const w=document.getElementById('audio-wrapper');const r=w.getBoundingClientRect();return [Math.round(r.width), Math.round(r.right)]}"))
        await pg.screenshot(path="/tmp/v5-mobile.png")
        print("errs:", errs[:5])
        await b.close()
asyncio.run(main())
