// La pluie de Pandrezz (coins) : Pandrezz, géant dans le ciel, fait pleuvoir des pièces sur l'arène ; chacun pousse son
// chapeau haut-de-forme noir (retourné, au sol) pour les attraper. Pièce d'or +1, sac d'or +5, pièce maudite -3 (et le
// chapeau sonné). De temps en temps (W.rng), Pandrezz vise un chapeau (warn), descend (dive) et pioche dedans (steal,
// une pièce toutes les STEAL_EVERY images, et il gobe celles qui tombent dedans) : A au bon moment (quand il est en bas)
// le gifle, il rend tout ce qu'il a pris + BONUS ; A dans le vide sonne un peu le joueur (pas de matraquage).
// Positions : x dans le monde (le plan z = 0 du match), y en mètres au-dessus du sol de la plateforme principale.
import { BTN, DMath, clampN, scorePayout, payout, botLevel } from './common.js';

export const COINS = {
  SKY: 7.9, RIM: 0.85, HAT_R: 0.72, GAP: 1.5, SPEED: 7.6, G: 8.5, PAN_Y: 5.9,
  WARN: 50, DIVE: 22, OPEN: 12, STEAL_EVERY: 9, STEAL_MAX: 7, STEAL_T: 75, FLEE: 30, BONK: 46, BONUS: 2,
  WHIFF_CD: 30, WHIFF_STUN: 12, CURSE_STUN: 24, VAL: [1, 5, -3],
};
const C = COINS;

const hat = (x) => ({ x, vx: 0, n: 0, stun: 0, cd: 0, slaps: 0, whiffs: 0, lost: 0, caught: 0, bags: 0, curses: 0, combo: 0, ct: -99, best: 0,
  b: { tx: x, nt: 0, delay: 0, sw: 0, early: -1, bk: 0, ox: 0 } });

export default {
  name: 'La pluie de Pandrezz',

  init(W) {
    const m = W.stage.main();
    const gx = m.cx, hw = clampN(m.r * 0.5, 4.5, 6.5);
    return {
      gx, hw, hats: [hat(gx - hw * 0.45), hat(gx + hw * 0.45)], coins: [], nid: 1, next: 20,
      pan: { ph: 'sky', t: 0, x: gx, y: C.PAN_Y, tgt: -1, stolen: 0, next: 90 + W.rng.int(0, 50), raids: 0, loot: 0, joy: 0 },
      over: 0, inited: 0,
    };
  },

  step(W, M, g, ia, iv) {
    const ins = [ia, iv], P = g.pan;
    if (!g.inited) { // le style de chaque CPU (deux CPU ne jouent pas pareil)
      g.inited = 1;
      for (let i = 0; i < 2; i++) { const b = g.hats[i].b; b.bk = 0.75 + W.rng() * 0.5; b.ox = (W.rng() - 0.5) * 0.5; }
    }
    // --- la pluie : de plus en plus serrée
    if (--g.next <= 0) {
      const late = M.t > 380;
      g.next = late ? W.rng.int(5, 9) : W.rng.int(6, 12);
      const r = W.rng();
      const k = r < 0.07 ? 1 : (M.t > 100 && r < 0.18) ? 2 : 0;
      g.coins.push({ id: g.nid++, k, x: g.gx + (W.rng() * 2 - 1) * g.hw * 0.95, y: C.SKY + W.rng() * 0.6, vy: -(0.5 + W.rng() * 2), ph: W.rng() * 6 });
      if (g.coins.length > 60) g.coins.shift();
    }
    // --- les chapeaux
    for (let i = 0; i < 2; i++) {
      const H = g.hats[i];
      const I = ins[i] || coinBot(W, M, g, i, botLevel(W, M, i));
      if (H.cd > 0) H.cd--;
      let mx = H.stun > 0 ? 0 : I.mx;
      if (H.stun > 0) H.stun--;
      H.vx += (clampN(mx, -1, 1) * C.SPEED - H.vx) * 0.32;
      H.x = clampN(H.x + H.vx / 60, g.gx - g.hw, g.gx + g.hw);
      // la gifle (A) : seulement sur Pandrezz en bas, dans son propre chapeau
      if ((I.pressed & BTN.A) && H.cd <= 0 && H.stun <= 0) {
        const open = P.tgt === i && ((P.ph === 'dive' && P.t >= C.DIVE - C.OPEN) || P.ph === 'steal');
        if (open) {
          const back = P.stolen;
          H.n += back + C.BONUS; H.slaps++; H.cd = 10;
          W.emit('mgCoinSlap', { p: i, back, x: H.x, quick: P.ph === 'dive' || back === 0 ? 1 : 0, n: H.n });
          P.ph = 'bonk'; P.t = 0; P.stolen = 0;
        } else {
          H.cd = C.WHIFF_CD; H.stun = C.WHIFF_STUN; H.whiffs++;
          W.emit('mgCoinWhiff', { p: i, x: H.x });
        }
      }
    }
    // deux chapeaux ne se traversent pas : ils se poussent
    const A = g.hats[0], B = g.hats[1], d = B.x - A.x;
    if (Math.abs(d) < C.GAP) {
      const push = (C.GAP - Math.abs(d)) / 2, s = d >= 0 ? 1 : -1;
      A.x = clampN(A.x - push * s, g.gx - g.hw, g.gx + g.hw); B.x = clampN(B.x + push * s, g.gx - g.hw, g.gx + g.hw);
      if (Math.abs(A.vx - B.vx) > 4 && (M.t & 7) === 0) W.emit('mgCoinBump', { x: (A.x + B.x) / 2 });
    }
    // --- les pièces
    for (let n = g.coins.length - 1; n >= 0; n--) {
      const c = g.coins[n], y0 = c.y;
      c.vy -= (c.k === 1 ? C.G * 1.35 : C.G) / 60;
      c.y += c.vy / 60;
      if (c.k === 2) c.x += DMath.sin(M.t * 0.12 + c.ph) * 0.035; // la maudite zigzague
      if (y0 > C.RIM && c.y <= C.RIM) {
        let who = -1, bd = C.HAT_R;
        for (let i = 0; i < 2; i++) { const dd = Math.abs(c.x - g.hats[i].x); if (dd < bd) { bd = dd; who = i; } }
        if (who >= 0) { catchCoin(W, M, g, who, c); g.coins.splice(n, 1); continue; }
      }
      if (c.y <= 0) { W.emit('mgCoinDrop', { x: c.x, k: c.k }); g.coins.splice(n, 1); }
    }
    // --- Pandrezz
    stepPan(W, M, g);
  },

  result(W, M, g) {
    const [a, b] = g.hats;
    if (a.n === b.n) {
      if (a.slaps === b.slaps) return payout(W, -1, -1, 0, { sa: a.n, sv: b.n });
      const w = a.slaps > b.slaps ? 0 : 1;
      return payout(W, w === 0 ? M.a : M.v, w === 0 ? M.v : M.a, 15, { sa: a.n, sv: b.n, kbb: 18, kbg: 180 });
    }
    return scorePayout(W, M, a.n, b.n, 15, 0.5, 70, { loot: g.pan.loot });
  },
};

