import os, subprocess, time
os.environ['PLAYWRIGHT_BROWSERS_PATH']='/opt/pw-browsers'
from playwright.sync_api import sync_playwright
OUT='/tmp/claude-0/shots'
srv=subprocess.Popen(['node','server/server.js'], env=dict(os.environ, PORT='8813'), cwd='/home/claude/game')
time.sleep(0.8)
errs=[]
try:
  with sync_playwright() as p:
    br=p.chromium.launch()
    def page(name):
      ctx=br.new_context(viewport={'width':450,'height':800})
      pg=ctx.new_page(); pg.on('pageerror', lambda e: errs.append(name+' '+str(e)))
      pg.on('console', lambda m: errs.append(name+' '+m.text) if m.type=='error' and 'fonts' not in m.text else None)
      pg.route('https://fonts.googleapis.com/**', lambda r: r.fulfill(body='', content_type='text/css'))
      pg.goto('http://localhost:8813/'); pg.wait_for_selector('.title-btn')
      pg.evaluate(f"KV.App.profile.nick='{name}'")
      return pg
    A=page('Анна'); B=page('Борис')
    for pg in (A,B): pg.click('[data-act=play]'); pg.click('[data-act=team]')
    A.click('[data-act=netCreate]'); A.wait_for_selector('[data-act=copyCode]')
    code=A.get_attribute('[data-act=copyCode]','data-code'); print('room', code)
    B.fill('#netCode', code); B.click('[data-act=netJoin]'); B.wait_for_selector('text=Хост выбрал')
    A.wait_for_function("document.querySelectorAll('.card .dot').length===2")
    A.click('[data-act=netMap][data-id=crystal]'); B.wait_for_selector('text=Кристальные туннели')
    A.click('[data-act=netReady]'); B.click('[data-act=netReady]')
    A.wait_for_selector('[data-act=netStart]:not([disabled])'); A.screenshot(path=OUT+'/lobby.png'); A.click('[data-act=netStart]')
    A.wait_for_selector('[data-act=voteDiff][data-id=easy]'); B.wait_for_selector('[data-act=voteDiff]'); A.screenshot(path=OUT+'/vote.png')
    A.click('[data-act=voteDiff][data-id=easy]'); B.click('[data-act=voteDiff][data-id=easy]')
    A.wait_for_timeout(1500); print('ERRS', errs, A.evaluate('KV.App.curName'), A.inner_text('.toasts') if A.query_selector('.toasts') else '')
    A.wait_for_selector('#game'); B.wait_for_selector('#game'); A.wait_for_timeout(600)
    def scr(pg,x,z): return pg.evaluate(f"(()=>{{const R=KV.App.render,r=R.canvas.getBoundingClientRect();return [r.left+R.ox+{x}*R.S, r.top+R.oy+{z}*R.S];}})()")
    sp=A.evaluate("(()=>{const f=KV.App.match.field;return f.layout.spots.filter(s=>f.canPlace(s.x,s.z).ok)[0]})()")
    A.click('.hbtn[data-id=blaster]'); x,y=scr(A,sp['x'],sp['z']); A.mouse.move(x,y); A.mouse.down(); A.mouse.up()
    B.wait_for_function("KV.App.match.field.towers.length===1", timeout=5000)
    print('B sees tower owner', B.evaluate("KV.App.match.field.towers[0].owner"), 'coins A/B', A.evaluate("KV.App.match.field.coins"), B.evaluate("KV.App.match.field.coins"), 'diff', A.evaluate("KV.App.match.field.diffKey"))
    A.wait_for_selector('.tier', timeout=5000)
    A.click('.tier[data-br="0"][data-lvl="0"]'); A.click('[data-act=buy]')
    B.wait_for_function("KV.App.match.field.towers[0].up[0]===1", timeout=5000)
    B.click('[data-act=skip]'); A.wait_for_function("KV.App.match.field.waveNum===1", timeout=5000)
    A.wait_for_timeout(2500); A.screenshot(path=OUT+'/online_team.png')
    print('enemies on A', A.evaluate("KV.App.match.field.enemies.length"), 'wave', A.evaluate("KV.App.match.field.waveNum"))
    # выход в меню, дуэль по очереди
    for pg in (A,B):
      pg.click('[data-act=pause]'); pg.click('[data-m=quit]'); pg.wait_for_selector('.title-btn')
      pg.click('[data-act=duel]')
    A.click('[data-act=netQueue]'); A.wait_for_selector('text=Ищем соперника')
    B.click('[data-act=netQueue]')
    A.wait_for_selector('#dB'); B.wait_for_selector('#dB'); A.wait_for_timeout(9500)
    print('duel A', A.inner_text('.opp').replace('\n',' | '))
    A.click('#viewBtn'); A.wait_for_timeout(600); A.screenshot(path=OUT+'/online_duel_opp.png')
    B.click('[data-act=pause]'); B.click('[data-m=quit]')
    A.wait_for_selector('.result-title', timeout=8000); print('A result', A.inner_text('.result-title'), '|', A.inner_text('.modal .note'))
    br.close()
finally:
  srv.terminate()
print(errs or 'no errors')
