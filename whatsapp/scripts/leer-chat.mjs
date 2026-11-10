#!/usr/bin/env node
/**
 * leer-chat.mjs — lee chats y grupos de TU WhatsApp, baja adjuntos y transcribe audios.
 * SOLO LECTURA: no envía, no marca como leído, no toca nada de tu WhatsApp.
 *
 * ─── USO ──────────────────────────────────────────────────────────────────────
 *   node leer-chat.mjs "Marta López"                  # por NOMBRE, últimos 50 mensajes
 *   node leer-chat.mjs "Marta" 200                    # últimos 200
 *   node leer-chat.mjs "Marta" --desde 2026-09-25     # desde una fecha (hasta 5000 mensajes)
 *   node leer-chat.mjs "Marta" --desde 2026-09-01 --hasta 2026-09-30
 *   node leer-chat.mjs "Marta" --todo                 # el chat ENTERO (hasta donde WhatsApp Web lo da)
 *   node leer-chat.mjs +34600111222 50                # por NÚMERO (con o sin +34, 0034, espacios)
 *   node leer-chat.mjs 12345@g.us 100                 # por id exacto (grupos acaban en @g.us)
 *   node leer-chat.mjs "grupo del colegio" 100        # un GRUPO se lee igual, por su nombre
 *
 *   BUSCAR (no lee mensajes, solo identifica chats):
 *   node leer-chat.mjs "mar" --listar                 # chats/contactos cuyo nombre casa
 *   node leer-chat.mjs 600111222 --listar             # por número, o por un trozo de 4+ cifras
 *   node leer-chat.mjs <id@g.us> --miembros           # participantes de un grupo (nombre y teléfono si se ven)
 *   (--miembros también acepta el NOMBRE de un grupo)
 *
 *   ADJUNTOS Y AUDIOS:
 *   node leer-chat.mjs "Marta" 80 --bajar                       # los 5 últimos DOCUMENTOS → carpeta Descargas
 *   node leer-chat.mjs "Marta" 80 --bajar --tipo image,video    # tipos: document image video audio ptt todo
 *   node leer-chat.mjs "Marta" 80 --bajar --fichero factura --max 10 --salida C:\ruta
 *   node leer-chat.mjs "Marta" 80 --transcribir                 # TRANSCRIBE los audios y notas de voz de la ventana
 *   node leer-chat.mjs "Marta" 80 --transcribir --bajar --tipo audio,ptt   # además los deja guardados
 *
 *   OTRAS:
 *   --json            salida en JSON      --stdout     imprime todo por pantalla en vez de a ficheros
 *   --max-paginas N   tope de páginas con --todo (por defecto 400)
 *   --idioma es       idioma de la transcripción (por defecto es)
 *   --borrar-temporales   borra las salidas crudas anteriores y termina
 *
 * DÓNDE SALE LO LEÍDO: por defecto el script escribe SU PROPIA salida en una carpeta temporal del sistema
 * (salida.txt, diagnostico.txt, codigo.txt) y por pantalla solo imprime esa ruta. Así no depende de redirecciones
 * de bash (que en Windows PowerShell rompen los acentos) y la conversación cruda nunca queda en otro sitio.
 * Las carpetas de más de 24 h se borran solas.
 *
 * Códigos de salida:
 *   0 ok · 2 error de uso · 3 timeout global · 4 la página nunca quedó usable · 5 no se pudo leer
 *   6 chat no encontrado · 7 VARIOS chats casan (no elige: lista)
 *   8 --bajar: ningún adjunto casa con el filtro · 9 --bajar: había adjuntos y no se bajó NINGUNO
 *   10 sesión NO vinculada (NO pide QR: se vincula una vez con vincular.mjs) · 11 falta el Chrome de puppeteer
 *   12 la sesión la usa otro proceso (no toca nada)
 *   14 --transcribir: no hay clave de transcripción (audios sin transcribir) · 15 --transcribir: falló alguna transcripción
 *
 * ─── POR QUÉ NO USA LA API NORMAL DE whatsapp-web.js ──────────────────────────
 * La API de alto nivel (getChats…) está rota por cambios de WhatsApp Web: un solo chat que falle al serializar
 * rechaza el lote entero, y el evento `ready` a veces no llega aunque la página funcione. Este script habla
 * directamente con los módulos internos de WhatsApp Web (WAWebCollections, WAWebChatLoadMessages) vía
 * pupPage.evaluate, que es una capa estable, y no espera a `ready`.
 *
 * ─── LAS GUARDAS (no quitarlas: cada una arregla un fallo medido) ─────────────
 * 1. `unhandledRejection`: un rechazo de la librería durante la sincronización mataba el proceso a medias
 *    (muerte sucia = sesión corrompida).
 * 2. `authStrategy.logout` neutralizado: LocalAuth.logout() BORRA la carpeta de la sesión y la librería lo llama
 *    sola cuando WhatsApp emite un logout. Un lector de solo lectura no borra nada.
 * 3. Cierre con `client.destroy()`, nunca matando el proceso.
 * 4. Un solo proceso a la vez (fichero de bloqueo): dos a la vez corrompen la sesión.
 * 5. Si la sesión no existe o WhatsApp pide un QR: salida 10 SIN mostrarlo. El QR solo se pide al vincular.
 */
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, writeFileSync, existsSync, readFileSync, statSync, readdirSync, rmSync } from 'fs';
import { createHash } from 'crypto';
import { homedir } from 'os';
import { clasificarConsulta, coincidir, coincidirNumero, lineasListado } from './lib/coincidir-chat.mjs';
import { parsearTipos, elegirAdjuntos, nombreSeguro, rutaLibre, tamanoLegible, MAX_POR_DEFECTO } from './lib/adjuntos.mjs';
import { dirSesion, dirCacheWeb, dirTemporal, asegurar } from './lib/rutas.mjs';
import { tomarBloqueo } from './lib/bloqueo.mjs';
import { cargar as cargarPersonas, buscar as buscarPersona, idDePersona, marcarUso } from './lib/personas.mjs';
import { configuracion, estadoConfiguracion, transcribirFichero, marca, ErrorTranscripcion } from './lib/transcribir.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLIENT_ID = 'principal';

// Se ejecuta también dentro de pupPage.evaluate: sin dependencias de Node.
export function identidadContacto(id, contacto) {
  const serial = (v) => typeof v === 'string' ? v : (v?._serialized || v?.$1 || (v?.server && v?.user ? `${v.user}@${v.server}` : null));
  const telefonoDe = (v) => {
    const s = serial(v);
    return s && /^\d+@c\.us$/.test(s) ? s.slice(0, -5) : null;
  };
  const telefono = telefonoDe(id) || telefonoDe(contacto?.phoneNumber) || telefonoDe(contacto?.id);
  const nombres = [...new Set([contacto?.name, contacto?.pushname, contacto?.formattedName].filter(Boolean))];
  return { id: serial(id), telefono, nombre: nombres[0] || null, nombres,
    estadoTelefono: telefono ? 'visible' : 'sin teléfono visible' };
}

