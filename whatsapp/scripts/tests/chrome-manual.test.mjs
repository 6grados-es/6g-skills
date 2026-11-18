import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arreglarChrome, ordenesDescomprimir } from '../lib/chrome-manual.mjs';

const base = (extra = {}) => {
  const hechos = [];
  const hay = new Set(extra.hay || []);
  return { hechos, hay, dep: {
    ejecutable: '/c/chrome.exe', salida: '/c/dir', plataforma: 'win32',
    existe: (r) => hay.has(r), borrar: (r) => hechos.push(['borrar', r]), crear: (r) => hechos.push(['crear', r]), borrarZip: (r) => hechos.push(['borrarZip', r]),
    bajarZip: async () => { hechos.push(['bajar']); hay.add('/c/chrome.zip'); return '/c/chrome.zip'; },
    ejecutar: extra.ejecutar || ((cmd) => { hechos.push(['ejecutar', cmd]); hay.add('/c/chrome.exe'); return { status: 0 }; }),
    ...extra.dep,
  } };
};

test('si Chrome ya está, no toca nada', async () => {
  const b = base({ hay: ['/c/chrome.exe'] });
  const r = await arreglarChrome(b.dep);
  assert.equal(r.ok, true); assert.equal(r.via, 'ya estaba'); assert.deepEqual(b.hechos, []);
});

test('copia a medias: la borra, baja el zip y lo descomprime con tar de Windows', async () => {
  const b = base();
  const r = await arreglarChrome(b.dep);
  assert.equal(r.ok, true); assert.equal(r.via, 'tar');
  assert.deepEqual(b.hechos.map((h) => h[0]), ['borrar', 'bajar', 'crear', 'ejecutar', 'borrarZip']);
});

test('si tar falla (Windows antiguo), prueba Expand-Archive', async () => {
  const b = base({ ejecutar: (cmd) => { if (cmd === 'tar') return { status: 1 }; b.hay.add('/c/chrome.exe'); return { status: 0 }; } });
  const r = await arreglarChrome(b.dep);
  assert.equal(r.ok, true); assert.equal(r.via, 'powershell.exe');
});

test('si nada lo deja bien, lo dice y deja el zip para hacerlo a mano', async () => {
  const b = base({ ejecutar: () => ({ status: 0 }) });
  const r = await arreglarChrome(b.dep);
  assert.equal(r.ok, false); assert.match(r.motivo, /chrome\.zip/);
});

test('órdenes por sistema, con comillas a salvo en PowerShell', () => {
  assert.deepEqual(ordenesDescomprimir('/z.zip', '/d', 'darwin')[0], ['ditto', ['-x', '-k', '/z.zip', '/d']]);
  assert.match(ordenesDescomprimir("C:\\Users\\O'Neil\\z.zip", 'C:\\d', 'win32')[1][1][2], /O''Neil/);
});
