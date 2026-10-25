// Проверка собранного Cloudflare Worker в Node с имитацией среды Workers (WebSocketPair, Assets, Durable Object).
import assert from 'assert';
import fs from 'fs';
class MockSock { constructor() { this.readyState = 1; this.l = {}; this.out = []; } accept() { this.accepted = true; } addEventListener(t, f) { (this.l[t] = this.l[t] || []).push(f); } send(t) { this.out.push(JSON.parse(t)); } close() { this.readyState = 3; } fire(t, e) { (this.l[t] || []).forEach(f => f(e)); } }
globalThis.WebSocketPair = function () { const c = new MockSock(), s = new MockSock(); return { 0: c, 1: s }; };
const RealResponse = globalThis.Response;
globalThis.Response = class extends RealResponse { constructor(body, init) { const st = init && init.status === 101; super(body, st ? Object.assign({}, init, { status: 200 }) : init); if (st) { this.webSocket = init.webSocket; this.ws101 = true; } } };
const mod = await import('/tmp/claude-0/worker.bundle.mjs');
const files = { '/index.html': fs.readFileSync('index.html', 'utf8') };
let hubObj = null;
const env = {
  ASSETS: { fetch: async req => { const p = new URL(req.url).pathname; return files[p] ? new RealResponse(files[p], { headers: { 'Content-Type': 'text/html' } }) : new RealResponse('nf', { status: 404 }); } },
  HUB: { idFromName: n => n, get: () => (hubObj = hubObj || new mod.GameHub({}, {})) }
};
let checks = 0; const ok = (c, m) => { assert(c, m); checks++; };
const html = await (await mod.default.fetch(new Request('https://x.workers.dev/'), env)).text();
ok(html.startsWith('<!doctype html>') && html.includes('js/main.js'), 'index wrapped');
ok((await (await mod.default.fetch(new Request('https://x.workers.dev/js/config.js'), env)).text()).includes('"serverUrl":"auto"'), 'config');
const connect = async () => {
  const res = await mod.default.fetch(new Request('https://x.workers.dev/ws', { headers: { Upgrade: 'websocket' } }), env);
  ok(res.ws101, 'upgrade 101');
  // сокет «сервера» — тот, что принят в объекте; клиент получает его исходящие сообщения
  const srv = [...hubObj.hub.players.keys()].pop();
  return { srv, send: (op, d) => srv.fire('message', { data: JSON.stringify(Object.assign({ op }, d || {})) }), msgs: () => srv.out };
};
const a = await connect(), b = await connect();
a.send('hello', { nick: 'Аня', level: 3, squad: ['blaster'] }); b.send('hello', { nick: 'Боря', level: 4, squad: ['ice'] });
a.send('publicJoin', { size: 2 }); b.send('publicJoin', { size: 2 });
await new Promise(r => setTimeout(r, 300));
const room = a.msgs().filter(m => m.op === 'room').pop();
ok(room && room.players.length === 2 && room.startsIn > 4000, 'public lobby full, countdown');
await new Promise(r => setTimeout(r, 5300));
ok(a.msgs().some(m => m.op === 'start') && b.msgs().some(m => m.op === 'start'), 'auto start in Durable Object');
await new Promise(r => setTimeout(r, 400));
ok(a.msgs().some(m => m.op === 'state' && m.me), 'state snapshots');
a.srv.fire('close', {}); b.srv.fire('close', {});
ok(hubObj.hub.players.size === 0, 'cleanup');
hubObj.hub.stop();
console.log('WORKER OK', checks, 'checks');
process.exit(0);
