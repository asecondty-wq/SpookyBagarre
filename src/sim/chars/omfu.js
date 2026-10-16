// OMFU : le catcheur DJ. Lourd et très puissant : des crochets, le plat ventre, l'uppercut, la prise de catch où il
// promène l'ennemi au-dessus de sa tête, les platines (ondes sonores, trampoline), et il s'enterre.
import { normals, dashAttack, hb, ring } from '../kit.js';
import { startMove, endMove, setState } from '../fighter.js';
import { steerX } from './recovery.js';
import { localToWorld } from '../util.js';
import { DMath } from '../dmath.js';

const LEFT = -Math.PI / 2, RIGHT = Math.PI / 2;

// the one he holds over his head (the wrestler's grab): carried there, let go (dropped in front) if it is not held
function holdUp(F, W, at = [0, 2.0, 0.15]) {
  const V = W.fighters[F.mv.victim];
  if (!V || V.grabbedBy !== F.slot || V.state !== 'grabbed') return null;
  const p = localToWorld(F, at);
  V.x = p[0]; V.y = p[1]; V.z = 0; V.vx = V.vy = 0; V.facing = F.facing + Math.PI;
  V.lifted = at[1] > 1.6 ? 1 : 0; // held up flat over his head (the rig lays it down on his hands)
  return V;
}
function letGo(F, W, V) {
  F.grabbing = -1;
  if (!V) return;
  V.grabbedBy = -1; V.lifted = 0;
  if (V.state === 'grabbed') setState(V, 'air');
  V.grounded = false;
}

