// Duel au pistolet (fps), en écran partagé, en sept variantes (DUEL_VARIANTS, tirées dans un sac : W.fpsBag). Les deux se
// font face sur la plateforme principale : p[0] (l'attaquant) à x = gx - L, regardant vers +x, p[1] à gx + L. Chacun se
// déplace en profondeur (z, de gauche à droite sur son écran), saute (double saut, triple sur la Lune), glisse
// (s'accroupir en courant), s'accroupit. Son viseur est un point (az, ay) du plan x = celui de
// l'autre ; sa caméra le regarde depuis ses yeux. Les abris (tombes, caisses, piliers) arrêtent les balles qui les
// traversent, et cèdent au bout de quelques-unes.
// Commandes : viser au stick droit (la souris pour Clavier 1, voir Input.setDuel), bouger avec les bits MV_* (stick gauche
// / ZQSD), tirer A, X ou gâchette (bouclier), sauter, recharger (saisie). Au clavier sans souris (DIGITAL) : ◀ ▶
// bouger, ▼ s'accroupir (en courant : glisser), le viseur suit l'autre tout seul (lentement : il faut bouger pour
// l'éviter), au corps, ou à la tête tant qu'on tient ▲.
import { BTN, MOUSE, MV_L, MV_R, MV_D, MV_U, DIGITAL, DMath, clampN, payout } from './common.js';

export const DUEL = {
  KB_AIM: 3.8, HEAD: 0.14, CROUCH: 0.6, EYE: 0.9, EYE_C: 0.56, COVER_D: 2.6, COVER_W: 0.62, COVER_H: 0.66, HP: 100, DEAD: 34,
  SPEED: 8.5, JUMP: 11.5, SLIDE: 24, GRAV: 0.75, ACC: 0.6, SLIDE_MIN: 5, MAX_COVERS: 8, MAX_RK: 6,
};

// les variantes : l'arme (chargeur, recharge, cadence, auto, plombs, dispersion, dégâts au corps et à la tête, recul qui
// grimpe, poussée, charge, roquette), la distance (L = rayon de la plateforme x k, entre min et max), les abris par
// camp, la gravité, les sauts, la vitesse, le nombre d'éliminations pour gagner ; dark : le noir total (affichage)
export const DUEL_VARIANTS = [
  { id: 'colt', name: 'Duel : pétoires', mag: 6, reload: 42, cool: 8, dmg: [34, 42], head: 100, kills: 3, dist: [0.42, 4, 6.2], covers: 2 },
  { id: 'pompe', name: 'Duel : fusil à pompe', mag: 2, reload: 44, cool: 18, pellets: 8, spread: 0.42, dmg: [9, 13], head: 18, push: 9, kills: 4, dist: [0.22, 2.4, 3.4], covers: 1, speed: 1.15 },
  { id: 'akimbo', name: 'Duel : akimbo', mag: 40, reload: 54, cool: 4, auto: 1, spread: 0.07, dmg: [8, 11], head: 34, climb: 0.045, kills: 5, dist: [0.42, 4, 6.2], covers: 3 },
  { id: 'rail', name: 'Duel : railgun', mag: 1, reload: 24, cool: 6, charge: 40, dmg: [40, 100], head: 100, kills: 3, dist: [0.62, 6, 9], covers: 3, speed: 0.9 },
  { id: 'roquette', name: 'Duel : roquettes', mag: 3, reload: 50, cool: 22, rocket: { v: 21, r: 2, dmg: 62, kz: 12, ky: 10 }, kills: 4, dist: [0.42, 4, 6.2], covers: 1 },
  { id: 'lune', name: 'Duel sur la Lune', mag: 6, reload: 42, cool: 8, dmg: [34, 42], head: 100, kills: 3, dist: [0.42, 4, 6.2], covers: 2, grav: 0.2, jumps: 3, jump: 8.5 },
  { id: 'noir', name: 'Duel : noir total', mag: 6, reload: 42, cool: 8, dmg: [34, 42], head: 100, kills: 3, dist: [0.42, 4, 6.2], covers: 2, dark: 1 },
  // les deux snipers, de très loin : scope 'hold' (tenir = lunette, lâcher = tir ; sans lunette, ça part n'importe où),
  // 'always' (toujours à la lunette) ; sway : le réticule qui tangue à la lunette (moins accroupi)
  { id: 'awp', name: 'Duel : AWP', mag: 5, reload: 60, cool: 66, scope: 'hold', sway: 0.06, dmg: [86, 96], head: 100, kills: 3, dist: [1.2, 11, 14], covers: 3 },
  { id: 'champs', name: 'Duel : sniper des champs', mag: 5, reload: 56, cool: 26, scope: 'always', sway: 0.05, dmg: [52, 60], head: 100, kills: 3, dist: [1.25, 12, 15], covers: 4 },
];
// à la lunette en ce moment (le zoom, le réticule qui tangue, la visée ralentie, l'affichage de la lunette)
export const duelScoped = (VR, P) => VR.scope === 'always' || (VR.scope === 'hold' && P.ch > 0);
export const duelVar = (g) => DUEL_VARIANTS[g.vi] || DUEL_VARIANTS[0];

