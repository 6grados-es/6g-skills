#!/usr/bin/env node
/**
 * instalar.mjs — instala la skill «whatsapp» en tu ordenador (Windows, Mac o Linux). Sin bash, sin rsync.
 *
 *   node instalar.mjs                        copia la skill a ~/.claude/skills/whatsapp e instala lo que necesita
 *   node instalar.mjs --clave-groq gsk_...   además guarda tu clave de Groq (para transcribir audios)
 *   node instalar.mjs --comprobar            no instala nada: dice cómo está todo
 *   SKILLS_DST=<carpeta> node instalar.mjs   instala en otra carpeta (para probar)
 *   SKIP_NPM=1 node instalar.mjs             solo copia, sin instalar dependencias
 *
 * Es seguro repetirlo: actualiza el código y NO toca tu sesión de WhatsApp ni tus personas frecuentes
 * (viven en tu carpeta de datos, ~/.whatsapp-skill, fuera de la skill). NO enlaza tu WhatsApp: eso es un paso
 * aparte (`node vincular.mjs`) que se hace después de leer el aviso de riesgo del README.
 */
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'fs';
import { join, dirname, resolve, sep } from 'path';
import { homedir } from 'os';
import { fileURLToPath, pathToFileURL } from 'url';
import { spawnSync } from 'child_process';

const ORIGEN = dirname(fileURLToPath(import.meta.url));
const SKILLS = process.env.SKILLS_DST || join(homedir(), '.claude', 'skills');
const DESTINO = join(SKILLS, 'whatsapp');
const DATOS = process.env.WHATSAPP_SKILL_HOME || join(homedir(), '.whatsapp-skill');
const WIN = process.platform === 'win32';
const args = process.argv.slice(2);
const SOLO_COMPROBAR = args.includes('--comprobar');
const iClave = args.indexOf('--clave-groq');
const CLAVE = iClave >= 0 ? args[iClave + 1] : null;
const linea = (m = '') => console.log(m);
const ok = (m) => linea(`  ✔ ${m}`);
const mal = (m) => linea(`  ✘ ${m}`);
const aviso = (m) => linea(`  ! ${m}`);
let hayError = false;

linea('==> skill «whatsapp»');
const major = parseInt(process.versions.node.split('.')[0], 10);
if (major < 18) { mal(`Hace falta Node 18 o superior (tienes ${process.version}). Instala la versión LTS desde https://nodejs.org y repite.`); process.exit(1); }
ok(`Node ${process.version}`);

const npm = (a, cwd, extraEnv = {}) => spawnSync(WIN ? 'npm.cmd' : 'npm', a, { cwd, stdio: 'inherit', shell: WIN, env: { ...process.env, ...extraEnv } });
const mismaCarpeta = resolve(ORIGEN) === resolve(DESTINO);

if (!SOLO_COMPROBAR) {
  if (!existsSync(join(ORIGEN, 'SKILL.md'))) { mal(`No encuentro SKILL.md en ${ORIGEN}. ¿Descomprimiste el repositorio entero?`); process.exit(1); }
  if (existsSync(DESTINO) && lstatSync(DESTINO).isSymbolicLink()) { mal(`${DESTINO} es un enlace simbólico: no lo piso. Bórralo o usa SKILLS_DST=...`); process.exit(1); }
  if (!mismaCarpeta) {
    mkdirSync(SKILLS, { recursive: true });
    cpSync(ORIGEN, DESTINO, {
      recursive: true,
      filter: (src) => { const r = src.slice(ORIGEN.length); return !/(^|[\\/])(node_modules|\.git|\.wwebjs_[a-z]+|\.env[^\\/]*|personas-frecuentes\.json)([\\/]|$)/.test(r); },
    });
    ok(`skill copiada en ${DESTINO}`);
  } else ok('ya estás ejecutando la copia instalada: no hay nada que copiar');
  mkdirSync(DATOS, { recursive: true });
  ok(`carpeta de datos (sesión, personas, claves): ${DATOS}`);
}

