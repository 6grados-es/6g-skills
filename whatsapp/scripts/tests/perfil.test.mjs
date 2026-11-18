import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { limpiarPestanasRestauradas } from '../lib/perfil.mjs';

test('borra solo la lista de pestañas restaurables, no la sesión de WhatsApp', () => {
  const p = mkdtempSync(join(tmpdir(), 'wa-perfil-'));
  mkdirSync(join(p, 'Default', 'Sessions'), { recursive: true });
  writeFileSync(join(p, 'Default', 'Sessions', 'Tabs_1'), 'x');
  mkdirSync(join(p, 'Default', 'IndexedDB'), { recursive: true });
  writeFileSync(join(p, 'Default', 'IndexedDB', 'sesion'), 'y');
  assert.equal(limpiarPestanasRestauradas(p), true);
  assert.equal(existsSync(join(p, 'Default', 'Sessions')), false);
  assert.equal(existsSync(join(p, 'Default', 'IndexedDB', 'sesion')), true);
  assert.equal(limpiarPestanasRestauradas(p), false);
});
