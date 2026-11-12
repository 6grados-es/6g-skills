# Formato de las reuniones de 6 Grados

Decidido por Pedro el 12-nov-2026. Lo aplican igual la skill `6g-reuniones` y la web «Reuniones».

## Las cuatro secciones

Cada reunión en formato nuevo tiene, en este orden, cuatro encabezados H1 (texto exacto):

1. **Revisar**: los siguientes pasos sin marcar de la reunión anterior del mismo tipo, copiados como casillas (`to_do`). Si no hay reunión anterior: una viñeta «Sin tareas anteriores: es la primera reunión de <tipo>.»
2. **Informar**: lista numerada. Lo que alguien cuenta (avances, estado de clientes…).
3. **Temas**: lista numerada. Lo que hay que hablar o decidir. Una propuesta empieza por «Propuesta: ».
4. **Siguientes pasos**: casillas (`to_do`). Lo que alguien se compromete a hacer.

Una página está «en formato nuevo» si tiene esos cuatro H1. Si no (Daily 6G y Weekly 6G hoy), solo se lee: no se escribe en ella salvo que lo pidan expresamente.

## Cada línea

- Empieza por la persona: `Pedro - enunciado`. La persona es quien lo trae (informar, temas) o quien se compromete (siguientes pasos).
- Máximo **15 palabras** contando el nombre. Si hace falta más, el resto va dentro de un desplegable (`toggle`) llamado **Detalle**, hijo de la línea, con viñetas simples.
- Líneas simples: sin negritas ni listas dentro de la línea.

## Ejemplo

```
# Revisar
- [ ] Santi - Loom de contactos personales en el CRM
# Informar
1. Pedro - Alberto (Intrexia): sesión 3 dada, clases abiertas hasta la 7.
   ▸ Detalle
      - Próxima sesión: martes 17-nov, 13:00.
# Temas
1. Pedro - Propuesta: daily de Santi, 15 min de redes antes y 15 de producto después.
# Siguientes pasos
- [ ] Santi - Revisar los niveles en la plataforma
```

## Marcar y mover

- **Hecho**: se marca la casilla en esta reunión (Revisar) y también en la reunión de origen (Siguientes pasos de la anterior). El texto es idéntico: así se encuentra.
- **Sigue pendiente (↓)**: la casilla pasa a «Siguientes pasos» de esta reunión (se crea igual, al final) y se quita de «Revisar». En la reunión anterior no se toca nada.
- «Quitar» una línea = archivar el bloque en Notion (recuperable). Nunca borrado duro de una reunión que no sea la de hoy.
