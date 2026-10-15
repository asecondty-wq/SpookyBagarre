// Grimpe du bonheur (climb) : une tour à la Icy Tower, la même pour les deux, chacun sa colonne (280 de large, y vers le
// haut, un étage tous les FLOOR). On court, on saute (plus on court vite, plus on saute haut ; contrôle en l'air, coyote
// time, saut mémorisé, saut court si on lâche), on grimpe vers le bonheur (un soleil tout en haut, hors d'atteinte : on
// le poursuit). Plateformes : normales, biscuits qui cassent (CRACK images après le premier pas), nuages qui vont et
// viennent, ressorts, un palier doré tous les 10 étages. Sauter deux étages ou plus d'un coup enchaîne un combo.
// La marée de larmes monte (de plus en plus vite, et plus vite encore si on la distance) : qui tombe dedans pleure, Nymano
// vient lui jouer de la musique triste (CRY images), puis il repart d'un étage au-dessus des larmes.
// Le plus haut étage atteint gagne (à égalité, le premier arrivé) : le perdant prend 15 % + l'écart / 12 (70 % au plus,
// un étage = 56 : trois étages d'écart, 29 %).
import { BTN, DMath, MG_PLAY, clampN, payout, botLevel, slotOf } from './common.js';

export const CLIMB = {
  CW: 280, FLOOR: 56, FLOORS: 64, HW: 7, H: 22, G: 0.42, JUMP: 8.2, JRUN: 0.5, RUN: 4.4, ACC: 0.6, AIR: 0.34, FRIC: 0.75,
  FALL: 11, COYOTE: 7, BUF: 7, SPRING: 15, SPR_W: 9, CRY: 80, INV: 50, CRACK: 26, M: 14, // M : unités par mètre (un étage = 4 m)
};
const C = CLIMB;
const JUMPB = BTN.JUMP | BTN.A | BTN.X;

// une plateforme : [x (bord gauche), y, largeur, type (0 normale, 1 biscuit, 2 nuage, 3 palier), amplitude, vitesse,
// phase, ressort (décalage depuis le bord gauche, -1 sans), étage]. Sa position à l'image t (les nuages bougent) :
export function platX(p, t) { return p[4] ? p[0] + p[4] * DMath.sin(t * p[5] + p[6]) : p[0]; }

function build(W) {
  const pl = [[0, 0, C.CW, 3, 0, 0, 0, -1, 0]], fi = [0];
  let pc = C.CW / 2;
  for (let k = 1; k <= C.FLOORS; k++) {
    fi.push(pl.length);
    const y = k * C.FLOOR;
    if (k % 10 === 0) { // le palier : large, doré, un panneau
      const w = 170, x = Math.round(clampN(pc - w / 2 + (W.rng() - 0.5) * 60, 0, C.CW - w));
      pl.push([x, y, w, 3, 0, 0, 0, -1, k]); pc = x + w / 2;
      continue;
    }
    const w = Math.round(Math.max(44, 110 - k * 1.3) + W.rng() * 26);
    let cx = pc + (W.rng() * 2 - 1) * 118;
    if (Math.abs(cx - pc) < 34) cx += cx < pc ? -44 : 44;
    let type = 0, amp = 0, spd = 0, ph = 0, spr = -1;
    const r = W.rng();
    if (k > 3 && r < 0.17) type = 1;
    else if (k > 5 && r < 0.36) { type = 2; amp = Math.round(22 + W.rng() * 30); spd = 0.024 + W.rng() * 0.02; ph = W.rng() * 6.283; }
    cx = clampN(cx, w / 2 + amp, C.CW - w / 2 - amp);
    if (type !== 1 && k > 2 && W.rng() < 0.11) spr = Math.round(10 + W.rng() * (w - 20));
    pl.push([Math.round(cx - w / 2), y, w, type, amp, spd, ph, spr, k]);
    // parfois une deuxième, petite, de l'autre côté (un autre chemin)
    if (W.rng() < 0.3) {
      const w2 = Math.round(40 + W.rng() * 18), c2 = cx < C.CW / 2 ? C.CW - 26 - W.rng() * 50 : 26 + W.rng() * 50;
      if (Math.abs(c2 - cx) > (w + w2) / 2 + amp + 12) pl.push([Math.round(clampN(c2 - w2 / 2, 0, C.CW - w2)), y, w2, 0, 0, 0, 0, -1, k]);
    }
    pc = cx;
  }
  fi.push(pl.length);
  return { pl, fi };
}

