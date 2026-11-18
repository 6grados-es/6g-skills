// transcribir.mjs — audio → texto con Whisper. Node puro (sin Python): fetch y FormData nativos.
// Adaptado de la herramienta de transcripción de 6 Grados (ffmpeg + Whisper en Groq): mismo troceo por tramos,
// mismo desfase de tiempos, misma rotación de claves ante un 429 y misma reparación de segmentos sin tildes.
//
// MOTOR (variable TRANSCRIBIR_MOTOR):
//   local       (por defecto) Whisper small, modelo abierto, EN TU ORDENADOR: sin clave y el audio no sale de ahí.
//               Usa @huggingface/transformers (lo trae npm install) y ffmpeg. La primera vez baja el modelo (~250 MB)
//               a la carpeta de datos (~/.whatsapp-skill/modelos). Otro modelo: TRANSCRIBIR_MODELO.
//   groq        Whisper en Groq con TU clave: GROQ_API_KEY (varias separadas por comas = rotan). El audio sale fuera.
//   openai      Whisper de OpenAI: OPENAI_API_KEY.
//   compatible  cualquier servidor con la API de OpenAI (p. ej. uno local): TRANSCRIBIR_URL, TRANSCRIBIR_MODELO
//               y, si hace falta, TRANSCRIBIR_API_KEY. Es la vía para que el audio NO salga de tu ordenador.
//   ninguno     no transcribe: los audios solo se descargan.
// La clave se lee del entorno o de claves.env en la carpeta de datos (líneas CLAVE=valor). Nunca viaja en el repo.
import { readFileSync, existsSync, statSync, readdirSync, mkdirSync, mkdtempSync, rmSync } from 'fs';
import { spawnSync } from 'child_process';
import { extname, join, basename } from 'path';
import { tmpdir } from 'os';
import { createRequire } from 'module';
import { ficheroClaves, dirDatos } from './rutas.mjs';

export class ErrorTranscripcion extends Error {
  constructor(codigo, mensaje) { super(mensaje); this.codigo = codigo; }
}

export const MODELO_LOCAL = 'onnx-community/whisper-small';
const IDIOMAS = { es: 'spanish', en: 'english', ca: 'catalan', fr: 'french', pt: 'portuguese', it: 'italian', de: 'german', gl: 'galician', eu: 'basque' };

/** ¿Está instalada la librería del motor local? (dependencia opcional: si no se pudo instalar, se dice claro) */
export function hayTransformers() {
  try { createRequire(import.meta.url).resolve('@huggingface/transformers'); return true; } catch { return false; }
}

const URLS = { groq: 'https://api.groq.com/openai/v1/audio/transcriptions', openai: 'https://api.openai.com/v1/audio/transcriptions' };
const MODELOS = { groq: 'whisper-large-v3', openai: 'whisper-1' };
export const LIMITE_SUBIDA = 24_000_000;   // tope de subida de Groq (25 MB) con margen
export const TROZO_SEG = 900;              // 15 min por trozo cuando el audio no cabe entero
const EXT_DIRECTAS = { '.flac': 'audio/flac', '.mp3': 'audio/mpeg', '.mp4': 'audio/mp4', '.mpeg': 'audio/mpeg', '.mpga': 'audio/mpeg',
  '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.opus': 'audio/ogg', '.wav': 'audio/wav', '.webm': 'audio/webm' };

/** Lee un fichero CLAVE=valor (comentarios con #). Un fichero ausente o ilegible no es un error. */
export function leerEnvFichero(ruta = ficheroClaves()) {
  const out = {};
  try {
    for (const l of readFileSync(ruta, 'utf8').split(/\r?\n/)) {
      const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !l.trim().startsWith('#')) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* sin fichero */ }
  return out;
}

