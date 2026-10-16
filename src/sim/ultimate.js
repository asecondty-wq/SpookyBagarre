// Ultimes, comme les Final Smash de Smash Ultimate : une jauge qui se remplit en donnant et en recevant des coups ;
// pleine, A + X ensemble la déclenche. Le match se fige (comme un mini-jeu), la scène s'affiche (src/render/ultimate.js),
// puis le coup part : ceux qui sont dans sa zone sont attrapés et subissent la frappe cinématique ; les autres, rien.
// Tout est dans la simulation (déterministe, rollback) : l'état est `W.ult` (dans WORLD_KEYS) et `F.ult` (la jauge).
// Chaque perso décrit son ultime dans sa fiche (`ult: {...}`, voir anbuu.js) : nom, couleurs, zone, coups, derniers coups.
import { ULT_MAX } from './constants.js';
import { CHARS } from './chars/index.js';
import { startMove, setState, releaseGrab } from './fighter.js';
import { DMath } from './dmath.js';
import { faceOf } from './util.js';

export { ULT_MAX };

// Réglages de la jauge (à la Smash Ultimate : donner ET recevoir la remplit, la jauge se vide au KO et à l'usage).
// Plus lente qu'avant (16 oct. 2026) et qui avantage celui qui encaisse, comme Smash Ultimate : un % reçu charge 1,8 fois plus qu'un % infligé.
// Jauge pleine : ~360 % infligés ou ~200 % reçus (un échange à parts égales de 150 % chacun : 42 + 75 = 117).
export const ULT_TUNE = { dealt: 0.28, taken: 0.5, perHit: 14 };

const def = (F) => CHARS[F.char];
export const ultDef = (F) => (F && CHARS[F.char] ? CHARS[F.char].ult || null : null);
const sideOf = (F) => (DMath.sin(F.facing) < 0 ? -1 : 1);

// la jauge d'un combattant en %, pour l'affichage (0 si son perso n'a pas d'ultime)
export const ultFrac = (F) => (ultDef(F) ? Math.min(1, F.ult / ULT_MAX) : 0);

// un coup (dégâts réels) : celui qui frappe et celui qui est frappé chargent leur jauge
export function ultCharge(W, A, V, dmg) {
  if (W.rules.ult === false || W.ult || W.phase !== 'play' || !(dmg > 0)) return;
  const rate = W.rules.ultRate ?? 1;
  const give = (F, k) => {
    if (!F || F.out || !ultDef(F) || F.ult >= ULT_MAX) return;
    const was = F.ult;
    F.ult = Math.min(ULT_MAX, F.ult + Math.min(ULT_TUNE.perHit, dmg) * k * rate);
    if (was < ULT_MAX && F.ult >= ULT_MAX) W.emit('ultReady', { s: F.slot, x: F.x, y: F.y, z: F.z });
  };
  if (A && A !== V) give(A, ULT_TUNE.dealt);
  give(V, ULT_TUNE.taken);
}

export function canStartUlt(F, W) {
  return W.rules.ult !== false && !W.ult && W.phase === 'play' && !F.out && !!ultDef(F) && F.ult >= ULT_MAX;
}

export function startUltimate(F, W) {
  if (!canStartUlt(F, W)) return false;
  const U = ultDef(F);
  F.bufA = 0; F.bufX = 0; F.bufJ = 0; F.bufS = 0; F.bufG = 0;
  if (F.grabbing >= 0) releaseGrab(F, W);
  F.ult = 0;
  startMove(F, W, U.moves[0], { keepFacing: true });
  F.vx = F.vy = F.vz = F.kx = F.ky = F.kz = 0;
  const dir = sideOf(F);
  W.ult = { slot: F.slot, t: 0, ph: 0, c: 0, dir, victims: [], x: F.x, y: F.y };
  W.emit('ultStart', { s: F.slot, x: F.x, y: F.y, z: F.z, dir });
  return true;
}

// qui est dans la zone devant le lanceur
function inReach(F, V, U, dir) {
  if (V === F || V.out || V.state === 'dead' || V.state === 'respawn') return false;
  // comme dans Smash Ultimate : rien ne se verrouille tout seul. Le rayon part tout droit devant le lanceur, à hauteur de poitrine ;
  // il faut que l'adversaire soit dans cette bande (U.aim : écart de hauteur des pieds, en m) et devant, pas derrière ni sur une autre plateforme
  const dy = V.y - F.y;
  return (V.x - F.x) * dir > -0.4 && Math.abs(V.x - F.x) <= U.reach && dy >= U.aim[0] && dy <= U.aim[1];
}

function endUlt(W, F) {
  const U = ultDef(F);
  F.move = null; F.mf = 0; F.va[0] = 0; F.mv = {};
  setState(F, F.grounded ? 'idle' : 'air');
  F.invuln = Math.max(F.invuln, 10);
  W.emit('ultEnd', { s: F.slot, hit: W.ult.victims.length, x: F.x, y: F.y, z: F.z, id: U.id });
  W.ult = null;
}

