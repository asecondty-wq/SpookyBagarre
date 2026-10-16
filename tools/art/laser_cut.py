"""Découpe la vidéo du rayon laser (animation image par image : charge violette, trois gros plans d'impact noir et blanc, puis le
rayon rose et cyan avec ses éclairs, qui s'éteint) pour le jeu : assets/fx/laser/atlas.png + atlas.json + flash<N>.png,
jouées par src/render/laserVfx.js (le rayon de l'ultime d'Anbuu, ultimate.js).

- CHAQUE image de la vidéo est gardée dans la chronologie (atlas.json : `tl`, une entrée par image de la vidéo, à 30 i/s). Le dessin
  est animé « à la 3 » ou « à la 4 » (le même dessin reste 3 ou 4 images) : les images identiques ne sont stockées qu'une fois
  dans la planche, la chronologie renvoie vers le bon dessin. Rien n'est sauté.
- Les logos Clip Studio et After Effects en haut à droite sont effacés (retouche par voisinage, sur toutes les images).
- Les dessins sur fond noir (charge, rayon) vont dans la planche, découpés à leur cadre utile, réduits (`--scale`), sans le
  bruit de compression (le noir reste noir : l'effet est additif) ; les trois dessins noir sur blanc (les plans d'impact) sont
  des images à part, en niveaux de gris.
- atlas.json : `fps`, `w`, `h` (la vidéo), `origin` (le point de départ du rayon, en pixels de la vidéo), `scale`, `cells`
  (x, y, w, h dans la planche ; rx, ry, rw, rh : le cadre dans l'image de la vidéo), `flash` (fichiers), `tl` (par image :
  [0] vide, [1, n° de cellule] ou [2, n° d'image d'impact]), `ranges` (début et fin de la charge, des impacts, du rayon).

Usage : python tools/art/laser_cut.py <video.mp4> [dossier de sortie] [--scale 0.5]
Python 3 avec numpy et opencv-python, ffmpeg dans le PATH. La vidéo source (œuvre de CMZW) reste sur la machine du créateur : non publiée.
"""
import json, os, subprocess, sys, tempfile, glob
import cv2
import numpy as np

