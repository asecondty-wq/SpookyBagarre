// Faux papiers (papers) : Skanky dans le TER, le contrôleur passe. Il réclame un papier (PAPERS.NAMES : billet, carte
// d'identité, abonnement, carte étudiant) ; chaque joueur a son Skanky et ses quatre faux papiers en croix (le stick dans
// une direction tend celui-là, revenir au centre entre deux, comme le larbin de J'san). Les mêmes demandes pour les deux
// (g.req, tirée au début), chacun à son rythme. Le bon papier : +100 et la vitesse, la demande suivante ; un mauvais : le
// contrôleur se méfie, -50, les mains prises LOCK images ; trop lent (g.dl) : AMENDE, -30, la suivante. Le meilleur
// score gagne : le perdant prend 15 % + l'écart / 30.
import { clampN, scorePayout, botLevel } from './common.js';

export const PAPERS = { LOCK: 36, WRONG: 50, FINE: 30, DL0: 170, DL1: 100, GAP: 18, NAMES: ['BILLET', 'CARTE D\'IDENTITÉ', 'ABONNEMENT', 'CARTE ÉTUDIANT'] };
// où est chaque papier : 0 en haut (billet), 1 à droite (identité), 2 en bas (abonnement), 3 à gauche (étudiant)

export default {
  name: 'Faux papiers',

  init(W, A, V) {
    const req = [];
    let last = -1;
    for (let k = 0; k < 40; k++) { let r = W.rng.int(0, 3); if (r === last) r = (r + W.rng.int(1, 3)) % 4; req.push(r); last = r; }
    const pl = (F) => ({ n: 0, t: 0, gap: 30, lock: 0, armed: 1, score: 0, ok: 0, bad: 0, fines: 0, streak: 0, sus: 0,
      b: { lvl: F.bot || 2, k: 0.85 + W.rng() * 0.35, seen: -1, rt: 0, err: 0 } });
    return { req, p: [pl(A), pl(V)], over: 0 };
  },

  step(W, M, g, ia, iv) {
    const ins = [ia, iv], q = clampN(M.t / 600, 0, 1);
    for (let i = 0; i < 2; i++) {
      const P = g.p[i], I = ins[i];
      if (P.lock > 0) P.lock--;
      if (P.sus > 0) P.sus--;
      let dir = -1;
      if (I) {
        const ax = Math.abs(I.mx), ay = Math.abs(I.my);
        if (ax < 0.35 && ay < 0.35) P.armed = 1;
        else if (P.armed && Math.max(ax, ay) > 0.6) { P.armed = 0; dir = ax >= ay ? (I.mx > 0 ? 1 : 3) : (I.my > 0 ? 0 : 2); }
      }
      // l'entre-deux : le contrôleur range le papier, regarde le suivant
      if (P.gap > 0) { if (--P.gap === 0) { P.t = 0; W.emit('mgPapersAsk', { p: i, k: g.req[P.n % g.req.length], n: P.n }); } continue; }
      P.t++;
      if (!I) dir = papersBot(W, M, g, i);
      const want = g.req[P.n % g.req.length], dl = Math.round(PAPERS.DL0 + (PAPERS.DL1 - PAPERS.DL0) * q);
      if (dir >= 0 && P.lock <= 0) {
        if (dir === want) {
          const pts = 100 + Math.round(60 * Math.max(0, 1 - P.t / 90));
          P.score += pts; P.ok++; P.streak++;
          W.emit('mgPapersOk', { p: i, k: dir, pts, f: P.t, st: P.streak });
          P.n++; P.gap = PAPERS.GAP;
        } else {
          P.lock = PAPERS.LOCK; P.bad++; P.streak = 0; P.sus = 60; P.score = Math.max(0, P.score - PAPERS.WRONG);
          W.emit('mgPapersWrong', { p: i, k: dir, w: want });
        }
        continue;
      }
      if (P.t >= dl) {
        P.fines++; P.streak = 0; P.score = Math.max(0, P.score - PAPERS.FINE);
        W.emit('mgPapersFine', { p: i, k: want });
        P.n++; P.gap = PAPERS.GAP + 10;
      }
    }
  },

  result(W, M, g) {
    return scorePayout(W, M, g.p[0].score, g.p[1].score, 15, 30, 70, { oa: g.p[0].ok, ov: g.p[1].ok });
  },
};

// le CPU : un temps pour lire la demande (son niveau, sa vitesse à lui), parfois le mauvais papier
function papersBot(W, M, g, i) {
  const P = g.p[i], b = P.b, lvl = botLevel(W, M, i);
  if (P.lock > 0) return -1;
  if (b.seen !== P.n * 10 + P.bad % 10) {
    b.seen = P.n * 10 + P.bad % 10;
    b.rt = Math.round(([30, 21, 14][lvl - 1] + W.rng() * [28, 18, 12][lvl - 1]) * b.k);
    b.err = W.rng() < [0.16, 0.08, 0.03][lvl - 1] ? 1 : 0;
  }
  if (--b.rt > 0) return -1;
  const want = g.req[P.n % g.req.length];
  if (b.err) { b.err = 0; b.rt = 99; return (want + W.rng.int(1, 3)) % 4; }
  return want;
}