function catchCoin(W, M, g, i, c) {
  const H = g.hats[i], P = g.pan;
  // Pandrezz assis dans le chapeau : c'est lui qui gobe la pièce
  if (P.tgt === i && P.ph === 'steal' && c.k !== 2) {
    P.stolen += C.VAL[c.k];
    W.emit('mgCoinSteal', { p: i, n: P.stolen, left: H.n, x: H.x, gulp: 1 });
    return;
  }
  const was = H.n;
  H.n = Math.max(0, H.n + C.VAL[c.k]);
  if (c.k === 2) { H.curses++; H.stun = Math.max(H.stun, C.CURSE_STUN); H.combo = 0; W.emit('mgCoinCurse', { p: i, x: H.x, lost: was - H.n, n: H.n }); return; }
  H.combo = M.t - H.ct < 50 ? H.combo + 1 : 1;
  H.ct = M.t; H.caught++; H.best = Math.max(H.best, H.combo);
  let bonus = 0;
  if (H.combo % 5 === 0) { bonus = 2; H.n += bonus; }
  if (c.k === 1) H.bags++;
  P.joy = Math.min(3, P.joy + (c.k === 1 ? 2 : 1));
  W.emit('mgCoinCatch', { p: i, k: c.k, x: H.x, n: H.n, combo: H.combo, bonus });
}

