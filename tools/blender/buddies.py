"""CD-Man and Vinylman, the two friends Pandrezz summons, modelled from primitives (cartoon proportions after the
Codex front views in tools/art/refs) with their disc heads textured by tools/art/buddy_faces.py.

Each model is a small hierarchy the game animates directly (no skin): root "buddy" -> torso, head (origin at the
disc centre, spins about its axis), armL/armR (origin at the shoulder), legL/legR (origin at the hip).

  run.ps1 buddies.py [--ids cdman,vinylman]
Writes assets/models/<id>.glb and tools/blender/work/buddies/<id>.png (check render).
"""
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "lib"))
import sb  # noqa: E402
import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

A = sb.args()
IDS = (A.get("ids") or "cdman,vinylman").split(",")
FACES = os.path.join(sb.ROOT, "tools", "art", "buddies")
WORK = os.path.join(sb.ROOT, "tools", "blender", "work", "buddies")
os.makedirs(WORK, exist_ok=True)


def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c] + [1.0]


MATS = {}


def mat(name, color="#ffffff", rough=0.6, metal=0.0, tex=None):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bs = m.node_tree.nodes["Principled BSDF"]
    bs.inputs["Base Color"].default_value = srgb(color)
    bs.inputs["Roughness"].default_value = rough
    bs.inputs["Metallic"].default_value = metal
    if tex:
        it = m.node_tree.nodes.new("ShaderNodeTexImage")
        it.image = bpy.data.images.load(tex)
        m.node_tree.links.new(it.outputs["Color"], bs.inputs["Base Color"])
    MATS[name] = m
    return m


def finish(o, m, smooth=True, sub=0):
    if sub:
        md = o.modifiers.new("sub", 'SUBSURF')
        md.levels = sub
        md.render_levels = sub
        sb.select_only([o])
        bpy.ops.object.modifier_apply(modifier="sub")
    sb.apply_all(o)
    o.data.materials.clear()
    o.data.materials.append(m)
    if smooth:
        for p in o.data.polygons:
            p.use_smooth = True
    return o


def rbox(name, loc, size, m, bevel=0.32, sub=1):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    sb.apply_all(o)
    md = o.modifiers.new("bev", 'BEVEL')
    md.width = min(size) * bevel
    md.segments = 3
    sb.select_only([o])
    bpy.ops.object.modifier_apply(modifier="bev")
    return finish(o, m, sub=sub)


def ball(name, loc, size, m):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=28, ring_count=14, radius=1, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    return finish(o, m)


def tube(name, p0, p1, r0, r1, m, caps=True):
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=r0, radius2=r1, depth=d.length, location=(p0 + p1) / 2)
    o = bpy.context.active_object
    o.name = name
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
    parts = [finish(o, m)]
    if caps:
        parts.append(ball(name + "_a", p0, (r0, r0, r0), m))
        parts.append(ball(name + "_b", p1, (r1, r1, r1), m))
    return sb.join(parts, name)


