// Casse-briques de BIDO (breakout) : chacun son terrain, le même mur de briques (tiré au début, symétrique). La balle part
// toute seule ; on la renvoie avec la raquette (◀ ▶ ; au clavier elle accélère tant qu'on tient). Brique 1 point, brique
// dure (2 coups) 2, brique en or 3. Toutes les 3 briques d'affilée sans perdre la balle (la série), BIDO, à côté, casse
// une brique d'un coup de poing (et elle compte). Balle perdue : -2 et elle revient sur la raquette après un temps.
// Coordonnées : dans le terrain de chacun, (0, 0) en haut à gauche, x vers la droite, y vers le bas.
import { DIGITAL, DMath, clampN, scorePayout, payout, botLevel } from './common.js';

export const BK = {
  FW: 220, FH: 270, COLS: 8, ROWS: 7, BY: 42, BH: 13, PY: 240, PW: 48, PH: 7, R: 4.5, PSPEED: 290,
  SP0: 235, SPMAX: 345, WAIT: 36, LOSE: 2, PTS: [0, 1, 1, 0, 3], COMBO: 3,
};
const BW = BK.FW / BK.COLS;
export const brickW = BW;

export default {
  name: 'Casse-briques de BIDO',

  init(W) {
    const L = new Array(BK.COLS * BK.ROWS).fill(0);
    for (let r = 0; r < BK.ROWS; r++) {
      for (let c = 0; c < BK.COLS / 2; c++) {
        const x = W.rng();
        const t = x < 0.1 ? 0 : x < 0.16 && r < 3 ? 4 : x < 0.38 ? 2 : 1;
        L[r * BK.COLS + c] = t; L[r * BK.COLS + BK.COLS - 1 - c] = t;
      }
    }
    const pl = () => ({ px: BK.FW / 2, pv: 0, kh: 0, bx: BK.FW / 2, by: BK.PY - 6, vx: 0, vy: 0, live: 0, wait: 20, b: L.slice(), s: 0, n: 0, lost: 0,
      combo: 0, best: 0, punch: 0, st: 0, launches: 0, ai: { tx: BK.FW / 2, cd: 0, err: 0, lastVy: 0, bk: 0.8 + W.rng() * 0.4 } });
    return { L, p: [pl(), pl()], over: 0 };
  },

  step(W, M, g, ia, iv) {
    const ins = [ia, iv];
    for (let i = 0; i < 2; i++) {
      const P = g.p[i], I = ins[i] || bkBot(W, M, g, i, botLevel(W, M, i));
      // la raquette
      let v = clampN(I.mx, -1, 1) * BK.PSPEED;
      if (I.held & DIGITAL) { P.kh = I.mx ? P.kh + 1 : 0; v *= Math.min(1, 0.38 + P.kh / 14); }
      P.pv += (v - P.pv) * 0.45;
      P.px = clampN(P.px + P.pv / 60, BK.PW / 2, BK.FW - BK.PW / 2);
      // la balle sur la raquette, puis lancée toute seule
      if (!P.live) {
        P.bx = P.px; P.by = BK.PY - BK.R - 1;
        if (--P.wait <= 0) {
          const a = (P.launches % 2 ? 0.42 : -0.42) + (W.rng() - 0.5) * 0.2, sp = speedAt(M);
          P.vx = sp * DMath.sin(a); P.vy = -sp * DMath.cos(a); P.live = 1; P.launches++;
          W.emit('mgBreakLaunch', { p: i });
        }
        continue;
      }
      const n = Math.max(1, Math.ceil(Math.max(Math.abs(P.vx), Math.abs(P.vy)) / 60 / 2.5));
      for (let s = 0; s < n && P.live; s++) stepBall(W, M, g, i, P, 1 / 60 / n);
    }
  },

  result(W, M, g) {
    const [a, b] = g.p;
    if (a.s === b.s && a.st !== b.st) { // égalité : celui qui y est arrivé le premier
      const w = a.st < b.st ? 0 : 1;
      return payout(W, w === 0 ? M.a : M.v, w === 0 ? M.v : M.a, 15, { sa: a.s, sv: b.s, kbb: 18, kbg: 180 });
    }
    return scorePayout(W, M, a.s, b.s, 15, 0.6, 70, { na: a.n, nv: b.n });
  },
};

const speedAt = (M) => Math.min(BK.SPMAX, BK.SP0 + M.t * 0.16);

