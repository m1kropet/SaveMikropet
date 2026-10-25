/* Сохранение прогресса: версионированный формат, миграции, защита от повреждённых данных.
   Плюс правила аккаунта: опыт, уровни, достижения, применение итогов матча. */
(function (K) {
  'use strict';
  const KEY = 'mikropet.save';
  const VERSION = 5;
  const STARTERS = ['blaster', 'ice'];

  const TAG_ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const randTag = () => Array.from({ length: 3 }, () => TAG_ABC[Math.floor(Math.random() * TAG_ABC.length)]).join('');
  const randUid = () => { const b = new Uint8Array(12); (globalThis.crypto && crypto.getRandomValues) ? crypto.getRandomValues(b) : b.forEach((_, i) => { b[i] = Math.floor(Math.random() * 256); }); return Array.from(b, x => x.toString(16).padStart(2, '0')).join(''); };

  function defaults() {
    const now = Date.now();
    return {
      v: VERSION,
      // тег #XXX: выдаётся один раз и не меняется; сервер подтверждает уникальность
      uid: randUid(), tag: randTag(), tagVerified: false,
      themes: ['hotel'], codes: [],
      eye: false, kovCode: '',
      nick: 'Постоялец' + Math.floor(100 + Math.random() * 900),
      level: 1, xp: 0, coins: 150,
      owned: STARTERS.slice(), squad: STARTERS.slice(),
      maxWave: 0,
      endless: { best: 0, bestTime: 0 },
      endlessUnlocked: false,
      duel: { w: 0, l: 0, d: 0, maxWave: 0, history: [] },
      playTime: 0,
      settings: { sound: true, autoWave: false, quality: 'mid', effects: true, theme: 'hotel' },
      achievements: {},
      stats: { kills: 0, games: 0, wavesTotal: 0, wins: { easy: 0, normal: 0, hard: 0 }, team: 0, maxTier: false, secret: false },
      friends: {
        list: [{ nick: 'Ночной портье', since: now }],
        incoming: [{ nick: 'Фонарик', at: now }, { nick: 'Зеркальце', at: now }],
        outgoing: []
      },
      last: { map: 'lobby', diff: 'easy', duelMap: 'corridor' },
      twitch: null,
      createdAt: now, savedAt: now
    };
  }

  // Миграции: каждая поднимает формат на одну версию.
  const MIGRATIONS = {
    1: d => { d.coins = d.money != null ? d.money : d.coins; delete d.money; d.v = 2; return d; },
    2: d => {
      const def = defaults();
      d.friends = d.friends || def.friends;
      d.settings = Object.assign({}, def.settings, d.settings || {});
      d.endless = d.endless || { best: d.endlessBest || 0, bestTime: 0 };
      delete d.endlessBest;
      d.v = 3;
      return d;
    },
    3: d => { d.twitch = null; if (d.last) delete d.last.bot; d.v = 4; return d; },
    4: d => { d.uid = randUid(); d.tag = randTag(); d.tagVerified = false; d.themes = ['hotel']; d.codes = []; d.settings = Object.assign({ theme: 'hotel' }, d.settings || {}); d.v = 5; return d; }
  };

  function sanitize(d) {
    const def = defaults();
    const out = Object.assign({}, def, d);
    out.settings = Object.assign({}, def.settings, d.settings || {});
    out.stats = Object.assign({}, def.stats, d.stats || {});
    out.stats.wins = Object.assign({}, def.stats.wins, (d.stats && d.stats.wins) || {});
    out.duel = Object.assign({}, def.duel, d.duel || {});
    out.endless = Object.assign({}, def.endless, d.endless || {});
    out.friends = Object.assign({}, def.friends, d.friends || {});
    out.last = Object.assign({}, def.last, d.last || {});
    out.achievements = d.achievements && typeof d.achievements === 'object' ? d.achievements : {};
    out.eye = !!d.eye; out.kovCode = /^\d{10}$/.test(d.kovCode || '') ? d.kovCode : '';
    const num = (x, min, max, dflt) => (typeof x === 'number' && isFinite(x) ? Math.max(min, Math.min(max, x)) : dflt);
    out.level = Math.floor(num(out.level, 1, 999, 1));
    out.xp = Math.floor(num(out.xp, 0, 1e9, 0));
    out.coins = Math.floor(num(out.coins, 0, 1e9, 0));
    out.playTime = num(out.playTime, 0, 1e10, 0);
    out.maxWave = Math.floor(num(out.maxWave, 0, 1e6, 0));
    out.owned = Array.isArray(out.owned) ? out.owned.filter(h => K.HERO[h]) : STARTERS.slice();
    STARTERS.forEach(h => { if (!out.owned.includes(h)) out.owned.push(h); });
    out.owned = [...new Set(out.owned)];
    out.squad = (Array.isArray(out.squad) ? out.squad : []).filter(h => out.owned.includes(h));
    out.squad = [...new Set(out.squad)].slice(0, K.SQUAD_MAX);
    if (!out.squad.length) out.squad = STARTERS.slice();
    if (!Array.isArray(out.duel.history)) out.duel.history = [];
    ['list', 'incoming', 'outgoing'].forEach(k => { if (!Array.isArray(out.friends[k])) out.friends[k] = []; });
    if (!['low', 'mid', 'high'].includes(out.settings.quality)) out.settings.quality = 'mid';
    const tw = d.twitch;
    out.twitch = tw && typeof tw === 'object' && typeof tw.id === 'string' && typeof tw.login === 'string'
      ? { id: tw.id, login: tw.login, display: String(tw.display || tw.login).slice(0, 25), avatar: typeof tw.avatar === 'string' && /^https:\/\//.test(tw.avatar) ? tw.avatar : '', verifiedAt: +tw.verifiedAt || 0 } : null;
    if (!/^[a-f0-9]{16,64}$/.test(out.uid || '')) out.uid = randUid();
    if (!/^[A-Z0-9]{3,11}$/.test(out.tag || '')) { out.tag = randTag(); out.tagVerified = false; }
    out.themes = (Array.isArray(out.themes) ? out.themes : []).filter(t => K.THEMES && K.THEMES[t]);
    if (!out.themes.includes('hotel')) out.themes.unshift('hotel');
    out.codes = Array.isArray(out.codes) ? out.codes.filter(c => typeof c === 'string').slice(0, 20) : [];
    if (!out.themes.includes(out.settings.theme)) out.settings.theme = 'hotel';
    out.nick = validNick(out.nick).ok ? out.nick.trim() : (out.twitch ? out.twitch.display.slice(0, 16) : def.nick);
    out.v = VERSION;
    return out;
  }

  function validNick(n) {
    if (typeof n !== 'string') return { ok: false, reason: 'Никнейм должен быть текстом' };
    const s = n.trim();
    if (!s.length) return { ok: false, reason: 'Никнейм не может быть пустым' };
    if (s.length < 3) return { ok: false, reason: 'Минимум 3 символа' };
    if (s.length > 16) return { ok: false, reason: 'Максимум 16 символов' };
    if (!/^[\p{L}\p{N}_\- .]+$/u.test(s)) return { ok: false, reason: 'Только буквы, цифры, пробел, точка, _ и -' };
    return { ok: true, value: s };
  }

  let storageOk = true;
  function load() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { storageOk = false; return { data: defaults(), storage: false, fresh: true }; }
    if (raw == null) return { data: defaults(), storage: true, fresh: true };
    let d;
    try { d = JSON.parse(raw); } catch (e) { return { corrupt: true, raw, reason: 'Файл сохранения не читается (повреждённый JSON).' }; }
    if (!d || typeof d !== 'object' || typeof d.v !== 'number') return { corrupt: true, raw, reason: 'В сохранении нет номера версии.' };
    if (d.v > VERSION) return { corrupt: true, raw, reason: 'Сохранение создано более новой версией игры (v' + d.v + ').' };
    try {
      while (d.v < VERSION) {
        const m = MIGRATIONS[d.v];
        if (!m) throw new Error('нет миграции с v' + d.v);
        d = m(d);
      }
      return { data: sanitize(d), storage: true, migrated: JSON.parse(raw).v !== VERSION };
    } catch (e) {
      return { corrupt: true, raw, reason: 'Не удалось обновить формат: ' + e.message };
    }
  }

  function save(d) {
    d.savedAt = Date.now();
    if (!storageOk) return false;
    try { localStorage.setItem(KEY, JSON.stringify(d)); return true; } catch (e) { storageOk = false; return false; }
  }

  function recover(raw) {
    try { if (raw != null) localStorage.setItem(KEY + '.backup.' + Date.now(), raw); } catch (e) { /* ignore */ }
    const d = defaults();
    save(d);
    return d;
  }

  function info(d) {
    let size = 0;
    try { size = (localStorage.getItem(KEY) || '').length; } catch (e) { size = 0; }
    return { version: VERSION, size, storage: storageOk, savedAt: d.savedAt, createdAt: d.createdAt };
  }

  // ---------- Аккаунт ----------
  const xpNeed = lvl => 100 + 60 * (lvl - 1);

  function addXp(p, xp) {
    let ups = 0;
    p.xp += Math.max(0, Math.floor(xp));
    while (p.xp >= xpNeed(p.level)) { p.xp -= xpNeed(p.level); p.level++; ups++; p.coins += 15; }
    return ups;
  }

  const ACH_CHECK = {
    first_wave: p => p.stats.wavesTotal >= 1,
    win_easy: p => p.stats.wins.easy > 0,
    win_normal: p => p.stats.wins.normal > 0,
    win_hard: p => p.stats.wins.hard > 0,
    endless_open: p => p.endlessUnlocked,
    endless_25: p => p.endless.best >= 25,
    kills_1000: p => p.stats.kills >= 1000,
    all_heroes: p => p.owned.length >= K.HEROES.length,
    max_tier: p => p.stats.maxTier,
    duel_win: p => p.duel.w > 0,
    team_win: p => p.stats.team > 0,
    time_1h: p => p.playTime >= 3600,
    secret_title: p => p.stats.secret,
    secret_morse: p => p.themes.includes('mine'),
    secret_eye: p => !!p.eye
  };

  // Каждое достижение выдаётся ровно один раз — награда не фармится.
  function checkAchievements(p) {
    const got = [];
    for (const a of K.ACHIEVEMENTS) {
      if (p.achievements[a.id] || !ACH_CHECK[a.id] || !ACH_CHECK[a.id](p)) continue;
      p.achievements[a.id] = Date.now();
      p.coins += a.coins;
      addXp(p, a.xp);
      got.push(a);
    }
    return got;
  }

  function applyMatch(p, m) {
    const f = m.field;
    const r = K.matchRewards(f, m.duelResult);
    const before = p.level;
    p.stats.games++;
    p.stats.kills += f.kills;
    p.stats.wavesTotal += f.wavesCleared;
    if (f.maxTierHit) p.stats.maxTier = true;
    let unlocked = false;
    if (m.mode === 'duel') {
      const res = m.duelResult;
      if (res === 'win') p.duel.w++; else if (res === 'lose') p.duel.l++; else p.duel.d++;
      p.duel.maxWave = Math.max(p.duel.maxWave, f.wavesCleared);
      p.duel.history.unshift({ at: Date.now(), result: res, wave: f.wavesCleared, opp: m.oppName, time: Math.round(m.duration) });
      p.duel.history = p.duel.history.slice(0, 10);
    } else {
      if (f.diffKey === 'endless') {
        if (f.wavesCleared > p.endless.best || (f.wavesCleared === p.endless.best && f.time > p.endless.bestTime)) {
          p.endless.best = f.wavesCleared; p.endless.bestTime = Math.round(f.time);
        }
      } else {
        p.maxWave = Math.max(p.maxWave, f.highestWave());
      }
      if (f.result === 'win') {
        if (p.stats.wins[f.diffKey] != null) p.stats.wins[f.diffKey]++;
        if (m.mode === 'team') p.stats.team++;
        if (f.diffKey === 'hard' && !p.endlessUnlocked) { p.endlessUnlocked = true; unlocked = true; }
      }
    }
    p.coins += r.coins;
    addXp(p, r.xp);
    const ach = checkAchievements(p);
    return { coins: r.coins, xp: r.xp, levelUps: p.level - before, achievements: ach, unlockedEndless: unlocked };
  }

  // Секретный код из магазина: открывает оформление «Шахты».
  function redeem(p, code) {
    const c = String(code || '').trim().toUpperCase().replace(/[\s\-]+/g, '');
    if (!c) return { ok: false, reason: 'Введите код' };
    // 10 цифр — пять чисел с экрана Ковтопа (последний показ)
    if (/^\d{10}$/.test(c)) {
      if (p.eye) return { ok: false, reason: 'Глаз Ковтопа уже у вас' };
      if (!p.kovCode || c !== p.kovCode) return { ok: false, reason: 'Код не подошёл' };
      p.eye = true; p.kovCode = '';
      return { ok: true, reward: 'eye', achievements: checkAchievements(p) };
    }
    if (c !== K.SECRET_CODE) return { ok: false, reason: 'Код не подошёл' };
    if (p.codes.includes(c)) return { ok: false, reason: 'Этот код уже активирован' };
    p.codes.push(c);
    if (!p.themes.includes('mine')) p.themes.push('mine');
    p.settings.theme = 'mine';
    return { ok: true, reward: 'mine', achievements: checkAchievements(p) };
  }

  K.Save = { load, save, recover, info, defaults, sanitize, VERSION, KEY, MIGRATIONS, redeem };
  K.Profile = { xpNeed, addXp, checkAchievements, applyMatch, validNick };
})(globalThis.KV = globalThis.KV || {});
