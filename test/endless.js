require('../js/data.js'); require('../js/sim.js'); require('../js/bot.js'); const K=globalThis.KV;
const f=new K.Field({map:'lobby',diff:'endless',seed:5,squad:['blaster','dragon','prism','storm'],autoWave:true,record:false});
const b=new K.Bot(f,0.95); let i=0; while(!f.over&&i<60*60*90){b.tick(1/60);f.step(1/60);i++;}
console.log('endless hard bot reached', f.wavesCleared, 'time', Math.round(f.time/60)+'m');
for (const [A,B] of [['hard','easy'],['medium','easy'],['hard','medium']]) {
 const d=new K.DuelMatch({map:'corridor',seed:77,squadA:['blaster','ice','dragon','storm'],squadB:['blaster','ice','dragon','storm']});
 const a=new K.Bot(d.a,{hard:0.95,medium:0.5,easy:0.15}[A]), bb=new K.Bot(d.b,{hard:0.95,medium:0.5,easy:0.15}[B]); while(!d.over){a.tick(1/60);bb.tick(1/60);d.step(1/60);}
 console.log(A,'vs',B,d.result,d.reason,'t',Math.round(d.time),'waves',d.a.wavesCleared,d.b.wavesCleared);
}
