/* ИИ-соперник для дуэли. Использует те же команды, что и игрок: покупает, ставит,
   улучшает башни и реагирует на типы врагов. Уровни: простой, средний, сложный. */
(function (K) {
  'use strict';

  // cap — типичное здоровье врага: урон сверх него «сгорает» (overkill), что учитывает толпы.
  function power(s, cap, armor) {
    const eff = Math.min(cap || 1e9, Math.max(s.dmg * 0.25, s.dmg - Math.max(0, (armor || 0) - s.pierce)));
    let p = eff * s.rate * (1 + s.critC * (s.critM - 1)) * Math.pow(Math.min(s.multi, 6), 0.75);
    p *= 1 + s.splash * 0.9;
    p *= 1 + s.chain * 0.45;
    if (s.aoeAll) p *= 3;
    p *= 1 + s.slow * 0.8 + s.freezeC * 2 + s.stunC;
    p *= 1 + Math.min(s.pierce, 10) * 0.05;
    p += s.burn * 1.5 * (1 + s.splash);
    p *= Math.pow(s.range / 3, 0.4);
    return p;
  }

  const PREF = { blaster: 0, dragon: 0, ice: 0, prism: 1, storm: 0, piggy: 1 };

  class Bot {
    // skill 0..1 подбирается по уровню игрока (K.botSkill)
    constructor(field, skill) {
      this.f = field;
      this.skill = skill;
      this.think = 3.2 - 2.5 * skill;
      this.r = K.rng(field.seed ^ 0xb07);
      this.t = 1;
      this.lastAction = 'Осматривает карту';
    }

    tick(dt) {
      if (this.f.over) return;
      this.t -= dt;
      if (this.t > 0) return;
      this.t = this.think * (0.7 + this.r() * 0.6);
      this.act();
    }

    threats() {
      const f = this.f;
      const set = new Set(f.leakedTypes);
      if (this.skill > 0.3) f.enemies.forEach(e => { if (e.flying) set.add('flyer'); if (e.invisible) set.add('ghost'); });
      if (this.skill > 0.6) {
        f.peekWave(f.waveNum + 1).spawns.forEach(s => {
          if (s.type === 'flyer' || s.flying) set.add('flyer');
          if (s.type === 'ghost' || s.invisible) set.add('ghost');
        });
      }
      return set;
    }

    // Лучшее свободное место из заранее посчитанных точек с хорошим обзором дороги.
    freeSpot(hero) {
      const f = this.f, out = [];
      if (hero && K.HERO[hero].base.perch) {
        const ps = f.perchSpots(hero);
        if (!ps.length) return null;
        const span = Math.max(1, Math.round((1 - this.skill) * Math.min(6, ps.length)));
        return ps[Math.floor(this.r() * span)];
      }
      for (const sp of f.layout.spots) {
        if (!f.canPlace(sp.x, sp.z).ok) continue;
        if (f.towers.some(t => Math.hypot(t.x - sp.x, t.z - sp.z) < 1.1)) continue;
        out.push(sp);
        if (out.length >= 12) break;
      }
      if (!out.length) return null;
      const span = Math.max(1, Math.round((1 - this.skill) * out.length));
      return out[Math.floor(this.r() * span)];
    }

    bestTower(pred) {
      let best = null;
      for (const t of this.f.towers) if ((!pred || pred(t)) && (!best || t.s.dps > best.s.dps)) best = t;
      return best;
    }

    act() {
      const f = this.f;
      const th = this.threats();
      const squad = f.squad;
      const do_ = (c, label) => { const r = f.cmd(c); if (r.ok) this.lastAction = label; return r.ok; };

      for (const [need, key, hero] of [['ghost', 'vision', null], ['flyer', 'aa', 'dragon']]) {
        if (!th.has(need) || f.towers.filter(t => t.s[key]).length >= Math.max(1, Math.ceil(f.towers.length / 4))) continue;
        const sp = this.freeSpot(hero);
        if (hero && squad.includes(hero) && sp && f.coins >= K.HERO[hero].cost) {
          if (do_({ type: 'place', hero, x: sp.x, z: sp.z, owner: f.me }, 'Ставит ' + K.HERO[hero].name)) return;
        }
        const t = this.bestTower(x => !x.s[key]);
        if (t && f.coins >= K.SKILLS[key].cost) {
          if (do_({ type: 'skill', tower: t.id, skill: key }, 'Покупает ' + K.SKILLS[key].name)) return;
        }
        if (this.skill > 0.3) return; // копит на защиту
      }

      // Оценка «сила за монету»: новая башня против улучшения существующей.
      const opts = [];
      const cap = 45 * K.genWaveScale(f.diffKey, f.waveNum + 1);
      const arm = f.waveNum >= 4 ? 3 + f.waveNum / 10 : 0;
      const sp0 = this.freeSpot();
      if (sp0) {
        for (const h of squad) {
          if (h === 'piggy' && f.towers.some(t => t.hero === 'piggy')) continue;
          const sp = K.HERO[h].base.perch ? this.freeSpot(h) : sp0;
          if (!sp) continue;
          // худшие места видят меньше дороги — новая башня там стоит меньше
          const cov = Math.pow(sp.cov / (f.layout.spots[0].cov || 1), 2);
          const v = power(K.towerStats(h, [0, 0], {}), cap, arm) * cov / K.HERO[h].cost;
          opts.push({ v: v * (f.towers.length < 2 ? 3 : 1), cost: K.HERO[h].cost, c: { type: 'place', hero: h, x: sp.x, z: sp.z, owner: f.me }, label: 'Ставит ' + K.HERO[h].name });
        }
      }
      for (const t of f.towers) {
        for (const br of [0, 1]) {
          const st = K.upgradeState(t.hero, t.up, br, null);
          if (!st.ok) continue;
          const up = t.up.slice(); up[br]++;
          let gain = power(K.towerStats(t.hero, up, t.skills), cap, arm) - power(t.s, cap, arm);
          if (br !== PREF[t.hero] && t.up[br] >= 2) gain *= 0.3;
          opts.push({ v: gain / st.cost, cost: st.cost, c: { type: 'upgrade', tower: t.id, branch: br }, label: 'Улучшает ' + K.HERO[t.hero].name });
        }
      }
      if (!opts.length) return;
      const noise = 1.2 * (1 - this.skill);
      opts.forEach(o => { o.v *= 1 - noise / 2 + this.r() * noise; });
      opts.sort((a, b) => b.v - a.v);
      const pick = opts[0];
      if (f.coins >= pick.cost) do_(pick.c, pick.label);
    }
  }

  K.Bot = Bot;
})(globalThis.KV = globalThis.KV || {});
