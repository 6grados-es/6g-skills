---
name: 6g-reuniones
description: >-
  El conector con Claude de las reuniones de equipo de 6 Grados (daily de producto, redes, daily, weekly), que viven
  en la base propia de Reuniones (la de la web Reuniones; desde el 15-nov-2026 ya no en Notion). Añade informar, temas y siguientes pasos a una reunión, marca
  casillas como hechas, pasa pendientes, quita o corrige líneas, crea la reunión del día con lo pendiente de la
  anterior, crea las reuniones recurrentes que falten, pasa al formato una reunión desordenada (propuesta y, con
  ok, la aplica), lista los to-dos de una persona, da el cumplimiento (hechos frente a pasados) y trae la
  transcripción de Plaud. Cada siguiente paso lleva fecha. Usa el mismo código y las
  mismas reglas que la web Reuniones (los botones): la fuente de verdad es esa base, no Notion. Invócala SIEMPRE que digan
  «añade un tema a la reunión» (a la daily de producto o a la de redes), «añade un punto de informar», «apunta un siguiente
  paso», «marca como hecho X», «pásalo al jueves», «apárcalo», «quita la línea X», «qué to-dos tengo», «qué
  to-dos tiene Santi», «cómo vamos de cumplimiento», «qué quedó
  pendiente de la anterior», «crea la daily de producto (o la de redes, la daily, la weekly) de hoy», «crea las
  reuniones de hoy», «qué reuniones recurrentes hay», «formatea la daily de hoy», «pon esta reunión en el
  formato», «la transcripción de la reunión X» o «/6g-reuniones».
---

Se lanza: a demanda («añade un tema a producto», «apunta un siguiente paso», «marca como hecho X», «qué to-dos tengo», «crea la reunión de redes de hoy», «formatea la daily de hoy», «la transcripción de la reunión X»); y su comando `crear-recurrentes`, solo, cada 30 min desde la rutina del Mac de Pedro.

# Skill · 6g-reuniones

