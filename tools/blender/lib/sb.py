"""Blender helpers for spookyBagarre (run in background mode through tools/blender/run.ps1).

Coordinates: Blender metres, Z up, characters face -Y (Blender front view), +X is the character's LEFT.
The glTF export turns this into the game's space: +Y up, facing +Z, +X left.
"""
import bpy
import bmesh
import json
import math
import os
import sys
from mathutils import Vector, Matrix, Euler, Quaternion

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))


def log(*a):
    print("[SB]", *a, flush=True)


def args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out, i = {}, 0
    while i < len(argv):
        a = argv[i]
        if a.startswith("--"):
            if i + 1 < len(argv) and not argv[i + 1].startswith("--"):
                out[a[2:]] = argv[i + 1]; i += 2
            else:
                out[a[2:]] = True; i += 1
        else:
            i += 1
    return out


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]


def meshes(objs):
    return [o for o in objs if o.type == 'MESH']


def select_only(objs, active=None):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = active or (objs[0] if objs else None)


def join(objs, name):
    select_only(objs)
    if len(objs) > 1:
        bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = name
    return o


def apply_all(obj):
    select_only([obj])
    # unparent while keeping the transform, then apply
    if obj.parent:
        mw = obj.matrix_world.copy()
        obj.parent = None
        obj.matrix_world = mw
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def bounds(obj):
    vs = [obj.matrix_world @ v.co for v in obj.data.vertices]
    mn = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
    mx = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    return mn, mx


def load_character(path, height, rotz=0.0, name="body", offset=(0.0, 0.0)):
    """Import a Tripo GLB, keep one mesh, stand it on z=0, centred, scaled to `height` metres.
    `offset` (x, y) moves it after centring, for bodies whose bounding box is pulled aside (a tail)."""
    objs = import_glb(path)
    ms = meshes(objs)
    for o in ms:
        apply_all(o)
    for o in objs:
        if o.type != 'MESH':
            bpy.data.objects.remove(o, do_unlink=True)
    body = join(ms, name)
    apply_all(body)
    if rotz:
        body.rotation_mode = 'XYZ'  # the glTF importer leaves objects in quaternion mode
        body.rotation_euler = (0, 0, math.radians(rotz))
        apply_all(body)
    mn, mx = bounds(body)
    s = height / (mx.z - mn.z)
    body.scale = (s, s, s)
    apply_all(body)
    mn, mx = bounds(body)
    body.location = (-(mn.x + mx.x) / 2 + offset[0], -(mn.y + mx.y) / 2 + offset[1], -mn.z)
    apply_all(body)
    # merge split vertices so the weights are smooth across UV seams
    select_only([body])
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=0.0005)
    bpy.ops.object.mode_set(mode='OBJECT')
    return body


# --- renders -----------------------------------------------------------------------------------------------------
def camera(name, loc, target, ortho=None, lens=50):
    cd = bpy.data.cameras.new(name)
    cd.lens = lens
    cd.clip_start, cd.clip_end = 0.01, 200
    if ortho:
        cd.type = 'ORTHO'
        cd.ortho_scale = ortho
    cam = bpy.data.objects.new(name, cd)
    bpy.context.scene.collection.objects.link(cam)
    cam.location = Vector(loc)
    d = Vector(target) - cam.location
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    return cam


def workbench(textured=True, bg=(0.72, 0.74, 0.78)):
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sh = sc.display.shading
    sh.light = 'STUDIO'
    sh.color_type = 'TEXTURE' if textured else 'MATERIAL'
    sh.show_object_outline = False
    sh.show_cavity = False
    w = bpy.data.worlds.new("bg")
    w.color = bg
    sc.world = w
    sc.render.film_transparent = False
    sc.view_settings.view_transform = 'Standard'


def render(cam, path, w=800, h=800):
    sc = bpy.context.scene
    sc.camera = cam
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = 'PNG'
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    return path


# --- armature ----------------------------------------------------------------------------------------------------
def expand_spec(bones):
    """Bones ending in .L are mirrored to .R (x negated) unless given explicitly."""
    out, names = [], {b["name"] for b in bones}
    for b in bones:
        out.append(b)
        if b["name"].endswith(".L"):
            rn = b["name"][:-2] + ".R"
            if rn in names:
                continue
            m = dict(b)
            m["name"] = rn
            m["head"] = [-b["head"][0], b["head"][1], b["head"][2]]
            m["tail"] = [-b["tail"][0], b["tail"][1], b["tail"][2]]
            if b.get("parent", "") and b["parent"].endswith(".L"):
                m["parent"] = b["parent"][:-2] + ".R"
            if "roll" in b:
                m["roll"] = -b["roll"]
            out.append(m)
    return out


