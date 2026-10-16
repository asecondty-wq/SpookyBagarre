// Lave-vitre lofi (window) : chacun sa vitre sale (la même saleté pour les deux, tirée au début), une éponge à promener
// (stick, flèches ou souris) : elle nettoie là où elle frotte (il faut bouger : immobile, elle ne fait rien). A : un coup
// de pschitt (le produit) qui nettoie plus large et plus fort un moment, puis il faut attendre. Derrière la vitre, Nymano
// pleure en écoutant du lofi : plus la vitre est propre, mieux on le voit. La saleté : une grille GX x GY, chaque case
// de 0 à 300 (300 : une fiente bien collée). Le plus propre gagne ; le perdant prend 15 % + l'écart (en %) / 2.
import { BTN, MOUSE, MV_L, MV_R, MV_D, MV_U, DIGITAL, DMath, clampN, scorePayout, botLevel } from './common.js';

export const WIN = {
  GX: 16, GY: 10, CELL: 10, W: 160, H: 100, R: 15, RATE: 11, SPEED: 2.7, MOVE: 1.3, SPRAY: 42, SPRAY_CD: 110, SPRAY_R: 1.6, SPRAY_K: 1.6,
};
const C = WIN;

// la part (0..100) de saleté enlevée
export function cleanPct(g, P) {
  let d = 0;
  for (const v of P.d) d += v;
  return g.d0 > 0 ? Math.floor((g.d0 - d) / g.d0 * 1000) / 10 : 100;
}

function dirt(W) {
  const d = new Array(C.GX * C.GY).fill(0);
  // des traînées et des taches (en gros paquets), quelques fientes, un coin moins sale
  const blobs = W.rng.int(7, 10);
  for (let b = 0; b < blobs; b++) {
    const cx = W.rng() * C.GX, cy = W.rng() * C.GY, r = 1.5 + W.rng() * 3, v = 90 + W.rng() * 110;
    for (let y = 0; y < C.GY; y++) for (let x = 0; x < C.GX; x++) {
      const dd = Math.sqrt((x + 0.5 - cx) * (x + 0.5 - cx) + (y + 0.5 - cy) * (y + 0.5 - cy));
      if (dd < r) d[y * C.GX + x] += v * (1 - dd / r * 0.6);
    }
  }
  for (let k = 0; k < C.GX * C.GY; k++) d[k] += 40 + W.rng() * 50; // la poussière partout
  const poops = W.rng.int(4, 6), pp = [];
  for (let k = 0; k < poops; k++) { const x = W.rng.int(1, C.GX - 2), y = W.rng.int(0, C.GY - 3); d[y * C.GX + x] = 300; pp.push([x, y]); }
  for (let k = 0; k < d.length; k++) d[k] = Math.round(clampN(d[k], 0, 300));
  return { d, pp };
}

