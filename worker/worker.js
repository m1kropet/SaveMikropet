/* Cloudflare Worker: постоянная ссылка на игру с любого устройства.
   Worker раздаёт файлы игры (Workers Assets), а все WebSocket-подключения ведёт в один
   Durable Object «GameHub», где работает тот же игровой хаб, что и в Node-сервере. */
import '../js/data.js';
import '../js/sim.js';
import '../js/netproto.js';
import { createHub } from '../server/hub.js';

const K = globalThis.KV;
const wrapHtml = html => '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>' + html + '</body></html>';

export class GameHub {
  constructor(state, env) {
    this.state = state;
    // теги и рейтинг хранятся в постоянном хранилище Durable Object
    const st = state.storage;
    const store = st ? { get: k => st.get(k), put: (k, v) => st.put(k, v), list: pre => st.list({ prefix: pre }) } : null;
    this.hub = createHub(K, { twitchClientId: env.TWITCH_CLIENT_ID || '', requireTwitch: env.REQUIRE_TWITCH === '1', store });
  }
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/healthz') return new Response(JSON.stringify(Object.assign({ ok: true }, this.hub.stats())), { headers: { 'Content-Type': 'application/json' } });
    if ((request.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') return new Response('Ожидается WebSocket', { status: 426 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    const h = this.hub.connect(server);
    server.addEventListener('message', e => {
      if (typeof e.data !== 'string' || e.data.length > 65536) return;
      h.message(e.data);
    });
    server.addEventListener('close', () => h.close());
    server.addEventListener('error', () => h.close());
    return new Response(null, { status: 101, webSocket: client });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // одна общая «комната ожидания» для всех игроков мира
    if (url.pathname === '/ws' || url.pathname === '/healthz') return env.HUB.get(env.HUB.idFromName('main')).fetch(request);
    if (url.pathname === '/js/config.js') {
      const cfg = { twitchClientId: env.TWITCH_CLIENT_ID || '', requireTwitch: env.REQUIRE_TWITCH === '1', serverUrl: 'auto' };
      return new Response('globalThis.KV = globalThis.KV || {}; globalThis.KV.CONFIG = ' + JSON.stringify(cfg) + ';', { headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' } });
    }
    if (url.pathname === '/' || url.pathname === '/index.html') {
      // Assets отдаёт index.html по адресу «/», а «/index.html» перенаправляет на «/» — берём сразу «/»
      const res = await env.ASSETS.fetch(new Request(new URL('/', url), { method: 'GET' }));
      if (!res.ok) return res;
      return new Response(wrapHtml(await res.text()), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' } });
    }
    return env.ASSETS.fetch(request);
  }
};