def torus(name, loc, R, r, m, rot=(0, 0, 0), scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=32, minor_segments=12, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    return finish(o, m)


def disc(name, center, R, depth, front, back, rim):
    """A disc standing up, facing the front (-Y): front/back caps take the face textures (planar UVs)."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=72, radius=R, depth=depth, location=center, rotation=(math.pi / 2, 0, 0))
    o = bpy.context.active_object
    o.name = name
    sb.apply_all(o)
    md = o.modifiers.new("bev", 'BEVEL')
    md.width = depth * 0.35
    md.segments = 2
    md.limit_method = 'ANGLE'
    sb.select_only([o])
    bpy.ops.object.modifier_apply(modifier="bev")
    o.data.materials.clear()
    for mm in (front, back, rim):
        o.data.materials.append(mm)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    uv = bm.loops.layers.uv.verify()
    cx, cz = center[0], center[2]
    for f in bm.faces:
        n = f.normal
        if n.y < -0.95:
            f.material_index = 0
            for lp in f.loops:
                v = lp.vert.co
                lp[uv].uv = (0.5 + (v.x - cx) / (2 * R), 0.5 + (v.z - cz) / (2 * R))
        elif n.y > 0.95:
            f.material_index = 1
            for lp in f.loops:
                v = lp.vert.co
                lp[uv].uv = (0.5 - (v.x - cx) / (2 * R), 0.5 + (v.z - cz) / (2 * R))
        else:
            f.material_index = 2
            f.smooth = True
            for lp in f.loops:
                lp[uv].uv = (0.5, 0.5)
    bm.to_mesh(o.data)
    bm.free()
    return o


def set_origin(o, p):
    bpy.context.scene.cursor.location = Vector(p)
    sb.select_only([o])
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')


def limb_side(build, x):
    """build(side) for the left limb (x > 0), mirrored for the right"""
    return build(1), build(-1)


def cdman():
    red = mat("hoodie", "#d4141c", 0.75)
    red2 = mat("hoodie_dark", "#a80d14", 0.8)
    navy = mat("shirt", "#1d2440", 0.8)
    jean = mat("jeans", "#25386e", 0.85)
    white = mat("white", "#f2f2f4", 0.55)
    sole = mat("sole", "#8a8d96", 0.7)
    skin = mat("skin", "#f0b48a", 0.55)
    face = mat("cd_face", tex=os.path.join(FACES, "cdman_face.png"), rough=0.25, metal=0.1)
    back = mat("cd_back", tex=os.path.join(FACES, "cdman_back.png"), rough=0.25, metal=0.1)
    rim = mat("cd_rim", "#d8dbe2", 0.2, 0.6)
    torso = [
        rbox("hood_body", (0, 0, 0.79), (0.5, 0.33, 0.46), red, sub=1),
        rbox("band", (0, 0, 0.575), (0.47, 0.31, 0.07), red2, sub=1),
        rbox("pocket", (0, -0.155, 0.68), (0.29, 0.04, 0.13), red2, sub=1),
        torus("hood", (0, 0.05, 1.0), 0.16, 0.075, red, rot=(math.radians(-12), 0, 0), scale=(1.15, 1, 0.8)),
        rbox("hood_back", (0, 0.15, 0.98), (0.3, 0.12, 0.2), red, sub=1),
        tube("neck", (0, 0, 0.97), (0, 0, 1.06), 0.075, 0.07, navy, caps=False),
        rbox("shorts", (0, 0, 0.535), (0.38, 0.26, 0.14), jean, sub=1),
    ]
    for s in (1, -1):
        torso.append(tube("string%d" % s, (0.06 * s, -0.15, 0.97), (0.065 * s, -0.175, 0.85), 0.012, 0.012, white))
        torso.append(ball("aglet%d" % s, (0.065 * s, -0.175, 0.835), (0.018, 0.018, 0.025), white))
    body = sb.join(torso, "torso")
    arms, legs = [], []
    for s in (1, -1):
        sh, el = (0.25 * s, 0.0, 0.93), (0.33 * s, -0.02, 0.66)
        parts = [tube("sleeve%d" % s, sh, el, 0.078, 0.07, red),
                 tube("cuff%d" % s, (0.328 * s, -0.02, 0.675), (0.335 * s, -0.022, 0.64), 0.075, 0.075, red2, caps=False),
                 ball("hand%d" % s, (0.345 * s, -0.03, 0.59), (0.055, 0.05, 0.068), skin),
                 ball("thumb%d" % s, (0.33 * s, -0.07, 0.6), (0.022, 0.022, 0.032), skin)]
        a = sb.join(parts, "armL" if s > 0 else "armR")
        set_origin(a, sh)
        arms.append(a)
        hip = (0.1 * s, 0.0, 0.55)
        parts = [tube("leg%d" % s, hip, (0.115 * s, 0.0, 0.16), 0.09, 0.082, jean),
                 tube("lcuff%d" % s, (0.115 * s, 0, 0.19), (0.116 * s, 0, 0.14), 0.092, 0.094, jean, caps=False),
                 rbox("shoe%d" % s, (0.118 * s, -0.045, 0.075), (0.16, 0.29, 0.13), white, sub=1),
                 rbox("sole%d" % s, (0.118 * s, -0.045, 0.022), (0.17, 0.3, 0.045), sole, sub=1),
                 rbox("lace%d" % s, (0.118 * s, -0.11, 0.135), (0.08, 0.1, 0.02), sole, sub=1)]
        lg = sb.join(parts, "legL" if s > 0 else "legR")
        set_origin(lg, hip)
        legs.append(lg)
    head = disc("head", (0, -0.03, 1.38), 0.34, 0.04, face, back, rim)
    set_origin(head, (0, -0.03, 1.38))
    return [body, head] + arms + legs


def vinylman():
    grey = mat("tee", "#77787d", 0.85)
    grey2 = mat("tee_dark", "#636469", 0.85)
    pants = mat("pants", "#36373c", 0.85)
    shoe = mat("shoe", "#6a6c73", 0.7)
    white = mat("white", "#efeff1", 0.55)
    skin = mat("skin", "#f0b48a", 0.55)
    face = mat("vinyl_face", tex=os.path.join(FACES, "vinylman_face.png"), rough=0.18, metal=0.0)
    back = mat("vinyl_back", tex=os.path.join(FACES, "vinylman_back.png"), rough=0.18, metal=0.0)
    rim = mat("vinyl_rim", "#0c0c0f", 0.3)
    torso = [
        rbox("tee_body", (0, 0, 0.79), (0.47, 0.3, 0.46), grey, sub=1),
        torus("collar", (0, -0.01, 1.01), 0.085, 0.022, grey2, rot=(0, 0, 0), scale=(1.2, 1, 1)),
        tube("neck", (0, 0, 0.98), (0, 0, 1.08), 0.07, 0.065, skin, caps=False),
        rbox("trousers", (0, 0, 0.535), (0.38, 0.26, 0.15), pants, sub=1),
    ]
    body = sb.join(torso, "torso")
    arms, legs = [], []
    for s in (1, -1):
        sh = (0.24 * s, 0.0, 0.94)
        parts = [tube("sleeve%d" % s, sh, (0.29 * s, -0.01, 0.8), 0.088, 0.085, grey),
                 tube("forearm%d" % s, (0.29 * s, -0.01, 0.82), (0.335 * s, -0.025, 0.63), 0.052, 0.047, skin),
                 ball("hand%d" % s, (0.345 * s, -0.03, 0.585), (0.055, 0.05, 0.066), skin),
                 ball("thumb%d" % s, (0.33 * s, -0.07, 0.6), (0.022, 0.022, 0.032), skin)]
        a = sb.join(parts, "armL" if s > 0 else "armR")
        set_origin(a, sh)
        arms.append(a)
        hip = (0.1 * s, 0.0, 0.55)
        parts = [tube("leg%d" % s, hip, (0.115 * s, 0.0, 0.16), 0.092, 0.085, pants),
                 rbox("shoe%d" % s, (0.118 * s, -0.045, 0.075), (0.16, 0.29, 0.13), shoe, sub=1),
                 rbox("toe%d" % s, (0.118 * s, -0.15, 0.06), (0.15, 0.09, 0.09), white, sub=1),
                 rbox("sole%d" % s, (0.118 * s, -0.045, 0.022), (0.17, 0.3, 0.045), white, sub=1)]
        lg = sb.join(parts, "legL" if s > 0 else "legR")
        set_origin(lg, hip)
        legs.append(lg)
    head = disc("head", (0, -0.03, 1.42), 0.38, 0.035, face, back, rim)
    set_origin(head, (0, -0.03, 1.42))
    return [body, head] + arms + legs


for cid in IDS:
    sb.reset()
    MATS.clear()
    parts = cdman() if cid == "cdman" else vinylman()
    root = bpy.data.objects.new("buddy", None)
    bpy.context.scene.collection.objects.link(root)
    for p in parts:
        mw = p.matrix_world.copy()
        p.parent = root
        p.matrix_world = mw
    sb.workbench(textured=True)
    for i, (loc, name) in enumerate([((1.1, -2.6, 1.3), "front"), ((0.0, 3.0, 1.1), "back")]):
        cam = sb.camera("cam" + name, loc, (0, 0, 0.85), lens=50)
        sb.render(cam, os.path.join(WORK, "%s_%s.png" % (cid, name)), 520, 620)
    sb.select_only([root] + parts, root)
    out = os.path.join(sb.ROOT, "assets", "models", cid + ".glb")
    want = dict(filepath=out, export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
                export_texcoords=True, export_normals=True, export_materials='EXPORT', export_image_format='JPEG',
                export_jpeg_quality=90, export_image_quality=90, export_animations=False, export_skins=False,
                export_cameras=False, export_lights=False)
    props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    bpy.ops.export_scene.gltf(**{k: v for k, v in want.items() if k in props})
    sb.log("exported", out, os.path.getsize(out) // 1024, "KB", sum(len(p.data.polygons) for p in parts), "faces")
