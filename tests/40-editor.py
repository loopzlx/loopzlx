import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/local/bin/chromium", args=["--no-sandbox"])
        pg = await b.new_page(viewport={"width":1440,"height":900})
        errs=[]; pg.on("pageerror", lambda e: errs.append("E:"+str(e)))
        pg.on("console", lambda m: errs.append("C:"+m.text[:100]) if m.type=="error" else None)
        await pg.goto("http://localhost:8770/load.html"); await pg.wait_for_timeout(7000)
        await pg.evaluate("window.CelesteWarp.open()")
        await pg.wait_for_function("()=>window.Celeste && CelesteWarp.app()", timeout=20000)
        await pg.wait_for_timeout(600)
        await pg.evaluate("()=>Celeste.Editor.open()")
        await pg.wait_for_timeout(700)
        print("btns:", await pg.evaluate("()=>['cl-edit-undo','cl-edit-redo','cl-edit-share','cl-edit-lib'].filter(i=>!document.getElementById(i))"))
        # 画一格
        await pg.evaluate("""()=>{const c=document.getElementById('cl-edit-canvas');const r=c.getBoundingClientRect();
          c.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:r.left+r.width*0.3,clientY:r.top+r.height*0.7,button:0,pointerId:1}));}""")
        await pg.wait_for_timeout(200)
        # 撤销/重做
        await pg.click("#cl-edit-undo"); await pg.wait_for_timeout(200)
        await pg.click("#cl-edit-redo"); await pg.wait_for_timeout(200)
        print("hint1:", await pg.evaluate("()=>document.querySelector('.cl-edit-hint').textContent"))
        # 校验：把终点删到 (0,0) 前先测当前（1A 应通过？终点在 106,16 下方有平台 → 通过）
        await pg.click("#cl-edit-play"); await pg.wait_for_timeout(400)
        print("hint-play:", await pg.evaluate("()=>document.querySelector('.cl-edit-hint').textContent"))
        # 分享
        await pg.evaluate("()=>Celeste.Editor.open()"); await pg.wait_for_timeout(500)
        await pg.click("#cl-edit-share"); await pg.wait_for_timeout(500)
        print("hash:", await pg.evaluate("()=>location.hash.slice(0,26)+' len='+location.hash.length"))
        print("sharebox:", await pg.evaluate("()=>{const o=document.querySelector('.cl-edit-sharebox');return o?o.className+'|'+o.querySelector('textarea').value.length:'none'}"))
        print("clip:", await pg.evaluate("()=>!!navigator.clipboard"))
        # 图库
        await pg.click("#cl-edit-lib"); await pg.wait_for_timeout(400)
        await pg.evaluate("""()=>document.querySelector('[data-act="save-cur"]').click()"""); await pg.wait_for_timeout(400)
        print("lib:", await pg.evaluate("()=>JSON.parse(localStorage.getItem('celeste.lib.v1')||'[]').map(x=>x.name)"))
        print("librows:", await pg.evaluate("()=>document.querySelectorAll('.cl-edit-librow').length"))
        await pg.screenshot(path="/tmp/v5-lib.png")
        print("errs:", errs[:5])
        await b.close()
asyncio.run(main())