// une variante imposée (le menu des mini-jeux, les tests : startMinigame(W, a, v, 'fps:3')), le temps d'un init
let forced = -1;
export function forceDuelVariant(v) { forced = v; }

function pickVariant(W) {
  const n = DUEL_VARIANTS.length;
  if (forced >= 0 && forced < n) return forced;
  return nextDuelVariant(W);
}

// la prochaine variante du sac (aussi tirée d'avance, pour annoncer le mini-jeu : minigames.js tickMinigameClock)
export function nextDuelVariant(W) {
  const n = DUEL_VARIANTS.length;
  if (!W.fpsBag || !W.fpsBag.length) {
    const bag = [];
    for (let i = 0; i < n; i++) bag.push(i);
    for (let i = n - 1; i > 0; i--) { const j = (W.rng() * (i + 1)) | 0; const t = bag[i]; bag[i] = bag[j]; bag[j] = t; }
    if (bag[n - 1] === W.fpsLast) { const t = bag[0]; bag[0] = bag[n - 1]; bag[n - 1] = t; }
    W.fpsBag = bag;
  }
  W.fpsLast = W.fpsBag.pop();
  return W.fpsLast;
}

export default {
  name: 'Duel au pistolet',

  init(W, A, V) {
    const vi = pickVariant(W), VR = DUEL_VARIANTS[vi];
    const m = W.stage.main();
    const gx = m.cx, gy = W.stage.heightAt(m, m.cx, 0);
    const L = clampN(m.r * VR.dist[0], VR.dist[1], VR.dist[2]), zr = clampN(m.r * 0.25, 2, 3);
    const mk = (F, i) => {
      const sd = i === 0 ? 1 : -1, h = F.height * (F.size || 1);
      return {
        slot: F.slot, sd, x: gx - sd * L, x0: gx - sd * L, z: (W.rng() - 0.5) * zr, y: 0, vx: 0, vy: 0, vz: 0, kz: 0, h, r: F.radius, crouch: 0,
        az: 0, ay: gy + 1.2, avz: 0, avy: 0, hp: DUEL.HP, ammo: VR.mag, reload: 0, cool: F.bot ? 45 : 10, dead: 0, inv: 0,
        slide: 0, jl: 0, ch: 0, gl: 0,
        kills: 0, streak: 0, dealt: 0, hits: 0, shots: 0, heads: 0, flinch: 0,
        b: { tz: 0, t: 0, ox: 0, oy: 0, nt: 0, hide: 0, ch: 0, tx: gx - sd * L, xt: 0 },
      };
    };
    const p = [mk(A, 0), mk(V, 1)];
    p[0].az = p[1].z; p[1].az = p[0].z;
    // les abris : VR.covers par camp, entre les deux, un peu plus près de chacun que du milieu
    // (les snipers : plus loin devant, pour que la lunette voie par-dessus)
    const covers = [], cd = VR.scope ? L * 0.35 : Math.min(DUEL.COVER_D, L * 0.5), n = VR.covers;
    for (const P of p) for (let k = 0; k < n; k++) {
      const z = n === 1 ? (W.rng() - 0.5) * zr * 0.5 : ((k + 0.5) / n * 2 - 1) * zr * 0.75 + (W.rng() - 0.5) * 0.5;
      covers.push([P.x + P.sd * cd, z, clampN(P.h * DUEL.COVER_H, 0.8, 1.45), 3]);
    }
    return { vi, gx, gy, L, zr, p, covers, rk: [], over: 0, endT: 0, last: -1 };
  },

  step(W, M, g, ia, iv) {
    const VR = duelVar(g), ins = [ia, iv];
    const grav = VR.grav || DUEL.GRAV, jv = VR.jump || DUEL.JUMP;
    for (let i = 0; i < 2; i++) {
      const P = g.p[i], O = g.p[1 - i];
      const I = ins[i] || duelBot(W, g, i, W.fighters[P.slot].bot || 2);
      if (P.dead > 0) {
        if (P.y > 0) { P.vy -= grav; P.y = Math.max(0, P.y + P.vy / 60); } // abattu en plein saut : il retombe
        if (--P.dead === 0) {
          P.hp = DUEL.HP; P.ammo = VR.mag; P.reload = 0; P.inv = 24; P.y = 0; P.vy = 0; P.kz = 0; P.slide = 0; P.ch = 0; P.x = P.x0; P.vx = 0;
          O.cool = Math.max(O.cool, 18);
          P.z = (W.rng() - 0.5) * g.zr * 1.6; P.az = O.z; P.ay = g.gy + O.h * 0.75;
          W.emit('mgSpawn', { s: i });
        }
        continue;
      }
      if (P.inv > 0) P.inv--;
      if (P.flinch > 0) P.flinch--;
      // déplacement dans toutes les directions : bits MV_* (le stick gauche, ZQSD avec la souris), au clavier seul le stick ;
      // gauche / droite de son écran = -z / +z vu de p[0] (l'inverse vu de p[1]), haut = avancer vers l'autre (+x pour p[0])
      const kb = (I.held & DIGITAL) && !(I.held & MOUSE);
      const mv = kb ? (I.mx > 0.4 ? 1 : I.mx < -0.4 ? -1 : 0) : ((I.held & MV_R) ? 1 : 0) - ((I.held & MV_L) ? 1 : 0);
      const fw = kb ? (I.my > 0.4 ? 1 : I.my < -0.4 ? -1 : 0) : ((I.held & MV_U) ? 1 : 0) - ((I.held & MV_D) ? 1 : 0);
      const down = (I.held & BTN.GRAB) !== 0; // s'accroupir (en courant : glisser) : LB / RB, E, pavé 4
      const grounded = P.y <= 0 && P.vy <= 0;
      if (grounded) P.jl = (VR.jumps || 2) - 1;
      const spd = DUEL.SPEED * (VR.speed || 1) * (P.ch > 0 || duelScoped(VR, P) ? 0.5 : 1) * (P.crouch ? 0.45 : 1), dn = mv && fw ? Math.SQRT1_2 : 1;
      if (P.slide > 0) { P.slide--; P.vz *= 0.965; P.vx *= 0.965; if (!P.slide && grounded) W.emit('mgSlideEnd', { s: i }); }
      else { P.vz += (mv * dn * P.sd * spd - P.vz) * DUEL.ACC; P.vx += (fw * dn * P.sd * spd * 0.85 - P.vx) * DUEL.ACC; } // (démarrages et arrêts secs)
      const z0 = P.z, xa = P.x;
      let nz = clampN(P.z + (P.vz + P.kz) / 60, -g.zr, g.zr), nx = P.x + P.vx / 60;
      // le terrain : de 2,5 m derrière son départ jusqu'à un peu avant le milieu ; les abris debout ne se traversent pas
      const back = P.x0 - P.sd * 2.5, front = g.gx - P.sd * Math.max(1.2, g.L * 0.2);
      nx = P.sd > 0 ? clampN(nx, back, front) : clampN(nx, front, back);
      for (const c of g.covers) {
        if (c[3] <= 0 || Math.abs(nz - c[1]) >= DUEL.COVER_W + P.r * 0.6) continue;
        const lo = c[0] - 0.35, hi = c[0] + 0.35;
        if (xa <= lo && nx > lo) nx = lo; else if (xa >= hi && nx < hi) nx = hi;
        else if (nx > lo && nx < hi) nz = P.z; // (déjà dans l'épaisseur de l'abri : on ne glisse pas dedans par le côté)
      }
      P.z = nz; P.x = nx;
      P.kz *= 0.86; if (Math.abs(P.kz) < 0.05) P.kz = 0;
      P.az += P.z - z0; // on garde la direction du regard en se déplaçant
      // la glissade : s'accroupir en courant vite (on garde l'élan, tout bas, dans la direction de la course)
      const sp2 = P.vx * P.vx + P.vz * P.vz;
      if (grounded && down && !P.slide && !P.crouch && sp2 > DUEL.SLIDE_MIN * DUEL.SLIDE_MIN) {
        const k = Math.max(1, DUEL.SPEED * 1.25 / Math.sqrt(sp2));
        P.slide = DUEL.SLIDE; P.vz *= k; P.vx *= k;
        W.emit('mgSlide', { s: i });
      }
      // sauts : au sol, puis en l'air (double saut, triple sur la Lune)
      if (I.pressed & BTN.JUMP) {
        if (grounded) { P.vy = jv; P.slide = 0; W.emit('mgJump', { s: i }); }
        else if (P.jl > 0) { P.jl--; P.vy = jv * 0.92; W.emit('mgJump', { s: i, air: 1 }); }
      }
      if (P.y > 0 || P.vy > 0) {
        P.vy -= grav;
        P.y += P.vy / 60;
        if (P.y <= 0) { P.y = 0; if (P.vy < -6) W.emit('mgLand', { s: i }); P.vy = 0; }
      }
      P.crouch = P.y <= 0 && (down || P.slide > 0) ? 1 : 0;
      // viseur (en chargeant le railgun, à la lunette : on zoome, la visée ralentit ; à la lunette le réticule tangue)
      const scoped = duelScoped(VR, P), zoom = scoped ? 0.3 : P.ch > 0 ? 0.45 : 1;
      if (scoped && VR.sway) { const k = VR.sway * (P.crouch ? 0.5 : 1); P.az += DMath.sin(M.t * 0.045 + i * 2.1) * k * 0.06; P.ay += DMath.cos(M.t * 0.062 + i) * k * 0.05; }
      if (I.held & MOUSE) { P.az += P.sd * I.mx * 0.36 * zoom; P.ay += I.my * 0.36 * zoom; P.avz = P.avy = 0; }
      else if (kb) {
        // (au clavier seul le viseur suit l'autre : au corps, à la tête en tenant Shift / pavé 3)
        const hd = duelHead(g, O), ty = (I.held & BTN.SHIELD) ? hd[1] : Math.max(g.gy + O.y + 0.25, hd[1] - hd[2] * 2.2);
        const v = DUEL.KB_AIM / 60 * (P.ch > 0 ? 0.7 : 1);
        P.az += clampN(hd[0] - P.az, -v, v); P.ay += clampN(ty - P.ay, -v, v);
        P.avz = P.avy = 0;
      } else {
        const hd = duelHead(g, O), near = O.dead <= 0 && Math.abs(P.az - hd[0]) < 0.8 && Math.abs(P.ay - hd[1]) < 0.8;
        // (nerveux : vite, presque sans inertie ; un peu plus doux près de la tête pour finir la visée)
        const k = (near ? 9 : 17) * zoom, s = (v) => v * Math.abs(v) * 0.5 + v * 0.5;
        P.avz += (s(I.mx) * k * P.sd - P.avz) * 0.55; P.avy += (s(I.my) * k - P.avy) * 0.55;
        P.az += P.avz / 60; P.ay += P.avy / 60;
      }
      P.az = clampN(P.az, -g.zr - 4, g.zr + 4); P.ay = clampN(P.ay, g.gy - 0.5, g.gy + 4.5);
      // l'arme : A ou gâchette ; auto (on tient), charge (on tient puis on lâche), sinon un coup par appui
      if (P.cool > 0) P.cool--;
      if (P.reload > 0 && --P.reload === 0) { P.ammo = VR.mag; W.emit('mgReloaded', { s: i }); }
      // recharger : X (K, pavé 2) ; tirer : A ou gâchette (au clavier seul, A : Shift y vise la tête)
      if ((I.pressed & BTN.X) && !P.reload && P.ammo < VR.mag) { P.reload = VR.reload; P.ch = 0; W.emit('mgReload', { s: i }); }
      const FIRE = kb ? BTN.A : BTN.A | BTN.SHIELD, ready = P.cool <= 0 && !P.reload && !g.endT;
      if (VR.charge || VR.scope === 'hold') {
        // on tient (charge du railgun, ou lunette de l'AWP), on lâche : le tir (pw : la charge, ou la stabilité à la lunette)
        if ((I.held & FIRE) && ready && P.ammo > 0) { if (++P.ch === 1) W.emit(VR.charge ? 'mgCharge' : 'mgScope', { s: i }); P.ch = Math.min(VR.charge || 90, P.ch); }
        else if (P.ch > 0) { const pw = VR.charge ? P.ch / VR.charge : Math.min(1, P.ch / 16); P.ch = 0; if (ready && P.ammo > 0) duelShoot(W, M, g, i, pw); }
      } else if ((VR.auto ? (I.held & FIRE) : (I.pressed & FIRE)) && ready) {
        if (P.ammo > 0) duelShoot(W, M, g, i, 1);
        else if (I.pressed & FIRE) { P.reload = VR.reload; W.emit('mgReload', { s: i, dry: 1 }); }
      }
      if (P.ammo === 0 && !P.reload) { P.reload = VR.reload; W.emit('mgReload', { s: i }); }
    }
    if (VR.rocket) stepRockets(W, M, g, VR);
    if (g.endT && --g.endT <= 0) g.over = 1;
  },

  result(W, M, g) {
    const [a, b] = g.p;
    let w = -1;
    if (a.kills !== b.kills) w = a.kills > b.kills ? 0 : 1;
    else if (a.dealt !== b.dealt) w = a.dealt > b.dealt ? 0 : 1;
    if (w < 0) return payout(W, -1, -1, 0, { ka: a.kills, kv: b.kills });
    return payout(W, g.p[w].slot, g.p[1 - w].slot, W.rng.int(40, 80), { ka: a.kills, kv: b.kills, kbb: 26, kbg: 220 });
  },
};

