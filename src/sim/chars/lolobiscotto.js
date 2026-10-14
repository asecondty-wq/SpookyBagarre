// Lolobiscotto : du piment qui brûle, du Ricard dans tous ses états, et son petit chat gris et blanc.
import { normals, dashAttack, hb, shoot } from '../kit.js';
import { ENTITIES } from '../entities.js';
import { setOnFire } from './friendKit.js';
import { steerX, nearestLedge, pullTo, xAgain, xHeld } from './recovery.js';
import { DMath } from '../dmath.js';

// the chili: sets the enemy on fire
ENTITIES.chili = {
  onHitFighter(e, V, W) { setOnFire(W, e.owner, V, 5, 1.7); },
};
// the little grey cat: on a hit it clings and scratches, on the floor it chases the nearest enemy
ENTITIES.greycatThrow = {
  onHitFighter(e, V, W) {
    if (V.state === 'dead' || V.out) return;
    for (const o of W.entities) if (o.kind === 'clingcat' && o.owner === e.owner && !o.dead) o.dead = true;
    W.spawn('clingcat', { owner: e.owner, vic: V.slot, x: V.x, y: V.y + V.height * 0.8, z: 0, life: 85, look: 'greycat' });
    W.emit('sfx', { s: e.owner, n: 'meow' });
  },
  onLand(e, W) {
    for (const o of W.entities) if (o.kind === 'minion' && o.owner === e.owner && o.look === 'greycat' && !o.dead) { o.dead = true; W.emit('catPoof', { x: o.x, y: o.y, z: 0 }); }
    W.spawn('minion', { owner: e.owner, x: e.x, y: e.y + 0.05, z: 0, look: 'greycat', a: DMath.atan2(e.vx, 0.0001), hp: 7, life: 220, speed: 8, dmg: 4.5, reach: 0.9, atkCD: 28, ang: 50, kbb: 22, kbg: 40, h: 0.5, r: 0.4 });
    W.emit('sfx', { s: e.owner, n: 'meow' });
  },
};
// it fights like the cats of La Folle Du Bus (same brain)
ENTITIES.minion_greycat = { brain(e, W) { const B = ENTITIES.minion_cat; if (B) B.brain(e, W); } };

