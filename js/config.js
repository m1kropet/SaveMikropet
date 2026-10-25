/* Настройки развёртывания. Заполните перед публикацией на своём домене. */
globalThis.KV = globalThis.KV || {};
globalThis.KV.CONFIG = {
  // Client ID приложения из https://dev.twitch.tv/console/apps .
  // В приложении Twitch укажите OAuth Redirect URL — точный адрес страницы игры (https, без #).
  twitchClientId: '',
  // true — играть можно только после входа через Twitch (для стрима-виджета)
  requireTwitch: false,
  // адрес игрового сервера, например 'wss://example.org/kv' (server/server.js)
  serverUrl: null
};
