"""Prints a --shots list for clipsheet.py: each named clip of assets/models/<id>.glb sampled n times over its length.
  python tools/blender/sheetlist.py <id> <n> clip1 clip2 ...   (pure Python, reads the glb)"""
import json, struct, sys
cid, n, names = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
b = open(f'assets/models/{cid}.glb', 'rb').read()
L = struct.unpack('<I', b[12:16])[0]; j = json.loads(b[20:20 + L])
dur = {a['name']: max(j['accessors'][s['input']]['max'][0] for s in a['samplers']) for a in j['animations']}
out = []
for nm in names:
    if nm not in dur: print('missing', nm, file=sys.stderr); continue
    d = dur[nm]
    out += ['%s:%.2f' % (nm, d * (i + 0.5) / n) for i in range(n)]
print(','.join(out))