// une image de déplacement d'un corps S { x, y, vx, vy, gr (plateforme sous les pieds, -1 en l'air), coy } ; br : l'état
// des biscuits de ce joueur. Sert au joueur et aux CPU (qui simulent leurs sauts avec). Rend 1 posé, 2 rebond sur un
// mur, 3 parti du bord, 0 sinon.
function advance(g, S, br, mx, jh, t) {
  let ev = 0;
  const on = S.gr >= 0;
  if (Math.abs(mx) > 0.15) { const acc = on ? C.ACC : C.AIR; S.vx += clampN(mx * C.RUN - S.vx, -acc, acc); }
  else if (on) { S.vx *= C.FRIC; if (Math.abs(S.vx) < 0.05) S.vx = 0; }
  else S.vx *= 0.99;
  if (on) { const p = g.pl[S.gr]; if (p[4]) S.x += platX(p, t) - platX(p, t - 1); }
  S.x += S.vx;
  if (S.x < C.HW || S.x > C.CW - C.HW) {
    S.x = clampN(S.x, C.HW, C.CW - C.HW);
    if (!on && Math.abs(S.vx) > 2.2) { S.vx = -S.vx * 0.85; ev = 2; } else S.vx = 0;
  }
  if (on) {
    const p = g.pl[S.gr], px = platX(p, t);
    if (br[S.gr] >= 0 && S.x >= px - C.HW * 0.6 && S.x <= px + p[2] + C.HW * 0.6) return ev;
    S.gr = -1; S.coy = C.COYOTE; S.vy = 0; ev = 3;
  }
  S.vy -= C.G;
  if (S.vy > 0 && !jh) S.vy -= C.G * 1.3; // saut court
  if (S.vy < -C.FALL) S.vy = -C.FALL;
  const y0 = S.y;
  S.y += S.vy;
  if (S.coy > 0) S.coy--;
  if (S.vy > 0) return ev;
  const kTop = Math.min(C.FLOORS, Math.floor(y0 / C.FLOOR)), kLow = Math.max(0, Math.ceil(S.y / C.FLOOR));
  for (let k = kTop; k >= kLow; k--) {
    for (let j = g.fi[k]; j < g.fi[k + 1]; j++) {
      const p = g.pl[j];
      if (br[j] < 0) continue;
      const px = platX(p, t);
      if (S.x >= px - C.HW * 0.6 && S.x <= px + p[2] + C.HW * 0.6) { S.y = p[1]; S.vy = 0; S.gr = j; return 1; }
    }
  }
  return ev;
}

function respawn(W, g, P, i) {
  let at = 0;
  for (let j = 0; j < g.pl.length; j++) if (P.br[j] >= 0 && g.pl[j][1] >= P.tide + 64) { at = j; break; }
  const p = g.pl[at];
  P.x = platX(p, g.t) + p[2] / 2; P.y = p[1]; P.vx = 0; P.vy = 0; P.gr = at; P.coy = 0; P.buf = 0;
  P.f = p[8]; P.combo = 0; P.inv = C.INV; P.b.tg = -1;
  W.emit('mgClimbBack', { p: i, f: P.f });
}

