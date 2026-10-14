"""Turns Codex's menu art (tools/art/ui/crypt/*.png, on flat magenta) into the game's real pixel art (assets/ui/crypt/).

Every piece is brought to one pixel grid: the menus are drawn on a virtual 640x360 screen (x2 at 1280x720, x3 at
1920x1080), each piece reduced to its size on that screen, its colors snapped to one shared palette (taken from the
chosen concept), its edges made hard (no half transparent pixel) and, for sprites, a 1 pixel dark outline added.

    python tools/art/ui_cut.py [name ...]
"""
import os
import sys

from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SRC = os.path.join(HERE, 'ui', 'crypt')
DST = os.path.join(ROOT, 'assets', 'ui', 'crypt')
CONCEPT = os.path.join(HERE, 'ui', 'concepts', 'crypt.png')

# output -> (source drawing, size on the 640x360 screen): ('h', px) height, ('w', px) width, ('screen', w, h) the
# whole picture cropped to 16:9 (bg and fg a little larger than the screen: room for the parallax drift)
SIZES = {
    'fresco': ('fresco2', ('screen', 652, 367)),  # the whole scene, the friends painted in (the chosen try)
    'bg': ('bg', ('screen', 652, 367)), 'fg': ('fg', ('screen', 668, 376)), 'slab': ('slab', ('screen', 640, 360)),
    'logo': ('logo', ('w', 360)), 'logo_s': ('logo', ('w', 212)),
    'button': ('button', ('w', 174)), 'slime': ('slime', ('w', 194)), 'hand': ('hand', ('w', 42)),
    'aboueb': ('aboueb', ('h', 118)), 'pandrezz': ('pandrezz', ('h', 122)), 'tices': ('tices', ('h', 116)),
    'jsan': ('jsan', ('h', 116)), 'bido': ('bido', ('h', 124)), 'nymano': ('nymano', ('h', 114)),
    'omfu': ('omfu', ('h', 118)), 'lolobiscotto': ('lolobiscotto', ('h', 112)),
}
# the same friends a little smaller, for the back row of the menu scene (depth without blurry scaling)
for _n in ('aboueb', 'pandrezz', 'tices', 'jsan', 'bido', 'nymano', 'omfu', 'lolobiscotto'):
    SIZES[_n + '_b'] = (_n, ('h', round(SIZES[_n][1][1] * 0.8)))
OUTLINE = {'hand', 'logo', 'logo_s', 'button'} | {n + s for n in ('aboueb', 'pandrezz', 'tices', 'jsan', 'bido', 'nymano', 'omfu', 'lolobiscotto') for s in ('', '_b')}
OPAQUE = {'bg', 'slab', 'fresco'}  # no magenta to cut


# accents the median cut tends to lose (small bright areas): flames, slime, blood, bone, skin, the friends' clothes
ACCENTS = [
    (255, 250, 230), (255, 226, 138), (255, 176, 58), (255, 122, 26), (214, 74, 18),  # flame
    (200, 255, 120), (157, 255, 58), (79, 209, 42), (42, 127, 31), (20, 70, 24),  # slime
    (255, 90, 90), (232, 32, 42), (156, 16, 32), (90, 8, 24),  # blood
    (242, 232, 208), (200, 186, 160), (140, 124, 110),  # bone
    (255, 214, 180), (230, 170, 130), (190, 124, 88), (140, 86, 60), (96, 58, 42),  # skin
    (90, 170, 255), (40, 100, 220), (255, 120, 200), (255, 220, 60), (240, 140, 40),  # energy, hearts, ball
    (12, 8, 20),  # outline
]


def palette_image(n=96):
    """One shared palette: the concept's colors (median cut) plus fixed accents and the outline color."""
    im = Image.open(CONCEPT).convert('RGB').resize((384, 256), Image.BOX)
    k = n - len(ACCENTS)
    q = im.quantize(colors=k, method=Image.MEDIANCUT, dither=Image.Dither.NONE)
    pal = q.getpalette()[: k * 3] + [c for rgb in ACCENTS for c in rgb]
    p = Image.new('P', (1, 1))
    p.putpalette(pal + [0, 0, 0] * (256 - n))
    return p, pal


def key_magenta(im):
    """Alpha from the distance to magenta; pink fringes (magenta mixed into the edge) lose their magenta."""
    im = im.convert('RGBA')
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            m = min(r, b) - g  # how magenta it is
            if m > 90 and r > 150 and b > 150:
                px[x, y] = (0, 0, 0, 0)
            elif m > 40:
                # edge pixel: remove the magenta part (keep the dark/green/red it was mixed with)
                k = (m - 40) / 50.0
                px[x, y] = (int(r - (r - g) * k * 0.8), g, int(b - (b - g) * k * 0.8), int(255 * (1 - k * 0.7)))
    return im


