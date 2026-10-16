"""Adds a Mixamo clip to the packed game models (assets/models/<id>.glb), free: the clip is moved onto each skeleton
by the same transfer as tools/art/meshy_transfer.py (animated joint positions, never the source's rest pose), so it
works on the Tripo, Blender (legacy) and Meshy rigs alike. A clip of the same name already in the model is replaced.

  1. the FBX to glTF, with Blender (no mesh needed: "Without Skin" or with, both work):
     blender -b --python tools/art/fbx2glb.py -- "assets/anims/Falling Idle.fbx" tools/art/mixamo/falling_idle.glb
  2. python tools/art/mixamo_add.py tools/art/mixamo/falling_idle.glb x_fall [ids...]   (no id: every rigged model)

Run it again after a tripo_pack.py / legacy_pack.py / meshy_pack.py (they rebuild the models without it).
"""
import math
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tripo_pack as T  # noqa: E402
import meshy_transfer as MT  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODELS = os.path.join(ROOT, 'assets', 'models')

# Mixamo bone names (prefix "mixamorig:" / "mixamorigN:" dropped) -> the Tripo names the transfer works with
MIXAMO = {'Hips': 'Hip', 'Spine': 'Waist', 'Spine1': 'Spine01', 'Spine2': 'Spine02', 'Neck': 'NeckTwist01', 'Head': 'Head'}
for s, S in (('Left', 'L'), ('Right', 'R')):
    MIXAMO.update({s + 'Shoulder': S + '_Clavicle', s + 'Arm': S + '_Upperarm', s + 'ForeArm': S + '_Forearm', s + 'Hand': S + '_Hand',
                   s + 'UpLeg': S + '_Thigh', s + 'Leg': S + '_Calf', s + 'Foot': S + '_Foot', s + 'ToeBase': S + '_ToeBase'})


def game_names(j):
    """the game's bone names -> Tripo names, for this model's kind of spine"""
    have = {n.get('name') for n in j['nodes']}
    if 'Waist' in have:          # Tripo: hips > Waist > spine > chest
        spine = {'spine': 'Spine01', 'chest': 'Spine02'}
    elif 'spine1' in have:       # Meshy: hips > spine > spine1 > chest
        spine = {'spine': 'Waist', 'spine1': 'Spine01', 'chest': 'Spine02'}
    else:                        # Blender (legacy): hips > spine > chest
        spine = {'spine': 'Spine01', 'chest': 'Spine02'}
    m = {'hips': 'Hip', 'neck': 'NeckTwist01', 'head': 'Head', **spine}
    for S in 'LR':
        m.update({'shoulder.' + S: S + '_Clavicle', 'upperarm.' + S: S + '_Upperarm', 'forearm.' + S: S + '_Forearm', 'hand.' + S: S + '_Hand',
                  'thigh.' + S: S + '_Thigh', 'shin.' + S: S + '_Calf', 'foot.' + S: S + '_Foot', 'toe.' + S: S + '_ToeBase'})
    return m


def rename(j, table):
    for n in j['nodes']:
        nm = n.get('name')
        if nm in table:
            n['orig'] = nm
            n['name'] = table[nm]


def restore(j):
    for n in j['nodes']:
        if 'orig' in n:
            n['name'] = n.pop('orig')


def drop_animation(j, b, name):
    """removes a clip and its data (accessors and buffer views used by nothing else), the buffer re-packed"""
    keep = [a for a in j.get('animations', []) if a.get('name') != name]
    if len(keep) == len(j.get('animations', [])):
        return b
    gone = [a for a in j['animations'] if a.get('name') == name]
    j['animations'] = keep
    used = set()
    for a in keep:
        for s in a['samplers']:
            used |= {s['input'], s['output']}
    for m in j.get('meshes', []):
        for p in m['primitives']:
            used |= set(p['attributes'].values())
            if 'indices' in p: used.add(p['indices'])
            for t in p.get('targets', []): used |= set(t.values())
    for s in j.get('skins', []):
        if 'inverseBindMatrices' in s: used.add(s['inverseBindMatrices'])
    dead_acc = {i for a in gone for s in a['samplers'] for i in (s['input'], s['output'])} - used
    amap, accs = {}, []
    for i, a in enumerate(j['accessors']):
        if i not in dead_acc:
            amap[i] = len(accs); accs.append(a)
    live_views = {a['bufferView'] for a in accs if 'bufferView' in a} | {im['bufferView'] for im in j.get('images', []) if 'bufferView' in im}
    vmap, views, out = {}, [], bytearray()
    for i, v in enumerate(j['bufferViews']):
        if i not in live_views:
            continue
        while len(out) % 4:
            out.append(0)
        o = v.get('byteOffset', 0)
        data = bytes(b[o:o + v['byteLength']])
        v['byteOffset'] = len(out)
        out.extend(data)
        vmap[i] = len(views); views.append(v)
    for a in accs:
        if 'bufferView' in a: a['bufferView'] = vmap[a['bufferView']]
    for im in j.get('images', []):
        if 'bufferView' in im: im['bufferView'] = vmap[im['bufferView']]
    j['accessors'], j['bufferViews'] = accs, views
    for a in j['animations']:
        for s in a['samplers']:
            s['input'], s['output'] = amap[s['input']], amap[s['output']]
    for m in j.get('meshes', []):
        for p in m['primitives']:
            p['attributes'] = {k: amap[v] for k, v in p['attributes'].items()}
            if 'indices' in p: p['indices'] = amap[p['indices']]
            if 'targets' in p: p['targets'] = [{k: amap[v] for k, v in t.items()} for t in p['targets']]
    for s in j.get('skins', []):
        if 'inverseBindMatrices' in s: s['inverseBindMatrices'] = amap[s['inverseBindMatrices']]
    return out


