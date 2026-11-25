# plataforma-puente

El puente web de la plataforma descargable (`../plataforma`). Proyecto Vercel `plataforma-puente` del equipo `6grados`
(https://plataforma-puente.vercel.app), publicado con `publicar-6g.sh plataforma-puente plataforma-puente`.

- `POST /api/alta` → una llave nueva `plat.<id>.<firma>` (la pide el ordenador con `node servidor.mjs emparejar`).
- `GET|POST /api/web` → la web publicada: lee si el ordenador está encendido y lo vivo, y deja órdenes cerradas.
- `POST /api/agente` → el ordenador: latido, resultados y coger lo pendiente (una llamada por vuelta).

La lógica y la comprobación de la llave están en la base (Supabase `6grados-curso`, funciones `plataforma_alta`,
`plataforma_web`, `plataforma_agente`; tablas `plataforma_ordenes` y `plataforma_latido`; el secreto en `privado.plataforma_ajustes`).
Variables del proyecto: `PUENTE_SUPABASE_URL` y `PUENTE_SUPABASE_CLAVE` (la publicable). Sin secretos en el repo.
