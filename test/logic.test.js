require('../js/data.js'); require('../js/sim.js'); require('../js/bot.js');
const K = globalThis.KV; const assert = require('assert');
let n=0; const ok=(c,m)=>{assert(c,m); n++;};

// Площадки
for (const m of K.MAPS) { const L=K.mapLayout(m); ok(L.obstacles.length>=8, m.id+' obstacles '+L.obstacles.length); ok(L.spots.length>50, m.id+' spots'); }
const sp=(f,i)=>f.layout.spots[i];

// Блокировка веток
const S=(up,br)=>K.upgradeState('blaster',up,br,1e9);
ok(S([1,2],0).ok && S([1,2],1).ok,'1+2 ok');
ok(S([2,2],0).ok && S([2,2],1).ok,'2+2 ok');
ok(S([3,0],1).ok && S([3,1],1).ok,'bottom 1-2 always available');
ok(!S([3,2],1).ok && S([3,2],1).code==='locked','bottom capped at 2 after top3');
ok(S([0,3],0).ok && S([1,3],0).ok && !S([2,3],0).ok,'top capped at 2 after bottom3');
ok(S([2,2],0).ok && S([2,2],1).ok,'2/2 can choose either');
ok(S([3,2],0).ok && S([4,2],0).ok && !S([5,2],0).ok,'top continues to 5');
ok(!S([2,3],0).ok && S([2,3],1).ok,'bottom continues');

// Деньги и прокачка в поле
const f=new K.Field({map:'lobby',diff:'normal',seed:42,squad:['blaster','ice'],autoWave:false});
const c0=f.coins;
const P0=sp(f,0);
ok(!f.cmd({type:'place',hero:'prism',x:P0.x,z:P0.z}).ok,'not in squad');
const road=f.paths[0].pts[1]; const rr0=f.cmd({type:'place',hero:'blaster',x:road.x,z:road.z}); ok(!rr0.ok && /дорог/.test(rr0.reason),'no road');
const ob=f.obstacles[0]; ok(!f.cmd({type:'place',hero:'blaster',x:ob.x,z:ob.z}).ok,'no obstacle');
const r=f.cmd({type:'place',hero:'blaster',x:P0.x,z:P0.z,nonce:1}); ok(r.ok,'place free');
ok(!f.cmd({type:'place',hero:'blaster',x:P0.x+3,z:P0.z,nonce:1}).ok,'dup nonce blocked');
ok(!f.cmd({type:'place',hero:'ice',x:P0.x+0.3,z:P0.z}).ok,'too close');
const t=r.tower; f.coins=10000;
f.cmd({type:'upgrade',tower:t.id,branch:0}); f.cmd({type:'upgrade',tower:t.id,branch:0});
f.cmd({type:'upgrade',tower:t.id,branch:1}); f.cmd({type:'upgrade',tower:t.id,branch:1});
ok(t.up[0]===2&&t.up[1]===2,'2/2');
f.cmd({type:'upgrade',tower:t.id,branch:0}); ok(t.up[0]===3,'top3');
const before=f.coins; const rr=f.cmd({type:'upgrade',tower:t.id,branch:1});
ok(!rr.ok && f.coins===before && t.up[1]===2,'locked no charge');
const range0=K.towerStats('blaster',[0,0],{}).range; ok(t.s.range>range0 && t.s.multi===3,'stats applied');
f.coins=5; const fail=f.cmd({type:'upgrade',tower:t.id,branch:0}); ok(!fail.ok && f.coins===5,'no negative');
const spent=t.spent; const s1=f.cmd({type:'sell',tower:t.id}); ok(s1.ok && s1.refund===Math.floor(spent*0.7),'sell');
ok(!f.cmd({type:'sell',tower:t.id}).ok && f.coins===5+s1.refund,'no double sell');

