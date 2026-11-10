// Tests de la resolución de nombres y números. Datos INVENTADOS (teléfonos 600000xxx, nombres de ejemplo).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizar, normalizarTelefono, clasificarConsulta, coincidir, coincidirNumero } from '../lib/coincidir-chat.mjs';

const chat = (id, titulo, t = 0, grupo = false, telefono = null) => ({ id, titulo, t, grupo, telefono });
const contacto = (id, nombres, esMio = true, telefono = null) => ({ id, nombres, esMio, telefono });

test('normalizar quita acentos, signos, emojis y mayúsculas', () => {
  assert.equal(normalizar('  Marta  López 🚀 (Málaga) '), 'marta lopez malaga');
});

test('normalizarTelefono acepta +34, 0034, espacios, guiones y 9 cifras españolas', () => {
  for (const t of ['+34 600 00 00 01', '0034-600000001', '600000001', '(+34)600.000.001', '34600000001']) {
    assert.equal(normalizarTelefono(t), '34600000001', t);
  }
});

test('normalizarTelefono respeta otros prefijos y no inventa uno', () => {
  assert.equal(normalizarTelefono('+44 7700 900123'), '447700900123');
  assert.equal(normalizarTelefono('00351912345678'), '351912345678');
  assert.equal(normalizarTelefono('+52 55 1234 5678'), '525512345678');
  assert.equal(normalizarTelefono('12345'), null, 'demasiado corto');
  assert.equal(normalizarTelefono('Marta'), null);
  assert.equal(normalizarTelefono('600 abc 001'), null);
});

test('el prefijo por defecto se puede cambiar (otro país)', () => {
  assert.equal(normalizarTelefono('600000001', '351'), '351600000001');
});

test('clasificarConsulta distingue id, teléfono, trozo de cifras y nombre', () => {
  assert.deepEqual(clasificarConsulta('34600000001@c.us'), { tipo: 'id', id: '34600000001@c.us' });
  assert.equal(clasificarConsulta('123456-789@g.us').tipo, 'id');
  assert.deepEqual(clasificarConsulta('+34 600 000 001'), { tipo: 'numero', telefono: '34600000001', id: '34600000001@c.us' });
  assert.deepEqual(clasificarConsulta('600000001'), { tipo: 'numero', telefono: '34600000001', id: '34600000001@c.us' });
  assert.deepEqual(clasificarConsulta('0000'), { tipo: 'cifras', cifras: '0000' });
  assert.deepEqual(clasificarConsulta('Marta López'), { tipo: 'nombre', nombre: 'Marta López' });
  assert.equal(clasificarConsulta('   ').tipo, 'vacia');
});

test('una coincidencia exacta y única se elige sola aunque haya parciales', () => {
  const r = coincidir('marta', { chats: [chat('a@c.us', 'Marta', 10), chat('b@c.us', 'Marta Gómez', 20), chat('c@g.us', 'Marta y Luis', 30, true)] });
  assert.equal(r.elegido.id, 'a@c.us');
  assert.equal(r.candidatos.length, 3);
});

test('un grupo y un chat individual con el mismo nombre NO se eligen solos', () => {
  const r = coincidir('marta', { chats: [chat('g@g.us', 'Marta', 50, true), chat('a@c.us', 'Marta', 10)] });
  assert.equal(r.elegido, null);
  assert.equal(r.candidatos[0].id, 'g@g.us', 'a igualdad, el más reciente primero');
});

test('un GRUPO se encuentra por su nombre como cualquier chat', () => {
  const r = coincidir('colegio', { chats: [chat('g1@g.us', 'Padres del colegio', 5, true), chat('a@c.us', 'Marta', 9)] });
  assert.equal(r.elegido.id, 'g1@g.us');
  assert.equal(r.elegido.grupo, true);
});

