// Tices : l'Alsacien. Il lance des flammekueches, boit du rhum pour cracher du feu, et il pète. Beaucoup.
import { normals, dashAttack, hb, shoot, ring } from '../kit.js';
import { cone, setOnFire } from './friendKit.js';
import { steerX, nearestLedge, pullTo, xAgain, xHeld } from './recovery.js';
import { DMath } from '../dmath.js';

const moves = {
  ...normals({ power: 1.08, reach: 1.06, speed: 1.0, sfxS: 'slap', sfxM: 'hitM', sfxL: 'hitL' }),
  // A while running: its own dash attack
  dashattack: dashAttack({ pose: 'divetackle', boost: 12.5, fric: 14, dur: 40, iasa: 36, hits: [hb(5, 9, [0, 0.45, 0.9], 0.8, 10, 30, 40, 70, { sfx: 'hitM', blood: 1.1 }), hb(10, 24, [0, 0.4, 0.8], 0.7, 4, 60, 30, 40, { sfx: 'slap', blood: 0.5, grp: 1 })] }),

  // neutral A, last hit: the wooden tart peel in the face
  jab3: {
    dur: 30, iasa: 28, pose: 'smash',
    onFrame(F, W, f) { F.va[0] = f < 20 ? 1 : 0; },
    hits: [hb(6, 9, [0, 1.1, 1.2], 0.8, 5.5, 38, 34, 86, { sfx: 'woodM', blood: 1.1 })],
    onEnd(F) { F.va[0] = 0; },
  },
  // side smash: a big swing of the tart peel
  smash: {
    dur: 46, charge: { at: 8, max: 60 }, pose: 'smash', tilt: 'ftilt',
    onFrame(F, W, f) { F.va[0] = f < 34 ? 1 : 0; },
    vel: [{ f: [11, 13], fwd: 5 }],
    hits: [
      hb(13, 16, [0, 1.1, 1.45], 1.0, 17, 36, 40, 98, { sfx: 'woodL', blood: 2.2, hitlag: 1.2 }),
      hb(13, 16, [0, 1.0, 0.6], 0.75, 13, 38, 32, 90, { sfx: 'woodM', blood: 1.5, grp: 0 }),
    ],
    onEnd(F) { F.va[0] = 0; },
  },
  // up smash: a burp of fire straight up (multi-hit, then the big flame)
  usmash: {
    dur: 46, charge: { at: 6, max: 60 }, pose: 'thunder', tilt: 'utilt',
    onFrame(F, W, f) { if (f >= 10 && f <= 22 && f % 2 === 0) W.emit('flame', { s: F.slot, x: F.x, y: F.y + 1.9, z: 0, a: 0, up: 1, len: 2.4 }); },
    hits: [
      hb(10, 18, [0, 2.4, 0.2], 1.0, 2, 88, 0, 0, { fkb: 30, rehit: 4, sfx: 'flame', blood: 0, dir: 'radial', fx: 'fire' }),
      hb(19, 22, [0, 2.8, 0.2], 1.25, 10, 88, 40, 94, { sfx: 'flameL', blood: 0.5, dir: 'radial', fx: 'fire', grp: 1, onHit: (V, W, hv) => setOnFire(W, hv.owner, V, 3) }),
    ],
  },
  // down smash: stomp and fart, the floor shakes on both sides
  dsmash: {
    dur: 46, charge: { at: 6, max: 60 }, pose: 'dsmash', tilt: 'dtilt',
    onFrame(F, W, f) {
      if (f === 11) {
        ring(W, F, { r: 0.5, grow: 12, life: 18, dmg: 13, ang: 30, kbb: 36, kbg: 90, w: 0.9, h: 1.0, look: 'fart', sfx: 'fart', blood: 0.6 });
        W.spawn('cloud', { owner: F.slot, x: F.x, y: F.y + 0.6, z: 0, r: 1.6, life: 90, look: 'fart', effect: null, dmg: 1, rehit: 30, sfx: 'fart' });
        W.emit('fart', { s: F.slot, x: F.x, y: F.y + 0.8, z: 0, big: 1 });
      }
    },
  },

  // Flammekueche : la tarte flambée lancée comme un frisbee (elle traverse)
  sp_n: {
    dur: 32, iasa: 28, pose: 'throw1', airCtrl: 0.6,
    onFrame(F, W, f) {
      F.va[1] = f < 9 ? 1 : 0;
      if (f === 9) {
        shoot(W, F, 'proj', 17, { look: 'flammekueche', r: 0.5, dmg: 8, ang: 34, kbb: 24, kbg: 60, life: 55, pierce: true, rehit: 99, spin: 14, drag: 0.6, sfx: 'hitM', blood: 0.8 }, [0, 1.15, 0.7], F.facing, 0);
        W.emit('sfx', { s: F.slot, n: 'throw' });
      }
    },
    onEnd(F) { F.va[1] = 0; },
  },

  // Rhum, puis feu : une rasade de rhum, puis il crache une langue de feu (ça brûle)
  sp_s: {
    dur: 66, pose: 'shotgun', airCtrl: 0.3, noGrav: [26, 54], groundFric: 30,
    onFrame(F, W, f) {
      F.va[2] = f < 24 ? 1 : 0; // the bottle at the mouth
      if (f === 4) W.emit('sfx', { s: F.slot, n: 'glug' });
      if (!F.grounded && f >= 26 && f <= 54) F.vy = Math.max(F.vy * 0.8, -1);
      if (f >= 26 && f <= 54) {
        if (f % 2 === 0) W.emit('flame', { s: F.slot, x: F.x, y: F.y + 1.55, z: 0, a: F.facing, len: 3.6 });
        if (f % 3 === 0) cone(W, F, 'tf', 3.4, 1.5, 0.75, { dmg: 1.8, ang: 30, fkb: 16, sfx: 'flame', fx: 'fire', blood: 0,
          onHit: (V, W2, hv) => { if (f > 46) setOnFire(W2, hv.owner, V, 4); } });
      }
      if (f === 26) W.emit('sfx', { s: F.slot, n: 'flameL' });
    },
    onEnd(F) { F.va[2] = 0; },
  },

  // Prout toxique : un nuage vert qui étourdit tout le monde derrière lui
  sp_d: {
    dur: 40, iasa: 34, pose: 'bite', airCtrl: 0.5,
    onFrame(F, W, f) {
      if (f === 12) {
        const back = -DMath.sin(F.facing);
        W.spawn('cloud', { owner: F.slot, x: F.x + back * 1.0, y: F.y + 0.8, z: 0, vx: back * 3, r: 1.9, life: 150, look: 'fart', effect: 'stun', stun: 40, dmg: 3, rehit: 70, sfx: 'fart' });
        F.vx += -back * 4;
        W.emit('fart', { s: F.slot, x: F.x + back * 0.6, y: F.y + 0.8, z: 0 });
      }
    },
  },

  // Pet-propulsion : un pet monumental l'envoie en l'air ; X encore (deux fois) : d'autres pets, d'autres nuages
  sp_u: {
    dur: 84, pose: 'bellyflop', helpless: true, airCtrl: 0.6, ledgeGrab: true,
    onFrame(F, W, f) {
      const fart = (big) => {
        F.grounded = false; F.vy = big ? 22 : 18;
        W.emit('fart', { s: F.slot, x: F.x, y: F.y + 0.3, z: 0, big: 1, jet: 1 });
        W.spawn('cloud', { owner: F.slot, x: F.x, y: F.y, z: 0, r: big ? 1.6 : 1.2, life: 70, look: 'fart', effect: null, dmg: big ? 5 : 3, rehit: 40, sfx: 'fart' });
      };
      if (f < 6 && !F.grounded) F.vy = Math.max(F.vy, -1);
      if (f === 6) fart(true);
      if ((F.mv.n || 0) < 2 && f >= 16 && f <= 64 && xAgain(F)) { F.mv.n = (F.mv.n || 0) + 1; F.mv.last = f; fart(false); }
      const since = f - (F.mv.last ?? 6);
      if (since >= 0 && since <= 12) { F.vy = Math.max(F.vy, 13); if (f % 3 === 0) W.emit('fart', { s: F.slot, x: F.x, y: F.y, z: 0, trail: 1 }); }
      steerX(F, 7.5, 0.1);
    },
    hits: [hb(6, 12, [0, -0.2, 0], 1.2, 6, -70, 30, 40, { sfx: 'fart', blood: 0, dir: 'radial', spike: 1 })],
  },
};

export default {
  id: 'tices', name: 'Tices', title: 'Flammekueche, rhum et gaz à effet de serre',
  color: '#f2c14e',
  stats: { weight: 100, runSpeed: 8.4, walkSpeed: 3.6, airSpeed: 6.3, airAccel: 32, groundAccel: 64, friction: 44,
    jumpVel: 15.5, airJumpVel: 13.5, airJumps: 1, gravity: 1.0, fallSpeed: 18, height: 1.82, radius: 0.52 },
  moves,
  specialsInfo: { n: 'Flammekueche', s: 'Rhum, puis feu', u: 'Pet-propulsion', d: 'Prout toxique' },
};
