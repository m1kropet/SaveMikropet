/* Интерфейс: экраны меню, режимов, магазина, лидерборда, друзей, настроек; модальные окна и уведомления. */
(function (K) {
  'use strict';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtHours = s => { s = Math.floor(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? h + ' ч ' + m + ' мин' : m + ' мин'; };
  const fmtTime = s => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const hash = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };

  const ICONS = {
    scope: '<circle cx="12" cy="12" r="7"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
    fan: '<path d="M12 20L4 6M12 20V4M12 20l8-14"/>',
    burst: '<path d="M4 12h6M14 12h6M12 4v6M12 14v6M6 6l3 3M15 15l3 3M6 18l3-3M15 9l3-3"/>',
    star: '<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>',
    dot: '<circle cx="12" cy="12" r="5" fill="currentColor"/>',
    pierce: '<path d="M3 21L21 3M14 3h7v7"/><path d="M8 11l5 5"/>',
    flame: '<path d="M12 21c-4 0-6-3-6-6 0-4 4-6 4-10 3 2 4 4 4 6 1-1 2-2 2-4 2 2 2 5 2 8 0 3-2 6-6 6z"/>',
    core: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3" fill="currentColor"/>',
    nova: '<circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M12 1v5M12 18v5M1 12h5M18 12h5M4 4l3.5 3.5M16.5 16.5L20 20M4 20l3.5-3.5M16.5 7.5L20 4"/>',
    twin: '<circle cx="8" cy="12" r="3"/><circle cx="16" cy="12" r="3"/>',
    snow: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7"/><path d="M9 4l3 2 3-2M9 20l3-2 3 2"/>',
    chain: '<path d="M10 14l4-4"/><rect x="2" y="12" width="9" height="6" rx="3" transform="rotate(-45 6.5 15)"/><rect x="13" y="6" width="9" height="6" rx="3" transform="rotate(-45 17.5 9)"/>',
    bolt: '<path d="M13 2L5 14h6l-1 8 8-12h-6z"/>',
    coin: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10h4a1.5 1.5 0 010 3h-3a1.5 1.5 0 000 3h4"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    radar: '<path d="M4 18a10 10 0 0116 0"/><path d="M12 18l5-9"/><circle cx="12" cy="18" r="1.5" fill="currentColor"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    pause: '<path d="M9 5v14M15 5v14"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    play: '<path d="M7 4l13 8-13 8z" fill="currentColor"/>',
    shop: '<path d="M4 8h16l-1 12H5z"/><path d="M9 8a3 3 0 016 0"/>',
    trophy: '<path d="M7 4h10v5a5 5 0 01-10 0z"/><path d="M7 6H4a3 3 0 003 4M17 6h3a3 3 0 01-3 4M12 14v4M8 21h8"/>',
    people: '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0112 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.5A5 5 0 0121 19"/>',
    cog: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
    full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    check: '<path d="M5 12l5 5 9-10"/>',
    heal: '<rect x="4" y="9" width="16" height="6" rx="3"/><path d="M12 9v6M9 12h6"/>',
    heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z"/>',
    shield: '<path d="M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6z"/>',
    twitch: '<path d="M5 3h15v11l-5 5h-4l-3 3v-3H4V6z"/><path d="M11 8v4M16 8v4"/>'
  };
  const eyeBadge = on => on ? '<span class="eye-badge" title="Глаз Ковтопа" aria-label="Глаз Ковтопа"><svg viewBox="0 0 24 12" width="1.45em" height="0.75em" aria-hidden="true"><path d="M1 6C4 1.5 8 0.5 12 0.5S20 1.5 23 6C20 10.5 16 11.5 12 11.5S4 10.5 1 6Z" fill="#120406" stroke="#ff2a3d" stroke-width="1.3"/><circle cx="12" cy="6" r="3.6" fill="#ff2a3d"/><circle cx="12" cy="6" r="1.5" fill="#120406"/><circle cx="13.2" cy="4.9" r="0.7" fill="#fff"/></svg></span>' : '';
  const icon = n => `<svg viewBox="0 0 24 24" width="1.2em" height="1.2em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ICONS.dot}</svg>`;

  // ---------- Модальные окна и уведомления ----------
  let modalEl = null, modalOpts = null;
  function modal(html, handlers, opts) {
    closeModal(true);
    modalOpts = opts || {};
    const frame = document.getElementById('frame');
    modalEl = document.createElement('div');
    modalEl.className = 'modal' + (modalOpts.center ? ' center' : '');
    modalEl.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
    modalEl.addEventListener('click', e => {
      if (e.target === modalEl && !modalOpts.locked) { closeModal(); return; }
      const b = e.target.closest('[data-m]');
      if (!b || b.disabled) return;
      K.Audio.play('click', 30);
      const h = handlers && handlers[b.dataset.m];
      if (h) h(b, modalEl);
    });
    frame.appendChild(modalEl);
    const first = modalEl.querySelector('button, input');
    if (first) first.focus({ preventScroll: true });
    return modalEl;
  }
  function closeModal(silent) {
    if (!modalEl) return;
    modalEl.remove();
    modalEl = null;
    const o = modalOpts; modalOpts = null;
    if (!silent && o && o.onClose) o.onClose();
  }
  function confirmBox(text, okLabel, onOk, danger) {
    modal(`<div class="h2">${esc(text)}</div><div class="row"><button class="btn ${danger ? 'danger' : 'brass'} grow" data-m="ok">${esc(okLabel)}</button><button class="btn grow" data-m="no">Отмена</button></div>`,
      { ok: () => { closeModal(true); onOk(); }, no: () => closeModal() }, { center: true });
  }
  function toast(msg, kind) {
    const frame = document.getElementById('frame');
    let box = frame.querySelector('.toasts');
    if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('aria-live', 'polite'); frame.appendChild(box); }
    const t = document.createElement('div');
    t.className = 'toast ' + (kind || '');
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => t.remove(), 3200);
    while (box.children.length > 3) box.firstChild.remove();
  }

  K.UI = { icon, eyeBadge, modal, closeModal, confirm: confirmBox, toast, esc };

  // ---------- Общие фрагменты ----------
  const topbar = (title, right) => `<div class="topbar"><button class="btn small icon-btn" data-act="back" aria-label="Назад">${icon('back')}</button><div class="h2">${esc(title)}</div>${right || ''}</div>`;
  const coinsChip = p => `<span class="num coin">${p.coins}</span>`;

  function mapPicker(sel, compact, act) {
    return K.MAPS.map(m => `<button class="pick ${sel === m.id ? 'on' : ''}" data-act="${act || 'map'}" data-id="${m.id}" aria-pressed="${sel === m.id}">
      <img class="mapthumb" alt="" src="${K.Render2D ? K.Render2D.mapThumb(m, 96, 160) : ''}">
      <span class="grow" style="min-width:0"><span class="eyebrow">${m.cat} · <span class="stars">${'●'.repeat(m.stars)}${'○'.repeat(5 - m.stars)}</span></span><br><b>${m.name}</b>${compact ? '' : `<br><span class="note">${m.blurb}</span>`}</span></button>`).join('');
  }
  function diffPicker(p, sel, act) {
    const opts = ['easy', 'normal', 'hard'].map(k => {
      const D = K.DIFFS[k];
      return `<button class="btn pick diff ${sel === k ? 'on' : ''}" data-act="${act || 'diff'}" data-id="${k}"><b>${D.name}</b><span class="num">${D.waves} волн · ♥${D.petHp}</span></button>`;
    });
    opts.push(p.endlessUnlocked
      ? `<button class="btn pick diff ${sel === 'endless' ? 'on' : ''}" data-act="${act || 'diff'}" data-id="endless"><b>Бесконечный</b><span class="num">рекорд ${p.endless.best}</span></button>`
      : `<button class="btn pick diff" data-act="diffLocked"><b>???</b><span class="num">${icon('lock')} закрыто</span></button>`);
    return `<div class="diff-grid">${opts.join('')}</div>`;
  }
  function squadPicker(p) {
    return `<div class="chips">${p.owned.map(h => `<button class="chip ${p.squad.includes(h) ? 'on' : ''}" data-act="squad" data-id="${h}" aria-pressed="${p.squad.includes(h)}"><span class="hero-thumb" style="width:1.5em;height:1.5em;background-image:url(${K.thumbs[h] || ''})"></span>${K.HERO[h].name}</button>`).join('')}</div>
      <div class="row"><span class="note grow">В отряде ${p.squad.length} из ${K.SQUAD_MAX}. Остальных героев можно купить в магазине.</span><button class="btn small" data-act="toShop">Магазин</button></div>`;
  }
  function toggleSquad(app, id) {
    const p = app.profile;
    if (!p.owned.includes(id)) return;
    if (p.squad.includes(id)) {
      if (p.squad.length <= 1) { toast('В отряде должен остаться хотя бы один герой', 'bad'); return false; }
      p.squad = p.squad.filter(x => x !== id);
    } else {
      if (p.squad.length >= K.SQUAD_MAX) { toast('В отряде максимум 4 героя. Сначала уберите кого-нибудь.', 'bad'); return false; }
      p.squad.push(id);
    }
    app.persist();
    return true;
  }
  function profileCard(o, demo) {
    return `<div class="row"><div class="lvl" style="--p:50"><span>${o.level}</span></div><div class="grow"><div class="h2">${esc(o.nick)}</div>${demo ? '<span class="tag demo">Демо-профиль</span>' : '<span class="tag">Профиль игрока</span>'}</div></div>
      <div class="kv"><span>Уровень</span><b>${o.level}</b><span>Рекорд бесконечного</span><b>${o.endless} волн</b><span>Побед в дуэлях</span><b>${o.duelWins}</b><span>Время в игре</span><b>${fmtHours(o.time)}</b></div>`;
  }

  // ---------- Иллюстрации (рисуются кодом) ----------
  const artCache = {};
  function modeArt(kind) {
    if (artCache[kind]) return artCache[kind];
    const w = 240, h = 150, HZ = 0.62, c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d'), SP = K.Sprites, mine = kind.endsWith(':mine');
    kind = kind.split(':')[0];
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1a1210'); g.addColorStop(1, '#070505');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) { ctx.fillStyle = mine ? (x % 32 ? '#2a1e14' : '#231910') : (x % 32 ? '#15201a' : '#121a15'); ctx.fillRect(x, 0, 16, h * HZ); }
    ctx.fillStyle = mine ? '#1a120b' : '#2e1c10'; ctx.fillRect(0, h * HZ, w, h * 0.38);
    const light = (x, y, r, col) => { const lg = ctx.createRadialGradient(x, y, 0, x, y, r); lg.addColorStop(0, col); lg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = lg; ctx.fillRect(0, 0, w, h); };
    const fig = (fn, x, y, s) => { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); SP.setPx(s); fn(); ctx.restore(); };
    if (kind === 'single') {
      light(120, 110, 90, 'rgba(95,255,216,0.25)');
      ctx.fillStyle = '#5a0e17'; ctx.fillRect(100, 92, 40, 58); ctx.fillStyle = '#c9a35a'; ctx.fillRect(100, 92, 3, 58); ctx.fillRect(137, 92, 3, 58);
      ctx.fillStyle = '#24140c'; ctx.fillRect(98, 20, 44, 72); ctx.fillStyle = '#220004'; ctx.fillRect(104, 26, 32, 66);
      light(120, 80, 40, 'rgba(255,42,61,0.35)');
      SP.glowDot(ctx, 112, 55, 2, '#ffffff', 6); SP.glowDot(ctx, 126, 55, 2, '#ffffff', 6);
      fig(() => SP.pet(ctx, 0.7, 0, 1), 120, 140, 42);
    } else if (kind === 'team') {
      light(120, 110, 110, 'rgba(201,163,90,0.18)');
      K.PLAYER_COLORS.forEach((col, i) => { ctx.save(); ctx.translate(40 + i * 54, 70 + (i % 2) * 18); ctx.scale(30, 30); SP.setPx(30); SP.tower(ctx, ['blaster', 'ice', 'dragon', 'storm'][i], { aim: 0.4 * (i - 1.5), t: i, recoil: 0, color: col, up: [i % 3, 0] }); ctx.restore(); });
      fig(() => SP.pet(ctx, 0.3, 0, 1), 120, 146, 34);
    } else {
      ctx.save(); ctx.beginPath(); ctx.moveTo(w * 0.55, 0); ctx.lineTo(w, 0); ctx.lineTo(w, h); ctx.lineTo(w * 0.45, h); ctx.closePath(); ctx.fillStyle = 'rgba(80,0,10,0.55)'; ctx.fill(); ctx.restore();
      light(60, 110, 80, 'rgba(95,255,216,0.22)'); light(180, 80, 90, 'rgba(255,42,61,0.22)');
      fig(() => SP.pet(ctx, 1.1, 0, 1), 62, 142, 40);
      fig(() => SP.kovtop(ctx, 0.8, false, 1), 182, 146, 34);
      ctx.fillStyle = '#c9a35a'; ctx.font = 'bold 20px Unbounded, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('VS', 120, 40);
    }
    const key = kind + (mine ? ':mine' : '');
    artCache[key] = c.toDataURL('image/jpeg', 0.85);
    return artCache[key];
  }

  // Лампа в меню мигает азбукой Морзе: ровный свет, пауза, затем слово кода.
  const MORSE = { A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..' };
  const MORSE_UNIT = 0.32;
  const morseTimeline = (() => {
    // 6 с ровного света, темнота, красная вспышка (сигнал «начало»), снова темнота — и слово кода
    const seg = [[6, 1], [1.2, 0], [0.7, 2], [1.6, 0]];
    K.SECRET_CODE.split('').forEach((ch, li) => {
      if (li) seg.push([MORSE_UNIT * 3, 0]);
      MORSE[ch].split('').forEach((sym, si) => {
        if (si) seg.push([MORSE_UNIT, 0]);
        seg.push([MORSE_UNIT * (sym === '.' ? 1 : 3), 1]);
      });
    });
    seg.push([2.2, 0]);
    const total = seg.reduce((a, x) => a + x[0], 0);
    return { seg, total };
  })();
  function lampLevel(t) {
    let x = t % morseTimeline.total;
    for (const [d, on] of morseTimeline.seg) { if (x < d) return on ? 1 : 0.04; x -= d; }
    return 1;
  }
  // true, пока горит красный сигнал перед началом кода
  function lampRed(t) {
    let x = t % morseTimeline.total;
    for (const [d, on] of morseTimeline.seg) { if (x < d) return on === 2; x -= d; }
    return false;
  }

  K.Morse = { lampLevel, lampRed, timeline: morseTimeline, unit: MORSE_UNIT };

  // Анимированная сцена главного меню: коридор (или шахта), дверь, Ковтоп в проёме, микропет.
  // Секрет Ковтопа: по нажатию на его экран показываются пять случайных двузначных чисел.
  let kovShow = null, kovTv = null;
  const KOV_SLOT = 1.4, KOV_ON = 1.05, KOV_LEAD = 0.6;
  function kovDigits(t) {
    if (!kovShow) return undefined;
    const x = t - kovShow.t0 - KOV_LEAD;
    if (x < 0) return '--';
    const i = Math.floor(x / KOV_SLOT);
    if (i >= kovShow.nums.length) { kovShow = null; return undefined; }
    return x - i * KOV_SLOT < KOV_ON ? kovShow.nums[i] : '--';
  }
  function randomPairs() {
    const out = [], buf = new Uint32Array(5);
    if (globalThis.crypto && crypto.getRandomValues) crypto.getRandomValues(buf); else for (let i = 0; i < 5; i++) buf[i] = Math.floor(Math.random() * 2 ** 32);
    for (let i = 0; i < 5; i++) out.push(String(10 + (buf[i] % 90)));
    return out;
  }

  // Сцена главного меню (общая для меню и превью скинов).
  function paintMenu(ctx, w, h, t, mine, live) {
    const SP = K.Sprites, u = w / 10, HZ = 0.42;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (mine) {
      // каменная стена, крепь и рельсы
      ctx.fillStyle = '#231910'; ctx.fillRect(0, 0, w, h * HZ);
      const rr = K.rng(7);
      for (let i = 0; i < 90; i++) { ctx.fillStyle = ['#2f2216', '#1a120b', '#3a2a1b'][i % 3]; ctx.beginPath(); ctx.ellipse(rr() * w, rr() * h * HZ, u * (0.2 + rr() * 0.6), u * (0.15 + rr() * 0.4), rr() * 3, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#1a120b'; ctx.fillRect(0, h * HZ, w, h * (1 - HZ));
      ctx.fillStyle = '#4a2e1a'; for (let k = 0; k < 9; k++) { const y = h * HZ + (h * (1 - HZ)) * (k / 9) ** 1.6; const hw = (u * 0.8) + (w * 0.42) * (k / 9) ** 1.6; ctx.fillRect(w / 2 - hw, y, hw * 2, u * 0.08 + k * 0.6); }
      ctx.strokeStyle = '#9aa0aa'; ctx.lineWidth = Math.max(1, u * 0.05);
      [-1, 1].forEach(sd => { ctx.beginPath(); ctx.moveTo(w / 2 + sd * u * 0.5, h * HZ); ctx.lineTo(w / 2 + sd * w * 0.32, h); ctx.stroke(); });
    } else {
      for (let x = 0; x < w; x += u * 0.8) { ctx.fillStyle = Math.round(x / (u * 0.8)) % 2 ? '#15201a' : '#121a15'; ctx.fillRect(x, 0, u * 0.8, h * HZ); }
      ctx.fillStyle = '#c9a35a22'; for (let x = 0; x < w; x += u * 0.8) ctx.fillRect(x, 0, 1, h * HZ);
      for (let i = 0, x = 0; x < w; x += u * 0.9, i++) { ctx.fillStyle = ['#3a2316', '#33200f', '#41291a', '#2e1c10'][i % 4]; ctx.beginPath(); ctx.moveTo(w / 2 + (x - w / 2) * 0.35, h * HZ); ctx.lineTo(w / 2 + (x + u * 0.9 - w / 2) * 0.35, h * HZ); ctx.lineTo(x + u * 0.9 + (x - w / 2) * 0.6, h); ctx.lineTo(x + (x - w / 2) * 0.6, h); ctx.fill(); }
    }
    // дверь
    const dx = w / 2, dw = u * 2.8, dh = u * 4.3, dy = h * HZ - dh;
    ctx.fillStyle = '#120a05'; ctx.fillRect(dx - dw / 2 - u * 0.2, dy - u * 0.2, dw + u * 0.4, dh + u * 0.2);
    ctx.fillStyle = '#140003'; ctx.fillRect(dx - dw / 2, dy, dw, dh);
    const rg = ctx.createRadialGradient(dx, dy + dh * 0.6, 0, dx, dy + dh * 0.6, dh); rg.addColorStop(0, 'rgba(255,42,61,0.35)'); rg.addColorStop(1, 'rgba(255,42,61,0)'); ctx.fillStyle = rg; ctx.fillRect(dx - dw / 2, dy, dw, dh);
    // в отеле правую часть проёма закрывает приоткрытая створка: за ней (и в щели у петель) Ковтопа не видно
    ctx.save(); ctx.beginPath(); ctx.rect(dx - dw / 2, dy, mine ? dw : dw * 0.69, dh); ctx.clip();
    const ks = u * 1.75, kx = dx, ky = dy + dh * 1.02;
    if (live) kovTv = { x0: kx - 0.42 * ks, x1: kx + 0.42 * ks, y0: ky - 1.7 * ks, y1: ky - 1.0 * ks };
    ctx.translate(kx, ky); ctx.scale(ks, ks); SP.setPx(ks * 0.6); SP.kovtop(ctx, t, false, 1, live ? kovDigits(t) : undefined); ctx.restore();
    if (mine) {
      // вход в штольню: деревянная крепь вместо двери
      ctx.fillStyle = '#5a3a20'; ctx.fillRect(dx - dw / 2 - u * 0.35, dy - u * 0.3, u * 0.35, dh + u * 0.3); ctx.fillRect(dx + dw / 2, dy - u * 0.3, u * 0.35, dh + u * 0.3); ctx.fillRect(dx - dw / 2 - u * 0.5, dy - u * 0.5, dw + u, u * 0.35);
      ctx.fillStyle = '#ffb15c'; ctx.fillRect(dx - u * 0.6, dy - u * 1.05, u * 1.2, u * 0.4);
      ctx.fillStyle = '#2a1a0c'; ctx.font = `bold ${Math.round(u * 0.28)}px "JetBrains Mono", monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('ШТ-0', dx, dy - u * 0.85);
    } else {
      ctx.fillStyle = '#2c1a10'; ctx.save(); ctx.translate(dx + dw / 2, dy); ctx.transform(1, 0.12, 0, 1, 0, 0); ctx.fillRect(u * 0.06, 0, -dw * 0.32 - u * 0.06, dh); ctx.restore();
      ctx.fillStyle = '#c9a35a'; ctx.fillRect(dx - u * 0.6, dy - u * 0.9, u * 1.2, u * 0.45);
      ctx.fillStyle = '#1c1309'; ctx.font = `bold ${Math.round(u * 0.32)}px "JetBrains Mono", monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('0000', dx, dy - u * 0.67);
    }
    // лампа: мигает азбукой Морзе (секрет)
    const fl = lampLevel(t), red = lampRed(t);
    const lc = red ? '255,40,40' : mine ? '255,150,60' : '255,176,90';
    ctx.strokeStyle = '#1a140e'; ctx.lineWidth = Math.max(1, u * 0.05); ctx.beginPath(); ctx.moveTo(dx, 0); ctx.lineTo(dx, u * 0.45); ctx.stroke();
    if (mine) { ctx.fillStyle = '#3a2a1a'; ctx.fillRect(dx - u * 0.16, u * 0.42, u * 0.32, u * 0.36); }
    const lg = ctx.createRadialGradient(dx, u * 0.6, 0, dx, u * 0.6, u * 5); lg.addColorStop(0, `rgba(${lc},${0.35 * fl})`); lg.addColorStop(1, `rgba(${lc},0)`); ctx.fillStyle = lg; ctx.fillRect(0, 0, w, h);
    SP.glowDot(ctx, dx, u * 0.6, u * 0.18, red ? 'rgba(255,70,60,1)' : `rgba(255,210,138,${Math.max(0.12, fl)})`, u * fl);
    // микропет на переднем плане
    ctx.save(); ctx.translate(u * 2.3, h * HZ + u * 0.55); const ps = u * 1.0; ctx.scale(ps, ps); SP.setPx(ps * 0.6); SP.pet(ctx, t, 0, 1); ctx.restore();
    const vg = ctx.createLinearGradient(0, 0, 0, h); vg.addColorStop(0, 'rgba(11,10,9,0.55)'); vg.addColorStop(0.4, 'rgba(11,10,9,0.1)'); vg.addColorStop(0.75, 'rgba(11,10,9,0.7)'); vg.addColorStop(1, 'rgba(11,10,9,0.95)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
  }

  const MenuArt = {
    mount(cv, effects, theme) {
      const mine = theme === 'mine';
      const ctx = cv.getContext('2d');
      const draw = t => {
        const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
        if (cv.width !== Math.round(r.width * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
        this.lastT = t;
        paintMenu(ctx, cv.width, cv.height, t, mine, true);
      };
      const start = performance.now();
      // лампа нужна для секрета, поэтому сцена анимируется всегда
      const loop = now => { this.raf = requestAnimationFrame(loop); draw((now - start) / 1000); };
      this.raf = requestAnimationFrame(loop);
    },
    unmount() { cancelAnimationFrame(this.raf); },
    // нажатие по экрану (canvas-координаты в CSS-пикселях); true — попали в телевизор Ковтопа
    hitTv(cv, clientX, clientY) {
      if (!kovTv) return false;
      const r = cv.getBoundingClientRect(), sx = cv.width / r.width, sy = cv.height / r.height;
      const x = (clientX - r.left) * sx, y = (clientY - r.top) * sy;
      return x >= kovTv.x0 && x <= kovTv.x1 && y >= kovTv.y0 && y <= kovTv.y1;
    },
    kovStart() {
      // каждое нажатие — новая последовательность; старая сразу перестаёт подходить
      const nums = randomPairs();
      kovShow = { t0: this.lastT || 0, nums };
      return nums.join('');
    },
    preview(theme, w, h) {
      const key = theme + w + 'x' + h;
      this.cache = this.cache || {};
      if (this.cache[key]) return this.cache[key];
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      paintMenu(c.getContext('2d'), w, h, 2, theme === 'mine');
      return (this.cache[key] = c.toDataURL('image/jpeg', 0.85));
    }
  };

  const G_LOGO = '<svg class="g-logo" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.8c4.3-4 6.9-9.9 6.9-17.2z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.8c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.8 6C6.6 42.6 14.6 48 24 48z"/></svg>';
  const googleBadge = on => on ? '<span class="tw-badge gg" title="Подтверждено через Google">' + G_LOGO + '</span>' : '';
  function googleBlock(p) {
    if (p.google) {
      return `<div class="card row">${p.google.avatar ? `<img class="tw-ava" alt="" referrerpolicy="no-referrer" src="${esc(p.google.avatar)}">` : `<span class="tw-ava gg">${G_LOGO}</span>`}
        <div class="grow"><b>${esc(p.google.name || 'Google')}</b> ${googleBadge(true)}<div class="note">${esc(p.google.email)} · подтверждено ${new Date(p.google.verifiedAt).toLocaleDateString('ru-RU')}</div></div>
        <button class="btn small" data-act="ggLogout">Отвязать</button></div>`;
    }
    const st = K.Google.status();
    return `<button class="btn gg block" data-act="ggLogin">${G_LOGO} Войти через Google</button>
      <div class="note">${st.ok ? 'Google подтвердит ваш аккаунт по почте. Никнейм в игре останется вашим — почту видите только вы.' : esc(st.reason)}</div>`;
  }

  function twitchBlock(p) {
    if (p.twitch) {
      return `<div class="card row">${p.twitch.avatar ? `<img class="tw-ava" alt="" src="${esc(p.twitch.avatar)}">` : `<span class="tw-ava">${icon('twitch')}</span>`}
        <div class="grow"><b>${esc(p.twitch.display)}</b> <span class="tw-badge">${icon('check')}</span><div class="note">twitch.tv/${esc(p.twitch.login)} · подтверждено ${new Date(p.twitch.verifiedAt).toLocaleDateString('ru-RU')}</div></div>
        <button class="btn small" data-act="twLogout">Отвязать</button></div>`;
    }
    const st = K.Twitch.status();
    return `<button class="btn tw block" data-act="twLogin">${icon('twitch')} Войти через Twitch</button>
      <div class="note">${st.ok ? 'Twitch подтвердит ваш аккаунт: никнейм станет вашим ником на канале, а сервер сможет засчитывать рейтинг.' : esc(st.reason)}</div>`;
  }

  // ---------- Экраны ----------
  const S = {};

  S.menu = {
    html(app) {
      const p = app.profile;
      const need = K.Profile.xpNeed(p.level);
      const inc = p.friends.incoming.length;
      const mt = p.settings.theme === 'mine' ? ':mine' : '';
      return `<div class="screen">
        <div class="menu-bg"><canvas id="menuArt" aria-hidden="true"></canvas></div>
        <div class="menu-top">
          <button class="profile-chip" data-act="settings" aria-label="Профиль и настройки"><span class="lvl" style="--p:${Math.round(100 * p.xp / need)}"><span>${p.level}</span></span><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:9em;text-align:left;line-height:1.1"><b>${esc(p.nick)}</b><br><span class="ptag">#${esc(p.tag)}</span></span>${eyeBadge(p.eye)}${p.twitch ? '<span class="tw-badge" title="Подтверждено через Twitch">' + icon('check') + '</span>' : ''}${googleBadge(!!p.google)}</button>
          <span class="plaque coin" title="Монеты аккаунта">${p.coins}</span>
        </div>
        <div class="menu-main">
          <div class="title-row"><button class="title-btn" data-act="title" aria-label="Название игры"><div class="eyebrow" style="margin-bottom:.5em">Отель · Шахты · Номер 0000</div><div class="h1">Защити <b>микропета</b> от&nbsp;<em>ковтопа</em></div></button>
            <button class="btn small ghost collapse" data-act="collapse" id="collapseBtn" aria-label="Свернуть выбор режима" ${app.session.playOpen ? '' : 'hidden'}>${icon('x')} Свернуть</button></div>
          <button class="btn brass block" data-act="play" id="playBtn" style="font-size:1.15em;min-height:3.3em" ${app.session.playOpen ? 'hidden' : ''}>${icon('play')} Играть</button>
          <div class="play-modes ${app.session.playOpen ? 'open' : ''}" id="modes"><div>
            <button class="btn mode-btn" data-act="single"><img class="mode-art" alt="" src="${modeArt('single' + mt)}">Одиночка<small>3 сложности</small></button>
            <button class="btn mode-btn" data-act="team"><img class="mode-art" alt="" src="${modeArt('team' + mt)}">Команда<small>2–4 игрока</small></button>
            <button class="btn mode-btn" data-act="duel"><img class="mode-art" alt="" src="${modeArt('duel' + mt)}">Дуэль<small>карта соперника</small></button>
          </div></div>
          <div class="menu-grid">
            <button class="btn" data-act="shop">${icon('shop')} Магазин</button>
            <button class="btn" data-act="leaders">${icon('trophy')} Лидерборд</button>
            <button class="btn" data-act="friends">${icon('people')} Друзья ${inc ? `<span class="badge">${inc}</span>` : ''}</button>
            <button class="btn" data-act="settings">${icon('cog')} Настройки</button>
          </div>
        </div>
        <div class="foot">Локальная версия · прогресс хранится в этом браузере</div>
      </div>`;
    },
    mount(el, app) {
      this.clicks = 0; this.lastClick = 0;
      const cv = el.querySelector('#menuArt');
      MenuArt.mount(cv, app.profile.settings.effects, app.profile.settings.theme);
      // секрет: нажатие на экран-лицо Ковтопа
      el.addEventListener('pointerdown', e => {
        if (e.target.closest('button, input, a, .modal')) return;
        if (!MenuArt.hitTv(cv, e.clientX, e.clientY)) return;
        const code = MenuArt.kovStart();
        if (!code) return;
        K.Save.addKovCode(app.profile, code); app.persist();
        K.Audio.play('boss', 0);
      });
    },
    unmount() { MenuArt.unmount(); },
    act: {
      play(app, d, b) { app.session.playOpen = true; const sc = b.closest('.screen'); sc.querySelector('#modes').classList.add('open'); sc.querySelector('#playBtn').hidden = true; sc.querySelector('#collapseBtn').hidden = false; },
      collapse(app, d, b) { app.session.playOpen = false; const sc = b.closest('.screen'); sc.querySelector('#modes').classList.remove('open'); sc.querySelector('#playBtn').hidden = false; sc.querySelector('#collapseBtn').hidden = true; },
      single: app => app.go('single'),
      team: app => app.go('team'),
      duel: app => app.go('duel'),
      shop: app => app.go('shop'),
      leaders: app => app.go('leaders'),
      friends: app => app.go('friends'),
      settings: app => app.go('settings'),
      title(app, d, b) {
        const now = performance.now();
        const scr = S.menu;
        scr.clicks = now - scr.lastClick > 2500 ? 1 : scr.clicks + 1;
        scr.lastClick = now;
        b.classList.remove('wiggle'); void b.offsetWidth; b.classList.add('wiggle');
        if (scr.clicks >= 5) { scr.clicks = 0; secret(app); }
      }
    }
  };

  function secret(app) {
    const p = app.profile;
    const first = !p.stats.secret;
    p.stats.secret = true;
    const got = K.Profile.checkAchievements(p);
    app.persist();
    K.Audio.play('secret', 0);
    const frame = document.getElementById('frame');
    const el = document.createElement('div');
    el.className = 'secret';
    el.innerHTML = `<div><div class="eye"></div><div class="h1" style="font-size:1.6em;color:#ff6b7d">Ковтоп видит тебя</div>
      <p class="note" style="color:#d9c9b0;max-width:22em;margin:1em auto">…но микропет под защитой. Пока ты рядом.</p>
      ${first && got.length ? `<div class="banner">Тайное достижение: «${esc(got[0].name)}» · +${got[0].coins} монет</div>` : '<div class="note">Тайна уже найдена раньше.</div>'}
      <button class="btn" style="margin-top:1.2em" id="secretClose">Закрыть глаза</button></div>`;
    frame.appendChild(el);
    el.querySelector('#secretClose').addEventListener('click', () => { el.remove(); app.go('menu'); });
  }

  // Одиночка
  S.single = {
    html(app) {
      const p = app.profile, L = p.last;
      return `<div class="screen">${topbar('Одиночка', coinsChip(p))}<div class="scroll">
        <div class="section"><div class="eyebrow">Карта</div><div class="list">${mapPicker(L.map)}</div></div>
        <div class="section"><div class="eyebrow">Сложность</div>${diffPicker(p, L.diff)}
          ${p.endlessUnlocked ? '' : '<div class="note">Победите на сложности «Тяжело», чтобы узнать, что за «???».</div>'}</div>
        <div class="section"><div class="eyebrow">Отряд</div>${squadPicker(p)}</div>
        <div class="section"><button class="btn brass block" data-act="start" style="min-height:3.2em">${icon('play')} Начать матч</button></div>
      </div></div>`;
    },
    act: {
      map(app, d) { app.profile.last.map = d.id; app.persist(); app.refresh(); },
      diff(app, d) { app.profile.last.diff = d.id; app.persist(); app.refresh(); },
      diffLocked() { toast('Закрыто. Подсказка: одолейте «Тяжело».', 'bad'); },
      squad(app, d) { if (toggleSquad(app, d.id) !== false) app.refresh(); },
      toShop: app => app.go('shop', { back: 'single' }),
      start(app) {
        const p = app.profile;
        if (p.last.diff === 'endless' && !p.endlessUnlocked) p.last.diff = 'hard';
        app.startMatch({ mode: 'single', map: p.last.map, diff: p.last.diff, squad: p.squad.slice(), players: [{ id: 'p1', name: p.nick, color: K.PLAYER_COLORS[0], eye: !!p.eye }] });
      }
    }
  };

  // Команда
  // ---------- Онлайн-лобби (общее для команды и дуэли) ----------
  function netStatus(app) {
    const st = app.session.netErr ? `<div class="err">${esc(app.session.netErr)}</div>` : '';
    return K.Net.state === 'connecting' ? '<div class="note">Подключаемся к серверу…</div>' : st;
  }
  async function netConnect(app) {
    app.session.netErr = '';
    try { await K.Net.connect(app.profile); return true; }
    catch (e) { app.session.netErr = e.message; app.refresh(); return false; }
  }
  const PUB_NAMES = { 2: 'На двоих', 3: 'На троих', 4: 'На четверых' };
  function publicLobbies(app) {
    const pub = app.session.publics || { sizes: {} };
    return `<div class="section"><div class="eyebrow">Публичные лобби · без создания комнаты</div>
      <div class="pub-grid">${[2, 3, 4].map(n => {
        const w = (pub.sizes && pub.sizes[n]) || 0;
        return `<button class="pub-card" data-act="pubJoin" data-size="${n}"><b>${PUB_NAMES[n]}</b><span class="pub-dots">${Array.from({ length: n }, (_, i) => `<i class="${i < w ? 'on' : ''}"></i>`).join('')}</span><span class="note">${w ? 'ждут ' + w + ' из ' + n : 'пусто — будьте первым'}</span></button>`;
      }).join('')}</div>
      <div class="note">Как только лобби заполнится, через 5 секунд начнётся голосование за сложность (30 секунд), затем совместная игра. Карта выбирается случайно.${pub.online ? ' Сейчас на сервере: ' + pub.online + '.' : ''}</div></div>`;
  }
  function publicLobby(app, room) {
    const M = K.MAP[room.cfg.map];
    const full = room.players.length >= room.public;
    return `<div class="section"><div class="row"><div class="grow"><div class="eyebrow">Публичное лобби · ${PUB_NAMES[room.public].toLowerCase()}</div><b>${esc(M ? M.name : '')}</b> <span class="mute">· сложность выберете голосованием</span></div><button class="btn small danger" data-act="netLeave">Выйти</button></div>
        <div class="card countdown ${full ? 'go' : ''}"><b id="cd">${full ? 'Старт через 5 с' : 'Ждём игроков: ' + room.players.length + ' из ' + room.public}</b>
        <div class="pub-dots big">${Array.from({ length: room.public }, (_, i) => `<i class="${i < room.players.length ? 'on' : ''}"></i>`).join('')}</div></div></div>
      <div class="section"><div class="eyebrow">Игроки</div><div class="list">${room.players.map(x => `<div class="card row"><i class="dot" style="background:${x.color}"></i>
        <b class="grow">${esc(x.name)}${eyeBadge(x.eye)}${x.verified ? ' <span class="tw-badge" title="Twitch">' + icon('check') + '</span>' : ''} <span class="ptag">${x.tag ? '#' + esc(x.tag) : ''}</span> <span class="mute">ур. ${x.level}</span>${x.id === room.you ? ' <span class="tag">вы</span>' : ''}</b></div>`).join('')}
        ${Array.from({ length: room.public - room.players.length }, () => '<div class="card row note">Свободное место…</div>').join('')}</div></div>
      <div class="section"><div class="eyebrow">Ваш отряд в этом матче</div>${squadPicker(app.profile)}</div>`;
  }
  // Голосование за сложность: 30 секунд, при равенстве — случайная из выбранных.
  function voteView(app, room) {
    const v = room.vote, mine = room.myVote;
    const total = room.players.length;
    return `<div class="section"><div class="row"><div class="grow"><div class="eyebrow">Голосование за сложность</div><b>${esc((K.MAP[room.cfg.map] || {}).name || '')}</b></div><button class="btn small danger" data-act="netLeave">Выйти</button></div>
      <div class="card countdown go"><b id="vcd">Осталось ${Math.ceil(v.endsIn / 1000)} с</b><span class="note">Проголосовали ${v.voted} из ${total}. Когда проголосуют все, игра начнётся сразу.</span></div></div>
      <div class="section"><div class="diff-grid vote-grid">${v.options.map(d => {
        const D = K.DIFFS[d], n = v.counts[d] || 0;
        return `<button class="btn pick diff ${mine === d ? 'on' : ''}" data-act="voteDiff" data-id="${d}"><b>${D.name}</b><span class="num">${isFinite(D.waves) ? D.waves + ' волн' : '∞ волн'} · ♥${D.petHp}</span><span class="vote-bar">${Array.from({ length: total }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span></button>`;
      }).join('')}</div>
      <div class="note">${v.options.includes('endless') ? 'Бесконечный режим доступен, потому что он открыт у кого-то из игроков. ' : ''}При равенстве голосов выбирается случайная из отмеченных сложностей.</div></div>
      <div class="section"><div class="eyebrow">Игроки</div><div class="list">${room.players.map(x => `<div class="card row"><i class="dot" style="background:${x.color}"></i><b class="grow">${esc(x.name)} <span class="ptag">${x.tag ? '#' + esc(x.tag) : ''}</span></b><span class="tag ${x.voted ? '' : 'lock'}" style="${x.voted ? 'color:var(--pet);border-color:#3e8f7c' : ''}">${x.voted ? 'голос отдан' : 'выбирает'}</span></div>`).join('')}</div></div>`;
  }
  function netLobby(app, room) {
    if (room.state === 'vote' && room.vote) return voteView(app, room);
    if (room.public) return publicLobby(app, room);
    const p = app.profile, me = room.players.find(x => x.id === room.you) || {}, host = room.host === room.you;
    const full = room.mode === 'duel' ? 2 : 4, need = room.mode === 'duel' ? 2 : 2;
    const can = room.players.length >= need && room.players.every(x => x.ready);
    const D = K.DIFFS[room.cfg.diff] || K.DIFFS.normal, M = K.MAP[room.cfg.map];
    return `<div class="section"><div class="row"><div class="grow"><div class="eyebrow">Код ${room.mode === 'duel' ? 'дуэли' : 'комнаты'} · онлайн</div><span class="plaque" style="font-size:1.3em">${room.code}</span></div>
        <button class="btn small" data-act="copyCode" data-code="${room.code}">Скопировать</button><button class="btn small danger" data-act="netLeave">Выйти</button></div>
        <div class="note">Отправьте код ${room.mode === 'duel' ? 'сопернику' : 'друзьям'}: в разделе «${room.mode === 'duel' ? 'Дуэль' : 'Команда'}» они вводят его в поле «Войти по коду».</div></div>
      <div class="section"><div class="eyebrow">Игроки · ${room.players.length} из ${full}</div><div class="list">${room.players.map(x => `<div class="card row"><i class="dot" style="background:${x.color}"></i>
        <b class="grow">${esc(x.name)}${eyeBadge(x.eye)}${x.verified ? ' <span class="tw-badge" title="Twitch">' + icon('check') + '</span>' : ''} <span class="ptag">${x.tag ? '#' + esc(x.tag) : ''}</span> <span class="mute">ур. ${x.level}</span>${x.id === room.host ? ' <span class="tag">хост</span>' : ''}${x.id === room.you ? ' <span class="tag">вы</span>' : ''}</b>
        <span class="tag ${x.ready ? '' : 'lock'}" style="${x.ready ? 'color:var(--pet);border-color:#3e8f7c' : ''}">${x.ready ? 'готов' : 'не готов'}</span></div>`).join('')}</div>
        <button class="btn block ${me.ready ? 'pet' : 'brass'}" data-act="netReady">${me.ready ? 'Готов ✓ · отменить' : 'Я готов'}</button></div>
      ${host ? `<div class="section"><div class="eyebrow">Карта</div><div class="list">${mapPicker(room.cfg.map, true, 'netMap')}</div></div>
        ${room.mode === 'team' ? `<div class="section"><div class="note">Сложность выберете голосованием после старта: 30 секунд на выбор.</div>
          <div class="toggle"><div><b>Автозапуск волн</b></div><button class="switch" role="switch" aria-checked="${!!room.cfg.autoWave}" data-act="netAuto" aria-label="Автозапуск волн"></button></div></div>` : ''}
        <div class="section"><button class="btn brass block" data-act="netStart" ${can ? '' : 'disabled'}>${can ? 'Начать матч' : room.players.length < need ? 'Ждём игроков…' : 'Ждём, пока все будут готовы'}</button></div>`
      : `<div class="section card note">Хост выбрал: ${esc(M ? M.name : room.cfg.map)}${room.mode === 'team' ? (room.cfg.autoWave ? ' · волны сами' : '') + '. Сложность выберете голосованием после старта' : ''}. Матч начнёт хост, когда все будут готовы.</div>`}
      <div class="section"><div class="eyebrow">Ваш отряд в этом матче</div>${squadPicker(p)}</div>`;
  }
  const netActs = {
    async netCreate(app, d) { if (await netConnect(app)) K.Net.send('create', { mode: d.mode }); },
    async netJoin(app, d, b) {
      const inp = b.closest('.screen').querySelector('#netCode');
      const code = K.Net.cleanCode(inp.value);
      if (!K.Net.validCode(code)) { app.session.netErr = 'Код — 4 латинские буквы или цифры, например 7Q3M'; app.refresh(); return; }
      if (await netConnect(app)) K.Net.send('join', { code });
    },
    netLeave(app) { K.Net.send('leave'); app.session.netRoom = null; app.refresh(); },
    netReady(app) { const r = app.session.netRoom; const me = r && r.players.find(x => x.id === r.you); K.Net.send('ready', { ready: !(me && me.ready) }); },
    netMap(app, d) { const r = app.session.netRoom; K.Net.send('config', { cfg: Object.assign({}, r.cfg, { map: d.id }) }); },
    voteDiff(app, d) { K.Net.send('voteDiff', { diff: d.id }); },
    netAuto(app) { const r = app.session.netRoom; K.Net.send('config', { cfg: Object.assign({}, r.cfg, { autoWave: !r.cfg.autoWave }) }); },
    netStart() { K.Net.send('start'); },
    async pubJoin(app, d) { if (await netConnect(app)) { K.Net.send('squad', { squad: app.profile.squad }); K.Net.send('publicJoin', { size: +d.size }); } },
    copyCode(app, d) {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(d.code).then(() => toast('Код скопирован', 'good'), () => toast('Код: ' + d.code, 'gold'));
      else toast('Код: ' + d.code, 'gold');
    },
    async netQueue(app) { if (await netConnect(app)) { K.Net.send('squad', { squad: app.profile.squad }); K.Net.send('queue'); } },
    netUnqueue(app) { K.Net.send('unqueue'); app.session.queued = false; app.refresh(); }
  };

  // Команда
  S.team = {
    html(app, params) {
      const p = app.profile, L = p.last, room = app.session.room, nr = app.session.netRoom;
      let online;
      if (!K.Net.available()) online = `<div class="section"><div class="banner">${esc(K.Net.unavailableReason)}</div></div>`;
      else if (nr && nr.mode === 'team') online = netLobby(app, nr);
      else online = publicLobbies(app) + `<div class="section"><div class="eyebrow">Своя комната с друзьями</div>
          <button class="btn brass block" data-act="netCreate" data-mode="team">Создать онлайн-комнату</button>
          <div class="row"><input type="text" id="netCode" maxlength="4" placeholder="XXXX" style="text-transform:uppercase;font-family:var(--f-mono)" autocomplete="off" aria-label="Код комнаты"><button class="btn" data-act="netJoin">Войти по коду</button></div>
          ${netStatus(app)}<div class="note">Деньги общие, сервер проверяет каждую покупку, у каждого свой цвет башен.</div></div>`;
      let local = '';
      if (!(nr && nr.mode === 'team')) {
        if (!room) local = `<div class="section"><div class="eyebrow">На одном устройстве</div><button class="btn block" data-act="create">Создать локальную комнату</button>
          <div class="note">Игроки по очереди строят на этом экране, кошелёк общий.</div></div>`;
        else {
          const players = room.players.map(pl => `<div class="card row"><i class="dot" style="background:${pl.color}"></i>
            ${pl.host ? `<b class="grow">${esc(p.nick)}${eyeBadge(p.eye)} <span class="tag">хост</span></b>` : `<input type="text" class="grow" id="pn_${pl.id}" data-pid="${pl.id}" value="${esc(pl.name)}" maxlength="16" aria-label="Имя игрока">`}
            <button class="btn small ${pl.ready ? 'pet' : ''}" data-act="ready" data-id="${pl.id}">${pl.ready ? 'Готов ✓' : 'Не готов'}</button>
            ${pl.host ? '' : `<button class="btn small icon-btn" data-act="kick" data-id="${pl.id}" aria-label="Убрать игрока">${icon('x')}</button>`}</div>`).join('');
          local = `<div class="section"><div class="row"><div class="eyebrow grow">На одном устройстве · ${room.players.length} из 4</div><button class="btn small" data-act="leave">Закрыть</button></div>
            <div class="list">${players}</div>
            <button class="btn block" data-act="add" ${room.players.length >= 4 ? 'disabled' : ''}>Добавить игрока на этом устройстве</button></div>
          <div class="section"><div class="eyebrow">Карта</div><div class="list">${mapPicker(L.map, true)}</div></div>
          <div class="section"><div class="eyebrow">Сложность</div>${diffPicker(p, L.diff)}</div>
          <div class="section"><div class="eyebrow">Отряд команды</div>${squadPicker(p)}</div>
          <div class="section"><button class="btn brass block" data-act="start" ${room.canStart() ? '' : 'disabled'}>${room.canStart() ? 'Начать локальный матч' : 'Нужно 2+ игрока, все готовы'}</button></div>`;
        }
      }
      return `<div class="screen">${topbar('Команда', coinsChip(p))}<div class="scroll">${online}${local}</div></div>`;
    },
    mount(el, app, params) {
      clearInterval(this.cdTimer);
      if (K.Net.available() && K.Net.state === 'off' && !this.tried) { this.tried = true; netConnect(app).then(ok => { if (ok) K.Net.send('publics'); }); }
      this.cdTimer = setInterval(() => {
        const cd = document.getElementById('cd'), end = app.session.countdownEnd;
        if (cd && end) { const left = Math.max(0, Math.ceil((end - Date.now()) / 1000)); cd.textContent = left > 0 ? 'Лобби заполнено! Голосование через ' + left + ' с' : 'Начинаем голосование…'; }
        const vcd = document.getElementById('vcd'), vend = app.session.voteEnd;
        if (vcd && vend) { const left = Math.max(0, Math.ceil((vend - Date.now()) / 1000)); vcd.textContent = left > 0 ? 'Осталось ' + left + ' с' : 'Подводим итоги…'; }
      }, 200);
      if (params && params.invite) {
        app.session.inviteFor = params.invite;
        if (K.Net.available() && !app.session.netRoom) { netActs.netCreate(app, { mode: 'team' }); toast('Создаём комнату — отправьте код игроку ' + params.invite, 'gold'); }
        params.invite = null;
      }
      el.addEventListener('change', e => {
        const pid = e.target.dataset && e.target.dataset.pid;
        if (!pid) return;
        if (!pid || !app.session.room) return;
        const pl = app.session.room.players.find(x => x.id === pid);
        const v = K.Profile.validNick(e.target.value);
        if (pl && v.ok) pl.name = v.value; else if (pl) { e.target.value = pl.name; toast(v.reason, 'bad'); }
      });
    },
    unmount() { clearInterval(this.cdTimer); this.tried = false; },
    act: Object.assign({
      create(app) { app.session.room = new K.Net.LocalRoom(app.profile.nick); app.refresh(); },
      leave(app) { app.session.room = null; app.refresh(); },
      add(app) { const r = app.session.room.addLocal(); if (!r.ok) toast(r.reason, 'bad'); app.refresh(); },
      kick(app, d) { app.session.room.remove(d.id); app.refresh(); },
      ready(app, d) { app.session.room.toggleReady(d.id); app.refresh(); },
      map(app, d) { app.profile.last.map = d.id; app.persist(); app.refresh(); },
      diff(app, d) { app.profile.last.diff = d.id; app.persist(); app.refresh(); },
      diffLocked() { toast('Закрыто. Подсказка: одолейте «Тяжело».', 'bad'); },
      squad(app, d) { if (toggleSquad(app, d.id) !== false) { K.Net.send('squad', { squad: app.profile.squad }); app.refresh(); } },
      toShop: app => app.go('shop', { back: 'team' }),
      start(app) {
        const room = app.session.room, p = app.profile;
        if (!room || !room.canStart()) return;
        const players = room.players.map(pl => ({ id: pl.id, name: pl.host ? p.nick : pl.name, color: pl.color, eye: pl.host ? !!p.eye : false }));
        room.players.forEach(pl => { pl.ready = false; });
        app.startMatch({ mode: 'team', map: p.last.map, diff: p.last.diff, squad: p.squad.slice(), players });
      }
    }, netActs)
  };

  // Дуэль
  S.duel = {
    html(app) {
      const p = app.profile, L = p.last, D = p.duel, nr = app.session.netRoom;
      const hist = D.history.length ? D.history.map(h => `<div class="row card"><span class="tag ${h.result === 'win' ? '' : 'lock'}" style="${h.result === 'win' ? 'color:var(--good);border-color:#2f6a3a' : ''}">${h.result === 'win' ? 'Победа' : h.result === 'lose' ? 'Поражение' : 'Ничья'}</span><span class="grow note">${esc(h.opp)} · ${new Date(h.at).toLocaleDateString('ru-RU')}</span><span class="num">${h.wave} в · ${fmtTime(h.time)}</span></div>`).join('') : '<div class="note">Пока нет сыгранных дуэлей.</div>';
      let online;
      if (!K.Net.available()) online = `<div class="section"><div class="eyebrow">Онлайн</div><div class="banner">${esc(K.Net.unavailableReason)}</div></div>`;
      else if (nr && nr.mode === 'duel') online = netLobby(app, nr);
      else if (app.session.queued) online = `<div class="section"><div class="card row"><div class="grow"><b>Ищем соперника…</b><div class="note">Подбираем игрока с близким уровнем. Сейчас в очереди: ${app.session.queueSize || 1}</div></div><button class="btn small" data-act="netUnqueue">Отмена</button></div></div>`;
      else online = `<div class="section"><div class="eyebrow">Онлайн против живого игрока</div>
          <button class="btn brass block" data-act="netQueue">Поиск случайного соперника</button>
          <button class="btn block" data-act="netCreate" data-mode="duel">Вызвать друга — создать дуэль</button>
          <div class="row"><input type="text" id="netCode" maxlength="4" placeholder="XXXX" style="text-transform:uppercase;font-family:var(--f-mono)" autocomplete="off" aria-label="Код дуэли"><button class="btn" data-act="netJoin">Войти по коду</button></div>
          ${netStatus(app)}</div>`;
      return `<div class="screen">${topbar('Дуэль', coinsChip(p))}<div class="scroll">
        <div class="section"><div class="kv card"><span>Победы / поражения / ничьи</span><b>${D.w} / ${D.l} / ${D.d}</b><span>Максимальная волна</span><b>${D.maxWave}</b></div></div>
        ${online}
        ${nr && nr.mode === 'duel' ? '' : `<div class="section"><div class="eyebrow">Тренировка против бота · без интернета</div>
          <div class="card note">Бот подбирается под вас: уровень около ${p.level} (±2) и тот же набор героев. Волны общие: следующая начинается у обоих, только когда оба отбили текущую. Во время матча можно открыть карту соперника.</div>
          <div class="list">${mapPicker(L.duelMap, true)}</div></div>
        <div class="section"><div class="eyebrow">Ваш отряд</div>${squadPicker(p)}</div>
        <div class="section"><button class="btn block" data-act="start">${icon('play')} Тренировка с ботом</button></div>`}
        <div class="section"><div class="eyebrow">Последние матчи</div><div class="list">${hist}</div></div>
      </div></div>`;
    },
    act: Object.assign({
      map(app, d) { app.profile.last.duelMap = d.id; app.persist(); app.refresh(); },
      squad(app, d) { if (toggleSquad(app, d.id) !== false) { K.Net.send('squad', { squad: app.profile.squad }); app.refresh(); } },
      toShop: app => app.go('shop', { back: 'duel' }),
      start(app) {
        const p = app.profile;
        app.startMatch({ mode: 'duel', map: p.last.duelMap, squad: p.squad.slice() });
      }
    }, netActs)
  };

  // Магазин
  // Скины главного меню
  const SKINS = [
    { id: 'hotel', name: 'Отель', desc: 'Зелёные обои, ковровая дорожка и дверь номера 0000. Оформление по умолчанию.' },
    { id: 'mine', name: 'Шахты', desc: 'Каменная стена, крепь, рельсы и фонари. Открывается секретным кодом — подсказка мигает азбукой Морзе в главном меню.' }
  ];
  S.shop = {
    caption(app) {
      if ((app.session.shopTab || 'heroes') === 'skins') {
        const p = app.profile, sk = SKINS.find(x => x.id === (app.session.skinSel || p.settings.theme || 'hotel')) || SKINS[0];
        const owned = p.themes.includes(sk.id);
        return `<div class="grow"><div class="rar" style="color:var(--brass-hi)">Скин главного меню</div><div class="h2">${sk.name}</div><div class="note">${owned ? (p.settings.theme === sk.id ? 'Сейчас выбран' : 'Открыт') : 'Закрыт'}</div></div><span class="plaque">${owned ? (p.settings.theme === sk.id ? 'Выбран' : 'Открыт') : icon('lock')}</span>`;
      }
      const p = app.profile, sel = app.session.shopSel || 'blaster', H = K.HERO[sel], owned = p.owned.includes(sel);
      return `<div class="grow"><div class="rar" style="color:${H.color}">${H.rarity}</div><div class="h2">${H.name}</div><div class="note">${H.role}</div></div><span class="plaque">${owned ? 'Открыт' : H.price}</span>`;
    },
    tabs(app) {
      const tab = app.session.shopTab || 'heroes';
      return `<div class="seg shop-tabs">${[['heroes', 'Герои'], ['skins', 'Скины']].map(([k, n]) => `<button class="${tab === k ? 'on' : ''}" data-act="tab" data-id="${k}">${n}</button>`).join('')}</div>`;
    },
    codeBox(app) {
      const p = app.profile;
      return `<div class="section card code-box"><div class="eyebrow">Ввести код</div>
            <div class="row"><input type="text" id="promo" maxlength="16" placeholder="Код" autocomplete="off" aria-label="Код"><button class="btn" data-act="code">Активировать</button></div>
            <div class="err" id="promoErr"></div>
            <div class="note">${p.themes.length > 1 ? 'Открытые скины: ' + p.themes.map(t => K.THEMES[t].name).join(', ') + '. Выбрать можно во вкладке «Скины».' : 'Иногда подсказки к кодам прячутся прямо в игре.'}</div></div>`;
    },
    skinsBody(app) {
      const p = app.profile, cur = app.session.skinSel || p.settings.theme || 'hotel';
      return `<div class="section"><div class="eyebrow">Скины главного меню</div><div class="skin-list">${SKINS.map(sk => {
        const owned = p.themes.includes(sk.id), on = p.settings.theme === sk.id;
        return `<button class="skin-card ${cur === sk.id ? 'sel' : ''} ${owned ? '' : 'locked'}" data-act="skin" data-id="${sk.id}">
          <span class="skin-prev" style="background-image:url(${MenuArt.preview(sk.id, 320, 400)})">${owned ? '' : `<span class="skin-lock">${icon('lock')}</span>`}</span>
          <span class="skin-meta"><b>${sk.name}</b><span class="tag ${on ? 'on' : owned ? '' : 'lock'}">${on ? 'Выбран' : owned ? 'Открыт' : 'Секрет'}</span></span></button>`;
      }).join('')}</div></div>
        ${(() => { const sk = SKINS.find(x => x.id === cur) || SKINS[0], owned = p.themes.includes(sk.id), on = p.settings.theme === sk.id;
          return `<div class="section card"><div class="note">${esc(sk.desc)}</div>${owned ? `<button class="btn ${on ? 'pet' : 'brass'} block" data-act="useSkin" data-id="${sk.id}" ${on ? 'disabled' : ''}>${on ? 'Выбран ✓' : 'Выбрать'}</button>` : `<div class="banner">Присмотритесь к лампе в главном меню: она мигает азбукой Морзе. Расшифруйте английское слово и введите его ниже.</div>`}</div>`; })()}
        ${this.codeBox(app)}`;
    },
    body(app) {
      if ((app.session.shopTab || 'heroes') === 'skins') return this.skinsBody(app);
      const p = app.profile;
      const sel = app.session.shopSel || 'blaster';
      const H = K.HERO[sel];
      const owned = p.owned.includes(sel), inSquad = p.squad.includes(sel);
      const maxOf = k => Math.max(...K.HEROES.map(h => k === 'dps' ? h.base.dmg * h.base.rate : h.base[k] || 0));
      const bars = (H.base.passive ? [] : [['Урон', 'dmg'], ['Скорострельность', 'rate'], ['Дальность', 'range'], ['DPS', 'dps']]).map(([n, k]) => {
        const v = k === 'dps' ? H.base.dmg * H.base.rate : H.base[k];
        return `<span>${n}</span><div class="bar"><i style="width:${Math.round(100 * v / maxOf(k))}%;background:${H.color}"></i></div><b class="num">${k === 'rate' ? v.toFixed(2) : Math.round(v * 10) / 10}</b>`;
      }).join('');
      const traits = [H.base.garage && 'Здание', H.base.garage && 'Машина ' + H.base.carHp + ' жизней каждые ' + H.base.carInt + ' с', H.base.garage && 'Не больше ' + K.GARAGE_MAX + ' на игрока', H.base.passive && !H.base.garage && 'Не атакует', H.base.aa && 'ПВО с рождения', H.base.vision && 'Вижен с рождения', H.base.splash && 'Урон по области', H.base.slow && 'Замедление', H.base.chain && 'Цепь ' + H.base.chain, H.base.income && 'Доход +' + H.base.income + ' в начале волны'].filter(Boolean);
      const blist = (arr, br) => arr.map((u, i) => `<div class="it"><span style="color:${br ? '#ffb7c0' : 'var(--brass-hi)'}">${icon(u.icon)}</span><span class="grow"><b>${i + 1}. ${esc(u.name)}</b><br><span class="mute">${esc(u.desc)}</span></span><span class="num">${u.cost}</span></div>`).join('');
      let action;
      if (!owned) action = `<button class="btn brass block" data-act="buy" ${p.coins < H.price ? 'disabled' : ''}>Купить за <span class="num coin">${H.price}</span></button>${p.coins < H.price ? `<div class="note">Не хватает ${H.price - p.coins} монет. Монеты дают за волны, победы и достижения.</div>` : ''}`;
      else action = `<button class="btn ${inSquad ? 'pet' : ''} block" data-act="squadT">${inSquad ? 'В отряде ✓ · убрать' : 'Добавить в отряд'}</button>`;
      // сортировка: по редкости или по цене
      const sort = app.session.shopSort || 'rarity';
      const ro = h => K.RARITY_ORDER.indexOf(h.rarity);
      const list = K.HEROES.slice().sort(sort === 'rarity' ? (a, b) => ro(a) - ro(b) || a.price - b.price : sort === 'cheap' ? (a, b) => a.price - b.price || ro(a) - ro(b) : (a, b) => b.price - a.price || ro(b) - ro(a));
      const sortBar = `<div class="row"><span class="eyebrow grow">Сортировка</span><div class="seg" style="min-width:14em">${[['rarity', 'Редкость'], ['cheap', 'Дешевле'], ['dear', 'Дороже']].map(([k, n]) => `<button class="${sort === k ? 'on' : ''}" data-act="sort" data-id="${k}">${n}</button>`).join('')}</div></div>`;
      return `<div class="section">${sortBar}<div class="list">${list.map(h => `<button class="hero-card ${sel === h.id ? 'on' : ''} ${p.owned.includes(h.id) ? '' : 'locked'}" data-act="sel" data-id="${h.id}">
            <span class="hero-thumb" style="background-image:url(${K.thumbs[h.id] || ''})"></span>
            <span class="grow" style="min-width:0"><span class="rar" style="color:${h.color}">${h.rarity}</span><br><b>${h.name}</b><br><span class="note">${h.role}</span></span>
            <span style="text-align:right">${p.owned.includes(h.id) ? (p.squad.includes(h.id) ? '<span class="tag" style="color:var(--pet);border-color:#3e8f7c">в отряде</span>' : '<span class="tag">открыт</span>') : `<span class="tag lock">${icon('lock')}</span><br><span class="num coin">${h.price}</span>`}</span></button>`).join('')}</div></div>
          <div class="section card"><div class="note">${esc(H.desc)}</div>
            <div class="chips">${traits.map(t => `<span class="tag">${t}</span>`).join('')}<span class="tag">Установка: ${H.cost}</span></div>
            <div class="cmp">${bars}</div>${action}</div>
          <div class="section card"><div class="eyebrow">Верхняя ветка · ${H.base.garage ? 'чаще машины и стрелок' : H.base.passive ? 'жизни микропета' : 'дальность и скорость'}</div><div class="blist">${blist(H.top, 0)}</div></div>
          <div class="section card"><div class="eyebrow">Нижняя ветка · ${H.base.garage ? 'крепче машина, на 5-м уровне танк' : H.base.passive ? 'больше монет' : 'мощный урон'}</div><div class="blist">${blist(H.bottom, 1)}</div></div>
          <div class="section note">Уровни 1–2 можно купить в обеих ветках всегда. Выше 2-го уровня можно прокачать только одну ветку — вторая остаётся максимум на 2.</div>
          ${this.codeBox(app)}`;
    },
    html(app) {
      return `<div class="screen">${topbar('Магазин', '<span id="shopCoins">' + coinsChip(app.profile) + '</span>')}
        <div class="showcase"><canvas id="showcase"></canvas><div class="cap" id="shopCap">${this.caption(app)}</div></div>
        <div id="shopTabs">${this.tabs(app)}</div>
        <div class="scroll" id="shopBody">${this.body(app)}</div></div>`;
    },
    update(app) {
      const el = app.root;
      el.querySelector('#shopCap').innerHTML = this.caption(app);
      el.querySelector('#shopBody').innerHTML = this.body(app);
      el.querySelector('#shopTabs').innerHTML = this.tabs(app);
      el.querySelector('#shopCoins').innerHTML = coinsChip(app.profile);
      if (this.sc) this.sc.show(app.session.shopSel || 'blaster');
    },
    mount(el, app) {
      const cv = el.querySelector('#showcase');
      const sel = app.session.shopSel || 'blaster';
      const ctx = cv.getContext('2d'), SP = K.Sprites;
      this.sc = { show: id => { this.cur = id; } };
      this.cur = sel;
      const start = performance.now();
      const loop = now => {
        this.raf = requestAnimationFrame(loop);
        const t = (now - start) / 1000, r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
        if (cv.width !== Math.round(r.width * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
        const w = cv.width, h = cv.height, s = Math.min(w, h) * 0.42;
        if ((app.session.shopTab || 'heroes') === 'skins') { paintMenu(ctx, w, h, t, (app.session.skinSel || app.profile.settings.theme) === 'mine'); return; }
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, w, h);
        const g = ctx.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h * 0.45, s * 1.2); g.addColorStop(0, K.HERO[this.cur].color + '44'); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        ctx.translate(w / 2, h * 0.42); ctx.scale(s, s); SP.setPx(s);
        SP.tower(ctx, this.cur, { aim: Math.sin(t * 0.8) * 0.9, t, recoil: (t * 1.5) % 1 < 0.15 ? 1 - ((t * 1.5) % 1) / 0.15 : 0, color: K.HERO[this.cur].color, up: [0, 0] });
      };
      this.raf = requestAnimationFrame(loop);
    },
    unmount() { cancelAnimationFrame(this.raf); this.sc = null; },
    act: {
      sel(app, d) { app.session.shopSel = d.id; S.shop.update(app); },
      buy(app) {
        const p = app.profile, id = app.session.shopSel || 'blaster', H = K.HERO[id];
        if (p.owned.includes(id)) return;
        if (p.coins < H.price) { toast('Не хватает монет', 'bad'); K.Audio.play('deny', 0); return; }
        p.coins -= H.price;
        p.owned.push(id);
        if (p.squad.length < K.SQUAD_MAX) p.squad.push(id);
        const got = K.Profile.checkAchievements(p);
        app.persist();
        K.Audio.play('buy', 0);
        toast(H.name + ' теперь в коллекции' + (p.squad.includes(id) ? ' и в отряде' : ''), 'good');
        got.forEach(a => toast('Достижение: ' + a.name + ' · +' + a.coins, 'gold'));
        S.shop.update(app);
      },
      squadT(app) { if (toggleSquad(app, app.session.shopSel || 'blaster') !== false) S.shop.update(app); },
      sort(app, d) { app.session.shopSort = d.id; S.shop.update(app); },
      tab(app, d) { app.session.shopTab = d.id; if (d.id === 'skins') app.session.skinSel = app.profile.settings.theme || 'hotel'; S.shop.update(app); app.root.querySelector('#shopBody').scrollTop = 0; },
      skin(app, d) { app.session.skinSel = d.id; S.shop.update(app); },
      useSkin(app, d) { if (!app.profile.themes.includes(d.id)) return; app.profile.settings.theme = d.id; app.persist(); app.applyFx(); K.Audio.play('buy', 0); toast('Скин «' + K.THEMES[d.id].name + '» выбран', 'good'); S.shop.update(app); },
      code(app, d, b) {
        const inp = b.closest('.screen').querySelector('#promo'), err = b.closest('.screen').querySelector('#promoErr');
        const r = K.Save.redeem(app.profile, inp.value);
        if (!r.ok) { err.textContent = r.reason; K.Audio.play('deny', 0); return; }
        app.persist(); app.applyFx(); K.Audio.play('secret', 0);
        if (r.reward === 'eye') {
          modal(`<div class="h2">Взгляд Ковтопа</div><div class="banner">Вы запомнили все пять чисел. Теперь рядом с вашим именем всегда горит глаз Ковтопа ${eyeBadge(true)}</div>${r.achievements.map(a => `<div class="row"><span class="tag demo">Достижение</span><span class="grow">${esc(a.name)}</span><span class="num coin">+${a.coins}</span></div>`).join('')}<button class="btn brass block" data-m="close">Жутковато</button>`, { close: () => { closeModal(); S.shop.update(app); } }, { center: true });
          return;
        }
        modal(`<div class="h2">Сигнал из шахты</div><div class="banner">Код принят! Открыто оформление «Шахты»: камень, крепь и свет фонарей. Скин уже выбран — сменить можно во вкладке «Скины».</div>${r.achievements.map(a => `<div class="row"><span class="tag demo">Достижение</span><span class="grow">${esc(a.name)}</span><span class="num coin">+${a.coins}</span></div>`).join('')}<button class="btn brass block" data-m="close">Отлично</button>`, { close: () => { closeModal(); app.session.shopTab = 'skins'; app.session.skinSel = 'mine'; S.shop.update(app); } }, { center: true });
      }
    }
  };

  // Лидерборд
  const LB = [
    ['level', 'Уровень', o => o.level, v => 'ур. ' + v],
    ['endless', 'Бесконечный', o => o.endless, v => v + ' волн'],
    ['duel', 'Дуэли', o => o.duelWins, v => v + ' побед'],
    ['time', 'Время', o => o.time, v => fmtHours(v)]
  ];
  S.leaders = {
    html(app) {
      const p = app.profile;
      const tab = app.session.lbTab || 'level', desc = app.session.lbDesc !== false;
      const def = LB.find(x => x[0] === tab);
      const me = { nick: p.nick, level: p.level, endless: p.endless.best, duelWins: p.duel.w, time: p.playTime, me: true, verified: !!p.twitch };
      const rows = [me].concat((app.session.serverLeaders || []).filter(r => !(p.twitch && r.nick === p.twitch.login)));
      rows.sort((a, b) => (desc ? 1 : -1) * (def[2](b) - def[2](a)));
      return `<div class="screen">${topbar('Лидерборд')}<div class="scroll">
        <div class="section"><div class="banner">${K.Net.available() ? 'Рейтинг загружается с сервера: учитываются только матчи, проверенные сервером, и игроки, вошедшие через Twitch или Google.' : 'Игровой сервер не подключён, поэтому здесь только ваш результат. Ботов в рейтинге нет — они встречаются только в дуэлях. Когда сервер заработает, появятся игроки, подтверждённые через Twitch или Google.'}</div></div>
        <div class="section"><div class="tabs">${LB.map(t => `<button class="btn small ${tab === t[0] ? 'brass' : ''}" data-act="tab" data-id="${t[0]}">${t[1]}</button>`).join('')}</div>
          ${rows.length > 1 ? `<div class="row"><span class="note grow">Сортировка: ${desc ? 'лучшие сверху' : 'с конца'}</span><button class="btn small" data-act="sort">Перевернуть</button></div>` : ''}</div>
        <div class="section"><div class="list">${rows.map((r, i) => `<button class="lb-row ${r.me ? 'me' : ''}" data-act="profile" data-i="${r.me ? 'me' : i}">
          <span class="num">${desc ? i + 1 : rows.length - i}</span>
          <span style="min-width:0"><b>${esc(r.nick)}</b>${eyeBadge(r.me ? p.eye : r.eye)} <span class="ptag">${r.me ? '#' + esc(p.tag) : r.tag ? '#' + esc(r.tag) : ''}</span>${r.verified ? ' <span class="tw-badge" title="Подтверждено через Twitch">' + icon('check') + '</span>' : ''}<br><span class="note">ур. ${r.level} · ${r.me ? (p.twitch ? 'вы · Twitch подтверждён' : p.google ? 'вы · Google подтверждён' : 'вы · локально') : '<span class="dot ' + (r.online ? 'on' : '') + '"></span> ' + (r.online ? 'в сети' : 'не в сети')}</span></span>
          <b class="num">${def[3](def[2](r))}</b></button>`).join('')}</div></div>
      </div></div>`;
    },
    async mount(el, app) {
      if (!K.Net.available() || this.loading) return;
      this.loading = true;
      try { await K.Net.connect(app.profile); K.Net.send('leaders'); } catch (e) { /* остаётся локальный рейтинг */ }
      this.loading = false;
    },
    act: {
      tab(app, d) { app.session.lbTab = d.id; app.refresh(); },
      sort(app) { app.session.lbDesc = app.session.lbDesc === false; app.refresh(); },
      profile(app, d) {
        const p = app.profile;
        const o = d.i === 'me' ? { nick: p.nick, level: p.level, endless: p.endless.best, duelWins: p.duel.w, time: p.playTime } : (app.session.serverLeaders || [])[+d.i];
        if (!o) return;
        modal(profileCard(o, false) + '<button class="btn block" data-m="close">Закрыть</button>', { close: () => closeModal() }, { center: true });
      }
    }
  };

  // Друзья
  S.friends = {
    html(app) {
      const p = app.profile, F = p.friends;
      const q = (app.session.fq || '').trim().toLowerCase();
      const known = new Set([...F.list.map(x => x.nick), ...F.outgoing.map(x => x.nick), ...F.incoming.map(x => x.nick)]);
      const net = K.Net.available();
      const isTag = /^#?[a-z0-9]{3,11}$/i.test(q) && q.startsWith('#');
      const results = q && !net ? K.DEMO_PLAYERS.filter(d => d.nick.toLowerCase().includes(q)) : [];
      const found = app.session.found;
      const online = n => hash(n) % 3 === 0;
      let res = '';
      if (q && net) {
        if (!found || found.tag !== q.replace('#', '').toUpperCase()) res = '<div class="note">Ищем…</div>';
        else if (!found.player) res = '<div class="note">Игрока с таким тегом нет.</div>';
        else { const f = found.player; res = `<div class="card row"><span class="dot ${f.online ? 'on' : ''}"></span><b class="grow">${esc(f.nick)} <span class="ptag">#${esc(f.tag)}</span></b><span class="note">ур. ${f.level}</span>${known.has(f.nick) ? '<span class="tag">уже в списке</span>' : `<button class="btn small" data-act="request" data-n="${esc(f.nick)}" data-tag="${esc(f.tag)}">Добавить</button>`}</div>`; }
      } else if (q) res = results.length ? results.map(d => `<div class="card row"><b class="grow">${esc(d.nick)}</b><span class="tag demo">демо</span>${known.has(d.nick) ? '<span class="tag">уже в списке</span>' : `<button class="btn small" data-act="request" data-n="${esc(d.nick)}">Добавить</button>`}</div>`).join('') : '<div class="note">Никого не нашлось.</div>';
      return `<div class="screen">${topbar('Друзья')}<div class="scroll">
        <div class="section card row"><div class="grow"><div class="eyebrow">Ваш тег</div><span class="plaque" style="font-size:1.2em">#${esc(p.tag)}</span></div><button class="btn small" data-act="copyTag">Скопировать</button></div>
        ${net ? '' : '<div class="section"><div class="banner">Сервер не подключён: игроки ниже — демонстрационные профили. Поиск по тегу работает, когда игра открыта с сервера.</div></div>'}
        <div class="section"><div class="eyebrow">${net ? 'Поиск по тегу' : 'Поиск по никнейму'}</div><div class="row"><input type="text" id="fq" value="${esc(app.session.fq || '')}" placeholder="${net ? '#GRJ' : 'Например, Фонарик'}" autocomplete="off" style="${net ? 'text-transform:uppercase;font-family:var(--f-mono)' : ''}"><button class="btn" data-act="search">Найти</button></div>
          <div class="list">${res}</div></div>
        ${F.incoming.length ? `<div class="section"><div class="eyebrow">Заявки в друзья · ${F.incoming.length}</div><div class="list">${F.incoming.map(r => `<div class="card row"><b class="grow">${esc(r.nick)}</b><button class="btn small pet" data-act="accept" data-n="${esc(r.nick)}">Принять</button><button class="btn small" data-act="decline" data-n="${esc(r.nick)}">Отклонить</button></div>`).join('')}</div></div>` : ''}
        ${F.outgoing.length ? `<div class="section"><div class="eyebrow">Отправленные</div><div class="list">${F.outgoing.map(r => `<div class="card row"><b class="grow">${esc(r.nick)}</b><span class="note">ожидает ответа · нужен сервер</span><button class="btn small" data-act="cancelReq" data-n="${esc(r.nick)}">Отозвать</button></div>`).join('')}</div></div>` : ''}
        <div class="section"><div class="eyebrow">Список друзей · ${F.list.length}</div><div class="list">${F.list.length ? F.list.map(f => `<div class="card"><div class="row"><span class="dot ${online(f.nick) ? 'on' : ''}"></span><b class="grow">${esc(f.nick)} ${f.tag ? '<span class="ptag">#' + esc(f.tag) + '</span>' : ''}</b><span class="note">${f.tag ? '' : (online(f.nick) ? 'в сети' : 'не в сети') + ' · демо'}</span></div>
          <div class="row" style="margin-top:.5em;flex-wrap:wrap"><button class="btn small" data-act="fprofile" data-n="${esc(f.nick)}">Профиль</button><button class="btn small" data-act="invite" data-n="${esc(f.nick)}">В команду</button><button class="btn small" data-act="challenge" data-n="${esc(f.nick)}">Дуэль</button><button class="btn small danger" data-act="remove" data-n="${esc(f.nick)}">Удалить</button></div></div>`).join('') : '<div class="note">Пока пусто. Найдите игроков через поиск.</div>'}</div></div>
      </div></div>`;
    },
    mount(el, app) {
      const inp = el.querySelector('#fq');
      if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') S.friends.doSearch(app, inp.value); });
    },
    async doSearch(app, v) {
      v = String(v || '').trim();
      if (K.Net.available()) {
        v = '#' + v.replace(/^#/, '').toUpperCase();
        app.session.fq = v; app.session.found = null; app.refresh();
        if (!/^#[A-Z0-9]{3,11}$/.test(v)) { app.session.found = { tag: v.slice(1), player: null }; app.refresh(); return; }
        if (await netConnect(app)) K.Net.send('findTag', { tag: v });
      } else { app.session.fq = v; app.refresh(); }
    },
    act: {
      search(app, d, b) { S.friends.doSearch(app, b.closest('.screen').querySelector('#fq').value); },
      copyTag(app) { const t = '#' + app.profile.tag; if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(() => toast('Тег скопирован', 'good'), () => toast('Ваш тег: ' + t, 'gold')); else toast('Ваш тег: ' + t, 'gold'); },
      request(app, d) {
        const F = app.profile.friends;
        if (d.tag) { if (!F.list.some(x => x.nick === d.n)) F.list.push({ nick: d.n, tag: d.tag, since: Date.now() }); app.persist(); toast(d.n + ' добавлен в друзья', 'good'); app.refresh(); return; }
        if (!F.outgoing.some(x => x.nick === d.n)) F.outgoing.push({ nick: d.n, at: Date.now() }); app.persist(); toast('Заявка сохранена. Отправится, когда появится сервер.', 'gold'); app.refresh();
      },
      cancelReq(app, d) { const F = app.profile.friends; F.outgoing = F.outgoing.filter(x => x.nick !== d.n); app.persist(); app.refresh(); },
      accept(app, d) { const F = app.profile.friends; F.incoming = F.incoming.filter(x => x.nick !== d.n); if (!F.list.some(x => x.nick === d.n)) F.list.push({ nick: d.n, since: Date.now() }); app.persist(); toast(d.n + ' теперь в друзьях', 'good'); app.refresh(); },
      decline(app, d) { const F = app.profile.friends; F.incoming = F.incoming.filter(x => x.nick !== d.n); app.persist(); app.refresh(); },
      remove(app, d) { confirmBox('Удалить ' + d.n + ' из друзей?', 'Удалить', () => { const F = app.profile.friends; F.list = F.list.filter(x => x.nick !== d.n); app.persist(); app.refresh(); }, true); },
      fprofile(app, d) {
        const o = K.DEMO_PLAYERS.find(x => x.nick === d.n) || { nick: d.n, level: 1, endless: 0, duelWins: 0, time: 0 };
        modal(profileCard(o, true) + '<button class="btn block" data-m="close">Закрыть</button>', { close: () => closeModal() }, { center: true });
      },
      invite(app, d) { app.go('team', { invite: d.n }); },
      challenge(app, d) {
        if (K.Net.available()) { app.session.inviteFor = d.n; app.go('duel'); netActs.netCreate(app, { mode: 'duel' }); return; }
        modal(`<div class="h2">Вызов: ${esc(d.n)}</div><div class="banner">${esc(K.Net.unavailableReason)}</div><button class="btn brass block" data-m="bot">Тренировка с ботом</button><button class="btn block" data-m="close">Закрыть</button>`,
          { bot: () => { closeModal(); app.go('duel'); }, close: () => closeModal() }, { center: true });
      }
    }
  };

  // Настройки и профиль
  S.settings = {
    html(app) {
      const p = app.profile, st = p.settings;
      const need = K.Profile.xpNeed(p.level);
      const inf = K.Save.info(p);
      const sw = (key, label, sub) => `<div class="toggle"><div><b>${label}</b>${sub ? `<div class="note">${sub}</div>` : ''}</div><button class="switch" role="switch" aria-checked="${!!st[key]}" data-act="sw" data-k="${key}" aria-label="${label}"></button></div>`;
      const achs = K.ACHIEVEMENTS.map(a => { const got = !!p.achievements[a.id]; return `<div class="ach ${got ? 'got' : ''}"><span class="medal">${got ? icon('star') : icon('lock')}</span><div class="grow"><b>${a.secret && !got ? '???' : esc(a.name)}</b><div class="note">${a.secret && !got ? 'Тайное достижение' : esc(a.desc)}</div></div><span class="num note">+${a.coins}</span></div>`; }).join('');
      return `<div class="screen">${topbar('Профиль и настройки')}<div class="scroll">
        <div class="section card">
          <div class="row"><div class="lvl" style="--p:${Math.round(100 * p.xp / need)};font-size:1.3em"><span>${p.level}</span></div><div class="grow"><div class="h2">${esc(p.nick)}${eyeBadge(p.eye)} <span class="ptag">#${esc(p.tag)}</span></div><div class="note">Тег выдаётся один раз и не меняется${p.tagVerified ? '' : ' (подтвердится при подключении к серверу)'} · Опыт ${p.xp} / ${need} · до уровня ${need - p.xp}</div><div class="bar" style="margin-top:.3em"><i style="width:${100 * p.xp / need}%"></i></div></div></div>
          <div class="kv"><span>Открыто башен</span><b>${p.owned.length} / ${K.HEROES.length}</b><span>Максимальная волна</span><b>${p.maxWave}</b><span>Рекорд бесконечного</span><b>${p.endless.best}${p.endless.bestTime ? ' · ' + fmtTime(p.endless.bestTime) : ''}</b><span>Дуэли: победы / поражения / ничьи</span><b>${p.duel.w} / ${p.duel.l} / ${p.duel.d}</b><span>Всего уничтожено</span><b>${p.stats.kills}</b><span>Время в игре</span><b>${fmtHours(p.playTime)}</b><span>Монеты аккаунта</span><b class="coin">${p.coins}</b></div>
        </div>
        <div class="section"><div class="eyebrow">Twitch</div>${twitchBlock(p)}</div>
        <div class="section"><div class="eyebrow">Google</div>${googleBlock(p)}</div>
        <div class="section note"><a href="privacy.html" target="_blank" rel="noopener">Политика конфиденциальности</a> · <a href="terms.html" target="_blank" rel="noopener">Условия использования</a></div>
        <div class="section"><div class="eyebrow">Никнейм</div>${p.twitch ? `<div class="card note">Никнейм взят из Twitch: <b>${esc(p.twitch.display)}</b>. Чтобы сменить его вручную, отвяжите Twitch.</div>` : `<div class="row"><input type="text" id="nick" value="${esc(p.nick)}" maxlength="16" autocomplete="off"><button class="btn" data-act="nick">Сохранить</button></div><div class="err" id="nickErr"></div>`}</div>
        <div class="section"><div class="eyebrow">Игра</div>
          ${sw('sound', 'Звук')}
          <div class="note">Автозапуск волн и скорость игры — в меню паузы во время матча.</div>
          ${sw('effects', 'Дополнительные эффекты', 'Мерцание ламп, пыль, частицы, покачивание камеры. Отключите для стабильности трансляции.')}
          <div class="toggle"><b>Качество графики</b><div class="seg" style="min-width:12em">${[['low', 'Низкое'], ['mid', 'Среднее'], ['high', 'Высокое']].map(([k, n]) => `<button class="${st.quality === k ? 'on' : ''}" data-act="q" data-id="${k}">${n}</button>`).join('')}</div></div>
          <div class="toggle"><div><b>Оформление</b><div class="note">${p.themes.length > 1 ? 'Скины также выбираются в магазине' : 'Другие скины открываются секретными кодами в магазине'}</div></div><div class="seg" style="min-width:10em">${p.themes.map(t => `<button class="${st.theme === t ? 'on' : ''}" data-act="theme" data-id="${t}">${K.THEMES[t].name}</button>`).join('')}</div></div>
          <div class="toggle"><div><b>Полный экран</b><div class="note">Удобно для браузерной версии</div></div><button class="btn small" data-act="full">${icon('full')} Включить</button></div>
        </div>
        <div class="section"><div class="eyebrow">Сохранение</div><div class="card kv"><span>Формат</span><b>v${inf.version}</b><span>Хранилище</span><b>${inf.storage ? 'браузер (localStorage)' : 'недоступно — прогресс не сохранится'}</b><span>Размер</span><b>${(inf.size / 1024).toFixed(1)} КБ</b><span>Последнее сохранение</span><b>${new Date(inf.savedAt).toLocaleString('ru-RU')}</b></div>
          <div class="note">Прогресс хранится только в этом браузере. Рейтинговые результаты будут засчитываться сервером, а не клиентом.</div>
          <button class="btn danger block" data-act="reset">Сбросить весь прогресс</button></div>
        <div class="section"><div class="eyebrow">Достижения · ${Object.keys(p.achievements).length} / ${K.ACHIEVEMENTS.length}</div><div>${achs}</div></div>
      </div></div>`;
    },
    act: {
      sw(app, d) {
        const st = app.profile.settings;
        st[d.k] = !st[d.k];
        if (d.k === 'sound') K.Audio.setEnabled(st.sound);
        if (d.k === 'effects') app.applyFx();
        app.persist(); app.refresh();
      },
      q(app, d) { app.profile.settings.quality = d.id; app.persist(); app.refresh(); },
      theme(app, d) { if (app.profile.themes.includes(d.id)) { app.profile.settings.theme = d.id; app.persist(); app.applyFx(); app.refresh(); } },
      twLogin(app) {
        const r = K.Twitch.login();
        if (!r.ok) modal(`<div class="h2">Вход через Twitch</div><div class="banner">${esc(r.reason)}</div><div class="note">Как включить: зарегистрируйте приложение на dev.twitch.tv, укажите адрес страницы игры как OAuth Redirect URL и впишите Client ID в js/config.js. Подробности в README.</div><button class="btn block" data-m="close">Понятно</button>`, { close: () => closeModal() }, { center: true });
      },
      ggLogin(app) {
        const r = K.Google.login();
        if (!r.ok) modal(`<div class="h2">Вход через Google</div><div class="banner">${esc(r.reason)}</div><div class="note">Как включить: в Google Cloud Console создайте OAuth Client ID (веб-приложение), добавьте адрес игры в Authorized JavaScript origins и Authorized redirect URIs и укажите Client ID в переменной GOOGLE_CLIENT_ID на Cloudflare. Подробности в README.</div><button class="btn block" data-m="close">Понятно</button>`, { close: () => closeModal() }, { center: true });
      },
      ggLogout(app) { confirmBox('Отвязать Google от этого профиля?', 'Отвязать', () => { K.Google.logout(app.profile); app.persist(); app.refresh(); }); },
      twLogout(app) { confirmBox('Отвязать Twitch от этого профиля?', 'Отвязать', () => { K.Twitch.logout(app.profile); app.persist(); app.refresh(); }); },
      nick(app, d, b) {
        const scr = b.closest('.screen');
        const v = K.Profile.validNick(scr.querySelector('#nick').value);
        if (!v.ok) { scr.querySelector('#nickErr').textContent = v.reason; return; }
        app.profile.nick = v.value; app.persist(); toast('Никнейм сохранён', 'good'); app.refresh();
      },
      full() {
        const el = document.documentElement;
        if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return; }
        if (!el.requestFullscreen) { toast('Полноэкранный режим недоступен в этом окне', 'bad'); return; }
        el.requestFullscreen().catch(() => toast('Полноэкранный режим недоступен в этом окне', 'bad'));
      },
      reset(app) {
        confirmBox('Сбросить уровень, монеты, героев и достижения?', 'Сбросить', () => {
          const raw = JSON.stringify(app.profile);
          app.profile = K.Save.recover(raw);
          app.applySettings();
          toast('Прогресс сброшен. Резервная копия сохранена в браузере.', 'gold');
          app.go('menu');
        }, true);
      }
    }
  };

  // Обязательный вход через Twitch (включается в config.js)
  S.gate = {
    html(app) {
      return `<div class="screen"><div class="menu-bg"><canvas id="menuArt" aria-hidden="true"></canvas></div><div class="menu-main">
        <div class="h1" style="font-size:2em">Защити <b style="color:var(--pet)">микропета</b> от <em style="color:var(--blood);font-style:normal">ковтопа</em></div>
        <div class="banner">Чтобы играть, подтвердите аккаунт через Twitch или Google. Мы получаем только ник, почту и аватар — без доступа к каналу и письмам.</div>
        ${twitchBlock(app.profile)}${googleBlock(app.profile)}</div></div>`;
    },
    mount(el, app) { MenuArt.mount(el.querySelector('#menuArt'), app.profile.settings.effects, app.profile.settings.theme); },
    unmount() { MenuArt.unmount(); },
    act: { twLogin(app) { S.settings.act.twLogin(app); }, ggLogin(app) { S.settings.act.ggLogin(app); } }
  };

  // Восстановление повреждённого сохранения
  S.recovery = {
    html(app, params) {
      return `<div class="screen"><div class="scroll" style="display:flex;flex-direction:column;justify-content:center;gap:1em">
        <div class="h1" style="font-size:1.6em">Сохранение повреждено</div>
        <div class="banner">${esc(params.reason)}</div>
        <p class="note">Игра не будет запускаться с испорченными данными. Можно начать с чистого сохранения: старое останется в браузере как резервная копия, его можно скопировать для разбора.</p>
        <button class="btn brass block" data-act="fresh">Начать с нового сохранения</button>
        <button class="btn block" data-act="copy">Скопировать повреждённые данные</button>
      </div></div>`;
    },
    act: {
      fresh(app, d) { app.profile = K.Save.recover(app.session.brokenRaw); app.applySettings(); app.go('menu'); toast('Создано новое сохранение', 'good'); },
      copy(app) {
        const raw = app.session.brokenRaw || '';
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(raw).then(() => toast('Скопировано', 'good'), () => toast('Буфер обмена недоступен', 'bad'));
        else toast('Буфер обмена недоступен', 'bad');
      }
    }
  };

  // ---------- Приложение ----------
  const App = {
    session: { playOpen: false },
    cur: null, curName: null, params: null,
    // Сообщения сервера, относящиеся к лобби и подбору.
    netInit() {
      const N = K.Net, ses = this.session;
      const lobbyScreen = () => this.curName === 'team' || this.curName === 'duel';
      N.on('room', m => {
        ses.netRoom = m; ses.queued = false; ses.netErr = '';
        ses.countdownEnd = m.startsIn != null ? Date.now() + m.startsIn : null;
        ses.voteEnd = m.vote ? Date.now() + m.vote.endsIn : null;
        if (!lobbyScreen() && this.curName !== 'game') this.go(m.mode === 'duel' ? 'duel' : 'team'); else if (this.curName !== 'game') this.refresh();
        if (m.mode === 'team' && ses.inviteFor) { toast('Отправьте код ' + m.code + ' игроку ' + ses.inviteFor, 'gold'); ses.inviteFor = null; }
      });
      N.on('left', () => { ses.netRoom = null; if (lobbyScreen()) this.refresh(); });
      N.on('queued', m => { ses.queued = true; ses.queueSize = m.size; if (lobbyScreen()) this.refresh(); });
      N.on('unqueued', () => { ses.queued = false; if (lobbyScreen()) this.refresh(); });
      N.on('error', m => { ses.netErr = m.reason; toast(m.reason, 'bad'); if (lobbyScreen()) this.refresh(); });
      N.on('publics', m => { ses.publics = m; if (this.curName === 'team' && !(ses.netRoom && ses.netRoom.mode === 'team')) this.refresh(); });
      N.on('tag', m => { const p = this.profile; if (p.tag !== m.tag) toast('Ваш тег: #' + m.tag, 'gold'); p.tag = m.tag; p.tagVerified = true; this.persist(); if (this.curName === 'menu' || this.curName === 'settings') this.refresh(); });
      N.on('grant', m => {
        const p = this.profile, add = (m.heroes || []).filter(h => K.HERO[h] && !p.owned.includes(h));
        if (!add.length) return;
        p.owned.push(...add);
        const got = K.Profile.checkAchievements(p);
        this.persist();
        toast('Вам выданы все башни: ' + add.map(h => K.HERO[h].name).join(', '), 'gold');
        got.forEach(a => toast('Достижение: ' + a.name + ' · +' + a.coins, 'gold'));
        if (this.curName === 'shop' || this.curName === 'menu') this.refresh();
      });
      N.on('found', m => { ses.found = m; if (this.curName === 'friends') this.refresh(); });
      N.on('leaders', m => { ses.serverLeaders = m.rows; if (this.curName === 'leaders') this.refresh(); });
      N.on('authed', m => toast('Сервер подтвердил ' + (m.google ? 'Google' : 'Twitch') + ': ' + m.login, 'good'));
      N.on('start', m => { ses.netRoom = null; ses.queued = false; this.startMatch({ mode: m.mode, online: m, squad: m.squad }); if (m.diffName) toast('Сложность: ' + m.diffName, 'gold'); });
      N.on('close', () => { const had = ses.netRoom || ses.queued; ses.netRoom = null; ses.queued = false; if (had) { toast('Соединение с сервером закрыто', 'bad'); if (lobbyScreen()) this.refresh(); } });
    },
    init(root, render) {
      this.netInit();
      this.root = root;
      this.render = render;
      root.addEventListener('click', e => {
        const b = e.target.closest('[data-act]');
        if (!b || b.disabled || !this.cur || this.curName === 'game') return;
        K.Audio.unlock();
        const a = b.dataset.act;
        if (a === 'back') { K.Audio.play('click', 30); this.go(this.params && this.params.back ? this.params.back : 'menu'); return; }
        const h = this.cur.act && this.cur.act[a];
        if (h) { K.Audio.play('click', 30); h.call(this.cur, this, b.dataset, b, e); }
      });
    },
    go(name, params) {
      closeModal(true);
      if (this.match) { this.match.unmount(); this.match = null; }
      if (this.cur && this.cur.unmount) this.cur.unmount();
      this.curName = name; this.params = params || null;
      if (name === 'game') {
        this.cur = { act: {} };
        this.match = new K.Match(this, params);
        this.match.mount(this.root);
        return;
      }
      this.cur = S[name];
      this.root.innerHTML = this.cur.html(this, this.params || {});
      if (this.cur.mount) this.cur.mount(this.root.firstElementChild, this, this.params || {});
    },
    // Перерисовка текущего экрана с сохранением прокрутки.
    refresh(remount) {
      if (!this.cur || this.curName === 'game') return;
      const sc = this.root.querySelector('.scroll');
      const top = sc ? sc.scrollTop : 0;
      const codeInp = this.root.querySelector('#netCode'), codeVal = codeInp ? codeInp.value : '';
      if (remount) { this.go(this.curName, this.params); }
      else { this.root.innerHTML = this.cur.html(this, this.params || {}); if (this.cur.mount && this.curName !== 'team' && this.curName !== 'leaders') this.cur.mount(this.root.firstElementChild, this, this.params || {}); if (this.curName === 'team') S.team.mount(this.root.firstElementChild, this, {}); }
      const ci = this.root.querySelector('#netCode'); if (ci && codeVal) ci.value = codeVal;
      const sc2 = this.root.querySelector('.scroll');
      if (sc2) sc2.scrollTop = top;
    },
    startMatch(cfg) {
      if (!this.render) { toast('Холст недоступен в этом браузере', 'bad'); return; }
      if (K.CONFIG && K.CONFIG.requireTwitch && !this.profile.twitch && !this.profile.google) { this.go('gate'); return; }
      if (!cfg.squad || !cfg.squad.length) { toast('Соберите отряд хотя бы из одного героя', 'bad'); return; }
      this.go('game', cfg);
    },
    persist() {
      const ok = K.Save.save(this.profile);
      if (!ok && !this.warnedStorage) { this.warnedStorage = true; toast('Браузер не даёт сохранять: прогресс сохранится только до закрытия вкладки', 'bad'); }
    },
    applySettings() { K.Audio.setEnabled(this.profile.settings.sound); this.applyFx(); },
    applyFx() {
      const fr = document.getElementById('frame');
      fr.classList.toggle('no-fx', !this.profile.settings.effects);
      fr.classList.toggle('theme-mine', this.profile.settings.theme === 'mine');
    }
  };

  K.App = App;
  K.UIScreens = S;
})(globalThis.KV = globalThis.KV || {});
