require('../js/data.js'); require('../js/sim.js'); require('../js/bot.js');
const K=globalThis.KV; const diff=process.argv[2]||'normal';
const f=new K.Field({map:'lobby',diff,seed:1234,squad:['blaster','ice','dragon','storm'],autoWave:true,record:false});
const b=new K.Bot(f,0.95); let last=0;
for(let i=0;i<60*60*40 && !f.over;i++){ b.tick(1/60); f.step(1/60);
 if(f.waveNum!==last){ last=f.waveNum; const w=f.peekWave(last); const hp=w.spawns.reduce((a,s)=>a+K.ENEMIES[s.type].hp*s.hpMul,0);
  console.log('W'+last,'coins',f.coins,'towers',f.towers.map(t=>t.hero[0]+t.up.join('')+(t.s.aa?'A':'')+(t.s.vision?'V':'')).join(','),'dps',Math.round(f.towers.reduce((a,t)=>a+t.s.dps*(t.s.multi||1),0)),'waveHP',Math.round(hp),'n',w.spawns.length,'dur',w.spawns[w.spawns.length-1].t.toFixed(0),'hp',f.hp, 'leaks', [...f.leakedTypes].join('/'));}}
