// servidor.mjs — el puente de la plataforma. Dos cosas en un solo proceso:
//  1. Puente local: sirve la carpeta en http://localhost:4700 y deja que la web cambie cosas
//     (encender o apagar una skill de verdad, guardar datos.js, apuntar en cambios.json lo que solo puede hacer Claude).
//  2. Puente web: si este ordenador está emparejado (llave en ~/.config/plataforma/llave), pregunta cada 30 s al puente
//     de 6 Grados (cada 3 s mientras la web está abierta) si la web publicada, por ejemplo desde el móvil, ha pedido algo,
//     y lo hace aquí. Solo órdenes cerradas: encender o apagar una skill, pausar o activar una rutina, quitar o devolver una app.
//     Nunca rutas ni el datos.js entero: la orden trae un nombre o un id y la ruta sale de datos.js de este ordenador.
//
//   node servidor.mjs                  arranca (o doble clic en «Abrir plataforma»)
//   node servidor.mjs emparejar        crea la llave de este ordenador si no la hay (luego: «Abrir en el móvil» en la web)
//   node servidor.mjs arranque         que arranque solo al encender el ordenador y siga siempre en marcha (Mac y Windows)
//   node servidor.mjs quitar-arranque  lo contrario
// Sin dependencias. Solo escucha en este ordenador.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PUERTO = Number(process.env.PLATAFORMA_PUERTO || 4700);
const DATOS = path.join(DIR, 'datos.js');
const CAMBIOS = path.join(DIR, 'cambios.json');
const PUENTE_WEB = (process.env.PLATAFORMA_PUENTE || 'https://plataforma-puente.vercel.app').replace(/\/$/, '');
// La llave y el registro van fuera de la carpeta (la carpeta se publica en Vercel).
const CONFIG = process.env.PLATAFORMA_CONFIG || path.join(os.homedir(), '.config', 'plataforma');
const LLAVE = path.join(CONFIG, 'llave');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.md': 'text/markdown; charset=utf-8', '.css': 'text/css; charset=utf-8' };

// ---------- datos.js ----------
// datos.js es JavaScript (con comentarios), no JSON: se evalúa aparte, sin acceso a nada.
function leerDatos() {
  const caja = { window: {} };
  vm.runInNewContext(fs.readFileSync(DATOS, 'utf8'), caja, { timeout: 1000 });
  const d = caja.window.PLATAFORMA;
  if (!d || typeof d !== 'object') throw new Error('datos.js no define window.PLATAFORMA');
  return JSON.parse(JSON.stringify(d));
}
function escribirDatos(d) {
  const cab = '// Los datos de tu plataforma. Los rellena Claude (reglas en INSTRUCCIONES.md) y los cambia la propia web.\n';
  const tmp = DATOS + '.tmp';
  fs.writeFileSync(tmp, cab + 'window.PLATAFORMA = ' + JSON.stringify(d, null, 1) + ';\n');
  fs.renameSync(tmp, DATOS);
  return version();
}
// La versión de datos.js: si cambió desde que la web lo leyó, la web no puede guardar encima (pisaría lo que ha hecho
// Claude o lo que se ha pedido desde el móvil). La web recarga los datos y vuelve a intentarlo.
function version() { try { const s = fs.statSync(DATOS); return s.mtimeMs.toFixed(0) + '-' + s.size; } catch { return '0'; } }
function leerCambios() { try { return JSON.parse(fs.readFileSync(CAMBIOS, 'utf8')); } catch { return []; } }
function apuntarCambio(cambio) {
  const lista = leerCambios();
  lista.push({ ...cambio, fecha: new Date().toISOString(), hecho: false });
  fs.writeFileSync(CAMBIOS, JSON.stringify(lista, null, 1));
  return lista.filter(c => !c.hecho);
}

