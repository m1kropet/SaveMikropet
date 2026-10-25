/* Общий сетевой протокол клиента и сервера: компактные снимки поля, события для отрисовки
   и RemoteField — копия поля на клиенте, которую обновляет сервер (клиент ничего не решает сам). */
(function (K) {
  'use strict';
  const TYPES = Object.keys(K.ENEMIES);
  const HEROES = K.HEROES.map(h => h.id);
  const KINDS = ['bolt', 'orb', 'shard', 'coin'];
  const TARGETS = ['first', 'last', 'strong', 'close'];
  const r2 = v => Math.round(v * 100) / 100;

  // ---------- Сервер: поле → снимок ----------
  const towerRef = t => ({ id: t.id, x: r2(t.x), z: r2(t.z), hero: t.hero });
  const enemyRef = e => ({ id: e.id, x: r2(e.x), z: r2(e.z), type: e.type, boss: e.boss, elite: e.elite, invisible: e.invisible, flying: e.flying });
  function evOut(ev) {
    switch (ev.t) {
      case 'place': case 'upgrade': case 'skill': case 'sell': return { t: ev.t, tower: towerRef(ev.tower), branch: ev.branch, skill: ev.skill, refund: ev.refund };
      case 'shot': return { t: 'shot', tower: { id: ev.tower.id, hero: ev.tower.hero } };
      case 'beam': return { t: 'beam', tower: towerRef(ev.tower), to: { x: r2(ev.to.x), z: r2(ev.to.z) }, crit: ev.crit };
      case 'chain': return { t: 'chain', tower: towerRef(ev.tower), pts: ev.pts.map(p => ({ x: r2(p.x), z: r2(p.z) })) };
      case 'pulse': return { t: 'pulse', tower: towerRef(ev.tower), r: ev.r };
      case 'boom': case 'impact': case 'blocked': return { t: ev.t, x: r2(ev.x), z: r2(ev.z), r: ev.r, kind: ev.kind, crit: ev.crit };
      case 'freeze': case 'stun': case 'heal': case 'summon': case 'enrage': case 'spawn': case 'leak': case 'shield': return { t: ev.t, e: enemyRef(ev.e) };
      case 'die': return { t: 'die', e: enemyRef(ev.e), reward: ev.reward, bonus: ev.bonus };
      case 'wave': return { t: 'wave', n: ev.n, boss: ev.boss };
      case 'waveClear': return { t: 'waveClear', n: ev.n, bonus: ev.bonus, income: ev.income };
      case 'obstacle': return { t: 'obstacle', o: { kind: ev.o.kind, x: ev.o.x, z: ev.o.z } };
      case 'piggyTotal': return { t: 'piggyTotal', amount: ev.amount };
      case 'piggy': return { t: 'piggy', tid: ev.tid, x: r2(ev.x), z: r2(ev.z), amount: ev.amount };
      case 'over': return { t: 'over', result: ev.result };
      default: return null;
    }
  }

  function snapField(f, opts) {
    opts = opts || {};
    const s = {
      t: r2(f.time), w: Object.fromEntries(Object.entries(f.wallets).map(([k, v]) => [k, Math.floor(v)])), eb: Object.fromEntries(Object.entries(f.earnedBy).map(([k, v]) => [k, Math.floor(v)])), sk: f.canSkip() ? 1 : 0, sh: f.shieldLeft, hp: f.hp, mh: f.maxHp, wn: f.waveNum, fw: isFinite(f.finalWave) ? f.finalWave : -1,
      act: f.active.length, at: r2(f.autoTimer), ov: f.over ? 1 : 0, rs: f.result, wc: f.wavesCleared, k: f.kills, lk: f.leaks, mt: f.maxTierHit ? 1 : 0,
      tw: f.towers.map(t => [t.id, HEROES.indexOf(t.hero), r2(t.x), r2(t.z), t.owner, t.up[0], t.up[1], (t.skills.vision ? 1 : 0) | (t.skills.aa ? 2 : 0), TARGETS.indexOf(t.targeting), r2(t.aim), t.blocked ? 1 : 0, t.spent, Math.round(t.dealt), t.kills]),
      en: f.enemies.filter(e => !e.dead).map(e => [e.id, TYPES.indexOf(e.type), r2(e.x), r2(e.z), Math.ceil(e.hp), e.maxHp,
        (e.flying ? 1 : 0) | (e.invisible ? 2 : 0) | (e.revealed ? 4 : 0) | (e.boss ? 8 : 0) | (e.elite ? 16 : 0) | (e.enraged ? 32 : 0) | (e.stunT > 0 ? 64 : 0) | (e.hitT > 0 ? 128 : 0) | (e.dashing ? 256 : 0) | (e.burnT > 0 ? 512 : 0) | (e.slowT > 0 ? 1024 : 0),
        r2(e.dx), r2(e.dz), e.path, r2(e.d), e.boss ? Math.round((e.eta || 0) * 10) / 10 : 0]),
      ob: f.obstacles.filter(o => o.dyn).map(o => [o.kind, o.x, o.z])
    };
    if (opts.proj !== false) s.pr = f.projectiles.map(p => [p.id, KINDS.indexOf(p.kind), r2(p.x), r2(p.z)]);
    if (opts.events) s.ev = opts.events.map(evOut).filter(Boolean);
    return s;
  }

  // ---------- Клиент: снимок → RemoteField ----------
  class RemoteField extends K.Field {
    constructor(o) {
      super(Object.assign({ record: true }, o));
      this.remote = true;
      this.statCache = new Map();
      this.emapR = new Map();
      this.dynCount = 0;
    }
    cmd(c) {
      if (this.over) return { ok: false, reason: 'Матч окончен' };
      if (!this.send) return { ok: false, reason: 'Нет соединения с сервером' };
      // быстрая проверка на клиенте для подсказок; окончательное решение — за сервером
      if (c.type === 'place') { const can = this.canPlace(c.x, c.z); if (!can.ok) return can; if (this.wallet(this.me) < K.HERO[c.hero].cost) return { ok: false, reason: 'Не хватает монет' }; }
      this.send(c);
      return { ok: true, pending: true };
    }
    canSkip() { return !!this.skipOk && !this.over; }
    step() { /* время идёт на сервере */ }
    advance() {}
    apply(s) {
      Object.assign(this, { time: s.t, wallets: s.w, earnedBy: s.eb, skipOk: !!s.sk, shieldLeft: s.sh, hp: s.hp, maxHp: s.mh, waveNum: s.wn, finalWave: s.fw < 0 ? Infinity : s.fw, autoTimer: s.at, wavesCleared: s.wc, kills: s.k, leaks: s.lk, maxTierHit: !!s.mt });
      this.active = new Array(s.act).fill({ n: s.wn });
      if (s.ov && !this.over) { this.over = true; this.result = s.rs; }
      // башни
      this.towers = s.tw.map(a => {
        const t = { id: a[0], hero: HEROES[a[1]], x: a[2], y: 0, z: a[3], owner: a[4], up: [a[5], a[6]], skills: { vision: !!(a[7] & 1), aa: !!(a[7] & 2) }, targeting: TARGETS[a[8]] || 'first', aim: a[9], blocked: !!a[10], spent: a[11], dealt: a[12], kills: a[13] };
        const key = t.hero + t.up.join('') + a[7];
        if (!this.statCache.has(key)) this.statCache.set(key, K.towerStats(t.hero, t.up, t.skills));
        t.s = this.statCache.get(key);
        return t;
      });
      // враги: плавно догоняют позицию с сервера
      const seen = new Set();
      this.enemies = s.en.map(a => {
        seen.add(a[0]);
        let e = this.emapR.get(a[0]);
        const fl = a[6];
        if (!e) { e = { id: a[0], x: a[2], z: a[3], y: 0 }; this.emapR.set(a[0], e); }
        Object.assign(e, {
          type: TYPES[a[1]], tx: a[2], tz: a[3], hp: a[4], maxHp: a[5], flying: !!(fl & 1), invisible: !!(fl & 2), revealed: !!(fl & 4),
          boss: !!(fl & 8), elite: !!(fl & 16), enraged: !!(fl & 32), stunT: fl & 64 ? 0.2 : 0, hitT: fl & 128 ? 0.12 : 0, dashing: !!(fl & 256), burnT: fl & 512 ? 0.5 : 0, slowT: fl & 1024 ? 0.5 : 0,
          dx: a[7], dz: a[8], path: a[9], d: a[10], eta: (fl & 8) ? a[11] : undefined, dead: false
        });
        return e;
      });
      for (const id of [...this.emapR.keys()]) if (!seen.has(id)) this.emapR.delete(id);
      if (s.pr) this.projectiles = s.pr.map(a => ({ id: a[0], kind: KINDS[a[1]], x: a[2], z: a[3], y: 0 }));
      // новые препятствия добавляются, старые объекты не пересоздаются
      if (s.ob.length > this.dynCount) {
        s.ob.slice(this.dynCount).forEach(([kind, x, z]) => { const O = K.OBSTACLES[kind]; this.obstacles.push({ kind, x, z, r: O.r, tall: !!O.tall, los: O.los !== false, dyn: true, rot: ((x * 7.3 + z * 3.1) % 1 + 1) % 1 }); });
        this.dynCount = s.ob.length;
      }
      if (s.ev) for (const ev of s.ev) {
        if (ev.e && this.emapR.has(ev.e.id)) ev.e = Object.assign({}, this.emapR.get(ev.e.id), ev.e);
        if (ev.t === 'obstacle') ev.o = this.obstacles[this.obstacles.length - 1];
        this.events.push(ev);
      }
    }
    // сглаживание движения между снимками
    smooth(dt) {
      const k = Math.min(1, dt * 12);
      for (const e of this.enemies) { e.x += (e.tx - e.x) * k; e.z += (e.tz - e.z) * k; }
    }
  }

  // Дуэль по сети: та же форма, что у DuelMatch, для интерфейса.
  class RemoteDuel {
    constructor(a, b) { this.a = a; this.b = b; this.time = 0; this.gap = null; this.wait = null; this.over = false; this.result = null; this.reason = ''; }
    waiting() { return this.wait; }
    apply(d) { this.time = d.t; this.gap = d.gap; this.wait = d.w; }
  }

  K.NetProto = { snapField, evOut, RemoteField, RemoteDuel, HEROES, TYPES };
})(globalThis.KV = globalThis.KV || {});
