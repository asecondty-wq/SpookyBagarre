// Caresses à Reyji (dog) : chacun son Reyji (le shiba de J'san), en écran partagé. Reyji a des envies (une bulle : une
// zone, tête, oreilles, menton, dos ou ventre, et une façon, doucement ou vite) ; la même suite d'envies pour les deux,
// tirée au début. La main se déplace au stick (une vitesse) ou à la souris (un déplacement) ; frotter (va-et-vient) sur
// la bonne zone à la bonne vitesse remplit l'envie (NEED images) et le bonheur ; la bonne zone à la mauvaise vitesse
// avance moins ; ailleurs sur le chien, il grogne de plus en plus (GRR), et la queue, il déteste : GRRR, la main est
// repoussée (sonnée STUN images), le bonheur baisse. Envie comblée : « Wouf wouf ! », un bonus qui grandit avec la série.
// Le ventre : il se roule sur le dos (les zones changent). Le chien le plus heureux gagne.
// Le plateau d'un chien mesure 100 x 80 (y vers le bas) ; les zones sont des cercles [x, y, rayon].
import { MOUSE, MV_L, MV_R, MV_D, clampN, scorePayout, botLevel } from './common.js';

export const DOG = {
  W: 100, H: 80, SPEED: 120, NEED: 66, WISH_T: 270, STUN: 26, ROLL: 16, GRR: 40, TOL: 4,
  SLOW: [6, 52], FAST: 60, START: 20,
  NAMES: ['la tête', 'les oreilles', 'le menton', 'le dos', 'le ventre', 'la queue'],
};
// 0 tête, 1 oreilles, 2 menton, 3 dos, 4 ventre, 5 queue (interdite) ; debout, puis roulé sur le dos. Calées sur le vrai
// shiba 3D de l'affichage (de trois quarts, la tête à gauche, la queue en tire-bouchon au-dessus des reins ; sur le dos :
// la tête en bas à gauche, les pattes en l'air)
export const DOG_ZONES = [
  { 0: [[30, 22, 10]], 1: [[25, 5, 6], [45, 11, 6]], 2: [[28, 40, 7]], 3: [[54, 38, 10]], 5: [[71, 25, 8]] },
  { 4: [[50, 28, 13]], 0: [[33, 67, 9]], 1: [[50, 64, 6]], 5: [[70, 52, 8]] },
];
// le corps (pour savoir si la main frotte le chien ailleurs que sur l'envie) : ellipses [x, y, rx, ry]
export const DOG_BODY = [
  [[58, 47, 21, 15], [30, 22, 16, 15], [29, 40, 10, 9]],
  [[54, 33, 24, 14], [34, 62, 14, 13]],
];

const inC = (x, y, c) => (x - c[0]) * (x - c[0]) + (y - c[1]) * (y - c[1]) <= c[2] * c[2];
const inE = (x, y, e) => ((x - e[0]) / e[2]) * ((x - e[0]) / e[2]) + ((y - e[1]) / e[3]) * ((y - e[1]) / e[3]) <= 1;
// ce que touche la main : la zone voulue d'abord, puis la queue, une autre zone, le corps (9), rien (-1)
export function dogTouch(roll, want, x, y) {
  const Z = DOG_ZONES[roll];
  if (Z[want] && Z[want].some((c) => inC(x, y, [c[0], c[1], c[2] + DOG.TOL]))) return want; // un peu de marge sur l'envie
  if (Z[5].some((c) => inC(x, y, c))) return 5;
  for (const k of [0, 1, 2, 3, 4]) if (Z[k] && Z[k].some((c) => inC(x, y, c))) return k;
  return DOG_BODY[roll].some((e) => inE(x, y, e)) ? 9 : -1;
}

