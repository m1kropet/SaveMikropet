/* Сохранение прогресса: версионированный формат, миграции, защита от повреждённых данных.
   Плюс правила аккаунта: опыт, уровни, достижения, применение итогов матча. */
(function (K) {
  'use strict';
  const KEY = 'mikropet.save';
  const VERSION = 5;
  const STARTERS = ['blaster', 'ice'];
  const KOV_MAX = 1000; // сколько показанных последовательностей помнить
  function addKovCode(p, code) {
    if (!/^\d{10}$/.test(code)) return;
    p.kovCodes = (p.kovCodes || []).filter(c => c !== code);
    p.kovCodes.push(code);
    if (p.kovCodes.length > KOV_MAX) p.kovCodes = p.kovCodes.slice(-KOV_MAX);
  }

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
      // все последовательности, которые Ковтоп показывал именно этому игроку (подходит любая)
      eye: false, kovCodes: [],
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
      stats: { kills: 0, games: 0, wavesTotal: 0, wins: { easy: 0, normal: 0, hard: 0 }, team: 0, maxTier: false, secret: false,
        bossKills: 0, carKills: 0, piggyEarned: 0, mapWins: {}, hardMapWins: {}, tier5: [], feats: {} },
      friends: {
        list: [{ nick: 'Ночной портье', since: now }],
        incoming: [{ nick: 'Фонарик', at: now }, { nick: 'Зеркальце', at: now }],
        outgoing: []
      },
      last: { map: 'lobby', diff: 'easy', duelMap: 'corridor' },
      twitch: null, google: null,
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
    const obj = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    out.stats.mapWins = obj(out.stats.mapWins); out.stats.hardMapWins = obj(out.stats.hardMapWins); out.stats.feats = obj(out.stats.feats);
    out.stats.tier5 = Array.isArray(out.stats.tier5) ? out.stats.tier5.filter(h => typeof h === 'string') : [];
    ['bossKills', 'carKills', 'piggyEarned'].forEach(k => { out.stats[k] = Math.max(0, +out.stats[k] || 0); });
    out.duel = Object.assign({}, def.duel, d.duel || {});
    out.endless = Object.assign({}, def.endless, d.endless || {});
    out.friends = Object.assign({}, def.friends, d.friends || {});
    out.last = Object.assign({}, def.last, d.last || {});
    out.achievements = d.achievements && typeof d.achievements === 'object' ? d.achievements : {};
    out.eye = !!d.eye;
    out.kovCodes = (Array.isArray(d.kovCodes) ? d.kovCodes : []).concat(d.kovCode ? [d.kovCode] : []).filter(c => /^\d{10}$/.test(c)).slice(-KOV_MAX);
    delete out.kovCode;
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
    const gg = d.google;
    out.google = gg && typeof gg === 'object' && typeof gg.id === 'string' && gg.id
      ? { id: gg.id.slice(0, 64), email: String(gg.email || '').slice(0, 120), name: String(gg.name || '').slice(0, 40), avatar: typeof gg.avatar === 'string' && /^https:\/\//.test(gg.avatar) ? gg.avatar : '', verifiedAt: +gg.verifiedAt || 0 } : null;
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
  // Опыт до следующего уровня: с 1-го на 2-й — 50; дальше 2·x + 80 + x/10, где x = 50 на 2-м уровне, 100 на 3-м и т. д.
  const xpNeed = lvl => { if (lvl <= 1) return 50; const x = 50 * (lvl - 1); return Math.round(2 * x + 80 + x / 10); };

  function addXp(p, xp) {
    let ups = 0;
    p.xp += Math.max(0, Math.floor(xp));
    while (p.xp >= xpNeed(p.level)) { p.xp -= xpNeed(p.level); p.level++; ups++; p.coins += 15; }
    return ups;
  }

  const won = o => Object.keys(o).filter(k => o[k] > 0 && K.MAP[k]).length;
  const feat = id => p => !!p.stats.feats[id];
  // Прогресс [сейчас, цель] — для полоски в списке достижений
  const ACH_PROG = {
    all_maps: p => [won(p.stats.mapWins), K.MAPS.length],
    hard_all_maps: p => [won(p.stats.hardMapWins), K.MAPS.length],
    endless_25: p => [p.endless.best, 25],
    endless_50: p => [p.endless.best, 50],
    endless_100: p => [p.endless.best, 100],
    kills_1000: p => [p.stats.kills, 1000],
    kills_10000: p => [p.stats.kills, 10000],
    boss_1: p => [p.stats.bossKills, 1],
    boss_25: p => [p.stats.bossKills, 25],
    waves_100: p => [p.stats.wavesTotal, 100],
    waves_1000: p => [p.stats.wavesTotal, 1000],
    all_heroes: p => [p.owned.length, K.HEROES.length],
    max_tier_all: p => [K.HEROES.filter(h => p.stats.tier5.includes(h.id)).length, K.HEROES.length],
    garage_100: p => [p.stats.carKills, 100],
    piggy_10k: p => [p.stats.piggyEarned, 10000],
    duel_10: p => [p.duel.w, 10],
    team_10: p => [p.stats.team, 10],
    games_10: p => [p.stats.games, 10],
    games_100: p => [p.stats.games, 100],
    level_10: p => [p.level, 10],
    level_25: p => [p.level, 25],
    rich: p => [p.coins, 5000],
    time_1h: p => [Math.floor(p.playTime / 60), 60],
    time_10h: p => [Math.floor(p.playTime / 60), 600],
    secret_all: p => [K.ACHIEVEMENTS.filter(a => a.id !== 'secret_all' && p.achievements[a.id]).length, K.ACHIEVEMENTS.length - 1]
  };
  const reached = id => p => { const r = ACH_PROG[id](p); return r[0] >= r[1]; };

  const ACH_CHECK = {
    first_wave: p => p.stats.wavesTotal >= 1,
    win_easy: p => p.stats.wins.easy > 0,
    win_normal: p => p.stats.wins.normal > 0,
    win_hard: p => p.stats.wins.hard > 0,
    perfect: feat('perfect'),
    perfect_hard: feat('perfect_hard'),
    clutch: feat('clutch'),
    mono: feat('mono'),
    endless_open: p => p.endlessUnlocked,
    max_tier: p => p.stats.maxTier,
    tank: feat('tank'),
    duel_win: p => p.duel.w > 0,
    team_win: p => p.stats.team > 0,
    secret_title: p => p.stats.secret,
    secret_morse: p => p.themes.includes('mine'),
    secret_eye: p => !!p.eye,
    secret_guest: feat('guest'),
    secret_checkout: feat('checkout'),
    secret_3am: feat('3am'),
    secret_impostor: p => String(p.nick || '').toLowerCase().includes('ковтоп'),
    secret_close: feat('close'),
    secret_piggy: feat('piggy4'),
    secret_rush: feat('car5')
  };
  Object.keys(ACH_PROG).forEach(id => { if (!ACH_CHECK[id]) ACH_CHECK[id] = reached(id); });
  function achProgress(p, id) { return ACH_PROG[id] ? ACH_PROG[id](p) : null; }


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
    // счётчики и разовые подвиги для достижений
    const st = p.stats, fe = st.feats, mark = k => { fe[k] = fe[k] || Date.now(); };
    st.bossKills += f.bossKills || 0;
    st.carKills += f.carKills || 0;
    st.piggyEarned += f.piggyEarned || 0;
    for (const k of f.tier5 || []) {
      const h = k.split(':')[0];
      if (!st.tier5.includes(h)) st.tier5.push(h);
      if (k === 'garage:1') mark('tank');
    }
    for (const k of f.feats || []) mark(k === 'bossClose' ? 'close' : k);
    const hour = new Date(m.now || Date.now()).getHours();
    if (hour === 3) mark('3am');
    if (m.mode !== 'duel') {
      const win = f.result === 'win';
      if (f.wavesCleared >= 1 && f.towersBuilt === 0) mark('guest');
      if (f.result === 'lose' && f.wavesCleared === 0) mark('checkout');
      if (win) {
        const id = f.map && f.map.id;
        if (id) { st.mapWins[id] = (st.mapWins[id] || 0) + 1; if (f.diffKey === 'hard') st.hardMapWins[id] = (st.hardMapWins[id] || 0) + 1; }
        if (f.leaks === 0) { mark('perfect'); if (f.diffKey === 'hard') mark('perfect_hard'); }
        if (f.hp <= 3) mark('clutch');
        if (f.heroesUsed && f.heroesUsed.size === 1) mark('mono');
      }
    }
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
      if (!(p.kovCodes || []).includes(c)) return { ok: false, reason: 'Код не подошёл' };
      p.eye = true;
      return { ok: true, reward: 'eye', achievements: checkAchievements(p) };
    }
    if (c !== K.SECRET_CODE) return { ok: false, reason: 'Код не подошёл' };
    if (p.codes.includes(c)) return { ok: false, reason: 'Этот код уже активирован' };
    p.codes.push(c);
    if (!p.themes.includes('mine')) p.themes.push('mine');
    p.settings.theme = 'mine';
    return { ok: true, reward: 'mine', achievements: checkAchievements(p) };
  }

  K.Save = { load, save, recover, info, defaults, sanitize, VERSION, KEY, MIGRATIONS, redeem, addKovCode };
  K.Profile = { xpNeed, addXp, checkAchievements, achProgress, applyMatch, validNick };
})(globalThis.KV = globalThis.KV || {});
