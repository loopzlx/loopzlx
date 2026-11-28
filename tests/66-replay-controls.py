import asyncio, os
from playwright.async_api import async_playwright
PORT = os.environ.get("PORT", "8770")
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--no-sandbox"])
        pg = await b.new_page(viewport={"width":1440,"height":900})
        errs=[]; pg.on("pageerror", lambda e: errs.append("E:"+str(e)[:120]))
        await pg.goto(f"http://localhost:{PORT}/load.html"); await pg.wait_for_timeout(6500)
        await pg.evaluate("window.OsuWarp.open()")
        await pg.wait_for_function("()=>window.OSU && OSU.game && OSU.replay", timeout=25000)
        await pg.wait_for_timeout(1200)
        # 录一局：AT 自动打 4 个圈
        await pg.evaluate("""()=>{const O=window.OSU;
          const ch={title:'SHORT',version:'1',bpm:180,length:5,od:5,cs:4,hp:5,demo:false,creator:'T',
            objects:[{type:'circle',time:2,x:0.4,y:0.4},{type:'circle',time:2.4,x:0.5,y:0.5},{type:'circle',time:2.8,x:0.6,y:0.5},{type:'circle',time:3.2,x:0.5,y:0.6}]};
          O.S.mods={AT:1}; O.game.start(ch,'std');}""")
        await pg.wait_for_timeout(9000)
        rec = await pg.evaluate("()=>{const r=OSU.replay.latest();return r?r.events.length:0}")
        ok = {}
        ok["recorded"] = rec == 4
        await pg.evaluate("()=>document.getElementById('osu-btn-replay').click()"); await pg.wait_for_timeout(1500)
        bar = lambda: pg.evaluate("()=>{const b=document.getElementById('osu-replay-bar');return b&&!b.hidden}")
        ok["bar shown in replay"] = await bar()
        # 倍速
        await pg.click(".orp-rate[data-rate='4']"); await pg.wait_for_timeout(200)
        ok["rate=4"] = await pg.evaluate("()=>OSU.S.replay.rate===4")
        # 暂停：时间应不再前进
        await pg.click("#orp-toggle"); await pg.wait_for_timeout(300)
        t1 = await pg.evaluate("()=>OSU.S.replay.t"); await pg.wait_for_timeout(600)
        t2 = await pg.evaluate("()=>OSU.S.replay.t")
        ok["hold freezes clock"] = abs(t2 - t1) < 0.01
        # 快进到结尾附近：4 个判定应都重演
        await pg.evaluate("()=>OSU.replay.seek(OSU.S.songEnd-0.5)"); await pg.wait_for_timeout(300)
        ok["seek end -> judged 4"] = await pg.evaluate("()=>OSU.S.judged===4")
        ok["seek keeps rate/hold"] = await pg.evaluate("()=>OSU.S.replay.rate===4&&OSU.S.replay.hold===true")
        # 往回拖到 0：状态应被重置
        await pg.evaluate("()=>OSU.replay.seek(0)"); await pg.wait_for_timeout(300)
        ok["seek 0 -> judged 0"] = await pg.evaluate("()=>OSU.S.judged===0&&OSU.S.score===0&&OSU.S.combo===0")
        # 中间：只重演 t 之前的判定
        await pg.evaluate("()=>OSU.replay.seek(2.5)"); await pg.wait_for_timeout(200)
        ok["seek 2.5 -> judged 2"] = await pg.evaluate("()=>OSU.S.judged===2")
        # 键盘 ← → 快进快退 5s
        t0 = await pg.evaluate("()=>OSU.S.replay.t"); await pg.keyboard.press("ArrowRight"); await pg.wait_for_timeout(200)
        ok["ArrowRight +5s"] = await pg.evaluate("(t0)=>Math.abs(OSU.S.replay.t-(t0+5))<0.3 || OSU.S.replay.t>=OSU.S.songEnd-0.01", t0)
        # 回放里按键不应产生新判定（输入不接管）
        await pg.evaluate("()=>OSU.replay.seek(0)"); await pg.wait_for_timeout(200)
        for k in "zxcvasdf": await pg.keyboard.press(k)
        await pg.mouse.click(720, 450); await pg.wait_for_timeout(200)
        ok["input ignored in replay"] = await pg.evaluate("()=>OSU.S.judged===0")
        # 继续播放到结束，退出后控制条隐藏
        await pg.click("#orp-toggle"); await pg.wait_for_timeout(5000)
        ok["replay ended"] = await pg.evaluate("()=>!OSU.S.replay")
        ok["bar hidden after"] = not await bar()
        for k, v in ok.items(): print(("PASS " if v else "FAIL ") + k)
        print("errs:", errs[:4])
        await b.close()
        raise SystemExit(0 if all(ok.values()) and not errs else 1)
asyncio.run(main())
