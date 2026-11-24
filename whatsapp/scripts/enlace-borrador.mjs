#!/usr/bin/env node
/**
 * enlace-borrador.mjs — prepara (y si quieres abre) un mensaje de WhatsApp, sin enviarlo: en la APLICACIÓN de escritorio
 * si está instalada y, si no, en WhatsApp Web en el navegador. Se fuerza con --en app | --en web (o WHATSAPP_BORRADOR).
 *   node enlace-borrador.mjs "Hola Marta, te confirmo la cita." 600111222       # por teléfono
 *   node enlace-borrador.mjs "Hola Marta…" "Marta" --abrir                         # por NOMBRE (personas frecuentes)
 *   node enlace-borrador.mjs "Hola…" --sin-contacto --abrir                        # sin contacto: solo si la persona lo pide
 * El texto se codifica (tildes, comas, saltos de línea). No envía nada: el envío lo pulsa la persona.
 * No necesita sesión ni instalar la librería de WhatsApp.
 *
 * El contacto va puesto siempre: sin teléfono ni nombre sale con 2, salvo --sin-contacto (lo pidió la persona).
 * Por NOMBRE se busca primero en las personas frecuentes (node personas.mjs listar) y, si no está o está sin
 * teléfono, en los contactos de la app de WhatsApp del Mac (lib/agenda-mac.mjs, solo lectura). Nunca elige a ciegas:
 *   0 abierto (o URL impresa) · 2 error de uso · 6 nadie guardado con ese nombre · 7 varias personas casan (lista)
 *   9 la persona está guardada SIN teléfono (solo id interno de WhatsApp, o es un grupo): la app no deja abrirla directa
 * Con 6, 7 o 9 no se abre nada: Claude enseña las opciones en el chat (cuál de ellas, buscarla en WhatsApp o abrir
 * el mensaje sin contacto) y repite con lo que elija la persona.
 */
import { execFile } from 'child_process';
import { normalizarTelefono } from './lib/coincidir-chat.mjs';
import { cargar, buscar } from './lib/personas.mjs';
import { dondeAbrir, urlBorrador, ordenAbrir } from './lib/donde-abrir.mjs';
import { leerEnvFichero } from './lib/transcribir.mjs';
import { cargarAgenda } from './lib/agenda-mac.mjs';

const a = process.argv.slice(2);
const abrir = a.includes('--abrir');
const sinContacto = a.includes('--sin-contacto');
const iEn = a.indexOf('--en');
const en = iEn >= 0 ? a[iEn + 1] : '';
if (iEn >= 0 && !['app', 'web'].includes(String(en))) { console.error('Uso: --en app | --en web'); process.exit(2); }
const pos = a.filter((x, i) => x !== '--abrir' && x !== '--sin-contacto' && !(iEn >= 0 && (i === iEn || i === iEn + 1)));
const [texto, destino] = pos;
if (!texto || pos.length > 2) { console.error('Uso: node enlace-borrador.mjs "<texto>" <teléfono | nombre> [--abrir] [--en app|web]   (o --sin-contacto)'); process.exit(2); }
if (!destino && !sinContacto) {
  console.error('### Falta el contacto: pon su nombre o su teléfono y el mensaje se abre con él ya puesto. Abrir sin contacto (que lo elija la persona en la app) solo si lo pide: --sin-contacto.');
  process.exit(2);
}
if (destino && sinContacto) { console.error('### --sin-contacto no va con un nombre o un teléfono: quita uno de los dos.'); process.exit(2); }

const fila = (p, i) => `${i + 1}. ${p.nombre}${p.alias?.length ? ` (también: ${p.alias.join(', ')})` : ''} — ${p.telefono ? `+${p.telefono}` : 'sin teléfono'}${p.grupo ? ' [GRUPO]' : ''}`;

