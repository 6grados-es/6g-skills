---
name: 6g-reuniones
description: >-
  El conector con Claude de las reuniones de equipo de 6 Grados (producto, redes, daily, weekly), que viven
  en la base «Reuniones de Equipo» de Notion. Añade informar, temas y siguientes pasos a una reunión, marca
  casillas como hechas, pasa pendientes, crea la reunión del día con lo pendiente de la anterior, lista los
  to-dos de una persona y trae la transcripción de Plaud. La web Reuniones (botones) hace lo mismo desde el
  navegador y es la misma fuente de verdad: Notion. Invócala SIEMPRE que digan «añade un tema a la reunión»
  (de producto o de redes), «añade un punto de informar», «apunta un siguiente paso», «marca como hecho X»,
  «qué to-dos tengo», «qué to-dos tiene Santi», «qué quedó pendiente de la anterior», «crea la reunión de
  producto (o de redes) de hoy», «la transcripción de la reunión X» o «/6g-reuniones». Pide el conector de
  Notion con acceso a 6 Grados. Daily 6G y Weekly 6G (formato antiguo) solo se leen.
---

Se lanza: a demanda («añade un tema a producto», «apunta un siguiente paso», «marca como hecho X», «qué to-dos tengo», «crea la reunión de redes de hoy», «la transcripción de la reunión X»).

# Skill · 6g-reuniones

