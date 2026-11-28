"""存档码：分享链接 + 二维码 + 打开链接自动识别（不自动写入）+ 低功耗开关随存档同步。"""
import asyncio, os, tempfile
from playwright.async_api import async_playwright
PORT = os.environ.get("PORT", "8770")
OUT_DIR = os.environ.get("OUT_DIR", tempfile.gettempdir())
ok = {}

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(os.environ.get("CHROMIUM") or None), args=["--no-sandbox"])
        errs = []
        # ---- 设备 A：生成存档 / 链接 / 二维码 ----
        a = await (await b.new_context(viewport={"width": 1280, "height": 900})).new_page()
        a.on("pageerror", lambda e: errs.append("A:" + str(e)[:100]))
        await a.goto(f"http://localhost:{PORT}/load.html"); await a.wait_for_timeout(6500)
        await a.evaluate("()=>{localStorage.setItem('lzx.lowpower','on');localStorage.setItem('lzx.lang','zh');}")
        await a.evaluate("()=>LZXTool.open('save')"); await a.wait_for_timeout(600)
        await a.click("#lzx-do-export"); await a.wait_for_timeout(600)
        code = await a.input_value("#lzx-code-out")
        ok["export ok"] = code.startswith("LZX1")
        ok["share buttons enabled"] = await a.evaluate("()=>!document.getElementById('lzx-do-link').disabled && !document.getElementById('lzx-do-qr').disabled")
        link = await a.evaluate("(c)=>LZXTool.shareLink(c)", code)
        ok["link has #lzx= and no query"] = "#lzx=" + code in link and "?" not in link.split("#")[0]
        await a.click("#lzx-do-qr"); await a.wait_for_timeout(700)
        ok["qr svg shown"] = await a.evaluate("()=>{const b=document.getElementById('lzx-qr-box');return !b.hidden && !!b.querySelector('svg path')}")
        await a.locator("#lzx-qr-box").screenshot(path=os.path.join(OUT_DIR, "share-qr.png"))
        try:
            import cv2
            img = cv2.imread(os.path.join(OUT_DIR, "share-qr.png"))
            img = cv2.copyMakeBorder(img, 20, 20, 20, 20, cv2.BORDER_CONSTANT, value=(255, 255, 255))
            txt = cv2.QRCodeDetectorAruco().detectAndDecode(img)[0]
            ok["qr decodes to the share link"] = (txt == link)
        except ImportError:
            print("skip qr decode (cv2 missing)")
        await a.click("#lzx-do-qr"); await a.wait_for_timeout(200)
        ok["qr toggles off"] = await a.evaluate("()=>document.getElementById('lzx-qr-box').hidden")

        # ---- 设备 B：全新环境打开分享链接 ----
        bctx = await b.new_context(viewport={"width": 1280, "height": 900})
        bp = await bctx.new_page()
        bp.on("pageerror", lambda e: errs.append("B:" + str(e)[:100]))
        dialogs = []
        bp.on("dialog", lambda d: (dialogs.append(d.message[:40]), asyncio.ensure_future(d.accept())))
        await bp.goto(link); await bp.wait_for_timeout(9000)
        ok["hash removed from url"] = await bp.evaluate("()=>location.hash===''")
        ok["panel opened + prefilled"] = await bp.evaluate("()=>{const t=document.getElementById('lzx-code-in');return !!t && t.value.startsWith('LZX1')}")
        ok["share notice shown"] = await bp.evaluate("()=>!!document.querySelector('.lzx-share-flag')")
        ok["validated, import enabled"] = await bp.evaluate("()=>!document.getElementById('lzx-do-import').disabled && /有效存档/.test(document.getElementById('lzx-save-msg').textContent)")
        ok["NOT auto-applied"] = await bp.evaluate("()=>localStorage.getItem('lzx.lowpower')===null")
        await bp.click("#lzx-do-import"); await bp.wait_for_timeout(1500)
        ok["confirm dialog was shown"] = len(dialogs) >= 1
        ok["applied after confirm (lowpower synced)"] = await bp.evaluate("()=>localStorage.getItem('lzx.lowpower')==='on'")

        # ---- 乱写的链接不应报错 ----
        cp = await (await b.new_context()).new_page()
        cp.on("pageerror", lambda e: errs.append("C:" + str(e)[:100]))
        await cp.goto(f"http://localhost:{PORT}/load.html#lzx=NOT-A-VALID-CODE"); await cp.wait_for_timeout(8000)
        ok["bad link -> rejected, import disabled"] = await cp.evaluate("()=>document.getElementById('lzx-do-import')?.disabled===true")

        for k, v in ok.items(): print(("PASS " if v else "FAIL ") + k)
        print("errs:", errs[:4])
        await b.close()
        raise SystemExit(0 if all(ok.values()) and not errs else 1)
asyncio.run(main())
