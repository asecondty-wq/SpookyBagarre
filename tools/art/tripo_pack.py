"""Packs a Tripo-rigged character for the game: assets/models/<id>.glb with
  - the model scaled to its height, facing +Z (forward), feet on the ground, centred on the hips;
  - the bones renamed to the game's names (hips, spine, chest, neck, head, shoulder/upperarm/forearm/hand.L|R,
    thigh/shin/foot.L|R), the others (twists, toes...) kept;
  - every animation clip on its own skeleton: its own Tripo clips (idle / walk / run bought on it) and the shared
    ones bought on J'san's rig, transferred bone by bone (world rotations relative to the rest pose, in each rig's
    facing frame, so the proportions do not matter), plus mirrored copies of the strikes (name + '__m') so the
    arm on the camera side can throw them.

  python tools/art/tripo_pack.py <id> [<id> ...]
Sources: tools/art/tripo/anims/<id>_rig.glb, <id>_base.glb (own clips), anims_*.glb (shared clips, J'san's rig).
"""
import json
import math
import os
import struct
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'tools', 'art', 'tripo', 'anims')
RIGS = os.path.join(ROOT, 'tools', 'blender', 'rigs')
FPS = 24

ALIAS = {'Hip': 'hips', 'Spine01': 'spine', 'Spine02': 'chest', 'NeckTwist01': 'neck', 'Head': 'head'}
for s in 'LR':
    ALIAS.update({s + '_Clavicle': 'shoulder.' + s, s + '_Upperarm': 'upperarm.' + s, s + '_Forearm': 'forearm.' + s, s + '_Hand': 'hand.' + s,
                  s + '_Thigh': 'thigh.' + s, s + '_Calf': 'shin.' + s, s + '_Foot': 'foot.' + s})

SHARED = ['anims_base', 'anims_fight', 'anims_strikes', 'anims_more', 'anims_extra1', 'anims_extra2', 'anims_extra3',
          'anims_move2', 'anims_fear', 'anims_atk1', 'anims_atk2', 'anims_dance', 'anims_feel', 'anims_emote1', 'anims_emote2', 'anims_emote3',
          'anims_meshy']  # anims_meshy: bought on Skanky's Meshy rig, moved onto J'san's (tools/art/meshy_transfer.py)
# Mixamo animations moved onto J'san's rig (tools/blender/fbx2glb.py, then tools/art/meshy_transfer.py): kept out of the
# public repository (the Mixamo licence allows them in the game, not as files of their own), packed when present
MIXAMO = os.path.join(ROOT, 'tools', 'art', 'mixamo', 'anims_mixamo.glb')


def shared_paths():
    """the files of shared clips (J'san's rig), in order of preference"""
    return [os.path.join(SRC, f + '.glb') for f in SHARED] + [MIXAMO]


SKIP = {'hurt', 'slash'}                  # lying on the floor; the same take as chop
WINDOW = {'chop': (1.2, 3.0), 'volleyball': (1.6, 3.2), 'pitch_baseball': (1.1, 3.0),
          'lift_heavy': (13.5, 19.5), 'heart_pose': (0.9, 3.2), 'cast_a_spell': (1.4, 3.1), 'surf': (0.0, 2.2)}  # seconds kept of the long takes
WINDOW['m_ledgeclimb'] = (0.15, 2.3)
# clips that end standing where the game puts the fighter, higher than they start (the climb over a ledge)
END_REST = {'m_ledgeclimb'}
DRIFT = {'u_tices_firebreath': 0.25}  # clips that travel a lot: only this share of their sliding across the floor is kept
MIRRORED = ['box_01', 'box_02', 'box_03', 'front_kick_01', 'front_kick_02', 'chop', 'pitch_baseball', 'volleyball', 'u_headbutt', 'u_jsan_sic', 'u_lolo_catthrow']


