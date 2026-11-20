# Cerebro de 6 Grados: instalador

Instala tu **cerebro**: una carpeta donde Claude va guardando lo que aprende de ti y de tu trabajo (fichas por tema, tus originales y lo que te entrega), para que no tengas que repetírselo en cada chat.

Hay un instalador para cada sistema. Los dos hacen lo mismo.

## Si tienes Mac

Abre la aplicación **Terminal**, pega esta línea y pulsa Intro:

```
curl -fsSL https://raw.githubusercontent.com/6grados-es/6g-skills/main/cerebro/instalar-mac.sh | bash
```

## Si tienes Windows

Abre **PowerShell** (menú Inicio, escribe «PowerShell»), pega esta línea y pulsa Intro:

```
irm https://raw.githubusercontent.com/6grados-es/6g-skills/main/cerebro/instalar-windows.ps1 | iex
```

## O pídeselo a Claude

En la pestaña **Code** de la app de Claude (en un chat normal de claude.ai no puede guardar archivos), pega:

```
Instálame el cerebro de 6 Grados. Mira si este ordenador es Windows o Mac y lanza el instalador que toque de https://github.com/6grados-es/6g-skills/tree/main/cerebro (instalar-mac.sh en Mac, instalar-windows.ps1 en Windows). No leas, muevas ni borres otros archivos míos. Al acabar, dime dónde ha quedado la carpeta y qué hago después.
```

## Qué hace

1. Baja la plantilla del cerebro (https://github.com/6grados-es/cerebro-simple).
2. La copia como carpeta **Cerebro** dentro de la nube que ya uses en el ordenador (iCloud Drive, Google Drive u OneDrive), para que tenga copia de seguridad. Si tienes varias, te pregunta cuál. Si no tienes ninguna, la deja en Documentos y te avisa.
3. Comprueba que ha quedado completa y te dice los siguientes pasos.

No necesita git ni Node. Si ya tienes una carpeta «Cerebro», no la toca. No lee, mueve ni borra ningún otro archivo tuyo.

## Después de instalar

1. Abre la app de Claude y entra en la pestaña **Code**.
2. Elige la carpeta **Cerebro** como carpeta de trabajo y déjala por defecto. Modelo: Sonnet o superior.
3. En un chat nuevo escribe: **Instala mi cerebro**. Te explicará cómo pedir la exportación de tus chats de Claude y los leerá para llenar el cerebro. Para ese paso hace falta Python 3 (el instalador te avisa si no lo tienes).

## Elegir otra carpeta

- Mac: descarga `instalar-mac.sh` y lanza `bash instalar-mac.sh --destino "/ruta/a/la/carpeta"`.
- Windows: descarga `instalar-windows.ps1` y lanza `powershell -ExecutionPolicy Bypass -File instalar-windows.ps1 -Destino "C:\ruta\a\la\carpeta"`.

La carpeta «Cerebro» se crea dentro de la que indiques.