export function lineasMiembros(miembros = []) {
  return miembros.map((p, i) => `${i + 1}. ${p.nombre || '(sin nombre)'} — ${p.id} — ${p.telefono || 'sin teléfono visible'}${p.admin ? ' [ADMIN]' : ''}`);
}

export async function leerMiembrosPagina(chatId, identificar) {
  const Col = window.require('WAWebCollections');
  const wid = window.require('WAWebWidFactory').createWid(chatId);
  let chat = Col.Chat.get(wid);
  if (!chat) chat = (await window.require('WAWebFindChatAction').findOrCreateLatestChat(wid))?.chat;
  if (!chat) return { ok: false, motivo: 'chat no encontrado' };
  const metadata = Col.GroupMetadata || Col.WAWebGroupMetadataCollection;
  if (metadata?.update) await metadata.update(wid); // Consulta metadatos, nunca mensajes ni acuses.
  const grupo = chat.groupMetadata || metadata?.get(wid);
  if (!grupo?.participants) return { ok: false, motivo: 'participantes no disponibles' };
  const participantes = grupo.participants.getModelsArray ? grupo.participants.getModelsArray() : grupo.participants;
  const miembros = participantes.map((p) => {
    const id = p.id?._serialized || p.id?.$1 || (typeof p.id === 'string' ? p.id : p.id?.toString());
    const contacto = Col.Contact?.get(id) || Col.Contact?.get(p.id);
    let ident = identificar(id, contacto);
    // Sin nombre en la ficha @lid: se prueba la ficha del mismo número (@c.us), que a veces sí trae el pushname.
    if (!ident.nombres.length && ident.telefono) {
      const alt = Col.Contact?.get(`${ident.telefono}@c.us`);
      if (alt) {
        const porNumero = identificar(id, alt);
        ident = { ...ident, nombre: porNumero.nombre, nombres: porNumero.nombres };
      }
    }
    return { ...ident, admin: !!(p.isAdmin || p.isSuperAdmin) };
  });
  return { ok: true, id: chatId, nombre: chat.formattedTitle || chat.name || null, total: miembros.length, miembros };
}

// Importar este fichero en los tests no abre WhatsApp ni consulta la sesión.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {

// ── Argumentos ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flags = { json: false, stdout: false, bajar: false, listar: false, miembros: false, todo: false, transcribir: false, borrar: false };
const val = { desde: null, hasta: null, tipo: null, fichero: '', salida: null, max: null, maxPaginas: null, idioma: null };
const pos = [];
const CON_VALOR = { '--desde': 'desde', '--hasta': 'hasta', '--tipo': 'tipo', '--fichero': 'fichero', '--salida': 'salida', '--max': 'max', '--max-paginas': 'maxPaginas', '--idioma': 'idioma' };
const SIN_VALOR = { '--json': 'json', '--stdout': 'stdout', '--bajar': 'bajar', '--listar': 'listar', '--miembros': 'miembros', '--todo': 'todo', '--transcribir': 'transcribir', '--borrar-temporales': 'borrar' };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  const [k, v] = a.startsWith('--') && a.includes('=') ? [a.slice(0, a.indexOf('=')), a.slice(a.indexOf('=') + 1)] : [a, undefined];
  if (SIN_VALOR[k]) flags[SIN_VALOR[k]] = true;
  else if (CON_VALOR[k]) val[CON_VALOR[k]] = v !== undefined ? v : args[++i];
  else if (a.startsWith('--')) { console.error(`### opción desconocida: ${a}`); process.exit(2); }
  else pos.push(a);
}
const uso = (m) => { console.error(`### ${m}`); process.exit(2); };

// ── Salida a ficheros (la conversación cruda va a una carpeta temporal, no a otro sitio) ──────
const RAIZ_TMP = dirTemporal();
if (flags.borrar) {
  let n = 0;
  if (existsSync(RAIZ_TMP)) for (const d of readdirSync(RAIZ_TMP)) { rmSync(join(RAIZ_TMP, d), { recursive: true, force: true }); n++; }
  console.log(`Borradas ${n} carpeta(s) de salidas temporales en ${RAIZ_TMP}`);
  process.exit(0);
}
// Barrido de lo viejo (>24 h): son conversaciones de terceros, no deben acumularse.
try {
  if (existsSync(RAIZ_TMP)) for (const d of readdirSync(RAIZ_TMP)) {
    const p = join(RAIZ_TMP, d);
    if (Date.now() - statSync(p).mtimeMs > 24 * 3600 * 1000) rmSync(p, { recursive: true, force: true });
  }
} catch { /* limpieza de cortesía */ }

const sello = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
const DIR_RUN = join(RAIZ_TMP, `${sello}-${process.pid}`);
const lineasSalida = [], lineasDiag = [];
const out = (...a) => lineasSalida.push(a.join(' '));                  // lo leído → salida.txt
const err = (...a) => { const t = a.join(' '); lineasDiag.push(t); console.error(t); };   // diagnóstico
let finalizado = false;
function finalizar(code) {
  if (finalizado) return; finalizado = true;
  try {
    if (flags.stdout) { for (const l of lineasSalida) console.log(l); return; }
    if (!lineasSalida.length && !lineasDiag.length) return;
    asegurar(DIR_RUN);
    const ext = flags.json ? 'json' : 'txt';
    writeFileSync(join(DIR_RUN, `salida.${ext}`), lineasSalida.join('\n') + '\n', 'utf8');
    writeFileSync(join(DIR_RUN, 'diagnostico.txt'), lineasDiag.join('\n') + '\n', 'utf8');
    writeFileSync(join(DIR_RUN, 'codigo.txt'), String(code) + '\n', 'utf8');
    console.log(`SALIDA: ${join(DIR_RUN, `salida.${ext}`)}`);
    console.log(`DIAGNOSTICO: ${join(DIR_RUN, 'diagnostico.txt')}`);
    console.log(`CODIGO: ${code}`);
  } catch (e) { console.error(`### no pude escribir la salida: ${e.message}`); }
}
function salir(code) { finalizar(code); process.exit(code); }

const fmtOpts = { timeZone: process.env.WHATSAPP_TZ || undefined };
const fmt = (t) => new Date(t * 1000).toLocaleString('es-ES', fmtOpts);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const consulta = clasificarConsulta(pos[0] || process.env.ID || '');
if (consulta.tipo === 'vacia' && !flags.listar) uso('Uso: node leer-chat.mjs "<nombre | teléfono | id>" [N] [--desde AAAA-MM-DD] [--hasta AAAA-MM-DD] [--todo] [--bajar] [--transcribir] [--json]');
if (consulta.tipo === 'vacia') uso('--listar necesita un trozo de nombre o de teléfono');