const moves = {
  ...normals({ power: 1.16, reach: 1.06, speed: 0.86, sfxS: 'punchHeavy', sfxM: 'punchHeavy', sfxL: 'punchHeavy', smashLunge: 0.7 }),
  // A while running: its own dash attack
  dashattack: dashAttack({ pose: 'shoulder', boost: 10, fric: 20, dur: 38, iasa: 34, hits: [hb(7, 11, [0, 1.1, 0.9], 0.95, 13, 38, 50, 80, { sfx: 'punchHeavy', blood: 1.6, hitlag: 1.15 })] }),

  // neutral A: two heavy hooks (slow, they reach); the second sends a fair way
  jab1: {
    dur: 26, iasa: 22, next: 'jab2', nextWin: [10, 25], pose: 'jab1', combo: true,
    vel: [{ f: [5, 8], fwd: 2.5 }],
    hits: [hb(8, 10, [0, 1.25, 0.95], 0.62, 6, 35, 20, 40, { sfx: 'punchHeavy', blood: 1.1, hitlag: 1.1 })],
  },
  jab2: {
    dur: 38, iasa: 34, pose: 'jab3',
    vel: [{ f: [9, 13], fwd: 3.5 }],
    hits: [hb(13, 16, [0, 1.05, 1.0], 0.72, 9.5, 40, 48, 80, { sfx: 'punchHeavy', blood: 1.6, hitlag: 1.25 })],
  },
  // side smash: he lets himself fall flat on his belly onto the foe (slow, huge)
  smash: {
    dur: 62, charge: { at: 10, max: 60 }, pose: 'smash', tilt: 'ftilt',
    vel: [{ f: [12, 18], fwd: 3 }],
    onFrame(F, W, f) { if (f === 20) W.emit('quake', { x: F.x + DMath.sin(F.facing) * 1.1, y: F.y, z: 0, k: 0.45 }); },
    hits: [
      hb(19, 23, [0, 0.4, 1.2], 0.8, 21, 40, 46, 104, { sfx: 'punchHeavy', blood: 2.6, hitlag: 1.35 }),
      hb(19, 22, [0, 0.45, 0.4], 0.65, 16, 42, 38, 94, { sfx: 'punchHeavy', blood: 1.8, grp: 0 }),
    ],
  },
  // up smash: a huge jumping uppercut
  usmash: {
    dur: 48, charge: { at: 6, max: 60 }, pose: 'usmash', tilt: 'utilt',
    hits: [
      hb(10, 14, [0, 2.25, 0.35], 0.8, 18, 86, 40, 100, { sfx: 'punchHeavy', blood: 2.2, dir: 'radial', hitlag: 1.2 }),
      hb(9, 11, [0, 1.3, 0.55], 0.65, 12, 80, 32, 86, { sfx: 'punchHeavy', blood: 1.2, grp: 0, dir: 'radial' }),
    ],
  },
  // down smash: a stomp; the floor shakes a little around his foot (it sends a little)
  dsmash: {
    dur: 46, charge: { at: 5, max: 60 }, pose: 'drum', tilt: 'dtilt',
    onFrame(F, W, f) {
      if (f === 10) {
        ring(W, F, { r: 0.4, grow: 9, life: 12, dmg: 9, ang: 70, kbb: 30, kbg: 50, w: 0.6, h: 0.8, look: 'shock', sfx: 'quake', blood: 0.4 });
        W.emit('quake', { x: F.x + DMath.sin(F.facing) * 0.4, y: F.y, z: 0, k: 0.35 });
      }
    },
    hits: [hb(9, 12, [0, 0.25, 0.45], 0.62, 12, 74, 32, 58, { sfx: 'punchHeavy', blood: 1.4, dir: 'radial' })],
  },

  // Prise de catch : il attrape l'ennemi et le soulève au-dessus de sa tête ; il marche avec. A : une grosse claque
  // (ça éjecte un peu) ; A + gauche / droite : il se laisse tomber dessus de tout son poids (plus de dégâts, moins loin)
  sp_n: {
    dur: 30, iasa: 26, pose: 'grab', groundOnly: true,
    hits: [hb(6, 10, [0, 1.0, 0.75], 0.62, 0, 0, 0, 0, { effect: 'grab',
      onHit: (V, W, hv) => { const A = W.fighters[hv.owner]; startMove(A, W, 'omCarry', { victim: V.slot, keepFacing: true }); setState(V, 'grabbed'); V.grabbedBy = A.slot; } })],
  },
  omCarry: {
    dur: 240, pose: 'grab', noCd: true,
    onStart(F, W) { W.emit('omLift', { s: F.slot, x: F.x, y: F.y + 2, z: 0 }); },
    onFrame(F, W, f) {
      const V = holdUp(F, W, f < 8 ? [0, 1.0 + f * 0.13, 0.6 - f * 0.05] : [0, 2.0, 0.15]);
      if (!V) { endMove(F, W); return; }
      // he walks with it (slowly)
      if (F.grounded) { F.vx = Math.abs(F.mx) > 0.25 ? F.mx * 3.2 : F.vx * 0.7; if (Math.abs(F.mx) > 0.25) F.facing = F.mx < 0 ? LEFT : RIGHT; }
      if (f < 10) return;
      const go = F.bufA > 0 || F.bufG > 0;
      if (go || V.mv.escape <= 0 || f >= 230) {
        F.bufA = 0; F.bufG = 0;
        if (V.mv.escape <= 0) { letGo(F, W, V); V.vx = DMath.sin(F.facing) * 5; V.vy = 6; W.emit('grabBreak', { a: F.slot, v: V.slot }); endMove(F, W); return; }
        const side = Math.abs(F.mx) > 0.5;
        if (side) F.facing = F.mx < 0 ? LEFT : RIGHT;
        startMove(F, W, side ? 'omSlam' : 'omSlap', { victim: V.slot, keepFacing: true });
      }
    },
    onEnd(F, W) { const V = W && W.fighters[F.mv.victim]; if (V && V.grabbedBy === F.slot && F.move === 'omCarry') letGo(F, W, V); },
  },
  // the slap out of the hold: it sends a little
  omSlap: {
    dur: 30, iasa: 26, pose: 'smash', noCd: true,
    onFrame(F, W, f) {
      const V = f < 7 ? holdUp(F, W, [0, 2.0 - f * 0.12, 0.15 + f * 0.08]) : null;
      if (f === 7) {
        const W2 = W.fighters[F.mv.victim];
        if (W2 && W2.grabbedBy === F.slot) {
          letGo(F, W, W2);
          const p = localToWorld(F, [0, 1.15, 0.8]); W2.x = p[0]; W2.y = p[1] - 1;
          W.hitDirect(F, W2, { dmg: 10, ang: 40, kbb: 46, kbg: 62, sfx: 'slap', blood: 1.6, hitlag: 1.3, fx: 'slap', move: 'sp_n' });
        }
      }
      return V;
    },
  },
  // the body slam: he jumps and falls on it with all his weight (more damage, it does not go far)
  omSlam: {
    dur: 50, iasa: 46, pose: 'bellyflop', noCd: true,
    onFrame(F, W, f) {
      if (f < 9) holdUp(F, W, [0, 2.0 - f * 0.18, 0.15 + f * 0.1]);
      if (f === 9) {
        const V = W.fighters[F.mv.victim];
        if (V && V.grabbedBy === F.slot) {
          letGo(F, W, V);
          const p = localToWorld(F, [0, 0, 0.9]); V.x = p[0]; V.y = F.y;
          W.hitDirect(F, V, { dmg: 15, ang: 75, kbb: 28, kbg: 36, sfx: 'punchHeavy', blood: 2.4, hitlag: 1.5, move: 'sp_n' });
          W.emit('quake', { x: V.x, y: V.y, z: 0, k: 0.55 });
        }
      }
    },
  },

  // Scratch-onde : il pose ses platines et scratche, trois ondes sonores partent autour de lui
  sp_s: {
    dur: 58, iasa: 54, pose: 'grate', airCtrl: 0.3,
    onFrame(F, W, f) {
      F.va[5] = f >= 4 && f <= 50 ? 1 : 0;
      if ((f === 12 || f === 24 || f === 36) && F.grounded) {
        const n = (f - 12) / 12;
        ring(W, F, { r: 0.6, grow: 10 + n * 3, life: 22 + n * 4, dmg: [3, 4, 7][n], ang: 70, kbb: [20, 26, 44][n], kbg: [24, 34, 74][n], w: 0.7, h: 1.4, look: 'sound', sfx: 'scratch', blood: 0.2 });
        W.emit('sfx', { s: F.slot, n: 'vinylScratch' });
      }
    },
    onEnd(F) { F.va[5] = 0; },
  },

  // Sous terre : il s'enterre, seule sa tête dépasse ; intouchable, il se déplace. A : il ressort d'un coup (quelques
  // dégâts, ça éjecte un peu). 3 s au plus sous terre.
  sp_d: {
    dur: 200, pose: 'grate', groundOnly: true,
    onStart(F, W) { F.mv.t = 0; W.emit('omDig', { s: F.slot, x: F.x, y: F.y, z: 0 }); },
    onFrame(F, W, f) {
      F.va[6] = Math.min(1, f / 12);
      if (f >= 8) { F.buried = 1; F.intangible = Math.max(F.intangible || 0, 2); }
      if (f < 14) { F.vx *= 0.6; return; }
      F.mf = 14; F.mv.t++;
      F.vx = Math.abs(F.mx) > 0.2 ? F.mx * 5.5 : F.vx * 0.7;
      if (Math.abs(F.mx) > 0.2) F.facing = F.mx < 0 ? LEFT : RIGHT;
      if (F.mv.t % 6 === 0 && Math.abs(F.vx) > 1) W.emit('omDirt', { s: F.slot, x: F.x, y: F.y, z: 0 });
      // out: A (or X, or jump), 3 s, or the floor gone from under him
      if (F.bufA > 0 || F.bufX > 0 || F.bufJ > 0 || F.mv.t >= 180 || !F.grounded) { F.bufA = F.bufX = F.bufJ = 0; startMove(F, W, 'omEmerge', { keepFacing: true }); }
    },
    onEnd(F) { F.buried = 0; },
  },
  omEmerge: {
    dur: 40, iasa: 34, pose: 'usmash', noCd: true,
    onStart(F, W) { F.buried = 0; F.va[6] = 1; W.emit('omEmerge', { s: F.slot, x: F.x, y: F.y, z: 0 }); },
    onFrame(F, W, f) { F.va[6] = Math.max(0, 1 - f / 6); if (f === 2 && F.grounded) { F.vy = 11; F.grounded = false; } },
    hits: [hb(2, 7, [0, 0.9, 0.2], 1.15, 9, 80, 34, 52, { sfx: 'punchHeavy', blood: 1.2, dir: 'radial' })],
    onEnd(F) { F.va[6] = 0; F.buried = 0; },
  },

  // Platines-trampoline : il rebondit sur une platine qui apparaît sous ses pieds ; X encore : deux rebonds de plus
  // (trois par saut au plus) ; chaque platine frappe dessous
  // three drums a time in the air (upUses): each one is an up special of its own, whenever the player wants (X + up
  // again, also while falling helpless after one); landing, a ledge or a new stock give the three back
  sp_u: {
    dur: 22, pose: 'soda', helpless: true, airCtrl: 0.6, ledgeGrab: true, upUses: 3,
    onStart(F) { F.mv.n = Math.max(0, Math.min(2, (F.upN || 1) - 1)); }, // which drum: the first, second or third
    onFrame(F, W, f) {
      const n = F.mv.n;
      if (f < 5 && !F.grounded) F.vy = Math.max(F.vy, -1);
      if (f === 5) {
        F.grounded = false; F.vy = [20, 16, 14][n];
        W.emit('deckBounce', { s: F.slot, x: F.x, y: F.y, z: 0, n });
        W.addHit({ owner: F.slot, key: 'od' + F.mseq + ':' + n, x: F.x, y: F.y - 0.1, z: 0, r: 1.2, dmg: 9, ang: -60, kbb: 28, kbg: 48, dir: 'radial', sfx: 'vinylScratch', blood: 0.5, move: 'sp_u', spike: 1 });
      }
      F.va[7] = f >= 3 && f < 17 ? 1 : 0; // the turntable under his feet
      if (f > 5) steerX(F, 8.5, 0.12);
    },
    onEnd(F) { F.va[7] = 0; },
  },
};

export default {
  id: 'omfu', name: 'OMFU', title: 'Le catcheur des platines',
  color: '#2fae5b',
  stats: { weight: 120, runSpeed: 7.6, walkSpeed: 3.2, airSpeed: 5.6, airAccel: 28, groundAccel: 54, friction: 42,
    jumpVel: 14.8, airJumpVel: 13, airJumps: 1, gravity: 1.05, fallSpeed: 19, height: 1.85, radius: 0.62 },
  moves,
  bot: { closeN: true }, // the grab only up close
  specialsInfo: { n: 'Prise de catch (A : claque, A + côté : body slam)', s: 'Scratch-onde', u: 'Platines-trampoline (X : rebondir encore)', d: 'Sous terre (A : ressortir)' },
};
