#!/usr/bin/env node
/**
 * personas.mjs — la lista de «personas frecuentes» del usuario (nombre → teléfono / chat).
 *   node personas.mjs buscar "<nombre | teléfono | id>"     # no abre WhatsApp
 *   node personas.mjs listar
 *   node personas.mjs guardar --nombre "Marta" [--alias "Marta López,Mar"] [--telefono +34600111222] [--id <id>] [--grupo]
 *   node personas.mjs borrar --nombre "Marta"
 *   node personas.mjs donde                                  # ruta del fichero
 * `guardar` SOLO se lanza cuando el usuario ha dicho que sí a «¿lo guardo como Marta = +34…?».
 * Salidas: 0 ok · 2 error de uso · 6 no hay ninguna · 7 varias (decide el usuario).
 */
import { cargar, buscar, guardar, borrar } from './lib/personas.mjs';
import { ficheroPersonas } from './lib/rutas.mjs';

const [orden, ...resto] = process.argv.slice(2);
const op = {}; const pos = [];
for (let i = 0; i < resto.length; i++) {
  const a = resto[i];
  if (a === '--grupo') op.grupo = true;
  else if (a.startsWith('--')) { const [k, v] = a.includes('=') ? [a.slice(2, a.indexOf('=')), a.slice(a.indexOf('=') + 1)] : [a.slice(2), resto[++i]]; op[k] = v; }
  else pos.push(a);
}
const fila = (p) => `${p.nombre}${p.alias?.length ? ` (también: ${p.alias.join(', ')})` : ''} — ${p.telefono ? `tel. +${p.telefono}` : 'sin teléfono'} — ${p.id || 'sin id de chat'}${p.grupo ? ' [GRUPO]' : ''} — última vez: ${p.ultimaVez || 'n/d'}`;
try {
  if (orden === 'donde') console.log(ficheroPersonas());
  else if (orden === 'listar') { const d = cargar(); d.personas.forEach((p, i) => console.log(`${i + 1}. ${fila(p)}`)); if (!d.personas.length) console.log('(ninguna guardada todavía)'); }
  else if (orden === 'buscar') {
    const r = buscar(pos.join(' '), cargar());
    if (!r.candidatos.length) { console.log('=== NINGUNA persona guardada casa con eso ==='); process.exit(6); }
    r.candidatos.forEach((p, i) => console.log(`${i + 1}. ${fila(p)}`));
    if (r.elegido) console.log('=== una sola: se puede usar directamente ==='); else { console.log('=== VARIAS casan: pregunta al usuario cuál ==='); process.exit(7); }
  } else if (orden === 'guardar') {
    const r = guardar({ nombre: op.nombre, alias: (op.alias || '').split(',').map((s) => s.trim()).filter(Boolean), telefono: op.telefono, id: op.id, grupo: !!op.grupo });
    console.log(`${r.nuevo ? 'Guardada' : 'Actualizada'}: ${fila(r.persona)}`);
  } else if (orden === 'borrar') console.log(`Borradas: ${borrar(op.nombre || pos.join(' '))}`);
  else { console.error('Uso: node personas.mjs buscar|listar|guardar|borrar|donde …'); process.exit(2); }
} catch (e) { console.error(`### ${e.message}`); process.exit(2); }