El conector con Claude de las reuniones de 6 Grados. Todo se lee y se escribe en la base propia de Reuniones, con el comando `bin/reuniones.mjs`. La web Reuniones (https://reuniones-henna.vercel.app) hace lo mismo con botones sobre las mismas reuniones: lo que escribes aquí se ve allí y al revés.

**Notion ya no se usa** (desde el 15-nov-2026). Todas las reuniones que había allí se pasaron a la base (el 16-nov-2026, también las antiguas); las páginas de Notion quedan como copia vieja, que ya no se actualiza. **Nunca escribas una reunión en Notion**, ni con el conector de Notion ni por REST: nadie lo vería en la web.

- Formato y reglas (4 H1, «Persona - enunciado», sin límite de palabras, Detalle, qué se puede hacer en cada reunión, to-dos): `references/formato.md`.
- Cómo era en Notion (solo por si hubiera que volver atrás): `references/notion.md`.

Lee `formato.md` antes de la primera escritura de la sesión.

## Paso 0 · Datos, identidad y conexión (siempre)

1. **`tipos.json`**: está en la raíz del repo, `~/6grados-es/6g-reuniones/tipos.json`. Si el repo está en otro sitio, sigue el enlace de la skill (`readlink ~/.claude/skills/6g-reuniones`) y sube dos niveles. Es la fuente única de tipos de reunión, personas (ids de Notion y alias), data source, propiedades y días de to-dos. No hardcodees nada de lo que esté ahí. Los tipos con `"oculto": true` no existen para el equipo: no los ofrezcas.
   Si no está el repo, no hay comando: di que hace falta clonarlo (`skill/README.md` del repo `6grados-es/6g-reuniones`) y para.
2. **Identidad**: lee `~/.claude/skills/6g-reuniones/.cache/identidad.json` (`{"persona":"pedro","nombre":"Pedro","notion":"<id>","resuelto_at":"AAAA-MM-DD"}`). Si falta, ejecuta **SETUP**. Si dicen «no soy yo», bórralo y vuelve a preguntar. Esa persona es el prefijo por defecto (`Nombre - `). Si la línea es de otra («apunta que Santi…», «de Pablo»), usa esa.
3. **Conexión**: todo va por **el comando** `node <repo>/bin/reuniones.mjs …`. Es el mismo código que la web, así que aplica solo todas las reglas: el Detalle, no duplicar, el Revisar heredado, la fecha de cada paso y qué se puede hacer en cada reunión. Sin argumentos enseña la ayuda.
   - Pruébalo con `node bin/reuniones.mjs quien`: dice con qué nombre está conectado este ordenador.
   - Si dice que **no está conectado**, la persona tiene que hacerlo una vez (tú no puedes, es su clave): entrar en https://reuniones-henna.vercel.app → Ajustes → «Conectar Claude» → «Crear mi clave», y pegar en su terminal el comando que le da (`node …/bin/reuniones.mjs conectar <clave>`). La clave vale un año y se guarda en `~/.config/6grados/reuniones.clave`. No la pidas por el chat ni la imprimas.
   - Si el comando no funciona y no puedes arreglarlo, avisa y **no escribas nada** (y nunca en Notion).

### SETUP (primera vez en la máquina, o «instala» / «configura»)

1. Pregunta «¿quién eres?» con las personas de `tipos.json` en lista numerada y guarda `.cache/identidad.json`.
2. Prueba la conexión: `node bin/reuniones.mjs quien`. Si no está conectado, explica los dos pasos de arriba (Ajustes → «Conectar Claude» → pegar el comando) y espera a que lo haga.
3. Confirma en una línea: `✅ Listo. Eres <nombre>. Conectado con Reuniones.` No toques instrucciones globales ni otros archivos.

## Paso 1 · Enruta por intención

| Dicen | Modo | Comando (desde la raíz del repo) |
|---|---|---|
| «crea la daily de producto / la de redes / la daily / la weekly (de hoy)» | CREAR | `crear producto [--dia D] [--hora HH:MM]` |
| «termina la reunión», «hemos acabado la daily», «cierra la reunión» | TERMINAR (todo tema sin ver pasa a la siguiente) | `terminar producto [--dia D]` |
| «crea las reuniones de hoy», «qué reuniones recurrentes hay», «se ha creado la de…» | RECURRENTES | `recurrentes [--dia D]` · `crear-recurrentes [--dia D] [--simular]` |
| «formatea la daily de hoy», «ponla en el formato», «ordena esta reunión» | FORMATEAR | `formatear daily [--dia D]` y luego `formatear <id> --aplicar propuesta.json` |
| «añade a informar…», «para informar: …» | AÑADIR → Informar | `anadir producto informar "…" --persona pedro [--detalle "…"]` |
| «añade un tema…», «propuesta: …», «hay que hablar de…» | AÑADIR → Temas | `anadir producto temas "…" --persona pedro [--enlace https://…]` (el enlace saca el botón «Abrir» de la web; uno pegado en el texto no) |
| «apunta un siguiente paso», «X se encarga de…», «me comprometo a…» | AÑADIR → Siguientes pasos (**siempre con fecha**) | `anadir producto pasos "…" --persona santi --fecha miércoles` |
| «apárcalo», «al parking», «para más adelante» | AÑADIR → Parking (tema) o Aparcados y mejoras (paso) | `anadir daily parking "…"` · `anadir daily aparcados "…"` |
| «celebramos…», «dato de la semana», «postmoto: …» (Weekly) | AÑADIR → Celebración / Resumen de la semana / Postmoto | `anadir weekly celebracion "…"` · `anadir weekly postmoto "…" --grupo "Qué fue bien"` |
| «sube X del parking», «pasa X a temas», «aparca X» | MOVER | `mover-a daily "X" temas` (destinos: las secciones de esa reunión, salvo Revisar) |
| «marca como hecho X», «ya está lo de X» | HECHO | `marcar producto "X"` (`--no` para desmarcar) |
| «sigue pendiente X», «pásalo al jueves», «↓» | PENDIENTE (con fecha nueva; cuenta como pasada) | `pasar producto "X" --fecha jueves` |
| «este tema para la próxima», «pasa el tema X», «no nos ha dado tiempo a X» (un TEMA) | PASAR TEMA (a Temas de la próxima reunión) | `pasar producto "X"` (sin `--fecha`; `--no` lo deshace) |
| «pásalo a la daily de producto», «ese tema es de contenido», «llévate este paso a producto» | MOVER A OTRA REUNIÓN | `mover-a <reunión de origen> "X" producto` (o `redes`, `daily`): la línea va a la reunión de ese tipo de hoy o la próxima, al mismo apartado; en la de origen va a la papelera. Si no existe esa reunión, dice cuál crear |
| «convierte el tema X en to-do», «X lo hace Santi para el jueves» (un TEMA) | TO-DO (a Siguientes pasos, con persona y fecha) | `mover-a producto "X" pasos --fecha jueves --persona santi` |
| «aparca X», «eso no es para ya» (una línea de Revisar o un paso) | APARCAR | `aparcar daily "X"` |
| «cámbiale la fecha a X», «X es para el viernes» (paso de la reunión de hoy) | FECHA | `fecha daily "X" viernes` |
| «cómo vamos de cumplimiento», «qué porcentaje cumplimos» | CUMPLIMIENTO | `cumplimiento [--semanas 4]` (la semana de la Weekly: `--semanas 1 --hasta <domingo anterior>`) |
| «quita X», «borra la línea X» | QUITAR | `quitar producto "X"` |
| «corrige X por Y» | EDITAR | `editar producto "X" "Y"` |
| «eso es de Santi», «pásale X a Pablo» | ASIGNAR | `asignar producto "X" santi` |
| «ya hemos visto X», «el punto 2 está visto» | VISTO | `visto producto "X"` (`--no` para quitarlo) |
| «qué tareas tengo», «qué to-dos tiene Santi» | CONSULTAR | `todos santi` |
| «qué quedó pendiente de la anterior», «cómo va la reunión» | CONSULTAR | `leer producto [--dia D]` |
| «la transcripción de la reunión X», «qué se dijo en…» | TRANSCRIPCIÓN | `plaud producto [--md]`; si Plaud no está conectado, skill `6g-plaud` |

### Elegir la reunión de un tema o un paso (Pedro, daily de producto 19-nov)

Antes de AÑADIR un tema, un informar o un siguiente paso, decide a qué reunión va. Si Pedro no la nombra, **propón la reunión y que él confirme** (una línea: «¿Lo apunto en la daily de producto?»); solo si la dice explícita, se apunta sin preguntar.
- **Producto** (`producto`): lo de Santi y Pedro: diseño de producto, clientes.
- **Contenido** (`redes`): lo de Santi y Pablo: marketing, contenido.
- **Daily** (`daily`): lo de los tres, cosas de socios.
- **Siguientes pasos de producto: solo salen y se revisan en la daily de producto.** Un paso de producto no se apunta en la daily ni en contenido, ni se arrastra a su Revisar; no se mezclan los siguientes pasos entre reuniones (Santi: «Eso es un pin grande»). Si dudas de si un paso es de producto, pregunta. En la web, desde el 24-nov, un paso de Pedro o Santi de la Daily 6G, la Weekly o la de contenido que habla de producto (clientes, sesiones, oferta, playbook, onboarding… y no de cobros, CRM, eventos, landing ni contenido; la lista está en `recoge` del tipo `producto` en `tipos.json`) sale marcado «Parece de producto · Llevar a producto». No se mueve solo: con el botón (o `mover-a <reunión> "X" producto`) va a la Daily de producto de hoy o la próxima. Los puntos fijos no se marcan.
- **Recursos y artefactos**: si el tema lleva un recurso, pon el enlace sin que te lo pidan. Si es un **artefacto** (enlace de claude.ai/artifact), **compártelo con Santi y Pablo** antes de dar el tema por apuntado, para que puedan abrirlo en la reunión (Pedro: «ese artefacto tiene que compartirlo con Pablo y con Santi»). Lo compartes tú desde el menú Compartir de claude.ai (Claude in Chrome); no se le deja a Pedro. Di en el eco que lo compartiste. Esto sustituye al «basta con poner el enlace» del 18-nov.

`producto` puede ser cualquier tipo de `tipos.json` (la reunión de ese tipo de hoy, o la de `--dia`) o el id de la reunión (sale en `hoy` y en su enlace). Las líneas se buscan por texto, exacto o una parte. Si casan varias, el comando lista los ids para elegir.

## Encontrar la reunión

1. **Tipo.** Por `reconocer` de `tipos.json` («producto», «redes», «daily», «weekly»). Solo hay dos nombres, daily o weekly: «la daily de producto» (o «la weekly de producto», o la antigua «reunión de producto») es `producto`, la de Pedro y Santi; «la daily» a secas es `daily` (Daily 6G). Si no lo dicen, mira las de hoy (`hoy`) en las que está la persona: si hay una sola, esa; si hay varias, pregunta con lista numerada.
2. **Fecha.** La dicha (`--dia AAAA-MM-DD`); por defecto, hoy.
3. **Si no existe:** el comando lo dice («No hay reunión de … el …»). Ofrece crearla (CREAR).
4. **Reunión anterior** = la más reciente de su cadena con fecha anterior (la Daily y la Weekly se siguen la una a la otra). `leer` la nombra junto a «Revisar».
5. **Reuniones anteriores al 13-nov-2026:** están en la base, traídas de Notion tal cual (casi todas sin formato: solo se leen). `hoy --dia D` da su id y `leer <id>` la enseña; también salen en el Historial de la web.

## Modos

### CREAR (la reunión del día)

1. Resuelve tipo, fecha y hora. La hora es opcional; con hora, la reunión dura los `minutos` del tipo. Si no la dicen, usa la del evento de ese tipo en el calendario de 6 Grados (`hoy` la enseña: «… (calendario)»).
2. **Confirma antes de crear** en una línea: título, fecha y hora, equipo y cuántas casillas se arrastran de la anterior.
3. Con el comando: `crear <tipo> --dia D --hora HH:MM`. Hace todo:
   - no duplica si ya existe;
   - monta la **plantilla del tipo** (`plantilla` en `tipos.json`): las secciones en su orden, los apartados («Puntos fijos», «Temas nuevos»…) y los puntos fijos con su enlace. La Daily lleva «Plaud grabando», Puntos fijos (embudo, oferta, rocas), Parking y Aparcados y mejoras; la Daily de producto, el punto fijo «Las tres últimas piezas de contenido que he visto y qué he actualizado en el playbook de producto» (Weekly de producto 23-nov; Santi: el 80 % de oferta y negocio, «cada dos días alguna cosa de IA»), que cada uno cuenta en Informar, y al final «Pedro - Revisar tus tareas» (Santi, Daily de producto 24-nov: «meto un punto fijo al final de todas nuestras daily de producto, que es revisar tus tareas»); la Weekly no lleva puntos fijos en Temas (Weekly 23-nov) y sí Celebración, Resumen de la semana (CRM, rocas, cumplimiento y vídeos), Postmoto y Nueva semana (solo el enlace a las rocas, sin caja para añadir), Parking y Aparcados;
   - copia a «Revisar» lo sin marcar de la anterior (sus Siguientes pasos y lo de su Revisar que nadie resolvió), sin repetir;
   - **arrastra** el Parking y los Aparcados de la anterior (también el apartado «Parking» de Temas);
   - la «anterior» es la de su **cadena**: la Daily y la Weekly se siguen la una a la otra (`cadena` en `tipos.json`);
   - a «Revisar» va lo que vence ese día o antes (y lo que no tiene fecha); lo de fecha posterior va a «Siguientes pasos», con su fecha;
   - nunca escribe líneas inventadas: lo que no trae nada queda vacío.
4. Eco: `✅ Creada · <título> · <n> pendientes en Revisar · <enlace>`.

Desde el 13-nov-2026 todos los tipos nacen en formato nuevo, también la Daily 6G y la Weekly 6G (decisión de Pedro). Las anteriores siguen como estaban (ver FORMATEAR).

### RECURRENTES (las reuniones que se crean solas)

Daily de producto, redes, Daily y Weekly se crean solas (`recurrente` de cada tipo en `tipos.json`):
- **Cuándo toca:** el día que hay evento de su tipo en el calendario de 6 Grados, a su hora. La Daily de producto (`producto`) no tiene serie propia: va los días de Daily, a su hora si tiene evento o al acabar la Daily. Sin calendario, los `dias` y la `hora` de `tipos.json`.
- **Quién las crea:** una rutina del Mac de Pedro (`sh bin/rutina-mac.sh instalar|estado|quitar`) que cada 30 min, de lunes a viernes, lanza `crear-recurrentes --rutina`. Es la red de seguridad: crea cada reunión solo si a 1 h de empezar nadie la ha creado (`rutina.antes_min`), para no adelantarse a quien las crea siempre (el Claude de Santi crea la Daily y la Weekly; Pablo, la de redes).
- **Nunca duplica:** si ya existe (por fecha o por el día en el título), no la toca.
- **Desde la skill:** `recurrentes` enseña las series y lo que toca hoy; `crear-recurrentes --simular` dice qué crearía; sin `--simular`, las crea. Confirma antes de crear si no lo han pedido así.
- **En la web:** el apartado «Recurrentes» (enlace en Hoy y en Ajustes), con el botón «Crear las de hoy que falten».

### FORMATEAR (pasar al formato una reunión desordenada)

Para una reunión sin las cuatro secciones base (una Daily o Weekly antigua, o una página escrita a mano):
1. `formatear <reunión> [--dia D]` enseña la reunión en Markdown y lo que quedó sin marcar en la anterior.
2. **Haz tú la propuesta** con las reglas de `formato.md`:
   - **Revisar:** lo pendiente (casillas de «To-do's ayer», lo sin marcar de la anterior), con su estado y con su **texto exacto**: sin reformular, sin mover el nombre y sin cortar. Las tareas de cada persona se casan por texto entre reuniones; si cambia, se separan. El comando no las corta.
   - **Informar:** lo que alguien cuenta (actualizaciones).
   - **Temas:** lo que hay que hablar o decidir. Con apartados si la plantilla del tipo los tiene («Puntos fijos», «Temas nuevos»).
   - **Parking:** los temas aparcados (con sus subtítulos Warm, Contenido… como `grupo`). **Aparcados y mejoras:** los pasos que no son para mañana.
   - En la Weekly, **Celebración**, **Resumen de la semana** y **Postmoto** si la página los tiene.
   - **Siguientes pasos:** a lo que alguien se compromete.
   - Cada línea es `Persona - enunciado`, una idea por línea; lo accesorio va al Detalle.
   - No inventes ni pierdas nada: lo que no sepas de quién es, pregúntalo. **Ni un punto que no esté en la página** (Santi, Daily 13-nov: «ese punto no estaba y te lo has inventado»), y cada uno en su sección: un tema no va a Informar.
3. **Enséñala numerada por secciones y espera el ok.** Nada se toca sin él.
4. Con el ok, escribe la propuesta en un JSON y aplica: `formatear <id> --aplicar propuesta.json`. El JSON lleva `{"revisar":[…],"informar":[…],"temas":[…],"pasos":[…]}` y, si hay, `parking`, `aparcados`, `celebracion`, `resumen`, `postmoto`. Cada línea puede ser un texto o `{"texto","detalle":[…],"hecho":bool,"visto":bool,"grupo":"Apartado"}`. Una sección opcional con lista vacía (`"celebracion": []`) se crea vacía; `"previo": ["Plaud grabando"]` son las casillas de antes de la primera sección.
   - El comando pone las secciones (las cuatro base siempre; las demás si traen líneas) y conserva la reunión de antes, en Markdown.
   - En una reunión que ya tiene el formato, solo con `--forzar`.
5. Eco: `✅ <título> ya está en el formato: n en Revisar, n en Informar… · <enlace>`.

La web, en una reunión sin formato, enseña este camino y copia la petición para Claude.

### AÑADIR (informar · tema · siguiente paso)

1. Encuentra la reunión. Sección según la intención: Informar (lo que alguien cuenta), Temas (lo que hay que hablar o decidir; una propuesta empieza por «Propuesta: »), Siguientes pasos (lo que alguien se compromete a hacer).
2. Redacta la línea sin el nombre (el comando lo pone con `--persona`). No hay límite de palabras (desde el 16-nov-2026): una idea clara por línea; los datos o matices accesorios, con `--detalle`, sin perder nada.
3. Siguientes pasos: la persona es quien se compromete, aunque lo diga otro. **Lleva fecha siempre** (`--fecha hoy|mañana|lunes…viernes|18/11|2026-11-18`): si no la han dicho, pregúntala («¿para cuándo?») en vez de inventarla; si no es para ya, va a `aparcados`. Sin fecha, el comando no lo añade.
4. Si la línea ya existe, el comando lo dice y no la duplica.
5. Eco de una línea con lo escrito y el enlace: `✅ Informar · Pedro - Cliente X: sesión 3 dada. · <enlace>`.

### HECHO

1. Localiza la casilla por su texto en «Revisar» y «Siguientes pasos» de la reunión de trabajo. Si casan varias, el comando las lista; pregunta cuál con lista numerada.
2. En **Revisar** se marca aquí **y** su gemela de la reunión anterior (la línea de la que es copia). En «Siguientes pasos», solo aquí. También se pueden marcar casillas de reuniones pasadas.
3. Si no se dice reunión y no está en la de hoy, mira los to-dos de la persona (`todos <persona>`): cada uno trae su reunión, y se marca ahí.
4. Eco con las páginas tocadas: `✅ Hecho · Santi - … · marcada aquí y en la del 2026-11-05`. Si el comando no nombra la reunión anterior, es que no había gemela: dilo; no la inventes.

### PENDIENTE (↓) · QUITAR · EDITAR

Solo en la **reunión de trabajo** (la de hoy o una futura); en una pasada, dilo. El comando lo comprueba.
- **↓** (`pasar … --fecha F`): no está hecha y se vuelve a comprometer con **fecha nueva**; pregunta la fecha si no la dicen. La copia va a «Siguientes pasos» con la fecha y las veces que se ha pasado («↓n»); la de «Revisar» se queda como **pasada**, que es lo que cuenta el cumplimiento. La anterior no se toca.
- **Aparcar** (`aparcar …`): no es para ya. La copia va a «Aparcados y mejoras», sin fecha; en «Revisar» se queda como **aparcada**.
- **Terminar la reunión** (`terminar <reunión>`; en la web, «Terminar reunión» arriba): todo tema de Temas **sin ver** (ni visto ni punto fijo ni del Parking) pasa a Temas de la siguiente reunión de su cadena, con «↓n». Si la siguiente no existe, entra al crearla: `crear` recoge siempre los temas sin ver de la anterior aunque nadie la terminara. Repetirlo no duplica. Pedro (18-nov): «cuando se termine una reunión todos los temas que no se hayan visto se pasen a la siguiente». Al acabar una reunión, lánzalo siempre.
- **Pasar un tema** (`pasar <reunión> "tema"`, sin fecha): no se ha tratado y va a **Temas de la próxima reunión** de su cadena, con «↓1» (las veces que se ha pasado). En esta se queda atenuado («→ próxima reunión»). Si la siguiente ya está creada, aparece en ella al momento. `--no` lo deshace. Los puntos fijos no se pasan: salen solos.
- **Mover a otra reunión** (`mover-a <reunión> "X" producto|redes|daily`): lo que se apuntó en la reunión equivocada se cambia de reunión, no se deja mezclado. Vale para temas, parking, aparcados, siguientes pasos y líneas de Revisar. El paso que se apunta con la siguiente reunión ya creada llega también a ella (a Revisar si vence ese día o antes; si no, a Siguientes pasos).
- **Tema → to-do** (`mover-a <reunión> "tema" pasos --fecha F --persona P`): el tema pasa a «Siguientes pasos» con fecha y con esa persona delante. Si el tema ya lleva persona, `--persona` sobra.
- **Fecha** (`fecha … F`): corrige el día de un paso de «Siguientes pasos» de la reunión de hoy. Lo que ya está en «Revisar» solo cambia de fecha con ↓.
- **Quitar**: la línea va a la papelera (se puede recuperar desde la web, con «Deshacer», en el momento). Confirma antes si no es una línea que acabes de escribir tú.
- **Editar**: corrige el texto (sin límite de palabras); el Detalle se queda.

### ASIGNAR · VISTO

Se pueden hacer en cualquier reunión, como marcar.
- **Asignar**: cambia la persona de la línea. Sustituye su nombre («Pedro - …» o, en las Daily antiguas, «… - Pedro») por el de la otra persona. Si está en «Revisar», también cambia la gemela de la reunión anterior, para que sigan unidas. Eco: `✅ Ahora: Santi - … · <enlace>`.
- **Visto**: marca un punto de Informar o Temas como ya tratado. Al recorrer la reunión, ve marcando lo hablado.

### CONSULTAR

- **«Qué tareas (to-dos) tengo / tiene X»**: `todos <persona>`.
  - Son las casillas sin marcar con su nombre o alias en las reuniones de los últimos 14 días y en las próximas. Agrúpalas por reunión.
  - Manda la copia más reciente (regla en `formato.md`).
- **«Qué quedó pendiente de la anterior»**: `leer <tipo>` y mira el «Revisar» de la de hoy, de todas las personas. Si hoy aún no hay reunión, los «Siguientes pasos» sin marcar de la anterior.
- Salida: lista numerada `1. Santi - texto · para el 2026-11-18 · Daily de producto 2026-11-18 · <enlace>`, agrupada por reunión, con la fecha (di cuáles están vencidas) y las veces pasada. Cierra con «¿Marco alguna como hecha? Dime los números.».
- **«Cómo vamos de cumplimiento»**: `cumplimiento [--semanas N]`. De lo revisado en cada reunión, cuánto estaba hecho y cuánto se pasó a otro día o se aparcó: equipo, por persona y por semana. Cuenta desde el 15-nov-2026. Da también el % **sin las mejoras de Reuniones** (to-dos que hablan de reuniones, temas, siguientes pasos, puntos fijos, menú lateral, resumen…), para que el cumplimiento mida el trabajo de cada uno (Santi, Weekly 23-nov). Da también **cada tarea una vez** (hecha si alguna de sus copias se marcó: el % principal cuenta cada revisión, así que un paso pasado tres veces cuenta tres; Santi, Weekly 23-nov: los pasados sí cuentan) y **de qué reuniones sale** cada persona (Daily de producto, Daily de contenido, Daily 6G y Weekly). En la web, el Resumen de la semana de la Weekly enseña esas columnas y, al pulsar una persona, una frase con por qué le sale ese % (cuántas pasadas, cuántas sin marcar y en qué reunión), cuánto sale de cada serie y cada línea; en Tareas hay un filtro «Mejoras de Reuniones». Explicación para el equipo: https://claude.ai/artifact/VVSymPPwtGwp7uppxfmKsE

### TRANSCRIPCIÓN

1. Con el comando y Plaud conectado: `plaud <tipo> [--dia D]` dice qué grabación es (la que empieza a la hora de la reunión, sacada del calendario), y su estado. `--md` saca la transcripción literal con hablantes y minuto. Si aún no está transcrita, la API oficial de Plaud no puede pedirlo: da el enlace (`--procesar` lo imprime) para que la persona pulse «Generar» en Plaud. Si Plaud no está conectado en esa máquina (`~/.plaud/tokens.json`), `npx -y @plaud-ai/cli@0.3.15 login` lo conecta entrando con Google (hola@6grados.es → «Autorizar»), o invoca la skill `6g-plaud` (por el navegador). `bin/plaud-conectar.mjs` es solo para reconectar la web. Si no está instalada, dilo (README) y ofrece que peguen la transcripción.
2. **El minuto de cada tarea (desde el 25-nov-2026).** Cada casilla guarda cuándo se escribió (`creada` en `leer --json`). Si se escribió mientras se grababa, hora de inicio de la grabación + minuto = el trozo donde se dijo. `plaud <reunión> --pasos` saca cada casilla con su minuto (🎙 mm:ss) y lo dicho los 2 min de antes; para citar o dar contexto de una tarea, **empieza por ese trozo** y amplía hacia atrás o hacia delante mientras dure el tema. Solo las que salen en «Sin minuto» (escritas antes o después de grabar) se buscan por el texto en la transcripción entera. En la web, el botón 🎙 de la casilla abre la transcripción en ese punto. Pedro (25-nov): «si tenemos el tiempo exacto es buenísimo».
3. **No pegues la transcripción en la reunión.** Propón, en lista numerada, lo que saldría como líneas: Informar, Temas, Siguientes pasos, con persona y una idea por línea.
4. Atribuye solo lo que tenga hablante de seguridad alta. Lo dudoso va aparte, sin persona.
5. Con los números que elijan, aplica AÑADIR.

### Reuniones sin formato

Una reunión que no tiene las secciones (por ejemplo, la «Daily Contenido» del 13-nov-2026, que vino de Notion tal cual) solo se lee, salvo FORMATEAR con ok. Así están casi todas las anteriores al 13-nov-2026, que vinieron de Notion.

## Reglas

- **Nunca borres de reuniones pasadas.** Quitar, editar y ↓, solo en la reunión de trabajo; quitar = a la papelera (recuperable).
- **No inventes**: ni líneas, ni personas, ni estados. Lo que no esté claro, se pregunta (preguntas numeradas para contestar con un número).
- **Di siempre qué escribiste y dónde**, con el enlace de la reunión.
- Antes de escribir varias cosas a la vez, enseña el plan numerado y espera el ok.
- Para probar algo, usa el tipo oculto `prueba` con fechas futuras (`crear prueba --dia 2027-01-04`) y bórralo al acabar (`borrar-prueba <id>`). Nunca pruebes sobre una reunión real.
- Si el comando falla o este ordenador no está conectado, no escribas nada y avisa. **Nunca escribas una reunión en Notion**: es solo archivo. Cambiar `tipos.json`, el formato o el código no es cosa de esta skill: se hace en el repo.
