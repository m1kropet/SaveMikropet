/* Игровой «хаб»: комнаты, публичные лобби, подбор дуэлей, авторитетная симуляция, рейтинг.
   Не зависит от платформы: одинаково работает в Node.js (server/server.js) и в Cloudflare
   Durable Object (worker/worker.js). Сокет — любой объект с readyState, send(text) и close(). */
'use strict';
function createHub(K, opts) {
  opts = opts || {};
  const TWITCH_CLIENT_ID = opts.twitchClientId || '';
  const REQUIRE_TWITCH = !!opts.requireTwitch;
  const GOOGLE_CLIENT_ID = opts.googleClientId || '';
  const SEND_EVERY = 0.1;
  const MAX_ROOMS = opts.maxRooms || 500;
  const later = (fn, ms) => { const t = setTimeout(fn, ms || 0); if (t && t.unref) t.unref(); return t; };
  // Постоянное хранилище (теги, рейтинг). По умолчанию — в памяти.
  const store = opts.store || (() => { const m = new Map(); return { get: async k => m.get(k), put: async (k, v) => { m.set(k, v); }, list: async pre => new Map([...m].filter(([k]) => k.startsWith(pre))) }; })();
  const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const rnd = n => Array.from({ length: n }, () => ABC[Math.floor(Math.random() * ABC.length)]).join('');
  const VOTE_MS = opts.voteMs || 30000;
  const GIFT_ALL = new Set((opts.giftAllTags || K.GIFT_ALL_TAGS || []).map(t => String(t).toUpperCase()));

  // ---------- Игроки и комнаты ----------
  const players = new Map();   // ws -> player
  const rooms = new Map();     // code -> room
  const queue = [];            // ожидающие случайного соперника
  const ladder = new Map();    // рейтинг подтверждённых Twitch-игроков (в памяти процесса)

  const code = () => { let c; do { c = rnd(4); } while (rooms.has(c)); return c; };
  const send = (p, op, d) => { if (p.ws.readyState === 1) p.ws.send(JSON.stringify(Object.assign({ op }, d || {}))); };
  const cleanNick = n => String(n || 'Игрок').replace(/[^\p{L}\p{N}_\- .]/gu, '').trim().slice(0, 16) || 'Игрок';
  const cleanSquad = s => [...new Set((Array.isArray(s) ? s : []).filter(h => K.HERO[h]))].slice(0, K.SQUAD_MAX);

  function roomView(r) {
    return {
      code: r.code, mode: r.mode, state: r.state, host: r.players[0] ? r.players[0].pid : null, cfg: r.cfg,
      public: r.public || 0, startsIn: r.countdownAt ? Math.max(0, r.countdownAt - Date.now()) : null,
      vote: r.state === 'vote' ? { endsIn: Math.max(0, r.voteEnd - Date.now()), options: r.voteOptions, counts: Object.fromEntries(r.voteOptions.map(d => [d, [...r.votes.values()].filter(v => v === d).length])), voted: r.votes.size } : null,
      players: r.players.map(p => ({ id: p.pid, name: p.name, tag: p.tag || '', color: p.color, ready: p.ready, level: p.level, verified: !!(p.twitch || p.google), eye: !!p.eye, squad: p.squad, voted: !!(r.votes && r.votes.has(p)) }))
    };
  }
  const broadcastRoom = r => r.players.forEach(p => send(p, 'room', Object.assign(roomView(r), { you: p.pid, myVote: r.votes ? r.votes.get(p) || null : null })));

  // ---------- Публичные лобби: 2, 3 и 4 игрока, старт через 5 секунд после заполнения ----------
  const PUBLIC_SIZES = [2, 3, 4];
  const COUNTDOWN_MS = 5000;
  function publicSummary() {
    const out = {};
    PUBLIC_SIZES.forEach(n => { out[n] = 0; });
    for (const r of rooms.values()) if (r.public && r.state === 'lobby') out[r.public] = Math.max(out[r.public], r.players.length);
    return { sizes: out, online: players.size };
  }
  let summaryQueued = false;
  function broadcastPublics() {
    if (summaryQueued) return;
    summaryQueued = true;
    later(() => {
      summaryQueued = false;
      const msg = JSON.stringify(Object.assign({ op: 'publics' }, publicSummary()));
      for (const p of players.values()) if ((!p.room || p.room.state === 'lobby') && p.ws.readyState === 1) p.ws.send(msg);
    });
  }
  function joinPublic(p, size) {
    if (!PUBLIC_SIZES.includes(size)) return send(p, 'error', { reason: 'Нет такого лобби' });
    if (p.room && p.room.public === size && p.room.state === 'lobby') return;
    // самое заполненное открытое лобби нужного размера, иначе новое
    let r = null;
    for (const x of rooms.values()) if (x.public === size && x.state === 'lobby' && x.players.length < size && (!r || x.players.length > r.players.length)) r = x;
    if (!r) {
      if (rooms.size >= MAX_ROOMS) return send(p, 'error', { reason: 'Сервер переполнен, попробуйте позже' });
      const map = K.MAPS[Math.floor(Math.random() * K.MAPS.length)].id;
      r = { code: code(), mode: 'team', state: 'lobby', public: size, players: [], cfg: { map, diff: 'normal', autoWave: true } };
      rooms.set(r.code, r);
    }
    joinRoom(p, r);
  }
  function checkCountdown(r) {
    if (!r.public || r.state !== 'lobby') return;
    const full = r.players.length >= r.public;
    if (full && !r.countdownAt) { r.countdownAt = Date.now() + COUNTDOWN_MS; broadcastRoom(r); }
    else if (!full && r.countdownAt) { r.countdownAt = null; broadcastRoom(r); }
  }

  function leaveRoom(p, why) {
    const r = p.room;
    if (!r) return;
    p.room = null; p.ready = false;
    r.players = r.players.filter(x => x !== p);
    if (r.state === 'playing' && r.mode === 'duel' && r.duel && !r.duel.over) {
      // ушедший игрок проигрывает, оставшемуся — победа
      const rest = r.players[0];
      if (rest) endDuel(r, rest.side === 'a' ? 'win' : 'lose', why || 'Соперник покинул матч');
    }
    if (!r.players.length) { rooms.delete(r.code); broadcastPublics(); return; }
    if (r.state === 'lobby') { r.players.forEach((x, i) => { x.pid = 'p' + (i + 1); x.color = K.PLAYER_COLORS[i]; }); r.countdownAt = null; checkCountdown(r); broadcastRoom(r); }
    if (r.state === 'vote') { r.votes.delete(p); broadcastRoom(r); }
    if (r.public) broadcastPublics();
  }

  function createRoom(p, mode) {
    if (rooms.size >= MAX_ROOMS) return send(p, 'error', { reason: 'Сервер переполнен, попробуйте позже' });
    leaveRoom(p);
    const r = { code: code(), mode: mode === 'duel' ? 'duel' : 'team', state: 'lobby', players: [], cfg: { map: 'lobby', diff: 'normal', autoWave: true } };
    rooms.set(r.code, r);
    joinRoom(p, r);
  }
  function joinRoom(p, r) {
    const max = r.public || (r.mode === 'duel' ? 2 : 4);
    if (r.state !== 'lobby') return send(p, 'error', { reason: 'Матч в этой комнате уже идёт' });
    if (r.players.length >= max) return send(p, 'error', { reason: 'Комната заполнена' });
    leaveRoom(p);
    p.room = r; p.ready = false;
    r.players.push(p);
    r.players.forEach((x, i) => { x.pid = 'p' + (i + 1); x.color = K.PLAYER_COLORS[i]; });
    broadcastRoom(r);
    checkCountdown(r);
    if (r.public) broadcastPublics();
  }

  // ---------- Голосование за сложность (30 секунд) ----------
  function beginVote(r) {
    r.state = 'vote'; r.countdownAt = null;
    r.voteEnd = Date.now() + VOTE_MS;
    r.votes = new Map();
    // бесконечный режим доступен, если он открыт хотя бы у одного игрока
    r.voteOptions = ['easy', 'normal', 'hard'].concat(r.players.some(p => p.endless) ? ['endless'] : []);
    if (r.public) broadcastPublics();
    broadcastRoom(r);
  }
  function finishVote(r) {
    const counts = new Map(r.voteOptions.map(d => [d, 0]));
    for (const v of r.votes.values()) counts.set(v, counts.get(v) + 1);
    const best = Math.max(...counts.values());
    // при равенстве голосов — случайная из выбранных; если никто не голосовал — «Нормально»
    const top = best > 0 ? [...counts].filter(([, c]) => c === best).map(([d]) => d) : ['normal'];
    r.cfg.diff = top[Math.floor(Math.random() * top.length)];
    r.votes = null;
    startTeam(r);
  }

  // ---------- Запуск матчей ----------
  function startTeam(r) {
    const union = [...new Set(r.players.flatMap(p => p.squad))];
    const f = new K.Field({ map: r.cfg.map, diff: r.cfg.diff, seed: (Math.random() * 2 ** 31) >>> 0, mode: 'team', squad: union, players: r.players.map(p => ({ id: p.pid, name: p.name, color: p.color, eye: !!p.eye })), autoWave: !!r.cfg.autoWave, record: true });
    f.squad = union; // в команде доступны герои всех участников
    r.field = f; r.state = 'playing'; r.sendT = 0; r.countdownAt = null; r.skipVotes = new Set(); r.skipWave = -1;
    if (r.public) broadcastPublics();
    r.players.forEach(p => send(p, 'start', { mode: 'team', you: p.pid, seed: f.seed, cfg: r.cfg, diffName: K.DIFFS[r.cfg.diff].name, squad: p.squad, players: f.players }));
  }
  function startDuel(r, map) {
    const [a, b] = r.players;
    a.side = 'a'; b.side = 'b';
    const seed = (Math.random() * 2 ** 31) >>> 0;
    r.cfg = Object.assign({}, r.cfg, { map: map || r.cfg.map });
    r.duel = new K.DuelMatch({ map: r.cfg.map, seed, squadA: a.squad, squadB: b.squad, recordB: true, cap: 1500,
      playersA: [{ id: a.pid, name: a.name, color: K.PLAYER_COLORS[0] }], playersB: [{ id: b.pid, name: b.name, color: K.PLAYER_COLORS[1] }] });
    r.state = 'playing'; r.sendT = 0;
    [a, b].forEach(p => {
      const o = p === a ? b : a;
      send(p, 'start', { mode: 'duel', you: p.pid, seed, cfg: r.cfg, squad: p.squad, oppSquad: o.squad, opp: { name: o.name, level: o.level, verified: !!(o.twitch || o.google) }, players: (p === a ? r.duel.a : r.duel.b).players, oppPlayers: (p === a ? r.duel.b : r.duel.a).players });
    });
  }
  function endDuel(r, resultA, reason) {
    if (r.ended) return;
    r.ended = true;
    const flip = { win: 'lose', lose: 'win', draw: 'draw' };
    const d = r.duel;
    if (!d.over) { d.over = true; d.result = resultA; d.reason = reason; }
    r.players.concat(r.gone || []).forEach(p => {
      const res = p.side === 'a' ? d.result : flip[d.result];
      if (p.ws.readyState === 1) send(p, 'over', { result: res, reason: d.reason });
      record(p, row => ({ duelWins: row.duelWins + (res === 'win' ? 1 : 0), time: row.time + Math.round(d.time), level: Math.max(row.level, p.level || 1) }));
    });
    later(() => rooms.delete(r.code), 5000);
  }

  function matchmake() {
    while (queue.length >= 2) {
      // ближайший по уровню из первых в очереди
      const a = queue.shift();
      let bi = 0, best = Infinity;
      queue.forEach((q, i) => { const d = Math.abs((q.level || 1) - (a.level || 1)); if (d < best) { best = d; bi = i; } });
      const b = queue.splice(bi, 1)[0];
      const r = { code: code(), mode: 'duel', state: 'lobby', players: [], cfg: { map: K.MAPS[Math.floor(Math.random() * K.MAPS.length)].id } };
      rooms.set(r.code, r);
      [a, b].forEach(p => { p.queued = false; p.room = r; r.players.push(p); });
      r.players.forEach((x, i) => { x.pid = 'p' + (i + 1); x.color = K.PLAYER_COLORS[i]; });
      startDuel(r);
    }
  }

  // ---------- Twitch ----------
  async function verifyTwitch(token) {
    const r = await fetch('https://id.twitch.tv/oauth2/validate', { headers: { Authorization: 'OAuth ' + token } });
    if (!r.ok) throw new Error('Токен Twitch недействителен');
    const v = await r.json();
    if (TWITCH_CLIENT_ID && v.client_id !== TWITCH_CLIENT_ID) throw new Error('Токен выдан другому приложению');
    return { id: v.user_id, login: v.login };
  }
  // ---------- Google ----------
  async function verifyGoogle(token) {
    if (!GOOGLE_CLIENT_ID) throw new Error('Вход через Google на сервере не настроен');
    const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token));
    if (!r.ok) throw new Error('Вход Google недействителен');
    const c = await r.json();
    if (c.aud !== GOOGLE_CLIENT_ID) throw new Error('Токен Google выдан другому приложению');
    if ((+c.exp || 0) * 1000 < Date.now()) throw new Error('Вход Google истёк — войдите заново');
    if (c.email && String(c.email_verified) !== 'true') throw new Error('Почта Google не подтверждена');
    return { id: String(c.sub), email: String(c.email || '') };
  }
  // ключ рейтинга: Twitch или Google
  const ladderId = p => p.twitch ? p.twitch.id : p.google ? 'g' + p.google.id : null;
  async function record(p, patch) {
    const id = ladderId(p);
    if (!id) return;
    const key = 'ladder:' + id;
    const row = ladder.get(id) || (await store.get(key)) || { nick: p.twitch ? p.twitch.login : p.name, level: 1, endless: 0, duelWins: 0, time: 0 };
    Object.assign(row, patch(row), { tag: p.tag || row.tag || '', eye: !!p.eye || !!row.eye });
    ladder.set(id, row);
    await store.put(key, row);
  }

  // ---------- Теги игроков #XXX ----------
  // Тег случайный и не меняется. Когда все теги длины N заняты, выдаются теги длины N+1.
  const reserving = new Set();
  async function newTag() {
    for (let len = 3; len < 12; len++) {
      const cap = Math.pow(ABC.length, len);
      const used = (await store.get('tagn:' + len)) || 0;
      if (used >= cap) continue;
      for (let i = 0; i < 400; i++) {
        const t = rnd(len);
        if (reserving.has(t) || await store.get('tag:' + t)) continue;
        reserving.add(t);
        return t;
      }
    }
    throw new Error('Не удалось выдать тег');
  }
  async function ensureTag(p, uid, wanted) {
    if (!/^[a-f0-9]{16,64}$/.test(uid || '')) return null;
    let tag = await store.get('uid:' + uid);
    if (!tag) {
      wanted = String(wanted || '').toUpperCase().replace(/^#/, '');
      // локальный тег сохраняем, если он свободен
      if (/^[A-Z0-9]{3,11}$/.test(wanted) && !reserving.has(wanted) && !(await store.get('tag:' + wanted))) { reserving.add(wanted); tag = wanted; }
      else tag = await newTag();
      await store.put('uid:' + uid, tag);
      await store.put('tagn:' + tag.length, ((await store.get('tagn:' + tag.length)) || 0) + 1);
      reserving.delete(tag);
    }
    await store.put('tag:' + tag, { uid, nick: p.name, level: p.level, seen: Date.now() });
    return tag;
  }

  // ---------- Сообщения ----------
  function onMessage(p, raw) {
    let m;
    try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m.op !== 'string') return;
    // ограничение частоты: не больше 30 сообщений в секунду
    const now = Date.now();
    if (now - p.rateT > 1000) { p.rateT = now; p.rateN = 0; }
    if (++p.rateN > 30) return;
    const r = p.room;
    switch (m.op) {
      case 'hello':
        p.name = cleanNick(m.nick); p.level = Math.max(1, Math.min(999, m.level | 0)); p.squad = cleanSquad(m.squad);
        if (!p.squad.length) p.squad = ['blaster', 'ice'];
        p.endless = !!m.endless;
        p.eye = !!m.eye;
        if (m.token) verifyTwitch(String(m.token)).then(tw => { p.twitch = tw; p.name = cleanNick(tw.login); send(p, 'authed', tw); }, e => send(p, 'error', { reason: e.message }));
        if (m.gtoken) verifyGoogle(String(m.gtoken)).then(g => { p.google = g; send(p, 'authed', { google: true, login: g.email }); }, e => send(p, 'error', { reason: e.message }));
        if (m.uid) ensureTag(p, String(m.uid), m.tag).then(tag => {
          if (!tag) return;
          p.tag = tag; send(p, 'tag', { tag });
          // тег закреплён за этим uid на сервере — подарок получает только его владелец
          if (GIFT_ALL.has(tag)) send(p, 'grant', { heroes: K.HEROES.map(h => h.id) });
          if (p.room && p.room.state === 'lobby') broadcastRoom(p.room);
        }, () => {});
        send(p, 'hello', { online: players.size, requireTwitch: REQUIRE_TWITCH });
        send(p, 'publics', publicSummary());
        return;
      case 'leaders':
        store.list('ladder:').then(rows => {
          const online = new Set([...players.values()].filter(q => q.twitch).map(q => q.twitch.login));
          send(p, 'leaders', { rows: [...rows.values()].map(x => Object.assign({ verified: true, online: online.has(x.nick) }, x)).sort((a, b) => b.duelWins - a.duelWins).slice(0, 100) });
        }, () => send(p, 'leaders', { rows: [] }));
        return;
      case 'findTag': {
        const t = String(m.tag || '').toUpperCase().replace(/^#/, '');
        if (!/^[A-Z0-9]{3,11}$/.test(t)) return send(p, 'found', { tag: t, player: null });
        store.get('tag:' + t).then(row => {
          const on = [...players.values()].some(q => q.tag === t);
          send(p, 'found', { tag: t, player: row ? { tag: t, nick: row.nick, level: row.level, online: on } : null });
        }, () => send(p, 'found', { tag: t, player: null }));
        return;
      }
    }
    if (REQUIRE_TWITCH && !p.twitch && !p.google) return send(p, 'error', { reason: 'Сначала войдите через Twitch или Google' });
    switch (m.op) {
      case 'squad': p.squad = cleanSquad(m.squad); if (r && r.state === 'lobby') broadcastRoom(r); break;
      case 'create': createRoom(p, m.mode); break;
      case 'publicJoin': joinPublic(p, m.size | 0); break;
      case 'publics': send(p, 'publics', publicSummary()); break;
      case 'voteDiff':
        if (r && r.state === 'vote' && r.voteOptions.includes(m.diff)) { r.votes.set(p, m.diff); broadcastRoom(r); }
        break;
      case 'join': {
        const room = rooms.get(String(m.code || '').trim().toUpperCase().replace(/^KV-/, '').replace(/^#/, ''));
        if (!room) return send(p, 'error', { reason: 'Комната не найдена. Проверьте код.' });
        joinRoom(p, room);
        break;
      }
      case 'leave': leaveRoom(p); send(p, 'left', {}); break;
      case 'ready': if (r && r.state === 'lobby') { p.ready = !!m.ready; broadcastRoom(r); } break;
      case 'config':
        if (r && r.state === 'lobby' && r.players[0] === p && m.cfg) {
          if (K.MAP[m.cfg.map]) r.cfg.map = m.cfg.map;
          r.cfg.autoWave = !!m.cfg.autoWave;
          broadcastRoom(r);
        }
        break;
      case 'start':
        if (!r || r.state !== 'lobby' || r.players[0] !== p) return;
        if (r.public) return send(p, 'error', { reason: 'Публичное лобби стартует само, когда заполнится' });
        if (r.mode === 'team') { if (r.players.length < 2 || !r.players.every(x => x.ready)) return send(p, 'error', { reason: 'Нужно минимум 2 игрока, и все должны быть готовы' }); beginVote(r); }
        else { if (r.players.length !== 2 || !r.players.every(x => x.ready)) return send(p, 'error', { reason: 'Нужен второй игрок, и оба должны быть готовы' }); startDuel(r); }
        break;
      case 'queue':
        leaveRoom(p);
        if (!p.queued) { p.queued = true; queue.push(p); }
        send(p, 'queued', { size: queue.length });
        matchmake();
        break;
      case 'unqueue': { const i = queue.indexOf(p); if (i >= 0) queue.splice(i, 1); p.queued = false; send(p, 'unqueued', {}); break; }
      case 'view': p.viewOpp = !!m.opp; break;
      case 'cmd': {
        if (!r || r.state !== 'playing' || !m.cmd || typeof m.cmd !== 'object') return;
        const f = r.duel ? r.duel[p.side] : r.field;
        if (!f || f.over) return;
        const c = { type: String(m.cmd.type), hero: m.cmd.hero, x: +m.cmd.x, z: +m.cmd.z, tower: m.cmd.tower | 0, branch: m.cmd.branch | 0, skill: m.cmd.skill, mode: m.cmd.mode, owner: p.pid, nonce: p.pid + ':' + (m.seq | 0) };
        if (c.type === 'place' && !p.squad.includes(c.hero)) return send(p, 'ack', { seq: m.seq, ok: false, reason: 'Этого героя нет в вашем отряде' });
        if (r.duel && (c.type === 'wave' || c.type === 'skip')) return send(p, 'ack', { seq: m.seq, ok: false, reason: 'В дуэли волны общие и запускаются сами' });
        if (c.type === 'wave' || c.type === 'skip') {
          // пропуск волны голосованием: 1–2 игрока — 1 голос, 3–4 игрока — 2 голоса
          if (r.skipWave !== f.waveNum) { r.skipVotes = new Set(); r.skipWave = f.waveNum; }
          if (!f.canSkip()) return send(p, 'ack', { seq: m.seq, ok: false, reason: 'Дождитесь, пока выйдут все сущности волны', type: 'skip' });
          r.skipVotes.add(p.pid);
          const need = Math.ceil(r.players.length / 2);
          if (r.skipVotes.size >= need) { f.skip(); r.skipVotes = new Set(); r.skipWave = f.waveNum; }
          return send(p, 'ack', { seq: m.seq, ok: true, type: 'skip' });
        }
        // Однопоточная симуляция: проверка баланса и списание происходят атомарно внутри field.cmd.
        const res = f.cmd(c);
        send(p, 'ack', { seq: m.seq, ok: res.ok, reason: res.ok ? null : res.reason, type: c.type, tower: res.tower ? res.tower.id : null, refund: res.refund });
        break;
      }
    }
  }

  // ---------- Цикл симуляции ----------
  let last = Date.now(), acc = 0, timer = null;
  function tick() {
    const now = Date.now();
    acc += Math.min(0.25, (now - last) / 1000); last = now;
    let steps = 0;
    while (acc >= K.STEP && steps < 20) {
      for (const r of rooms.values()) {
        if (r.state !== 'playing') continue;
        if (r.field && !r.field.over) r.field.step(K.STEP);
        if (r.duel && !r.duel.over) r.duel.step(K.STEP);
      }
      acc -= K.STEP; steps++;
    }
    for (const r of rooms.values()) {
      if (r.state === 'lobby' && r.countdownAt && now >= r.countdownAt) {
        if (r.players.length >= r.public) beginVote(r); else { r.countdownAt = null; broadcastRoom(r); }
      }
      if (r.state === 'vote' && (now >= r.voteEnd || r.votes.size >= r.players.length)) finishVote(r);
      if (r.state !== 'playing') continue;
      if (now - (r.lastSend || 0) < SEND_EVERY * 1000) continue;
      r.lastSend = now;
      if (r.field) {
        if (r.skipWave !== r.field.waveNum) { r.skipVotes = new Set(); r.skipWave = r.field.waveNum; }
        const snap = JSON.stringify({ op: 'state', me: K.NetProto.snapField(r.field, { events: r.field.events.splice(0) }), sv: [[...r.skipVotes], Math.ceil(r.players.length / 2)] });
        r.players.forEach(p => { if (p.ws.readyState === 1) p.ws.send(snap); });
        if (r.field.over && !r.ended) {
          r.ended = true;
          r.players.forEach(p => { send(p, 'over', { result: r.field.result, reason: '' }); record(p, row => ({ level: Math.max(row.level, p.level || 1), endless: r.field.diffKey === 'endless' ? Math.max(row.endless, r.field.wavesCleared) : row.endless, time: row.time + Math.round(r.field.time) })); });
          later(() => rooms.delete(r.code), 5000);
        }
      } else if (r.duel) {
        const d = r.duel;
        const evA = d.a.events.splice(0), evB = d.b.events.splice(0);
        r.players.forEach(p => {
          const mine = p.side === 'a' ? d.a : d.b, opp = p.side === 'a' ? d.b : d.a;
          const w = d.waiting();
          const waitMine = w === null ? null : p.side === 'a' ? w : (w === 'me' ? 'opp' : 'me');
          send(p, 'state', {
            me: K.NetProto.snapField(mine, { events: p.side === 'a' ? evA : evB }),
            opp: K.NetProto.snapField(opp, { proj: !!p.viewOpp, events: p.viewOpp ? (p.side === 'a' ? evB : evA) : [] }),
            d: { t: Math.round(d.time * 10) / 10, gap: d.gap == null ? null : Math.round(d.gap * 10) / 10, w: waitMine }
          });
        });
        if (d.over && !r.ended) endDuel(r, d.result, d.reason);
      }
    }
    if (!players.size && !rooms.size && timer) { clearInterval(timer); timer = null; }
  }


  function connect(ws) {
    const p = { ws, name: 'Игрок', level: 1, squad: ['blaster', 'ice'], room: null, rateT: 0, rateN: 0 };
    players.set(ws, p);
    if (!timer) { last = Date.now(); acc = 0; timer = setInterval(tick, 1000 / 60); }
    later(broadcastPublics, 50);
    return {
      message: text => onMessage(p, text),
      close: () => {
        if (!players.has(ws)) return;
        const i = queue.indexOf(p); if (i >= 0) queue.splice(i, 1);
        const r = p.room;
        if (r) { r.gone = (r.gone || []).concat(p); leaveRoom(p, 'Соперник отключился'); }
        players.delete(ws);
        broadcastPublics();
      }
    };
  }
  return { connect, rooms, players, stats: () => ({ rooms: rooms.size, players: players.size }), stop: () => { if (timer) clearInterval(timer); timer = null; } };
}
if (typeof module !== 'undefined') module.exports = { createHub };
