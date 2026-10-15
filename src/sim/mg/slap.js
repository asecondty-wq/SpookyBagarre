// Concours de baffes (slap) : chacun prépare UNE baffe, puis la met à l'autre, l'un après l'autre (l'attaquant d'abord).
//  1. Le chargement (CHARGE images au plus, les deux en même temps) : trois arrêts d'aiguille (épaule, coude, poignet).
//     L'aiguille va et vient sur une jauge 0..1, de plus en plus vite ; A l'arrête : près de la zone (la même pour les
//     deux, tirée au début) = jusqu'à 100 points, PARFAIT dans le cœur. La puissance = la somme des trois arrêts.
//  2. Les baffes : la main part, un cercle se referme sur la joue ; au moment où il se ferme (IMPACT), A donne un coup
//     critique à celui qui frappe (x1,3), et celui qui la reçoit peut serrer les dents au même moment (x0,8) ; trop tôt,
//     c'est raté (et la victime qui tressaille la prend plus fort).
//  3. Le verdict : la baffe la plus forte (en km/h) gagne ; le perdant prend 15 % + l'écart / 6 (70 % au plus).
import { BTN, scorePayout, botLevel, clampN } from './common.js';

export const SLAP = {
  CHARGE: 210, STOPS: 3, SPEED: [1.45, 2.05, 2.75], ZONE: 0.075, PERF: 0.026, PAUSE: 14, IMPACT: 46, WIN: 20, AFTER: 86,
  VERDICT: 96, CRIT: 4, GOOD: 10, MS: [0.9, 1.12, 1.3], MV: [1.1, 0.9, 0.8], BASE: 50,
};
const PRESS = BTN.A | BTN.X;
const tri = (x) => { const m = x % 2; return m < 1 ? m : 2 - m; };
const gauss = (W) => (W.rng() + W.rng() + W.rng() + W.rng() - 2) * 1.73;

// les points d'un arrêt de l'aiguille à la position pos, pour la zone z
export function stopScore(pos, z) {
  const d = Math.abs(pos - z);
  if (d <= SLAP.PERF) return 100;
  if (d <= SLAP.ZONE) return Math.round(100 - (d - SLAP.PERF) / (SLAP.ZONE - SLAP.PERF) * 25);
  return Math.max(0, Math.round(75 - (d - SLAP.ZONE) * 260));
}
export const needle = (P) => tri(P.nph);

