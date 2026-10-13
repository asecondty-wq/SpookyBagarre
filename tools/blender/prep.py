"""Import a Tripo model, normalise it (feet on z=0, centred, given height) and render orthographic views
(front, left side, back, top) with their pixel mapping, to read the joint positions for the rig.

  run.ps1 prep.py --id frog --height 1.45 [--rotz 0] [--dx 0 --dy 0]
Writes tools/blender/work/<id>/prep_<view>.png + prep.json (then tools/blender/grid.py draws the grid).
"""
import os
import sys
import json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "lib"))
import sb  # noqa: E402

A = sb.args()
cid = A["id"]
height = float(A.get("height", 1.6))
rotz = float(A.get("rotz", 0))
src = A.get("in") or os.path.join(sb.ROOT, "tools", "art", "tripo", cid + ".glb")
work = os.path.join(sb.ROOT, "tools", "blender", "work", cid)
os.makedirs(work, exist_ok=True)

sb.reset()
body = sb.load_character(src, height, rotz, offset=(float(A.get("dx", 0)), float(A.get("dy", 0))))
mn, mx = sb.bounds(body)
sb.log("bounds", tuple(round(v, 3) for v in mn), tuple(round(v, 3) for v in mx), "verts", len(body.data.vertices), "faces", len(body.data.polygons))
sb.workbench(textured=True)
size = 900
span = max(mx.z - mn.z, mx.x - mn.x, mx.y - mn.y) * 1.12
cz = (mn.z + mx.z) / 2
views = {
    "front": ((0, -20, cz), (0, 0, cz), ("x", "z"), (1, 1)),
    "side": ((20, 0, cz), (0, 0, cz), ("y", "z"), (1, 1)),
    "back": ((0, 20, cz), (0, 0, cz), ("x", "z"), (-1, 1)),
    "top": ((0, 0, 20), (0, 0, 0), ("x", "y"), (1, 1)),
}
meta = {"size": size, "span": span, "cz": cz, "bounds": [list(mn), list(mx)], "views": {}}
for name, (loc, tgt, axes, sgn) in views.items():
    cam = sb.camera("cam_" + name, loc, tgt, ortho=span)
    if name == "top":
        cam.rotation_euler = (0, 0, 0)
    sb.render(cam, os.path.join(work, "prep_%s.png" % name), size, size)
    meta["views"][name] = {"axes": axes, "sign": sgn, "center": [0 if axes[0] != "z" else cz, cz if axes[1] == "z" else 0]}
json.dump(meta, open(os.path.join(work, "prep.json"), "w"), indent=1)
sb.log("done", work)
