"""Paso 4 · Marcar el clic y difuminar datos personales.
Uso:  python 4_marcar_y_difuminar.py CARPETA_TRABAJO pasos.json
pasos.json lo escribe Claude tras mirar los fotogramas. Formato:
[
  {"n": 1, "fotograma": 45, "titulo": "Abrir la empresa del cliente", "fase": "B",
   "clic": [0.52, 0.31],                       # posición del clic, en fracción de la pantalla (x, y) de 0 a 1; null si no hay clic
   "difuminar": [[0.10,0.20,0.40,0.26]],        # recuadros [x1,y1,x2,y2] en fracción; DNI, nombres, domicilios, correos, nº SS, IBAN...
   "texto": "...", "campos": ["N.I.F."], "inicio": 95.0, "fin": 101.0}
]
Genera CARPETA_TRABAJO/guia/img/sNN.jpg (con círculo rojo en el clic y las zonas difuminadas).
OJO: el difuminado se aplica SIEMPRE antes de marcar; revisa luego a ojo cada imagen.
"""
import json, sys, pathlib
from PIL import Image, ImageDraw, ImageFilter

trabajo = pathlib.Path(sys.argv[1])
pasos = json.loads(pathlib.Path(sys.argv[2]).read_text(encoding="utf-8"))
out = trabajo / "guia" / "img"; out.mkdir(parents=True, exist_ok=True)
for p in pasos:
    im = Image.open(trabajo / "fotogramas" / f"f{p['fotograma']:06d}.jpg").convert("RGB")
    W, H = im.size
    for x1, y1, x2, y2 in p.get("difuminar") or []:
        caja = (int(x1*W), int(y1*H), int(x2*W), int(y2*H))
        # Pixelado fuerte (no se puede deshacer): se encoge y se reescala sin suavizar.
        trozo = im.crop(caja); pw = max(1, trozo.width // 14); ph = max(1, trozo.height // 14)
        trozo = trozo.resize((pw, ph), Image.BILINEAR).resize(trozo.size, Image.NEAREST).filter(ImageFilter.GaussianBlur(3))
        im.paste(trozo, caja)
    if p.get("clic"):
        cx, cy = p["clic"][0]*W, p["clic"][1]*H; d = ImageDraw.Draw(im)
        for r, a in ((26, 4), (18, 3)): d.ellipse((cx-r, cy-r, cx+r, cy+r), outline=(230, 30, 30), width=a)
        d.ellipse((cx-5, cy-5, cx+5, cy+5), fill=(230, 30, 30))
    im.save(out / f"s{int(p['n']):02d}.jpg", quality=88)
print("Imágenes en", out)
