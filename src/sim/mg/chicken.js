// Master poulet (chicken) : chacun son seau (l'attaquant à gauche), les mêmes morceaux dans le même ordre pour les deux.
// Chaque appui sur A (ou X) est une bouchée ; un morceau demande quelques bouchées (aile 3, pilon 4, cuisse 5, le
// morceau doré 4 mais il compte double). Au plus une bouchée toutes les CHK.GAP images (on mâche !). Le score : les
// points des morceaux finis. Le perdant prend 15 % + l'écart / 0,2 (60 % au plus).
import { BTN, scorePayout, botLevel } from './common.js';

export const CHK = { GAP: 4, BITES: [3, 4, 5, 4], PTS: [1, 1, 1, 2], N: 60 };
const PRESS = BTN.A | BTN.X;

export default {
  name: 'Master poulet',

  init(W) {
    // les morceaux du seau (les mêmes pour les deux) : un doré de temps en temps, jamais deux de suite
    const seq = [];
    for (let k = 0; k < CHK.N; k++) seq.push(k > 2 && seq[k - 1] !== 3 && W.rng() < 0.16 ? 3 : W.rng.int(0, 2));
    const pl = () => ({ k: 0, b: 0, s: 0, n: 0, cd: 0, acc: W.rng(), rate: 0.85 + W.rng() * 0.3, pz: 0 });
    return { seq, p: [pl(), pl()], over: 0 };
  },

  step(W, M, g, ia, iv) {
    const ins = [ia, iv];
    for (let i = 0; i < 2; i++) {
      const P = g.p[i], I = ins[i];
      if (P.cd > 0) P.cd--;
      let bite = false;
      if (I) bite = !!(I.pressed & PRESS);
      else {
        const lvl = botLevel(W, M, i);
        if (P.pz > 0) P.pz--;
        else {
          P.acc += [5.6, 7, 8.6][lvl - 1] * P.rate * (0.8 + W.rng() * 0.4) / 60;
          if (P.acc >= 1) { P.acc -= 1; bite = true; }
          if (W.rng() < [0.01, 0.007, 0.004][lvl - 1]) P.pz = 10 + W.rng.int(0, 20); // un rot, une gorgée de soda
        }
      }
      if (!bite || P.cd > 0) continue;
      P.cd = CHK.GAP;
      const kind = g.seq[P.k % CHK.N], need = CHK.BITES[kind];
      P.b++;
      W.emit('mgChkBite', { p: i, b: P.b, n: need, k: kind });
      if (P.b >= need) {
        P.s += CHK.PTS[kind]; P.n++; P.k++; P.b = 0;
        W.emit('mgChkDone', { p: i, k: kind, s: P.s, n: P.n });
      }
    }
  },

  result(W, M, g) { return scorePayout(W, M, g.p[0].s, g.p[1].s, 15, 0.2, 60); },
};
