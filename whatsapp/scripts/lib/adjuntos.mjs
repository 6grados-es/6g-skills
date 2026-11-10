// adjuntos.mjs — lógica pura de «bajar adjuntos» del lector de WhatsApp (leer-chat-personal.mjs --bajar).
// Sin red y sin WhatsApp: se prueba con `node --test tests/adjuntos.test.mjs`.
// Lo único que toca disco es rutaLibre(), y recibe `existe` inyectado para poder probarla.
import { join, extname, basename } from 'path';

// Tipos de mensaje de WhatsApp que son un fichero. `sticker` queda fuera a propósito: no es lo que se pide bajar.
export const TIPOS_BAJABLES = ['document', 'image', 'video', 'audio', 'ptt'];
export const TIPOS_POR_DEFECTO = ['document'];
export const MAX_POR_DEFECTO = 5;

const EXT_POR_MIME = {
  'application/zip': 'zip', 'application/pdf': 'pdf', 'application/x-zip-compressed': 'zip',
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm',
  'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac',
  'text/plain': 'txt', 'text/csv': 'csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
};

const sinAcentos = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Parsea `--tipo document,image` → array validado. Un tipo desconocido es un error de uso,
 * no se ignora en silencio (si el usuario pide «videos» con un typo, no queremos bajar «nada» sin avisar).
 */
export function parsearTipos(texto) {
  if (texto == null || texto === '') return [...TIPOS_POR_DEFECTO];
  const pedidos = String(texto).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const alias = { documento: 'document', documentos: 'document', doc: 'document', docs: 'document', pdf: 'document', zip: 'document', imagen: 'image', imagenes: 'image', foto: 'image', fotos: 'image',
    video: 'video', videos: 'video', audio: 'audio', audios: 'audio', voz: 'ptt', nota: 'ptt', todo: 'todo', todos: 'todo' };
  const out = new Set();
  for (const p of pedidos) {
    const t = alias[p] || p;
    if (t === 'todo') { TIPOS_BAJABLES.forEach((x) => out.add(x)); continue; }
    if (!TIPOS_BAJABLES.includes(t)) throw new Error(`tipo «${p}» desconocido (válidos: ${TIPOS_BAJABLES.join(', ')}, todo)`);
    out.add(t);
  }
  return [...out];
}

/**
 * De los mensajes ya leídos del chat, elige cuáles se bajan: son media, su tipo está pedido y, si hay
 * filtro de nombre, el nombre del fichero (o el pie) lo contiene (sin acentos ni mayúsculas).
 * Devuelve los `max` MÁS RECIENTES, en orden cronológico — un chat con 80 documentos no se vuelca entero.
 */
export function elegirAdjuntos(mensajes, { tipos = TIPOS_POR_DEFECTO, fichero = '', max = MAX_POR_DEFECTO } = {}) {
  const aguja = sinAcentos(fichero).trim();
  // `sinId` cuenta los adjuntos que SÍ cumplirían tipo y filtro pero no traen id: no se pueden bajar, y callarlos
  // fue el fallo del 1-oct (WhatsApp Web renombró la clave del id y todos salían «sin adjuntos»).
  let sinId = 0;
  const casan = (mensajes || []).filter((m) => {
    if (!m || !m.media) return false;
    if (!tipos.includes(m.tipo)) return false;
    if (aguja && !sinAcentos(`${m.fichero || ''} ${m.texto || ''}`).includes(aguja)) return false;
    if (!m.id) { sinId++; return false; }
    return true;
  });
  casan.sort((a, b) => a.t - b.t);
  const total = casan.length;
  const elegidos = max > 0 && total > max ? casan.slice(total - max) : casan;
  return { elegidos, total, recortado: elegidos.length < total, sinId };
}

/**
 * Nombre de fichero seguro para escribir en disco. Lo que manda otro por WhatsApp NO es de fiar:
 * puede traer `../`, barras o caracteres de control. Se queda con el nombre base y limpia lo raro;
 * si no hay nombre, lo fabrica a partir de la fecha y el mimetype.
 */
export function nombreSeguro(nombre, { mimetype = '', tipo = 'archivo', t = 0 } = {}) {
  let base = basename(String(nombre || '').replace(/\\/g, '/'));
  base = base.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '_').replace(/^\.+/, '').trim();
  if (!base) {
    const ext = EXT_POR_MIME[String(mimetype).split(';')[0].trim().toLowerCase()] || 'bin';
    const f = t ? new Date(t * 1000).toISOString().slice(0, 19).replace(/[:T]/g, '-') : 'sin-fecha';
    return `whatsapp-${tipo}-${f}.${ext}`;
  }
  return base.slice(0, 180);
}

/**
 * Ruta de destino que NO pisa nada: si «kit.zip» existe, devuelve «kit (1).zip», «kit (2).zip»…
 * `existe` se inyecta (por defecto, fs.existsSync en el llamador) para poder probarla sin tocar disco.
 */
export function rutaLibre(dir, nombre, existe) {
  const ext = extname(nombre);
  const raiz = ext ? nombre.slice(0, -ext.length) : nombre;
  let ruta = join(dir, nombre);
  for (let i = 1; existe(ruta) && i < 1000; i++) ruta = join(dir, `${raiz} (${i})${ext}`);
  return ruta;
}

export function tamanoLegible(bytes) {
  if (!Number.isFinite(bytes)) return '?';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
