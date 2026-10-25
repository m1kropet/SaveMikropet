/* Сетевой клиент. Подключается к игровому серверу (server/server.js) по WebSocket.
   Если игра открыта с самого сервера, адрес определяется автоматически (CONFIG.serverUrl = 'auto').
   Локальная комната (игроки на одном устройстве) работает и без сервера. */
(function (K) {
  'use strict';

  const CODE_ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  function roomCode() {
    let s = '';
    for (let i = 0; i < 4; i++) s += CODE_ABC[Math.floor(Math.random() * CODE_ABC.length)];
    return s;
  }
  const cleanCode = c => String(c || '').trim().toUpperCase().replace(/^KV-/, '').replace(/^#/, '');
  const validCode = c => /^[A-Z0-9]{4}$/.test(cleanCode(c));

  // Локальная комната: 2–4 игрока по очереди строят на одном устройстве, деньги общие.
  class LocalRoom {
    constructor(hostNick) {
      this.code = roomCode();
      this.players = [{ id: 'p1', name: hostNick, color: K.PLAYER_COLORS[0], ready: false, host: true }];
      this.invites = [];
    }
    addLocal() {
      if (this.players.length >= 4) return { ok: false, reason: 'В комнате максимум 4 игрока' };
      const i = this.players.length;
      this.players.push({ id: 'p' + (i + 1), name: 'Игрок ' + (i + 1), color: K.PLAYER_COLORS[i], ready: false });
      return { ok: true };
    }
    remove(id) {
      const p = this.players.find(x => x.id === id);
      if (!p || p.host) return { ok: false };
      this.players = this.players.filter(x => x.id !== id);
      this.players.forEach((x, i) => { x.id = 'p' + (i + 1); x.color = K.PLAYER_COLORS[i]; });
      return { ok: true };
    }
    toggleReady(id) { const p = this.players.find(x => x.id === id); if (p) p.ready = !p.ready; }
    canStart() { return this.players.length >= 2 && this.players.every(p => p.ready); }
  }

  // Клиент сервера: одно соединение на вкладку, подписки на типы сообщений.
  const Net = {
    LocalRoom, roomCode, validCode, cleanCode,
    ws: null, state: 'off', handlers: {}, seq: 0, profile: null,
    url() {
      const u = K.CONFIG && K.CONFIG.serverUrl;
      if (!u) return null;
      if (u === 'auto') {
        if (!/^https?:$/.test(location.protocol)) return null;
        return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
      }
      return u;
    },
    available() { return !!this.url(); },
    get unavailableReason() { return 'Игровой сервер не подключён. Онлайн-комнаты, подбор соперника и общий рейтинг работают, когда игра открыта с запущенного сервера (node server/server.js) или в js/config.js указан его адрес.'; },
    on(op, fn) { (this.handlers[op] = this.handlers[op] || new Set()).add(fn); return () => this.handlers[op].delete(fn); },
    emit(op, m) { (this.handlers[op] || []).forEach(fn => { try { fn(m); } catch (e) { console.error(e); } }); },
    connect(profile) {
      this.profile = profile || this.profile;
      if (this.ws && (this.state === 'open' || this.state === 'connecting')) return this.ready;
      const url = this.url();
      if (!url) return Promise.reject(new Error(this.unavailableReason));
      this.state = 'connecting';
      this.ready = new Promise((resolve, reject) => {
        let ws;
        try { ws = new WebSocket(url); } catch (e) { this.state = 'off'; reject(new Error('Соединение запрещено браузером')); return; }
        this.ws = ws;
        const timer = setTimeout(() => { if (this.state === 'connecting') { try { ws.close(); } catch (e) { /* */ } this.state = 'off'; reject(new Error('Сервер не отвечает')); } }, 6000);
        ws.onopen = () => {
          clearTimeout(timer);
          this.state = 'open';
          this.hello();
          resolve(this);
        };
        ws.onerror = () => { clearTimeout(timer); if (this.state === 'connecting') { this.state = 'off'; reject(new Error('Сервер недоступен')); } };
        ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (err) { return; } this.emit(m.op, m); this.emit('*', m); };
        ws.onclose = () => { const was = this.state; this.state = 'off'; this.ws = null; if (was === 'open') this.emit('close', {}); };
      });
      return this.ready;
    },
    hello() {
      const p = this.profile || {};
      this.send('hello', { nick: p.nick, level: p.level, squad: p.squad, token: K.Twitch && K.Twitch.token(), uid: p.uid, tag: p.tag, endless: !!p.endlessUnlocked });
    },
    send(op, data) {
      if (!this.ws || this.state !== 'open') return false;
      this.ws.send(JSON.stringify(Object.assign({ op }, data || {})));
      return true;
    },
    command(cmd) { const seq = ++this.seq; this.send('cmd', { seq, cmd }); return seq; },
    close() { if (this.ws) this.ws.close(); }
  };

  K.Net = Net;
})(globalThis.KV = globalThis.KV || {});
