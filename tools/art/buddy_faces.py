"""Disc faces for CD-Man and Vinylman (Pandrezz's summons), cut out of the Codex front views
(tools/art/refs/cdman.png, vinylman.png) + a procedural back side for each disc.
Writes tools/art/buddies/<id>_face.png and <id>_back.png (1024 square, round alpha), used by tools/blender/buddies.py.

  python tools/art/buddy_faces.py
"""
import colorsys
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "tools", "art", "buddies")
os.makedirs(OUT, exist_ok=True)
N = 1024
# box of the disc in the 1024x1536 reference (measured on the outline; the vinyl is drawn a little wide)
DISCS = {"cdman": (216, 22, 800, 606), "vinylman": (147, 30, 871, 684)}


def round_mask(n, margin=2):
    m = Image.new("L", (n * 4, n * 4), 0)
    ImageDraw.Draw(m).ellipse((margin * 4, margin * 4, n * 4 - margin * 4, n * 4 - margin * 4), fill=255)
    return m.resize((n, n), Image.LANCZOS)


def polar(n):
    y, x = np.mgrid[0:n, 0:n].astype(np.float32)
    dx, dy = (x - n / 2 + 0.5) / (n / 2), (y - n / 2 + 0.5) / (n / 2)
    return np.hypot(dx, dy), np.arctan2(dy, dx)


for cid, box in DISCS.items():
    im = Image.open(os.path.join(ROOT, "tools", "art", "refs", cid + ".png")).convert("RGB")
    face = im.crop(box).resize((N, N), Image.LANCZOS)
    face = face.filter(ImageFilter.UnsharpMask(radius=1.5, percent=30, threshold=2))
    face.putalpha(round_mask(N))
    face.save(os.path.join(OUT, cid + "_face.png"))

rad, ang = polar(N)
# CD back: the rainbow data side, silver with a conic spectrum and a few bright sheen bands, clear hub
hue = (ang / (2 * np.pi) * 2) % 1.0
h6 = hue * 6.0
c = np.stack([np.clip(np.abs(h6 - 3) - 1, 0, 1), np.clip(2 - np.abs(h6 - 2), 0, 1), np.clip(2 - np.abs(h6 - 4), 0, 1)], -1)
silver = np.array([0.86, 0.87, 0.9], np.float32)
sheen = 0.5 + 0.5 * np.cos(ang * 4)
mixk = (0.22 + 0.3 * sheen)[..., None] * np.clip((rad - 0.3) / 0.15, 0, 1)[..., None]
rgb = silver * (1 - mixk) + (c * 0.75 + 0.25) * mixk
rgb *= (0.85 + 0.15 * np.cos(rad * 90))[..., None] * 0.08 + 0.92
hub = (rad < 0.3)[..., None]
rgb = np.where(hub, np.array([0.8, 0.82, 0.86]) * (0.9 + 0.1 * np.cos(rad * 40))[..., None], rgb)
rgb = np.where((rad < 0.11)[..., None], np.array([0.25, 0.25, 0.28]), rgb)
img = Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8), "RGB")
img.putalpha(round_mask(N))
img.save(os.path.join(OUT, "cdman_back.png"))

# vinyl back: black grooves catching the light on two sides, grey centre ring, black hole
g = 0.05 + 0.03 * (0.5 + 0.5 * np.sin(rad * 420)) + 0.02 * (0.5 + 0.5 * np.sin(rad * 97))
light = np.clip(np.cos(ang * 2 - 0.6), 0, 1) ** 6 * 0.35 * np.clip((rad - 0.32) / 0.1, 0, 1)
v = g + light * (0.6 + 0.4 * np.sin(rad * 420))
rgb = np.stack([v, v, v * 1.08], -1)
rgb = np.where(((rad < 0.3) & (rad > 0.12))[..., None], np.array([0.55, 0.56, 0.58]) * (0.85 + 0.15 * np.cos(rad * 60))[..., None], rgb)
rgb = np.where((rad <= 0.12)[..., None], np.array([0.02, 0.02, 0.02]), rgb)
img = Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8), "RGB")
img.putalpha(round_mask(N))
img.save(os.path.join(OUT, "vinylman_back.png"))
print("faces ->", OUT)
