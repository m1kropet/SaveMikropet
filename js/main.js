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
      if (r.error) { K.UI.toast('Google: ' + r.error, 'bad'); return; }
      App.persist();
      K.UI.toast('Google подтверждён: ' + (r.user.email || r.user.name), 'good');
      if (K.Net.state === 'open') K.Net.hello();
      App.go('menu');
    });
    // возврат со страницы входа Twitch
    K.Twitch.handleReturn(App.profile).then(r => {
      if (!r) return;
      if (r.error) { K.UI.toast('Twitch: ' + r.error, 'bad'); return; }
      App.persist();
      K.UI.toast('Twitch подтверждён: ' + r.user.display, 'good');
      App.go('menu');
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
