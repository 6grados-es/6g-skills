// Tests de adjuntos.mjs (qué adjuntos se bajan, con qué nombre y dónde). Sin abrir WhatsApp:
//   node --test tests/adjuntos.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsearTipos, elegirAdjuntos, nombreSeguro, rutaLibre, tamanoLegible, TIPOS_POR_DEFECTO, MAX_POR_DEFECTO } from '../lib/adjuntos.mjs';

const msg = (id, tipo, t, fichero = null, texto = '') => ({ id, tipo, t, media: true, fichero, texto });
const texto = (id, t, cuerpo) => ({ id, tipo: 'chat', t, media: false, fichero: null, texto: cuerpo });

test('por defecto solo se bajan documentos', () => {
  assert.deepEqual(parsearTipos(undefined), TIPOS_POR_DEFECTO);
  assert.deepEqual(parsearTipos(''), ['document']);
});

test('parsearTipos admite alias en español y «todo», y rechaza lo desconocido', () => {
  assert.deepEqual(parsearTipos('fotos,videos').sort(), ['image', 'video']);
  assert.deepEqual(parsearTipos('document,document'), ['document']);
  assert.deepEqual(parsearTipos('todo').sort(), ['audio', 'document', 'image', 'ptt', 'video']);
  assert.throws(() => parsearTipos('docs,musica'), /«musica» desconocido/, 'un typo no se ignora en silencio');
});

test('elegirAdjuntos ignora el texto, los tipos no pedidos y los mensajes sin id', () => {
  const ms = [texto('t1', 1, 'hola'), msg('d1', 'document', 2, 'a.zip'), msg('i1', 'image', 3, 'f.jpg'), { ...msg('x', 'document', 4, 'sin-id.zip'), id: null }];
  const { elegidos, total } = elegirAdjuntos(ms, { tipos: ['document'] });
  assert.deepEqual(elegidos.map((m) => m.id), ['d1']);
  assert.equal(total, 1);
});

test('el filtro de nombre no distingue acentos ni mayúsculas y mira también el pie', () => {
  const ms = [msg('a', 'document', 1, 'Kit-LinkedIn-6G.zip'), msg('b', 'document', 2, 'factura.pdf'), msg('c', 'document', 3, null, 'Aquí va el kit de LINKEDÍN')];
  const { elegidos } = elegirAdjuntos(ms, { tipos: ['document'], fichero: 'linkedin' });
  assert.deepEqual(elegidos.map((m) => m.id), ['a', 'c']);
});

test('con más candidatos que el máximo se bajan los MÁS RECIENTES, en orden cronológico, y se avisa', () => {
  const ms = Array.from({ length: 8 }, (_, i) => msg(`d${i}`, 'document', 100 - i, `f${i}.zip`)); // d0 es el más reciente
  const { elegidos, total, recortado } = elegirAdjuntos(ms, { tipos: ['document'], max: 3 });
  assert.equal(total, 8);
  assert.equal(recortado, true);
  assert.deepEqual(elegidos.map((m) => m.id), ['d2', 'd1', 'd0'], 'los 3 más nuevos, de más viejo a más nuevo');
  assert.equal(MAX_POR_DEFECTO, 5);
});

test('sin candidatos devuelve lista vacía, no revienta', () => {
  assert.deepEqual(elegirAdjuntos([], {}), { elegidos: [], total: 0, recortado: false, sinId: 0 });
  assert.equal(elegirAdjuntos([texto('t', 1, 'x')], {}).total, 0);
});

test('un adjunto que casa pero NO trae id no se baja y se CUENTA: callarlo dejaba un «no hay adjuntos» falso', () => {
  // WhatsApp Web 2.3000.x renombró la clave del id; el lector leyó null en los 60 mensajes y --bajar decía «ningún adjunto».
  const ms = [{ ...msg('x', 'image', 1), id: null }, { ...msg('y', 'image', 2), id: null }, msg('ok', 'image', 3), { ...msg('z', 'video', 4), id: null }];
  const r = elegirAdjuntos(ms, { tipos: ['image'] });
  assert.deepEqual(r.elegidos.map((m) => m.id), ['ok']);
  assert.equal(r.sinId, 2, 'los dos sin id cuentan; el vídeo sin id no (no es del tipo pedido)');
  const todosSinId = elegirAdjuntos([{ ...msg('a', 'document', 1, 'kit.zip'), id: null }], { tipos: ['document'] });
  assert.equal(todosSinId.total, 0);
  assert.equal(todosSinId.sinId, 1, 'con total 0 y sinId>0 el lector avisa en vez de decir «no hay adjuntos»');
  assert.equal(elegirAdjuntos([{ ...msg('b', 'document', 1, 'otro.pdf'), id: null }], { tipos: ['document'], fichero: 'kit' }).sinId, 0, 'si no pasa el filtro de nombre, tampoco cuenta');
});

test('nombreSeguro: lo que manda un tercero no puede escapar de la carpeta de destino', () => {
  assert.equal(nombreSeguro('../../etc/passwd'), 'passwd');
  assert.equal(nombreSeguro('..\\..\\Windows\\sistema.dll'), 'sistema.dll');
  assert.equal(nombreSeguro('/abs/ruta/kit.zip'), 'kit.zip');
  assert.equal(nombreSeguro('.bashrc'), 'bashrc', 'no deja un fichero oculto');
  assert.equal(nombreSeguro('a\u0000b<c>.zip'), 'a_b_c_.zip', 'caracteres de control y reservados fuera');
});

test('nombreSeguro: sin nombre lo fabrica con tipo, fecha y la extensión del mimetype', () => {
  const n = nombreSeguro(null, { mimetype: 'application/zip', tipo: 'document', t: Date.UTC(2026, 9, 1, 14, 9, 0) / 1000 });
  assert.match(n, /^whatsapp-document-2026-10-01-14-09-00\.zip$/);
  assert.match(nombreSeguro('', { mimetype: 'raro/desconocido', tipo: 'image', t: 0 }), /^whatsapp-image-sin-fecha\.bin$/);
});

test('rutaLibre nunca pisa: añade (1), (2)… y conserva la extensión', () => {
  const ocupados = new Set(['/d/kit.zip', '/d/kit (1).zip']);
  assert.equal(rutaLibre('/d', 'nuevo.zip', (p) => ocupados.has(p)), '/d/nuevo.zip');
  assert.equal(rutaLibre('/d', 'kit.zip', (p) => ocupados.has(p)), '/d/kit (2).zip');
  assert.equal(rutaLibre('/d', 'LEEME', (p) => p === '/d/LEEME'), '/d/LEEME (1)', 'también sin extensión');
});

test('tamanoLegible', () => {
  assert.equal(tamanoLegible(512), '512 B');
  assert.equal(tamanoLegible(880929), '860 KB');
  assert.equal(tamanoLegible(5 * 1024 * 1024), '5.0 MB');
  assert.equal(tamanoLegible(undefined), '?');
});
