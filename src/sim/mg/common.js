// Ce que partagent tous les ultis (src/sim/minigames.js et les jeux de src/sim/mg/) : les temps, les entrées, le gain.
// DIGITAL : l'échantillon vient d'un clavier (stick à 0 ou ±1) ; chaque jeu doit se jouer aussi bien comme ça
export { BTN, MOUSE, MV_L, MV_R, MV_D, MV_U, DIGITAL } from '../../core/input.js';
export { DMath } from '../dmath.js';

export const MG_INTRO = 30, MG_PLAY = 600; // un demi-seconde de fondu d'encre sur le combat figé (plus d'explication), 10 s de jeu
// la fin : « EZ WIN » (MG_WIN, sur la télé), puis retour dans l'arène, tout figé MG_RESUME images (4 s) : le perdant y
// encaisse ses % en une série de coups (HURT_AT, la part HURT_SHARE de ses % chacun), dans le vrai jeu ; puis la caméra
// recule, « PRÊTS ? 3, 2, 1 » (MG_READY images, le temps de reprendre ses esprits), et il prend le coup qui l'éjecte
// pendant que tout repart
export const MG_WIN = 100, MG_RESUME = 240, MG_READY = 72;
export const HURT_AT = [24, 44, 62, 78, 96], HURT_SHARE = [0.1, 0.25, 0.45, 0.68, 1];
export const mgOutro = () => MG_WIN;
export const clampN = (v, a, b) => (v < a ? a : v > b ? b : v);
// le niveau d'un CPU (1 facile, 2 normal, 3 brutal), le joueur i (0 l'attaquant, 1 sa cible) d'un mini-jeu
export const slotOf = (M, i) => (i === 0 ? M.a : M.v);
export const botLevel = (W, M, i) => W.fighters[slotOf(M, i)].bot || 2;

// le résultat : le perdant prendra d % (au coup qu'il reçoit à la reprise, minigames.js stepResume) ; w, l : des slots,
// -1 pour une égalité
export function payout(W, w, l, d, extra = {}) {
  if (w < 0 || l < 0 || !(d > 0)) return { w: -1, l: -1, d: 0, ...extra };
  return { w, l, d, ...extra };
}

// le gain d'un jeu à scores (sa : score de l'attaquant, sv : de sa cible) : le perdant prend base + écart / div
export function scorePayout(W, M, sa, sv, base, div, max = 70, extra = {}) {
  if (sa === sv) return payout(W, -1, -1, 0, { sa, sv, ...extra });
  const w = sa > sv ? M.a : M.v, l = sa > sv ? M.v : M.a;
  return payout(W, w, l, Math.round(clampN(base + Math.abs(sa - sv) / div, base, max)), { sa, sv, kbb: 18, kbg: 180, ...extra });
}
