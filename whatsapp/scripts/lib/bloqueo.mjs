// bloqueo.mjs — UN solo proceso a la vez sobre la sesión de WhatsApp (dos a la vez la corrompen).
// Sustituye al `lsof` de la versión de Mac: un fichero con el pid dentro, creado con 'wx' (atómico),
// que funciona igual en Windows, Mac y Linux. Si el pid que figura ya no existe, el bloqueo es viejo y se retira.
import { openSync, writeSync, closeSync, readFileSync, unlinkSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { ficheroBloqueo } from './rutas.mjs';

export function pidVivo(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; }
  catch (e) { return e.code === 'EPERM'; }   // EPERM = existe pero no es nuestro
}

/** @returns {{ok:true, soltar:Function} | {ok:false, pid:number|null}} */
export function tomarBloqueo(ruta = ficheroBloqueo()) {
  mkdirSync(dirname(ruta), { recursive: true });
  for (let intento = 0; intento < 2; intento++) {
    try {
      const fd = openSync(ruta, 'wx');
      writeSync(fd, String(process.pid));
      closeSync(fd);
      let suelto = false;
      const soltar = () => { if (suelto) return; suelto = true; try { if (Number(readFileSync(ruta, 'utf8')) === process.pid) unlinkSync(ruta); } catch { /* ya no está */ } };
      process.on('exit', soltar);
      return { ok: true, soltar };
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      let pid = null;
      try { pid = parseInt(readFileSync(ruta, 'utf8'), 10); } catch { /* se acaba de ir */ }
      if (pid && pidVivo(pid) && pid !== process.pid) return { ok: false, pid };
      try { unlinkSync(ruta); } catch { /* otro lo retiró */ }   // bloqueo huérfano: se retira y se reintenta
    }
  }
  return { ok: false, pid: null };
}
