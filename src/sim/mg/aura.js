// Battle d'aura (aura) : les deux joueurs farment de l'aura, façon TikTok. Les mêmes moments pour les deux (g.ev, tirés au
// début) : un « mème » (mewing, sigma, rizz...) où un curseur file sur une barre, A quand il est dans la zone : +1000
// d'aura (+1500 pile au milieu), raté ou trop tard : -500 (« il a perdu son aura ») ; et le « 6-7 » : alterner ◀ ▶ le plus
// vite possible pendant AURA.SIX images (1,5 s), +100 par changement de côté. La plus grosse aura gagne : le perdant prend 15 % + l'écart / 200.
import { BTN, clampN, scorePayout, botLevel } from './common.js';

export const AURA = { HIT: 1000, PERFECT: 1500, MISS: 500, PER67: 100, D0: 62, D1: 44, SIX: 90, MEMES: 10 };

export default {
  name: 'Battle d\'aura',

  init(W, A, V) {
    const ev = [], pat = [0, 0, 1, 0, 0, 1, 0, 0, 1];
    let t = 36, n = 0, lastM = -1;
    while (n < pat.length) {
      const q = clampN(t / 600, 0, 1);
      if (pat[n] === 1) {
        if (t + AURA.SIX > 596) break;
        ev.push({ k: 1, t, d: AURA.SIX, z: 0, w: 0, m: -1 });
        t += AURA.SIX + 22;
      } else {
        const d = Math.round(AURA.D0 + (AURA.D1 - AURA.D0) * q);
        if (t + d > 596) break;
        let m = W.rng.int(0, AURA.MEMES - 1);
        if (m === lastM) m = (m + 1) % AURA.MEMES;
        lastM = m;
        ev.push({ k: 0, t, d, z: Math.round((0.58 + W.rng() * 0.26) * 100) / 100, w: Math.round((0.2 - 0.07 * q) * 100) / 100, m });
        t += d + 18;
      }
      n++;
    }
    const pl = (F) => ({ aura: 0, cur: 0, res: ev.map(() => 0), cnt: 0, side: 0, hits: 0, miss: 0, best67: 0, streak: 0,
      b: { lvl: F.bot || 2, k: 0.85 + W.rng() * 0.35, plan: -1, at: 0, nx: 0 } });
    return { ev, p: [pl(A), pl(V)], over: 0 };
  },

  step(W, M, g, ia, iv) {
    const ins = [ia, iv];
    for (let i = 0; i < 2; i++) {
      const P = g.p[i], e = g.ev[P.cur], I = ins[i];
      if (!e || M.t < e.t) continue;
      const end = e.t + e.d;
      if (e.k === 0) {
        // le mème : A dans la zone
        const press = I ? (I.pressed & BTN.A) !== 0 : auraBotTap(W, M, g, i, e);
        if (press && M.t < end) {
          const q = (M.t - e.t) / e.d, off = Math.abs(q - e.z);
          const r = off <= e.w / 6 ? 2 : off <= e.w / 2 ? 1 : 3;
          resolveTap(W, g, i, P, r, Math.round(q * 100));
        } else if (M.t >= end) resolveTap(W, g, i, P, 3, 100);
      } else {
        // le 6-7 : chaque changement de côté (◀ puis ▶...) compte
        if (M.t < end) {
          let flip = 0;
          if (I) {
            const s = I.mx > 0.5 ? 1 : I.mx < -0.5 ? -1 : 0;
            if (s && s !== P.side) { if (P.side) flip = 1; P.side = s; }
          } else flip = auraBot67(W, M, g, i);
          if (flip) { P.cnt++; P.aura += AURA.PER67; W.emit('mgAura67', { p: i, n: P.cnt, s: P.side }); }
        } else {
          P.best67 = Math.max(P.best67, P.cnt); P.res[P.cur] = P.cnt;
          W.emit('mgAura67End', { p: i, n: P.cnt, pts: P.cnt * AURA.PER67 });
          P.cnt = 0; P.side = 0; P.cur++;
        }
      }
    }
  },

  result(W, M, g) {
    return scorePayout(W, M, g.p[0].aura, g.p[1].aura, 15, 200, 70, { aa: g.p[0].aura, av: g.p[1].aura });
  },
};

function resolveTap(W, g, i, P, r, q) {
  const pts = r === 2 ? AURA.PERFECT : r === 1 ? AURA.HIT : -AURA.MISS;
  P.aura += pts; P.res[P.cur] = r;
  if (r === 3) { P.miss++; P.streak = 0; } else { P.hits++; P.streak++; }
  W.emit('mgAuraTap', { p: i, r, pts, q, m: g.ev[P.cur].m, st: P.streak, aura: P.aura });
  P.cur++;
}

// le CPU : vise le milieu de la zone, se trompe de quelques images selon son niveau (parfois de beaucoup)
function auraBotTap(W, M, g, i, e) {
  const P = g.p[i], b = P.b, lvl = botLevel(W, M, i);
  if (b.plan !== P.cur) {
    b.plan = P.cur;
    const err = W.rng() < [0.18, 0.08, 0.03][lvl - 1] ? (W.rng() < 0.5 ? -1 : 1) * W.rng.int(10, 18) : Math.round((W.rng() * 2 - 1) * [8, 5, 3][lvl - 1] * b.k);
    b.at = e.t + Math.round(e.z * e.d) + err;
  }
  return M.t >= b.at;
}
// le CPU au 6-7 : un aller-retour toutes les quelques images (sa vitesse à lui)
function auraBot67(W, M, g, i) {
  const P = g.p[i], b = P.b, lvl = botLevel(W, M, i);
  if (b.plan !== P.cur) { b.plan = P.cur; b.nx = M.t + W.rng.int(6, 14); }
  if (M.t < b.nx) return 0;
  b.nx = M.t + Math.max(4, Math.round(([13, 9, 7][lvl - 1] + W.rng() * 4) * b.k));
  P.side = P.side > 0 ? -1 : 1;
  return 1;
}
