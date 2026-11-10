/**
 * coincidir-chat.mjs — resuelve «léeme lo de Marta» a un chat concreto de WhatsApp.
 *
 * Módulo PURO: sin red ni navegador. Recibe las listas que leer-chat.mjs extrae de la sesión y decide
 * qué chat es. Está aparte del lector para poder probarlo sin abrir WhatsApp.
 *
 * Regla de fondo: ante la duda NO se elige. Un substring como «mar» cayó una vez
 * en un grupo antes que en el chat individual; elegir el primero que casa es leer
 * el chat equivocado sin decirlo. Solo se elige solo cuando hay UNA coincidencia
 * exacta, o una única coincidencia en total.
 */

/** minúsculas, sin acentos ni signos ni emojis, espacios colapsados */
export function normalizar(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normaliza un teléfono escrito de cualquier forma («+34 600 11 12 22», «0034-600111222», «600111222»)
 * a solo dígitos CON prefijo de país. Devuelve null si no parece un teléfono.
 *  · «+» o «00» delante → ya trae prefijo: se respeta tal cual.
 *  · 9 cifras que empiezan por 6, 7, 8 o 9 → móvil/fijo español: se añade el prefijo por defecto (34,
 *    o el de la variable WHATSAPP_PREFIJO_PAIS).
 *  · cualquier otro caso sin «+» (p. ej. 10 cifras o más) se toma como «ya lleva prefijo». Si no es así,
 *    el usuario debe escribirlo con «+» y su prefijo.
 */
export function normalizarTelefono(texto, prefijoPorDefecto = process.env.WHATSAPP_PREFIJO_PAIS || '34') {
  const s = String(texto ?? '').trim();
  if (!s || /[^\d\s().+\-]/.test(s)) return null;
  const conMas = s.startsWith('+');
  let d = s.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  else if (!conMas && /^[6789]\d{8}$/.test(d)) d = `${prefijoPorDefecto}${d}`;
  return /^\d{7,15}$/.test(d) ? d : null;
}

/**
 * ¿Qué es lo que se ha pedido? un id de WhatsApp, un teléfono o un nombre.
 * `cifras` = un trozo de teléfono (4-6 cifras, o más con letras sueltas): solo vale para --listar.
 */
export function clasificarConsulta(texto) {
  const s = String(texto ?? '').trim();
  if (!s) return { tipo: 'vacia' };
  if (s.includes('@')) return { tipo: 'id', id: s };
  const tel = normalizarTelefono(s);
  if (tel) return { tipo: 'numero', telefono: tel, id: `${tel}@c.us` };
  const soloCifras = s.replace(/[\s().+\-]/g, '');
  if (/^\d{4,6}$/.test(soloCifras)) return { tipo: 'cifras', cifras: soloCifras };
  return { tipo: 'nombre', nombre: s };
}

const ultimas = (d, n = 9) => String(d).replace(/\D/g, '').slice(-n);

/**
 * Busca por NÚMERO entre los chats y contactos cargados (cada uno con `telefono` si WhatsApp lo muestra).
 * Compara las últimas 9 cifras, así «600111222» y «+34600111222» dan lo mismo y un trozo de 6 cifras
 * también casa. Un teléfono completo que coincide con uno solo es `elegido`; un trozo nunca elige solo.
 */
export function coincidirNumero(digitos, { chats = [], contactos = [] } = {}) {
  const q = String(digitos).replace(/\D/g, '');
  if (q.length < 4) return { consulta: q, candidatos: [], elegido: null };
  const completo = q.length >= 9;
  const casa = (tel) => !!tel && (completo ? ultimas(tel) === ultimas(q) : String(tel).includes(q));
  const porId = new Map();
  for (const c of chats) {
    if (!c.id || !casa(c.telefono)) continue;
    porId.set(c.id, { id: c.id, nombre: c.titulo, telefono: c.telefono, grupo: !!c.grupo, ultimo: c.t || 0, puntos: completo ? 3 : 1, origen: 'chat' });
  }
  for (const k of contactos) {
    if (!k.id || porId.has(k.id) || !casa(k.telefono)) continue;
    if (!k.esMio && !k.nombres?.length) continue;
    const yaPorTelefono = [...porId.values()].some((x) => x.telefono && ultimas(x.telefono) === ultimas(k.telefono));
    if (yaPorTelefono) continue;
    porId.set(k.id, { id: k.id, nombre: k.nombres?.[0] || null, telefono: k.telefono, grupo: false, ultimo: 0, puntos: completo ? 3 : 1, origen: 'contacto' });
  }
  const candidatos = [...porId.values()].sort((a, b) => b.ultimo - a.ultimo);
  const elegido = completo && candidatos.length === 1 ? candidatos[0] : null;
  return { consulta: q, candidatos, elegido };
}

/** 3 = idéntico · 2 = todas las palabras pedidas están completas · 1 = alguna por prefijo · 0 = no casa */
function puntuar(q, qTokens, nombre) {
  const n = normalizar(nombre);
  if (!n) return 0;
  if (n === q) return 3;
  const nt = n.split(' ');
  if (!qTokens.every((w) => nt.some((t) => t.startsWith(w)))) return 0;
  return qTokens.every((w) => nt.includes(w)) ? 2 : 1;
}

/**
 * @param {string} consulta  el nombre que dijo el usuario
 * @param {{chats?: {id:string, titulo:string|null, grupo:boolean, t:number}[],
 *          contactos?: {id:string, nombres:string[], esMio:boolean}[]}} datos
 * @returns {{consulta:string, candidatos:object[], elegido:object|null}}
 *   candidatos ordenados: mejor coincidencia primero, y a igualdad el más reciente.
 *   elegido = el candidato solo si no hay duda; si no, null y decide el usuario.
 */
export function coincidir(consulta, { chats = [], contactos = [] } = {}) {
  const q = normalizar(consulta);
  const qTokens = q.split(' ').filter(Boolean);
  if (!qTokens.length) return { consulta: q, candidatos: [], elegido: null };

  const porId = new Map();
  for (const c of chats) {
    const puntos = puntuar(q, qTokens, c.titulo);
    if (!puntos || !c.id) continue;
    porId.set(c.id, { id: c.id, nombre: c.titulo, grupo: !!c.grupo, ultimo: c.t || 0, puntos, origen: 'chat' });
  }

  // Contactos GUARDADOS por el usuario cuyo chat aún no ha bajado a la sesión. Los que
  // solo tienen el nombre que se puso la propia persona (pushname) se dejan fuera:
  // son desconocidos de algún grupo y ahogarían la lista.
  const yaPorChat = new Set([...porId.values()].filter((x) => !x.grupo).map((x) => normalizar(x.nombre)));
  const vistos = new Set();
  for (const k of contactos) {
    if (!k.esMio || !k.id || porId.has(k.id)) continue;
    let mejor = 0, nombre = null;
    for (const n of k.nombres || []) {
      const p = puntuar(q, qTokens, n);
      if (p > mejor) { mejor = p; nombre = n; }
    }
    if (!mejor) continue;
    const clave = normalizar(nombre);
    // la misma persona ya viene por su chat (WhatsApp la guarda como @c.us y como @lid)
    if (yaPorChat.has(clave) || vistos.has(clave)) continue;
    vistos.add(clave);
    porId.set(k.id, { id: k.id, nombre, grupo: false, ultimo: 0, puntos: mejor, origen: 'contacto' });
  }

  const candidatos = [...porId.values()].sort(
    (a, b) => b.puntos - a.puntos || b.ultimo - a.ultimo || String(a.nombre).localeCompare(String(b.nombre), 'es'),
  );

  const exactos = candidatos.filter((c) => c.puntos === 3);
  let elegido = null;
  if (exactos.length === 1) elegido = exactos[0];
  else if (candidatos.length === 1) elegido = candidatos[0];
  return { consulta: q, candidatos, elegido };
}

/**
 * Líneas de `--listar`: nombre, id y último movimiento de cada candidato. SOLO identifica chats: ni una palabra
 * del contenido de los mensajes. `fmtFecha` se inyecta (el lector pasa su formateador en hora de Madrid).
 * Con más candidatos que `max` corta y dice cuántos quedan fuera, para que nadie lea «20» como «todos».
 */
export function lineasListado(candidatos, fmtFecha, max = 20) {
  const lista = candidatos || [];
  const lineas = lista.slice(0, max).map((c, i) => {
    const mov = c.ultimo ? fmtFecha(c.ultimo) : 'sin chat cargado aún (contacto guardado)';
    return `${i + 1}. ${c.nombre || '(sin nombre)'} — ${c.id}${c.telefono ? ` — tel. ${c.telefono}` : ''}${c.grupo ? ' [GRUPO]' : ''} — último movimiento: ${mov}`;
  });
  if (lista.length > max) lineas.push(`… y ${lista.length - max} más que casan (afina el nombre para verlos)`);
  return lineas;
}
