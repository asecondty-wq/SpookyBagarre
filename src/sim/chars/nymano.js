// Nymano : toujours triste, il pleure tout le temps (on glisse sur ses larmes). Il roule en skate, frappe avec
// sa planche, et balance des samples sur sa SP-404.
import { normals, dashAttack, hb, shoot } from '../kit.js';
import { endMove } from '../fighter.js';
import { steerX, nearestLedge, pullTo, xAgain, xHeld } from './recovery.js';
import { DMath } from '../dmath.js';

function tears(W, F, x, r = 1.7, life = 360) {
  const s = W.stage.findLanding(x, 0, F.y + 0.5, -60);
  if (!s) return;
  W.spawn('puddle', { owner: F.slot, x, y: W.stage.heightAt(s, x, 0), z: 0, r, life, look: 'tears', safeOwner: true, tripDmg: 2 });
}

const moves = {
  ...normals({ power: 1.04, reach: 1.06, speed: 1.06, sfxS: 'slap', sfxM: 'sample', sfxL: 'hitL' }),
  // A while running: its own dash attack
  dashattack: dashAttack({ pose: 'shoulder', boost: 13, fric: 10, dur: 36, onFrame(F) { F.va[3] = F.mf < 30 ? 1 : 0; }, onEnd(F) { F.va[3] = 0; }, hits: [hb(5, 12, [0, 0.8, 0.9], 0.8, 9, 40, 42, 70, { sfx: 'hitM', blood: 1 })] }),

  // neutral A, last hit: a hit on the pads of the SP-404, a short blast of sound
  jab3: {
    dur: 28, iasa: 26, pose: 'grate',
    onFrame(F, W, f) { F.va[1] = f < 22 ? 1 : 0; if (f === 6) W.emit('sample', { s: F.slot, x: F.x + DMath.sin(F.facing) * 0.9, y: F.y + 1.1, z: 0, a: F.facing }); },
    hits: [hb(6, 9, [0, 1.1, 1.1], 0.85, 5, 40, 32, 82, { sfx: 'sample', blood: 0.8 })],
    onEnd(F) { F.va[1] = 0; },
  },
  // side smash: the skateboard swung like a bat
  smash: {
    dur: 46, charge: { at: 8, max: 60 }, pose: 'smash', tilt: 'ftilt',
    onFrame(F, W, f) { F.va[0] = f < 32 ? 1 : 0; },
    vel: [{ f: [10, 12], fwd: 5 }],
    hits: [
      hb(13, 16, [0, 1.1, 1.4], 1.0, 16, 36, 40, 98, { sfx: 'woodL', blood: 2.1, hitlag: 1.2 }),
      hb(13, 16, [0, 1.0, 0.6], 0.75, 12, 38, 32, 88, { sfx: 'woodM', blood: 1.4, grp: 0 }),
    ],
    onEnd(F) { F.va[0] = 0; },
  },
  // up smash: a kickflip, the board spins over his head
  usmash: {
    dur: 44, charge: { at: 6, max: 60 }, pose: 'uair', tilt: 'utilt',
    vel: [{ f: [8, 9], up: 5 }],
    onFrame(F, W, f) { F.va[2] = f >= 6 && f <= 24 ? (f - 6) / 18 : 0; if (f === 8) W.emit('sfx', { s: F.slot, n: 'kickflip' }); },
    hits: [hb(10, 15, [0, 2.4, 0.2], 1.1, 15, 86, 38, 94, { sfx: 'woodL', blood: 1.8, dir: 'radial' })],
    onEnd(F) { F.va[2] = 0; },
  },
  // down smash: he bursts into tears, splashes on both sides and leaves puddles
  dsmash: {
    dur: 48, charge: { at: 6, max: 60 }, pose: 'dsmash', tilt: 'dtilt',
    onFrame(F, W, f) {
      if (f === 10) { W.emit('sob', { s: F.slot, x: F.x, y: F.y + 1.6, z: 0, big: 1 }); tears(W, F, F.x - 1.5, 1.2, 240); tears(W, F, F.x + 1.5, 1.2, 240); }
    },
    hits: [
      hb(10, 14, [0, 0.6, 1.5], 0.9, 12, 26, 34, 90, { sfx: 'splash', blood: 0.3, dir: 'away' }),
      hb(10, 14, [0, 0.6, -1.5], 0.9, 12, 26, 34, 90, { sfx: 'splash', blood: 0.3, dir: 'away', grp: 0 }),
    ],
  },

  // Sample : la SP-404 crache une onde sonore qui file droit devant
  sp_n: {
    dur: 28, iasa: 22, pose: 'grate', airCtrl: 0.6,
    onFrame(F, W, f) {
      F.va[1] = f < 20 ? 1 : 0;
      if (f === 7) {
        shoot(W, F, 'proj', 16, { look: 'soundwave', r: 0.5, dmg: 6, ang: 36, kbb: 20, kbg: 44, life: 46, pierce: true, rehit: 99, sfx: 'sample', blood: 0.4 }, [0, 1.15, 0.7], F.facing, 0);
        W.emit('sfx', { s: F.slot, n: 'sample' });
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

  // Chagrin : il s'assoit et pleure toutes les larmes de son corps ; tout le monde glisse autour de lui
  sp_d: {
    dur: 56, iasa: 50, pose: 'drum', airCtrl: 0.4,
    onFrame(F, W, f) {
      if (f % 10 === 0 && f <= 40) W.emit('sob', { s: F.slot, x: F.x, y: F.y + 1.4, z: 0 });
      if (f === 20 && F.grounded) {
        tears(W, F, F.x, 2.8, 520);
        W.addHit({ owner: F.slot, key: 'nt' + F.mseq, x: F.x, y: F.y + 0.4, z: 0, r: 2.2, dmg: 4, ang: 80, kbb: 22, kbg: 20, dir: 'radial', effect: 'slip', sfx: 'splash', blood: 0, move: 'sp_d' });
      }
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
  specialsInfo: { n: 'Sample (SP-404)', s: 'Skate', u: 'Ollie géant', d: 'Chagrin (larmes glissantes)' },
};

export { endMove };
