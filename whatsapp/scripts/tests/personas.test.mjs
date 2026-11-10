// Tests de personas frecuentes. Todo en una carpeta temporal: nunca toca un fichero real del usuario.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { cargar, buscar, guardar, marcarUso, borrar, idDePersona } from '../lib/personas.mjs';

const nuevaRuta = () => join(mkdtempSync(join(tmpdir(), 'wa-pers-')), 'personas-frecuentes.json');
const ahora = new Date('2026-11-10T10:00:00Z');

test('sin fichero hay una lista vacía; guardar crea el fichero con nombre, teléfono, id y fecha', () => {
  const ruta = nuevaRuta();
  assert.deepEqual(cargar(ruta).personas, []);
  const { nuevo, persona } = guardar({ nombre: 'Marta López', telefono: '+34 600 000 001', id: '34600000001@c.us' }, { ruta, ahora });
  assert.equal(nuevo, true);
  assert.equal(persona.telefono, '34600000001');
  assert.equal(persona.ultimaVez, '2026-11-10');
  assert.equal(persona.grupo, false);
  assert.equal(cargar(ruta).personas.length, 1);
});

test('guardar la misma persona dos veces actualiza y acumula alias, no duplica', () => {
  const ruta = nuevaRuta();
  guardar({ nombre: 'Marta López', telefono: '600000001' }, { ruta, ahora });
  const r = guardar({ nombre: 'Marta', telefono: '+34600000001', alias: ['Mar'] }, { ruta, ahora: new Date('2026-12-01T00:00:00Z') });
  assert.equal(r.nuevo, false);
  const p = cargar(ruta).personas;
  assert.equal(p.length, 1);
  assert.deepEqual(p[0].alias.sort(), ['Mar', 'Marta']);
  assert.equal(p[0].ultimaVez, '2026-12-01');
});

test('un grupo se guarda como grupo por su id; hace falta teléfono o id', () => {
  const ruta = nuevaRuta();
  assert.equal(guardar({ nombre: 'Padres del cole', id: '1203-45@g.us' }, { ruta, ahora }).persona.grupo, true);
  assert.throws(() => guardar({ nombre: 'Nadie' }, { ruta }), /teléfono o el id/);
  assert.throws(() => guardar({ nombre: 'X', telefono: 'no-es-un-telefono' }, { ruta }), /no parece un teléfono/);
});

test('buscar: por nombre, alias, teléfono e id; elige solo con una exacta o una única', () => {
  const ruta = nuevaRuta();
  guardar({ nombre: 'Marta López', alias: ['Mar'], telefono: '600000001', id: '34600000001@c.us' }, { ruta, ahora });
  guardar({ nombre: 'Marta Gil', telefono: '600000002' }, { ruta, ahora });
  const d = cargar(ruta);
  assert.equal(buscar('mar', d).elegido.nombre, 'Marta López', 'el alias idéntico gana a las parciales');
  assert.equal(buscar('marta', d).elegido, null, 'dos Martas: decide el usuario');
  assert.equal(buscar('marta', d).candidatos.length, 2);
  assert.equal(buscar('López', d).elegido.nombre, 'Marta López');
  assert.equal(buscar('+34 600 000 002', d).elegido.nombre, 'Marta Gil');
  assert.equal(buscar('34600000001@c.us', d).elegido.nombre, 'Marta López');
  assert.equal(buscar('zzz', d).candidatos.length, 0);
});

test('idDePersona: el id del chat, o el teléfono como @c.us', () => {
  assert.equal(idDePersona({ id: '555@lid', telefono: '34600000001' }), '555@lid');
  assert.equal(idDePersona({ telefono: '34600000001' }), '34600000001@c.us');
  assert.equal(idDePersona({}), null);
});

