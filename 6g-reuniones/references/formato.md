# Formato de las reuniones de 6 Grados

Decidido por Pedro el 12-nov-2026; plantillas, Parking y Aparcados desde el 13-nov-2026 (lo pidió Santi en la Daily del 13-nov: «la misma información que Notion»). Lo aplican igual la skill `6g-reuniones`, su comando `bin/reuniones.mjs` y la web «Reuniones» (las dos últimas comparten el mismo código: `web/lib/reuniones.js`).

## Las cuatro secciones

Cada reunión en formato nuevo tiene, en este orden, cuatro encabezados H1 (texto exacto):

1. **Revisar**: lo que quedó sin marcar en la reunión anterior del mismo tipo, copiado como casillas (`to_do`). Son sus «Siguientes pasos» sin marcar y, además, lo de su «Revisar» que nadie resolvió; sin repetir textos. Si no hay reunión anterior: una viñeta «Sin tareas anteriores: es la primera reunión de <tipo>.»
2. **Informar**: lista numerada. Lo que alguien cuenta (avances, estado de clientes…).
3. **Temas**: lista numerada. Lo que hay que hablar o decidir. Una propuesta empieza por «Propuesta: ».
4. **Siguientes pasos**: casillas (`to_do`). Lo que alguien se compromete a hacer.

Un H1 cuenta como su sección si es su nombre o empieza por él: «Siguientes pasos - YO ME COMPROMETO Y ES REALISTA» es Siguientes pasos. Los encabezados H2/H3 dentro de una sección son apartados (p. ej. en Temas de la Daily: «Puntos fijos», «Parking» y «Temas nuevos»): la web los enseña como subtítulos y numera desde 1 en cada uno, como Notion. Lo que se añade va al final de la sección, así que el último apartado debe ser el de lo nuevo (si no, caería en el Parking). Una página está «en formato nuevo» si tiene esos cuatro H1. Si no (las Daily 6G y Weekly 6G de antes del 13-nov-2026), solo se lee: no se escribe en ella salvo que lo pidan expresamente o se pase al formato con la skill (FORMATEAR: propuesta, ok y entonces se aplica, guardando una copia de lo de antes). Desde el 13-nov todos los tipos nacen en formato nuevo.

## Secciones opcionales y plantillas

Además de las cuatro base, una reunión puede tener estas secciones (H1; catálogo en `formato.catalogo` de `tipos.json`):

| Sección | Bloques | Qué es |
|---|---|---|
| **Celebración** (Weekly) | lista numerada | Lo bueno de la semana |
| **Resumen de la semana** (Weekly) | lista numerada | Ventas, leads y cumplimiento de hitos |
| **Postmoto** (Weekly) | lista numerada, apartados Qué fue bien · Qué fue mal · Aprendizajes | De la semana anterior |
| **Parking** | lista numerada, con subtítulos (Warm, Contenido…) | Temas aparcados: **pasan solos** a la siguiente reunión |
| **Aparcados y mejoras** | casillas | Pasos que no son para mañana y mejoras: **pasan solos** a la siguiente reunión |

Cada tipo tiene su **plantilla** (`plantilla` en `tipos.json`): qué secciones lleva y en qué orden, los apartados y los **puntos fijos** (líneas sin persona, iguales en cada reunión, con enlace si lo tienen: embudo → CRM, rocas → Planeación). Lo que va antes del primer H1 («Plaud grabando») es una casilla suelta: no se arrastra ni es tarea de nadie.

- **Daily:** Plaud grabando · Revisar · Temas (Puntos fijos: embudo, oferta, rocas · Temas nuevos) · Parking · Siguientes pasos · Aparcados y mejoras.
- **Weekly:** Plaud grabando · Celebración · Resumen de la semana · Postmoto · y lo mismo que la Daily (más el punto fijo «Cuántos vídeos salieron»).
- **Producto y redes:** las cuatro base y Parking.

**Informar es opcional** (desde el 13-nov-2026): la Daily y la Weekly no la llevan, como la plantilla de Santi. Una página está en formato nuevo si tiene Revisar, Temas y Siguientes pasos.

**Cadena:** la Daily y la Weekly son una sola cadena (`cadena` en `tipos.json`): Revisar, Parking y Aparcados salen de la reunión anterior de cualquiera de las dos, como cuando se duplicaba la página.

**Mover** (solo en la reunión de trabajo): una línea pasa al final de otra sección con su texto exacto (Parking → Temas «Subir», Aparcados → Siguientes pasos «Activar», o «Mover a…» cualquier otra salvo Revisar).

## Fecha de los siguientes pasos, pasar y cumplimiento

Desde el 15-nov-2026 (lo pidieron Santi, Pablo y Pedro en la Daily del 13-nov: «si pone miércoles, miércoles está hecho», «que se pueda poner la fecha», «hasta que no se mida no se mejora»).

