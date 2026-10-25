#!/usr/bin/env bash
# Быстрая публичная ссылка через Cloudflare Tunnel: работает, пока этот компьютер включён.
# Нужны Node.js 18+ и cloudflared (https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/).
cd "$(dirname "$0")"
PORT=${PORT:-8787}
command -v node >/dev/null || { echo "Установите Node.js 18+: https://nodejs.org"; exit 1; }
command -v cloudflared >/dev/null || { echo "Установите cloudflared: macOS — brew install cloudflared; Linux — пакет cloudflared с сайта Cloudflare"; exit 1; }
PORT=$PORT node server/server.js &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
sleep 1
echo "Сейчас cloudflared покажет ссылку вида https://....trycloudflare.com — отправьте её игрокам."
cloudflared tunnel --no-autoupdate --url "http://localhost:$PORT"