export default {
  name: 'Concours de baffes',

  init(W) {
    const zones = [];
    for (let k = 0; k < SLAP.STOPS; k++) zones.push(Math.round((0.36 + W.rng() * 0.56) * 1000) / 1000);
    const pl = () => ({ k: 0, nph: 0, wait: 0, sc: [], perf: 0, pw: 0, bk: 0.7 + W.rng() * 0.6, tg: -1, bd: 0 });
    return { ph: 'charge', zones, p: [pl(), pl()], cur: 0, u: 0, q: [-1, -1], qt: [-1, -1], f: [-1, -1], end: 0, over: 0 };
  },

  step(W, M, g, ia, iv) {
    const ins = [ia, iv];
    if (g.ph === 'charge') {
      for (let i = 0; i < 2; i++) {
        const P = g.p[i], I = ins[i];
        if (P.wait > 0) { P.wait--; continue; }
        if (P.k >= SLAP.STOPS) continue;
        const prev = tri(P.nph);
        P.nph += SLAP.SPEED[P.k] / 60;
        const pos = tri(P.nph);
        let stop = false;
        if (I) stop = !!(I.pressed & PRESS);
        else { // CPU : vise la zone (plus ou moins bien), attend un peu, arrête l'aiguille quand elle passe sur sa cible
          const lvl = botLevel(W, M, i);
          if (P.tg < 0) { P.tg = clampN(g.zones[P.k] + gauss(W) * [0.11, 0.06, 0.03][lvl - 1] * P.bk, 0.02, 0.98); P.bd = [24, 14, 6][lvl - 1] + (W.rng() * 16 | 0); }
          if (P.bd > 0) P.bd--;
          else if (P.tg >= Math.min(prev, pos) && P.tg <= Math.max(prev, pos)) stop = true;
        }
        if (!stop) continue;
        const s = stopScore(pos, g.zones[P.k]), perf = s >= 100 ? 1 : 0;
        P.sc.push(s); P.pw += s; P.perf += perf;
        W.emit('mgSlapLock', { p: i, k: P.k, s, perf, pos: Math.round(pos * 1000), late: 0 });
        P.k++; P.nph = 0; P.tg = -1; P.wait = SLAP.PAUSE;
      }
      const done = g.p.every((P) => P.k >= SLAP.STOPS && P.wait <= 0);
      if (done || M.t >= SLAP.CHARGE) {
        for (let i = 0; i < 2; i++) { // trop lent : les arrêts qui restent ne valent rien
          const P = g.p[i];
          while (P.k < SLAP.STOPS) { P.sc.push(0); W.emit('mgSlapLock', { p: i, k: P.k, s: 0, perf: 0, pos: 0, late: 1 }); P.k++; }
        }
        g.ph = 'slap'; g.cur = 0; g.u = 0; g.q = [-1, -1]; g.qt = [-1, -1];
        W.emit('mgSlapWind', { p: 0, pa: g.p[0].pw, pv: g.p[1].pw });
      }
      return;
    }
    if (g.ph === 'slap') {
      g.u++;
      const s = g.cur, v = 1 - s, d = g.u - SLAP.IMPACT;
      // les CPU décident une fois quand appuyer
      for (let r = 0; r < 2; r++) {
        const i = r === 0 ? s : v;
        if (ins[i] || g.qt[r] !== -1) continue;
        const lvl = botLevel(W, M, i), P = g.p[i];
        const go = W.rng() < (r === 0 ? [0.85, 0.95, 1] : [0.55, 0.78, 0.92])[lvl - 1];
        g.qt[r] = go ? SLAP.IMPACT + Math.min(2, Math.round(gauss(W) * [5, 3, 1.6][lvl - 1] * P.bk) - 2) : 999;
      }
      if (d >= -SLAP.WIN && d <= 0) {
        for (let r = 0; r < 2; r++) {
          if (g.q[r] !== -1) continue;
          const i = r === 0 ? s : v, I = ins[i];
          const hit = I ? !!(I.pressed & PRESS) : g.u === g.qt[r];
          if (!hit) continue;
          const q = d >= -SLAP.CRIT ? 2 : d >= -SLAP.GOOD ? 1 : 0;
          g.q[r] = q;
          W.emit('mgSlapTime', { p: i, r, q, d });
        }
      }
      if (d === 0) {
        const qs = g.q[0], qv = g.q[1];
        const f = Math.round((SLAP.BASE + g.p[s].pw) * (qs >= 0 ? SLAP.MS[qs] : 1) * (qv >= 0 ? SLAP.MV[qv] : 1));
        g.f[s] = f;
        W.emit('mgSlapHit', { p: s, f, c: qs, b: qv, n: s });
      }
      if (g.u >= SLAP.IMPACT + SLAP.AFTER) {
        if (s === 0) { g.cur = 1; g.u = 0; g.q = [-1, -1]; g.qt = [-1, -1]; W.emit('mgSlapWind', { p: 1, pa: g.p[0].pw, pv: g.p[1].pw }); }
        else {
          g.ph = 'verdict'; g.u = 0;
          const [fa, fv] = g.f;
          W.emit('mgSlapVerdict', { w: fa === fv ? -1 : fa > fv ? 0 : 1, fa, fv });
        }
      }
      return;
    }
    if (g.ph === 'verdict' && ++g.u >= SLAP.VERDICT) g.over = 1;
  },

  result(W, M, g) {
    const fa = Math.max(0, g.f[0]), fv = Math.max(0, g.f[1]);
    return scorePayout(W, M, fa, fv, 15, 6);
  },
};
