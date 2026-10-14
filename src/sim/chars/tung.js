// Tung Tung Tung Sahur : la bûche à la batte. Ses coups portés SUR LE TEMPS de la musique font +30 %.
import { normals, dashAttack, hb, shoot, ring } from '../kit.js';
import { steerX, nearestLedge, pullTo, xAgain, xHeld } from './recovery.js';

const moves = {
  ...normals({ power: 0.89, reach: 1.1, speed: 0.95, sfxS: 'wood', sfxM: 'woodM', sfxL: 'woodL' }),
  // A while running: its own dash attack
  dashattack: dashAttack({ pose: 'tungtung', boost: 10, fric: 22, dur: 36, hits: [hb(8, 11, [0, 1.35, 1.05], 0.85, 11, 76, 44, 70, { sfx: 'woodL', blood: 1.4 })] }),

  // Tung, tung, tung : trois coups de batte en rythme, le troisième envoie loin
  sp_n: {
    dur: 50, iasa: 46, pose: 'tungtung', airCtrl: 0.4,
    vel: [{ f: [30, 32], fwd: 5 }],
    hits: [
      hb(9, 11, [0, 1.1, 1.25], 0.85, 4, 30, 20, 20, { sfx: 'tung', blood: 0.8, grp: 0 }),
      hb(20, 22, [0, 1.1, 1.25], 0.85, 4, 30, 20, 20, { sfx: 'tung', blood: 0.8, grp: 1 }),
      hb(32, 35, [0, 1.15, 1.35], 1.0, 11, 40, 40, 88, { sfx: 'tungL', blood: 2.0, grp: 2, hitlag: 1.3 }),
    ],
    onFrame(F, W, f) { if (f === 9 || f === 20 || f === 32) W.emit('tung', { s: F.slot, n: f === 32 ? 3 : f === 20 ? 2 : 1 }); },
  },

  // Batte-boomerang : la batte tourne, part et revient
  sp_s: {
    dur: 34, iasa: 30, pose: 'throw1', airCtrl: 0.5,
    onFrame(F, W, f) {
      if (f === 9) {
        shoot(W, F, 'proj', 18, { look: 'bat', custom: 'boomerang', r: 0.55, dmg: 8, ang: 38, kbb: 28, kbg: 60, life: 120, pierce: true, rehit: 24, spin: 18, sfx: 'tung', blood: 1.6, outT: 19 }, [0, 1.2, 0.6], F.facing, 0.5);
        W.emit('sfx', { s: F.slot, n: 'throw' });
      }
    },
  },

  // Tung-copter : la batte tourne au-dessus de sa tête et l'emporte, longtemps et dirigeable
  sp_u: {
    dur: 62, pose: 'helico', helpless: true, noGrav: [5, 50], airCtrl: 0.5, ledgeGrab: true,
    onFrame(F, W, f) {
      if (f === 5) { F.grounded = false; W.emit('sfx', { s: F.slot, n: 'sahur' }); }
      if (f >= 5 && f <= 50) { F.vy = 16 - (f - 5) * 0.15 + F.my * 2; steerX(F, 9.5); }
      F.va[1] = (F.va[1] + 0.85) % (Math.PI * 2);
    },
    hits: [
      hb(5, 48, [0, 1.6, 0], 1.3, 2, 80, 0, 0, { fkb: 34, rehit: 6, sfx: 'wood', blood: 0.9, dir: 'radial' }),
      hb(49, 52, [0, 1.6, 0.3], 1.4, 7, 60, 42, 72, { sfx: 'tungL', blood: 1.6, dir: 'radial', grp: 4 }),
    ],
  },

  // Kentongan : il frappe la plateforme comme un tambour, trois ondes de choc
  sp_d: {
    dur: 56, iasa: 52, pose: 'drum', airCtrl: 0.3,
    onFrame(F, W, f) {
      if ((f === 12 || f === 26 || f === 40) && F.grounded) {
        const n = f === 12 ? 0 : f === 26 ? 1 : 2;
        const on = W.onBeat(0.1);
        ring(W, F, { r: 0.6, grow: 10 + n * 3 + (on ? 4 : 0), life: 24 + n * 4, dmg: [3, 4, 7][n] * (on ? 1.3 : 1), ang: 84,
          kbb: [26, 32, 48][n], kbg: [30, 40, 70][n], w: 0.75, h: 1.0, look: on ? 'tungbeat' : 'tung', sfx: 'tung', blood: 0.8 });
        W.emit('tung', { s: F.slot, n: n + 1, ground: 1, beat: on ? 1 : 0 });
        W.emit('quake', { x: F.x, y: F.y, z: F.z, k: 0.35 + n * 0.15 });
      }
    },
  },
};

export default {
  id: 'tung', name: 'Tung Tung Tung Sahur', title: 'Il frappe sur le temps. Toujours.',
  color: '#b5803f',
  beatBonus: true,
  stats: { weight: 96, runSpeed: 8.0, walkSpeed: 3.6, airSpeed: 6.0, airAccel: 30, groundAccel: 62, friction: 44,
    jumpVel: 15, airJumpVel: 13, airJumps: 1, gravity: 1.0, fallSpeed: 18, height: 2.05, radius: 0.5 },
  moves,
  specialsInfo: { n: 'Tung, tung, tung', s: 'Batte-boomerang', u: 'Réveil Sahur', d: 'Kentongan (3 ondes)' },
};
