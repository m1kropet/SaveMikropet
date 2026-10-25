import os, subprocess, time
os.environ['PLAYWRIGHT_BROWSERS_PATH']='/opt/pw-browsers'
from playwright.sync_api import sync_playwright
OUT='/tmp/claude-0/shots'
srv=subprocess.Popen(['node','server/server.js'], env=dict(os.environ, PORT='8814'), cwd='/home/claude/game')
time.sleep(0.8); errs=[]
try:
  with sync_playwright() as p:
    br=p.chromium.launch()
    def page(name):
      pg=br.new_context(viewport={'width':450,'height':800}).new_page()
      pg.on('pageerror', lambda e: errs.append(name+' '+str(e)))
      pg.route('https://fonts.googleapis.com/**', lambda r: r.fulfill(body='', content_type='text/css'))
      pg.goto('http://localhost:8814/'); pg.wait_for_selector('.title-btn'); pg.evaluate(f"KV.App.profile.nick='{name}'")
      pg.click('[data-act=play]'); pg.click('[data-act=team]'); return pg
    A=page('Анна'); A.wait_for_selector('.pub-card'); A.wait_for_timeout(400); A.screenshot(path=OUT+'/pub_list.png')
    A.click('.pub-card[data-size="2"]'); A.wait_for_selector('text=Ждём игроков: 1 из 2'); A.screenshot(path=OUT+'/pub_wait.png')
    B=page('Борис'); B.wait_for_selector('.pub-card[data-size="2"] .pub-dots i.on')
    print('B sees waiting:', B.inner_text('.pub-card[data-size="2"] .note'))
    B.click('.pub-card[data-size="2"]')
    A.wait_for_selector('text=Старт через'); A.wait_for_timeout(1200); A.screenshot(path=OUT+'/pub_count.png'); print('A:', A.inner_text('#cd'))
    A.wait_for_selector('[data-act=voteDiff]', timeout=9000); A.screenshot(path=OUT+'/pub_vote.png'); A.click('[data-act=voteDiff][data-id=hard]'); B.click('[data-act=voteDiff][data-id=normal]')
    t=time.time(); A.wait_for_selector('#game', timeout=9000); B.wait_for_selector('#game', timeout=3000)
    print('started after vote %.1fs' % (time.time()-t), 'diff', A.evaluate('KV.App.match.field.diffKey'), '| players', A.evaluate("KV.App.match.field.players.map(p=>p.name).join(',')"))
    A.wait_for_timeout(9000); print('wave', A.evaluate("KV.App.match.field.waveNum"))
    A.screenshot(path=OUT+'/pub_game.png'); br.close()
finally: srv.terminate()
print(errs or 'no errors')
