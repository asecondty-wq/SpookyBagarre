"""Writes tools/blender/rigs/<id>.json for the seven friends from a few joints read on their measurement grids
(tools/blender/work/<id>/grid.png, front view, metres; x = the character's left, z = up).
  python tools/blender/rigs/make_friends.py [ids...]
Each entry: height, rotz (from yaw.py), shoulder, elbow, wrist, hand tip, hip (x, z), knee, ankle, collar z (neck base).
"""
import json, os, sys

J = {
    'aboueb':       dict(height=1.85, rotz=-95,  sh=(0.21, 1.35), el=(0.37, 1.05), wr=(0.47, 0.85), tip=(0.54, 0.66), hip=(0.11, 0.92), kn=(0.18, 0.47), an=(0.25, 0.17), collar=1.46),
    'tices':        dict(height=1.82, rotz=-105, sh=(0.19, 1.35), el=(0.34, 1.09), wr=(0.45, 0.91), tip=(0.53, 0.75), hip=(0.09, 0.92), kn=(0.18, 0.49), an=(0.25, 0.11), collar=1.43),
    'lolobiscotto': dict(height=1.68, rotz=-100, sh=(0.17, 1.26), el=(0.32, 1.02), wr=(0.43, 0.84), tip=(0.52, 0.71), hip=(0.09, 0.87), kn=(0.16, 0.46), an=(0.23, 0.10), collar=1.33),
    'jsan':         dict(height=1.82, rotz=-101, sh=(0.20, 1.36), el=(0.35, 1.08), wr=(0.45, 0.87), tip=(0.57, 0.73), hip=(0.09, 0.92), kn=(0.17, 0.46), an=(0.25, 0.10), collar=1.44),
    'omfu':         dict(height=1.85, rotz=-78,  sh=(0.21, 1.39), el=(0.39, 1.09), wr=(0.47, 0.86), tip=(0.53, 0.66), hip=(0.10, 0.88), kn=(0.18, 0.47), an=(0.26, 0.10), collar=1.52),
    'nymano':       dict(height=1.80, rotz=-74,  sh=(0.18, 1.31), el=(0.34, 1.02), wr=(0.46, 0.79), tip=(0.54, 0.66), hip=(0.09, 0.88), kn=(0.17, 0.46), an=(0.25, 0.10), collar=1.36),
    'bido':         dict(height=1.90, rotz=-111, sh=(0.30, 1.40), el=(0.44, 1.08), wr=(0.52, 0.88), tip=(0.58, 0.73), hip=(0.12, 0.91), kn=(0.21, 0.50), an=(0.27, 0.17), collar=1.60),
}

TESTS = {
    'bend_x': {'upperarm.L': [50, 0, 0], 'forearm.L': [50, 0, 0], 'thigh.L': [50, 0, 0], 'shin.L': [50, 0, 0]},
    'bend_z': {'upperarm.L': [0, 0, 50], 'upperarm.R': [0, 0, 50], 'spine': [20, 0, 0], 'head': [0, 0, 25]},
    'punch': {'upperarm.L': [-60, 0, 40], 'upperarm.R': [-60, 0, -40], 'forearm.L': [-30, 0, 0], 'forearm.R': [-30, 0, 0], 'chest': [0, -25, 0]},
}


def bone(name, head, tail, parent=None, deform=True):
    b = {'name': name, 'head': [round(v, 3) for v in head], 'tail': [round(v, 3) for v in tail]}
    if parent: b['parent'] = parent
    if not deform: b['deform'] = False
    return b


def make(d):
    H, h, c = d['height'], d['hip'][1], d['collar']
    sx, sz = d['sh']
    spine_top = h + 0.13 + 0.38 * (c - h - 0.13)
    bones = [
        bone('root', (0, 0, 0), (0, 0, 0.2), deform=False),
        bone('hips', (0, 0, h - 0.03), (0, 0, h + 0.13), 'root'),
        bone('spine', (0, 0, h + 0.13), (0, 0, spine_top), 'hips'),
        bone('chest', (0, 0, spine_top), (0, -0.01, c - 0.02), 'spine'),
        bone('neck', (0, -0.01, c - 0.02), (0, -0.03, c + 0.1), 'chest'),
        bone('head', (0, -0.03, c + 0.1), (0, -0.05, H - 0.02), 'neck'),
        bone('shoulder.L', (0.06, 0, sz + 0.06), (sx, 0, sz), 'chest'),
        bone('upperarm.L', (sx, 0, sz), (d['el'][0], 0, d['el'][1]), 'shoulder.L'),
        bone('forearm.L', (d['el'][0], 0, d['el'][1]), (d['wr'][0], -0.04, d['wr'][1]), 'upperarm.L'),
        bone('hand.L', (d['wr'][0], -0.04, d['wr'][1]), (d['tip'][0], -0.07, d['tip'][1]), 'forearm.L'),
        bone('thigh.L', (d['hip'][0], 0, h), (d['kn'][0], 0, d['kn'][1]), 'hips'),
        bone('shin.L', (d['kn'][0], 0, d['kn'][1]), (d['an'][0], 0.06, d['an'][1]), 'thigh.L'),
        bone('foot.L', (d['an'][0], 0.06, d['an'][1]), (d['an'][0] + 0.01, -0.17, 0.04), 'shin.L'),
    ]
    return {'height': H, 'rotz': d['rotz'], 'bones': bones, 'smooth': ['thigh.L', 'thigh.R', 'hips', 'neck'], 'tests': TESTS}


if __name__ == '__main__':
    here = os.path.dirname(os.path.abspath(__file__))
    ids = sys.argv[1:] or list(J)
    for i in ids:
        with open(os.path.join(here, i + '.json'), 'w', encoding='utf-8') as f:
            json.dump(make(J[i]), f, indent=1)
        print('rig', i)
