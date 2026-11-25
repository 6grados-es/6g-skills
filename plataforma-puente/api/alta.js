// POST /api/alta → { llave }: una llave nueva para una plataforma (la pide el ordenador la primera vez:
// node servidor.mjs emparejar). No crea nada en la base: la llave se comprueba con su firma.
import { cors, json, rpc, fallo } from "./_comun.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "POST") return json(res, 405, { error: "solo POST" });
  try { return json(res, 200, { llave: await rpc("plataforma_alta", {}) }); }
  catch (e) { return fallo(res, e); }
}
