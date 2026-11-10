# Aviso de modificación (Apache License 2.0, sección 4)

Esta carpeta es una copia de **whatsapp-web.js 1.34.7** (https://github.com/wwebjs/whatsapp-web.js, licencia Apache-2.0, ver `LICENSE`), tomada del commit `942d236a11ad68807308b058303ba5256915979c` de la rama principal.

Ficheros modificados respecto a ese commit:

- `src/util/Injected/Utils.js`: compatibilidad con WhatsApp Web 2.3000.x, donde el identificador interno `_serialized` pasó a llamarse `$1` (ISSUE-388), y aislamiento de fallos por chat al serializar (ISSUE-393). El cambio exacto está en `PARCHE-Utils.js.diff` (`diff -u` contra el original).
- `package.json`: sin los campos `scripts` y `devDependencies` (el script `prepare` ejecuta `husky`, que no existe fuera del repositorio de origen y haría fallar `npm install`).
- Eliminados (no se usan): `.husky`, configuración de lint y de commits, `example.js`, `shell.js`, `README.md`.

Por qué va copiada y no como dependencia: sin ese parche, la descarga de adjuntos no ve ninguna en las versiones actuales de WhatsApp Web, y una dependencia `github:…` exigiría tener git instalado (no es lo normal en un Windows de oficina). `npm install` la enlaza desde `scripts/package.json` (`file:./vendor/whatsapp-web.js`).

**Reproducirla limpia**: clonar el repositorio original en ese commit, aplicar `PARCHE-Utils.js.diff` sobre `src/util/Injected/Utils.js` (`patch -p0` o `git apply` ajustando la ruta) y quitar `scripts` y `devDependencies` del `package.json`.

Este proyecto no está afiliado a WhatsApp ni a Meta. Usar la librería va contra las condiciones de uso de WhatsApp; ver `../../../references/privacidad.md`.
