// L'enfer des balles (bullet) : un « danmaku » à la Touhou, simple et équitable. L'arène (FW x FH, y vers le bas) est
// coupée en deux : chacun la sienne (J1 à gauche, J2 à droite), chacune sa Citrouille Suprême, et la même pluie de balles
// des deux côtés (celle de droite est le reflet exact de celle de gauche ; les tirs visés visent chacun son joueur).
// Quatre cartes de sort de 2,5 s chacune, de plus en plus denses : fleur, spirales, pluie de citrouilles qui éclatent,
// floraison finale. On ne fait qu'esquiver, au stick : touché = un point de moins, clignotement, courte invincibilité.
// Le moins touché gagne : le perdant prend 15 % + 12 % par touche d'écart (70 % au plus).
import { DMath, clampN, scorePayout, botLevel } from './common.js';

export const BULLET = {
  FW: 600, HW: 300, FH: 316, MAX: 300, ST: 12, SPD: 3, HIT: 2.4, INV: 90, PHASE: 150,
  KR: [3.2, 2.6, 6.5, 4, 8], // rayon de chaque sorte de balle : petite, grain de riz, orbe, étoile, citrouille qui éclate
};
const B = BULLET, ST = B.ST, TAU = Math.PI * 2;
// une balle : [x, y, vx, vy, sorte, couleur, son côté (0 : J1 à gauche, 1 : J2 à droite), cos et sin de sa rotation par
// image, facteur de vitesse par image, minuteur, ce qui arrive au bout du minuteur (1 : vise son joueur, 2 : éclate)]
// put : une balle d'un côté k, donnée comme si elle était à gauche (x, angle a, rotation sw) : à droite, son reflet
// (o : la balle part à cette distance du point de départ, au bord de la citrouille)
function put(g, k, x, y, a, s, kd, c, cw = 1, sw = 0, ac = 1, tm = 0, f = 0, o = 0) {
  if (g.b.length >= B.MAX * 2 * ST) return;
  const ca = DMath.cos(a), sa = DMath.sin(a), m = k ? -1 : 1;
  g.b.push(k ? B.FW - (x + ca * o) : x + ca * o, y + sa * o, ca * s * m, sa * s, kd, c, k, cw, sw * m, ac, tm, f);
}
// fire : la même balle des deux côtés (à droite, le reflet exact : l'équité)
function fire(g, x, y, a, s, kd, c, cw, sw, ac, tm, f, o) { put(g, 0, x, y, a, s, kd, c, cw, sw, ac, tm, f, o); put(g, 1, x, y, a, s, kd, c, cw, sw, ac, tm, f, o); }
const OB = 22; // le rayon d'où partent les balles du boss
function ring(g, x, y, n, a0, s, k, c, cw = 1, sw = 0, o = OB) { for (let j = 0; j < n; j++) fire(g, x, y, a0 + j * TAU / n, s, k, c, cw, sw, 1, 0, 0, o); }
// un éventail visé : chaque citrouille vise son joueur (l'angle vers lui, ramené à gauche pour put)
function fanAim(g, x, y, n, spread, s, k, c) {
  for (let i = 0; i < 2; i++) {
    const P = g.p[i], px = i ? B.FW - P.x : P.x, a = DMath.atan2(P.y - y, px - x);
    for (let j = 0; j < n; j++) put(g, i, x, y, a + (j - (n - 1) / 2) * spread, s, k, c, 1, 0, 1, 0, 0, OB);
  }
}

