// qr-pagina.mjs — la página web local con el QR para enlazar WhatsApp.
// Por qué una página y no una imagen: WhatsApp cambia el QR cada ~20 s. Una imagen abierta en el visor se queda con
// el primero y caduca antes de que la persona saque el móvil. La página se recarga sola cada pocos segundos y siempre
// enseña el QR vigente; cuando se escanea, pasa a «Vinculado». Es un fichero local (sin servidor ni puertos), así que
// funciona igual en Mac y en Windows. Solo lleva el QR: ni mensajes ni datos de nadie.
import { writeFileSync, renameSync, mkdirSync } from 'fs';
import { dirname } from 'path';

export const RECARGA_S = 3;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/**
 * HTML de la página. estado: 'qr' (enseña el QR y se recarga) · 'escaneado' (se recarga hasta acabar) ·
 * 'listo' · 'caducado' · 'error' (estas tres ya no se recargan).
 */
export function paginaQr({ estado = 'qr', dataUrl = null, n = 0, mensaje = '' } = {}) {
  const recarga = estado === 'qr' || estado === 'escaneado';
  const titulo = { qr: 'Escanea el QR', escaneado: 'QR escaneado', listo: 'WhatsApp vinculado', caducado: 'El QR ha caducado', error: 'No se pudo vincular' }[estado] || 'WhatsApp';
  const cuerpo = estado === 'qr' && dataUrl
    ? `<img src="${esc(dataUrl)}" alt="Código QR de WhatsApp" width="420" height="420">
<ol><li>En el móvil abre WhatsApp.</li><li>Ajustes → <b>Dispositivos vinculados</b> → Vincular un dispositivo.</li><li>Apunta a este código. Escanéalo <b>una sola vez</b>.</li></ol>
<p class="nota">Esta página se actualiza sola cada ${RECARGA_S} segundos: el QR que ves es siempre el vigente (QR n.º ${n}).</p>`
    : estado === 'escaneado' ? '<p class="grande">Terminando de vincular… no cierres nada, puede tardar un minuto.</p>'
    : estado === 'listo' ? `<p class="grande ok">Listo. ${esc(mensaje)}</p><p>Ya puedes cerrar esta pestaña.</p>`
    : estado === 'caducado' ? `<p class="grande">No se escaneó a tiempo.</p><p>${esc(mensaje || 'Pídele a Claude que vuelva a lanzar la vinculación cuando tengas el móvil a mano.')}</p>`
    : `<p class="grande">${esc(mensaje || 'Algo falló.')}</p>`;
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
${recarga ? `<meta http-equiv="refresh" content="${RECARGA_S}">` : ''}
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)} · WhatsApp</title>
<style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#fff;color:#111;font:18px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:520px;padding:24px;text-align:center}
h1{font-size:28px;margin:0 0 16px}
img{display:block;margin:0 auto 16px;border:1px solid #ddd;border-radius:8px;max-width:100%;height:auto}
ol{text-align:left;margin:0 auto 12px;padding-left:24px}
.nota{color:#666;font-size:15px}.grande{font-size:22px}.ok{color:#0a7a32}
</style></head>
<body><main><h1>${esc(titulo)}</h1>
${cuerpo}
</main></body></html>
`;
}

/** Escribe la página de golpe (fichero temporal + renombrar): el navegador nunca lee una página a medias. */
export function escribirPagina(ruta, opciones) {
  mkdirSync(dirname(ruta), { recursive: true });
  const tmp = `${ruta}.tmp`;
  writeFileSync(tmp, paginaQr(opciones), 'utf8');
  renameSync(tmp, ruta);
}
