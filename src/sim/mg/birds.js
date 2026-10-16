// Sniper des corbeaux (birds) : chacun sa moitié du ciel (J1 à gauche, J2 à droite) et les MÊMES oiseaux, en miroir
// (tirés au début : g.sp, chaque oiseau [image d'arrivée, y, sens, vitesse, amplitude, phase, sorte]). Sa position à
// une image t ne dépend que de t (birdPos) : seuls les tués sont gardés, par joueur. Le viseur : stick ou flèches (il
// accélère tant qu'on tient), ou la souris ; A tire (puis RELOAD images de rechargement). Corbeau maléfique +1, dans
// la tête +1 en plus (HEADSHOT), corbeau d'or +3, la colombe (innocente) -2. Le plus gros score gagne ; le perdant
// prend 15 % + l'écart × 2.
import { BTN, MOUSE, MV_L, MV_R, MV_D, MV_U, DIGITAL, DMath, clampN, scorePayout, botLevel } from './common.js';

export const BIRDS = { HW: 300, HH: 250, SPEED: 5.2, RELOAD: 22, R: [15, 12, 15], HEAD: 0.42, VAL: [1, 3, -2] };
const C = BIRDS;

// la position de l'oiseau b à l'image t, dans la moitié du joueur i (le joueur 1 voit tout en miroir) ; null s'il
// n'est pas (ou plus) dans le ciel
export function birdPos(b, t, i) {
  const u = t - b[0];
  if (u < 0) return null;
  let x = b[2] > 0 ? -24 + b[3] * u : C.HW + 24 - b[3] * u;
  if (x < -30 || x > C.HW + 30) return null;
  const y = b[1] + b[4] * DMath.sin(u * 0.07 + b[5]);
  if (i === 1) x = C.HW - x;
  return [x, y];
}
// le sens où vole l'oiseau à l'écran (1 vers la droite)
export const birdDir = (b, i) => (i === 1 ? -b[2] : b[2]);

function schedule(W) {
  const sp = [];
  let t = 18;
  while (t < 580) {
    const late = t / 600, r = W.rng();
    const kind = r < 0.1 ? 1 : r < 0.22 ? 2 : 0;
    const dir = W.rng() < 0.5 ? 1 : -1, y = 26 + W.rng() * 170, v = (kind === 1 ? 3.2 : 1.5) + W.rng() * 1.1 + late * 1.2;
    sp.push([t, Math.round(y), dir, Math.round(v * 100) / 100, Math.round(6 + W.rng() * 22), Math.round(W.rng() * 628) / 100, kind]);
    if (kind === 0 && W.rng() < 0.22) { // une petite bande de corbeaux
      for (let k = 1; k <= 2; k++) sp.push([t + k * 6, Math.round(clampN(y + (W.rng() - 0.5) * 50, 20, 210)), dir, Math.round(v * 100) / 100, Math.round(6 + W.rng() * 16), Math.round(W.rng() * 628) / 100, 0]);
    }
    t += W.rng.int(16, 34);
  }
  return sp;
}

