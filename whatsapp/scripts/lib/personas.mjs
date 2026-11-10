// personas.mjs — «personas frecuentes»: qué número / chat corresponde a cada nombre.
// Fichero LOCAL del usuario (personas-frecuentes.json en su carpeta de datos). Son datos personales:
// nunca va al repo ni sale del ordenador. Se puede editar a mano. Aquí NO hay ni una palabra de mensajes:
// solo nombre, alias, teléfono, id del chat, si es grupo y la fecha de la última vez.
import { readFileSync, writeFileSync, existsSync, renameSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { ficheroPersonas } from './rutas.mjs';
import { normalizar, normalizarTelefono } from './coincidir-chat.mjs';

export function cargar(ruta = ficheroPersonas()) {
  if (!existsSync(ruta)) return { version: 1, personas: [] };
  let j;
  try { j = JSON.parse(readFileSync(ruta, 'utf8')); }
  catch (e) { throw new Error(`personas-frecuentes.json no se puede leer (${e.message}). Está en ${ruta}; arréglalo a mano, no lo sobrescribo.`); }
  if (!j || !Array.isArray(j.personas)) throw new Error(`personas-frecuentes.json no tiene la forma esperada ({"personas": [...]}). Está en ${ruta}.`);
  return j;
}

function escribir(datos, ruta) {
  mkdirSync(dirname(ruta), { recursive: true });
  const tmp = `${ruta}.tmp`;
  writeFileSync(tmp, JSON.stringify(datos, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
  renameSync(tmp, ruta);
}

const nombresDe = (p) => [p.nombre, ...(p.alias || [])].filter(Boolean);

/** Puntos de una entrada para la consulta: 3 = nombre o alias idéntico · 2 = palabras completas · 1 = por prefijo · 0 = no casa. */
function puntos(q, qTokens, p) {
  let mejor = 0;
  for (const n of nombresDe(p)) {
    const nn = normalizar(n);
    if (!nn) continue;
    if (nn === q) return 3;
    const nt = nn.split(' ');
    if (!qTokens.every((w) => nt.some((t) => t.startsWith(w)))) continue;
    mejor = Math.max(mejor, qTokens.every((w) => nt.includes(w)) ? 2 : 1);
  }
  return mejor;
}

/**
 * Busca en el fichero por nombre, alias, teléfono o id. `elegido` solo si no hay duda
 * (una coincidencia idéntica, o una sola entrada en total); con varias, decide el usuario.
 */
export function buscar(consulta, datos) {
  const personas = datos?.personas || [];
  const texto = String(consulta ?? '').trim();
  if (!texto) return { candidatos: [], elegido: null };
  let candidatos = [];
  if (texto.includes('@')) candidatos = personas.filter((p) => p.id === texto);
  else {
    const tel = normalizarTelefono(texto);
    if (tel) candidatos = personas.filter((p) => p.telefono && String(p.telefono).slice(-9) === tel.slice(-9));
    else {
      const q = normalizar(texto), qt = q.split(' ').filter(Boolean);
      candidatos = personas.map((p) => ({ p, pt: qt.length ? puntos(q, qt, p) : 0 })).filter((x) => x.pt)
        .sort((a, b) => b.pt - a.pt).map((x) => ({ ...x.p, _pt: x.pt }));
    }
  }
  const exactos = candidatos.filter((c) => c._pt === 3);
  let elegido = null;
  if (exactos.length === 1) elegido = exactos[0];
  else if (candidatos.length === 1) elegido = candidatos[0];
  const limpia = (c) => { if (!c) return c; const { _pt, ...r } = c; return r; };
  return { candidatos: candidatos.map(limpia), elegido: limpia(elegido) };
}

/** Id a leer para una persona guardada: el id del chat si lo hay; si no, su teléfono como @c.us. */
export const idDePersona = (p) => p.id || (p.telefono ? `${String(p.telefono).replace(/\D/g, '')}@c.us` : null);

/**
 * Añade o actualiza una persona (clave: id, o teléfono si no hay id, o nombre idéntico). Solo se llama tras el
 * sí explícito del usuario. Los alias se acumulan; los campos que no se pasan no se pisan.
 */
export function guardar({ nombre, alias = [], telefono = null, id = null, grupo = false }, { ruta = ficheroPersonas(), ahora = new Date() } = {}) {
  if (!nombre || !String(nombre).trim()) throw new Error('falta el nombre');
  const tel = telefono ? normalizarTelefono(String(telefono)) : null;
  if (telefono && !tel) throw new Error(`«${telefono}» no parece un teléfono (usa «+» y el prefijo del país, o 9 cifras de España)`);
  if (!tel && !id) throw new Error('hace falta al menos el teléfono o el id del chat');
  const datos = cargar(ruta);
  const nn = normalizar(nombre);
  let p = datos.personas.find((x) => (id && x.id === id) || (tel && x.telefono && String(x.telefono).slice(-9) === tel.slice(-9)))
       || datos.personas.find((x) => normalizar(x.nombre) === nn && !x.id && !x.telefono);
  const nuevo = !p;
  if (!p) { p = { nombre: String(nombre).trim(), alias: [] }; datos.personas.push(p); }
  const aliasTodos = new Set(p.alias || []);
  if (normalizar(p.nombre) !== nn) aliasTodos.add(String(nombre).trim());
  for (const a of alias) if (a && normalizar(a) !== normalizar(p.nombre)) aliasTodos.add(String(a).trim());
  p.alias = [...aliasTodos];
  if (tel) p.telefono = tel;
  if (id) p.id = id;
  p.grupo = !!(grupo || p.grupo || (id && id.endsWith('@g.us')));
  p.ultimaVez = ahora.toISOString().slice(0, 10);
  escribir(datos, ruta);
  return { nuevo, persona: p };
}

/** Apunta la fecha de hoy en una persona YA guardada (la usa el lector al resolverla). No crea nada. */
export function marcarUso(id, { ruta = ficheroPersonas(), ahora = new Date() } = {}) {
  if (!existsSync(ruta)) return false;
  const datos = cargar(ruta);
  const p = datos.personas.find((x) => x.id === id || (x.telefono && id === `${x.telefono}@c.us`));
  if (!p) return false;
  const hoy = ahora.toISOString().slice(0, 10);
  if (p.ultimaVez === hoy) return true;
  p.ultimaVez = hoy;
  escribir(datos, ruta);
  return true;
}

export function borrar(nombre, { ruta = ficheroPersonas() } = {}) {
  const datos = cargar(ruta);
  const nn = normalizar(nombre);
  const antes = datos.personas.length;
  datos.personas = datos.personas.filter((p) => normalizar(p.nombre) !== nn);
  if (datos.personas.length !== antes) escribir(datos, ruta);
  return antes - datos.personas.length;
}

/**
 * Línea «PERSONA NUEVA» del final de una lectura: propone guardar a quien aún no está. El teléfono solo se sugiere si
 * es un teléfono de verdad (de un chat @c.us, o el que WhatsApp enseña de un @lid); un grupo no lleva teléfono.
 * Nunca incluye texto de mensajes.
 */
export function lineaPersonaNueva({ nombre, id, numero, esGrupo }) {
  const tel = !esGrupo && numero && /^\d{7,15}$/.test(String(numero)) ? ` --telefono +${numero}` : '';
  return `=== PERSONA NUEVA: «${nombre || '?'}» no está en tus personas frecuentes. Pregunta al usuario si la guardas; si dice que sí: node personas.mjs guardar --nombre "${nombre || ''}"${tel} --id ${id}${esGrupo ? ' --grupo' : ''} ===`;
}
