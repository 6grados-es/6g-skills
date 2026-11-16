"""Paso 3 · Hoja de contactos para que Claude MIRE el vídeo sin cargar miles de imágenes.
Uso:  python 3_hoja_contactos.py CARPETA_TRABAJO DESDE_SEG HASTA_SEG [COLUMNAS=4]
Une los fotogramas de ese tramo en una sola imagen con el segundo escrito en cada uno
(contacto_<desde>-<hasta>.jpg). Claude abre esa imagen, ve dónde está el cursor y qué cambia,
y decide qué fotograma es "el del clic". Pide hojas de 20-30 s, no más.
"""
import json, sys, pathlib
from PIL import Image, ImageDraw

trabajo = pathlib.Path(sys.argv[1])
desde, hasta = float(sys.argv[2]), float(sys.argv[3])
cols = int(sys.argv[4]) if len(sys.argv) > 4 else 4
iv = json.loads((trabajo / "cambios.json").read_text())["intervalo"]
n0, n1 = int(desde / iv) + 1, int(hasta / iv) + 1
imgs = []
for n in range(n0, n1 + 1):
    p = trabajo / "fotogramas" / f"f{n:06d}.jpg"
    if p.exists():
        im = Image.open(p).convert("RGB"); im.thumbnail((480, 270))
        ImageDraw.Draw(im).text((6, 4), f"{(n-1)*iv:.1f}s  #{n}", fill=(255, 0, 0))
        imgs.append(im)
if not imgs: sys.exit("No hay fotogramas en ese tramo")
w, h = imgs[0].size
filas = (len(imgs) + cols - 1) // cols
hoja = Image.new("RGB", (w * cols, h * filas), "white")
for i, im in enumerate(imgs): hoja.paste(im, ((i % cols) * w, (i // cols) * h))
salida = trabajo / f"contacto_{int(desde)}-{int(hasta)}.jpg"
hoja.save(salida, quality=85); print(salida)