export default {
  name: 'Grimpe du bonheur',

  init(W) {
    const { pl, fi } = build(W);
    const mk = () => ({
      x: C.CW / 2, y: 0, vx: 0, vy: 0, gr: 0, coy: 0, buf: 0, arm: 1, f: 0, best: 0, bt: 0, combo: 0, maxc: 0, cry: 0, inv: 0,
      face: 1, tide: -80, falls: 0, jumps: 0, br: pl.map(() => 0),
      b: { tg: -1, wait: 0, fail: 0, nx: 0, nt: 0, sk: 0, spr: 0, short: 0, ru: 0 },
    });
    return { pl, fi, p: [mk(), mk()], t: 0, lead: -1, over: 0 };
  },

  step(W, M, g, ia, iv) {
    const t = g.t = M.t, ins = [ia, iv];
    for (let i = 0; i < 2; i++) {
      const P = g.p[i];
      for (let k = 0; k < P.br.length; k++) {
        if (P.br[k] > 0 && ++P.br[k] > C.CRACK) { P.br[k] = -1; W.emit('mgClimbBreak', { p: i, k }); }
      }
      if (P.cry > 0) { if (--P.cry === 0) respawn(W, g, P, i); continue; }
      const I = ins[i] || climbBot(W, g, i, botLevel(W, M, i));
      // commandes : stick (ou ZQSD), saut = saut, A, X, ou le stick vers le haut (un coup sec)
      const mx = clampN(I.mx || 0, -1, 1);
      let jp = (I.pressed & JUMPB) !== 0;
      if (I.my < 0.35) P.arm = 1;
      else if (I.my > 0.6 && P.arm) { P.arm = 0; jp = true; }
      const jh = (I.held & JUMPB) !== 0 || I.my > 0.5;
      if (mx > 0.15) P.face = 1; else if (mx < -0.15) P.face = -1;
      if (jp) P.buf = C.BUF;
      if (P.buf > 0 && (P.gr >= 0 || P.coy > 0)) {
        const v = Math.abs(P.vx);
        P.vy = C.JUMP + C.JRUN * v; P.gr = -1; P.coy = 0; P.buf = 0; P.jumps++;
        W.emit('mgClimbJump', { p: i, v: Math.round(v * 10) / 10 });
      } else if (P.buf > 0) P.buf--;
      const ev = advance(g, P, P.br, mx, jh, t);
      if (ev === 2) W.emit('mgClimbWall', { p: i, s: P.x < C.CW / 2 ? -1 : 1 });
      if (ev === 1) {
        const p = g.pl[P.gr], f = p[8], sk = f - P.f;
        if (sk >= 2) { P.combo++; P.maxc = Math.max(P.maxc, P.combo); }
        else { if (P.combo >= 2) W.emit('mgClimbComboEnd', { p: i, c: P.combo }); P.combo = 0; }
        P.f = f;
        W.emit('mgClimbLand', { p: i, f, sk, c: P.combo, ty: p[3] });
        if (p[3] === 1 && P.br[P.gr] === 0) { P.br[P.gr] = 1; W.emit('mgClimbCrack', { p: i, k: P.gr }); }
        if (P.y > P.best) { P.best = P.y; P.bt = t; if (f % 10 === 0) W.emit('mgClimbFloor', { p: i, f }); }
      }
      if (P.gr >= 0) { // un ressort sous les pieds
        const p = g.pl[P.gr];
        if (p[7] >= 0 && Math.abs(P.x - platX(p, t) - p[7]) < C.SPR_W) { P.vy = C.SPRING; P.gr = -1; P.coy = 0; W.emit('mgClimbSpring', { p: i }); }
      }
      // la marée de larmes
      P.tide += 0.26 + 0.9 * t / MG_PLAY + Math.min(1.8, Math.max(0, P.f * C.FLOOR - P.tide - 190) * 0.015);
      if (P.inv > 0) P.inv--;
      else if (P.y < P.tide + 3) {
        P.cry = C.CRY; P.falls++; P.vx = 0; P.vy = 0; P.gr = -1; P.coy = 0; P.y = P.tide - 4;
        if (P.combo >= 2) W.emit('mgClimbComboEnd', { p: i, c: P.combo });
        P.combo = 0;
        W.emit('mgClimbCry', { p: i, n: P.falls });
      }
    }
    const [a, b] = g.p;
    const lead = a.best !== b.best ? (a.best > b.best ? 0 : 1) : a.bt !== b.bt ? (a.bt < b.bt ? 0 : 1) : -1;
    if (lead >= 0 && lead !== g.lead && t > 30) W.emit('mgClimbLead', { p: lead });
    if (lead >= 0) g.lead = lead;
  },

  result(W, M, g) {
    const [a, b] = g.p;
    const w = a.best !== b.best ? (a.best > b.best ? 0 : 1) : a.bt !== b.bt ? (a.bt < b.bt ? 0 : 1) : -1;
    const sa = Math.round(a.best / C.M), sv = Math.round(b.best / C.M);
    if (w < 0) return payout(W, -1, -1, 0, { sa, sv });
    const d = Math.round(clampN(15 + Math.abs(a.best - b.best) / 12, 15, 70));
    return payout(W, slotOf(M, w), slotOf(M, 1 - w), d, { sa, sv, kbb: 18, kbg: 180 });
  },
};

// --- CPU grimpeur -------------------------------------------------------------------------------------------------
// Posé : il choisit une plateforme un ou deux étages plus haut (deux pour les combos, plus souvent s'il est fort), court
// vers elle et saute dès que sa simulation du saut (la même physique, en se dirigeant vers elle) l'y pose. Il hésite un
// peu (beaucoup s'il est faible), saute quand même au bord du vide ou quand les larmes arrivent.
function pickTarget(W, g, P, lvl, cautious) {
  const far = !cautious && W.rng() < [0.08, 0.25, 0.45][lvl - 1] * P.b.sk;
  for (let r = far ? 2 : 1; r <= 3; r++) {
    const k = P.f + r;
    if (k > C.FLOORS) return -1;
    let best = -1, bd = 1e9;
    for (let j = g.fi[k]; j < g.fi[k + 1]; j++) {
      if (P.br[j] < 0) continue;
      const p = g.pl[j], d = Math.abs(platX(p, g.t) + p[2] / 2 - P.x) + (p[3] === 1 ? 40 : 0) + W.rng() * 30;
      if (d < bd) { bd = d; best = j; }
    }
    if (best >= 0) return best;
  }
  return -1;
}