- **Cada siguiente paso lleva fecha.** Sin fecha no se añade: o se dice para cuándo, o va a «Aparcados y mejoras». En Notion la fecha es una **mención de fecha** al final de la casilla (`Pedro - Oferta con el ranking @18 nov`), así que se ve y se puede cambiar también allí. No forma parte del texto.
- **Revisar = lo que vence ese día o antes.** Al crear la reunión, lo pendiente de la anterior se reparte: lo que vence el día de la reunión o antes (y lo que no tiene fecha) va a Revisar; lo de fecha posterior no se revisa todavía y pasa tal cual a Siguientes pasos, con su fecha. Un paso del miércoles no sale en Revisar el martes y sí el miércoles.
- **Tres salidas en Revisar:**
  - **✓ Hecho**: como siempre (también marca la gemela de la reunión anterior).
  - **↓ Pasar**: no está hecho. Hay que dar **fecha nueva** y cuenta como pasada. La línea se queda en Revisar **como pasada**, y su copia va a Siguientes pasos con la fecha nueva y «↓n» (las veces que se ha pasado).
  - **Aparcar**: no es para ya. Se queda en Revisar **como aparcada**, y su copia va a «Aparcados y mejoras», sin fecha.
- **Cambiar la fecha** de un paso sin pasarlo: solo en Siguientes pasos de la reunión de trabajo (es corregir el día al comprometerse). Lo que ya está en Revisar solo cambia de fecha con ↓.
- **De Aparcados a Siguientes pasos («Activar»)**: pide fecha.
- **Cumplimiento**: de las casillas de Revisar de cada reunión, cuántas están hechas frente a pasadas, aparcadas y sin revisar (sin marcar). Por reunión, por persona y por semana. No hay base de datos: sale de las propias páginas. Cuenta desde el 15-nov-2026; antes, lo pasado se borraba de Revisar.
- **Repaso de cierre**: antes de acabar, la web enseña arriba de Siguientes pasos cuántos tiene cada persona y para qué día, y avisa de los que no tienen fecha o ya la tienen pasada.

Una casilla pasada o aparcada en Revisar no es una tarea hecha: es el rastro de que se pasó o se aparcó. Para las tareas de cada persona solo cuenta su copia viva.

## Revisar por fecha y lo de otro día

- En Revisar sale primero lo de hoy, luego lo atrasado y lo que no tiene fecha.
- Una línea sin fecha que dice el día en el texto («… - Martes», «18/11») toma ese día (el más cercano a la reunión, de 3 días antes a 4 después: un lunes, «viernes» es el de esa semana).
- Lo que es para **después** de la reunión sale aparte, «De otros días · solo para ver»: no se pasa ni se aparca y **no cuenta en el cumplimiento**.

## Plantilla de la Weekly (desde el 16-nov-2026)

Casillas de inicio: Plaud grabando · Prework 5 min · Roles (por defecto «Pedro presenta · Santi temas · Pablo tareas»; se edita). Luego Celebración · Resumen de la semana (datos fijos con enlace: CRM, rocas, cumplimiento y vídeos, y arriba el % de to-dos y de temas por persona de la semana anterior) · Postmoto (Bien · Mal · Aprendizaje · Mejora; en la web, cada apartado con su propia línea para apuntar) · **Nueva semana** (rocas de esta semana) · Revisar · Temas · Parking · Siguientes pasos · Aparcados. La Daily lleva Plaud, prework y roles; producto y redes, Plaud y prework.

## Reuniones recurrentes

Producto, redes, Daily y Weekly se crean solas (`recurrente` en `tipos.json`). Toca el día que hay evento de su tipo en el calendario de 6 Grados, a su hora. Producto, sin serie propia, va los días de Daily: a su hora si tiene evento o, si no, al acabar la Daily. Sin calendario, se usan los `dias` (1 = lunes) y la `hora` de `tipos.json`. Nunca se duplica: si alguien ya la creó, no se toca. Las crea una rutina del Mac de Pedro cada 30 min, de lunes a viernes, como red de seguridad: solo si a 1 h de empezar nadie la ha creado (`rutina.antes_min`), para no adelantarse a quien las crea siempre (el Claude de Santi, Pablo). Desde la skill o desde la web (apartado «Recurrentes») se pueden crear antes.

Al formatear una reunión, las líneas de **Revisar** se copian con su texto exacto (sin reformular, sin mover el nombre, sin cortar): se casan por texto con la reunión anterior y con las tareas de cada persona.

## Cada línea

