// OMFU : le DJ. Il frappe avec ses platines, lance des cowbells (TONK, la 808) et des buckets de poulet.
import { normals, dashAttack, hb, shoot, ring } from '../kit.js';
import { ENTITIES } from '../entities.js';
import { steerX, nearestLedge, pullTo, xAgain, xHeld } from './recovery.js';

// the chicken bucket: lands heavy, spills drumsticks all around
ENTITIES.bucket = {
  onLand(e, W) { spill(e, W); },
  onHitFighter(e, V, W) { spill(e, W); },
};
function spill(e, W) {
  if (e.spilled) return;
  e.spilled = 1;
  W.addHit({ owner: e.owner, key: 'bk' + e.id, x: e.x, y: e.y + 0.4, z: 0, r: 1.3, dmg: 9, ang: 55, kbb: 34, kbg: 66, dir: 'radial',
    ent: e.id, src: 'proj', sfx: 'punchHeavy', blood: 0.6, move: 'sp_s' });
  for (let i = 0; i < 4; i++) {
    const vx = (i < 2 ? -1 : 1) * (2.5 + (i % 2) * 2.5);
    W.spawn('proj', { owner: e.owner, x: e.x, y: e.y + 0.5, z: 0, vx, vy: 7 + (i % 2) * 2, look: 'drumstick', r: 0.28, dmg: 3, ang: 45, kbb: 10, kbg: 24,
      life: 60, grav: 1, spin: 12, sfx: 'hitS', blood: 0.3, armT: 4 });
  }
  W.emit('bucket', { x: e.x, y: e.y, z: 0 });
}

