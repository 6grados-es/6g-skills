# 6g-skills

Skills de Claude de 6 Grados, instalables por el equipo y los clientes. Cada carpeta es una skill con su `SKILL.md`.

## Skills

| Carpeta | Qué hace |
|---|---|
| [`whatsapp/`](whatsapp/) | Lee chats y grupos de tu WhatsApp (enteros o desde una fecha), busca por nombre o por número, descarga documentos, fotos y audios, transcribe notas de voz, recuerda quién es quién (personas frecuentes) y deja mensajes escritos y abiertos en la app para que los envíes tú. Nunca envía ni marca como leído. Funciona en Windows y Mac. Antes se llamaba `whatsapp-borrador` (el modo borrador sigue dentro y no necesita enlazar nada). |

## Cómo instalar una skill

Hace falta **Claude Code** en tu ordenador (aplicación de escritorio o terminal). Estas skills no funcionan en la web de claude.ai.

**Skills sencillas (solo un `SKILL.md`)**: copia la carpeta dentro de la carpeta de skills de Claude y reinicia Claude.

- Mac: `~/.claude/skills/`
- Windows: `%USERPROFILE%\.claude\skills\` (por ejemplo `C:\Users\TU_USUARIO\.claude\skills\`)

**Skills con código, como `whatsapp`**: llevan un instalador que lo deja todo listo.

1. Instala Node.js (versión LTS) desde https://nodejs.org.
2. Descarga este repositorio: botón verde «Code», «Download ZIP», y extrae el ZIP (no hace falta git).
3. Abre una terminal dentro de la carpeta de la skill (en Windows, en el Explorador: clic derecho, «Abrir en Terminal») y lanza:

   ```
   node instalar.mjs
   ```

4. Reinicia Claude Code. Para comprobarlo, pídele lo que dice la descripción de la skill (por ejemplo, «ábreme un WhatsApp para…»).

Cada skill con código trae su propio `README.md` con los pasos para una persona no técnica.

## Cómo añadir una skill

Una carpeta nueva con su `SKILL.md` (nombre igual que la carpeta, descripción que diga cuándo usarla). Sin datos personales de nadie: ni números, ni claves, ni sesiones, ni nombres de clientes. El `.gitignore` excluye lo habitual (`node_modules`, sesiones, `personas-frecuentes.json`, `claves.env`, `.env`), pero se revisa a mano antes de cada subida.