/** Resuelve motor, URL, modelo y claves. Entorno primero, claves.env después. No lee ninguna clave que no sea del usuario. */
export function configuracion(env = process.env, envFichero = leerEnvFichero()) {
  const get = (k) => env[k] || envFichero[k] || '';
  const motor = (get('TRANSCRIBIR_MOTOR') || 'local').toLowerCase();
  const lista = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
  const base = { motor, idioma: get('TRANSCRIBIR_IDIOMA') || 'es', limite: parseInt(get('TRANSCRIBIR_LIMITE_BYTES') || LIMITE_SUBIDA, 10),
    trozoSeg: parseInt(get('TRANSCRIBIR_TROZO_SEG') || TROZO_SEG, 10) };
  if (motor === 'ninguno') return { ...base, claves: [], url: null, modelo: null };
  if (motor === 'local') return { ...base, claves: [], url: null, modelo: get('TRANSCRIBIR_MODELO') || MODELO_LOCAL, claveNecesaria: false, local: true };
  if (motor === 'groq' || motor === 'openai') {
    const claves = lista(get(motor === 'groq' ? 'GROQ_API_KEY' : 'OPENAI_API_KEY'));
    return { ...base, claves, url: get('TRANSCRIBIR_URL') || URLS[motor], modelo: get('TRANSCRIBIR_MODELO') || MODELOS[motor], claveNecesaria: true,
      variableClave: motor === 'groq' ? 'GROQ_API_KEY' : 'OPENAI_API_KEY' };
  }
  if (motor === 'compatible') {
    if (!get('TRANSCRIBIR_URL') || !get('TRANSCRIBIR_MODELO')) throw new ErrorTranscripcion('config', 'TRANSCRIBIR_MOTOR=compatible exige TRANSCRIBIR_URL y TRANSCRIBIR_MODELO.');
    return { ...base, claves: lista(get('TRANSCRIBIR_API_KEY')), url: get('TRANSCRIBIR_URL'), modelo: get('TRANSCRIBIR_MODELO'), claveNecesaria: false };
  }
  throw new ErrorTranscripcion('config', `TRANSCRIBIR_MOTOR «${motor}» desconocido (válidos: local, groq, openai, compatible, ninguno).`);
}

/** ¿Se puede transcribir con esta configuración? Si no, dice por qué, en llano. */
export function estadoConfiguracion(cfg, { hayLibreria = hayTransformers } = {}) {
  if (cfg.motor === 'ninguno') return { ok: false, motivo: 'la transcripción está desactivada (TRANSCRIBIR_MOTOR=ninguno)' };
  if (cfg.motor === 'local' && !hayLibreria()) {
    return { ok: false, motivo: 'falta la librería de transcripción local (@huggingface/transformers). Repite `node instalar.mjs`. Los audios se dejan descargados sin transcribir' };
  }
  if (cfg.claveNecesaria && !cfg.claves.length) {
    return { ok: false, motivo: `no hay clave de transcripción (${cfg.variableClave}). Los audios se dejan descargados sin transcribir` };
  }
  return { ok: true };
}

// ── ffmpeg (opcional: solo hace falta para convertir o trocear audios grandes) ────────────────────
let _ffmpeg;
export async function rutaFfmpeg() {
  if (_ffmpeg !== undefined) return _ffmpeg;
  if (process.env.FFMPEG_PATH) return (_ffmpeg = process.env.FFMPEG_PATH);
  try { const m = await import('ffmpeg-static'); if (m.default && existsSync(m.default)) return (_ffmpeg = m.default); } catch { /* no instalado */ }
  const r = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  return (_ffmpeg = r.status === 0 ? 'ffmpeg' : null);
}
export const olvidarFfmpeg = () => { _ffmpeg = undefined; };

