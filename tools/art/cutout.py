"""Cut the props out of a Codex prop sheet (props on a flat magenta background):
key out the background (colour sampled on the border), remove the magenta fringe, split the sheet into one
PNG per prop (connected blobs), trimmed and padded. Writes assets/stages/<id>/prop<N>.png + props.json
(width/height ratio of each prop, for the game).

  python tools/art/cutout.py <id> [<id> ...]
"""
import json
import os
import sys
from collections import deque

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def key(img):
    a = np.asarray(img.convert("RGB")).astype(np.float32)
    h, w, _ = a.shape
    border = np.concatenate([a[:4].reshape(-1, 3), a[-4:].reshape(-1, 3), a[:, :4].reshape(-1, 3), a[:, -4:].reshape(-1, 3)])
    bg = np.median(border, axis=0)
    d = np.sqrt(((a - bg) ** 2).sum(axis=2))
    # also anything strongly magenta-ish (red and blue high, green low) is background
    mag = np.minimum(a[..., 0], a[..., 2]) - a[..., 1]
    alpha = np.clip((d - 70) / 60, 0, 1)
    alpha = np.where(mag > 120, np.minimum(alpha, np.clip((170 - mag) / 50, 0, 1)), alpha)
    # despill: pull the magenta tint out of the edges
    m = np.minimum(a[..., 0], a[..., 2])
    spill = np.clip(m - a[..., 1], 0, None) * (1 - alpha) * 0.9 + np.clip(m - a[..., 1] - 40, 0, None) * alpha * 0.5
    a[..., 0] -= spill
    a[..., 2] -= spill
    rgba = np.dstack([np.clip(a, 0, 255), alpha * 255]).astype(np.uint8)
    out = Image.fromarray(rgba, "RGBA")
    # tighten the matte by one pixel (removes the last pink halo)
    al = out.getchannel("A").filter(ImageFilter.MinFilter(3))
    out.putalpha(al)
    return out


def blobs(alpha, f=4, min_area=0.004):
    small = np.asarray(alpha.resize((alpha.width // f, alpha.height // f), Image.BILINEAR)) > 40
    h, w = small.shape
    seen = np.zeros_like(small, dtype=bool)
    out = []
    for y in range(h):
        for x in range(w):
            if not small[y, x] or seen[y, x]:
                continue
            q = deque([(y, x)]); seen[y, x] = True
            x0 = x1 = x; y0 = y1 = y; n = 0
            while q:
                cy, cx = q.popleft(); n += 1
                x0, x1, y0, y1 = min(x0, cx), max(x1, cx), min(y0, cy), max(y1, cy)
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < h and 0 <= nx < w and small[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True; q.append((ny, nx))
            if n > min_area * h * w:
                out.append([x0 * f, y0 * f, (x1 + 1) * f, (y1 + 1) * f, n])
    # merge boxes that overlap (a prop broken in two pieces)
    merged = True
    while merged:
        merged = False
        for i in range(len(out)):
            for j in range(i + 1, len(out)):
                a, b = out[i], out[j]
                if a[0] < b[2] + 8 and b[0] < a[2] + 8 and a[1] < b[3] + 8 and b[1] < a[3] + 8:
                    out[i] = [min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3]), a[4] + b[4]]
                    out.pop(j); merged = True; break
            if merged:
                break
    out.sort(key=lambda b: (b[1] // 200, b[0]))
    return out


for cid in sys.argv[1:]:
    src = os.path.join(ROOT, "tools", "art", "stages", cid + "_props.png")
    if not os.path.exists(src):
        print("missing", src); continue
    img = key(Image.open(src))
    dst = os.path.join(ROOT, "assets", "stages", cid)
    os.makedirs(dst, exist_ok=True)
    meta = []
    for i, (x0, y0, x1, y1, _) in enumerate(blobs(img.getchannel("A"))):
        pad = 6
        crop = img.crop((max(0, x0 - pad), max(0, y0 - pad), min(img.width, x1 + pad), min(img.height, y1 + pad)))
        bb = crop.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox()
        if bb:
            crop = crop.crop(bb)
        s = 512 / max(crop.size)
        if s < 1:
            crop = crop.resize((max(1, round(crop.width * s)), max(1, round(crop.height * s))), Image.LANCZOS)
        name = "prop%d.png" % i
        crop.save(os.path.join(dst, name), optimize=True)
        meta.append({"file": name, "w": crop.width, "h": crop.height})
    json.dump(meta, open(os.path.join(dst, "props.json"), "w"), indent=1)
    print(cid, len(meta), "props")