def source(path):
    j, b = T.read_glb(path)
    for n in j['nodes']:
        nm = (n.get('name') or '').split(':')[-1]
        n['name'] = MIXAMO.get(nm, n.get('name'))
    sk = T.Skel(j, b)
    anims = j.get('animations', [])
    tr, tmax = {}, 0
    a = anims[0]
    for ch in a['channels']:
        s = a['samplers'][ch['sampler']]
        t = T.accessor(j, b, s['input']); v = T.accessor(j, b, s['output'])
        t = t - t[0]   # Blender starts the clip at frame 1
        tr.setdefault(ch['target']['node'], {})[ch['target']['path']] = (t, v)
        tmax = max(tmax, float(t[-1]))
    return sk, tr, tmax


def add(cid, src, tr, tmax, name):
    path = os.path.join(MODELS, cid + '.glb')
    j, b = T.read_glb(path)
    b = drop_animation(j, b, name)
    rename(j, game_names(j))
    tgt = T.Skel(j, b)
    if 'Hip' not in tgt.idx or 'L_Thigh' not in tgt.idx:
        print('  %-14s no biped skeleton, skipped' % cid)
        return

    def facing():
        # the packed models face +Z; measured from the hips (not every rig has toes)
        W = tgt.name_world()
        left = W['L_Thigh'][0] - W['R_Thigh'][0]
        return -math.atan2(-left[2], left[0])
    tgt.facing = facing
    # aim only at bones this skeleton has (the Blender rigs have no toes)
    aim = dict(MT.AIM)
    MT.AIM.clear(); MT.AIM.update({k: v for k, v in aim.items() if v in tgt.idx})
    try:
        X = MT.Transfer(src, tgt, (tr, tmax))
        times, rot, hips = X.bake(tr, tmax)
    finally:
        MT.AIM.clear(); MT.AIM.update(aim)
    a = {'name': name, 'channels': [], 'samplers': []}
    ti = T.add_data(j, b, times, 'SCALAR', minmax=True)
    for bone, q in rot.items():
        if bone not in tgt.idx:
            continue
        oi = T.add_quat(j, b, np.array(q))
        a['samplers'].append({'input': ti, 'output': oi, 'interpolation': 'LINEAR'})
        a['channels'].append({'sampler': len(a['samplers']) - 1, 'target': {'node': tgt.idx[bone], 'path': 'rotation'}})
    oi = T.add_data(j, b, hips, 'VEC3')
    a['samplers'].append({'input': ti, 'output': oi, 'interpolation': 'LINEAR'})
    a['channels'].append({'sampler': len(a['samplers']) - 1, 'target': {'node': tgt.idx['Hip'], 'path': 'translation'}})
    j.setdefault('animations', []).append(a)
    restore(j)
    T.write_glb(path, j, b)
    print('  %-14s %s %.2fs -> %d KB' % (cid, name, tmax, os.path.getsize(path) // 1024))


def main(args):
    src_path, name = args[0], args[1]
    ids = args[2:] or sorted(f[:-4] for f in os.listdir(MODELS) if f.endswith('.glb'))
    src, tr, tmax = source(src_path)
    MT.FPS = 30
    for cid in ids:
        j, _ = T.read_glb(os.path.join(MODELS, cid + '.glb'))
        if not j.get('skins') or not j.get('animations'):
            continue   # props, the unrigged ones, the shiba (four legs)
        add(cid, src, tr, tmax, name)


if __name__ == '__main__':
    main(sys.argv[1:])
