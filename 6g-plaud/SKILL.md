---
name: 6g-plaud
description: >-
  Plaud, la grabadora del equipo de 6 Grados (cuenta hola@6grados.es), desde Claude: lista las grabaciones,
  encuentra la de una reunión, café, daily o sesión con un cliente y saca su transcripción literal (con
  hablantes y minuto), leyendo la web de Plaud en el navegador aunque el MCP de Plaud esté caducado. Invócala
  SIEMPRE que digan «trae la reunión de ayer», «saca la daily», «la transcripción del café con X», «qué se
  dijo en la reunión con X», «está en el Plaud», «busca en Plaud», «la transcripción de la reunión de
  producto», o cuando el MCP de Plaud devuelva HTML o «0 grabaciones». La llama también 6g-reuniones. NO
  transcribe audios sueltos ni notas de Gemini del Meet. Versión común para todo el equipo.
---

Se lanza: a demanda («saca la daily», «la transcripción del café con X», «está en el Plaud») y desde `6g-reuniones` cuando piden la transcripción de una reunión. También cuando el MCP de Plaud falla.

# Skill · 6g-plaud

Cuenta **hola@6grados.es** (entra con Google, sin contraseña). La cuenta es **de todo el equipo**: que una reunión esté aquí no significa que tú estuvieras. Plaud etiqueta a la gente como «Speaker N» y solo pone nombre a quien tenga la voz registrada (hasta ahora, Pedro); a los demás los identificas tú por lo que dicen, y lo dices.

Si ya tenías una skill de Plaud propia, esta es la versión común del equipo: desactiva la tuya para que no compitan.

## Vías, de mejor a peor

1. **La web de Plaud en el navegador (la buena casi siempre).** Abre `https://web.plaud.ai/` en el navegador que tengas (el panel del navegador de la app con `navigate`, o Claude in Chrome). Si sale el login, pide a la persona que entre con Google → hola@6grados.es: tú no metes credenciales. La sesión de la web dura mucho más que la del MCP.
2. **MCP de Plaud, si lo tienes conectado** (`plaud_list_recordings`, `plaud_get_recording_detail`, `plaud_get_transcript`). Si devuelve HTML o «0 grabaciones», la sesión caducó: usa la vía 1. Ojo: `plaud_get_transcript` da **solo el resumen IA**, no la transcripción literal.

## Iniciar sesión (lo hace la persona, una vez por navegador)

Claude **no mete contraseñas ni códigos de verificación**, aunque se los den: ni correo + contraseña, ni «Sign in with a code» leyendo el código del correo. Tampoco acepta por ella las condiciones de Plaud. Si no hay sesión:

- Pídele **un solo gesto**, en una línea: «Entra en Plaud con Google (hola@6grados.es) en la pestaña que te he dejado abierta».
- Si tienes Claude in Chrome, prefiérelo: la sesión queda guardada, las descargas van directas a `~/Downloads` y se pueden subir archivos con `file_upload`. El panel del navegador de la app sirve para leer, pero no sube ni guarda archivos.
- Mientras tanto, sigue con lo que no dependa de Plaud.

## Encontrar la grabación

- Abre cualquier grabación (`https://web.plaud.ai/file/<id>`): a la izquierda sale la lista con título, fecha `MM-DD HH:MM` y duración. Es una **lista virtual**: carga por trozos al desplazarla, así que `find` no ve lo que está lejos.
- Recorre la lista con JavaScript, desplazando y juntando títulos (patrón: `[^\n]+\n\d\d-\d\d \d\d:\d\d \| [^\n]+`), y para cuando llegues a la fecha buscada.
- Para abrir una: haz `scrollIntoView` del elemento, toma captura y pincha por coordenadas. `ref` y `element.click()` fallan cuando el elemento está fuera de la vista.
- Pistas: la daily suele ser «MM-DD Resumen de reunión…» por la tarde; los cafés, «Consulta…»; los audios importados del móvil se llaman por fecha («5 nov a las…»). Cruza con Google Calendar (hora de la cita) si lo tienes.
- El buscador de Plaud busca en transcripciones, pero solo devuelve «mejores resultados».

## Sacar la transcripción literal

