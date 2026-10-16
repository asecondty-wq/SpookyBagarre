// Tetris express (tetris) : chacun sa grille, partie déjà bien entamée (la même pour les deux, tirée au début : des
// lignes de déchets percées, un puits presque aligné) et les mêmes pièces dans le même ordre. Les pièces tombent vite (de
// plus en plus) ; le but : finir avec la pile la plus BASSE possible (une ligne pleine disparaît et fait baisser la pile).
// ◀ ▶ bouger, A tourner, ▼ (tenu) faire tomber vite ; en plus, sans le dire : ▲ tourne aussi, X dans l'autre
// sens, SAUT lâche d'un coup. Pile qui déborde : les 4
// lignes du haut sautent mais comptent quand même (+4 de hauteur à la fin). Score : la hauteur finale (plus bas = mieux).
import { BTN, MG_PLAY, scorePayout, botLevel } from './common.js';

export const TET = { W: 10, H: 16, FILL: 7, GRAV: [13, 5], SOFT: 1, DAS: 9, ARR: 2, LOCK: 16, TOP_PEN: 4 };
const NW = TET.W, NH = TET.H;
// les 7 pièces (I O T S Z J L) : leurs cases dans leur boîte de n cases, puis leurs 4 rotations
const SHAPES = [
  [4, [[0, 1], [1, 1], [2, 1], [3, 1]]], [2, [[0, 0], [1, 0], [0, 1], [1, 1]]], [3, [[1, 0], [0, 1], [1, 1], [2, 1]]],
  [3, [[1, 0], [2, 0], [0, 1], [1, 1]]], [3, [[0, 0], [1, 0], [1, 1], [2, 1]]], [3, [[0, 0], [0, 1], [1, 1], [2, 1]]], [3, [[2, 0], [0, 1], [1, 1], [2, 1]]],
];
export const PIECES = SHAPES.map(([n, c]) => { const r = [c]; for (let k = 1; k < 4; k++) r.push(r[k - 1].map(([x, y]) => [n - 1 - y, x])); return r; });
const KICKS = [0, -1, 1, -2, 2];

export function fits(b, k, r, x, y) {
  for (const [dx, dy] of PIECES[k][r]) {
    const cx = x + dx, cy = y + dy;
    if (cx < 0 || cx >= NW || cy >= NH) return false;
    if (cy >= 0 && b[cy * NW + cx]) return false;
  }
  return true;
}
// la hauteur de la pile (en lignes depuis le bas)
export function stackH(b) { for (let y = 0; y < NH; y++) for (let x = 0; x < NW; x++) if (b[y * NW + x]) return NH - y; return 0; }
// où la pièce tomberait (sa ligne)
export function dropY(b, k, r, x, y) { while (fits(b, k, r, x, y + 1)) y++; return y; }
// enlève les lignes pleines, rend leur nombre
function clearRows(b) {
  let n = 0;
  for (let y = NH - 1; y >= 0; y--) {
    let full = true;
    for (let x = 0; x < NW; x++) if (!b[y * NW + x]) { full = false; break; }
    if (!full) continue;
    n++;
    for (let yy = y; yy > 0; yy--) for (let x = 0; x < NW; x++) b[yy * NW + x] = b[(yy - 1) * NW + x];
    for (let x = 0; x < NW; x++) b[x] = 0;
    y++;
  }
  return n;
}

