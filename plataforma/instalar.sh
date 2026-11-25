#!/bin/bash
# instalar.sh — baja la plataforma de 6 Grados (una web de una sola página) y la deja en una carpeta «Plataforma».
#
#   curl -fsSL https://raw.githubusercontent.com/6grados-es/6g-skills/main/plataforma/instalar.sh | bash
#
# Solo necesita curl y unzip. Pone «Plataforma» al lado de tu carpeta «Cerebro» si ya la tienes; si no, en Documentos.
# Nunca pisa una plataforma que ya exista (tus datos están en datos.js) y no toca ningún otro archivo tuyo.
# Al terminar escribe la ruta en la última línea: «PLATAFORMA=<ruta>».
#
# Para poner al día una plataforma que ya tienes (nuevo index.html, servidor.mjs…, sin tocar tus datos):
#   curl -fsSL https://raw.githubusercontent.com/6grados-es/6g-skills/main/plataforma/instalar.sh | PLATAFORMA_ACTUALIZAR=1 bash
# (si no está donde la buscaría el instalador, añade PLATAFORMA_DESTINO=<carpeta que la contiene>).
set -euo pipefail
ZIP_URL="https://github.com/6grados-es/6g-skills/archive/refs/heads/main.zip"

if [ -n "${PLATAFORMA_DESTINO:-}" ]; then PADRE="$PLATAFORMA_DESTINO"
else
  PADRE="$HOME/Documents"
  for c in "$HOME/Library/Mobile Documents/com~apple~CloudDocs" "$HOME/Library/CloudStorage"/GoogleDrive-*/"Mi unidad" "$HOME/Library/CloudStorage"/GoogleDrive-*/"My Drive" "$HOME/Library/CloudStorage"/OneDrive* "$HOME/Documents" "$HOME/Documentos"; do
    [ -f "$c/Cerebro/CLAUDE.md" ] && { PADRE="$c"; break; }
  done
fi
DEST="$PADRE/Plataforma"

# Si ya hay una en ~/Plataforma (como la monta la variante publicada en Vercel), es esa.
[ -z "${PLATAFORMA_DESTINO:-}" ] && [ ! -f "$DEST/index.html" ] && [ -f "$HOME/Plataforma/index.html" ] && DEST="$HOME/Plataforma"

if [ -f "$DEST/index.html" ] && [ -z "${PLATAFORMA_ACTUALIZAR:-}" ]; then
  echo "  ✔ Ya tienes la plataforma, no la toco. (Para ponerla al día sin tocar tus datos: PLATAFORMA_ACTUALIZAR=1)"
  echo "PLATAFORMA=$DEST"; exit 0
fi

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
curl -fsSL "$ZIP_URL" -o "$TMP/p.zip"
unzip -q "$TMP/p.zip" -d "$TMP"
ORIGEN="$(ls -d "$TMP"/*/plataforma | head -n1)"
[ -f "$ORIGEN/index.html" ] || { echo "  ✘ No encuentro la plataforma en la descarga." >&2; exit 1; }

if [ -f "$DEST/index.html" ]; then
  # Poner al día: solo los ficheros de la plantilla. datos.js, cambios.json y lo que hayas añadido no se tocan.
  for f in index.html servidor.mjs INSTRUCCIONES.md README.md "Abrir plataforma.command" "Abrir plataforma.bat"; do
    cp "$ORIGEN/$f" "$DEST/$f"
  done
  mkdir -p "$DEST/marcas" && cp -R "$ORIGEN/marcas"/. "$DEST/marcas"/ 2>/dev/null || true
  chmod +x "$DEST/Abrir plataforma.command" 2>/dev/null || true
  echo "  ✔ Plataforma puesta al día (tus datos siguen igual): $DEST"
  echo "PLATAFORMA=$DEST"; exit 0
fi
mkdir -p "$DEST"
cp -R "$ORIGEN"/. "$DEST"/
rm -f "$DEST/instalar.sh"
chmod +x "$DEST/Abrir plataforma.command" 2>/dev/null || true
echo "  ✔ Plataforma instalada en: $DEST"
echo "PLATAFORMA=$DEST"
