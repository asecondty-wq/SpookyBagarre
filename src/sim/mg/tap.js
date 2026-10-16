// Le verre parfait (tap) : chacun son robinet et son verre (l'attaquant à gauche). Les verres arrivent en même temps pour
// les deux, avec le même trait et le même débit. L'eau monte de plus en plus vite : le niveau vaut L x r x (0,55 + 0,45 r), r = u / tl
// (u images du début, tl : le temps pour atteindre le trait L) ; A (ou X) ferme le robinet. Au-delà du bord (1), ça
// déborde : 0 point. Sinon les points selon l'écart au trait (100 au pile). Le verre suivant arrive quand les deux ont
// fini (ou débordé). Le score : la somme des points. Le perdant prend 15 % + l'écart / 4 (65 % au plus).
import { BTN, MG_PLAY, scorePayout, botLevel } from './common.js';

export const TAP = { PERF: 0.012, START: 40, PAUSE: 46, MAX: 7 };
const PRESS = BTN.A | BTN.X;
const gauss = (W) => (W.rng() + W.rng() + W.rng() + W.rng() - 2) * 1.73;

// le niveau de l'eau à u images du début du verre gl
export function level(gl, u) { if (u <= 0) return 0; const r = u / gl.tl; return gl.L * r * (0.55 + 0.45 * r); }
// l'image où l'eau atteint le niveau w (u tel que level = w)
export const frameAt = (gl, w) => gl.tl * (Math.sqrt(0.3025 + 1.8 * w / gl.L) - 0.55) / 0.9;
export function tapPts(err) {
  if (err <= TAP.PERF) return 100;
  return Math.max(0, Math.round(92 - (err - TAP.PERF) * 820));
}

export default {
  name: 'Le verre parfait',

  init(W) {
    // les verres (les mêmes pour les deux) : le trait de plus en plus haut ou bas au hasard, de plus en plus vite
    const gls = [];
    for (let k = 0; k < TAP.MAX; k++) gls.push({ L: Math.round((0.5 + W.rng() * 0.38) * 1000) / 1000, tl: Math.round(Math.max(54, 104 - k * 9 + W.rng.int(-8, 8))) });
    const pl = () => ({ w: 0, done: 0, cut: -1, pts: 0, s: 0, last: -1, perf: 0, spill: 0, bk: 0.75 + W.rng() * 0.5, tg: -1 });
    return { gls, k: -1, u: 0, wait: TAP.START, p: [pl(), pl()], over: 0 };
  },

  step(W, M, g, ia, iv) {
    const ins = [ia, iv];
    if (g.k < 0 || g.wait > 0) {
      // entre deux verres : le suivant arrive (s'il a le temps de se remplir avant la fin)
      if (g.wait > 0 && --g.wait > 0) return;
      const nk = g.k + 1, gl = g.gls[nk];
      if (!gl || M.t + frameAt(gl, 1) + 12 > MG_PLAY) { g.wait = 0; g.k = TAP.MAX; return; }
      g.k = nk; g.u = 0;
      for (const P of g.p) { P.w = 0; P.done = 0; P.cut = -1; P.pts = 0; P.tg = -1; }
      W.emit('mgTapGlass', { k: nk, L: Math.round(gl.L * 1000), tl: gl.tl });
      return;
    }
    if (g.k >= TAP.MAX) return;
    const gl = g.gls[g.k];
    g.u++;
    const w = level(gl, g.u);
    for (let i = 0; i < 2; i++) {
      const P = g.p[i], I = ins[i];
      if (P.done) continue;
      P.w = w;
      let cut = false;
      if (I) cut = !!(I.pressed & PRESS);
      else {
        if (P.tg < 0) { // le CPU vise le trait, plus ou moins juste (le facile déborde parfois)
          const lvl = botLevel(W, M, i);
          P.tg = Math.min(1.08, Math.max(0.2, gl.L + gauss(W) * [0.055, 0.03, 0.014][lvl - 1] * P.bk + [0.012, 0.006, 0.002][lvl - 1]));
        }
        cut = w >= P.tg;
      }
      if (w >= 1) {
        P.done = 1; P.w = 1; P.cut = 1; P.pts = 0; P.last = 0; P.spill++;
        W.emit('mgTapSpill', { p: i, k: g.k });
      } else if (cut) {
        const err = Math.abs(w - gl.L), pts = tapPts(err), perf = err <= TAP.PERF ? 1 : 0;
        P.done = 1; P.cut = w; P.pts = pts; P.s += pts; P.last = pts; P.perf += perf;
        W.emit('mgTapCut', { p: i, k: g.k, w: Math.round(w * 1000), d: Math.round((w - gl.L) * 1000), pts, perf, s: P.s });
      }
    }
    if (g.p[0].done && g.p[1].done) { g.wait = TAP.PAUSE; W.emit('mgTapNext', { k: g.k }); }
  },

  result(W, M, g) { return scorePayout(W, M, g.p[0].s, g.p[1].s, 15, 4, 65); },
};
