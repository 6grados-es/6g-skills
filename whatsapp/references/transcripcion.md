# Transcripción de audios y notas de voz

## Qué hace

`--transcribir` (en el lector) o `node transcribir.mjs <fichero>` convierte un audio a texto con Whisper. Es Node puro: no hace falta Python. El audio normal de WhatsApp (nota de voz, `.ogg/.opus`) se manda tal cual; si pesa más de ~24 MB o es de un formato que el servicio no acepta, se convierte a mp3 mono de 16 kHz y se trocea en tramos de 15 min, sumando el desfase de cada tramo a las marcas de tiempo. Eso necesita `ffmpeg`: `npm install` trae uno (`ffmpeg-static`); si no, instala el del sistema (Windows `winget install ffmpeg`) o apunta `FFMPEG_PATH`.

Si Whisper devuelve un tramo sin tildes («informaci», «la versi de c»), lo recorta y lo vuelve a pedir; si no mejora, deja el original.

## Motor y claves

Variable `TRANSCRIBIR_MOTOR`:

| Motor | Qué es | Clave |
|---|---|---|
| `groq` (por defecto) | Whisper large v3 en Groq | `GROQ_API_KEY` (varias separadas por comas: rotan ante un límite) |
| `openai` | Whisper de OpenAI | `OPENAI_API_KEY` |
| `compatible` | Cualquier servidor con la API de OpenAI, por ejemplo uno local que no saca el audio del ordenador | `TRANSCRIBIR_URL`, `TRANSCRIBIR_MODELO` y, si hace falta, `TRANSCRIBIR_API_KEY` |
| `ninguno` | No transcribe; solo se descargan los audios | — |

Otras: `TRANSCRIBIR_IDIOMA` (por defecto `es`; `--idioma` en la orden), `TRANSCRIBIR_MODELO`, `TRANSCRIBIR_LIMITE_BYTES`, `TRANSCRIBIR_TROZO_SEG`.

La clave se lee de la variable de entorno o, si no está, de `claves.env` en la carpeta de datos (`~/.whatsapp-skill/claves.env`, líneas `GROQ_API_KEY=gsk_...`). **Es la clave del propio usuario**; la skill no trae ninguna.

### Cómo conseguir la clave de Groq (gratis)

1. Entra en https://console.groq.com/keys e inicia sesión (vale una cuenta de Google).
2. «Create API Key», ponle un nombre y copia la clave (empieza por `gsk_`; solo se ve una vez).
3. Guárdala en tu ordenador, no en el chat:
   - Mac: `node instalar.mjs --clave-groq gsk_...` o añade `GROQ_API_KEY=gsk_...` a `~/.whatsapp-skill/claves.env`.
   - Windows (PowerShell): `node instalar.mjs --clave-groq gsk_...`, o `setx GROQ_API_KEY "gsk_..."` y reinicia Claude.
El plan gratuito tiene límites por minuto y por día; si se alcanzan, el código espera y reintenta, y si hay varias claves rota entre ellas.

## Sin clave

Salida 14: la lectura sale igual y los audios quedan descargados sin transcribir. Se dice claro y se ofrece conseguir la clave o dejarlo así.

## Privacidad (obligatorio decirlo)

Con `groq` y `openai`, **el audio se envía a ese servicio externo** para transcribirlo. Son voces y datos de terceros (para una gestoría, clientes). Antes de la primera transcripción de una persona, una frase al usuario («para transcribir, el audio se manda a Groq; ¿te parece bien?») y su sí. El lector lo deja escrito en la salida (`AUDIO ENVIADO A GROQ…`). Si no es aceptable para ciertos clientes, `TRANSCRIBIR_MOTOR=compatible` con un servidor local, o `ninguno`.

La transcripción es tan sensible como el audio: mismas reglas (carpeta temporal, no se copia a memoria ni a la nube).

## Calidad

Whisper falla en nombres propios, cifras, importes y fechas. En una nota de voz que sostiene una cifra o una instrucción, avisa de que es una transcripción automática y pide confirmación antes de actuar.
