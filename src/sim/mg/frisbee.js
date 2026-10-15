// Frisbee de l'au-delà (frisbee) : un terrain vu de dessus (100 x 60), chacun sa moitié (l'attaquant à gauche). On lance
// à tour de rôle, celui qui attrape relance de là où il est.
//  - Lancer : une cible fait des allers-retours sur la moitié de l'autre. Tenir A charge (plus vite, plus loin), lâcher
//    lance vers la cible du moment ; lâcher dans la fenêtre PARFAIT = lancer précis et plus rapide ; trop tenir = lancer
//    raté qui part n'importe où. Le stick haut/bas au moment de lâcher donne de l'effet : le frisbee part en banane et
//    tombe jusqu'à 14 plus haut ou plus bas que la cible (et peut sortir).
//  - Attraper : courir au stick, A = saisir (une fenêtre courte, puis un temps mort) ; A avec le stick poussé = plongeon
//    (plus loin, plus large, mais on reste à plat ventre un moment).
//  - Points : rattrapage 100 + la course (jusqu'à 60) + 50 en plongeon + 50 in extremis (juste avant le sol) ; frisbee
//    au sol dans le terrain : 100 au lanceur ; dehors : 50 à celui qui devait attraper.
// Le perdant prend 15 % + l'écart / 10 (70 % au plus).
import { BTN, DMath, MG_PLAY, scorePayout, botLevel, clampN } from './common.js';

export const FRIS = {
  W: 100, H: 60, AIM: 62, FULL: 28, PERF: 9, HOLD_MAX: 48, RUN: 40, DIVE: 115, DIVE_T: 14, LIE: 24, GRAB_T: 9, GRAB_CD: 12,
  R: 4.6, RD: 6.5, CATCH_S: 0.4, EXT_S: 0.86, POST_C: 22, POST_L: 28, EFFET: 14,
};
const gauss = (W) => (W.rng() + W.rng() + W.rng() + W.rng() - 2) * 1.73;
const half = (i) => (i === 0 ? [2, 46] : [54, 98]);
// la position au sol du frisbee à l'avancée s (courbe de Bézier du lanceur à la cible), sa hauteur
export function frisAt(fr, s) {
  const a = (1 - s) * (1 - s), b = 2 * s * (1 - s), c = s * s;
  return [a * fr.x0 + b * fr.qx + c * fr.x1, a * fr.y0 + b * fr.qy + c * fr.y1];
}
export const frisZ = (s) => (1 - s) * 1.1 + 2 * s * (1 - s);
export const markerY = (g) => 30 + 26 * DMath.sin(g.mk);

function newAim(W, g, th) {
  g.ph = 'aim'; g.u = 0; g.th = th; g.fr = null; g.hold = -1;
  g.mk = W.rng() * 6.283; g.mks = 2.5 + W.rng() * 1.1;
  const T = g.P[th]; T.hold = -1; T.cv = 0; T.plan = 0; T.dv = 0; T.lie = 0; T.grab = 0; T.vx = 0; T.vy = 0;
  W.emit('mgFrisAim', { p: th });
}

function throwIt(W, g, hold) {
  const th = g.th, T = g.P[th], C = g.P[1 - th], dir = th === 0 ? 1 : -1;
  const limp = hold < 0 ? 1 : 0, over = hold >= FRIS.HOLD_MAX ? 1 : 0;
  const perf = hold >= FRIS.FULL && hold < FRIS.FULL + FRIS.PERF ? 1 : 0;
  const p = limp ? 0.25 : clampN(hold / FRIS.FULL, 0.15, 1);
  const c = clampN(T.cv, -1, 1);
  const ym = markerY(g), scat = perf ? 0 : over ? 16 : 1 + (1 - p) * 6;
  const y1 = ym + c * FRIS.EFFET + (W.rng() - 0.5) * 2 * scat;
  const x1 = 50 + dir * (20 + p * 24) + (over ? dir * (6 + W.rng() * 10) : 0);
  const sp = 55 + 70 * p + (perf ? 14 : 0), len = Math.max(20, DMath.hypot(x1 - T.x, y1 - T.y));
  const out = y1 < 0 || y1 > FRIS.H || x1 < 0 || x1 > FRIS.W ? 1 : 0;
  g.fr = { x0: T.x, y0: T.y, qx: (T.x + x1) / 2, qy: (T.y + ym) / 2 - c * 16, x1, y1, s: 0, ds: sp / len / 60, p, c, perf, over, limp, out, cx: C.x, cy: C.y };
  g.ph = 'fly'; g.u = 0; g.n++;
  T.hold = -1; T.thr++;
  W.emit('mgFrisThrow', { p: th, pw: Math.round(p * 100), c: Math.round(c * 100), perf, over, limp, out, x: Math.round(x1 * 10), y: Math.round(y1 * 10) });
}

