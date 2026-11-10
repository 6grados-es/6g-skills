import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../enlace-borrador.mjs', import.meta.url));
const run = (...a) => spawnSync(process.execPath, [cli, ...a], { encoding: 'utf8' });

test('el enlace lleva el teléfono normalizado y el texto codificado (tildes, saltos de línea, + y :)', () => {
  const r = run('Hola, ¿qué tal?\nA las 10:00 + café', '+34 600 000 001');
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), 'whatsapp://send?phone=34600000001&text=Hola%2C%20%C2%BFqu%C3%A9%20tal%3F%0AA%20las%2010%3A00%20%2B%20caf%C3%A9');
});

test('sin teléfono, la app deja elegir el contacto', () => {
  assert.equal(run('Hola').stdout.trim(), 'whatsapp://send?text=Hola');
});

test('un teléfono raro o la falta de texto salen con 2 y no abren nada', () => {
  assert.equal(run('Hola', 'abc').status, 2);
  assert.equal(run().status, 2);
});
