"""Normalise a Tripo prop / creature into a small static GLB for the game: centred on its bounding box, scaled so
its largest side is --size metres, turned by --rotz degrees (face +Z in the game), textures shrunk.

  run.ps1 prop.py --id cat --size 1.0 [--rotz -90] [--tex 512] [--faces 6000]
Writes assets/models/<id>.glb and tools/blender/work/<id>/prop.png (a check render).
"""
import os
import sys
import math
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "lib"))
import sb  # noqa: E402
import bpy  # noqa: E402

A = sb.args()
cid = A["id"]
size = float(A.get("size", 1.0))
rotz = float(A.get("rotz", 0))
src = os.path.join(sb.ROOT, "tools", "art", "tripo", cid + ".glb")
out = os.path.join(sb.ROOT, "assets", "models", cid + ".glb")
work = os.path.join(sb.ROOT, "tools", "blender", "work", cid)
os.makedirs(work, exist_ok=True)

sb.reset()
objs = sb.import_glb(src)
ms = sb.meshes(objs)
for o in ms:
    sb.apply_all(o)
for o in objs:
    if o.type != 'MESH':
        bpy.data.objects.remove(o, do_unlink=True)
body = sb.join(ms, cid)
sb.apply_all(body)
if rotz:
    body.rotation_mode = 'XYZ'
    body.rotation_euler = (0, 0, math.radians(rotz))
    sb.apply_all(body)
mn, mx = sb.bounds(body)
s = size / max(mx.x - mn.x, mx.y - mn.y, mx.z - mn.z)
body.scale = (s, s, s)
sb.apply_all(body)
mn, mx = sb.bounds(body)
body.location = (-(mn.x + mx.x) / 2, -(mn.y + mx.y) / 2, -(mn.z + mx.z) / 2)
sb.apply_all(body)
faces = int(A.get("faces", 0))
if faces and len(body.data.polygons) > faces:
    m = body.modifiers.new("dec", 'DECIMATE')
    m.ratio = faces / len(body.data.polygons)
    sb.select_only([body])
    bpy.ops.object.modifier_apply(modifier="dec")
sb.shrink_textures(int(A.get("tex", 512)))
sb.workbench(textured=True)
cam = sb.camera("cam", (size * 1.4, -size * 2.2, size * 0.6), (0, 0, 0), lens=50)
sb.render(cam, os.path.join(work, "prop.png"), 500, 500)
sb.select_only([body])
want = dict(filepath=out, export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
            export_texcoords=True, export_normals=True, export_materials='EXPORT', export_image_format='JPEG',
            export_jpeg_quality=88, export_image_quality=88, export_animations=False, export_skins=False,
            export_cameras=False, export_lights=False)
props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
bpy.ops.export_scene.gltf(**{k: v for k, v in want.items() if k in props})
sb.log("exported", out, os.path.getsize(out) // 1024, "KB", "faces", len(body.data.polygons))
