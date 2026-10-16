// Échec et menace (chess) : Epektase menace les deux joueurs pendant qu'ils cherchent le coup parfait. Chacun son petit
// échiquier, le même problème pour les deux (les blancs jouent, en bas) : un mat en un ou une prise gratuite, très simple.
// Trois coups proposés en grosses flèches, chacun sur une direction (◀ ▲ ▶) ; le stick d'un coup choisit (revenir au
// centre entre deux). Le premier juste marque (100 + la vitesse), problème suivant ; un mauvais : -30 et bloqué LOCK
// images (l'autre peut encore trouver) ; personne à temps : le suivant. Le meilleur score gagne.
import { clampN, scorePayout, botLevel } from './common.js';

export const CHESS = { LOCK: 50, GAP: 44, DL: 330, WRONG: 30 };
// les problèmes : les pièces (majuscule = blanc, minuscule = noir ; K roi, Q dame, R tour, B fou, N cavalier, P pion,
// puis la case), trois coups (le premier est le bon), le nom du bon coup (l'autocollant)
export const PUZZLES = [
  { p: 'Kg1 Ra1 kg8 pf7 pg7 ph7', m: ['a1a8', 'a1a7', 'g1f2'], name: 'MAT DU COULOIR' },
  { p: 'Kg1 Qd1 kg8 pf7 pg7 ph7', m: ['d1d8', 'd1d7', 'd1h5'], name: 'MAT DU COULOIR' },
  { p: 'Ke1 Qh5 Bc4 ke8 qd8 bf8 rh8 pd7 pf7 pg7 ph7', m: ['h5f7', 'h5h7', 'c4b5'], name: 'LE COUP DU BERGER' },
  { p: 'Ke1 Pe4 ke8 qd5', m: ['e4d5', 'e4e5', 'e1d2'], name: 'LE PION MANGE LA DAME' },
  { p: 'Kf6 Ra1 kf8', m: ['a1a8', 'a1a7', 'f6e6'], name: 'MAT !' },
  { p: 'Kg6 Qb2 kg8', m: ['b2g7', 'b2b7', 'b2h2'], name: 'MAT DU BAISER' },
  { p: 'Kg1 Re1 ka8 qe6', m: ['e1e6', 'e1e5', 'g1h1'], name: 'DAME GRATUITE' },
  { p: 'Kg1 Bc4 kh8 qf7', m: ['c4f7', 'c4d5', 'c4b5'], name: 'DAME GRATUITE' },
  { p: 'Kg1 Nc3 kh8 qd5', m: ['c3d5', 'c3b5', 'c3e4'], name: 'DAME GRATUITE' },
  { p: 'Kh1 Ra7 Rb1 kg8', m: ['b1b8', 'a7a8', 'b1g1'], name: "MAT DE L'ESCALIER" },
  { p: 'Kg1 Qd1 kg8 rd7 pf7 pg7 ph7', m: ['d1d7', 'd1d5', 'd1a4'], name: 'TOUR GRATUITE' },
  { p: 'Kg1 Ne5 kh8 rg8 pg7 ph7', m: ['e5f7', 'e5g6', 'e5d7'], name: "MAT DE L'ÉTOUFFÉ" },
];

export default {
  name: 'Échec et menace',

  init(W) {
    // l'ordre des problèmes : un sac mélangé
    const bag = PUZZLES.map((_, k) => k);
    for (let k = bag.length - 1; k > 0; k--) { const j = W.rng.int(0, k), x = bag[k]; bag[k] = bag[j]; bag[j] = x; }
    const pl = () => ({ s: 0, lock: 0, armed: 1, ok: 0, bad: 0, streak: 0, pick: -1, b: { k: 0.8 + W.rng() * 0.45, rt: 0, err: 0, seen: -1 } });
    return { ph: 'gap', t: 0, gap: 14, n: 0, bag, pz: -1, ord: [0, 1, 2], ok: 0, p: [pl(), pl()], last: -1, over: 0 };
  },

  step(W, M, g, ia, iv) {
    g.t++;
    if (g.ph === 'gap' && g.t >= g.gap) {
      g.pz = g.bag[g.n % g.bag.length]; g.n++;
      // les trois coups sur les trois directions, mélangés (ord[direction] = le coup)
      const o = [0, 1, 2];
      for (let k = 2; k > 0; k--) { const j = W.rng.int(0, k), x = o[k]; o[k] = o[j]; o[j] = x; }
      g.ord = o; g.ok = o.indexOf(0); g.ph = 'q'; g.t = 0; g.last = -1;
      for (const P of g.p) { P.lock = 0; P.pick = -1; }
      W.emit('mgChessQ', { n: g.n, pz: g.pz });
    }
    const ins = [ia, iv], good = [];
    for (let i = 0; i < 2; i++) {
      const P = g.p[i];
      if (P.lock > 0) P.lock--;
      const I = ins[i];
      let d = -1;
      if (I) {
        const ax = Math.abs(I.mx), ay = Math.abs(I.my);
        if (ax < 0.35 && ay < 0.35) P.armed = 1;
        else if (P.armed && Math.max(ax, ay) > 0.6) { P.armed = 0; d = ax >= ay ? (I.mx > 0 ? 2 : 0) : (I.my > 0 ? 1 : -1); }
      } else d = chessBot(W, M, g, P, i);
      if (d < 0 || g.ph !== 'q' || P.lock > 0) continue;
      P.pick = d;
      if (d === g.ok) good.push(i);
      else {
        P.lock = CHESS.LOCK; P.bad++; P.streak = 0; P.s = Math.max(0, P.s - CHESS.WRONG);
        W.emit('mgChessWrong', { p: i, d });
      }
    }
    if (g.ph !== 'q') return;
    if (good.length) {
      for (const i of good) {
        const P = g.p[i], pts = 100 + Math.round(60 * clampN(1 - g.t / 200, 0, 1));
        P.s += pts; P.ok++; P.streak++;
        W.emit('mgChessGood', { p: i, d: g.ok, pts, f: g.t, st: P.streak, both: good.length > 1 ? 1 : 0 });
      }
      g.last = good.length > 1 ? 2 : good[0];
      g.ph = 'gap'; g.t = 0; g.gap = CHESS.GAP;
    } else if (g.t >= CHESS.DL) {
      for (const P of g.p) P.streak = 0;
      W.emit('mgChessLate', { pz: g.pz });
      g.ph = 'gap'; g.t = 0; g.gap = CHESS.GAP;
    }
  },

  result(W, M, g) {
    return scorePayout(W, M, g.p[0].s, g.p[1].s, 15, 25, 70, { oa: g.p[0].ok, ov: g.p[1].ok });
  },
};

// le CPU : le temps de voir le coup (selon son niveau et sa vitesse à lui), parfois il se fait piéger
function chessBot(W, M, g, P, i) {
  const b = P.b, lvl = botLevel(W, M, i);
  if (g.ph !== 'q' || P.lock > 0) return -1;
  if (b.seen !== g.n * 10 + P.bad) {
    b.seen = g.n * 10 + P.bad;
    b.rt = Math.round(([96, 66, 50][lvl - 1] + W.rng() * [70, 46, 36][lvl - 1]) * b.k);
    b.err = W.rng() < [0.3, 0.15, 0.06][lvl - 1] ? 1 : 0;
  }
  if (--b.rt > 0) return -1;
  b.rt = 999;
  if (b.err) { b.err = 0; return (g.ok + 1 + ((W.rng() * 2) | 0)) % 3; }
  return g.ok;
}
