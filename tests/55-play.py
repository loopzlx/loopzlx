import os, tempfile
PORT = os.environ.get("PORT", "8770")
OUT_DIR = os.environ.get("OUT_DIR", tempfile.gettempdir())
import asyncio, time
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(os.environ.get("CHROMIUM") or None), args=["--no-sandbox"])
        pg = await b.new_page(viewport={"width":1440,"height":900})
        errs=[]; pg.on("pageerror", lambda e: errs.append("E:"+str(e)))
        await pg.goto(f"http://localhost:{PORT}/load.html"); await pg.wait_for_timeout(7000)
        # --- celeste 通关回归
        await pg.evaluate("window.CelesteWarp.open()")
        await pg.wait_for_function("()=>window.Celeste && CelesteWarp.app()", timeout=20000)
        await pg.wait_for_timeout(300)
        await pg.evaluate("()=>CelesteWarp.app().restart()"); await pg.wait_for_timeout(300)
        await pg.keyboard.down("ArrowRight"); t0=time.time(); lastx=0; stuck=0; i=0
        while time.time()-t0<40:
            if await pg.evaluate("()=>CelesteWarp.app().level.finished"): break
            st = await pg.evaluate("()=>{const a=CelesteWarp.app();return {x:Math.round(a.player.x),g:a.player.onGround,dead:a.player.dead,d:a.player.Dashes}}")
            if st["dead"]:
                await pg.wait_for_timeout(900); lastx=0; continue
            if abs(st["x"]-lastx)<4: stuck+=1
            else: stuck=0
            lastx=st["x"]
            await pg.keyboard.down("Space"); await pg.wait_for_timeout(140); await pg.keyboard.up("Space")
            if st["d"]>0 and (stuck>=1 or i%3==0):
                await pg.keyboard.press("KeyZ"); await pg.wait_for_timeout(180)
            await pg.wait_for_timeout(150); i+=1
        await pg.keyboard.up("ArrowRight"); await pg.wait_for_timeout(300)
        print("celeste:", await pg.evaluate("()=>{const a=CelesteWarp.app();return {fin:a.level.finished,sec:+a.level.time.toFixed(2),deaths:a.level.deaths,pb:(document.getElementById('cl-over-pb')||{}).textContent}}"))
        # 编辑器截图
        await pg.evaluate("()=>Celeste.Editor.open()"); await pg.wait_for_timeout(700)
        await pg.screenshot(path=os.path.join(OUT_DIR, "final-editor.png"))
        await pg.evaluate("()=>Celeste.Editor.close()"); await pg.wait_for_timeout(400)
        # --- osu 开局 20 秒
        await pg.evaluate("()=>CelesteWarp.close()"); await pg.wait_for_timeout(400)
        await pg.evaluate("window.OsuWarp.open()")
        await pg.wait_for_function("()=>window.OSU && OSU.game", timeout=25000)
        await pg.wait_for_timeout(1000)
        await pg.evaluate("()=>{const O=window.OSU,S=O.S;S.chart=O.bm.demoChart('std');S.mode='std';O.game.start(S.chart,'std')}")
        t1=time.time()
        while time.time()-t1<8:
            await pg.keyboard.press("KeyZ"); await pg.wait_for_timeout(500)
        print("osu state:", await pg.evaluate("()=>{const S=window.OSU.S;return {view:S.view,time:+S.songTime.toFixed(1),score:S.score,notes:S.notes?S.notes.length:0}}"))
        print("errs:", errs[:6])
        await b.close()
asyncio.run(main())