// Solo se mueven carpetas de skills: …/.claude/skills/<nombre> ⇄ …/.claude/skills-desactivadas/<nombre>, dentro de tu carpeta personal.
function moverSkill(ruta, activar) {
  const r = path.resolve(String(ruta || '').replace(/^~(?=[/\\]|$)/, os.homedir()));
  const m = r.replace(/\\/g, '/').match(/^(.*\/\.claude)\/skills(?:-desactivadas)?\/([^/]+)$/);
  if (!m || !r.startsWith(os.homedir() + path.sep)) throw new Error('Ruta de skill no válida');
  const [, base, nombre] = m;
  const activa = path.join(base, 'skills', nombre), apagada = path.join(base, 'skills-desactivadas', nombre);
  const desde = activar ? apagada : activa, hasta = activar ? activa : apagada;
  if (fs.existsSync(hasta)) return hasta;                       // ya está donde toca
  if (!fs.existsSync(desde)) throw new Error('No encuentro la skill en ' + desde);
  fs.mkdirSync(path.dirname(hasta), { recursive: true });
  fs.renameSync(desde, hasta);
  return hasta;
}
const corta = r => r.replace(os.homedir(), '~');

// ---------- las acciones (las mismas para la web local y para las órdenes que llegan del puente web) ----------
function hacerSkill(nombre, activada) {
  const d = leerDatos(); const s = (d.skills || []).find(x => x.nombre === nombre);
  if (!s) { const e = new Error('no existe esa skill'); e.status = 404; throw e; }
  if (s.ruta) s.ruta = corta(moverSkill(s.ruta, !!activada));
  s.activada = !!activada;
  return { ruta: s.ruta || null, movida: !!s.ruta, version: escribirDatos(d) };
}
// Pausar o activar una rutina: `activa` en datos.js manda al momento (cada rutina «en tu ordenador» empieza con el PASO 0,
// que lo lee); además queda apuntado para que Claude pause o active también la tarea programada.
function hacerRutina(id, activa) {
  const d = leerDatos(); const r = (d.rutinas || []).find(x => x.id === id);
  if (!r) { const e = new Error('no existe esa rutina'); e.status = 404; throw e; }
  if (r.activa === !!activa) return { version: version() };
  r.activa = !!activa; r.pendiente = r.pendiente || 'cambiar';
  const v = escribirDatos(d);
  apuntarCambio({ que: activa ? 'activar-tarea' : 'pausar-tarea', rutina: r.id, nombre: r.nombre, tarea_id: r.tarea_id || null });
  return { version: v };
}
function hacerQuitarApp(nombre, url) {
  const d = leerDatos(); d.apps = d.apps || []; d.quitadas = d.quitadas || [];
  const i = d.apps.findIndex(a => a.nombre === nombre && (!url || a.url === url));
  if (i < 0) return { version: version() };                       // ya no está
  const [a] = d.apps.splice(i, 1);
  d.quitadas.push({ nombre: a.nombre, url: a.url || null, tipo: a.tipo || null, fecha: new Date().toISOString().slice(0, 10), app: a });
  return { version: escribirDatos(d) };
}
function hacerRestaurarApp(nombre, url) {
  const d = leerDatos(); d.apps = d.apps || []; d.quitadas = d.quitadas || [];
  const k = d.quitadas.findIndex(q => q.nombre === nombre && (!url || q.url === url));
  if (k < 0) return { version: version() };
  const [q] = d.quitadas.splice(k, 1);
  if (!d.apps.some(a => a.nombre === q.nombre)) d.apps.push(q.app || { nombre: q.nombre, url: q.url || undefined, tipo: q.tipo || undefined });
  return { version: escribirDatos(d) };
}

