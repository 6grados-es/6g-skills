// El ordenador del cliente (servidor.mjs), con la llave en X-Plataforma-Llave:
//   POST /api/agente { estado?, resultados: [{id, ok, nota}], version? } → { ordenes, rapido }
// Una sola llamada por vuelta: latido + resultados + coger lo pendiente. «rapido» = la web está abierta ahora mismo.
import { cors, json, rpc, fallo, llaveDe, cuerpo } from "./_comun.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "POST") return json(res, 405, { error: "solo POST" });
  const llave = llaveDe(req);
  if (!llave) return json(res, 401, { error: "falta la llave" });
  try {
    const { estado = null, resultados = [], version = null } = await cuerpo(req);
    return json(res, 200, await rpc("plataforma_agente", {
      llave, estado: estado && typeof estado === "object" ? estado : null,
      resultados: Array.isArray(resultados) ? resultados.slice(0, 50) : [], version: version ? String(version).slice(0, 40) : null,
    }));
  } catch (e) { return fallo(res, e); }
}
