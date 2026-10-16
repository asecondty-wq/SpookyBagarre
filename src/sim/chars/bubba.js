// Gros Cainri Puant : lourd, lent, dévastateur. Burgers explosifs, frites en rafale, soda-fusée, bide atomique.
import { normals, dashAttack, hb, shoot, ring } from '../kit.js';
import { ENTITIES } from '../entities.js';
import { endMove } from '../fighter.js';
import { steerX, nearestLedge, pullTo, xAgain, xHeld } from './recovery.js';
import { DMath } from '../dmath.js';

ENTITIES.burger = {
  onLand(e, W) { boom(e, W); },
  onHitFighter(e, V, W) { boom(e, W); },
};
function boom(e, W) {
  if (e.boomed) return;
  e.boomed = 1;
  W.addHit({ owner: e.owner, key: 'bb' + e.id, x: e.x, y: e.y + 0.4, z: e.z, r: 1.9, dmg: 12, ang: 55, kbb: 40, kbg: 78, dir: 'radial',
    ent: e.id, src: 'proj', sfx: 'splat', blood: 2.2, move: 'sp_n', fx: 'ketchup' });
  W.spawn('puddle', { owner: e.owner, x: e.x, y: e.y, z: e.z, r: 1.7, life: 420, look: 'ketchup' });
  W.emit('burgerBoom', { x: e.x, y: e.y, z: e.z });
}

