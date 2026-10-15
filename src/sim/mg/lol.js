// Le larbin de J'san (lol) : J'san joue en ligne (une partie de MOBA), les deux joueurs sont ses larbins et se battent pour
// le servir. Il réclame une chose (ou deux, ou trois à la suite vers la fin), de plus en plus vite : le stick dans une
// direction lui tend un objet (ITEMS : haut whey, droite canette « MONSTRE », bas créatine, gauche riz-poulet ; il faut
// revenir au centre entre deux). Le premier qui lui a tendu toute la commande marque (100 par objet + la vitesse) ; une
// mauvaise chose : il rage, -40 et les mains prises LOCK images ; personne à temps : il meurt dans sa partie. Parfois il
// appelle l'un des deux par son nom (g.to) : l'autre n'a pas à s'en mêler (sinon c'est une mauvaise chose). Le meilleur
// score gagne : le perdant prend 15 % + l'écart / 30 (70 % au plus).
import { clampN, scorePayout } from './common.js';

export const LOL = { ITEMS: 4, LOCK: 30, GAP0: 34, GAP1: 12, DL0: 120, DL1: 54, PER: 26, WRONG: 40, NAMES: ['WHEY', 'MONSTRE', 'CRÉATINE', 'RIZ-POULET'] };

const lerp = (a, b, q) => a + (b - a) * clampN(q, 0, 1);