// Вижен/ПВО
const g=new K.Field({map:'lobby',diff:'normal',seed:1,squad:['blaster','dragon','prism'],autoWave:false});
g.coins=1e5;
const tb=g.cmd({type:'place',hero:'blaster',x:sp(g,0).x,z:sp(g,0).z}).tower; g.obstacles=[];
const spw=(type,extra)=>g.spawn(Object.assign({type,hpMul:1,spMul:0},extra||{}),0,0,0);
const ghost=spw("ghost"), fly=spw("flyer"), both=spw("flyer",{invisible:true}), gr=spw("normal");
[ghost,fly,both,gr].forEach(e=>{e.x=tb.x;e.z=tb.z;});
let tg=g.acquire(tb,10).map(e=>e.id); ok(tg.length===1&&tg[0]===gr.id,'blaster only ground');
g.cmd({type:'skill',tower:tb.id,skill:'vision'}); tg=g.acquire(tb,10).map(e=>e.id);
ok(tg.includes(ghost.id)&&!tg.includes(fly.id)&&!tg.includes(both.id),'vision ghost only');
g.cmd({type:'skill',tower:tb.id,skill:'aa'}); tg=g.acquire(tb,10); ok(tg.length===4,'vision+aa all');
const hp=fly.hp; g.hit(fly,K.towerStats('blaster',[0,0],{}),10,null); ok(fly.hp===hp,'hit without aa ignored');
ok(!g.cmd({type:'skill',tower:tb.id,skill:'aa'}).ok,'aa twice blocked');
const td=g.cmd({type:'place',hero:'dragon',x:sp(g,40).x,z:sp(g,40).z}).tower; ok(td.s.aa && !td.s.vision,'dragon innate aa');

// Линия видимости: препятствие между башней и врагом
{ const q=new K.Field({map:'lobby',diff:'normal',seed:3,squad:['blaster'],autoWave:false}); q.coins=1e4;
  const t=q.cmd({type:'place',hero:'blaster',x:sp(q,0).x,z:sp(q,0).z}).tower; q.obstacles=[];
  const e=q.spawn({type:'normal',hpMul:1,spMul:0},1,0,0); e.x=t.x+2; e.z=t.z;
  ok(q.acquire(t,1).length===1,'visible');
  q.obstacles.push({kind:'wardrobe',x:t.x+1,z:t.z,r:0.5,tall:true,los:true});
  ok(q.acquire(t,1).length===0 && t.blocked,'blocked by wardrobe');
  q.obstacles[0]={kind:'table',x:t.x+1,z:t.z,r:0.42,tall:false,los:true};
  ok(q.acquire(t,1).length===0,'low blocks ground');
  const fl=q.spawn({type:'flyer',hpMul:1,spMul:0},1,0,0); fl.x=t.x+2; fl.z=t.z+0.05; t.s.aa=true;
  ok(q.acquire(t,5).map(x=>x.id).includes(fl.id),'low does not block flyer');
  q.obstacles[0]={kind:'lava',x:t.x+1,z:t.z,r:0.5,tall:false,los:false};
  ok(q.acquire(t,5).length===2,'lava does not block');
  const n0=q.obstacles.length; q.spawnObstacle(4); ok(q.obstacles.length===n0+1 && q.canPlace(q.obstacles[n0].x,q.obstacles[n0].z).ok===false,'dynamic obstacle blocks spot'); }

// Награды за смерть один раз, волна награждается один раз
const h=new K.Field({map:'lobby',diff:'easy',seed:7,squad:['blaster'],autoWave:false});
h.startNextWave(true); h.step(2);
const e=h.enemies[0]; const c=h.coins; h.damage(e,1e6,null,null); const c2=h.coins; h.kill(e,null); h.damage(e,1e6,null,null);
ok(c2>c && h.coins===c2 && h.kills===1,'single reward');
ok(!h.cmd({type:'wave'}).ok,'no wave while active');
for(let i=0;i<60*120 && h.active.length;i++){ h.enemies.forEach(x=>h.damage(x,1e9,null,null)); h.step(1/60); }
ok(h.wavesCleared===1 && h.rewarded.has(1),'wave cleared once');
const cc=h.coins; h.step(1); ok(h.coins===cc,'no repeat reward');

