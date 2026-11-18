// donde-abrir.mjs — ¿el mensaje se deja en la APLICACIÓN de WhatsApp o en WhatsApp Web (navegador)?
// Cada persona lo tiene montado a su manera: con la app de escritorio instalada se abre en la app (whatsapp://);
// sin ella, en WhatsApp Web (https://web.whatsapp.com/send), que pide tener la sesión abierta en el navegador.
// Se puede forzar con --en app | web, o con WHATSAPP_BORRADOR=app|web en el entorno o en claves.env.
import { existsSync } from 'fs';
import { spawnSync } from 'child_process';
import { join } from 'path';

/** ¿Hay app de WhatsApp de escritorio? `ejecutar` y `existe` se inyectan en las pruebas. */
export function hayAppEscritorio({ plataforma = process.platform, ejecutar = spawnSync, existe = existsSync, home = process.env.HOME || '' } = {}) {
  if (plataforma === 'darwin') {
    if (['/Applications/WhatsApp.app', join(home, 'Applications', 'WhatsApp.app')].some((r) => existe(r))) return true;
    const r = ejecutar('open', ['-Ra', 'WhatsApp'], { encoding: 'utf8' });
    return r.status === 0;
  }
  if (plataforma === 'win32') {
    // La app de la Microsoft Store (y la antigua) registra el protocolo whatsapp:.
    const r = ejecutar('reg', ['query', 'HKCR\\whatsapp'], { encoding: 'utf8', windowsHide: true });
    if (r.status === 0) return true;
    const p = ejecutar('powershell.exe', ['-NoProfile', '-Command', "if (Get-AppxPackage -Name '*WhatsApp*') { 'si' }"], { encoding: 'utf8', windowsHide: true });
    return /si/.test(String(p.stdout || ''));
  }
  const r = ejecutar('xdg-mime', ['query', 'default', 'x-scheme-handler/whatsapp'], { encoding: 'utf8' });
  return r.status === 0 && !!String(r.stdout || '').trim();
}

/** 'app' o 'web'. `pedido`: lo que dijo la persona (--en, o WHATSAPP_BORRADOR); si no, se mira si hay app. */
export function dondeAbrir(pedido, opciones) {
  const p = String(pedido || '').toLowerCase().trim();
  if (p === 'app' || p === 'web') return p;
  return hayAppEscritorio(opciones) ? 'app' : 'web';
}

/** La URL del borrador según dónde se abre. No envía nada: el envío lo pulsa la persona. */
export function urlBorrador(donde, texto, numero) {
  const q = `${numero ? `phone=${numero}&` : ''}text=${encodeURIComponent(texto)}`;
  return donde === 'web' ? `https://web.whatsapp.com/send?${q}` : `whatsapp://send?${q}`;
}

/** Orden para abrirla: la app por su nombre en Mac; la web en el navegador por defecto. */
export function ordenAbrir(donde, url, plataforma = process.platform) {
  if (plataforma === 'darwin') return donde === 'app' ? ['open', ['-a', 'WhatsApp', url]] : ['open', [url]];
  if (plataforma === 'win32') return ['powershell.exe', ['-NoProfile', '-Command', `Start-Process '${url.replace(/'/g, "''")}'`]];
  return ['xdg-open', [url]];
}
