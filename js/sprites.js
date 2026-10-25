/* 2D-спрайты, нарисованные кодом: микропет и Ковтоп по образам игрока, оригинальные сущности,
   герои-башни (вид сверху) и препятствия. Единица рисования — одна клетка карты.
   Сущности рисуются «стоя»: точка (0,0) — их ноги. */
(function (K) {
  'use strict';
  const TAU = Math.PI * 2;

  function rainbow(ctx, x0, y0, x1, y1, shift) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    const c = ['#ff3d6e', '#ffb12e', '#fff04a', '#3dff8b', '#3db8ff', '#a64bff', '#ff3d6e'];
    const s = ((shift || 0) % 1 + 1) % 1;
    for (let i = 0; i < c.length; i++) g.addColorStop(((i / (c.length - 1)) + s) % 1, c[i]);
    return g;
  }
  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); }
  function shadow(ctx, w, a) { ctx.fillStyle = `rgba(0,0,0,${a || 0.35})`; ctx.beginPath(); ctx.ellipse(0, 0, w, w * 0.35, 0, 0, TAU); ctx.fill(); }
  function glowDot(ctx, x, y, r, color, blur) {
    ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = blur || 8; ctx.fillStyle = color; circle(ctx, x, y, r); ctx.fill(); ctx.restore();
  }
  // Глоу в единицах карты: shadowBlur не масштабируется трансформацией, поэтому передаём пиксели.
  let PX = 40;

  // ---------------- Микропет (образ игрока: чёрный худи, радужный контур, драконьи головы) ----------------
  function dragonHead(ctx, dir, t, s) {
    ctx.save();
    ctx.scale(dir * s, s);
    ctx.rotate(Math.sin(t * 2 + s * 5) * 0.08);
    const body = new Path2D('M0 0 C0.12 -0.12 0.32 -0.16 0.5 -0.1 L0.66 -0.06 L0.6 0.02 L0.46 0.02 L0.56 0.08 L0.4 0.1 C0.26 0.12 0.1 0.1 0 0 Z');
    ctx.fillStyle = '#0b0b10'; ctx.fill(body);
    ctx.lineWidth = 0.03; ctx.strokeStyle = rainbow(ctx, 0, -0.16, 0.66, 0.1, t * 0.3); ctx.stroke(body);
    ctx.fillStyle = '#0b0b10';
    ctx.beginPath(); ctx.moveTo(0.18, -0.12); ctx.lineTo(0.1, -0.28); ctx.lineTo(0.26, -0.13); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0.28, -0.13); ctx.lineTo(0.26, -0.26); ctx.lineTo(0.36, -0.13); ctx.fill();
    glowDot(ctx, 0.36, -0.06, 0.03, '#b6ff3d', PX * 0.15);
    for (let i = 0; i < 3; i++) { ctx.fillStyle = '#f5f2e8'; ctx.beginPath(); ctx.moveTo(0.42 + i * 0.05, 0.02); ctx.lineTo(0.445 + i * 0.05, 0.07); ctx.lineTo(0.47 + i * 0.05, 0.02); ctx.fill(); }
    ctx.restore();
  }

  function pet(ctx, t, hit, frac) {
    const bob = Math.abs(Math.sin(t * 2.4)) * 0.05;
    shadow(ctx, 0.5, 0.45);
    ctx.save();
    ctx.translate(hit > 0 ? Math.sin(t * 60) * 0.04 : 0, -bob);
    // радужный хвостик-шнур
    ctx.lineWidth = 0.035; ctx.strokeStyle = rainbow(ctx, -0.6, -0.1, 0, -0.5, t * 0.2);
    ctx.beginPath(); ctx.moveTo(-0.22, -0.45); ctx.bezierCurveTo(-0.6, -0.4, -0.5, -0.05, -0.75, -0.1); ctx.stroke();
    // ноги и радужные кроссовки
    ctx.fillStyle = '#0b0b10'; ctx.fillRect(-0.2, -0.42, 0.17, 0.34); ctx.fillRect(0.03, -0.42, 0.17, 0.34);
    ctx.fillStyle = rainbow(ctx, -0.22, 0, 0.22, 0, t * 0.4); rrect(ctx, -0.23, -0.1, 0.21, 0.1, 0.03); ctx.fill(); rrect(ctx, 0.02, -0.1, 0.21, 0.1, 0.03); ctx.fill();
    // туловище-худи
    ctx.save();
    ctx.shadowColor = '#b06bff'; ctx.shadowBlur = PX * 0.25;
    ctx.fillStyle = '#0b0b10'; rrect(ctx, -0.27, -0.85, 0.54, 0.46, 0.05); ctx.fill();
    ctx.restore();
    ctx.lineWidth = 0.03; ctx.strokeStyle = rainbow(ctx, -0.3, -0.85, 0.3, -0.4, t * 0.25); rrect(ctx, -0.27, -0.85, 0.54, 0.46, 0.05); ctx.stroke();
    ctx.strokeStyle = '#e8e8f0'; ctx.lineWidth = 0.015;
    ctx.beginPath(); ctx.moveTo(-0.06, -0.8); ctx.lineTo(-0.07, -0.62); ctx.moveTo(0.06, -0.8); ctx.lineTo(0.07, -0.62); ctx.stroke();
    ctx.fillStyle = '#16161e'; rrect(ctx, -0.16, -0.58, 0.32, 0.12, 0.03); ctx.fill();
    // руки
    const sw = Math.sin(t * 2.4) * 0.03;
    ctx.fillStyle = '#0b0b10'; rrect(ctx, -0.42, -0.84 + sw, 0.14, 0.36, 0.05); ctx.fill(); rrect(ctx, 0.28, -0.84 - sw, 0.14, 0.36, 0.05); ctx.fill();
    ctx.strokeStyle = rainbow(ctx, -0.42, -0.84, 0.42, -0.5, t * 0.3); ctx.lineWidth = 0.02;
    rrect(ctx, -0.42, -0.84 + sw, 0.14, 0.36, 0.05); ctx.stroke(); rrect(ctx, 0.28, -0.84 - sw, 0.14, 0.36, 0.05); ctx.stroke();
    ctx.fillStyle = '#f2f2f2'; circle(ctx, -0.35, -0.45 + sw, 0.065); ctx.fill(); circle(ctx, 0.35, -0.45 - sw, 0.065); ctx.fill();
    // голова в капюшоне
    ctx.fillStyle = '#0b0b10'; rrect(ctx, -0.25, -1.28, 0.5, 0.45, 0.1); ctx.fill();
    ctx.strokeStyle = rainbow(ctx, -0.25, -1.28, 0.25, -0.83, t * 0.35); ctx.lineWidth = 0.03; rrect(ctx, -0.25, -1.28, 0.5, 0.45, 0.1); ctx.stroke();
    const blink = (t % 3.7) < 0.12 ? 0.25 : 1;
    ctx.save(); ctx.shadowColor = '#5fffe8'; ctx.shadowBlur = PX * 0.2; ctx.fillStyle = '#7ffff0';
    ctx.fillRect(-0.12, -1.1, 0.06, 0.1 * blink); ctx.fillRect(0.06, -1.1, 0.06, 0.1 * blink); ctx.restore();
    // три драконьи головы
    ctx.save(); ctx.translate(-0.3, -0.92); dragonHead(ctx, -1, t, 0.85); ctx.restore();
    ctx.save(); ctx.translate(-0.32, -0.66); dragonHead(ctx, -1, t + 1.3, 0.7); ctx.restore();
    ctx.save(); ctx.translate(0.3, -0.92); dragonHead(ctx, 1, t + 0.6, 0.85); ctx.restore();
    if (hit > 0) { ctx.globalAlpha = Math.min(0.5, hit); ctx.fillStyle = '#ff2a3d'; rrect(ctx, -0.45, -1.3, 0.9, 1.3, 0.1); ctx.fill(); }
    ctx.restore();
  }

  // ---------------- Ковтоп (образ игрока: телевизор-голова «NOW SERVING 00», мониторы-глаза, коса) ----------------
  const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcfgd' };
  function digit(ctx, x, y, w, h, n) {
    const on = SEG[n] || '', th = w * 0.22;
    const seg = { a: [x, y, w, th], g: [x, y + h / 2 - th / 2, w, th], d: [x, y + h - th, w, th], f: [x, y, th, h / 2], e: [x, y + h / 2, th, h / 2], b: [x + w - th, y, th, h / 2], c: [x + w - th, y + h / 2, th, h / 2] };
    for (const k of 'abcdefg') { ctx.globalAlpha = on.includes(k) ? 1 : 0.12; ctx.fillRect(...seg[k]); }
    ctx.globalAlpha = 1;
  }
  function monitor(ctx, x, y, s, eye, t) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = '#e9e9f0'; rrect(ctx, -0.2, -0.16, 0.4, 0.32, 0.04); ctx.fill();
    ctx.fillStyle = '#0a0a12'; ctx.fillRect(-0.16, -0.12, 0.32, 0.24);
    ctx.save(); ctx.shadowColor = eye; ctx.shadowBlur = PX * 0.3 * s;
    ctx.fillStyle = eye; ctx.beginPath(); ctx.ellipse(0, 0, 0.12, 0.07 * (0.6 + 0.4 * Math.abs(Math.sin(t * 1.7 + x))), 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff'; circle(ctx, 0, 0, 0.035); ctx.fill(); ctx.restore();
    ctx.restore();
  }
  // eta — сколько секунд боссу осталось до микропета (показывается на экране телевизора)
  function kovtop(ctx, t, enraged, scale, eta) {
    const s = scale || 1;
    ctx.save(); ctx.scale(s, s);
    shadow(ctx, 0.6, 0.5);
    const eye = enraged ? '#ff3b4d' : '#6e8bff';
    const sway = Math.sin(t * 1.5) * 0.03;
    // мониторы за спиной
    const mons = [];
    for (let i = 0; i < 8; i++) {
      const a = t * (enraged ? 0.9 : 0.5) + i / 8 * TAU;
      mons.push({ x: Math.cos(a) * 0.85, y: -1.15 + Math.sin(a) * 0.55, back: Math.sin(a) < 0, a });
    }
    mons.filter(m => m.back).forEach(m => monitor(ctx, m.x, m.y, 0.8, eye, t));
    // коса
    ctx.save(); ctx.translate(0.45, -0.9); ctx.rotate(0.35 + sway);
    ctx.fillStyle = '#16141a'; ctx.fillRect(-0.03, -0.95, 0.06, 1.7);
    ctx.fillStyle = '#d8d6de'; ctx.beginPath(); ctx.moveTo(0.02, -0.92); ctx.quadraticCurveTo(0.55, -1.0, 0.75, -0.55); ctx.quadraticCurveTo(0.45, -0.85, 0.02, -0.78); ctx.fill();
    ctx.restore();
    // плащ-крыло
    ctx.fillStyle = 'rgba(220,226,240,0.85)'; ctx.beginPath(); ctx.moveTo(0.1, -0.6); ctx.quadraticCurveTo(0.7, -0.4, 0.55, 0.02); ctx.lineTo(0.12, -0.05); ctx.fill();
    ctx.strokeStyle = rainbow(ctx, 0.1, -0.6, 0.6, 0, t * 0.2); ctx.lineWidth = 0.015; ctx.stroke();
    // тело
    ctx.fillStyle = '#0e0d12';
    ctx.fillRect(-0.24, -0.5, 0.2, 0.48); ctx.fillRect(0.04, -0.5, 0.2, 0.48);
    rrect(ctx, -0.34, -1.05, 0.68, 0.6, 0.05); ctx.fill();
    rrect(ctx, -0.52, -1.02 + sway, 0.18, 0.5, 0.05); ctx.fill(); rrect(ctx, 0.34, -1.02 - sway, 0.18, 0.5, 0.05); ctx.fill();
    ctx.strokeStyle = '#3a3640'; ctx.lineWidth = 0.02; ctx.beginPath(); ctx.moveTo(-0.3, -1.0); ctx.lineTo(0.28, -0.5); ctx.stroke();
    // кулон-улыбака
    ctx.fillStyle = '#0a0a0c'; circle(ctx, -0.12, -0.55, 0.13); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.02; ctx.beginPath(); ctx.arc(-0.12, -0.56, 0.08, 0.15, Math.PI - 0.15); ctx.stroke();
    ctx.fillStyle = '#ffffff'; circle(ctx, -0.16, -0.6, 0.018); ctx.fill(); circle(ctx, -0.08, -0.6, 0.018); ctx.fill();
    // голова-телевизор
    ctx.fillStyle = '#1b1a20'; rrect(ctx, -0.36, -1.62, 0.72, 0.56, 0.05); ctx.fill();
    ctx.fillStyle = '#050507'; ctx.fillRect(-0.31, -1.57, 0.62, 0.46);
    ctx.save(); ctx.scale(0.01, 0.01); ctx.fillStyle = '#e8e8e8'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center'; ctx.fillText('NOW SERVING', 0, -148); ctx.restore();
    ctx.save(); ctx.shadowColor = '#ff2a2a'; ctx.shadowBlur = PX * 0.25; ctx.fillStyle = enraged && Math.floor(t * 6) % 2 ? '#ffd0d0' : '#ff2a2a';
    if (typeof eta === 'string') {
      // экран показывает произвольные две цифры (секрет в меню); '--' — пустой экран
      if (/^\d\d$/.test(eta)) { digit(ctx, -0.2, -1.43, 0.16, 0.26, +eta[0]); digit(ctx, 0.04, -1.43, 0.16, 0.26, +eta[1]); }
    } else if (eta != null) {
      const v = Math.max(0, Math.min(99, Math.ceil(eta)));
      digit(ctx, -0.2, -1.43, 0.16, 0.26, Math.floor(v / 10)); digit(ctx, 0.04, -1.43, 0.16, 0.26, v % 10);
    } else {
      const n = enraged ? Math.floor(t * 3) % 10 : 0;
      digit(ctx, -0.2, -1.43, 0.16, 0.26, n); digit(ctx, 0.04, -1.43, 0.16, 0.26, enraged ? (n + 7) % 10 : 0);
    }
    ctx.restore();
    // корона из шипов
    ctx.fillStyle = '#0a090c';
    for (let i = 0; i < 9; i++) {
      const x = -0.34 + i * 0.085, h = 0.18 + ((i * 37) % 5) * 0.04;
      ctx.beginPath(); ctx.moveTo(x - 0.04, -1.6); ctx.lineTo(x + Math.sin(i) * 0.05, -1.6 - h); ctx.lineTo(x + 0.05, -1.6); ctx.fill();
    }
    ctx.fillStyle = '#dcdcdc'; for (let i = 0; i < 5; i++) { circle(ctx, -0.28 + i * 0.14, -1.7 - (i % 2) * 0.06, 0.015); ctx.fill(); }
    mons.filter(m => !m.back).forEach(m => monitor(ctx, m.x, m.y, 0.85, eye, t));
    ctx.restore();
  }

  // ---------------- Сущности (оригинальные) ----------------
  // Каждая функция рисует тело; eyes() рисует только светящиеся глаза поверх темноты.
  const ENEMY = {
    normal: {
      body(ctx, t, ph) {
        shadow(ctx, 0.28);
        const w = Math.sin(t * 5 + ph) * 0.03;
        ctx.fillStyle = '#0c0a10';
        ctx.beginPath(); ctx.moveTo(-0.28, 0); for (let i = 0; i <= 6; i++) ctx.lineTo(-0.28 + i * 0.0933, (i % 2 ? -0.06 : 0)); ctx.lineTo(0.15 + w, -0.7); ctx.lineTo(-0.15 + w, -0.7); ctx.closePath(); ctx.fill();
        circle(ctx, w, -0.85, 0.2); ctx.fill();
      },
      eyes(ctx, t, ph) { const w = Math.sin(t * 5 + ph) * 0.03; glowDot(ctx, -0.07 + w, -0.87, 0.04, '#ffffff', PX * 0.25); glowDot(ctx, 0.07 + w, -0.87, 0.04, '#ffffff', PX * 0.25); }
    },
    fast: {
      body(ctx, t, ph) {
        shadow(ctx, 0.3, 0.3);
        ctx.strokeStyle = '#1a0b0e'; ctx.lineWidth = 0.035;
        for (let i = 0; i < 6; i++) {
          const side = i < 3 ? -1 : 1, k = (i % 3) - 1, l = Math.sin(t * 22 + i + ph) * 0.05;
          ctx.beginPath(); ctx.moveTo(0, -0.14); ctx.lineTo(side * 0.22, -0.2 + k * 0.08 + l); ctx.lineTo(side * 0.32, -0.02 + k * 0.06); ctx.stroke();
        }
        ctx.fillStyle = '#1d0d10'; ctx.beginPath(); ctx.ellipse(0, -0.15, 0.2, 0.13, 0, 0, TAU); ctx.fill();
      },
      eyes(ctx) { glowDot(ctx, -0.06, -0.18, 0.035, '#ff2a2a', PX * 0.2); glowDot(ctx, 0.06, -0.18, 0.035, '#ff2a2a', PX * 0.2); }
    },
    armored: {
      body(ctx, t, ph) {
        shadow(ctx, 0.42);
        const b = Math.abs(Math.sin(t * 3 + ph)) * 0.02;
        ctx.fillStyle = '#2a1c14'; rrect(ctx, -0.36, -0.82 - b, 0.72, 0.8, 0.08); ctx.fill();
        ctx.fillStyle = '#6b6f78'; rrect(ctx, -0.3, -0.62 - b, 0.6, 0.36, 0.04); ctx.fill();
        ctx.fillStyle = '#8a8f99'; ctx.fillRect(-0.38, -0.86 - b, 0.76, 0.08);
        ctx.fillStyle = '#4a4e56'; for (let i = 0; i < 4; i++) { circle(ctx, -0.22 + i * 0.147, -0.44 - b, 0.025); ctx.fill(); }
      },
      eyes(ctx) { glowDot(ctx, -0.12, -0.72, 0.04, '#ffcc33', PX * 0.2); glowDot(ctx, 0.12, -0.72, 0.04, '#ffcc33', PX * 0.2); }
    },
    ghost: {
      body(ctx, t, ph) {
        const y = Math.sin(t * 2 + ph) * 0.06;
        ctx.fillStyle = '#bff8ff';
        ctx.beginPath(); ctx.moveTo(-0.3, -0.05 + y);
        for (let i = 0; i <= 5; i++) ctx.lineTo(-0.3 + i * 0.12, -0.05 + y + (i % 2 ? -0.08 : 0) + Math.sin(t * 6 + i) * 0.02);
        ctx.quadraticCurveTo(0.34, -1.05 + y, 0, -1.05 + y); ctx.quadraticCurveTo(-0.34, -1.05 + y, -0.3, -0.05 + y); ctx.fill();
      },
      eyes(ctx, t, ph) { const y = Math.sin(t * 2 + ph) * 0.06; ctx.fillStyle = '#041016'; ctx.beginPath(); ctx.ellipse(-0.09, -0.72 + y, 0.05, 0.08, 0, 0, TAU); ctx.ellipse(0.09, -0.72 + y, 0.05, 0.08, 0, 0, TAU); ctx.fill(); }
    },
    flyer: {
      body(ctx, t, ph) {
        ctx.save(); ctx.globalAlpha *= 0.6; shadow(ctx, 0.2, 0.3); ctx.restore();
        const y = -1.2 + Math.sin(t * 3 + ph) * 0.08, f = Math.sin(t * 14 + ph);
        ctx.fillStyle = '#2a1c14';
        [-1, 1].forEach(d => { ctx.beginPath(); ctx.moveTo(d * 0.15, y); ctx.lineTo(d * 0.55, y - 0.2 - f * 0.12); ctx.lineTo(d * 0.42, y + 0.02); ctx.lineTo(d * 0.5, y + 0.1 + f * 0.05); ctx.closePath(); ctx.fill(); });
        ctx.fillStyle = '#f2efe6'; circle(ctx, 0, y, 0.2); ctx.fill();
      },
      eyes(ctx, t, ph) { const y = -1.2 + Math.sin(t * 3 + ph) * 0.08; glowDot(ctx, 0, y, 0.1, '#ff8a1f', PX * 0.3); ctx.fillStyle = '#050505'; circle(ctx, 0, y, 0.045); ctx.fill(); }
    },
    jumper: {
      body(ctx, t, ph, e) {
        const h = Math.abs(Math.sin(t * (e && e.dashing ? 12 : 6) + ph)) * (e && e.dashing ? 0.35 : 0.18);
        shadow(ctx, 0.2 - h * 0.2);
        ctx.strokeStyle = '#161214'; ctx.lineWidth = 0.04;
        ctx.beginPath(); ctx.moveTo(-0.1, -h); ctx.lineTo(-0.06, -1.0 - h); ctx.moveTo(0.1, -h); ctx.lineTo(0.06, -1.0 - h); ctx.stroke();
        ctx.fillStyle = '#161214'; ctx.beginPath(); ctx.ellipse(0, -1.15 - h, 0.17, 0.24, 0, 0, TAU); ctx.fill();
      },
      eyes(ctx, t, ph, e) { const h = Math.abs(Math.sin(t * (e && e.dashing ? 12 : 6) + ph)) * (e && e.dashing ? 0.35 : 0.18); glowDot(ctx, 0, -1.2 - h, 0.06, '#9dff3d', PX * 0.25); }
    },
    elite: {
      body(ctx, t, ph) {
        ctx.save(); ctx.globalAlpha *= 0.3 + 0.15 * Math.sin(t * 3); ctx.strokeStyle = '#d36bff'; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.ellipse(0, 0, 0.75, 0.3, 0, 0, TAU); ctx.stroke(); ctx.restore();
        shadow(ctx, 0.36);
        ctx.fillStyle = '#1c0f2a';
        ctx.beginPath(); ctx.moveTo(-0.38, 0); ctx.lineTo(0.38, 0); ctx.lineTo(0.18, -1.0); ctx.lineTo(-0.18, -1.0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#0c0a10'; circle(ctx, 0, -1.15, 0.24); ctx.fill();
      },
      eyes(ctx, t) {
        for (let i = 0; i < 5; i++) { const a = -Math.PI + (i + 0.5) / 5 * Math.PI; glowDot(ctx, Math.cos(a) * 0.3, -1.25 + Math.sin(a) * 0.22, 0.045, '#d36bff', PX * 0.2); }
        glowDot(ctx, -0.08, -1.15, 0.04, '#ffffff', PX * 0.2); glowDot(ctx, 0.08, -1.15, 0.04, '#ffffff', PX * 0.2);
      }
    }
  };

  function enemy(ctx, e, t, mode) {
    const ph = e.id * 1.7;
    const frozen = e.stunT > 0;
    const tt = frozen ? ph : t;
    ctx.save();
    if (e.hitT > 0) ctx.scale(1 + e.hitT * 0.6, 1 - e.hitT * 0.4);
    if (e.invisible) ctx.globalAlpha = e.revealed ? 0.7 : 0.13;
    if (e.boss) {
      if (mode === 'eyes') kovtop(ctx, tt, e.enraged, e.enraged ? 1.25 : 1.12, e.eta); // босс всегда виден поверх темноты
    } else {
      const E = ENEMY[e.type];
      if (e.invisible && e.type !== 'ghost' && mode === 'body') { ctx.save(); ctx.globalAlpha *= 0.7; E.body(ctx, tt, ph, e); ctx.restore(); }
      else if (mode === 'body') E.body(ctx, tt, ph, e);
      else if (!e.invisible || e.revealed) E.eyes(ctx, tt, ph, e);
    }
    if (mode === 'body' && frozen) { ctx.globalAlpha = 0.45; ctx.fillStyle = '#bff6ff'; rrect(ctx, -0.32, e.flying ? -1.45 : -1.05, 0.64, e.flying ? 0.5 : 1.05, 0.08); ctx.fill(); }
    ctx.restore();
  }

  // ---------------- Герои (вид сверху) ----------------
  function base(ctx, color, r) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; circle(ctx, 0.04, 0.06, r); ctx.fill();
    ctx.fillStyle = '#1d1c22'; circle(ctx, 0, 0, r); ctx.fill();
    ctx.lineWidth = 0.06; ctx.strokeStyle = color; circle(ctx, 0, 0, r - 0.03); ctx.stroke();
  }
  const HERO = {
    // Бластер: корпус с барабаном и тремя стволами
    blaster(ctx, o) {
      ctx.rotate(o.aim);
      const k = o.recoil * 0.07;
      ctx.fillStyle = '#2b2f3a'; rrect(ctx, -0.2, -0.18 + k, 0.4, 0.38, 0.08); ctx.fill();
      ctx.fillStyle = '#121418'; for (let i = -1; i <= 1; i++) { rrect(ctx, i * 0.09 - 0.03, -0.5 + k, 0.06, 0.34, 0.02); ctx.fill(); }
      const hues = ['#ff3d6e', '#ffb12e', '#fff04a', '#3dff8b', '#3db8ff', '#a64bff'];
      ctx.save(); ctx.translate(0, 0.08 + k); ctx.rotate(o.t * 4);
      for (let i = 0; i < 6; i++) { ctx.fillStyle = hues[i]; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 0.11, i / 6 * TAU, (i + 1) / 6 * TAU); ctx.fill(); }
      ctx.restore();
      ctx.fillStyle = '#1a1c22'; circle(ctx, 0, 0.08 + k, 0.04); ctx.fill();
      glowDot(ctx, 0, -0.5 + k, 0.03, hues[Math.floor(o.t * 6) % 6], PX * 0.2);
    },
    // Диномайк: неоновый динозаврик с динамитом на спине
    dragon(ctx, o) {
      ctx.rotate(o.aim);
      const sway = Math.sin(o.t * 3) * 0.05;
      ctx.fillStyle = '#6b3aa8';
      ctx.beginPath(); ctx.moveTo(-0.08, 0.2); ctx.quadraticCurveTo(sway, 0.5, sway * 2, 0.55); ctx.quadraticCurveTo(0.05, 0.42, 0.08, 0.2); ctx.fill();
      ctx.fillStyle = '#8a4fd6'; ctx.beginPath(); ctx.ellipse(0, 0.04, 0.17, 0.24, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#c99bff'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-0.04, 0.2 - i * 0.1); ctx.lineTo(0, 0.14 - i * 0.1); ctx.lineTo(0.04, 0.2 - i * 0.1); ctx.fill(); }
      ctx.fillStyle = '#8a4fd6'; ctx.beginPath(); ctx.ellipse(0, -0.27, 0.12, 0.15, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#f5f2e8'; for (let i = -1; i <= 1; i += 2) { ctx.beginPath(); ctx.moveTo(i * 0.06, -0.38); ctx.lineTo(i * 0.04, -0.44); ctx.lineTo(i * 0.02, -0.38); ctx.fill(); }
      glowDot(ctx, -0.055, -0.3, 0.025, '#b6ff3d', PX * 0.2); glowDot(ctx, 0.055, -0.3, 0.025, '#b6ff3d', PX * 0.2);
      // связка динамита
      ['#d8342c', '#e8453a', '#d8342c'].forEach((c, i) => { ctx.fillStyle = c; rrect(ctx, -0.14 + i * 0.09, -0.02, 0.08, 0.2, 0.03); ctx.fill(); });
      ctx.fillStyle = '#f2e3c0'; ctx.fillRect(-0.15, 0.06, 0.29, 0.03);
      ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 0.015; ctx.beginPath(); ctx.moveTo(0, -0.02); ctx.quadraticCurveTo(0.06, -0.08, 0.04, -0.12); ctx.stroke();
      if (Math.floor(o.t * 10) % 2) glowDot(ctx, 0.04, -0.13, 0.025, '#ffd25e', PX * 0.3);
    },
    // Морозилка: белая камера с дверцей, ручкой и инеем
    ice(ctx, o) {
      ctx.rotate(o.aim * 0.15);
      ctx.fillStyle = '#e9f6fb'; rrect(ctx, -0.28, -0.3, 0.56, 0.6, 0.07); ctx.fill();
      ctx.fillStyle = '#c4e3ef'; rrect(ctx, -0.25, -0.27, 0.5, 0.2, 0.05); ctx.fill();
      ctx.strokeStyle = '#8fbccc'; ctx.lineWidth = 0.02; ctx.beginPath(); ctx.moveTo(-0.27, -0.04); ctx.lineTo(0.27, -0.04); ctx.stroke();
      ctx.fillStyle = '#7a8a94'; rrect(ctx, 0.14, 0.02, 0.05, 0.18, 0.02); ctx.fill();
      ctx.save(); ctx.translate(-0.05, 0.12); ctx.rotate(o.t * 0.8); ctx.strokeStyle = '#4fc6ef'; ctx.lineWidth = 0.025;
      for (let i = 0; i < 3; i++) { ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.moveTo(-0.08, 0); ctx.lineTo(0.08, 0); ctx.stroke(); }
      ctx.restore();
      ctx.fillStyle = 'rgba(223,249,255,0.9)'; for (let i = 0; i < 5; i++) { circle(ctx, -0.26 + i * 0.13, -0.3, 0.035); ctx.fill(); }
      for (let i = 0; i < 3; i++) { const a = o.t * 0.7 + i * 2.1, r = 0.34 + Math.sin(o.t * 2 + i) * 0.03; ctx.fillStyle = 'rgba(191,246,255,0.45)'; circle(ctx, Math.cos(a) * r, Math.sin(a) * r, 0.04); ctx.fill(); }
    },
    // Реалганер: рельсовая пушка — две рельсы и заряд между ними
    prism(ctx, o) {
      ctx.rotate(o.aim);
      const k = o.recoil * 0.1;
      ctx.fillStyle = '#3a3a44'; rrect(ctx, -0.18, -0.06 + k, 0.36, 0.34, 0.06); ctx.fill();
      ctx.fillStyle = '#c9a35a'; ctx.fillRect(-0.15, -0.55 + k, 0.06, 0.55); ctx.fillRect(0.09, -0.55 + k, 0.06, 0.55);
      ctx.fillStyle = '#ffe36b'; ctx.save(); ctx.shadowColor = '#ffe36b'; ctx.shadowBlur = PX * 0.3;
      const ch = 0.5 + 0.5 * Math.sin(o.t * 5);
      for (let i = 0; i < 4; i++) { ctx.globalAlpha = 0.4 + ch * 0.6 * ((i + 1) / 4); ctx.fillRect(-0.08, -0.5 + i * 0.12 + k, 0.16, 0.03); }
      ctx.restore();
      glowDot(ctx, 0, 0.12 + k, 0.06, '#fff6c8', PX * 0.3);
    },
    // Громовержец: зверёк в короне из молний
    storm(ctx, o) {
      ctx.rotate(o.aim);
      ctx.strokeStyle = Math.floor(o.t * 12) % 2 ? '#5ad8ff' : '#e6fbff'; ctx.lineWidth = 0.04;
      ctx.beginPath(); ctx.moveTo(0, 0.15); for (let i = 1; i <= 6; i++) ctx.lineTo((i % 2 ? 0.08 : -0.08) + Math.sin(o.t * 6 + i) * 0.03, 0.15 + i * 0.07); ctx.stroke();
      ctx.fillStyle = '#1b2c48'; ctx.beginPath(); ctx.ellipse(0, 0, 0.18, 0.23, 0, 0, TAU); ctx.fill();
      circle(ctx, 0, -0.24, 0.14); ctx.fill();
      // корона из молний
      ctx.fillStyle = '#ffd84a'; ctx.save(); ctx.shadowColor = '#ffd84a'; ctx.shadowBlur = PX * 0.25;
      for (let i = -2; i <= 2; i++) { const x = i * 0.055; ctx.beginPath(); ctx.moveTo(x - 0.025, -0.33); ctx.lineTo(x + 0.01, -0.46 - (i === 0 ? 0.05 : 0)); ctx.lineTo(x + 0.005, -0.4); ctx.lineTo(x + 0.03, -0.42); ctx.lineTo(x + 0.025, -0.33); ctx.fill(); }
      ctx.restore();
      glowDot(ctx, -0.055, -0.25, 0.028, '#8ff3ff', PX * 0.2); glowDot(ctx, 0.055, -0.25, 0.028, '#8ff3ff', PX * 0.2);
    },
    // Свинка: копилка с монетами и сердечком
    piggy(ctx, o) {
      for (let i = 0; i < 3; i++) { const a = o.t * 1.2 + i * TAU / 3; ctx.fillStyle = '#ffc53d'; circle(ctx, Math.cos(a) * 0.4, Math.sin(a) * 0.4, 0.055); ctx.fill(); ctx.fillStyle = '#b97a00'; circle(ctx, Math.cos(a) * 0.4, Math.sin(a) * 0.4, 0.02); ctx.fill(); }
      const b = 1 + Math.sin(o.t * 2) * 0.03;
      ctx.scale(b, b);
      ctx.fillStyle = '#ff9fb2'; ctx.beginPath(); ctx.ellipse(0, 0.03, 0.22, 0.27, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-0.17, -0.1); ctx.lineTo(-0.23, -0.25); ctx.lineTo(-0.08, -0.18); ctx.moveTo(0.17, -0.1); ctx.lineTo(0.23, -0.25); ctx.lineTo(0.08, -0.18); ctx.fill();
      ctx.fillStyle = '#ff7f98'; ctx.beginPath(); ctx.ellipse(0, -0.25, 0.09, 0.06, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#7a2a3a'; circle(ctx, -0.03, -0.25, 0.015); ctx.fill(); circle(ctx, 0.03, -0.25, 0.015); ctx.fill();
      ctx.fillStyle = '#4a2010'; ctx.fillRect(-0.08, 0.02, 0.16, 0.03);
      if (o.up && o.up[0] > 0) { ctx.fillStyle = '#ff4d6d'; ctx.beginPath(); ctx.moveTo(0, 0.2); ctx.bezierCurveTo(-0.09, 0.12, -0.05, 0.06, 0, 0.11); ctx.bezierCurveTo(0.05, 0.06, 0.09, 0.12, 0, 0.2); ctx.fill(); }
    },
    // Гараж: здание с подъёмной дверью и мигающей лампой
    garage(ctx, o) {
      const tank = o.up && o.up[1] >= 5;
      ctx.fillStyle = '#2b3a2a'; rrect(ctx, -0.3, -0.24, 0.6, 0.48, 0.04); ctx.fill();
      ctx.fillStyle = '#3d5a3a'; ctx.beginPath(); ctx.moveTo(-0.34, -0.22); ctx.lineTo(0, -0.38); ctx.lineTo(0.34, -0.22); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#16120e'; ctx.fillRect(-0.2, -0.08, 0.4, 0.3);
      const open = (Math.sin(o.t * 1.3) + 1) / 2 * 0.12;
      ctx.fillStyle = '#9aa4ad'; ctx.fillRect(-0.2, -0.08, 0.4, 0.3 - open);
      ctx.strokeStyle = '#5c666e'; ctx.lineWidth = 0.015;
      for (let y = -0.04; y < 0.22 - open; y += 0.05) { ctx.beginPath(); ctx.moveTo(-0.2, y); ctx.lineTo(0.2, y); ctx.stroke(); }
      ctx.fillStyle = '#ffd25e'; for (let i = 0; i < 4; i++) ctx.fillRect(-0.2 + i * 0.1, 0.22, 0.05, 0.025);
      glowDot(ctx, 0, -0.2, 0.035, Math.sin(o.t * 5) > 0 ? (tank ? '#ff5a3d' : '#7cff6b') : '#2a3a2a', PX * 0.2);
      if (o.up && o.up[0] >= 3) { ctx.fillStyle = '#ffd25e'; circle(ctx, 0.24, -0.16, 0.035); ctx.fill(); }
    }
  };

  // Машина гаража (вид сбоку, смотрит по ходу движения). c.tank — танк, c.gun — стрелок на крыше.
  function car(ctx, c, t, color) {
    const left = (c.dx || 0) < -0.05;
    const bob = Math.sin(t * 18 + c.id) * 0.012;
    ctx.save();
    ctx.scale(1.6, 1.6);
    shadow(ctx, 0.5, 0.25);
    if (left) ctx.scale(-1, 1);
    ctx.translate(0, bob);
    if (c.tank) {
      ctx.fillStyle = '#2a2d22'; rrect(ctx, -0.5, -0.2, 1.0, 0.2, 0.08); ctx.fill();
      ctx.fillStyle = '#3c4230'; for (let i = 0; i < 5; i++) { circle(ctx, -0.4 + i * 0.2, -0.1, 0.07); ctx.fill(); }
      ctx.fillStyle = '#4f5a3a'; rrect(ctx, -0.42, -0.42, 0.84, 0.24, 0.06); ctx.fill();
      ctx.fillStyle = color; ctx.fillRect(-0.42, -0.3, 0.84, 0.04);
      ctx.fillStyle = '#5c6a44'; rrect(ctx, -0.2, -0.6, 0.38, 0.2, 0.08); ctx.fill();
      ctx.fillStyle = '#2a2d22'; ctx.fillRect(0.15, -0.53, 0.45, 0.07);
    } else {
      ctx.fillStyle = '#16120e'; circle(ctx, -0.27, -0.06, 0.09); ctx.fill(); circle(ctx, 0.27, -0.06, 0.09); ctx.fill();
      ctx.fillStyle = '#9aa4ad'; circle(ctx, -0.27, -0.06, 0.035); ctx.fill(); circle(ctx, 0.27, -0.06, 0.035); ctx.fill();
      ctx.fillStyle = color; rrect(ctx, -0.42, -0.36, 0.84, 0.28, 0.07); ctx.fill();
      ctx.fillStyle = '#e8f6ff'; rrect(ctx, 0.08, -0.33, 0.26, 0.12, 0.03); ctx.fill();
      ctx.fillStyle = '#ffffff55'; ctx.fillRect(-0.36, -0.28, 0.38, 0.03);
      glowDot(ctx, 0.42, -0.18, 0.03, '#fff3c4', PX * 0.25);
      ctx.fillStyle = '#ff3b4d'; ctx.fillRect(-0.44, -0.24, 0.03, 0.06);
    }
    if (c.gun) {
      const y0 = c.tank ? -0.62 : -0.36;
      ctx.fillStyle = '#0e0d12'; ctx.fillRect(-0.12, y0 - 0.16, 0.1, 0.16);
      ctx.fillStyle = '#ffd25e'; circle(ctx, -0.07, y0 - 0.21, 0.06); ctx.fill();
      ctx.fillStyle = '#0e0d12'; ctx.fillRect(-0.04, y0 - 0.13, 0.22, 0.035);
    }
    ctx.restore();
  }

  function tower(ctx, heroId, o) {
    ctx.save();
    base(ctx, o.color || '#45e0c0', K.TOWER_R);
    // фигурки нарисованы под радиус 0.38 — масштабируем под размер башни
    const lvl = Math.max(o.up ? o.up[0] : 0, o.up ? o.up[1] : 0), sc = (K.TOWER_R / 0.38) * (1 + lvl * 0.03);
    ctx.scale(sc, sc);
    ctx.save(); HERO[heroId](ctx, o); ctx.restore();
    if (o.up) {
      for (let br = 0; br < 2; br++) for (let i = 0; i < o.up[br]; i++) {
        const a = Math.PI / 2 + (br === 0 ? 1 : -1) * (0.45 + i * 0.32);
        ctx.fillStyle = br === 0 ? '#ffd25e' : '#ff5a6e'; circle(ctx, Math.cos(a) * 0.42, Math.sin(a) * 0.42, 0.045); ctx.fill();
      }
    }
    if (o.vision) { ctx.strokeStyle = '#46ffe0'; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.ellipse(-0.28, -0.36, 0.09, 0.05, 0, 0, TAU); ctx.stroke(); glowDot(ctx, -0.28, -0.36, 0.025, '#46ffe0', PX * 0.15); }
    if (o.aa) { ctx.strokeStyle = '#ff5a3d'; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.arc(0.28, -0.32, 0.08, Math.PI, 0); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0.28, -0.32); ctx.lineTo(0.33, -0.4); ctx.stroke(); }
    ctx.restore();
  }

  // ---------------- Препятствия (вид сверху) ----------------
  const OBST = {
    wardrobe(ctx, r) { ctx.fillStyle = '#3a2214'; rrect(ctx, -r, -r * 0.7, r * 2, r * 1.4, 0.05); ctx.fill(); ctx.strokeStyle = '#1e1008'; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.moveTo(0, -r * 0.7); ctx.lineTo(0, r * 0.7); ctx.stroke(); ctx.fillStyle = '#c9a35a'; circle(ctx, -0.05, 0, 0.03); ctx.fill(); circle(ctx, 0.05, 0, 0.03); ctx.fill(); },
    pillar(ctx, r) { ctx.fillStyle = '#5a4a38'; circle(ctx, 0, 0, r); ctx.fill(); ctx.strokeStyle = '#7a6650'; ctx.lineWidth = 0.05; circle(ctx, 0, 0, r * 0.7); ctx.stroke(); },
    plant(ctx, r) { ctx.fillStyle = '#4a3020'; circle(ctx, 0, 0, r * 0.6); ctx.fill(); ctx.fillStyle = '#244a2c'; for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; ctx.beginPath(); ctx.ellipse(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * 0.45, r * 0.18, a, 0, TAU); ctx.fill(); } ctx.fillStyle = '#2f6a3a'; circle(ctx, 0, 0, r * 0.25); ctx.fill(); },
    table(ctx, r) { ctx.fillStyle = '#6a1a22'; circle(ctx, 0, 0, r); ctx.fill(); ctx.strokeStyle = '#c9a35a'; ctx.lineWidth = 0.025; circle(ctx, 0, 0, r * 0.85); ctx.stroke(); glowDot(ctx, 0, 0, 0.05, '#ffd28a', PX * 0.4); },
    luggage(ctx, r) { ctx.fillStyle = '#5c3a22'; rrect(ctx, -r, -r * 0.6, r * 1.3, r * 1.2, 0.05); ctx.fill(); ctx.fillStyle = '#2b4a5a'; rrect(ctx, -r * 0.1, -r * 0.9, r * 1.1, r * 1.0, 0.05); ctx.fill(); ctx.fillStyle = '#c9a35a'; ctx.fillRect(-r * 0.6, -0.02, r * 0.5, 0.04); },
    mirror(ctx, r) { const g = ctx.createLinearGradient(-r, -r, r, r); g.addColorStop(0, '#d8d0ff'); g.addColorStop(0.5, '#6a5ea8'); g.addColorStop(1, '#e6e0ff'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.95, r * 0.6, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#c9a35a'; ctx.lineWidth = 0.06; ctx.stroke(); },
    rock(ctx, r) { ctx.fillStyle = '#4a3e34'; ctx.beginPath(); for (let i = 0; i < 7; i++) { const a = i / 7 * TAU, rr = r * (0.8 + ((i * 53) % 7) / 30); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); ctx.fillStyle = '#5e5044'; circle(ctx, -r * 0.2, -r * 0.2, r * 0.35); ctx.fill(); },
    beam(ctx, r) { ctx.fillStyle = '#6a4424'; ctx.fillRect(-r, -r, r * 2, r * 2); ctx.strokeStyle = '#3a2210'; ctx.lineWidth = 0.04; ctx.beginPath(); ctx.moveTo(-r, -r); ctx.lineTo(r, r); ctx.moveTo(r, -r); ctx.lineTo(-r, r); ctx.stroke(); },
    cart(ctx, r) { ctx.fillStyle = '#5b5f66'; rrect(ctx, -r * 0.75, -r, r * 1.5, r * 2, 0.06); ctx.fill(); ctx.fillStyle = '#2a2420'; ctx.fillRect(-r * 0.6, -r * 0.85, r * 1.2, r * 1.7); ctx.fillStyle = '#ffb84a'; for (let i = 0; i < 4; i++) { circle(ctx, ((i % 2) - 0.5) * r * 0.6, (i - 1.5) * r * 0.35, r * 0.18); ctx.fill(); } },
    barrel(ctx, r) { ctx.fillStyle = '#6a4424'; circle(ctx, 0, 0, r); ctx.fill(); ctx.strokeStyle = '#2a2a2e'; ctx.lineWidth = 0.04; circle(ctx, 0, 0, r * 0.75); ctx.stroke(); circle(ctx, 0, 0, r * 0.4); ctx.stroke(); },
    crystal(ctx, r, o) { const cols = ['#38f2e0', '#e05cff']; for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + (o ? o.rot * 6 : 0); ctx.save(); ctx.rotate(a); ctx.fillStyle = cols[i % 2]; ctx.shadowColor = cols[i % 2]; ctx.shadowBlur = PX * 0.3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 0.3, -r * 0.4); ctx.lineTo(0, -r); ctx.lineTo(-r * 0.3, -r * 0.4); ctx.closePath(); ctx.fill(); ctx.restore(); } },
    stalagmite(ctx, r) { for (let i = 3; i >= 1; i--) { ctx.fillStyle = ['#120c0a', '#2a1c16', '#3a2a20', '#4a382a'][i]; circle(ctx, 0, 0, r * i / 3); ctx.fill(); } },
    lava(ctx, r, o, t) { ctx.save(); ctx.shadowColor = '#ff4d1f'; ctx.shadowBlur = PX * 0.5; ctx.fillStyle = '#7a1804'; circle(ctx, 0, 0, r); ctx.fill(); ctx.fillStyle = `rgba(255,${100 + Math.floor(40 * Math.sin((t || 0) * 2))},30,0.9)`; circle(ctx, 0, 0, r * 0.7); ctx.fill(); ctx.restore(); }
  };
  function obstacle(ctx, o, t) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; circle(ctx, 0.07, 0.09, o.r); ctx.fill();
    ctx.rotate((o.rot || 0) * TAU * (o.kind === 'wardrobe' || o.kind === 'luggage' || o.kind === 'cart' ? 0.25 : 1));
    OBST[o.kind](ctx, o.r, o, t);
    ctx.restore();
  }

  // ---------------- Растровые превью ----------------
  function toCanvas(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d'); draw(ctx, w, h); return c;
  }
  function heroIcon(id, size) {
    const old = PX; PX = size;
    const c = toCanvas(size, size, (ctx, w) => {
      ctx.fillStyle = '#0f0d0a'; ctx.fillRect(0, 0, w, w);
      ctx.translate(w / 2, w / 2); ctx.scale(w * 0.68 / K.TOWER_R, w * 0.68 / K.TOWER_R);
      tower(ctx, id, { aim: 0, t: 1, recoil: 0, color: K.HERO[id].color, up: [0, 0] });
    });
    PX = old;
    return c.toDataURL();
  }
  function figure(kind, w, h, t) {
    const old = PX; PX = h / 2;
    const c = toCanvas(w, h, ctx => {
      ctx.translate(w / 2, h * 0.94);
      const s = kind === 'kovtop' ? h / 2.4 : h / 1.55;
      ctx.scale(s, s);
      if (kind === 'kovtop') kovtop(ctx, t || 0.6, false, 1); else pet(ctx, t || 0.6, 0, 1);
    });
    PX = old;
    return c;
  }

  K.Sprites = {
    setPx(v) { PX = v; }, pet, kovtop, car, enemy, tower, obstacle, heroIcon, figure, rrect, circle, rainbow, glowDot, monitor, HERO_DRAW: HERO
  };
})(globalThis.KV = globalThis.KV || {});