function simJump(g, P, tg, t) {
  const T = g.pl[tg], S = { x: P.x, y: P.y, vx: P.vx, vy: C.JUMP + C.JRUN * Math.abs(P.vx), gr: -1, coy: 0 };
  for (let f = 0; f < 110; f++) {
    const tcx = platX(T, t + f) + T[2] / 2;
    advance(g, S, P.br, clampN((tcx - S.x) / 14, -1, 1), true, t + f);
    if (S.gr >= 0) return g.pl[S.gr][8] >= T[8];
    if (S.y < P.tide + 4 || S.y < P.y - 120) return false;
  }
  return false;
}

function climbBot(W, g, i, lvl) {
  const P = g.p[i], b = P.b, t = g.t, I = { mx: 0, my: 0, held: 0, pressed: 0 };
  if (!b.sk) b.sk = 0.8 + W.rng() * 0.5; // l'audace de ce CPU (deux CPU ne jouent pas pareil)
  if (--b.nt <= 0) { b.nx = (W.rng() - 0.5) * [1.1, 0.5, 0.15][lvl - 1]; b.nt = 10 + (W.rng() * 14 | 0); }
  if (P.gr >= 0) {
    const cur = g.pl[P.gr];
    if (b.tg < 0 || g.pl[b.tg][8] <= P.f || P.br[b.tg] < 0 || b.fail > 40) {
      b.tg = pickTarget(W, g, P, lvl, b.fail > 40); b.fail = 0; b.ru = 0;
      b.wait = (W.rng() * [22, 10, 4][lvl - 1]) | 0;
      b.spr = cur[7] >= 0 && W.rng() < [0.3, 0.7, 0.95][lvl - 1] ? 1 : 0;
      b.short = W.rng() < [0.15, 0.05, 0][lvl - 1] ? 1 : 0;
    }
    if (b.spr && cur[7] >= 0) { const sx = platX(cur, t) + cur[7]; I.mx = clampN((sx - P.x) / 6, -1, 1); return I; }
    if (b.tg < 0) return I;
    const T = g.pl[b.tg], tcx = platX(T, t) + T[2] / 2, dx = tcx - P.x, px = platX(cur, t);
    let go = false;
    const ok = simJump(g, P, b.tg, t);
    if (ok) { b.ru = 0; if (b.wait > 0) b.wait--; else go = true; }
    else {
      b.fail++;
      // trop haut pour un saut sur place : il prend de l'élan (s'éloigne, puis revient en courant)
      if (!b.ru && T[1] - P.y > 70 && Math.abs(P.vx) < 3.4 && Math.abs(dx) < 70) b.ru = P.x - px > px + cur[2] - P.x ? -1 : 1;
    }
    const brake = 6 + P.vx * P.vx * 1.1; // la distance qu'il lui faut pour faire demi-tour
    if (b.ru && (Math.abs(dx) > 60 || (b.ru < 0 ? P.x - px < brake : px + cur[2] - P.x < brake))) b.ru = 0;
    I.mx = b.ru ? b.ru : Math.abs(dx) > 5 ? Math.sign(dx) : 0;
    // pas de saut possible et le bord approche : il freine (et changera d'idée)
    const de = P.vx > 0 ? px + cur[2] - P.x : P.x - px;
    if (!go && !ok && Math.abs(P.vx) > 0.5 && de < brake && cur[2] < C.CW) { I.mx = -Math.sign(P.vx); b.fail += 6; b.ru = 0; }
    if (P.y - P.tide < 34 || (lvl === 1 && W.rng() < 0.006)) go = true;
    if (P.br[P.gr] > C.CRACK - 8) go = true; // le biscuit lâche
    if (go) { I.pressed |= BTN.JUMP; I.held |= BTN.JUMP; }
    return I;
  }
  if (b.tg >= 0) {
    const T = g.pl[b.tg];
    I.mx = clampN((platX(T, t) + T[2] / 2 - P.x) / 14 + b.nx, -1, 1);
  }
  if (!(b.short && P.vy < 4)) I.held |= BTN.JUMP;
  return I;
}