const fechaLocal = (txt, nombre, finDeDia) => {
  if (!txt) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(txt)) uso(`${nombre} "${txt}" no es una fecha AAAA-MM-DD`);
  const ms = Date.parse(`${txt}T${finDeDia ? '23:59:59' : '00:00:00'}`);   // hora local del ordenador
  if (Number.isNaN(ms)) uso(`${nombre} "${txt}" no es una fecha válida`);
  return Math.floor(ms / 1000);
};
const DESDE_T = fechaLocal(val.desde, '--desde', false);
const HASTA_T = fechaLocal(val.hasta, '--hasta', true);
if (DESDE_T && HASTA_T && HASTA_T < DESDE_T) uso('--hasta es anterior a --desde');

if (flags.listar) {
  if (flags.miembros || flags.bajar || flags.transcribir || flags.todo || val.desde || val.hasta || pos[1] || val.tipo || val.fichero || val.salida || val.max) {
    uso('--listar no se combina con N, --desde, --hasta, --todo ni con --bajar/--transcribir: solo identifica chats. No arranco.');
  }
  if (consulta.tipo === 'id') uso('--listar busca por NOMBRE o por TELÉFONO (un trozo basta). Para un id usa la lectura normal.');
}
if (flags.miembros && (consulta.tipo === 'numero' || consulta.tipo === 'cifras' || flags.bajar || flags.transcribir || flags.todo || val.desde || val.hasta || pos[1] || val.tipo || val.fichero || val.salida || val.max)) {
  uso('--miembros exige el id o el NOMBRE de un grupo y solo se combina con --json. No arranco.');
}
if (flags.miembros && consulta.tipo === 'id' && !consulta.id.endsWith('@g.us')) uso('--miembros solo vale para grupos (id acabado en @g.us) o el nombre de un grupo.');
if (flags.todo && (pos[1] || val.desde)) uso('--todo no se combina con N ni con --desde (usa --hasta si quieres acotar el final).');
if (consulta.tipo === 'cifras') uso('un trozo de teléfono solo sirve con --listar. Para leer, da el número completo o el nombre.');
if (!flags.bajar && !flags.transcribir && (val.fichero || val.salida)) uso('--fichero y --salida solo tienen sentido con --bajar. No arranco para no leer sin bajar lo que pedías.');
if (!flags.bajar && !flags.transcribir && (val.tipo || val.max)) uso('--tipo y --max solo tienen sentido con --bajar o --transcribir.');
if (flags.transcribir && (val.tipo || val.fichero) && !flags.bajar) uso('con --transcribir solo se transcriben audios y notas de voz; --tipo y --fichero son de --bajar.');

let TIPOS_BAJAR = null, MAX_BAJAR = MAX_POR_DEFECTO;
const DIR_BAJAR = val.salida || join(homedir(), 'Downloads');
if (flags.bajar) {
  try { TIPOS_BAJAR = parsearTipos(val.tipo); } catch (e) { uso(e.message); }
}
if (val.max != null) {
  MAX_BAJAR = parseInt(val.max, 10);
  if (!(MAX_BAJAR >= 1)) uso(`--max "${val.max}" no es un número ≥ 1`);
} else if (flags.transcribir && !flags.bajar) MAX_BAJAR = 20;
const MAX_PAGINAS = val.maxPaginas != null ? parseInt(val.maxPaginas, 10) : 400;
if (!(MAX_PAGINAS >= 1)) uso(`--max-paginas "${val.maxPaginas}" no es un número ≥ 1`);

const LIMITE_DESDE = 5000;
let N = flags.todo ? 0 : (pos[1] || process.env.N ? parseInt(pos[1] || process.env.N, 10) : (DESDE_T ? LIMITE_DESDE : 50));
if (!flags.todo && !(N >= 1)) uso(`N "${pos[1]}" no es un número ≥ 1`);
const ESPERA_MAX = parseInt(process.env.ESPERA_MAX || '240000', 10);
const ESTABLE_MS = parseInt(process.env.ESTABLE_MS || '15000', 10);
const SYNC_MAX = parseInt(process.env.SYNC_MAX_MS || (consulta.tipo === 'nombre' ? '150000' : '45000'), 10);
const TIMEOUT_GLOBAL = parseInt(process.env.TIMEOUT_MS || String(ESPERA_MAX + 180000 + (flags.todo ? 25 * 60000 : 0) + (flags.transcribir ? 30 * 60000 : 0)), 10);

// ── Antes de abrir nada: ¿hay sesión? ¿la usa otro? ───────────────────────────
const PERSONAS = (() => { try { return cargarPersonas(); } catch (e) { err(`### ${e.message}`); return { personas: [] }; } })();
const SESION_CARPETA = join(dirSesion(), `session-${CLIENT_ID}`);
if (!existsSync(SESION_CARPETA)) {
  err('### SESIÓN NO VINCULADA: este WhatsApp aún no está enlazado con la skill.');
  err('### Se enlaza UNA sola vez con `node vincular.mjs` (antes, enseña al usuario el aviso de riesgo de SKILL.md y espera su sí). No se pide ningún QR desde aquí.');
  salir(10);
}
const bloqueo = tomarBloqueo();
if (!bloqueo.ok) {
  err(`### SESIÓN EN USO por otro proceso${bloqueo.pid ? ` (pid ${bloqueo.pid})` : ''}. No la toco: dos procesos a la vez la corrompen.`);
  err('### Espera a que termine el otro (no lo mates) y repite.');
  salir(12);
}

// ── GUARDA 1: que un rechazo de la librería no mate el proceso ────────────────
process.on('unhandledRejection', (e) => err('[guarda] unhandledRejection tragado:', e?.message || e));
process.on('uncaughtException', (e) => err('[guarda] uncaughtException tragado:', e?.message || e));

const { default: pkg } = await import('whatsapp-web.js');
const { Client, LocalAuth } = pkg;
const client = new Client({
  authStrategy: new LocalAuth({ clientId: CLIENT_ID, dataPath: dirSesion() }),
  webVersionCache: { type: 'local', path: dirCacheWeb() },
  puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--mute-audio', '--disable-audio-output'] },
});

// ── GUARDA 2: la librería NO borra la sesión a nuestras espaldas ──────────────
client.authStrategy.logout = async () => {
  err('[guarda] BLOQUEADO: la librería quiso BORRAR la sesión del disco. No la borro.');
};

let cerrando = false;
async function cerrar(code) {
  if (cerrando) return; cerrando = true;
  setTimeout(() => { err('[cierre] el navegador no cerró en 30 s: salgo igualmente'); bloqueo.soltar(); finalizar(code); process.exit(code); }, 30000).unref();
  // ── GUARDA 3: cierre limpio. Nunca pkill/kill. ─────────────────────────────
  try { await client.destroy(); } catch (e) { err('[cierre] destroy:', e?.message); }
  bloqueo.soltar();
  salir(code);
}

// ── GUARDA 5: aquí NUNCA se muestra un QR ─────────────────────────────────────
client.on('qr', () => {
  err('### SESIÓN NO VÁLIDA: WhatsApp pide enlazar de nuevo. No muestro ningún QR desde aquí.');
  err('### Dile al usuario que su WhatsApp se desvinculó (¿cerró la sesión en el móvil?). Volver a vincular es una decisión suya: dos QR pueden desincronizar su WhatsApp.');
  cerrar(10);
});
client.on('auth_failure', (m) => { err('### AUTH_FAILURE:', m); cerrar(10); });