// le CPU : lanceur (charge, attend que la cible soit loin de l'autre, de l'effet vers l'extérieur) ou receveur
function bot(W, M, g, i) {
  const lvl = botLevel(W, M, i), P = g.P[i], I = { mx: 0, my: 0, held: 0, pressed: 0 };
  if (g.ph === 'aim' && g.th === i) {
    const C = g.P[1 - i], ym = markerY(g);
    if (!P.plan) {
      P.plan = 1; P.h0 = [16, 10, 5][lvl - 1] + (W.rng() * 12 | 0);
      P.hp = Math.round(FRIS.FULL + 2 + gauss(W) * [8, 4.5, 2.2][lvl - 1] * P.bk);
      P.far = [10, 15, 21][lvl - 1] * (0.7 + P.bk * 0.4);
      P.ca = [0.35, 0.6, 0.85][lvl - 1] * (0.6 + W.rng() * 0.6);
    }
    if (g.u < P.h0) return I;
    let c = (ym > C.y ? 1 : -1) * P.ca;
    if (lvl >= 2) { const y1 = ym + c * FRIS.EFFET; if (y1 < 4 || y1 > FRIS.H - 4) c *= lvl === 3 ? 0.15 : 0.5; }
    I.my = -c;
    if (P.hold < 0) { I.pressed = BTN.A; I.held = BTN.A; return I; }
    const late = lvl === 3 ? Math.min(P.hp + 9, FRIS.FULL + FRIS.PERF - 1) : P.hp + [3, 7][lvl - 1];
    const rel = P.hold >= P.hp && (Math.abs(ym + c * FRIS.EFFET - C.y) >= P.far || P.hold >= late);
    if (!rel) I.held = BTN.A;
    return I;
  }
  const lo = half(i);
  let tx = i === 0 ? 18 : 82, ty = 30;
  const fr = g.fr;
  if (g.ph === 'aim') ty = 30 + (markerY(g) - 30) * [0.15, 0.25, 0.35][lvl - 1] * P.bk;
  else if (g.ph === 'fly' && 1 - g.th === i && g.hold < 0) {
    if (P.rd < 0) { P.rd = [13, 9, 6][lvl - 1] + (W.rng() * 6 | 0); P.ex = gauss(W) * [5, 4.2, 3.4][lvl - 1] * P.bk; P.ey = gauss(W) * [5, 4.2, 3.4][lvl - 1] * P.bk; P.dd = 0; }
    if (P.rd > 0) { P.rd--; return I; }
    // le point de la trajectoire qu'il peut atteindre à temps
    const spd = FRIS.RUN * [0.86, 0.92, 0.97][lvl - 1];
    let pt = frisAt(fr, 1), dist = 0;
    for (let s = Math.max(FRIS.CATCH_S, fr.s); s <= 1.0001; s += 0.05) {
      const q = frisAt(fr, Math.min(1, s)), d = DMath.hypot(q[0] - P.x, q[1] - P.y), tt = (s - fr.s) / fr.ds / 60;
      if (d - FRIS.R * 0.7 <= spd * tt) { pt = q; break; }
    }
    tx = pt[0] + P.ex; ty = pt[1] + P.ey;
    const b = frisAt(fr, fr.s);
    dist = DMath.hypot(b[0] - P.x, b[1] - P.y);
    if (P.dv <= 0 && P.lie <= 0 && P.cd <= 0 && fr.s >= FRIS.CATCH_S - 0.05) {
      if (dist < FRIS.R * 0.85 && W.rng() < [0.36, 0.48, 0.65][lvl - 1]) { I.pressed = BTN.A; I.held = BTN.A; return I; }
      const nb = frisAt(fr, Math.min(1, fr.s + fr.ds * 8)), nd = DMath.hypot(nb[0] - P.x, nb[1] - P.y);
      if (!P.dd && nd > FRIS.R * 0.8 && nd < FRIS.RD + 9 && (fr.s > 0.8 || nd > dist) && W.rng() < [0.08, 0.16, 0.3][lvl - 1]) {
        P.dd = 1;
        I.mx = (nb[0] - P.x) / nd; I.my = -(nb[1] - P.y) / nd; I.pressed = BTN.A; I.held = BTN.A; return I;
      }
    }
  } else { P.rd = -1; if (g.ph === 'fly') { tx = i === 0 ? 20 : 80; ty = 30; } else { tx = P.x; ty = P.y; } }
  const dx = clampN(tx, lo[0], lo[1]) - P.x, dy = ty - P.y, d = DMath.hypot(dx, dy);
  if (d > 0.6) { const k = Math.min(1, d / 5); I.mx = dx / d * k; I.my = -dy / d * k; }
  return I;
}

