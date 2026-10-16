// L'accordeur d'Epektase (tuning) : chacun sa Flying V (la même désaccordée pour les deux), six cordes à accorder l'une
// après l'autre (de la 6, mi grave, à la 1). Le stick tourne la cheville : la note glisse avec de l'élan (elle dépasse si
// on lâche trop tard), la corde se détend toute seule un peu (l'aiguille tremble). A valide : à OK[0] cents près parfait,
// OK[1] juste, OK[2] presque ; au-delà, Epektase (en chibi) tape sur les doigts : sonné SMACK images, des points en moins.
// Trop tendue (SNAP cents au-dessus), la corde casse : une neuve, toute molle. Points : la justesse + la vitesse ; les six
// cordes faites : bonus. Le meilleur total gagne : le perdant prend 15 % + l'écart / 8 (70 % au plus).
import { BTN, DIGITAL, clampN, scorePayout } from './common.js';

export const TUNE = {
  STR: 6, ACC: 0.85, FRIC: 0.86, KB_MAX: 6, OK: [5, 12, 25], PTS: [100, 70, 40], FAST: 240, SMACK: 42, SNAP: 460, SNAPT: 50, SLACK: -600, DONE: 120,
  NAMES: ['MI', 'LA', 'RÉ', 'SOL', 'SI', 'MI'],
};

// la note de chaque corde au départ (en cents de la note juste) : la même suite pour les deux joueurs
function offsets(W) {
  const o = [];
  for (let s = 0; s < TUNE.STR; s++) { const sd = W.rng() < 0.5 ? -1 : 1; o.push(Math.round(sd * (140 + W.rng() * (sd > 0 ? 140 : 200)))); } // (trop aigu : jamais déjà près de casser)
  return o;
}

