@echo off
chcp 65001 >nul
rem Быстрая публичная ссылка через Cloudflare Tunnel: работает, пока этот компьютер включён.
rem Нужны Node.js 18+ (https://nodejs.org) и cloudflared: winget install --id Cloudflare.cloudflared
cd /d "%~dp0"
where node >nul 2>nul || (echo Установите Node.js 18+: https://nodejs.org & pause & exit /b 1)
where cloudflared >nul 2>nul || (echo Установите cloudflared: winget install --id Cloudflare.cloudflared & pause & exit /b 1)
start "Сервер микропета" /min cmd /c "node server\server.js"
timeout /t 2 >nul
echo Сейчас cloudflared покажет ссылку вида https://....trycloudflare.com — отправьте её игрокам.
cloudflared tunnel --no-autoupdate --url http://localhost:8787