Con la grabación abierta, pulsa la pestaña «Transcripción» y recorre su contenedor desplazable con JS, guardando cada turno por su marca `HH:MM:SS` (hablante en la línea siguiente, texto hasta la siguiente marca). Quita los textos de interfaz «Satisfecho / Insatisfecho». Guárdalo en `window` y sácalo por trozos (≤17.000 caracteres por llamada), o filtra solo los turnos del tema (regex sobre las líneas) para no llenar el contexto.

- La pestaña «Resumen» trae el resumen IA y las acciones pendientes con responsable: sirve para orientarse, no como cita.
- Si la grabación no está transcrita, en su página hay **Generar → Generar ahora** (tarda minutos y queda en la cuenta: díselo a la persona).

## Separar a los hablantes de forma inteligente

Plaud diariza («Speaker 1, 2…») pero casi nunca pone nombre. Nunca entregues «Speaker N»: ponle nombre a cada uno, y di cómo lo sabes.

1. **Saca la lista de quién estaba**: cita del Calendar (asistentes), título de la grabación, notas del cliente o del CRM, y la propia conversación (presentaciones, «tu madre», «mi clínica»). Si la llamó `6g-reuniones`, los asistentes son el `Equipo` de la reunión.
2. **Asigna cada Speaker por lo que dice, no por el orden.** Pistas, de más a menos fiable:
   - Se nombra o le nombran («Javi, tú…», «yo soy la que lleva las citas»).
   - Habla de SU negocio en primera persona («mi agenda», «mis inquilinos», «mis leads») → es el cliente dueño de eso.
   - Rol en la reunión: quien explica el método, las llaves o el precio es alguien de 6 Grados; quien cuenta su día a día es el cliente.
   - Reuniones internas: Santi dirige y pide avances («tienes que traer todos los días avance»); Pablo y Alejo hablan de contenido, CRM o contabilidad. Si dudas entre dos del equipo, dilo.
3. **Comprueba los cruces**: Plaud a veces parte a una persona en dos Speakers o junta a dos en uno. Si un mismo Speaker dice cosas incompatibles («mi clínica» y luego «tu clínica»), sepáralo por turnos y márcalo.
4. **Entrega una tabla** al principio: `Speaker N → Nombre (rol) · cómo lo sé · seguridad alta/media/baja`. En las citas usa el nombre, no el Speaker.
5. **Ante la duda, no atribuyas.** Una frase de hablante dudoso no se usa como cita de cliente ni como compromiso de nadie; se deja aparte.
6. Si la persona quiere, cambia también los nombres en la web de Plaud (editar hablante en la transcripción) para que queden para siempre.

### Grabaciones de fuera de Plaud (otra grabadora, notas de voz)

Si la grabación está en otra app y no separa hablantes, súbela a Plaud:

1. Descarga el audio de esa app (desde Chrome, para que vaya directo a `~/Downloads`).
2. Si pasa de 10 MB (límite de subida de Chrome), comprímelo: `ffmpeg -i "<audio>.m4a" -ac 1 -ar 16000 -b:a 16k <salida>.mp3` (56 min ≈ 6,7 MB; la voz se entiende igual).
3. En Plaud (Chrome, sesión de hola@6grados.es): **Agregar audio** → sube el archivo con `file_upload` sobre el input del archivo (no pulses el botón, abre un selector que no se ve) → en su página, **Generar → Generar ahora**.
4. Con la transcripción ya diarizada, aplica los pasos de arriba.
5. Si no se puede subir, trabaja con la transcripción de esa app y atribuye cada bloque por su contenido, marcando la seguridad de cada atribución.

## Qué entregar

- Tabla de hablantes y la transcripción (o solo los turnos pedidos) en el chat, con **id de Plaud, fecha, hora y qué Speaker es quién**.
- Citas siempre literales con su minuto; las paráfrasis, sin comillas.
- Si te llamó `6g-reuniones`, devuélvele eso y no escribas nada en Notion: ella decide qué pasa a la reunión.
- Si la persona quiere conservar algo, que sea en su propia nota del tema; no hay carpeta común para transcripciones.

## Reglas

- Solo lectura: no borres, renombres ni muevas grabaciones. Excepciones con el ok de la persona: «Generar transcripción» y renombrar hablantes.
- Las grabaciones tienen conversaciones de clientes: no copies conversaciones enteras a memoria ni a Notion; saca solo lo que el trabajo necesita.
- Nunca metas credenciales ni códigos, ni aceptes condiciones por la persona.