export default {
  name: 'Frisbee de l\'au-delà',

  init(W) {
    const pl = (x) => ({ x, y: 30, vx: 0, vy: 0, dv: 0, dx: 0, dy: 0, lie: 0, grab: 0, cd: 0, hold: -1, cv: 0, score: 0, ct: 0, dives: 0, thr: 0, bk: 0.7 + W.rng() * 0.6, plan: 0, h0: 0, hp: 0, far: 0, ca: 0, rd: -1, ex: 0, ey: 0, dd: 0 });
    return { ph: 'start', u: 0, th: 0, n: 0, mk: 0, mks: 3, fr: null, hold: -1, P: [pl(16), pl(84)], over: 0 };
  },

  step(W, M, g, ia, iv) {
    if (g.ph === 'start') newAim(W, g, 0);
    const ins = [ia || bot(W, M, g, 0), iv || bot(W, M, g, 1)];
    g.u++;
    if (g.ph === 'aim') g.mk += g.mks / 60;
    for (let i = 0; i < 2; i++) {
      const P = g.P[i], I = ins[i], lo = half(i);
      const thrower = g.ph === 'aim' && g.th === i;
      if (P.cd > 0) P.cd--;
      // le lanceur : tenir A charge, lâcher lance ; le stick haut/bas donne l'effet
      if (thrower) {
        P.cv = clampN(-I.my, -1, 1);
        if (P.hold < 0) { if (I.pressed & BTN.A) { P.hold = 0; W.emit('mgFrisCharge', { p: i }); } }
        else if (I.held & BTN.A) { P.hold++; if (P.hold >= FRIS.HOLD_MAX) throwIt(W, g, P.hold); }
        else throwIt(W, g, P.hold);
        if (g.ph === 'aim' && g.u >= FRIS.AIM && P.hold < 0) throwIt(W, g, -1);
        continue;
      }
      // courir, plonger, rester à plat ventre
      if (P.lie > 0) { P.lie--; P.vx = 0; P.vy = 0; }
      else if (P.dv > 0) {
        const v = FRIS.DIVE * (0.35 + 0.65 * P.dv / FRIS.DIVE_T);
        P.vx = P.dx * v; P.vy = P.dy * v;
        if (--P.dv <= 0) { P.lie = FRIS.LIE; W.emit('mgFrisFlop', { p: i }); }
      } else if (g.hold !== i) {
        const sx = clampN(I.mx, -1, 1), sy = clampN(-I.my, -1, 1), m = DMath.hypot(sx, sy), k = m > 1 ? 1 / m : 1;
        P.vx += (sx * k * FRIS.RUN - P.vx) * 0.32; P.vy += (sy * k * FRIS.RUN - P.vy) * 0.32;
        if ((I.pressed & BTN.A) && P.cd <= 0) {
          if (m > 0.5) { P.dv = FRIS.DIVE_T; P.dx = sx / m; P.dy = sy / m; P.grab = FRIS.DIVE_T + 3; P.cd = FRIS.DIVE_T + FRIS.LIE; P.dives++; W.emit('mgFrisDive', { p: i, dx: Math.round(P.dx * 100), dy: Math.round(P.dy * 100) }); }
          else { P.grab = FRIS.GRAB_T; P.cd = FRIS.GRAB_T + FRIS.GRAB_CD; W.emit('mgFrisGrab', { p: i }); }
        }
      } else { P.vx *= 0.8; P.vy *= 0.8; }
      P.x = clampN(P.x + P.vx / 60, lo[0], lo[1]); P.y = clampN(P.y + P.vy / 60, -3, FRIS.H + 3);
      // la saisie
      if (P.grab > 0) {
        P.grab--;
        const fr = g.fr;
        if (g.ph === 'fly' && 1 - g.th === i && fr.s >= FRIS.CATCH_S) {
          const b = frisAt(fr, fr.s), d = DMath.hypot(b[0] - P.x, b[1] - P.y);
          if (d < (P.dv > 0 ? FRIS.RD : FRIS.R)) {
            const dive = P.dv > 0 ? 1 : 0, ext = fr.s >= FRIS.EXT_S ? 1 : 0;
            const far = Math.min(60, Math.round(DMath.hypot(b[0] - fr.cx, b[1] - fr.cy) * 1.5));
            const pts = 100 + far + dive * 50 + ext * 50;
            P.score += pts; P.ct++; P.grab = 0; g.hold = i;
            W.emit('mgFrisCatch', { p: i, pts, dive, ext, far, x: Math.round(b[0] * 10), y: Math.round(b[1] * 10) });
            g.ph = 'post'; g.u = 0; g.next = i; g.pl = FRIS.POST_C;
          } else if (P.grab === 0) W.emit('mgFrisWhiff', { p: i, near: d < 12 ? 1 : 0 });
        }
      }
    }
    if (g.ph === 'fly') {
      const fr = g.fr;
      fr.s = Math.min(1, fr.s + fr.ds);
      if (fr.s >= 1) {
        const th = g.th, C = g.P[1 - th], T = g.P[th];
        if (fr.out) C.score += 50; else T.score += 100;
        W.emit('mgFrisLand', { p: th, out: fr.out, pts: fr.out ? 50 : 100, x: Math.round(fr.x1 * 10), y: Math.round(fr.y1 * 10) });
        g.ph = 'post'; g.u = 0; g.next = 1 - th; g.pl = FRIS.POST_L;
      }
    } else if (g.ph === 'post' && g.u >= g.pl && M.t < MG_PLAY - 24) newAim(W, g, g.next);
  },

  result(W, M, g) { return scorePayout(W, M, g.P[0].score, g.P[1].score, 15, 10); },
};