// les motifs du boss, carte par carte
function pattern(W, g, t) {
  const bx = g.bx, by = g.by + 6, ph = g.ph, u = t - ph * B.PHASE; // u : l'image dans la carte
  if (ph === 0) { // « Fleur du caveau » : des anneaux qui tournent, des éventails visés
    if (u % 18 === 0) { g.rot += 0.21; ring(g, bx, by, 10 + Math.floor(u / 50), g.rot, 1.7, 0, (u / 18) % 2); W.emit('mgBulletWave', { k: 0 }); }
    if (u % 36 === 18) { fanAim(g, bx, by, 3, 0.22, 2.6, 1, 2); W.emit('mgBulletWave', { k: 1 }); }
  } else if (ph === 1) { // « Spirale de Nymano » : trois bras, un contre-courant, des orbes
    if (u % 5 === 0) { for (let a = 0; a < 3; a++) fire(g, bx, by, g.sp + a * TAU / 3, 1.9, 1, 3, 1, 0, 1, 0, 0, OB); g.sp += 0.21 + 0.0008 * u; }
    if (u % 50 === 25) { ring(g, bx, by, 6, g.sp * 0.5, 1.2, 2, 5); W.emit('mgBulletWave', { k: 2 }); }
  } else if (ph === 2) { // « Pluie de citrouilles » : elles ralentissent puis éclatent, et des éventails visés
    if (u % 45 === 0) {
      for (let j = 0; j < 2; j++) fire(g, bx, by, Math.PI / 2 + (W.rng() - 0.5) * 1.8, 3.4 + W.rng() * 0.8, 4, 6, 1, 0, 0.982, 55 + (W.rng() * 16 | 0), 2, OB);
      W.emit('mgBulletWave', { k: 3 });
    }
    if (u % 30 === 15) { fanAim(g, bx, by, 5, 0.16, 2.8, 1, 2); W.emit('mgBulletWave', { k: 1 }); }
  } else { // « Floraison infernale » : des pétales qui tournent dans les deux sens, des anneaux, des orbes qui visent
    if (u % 8 === 0) {
      for (let a = 0; a < 3; a++) {
        const an = g.sp + a * TAU / 3;
        fire(g, bx, by, an, 2.1, 3, 7, g.cw[0], g.cw[1], 1, 0, 0, OB);
        fire(g, bx, by, -an, 2.1, 3, 8, g.cw[0], -g.cw[1], 1, 0, 0, OB);
      }
      g.sp += 0.13;
    }
    if (u % 45 === 20) { ring(g, bx, by, 14, g.rot, 1.5, 0, 0); g.rot += 0.3; W.emit('mgBulletWave', { k: 0 }); }
    if (u % 60 === 40) { const n0 = g.b.length; ring(g, bx, by, 4, g.sp, 3.2, 2, 5); for (let j = n0; j < g.b.length; j += ST) { g.b[j + 9] = 0.94; g.b[j + 10] = 45; g.b[j + 11] = 1; } W.emit('mgBulletWave', { k: 2 }); }
  }
}

// les balles avancent ; celles qui sortent disparaissent (le tableau est compacté sur place, dans l'ordre)
function moveBullets(W, g) {
  const b = g.b;
  let w = 0;
  const born = [];
  for (let r = 0; r < b.length; r += ST) {
    let x = b[r], y = b[r + 1], vx = b[r + 2], vy = b[r + 3];
    const ac = b[r + 9];
    if (ac !== 1) { vx *= ac; vy *= ac; }
    if (b[r + 7] !== 1) { const c = b[r + 7], s = b[r + 8], nx = vx * c - vy * s; vy = vx * s + vy * c; vx = nx; }
    x += vx; y += vy;
    const sd = b[r + 6];
    let keep = (sd ? x > B.HW - 6 && x < B.FW + 24 : x > -24 && x < B.HW + 6) && y > -24 && y < B.FH + 24;
    if (keep && b[r + 10] > 0 && --b[r + 10] === 0) {
      if (b[r + 11] === 2) { keep = false; if (!sd) born.push(x, y); } // (l'éclat de gauche fait les deux : reflet exact)
      else if (b[r + 11] === 1) { const P = g.p[sd], a = DMath.atan2(P.y - y, P.x - x); vx = DMath.cos(a) * 2.6; vy = DMath.sin(a) * 2.6; b[r + 9] = 1.006; }
    }
    if (!keep) continue;
    if (w !== r) for (let k = 0; k < ST; k++) b[w + k] = b[r + k];
    b[w] = x; b[w + 1] = y; b[w + 2] = vx; b[w + 3] = vy;
    w += ST;
  }
  b.length = w;
  for (let j = 0; j < born.length; j += 2) {
    ring(g, born[j], born[j + 1], 10, g.rot + j, 1.6, 0, 6, 1, 0, 4);
    W.emit('mgBulletBurst', { x: Math.round(born[j]), y: Math.round(born[j + 1]) });
    W.emit('mgBulletBurst', { x: Math.round(B.FW - born[j]), y: Math.round(born[j + 1]) });
  }
}

