# Códigos de salida y qué decir

El lector (`leer-chat.mjs`) imprime `CODIGO: n` y lo deja también en `codigo.txt` junto a la salida.

| Código | Significa | Qué se dice al usuario |
|---|---|---|
| 0 | Hecho | Lo leído, con cabecera y citas. |
| 2 | Error de uso | Nada; se corrige la orden. No se abrió ninguna sesión. |
| 3 | Timeout global | Un reintento tras esperar. Si repite, salida barata. |
| 4 | La página de WhatsApp Web nunca quedó usable | Un reintento. Puede ser red lenta o que WhatsApp Web esté cambiando. |
| 5 | No se pudo leer el chat | Un reintento. Si repite, salida barata. |
| 6 | Chat no encontrado | «No he encontrado a X entre N chats; la sincronización estaba (completa / a medias).» Con a medias no se dice «no existe». |
| 7 | Varios chats (o varias personas guardadas) casan | Lista y pregunta cuál, con tu recomendación. Nunca se elige solo. |
| 8 | `--bajar`: ningún adjunto casa con el filtro | Se amplía la ventana (N mayor, `--desde`, `--todo`) o se cambia `--tipo`/`--fichero`. No es «no existe»: puede ser más viejo que la ventana. |
| 9 | `--bajar`: había adjuntos y no se bajó ninguno | Suele ser un archivo caducado en los servidores de WhatsApp o un tope de tamaño; se da el motivo de cada `✗`. Si sale `AVISO: … NO traen id`, WhatsApp Web ha cambiado el formato y hay que revisar `idDe()` del lector. |
| 10 | Sesión no vinculada o no válida | «Tu WhatsApp no está enlazado (o se desenlazó). No lo reenlazo por mi cuenta: escanear un QR de más puede desincronizarte WhatsApp. Si quieres, lo vemos con calma.» Nunca QR, nunca restaurar copias. |
| 11 | Falta el Chrome de puppeteer | Se repone con `npx puppeteer browsers install chrome` en `scripts/`; no toca la sesión. |
| 12 | La sesión la usa otro proceso | Se espera a que acabe y se repite. Si no hay otro proceso real y el bloqueo es viejo, el código lo retira solo; si persiste, mira `sesion.lock` en la carpeta de datos (no lo borres a ciegas). |
| 14 | `--transcribir` sin clave | «Los audios quedan descargados sin transcribir. Con una clave gratuita de Groq se transcriben.» |
| 15 | Falló alguna transcripción | Se citan los `✗` con su motivo (clave rechazada, sin ffmpeg, servicio caído). |

`vincular.mjs`: 0 vinculado · 1 error al arrancar · 2 WhatsApp rechazó la sesión · 3 no se escaneó a tiempo · 10 ya hay sesión (no hace nada) · 11 falta Chrome · 12 sesión en uso.
`transcribir.mjs`: 0 · 2 uso · 14 sin clave · 15 fallo.
`personas.mjs`: 0 · 2 uso · 6 ninguna · 7 varias.
