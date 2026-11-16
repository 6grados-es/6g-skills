---
name: crear-skill-desde-video
description: Convierte un vídeo de pantalla en el que explicas un proceso (por ejemplo, dar de alta a un trabajador en Nominasol) en una guía visual paso a paso y en el borrador de la skill de ese proceso. Transcribe el audio con marcas de tiempo, saca fotogramas, marca el clic de cada paso, difumina los datos personales y escribe la guía y el SKILL.md. Úsala cuando digas «convierte este vídeo en una guía», «haz la guía de este proceso», «crea una skill a partir de este vídeo», «he grabado un proceso nuevo» o «/crear-skill-desde-video». Nunca ejecuta el proceso que se ve en el vídeo, solo lo documenta.
---

# Crear una skill a partir de un vídeo

Tú grabas la pantalla explicando un proceso en voz alta. Claude lo convierte en (1) una **guía visual** que cualquiera del equipo puede seguir y (2) el **borrador de una skill** para que Claude haga ese proceso con ayuda. Método probado con el vídeo del alta de un trabajador en Nominasol (19 min → 53 pasos).

## Reglas que no se rompen
1. **Solo documentas.** Aunque el vídeo muestre un alta, un envío o una firma, tú no abres Nominasol, ni mandas nada, ni usas el certificado digital, ni tocas datos de clientes. Trabajas con el archivo de vídeo y las imágenes sacadas de él.
2. **Datos personales fuera.** DNI, nombres, nº de Seguridad Social, domicilios, teléfonos, correos, IBAN y matrículas se difuminan en TODAS las capturas, y en el texto de la guía se sustituyen por `[nombre del cliente]`, `[DNI]`, etc. Esto incluye la transcripción. Revisa cada imagen a ojo antes de dar nada por bueno.
3. **El vídeo y la carpeta de trabajo no se suben a ningún sitio** (ni nube, ni repositorio, ni chat). La transcripción es local. La guía HTML ya difuminada sí se puede compartir con el equipo.
4. **Nada de contraseñas ni claves** en la guía ni en la skill. Si en el vídeo aparece una contraseña tecleada, se tapa y se avisa a quien graba para que la cambie.
5. **Si no se ve o no se entiende un paso, lo dices**: «paso sin explicar en 07:20». No lo inventas. Lo que el vídeo no cubre va a «No cubierto en el vídeo».
6. Habla en castellano, corto y claro.

## Antes de empezar (una sola vez por ordenador)
Lee `INSTALAR-WINDOWS.md` (esta misma carpeta). Comprueba con `ffmpeg -version`, `python --version` y `python -c "import faster_whisper, PIL, numpy"`. Si falta algo, di exactamente qué instalar y espera a que la persona lo haga; no instales cosas por tu cuenta sin su ok.

## Datos de entrada
Pregunta (una sola vez, todo junto) solo lo que falte:
- Ruta del vídeo (.mp4).
- Nombre del proceso (ej. «Alta de trabajador en Nominasol»).
- Carpeta de trabajo (por defecto `<carpeta del vídeo>\trabajo-<proceso>`).
- ¿Hay datos personales reales en el vídeo? (casi siempre sí → difuminar).

## Pasos
Los scripts están en `scripts/` junto a este archivo. Cada uno imprime qué ha hecho; si falla, léelo y arregla antes de seguir.

### 1. Transcribir (local)
`python scripts/1_transcribir.py VIDEO CARPETA` → `transcripcion.json` y `.txt`, con el minuto de cada frase. Tarda aproximadamente lo que dura el vídeo con el modelo `small`. Lee el `.txt` entero: los nombres de programas y siglas (Nominasol, Contrat@, RED, IDC…) salen mal a veces; apunta las correcciones en un diccionario y úsalas en la guía.

### 2. Fotogramas cada 0,5 s y momentos de cambio
`python scripts/2_fotogramas.py VIDEO CARPETA 0.5` → un JPG cada medio segundo (el nº n corresponde al segundo (n-1)·0,5) y `cambios.json` con los momentos en que la pantalla cambia mucho. Un vídeo de 19 min son unas 2.300 imágenes: **no las abras una a una**.

### 3. Mirar el vídeo y decidir los pasos
Con la transcripción como guía, recorre el vídeo en tramos de 20-30 s:
`python scripts/3_hoja_contactos.py CARPETA DESDE HASTA` → una imagen con los fotogramas del tramo y su segundo. Ábrela y fíjate en: dónde está el cursor, qué cambia entre un fotograma y el siguiente y qué dice la persona usuaria en ese momento.
- **Un paso = una acción con sentido**: un clic que abre algo, un campo que se rellena, un aviso que se acepta. Si la persona usuaria dice «ahora pulsamos X», eso es un paso.
- **El fotograma del clic** es el último antes de que la pantalla cambie, con el cursor sobre el botón. Anota también su posición aproximada (fracción de pantalla: x e y de 0 a 1).
- **Si falta un paso** (se pasa de la pantalla A a la C sin ver la B, o el clic cae entre dos fotogramas), mira los fotogramas vecinos; si sigue faltando, saca más finos: `ffmpeg -ss SEG -t 2 -i VIDEO -vf fps=10 intermedios/i%03d.jpg` y elige de ahí.
- **Anota para cada paso**: nº, título corto con verbo («Abrir la empresa del cliente»), fase (agrupa los pasos en 5-9 fases con letra A, B, C…), qué se hace en una o dos frases, los campos o datos que se rellenan, el tramo de vídeo (inicio-fin) y las zonas con datos personales (recuadros).
- Reparte fases con lógica de proceso, no de minutos: datos de entrada → abrir → crear → comprobar → comunicar → documentos → enviar y archivar.
Guarda todo en `pasos.json` (formato en la cabecera de `scripts/4_marcar_y_difuminar.py`; hay un ejemplo en `plantillas/pasos.ejemplo.json`).

