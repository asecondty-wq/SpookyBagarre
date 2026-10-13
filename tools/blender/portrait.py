"""Portraits for the menus: head-and-shoulders render of each Tripo model (same normalisation as rig.py), lit in
three points, transparent background. Writes assets/ui/portraits/<id>.png

  run.ps1 portrait.py [--ids frog,micron] [--size 384]
"""
import os
import sys
import json
import math
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "lib"))
import sb  # noqa: E402
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

A = sb.args()
size = int(A.get("size", 384))
rigs = os.path.join(sb.ROOT, "tools", "blender", "rigs")
ids = A.get("ids").split(",") if A.get("ids") else sorted(f[:-5] for f in os.listdir(rigs) if f.endswith(".json"))
outdir = os.path.join(sb.ROOT, "assets", "ui", "portraits")
os.makedirs(outdir, exist_ok=True)

# framing per character: how much below the head top to include (fraction of height) and a slight turn
FRAME = {"bubba": 0.42, "parmesan": 0.55, "tung": 0.36, "shark": 0.5, "pika": 0.62, "catlady": 0.42}


def light(name, kind, loc, energy, color=(1, 1, 1), size_=1.0):
    d = bpy.data.lights.new(name, kind)
    d.energy = energy
    d.color = color
    if kind == 'AREA':
        d.size = size_
    o = bpy.data.objects.new(name, d)
    bpy.context.scene.collection.objects.link(o)
    o.location = Vector(loc)
    o.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    return o


for cid in ids:
    spec = json.load(open(os.path.join(rigs, cid + ".json"), encoding="utf-8"))
    sb.reset()
    h = spec["height"]
    body = sb.load_character(os.path.join(sb.ROOT, "tools", "art", "tripo", cid + ".glb"), h, spec.get("rotz", 0), offset=tuple(spec.get("offset", (0, 0))))
    span = h * FRAME.get(cid, 0.4)
    cz = h - span * 0.47
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = 48
    sc.cycles.use_denoising = True
    sc.render.film_transparent = True
    sc.view_settings.view_transform = 'Standard'
    w = bpy.data.worlds.new("w")
    w.color = (0.08, 0.07, 0.12)
    sc.world = w
    # three-point light, warm key, cold rim (spooky)
    light("key", 'AREA', (-1.6 * h, -2.2 * h, h * 1.3), 560 * h, (1.0, 0.92, 0.82), 1.2 * h)
    light("fill", 'AREA', (1.8 * h, -1.6 * h, h * 0.8), 200 * h, (0.75, 0.8, 1.0), 1.5 * h)
    light("rim", 'AREA', (0.6 * h, 2.2 * h, h * 1.4), 700 * h, (0.6, 0.45, 1.0), 0.8 * h)
    cam = sb.camera("cam", (span * 0.55, -span * 3.2, cz + span * 0.08), (0, 0, cz), ortho=span * 1.08)
    sb.render(cam, os.path.join(outdir, cid + ".png"), size, size)
    sb.log("portrait", cid)
