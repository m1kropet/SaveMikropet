/* 2D-рендер поля боя на Canvas: вид сверху, тёмные комнаты с источниками света,
   дорога сущностей, препятствия, башни, снаряды, эффекты, зона обзора башни. */
(function (K) {
  'use strict';
  const S2 = K.Sprites;
  const TAU = Math.PI * 2;
  const VIEW = { x0: -9.1, x1: 9.1, z0: -10.6, z1: 9.8 };

  const THEMES = {
    lobby: { bg: '#0d0807', dark: 0.42, lamp: '#ffb05a', wall: 'paper', floor: 'planks', road: 'carpet', planks: ['#3a2316', '#33200f', '#41291a', '#2e1c10'] },
    corridor: { bg: '#0b0806', dark: 0.5, lamp: '#ffa848', wall: 'paper', floor: 'planks', road: 'carpet', planks: ['#2e1d12', '#291a0f', '#352214', '#24170c'] },
    mirrors: { bg: '#0b0914', dark: 0.52, lamp: '#b8a6ff', wall: 'mirror', floor: 'marble', road: 'runner' },
    mine: { bg: '#0d0907', dark: 0.48, lamp: '#ff9a3d', wall: 'rock', floor: 'rock', road: 'rails' },
    crystal: { bg: '#050a14', dark: 0.45, lamp: '#38f2e0', wall: 'rock', floor: 'crystal', road: 'gravel' },
    depths: { bg: '#050302', dark: 0.58, lamp: '#ff6a2a', wall: 'rock', floor: 'basalt', road: 'basalt' }
  };
  const QUAL = { low: { dpr: 1, parts: 120 }, mid: { dpr: 1.5, parts: 260 }, high: { dpr: 2, parts: 500 } };

  function pathLines(ctx, paths) {
    ctx.beginPath();
    paths.forEach(p => { p.pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.z) : ctx.moveTo(q.x, q.z))); });
  }
  function offsetSegs(paths, off) {
    const out = [];
    paths.forEach(p => p.segs.forEach(s => {
      const nx = -(s.b.z - s.a.z) / s.len, nz = (s.b.x - s.a.x) / s.len;
      out.push([s.a.x + nx * off, s.a.z + nz * off, s.b.x + nx * off, s.b.z + nz * off]);
    }));
    return out;
  }

  // Статичный фон карты: пол, стены с дверями, дорога, дверь появления, гнездо микропета, светильники.
  function drawBackground(ctx, map, paths, lights, t) {
    const th = THEMES[map.theme], r = K.rng(map.id.length * 7919 + 3);
    const X0 = VIEW.x0, X1 = VIEW.x1, Z0 = VIEW.z0, Z1 = VIEW.z1, XW = X1 - X0, AREA = XW / 11.8;
    // за пределами комнаты — продолжение стены, а не пустота
    ctx.fillStyle = { paper: '#141e18', mirror: '#1c1830', rock: th.floor === 'crystal' ? '#121a2c' : '#18110c' }[th.wall]; ctx.fillRect(X0 - 30, Z0 - 30, XW + 60, Z1 - Z0 + 60);
    // пол
    if (th.floor === 'planks') {
      for (let x = X0, i = 0; x < X1; x += 0.5, i++) {
        ctx.fillStyle = th.planks[i % 4]; ctx.fillRect(x, Z0, 0.5, Z1 - Z0);
        ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x, Z0, 0.02, Z1 - Z0);
        for (let z = Z0 + r() * 2; z < Z1; z += 1.6 + r() * 1.6) ctx.fillRect(x, z, 0.5, 0.02);
        ctx.strokeStyle = 'rgba(20,10,4,0.25)'; ctx.lineWidth = 0.01;
        for (let k = 0; k < 4; k++) { const gx = x + 0.08 + r() * 0.34; ctx.beginPath(); ctx.moveTo(gx, Z0); ctx.bezierCurveTo(gx + 0.05, 0, gx - 0.05, 5, gx, Z1); ctx.stroke(); }
      }
    } else if (th.floor === 'marble') {
      ctx.fillStyle = '#120e1c'; ctx.fillRect(X0, Z0, X1 - X0, Z1 - Z0);
      for (let x = X0; x < X1; x += 1.5) for (let z = Z0; z < Z1; z += 1.5) { ctx.fillStyle = ((x + z) / 1.5) % 2 ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.15)'; ctx.fillRect(x, z, 1.5, 1.5); }
      for (let i = 0; i < 40 * AREA; i++) { ctx.strokeStyle = `rgba(190,175,255,${0.05 + r() * 0.12})`; ctx.lineWidth = 0.01 + r() * 0.03; ctx.beginPath(); const x = X0 + r() * XW, z = Z0 + r() * 21; ctx.moveTo(x, z); ctx.bezierCurveTo(x + r() * 2 - 1, z + 1, x + r() * 2 - 1, z + 2, x + r() * 3 - 1.5, z + 3); ctx.stroke(); }
    } else {
      const base = { rock: '#2b2018', crystal: '#0b1424', basalt: '#110a08' }[th.floor];
      const blobs = { rock: ['#3d2e22', '#1a120c', '#4a3a2c'], crystal: ['#13233f', '#060c18', '#1a2d52'], basalt: ['#1d1412', '#060404', '#24180f'] }[th.floor];
      ctx.fillStyle = base; ctx.fillRect(X0, Z0, X1 - X0, Z1 - Z0);
      for (let i = 0; i < 700 * AREA; i++) { ctx.fillStyle = blobs[i % 3]; ctx.globalAlpha = 0.2 + r() * 0.4; ctx.beginPath(); ctx.arc(X0 + r() * XW, Z0 + r() * 21, 0.03 + r() * 0.25, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
      if (th.floor === 'crystal') for (let i = 0; i < 90 * AREA; i++) { ctx.fillStyle = i % 2 ? '#38f2e0' : '#e05cff'; ctx.globalAlpha = 0.3 + r() * 0.5; ctx.fillRect(X0 + r() * XW, Z0 + r() * 21, 0.03, 0.03); }
      if (th.floor === 'basalt') {
        ctx.save(); ctx.strokeStyle = '#ff5a1f'; ctx.lineCap = 'round'; ctx.globalAlpha = 0.55;
        for (let i = 0; i < 26 * AREA; i++) { ctx.lineWidth = 0.015 + r() * 0.03; ctx.beginPath(); let x = X0 + r() * XW, z = Z0 + r() * 21; ctx.moveTo(x, z); for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 1.4; z += (r() - 0.5) * 1.4; ctx.lineTo(x, z); } ctx.stroke(); }
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
    // дорога
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const W = K.ROAD_R * 2;
    if (map.hazard) {
      ctx.save(); ctx.strokeStyle = 'rgba(255,77,31,0.55)'; ctx.lineWidth = W + 0.5;
      paths[0].segs.forEach((s, i) => { if (map.hazard.includes(i)) { ctx.beginPath(); ctx.moveTo(s.a.x, s.a.z); ctx.lineTo(s.b.x, s.b.z); ctx.stroke(); } });
      ctx.restore();
    }
    const roadStyle = {
      carpet: ['#c9a35a', '#5a0e17'], runner: ['#b8a6ff', '#2a1a4a'], rails: ['#2a221c', '#3a3430'], gravel: ['#38f2e055', '#2a2f3a'], basalt: ['#ff5a1f88', '#24170f']
    }[th.road];
    ctx.strokeStyle = roadStyle[0]; ctx.lineWidth = W; pathLines(ctx, paths); ctx.stroke();
    ctx.strokeStyle = roadStyle[1]; ctx.lineWidth = W - 0.12; pathLines(ctx, paths); ctx.stroke();
    if (th.road === 'carpet' || th.road === 'runner') {
      ctx.strokeStyle = th.road === 'carpet' ? 'rgba(201,163,90,0.45)' : 'rgba(184,166,255,0.4)'; ctx.lineWidth = 0.025;
      paths.forEach(p => p.segs.forEach(s => {
        const ux = (s.b.x - s.a.x) / s.len, uz = (s.b.z - s.a.z) / s.len;
        for (let d = 0.4; d < s.len - 0.2; d += 0.7) {
          const cx = s.a.x + ux * d, cz = s.a.z + uz * d;
          ctx.beginPath(); ctx.moveTo(cx + ux * 0.22, cz + uz * 0.22); ctx.lineTo(cx - uz * 0.3, cz + ux * 0.3); ctx.lineTo(cx - ux * 0.22, cz - uz * 0.22); ctx.lineTo(cx + uz * 0.3, cz - ux * 0.3); ctx.closePath(); ctx.stroke();
        }
      }));
    }
    if (th.road === 'rails') {
      ctx.strokeStyle = '#4a2e1a'; ctx.lineWidth = 0.1; ctx.lineCap = 'butt';
      paths.forEach(p => p.segs.forEach(s => {
        const ux = (s.b.x - s.a.x) / s.len, uz = (s.b.z - s.a.z) / s.len;
        for (let d = 0.2; d < s.len; d += 0.42) { const cx = s.a.x + ux * d, cz = s.a.z + uz * d; ctx.beginPath(); ctx.moveTo(cx - uz * 0.4, cz + ux * 0.4); ctx.lineTo(cx + uz * 0.4, cz - ux * 0.4); ctx.stroke(); }
      }));
      ctx.strokeStyle = '#9aa0aa'; ctx.lineWidth = 0.05; ctx.lineCap = 'round';
      [0.27, -0.27].forEach(off => offsetSegs(paths, off).forEach(([ax, az, bx, bz]) => { ctx.beginPath(); ctx.moveTo(ax, az); ctx.lineTo(bx, bz); ctx.stroke(); }));
    }
    // участки рывка Прыгуна
    ctx.strokeStyle = 'rgba(157,255,61,0.45)'; ctx.lineWidth = 0.06; ctx.lineCap = 'round';
    paths.forEach(p => p.segs.forEach((s, i) => {
      if (!(map.dash || []).includes(i)) return;
      const ux = (s.b.x - s.a.x) / s.len, uz = (s.b.z - s.a.z) / s.len;
      for (let d = 0.8; d < s.len - 0.4; d += 1.1) {
        const cx = s.a.x + ux * d, cz = s.a.z + uz * d;
        ctx.beginPath(); ctx.moveTo(cx - ux * 0.15 - uz * 0.25, cz - uz * 0.15 + ux * 0.25); ctx.lineTo(cx + ux * 0.12, cz + uz * 0.12); ctx.lineTo(cx - ux * 0.15 + uz * 0.25, cz - uz * 0.15 - ux * 0.25); ctx.stroke();
      }
    }));
    // стены
    const wallCol = { paper: '#1d2a22', mirror: '#2a2446', rock: th.floor === 'crystal' ? '#1a2238' : '#221812' }[th.wall];
    ctx.fillStyle = wallCol;
    ctx.fillRect(X0, Z0, X1 - X0, 0.55); ctx.fillRect(X0, Z0, 0.5, Z1 - Z0); ctx.fillRect(X1 - 0.5, Z0, 0.5, Z1 - Z0); ctx.fillRect(X0, Z1 - 0.45, X1 - X0, 0.45);
    if (th.wall === 'paper') { ctx.fillStyle = 'rgba(201,163,90,0.25)'; for (let x = X0; x < X1; x += 0.3) ctx.fillRect(x, Z0, 0.02, 0.55); for (let z = Z0; z < Z1; z += 0.3) { ctx.fillRect(X0, z, 0.5, 0.02); ctx.fillRect(X1 - 0.5, z, 0.5, 0.02); } }
    if (th.wall === 'mirror') { ctx.fillStyle = 'rgba(216,208,255,0.18)'; for (let z = Z0; z < Z1; z += 1.2) { ctx.fillRect(X0 + 0.08, z + 0.1, 0.34, 1.0); ctx.fillRect(X1 - 0.42, z + 0.1, 0.34, 1.0); } }
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(X0 + 0.5, Z0 + 0.55, X1 - X0 - 1, 0.12); ctx.fillRect(X0 + 0.5, Z0 + 0.55, 0.1, Z1 - Z0 - 1); ctx.fillRect(X1 - 0.6, Z0 + 0.55, 0.1, Z1 - Z0 - 1);
    // двери с табличками на боковых стенах (отель)
    if (map.cat === 'Отель') {
      for (let i = 0; i < 6; i++) {
        const side = i % 2 ? 1 : -1, z = -8 + Math.floor(i / 2) * 6 + (side > 0 ? 3 : 0);
        const x = side < 0 ? X0 + 0.05 : X1 - 0.45;
        ctx.fillStyle = '#2c1a10'; ctx.fillRect(x, z, 0.4, 1.0); ctx.fillStyle = '#c9a35a'; ctx.fillRect(x + 0.1, z + 0.15, 0.2, 0.12);
      }
    }
    // дверь появления
    const st = paths[0].pts[0];
    const dg = ctx.createRadialGradient(st.x, Z0 + 0.6, 0.1, st.x, Z0 + 0.6, 2.2);
    dg.addColorStop(0, 'rgba(255,42,61,0.45)'); dg.addColorStop(1, 'rgba(255,42,61,0)');
    ctx.fillStyle = dg; ctx.fillRect(st.x - 2.5, Z0, 5, 3);
    ctx.fillStyle = map.cat === 'Отель' ? '#24140c' : '#4a2e1a'; ctx.fillRect(st.x - 0.75, Z0, 1.5, 0.62);
    ctx.fillStyle = '#220004'; ctx.fillRect(st.x - 0.6, Z0, 1.2, 0.5);
    ctx.fillStyle = '#ff2a3d'; ctx.globalAlpha = 0.6; ctx.fillRect(st.x - 0.6, Z0 + 0.46, 1.2, 0.04); ctx.globalAlpha = 1;
    if (map.cat === 'Отель') { ctx.fillStyle = '#c9a35a'; ctx.fillRect(st.x - 0.25, Z0 + 0.08, 0.5, 0.16); }
    // гнездо микропета
    const e = paths[0].pts[paths[0].pts.length - 1];
    const ng = ctx.createRadialGradient(e.x, e.z, 0.1, e.x, e.z, 1.2);
    ng.addColorStop(0, 'rgba(95,255,216,0.35)'); ng.addColorStop(1, 'rgba(95,255,216,0)');
    ctx.fillStyle = ng; ctx.beginPath(); ctx.arc(e.x, e.z, 1.2, 0, TAU); ctx.fill();
    // светильники
    lights.forEach(L => {
      if (L.kind === 'sconce') { ctx.fillStyle = '#c9a35a'; ctx.fillRect(L.x - 0.08, L.z - 0.08, 0.16, 0.16); S2.glowDot(ctx, L.x, L.z, 0.06, L.color, 6); }
      else if (L.kind === 'chandelier') { ctx.strokeStyle = '#c9a35a'; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.arc(L.x, L.z, 0.45, 0, TAU); ctx.stroke(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; S2.glowDot(ctx, L.x + Math.cos(a) * 0.45, L.z + Math.sin(a) * 0.45, 0.05, L.color, 6); } }
      else if (L.kind === 'lantern') { ctx.fillStyle = '#3a2a1a'; ctx.fillRect(L.x - 0.09, L.z - 0.12, 0.18, 0.24); S2.glowDot(ctx, L.x, L.z, 0.06, L.color, 6); }
    });
  }

  function makeLights(map, paths) {
    const L = [], th = THEMES[map.theme];
    if (map.cat === 'Отель') {
      for (let z = -8; z <= 8; z += 4) { L.push({ x: VIEW.x0 + 0.35, z, r: 3, color: th.lamp, kind: 'sconce' }); L.push({ x: VIEW.x1 - 0.35, z: z + 2, r: 3, color: th.lamp, kind: 'sconce' }); }
      if (map.theme === 'lobby') L.push({ x: 0, z: -2, r: 4.2, color: '#ffd28a', kind: 'chandelier' });
      if (map.theme === 'mirrors') L.push({ x: 0, z: -2, r: 3.2, color: '#d8ccff', kind: 'chandelier' });
    } else {
      const segs = paths[0].segs;
      segs.forEach((s, i) => { if (i % 2) return; const k = 0.5; L.push({ x: s.a.x + (s.b.x - s.a.x) * k + 0.9, z: s.a.z + (s.b.z - s.a.z) * k + 0.9, r: 2.8, color: th.lamp, kind: 'lantern' }); });
    }
    return L;
  }

  class Render2D {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.quality = 'mid'; this.effects = true;
      this.time = 0;
      this.fx = []; this.parts = []; this.towerState = new Map();
      this.dark = document.createElement('canvas');
      this.bg = document.createElement('canvas');
      this.obsAnim = new Map();
    }
    setQuality(q, effects) { this.quality = QUAL[q] ? q : 'mid'; this.effects = effects !== false; if (this.w) this.resize(this.w, this.h); }
    resize(w, h) {
      this.w = Math.max(1, w); this.h = Math.max(1, h);
      this.dpr = Math.min(window.devicePixelRatio || 1, QUAL[this.quality].dpr);
      this.canvas.width = Math.round(this.w * this.dpr); this.canvas.height = Math.round(this.h * this.dpr);
      const W = VIEW.x1 - VIEW.x0, H = VIEW.z1 - VIEW.z0;
      this.S = Math.min(this.w / W, this.h / H);
      this.ox = this.w / 2 - ((VIEW.x0 + VIEW.x1) / 2) * this.S;
      this.oy = this.h / 2 - ((VIEW.z0 + VIEW.z1) / 2) * this.S;
      if (this.map) this.rebuild();
    }
    build(field) {
      this.field = field; this.map = field.map; this.theme = THEMES[field.map.theme];
      this.lights = makeLights(field.map, field.paths);
      this.fx = []; this.parts = []; this.towerState.clear(); this.obsAnim.clear(); this.petHit = 0; this.shake = 0;
      if (this.w) this.rebuild();
    }
    rebuild() {
      const b = this.bg;
      b.width = this.canvas.width; b.height = this.canvas.height;
      const c = b.getContext('2d');
      c.setTransform(this.dpr * this.S, 0, 0, this.dpr * this.S, this.dpr * this.ox, this.dpr * this.oy);
      S2.setPx(this.S * this.dpr);
      drawBackground(c, this.map, this.field.paths, this.lights);
      this.dark.width = Math.ceil(this.canvas.width / 2); this.dark.height = Math.ceil(this.canvas.height / 2);
    }
    world(ctx) { ctx.setTransform(this.dpr * this.S, 0, 0, this.dpr * this.S, this.dpr * this.ox, this.dpr * this.oy); }
    toWorld(px, py) { return { x: (px - this.ox) / this.S, z: (py - this.oy) / this.S }; }

    pick(px, py, field) {
      const p = this.toWorld(px, py);
      let best = null, bd = K.TOWER_R + 0.15;
      for (const t of field.towers) { const d = Math.hypot(t.x - p.x, t.z - p.z); if (d < bd) { bd = d; best = t; } }
      return best ? { type: 'tower', id: best.id, x: p.x, z: p.z } : { type: 'ground', x: p.x, z: p.z };
    }

    spark(x, z, color, n, speed, life, up) {
      if (!this.effects) n = Math.ceil(n / 3);
      const max = QUAL[this.quality].parts;
      for (let i = 0; i < n; i++) {
        if (this.parts.length >= max) this.parts.shift();
        const a = Math.random() * TAU, s = speed * (0.3 + Math.random() * 0.7);
        this.parts.push({ x, z, h: up || 0.4, vx: Math.cos(a) * s, vz: Math.sin(a) * s * 0.6, vh: s * (0.5 + Math.random()), life: life * (0.6 + Math.random() * 0.4), max: life, color });
      }
    }

    consume(evs) {
      for (const ev of evs) {
        switch (ev.t) {
          case 'place': this.spark(ev.tower.x, ev.tower.z, K.HERO[ev.tower.hero].color, 18, 2.5, 0.6); break;
          case 'upgrade': case 'skill':
            this.spark(ev.tower.x, ev.tower.z, ev.t === 'skill' ? (ev.skill === 'vision' ? '#46ffe0' : '#ff5a3d') : (ev.branch === 0 ? '#ffd25e' : '#ff5a6e'), 22, 2.5, 0.7);
            this.fx.push({ k: 'ring', x: ev.tower.x, z: ev.tower.z, r0: 0.3, r1: 1.2, color: '#ffd25e', t: 0, life: 0.45 }); break;
          case 'sell': this.spark(ev.tower.x, ev.tower.z, '#ffc53d', 16, 2, 0.6); break;
          case 'shot': { const s = this.towerState.get(ev.tower.id); if (s) s.recoil = 1; break; }
          case 'beam': this.fx.push({ k: 'line', pts: [{ x: ev.tower.x, z: ev.tower.z }, ev.to], color: ev.crit ? '#ffffff' : '#ffe36b', w: ev.crit ? 0.11 : 0.07, t: 0, life: 0.18 }); this.spark(ev.to.x, ev.to.z, '#ffe36b', 6, 1.5, 0.3); { const s = this.towerState.get(ev.tower.id); if (s) s.recoil = 1; } break;
          case 'chain': {
            const pts = [];
            ev.pts.forEach((p, i) => { if (i) { const a = ev.pts[i - 1]; for (let k = 1; k < 3; k++) pts.push({ x: a.x + (p.x - a.x) * k / 3 + (Math.random() - 0.5) * 0.3, z: a.z + (p.z - a.z) * k / 3 + (Math.random() - 0.5) * 0.3 }); } pts.push({ x: p.x, z: p.z }); });
            this.fx.push({ k: 'line', pts, color: '#a8f0ff', w: 0.05, t: 0, life: 0.16, glow: true });
            { const s = this.towerState.get(ev.tower.id); if (s) s.recoil = 1; }
            break;
          }
          case 'boom': this.fx.push({ k: 'boom', x: ev.x, z: ev.z, r: ev.r, color: ev.kind === 'orb' ? '#c070ff' : ev.kind === 'shard' ? '#9feaff' : '#ffd25e', t: 0, life: 0.35 }); this.spark(ev.x, ev.z, ev.kind === 'orb' ? '#e070ff' : '#bff6ff', 10, 2.5, 0.45); break;
          case 'impact': this.spark(ev.x, ev.z, ev.kind === 'coin' ? '#ffc53d' : ev.crit ? '#ffffff' : '#ff9ad8', ev.crit ? 8 : 3, ev.crit ? 2.6 : 1.6, 0.3); break;
          case 'blocked': this.spark(ev.x, ev.z, '#bbbbbb', 5, 1.4, 0.3); break;
          case 'pulse': this.fx.push({ k: 'ring', x: ev.tower.x, z: ev.tower.z, r0: 0.3, r1: ev.r, color: '#9feaff', t: 0, life: 0.45 }); break;
          case 'freeze': this.spark(ev.e.x, ev.e.z, '#dff9ff', 8, 1.2, 0.5); break;
          case 'stun': this.spark(ev.e.x, ev.e.z, '#fff66b', 5, 1.2, 0.35, 1); break;
          case 'heal': this.spark(ev.e.x, ev.e.z, '#6bff8a', 12, 1.5, 0.6, 1); break;
          case 'summon': case 'enrage': this.fx.push({ k: 'boom', x: ev.e.x, z: ev.e.z, r: 1.6, color: '#ff2a3d', t: 0, life: 0.6 }); this.spark(ev.e.x, ev.e.z, '#ff2a3d', 24, 3, 0.7, 1); if (ev.t === 'enrage') this.shake = 0.5; break;
          case 'die': this.spark(ev.e.x, ev.e.z, ev.e.boss ? '#ff2a3d' : '#d9d2ff', ev.e.boss ? 60 : 12, ev.e.boss ? 4 : 2.4, 0.6, 0.5); if (ev.e.boss) this.shake = 0.8; break;
          case 'piggy': {
            // Свинка пополняет баланс: подпрыгивает и выбрасывает монетки
            const s = this.towerState.get(ev.tid); if (s) s.bounce = 1;
            for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i - 4) * 0.28; this.fx.push({ k: 'coin', x: ev.x, z: ev.z - 0.5, vx: Math.cos(a) * (1.2 + (i % 3) * 0.35), vh: 3.4 + (i % 2) * 0.8, h: 0, t: -i * 0.04, life: 1.1 }); }
            this.fx.push({ k: 'text', x: ev.x, z: ev.z - 0.5, text: '+' + ev.amount, color: '#ffc53d', t: 0, life: 1.3 });
            this.fx.push({ k: 'ring', x: ev.x, z: ev.z, r0: 0.3, r1: 1.4, color: '#ffc53d', t: 0, life: 0.5 });
            break;
          }
          case 'shield': { const e = this.field.end; this.fx.push({ k: 'ring', x: e.x, z: e.z, r0: 0.4, r1: 1.6, color: '#ffb7d0', t: 0, life: 0.6 }); this.spark(e.x, e.z, '#ffb7d0', 14, 2, 0.5, 0.8); break; }
          case 'leak': this.petHit = 0.6; this.shake = Math.max(this.shake, 0.3); break;
          case 'obstacle': this.obsAnim.set(ev.o, 0); this.spark(ev.o.x, ev.o.z, '#d9c9b0', 24, 2.4, 0.6); break;
        }
      }
    }

    // Тень обзора: секторы за препятствиями, куда башня не видит.
    drawVision(ctx, field, x, z, R, ok) {
      ctx.save();
      ctx.fillStyle = ok === false ? 'rgba(255,60,80,0.12)' : 'rgba(255,255,255,0.08)';
      ctx.strokeStyle = ok === false ? 'rgba(255,90,110,0.9)' : 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 0.04;
      ctx.beginPath(); ctx.arc(x, z, R, 0, TAU); ctx.fill(); ctx.stroke();
      for (const o of field.obstacles) {
        if (!o.los) continue;
        const d = Math.hypot(o.x - x, o.z - z);
        if (d <= o.r * 0.9 || d - o.r > R) continue;
        const th = Math.atan2(o.z - z, o.x - x), a = Math.asin(Math.min(1, (o.r * 0.9) / d));
        const near = Math.sqrt(Math.max(0.01, d * d - (o.r * 0.9) ** 2));
        ctx.fillStyle = o.tall ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.28)';
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(th - a) * near, z + Math.sin(th - a) * near);
        ctx.arc(x, z, R, th - a, th + a);
        ctx.lineTo(x + Math.cos(th + a) * near, z + Math.sin(th + a) * near);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }

    frame(field, dt, ui) {
      if (!this.map || !this.w) return;
      this.time += dt;
      const t = this.time, ctx = this.ctx, PX = this.S * this.dpr;
      S2.setPx(PX);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(this.bg, 0, 0);
      let sx = 0, sy = 0;
      if (this.shake > 0) { this.shake -= dt; sx = (Math.random() - 0.5) * this.shake * 0.25; sy = (Math.random() - 0.5) * this.shake * 0.25; }
      const W = () => { this.world(ctx); if (sx || sy) ctx.translate(sx, sy); };
      W();

      // глубинная сортировка: препятствия, башни, сущности
      const list = [];
      for (const o of field.obstacles) list.push({ z: o.z + o.r * 0.3, o });
      for (const tw of field.towers) list.push({ z: tw.z, tw });
      for (const e of field.enemies) if (!e.dead) list.push({ z: e.z, e });
      const end = field.paths[0].pts[field.paths[0].pts.length - 1];
      list.push({ z: end.z, pet: true });
      list.sort((a, b) => a.z - b.z);
      for (const it of list) {
        ctx.save();
        if (it.o) {
          let k = 1;
          if (this.obsAnim.has(it.o)) { const a = this.obsAnim.get(it.o) + dt; this.obsAnim.set(it.o, a); k = Math.min(1, a / 0.4); if (a > 0.4) this.obsAnim.delete(it.o); }
          ctx.translate(it.o.x, it.o.z); ctx.scale(k, k); S2.obstacle(ctx, it.o, t);
        } else if (it.tw) {
          const tw = it.tw;
          let st = this.towerState.get(tw.id);
          if (!st) { st = { aim: Math.PI - tw.aim, recoil: 0 }; this.towerState.set(tw.id, st); }
          let goal = Math.PI - tw.aim, d = goal - st.aim;
          while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
          st.aim += d * Math.min(1, dt * 10);
          st.recoil = Math.max(0, st.recoil - dt * 6);
          ctx.translate(tw.x, tw.z);
          if (st.bounce > 0) {
            st.bounce = Math.max(0, st.bounce - dt * 1.4);
            const b = 1 - st.bounce, jump = Math.sin(Math.min(1, b * 1.6) * Math.PI) * 0.35, sq = Math.sin(b * Math.PI * 3) * 0.12 * st.bounce;
            ctx.translate(0, -jump); ctx.scale(1 + sq, 1 - sq);
          }
          const owner = field.players.find(p => p.id === tw.owner);
          S2.tower(ctx, tw.hero, { aim: st.aim, t: t + tw.id, recoil: st.recoil, color: owner ? owner.color : '#ff6b6b', up: tw.up, vision: tw.s.vision, aa: tw.s.aa });
        } else if (it.e) {
          ctx.translate(it.e.x, it.e.z); S2.enemy(ctx, it.e, t, 'body');
        } else if (it.pet) {
          ctx.translate(end.x, end.z + 0.15);
          if (this.petHit > 0) this.petHit -= dt;
          S2.pet(ctx, t, this.petHit, field.hp / field.maxHp);
        }
        ctx.restore();
      }

      // снаряды
      for (const p of field.projectiles) {
        if (p.kind === 'bolt') S2.glowDot(ctx, p.x, p.z - 0.4, 0.07, ['#ff3d6e', '#ffb12e', '#fff04a', '#3dff8b', '#3db8ff', '#a64bff'][p.id % 6], PX * 0.25);
        else if (p.kind === 'orb') S2.glowDot(ctx, p.x, p.z - 0.4, 0.15, '#c070ff', PX * 0.4);
        else if (p.kind === 'shard') { ctx.save(); ctx.translate(p.x, p.z - 0.4); ctx.rotate(t * 10); ctx.fillStyle = '#dff9ff'; ctx.fillRect(-0.06, -0.06, 0.12, 0.12); ctx.restore(); }
        else if (p.kind === 'coin') S2.glowDot(ctx, p.x, p.z - 0.4, 0.08, '#ffc53d', PX * 0.15);
      }
      // эффекты
      for (let i = this.fx.length - 1; i >= 0; i--) {
        const f = this.fx[i]; f.t += dt; const k = f.t / f.life;
        if (k >= 1) { this.fx.splice(i, 1); continue; }
        if (f.k === 'coin') { if (f.t > 0) { f.vh -= 9 * dt; f.h += f.vh * dt; f.x += f.vx * dt; } continue; }
        ctx.save();
        if (f.k === 'line') {
          ctx.globalAlpha = 1 - k; ctx.strokeStyle = f.color; ctx.lineWidth = f.w; ctx.lineCap = 'round'; ctx.shadowColor = f.color; ctx.shadowBlur = PX * 0.3;
          ctx.beginPath(); f.pts.forEach((p, j) => (j ? ctx.lineTo(p.x, p.z - 0.4) : ctx.moveTo(p.x, p.z - 0.45))); ctx.stroke();
        } else if (f.k === 'boom') {
          ctx.globalAlpha = 0.55 * (1 - k); ctx.fillStyle = f.color; ctx.beginPath(); ctx.arc(f.x, f.z - 0.3, 0.2 + f.r * Math.sqrt(k), 0, TAU); ctx.fill();
        } else if (f.k === 'ring') {
          ctx.globalAlpha = 0.8 * (1 - k); ctx.strokeStyle = f.color; ctx.lineWidth = 0.06; ctx.beginPath(); ctx.arc(f.x, f.z, f.r0 + (f.r1 - f.r0) * Math.sqrt(k), 0, TAU); ctx.stroke();
        }
        ctx.restore();
      }

      // темнота с источниками света
      const dc = this.dark.getContext('2d'), dw = this.dark.width, dh = this.dark.height;
      const ds = dw / this.w;
      dc.setTransform(1, 0, 0, 1, 0, 0); dc.globalCompositeOperation = 'source-over'; dc.clearRect(0, 0, dw, dh);
      dc.fillStyle = `rgba(0,0,0,${this.theme.dark * (this.effects ? 1 : 0.6)})`; dc.fillRect(0, 0, dw, dh);
      dc.globalCompositeOperation = 'destination-out';
      dc.setTransform(ds * this.S, 0, 0, ds * this.S, ds * (this.ox + sx * this.S), ds * (this.oy + sy * this.S));
      const hole = (x, z, r, a) => { const g = dc.createRadialGradient(x, z, 0, x, z, r); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)'); dc.fillStyle = g; dc.fillRect(x - r, z - r, r * 2, r * 2); };
      this.lights.forEach((L, i) => {
        const fl = this.effects ? 0.85 + 0.15 * Math.sin(t * 13 + i * 3) * Math.sin(t * 7.3 + i) - (Math.sin(t * 0.7 + i * 5) > 0.985 ? 0.5 : 0) : 1;
        hole(L.x, L.z, L.r, Math.max(0, fl));
      });
      hole(end.x, end.z, 2.6, 1);
      field.towers.forEach(tw => hole(tw.x, tw.z, 1.9, 0.85));
      this.fx.forEach(f => { if (f.k === 'boom') hole(f.x, f.z, f.r + 1, 0.6 * (1 - f.t / f.life)); });
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(this.dark, 0, 0, this.canvas.width, this.canvas.height);
      if (this.effects) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; W();
        this.lights.forEach(L => { const g = ctx.createRadialGradient(L.x, L.z, 0, L.x, L.z, L.r); g.addColorStop(0, L.color + '22'); g.addColorStop(1, L.color + '00'); ctx.fillStyle = g; ctx.fillRect(L.x - L.r, L.z - L.r, L.r * 2, L.r * 2); });
        ctx.restore();
      }

      // поверх темноты: глаза, босс, полоски здоровья, значки, обзор
      W();
      for (const e of field.enemies) {
        if (e.dead) continue;
        ctx.save(); ctx.translate(e.x, e.z); S2.enemy(ctx, e, t, 'eyes'); ctx.restore();
        const frac = e.hp / e.maxHp;
        if ((frac < 0.999 || e.boss || e.elite) && (!e.invisible || e.revealed)) {
          const w = e.boss ? 1.6 : e.elite ? 0.9 : 0.6, y = e.boss ? -2.55 : e.flying ? -1.55 : e.elite ? -1.6 : e.type === 'jumper' ? -1.65 : e.type === 'fast' ? -0.5 : e.type === 'armored' ? -1.05 : -1.2;
          ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(e.x - w / 2, e.z + y, w, 0.1);
          ctx.fillStyle = e.boss ? '#ff2a3d' : e.elite ? '#d36bff' : '#e6455a'; ctx.fillRect(e.x - w / 2 + 0.015, e.z + y + 0.015, (w - 0.03) * Math.max(0, frac), 0.07);
        }
      }
      for (const tw of field.towers) {
        if (!tw.blocked) continue;
        ctx.save(); ctx.translate(tw.x + K.TOWER_R * 0.75, tw.z - K.TOWER_R * 1.1);
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; S2.circle(ctx, 0, 0, 0.16); ctx.fill();
        ctx.strokeStyle = '#ffcf5a'; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.ellipse(0, 0, 0.11, 0.06, 0, 0, TAU); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-0.11, 0.09); ctx.lineTo(0.11, -0.09); ctx.stroke();
        ctx.restore();
      }
      if (ui) {
        if (ui.selected != null) { const tw = field.towers.find(x => x.id === ui.selected); if (tw) this.drawVision(ctx, field, tw.x, tw.z, tw.s.range); }
        if (ui.ghost) {
          const g = ui.ghost;
          this.drawVision(ctx, field, g.x, g.z, K.HERO[g.hero].base.range, g.ok);
          ctx.save(); ctx.globalAlpha = 0.65; ctx.translate(g.x, g.z); S2.tower(ctx, g.hero, { aim: 0, t, recoil: 0, color: g.color || '#45e0c0', up: [0, 0] }); ctx.restore();
          if (!g.ok) { ctx.save(); ctx.strokeStyle = '#ff5a6e'; ctx.lineWidth = 0.07; ctx.translate(g.x, g.z); ctx.beginPath(); ctx.moveTo(-0.25, -0.25); ctx.lineTo(0.25, 0.25); ctx.moveTo(0.25, -0.25); ctx.lineTo(-0.25, 0.25); ctx.stroke(); ctx.restore(); }
        }
      }
      // искры и всплывающие числа
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i];
        p.life -= dt; if (p.life <= 0) { this.parts.splice(i, 1); continue; }
        p.vh -= 6 * dt; p.x += p.vx * dt; p.z += p.vz * dt; p.h = Math.max(0, p.h + p.vh * dt);
        ctx.globalAlpha = Math.min(1, p.life / p.max * 1.5); ctx.fillStyle = p.color; ctx.fillRect(p.x - 0.03, p.z - p.h - 0.03, 0.06, 0.06);
      }
      ctx.globalAlpha = 1;
      for (const f of this.fx) {
        if (f.k === 'coin') {
          if (f.t <= 0) continue;
          const k = f.t / f.life, sp = Math.abs(Math.cos(f.t * 14));
          ctx.save(); ctx.globalAlpha = Math.min(1, (1 - k) * 2); ctx.translate(f.x, f.z - f.h); ctx.scale(Math.max(0.15, sp), 1);
          ctx.fillStyle = '#ffc53d'; ctx.strokeStyle = '#a8701a'; ctx.lineWidth = 0.025; ctx.shadowColor = '#ffc53d'; ctx.shadowBlur = PX * 0.25;
          ctx.beginPath(); ctx.arc(0, 0, 0.2, 0, TAU); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#fff3c4'; ctx.fillRect(-0.035, -0.1, 0.07, 0.2);
          ctx.restore(); continue;
        }
        if (f.k !== 'text') continue;
        const k = f.t / f.life;
        ctx.save(); ctx.globalAlpha = 1 - k; ctx.translate(f.x, f.z - 1.1 - k * 0.6); ctx.scale(0.01, 0.01);
        ctx.font = 'bold 30px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = f.color; ctx.strokeStyle = '#000'; ctx.lineWidth = 6; ctx.strokeText(f.text, 0, 0); ctx.fillText(f.text, 0, 0);
        ctx.restore();
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    clear() { this.map = null; this.field = null; this.fx = []; this.parts = []; }
    dispose() { this.clear(); }
  }

  // Превью карты для меню: фон, препятствия, дверь и микропет.
  const thumbCache = {};
  Render2D.mapThumb = function (map, w, h) {
    const key = map.id + w + 'x' + h;
    if (thumbCache[key]) return thumbCache[key];
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    const W = VIEW.x1 - VIEW.x0, H = VIEW.z1 - VIEW.z0, S = Math.max(w / W, h / H);
    ctx.setTransform(S, 0, 0, S, w / 2, h / 2 - ((VIEW.z0 + VIEW.z1) / 2) * S);
    S2.setPx(S);
    const paths = map.paths.map(K.buildPath);
    drawBackground(ctx, map, paths, makeLights(map, paths));
    K.mapLayout(map).obstacles.forEach(o => { ctx.save(); ctx.translate(o.x, o.z); S2.obstacle(ctx, o, 0); ctx.restore(); });
    const e = paths[0].pts[paths[0].pts.length - 1];
    ctx.save(); ctx.translate(e.x, e.z + 0.15); S2.pet(ctx, 0.5, 0, 1); ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.7);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    thumbCache[key] = c.toDataURL('image/jpeg', 0.85);
    return thumbCache[key];
  };

  K.Render2D = Render2D;
})(globalThis.KV = globalThis.KV || {});