export default {
  name: 'Caresses à Reyji',

  init(W) {
    const wishes = [];
    let last = -1;
    for (let i = 0; i < 30; i++) {
      let z = W.rng() < 0.18 ? 4 : W.rng.int(0, 3);
      if (z === last) z = z === 4 ? W.rng.int(0, 3) : (z + 1 + W.rng.int(0, 2)) % 4;
      last = z;
      wishes.push([z, W.rng() < 0.55 ? 0 : 1]);
    }
    const pl = () => ({
      x: 50, y: 74, vx: 0, vy: 0, w: 0, prog: 0, wt: 0, hap: DOG.START, grr: 0, stun: 0, rs: 0, touch: -1, ok: 0,
      streak: 0, best: 0, done: 0, growls: 0, bad: 0, roll: wishes[0][0] === 4 ? 1 : 0, lock: 0, hintT: 0, goodT: 0,
      b: { react: 0, z: -1, ph: 0, bk: 1, amp: 6, mis: 0, nt: 0, sp: 30 },
    });
    return { wishes, p: [pl(), pl()], over: 0, inited: 0 };
  },

  step(W, M, g, ia, iv) {
    if (!g.inited) {
      g.inited = 1;
      for (let i = 0; i < 2; i++) { const b = g.p[i].b; b.bk = 0.85 + W.rng() * 0.3; b.amp = 5 + W.rng() * 4; newBotWish(W, M, g, i); }
    }
    const ins = [ia, iv];
    for (let i = 0; i < 2; i++) {
      const P = g.p[i], wish = g.wishes[P.w % g.wishes.length];
      const I = ins[i] || dogBot(W, M, g, i, botLevel(W, M, i));
      const x0 = P.x, y0 = P.y;
      // la main
      if (P.stun > 0) { P.stun--; P.x += P.vx / 60; P.y += P.vy / 60; P.vx *= 0.85; P.vy *= 0.85; }
      else if (I.held & MOUSE) {
        P.x += I.mx * 4; P.y -= I.my * 4;
        P.x += (((I.held & MV_R) ? 1 : 0) - ((I.held & MV_L) ? 1 : 0)) * 1.2;
        if (I.held & MV_D) P.y += 1.2;
        P.vx = P.vy = 0;
      } else {
        const s = (v) => v * Math.abs(v) * 0.5 + v * 0.5;
        P.vx += (s(clampN(I.mx, -1, 1)) * DOG.SPEED - P.vx) * 0.3; P.vy += (-s(clampN(I.my, -1, 1)) * DOG.SPEED - P.vy) * 0.3;
        P.x += P.vx / 60; P.y += P.vy / 60;
      }
      P.x = clampN(P.x, 2, DOG.W - 2); P.y = clampN(P.y, 2, DOG.H - 2);
      const sp = Math.sqrt((P.x - x0) * (P.x - x0) + (P.y - y0) * (P.y - y0)) * 60;
      P.rs += (sp - P.rs) * 0.12;
      if (P.hintT > 0) P.hintT--;
      if (P.goodT > 0) P.goodT--;
      // l'envie du moment
      P.wt++;
      if (P.lock > 0) { P.lock--; P.touch = -1; continue; } // il se roule (ou se relève)
      const rub = P.rs > DOG.SLOW[0] && P.stun <= 0;
      const t = dogTouch(P.roll, wish[0], P.x, P.y);
      P.touch = rub ? t : -1;
      P.ok = 0;
      if (rub && t === wish[0]) {
        const good = wish[1] === 0 ? P.rs <= DOG.SLOW[1] : P.rs >= DOG.FAST;
        P.ok = good ? 2 : 1;
        P.prog += good ? 1 : 0.3;
        P.hap += good ? 0.24 * (1 + Math.min(5, P.streak) * 0.12) : 0.05;
        P.grr = Math.max(0, P.grr - 2);
        if (good) { P.goodT = 6; P.bad = 0; }
        else if (++P.bad >= 20 && !P.hintT) { P.hintT = 50; W.emit('mgDogHint', { p: i, want: wish[1], sp: Math.round(P.rs) }); }
      } else if (rub && t === 5) {
        P.grr += 7; P.hap = Math.max(0, P.hap - 0.08);
      } else if (rub && t >= 0) {
        P.grr += 1; P.hap = Math.max(0, P.hap - 0.04);
      } else P.grr = Math.max(0, P.grr - 0.6);
      if (P.ok !== 1) P.bad = 0;
      if (P.grr >= DOG.GRR) {
        const tail = t === 5 ? 1 : 0, loss = tail ? 9 : 5;
        P.hap = Math.max(0, P.hap - loss); P.grr = 0; P.stun = DOG.STUN; P.streak = 0; P.growls++;
        const dx = P.x - (P.roll ? 50 : 55), dy = P.y - 40, d = Math.sqrt(dx * dx + dy * dy) || 1;
        P.vx = dx / d * 160; P.vy = dy / d * 160;
        W.emit('mgDogGrr', { p: i, tail, loss, x: Math.round(P.x), y: Math.round(P.y) });
        continue;
      }
      if (P.prog >= DOG.NEED) {
        P.done++; P.streak++; P.best = Math.max(P.best, P.streak);
        const bonus = 6 + Math.min(5, P.streak - 1) * 2;
        P.hap += bonus;
        W.emit('mgDogWoof', { p: i, n: P.done, s: P.streak, b: bonus, z: wish[0], hap: Math.round(P.hap) });
        nextWish(W, M, g, i);
      } else if (P.wt >= DOG.WISH_T) {
        P.streak = 0; P.hap = Math.max(0, P.hap - 2);
        W.emit('mgDogBof', { p: i, z: wish[0] });
        nextWish(W, M, g, i);
      }
    }
  },

  result(W, M, g) {
    const [a, b] = g.p;
    return scorePayout(W, M, Math.round(a.hap * 10), Math.round(b.hap * 10), 15, 22, 70, { ha: Math.round(a.hap), hv: Math.round(b.hap) });
  },
};