const moves = {
  ...normals({ power: 1.18, reach: 1.1, speed: 0.85, sfxS: 'slap', sfxM: 'punchHeavy', sfxL: 'punchHeavy', smashLunge: 0.6 }),
  // A while running: its own dash attack
  dashattack: dashAttack({ pose: 'shoulder', boost: 9.5, fric: 18, dur: 40, iasa: 36, hits: [hb(8, 12, [0, 0.95, 0.95], 1.0, 12, 38, 52, 80, { sfx: 'punchHeavy', blood: 1.6, hitlag: 1.2 })] }),

  // Burger bombe : en cloche, explose en ketchup (flaque glissante)
  sp_n: {
    dur: 40, iasa: 36, pose: 'throw2', airCtrl: 0.5,
    onFrame(F, W, f) {
      if (f === 14) {
        shoot(W, F, 'proj', 9.5, { look: 'burger', custom: 'burger', r: 0.5, dmg: 4, ang: 40, kbb: 10, kbg: 20, life: 140, grav: 1.05, spin: 4, sfx: 'splat', blood: 0.5 }, [0, 1.8, 0.6], F.facing, 9.5);
        W.emit('sfx', { s: F.slot, n: 'throw' });
      }
    },
  },

  // Rafale de frites : fusil à pompe de frites
  sp_s: {
    dur: 36, iasa: 32, pose: 'shotgun', airCtrl: 0.4,
    onFrame(F, W, f) {
      if (f === 9) {
        for (let i = 0; i < 9; i++) {
          const spread = (W.rng() - 0.5) * 0.65;
          shoot(W, F, 'proj', 21 + W.rng() * 6, {
            look: 'fry', r: 0.24, dmg: 1.8, ang: 20, fkb: 22, life: 18, grav: 0.3, spin: 20, sfx: 'hitS', blood: 0.5, hitlag: 0.5, multi: true,
          }, [0, 1.1, 0.8], F.facing, spread * 9 + 0.6);
        }
        F.vx -= DMath.sin(F.facing) * 4; F.vz -= DMath.cos(F.facing) * 4;
        W.emit('sfx', { s: F.slot, n: 'shotgun' });
      }
    },
  },

  // Soda à deux étages : la bouteille secouée l'envoie en l'air ; X encore une fois : il en ouvre une deuxième
  sp_u: {
    dur: 76, pose: 'soda', helpless: true, noGrav: [12, 34], airCtrl: 0.6, ledgeGrab: true,
    onFrame(F, W, f) {
      F.va[0] = f < 12 ? DMath.sin(f * 1.7) : 0;
      if (f < 12 && !F.grounded) F.vy = Math.max(F.vy, -2);
      if (f === 12) { F.grounded = false; W.emit('sfx', { s: F.slot, n: 'fizz' }); }
      if (f >= 12 && f <= 34) { F.vy = 17.5 - (f - 12) * 0.12; F.va[1] = 1; steerX(F, 7); }
      // second bottle
      if (!F.mv.two && f >= 16 && f <= 52 && xAgain(F)) { F.mv.two = Math.max(f, 33); W.emit('sfx', { s: F.slot, n: 'fizz' }); W.emit('burgerBoom', { x: F.x, y: F.y, z: 0 }); }
      if (F.mv.two && f >= F.mv.two && f <= F.mv.two + 22) { F.vy = 17 - (f - F.mv.two) * 0.12; F.va[1] = 1; steerX(F, 7.5); }
      else if (f > 34) F.va[1] = Math.max(0, F.va[1] - 0.1);
    },
    hits: [
      hb(12, 34, [0, -0.6, 0], 0.9, 1.3, 45, 0, 0, { fkb: 34, rehit: 12, sfx: 'splash', blood: 0.2, dir: 'radial', fx: 'cola' }), // pushes away (no more pinning juggle)
      hb(12, 16, [0, 1.0, 0.4], 1.1, 8, 75, 40, 70, { sfx: 'punchHeavy', blood: 1.4, grp: 5 }),
    ],
  },

  // Bide atomique : saute et s'écrase ventre en avant, onde de choc ; en l'air, plonge
  sp_d: {
    dur: 66, pose: 'bellyflop', fallMul: 1.8,
    onStart(F) { F.armor = 0; F.mv.dive = F.grounded ? 0 : 1; },
    onFrame(F, W, f) {
      if (f <= 12) F.armor = 85;
      else F.armor = 0;
      if (f === 6 && F.grounded) { F.vy = 11; F.grounded = false; F.vx *= 0.3; F.vz *= 0.3; }
      if (f >= 10 && !F.grounded) { F.vy = Math.min(F.vy, -24); F.va[1] = 1; }
      if (!F.grounded && f > 10 && f < 50) F.mf = Math.min(F.mf, 20);
    },
    onLand(F, W) {
      if (F.mf < 8 || F.mv.slammed) return;
      F.mv.slammed = 1; F.mf = 24; F.armor = 0;
      ring(W, F, { r: 0.6, grow: 16, life: 22, dmg: 9, ang: 78, kbb: 44, kbg: 66, w: 0.9, h: 1.1, look: 'shock', sfx: 'hitL', blood: 1.4 });
      W.addHit({ owner: F.slot, key: 'bs' + F.mseq, x: F.x, y: F.y + 0.6, z: F.z, r: 1.6, dmg: 12, ang: 70, kbb: 46, kbg: 76, dir: 'radial', sfx: 'punchHeavy', blood: 2.4, move: 'sp_d' });
      W.emit('quake', { x: F.x, y: F.y, z: F.z, k: 1.0 });
    },
    hits: [hb(12, 22, [0, 0.4, 0.4], 1.1, 12, -55, 30, 60, { spike: 1, sfx: 'punchHeavy', blood: 2, grp: 9 })],
    onEnd(F) { F.armor = 0; F.va[1] = 0; },
  },
};

export default {
  id: 'bubba', name: 'Gros Cainri Puant', title: 'Freedom, burgers et coups de bide',
  color: '#d6513b',
  stats: { weight: 138, runSpeed: 6.9, walkSpeed: 3.0, airSpeed: 5.0, airAccel: 24, groundAccel: 48, friction: 40,
    jumpVel: 14, airJumpVel: 12, airJumps: 1, gravity: 1.08, fallSpeed: 20, height: 2.0, radius: 0.78 },
  moves,
  specialsInfo: { n: 'Burger bombe', s: 'Rafale de frites', u: 'Soda-fusée', d: 'Bide atomique' },
};

export { endMove };
