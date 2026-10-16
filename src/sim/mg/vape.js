// La vapoteuse de J'san (vape) : J'san a perdu sa vapoteuse dans son salon (en 3D) ; elle est cachée sous l'un des
// meubles (SPOTS : leur cadre à l'écran, dans la grille 640 x 360, le même pour les deux). Chacun promène sa main (stick,
// flèches ou souris) et appuie sur A pour soulever le meuble dessous (LOOK images bloqué). Le premier qui la trouve
// marque un point ; elle se recache ailleurs (W.rng) après PAUSE images, nouvelle manche. Au bout de HINT images
// sans la trouver, une petite bouffée trahit sa cachette (la même pour les deux). Le plus de vapoteuses gagne ; le
// perdant prend 15 % + 8 % par vapoteuse d'écart.
import { BTN, MOUSE, MV_L, MV_R, MV_D, MV_U, DIGITAL, DMath, clampN, scorePayout, botLevel } from './common.js';

// chaque cachette : [x du milieu, y du bas, largeur, hauteur] à l'écran (le bas : là où le meuble touche le sol)
export const VAPE = {
  SPOTS: [
    [78, 214, 76, 132], // l'étagère
    [214, 206, 36, 116], // le lampadaire
    [330, 198, 112, 84], // la télé
    [572, 214, 58, 86], // la plante
    [182, 300, 178, 74], // le canapé
    [336, 292, 112, 44], // la table basse
    [492, 294, 108, 82], // le fauteuil
    [52, 326, 46, 54], // la poubelle
    [598, 330, 72, 36], // le linge sale
  ],
  SPEED: 9, LOOK: 16, MISS: 8, PAUSE: 50, HINT: 170, HINT_EVERY: 70, PAD: 5,
};
const C = VAPE;

// la cachette sous le point (x, y) de l'écran, ou -1
export function spotAt(x, y) {
  let best = -1, bd = 1e9;
  for (let k = 0; k < C.SPOTS.length; k++) {
    const [cx, by, w, h] = C.SPOTS[k];
    if (x < cx - w / 2 - C.PAD || x > cx + w / 2 + C.PAD || y < by - h - C.PAD || y > by + C.PAD) continue;
    const d = Math.abs(x - cx) + Math.abs(y - (by - h / 2));
    if (d < bd) { bd = d; best = k; }
  }
  return best;
}

export default {
  name: 'La vapoteuse de J\'san',

  init(W) {
    const mk = (x) => ({ x, y: 120, vx: 0, vy: 0, kh: 0, lock: 0, n: 0, chk: 0, looks: 0, b: { ord: [], oi: 0, wait: 0, ox: 0, oy: 0, sk: 1, tg: -1 } });
    return { at: W.rng.int(0, C.SPOTS.length - 1), round: 1, rt: 0, pause: 0, p: [mk(250), mk(390)], last: [], inited: 0, over: 0 };
  },

  step(W, M, g, ia, iv) {
    const ins = [ia, iv];
    if (!g.inited) { g.inited = 1; for (let i = 0; i < 2; i++) { g.p[i].b.sk = 0.85 + W.rng() * 0.3; shuffle(W, g.p[i].b); } }
    if (g.pause > 0) {
      if (--g.pause === 0) {
        let k = W.rng.int(0, C.SPOTS.length - 2);
        if (k >= g.at) k++; // jamais deux fois au même endroit
        g.at = k; g.round++; g.rt = 0;
        for (let i = 0; i < 2; i++) { g.p[i].chk = 0; shuffle(W, g.p[i].b); }
        W.emit('mgVapeHide', { r: g.round });
      }
    } else {
      g.rt++;
      if (g.rt >= C.HINT && (g.rt - C.HINT) % C.HINT_EVERY === 0) W.emit('mgVapeHint', { k: g.at });
    }
    const found = [];
    for (let i = 0; i < 2; i++) {
      const P = g.p[i];
      if (P.lock > 0) P.lock--;
      const I = ins[i] || vapeBot(W, M, g, i, botLevel(W, M, i));
      if (I.held & MOUSE) {
        P.x += I.mx * 11; P.y -= I.my * 11;
        P.x += (((I.held & MV_R) ? 1 : 0) - ((I.held & MV_L) ? 1 : 0)) * 4;
        P.y += (((I.held & MV_D) ? 1 : 0) - ((I.held & MV_U) ? 1 : 0)) * 4;
        P.vx = P.vy = 0;
      } else {
        let k = 1;
        if (I.held & DIGITAL) { P.kh = I.mx || I.my ? P.kh + 1 : 0; k = Math.min(1, 0.3 + P.kh / 14); }
        P.vx += (clampN(I.mx, -1, 1) * C.SPEED * k - P.vx) * 0.4; P.vy += (-clampN(I.my, -1, 1) * C.SPEED * k - P.vy) * 0.4;
        P.x += P.vx; P.y += P.vy;
      }
      P.x = clampN(P.x, 6, 634); P.y = clampN(P.y, 44, 354);
      if (!(I.pressed & (BTN.A | BTN.X)) || P.lock > 0 || g.pause > 0) continue;
      const k = spotAt(P.x, P.y);
      if (k < 0) { P.lock = C.MISS; W.emit('mgVapeMiss', { p: i, x: Math.round(P.x), y: Math.round(P.y) }); continue; }
      if (P.chk & (1 << k)) { P.lock = C.MISS; W.emit('mgVapeAgain', { p: i, k }); continue; }
      P.chk |= 1 << k; P.lock = C.LOOK; P.looks++;
      if (k === g.at) found.push(i);
      else W.emit('mgVapeEmpty', { p: i, k });
    }
    for (const i of found) { // (les deux à la même image : un point chacun)
      g.p[i].n++;
      W.emit('mgVapeFound', { p: i, k: g.at, n: g.p[i].n, both: found.length > 1 ? 1 : 0, rt: g.rt });
    }
    if (found.length) { g.pause = C.PAUSE; g.last.push(found.length > 1 ? 2 : found[0]); }
  },

  result(W, M, g) { return scorePayout(W, M, g.p[0].n, g.p[1].n, 15, 1 / 8); },
};

