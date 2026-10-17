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
    # a ground seen from above, tiled and scrolled (ZINZIN BAGARRE): square 1024, its seams blended with its half-shifted
    # copy so the tiles join even when the painting does not quite wrap
    ground = os.path.join(SRC, cid + "_ground.png")
    if os.path.exists(ground):
        im = Image.open(ground).convert("RGB")
        s = min(im.size)
        im = im.crop(((im.width - s) // 2, (im.height - s) // 2, (im.width + s) // 2, (im.height + s) // 2)).resize((1024, 1024), Image.LANCZOS)
        sh = Image.fromarray(__import__("numpy").roll(__import__("numpy").asarray(im), (512, 512), axis=(0, 1)))
        m = Image.new("L", (1024, 1024))
        mp = m.load()
        for y in range(1024):
            for x in range(1024):
                # 0 in the middle (the painting), 1 near the borders (the shifted copy, whose middle is seamless there)
                d = max(abs(x - 511.5), abs(y - 511.5)) / 512
                mp[x, y] = int(255 * min(1, max(0, (d - 0.72) / 0.22)))
        im = Image.composite(sh, im, m)
        im.save(os.path.join(out, "ground.jpg"), quality=86, optimize=True)
        print("ground", cid)
