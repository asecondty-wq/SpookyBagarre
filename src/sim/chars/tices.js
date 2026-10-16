// Tices : l'Alsacien. Rapide, les poings et les pieds : une rafale de coups, sa casquette lancée comme un boomerang,
// des coups de pied enflammés ; il lance des flammekueches, boit du rhum pour cracher du feu, et il pète. Beaucoup.
import { normals, dashAttack, hb, shoot, rapidJab } from '../kit.js';
import { ENTITIES } from '../entities.js';
import { startMove, slowFor } from '../fighter.js';
import { cone, setOnFire, setPoison } from './friendKit.js';
import { steerX } from './recovery.js';
import { localToWorld } from '../util.js';
import { DMath } from '../dmath.js';

// --- the cap: thrown like a boomerang (side smash: flat, out and back; up smash: straight up and back down onto
// his head); it hits on the way out, less on the way back. While it flies his head is bare (F.capOut: the rig hides
// the cap of the model). A perfect guard sends it back at him.
ENTITIES.capBoom = {
  stepExtra(e, W) {
    const F = W.fighters[e.home];
    if (!F || F.out || F.state === 'dead' || F.state === 'respawn') { e.dead = true; if (F) F.capOut = 0; return; }
    if (e.lastOwner !== e.owner) { e.lastOwner = e.owner; e.sx = -e.sx; e.back = 0; e.t = 0; } // sent back: it flies at him
    if (!e.back) {
      const k = Math.max(0, 1 - e.t / e.outT);
      if (e.mode === 'v') { e.vx = 0; e.vy = e.v0 * k; } else { e.vx = e.sx * e.v0 * k; e.vy = 0; }
      if (e.t >= e.outT) { e.back = 1; e.dmg *= 0.35; e.kbb *= 0.5; e.kbg *= 0.5; e.fkb = 0; }
    } else {
      // home to his head, faster and faster
      const dx = F.x - e.x, dy = F.y + F.height * 0.93 - e.y, d = DMath.hypot(dx, dy) || 1e-3;
      const sp = Math.min(22, 7 + (e.t - e.outT) * 1.2);
      e.vx = (dx / d) * sp; e.vy = (dy / d) * sp;
      if (d < 0.45) { e.dead = true; F.capOut = 0; W.emit('capCatch', { s: F.slot, x: e.x, y: e.y, z: 0 }); }
    }
  },
  onDie(e, W) { const F = W.fighters[e.home]; if (F) F.capOut = 0; },
};
function throwCap(F, W, mode) {
  const c = (F.mv.charge || 0) / 60;
  const v = mode === 'v';
  const p = localToWorld(F, v ? [0, 1.95, 0.15] : [0, 1.45, 0.65]);
  const sx = DMath.sin(F.facing) < 0 ? -1 : 1;
  W.spawn('proj', {
    owner: F.slot, home: F.slot, lastOwner: F.slot, x: p[0], y: p[1], z: 0, vx: v ? 0 : sx * 18, vy: v ? 21 : 0, dir: F.facing,
    look: 'cap', custom: 'capBoom', mode, sx, v0: v ? 21 : 18, outT: v ? 16 : 14, back: 0,
    r: 0.42, dmg: (v ? 11 : 11.5) * (1 + 0.45 * c), ang: v ? 88 : 38, kbb: 32 + 10 * c, kbg: v ? 88 : 92, dirMode: v ? 'radial' : 'vel',
    pierce: true, rehit: 16, life: 150, spin: 20, sfx: 'whoosh', blood: 1.2, hitlag: 1.1,
  });
  F.capOut = 1;
  W.emit('capThrow', { s: F.slot, x: p[0], y: p[1], z: 0, v: v ? 1 : 0 });
}

// --- the fart around him (down special): a green cloud that stuns and poisons
const N = normals({ power: 0.96, reach: 1.0, speed: 1.15, sfxS: 'hitS', sfxM: 'hitM', sfxL: 'hitL' });

