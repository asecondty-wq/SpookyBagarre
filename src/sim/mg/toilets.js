// Toilettes propres (toilets) : chacun son couloir de toilettes (le même plan pour les deux, tiré au début), une rangée
// de portes ; ◀ ▶ passe d'une porte à l'autre, A ouvre. Une seule est propre (elle scintille par moments sous la porte),
// les autres sont dégoûtantes (des mouches autour, de moins en moins vers la fin : il faut regarder). Ouvrir une sale :
// BEURK, sonné LOCK images, -10 ; la propre : +100 et un bonus de vitesse, puis le couloir suivant (de plus en plus de
// portes). Le meilleur score gagne : le perdant prend 15 % + l'écart / 30.
import { BTN, clampN, scorePayout, botLevel } from './common.js';

export const WC = { ROUNDS: 24, LOCK: 22, WAIT: 36, GROSS: 10, KINDS: 4 };

export default {
  name: 'Toilettes propres',

  init(W, A, V) {
    const rounds = [];
    for (let r = 0; r < WC.ROUNDS; r++) {
      const n = r < 2 ? 4 : r < 4 ? 5 : 6, clean = W.rng.int(0, n - 1), doors = [];
      for (let d = 0; d < n; d++) doors.push(d === clean ? -1 : W.rng.int(0, WC.KINDS - 1));
      // les mouches : sur toutes les sales au début, puis sur une partie seulement
      let flies = 0;
      for (let d = 0; d < n; d++) if (d !== clean && (r < 3 || W.rng() < 0.55)) flies |= 1 << d;
      rounds.push({ n, clean, doors, flies, col: W.rng.int(0, 5) });
    }
    const pl = (F) => ({ r: 0, c: 1, open: 0, lock: 0, wait: 0, rt: 0, score: 0, found: 0, gross: 0, hd: 0, streak: 0,
      b: { lvl: F.bot || 2, k: 0.85 + W.rng() * 0.35, tgt: -1, rt: 0, mv: 0, knows: 0 } });
    const g = { rounds, p: [pl(A), pl(V)], over: 0 };
    for (const P of g.p) P.c = rounds[0].n >> 1;
    return g;
  },

  step(W, M, g, ia, iv) {
    const ins = [ia, iv];
    for (let i = 0; i < 2; i++) {
      const P = g.p[i], R = g.rounds[P.r % WC.ROUNDS];
      if (P.wait > 0) { if (--P.wait === 0) nextRound(W, M, g, i); continue; }
      if (P.lock > 0) P.lock--;
      const I = ins[i] || wcBot(W, M, g, i, R);
      // ◀ ▶ : une porte par appui, et ça défile si on tient
      const dir = I.mx > 0.5 ? 1 : I.mx < -0.5 ? -1 : 0;
      if (dir) {
        if (P.hd === 0 || (P.hd > 14 && P.hd % 5 === 0)) {
          const c = clampN(P.c + dir, 0, R.n - 1);
          if (c !== P.c) { P.c = c; W.emit('mgToiletsMove', { p: i, c }); }
        }
        P.hd++;
      } else P.hd = 0;
      if (!(I.pressed & BTN.A) || P.lock > 0) continue;
      const d = P.c;
      if (P.open & (1 << d)) { W.emit('mgToiletsAgain', { p: i, d }); continue; }
      if (d === R.clean) {
        const f = M.t - P.rt, pts = 100 + Math.max(0, Math.round(60 - f / 2));
        P.score += pts; P.found++; P.streak = P.open ? 0 : P.streak + 1; P.open |= 1 << d; P.wait = WC.WAIT;
        W.emit('mgToiletsClean', { p: i, d, pts, n: P.found, f, st: P.streak, first: P.open === (1 << d) ? 1 : 0 });
      } else {
        P.open |= 1 << d; P.lock = WC.LOCK; P.gross++; P.score = Math.max(0, P.score - WC.GROSS);
        W.emit('mgToiletsGross', { p: i, d, k: R.doors[d] });
        P.b.tgt = -1;
      }
    }
  },

  result(W, M, g) {
    return scorePayout(W, M, g.p[0].score, g.p[1].score, 15, 30, 70, { fa: g.p[0].found, fv: g.p[1].found });
  },
};

function nextRound(W, M, g, i) {
  const P = g.p[i];
  P.r++; P.open = 0; P.rt = M.t; P.lock = 0;
  const R = g.rounds[P.r % WC.ROUNDS];
  P.c = R.n >> 1; P.b.tgt = -1;
  W.emit('mgToiletsRound', { p: i, r: P.r, n: R.n });
}

// le CPU : met un temps à regarder le couloir, repère (ou pas, selon son niveau) la porte propre, sinon en ouvre une au
// hasard ; il marche porte par porte jusqu'à elle, puis ouvre
function wcBot(W, M, g, i, R) {
  const P = g.p[i], b = P.b, lvl = botLevel(W, M, i), I = { mx: 0, my: 0, held: 0, pressed: 0 };
  if (P.lock > 0) return I;
  if (b.tgt < 0) {
    const left = [];
    for (let d = 0; d < R.n; d++) if (!(P.open & (1 << d))) left.push(d);
    b.knows = W.rng() < [0.3, 0.55, 0.8][lvl - 1] + (R.n - left.length) * 0.1 ? 1 : 0;
    b.tgt = b.knows ? R.clean : left[W.rng.int(0, left.length - 1)];
    b.rt = Math.round(([34, 24, 15][lvl - 1] + W.rng() * [24, 16, 10][lvl - 1]) * b.k);
    b.mv = 0;
  }
  if (b.rt > 0) { b.rt--; return I; }
  if (P.c !== b.tgt) {
    // un appui par porte (relâcher entre deux)
    if (++b.mv >= Math.round([10, 7, 5][lvl - 1] * b.k)) { b.mv = 0; if (P.hd === 0) I.mx = b.tgt > P.c ? 1 : -1; }
    return I;
  }
  if (++b.mv >= [9, 5, 3][lvl - 1]) { I.pressed = BTN.A; I.held = BTN.A; b.tgt = -1; }
  return I;
}
