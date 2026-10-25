/* Игровой сервер «Защити микропета от ковтопа» для Node.js 18+ без npm-зависимостей.
   Раздаёт файлы игры и принимает WebSocket на /ws; вся игровая логика — в server/hub.js.
   Запуск: node server/server.js   (PORT=8787, TWITCH_CLIENT_ID=…, REQUIRE_TWITCH=1 — по желанию) */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { attach } = require('./ws');
const { createHub } = require('./hub');

const ROOT = path.join(__dirname, '..');
['data', 'sim', 'netproto'].forEach(f => require(path.join(ROOT, 'js', f + '.js')));
const K = globalThis.KV;

const PORT = +process.env.PORT || 8787;
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || '';
const REQUIRE_TWITCH = process.env.REQUIRE_TWITCH === '1';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
// Хранилище тегов и рейтинга: JSON-файл (DATA_FILE), запись не чаще раза в 2 секунды.
const DATA_FILE = process.env.DATA_FILE || path.join(ROOT, 'data', 'store.json');
function fileStore(file) {
  let m = new Map(), timer = null;
  try { m = new Map(Object.entries(JSON.parse(fs.readFileSync(file, 'utf8')))); } catch (e) { /* новый файл */ }
  const flush = () => { timer = null; try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file + '.tmp', JSON.stringify(Object.fromEntries(m))); fs.renameSync(file + '.tmp', file); } catch (e) { console.error('Не удалось сохранить данные:', e.message); } };
  process.on('exit', () => { if (timer) flush(); });
  return {
    get: async k => m.get(k),
    put: async (k, v) => { m.set(k, v); if (!timer) { timer = setTimeout(flush, 2000); timer.unref(); } },
    list: async pre => new Map([...m].filter(([k]) => k.startsWith(pre)))
  };
}
const hub = createHub(K, { twitchClientId: TWITCH_CLIENT_ID, googleClientId: GOOGLE_CLIENT_ID, requireTwitch: REQUIRE_TWITCH, store: process.env.NO_STORE ? null : fileStore(DATA_FILE), voteMs: +process.env.VOTE_MS || undefined });

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon' };
const configJs = () => 'globalThis.KV = globalThis.KV || {}; globalThis.KV.CONFIG = ' + JSON.stringify({ twitchClientId: TWITCH_CLIENT_ID, googleClientId: GOOGLE_CLIENT_ID, requireTwitch: REQUIRE_TWITCH, serverUrl: 'auto' }) + ';';
const wrapHtml = html => '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>' + html + '</body></html>';

function serveFile(req, res) {
  let url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/healthz') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(Object.assign({ ok: true }, hub.stats()))); return; }
  if (url === '/js/config.js') { res.writeHead(200, { 'Content-Type': MIME['.js'], 'Cache-Control': 'no-store' }); res.end(configJs()); return; }
  if (url === '/') url = '/index.html';
  const file = path.normalize(path.join(ROOT, url));
  if (!file.startsWith(ROOT) || /[\\/](server|test|worker|node_modules|data)[\\/]/.test(file.slice(ROOT.length)) || /[\\/]\./.test(file)) { res.writeHead(404); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Не найдено'); return; }
    const ext = path.extname(file);
    if (ext === '.html') data = wrapHtml(data);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

const server = http.createServer(serveFile);
attach(server, '/ws', ws => {
  const h = hub.connect(ws);
  ws.on('message', h.message);
  ws.on('close', h.close);
});
server.listen(PORT, () => console.log('Сервер микропета: http://localhost:' + PORT + '  (WebSocket /ws)'));
module.exports = { server, hub, rooms: hub.rooms, players: hub.players, wrapHtml, configJs };
