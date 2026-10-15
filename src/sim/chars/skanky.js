// SKANKY : il parle sans s'arrêter (ça étourdit tout le monde autour), il fraude le train (il saute le portique, le
// train passe derrière lui et fauche ceux qui sont sur la voie), il ne court pas, il roule en skate, et il danse la
// funk de Lyon.
// Prop flags (src/render/rig/skankyRig.js): va[0] the skateboard under his feet (the ollie), va[1] the ticket gate he
// jumps over (the fraud).
import { normals, dashAttack, hb, shoot, ring } from '../kit.js';
import { steerX, nearestLedge, pullTo } from './recovery.js';

// the words of his talk (the bubbles show them: their index in e.b, see BLABLA in skankyRig.js)
const WORDS = 8;

const moves = {
  ...normals({ power: 1.0, reach: 1.04, speed: 1.03, sfxS: 'slap', sfxM: 'hitM', sfxL: 'hitL' }),
  // side A tapped twice: an elbow; three times: a lunging roundhouse (his own clips)
  ftilt2: {
    dur: 26, iasa: 20, pose: 'jab2', next: 'ftilt3', nextWin: [14, 24], combo: true,
    vel: [{ f: [5, 8], fwd: 3 }],
    hits: [hb(9, 11, [0, 1.3, 0.8], 0.6, 5, 40, 16, 40, { sfx: 'hitM', blood: 0.6 })],
  },
  ftilt3: {
    dur: 34, iasa: 30, pose: 'ftilt',
    vel: [{ f: [6, 10], fwd: 4.5 }],
    hits: [hb(11, 14, [0, 1.2, 1.05], 0.6, 8.5, 40, 34, 88, { sfx: 'hitL', blood: 1.4, hitlag: 1.15 })],
  },
  // A while running: he throws himself forward on his skateboard, low
  dashattack: dashAttack({ pose: 'slide', boost: 14, fric: 8, dur: 42, iasa: 38,
    onStart(F, W) { W.emit('sfx', { s: F.slot, n: 'skate' }); },
    hits: [
      hb(4, 9, [0, 0.45, 0.95], 0.75, 9, 32, 40, 70, { sfx: 'hitM', blood: 0.8 }),
      hb(10, 24, [0, 0.4, 0.85], 0.6, 4, 70, 30, 40, { sfx: 'hitS', blood: 0.4, grp: 1 }),
    ] }),

  // Tchatche : he talks and talks, the words come out in bubbles and leave whoever they touch dizzy
  sp_n: {
    dur: 64, iasa: 58, pose: 'bite', airCtrl: 0.4,
    onFrame(F, W, f) {
      if (f === 4) W.emit('skankyTalk', { s: F.slot, n: 0 });
      if (f === 10 || f === 22 || f === 34 || f === 46) {
        const k = (f - 10) / 12;
        shoot(W, F, 'proj', 6 + k * 0.6, { look: 'blabla', b: W.rng.int(0, WORDS - 1), r: 0.5, dmg: 2, ang: 0, kbb: 0, kbg: 0, life: 44, drag: 2.2,
          effect: 'stun', stun: 34, sfx: 'blabla', blood: 0 }, [0, 1.6 + (k % 2) * 0.25, 0.95], F.facing, 0.6 - (k % 2) * 1.2);
        W.emit('sfx', { s: F.slot, n: 'blabla' });
      }
      if (f === 30) W.emit('skankyTalk', { s: F.slot, n: 1 });
    },
  },

  // Fraude : he jumps the ticket gate and the train goes through behind him, hitting everyone on the track
  sp_s: {
    dur: 50, iasa: 44, pose: 'jupiter', airCtrl: 0.3,
    vel: [{ f: [4, 16], fwd: 9 }],
    onFrame(F, W, f) {
      F.va[1] = f < 18 ? 1 : 0;
      if (f === 2) W.emit('sfx', { s: F.slot, n: 'whoosh' });
      if (f === 4 && !F.grounded) F.vy = Math.max(F.vy, 4);
      if (f === 14) {
        // from well behind him, along his way; it does not hit him (his own projectile)
        const back = F.x - Math.sin(F.facing) * 13;
        W.spawn('proj', { owner: F.slot, x: back, y: F.y + 1.0, z: 0, vx: Math.sin(F.facing) * 34, vz: 0, vy: 0, dir: F.facing,
          look: 'train', r: 1.25, dmg: 11, ang: 38, kbb: 48, kbg: 72, life: 62, pierce: true, sfx: 'hitL', blood: 1.6, hitlag: 1.3 });
        W.emit('skankyTrain', { s: F.slot, x: back, y: F.y });
      }
    },
    onEnd(F) { F.va[1] = 0; },
  },

  // Ollie : a big ollie on his skateboard, the board hits on the way up; near a ledge he flies to it
  sp_u: {
    dur: 56, pose: 'jupiter', helpless: true, noGrav: [5, 36], airCtrl: 0.6, ledgeGrab: true,
    onFrame(F, W, f) {
      F.va[0] = f < 44 ? 1 : 0;
      if (f === 4) W.emit('skankyOllie', { s: F.slot });
      if (f < 5 && !F.grounded) F.vy = Math.max(F.vy, -1);
      if (f === 5) { F.grounded = false; const L = nearestLedge(W, F, 10); if (L) F.mv.L = L; }
      if (f >= 5 && f <= 36) {
        if (F.mv.L) pullTo(F, F.mv.L, 17);
        else { F.vy = 17 - (f - 5) * 0.34; steerX(F, 7.5); }
      }
    },
    onEnd(F) { F.va[0] = 0; },
    hits: [
      hb(5, 9, [0, 0.3, 0.4], 0.95, 9, 80, 52, 72, { sfx: 'hitL', blood: 1 }),
      hb(10, 24, [0, 0.4, 0.1], 0.8, 3, 80, 20, 30, { sfx: 'hitS', blood: 0.3, grp: 1 }),
    ],
  },

  // Funk de Lyon : he dances, every move of the dance pushes away everyone around him
  sp_d: {
    dur: 70, iasa: 64, pose: 'bite', airCtrl: 0.3,
    onFrame(F, W, f) {
      if (f === 2) W.emit('skankyFunk', { s: F.slot, n: 0 });
      if (f === 16 || f === 34 || f === 54) {
        const n = f === 16 ? 0 : f === 34 ? 1 : 2;
        ring(W, F, { look: 'funk', r: 0.6, grow: 9, life: 18, dmg: 3 + n * 2, ang: 50, kbb: 30 + n * 14, kbg: 40 + n * 12, sfx: 'hitM', blood: 0.2 });
        W.emit('skankyFunk', { s: F.slot, n: n + 1 });
      }
    },
  },
};

export default {
  id: 'skanky', name: 'SKANKY', title: 'Le fraudeur qui parle trop',
  color: '#c8303a',
  stats: { weight: 88, runSpeed: 9.6, walkSpeed: 3.7, airSpeed: 6.3, airAccel: 34, groundAccel: 64, friction: 36,
    jumpVel: 15.8, airJumpVel: 14.0, airJumps: 1, gravity: 1.0, fallSpeed: 18, height: 1.85, radius: 0.46 },
  moves,
  specialsInfo: { n: 'Tchatche', s: 'Fraude', u: 'Ollie', d: 'Funk de Lyon' },
};
