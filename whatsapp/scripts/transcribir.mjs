#!/usr/bin/env node
/**
 * transcribir.mjs — transcribe un audio o nota de voz que ya tienes en el disco.
 *   node transcribir.mjs <fichero> [--idioma es] [--out <fichero.txt>]
 * Motor y clave: ver lib/transcribir.mjs (por defecto Whisper en Groq con GROQ_API_KEY).
 * Salidas: 0 transcrito · 2 error de uso · 14 sin clave (el audio no se toca) · 15 otro fallo de transcripción.
 */
import { writeFileSync } from 'fs';
import { configuracion, estadoConfiguracion, transcribirFichero, marca, ErrorTranscripcion } from './lib/transcribir.mjs';

const a = process.argv.slice(2);
const pos = []; let idioma, out;
for (let i = 0; i < a.length; i++) { if (a[i] === '--idioma') idioma = a[++i]; else if (a[i] === '--out') out = a[++i]; else pos.push(a[i]); }
if (!pos[0]) { console.error('Uso: node transcribir.mjs <fichero> [--idioma es] [--out fichero.txt]'); process.exit(2); }
try {
  const cfg = configuracion();
  const est = estadoConfiguracion(cfg);
  if (!est.ok) { console.error(`### ${est.motivo}`); process.exit(14); }
  const r = await transcribirFichero(pos[0], { cfg, idioma, log: (m) => console.error(`[transcribir] ${m}`) });
  const lineas = [`# ${marca(r.duracion)} · idioma ${r.idioma || '?'} · ${r.motor}/${r.modelo}`, ...r.segmentos.map((s) => `[${marca(s.inicio)}] ${s.texto}`)];
  if (out) { writeFileSync(out, lineas.join('\n') + '\n', 'utf8'); console.log(`Transcripción guardada en ${out}`); } else console.log(lineas.join('\n'));
} catch (e) {
  if (e instanceof ErrorTranscripcion) { console.error(`### ${e.message}`); process.exit(e.codigo === 'sin-clave' ? 14 : 15); }
  throw e;
}