let numero = null;
if (destino) {
  const pareceNumero = /^[\d\s().+\-]+$/.test(destino.trim());
  numero = pareceNumero ? normalizarTelefono(destino) : null;
  if (pareceNumero && !numero) { console.error(`### «${destino}» no parece un teléfono (usa «+» y el prefijo del país, o 9 cifras de España)`); process.exit(2); }
  if (!pareceNumero) {
    let datos;
    try { datos = cargar(); } catch (e) { console.error(`### ${e.message}`); process.exit(2); }
    let r = buscar(destino, datos), origen = 'de tus personas frecuentes';
    let agenda;
    const deAgenda = () => (agenda === undefined ? (agenda = cargarAgenda()) : agenda);
    // Guardada sin teléfono (solo id interno): su número suele estar en la agenda de la app del Mac.
    if (r.elegido && !r.elegido.telefono && !r.elegido.grupo && deAgenda()) {
      const porId = agenda.personas.find((x) => x.id === r.elegido.id);
      const porNombre = porId || buscar(r.elegido.nombre, agenda).elegido;
      if (porNombre) { r = { candidatos: [porNombre], elegido: { ...r.elegido, telefono: porNombre.telefono } }; origen = 'de tus personas frecuentes, con el teléfono de la agenda de WhatsApp de este Mac'; }
    }
    // Nadie en las personas frecuentes: la agenda de la app de WhatsApp de este Mac.
    if (!r.candidatos.length && deAgenda()) {
      const ra = buscar(destino, agenda);
      if (ra.candidatos.length) { r = { ...ra, candidatos: ra.candidatos.slice(0, 12), deAgenda: ra.candidatos.length }; origen = 'de la agenda de WhatsApp de este Mac'; }
    }
    if (!r.candidatos.length) {
      console.log(`=== NADIE COMO «${destino}» en tus personas frecuentes${agenda ? ' ni en la agenda de WhatsApp de este Mac' : ''}. No abro nada. ===`);
      console.log('=== Opciones para el usuario: 1) buscarlo en su WhatsApp, si está enlazado: node leer-chat.mjs "<nombre>" --listar (no lee mensajes), y guardarlo si dice que sí · 2) darte el número · 3) abrir el mensaje sin contacto (--sin-contacto) solo si lo prefiere él ===');
      process.exit(6);
    }
    if (!r.elegido) {
      console.log(`=== VARIAS PERSONAS CASAN CON «${destino}» (${origen}) — no elijo yo. Pregunta cuál: ===`);
      r.candidatos.forEach((p, i) => console.log(fila(p, i)));
      if (r.deAgenda > r.candidatos.length) console.log(`… y ${r.deAgenda - r.candidatos.length} más: afina el nombre (nombre y apellido).`);
      process.exit(7);
    }
    const p = r.elegido;
    if (!p.telefono) {
      console.log(`=== «${p.nombre}» está guardada sin teléfono${p.grupo ? ' (es un grupo)' : ' (solo con el id interno de WhatsApp)'} y no sale en la agenda de WhatsApp de este Mac: la app no deja abrir el mensaje con el contacto puesto. ===`);
      console.log('=== Opciones: 1) que el usuario te dé su número y lo guardas (node personas.mjs guardar --nombre … --telefono …) · 2) abrir el mensaje sin contacto (--sin-contacto) para que lo elija él en la app ===');
      process.exit(9);
    }
    numero = String(p.telefono);
    console.error(`«${destino}» → ${p.nombre} (+${numero}), ${origen}.`);
    if (origen === 'de la agenda de WhatsApp de este Mac') console.error(`Si escribes a menudo a esta persona, pregunta: «¿la guardo como ${p.nombre} = +${numero}?» y con su sí: node personas.mjs guardar --nombre "${p.nombre}" --telefono +${numero}`);
  }
}
const donde = dondeAbrir(en || process.env.WHATSAPP_BORRADOR || leerEnvFichero().WHATSAPP_BORRADOR);
const url = urlBorrador(donde, texto, numero);
console.error(donde === 'app' ? 'Se abre en la aplicación de WhatsApp de este ordenador.'
  : 'No hay app de WhatsApp de escritorio (o se pidió la web): se abre en WhatsApp Web, en el navegador. Si pide el QR, la persona tiene que abrir sesión ahí; si prefiere la app, que la instale y repita.');
if (url.length > 2400) console.error('### aviso: el mensaje es largo (más de ~2.000 caracteres codificados) y la app puede cortarlo: pártelo en dos.');
console.log(url);
if (abrir) {
  const [cmd, args] = ordenAbrir(donde, url);
  execFile(cmd, args, { windowsHide: true }, (e) => {
    if (e) { console.error(`### no pude abrir ${donde === 'app' ? 'la app' : 'el navegador'}: ${e.message}`); process.exit(1); }
    console.error(donde === 'app' ? 'Abierto en la aplicación de WhatsApp. El envío lo pulsa la persona.'
      : 'Abierto en WhatsApp Web, en el navegador. El envío lo pulsa la persona. Antes de pedir una lectura, que cierre esa pestaña (dos WhatsApp Web a la vez chocan).');
  });
}