// ── Espera a que la PÁGINA esté usable Y la sincronización se estabilice ──────
async function esperarSync(maxMs) {
  const t0 = Date.now();
  let firma = null, desde = Date.now(), ultimo = null;
  while (Date.now() - t0 < maxMs) {
    if (cerrando) return null;
    try {
      const est = await client.pupPage.evaluate(() => {
        let socket = null, ok = false, nChats = -1, nContactos = -1, maxT = 0;
        try { socket = window.require('WAWebSocketModel').Socket.state; } catch (e) { socket = 'ERR'; }
        try {
          const C = window.require('WAWebCollections');
          ok = !!C.Chat;
          const cs = C.Chat.getModelsArray();
          nChats = cs.length;
          for (const c of cs) if ((c.t || 0) > maxT) maxT = c.t;
          nContactos = C.Contact ? C.Contact.getModelsArray().length : -1;
        } catch (e) { ok = false; }
        return { socket, ok, nChats, nContactos, maxT };
      });
      ultimo = est;
      const f = `${est.nChats}/${est.nContactos}/${est.maxT}`;
      if (f !== firma) {
        firma = f; desde = Date.now();
        err(`[sync] socket=${est.socket} chats=${est.nChats} contactos=${est.nContactos} actividad más reciente=${est.maxT ? fmt(est.maxT) : '-'}`);
      }
      if (est.ok && est.socket === 'CONNECTED' && est.nChats > 0 && Date.now() - desde >= ESTABLE_MS) return { ...est, estable: true };
    } catch (e) { /* contexto destruido por navegación: reintentamos */ }
    await sleep(3000);
  }
  if (ultimo && ultimo.ok && ultimo.socket === 'CONNECTED') {
    err(`[sync] NO se estabilizó en ${Math.round(maxMs / 1000)} s: leo con la sincronización a medias y lo digo en la salida`);
    return { ...ultimo, estable: false };
  }
  return null;
}

// ── Lista ligera de chats y contactos guardados (para resolver un nombre o un número) ─────
async function listar() {
  await client.pupPage.evaluate(`window.__lectorIdentidadContacto = ${identidadContacto.toString()}`);
  return await client.pupPage.evaluate(() => {
    const Col = window.require('WAWebCollections');
    const ident = window.__lectorIdentidadContacto;
    const chats = [], contactos = [];
    // Uno a uno y tolerando fallos: el lote entero es lo que rompe getChats().
    for (const c of Col.Chat.getModelsArray()) {
      try {
        const id = c.id?._serialized || c.id?.$1;
        const grupo = !!id && id.endsWith('@g.us');
        let telefono = null;
        if (!grupo) telefono = ident(c.id, Col.Contact?.get(c.id)).telefono;
        chats.push({ id, titulo: c.formattedTitle || c.name || null, grupo, t: c.t || 0, telefono });
      } catch (e) { /* un chat roto no tumba la búsqueda */ }
    }
    try {
      for (const k of Col.Contact.getModelsArray()) {
        try {
          const nombres = [k.name, k.shortName, k.pushname, k.formattedName].filter(Boolean);
          const i = ident(k.id, k);
          if (nombres.length || i.telefono) contactos.push({ id: i.id, nombres, esMio: !!k.isMyContact, telefono: i.telefono });
        } catch (e) { /* idem */ }
      }
    } catch (e) { /* sin colección de contactos: se busca solo en chats */ }
    return { chats, contactos };
  });
}

// ── Lectura de bajo nivel: se salta el wrapper roto de la librería ────────────
// limite 0 = sin límite (--todo). Pagina hacia atrás hasta juntar `limite`, o pasar `desdeT`, o agotar el historial,
// con un tope de `maxVueltas` páginas.
async function leer(chatId, limite, desdeT, hastaT, maxVueltas) {
  await client.pupPage.evaluate(`window.__lectorIdentidadContacto = ${identidadContacto.toString()}`);
  return await client.pupPage.evaluate(async (chatId, limite, desdeT, hastaT, maxVueltas) => {
    const R = { ok: false };
    const Col = window.require('WAWebCollections');
    const wid = window.require('WAWebWidFactory').createWid(chatId);

    // El chat puede no estar en la colección local y/o vivir bajo un @lid distinto del número
    // (migración LID de WhatsApp): findOrCreateLatestChat lo resuelve.
    let chat = Col.Chat.get(wid);
    if (!chat) chat = (await window.require('WAWebFindChatAction').findOrCreateLatestChat(wid))?.chat;
    if (!chat) return { ok: false, motivo: 'chat no encontrado' };

    R.id = chat.id?._serialized || chat.id?.$1;
    R.nombre = chat.formattedTitle || chat.name || null;
    R.numero = chat.id?.server === 'g.us' ? null : (chat.id?.user || null);
    R.esGrupo = !!chat.groupMetadata || chat.id?.server === 'g.us';

    const noNotif = (m) => !m.isNotification;
    let msgs = chat.msgs.getModelsArray().filter(noNotif);
    const masViejo = () => msgs.reduce((mn, x) => Math.min(mn, x.t), Infinity);
    const falta = () => (desdeT ? (msgs.length === 0 || masViejo() > desdeT) : (limite ? msgs.length < limite : true));
    let vueltas = 0, agotado = false;
    while (falta() && vueltas < maxVueltas) {
      vueltas++;
      const cargados = await window.require('WAWebChatLoadMessages').loadEarlierMsgs({ chat });
      if (!cargados || !cargados.length) { agotado = true; break; }
      msgs = chat.msgs.getModelsArray().filter(noNotif);
    }
    R.vueltas = vueltas;
    R.totalEnCache = msgs.length;
    R.historialAgotado = agotado;
    R.cortadoPorPaginas = !agotado && vueltas >= maxVueltas && falta();
    R.ventanaCompleta = desdeT ? (agotado || (msgs.length > 0 && masViejo() <= desdeT)) : true;

    msgs.sort((a, b) => a.t - b.t);
    if (desdeT) msgs = msgs.filter((m) => m.t >= desdeT);
    if (hastaT) msgs = msgs.filter((m) => m.t <= hastaT);
    R.truncadoPorTope = !!limite && msgs.length > limite;
    if (R.truncadoPorTope) msgs = msgs.slice(msgs.length - limite);

    // Extracción a mano. NO usamos window.WWebJS.getMessageModel: ese es el wrapper que arrastra el drift.
    const nombreDe = (id) => {
      if (!id) return null;
      try { const c = Col.Contact.get(id); return c?.formattedName || c?.pushname || c?.name || null; } catch (e) { return null; }
    };

    const TIPOS_MEDIA = ['image', 'video', 'audio', 'ptt', 'document', 'sticker'];
    // En los mensajes de media, `body` NO es texto: es la miniatura en base64. El texto está en `caption`.
    const textoDe = (m, esMedia) => {
      if (esMedia) return m.caption || m.filename || '';
      const b = m.body || '';
      return /^[A-Za-z0-9+/=]{200,}$/.test(b.replace(/\s/g, '')) ? '' : b;
    };

    // Id serializado del mensaje (el que acepta resolveMediaBlob). En WhatsApp Web 2.3000.x la clave se llama `$1`
    // y `_serialized` viene vacío. Solo se da por bueno un id con la forma «true_…» / «false_…»; si no, null
    // (y --bajar lo avisa, no lo silencia).
    const idDe = (k) => {
      if (!k) return null;
      const s = k._serialized || k.$1 || (typeof k.toString === 'function' ? String(k) : null);
      return typeof s === 'string' && /^(true|false)_/.test(s) ? s : null;
    };

    R.mensajes = msgs.map((m) => {
      const fromMe = !!m.id?.fromMe;
      const serial = (id) => id?._serialized || id?.$1 || (typeof id === 'string' ? id : null);
      const autorId = fromMe ? serial(window.require('WAWebUserPrefsMeUser').getMaybeMePnUser()) : (serial(m.author) || serial(m.from));
      const identidad = window.__lectorIdentidadContacto(autorId, autorId ? Col.Contact?.get(autorId) : null);
      // Solo por TIPO: una vista previa de enlace es type 'chat' pero trae mediaKey, y tratarla como media se comía la URL.
      const esMedia = TIPOS_MEDIA.includes(m.type);
      const q = m.quotedMsg;
      // En un chat individual el autor sin nombre es el propio chat; en un GRUPO nunca (sería atribuir todo al grupo).
      const respaldo = R.esGrupo ? (identidad.telefono ? `+${identidad.telefono}` : null) : R.nombre;
      return {
        id: idDe(m.id),                         // para --bajar: el id exacto del mensaje que trae el fichero
        t: m.t,
        fromMe,
        autor: fromMe ? 'Yo' : (nombreDe(autorId) || identidad.nombre || respaldo || autorId || '?'),
        autorId: identidad.id,
        autorTelefono: identidad.telefono,
        autorNombre: identidad.nombre || (fromMe ? 'Yo' : nombreDe(autorId)),
        autorNombres: identidad.nombres,
        tipo: m.type,
        texto: textoDe(m, esMedia),
        media: esMedia,
        fichero: esMedia ? (m.filename || null) : null,
        mimetype: esMedia ? (m.mimetype || null) : null,
        bytes: esMedia ? (Number(m.size) || null) : null,
        duracion: (m.type === 'ptt' || m.type === 'audio') ? (Number(m.duration) || null) : null,
        citado: q ? textoDe(q, TIPOS_MEDIA.includes(q.type)).slice(0, 80) : null,
      };
    });
    R.ok = true;
    return R;
  }, chatId, limite, desdeT, hastaT, maxVueltas);
}

