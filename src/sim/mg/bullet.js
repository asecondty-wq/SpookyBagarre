// L'enfer des balles (bullet) : un « danmaku » à la Touhou, à deux dans la même arène (FW x FH, y vers le bas). La
// Citrouille Suprême, en haut, crache quatre cartes de sort de 2,5 s chacune, de plus en plus denses : fleur, spirales,
// pluie de citrouilles qui éclatent, floraison finale (balles qui tournent, orbes qui s'arrêtent puis visent).
// Chacun pilote sa tête volante au stick (tenir X, bouclier ou saisie : mode lent et précis, la hitbox se voit), tire tout
// seul (le mode lent tire droit et fort), A ou saut : la bombe (une seule, efface les balles autour). Points : chaque
// tir qui touche le boss, chaque balle frôlée (graze, une fois par balle) ; touché : des points en moins, clignotement,
// courte invincibilité. Le boss vaincu avant la fin : bonus au dernier tireur et fin anticipée.
// Le meilleur score gagne : le perdant prend 15 % + l'écart / 25 (70 % au plus).
import { BTN, DMath, clampN, scorePayout, botLevel } from './common.js';

export const BULLET = {
  FW: 600, FH: 316, MAX: 340, ST: 12, SPD: 3.3, FOC: 1.45, HIT: 2.4, GRAZE: 15, INV: 100, BOSS_R: 30, HP: 460, FIRE: 5,
  HITPTS: 300, GZPTS: 8, SHOTPTS: 10, BOMB_R: 150, PHASE: 150,
  KR: [3.2, 2.6, 6.5, 4, 8], // rayon de chaque sorte de balle : petite, grain de riz, orbe, étoile, citrouille qui éclate
};
const B = BULLET, ST = B.ST, TAU = Math.PI * 2;
// (pas le saut pour la bombe : à la manette, voler vers le haut d'un coup de stick compte comme un saut)
const FOCUS = BTN.X | BTN.SHIELD | BTN.GRAB, BOMB = BTN.A;
// une balle : [x, y, vx, vy, sorte, couleur, frôlée (bits des joueurs), cos et sin de sa rotation par image, facteur de
// vitesse par image, minuteur, ce qui arrive au bout du minuteur (1 : vise un joueur, 2 : éclate)]
// (o : la balle part à cette distance du point de départ, au bord de la citrouille)
function fire(g, x, y, a, s, k, c, cw = 1, sw = 0, ac = 1, tm = 0, f = 0, o = 0) {
  if (g.b.length >= B.MAX * ST) return;
  const ca = DMath.cos(a), sa = DMath.sin(a);
  g.b.push(x + ca * o, y + sa * o, ca * s, sa * s, k, c, 0, cw, sw, ac, tm, f);
}
const OB = 22; // le rayon d'où partent les balles du boss
function ring(g, x, y, n, a0, s, k, c, cw = 1, sw = 0, o = OB) { for (let j = 0; j < n; j++) fire(g, x, y, a0 + j * TAU / n, s, k, c, cw, sw, 1, 0, 0, o); }
function aimAt(g, x, y, i) { const P = g.p[i]; return DMath.atan2(P.y - y, P.x - x); }
function fan(g, x, y, n, a, spread, s, k, c) { for (let j = 0; j < n; j++) fire(g, x, y, a + (j - (n - 1) / 2) * spread, s, k, c, 1, 0, 1, 0, 0, OB); }
const nearest = (g, x, y) => { const a = g.p[0], b = g.p[1]; return (a.x - x) * (a.x - x) + (a.y - y) * (a.y - y) <= (b.x - x) * (b.x - x) + (b.y - y) * (b.y - y) ? 0 : 1; };

