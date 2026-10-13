"""Rig a character: import the Tripo model (same normalisation as prep.py), build the skeleton of
tools/blender/rigs/<id>.json, bind it with automatic weights (remeshed proxy if needed), render test poses,
export assets/models/<id>.glb (skinned mesh, no animation: the game animates the bones procedurally).

  run.ps1 rig.py --id frog
"""
import os
import sys
import json
import math
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "lib"))
import sb  # noqa: E402
from mathutils import Vector  # noqa: E402

A = sb.args()
cid = A["id"]
spec = json.load(open(os.path.join(sb.ROOT, "tools", "blender", "rigs", cid + ".json"), encoding="utf-8"))
src = os.path.join(sb.ROOT, "tools", "art", "tripo", cid + ".glb")
work = os.path.join(sb.ROOT, "tools", "blender", "work", cid)
os.makedirs(work, exist_ok=True)
out = os.path.join(sb.ROOT, "assets", "models", cid + ".glb")

sb.reset()
body = sb.load_character(src, spec["height"], spec.get("rotz", 0), offset=tuple(spec.get("offset", (0, 0))))
if spec.get("decimate") and len(body.data.polygons) > spec["decimate"]:
    m = body.modifiers.new("dec", 'DECIMATE')
    m.ratio = spec["decimate"] / len(body.data.polygons)
    sb.select_only([body])
    import bpy
    bpy.ops.object.modifier_apply(modifier="dec")
bones = sb.expand_spec(spec["bones"])
arm = sb.build_armature(bones, "rig")
sb.bind(body, arm, spec.get("proxy", 0))
if spec.get("smooth"):
    sb.smooth_weights(body, spec["smooth"], iterations=spec.get("smoothIter", 3))
sb.clean_weights(body)
sb.shrink_textures(spec.get("tex", 1024))

# test poses (local Euler degrees), rendered three-quarter front
import bpy  # noqa: E402
sb.workbench(textured=True)
h = spec["height"]
cam = sb.camera("cam", (h * 1.35, -h * 2.1, h * 0.75), (0, 0, h * 0.48), lens=50)
tests = {"rest": {}}
tests.update(spec.get("tests", {}))
paths = []
for name, rots in tests.items():
    sb.pose(arm, {k: tuple(v) for k, v in rots.items()})
    p = os.path.join(work, "pose_%s.png" % name)
    sb.render(cam, p, 520, 620)
    paths.append(p)
sb.pose(arm, {})
sb.export_skinned(body, arm, out)
json.dump({"poses": [os.path.basename(p) for p in paths]}, open(os.path.join(work, "rig_out.json"), "w"))
sb.log("done")
