"""Paso 2 · Fotogramas y momentos de cambio.
Uso:  python 2_fotogramas.py VIDEO.mp4 CARPETA_TRABAJO [INTERVALO_SEG=0.5]
- Saca un fotograma cada INTERVALO_SEG (por defecto 0,5 s) en CARPETA_TRABAJO/fotogramas/f000001.jpg ...
  El nº de fotograma n corresponde al segundo (n-1) * INTERVALO.
- Calcula cuánto cambia la pantalla entre fotogramas y guarda en cambios.json los momentos en que
  "pasa algo" (se abre una ventana, se cambia de pantalla). Son los candidatos a ser un paso.
Necesita ffmpeg en el PATH y: pip install pillow numpy
"""
import json, subprocess, sys, pathlib
import numpy as np
from PIL import Image

video, trabajo = sys.argv[1], pathlib.Path(sys.argv[2])
intervalo = float(sys.argv[3]) if len(sys.argv) > 3 else 0.5
carp = trabajo / "fotogramas"
carp.mkdir(parents=True, exist_ok=True)
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", video, "-vf", f"fps={1/intervalo},scale=1280:-2",
                "-q:v", "3", str(carp / "f%06d.jpg")], check=True)
ficheros = sorted(carp.glob("f*.jpg"))
prev, difs = None, []
for i, f in enumerate(ficheros):
    g = np.asarray(Image.open(f).convert("L").resize((160, 90)), dtype=np.int16)
    if prev is not None:
        difs.append((i, float(np.abs(g - prev).mean())))
    prev = g
valores = np.array([d for _, d in difs]) if difs else np.array([0.0])
umbral = max(1.5, float(np.percentile(valores, 90)))
cambios = [{"fotograma": i + 1, "segundo": round(i * intervalo, 2), "cambio": round(d, 2)} for i, d in difs if d >= umbral]
(trabajo / "cambios.json").write_text(json.dumps({"intervalo": intervalo, "total": len(ficheros), "cambios": cambios}, indent=1))
print(f"{len(ficheros)} fotogramas, {len(cambios)} momentos de cambio -> {trabajo/'cambios.json'}")