// les yeux d'un tireur (sa caméra) : [x, y, z]
export function duelEye(g, P) { return [P.x, g.gy + P.y + P.h * (P.crouch ? DUEL.EYE_C : DUEL.EYE), P.z]; }
// la tête d'un tireur : [z, y, rayon]
export function duelHead(g, P) {
  const hgt = P.h * (P.crouch ? DUEL.CROUCH : 1);
  return [P.z, g.gy + P.y + hgt - P.h * DUEL.HEAD, P.h * DUEL.HEAD + 0.05];
}

// une balle (ou un plomb) tirée des yeux de S vers (az, ay) sur le plan de T : le premier abri traversé, sinon la tête
// ou le corps de T, sinon rien
function trace(g, S, T, E, az, ay) {
  const span = T.x - S.x;
  let best = null, bt = 2;
  for (const c of g.covers) {
    if (c[3] <= 0) continue;
    const t = (c[0] - E[0]) / span;
    if (t <= 0 || t >= 1 || t >= bt) continue;
    const zc = E[2] + (az - E[2]) * t, yc = E[1] + (ay - E[1]) * t;
    if (Math.abs(zc - c[1]) < DUEL.COVER_W && yc < g.gy + c[2] && yc > g.gy - 0.3) { best = { r: 'cover', c, x: c[0], y: yc, z: zc }; bt = t; }
  }
  if (best) return best;
  if (T.dead > 0 || T.inv > 0) return { r: 'miss', x: T.x + S.sd * 3, y: ay, z: az };
  const hd = duelHead(g, T), dz = az - hd[0], dy = ay - hd[1];
  if (dz * dz + dy * dy <= hd[2] * hd[2]) return { r: 'head', x: T.x, y: ay, z: az };
  if (Math.abs(dz) < T.r * 0.9 && ay > g.gy + T.y && ay < hd[1] - hd[2] * 0.6) return { r: 'body', x: T.x, y: ay, z: az };
  return { r: 'miss', x: T.x + S.sd * 3, y: ay, z: az };
}

