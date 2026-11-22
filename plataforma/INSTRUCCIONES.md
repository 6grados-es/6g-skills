# Cómo rellenar y mantener la plataforma (lo lee Claude, no tú)

La carpeta «Plataforma» es una web de una sola página: `index.html` (el diseño, no se toca), `datos.js` (los datos) y un puente local, `servidor.mjs`, que deja cambiar cosas desde la propia web. Se abre con doble clic en «Abrir plataforma» (Mac: `Abrir plataforma.command`; Windows: `Abrir plataforma.bat`), que arranca el puente y la abre en http://localhost:4700. Con doble clic en `index.html` solo se puede mirar.

Tres pestañas, una por nivel: **Conectores** (nivel 1), **Skills y rutinas** (nivel 2) y **Apps** (nivel 4). Cada una nace **bloqueada** y se desbloquea cuando se pega su prompt.

## Reglas para Claude
1. Solo se edita `datos.js`. `index.html` y `servidor.mjs` no se tocan, salvo que la persona pida cambiar el diseño.
2. Cada prompt rellena **solo su pestaña**: sustituye esa lista, pone su `desbloqueado.<pestaña>` en `true`, rellena `actualizado` (dd-mm-aaaa) y no toca las demás.
3. Los datos salen de lo que la persona **de verdad tiene**. Si dudas, pregúntale o déjalo fuera. Nada inventado.
4. Nunca escribas contraseñas, claves, tokens ni códigos.
5. **Que se vea**: cada servicio lleva su logo (`logo`, el nombre de la marca en simple-icons: `gmail`, `googledrive`, `googlecalendar`, `notion`, `whatsapp`, `github`, `supabase`, `vercel`, `googlechrome`, `miro`, `googlegemini`, `slack`, `dropbox`…, comprobado en https://cdn.jsdelivr.net/npm/simple-icons@13.21.0/icons/<nombre>.svg). La web los enseña en su color oficial. Si la marca no está, o es una web con su propio icono, `imagen` (https) o un emoji en `icono` (🎙️). Cada skill lleva un emoji en `icono` que diga lo que hace, y cada área de skills el suyo en `areas`. Las apps y los artefactos, no: su logo o un icono plano (ver «Apps»).
6. Al terminar: arranca el puente (`node servidor.mjs` en segundo plano, si no está ya), abre http://localhost:4700 y di en dos líneas qué has puesto.
7. **Mantener al día**, sin que te lo pidan: cuando la persona conecte algo, cree una skill, programe una tarea o monte una app, añade su línea. **Cada artefacto que crees** se añade a `apps` con `tipo: "artefacto"`, su `url` y la `fecha` (dd-mmm). **No toques `visibles`** (qué pestañas se enseñan: la persona lo cambia en «Configuración»). **Nunca vuelvas a añadir lo que esté en `quitadas`** (misma `url` o mismo nombre): la persona lo quitó del panel. Al poner al día los conectores, **no pises `alias`** (el nombre que la persona le puso a una cuenta).
8. **Aplicar los cambios hechos en la web**: la web guarda en `cambios.json` lo que solo puede hacer Claude y la persona te lo pasa con el botón «Copiar a Claude» (un texto con la lista). También cuando diga «aplica los cambios de mi plataforma». Aplica cada línea con `hecho: false`:
   - `cambiar-disparador`, `activar-tarea`, `pausar-tarea`: en la tarea programada (`tarea_id`; si no lo hay, búscala por nombre). `disparador.crons` son los horarios en formato cron (uno por cada horario: p. ej. lunes a las 9 y viernes a las 18 son dos crons de una misma rutina; `disparador.cron` es el primero).
   - `crear-tarea-programada`: crea la tarea que lanza esa skill (`skill`) o hace lo que dice `texto`, con esos horarios, y guarda su `tarea_id` en la rutina.
   - **Dónde se ejecuta (`donde`)**: `en tu ordenador` = tarea programada local de la app de Claude (solo corre con el ordenador encendido y Claude abierto, y usa los archivos y skills del ordenador); `en la nube` = rutina en la nube de Claude (corre aunque el ordenador esté apagado, pero no ve archivos ni skills locales: si la skill vive solo en el ordenador, avísale a la persona antes de moverla). Si cambia `donde`, crea la tarea en el sitio nuevo, comprueba que está y borra la del sitio viejo (con el ok de la persona); apunta el nuevo `tarea_id`.
   - **Por ahora las rutinas solo se programan en el calendario** (disparador `hora`): días de la semana y hora, o cada hora dentro de una franja. Si la persona quiere «cuando llegue un correo que pida una factura», se hace como una rutina «cada hora» (`frecuencia: "cada-hora"`) cuya skill mira el correo y, solo si hay un caso así, lanza la skill que toca; apúntalo en `disparador.comprueba`. Los tipos `correo`, `skill` y `evento` solo existen en datos viejos y se siguen enseñando, pero no se crean nuevos.
   - Una skill que lance otra al terminar (`encadenar-skill`, abajo) sigue permitida: no es una tarea programada.
   - `encadenar-skill`: añade como último paso del `SKILL.md` de `skill` que lance `despues` (o lo que diga `texto`, que puede tener condiciones: «si es una factura, lanza la de facturas»). `quitar-encadenado`: quita ese paso.
   - Cambios viejos `eliminar-artefacto`: no borres nada; márcalos como hechos.
   Después marca cada una con `hecho: true`, quita `pendiente` (de la rutina o de `despues` en la skill) en `datos.js` y di en una línea qué has aplicado.
   - «Ejecutar ahora» no deja cambio: la web copia un texto para que lances la rutina en ese chat.
9. Encender o apagar una skill lo hace ya el puente (mueve su carpeta entre `.claude/skills` y `.claude/skills-desactivadas`); para eso cada skill necesita su `ruta`.
10. Marca: blanco y negro con el sistema de diseño de 6 Grados. Para adaptarla, solo `marca` (nombre, siglas, logo https, `acento` #rrggbb).

## Forma de `datos.js`
```js
window.PLATAFORMA = {
  marca: { nombre, siglas, subtitulo, logo, acento },
  cliente: "Nombre", actualizado: "22-11-2026",
  desbloqueado: { conectores: false, skills: false, apps: false },
  prompts: { conectores: "…", skills: "…", apps: "…" },
  areas: { "Clientes": "🤝", "Correo": "✉️" },
  conectores: [ { servicio, logo, imagen, icono, para, cuentas: [ { cuenta, alias, tipo, estado } ] } ],
  skills:     [ { nombre, titulo, area, icono, logo, para, palabras, barra, activada, programada, estado, llama_a, ruta, despues: { skill, texto, pendiente } } ],
  rutinas:    [ { id, nombre, que, activa, disparador: { tipo: "hora", texto, horarios: [ { frecuencia, dias, hora, desde, hasta } ], crons, cron, comprueba }, donde: "en tu ordenador"|"en la nube", skill, tarea_id, pendiente } ],
  apps:       [ { nombre, logo, imagen, figura, para, tipo, url, abrir, estado, fecha } ],
  visibles:   { conectores: true, skills: true, apps: true },   // lo cambia la persona en «Configuración»; no lo toques
  quitadas:   [ { nombre, url, tipo, fecha } ]
};
```

### Conectores
- **Una tarjeta por servicio, con sus cuentas dentro.** Dos Gmail = un `servicio: "Gmail"` con dos `cuentas`. `cuenta`: cómo la reconoce la persona («Personal», «Trabajo · hola@»), sin escribir el correo entero.
- `tipo`: **Conector** (oficial) · **Login** · **Token** · **Navegador** · **API**. `estado`: `ok` (probado con una llamada real), `falla` o `pendiente`.
- **Aquí sale TODA conexión, de cualquier tipo.** No solo los conectores de la app de Claude: también cada servicio al que Claude entra con una clave o un token (una API como Groq, Holded o Eventbrite), por login, por el navegador o con un script. Antes de dar la pestaña por hecha, busca también las claves (ficheros `claves.env`, `~/.config/…`, variables de entorno), las sesiones guardadas y los scripts que llaman a un servicio; si hay uno que no está en la lista, añádelo. Si no lo has podido probar con una llamada real, va con `estado: "pendiente"`, pero va. Y al conectar algo nuevo, lo añades en ese momento (regla 7). Pedro (22-nov): «siempre debe aparecer… cualquier conexión de cualquier tipo».
- Logo: si el servicio no está en simple-icons ni en la lista `COLOR` de `index.html`, usa `icono` (emoji); no dejes la tarjeta sin imagen.

### Skills y rutinas
- `titulo`: lo que hace, en palabras de persona («Bienvenida a un cliente»); `nombre`: el de la carpeta. `area`: 4-7 áreas.
- `palabras`: una frase típica que la activa. `barra`: el comando. `activada`: si está encendida. `programada`: `null` o la frase de cuándo se lanza sola. `estado`: `lista`, `en-construccion` o `por-hacer`. `llama_a`: otras skills que usa (de su `SKILL.md`). `ruta`: su carpeta (`~/.claude/skills/<nombre>` o la del cerebro).
- `despues`: la skill que lanza al terminar (encadenada), si la hay; `llama_a` son las que usa por dentro.
- Solo son rutinas las que se lanzan solas. Lo que la persona lanza a mano («cuando lo pides») no es una rutina: es una skill sin programar.
- Si algo «cuando pasa algo» en realidad lo mira Claude cada cierto tiempo (por ejemplo, cada hora busca reuniones terminadas), ponlo en `disparador.comprueba` («cada hora»): la tarjeta dice «Claude lo mira cada hora».
- `rutinas`: tareas programadas, solo en el calendario. `disparador`: `{ tipo: "hora", texto, horarios: [ { frecuencia: "hora"|"cada-hora", dias: [1..5] (1 lunes … 6 sábado, 0 domingo), hora: "09:00" (si es «hora»), desde y hasta: "09:00"/"22:00" (si es «cada-hora»: cada hora en punto, las dos horas incluidas) } ], crons: ["0 9 * * 1"], cron, comprueba }`. Un solo `horarios` basta para «cada lunes a las 9»; para «lunes a las 9 y viernes a las 18» son dos. `texto` es la frase en llano que ve la persona («Cada lunes a las 9:00 y cada viernes a las 18:00»). `donde`: `en tu ordenador` o `en la nube`. `activa`: si está en marcha. `tarea_id`: el id de la tarea en la app de Claude o en la nube.
- Patrón común que conviene proponer: una rutina «cada hora» que mira el correo y, según lo que llega, lanza la skill que toca (factura → enviar factura).

### Apps
- `tipo`: web, app de escritorio, móvil… o `artefacto` (salen aparte, en el filtro «Artefactos», en lista).
- **Logo de cada app, nunca emoji**: si la app es de una marca, `logo` (simple-icons, como en conectores); si tiene su propio icono de verdad, `imagen` (https; comprueba que no es el icono por defecto de Vercel); si no, `figura`, un icono plano de esta lista: panel, bandeja, calendario, llave, personas, casa, birrete, libro, taza, diapositivas, megafono, tarjeta, movil, robot, euro, mapa, documento, grafico, globo, chat, diana, carpeta, app.
- **Toda app tiene su «Abrir»**: `url` (https, o http://localhost si es local) o, si no tiene web, `abrir` con su ruta en el ordenador (la `.app` de una app de escritorio, o la carpeta donde está, como la del APK de una app del móvil). El puente la abre. Sin ninguna de las dos, sale «En tu móvil» o nada.
- `quitadas`: lo que la persona quitó del panel con «Quitar del panel». No se borra nada de su cuenta; solo no se enseña.
