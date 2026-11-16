"""Paso 1 · Transcripción con marcas de tiempo.
Uso:  python 1_transcribir.py VIDEO.mp4 CARPETA_TRABAJO
Genera CARPETA_TRABAJO/transcripcion.json  ([{inicio, fin, texto}]) y transcripcion.txt.
Usa faster-whisper (local, gratis, sin subir el vídeo a ningún sitio).
"""
import json, sys, pathlib
from faster_whisper import WhisperModel

video, trabajo = sys.argv[1], pathlib.Path(sys.argv[2])
trabajo.mkdir(parents=True, exist_ok=True)
# "small" va bien en un portátil sin tarjeta gráfica; "medium" es más fino pero tarda más.
modelo = WhisperModel(sys.argv[3] if len(sys.argv) > 3 else "small", device="cpu", compute_type="int8")
segmentos, info = modelo.transcribe(video, language="es", vad_filter=True)
filas = []
for s in segmentos:
    filas.append({"inicio": round(s.start, 2), "fin": round(s.end, 2), "texto": s.text.strip()})
    print(f"[{int(s.start//60):02d}:{int(s.start%60):02d}] {s.text.strip()}", flush=True)
(trabajo / "transcripcion.json").write_text(json.dumps(filas, ensure_ascii=False, indent=1), encoding="utf-8")
(trabajo / "transcripcion.txt").write_text(
    "\n".join(f"[{int(f['inicio']//60):02d}:{int(f['inicio']%60):02d}] {f['texto']}" for f in filas), encoding="utf-8")
print("Hecho:", len(filas), "tramos")
