// Promenade de Reyji (walk) : chacun promène son Reyji (le shiba de J'san) dans la rue ; des passants arrivent en face
// (les mêmes, aux mêmes moments, pour les deux : la liste g.ev tirée au début). Quand un passant est à sa portée, Reyji
// se jette sur sa chaussure : un gros « ! » et la chaussure qui clignote, la fenêtre e.w images ; A (tirer la laisse)
// dedans : Reyji est ramené, +100 et la vitesse ; trop tard : il croque la chaussure, -40, le passant hurle. Tirer pour
// rien : Reyji s'étrangle un peu, -15, la laisse bloquée LOCK images (pas de matraquage). Le meilleur score gagne.
import { BTN, clampN, scorePayout, botLevel } from './common.js';

export const WALK = { LOCK: 26, MISS: 40, YANK: 15, W0: 36, W1: 22 };

export default {
  name: 'Promenade de Reyji',

  init(W, A, V) {
    const ev = [];
    let t = 70;
    while (t < 590) {
      const q = clampN(t / 600, 0, 1);
      ev.push({ t, w: Math.round(WALK.W0 + (WALK.W1 - WALK.W0) * q), k: W.rng.int(0, 5), sp: 2 + W.rng() * 0.8 });
      t += Math.round(78 - 30 * q + W.rng() * 26);
    }
    const pl = (F) => ({ cur: 0, res: ev.map(() => 0), rt: ev.map(() => 0), score: 0, ok: 0, miss: 0, yank: 0, lock: 0, streak: 0, best: 0,
      b: { lvl: F.bot || 2, k: 0.85 + W.rng() * 0.35, plan: -1, at: 0 } });
    return { ev, p: [pl(A), pl(V)], over: 0 };
  },

  step(W, M, g, ia, iv) {
    const ins = [ia, iv];
    for (let i = 0; i < 2; i++) {
      const P = g.p[i];
      if (P.lock > 0) P.lock--;
      const e = g.ev[P.cur], open = e && M.t >= e.t && M.t < e.t + e.w;
      const I = ins[i];
      const tug = I ? (I.pressed & (BTN.A | BTN.X)) !== 0 : walkBot(W, M, g, i);
      if (tug && P.lock <= 0) {
        if (open) {
          const f = M.t - e.t, pts = 100 + Math.round(60 * (1 - f / e.w));
          P.score += pts; P.ok++; P.streak++; P.best = Math.max(P.best, P.streak); P.res[P.cur] = 1; P.rt[P.cur] = M.t;
          W.emit('mgWalkTug', { p: i, n: P.cur, pts, f, st: P.streak, k: e.k });
          P.cur++;
          continue;
        }
        P.lock = WALK.LOCK; P.yank++; P.streak = 0; P.score = Math.max(0, P.score - WALK.YANK);
        W.emit('mgWalkYank', { p: i });
      }
      if (e && M.t >= e.t + e.w) {
        // trop tard : il croque la chaussure
        P.score = Math.max(0, P.score - WALK.MISS); P.miss++; P.streak = 0; P.res[P.cur] = 2; P.rt[P.cur] = M.t;
        W.emit('mgWalkMunch', { p: i, n: P.cur, k: e.k });
        P.cur++;
      }
    }
  },

  result(W, M, g) {
    return scorePayout(W, M, g.p[0].score, g.p[1].score, 15, 25, 70, { oa: g.p[0].ok, ov: g.p[1].ok });
  },
};

// le CPU : voit venir le passant ; un temps de réaction selon son niveau (parfois trop long), et le facile tire parfois trop
// tôt (la laisse bloquée, il rate le passant)
function walkBot(W, M, g, i) {
  const P = g.p[i], b = P.b, lvl = botLevel(W, M, i), e = g.ev[P.cur];
  if (!e) return false;
  if (b.plan !== P.cur && M.t >= e.t - 30) {
    b.plan = P.cur;
    if (W.rng() < [0.16, 0.07, 0.02][lvl - 1]) b.at = e.t - W.rng.int(4, 18);
    else b.at = e.t + Math.round(([17, 12, 8][lvl - 1] + W.rng() * [22, 14, 9][lvl - 1]) * b.k);
  }
  if (b.plan !== P.cur || b.at < 0 || M.t < b.at) return false;
  b.at = -1;
  return true;
}