// efface les balles dans un rayon (touché) : rend leur nombre
function clearAround(g, x, y, r) {
  const b = g.b;
  let w = 0, n = 0;
  for (let q = 0; q < b.length; q += ST) {
    const dx = b[q] - x, dy = b[q + 1] - y;
    if (dx * dx + dy * dy < r * r) { n++; continue; }
    if (w !== q) for (let k = 0; k < ST; k++) b[w + k] = b[q + k];
    w += ST;
  }
  b.length = w;
  return n;
}

export default {
  name: 'L\'enfer des balles',

  init(W) {
    const mk = (x) => ({ x, y: 272, inv: 0, hits: 0, mx: 0, b: { k: 0, t: 0, mx: 0, my: 0, ox: 0, home: 0, ag: 1 } });
    const w = 0.011;
    return { t: 0, ph: -1, bx: B.HW / 2, by: 64, rot: 0, sp: 0, cw: [DMath.cos(w), DMath.sin(w)], b: [], p: [mk(B.HW / 2), mk(B.FW - B.HW / 2)], over: 0, sway: W.rng() < 0.5 ? -1 : 1 };
  },

  step(W, M, g, ia, iv) {
    const t = g.t = M.t;
    // les citrouilles (bx : celle de gauche ; celle de droite est son reflet) : elles se balancent, changent de carte
    // toutes les 2,5 s
    const ph = Math.min(3, Math.floor((t - 1) / B.PHASE));
    if (ph !== g.ph) { g.ph = ph; g.sp = 0; W.emit('mgBulletSpell', { n: ph }); }
    g.bx = B.HW / 2 + 70 * g.sway * DMath.sin(t * 0.012) * (ph === 1 ? 0.35 : 1);
    g.by = 64 + 10 * DMath.sin(t * 0.031);
    if (t > 20) pattern(W, g, t);
    moveBullets(W, g);
    // les joueurs : chacun dans sa moitié
    const ins = [ia, iv];
    for (let i = 0; i < 2; i++) {
      const P = g.p[i];
      const I = ins[i] || bulletBot(W, g, i, botLevel(W, M, i));
      let mx = clampN(I.mx || 0, -1, 1), my = clampN(I.my || 0, -1, 1);
      const m = Math.sqrt(mx * mx + my * my);
      if (m < 0.15) { mx = 0; my = 0; } else if (m > 1) { mx /= m; my /= m; }
      const x0 = i ? B.HW + 8 : 8, x1 = i ? B.FW - 8 : B.HW - 8;
      P.x = clampN(P.x + mx * B.SPD, x0, x1); P.y = clampN(P.y - my * B.SPD, 20, B.FH - 8);
      P.mx = mx;
      if (P.inv > 0) P.inv--;
    }
    // les balles contre les joueurs (chacun les siennes)
    for (let i = 0; i < 2; i++) {
      const P = g.p[i], b = g.b;
      if (P.inv > 0) continue;
      for (let q = 0; q < b.length; q += ST) {
        if (b[q + 6] !== i) continue;
        const dx = b[q] - P.x, dy = b[q + 1] - P.y, r = B.KR[b[q + 4]] + B.HIT;
        if (dx * dx + dy * dy < r * r) {
          P.hits++; P.inv = B.INV;
          clearAround(g, P.x, P.y, 50);
          W.emit('mgBulletHit', { p: i, x: Math.round(P.x), y: Math.round(P.y), n: P.hits });
          break;
        }
      }
    }
  },

  // le moins touché gagne (12 % de plus par touche d'écart)
  result(W, M, g) {
    const [a, b] = g.p;
    return scorePayout(W, M, -a.hits * 100, -b.hits * 100, 15, 8, 70, { ha: a.hits, hv: b.hits });
  },
};

