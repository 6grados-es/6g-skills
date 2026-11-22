#!/bin/bash
# instalar.sh — baja la plataforma de 6 Grados (una web de una sola página) y la deja en una carpeta «Plataforma».
#
#   curl -fsSL https://raw.githubusercontent.com/6grados-es/6g-skills/main/plataforma/instalar.sh | bash
#
# Solo necesita curl y unzip. Pone «Plataforma» al lado de tu carpeta «Cerebro» si ya la tienes; si no, en Documentos.
# Nunca pisa una plataforma que ya exista (tus datos están en datos.js) y no toca ningún otro archivo tuyo.
# Al terminar escribe la ruta en la última línea: «PLATAFORMA=<ruta>».
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

if [ -f "$DEST/index.html" ]; then
  echo "  ✔ Ya tienes la plataforma, no la toco."
  echo "PLATAFORMA=$DEST"; exit 0
fi

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
curl -fsSL "$ZIP_URL" -o "$TMP/p.zip"
unzip -q "$TMP/p.zip" -d "$TMP"
ORIGEN="$(ls -d "$TMP"/*/plataforma | head -n1)"
[ -f "$ORIGEN/index.html" ] || { echo "  ✘ No encuentro la plataforma en la descarga." >&2; exit 1; }
mkdir -p "$DEST"
cp -R "$ORIGEN"/. "$DEST"/
rm -f "$DEST/instalar.sh"
chmod +x "$DEST/Abrir plataforma.command" 2>/dev/null || true
echo "  ✔ Plataforma instalada en: $DEST"
echo "PLATAFORMA=$DEST"
