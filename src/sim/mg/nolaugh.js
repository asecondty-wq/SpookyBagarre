// Ne rigole pas (nolaugh) : des vidéos toktok ridicules passent sur le téléphone de chacun (les mêmes, au même moment :
// c'est juste). Sous chaque vidéo, la chute de la blague (un marqueur) glisse vers la zone « APPUIE ! » ; il faut appuyer (A)
// pile quand elle y arrive pour serrer les dents. Trop tôt, trop tard ou rien : on éclate de rire, des points en moins.
// PARFAIT ±PERF images = 100 points, BIEN ±GOOD = 60, un fou rire = -40 (et la jauge de rire monte).
import { BTN, MG_PLAY, scorePayout, botLevel } from './common.js';

export const NL = { START: 40, GAP: 36, PERF: 4, GOOD: 10, NV: 10, PTS: [0, 60, 100], LAUGH: 40, LT: 54 };
const PRESS = BTN.A | BTN.X | BTN.JUMP;
const gauss = (W) => (W.rng() + W.rng() + W.rng() + W.rng() - 2) * 1.73;

// où en est la chute de la blague (0 au départ, 1 dans la zone : elle avance régulièrement) ; partagé avec l'affichage
export function nlPos(J, t) { return Math.max(0, Math.min(1.2, (t - J.s) / (J.p - J.s))); }

export default {
  name: 'Ne rigole pas',

  init(W) {
    // les vidéos : un sac mélangé, puis les blagues (de plus en plus courtes), les mêmes pour les deux
    const bag = [];
    for (let k = 0; k < NL.NV; k++) bag.push(k);
    for (let k = bag.length - 1; k > 0; k--) { const j = W.rng.int(0, k); const x = bag[k]; bag[k] = bag[j]; bag[j] = x; }
    const jokes = [];
    let t = NL.START;
    for (let n = 0; n < 8; n++) {
      const dur = W.rng.int(66, 90) - n * 5, p = t + dur;
      if (p + NL.GOOD + 4 > MG_PLAY) break;
      jokes.push({ s: t, p, v: bag[n % bag.length] });
      t = p + NL.GAP + W.rng.int(0, 8);
    }
    const pl = () => ({ s: 0, res: jokes.map(() => -1), laugh: 0, hold: 0, perf: 0, streak: 0, lt: 0, at: -1, bk: 0.75 + W.rng() * 0.5 });
    return { jokes, cur: 0, p: [pl(), pl()], over: 0 };
  },

  step(W, M, g, ia, iv) {
    const ins = [ia, iv], J = g.jokes[g.cur];
    for (let i = 0; i < 2; i++) { const P = g.p[i]; if (P.lt > 0) P.lt--; }
    if (!J) { if (M.t > g.jokes[g.jokes.length - 1].p + 50) g.over = 1; return; }
    if (M.t === J.s) {
      W.emit('mgNolaughJoke', { k: g.cur, v: J.v, s: J.s, p: J.p });
      // les CPU décident quand ils appuieront (plus ou moins bien ; parfois ils craquent)
      for (let i = 0; i < 2; i++) {
        if (ins[i]) continue;
        const P = g.p[i], lvl = botLevel(W, M, i), r = W.rng();
        if (r < [0.2, 0.09, 0.03][lvl - 1] * P.bk) P.at = W.rng() < 0.5 ? J.p - W.rng.int(16, 34) : -1;
        else P.at = J.p + Math.round(gauss(W) * [6.5, 3.8, 1.9][lvl - 1] * P.bk);
      }
    }
    if (M.t >= J.s) {
      for (let i = 0; i < 2; i++) {
        const P = g.p[i];
        if (P.res[g.cur] !== -1) continue;
        const I = ins[i], hit = I ? !!(I.pressed & PRESS) : M.t === P.at;
        const d = M.t - J.p;
        if (hit) {
          const q = Math.abs(d) <= NL.PERF ? 2 : Math.abs(d) <= NL.GOOD ? 1 : 0;
          judge(W, g, i, q, d);
        } else if (d > NL.GOOD) judge(W, g, i, 0, d);
      }
    }
    if (M.t > J.p + NL.GOOD) g.cur++;
  },

  result(W, M, g) { return scorePayout(W, M, g.p[0].s, g.p[1].s, 15, 9); },
};

// q : 2 parfait, 1 bien, 0 fou rire (d : l'écart en images, négatif = trop tôt)
function judge(W, g, i, q, d) {
  const P = g.p[i];
  P.res[g.cur] = q;
  if (q > 0) {
    P.s += NL.PTS[q]; P.hold++; P.streak++; if (q === 2) P.perf++;
    W.emit('mgNolaughHold', { p: i, q, d, s: P.s, n: P.streak });
  } else {
    P.s -= NL.LAUGH; P.laugh++; P.streak = 0; P.lt = NL.LT;
    W.emit('mgNolaughLaugh', { p: i, d, late: d > 0 ? 1 : 0, s: P.s, n: P.laugh });
  }
}
