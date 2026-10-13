"""Turn the Codex stage paintings (tools/art/stages/<id>_top.png, <id>_sky.png) into game textures:
assets/stages/<id>/top.jpg (square, 1024) and sky.jpg (2048 wide, 3:2 kept).

  python tools/art/stage_prep.py [id ...]
"""
import os
import sys
from PIL import Image, ImageFilter, ImageEnhance

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC = os.path.join(ROOT, "tools", "art", "stages")
ids = sys.argv[1:] or sorted({f.rsplit("_", 1)[0] for f in os.listdir(SRC) if f.endswith(".png")})

for cid in ids:
    out = os.path.join(ROOT, "assets", "stages", cid)
    os.makedirs(out, exist_ok=True)
    top = os.path.join(SRC, cid + "_top.png")
    if os.path.exists(top):
        im = Image.open(top).convert("RGB")
        s = min(im.size)
        im = im.crop(((im.width - s) // 2, (im.height - s) // 2, (im.width + s) // 2, (im.height + s) // 2)).resize((1024, 1024), Image.LANCZOS)
        im = im.filter(ImageFilter.UnsharpMask(radius=1.2, percent=40, threshold=2))
        im.save(os.path.join(out, "top.jpg"), quality=88, optimize=True)
        print("top", cid)
    sky = os.path.join(SRC, cid + "_sky.png")
    if os.path.exists(sky):
        im = Image.open(sky).convert("RGB")
        w = 2048
        im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        im = ImageEnhance.Contrast(im).enhance(1.04)
        im.save(os.path.join(out, "sky.jpg"), quality=86, optimize=True)
        print("sky", cid)