const RANK = { miss: 0, cover: 1, body: 2, head: 3 };

function duelShoot(W, M, g, i, pw) {
  const VR = duelVar(g), S = g.p[i], T = g.p[1 - i];
  S.ammo--; S.cool = VR.cool; S.shots++; S.gl = 1 - S.gl;
  const E = duelEye(g, S), az = S.az, ay = S.ay;
  // recul (l'akimbo grimpe à chaque balle, le pompe secoue fort)
  S.ay += (VR.climb ?? (VR.pellets ? 0.35 : 0.2)) + (W.rng() - 0.5) * 0.08; S.az += (W.rng() - 0.5) * (VR.climb ? 0.05 : 0.12) * S.sd;
  if (VR.rocket) {
    // une roquette part des yeux vers le viseur, sur le plan de l'autre ; lente : on l'évite en bougeant
    const dx = T.x - E[0], dy = ay - (E[1] - 0.15), dz = az - E[2], n = DMath.hypot(dx, DMath.hypot(dy, dz)) || 1, v = VR.rocket.v / n;
    if (g.rk.length >= DUEL.MAX_RK) g.rk.shift();
    g.rk.push([E[0] + S.sd * 0.5, E[1] - 0.15, E[2], dx * v, dy * v, dz * v, i, 120]);
    W.emit('mgShot', { s: i, r: 'rocket', x: E[0], y: E[1], z: E[2] });
    return;
  }
  // un ou plusieurs plombs, dispersés ; les dégâts s'additionnent, un abri ne perd qu'une vie par tir
  const n = VR.pellets || 1, sp = (VR.spread || 0) + (VR.scope === 'hold' ? (1 - pw) * 0.8 : 0); // (l'AWP sans lunette)
  let dmg = 0, best = null, hit = 0, head = false, cover = null, hz = 0;
  for (let k = 0; k < n; k++) {
    const oz = sp ? (W.rng() - 0.5) * 2 * sp : 0, oy = sp ? (W.rng() - 0.5) * 2 * sp : 0;
    const r = trace(g, S, T, E, az + oz, ay + oy);
    if (!best || RANK[r.r] > RANK[best.r]) best = r;
    if (r.r === 'cover') cover = r.c;
    else if (r.r === 'head' || r.r === 'body') {
      hit++; hz += r.z;
      if (r.r === 'head') head = true;
      const d0 = r.r === 'head' ? VR.head : W.rng.int(VR.dmg[0], VR.dmg[1]);
      dmg += VR.charge ? Math.round(r.r === 'head' && pw < 0.5 ? 60 : r.r === 'head' ? d0 : VR.dmg[0] + (VR.dmg[1] - VR.dmg[0]) * pw) : d0;
    }
  }
  if (cover) cover[3]--;
  if (!dmg) { W.emit('mgShot', { s: i, r: best.r === 'head' || best.r === 'body' ? 'miss' : best.r, x: best.x, y: best.y, z: best.z, b: cover ? cover[3] : 0, n, pw }); return; }
  S.hits++; S.dealt += Math.min(dmg, T.hp); T.hp -= dmg; T.flinch = 12;
  if (head) S.heads++;
  // le pompe pousse sur le côté (loin du centre de la gerbe)
  if (VR.push) { const side = T.z - hz / hit; T.kz += (side > 0.02 ? 1 : side < -0.02 ? -1 : W.rng() < 0.5 ? 1 : -1) * VR.push; }
  W.emit('mgShot', { s: i, r: head ? 'head' : 'body', d: dmg, x: T.x, y: best.y, z: best.z, n, k: hit, pw });
  hurt(W, g, i, head);
}

