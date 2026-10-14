// PPROD : l'ingé son qui s'y connaît beaucoup trop, un gros geek. Il s'assoit sur sa chaise gamer et code : des bugs
// sortent du PC et sautent sur les adversaires ; il leur jette des pièces et des liasses de billets à la figure, des
// pizzas, et quand il court il glisse sur des spaghettis (il en laisse partout).
// Prop flags (src/render/rig/pprodRig.js): va[0] the gaming chair under him, va[1] the laptop on his lap,
// va[2] the chair spinning (the turbo chair), va[3] coins / cash in the hand, va[4] a pizza in the hand.
import { normals, dashAttack, hb, shoot } from '../kit.js';
import { ENTITIES } from '../entities.js';
import { steerX, nearestLedge, pullTo } from './recovery.js';
import { DMath } from '../dmath.js';

// the bugs out of the PC: they hop along the ground toward the nearest foe
ENTITIES.bug = {
  stepExtra(e) { if (e.t % 2 === 0) e.a = (e.a || 0) + 0.6; },
};
// the spaghetti he slides on: a slippery trail where he passed
function spaghetti(W, F, r = 1.3, life = 300) {
  W.spawn('puddle', { owner: F.slot, x: F.x, y: F.y, z: 0, r, life, look: 'spaghetti', safeOwner: true });
}

