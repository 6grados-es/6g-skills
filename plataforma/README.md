# Plataforma del cliente

Web de una sola página, en blanco y negro con el sistema de diseño de 6 Grados, que enseña lo que el cliente va montando: **Conectores**, **Skills y rutinas** y **Apps**. Cada pestaña se desbloquea con su prompt (página de prompts: https://6g-clientes.vercel.app/#/prompts).

- Instalar: `curl -fsSL https://raw.githubusercontent.com/6grados-es/6g-skills/main/plataforma/instalar.sh | bash`
- Abrir: doble clic en «Abrir plataforma» (arranca `servidor.mjs`, el puente local, en http://localhost:4700). Con el puente se encienden y apagan skills de verdad, se pausan y reprograman rutinas y se quitan apps y artefactos; lo que solo puede hacer Claude queda en `cambios.json` hasta que lo aplica.
- Publicada y desde el móvil: con `node servidor.mjs emparejar` y `node servidor.mjs arranque` el puente queda siempre en marcha y conectado al puente web de 6 Grados (`../plataforma-puente`, https://plataforma-puente.vercel.app). En la plataforma, «Abrir en el móvil» da un QR: desde ahí se encienden y apagan skills, se pausan rutinas y se quitan apps, y se hace en el ordenador en segundos. Si el ordenador está apagado, la web lo dice.
- Poner al día una instalada sin tocar sus datos: `curl -fsSL https://raw.githubusercontent.com/6grados-es/6g-skills/main/plataforma/instalar.sh | PLATAFORMA_ACTUALIZAR=1 bash`.
- Qué rellena Claude y cómo: `INSTRUCCIONES.md`. Los datos: `datos.js`. El diseño: `index.html` (no se toca).
- Vista previa: `?desbloqueado=conectores,skills`, `?tema=oscuro`, `?pestana=apps&artefactos=1`.
