/* Запуск: загрузка сохранения, создание 3D-мира, превью героев, учёт времени игры, адаптивный размер. */
(function (K) {
  'use strict';
  const App = K.App;
  const frame = document.getElementById('frame');
  const root = document.getElementById('root');

  function fitFont() {
    const w = frame.getBoundingClientRect().width;
    frame.style.setProperty('--fs', Math.max(12, Math.min(34, w / 28)) + 'px');
  }
  new ResizeObserver(fitFont).observe(frame);
  fitFont();

  K.thumbs = {};
  K.HEROES.forEach(h => { try { K.thumbs[h.id] = K.Sprites.heroIcon(h.id, 128); } catch (e) { K.thumbs[h.id] = ''; } });

  let render = null;
  try {
    const cv = document.createElement('canvas');
    cv.setAttribute('aria-label', 'Игровое поле');
    if (cv.getContext('2d')) render = new K.Render2D(cv);
  } catch (e) { render = null; }

  App.init(root, render);

  const loaded = K.Save.load();
  if (loaded.corrupt) {
    App.profile = K.Save.defaults();
    App.session.brokenRaw = loaded.raw;
    App.go('recovery', { reason: loaded.reason });
  } else {
    App.profile = loaded.data;
    App.applySettings();
    const needGate = () => K.CONFIG && K.CONFIG.requireTwitch && !App.profile.twitch && !App.profile.google;
    App.go(needGate() ? 'gate' : 'menu');
    if (!loaded.storage) K.UI.toast('Хранилище браузера недоступно: прогресс не сохранится после закрытия', 'bad');
    else if (loaded.migrated) K.UI.toast('Сохранение обновлено до новой версии', 'good');
    App.persist();
    // возврат со страницы входа Google (проверяется первым: свой state)
    K.Google.handleReturn(App.profile).then(r => {
      if (!r) return;
      if (r.error) { App.go('profile'); K.UI.modal('<div class="h2">Вход через Google не удался</div><div class="banner">' + K.UI.esc(r.error) + '</div><button class="btn block" data-m="close">Понятно</button>', { close: () => K.UI.closeModal() }, { center: true }); return; }
      App.persist();
      App.go('profile');
      K.UI.modal('<div class="h2">Google подтверждён</div><div class="banner">Аккаунт <b>' + K.UI.esc(r.user.email || r.user.name) + '</b> привязан к профилю. Рядом с уровнем — значок «G».</div><button class="btn brass block" data-m="close">Отлично</button>', { close: () => K.UI.closeModal() }, { center: true });
      if (K.Net.state === 'open') K.Net.hello(); else if (K.Net.available()) K.Net.connect(App.profile).catch(() => {});
    });
    // возврат со страницы входа Twitch
    K.Twitch.handleReturn(App.profile).then(r => {
      if (!r) return;
      if (r.error) { App.go('profile'); K.UI.modal('<div class="h2">Вход через Twitch не удался</div><div class="banner">' + K.UI.esc(r.error) + '</div><button class="btn block" data-m="close">Понятно</button>', { close: () => K.UI.closeModal() }, { center: true }); return; }
      App.persist();
      App.go('profile');
      K.UI.modal('<div class="h2">Twitch подтверждён</div><div class="banner">Аккаунт <b>' + K.UI.esc(r.user.display) + '</b> привязан к профилю. Ник в игре теперь как на Twitch, рядом с уровнем — фиолетовая галочка.</div><button class="btn brass block" data-m="close">Отлично</button>', { close: () => K.UI.closeModal() }, { center: true });
      // токен появился уже после фонового подключения — сообщаем серверу, чтобы он тоже подтвердил вход
      if (K.Net.state === 'open') K.Net.hello(); else if (K.Net.available()) K.Net.connect(App.profile).catch(() => {});
    });
  }
  // фоновое подключение к серверу: подтверждение тега и подарки по тегу (если сервер есть)
  if (!loaded.corrupt && K.Net.available()) setTimeout(() => { K.Net.connect(App.profile).catch(() => {}); }, 800);
  if (!render) K.UI.toast('Браузер не поддерживает Canvas: матчи не запустятся', 'bad');

  // Учёт времени в игре: только пока вкладка видима.
  let lastTick = performance.now(), sinceSave = 0;
  setInterval(() => {
    const now = performance.now();
    const dt = Math.min(5, (now - lastTick) / 1000);
    lastTick = now;
    if (document.hidden || !App.profile || App.curName === 'recovery') return;
    App.profile.playTime += dt;
    sinceSave += dt;
    if (sinceSave >= 15) {
      sinceSave = 0;
      const got = K.Profile.checkAchievements(App.profile);
      got.forEach(a => K.UI.toast('Достижение: ' + a.name, 'gold'));
      App.persist();
    }
  }, 1000);
  window.addEventListener('pagehide', () => { if (App.profile && App.curName !== 'recovery') K.Save.save(App.profile); });
})(globalThis.KV = globalThis.KV || {});