test('marcarUso solo actualiza la fecha de una persona YA guardada y no crea nada', () => {
  const ruta = nuevaRuta();
  guardar({ nombre: 'Marta', telefono: '600000001', id: 'a@c.us' }, { ruta, ahora });
  assert.equal(marcarUso('a@c.us', { ruta, ahora: new Date('2027-01-05T00:00:00Z') }), true);
  assert.equal(cargar(ruta).personas[0].ultimaVez, '2027-01-05');
  assert.equal(marcarUso('desconocido@c.us', { ruta }), false);
  assert.equal(cargar(ruta).personas.length, 1);
  assert.equal(marcarUso('x', { ruta: join(tmpdir(), 'no-existe-xyz', 'p.json') }), false, 'sin fichero no lo crea');
});

test('el fichero se puede editar a mano; si está roto se avisa y NO se sobrescribe', () => {
  const ruta = nuevaRuta();
  writeFileSync(ruta, '{"personas":[{"nombre":"Pepe","telefono":"34600000009"}]}');
  assert.equal(buscar('pepe', cargar(ruta)).elegido.telefono, '34600000009');
  writeFileSync(ruta, '{esto no es json');
  assert.throws(() => cargar(ruta), /no se puede leer/);
  assert.throws(() => guardar({ nombre: 'Otro', telefono: '600000003' }, { ruta }), /no se puede leer/);
  assert.equal(readFileSync(ruta, 'utf8'), '{esto no es json', 'el fichero roto queda como estaba');
});

test('borrar quita por nombre', () => {
  const ruta = nuevaRuta();
  guardar({ nombre: 'Marta', telefono: '600000001' }, { ruta, ahora });
  assert.equal(borrar('marta', { ruta }), 1);
  assert.equal(cargar(ruta).personas.length, 0);
});

test('la orden de línea de comandos usa WHATSAPP_SKILL_HOME y devuelve 7 con varias y 6 con ninguna', () => {
  const home = mkdtempSync(join(tmpdir(), 'wa-home-'));
  const cli = fileURLToPath(new URL('../personas.mjs', import.meta.url));
  const run = (...a) => spawnSync(process.execPath, [cli, ...a], { encoding: 'utf8', env: { ...process.env, WHATSAPP_SKILL_HOME: home } });
  assert.equal(run('guardar', '--nombre', 'Marta Gil', '--telefono', '600000002').status, 0);
  assert.equal(run('guardar', '--nombre', 'Marta López', '--telefono', '600000001').status, 0);
  assert.equal(run('buscar', 'marta').status, 7);
  assert.equal(run('buscar', 'López').status, 0);
  assert.equal(run('buscar', 'zzz').status, 6);
  assert.equal(run('guardar', '--nombre', 'Sin datos').status, 2);
  assert.ok(existsSync(join(home, 'personas-frecuentes.json')));
});

test('dos personas con el MISMO nombre exacto: no se elige ninguna, decide el usuario', () => {
  const ruta = nuevaRuta();
  guardar({ nombre: 'Marta', telefono: '600000001' }, { ruta, ahora });
  guardar({ nombre: 'Marta', telefono: '600000002' }, { ruta, ahora });
  const r = buscar('marta', cargar(ruta));
  assert.equal(r.candidatos.length, 2);
  assert.equal(r.elegido, null);
});

import { lineaPersonaNueva } from '../lib/personas.mjs';
test('PERSONA NUEVA: un @lid sin teléfono visible no propone teléfono; con teléfono lo propone; un grupo no lleva teléfono', () => {
  assert.doesNotMatch(lineaPersonaNueva({ nombre: 'Ana', id: '555@lid', numero: null, esGrupo: false }), /--telefono/);
  assert.match(lineaPersonaNueva({ nombre: 'Ana', id: '555@lid', numero: '34600000003', esGrupo: false }), /--telefono \+34600000003 --id 555@lid/);
  const g = lineaPersonaNueva({ nombre: 'Cole', id: '12-34@g.us', numero: null, esGrupo: true });
  assert.match(g, /--id 12-34@g\.us --grupo/);
  assert.doesNotMatch(g, /--telefono/);
});
