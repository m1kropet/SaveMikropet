// Сквозной тест сервера: два клиента по WebSocket, команда, гонка трат, дуэль, отключение.
process.env.PORT = '8811';
const { server } = require('../server/server.js');
const assert = require('assert');
const K = globalThis.KV;
let checks = 0; const ok = (c, m) => { assert(c, m); checks++; };

function client(nick) {
  const ws = new WebSocket('ws://localhost:8811/ws');
  const c = { ws, msgs: [], last: {}, waiters: [] };
  ws.onmessage = e => { const m = JSON.parse(e.data); c.msgs.push(m); c.last[m.op] = m; c.waiters = c.waiters.filter(w => { if (w.pred(m)) { w.res(m); return false; } return true; }); };
  c.send = (op, d) => ws.send(JSON.stringify(Object.assign({ op }, d || {})));
  c.wait = (pred, ms = 4000) => new Promise((res, rej) => { const found = c.msgs.find(pred); if (found) { c.msgs.splice(c.msgs.indexOf(found), 1); return res(found); } const w = { pred, res: m => { c.msgs.splice(c.msgs.indexOf(m), 1); res(m); } }; c.waiters.push(w); setTimeout(() => rej(new Error('timeout ' + nick)), ms); });
  c.open = new Promise(r => { ws.onopen = () => { c.send('hello', { nick, level: 5, squad: ['blaster', 'ice', 'dragon'] }); r(); }; });
  return c;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const a = client('Анна'), b = client('Борис');
  await a.open; await b.open;
  await a.wait(m => m.op === 'hello'); await b.wait(m => m.op === 'hello');
  // статика и подмена config.js
  const html = await (await fetch('http://localhost:8811/')).text();
  ok(html.startsWith('<!doctype html>') && html.includes('js/main.js'), 'index served');
  ok((await (await fetch('http://localhost:8811/js/config.js')).text()).includes('"serverUrl":"auto"'), 'config auto');
  ok((await fetch('http://localhost:8811/server/server.js')).status === 404, 'server code hidden');

  // команда
  a.send('create', { mode: 'team' });
  const room = await a.wait(m => m.op === 'room');
  ok(/^KV-[A-Z2-9]{4}$/.test(room.code), 'room code');
  b.send('join', { code: room.code });
  await b.wait(m => m.op === 'room' && m.players.length === 2);
  b.send('join', { code: 'KV-ZZZZ' }); ok((await b.wait(m => m.op === 'error')).reason.includes('не найдена'), 'bad code');
  a.send('config', { cfg: { map: 'corridor', diff: 'easy', autoWave: false } });
  a.send('start'); ok((await a.wait(m => m.op === 'error')).reason.includes('готов'), 'needs ready');
  a.send('ready', { ready: true }); b.send('ready', { ready: true });
  await sleep(100);
  a.send('start');
  const sa = await a.wait(m => m.op === 'start'), sb = await b.wait(m => m.op === 'start');
  ok(sa.mode === 'team' && sa.you === 'p1' && sb.you === 'p2' && sa.cfg.map === 'corridor', 'team start');
  // клиентская копия поля из снимков
  const rf = new K.NetProto.RemoteField({ map: sa.cfg.map, diff: sa.cfg.diff, seed: sa.seed, mode: 'team', squad: sa.squad, players: sa.players });
  const st0 = await a.wait(m => m.op === 'state'); rf.apply(st0.me);
  ok(rf.coins === K.DIFFS.easy.startCoins && rf.towers.length === 0, 'snapshot applied');
  const spots = rf.layout.spots.filter(s => rf.canPlace(s.x, s.z).ok);
  a.send('cmd', { seq: 1, cmd: { type: 'place', hero: 'blaster', x: spots[0].x, z: spots[0].z } });
  ok((await a.wait(m => m.op === 'ack' && m.seq === 1)).ok, 'place ok');
  b.send('cmd', { seq: 1, cmd: { type: 'place', hero: 'prism', x: spots[30].x, z: spots[30].z } });
  ok(!(await b.wait(m => m.op === 'ack' && m.seq === 1)).ok, 'hero not in squad rejected');
  // гонка: у обоих хватает только на одну покупку
  await sleep(150);
  const st1 = (await a.wait(m => m.op === 'state' && m.me.tw.length === 1)).me; rf.apply(st1);
  const coins = rf.coins; // 300-120 = 180: хватит только на одного Ледяного куба (140)
  const far = spots.filter(s => Math.hypot(s.x - spots[0].x, s.z - spots[0].z) > 2);
  a.send('cmd', { seq: 2, cmd: { type: 'place', hero: 'ice', x: far[0].x, z: far[0].z } });
  b.send('cmd', { seq: 2, cmd: { type: 'place', hero: 'ice', x: far[20].x, z: far[20].z } });
  const ra = await a.wait(m => m.op === 'ack' && m.seq === 2), rb = await b.wait(m => m.op === 'ack' && m.seq === 2);
  ok(ra.ok !== rb.ok, 'only one concurrent purchase succeeds');
  await sleep(250);
  const st2 = b.last.state.me; rf.apply(st2);
  ok(rf.coins === coins - 140 && rf.coins >= 0 && rf.towers.length === 2, 'coins consistent ' + rf.coins);
  ok(rf.towers.find(t => t.hero === 'blaster').owner === 'p1', 'owner kept');
  a.send('cmd', { seq: 3, cmd: { type: 'wave' } });
  ok((await a.wait(m => m.op === 'ack' && m.seq === 3)).ok, 'wave start');
  await sleep(1500);
  const st3 = a.last.state.me; rf.apply(st3);
  ok(rf.waveNum === 1 && (rf.enemies.length > 0 || rf.kills > 0), 'wave running on server');
  a.send('leave'); b.send('leave'); await sleep(100);

  // дуэль: случайный подбор
  a.send('queue'); await a.wait(m => m.op === 'queued');
  b.send('queue');
  const da = await a.wait(m => m.op === 'start' && m.mode === 'duel'), db = await b.wait(m => m.op === 'start' && m.mode === 'duel');
  ok(da.seed === db.seed && da.opp.name === 'Борис' && db.opp.name === 'Анна', 'duel matched');
  const ds = await a.wait(m => m.op === 'state' && m.d);
  ok(ds.opp && ds.me && 'gap' in ds.d, 'duel state with opponent');
  a.send('cmd', { seq: 9, cmd: { type: 'wave' } });
  ok(!(await a.wait(m => m.op === 'ack' && m.seq === 9)).ok, 'no manual waves in duel');
  // отключение = поражение
  b.ws.close();
  const over = await a.wait(m => m.op === 'over', 5000);
  ok(over.result === 'win' && /отключ|покинул/.test(over.reason), 'forfeit on disconnect');
  a.ws.close();
  // публичные лобби: заполнение → отсчёт 5 с → общий матч; уход отменяет отсчёт
  const c1 = client('Вика'), c2 = client('Глеб'), c3 = client('Даня');
  await c1.open; await c2.open; await c3.open;
  const pub0 = await c1.wait(m => m.op === 'publics');
  ok(pub0.sizes[3] === 0, 'publics summary');
  c1.send('publicJoin', { size: 3 }); await c1.wait(m => m.op === 'room' && m.public === 3);
  c2.send('publicJoin', { size: 3 }); const r2 = await c2.wait(m => m.op === 'room' && m.players.length === 2);
  ok(r2.startsIn === null, 'no countdown before full');
  ok((await c3.wait(m => m.op === 'publics' && m.sizes[3] === 2)).sizes[3] === 2, 'others see fill');
  c3.send('publicJoin', { size: 3 });
  const full = await c1.wait(m => m.op === 'room' && m.players.length === 3 && m.startsIn > 0);
  ok(full.startsIn > 4000 && full.startsIn <= 5000, 'countdown 5s');
  c3.send('leave');
  ok((await c1.wait(m => m.op === 'room' && m.players.length === 2)).startsIn === null, 'leave cancels countdown');
  c3.send('publicJoin', { size: 3 });
  await c1.wait(m => m.op === 'room' && m.players.length === 3 && m.startsIn > 0);
  const t0 = Date.now();
  const st = await c1.wait(m => m.op === 'start', 8000); await c2.wait(m => m.op === 'start'); await c3.wait(m => m.op === 'start');
  ok(st.mode === 'team' && st.players.length === 3 && Date.now() - t0 >= 4500, 'auto start after 5s');
  c1.send('cmd', { seq: 1, cmd: { type: 'place', hero: 'blaster', x: 99, z: 99 } });
  ok(!(await c1.wait(m => m.op === 'ack' && m.seq === 1)).ok, 'public match accepts commands');
  [c1, c2, c3].forEach(c => c.ws.close());
  console.log('SERVER OK', checks, 'checks');
  server.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
