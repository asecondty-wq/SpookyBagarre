// Trial du cimetière (trials) : une moto de trial sur un chemin de cimetière vu de côté (bosses, rampes, tombes, collines),
// la même piste pour les deux (une ligne chacun). Deux commandes seulement : A (tenir) = les gaz (lâcher : elle ralentit),
// ◀ / ▶ = pencher la moto en arrière / en avant en l'air (▲ / ▼ marchent aussi) ; sans rien toucher, elle se remet
// d'elle-même vers la pente où elle va retomber. Atterrir trop penché = la chute : le pilote
// vole, puis repart un peu en arrière (CRASH images plus tard). Un salto complet posé proprement : +SALTO m.
// Le plus loin à droite gagne (à égalité, le premier arrivé) ; le perdant prend 15 % + l'écart / 4 (en mètres).
// Unités : x vers la droite, y vers le haut, M unités par mètre ; la piste : une hauteur tous les STEP.
import { BTN, DMath, clampN, payout, botLevel, slotOf } from './common.js';

export const TRIALS = {
  STEP: 8, LEN: 3200, FIN: 3000, M: 20, G: 0.2, ACC: 0.075, MAXV: 5.4, BRAKE: 0.16, LEAN: 0.0065, AIRDAMP: 0.95, AUTO: 0.055,
  CRASH_ANG: 0.78, WALL: 14, CRASH: 48, INV: 40, SALTO: 10, WB: 13,
};
const C = TRIALS;
const GAS = BTN.A | BTN.JUMP;

export function trialsH(g, x) {
  const u = clampN(x / C.STEP, 0, g.h.length - 1.001), i = Math.floor(u), f = u - i;
  return g.h[i] + (g.h[i + 1] - g.h[i]) * f;
}
// la pente du morceau de piste sous x (exacte : au bord d'une rampe, c'est encore la rampe), et lissée (pour l'affichage)
export function trialsSlope(g, x) {
  const i = Math.floor(clampN(x / C.STEP, 0, g.h.length - 1.001));
  return DMath.atan2(g.h[i + 1] - g.h[i], C.STEP);
}
export function trialsSlopeS(g, x) { return DMath.atan2(trialsH(g, x + 6) - trialsH(g, x - 6), 12); }

// la piste : des morceaux tirés au hasard (W.rng), la même pour les deux ; g.dec : les tombes et rampes (pour l'affichage)
function build(W) {
  const n = Math.ceil(C.LEN / C.STEP) + 2, h = new Array(n).fill(0), dec = [];
  let i = Math.round(220 / C.STEP), base = 0;
  const put = (k, y) => { if (k < n) h[k] = Math.round(y * 10) / 10; };
  for (let k = 0; k < i; k++) put(k, 0);
  let last = '';
  while (i < n) {
    const r = W.rng();
    let kind = r < 0.22 ? 'bumps' : r < 0.47 ? 'ramp' : r < 0.67 ? 'grave' : r < 0.85 ? 'hill' : 'flat';
    if (kind === last && kind !== 'grave') kind = 'flat';
    last = kind;
    if (kind === 'flat') { const L = W.rng.int(6, 12); for (let k = 0; k < L; k++) put(i + k, base); i += L; }
    else if (kind === 'bumps') {
      const L = W.rng.int(3, 5) * 8, a = 4 + W.rng() * 6;
      for (let k = 0; k < L; k++) put(i + k, base + a * (1 - DMath.cos(k / 8 * 6.2832)) / 2);
      i += L;
    } else if (kind === 'ramp') {
      // la rampe se relève jusqu'à ~37° au bord (le saut), puis le vide jusqu'au sol (plus ou moins bas)
      const up = 28 + W.rng() * 36, L = Math.max(6, Math.round(up * 1.4 / (C.STEP * 0.75))), drop = W.rng() < 0.5 ? up : up * (0.4 + W.rng() * 0.5);
      for (let k = 0; k <= L; k++) { const u = k / L; put(i + k, base + up * u * (0.6 + 0.4 * u)); }
      i++;
      dec.push([0, (i + L - 1) * C.STEP, Math.round(base + up)]);
      i += L;
      const nb = Math.max(0, Math.min(140, base + up - drop));
      put(i, nb); put(i + 1, nb); i += 2; base = nb;
      const F = W.rng.int(8, 13); for (let k = 0; k < F; k++) put(i + k, base); i += F;
    } else if (kind === 'grave') {
      // une tombe : un petit tertre, la pierre au sommet
      const up = 12 + W.rng() * 10;
      const prof = [0.3, 0.75, 1, 1, 0.75, 0.3];
      for (let k = 0; k < prof.length; k++) put(i + k, base + up * prof[k]);
      dec.push([1, (i + 2.5) * C.STEP, Math.round(base + up)]);
      i += prof.length;
      const F = W.rng.int(3, 7); for (let k = 0; k < F; k++) put(i + k, base); i += F;
    } else {
      const L = W.rng.int(18, 30), up = (W.rng() < 0.5 ? 1 : -1) * (20 + W.rng() * 30), nb = clampN(base + up, -40, 140);
      for (let k = 0; k < L; k++) put(i + k, base + (nb - base) * (1 - DMath.cos(k / L * 3.1416)) / 2);
      i += L; base = nb;
    }
  }
  return { h, dec };
}

