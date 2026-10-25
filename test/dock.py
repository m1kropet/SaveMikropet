import os
os.environ['PLAYWRIGHT_BROWSERS_PATH']='/opt/pw-browsers'
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
  b=p.chromium.launch(); pg=b.new_page(viewport={'width':450,'height':800})
  errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
  pg.route('https://fonts.googleapis.com/**', lambda r: r.fulfill(body='', content_type='text/css'))
  pg.goto('file:///home/claude/game/index.html'); pg.wait_for_selector('.title-btn')
  pg.evaluate("KV.App.startMatch({mode:'single',map:'lobby',diff:'normal',squad:['blaster','ice','dragon','storm'],players:[{id:'p1',name:'Т',color:'#45e0c0'}]})")
  pg.wait_for_selector('#game'); pg.wait_for_timeout(300)
  st=lambda: pg.evaluate("(()=>{const s=document.getElementById('stage').getBoundingClientRect(),d=document.getElementById('dock');return [Math.round(s.height),d.clientHeight,d.scrollHeight,parseFloat(getComputedStyle(d).fontSize)]})()")
  print('build', st()); pg.screenshot(path='/tmp/claude-0/shots/dock_build.png')
  pg.evaluate("(()=>{const m=KV.App.match,f=m.field;f.coins=600;const s=f.layout.spots[0];const r=f.cmd({type:'place',hero:'blaster',x:s.x,z:s.z});f.cmd({type:'upgrade',tower:r.tower.id,branch:0});m.select(r.tower.id);})()")
  pg.click('.tier[data-br="1"][data-lvl="0"]'); pg.wait_for_timeout(200)
  print('panel', st(), 'panel scroll', pg.evaluate("(()=>{const p=document.querySelector('.panel');return [p.clientHeight,p.scrollHeight]})()"))
  pg.screenshot(path='/tmp/claude-0/shots/dock_panel.png')
  pg.click('[data-act=close]')
  pg.evaluate("KV.App.go('menu')"); pg.click('[data-act=play]'); pg.wait_for_timeout(400); pg.click('[data-act=duel]'); pg.click('[data-act=start]'); pg.wait_for_selector('#dB'); pg.wait_for_timeout(500)
  print('duel', st(), 'ctrl buttons', pg.evaluate("document.querySelectorAll('#dock .ctrl').length")); pg.screenshot(path='/tmp/claude-0/shots/dock_duel.png')
  print(errs or 'ok'); b.close()
