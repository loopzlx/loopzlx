import asyncio, time
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/local/bin/chromium", args=["--no-sandbox"])
        pg = await b.new_page(viewport={"width":1280,"height":720})
        errs=[]; pg.on("pageerror", lambda e: errs.append("E:"+str(e)))
        await pg.goto("http://localhost:8770/load.html"); await pg.wait_for_timeout(7000)
        await pg.evaluate("window.CelesteWarp.open()")
        await pg.wait_for_function("()=>window.Celeste && CelesteWarp.app()", timeout=20000)
        await pg.wait_for_timeout(400)
        # 通关一次生成影子
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
        await pg.keyboard.up("ArrowRight"); await pg.wait_for_timeout(400)
        print("fin:", await pg.evaluate("()=>{const a=CelesteWarp.app();return [a.level.finished, a.rec.length]}"))
        print("ghost storage:", await pg.evaluate("()=>{const g=JSON.parse(localStorage.getItem('celeste.ghost.v1')||'{}');return Object.keys(g).map(k=>k+' '+g[k].f.length)}"))
        # restart 后影子载入
        await pg.evaluate("()=>CelesteWarp.app().restart()"); await pg.wait_for_timeout(500)
        print("ghost:", await pg.evaluate("()=>{const a=CelesteWarp.app();return a.ghost?[a.ghost.t, a.ghost.f.length]:null}"))
        await pg.keyboard.down("ArrowRight"); await pg.wait_for_timeout(1500); await pg.keyboard.up("ArrowRight")
        await pg.wait_for_timeout(200)
        print("ghostIdx:", await pg.evaluate("()=>CelesteWarp.app().ghostIdx"))
        await pg.screenshot(path="/tmp/v5-ghost.png")
        print("errs:", errs[:4])
        await b.close()
asyncio.run(main())
