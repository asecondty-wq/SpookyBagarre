// Lolobiscotto : portée moyenne, rapide et agile. Du piment qui brûle (mangé puis recraché en boule de feu), du
// Ricard dans tous ses états (bouteille fracassée, flaque où l'on glisse, fusée), un mawashi-geri, et son petit
// chat gris et blanc (des claques de chat en rafale, le chat qui s'agrippe).
import { normals, dashAttack, hb, shoot, rapidJab } from '../kit.js';
import { ENTITIES } from '../entities.js';
import { slowFor } from '../fighter.js';
import { setOnFire, layslick } from './friendKit.js';
import { localToWorld } from '../util.js';
import { DMath } from '../dmath.js';

// the chili: sets the enemy on fire
ENTITIES.chili = {
  onHitFighter(e, V, W) { setOnFire(W, e.owner, V, 5, 1.7); },
};
// the fireball spat after eating a chili (side smash): short, it burns
ENTITIES.fireSpit = {
  onHitFighter(e, V, W) { e.hitOnce = 1; setOnFire(W, e.owner, V, 2); W.emit('fireBurst', { x: e.x, y: e.y, z: 0 }); },
  onDie(e, W) { if (!e.hitOnce) W.emit('fireBurst', { x: e.x, y: e.y, z: 0, small: 1 }); },
};
// the little grey cat: on a hit it clings, scratches and slows down; on the floor it chases the nearest enemy
ENTITIES.greycatThrow = {
  onHitFighter(e, V, W) {
    if (V.state === 'dead' || V.out) return;
    for (const o of W.entities) if (o.kind === 'clingcat' && o.owner === e.owner && !o.dead) o.dead = true;
    W.spawn('clingcat', { owner: e.owner, vic: V.slot, x: V.x, y: V.y + V.height * 0.8, z: 0, life: 120, look: 'greycat' });
    slowFor(V, 120, 0.6);
    W.emit('slowed', { s: V.slot, x: V.x, y: V.y + 1.6, z: 0 });
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

const moves = {
  ...normals({ power: 1.0, reach: 1.02, speed: 1.12, sfxS: 'slap', sfxM: 'hitM', sfxL: 'hitL' }),
  // A while running: its own dash attack
  dashattack: dashAttack({ pose: 'slide', boost: 12.5, fric: 18, dur: 32, hits: [hb(4, 9, [0, 0.35, 0.95], 0.75, 8, 78, 48, 40, { sfx: 'hitM', blood: 0.9 })] }),

  // neutral A: cat slaps, as many as A is mashed (no finisher)
  jab1: rapidJab({ loop: [3, 13], every: 3, start: 2, tail: 8, at: [0, 1.15, 0.7], r: 0.48, dmg: 0.8, ang: 60, kbb: 3, kbg: 3, fkb: 10, sfx: 'scratch', blood: 0.5, pose: 'jab1' }),
  // side smash: a chili eaten, then a fireball spat out (short range, it sends far and burns)
  smash: {
    dur: 46, charge: { at: 8, max: 60 }, pose: 'smash', tilt: 'ftilt',
    onFrame(F, W, f) {
      F.va[1] = f >= 2 && f < 11 ? 1 : 0; // the chili in her hand, to the mouth
      if (f === 13) {
        const c = (F.mv.charge || 0) / 60;
        shoot(W, F, 'proj', 15, { look: 'fireball', custom: 'fireSpit', r: 0.5, dmg: 15 * (1 + 0.45 * c), ang: 40, kbb: 40 + 10 * c, kbg: 96, life: 15, sfx: 'flameL', blood: 1.4, hitlag: 1.2, fx: 'fire' }, [0, 1.3, 0.75], F.facing, -1);
        W.emit('fireSpit', { s: F.slot, x: F.x + DMath.sin(F.facing) * 0.7, y: F.y + 1.3, z: 0, c });
      }
    },
    onEnd(F) { F.va[1] = 0; },
  },
  // up smash: a big mawashi-geri straight up
  usmash: {
    dur: 44, charge: { at: 6, max: 60 }, pose: 'usmash', tilt: 'utilt',
    hits: [
      hb(10, 14, [0, 2.05, 0.55], 0.62, 16, 82, 38, 98, { sfx: 'hitL', blood: 2, dir: 'radial', hitlag: 1.15 }),
      hb(9, 12, [0, 1.25, 0.6], 0.5, 11, 78, 30, 86, { sfx: 'hitM', blood: 1.2, grp: 0, dir: 'radial' }),
    ],
  },
  // down smash: the Ricard bottle smashed on the floor at her feet, toward where she faces (glass and pastis)
  dsmash: {
    dur: 44, charge: { at: 6, max: 60 }, pose: 'dsmash', tilt: 'dtilt',
    onFrame(F, W, f) {
      F.va[3] = f >= 2 && f < 10 ? 1 : 0; // the bottle in her left hand (the one that throws)
      if (f === 10) { const p = localToWorld(F, [0, 0.1, 1.0]); W.emit('bottleSmash', { s: F.slot, x: p[0], y: F.y + 0.1, z: 0 }); }
    },
    hits: [
      hb(10, 13, [0, 0.4, 1.0], 0.75, 14, 30, 34, 92, { sfx: 'clink', blood: 1.6, dir: 'away', hitlag: 1.15 }),
      hb(10, 12, [0, 0.4, 0.35], 0.5, 10, 32, 28, 82, { sfx: 'splash', blood: 0.6, dir: 'away', grp: 0 }),
    ],
    onEnd(F) { F.va[3] = 0; },
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

  // Minou gris : son petit chat gris et blanc, lancé ; il s'agrippe (ça ralentit) et griffe, ou court après l'ennemi
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

  // Flaque de Ricard : elle vide la bouteille ; celui qui marche dedans glisse, tombe, se fait mal, et reste au
  // sol 2 s
  sp_d: {
    dur: 44, iasa: 38, pose: 'sprinkle', airCtrl: 0.4,
    onFrame(F, W, f) {
      F.va[0] = f < 30 ? 1 : 0;
      if (f > 8 && f < 24 && f % 3 === 0) W.emit('pastis', { x: F.x + DMath.sin(F.facing) * 0.7, y: F.y + 0.9, z: 0, pour: 1 });
      if (f === 20) {
        const x = F.x + DMath.sin(F.facing) * 1.3;
        const s = W.stage.findLanding(x, 0, F.y + 0.5, -60);
        const y = s ? W.stage.heightAt(s, x, 0) : F.y;
        layslick(W, F, { x, y, look: 'ricard', r: 1.5, life: 540, dmg: 4, stun: 120 });
      }
    },
    onEnd(F) { F.va[0] = 0; },
  },

  // Pastis-fusée : la bouteille devient une fusée qu'on dirige au stick ; celui qu'elle touche est emporté (des
  // petits coups tout du long), le dernier l'éjecte un peu
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
        if (f % 2 === 0) W.emit('pastis', { x: F.x, y: F.y, z: 0, jet: 1, a: F.mv.ang });
      }
    },
    hits: [
      hb(11, 44, [0, 0.8, 0.1], 0.9, 1.1, 80, 10, 10, { sfx: 'splash', blood: 0.2, rehit: 5, drag: [0.5, 0.3, 12] }),
      hb(46, 48, [0, 0.9, 0.3], 1.0, 4, 78, 32, 60, { sfx: 'hitM', blood: 0.8, dir: 'radial', grp: 2 }),
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
  specialsInfo: { n: 'Piment (ça brûle)', s: 'Minou gris (il s’agrippe, ralentit)', u: 'Pastis-fusée', d: 'Flaque de Ricard (on glisse, on tombe)' },
};
