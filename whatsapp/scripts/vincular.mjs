#!/usr/bin/env node
/**
 * vincular.mjs — enlaza TU WhatsApp con la skill. Se hace UNA sola vez.
 *
 * Lo que hace: arranca la versión web de WhatsApp en un Chrome sin ventana, te enseña un código QR y, cuando lo
 * escaneas con el móvil (WhatsApp → Ajustes → Dispositivos vinculados → Vincular un dispositivo), deja la sesión
 * guardada en tu carpeta de datos (~/.whatsapp-skill/sesion; en Windows %USERPROFILE%\.whatsapp-skill\sesion).
 * Nada sale de tu ordenador. Para desvincular: en el móvil, Dispositivos vinculados → cerrar la sesión, y borra esa carpeta.
 *
 * Seguridad: si YA hay una sesión guardada, se niega (escanear un QR de más puede desincronizar tu WhatsApp).
 * Solo con --forzar-revincular, y únicamente cuando el usuario ya sabe que su sesión se perdió.
 *
 *   node vincular.mjs                      # vincula (enseña el QR y espera hasta 4 minutos)
 *   node vincular.mjs --solo-qr            # comprueba que el QR sale y termina, sin vincular nada
 *   node vincular.mjs --forzar-revincular  # vincula aunque haya una sesión guardada (la aparta primero)
 *
 * Códigos de salida:
 *   0 vinculado (o --solo-qr correcto) · 1 error al arrancar · 2 WhatsApp rechazó la sesión · 3 no se escaneó a tiempo
 *   10 ya hay una sesión guardada (no se hace nada) · 11 falta el Chrome de puppeteer · 12 la sesión la usa otro proceso
 *
 * Nunca mates este proceso: corrompe la sesión. Se cierra solo.
 */
import pkg from 'whatsapp-web.js';
import QRCode from 'qrcode';
import qrTerminal from 'qrcode-terminal';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, renameSync, rmSync } from 'fs';
import { execFile } from 'child_process';
import { tmpdir } from 'os';
import { dirSesion, dirCacheWeb, asegurar } from './lib/rutas.mjs';
import { tomarBloqueo } from './lib/bloqueo.mjs';

const { Client, LocalAuth } = pkg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const CLIENT_ID = 'principal';                              // el lector usa el mismo
const QR_PNG = join(process.env.WHATSAPP_SKILL_TMP || tmpdir(), 'whatsapp-skill-qr.png');
const ESPERA_QR_MS = parseInt(process.env.VINCULAR_ESPERA_QR_MS || String(4 * 60 * 1000), 10);
const ESPERA_LISTO_MS = 2 * 60 * 1000;

const SOLO_QR = process.argv.includes('--solo-qr');
const FORZAR = process.argv.includes('--forzar-revincular');
const err = (...a) => console.error(...a);

const SESION = join(dirSesion(), `session-${CLIENT_ID}`);
if (existsSync(SESION)) {
  if (!FORZAR) {
    err('### YA HAY una sesión de WhatsApp guardada en este ordenador. No hago nada: escanear un QR de más puede desincronizar tu WhatsApp.');
    err('### Si funciona, no hace falta vincular otra vez. Si la lectura falla con «sesión no válida», cierra primero la sesión en el móvil (Dispositivos vinculados) y relanza con --forzar-revincular.');
    process.exit(10);
  }
  const apartada = `${SESION}.apartada-${Date.now()}`;
  renameSync(SESION, apartada);
  err(`### Sesión anterior apartada en ${apartada} (bórrala cuando confirmes que la nueva funciona).`);
}

const bloqueo = tomarBloqueo();
if (!bloqueo.ok) {
  err('### SESIÓN EN USO por otro proceso. No la toco. Espera a que termine (no lo mates) y repite.');
  process.exit(12);
}

// Guarda: que un rechazo de la librería no mate el proceso a medias.
process.on('unhandledRejection', (e) => err('[guarda] unhandledRejection tragado:', e?.message || e));
process.on('uncaughtException', (e) => err('[guarda] uncaughtException tragado:', e?.message || e));

const client = new Client({
  authStrategy: new LocalAuth({ clientId: CLIENT_ID, dataPath: dirSesion() }),
  webVersionCache: { type: 'local', path: dirCacheWeb() },
  puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] },
});

// Guarda: la librería NO borra la sesión a nuestras espaldas.
client.authStrategy.logout = async () => {
  err('[guarda] BLOQUEADO: la librería quiso BORRAR la sesión del disco. No la borro.');
};

