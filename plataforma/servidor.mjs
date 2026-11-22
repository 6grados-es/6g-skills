// servidor.mjs — el puente local de la plataforma. Sirve la carpeta en http://localhost:4700 y deja que la web cambie cosas:
//   · activar o desactivar una skill de verdad (mueve su carpeta entre .claude/skills y .claude/skills-desactivadas)
//   · guardar datos.js (interruptores, horarios, quitar una app)
//   · apuntar en cambios.json lo que solo puede hacer Claude (cambiar la hora de una tarea programada de la app, borrar un artefacto)
// Sin dependencias: node servidor.mjs   (o doble clic en «Abrir plataforma.command»). Solo escucha en este ordenador.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PUERTO = Number(process.env.PLATAFORMA_PUERTO || 4700);
const DATOS = path.join(DIR, 'datos.js');
const CAMBIOS = path.join(DIR, 'cambios.json');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.md': 'text/markdown; charset=utf-8', '.css': 'text/css; charset=utf-8' };

function leerDatos() {
  const txt = fs.readFileSync(DATOS, 'utf8');
  const i = txt.indexOf('{'), j = txt.lastIndexOf('}');
  return JSON.parse(txt.slice(i, j + 1));
}
function escribirDatos(d) {
  const cab = '// Los datos de tu plataforma. Los rellena Claude (reglas en INSTRUCCIONES.md) y los cambia la propia web.\n';
  const tmp = DATOS + '.tmp';
  fs.writeFileSync(tmp, cab + 'window.PLATAFORMA = ' + JSON.stringify(d, null, 1) + ';\n');
  fs.renameSync(tmp, DATOS);
}
function leerCambios() { try { return JSON.parse(fs.readFileSync(CAMBIOS, 'utf8')); } catch { return []; } }

// Solo se mueven carpetas de skills: …/.claude/skills/<nombre> ⇄ …/.claude/skills-desactivadas/<nombre>, dentro de tu carpeta personal.
function moverSkill(ruta, activar) {
  const r = path.resolve(String(ruta || '').replace(/^~(?=\/|$)/, os.homedir()));
  const m = r.match(/^(.*\/\.claude)\/skills(?:-desactivadas)?\/([^/]+)$/);
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

function cuerpo(req) {
  return new Promise((ok, mal) => {
    let b = ''; req.on('data', c => { b += c; if (b.length > 5e6) req.destroy(); });
    req.on('end', () => { try { ok(b ? JSON.parse(b) : {}); } catch (e) { mal(e); } });
  });
}
function json(res, code, obj) { res.writeHead(code, { 'Content-Type': TIPOS['.json'], 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); }

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  // Solo peticiones de esta misma web (nada de otras páginas del navegador).
  if (req.method !== 'GET') {
    const origen = req.headers.origin || '';
    if (origen && !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origen)) return json(res, 403, { error: 'origen' });
  }
  try {
    if (url.pathname === '/api/estado') {
      const lista = leerCambios().filter(c => !c.hecho);
      return json(res, 200, { puente: true, cambios: lista.length, lista, carpeta: DIR.replace(os.homedir(), '~') });
    }
    if (req.method === 'POST' && url.pathname === '/api/guardar') {
      const { datos } = await cuerpo(req);
      if (!datos || typeof datos !== 'object') return json(res, 400, { error: 'faltan datos' });
      escribirDatos(datos); return json(res, 200, { ok: true });
    }
    if (req.method === 'POST' && url.pathname === '/api/skill') {
      const { nombre, activada } = await cuerpo(req);
      const d = leerDatos(); const s = (d.skills || []).find(x => x.nombre === nombre);
      if (!s) return json(res, 404, { error: 'no existe esa skill' });
      if (s.ruta) s.ruta = moverSkill(s.ruta, !!activada).replace(os.homedir(), '~');
      s.activada = !!activada; escribirDatos(d);
      return json(res, 200, { ok: true, movida: !!s.ruta, ruta: s.ruta || null });
    }
    if (req.method === 'POST' && url.pathname === '/api/cambio') {
      const { cambio } = await cuerpo(req);
      if (!cambio || !cambio.que) return json(res, 400, { error: 'falta el cambio' });
      const lista = leerCambios();
      lista.push({ ...cambio, fecha: new Date().toISOString(), hecho: false });
      fs.writeFileSync(CAMBIOS, JSON.stringify(lista, null, 1));
      const pend = lista.filter(c => !c.hecho);
      return json(res, 200, { ok: true, pendientes: pend.length, lista: pend });
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
  } catch (e) { json(res, 500, { error: e.message }); }
});

servidor.listen(PUERTO, '127.0.0.1', () => console.log(`Tu plataforma: http://localhost:${PUERTO}  (cierra esta ventana para apagarla)`));
servidor.on('error', e => {
  if (e.code === 'EADDRINUSE') { console.log(`Ya estaba abierta en http://localhost:${PUERTO}`); process.exit(0); }
  throw e;
});