def key_flood(im, tol=30, band=10):
    """For a sprite on a plain or softly lit background (Codex does not always use magenta): the background colors
    are learnt from the image border (a few clusters), and the background is what is reached from the border through
    pixels close to one of them. The drawing's own darks (hair, black jeans) differ enough from the backdrop to stay."""
    from collections import deque
    import numpy as np
    a = np.asarray(im.convert('RGB')).astype(np.int16)
    h, w, _ = a.shape
    border = np.concatenate([a[:band].reshape(-1, 3), a[-band:].reshape(-1, 3), a[:, :band].reshape(-1, 3), a[:, -band:].reshape(-1, 3)])
    # cluster the border colors (a coarse grid, the most common cells)
    cells, counts = np.unique(border // 12, axis=0, return_counts=True)
    keep = cells[counts >= max(20, counts.sum() * 0.002)]
    cols = np.array([border[(border // 12 == c).all(axis=1)].mean(axis=0) for c in keep])
    # distance of every pixel to the nearest backdrop color (max channel)
    d = np.full((h, w), 999, np.int16)
    for c in cols:
        d = np.minimum(d, np.abs(a - c.astype(np.int16)).max(axis=2))
    near = d < tol
    bg = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if near[y, x] and not bg[y, x]: bg[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if near[y, x] and not bg[y, x]: bg[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for yy, xx in ((y, x + 1), (y, x - 1), (y + 1, x), (y - 1, x)):
            if 0 <= yy < h and 0 <= xx < w and near[yy, xx] and not bg[yy, xx]:
                bg[yy, xx] = True; q.append((yy, xx))
    rgba = np.dstack([a.astype(np.uint8), np.where(bg, 0, 255).astype(np.uint8)])
    return Image.fromarray(rgba, 'RGBA')


def is_magenta_bg(im):
    rgb = im.convert('RGB')
    w, h = rgb.size
    pts = [rgb.getpixel((x, y)) for x, y in ((2, 2), (w - 3, 2), (2, h - 3), (w - 3, h - 3), (w // 2, 2))]
    return sum(1 for r, g, b in pts if r > 200 and b > 200 and g < 80) >= 3


def cut_out(im):
    return key_magenta(im) if is_magenta_bg(im) else key_flood(im)


def crop_alpha(im):
    box = im.getchannel('A').point(lambda a: 255 if a > 40 else 0).getbbox()
    return im.crop(box) if box else im


def reduce(im, size):
    """Box-filter down (on premultiplied colors) to the target size."""
    w, h = size
    r, g, b, a = im.split()
    pre = Image.merge('RGBA', [Image.composite(c, Image.new('L', im.size, 0), a) for c in (r, g, b)] + [a])
    small = pre.resize((w, h), Image.BOX)
    sr, sg, sb, sa = small.split()
    out = Image.new('RGBA', (w, h))
    po, ps = out.load(), small.load()
    for y in range(h):
        for x in range(w):
            R, G, B, A = ps[x, y]
            if A < 128:
                po[x, y] = (0, 0, 0, 0)
            else:
                k = 255.0 / max(A, 1)
                po[x, y] = (min(255, int(R * k)), min(255, int(G * k)), min(255, int(B * k)), 255)
    return out


def snap(im, pal_img):
    """Colors snapped to the shared palette (no dithering: the art has its own)."""
    a = im.getchannel('A')
    q = im.convert('RGB').quantize(palette=pal_img, dither=Image.Dither.NONE).convert('RGBA')
    q.putalpha(a)
    return q


def outline(im, color=(12, 8, 20, 255)):
    """A 1 pixel dark outline around the opaque pixels (4-neighbours)."""
    w, h = im.size
    big = Image.new('RGBA', (w + 2, h + 2), (0, 0, 0, 0))
    big.paste(im, (1, 1))
    src = big.load()
    out = big.copy()
    po = out.load()
    for y in range(h + 2):
        for x in range(w + 2):
            if src[x, y][3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w + 2 and 0 <= ny < h + 2 and src[nx, ny][3]:
                    po[x, y] = color
                    break
    return out


def process(name, pal_img):
    source, spec = SIZES.get(name, (name, ('h', 100)))
    src = os.path.join(SRC, source + '.png')
    if not os.path.exists(src):
        print('missing', name)
        return
    im = Image.open(src)
    if spec[0] == 'screen':
        im = im.convert('RGBA')
        w, h = im.size
        ch = round(w * 9 / 16)  # 16:9 crop, keeping the bottom (the floor matters more than the sky)
        top = max(0, h - ch - (h - ch) // 3)
        im = im.crop((0, top, w, top + ch))
        if name not in OPAQUE:
            im = key_magenta(im)
        out = reduce(im, spec[1:])
    else:
        im = crop_alpha(cut_out(im))
        w, h = im.size
        if spec[0] == 'h':
            size = (max(1, round(w * spec[1] / h)), spec[1])
        else:
            size = (spec[1], max(1, round(h * spec[1] / w)))
        out = reduce(im, size)
    out = snap(out, pal_img)
    if name in OUTLINE:
        out = outline(out)
    os.makedirs(DST, exist_ok=True)
    out.save(os.path.join(DST, name + '.png'), optimize=True)
    print('ok', name, out.size)


if __name__ == '__main__':
    pal_img, _ = palette_image()
    want = set(sys.argv[1:])
    for out, (source, _) in SIZES.items():
        if not want or out in want or source in want:
            process(out, pal_img)