SCALE = 0.5
PAD = 28          # px (vidéo) gardés autour du contenu d'un dessin
THR = 12          # un pixel au-dessus (max des canaux) compte comme contenu
FLOOR = 6         # on retire ce niveau partout : le bruit de compression et le bord de la découpe disparaissent
SAME = 0.5        # écart moyen (0..255) sous lequel deux images voisines sont le même dessin
ATLAS_W = 4096
GAP = 2


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    scale = SCALE
    if '--scale' in sys.argv:
        scale = float(sys.argv[sys.argv.index('--scale') + 1])
        args = [a for a in args if a != str(scale) and a != sys.argv[sys.argv.index('--scale') + 1]]
    if not args:
        print(__doc__); sys.exit(1)
    video, out = args[0], (args[1] if len(args) > 1 else 'assets/fx/laser')
    os.makedirs(out, exist_ok=True)

    tmp = tempfile.mkdtemp(prefix='laser_')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', video, '-vsync', '0', os.path.join(tmp, 'f%03d.png')], check=True)
    files = sorted(glob.glob(os.path.join(tmp, 'f*.png')))
    frames = [cv2.imread(f) for f in files]
    n = len(frames)
    H, W = frames[0].shape[:2]
    print(n, 'images', W, 'x', H)

    # ---- les logos : la forme vient d'une image noire (la première), le masque est élargi de 6 px ----
    g0 = cv2.cvtColor(frames[0], cv2.COLOR_BGR2GRAY)
    m = np.zeros((H, W), np.uint8)
    m[10:170, 990:1270] = (g0[10:170, 990:1270] > 6).astype(np.uint8)
    ys, xs = np.where(m > 0)
    print('logos :', xs.min(), xs.max(), ys.min(), ys.max())
    mask = cv2.dilate(m, np.ones((13, 13), np.uint8))
    clean = [cv2.inpaint(f, mask, 7, cv2.INPAINT_TELEA) for f in frames]

    # ---- les dessins : une nouvelle image quand elle diffère de la précédente ----
    draw_of = [0] * n
    firsts = [0]
    for i in range(1, n):
        d = np.abs(clean[i].astype(np.float32) - clean[i - 1].astype(np.float32)).mean()
        if d > SAME:
            firsts.append(i)
        draw_of[i] = len(firsts) - 1
    print(len(firsts), 'dessins pour', n, 'images')

    kinds = []
    for i in firsts:
        f = clean[i]
        if f.mean() > 100:
            kinds.append('flash')
        elif f.max() < THR + 2:
            kinds.append('empty')
        else:
            kinds.append('sprite')
    first_flash = next(k for k, v in enumerate(kinds) if v == 'flash')
    last_flash = max(k for k, v in enumerate(kinds) if v == 'flash')

    # ---- le point de départ du rayon : le point (noir sur blanc) du dernier plan d'impact, sinon le bout de la gaine ----
    origin = None
    kk = [k for k, v in enumerate(kinds) if v == 'flash'][-1]
    g = cv2.cvtColor(clean[firsts[kk]], cv2.COLOR_BGR2GRAY)
    _, bw = cv2.threshold(g[:, :330], 80, 255, cv2.THRESH_BINARY_INV)
    cnt, lab, st, cen = cv2.connectedComponentsWithStats(bw)
    best = None
    for c in range(1, cnt):
        w_, h_, a_ = st[c, cv2.CC_STAT_WIDTH], st[c, cv2.CC_STAT_HEIGHT], st[c, cv2.CC_STAT_AREA]
        if 8 <= w_ <= 40 and 8 <= h_ <= 40 and a_ > 0.6 * w_ * h_ * 0.7:
            if best is None or cen[c][0] < best[0]:
                best = (cen[c][0], cen[c][1])
    origin = [round(float(best[0]), 1), round(float(best[1]), 1)] if best else [195.0, 381.0]
    print('départ du rayon :', origin)

    # ---- les dessins sur noir : cadre utile, bruit retiré, réduits ----
    cells, cell_of = [], {}
    crops = []
    for k, i in enumerate(firsts):
        if kinds[k] != 'sprite':
            continue
        f = clean[i]
        mx = f.max(axis=2)
        ys, xs = np.where(mx > THR)
        x0, x1 = max(0, xs.min() - PAD), min(W, xs.max() + 1 + PAD)
        y0, y1 = max(0, ys.min() - PAD), min(H, ys.max() + 1 + PAD)
        x0 -= x0 % 2; y0 -= y0 % 2; x1 += x1 % 2; y1 += y1 % 2
        c = np.maximum(f[y0:y1, x0:x1].astype(np.int16) - FLOOR, 0).astype(np.uint8)
        c = cv2.resize(c, (max(1, round((x1 - x0) * scale)), max(1, round((y1 - y0) * scale))), interpolation=cv2.INTER_AREA)
        cell_of[k] = len(cells)
        cells.append(dict(rx=int(x0), ry=int(y0), rw=int(x1 - x0), rh=int(y1 - y0)))
        crops.append(c)

    # ---- la planche : rangées de hauteur décroissante ----
    order = sorted(range(len(cells)), key=lambda j: -crops[j].shape[0])
    x = y = rowh = 0
    pos = {}
    for j in order:
        h_, w_ = crops[j].shape[:2]
        if x + w_ > ATLAS_W:
            x, y, rowh = 0, y + rowh + GAP, 0
        pos[j] = (x, y)
        x += w_ + GAP
        rowh = max(rowh, h_)
    AH = y + rowh
    atlas = np.zeros((AH, ATLAS_W, 3), np.uint8)
    for j, (px, py) in pos.items():
        h_, w_ = crops[j].shape[:2]
        atlas[py:py + h_, px:px + w_] = crops[j]
        cells[j].update(x=px, y=py, w=w_, h=h_)
    cv2.imwrite(os.path.join(out, 'atlas.png'), atlas, [cv2.IMWRITE_PNG_COMPRESSION, 9])
    print('planche', ATLAS_W, 'x', AH, ', cellules :', len(cells))

    # ---- les plans d'impact (noir sur blanc) : images à part, en gris si c'est du gris ----
    flash_files, flash_of = [], {}
    for k, i in enumerate(firsts):
        if kinds[k] != 'flash':
            continue
        f = clean[i]
        small = cv2.resize(f, (960, 540), interpolation=cv2.INTER_AREA)
        grey = int(np.abs(small[:, :, 0].astype(np.int16) - small[:, :, 2]).max()) < 6
        name = f'flash{len(flash_files)}.png'
        cv2.imwrite(os.path.join(out, name), cv2.cvtColor(small, cv2.COLOR_BGR2GRAY) if grey else small, [cv2.IMWRITE_PNG_COMPRESSION, 9])
        flash_of[k] = len(flash_files)
        flash_files.append(name)

    # ---- la chronologie : une entrée par image de la vidéo ----
    tl = []
    for i in range(n):
        k = draw_of[i]
        if kinds[k] == 'empty':
            tl.append([0])
        elif kinds[k] == 'flash':
            tl.append([2, flash_of[k]])
        else:
            tl.append([1, cell_of[k]])
    fi = [i for i in range(n) if tl[i][0] == 2]
    si = [i for i in range(n) if tl[i][0] == 1]
    charge = [i for i in si if i < fi[0]]
    beam = [i for i in si if i > fi[-1]]
    meta = dict(fps=30, w=W, h=H, origin=origin, scale=scale, atlas=[ATLAS_W, AH], cells=cells, flash=flash_files, tl=tl,
                ranges=dict(charge=[charge[0], charge[-1]], flash=[fi[0], fi[-1]], beam=[beam[0], beam[-1]]))
    with open(os.path.join(out, 'atlas.json'), 'w') as fh:
        json.dump(meta, fh, separators=(',', ':'))
    print('plages :', meta['ranges'])
    size = sum(os.path.getsize(os.path.join(out, f)) for f in os.listdir(out))
    print('poids total', round(size / 1024), 'Ko')


if __name__ == '__main__':
    main()
