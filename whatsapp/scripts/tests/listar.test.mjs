// Tests de --listar (lineasListado + su unión con coincidir). Datos INVENTADOS: ningún nombre ni id real de nadie.
//   node --test tests/listar.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coincidir, lineasListado } from '../lib/coincidir-chat.mjs';

const fmt = (t) => `FECHA(${t})`;
const cand = (nombre, id, extra = {}) => ({ nombre, id, grupo: false, ultimo: 0, ...extra });

test('cada línea lleva nombre, id y último movimiento, con la fecha que pone el formateador inyectado', () => {
  const [l] = lineasListado([cand('Persona Uno', '111@c.us', { ultimo: 1700000000 })], fmt);
  assert.equal(l, '1. Persona Uno — 111@c.us — último movimiento: FECHA(1700000000)');
});

test('un grupo se marca [GRUPO] y un contacto sin chat cargado lo dice, no inventa fecha', () => {
  const ls = lineasListado([cand('Grupo Falso', '222@g.us', { grupo: true, ultimo: 5 }), cand('Contacto Falso', '333@c.us')], fmt);
  assert.match(ls[0], /\[GRUPO\]/);
  assert.match(ls[1], /sin chat cargado aún \(contacto guardado\)/);
  assert.doesNotMatch(ls[1], /FECHA/);
});

test('solo identifica: ningún campo de contenido entra en la salida', () => {
  const sucio = cand('Persona Dos', '444@c.us', { ultimo: 9, texto: 'SECRETO-DEL-MENSAJE', mensajes: ['SECRETO-OTRO'], citado: 'SECRETO-3' });
  assert.doesNotMatch(lineasListado([sucio], fmt).join('\n'), /SECRETO/);
});

test('con más candidatos que el tope corta y dice cuántos faltan, para que «20» no se lea como «todos»', () => {
  const muchos = Array.from({ length: 25 }, (_, i) => cand(`Persona ${i}`, `${i}@c.us`));
  const ls = lineasListado(muchos, fmt, 20);
  assert.equal(ls.length, 21);
  assert.match(ls[20], /y 5 más que casan/);
  assert.equal(lineasListado(muchos.slice(0, 20), fmt, 20).length, 20, 'justo en el tope no avisa de nada');
});

test('sin candidatos devuelve lista vacía', () => {
  assert.deepEqual(lineasListado([], fmt), []);
  assert.deepEqual(lineasListado(undefined, fmt), []);
});

test('unido a coincidir: un trozo del nombre, sin acentos ni mayúsculas, devuelve los chats con su id', () => {
  const datos = {
    chats: [{ id: '111@c.us', titulo: 'Álvaro Falso', grupo: false, t: 10 }, { id: '222@c.us', titulo: 'Álvaro Otro', grupo: false, t: 20 }, { id: '333@c.us', titulo: 'Zoe Inventada', grupo: false, t: 30 }],
    contactos: [],
  };
  const r = coincidir('alvaro', datos);
  const ls = lineasListado(r.candidatos, fmt);
  assert.equal(ls.length, 2, 'Zoe no casa');
  assert.match(ls.join('\n'), /111@c\.us/);
  assert.match(ls.join('\n'), /222@c\.us/);
  assert.doesNotMatch(ls.join('\n'), /333@c\.us/);
});
