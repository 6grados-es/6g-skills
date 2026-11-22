@echo off
rem Doble clic: arranca el puente de tu plataforma y la abre en el navegador. Cierra esta ventana para apagarla.
cd /d "%~dp0"
where node >NUL 2>NUL || (echo Falta Node.js. Pidele a Claude: instalame Node.js & pause & exit /b 1)
start "" http://localhost:4700
node servidor.mjs
