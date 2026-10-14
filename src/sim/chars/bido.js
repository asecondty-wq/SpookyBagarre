// BIDO : le gros musclé au grand cœur. Il se bat avec son matériel de muscu (haltères, kettlebell, barre)
// et envoie des bisous : des cœurs qui font mal.
import { normals, dashAttack, hb, shoot, ring } from '../kit.js';
import { steerX, nearestLedge, pullTo, xAgain, xHeld } from './recovery.js';

const moves = {
  ...normals({ power: 0.99, reach: 1.06, speed: 0.92, sfxS: 'slap', sfxM: 'punchHeavy', sfxL: 'punchHeavy', smashLunge: 0.7 }),
  // A while running: its own dash attack
  dashattack: dashAttack({ pose: 'lariat', boost: 10, fric: 22, dur: 40, iasa: 36, hits: [hb(8, 11, [0, 1.4, 0.95], 0.95, 13, 42, 54, 82, { sfx: 'punchHeavy', blood: 1.8, hitlag: 1.25 })] }),

  // neutral A, last hit: a dumbbell punch
  jab3: {
    dur: 30, iasa: 28, pose: 'jab1',
    onFrame(F, W, f) { F.va[0] = 1; },
    vel: [{ f: [5, 7], fwd: 3 }],
    hits: [hb(6, 9, [0, 1.15, 1.05], 0.8, 6, 40, 36, 86, { sfx: 'clank', blood: 1.2 })],
    onEnd(F) { F.va[0] = 0; },
  },
  // side smash: the kettlebell swung full force
  smash: {
    dur: 50, charge: { at: 8, max: 60 }, pose: 'smash', tilt: 'ftilt',
    onFrame(F, W, f) { F.va[1] = f < 38 ? 1 : 0; },
    vel: [{ f: [12, 14], fwd: 4 }],
    hits: [
      hb(15, 18, [0, 0.95, 1.35], 1.05, 19, 34, 44, 100, { sfx: 'clank', blood: 2.4, hitlag: 1.3 }),
      hb(15, 18, [0, 0.95, 0.55], 0.8, 14, 38, 34, 92, { sfx: 'punchHeavy', blood: 1.6, grp: 0 }),
    ],
    onEnd(F) { F.va[1] = 0; },
  },
  // up smash: an overhead press of the loaded barbell
  usmash: {
    dur: 48, charge: { at: 6, max: 60 }, pose: 'jupiter', tilt: 'utilt',
    onFrame(F, W, f) { F.va[2] = f >= 4 && f <= 30 ? 1 : 0; },
    hits: [
      hb(11, 15, [0, 2.4, 0], 1.4, 17, 87, 40, 96, { sfx: 'clank', blood: 2, dir: 'radial' }),
      hb(11, 15, [0, 2.3, 1.1], 0.9, 13, 80, 36, 90, { sfx: 'clank', blood: 1.4, dir: 'radial', grp: 0 }),
      hb(11, 15, [0, 2.3, -1.1], 0.9, 13, 80, 36, 90, { sfx: 'clank', blood: 1.4, dir: 'radial', grp: 0 }),
    ],
    onEnd(F) { F.va[2] = 0; },
  },
  // down smash: he drops two weight plates on both sides
  dsmash: {
    dur: 48, charge: { at: 6, max: 60 }, pose: 'drum', tilt: 'dtilt',
    onFrame(F, W, f) { F.va[3] = f >= 4 && f <= 30 ? 1 : 0; if (f === 12) W.emit('quake', { x: F.x, y: F.y, z: 0, k: 0.45 }); },
    hits: [
      hb(12, 15, [0, 0.4, 1.4], 0.95, 15, 30, 38, 92, { sfx: 'clank', blood: 1.8, dir: 'away' }),
      hb(12, 15, [0, 0.4, -1.4], 0.95, 15, 30, 38, 92, { sfx: 'clank', blood: 1.8, dir: 'away', grp: 0 }),
    ],
    onEnd(F) { F.va[3] = 0; },
  },

  // Bisou : il souffle un bisou, un cœur vole vers l'ennemi
  sp_n: {
    dur: 34, iasa: 28, pose: 'bite', airCtrl: 0.6,
    onFrame(F, W, f) {
      if (f === 6) W.emit('sfx', { s: F.slot, n: 'kiss' });
      if (f === 10) {
        shoot(W, F, 'proj', 9, { look: 'heart', r: 0.45, dmg: 8, ang: 40, kbb: 26, kbg: 58, life: 90, home: 0.06, homeDelay: 6, homeRange: 12, spin: 0, sfx: 'heart', blood: 0, hitlag: 1 }, [0, 1.55, 0.6], F.facing, 0.5);
      }
    },
  },

  // Haltère : il lance un haltère qui tourne, lourd et en cloche
  sp_s: {
    dur: 42, iasa: 36, pose: 'throw2', airCtrl: 0.4,
    onFrame(F, W, f) {
      F.va[0] = f < 14 ? 1 : 0;
      if (f === 14) {
        shoot(W, F, 'proj', 12, { look: 'dumbbell', r: 0.45, dmg: 12, ang: 40, kbb: 34, kbg: 70, life: 110, grav: 1.1, spin: 12, sfx: 'clank', blood: 1.4, hitlag: 1.1 }, [0, 1.7, 0.6], F.facing, 6);
        W.emit('sfx', { s: F.slot, n: 'throw' });
      }
    },
    onEnd(F) { F.va[0] = 0; },
  },

  // Charme : une explosion de cœurs autour de lui, les ennemis restent sous le charme (étourdis)
  sp_d: {
    dur: 50, iasa: 44, pose: 'thunder', airCtrl: 0.3,
    onFrame(F, W, f) {
      if (f === 6) W.emit('sfx', { s: F.slot, n: 'kiss' });
      if (f === 14) {
        W.addHit({ owner: F.slot, key: 'bc' + F.mseq, x: F.x, y: F.y + 1.0, z: 0, r: 2.3, dmg: 5, ang: 70, kbb: 0, kbg: 0, dir: 'radial', effect: 'stun', stun: 55, sfx: 'heart', blood: 0, move: 'sp_d', fx: 'hearts' });
        W.emit('hearts', { s: F.slot, x: F.x, y: F.y + 1.2, z: 0, n: 16 });
      }
    },
  },

  // Ballon-cœur : un énorme ballon en cœur le soulève, lentement mais longtemps (haut pour monter plus vite)
  sp_u: {
    dur: 104, pose: 'jupiter', helpless: true, noGrav: [6, 94], airCtrl: 0.3, ledgeGrab: true,
    onFrame(F, W, f) {
      F.va[4] = f >= 4 && f <= 96 ? 1 : 0;
      if (f === 6) { F.grounded = false; W.emit('sfx', { s: F.slot, n: 'kiss' }); }
      if (f >= 6 && f <= 94) {
        F.vy += (8.5 + F.my * 4 - F.vy) * 0.15;
        steerX(F, 7.5, 0.1);
        if (f % 12 === 0) W.emit('hearts', { s: F.slot, x: F.x, y: F.y + 2.4, z: 0, n: 2 });
      }
    },
    hits: [hb(6, 12, [0, 2.6, 0], 1.3, 7, 80, 40, 60, { sfx: 'heart', blood: 0, dir: 'radial' })],
    onEnd(F) { F.va[4] = 0; },
  },
};

export default {
  id: 'bido', name: 'BIDO', title: 'Des muscles, de l\'amour, des bisous qui cognent',
  color: '#ff6fb1',
  stats: { weight: 125, runSpeed: 7.8, walkSpeed: 3.2, airSpeed: 5.6, airAccel: 28, groundAccel: 54, friction: 42,
    jumpVel: 14.8, airJumpVel: 13, airJumps: 1, gravity: 1.06, fallSpeed: 19.5, height: 1.9, radius: 0.62 },
  moves,
  specialsInfo: { n: 'Bisou (cœur)', s: 'Haltère', u: 'Ballon-cœur', d: 'Charme' },
};