const rider = () => ({ x: 60, y: 0, vx: 0, vy: 0, ang: 0, av: 0, gr: 1, air: 0, rot: 0, cr: 0, inv: 0, crashes: 0, flips: 0, bon: 0, best: 60, fin: 0, gas: 0, lean: 0,
  b: { bk: 1, err: 0, hes: 0, mode: 0, rt: 0 } });

// une image de moto ; rend { land, crash, wall, flip } (pour les évènements)
function ride(g, P, gas, brake, lean) {
  const out = { land: 0, crash: 0, wall: 0, flip: 0, hard: 0 };
  P.gas = gas ? 1 : 0; P.lean = lean;
  if (P.gr) {
    const ga = trialsSlope(g, P.x), c = DMath.cos(ga), s = DMath.sin(ga);
    let sp = P.vx * c + P.vy * s;
    if (gas) sp = Math.min(C.MAXV, sp + C.ACC * (sp < 2 ? 1.6 : 1));
    else if (brake) sp = sp > 0 ? Math.max(0, sp - C.BRAKE) : Math.max(-1.2, sp - C.ACC * 0.5);
    else sp *= 0.993;
    sp -= C.G * 0.5 * s; // la pente freine en montée, pousse en descente (adhérence de trial : on monte presque tout)
    P.vx = sp * c; P.vy = sp * s;
    P.ang += (ga + lean * 0.12 - P.ang) * 0.45; P.av = 0;
  } else {
    if (lean) P.av += lean * C.LEAN;
    P.av *= C.AIRDAMP;
    P.ang += P.av; P.rot += P.av;
    if (!lean) { // elle se remet doucement d'elle-même vers la pente où elle va tomber
      const ga = trialsSlope(g, P.x + P.vx * 10);
      P.ang += (ga - P.ang) * C.AUTO;
    }
    P.air++;
  }
  if (!P.gr) P.vy -= C.G; // (au sol, la pente s'en charge plus haut)
  const x0 = P.x;
  P.x = clampN(P.x + P.vx, 20, C.LEN - 20);
  P.y += P.vy;
  const hh = trialsH(g, P.x);
  if (P.gr && hh - P.y > C.WALL) { // un mur devant : on rebondit
    P.x = x0; P.vx = -Math.abs(P.vx) * 0.3 - 0.4; P.y = trialsH(g, P.x); out.wall = 1; return out;
  }
  if (P.y <= hh) {
    if (!P.gr) {
      const ga = trialsSlope(g, P.x);
      let d = P.ang - ga;
      d -= Math.round(d / 6.2832) * 6.2832;
      if (Math.abs(d) > C.CRASH_ANG && P.inv <= 0) { out.crash = 1; P.y = hh; return out; }
      const n = Math.floor(Math.abs(P.rot) / 6.0);
      if (n > 0) out.flip = n * (P.rot > 0 ? 1 : -1);
      out.land = P.air; out.hard = P.vy < -6 ? 1 : 0;
      P.gr = 1; P.av = 0;
      // la vitesse gardée le long de la pente (un peu perdue si on arrive de travers)
      const c = DMath.cos(ga), s = DMath.sin(ga), sp = (P.vx * c + P.vy * s) * (1 - Math.abs(d) * 0.4);
      P.vx = sp * c; P.vy = sp * s;
    }
    P.y = hh;
  } else if (P.gr && P.y > hh + 1.5) { P.gr = 0; P.air = 0; P.rot = 0; }
  if (!P.gr && P.ang - trialsSlope(g, P.x) > 2.6 && P.y - hh < 10 && P.inv <= 0) out.crash = 1; // retournée sur le dos
  return out;
}

function respawn(W, g, P, i) {
  let x = Math.max(60, P.x - 50);
  for (let k = 0; k < 20 && Math.abs(trialsSlope(g, x)) > 0.25; k++) x = Math.max(60, x - 10);
  Object.assign(P, { x, y: trialsH(g, x), vx: 0.8, vy: 0, ang: trialsSlope(g, x), av: 0, gr: 1, air: 0, rot: 0, inv: C.INV });
  W.emit('mgTrialsBack', { p: i, x: Math.round(x) });
}