function ffmpeg(bin, args) { return spawnSync(bin, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8', maxBuffer: 1 << 26 }); }

export async function duracionSeg(fichero) {
  const bin = await rutaFfmpeg();
  if (!bin) return 0;
  const r = spawnSync(bin, ['-hide_banner', '-i', fichero], { encoding: 'utf8' });
  const m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(`${r.stderr}${r.stdout}`);
  return m ? (+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3]) : 0;
}

export async function aMp3(entrada, salida) {
  const bin = await rutaFfmpeg();
  if (!bin) throw new ErrorTranscripcion('sin-ffmpeg', 'este audio hay que convertirlo o trocearlo y falta ffmpeg (npm install lo trae; o instálalo y apunta FFMPEG_PATH).');
  const r = ffmpeg(bin, ['-i', entrada, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'libmp3lame', '-q:a', '5', salida]);
  if (!existsSync(salida)) throw new ErrorTranscripcion('ffmpeg', `ffmpeg no pudo leer el audio: ${(r.stderr || '').slice(-300)}`);
  return salida;
}

export async function trocear(mp3, dir, limite, trozoSeg) {
  if (statSync(mp3).size <= limite) return [{ ruta: mp3, offset: 0 }];
  const bin = await rutaFfmpeg();
  ffmpeg(bin, ['-i', mp3, '-f', 'segment', '-segment_time', String(trozoSeg), '-c', 'copy', join(dir, 'trozo_%03d.mp3')]);
  const trozos = readdirSync(dir).filter((f) => /^trozo_\d+\.mp3$/.test(f)).sort();
  if (!trozos.length) throw new ErrorTranscripcion('ffmpeg', 'el troceo del audio falló');
  return trozos.map((f, i) => ({ ruta: join(dir, f), offset: i * trozoSeg }));
}

// ── Llamada al servicio ──────────────────────────────────────────────────────────────────────────
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Una transcripción de UN fichero que ya cabe en la subida. Rota de clave ante un 429; solo cuando todas
 * han dicho 429 seguidas espera lo que pida el servicio. `fetchImpl` y `esperar` se inyectan para probarlo.
 */
export async function transcribirTrozo(ruta, cfg, { idioma = cfg.idioma, fetchImpl = fetch, esperar = dormir, log = () => {} } = {}) {
  const ext = extname(ruta).toLowerCase();
  const tipo = EXT_DIRECTAS[ext] || 'audio/mpeg';
  const bytes = readFileSync(ruta);
  const claves = cfg.claves.length ? cfg.claves : [null];
  let idx = 0, seguidos429 = 0;
  for (let intento = 0; intento < 12; intento++) {
    const form = new FormData();
    form.append('file', new Blob([bytes], { type: tipo }), basename(ruta));
    form.append('model', cfg.modelo);
    form.append('response_format', 'verbose_json');
    form.append('temperature', '0');
    if (idioma) form.append('language', idioma);
    const clave = claves[idx % claves.length];
    const cabeceras = { 'User-Agent': 'whatsapp-skill/2 (+https://github.com/6grados-es/6g-skills)' };
    if (clave) cabeceras.Authorization = `Bearer ${clave}`;
    let r;
    try { r = await fetchImpl(cfg.url, { method: 'POST', headers: cabeceras, body: form }); }
    catch (e) { log(`red: ${e.message}, reintento`); await esperar(3000); continue; }
    if (r.status === 200) return await r.json();
    if (r.status === 401 || r.status === 403) throw new ErrorTranscripcion('clave-rechazada', `el servicio de transcripción rechazó la clave (HTTP ${r.status}). Revisa ${cfg.variableClave || 'la clave'}.`);
    if (r.status === 429) {
      seguidos429++; idx++;
      if (seguidos429 >= claves.length) {
        const espera = Math.min(parseFloat(r.headers?.get?.('retry-after') || 20), 60);
        log(`todas las claves al límite, espero ${Math.round(espera)} s`); await esperar(espera * 1000); seguidos429 = 0;
      } else log(`429 → paso a la clave ${(idx % claves.length) + 1}`);
      continue;
    }
    if (r.status >= 500) { await esperar(4000 * (intento + 1)); continue; }
    throw new ErrorTranscripcion('api', `el servicio devolvió ${r.status}: ${(await r.text()).slice(0, 300)}`);
  }
  throw new ErrorTranscripcion('red', 'agotados los reintentos contra el servicio de transcripción');
}

// ── Motor local: Whisper en tu ordenador ─────────────────────────────────────────────────────────
// Lo que Whisper «oye» en silencios o ruido y no se dijo (medido en pruebas): se quita.
const RELLENO = /\[(?:pause|pausa|m[uú]sica|music|silencio|silence|blank_audio|risas|aplausos)\]/gi;
const SOLO_ALUCINACION = /^(?:y|de la|eh|mm+|gracias(?: por ver(?: el v[ií]deo)?)?|y nos vemos en el pr[oó]ximo v[ií]deo|suscr[ií]bete.*|subt[ií]tulos.*)[.!¡?¿\s]*$/i;
export function limpiarLocal(texto) {
  const t = String(texto || '').replace(RELLENO, ' ').replace(/\s+/g, ' ').trim();
  return SOLO_ALUCINACION.test(t) ? '' : t;
}

let _asr = null;
async function reconocedor(modelo, log) {
  if (_asr && _asr.modelo === modelo) return _asr.fn;
  const tf = await import('@huggingface/transformers');
  tf.env.cacheDir = join(dirDatos(), 'modelos');   // fuera de node_modules: reinstalar no lo borra
  mkdirSync(tf.env.cacheDir, { recursive: true });
  const yaEsta = existsSync(join(tf.env.cacheDir, ...modelo.split('/')));
  if (!yaEsta) log(`primera vez: bajo el modelo ${modelo} (~250 MB) a ${tf.env.cacheDir}; luego ya no hace falta internet`);
  const fn = await tf.pipeline('automatic-speech-recognition', modelo, { dtype: 'q8', device: 'cpu' });
  _asr = { modelo, fn };
  return fn;
}

/** Audio → PCM 16 kHz mono en Float32 con ffmpeg, recortando silencios del principio y del final. */
async function aPcm(ruta, dir) {
  const bin = await rutaFfmpeg();
  if (!bin) throw new ErrorTranscripcion('sin-ffmpeg', 'para transcribir en tu ordenador hace falta ffmpeg (npm install lo trae; o instálalo y apunta FFMPEG_PATH).');
  const sal = join(dir, 'audio.f32');
  const recorte = 'silenceremove=start_periods=1:start_silence=0.3:start_threshold=-45dB';
  const r = ffmpeg(bin, ['-i', ruta, '-vn', '-ac', '1', '-ar', '16000', '-af', `${recorte},areverse,${recorte},areverse`, '-f', 'f32le', sal]);
  if (!existsSync(sal)) throw new ErrorTranscripcion('ffmpeg', `ffmpeg no pudo leer el audio: ${(r.stderr || '').slice(-300)}`);
  const b = readFileSync(sal);
  return new Float32Array(b.buffer, b.byteOffset, Math.floor(b.byteLength / 4));
}

async function transcribirLocal(ruta, cfg, idioma, dir, log) {
  const pcm = await aPcm(ruta, dir);
  const duracion = pcm.length / 16000;
  if (duracion < 0.3) return { texto: '', segmentos: [], duracion, idioma: idioma || null, trozos: 1, reparados: 0, motor: 'local', modelo: cfg.modelo };
  let asr;
  try { asr = await reconocedor(cfg.modelo, log); }
  catch (e) {
    const win = process.platform === 'win32' && /dll|onnxruntime|module could not be found|specified module/i.test(e.message);
    throw new ErrorTranscripcion('local', win
      ? `no arranca el motor local en este Windows: falta el «Visual C++ Redistributable». Instálalo con: winget install Microsoft.VCRedist.2015+.x64 (y repite). Detalle: ${e.message}`
      : `no arranca el motor local: ${e.message}`);
  }
  const lengua = String(idioma || 'es').toLowerCase();
  const r = await asr(pcm, { language: IDIOMAS[lengua] || lengua, task: 'transcribe', chunk_length_s: 30, stride_length_s: 5, return_timestamps: false });
  const texto = limpiarLocal(Array.isArray(r) ? r.map((x) => x.text).join(' ') : r.text);
  return { texto, segmentos: texto ? [{ inicio: 0, fin: duracion, texto }] : [], duracion, idioma: lengua, trozos: Math.max(1, Math.ceil(duracion / 30)), reparados: 0, motor: 'local', modelo: cfg.modelo };
}

// ── Segmentos sin tildes (fallo medido de Whisper en Groq: un tramo entero sin á é í ó ú ñ) ────────
const CORTADAS = new Set(['qu', 'tambi', 'despu', 'informaci', 'espa', 'aqu', 'est', 'versi', 'pesta', 'cancelaci', 'ingl', 'autom', 'env', 'pol',
  'm', 't', 'c', 'd', 'r', 'b', 'f', 'seg', 'ning', 'tard', 'peque', 'carg', 'dec', 'compa', 'ma']);
export function sinTildes(texto) {
  if (/[áéíóúñÁÉÍÓÚÑ¿¡]/.test(texto)) return false;
  const palabras = texto.replace(/[,.;:!?]/g, ' ').split(/\s+/).filter(Boolean).map((p) => p.toLowerCase());
  return palabras.some((p) => CORTADAS.has(p) || (p.endsWith('ci') && p.length > 4));
}

async function repararSinTildes(segmentos, mp3, dir, cfg, opts) {
  const rotos = segmentos.filter((s) => sinTildes(s.texto));
  const bin = await rutaFfmpeg();
  if (!rotos.length || !bin) return 0;
  let reparados = 0;
  for (let i = 0; i < rotos.length; i++) {
    const s = rotos[i], clip = join(dir, `reparar_${i}.mp3`);
    ffmpeg(bin, ['-ss', Math.max(0, s.inicio - 0.2).toFixed(2), '-to', (s.fin + 0.2).toFixed(2), '-i', mp3, '-c:a', 'libmp3lame', '-q:a', '5', clip]);
    let nuevo = '';
    try { nuevo = ((await transcribirTrozo(clip, cfg, { ...opts, idioma: 'es' })).text || '').trim(); } catch { /* un tramo que falla no tumba el resto */ }
    rmSync(clip, { force: true });
    if (nuevo && !sinTildes(nuevo) && nuevo.length / Math.max(1, s.texto.length) > 0.6 && nuevo.length / Math.max(1, s.texto.length) < 1.8) {
      s.texto = nuevo.replace(/\s+/g, ' '); reparados++;
    }
  }
  return reparados;
}

export function marca(seg) {
  const h = Math.floor(seg / 3600), m = Math.floor((seg % 3600) / 60), s = Math.floor(seg % 60);
  const dos = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${dos(m)}:${dos(s)}` : `${dos(m)}:${dos(s)}`;
}

/**
 * Transcribe un fichero de audio (o vídeo). Devuelve {texto, segmentos:[{inicio,fin,texto}], duracion, idioma, trozos, reparados}.
 * Lanza ErrorTranscripcion con `codigo` (sin-clave, clave-rechazada, sin-ffmpeg, ffmpeg, api, red, config).
 */
export async function transcribirFichero(ruta, { cfg = configuracion(), idioma, fetchImpl, esperar, log = () => {} } = {}) {
  const est = estadoConfiguracion(cfg);
  if (!est.ok) throw new ErrorTranscripcion('sin-clave', est.motivo);
  if (!existsSync(ruta)) throw new ErrorTranscripcion('config', `no existe el fichero ${ruta}`);
  const idiomaUso = idioma || cfg.idioma;
  const opts = { idioma: idiomaUso, fetchImpl, esperar, log };
  const dir = mkdtempSync(join(tmpdir(), 'wa-transcribir-'));
  try {
    if (cfg.motor === 'local') return await transcribirLocal(ruta, cfg, idiomaUso, dir, log);
    const directo = EXT_DIRECTAS[extname(ruta).toLowerCase()] && statSync(ruta).size <= cfg.limite;
    const mp3 = directo ? ruta : await aMp3(ruta, join(dir, 'audio.mp3'));
    const duracion = await duracionSeg(mp3);
    const segmentos = [], textos = [], idiomas = [];
    const trozos = directo ? [{ ruta: mp3, offset: 0 }] : await trocear(mp3, dir, cfg.limite, cfg.trozoSeg);
    if (trozos.length > 1) log(`audio grande: ${trozos.length} trozos de ${Math.round(cfg.trozoSeg / 60)} min`);
    for (const t of trozos) {
      const d = await transcribirTrozo(t.ruta, cfg, opts);
      idiomas.push(d.language); textos.push((d.text || '').trim());
      for (const s of d.segments || []) segmentos.push({ inicio: s.start + t.offset, fin: s.end + t.offset, texto: String(s.text).trim() });
    }
    const idiomaDet = idiomas[0] || null;
    let reparados = 0;
    if (/^(es|spanish)$/i.test(idiomaUso || idiomaDet || '')) reparados = await repararSinTildes(segmentos, mp3, dir, cfg, opts);
    return { texto: reparados ? segmentos.map((s) => s.texto).join(' ') : textos.join(' '), segmentos, duracion, idioma: idiomaDet, trozos: trozos.length, reparados, motor: cfg.motor, modelo: cfg.modelo };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
