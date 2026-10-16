// Le 49.3 (macron) : le président veut son 49.3. Chacun son curseur de 0 à 100 (au dixième) qui fait des allers-retours
// tout seul, parti du même endroit, à la même vitesse pour les deux : A l'arrête. Le plus près de 49.3 ; ROUNDS manches,
// de plus en plus vite (SPEED, en dixièmes par image) ; pas arrêté au bout de SET images : figé là où il est. On
// additionne les écarts : le plus petit total gagne. Les valeurs sont en dixièmes (493 = 49.3).
import { BTN, scorePayout, botLevel } from './common.js';

export const MAC = { GOAL: 493, MAX: 1000, ROUNDS: 4, SET: 180, SHOW: 40, SPEED: [6, 8, 10, 13] };

export default {
  name: 'Le 49.3',

  init(W) {
    const pl = () => ({ v: 0, vel: 0, lock: 0, late: 0, tot: 0, d: [], exact: 0, b: { k: 0.8 + W.rng() * 0.45, e: 0, skip: 0, seen: 0 } });
    return { ph: 'wait', t: 0, r: 0, start: 0, p: [pl(), pl()], over: 0 };
  },

  step(W, M, g, ia, iv) {
    g.t++;
    if ((g.ph === 'wait' && g.t >= 8) || (g.ph === 'show' && g.t >= MAC.SHOW)) {
      if (g.r >= MAC.ROUNDS) { g.over = 1; return; }
      // une nouvelle manche : le même départ pour les deux, loin du but
      do g.start = W.rng.int(30, 970); while (Math.abs(g.start - MAC.GOAL) < 180);
      g.r++; g.ph = 'set'; g.t = 0;
      const dir = W.rng() < 0.5 ? 1 : -1;
      for (let i = 0; i < 2; i++) {
        const P = g.p[i], lvl = botLevel(W, M, i);
        P.v = g.start; P.vel = dir * MAC.SPEED[g.r - 1]; P.lock = 0; P.late = 0;
        // le CPU : appuie un peu trop tôt ou trop tard (en images), laisse parfois passer un premier passage
        const e = [2.2, 1.1, 0.5][lvl - 1] * P.b.k;
        P.b.e = Math.round((W.rng() * 2 - 1) * e * 10) / 10; P.b.skip = W.rng() < [0.35, 0.2, 0.1][lvl - 1] ? 1 : 0; P.b.seen = 0;
      }
      W.emit('mgMacronRound', { r: g.r, s: g.start });
    }
    if (g.ph !== 'set') return;
    const ins = [ia, iv];
    for (let i = 0; i < 2; i++) {
      const P = g.p[i];
      if (P.lock) continue;
      const I = ins[i] || macBot(W, M, g, P, i);
      if (I.pressed & BTN.A) { lockP(W, g, P, i, 0); continue; }
      // l'aller-retour
      P.v += P.vel;
      if (P.v > MAC.MAX) { P.v = 2 * MAC.MAX - P.v; P.vel = -P.vel; } else if (P.v < 0) { P.v = -P.v; P.vel = -P.vel; }
      if (g.t >= MAC.SET) lockP(W, g, P, i, 1);
    }
    if (g.p[0].lock && g.p[1].lock) {
      g.ph = 'show'; g.t = 0;
      W.emit('mgMacronShow', { r: g.r, d0: g.p[0].d[g.r - 1], d1: g.p[1].d[g.r - 1] });
    }
  },

  result(W, M, g) {
    // seulement les manches finies par les deux (le temps peut couper la dernière)
    const n = Math.min(g.p[0].d.length, g.p[1].d.length), sum = (P) => P.d.slice(0, n).reduce((a, b) => a + b, 0);
    const ta = sum(g.p[0]), tv = sum(g.p[1]);
    return scorePayout(W, M, -ta, -tv, 15, 5, 70, { ta, tv });
  },
};

function lockP(W, g, P, i, late) {
  P.v = Math.round(P.v); P.lock = 1; P.late = late ? 1 : 0;
  const d = Math.abs(P.v - MAC.GOAL);
  P.d.push(d); P.tot += d; if (!d) P.exact++;
  W.emit('mgMacronLock', { p: i, v: P.v, d, late: P.late, r: g.r });
}

// le CPU : il regarde l'aiguille venir vers 49.3 et appuie quand elle y sera dans P.b.e images (négatif : trop tard)
function macBot(W, M, g, P, i) {
  const b = P.b, I = { mx: 0, my: 0, held: 0, pressed: 0 };
  if (g.t < 20) return I;
  const f = (MAC.GOAL - P.v) / P.vel; // dans combien d'images l'aiguille passe sur 49.3 (négatif : déjà passée)
  if (f > 6 || f < -3) { if (f < -3 && f > -12 && !b.seen) { b.seen = 1; } return I; }
  if (b.skip && !b.seen) return I; // il laisse passer le premier passage
  if (f <= b.e) { I.pressed = BTN.A; I.held = BTN.A; }
  return I;
}