# --- glTF in / out ---------------------------------------------------------------------------------------------
def read_glb(path):
    b = open(path, 'rb').read()
    jl = struct.unpack('<I', b[12:16])[0]
    j = json.loads(b[20:20 + jl])
    off = 20 + jl
    bl = struct.unpack('<I', b[off:off + 4])[0]
    return j, bytearray(b[off + 8:off + 8 + bl])


def accessor(j, bin_, i):
    a = j['accessors'][i]
    v = j['bufferViews'][a['bufferView']]
    n = {'SCALAR': 1, 'VEC3': 3, 'VEC4': 4}[a['type']]
    start = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    # floats, or the normalised int16 keys written by add_quat
    ct = a.get('componentType', 5126)
    dt = {5126: np.float32, 5122: np.int16, 5123: np.uint16, 5120: np.int8, 5121: np.uint8}[ct]
    arr = np.frombuffer(bytes(bin_), dtype=dt, count=a['count'] * n, offset=start).astype(float)
    if ct != 5126 and a.get('normalized'):
        arr = np.maximum(arr / {5122: 32767.0, 5123: 65535.0, 5120: 127.0, 5121: 255.0}[ct], -1.0)
    return arr.reshape(a['count'], n) if n > 1 else arr


def write_glb(path, j, bin_):
    while len(bin_) % 4:
        bin_.append(0)
    j['buffers'] = [{'byteLength': len(bin_)}]
    js = json.dumps(j, separators=(',', ':')).encode('utf-8')
    while len(js) % 4:
        js += b' '
    total = 12 + 8 + len(js) + 8 + len(bin_)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack('<II', len(bin_), 0x004E4942)); f.write(bytes(bin_))


