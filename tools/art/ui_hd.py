"""The menus' art in high definition (assets/ui/crypt/hd/): the same pieces and the same sizes on the 640x360 grid as
tools/art/ui_cut.py, but drawn at 3 times that (1920x1080), straight from Codex's drawings: smooth resampling, no
palette, no pixel outline. The game draws them at their size on the grid (src/ui/crypt.js, screens.js, css/crypt.css).

    python tools/art/ui_hd.py [name ...] [--paint] [--icons]
--paint: from the painted versions (tools/art/ui/crypt_hd/, tools/art/ui_crypt_hd.ps1) instead of the pixel art ones,
for the pieces that have one. --icons: the small icons (arrows, skull, the players' tokens) only.
"""
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ui_cut as U  # noqa: E402

DST = os.path.join(U.ROOT, 'assets', 'ui', 'crypt', 'hd')
SCALE = 3


def smooth(im, size):
    """Resampled on premultiplied colors (no dark fringe on the cut edges)."""
    return im.convert('RGBa').resize(size, Image.LANCZOS).convert('RGBA')


PAINT = os.path.join(U.HERE, 'ui', 'crypt_hd')


def process(name, paint=False):
    source, spec = U.SIZES.get(name, (name, ('h', 100)))
    src = os.path.join(U.SRC, source + '.png')
    if paint:
        if not os.path.exists(os.path.join(PAINT, name + '.png')):
            return
        src = os.path.join(PAINT, name + '.png')
    if not os.path.exists(src):
        print('missing', name)
        return
    im = Image.open(src)
    if spec[0] == 'screen':
        im = im.convert('RGBA')
        w, h = im.size
        ch = round(w * 9 / 16)
        top = max(0, h - ch - (h - ch) // 3)
        im = im.crop((0, top, w, top + ch))
        if name not in U.OPAQUE:
            im = U.key_magenta(im)
        size = (spec[1] * SCALE, spec[2] * SCALE)
        if paint:
            im = im.convert('RGB').convert('RGBA')
    else:
        im = U.crop_alpha(U.cut_out(im))
        w, h = im.size
        if spec[0] == 'h':
            size = (max(1, round(w * spec[1] / h)) * SCALE, spec[1] * SCALE)
        else:
            size = (spec[1] * SCALE, max(1, round(h * spec[1] / w)) * SCALE)
    out = smooth(im, size)
    os.makedirs(DST, exist_ok=True)
    if name in U.OPAQUE:
        out.convert('RGB').save(os.path.join(DST, name + '.jpg'), quality=88)
    else:
        out.save(os.path.join(DST, name + '.png'), optimize=True)
    print('ok', name, out.size)


if __name__ == '__main__' and '--icons' not in sys.argv:
    paint = '--paint' in sys.argv
    want = {a for a in sys.argv[1:] if not a.startswith('--')}
    for out in U.SIZES:
        if out.endswith('_b'):
            continue  # the smaller copies of the pixel version: the HD sprites are scaled instead
        if not want or out in want:
            process(out, paint)


# --- the small icons, drawn smooth (8 times larger, then brought down): sizes on the grid -------------------------
def icons():
    from PIL import ImageDraw
    SS = 8 * SCALE

    def canvas(w, h):
        return Image.new('RGBA', (w * SS, h * SS), (0, 0, 0, 0))

    def done(im, w, h, name):
        im.resize((w * SCALE, h * SCALE), Image.LANCZOS).save(os.path.join(DST, name + '.png'), optimize=True)
        print('ok', name)

    # arrows (pointing right, and its mirror)
    im = canvas(8, 9); d = ImageDraw.Draw(im); k = SS
    d.polygon([(1 * k, 0.5 * k), (7.5 * k, 4.5 * k), (1 * k, 8.5 * k)], fill=(12, 8, 20, 255))
    d.polygon([(1.9 * k, 1.9 * k), (6 * k, 4.5 * k), (1.9 * k, 7.1 * k)], fill=(242, 232, 208, 255))
    done(im, 8, 9, 'arrow_r')
    done(im.transpose(Image.FLIP_LEFT_RIGHT), 8, 9, 'arrow_l')
    # skull (the stocks)
    im = canvas(9, 9); d = ImageDraw.Draw(im)
    d.ellipse([0.4 * k, 0.2 * k, 8.6 * k, 7.2 * k], fill=(12, 8, 20, 255))
    d.rounded_rectangle([2.2 * k, 5 * k, 6.8 * k, 8.8 * k], radius=0.8 * k, fill=(12, 8, 20, 255))
    d.ellipse([1.1 * k, 0.9 * k, 7.9 * k, 6.5 * k], fill=(242, 232, 208, 255))
    d.rounded_rectangle([2.9 * k, 5.2 * k, 6.1 * k, 8.1 * k], radius=0.5 * k, fill=(242, 232, 208, 255))
    d.ellipse([2.1 * k, 3.0 * k, 4.1 * k, 5.0 * k], fill=(12, 8, 20, 255))
    d.ellipse([4.9 * k, 3.0 * k, 6.9 * k, 5.0 * k], fill=(12, 8, 20, 255))
    for x in (3.7, 4.5, 5.3):
        d.line([(x * k, 6.6 * k), (x * k, 8.1 * k)], fill=(12, 8, 20, 255), width=int(0.45 * k))
    done(im, 9, 9, 'skull')
    # the players' cursors: a round token in their color
    for i, c in enumerate([(255, 59, 59), (59, 139, 255), (255, 210, 59), (59, 220, 90)]):
        im = canvas(14, 14); d = ImageDraw.Draw(im)
        d.ellipse([0.3 * k, 0.3 * k, 13.7 * k, 13.7 * k], fill=(12, 8, 20, 255))
        d.ellipse([1.2 * k, 1.2 * k, 12.8 * k, 12.8 * k], fill=tuple(int(v * 0.62) for v in c) + (255,))
        d.ellipse([1.2 * k, 1.0 * k, 12.8 * k, 11.6 * k], fill=c + (255,))
        d.ellipse([3.2 * k, 2.4 * k, 7.2 * k, 5.4 * k], fill=tuple(min(255, int(v + (255 - v) * 0.5)) for v in c) + (255,))
        done(im, 14, 14, 'token%d' % (i + 1))


if __name__ == '__main__' and ('--icons' in sys.argv or not [a for a in sys.argv[1:] if not a.startswith('--')]):
    os.makedirs(DST, exist_ok=True)
    icons()
