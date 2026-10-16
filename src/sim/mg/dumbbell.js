// Les haltères de BIDO (dumbbell) : chacun son BIDO et son râtelier de 5 haltères (le même rangement pour les deux). BIDO
// réclame un poids (« 20 KG ! ») ; on attrape le bon haltère avec la main (A), on le porte jusqu'à BIDO et on le lâche
// sur lui (A). Le bon : +10 et il le soulève, tout fier ; le mauvais : -5, il le renvoie et la main reste sonnée. Plus
// c'est lourd, plus la main traîne. Les demandes sont les mêmes pour les deux, dans le même ordre (chacun à son rythme).
// Coordonnées : dans la moitié de chacun, x depuis le bord extérieur de l'écran (0..DB.W), y vers le bas (DB.Y0..DB.Y1).
import { BTN, MOUSE, DIGITAL, clampN, scorePayout, botLevel } from './common.js';

export const DB = {
  W: 300, Y0: 58, Y1: 330, KG: [5, 10, 20, 35, 50], RACK_X: 62, RACK_Y: 88, RACK_DY: 46, GRAB_R: 30,
  BIDO: [168, 286, 120, 330], SPEED: 270, STUN: 42, WAIT: 26, OK: 10, BAD: 5,
};
const slotXY = (k) => [DB.RACK_X, DB.RACK_Y + k * DB.RACK_DY];
export { slotXY };
const onBido = (x, y) => x >= DB.BIDO[0] && x <= DB.BIDO[1] && y >= DB.BIDO[2] && y <= DB.BIDO[3];

export default {
  name: 'Les haltères de BIDO',

  init(W) {
    // le rangement du râtelier (rack[k] : l'indice du poids posé à la place k), les demandes (sans deux fois de suite)
    const rack = [0, 1, 2, 3, 4];
    for (let k = 4; k > 0; k--) { const j = W.rng.int(0, k); const x = rack[k]; rack[k] = rack[j]; rack[j] = x; }
    const req = [];
    for (let n = 0; n < 24; n++) { let w; do w = W.rng.int(0, 4); while (n && w === req[n - 1]); req.push(w); }
    const pl = () => ({ x: 150, y: 210, vx: 0, vy: 0, kh: 0, hold: -1, n: 0, s: 0, ok: 0, bad: 0, stun: 0, wait: 0, ask: 0, streak: 0,
      b: { tgt: -1, cd: 0, bk: 0.8 + W.rng() * 0.4, ox: 0, oy: 0 } });
    return { rack, req, p: [pl(), pl()], over: 0 };
  },

  step(W, M, g, ia, iv) {
    const ins = [ia, iv];
    for (let i = 0; i < 2; i++) {
      const P = g.p[i], I = ins[i] || dbBot(W, M, g, i, botLevel(W, M, i));
      if (M.t === 1) W.emit('mgDumbAsk', { p: i, w: g.req[0], n: 0 });
      if (P.wait > 0 && --P.wait === 0) { P.n++; W.emit('mgDumbAsk', { p: i, w: g.req[P.n % g.req.length], n: P.n }); }
      // la main (le stick ou les touches vers la droite de l'écran = vers l'intérieur à gauche, vers l'extérieur à droite)
      const sgn = i === 0 ? 1 : -1, heavy = P.hold >= 0 ? 1 - DB.KG[P.hold] / 115 : 1;
      if (P.stun > 0) { P.stun--; P.vx *= 0.8; P.vy *= 0.8; }
      else if (I.held & MOUSE) { P.x += I.mx * sgn * 4.5 * heavy; P.y -= I.my * 4.5 * heavy; P.vx = P.vy = 0; }
      else {
        let k = 1;
        if (I.held & DIGITAL) { P.kh = I.mx || I.my ? P.kh + 1 : 0; k = Math.min(1, 0.45 + P.kh / 18); }
        P.vx += (clampN(I.mx, -1, 1) * sgn * DB.SPEED * k * heavy - P.vx) * 0.3;
        P.vy += (-clampN(I.my, -1, 1) * DB.SPEED * k * heavy - P.vy) * 0.3;
      }
      P.x = clampN(P.x + P.vx / 60, 14, DB.W - 6); P.y = clampN(P.y + P.vy / 60, DB.Y0, DB.Y1);
      if (!(I.pressed & (BTN.A | BTN.GRAB)) || P.stun > 0) continue;
      if (P.hold < 0) {
        // attraper l'haltère le plus proche du râtelier
        let best = -1, bd = DB.GRAB_R * DB.GRAB_R;
        for (let k = 0; k < 5; k++) { const [sx, sy] = slotXY(k), d = (sx - P.x) * (sx - P.x) + (sy - P.y) * (sy - P.y); if (d < bd) { bd = d; best = k; } }
        if (best >= 0) { P.hold = g.rack[best]; W.emit('mgDumbGrab', { p: i, w: P.hold, k: best }); }
      } else if (onBido(P.x, P.y) && P.wait <= 0) {
        const want = g.req[P.n % g.req.length], ok = P.hold === want ? 1 : 0;
        if (ok) { P.s += DB.OK; P.ok++; P.streak++; P.wait = DB.WAIT; }
        else { P.s -= DB.BAD; P.bad++; P.streak = 0; P.stun = DB.STUN; }
        W.emit('mgDumbGive', { p: i, w: P.hold, want, ok, s: P.s, n: P.streak });
        P.hold = -1;
      } else { W.emit('mgDumbDrop', { p: i, w: P.hold }); P.hold = -1; } // lâché à côté : il retourne au râtelier
    }
  },

  result(W, M, g) { return scorePayout(W, M, g.p[0].s, g.p[1].s, 15, 1.1); },
};

// CPU : lit la demande (temps de réaction), va au bon haltère (parfois au voisin, surtout facile), le porte à BIDO
function dbBot(W, M, g, i, lvl) {
  const P = g.p[i], B = P.b, I = { mx: 0, my: 0, held: 0, pressed: 0 };
  if (P.stun > 0 || P.wait > 0) { B.tgt = -1; B.cd = [20, 11, 5][lvl - 1] + W.rng.int(0, 6); return I; }
  if (B.cd > 0) { B.cd--; return I; }
  let tx, ty;
  if (P.hold < 0) {
    if (B.tgt < 0) {
      const want = g.req[P.n % g.req.length];
      let w = want;
      if (W.rng() < [0.24, 0.1, 0.03][lvl - 1] / B.bk) w = clampN(want + (W.rng() < 0.5 ? -1 : 1), 0, 4);
      B.tgt = g.rack.indexOf(w); B.ox = (W.rng() - 0.5) * 14; B.oy = (W.rng() - 0.5) * 14;
    }
    [tx, ty] = slotXY(B.tgt);
  } else { tx = (DB.BIDO[0] + DB.BIDO[1]) / 2; ty = 214; }
  tx += B.ox; ty += B.oy;
  const dx = tx - P.x, dy = ty - P.y, sp = [0.62, 0.84, 1][lvl - 1] * B.bk, sgn = i === 0 ? 1 : -1;
  I.mx = clampN(dx / 24, -1, 1) * sp * sgn; I.my = -clampN(dy / 24, -1, 1) * sp;
  if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
    I.pressed = BTN.A;
    if (P.hold >= 0) B.tgt = -1;
    B.cd = [10, 4, 1][lvl - 1] + W.rng.int(0, 3);
  }
  return I;
}
