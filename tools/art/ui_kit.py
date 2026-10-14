"""The small pieces of the pixel art menus, drawn pixel by pixel in the "Crypte" palette (assets/ui/crypt/kit/):
stone panels and frames (9-slice, used with CSS border-image), arrows, a skull for the stocks, player tokens,
and the character portraits brought down to real pixel art (p40/<id>.png, p64/<id>.png).

    python tools/art/ui_kit.py
"""
import os
import random

from PIL import Image

import ui_cut

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, 'assets', 'ui', 'crypt', 'kit')

INK = (12, 8, 20, 255)
ST_D = (36, 29, 48, 255)
ST = (60, 52, 78, 255)
ST_M = (74, 65, 94, 255)
ST_L = (98, 88, 122, 255)
ST_H = (140, 130, 162, 255)
IN_BG = (26, 20, 36, 255)
IN_N = (34, 27, 45, 255)
MOSS = (64, 128, 40, 255)
MOSS_D = (36, 84, 28, 255)
SLIME = (157, 255, 58, 255)
SLIME_D = (79, 209, 42, 255)
BONE = (242, 232, 208, 255)
BONE_D = (176, 160, 140, 255)
CLEAR = (0, 0, 0, 0)


def canvas(w, h, c=CLEAR):
    return Image.new('RGBA', (w, h), c)


def panel(size=24, cut=8, seed=1, inner=True, moss=True):
    """Stone slab: dark outline with cut corners, a light top-left and a dark bottom-right bevel, speckled stone,
    a dark recessed center for the text (9-slice: `cut` pixels on each side)."""
    rnd = random.Random(seed)
    im = canvas(size, size)
    p = im.load()
    for y in range(size):
        for x in range(size):
            p[x, y] = rnd.choice([ST, ST, ST, ST_M, ST_D]) if rnd.random() < 0.35 else ST
    # bevels
    for i in range(size):
        p[i, 1] = ST_H; p[1, i] = ST_H; p[i, 2] = ST_L; p[2, i] = ST_L
        p[i, size - 2] = ST_D; p[size - 2, i] = ST_D; p[i, size - 3] = ST_D if i % 3 else ST
    # outline, corners cut
    for i in range(size):
        p[i, 0] = INK; p[0, i] = INK; p[i, size - 1] = INK; p[size - 1, i] = INK
    for (x, y) in ((0, 0), (size - 1, 0), (0, size - 1), (size - 1, size - 1)):
        p[x, y] = CLEAR
    for (x, y) in ((1, 1), (size - 2, 1), (1, size - 2), (size - 2, size - 2)):
        p[x, y] = INK
    if inner:
        a, b = cut - 3, size - cut + 2
        for y in range(a, b + 1):
            for x in range(a, b + 1):
                p[x, y] = IN_N if rnd.random() < 0.18 else IN_BG
        for i in range(a, b + 1):
            p[i, a] = INK; p[a, i] = INK; p[i, b] = ST_L; p[b, i] = ST_L
    if moss:
        for x in range(3, size - 3):
            if rnd.random() < 0.3:
                p[x, 1] = MOSS
                if rnd.random() < 0.4: p[x, 2] = MOSS_D
    return im


def frame(size=12, hi=ST_H, lo=ST_D, mid=ST_L):
    """Thin frame around a portrait or a thumbnail (9-slice 4), transparent inside."""
    im = canvas(size, size)
    p = im.load()
    for i in range(size):
        for (x, y) in ((i, 0), (0, i), (i, size - 1), (size - 1, i)):
            p[x, y] = INK
        p[i, 1] = hi; p[1, i] = hi; p[i, size - 2] = lo; p[size - 2, i] = lo
        p[i, 2] = mid; p[2, i] = mid; p[i, size - 3] = INK; p[size - 3, i] = INK
    for (x, y) in ((0, 0), (size - 1, 0), (0, size - 1), (size - 1, size - 1)):
        p[x, y] = CLEAR
    for y in range(3, size - 3):
        for x in range(3, size - 3):
            p[x, y] = CLEAR
    return im


def draw(rows, colors):
    im = canvas(len(rows[0]), len(rows))
    p = im.load()
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch in colors: p[x, y] = colors[ch]
    return im


ARROW = ['k.......', 'kbk.....', 'kbbk....', 'kbbbk...', 'kbbbbk..', 'kbbbk...', 'kbbk....', 'kbk.....', 'k.......']
SKULL = ['..kkkkk..', '.kbbbbbk.', 'kbbbbbbbk', 'kbkkbkkbk', 'kbkkbkkbk', 'kbbbkbbbk', '.kbbbbbk.', '..kbkbk..', '..kkkkk..']
TOKEN = ['....kkkkkk....', '..kkhhhhhhkk..', '.khhcccccchhk.', '.khccccccccck.', 'khccccccccccdk', 'khccccccccccdk', 'kcccccccccccdk',
         'kcccccccccccdk', 'kcccccccccccdk', 'kcccccccccccdk', '.kccccccccddk.', '.kdccccccdddk.', '..kkddddddkk..', '....kkkkkk....']


def shade(hexc, k):
    r, g, b = int(hexc[1:3], 16), int(hexc[3:5], 16), int(hexc[5:7], 16)
    f = lambda v: max(0, min(255, int(v * k if k < 1 else v + (255 - v) * (k - 1))))
    return (f(r), f(g), f(b), 255)


def portraits(pal):
    src = os.path.join(ROOT, 'assets', 'ui', 'portraits')
    for size in (40, 64):
        d = os.path.join(OUT, 'p%d' % size)
        os.makedirs(d, exist_ok=True)
        for n in sorted(os.listdir(src)):
            if not n.endswith('.png'): continue
            im = Image.open(os.path.join(src, n)).convert('RGBA')
            bgc = Image.new('RGBA', im.size, (26, 20, 36, 255))
            bgc.alpha_composite(im)
            small = ui_cut.snap(ui_cut.reduce(bgc, (size, size)), pal)
            small.save(os.path.join(d, n), optimize=True)


def main():
    os.makedirs(OUT, exist_ok=True)
    panel().save(os.path.join(OUT, 'panel.png'))
    panel(seed=7, inner=False).save(os.path.join(OUT, 'slab.png'))
    panel(size=16, cut=5, seed=3, inner=False, moss=False).save(os.path.join(OUT, 'chip.png'))
    frame().save(os.path.join(OUT, 'frame.png'))
    frame(hi=SLIME, mid=SLIME_D, lo=MOSS_D).save(os.path.join(OUT, 'frame_on.png'))
    frame(hi=(255, 214, 90, 255), mid=(214, 150, 40, 255), lo=(120, 70, 20, 255)).save(os.path.join(OUT, 'frame_gold.png'))
    a = draw(ARROW, {'k': INK, 'b': BONE})
    a.save(os.path.join(OUT, 'arrow_r.png'))
    a.transpose(Image.FLIP_LEFT_RIGHT).save(os.path.join(OUT, 'arrow_l.png'))
    draw(SKULL, {'k': INK, 'b': BONE}).save(os.path.join(OUT, 'skull.png'))
    for i, c in enumerate(['#ff3b3b', '#3b8bff', '#ffd23b', '#3bdc5a']):
        draw(TOKEN, {'k': INK, 'c': shade(c, 1), 'h': shade(c, 1.45), 'd': shade(c, 0.6)}).save(os.path.join(OUT, 'token%d.png' % (i + 1)))
    pal, _ = ui_cut.palette_image()
    portraits(pal)
    print('ok', sorted(os.listdir(OUT)))


if __name__ == '__main__':
    main()
