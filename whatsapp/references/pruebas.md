# Qué está probado y qué no

Probado con tests automáticos (`node --test tests/<fichero>.test.mjs`, de uno en uno; Node 26 falla si se le pasa la carpeta):

- Resolución de nombres y de números (`+34`, `0034`, 9 cifras, otros prefijos, trozos de cifras), grupos, ambigüedad (no elige), contactos sin chat, @lid y @c.us.
- Personas frecuentes: guardar, actualizar, alias, buscar, varias coincidencias, fichero roto (no se pisa), línea de comandos.
- Adjuntos: tipos, alias, filtro por nombre, recorte a los más recientes, ids que faltan, nombres peligrosos, no pisar ficheros.
- Bloqueo de sesión (tomar, negar, retirar uno huérfano, respetar el de otro proceso vivo) y errores de uso (salen con 2 sin abrir nada), salida 10 sin sesión (sin QR), salida 12 con la sesión tomada, borrado de temporales, `vincular.mjs` que se niega con sesión.
- Transcripción con `fetch` simulado: forma de la petición, rotación de claves ante 429, espera con `retry-after`, clave rechazada, sin clave (no llama a nada), troceo con desfases y reparación de tramos sin tildes, sobre audios generados con ffmpeg (un tono).
- Enlace del borrador (codificación).
- Real y sin cuenta: `vincular.mjs --solo-qr` en una carpeta de datos nueva (Mac) saca el QR y termina sin vincular nada; una llamada a Groq con una clave falsa devuelve 401 (la petición llega; no hay bloqueo de Cloudflare).

NO probado contra WhatsApp real ni en Windows (no se podía sin arriesgar una cuenta ni tener una máquina Windows):

- La vinculación con un móvil, la lectura en vivo, la descarga real de adjuntos y la lectura de un grupo real de punta a punta (la lógica está heredada de un lector que sí funcionó en Mac con una sesión real, pero esta versión reorganizada no se ha lanzado contra ninguna).
- `--todo` con chats de miles de mensajes y su tope de páginas.
- Windows: instalación (`instalar.mjs`), apertura del PNG del QR con `explorer.exe`, `Start-Process` del borrador, Chrome de puppeteer, `ffmpeg-static`, junctions de `npm install` para la librería local. El código evita lo exclusivo de Unix (usa `path`, `os.homedir()`, ficheros de bloqueo en vez de `lsof`), pero es una prueba pendiente.
- La transcripción con una clave real de Groq y con voz humana.
- Un chat con el WhatsApp Web cambiando: la librería no oficial se rompe de vez en cuando cuando WhatsApp cambia su web.

Cuando se pruebe en el primer ordenador con Windows, lo primero: `node instalar.mjs --comprobar`, luego `node vincular.mjs --solo-qr` y, con su sí, la vinculación real.

- 2.2.0 (18-nov-2026): el plan B de Chrome (`arreglar-chrome.mjs`) se probó de verdad en Mac (Apple Silicon) en una caché aparte: baja, descomprime con `ditto` y Chrome arranca. En Windows solo con pruebas simuladas (`tests/chrome-manual.test.mjs`: tar, y si falla Expand-Archive): falta probarlo en un Windows real. La detección de la app de escritorio (registro `HKCR\whatsapp` o paquete de la Store) tampoco se ha probado en un Windows real.
- 2.2.0: transcripción local probada de verdad en Mac (Apple Silicon) con una instalación limpia (`SKILLS_DST` aparte): nota de voz sintética en español (`say`, 9 s, opus) bien transcrita salvo una palabra («incluido» → «y fluido»), cifras y hora correctas; 50 s la primera vez (baja el modelo, 259 MB) y 2 s después; ruido rosa sin voz → vacío. Sin probar en Windows ni en Mac Intel.
