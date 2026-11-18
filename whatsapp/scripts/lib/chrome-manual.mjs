// chrome-manual.mjs — plan B cuando el Chrome de WhatsApp Web queda a medias.
// Pasó en Windows (18-nov-2026): el zip de ~190 MB bajaba entero, pero la descompresión de puppeteer se cortaba
// siempre en el mismo sitio (tras D3DCompiler_47.dll) y Chrome no arrancaba. Aquí se baja SOLO el archivo y se
// descomprime con la herramienta del propio sistema (Windows: tar, y si no, Expand-Archive; Mac: ditto; Linux: unzip).
// Solo se usa si la comprobación dice que falta Chrome: si ya está, no toca nada.
import { existsSync, mkdirSync, rmSync, unlinkSync } from 'fs';
import { spawnSync } from 'child_process';

/** Órdenes para descomprimir `zip` en `dest`, en orden de preferencia, según el sistema. */
export function ordenesDescomprimir(zip, dest, plataforma = process.platform) {
  if (plataforma === 'win32') return [
    ['tar', ['-xf', zip, '-C', dest]],
    ['powershell.exe', ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${zip.replace(/'/g, "''")}' -DestinationPath '${dest.replace(/'/g, "''")}' -Force`]],
  ];
  if (plataforma === 'darwin') return [['ditto', ['-x', '-k', zip, dest]], ['unzip', ['-q', '-o', zip, '-d', dest]]];
  return [['unzip', ['-q', '-o', zip, '-d', dest]], ['tar', ['-xf', zip, '-C', dest]]];
}

/**
 * Baja el zip de Chrome y lo descomprime con el sistema. Devuelve {ok, ruta, via, motivo}.
 * `dep` se inyecta en las pruebas: { ejecutable, salida, bajarZip, ejecutar, existe, borrar, plataforma }.
 */
export async function arreglarChrome(dep, log = () => {}) {
  const { ejecutable, salida, bajarZip, ejecutar = spawnSync, existe = existsSync, plataforma = process.platform } = dep;
  const borrar = dep.borrar || ((r) => rmSync(r, { recursive: true, force: true }));
  if (existe(ejecutable)) return { ok: true, ruta: ejecutable, via: 'ya estaba' };
  log(`borro la copia a medias: ${salida}`);
  borrar(salida);
  log('bajo el archivo de Chrome (sin descomprimir)…');
  const zip = await bajarZip();
  if (!zip || !existe(zip)) return { ok: false, motivo: 'no se pudo bajar el archivo de Chrome (¿internet, antivirus?)' };
  (dep.crear || ((r) => mkdirSync(r, { recursive: true })))(salida);
  for (const [cmd, args] of ordenesDescomprimir(zip, salida, plataforma)) {
    log(`descomprimo con ${cmd}…`);
    const r = ejecutar(cmd, args, { stdio: 'ignore', windowsHide: true, timeout: 15 * 60_000 });
    if (r.status === 0 && existe(ejecutable)) {
      try { (dep.borrarZip || unlinkSync)(zip); } catch { /* se queda el zip: no pasa nada */ }
      return { ok: true, ruta: ejecutable, via: cmd };
    }
  }
  return { ok: false, motivo: `descomprimí el archivo y no aparece Chrome en ${ejecutable}. El zip está en ${zip}: descomprímelo a mano en ${salida}` };
}
