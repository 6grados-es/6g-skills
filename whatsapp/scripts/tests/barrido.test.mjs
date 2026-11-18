import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chatsRecientes, resumenChat, horasValidas, esConversacion } from '../lib/barrido.mjs';

test('solo entran conversaciones con movimiento en la ventana, de la más reciente a la más vieja', () => {
  const chats = [
    { id: '34600000001@c.us', t: 100 }, { id: 'status@broadcast', t: 500 }, { id: '123@newsletter', t: 400 },
    { id: '12345@g.us', t: 300 }, { id: '34600000002@c.us', t: 50 },
  ];
  assert.deepEqual(chatsRecientes(chats, 90).map((c) => c.id), ['12345@g.us', '34600000001@c.us']);
  assert.equal(esConversacion('status@broadcast'), false);
});

test('pendiente = el último mensaje no es del usuario; cuenta audios y transcritos', () => {
  const r = resumenChat([{ t: 1, fromMe: true, tipo: 'chat' }, { t: 2, fromMe: false, tipo: 'ptt', transcripcion: 'hola' }, { t: 3, fromMe: false, tipo: 'audio' }]);
  assert.deepEqual(r, { total: 3, audios: 2, transcritos: 1, pendiente: true, ultimoT: 3 });
  assert.equal(resumenChat([{ t: 1, fromMe: false, tipo: 'chat' }, { t: 2, fromMe: true, tipo: 'chat' }]).pendiente, false);
  assert.equal(resumenChat([]).pendiente, false);
});

test('horas: de 1 a 168, admite «24h» y coma decimal', () => {
  assert.equal(horasValidas('24'), 24);
  assert.equal(horasValidas('24h'), 24);
  assert.equal(horasValidas('1,5'), 1.5);
  assert.equal(horasValidas('0'), null);
  assert.equal(horasValidas('200'), null);
  assert.equal(horasValidas('ayer'), null);
});
