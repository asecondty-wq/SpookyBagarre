// Epektase : le guitariste. Il cogne avec sa Flying V comme avec une hache, fouette avec son carré Hermès (il adore
// les foulards Hermès) et sort des solos ravageurs : notes qui fusent, power chord qui souffle tout, larsen qui sonne.
// Prop flags (src/render/rig/epektaseRig.js): va[0] the guitar played on the chest (else held like an axe),
// va[1] the scarf out (0..1, how far it reaches), va[2] the guitar glowing (solo, power chord, larsen).
import { normals, dashAttack, hb, shoot, ring, hitNow } from '../kit.js';
import { steerX, nearestLedge, pullTo } from './recovery.js';
import { DMath } from '../dmath.js';

// the scarf goes out over a few frames, stays, then comes back
const lash = (f, out, hold, back) => (f < out[0] ? 0 : f < out[1] ? (f - out[0]) / (out[1] - out[0]) : f < hold ? 1 : f < back ? 1 - (f - hold) / (back - hold) : 0);

const moves = {
  ...normals({ power: 1.08, reach: 1.12, speed: 0.96, sfxS: 'slap', sfxM: 'guitarHit', sfxL: 'guitarHitL' }),
  // A while running: on his knees across the stage, guitar first (the rock star slide)
  dashattack: dashAttack({ pose: 'slide', boost: 12.5, fric: 13, dur: 42, iasa: 38,
    onStart(F, W) { W.emit('sfx', { s: F.slot, n: 'riff' }); },
    onFrame(F, W, f) { F.va[2] = f >= 4 && f <= 30 ? 1 : 0; },
    hits: [
      hb(5, 9, [0, 0.7, 0.95], 0.85, 10, 38, 42, 74, { sfx: 'guitarHitL', blood: 1.2 }),
      hb(10, 24, [0, 0.6, 0.85], 0.7, 5, 50, 28, 50, { sfx: 'guitarHit', blood: 0.6, grp: 1 }),
    ] }),

  // A + side: the Hermès scarf, a silk whip that reaches far (the tip hurts more)
  ftilt: {
    dur: 30, iasa: 24, pose: 'ftilt', next: 'ftilt2', nextWin: [14, 28], combo: true,
    onFrame(F, W, f) { F.va[1] = lash(f, [3, 9], 13, 20); if (f === 5) W.emit('sfx', { s: F.slot, n: 'silk' }); },
    hits: [
      hb(8, 11, [0, 1.15, 1.25], 0.6, 5, 34, 16, 42, { sfx: 'whip', blood: 0.5 }),
      hb(8, 11, [0, 1.15, 2.15], 0.55, 7.5, 38, 26, 62, { sfx: 'whip', blood: 0.9, grp: 0, hitlag: 1.2 }),
    ],
    onEnd(F) { F.va[1] = 0; },
  },
  // second tap: a spinning kick, the scarf trailing
  ftilt2: {
    dur: 28, iasa: 22, pose: 'buttbump', next: 'ftilt3', nextWin: [15, 26], combo: true,
    vel: [{ f: [6, 9], fwd: 3 }],
    hits: [hb(10, 13, [0, 1.0, 1.0], 0.8, 5.5, 40, 18, 44, { sfx: 'guitarHit', blood: 0.6 })],
  },
  // third tap: the guitar brought down like a sledgehammer
  ftilt3: {
    dur: 36, iasa: 32, pose: 'headbutt',
    vel: [{ f: [7, 10], fwd: 4 }],
    onFrame(F, W, f) { if (f === 14) W.emit('quake', { x: F.x + DMath.sin(F.facing) * 1.2, y: F.y, z: 0, k: 0.12 }); },
    hits: [hb(12, 15, [0, 0.9, 1.25], 0.85, 9.5, 42, 34, 88, { sfx: 'guitarSmash', blood: 1.6, hitlag: 1.2 })],
  },
  // side smash: the Flying V swung like an axe, full force
  smash: {
    dur: 46, charge: { at: 9, max: 60 }, pose: 'smash', tilt: 'ftilt',
    vel: [{ f: [11, 13], fwd: 5 }],
    hits: [
      hb(13, 16, [0, 1.1, 1.35], 1.0, 16.5, 38, 40, 102, { sfx: 'guitarSmash', blood: 2.4, hitlag: 1.25 }),
      hb(13, 16, [0, 1.0, 0.5], 0.75, 13, 38, 32, 94, { sfx: 'guitarHitL', blood: 1.6, grp: 0 }),
    ],
  },
  // up smash: the guitar swung up over his head
  usmash: {
    dur: 44, charge: { at: 7, max: 60 }, pose: 'usmash', tilt: 'utilt',
    hits: [
      hb(11, 15, [0, 2.3, 0.3], 1.1, 15.5, 87, 36, 98, { sfx: 'guitarSmash', blood: 2.0, dir: 'radial' }),
      hb(10, 12, [0, 1.0, 0.7], 0.95, 12, 80, 32, 90, { sfx: 'guitarHitL', blood: 1.4, grp: 0, dir: 'radial' }),
    ],
  },
  // down smash: the guitar slammed flat into the floor, the boards shake on both sides
  dsmash: {
    dur: 48, charge: { at: 7, max: 60 }, pose: 'dsmash', tilt: 'dtilt',
    onFrame(F, W, f) { if (f === 13) { W.emit('quake', { x: F.x, y: F.y, z: 0, k: 0.3 }); W.emit('sfx', { s: F.slot, n: 'riff' }); } },
    hits: [
      hb(13, 16, [0, 0.35, 1.1], 0.9, 14.5, 28, 36, 94, { sfx: 'guitarSmash', blood: 1.8, dir: 'away', hitlag: 1.1 }),
      hb(13, 16, [0, 0.35, -1.1], 0.9, 14.5, 28, 36, 94, { sfx: 'guitarSmash', blood: 1.8, dir: 'away', grp: 0 }),
      hb(13, 15, [0, 0.45, 0], 0.75, 11, 30, 30, 80, { sfx: 'guitarHit', blood: 1.2, dir: 'away', grp: 0 }),
    ],
  },
  // up tilt: the windmill strum, the arm wheeling over the strings
  utilt: {
    dur: 26, iasa: 19, pose: 'headbuttUp', combo: true,
    onFrame(F, W, f) { F.va[0] = f < 22 ? 1 : 0; if (f === 7) W.emit('sfx', { s: F.slot, n: 'note' }); },
    hits: [hb(7, 12, [0, 2.0, 0.3], 0.95, 6.5, 88, 26, 66, { sfx: 'guitarHit', blood: 0.8, dir: 'radial' })],
    onEnd(F) { F.va[0] = 0; },
  },

  // grab: the scarf thrown like a lasso, it catches far away (slower than a hand grab)
  grab: {
    dur: 40, pose: 'grab', groundOnly: true,
    onFrame(F, W, f) { F.va[1] = lash(f, [3, 9], 14, 24); if (f === 5) W.emit('sfx', { s: F.slot, n: 'silk' }); },
    hits: [hb(8, 13, [0, 1.05, 1.75], 0.85, 0, 0, 0, 0, { effect: 'grab' })],
    onEnd(F) { F.va[1] = 0; },
  },

  // Solo ravageur : a shred, the notes fly in a stream, the last one hits hard
  sp_n: {
    dur: 66, iasa: 60, pose: 'bite', airCtrl: 0.5,
    onFrame(F, W, f) {
      F.va[0] = f < 60 ? 1 : 0; F.va[2] = f >= 8 && f < 58 ? 1 : 0;
      if (f === 8) W.emit('sfx', { s: F.slot, n: 'shred' });
      if (f >= 10 && f <= 46 && (f - 10) % 6 === 0) {
        const k = (f - 10) / 6;
        shoot(W, F, 'proj', 13 + (k % 3), { look: 'note', r: 0.34, dmg: 2.2, ang: 40, kbb: 6, kbg: 8, life: 38, sfx: 'hitS', blood: 0.2, b: k % 3 },
          [0, 1.05 + 0.25 * DMath.sin(k * 1.9), 0.8], F.facing, 1.2 * DMath.sin(k * 2.3));
      }
      if (f === 52) {
        shoot(W, F, 'proj', 15, { look: 'bignote', r: 0.55, dmg: 7, ang: 40, kbb: 40, kbg: 70, life: 40, sfx: 'guitarHitL', blood: 0.8, hitlag: 1.2 }, [0, 1.15, 0.8]);
        W.emit('sfx', { s: F.slot, n: 'riff' });
      }
    },
    onEnd(F) { F.va[0] = 0; F.va[2] = 0; },
  },

  // Power chord : one strum, a wall of sound in front of him that blows everyone away
  sp_s: {
    dur: 48, iasa: 42, pose: 'throw1', airCtrl: 0.5,
    onFrame(F, W, f) {
      F.va[0] = f < 40 ? 1 : 0; F.va[2] = f >= 10 && f < 30 ? 1 : 0;
      if (f === 12) {
        W.emit('sfx', { s: F.slot, n: 'powerchord' });
        hitNow(W, F, 'pc', [0, 1.1, 1.0], 1.0, { dmg: 9, ang: 38, kbb: 44, kbg: 70, sfx: 'guitarHitL', blood: 0.8, hitlag: 1.1 });
        shoot(W, F, 'proj', 17, { look: 'chord', r: 0.95, dmg: 7, ang: 36, kbb: 34, kbg: 58, life: 20, pierce: true, sfx: 'hitM', blood: 0.4, drag: 2.5 }, [0, 1.1, 1.0]);
      }
    },
    onEnd(F) { F.va[0] = 0; F.va[2] = 0; },
  },

  // Saut du rockeur : he leaps guitar first, the neck hits on the way up; near a ledge he flies to it
  sp_u: {
    dur: 60, pose: 'jupiter', helpless: true, noGrav: [6, 40], airCtrl: 0.5, ledgeGrab: true,
    onFrame(F, W, f) {
      if (f === 5) W.emit('sfx', { s: F.slot, n: 'riff' });
      if (f < 6 && !F.grounded) F.vy = Math.max(F.vy, -1);
      if (f === 6) { F.grounded = false; const L = nearestLedge(W, F, 10); if (L) F.mv.L = L; }
      if (f >= 6 && f <= 40) {
        if (F.mv.L) pullTo(F, F.mv.L, 18);
        else { F.vy = 17 - (f - 6) * 0.3; steerX(F, 7); }
      }
    },
    hits: [
      hb(6, 10, [0, 1.6, 0.5], 1.05, 9, 82, 52, 72, { sfx: 'guitarHitL', blood: 1.2, dir: 'radial' }),
      hb(11, 20, [0, 2.0, 0.2], 0.9, 4, 85, 30, 50, { sfx: 'guitarHit', blood: 0.5, grp: 1, dir: 'radial' }),
    ],
  },

  // Larsen : the guitar held up to the amp, a screech that rings out all around him; up close it leaves you dizzy
  sp_d: {
    dur: 56, iasa: 50, pose: 'thunder', airCtrl: 0.4,
    onFrame(F, W, f) {
      F.va[0] = f < 48 ? 1 : 0; F.va[2] = f >= 8 && f < 44 ? 1 : 0;
      if (f === 8) W.emit('sfx', { s: F.slot, n: 'larsen' });
      if (f === 14) {
        hitNow(W, F, 'lz', [0, 1.0, 0], 1.45, { effect: 'stun', stun: 42, dmg: 3, sfx: 'zapS', blood: 0, dir: 'radial', unblockable: false });
        ring(W, F, { look: 'larsen', r: 0.8, grow: 12, life: 26, dmg: 5, ang: 75, kbb: 34, kbg: 42, w: 0.9, h: 1.6, sfx: 'zapS', blood: 0.2 });
      }
    },
    onEnd(F) { F.va[0] = 0; F.va[2] = 0; },
  },
};

export default {
  id: 'epektase', name: 'Epektase', title: 'Des solos ravageurs et un carré Hermès',
  color: '#d8262c',
  stats: { weight: 98, runSpeed: 8.5, walkSpeed: 3.6, airSpeed: 6.3, airAccel: 33, groundAccel: 64, friction: 46,
    jumpVel: 15.8, airJumpVel: 14.0, airJumps: 1, gravity: 1.0, fallSpeed: 17.5, height: 1.8, radius: 0.5 },
  moves,
  specialsInfo: { n: 'Solo ravageur', s: 'Power chord', u: 'Saut du rockeur', d: 'Larsen' },
};