// une image de l'ultime (le reste du match est figé : World.step)
export function stepUlt(W) {
  const u = W.ult, F = W.fighters[u.slot];
  if (!F || F.out || !ultDef(F)) { W.ult = null; return; }
  const U = ultDef(F), t = ++u.t, dir = u.dir;
  F.vx = F.vy = F.vz = F.kx = F.ky = F.kz = 0; F.hitlag = 0; F.mf++; F.st++; F.va[0] = 1;
  const foes = u.victims.map((s) => W.fighters[s]);
  const place = (V, i) => {
    const m = W.stage.main();
    let tx = F.x + dir * (U.hold[0] + U.hold[1] * i);
    tx = Math.max(m.cx - m.r - 6, Math.min(m.cx + m.r + 6, tx));
    const ty = F.y + U.hold[2] + U.hold[3] * i;
    V.x += (tx - V.x) * 0.32; V.y += (ty - V.y) * 0.32; V.z = 0;
    V.vx = V.vy = V.vz = V.kx = V.ky = V.kz = 0; V.hitlag = 0; V.hitstun = 999; V.facing = faceOf(-dir);
  };

  // 1. l'entrée en scène : pose dramatique, la caméra se rapproche
  if (u.ph === 0 && t >= U.intro) {
    // 2. le coup part : la zone devant, ceux qui y sont sont attrapés dans la lumière
    u.ph = 1; F.move = U.moves[1]; F.mf = 0;
    for (const V of W.list) {
      if (W.rules.teams && V.team === F.team) continue;
      if (!inReach(F, V, U, dir)) continue;
      if (V.grabbing >= 0) releaseGrab(V, W);
      if (V.grabbedBy >= 0) { const G = W.fighters[V.grabbedBy]; if (G && G.grabbing === V.slot) { G.grabbing = -1; if (G.state === 'grabbing') setState(G, 'idle'); } V.grabbedBy = -1; }
      V.move = null; V.pendingLaunch = null; V.carryT = 0; V.carryBy = -1;
      setState(V, 'hitstun'); V.hitstun = 999; V.launchKb = 0; V.shieldStun = 0;
      u.victims.push(V.slot);
    }
    W.emit('ultStrike', { s: F.slot, x: F.x, y: F.y, z: F.z, dir, n: u.victims.length, reach: U.reach });
    return;
  }
  if (u.ph === 1) {
    foes.forEach(place);
    if (t >= U.intro + U.strike) {
      if (foes.length) { u.ph = 2; u.c = 0; F.move = U.moves[2]; F.mf = 0; W.emit('ultCine', { s: F.slot, x: F.x, y: F.y, z: F.z, dir, n: foes.length }); }
      else { u.ph = 3; }
    }
    return;
  }
  if (u.ph === 3) { if (t >= U.intro + U.strike + U.whiff) endUlt(W, F); return; }
  if (u.ph === 2) {
    const c = ++u.c;
    foes.forEach(place);
    if (c % U.every === 3) {
      const n = Math.floor(c / U.every), last = n >= U.notes - 1;
      foes.forEach((V) => {
        if (last) {
          // la dernière note : un vrai coup (dégâts, éjection, sang, KO) par la même mécanique que les autres
          W.applyHit({ owner: F.slot, key: 'ult' + F.slot + ':' + W.tick, x: V.x, y: V.y + 1, z: 0, r: 0.5, ...U.final, dir: dir * Math.PI / 2, dirAngle: dir * Math.PI / 2,
            ox: F.x, oz: 0, hitlag: 1.6, sfx: 'boom', blood: 2, smash: true, charge: 1, move: 'ult', fx: 'light', hitsOwner: false, unblockable: true }, V);
        } else {
          V.damage = Math.min(999, V.damage + U.noteDmg); V.stats.taken += U.noteDmg; F.stats.dealt += U.noteDmg;
          V.bloodied = Math.min(1, V.bloodied + U.noteDmg / 120); V.lastHitBy = F.slot; V.lastHitTick = W.tick;
        }
        W.emit('ultHit', { s: V.slot, a: F.slot, n, last: last ? 1 : 0, x: V.x, y: V.y + 1, z: 0, d: last ? U.final.dmg : U.noteDmg, dir });
      });
      if (last) { W.slow(46, 0.28); endUlt(W, F); }
    }
  }
}

// un CPU qui a sa jauge pleine la lance quand un adversaire est dans la zone, devant lui (un tirage par image : pas de hasard)
export function botUlt(F, W, I) {
  if (!canStartUlt(F, W) || F.state === 'hitstun' || F.state === 'move' || W.tick % 9 !== 0) return I;
  const U = ultDef(F), dir = sideOf(F);
  for (const V of W.list) {
    if (V.slot !== F.slot && !(W.rules.teams && V.team === F.team) && inReach(F, V, U, dir) && Math.abs(V.x - F.x) > 1.2) {
      return { ...I, held: I.held | 3, pressed: I.pressed | 3 };
    }
  }
  return I;
}