function nextWish(W, M, g, i) {
  const P = g.p[i];
  P.w++; P.prog = 0; P.wt = 0; P.grr = Math.max(0, P.grr - 10);
  const wish = g.wishes[P.w % g.wishes.length], roll = wish[0] === 4 ? 1 : 0;
  if (roll !== P.roll) { P.roll = roll; P.lock = DOG.ROLL; }
  W.emit('mgDogWish', { p: i, z: wish[0], s: wish[1], roll, n: P.w });
  newBotWish(W, M, g, i);
}

// le CPU : un temps de réaction à chaque envie, parfois il se trompe de zone (ou frôle la queue, le facile)
function newBotWish(W, M, g, i) {
  const P = g.p[i], b = P.b, lvl = botLevel(W, M, i), wish = g.wishes[P.w % g.wishes.length];
  b.react = [34, 20, 9][lvl - 1] + W.rng.int(0, [24, 14, 8][lvl - 1]);
  b.z = wish[0]; b.mis = 0;
  if (W.rng() < [0.3, 0.12, 0.03][lvl - 1]) {
    const Z = DOG_ZONES[P.roll];
    const other = Object.keys(Z).map(Number).filter((k) => k !== wish[0] && (k !== 5 || lvl === 1));
    if (other.length) { b.z = other[W.rng.int(0, other.length - 1)]; b.mis = W.rng.int(30, 70); }
  }
  b.nt = 0;
}

function dogBot(W, M, g, i, lvl) {
  const P = g.p[i], b = P.b, I = { mx: 0, my: 0, held: 0, pressed: 0 }, wish = g.wishes[P.w % g.wishes.length];
  if (b.react > 0 || P.lock > 0) { if (b.react > 0) b.react--; return I; }
  if (b.mis > 0 && --b.mis === 0) b.z = wish[0]; // il se rend compte de son erreur
  const Z = DOG_ZONES[P.roll][b.z] || DOG_ZONES[P.roll][wish[0]];
  const c = Z[0], dx = c[0] - P.x, dy = c[1] - P.y, d = Math.sqrt(dx * dx + dy * dy);
  // la vitesse qu'il vise (le facile s'y prend mal), en unités par seconde ; on retrouve la poussée du stick qui la donne
  const fast = wish[1] === 1, err = [0.45, 0.22, 0.08][lvl - 1];
  if (--b.nt <= 0) { b.nt = 30 + W.rng.int(0, 30); b.sp = (fast ? 98 : 30) * b.bk * (1 + (W.rng() - 0.5) * 2 * err); }
  const push = (v) => { const r = Math.min(1, Math.abs(v) / DOG.SPEED); return Math.sign(v) * (-0.5 + Math.sqrt(0.25 + 2 * r)); };
  if (d > c[2] * 0.9) { // y aller
    const v = [70, 95, 115][lvl - 1];
    I.mx = push(dx / d * v); I.my = -push(dy / d * v);
    return I;
  }
  // frotter : va-et-vient horizontal autour du centre, la hauteur corrigée doucement
  const amp = Math.min(c[2] * 0.7, b.amp);
  if (!b.ph || (b.ph > 0 && P.x > c[0] + amp) || (b.ph < 0 && P.x < c[0] - amp)) b.ph = P.x > c[0] ? -1 : 1;
  I.mx = push(b.ph * b.sp);
  I.my = clampN(-dy * 0.06, -0.3, 0.3);
  return I;
}