El conector con Claude de las reuniones de 6 Grados. Todo se lee y se escribe en Notion (base «Reuniones de Equipo»). La web Reuniones (https://reuniones-henna.vercel.app; la URL puede cambiar, es «la web Reuniones») hace lo mismo con botones sobre las mismas páginas: lo que escribes aquí lo ve allí y al revés.

- Formato de la reunión (4 H1, líneas «Persona - enunciado», Detalle, casillas): `references/formato.md`.
- Cómo operar con Notion (buscar, leer, insertar, marcar, REST): `references/notion.md`.

Léelos antes de la primera escritura de la sesión.

## Paso 0 · Datos e identidad (siempre)

1. Lee `tipos.json`: está en la raíz del repo, `~/6grados-es/6g-reuniones/tipos.json`. Si el repo está en otro sitio, sigue el enlace de la skill (`readlink ~/.claude/skills/6g-reuniones`) y sube dos niveles. Es la fuente única de tipos de reunión, personas (ids de Notion), data source y propiedades. No hardcodees nada de lo que esté ahí. Si no lo encuentras (instalada desde `6g-skills`), bájalo del repo privado del equipo: `mkdir -p ~/.claude/skills/6g-reuniones/.cache && gh api repos/6grados-es/6g-reuniones/contents/tipos.json --jq .content | base64 -d > ~/.claude/skills/6g-reuniones/.cache/tipos.json` y úsalo desde ahí (vuelve a bajarlo si tiene más de un día). Si tampoco puedes, di que hace falta acceso a `6grados-es` y para.
2. Identidad: lee `~/.claude/skills/6g-reuniones/.cache/identidad.json` (`{"persona":"pedro","nombre":"Pedro","notion":"<id>","resuelto_at":"AAAA-MM-DD"}`). Si falta, ejecuta **SETUP** (abajo). Si dicen «no soy yo», bórralo y vuelve a preguntar.
3. Esa persona es el prefijo por defecto (`Nombre - `). Si el usuario dice que la línea es de otra («apunta que Santi…», «de Pablo»), usa esa.
4. Necesitas las herramientas del conector de Notion (`notion-search`, `notion-fetch`, `notion-update-page`, `notion-create-pages`). Si no están, avisa y no escribas nada; con `NOTION_TOKEN` puedes al menos leer por REST (`references/notion.md`).

### SETUP (primera vez en la máquina, o «instala» / «configura»)

1. Pregunta «¿quién eres?» con las personas de `tipos.json` en lista numerada y guarda `.cache/identidad.json`.
2. Prueba el acceso: `notion-fetch` del data source de `tipos.json` (`collection://<data_source>`). Si falla, dile que conecte Notion con su cuenta y acceso al espacio de 6 Grados.
3. Confirma en una línea: `✅ Listo. Eres <nombre>. Acceso a Reuniones de Equipo OK.` No toques instrucciones globales ni otros archivos.

## Paso 1 · Enruta por intención

| Dicen | Modo |
|---|---|
| «crea la reunión de producto / de redes (de hoy)» | CREAR |
| «añade a informar…», «para informar: …» | AÑADIR → Informar |
| «añade un tema…», «propuesta: …», «hay que hablar de…» | AÑADIR → Temas |
| «apunta un siguiente paso», «X se encarga de…», «me comprometo a…» | AÑADIR → Siguientes pasos |
| «marca como hecho X», «ya está lo de X» | HECHO |
| «pasa X a siguientes pasos», «sigue pendiente X», «↓» | PENDIENTE |
| «qué to-dos tengo», «qué tiene Santi», «qué quedó pendiente de la anterior» | CONSULTAR |
| «la transcripción de la reunión X», «qué se dijo en…» | TRANSCRIPCIÓN |

## Encontrar la reunión

1. **Tipo.** Reconócelo por `reconocer` de `tipos.json` («producto», «redes», «daily», «weekly»). Si no lo dicen, busca la reunión de hoy de los tipos de formato nuevo en los que está la persona: si hay una sola, esa; si hay varias, pregunta con lista numerada.
2. **Fecha.** La dicha; por defecto, hoy.
3. **Título.** El patrón `titulo` del tipo con la fecha AAAA-MM-DD: `Reunión de producto 2026-11-12`, `Daily Contenido 2026-11-12`, `Daily 6G 2026-11-12`.
4. **Buscar.** `notion-search` con el título exacto y luego `notion-fetch` de la página. Comprueba que el título coincide y que está en formato nuevo (los 4 H1: Revisar, Informar, Temas, Siguientes pasos). Si hay `NOTION_TOKEN`, también vale la consulta REST de `references/notion.md`.
5. **Si no existe:** ofrece crearla (CREAR). Si dicen «la última», busca la más reciente del tipo.
6. **Reunión anterior del mismo tipo** = la más reciente con fecha anterior, mismo patrón de título (`reconocer`), no archivada y en formato nuevo. `Tipo de Reunion` solo no basta: Daily y Weekly comparten «L10».

## Modos

### CREAR (la reunión del día)

1. Resuelve tipo y fecha. Busca si ya existe: si existe, no la dupliques; enseña el enlace.
2. Busca la reunión anterior del mismo tipo y saca de su «Siguientes pasos» las casillas **sin marcar** (`- [ ]`), con el texto idéntico.
3. Si esa anterior tiene casillas sin marcar en su «Revisar» (nadie las resolvió), avísalo: no se arrastran solas. Pregunta si las pasas.
4. **Confirma antes de crear** (una línea): título, fecha, equipo y nº de casillas que se arrastran.
5. Crea la página con `notion-create-pages` en el data source de `tipos.json`: `Nombre` = título del tipo, `Fecha` = fecha, `Equipo` = personas del tipo (sus ids), `Tipo de Reunion` = `tipo_notion`. Cuerpo: los 4 H1 en orden; bajo «Revisar», las casillas copiadas. Si no hay anterior: una viñeta «Sin tareas anteriores: es la primera reunión de <tipo>.». Informar, Temas y Siguientes pasos quedan vacíos.
   **Ojo:** la base tiene una automatización que, 2-3 s después de crear la página, le pone `Fecha` = hoy. Espera unos segundos, vuelve a leer la página y, si la fecha no es la buena, ponla otra vez con `notion-update-page` (comprobado el 12-nov-2026).
6. Eco: `✅ Creada · <título> · <n> pendientes en Revisar · <enlace>`.

Los tipos de formato antiguo (Daily 6G, Weekly 6G) no se crean con esta skill.

### AÑADIR (informar · tema · siguiente paso)

1. Encuentra la reunión. Sección según la intención: Informar (lo que alguien cuenta), Temas (lo que hay que hablar o decidir; una propuesta empieza por «Propuesta: »), Siguientes pasos (lo que alguien se compromete a hacer).
2. Redacta la línea: `Nombre - enunciado`. **Máximo 15 palabras contando el nombre**, sin negritas ni listas dentro. Si lo dicho cabe, escríbelo tal cual. Si es más largo, resume a ≤15 palabras y mete el resto, sin perder datos, en un toggle **Detalle** hijo de la línea, con viñetas simples.
3. Formato de bloque: numerada en Informar y Temas; casilla `- [ ]` en Siguientes pasos.
4. Insértala **al final de su sección** (después de la última línea y de sus Detalle, antes del siguiente H1) con `notion-update-page`. Nunca reescribas la página entera.
5. Si ya existe una línea idéntica, avisa y no la dupliques.
6. Eco de una línea con lo escrito y el enlace: `✅ Informar · Pedro - Alberto (Intrexia): sesión 3 dada. · <enlace>`.

### HECHO

1. Localiza la casilla por su texto en «Revisar» y «Siguientes pasos» de la reunión de trabajo. Si casan varias, lista numerada y que elijan.
2. Si está en **Revisar**: márcala `- [x]` aquí **y** la de texto idéntico en «Siguientes pasos» de la reunión anterior del mismo tipo (el texto idéntico es lo que permite encontrarla). Si está en «Siguientes pasos» de esta reunión: solo aquí.
3. Si no se dice reunión y no está en la de hoy, búscala en «Siguientes pasos» de las últimas reuniones del tipo y marca la más reciente sin marcar.
4. Eco con las páginas tocadas: `✅ Hecho · Santi - … · marcada aquí y en 2026-11-05`. Si la gemela no aparece (texto cambiado), dilo; no la inventes.

### PENDIENTE (↓)

La casilla pasa de «Revisar» a «Siguientes pasos» **de esta misma reunión**: crea la misma línea (texto idéntico, sin marcar) al final de «Siguientes pasos» y quítala de «Revisar». En la reunión anterior no se toca nada. Solo se quita en la reunión de trabajo (la de hoy o la que se esté llevando); si es una reunión pasada, pregunta antes. Detalles de «quitar» en `references/notion.md`.

### CONSULTAR

- **«Qué to-dos tengo / tiene X»**: casillas sin marcar con el nombre de la persona (en cualquier posición: `Santi - …`, `Tarea - Santi`; sin distinguir mayúsculas ni tildes, y con los alias conocidos: Santiago, Alejandro, Oli, Maria) en las reuniones de los últimos 30 días, formato nuevo y también Daily/Weekly. Con `NOTION_TOKEN`, consulta por rango de `Fecha`; sin él, `notion-search` por los títulos de cada tipo y `notion-fetch` de las más recientes (di cuántas has revisado).
- Una casilla vale por su texto: si una copia está marcada en cualquier reunión posterior, está hecha y no se lista. Si sale sin marcar en varias, una sola vez, con su reunión de origen.
- **«Qué quedó pendiente de la anterior»**: «Siguientes pasos» sin marcar de la reunión anterior del tipo, de todas las personas.
- Salida: lista numerada `1. Santi - texto · Reunión de producto 2026-11-05 · <enlace>`, agrupada por reunión. Cierra con «¿Marco alguna como hecha? Dime los números.».

### TRANSCRIPCIÓN

1. Invoca la skill `6g-plaud` con la reunión (tipo, fecha, hora). Ella localiza la grabación, saca la literal y separa a los hablantes. Si no está instalada, dilo (README) y ofrece que peguen la transcripción.
2. **No pegues la transcripción en Notion.** Propón, en lista numerada, lo que saldría como líneas: Informar, Temas, Siguientes pasos, con persona y ≤15 palabras cada una.
3. Atribuye solo lo que tenga hablante de seguridad alta. Lo dudoso va aparte, sin persona.
4. Con los números que elijan, aplica AÑADIR.

### Formato antiguo (Daily 6G, Weekly 6G)

Solo lectura: nada de moverlas ni reescribirlas. Escribir en una exige petición expresa («escríbelo en la Daily de hoy»): entonces añade solo esa línea al final, sin tocar el resto, y dilo. Si no, ofrece pasarlo a Producto o Redes.

## Reglas

- **Nunca borres de reuniones pasadas.** «Quitar» = archivar el bloque (recuperable) y solo en la reunión de trabajo.
- **No inventes**: ni líneas, ni personas, ni estados. Lo que no esté claro, se pregunta (preguntas numeradas para contestar con un número).
- **Di siempre qué escribiste y dónde**, con el enlace de la página.
- Antes de escribir varias cosas a la vez, enseña el plan numerado y espera el ok.
- Si Notion falla o no hay conector: lectura si se puede, nada de escritura, y avisa. Cambiar `tipos.json` o el formato no es cosa de esta skill: se hace en el repo.
