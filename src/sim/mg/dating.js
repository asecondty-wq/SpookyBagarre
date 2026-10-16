// Drague de Skanky (dating) : Skanky drague un voyou, façon jeu de drague. Le voyou lance une phrase, trois réponses
// apparaissent (◀ ▲ ▶) : une qu'il adore (clairement la meilleure), une bof, une qui le vexe. Les mêmes phrases et les
// mêmes réponses aux mêmes places pour les deux (g.lines, tirées au début), chacun à son rythme. La bonne : +25 d'amour ;
// bof : +6 ; la vexante : -14 ; trop long (DL images) : il s'ennuie, -5. Le premier à 100 d'amour gagne tout de suite ;
// sinon le plus amoureux à la fin. Le perdant prend 15 % + l'écart / 25.
import { clampN, scorePayout, botLevel } from './common.js';

export const DATING = { LINES: 10, GAP: 36, DL: 260, GAIN: [25, 6, -14], BORED: 5, FULL: 100 };

export default {
  name: 'Drague de Skanky',

  init(W, A, V) {
    const ids = [];
    for (let k = 0; k < DATING.LINES; k++) ids.push(k);
    for (let k = ids.length - 1; k > 0; k--) { const j = W.rng.int(0, k); const s = ids[k]; ids[k] = ids[j]; ids[j] = s; }
    // pour chaque phrase : quelle réponse (0 la meilleure, 1 bof, 2 vexante) à quelle place (◀ ▲ ▶)
    const lines = ids.map((id) => {
      const ord = [0, 1, 2];
      for (let k = 2; k > 0; k--) { const j = W.rng.int(0, k); const s = ord[k]; ord[k] = ord[j]; ord[j] = s; }
      return { id, ord };
    });
    const pl = (F) => ({ n: 0, t: 0, gap: 24, love: 0, armed: 1, last: -1, good: 0, bad: 0, streak: 0, won: 0,
      b: { lvl: F.bot || 2, k: 0.85 + W.rng() * 0.35, seen: -1, rt: 0, pick: 0 } });
    return { lines, p: [pl(A), pl(V)], over: 0 };
  },

  step(W, M, g, ia, iv) {
    const ins = [ia, iv];
    for (let i = 0; i < 2; i++) {
      const P = g.p[i], I = ins[i];
      let c = -1;
      if (I) {
        const ax = Math.abs(I.mx), ay = Math.abs(I.my);
        if (ax < 0.35 && ay < 0.35) P.armed = 1;
        else if (P.armed && Math.max(ax, ay) > 0.6) { P.armed = 0; c = ax >= ay ? (I.mx < 0 ? 0 : 2) : (I.my > 0 ? 1 : -1); }
      }
      if (P.gap > 0) { if (--P.gap === 0) { P.t = 0; W.emit('mgDatingLine', { p: i, n: P.n, id: g.lines[P.n % DATING.LINES].id }); } continue; }
      P.t++;
      if (!I) c = datingBot(W, M, g, i);
      const L = g.lines[P.n % DATING.LINES];
      if (c >= 0) {
        const q = L.ord[c], d = DATING.GAIN[q];
        P.love = clampN(P.love + d, 0, DATING.FULL); P.last = q;
        if (q === 0) { P.good++; P.streak++; } else { P.streak = 0; if (q === 2) P.bad++; }
        W.emit('mgDatingPick', { p: i, c, q, d, love: P.love, st: P.streak, f: P.t });
        P.n++; P.gap = DATING.GAP;
        if (P.love >= DATING.FULL) { P.won = M.t; g.over = 1; W.emit('mgDatingWin', { p: i }); }
      } else if (P.t >= DATING.DL) {
        P.love = Math.max(0, P.love - DATING.BORED); P.streak = 0; P.last = 3;
        W.emit('mgDatingBored', { p: i, love: P.love });
        P.n++; P.gap = DATING.GAP;
      }
    }
  },

  result(W, M, g) {
    const sc = (P) => P.love * 10 + (P.won ? 300 : 0);
    return scorePayout(W, M, sc(g.p[0]), sc(g.p[1]), 15, 25, 70, { la: g.p[0].love, lv: g.p[1].love });
  },
};

// le CPU : lit la phrase et les réponses (selon son niveau), choisit la meilleure le plus souvent
function datingBot(W, M, g, i) {
  const P = g.p[i], b = P.b, lvl = botLevel(W, M, i), L = g.lines[P.n % DATING.LINES];
  if (b.seen !== P.n) {
    b.seen = P.n;
    b.rt = Math.round(([96, 72, 54][lvl - 1] + W.rng() * [40, 30, 20][lvl - 1]) * b.k);
    const r = W.rng(), pb = [0.55, 0.72, 0.88][lvl - 1];
    b.pick = r < pb ? 0 : r < pb + (1 - pb) * 0.65 ? 1 : 2;
  }
  if (--b.rt > 0) return -1;
  return L.ord.indexOf(b.pick);
}
