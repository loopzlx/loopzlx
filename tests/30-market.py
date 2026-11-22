import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/local/bin/chromium", args=["--no-sandbox"])
        pg = await b.new_page(viewport={"width":1440,"height":1000})
        errs=[]; pg.on("pageerror", lambda e: errs.append("E:"+str(e)))
        pg.on("console", lambda m: errs.append("C:"+m.text[:100]) if m.type=="error" else None)
        await pg.goto("http://localhost:8770/load.html"); await pg.wait_for_timeout(7500)
        await pg.click("#more-btn"); await pg.wait_for_timeout(400); await pg.click("[data-market-open]")
        await pg.wait_for_timeout(3000)
        print("ratio:", await pg.evaluate("()=>{const r=document.getElementById('mk-ratio');return r&&[r.textContent,document.getElementById('mk-ratio-state').textContent]}"))
        print("conv:", await pg.evaluate("()=>{const o=document.getElementById('mk-conv-out');return o&&o.textContent.slice(0,60)}"))
        # 改金额
        await pg.fill("#mk-conv-in","1000"); await pg.wait_for_timeout(300)
        print("conv1000:", await pg.evaluate("()=>document.getElementById('mk-conv-out').textContent.slice(0,40)"))
        # 对调
        await pg.click("[data-swap]"); await pg.wait_for_timeout(300)
        print("swap:", await pg.evaluate("()=>document.getElementById('mk-conv-out').textContent.slice(0,40)"))
        # 提醒按钮
        print("alerts:", await pg.evaluate("()=>document.querySelectorAll('.mk-alert').length"))
        # 截图整块
        await pg.evaluate("()=>document.getElementById('mk-ratio').closest('.mk-tools').scrollIntoView({block:'center'})")
        await pg.wait_for_timeout(500)
        await pg.screenshot(path="/tmp/v5-market.png")
        print("errs:", errs[:5])
        await b.close()
asyncio.run(main())
