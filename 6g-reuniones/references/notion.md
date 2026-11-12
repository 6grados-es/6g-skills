# Cómo operar con Notion (reuniones)

> **Si tienes el repo y `NOTION_TOKEN`, usa el comando `bin/reuniones.mjs`** (SKILL.md, paso 0): hace todo esto solo y con el mismo código que la web. Esta guía es para cuando solo hay el conector de Notion, o para entender qué hace el comando.

Los ids (data source, personas) y los nombres de propiedades están en `tipos.json`; no los copies aquí. Propiedades de la base «Reuniones de Equipo»: `Nombre` (título), `Fecha`, `Equipo` (personas), `Tipo de Reunion`, `Archivado`.

> Antes de la primera escritura de la sesión, haz un `notion-fetch` del data source (`collection://<data_source de tipos.json>`) y confirma los nombres exactos de las propiedades. Si Notion las ha renombrado, usa las del schema y avisa.

## Buscar

- `notion-search` con el título exacto (`Reunión de producto 2026-11-12`). Si la herramienta admite filtrar por data source, pásale `collection://<data_source>`; si no, comprueba el título en los resultados.
- Luego `notion-fetch` de la página (id o URL). Devuelve Markdown de Notion: casillas `- [ ]` / `- [x]`, numeradas `1.`, encabezados `# `, toggles `<details><summary>…</summary>…</details>`.
- La búsqueda puede no listar todo. Para «la reunión anterior» busca por el prefijo del título (`Reunión de producto`), ordena por la fecha del título y confirma con `notion-fetch`.
- Enlace de una página: `https://www.notion.so/<id sin guiones>`.

## Crear una reunión

`notion-create-pages`, parent `{"type":"data_source_id","data_source_id":"<data_source>"}`.

- `Nombre`: el título del tipo. `date:Fecha:start`: AAAA-MM-DD. `Tipo de Reunion`: `tipo_notion`.
- `Equipo`: los ids de Notion de las personas del tipo, como lista: `["<id>","<id>"]`. Tras crear, comprueba con `notion-fetch` que quedaron todas.
- `content` (cuerpo), con los 4 H1 en orden:

```
# Revisar
- [ ] Santi - Loom de contactos personales en el CRM
# Informar
# Temas
# Siguientes pasos
```

Bajo «Revisar» van las casillas sin marcar de la anterior: las de sus «Siguientes pasos» y las de su «Revisar» que nadie resolvió, sin repetir textos y con su Detalle. Primera reunión del tipo: `- Sin tareas anteriores: es la primera reunión de producto.`

Con hora: `date:Fecha:start` = `AAAA-MM-DDTHH:MM:00`, `date:Fecha:end` = la hora más los `minutos` del tipo y zona `Europe/Madrid`. **Después**, espera 3 s, vuelve a leer la página y, si la automatización de la base ha puesto `Fecha` = hoy, vuelve a poner la buena (repítelo hasta que se quede).

## Insertar una línea al final de su sección

Con `notion-update-page` en su modo de **insertar contenido después de un texto** (`insert_content_after` con `selection_with_ellipsis` o equivalente). Los nombres de las órdenes cambian entre versiones del conector: mira el esquema cargado.

- Punto de inserción = la **última línea de la sección**, incluidos sus hijos «Detalle». Si la sección está vacía, el propio encabezado (`# Informar`).
- La selección tiene que ser única en la página. Si dos líneas empiezan igual, usa más texto (inicio…fin).
- Contenido a insertar:

```
1. Pedro - Cliente X: sesión 3 dada, clases abiertas hasta la 7.
	<details>
	<summary>Detalle</summary>
		- Próxima sesión: martes 17-nov, 13:00.
	</details>
```

  Hijos con tabulador (no espacios). En listas numeradas el número da igual: Notion renumera por posición. Siguientes pasos: `- [ ] Santi - Revisar los niveles en la plataforma`.
- Sin Detalle, solo la línea.
- Si la línea pasa de 15 palabras (nombre incluido, el guion no cuenta), córtala como dice `formato.md` y pon lo que sobra, empezando por «…», como primera viñeta del Detalle.
- Antes de insertar, comprueba que no hay ya una línea igual en esa sección. Si la sección solo tiene el hueco vacío de la plantilla, escribe en él en vez de añadir otra.
- Después, `notion-fetch` y comprueba que la línea quedó dentro de su sección y que el toggle quedó anidado. Si no, corrige los tabuladores.

## Marcar una casilla

Sustituir el texto de la casilla por el mismo con la marca: `- [ ] Santi - Loom…` pasa a `- [x] Santi - Loom…` (`notion-update-page` en su modo de **sustituir un texto por otro**: `update_content` con old/new, o `replace_content_range`). Selecciona solo la línea de la casilla, nunca sus hijos «Detalle», y comprueba después que el Detalle sigue ahí. Hazlo en cada página que toque (esta y la de origen), una a una.

## Quitar una línea

Solo en la reunión de trabajo (la de hoy o una futura). Archiva el bloque por REST (abajo) o, con el conector, sustituye su texto por vacío. Notion guarda el historial de la página, así que es recuperable. En una reunión pasada, no.

Para deshacer, no saques el bloque de la papelera: Notion lo devuelve al **final** de la página. Vuelve a crear la misma línea (con su Detalle) detrás del bloque que tenía delante.

## No hagas nunca

- Sustituir el **contenido entero** de una reunión existente (`replace_content` de toda la página): se pierde lo que otros han escrito a la vez.
- Escribir sin haber leído antes la página en esta sesión.

## Fallback REST (solo si existe `NOTION_TOKEN` en el entorno)

Cabeceras: `Authorization: Bearer $NOTION_TOKEN`, `Notion-Version: 2025-09-03`, `Content-Type: application/json`. El MCP de Notion no consulta con filtros en este workspace: para listar reuniones por rango de fechas, esto sí.

- **Consultar** (`POST https://api.notion.com/v1/data_sources/<data_source>/query`):

```json
{"filter":{"and":[
  {"property":"Fecha","date":{"on_or_after":"2026-10-29"}},
  {"property":"Archivado","checkbox":{"equals":false}}
]},"sorts":[{"property":"Fecha","direction":"descending"}]}
```

  Para una reunión concreta: `{"filter":{"property":"Nombre","title":{"equals":"Reunión de producto 2026-11-12"}}}`. Si `Archivado` no es casilla en el schema, quita ese filtro. Pagina con `next_cursor`.
- **Leer el cuerpo:** `GET /v1/blocks/<page_id>/children?page_size=100` (los hijos de un bloque, con su propio id). Las casillas son bloques `to_do` con `checked`.
- **Marcar:** `PATCH /v1/blocks/<block_id>` con `{"to_do":{"checked":true}}`.
- **Añadir después de un bloque:** `PATCH /v1/blocks/<page_id>/children` con `{"children":[…],"after":"<block_id>"}`.
- **Quitar (archivar):** `PATCH /v1/blocks/<block_id>` con `{"in_trash":true}`.

Prefiere el MCP para escribir; REST para consultar y como salida si el MCP falla. El token es de cada persona: jamás lo escribas en un archivo, en el repo ni en el chat.
