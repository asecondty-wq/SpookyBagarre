// Évasion de la télé (tvbreak) : chacun est enfermé dans une télé cathodique (l'attaquant à gauche). Chaque appui sur A
// (ou X) est un coup de poing dans la vitre : TVB.HITS coups pour la casser et sortir. Le premier dehors gagne ; fin
// anticipée quand les deux sont sortis (après un petit temps pour la fête). Au temps, le plus avancé gagne.
// Score : les coups portés (au plus HITS), plus un bonus de sortie qui grandit avec le temps qui restait.
// Le perdant prend 15 % + l'écart / 0,6 (60 % au plus).
import { BTN, MG_PLAY, scorePayout, botLevel } from './common.js';

export const TVB = { HITS: 42, STAGES: [10, 21, 32], GAP: 3, AFTER: 70 };
const PRESS = BTN.A | BTN.X;

// la vitre en étapes : 0 intacte, 1, 2, 3 de plus en plus fendue, 4 cassée
export const stageOf = (h) => (h >= TVB.HITS ? 4 : h >= TVB.STAGES[2] ? 3 : h >= TVB.STAGES[1] ? 2 : h >= TVB.STAGES[0] ? 1 : 0);

export default {
  name: 'Évasion de la télé',

  init(W) {
    // le CPU : sa cadence de base (coups par seconde), son humeur, ses pauses (il souffle, il regarde l'autre)
    const pl = () => ({ h: 0, out: 0, cd: 0, acc: W.rng(), rate: 0.85 + W.rng() * 0.3, pz: 0, wob: W.rng() * 6.28 });
    return { p: [pl(), pl()], first: -1, end: 0, over: 0 };
  },

  step(W, M, g, ia, iv) {
    const ins = [ia, iv];
    for (let i = 0; i < 2; i++) {
      const P = g.p[i], I = ins[i];
      if (P.cd > 0) P.cd--;
      if (P.out) continue;
      let hit = false;
      if (I) hit = !!(I.pressed & PRESS);
      else {
        const lvl = botLevel(W, M, i);
        if (P.pz > 0) P.pz--;
        else {
          P.wob += 0.05 + W.rng() * 0.04;
          const r = [5.4, 6.7, 8.1][lvl - 1] * P.rate * (1 + 0.18 * (P.wob % 2 < 1 ? 1 : -1) * (W.rng() * 0.5 + 0.5));
          P.acc += r / 60;
          if (P.acc >= 1) { P.acc -= 1; hit = true; }
          if (W.rng() < [0.012, 0.008, 0.004][lvl - 1]) P.pz = 8 + W.rng.int(0, 16); // il souffle un peu
        }
      }
      if (!hit || P.cd > 0) continue;
      P.cd = TVB.GAP - 1; // (au plus 20 coups par seconde : un clavier qui rebondit ne compte pas double)
      const st0 = stageOf(P.h);
      P.h++;
      const st = stageOf(P.h);
      W.emit('mgTvbHit', { p: i, h: P.h, st, up: st > st0 ? 1 : 0 });
      if (P.h >= TVB.HITS) {
        P.out = M.t;
        const first = g.first < 0 ? 1 : 0;
        if (first) g.first = i;
        W.emit('mgTvbOut', { p: i, t: M.t, first });
      }
    }
    if (g.p[0].out && g.p[1].out) { if (++g.end >= TVB.AFTER) g.over = 1; }
  },

  result(W, M, g) {
    const sc = (P) => (P.out ? TVB.HITS + (MG_PLAY - P.out) / 10 : P.h);
    return scorePayout(W, M, sc(g.p[0]), sc(g.p[1]), 15, 0.6, 60);
  },
};
