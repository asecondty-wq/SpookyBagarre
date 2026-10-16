// Home run (homerun) : trois balles tombent du ciel, les mêmes au même moment pour les deux (l'attaquant à gauche). Une
// balle tombe pendant `fall` images et passe dans la zone de frappe à l'image `t1`. A (ou X) = un seul coup de batte par
// balle : à d images de t1, la distance vaut HR.MAX x (1 - (d / HR.WIN)²), + HR.BONUS au pile (|d| <= HR.PERF : HOME RUN) ;
// au-delà de HR.WIN (trop tôt ou trop tard), c'est raté (0 m) ; avant t1 - HR.EARLY, A ne fait rien. Le score : le total des distances.
// Le perdant prend 15 % + l'écart / 6 (65 % au plus).
import { BTN, scorePayout, botLevel } from './common.js';

export const HR = { EARLY: 32, WIN: 13, PERF: 1, MAX: 165, BONUS: 15, FENCE: 150, N: 3, T0: [70, 265, 455] };
const PRESS = BTN.A | BTN.X;
const gauss = (W) => (W.rng() + W.rng() + W.rng() + W.rng() - 2) * 1.73;

export function hrDist(d) {
  const a = Math.abs(d);
  if (a > HR.WIN) return 0;
  const u = a / (HR.WIN + 1);
  return Math.round(HR.MAX * (1 - u * u)) + (a <= HR.PERF ? HR.BONUS : 0);
}
// où en est la balle k à l'image t : 0 au départ (en haut), 1 dans la zone de frappe (au-delà : elle continue)
export const ballU = (b, t) => (t - b.t0) / b.fall;

export default {
  name: 'Home run',

  init(W) {
    const balls = HR.T0.map((t0) => { const fall = 92 + W.rng.int(0, 22); return { t0, fall, t1: t0 + fall }; });
    const pl = () => ({ sw: [-99, -99, -99], m: [-1, -1, -1], tot: 0, best: 0, bk: 0.75 + W.rng() * 0.5, plan: [-999, -999, -999] });
    return { balls, p: [pl(), pl()], over: 0 };
  },

  step(W, M, g, ia, iv) {
    const ins = [ia, iv], t = M.t;
    // la balle en jeu : celle dont la zone de frappe est la plus proche (on peut frapper de t1 - EARLY à t1 + WIN ; plus tôt, la batte ne part pas)
    let k = -1;
    for (let j = 0; j < HR.N; j++) { const b = g.balls[j]; if (t >= b.t1 - HR.EARLY && t <= b.t1 + HR.WIN) k = j; }
    if (t === g.balls[0].t0 || t === g.balls[1].t0 || t === g.balls[2].t0) W.emit('mgHrDrop', { k: g.balls.findIndex((b) => b.t0 === t) });
    for (let i = 0; i < 2; i++) {
      const P = g.p[i], I = ins[i];
      if (k < 0 || P.m[k] >= 0) continue;
      const b = g.balls[k];
      let swing = false;
      if (I) swing = !!(I.pressed & PRESS);
      else {
        if (P.plan[k] === -999) { // le CPU vise la zone, plus ou moins juste ; le facile rate parfois franchement
          const lvl = botLevel(W, M, i);
          let off = Math.round(gauss(W) * [6.5, 3.6, 1.9][lvl - 1] * P.bk);
          if (lvl === 1 && W.rng() < 0.12) off = (W.rng() < 0.5 ? -1 : 1) * (HR.WIN + 3);
          P.plan[k] = b.t1 + off;
        }
        swing = t === P.plan[k];
      }
      if (swing) {
        const d = t - b.t1, m = hrDist(d);
        P.sw[k] = d; P.m[k] = m; P.tot += m; if (m > P.best) P.best = m;
        W.emit('mgHrSwing', { p: i, k, d, m, hr: Math.abs(d) <= HR.PERF ? 1 : 0, tot: P.tot });
      } else if (t === b.t1 + HR.WIN) { // la balle est passée : prise !
        P.m[k] = 0; P.sw[k] = 99;
        W.emit('mgHrMiss', { p: i, k });
      }
    }
  },

  result(W, M, g) { return scorePayout(W, M, g.p[0].tot, g.p[1].tot, 15, 6, 65, { sa: g.p[0].tot, sv: g.p[1].tot }); },
};
