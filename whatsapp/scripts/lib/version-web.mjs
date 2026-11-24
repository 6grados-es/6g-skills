// version-web.mjs — qué versión de WhatsApp Web se carga (25-nov-2026).
//
// Qué pasó: desde la 2.3000.1055852612 (23-nov-2026) WhatsApp Web manda a una página nueva, /login/, a quien aún no
// ha iniciado sesión. whatsapp-web.js 1.34.7 (la copia de vendor/) y la 1.34.8 de npm no la entienden: esperan un
// módulo interno que ahí no existe y a los 30 s fallan con «Waiting failed: 30000ms exceeded», sin enseñar el QR
// (issue wwebjs/whatsapp-web.js#201988; arreglado en su rama main con el commit 38eb45b, aún sin versión en npm).
//
// Arreglo: cargar una versión anterior de WhatsApp Web, la 2.3000.1055837054-alpha, guardada en la carpeta cache-web
// del usuario. Se baja una vez de wppconnect-team/wa-version fijada a un commit y se comprueba su sha256; si no casa,
// no se usa. Con WA_WEB_VERSION=actual se carga la de hoy (para probar cuando la librería traiga el arreglo).
// Cuando vendor/ lleve el arreglo de 38eb45b, esto se quita.
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'fs';
import { createHash } from 'crypto';
import { join } from 'path';
import { dirCacheWeb } from './rutas.mjs';

export const VERSION_WEB_FIJADA = '2.3000.1055837054-alpha';
const URL_FIJADA = 'https://raw.githubusercontent.com/wppconnect-team/wa-version/e6cec7b43adc11ae36f946421576d517ecdc80e2/html/2.3000.1055837054-alpha.html';
const SHA256 = '2b7984d1b085b09228ce104d73c6cce41e20cb52453867bb739fe239f1e96ff3';

export const ficheroVersion = (v = VERSION_WEB_FIJADA) => join(dirCacheWeb(), v + '.html');
const sha = (buf) => createHash('sha256').update(buf).digest('hex');

// La versión que hay que pasar a `new Client({ webVersion })`, o undefined para la de hoy. No descarga nada.
export function versionWeb() {
  if (process.env.WA_WEB_VERSION === 'actual') return undefined;
  const f = ficheroVersion();
  try { return existsSync(f) && sha(readFileSync(f)) === SHA256 ? VERSION_WEB_FIJADA : undefined; } catch { return undefined; }
}

// Deja la versión fijada en cache-web si falta (la baja y comprueba su huella). Nunca lanza: {ok, version, motivo}.
export async function asegurarVersionWeb({ fetchImpl = globalThis.fetch } = {}) {
  if (process.env.WA_WEB_VERSION === 'actual') return { ok: true, version: undefined, motivo: 'WA_WEB_VERSION=actual: se usa la versión de hoy' };
  if (versionWeb()) return { ok: true, version: VERSION_WEB_FIJADA, motivo: 'ya estaba' };
  try {
    const r = await fetchImpl(URL_FIJADA);
    if (!r.ok) return { ok: false, version: undefined, motivo: `no se pudo bajar (HTTP ${r.status})` };
    const buf = Buffer.from(await r.arrayBuffer());
    if (sha(buf) !== SHA256) return { ok: false, version: undefined, motivo: 'el fichero bajado no tiene la huella esperada: no se usa' };
    mkdirSync(dirCacheWeb(), { recursive: true });
    const f = ficheroVersion();
    writeFileSync(f + '.part', buf);
    renameSync(f + '.part', f);
    return { ok: true, version: VERSION_WEB_FIJADA, motivo: 'bajada' };
  } catch (e) {
    return { ok: false, version: undefined, motivo: `no se pudo bajar (${e.message})` };
  }
}
