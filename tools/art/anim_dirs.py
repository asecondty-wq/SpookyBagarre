"""Turns the Tripo animation clips (rigged biped, preset:biped:...) into bone directions for our rigs.

Every frame of a clip becomes, for each of our bones (hips, spine, chest, neck, head, shoulder/upperarm/forearm/hand,
thigh/shin/foot, .L and .R), the direction the bone points to in character space (+X = the character's left, +Y up,
+Z forward). Directions do not care about the skeleton's proportions: the same clips drive all the characters
(src/render/rig/clips.js feeds them to the poser, the springs smooth them).

  python tools/art/anim_dirs.py tools/art/tripo/anims/anims_base.glb tools/art/tripo/anims/anims_fight.glb
Writes assets/anims/clips.json.
"""
import json
import math
import os
import struct
import sys

import numpy as np

FPS = 30
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# our bone <- (from joint, to joint) of the Tripo skeleton; to = None: the joint's own rest direction, rotated
PAIRS = {
    'hips': ('Hip', 'Spine01'),
    'spine': ('Spine01', 'Spine02'),
    'chest': ('Spine02', 'NeckTwist01'),
    'neck': ('NeckTwist01', 'Head'),
    'head': ('Head', None),
}
for s in 'LR':
    PAIRS.update({
        'shoulder.' + s: (s + '_Clavicle', s + '_Upperarm'),
        'upperarm.' + s: (s + '_Upperarm', s + '_Forearm'),
        'forearm.' + s: (s + '_Forearm', s + '_Hand'),
        'hand.' + s: (s + '_Hand', None),
        'thigh.' + s: (s + '_Thigh', s + '_Calf'),
        'shin.' + s: (s + '_Calf', s + '_Foot'),
        'foot.' + s: (s + '_Foot', s + '_ToeBase'),
    })
# rest direction of the end joints (no child to aim at): the bone that leads to them
LEAD = {'Head': ('NeckTwist01', 'Head'), 'L_Hand': ('L_Forearm', 'L_Hand'), 'R_Hand': ('R_Forearm', 'R_Hand')}


def read_glb(path):
    b = open(path, 'rb').read()
    jl = struct.unpack('<I', b[12:16])[0]
    j = json.loads(b[20:20 + jl])
    off = 20 + jl
    bl = struct.unpack('<I', b[off:off + 4])[0]
    bin_ = b[off + 8:off + 8 + bl]
    return j, bin_


def accessor(j, bin_, i):
    a = j['accessors'][i]
    v = j['bufferViews'][a['bufferView']]
    n = {'SCALAR': 1, 'VEC3': 3, 'VEC4': 4}[a['type']]
    start = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    arr = np.frombuffer(bin_, dtype=np.float32, count=a['count'] * n, offset=start)
    return arr.reshape(a['count'], n) if n > 1 else arr


def qmul(a, b):
    x1, y1, z1, w1 = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    x2, y2, z2, w2 = b[..., 0], b[..., 1], b[..., 2], b[..., 3]
    return np.stack([w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2, w1 * y2 - x1 * z2 + y1 * w2 + z1 * x2,
                     w1 * z2 + x1 * y2 - y1 * x2 + z1 * w2, w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2], -1)


def qrot(q, v):
    u = q[..., :3]
    w = q[..., 3:4]
    t = 2 * np.cross(u, v)
    return v + w * t + np.cross(u, t)


def qinv(q):
    return q * np.array([-1, -1, -1, 1])


def slerp_track(times, vals, t, is_quat):
    i = np.clip(np.searchsorted(times, t) - 1, 0, len(times) - 2)
    t0, t1 = times[i], times[i + 1]
    k = 0 if t1 <= t0 else np.clip((t - t0) / (t1 - t0), 0, 1)
    a, b = vals[i], vals[i + 1]
    if is_quat:
        if np.dot(a, b) < 0:
            b = -b
        r = a * (1 - k) + b * k
        return r / np.linalg.norm(r)
    return a * (1 - k) + b * k


def world_pose(nodes, local, parents, order):
    W = {}
    for i in order:
        T, R = local[i]
        p = parents[i]
        if p is None:
            W[i] = (T.copy(), R.copy())
        else:
            pT, pR = W[p]
            W[i] = (pT + qrot(pR, T), qmul(pR, R))
    return W


