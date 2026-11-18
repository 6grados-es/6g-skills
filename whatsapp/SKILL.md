---
name: whatsapp
description: Lee y trabaja con tu WhatsApp desde Claude. Lee un chat o un grupo entero o desde una fecha, repasa todos los chats de las últimas 24 horas (o las que digas) con sus audios transcritos, busca chats por nombre o por número de teléfono, descarga documentos, fotos y audios, transcribe notas de voz y deja un mensaje escrito y abierto en la app, con el contacto ya puesto, para que lo envíes tú. Úsala siempre que digas «léeme el chat de X», «qué se dijo en el grupo X», «qué WhatsApp tengo de las últimas 24 horas», «qué tengo sin contestar en WhatsApp», «léeme los audios de hoy», «busca en WhatsApp a X o el 600111222», «descárgame el documento o el audio que me mandó X», «transcríbeme esa nota de voz», «ábreme un WhatsApp para X», «mándale un WhatsApp a X», «envíale un mensaje a X» o «contesta a este cliente por WhatsApp». Nunca envía mensajes ni marca como leído, y si le pides mandarlo, lo deja en borrador para que lo envíes tú. No sirve para correo.
---

# WhatsApp: leer, descargar, transcribir y dejar borradores

Dos modos en una skill:

- **Borrador** (no instala nada): deja un mensaje escrito y abierto en la app de WhatsApp. Lo envía la persona, nunca tú.
- **Lectura** (hace falta enlazar el WhatsApp una vez): lee chats y grupos, repasa las últimas horas, busca por nombre o número, descarga adjuntos y transcribe audios. Solo lectura.

