import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../enlace-borrador.mjs', import.meta.url));
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Carpeta de datos de prueba: nunca la del usuario.
const HOME = mkdtempSync(join(tmpdir(), 'wa-borrador-'));
writeFileSync(join(HOME, 'personas-frecuentes.json'), JSON.stringify({ version: 1, personas: [
  { nombre: 'Marta Pruebas', alias: ['Mar'], telefono: '34600000002', id: '34600000002@c.us' },
  { nombre: 'Luis Uno', telefono: '34600000003', id: '34600000003@c.us' },
  { nombre: 'Luis Dos', telefono: '34600000004', id: '34600000004@c.us' },
  { nombre: 'Sin Numero', id: '111111111111111@lid' },
] }));
const run = (...a) => spawnSync(process.execPath, [cli, ...a], { encoding: 'utf8', env: { ...process.env, WHATSAPP_SKILL_HOME: HOME, WHATSAPP_BORRADOR: 'app' } });

test('el enlace lleva el teléfono normalizado y el texto codificado (tildes, saltos de línea, + y :)', () => {
  const r = run('Hola, ¿qué tal?\nA las 10:00 + café', '+34 600 000 001');
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), 'whatsapp://send?phone=34600000001&text=Hola%2C%20%C2%BFqu%C3%A9%20tal%3F%0AA%20las%2010%3A00%20%2B%20caf%C3%A9');
});

test('sin teléfono, la app deja elegir el contacto', () => {
  assert.equal(run('Hola').stdout.trim(), 'whatsapp://send?text=Hola');
});

test('un teléfono raro o la falta de texto salen con 2 y no abren nada', () => {
  assert.equal(run('Hola', '12').status, 2);
  assert.equal(run().status, 2);
});

test('por NOMBRE: una sola persona guardada → su teléfono', () => {
  const r = run('Hola', 'Marta');
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), 'whatsapp://send?phone=34600000002&text=Hola');
  assert.equal(run('Hola', 'mar').stdout.trim(), 'whatsapp://send?phone=34600000002&text=Hola');
});

test('por NOMBRE: varias casan → 7 con la lista y sin URL', () => {
  const r = run('Hola', 'Luis');
  assert.equal(r.status, 7);
  assert.match(r.stdout, /1\. Luis Uno — \+34600000003/);
  assert.match(r.stdout, /2\. Luis Dos — \+34600000004/);
  assert.doesNotMatch(r.stdout, /whatsapp:\/\//);
});

test('por NOMBRE: nadie → 6; guardada sin teléfono → 9; ninguna abre nada', () => {
  const r6 = run('Hola', 'Pepa');
  assert.equal(r6.status, 6);
  assert.doesNotMatch(r6.stdout, /whatsapp:\/\//);
  const r9 = run('Hola', 'Sin Numero');
  assert.equal(r9.status, 9);
  assert.doesNotMatch(r9.stdout, /whatsapp:\/\//);
});

// ── App de escritorio o WhatsApp Web ─────────────────────────────────────────────────────────────
import { dondeAbrir, hayAppEscritorio, urlBorrador, ordenAbrir } from '../lib/donde-abrir.mjs';

test('--en web deja el borrador en WhatsApp Web, con el mismo teléfono y texto', () => {
  const r = run('Hola, ¿qué tal?', '600000001', '--en', 'web');
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), 'https://web.whatsapp.com/send?phone=34600000001&text=Hola%2C%20%C2%BFqu%C3%A9%20tal%3F');
  assert.match(r.stderr, /WhatsApp Web/);
  assert.equal(run('Hola', '--en', 'movil').status, 2);
});

test('sin app de escritorio se elige la web; con app, la app; lo pedido manda', () => {
  const sinApp = { plataforma: 'darwin', existe: () => false, ejecutar: () => ({ status: 1 }) };
  const conApp = { plataforma: 'darwin', existe: (r) => r === '/Applications/WhatsApp.app', ejecutar: () => ({ status: 1 }) };
  assert.equal(dondeAbrir('', sinApp), 'web');
  assert.equal(dondeAbrir('', conApp), 'app');
  assert.equal(dondeAbrir('app', sinApp), 'app');
  assert.equal(dondeAbrir('WEB', conApp), 'web');
});

test('Windows: el protocolo whatsapp: registrado (o el paquete de la Store) cuenta como app', () => {
  const reg = { plataforma: 'win32', ejecutar: (c) => ({ status: c === 'reg' ? 0 : 1, stdout: '' }) };
  const store = { plataforma: 'win32', ejecutar: (c) => (c === 'reg' ? { status: 1 } : { status: 0, stdout: 'si\r\n' }) };
  const nada = { plataforma: 'win32', ejecutar: (c) => (c === 'reg' ? { status: 1 } : { status: 0, stdout: '' }) };
  assert.equal(hayAppEscritorio(reg), true);
  assert.equal(hayAppEscritorio(store), true);
  assert.equal(hayAppEscritorio(nada), false);
});

test('la orden para abrir: la app por su nombre en Mac, la web en el navegador', () => {
  assert.deepEqual(ordenAbrir('app', 'whatsapp://send?text=a', 'darwin'), ['open', ['-a', 'WhatsApp', 'whatsapp://send?text=a']]);
  assert.deepEqual(ordenAbrir('web', urlBorrador('web', 'a'), 'darwin'), ['open', ['https://web.whatsapp.com/send?text=a']]);
  assert.equal(ordenAbrir('web', "https://x/?t=it's", 'win32')[1][2], "Start-Process 'https://x/?t=it''s'");
});
