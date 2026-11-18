import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { paginaQr, escribirPagina, RECARGA_S } from '../lib/qr-pagina.mjs';

test('la página del QR lleva el QR incrustado y se recarga sola', () => {
  const h = paginaQr({ estado: 'qr', n: 2, dataUrl: 'data:image/png;base64,AAAA' });
  assert.match(h, new RegExp(`http-equiv="refresh" content="${RECARGA_S}"`));
  assert.match(h, /<img src="data:image\/png;base64,AAAA"/);
  assert.match(h, /QR n\.º 2/);
});

test('vinculado, caducado o error: ya no se recarga', () => {
  for (const estado of ['listo', 'caducado', 'error']) assert.doesNotMatch(paginaQr({ estado, mensaje: 'x' }), /http-equiv="refresh"/);
  assert.match(paginaQr({ estado: 'escaneado' }), /http-equiv="refresh"/);
});

test('el texto se escapa y la página se escribe de golpe, sin dejar el temporal', () => {
  assert.match(paginaQr({ estado: 'listo', mensaje: '<b>Ana & Co</b>' }), /&lt;b&gt;Ana &amp; Co&lt;\/b&gt;/);
  const ruta = join(mkdtempSync(join(tmpdir(), 'wa-qr-')), 'qr.html');
  escribirPagina(ruta, { estado: 'qr', n: 1, dataUrl: 'data:image/png;base64,BBBB' });
  escribirPagina(ruta, { estado: 'qr', n: 2, dataUrl: 'data:image/png;base64,CCCC' });
  const h = readFileSync(ruta, 'utf8');
  assert.match(h, /CCCC/);
  assert.doesNotMatch(h, /BBBB/);
  assert.equal(existsSync(`${ruta}.tmp`), false);
});
