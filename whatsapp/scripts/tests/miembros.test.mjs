// Datos inventados: el import no arranca el lector ni abre la sesión.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { identidadContacto, lineasMiembros, leerMiembrosPagina } from '../leer-chat.mjs';

test('--miembros rechaza chats individuales, números y opciones de mensajes antes del arranque', () => {
  const lector = fileURLToPath(new URL('../leer-chat.mjs', import.meta.url));
  for (const args of [['34000000001@c.us', '--miembros'], ['123@g.us', '--miembros', '20'],
    ['123@g.us', '--miembros', '--desde', '2026-10-12'], ['123@g.us', '--miembros', '--bajar'], ['Grupo Falso', '--miembros', '--listar'], ['+34600000001', '--miembros']]) {
    const r = spawnSync(process.execPath, [lector, ...args], { encoding: 'utf8', env: { ...process.env, WHATSAPP_SKILL_HOME: mkdtempSync(join(tmpdir(), 'wa-t-')) } });
    assert.equal(r.status, 2, args.join(' '));
    assert.doesNotMatch(r.stderr, /\[sync\]/);
    assert.equal(r.stdout, '');
  }
});

test('teléfono solo de @c.us; nombre guardado antes de pushname y formattedName', () => {
  assert.deepEqual(identidadContacto('34000000001@c.us', { name: 'Nombre guardado', pushname: 'Público', formattedName: 'Formato' }),
    { id: '34000000001@c.us', telefono: '34000000001', nombre: 'Nombre guardado', nombres: ['Nombre guardado', 'Público', 'Formato'], estadoTelefono: 'visible' });
  assert.equal(identidadContacto('5@lid', { pushname: 'Público', formattedName: 'Formato' }).nombre, 'Público');
  assert.equal(identidadContacto('5@lid', { formattedName: 'Formato' }).nombre, 'Formato');
});

test('LID resuelve phoneNumber del contacto, también con $1; nunca usa el número del LID', () => {
  assert.equal(identidadContacto('987654321000@lid', { phoneNumber: { $1: '34000000002@c.us' } }).telefono, '34000000002');
  assert.equal(identidadContacto('987654321000@lid', { phoneNumber: { user: '34000000002', server: 'c.us' } }).telefono, '34000000002');
  const p = identidadContacto('987654321000@lid', {});
  assert.equal(p.telefono, null);
  assert.equal(p.estadoTelefono, 'sin teléfono visible');
  assert.equal(identidadContacto('5@lid', { phoneNumber: '777@lid' }).telefono, null);
});

test('formato de miembros: id, nombre, teléfono y admin; no filtra contenido de mensajes', () => {
  const lineas = lineasMiembros([
    { ...identidadContacto('34000000001@c.us', { name: 'Persona Falsa' }), admin: true, texto: 'SECRETO', mensajes: ['SECRETO'] },
    { ...identidadContacto('5@lid', null), admin: false },
  ]);
  assert.equal(lineas[0], '1. Persona Falsa — 34000000001@c.us — 34000000001 [ADMIN]');
  assert.match(lineas[1], /sin teléfono visible/);
  assert.doesNotMatch(lineas.join('\n'), /SECRETO/);
  assert.deepEqual(lineasMiembros(), []);
});

test('consulta metadatos y contactos sin acceder a mensajes; reconoce superadmin', async () => {
  const wid = { _serialized: '123@g.us' };
  let actualizaciones = 0;
  const chat = { name: 'Grupo inventado', groupMetadata: { participants: { getModelsArray: () => [
    { id: { $1: '5@lid' }, isSuperAdmin: true }, { id: { _serialized: '6@lid' } },
  ] } } };
  Object.defineProperty(chat, 'msgs', { get() { throw new Error('NO leer mensajes'); } });
  globalThis.window = { require: (nombre) => {
    if (nombre === 'WAWebWidFactory') return { createWid: () => wid };
    if (nombre === 'WAWebCollections') return {
      Chat: { get: () => chat }, GroupMetadata: { update: async () => { actualizaciones++; } },
      Contact: { get: (id) => id === '5@lid' ? { pushname: 'Persona Falsa', phoneNumber: { _serialized: '34000000002@c.us' } } : null },
    };
    throw new Error(`Módulo no permitido: ${nombre}`);
  } };
  try {
    const r = await leerMiembrosPagina('123@g.us', identidadContacto);
    assert.equal(actualizaciones, 1);
    assert.equal(r.total, 2);
    assert.equal(r.miembros[0].telefono, '34000000002');
    assert.equal(r.miembros[0].admin, true);
    assert.equal(r.miembros[1].telefono, null);
    assert.equal(r.miembros[1].estadoTelefono, 'sin teléfono visible');
    assert.equal('mensajes' in r, false);
  } finally { delete globalThis.window; }
});

test('si la ficha @lid no trae nombre, usa la del mismo número (@c.us) sin tocar mensajes', async () => {
  const chat = { name: 'Grupo inventado', groupMetadata: { participants: { getModelsArray: () => [
    { id: { _serialized: '7@lid' } }, { id: { _serialized: '8@lid' } },
  ] } } };
  Object.defineProperty(chat, 'msgs', { get() { throw new Error('NO leer mensajes'); } });
  globalThis.window = { require: (nombre) => {
    if (nombre === 'WAWebWidFactory') return { createWid: () => ({}) };
    if (nombre === 'WAWebCollections') return {
      Chat: { get: () => chat }, GroupMetadata: { update: async () => {} },
      Contact: { get: (id) => ({
        '7@lid': { phoneNumber: { _serialized: '34000000007@c.us' } },
        '34000000007@c.us': { id: { _serialized: '34000000007@c.us' }, pushname: 'Nombre por número' },
      })[id] || null },
    };
    throw new Error(`Módulo no permitido: ${nombre}`);
  } };
  try {
    const r = await leerMiembrosPagina('123@g.us', identidadContacto);
    assert.equal(r.miembros[0].nombre, 'Nombre por número');
    assert.equal(r.miembros[0].telefono, '34000000007');
    assert.equal(r.miembros[1].nombre, null);
  } finally { delete globalThis.window; }
});