function shuffle(W, b) {
  const o = C.SPOTS.map((_, k) => k);
  for (let k = o.length - 1; k > 0; k--) { const j = W.rng.int(0, k); const t = o[k]; o[k] = o[j]; o[j] = t; }
  b.ord = o; b.oi = 0; b.tg = -1;
}

// --- CPU chercheur -------------------------------------------------------------------------------------------------
// Il fouille les meubles dans un ordre à lui (tiré à chaque manche), va jusqu'au meuble (plus lent s'il est faible),
// hésite un peu, soulève ; quand la bouffée trahit la cachette, il la voit (souvent s'il est fort) et y fonce.
function vapeBot(W, M, g, i, lvl) {
  const P = g.p[i], b = P.b, I = { mx: 0, my: 0, held: 0, pressed: 0 };
  if (g.pause > 0 || P.lock > 0) return I;
  if (g.rt >= C.HINT && (g.rt - C.HINT) % C.HINT_EVERY === 8 && !(P.chk & (1 << g.at)) && W.rng() < [0.25, 0.55, 0.85][lvl - 1]) {
    b.tg = g.at; b.wait = W.rng.int(...[[10, 20], [6, 12], [3, 6]][lvl - 1]);
  }
  while (b.tg < 0 || (P.chk & (1 << b.tg))) {
    if (b.oi >= b.ord.length) { shuffle(W, b); }
    b.tg = b.ord[b.oi++];
    if (P.chk & (1 << b.tg)) { b.tg = -1; continue; }
    b.wait = W.rng.int(...[[12, 26], [7, 15], [3, 8]][lvl - 1]);
    const s = C.SPOTS[b.tg];
    b.ox = (W.rng() - 0.5) * s[2] * 0.5; b.oy = (W.rng() - 0.5) * s[3] * 0.5;
  }
  const s = C.SPOTS[b.tg], tx = s[0] + b.ox, ty = s[1] - s[3] / 2 + b.oy;
  const dx = tx - P.x, dy = ty - P.y, d = DMath.hypot(dx, dy) || 1;
  const sp = Math.min(1, d / 30) * [0.6, 0.8, 1][lvl - 1] * b.sk;
  I.mx = dx / d * sp; I.my = -dy / d * sp;
  if (d < 14) { if (b.wait > 0) b.wait--; else if (spotAt(P.x, P.y) === b.tg || --b.wait < -20) I.pressed |= BTN.A; }
  return I;
}
