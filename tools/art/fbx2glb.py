"""FBX (Mixamo...) -> glb, with Blender: blender -b --python tools/art/fbx2glb.py -- <in.fbx> <out.glb>"""
import bpy, sys
a = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=a[0])
for o in bpy.data.objects: print(o.name, o.type)
for ac in bpy.data.actions: print('action', ac.name, ac.frame_range[:])
bpy.ops.export_scene.gltf(filepath=a[1], export_format='GLB', export_animations=True, export_skins=True)
