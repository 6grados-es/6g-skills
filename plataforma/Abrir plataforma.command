#!/bin/bash
# Doble clic: arranca el puente de tu plataforma y la abre en el navegador. Cierra esta ventana para apagarla.
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Falta Node.js. Pídele a Claude: «instálame Node.js». Mientras, abre index.html con doble clic (solo para mirar)."
  read -r -p "Pulsa Intro para cerrar."; exit 1
fi
PUERTO="${PLATAFORMA_PUERTO:-4700}"
( sleep 1; open "http://localhost:$PUERTO" ) &
exec node servidor.mjs