- Empieza por la persona: `Pedro - enunciado`. La persona es quien lo trae (informar, temas) o quien se compromete (siguientes pasos). Si la línea ya empieza por el nombre de otra persona («Santi - …»), se respeta; si lo lleva al final («Factura - Pedro»), al añadirla pasa delante («Pedro - Factura»). Lo ya escrito no se reescribe: las casillas se casan por texto.
- **Sin límite de palabras** desde el 16-nov-2026 (Weekly: «quitar el límite de caracteres»). La línea entra entera; aun así, mejor una idea por línea y clara. El **Detalle** sigue: para datos o matices que no hacen falta en la línea. Las líneas viejas cortadas con «…» no se reescriben (se casan por texto).
- Si la línea empieza por «Nombre - …» (nombre o alias del equipo), es de esa persona, diga lo que diga el selector.
- En la web, cada persona tiene su icono delante del nombre (Santi 🧙, Pablo 🏎️, Pedro 🥷, María 👩‍🌾, Alejo 🐢; `icono` en `tipos.json`). El icono **nunca** va dentro del texto.
- Líneas simples: sin negritas ni listas dentro de la línea.
- No se repite una línea que ya está, igual, en su sección.

## Ejemplo

```
# Revisar
- [ ] Santi - Loom de contactos personales en el CRM
# Informar
1. Pedro - Cliente X: sesión 3 dada, clases abiertas hasta la 7.
   ▸ Detalle
      - Próxima sesión: martes 17-nov, 13:00.
# Temas
1. Pedro - Propuesta: daily de Santi, 15 min de redes antes y 15 de producto después.
# Siguientes pasos
- [ ] Santi - Revisar los niveles en la plataforma
```

## Qué se puede hacer y dónde

«Reunión de trabajo» = la de hoy o una futura. Las pasadas no se reescriben.

| Acción | Reunión de trabajo | Reunión pasada |
|---|---|---|
| Añadir una línea (al final de su sección o de un apartado) | Sí | Sí |
| Mover una línea a otra sección | Sí | No |
| ✓ Marcar o desmarcar una casilla | Sí | Sí |
| Cambiar la persona de una línea | Sí | Sí |
| Marcar un punto de Informar o Temas como visto | Sí | Sí |
| ↓ Pasar de Revisar a Siguientes pasos (con fecha nueva) | Sí | No |
| Aparcar desde Revisar | Sí | No |
| Cambiar la fecha de un siguiente paso | Sí | No |
| Editar el texto de una línea | Sí | No |
| Quitar una línea | Sí | No |

- **Hecho (✓)**: se marca la casilla en esta reunión y, si está en «Revisar», también la de texto idéntico en la reunión anterior (en sus Siguientes pasos o en su Revisar). El texto es idéntico porque se copió tal cual: así se encuentra.
- **Sigue pendiente (↓)**: con fecha nueva. La copia va al final de «Siguientes pasos» de esta reunión (igual, con su Detalle, la fecha y «↓n») y la de «Revisar» se queda como pasada. En la reunión anterior no se toca nada.
- **Quitar** = a la papelera (recuperable). «Deshacer» devuelve la misma línea a su sitio.
- **Editar** corrige el texto (sin límite de palabras); el Detalle no se toca.
- **Cambiar de persona**: se sustituye el nombre (o alias) que hay en la línea por el de la otra persona; si no hay ninguno, se pone «Nombre - » delante. En «Revisar», también en la gemela de la reunión anterior. La web lo hace con un desplegable en cada línea y en la lista de tareas.
- **Visto** (Informar y Temas): el punto ya se ha tratado. El texto no cambia; en la web sale atenuado.
- **Pasar un tema** (Temas, reunión de trabajo): no se ha tratado y va a Temas de la próxima reunión de su cadena, con «↓n». Aquí se queda atenuado como «→ próxima reunión» y no cuenta en el número de temas. Lo pidió Pedro en la reunión de producto del 16-nov: «Aquí no aparece el botón de pasar».
- **To-do** (Temas): el tema se convierte en siguiente paso, con persona y fecha (Santi, mismo día: «debe haber un botón de convertir en todo»). Si no tenía persona, se elige al pasarlo.

## Tareas (to-dos) de una persona

Cada tarea sale con su fecha (vencida, si ya pasó) y las veces que se ha pasado. Son las casillas sin marcar con su nombre o un alias (`alias` de cada persona en `tipos.json`; sin distinguir mayúsculas ni tildes, en cualquier posición: «Santi - …», «Tarea - Santi») en las reuniones de los últimos `formato.dias_todos` días (14) y en las próximas, de formato nuevo y antiguo. Se enseñan agrupadas por la reunión de la que vienen. Una casilla vale por su texto y **manda la copia más reciente**: si en una reunión posterior está marcada, está hecha y no sale; si sale sin marcar en varias, una sola vez, con su reunión más reciente.

## Tipos ocultos

Los tipos con `"oculto": true` en `tipos.json` (hoy, «prueba») son para probar sin tocar reuniones reales: no salen en la web, ni en los to-dos ni en el historial. Sus páginas se archivan al acabar.
