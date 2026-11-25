// La web publicada (también desde el móvil), con la llave en la cabecera X-Plataforma-Llave:
//   GET  /api/web → { visto, ahora, estado, ordenes }: si el ordenador está encendido y lo vivo (skills, rutinas, quitadas).
//   POST /api/web { tipo, datos } → deja una orden cerrada: skill {nombre, activada} · rutina {id, activa} ·
//        quitar-app {nombre, url} · restaurar-app {nombre, url}. Nunca rutas ni el datos.js entero.
import { cors, json, rpc, fallo, llaveDe, cuerpo } from "./_comun.js";

const TIPOS = ["skill", "rutina", "quitar-app", "restaurar-app"];

export default async function handler(req, res) {
  if (cors(req, res)) return;
  const llave = llaveDe(req);
  if (!llave) return json(res, 401, { error: "falta la llave" });
  try {
    if (req.method === "GET") return json(res, 200, await rpc("plataforma_web", { llave }));
    if (req.method !== "POST") return json(res, 405, { error: "solo GET o POST" });
    const { tipo, datos } = await cuerpo(req, 4000);
    if (!TIPOS.includes(tipo) || !datos || typeof datos !== "object") return json(res, 400, { error: "orden no válida" });
    return json(res, 200, await rpc("plataforma_web", { llave, orden: { tipo, datos } }));
  } catch (e) { return fallo(res, e); }
}
