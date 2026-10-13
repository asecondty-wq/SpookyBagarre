"""Draw a labelled metre grid over the orthographic renders of prep.py (front/side/back/top), and join them
into one sheet: tools/blender/work/<id>/grid.png. Run with a normal Python (PIL):  python grid.py <id>"""
import json
import os
import sys
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
cid = sys.argv[1]
work = os.path.join(ROOT, "tools", "blender", "work", cid)
meta = json.load(open(os.path.join(work, "prep.json")))
size, span, cz = meta["size"], meta["span"], meta["cz"]
k = size / span
try:
    font = ImageFont.truetype("arial.ttf", 13)
except Exception:
    font = ImageFont.load_default()


def to_px(view, a, b):
    """world coords on the view's two axes -> pixel"""
    if view == "front":
        return size / 2 + a * k, size / 2 - (b - cz) * k
    if view == "side":
        return size / 2 + a * k, size / 2 - (b - cz) * k
    if view == "back":
        return size / 2 - a * k, size / 2 - (b - cz) * k
    return size / 2 + a * k, size / 2 - b * k  # top: a=x, b=y


tiles = []
for view in ("front", "side", "back", "top"):
    im = Image.open(os.path.join(work, "prep_%s.png" % view)).convert("RGB")
    d = ImageDraw.Draw(im, "RGBA")
    step = 0.05
    n = int(span / step) + 2
    for i in range(-n, n + 1):
        v = i * step
        strong = i % 2 == 0
        col = (255, 0, 80, 150) if strong else (40, 40, 160, 60)
        # vertical lines (first axis)
        x, _ = to_px(view, v, 0)
        d.line([(x, 0), (x, size)], fill=col, width=1)
        # horizontal lines (second axis)
        bval = v + (cz if view != "top" else 0)
        bval = round(bval / step) * step
        _, y = to_px(view, 0, bval)
        d.line([(0, y), (size, y)], fill=col, width=1)
        if strong:
            d.text((x + 2, 2), "%.1f" % v, fill=(255, 255, 0, 255), font=font)
            d.text((2, y - 14), "%.1f" % bval, fill=(0, 255, 255, 255), font=font)
    ax = {"front": "x (gauche perso ->) / z", "side": "y (dos ->) / z", "back": "x (<- gauche perso) / z", "top": "x / y (dos vers le haut)"}[view]
    d.rectangle([0, size - 22, size, size], fill=(0, 0, 0, 180))
    d.text((6, size - 18), view.upper() + "   " + ax, fill=(255, 255, 255, 255), font=font)
    tiles.append(im)
sheet = Image.new("RGB", (size * 2, size * 2))
for i, t in enumerate(tiles):
    sheet.paste(t, ((i % 2) * size, (i // 2) * size))
sheet.save(os.path.join(work, "grid.png"))
print("grid", os.path.join(work, "grid.png"))
