import os
os.environ['PLAYWRIGHT_BROWSERS_PATH']='/opt/pw-browsers'
from playwright.sync_api import sync_playwright
ROOT='/home/claude/game'
with sync_playwright() as p:
  b=p.chromium.launch(); pg=b.new_page(viewport={'width':540,'height':960}, device_scale_factor=2)
  errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
  pg.route('https://fonts.googleapis.com/**', lambda r: r.fulfill(body='', content_type='text/css'))
  pg.goto('file://'+ROOT+'/index.html'); pg.wait_for_selector('.title-btn'); pg.wait_for_timeout(300)
  pg.screenshot(path='/tmp/claude-0/shots/menu_hd.png')
  for m in ['lobby','mine','depths','crystal']:
    pg.evaluate(f"KV.App.startMatch({{mode:'single',map:'{m}',diff:'normal',squad:['blaster','dragon','ice','storm'],players:[{{id:'p1',name:'Т',color:'#45e0c0'}}]}})")
    pg.wait_for_selector('#game')
    pg.evaluate("""(()=>{const f=KV.App.match.field; f.coins=1e5; ['normal','fast','armored','ghost','flyer','jumper','elite','boss'].forEach((t,i)=>{const e=f.spawn({type:t,hpMul:1,spMul:0.0001},1,0,2.5+i*2.4); e.hp*=0.7;});
      ['blaster','dragon','ice','storm'].forEach((h,i)=>{const s=f.layout.spots.filter(q=>f.canPlace(q.x,q.z).ok && f.towers.every(t=>Math.hypot(t.x-q.x,t.z-q.z)>2))[0]; const r=f.cmd({type:'place',hero:h,x:s.x,z:s.z}); if(i==1){f.cmd({type:'skill',tower:r.tower.id,skill:'vision'}); f.cmd({type:'upgrade',tower:r.tower.id,branch:0});}}); f.step(0.02); KV.App.match.select(f.towers[0].id);})()""")
    pg.wait_for_timeout(900)
    pg.screenshot(path=f'/tmp/claude-0/shots/sp_{m}.png')
  print(errs or 'ok'); b.close()