export default {
  name: 'Tetris express',

  init(W) {
    const b = new Array(NW * NH).fill(0);
    const well = W.rng.int(0, NW - 1);
    for (let y = NH - TET.FILL; y < NH; y++) {
      const hole = W.rng() < 0.72 ? well : W.rng.int(0, NW - 1);
      for (let x = 0; x < NW; x++) b[y * NW + x] = x === hole ? 0 : 8;
    }
    // le dessus déchiqueté : quelques trous de plus sur la ligne du haut, quelques bosses au-dessus
    const top = NH - TET.FILL;
    for (let n = W.rng.int(2, 3); n > 0; n--) b[top * NW + W.rng.int(0, NW - 1)] = 0;
    for (let n = W.rng.int(2, 4); n > 0; n--) { const x = W.rng.int(0, NW - 1); if (x !== well && b[top * NW + x]) b[(top - 1) * NW + x] = 8; }
    const pl = () => ({ b: b.slice(), k: 0, r: 0, x: 3, y: 0, n: 0, fall: 0, land: 0, dir: 0, dh: 0, up: 0, lines: 0, pen: 0, tops: 0, pcs: 0,
      ai: { tr: 0, tx: 3, cd: 0, tries: 0, bk: 0.8 + W.rng() * 0.4 } });
    const g = { seq: [], p: [pl(), pl()], over: 0 };
    for (let i = 0; i < 2; i++) spawn(W, M0, g, i);
    return g;
  },

  step(W, M, g, ia, iv) {
    const ins = [ia, iv];
    const grav = Math.round(TET.GRAV[0] + (TET.GRAV[1] - TET.GRAV[0]) * Math.min(1, M.t / MG_PLAY));
    for (let i = 0; i < 2; i++) {
      const P = g.p[i], I = ins[i] || tetBot(W, M, g, i, botLevel(W, M, i));
      // bouger (un cran à l'appui, puis en rafale si on tient)
      const dir = I.mx > 0.5 ? 1 : I.mx < -0.5 ? -1 : 0;
      if (dir !== P.dir) { P.dir = dir; P.dh = 0; if (dir) move(P, dir); }
      else if (dir && ++P.dh >= TET.DAS && (P.dh - TET.DAS) % TET.ARR === 0) move(P, dir);
      // tourner (▲ au front montant, A ou X)
      const up = I.my > 0.5 ? 1 : 0;
      if ((up && !P.up) || (I.pressed & BTN.A)) rotate(W, P, i, 1);
      else if (I.pressed & BTN.X) rotate(W, P, i, 3);
      P.up = up;
      // lâcher d'un coup
      if (I.pressed & BTN.JUMP) {
        const y = dropY(P.b, P.k, P.r, P.x, P.y);
        W.emit('mgTetrisDrop', { p: i, d: y - P.y, x: P.x });
        P.y = y; lock(W, M, g, i); continue;
      }
      // la chute (▼ : vite)
      const soft = I.my < -0.5;
      if (++P.fall >= (soft ? TET.SOFT : grav)) {
        P.fall = 0;
        if (fits(P.b, P.k, P.r, P.x, P.y + 1)) { P.y++; P.land = 0; continue; }
      }
      if (!fits(P.b, P.k, P.r, P.x, P.y + 1)) { if (++P.land >= (soft ? 4 : TET.LOCK)) lock(W, M, g, i); }
      else P.land = 0;
    }
  },

  result(W, M, g) {
    const sc = g.p.map((P) => (NH + 8 - stackH(P.b) - P.pen) * 10 + Math.min(9, P.lines));
    return scorePayout(W, M, sc[0], sc[1], 15, 2.2, 70, { ha: stackH(g.p[0].b) + g.p[0].pen, hv: stackH(g.p[1].b) + g.p[1].pen });
  },
};
const M0 = { t: 0 };

function move(P, d) { if (fits(P.b, P.k, P.r, P.x + d, P.y)) { P.x += d; P.land = Math.min(P.land, TET.LOCK - 6); } }
function rotate(W, P, i, s) {
  const r = (P.r + s) & 3;
  for (const kx of KICKS) if (fits(P.b, P.k, r, P.x + kx, P.y)) { P.r = r; P.x += kx; P.land = Math.min(P.land, TET.LOCK - 6); return; }
  if (fits(P.b, P.k, r, P.x, P.y - 1)) { P.r = r; P.y--; }
}

function nextPiece(W, g, n) {
  while (g.seq.length <= n) { // des sacs de 7, mélangés (les mêmes pour les deux)
    const bag = [0, 1, 2, 3, 4, 5, 6];
    for (let k = 6; k > 0; k--) { const j = W.rng.int(0, k); const x = bag[k]; bag[k] = bag[j]; bag[j] = x; }
    g.seq.push(...bag);
  }
  return g.seq[n];
}

