# Formato de las reuniones de 6 Grados

Decidido por Pedro el 12-nov-2026. Lo aplican igual la skill `6g-reuniones`, su comando `bin/reuniones.mjs` y la web «Reuniones» (las dos últimas comparten el mismo código: `web/lib/reuniones.js`).

## Las cuatro secciones

Cada reunión en formato nuevo tiene, en este orden, cuatro encabezados H1 (texto exacto):

1. **Revisar**: lo que quedó sin marcar en la reunión anterior del mismo tipo, copiado como casillas (`to_do`). Son sus «Siguientes pasos» sin marcar y, además, lo de su «Revisar» que nadie resolvió; sin repetir textos. Si no hay reunión anterior: una viñeta «Sin tareas anteriores: es la primera reunión de <tipo>.»
2. **Informar**: lista numerada. Lo que alguien cuenta (avances, estado de clientes…).
3. **Temas**: lista numerada. Lo que hay que hablar o decidir. Una propuesta empieza por «Propuesta: ».
4. **Siguientes pasos**: casillas (`to_do`). Lo que alguien se compromete a hacer.

Una página está «en formato nuevo» si tiene esos cuatro H1. Si no (Daily 6G y Weekly 6G hoy), solo se lee: no se escribe en ella salvo que lo pidan expresamente.

## Cada línea

- Empieza por la persona: `Pedro - enunciado`. La persona es quien lo trae (informar, temas) o quien se compromete (siguientes pasos). Si la línea ya empieza por el nombre de otra persona («Santi - …»), se respeta.
- Máximo **15 palabras**. Se cuentan las palabras de la línea entera, **nombre incluido**; el guion de «Pedro - » no cuenta. «Pedro - Cliente X: sesión 3 dada» son 6.
- Si pasa de 15, la línea se corta en ≤14 palabras (mejor en una coma o un punto, si lo hay a partir de la sexta palabra) y termina en «…». Lo que sobra va, empezando por «…», como primera viñeta del desplegable (`toggle`) **Detalle**, hijo de la línea. Así no se pierde nada. La web y el comando lo hacen solos; a mano (conector de Notion), igual.
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
| Añadir una línea (al final de su sección) | Sí | Sí |
| ✓ Marcar o desmarcar una casilla | Sí | Sí |
| Cambiar la persona de una línea | Sí | Sí |
| Marcar un punto de Informar o Temas como visto | Sí | Sí |
| ↓ Pasar de Revisar a Siguientes pasos | Sí | No |
| Editar el texto de una línea | Sí | No |
| Quitar una línea | Sí | No |

- **Hecho (✓)**: se marca la casilla en esta reunión y, si está en «Revisar», también la de texto idéntico en la reunión anterior (en sus Siguientes pasos o en su Revisar). El texto es idéntico porque se copió tal cual: así se encuentra.
- **Sigue pendiente (↓)**: la casilla pasa al final de «Siguientes pasos» de esta reunión (igual, con su Detalle) y se quita de «Revisar». En la reunión anterior no se toca nada.
- **Quitar** = archivar el bloque en Notion (va a la papelera; recuperable). «Deshacer» la vuelve a crear igual en su sitio: Notion, si se saca de la papelera, la deja al final de la página.
- **Editar** corrige el texto (máximo 15 palabras); el Detalle no se toca.
- **Cambiar de persona**: se sustituye el nombre (o alias) que hay en la línea por el de la otra persona; si no hay ninguno, se pone «Nombre - » delante. En «Revisar», también en la gemela de la reunión anterior. La web lo hace con un desplegable en cada línea y en la lista de tareas.
- **Visto** (Informar y Temas): el punto ya se ha tratado. En Notion, el bloque se pone en **gris**; el texto no cambia.

## Tareas (to-dos) de una persona

Las casillas sin marcar con su nombre o un alias (`alias` de cada persona en `tipos.json`; sin distinguir mayúsculas ni tildes, en cualquier posición: «Santi - …», «Tarea - Santi») en las reuniones de los últimos `formato.dias_todos` días (14) y en las próximas, de formato nuevo y antiguo. Se enseñan agrupadas por la reunión de la que vienen. Una casilla vale por su texto y **manda la copia más reciente**: si en una reunión posterior está marcada, está hecha y no sale; si sale sin marcar en varias, una sola vez, con su reunión más reciente.

## Tipos ocultos

Los tipos con `"oculto": true` en `tipos.json` (hoy, «prueba») son para probar sin tocar reuniones reales: no salen en la web, ni en los to-dos ni en el historial. Sus páginas se archivan al acabar.
