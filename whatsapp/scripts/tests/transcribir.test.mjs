// Tests de la transcripción. NO llaman a ningún servicio real: `fetch` es un doble que graba lo que se le manda.
// El audio de prueba lo genera ffmpeg (un tono), no es ninguna conversación.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { configuracion, estadoConfiguracion, transcribirTrozo, transcribirFichero, sinTildes, marca, rutaFfmpeg, ErrorTranscripcion } from '../lib/transcribir.mjs';

const dir = mkdtempSync(join(tmpdir(), 'wa-tr-'));
const bin = await rutaFfmpeg();
const ffmpegOk = !!bin;
let wav = null, mp3Largo = null;
if (bin) {
  const gen = (salida, seg, extra = []) => spawnSync(bin, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `sine=frequency=440:duration=${seg}`, '-ac', '1', '-ar', '16000', ...extra, salida]);
  wav = join(dir, 'tono.wav'); gen(wav, 3);
  mp3Largo = join(dir, 'tono-largo.mp3'); gen(mp3Largo, 20, ['-c:a', 'libmp3lame', '-q:a', '5']);
}

const sinEnv = {};                         // entorno vacío: ni claves de nadie ni claves.env
const cfgGroq = (extra = {}) => configuracion({ GROQ_API_KEY: 'gsk_prueba_1,gsk_prueba_2', ...extra }, {});
const respuesta = (status, cuerpo, cab = {}) => ({ status, headers: { get: (k) => cab[k.toLowerCase()] ?? null }, json: async () => cuerpo, text: async () => JSON.stringify(cuerpo) });
const ok = (texto, segs) => respuesta(200, { text: texto, language: 'es', segments: segs || [{ start: 0, end: 1.5, text: ` ${texto}` }] });

test('configuración: Groq por defecto, varias claves separadas por comas, y NUNCA una clave de otro', () => {
  const c = cfgGroq();
  assert.equal(c.motor, 'groq');
  assert.match(c.url, /api\.groq\.com\/openai\/v1\/audio\/transcriptions/);
  assert.equal(c.modelo, 'whisper-large-v3');
  assert.deepEqual(c.claves, ['gsk_prueba_1', 'gsk_prueba_2']);
  assert.deepEqual(configuracion(sinEnv, {}).claves, [], 'sin variable ni claves.env no hay clave');
});

test('la clave también se lee de claves.env y el entorno manda sobre el fichero', () => {
  assert.deepEqual(configuracion({}, { GROQ_API_KEY: 'gsk_del_fichero' }).claves, ['gsk_del_fichero']);
  assert.deepEqual(configuracion({ GROQ_API_KEY: 'gsk_entorno' }, { GROQ_API_KEY: 'gsk_del_fichero' }).claves, ['gsk_entorno']);
});

test('sin clave el estado lo dice claro y avisa de que los audios quedan sin transcribir', () => {
  const e = estadoConfiguracion(configuracion(sinEnv, {}));
  assert.equal(e.ok, false);
  assert.match(e.motivo, /GROQ_API_KEY/);
  assert.match(e.motivo, /sin transcribir/);
  assert.equal(estadoConfiguracion(configuracion({ TRANSCRIBIR_MOTOR: 'ninguno' }, {})).ok, false);
});

test('motores: openai, compatible (local) y errores de configuración', () => {
  const o = configuracion({ TRANSCRIBIR_MOTOR: 'openai', OPENAI_API_KEY: 'sk-prueba' }, {});
  assert.match(o.url, /api\.openai\.com/); assert.equal(o.modelo, 'whisper-1');
  const c = configuracion({ TRANSCRIBIR_MOTOR: 'compatible', TRANSCRIBIR_URL: 'http://localhost:8000/v1/audio/transcriptions', TRANSCRIBIR_MODELO: 'small' }, {});
  assert.equal(estadoConfiguracion(c).ok, true, 'un servidor local no necesita clave');
  assert.throws(() => configuracion({ TRANSCRIBIR_MOTOR: 'compatible' }, {}), /TRANSCRIBIR_URL/);
  assert.throws(() => configuracion({ TRANSCRIBIR_MOTOR: 'inventado' }, {}), /desconocido/);
});

test('la petición lleva fichero, modelo, idioma, verbose_json, la clave como Bearer y un User-Agent propio', async () => {
  const f = join(dir, 'a.ogg'); writeFileSync(f, Buffer.from('OggS-falso'));
  let visto;
  const fetchImpl = async (url, init) => { visto = { url, init }; return ok('hola'); };
  const r = await transcribirTrozo(f, cfgGroq(), { fetchImpl });
  assert.equal(r.text, 'hola');
  assert.match(visto.url, /groq\.com/);
  assert.equal(visto.init.method, 'POST');
  assert.equal(visto.init.headers.Authorization, 'Bearer gsk_prueba_1');
  assert.match(visto.init.headers['User-Agent'], /whatsapp-skill/);
  const form = visto.init.body;
  assert.equal(form.get('model'), 'whisper-large-v3');
  assert.equal(form.get('language'), 'es');
  assert.equal(form.get('response_format'), 'verbose_json');
  assert.equal(form.get('file').name, 'a.ogg');
  assert.equal(form.get('file').type, 'audio/ogg');
});