def add_data(j, bin_, arr, typ, minmax=False):
    while len(bin_) % 4:
        bin_.append(0)
    data = np.ascontiguousarray(arr, dtype=np.float32).tobytes()
    off = len(bin_)
    bin_.extend(data)
    j['bufferViews'].append({'buffer': 0, 'byteOffset': off, 'byteLength': len(data)})
    n = {'SCALAR': 1, 'VEC3': 3, 'VEC4': 4}[typ]
    acc = {'bufferView': len(j['bufferViews']) - 1, 'componentType': 5126, 'count': len(data) // (4 * n), 'type': typ}
    if minmax:
        a = np.asarray(arr, dtype=np.float32).reshape(-1, n)
        acc['min'] = a.min(0).tolist(); acc['max'] = a.max(0).tolist()
    j['accessors'].append(acc)
    return len(j['accessors']) - 1


def add_quat(j, bin_, arr):
    """rotation keys as normalised int16 (allowed by glTF for animation rotations): half the size of floats"""
    while len(bin_) % 4:
        bin_.append(0)
    q = np.clip(np.round(np.asarray(arr, dtype=np.float64) * 32767), -32767, 32767).astype(np.int16)
    data = q.tobytes()
    off = len(bin_)
    bin_.extend(data)
    j['bufferViews'].append({'buffer': 0, 'byteOffset': off, 'byteLength': len(data)})
    j['accessors'].append({'bufferView': len(j['bufferViews']) - 1, 'componentType': 5122, 'normalized': True, 'count': len(q), 'type': 'VEC4'})
    return len(j['accessors']) - 1


def used_clips(cid=None):
    """the clips the game plays (read in its code): only those are packed. With cid: the shared ones (poser.js, and
    nativeMoves.js outside the characters' own entries) and that character's own entries only, not the others'
    (every character carried all the clips of all the others before, 16 Oct 2026)"""
    import re
    keep = {'idle', 'walk', 'run', 'hit_to_body_01', 'hit_to_head', 'hit_to_side', 'hit_to_stomach'}
    find = lambda t: set(re.findall(r"clip: '([\w]+)'", t)) | set(re.findall(r"emote: '([\w]+)'", t))
    keep |= find(open(os.path.join(ROOT, 'src/render/rig/poser.js'), encoding='utf-8').read())
    lines = open(os.path.join(ROOT, 'src/render/rig/nativeMoves.js'), encoding='utf-8').read().splitlines()
    # the characters: the names in the EMOTES table (one line each)
    ids, inside = set(), False
    for ln in lines:
        if ln.startswith('export const EMOTES'):
            inside = True
        elif inside and ln.startswith('}'):
            inside = False
        elif inside:
            m = re.match(r'^  (\w+): \{', ln)
            if m:
                ids.add(m.group(1))
    cur, table = None, ''
    for ln in lines:
        if ln.startswith('export const '):
            table = ln.split()[2]
        m = re.match(r'^  (\w+): \{', ln)
        owner = None
        if m:
            owner = m.group(1)
            if not (ln.rstrip().endswith('},') or ln.rstrip().endswith('}')):
                cur = owner
        elif re.match(r'^  \},?\s*$', ln):
            cur = None
        who = owner or cur
        # the emotes stay shared: the menus, the bar and the mini-games play anyone's on anyone
        if cid is None or table == 'EMOTES' or who is None or who == cid or who not in ids:
            keep |= find(ln)
    # the clips other screens play by name (the mini-games' puppets, the bar): every quoted name there is kept
    # (only those that are clips get packed)
    for d in ('src/render/mg', 'src/render', 'src/ui'):
        full = os.path.join(ROOT, d)
        if not os.path.isdir(full):
            continue
        for f in os.listdir(full):
            if f.endswith('.js') and ('mg' in d or f in ('puppets.js', 'barScene.js', 'bar.js', 'barCine.js', 'showcase.js', 'minigameView.js')):
                keep |= set(re.findall(r"'([a-z][a-z0-9_]+)'", open(os.path.join(full, f), encoding='utf-8').read()))
    return keep


# --- quaternions (x, y, z, w) -------------------------------------------------------------------------------------
def qmul(a, b):
    x1, y1, z1, w1 = a; x2, y2, z2, w2 = b
    return np.array([w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2, w1 * y2 - x1 * z2 + y1 * w2 + z1 * x2,
                     w1 * z2 + x1 * y2 - y1 * x2 + z1 * w2, w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2])


def qinv(q):
    return np.array([-q[0], -q[1], -q[2], q[3]])


def qrot(q, v):
    u = q[:3]; w = q[3]
    t = 2 * np.cross(u, v)
    return v + w * t + np.cross(u, t)


def qyaw(a):
    return np.array([0, math.sin(a / 2), 0, math.cos(a / 2)])


def qnorm(q):
    return q / (np.linalg.norm(q) or 1)


# --- skeletons ----------------------------------------------------------------------------------------------------
class Skel:
    def __init__(self, j, bin_):
        self.j, self.bin = j, bin_
        self.nodes = j['nodes']
        self.idx = {n.get('name'): i for i, n in enumerate(self.nodes)}
        self.parent = {i: None for i in range(len(self.nodes))}
        for i, n in enumerate(self.nodes):
            for c in n.get('children', []):
                self.parent[c] = i
        self.order = []
        seen = set()

        def visit(i):
            if i in seen:
                return
            if self.parent[i] is not None:
                visit(self.parent[i])
            seen.add(i); self.order.append(i)
        for i in range(len(self.nodes)):
            visit(i)
        self.joints = set(j['skins'][0]['joints']) if j.get('skins') else {self.idx[n] for n in self.idx if n and n != 'Armature' and not n.startswith('tripo')}
        self.rest = {i: (np.array(n.get('translation', [0, 0, 0]), float), np.array(n.get('rotation', [0, 0, 0, 1]), float),
                         np.array(n.get('scale', [1, 1, 1]), float)) for i, n in enumerate(self.nodes)}

    def world(self, local):
        """local: {i: (T, R, S)} -> {i: (pos, rot)} in the armature's parent space (scale ignored for rotations)"""
        W = {}
        for i in self.order:
            T, R, S = local.get(i, self.rest[i])
            p = self.parent[i]
            if p is None:
                W[i] = (T.copy(), R.copy(), S.copy())
            else:
                pT, pR, pS = W[p]
                W[i] = (pT + qrot(pR, T * pS), qmul(pR, R), pS * S)
        return W

    def name_world(self, local=None):
        W = self.world(local or {})
        return {self.nodes[i].get('name'): W[i] for i in W}

    def facing(self):
        """yaw that turns the rig to face +Z (toes forward, its left on +X)"""
        W = self.name_world()
        fwd = (W['L_ToeBase'][0] - W['L_Foot'][0]) + (W['R_ToeBase'][0] - W['R_Foot'][0])
        left = W['L_Thigh'][0] - W['R_Thigh'][0]
        a1 = math.atan2(fwd[0], fwd[2])            # current heading of the toes
        a2 = math.atan2(-left[2], left[0])         # current heading of the left side (+X when facing +Z)
        # average both estimates (toes splay outward), as angles
        a = math.atan2(math.sin(a1) + math.sin(a2), math.cos(a1) + math.cos(a2))
        return -a

    def hip_height(self):
        W = self.name_world()
        return W['Hip'][0][1] - min(W['L_Foot'][0][1], W['R_Foot'][0][1])


def clips_of(path):
    """animations of a glb: [(name, skeleton, {node: {'rotation': (times, vals), 'translation': ...}}, tmax)]"""
    j, bin_ = read_glb(path)
    sk = Skel(j, bin_)
    out = []
    stem = os.path.splitext(os.path.basename(path))[0]
    for a in j.get('animations', []):
        tr = {}
        tmax = 0
        for ch in a['channels']:
            s = a['samplers'][ch['sampler']]
            t = accessor(j, bin_, s['input']); v = accessor(j, bin_, s['output'])
            tr.setdefault(ch['target']['node'], {})[ch['target']['path']] = (t, v)
            tmax = max(tmax, float(t[-1]))
        out.append((a.get('name') or stem, sk, tr, tmax))
    return out


def sample(track, t, quat):
    times, vals = track
    i = int(np.clip(np.searchsorted(times, t) - 1, 0, len(times) - 2))
    t0, t1 = times[i], times[i + 1]
    k = 0 if t1 <= t0 else min(1, max(0, (t - t0) / (t1 - t0)))
    a, b = vals[i], vals[i + 1]
    if quat:
        if np.dot(a, b) < 0:
            b = -b
        return qnorm(a * (1 - k) + b * k)
    return a * (1 - k) + b * k


MIRROR_SIDE = lambda n: ('R_' + n[2:]) if n.startswith('L_') else ('L_' + n[2:]) if n.startswith('R_') else n


def transfer(src, tracks, tmax, tgt, window=None, mirror=False, recenter=False, drift=1.0, end_rest=False):
    """bake a clip of `src` onto `tgt`: per frame local rotations of tgt's joints (+ hip translation)"""
    t0, t1 = window if window else (0, tmax)
    t1 = min(t1, tmax)
    n = max(2, int(round((t1 - t0) * FPS)) + 1)
    times = np.array([t0 + i / FPS for i in range(n)])
    Ns, Nt = qyaw(src.facing_), qyaw(tgt.facing_)
    srest = src.name_world()
    trest = tgt.name_world()
    hip_k = tgt.hip_height() / src.hip_height()
    names = [tgt.nodes[i]['name'] for i in tgt.order if i in tgt.joints and tgt.nodes[i].get('name') in srest and tgt.nodes[i].get('name') not in ('Root', 'Armature')]
    rot = {nm: [] for nm in names}
    hip = []
    # recenter: some generated takes turn the whole body away; turn them back so the pelvis faces forward on average
    R0 = np.array([0, 0, 0, 1.0])
    if recenter:
        ys, yc = 0.0, 0.0
        for t in times:
            local = {}
            for i, ch in tracks.items():
                T, R, S = src.rest[i]
                if 'rotation' in ch: R = sample(ch['rotation'], t, True)
                if 'translation' in ch: T = sample(ch['translation'], t, False)
                local[i] = (T, R, S)
            sw = src.name_world(local)
            lv = qrot(Ns, sw['L_Thigh'][0] - sw['R_Thigh'][0])
            a = math.atan2(-lv[2], lv[0])
            ys += math.sin(a); yc += math.cos(a)
        R0 = qyaw(-math.atan2(ys, yc))
    for t in times:
        local = {}
        for i, ch in tracks.items():
            T, R, S = src.rest[i]
            if 'rotation' in ch: R = sample(ch['rotation'], t, True)
            if 'translation' in ch: T = sample(ch['translation'], t, False)
            local[i] = (T, R, S)
        sw = src.name_world(local)
        # world rotation deltas from the rest pose, in the facing-normalised frame
        delta = {}
        for nm in names:
            nm_s = MIRROR_SIDE(nm) if mirror else nm
            if nm_s not in sw:
                continue
            d = qmul(R0, qmul(qmul(Ns, qmul(sw[nm_s][1], qinv(srest[nm_s][1]))), qinv(Ns)))
            if mirror:
                d = np.array([d[0], -d[1], -d[2], d[3]])
            delta[nm] = d
        # target world rotations, then local ones
        tw = {}
        for i in tgt.order:
            nm = tgt.nodes[i].get('name')
            p = tgt.parent[i]
            pw = tw[p] if p is not None and p in tw else None
            if nm in delta:
                w = qmul(qmul(qmul(qinv(Nt), delta[nm]), Nt), trest[nm][1])
            else:
                lr = tgt.rest[i][1]
                w = qmul(pw, lr) if pw is not None else (trest[nm][1] if nm in trest else lr)
            tw[i] = w
            if nm in rot:
                loc = qmul(qinv(pw), w) if pw is not None else w
                rot[nm].append(qnorm(loc))
        # hip: displacement from the rest, normalised frame, scaled to the target's legs
        dh = sw['Hip'][0] - srest['Hip'][0]
        dh = qrot(R0, qrot(Ns, dh))
        if mirror:
            dh[0] = -dh[0]
        hip.append(dh * hip_k)
    # in place: the hips keep their bob, but no drift / offset across the floor
    hip = np.array(hip)
    if end_rest:
        hip[:, 1] -= hip[-1, 1]  # ends at the rest height: starts below it
    hip[:, 0] -= hip[:, 0].mean(); hip[:, 2] -= hip[:, 2].mean()
    hip[:, 0] *= drift; hip[:, 2] *= drift
    hp = tgt.parent[tgt.idx['Hip']]
    pW = tgt.name_world()[tgt.nodes[hp]['name']]
    hip = [qrot(qinv(pW[1]), trest['Hip'][0] + qrot(qinv(Nt), dh) - pW[0]) / pW[2] for dh in hip]
    # enforce quaternion continuity
    for nm in rot:
        q = rot[nm]
        for k in range(1, len(q)):
            if np.dot(q[k], q[k - 1]) < 0:
                q[k] = -q[k]
    return times, rot, np.array(hip)


def pack(cid):
    rig_path = os.path.join(SRC, cid + '_rig.glb')
    j, bin_ = read_glb(rig_path)
    tgt = Skel(j, bin_)
    tgt.facing_ = tgt.facing()
    height = json.load(open(os.path.join(RIGS, cid + '.json')))['height'] if os.path.exists(os.path.join(RIGS, cid + '.json')) else 1.8
    # clips: own ones first, shared ones for the rest
    clips = {}
    own = os.path.join(SRC, cid + '_base.glb')
    if os.path.exists(own):
        for (nm, sk, tr, tm) in clips_of(own):
            sk.facing_ = sk.facing(); clips[nm] = (sk, tr, tm)
    for p in shared_paths():
        if not os.path.exists(p):
            continue
        for (nm, sk, tr, tm) in clips_of(p):
            if nm in SKIP or nm in clips:
                continue
            sk.facing_ = sk.facing(); clips[nm] = (sk, tr, tm)
    # signature moves made with Uthana (text to motion, on J'san's Tripo skeleton): tools/art/uthana/<name>.glb
    UDIR = os.path.join(ROOT, 'tools', 'art', 'uthana')
    if os.path.isdir(UDIR):
        for f in sorted(os.listdir(UDIR)):
            stem = f[:-4]
            mine = stem.split('_')[0] in (cid, cid[:4]) or '_' not in stem  # its own ones, and the shared ones (no prefix)
            if f.endswith('.glb') and mine:
                for (nm, sk, tr, tm) in clips_of(os.path.join(UDIR, f)):
                    sk.facing_ = sk.facing(); clips['u_' + nm] = (sk, tr, tm)
    use = used_clips(cid)
    jobs = [(nm, False) for nm in clips if nm in use] + [(nm, True) for nm in MIRRORED if nm in clips and nm in use]
    # bake every clip before touching the target's nodes
    baked = []
    for nm, mir in jobs:
        sk, tr, tm = clips[nm]
        times, rot, hip = transfer(sk, tr, tm, tgt, WINDOW.get(nm), mir, recenter=nm.startswith('u_'), drift=DRIFT.get(nm, 0.2 if nm.endswith('_dash') else 1.0), end_rest=nm in END_REST)
        baked.append((nm + ('__m' if mir else ''), times, rot, hip))
    # normalise: the armature node turns the rig to face +Z, scales it to its height, feet at 0, hips at x=z=0
    arm = tgt.idx.get('Armature')
    W = tgt.name_world()
    mesh_acc = j['accessors'][j['meshes'][0]['primitives'][0]['attributes']['POSITION']]
    raw_h = mesh_acc['max'][1] - mesh_acc['min'][1]
    s = height / raw_h
    yq = qyaw(tgt.facing_)
    hipxz = qrot(yq, W['Hip'][0]) * s
    floor = mesh_acc['min'][1] * s
    an = j['nodes'][arm]
    old_t = np.array(an.get('translation', [0, 0, 0]), float)
    an['rotation'] = yq.tolist()
    an['scale'] = [s, s, s]
    an['translation'] = [-hipxz[0] + 0.0, -floor, -hipxz[2]]
    _ = old_t
    # rename the bones
    for n in j['nodes']:
        if n.get('name') in ALIAS:
            n['name'] = ALIAS[n['name']]
    # animations: only the clips the game plays
    keep = used_clips(cid)
    baked = [c for c in baked if c[0].replace('__m', '') in keep]
    j['animations'] = []
    for nm, times, rot, hip in baked:
        a = {'name': nm, 'channels': [], 'samplers': []}
        ti = add_data(j, bin_, times, 'SCALAR', minmax=True)
        for bone, q in rot.items():
            node = tgt.idx[bone]
            if node == tgt.idx.get('Root'):
                continue
            oi = add_quat(j, bin_, np.array(q))
            a['samplers'].append({'input': ti, 'output': oi, 'interpolation': 'LINEAR'})
            a['channels'].append({'sampler': len(a['samplers']) - 1, 'target': {'node': node, 'path': 'rotation'}})
        oi = add_data(j, bin_, hip, 'VEC3')
        a['samplers'].append({'input': ti, 'output': oi, 'interpolation': 'LINEAR'})
        a['channels'].append({'sampler': len(a['samplers']) - 1, 'target': {'node': tgt.idx['Hip'], 'path': 'translation'}})
        j['animations'].append(a)
    out = os.path.join(ROOT, 'assets', 'models', cid + '.glb')
    write_glb(out, j, bin_)
    print('%-13s %2d clips  height %.2f  facing %+.0f deg  %d KB' % (cid, len(baked), height, math.degrees(tgt.facing_), os.path.getsize(out) // 1024))


if __name__ == '__main__':
    for cid in sys.argv[1:]:
        pack(cid)
