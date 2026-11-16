"""Paso 5 · Construir la guía visual (un solo HTML, con las imágenes dentro).
Uso:  python 5_construir_guia.py CARPETA_TRABAJO guia.json SALIDA.html
guia.json: {"titulo": "...", "intro": "...", "resumen": "...", "fases": [{"id":"A","titulo":"...","descripcion":"..."}],
            "pasos": [... los mismos de pasos.json, con "fase": "A" ...],
            "no_cubierto": "texto opcional", "para_skill": "HTML ya escrito de la sección «Para la skill»"}
La transcripción de cada paso (tramo inicio-fin) sale de transcripcion.json y va plegada.
"""
import base64, html, json, sys, pathlib

trabajo = pathlib.Path(sys.argv[1])
g = json.loads(pathlib.Path(sys.argv[2]).read_text(encoding="utf-8"))
trans = json.loads((trabajo / "transcripcion.json").read_text(encoding="utf-8"))
e = html.escape
def mmss(s): return f"{int(s//60):02d}:{int(s%60):02d}"
def img(n):
    b = (trabajo / "guia" / "img" / f"s{int(n):02d}.jpg").read_bytes()
    return "data:image/jpeg;base64," + base64.b64encode(b).decode()

css = """:root{--bg:#f6f5f2;--s:#fff;--fg:#1f1d1a;--m:#6a6560;--l:#e3e0da;--a:#d9480f;--soft:#fdeee6;--c:#efece6}
@media(prefers-color-scheme:dark){:root{--bg:#17160f;--s:#211f19;--fg:#efece6;--m:#a39d94;--l:#3a372f;--a:#ff8a4c;--soft:#3a2418;--c:#2b2922}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 system-ui,sans-serif;padding:24px 16px 64px}
main{max-width:1100px;margin:0 auto}h1,h2,h3{line-height:1.2}.fase{margin-top:48px;border-top:3px solid var(--a);padding-top:12px}
.paso{display:grid;grid-template-columns:5fr 7fr;gap:24px;padding:22px 0;border-bottom:1px solid var(--l)}
.n{display:inline-block;width:32px;height:32px;border-radius:50%;background:var(--a);color:#fff;text-align:center;line-height:32px;font-weight:700;margin-right:10px}
.campos span{background:var(--c);border-radius:99px;padding:2px 10px;font-size:13px;margin-right:6px;display:inline-block}
img{width:100%;height:auto;border:1px solid var(--l);border-radius:10px}summary{cursor:pointer;color:var(--a)}
time{font-family:monospace;background:var(--c);padding:1px 6px;border-radius:5px;margin-right:6px;font-size:12px}
.caja{background:var(--s);border:1px solid var(--l);border-radius:14px;padding:18px 22px;margin-top:28px}
@media(max-width:800px){.paso{grid-template-columns:1fr}}"""
o = [f"<!doctype html><html lang=es><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><title>{e(g['titulo'])}</title><style>{css}</style><main>",
     f"<h1>{e(g['titulo'])}</h1><p>{e(g.get('intro',''))}</p><p class=caja>Los datos personales del vídeo están difuminados en todas las capturas. Cada clic va marcado en rojo.</p>",
     f"<section class=caja><h2>Resumen del proceso</h2><p>{e(g.get('resumen',''))}</p></section>"]
for f in g["fases"]:
    o.append(f"<section class=fase id='fase-{e(f['id'])}'><h2>Fase {e(f['id'])} · {e(f['titulo'])}</h2><p>{e(f.get('descripcion',''))}</p>")
    for p in [x for x in g["pasos"] if x["fase"] == f["id"]]:
        t = [s for s in trans if p.get("inicio", 0) - 1 <= s["inicio"] <= p.get("fin", 0)]
        tr = "".join(f"<p><time>{mmss(s['inicio'])}</time>{e(s['texto'])}</p>" for s in t)
        campos = "".join(f"<span>{e(c)}</span>" for c in p.get("campos", []))
        o.append(f"<article class=paso id=p{p['n']}><div><h3><span class=n>{p['n']}</span>{e(p['titulo'])}</h3><p>{e(p.get('texto',''))}</p>"
                 + (f"<div class=campos>{campos}</div>" if campos else "")
                 + (f"<details><summary>Transcripción de este tramo</summary>{tr}</details>" if tr else "")
                 + f"<small>Vídeo · {mmss(p.get('inicio',0))}</small></div><figure style=margin:0><img loading=lazy src='{img(p['n'])}' alt='Paso {p['n']}: {e(p['titulo'])}'></figure></article>")
    o.append("</section>")
if g.get("no_cubierto"): o.append(f"<section class=caja><h2>No cubierto en el vídeo</h2><p>{e(g['no_cubierto'])}</p></section>")
o.append(f"<section class=caja id=skill><h2>Para la skill</h2>{g.get('para_skill','')}</section>")
o.append("<section class=caja><h2>Transcripción completa</h2><details><summary>Ver</summary>" +
         "".join(f"<p><time>{mmss(s['inicio'])}</time>{e(s['texto'])}</p>" for s in trans) + "</details></section></main></html>")
pathlib.Path(sys.argv[3]).write_text("\n".join(o), encoding="utf-8")
print("Guía:", sys.argv[3], round(pathlib.Path(sys.argv[3]).stat().st_size/1e6, 1), "MB")
