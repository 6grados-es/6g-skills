#!/usr/bin/env node
/**
 * enlace-borrador.mjs — prepara (y si quieres abre) un mensaje de WhatsApp en la APLICACIÓN, sin enviarlo.
 *   node enlace-borrador.mjs "Hola Marta, te confirmo la cita." [600111222]   # imprime la URL whatsapp://send?...
 *   node enlace-borrador.mjs "Hola…" +34600111222 --abrir                      # además la abre en la app
 * El texto se codifica (tildes, comas, saltos de línea). Sin teléfono, la app deja elegir el contacto.
 * No envía nada: el envío lo pulsa la persona. No necesita sesión ni instalar la librería de WhatsApp.
 */
import { execFile } from 'child_process';
import { normalizarTelefono } from './lib/coincidir-chat.mjs';

const a = process.argv.slice(2);
const abrir = a.includes('--abrir');
const pos = a.filter((x) => x !== '--abrir');
const [texto, telefono] = pos;
if (!texto) { console.error('Uso: node enlace-borrador.mjs "<texto>" [teléfono] [--abrir]'); process.exit(2); }
let numero = null;
if (telefono) {
  numero = normalizarTelefono(telefono);
  if (!numero) { console.error(`### «${telefono}» no parece un teléfono (usa «+» y el prefijo del país, o 9 cifras de España)`); process.exit(2); }
}
const url = `whatsapp://send?${numero ? `phone=${numero}&` : ''}text=${encodeURIComponent(texto)}`;
if (url.length > 2400) console.error('### aviso: el mensaje es largo (más de ~2.000 caracteres codificados) y la app puede cortarlo: pártelo en dos.');
console.log(url);
if (abrir) {
  const [cmd, args] = process.platform === 'darwin' ? ['open', ['-a', 'WhatsApp', url]]
    : process.platform === 'win32' ? ['powershell.exe', ['-NoProfile', '-Command', `Start-Process '${url.replace(/'/g, "''")}'`]]
    : ['xdg-open', [url]];
  execFile(cmd, args, { windowsHide: true }, (e) => { if (e) { console.error(`### no pude abrir la app: ${e.message}`); process.exit(1); } console.error('Abierto en la aplicación de WhatsApp. El envío lo pulsa la persona.'); });
}
