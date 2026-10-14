"""Gives the eight first characters (Blender skeletons from tools/blender/rig.py) the same Tripo / Uthana clips as the
eight Tripo-rigged ones, without touching their model: the clips are transferred bone by bone onto their own skeleton
(tails, jaws, bellies, ears and hats keep their springs). No credits: the clips were bought on J'san's rig.

  python tools/art/legacy_pack.py frog micron ...
The original models are kept in tools/art/legacy_old8/<id>.glb (copied there the first time) and always read from there.
"""
import math, os, shutil, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tripo_pack as T  # noqa: E402

ROOT = T.ROOT
KEEP = os.path.join(ROOT, 'tools', 'art', 'legacy_old8')
INV = {v: k for k, v in T.ALIAS.items()}  # game names -> Tripo names


def pack_legacy(cid):
    os.makedirs(KEEP, exist_ok=True)
    src = os.path.join(KEEP, cid + '.glb')
    if not os.path.exists(src):
        shutil.copy(os.path.join(ROOT, 'assets', 'models', cid + '.glb'), src)
    j, bin_ = T.read_glb(src)
    j['animations'] = []
    for n in j['nodes']:
        if n.get('name') in INV:
            n['name'] = INV[n['name']]
    tgt = T.Skel(j, bin_)
    W = tgt.name_world()
    left = W['L_Thigh'][0] - W['R_Thigh'][0]
    tgt.facing_ = -math.atan2(-left[2], left[0])
    use = T.used_clips()
    clips = {}
    for f in T.SHARED:
        p = os.path.join(T.SRC, f + '.glb')
        if not os.path.exists(p):
            continue
        for (nm, sk, tr, tm) in T.clips_of(p):
            if nm in T.SKIP or nm in clips or nm not in use:
                continue
            sk.facing_ = sk.facing(); clips[nm] = (sk, tr, tm)
    # the Uthana moves shared by everyone (no character prefix: the headbutt, ...)
    udir = os.path.join(ROOT, 'tools', 'art', 'uthana')
    for f in sorted(os.listdir(udir)):
        stem = f[:-4]
        if f.endswith('.glb') and ('_' not in stem or stem.split('_')[0] == cid):
            for (nm, sk, tr, tm) in T.clips_of(os.path.join(udir, f)):
                if 'u_' + nm in use:
                    sk.facing_ = sk.facing(); clips['u_' + nm] = (sk, tr, tm)
    jobs = [(nm, False) for nm in clips] + [(nm, True) for nm in T.MIRRORED if nm in clips]
    baked = []
    for nm, mir in jobs:
        sk, tr, tm = clips[nm]
        times, rot, hip = T.transfer(sk, tr, tm, tgt, T.WINDOW.get(nm), mir, recenter=nm.startswith('u_'), drift=T.DRIFT.get(nm, 0.2 if nm.endswith('_dash') else 1.0))
        baked.append((nm + ('__m' if mir else ''), times, rot, hip))
    for nm, times, rot, hip in baked:
        a = {'name': nm, 'channels': [], 'samplers': []}
        ti = T.add_data(j, bin_, times, 'SCALAR', minmax=True)
        for bone, q in rot.items():
            node = tgt.idx[bone]
            oi = T.add_quat(j, bin_, np.array(q))
            a['samplers'].append({'input': ti, 'output': oi, 'interpolation': 'LINEAR'})
            a['channels'].append({'sampler': len(a['samplers']) - 1, 'target': {'node': node, 'path': 'rotation'}})
        oi = T.add_data(j, bin_, hip, 'VEC3')
        a['samplers'].append({'input': ti, 'output': oi, 'interpolation': 'LINEAR'})
        a['channels'].append({'sampler': len(a['samplers']) - 1, 'target': {'node': tgt.idx['Hip'], 'path': 'translation'}})
        j['animations'].append(a)
    for n in j['nodes']:
        if n.get('name') in T.ALIAS:
            n['name'] = T.ALIAS[n['name']]
    out = os.path.join(ROOT, 'assets', 'models', cid + '.glb')
    T.write_glb(out, j, bin_)
    print('%-10s %2d clips  facing %+.0f deg  %d KB' % (cid, len(baked), math.degrees(tgt.facing_), os.path.getsize(out) // 1024), flush=True)


if __name__ == '__main__':
    for c in sys.argv[1:]:
        pack_legacy(c)