// ── Bajar adjuntos ────────────────────────────────────────────────────────────
// Misma capa que la lectura (resolveMediaBlob), sin pasar por el wrapper Message de la librería.
// SOLO LECTURA: bajar un adjunto no marca nada como leído. El fichero viaja del navegador a Node en base64
// (~1,37× el original) → tope por seguridad.
const TOPE_MB = parseInt(process.env.TOPE_MB || '150', 10);

async function bajarUno(msgId) {
  return await client.pupPage.evaluate(async (id) => {
    const r = await window.WWebJS.resolveMediaBlob(id);
    if (!r) return null;
    const data = await window.WWebJS.arrayBufferToBase64Async(await r.blob.arrayBuffer());
    return { data, mimetype: r.mimetype, filename: r.filename, filesize: r.filesize };
  }, msgId);
}

const md5De = (buf) => createHash('md5').update(buf).digest('hex');

async function bajarAdjuntos(mensajes, { tipos, fichero, max, dir }) {
  const { elegidos, total, recortado, sinId } = elegirAdjuntos(mensajes, { tipos, fichero, max });
  const res = { carpeta: dir, tipos, filtro: fichero || null, candidatos: total, sinId, recortadoPorMax: recortado, max, bajados: [], fallidos: [] };
  if (!elegidos.length) return res;
  mkdirSync(dir, { recursive: true });
  for (const m of elegidos) {
    const etiqueta = m.fichero || `${m.tipo} del ${fmt(m.t)}`;
    const base = { mensaje: m.id, de: m.autor, fecha: fmt(m.t), tipo: m.tipo, t: m.t, duracion: m.duracion || null };
    if (m.bytes && m.bytes > TOPE_MB * 1024 * 1024) {
      res.fallidos.push({ ...base, fichero: etiqueta, motivo: `pesa ${tamanoLegible(m.bytes)}, por encima del tope de ${TOPE_MB} MB (súbelo con TOPE_MB=…)` });
      continue;
    }
    let r = null, motivo = null;
    for (let i = 1; i <= 3 && !r; i++) {
      try {
        err(`### bajando «${etiqueta}» (intento ${i})…`);
        r = await bajarUno(m.id);
        if (!r) { motivo = 'WhatsApp no lo sirve: caducado en su servidor o aún sin sincronizar'; if (i < 3) await sleep(4000); }
      } catch (e) {
        motivo = e.message; err(`### intento ${i} falló: ${e.message}`);
        await sleep(6000); await esperarSync(90000);
      }
    }
    if (!r) { res.fallidos.push({ ...base, fichero: etiqueta, motivo }); continue; }

    const buf = Buffer.from(r.data, 'base64');
    const md5 = md5De(buf);
    const nombre = nombreSeguro(m.fichero || r.filename, { mimetype: r.mimetype || m.mimetype, tipo: m.tipo, t: m.t });
    // Ya hay uno con ese nombre y ES EL MISMO fichero → no se duplica (ni se pisa).
    const previa = join(dir, nombre);
    if (existsSync(previa)) {
      try { if (md5De(readFileSync(previa)) === md5) { res.bajados.push({ ...base, fichero: nombre, ruta: previa, bytes: buf.length, md5, yaEstaba: true }); continue; } } catch (e) { /* ilegible: se baja con otro nombre */ }
    }
    const ruta = rutaLibre(dir, nombre, existsSync);
    writeFileSync(ruta, buf);
    const enDisco = statSync(ruta).size;
    if (enDisco !== buf.length) { res.fallidos.push({ ...base, fichero: nombre, motivo: `se escribió incompleto (${enDisco} de ${buf.length} bytes)` }); continue; }
    if (r.filesize && Number(r.filesize) !== buf.length) err(`### aviso: WhatsApp declaraba ${r.filesize} B y llegaron ${buf.length} B en «${nombre}»`);
    res.bajados.push({ ...base, fichero: nombre, ruta, bytes: buf.length, md5, yaEstaba: false });
  }
  return res;
}