const moves = {
  ...normals({ power: 1.1, reach: 1.06, speed: 0.92, sfxS: 'slap', sfxM: 'punchHeavy', sfxL: 'punchHeavy', smashLunge: 0.7 }),
  // A while running: its own dash attack
  dashattack: dashAttack({ pose: 'shoulder', boost: 10, fric: 20, dur: 38, iasa: 34, hits: [hb(7, 11, [0, 1.1, 0.9], 0.95, 13, 38, 50, 80, { sfx: 'punchHeavy', blood: 1.6, hitlag: 1.15 })] }),

  // neutral A, last hit: a scratch right in the face (the record in his hand)
  jab3: {
    dur: 30, iasa: 28, pose: 'jab3',
    onFrame(F, W, f) { F.va[1] = f < 20 ? 1 : 0; if (f === 5) W.emit('sfx', { s: F.slot, n: 'vinylScratch' }); },
    hits: [hb(6, 9, [0, 1.1, 1.0], 0.8, 5.5, 40, 34, 84, { sfx: 'scratch', blood: 1.1 })],
    onEnd(F) { F.va[1] = 0; },
  },
  // side smash: the whole turntable smashed in the face
  smash: {
    dur: 48, charge: { at: 8, max: 60 }, pose: 'smash', tilt: 'ftilt',
    onFrame(F, W, f) { F.va[0] = f < 36 ? 1 : 0; },
    vel: [{ f: [11, 13], fwd: 4 }],
    hits: [
      hb(14, 17, [0, 1.1, 1.3], 1.05, 18, 36, 42, 100, { sfx: 'punchHeavy', blood: 2.4, hitlag: 1.3 }),
      hb(14, 17, [0, 1.0, 0.5], 0.8, 14, 38, 34, 92, { sfx: 'hitL', blood: 1.6, grp: 0 }),
    ],
    onEnd(F) { F.va[0] = 0; },
  },
  // up smash: a record spinning like a saw above his head
  usmash: {
    dur: 46, charge: { at: 6, max: 60 }, pose: 'helico', tilt: 'utilt',
    onFrame(F, W, f) { F.va[1] = f >= 6 && f <= 26 ? 1 : 0; },
    hits: [
      hb(9, 18, [0, 2.3, 0], 1.15, 2.2, 88, 0, 0, { fkb: 30, rehit: 4, sfx: 'vinylScratch', blood: 0.6, dir: 'radial' }),
      hb(19, 22, [0, 2.4, 0], 1.3, 9, 88, 42, 96, { sfx: 'hitL', blood: 1.6, dir: 'radial', grp: 1 }),
    ],
    onEnd(F) { F.va[1] = 0; },
  },
  // down smash: DROP THE BASS, the subwoofer blasts both sides
  dsmash: {
    dur: 48, charge: { at: 6, max: 60 }, pose: 'drum', tilt: 'dtilt',
    onFrame(F, W, f) {
      F.va[3] = f >= 6 && f <= 24 ? 1 : 0;
      if (f === 12) {
        ring(W, F, { r: 0.5, grow: 14, life: 18, dmg: 14, ang: 32, kbb: 38, kbg: 90, w: 0.85, h: 1.2, look: 'bass', sfx: 'bassDrop', blood: 0.8 });
        W.emit('quake', { x: F.x, y: F.y, z: 0, k: 0.5 });
      }
    },
    onEnd(F) { F.va[3] = 0; },
  },

  // Cowbell 808 : deux cowbells en cloche ; TONK sur la tête de l'ennemi
  sp_n: {
    dur: 40, iasa: 34, pose: 'throw1', airCtrl: 0.5,
    onFrame(F, W, f) {
      F.va[2] = (f < 9 || (f > 12 && f < 20)) ? 1 : 0;
      if (f === 9 || f === 20) {
        shoot(W, F, 'proj', f === 9 ? 13 : 9, { look: 'cowbell', r: 0.36, dmg: 6, ang: 50, kbb: 20, kbg: 48, life: 90, grav: 1, spin: 10, bounce: 0.4, sfx: 'cowbell', blood: 0.3, hitlag: 1 }, [0, 1.5, 0.6], F.facing, f === 9 ? 6 : 9);
        W.emit('sfx', { s: F.slot, n: 'throw' });
      }
    },
    onEnd(F) { F.va[2] = 0; },
  },

  // Bucket de poulet : un seau lancé lourd, les pilons volent partout à l'atterrissage
  sp_s: {
    dur: 44, iasa: 38, pose: 'throw2', airCtrl: 0.4,
    onFrame(F, W, f) {
      F.va[4] = f < 15 ? 1 : 0;
      if (f === 15) {
        shoot(W, F, 'proj', 11, { look: 'bucket', custom: 'bucket', r: 0.55, dmg: 5, ang: 45, kbb: 14, kbg: 22, life: 130, grav: 1.15, spin: 5, sfx: 'punchHeavy', blood: 0.3 }, [0, 1.7, 0.6], F.facing, 7);
        W.emit('sfx', { s: F.slot, n: 'throw' });
      }
    },
    onEnd(F) { F.va[4] = 0; },
  },

  // Scratch-onde : il pose ses platines et scratche, trois ondes sonores partent autour de lui
  sp_d: {
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

  // Enceinte-catapulte : DROP THE BASS, le BOOM de l'enceinte le catapulte à une hauteur folle
  sp_u: {
    dur: 56, pose: 'soda', helpless: true, airCtrl: 0.6, ledgeGrab: true,
    onFrame(F, W, f) {
      F.va[3] = f < 10 ? 1 : 0;
      if (f < 8 && !F.grounded) F.vy = Math.max(F.vy, -1);
      if (f === 8) {
        F.grounded = false; F.vy = 29; F.vx = F.mx * 10; // catapulted along the stick
        W.emit('speakerBoom', { s: F.slot, x: F.x, y: F.y, z: 0 });
        W.addHit({ owner: F.slot, key: 'ob' + F.mseq, x: F.x, y: F.y + 0.3, z: 0, r: 1.8, dmg: 10, ang: 80, kbb: 44, kbg: 60, dir: 'radial', sfx: 'bassDrop', blood: 0.6, move: 'sp_u' });
      }
      if (f > 8) steerX(F, 9.5, 0.1);
    },
    onEnd(F) { F.va[3] = 0; },
  },
};

export default {
  id: 'omfu', name: 'OMFU', title: 'Platines, poulet frit, plus de cowbell',
  color: '#2fae5b',
  stats: { weight: 120, runSpeed: 7.6, walkSpeed: 3.2, airSpeed: 5.6, airAccel: 28, groundAccel: 54, friction: 42,
    jumpVel: 14.8, airJumpVel: 13, airJumps: 1, gravity: 1.05, fallSpeed: 19, height: 1.85, radius: 0.62 },
  moves,
  specialsInfo: { n: 'Cowbell 808', s: 'Bucket de poulet', u: 'Enceinte-catapulte', d: 'Scratch-onde' },
};