// Детерминизм дуэли
const d1=new K.DuelMatch({map:'mine',seed:99,squadA:['blaster','ice'],squadB:['blaster','ice']});
const d2=new K.DuelMatch({map:'mine',seed:99,squadA:['blaster','ice'],squadB:['blaster','ice']});
const b1=new K.Bot(d1.b,0.5), b2=new K.Bot(d2.b,0.5), a1=new K.Bot(d1.a,0.2), a2=new K.Bot(d2.a,0.2);
for(let i=0;i<60*200;i++){ a1.tick(1/60);b1.tick(1/60);d1.step(1/60); a2.tick(1/60);b2.tick(1/60);d2.step(1/60); }
ok(d1.a.kills===d2.a.kills && d1.b.coins===d2.b.coins,'deterministic');
ok(Math.abs(d1.a.waveNum-d1.b.waveNum)<=0 || d1.over,'sync waves');
// синхронность: пока одна сторона не отбила волну, у другой новая не начинается
{ const d=new K.DuelMatch({map:'lobby',seed:5,squadA:['blaster'],squadB:['blaster']}); for(let i=0;i<60*12;i++) d.step(1/60); ok(d.a.waveNum===1&&d.b.waveNum===1,'first wave both');
  d.b.enemies.forEach(e=>{e.speed=0;}); for(let i=0;i<60*60;i++){ d.step(1/60); d.b.enemies.forEach(e=>{e.speed=0;}); }
  ok(d.a.active.length===0 && d.a.waveNum===1 && d.waiting()==='opp','waits for opponent'); }
// Личные кошельки в команде
{ const P=[{id:'p1',name:'А'},{id:'p2',name:'Б'}];
  const f=new K.Field({map:'lobby',diff:'normal',seed:11,squad:['blaster','piggy'],players:P,autoWave:false});
  ok(f.wallet('p1')===260 && f.wallet('p2')===260,'each own start');
  const sp=f.layout.spots, a=f.cmd({type:'place',hero:'blaster',x:sp[0].x,z:sp[0].z,owner:'p2'});
  ok(a.ok && f.wallet('p2')===140 && f.wallet('p1')===260,'p2 pays own');
  ok(!f.cmd({type:'upgrade',tower:a.tower.id,branch:0,owner:'p1'}).ok,'cannot upgrade foreign tower');
  ok(f.cmd({type:'upgrade',tower:a.tower.id,branch:0,owner:'p2'}).ok && f.wallet('p2')===60,'own upgrade');
  ok(!f.cmd({type:'sell',tower:a.tower.id,owner:'p1'}).ok,'cannot sell foreign');
  const e=f.spawn({type:'normal',hpMul:1,spMul:0},1,0,0); const r=e.reward, w1=f.wallet('p1'), w2=f.wallet('p2');
  f.damage(e,1e6,null,null); const share=Math.ceil(Math.floor(e.maxHp/f.dmgPerCoin())/2); ok(f.wallet('p1')===w1+share && f.wallet('p2')===w2+share,'sourceless damage coins split');
  { const e2=f.spawn({type:'normal',hpMul:1,spMul:0},1,0,0), w2b=f.wallet('p2'), w1b=f.wallet('p1'); f.damage(e2,1e6,null,a.tower); ok(f.wallet('p2')===w2b+Math.floor(e2.maxHp/10) && f.wallet('p1')===w1b,'normal: 10 dmg = 1 coin to tower owner'); }
  const w2s=f.wallet('p2'), s1=f.cmd({type:'sell',tower:a.tower.id,owner:'p2'}); ok(s1.ok && f.wallet('p2')===w2s+s1.refund,'refund to owner'); }
