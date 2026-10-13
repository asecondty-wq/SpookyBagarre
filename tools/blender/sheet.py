"""Join images into one labelled contact sheet:  python sheet.py <out.png> <img1> <img2> ...  (or a work id)"""
import json
import os
import sys
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if len(sys.argv) == 2:
    work = os.path.join(ROOT, "tools", "blender", "work", sys.argv[1])
    names = json.load(open(os.path.join(work, "rig_out.json")))["poses"]
    files = [os.path.join(work, n) for n in names]
    out = os.path.join(work, "poses.png")
else:
    out, files = sys.argv[1], sys.argv[2:]
ims = [Image.open(f).convert("RGB") for f in files]
w, h = ims[0].size
cols = min(len(ims), 4)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new("RGB", (w * cols, h * rows), (30, 30, 34))
try:
    font = ImageFont.truetype("arial.ttf", 18)
except Exception:
    font = ImageFont.load_default()
for i, (im, f) in enumerate(zip(ims, files)):
    x, y = (i % cols) * w, (i // cols) * h
    sheet.paste(im.resize((w, h)), (x, y))
    d = ImageDraw.Draw(sheet)
    d.text((x + 8, y + 6), os.path.splitext(os.path.basename(f))[0], fill=(255, 255, 0), font=font)
sheet.save(out)
print(out)