export default {
  name: 'L\'accordeur d\'Epektase',

  init(W, A, V) {
    const off = offsets(W);
    const pl = (F) => {
      const lvl = F.bot || 2;
      return {
        s: 0, e: off[0], v: 0, kh: 0, dr: 0, drt: 0, t: 0, st: 0, sk: 0, pk: 0, score: 0, done: 0, smacks: 0, snaps: 0, perfect: 0,
        gr: [0, 0, 0, 0, 0, 0], fin: 0,
        // le CPU : son niveau, son adresse (deux CPU ne jouent pas pareil), sa visée sur la corde en cours
        b: { lvl, k: 0.8 + W.rng() * 0.5, rt: 0, out: 0, aim: 0, pat: [170, 210, 260][lvl - 1] + ((W.rng() * 50) | 0), seen: -1 },
      };
    };
    return { off, p: [pl(A), pl(V)], over: 0 };
  },

  step(W, M, g, ia, iv) {
    const ins = [ia, iv];
    for (let i = 0; i < 2; i++) {
      const P = g.p[i];
      if (P.done) continue;
      const I = ins[i] || tuneBot(W, P);
      P.t++;
      // la cheville : le stick (gauche / droite, ou bas / haut) accélère la note, l'élan la fait glisser
      let turn = 0;
      if (P.st > 0) P.st--;
      else {
        turn = Math.abs(I.mx) >= Math.abs(I.my) ? I.mx : I.my;
        if (Math.abs(turn) < 0.2) turn = 0;
      }
      // au clavier (tout ou rien), pas d'élan : la note suit la touche, d'abord lentement (une touche tapée = un petit cran)
      // puis de plus en plus vite, et s'arrête presque net quand on lâche
      if (I.held & DIGITAL) { P.kh = turn ? P.kh + 1 : 0; P.v = turn ? Math.sign(turn) * Math.min(TUNE.KB_MAX, 0.5 + P.kh * 0.22) : P.v * 0.5; }
      else { P.v += turn * TUNE.ACC; P.v *= TUNE.FRIC; }
      if (--P.drt <= 0) { P.dr = (W.rng() - 0.5) * 0.3; P.drt = 20 + ((W.rng() * 20) | 0); }
      P.e += P.v + P.dr; P.pk += P.v;
      if (P.e < TUNE.SLACK) { P.e = TUNE.SLACK; P.v = 0; }
      // trop tendue : elle casse, une corde neuve (toute molle)
      if (P.e > TUNE.SNAP) {
        P.st = TUNE.SNAPT; P.v = 0; P.e = -Math.round(220 + W.rng() * 120); P.snaps++; P.score = Math.max(0, P.score - 20);
        W.emit('mgTuneSnap', { p: i, s: P.s });
        continue;
      }
      if (!(I.pressed & (BTN.A | BTN.X)) || P.st > 0) continue;
      const c = Math.abs(P.e), grade = c <= TUNE.OK[0] ? 1 : c <= TUNE.OK[1] ? 2 : c <= TUNE.OK[2] ? 3 : 0;
      if (!grade) {
        // faux : Epektase tape sur les doigts (la main sursaute : la cheville part encore plus loin)
        const sd = P.e > 0 ? 1 : -1;
        P.st = TUNE.SMACK; P.sk++; P.smacks++; P.score = Math.max(0, P.score - 15); P.v += sd * 3;
        W.emit('mgTuneBad', { p: i, s: P.s, c: Math.round(c), sd });
        continue;
      }
      const pts = TUNE.PTS[grade - 1] + clampN(Math.round((TUNE.FAST - P.t) / 4), 0, 60);
      P.score += pts; P.gr[P.s] = grade; if (grade === 1) P.perfect++;
      W.emit('mgTuneOk', { p: i, s: P.s, g: grade, pts, c: Math.round(c * 10) / 10, f: P.t });
      P.s++; P.t = 0; P.v = 0; P.sk = 0;
      if (P.s >= TUNE.STR) {
        P.done = 1; P.fin = M.t; P.score += TUNE.DONE;
        W.emit('mgTuneDone', { p: i, pts: TUNE.DONE, n: P.perfect });
      } else P.e = g.off[P.s];
    }
    if (g.p[0].done && g.p[1].done) g.over = 1;
  },

  result(W, M, g) {
    return scorePayout(W, M, g.p[0].score, g.p[1].score, 15, 8, 70);
  },
};

// CPU accordeur : regarde l'aiguille de temps en temps (plus ou moins souvent), anticipe plus ou moins l'élan, vise un
// peu à côté selon son niveau, valide quand ça lui paraît bon (ou quand il perd patience)
function tuneBot(W, P) {
  const b = P.b, lvl = b.lvl, I = { mx: 0, my: 0, held: 0, pressed: 0 };
  if (b.seen !== P.s * 100 + P.sk) { b.seen = P.s * 100 + P.sk; b.aim = (W.rng() - 0.5) * 2 * [22, 11, 3][lvl - 1]; b.rt = 6 + ((W.rng() * 10) | 0); }
  if (P.st > 0) return I;
  if (--b.rt <= 0) {
    b.rt = [13, 8, 3][lvl - 1] + ((W.rng() * 4) | 0);
    const pred = [1.5, 4, 6.2][lvl - 1], err = P.e + P.v * pred - b.aim;
    b.out = clampN(-err * [0.02, 0.025, 0.036][lvl - 1] * b.k, -1, 1);
    if (Math.abs(b.out) < 0.22) b.out = 0;
  }
  I.mx = b.out;
  const off = Math.abs(P.e - b.aim), calm = Math.abs(P.v) < [1.8, 1.1, 0.8][lvl - 1];
  if ((off < [6, 4, 3][lvl - 1] && calm && W.rng() < [0.12, 0.3, 0.6][lvl - 1]) ||
      (lvl === 1 && Math.abs(P.e) < 45 && W.rng() < 0.025) ||
      (P.t > b.pat && W.rng() < 0.05)) I.pressed |= BTN.A;
  return I;
}
