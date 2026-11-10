// Tests del bloqueo de sesión y de los errores de uso del lector. Nada de esto abre WhatsApp.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tomarBloqueo, pidVivo } from '../lib/bloqueo.mjs';

const lector = fileURLToPath(new URL('../leer-chat.mjs', import.meta.url));
const entorno = (home, extra = {}) => ({ ...process.env, WHATSAPP_SKILL_HOME: home, WHATSAPP_SKILL_TMP: join(home, 'tmp'), ...extra });
const nuevoHome = () => mkdtempSync(join(tmpdir(), 'wa-home-'));
const correr = (args, home, extra) => spawnSync(process.execPath, [lector, ...args], { encoding: 'utf8', env: entorno(home, extra), timeout: 30000 });

test('el bloqueo se toma una vez, se niega a la segunda y se suelta', () => {
  const ruta = join(nuevoHome(), 'sesion.lock');
  const a = tomarBloqueo(ruta);
  assert.equal(a.ok, true);
  // el pid del fichero es el de este proceso (vivo), así que otro intento lo ve ocupado… salvo que sea el mismo pid
  assert.equal(readFileSync(ruta, 'utf8'), String(process.pid));
  a.soltar();
  assert.equal(existsSync(ruta), false);
});

test('un bloqueo de un proceso que ya no existe se retira solo', () => {
  const ruta = join(nuevoHome(), 'sesion.lock');
  writeFileSync(ruta, '2147483646');        // pid que no existe
  assert.equal(pidVivo(2147483646), false);
  const a = tomarBloqueo(ruta);
  assert.equal(a.ok, true);
  a.soltar();
});

test('un bloqueo de OTRO proceso vivo se respeta', async () => {
  const ruta = join(nuevoHome(), 'sesion.lock');
  const hijo = spawn(process.execPath, ['-e', 'setTimeout(()=>{},20000)']);
  try {
    writeFileSync(ruta, String(hijo.pid));
    const a = tomarBloqueo(ruta);
    assert.equal(a.ok, false);
    assert.equal(a.pid, hijo.pid);
  } finally { hijo.kill(); }
});

test('errores de uso: salen con 2 ANTES de abrir nada', () => {
  const casos = [[], ['Marta', '--desde', 'ayer'], ['Marta', '--desde', '2026-13-45'], ['Marta', '--bajar', '--tipo', 'musica'], ['Marta', '--tipo', 'image'],
    ['Marta', '--listar', '--bajar'], ['Marta', '--listar', '50'], ['34600000001@c.us', '--listar'], ['Marta', '--todo', '50'], ['Marta', '--todo', '--desde', '2026-01-01'],
    ['Marta', '--desde', '2026-02-01', '--hasta', '2026-01-01'], ['Marta', 'cincuenta'], ['Marta', '--opcion-rara'], ['0000', '--bajar'], ['Marta', '--max', '3'],
    ['Marta', '--max-paginas', '0', '--todo']];
  for (const c of casos) {
    const r = correr(c, nuevoHome());
    assert.equal(r.status, 2, `args: ${c.join(' ')}\n${r.stderr}`);
    assert.doesNotMatch(r.stderr, /\[sync\]/);
  }
});

test('sin sesión vinculada: salida 10, sin QR y sin abrir Chrome; deja SALIDA/CODIGO en una carpeta temporal', () => {
  const home = nuevoHome();
  const r = correr(['Marta'], home);
  assert.equal(r.status, 10);
  assert.match(r.stderr, /SESIÓN NO VINCULADA/);
  assert.doesNotMatch(r.stderr + r.stdout, /QR #/);
  assert.match(r.stdout, /CODIGO: 10/);
  const carpeta = readdirSync(join(home, 'tmp', 'whatsapp-skill'))[0];
  assert.equal(readFileSync(join(home, 'tmp', 'whatsapp-skill', carpeta, 'codigo.txt'), 'utf8').trim(), '10');
});

test('con la sesión tomada por otro proceso vivo: salida 12 y no toca nada', () => {
  const home = nuevoHome();
  mkdirSync(join(home, 'sesion', 'session-principal'), { recursive: true });
  const hijo = spawn(process.execPath, ['-e', 'setTimeout(()=>{},20000)']);
  try {
    writeFileSync(join(home, 'sesion.lock'), String(hijo.pid));
    const r = correr(['Marta'], home);
    assert.equal(r.status, 12);
    assert.match(r.stderr, /SESIÓN EN USO/);
    assert.equal(readFileSync(join(home, 'sesion.lock'), 'utf8'), String(hijo.pid), 'el bloqueo ajeno sigue intacto');
    assert.ok(existsSync(join(home, 'sesion', 'session-principal')), 'la sesión sigue ahí');
  } finally { hijo.kill(); }
});

test('--borrar-temporales borra las salidas crudas y termina sin abrir la sesión', () => {
  const home = nuevoHome();
  correr(['Marta'], home);                                   // deja una carpeta de salida
  assert.equal(readdirSync(join(home, 'tmp', 'whatsapp-skill')).length, 1);
  const r = correr(['--borrar-temporales'], home);
  assert.equal(r.status, 0);
  assert.equal(readdirSync(join(home, 'tmp', 'whatsapp-skill')).length, 0);
});

test('vincular.mjs se niega (10) si ya hay una sesión guardada, sin arrancar WhatsApp', () => {
  const home = nuevoHome();
  mkdirSync(join(home, 'sesion', 'session-principal'), { recursive: true });
  const vincular = fileURLToPath(new URL('../vincular.mjs', import.meta.url));
  const r = spawnSync(process.execPath, [vincular, '--solo-qr'], { encoding: 'utf8', env: entorno(home), timeout: 30000 });
  assert.equal(r.status, 10);
  assert.match(r.stderr, /YA HAY una sesión/);
  assert.doesNotMatch(r.stderr, /QR #/);
});

test('el lector funciona también cuando se lanza a través de un enlace simbólico (así se instalan las skills)', async () => {
  const { symlinkSync } = await import('node:fs');
  const carpeta = mkdtempSync(join(tmpdir(), 'wa-link-'));
  const enlace = join(carpeta, 'leer-enlace.mjs');
  symlinkSync(lector, enlace);
  const home = nuevoHome();
  const r = spawnSync(process.execPath, [enlace, 'Marta'], { encoding: 'utf8', env: entorno(home), timeout: 30000 });
  assert.equal(r.status, 10, `con el enlace salía sin hacer nada: ${r.stderr}`);
  assert.match(r.stdout, /CODIGO: 10/);
});
