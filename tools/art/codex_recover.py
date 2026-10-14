"""Codex often generates an image but fails to copy it into the target folder. This finds today's Codex sessions whose
prompt says 'Save it as <name>.png' and copies their generated image into <dir>/<name>.png when it is missing.
Only the sessions that ran in <dir> count (their working directory), so an old image with the same name made for
another folder is never picked; the newest session wins when several made the same name.
  python tools/art/codex_recover.py <dir> [name1 name2 ...]   (only those names when given)"""
import glob, json, os, re, shutil, sys, datetime
dst = sys.argv[1]; only = set(sys.argv[2:])
want = os.path.normcase(os.path.abspath(dst))
home = os.path.expanduser('~')
day = datetime.date.today()
sess = sorted(glob.glob(os.path.join(home, '.codex', 'sessions', '%04d' % day.year, '%02d' % day.month, '%02d' % day.day, 'rollout-*.jsonl')), key=os.path.getmtime, reverse=True)
done = set()
for f in sess:
    sid = re.sub(r'^rollout-[0-9T-]+?-(?=[0-9a-f]{8}-)', '', os.path.basename(f)[:-6])
    txt = open(f, encoding='utf-8', errors='replace').read()
    m = re.search(r'Save it as ([\w-]+)\.png', txt)
    if not m: continue
    cwd = re.search(r'"cwd":"((?:[^"\\]|\\.)*)"', txt)
    if not cwd or os.path.normcase(os.path.abspath(json.loads('"' + cwd.group(1) + '"'))) != want: continue
    name = m.group(1)
    if (only and name not in only) or name in done: continue
    done.add(name)
    target = os.path.join(dst, name + '.png')
    if os.path.exists(target): continue
    imgs = sorted(glob.glob(os.path.join(home, '.codex', 'generated_images', sid, '*.png')), key=os.path.getmtime)
    if imgs:
        shutil.copy(imgs[-1], target); print('recovered', name)
