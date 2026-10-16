"""Découpe les animations d'impact de la vidéo de VFX (vfx_anbuu.mp4 : une animation par seconde, chacune dans son plan fixe,
sur le décor sombre du banc d'essai) en planches d'images pour le jeu (assets/fx/vfx/*.png, jouées par src/render/vidFx.js).

Chaque animation : le décor est estimé par la médiane des images d'avant l'impact (même plan, caméra immobile), puis retiré
(l'effet est additif : on garde `image - décor`, tout ce qui est noir reste transparent à l'affichage). On cadre sur l'effet le
plus gros du centre (les autres, plus petits et lointains, sont masqués), on le met dans un carreau de taille fixe, et on
colle les carreaux en grille.

Usage : python tools/art/vfx_cut.py <video.mp4> [dossier de sortie] [--probe]
  --probe : n'écrit que des aperçus (tools/art/vfx_probe/) pour vérifier le découpage.
Les temps (images de début de chaque animation) viennent de l'analyse de la vidéo (voir EVENTS).
Python 3 avec numpy, opencv-python et ffmpeg dans le PATH. La vidéo source reste sur la machine du créateur (non publiée).
"""
import json, os, subprocess, sys
import cv2
import numpy as np

FPS = 30
W, H = 1280, 720
# nom -> (numéro d'animation dans la vidéo (une par seconde, de 0 à 122), carreau (largeur, hauteur), marge autour de l'effet)
# 1 : coup physique jaune ; 3 : coup physique + pointe bleue vers le bas (« Spike Hit Effect »)
# 49 : autre coup physique ; 68 : coup tranchant (papillon + trait) ; 106 : kill spark (la grosse décharge du KO, version verte :
# le jeu la recolore par une rotation de teinte, une couleur par joueur)
# (on choisit des plans à caméra immobile avant l'impact, et un effet central sans voisin collé)
SETS = {
    'phys':  dict(ev=1,  tile=(256, 256), pad=0.18),
    'spike': dict(ev=3,  tile=(256, 320), pad=0.12),
    'alt':   dict(ev=49, tile=(256, 256), pad=0.10),
    'slash': dict(ev=68, tile=(384, 256), pad=0.12),
    'kill':  dict(ev=106, tile=(512, 256), pad=0.06, xwin=(420, 255, 4, (5, 10))),
}
THR = 16        # écart minimal (0..255) avec le décor pour compter comme effet
DIM = 90        # un morceau dont le pixel le plus vif reste sous ça n'est pas gardé
KEEP_NEAR = 28  # px : les morceaux plus loin que ça de l'effet central ne sont pas gardés (les petits effets des autres joueurs)
SHAKE = 13      # px : le coup secoue la caméra, les bords du décor (le pilier) bougent d'autant : on n'y garde que ce qui dépasse


def events(video):
    """Début, fin et pic de chaque animation, cherchés à l'énergie lumineuse (voir CLAUDE.md : vidéo de VFX)."""
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', video, '-vf', 'scale=640:360', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-'], stdout=subprocess.PIPE)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (41, 41))
    E = []
    while True:
        b = p.stdout.read(640 * 360 * 3)
        if len(b) < 640 * 360 * 3: break
        g = np.frombuffer(b, np.uint8).reshape(360, 640, 3).max(2)
        d = g.astype(np.int16) - cv2.morphologyEx(g, cv2.MORPH_OPEN, k)
        d[int(360 * 0.82):] = 0
        E.append(float(np.clip(d - 30, 0, None).sum()) / 1000)
    E = np.array(E)
    # le bruit de fond (le coin du mur) : le minimum glissant sur 2 s
    from scipy.ndimage import minimum_filter1d
    A = E - minimum_filter1d(E, 61)
    on = A > 150
    segs, s = [], None
    for i, v in enumerate(on):
        if v and s is None: s = i
        if not v and s is not None: segs.append([s, i - 1]); s = None
    out = []
    for a, b in segs:
        if out and a - out[-1][1] <= 5: out[-1][1] = b
        else: out.append([a, b])
    return out