test('varias parciales sin exacta: no se elige; una sola parcial sí', () => {
  assert.equal(coincidir('luis', { chats: [chat('a@c.us', 'Luis Sanz', 5), chat('b@c.us', 'Luis Gil', 9)] }).elegido, null);
  assert.equal(coincidir('sanz', { chats: [chat('a@c.us', 'Luis Sanz', 5), chat('b@c.us', 'Luis Gil', 9)] }).elegido.id, 'a@c.us');
});

test('acentos y orden de palabras no importan; el trozo ha de ser prefijo de una palabra', () => {
  assert.equal(coincidir('sanz luís', { chats: [chat('a@c.us', 'Luis Sanz')] }).elegido.id, 'a@c.us');
  assert.equal(coincidir('anz', { chats: [chat('a@c.us', 'Luis Sanz')] }).candidatos.length, 0);
});

test('sin coincidencias o consulta vacía: nada elegido, sin romper', () => {
  assert.equal(coincidir('zzzz', { chats: [chat('a@c.us', 'Marta')] }).candidatos.length, 0);
  assert.equal(coincidir('!!! 🚀', { chats: [chat('a@c.us', 'Marta')] }).candidatos.length, 0);
  assert.equal(coincidir('x', { chats: [chat('a@c.us', null)] }).candidatos.length, 0);
});

test('un contacto guardado sin chat cargado aparece; un desconocido con solo pushname no', () => {
  assert.equal(coincidir('luis', { contactos: [contacto('1@c.us', ['Luis Gil'])] }).elegido.id, '1@c.us');
  assert.equal(coincidir('luis', { contactos: [contacto('2@c.us', ['Luis'], false)] }).candidatos.length, 0);
});

test('la misma persona como chat @lid y como contacto @c.us no se duplica y gana el id del chat', () => {
  const r = coincidir('marta', { chats: [chat('999@lid', 'Marta Gil', 99)], contactos: [contacto('34600000001@c.us', ['Marta Gil'])] });
  assert.equal(r.candidatos.length, 1);
  assert.equal(r.elegido.id, '999@lid');
});

// ── por número ──
test('coincidirNumero: un número completo da lo mismo con o sin prefijo y se elige solo si es único', () => {
  const datos = { chats: [chat('34600000001@c.us', 'Marta', 9, false, '34600000001'), chat('34600000002@c.us', 'Luis', 8, false, '34600000002'), chat('g@g.us', 'Grupo', 7, true)] };
  for (const q of ['34600000001', '600000001']) {
    const r = coincidirNumero(q, datos);
    assert.equal(r.elegido.id, '34600000001@c.us', q);
  }
  assert.equal(coincidirNumero('34600000009', datos).candidatos.length, 0);
});

test('coincidirNumero: un chat @lid se encuentra por el teléfono de su contacto', () => {
  const r = coincidirNumero('34600000003', { chats: [chat('555@lid', 'Ana', 4, false, '34600000003')] });
  assert.equal(r.elegido.id, '555@lid');
});

test('coincidirNumero: un trozo de cifras lista pero NUNCA elige solo', () => {
  const datos = { chats: [chat('a@c.us', 'Marta', 9, false, '34600000001'), chat('b@c.us', 'Luis', 8, false, '34600000011')] };
  const r = coincidirNumero('0000001', datos);
  assert.ok(r.candidatos.length >= 1);
  assert.equal(r.elegido, null);
  assert.equal(coincidirNumero('12', datos).candidatos.length, 0, 'menos de 4 cifras no busca nada');
});

test('coincidirNumero: contacto guardado sin chat; no duplica si ya sale por su chat', () => {
  const datos = { chats: [chat('a@c.us', 'Marta', 9, false, '34600000001')], contactos: [contacto('a2@c.us', ['Marta'], true, '34600000001'), contacto('b@c.us', ['Pepe'], true, '34600000005')] };
  assert.equal(coincidirNumero('34600000001', datos).candidatos.length, 1);
  assert.equal(coincidirNumero('34600000005', datos).elegido.id, 'b@c.us');
});
