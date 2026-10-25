/* Настройки развёртывания. Заполните перед публикацией на своём домене. */
globalThis.KV = globalThis.KV || {};
globalThis.KV.CONFIG = {
  // Client ID приложения из https://dev.twitch.tv/console/apps .
  // В приложении Twitch укажите OAuth Redirect URL — точный адрес страницы игры (https, без #).
  twitchClientId: '',
  // Client ID (тип «Веб-приложение») из Google Cloud Console → APIs & Services → Credentials.
  // В нём укажите Authorized JavaScript origin и Authorized redirect URI — адрес страницы игры.
  googleClientId: '',
  // true — играть можно только после входа через Twitch (для стрима-виджета)
  requireTwitch: false,
  // адрес игрового сервера, например 'wss://example.org/kv' (server/server.js)
  serverUrl: null
};
