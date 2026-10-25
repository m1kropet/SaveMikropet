// Сквозной тест сервера: два клиента по WebSocket, команда, гонка трат, дуэль, отключение.
process.env.PORT = '8811';
process.env.NO_STORE = '1';
process.env.VOTE_MS = '1500';
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
  c.uid = require('crypto').randomBytes(8).toString('hex');
  c.open = new Promise(r => { ws.onopen = () => { c.send('hello', { nick, level: 5, squad: ['blaster', 'ice', 'dragon'], uid: c.uid, tag: nick === 'Анна' ? 'ANN' : '', endless: nick === 'Борис' }); r(); }; });
  return c;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const a = client('Анна'), b = client('Борис');
  await a.open; await b.open;
  await a.wait(m => m.op === 'hello'); await b.wait(m => m.op === 'hello');
  const ta = await a.wait(m => m.op === 'tag'), tb = await b.wait(m => m.op === 'tag');
  ok(ta.tag === 'ANN' && /^[A-Z0-9]{3}$/.test(tb.tag) && tb.tag !== 'ANN', 'tags assigned');
  // подарок: все башни игроку с тегом #5U6 (только владельцу тега)
  { const g = client('Гость'); g.uid = 'f00d' + g.uid; await g.open; g.send('hello', { nick: 'Гость', level: 3, squad: ['blaster'], uid: g.uid, tag: '5U6' });
    const tg = await g.wait(m => m.op === 'tag'); const gr = await g.wait(m => m.op === 'grant');
    ok(tg.tag === '5U6' && gr.heroes.length === K.HEROES.length, 'tag 5U6 gets all towers');
    const h = client('Хитрец'); await h.open; h.send('hello', { nick: 'Хитрец', level: 3, squad: ['blaster'], uid: h.uid, tag: '5U6' });
    const th = await h.wait(m => m.op === 'tag' && m.tag !== '5U6' || m.op === 'tag'); await sleep(300);
    ok(th.tag !== '5U6' && !h.msgs.some(m => m.op === 'grant'), 'someone else cannot take 5U6 and gets no gift');
    g.ws.close(); h.ws.close(); }
  a.send('findTag', { tag: '#' + tb.tag }); const fnd = await a.wait(m => m.op === 'found');
  ok(fnd.player && fnd.player.nick === 'Борис' && fnd.player.online, 'find by tag');
  // статика и подмена config.js
  const html = await (await fetch('http://localhost:8811/')).text();
  ok(html.startsWith('<!doctype html>') && html.includes('js/main.js'), 'index served');
  ok((await (await fetch('http://localhost:8811/js/config.js')).text()).includes('"serverUrl":"auto"'), 'config auto');
  ok((await fetch('http://localhost:8811/server/server.js')).status === 404, 'server code hidden');

  // команда
  a.send('create', { mode: 'team' });
  const room = await a.wait(m => m.op === 'room');
  ok(/^[A-Z0-9]{4}$/.test(room.code), 'room code without prefix');
  b.send('join', { code: room.code });
  await b.wait(m => m.op === 'room' && m.players.length === 2);
  b.send('join', { code: 'ZZZ9' }); ok((await b.wait(m => m.op === 'error')).reason.includes('не найдена'), 'bad code');
  a.send('config', { cfg: { map: 'corridor', autoWave: false } });
  a.send('start'); ok((await a.wait(m => m.op === 'error')).reason.includes('готов'), 'needs ready');
  a.send('ready', { ready: true }); b.send('ready', { ready: true });
  await sleep(100);
  a.send('start');
  const vr = await a.wait(m => m.op === 'room' && m.state === 'vote');
  ok(vr.vote.options.includes('endless') && vr.vote.endsIn > 0, 'vote phase, endless opened by Борис');
  a.send('voteDiff', { diff: 'easy' }); b.send('voteDiff', { diff: 'easy' });
  const sa = await a.wait(m => m.op === 'start'), sb = await b.wait(m => m.op === 'start');
  ok(sa.mode === 'team' && sa.you === 'p1' && sb.you === 'p2' && sa.cfg.map === 'corridor' && sa.cfg.diff === 'easy', 'team start with voted diff');
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
  ok(rf.wallet('p1') === 300 - 120 && rf.wallet('p2') === 300, 'personal wallets');
  // у каждого свои деньги: оба могут купить по башне
  const far = spots.filter(s => Math.hypot(s.x - spots[0].x, s.z - spots[0].z) > 3);
  a.send('cmd', { seq: 2, cmd: { type: 'place', hero: 'ice', x: far[0].x, z: far[0].z } });
  b.send('cmd', { seq: 2, cmd: { type: 'place', hero: 'ice', x: far[40].x, z: far[40].z } });
  const ra = await a.wait(m => m.op === 'ack' && m.seq === 2), rb = await b.wait(m => m.op === 'ack' && m.seq === 2);
  ok(ra.ok && rb.ok, 'both buy with own money');
  await sleep(250);
  rf.apply(b.last.state.me);
  ok(rf.wallet('p1') === 40 && rf.wallet('p2') === 160 && rf.towers.length === 3, 'wallets after buys');
  const bt = rf.towers.find(t => t.owner === 'p2');
  a.send('cmd', { seq: 5, cmd: { type: 'upgrade', tower: bt.id, branch: 0 } });
  ok(!(await a.wait(m => m.op === 'ack' && m.seq === 5)).ok, 'cannot upgrade teammate tower');
  // 2 игрока — нужен 1 голос за пропуск
  a.send('cmd', { seq: 3, cmd: { type: 'wave' } });
  ok((await a.wait(m => m.op === 'ack' && m.seq === 3)).ok, 'wave start by one vote');
  await sleep(1500);
  const st3 = a.last.state.me; rf.apply(st3);
  ok(rf.waveNum === 1 && (rf.enemies.length > 0 || rf.kills > 0), 'wave running on server');
  a.send('leave'); b.send('leave'); await sleep(100);

  // 3 игрока в команде — нужно 2 голоса
  { const x = client('Вова'), y = client('Гена'), z = client('Даша'); await x.open; await y.open; await z.open;
    x.send('create', { mode: 'team' }); const rr = await x.wait(m => m.op === 'room');
    y.send('join', { code: rr.code }); z.send('join', { code: rr.code }); await x.wait(m => m.op === 'room' && m.players.length === 3);
    [x, y, z].forEach(c => c.send('ready', { ready: true })); await sleep(150); x.send('start');
    x.send('voteDiff', { diff: 'hard' }); y.send('voteDiff', { diff: 'easy' });
    const st = await x.wait(m => m.op === 'start', 5000); ok(['hard', 'easy'].includes(st.cfg.diff), 'tie → random of voted');
    x.send('cmd', { seq: 1, cmd: { type: 'skip' } }); await x.wait(m => m.op === 'ack' && m.seq === 1); await sleep(250);
    let s1 = x.last.state; ok(s1.me.wn === 0 && s1.sv[0].length === 1 && s1.sv[1] === 2, '3 players: 1 vote not enough');
    y.send('cmd', { seq: 1, cmd: { type: 'skip' } }); await y.wait(m => m.op === 'ack' && m.seq === 1); await sleep(250);
    ok(x.last.state.me.wn === 1, '3 players: 2 votes start wave');
    [x, y, z].forEach(c => c.ws.close()); }

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
