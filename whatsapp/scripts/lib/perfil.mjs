// perfil.mjs — antes de arrancar WhatsApp Web, quita del perfil de Chrome la lista de pestañas que restaura al abrir.
// Por qué: cada arranque deja guardada su pestaña de web.whatsapp.com y Chrome las reabre todas en el siguiente.
// Con varias pestañas de WhatsApp a la vez, WhatsApp dice «abierto en otra ventana», el socket no llega a abrirse y la
// lectura falla con «Waiting failed» (medido el 18-nov-2026: 12 pestañas restauradas tras unos pocos arranques).
// Solo se borra `Default/Sessions` (qué pestañas había abiertas). La sesión de WhatsApp (IndexedDB, Local Storage)
// vive en otras carpetas del perfil y no se toca.
import { existsSync, rmSync } from 'fs';
import { join } from 'path';

export function limpiarPestanasRestauradas(carpetaPerfil) {
  const d = join(carpetaPerfil, 'Default', 'Sessions');
  if (!existsSync(d)) return false;
  rmSync(d, { recursive: true, force: true });
  return true;
}
