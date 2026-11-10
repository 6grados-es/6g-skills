// rutas.mjs — dónde vive cada cosa. Todo en la carpeta de datos del usuario, FUERA de la skill:
// así reinstalar o borrar la skill nunca toca la sesión de WhatsApp ni las personas frecuentes.
//   Mac/Linux: ~/.whatsapp-skill/      Windows: %USERPROFILE%\.whatsapp-skill\
// Se cambia con la variable de entorno WHATSAPP_SKILL_HOME (los tests la apuntan a una carpeta temporal).
import { join } from 'path';
import { homedir, tmpdir } from 'os';
import { mkdirSync } from 'fs';

export const dirDatos = () => process.env.WHATSAPP_SKILL_HOME || join(homedir(), '.whatsapp-skill');
export const dirSesion = () => join(dirDatos(), 'sesion');
export const dirCacheWeb = () => join(dirDatos(), 'cache-web');
export const ficheroPersonas = () => join(dirDatos(), 'personas-frecuentes.json');
export const ficheroClaves = () => join(dirDatos(), 'claves.env');
export const ficheroBloqueo = () => join(dirDatos(), 'sesion.lock');
// Salidas crudas (conversaciones de terceros): carpeta temporal del sistema, no la de datos.
export const dirTemporal = () => join(process.env.WHATSAPP_SKILL_TMP || tmpdir(), 'whatsapp-skill');
export const asegurar = (d) => { mkdirSync(d, { recursive: true }); return d; };
