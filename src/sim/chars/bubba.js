// Gros Cainri Puant : lourd, lent, dévastateur. Burgers explosifs, frites en rafale, soda-fusée, bide atomique.
import { normals, hb, shoot, ring } from '../kit.js';
import { ENTITIES } from '../entities.js';
import { endMove } from '../fighter.js';

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
  ...normals({ power: 1.25, reach: 1.12, speed: 0.85, sfxS: 'slap', sfxM: 'punchHeavy', sfxL: 'punchHeavy', smashLunge: 0.6 }),

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
          }, [0, 1.1, 0.8], F.facing + spread, (W.rng() - 0.3) * 3);
        }
        F.vx -= Math.sin(F.facing) * 4; F.vz -= Math.cos(F.facing) * 4;
        W.emit('sfx', { s: F.slot, n: 'shotgun' });
      }
    },
  },

  // Soda-fusée : secoue le gobelet géant, décolle sur un geyser de cola
  sp_u: {
    dur: 48, pose: 'soda', helpless: true, noGrav: [12, 36], airCtrl: 0.9, ledgeGrab: true,
    onFrame(F, W, f) {
      F.va[0] = f < 12 ? Math.sin(f * 1.7) : 0;
      if (f < 12 && !F.grounded) F.vy = Math.max(F.vy, -2);
      if (f === 12) { F.grounded = false; W.emit('sfx', { s: F.slot, n: 'fizz' }); }
      if (f >= 12 && f <= 36) { F.vy = 15.5 - (f - 12) * 0.12; F.va[1] = 1; }
      else F.va[1] = Math.max(0, F.va[1] - 0.1);
    },
    hits: [
      hb(12, 36, [0, -0.6, 0], 1.0, 1.6, -60, 0, 0, { fkb: 30, rehit: 5, sfx: 'splash', blood: 0.2, dir: 'radial', fx: 'cola' }),
      hb(12, 16, [0, 1.0, 0.4], 1.1, 8, 75, 40, 70, { sfx: 'punchHeavy', blood: 1.4, grp: 5 }),
    ],
  },

  // Bide atomique : saute et s'écrase ventre en avant, onde de choc ; en l'air, plonge
  sp_d: {
    dur: 52, pose: 'bellyflop', fallMul: 1.8,
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
      ring(W, F, { r: 0.6, grow: 16, life: 22, dmg: 11, ang: 78, kbb: 44, kbg: 66, w: 0.9, h: 1.1, look: 'shock', sfx: 'hitL', blood: 1.4 });
      W.addHit({ owner: F.slot, key: 'bs' + F.mseq, x: F.x, y: F.y + 0.6, z: F.z, r: 1.6, dmg: 14, ang: 70, kbb: 48, kbg: 80, dir: 'radial', sfx: 'punchHeavy', blood: 2.4, move: 'sp_d' });
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