test('ante un 429 pasa a la siguiente clave sin esperar', async () => {
  const f = join(dir, 'b.ogg'); writeFileSync(f, Buffer.from('x'));
  const claves = [], esperas = [];
  const fetchImpl = async (u, init) => { claves.push(init.headers.Authorization); return claves.length === 1 ? respuesta(429, {}) : ok('vale'); };
  const r = await transcribirTrozo(f, cfgGroq(), { fetchImpl, esperar: async (ms) => esperas.push(ms) });
  assert.equal(r.text, 'vale');
  assert.deepEqual(claves, ['Bearer gsk_prueba_1', 'Bearer gsk_prueba_2']);
  assert.deepEqual(esperas, []);
});

test('si TODAS las claves dan 429 espera lo que pide el servicio (con tope) y reintenta', async () => {
  const f = join(dir, 'c.ogg'); writeFileSync(f, Buffer.from('x'));
  let n = 0; const esperas = [];
  const fetchImpl = async () => (++n <= 2 ? respuesta(429, {}, { 'retry-after': '7' }) : ok('ya'));
  await transcribirTrozo(f, cfgGroq(), { fetchImpl, esperar: async (ms) => esperas.push(ms) });
  assert.deepEqual(esperas, [7000]);
});

test('una clave rechazada (401) para en seco con un error claro, sin reintentar', async () => {
  const f = join(dir, 'd.ogg'); writeFileSync(f, Buffer.from('x'));
  let n = 0;
  await assert.rejects(() => transcribirTrozo(f, cfgGroq(), { fetchImpl: async () => { n++; return respuesta(401, {}); } }),
    (e) => e instanceof ErrorTranscripcion && e.codigo === 'clave-rechazada' && /GROQ_API_KEY/.test(e.message));
  assert.equal(n, 1);
});

test('sin clave: transcribirFichero falla con «sin-clave» y NO llama a ningún servicio', async () => {
  const f = join(dir, 'e.ogg'); writeFileSync(f, Buffer.from('x'));
  let llamado = false;
  await assert.rejects(() => transcribirFichero(f, { cfg: configuracion(sinEnv, {}), fetchImpl: async () => { llamado = true; return ok('no'); } }),
    (e) => e.codigo === 'sin-clave');
  assert.equal(llamado, false, 'el audio no sale del ordenador si no hay motor configurado');
});

test('un audio pequeño y de formato admitido se manda tal cual, en una llamada, con segmentos y tiempos', { skip: !ffmpegOk && 'sin ffmpeg' }, async () => {
  const peticiones = [];
  const fetchImpl = async (u, init) => { peticiones.push(init.body.get('file').name); return ok('Hola, esto es una prueba', [{ start: 0.2, end: 2.9, text: ' Hola, esto es una prueba' }]); };
  const r = await transcribirFichero(wav, { cfg: cfgGroq(), fetchImpl });
  assert.deepEqual(peticiones, ['tono.wav']);
  assert.equal(r.texto, 'Hola, esto es una prueba');
  assert.equal(r.trozos, 1);
  assert.ok(r.duracion > 2.5 && r.duracion < 3.5, `duración ${r.duracion}`);
  assert.deepEqual(r.segmentos, [{ inicio: 0.2, fin: 2.9, texto: 'Hola, esto es una prueba' }]);
});

test('un audio que no cabe en una subida se trocea y los tiempos de cada trozo se desplazan', { skip: !ffmpegOk && 'sin ffmpeg' }, async () => {
  const cfg = { ...cfgGroq(), limite: 8_000, trozoSeg: 5 };   // 20 s de mp3 ≈ 21 KB: fuerza varios trozos
  let n = 0;
  const fetchImpl = async () => { n++; return ok(`trozo ${n}`, [{ start: 0, end: 1, text: `trozo ${n}` }]); };
  const r = await transcribirFichero(mp3Largo, { cfg, fetchImpl, idioma: 'en' });
  assert.ok(r.trozos >= 3, `trozos: ${r.trozos}`);
  assert.equal(n, r.trozos);
  assert.deepEqual(r.segmentos.map((s) => s.inicio), Array.from({ length: r.trozos }, (_, i) => i * 5), 'cada trozo suma su desfase');
  assert.match(r.texto, /trozo 1 trozo 2/);
});

test('un segmento sin tildes («informaci») se detecta y se retranscribe; si no mejora, se deja', { skip: !ffmpegOk && 'sin ffmpeg' }, async () => {
  assert.equal(sinTildes('la informaci es clave'), true);
  assert.equal(sinTildes('la información es clave'), false);
  assert.equal(sinTildes('hola que tal'), false);
  const llamadas = [];
  const fetchImpl = async (u, init) => {
    llamadas.push(init.body.get('language'));
    return llamadas.length === 1 ? ok('la informaci es clave', [{ start: 0, end: 2, text: 'la informaci es clave' }]) : ok('la información es clave');
  };
  const r = await transcribirFichero(wav, { cfg: cfgGroq(), fetchImpl });
  assert.equal(r.reparados, 1);
  assert.equal(r.texto, 'la información es clave');
  assert.equal(llamadas.length, 2);
});

test('marca da mm:ss y h:mm:ss', () => {
  assert.equal(marca(65), '01:05');
  assert.equal(marca(3725), '1:02:05');
});