// her Ricard puddle: slippery, and the smell of anise makes you dizzy
const moves = {
  ...normals({ power: 1.0, reach: 1.02, speed: 1.1, sfxS: 'slap', sfxM: 'hitM', sfxL: 'hitL' }),
  // A while running: its own dash attack
  dashattack: dashAttack({ pose: 'slide', boost: 12.5, fric: 18, dur: 32, hits: [hb(4, 9, [0, 0.35, 0.95], 0.75, 8, 78, 48, 40, { sfx: 'hitM', blood: 0.9 })] }),

  // neutral A, last hit: bonk with the Ricard bottle
  jab3: {
    dur: 28, iasa: 26, pose: 'smash',
    onFrame(F, W, f) { F.va[0] = f < 20 ? 1 : 0; },
    hits: [hb(6, 9, [0, 1.15, 1.0], 0.75, 5, 40, 32, 84, { sfx: 'clink', blood: 1 })],
    onEnd(F) { F.va[0] = 0; },
  },
  // side smash: the Ricard bottle swung hard, with a splash of pastis
  smash: {
    dur: 44, charge: { at: 8, max: 60 }, pose: 'smash', tilt: 'ftilt',
    onFrame(F, W, f) { F.va[0] = f < 32 ? 1 : 0; if (f === 13) W.emit('pastis', { x: F.x + DMath.sin(F.facing) * 1.2, y: F.y + 1.2, z: 0, a: F.facing }); },
    vel: [{ f: [10, 12], fwd: 5 }],
    hits: [
      hb(13, 16, [0, 1.15, 1.25], 0.95, 15, 36, 40, 96, { sfx: 'clink', blood: 2, hitlag: 1.15 }),
      hb(13, 16, [0, 1.1, 0.5], 0.7, 12, 38, 32, 88, { sfx: 'hitM', blood: 1.4, grp: 0 }),
    ],
    onEnd(F) { F.va[0] = 0; },
  },
  // up smash: a geyser of pastis out of the shaken bottle
  usmash: {
    dur: 44, charge: { at: 6, max: 60 }, pose: 'soda', tilt: 'utilt',
    onFrame(F, W, f) { F.va[0] = f < 30 ? 1 : 0; if (f >= 10 && f <= 20 && f % 2 === 0) W.emit('pastis', { x: F.x, y: F.y + 2.0, z: 0, up: 1 }); },
    hits: [
      hb(10, 17, [0, 2.4, 0.2], 1.0, 2, 88, 0, 0, { fkb: 28, rehit: 4, sfx: 'splash', blood: 0, dir: 'radial' }),
      hb(18, 21, [0, 2.7, 0.2], 1.2, 9, 88, 40, 92, { sfx: 'hitL', blood: 1, dir: 'radial', grp: 1 }),
    ],
    onEnd(F) { F.va[0] = 0; },
  },
  // down smash: chili powder thrown on both sides, it burns
  dsmash: {
    dur: 44, charge: { at: 6, max: 60 }, pose: 'dsmash', tilt: 'dtilt',
    onFrame(F, W, f) { if (f === 10) W.emit('chiliDust', { x: F.x, y: F.y + 0.5, z: 0 }); },
    hits: [
      hb(10, 14, [0, 0.5, 1.4], 0.9, 12, 28, 32, 88, { sfx: 'sizzle', blood: 1.2, dir: 'away', fx: 'fire', onHit: (V, W, hv) => setOnFire(W, hv.owner, V, 2) }),
      hb(10, 14, [0, 0.5, -1.4], 0.9, 12, 28, 32, 88, { sfx: 'sizzle', blood: 1.2, dir: 'away', fx: 'fire', grp: 0, onHit: (V, W, hv) => setOnFire(W, hv.owner, V, 2) }),
    ],
  },

  // Piment : un piment rouge lancé tout droit, l'ennemi prend feu
  sp_n: {
    dur: 30, iasa: 26, pose: 'throw1', airCtrl: 0.6,
    onFrame(F, W, f) {
      F.va[1] = f < 8 ? 1 : 0;
      if (f === 8) {
        shoot(W, F, 'proj', 18, { look: 'chili', custom: 'chili', r: 0.32, dmg: 4, ang: 36, kbb: 16, kbg: 34, life: 50, grav: 0.25, spin: 14, sfx: 'sizzle', blood: 0.3 }, [0, 1.2, 0.6], F.facing, 1.5);
        W.emit('sfx', { s: F.slot, n: 'throw' });
      }
    },
    onEnd(F) { F.va[1] = 0; },
  },

  // Minou gris : son petit chat gris et blanc, lancé ; il s'agrippe et griffe, ou court après l'ennemi
  sp_s: {
    dur: 34, iasa: 30, pose: 'throw1', airCtrl: 0.5,
    onFrame(F, W, f) {
      F.va[2] = f < 11 ? 1 : 0;
      if (f === 6) W.emit('sfx', { s: F.slot, n: 'meow' });
      if (f === 11) {
        shoot(W, F, 'proj', 15, { look: 'greycat', custom: 'greycatThrow', r: 0.45, dmg: 3, ang: 45, kbb: 4, kbg: 8, life: 70, grav: 0.55, spin: 9, sfx: 'scratch', blood: 0.6 }, [0, 1.25, 0.6], F.facing, 3.5);
      }
    },
    onEnd(F) { F.va[2] = 0; },
  },

  // Flaque de Ricard : elle vide la bouteille ; ça glisse, et l'anis fait tourner la tête
  sp_d: {
    dur: 44, iasa: 38, pose: 'sprinkle', airCtrl: 0.4,
    onFrame(F, W, f) {
      F.va[0] = f < 30 ? 1 : 0;
      if (f > 8 && f < 24 && f % 3 === 0) W.emit('pastis', { x: F.x + DMath.sin(F.facing) * 0.7, y: F.y + 0.9, z: 0, pour: 1 });
      if (f === 20) {
        const x = F.x + DMath.sin(F.facing) * 1.1;
        const s = W.stage.findLanding(x, 0, F.y + 0.5, -60);
        const y = s ? W.stage.heightAt(s, x, 0) : F.y;
        W.spawn('puddle', { owner: F.slot, x, y, z: 0, r: 2.3, life: 540, look: 'ricard', safeOwner: true, tripDmg: 3 });
        W.spawn('cloud', { owner: F.slot, x, y: y + 0.7, z: 0, r: 1.5, life: 100, look: 'ricard', effect: 'stun', stun: 32, dmg: 2, rehit: 70, sfx: 'poof' });
      }
    },
    onEnd(F) { F.va[0] = 0; },
  },

  // Pastis-fusée : la bouteille devient une fusée qu'on dirige au stick (elle tourne vers où on pousse)
  sp_u: {
    dur: 56, pose: 'soda', helpless: true, noGrav: [10, 46], airCtrl: 0.2, ledgeGrab: true,
    onStart(F) { F.mv.ang = 0; }, // 0 = straight up, + toward the facing side
    onFrame(F, W, f) {
      F.va[0] = 1;
      if (f < 10 && !F.grounded) F.vy = Math.max(F.vy, -2);
      if (f === 10) { F.grounded = false; W.emit('sfx', { s: F.slot, n: 'fizz' }); }
      if (f >= 10 && f <= 46) {
        const mag = DMath.hypot(F.mx, F.my);
        if (mag > 0.3) {
          const want = DMath.atan2(F.mx, Math.max(-0.3, F.my)); // toward the stick, never straight down
          let d = want - F.mv.ang;
          while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
          F.mv.ang += Math.max(-0.11, Math.min(0.11, d));
        }
        F.mv.ang = Math.max(-1.9, Math.min(1.9, F.mv.ang));
        const sp = 16.5;
        F.vx = DMath.sin(F.mv.ang) * sp; F.vy = DMath.cos(F.mv.ang) * sp;
        if (Math.abs(F.vx) > 1) F.facing = F.vx < 0 ? -Math.PI / 2 : Math.PI / 2;
        if (f % 2 === 0) W.emit('pastis', { x: F.x, y: F.y, z: 0, jet: 1 });
      }
    },
    hits: [
      hb(10, 46, [0, -0.6, 0], 0.9, 1.2, 45, 0, 0, { fkb: 34, rehit: 12, sfx: 'splash', blood: 0, dir: 'radial' }), // the jet pushes away (it used to pin foes down and juggle them)
      hb(10, 14, [0, 1.0, 0.4], 1.0, 7, 75, 40, 66, { sfx: 'hitM', blood: 1.2, grp: 5 }),
    ],
    onEnd(F) { F.va[0] = 0; },
  },
};

export default {
  id: 'lolobiscotto', name: 'Lolobiscotto', title: 'Piment, pastis et petit chat',
  color: '#e8509a',
  stats: { weight: 90, runSpeed: 9.2, walkSpeed: 3.9, airSpeed: 6.8, airAccel: 38, groundAccel: 74, friction: 48,
    jumpVel: 16, airJumpVel: 14, airJumps: 1, gravity: 1.0, fallSpeed: 17.5, height: 1.68, radius: 0.48 },
  moves,
  specialsInfo: { n: 'Piment (ça brûle)', s: 'Minou gris', u: 'Pastis-fusée', d: 'Flaque de Ricard' },
};
