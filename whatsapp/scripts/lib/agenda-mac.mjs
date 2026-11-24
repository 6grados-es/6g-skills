// agenda-mac.mjs — los contactos que ya tiene la APLICACIÓN de WhatsApp del Mac, con su teléfono, para que un borrador
// se abra con el contacto puesto aunque la persona no esté en las personas frecuentes.
// Solo lectura (sqlite3 -readonly), en local, sin abrir la sesión de WhatsApp ni leer mensajes: solo nombre, teléfono e id.
// Fuera de Mac, o sin la app, no hay agenda (devuelve null) y todo sigue como antes.
// WHATSAPP_AGENDA_MAC=<ruta> usa otra base (pruebas); WHATSAPP_AGENDA_MAC=no la apaga.
import { existsSync } from 'fs';
import { spawnSync } from 'child_process';
import { join } from 'path';
import { homedir } from 'os';
import { normalizarTelefono } from './coincidir-chat.mjs';

const RUTA_APP = join(homedir(), 'Library', 'Group Containers', 'group.net.whatsapp.WhatsApp.shared', 'ContactsV2.sqlite');

export function rutaAgenda({ entorno = process.env, plataforma = process.platform } = {}) {
  const pedida = String(entorno.WHATSAPP_AGENDA_MAC || '').trim();
  if (pedida.toLowerCase() === 'no') return null;
  if (pedida) return pedida;
  return plataforma === 'darwin' ? RUTA_APP : null;
}

/** { personas: [{ nombre, telefono, id }] } con la forma de las personas frecuentes (sirve el mismo `buscar`), o null. */
export function cargarAgenda({ ruta = rutaAgenda(), ejecutar = spawnSync, existe = existsSync } = {}) {
  if (!ruta || !existe(ruta)) return null;
  const sql = 'SELECT ZFULLNAME AS nombre, ZGIVENNAME AS nombre2, ZBUSINESSNAME AS empresa, ZPHONENUMBER AS telefono, ZLID AS lid'
    + ' FROM ZWAADDRESSBOOKCONTACT WHERE ZPHONENUMBER IS NOT NULL';
  const r = ejecutar('sqlite3', ['-readonly', '-json', ruta, sql], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) return null;
  let filas;
  try { filas = JSON.parse(String(r.stdout || '').trim() || '[]'); } catch { return null; }
  const vistos = new Map();
  for (const f of filas) {
    const telefono = normalizarTelefono(String(f.telefono || ''));
    const nombre = String(f.nombre || f.empresa || f.nombre2 || '').trim();
    if (!telefono || !nombre) continue;
    const previo = vistos.get(telefono);
    if (previo) { if (nombre !== previo.nombre && !previo.alias.includes(nombre)) previo.alias.push(nombre); continue; }
    const alias = [f.empresa].map((x) => String(x || '').trim()).filter((x) => x && x !== nombre);
    vistos.set(telefono, { nombre, alias, telefono, id: f.lid ? (String(f.lid).includes("@") ? String(f.lid) : `${f.lid}@lid`) : `${telefono}@c.us` });
  }
  return { personas: [...vistos.values()] };
}
