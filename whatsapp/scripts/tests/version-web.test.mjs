import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

process.env.WHATSAPP_SKILL_HOME = mkdtempSync(join(tmpdir(), 'wa-vw-'));
const vw = await import('../lib/version-web.mjs');

test('sin fichero no hay versión fijada', () => {
  assert.equal(vw.versionWeb(), undefined);
});

test('un fichero con otra huella no se usa', () => {
  mkdirSync(join(process.env.WHATSAPP_SKILL_HOME, 'cache-web'), { recursive: true });
  writeFileSync(vw.ficheroVersion(), 'no es la buena');
  assert.equal(vw.versionWeb(), undefined);
});

test('una descarga con otra huella se rechaza y no se guarda como buena', async () => {
  const falso = async () => ({ ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode('malo').buffer });
  const r = await vw.asegurarVersionWeb({ fetchImpl: falso });
  assert.equal(r.ok, false);
  assert.equal(vw.versionWeb(), undefined);
});

test('un error de red no lanza', async () => {
  const r = await vw.asegurarVersionWeb({ fetchImpl: async () => { throw new Error('sin red'); } });
  assert.equal(r.ok, false);
  assert.match(r.motivo, /sin red/);
});

test('WA_WEB_VERSION=actual desactiva la versión fijada', async () => {
  process.env.WA_WEB_VERSION = 'actual';
  const r = await vw.asegurarVersionWeb({ fetchImpl: async () => { throw new Error('no debería bajar'); } });
  assert.equal(r.ok, true);
  assert.equal(r.version, undefined);
  delete process.env.WA_WEB_VERSION;
});

test('con internet baja la versión fijada y casa su huella', { skip: process.env.SIN_RED === '1' }, async () => {
  const r = await vw.asegurarVersionWeb();
  assert.equal(r.ok, true, r.motivo);
  assert.equal(r.version, vw.VERSION_WEB_FIJADA);
  assert.ok(existsSync(vw.ficheroVersion()));
  assert.equal(vw.versionWeb(), vw.VERSION_WEB_FIJADA);
});
