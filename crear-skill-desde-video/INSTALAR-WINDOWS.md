# Instalar lo necesario (Windows, una sola vez)

Abre **PowerShell** (menú Inicio → escribe PowerShell). Pega cada línea y pulsa Enter. Cuando termines, **cierra y vuelve a abrir** PowerShell.

1. **ffmpeg** (saca los fotogramas):
   ```powershell
   winget install Gyan.FFmpeg
   ```
2. **Python 3.12** (si no lo tienes; marca «Add python.exe to PATH» si te lo pregunta):
   ```powershell
   winget install Python.Python.3.12
   ```
3. **Librerías de Python** (transcripción local, imágenes):
   ```powershell
   pip install faster-whisper pillow numpy
   ```
   La primera vez que transcribes descarga el modelo de voz (~500 MB para «small»). Después funciona sin internet y **el vídeo no sale de tu ordenador**.

## Comprobar que está todo
```powershell
ffmpeg -version
python --version
python -c "import faster_whisper, PIL, numpy; print('ok')"
```
Los tres deben responder sin error.

## Instalar la skill
1. Copia la carpeta `crear-skill-desde-video` (con `scripts/` y `plantillas/` dentro) a `%USERPROFILE%\.claude\skills\`.
2. Reinicia Claude Code.
3. Escribe `/crear-skill-desde-video` y dale la ruta de tu vídeo.

En Windows se escribe `python`; si no responde, prueba `py`. Si tu ordenador tiene tarjeta gráfica NVIDIA, la transcripción irá más rápido, pero no hace falta.