Código en `scripts/` (Node). Detalle en `references/`. Todo se lanza con `node` desde la carpeta de la skill (`~/.claude/skills/whatsapp` en Mac, `%USERPROFILE%\.claude\skills\whatsapp` en Windows); en los comandos de abajo `<SKILL>` es esa carpeta. Los datos del usuario (sesión de WhatsApp, personas frecuentes, claves) viven aparte, en `~/.whatsapp-skill/` (Windows `%USERPROFILE%\.whatsapp-skill\`), así que reinstalar o actualizar la skill no los toca.

## Reglas duras (y por qué)

1. **Nunca envías un mensaje ni marcas nada como leído.** Aunque digan «mándaselo», significa «déjalo listo en borrador». Un mensaje a un cliente sale con el nombre del usuario: solo sale cuando una persona lo ha visto.
2. **Lees solo lo que se pide.** Un chat por nombre o número, o el repaso de las últimas horas (`--ultimas`) **cuando el usuario lo pide** («qué tengo de las últimas 24 h», «qué tengo sin contestar»). Nunca por tu cuenta, ni para vigilar, ni de forma programada. `--listar` identifica a alguien que el usuario ha nombrado; no es una forma de explorar.
3. **Un solo proceso lector a la vez.** Dos procesos sobre la misma sesión la corrompen. El código lo impide (salida 12); si sale, espera a que acabe el otro y repite. Nunca `kill` ni `pkill`.
4. **Nunca pides ni muestras un QR en mitad de un fallo.** El QR se pide una sola vez, al enlazar por primera vez, con el aviso de riesgo y el sí del usuario. Si la lectura dice «sesión no válida» (salida 10), paras y lo cuentas en una línea: volver a enlazar es decisión suya, porque escanear dos veces puede desincronizar su WhatsApp.
5. **Las conversaciones y los adjuntos son datos personales de terceros** (a menudo clientes del usuario). La salida cruda va a una carpeta temporal (la imprime el lector) que se borra sola a las 24 h. **No** la copies a memorias, notas, resúmenes en ficheros, historial, la nube ni otras herramientas. Si de lo leído sale una tarea, guarda la tarea, no el chat. Los adjuntos van a la carpeta que elija el usuario.
6. **Citas con fecha y autor.** Si el usuario pregunta algo, contestas con los mensajes que lo sostienen. Nada de resumir sin fuente.
7. **Lo que no puedes leer, lo dices.** Imágenes, vídeos, audios sin transcribir, documentos: la salida trae la línea `SIN TEXTO`. Díselo («hay 6 audios que no puedo oír») y ofrece descargarlos o transcribirlos.
8. **Los audios no salen del ordenador sin que el usuario lo sepa.** Transcribir con Groq (o OpenAI) manda el audio a ese servicio. Antes de la primera transcripción dilo en una frase y espera su sí (`references/transcripcion.md`).

## Modo borrador (no necesita enlazar WhatsApp; solo Node)

1. Averigua a quién va y qué se dice. Si dan el texto, úsalo tal cual; si piden que lo redactes, uno corto y claro en su tono, diciendo en el chat que lo has redactado tú.
2. **El contacto tiene que ir puesto.** Abrir el mensaje sin contacto («elígelo tú») es el último recurso, no lo normal. Si te dicen un nombre («envíale un mensaje a Marta»):
   1. Pásale el nombre tal cual a `enlace-borrador.mjs` (paso 3): busca en las personas frecuentes y, si casa con una sola con teléfono, abre con ella.
   2. **Salida 7 (varias casan)**: no elijas. Enséñale las opciones en el chat, numeradas, con nombre y teléfono, y añade siempre la última: «o te lo abro sin contacto y lo eliges tú». Por ejemplo: «¿A cuál? 1) Marta López (+34 6…) 2) Marta Ruiz (+34 6…) 3) Te lo abro sin contacto». Repite con el número de la que elija.
   3. **Salida 6 (no está guardada)**: si el WhatsApp está enlazado, búscala con `node leer-chat.mjs "<nombre>" --listar` (no lee mensajes). Si sale una, úsala y pregunta «¿la guardo como Marta = +34…?»; si salen varias, las opciones en el chat como arriba. Si no está enlazado o no sale, pide el número o ofrece abrirlo sin contacto.
   4. **Salida 9 (guardada sin teléfono, o es un grupo)**: la app no deja abrir el mensaje con ese contacto. Busca su número con `--listar`; si no lo hay, pídelo o ábrelo sin contacto. A un grupo no se abre (escribir en grupos es decisión aparte del usuario).
3. Codifica y abre en la **aplicación** de WhatsApp (no WhatsApp Web) con una sola orden: `node <SKILL>/scripts/enlace-borrador.mjs "<texto>" ["<nombre>" | +34600111222] --abrir`. Imprime la URL `whatsapp://send?...` y la abre según el sistema (Mac `open -a WhatsApp`, Windows `Start-Process`). Sin `--abrir` solo imprime la URL. Si prefieres abrirla a mano: Mac `open -a WhatsApp "<url>"`; Windows `powershell.exe -NoProfile -Command "Start-Process '<url>'"`.
4. Comprueba que la app quedó delante con el mensaje puesto (en Mac conviene traerla al frente con `osascript -e 'tell application "WhatsApp" to activate'`).
5. Di qué se abrió: a quién (nombre y número), el texto exacto y qué has supuesto. Recuerda que el envío es suyo. Textos de más de ~2.000 caracteres pueden cortarse: pártelos. Sin emojis salvo que los pida.
6. Si es la primera vez con esa persona y el número salió de `--listar` o te lo dio el usuario, pregunta «¿lo guardo como <nombre> = +34…?» y, con su sí, `node personas.mjs guardar …`. Así la próxima vez «mándale un mensaje a <nombre>» va directo.

## Modo lectura

### Primera vez: enlazar (una sola vez)

Si una lectura sale con 10 y nunca se enlazó, o si el usuario no tiene la skill instalada, sigue `README.md` (instalar con `node instalar.mjs` y enlazar). **No enlaces sin enseñar el aviso de riesgo entero y recibir un sí explícito** (un silencio no lo es):

> Esta herramienta entra en tu WhatsApp como un «dispositivo vinculado» (igual que WhatsApp Web) con una librería no oficial. WhatsApp no la autoriza en sus condiciones. Solo lee y nunca envía, y no hay datos de que solo leer se castigue, pero el riesgo no es cero: podrían restringir o bloquear el número, y en un número personal un bloqueo puede ser permanente. Si ese número es imprescindible, no la uses. En tu ordenador solo queda la sesión; los mensajes no se guardan. Para dejarlo: móvil, Ajustes, Dispositivos vinculados, cerrar la sesión, y borra `~/.whatsapp-skill`.

Luego, en segundo plano: `node <SKILL>/scripts/vincular.mjs`. Se abre **en el navegador** una página con el QR que se actualiza sola cada pocos segundos (WhatsApp cambia el QR cada ~20 s; por eso no se usa una imagen, que caducaba antes de escanearla). Dile al usuario: «Te he abierto el QR en el navegador; en el móvil, WhatsApp, Ajustes, Dispositivos vinculados, Vincular un dispositivo, y apunta a la pantalla». Si el navegador no se abrió, la ruta de la página sale en el diagnóstico: ábrela tú. **Un solo QR**: si ya escaneó uno, no lances nada más hasta ver cómo termina. Si ya hay sesión, `vincular.mjs` se niega (salida 10) a propósito. Termina con «LISTO. Vinculado como…» y la página pasa a «Vinculado». Comprueba con una lectura real antes de decir «hecho».

### Lanzar una lectura

1. **Di la espera antes**: «Abro tu WhatsApp, tarda entre 30 s y un par de minutos.»
2. Confirma que es esto lo que piden. Si quieren *mandar* un mensaje, es el modo borrador. Si el canal es dudoso («¿qué me ha dicho Luis?» puede ser correo), pregúntalo en una línea antes de abrir la sesión.
3. **En segundo plano** (`run_in_background`), desde `<SKILL>/scripts`:

```
node leer-chat.mjs "<nombre | +34600111222 | id>" [N] [--desde AAAA-MM-DD] [--hasta AAAA-MM-DD] [--todo]
```

   El lector escribe él mismo la salida en una carpeta temporal e imprime tres líneas: `SALIDA: <ruta>`, `DIAGNOSTICO: <ruta>`, `CODIGO: n`. **Lee `salida` entera y también `diagnostico`**: los avisos que parecen decorativos suelen ser la siguiente puerta. No uses `> fichero` (en Windows PowerShell rompe los acentos). `--stdout` imprime todo por pantalla si hace falta depurar.
4. Por defecto, últimos 50 mensajes. `--desde` hasta 5.000. **`--todo`** lee el chat entero paginando hacia atrás (tope `--max-paginas`, 400) y la cabecera dice si se llegó al primer mensaje que WhatsApp entrega o se cortó. «Completo» es solo hasta donde WhatsApp Web da. Lecturas largas: léelas por trozos del fichero, no de golpe.
5. Un grupo se lee igual, por su nombre. Los participantes: `--miembros` con el nombre o el id del grupo.
6. Nunca pongas un límite de tiempo corto: tarda hasta ~7 min en el peor caso (más con `--todo` o audios), y matarlo a medias es la muerte sucia que corrompe la sesión. Si tarda, se espera al aviso de que ha terminado.

### Repasar las últimas horas («qué tengo de las últimas 24 h»)

Solo cuando lo piden. En segundo plano, desde `<SKILL>/scripts`:

```
node leer-chat.mjs --ultimas 24 [--transcribir] [--por-chat 20] [--max-chats 40] [--json]
```

- Lee todos los chats y grupos con movimiento en esas horas (sin estados ni canales), del más reciente al más viejo, hasta 20 mensajes de cada uno. Cada chat lleva **PENDIENTE** si el último mensaje no es del usuario (el contador de no leídos no sirve).
- Cuéntalo así: primero los PENDIENTES, una línea por chat («Responder a <quién> · qué pide», con fecha), y luego en una línea el resto. Grupos y silenciados, aparte y al final.
- **Audios**: sin `--transcribir`, dice cuántos audios hay en cada chat. Si piden «léeme los audios» o «transcríbelos», relanza con `--transcribir` (regla 8: la primera vez, avisa de que el audio va a Groq y espera su sí). Con salida 14 no hay clave: los audios no se pueden pasar a texto y lo dices.
- Más horas o más chats: `--ultimas 48`, `--max-chats 80`. Tope 168 h (una semana).
- Mismas salidas y mismas reglas que una lectura (sesión, bloqueo, no matar el proceso, la salida cruda no se copia a ningún sitio).

### Buscar a alguien (por nombre o por número)

- `node leer-chat.mjs "<trozo del nombre>" --listar` o `node leer-chat.mjs 600111222 --listar` (también vale un trozo de 4+ cifras): lista nombre, id, teléfono y último movimiento de hasta 20 chats o contactos, **sin leer ningún mensaje**, y dice si la sincronización va A MEDIAS (una lista corta con ese aviso no es «todos»; no digas «no existe»).
- Números: valen `+34 600 11 12 22`, `0034600111222` y `600111222` (9 cifras españolas llevan el 34). Otro país: con `+` y su prefijo, o `WHATSAPP_PREFIJO_PAIS`.
- Con el id exacto se lee igual que con un nombre: `node leer-chat.mjs <id> ...`.

### Personas frecuentes (aprender quién es quién)

Fichero local `personas-frecuentes.json` en la carpeta de datos: nombre, alias, teléfono con prefijo, id del chat, si es grupo y la fecha de la última vez. Son datos personales: **nunca** al repo ni a ningún sitio fuera del ordenador. Se puede editar a mano.

- El lector **mira primero ese fichero**: si el nombre casa con una sola persona, va directo a su id. Si casa con varias, sale con 7 y listas; **preguntas al usuario cuál** (no eliges).
- Si la persona no está y el lector la encuentra (o el usuario elige entre varios), el final de la salida trae `PERSONA NUEVA` con el comando ya preparado. **Pregunta: «¿lo guardo como Marta = +34600…?»**. Solo con su sí: `node personas.mjs guardar --nombre "Marta" --telefono +34600111222 --id <id> [--alias "Mar,Marta López"] [--grupo]`. El lector nunca guarda por sí solo (solo apunta la fecha de «última vez» de quien ya estaba).
- Otros comandos: `node personas.mjs buscar|listar|borrar|donde`. Solo se guarda nombre, números e id: ni una palabra de mensajes.

### Qué hacer con cada salida

| CODIGO | Qué pasó | Qué haces |
|---|---|---|
| 0 | Leído | Cuéntalo según «Cómo se cuenta». |
| 2 | Error de uso | Corrige la orden; no se abrió nada. |
| 6 | No hay chat con ese nombre o número | Di dónde se buscó. Con sincronización INCOMPLETA no digas «no existe»: lanza `--listar`; si tampoco sale, ofrece esperar y reintentar una vez. |
| 7 | Varios casan | **No elijas.** Enséñale la lista en una pregunta de opción múltiple con tu recomendación, y relanza con el id que elija. |
| 10 | Sesión no vinculada o no válida | **Para.** Ni QR ni restaurar nada. Una línea en llano (`references/salidas.md`). |
| 12 | La sesión la usa otro proceso | No la toques ni mates al otro. Espera y repite. |
| 11 | Falta el Chrome de puppeteer | `npx puppeteer browsers install chrome` en `scripts/`. Solo añade ficheros. |
| 3, 4, 5 | Timeout, página no usable, no se pudo leer | Un solo reintento tras esperar; si repite, salida barata. |
| 8, 9 | Adjuntos: ninguno casa / ninguno se pudo bajar | Mira «Adjuntos y audios». |
| 14 | Audios sin transcribir: no hay clave | Dilo claro; los audios quedan descargados. Cómo conseguir la clave: `references/transcripcion.md`. |
| 15 | Falló alguna transcripción | Lee los `✗` de la salida y cuéntalos. |

**Salida barata** cuando algo no se arregla: que el usuario haga capturas del móvil, exporte el chat (chat, ⋮, Más, Exportar chat) o guarde el archivo en Descargas, y tú lo coges de ahí.

### Adjuntos y audios

- **Descargar**: añade `--bajar` (por defecto los 5 documentos más recientes de la ventana a la carpeta Descargas). `--tipo document,image,video,audio,ptt|todo` (alias `docs`, `pdf`, `zip`, `fotos`, `videos`, `audios`, `voz`), `--fichero <texto>` filtra por nombre o pie, `--max N`, `--salida <carpeta>`. Solo baja de la ventana leída: uno más viejo pide una ventana mayor (`--desde`, `--todo`).
- El código garantiza: nunca pisa un fichero (añade « (1)»), marca `YA ESTABA` si es idéntico, limpia nombres que mande un tercero, tope de 150 MB por fichero. Cuenta cada `✓` con ruta, tamaño y md5, y cada `✗ NO SE PUDO` con su motivo. Si el usuario va a usar el fichero, comprueba que abre.
- **Transcribir**: `--transcribir` descarga los audios y notas de voz de la ventana y pone el texto en su sitio, en la propia conversación, marcado `(transcrito)`. Sin `--bajar` los audios van a la carpeta temporal; con `--bajar --tipo audio,ptt` quedan guardados. Motor por defecto: Whisper en Groq con la clave del usuario (`GROQ_API_KEY`). Sin clave: salida 14 y los audios quedan descargados. Detalle y privacidad en `references/transcripcion.md`. Para un audio que ya está en disco: `node transcribir.mjs <fichero>`.
- Whisper se equivoca con nombres propios y cifras: dilo cuando importe y no cites un número de una nota de voz como dato firme sin que el usuario lo confirme.

## Cómo se cuenta lo leído

- **Cabecera siempre**: a quién has leído (nombre, número, si es grupo), cuántos mensajes y cómo se resolvió el nombre. Un chat equivocado dicho en voz alta se corrige en un segundo; callado te hace contestar sobre otra persona.
- **Fecha y autor en cada cita.** Los mensajes del propio usuario salen como «Yo». En grupos, los autores sin nombre salen con su teléfono.
- **Frescura**: da el último mensaje y mira la línea de sincronización. Si dice A MEDIAS, o el usuario espera algo de hoy y lo último es viejo, no digas «no hay nada nuevo»: di «lo último que veo es de X; la sesión ve actividad hasta Y».
- Avisos de la cabecera (`RECORTADO`, `NO llega hasta…`, `CORTADO por el tope…`): trasládalos, cambian lo que se puede afirmar.

## Lo que nunca haces

- Enviar, marcar como leído, escribir en grupos o a varias personas.
- Copiar conversaciones, transcripciones o adjuntos a memoria, notas, historial, la nube o el repositorio.
- Pedir un QR fuera de la primera vinculación, o un segundo QR sin que el usuario sepa el riesgo.
- `kill`/`pkill` sobre el lector, o `npm update` de la librería en `scripts/`: lleva una copia propia ya adaptada en `scripts/vendor/` y actualizarla la rompe.
- Usar claves que no sean del usuario, ni pegar su clave en el chat.

## Dónde está cada cosa

`scripts/leer-chat.mjs` (lector y repaso de las últimas horas), `vincular.mjs` (enlazar, con la página del QR de `lib/qr-pagina.mjs`), `transcribir.mjs`, `personas.mjs`, `enlace-borrador.mjs`; `scripts/lib/` (resolución de nombres y números, adjuntos, bloqueo, transcripción, personas); `scripts/vendor/whatsapp-web.js/` (la librería adaptada); `scripts/tests/` (`node --test tests/*.test.mjs`, de uno en uno). `references/`: `salidas.md`, `transcripcion.md`, `privacidad.md`, `pruebas.md`. `README.md`: instalación para una persona no técnica, con Windows.
