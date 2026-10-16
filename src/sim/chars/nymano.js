// Nymano : toujours triste, il pleure tout le temps (on glisse sur ses larmes). Il roule en skate, frappe avec
// sa planche, et balance des samples sur sa SP-404.
import { normals, dashAttack, hb, shoot } from '../kit.js';
import { endMove, sleepFor } from '../fighter.js';
import { layslick } from './friendKit.js';
import { steerX, nearestLedge, pullTo, xAgain, xHeld } from './recovery.js';
import { DMath } from '../dmath.js';

// a puddle of his tears: whoever walks in it slips, falls, gets hurt and stays down 2 s (like the Ricard)
function tears(W, F, x, r = 1.6, life = 540) {
  const s = W.stage.findLanding(x, 0, F.y + 0.5, -60);
  if (!s) return;
  layslick(W, F, { x, y: W.stage.heightAt(s, x, 0), look: 'tears', r, life, dmg: 4, stun: 120 });
}

const moves = {
  ...normals({ power: 1.04, reach: 1.06, speed: 1.06, sfxS: 'slap', sfxM: 'sample', sfxL: 'hitL' }),
  // A while running: its own dash attack
  dashattack: dashAttack({ pose: 'shoulder', boost: 13, fric: 10, dur: 36, onFrame(F) { F.va[3] = F.mf < 30 ? 1 : 0; }, onEnd(F) { F.va[3] = 0; }, hits: [hb(5, 12, [0, 0.8, 0.9], 0.8, 9, 40, 42, 70, { sfx: 'hitM', blood: 1 })] }),

  // neutral A: three blows of the skateboard; the third sends a little
  jab1: {
    dur: 20, iasa: 16, next: 'jab2', nextWin: [7, 19], pose: 'jab1', combo: true,
    onFrame(F) { F.va[0] = 1; }, onEnd(F) { F.va[0] = 0; },
    hits: [hb(5, 7, [0, 1.15, 0.85], 0.55, 3, 30, 10, 22, { sfx: 'woodM', blood: 0.6 })],
  },
  jab2: {
    dur: 22, iasa: 18, next: 'jab3', nextWin: [8, 21], pose: 'jab2', combo: true,
    onFrame(F) { F.va[0] = 1; }, onEnd(F) { F.va[0] = 0; },
    hits: [hb(6, 8, [0, 1.0, 0.95], 0.58, 3.5, 35, 12, 24, { sfx: 'woodM', blood: 0.7 })],
  },
  jab3: {
    dur: 34, iasa: 30, pose: 'jab3',
    onFrame(F) { F.va[0] = 1; }, onEnd(F) { F.va[0] = 0; },
    vel: [{ f: [6, 9], fwd: 3 }],
    hits: [hb(9, 12, [0, 1.05, 1.05], 0.65, 6, 40, 34, 70, { sfx: 'woodL', blood: 1.2, hitlag: 1.1 })],
  },
  // side smash: the skateboard swung like a bat, a big one
  smash: {
    dur: 46, charge: { at: 8, max: 60 }, pose: 'smash', tilt: 'ftilt',
    onFrame(F, W, f) { F.va[0] = f < 34 ? 1 : 0; },
    vel: [{ f: [10, 12], fwd: 5 }],
    hits: [
      hb(13, 16, [0, 1.15, 1.35], 0.75, 17, 36, 42, 100, { sfx: 'woodL', blood: 2.2, hitlag: 1.25 }),
      hb(13, 16, [0, 1.05, 0.6], 0.6, 12, 38, 32, 88, { sfx: 'woodM', blood: 1.4, grp: 0 }),
    ],
    onEnd(F) { F.va[0] = 0; },
  },
  // up smash: a kickflip, the board spins over his head
  usmash: {
    dur: 44, charge: { at: 6, max: 60 }, pose: 'uair', tilt: 'utilt',
    vel: [{ f: [8, 9], up: 5 }],
    onFrame(F, W, f) { F.va[2] = f >= 6 && f <= 24 ? (f - 6) / 18 : 0; if (f === 8) W.emit('sfx', { s: F.slot, n: 'kickflip' }); },
    hits: [hb(10, 15, [0, 2.25, 0.3], 0.85, 15, 86, 38, 94, { sfx: 'woodL', blood: 1.8, dir: 'radial' })],
    onEnd(F) { F.va[2] = 0; },
  },
  // down smash: he bursts into tears, loud: a burst of tears all around him, it sends sideways
  dsmash: {
    dur: 48, charge: { at: 6, max: 60 }, pose: 'dsmash', tilt: 'dtilt',
    onFrame(F, W, f) { if (f === 10) W.emit('sob', { s: F.slot, x: F.x, y: F.y + 1.6, z: 0, big: 1, burst: 1 }); },
    hits: [
      hb(10, 14, [0, 0.7, 1.3], 0.8, 13, 22, 36, 92, { sfx: 'splash', blood: 0.3, dir: 'away', fx: 'water' }),
      hb(10, 14, [0, 0.7, -1.3], 0.8, 13, 22, 36, 92, { sfx: 'splash', blood: 0.3, dir: 'away', grp: 0, fx: 'water' }),
      hb(10, 13, [0, 1.0, 0], 0.7, 9, 30, 28, 80, { sfx: 'splash', blood: 0.2, dir: 'away', grp: 0, fx: 'water' }),
    ],
  },

  // SP-404 (X maintenu) : il s'assoit et joue un morceau tout doux ; celui qui reste 2 s dans la musique
  // s'endort 3 s (4 s de musique au plus)
  sp_n: {
    dur: 30, iasa: 26, pose: 'grate', airCtrl: 0.4,
    onStart(F, W) { F.mv.n = 0; F.mv.zz = {}; W.emit('sp404', { s: F.slot, x: F.x, y: F.y + 1, z: 0, on: 1 }); },
    onFrame(F, W, f) {
      F.va[1] = 1;
      if (!F.grounded) { F.vx *= 0.9; F.vy = Math.max(F.vy - 0.2, -3); }
      if (f === 10 && xHeld(F) && F.mv.n < 240) { F.mv.n++; F.mf = 9; }
      if (f >= 6 && f <= 10) {
        if (F.mv.n % 12 === 0) W.emit('sp404', { s: F.slot, x: F.x, y: F.y + 1.2, z: 0, n: F.mv.n });
        // the ones in the music (3 m around him) fall asleep after 2 s in it; out of it, it wears off
        for (const V of W.list) {
          if (V === F || V.out || V.state === 'dead' || V.state === 'respawn' || (W.rules.teams && V.team === F.team)) continue;
          const k = 'v' + V.slot, inside = DMath.hypot(V.x - F.x, V.y - F.y) < 3.0;
          F.mv.zz[k] = inside ? (F.mv.zz[k] || 0) + 1 : Math.max(0, (F.mv.zz[k] || 0) - 2);
          if (F.mv.zz[k] >= 120 && V.state !== 'dizzy') { if (sleepFor(V, 180)) W.emit('asleep', { s: V.slot, x: V.x, y: V.y + 1.8, z: 0 }); F.mv.zz[k] = -9999; }
        }
      }
    },
    onEnd(F) { F.va[1] = 0; },
  },

  // Skate : il saute sur sa planche et fonce devant lui ; en l'air il plane un peu
  sp_s: {
    dur: 46, iasa: 40, pose: 'sprint', noGrav: [0, 14], airCtrl: 0,
    onStart(F) { if (!F.grounded) F.vy = Math.max(F.vy, 3); },
    onFrame(F, W, f) {
      F.va[3] = f <= 36 ? 1 : 0; // on the board
      if (f <= 34) {
        if (!F.mv.turned && f > 5 && Math.abs(F.mx) > 0.6 && Math.sign(F.mx) !== Math.sign(DMath.sin(F.facing))) { F.facing += Math.PI; F.mv.turned = 1; }
        F.vx = DMath.sin(F.facing) * (f < 4 ? 8 : 15);
        if (!F.grounded) F.vy = Math.max(F.vy - 0.3, -3);
        if (f % 5 === 0 && F.grounded) W.emit('sfx', { s: F.slot, n: 'skate' });
      } else F.vx *= 0.85;
    },
    hits: [hb(4, 34, [0, 0.7, 0.8], 0.85, 9, 40, 44, 62, { sfx: 'woodM', blood: 1.4, rehit: 99 })],
    onEnd(F) { F.va[3] = 0; },
  },

  // Flaque de larmes : il pleure toutes les larmes de son corps devant lui ; celui qui marche dedans glisse,
  // tombe, se fait mal et reste au sol 2 s
  sp_d: {
    dur: 46, iasa: 40, pose: 'drum', airCtrl: 0.4,
    onFrame(F, W, f) {
      if (f % 10 === 0 && f <= 30) W.emit('sob', { s: F.slot, x: F.x, y: F.y + 1.4, z: 0 });
      if (f === 20) tears(W, F, F.x + DMath.sin(F.facing) * 1.2);
    },
  },

  // Ollie géant : la planche le catapulte, puis il plane (X tenu) ; près d'un bord, il grinde dessus
  sp_u: {
    dur: 90, pose: 'breach', helpless: true, airCtrl: 0.7, ledgeGrab: true,
    onFrame(F, W, f) {
      F.va[3] = f < 80 ? 1 : 0;
      if (f === 4) { F.grounded = false; F.vy = 24; W.emit('sfx', { s: F.slot, n: 'kickflip' }); }
      if (f > 4 && f <= 80) {
        if (!F.mv.L && f >= 8) { const L = nearestLedge(W, F, 4.5); if (L) { F.mv.L = L; W.emit('sfx', { s: F.slot, n: 'skate' }); } }
        if (F.mv.L) pullTo(F, F.mv.L, 18);
        else {
          steerX(F, 8, 0.12);
          if (f > 18 && xHeld(F)) F.vy = Math.max(F.vy, -1.6); // glide
        }
      }
    },
    hits: [hb(4, 10, [0, 0.4, 0.4], 1.1, 8, 80, 40, 66, { sfx: 'woodM', blood: 1, dir: 'radial' })],
    onEnd(F) { F.va[3] = 0; },
  },
};

export default {
  id: 'nymano', name: 'Nymano', title: 'Il pleure, il ride, il sample',
  color: '#3d7fd9',
  // he is always crying: a tear now and then (purely for the looks)
  tick(F, W) { if (W.tick % 50 === F.slot * 7 && F.state !== 'dead' && !F.out) W.emit('tear', { s: F.slot }); },
  stats: { weight: 100, runSpeed: 10.2, walkSpeed: 4.0, airSpeed: 6.4, airAccel: 32, groundAccel: 50, friction: 26,
    jumpVel: 15.8, airJumpVel: 13.8, airJumps: 1, gravity: 1.0, fallSpeed: 17.5, height: 1.8, radius: 0.5 },
  moves,
  specialsInfo: { n: 'SP-404 (maintenir : on s’endort)', s: 'Skate', u: 'Ollie géant', d: 'Flaque de larmes (on glisse, on tombe)' },
};

export { endMove };
