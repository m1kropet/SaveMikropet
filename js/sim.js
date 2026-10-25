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
    layoutCache[map.id] = { obstacles, spots, start, end };
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
    const speed = (1 + Math.min(0.3, W * 0.006)) * D.speedMul;
    return { hp, speed };
  }

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
      const bossCount = W >= 60 ? 2 : 1;
      for (let i = 0; i < bossCount; i++) {
        spawns.push({ type: 'boss', t: t + 1.5 + i * 4, path: 0, hpMul: sc.hp * (diffKey === 'easy' ? 0.55 : 0.75), spMul: 1, flying: false, invisible: false });
      }
    }
    if (W > 40 && W % 5 === 0) {
      for (let i = 0; i < Math.floor((W - 35) / 5); i++) {
        spawns.push({ type: 'elite', t: t + 3 + i, path: i % npaths, hpMul: sc.hp, spMul: sc.speed, flying: false, invisible: W > 50 && i % 2 === 1 });
      }
    }
    spawns.sort((a, b) => a.t - b.t);
    return { n: W, spawns, bonus: 25 + 5 * W, hpScale: sc.hp, boss: bossWave };
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
      income: b.income || 0, killBonus: b.killBonus || 0, bonusSlowed: 0,
      vision: !!b.vision || !!(skills && skills.vision), aa: !!b.aa || !!(skills && skills.aa),
      proj: b.proj, projSpeed: b.projSpeed || 0
    };
    let dmgMul = 1, rateMul = 1;
    const apply = fx => {
      for (const k in fx) {
        const v = fx[k];
        if (k === 'dmgMul') dmgMul *= v;
        else if (k === 'rateMul') rateMul *= v;
        else if (k === 'multi') s.multi += v;
        else if (k === 'critM' || k === 'slow' || k === 'freezeDur' || k === 'stunDur' || k === 'execute') s[k] = Math.max(s[k], v);
        else if (k === 'aoeAll') s.aoeAll = !!v;
        else s[k] += v;
      }
    };
    for (let i = 0; i < up[0]; i++) apply(H.top[i].fx);
    for (let i = 0; i < up[1]; i++) apply(H.bottom[i].fx);
    s.dmg *= dmgMul;
    s.rate *= rateMul;
    s.dps = s.dmg * s.rate * (1 + s.critC * (s.critM - 1));
    return s;
  }

  // Правила блокировки веток: вне зависимости от интерфейса.
  function upgradeState(heroId, up, br, coins) {
    const H = K.HERO[heroId];
    const lvl = up[br], other = up[1 - br];
    if (lvl >= 5) return { ok: false, code: 'max', reason: 'Ветка полностью прокачана' };
    if (other >= 3) return { ok: false, code: 'locked', reason: 'Заблокировано: ' + (br === 0 ? 'нижняя' : 'верхняя') + ' ветка прокачана до 3 уровня' };
    const node = (br === 0 ? H.top : H.bottom)[lvl];
    if (coins != null && coins < node.cost) return { ok: false, code: 'money', reason: 'Не хватает монет', cost: node.cost, node };
    const note = lvl + 1 >= 3 && other > 0 ? 'Покупка закроет ' + (br === 0 ? 'нижнюю' : 'верхнюю') + ' ветку' : (lvl + 1 >= 3 ? 'После покупки вторая ветка закроется на 0 уровне' : '');
    return { ok: true, cost: node.cost, node, next: lvl + 1, note };
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
      this.coins = this.D.startCoins;
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
      this.projectiles = [];
      this.events = [];
      this.kills = 0;
      this.earned = 0;
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
        case 'place': return this.place(c.hero, +c.x, +c.z, c.owner || 'p1');
        case 'upgrade': return this.upgrade(c.tower, c.branch);
        case 'skill': return this.buySkill(c.tower, c.skill);
        case 'sell': return this.sell(c.tower);
        case 'target': return this.setTargeting(c.tower, c.mode);
        case 'wave': return this.startNextWave(true);
        default: return { ok: false, reason: 'Неизвестная команда' };
      }
    }

    trySpend(n) {
      if (!(n >= 0) || this.coins < n) return false;
      this.coins -= n;
      return true;
    }
    gain(n) {
      if (!(n > 0)) return;
      this.coins += n;
      this.earned += n;
    }

    // Можно ставить где угодно, кроме дороги, препятствий и чужих башен.
    canPlace(x, z, ignoreId) {
      const B = K.BOUNDS, R = K.TOWER_R;
      if (!isFinite(x) || !isFinite(z)) return { ok: false, reason: 'Здесь нельзя строить' };
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

    place(heroId, x, z, owner) {
      const H = K.HERO[heroId];
      if (!H || !this.squad.includes(heroId)) return { ok: false, reason: 'Героя нет в отряде' };
      const can = this.canPlace(x, z);
      if (!can.ok) return can;
      if (!this.trySpend(H.cost)) return { ok: false, reason: 'Не хватает монет' };
      const t = {
        id: this.nextId++, hero: heroId, x: +x.toFixed(3), y: 0, z: +z.toFixed(3),
        owner, up: [0, 0], skills: { vision: false, aa: false }, spent: H.cost,
        cd: 0.2, aim: 0, targeting: H.base.target || 'first', dealt: 0, kills: 0, blocked: false
      };
      t.s = towerStats(heroId, t.up, t.skills);
      this.towers.push(t);
      this.towersBuilt++;
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

    upgrade(id, br) {
      const t = this.getTower(id);
      if (!t) return { ok: false, reason: 'Башня не найдена' };
      if (br !== 0 && br !== 1) return { ok: false, reason: 'Нет такой ветки' };
      const st = upgradeState(t.hero, t.up, br, this.coins);
      if (!st.ok) return st;
      if (!this.trySpend(st.cost)) return { ok: false, reason: 'Не хватает монет' };
      t.up[br]++;
      t.spent += st.cost;
      t.s = towerStats(t.hero, t.up, t.skills);
      if (t.up[br] === 5) this.maxTierHit = true;
      this.emit({ t: 'upgrade', tower: t, branch: br, level: t.up[br] });
      return { ok: true };
    }

    buySkill(id, key) {
      const t = this.getTower(id);
      const sk = K.SKILLS[key];
      if (!t || !sk) return { ok: false, reason: 'Недоступно' };
      if (t.s[key]) return { ok: false, reason: 'Уже есть' };
      if (!this.trySpend(sk.cost)) return { ok: false, reason: 'Не хватает монет' };
      t.skills[key] = true;
      t.spent += sk.cost;
      t.s = towerStats(t.hero, t.up, t.skills);
      this.emit({ t: 'skill', tower: t, skill: key });
      return { ok: true };
    }

    sell(id) {
      const i = this.towers.findIndex(t => t.id === id);
      if (i < 0) return { ok: false, reason: 'Башня уже продана' };
      const t = this.towers[i];
      this.towers.splice(i, 1);
      const refund = Math.floor(t.spent * K.SELL_RATE);
      this.coins += refund;
      this.emit({ t: 'sell', tower: t, refund });
      return { ok: true, refund };
    }

    setTargeting(id, mode) {
      const t = this.getTower(id);
      if (!t || !['first', 'last', 'strong', 'close'].includes(mode)) return { ok: false, reason: 'Недоступно' };
      t.targeting = mode;
      return { ok: true };
    }

    canStartWave() {
      return !this.over && this.mode !== 'duel' && this.active.length === 0 && this.waveNum < this.finalWave;
    }

    startNextWave(manual) {
      if (manual && !this.canStartWave()) return { ok: false, reason: 'Волна уже идёт' };
      if (this.over || this.waveNum >= this.finalWave) return { ok: false, reason: 'Волн больше нет' };
      this.waveNum++;
      const w = genWave(this.diffKey, this.waveNum, this.seed, this.map);
      this.active.push({ n: w.n, spawns: w.spawns, idx: 0, t: 0, remaining: w.spawns.length, bonus: w.bonus, boss: w.boss });
      this.autoTimer = -1;
      this.emit({ t: 'wave', n: w.n, boss: w.boss });
      return { ok: true };
    }

    peekWave(n) { return genWave(this.diffKey, n, this.seed, this.map); }

    // ---- Враги ----
    spawn(sp, waveN, pathIdx, d) {
      const E = K.ENEMIES[sp.type];
      const hp = Math.round(E.hp * sp.hpMul);
      const e = {
        id: this.nextId++, type: sp.type, wave: waveN,
        hp, maxHp: hp, speed: E.speed * sp.spMul, armor: E.armor + (sp.type === 'armored' ? Math.floor(this.waveNum / 8) : 0),
        reward: Math.round(E.reward * (1 + waveN * 0.03)), dmg: E.dmg,
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
        if (s.execute && !e.boss && (e.hp - dmg) / e.maxHp < s.execute) dmg = e.hp;
      }
      e.hp -= dmg;
      e.hitT = 0.15;
      if (tower) tower.dealt += dmg;
      if (e.hp <= 0) this.kill(e, tower);
      return dmg;
    }

    kill(e, tower) {
      if (e.dead) return;
      e.dead = true;
      this.kills++;
      if (tower) tower.kills++;
      let bonus = 0;
      for (const t of this.towers) {
        if (t.s.killBonus > 0 && (t.x - e.x) ** 2 + (t.z - e.z) ** 2 <= t.s.range * t.s.range) bonus += t.s.killBonus;
      }
      const reward = Math.round(e.reward * (1 + Math.min(0.6, bonus)));
      this.gain(reward);
      this.removeEnemy(e);
      this.emit({ t: 'die', e, reward, bonus: bonus > 0 });
    }

    hit(e, s, dmg, tower) {
      if (!this.canTarget(s, e)) return;
      this.damage(e, dmg, s, tower);
      if (e.dead) return;
      if (s.slow > 0) {
        e.slowF = Math.max(e.slowT > 0 ? e.slowF : 0, s.slow * (e.boss ? 0.5 : 1));
        e.slowT = Math.max(e.slowT, s.slowDur);
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
    }

    rollDmg(s) {
      if (s.critC > 0 && this.rand() < s.critC) return { d: s.dmg * s.critM, crit: true };
      return { d: s.dmg, crit: false };
    }

    acquire(t, n, exclude) {
      const s = t.s, r2 = s.range * s.range;
      const list = [];
      let hidden = null;
      for (const e of this.enemies) {
        if (e.dead || (exclude && exclude.has(e.id))) continue;
        if (!this.canTarget(s, e)) continue;
        const d2 = (e.x - t.x) ** 2 + (e.z - t.z) ** 2;
        if (d2 > r2) continue;
        if (!this.los(t.x, t.z, e.x, e.z, e.flying)) { if (!hidden || e.d > hidden.d) hidden = e; continue; }
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
      const s = t.s;
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
        if (s.proj === 'beam') {
          this.hit(e, s, roll.d, t);
          this.emit({ t: 'beam', tower: t, to: { x: e.x, y: e.y + 0.5, z: e.z }, crit: roll.crit });
        } else {
          const p = {
            id: this.nextId++, kind: s.proj, x: t.x, y: t.y + 1.0, z: t.z,
            tid: e.id, tx: e.x, ty: e.y + 0.4, tz: e.z, speed: s.projSpeed, dmg: roll.d, crit: roll.crit,
            s, tower: t, owner: t.owner, air: e.flying
          };
          this.projectiles.push(p);
        }
      }
      this.emit({ t: 'shot', tower: t });
      return true;
    }

    aimAt(t, e) { t.aim = Math.atan2(e.x - t.x, e.z - t.z); }

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
        if (e.stunT > 0) { e.stunT -= dt; continue; }
        let v = e.speed;
        if (e.slowT > 0) { e.slowT -= dt; v *= 1 - e.slowF; if (e.slowT <= 0) e.slowF = 0; }
        e.dashing = !!(e.dash && this.map.dash && this.map.dash.includes(e.seg));
        if (e.dashing) v *= e.dash;
        if (this.map.hazard && this.map.hazard.includes(e.seg)) v *= 1.3;
        if (e.enraged) v *= 1.4;
        e.d += v * dt;
        const path = this.paths[e.path];
        if (e.d >= path.length) {
          e.dead = true;
          this.hp = Math.max(0, this.hp - e.dmg);
          this.leaks++;
          this.leakedTypes.add(e.type);
          if (e.invisible) this.leakedTypes.add('ghost');
          if (e.flying) this.leakedTypes.add('flyer');
          this.removeEnemy(e);
          this.emit({ t: 'leak', e });
          continue;
        }
        this.place3(e);
        if (e.elite) {
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
          e.summonT -= dt;
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

      // обнаружение невидимок (для отрисовки и подсказок)
      for (const e of this.enemies) {
        if (e.dead || !e.invisible) continue;
        e.revealed = this.towers.some(t => t.s.vision && (t.x - e.x) ** 2 + (t.z - e.z) ** 2 <= (t.s.range + 0.5) ** 2);
      }

      // башни
      for (const t of this.towers) {
        t.cd -= dt;
        if (t.cd <= 0) {
          if (this.fire(t)) t.cd += 1 / t.s.rate;
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
          const ob = this.obstacles.find(o => o.los && (o.tall || !p.air) && (nx - o.x) ** 2 + (nz - o.z) ** 2 < (o.r * 0.85) ** 2);
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
            let income = 0;
            for (const t of this.towers) income += t.s.income;
            this.gain(w.bonus + income);
            this.emit({ t: 'waveClear', n: w.n, bonus: w.bonus, income });
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
      this.a = new Field({ map: o.map, diff: 'duel', seed: this.seed, mode: 'duel', squad: o.squadA, record: true });
      this.b = new Field({ map: o.map, diff: 'duel', seed: this.seed, mode: 'duel', squad: o.squadB, record: o.recordB === true });
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
    if (f.mode === 'duel') {
      const base = duelResult === 'win' ? 80 : duelResult === 'draw' ? 35 : 15;
      return { coins: base + f.wavesCleared * 2, xp: base + f.wavesCleared * 6 };
    }
    const D = f.D;
    const win = f.result === 'win';
    let coins = Math.floor(f.kills * 0.3 + f.wavesCleared * 4 + (win ? D.winCoins : 0));
    let xp = Math.floor(f.kills * 0.5 + f.wavesCleared * 8 + (win ? D.winXp : 0));
    if (f.diffKey === 'endless') { coins += f.wavesCleared * 3; xp += f.wavesCleared * 4; }
    if (f.mode === 'team') coins = Math.floor(coins * 0.9);
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
