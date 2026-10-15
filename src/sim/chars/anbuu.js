// ANBUU : pieds nus, il flotte comme par magie (il se déplace comme Mewtwo), des petites ailes d'ange dans le dos ;
// il joue le lick interdit (les sept notes du cliché jazz) et invoque de saintes 808 très bassy.
// Prop flags (src/render/rig/anbuuRig.js): va[0] the wings spread (the flight), va[1] the waveform in his hands.
import { normals, dashAttack, hb, shoot, ring } from '../kit.js';
import { steerX } from './recovery.js';
import { ENTITIES } from '../entities.js';

const moves = {
  ...normals({ power: 0.96, reach: 1.06, speed: 1.05, sfxS: 'slap', sfxM: 'hitM', sfxL: 'hitL' }),
  // side A tapped twice: an elbow; three times: a lunging roundhouse (his own clips)
  ftilt2: {
    dur: 26, iasa: 20, pose: 'jab2', next: 'ftilt3', nextWin: [14, 24], combo: true,
    vel: [{ f: [5, 8], fwd: 3 }],
    hits: [hb(9, 11, [0, 1.2, 0.8], 0.6, 5, 40, 16, 40, { sfx: 'hitM', blood: 0.6 })],
  },
  ftilt3: {
    dur: 34, iasa: 30, pose: 'ftilt',
    vel: [{ f: [6, 10], fwd: 4.5 }],
    hits: [hb(11, 14, [0, 1.15, 1.0], 0.6, 8.5, 40, 34, 88, { sfx: 'hitL', blood: 1.4, hitlag: 1.15 })],
  },
  // A while running: a psychic shove, both palms forward, he glides into it
  dashattack: dashAttack({ pose: 'jab3', boost: 12, fric: 11, dur: 36, iasa: 32,
    hits: [hb(5, 10, [0, 1.0, 0.95], 0.75, 8, 38, 40, 70, { sfx: 'zap', blood: 0.6, fx: 'zap' })] }),

  // Le Lick : the seven notes of the forbidden jazz lick, one after the other (the last one the strongest)
  sp_n: {
    dur: 56, iasa: 50, pose: 'bite', airCtrl: 0.5,
    onFrame(F, W, f) {
      const k = (f - 6) / 5;
      if (f >= 6 && f <= 36 && (f - 6) % 5 === 0) {
        const last = k === 6;
        shoot(W, F, 'proj', last ? 13 : 11, { look: 'jazznote', b: k, r: last ? 0.45 : 0.32, dmg: last ? 6 : 1.8, ang: last ? 40 : 30,
          kbb: last ? 34 : 4, kbg: last ? 66 : 6, life: 48, sfx: 'zapS', blood: 0.1, hitlag: last ? 1.1 : 0.6 },
          [0, 1.3 + Math.sin(k * 1.3) * 0.2, 0.6], F.facing, Math.sin(k * 1.7) * 1.5);
        W.emit('anbuuLick', { s: F.slot, n: k });
      }
    },
  },

  // Waveform : the 808's bass wave, it rolls forward along the floor and hits three times
  sp_s: {
    dur: 44, iasa: 38, pose: 'throw1', airCtrl: 0.4,
    onFrame(F, W, f) {
      F.va[1] = f < 16 ? 1 : 0;
      if (f === 14) {
        shoot(W, F, 'proj', 9.5, { look: 'waveform', r: 0.7, dmg: 3.5, ang: 30, kbb: 14, kbg: 30, life: 70, pierce: true, rehit: 12, multi: true,
          sfx: 'hitM', blood: 0.2 }, [0, 0.55, 0.7]);
        W.emit('anbuu808', { s: F.slot, n: 0 });
      }
    },
    onEnd(F) { F.va[1] = 0; },
  },

  // Sainte 808 : he stomps, a holy 808 drops in front of him, the bass drop pushes everyone away
  sp_d: {
    dur: 58, iasa: 52, pose: 'bite', airCtrl: 0.3,
    onFrame(F, W, f) {
      if (f === 4) W.emit('anbuu808', { s: F.slot, n: 1 });
      if (f === 18) {
        const fx = Math.sin(F.facing) * 1.4;
        W.spawn('proj', { owner: F.slot, x: F.x + fx, y: F.y + 5, z: 0, vx: 0, vy: -26, vz: 0, dir: F.facing, look: 'holy808', r: 0.75, dmg: 11,
          ang: 70, kbb: 40, kbg: 70, life: 40, grav: 0, sfx: 'hitL', blood: 1, custom: 'holy808', hitlag: 1.2 });
      }
    },
  },

  // Envol : the little angel wings carry him up (they hit on the way); steered with the stick
  sp_u: {
    dur: 50, pose: 'jupiter', noTrail: true, helpless: true, noGrav: [4, 34], airCtrl: 0.6, ledgeGrab: true,
    onFrame(F, W, f) {
      F.va[0] = f < 40 ? 1 : 0;
      if (f === 3) W.emit('anbuuWings', { s: F.slot, up: 1 });
      if (f < 4 && !F.grounded) F.vy = Math.max(F.vy, -1);
      if (f === 4) F.grounded = false;
      if (f >= 4 && f <= 34) { F.vy = 17 - (f - 4) * 0.3; steerX(F, 8.5); }
    },
    onEnd(F) { F.va[0] = 0; },
    hits: [
      hb(4, 8, [0, 1.4, 0.2], 0.95, 7, 80, 46, 66, { sfx: 'hitM', blood: 0.6, dir: 'radial' }),
      hb(9, 22, [0, 1.3, 0], 0.8, 2, 80, 20, 30, { sfx: 'hitS', blood: 0.2, grp: 1, rehit: 6, dir: 'radial' }),
    ],
  },
};

// the holy 808: it falls, lands with the bass drop (a ring along the floor), and is gone
ENTITIES.holy808 = {
  onLand(e, W) { drop(e, W); },
  onHitFighter(e, V, W) { drop(e, W); },
};
function drop(e, W) {
  if (e.dropped) return;
  e.dropped = 1;
  W.spawn('ring', { owner: e.owner, x: e.x, y: e.y, z: 0, r: 0.6, grow: 10, life: 20, dmg: 6, ang: 45, kbb: 44, kbg: 60, look: 'bass', sfx: 'hitM', blood: 0.2 });
  W.emit('anbuu808', { s: e.owner, n: 2, x: e.x, y: e.y });
}

export default {
  id: 'anbuu', name: 'ANBUU', title: 'Le lick interdit et les saintes 808',
  color: '#f2e6a0',
  stats: { weight: 79, runSpeed: 9.0, walkSpeed: 3.6, airSpeed: 6.8, airAccel: 30, groundAccel: 64, friction: 40,
    jumpVel: 15.4, airJumpVel: 17, airJumps: 1, gravity: 0.95, fallSpeed: 17, height: 1.74, radius: 0.46 },
  moves,
  specialsInfo: { n: 'Le Lick', s: 'Waveform', u: 'Envol', d: 'Sainte 808' },
};
