"""Renders a sheet of a packed character's clips (assets/models/<id>.glb from tools/art/tripo_pack.py):
one picture per (clip, time), seen from the game's side (3/4 front), to check the rig and the transfer.

  run.ps1 clipsheet.py --id jsan [--shots idle:0.5,box_01:0.6,...]
Writes tools/blender/work/<id>/clip_<n>.png (and sheet.py-style assembly is done in Python afterwards).
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "lib"))
import sb  # noqa: E402
import bpy  # noqa: E402

A = sb.args()
cid = A["id"]
shots = A.get("shots", "idle:0.4,walk:0.5,run:0.3,box_01:0.62,box_02__m:2.0,front_kick_01:1.05,chop:2.05,hit_to_body_01:0.4").split(",")
src = os.path.join(sb.ROOT, "assets", "models", cid + ".glb")
work = os.path.join(sb.ROOT, "tools", "blender", "work", cid)
os.makedirs(work, exist_ok=True)

sb.reset()
objs = sb.import_glb(src)
arm = next(o for o in objs if o.type == 'ARMATURE')
sb.workbench(True)
# the game looks at the fighter from its side, a little from the front: Blender -Y is the glTF +Z forward
cam = sb.camera("cam", (2.6, -2.6, 1.3), (0, 0, 0.95), ortho=2.4)
for k, s in enumerate(shots):
    name, t = s.split(":")
    act = bpy.data.actions.get(name)
    if not act:
        # glTF importer names actions "<clip>_<armature>" or similar
        act = next((a for a in bpy.data.actions if a.name.startswith(name)), None)
    if not act:
        sb.log("missing", name)
        continue
    arm.animation_data_create()
    arm.animation_data.action = act
    fps = bpy.context.scene.render.fps
    bpy.context.scene.frame_set(int(round(float(t) * fps)))
    sb.render(cam, os.path.join(work, "clip_%02d.png" % k), 420, 520)
    sb.log("shot", k, name, t)
sb.log("done")
