// Le médiator d'Epektase (mediator) : Epektase a perdu son médiator sur son bureau en bazar. Chacun son bureau, le même
// pour les deux (même objets, même cachette, tirés au hasard) : une grille de COLS x ROWS objets. Une flèche (ou le
// stick d'un coup ; tenu, ça répète) déplace la main d'un objet à l'autre, A le soulève (LIFT images). Dessous : le
// médiator, ou rien, mais l'objet dit si on chauffe (BRÛLANT : juste à côté, TIÈDE : à deux cases, FROID : plus loin).
// Le premier qui le trouve marque (100 + la vitesse), puis un nouveau bureau. Le meilleur score gagne.
import { BTN, scorePayout, botLevel, clampN } from './common.js';

export const MED = { COLS: 4, ROWS: 3, KINDS: 14, LIFT: 9, GAP: 64, REP0: 14, REP: 7 };
// la chaleur d'un objet soulevé : sa distance au médiator (en cases, les diagonales comptent pour une)
export const heatOf = (c, pick) => {
  const d = Math.max(Math.abs((c % MED.COLS) - (pick % MED.COLS)), Math.abs(((c / MED.COLS) | 0) - ((pick / MED.COLS) | 0)));
  return d <= 1 ? 2 : d === 2 ? 1 : 0; // 2 brûlant, 1 tiède, 0 froid
};

function newDesk(W, g) {
  const N = MED.COLS * MED.ROWS, kinds = [];
  for (let k = 0; k < MED.KINDS; k++) kinds.push(k);
  for (let k = kinds.length - 1; k > 0; k--) { const j = W.rng.int(0, k), x = kinds[k]; kinds[k] = kinds[j]; kinds[j] = x; }
  g.kinds = kinds.slice(0, N);
  g.jit = [];
  for (let c = 0; c < N; c++) g.jit.push([W.rng.int(-6, 6), W.rng.int(-5, 5), W.rng.int(-20, 20)]); // décalage x, y, angle (degrés)
  g.start = W.rng.int(0, N - 1);
  do g.pick = W.rng.int(0, N - 1); while (g.pick === g.start);
  for (const P of g.p) { P.c = g.start; P.up = []; for (let c = 0; c < N; c++) P.up.push(-1); P.lift = 0; P.lc = -1; P.b.tg = -1; P.b.wait = 0; }
}