// --- CPU pilote ---------------------------------------------------------------------------------------------------
// Il essaie 9 mouvements (8 directions et rester), prédit où seront ses balles proches dans quelques images (en ligne
// droite) et prend le moins dangereux, en restant plutôt sous sa citrouille, à sa hauteur préférée.
// Faible : il réfléchit moins souvent, voit moins loin, oublie une balle sur trois ; fort : souvent, loin, prudent.
const DIRS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [0.707, 0.707], [-0.707, 0.707], [0.707, -0.707], [-0.707, -0.707]];
function bulletBot(W, g, i, lvl) {
  const P = g.p[i], b = P.b, I = { mx: 0, my: 0, held: 0, pressed: 0 };
  if (!b.k) { b.k = 1; b.ox = (W.rng() - 0.5) * 60; b.home = 240 + W.rng() * 50; b.ag = 0.5 + W.rng() * 0.9; }
  if (--b.t <= 0) {
    b.t = [7, 3, 1][lvl - 1];
    const H = [[9], [5, 13], [3, 8, 16]][lvl - 1], see = [80, 100, 120][lvl - 1], mg = [2, 4, 6][lvl - 1];
    const near = [], bb = g.b;
    for (let q = 0; q < bb.length; q += ST) {
      if (bb[q + 6] !== i || (lvl === 1 && (q / ST) % 3 === 0)) continue;
      const dx = bb[q] - P.x, dy = bb[q + 1] - P.y;
      if (dx * dx + dy * dy < see * see) near.push(q);
    }
    const x0 = i ? B.HW + 8 : 8, x1 = i ? B.FW - 8 : B.HW - 8, bx = i ? B.FW - g.bx : g.bx;
    const tx = clampN(bx + b.ox, x0 + 12, x1 - 12), ty = b.home, sp = B.SPD;
    let best = 1e18, bi = 0;
    {
      for (let d = 0; d < DIRS.length; d++) {
        let cost = 0;
        for (const h of H) {
          const px = clampN(P.x + DIRS[d][0] * sp * h, x0, x1), py = clampN(P.y + DIRS[d][1] * sp * h, 20, B.FH - 8);
          for (const q of near) {
            const ex = bb[q] + bb[q + 2] * h - px, ey = bb[q + 1] + bb[q + 3] * h - py, d2 = ex * ex + ey * ey, r = B.KR[bb[q + 4]] + B.HIT + mg;
            if (d2 < r * r) cost += 1e6 / h;
            else if (d2 < (r + 16) * (r + 16)) cost += ((r + 16) * (r + 16) - d2) * 3 / h;
          }
        }
        const h = H[H.length - 1], px = clampN(P.x + DIRS[d][0] * sp * h, x0, x1), py = clampN(P.y + DIRS[d][1] * sp * h, 20, B.FH - 8);
        cost += ((px - tx) * (px - tx) * [0.4, 0.7, 1][lvl - 1] * b.ag + (py - ty) * (py - ty) * 0.4);
        if (cost < best) { best = cost; bi = d; }
      }
    }
    b.mx = DIRS[bi][0]; b.my = -DIRS[bi][1];
  }
  I.mx = b.mx; I.my = b.my;
  return I;
}