// T vient de perdre des PV (balle ou souffle) : abattu ?
function hurt(W, g, i, head) {
  const VR = duelVar(g), S = g.p[i], T = g.p[1 - i];
  if (T.hp > 0) return;
  T.hp = 0; T.dead = DUEL.DEAD; T.streak = 0; T.kz = 0;
  S.kills++; S.streak++;
  g.last = i;
  W.emit('mgKill', { k: i, v: 1 - i, head: head ? 1 : 0, n: S.kills, streak: S.streak, air: S.y > 0.3 ? 1 : 0 });
  if (S.kills >= VR.kills) g.endT = 60;
}

// les roquettes : elles volent, s'écrasent sur un abri ou sur le plan de l'autre, et soufflent (dégâts et projection
// selon la distance au centre du corps)
function stepRockets(W, M, g, VR) {
  const R = VR.rocket;
  for (let k = g.rk.length - 1; k >= 0; k--) {
    const r = g.rk[k], S = g.p[r[6]], T = g.p[1 - r[6]];
    const x0 = r[0];
    r[0] += r[3] / 60; r[1] += r[4] / 60; r[2] += r[5] / 60; r[7]--;
    let at = null;
    for (const c of g.covers) {
      if (c[3] <= 0 || (x0 - c[0]) * (r[0] - c[0]) > 0) continue;
      if (Math.abs(r[2] - c[1]) < DUEL.COVER_W && r[1] < g.gy + c[2] && r[1] > g.gy - 0.3) { at = c; break; }
    }
    const reached = (r[0] - T.x) * S.sd >= 0, low = r[1] < g.gy - 0.2;
    if (!at && !reached && !low && r[7] > 0) continue;
    g.rk.splice(k, 1);
    if (at) at[3] = Math.max(0, at[3] - 2);
    const bx = r[0], by = Math.max(g.gy, r[1]), bz = r[2];
    W.emit('mgBoom', { s: r[6], x: bx, y: by, z: bz, c: at ? 1 : 0 });
    if (at || T.dead > 0 || T.inv > 0) continue;
    const cy = g.gy + T.y + T.h * 0.5, d = DMath.hypot(T.z - bz, cy - by);
    if (d >= R.r) continue;
    const f = 1 - d / R.r, dmg = Math.round(R.dmg * (d < 0.45 ? 1 : 0.35 + 0.65 * f));
    S.hits++; S.dealt += Math.min(dmg, T.hp); T.hp -= dmg; T.flinch = 14;
    T.kz += (T.z - bz > 0 ? 1 : -1) * R.kz * f; T.vy = Math.max(T.vy, R.ky * f); if (T.vy > 0 && T.y <= 0) T.y = 0.01;
    W.emit('mgShot', { s: r[6], r: 'body', d: dmg, x: T.x, y: cy, z: T.z, splash: 1 });
    hurt(W, g, r[6], false);
  }
}