const moves = {
  ...normals({ power: 1.0, reach: 1.02, speed: 1.04, sfxS: 'slap', sfxM: 'hitM', sfxL: 'hitL' }),
  // side A tapped twice: an elbow; three times: a lunging roundhouse (his own clips, not the kit's backside and head)
  ftilt2: {
    dur: 26, iasa: 20, pose: 'jab2', next: 'ftilt3', nextWin: [14, 24], combo: true,
    vel: [{ f: [5, 8], fwd: 3 }],
    hits: [hb(9, 11, [0, 1.25, 0.8], 0.6, 5, 40, 16, 40, { sfx: 'hitM', blood: 0.6 })],
  },
  ftilt3: {
    dur: 34, iasa: 30, pose: 'ftilt',
    vel: [{ f: [6, 10], fwd: 4.5 }],
    hits: [hb(11, 14, [0, 1.15, 1.0], 0.6, 8.5, 40, 34, 88, { sfx: 'hitL', blood: 1.4, hitlag: 1.15 })],
  },
  // A while running: a long slide on a plate of spaghetti, feet first, it leaves the pasta behind
  dashattack: dashAttack({ pose: 'slide', boost: 13, fric: 9, dur: 46, iasa: 42,
    onStart(F, W) { spaghetti(W, F, 1.5, 360); W.emit('sfx', { s: F.slot, n: 'splat' }); },
    onFrame(F, W, f) { if (f === 18) spaghetti(W, F, 1.3, 300); },
    hits: [
      hb(4, 9, [0, 0.4, 0.95], 0.75, 9, 30, 40, 70, { sfx: 'hitM', blood: 0.8 }),
      hb(10, 26, [0, 0.35, 0.85], 0.65, 4, 70, 30, 40, { sfx: 'hitS', blood: 0.4, grp: 1 }),
    ] }),

  // Compilation : he sits on his gaming chair, codes on his laptop, the bugs come out of it, then the 404 window
  sp_n: {
    dur: 72, iasa: 66, pose: 'bite', airCtrl: 0.3,
    onFrame(F, W, f) {
      F.va[0] = f < 66 ? 1 : 0; F.va[1] = f >= 4 && f < 62 ? 1 : 0;
      if (f === 6) W.emit('sfx', { s: F.slot, n: 'typing' });
      if (f === 20 || f === 32 || f === 44) {
        const k = (f - 20) / 12;
        shoot(W, F, 'proj', 6.5 + k, { look: 'bug', custom: 'bug', r: 0.36, dmg: 4, ang: 50, kbb: 18, kbg: 40, life: 150, grav: 1.2, bounce: 0.9,
          home: 0.05, homeDelay: 12, homeRange: 12, sfx: 'zapS', blood: 0.2, armT: 3 }, [0, 0.9, 0.7], F.facing, 6 + k);
        W.emit('sfx', { s: F.slot, n: 'blip' });
      }
      if (f === 54) {
        shoot(W, F, 'proj', 11, { look: 'popup', r: 0.6, dmg: 8, ang: 40, kbb: 32, kbg: 62, life: 46, sfx: 'zap', blood: 0.3 }, [0, 1.15, 0.8]);
        W.emit('sfx', { s: F.slot, n: 'error' });
      }
    },
    onEnd(F) { F.va[0] = 0; F.va[1] = 0; },
  },

  // Pluie de billets : a handful of coins in the face, then a fat wad of cash
  sp_s: {
    dur: 44, iasa: 38, pose: 'throw1', airCtrl: 0.6,
    onFrame(F, W, f) {
      F.va[3] = f < 22 ? 1 : 0;
      if (f === 10) {
        for (let i = 0; i < 5; i++) {
          shoot(W, F, 'proj', 14 + (i % 3), { look: 'coin', r: 0.22, dmg: 2.2, ang: 40, kbb: 5, kbg: 10, life: 40, grav: 0.6, spin: 20, sfx: 'cash', blood: 0.1 },
            [0, 1.25, 0.6], F.facing, -1.5 + i * 1.3);
        }
        W.emit('sfx', { s: F.slot, n: 'cash' });
      }
      if (f === 19) {
        shoot(W, F, 'proj', 15, { look: 'cashstack', r: 0.4, dmg: 7, ang: 40, kbb: 32, kbg: 62, life: 44, grav: 0.4, spin: 9, sfx: 'hitM', blood: 0.4 }, [0, 1.3, 0.6], F.facing, 1.5);
        W.emit('sfx', { s: F.slot, n: 'throw' });
      }
    },
    onEnd(F) { F.va[3] = 0; },
  },

  // Pizza volante : a whole pizza thrown like a frisbee, it skips once on the floor
  sp_d: {
    dur: 46, iasa: 40, pose: 'throw1', airCtrl: 0.6,
    onFrame(F, W, f) {
      F.va[4] = f < 16 ? 1 : 0;
      if (f === 16) {
        shoot(W, F, 'proj', 13, { look: 'pizza', r: 0.6, dmg: 9, ang: 45, kbb: 38, kbg: 66, life: 62, grav: 0.35, bounce: 0.55, spin: 14, sfx: 'splat', blood: 0.3 },
          [0, 1.2, 0.7], F.facing, 3);
        W.emit('sfx', { s: F.slot, n: 'throw' });
      }
    },
    onEnd(F) { F.va[4] = 0; },
  },

  // Chaise turbo : his gaming chair rockets him up, spinning (it hits on the way); near a ledge it flies to it
  sp_u: {
    dur: 62, pose: 'jupiter', helpless: true, noGrav: [6, 42], airCtrl: 0.5, ledgeGrab: true,
    onFrame(F, W, f) {
      F.va[0] = f < 50 ? 1 : 0; F.va[2] = f >= 6 && f < 44 ? 1 : 0;
      if (f === 5) W.emit('sfx', { s: F.slot, n: 'helico' });
      if (f < 6 && !F.grounded) F.vy = Math.max(F.vy, -1);
      if (f === 6) { F.grounded = false; const L = nearestLedge(W, F, 10.5); if (L) F.mv.L = L; }
      if (f >= 6 && f <= 42) {
        if (F.mv.L) pullTo(F, F.mv.L, 17.5);
        else { F.vy = 16.5 - (f - 6) * 0.28; steerX(F, 7); }
      }
    },
    onEnd(F) { F.va[0] = 0; F.va[2] = 0; },
    hits: [
      hb(6, 9, [0, 0.9, 0.3], 1.0, 8, 82, 50, 70, { sfx: 'hitL', blood: 1, dir: 'radial' }),
      hb(10, 30, [0, 0.8, 0], 0.95, 2, 85, 0, 0, { fkb: 26, rehit: 5, sfx: 'hitS', blood: 0.3, grp: 1, dir: 'radial' }),
    ],
  },
};

export default {
  id: 'pprod', name: 'PPROD', title: "L'ingé son beaucoup trop geek",
  color: '#9aa4b4',
  stats: { weight: 96, runSpeed: 9.0, walkSpeed: 3.5, airSpeed: 6.1, airAccel: 33, groundAccel: 62, friction: 40,
    jumpVel: 15.4, airJumpVel: 13.8, airJumps: 1, gravity: 1.0, fallSpeed: 17.5, height: 1.78, radius: 0.5 },
  moves,
  specialsInfo: { n: 'Compilation', s: 'Pluie de billets', u: 'Chaise turbo', d: 'Pizza volante' },
};
