"""Cut the Codex hit sprites (tools/art/hitfx/*.png, on flat magenta) into transparent PNGs: assets/fx/<name>.png (512 px).
Alpha from the distance to magenta, the magenta spill removed from the edge pixels."""
import os, glob
import numpy as np
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
for f in glob.glob(os.path.join(ROOT, 'tools', 'art', 'hitfx', '*.png')):
    im = np.asarray(Image.open(f).convert('RGB')).astype(np.float32) / 255
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    # magenta = high r, high b, low g; keyness 1 on pure magenta
    key = np.clip((np.minimum(r, b) - g) * 1.6, 0, 1)
    a = 1 - key
    a = np.clip((a - 0.08) / 0.84, 0, 1)
    # despill: pull r and b down toward g where the pixel was tinted magenta
    spill = np.clip(np.minimum(r, b) - g, 0, 1) * (1 - a)
    out = np.stack([np.clip(r - spill, 0, 1), g, np.clip(b - spill, 0, 1), a], -1)
    img = Image.fromarray((out * 255).astype(np.uint8), 'RGBA')
    bb = img.getbbox()
    if bb:
        # square crop around the effect, centred, a small margin
        cx, cy = (bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2
        h = max(bb[2] - bb[0], bb[3] - bb[1]) / 2 * 1.06
        img = img.crop((int(cx - h), int(cy - h), int(cx + h), int(cy + h)))
    img = img.resize((512, 512), Image.LANCZOS)
    img.save(os.path.join(ROOT, 'assets', 'fx', os.path.basename(f)))
    print('cut', os.path.basename(f))