// ---------- puente local (http://localhost:4700) ----------
function cuerpo(req) {
  return new Promise((ok, mal) => {
    let b = ''; req.on('data', c => { b += c; if (b.length > 5e6) req.destroy(); });
    req.on('end', () => { try { ok(b ? JSON.parse(b) : {}); } catch (e) { mal(e); } });
  });
}
function json(res, code, obj) { res.writeHead(code, { 'Content-Type': TIPOS['.json'], 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); }
function estadoRemoto() {
  const r = { emparejado: !!leerLlave(), conectado: remoto.ok && Date.now() - remoto.ok < 120000, error: remoto.error || null };
  try { r.web = leerDatos().web || null; } catch {}
  return r;
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  // Solo esta misma web: el Host tiene que ser localhost (frena el «DNS rebinding») y, si no es GET, el origen también.
  if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host || '')) return json(res, 403, { error: 'host' });
  if (req.method !== 'GET') {
    const origen = req.headers.origin || '';
    if (origen && !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origen)) return json(res, 403, { error: 'origen' });
  }
  try {
    if (url.pathname === '/api/estado') {
      const lista = leerCambios().filter(c => !c.hecho);
      return json(res, 200, { puente: true, cambios: lista.length, lista, carpeta: corta(DIR), version: version(), remoto: estadoRemoto() });
    }
    if (url.pathname === '/api/datos') return json(res, 200, { datos: leerDatos(), version: version() });
    if (req.method === 'POST' && url.pathname === '/api/guardar') {
      const { datos, version: suya } = await cuerpo(req);
      if (!datos || typeof datos !== 'object') return json(res, 400, { error: 'faltan datos' });
      if (suya && suya !== version()) return json(res, 409, { error: 'datos.js ha cambiado: recarga', version: version() });
      return json(res, 200, { ok: true, version: escribirDatos(datos) });
    }
    if (req.method === 'POST' && url.pathname === '/api/skill') {
      const { nombre, activada } = await cuerpo(req);
      return json(res, 200, { ok: true, ...hacerSkill(nombre, activada) });
    }
    if (req.method === 'POST' && url.pathname === '/api/cambio') {
      const { cambio } = await cuerpo(req);
      if (!cambio || !cambio.que) return json(res, 400, { error: 'falta el cambio' });
      const pend = apuntarCambio(cambio);
      return json(res, 200, { ok: true, pendientes: pend.length, lista: pend });
    }
    // El enlace para abrir la plataforma publicada en el móvil, ya emparejada (la llave va en el «#», que no sale del navegador).
    if (req.method === 'POST' && url.pathname === '/api/emparejar') {
      const llave = await asegurarLlave();
      arrancarRemoto();
      const web = String(leerDatos().web || '').replace(/[#?].*$/, '').replace(/\/$/, '');
      if (!/^https:\/\//.test(web)) return json(res, 400, { error: 'Falta la dirección de tu plataforma publicada (`web` en datos.js).' });
      return json(res, 200, { enlace: web + '/#llave=' + llave });
    }
    // Abrir una app de escritorio o una carpeta de la lista (solo las que están en datos.js, solo carpetas o apps, solo en tu ordenador).
    if (req.method === 'POST' && url.pathname === '/api/abrir') {
      const { nombre } = await cuerpo(req);
      const a = (leerDatos().apps || []).find(x => x.nombre === nombre);
      if (!a || !a.abrir) return json(res, 404, { error: 'esa app no tiene dónde abrirse' });
      const r = path.resolve(String(a.abrir).replace(/^~(?=\/|$)/, os.homedir()));
      const permitida = r.startsWith(os.homedir() + path.sep) || r.startsWith('/Applications/') || /^[A-Z]:\\Program Files/i.test(r);
      if (!permitida || !fs.existsSync(r)) return json(res, 404, { error: 'No encuentro ' + a.abrir });
      const esCarpeta = fs.statSync(r).isDirectory();                      // en Mac, una .app también es carpeta
      if (!esCarpeta && !(process.platform === 'win32' && /\.(exe|lnk)$/i.test(r))) return json(res, 403, { error: 'solo se abren apps y carpetas' });
      const [cmd, args] = process.platform === 'darwin' ? ['open', [r]] : process.platform === 'win32' ? ['explorer', [r]] : ['xdg-open', [r]];
      spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref();
      return json(res, 200, { ok: true });
    }
    if (req.method !== 'GET') return json(res, 404, { error: 'no existe' });
    // Ficheros de la carpeta
    let f = path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    if (f === '/' || f === path.sep) f = '/index.html';
    const ruta = path.join(DIR, f);
    if (!ruta.startsWith(DIR) || !fs.existsSync(ruta) || fs.statSync(ruta).isDirectory()) { res.writeHead(404); return res.end('No existe'); }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(ruta)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(ruta).pipe(res);
  } catch (e) { json(res, e.status || 500, { error: e.message }); }
});

// ---------- puente web: este ordenador pregunta al puente de 6 Grados ----------
function leerLlave() { try { const l = fs.readFileSync(LLAVE, 'utf8').trim(); return /^plat\.[a-z0-9]{12}\.[A-Za-z0-9_-]{32}$/.test(l) ? l : null; } catch { return null; } }
async function asegurarLlave() {
  const ya = leerLlave(); if (ya) return ya;
  const r = await fetch(PUENTE_WEB + '/api/alta', { method: 'POST' });
  const j = await r.json();
  if (!r.ok || !j.llave) throw new Error('El puente de 6 Grados no da la llave: ' + (j.error || r.status));
  fs.mkdirSync(CONFIG, { recursive: true, mode: 0o700 });
  fs.writeFileSync(LLAVE, j.llave + '\n', { mode: 0o600 });
  return j.llave;
}
// Lo vivo que ve la web publicada: solo nombres y verdadero/falso (y la lista de cambios por aplicar, para «Copiar a Claude»).
function estadoVivo() {
  const d = leerDatos();
  const cambios = leerCambios().filter(c => !c.hecho).slice(-30);
  return {
    skills: Object.fromEntries((d.skills || []).map(s => [s.nombre, !!s.activada])),
    rutinas: Object.fromEntries((d.rutinas || []).filter(r => r.id).map(r => [r.id, { activa: r.activa !== false, pendiente: r.pendiente || null }])),
    quitadas: (d.quitadas || []).map(q => ({ nombre: q.nombre, url: q.url || null })),
    cambios, carpeta: corta(DIR), version: version()
  };
}
const remoto = { ok: 0, error: null, enMarcha: false, resultados: [], hash: '', enviadoEn: 0, temporizador: null };
function ejecutarOrden(o) {
  const d = o.datos || {};
  if (o.tipo === 'skill') return hacerSkill(String(d.nombre), d.activada === true);
  if (o.tipo === 'rutina') return hacerRutina(String(d.id), d.activa === true);
  if (o.tipo === 'quitar-app') return hacerQuitarApp(String(d.nombre), d.url ? String(d.url) : null);
  if (o.tipo === 'restaurar-app') return hacerRestaurarApp(String(d.nombre), d.url ? String(d.url) : null);
  throw new Error('orden desconocida');
}
async function vuelta() {
  const llave = leerLlave();
  if (!llave) { remoto.enMarcha = false; return; }
  let espera = 30000;
  try {
    let estado = null;
    try {
      const e = estadoVivo(), h = crypto.createHash('sha1').update(JSON.stringify(e)).digest('hex');
      if (h !== remoto.hash || Date.now() - remoto.enviadoEn > 600000) { estado = e; remoto.hashNuevo = h; }
    } catch (e) { remoto.error = 'datos.js: ' + e.message; }
    const resultados = remoto.resultados; remoto.resultados = [];
    const r = await fetch(PUENTE_WEB + '/api/agente', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Plataforma-Llave': llave },
      body: JSON.stringify({ estado, resultados, version: 'plataforma-1' }), signal: AbortSignal.timeout(15000)
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { remoto.resultados = resultados.concat(remoto.resultados); throw new Error(j.error || 'puente ' + r.status); }
    if (estado) { remoto.hash = remoto.hashNuevo; remoto.enviadoEn = Date.now(); }
    remoto.ok = Date.now(); remoto.error = null;
    for (const o of j.ordenes || []) {
      try { ejecutarOrden(o); remoto.resultados.push({ id: o.id, ok: true }); log('hecho: ' + o.tipo + ' ' + JSON.stringify(o.datos)); }
      catch (e) { remoto.resultados.push({ id: o.id, ok: false, nota: e.message }); log('falló: ' + o.tipo + ' · ' + e.message); }
    }
    espera = (j.ordenes || []).length ? 300 : j.rapido ? 3000 : 30000;   // tras una orden, contesta enseguida
  } catch (e) {
    remoto.error = e.message; espera = 30000;
  }
  remoto.temporizador = setTimeout(vuelta, espera);
}
function arrancarRemoto() {
  if (remoto.enMarcha || !leerLlave()) return;
  remoto.enMarcha = true; vuelta();
}
function log(t) { console.log(new Date().toISOString().slice(0, 19).replace('T', ' ') + ' · ' + t); }

// ---------- arrancar solo al encender (Mac: LaunchAgent; Windows: tarea programada al iniciar sesión) ----------
const ETIQUETA = 'es.6grados.plataforma';
const PLIST = path.join(os.homedir(), 'Library', 'LaunchAgents', ETIQUETA + '.plist');
function arranque() {
  const node = process.execPath, script = fileURLToPath(import.meta.url);
  if (process.platform === 'darwin') {
    fs.mkdirSync(path.dirname(PLIST), { recursive: true });
    fs.mkdirSync(CONFIG, { recursive: true, mode: 0o700 });
    const x = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const env = Object.entries({ PLATAFORMA_PUERTO: String(PUERTO), ...(process.env.PLATAFORMA_CONFIG ? { PLATAFORMA_CONFIG: CONFIG } : {}), ...(process.env.PLATAFORMA_PUENTE ? { PLATAFORMA_PUENTE: PUENTE_WEB } : {}) })
      .map(([k, v]) => `<key>${k}</key><string>${x(v)}</string>`).join('');
    fs.writeFileSync(PLIST, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${ETIQUETA}</string>
<key>ProgramArguments</key><array><string>${x(node)}</string><string>${x(script)}</string></array>
<key>WorkingDirectory</key><string>${x(DIR)}</string>
<key>EnvironmentVariables</key><dict>${env}</dict>
<key>RunAtLoad</key><true/>
<key>KeepAlive</key><true/>
<key>ThrottleInterval</key><integer>20</integer>
<key>StandardOutPath</key><string>${x(path.join(CONFIG, 'registro.log'))}</string>
<key>StandardErrorPath</key><string>${x(path.join(CONFIG, 'registro.log'))}</string>
</dict></plist>
`);
    const uid = process.getuid();
    try { execFileSync('launchctl', ['bootout', `gui/${uid}/${ETIQUETA}`], { stdio: 'ignore' }); } catch {}
    execFileSync('launchctl', ['bootstrap', `gui/${uid}`, PLIST]);
    console.log('  ✔ Arranca sola al encender el Mac y sigue siempre en marcha (' + ETIQUETA + '). Registro: ' + corta(path.join(CONFIG, 'registro.log')));
  } else if (process.platform === 'win32') {
    // Sin ventana: PowerShell oculto lanza node. Sin probar todavía en un Windows de verdad.
    const orden = `powershell -NoProfile -WindowStyle Hidden -Command "Start-Process -WindowStyle Hidden -FilePath '${node}' -ArgumentList '\\"${script}\\"' -WorkingDirectory '${DIR}'"`;
    execFileSync('schtasks', ['/Create', '/F', '/SC', 'ONLOGON', '/RL', 'LIMITED', '/TN', 'Plataforma 6 Grados', '/TR', orden]);
    try { execFileSync('schtasks', ['/Run', '/TN', 'Plataforma 6 Grados']); } catch {}
    console.log('  ✔ Arranca sola al entrar en Windows (tarea «Plataforma 6 Grados»).');
  } else console.log('  En Linux, añade «node ' + script + '» a tu inicio de sesión.');
}
function quitarArranque() {
  if (process.platform === 'darwin') {
    try { execFileSync('launchctl', ['bootout', `gui/${process.getuid()}/${ETIQUETA}`], { stdio: 'ignore' }); } catch {}
    try { fs.unlinkSync(PLIST); } catch {}
  } else if (process.platform === 'win32') { try { execFileSync('schtasks', ['/Delete', '/F', '/TN', 'Plataforma 6 Grados']); } catch {} }
  console.log('  ✔ Ya no arranca sola.');
}

// ---------- arranque ----------
const orden = process.argv[2];
if (orden === 'emparejar') {
  asegurarLlave().then(() => { console.log('  ✔ Este ordenador ya tiene su llave (' + corta(LLAVE) + '). Abre http://localhost:' + PUERTO + ' y pulsa «Abrir en el móvil».'); })
    .catch(e => { console.error('  ✘ ' + e.message); process.exit(1); });
} else if (orden === 'arranque') { arranque(); }
else if (orden === 'quitar-arranque') { quitarArranque(); }
else {
  servidor.listen(PUERTO, '127.0.0.1', () => {
    console.log(`Tu plataforma: http://localhost:${PUERTO}  (cierra esta ventana para apagarla)`);
    if (leerLlave()) console.log('Conectada al puente web: lo que pidas desde la web publicada (o el móvil) se hace en este ordenador.');
    arrancarRemoto();
  });
  servidor.on('error', e => {
    if (e.code === 'EADDRINUSE') { console.log(`Ya estaba abierta en http://localhost:${PUERTO}`); process.exit(0); }
    throw e;
  });
}
