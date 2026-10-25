require('../js/data.js'); require('../js/sim.js'); require('../js/bot.js'); const K=globalThis.KV;
const d=new K.DuelMatch({map:'corridor',seed:77,squadA:['blaster','ice','dragon','storm'],squadB:['blaster','ice']});
const a=new K.Bot(d.a,0.95), bb=new K.Bot(d.b,0.15); let last=0;
while(!d.over){a.tick(1/60);bb.tick(1/60);d.step(1/60); const f=d.a; if(f.waveNum!==last){last=f.waveNum;
console.log('W'+last,'t',Math.round(f.time),'coins',f.coins,'hp',f.hp,f.towers.map(t=>t.hero[0]+t.up.join('')+(t.s.aa?'A':'')+(t.s.vision?'V':'')).join(','),'enemies',f.enemies.length,[...f.leakedTypes].join('/'));}}