function stepBall(W, M, g, i, P, dt) {
  const ox = P.bx, oy = P.by, R = BK.R;
  P.bx += P.vx * dt; P.by += P.vy * dt;
  if (P.bx < R) { P.bx = R; P.vx = Math.abs(P.vx); W.emit('mgBreakWall', { p: i }); }
  else if (P.bx > BK.FW - R) { P.bx = BK.FW - R; P.vx = -Math.abs(P.vx); W.emit('mgBreakWall', { p: i }); }
  if (P.by < R) { P.by = R; P.vy = Math.abs(P.vy); W.emit('mgBreakWall', { p: i }); }
  // les briques (une par pas)
  const c = Math.floor(P.bx / BW), r = Math.floor((P.by - BK.BY) / BK.BH);
  if (c >= 0 && c < BK.COLS && r >= 0 && r < BK.ROWS && P.b[r * BK.COLS + c]) {
    const pc = Math.floor(ox / BW), pr = Math.floor((oy - BK.BY) / BK.BH);
    if (pc !== c && pr === r) P.vx = -P.vx; else P.vy = -P.vy;
    P.bx = ox; P.by = oy;
    hitBrick(W, M, g, i, r * BK.COLS + c, 0);
    if (P.combo > 0 && P.combo % BK.COMBO === 0) bidoPunch(W, M, g, i);
  }
  // la raquette
  if (P.vy > 0 && oy + R <= BK.PY + 2 && P.by + R >= BK.PY && Math.abs(P.bx - P.px) <= BK.PW / 2 + R) {
    const o = clampN((P.bx - P.px) / (BK.PW / 2), -1, 1), a = o * 1.05, sp = speedAt(M);
    P.vx = sp * DMath.sin(a); P.vy = -sp * DMath.cos(a); P.by = BK.PY - R;
    W.emit('mgBreakPaddle', { p: i, o: Math.round(o * 100), combo: P.combo });
  }
  if (P.by > BK.FH + 8) {
    P.live = 0; P.wait = BK.WAIT; P.lost++; P.s -= BK.LOSE; P.combo = 0;
    W.emit('mgBreakLose', { p: i, x: Math.round(P.bx), s: P.s });
  }
}

// punch : la brique cassée par BIDO (d'un coup, même dure)
function hitBrick(W, M, g, i, k, punch) {
  const P = g.p[i], t = P.b[k];
  P.st = M.t;
  if (t === 2 && !punch) { P.b[k] = 1; P.s += 1; W.emit('mgBreakHit', { p: i, k, t, left: 1, s: P.s, combo: P.combo, punch }); return; }
  P.b[k] = 0; P.s += BK.PTS[t] + (t === 2 ? 1 : 0) * (punch ? 1 : 0); P.n++;
  if (!punch) { P.combo++; if (P.combo > P.best) P.best = P.combo; }
  W.emit('mgBreakHit', { p: i, k, t, left: 0, s: P.s, combo: P.combo, punch });
  let any = 0;
  for (let n = 0; n < P.b.length; n++) if (P.b[n]) { any = 1; break; }
  if (!any) { P.b = g.L.slice(); W.emit('mgBreakWave', { p: i }); }
}

// BIDO cogne une brique au hasard parmi celles du bas de chaque colonne
function bidoPunch(W, M, g, i) {
  const P = g.p[i], low = [];
  for (let c = 0; c < BK.COLS; c++) for (let r = BK.ROWS - 1; r >= 0; r--) if (P.b[r * BK.COLS + c]) { low.push(r * BK.COLS + c); break; }
  if (!low.length) return;
  const k = low[W.rng.int(0, low.length - 1)];
  P.punch++;
  W.emit('mgBreakPunch', { p: i, k, combo: P.combo });
  hitBrick(W, M, g, i, k, 1);
}

// CPU : vise où la balle arrivera (rebonds sur les murs compris), avec une erreur tirée à chaque renvoi et un temps de
// réaction ; facile, il se fait parfois avoir
function bkBot(W, M, g, i, lvl) {
  const P = g.p[i], A = P.ai, I = { mx: 0, my: 0, held: 0, pressed: 0 };
  if (--A.cd <= 0) {
    A.cd = [10, 5, 2][lvl - 1] + W.rng.int(0, 3);
    let tx = BK.FW / 2;
    if (P.live && P.vy > 0) {
      const t = (BK.PY - P.by) / P.vy;
      let x = P.bx + P.vx * t;
      const span = BK.FW * 2;
      x = ((x % span) + span) % span; if (x > BK.FW) x = span - x;
      tx = x;
    } else if (P.live) tx = BK.FW / 2 + (P.bx - BK.FW / 2) * 0.5;
    if (P.live && P.vy > 0 && Math.abs(A.lastVy - P.vy) > 1) A.err = (W.rng() - 0.5) * [70, 34, 12][lvl - 1] / A.bk;
    A.lastVy = P.vy;
    A.tx = tx + A.err;
  }
  const d = A.tx - P.px;
  I.mx = Math.abs(d) < 3 ? 0 : clampN(d / 18, -1, 1) * [0.62, 0.85, 1][lvl - 1];
  return I;
}
