# Privacidad y reglas, con su porqué

Esta skill lee un WhatsApp que puede contener datos personales de terceros (en una gestoría, de los clientes). Reglas y razones:

- **Solo lectura, nunca envía.** Un mensaje enviado sale con el nombre del usuario y no se puede deshacer. El código no tiene ninguna función de envío; el modo borrador solo abre la app con el texto puesto.
- **Solo lo pedido, por nombre o número.** Leer «por si acaso» es tratar datos que nadie necesita. `--listar` identifica; no explora.
- **Salida cruda en carpeta temporal** (`<carpeta temporal del sistema>/whatsapp-skill/<fecha>/`). Se borra sola a las 24 h y con `node leer-chat.mjs --borrar-temporales`. No se copia a memoria de Claude, notas, resúmenes en ficheros, historial, la nube ni ninguna otra herramienta: son mensajes de terceros. De una conversación puede salir una tarea; se guarda la tarea, no el chat.
- **Adjuntos** a la carpeta que elija el usuario (por defecto Descargas): son suyos desde ese momento; la skill no los copia a ningún otro sitio.
- **Personas frecuentes** (`personas-frecuentes.json`): solo nombre, alias, teléfono, id y fecha. Fichero local; nunca al repositorio ni fuera del ordenador. El `.gitignore` del repo lo excluye.
- **Una sola vinculación.** Escanear dos veces puede desincronizar WhatsApp en los demás dispositivos del usuario; por eso `vincular.mjs` se niega si ya hay sesión y el lector nunca muestra un QR.
- **Librería no oficial.** `whatsapp-web.js` no está autorizada por WhatsApp. El riesgo de restricción del número no es cero; el aviso se enseña antes de enlazar.
- **Base legal.** Tratar mensajes de clientes con ayuda de una herramienta externa, y enviar audios a un servicio de transcripción, puede requerir información a los interesados o un encargado de tratamiento. Eso lo decide el responsable del despacho (su DPO o asesor), no la skill.
- **Desvincular**: móvil, Ajustes, Dispositivos vinculados, cerrar la sesión; y borrar `~/.whatsapp-skill/sesion`.