export default {
  name: 'Trial du cimetière',

  init(W) {
    const { h, dec } = build(W);
    return { h, dec, p: [rider(), rider()], lead: -1, inited: 0, over: 0 };
  },

  step(W, M, g, ia, iv) {
    const ins = [ia, iv];
    if (!g.inited) {
      g.inited = 1;
      for (let i = 0; i < 2; i++) { const b = g.p[i].b; b.bk = 0.8 + W.rng() * 0.4; b.err = (W.rng() - 0.5) * 0.3; }
    }
    for (let i = 0; i < 2; i++) {
      const P = g.p[i];
      if (P.inv > 0) P.inv--;
      if (P.fin) continue;
      if (P.cr > 0) { if (--P.cr === 0) respawn(W, g, P, i); continue; }
      const I = ins[i] || trialsBot(W, M, g, i, botLevel(W, M, i));
      const gas = (I.held & GAS) !== 0, brake = false;
      const lean = I.mx < -0.4 || I.my > 0.4 ? 1 : I.mx > 0.4 || I.my < -0.4 ? -1 : 0; // ◀ (ou ▲) : en arrière, ▶ (ou ▼) : en avant
      const o = ride(g, P, gas, brake, lean);
      if (o.crash) {
        P.cr = C.CRASH; P.crashes++;
        W.emit('mgTrialsCrash', { p: i, x: Math.round(P.x), y: Math.round(P.y), v: Math.round(DMath.hypot(P.vx, P.vy) * 10) / 10, a: Math.round(P.ang * 100) / 100 });
        P.vx = 0; P.vy = 0; P.gas = 0;
        continue;
      }
      if (o.wall) W.emit('mgTrialsWall', { p: i });
      if (o.land) {
        if (o.flip) { P.flips += Math.abs(o.flip); P.bon += Math.abs(o.flip) * C.SALTO; W.emit('mgTrialsFlip', { p: i, n: o.flip }); }
        if (o.land > 14) W.emit('mgTrialsLand', { p: i, air: o.land, hard: o.hard });
      }
      if (P.x > P.best) P.best = P.x;
      if (P.x >= C.FIN && !P.fin) { P.fin = M.t; W.emit('mgTrialsFinish', { p: i, t: M.t }); }
    }
    const lead = score(g, 0) !== score(g, 1) ? (score(g, 0) > score(g, 1) ? 0 : 1) : -1;
    if (lead >= 0 && lead !== g.lead && M.t > 60) W.emit('mgTrialsLead', { p: lead });
    if (lead >= 0) g.lead = lead;
    if (g.p[0].fin && g.p[1].fin) g.over = 1;
  },

  result(W, M, g) {
    const sa = score(g, 0), sv = score(g, 1);
    if (sa === sv) return payout(W, -1, -1, 0, { sa, sv });
    const w = sa > sv ? 0 : 1;
    return payout(W, slotOf(M, w), slotOf(M, 1 - w), Math.round(clampN(15 + Math.abs(sa - sv) / 4, 15, 70)), { sa, sv, kbb: 18, kbg: 180 });
  },
};

// le score : les mètres parcourus (le plus loin atteint) + les saltos ; arrivé : un bonus selon le temps restant
export function score(g, i) {
  const P = g.p[i];
  return Math.round(P.best / C.M) + P.bon + (P.fin ? Math.round((600 - P.fin) / 10) : 0);
}

// --- CPU pilote ----------------------------------------------------------------------------------------------------
// Il met les gaz (lâche parfois, s'il est faible), et en l'air vise la pente de l'endroit où il va retomber (une petite
// simulation de sa chute), avec une erreur tirée à chaque saut (grande s'il est faible) et un temps de réaction. Fort, il
// tente parfois un salto sur les grands sauts.
function landing(g, P) {
  let x = P.x, y = P.y, vy = P.vy;
  for (let f = 0; f < 120; f++) { vy -= C.G; x += P.vx; y += vy; if (y <= trialsH(g, x)) return { x, f }; }
  return { x, f: 120 };
}
function trialsBot(W, M, g, i, lvl) {
  const P = g.p[i], b = P.b, I = { mx: 0, my: 0, held: 0, pressed: 0 };
  if (b.hes > 0) b.hes--;
  else if (W.rng() < [0.012, 0.005, 0.0015][lvl - 1]) b.hes = W.rng.int(8, 30);
  if (!b.hes && P.vx < C.MAXV * [0.82, 0.93, 1][lvl - 1] * b.bk + 0.5) I.held |= BTN.A;
  if (P.gr) { b.mode = 0; b.rt = 0; b.err = (W.rng() - 0.5) * [1.5, 0.75, 0.25][lvl - 1]; return I; }
  if (P.air === 1) {
    b.rt = [14, 8, 4][lvl - 1] + W.rng.int(0, 4);
    const L = landing(g, P);
    b.mode = lvl === 3 && L.f > 62 && W.rng() < 0.35 ? 1 : lvl === 2 && L.f > 75 && W.rng() < 0.15 ? 1 : 0;
  }
  if (b.rt > 0) { b.rt--; return I; }
  if (b.mode === 1) { if (P.rot < 5.7) { I.mx = -1; return I; } b.mode = 0; }
  const L = landing(g, P), want = trialsSlope(g, L.x) + b.err + (b.mode ? 0 : 0.05);
  let d = want - P.ang; d -= Math.round(d / 6.2832) * 6.2832;
  const fut = d - P.av * 10;
  if (fut > 0.12) I.mx = -1; else if (fut < -0.12) I.mx = 1;
  return I;
}