// Свинка: не стреляет, доход владельцу, жизни, лечение, щит
{ const f=new K.Field({map:'lobby',diff:'normal',seed:12,squad:['piggy'],autoWave:false}); f.coins=1e4;
  const sp=f.layout.spots[0], t=f.cmd({type:'place',hero:'piggy',x:sp.x,z:sp.z}).tower;
  ok(t.s.passive && t.s.dmg===0,'piggy passive');
  f.cmd({type:'upgrade',tower:t.id,branch:0}); f.cmd({type:'upgrade',tower:t.id,branch:0});
  ok(f.maxHp===35 && f.hp===35,'petMax +5');
  ok(!f.cmd({type:'skill',tower:t.id,skill:'aa'}).ok,'no skills for piggy');
  f.hp=20; const c0=f.coins; f.startNextWave(true);
  ok(f.coins>=c0+30 && f.events.some(e=>e.t==='piggy'),'piggy pays at wave start');
  for(let i=0;i<60*120 && f.active.length;i++){ f.enemies.forEach(x=>f.damage(x,1e9,null,null)); f.step(1/60); }
  ok(f.hp===21,'heal 1 per wave'); ok(f.coins>c0+30,'income to owner');
  ok(f.projectiles.length===0 && t.dealt===0,'piggy never fires');
  f.cmd({type:'upgrade',tower:t.id,branch:0}); f.cmd({type:'upgrade',tower:t.id,branch:0}); f.startNextWave(true);
  ok(f.shieldLeft===2,'shield charges'); const hp=f.hp; const e=f.spawn({type:'normal',hpMul:1,spMul:1},f.waveNum,0,f.paths[0].length-0.01); f.step(1/60);
  ok(f.hp===hp && f.shieldLeft===1,'shield blocks leak');
  const mh=f.maxHp; f.cmd({type:'sell',tower:t.id}); ok(f.maxHp===30 && mh===40,'max hp back after sell'); }
// Заморозка боссов у Морозилки 0/5
{ const f=new K.Field({map:'lobby',diff:'normal',seed:13,squad:['ice'],autoWave:false});
  const st=K.towerStats('ice',[0,5],{}); ok(st.bossFreeze,'bossFreeze stat'); const st4=K.towerStats('ice',[0,4],{}); ok(!st4.bossFreeze,'only at 5');
  const b=f.spawn({type:'boss',hpMul:100,spMul:1},10,0,0); for(let i=0;i<20;i++) f.hit(b,st,1,null);
  ok(b.stunT>0,'boss frozen gradually'); const b2=f.spawn({type:'boss',hpMul:100,spMul:1},10,0,0); for(let i=0;i<20;i++) f.hit(b2,st4,1,null); ok(!(b2.stunT>0),'no freeze without 0/5'); }
// Пропуск волны
{ const f=new K.Field({map:'lobby',diff:'normal',seed:14,squad:['blaster'],autoWave:false});
  ok(f.cmd({type:'skip'}).ok && f.waveNum===1,'skip starts first wave');
  ok(!f.cmd({type:'skip'}).ok,'cannot skip while spawning'); for(let i=0;i<60*30;i++) f.step(1/60);
  ok(f.canSkip() && f.cmd({type:'skip'}).ok && f.waveNum===2,'skip after all spawned'); }