function stepPan(W, M, g) {
  const P = g.pan;
  P.t++;
  if (P.joy > 0) P.joy = Math.max(0, P.joy - 1 / 40);
  const H = P.tgt >= 0 ? g.hats[P.tgt] : null;
  if (P.ph === 'sky') {
    P.y += (C.PAN_Y - P.y) * 0.08;
    P.x += (g.gx + DMath.sin(M.t * 0.02) * g.hw * 0.4 - P.x) * 0.03;
    if (M.t >= P.next && M.t < 520) {
      const [a, b] = g.hats;
      P.tgt = a.n !== b.n && W.rng() < 0.6 ? (a.n > b.n ? 0 : 1) : (W.rng() < 0.5 ? 0 : 1);
      P.ph = 'warn'; P.t = 0; P.stolen = 0; P.raids++;
      // le CPU visé tire ici son temps de réaction (et, facile, s'il tape trop tôt)
      const T = g.hats[P.tgt], lvl = botLevel(W, M, P.tgt);
      const rd = [[18, 48], [14, 32], [12, 18]][lvl - 1];
      T.b.delay = W.rng.int(rd[0], rd[1]);
      T.b.early = W.rng() < [0.3, 0.12, 0.02][lvl - 1] ? W.rng.int(10, C.WARN - 4) : -1;
      T.b.sw = 0;
      W.emit('mgCoinWarn', { p: P.tgt, x: T.x });
    }
  } else if (P.ph === 'warn') {
    P.x += (H.x - P.x) * 0.08; P.y += (C.PAN_Y + 0.5 - P.y) * 0.1;
    if (P.t >= C.WARN) { P.ph = 'dive'; P.t = 0; W.emit('mgCoinDive', { p: P.tgt, x: H.x }); }
  } else if (P.ph === 'dive') {
    const u = P.t / C.DIVE;
    P.x += (H.x - P.x) * 0.3; P.y = C.PAN_Y + (C.RIM + 0.5 - C.PAN_Y) * u * u;
    if (P.t >= C.DIVE) { P.ph = 'steal'; P.t = 0; W.emit('mgCoinLand', { p: P.tgt, x: H.x }); }
  } else if (P.ph === 'steal') {
    P.x = H.x; P.y = C.RIM + 0.5;
    if (P.t % C.STEAL_EVERY === 0) {
      if (H.n > 0) { H.n--; H.lost++; P.stolen++; W.emit('mgCoinSteal', { p: P.tgt, n: P.stolen, left: H.n, x: H.x, gulp: 0 }); }
      else if (P.t > C.STEAL_EVERY * 2) P.t = C.STEAL_T; // chapeau vide : il s'en va bredouille
    }
    if (P.stolen >= C.STEAL_MAX || P.t >= C.STEAL_T) {
      P.loot += P.stolen; W.emit('mgCoinFlee', { p: P.tgt, n: P.stolen, x: H.x });
      P.ph = 'flee'; P.t = 0;
    }
  } else if (P.ph === 'flee' || P.ph === 'bonk') {
    const T = P.ph === 'flee' ? C.FLEE : C.BONK;
    P.y += (C.PAN_Y - P.y) * (P.ph === 'bonk' ? 0.06 : 0.12);
    if (P.t >= T) { P.ph = 'sky'; P.t = 0; P.tgt = -1; P.stolen = 0; P.next = M.t + W.rng.int(70, 140); }
  }
}

// CPU : vise la meilleure pièce qu'il peut atteindre (évite les maudites, plus ou moins bien) ; gifle Pandrezz après un
// temps de réaction tiré à son arrivée
function coinBot(W, M, g, i, lvl) {
  const H = g.hats[i], O = g.hats[1 - i], b = H.b, P = g.pan, I = { mx: 0, my: 0, held: 0, pressed: 0 };
  if (--b.nt <= 0) {
    b.nt = [22, 14, 8][lvl - 1] + W.rng.int(0, 8);
    let best = null, bs = -1e9;
    for (const c of g.coins) {
      if (c.k === 2 && W.rng() < [0.35, 0.8, 0.97][lvl - 1]) continue;
      // le temps avant d'arriver au bord du chapeau (chute libre)
      const G = (c.k === 1 ? C.G * 1.35 : C.G), h = c.y - C.RIM;
      if (h <= 0) continue;
      const t = (c.vy + Math.sqrt(c.vy * c.vy + 2 * G * h)) / G;
      const need = Math.abs(c.x - H.x) / (C.SPEED * 0.9), oneed = Math.abs(c.x - O.x) / (C.SPEED * 0.9);
      if (need > t + 0.05) continue;
      if (oneed < need * 0.7 && oneed < t && W.rng() < [0.2, 0.55, 0.85][lvl - 1]) continue; // l'autre y sera avant lui
      const v = c.k === 2 ? -3 : C.VAL[c.k];
      const s = v * 2 - t * (lvl >= 2 ? 1.2 : 0.3) - need * 0.6 + (lvl === 1 ? W.rng() * 2 : W.rng() * 0.4);
      if (s > bs) { bs = s; best = c; }
    }
    const err = [0.55, 0.3, 0.12][lvl - 1];
    b.tx = best ? best.x + (W.rng() - 0.5) * err : g.gx + (i === 0 ? -1 : 1) * g.hw * 0.3 + b.ox;
  }
  if (P.tgt === i && P.ph === 'warn' && b.early >= 0 && P.t === b.early) I.pressed |= BTN.A;
  if (P.tgt === i && (P.ph === 'dive' || P.ph === 'steal')) { if (++b.sw === b.delay) I.pressed |= BTN.A; }
  const gain = [1.3, 2.2, 3.2][lvl - 1] * b.bk;
  I.mx = clampN((b.tx - H.x) * gain, -1, 1);
  if (Math.abs(b.tx - H.x) < 0.08) I.mx = 0;
  return I;
}
