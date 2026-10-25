/* Вход через Twitch (OAuth 2.0, implicit grant для браузерных приложений).
   1) Перенаправляем на id.twitch.tv с одноразовым state.
   2) Twitch возвращает access_token в #фрагменте адреса — проверяем state.
   3) Проверяем токен через /oauth2/validate и получаем профиль из Helix /users.
   Токен хранится только в sessionStorage; сервер повторно проверяет его сам. */
(function (K) {
  'use strict';
  const STATE_KEY = 'kv.twitch.state', TOKEN_KEY = 'kv.twitch.token';
  const cfg = () => K.CONFIG || {};
  const ss = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* */ } },
    del(k) { try { sessionStorage.removeItem(k); } catch (e) { /* */ } }
  };

  function redirectUri(loc) { loc = loc || location; return loc.origin + loc.pathname; }

  function status(loc) {
    loc = loc || location;
    if (!cfg().twitchClientId) return { ok: false, reason: 'Вход через Twitch не настроен: укажите Client ID в js/config.js.' };
    const secure = loc.protocol === 'https:' || /^(localhost|127\.0\.0\.1)$/.test(loc.hostname);
    if (!secure) return { ok: false, reason: 'Twitch принимает вход только на https-адресе или localhost.' };
    if (window.top !== window.self) return { ok: false, reason: 'Страница открыта во встроенном окне: Twitch не показывает вход внутри iframe. Откройте игру в отдельной вкладке.' };
    return { ok: true };
  }

  function authUrl(state) {
    const p = new URLSearchParams({ client_id: cfg().twitchClientId, redirect_uri: redirectUri(), response_type: 'token', scope: '', state, force_verify: 'false' });
    return 'https://id.twitch.tv/oauth2/authorize?' + p.toString();
  }

  function login() {
    const st = status();
    if (!st.ok) return st;
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const state = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    ss.set(STATE_KEY, state);
    location.assign(authUrl(state));
    return { ok: true };
  }

  // Разбор возврата с Twitch. Возвращает null, если в адресе нет ответа OAuth.
  function readRedirect(hash, savedState) {
    if (!hash || hash.length < 2) return null;
    const p = new URLSearchParams(hash.slice(1));
    if (!p.has('access_token') && !p.has('error')) return null;
    if (p.get('error')) return { error: p.get('error_description') || p.get('error') };
    if (!savedState || p.get('state') !== savedState) return { error: 'Ответ Twitch не прошёл проверку (state). Попробуйте войти ещё раз.' };
    return { token: p.get('access_token') };
  }

  async function verify(token, fetchFn) {
    const F = fetchFn || fetch;
    const v = await F('https://id.twitch.tv/oauth2/validate', { headers: { Authorization: 'OAuth ' + token } });
    if (!v.ok) throw new Error('Twitch отклонил токен');
    const info = await v.json();
    if (cfg().twitchClientId && info.client_id !== cfg().twitchClientId) throw new Error('Токен выдан другому приложению');
    let user = { id: info.user_id, login: info.login, display: info.login, avatar: '' };
    try {
      const u = await F('https://api.twitch.tv/helix/users?id=' + encodeURIComponent(info.user_id), { headers: { Authorization: 'Bearer ' + token, 'Client-Id': cfg().twitchClientId } });
      if (u.ok) { const d = (await u.json()).data[0]; if (d) user = { id: d.id, login: d.login, display: d.display_name, avatar: d.profile_image_url }; }
    } catch (e) { /* профиль необязателен: логин уже подтверждён */ }
    return Object.assign(user, { verifiedAt: Date.now(), expiresIn: info.expires_in });
  }

  // Вызывается при запуске: если пришли с Twitch — подтверждаем и привязываем аккаунт.
  async function handleReturn(profile) {
    const r = readRedirect(location.hash, ss.get(STATE_KEY));
    if (!r) return null;
    ss.del(STATE_KEY);
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* */ }
    if (r.error) return { error: r.error };
    try {
      const user = await verify(r.token);
      ss.set(TOKEN_KEY, r.token);
      profile.twitch = user;
      profile.nick = user.display.slice(0, 16);
      return { user };
    } catch (e) { return { error: e.message }; }
  }

  function logout(profile) {
    const tok = ss.get(TOKEN_KEY);
    if (tok && cfg().twitchClientId) {
      fetch('https://id.twitch.tv/oauth2/revoke', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'client_id=' + encodeURIComponent(cfg().twitchClientId) + '&token=' + encodeURIComponent(tok) }).catch(() => {});
    }
    ss.del(TOKEN_KEY);
    profile.twitch = null;
  }

  K.Twitch = { status, login, logout, handleReturn, readRedirect, verify, authUrl, redirectUri, token: () => ss.get(TOKEN_KEY) };
})(globalThis.KV = globalThis.KV || {});