export default {
  name: 'Le larbin de J\'san',

  init(W, A, V) {
    const pl = (F) => {
      const lvl = F.bot || 2;
      // le CPU : son niveau, sa vitesse à lui (deux CPU ne jouent pas pareil)
      return { score: 0, ok: 0, bad: 0, prog: 0, lock: 0, armed: 1, streak: 0, best: 0, b: { lvl, k: 0.8 + W.rng() * 0.5, rt: 0, err: 0, skip: 0, seen: -1 } };
    };
    return { ph: 'gap', t: 0, gap: 20, dl: 0, req: [], to: -1, n: 0, p: [pl(A), pl(V)], tug: 0, kills: 0, deaths: 0, tilt: 0, last: -1, lastK: -1, over: 0 };
  },

  step(W, M, g, ia, iv) {
    g.t++;
    const q = M.t / 600, ins = [ia, iv];
    // une nouvelle commande
    if (g.ph === 'gap' && g.t >= g.gap) {
      const len = M.t > 400 && W.rng() < 0.35 ? 3 : M.t > 200 && W.rng() < 0.15 + (M.t - 200) / 600 ? 2 : 1;
      g.req = [];
      for (let k = 0; k < len; k++) {
        let it = (W.rng() * LOL.ITEMS) | 0;
        if (it === (k ? g.req[k - 1] : g.lastK)) it = (it + 1 + ((W.rng() * 3) | 0)) % LOL.ITEMS;
        g.req.push(it);
      }
      g.lastK = g.req[len - 1];
      g.to = g.n >= 2 && W.rng() < 0.3 ? (W.rng() < 0.5 ? 0 : 1) : -1;
      g.ph = 'ask'; g.t = 0; g.n++;
      g.dl = Math.round(lerp(LOL.DL0, LOL.DL1, q)) + (len - 1) * LOL.PER;
      for (const P of g.p) P.prog = 0;
      W.emit('mgLolAsk', { k: g.req[0], k2: len > 1 ? g.req[1] : -1, k3: len > 2 ? g.req[2] : -1, n: len, to: g.to, loud: Math.min(3, ((M.t / 150) | 0) + (g.tilt > 50 ? 1 : 0)) });
    }
    const done = [];
    for (let i = 0; i < 2; i++) {
      const P = g.p[i];
      if (P.lock > 0) P.lock--;
      let dir = -1;
      const I = ins[i];
      if (I) {
        const ax = Math.abs(I.mx), ay = Math.abs(I.my);
        if (ax < 0.35 && ay < 0.35) P.armed = 1;
        else if (P.armed && Math.max(ax, ay) > 0.6) { P.armed = 0; dir = ax >= ay ? (I.mx > 0 ? 1 : 3) : (I.my > 0 ? 0 : 2); }
      } else dir = lolBot(W, g, P, i);
      if (dir < 0 || g.ph !== 'ask' || P.lock > 0) continue;
      const want = g.req[P.prog];
      if (dir === want && (g.to < 0 || g.to === i)) {
        P.prog++;
        if (P.prog >= g.req.length) done.push(i);
        else W.emit('mgLolStep', { p: i, k: dir, i: P.prog, n: g.req.length });
      } else {
        // la mauvaise chose : il rage, la lui renvoie, et la commande est à refaire
        P.lock = LOL.LOCK; P.prog = 0; P.bad++; P.streak = 0; P.score = Math.max(0, P.score - LOL.WRONG);
        g.tilt = Math.min(100, g.tilt + 12);
        W.emit('mgLolWrong', { p: i, k: dir, w: want, nf: g.to >= 0 && g.to !== i ? 1 : 0 });
      }
    }
    if (g.ph !== 'ask') return;
    if (done.length) {
      for (const i of done) {
        const P = g.p[i], len = g.req.length, pts = 100 * len + Math.round(50 * Math.max(0, 1 - g.t / g.dl));
        P.score += pts; P.ok++; P.streak++; P.best = Math.max(P.best, P.streak);
        W.emit('mgLolGood', { p: i, k: g.req[len - 1], pts, n: len, st: P.streak, f: g.t, both: done.length > 1 ? 1 : 0 });
      }
      g.tug = clampN(g.tug + 14 * g.req.length, -100, 100); g.kills++; g.tilt = Math.max(0, g.tilt - 15); g.last = done[0];
      g.ph = 'gap'; g.t = 0; g.gap = Math.round(lerp(LOL.GAP0, LOL.GAP1, q));
    } else if (g.t >= g.dl) {
      // personne à temps : il se fait tuer dans sa partie
      g.tug = clampN(g.tug - 18, -100, 100); g.deaths++; g.tilt = Math.min(100, g.tilt + 20);
      for (const P of g.p) P.streak = 0;
      W.emit('mgLolLate', { k: g.req[0], d: g.deaths });
      g.ph = 'gap'; g.t = 0; g.gap = Math.round(lerp(LOL.GAP0, LOL.GAP1, q)) + 10;
    }
  },

  result(W, M, g) {
    return scorePayout(W, M, g.p[0].score, g.p[1].score, 15, 30, 70, { ka: g.kills, kd: g.deaths });
  },
};

// CPU larbin : met un temps à lire la commande (selon son niveau et sa vitesse), se trompe parfois d'objet
function lolBot(W, g, P, i) {
  const b = P.b, lvl = b.lvl;
  if (g.ph !== 'ask' || P.lock > 0) return -1;
  if (b.seen !== g.n * 10 + P.bad) {
    b.seen = g.n * 10 + P.bad;
    b.rt = Math.round(([28, 20, 15][lvl - 1] + W.rng() * [26, 20, 14][lvl - 1]) * b.k);
    b.err = W.rng() < [0.14, 0.08, 0.04][lvl - 1] ? 1 : 0;
    // pas appelé : il ne bouge pas (le CPU facile s'en mêle quand même, parfois)
    b.skip = g.to >= 0 && g.to !== i && W.rng() > [0.3, 0.1, 0][lvl - 1] ? 1 : 0;
  }
  if (b.skip) return -1;
  if (--b.rt > 0) return -1;
  b.rt = Math.round(([12, 9, 6][lvl - 1] + W.rng() * 6) * b.k); // l'objet suivant d'une commande
  const want = g.req[P.prog];
  if (b.err) { b.err = 0; return (want + 1 + ((W.rng() * 3) | 0)) % 4; }
  return want;
}