def window(video, a, b, pre=24, post=3):
    """Les images a-pre .. b+post en pleine taille."""
    f0 = max(0, a - pre)
    n = b + post - f0 + 1
    cmd = ['ffmpeg', '-v', 'error', '-ss', f'{f0 / FPS:.4f}', '-i', video, '-frames:v', str(n), '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-']
    raw = subprocess.run(cmd, stdout=subprocess.PIPE).stdout
    fr = np.frombuffer(raw, np.uint8)
    fr = fr[: (len(fr) // (W * H * 3)) * W * H * 3].reshape(-1, H, W, 3)
    return f0, fr


def cut(video, name, spec, ev, probe_dir=None):
    a, b = ev
    f0, fr = window(video, a, b)
    # le début du plan (une coupe = un grand saut d'une image à la suivante) : le décor d'avant ne doit venir que de ce plan
    small = np.array([cv2.resize(f, (160, 90), interpolation=cv2.INTER_AREA) for f in fr]).astype(np.int16)
    cut_at = 0
    for i in range(a - f0 - 1, 0, -1):
        if np.abs(small[i] - small[i - 1]).mean() > 10: cut_at = i; break
    i_a = a - f0
    pre = fr[cut_at: max(cut_at + 3, i_a - 1)]
    bg = np.median(pre, axis=0).astype(np.uint8)
    # le décor « agrandi » : un bord qui a bougé de moins de SHAKE px ne dépasse jamais ce maximum voisin
    bgmax = cv2.dilate(bg, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (SHAKE, SHAKE))).astype(np.int16)
    fg = []
    for f in fr[i_a - 1: b - f0 + 3]:
        d = f.astype(np.int16) - bgmax
        fg.append(np.clip(d - 4, 0, 255).astype(np.uint8))
    fg = np.array(fg)
    # image par image, on ne garde que l'effet central : le plus gros morceau, ceux qui le touchent ou qui font au moins un
    # cinquième de sa taille, à moins de `R` px du centre ; les petits effets des autres joueurs (alignés au sol) tombent
    R = spec.get('radius', 340)
    ker = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    comps = []
    for f in fg:
        m = (f.max(2) > THR).astype(np.uint8)
        n, lab, st, cen = cv2.connectedComponentsWithStats(cv2.dilate(m, ker))
        comps.append((n, lab, st, cen))
    # le centre : le plus gros morceau de l'image la plus remplie
    big = max(range(len(fg)), key=lambda i: comps[i][2][1:, 4].max() if comps[i][0] > 1 else 0)
    n, lab, st, cen = comps[big]
    core = cen[1 + int(np.argmax(st[1:, 4]))]
    kept = []
    for fi, (f, (n, lab, st, cen)) in enumerate(zip(fg, comps)):
        km = np.zeros((H, W), np.uint8)
        if n > 1:
            mi = 1 + int(np.argmax(st[1:, 4]))
            near = cv2.dilate((lab == mi).astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31)))
            for i in range(1, n):
                if np.hypot(cen[i][0] - core[0], cen[i][1] - core[1]) > R: continue
                # (les taches ternes, restes du décor qui a bougé : un morceau qui ne brille nulle part n'est pas de l'effet)
                if f[lab == i].max() < DIM: continue
                if i == mi or st[i][4] >= 0.2 * st[mi][4] or (near[lab == i].any()):
                    km[lab == i] = 1
        kept.append(f * km[:, :, None])
    fg = np.array(kept)
    # une fenêtre en largeur autour du centre (xwin = demi-largeur ensuite, demi-largeur au début, nombre d'images du début,
    # images où lire le centre) : un trait blanc relie parfois l'effet central à ses voisins, la fenêtre les coupe
    if 'xwin' in spec:
        wl, we, ne, (c0, c1) = spec['xwin']
        mm = (fg[c0:c1].max(3).max(0) > THR)
        xs_ = np.where(mm.any(0))[0]
        xc = (xs_.min() + xs_.max()) / 2
        xs = np.arange(W, dtype=np.float32)
        FE = 70.0  # px : le bord de la fenêtre est fondu, pas coupé net
        for fi in range(len(fg)):
            r = we if fi < ne else wl
            ramp = np.clip((xc + r - xs) / FE, 0, 1) * np.clip((xs - (xc - r)) / FE, 0, 1)
            fg[fi] = (fg[fi] * ramp[None, :, None]).astype(np.uint8)
    m = (fg.max(3).max(0) > THR)
    ys, xs = np.where(m)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    tw, th = spec['tile']
    ww, hh = (x1 - x0), (y1 - y0)
    asp = tw / th
    bw = max(ww, hh * asp) * (1 + 2 * spec['pad'])
    bh = bw / asp
    X0, Y0 = int(round(cx - bw / 2)), int(round(cy - bh / 2))
    tiles = []
    for f in fg:
        # découpe avec bords noirs hors image
        pad = np.zeros((int(bh), int(bw), 3), np.uint8)
        sx0, sy0 = max(0, X0), max(0, Y0)
        sx1, sy1 = min(W, X0 + pad.shape[1]), min(H, Y0 + pad.shape[0])
        pad[sy0 - Y0: sy1 - Y0, sx0 - X0: sx1 - X0] = f[sy0:sy1, sx0:sx1]
        tiles.append(cv2.resize(pad, (tw, th), interpolation=cv2.INTER_AREA if bw > tw else cv2.INTER_CUBIC))
    # on ne garde que les images où il y a de l'effet
    lum = [t.max(2).astype(np.float32).sum() for t in tiles]
    on = [i for i, v in enumerate(lum) if v > 0.02 * max(lum)]
    tiles = tiles[on[0]: on[-1] + 1]
    return tiles, dict(frames=len(tiles), box=[int(x0), int(y0), int(x1), int(y1)], src=[a, b], size=[int(bw), int(bh)])


def sheet(tiles, tw, th, cols):
    rows = (len(tiles) + cols - 1) // cols
    sh = np.zeros((rows * th, cols * tw, 3), np.uint8)
    for i, t in enumerate(tiles):
        r, c = divmod(i, cols)
        sh[r * th:(r + 1) * th, c * tw:(c + 1) * tw] = t
    return sh


def main():
    video = sys.argv[1]
    out = next((x for x in sys.argv[2:] if not x.startswith('--')), 'assets/fx/vfx')
    probe = '--probe' in sys.argv
    evs = events(video)
    print(len(evs), 'animations')
    os.makedirs(out, exist_ok=True)
    meta = {}
    for name, spec in SETS.items():
        tiles, info = cut(video, name, spec, evs[spec['ev']])
        tw, th = spec['tile']
        cols = 4 if tw <= 256 else 3 if tw <= 384 else 2
        sh = sheet(tiles, tw, th, cols)
        info.update(cols=cols, tile=[tw, th])
        meta[name] = info
        cv2.imwrite(os.path.join(out, f'{name}.png'), sh, [cv2.IMWRITE_PNG_COMPRESSION, 9])
        print(name, info)
    json.dump(meta, open(os.path.join(out, 'vfx.json'), 'w'), indent=1)


if __name__ == '__main__':
    main()