export default {
  name: 'Sniper des corbeaux',

  init(W) {
    const mk = () => ({ x: C.HW / 2, y: C.HH / 2, vx: 0, vy: 0, kh: 0, cd: 0, n: 0, kills: 0, hs: 0, gold: 0, doves: 0, shots: 0, dead: {},
      b: { tg: -1, wait: 0, ox: 0, oy: 0, sk: 1 } });
    return { sp: schedule(W), p: [mk(), mk()], lead: -1, inited: 0, over: 0 };
  },

  step(W, M, g, ia, iv) {
    const ins = [ia, iv], t = M.t;
    if (!g.inited) { g.inited = 1; for (let i = 0; i < 2; i++) g.p[i].b.sk = 0.85 + W.rng() * 0.3; }
    for (let i = 0; i < 2; i++) {
      const P = g.p[i];
      if (P.cd > 0) P.cd--;
      const I = ins[i] || birdBot(W, M, g, i, botLevel(W, M, i));
      if (I.held & MOUSE) {
        P.x += I.mx * 4.5; P.y -= I.my * 4.5;
        P.x += (((I.held & MV_R) ? 1 : 0) - ((I.held & MV_L) ? 1 : 0)) * 2.5;
        P.y += (((I.held & MV_D) ? 1 : 0) - ((I.held & MV_U) ? 1 : 0)) * 2.5;
        P.vx = P.vy = 0;
      } else {
        // au clavier : le viseur part doucement (pour ajuster) puis accélère
        let k = 1;
        if (I.held & DIGITAL) { P.kh = I.mx || I.my ? P.kh + 1 : 0; k = Math.min(1, 0.22 + P.kh / 22); }
        const s = (v) => v * Math.abs(v) * 0.6 + v * 0.4;
        P.vx += (s(clampN(I.mx, -1, 1)) * C.SPEED * k - P.vx) * 0.4; P.vy += (-s(clampN(I.my, -1, 1)) * C.SPEED * k - P.vy) * 0.4;
        P.x += P.vx; P.y += P.vy;
      }
      P.x = clampN(P.x, 4, C.HW - 4); P.y = clampN(P.y, 4, C.HH - 4);
      if ((I.pressed & (BTN.A | BTN.X)) && P.cd <= 0) {
        P.cd = C.RELOAD; P.shots++;
        // le plus proche du viseur, dans son rayon
        let best = -1, bd = 1e9, hx = 0, hy = 0;
        for (let k = 0; k < g.sp.length; k++) {
          const b = g.sp[k];
          if (b[0] > t) break;
          if (P.dead[k]) continue;
          const q = birdPos(b, t, i);
          if (!q) continue;
          const d = DMath.hypot(q[0] - P.x, q[1] - P.y);
          if (d < C.R[b[6]] && d < bd) { bd = d; best = k; hx = q[0]; hy = q[1]; }
        }
        if (best < 0) { W.emit('mgBirdsShot', { p: i, x: Math.round(P.x), y: Math.round(P.y), hit: 0 }); continue; }
        const b = g.sp[best], kind = b[6];
        // la tête : devant, côté où il vole
        const hd = DMath.hypot(hx + birdDir(b, i) * 7 - P.x, hy - 2 - P.y), head = kind !== 2 && hd < C.R[kind] * C.HEAD ? 1 : 0;
        P.dead[best] = t;
        const v = C.VAL[kind] + head;
        P.n = Math.max(0, P.n + v);
        if (kind === 2) P.doves++; else { P.kills++; if (kind === 1) P.gold++; P.hs += head; }
        W.emit('mgBirdsShot', { p: i, x: Math.round(hx), y: Math.round(hy), hit: 1, k: best, kind, head, v, n: P.n, d: birdDir(b, i) });
      }
    }
    const [a, b] = g.p;
    const lead = a.n !== b.n ? (a.n > b.n ? 0 : 1) : -1;
    if (lead >= 0 && lead !== g.lead && t > 30) W.emit('mgBirdsLead', { p: lead });
    if (lead >= 0) g.lead = lead;
  },

  result(W, M, g) { return scorePayout(W, M, g.p[0].n, g.p[1].n, 15, 0.5); },
};

// --- CPU tireur ----------------------------------------------------------------------------------------------------
// Il choisit l'oiseau le plus intéressant (d'or d'abord, jamais la colombe sauf erreur s'il est faible), vise où il sera
// un peu plus tard, s'approche (plus lent, et tremble, s'il est faible) et tire une fois dessus, après un temps de
// réaction ; il se trompe parfois de peu.
function birdBot(W, M, g, i, lvl) {
  const P = g.p[i], b = P.b, t = M.t, I = { mx: 0, my: 0, held: 0, pressed: 0 };
  const alive = (k) => k >= 0 && !P.dead[k] && birdPos(g.sp[k], t + 8, i);
  if (!alive(b.tg)) {
    b.tg = -1; let best = -1e9;
    for (let k = 0; k < g.sp.length; k++) {
      const s = g.sp[k];
      if (s[0] > t) break;
      if (P.dead[k]) continue;
      const q = birdPos(s, t + 10, i);
      if (!q) continue;
      if (s[6] === 2 && W.rng() > [0.08, 0.02, 0][lvl - 1]) continue;
      const sc = (s[6] === 1 ? 160 : 0) - DMath.hypot(q[0] - P.x, q[1] - P.y) + W.rng() * 40;
      if (sc > best) { best = sc; b.tg = k; }
    }
    b.wait = W.rng.int(...[[12, 26], [10, 20], [7, 15]][lvl - 1]);
    const e = [6.5, 5.5, 4.5][lvl - 1]; b.ox = (W.rng() - 0.5) * e * 2; b.oy = (W.rng() - 0.5) * e * 2;
  }
  if (b.tg < 0) return I;
  const ld = [5, 3, 2][lvl - 1], q = birdPos(g.sp[b.tg], t + ld, i), q1 = birdPos(g.sp[b.tg], t + ld + 1, i);
  if (!q) return I;
  // la vitesse voulue : celle de l'oiseau (s'il est bon) + de quoi rattraper l'écart ; le stick qui la donne (sa courbe inversée)
  const dx = q[0] + b.ox - P.x, dy = q[1] + b.oy - P.y, d = DMath.hypot(dx, dy) || 1, fw = [0.7, 0.85, 1][lvl - 1];
  const vx = (q1 ? (q1[0] - q[0]) * fw : 0) + dx * 0.22, vy = (q1 ? (q1[1] - q[1]) * fw : 0) + dy * 0.22, cap = C.SPEED * [0.75, 0.85, 1][lvl - 1] * b.sk;
  const inv = (v) => { const f = clampN(v / C.SPEED, -1, 1), a = Math.abs(f); return Math.sign(f) * (-0.4 + Math.sqrt(0.16 + 2.4 * a)) / 1.2; };
  I.mx = inv(clampN(vx, -cap, cap)); I.my = -inv(clampN(vy, -cap, cap));
  if (b.wait > 0) b.wait--;
  else if (d < [10, 9, 7][lvl - 1] && P.cd <= 0) I.pressed |= BTN.A;
  return I;
}
