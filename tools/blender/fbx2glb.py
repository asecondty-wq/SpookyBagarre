# Mixamo animations (FBX, "Without Skin" or with) -> GLB, one clip per file named after the output, for
# tools/art/meshy_transfer.py (which moves them onto the game's skeletons):
#   ./tools/blender/run.ps1 fbx2glb.py --out tools/art/mixamo "new anims/Jump.fbx=m_xjump" "new anims/Backflip.fbx=m_xback" ...
import os
import sys

import bpy

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
out_dir = 'tools/art/mixamo'
pairs = []
i = 0
while i < len(argv):
    if argv[i] == '--out':
        out_dir = argv[i + 1]; i += 2; continue
    src, _, name = argv[i].partition('=')
    pairs.append((src, name or os.path.splitext(os.path.basename(src))[0]))
    i += 1
os.makedirs(out_dir, exist_ok=True)

for src, name in pairs:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=os.path.abspath(src))
    arm = next((o for o in bpy.context.scene.objects if o.type == 'ARMATURE'), None)
    if arm is None:
        print('[SB] %s: no armature' % src)
        continue
    arm.name = 'Armature'
    act = arm.animation_data.action if arm.animation_data else None
    if act is None:
        print('[SB] %s: no animation' % src)
        continue
    act.name = name
    f0, f1 = act.frame_range
    sc = bpy.context.scene
    sc.frame_start, sc.frame_end = int(f0), int(f1)
    # only the skeleton and its motion (a skin, if any, is dropped)
    for o in list(sc.objects):
        if o is not arm:
            bpy.data.objects.remove(o, do_unlink=True)
    out = os.path.abspath(os.path.join(out_dir, name + '.glb'))
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animations=True, export_force_sampling=True)
    fps = sc.render.fps / sc.render.fps_base
    print('[SB] %-40s -> %s  frames %d-%d at %.0f fps, %d bones' % (os.path.basename(src), os.path.basename(out), f0, f1, fps, len(arm.data.bones)))
