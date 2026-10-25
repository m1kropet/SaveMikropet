/* Контроллер матча: игровой цикл, ввод, HUD, компактная панель прокачки, просмотр карты соперника, итоги.
   Одиночка, команда (общие деньги, цвет владельца) и дуэль с ботом под уровень игрока. */
(function (K) {
  'use strict';
  const fmtNum = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u2009');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtTime = s => { s = Math.max(0, Math.floor(s)); const m = Math.floor(s / 60); return (m < 10 ? '0' : '') + m + ':' + String(s % 60).padStart(2, '0'); };
  const pad4 = n => String(n).padStart(4, '0');

  const STAT_LABELS = [
    ['dmg', 'Урон', v => v.toFixed(v < 10 ? 1 : 0)],
    ['rate', 'Атак/с', v => v.toFixed(2)],
    ['range', 'Дальн.', v => v.toFixed(1)],
    ['dps', 'DPS', v => v.toFixed(0)],
    ['multi', 'Целей', v => v, v => v > 1],
    ['chain', 'Цепь', v => v, v => v > 0],
    ['splash', 'Взрыв', v => v.toFixed(1), v => v > 0],
    ['slow', 'Замедл.', v => Math.round(v * 100) + '%', v => v > 0],
    ['pierce', 'Пробив.', v => v, v => v > 0],
    ['critC', 'Крит', v => Math.round(v * 100) + '%', v => v > 0],
    ['freezeC', 'Заморозка', v => Math.round(v * 100) + '%', v => v > 0],
    ['stunC', 'Оглуш.', v => Math.round(v * 100) + '%', v => v > 0],
    ['burn', 'Горение', v => v + '/с', v => v > 0],
    ['income', 'Доход в начале волны', v => '+' + v, v => v > 0],
    ['interest', 'Проценты', v => Math.round(v * 100) + '%', v => v > 0],
    ['interestCap', 'До', v => v, v => v > 0],
    ['petMax', 'Жизни +', v => v, v => v > 0],
    ['heal', 'Лечение', v => '+' + v, v => v > 0],
    ['shield', 'Щит', v => v, v => v > 0],
    ['execute', 'Добивание', v => Math.round(v * 100) + '%', v => v > 0]
  ];
  const TARGETS = [['first', 'Первый'], ['last', 'Последний'], ['strong', 'Сильный'], ['close', 'Ближний']];

  class Match {
    constructor(app, cfg) {
      this.app = app;
      this.cfg = cfg;
      this.mode = cfg.mode;
      this.speed = 1;
      this.paused = false;
      this.finished = false;
      this.nonce = 0;
      this.view = 'me';
      this.ui = { placing: null, selected: null, tier: null, sellArm: false, ghost: null, player: 'p1', oppSel: null };
      this.seenTypes = new Set();
      this.dockSig = '';
      this.hudT = 0;
      this.announceT = 0;
      const seed = (Math.random() * 2 ** 31) >>> 0;
      this.online = cfg.online || null;
      if (this.online) {
        // Сетевой матч: поле на клиенте — копия, которую обновляет сервер.
        const o = this.online, RF = K.NetProto.RemoteField;
        this.cfg = Object.assign({}, cfg, { map: o.cfg.map, diff: o.mode === 'duel' ? 'duel' : o.cfg.diff, players: o.players, squad: o.squad });
        const send = c => K.Net.command(c);
        if (o.mode === 'duel') {
          const a = new RF({ map: o.cfg.map, diff: 'duel', seed: o.seed, mode: 'duel', squad: o.squad, players: o.players, me: o.you });
          const b = new RF({ map: o.cfg.map, diff: 'duel', seed: o.seed, mode: 'duel', squad: o.oppSquad, players: o.oppPlayers });
          a.send = send;
          this.duel = new K.NetProto.RemoteDuel(a, b);
          this.field = a;
          this.oppName = o.opp.name + ' · ур. ' + o.opp.level;
        } else {
          this.field = new RF({ map: o.cfg.map, diff: o.cfg.diff, seed: o.seed, mode: 'team', squad: o.squad, players: o.players, autoWave: o.cfg.autoWave, me: o.you });
          this.skipVotes = [[], 1];
          this.field.send = send;
        }
        this.ui.player = o.you;
        return;
      }
      if (this.mode === 'duel') {
        // Соперник-бот: уровень ±2 от игрока, тот же набор героев.
        const lvl = app.profile.level;
        const botLevel = Math.max(1, lvl + Math.round(Math.random() * 4 - 2));
        this.oppName = K.BOT_NAMES[Math.floor(Math.random() * K.BOT_NAMES.length)] + ' · ур. ' + botLevel;
        this.duel = new K.DuelMatch({ map: cfg.map, seed, squadA: cfg.squad, squadB: cfg.squad.slice(), recordB: true, playersB: [{ id: 'bot', name: this.oppName, color: '#ff6b6b' }] });
        this.field = this.duel.a;
        this.bot = new K.Bot(this.duel.b, K.botSkill(botLevel));
      } else {
        this.field = new K.Field({
          map: cfg.map, diff: cfg.diff, seed, mode: this.mode, squad: cfg.squad,
          players: cfg.players, autoWave: app.profile.settings.autoWave
        });
      }
      if (cfg.players) this.ui.player = cfg.players[0].id;
    }

    // Подписка на сообщения сервера в сетевом матче.
    listen() {
      const N = K.Net;
      this.offs = [
        N.on('state', m => {
          this.field.apply(m.me);
          if (m.sv) this.skipVotes = m.sv;
          if (this.duel) { this.duel.b.apply(m.opp); this.duel.apply(m.d); }
        }),
        N.on('ack', m => {
          if (!m.ok) { K.Audio.play('deny', 100); this.setHint(m.reason || 'Сервер отклонил действие'); return; }
          if (m.type === 'place' || m.type === 'upgrade' || m.type === 'skill') K.Audio.play('buy', 0);
          if (m.type === 'place' && m.tower) this.pendingSelect = m.tower;
          if (m.type === 'sell') { this.setHint('Продано: +' + m.refund + ' монет'); }
          if (m.type === 'skip') this.setHint('Ваш голос за пропуск учтён');
        }),
        N.on('over', m => {
          if (this.duel) { this.duel.over = true; this.duel.result = m.result; this.duel.reason = m.reason; }
          else { this.field.over = true; this.field.result = m.result || this.field.result; }
        }),
        N.on('close', () => {
          if (this.finished) return;
          this.finished = true;
          K.UI.modal('<div class="h2">Соединение с сервером потеряно</div><div class="note">Матч продолжается на сервере без вас. Награда за незавершённый матч не начисляется.</div><button class="btn brass block" data-m="menu">В меню</button>', { menu: () => { K.UI.closeModal(); this.app.go('menu'); } }, { center: true, locked: true });
        })
      ];
    }

    get shown() { return this.view === 'opp' ? this.duel.b : this.field; }

    // ---------- Разметка ----------
    mount(root) {
      const f = this.field, cfg = this.cfg;
      const modeName = this.mode === 'duel' ? 'Дуэль' : this.mode === 'team' ? 'Команда' : 'Одиночка';
      const diffName = this.mode === 'duel' ? 'против ' + this.oppName : K.DIFFS[cfg.diff].name;
      root.innerHTML = `
      <div class="screen game" id="game">
        <div class="hud">
          <div class="hud-row">
            <div class="hud-title"><b>${modeName}</b> · ${esc(diffName)} · ${esc(f.map.name)}</div>
            ${this.mode === 'duel' ? '<button class="btn small" data-act="view" id="viewBtn">Карта соперника</button>' : this.online ? '<span class="tag" title="Сетевой матч">онлайн</span>' : '<button class="btn small" data-act="speed" id="speedBtn" aria-label="Скорость игры">×1</button>'}
            ${this.duel ? '' : '<button class="btn small pet skip-top" data-act="skip" id="skipTop" hidden title="Следующая волна начнётся сразу">⏩ Пропуск</button>'}
            <button class="btn small icon-btn" data-act="pause" aria-label="Пауза">${K.UI.icon('pause')}</button>
          </div>
          ${this.mode === 'duel' ? `<div class="opp"><div class="side"><div class="eyebrow">Вы</div><div id="dA" class="num"></div></div><div class="timer" id="dT">00:00</div><div class="side bot"><div class="eyebrow">Соперник</div><div id="dB" class="num"></div><div class="st" id="dS"></div></div></div>` : ''}
          <div class="stats3">
            <div class="stat"><div class="eyebrow">Волна</div><div class="v"><span class="plaque" id="hWave">0000</span><span class="mute" id="hWaveOf"></span></div></div>
            <div class="stat hp" id="hHpBox"><div class="eyebrow">Микропет</div><div class="v" id="hHp"></div><div class="bar"><i id="hHpBar"></i></div></div>
            <div class="stat"><div class="eyebrow">${this.mode === 'team' ? 'Ваши монеты' : 'Монеты'}</div><div class="v coin mcoin" id="hCoins"></div></div>
          </div>
          ${this.mode === 'team' ? `<div class="players" id="players">${cfg.players.map(p => `<button class="pchip" ${this.online ? 'disabled' : 'data-act="player"'} data-id="${p.id}" style="color:${p.color}"><i style="background:${p.color}"></i>${esc(p.name)} <span class="num pcoins" data-coins="${p.id}"></span></button>`).join('')}</div>` : ''}
        </div>
        <div class="stage" id="stage">
          <div class="bossbar" id="bossBar" hidden><div class="bb-row"><b>Ковтоп</b><span class="eta" id="bossEta"></span><span class="num" id="bossHp"></span></div><div class="bar"><i id="bossFill"></i></div></div>
          <div class="viewing" id="viewing" hidden>Карта соперника · только просмотр</div>
          <div class="announce" id="announce"><div class="h2" id="annT"></div><div class="note" id="annS"></div></div>
          <div class="hint" id="hint"></div>
        </div>
        <div class="dock" id="dock"></div>
      </div>`;
      this.root = root.querySelector('#game');
      this.$ = id => this.root.querySelector('#' + id);
      const stage = this.$('stage');
      const R = this.app.render;
      stage.prepend(R.canvas);
      R.setQuality(this.app.profile.settings.quality, this.app.profile.settings.effects);
      R.build(f);
      this.ro = new ResizeObserver(() => { const r = stage.getBoundingClientRect(); R.resize(r.width, r.height); });
      this.ro.observe(stage);
      const r = stage.getBoundingClientRect(); R.resize(r.width, r.height);

      this.onClick = e => this.click(e);
      this.root.addEventListener('click', this.onClick);
      const cv = R.canvas;
      this.onDown = e => { K.Audio.unlock(); this.down = { x: e.clientX, y: e.clientY }; if (this.ui.placing) this.updateGhost(e); };
      this.onMove = e => { if (this.ui.placing && (e.pointerType === 'mouse' || this.down)) this.updateGhost(e); };
      this.onUp = e => {
        if (!this.down) return;
        const d = Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y);
        this.down = null;
        if (this.ui.placing) this.tryPlace(e); else if (d < 14) this.tap(e);
      };
      this.onLeave = () => { if (this.ui.placing && !this.down) this.ui.ghost = null; };
      cv.addEventListener('pointerdown', this.onDown);
      cv.addEventListener('pointermove', this.onMove);
      cv.addEventListener('pointerup', this.onUp);
      cv.addEventListener('pointerleave', this.onLeave);
      this.onVis = () => { if (document.hidden && !this.finished) this.pause(true); };
      document.addEventListener('visibilitychange', this.onVis);
      this.onKey = e => {
        if (e.key === 'Escape') { if (this.ui.placing || this.ui.selected) this.deselect(); else this.pause(!this.paused); }
        if (e.key === ' ' && !this.duel && !this.paused && (this.field.canStartWave() || this.field.canSkip())) { e.preventDefault(); this.command({ type: 'skip' }); }
      };
      window.addEventListener('keydown', this.onKey);

      if (this.online) this.listen();
      this.renderDock(true);
      this.updateHud();
      if (this.mode === 'duel') this.announce('Дуэль началась', 'Волны общие: следующая начнётся, когда оба отобьют текущую.');
      else this.setHint('Выберите героя внизу и коснитесь любого места рядом с дорогой. ' + (this.field.autoWave ? 'Волны пойдут сами.' : 'Затем начните волну.'), 6);
      this.last = performance.now();
      this.raf = requestAnimationFrame(t => this.loop(t));
    }

    unmount() {
      cancelAnimationFrame(this.raf);
      clearTimeout(this.resultTimer);
      clearTimeout(this.hintTimer);
      if (this.ro) this.ro.disconnect();
      const cv = this.app.render.canvas;
      cv.removeEventListener('pointerdown', this.onDown);
      cv.removeEventListener('pointermove', this.onMove);
      cv.removeEventListener('pointerup', this.onUp);
      cv.removeEventListener('pointerleave', this.onLeave);
      document.removeEventListener('visibilitychange', this.onVis);
      window.removeEventListener('keydown', this.onKey);
      if (this.root) this.root.removeEventListener('click', this.onClick);
      if (this.offs) this.offs.forEach(f => f());
      if (this.online) K.Net.send('leave');
      this.app.render.clear();
      if (cv.parentNode) cv.parentNode.removeChild(cv);
    }

    // ---------- Цикл ----------
    loop(ts) {
      this.raf = requestAnimationFrame(t => this.loop(t));
      const dt = Math.max(0, Math.min(0.1, (ts - this.last) / 1000));
      this.last = ts;
      const run = !this.paused && !this.finished;
      if (this.online) {
        this.field.smooth(dt);
        if (this.duel) this.duel.b.smooth(dt);
        if (this.pendingSelect && this.field.getTower(this.pendingSelect)) { this.select(this.pendingSelect); this.pendingSelect = null; }
      } else if (run) {
        if (this.duel) {
          this.acc = (this.acc || 0) + dt * this.speed;
          let n = 0;
          while (this.acc >= K.STEP && n < 12 && !this.duel.over) { this.bot.tick(K.STEP); this.duel.step(K.STEP); this.acc -= K.STEP; n++; }
          if (n >= 12) this.acc = 0;
        } else this.field.advance(dt, this.speed);
      }
      const mine = this.field.events.splice(0);
      const opp = this.duel ? this.duel.b.events.splice(0) : [];
      this.app.render.consume(this.view === 'opp' ? opp : mine);
      this.handle(mine);
      this.app.render.frame(this.shown, run ? dt * this.speed : 0, this.view === 'opp' ? { selected: this.ui.oppSel } : this.ui);
      this.hudT -= dt;
      if (this.hudT <= 0) { this.hudT = 0.1; this.updateHud(); this.renderDock(); }
      if (this.announceT > 0) { this.announceT -= dt; if (this.announceT <= 0) this.$('announce').classList.remove('show'); }
      const over = this.duel ? this.duel.over : this.field.over;
      if (over && !this.finished) this.finish();
    }

    handle(evs) {
      const A = K.Audio;
      for (const ev of evs) {
        switch (ev.t) {
          case 'shot': A.play(ev.tower.hero, ev.tower.hero === 'blaster' ? 70 : 90); break;
          case 'beam': A.play('prism', 120); break;
          case 'chain': A.play('storm', 100); break;
          case 'pulse': A.play('ice', 120); break;
          case 'die': A.play(ev.e.boss ? 'bossDie' : 'die', ev.e.boss ? 0 : 60); break;
          case 'leak': A.play('leak', 150); break;
          case 'wave':
            A.play(ev.boss ? 'boss' : 'wave');
            this.announce(ev.boss ? 'Ковтоп приближается' : 'Волна ' + ev.n, ev.boss ? 'На телевизоре — сколько секунд ему идти до микропета. Призывает Шмыгов и звереет на половине здоровья' : this.waveNote(ev.n));
            break;
          case 'waveClear': A.play('clear'); this.setHint('Волна ' + ev.n + ' отбита: +' + Math.ceil(ev.bonus / Math.max(1, this.field.players.length)) + ' монет'); break;
          case 'piggyTotal': A.play('buy', 200); this.setHint('Свинки принесли +' + ev.amount + ' монет'); break;
          case 'obstacle': this.setHint('Появилось препятствие: ' + K.OBSTACLES[ev.o.kind].name.toLowerCase() + '. Оно закрывает место и обзор башням.', 5); break;
          case 'spawn': this.noticeType(ev.e); break;
          case 'shield': this.setHint('Пушистый щит Свинки спас микропета!', 3); break;
          case 'enrage': this.setHint('Ковтоп в ярости: экран покраснел, скорость выросла!'); break;
        }
      }
    }

    waveNote(n) {
      const c = K.waveSummary(this.field.peekWave(n));
      return Object.keys(c).map(k => { const [t, g] = k.split('+'); return K.ENEMIES[t].name + (g ? ' (невидимая)' : '') + ' ×' + c[k]; }).slice(0, 4).join(' · ');
    }

    noticeType(e) {
      const key = e.type + (e.invisible ? '+i' : '');
      if (this.seenTypes.has(key)) return;
      this.seenTypes.add(key);
      const f = this.field;
      if (e.invisible && !f.towers.some(t => t.s.vision)) this.setHint('Невидимая сущность! Купите башне «Вижен» или поставьте Реалганера.', 6);
      else if (e.flying && !f.towers.some(t => t.s.aa)) this.setHint('Летающая сущность! Купите ПВО или поставьте Диномайка. Низкие препятствия летающих не закрывают.', 6);
      else if (e.type === 'armored') this.setHint('Глыба в броне: нужны пробивание или мощные выстрелы.', 5);
      else if (e.type === 'jumper') this.setHint('Прыгун делает рывок на участках с зелёными стрелками.', 5);
      else if (e.type === 'elite') this.setHint('Смотритель лечит соседей. Убейте его первым — цель «Сильный».', 5);
    }

    announce(t, s) {
      const a = this.$('announce');
      this.$('annT').textContent = t; this.$('annS').textContent = s || '';
      a.classList.toggle('boss', /Ковтоп/.test(t));
      a.classList.add('show');
      this.announceT = 2.6;
    }
    setHint(t, sec) {
      const h = this.$('hint');
      h.textContent = t;
      clearTimeout(this.hintTimer);
      this.hintTimer = setTimeout(() => { if (h.textContent === t) h.textContent = ''; }, (sec || 4) * 1000);
    }

    updateHud() {
      const f = this.field;
      this.$('hWave').textContent = pad4(f.waveNum);
      this.$('hWaveOf').textContent = isFinite(f.finalWave) ? ' / ' + f.finalWave : ' / ∞';
      this.$('hHp').textContent = f.hp + ' / ' + f.maxHp;
      this.$('hHpBar').style.width = (100 * f.hp / f.maxHp) + '%';
      this.$('hHpBox').classList.toggle('low', f.hp / f.maxHp <= 0.3);
      this.$('hCoins').textContent = Math.floor(this.wallet());
      if (this.mode === 'team') this.root.querySelectorAll('[data-coins]').forEach(el => { el.textContent = Math.floor(f.wallet(el.dataset.coins)); });
      if (this.duel) {
        const b = this.duel.b, w = this.duel.waiting();
        this.$('dA').textContent = 'В' + pad4(f.waveNum) + ' · ♥' + f.hp;
        this.$('dB').textContent = 'В' + pad4(b.waveNum) + ' · ♥' + b.hp;
        this.$('dS').textContent = b.hp <= 0 ? 'Микропет пал' : w === 'opp' ? 'Ещё отбивает волну' : w === 'me' ? 'Ждёт вас' : this.bot ? this.bot.lastAction : 'Строит оборону';
        this.$('dT').innerHTML = fmtTime(this.duel.time) + (this.duel.gap != null ? '<small>волна ' + (f.waveNum + 1) + ' через ' + Math.max(0, Math.ceil(this.duel.gap)) + ' с</small>' : w === 'opp' ? '<small>ждём соперника</small>' : '');
      }
      if (this.mode === 'team') this.root.querySelectorAll('.pchip').forEach(c => c.classList.toggle('on', c.dataset.id === this.ui.player));
      // здоровье боссов цифрами вверху поля
      const bosses = this.shown.enemies.filter(e => e.boss && !e.dead && e.hp > 0), bb = this.$('bossBar');
      if (bb) {
        bb.hidden = !bosses.length;
        if (bosses.length) {
          const hp = bosses.reduce((a, e) => a + Math.max(0, Math.ceil(e.hp)), 0), mx = bosses.reduce((a, e) => a + e.maxHp, 0);
          this.$('bossHp').textContent = fmtNum(hp) + ' / ' + fmtNum(Math.ceil(mx)) + (bosses.length > 1 ? ' · ×' + bosses.length : '');
          const eta = Math.min(...bosses.map(e => e.eta == null ? Infinity : e.eta));
          this.$('bossEta').textContent = isFinite(eta) ? 'дойдёт через ' + Math.ceil(eta) + ' с' : '';
          this.$('bossFill').style.width = (100 * hp / mx) + '%';
          bb.classList.toggle('rage', bosses.some(e => e.enraged));
        }
      }
      // пропуск волны — рядом с паузой
      const st = this.$('skipTop');
      if (st) {
        const sv = this.online && this.skipVotes ? this.skipVotes : null, voted = sv && sv[0].includes(this.ui.player);
        st.hidden = !(f.active.length && f.canSkip());
        st.disabled = !!voted;
        st.innerHTML = '⏩ Пропуск' + (sv && sv[1] > 1 ? ' ' + sv[0].length + '/' + sv[1] : '');
      }
    }

    // ---------- Ввод ----------
    local(e) { const r = this.app.render.canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    updateGhost(e) {
      const p = this.local(e), w = this.app.render.toWorld(p.x, p.y);
      const can = this.field.canPlace(w.x, w.z);
      const owner = this.field.players.find(pl => pl.id === this.ui.player);
      this.ui.ghost = { hero: this.ui.placing, x: w.x, z: w.z, ok: can.ok, reason: can.reason, color: owner ? owner.color : '#45e0c0' };
    }
    tryPlace(e) {
      this.updateGhost(e);
      const g = this.ui.ghost;
      const hit = this.app.render.pick(this.local(e).x, this.local(e).y, this.field);
      if (hit.type === 'tower' && !g.ok) { this.select(hit.id); return; }
      if (!g.ok) { K.Audio.play('deny', 100); this.setHint(g.reason); return; }
      const r = this.command({ type: 'place', hero: this.ui.placing, x: g.x, z: g.z, owner: this.ui.player });
      if (r.ok && !r.pending) { K.Audio.play('buy', 0); this.select(r.tower.id); }
    }
    tap(e) {
      const p = this.local(e);
      const hit = this.app.render.pick(p.x, p.y, this.shown);
      if (this.view === 'opp') { this.ui.oppSel = hit.type === 'tower' ? hit.id : null; this.renderDock(true); return; }
      if (hit.type === 'tower') this.select(hit.id);
      else { if (this.ui.selected == null) this.setHint('Выберите героя на панели внизу, затем коснитесь места рядом с дорогой'); this.deselect(); }
    }
    select(id) { Object.assign(this.ui, { selected: id, placing: null, ghost: null, tier: null, sellArm: false }); this.renderDock(true); }
    deselect() { Object.assign(this.ui, { selected: null, placing: null, ghost: null, tier: null, sellArm: false }); this.renderDock(true); }

    wallet() { return this.field.wallet(this.ui.player); }
    command(c) {
      c.nonce = ++this.nonce;
      if (!this.online) c.owner = this.ui.player;
      const r = this.field.cmd(c);
      if (!r.ok && !r.dup) { K.Audio.play('deny', 100); this.setHint(r.reason); }
      if (r.pending) { this.ui.ghost = null; if (c.type === 'place') this.ui.placing = null; }
      this.renderDock(true);
      return r;
    }

    click(e) {
      const b = e.target.closest('[data-act]');
      if (!b || b.disabled) return;
      K.Audio.unlock();
      const a = b.dataset.act, f = this.field;
      if (a !== 'tier') K.Audio.play('click', 30);
      switch (a) {
        case 'pause': this.pause(true); break;
        case 'speed': this.speed = this.speed === 1 ? 2 : 1; b.textContent = '×' + this.speed; break;
        case 'view': this.toggleView(); break;
        case 'wave': case 'skip': this.command({ type: 'skip' }); break;
        case 'hero': {
          const id = b.dataset.id;
          if (this.ui.placing === id) { this.deselect(); break; }
          Object.assign(this.ui, { selected: null, placing: id, tier: null, ghost: null });
          this.setHint(this.wallet() < K.HERO[id].cost ? 'Не хватает монет: нужно ' + K.HERO[id].cost : 'Коснитесь места для «' + K.HERO[id].name + '». Можно вести пальцем — покажется зона обзора.', 5);
          this.renderDock(true);
          break;
        }
        case 'cancel': case 'close': this.deselect(); break;
        case 'oppClose': this.ui.oppSel = null; this.renderDock(true); break;
        case 'oppTower': this.ui.oppSel = +b.dataset.id; this.renderDock(true); break;
        case 'tier': this.ui.tier = { br: +b.dataset.br, lvl: +b.dataset.lvl }; this.renderDock(true); break;
        case 'buy': {
          const t = f.getTower(this.ui.selected);
          if (!t || !this.ui.tier) break;
          b.disabled = true;
          const br = this.ui.tier.br;
          const r = this.command({ type: 'upgrade', tower: t.id, branch: br });
          if (r.pending) { this.ui.tier = t.up[br] + 1 < 5 ? { br, lvl: t.up[br] + 1 } : { br, lvl: 4 }; this.renderDock(true); break; }
          if (r.ok) {
            K.Audio.play('buy', 0);
            // выбор остаётся на этой ветке: следующий уровень, если он доступен
            this.ui.tier = t.up[br] < 5 && K.upgradeState(t.hero, t.up, br, null).ok ? { br, lvl: t.up[br] } : { br, lvl: t.up[br] - 1 };
            this.renderDock(true);
          }
          break;
        }
        case 'skill': {
          const t = f.getTower(this.ui.selected);
          if (!t) break;
          b.disabled = true;
          const k = b.dataset.k;
          if (this.command({ type: 'skill', tower: t.id, skill: k }).ok) {
            K.Audio.play('buy', 0);
            this.setHint(k === 'vision' ? 'Вижен: башня видит Миражей и невидимых Лампадок и Смотрителей в радиусе.' : 'ПВО: башня атакует Лампадок и других летающих.', 5);
          }
          break;
        }
        case 'target': {
          const t = f.getTower(this.ui.selected);
          if (!t) break;
          const i = TARGETS.findIndex(x => x[0] === t.targeting);
          this.command({ type: 'target', tower: t.id, mode: TARGETS[(i + 1) % TARGETS.length][0] });
          break;
        }
        case 'sell': this.ui.sellArm = true; this.renderDock(true); break;
        case 'sellYes': {
          const t = f.getTower(this.ui.selected);
          if (!t) break;
          b.disabled = true;
          const r = this.command({ type: 'sell', tower: t.id });
          if (r.pending) { this.deselect(); break; }
          if (r.ok) { K.Audio.play('piggy', 0); this.setHint('Продано: +' + r.refund + ' монет'); this.deselect(); }
          break;
        }
        case 'player': this.ui.player = b.dataset.id; this.updateHud(); break;
      }
    }

    toggleView() {
      this.view = this.view === 'me' ? 'opp' : 'me';
      if (this.online) K.Net.send('view', { opp: this.view === 'opp' });
      this.deselect(); this.ui.oppSel = null;
      this.app.render.build(this.shown);
      const r = this.$('stage').getBoundingClientRect(); this.app.render.resize(r.width, r.height);
      this.$('viewBtn').textContent = this.view === 'opp' ? 'Моя карта' : 'Карта соперника';
      this.$('viewing').hidden = this.view !== 'opp';
      this.renderDock(true);
    }

    // ---------- Док ----------
    renderDock(force) {
      const f = this.field, ui = this.ui;
      let sig;
      if (this.view === 'opp') {
        const b = this.duel.b;
        sig = 'O' + ui.oppSel + b.towers.map(t => t.id + t.up.join('') + t.skills.vision + t.skills.aa).join(',');
      } else {
        const t = ui.selected != null ? f.getTower(ui.selected) : null;
        if (ui.selected != null && !t) ui.selected = null;
        if (t) {
          const aff = [0, 1].map(br => K.upgradeState(t.hero, t.up, br, this.wallet()).ok ? 1 : 0).join('') + ['vision', 'aa'].map(k => this.wallet() >= K.SKILLS[k].cost ? 1 : 0).join('');
          sig = 'T' + t.id + t.up.join('') + t.skills.vision + t.skills.aa + t.targeting + JSON.stringify(ui.tier) + ui.sellArm + aff + f.over;
        } else {
          const gap = this.duel ? (this.duel.gap == null ? 'w' + this.duel.waiting() : Math.ceil(this.duel.gap)) : '';
          sig = 'B' + ui.placing + f.squad.map(h => this.wallet() >= K.HERO[h].cost ? 1 : 0).join('') + f.canStartWave() + f.canSkip() + f.waveNum + f.active.length + (f.autoTimer > 0 ? Math.ceil(f.autoTimer) : '') + gap + f.over + JSON.stringify(this.skipVotes || '');
        }
      }
      if (!force && sig === this.dockSig) return;
      this.dockSig = sig;
      const dock = this.$('dock');
      if (this.view === 'opp') dock.innerHTML = this.oppPanel();
      else {
        const t = ui.selected != null ? f.getTower(ui.selected) : null;
        // в команде чужие башни можно только посмотреть
        const foreign = t && f.players.length > 1 && t.owner !== ui.player;
        dock.innerHTML = t ? this.towerPanel(t, foreign ? 'foreign' : false) : this.buildBar();
      }
    }

    buildBar() {
      const f = this.field, ui = this.ui;
      const slots = [];
      for (let i = 0; i < 4; i++) {
        const id = f.squad[i];
        if (!id) { slots.push('<div class="hbtn empty"></div>'); continue; }
        const H = K.HERO[id];
        slots.push(`<button class="hbtn ${ui.placing === id ? 'on' : ''} ${this.wallet() < H.cost ? 'poor' : ''}" data-act="hero" data-id="${id}" aria-pressed="${ui.placing === id}">
          <span class="hero-thumb" style="background-image:url(${K.thumbs[id] || ''})"></span>
          <span class="nm">${esc(H.name)}</span><span class="num coin mcoin" style="font-size:.78em">${H.cost}</span></button>`);
      }
      let waveBtn = '';
      // в дуэли волны идут сами, а номер волны уже есть в верхней панели — кнопка не нужна
      if (this.duel) waveBtn = '';
      else {
        // онлайн: пропуск по голосам (1–2 игрока — 1 голос, 3–4 — 2 голоса)
        const sv = this.online && this.skipVotes ? this.skipVotes : null;
        const voted = sv && sv[0].includes(ui.player);
        const votes = sv && sv[1] > 1 ? ` · ${sv[0].length}/${sv[1]}` : '';
        if (f.canStartWave() || (!f.active.length && f.canSkip())) waveBtn = `<button class="btn brass" data-act="skip" ${voted ? 'disabled' : ''}>${f.autoWave && f.autoTimer > 0 ? 'Волна ' + (f.waveNum + 1) + ' · авто ' + Math.ceil(f.autoTimer) + ' с' : 'Начать волну ' + (f.waveNum + 1)}${votes}</button>`;
        else if (f.active.length) waveBtn = `<button class="btn" disabled>Идёт волна ${f.waveNum}</button>`;
        else waveBtn = '<button class="btn" disabled>Волн больше нет</button>';
      }
      const ctrl = waveBtn || ui.placing ? `<div class="ctrl">${waveBtn}${ui.placing ? '<button class="btn" data-act="cancel">Отмена</button>' : ''}</div>` : '';
      return `<div class="build">${slots.join('')}</div>${ctrl}`;
    }

    // Компактная панель прокачки. readOnly: 'opp' — башня соперника в дуэли, 'foreign' — башня товарища.
    towerPanel(t, readOnly) {
      if (readOnly === true) readOnly = 'opp';
      const f = readOnly === 'opp' ? this.duel.b : this.field, H = K.HERO[t.hero], ui = this.ui;
      const coins = readOnly ? 0 : this.wallet(), passive = !!t.s.passive;
      const owner = f.players.find(p => p.id === t.owner);
      const lvl = t.up[0] + t.up[1];
      const PASSIVE = ['income', 'interest', 'interestCap', 'petMax', 'heal', 'shield'];
      const chips = STAT_LABELS.filter(s => passive ? PASSIVE.includes(s[0]) && (!s[3] || s[3](t.s[s[0]])) : !PASSIVE.slice(1).includes(s[0]) && (!s[3] || s[3](t.s[s[0]]))).slice(0, 6).map(s => `<span><i>${s[1]}</i> ${s[2](t.s[s[0]])}</span>`).join('');
      const skill = k => {
        const S = K.SKILLS[k], ic = K.UI.icon(k === 'vision' ? 'eye' : 'radar');
        if (H.base[k] || t.skills[k]) return `<button class="btn mini pet" disabled>${ic} ${S.name}${H.base[k] ? '' : ' ✓'}</button>`;
        if (readOnly) return `<button class="btn mini" disabled>${ic} нет</button>`;
        return `<button class="btn mini" data-act="skill" data-k="${k}" ${coins < S.cost ? 'disabled' : ''}>${ic} ${S.name} <span class="num">${S.cost}</span></button>`;
      };
      const row = br => {
        const list = br === 0 ? H.top : H.bottom;
        const st = K.upgradeState(t.hero, t.up, br, null);
        const locked = !st.ok && st.code === 'locked';
        return `<div class="branch"><span class="lbl">${br === 0 ? 'Верх' : 'Низ'}${locked ? ' ' + K.UI.icon('lock') : ''}</span>${list.map((u, i) => {
          const owned = i < t.up[br], next = i === t.up[br] && st.ok, can = next && !readOnly && coins >= u.cost;
          const sel = !readOnly && ui.tier && ui.tier.br === br && ui.tier.lvl === i;
          return `<button class="tier ${owned ? 'owned b' + br : ''} ${next ? 'next' : ''} ${can ? 'can' : ''} ${!owned && !next ? 'locked' : ''} ${sel ? 'sel' : ''}" ${readOnly ? 'disabled' : `data-act="tier" data-br="${br}" data-lvl="${i}"`} aria-label="${esc(u.name)}" title="${esc(u.name)}">${K.UI.icon(u.icon)}<span class="c">${owned ? '✓' : u.cost}</span></button>`;
        }).join('')}</div>`;
      };
      let detail = '';
      if (!readOnly) {
        if (ui.tier) {
          const { br, lvl: L } = ui.tier;
          const u = (br === 0 ? H.top : H.bottom)[L];
          const owned = L < t.up[br];
          const st = K.upgradeState(t.hero, t.up, br, coins);
          let action = '', note = '';
          if (owned) note = '<span class="tag">куплено</span>';
          else if (L > t.up[br]) note = `<span class="tag lock">сначала ур. ${t.up[br] + 1}</span>`;
          else if (!st.ok && st.code !== 'money') note = `<span class="tag lock">${K.UI.icon('lock')} ${esc(st.reason)}</span>`;
          else {
            action = `<button class="btn brass mini" data-act="buy" ${st.ok ? '' : 'disabled'}>Купить <span class="num">${u.cost}</span></button>`;
            if (st.ok && st.note) note = `<span class="tag demo">${esc(st.note)}</span>`;
          }
          let diffs = '';
          if (!owned && L === t.up[br] && (st.ok || st.code === 'money')) {
            const up = t.up.slice(); up[br]++;
            const after = K.towerStats(t.hero, up, t.skills);
            diffs = STAT_LABELS.filter(s => !(s[0] === 'dps' && passive) && Math.abs((after[s[0]] || 0) - (t.s[s[0]] || 0)) > 1e-6).map(s => `<span class="${after[s[0]] > t.s[s[0]] ? 'up' : 'dn'}">${s[1]} ${s[2](t.s[s[0]])}→${s[2](after[s[0]])}</span>`).join('');
            if (after.aoeAll && !t.s.aoeAll) diffs += '<span class="up">бьёт всех в радиусе</span>';
          }
          detail = `<div class="detail"><div class="row"><b class="grow">${br === 0 ? 'Верх' : 'Низ'} ${L + 1}: ${esc(u.name)}</b>${action}</div><div class="note">${esc(u.desc)}</div>${diffs ? `<div class="diffs">${diffs}</div>` : ''}${note ? '<div>' + note + '</div>' : ''}</div>`;
        } else if (passive) detail = '<div class="note small-note">Свинка не атакует. Верхняя ветка бережёт микропета, нижняя приносит больше монет. Уровни 1–2 доступны в обеих ветках всегда.</div>';
        else detail = '<div class="note small-note">Нажмите на улучшение, чтобы выбрать его. Уровни 1–2 доступны в обеих ветках всегда. Выше 2-го можно прокачать только одну ветку.</div>';
      }
      const refund = Math.floor(t.spent * K.SELL_RATE);
      const target = TARGETS.find(x => x[0] === t.targeting)[1];
      return `<div class="panel compact">
        <div class="ph"><span class="hero-thumb" style="background-image:url(${K.thumbs[t.hero] || ''})"></span>
          <div class="grow" style="min-width:0"><b>${esc(H.name)}</b> <span class="mute">ур. ${lvl}${owner && f.players.length > 1 ? ' · <span style="color:' + owner.color + '">' + esc(owner.name) + '</span>' : ''}</span><div class="chipline">${chips}</div></div>
          <button class="btn small icon-btn" data-act="${readOnly === 'opp' ? 'oppClose' : 'close'}" aria-label="Закрыть">${K.UI.icon('x')}</button></div>
        <div class="tools">${passive ? `<span class="tag">Доход идёт ${t.owner === ui.player || !readOnly ? 'вам' : 'владельцу'}</span>` : skill('vision') + skill('aa') + (readOnly ? `<button class="btn mini" disabled>Цель: ${target}</button>` : `<button class="btn mini" data-act="target" title="Сменить приоритет цели">Цель: ${target}</button>`)}
          ${readOnly ? '' : ui.sellArm ? `<button class="btn mini danger" data-act="sellYes">Точно? +${refund}</button>` : `<button class="btn mini ghost" data-act="sell">Продать +${refund}</button>`}</div>
        ${row(0)}${row(1)}${readOnly === 'foreign' ? '<div class="note small-note">Это башня товарища: улучшать и продавать её может только он.</div>' : detail}</div>`;
    }

    oppPanel() {
      const b = this.duel.b;
      const t = this.ui.oppSel != null ? b.getTower(this.ui.oppSel) : null;
      if (t) return this.towerPanel(t, 'opp');
      const list = b.towers.length ? b.towers.map(x => `<button class="opp-t" data-act="oppTower" data-id="${x.id}"><span class="hero-thumb" style="background-image:url(${K.thumbs[x.hero] || ''})"></span><span>${esc(K.HERO[x.hero].name)}</span><span class="num">${x.up[0]}/${x.up[1]}${x.s.vision ? ' · В' : ''}${x.s.aa ? ' · ПВО' : ''}</span></button>`).join('') : '<div class="note">Соперник ещё ничего не построил.</div>';
      return `<div class="panel compact"><div class="row"><b class="grow">Башни соперника · ${b.towers.length}</b><span class="num coin mcoin">${Math.floor(b.coins)}</span></div>
        <div class="opp-list">${list}</div>
        <div class="note small-note">Коснитесь башни на карте или в списке, чтобы увидеть её прокачку. Цифры — уровни верхней/нижней ветки.</div>
        <button class="btn block" data-act="view">Вернуться к своей карте</button></div>`;
    }

    // ---------- Пауза и итоги ----------
    // Пауза и настройки игры. Онлайн время не останавливается — окно только с настройками.
    pause(on) {
      if (this.finished) return;
      if (!on) { this.paused = false; K.UI.closeModal(); return; }
      if (!this.online) this.paused = true;
      const st = this.app.profile.settings, f = this.field;
      const sw = (key, label, sub) => `<div class="toggle"><div><b>${label}</b>${sub ? `<div class="note">${sub}</div>` : ''}</div><button class="switch" role="switch" aria-checked="${!!st[key]}" data-m="sw" data-k="${key}" aria-label="${label}"></button></div>`;
      const canAuto = !this.online && !this.duel;
      const html = `<div class="h2">${this.online ? 'Меню матча' : 'Пауза'}</div>
        ${this.online ? '<div class="note">Сетевой матч не останавливается: время идёт на сервере для всех игроков.</div>' : ''}
        <div class="kv"><span>Волна</span><b>${f.waveNum}</b><span>Уничтожено</span><b>${f.kills}</b><span>Время</span><b>${fmtTime(this.duel ? this.duel.time : f.time)}</b></div>
        <div class="eyebrow">Настройки игры</div>
        <div>
          ${canAuto ? sw('autoWave', 'Автозапуск волн', 'Следующая волна начнётся через 3 с после предыдущей') : ''}
          ${!this.online && !this.duel ? `<div class="toggle"><b>Скорость игры</b><div class="seg" style="min-width:8em">${[1, 2].map(v => `<button class="${this.speed === v ? 'on' : ''}" data-m="speed" data-v="${v}">×${v}</button>`).join('')}</div></div>` : ''}
          ${sw('sound', 'Звук')}
          ${sw('effects', 'Дополнительные эффекты', 'Мерцание ламп, тени и частицы')}
          <div class="toggle"><b>Качество</b><div class="seg" style="min-width:11em">${[['low', 'Низкое'], ['mid', 'Среднее'], ['high', 'Высокое']].map(([k, n]) => `<button class="${st.quality === k ? 'on' : ''}" data-m="q" data-id="${k}">${n}</button>`).join('')}</div></div>
        </div>
        <button class="btn brass block" data-m="resume">${this.online ? 'Вернуться в игру' : 'Продолжить'}</button>
        ${this.online ? '' : '<button class="btn block" data-m="restart">Начать заново</button>'}
        <button class="btn danger block" data-m="quit">${this.online ? 'Покинуть матч' : 'Выйти в меню'}</button>
        <div class="note">${this.online ? (this.duel ? 'Если выйти из дуэли, засчитается поражение.' : 'Ваши башни останутся у команды.') : 'При выходе или перезапуске незавершённый матч не приносит наград.'}</div>`;
      const again = () => this.pause(true);
      K.UI.modal(html, {
        resume: () => this.pause(false),
        restart: () => { K.UI.closeModal(); this.app.startMatch(this.cfg); },
        quit: () => { K.UI.closeModal(); this.app.go('menu'); },
        sw: b => {
          const k = b.dataset.k;
          st[k] = !st[k];
          if (k === 'autoWave') { f.autoWave = st.autoWave; f.autoTimer = -1; }
          if (k === 'sound') K.Audio.setEnabled(st.sound);
          if (k === 'effects') { this.app.applyFx(); this.app.render.setQuality(st.quality, st.effects); }
          this.app.persist(); again();
        },
        speed: b => { this.speed = +b.dataset.v; const sb = this.$('speedBtn'); if (sb) sb.textContent = '×' + this.speed; again(); },
        q: b => { st.quality = b.dataset.id; this.app.render.setQuality(st.quality, st.effects); this.app.persist(); again(); }
      }, { center: true, onClose: () => { this.paused = false; } });
    }

    finish() {
      this.finished = true;
      const f = this.field;
      let result = f.result, reason = '';
      if (this.duel) { result = this.duel.result; reason = this.duel.reason; }
      const m = { field: f, mode: this.mode, duelResult: this.duel ? result : null, oppName: this.oppName, duration: this.duel ? this.duel.time : f.time };
      const rew = K.Profile.applyMatch(this.app.profile, m);
      this.app.persist();
      K.Audio.play(result === 'win' ? 'win' : result === 'lose' ? 'lose' : 'clear', 0);
      this.resultTimer = setTimeout(() => this.showResult(result, reason, rew), 1100);
    }

    showResult(result, reason, rew) {
      const f = this.field;
      const title = result === 'win' ? 'Победа' : result === 'lose' ? 'Поражение' : 'Ничья';
      const endless = f.diffKey === 'endless';
      const rows = [
        ['Достигнутая волна', endless || this.duel ? f.wavesCleared + ' пройдено' : f.waveNum + ' / ' + f.finalWave],
        ['Уничтожено врагов', f.kills],
        ['Монет заработано в матче', Math.floor(f.earned)],
        ['Продолжительность', fmtTime(this.duel ? this.duel.time : f.time)]
      ];
      if (this.duel) rows.splice(1, 0, ['Соперник', this.oppName + ': ' + this.duel.b.wavesCleared + ' волн, ♥' + this.duel.b.hp]);
      const ach = rew.achievements.map(a => `<div class="row"><span class="tag demo">Достижение</span><span class="grow">${esc(a.name)}</span><span class="num coin">+${a.coins}</span></div>`).join('');
      K.UI.modal(`<div class="result-title ${result}">${title}</div>
        ${reason ? `<div class="note" style="text-align:center">${esc(reason)}</div>` : ''}
        ${endless ? '<div class="note" style="text-align:center">Бесконечный режим: рекорд ' + this.app.profile.endless.best + ' волн</div>' : ''}
        <div class="kv">${rows.map(r => `<span>${r[0]}</span><b>${esc(r[1])}</b>`).join('')}</div>
        <div class="card row"><span class="grow">Награда на аккаунт</span><b class="num coin">+${rew.coins}</b><b class="num">+${rew.xp} опыта</b></div>
        ${rew.levelUps ? `<div class="banner">Новый уровень аккаунта: ${this.app.profile.level}. Бонус +${15 * rew.levelUps} монет.</div>` : ''}
        ${rew.unlockedEndless ? '<div class="banner">Открыт бесконечный режим! Кнопка «???» в выборе сложности теперь доступна.</div>' : ''}
        ${ach}
        <button class="btn brass block" data-m="again">${this.online ? 'Новый онлайн-матч' : 'Ещё раз'}</button>
        <button class="btn block" data-m="menu">В меню</button>`, {
        again: () => { K.UI.closeModal(); if (this.online) this.app.go(this.mode === 'duel' ? 'duel' : 'team'); else this.app.startMatch(this.cfg); },
        menu: () => { K.UI.closeModal(); this.app.go('menu'); }
      }, { center: true, locked: true });
    }
  }

  K.Match = Match;
})(globalThis.KV = globalThis.KV || {});
