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
const run = (...a) => spawnSync(process.execPath, [cli, ...a], { encoding: 'utf8', env: { ...process.env, WHATSAPP_SKILL_HOME: HOME, WHATSAPP_BORRADOR: 'app', WHATSAPP_AGENDA_MAC: 'no' } });

test('el enlace lleva el teléfono normalizado y el texto codificado (tildes, saltos de línea, + y :)', () => {
  const r = run('Hola, ¿qué tal?\nA las 10:00 + café', '+34 600 000 001');
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), 'whatsapp://send?phone=34600000001&text=Hola%2C%20%C2%BFqu%C3%A9%20tal%3F%0AA%20las%2010%3A00%20%2B%20caf%C3%A9');
});

test('sin contacto no abre nada (2): solo con --sin-contacto, que lo pide la persona, deja elegirlo en la app', () => {
  const r = run('Hola');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Falta el contacto/);
  assert.doesNotMatch(r.stdout, /whatsapp:\/\//);
  assert.equal(run('Hola', '--sin-contacto').stdout.trim(), 'whatsapp://send?text=Hola');
  assert.equal(run('Hola', 'Marta', '--sin-contacto').status, 2);
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

// ── Agenda de la app de WhatsApp del Mac (ContactsV2.sqlite), con una base de prueba ─────────────────
import { cargarAgenda } from '../lib/agenda-mac.mjs';
const hayAgendaDePrueba = (() => {
  const db = join(HOME, 'agenda-prueba.sqlite');
  const sql = `CREATE TABLE ZWAADDRESSBOOKCONTACT (ZFULLNAME TEXT, ZGIVENNAME TEXT, ZBUSINESSNAME TEXT, ZPHONENUMBER TEXT, ZLID TEXT);
    INSERT INTO ZWAADDRESSBOOKCONTACT VALUES ('Pepa Agenda','Pepa',NULL,'+34600000010',NULL);
    INSERT INTO ZWAADDRESSBOOKCONTACT VALUES ('Sin Numero','Sin',NULL,'+34600000011','111111111111111@lid');
    INSERT INTO ZWAADDRESSBOOKCONTACT VALUES ('Ana Uno','Ana',NULL,'+34600000012',NULL);
    INSERT INTO ZWAADDRESSBOOKCONTACT VALUES ('Ana Dos','Ana',NULL,'+34600000013',NULL);
    INSERT INTO ZWAADDRESSBOOKCONTACT VALUES ('Sin Telefono',NULL,NULL,NULL,NULL);`;
  const r = spawnSync('sqlite3', [db], { input: sql, encoding: 'utf8' });
  return r.status === 0 ? db : null;
})();
const runAgenda = (...a) => spawnSync(process.execPath, [cli, ...a], { encoding: 'utf8', env: { ...process.env, WHATSAPP_SKILL_HOME: HOME, WHATSAPP_BORRADOR: 'app', WHATSAPP_AGENDA_MAC: hayAgendaDePrueba } });

test('agenda del Mac: lee nombre y teléfono, salta los que no tienen teléfono', { skip: !hayAgendaDePrueba && 'sin sqlite3' }, () => {
  const a = cargarAgenda({ ruta: hayAgendaDePrueba });
  assert.equal(a.personas.length, 4);
  assert.deepEqual(a.personas.find((p) => p.nombre === 'Sin Numero'), { nombre: 'Sin Numero', alias: [], telefono: '34600000011', id: '111111111111111@lid' });
  assert.equal(cargarAgenda({ ruta: join(HOME, 'no-existe.sqlite') }), null);
});

test('por NOMBRE: si no está en personas frecuentes, sale de la agenda del Mac con el contacto puesto', { skip: !hayAgendaDePrueba && 'sin sqlite3' }, () => {
  const r = runAgenda('Hola', 'Pepa');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.stdout.trim(), 'whatsapp://send?phone=34600000010&text=Hola');
  assert.match(r.stderr, /agenda de WhatsApp de este Mac/);
  assert.match(r.stderr, /¿la guardo como Pepa Agenda/);
});

test('guardada solo con id interno: el teléfono sale de la agenda del Mac (antes salía 9)', { skip: !hayAgendaDePrueba && 'sin sqlite3' }, () => {
  const r = runAgenda('Hola', 'Sin Numero');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.stdout.trim(), 'whatsapp://send?phone=34600000011&text=Hola');
});

test('agenda del Mac: varias casan → 7 con la lista, sin elegir ni abrir', { skip: !hayAgendaDePrueba && 'sin sqlite3' }, () => {
  const r = runAgenda('Hola', 'Ana');
  assert.equal(r.status, 7);
  assert.match(r.stdout, /Ana Uno — \+34600000012/);
  assert.match(r.stdout, /Ana Dos — \+34600000013/);
  assert.doesNotMatch(r.stdout, /whatsapp:\/\//);
  assert.equal(runAgenda('Hola', 'Nadie Nunca').status, 6);
});