// монеты за урон по сложностям, босс, бесконечный = продолжение «Тяжело»
for (const [d,r] of [['easy',5],['normal',10],['hard',15],['endless',10],['duel',15]]) { const f=new K.Field({map:'lobby',diff:d,seed:3,squad:['blaster'],autoWave:false}); ok(f.dmgPerCoin()===r,'dmgPerCoin '+d); }
{ const bh=(d,W)=>new K.Field({map:'lobby',diff:d,seed:9,squad:['blaster']}).peekWave(W).spawns.filter(s=>s.type==='boss');
  for (const d of ['easy','normal','hard']) ok(bh(d,10)[0].hp===1000 && bh(d,20)[0].hp===5000,'boss hp 10/20 '+d);
  ok(bh('normal',30)[0].hp===13000 && bh('hard',40)[0].hp===25000,'boss hp 30/40');
  const e50=bh('endless',50)[0].hp, e60=bh('endless',60)[0].hp, e90=bh('endless',90)[0].hp, e100=bh('endless',100)[0].hp;
  ok(e50-25000>=15000 && e50-25000<=20000 && e60-e50>=15000 && e60-e50<=20000,'endless boss +15-20k per 10 waves');
  ok(e100-e90>=65000 && e100-e90<=70000,'wave 100 adds +50k');
  ok(bh('endless',40)[0].hp===25000 && bh('endless',60).length===1,'endless boss 40 = hard');
  const a=new K.Field({map:'lobby',diff:'hard',seed:5,squad:['blaster']}).peekWave(17), b=new K.Field({map:'lobby',diff:'endless',seed:5,squad:['blaster']}).peekWave(17);
  ok(JSON.stringify(a.spawns)===JSON.stringify(b.spawns),'endless waves = hard waves'); }
{ const f=new K.Field({map:'lobby',diff:'normal',seed:2,squad:['blaster']}); ok(f.peekWave(1).bonus===150 && f.peekWave(2).bonus===225 && f.peekWave(3).bonus===300,'normal wave bonus 150 +75'); }
{ const f=new K.Field({map:'lobby',diff:'duel',seed:2,squad:['blaster']}); ok(f.peekWave(1).bonus===120 && f.peekWave(2).bonus===180 && f.peekWave(3).bonus===240,'duel wave bonus as hard 120 +60'); }
// Реалганер: только на препятствия, стреляет поверх них, дальность от улучшений
{ const f=new K.Field({map:'lobby',diff:'normal',seed:4,squad:['prism','blaster'],autoWave:false}); f.coins=1e5;
  const sp=f.layout.spots[0];
  ok(!f.cmd({type:'place',hero:'prism',x:sp.x,z:sp.z}).ok,'prism not on ground');
  const L=f.layout, o=f.obstacles.filter(q=>q.los).sort((p,q)=>Math.hypot(p.x-L.start.x,p.z-L.start.z)-Math.hypot(q.x-L.start.x,q.z-L.start.z))[0];
  const r=f.cmd({type:'place',hero:'prism',x:o.x+0.2,z:o.z-0.1}); ok(r.ok && r.tower.x===o.x && r.tower.z===o.z,'prism snaps onto obstacle');
  ok(!f.cmd({type:'place',hero:'prism',x:o.x,z:o.z}).ok,'one tower per obstacle');
  ok(!f.cmd({type:'place',hero:'blaster',x:o.x,z:o.z}).ok,'other towers still not on obstacles');
  const lava=f.obstacles.find(q=>!q.los); if (lava) ok(!f.canPlace(lava.x,lava.z,null,'prism').ok,'not on lava');
  const top=K.towerStats('prism',[5,2],{}).range, bot=K.towerStats('prism',[2,5],{}).range, base=K.towerStats('prism',[0,0],{}).range;
  ok(top===10 && bot===7 && base===4.5,'prism ranges (with shared 2 levels) '+[base,top,bot]);
  // стреляет сквозь препятствие: враг за высоким препятствием всё равно цель
  const e=f.spawn({type:'normal',hpMul:50,spMul:0},1,0,0); f.step(1/60); const hp0=e.hp;
  const tw=r.tower; ok(Math.hypot(e.x-tw.x,e.z-tw.z)<7,'enemy in range '+Math.hypot(e.x-tw.x,e.z-tw.z).toFixed(1));
  f.obstacles.push({kind:'wardrobe',x:(e.x+tw.x)/2,z:(e.z+tw.z)/2,r:0.5,tall:true,los:true,dyn:true,rot:0});
  ok(!f.los(tw.x,tw.z,e.x,e.z,false),'line really blocked');
  for(let i=0;i<60*4;i++) f.step(1/60); ok(e.hp<hp0 || e.dead,'prism ignores line of sight'); }
{ const f=new K.Field({map:'mine',diff:'normal',seed:4,squad:['prism','blaster','ice','storm'],autoWave:true,record:false}); const b=new K.Bot(f,0.9);
  for(let i=0;i<60*60*6 && !f.over;i++){ f.coins=Math.max(f.coins,2000); b.tick(1/60); f.step(1/60); }
  ok(f.towers.filter(t=>t.hero==='prism').every(t=>f.obstacles.some(o=>o.x===t.x&&o.z===t.z)),'bot puts prism only on obstacles'); }