def build_armature(bones, name="rig"):
    arm_data = bpy.data.armatures.new(name)
    arm = bpy.data.objects.new(name, arm_data)
    bpy.context.scene.collection.objects.link(arm)
    select_only([arm])
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm_data.edit_bones
    for b in bones:
        e = eb.new(b["name"])
        e.head = Vector(b["head"])
        e.tail = Vector(b["tail"])
        e.roll = math.radians(b.get("roll", 0))
        e.use_deform = b.get("deform", True)
    for b in bones:
        if b.get("parent"):
            eb[b["name"]].parent = eb[b["parent"]]
            eb[b["name"]].use_connect = False
    bpy.ops.object.mode_set(mode='OBJECT')
    return arm


def unweighted_count(mesh):
    n = 0
    for v in mesh.data.vertices:
        if sum(g.weight for g in v.groups) < 0.01:
            n += 1
    return n


def bind(mesh, arm, proxy_voxel=0.0):
    """Automatic (heat) weights. If too many vertices stay unweighted, weight a voxel-remeshed proxy
    (closed, clean) and transfer its weights to the real mesh."""
    select_only([mesh, arm], arm)
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    bad = unweighted_count(mesh)
    log("auto weights: unweighted vertices", bad, "/", len(mesh.data.vertices))
    if bad > len(mesh.data.vertices) * 0.01 or proxy_voxel:
        log("using a remeshed proxy for the weights")
        for g in list(mesh.vertex_groups):
            mesh.vertex_groups.remove(g)
        select_only([mesh])
        bpy.ops.object.duplicate()
        proxy = bpy.context.view_layer.objects.active
        proxy.name = "proxy"
        for m in list(proxy.modifiers):
            proxy.modifiers.remove(m)
        proxy.parent = None
        rm = proxy.modifiers.new("remesh", 'REMESH')
        rm.mode = 'VOXEL'
        rm.voxel_size = proxy_voxel or 0.012
        select_only([proxy])
        bpy.ops.object.modifier_apply(modifier="remesh")
        select_only([proxy, arm], arm)
        bpy.ops.object.parent_set(type='ARMATURE_AUTO')
        log("proxy unweighted", unweighted_count(proxy), "/", len(proxy.data.vertices))
        for b in arm.data.bones:
            if b.use_deform and b.name not in mesh.vertex_groups:
                mesh.vertex_groups.new(name=b.name)
        dt = mesh.modifiers.new("dt", 'DATA_TRANSFER')
        dt.object = proxy
        dt.use_vert_data = True
        dt.data_types_verts = {'VGROUP_WEIGHTS'}
        dt.vert_mapping = 'POLYINTERP_NEAREST'
        dt.layers_vgroup_select_src = 'ALL'
        dt.layers_vgroup_select_dst = 'NAME'
        select_only([mesh])
        bpy.ops.object.datalayout_transfer(modifier="dt")
        bpy.ops.object.modifier_move_to_index(modifier="dt", index=0)
        bpy.ops.object.modifier_apply(modifier="dt")
        bpy.data.objects.remove(proxy, do_unlink=True)
        log("after transfer unweighted", unweighted_count(mesh))
    clean_weights(mesh)
    return mesh


def clean_weights(mesh, limit=4):
    select_only([mesh])
    bpy.ops.object.mode_set(mode='WEIGHT_PAINT')
    bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL', limit=limit)
    bpy.ops.object.vertex_group_normalize_all(group_select_mode='ALL', lock_active=False)
    bpy.ops.object.mode_set(mode='OBJECT')


def smooth_weights(mesh, groups, iterations=4, factor=0.5):
    select_only([mesh])
    bpy.ops.object.mode_set(mode='WEIGHT_PAINT')
    for g in groups:
        if g in mesh.vertex_groups:
            mesh.vertex_groups.active_index = mesh.vertex_groups[g].index
            bpy.ops.object.vertex_group_smooth(group_select_mode='ACTIVE', factor=factor, repeat=iterations)
    bpy.ops.object.mode_set(mode='OBJECT')


def pose(arm, rots):
    """rots: {bone: (x, y, z) degrees} in the bone's local space (pose mode)."""
    for pb in arm.pose.bones:
        pb.rotation_mode = 'XYZ'
        pb.rotation_euler = (0, 0, 0)
    for n, r in rots.items():
        if n in arm.pose.bones:
            arm.pose.bones[n].rotation_euler = tuple(math.radians(x) for x in r)
    bpy.context.view_layer.update()


def shrink_textures(size=1024):
    for img in bpy.data.images:
        if img.size[0] > size:
            img.scale(size, size)


def export_skinned(mesh, arm, path):
    select_only([mesh, arm], arm)
    want = dict(filepath=path, export_format='GLB', use_selection=True, export_yup=True, export_apply=False,
                export_texcoords=True, export_normals=True, export_materials='EXPORT', export_image_format='JPEG',
                export_jpeg_quality=90, export_image_quality=90, export_skins=True, export_animations=False,
                export_morph=False, export_cameras=False, export_lights=False, export_def_bones=False,
                export_rest_position_armature=True, export_vertex_color='NONE', export_all_influences=False)
    props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    bpy.ops.export_scene.gltf(**{k: v for k, v in want.items() if k in props})
    log("exported", path, os.path.getsize(path) // 1024, "KB")