// CPU tireur : vise la tête (ou la tombe qui la cache), tire quand c'est aligné (tient la rafale, charge le railgun,
// mène les roquettes), se déplace d'un abri à l'autre, glisse et saute de temps en temps
function duelBot(W, g, i, lvl) {
  const VR = duelVar(g), P = g.p[i], O = g.p[1 - i], b = P.b;
  const I = { mx: 0, my: 0, held: 0, pressed: 0 };
  // (un humain met un moment à trouver sa cible : le CPU vise surtout le torse, avec du tremblement)
  if (--b.nt <= 0) {
    const err = ([0.7, 0.45, 0.25][lvl - 1] || 0.45) * (VR.pellets ? 0.6 : 1);
    b.ox = (W.rng() - 0.5) * err; b.oy = (W.rng() - 0.5) * err - (W.rng() < [0.85, 0.65, 0.4][lvl - 1] ? O.h * 0.3 : 0);
    b.nt = 18 + (W.rng() * 22 | 0);
  }
  if (--b.t <= 0) {
    const mine = g.covers.filter((c) => c[3] > 0 && Math.abs(c[0] - P.x) < DUEL.COVER_D + 0.5);
    b.tz = mine.length && W.rng() < 0.55 ? mine[(W.rng() * mine.length) | 0][1] : (W.rng() * 2 - 1) * g.zr;
    b.t = 30 + (W.rng() * 50 | 0); b.hide = W.rng() < 0.35;
  }
  // il avance ou recule de temps en temps (vers son abri, ou à découvert pour presser l'autre)
  if (--b.xt <= 0) { b.tx = P.x0 + P.sd * (W.rng() < 0.5 ? 0 : (W.rng() * 2.4 - 0.6)); b.xt = 60 + (W.rng() * 90 | 0); }
  const dx = (b.tx - P.x) * P.sd;
  if (Math.abs(dx) > 0.3) I.held |= dx > 0 ? MV_U : MV_D;
  const dz = b.tz - P.z;
  if (Math.abs(dz) > 0.2) { I.held |= (dz * P.sd > 0 ? MV_R : MV_L); if (Math.abs(dz) > 1.5 && W.rng() < 0.01 * lvl) I.held |= BTN.GRAB; }
  else if (b.hide || P.reload) I.held |= BTN.GRAB;
  if (W.rng() < (VR.grav ? 0.01 : 0.006) * lvl) I.pressed |= BTN.JUMP;
  // une roquette arrive sur moi : sauter
  for (const r of g.rk) if (r[6] !== i && Math.abs(r[0] - P.x) < 3 && Math.abs(r[2] - P.z) < 1.2 && W.rng() < 0.08 * lvl) I.pressed |= BTN.JUMP;
  if (O.dead > 0) return I;
  const hd = duelHead(g, O), lead = VR.rocket ? (Math.abs(O.x - P.x) / VR.rocket.v) * 0.6 : 0.05 * lvl;
  const tz = hd[0] + b.ox + O.vz * lead, ty = hd[1] + b.oy + (O.y > 0 ? O.vy * lead * 0.6 : 0) - (VR.rocket ? O.h * 0.35 : 0);
  const ez = (tz - P.az) * P.sd, ey = ty - P.ay, gain = [0.7, 1.05, 1.7][lvl - 1] || 1.05;
  I.mx = clampN(ez * gain, -1, 1); I.my = clampN(ey * gain, -1, 1);
  const tol = (VR.pellets ? 0.45 : VR.auto ? 0.35 : VR.scope ? 0.16 : 0.22) * (VR.grav ? 1.7 : 1), aligned = Math.abs(tz - P.az) < tol && Math.abs(ey) < tol;
  if (VR.charge || VR.scope === 'hold') {
    // charge (ou lunette) en visant, lâche une fois assez chargé (stable) et aligné (plus ou moins patient selon le niveau)
    if (P.ch > 0 || (aligned && W.rng() < 0.2)) I.held |= BTN.A;
    if (P.ch >= (VR.charge ? VR.charge * [0.55, 0.75, 0.95][lvl - 1] : [10, 16, 24][lvl - 1]) && aligned) I.held &= ~BTN.A;
  } else if (VR.auto) { if (aligned && W.rng() < [0.5, 0.75, 0.95][lvl - 1]) I.held |= BTN.A; }
  else if (aligned && P.cool <= 0 && W.rng() < [0.04, 0.08, 0.16][lvl - 1] * (VR.pellets || VR.rocket ? 1.6 : 1)) I.pressed |= BTN.A;
  return I;
}
