// J'san : toujours avec son shiba. C'est le chien qui se bat pour lui (morsures, charges, sauts, aboiements)
// pendant que J'san tire sur sa vapoteuse.
import { normals, dashAttack, hb } from '../kit.js';
import { ensurePet, petCmd } from './friendKit.js';
import { localToWorld } from '../util.js';
import { steerX, nearestLedge, pullTo, xAgain, xHeld } from './recovery.js';
import { DMath } from '../dmath.js';

const moves = {
  ...normals({ power: 1.18, reach: 1.04, speed: 1.02, sfxS: 'slap', sfxM: 'hitM', sfxL: 'hitL' }),
  // A while running: its own dash attack
  dashattack: dashAttack({ pose: 'dropkick', boost: 12, fric: 20, dur: 38, iasa: 34, hits: [hb(7, 11, [0, 1.0, 1.0], 0.85, 11, 38, 46, 76, { sfx: 'hitL', blood: 1.3 })] }),

  // neutral A, last hit: the shiba nips in front of him
  jab3: {
    dur: 26, iasa: 24, pose: 'throw1',
    onStart(F, W) { petCmd(W, F, 'bite', 6); },
  },
  // side smash: the shiba charges and bites hard
  smash: {
    dur: 44, charge: { at: 8, max: 60 }, pose: 'throw1', tilt: 'ftilt',
    onFrame(F, W, f) { if (f === 10) petCmd(W, F, 'bite', 17 * (1 + 0.45 * (F.mv.charge || 0) / 60)); if (f === 9) W.emit('bark', { s: F.slot, small: 1 }); },
  },
  // up smash: the shiba leaps and headbutts above J'san
  usmash: {
    dur: 44, charge: { at: 6, max: 60 }, pose: 'thunder', tilt: 'utilt',
    onFrame(F, W, f) { if (f === 8) petCmd(W, F, 'jump', 1); },
  },
  // down smash: the shiba spins around him like a tornado of fur
  dsmash: {
    dur: 46, charge: { at: 6, max: 60 }, pose: 'dsmash', tilt: 'dtilt',
    onFrame(F, W, f) { if (f === 8) petCmd(W, F, 'spin', 1); },
  },

  // Nuage de vape : une grosse bouffée de vapeur devant lui, on ne voit plus rien (étourdit)
  sp_n: {
    dur: 40, iasa: 34, pose: 'bite', airCtrl: 0.6,
    onFrame(F, W, f) {
      F.va[0] = f < 16 ? 1 : 0; // the vape at the mouth
      if (f === 6) W.emit('sfx', { s: F.slot, n: 'vape' });
      if (f === 18) {
        const p = localToWorld(F, [0, 1.5, 1.4]);
        W.spawn('cloud', { owner: F.slot, x: p[0], y: p[1], z: 0, vx: DMath.sin(F.facing) * 5, r: 2.0, life: 130, look: 'vape', effect: 'stun', stun: 34, dmg: 2.5, rehit: 70, sfx: 'poof' });
        W.emit('vape', { x: p[0], y: p[1], z: 0, a: F.facing });
      }
    },
    onEnd(F) { F.va[0] = 0; },
  },

  // Va chercher ! : le shiba file droit devant et mord tout ce qu'il croise, puis revient
  sp_s: {
    dur: 34, iasa: 28, pose: 'throw1', airCtrl: 0.6,
    onFrame(F, W, f) { if (f === 6) { petCmd(W, F, 'dash', 1); W.emit('bark', { s: F.slot, small: 1 }); } },
  },

  // Wouf ! : le shiba aboie si fort que ça repousse tout le monde autour
  sp_d: {
    dur: 34, iasa: 30, pose: 'thunder', airCtrl: 0.5,
    onFrame(F, W, f) { if (f === 4) petCmd(W, F, 'bark', 1); },
  },

  // Laisse-fusée : le shiba bondit vers le bord le plus proche et le hisse au bout de la laisse ; sans bord, il l'emporte au ciel
  sp_u: {
    dur: 64, pose: 'jupiter', helpless: true, noGrav: [6, 50], airCtrl: 0.5, ledgeGrab: true,
    onFrame(F, W, f) {
      if (f === 2) { petCmd(W, F, 'lift', 1); W.emit('bark', { s: F.slot }); }
      if (f < 6 && !F.grounded) F.vy = Math.max(F.vy, -1);
      if (f === 6) { F.grounded = false; const L = nearestLedge(W, F, 11); if (L) F.mv.L = L; }
      if (f >= 6 && f <= 50) {
        if (F.mv.L) pullTo(F, F.mv.L, 19);
        else { F.vy = 16.5 - (f - 6) * 0.2; steerX(F, 7.5); }
      }
    },
    hits: [hb(6, 14, [0, 2.3, 0.2], 1.0, 7, 80, 40, 62, { sfx: 'chomp', blood: 1, dir: 'radial' })],
  },
};

export default {
  id: 'jsan', name: "J'san", title: 'Lui, sa vapoteuse et son shiba',
  color: '#d9a35f',
  // the shiba is always with him (spawned on the first frame, follows him everywhere)
  tick(F, W) { if (!F.out) ensurePet(W, F, 'shiba'); },
  stats: { weight: 108, runSpeed: 8.6, walkSpeed: 3.7, airSpeed: 6.4, airAccel: 34, groundAccel: 66, friction: 46,
    jumpVel: 15.6, airJumpVel: 13.8, airJumps: 1, gravity: 1.0, fallSpeed: 17.5, height: 1.82, radius: 0.52 },
  moves,
  specialsInfo: { n: 'Nuage de vape', s: 'Va chercher !', u: 'Laisse-fusée', d: 'Wouf !' },
};