const moves = {
  ...N,
  // A while running: its own dash attack
  dashattack: dashAttack({ pose: 'divetackle', boost: 12.5, fric: 14, dur: 40, iasa: 36, hits: [hb(5, 9, [0, 0.45, 0.9], 0.8, 10, 30, 40, 70, { sfx: 'hitM', blood: 1.1 }), hb(10, 24, [0, 0.4, 0.8], 0.7, 4, 60, 30, 40, { sfx: 'slap', blood: 0.5, grp: 1 })] }),

  // neutral A: a flurry of punches as long as A is mashed, then the finishing blow (it sends a little), like Kirby
  jab1: rapidJab({ loop: [4, 16], every: 4, start: 3, tail: 6, at: [0, 1.2, 0.72], r: 0.5, dmg: 0.9, ang: 70, kbb: 3, kbg: 3, fkb: 12, sfx: 'hitS', finisher: 'jab3', pose: 'jab1' }),
  jab3: {
    dur: 32, iasa: 28, pose: 'jab3',
    vel: [{ f: [5, 8], fwd: 5 }],
    hits: [hb(7, 10, [0, 1.15, 0.95], 0.6, 4.5, 40, 36, 70, { sfx: 'hitM', blood: 1.1, hitlag: 1.1 })],
  },
  // side smash: the cap off his head, flung flat like a boomerang (short range), it comes back to him
  smash: {
    dur: 44, charge: { at: 8, max: 60 }, pose: 'smash', tilt: 'ftilt',
    onStart(F, W) { if (F.capOut) startMove(F, W, 'smashP', { keepFacing: true }); },
    onFrame(F, W, f) { F.va[1] = f >= 3 && f < 12 ? 1 : 0; if (f === 12) throwCap(F, W, 'h'); },
    onEnd(F) { F.va[1] = 0; },
  },
  smashP: N.smash, // (the cap still flying: a plain punch)
  // up smash: the cap thrown straight up, it falls back onto his head (hits on the way up and down)
  usmash: {
    dur: 46, charge: { at: 6, max: 60 }, pose: 'usmash', tilt: 'utilt',
    onStart(F, W) { if (F.capOut) startMove(F, W, 'usmashP', { keepFacing: true }); },
    onFrame(F, W, f) { F.va[1] = f >= 1 && f < 10 ? 1 : 0; if (f === 10) throwCap(F, W, 'v'); },
    onEnd(F) { F.va[1] = 0; },
    // the arm thrown up pops whoever is next to him into the cap's way
    hits: [hb(9, 12, [0, 1.6, 0.45], 0.6, 6, 88, 40, 30, { sfx: 'hitM', blood: 0.6, dir: 'radial' })],
  },
  usmashP: N.usmash,
  // down smash: flaming kicks, diagonally down behind him, then in front (they set on fire)
  dsmash: {
    dur: 46, charge: { at: 5, max: 60 }, pose: 'dsmash', tilt: 'dtilt',
    onFrame(F, W, f) {
      if (f === 9 || f === 22) {
        const p = localToWorld(F, [0, 0.55, f === 9 ? -1.0 : 1.0]);
        W.emit('flameKick', { s: F.slot, x: p[0], y: p[1], z: 0 });
      }
    },
    hits: [
      hb(9, 12, [0, 0.55, -1.0], 0.6, 11, 30, 34, 90, { sfx: 'flameL', blood: 1.2, back: true, fx: 'fire', onHit: (V, W, hv) => setOnFire(W, hv.owner, V, 2) }),
      hb(9, 12, [0, 0.95, -0.45], 0.45, 8, 34, 30, 80, { sfx: 'hitM', blood: 0.8, back: true, grp: 0 }),
      hb(22, 25, [0, 0.55, 1.0], 0.6, 12.5, 30, 36, 94, { sfx: 'flameL', blood: 1.4, fx: 'fire', grp: 1, hitlag: 1.15, onHit: (V, W, hv) => setOnFire(W, hv.owner, V, 2) }),
      hb(22, 25, [0, 0.95, 0.45], 0.45, 9, 34, 30, 84, { sfx: 'hitM', blood: 0.8, grp: 1 }),
    ],
  },

  // Flammekueche : la tarte flambée lancée comme un frisbee (elle traverse) ; touché, on est ralenti 2 s
  sp_n: {
    dur: 32, iasa: 28, pose: 'throw1', airCtrl: 0.6,
    onFrame(F, W, f) {
      F.va[2] = f < 9 ? 1 : 0;
      if (f === 9) {
        shoot(W, F, 'proj', 17, { look: 'flammekueche', custom: 'flammSlow', r: 0.5, dmg: 7, ang: 34, kbb: 20, kbg: 50, life: 55, pierce: true, rehit: 99, spin: 14, drag: 0.6, sfx: 'hitM', blood: 0.6 }, [0, 1.15, 0.7], F.facing, 0);
        W.emit('sfx', { s: F.slot, n: 'throw' });
      }
    },
    onEnd(F) { F.va[2] = 0; },
  },

  // Rhum, puis feu : une rasade de rhum, puis il crache une langue de feu (ça brûle : des dégâts après coup)
  sp_s: {
    dur: 66, pose: 'shotgun', airCtrl: 0.3, noGrav: [26, 54], groundFric: 30,
    onFrame(F, W, f) {
      F.va[3] = f < 24 ? 1 : 0; // the bottle at the mouth
      if (f === 4) W.emit('sfx', { s: F.slot, n: 'glug' });
      if (!F.grounded && f >= 26 && f <= 54) F.vy = Math.max(F.vy * 0.8, -1);
      if (f >= 26 && f <= 54) {
        if (f % 2 === 0) W.emit('flame', { s: F.slot, x: F.x, y: F.y + 1.55, z: 0, a: F.facing, len: 3.6 });
        if (f % 3 === 0) cone(W, F, 'tf', 3.4, 1.5, 0.75, { dmg: 1.6, ang: 30, fkb: 16, sfx: 'flame', fx: 'fire', blood: 0,
          onHit: (V, W2, hv) => setOnFire(W2, hv.owner, V, 4) });
      }
      if (f === 26) W.emit('sfx', { s: F.slot, n: 'flameL' });
    },
    onEnd(F) { F.va[3] = 0; },
  },

  // Prout toxique : un nuage vert tout autour de lui, qui étourdit et empoisonne un moment
  sp_d: {
    dur: 40, iasa: 34, pose: 'bite', airCtrl: 0.5,
    onFrame(F, W, f) {
      if (f === 12) {
        W.spawn('cloud', { owner: F.slot, x: F.x, y: F.y + 0.8, z: 0, r: 2.1, life: 120, look: 'fart', effect: 'stun', stun: 38, dmg: 3, rehit: 80, sfx: 'fart', hook: 'poison' });
        W.emit('fart', { s: F.slot, x: F.x, y: F.y + 0.8, z: 0, big: 1, ring: 1 });
      }
    },
  },

  // Pet-propulsion : il s'envole en pétant ; celui que son corps touche est emporté avec lui (des petits coups tout
  // du long), le dernier l'éjecte un peu
  sp_u: {
    dur: 64, pose: 'bellyflop', helpless: true, airCtrl: 0.6, ledgeGrab: true, noGrav: [6, 44],
    onFrame(F, W, f) {
      if (f < 6 && !F.grounded) F.vy = Math.max(F.vy, -1);
      if (f === 6) {
        F.grounded = false;
        W.emit('fart', { s: F.slot, x: F.x, y: F.y + 0.3, z: 0, big: 1, jet: 1 });
        W.spawn('cloud', { owner: F.slot, x: F.x, y: F.y, z: 0, r: 1.4, life: 70, look: 'fart', effect: null, dmg: 3, rehit: 40, sfx: 'fart' });
      }
      if (f >= 6 && f <= 44) {
        F.vy = 15.5 - Math.max(0, f - 30) * 0.55;
        steerX(F, 7.5, 0.1);
        if (f % 3 === 0) W.emit('fart', { s: F.slot, x: F.x, y: F.y, z: 0, trail: 1 });
      }
    },
    hits: [
      hb(7, 42, [0, 0.9, 0.1], 0.95, 1.1, 80, 10, 10, { sfx: 'fart', blood: 0, rehit: 5, drag: [0.5, 0.3, 12] }),
      hb(44, 46, [0, 1.0, 0.25], 1.05, 4, 78, 32, 60, { sfx: 'hitM', blood: 0.8, dir: 'radial', grp: 2 }),
    ],
  },
};

// the flammekueche slows down whoever it hits (2 s)
ENTITIES.flammSlow = { onHitFighter(e, V, W) { slowFor(V, 120, 0.55); W.emit('slowed', { s: V.slot, x: V.x, y: V.y + 1.6, z: 0 }); } };

export default {
  id: 'tices', name: 'Tices', title: 'Flammekueche, rhum et gaz à effet de serre',
  color: '#f2c14e',
  stats: { weight: 100, runSpeed: 8.4, walkSpeed: 3.6, airSpeed: 6.3, airAccel: 32, groundAccel: 64, friction: 44,
    jumpVel: 15.5, airJumpVel: 13.5, airJumps: 1, gravity: 1.0, fallSpeed: 18, height: 1.82, radius: 0.52 },
  moves,
  specialsInfo: { n: 'Flammekueche (ralentit)', s: 'Rhum, puis feu', u: 'Pet-propulsion', d: 'Prout toxique (étourdit, empoisonne)' },
};