function imprimirBajada(b, titulo) {
  out(`=== ${titulo} (${b.tipos.join(', ')}${b.filtro ? ` · nombre con «${b.filtro}»` : ''}) → ${b.carpeta} ===`);
  if (b.sinId) out(`=== AVISO: ${b.sinId} adjunto(s) del tipo pedido NO traen id y no se pueden bajar (WhatsApp Web cambió el formato del id: hay que revisar idDe() en este script) ===`);
  if (!b.candidatos) { if (b.sinId) return; out('=== NINGÚN adjunto de la ventana leída casa con el filtro. Si lo buscas, amplía la ventana (N mayor, --desde o --todo) o cambia --tipo/--fichero. ==='); return; }
  if (b.recortadoPorMax) out(`=== ${b.candidatos} casaban; bajo los ${b.max} más recientes (--max para cambiarlo) ===`);
  for (const x of b.bajados) out(`  ✓ ${x.yaEstaba ? 'YA ESTABA, idéntico' : 'BAJADO'}: ${x.ruta} · ${tamanoLegible(x.bytes)} · md5 ${x.md5} · de ${x.de}, ${x.fecha}`);
  for (const x of b.fallidos) out(`  ✗ NO SE PUDO: «${x.fichero}» (${x.de}, ${x.fecha}) — ${x.motivo}`);
}

// ── Transcripción de los audios bajados ───────────────────────────────────────
async function transcribirBajados(bajada) {
  const cfg = configuracion();
  const est = estadoConfiguracion(cfg);
  const res = { motor: cfg.motor, modelo: cfg.modelo, hechas: new Map(), fallidas: [], codigo: 0, aviso: null };
  if (!est.ok) { res.codigo = 14; res.aviso = est.motivo; return res; }
  const nube = cfg.motor === 'groq' || cfg.motor === 'openai' || (cfg.motor === 'compatible' && !/^https?:\/\/(localhost|127\.|\[::1\])/.test(cfg.url));
  if (nube) out(`=== AUDIO ENVIADO A ${cfg.motor.toUpperCase()} (servicio externo) para transcribirlo: son datos de terceros, el usuario tiene que saberlo ===`);
  for (const b of bajada.bajados) {
    try {
      err(`### transcribiendo «${b.fichero}»…`);
      const t = await transcribirFichero(b.ruta, { cfg, idioma: val.idioma || undefined, log: (m) => err(`[transcribir] ${m}`) });
      res.hechas.set(b.mensaje, t);
    } catch (e) {
      if (e instanceof ErrorTranscripcion && e.codigo === 'clave-rechazada') { res.codigo = 15; res.aviso = e.message; break; }
      res.fallidas.push({ fichero: b.fichero, motivo: e.message }); res.codigo = 15;
    }
  }
  return res;
}

// ── Salida ────────────────────────────────────────────────────────────────────
const sincro = (est) => ({
  chats: est.nChats, contactos: est.nContactos, estable: !!est.estable,
  ultimaActividadSesion: est.maxT || null,
});
const lineaSincro = (est) =>
  `=== sesión: ${est.nChats} chats · ${est.nContactos} contactos · sincronización ${est.estable ? 'ESTABLE' : 'A MEDIAS (puede faltar lo más reciente)'} · actividad más reciente de la sesión: ${est.maxT ? fmt(est.maxT) : 'n/d'} ===`;

function etiquetaTipo(tipo, n) {
  const p = n === 1;
  return ({ ptt: p ? 'nota de voz' : 'notas de voz', audio: p ? 'audio' : 'audios', image: p ? 'imagen' : 'imágenes',
    video: p ? 'vídeo' : 'vídeos', document: p ? 'documento' : 'documentos', sticker: p ? 'sticker' : 'stickers' })[tipo] || tipo;
}

/** Datos para resolver un nombre/número: se listan UNA vez y se reutilizan. */
async function datosDeChats() {
  let datos = null;
  for (let i = 1; i <= 3 && !datos; i++) {
    try { datos = await listar(); } catch (e) { err(`### listar intento ${i} falló: ${e.message}`); await sleep(5000); }
  }
  return datos;
}

/** Marca las entradas de `personas-frecuentes.json` que ya conocen a este candidato (para mostrarlo en las listas). */
const guardadaComo = (c) => {
  const r = buscarPersona(c.id, PERSONAS);
  if (r.elegido) return r.elegido.nombre;
  if (c.telefono) { const t = buscarPersona(`+${c.telefono}`, PERSONAS); if (t.elegido) return t.elegido.nombre; }
  return null;
};

