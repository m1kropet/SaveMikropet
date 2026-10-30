/* Симуляция матча: маршруты, волны, враги, башни, снаряды, экономика, прокачка.
   Детерминирована при фиксированном шаге и одинаковом seed — основа честной дуэли
   и будущей серверной авторитетной логики. Без DOM и Three.js. */
(function (K) {
  'use strict';

  const STEP = 1 / 60;

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- Маршруты ----------
  function buildPath(pts) {
    const p = pts.map(q => ({ x: q[0], z: q[1], y: q[2] || 0 }));
    const segs = [];
    let L = 0;
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i], b = p[i + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
      segs.push({ a, b, len, start: L });
      L += len;
    }
    return { pts: p, segs, length: L };
  }

  function pointAt(path, d, hint) {
    const segs = path.segs;
    let i = Math.max(0, Math.min(hint || 0, segs.length - 1));
    while (i < segs.length - 1 && d > segs[i].start + segs[i].len) i++;
    while (i > 0 && d < segs[i].start) i--;
    const s = segs[i];
    const k = s.len > 0 ? Math.max(0, Math.min(1, (d - s.start) / s.len)) : 0;
    return {
      x: s.a.x + (s.b.x - s.a.x) * k,
      y: s.a.y + (s.b.y - s.a.y) * k,
      z: s.a.z + (s.b.z - s.a.z) * k,
      seg: i,
      dx: (s.b.x - s.a.x) / (s.len || 1),
      dz: (s.b.z - s.a.z) / (s.len || 1)
    };
  }

  function distToSeg2(px, pz, a, b) {
    const vx = b.x - a.x, vz = b.z - a.z;
    const l2 = vx * vx + vz * vz || 1;
    let t = ((px - a.x) * vx + (pz - a.z) * vz) / l2;
    t = Math.max(0, Math.min(1, t));
    const cx = a.x + vx * t, cz = a.z + vz * t;
    return { d2: (px - cx) ** 2 + (pz - cz) ** 2, y: a.y + (b.y - a.y) * t };
  }

  function hashStr(t) { let h = 2166136261; for (const c of String(t)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

  function roadDist(paths, x, z) {
    let best = Infinity;
    for (const p of paths) for (const sg of p.segs) { const r = distToSeg2(x, z, sg.a, sg.b); if (r.d2 < best) best = r.d2; }
    return Math.sqrt(best);
  }

  // Отрезок AB пересекает круг препятствия?
  function segHitsCircle(ax, az, bx, bz, cx, cz, r) {
    const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz || 1e-9;
    let t = ((cx - ax) * vx + (cz - az) * vz) / l2;
    t = Math.max(0, Math.min(1, t));
    const px = ax + vx * t - cx, pz = az + vz * t - cz;
    return px * px + pz * pz < r * r;
  }

  function makeObstacle(kind, x, z, dyn) {
    const O = K.OBSTACLES[kind];
    return { kind, x: +x.toFixed(2), z: +z.toFixed(2), r: O.r, tall: !!O.tall, los: O.los !== false, dyn: !!dyn, rot: ((x * 7.3 + z * 3.1) % 1 + 1) % 1 };
  }

  // Раскладка карты: статичные препятствия и точки-кандидаты для бота (с учётом обзора).
  const layoutCache = {};
  function mapLayout(map) {
    if (layoutCache[map.id]) return layoutCache[map.id];
    const paths = map.paths.map(buildPath);
    const B = K.BOUNDS;
    const start = paths[0].pts[0], end = paths[0].pts[paths[0].pts.length - 1];
    const r = rng(hashStr(map.id));
    const kinds = K.THEME_OBSTACLES[map.theme].fixed;
    const obstacles = [];
    for (let tries = 0; tries < 600 && obstacles.length < map.obstacles; tries++) {
      const kind = kinds[Math.floor(r() * kinds.length)];
      const O = K.OBSTACLES[kind];
      const x = B.x0 + O.r + r() * (B.x1 - B.x0 - 2 * O.r), z = B.z0 + 0.6 + r() * (B.z1 - B.z0 - 1.2);
      const rd = roadDist(paths, x, z);
      if (rd < K.ROAD_R + O.r + 0.12 || rd > 4.5) continue;
      if (Math.hypot(x - end.x, z - end.z) < 1.8 || Math.hypot(x - start.x, z - start.z) < 1.4) continue;
      if (obstacles.some(o => Math.hypot(o.x - x, o.z - z) < o.r + O.r + 0.9)) continue;
      obstacles.push(makeObstacle(kind, x, z, false));
    }
    const samples = [];
    paths.forEach(p => { for (let d = 0; d < p.length; d += 0.5) samples.push(pointAt(p, d)); });
    const spots = [];
    for (let x = B.x0 + 0.4; x <= B.x1 - 0.4; x += 0.35) {
      for (let z = B.z0 + 0.4; z <= B.z1 - 0.4; z += 0.35) {
        const rd = roadDist(paths, x, z);
        if (rd < K.ROAD_R + K.TOWER_R + 0.02 || rd > 2.4) continue;
        if (Math.hypot(x - end.x, z - end.z) < 1.3 || Math.hypot(x - start.x, z - start.z) < 1.3) continue;
        if (obstacles.some(o => Math.hypot(o.x - x, o.z - z) < o.r + K.TOWER_R)) continue;
        let cov = 0;
        for (const sp of samples) {
          if ((sp.x - x) ** 2 + (sp.z - z) ** 2 > 9) continue;
          if (obstacles.some(o => o.los && segHitsCircle(x, z, sp.x, sp.z, o.x, o.z, o.r * 0.9))) continue;
          cov++;
        }
        spots.push({ x: +x.toFixed(2), z: +z.toFixed(2), cov });
      }
    }
    spots.sort((a, b) => b.cov - a.cov || a.z - b.z || a.x - b.x);
    layoutCache[map.id] = { obstacles, spots, start, end, samples };
    return layoutCache[map.id];
  }

  // ---------- Волны ----------
  const UNLOCK = { normal: 1, fast: 3, armored: 5, jumper: 6, flyer: 8, ghost: 10, elite: 14 };
  const WEIGHT = { normal: 3, fast: 2, armored: 1.6, jumper: 1.3, flyer: 1.4, ghost: 1.4, elite: 0.35 };

  function waveScale(diffKey, W) {
    const D = K.DIFFS[diffKey];
    const w = W - 1;
    let hp = (1 + 0.09 * w + 0.0025 * w * w) * D.hpMul;
    if (W > 40) hp *= Math.pow(1.035, W - 40);
    // с 11-й волны сущности получают ещё +3.5% жизней за каждую волну (боссов не касается: у них свои жизни)
    if (W >= 11) hp *= 1 + 0.035 * (W - 10);
    const speed = (1 + Math.min(0.3, W * 0.006)) * D.speedMul;
    return { hp, speed };
  }

  // Здоровье босса: 10 — 1000, 20 — 5000, 30 — 13000, 40 — 25000.
  // Дальше (бесконечный режим, дуэль) каждые 10 волн +15000…20000, каждая 100-я волна ещё +50000.
  function bossHp(W, seed) {
    if (K.BOSS_HP[W]) return K.BOSS_HP[W];
    if (W < 40) { // боссовая волна не на десятке (на случай нестандартной длины игры)
      const lo = Math.floor(W / 10) * 10, a = K.BOSS_HP[lo] || 1000, b = K.BOSS_HP[lo + 10] || a;
      return Math.round(a + (b - a) * (W - lo) / 10);
    }
    let hp = K.BOSS_HP[40];
    for (let k = 50; k <= W; k += 10) {
      const r = rng((seed * 31 + k * 104729) >>> 0);
      hp += 15000 + Math.round(r() * 50) * 100;
    }
    hp += Math.floor(W / 100) * 50000;
    return hp;
  }

  // Бонус за пройденную волну: 1-я — 120, каждая следующая на 50% от 120 (= +60) больше.
  // В дуэли: 1-я — 160, каждая следующая на 40% от 160 (= +64) больше.
  // 1-я волна — base, каждая следующая на 50% от base больше. Легко 180, Нормально и Бесконечный 150, Тяжело и Дуэль 120.
  const waveBonus = (W, diffKey) => { const b = (K.DIFFS[diffKey] && K.DIFFS[diffKey].bonusBase) || 120; return b + b * 0.5 * (W - 1); };

  function genWave(diffKey, W, seed, map) {
    const D = K.DIFFS[diffKey];
    const r = rng((seed * 1000003 + W * 7919) >>> 0);
    const shift = D.unlockShift;
    const pool = [];
    let total = 0;
    for (const t in UNLOCK) {
      const at = t === 'normal' ? 1 : Math.max(t === 'armored' ? 4 : 2, UNLOCK[t] + shift);
      if (W < at) continue;
      let w = WEIGHT[t];
      if (t === 'ghost' && map.ghostBoost) w *= map.ghostBoost;
      if (t === 'elite') w *= D.eliteRate;
      pool.push([t, w]);
      total += w;
    }
    const pick = () => {
      let x = r() * total;
      for (const [t, w] of pool) { x -= w; if (x <= 0) return t; }
      return pool[0][0];
    };
    const sc = waveScale(diffKey, W);
    const count = Math.min(70, Math.floor((6 + W * 1.5) * D.countMul));
    const interval = Math.max(0.28, 0.95 - W * 0.013);
    const npaths = map.paths.length;
    const spawns = [];
    let t = 0.8;
    const comboAt = 20 + shift;
    while (spawns.length < count) {
      const type = pick();
      const n = type === 'elite' ? 1 : 2 + Math.floor(r() * 4);
      const path = Math.floor(r() * npaths);
      for (let i = 0; i < n && spawns.length < count; i++) {
        const sp = { type, t, path, hpMul: sc.hp, spMul: sc.speed, flying: false, invisible: false };
        if (W >= comboAt && type === 'flyer' && r() < 0.15) sp.invisible = true;
        if (W >= comboAt + 5 && type === 'elite' && r() < 0.3) sp.invisible = true;
        spawns.push(sp);
        t += interval * (type === 'armored' || type === 'elite' ? 1.5 : type === 'fast' ? 0.6 : 1);
      }
      t += interval * 1.6;
    }
    const finite = isFinite(D.waves);
    const bossWave = W >= 10 && (W % 10 === 0 || (finite && W === D.waves));
    if (bossWave) {
      spawns.push({ type: 'boss', t: t + 1.5, path: 0, hp: bossHp(W, seed), hpMul: 1, spMul: 1, flying: false, invisible: false });
    }
    if (W > 40 && W % 5 === 0) {
      for (let i = 0; i < Math.floor((W - 35) / 5); i++) {
        spawns.push({ type: 'elite', t: t + 3 + i, path: i % npaths, hpMul: sc.hp, spMul: sc.speed, flying: false, invisible: W > 50 && i % 2 === 1 });
      }
    }
    spawns.sort((a, b) => a.t - b.t);
    return { n: W, spawns, bonus: waveBonus(W, diffKey), hpScale: sc.hp, boss: bossWave };
  }

  function waveSummary(w) {
    const c = {};
    w.spawns.forEach(s => {
      const k = s.invisible && s.type !== 'ghost' ? s.type + '+ghost' : s.type;
      c[k] = (c[k] || 0) + 1;
    });
    return c;
  }

  // ---------- Башни ----------
  function towerStats(heroId, up, skills) {
    const H = K.HERO[heroId], b = H.base;
    const s = {
      dmg: b.dmg, rate: b.rate, range: b.range, splash: b.splash || 0, multi: 1,
      chain: b.chain || 0, chainRange: b.chainRange || 0, pierce: 0, critC: 0, critM: 1,
      slow: b.slow || 0, slowDur: b.slowDur || 0, freezeC: 0, freezeDur: 0,
      stunC: b.stunC || 0, stunDur: b.stunDur || 0, burn: 0, aoeAll: false, execute: 0,
      income: b.income || 0, bonusSlowed: 0, bossFreeze: false, passive: !!b.passive,
      heal: 0, petMax: 0, shield: 0, interest: 0, interestCap: 0,
      vision: !!b.vision || !!(skills && skills.vision), aa: !!b.aa || !!(skills && skills.aa),
      proj: b.proj, projSpeed: b.projSpeed || 0,
      // гараж: машины, стрелок на машине, танк
      garage: !!b.garage, carHp: b.carHp || 0, carInt: b.carInt || 0, carSpeed: b.carSpeed || 0,
      gunDmg: 0, gunRate: 0, gunRange: 0, tank: false, tankDmg: 0, tankRate: 0, tankRange: 0, tankSplash: 0,
      // новые механики
      mineMax: b.mineMax || 0, knock: b.knock || 0, bossKnock: b.bossKnock || 0,
      poison: b.poison || 0, poisonMax: b.poisonMax || 0, poisonDur: b.poisonDur || 0, poisonSpread: 0,
      markAmp: b.markAmp || 0, markDur: b.markDur || 0, markSlow: 0, markExec: 0,
      minRange: b.minRange || 0, lob: !!b.lob, cone: b.cone || 0, heatMax: b.heatMax || 0, heatStep: b.heatStep || 0,
      lineW: b.lineW || 0, back: b.back || 0, silDur: b.silDur || 0, bossBonus: b.bossBonus || 0, unveil: false,
      aura: !!b.aura, auraRate: b.auraRate || 0, auraDmg: 0, auraPierce: 0, auraCrit: 0, auraVision: !!b.auraVision,
      auraSlow: b.auraSlow || 0, stopInt: b.stopInt || 0, stopDur: b.stopDur || 0, ageDmg: 0
    };
    let dmgMul = 1, rateMul = 1, carHpMul = 1, gunDmgMul = 1, gunRateMul = 1;
    const apply = fx => {
      for (const k in fx) {
        const v = fx[k];
        if (k === 'dmgMul') dmgMul *= v;
        else if (k === 'carHpMul') carHpMul *= v;
        else if (k === 'gunDmgMul') gunDmgMul *= v;
        else if (k === 'gunRateMul') gunRateMul *= v;
        else if (k === 'tank') s.tank = !!v;
        else if (k === 'rateMul') rateMul *= v;
        else if (k === 'multi') s.multi += v;
        else if (k === 'critM' || k === 'slow' || k === 'freezeDur' || k === 'stunDur' || k === 'execute' || k === 'interestCap' || k === 'markSlow' || k === 'markExec' || k === 'bossKnock') s[k] = Math.max(s[k], v);
        else if (k === 'aoeAll' || k === 'bossFreeze' || k === 'unveil' || k === 'auraVision' || k === 'lob') s[k] = !!v;
        else s[k] += v;
      }
    };
    for (let i = 0; i < up[0]; i++) apply(H.top[i].fx);
    for (let i = 0; i < up[1]; i++) apply(H.bottom[i].fx);
    s.dmg *= dmgMul;
    s.rate *= rateMul;
    if (s.garage) {
      s.carHp = Math.round(s.carHp * carHpMul);
      s.carInt = Math.max(25, s.carInt);
      s.gunDmg *= gunDmgMul; s.gunRate *= gunRateMul;
    }
    s.minRange = Math.max(0, s.minRange);
    s.cone = Math.min(1.3, s.cone);
    s.auraSlow = Math.min(0.6, s.auraSlow);
    if (s.stopInt) s.stopInt = Math.max(4, s.stopInt);
    if (s.aura) s.auraRange = s.range;
    s.dps = s.dmg * s.rate * (1 + s.critC * (s.critM - 1));
    // мины, яд и огонь: оценка урона для подсказок и бота
    if (s.poison) s.dps += s.poison * Math.min(s.poisonMax, 3) * Math.min(s.multi, 3) * 0.5;
    if (s.cone) s.dps *= 1 + Math.min(s.heatMax * s.heatStep, 3) * 0.5;
    return s;
  }

  // Свет прожектора: копия характеристик башни с усилениями (не складываются — берётся лучший прожектор)
  function buffedStats(s, b) {
    const o = Object.assign({}, s);
    o.rate *= 1 + b.rate; o.dmg *= 1 + b.dmg; o.pierce += b.pierce;
    if (b.crit) { o.critC += b.crit; o.critM = Math.max(o.critM, 2); }
    if (b.vision) o.vision = true;
    o.dps = o.dmg * o.rate * (1 + o.critC * (o.critM - 1));
    return o;
  }

  // Правила блокировки веток: вне зависимости от интерфейса.
  function upgradeState(heroId, up, br, coins, mode) {
    const H = K.HERO[heroId];
    const lvl = up[br], other = up[1 - br];
    if (lvl >= 5) return { ok: false, code: 'max', reason: 'Ветка полностью прокачана' };
    // Уровни 1–2 доступны всегда. Выше 2-го может подняться только одна ветка.
    if (other >= 3 && lvl >= 2) return { ok: false, code: 'locked', reason: 'Закрыто: ' + (br === 0 ? 'нижняя' : 'верхняя') + ' ветка выше 2 уровня, эта — максимум до 2' };
    const node = (br === 0 ? H.top : H.bottom)[lvl];
    const cost = K.upCost(node, lvl, mode);
    if (coins != null && coins < cost) return { ok: false, code: 'money', reason: 'Не хватает монет', cost, node };
    const note = lvl + 1 === 3 && other < 3 ? (br === 0 ? 'Нижняя' : 'Верхняя') + ' ветка после этого прокачается максимум до 2 уровня' : '';
    return { ok: true, cost, node, next: lvl + 1, note };
  }

  // ---------- Поле боя ----------
  class Field {
    constructor(o) {
      this.map = K.MAP[o.map];
      this.paths = this.map.paths.map(buildPath);
      this.layout = mapLayout(this.map);
      this.obstacles = this.layout.obstacles.map(o => Object.assign({}, o));
      this.diffKey = o.diff;
      this.D = K.DIFFS[o.diff];
      this.seed = o.seed >>> 0;
      this.mode = o.mode || 'single';
      this.squad = (o.squad || []).filter(id => K.HERO[id]).slice(0, K.SQUAD_MAX);
      this.players = o.players || [{ id: 'p1', name: 'Игрок', color: K.PLAYER_COLORS[0] }];
      this.autoWave = this.mode === 'duel' ? false : !!o.autoWave;
      this.record = o.record !== false;
      this.rand = rng(this.seed ^ 0x9e3779b9);
      this.pathRand = rng(this.seed ^ 0x51ed27);
      this.time = 0;
      // У каждого игрока свой кошелёк. me — чей кошелёк показывать (и чей у бота).
      this.me = o.me || this.players[0].id;
      this.wallets = {};
      this.earnedBy = {};
      this.players.forEach(p => { this.wallets[p.id] = this.D.startCoins; this.earnedBy[p.id] = 0; });
      this.baseMaxHp = this.D.petHp;
      this.shieldLeft = 0;
      this.maxHp = this.D.petHp;
      this.hp = this.maxHp;
      this.waveNum = 0;
      this.finalWave = this.D.waves;
      this.active = [];
      this.rewarded = new Set();
      this.wavesCleared = 0;
      this.enemies = [];
      this.emap = new Map();
      this.towers = [];
      this.cars = [];
      this.projectiles = [];
      this.mines = [];
      this.events = [];
      this.kills = 0;
      this.leaks = 0;
      this.over = false;
      this.result = null;
      this.nextId = 1;
      this.autoTimer = this.autoWave ? 8 : -1;
      this.obsRand = rng(this.seed ^ 0x0b57ac1e);
      this.leakedTypes = new Set();
      this.nonces = new Set();
      this.towersBuilt = 0;
      this.maxTierHit = false;
      // для достижений (считаются только для «своего» игрока — this.me)
      this.bossKills = 0;
      this.carKills = 0;
      this.piggyEarned = 0;
      this.heroesUsed = new Set();
      this.tier5 = new Set();
      this.feats = new Set();
      this.end = this.paths[0].pts[this.paths[0].pts.length - 1];
    }

    emit(e) { if (this.record) this.events.push(e); }

    // ---- Команды (единая точка входа для UI, бота и сети) ----
    cmd(c) {
      if (this.over) return { ok: false, reason: 'Матч окончен' };
      if (c.nonce != null) {
        if (this.nonces.has(c.nonce)) return { ok: false, reason: 'Повтор команды', dup: true };
        this.nonces.add(c.nonce);
        if (this.nonces.size > 500) this.nonces = new Set([...this.nonces].slice(-200));
      }
      switch (c.type) {
        case 'place': return this.place(c.hero, +c.x, +c.z, this.actor(c));
        case 'upgrade': return this.upgrade(c.tower, c.branch, this.actor(c));
        case 'skill': return this.buySkill(c.tower, c.skill, this.actor(c));
        case 'sell': return this.sell(c.tower, this.actor(c));
        case 'target': return this.setTargeting(c.tower, c.mode, this.actor(c));
        case 'wave': return this.startNextWave(true);
        case 'skip': return this.skip();
        default: return { ok: false, reason: 'Неизвестная команда' };
      }
    }

    actor(c) { return c.owner && this.wallets[c.owner] != null ? c.owner : this.me; }
    get coins() { return this.wallets[this.me] || 0; }
    set coins(v) { this.wallets[this.me] = v; }
    get earned() { return this.earnedBy[this.me] || 0; }
    set earned(v) { this.earnedBy[this.me] = v; }
    wallet(pid) { return this.wallets[pid] || 0; }
    trySpend(n, pid) {
      pid = pid || this.me;
      if (!(n >= 0) || !(this.wallets[pid] >= n)) return false;
      this.wallets[pid] -= n;
      return true;
    }
    gain(n, pid) {
      if (!(n > 0)) return;
      pid = pid || this.me;
      if (this.wallets[pid] == null) return;
      this.wallets[pid] += n;
      this.earnedBy[pid] = (this.earnedBy[pid] || 0) + n;
    }
    // Награда делится поровну между игроками команды.
    gainShared(n) {
      const ids = Object.keys(this.wallets);
      const each = Math.ceil(n / ids.length);
      ids.forEach(id => this.gain(each, id));
    }
    ownCheck(t, pid) {
      if (Object.keys(this.wallets).length > 1 && t.owner !== pid) return { ok: false, reason: 'Это башня другого игрока' };
      return null;
    }
    // Жизни микропета зависят от Свинок верхней ветки.
    recalcPet() {
      const max = this.baseMaxHp + this.towers.reduce((a, t) => a + (t.s.petMax || 0), 0);
      if (max > this.maxHp) this.hp += max - this.maxHp;
      this.maxHp = max;
      this.hp = Math.min(this.hp, this.maxHp);
    }

    // Можно ставить где угодно, кроме дороги, препятствий и чужих башен.
    // Препятствие, закрывающее обзор, рядом с точкой (для Реалганера, который ставится на препятствия).
    perchAt(x, z) {
      let best = null, bd = Infinity;
      for (const o of this.obstacles) {
        if (!o.los) continue;
        const d = Math.hypot(o.x - x, o.z - z);
        if (d < o.r + 0.55 && d < bd) { best = o; bd = d; }
      }
      return best;
    }
    // Свободные препятствия для Реалганера, лучшие (больше дороги рядом) первыми.
    perchSpots(heroId) {
      const S = this.layout.samples || [];
      return this.obstacles.filter(o => o.los && this.canPlace(o.x, o.z, null, heroId).ok)
        .map(o => ({ x: o.x, z: o.z, cov: S.filter(p => (p.x - o.x) ** 2 + (p.z - o.z) ** 2 <= 9).length }))
        .sort((a, b) => b.cov - a.cov || a.z - b.z || a.x - b.x);
    }

    canPlace(x, z, ignoreId, heroId) {
      const B = K.BOUNDS, R = K.TOWER_R;
      if (!isFinite(x) || !isFinite(z)) return { ok: false, reason: 'Здесь нельзя строить' };
      if (heroId && K.HERO[heroId] && K.HERO[heroId].base.perch) {
        const o = this.perchAt(x, z);
        if (!o) return { ok: false, reason: K.HERO[heroId].name + ' ставится только на препятствия, которые закрывают обзор' };
        if (this.towers.some(t => t.id !== ignoreId && Math.hypot(t.x - o.x, t.z - o.z) < 0.05)) return { ok: false, reason: 'На этом препятствии уже стоит башня' };
        return { ok: true, x: o.x, z: o.z, perch: true };
      }
      if (x < B.x0 + R || x > B.x1 - R || z < B.z0 + R || z > B.z1 - R) return { ok: false, reason: 'Слишком близко к стене' };
      if (roadDist(this.paths, x, z) < K.ROAD_R + R) return { ok: false, reason: 'На дороге сущностей строить нельзя' };
      const L = this.layout;
      if (Math.hypot(x - L.end.x, z - L.end.z) < 1.1) return { ok: false, reason: 'Здесь живёт микропет' };
      if (Math.hypot(x - L.start.x, z - L.start.z) < 1.1) return { ok: false, reason: 'Слишком близко к двери' };
      const ob = this.obstacles.find(o => Math.hypot(o.x - x, o.z - z) < o.r + R);
      if (ob) return { ok: false, reason: 'Мешает препятствие: ' + K.OBSTACLES[ob.kind].name.toLowerCase() };
      if (this.towers.some(t => t.id !== ignoreId && Math.hypot(t.x - x, t.z - z) < R * 2)) return { ok: false, reason: 'Слишком близко к другой башне' };
      return { ok: true };
    }

    // Лимиты: всего башен на игрока (25 / 20 / 18 / 15 при 1–4 игроках), гаражей — не больше 4.
    placeLimit(heroId, owner) {
      owner = owner || this.me;
      const mine = this.towers.filter(t => t.owner === owner);
      const cap = K.towerCap(this.players.length);
      if (mine.length >= cap) return { ok: false, reason: 'Лимит башен: не больше ' + cap + ' на игрока' };
      const H = K.HERO[heroId], max = H && (H.base.maxPerPlayer || (H.base.garage ? K.GARAGE_MAX : 0));
      if (max && mine.filter(t => t.hero === heroId).length >= max) return { ok: false, reason: H.name + ': не больше ' + max + ' на игрока' };
      return { ok: true };
    }

    place(heroId, x, z, owner) {
      const H = K.HERO[heroId];
      if (!H || !this.squad.includes(heroId)) return { ok: false, reason: 'Героя нет в отряде' };
      const can = this.canPlace(x, z, null, heroId);
      if (!can.ok) return can;
      if (can.perch) { x = can.x; z = can.z; }
      const lim = this.placeLimit(heroId, owner);
      if (!lim.ok) return lim;
      const cost = K.placeCost(heroId, this.mode);
      if (!this.trySpend(cost, owner)) return { ok: false, reason: 'Не хватает монет' };
      const t = {
        id: this.nextId++, hero: heroId, x: +x.toFixed(3), y: 0, z: +z.toFixed(3),
        owner, up: [0, 0], skills: { vision: false, aa: false }, spent: cost,
        cd: 0.2, aim: 0, targeting: H.base.target || 'first', dealt: 0, kills: 0, blocked: false,
        carT: 5, carPath: -1
      };
      t.s = towerStats(heroId, t.up, t.skills);
      this.towers.push(t);
      this.towersBuilt++;
      if (owner === this.me) {
        this.heroesUsed.add(heroId);
        if (heroId === 'piggy' && this.towers.filter(q => q.owner === owner && q.hero === 'piggy').length >= 4) this.feats.add('piggy4');
      }
      this.emit({ t: 'place', tower: t });
      return { ok: true, tower: t };
    }

    // Линия видимости: высокие препятствия закрывают всё, низкие — только наземные цели.
    los(ax, az, bx, bz, air) {
      for (const o of this.obstacles) {
        if (!o.los || (air && !o.tall)) continue;
        if (segHitsCircle(ax, az, bx, bz, o.x, o.z, o.r * 0.9)) return false;
      }
      return true;
    }

    // Новое препятствие появляется на свободном месте (не на дороге и не на башне).
    spawnObstacle(n) {
      const kinds = K.THEME_OBSTACLES[this.map.theme].spawn;
      const B = K.BOUNDS, L = this.layout;
      for (let tries = 0; tries < 80; tries++) {
        const kind = kinds[Math.floor(this.obsRand() * kinds.length)];
        const O = K.OBSTACLES[kind];
        const x = B.x0 + 0.6 + this.obsRand() * (B.x1 - B.x0 - 1.2), z = B.z0 + 0.8 + this.obsRand() * (B.z1 - B.z0 - 1.6);
        const rd = roadDist(this.paths, x, z);
        if (rd < K.ROAD_R + O.r + 0.12 || rd > 2.6) continue;
        if (Math.hypot(x - L.end.x, z - L.end.z) < 1.8 || Math.hypot(x - L.start.x, z - L.start.z) < 1.4) continue;
        if (this.obstacles.some(o => Math.hypot(o.x - x, o.z - z) < o.r + O.r + 0.3)) continue;
        if (this.towers.some(t => Math.hypot(t.x - x, t.z - z) < O.r + K.TOWER_R + 0.05)) continue;
        const o = makeObstacle(kind, x, z, true);
        this.obstacles.push(o);
        this.emit({ t: 'obstacle', o, wave: n });
        return o;
      }
      return null;
    }

    getTower(id) { return this.towers.find(t => t.id === id); }

    upgrade(id, br, pid) {
      pid = pid || this.me;
      const t = this.getTower(id);
      if (!t) return { ok: false, reason: 'Башня не найдена' };
      const own = this.ownCheck(t, pid); if (own) return own;
      if (br !== 0 && br !== 1) return { ok: false, reason: 'Нет такой ветки' };
      const st = upgradeState(t.hero, t.up, br, this.wallet(pid), this.mode);
      if (!st.ok) return st;
      if (!this.trySpend(st.cost, pid)) return { ok: false, reason: 'Не хватает монет' };
      t.up[br]++;
      t.spent += st.cost;
      const shield0 = t.s.shield || 0;
      t.s = towerStats(t.hero, t.up, t.skills);
      // щит одноразовый: улучшение добавляет к запасу только новые заряды (жизни микропета прибавятся в начале волны)
      if ((t.s.shield || 0) > shield0) { this.shieldLeft += t.s.shield - shield0; this.emit({ t: 'shieldUp', tower: t, n: t.s.shield - shield0 }); }
      if (t.up[br] === 5) { this.maxTierHit = true; if (t.owner === this.me) this.tier5.add(t.hero + ':' + br); }
      this.emit({ t: 'upgrade', tower: t, branch: br, level: t.up[br] });
      return { ok: true };
    }

    buySkill(id, key, pid) {
      pid = pid || this.me;
      const t = this.getTower(id);
      const sk = K.SKILLS[key];
      if (!t || !sk || t.s.passive) return { ok: false, reason: 'Недоступно' };
      const own = this.ownCheck(t, pid); if (own) return own;
      if (t.s[key]) return { ok: false, reason: 'Уже есть' };
      if (!this.trySpend(sk.cost, pid)) return { ok: false, reason: 'Не хватает монет' };
      t.skills[key] = true;
      t.spent += sk.cost;
      t.s = towerStats(t.hero, t.up, t.skills);
      this.emit({ t: 'skill', tower: t, skill: key });
      return { ok: true };
    }

    sell(id, pid) {
      pid = pid || this.me;
      const i = this.towers.findIndex(t => t.id === id);
      if (i < 0) return { ok: false, reason: 'Башня уже продана' };
      const t = this.towers[i];
      const own = this.ownCheck(t, pid); if (own) return own;
      this.towers.splice(i, 1);
      if (this.mines.length) this.mines = this.mines.filter(m => m.tower !== t.id);
      const refund = Math.floor(t.spent * K.SELL_RATE);
      this.wallets[t.owner] = (this.wallets[t.owner] || 0) + refund;
      if (t.s.passive) this.recalcPet();
      this.emit({ t: 'sell', tower: t, refund });
      return { ok: true, refund };
    }

    setTargeting(id, mode, pid) {
      const t = this.getTower(id);
      if (!t || !['first', 'last', 'strong', 'close'].includes(mode)) return { ok: false, reason: 'Недоступно' };
      const own = this.ownCheck(t, pid || this.me); if (own) return own;
      t.targeting = mode;
      return { ok: true };
    }

    // Пропуск ожидания: следующая волна сразу, если текущие уже полностью вышли на карту.
    canSkip() {
      if (this.over || this.mode === 'duel' || this.waveNum >= this.finalWave) return false;
      return this.active.every(w => w.idx >= w.spawns.length);
    }
    skip() {
      if (!this.canSkip()) return { ok: false, reason: 'Дождитесь, пока выйдут все сущности волны' };
      return this.startNextWave(false);
    }

    canStartWave() {
      return !this.over && this.mode !== 'duel' && this.active.length === 0 && this.waveNum < this.finalWave;
    }

    startNextWave(manual) {
      if (manual && !this.canStartWave()) return { ok: false, reason: 'Волна уже идёт' };
      if (this.over || this.waveNum >= this.finalWave) return { ok: false, reason: 'Волн больше нет' };
      this.waveNum++;
      // жизни и лечение от Свинок — в начале волны, как и доход
      this.recalcPet();
      const heal = this.towers.reduce((a, t) => a + (t.s.heal || 0), 0);
      if (heal > 0 && this.hp > 0 && this.hp < this.maxHp) { this.hp = Math.min(this.maxHp, this.hp + heal); this.emit({ t: 'petHeal', n: heal }); }
      const w = genWave(this.diffKey, this.waveNum, this.seed, this.map);
      this.active.push({ n: w.n, spawns: w.spawns, idx: 0, t: 0, remaining: w.spawns.length, bonus: w.bonus, boss: w.boss });
      this.autoTimer = -1;
      this.emit({ t: 'wave', n: w.n, boss: w.boss });
      // Свинки приносят деньги в самом начале каждой новой волны
      let income = 0;
      for (const t of this.towers) {
        const s2 = t.s;
        let inc = s2.income;
        if (s2.interest > 0) inc += Math.min(s2.interestCap, Math.floor(this.wallet(t.owner) * s2.interest));
        if (inc > 0) { this.gain(inc, t.owner); if (t.owner === this.me) { income += inc; this.piggyEarned += inc; } this.emit({ t: 'piggy', tid: t.id, x: t.x, z: t.z, amount: inc }); }
      }
      if (income > 0) this.emit({ t: 'piggyTotal', amount: income });
      return { ok: true };
    }

    peekWave(n) { return genWave(this.diffKey, n, this.seed, this.map); }

    // ---- Враги ----
    spawn(sp, waveN, pathIdx, d) {
      const E = K.ENEMIES[sp.type];
      const hp = sp.hp || Math.round(E.hp * sp.hpMul);
      const e = {
        id: this.nextId++, type: sp.type, wave: waveN,
        hp, maxHp: hp, speed: E.speed * sp.spMul, armor: E.armor + (sp.type === 'armored' ? Math.floor(this.waveNum / 8) : 0),
        reward: Math.round(E.reward * (1 + waveN * 0.05)), dmg: E.dmg,
        flying: !!E.flying || !!sp.flying, invisible: !!E.invisible || !!sp.invisible,
        boss: !!E.boss, elite: sp.type === 'elite', dash: E.dash || 0,
        path: pathIdx, d: d || 0, seg: 0, x: 0, y: 0, z: 0, dx: 0, dz: 1,
        slowF: 0, slowT: 0, stunT: 0, burn: 0, burnT: 0, healT: 4, summonT: 6, enraged: false,
        dead: false, revealed: false, hitT: 0, dashing: false
      };
      this.place3(e);
      this.enemies.push(e);
      this.emap.set(e.id, e);
      this.emit({ t: 'spawn', e });
      return e;
    }

    place3(e) {
      const p = pointAt(this.paths[e.path], e.d, e.seg);
      e.x = p.x; e.z = p.z; e.seg = p.seg; e.dx = p.dx; e.dz = p.dz;
      e.y = p.y + (e.flying ? 1.6 : 0);
    }

    waveOf(n) { return this.active.find(w => w.n === n); }

    removeEnemy(e) {
      this.emap.delete(e.id);
      const w = this.waveOf(e.wave);
      if (w) w.remaining--;
    }

    canTarget(s, e) {
      if (e.dead) return false;
      if (e.flying && !s.aa) return false;
      if (e.invisible && !s.vision) return false;
      return true;
    }

    damage(e, amount, s, tower) {
      if (e.dead) return 0;
      let dmg = amount;
      if (s) {
        const armor = Math.max(0, e.armor - s.pierce);
        dmg = Math.max(amount * 0.25, amount - armor);
        if (s.bonusSlowed && (e.slowT > 0 || e.stunT > 0)) dmg *= 1 + s.bonusSlowed;
        if (s.bossBonus && (e.boss || e.elite)) dmg *= 1 + s.bossBonus;
        if (s.execute && !e.boss && (e.hp - dmg) / e.maxHp < s.execute) dmg = e.hp;
      }
      // проклятие Вуду: усиливает урон от любых источников (башни, машины, огонь, яд)
      if (e.markT > 0) {
        dmg *= 1 + (e.markAmp || 0);
        if (e.markExec && !e.boss && (e.hp - dmg) / e.maxHp < e.markExec) dmg = e.hp;
      }
      // деньги за урон: 5 урона = 1 монета (без учёта «перебора» по добитой цели)
      const eff = Math.max(0, Math.min(dmg, e.hp));
      e.hp -= dmg;
      e.hitT = 0.15;
      if (tower) tower.dealt += dmg;
      this.payDamage(eff, tower);
      if (e.hp <= 0) this.kill(e, tower);
      return dmg;
    }

    // сколько урона нужно нанести за 1 монету: Легко 5, Нормально 10, Тяжело и Бесконечный 15
    dmgPerCoin() { return (K.DIFFS[this.diffKey] && K.DIFFS[this.diffKey].dmgPerCoin) || 10; }

    payDamage(eff, tower) {
      if (!(eff > 0)) return;
      const pid = tower && tower.owner && this.wallets[tower.owner] != null ? tower.owner : null;
      const key = pid || '*';
      this.dmgAcc = this.dmgAcc || {};
      const acc = (this.dmgAcc[key] || 0) + eff / this.dmgPerCoin();
      const whole = Math.floor(acc);
      this.dmgAcc[key] = acc - whole;
      if (whole > 0) { if (pid) this.gain(whole, pid); else this.gainShared(whole); }
    }

    carKill(c, e) {
      if (!e.dead || !c.tower || c.tower.owner !== this.me) return;
      this.carKills++;
      c.kills = (c.kills || 0) + 1;
      if (c.kills >= 5) this.feats.add('car5');
    }

    kill(e, tower) {
      if (e.dead) return;
      e.dead = true;
      this.kills++;
      if (tower) tower.kills++;
      if (e.boss) { this.bossKills++; if (e.eta != null && e.eta < 3) this.feats.add('bossClose'); }
      // споры Плюща: яд погибшего переходит на соседей
      if (e.pSpread > 0 && e.pst > 0) {
        const n = Math.max(1, Math.ceil(e.pst * Math.min(1, e.pSpread)));
        let any = false;
        for (const o of this.enemies) {
          if (o.dead || o === e || (o.x - e.x) ** 2 + (o.z - e.z) ** 2 > 2.56) continue;
          o.pst = Math.min(e.pMax || n, (o.pst || 0) + n); o.pDps = Math.max(o.pDps || 0, e.pDps); o.pT = Math.max(o.pT || 0, 3);
          o.pSrc = e.pSrc; o.pSpread = e.pSpread; o.pMax = e.pMax; any = true;
        }
        if (any) this.emit({ t: 'boom', x: e.x, y: 0, z: e.z, r: 1.6, kind: 'thorn' });
      }
      this.removeEnemy(e);
      this.emit({ t: 'die', e, reward: Math.round(e.maxHp / this.dmgPerCoin()), bonus: false });
    }

    hit(e, s, dmg, tower) {
      if (!this.canTarget(s, e)) return;
      this.damage(e, dmg, s, tower);
      if (e.dead) return;
      if (s.slow > 0) {
        e.slowF = Math.max(e.slowT > 0 ? e.slowF : 0, s.slow * (e.boss ? 0.5 : 1));
        e.slowT = Math.max(e.slowT, s.slowDur);
      }
      if (s.bossFreeze && e.boss) {
        // заморозка боссов: каждое попадание охлаждает, при полном охлаждении босс замерзает на 1.2 с
        e.chill = (e.chill || 0) + 0.06;
        if (e.chill >= 1 && e.stunT <= 0) { e.chill = 0; e.stunT = 1.2; this.emit({ t: 'freeze', e }); }
      }
      if (s.freezeC > 0 && !e.boss && this.rand() < s.freezeC) {
        e.stunT = Math.max(e.stunT, s.freezeDur);
        this.emit({ t: 'freeze', e });
      }
      if (s.stunC > 0 && this.rand() < s.stunC * (e.boss ? 0.3 : 1)) {
        e.stunT = Math.max(e.stunT, s.stunDur);
        this.emit({ t: 'stun', e });
      }
      if (s.burn > 0) { e.burn = Math.max(e.burn, s.burn); e.burnT = 2; e.burnSrc = tower; e.burnS = s; }
      // Пылесос: назад по дороге; каждая следующая затяжка той же сущности слабее
      if (s.knock > 0) {
        e.kn = (e.kn || 0) + 1;
        const k = s.knock * (e.boss ? s.bossKnock : 1) / (1 + 0.35 * (e.kn - 1));
        if (k > 0.01) { e.d = Math.max(0, e.d - k); this.place3(e); }
      }
      // Плющ: порции яда копятся до предела
      if (s.poison > 0) {
        e.pst = Math.min(s.poisonMax, (e.pst || 0) + 1);
        e.pDps = Math.max(e.pDps || 0, s.poison); e.pT = Math.max(e.pT || 0, s.poisonDur);
        e.pSrc = tower; e.pSpread = Math.max(e.pSpread || 0, s.poisonSpread); e.pMax = Math.max(e.pMax || 0, s.poisonMax);
      }
      // Вуду: проклятие
      if (s.markAmp > 0) {
        e.markT = Math.max(e.markT || 0, s.markDur);
        e.markAmp = Math.max(e.markAmp || 0, s.markAmp * (e.boss ? 0.6 : 1));
        e.markSlow = Math.max(e.markSlow || 0, s.markSlow); e.markExec = Math.max(e.markExec || 0, s.markExec);
      }
      // Экзорцист: немота (без лечения, рывков и призыва) и снятие невидимости
      if (s.silDur > 0) {
        e.silT = Math.max(e.silT || 0, s.silDur * (e.boss ? 0.5 : 1));
        if (s.unveil && e.invisible && !e.boss) { e.invisible = false; e.revealed = true; }
      }
    }

    rollDmg(s) {
      if (s.critC > 0 && this.rand() < s.critC) return { d: s.dmg * s.critM, crit: true };
      return { d: s.dmg, crit: false };
    }

    acquire(t, n, exclude) {
      const s = t.es || t.s, r2 = s.range * s.range, mr2 = s.minRange * s.minRange;
      const list = [];
      let hidden = null;
      for (const e of this.enemies) {
        if (e.dead || (exclude && exclude.has(e.id))) continue;
        if (!this.canTarget(s, e)) continue;
        const d2 = (e.x - t.x) ** 2 + (e.z - t.z) ** 2;
        if (d2 > r2 || (mr2 && d2 < mr2)) continue;
        if (!K.HERO[t.hero].base.perch && !s.lob && !this.los(t.x, t.z, e.x, e.z, e.flying)) { if (!hidden || e.d > hidden.d) hidden = e; continue; }
        list.push([e, d2]);
      }
      t.blocked = !list.length && !!hidden;
      if (t.blocked) this.aimAt(t, hidden); // поворачивается на врага за препятствием, но не стреляет
      if (!list.length) return [];
      const prog = e => e.d / this.paths[e.path].length;
      const m = t.targeting;
      list.sort((A, B) => {
        const a = A[0], b = B[0];
        if (m === 'strong') return b.hp - a.hp || prog(b) - prog(a);
        if (m === 'last') return prog(a) - prog(b);
        if (m === 'close') return A[1] - B[1];
        return prog(b) - prog(a);
      });
      return list.slice(0, n).map(x => x[0]);
    }

    fire(t) {
      const s = t.es || t.s;
      if (s.proj === 'trap') return this.layMine(t, s);
      if (s.cone > 0) return this.fireCone(t, s);
      if (s.proj === 'line') return this.fireLine(t, s);
      if (s.aoeAll) {
        const targets = this.acquire(t, 999);
        if (!targets.length) return false;
        for (const e of targets) this.hit(e, s, this.rollDmg(s).d, t);
        this.emit({ t: 'pulse', tower: t, r: s.range });
        return true;
      }
      if (s.proj === 'bolt-chain') {
        const first = this.acquire(t, s.multi);
        if (!first.length) return false;
        for (const f of first) {
          const pts = [{ x: t.x, y: t.y + 1, z: t.z }];
          const hitSet = new Set();
          let cur = f, mult = 1;
          for (let j = 0; j <= s.chain && cur; j++) {
            hitSet.add(cur.id);
            pts.push({ x: cur.x, y: cur.y + 0.5, z: cur.z });
            this.hit(cur, s, this.rollDmg(s).d * mult, t);
            mult *= 0.85;
            let best = null, bd = s.chainRange * s.chainRange;
            for (const e of this.enemies) {
              if (e.dead || hitSet.has(e.id) || !this.canTarget(s, e) || !this.los(cur.x, cur.z, e.x, e.z, e.flying)) continue;
              const d2 = (e.x - cur.x) ** 2 + (e.z - cur.z) ** 2;
              if (d2 <= bd) { bd = d2; best = e; }
            }
            cur = best;
          }
          this.emit({ t: 'chain', tower: t, pts });
        }
        this.aimAt(t, first[0]);
        return true;
      }
      const targets = this.acquire(t, s.multi);
      if (!targets.length) return false;
      this.aimAt(t, targets[0]);
      for (const e of targets) {
        const roll = this.rollDmg(s);
        if (s.proj === 'beam' || s.proj === 'ray') {
          this.hit(e, s, roll.d, t);
          this.emit({ t: s.proj, tower: t, to: { x: e.x, y: e.y + 0.5, z: e.z }, crit: roll.crit });
        } else {
          const p = {
            id: this.nextId++, kind: s.proj, x: t.x, y: t.y + 1.0, z: t.z,
            tid: e.id, tx: e.x, ty: e.y + 0.4, tz: e.z, speed: s.projSpeed, dmg: roll.d, crit: roll.crit,
            s, tower: t, owner: t.owner, air: e.flying, lob: s.lob
          };
          this.projectiles.push(p);
        }
      }
      this.emit({ t: 'shot', tower: t });
      return true;
    }

    aimAt(t, e) { t.aim = Math.atan2(e.x - t.x, e.z - t.z); }

    // Капкан: ставит мину на дорогу в радиусе (пока мин меньше предела)
    layMine(t, s) {
      let mine = 0;
      for (const m of this.mines) if (m.tower === t.id) mine++;
      if (mine >= s.mineMax) return true;
      for (let k = 0; k < 16; k++) {
        const pi = Math.floor(this.rand() * this.paths.length), P = this.paths[Math.min(pi, this.paths.length - 1)];
        const p = pointAt(P, 0.6 + this.rand() * Math.max(0, P.length - 1.8), 0);
        if ((p.x - t.x) ** 2 + (p.z - t.z) ** 2 > s.range * s.range) continue;
        if (this.mines.some(m => (m.x - p.x) ** 2 + (m.z - p.z) ** 2 < 0.36)) continue;
        const m = { id: this.nextId++, tower: t.id, owner: t.owner, x: +p.x.toFixed(3), z: +p.z.toFixed(3), armT: 0.6 };
        this.mines.push(m);
        this.emit({ t: 'mine', x: m.x, z: m.z, tower: t });
        return true;
      }
      return true;
    }
    stepMines(dt) {
      if (!this.mines.length) return;
      for (const m of this.mines) {
        if (m.armT > 0) { m.armT -= dt; continue; }
        const t = this.getTower(m.tower);
        if (!t) { m.dead = true; continue; }
        // мина реагирует на любую наземную сущность, даже невидимую
        if (!this.enemies.some(e => !e.dead && !e.flying && (e.x - m.x) ** 2 + (e.z - m.z) ** 2 < 0.2)) continue;
        const base = t.es || t.s;
        if (t.mineBase !== base) { t.mineBase = base; t.mineS = Object.assign({}, base, { vision: true, aa: false }); }
        const ms = t.mineS, r2 = ms.splash * ms.splash, roll = this.rollDmg(ms);
        for (const e of this.enemies) if (!e.dead && !e.flying && (e.x - m.x) ** 2 + (e.z - m.z) ** 2 <= r2) this.hit(e, ms, roll.d, t);
        m.dead = true;
        this.emit({ t: 'boom', x: m.x, y: 0, z: m.z, r: ms.splash, kind: 'trap', crit: roll.crit });
      }
      if (this.mines.some(m => m.dead)) this.mines = this.mines.filter(m => !m.dead);
    }

    // Котельная: огонь по всем в конусе; разогрев растёт, пока огонь не прерывается
    fireCone(t, s) {
      const first = this.acquire(t, 1);
      if (!first.length) { t.heat = 0; return false; }
      const e0 = first[0];
      this.aimAt(t, e0);
      const a0 = Math.atan2(e0.z - t.z, e0.x - t.x), r2 = s.range * s.range;
      t.heat = Math.min(s.heatMax, (t.heat || 0) + 1);
      const mul = 1 + t.heat * s.heatStep;
      for (const e of this.enemies) {
        if (!this.canTarget(s, e)) continue;
        const dx = e.x - t.x, dz = e.z - t.z, d2 = dx * dx + dz * dz;
        if (d2 > r2) continue;
        let da = Math.atan2(dz, dx) - a0;
        while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
        if (Math.abs(da) > s.cone && d2 > 0.16) continue;
        if (!this.los(t.x, t.z, e.x, e.z, e.flying)) continue;
        this.hit(e, s, s.dmg * mul, t);
      }
      this.emit({ t: 'flame', tower: t, a: a0, r: s.range, arc: s.cone, heat: s.heatMax ? t.heat / s.heatMax : 0 });
      this.emit({ t: 'shot', tower: t });
      return true;
    }

    // Ключник: бумеранг летит до конца дальности по линии и возвращается — два удара по всем на линии
    fireLine(t, s) {
      const targets = this.acquire(t, s.multi);
      if (!targets.length) return false;
      this.aimAt(t, targets[0]);
      const w2 = s.lineW * s.lineW;
      for (const e0 of targets) {
        const dx = e0.x - t.x, dz = e0.z - t.z, L = Math.hypot(dx, dz) || 1;
        const ux = dx / L, uz = dz / L, ex = t.x + ux * s.range, ez = t.z + uz * s.range;
        const roll = this.rollDmg(s);
        for (const e of this.enemies) {
          if (!this.canTarget(s, e)) continue;
          const px = e.x - t.x, pz = e.z - t.z, along = px * ux + pz * uz;
          if (along < -0.2 || along > s.range + 0.2) continue;
          const perp2 = px * px + pz * pz - along * along;
          if (perp2 > w2) continue;
          if (!this.los(t.x, t.z, e.x, e.z, e.flying)) continue;
          this.hit(e, s, roll.d, t);
          if (!e.dead && s.back > 0) this.hit(e, s, roll.d * s.back, t);
        }
        this.emit({ t: 'ray', tower: t, to: { x: ex, y: 0.5, z: ez }, crit: roll.crit, key: true });
      }
      this.emit({ t: 'shot', tower: t });
      return true;
    }

    // Ауры: свет прожекторов усиливает башни, часы замедляют и останавливают время
    stepAuras(dt) {
      let lamps = null, clocks = null;
      for (const t of this.towers) if (t.s.aura) { if (t.s.auraSlow || t.s.stopInt || t.s.ageDmg) (clocks = clocks || []).push(t); else (lamps = lamps || []).push(t); }
      for (const t of this.towers) {
        if (t.s.passive) { t.es = null; continue; }
        let b = null;
        if (lamps) for (const L of lamps) {
          const ls = L.s;
          if ((L.x - t.x) ** 2 + (L.z - t.z) ** 2 > ls.range * ls.range) continue;
          b = b || { rate: 0, dmg: 0, pierce: 0, crit: 0, vision: false };
          b.rate = Math.max(b.rate, ls.auraRate); b.dmg = Math.max(b.dmg, ls.auraDmg); b.pierce = Math.max(b.pierce, ls.auraPierce);
          b.crit = Math.max(b.crit, ls.auraCrit); b.vision = b.vision || ls.auraVision;
        }
        const key = b ? b.rate + ',' + b.dmg + ',' + b.pierce + ',' + b.crit + ',' + b.vision : '';
        if (key !== t.bufKey || t.esBase !== t.s) { t.bufKey = key; t.esBase = t.s; t.es = b ? buffedStats(t.s, b) : null; t.lit = !!b; }
      }
      if (!clocks) return;
      for (const C of clocks) {
        const s = C.s, r2 = s.range * s.range;
        let any = false;
        for (const e of this.enemies) {
          if (e.dead || (e.x - C.x) ** 2 + (e.z - C.z) ** 2 > r2) continue;
          any = true;
          if (s.auraSlow) { e.slowF = Math.max(e.slowT > 0 ? e.slowF : 0, s.auraSlow * (e.boss ? 0.5 : 1)); e.slowT = Math.max(e.slowT, 0.12); }
          if (s.ageDmg) this.damage(e, e.maxHp * s.ageDmg * (e.boss ? 0.15 : 1) * dt, null, C);
        }
        if (s.stopInt > 0) {
          C.stopCd = (C.stopCd == null ? 2 : C.stopCd) - dt;
          if (C.stopCd <= 0 && any) {
            C.stopCd = s.stopInt;
            for (const e of this.enemies) if (!e.dead && (e.x - C.x) ** 2 + (e.z - C.z) ** 2 <= r2) e.stunT = Math.max(e.stunT, s.stopDur * (e.boss ? 0.4 : 1));
            this.emit({ t: 'tstop', tower: C, r: s.range });
          } else if (C.stopCd < 0) C.stopCd = 0;
        }
      }
    }

    // ---- Машины гаражей: едут от микропета к двери и давят сущностей ----
    spawnCar(t) {
      const n = this.paths.length;
      t.carPath = (t.carPath + 1) % n;
      const path = this.paths[t.carPath], s = t.s;
      const car = {
        id: this.nextId++, tower: t, owner: t.owner, path: t.carPath, d: path.length - 0.2, seg: path.segs.length - 1,
        hp: s.carHp, maxHp: s.carHp, speed: s.carSpeed, gun: s.gunDmg > 0, tank: s.tank,
        gunDmg: s.gunDmg, gunRate: s.gunRate, gunRange: s.gunRange, gunCd: 0.5,
        tankDmg: s.tankDmg, tankRate: s.tankRate, tankRange: s.tankRange, tankSplash: s.tankSplash, tankCd: 1,
        x: 0, z: 0, dx: 0, dz: 0, aim: 0
      };
      this.placeCar(car);
      this.cars.push(car);
      this.emit({ t: 'car', car });
    }
    placeCar(c) {
      const p = pointAt(this.paths[c.path], c.d, c.seg);
      c.x = p.x; c.z = p.z; c.seg = p.seg; c.dx = -p.dx; c.dz = -p.dz;
    }
    carTarget(c, range, air) {
      let best = null, bd = range * range;
      for (const e of this.enemies) {
        if (e.dead || (e.flying && !air) || (e.invisible && !e.revealed)) continue;
        const d2 = (e.x - c.x) ** 2 + (e.z - c.z) ** 2;
        if (d2 <= bd) { bd = d2; best = e; }
      }
      return best;
    }
    stepCars(dt) {
      // гаражи выпускают машины только пока идёт волна
      if (this.active.length) {
        for (const t of this.towers) {
          if (!t.s.garage) continue;
          t.carT -= dt;
          if (t.carT <= 0) { this.spawnCar(t); t.carT += t.s.carInt; }
        }
      }
      for (const c of this.cars) {
        if (c.dead) continue;
        c.d -= c.speed * dt;
        if (c.d <= 0) { c.dead = true; this.emit({ t: 'carGone', car: c }); continue; }
        this.placeCar(c);
        // таран: наземные сущности рядом с машиной
        for (const e of this.enemies) {
          if (e.dead || e.flying || c.dead) continue;
          if ((e.x - c.x) ** 2 + (e.z - c.z) ** 2 > 0.36) continue;
          if (e.hp <= c.hp) {
            c.hp -= e.hp;
            this.damage(e, e.hp, null, c.tower);
            this.carKill(c, e);
            this.emit({ t: 'ram', x: e.x, z: e.z });
            if (c.hp <= 0) { c.dead = true; this.emit({ t: 'carBoom', car: c }); }
          } else {
            this.damage(e, c.hp, null, c.tower);
            this.carKill(c, e);
            c.hp = 0; c.dead = true;
            this.emit({ t: 'carBoom', car: c });
          }
        }
        if (c.dead) continue;
        // стрелок на машине
        if (c.gun) {
          c.gunCd -= dt;
          if (c.gunCd <= 0) {
            const e = this.carTarget(c, c.gunRange, true);
            if (e) {
              c.aim = Math.atan2(e.x - c.x, e.z - c.z);
              this.damage(e, c.gunDmg, { pierce: 1 }, c.tower);
              this.emit({ t: 'carShot', car: c, to: { x: e.x, z: e.z }, tank: false });
              c.gunCd += 1 / c.gunRate;
            } else c.gunCd = 0;
          }
        }
        // пушка танка: медленно, но по области
        if (c.tank) {
          c.tankCd -= dt;
          if (c.tankCd <= 0) {
            const e = this.carTarget(c, c.tankRange, false);
            if (e) {
              c.aim = Math.atan2(e.x - c.x, e.z - c.z);
              const tx = e.x, tz = e.z, r2 = c.tankSplash * c.tankSplash;
              for (const o of this.enemies) if (!o.dead && !o.flying && (o.x - tx) ** 2 + (o.z - tz) ** 2 <= r2) this.damage(o, c.tankDmg, { pierce: 6 }, c.tower);
              this.emit({ t: 'carShot', car: c, to: { x: tx, z: tz }, tank: true });
              this.emit({ t: 'boom', x: tx, y: 0, z: tz, r: c.tankSplash, kind: 'orb' });
              c.tankCd += 1 / c.tankRate;
            } else c.tankCd = 0;
          }
        }
      }
      if (this.cars.some(c => c.dead)) this.cars = this.cars.filter(c => !c.dead);
    }

    // ---- Шаг симуляции ----
    step(dt) {
      if (this.over) return;
      this.time += dt;

      // волны: в дуэли расписанием управляет DuelMatch (синхронно для обоих)
      if (this.mode !== 'duel' && this.autoWave && this.active.length === 0 && this.waveNum < this.finalWave) {
        if (this.autoTimer < 0) this.autoTimer = 3;
        this.autoTimer -= dt;
        if (this.autoTimer <= 0) this.startNextWave(false);
      }

      for (const w of this.active) {
        w.t += dt;
        while (w.idx < w.spawns.length && w.spawns[w.idx].t <= w.t) {
          const sp = w.spawns[w.idx++];
          const pi = this.paths.length > 1 ? Math.floor(this.pathRand() * this.paths.length) : 0;
          this.spawn(sp, w.n, Math.min(pi, this.paths.length - 1), 0);
        }
      }

      // враги
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (e.hitT > 0) e.hitT -= dt;
        if (e.burnT > 0) {
          e.burnT -= dt;
          this.damage(e, e.burn * dt, null, e.burnSrc);
          if (e.dead) continue;
        }
        if (e.pT > 0) {
          e.pT -= dt;
          this.damage(e, e.pst * e.pDps * dt, null, e.pSrc);
          if (e.dead) continue;
          if (e.pT <= 0) e.pst = 0;
        }
        if (e.markT > 0) e.markT -= dt;
        if (e.silT > 0) e.silT -= dt;
        if (e.stunT > 0) { e.stunT -= dt; continue; }
        let v = e.speed;
        if (e.slowT > 0) { e.slowT -= dt; v *= 1 - e.slowF; if (e.slowT <= 0) e.slowF = 0; }
        if (e.markT > 0 && e.markSlow) v *= 1 - e.markSlow * (e.boss ? 0.5 : 1);
        e.dashing = !!(e.dash && !(e.silT > 0) && this.map.dash && this.map.dash.includes(e.seg));
        if (e.dashing) v *= e.dash;
        if (this.map.hazard && this.map.hazard.includes(e.seg)) v *= 1.3;
        if (e.enraged) v *= 1.4;
        e.d += v * dt;
        const path = this.paths[e.path];
        if (e.boss) e.eta = Math.max(0, path.length - e.d) / Math.max(0.05, v);
        if (e.d >= path.length) {
          e.dead = true;
          if (this.shieldLeft > 0) { this.shieldLeft--; this.emit({ t: 'shield', e }); }
          else this.hp = Math.max(0, this.hp - e.dmg);
          this.leaks++;
          this.leakedTypes.add(e.type);
          if (e.invisible) this.leakedTypes.add('ghost');
          if (e.flying) this.leakedTypes.add('flyer');
          this.removeEnemy(e);
          this.emit({ t: 'leak', e });
          continue;
        }
        this.place3(e);
        if (e.elite && !(e.silT > 0)) {
          e.healT -= dt;
          if (e.healT <= 0) {
            e.healT = 4;
            for (const o of this.enemies) {
              if (o.dead || o.boss || (o.x - e.x) ** 2 + (o.z - e.z) ** 2 > 3.24) continue;
              o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.1);
            }
            this.emit({ t: 'heal', e });
          }
        }
        if (e.boss) {
          if (!e.enraged && e.hp < e.maxHp * 0.5) { e.enraged = true; this.emit({ t: 'enrage', e }); }
          if (!(e.silT > 0)) e.summonT -= dt;
          if (e.summonT <= 0) {
            e.summonT = 6;
            const w = this.waveOf(e.wave);
            const sc = waveScale(this.diffKey, e.wave);
            for (let i = 0; i < 3; i++) {
              this.spawn({ type: 'fast', hpMul: sc.hp, spMul: sc.speed }, e.wave, e.path, Math.max(0, e.d - 0.4 - i * 0.35));
              if (w) w.remaining++;
            }
            this.emit({ t: 'summon', e });
          }
        }
      }

      this.stepCars(dt);
      this.stepMines(dt);
      this.stepAuras(dt);

      // обнаружение невидимок (для отрисовки и подсказок)
      for (const e of this.enemies) {
        if (e.dead || !e.invisible) continue;
        e.revealed = this.towers.some(t => { const ts = t.es || t.s; return ts.vision && (t.x - e.x) ** 2 + (t.z - e.z) ** 2 <= (ts.range + 0.5) ** 2; });
      }

      // башни
      for (const t of this.towers) {
        if (t.s.passive) continue;
        t.cd -= dt;
        if (t.cd <= 0) {
          if (this.fire(t)) t.cd += 1 / (t.es || t.s).rate;
          else t.cd = 0;
          if (t.cd < -0.5) t.cd = 0;
        }
      }

      // снаряды
      for (const p of this.projectiles) {
        const tg = this.emap.get(p.tid);
        if (tg && !tg.dead) { p.tx = tg.x; p.ty = tg.y + 0.4; p.tz = tg.z; }
        const dx = p.tx - p.x, dy = p.ty - p.y, dz = p.tz - p.z;
        const dist = Math.hypot(dx, dy, dz);
        const stepLen = p.speed * dt;
        if (dist <= stepLen + 0.12) {
          p.done = true;
          if (p.s.splash > 0) {
            const r2 = p.s.splash * p.s.splash;
            for (const e of this.enemies) {
              if (e.dead) continue;
              if ((e.x - p.tx) ** 2 + (e.z - p.tz) ** 2 <= r2 && Math.abs(e.y - p.ty) < 2.2) this.hit(e, p.s, p.dmg, p.tower);
            }
            this.emit({ t: 'boom', x: p.tx, y: p.ty, z: p.tz, r: p.s.splash, kind: p.kind, crit: p.crit });
          } else if (tg && !tg.dead) {
            this.hit(tg, p.s, p.dmg, p.tower);
            this.emit({ t: 'impact', x: p.tx, y: p.ty, z: p.tz, kind: p.kind, crit: p.crit });
          }
        } else {
          const nx = p.x + (dx / dist) * stepLen, nz = p.z + (dz / dist) * stepLen;
          const ob = p.lob ? null : this.obstacles.find(o => o.los && (o.tall || !p.air) && (nx - o.x) ** 2 + (nz - o.z) ** 2 < (o.r * 0.85) ** 2);
          if (ob) { p.done = true; this.emit({ t: 'blocked', x: nx, y: p.y, z: nz, kind: p.kind }); continue; }
          p.x = nx; p.y += (dy / dist) * stepLen; p.z = nz;
        }
      }
      if (this.projectiles.some(p => p.done)) this.projectiles = this.projectiles.filter(p => !p.done);
      if (this.enemies.some(e => e.dead)) this.enemies = this.enemies.filter(e => !e.dead);

      // завершение волн
      for (const w of this.active) {
        if (w.idx >= w.spawns.length && w.remaining <= 0 && !w.done) {
          w.done = true;
          if (!this.rewarded.has(w.n)) {
            this.rewarded.add(w.n);
            this.wavesCleared++;
            this.gainShared(w.bonus);
            this.emit({ t: 'waveClear', n: w.n, bonus: w.bonus, income: 0 });
            if (w.n % 4 === 0 && w.n !== this.finalWave) { this.spawnObstacle(w.n); if (w.n >= 20) this.spawnObstacle(w.n); }
            if (w.n === this.finalWave && this.hp > 0) { this.finish('win'); }
          }
        }
      }
      if (this.active.some(w => w.done)) this.active = this.active.filter(w => !w.done);

      if (this.hp <= 0 && !this.over) this.finish('lose');
    }

    finish(result) {
      if (this.over) return;
      this.over = true;
      this.result = result;
      this.emit({ t: 'over', result });
    }

    // Фиксированный шаг — скорость игры не зависит от FPS.
    advance(realDt, speed) {
      this.acc = (this.acc || 0) + Math.min(realDt, 0.25) * (speed || 1);
      let n = 0;
      while (this.acc >= STEP && n < 12) { this.step(STEP); this.acc -= STEP; n++; }
      if (n >= 12) this.acc = 0;
    }

    highestWave() { return this.result === 'win' ? this.waveNum : Math.max(0, this.wavesCleared); }
  }

  // ---------- Дуэль ----------
  class DuelMatch {
    constructor(o) {
      this.seed = o.seed >>> 0;
      this.a = new Field({ map: o.map, diff: 'duel', seed: this.seed, mode: 'duel', squad: o.squadA, record: true, players: o.playersA });
      this.b = new Field({ map: o.map, diff: 'duel', seed: this.seed, mode: 'duel', squad: o.squadB, record: o.recordB === true, players: o.playersB });
      this.time = 0;
      this.cap = o.cap || 1500;
      this.gap = null;
      this.over = false;
      this.result = null;
      this.reason = '';
    }
    // Волны синхронны: следующая начинается у обоих, только когда оба отбили текущую.
    waiting() {
      const a = this.a.active.length > 0, b = this.b.active.length > 0;
      return a !== b ? (a ? 'me' : 'opp') : null;
    }
    step(dt) {
      if (this.over) return;
      if (!this.a.active.length && !this.b.active.length) {
        if (this.gap == null) this.gap = this.a.waveNum === 0 ? 8 : 5;
        this.gap -= dt;
        if (this.gap <= 0) { this.gap = null; this.a.startNextWave(false); this.b.startNextWave(false); }
      }
      this.a.step(dt);
      if (!this.b.record) this.b.events.length = 0;
      this.b.step(dt);
      this.time += dt;
      const ad = this.a.hp <= 0, bd = this.b.hp <= 0;
      if (ad || bd || this.time >= this.cap) {
        this.over = true;
        if (ad && !bd) { this.result = 'lose'; this.reason = 'Ваш микропет пал первым'; }
        else if (bd && !ad) { this.result = 'win'; this.reason = 'Микропет соперника пал первым'; }
        else this.tieBreak(ad && bd ? 'Оба микропета пали одновременно' : 'Время матча вышло');
        this.a.over = true; this.b.over = true;
      }
    }
    tieBreak(prefix) {
      const A = this.a, B = this.b;
      const crit = [
        ['пройдено волн', A.wavesCleared, B.wavesCleared],
        ['здоровье микропета', A.hp, B.hp],
        ['уничтожено врагов', A.kills, B.kills]
      ];
      for (const [name, x, y] of crit) {
        if (x !== y) { this.result = x > y ? 'win' : 'lose'; this.reason = prefix + ', решило: ' + name; return; }
      }
      this.result = 'draw';
      this.reason = prefix + ', все показатели равны';
    }
    advance(realDt, speed) {
      this.acc = (this.acc || 0) + Math.min(realDt, 0.25) * (speed || 1);
      let n = 0;
      while (this.acc >= STEP && n < 12 && !this.over) { this.step(STEP); this.acc -= STEP; n++; }
      if (n >= 12) this.acc = 0;
    }
  }

  // ---------- Награды ----------
  function matchRewards(f, duelResult) {
    // Монеты аккаунта (на покупку башен):
    //  • дуэль — 5 за волну, при победе итог ×1.4, при поражении ×0.8;
    //  • остальное — 10 за волну (после 40-й волны — 5 за волну) + за прохождение: Легко 100, Нормально 200, Тяжело 300.
    const W = f.wavesCleared;
    if (f.mode === 'duel') {
      const mul = duelResult === 'win' ? 1.4 : duelResult === 'lose' ? 0.8 : 1;
      const xpBase = duelResult === 'win' ? 40 : duelResult === 'draw' ? 20 : 10;
      return { coins: Math.round(W * 5 * mul), xp: xpBase + W * 2 };
    }
    const D = f.D;
    const win = f.result === 'win';
    const coins = Math.min(W, 40) * 10 + Math.max(0, W - 40) * 5 + (win ? D.winCoins : 0);
    const xp = W * 3 + (win ? D.winXp : 0);
    return { coins, xp };
  }

  K.STEP = STEP;
  K.rng = rng;
  K.buildPath = buildPath;
  K.pointAt = pointAt;
  K.mapLayout = mapLayout;
  K.segHitsCircle = segHitsCircle;
  K.genWave = genWave;
  K.genWaveScale = (d, w) => waveScale(d, w).hp;
  K.waveSummary = waveSummary;
  K.towerStats = towerStats;
  K.upgradeState = upgradeState;
  K.Field = Field;
  K.DuelMatch = DuelMatch;
  K.matchRewards = matchRewards;
})(globalThis.KV = globalThis.KV || {});