let cerrando = false;
async function cerrar(code) {
  if (cerrando) return; cerrando = true;
  setTimeout(() => { bloqueo.soltar(); process.exit(code); }, 30000).unref();
  try { await client.destroy(); } catch (e) { err('[cierre] destroy:', e?.message); }
  // Si no llegó a autenticarse, la carpeta de sesión que se acaba de crear está vacía de valor y haría creer a la
  // skill que ya hay sesión: se retira (solo esta, que la creó este proceso; nunca una anterior).
  if (!autenticado && existsSync(SESION)) { try { rmSync(SESION, { recursive: true, force: true }); } catch { /* se quedará: no es grave */ } }
  bloqueo.soltar();
  process.exit(code);
}

/** Abre la imagen del QR con el visor del sistema: Mac `open`, Windows `explorer.exe`, Linux `xdg-open`. */
function abrirImagen(ruta) {
  const [cmd, args] = process.platform === 'darwin' ? ['open', [ruta]]
    : process.platform === 'win32' ? ['explorer.exe', [ruta]]     // explorer devuelve código 1 aunque funcione: se ignora
    : ['xdg-open', [ruta]];
  return new Promise((res) => execFile(cmd, args, { windowsHide: true }, (e) => res(process.platform === 'win32' ? true : !e)));
}

let nQr = 0, abierto = false, autenticado = false, listo = false;

const plazoQr = setTimeout(() => {
  if (autenticado) return;
  err('### No se escaneó ningún QR a tiempo. Vuelve a lanzarlo cuando tengas el móvil a mano.');
  cerrar(3);
}, ESPERA_QR_MS);

client.on('qr', async (qr) => {
  nQr += 1;
  try { asegurar(dirname(QR_PNG)); await QRCode.toFile(QR_PNG, qr, { width: 640, margin: 2, errorCorrectionLevel: 'M' }); }
  catch (e) { err(`No pude guardar la imagen del QR: ${e.message}`); }
  err(`QR #${nQr}: escanéalo con el móvil (WhatsApp → Ajustes → Dispositivos vinculados → Vincular un dispositivo).`);
  qrTerminal.generate(qr, { small: true }, (q) => console.error(q));
  if (!abierto) {
    abierto = true;
    err(`La imagen del QR está en: ${QR_PNG}`);
    if (!SOLO_QR) {
      const ok = await abrirImagen(QR_PNG);
      err(ok ? '(se ha abierto la imagen; el QR se renueva solo cada ~20 s, vuelve a mirarla si caduca)' : '(no pude abrir la imagen; ábrela tú desde esa ruta)');
    }
  }
  if (SOLO_QR) {
    err('--solo-qr: el QR sale correctamente. Termino sin vincular nada.');
    clearTimeout(plazoQr);
    cerrar(0);
  }
});

client.on('authenticated', () => {
  autenticado = true;
  clearTimeout(plazoQr);
  if (nQr === 0) err('Ya estabas vinculado: WhatsApp no ha pedido ningún QR. No hay nada que escanear.');
  else err('QR escaneado. Terminando la vinculación: no cierres nada, puede tardar un minuto…');
  // WhatsApp Web a veces no emite `ready` aunque la sesión ya esté guardada: no se cuelga para siempre.
  setTimeout(() => {
    if (listo) return;
    err('Vinculado: la sesión quedó guardada, aunque WhatsApp aún estaba sincronizando.');
    err('La primera lectura de un chat tardará algo más de lo normal. Comprueba en tu móvil → Ajustes → Dispositivos vinculados.');
    cerrar(0);
  }, ESPERA_LISTO_MS);
});
client.on('auth_failure', (m) => { err('### WhatsApp rechazó la sesión:', m); cerrar(2); });

client.once('ready', () => {
  listo = true;
  const me = client.info?.wid?.user ? `+${client.info.wid.user}` : '(número no disponible)';
  const nombre = client.info?.pushname ? ` (${client.info.pushname})` : '';
  err(`LISTO. Vinculado como ${me}${nombre}.`);
  err('Comprueba en tu móvil → Ajustes → Dispositivos vinculados: debe aparecer un dispositivo nuevo.');
  cerrar(0);
});

err('Arrancando WhatsApp (sin ventana)… tarda unos segundos hasta que salga el QR.');
client.initialize().catch((e) => {
  const m = e?.message || String(e);
  if (/Could not find (Chrome|browser)/i.test(m)) {
    err('### FALTA EL CHROME DE PUPPETEER.');
    err(`### Arreglo: cd "${__dirname}" && npx puppeteer browsers install chrome`);
    return cerrar(11);
  }
  err('### initialize:', m);
  cerrar(1);
});