// секрет Ковтопа: 10 цифр последнего показа дают глаз возле имени
{ require('../js/save.js'); const p=K.Save.sanitize({}); ok(p.eye===false,'no eye by default');
  ok(!K.Save.redeem(p,'1234567890').ok,'no code shown yet');
  K.Save.addKovCode(p,'7535822169'); K.Save.addKovCode(p,'1122334455'); ok(!K.Save.redeem(p,'7535822160').ok,'wrong digits');
  const other=K.Save.sanitize({}); K.Save.addKovCode(other,'9988776655'); ok(!K.Save.redeem(p,'9988776655').ok,"another player's code does not work");
  ok(K.Save.sanitize(JSON.parse(JSON.stringify(p))).kovCodes.length===2,'shown codes persist');
  const r=K.Save.redeem(p,'75 35 82 21 69'); ok(r.ok && p.eye && r.reward==='eye' && p.achievements.secret_eye,'eye granted');
  ok(!K.Save.redeem(p,'7535822169').ok,'eye only once'); ok(K.Save.sanitize(JSON.parse(JSON.stringify(p))).eye===true,'eye persists'); }
// редкости и Гараж
{ const R=Object.fromEntries(K.HEROES.map(h=>[h.id,h.rarity]));
  ok(R.blaster==='Новичковый'&&R.ice==='Обычный'&&R.piggy==='Необычный'&&R.dragon==='Необычный'&&R.storm==='Редкий'&&R.garage==='Эпический'&&R.prism==='Легендарный','rarities');
  ok(K.HEROES.every(h=>K.RARITY_ORDER.includes(h.rarity)),'rarity order covers all'); }
{ const P=[{id:'p1',name:'A',color:'#f00'},{id:'p2',name:'B',color:'#0f0'}];
  const f=new K.Field({map:'lobby',diff:'normal',seed:21,squad:['garage','blaster'],players:P,autoWave:false}); f.wallets.p1=f.wallets.p2=1e6;
  const free=f.layout.spots.filter(q=>f.canPlace(q.x,q.z).ok); let i=0; const put=(h,o)=>{ while(i<free.length){ const q=free[i++]; if(!f.canPlace(q.x,q.z).ok) continue; return f.cmd({type:'place',hero:h,x:q.x,z:q.z,owner:o}); } };
  for(let k=0;k<4;k++) ok(put('garage','p1').ok,'garage '+(k+1));
  const r5=put('garage','p1'); ok(!r5.ok && /Гаражей/.test(r5.reason),'max 4 garages per player');
  ok(put('garage','p2').ok,'other player has own garage limit');
  let n=f.towers.filter(t=>t.owner==='p1').length; while(n<20){ if(put('blaster','p1').ok) n++; else break; }
  const rc=put('blaster','p1'); ok(n===20 && !rc.ok && /20/.test(rc.reason),'2 players: 20 towers each'); ok(K.towerCap(1)===25&&K.towerCap(3)===18&&K.towerCap(4)===15,'tower caps'); }
{ const f=new K.Field({map:'lobby',diff:'normal',seed:22,squad:['garage'],autoWave:false}); f.coins=1e6;
  const q=f.layout.spots[30], g=f.cmd({type:'place',hero:'garage',x:q.x,z:q.z}).tower;
  for(let i=0;i<60*10;i++) f.step(1/60); ok(f.cars.length===0,'no cars between waves');
  f.startNextWave(true); f.enemies.forEach(e=>{e.dead=true}); f.enemies=[]; f.active[0].idx=f.active[0].spawns.length; f.active[0].remaining=9;
  for(let i=0;i<60*5+2;i++) f.step(1/60); ok(f.cars.length===1 && f.cars[0].hp===60,'first car after 5 s');
  const c=f.cars[0], path=f.paths[c.path]; ok(c.d>path.length-1,'car starts at micropet side');
  // слабая сущность гибнет, у машины убывают жизни
  const weak=f.spawn({type:'normal',hpMul:1,spMul:0},1,c.path,c.d-0.05); const wh=weak.hp; f.step(1/60);
  ok(weak.dead && c.hp===60-wh,'car crushes weaker entity and loses its hp');
  // сильная сущность теряет столько, сколько было у машины; машина сгорает
  const strong=f.spawn({type:'armored',hpMul:5,spMul:0},1,c.path,c.d-0.05); const sh=strong.hp, ch=c.hp; f.step(1/60);
  ok(!strong.dead && strong.hp===sh-ch && f.cars.length===0,'stronger entity takes car hp, car burns');
  for(let k=0;k<5;k++) f.cmd({type:'upgrade',tower:g.id,branch:0}); f.cmd({type:'upgrade',tower:g.id,branch:1}); f.cmd({type:'upgrade',tower:g.id,branch:1});
  ok(g.s.carInt===25 && g.s.gunDmg>0 && g.s.carHp===160,'top 5/2: 25 s, gunner, hp 160');
  ok(K.towerStats('garage',[2,5],{}).tank && K.towerStats('garage',[2,5],{}).tankRate<0.35,'bottom 5: tank with slow cannon');
  // стрелок стреляет, машина при этом давит
  strong.dead=true; f.enemies=f.enemies.filter(e=>!e.dead); f.spawnCar(g); const c2=f.cars[f.cars.length-1]; ok(c2.gun,'car carries gunner');
  const tgt=f.spawn({type:'flyer',hpMul:20,spMul:0},1,c2.path,c2.d-2); const th=tgt.hp; for(let i=0;i<60;i++) f.step(1/60); ok(tgt.hp<th,'gunner shoots'); }
