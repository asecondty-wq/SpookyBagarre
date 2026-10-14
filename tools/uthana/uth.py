"""Small Uthana API helper (text-to-motion). The key comes from the UTHANA_API_KEY environment variable (user scope
on Windows); it is never written anywhere.
  python tools/uthana/uth.py info                       account, balance, prices
  python tools/uthana/uth.py upload <name> <file.glb>   -> character id (keeps the existing skeleton)
  python tools/uthana/uth.py ttm <character_id> <seconds> <model> "<prompt>" <out.glb>
"""
import base64, json, os, subprocess, sys, time, urllib.request, urllib.error, uuid

def key():
    k = os.environ.get('UTHANA_API_KEY')
    if not k:
        k = subprocess.check_output(['powershell', '-NoProfile', '-Command', "[Environment]::GetEnvironmentVariable('UTHANA_API_KEY','User')"]).decode().strip()
    return k

AUTH = 'Basic ' + base64.b64encode((key() + ':').encode()).decode()

def gql(q, v=None):
    req = urllib.request.Request('https://uthana.com/graphql', data=json.dumps({'query': q, 'variables': v or {}}).encode(),
                                 headers={'Content-Type': 'application/json', 'Authorization': AUTH})
    try:
        r = json.loads(urllib.request.urlopen(req, timeout=300).read())
    except urllib.error.HTTPError as e:
        raise SystemExit('Uthana HTTP %d: %s' % (e.code, e.read().decode('utf-8', 'replace')[:800]))
    if r.get('errors'):
        raise SystemExit('Uthana error: ' + json.dumps(r['errors'])[:800])
    return r['data']

def upload(name, path):
    ops = json.dumps({'query': 'mutation ($file: Upload!, $name: String!) { create_character(file: $file, name: $name, auto_rig: false) { character { id name } auto_rig_confidence } }',
                      'variables': {'file': None, 'name': name}})
    b = uuid.uuid4().hex
    parts = []
    for fname, val in (('operations', ops), ('map', json.dumps({'0': ['variables.file']}))):
        parts.append(('--%s\r\nContent-Disposition: form-data; name="%s"\r\n\r\n%s\r\n' % (b, fname, val)).encode())
    data = open(path, 'rb').read()
    parts.append(('--%s\r\nContent-Disposition: form-data; name="0"; filename="%s"\r\nContent-Type: model/gltf-binary\r\n\r\n' % (b, os.path.basename(path))).encode() + data + b'\r\n')
    parts.append(('--%s--\r\n' % b).encode())
    req = urllib.request.Request('https://uthana.com/graphql', data=b''.join(parts), headers={'Content-Type': 'multipart/form-data; boundary=' + b, 'Authorization': AUTH})
    r = json.loads(urllib.request.urlopen(req, timeout=600).read())
    if r.get('errors'):
        raise SystemExit('Uthana error: ' + json.dumps(r['errors'])[:800])
    return r['data']['create_character']

def download(cid, mid, out):
    req = urllib.request.Request('https://uthana.com/motion/file/motion_viewer/%s/%s/glb/motion.glb?fps=30' % (cid, mid), headers={'Authorization': AUTH})
    open(out, 'wb').write(urllib.request.urlopen(req, timeout=300).read())

if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'info':
        print(json.dumps(gql('{ org { id name } payg_prices }'), indent=1)[:1500])
    elif cmd == 'schema':
        t = sys.argv[2]
        print(json.dumps(gql('{ __type(name: "%s") { fields { name type { name kind ofType { name } } } } }' % t), indent=1)[:3000])
    elif cmd == 'upload':
        print(json.dumps(upload(sys.argv[2], sys.argv[3])))
    elif cmd == 'ttm':
        cid, secs, model, prompt, out = sys.argv[2], float(sys.argv[3]), sys.argv[4], sys.argv[5], sys.argv[6]
        d = gql('mutation ($c: String, $l: Float, $m: String, $p: String!) { create_text_to_motion(character_id: $c, length: $l, model: $m, prompt: $p, foot_ik: true) { motion { id name } } }',
                {'c': cid, 'l': secs, 'm': model, 'p': prompt})
        mid = d['create_text_to_motion']['motion']['id']
        download(cid, mid, out)
        print('motion', mid, '->', out)