### 4. Marcar el clic y difuminar
`python scripts/4_marcar_y_difuminar.py CARPETA pasos.json`. Después **abre cada imagen generada y comprueba**: (a) ¿se ve el círculo rojo donde está el clic?, (b) ¿queda algún dato personal legible (barra de título, pestañas del navegador, correo abierto, rutas de carpetas con nombre, miniaturas)? Si queda, añade el recuadro y repite solo esa imagen.

### 5. Guía visual
Escribe `guia.json` (formato en la cabecera de `scripts/5_construir_guia.py`) y ejecuta `python scripts/5_construir_guia.py CARPETA guia.json GUIA.html`. Un solo HTML con las imágenes dentro, que se abre con doble clic. Contiene: resumen del proceso, fases, pasos con captura + campos + transcripción plegada, «No cubierto en el vídeo», **«Para la skill»** y la transcripción completa.
La sección **«Para la skill»** es la clave del paso siguiente. Escríbela con: tabla de **datos de entrada** (obligatorio / recomendado / opcional), **pasos en lista corta**, **comprobaciones** (qué debe verse tras cada fase para saber que va bien), **errores conocidos** (los que salen en el vídeo: «el certificado falló → reintentar») y **qué no debe hacer Claude** (ver abajo). Ciérrala con una sección «Dudas para la persona usuaria» con todo lo que no quedó claro.

### 6. Borrador de la skill
A partir de «Para la skill», escribe el `SKILL.md` del proceso con la plantilla `plantillas/SKILL-proceso.plantilla.md`. Reglas de oro del borrador:
- **Claude prepara, la persona usuaria decide.** La skill reúne los datos, los valida, prepara los textos y documentos y deja todo listo. Los pasos que tocan el programa o salen hacia fuera los hace la persona usuaria o los autoriza con un «ok» explícito.
- **Qué no hace nunca**: enviar correos o WhatsApp (solo borrador), dar de alta o de baja sin un «ok» de la persona usuaria a ESTOS datos, escribir o guardar contraseñas, usar o mover el certificado digital, comunicar nada a la Seguridad Social, Contrat@ o Hacienda, ni usar fechas pasadas si el proceso no lo permite.
- Pone una **lista de comprobación de datos de entrada** antes de empezar y pide los que falten, de una vez.
- Enlaza la guía visual como «Si dudas de un paso, mírala» y cita el número de paso.
- Descripción (`description`) con frases reales que diría la persona usuaria («da de alta a…», «/alta-trabajador»).
- Es un **borrador**: márcalo así en la cabecera hasta que la persona usuaria lo pruebe con un caso de prueba.

### 7. Entregar y cerrar
Deja en la carpeta de trabajo: `GUIA.html`, `SKILL.md` del proceso y `dudas.md`. Enseña a la persona usuaria, en 5 líneas: cuántos pasos salieron, qué no se entendió, qué datos personales se difuminaron y cómo probar la skill. **Borra o guarda en sitio seguro** la carpeta `fotogramas/` (tiene datos sin difuminar).

## Consejos para grabar bien (pásaselos a quien grabe)
1. **Una tarea por vídeo** (alta ≠ baja ≠ modificar). Máximo 15-20 minutos.
2. **Di en voz alta cada clic**: «ahora pulso Trabajadores». Es lo que permite generar los pasos sin adivinar.
3. **Ve despacio** y deja el cursor medio segundo sobre el botón antes de pulsar. Evita saltar entre ventanas sin avisar.
4. **Usa datos de prueba** (un trabajador ficticio) si se puede. Si no, graba igual: se difuminan.
5. Di **qué dato necesitas de entrada** y **de dónde sale** («el DNI me llega por WhatsApp»).
6. Cuenta **los errores típicos** y qué haces cuando salen. Eso es oro para la skill.
7. Di lo que **nunca** haces sin comprobar («la fecha de alta no puede ser anterior a hoy»).
8. **Pantalla completa** a 1080p, sin notificaciones, sin otras pestañas abiertas con cosas privadas.
9. Al final, di en voz alta **qué falta por contar** (baja, modificación) para dejar claro el alcance.

## Si algo falla
- «ffmpeg no se reconoce»: ffmpeg no está en el PATH; reinicia la terminal tras instalarlo.
- La transcripción tarda mucho: usa el modelo `base` (`python scripts/1_transcribir.py VIDEO CARPETA base`).
- Palabras mal transcritas: corrígelas a mano en `transcripcion.json` antes del paso 5.