const SCRIPTS = join(DESTINO, 'scripts');
if (!SOLO_COMPROBAR && process.env.SKIP_NPM !== '1') {
  linea('\n==> Instalando dependencias (puede tardar unos minutos: incluye un Chrome para WhatsApp Web)');
  const r = npm(['install', '--no-audit', '--no-fund', '--loglevel=error'], SCRIPTS);
  if (r.status !== 0) { mal('npm install falló. Mira el mensaje de arriba; lo más habitual es no tener internet o un antivirus que bloquea la descarga.'); process.exit(1); }
}

linea('\n==> Comprobaciones');
if (!existsSync(join(SCRIPTS, 'node_modules'))) { aviso('Aún no están instaladas las dependencias (falta node_modules). Repite sin SKIP_NPM.'); hayError = true; }
else {
  const prueba = spawnSync(process.execPath, ['--input-type=module', '-e',
    "import('whatsapp-web.js').then(()=>console.log('ok')).catch(e=>{console.error(e.message);process.exit(1)})"], { cwd: SCRIPTS, encoding: 'utf8' });
  if (prueba.status === 0) ok('la librería de WhatsApp carga'); else { mal(`la librería de WhatsApp no carga: ${prueba.stderr.trim()}`); hayError = true; }

  const chrome = () => spawnSync(process.execPath, ['--input-type=module', '-e',
    "import p from 'puppeteer'; import { existsSync } from 'fs'; process.exit(existsSync(p.executablePath()) ? 0 : 1)"], { cwd: SCRIPTS });
  if (chrome().status === 0) ok('Chrome de WhatsApp Web presente');
  else if (SOLO_COMPROBAR) { mal('falta el Chrome de WhatsApp Web: lanza `npx puppeteer browsers install chrome` en la carpeta scripts'); hayError = true; }
  else {
    linea('  Falta el Chrome de WhatsApp Web: lo descargo (unos 150 MB)…');
    spawnSync(WIN ? 'npx.cmd' : 'npx', ['puppeteer', 'browsers', 'install', 'chrome'], { cwd: SCRIPTS, stdio: 'inherit', shell: WIN });
    if (chrome().status === 0) ok('Chrome de WhatsApp Web instalado'); else { mal('no pude instalar el Chrome'); hayError = true; }
  }
}

// ffmpeg y clave de transcripción (opcionales: sin ellos se lee y se descarga igual)
try {
  const t = await import(pathToFileURL(join(SCRIPTS, 'lib', 'transcribir.mjs')).href);
  if (CLAVE && !SOLO_COMPROBAR) {
    const f = join(DATOS, 'claves.env');
    let previo = ''; try { previo = readFileSync(f, 'utf8'); } catch { /* nuevo */ }
    const resto = previo.split(/\r?\n/).filter((l) => l.trim() && !/^\s*GROQ_API_KEY\s*=/.test(l));
    writeFileSync(f, [...resto, `GROQ_API_KEY=${CLAVE}`].join('\n') + '\n', 'utf8');
    try { chmodSync(f, 0o600); } catch { /* Windows */ }
    ok(`clave de Groq guardada en ${f} (solo en tu ordenador)`);
  }
  const cfg = t.configuracion();
  const est = t.estadoConfiguracion(cfg);
  if (est.ok) ok(`transcripción de audios lista (${cfg.motor})`);
  else aviso(`transcripción: ${est.motivo}. Se consigue gratis una clave en https://console.groq.com/keys (mira el README); es opcional.`);
  const ff = await t.rutaFfmpeg();
  if (ff) ok('ffmpeg disponible (para audios largos)'); else aviso('no hay ffmpeg: los audios normales se transcriben igual; los muy largos no. En Windows: winget install ffmpeg');
} catch (e) { aviso(`no pude comprobar la transcripción: ${e.message}`); }

linea();
if (hayError) { linea('Quedan cosas por arreglar (arriba). Cuando las resuelvas, repite este comando.'); process.exit(1); }
linea(SOLO_COMPROBAR ? 'Todo en orden.' : 'Instalada. Siguiente paso: reinicia Claude Code y, si quieres leer tus chats, enlaza tu WhatsApp (README, apartado «Enlazar tu WhatsApp»).');
linea('El modo «borrador» (dejar un mensaje escrito para que tú lo envíes) funciona ya, sin enlazar nada.');