// les motifs du boss, carte par carte
function pattern(W, g, t) {
  const bx = g.bx, by = g.by + 6, ph = g.ph, u = t - ph * B.PHASE; // u : l'image dans la carte
  if (ph === 0) { // « Fleur du caveau » : des anneaux qui tournent, des éventails visés
    if (u % 16 === 0) { g.rot += 0.21; ring(g, bx, by, 16 + 2 * Math.floor(u / 50), g.rot, 1.8, 0, (u / 16) % 2); W.emit('mgBulletWave', { k: 0 }); }
    if (u % 36 === 18) { const i = ((u / 36 | 0) + g.aim) % 2; fan(g, bx, by, 5, aimAt(g, bx, by, i), 0.2, 2.8, 1, 2); W.emit('mgBulletWave', { k: 1 }); }
  } else if (ph === 1) { // « Spirale de Nymano » : trois bras, un contre-courant, des orbes
    if (u % 4 === 0) { for (let a = 0; a < 3; a++) fire(g, bx, by, g.sp + a * TAU / 3, 2.1, 1, 3, 1, 0, 1, 0, 0, OB); g.sp += 0.19 + 0.0008 * u; }
    if (u % 9 === 0) { for (let a = 0; a < 2; a++) fire(g, bx, by, -g.sp * 1.3 + a * Math.PI, 1.6, 0, 4, 1, 0, 1, 0, 0, OB); }
    if (u % 50 === 25) { ring(g, bx, by, 8, g.sp * 0.5, 1.2, 2, 5); W.emit('mgBulletWave', { k: 2 }); }
  } else if (ph === 2) { // « Pluie de citrouilles » : elles ralentissent puis éclatent, et des éventails visés
    if (u % 40 === 0) {
      for (let j = 0; j < 3; j++) fire(g, bx, by, Math.PI / 2 + (W.rng() - 0.5) * 2.2, 3.6 + W.rng() * 0.8, 4, 6, 1, 0, 0.982, 55 + (W.rng() * 16 | 0), 2, OB);
      W.emit('mgBulletWave', { k: 3 });
    }
    if (u % 24 === 12) { const i = ((u / 24 | 0) + g.aim) % 2; fan(g, bx, by, 7, aimAt(g, bx, by, i), 0.14, 3, 1, 2); W.emit('mgBulletWave', { k: 1 }); }
  } else { // « Floraison infernale » : des pétales qui tournent dans les deux sens, des anneaux, des orbes qui visent
    if (u % 7 === 0) {
      for (let a = 0; a < 4; a++) {
        const an = g.sp + a * TAU / 4;
        fire(g, bx, by, an, 2.1, 3, 7, g.cw[0], g.cw[1], 1, 0, 0, OB);
        fire(g, bx, by, -an, 2.1, 3, 8, g.cw[0], -g.cw[1], 1, 0, 0, OB);
      }
      g.sp += 0.13;
    }
    if (u % 45 === 20) { ring(g, bx, by, 22, g.rot, 1.5, 0, 0); g.rot += 0.3; W.emit('mgBulletWave', { k: 0 }); }
    if (u % 60 === 40) { const n0 = g.b.length; ring(g, bx, by, 6, g.sp, 3.2, 2, 5); for (let j = n0; j < g.b.length; j += ST) { g.b[j + 9] = 0.94; g.b[j + 10] = 45; g.b[j + 11] = 1; } W.emit('mgBulletWave', { k: 2 }); }
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
    let keep = x > -24 && x < B.FW + 24 && y > -24 && y < B.FH + 24;
    if (keep && b[r + 10] > 0 && --b[r + 10] === 0) {
      if (b[r + 11] === 2) { keep = false; born.push(x, y); }
      else if (b[r + 11] === 1) { const i = nearest(g, x, y), a = DMath.atan2(g.p[i].y - y, g.p[i].x - x); vx = DMath.cos(a) * 2.7; vy = DMath.sin(a) * 2.7; b[r + 9] = 1.006; }
    }
    if (!keep) continue;
    if (w !== r) for (let k = 0; k < ST; k++) b[w + k] = b[r + k];
    b[w] = x; b[w + 1] = y; b[w + 2] = vx; b[w + 3] = vy;
    w += ST;
  }
  b.length = w;
  for (let j = 0; j < born.length; j += 2) {
    ring(g, born[j], born[j + 1], 14, g.rot + j, 1.7, 0, 6, 1, 0, 4);
    W.emit('mgBulletBurst', { x: Math.round(born[j]), y: Math.round(born[j + 1]) });
  }
}

