// Ce que partagent tous les ultis (src/sim/minigames.js et les jeux de src/sim/mg/) : les temps, les entrées, le gain.
export { BTN, MOUSE, MV_L, MV_R, MV_D } from '../../core/input.js';
export { DMath } from '../dmath.js';

export const MG_INTRO = 300, MG_PLAY = 600, MG_OUTRO = 130; // 5 s d'explication, 10 s de jeu, ~2 s de « EZ WIN »
export const clampN = (v, a, b) => (v < a ? a : v > b ? b : v);
// le niveau d'un CPU (1 facile, 2 normal, 3 brutal), le joueur i (0 l'attaquant, 1 sa cible) d'un mini-jeu
export const slotOf = (M, i) => (i === 0 ? M.a : M.v);
export const botLevel = (W, M, i) => W.fighters[slotOf(M, i)].bot || 2;

// le perdant prend ses % (le gagnant les compte comme donnés) ; w, l : des slots, -1 pour une égalité
export function payout(W, w, l, d, extra = {}) {
  if (w < 0 || l < 0 || !(d > 0)) return { w: -1, l: -1, d: 0, ...extra };
  const L = W.fighters[l];
  L.damage = Math.min(999, L.damage + d); L.stats.taken += d;
  W.fighters[w].stats.dealt += d;
  return { w, l, d, ...extra };
}

// le gain d'un jeu à scores (sa : score de l'attaquant, sv : de sa cible) : le perdant prend base + écart / div
export function scorePayout(W, M, sa, sv, base, div, max = 70, extra = {}) {
  if (sa === sv) return payout(W, -1, -1, 0, { sa, sv, ...extra });
  const w = sa > sv ? M.a : M.v, l = sa > sv ? M.v : M.a;
  return payout(W, w, l, Math.round(clampN(base + Math.abs(sa - sv) / div, base, max)), { sa, sv, kbb: 18, kbg: 180, ...extra });
}