async function main() {
  const objetivo = consulta.nombre || consulta.telefono || consulta.cifras || consulta.id;
  if (flags.listar) err(`### listando los chats que casan con «${objetivo}» (no se lee ningún mensaje)`);
  else if (flags.miembros) err(`### consultando miembros de «${objetivo}» (sin mensajes)`);
  else err(`### leyendo «${objetivo}» (${flags.todo ? 'chat entero' : DESDE_T ? `desde ${val.desde}, tope ${N}` : `últimos ${N}`})`);

  // 0) Personas frecuentes: si el nombre ya lo conocemos, se va directo al id (sin adivinar entre chats parecidos).
  let id = consulta.id, resolucion = null, desdePersonas = false;
  if (!flags.listar && consulta.tipo === 'nombre') {
    const r = buscarPersona(consulta.nombre, PERSONAS);
    if (r.candidatos.length > 1 && !r.elegido) {
      out(`\n=== VARIAS PERSONAS GUARDADAS CASAN CON «${consulta.nombre}» (${r.candidatos.length}) — no elijo yo ===`);
      r.candidatos.forEach((p, i) => out(`${i + 1}. ${p.nombre} — ${idDePersona(p)}${p.telefono ? ` — tel. +${p.telefono}` : ''}${p.grupo ? ' [GRUPO]' : ''} — última vez: ${p.ultimaVez || 'n/d'}`));
      out('=== pregunta al usuario cuál y repite con su id: node leer-chat.mjs <id> ===');
      if (flags.json) { lineasSalida.length = 0; out(JSON.stringify({ ok: false, motivo: 'varios', origen: 'personas-frecuentes', candidatos: r.candidatos }, null, 2)); }
      return cerrar(7);
    }
    if (r.elegido && idDePersona(r.elegido)) {
      id = idDePersona(r.elegido); desdePersonas = true;
      resolucion = `«${consulta.nombre}» → ${r.elegido.nombre} (de tus personas frecuentes)`;
      err(`### ${resolucion}`);
    }
  }

  const est = await esperarSync(SYNC_MAX);
  if (cerrando) return;
  if (!est) { err('### la página nunca llegó a estado usable (socket CONNECTED + colecciones)'); return cerrar(4); }

  // 1) ¿Qué chat? Un nombre o un trozo de teléfono se resuelve aquí, dentro de la misma sesión abierta.
  const porNombre = consulta.nombre && !desdePersonas;
  const porNumero = flags.listar && (consulta.tipo === 'numero' || consulta.tipo === 'cifras');
  if (porNombre || porNumero) {
    const datos = await datosDeChats();
    if (!datos) { err('### no pude listar los chats de la sesión'); return cerrar(5); }
    const r = porNumero ? coincidirNumero(consulta.telefono || consulta.cifras, datos) : coincidir(consulta.nombre, datos);
    if (flags.listar) {
      // Solo identifica: la sincronización a medias se dice SIEMPRE, para que «5 chats» no se lea como «ese es todo».
      const carga = `${datos.chats.length} chats cargados · sincronización ${est.estable ? 'ESTABLE' : 'A MEDIAS'}`;
      const cands = r.candidatos.map((c) => ({ ...c, guardadaComo: guardadaComo(c) }));
      if (flags.json) {
        out(JSON.stringify({ ok: cands.length > 0, filtro: objetivo, total: cands.length, chatsCargados: datos.chats.length,
          candidatos: cands.slice(0, 20).map((c) => ({ id: c.id, nombre: c.nombre, telefono: c.telefono || null, grupo: c.grupo, ultimo: c.ultimo || null, guardadaComo: c.guardadaComo })), sincronizacion: sincro(est) }, null, 2));
      } else if (!cands.length) {
        out(`\n=== NADA CARGADO QUE CASE CON «${objetivo}» (${carga}) ===`);
        out(est.estable ? '=== la sincronización terminó: es probable que no exista con ese nombre o número; prueba otro trozo ===' : '=== la sincronización va a medias: el chat PUEDE existir y no haber bajado aún; no digas «no existe» ===');
        out(`${lineaSincro(est)}\n`);
      } else {
        out(`\n=== CHATS Y CONTACTOS QUE CASAN CON «${objetivo}» (${cands.length}) — ${carga} ===`);
        const lin = lineasListado(cands, fmt);
        lin.forEach((l, i) => out(cands[i]?.guardadaComo ? `${l} — GUARDADA como «${cands[i].guardadaComo}»` : l));
        out('=== solo nombres, ids y teléfonos, sin texto de mensajes. Con el id exacto: node leer-chat.mjs <id> [--bajar …] ===');
        out(`${lineaSincro(est)}\n`);
      }
      return cerrar(cands.length ? 0 : 6);
    }
    if (!r.candidatos.length) {
      const motivo = `«${consulta.nombre}» no casa con ningún chat ni contacto guardado. Buscado en ${datos.chats.length} chats y ${datos.contactos.filter((c) => c.esMio).length} contactos guardados; sincronización ${est.estable ? 'estable' : 'INCOMPLETA: el chat puede existir y no haber bajado aún'}.`;
      if (flags.json) out(JSON.stringify({ ok: false, motivo: 'no encontrado', detalle: motivo, sincronizacion: sincro(est) }, null, 2));
      else out(`\n=== NO ENCONTRADO: ${motivo} ===\n${lineaSincro(est)}\n`);
      return cerrar(6);
    }
    if (!r.elegido) {
      const lista = r.candidatos.slice(0, 10).map((c, i) => ({ n: i + 1, id: c.id, nombre: c.nombre, telefono: c.telefono || null, grupo: c.grupo, ultimo: c.ultimo || null }));
      if (flags.json) out(JSON.stringify({ ok: false, motivo: 'varios', candidatos: lista, total: r.candidatos.length, sincronizacion: sincro(est) }, null, 2));
      else {
        out(`\n=== VARIOS CHATS CASAN CON «${consulta.nombre}» (${r.candidatos.length}) — no elijo yo ===`);
        for (const c of lista) out(`${c.n}. ${c.nombre || '(sin nombre)'} — ${c.id}${c.telefono ? ` — tel. +${c.telefono}` : ''}${c.grupo ? ' [GRUPO]' : ''} — último movimiento: ${c.ultimo ? fmt(c.ultimo) : 'desconocido (contacto sin chat cargado)'}`);
        out(`=== pregunta al usuario cuál es y repite con el id exacto: node leer-chat.mjs <id> ===\n${lineaSincro(est)}\n`);
      }
      return cerrar(7);
    }
    id = r.elegido.id;
    resolucion = `«${consulta.nombre}» → ${r.elegido.nombre} (${r.elegido.puntos === 3 ? 'coincidencia exacta' : 'única coincidencia'}${r.candidatos.length > 1 ? `; otras ${r.candidatos.length - 1} parciales descartadas` : ''})`;
    err(`### ${resolucion}`);
  } else if (flags.listar) {   // --listar con un nombre ya conocido por personas-frecuentes no llega aquí; por si acaso
    return cerrar(6);
  }

  if (flags.miembros) {
    await client.pupPage.evaluate(`window.__lectorIdentidadContacto = ${identidadContacto.toString()}; window.__lectorMiembros = ${leerMiembrosPagina.toString()}`);
    if (!String(id).endsWith('@g.us')) { err('### --miembros solo vale para grupos (id acabado en @g.us)'); return cerrar(2); }
    const r = await client.pupPage.evaluate((cid) => window.__lectorMiembros(cid, window.__lectorIdentidadContacto), id);
    if (flags.json) out(JSON.stringify({ ...r, sincronizacion: sincro(est) }, null, 2));
    else {
      out(`=== ${r.nombre || id} — ${id} — ${r.total || 0} miembros ===`);
      if (!r.ok) out(`=== ${r.motivo} ===`);
      for (const linea of lineasMiembros(r.miembros)) out(linea);
      out(lineaSincro(est));
    }
    return cerrar(r.ok ? 0 : r.motivo === 'chat no encontrado' ? 6 : 5);
  }

  // 2) Leer. El contexto muere si WhatsApp Web navega: reintentamos en vez de rendirnos.
  let R = null;
  for (let i = 1; i <= 4 && !R?.ok; i++) {
    try { R = await leer(id, N, DESDE_T, HASTA_T, flags.todo ? MAX_PAGINAS : 40); if (!R?.ok) err(`### intento ${i}: ${R?.motivo || 'sin datos'}`); }
    catch (e) { err(`### intento ${i} falló: ${e.message}`); await sleep(6000); await esperarSync(90000); }
    if (R && !R.ok && R.motivo === 'chat no encontrado') break;   // reintentar no lo hará aparecer
  }
  if (!R?.ok) { err('### NO SE PUDO LEER EL CHAT'); return cerrar(R?.motivo === 'chat no encontrado' ? 6 : 5); }
  if (desdePersonas) { try { marcarUso(id); } catch { /* la fecha de «última vez» no es crítica */ } }

  const sinTexto = {};
  const ultimo = R.mensajes.length ? R.mensajes[R.mensajes.length - 1].t : null;

  // 2b) Adjuntos y audios, ANTES de imprimir (así el JSON y el texto de cada audio van ya dentro).
  let bajada = null, transc = null, bajadaAudios = null, codigo = 0;
  if (flags.bajar) {
    bajada = await bajarAdjuntos(R.mensajes, { tipos: TIPOS_BAJAR, fichero: val.fichero, max: MAX_BAJAR, dir: DIR_BAJAR });
    if (!bajada.candidatos) codigo = bajada.sinId ? 9 : 8;   // 9 y no 8: había adjuntos y no se pudo ni empezar
    else if (!bajada.bajados.length) codigo = 9;
  }
  if (flags.transcribir) {
    // Los audios ya bajados con --bajar se reutilizan; si no, van a la carpeta temporal de esta lectura (se borra sola).
    const yaBajados = bajada ? bajada.bajados.filter((b) => b.tipo === 'audio' || b.tipo === 'ptt') : [];
    if (yaBajados.length) bajadaAudios = { ...bajada, bajados: yaBajados };
    else bajadaAudios = await bajarAdjuntos(R.mensajes, { tipos: ['audio', 'ptt'], fichero: '', max: MAX_BAJAR, dir: join(DIR_RUN, 'audios') });
    transc = await transcribirBajados(bajadaAudios);
    for (const m of R.mensajes) { const t = transc.hechas.get(m.id); if (t) { m.transcripcion = t.texto; m.transcripcionSegmentos = t.segmentos; } }
  }
  for (const m of R.mensajes) if (m.media && !m.texto && !m.transcripcion) sinTexto[m.tipo] = (sinTexto[m.tipo] || 0) + 1;
  if (!codigo && transc && transc.codigo) codigo = transc.codigo;
  else if (!codigo && transc && transc.hechas.size === 0 && bajadaAudios && !bajadaAudios.candidatos) codigo = 0;

  // ¿Se leyó el principio de verdad? (para «completo» y «desde»)
  const aviso = [];
  if (R.truncadoPorTope) aviso.push(`RECORTADO al tope de ${N} mensajes (hay más en la ventana; sube N o usa --todo)`);
  if (flags.todo) aviso.push(R.historialAgotado ? 'HISTORIAL COMPLETO: se llegó al primer mensaje que WhatsApp Web entrega (los más antiguos que no estén en tu móvil/servidor no existen para nadie)' : (R.cortadoPorPaginas ? `CORTADO por el tope de ${MAX_PAGINAS} páginas: el chat tiene más mensajes antiguos (sube --max-paginas)` : 'no se pudo confirmar que se llegara al principio'));
  if (DESDE_T && !R.ventanaCompleta) aviso.push(`NO llega hasta ${val.desde}: el historial cargado empieza después`);

  if (flags.json) {
    const bajadaJson = (b) => b && { ...b, hechas: undefined };
    out(JSON.stringify({ ...R, resolucion, sinTexto, avisos: aviso, ultimoMensaje: ultimo, sincronizacion: sincro(est), bajada: bajadaJson(bajada),
      transcripcion: transc && { motor: transc.motor, modelo: transc.modelo, aviso: transc.aviso, hechas: transc.hechas.size, fallidas: transc.fallidas } }, null, 2));
  } else {
    out(`\n=== ${R.nombre || '(sin nombre)'} — ${R.id}${R.numero ? ` — nº ${R.numero}` : ''}${R.esGrupo ? ' [GRUPO]' : ''} ===`);
    if (resolucion) out(`=== búsqueda: ${resolucion} ===`);
    out(`=== ${R.mensajes.length} mensajes (${R.vueltas} páginas cargadas del servidor)${aviso.length ? ` — ${aviso.join(' — ')}` : ''} ===\n`);
    for (const m of R.mensajes) {
      const cita = m.citado ? ` (respondiendo a: "${m.citado}")` : '';
      const dur = m.duracion ? ` ${marca(m.duracion)}` : '';
      const media = m.media ? ` [${m.tipo.toUpperCase()}${dur}${m.fichero ? ': ' + m.fichero : ''}]` : '';
      const texto = m.transcripcion ? `(transcrito) ${m.transcripcion.replace(/\n/g, ' ')}` : m.texto.replace(/\n/g, ' ⏎ ');
      out(`[${fmt(m.t)}] ${m.autor}:${media}${cita} ${texto}`);
    }
    out('');
    out(`=== último mensaje de este chat: ${ultimo ? fmt(ultimo) : 'ninguno en la ventana'} ===`);
    const partes = Object.entries(sinTexto).map(([t, n]) => `${n} ${etiquetaTipo(t, n)}`);
    if (partes.length) out(`=== SIN TEXTO (solo se ve que existen, no su contenido): ${partes.join(', ')}${flags.bajar || flags.transcribir ? '' : ' — con --bajar se guardan; los audios se transcriben con --transcribir'} ===`);
    if (bajada) imprimirBajada(bajada, 'ADJUNTOS');
    if (transc) {
      if (transc.aviso) out(`=== AUDIOS SIN TRANSCRIBIR: ${transc.aviso} ===`);
      out(`=== TRANSCRIPCIÓN (${transc.motor}${transc.modelo ? '/' + transc.modelo : ''}): ${transc.hechas.size} audio(s) transcrito(s)${transc.fallidas.length ? `, ${transc.fallidas.length} con fallo` : ''}${bajadaAudios && !bajadaAudios.candidatos ? ' — no hay audios en la ventana leída' : ''} ===`);
      for (const f of transc.fallidas) out(`  ✗ «${f.fichero}»: ${f.motivo}`);
      if (bajadaAudios) for (const x of bajadaAudios.fallidos) out(`  ✗ NO SE PUDO BAJAR «${x.fichero}» (${x.de}, ${x.fecha}) — ${x.motivo}`);
      if (!flags.bajar && bajadaAudios?.bajados.length) out(`=== los audios están en ${bajadaAudios.carpeta} (temporal: se borra solo en 24 h; con --bajar quedan en tu carpeta) ===`);
    }
    // ¿Es una persona nueva? Se PROPONE guardarla; solo la guarda el usuario diciendo que sí (node personas.mjs guardar …).
    const conocida = buscarPersona(R.id, PERSONAS).elegido || (R.numero && !R.esGrupo ? buscarPersona(`+${R.numero}`, PERSONAS).elegido : null);
    if (!conocida) {
      const tel = !R.esGrupo && R.numero && /^\d{7,15}$/.test(R.numero) ? ` --telefono +${R.numero}` : '';
      out(`=== PERSONA NUEVA: «${R.nombre || '?'}» no está en tus personas frecuentes. Pregunta al usuario si la guardas; si dice que sí: node personas.mjs guardar --nombre "${R.nombre || ''}"${tel} --id ${R.id}${R.esGrupo ? ' --grupo' : ''} ===`);
    }
    out(`${lineaSincro(est)}\n`);
  }
  await cerrar(codigo);
}

// Un cierre forzado de respaldo si algo cuelga más de la cuenta.
setTimeout(() => { err('### TIMEOUT GLOBAL'); cerrar(3); }, TIMEOUT_GLOBAL).unref();

client.initialize().catch((e) => {
  const m = e?.message || String(e);
  if (/Could not find (Chrome|browser)/i.test(m)) {
    err('### FALTA EL CHROME DE PUPPETEER (una limpieza de disco puede borrarlo).');
    err(`### Arreglo, sin tocar la sesión: cd "${__dirname}" && npx puppeteer browsers install chrome`);
    return cerrar(11);
  }
  err('### initialize:', m);
});
main().catch((e) => { err('### main:', e?.stack || e); cerrar(1); });
}
