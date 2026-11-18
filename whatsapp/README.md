# Skill «whatsapp» (versión 2.1.0)

Con esta skill, Claude puede trabajar con tu WhatsApp:

- **Leer** un chat o un grupo entero, o desde una fecha.
- **Repasar las últimas 24 horas** (o las que digas): qué chats se han movido, cuáles tienes sin contestar y qué dicen sus audios.
- **Buscar** a una persona o un grupo por nombre o por número de teléfono.
- **Descargar** documentos, fotos, vídeos y audios que te hayan mandado.
- **Transcribir** las notas de voz y los audios.
- **Dejarte un mensaje escrito** y abierto en la app de WhatsApp, con el contacto ya puesto, para que lo envíes tú. Si hay dos personas con ese nombre, te pregunta cuál.
- **Recordar quién es quién** (qué número es cada persona) en un fichero que solo vive en tu ordenador.

Lo que **nunca** hace: enviar mensajes por su cuenta, marcar nada como leído, ni leer chats que no le pidas. Antes de leer, conviene que sepas dos cosas, que están explicadas más abajo: el riesgo de usar una herramienta no oficial y que, si transcribes audios, el audio se manda a un servicio externo.

> Funciona en **Claude Code** (la aplicación de escritorio o la terminal) instalado en tu ordenador. No funciona en la web de claude.ai, porque esa corre en la nube y no ve tu WhatsApp.

## Instalar (Windows)

1. **Instala Node.js.** Entra en https://nodejs.org, descarga la versión «LTS» y ábrela. Siguiente, siguiente, siguiente.
2. **Descarga esta skill.** En https://github.com/6grados-es/6g-skills pulsa el botón verde «Code» y «Download ZIP». Haz clic derecho sobre el ZIP descargado y «Extraer todo».
3. **Abre una terminal en la carpeta `whatsapp`** (dentro de la carpeta extraída, `6g-skills-main`). En el Explorador, entra en `whatsapp`, haz clic derecho en un hueco y elige «Abrir en Terminal».
4. Escribe esto y pulsa Intro (tarda unos minutos la primera vez; descarga un Chrome para WhatsApp Web):

   ```
   node instalar.mjs
   ```

   Al final debe decir «Instalada». Si dice que falta algo, te indica el qué.
5. **Reinicia Claude Code.** Para comprobarlo, pídele: «Ábreme un WhatsApp para 600111222 diciendo hola». Te abrirá la app con el mensaje escrito; el envío lo pulsas tú.

En Mac es igual (Terminal en vez de PowerShell). La skill queda en `~\.claude\skills\whatsapp` (en Windows, `C:\Users\TU_USUARIO\.claude\skills\whatsapp`).

## Enlazar tu WhatsApp (solo si quieres que Claude lea chats)

**Léelo antes.** La skill entra en tu WhatsApp como un «dispositivo vinculado», igual que WhatsApp Web, pero con una librería **no oficial** (`whatsapp-web.js`). WhatsApp no la autoriza en sus condiciones de uso. Solo lee y nunca envía, y no hay datos de que solo leer se castigue, pero el riesgo no es cero: WhatsApp podría restringir o bloquear el número, y en un número personal un bloqueo puede ser permanente. **Si ese número es imprescindible para tu trabajo, no lo enlaces** y usa el modo borrador o exporta los chats a mano (en el móvil: chat, los tres puntos, Más, Exportar chat).

Si decides seguir:

1. Ten el móvil a mano. En Claude Code di: «Enlaza mi WhatsApp con la skill whatsapp». Claude te enseñará el aviso de riesgo y esperará tu «sí».
2. Se abre **en tu navegador** una página con el código QR. La página se actualiza sola cada pocos segundos, así que el QR que ves siempre vale (WhatsApp lo cambia cada 20 segundos). En el móvil: WhatsApp, Ajustes, **Dispositivos vinculados**, Vincular un dispositivo, y apunta a la pantalla.
3. **Escanea el QR una sola vez.** Escanear dos veces seguidas puede desincronizar tu WhatsApp en otros dispositivos. Espera a que la página diga «Vinculado» (y Claude también). Ya puedes cerrar la pestaña.

Se enlaza una única vez. Si algún día falla la lectura con «sesión no válida», Claude no te volverá a pedir el QR por su cuenta: lo decides tú.

Para **desvincular**: en el móvil, Dispositivos vinculados, cierra la sesión, y borra la carpeta `C:\Users\TU_USUARIO\.whatsapp-skill\sesion`.

## Usarla

Habla con Claude con naturalidad:

- «Léeme el chat de Marta López.» · «Léeme lo del grupo del colegio desde el 1 de octubre.» · «Léeme **entero** el chat con Marta.»
- «¿Qué WhatsApp tengo de las últimas 24 horas?» · «¿Qué tengo sin contestar?» · «Léeme los audios de hoy.»
- «Busca en WhatsApp a Marta» · «Busca el 600111222.»
- «Descárgame el PDF que me mandó Luis.» · «Baja los audios de Marta.»
- «Transcríbeme las notas de voz de Marta de esta semana.»
- «Ábreme un WhatsApp para Luis diciéndole que la cita es el jueves.» · «Envíale un mensaje a Marta: llego en 10 minutos.»

La primera lectura de cada sesión tarda entre 30 segundos y un par de minutos: Claude abre WhatsApp Web sin ventana. No cierres nada ni lances otra lectura mientras tanto.

## Personas frecuentes

Claude aprende qué número corresponde a cada persona. Tras encontrar un chat nuevo, o la primera vez que le pides mandarle algo, te pregunta «¿lo guardo como Marta = +34600…?» y, si dices que sí, lo apunta en `personas-frecuentes.json` (carpeta `.whatsapp-skill`). La próxima vez que digas «Marta», para leer o para mandarle un mensaje, irá directo. Si hay dos «Marta», te pregunta cuál por el chat y te deja también elegir tú el contacto en la app. Puedes abrir y editar el fichero a mano (es texto). Es un dato personal: no se sube a ninguna parte.

## Transcribir audios: la clave gratuita de Groq

Para pasar audios a texto la skill usa Whisper en **Groq** con una clave tuya (gratis):

1. Entra en https://console.groq.com/keys, inicia sesión y pulsa «Create API Key». Copia la clave (empieza por `gsk_`).
2. En la terminal, dentro de la carpeta `whatsapp`: `node instalar.mjs --clave-groq PEGA_AQUI_TU_CLAVE`. Se guarda solo en tu ordenador.
3. Sin clave, todo funciona igual, pero los audios se descargan sin transcribir.

**Privacidad:** al transcribir, el audio se manda a Groq. Son voces y datos de tus clientes: avísalos y decide si te parece adecuado. Si no, no uses `--transcribir`, o configura un servidor de transcripción local (`references/transcripcion.md`).

## Si algo falla

- `node instalar.mjs --comprobar` dice cómo está todo.
- «Falta ffmpeg» solo afecta a audios muy largos: `winget install ffmpeg` en PowerShell.
- La librería de WhatsApp no es oficial: cuando WhatsApp cambia su web puede dejar de funcionar hasta que se actualice la skill. Pide una versión nueva en https://github.com/6grados-es/6g-skills.

## Para quien mantiene la skill

`SKILL.md` es lo que lee Claude. Código en `scripts/`; tests con `node --test tests/<fichero>.test.mjs` (de uno en uno). `references/pruebas.md` dice qué está probado y qué no. La librería va copiada y adaptada en `scripts/vendor/` (ver su `NOTICE-6grados.md`).

### Qué cambia en la 2.1.0

- El QR para enlazar se abre en el navegador, en una página que se actualiza sola: ya no caduca antes de escanearlo.
- Repaso de las últimas horas (`leer-chat.mjs --ultimas 24`, con `--transcribir` para los audios). Antes la skill se negaba a hacerlo.
- Mandar un mensaje por nombre: `enlace-borrador.mjs "<texto>" "<nombre>"` busca en las personas frecuentes y, si hay varias, no elige.

### Para actualizar desde la 2.0.0

Descarga otra vez el repositorio y repite `node instalar.mjs` en la carpeta `whatsapp`. No toca tu sesión de WhatsApp ni tus personas frecuentes: no hay que volver a escanear el QR.

### Qué cambia respecto a «leer-whatsapp» 1.0.0 y «whatsapp-borrador»

- Una sola skill (`whatsapp`) que incluye el modo borrador.
- Funciona en Windows: instalador en Node (`instalar.mjs`, sin bash ni rsync), bloqueo por fichero en vez de `lsof`, el QR se abre con `explorer.exe`, rutas con `path`.
- Chat completo (`--todo`), `--hasta`, grupos con autores por teléfono, búsqueda por número, `--miembros` por nombre.
- Descarga de audios y **transcripción** (Groq con tu clave, OpenAI o servidor local).
- Personas frecuentes.
- La sesión vive fuera de la skill (`~/.whatsapp-skill`): reinstalar no la toca. El lector escribe él mismo su salida en una carpeta temporal.
- `vincular.mjs` se niega a escanear otro QR si ya hay sesión.