export default {
  name: "Le médiator d'Epektase",

  init(W) {
    const pl = () => ({ s: 0, found: 0, lifts: 0, c: 0, up: [], lift: 0, lc: -1, armed: 1, rep: 0, last: -1, b: { k: 0.8 + W.rng() * 0.45, tg: -1, wait: 0 } });
    const g = { ph: 'gap', t: 0, gap: 10, n: 0, kinds: [], jit: [], pick: 0, start: 0, p: [pl(), pl()], win: -1, over: 0 };
    return g;
  },

  step(W, M, g, ia, iv) {
    g.t++;
    if (g.ph === 'gap' && g.t >= g.gap) {
      newDesk(W, g); g.n++; g.ph = 'look'; g.t = 0; g.win = -1;
      W.emit('mgMediatorDesk', { n: g.n });
      for (let i = 0; i < 2; i++) g.p[i].b.wait = Math.round([30, 20, 12][botLevel(W, M, i) - 1] * g.p[i].b.k);
    }
    const ins = [ia, iv], found = [];
    for (let i = 0; i < 2; i++) {
      const P = g.p[i];
      if (g.ph !== 'look') continue;
      const I = ins[i] || medBot(W, M, g, P, i);
      // la main : un objet à la fois, tenu = ça répète
      const ax = Math.abs(I.mx), ay = Math.abs(I.my);
      let dir = -1;
      if (ax < 0.35 && ay < 0.35) { P.armed = 1; P.rep = 0; }
      else if (Math.max(ax, ay) > 0.6) {
        const d = ax >= ay ? (I.mx > 0 ? 1 : 3) : (I.my > 0 ? 0 : 2);
        if (P.armed || d !== P.last) { dir = d; P.armed = 0; P.rep = 0; }
        else if (++P.rep >= MED.REP0 && (P.rep - MED.REP0) % MED.REP === 0) dir = d;
        P.last = d;
      }
      if (dir >= 0 && P.lift <= 0) {
        let x = P.c % MED.COLS, y = (P.c / MED.COLS) | 0;
        if (dir === 0) y--; else if (dir === 2) y++; else if (dir === 1) x++; else x--;
        x = clampN(x, 0, MED.COLS - 1); y = clampN(y, 0, MED.ROWS - 1);
        const c = y * MED.COLS + x;
        if (c !== P.c) { P.c = c; W.emit('mgMediatorMove', { p: i, c }); }
      }
      // soulever
      if (P.lift > 0) {
        if (--P.lift === 0) {
          const c = P.lc;
          if (c === g.pick) { P.up[c] = 3; found.push(i); }
          else { P.up[c] = heatOf(c, g.pick); W.emit('mgMediatorLift', { p: i, c, h: P.up[c] }); }
        }
      } else if ((I.pressed & BTN.A) && P.up[P.c] < 0) {
        P.lift = MED.LIFT; P.lc = P.c; P.lifts++;
        W.emit('mgMediatorUp', { p: i, c: P.c });
      }
    }
    if (found.length) {
      for (const i of found) {
        const P = g.p[i], pts = 100 + Math.round(60 * clampN(1 - g.t / 300, 0, 1));
        P.s += pts; P.found++;
        W.emit('mgMediatorFound', { p: i, c: g.pick, pts, f: g.t, n: P.found, both: found.length > 1 ? 1 : 0 });
      }
      g.win = found.length > 1 ? 2 : found[0];
      g.ph = 'gap'; g.t = 0; g.gap = MED.GAP;
    }
  },

  result(W, M, g) {
    return scorePayout(W, M, g.p[0].s, g.p[1].s, 15, 16, 70, { fa: g.p[0].found, fv: g.p[1].found });
  },
};

// le CPU : choisit un objet (le malin tient compte des « chaud / froid », le facile soulève un peu au hasard), y va case
// par case, le soulève
function medBot(W, M, g, P, i) {
  const b = P.b, lvl = botLevel(W, M, i), I = { mx: 0, my: 0, held: 0, pressed: 0 };
  if (P.lift > 0) return I;
  if (b.wait > 0) { b.wait--; return I; }
  const N = MED.COLS * MED.ROWS;
  if (b.tg < 0 || P.up[b.tg] >= 0) {
    const free = [], fit = [];
    for (let c = 0; c < N; c++) {
      if (P.up[c] >= 0) continue;
      free.push(c);
      let ok = true;
      for (let l = 0; l < N && ok; l++) if (P.up[l] >= 0 && P.up[l] < 3 && heatOf(l, c) !== P.up[l]) ok = false;
      if (ok) fit.push(c);
    }
    const list = fit.length && W.rng() < [0.4, 0.72, 0.95][lvl - 1] ? fit : free;
    // le plus proche de la main parmi eux (un peu au hasard entre égaux)
    let best = -1, bd = 99;
    for (const c of list) {
      const d = Math.abs((c % MED.COLS) - (P.c % MED.COLS)) + Math.abs(((c / MED.COLS) | 0) - ((P.c / MED.COLS) | 0)) + W.rng() * 1.5;
      if (d < bd) { bd = d; best = c; }
    }
    b.tg = best;
  }
  const tx = b.tg % MED.COLS, ty = (b.tg / MED.COLS) | 0, x = P.c % MED.COLS, y = (P.c / MED.COLS) | 0;
  if (!P.armed) return I; // relâcher entre deux pas
  b.wait = Math.round(([12, 8, 5][lvl - 1] + W.rng() * 4) * b.k);
  if (tx !== x) I.mx = tx > x ? 1 : -1;
  else if (ty !== y) I.my = ty > y ? -1 : 1;
  else { I.pressed = BTN.A; I.held = BTN.A; b.wait = Math.round(([16, 10, 6][lvl - 1]) * b.k); }
  return I;
}