// efface les balles dans un rayon (touché, bombe) : rend leur nombre
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
    const mk = (x) => ({
      x, y: 272, sc: 0, inv: 0, hits: 0, gz: 0, dmg: 0, bomb: 1, foc: 0, cd: 0, hn: 0, gn: 0, mx: 0, bt: 0,
      b: { k: 0, t: 0, mx: 0, my: 0, fo: 0, ox: 0, home: 0, ag: 1 },
    });
    const w = 0.011;
    return {
      t: 0, ph: -1, bx: B.FW / 2, by: 64, hp: B.HP, rot: 0, sp: 0, cw: [DMath.cos(w), DMath.sin(w)], b: [], s: [], p: [mk(200), mk(400)],
      down: 0, endT: 0, last: -1, over: 0, aim: W.rng() < 0.5 ? 0 : 1, sway: W.rng() < 0.5 ? -1 : 1,
    };
  },

  step(W, M, g, ia, iv) {
    const t = g.t = M.t;
    // le boss : il se balance, change de carte toutes les 2,5 s
    const ph = Math.min(3, Math.floor((t - 1) / B.PHASE));
    if (ph !== g.ph && !g.down) { g.ph = ph; g.sp = 0; W.emit('mgBulletSpell', { n: ph }); }
    g.bx = B.FW / 2 + 160 * g.sway * DMath.sin(t * 0.012) * (ph === 1 ? 0.35 : 1);
    g.by = 64 + 10 * DMath.sin(t * 0.031);
    if (!g.down && t > 20) pattern(W, g, t);
    moveBullets(W, g);
    // les joueurs
    const ins = [ia, iv];
    for (let i = 0; i < 2; i++) {
      const P = g.p[i];
      const I = ins[i] || bulletBot(W, g, i, botLevel(W, M, i));
      let mx = clampN(I.mx || 0, -1, 1), my = clampN(I.my || 0, -1, 1);
      const m = Math.sqrt(mx * mx + my * my);
      if (m < 0.15) { mx = 0; my = 0; } else if (m > 1) { mx /= m; my /= m; }
      P.foc = (I.held & FOCUS) ? 1 : 0;
      const sp = P.foc ? B.FOC : B.SPD;
      P.x = clampN(P.x + mx * sp, 8, B.FW - 8); P.y = clampN(P.y - my * sp, 20, B.FH - 8);
      P.mx = mx;
      if (P.inv > 0) P.inv--;
      // tir automatique (pas juste après une touche)
      if (--P.cd <= 0 && P.inv < B.INV - 30 && !g.down) {
        P.cd = B.FIRE;
        if (P.foc) { g.s.push(P.x - 5, P.y - 8, 0, -12, i, 2, P.x + 5, P.y - 8, 0, -12, i, 2); }
        else for (const a of SPREAD) g.s.push(P.x, P.y - 8, a[0], a[1], i, 1);
      }
      // la bombe
      if ((I.pressed & BOMB) && P.bomb > 0 && !g.down) {
        P.bomb--;
        const n = clearAround(g, P.x, P.y, B.BOMB_R);
        P.sc += n * 5 + 150; P.dmg += 30; g.hp -= 30; P.inv = Math.max(P.inv, 50); g.last = i;
        W.emit('mgBulletBomb', { p: i, x: Math.round(P.x), y: Math.round(P.y), n });
      }
    }
    // les tirs des joueurs
    const s = g.s;
    let w = 0;
    for (let r = 0; r < s.length; r += 6) {
      const x = s[r] + s[r + 2], y = s[r + 1] + s[r + 3];
      const dx = x - g.bx, dy = y - g.by;
      if (!g.down && dx * dx + dy * dy < (B.BOSS_R + 3) * (B.BOSS_R + 3)) {
        const P = g.p[s[r + 4]], d = s[r + 5];
        P.sc += B.SHOTPTS * d; P.dmg += d; P.hn += d; g.hp -= d; g.last = s[r + 4];
        continue;
      }
      if (y < -12 || x < -12 || x > B.FW + 12) continue;
      s[w] = x; s[w + 1] = y; s[w + 2] = s[r + 2]; s[w + 3] = s[r + 3]; s[w + 4] = s[r + 4]; s[w + 5] = s[r + 5];
      w += 6;
    }
    s.length = w;
    // les balles du boss contre les joueurs : touché, ou frôlé
    for (let i = 0; i < 2; i++) {
      const P = g.p[i], bit = 1 << i, b = g.b;
      for (let q = 0; q < b.length; q += ST) {
        const dx = b[q] - P.x, dy = b[q + 1] - P.y, d2 = dx * dx + dy * dy, r = B.KR[b[q + 4]];
        if (d2 > (r + B.GRAZE) * (r + B.GRAZE)) continue;
        if (P.inv > 0) continue;
        if (d2 < (r + B.HIT) * (r + B.HIT)) {
          P.sc = Math.max(0, P.sc - B.HITPTS); P.hits++; P.inv = B.INV;
          const n = clearAround(g, P.x, P.y, 60);
          W.emit('mgBulletHit', { p: i, x: Math.round(P.x), y: Math.round(P.y), n: P.hits });
          break;
        }
        if (!(b[q + 6] & bit)) { b[q + 6] |= bit; P.sc += B.GZPTS; P.gz++; P.gn++; }
      }
      if (t % 5 === i && P.gn > 0) { W.emit('mgBulletGraze', { p: i, n: P.gn, tot: P.gz, x: Math.round(P.x), y: Math.round(P.y) }); P.gn = 0; }
      if (t % 6 === i * 3 && P.hn > 0) { W.emit('mgBulletBoss', { p: i, n: P.hn }); P.hn = 0; }
    }
    // le boss vaincu : le dernier tireur prend un bonus, les balles deviennent des points, c'est fini
    if (!g.down && g.hp <= 0) {
      g.down = 1; g.hp = 0; g.endT = 75;
      const n = g.b.length / ST;
      g.b.length = 0; g.s.length = 0;
      if (g.last >= 0) g.p[g.last].sc += 150;
      g.p[0].sc += n * 2; g.p[1].sc += n * 2;
      W.emit('mgBulletDown', { p: g.last, n });
    }
    if (g.endT > 0 && --g.endT === 0) g.over = 1;
  },

  result(W, M, g) {
    const [a, b] = g.p;
    return scorePayout(W, M, a.sc, b.sc, 15, 25, 70, { ha: a.hits, hv: b.hits, ga: a.gz, gv: b.gz });
  },
};

