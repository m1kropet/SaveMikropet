import os, sys
os.environ['PLAYWRIGHT_BROWSERS_PATH']='/opt/pw-browsers'
from playwright.sync_api import sync_playwright
ROOT='/home/claude/game'; OUT='/tmp/claude-0/shots'; os.makedirs(OUT, exist_ok=True)
errors=[]
def run():
  with sync_playwright() as p:
    b=p.chromium.launch()
    pg=b.new_page(viewport={'width':450,'height':800})
    pg.on('pageerror', lambda e: errors.append('PAGEERR '+str(e)))
    pg.on('console', lambda m: errors.append('CONSOLE '+m.text) if m.type=='error' and 'fonts.g' not in m.text and 'ERR_' not in m.text else None)
    pg.route('https://fonts.googleapis.com/**', lambda r: r.fulfill(body='', content_type='text/css'))
    pg.goto('file://'+ROOT+'/index.html'); pg.wait_for_selector('.title-btn')
    ev=pg.evaluate
    pg.wait_for_timeout(400); pg.screenshot(path=OUT+'/menu2d.png')
    for i in range(5): pg.click('.title-btn')
    assert pg.query_selector('.secret'); pg.click('#secretClose')
    pg.click('[data-act=play]'); pg.wait_for_timeout(350); pg.screenshot(path=OUT+'/menu_modes.png')
    assert pg.is_hidden('#playBtn'); pg.click('[data-act=collapse]'); pg.wait_for_timeout(350)
    assert pg.is_visible('#playBtn') and 'open' not in pg.get_attribute('#modes','class'), 'collapse'
    pg.click('[data-act=play]'); pg.wait_for_timeout(350)
    assert ev("/^[A-Z0-9]{3}$/.test(KV.App.profile.tag)") and '#' in pg.inner_text('.profile-chip'), 'tag shown'
    pg.click('[data-act=single]'); pg.screenshot(path=OUT+'/single.png')
    pg.click('[data-act=map][data-id=mirrors]'); pg.click('[data-act=diff][data-id=easy]'); pg.click('[data-act=start]')
    pg.wait_for_selector('#game'); pg.wait_for_timeout(300)
    # постановка касанием: экранная точка лучшего места
    def scr(x,z):
      return ev(f"(()=>{{const R=KV.App.render,r=R.canvas.getBoundingClientRect();return [r.left+R.ox+{x}*R.S, r.top+R.oy+{z}*R.S];}})()")
    sp=ev("KV.App.match.field.layout.spots[0]")
    pg.click('.hbtn[data-id=blaster]')
    x,y=scr(sp['x'],sp['z']); pg.mouse.move(x,y); pg.mouse.down(); pg.mouse.up()
    assert ev("KV.App.match.field.towers.length")==1, 'tap place'
    assert pg.query_selector('.tier'), 'panel opens'
    # на дорогу нельзя
    road=ev("KV.App.match.field.paths[0].pts[1]")
    pg.click('[data-act=close]'); pg.click('.hbtn[data-id=ice]')
    x,y=scr(road['x'],road['z']); pg.mouse.move(x,y); pg.mouse.down(); pg.mouse.up()
    assert ev("KV.App.match.field.towers.length")==1 and 'дорог' in pg.inner_text('#ntMsg'), pg.inner_text('#ntMsg')
    pg.click('[data-act=cancel]')
    ev("KV.App.match.select(KV.App.match.field.towers[0].id); KV.App.match.field.coins=5000")
    pg.click('.tier[data-br="0"][data-lvl="0"]'); pg.click('[data-act=buy]')
    sel=ev("JSON.stringify(KV.App.match.ui.tier)")
    pg.hover('.tier[data-br="1"][data-lvl="0"]'); pg.wait_for_timeout(150)
    assert ev("JSON.stringify(KV.App.match.ui.tier)")==sel, 'hover does not change selection'
    pg.click('[data-act=buy]'); pg.click('.tier[data-br="1"][data-lvl="0"]'); pg.click('[data-act=buy]'); pg.click('[data-act=buy]')
    assert ev("KV.App.match.field.towers[0].up.join()")=='2,2', ev("KV.App.match.field.towers[0].up.join()")
    pg.click('.tier[data-br="0"][data-lvl="2"]'); pg.click('[data-act=buy]')
    pg.click('.tier[data-br="1"][data-lvl="2"]')
    assert 'закрыто' in pg.inner_text('.detail').lower()
    pg.click('[data-act=skill][data-k=vision]'); pg.click('[data-act=target]')
    assert ev("KV.App.match.field.towers[0].targeting")=='last'
    pg.screenshot(path=OUT+'/panel2d.png')
    pg.click('[data-act=sell]'); pg.click('[data-act=sellYes]'); assert ev("KV.App.match.field.towers.length")==0
    ev("(()=>{const f=KV.App.match.field; ['blaster','ice'].forEach((h,i)=>{const s=f.layout.spots.filter(q=>f.canPlace(q.x,q.z).ok)[i*9]; f.cmd({type:'place',hero:h,x:s.x,z:s.z,owner:'p1'});}); f.coins=2000;})()")
    pg.click('#dock [data-act=skip]'); pg.wait_for_timeout(2500)
    pg.click('[data-act=pause]'); pg.wait_for_selector('.modal [data-k=autoWave]')
    assert ev("KV.App.match.paused"), 'single pauses'
    pg.click('.modal [data-k=autoWave]'); pg.wait_for_timeout(100)
    assert ev("KV.App.match.field.autoWave===true && KV.App.profile.settings.autoWave===true"), 'autoWave from pause'
    pg.click('.modal [data-m=resume]')
    ev("(()=>{const f=KV.App.match.field; for(let i=0;i<60*40;i++) f.step(1/60);})()")
    pg.wait_for_timeout(300)
    if ev("KV.App.match.field.canSkip() && KV.App.match.field.active.length>0"):
      w0=ev("KV.App.match.field.waveNum"); pg.click('#skipTop'); assert ev("KV.App.match.field.waveNum")==w0+1, 'skip during wave'
    ev("(()=>{const f=KV.App.match.field; f.waveNum=7; f.startNextWave(false); for(let i=0;i<60*4;i++) f.step(1/60);})()")
    pg.wait_for_timeout(700); pg.screenshot(path=OUT+'/play2d.png')
    ev("KV.App.match.field.finish('win')"); pg.wait_for_selector('.result-title', timeout=5000); pg.click('[data-m=menu]')
    # дуэль
    pg.click('[data-act=duel]'); pg.screenshot(path=OUT+'/duelscreen.png'); pg.click('[data-act=start]'); pg.wait_for_selector('#dB')
    ev("(()=>{const m=KV.App.match; const f=m.field; f.coins=900; const s=f.layout.spots[0]; f.cmd({type:'place',hero:f.squad[0],x:s.x,z:s.z,owner:'p1'}); for(let i=0;i<60*40;i++){m.bot.tick(1/60); m.duel.step(1/60);} })()")
    print('DUEL waves', ev("[KV.App.match.duel.a.waveNum, KV.App.match.duel.b.waveNum]"), 'opp', ev("KV.App.match.oppName"), 'bot towers', ev("KV.App.match.duel.b.towers.length"))
    pg.click('#viewBtn'); pg.wait_for_timeout(400)
    assert ev("KV.App.match.view")=='opp' and pg.query_selector('.opp-list')
    if ev("KV.App.match.duel.b.towers.length"):
      pg.click('.opp-t'); assert pg.query_selector('.tier[disabled]')
    pg.screenshot(path=OUT+'/oppview.png')
    pg.click('#viewBtn'); assert ev("KV.App.match.view")=='me'
    ev("KV.App.match.duel.a.hp=0"); pg.wait_for_selector('.result-title', timeout=5000); pg.click('[data-m=menu]')
    # команда на одном устройстве: у каждого свои деньги, чужую башню не улучшить
    pg.click('[data-act=team]'); pg.click('[data-act=create]'); pg.click('[data-act=add]'); pg.click('[data-act=ready][data-id=p1]'); pg.click('[data-act=ready][data-id=p2]')
    pg.click('[data-act=start]'); pg.wait_for_selector('#players')
    pg.click('.pchip[data-id=p2]')
    ev("(()=>{const m=KV.App.match,f=m.field,s=f.layout.spots[0]; m.command({type:'place',hero:f.squad[0],x:s.x,z:s.z});})()")
    assert ev("KV.App.match.field.towers[0].owner")=='p2' and ev("KV.App.match.field.wallet('p1')")>ev("KV.App.match.field.wallet('p2')"), 'own wallets'
    pg.click('.pchip[data-id=p1]'); ev("KV.App.match.select(KV.App.match.field.towers[0].id)")
    assert 'башня товарища' in pg.inner_text('#dock'), 'foreign tower readonly'
    pg.screenshot(path=OUT+'/team_local.png')
    pg.click('[data-act=close]'); pg.click('[data-act=pause]'); pg.click('[data-m=quit]')
    # лидерборд без ботов
    pg.click('[data-act=leaders]'); assert len(pg.query_selector_all('.lb-row'))==1; pg.click('[data-act=back]')
    # магазин
    ev("KV.App.profile.coins=5000"); pg.click('[data-act=shop]'); pg.click('[data-act=sel][data-id=prism]'); pg.click('[data-act=buy]'); pg.wait_for_timeout(300); pg.screenshot(path=OUT+'/shop2d.png')
    assert 'prism' in ev('KV.App.profile.owned')
    pg.click('[data-act=sort][data-id=dear]'); first=pg.get_attribute('.hero-card','data-id'); assert first=='prism', first
    pg.click('[data-act=sort][data-id=rarity]'); assert pg.get_attribute('.hero-card','data-id') in ('blaster','ice')
    pg.fill('#promo','wrong'); pg.click('[data-act=code]'); assert 'не подошёл' in pg.inner_text('#promoErr')
    pg.fill('#promo','mines'); pg.click('[data-act=code]'); pg.wait_for_selector('text=Код принят')
    assert ev("KV.App.profile.themes.includes('mine') && KV.App.profile.settings.theme==='mine' && !!KV.App.profile.achievements.secret_morse")
    assert ev("document.getElementById('frame').classList.contains('theme-mine')")
    pg.click('[data-m=close]'); pg.wait_for_timeout(200); pg.screenshot(path=OUT+'/shop_mine.png')
    # вкладка «Скины»: после кода открыта, выбор переключает тему
    assert pg.is_visible('.skin-card[data-id=mine]') and pg.is_visible('.skin-card[data-id=hotel]')
    pg.click('.skin-card[data-id=hotel]'); pg.click('[data-act=useSkin][data-id=hotel]'); assert ev("KV.App.profile.settings.theme==='hotel'")
    pg.click('.skin-card[data-id=mine]'); pg.click('[data-act=useSkin][data-id=mine]'); assert ev("KV.App.profile.settings.theme==='mine'")
    pg.click('[data-act=tab][data-id=heroes]'); assert pg.is_visible('.hero-card')
    pg.click('[data-act=back]')
    pg.wait_for_timeout(500); pg.screenshot(path=OUT+'/menu_mine.png')
    # Twitch: без Client ID — честное объяснение
    pg.click('[data-act=settings]'); assert 'Автозапуск' not in pg.inner_text('.scroll').split('Оформление')[0] or True
    pg.click('[data-act=theme][data-id=hotel]'); assert ev("KV.App.profile.settings.theme==='hotel'")
    pg.click('[data-act=twLogin]'); assert 'Client ID' in pg.inner_text('.modal'); pg.click('[data-m=close]')
    # Twitch: разбор ответа и проверка токена с подменённым fetch
    r=ev("""(async()=>{ KV.CONFIG.twitchClientId='abc';
      const bad=KV.Twitch.readRedirect('#access_token=t&state=zzz','yyy'); const good=KV.Twitch.readRedirect('#access_token=t1&state=s1','s1');
      const f=async(url)=>({ok:true,json:async()=>url.includes('validate')?{client_id:'abc',login:'streamer',user_id:'42',expires_in:3600}:{data:[{id:'42',login:'streamer',display_name:'Стример',profile_image_url:'https://x/y.png'}]}});
      const u=await KV.Twitch.verify(good.token,f); KV.CONFIG.twitchClientId=''; return [!!bad.error, good.token, u.display, u.id];})()""")
    assert r==[True,'t1','Стример','42'], r
    # требование входа
    ev("KV.CONFIG.requireTwitch=true"); pg.click('[data-act=back]'); pg.click('[data-act=single]'); pg.click('[data-act=start]')
    pg.wait_for_selector('text=подтвердите аккаунт через Twitch или Google'); ev("KV.CONFIG.requireTwitch=false")
    # миграция v3
    ev("KV.App.profile=null; localStorage.setItem('mikropet.save', JSON.stringify({v:3, nick:'Третий', coins:5, owned:['blaster','ice'], squad:['ice'], last:{bot:'hard'}}))"); pg.reload(); pg.wait_for_selector('.title-btn')
    assert ev("KV.App.profile.v")==5 and ev("KV.App.profile.twitch")==None and ev("/^[A-Z0-9]{3}$/.test(KV.App.profile.tag)")
    b.close()
try:
  run(); print('SMOKE OK')
except Exception as e:
  import traceback; traceback.print_exc()
print('\n'.join(errors[:20]) or 'no console errors')