export default {
  name: 'Lave-vitre lofi',

  init(W) {
    const { d, pp } = dirt(W);
    let d0 = 0; for (const v of d) d0 += v;
    const mk = (x) => ({ x, y: C.H * 0.75, vx: 0, vy: 0, kh: 0, d: d.slice(), spray: 0, cd: 0, sprays: 0, mv: 0, pc: 0, mile: 0, done: 0, rub: 0,
      b: { tx: x, ty: 50, nt: 0, ph: 0, sk: 1, amp: 0 } });
    return { d0, pp, p: [mk(C.W * 0.3), mk(C.W * 0.3)], lead: -1, inited: 0, over: 0 };
  },

  step(W, M, g, ia, iv) {
    const ins = [ia, iv];
    if (!g.inited) {
      g.inited = 1;
      for (let i = 0; i < 2; i++) { const b = g.p[i].b; b.sk = 0.8 + W.rng() * 0.35; b.amp = 6 + W.rng() * 8; b.ph = W.rng() * 6; }
    }
    for (let i = 0; i < 2; i++) {
      const P = g.p[i];
      if (P.cd > 0) P.cd--;
      if (P.spray > 0) P.spray--;
      if (P.done) continue;
      const I = ins[i] || windowBot(W, M, g, i, botLevel(W, M, i));
      const x0 = P.x, y0 = P.y;
      if (I.held & MOUSE) {
        P.x += I.mx * 4; P.y -= I.my * 4;
        P.x += (((I.held & MV_R) ? 1 : 0) - ((I.held & MV_L) ? 1 : 0)) * 2;
        P.y += (((I.held & MV_D) ? 1 : 0) - ((I.held & MV_U) ? 1 : 0)) * 2;
        P.vx = P.vy = 0;
      } else {
        // au clavier : l'éponge part doucement puis accélère (pour bien viser un coin)
        let k = 1;
        if (I.held & DIGITAL) { P.kh = I.mx || I.my ? P.kh + 1 : 0; k = Math.min(1, 0.35 + P.kh / 18); }
        P.vx += (clampN(I.mx, -1, 1) * C.SPEED * k - P.vx) * 0.35; P.vy += (-clampN(I.my, -1, 1) * C.SPEED * k - P.vy) * 0.35;
        P.x += P.vx; P.y += P.vy;
      }
      P.x = clampN(P.x, 2, C.W - 2); P.y = clampN(P.y, 2, C.H - 2);
      const mv = DMath.hypot(P.x - x0, P.y - y0);
      P.mv += (mv - P.mv) * 0.25;
      if ((I.pressed & (BTN.A | BTN.X)) && P.cd <= 0) {
        P.spray = C.SPRAY; P.cd = C.SPRAY_CD; P.sprays++;
        W.emit('mgWindowSpray', { p: i, x: Math.round(P.x), y: Math.round(P.y) });
      }
      // le frottement : il faut bouger (le pschitt nettoie aussi immobile, un peu)
      const f = Math.min(1, mv / C.MOVE) + (P.spray > 0 ? 0.35 : 0);
      if (f > 0.05) {
        const R = C.R * (P.spray > 0 ? C.SPRAY_R : 1), rate = C.RATE * f * (P.spray > 0 ? C.SPRAY_K : 1);
        const x0c = Math.max(0, Math.floor((P.x - R) / C.CELL)), x1c = Math.min(C.GX - 1, Math.floor((P.x + R) / C.CELL));
        const y0c = Math.max(0, Math.floor((P.y - R) / C.CELL)), y1c = Math.min(C.GY - 1, Math.floor((P.y + R) / C.CELL));
        let got = 0;
        for (let cy = y0c; cy <= y1c; cy++) for (let cx = x0c; cx <= x1c; cx++) {
          const k = cy * C.GX + cx;
          if (!P.d[k]) continue;
          const dx = (cx + 0.5) * C.CELL - P.x, dy = (cy + 0.5) * C.CELL - P.y, dd = Math.sqrt(dx * dx + dy * dy);
          if (dd > R) continue;
          const take = Math.min(P.d[k], Math.max(1, Math.round(rate * (1 - dd / R * 0.5))));
          P.d[k] -= take; got += take;
          if (!P.d[k]) W.emit('mgWindowShine', { p: i, k });
        }
        P.rub = got > 0 ? Math.min(P.rub + 1, 9999) : 0;
      } else P.rub = 0;
      P.pc = cleanPct(g, P);
      const mile = Math.floor(P.pc / 25);
      if (mile > P.mile) { P.mile = mile; if (mile < 4) W.emit('mgWindowMile', { p: i, pc: mile * 25 }); }
      if (P.pc >= 100 && !P.done) { P.done = M.t; W.emit('mgWindowDone', { p: i, t: M.t }); }
    }
    const [a, b] = g.p;
    const lead = a.pc !== b.pc ? (a.pc > b.pc ? 0 : 1) : -1;
    if (lead >= 0 && lead !== g.lead && M.t > 60) W.emit('mgWindowLead', { p: lead });
    if (lead >= 0) g.lead = lead;
    if (a.done && b.done) g.over = 1;
  },

  result(W, M, g) {
    const [a, b] = g.p;
    // tout propre : le premier fini gagne
    let sa = Math.round(a.pc * 10), sv = Math.round(b.pc * 10);
    if (a.done && b.done) { sa = 1000 + (600 - a.done); sv = 1000 + (600 - b.done); }
    return scorePayout(W, M, sa, sv, 15, 20, 70, { sa: Math.round(a.pc), sv: Math.round(b.pc) });
  },
};

// --- CPU laveur ----------------------------------------------------------------------------------------------------
// Il vise la zone la plus sale près de lui (un peu au hasard s'il est faible), y frotte en zigzag, change de zone quand
// elle est propre ou au bout d'un moment ; le pschitt sur les grosses taches. Faible : lent, se disperse.
function windowBot(W, M, g, i, lvl) {
  const P = g.p[i], b = P.b, I = { mx: 0, my: 0, held: 0, pressed: 0 };
  const cell = (x, y) => P.d[clampN(Math.floor(y / C.CELL), 0, C.GY - 1) * C.GX + clampN(Math.floor(x / C.CELL), 0, C.GX - 1)];
  if (--b.nt <= 0 || cell(b.tx, b.ty) < 8) {
    let best = -1e9, bx = P.x, by = P.y;
    for (let cy = 0; cy < C.GY; cy++) for (let cx = 0; cx < C.GX; cx++) {
      let s = 0;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) { const x = cx + ox, y = cy + oy; if (x >= 0 && y >= 0 && x < C.GX && y < C.GY) s += P.d[y * C.GX + x]; }
      const px = (cx + 0.5) * C.CELL, py = (cy + 0.5) * C.CELL, dist = DMath.hypot(px - P.x, py - P.y);
      s -= dist * [3, 6, 9][lvl - 1] * b.sk;
      s += W.rng() * [500, 200, 60][lvl - 1];
      if (s > best) { best = s; bx = px; by = py; }
    }
    b.tx = bx; b.ty = by; b.nt = W.rng.int(40, 90);
  }
  b.ph += 0.35;
  const zx = b.tx + DMath.sin(b.ph) * b.amp, zy = b.ty + DMath.cos(b.ph * 0.7) * b.amp * 0.6;
  const dx = zx - P.x, dy = zy - P.y, d = DMath.hypot(dx, dy) || 1, sp = [0.6, 0.8, 0.97][lvl - 1] * b.sk;
  I.mx = clampN(dx / d * sp, -1, 1); I.my = clampN(-dy / d * sp, -1, 1);
  if (P.cd <= 0 && cell(P.x, P.y) > 120 && W.rng() < [0.02, 0.06, 0.15][lvl - 1]) I.pressed |= BTN.A;
  return I;
}
