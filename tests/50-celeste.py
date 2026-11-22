import asyncio, time
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/local/bin/chromium", args=["--no-sandbox"])
        pg = await b.new_page(viewport={"width":1280,"height":720})
        errs=[]; pg.on("pageerror", lambda e: errs.append("E:"+str(e)))
        await pg.goto("http://localhost:8770/load.html"); await pg.wait_for_timeout(7000)
        # More 菜单里 celeste 已删
        await pg.click("#more-btn"); await pg.wait_for_timeout(400)
        print("more items:", await pg.evaluate("()=>document.querySelectorAll('#more-panel a').length"))
        print("celeste in more:", await pg.evaluate("()=>!!document.querySelector('#more-panel [data-celeste-open]')"))
        await pg.keyboard.press("Escape"); await pg.wait_for_timeout(200)
        # 从 gamehub 进 celeste
        await pg.click("#more-btn"); await pg.wait_for_timeout(300)
        await pg.evaluate("()=>document.querySelector('[data-gamehub-open]').click()"); await pg.wait_for_timeout(2500)
        print("gh cards:", await pg.evaluate("()=>document.querySelectorAll('.gh-card').length"))
        await pg.evaluate("()=>document.querySelector('.gh-card-cel').click()"); await pg.wait_for_timeout(2500)
        await pg.wait_for_function("()=>window.Celeste && CelesteWarp.app()", timeout=25000)
        await pg.wait_for_timeout(600)
        # 开按键叠层 + 碰撞框
        await pg.evaluate("()=>{Celeste.settings.mods.keyOverlay=true;Celeste.settings.mods.debugHit=true;}")
        await pg.keyboard.down("ArrowRight"); await pg.wait_for_timeout(700)
        print("keys:", await pg.evaluate("()=>{const k=document.getElementById('cl-keys');return k?[k.className,k.querySelectorAll('i.on').length]:null}"))
        await pg.screenshot(path="/tmp/v51-keys.png")
        await pg.keyboard.up("ArrowRight")
        # 通关看 splits
        await pg.evaluate("()=>CelesteWarp.app().restart()"); await pg.wait_for_timeout(300)
        await pg.keyboard.down("ArrowRight"); t0=time.time(); lastx=0; stuck=0
        while time.time()-t0<40:
            if await pg.evaluate("()=>CelesteWarp.app().level.finished"): break
            st = await pg.evaluate("()=>{const a=CelesteWarp.app();return {x:Math.round(a.player.x),dead:a.player.dead,d:a.player.Dashes}}")
            if st["dead"]: await pg.wait_for_timeout(900); lastx=0; continue
            stuck = stuck+1 if abs(st["x"]-lastx)<4 else 0
            lastx = st["x"]
            await pg.keyboard.down("Space"); await pg.wait_for_timeout(140); await pg.keyboard.up("Space")
            if st["d"]>0 and stuck>=1: await pg.keyboard.press("KeyZ"); await pg.wait_for_timeout(180)
            await pg.wait_for_timeout(150)
        await pg.keyboard.up("ArrowRight"); await pg.wait_for_timeout(600)
        print("splits:", await pg.evaluate("()=>{const a=CelesteWarp.app();return [a.splits.length, document.getElementById('cl-over-splits').textContent.slice(0,80)]}"))
        await pg.screenshot(path="/tmp/v51-splits.png")
        print("errs:", errs[:4])
        await b.close()
asyncio.run(main())
