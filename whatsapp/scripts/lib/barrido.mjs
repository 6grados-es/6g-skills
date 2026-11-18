// barrido.mjs — lo que no depende de WhatsApp en el barrido de las últimas horas (`leer-chat.mjs --ultimas 24`):
// qué chats entran y cómo se resume cada uno. Separado para poder probarlo sin abrir la sesión.

/** Ids que no son conversaciones: estados, canales y listas de difusión. */
export const esConversacion = (id) => !!id && id !== 'status@broadcast' && !id.endsWith('@broadcast') && !id.endsWith('@newsletter');

/** Chats con movimiento desde `desdeT` (segundos), del más reciente al más viejo, sin estados ni canales. */
export function chatsRecientes(chats, desdeT) {
  return (chats || []).filter((c) => esConversacion(c.id) && (c.t || 0) >= desdeT).sort((a, b) => b.t - a.t);
}

/**
 * Resumen de un chat leído: cuántos mensajes, cuántos audios y si está PENDIENTE.
 * Pendiente = el último mensaje de la ventana no es del usuario (el contador de no leídos no sirve: se pone a cero
 * en cuanto se abre el chat en el móvil).
 */
export function resumenChat(mensajes = []) {
  const ultimo = mensajes.length ? mensajes[mensajes.length - 1] : null;
  const audios = mensajes.filter((m) => m.tipo === 'ptt' || m.tipo === 'audio').length;
  const transcritos = mensajes.filter((m) => m.transcripcion).length;
  return { total: mensajes.length, audios, transcritos, pendiente: !!ultimo && !ultimo.fromMe, ultimoT: ultimo ? ultimo.t : null };
}

/** Horas pedidas con --ultimas: número positivo, como mucho 7 días (más es leer media agenda). */
export function horasValidas(txt) {
  const h = Number(String(txt ?? '').replace(',', '.').replace(/h$/i, ''));
  return Number.isFinite(h) && h > 0 && h <= 168 ? h : null;
}
