// Lo común del puente web de la plataforma descargable. El «_» hace que Vercel no lo publique como función.
// La web del cliente (en su Vercel, otro origen) y su ordenador hablan con estas funciones; ellas llaman a tres
// funciones de la base (Supabase, proyecto 6grados-curso) que comprueban la llave y hacen el trabajo:
// plataforma_alta, plataforma_web y plataforma_agente. El secreto de las llaves vive solo dentro de la base.
// Variables del proyecto Vercel: PUENTE_SUPABASE_URL y PUENTE_SUPABASE_CLAVE (la publicable: no da acceso a nada
// por sí sola; las tablas están cerradas y solo se entra por esas funciones con una llave buena).

export function cors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");          // la llave va en una cabecera, no en cookies
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Plataforma-Llave");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") { res.statusCode = 204; res.end(); return true; }
  return false;
}

export function json(res, code, obj) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(obj));
}

export function llaveDe(req) {
  const l = String(req.headers["x-plataforma-llave"] || "");
  return /^plat\.[a-z0-9]{12}\.[A-Za-z0-9_-]{32}$/.test(l) ? l : null;
}

export async function cuerpo(req, max = 250000) {
  if (req.body && typeof req.body === "object") return req.body;
  let b = "";
  for await (const c of req) { b += c; if (b.length > max) { const e = new Error("demasiado grande"); e.status = 413; throw e; } }
  return b ? JSON.parse(b) : {};
}

const CODIGOS = { "28000": 401, "22023": 400, "54000": 429 };

export async function rpc(nombre, args) {
  const url = process.env.PUENTE_SUPABASE_URL, clave = process.env.PUENTE_SUPABASE_CLAVE;
  if (!url || !clave) { const e = new Error("sin-configurar"); e.status = 503; throw e; }
  const r = await fetch(url + "/rest/v1/rpc/" + nombre, {
    method: "POST",
    headers: { apikey: clave, "Content-Type": "application/json", ...(clave.startsWith("sb_") ? {} : { Authorization: "Bearer " + clave }) },
    body: JSON.stringify(args),
  });
  const t = await r.text();
  if (!r.ok) {
    let j = {}; try { j = JSON.parse(t); } catch {}
    const e = new Error(j.message || "base " + r.status); e.status = CODIGOS[j.code] || 502; throw e;
  }
  return t ? JSON.parse(t) : null;
}

export function fallo(res, e) {
  const status = e.status || 500;
  json(res, status, { error: status === 401 ? "llave no válida" : status >= 500 && status !== 503 ? "error del puente" : e.message });
}
