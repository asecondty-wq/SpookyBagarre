"""World of Bagarre: the Codex art of tools/art/wob.ps1 (tools/art/wob/) made into game images.
  logo.png        -> assets/ui/wob/logo.png (magenta keyed out, trimmed, 1080 wide) and logo_s.png (570 wide)
  title.png       -> assets/ui/wob/fresco.jpg (16:9, 1956x1101: the menus' grid at 3x, with a margin for the parallax)
  stage_<id>.png  -> assets/ui/stages/<id>.jpg (the arena's thumbnail on the stage select screen, 16:9)

  python tools/art/wob_prep.py
"""
import os
import sys

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC = os.path.join(ROOT, "tools", "art", "wob")
sys.path.insert(0, os.path.dirname(__file__))
from cutout import key  # noqa: E402  (the magenta key of the prop sheets)


def cover(im, w, h):
    """resize and centre-crop to exactly w x h"""
    k = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    x, y = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))


out_ui = os.path.join(ROOT, "assets", "ui", "wob")
out_st = os.path.join(ROOT, "assets", "ui", "stages")
os.makedirs(out_ui, exist_ok=True)
os.makedirs(out_st, exist_ok=True)

p = os.path.join(SRC, "logo.png")
if os.path.exists(p):
    lg = key(Image.open(p))
    bb = lg.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox()
    lg = lg.crop(bb)
    for name, w in (("logo.png", 1080), ("logo_s.png", 570)):
        lg.resize((w, round(lg.height * w / lg.width)), Image.LANCZOS).save(os.path.join(out_ui, name), optimize=True)
    print("logo", lg.size)

p = os.path.join(SRC, "title.png")
if os.path.exists(p):
    cover(Image.open(p).convert("RGB"), 1956, 1101).save(os.path.join(out_ui, "fresco.jpg"), quality=88, optimize=True)
    print("title")

for f in sorted(os.listdir(SRC)):
    if f.startswith("stage_") and f.endswith(".png"):
        sid = f[6:-4]
        cover(Image.open(os.path.join(SRC, f)).convert("RGB"), 384, 216).save(os.path.join(out_st, sid + ".jpg"), quality=86, optimize=True)
        print("thumb", sid)
