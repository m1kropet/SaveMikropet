/* Вход через Google (OpenID Connect, implicit flow с id_token — без серверных секретов).
   1) Перенаправляем на accounts.google.com с одноразовыми state и nonce.
   2) Google возвращает id_token (JWT) в #фрагменте адреса — проверяем state.
   3) Проверяем токен: через tokeninfo Google, плюс сами сверяем client_id, срок и nonce.
   Токен хранится только в sessionStorage; игровой сервер проверяет его заново сам. */
(function (K) {
  'use strict';
  const STATE_KEY = 'kv.google.state', NONCE_KEY = 'kv.google.nonce', TOKEN_KEY = 'kv.google.token';
  const cfg = () => K.CONFIG || {};
  const ss = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* */ } },
    del(k) { try { sessionStorage.removeItem(k); } catch (e) { /* */ } }
  };
  const rand = () => { const b = new Uint8Array(16); crypto.getRandomValues(b); return Array.from(b, x => x.toString(16).padStart(2, '0')).join(''); };

  function redirectUri(loc) { loc = loc || location; return loc.origin + loc.pathname; }

  function status(loc) {
    loc = loc || location;
    if (!cfg().googleClientId) return { ok: false, reason: 'Вход через Google не настроен: на сервере не указан GOOGLE_CLIENT_ID.' };
    const secure = loc.protocol === 'https:' || /^(localhost|127\.0\.0\.1)$/.test(loc.hostname);
    if (!secure) return { ok: false, reason: 'Google принимает вход только на https-адресе или localhost.' };
    if (window.top !== window.self) return { ok: false, reason: 'Страница открыта во встроенном окне: Google не показывает вход внутри iframe. Откройте игру в отдельной вкладке.' };
    return { ok: true };
  }

  function authUrl(state, nonce) {
    const p = new URLSearchParams({
      client_id: cfg().googleClientId, redirect_uri: redirectUri(), response_type: 'id_token',
      scope: 'openid email profile', state, nonce, prompt: 'select_account'
    });
    return 'https://accounts.google.com/o/oauth2/v2/auth?' + p.toString();
  }

  function login() {
    const st = status();
    if (!st.ok) return st;
    const state = rand(), nonce = rand();
    ss.set(STATE_KEY, state); ss.set(NONCE_KEY, nonce);
    location.assign(authUrl(state, nonce));
    return { ok: true };
  }

  // Разбор возврата. null — ответ не от Google (например, это возврат с Twitch).
  function readRedirect(hash, savedState) {
    if (!hash || hash.length < 2 || !savedState) return null;
    const p = new URLSearchParams(hash.slice(1));
    if (p.get('state') !== savedState) return null;
    if (p.get('error')) return { error: p.get('error_description') || p.get('error') };
    if (!p.get('id_token')) return null;
    return { token: p.get('id_token') };
  }

  function decode(jwt) {
    const part = String(jwt).split('.')[1] || '';
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((part.length + 3) % 4);
    const bin = atob(b64), bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  function checkClaims(c, nonce) {
    if (!c || !c.sub) throw new Error('Ответ Google не распознан');
    if (c.aud !== cfg().googleClientId) throw new Error('Токен выдан другому приложению');
    if (!/^(https:\/\/)?accounts\.google\.com$/.test(c.iss || '')) throw new Error('Токен выдан не Google');
    if ((+c.exp || 0) * 1000 < Date.now()) throw new Error('Срок входа истёк, попробуйте ещё раз');
    if (nonce != null && c.nonce !== nonce) throw new Error('Ответ Google не прошёл проверку (nonce)');
    if (c.email && String(c.email_verified) !== 'true') throw new Error('Почта Google не подтверждена');
  }

  async function verify(token, nonce, fetchFn) {
    const F = fetchFn || fetch;
    let claims = decode(token);
    try {
      const r = await F('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token));
      if (!r.ok) throw new Error('Google отклонил вход');
      claims = Object.assign({}, claims, await r.json());
    } catch (e) {
      if (e.message === 'Google отклонил вход') throw e;
      // нет связи с tokeninfo — достаточно проверки полей; сервер всё равно проверит токен у Google
    }
    checkClaims(claims, nonce);
    return { id: String(claims.sub), email: String(claims.email || ''), name: String(claims.name || claims.email || 'Google'), avatar: /^https:\/\//.test(claims.picture || '') ? claims.picture : '', verifiedAt: Date.now() };
  }

  async function handleReturn(profile) {
    const r = readRedirect(location.hash, ss.get(STATE_KEY));
    if (!r) return null;
    const nonce = ss.get(NONCE_KEY);
    ss.del(STATE_KEY); ss.del(NONCE_KEY);
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* */ }
    if (r.error) return { error: r.error };
    try {
      const user = await verify(r.token, nonce);
      ss.set(TOKEN_KEY, r.token);
      profile.google = user;
      return { user };
    } catch (e) { return { error: e.message }; }
  }

  function logout(profile) { ss.del(TOKEN_KEY); profile.google = null; }

  K.Google = { status, login, logout, handleReturn, readRedirect, verify, decode, checkClaims, authUrl, redirectUri, token: () => ss.get(TOKEN_KEY) };
})(globalThis.KV = globalThis.KV || {});