const SPREAD = [-0.1, 0, 0.1].map((a) => [DMath.sin(a) * 10, -DMath.cos(a) * 10]);

// --- CPU pilote ---------------------------------------------------------------------------------------------------
// Il essaie 17 mouvements (8 directions et rester, vite ou lent), prédit où seront les balles proches dans quelques images
// (en ligne droite) et prend le moins dangereux, en restant plutôt sous le boss (pour le toucher) à sa hauteur préférée.
// Faible : il réfléchit moins souvent, voit moins loin, oublie une balle sur trois ; fort : souvent, loin, prudent.
const DIRS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [0.707, 0.707], [-0.707, 0.707], [0.707, -0.707], [-0.707, -0.707]];
function bulletBot(W, g, i, lvl) {
  const P = g.p[i], b = P.b, I = { mx: 0, my: 0, held: 0, pressed: 0 };
  if (!b.k) { b.k = 1; b.ox = (W.rng() - 0.5) * 100; b.home = 240 + W.rng() * 50; b.ag = 0.5 + W.rng() * 0.9; }
  if (--b.t <= 0) {
    b.t = [7, 3, 1][lvl - 1];
    const H = [[9], [5, 13], [3, 8, 16]][lvl - 1], see = [80, 100, 120][lvl - 1], mg = [2, 4, 6][lvl - 1];
    const near = [], bb = g.b;
    for (let q = 0; q < bb.length; q += ST) {
      if (lvl === 1 && (q / ST) % 3 === 0) continue;
      const dx = bb[q] - P.x, dy = bb[q + 1] - P.y;
      if (dx * dx + dy * dy < see * see) near.push(q);
    }
    const tx = clampN(g.bx + b.ox, 20, B.FW - 20), ty = b.home;
    let best = 1e18, bi = 0, bf = 0;
    for (let f = 0; f < 2; f++) {
      const sp = f ? B.FOC : B.SPD;
      for (let d = 0; d < DIRS.length; d++) {
        if (f && !d) continue;
        let cost = 0;
        for (const h of H) {
          const px = clampN(P.x + DIRS[d][0] * sp * h, 8, B.FW - 8), py = clampN(P.y + DIRS[d][1] * sp * h, 20, B.FH - 8);
          for (const q of near) {
            const ex = bb[q] + bb[q + 2] * h - px, ey = bb[q + 1] + bb[q + 3] * h - py, d2 = ex * ex + ey * ey, r = B.KR[bb[q + 4]] + B.HIT + mg;
            if (d2 < r * r) cost += 1e6 / h;
            else if (d2 < (r + 16) * (r + 16)) cost += ((r + 16) * (r + 16) - d2) * 3 / h;
          }
        }
        const h = H[H.length - 1], px = clampN(P.x + DIRS[d][0] * sp * h, 8, B.FW - 8), py = clampN(P.y + DIRS[d][1] * sp * h, 20, B.FH - 8);
        cost += ((px - tx) * (px - tx) * [0.4, 0.7, 1][lvl - 1] * b.ag + (py - ty) * (py - ty) * 0.4) + (f ? 40 : 0);
        if (cost < best) { best = cost; bi = d; bf = f; }
      }
    }
    b.mx = DIRS[bi][0]; b.my = -DIRS[bi][1]; b.fo = bf;
    if (P.bomb > 0 && best > 9e5 && P.inv === 0 && W.rng() < [0.15, 0.5, 0.85][lvl - 1]) I.pressed |= BTN.A;
  }
  I.mx = b.mx; I.my = b.my;
  if (b.fo) I.held |= BTN.SHIELD;
  return I;
}