// Google: разбор возврата и проверка полей id_token
{ globalThis.window = globalThis.window || {}; require('../js/google.js'); const G=K.Google; K.CONFIG=Object.assign({},K.CONFIG,{googleClientId:'cid.apps.googleusercontent.com'});
  ok(G.readRedirect('#access_token=a&state=s1','g1')===null,'twitch return is not google');
  ok(G.readRedirect('#id_token=t&state=g1','g1').token==='t','google return parsed');
  ok(G.readRedirect('#error=access_denied&state=g1','g1').error==='access_denied','google error parsed');
  const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const tok=c=>'h.'+b64(c)+'.s'; const good={sub:'123',aud:'cid.apps.googleusercontent.com',iss:'https://accounts.google.com',exp:Date.now()/1000+600,nonce:'n',email:'a@b.c',email_verified:true,name:'Аня'};
  ok(G.decode(tok(good)).name==='Аня','jwt decode utf-8');
  let threw=null; try{G.checkClaims(good,'n')}catch(e){threw=e} ok(!threw,'valid claims pass');
  for (const [bad,why] of [[{aud:'other'},'aud'],[{nonce:'x'},'nonce'],[{exp:1},'exp'],[{iss:'evil.com'},'iss'],[{email_verified:false},'email']]) { let t=null; try{G.checkClaims(Object.assign({},good,bad),'n')}catch(e){t=e} ok(t,'rejects bad '+why); } }
{ const s0=K.towerStats('prism',[0,0],{}); ok(!s0.vision && K.towerStats('prism',[0,0],{vision:true}).vision,'prism has no free vision, can buy it'); }
// экономика по сложностям, дуэль, Свинка
{ const B=(d,w)=>new K.Field({map:'lobby',diff:d,seed:2,squad:['blaster']}).peekWave(w).bonus;
  ok(B('easy',1)===180&&B('easy',2)===270&&B('easy',3)===360,'easy 180 +90');
  ok(B('hard',1)===120&&B('hard',2)===180,'hard unchanged 120 +60');
  ok(B('endless',1)===150&&B('endless',2)===225,'endless coins like normal');
  ok(new K.Field({map:'lobby',diff:'endless',seed:2,squad:['blaster']}).coins===500,'endless start 500');
  const d=new K.DuelMatch({map:'lobby',seed:3,squadA:['blaster'],squadB:['blaster']}); ok(d.a.coins===1000&&d.b.coins===1000,'duel start 1000 each');
  ok(K.placeCost('blaster','duel')===132 && K.placeCost('blaster','single')===120,'duel placement +10%');
  const H=K.HERO.blaster; ok([0,1,2,3,4].map(i=>K.upCost(H.top[i],i,'duel')).join()===[80*1.1,150*1.15,550*1.2,800*1.25,2500*1.3].map(Math.round).join(),'duel upgrades +10/15/20/25/30%');
  const q=d.a.layout.spots[0]; const t=d.a.cmd({type:'place',hero:'blaster',x:q.x,z:q.z}).tower; ok(d.a.coins===1000-132 && t.spent===132,'duel placement charged');
  d.a.cmd({type:'upgrade',tower:t.id,branch:0}); ok(d.a.coins===1000-132-88,'duel upgrade charged');
  const inc=u=>K.towerStats('piggy',u,{}).income; ok(inc([2,5])===800 && inc([5,2])===450,'piggy 800 bottom / 450 top'); }
