---
name: 6g-reuniones
description: >-
  El conector con Claude de las reuniones de equipo de 6 Grados (producto, redes, daily, weekly), que viven
  en la base «Reuniones de Equipo» de Notion. Añade informar, temas y siguientes pasos a una reunión, marca
  casillas como hechas, pasa pendientes, quita o corrige líneas, crea la reunión del día con lo pendiente de la
  anterior, lista los to-dos de una persona y trae la transcripción de Plaud. Usa el mismo código y las mismas
  reglas que la web Reuniones (los botones): la fuente de verdad es Notion. Invócala SIEMPRE que digan «añade un
  tema a la reunión» (de producto o de redes), «añade un punto de informar», «apunta un siguiente paso», «marca
  como hecho X», «quita la línea X», «qué to-dos tengo», «qué to-dos tiene Santi», «qué quedó pendiente de la
  anterior», «crea la reunión de producto (o de redes) de hoy», «la transcripción de la reunión X» o
  «/6g-reuniones». Daily 6G y Weekly 6G (formato antiguo) solo se leen.
---

Se lanza: a demanda («añade un tema a producto», «apunta un siguiente paso», «marca como hecho X», «qué to-dos tengo», «crea la reunión de redes de hoy», «la transcripción de la reunión X»).

# Skill · 6g-reuniones