def convert(path, out):
    j, bin_ = read_glb(path)
    nodes = j['nodes']
    name = {n['name']: i for i, n in enumerate(nodes)}
    parents = {i: None for i in range(len(nodes))}
    for i, n in enumerate(nodes):
        for c in n.get('children', []):
            parents[c] = i
    order, seen = [], set()

    def visit(i):
        if i in seen:
            return
        if parents[i] is not None:
            visit(parents[i])
        seen.add(i)
        order.append(i)
    for i in range(len(nodes)):
        visit(i)
    rest_local = {i: (np.array(n.get('translation', [0, 0, 0]), float), np.array(n.get('rotation', [0, 0, 0, 1]), float)) for i, n in enumerate(nodes)}
    RW = world_pose(nodes, rest_local, parents, order)
    P = lambda W, n: W[name[n]][0]
    # character frame from the rest pose: up = world +Y (the Root node turns Z-up into Y-up), forward = the toes
    up = np.array([0, 1.0, 0])
    fwd = (P(RW, 'L_ToeBase') - P(RW, 'L_Foot')) + (P(RW, 'R_ToeBase') - P(RW, 'R_Foot'))
    fwd[1] = 0
    fwd /= np.linalg.norm(fwd)
    left = np.cross(up, fwd)
    if np.dot(P(RW, 'L_Thigh') - P(RW, 'R_Thigh'), left) < 0:
        print('  note: L_ joints are on the right, swapping sides')
        raise SystemExit('unexpected side convention')
    M = np.stack([left, up, fwd])  # world -> character
    hip_h = P(RW, 'Hip')[1] - min(P(RW, 'L_Foot')[1], P(RW, 'R_Foot')[1])
    rest_dir = {}
    for b, (a, c) in PAIRS.items():
        if c is None:
            la, lb = LEAD[a]
            rest_dir[b] = P(RW, lb) - P(RW, la)
        else:
            rest_dir[b] = P(RW, c) - P(RW, a)
    for anim in j['animations']:
        tracks = {}
        tmax = 0
        for ch in anim['channels']:
            s = anim['samplers'][ch['sampler']]
            times = accessor(j, bin_, s['input'])
            vals = accessor(j, bin_, s['output']).astype(float)
            tracks[(ch['target']['node'], ch['target']['path'])] = (times, vals)
            tmax = max(tmax, float(times[-1]))
        n = max(2, int(round(tmax * FPS)) + 1)
        clip = {'frames': n, 'fps': FPS, 'hips': [], 'bones': {b: [] for b in PAIRS}}
        hip0 = P(RW, 'Hip')
        raw = []
        for f in range(n):
            t = min(tmax, f / FPS)
            local = {}
            for i in range(len(nodes)):
                T, R = rest_local[i]
                if (i, 'translation') in tracks:
                    T = slerp_track(*tracks[(i, 'translation')], t, False)
                if (i, 'rotation') in tracks:
                    R = slerp_track(*tracks[(i, 'rotation')], t, True)
                local[i] = (T, R)
            W = world_pose(nodes, local, parents, order)
            hp = (M @ (P(W, 'Hip') - hip0)) / hip_h
            lv = M @ (P(W, 'L_Thigh') - P(W, 'R_Thigh'))  # the pelvis' left, for its yaw
            dirs = {}
            for b, (a, c) in PAIRS.items():
                if c is None:
                    ia = name[a]
                    d = qrot(qmul(W[ia][1], qinv(RW[ia][1])), rest_dir[b])
                else:
                    d = P(W, c) - P(W, a)
                d = M @ d
                dirs[b] = d / (np.linalg.norm(d) or 1)
            raw.append((hp, math.atan2(-lv[2], lv[0]), dirs))
        # some clips turn the whole body (the boxing guard is side-on): turn it back so the pelvis, on average,
        # faces forward (the opponent), and keep the hips over the feet
        yaw = math.atan2(sum(math.sin(r[1]) for r in raw), sum(math.cos(r[1]) for r in raw))
        cy, sy = math.cos(-yaw), math.sin(-yaw)
        rot = lambda v: np.array([v[0] * cy + v[2] * sy, v[1], -v[0] * sy + v[2] * cy])
        mx = sum(r[0][0] for r in raw) / n
        mz = sum(r[0][2] for r in raw) / n
        for hp, _, dirs in raw:
            h = rot(np.array([hp[0] - mx, hp[1], hp[2] - mz]))
            clip['hips'].append([round(float(x), 4) for x in h])
            for b, d in dirs.items():
                clip['bones'][b].append([round(float(x), 3) for x in rot(d)])
        clip['yaw'] = round(math.degrees(yaw), 1)
        out[anim['name']] = clip
        print('  %-20s %3d frames (%.2f s), turned back %.0f deg' % (anim['name'], n, tmax, clip['yaw']))


if __name__ == '__main__':
    out = {}
    for p in sys.argv[1:]:
        print(p)
        convert(p, out)
    dst = os.path.join(ROOT, 'assets', 'anims', 'clips.json')
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with open(dst, 'w', encoding='utf-8') as f:
        json.dump(out, f, separators=(',', ':'))
    print('wrote', dst, os.path.getsize(dst) // 1024, 'KB')
