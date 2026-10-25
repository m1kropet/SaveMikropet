require('../js/data.js'); require('../js/sim.js'); require('../js/bot.js');
const K=globalThis.KV;
const lvl=process.argv[2]||'hard'; const diffs=(process.argv[3]||'easy,normal,hard').split(',');
const squad=['blaster','ice','dragon','storm'];
for (const diff of diffs) { const row=[];
 for (const m of K.MAPS) {
  const f=new K.Field({map:m.id,diff,seed:1234,squad,autoWave:true,record:false});
  const b=new K.Bot(f,{hard:0.95,medium:0.5,easy:0.15}[lvl]); let i=0;
  while(!f.over && i<60*60*60){ b.tick(1/60); f.step(1/60); i++; }
  row.push(m.id+':'+(f.result==='win'?'WIN':'w'+f.wavesCleared)+'/hp'+f.hp);
 }
 console.log(lvl,diff,row.join(' '));
}