function spawn(W, M, g, i) {
  const P = g.p[i];
  P.k = nextPiece(W, g, P.n); nextPiece(W, g, P.n + 2); P.n++;
  P.r = 0; P.x = P.k === 1 ? 4 : 3; P.y = P.k === 0 ? -1 : 0; P.fall = 0; P.land = 0; P.ai.cd = 0; P.ai.tries = 0; P.ai.plan = 0;
  if (!fits(P.b, P.k, P.r, P.x, P.y)) {
    // ça déborde : les 4 lignes du haut de la pile sautent (et comptent quand même)
    const h = stackH(P.b), from = NH - h;
    for (let y = from; y < Math.min(NH, from + TET.TOP_PEN); y++) for (let x = 0; x < NW; x++) P.b[y * NW + x] = 0;
    P.pen += TET.TOP_PEN; P.tops++;
    W.emit('mgTetrisTop', { p: i, h });
  }
}

function lock(W, M, g, i) {
  const P = g.p[i];
  let over = 0;
  for (const [dx, dy] of PIECES[P.k][P.r]) { const cy = P.y + dy; if (cy < 0) { over = 1; continue; } P.b[cy * NW + P.x + dx] = P.k + 1; }
  P.pcs++;
  const n = clearRows(P.b);
  P.lines += n;
  W.emit('mgTetrisLock', { p: i, x: P.x, y: P.y, k: P.k, r: P.r, h: stackH(P.b) });
  if (n) W.emit('mgTetrisClear', { p: i, n, h: stackH(P.b), lines: P.lines });
  if (over) { P.pen += 1; }
  spawn(W, M, g, i);
}

// la note d'une place (plus haut = mieux) : pile basse, peu de trous, surface plate, lignes faites
function evalPlace(b, k, r, x, w) {
  if (!fits(b, k, r, x, -2)) return -1e9;
  const y = dropY(b, k, r, x, -2), c = b.slice();
  for (const [dx, dy] of PIECES[k][r]) { if (y + dy < 0) return -1e8; c[(y + dy) * NW + x + dx] = 9; }
  const lines = clearRows(c);
  let agg = 0, holes = 0, bump = 0, maxH = 0, prev = -1;
  for (let cx = 0; cx < NW; cx++) {
    let h = 0, seen = false;
    for (let cy = 0; cy < NH; cy++) {
      if (c[cy * NW + cx]) { if (!seen) { seen = true; h = NH - cy; } } else if (seen) holes++;
    }
    agg += h; if (h > maxH) maxH = h;
    if (prev >= 0) bump += Math.abs(h - prev);
    prev = h;
  }
  return -0.5 * agg + lines * w.l - holes * w.h - bump * 0.18 - maxH * 0.9;
}

// CPU : choisit la meilleure place à l'apparition de la pièce (avec plus ou moins d'erreurs), puis s'y rend, une
// action toutes les quelques images, et lâche (brutal) ou descend vite
function tetBot(W, M, g, i, lvl) {
  const P = g.p[i], A = P.ai, I = { mx: 0, my: 0, held: 0, pressed: 0 };
  if (!A.plan) {
    A.plan = 1;
    const w = { l: [2, 3.2, 4][lvl - 1] * A.bk, h: [0.9, 2.2, 3.6][lvl - 1] / A.bk };
    const noise = [6, 2.2, 0.5][lvl - 1];
    let best = -1e18;
    for (let r = 0; r < (P.k === 1 ? 1 : 4); r++) {
      for (let x = -2; x < NW; x++) {
        const s = evalPlace(P.b, P.k, r, x, w);
        if (s < -1e7) continue;
        const v = s + W.rng() * noise;
        if (v > best) { best = v; A.tr = r; A.tx = x; }
      }
    }
    A.cd = [14, 8, 4][lvl - 1] + W.rng.int(0, 4);
  }
  if (A.cd > 0) { A.cd--; return I; }
  A.cd = [6, 3, 1][lvl - 1] + (W.rng() < 0.25 ? 1 : 0);
  if (P.r !== A.tr && A.tries < 6) { A.tries++; I.pressed = BTN.A; return I; }
  if (P.x !== A.tx) {
    const before = P.x, d = A.tx > P.x ? 1 : -1;
    if (!fits(P.b, P.k, P.r, P.x + d, P.y)) { A.tx = before; return I; } // bloqué : tant pis, il lâche là
    P.dir = 0; I.mx = d; return I;
  }
  if (lvl >= 2 || W.rng() < 0.3) I.pressed = BTN.JUMP; else I.my = -1;
  return I;
}