// награды аккаунта и кривая опыта
{ const mk=(d,W,res,mode)=>({ mode:mode||'single', D:K.DIFFS[d], diffKey:d, result:res, wavesCleared:W, kills:999 });
  ok(K.matchRewards(mk('easy',20,'win')).coins===300 && K.matchRewards(mk('normal',30,'win')).coins===500 && K.matchRewards(mk('hard',40,'win')).coins===700,'win: 10/wave + 100/200/300');
  ok(K.matchRewards(mk('normal',12,'lose')).coins===120,'loss: 10 per wave only');
  ok(K.matchRewards(mk('endless',50,'lose')).coins===450,'endless: 10/wave to 40, then 5');
  ok(K.matchRewards(mk('duel',10,null,'duel'),'win').coins===70 && K.matchRewards(mk('duel',10,null,'duel'),'lose').coins===40 && K.matchRewards(mk('duel',10,null,'duel'),'draw').coins===50,'duel: 5/wave ×1.4 / ×0.8');
  require('../js/save.js'); const N=K.Profile.xpNeed; ok(N(1)===50 && N(2)===185 && N(3)===290 && N(4)===395,'xp curve 50, 2x+80+x/10'); }
{ const hp=(d,W)=>{ const w=new K.Field({map:'lobby',diff:d,seed:7,squad:['blaster']}).peekWave(W); return [w.hpScale, w.spawns.filter(s=>s.type==='boss').map(s=>s.hp)]; };
  const base=(d,W)=>{ const D=K.DIFFS[d], w=W-1; let h=(1+0.09*w+0.0025*w*w)*D.hpMul; if(W>40) h*=Math.pow(1.035,W-40); return h; };
  for (const d of ['easy','normal','hard','endless','duel']) { ok(Math.abs(hp(d,10)[0]-base(d,10))<1e-9 && Math.abs(hp(d,11)[0]-base(d,11)*1.05)<1e-9 && Math.abs(hp(d,20)[0]-base(d,20)*1.5)<1e-9,'+5%/wave from 11: '+d); }
  ok(hp('normal',20)[1][0]===5000 && hp('hard',40)[1][0]===25000,'bosses unaffected'); }
console.log('OK', n, 'checks');