El conector con Claude de las reuniones de 6 Grados. Todo se lee y se escribe en Notion (base «Reuniones de Equipo»). La web Reuniones (https://reuniones-henna.vercel.app) hace lo mismo con botones sobre las mismas páginas: lo que escribes aquí lo ve allí y al revés.

- Formato y reglas (4 H1, «Persona - enunciado», 15 palabras, Detalle, qué se puede hacer en cada reunión, to-dos): `references/formato.md`.
- Cómo operar con Notion sin el comando (conector de Notion o REST): `references/notion.md`.

Léelos antes de la primera escritura de la sesión.

## Paso 0 · Datos, identidad y vía (siempre)

1. **`tipos.json`**: está en la raíz del repo, `~/6grados-es/6g-reuniones/tipos.json`. Si el repo está en otro sitio, sigue el enlace de la skill (`readlink ~/.claude/skills/6g-reuniones`) y sube dos niveles. Es la fuente única de tipos de reunión, personas (ids de Notion y alias), data source, propiedades y días de to-dos. No hardcodees nada de lo que esté ahí. Los tipos con `"oculto": true` no existen para el equipo: no los ofrezcas.
   Si no está el repo (skill instalada desde `6g-skills`), baja solo `tipos.json`: `mkdir -p ~/.claude/skills/6g-reuniones/.cache && gh api repos/6grados-es/6g-reuniones/contents/tipos.json --jq .content | base64 -d > ~/.claude/skills/6g-reuniones/.cache/tipos.json` (vuelve a bajarlo si tiene más de un día). Si tampoco puedes, di que hace falta acceso a `6grados-es` y para.
2. **Identidad**: lee `~/.claude/skills/6g-reuniones/.cache/identidad.json` (`{"persona":"pedro","nombre":"Pedro","notion":"<id>","resuelto_at":"AAAA-MM-DD"}`). Si falta, ejecuta **SETUP**. Si dicen «no soy yo», bórralo y vuelve a preguntar. Esa persona es el prefijo por defecto (`Nombre - `). Si la línea es de otra («apunta que Santi…», «de Pablo»), usa esa.
3. **Vía para Notion**, en este orden:
   1. **El comando** `node <repo>/bin/reuniones.mjs …`. Es el mismo código que la web, así que aplica solo todas las reglas: las 15 palabras y el Detalle, no duplicar, el Revisar heredado, la fecha que Notion pisa al crear y qué se puede hacer en cada reunión. Sirve si está el repo y hay `NOTION_TOKEN` (en el entorno o en `~/.config/notion/credentials`). Pruébalo con `node bin/reuniones.mjs hoy`. Sin argumentos enseña la ayuda.
   2. Si no, **el conector de Notion** (`notion-search`, `notion-fetch`, `notion-update-page`, `notion-create-pages`), siguiendo `references/notion.md` y aplicando tú las reglas de `formato.md`.
   3. Si no hay ninguna de las dos, avisa y no escribas nada.

### SETUP (primera vez en la máquina, o «instala» / «configura»)

1. Pregunta «¿quién eres?» con las personas de `tipos.json` en lista numerada y guarda `.cache/identidad.json`.
2. Prueba el acceso: `node bin/reuniones.mjs hoy` o, sin repo, `notion-fetch` del data source (`collection://<data_source>`). Si falla, dile que conecte Notion con acceso al espacio de 6 Grados.
3. Confirma en una línea: `✅ Listo. Eres <nombre>. Acceso a Reuniones de Equipo OK.` No toques instrucciones globales ni otros archivos.

## Paso 1 · Enruta por intención

| Dicen | Modo | Comando (desde la raíz del repo) |
|---|---|---|
| «crea la reunión de producto / de redes (de hoy)» | CREAR | `crear producto [--dia D] [--hora HH:MM]` |
| «añade a informar…», «para informar: …» | AÑADIR → Informar | `anadir producto informar "…" --persona pedro [--detalle "…"]` |
| «añade un tema…», «propuesta: …», «hay que hablar de…» | AÑADIR → Temas | `anadir producto temas "…" --persona pedro` |
| «apunta un siguiente paso», «X se encarga de…», «me comprometo a…» | AÑADIR → Siguientes pasos | `anadir producto pasos "…" --persona santi` |
| «marca como hecho X», «ya está lo de X» | HECHO | `marcar producto "X"` (`--no` para desmarcar) |
| «pasa X a siguientes pasos», «sigue pendiente X», «↓» | PENDIENTE | `pasar producto "X"` |
| «quita X», «borra la línea X» | QUITAR | `quitar producto "X"` |
| «corrige X por Y» | EDITAR | `editar producto "X" "Y"` |
| «qué to-dos tengo», «qué tiene Santi» | CONSULTAR | `todos santi` |
| «qué quedó pendiente de la anterior», «cómo va la reunión» | CONSULTAR | `leer producto [--dia D]` |
| «la transcripción de la reunión X», «qué se dijo en…» | TRANSCRIPCIÓN | skill `6g-plaud` |

`producto` puede ser cualquier tipo de `tipos.json` (la reunión de ese tipo de hoy, o la de `--dia`) o el id de la página. Las líneas se buscan por texto, exacto o una parte. Si casan varias, el comando lista los ids para elegir.

## Encontrar la reunión (sin el comando)

1. **Tipo.** Por `reconocer` de `tipos.json` («producto», «redes», «daily», «weekly»). Si no lo dicen, busca la reunión de hoy de los tipos de formato nuevo en los que está la persona: si hay una sola, esa; si hay varias, pregunta con lista numerada.
2. **Fecha.** La dicha; por defecto, hoy.
3. **Título.** El patrón `titulo` del tipo con la fecha AAAA-MM-DD: `Reunión de producto 2026-11-12`, `Daily Contenido 2026-11-12`, `Daily 6G 2026-11-12`.
4. **Buscar** con `notion-search` el título exacto y `notion-fetch` de la página. Comprueba el título y los 4 H1.
5. **Si no existe:** ofrece crearla (CREAR). Si dicen «la última», la más reciente del tipo.
6. **Reunión anterior del mismo tipo** = la más reciente con fecha anterior y título del tipo (`reconocer`), no archivada. `Tipo de Reunion` solo no basta: Daily y Weekly comparten «L10».

## Modos

### CREAR (la reunión del día)

1. Resuelve tipo, fecha y hora. La hora es opcional; con hora, la reunión dura los `minutos` del tipo.
2. **Confirma antes de crear** en una línea: título, fecha y hora, equipo y cuántas casillas se arrastran de la anterior.
3. Con el comando: `crear <tipo> --dia D --hora HH:MM`. Hace todo:
   - no duplica si ya existe;
   - copia a «Revisar» lo sin marcar de la anterior (sus Siguientes pasos y lo de su Revisar que nadie resolvió), sin repetir;
   - vuelve a poner la fecha cuando la automatización de la base la pisa.

   Sin el comando: `references/notion.md` → «Crear una reunión», con esas mismas reglas.
4. Eco: `✅ Creada · <título> · <n> pendientes en Revisar · <enlace>`.

Los tipos de formato antiguo (Daily 6G, Weekly 6G) no se crean con esta skill.

### AÑADIR (informar · tema · siguiente paso)

1. Encuentra la reunión. Sección según la intención: Informar (lo que alguien cuenta), Temas (lo que hay que hablar o decidir; una propuesta empieza por «Propuesta: »), Siguientes pasos (lo que alguien se compromete a hacer).
2. Redacta la línea sin el nombre (el comando lo pone con `--persona`). Si lo dicho cabe en 15 palabras con el nombre, va tal cual. Si es más largo, **resume tú** a una línea clara y pasa el resto con `--detalle`, una opción por idea, sin perder datos. Si aun así pasa de 15, el comando la corta y manda lo que sobra al Detalle.
3. Siguientes pasos: la persona es quien se compromete, aunque lo diga otro.
4. Si la línea ya existe, el comando lo dice y no la duplica.
5. Eco de una línea con lo escrito y el enlace: `✅ Informar · Pedro - Cliente X: sesión 3 dada. · <enlace>`.

### HECHO

1. Localiza la casilla por su texto en «Revisar» y «Siguientes pasos» de la reunión de trabajo. Si casan varias, el comando las lista; pregunta cuál con lista numerada.
2. En **Revisar** se marca aquí **y** la de texto idéntico en la reunión anterior. En «Siguientes pasos», solo aquí. También se pueden marcar casillas de reuniones pasadas.
3. Si no se dice reunión y no está en la de hoy, mira los to-dos de la persona (`todos <persona>`): cada uno trae su reunión, y se marca ahí.
4. Eco con las páginas tocadas: `✅ Hecho · Santi - … · marcada aquí y en la del 2026-11-05`. Si la gemela no aparece (texto cambiado), dilo; no la inventes.

### PENDIENTE (↓) · QUITAR · EDITAR

Solo en la **reunión de trabajo** (la de hoy o una futura); en una pasada, dilo y ofrece hacerlo en Notion. El comando lo comprueba.
- **↓**: la casilla pasa al final de «Siguientes pasos» de esta reunión, igual y con su Detalle, y sale de «Revisar». La anterior no se toca.
- **Quitar**: archiva la línea (papelera de Notion, recuperable). Confirma antes si no es una línea que acabes de escribir tú.
- **Editar**: corrige el texto (máximo 15 palabras); el Detalle se queda.

### CONSULTAR

- **«Qué to-dos tengo / tiene X»**: `todos <persona>`.
  - Son las casillas sin marcar con su nombre o alias en las reuniones de los últimos 14 días, de formato nuevo y también Daily/Weekly.
  - Manda la copia más reciente (regla en `formato.md`).
  - Sin el comando: consulta REST por rango de `Fecha` o, con el conector, `notion-fetch` de las reuniones de esas dos semanas. Di cuántas has revisado.
- **«Qué quedó pendiente de la anterior»**: `leer <tipo>` y mira el «Revisar» de la de hoy, de todas las personas. Si hoy aún no hay reunión, los «Siguientes pasos» sin marcar de la anterior.
- Salida: lista numerada `1. Santi - texto · Reunión de producto 2026-11-05 · <enlace>`, agrupada por reunión. Cierra con «¿Marco alguna como hecha? Dime los números.».

### TRANSCRIPCIÓN

1. Invoca la skill `6g-plaud` con la reunión (tipo, fecha, hora). Ella localiza la grabación, saca la literal y separa a los hablantes. Si no está instalada, dilo (README) y ofrece que peguen la transcripción.
2. **No pegues la transcripción en Notion.** Propón, en lista numerada, lo que saldría como líneas: Informar, Temas, Siguientes pasos, con persona y ≤15 palabras cada una.
3. Atribuye solo lo que tenga hablante de seguridad alta. Lo dudoso va aparte, sin persona.
4. Con los números que elijan, aplica AÑADIR.

### Formato antiguo (Daily 6G, Weekly 6G)

Solo lectura: nada de moverlas ni reescribirlas. Escribir en una exige petición expresa («escríbelo en la Daily de hoy»): entonces añade solo esa línea al final, sin tocar el resto, y dilo. Si no, ofrece pasarlo a Producto o Redes.

## Reglas

- **Nunca borres de reuniones pasadas.** Quitar, editar y ↓, solo en la reunión de trabajo; quitar = archivar (recuperable).
- **No inventes**: ni líneas, ni personas, ni estados. Lo que no esté claro, se pregunta (preguntas numeradas para contestar con un número).
- **Di siempre qué escribiste y dónde**, con el enlace de la página.
- Antes de escribir varias cosas a la vez, enseña el plan numerado y espera el ok.
- Para probar algo, usa el tipo oculto `prueba` con fechas futuras (`crear prueba --dia 2027-01-04`) y archívalo al acabar (`archivar-pagina <id>`). Nunca pruebes sobre una reunión real.
- Si Notion falla o no hay vía, solo lectura si se puede (nada de escritura) y avisa. Cambiar `tipos.json`, el formato o el código no es cosa de esta skill: se hace en el repo.
