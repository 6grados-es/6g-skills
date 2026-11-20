#!/bin/bash
# instalar-mac.sh — instala el cerebro de 6 Grados en un Mac. No necesita git ni Node: solo curl y unzip, que ya trae macOS.
#
#   curl -fsSL https://raw.githubusercontent.com/6grados-es/6g-skills/main/cerebro/instalar-mac.sh | bash
#   bash instalar-mac.sh --destino <carpeta>     pone «Cerebro» dentro de esa carpeta (también: CEREBRO_DESTINO=<carpeta>)
#
# Baja la plantilla de https://github.com/6grados-es/cerebro-simple y la copia como carpeta «Cerebro» dentro de la nube
# que ya uses (iCloud Drive, Google Drive u OneDrive) o, si no hay ninguna, en Documentos.
# Nunca pisa un cerebro que ya exista y no lee, mueve ni borra ningún otro archivo tuyo.
set -euo pipefail

ZIP_URL="https://github.com/6grados-es/cerebro-simple/archive/refs/heads/main.zip"
NOMBRE="Cerebro"
ok()    { printf '  ✔ %s\n' "$1"; }
mal()   { printf '  ✘ %s\n' "$1" >&2; }
aviso() { printf '  ! %s\n' "$1"; }

echo "==> Cerebro de 6 Grados · instalador de Mac"

if [ "$(uname -s)" != "Darwin" ]; then
  mal "Este instalador es para Mac. En Windows abre PowerShell y pega:"
  echo "      irm https://raw.githubusercontent.com/6grados-es/6g-skills/main/cerebro/instalar-windows.ps1 | iex"
  exit 1
fi

DESTINO="${CEREBRO_DESTINO:-}"
while [ $# -gt 0 ]; do
  case "$1" in
    --destino) DESTINO="${2:-}"; shift 2 ;;
    *) mal "No entiendo «$1». Uso: bash instalar-mac.sh [--destino <carpeta>]"; exit 1 ;;
  esac
done

# 1. Dónde va la carpeta: la nube que ya esté sincronizada en este Mac; si no hay, Documentos.
if [ -z "$DESTINO" ]; then
  nombres=(); rutas=()
  icloud="$HOME/Library/Mobile Documents/com~apple~CloudDocs"
  [ -d "$icloud" ] && { nombres+=("iCloud Drive"); rutas+=("$icloud"); }
  for g in "$HOME/Library/CloudStorage"/GoogleDrive-*; do
    [ -d "$g" ] || continue
    for u in "Mi unidad" "My Drive"; do
      [ -d "$g/$u" ] && { nombres+=("Google Drive (${g##*GoogleDrive-})"); rutas+=("$g/$u"); break; }
    done
  done
  for o in "$HOME/Library/CloudStorage"/OneDrive*; do
    [ -d "$o" ] && { nombres+=("OneDrive (${o##*/})"); rutas+=("$o"); }
  done

  if [ ${#rutas[@]} -eq 0 ]; then
    DESTINO="$HOME/Documents"
    aviso "No he encontrado ninguna nube sincronizada (iCloud Drive, Google Drive, OneDrive): va a Documentos."
    aviso "Ahí no tiene copia de seguridad: cuando tengas una nube, mueve la carpeta dentro."
  elif [ ${#rutas[@]} -eq 1 ]; then
    DESTINO="${rutas[0]}"; ok "Nube encontrada: ${nombres[0]}"
  else
    # Ya hay un cerebro en alguna de ellas: esa manda.
    for i in "${!rutas[@]}"; do
      [ -f "${rutas[$i]}/$NOMBRE/CLAUDE.md" ] && DESTINO="${rutas[$i]}"
    done
    if [ -z "$DESTINO" ]; then
      echo "  Tienes varias nubes. ¿En cuál pongo la carpeta «$NOMBRE»?"
      for i in "${!rutas[@]}"; do echo "    $((i + 1)). ${nombres[$i]}"; done
      eleccion=""
      if { true < /dev/tty; } 2>/dev/null; then
        printf '  Escribe el número y pulsa Intro [1]: '
        read -r eleccion < /dev/tty || eleccion=""
      fi
      case "$eleccion" in ''|*[!0-9]*) eleccion=1 ;; esac
      { [ "$eleccion" -ge 1 ] && [ "$eleccion" -le ${#rutas[@]} ]; } || eleccion=1
      DESTINO="${rutas[$((eleccion - 1))]}"
      ok "Va a: ${nombres[$((eleccion - 1))]} (para otra: --destino <carpeta>)"
    fi
  fi
fi

if [ ! -d "$DESTINO" ]; then mal "No existe la carpeta $DESTINO"; exit 1; fi
CEREBRO="$DESTINO/$NOMBRE"

# 2. Nunca se pisa un cerebro que ya existe.
if [ -f "$CEREBRO/CLAUDE.md" ]; then
  ok "Ya tienes un cerebro en: $CEREBRO"
  echo "  No he tocado nada. Ábrelo en la pestaña Code de la app de Claude y sigue usándolo."
  exit 0
fi
if [ -e "$CEREBRO" ] && [ -n "$(ls -A "$CEREBRO" 2>/dev/null)" ]; then
  mal "Ya existe $CEREBRO y tiene cosas dentro que no son un cerebro. No la toco."
  echo "  Cámbiale el nombre a esa carpeta, o elige otro sitio con: --destino <carpeta>"
  exit 1
fi

# 3. Bajar la plantilla y copiarla (también la carpeta oculta .claude).
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
echo "  Bajando la plantilla…"
if ! curl -fsSL "$ZIP_URL" -o "$TMP/cerebro.zip"; then
  mal "No he podido bajar la plantilla. Mira si tienes internet y repite."; exit 1
fi
unzip -q "$TMP/cerebro.zip" -d "$TMP"
PLANTILLA="$(find "$TMP" -maxdepth 2 -type d -name plantilla | head -1)"
if [ -z "$PLANTILLA" ] || [ ! -f "$PLANTILLA/CLAUDE.md" ]; then
  mal "El zip no trae la carpeta «plantilla». Avisa a 6 Grados (hola@6grados.es)."; exit 1
fi
find "$PLANTILLA" -name __pycache__ -type d -prune -exec rm -rf {} +
mkdir -p "$CEREBRO"
cp -R "$PLANTILLA"/. "$CEREBRO"/

# 4. Comprobar.
falta=0
for f in CLAUDE.md INDICE.md fichas/yo.md .claude/skills/instalar-cerebro/SKILL.md; do
  [ -f "$CEREBRO/$f" ] || { mal "Falta $f"; falta=1; }
done
[ "$falta" -eq 0 ] || { mal "La copia ha quedado a medias en $CEREBRO. Borra esa carpeta y repite."; exit 1; }
ok "Cerebro instalado en: $CEREBRO"

# 5. Python: lo usa «Instala mi cerebro» para leer tus chats antiguos.
if python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)' >/dev/null 2>&1; then
  ok "Python 3 está instalado"
else
  aviso "No encuentro Python 3. Hace falta para leer tus chats antiguos: https://www.python.org/downloads/"
fi

cat <<FIN

Siguientes pasos:
  1. Abre la app de Claude y entra en la pestaña «Code».
  2. Elige como carpeta de trabajo: $CEREBRO
     y déjala por defecto. Modelo: Sonnet o superior.
  3. En un chat nuevo escribe: Instala mi cerebro
     Te explicará cómo pedir la exportación de tus chats de Claude y los leerá para llenarlo.
FIN
