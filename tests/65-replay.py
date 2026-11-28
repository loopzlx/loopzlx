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
        pg.on("response", lambda r: errs.append("404:"+r.url.split('/')[-1]) if r.status==404 else None)
        await pg.goto(f"http://localhost:{PORT}/load.html"); await pg.wait_for_timeout(6500)
        await pg.evaluate("window.OsuWarp.open()")
        await pg.wait_for_function("()=>window.OSU && OSU.game && OSU.replay", timeout=25000)
        await pg.wait_for_timeout(1200)
        await pg.evaluate("""()=>{
          const O=window.OSU;
          const ch={title:'SHORT',version:'1',bpm:180,length:5,od:5,cs:4,hp:5,demo:false,creator:'T',
            objects:[{type:'circle',time:2,x:0.4,y:0.4},{type:'circle',time:2.4,x:0.5,y:0.5},{type:'circle',time:2.8,x:0.6,y:0.5},{type:'circle',time:3.2,x:0.5,y:0.6}]};
          O.S.mods={AT:1};
          O.game.start(ch,'std');
        }""")
        await pg.wait_for_timeout(9000)
        print("view:", await pg.evaluate("()=>[OSU.S.view, OSU.S.score, OSU.S.judged]"))
        print("btn:", await pg.evaluate("()=>{const b=document.getElementById('osu-btn-replay');return [b.hidden, b.textContent];}"))
        print("rec:", await pg.evaluate("()=>{const r=OSU.replay.latest();return r?[r.title,r.score,r.events.length]:null;}"))
        await pg.evaluate("()=>document.getElementById('osu-btn-replay').click()")
        await pg.wait_for_timeout(2000)
        print("playing:", await pg.evaluate("()=>[!!OSU.S.replay, OSU.S.view]"))
        await pg.wait_for_timeout(7000)
        print("end:", await pg.evaluate("()=>[!!OSU.S.replay, OSU.S.view, OSU.S.judged]"))
        await pg.screenshot(path=os.path.join(OUT_DIR, "v52-replay2.png"))
        print("errs:", [e for e in errs if e.startswith('E:') or e.startswith('404:')][:6])
        await b.close()
asyncio.run(main())
