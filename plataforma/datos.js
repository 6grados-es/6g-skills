// Los datos de tu plataforma. Claude rellena este fichero cuando le pegas cada prompt; tú no hace falta que lo toques.
// Reglas de cómo se rellena cada apartado: INSTRUCCIONES.md (en esta misma carpeta).
window.PLATAFORMA = {
  // Marca. Por ahora blanco y negro con el sistema de diseño de 6 Grados. Para adaptarla a tu marca, pídeselo a Claude:
  // cambia el nombre, las siglas (o un logo en `logo`, una dirección https) y los colores (`acento` y `acentoTexto`).
  marca: { nombre: "Tu plataforma", siglas: "T", subtitulo: "", logo: "", acento: "", acentoTexto: "" },
  cliente: "",
  // La dirección de tu plataforma publicada (https://…vercel.app), si la tienes. Sirve para «Abrir en el móvil».
  web: "",
  actualizado: "",
  // Cada pestaña se desbloquea cuando su prompt la rellena. Claude cambia aquí `false` por `true`.
  desbloqueado: { conectores: false, skills: false, apps: false },
  // Nombre del prompt que desbloquea cada pestaña (se muestra en la pestaña bloqueada).
  prompts: {
    conectores: "Plataforma · Conectores",
    skills: "Plataforma · Skills y rutinas",
    apps: "Plataforma · Apps"
  },
  areas: {},
  conectores: [],
  skills: [],
  rutinas: [],
  apps: [],
  // Lo que has quitado del panel (sigue existiendo; solo no se enseña). Claude no lo vuelve a añadir.
  quitadas: []
};
