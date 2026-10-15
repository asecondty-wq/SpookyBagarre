// Helpers to write moves: declarative hitboxes, generic normals (jab, smashes, aerials, grab, throw),
// and small actions used by specials (lunge, spawn, ring...).
import { localToWorld } from './util.js';
import { setState, endMove } from './fighter.js';
import { DMath } from './dmath.js';

// hitbox: frames [f0,f1], at [right, up, forward], radius, damage, elevation angle, base kb, kb growth
export const hb = (f0, f1, at, r, dmg, ang, kbb, kbg, extra = {}) => ({ f: [f0, f1], at, r, dmg, ang, kbb, kbg, ...extra });

// generic normals, tuned per character with `t` (multipliers and visual names)
export function normals(t = {}) {
  const P = t.power ?? 1, R = t.reach ?? 1, S = t.speed ?? 1;
  const f = (n) => Math.max(1, Math.round(n / S));
  const sfxS = t.sfxS || 'hitS', sfxM = t.sfxM || 'hitM', sfxL = t.sfxL || 'hitL';
  return {
    jab1: {
      dur: f(16), iasa: f(13), next: 'jab2', nextWin: [f(5), f(15)], pose: 'jab1', combo: true,
      hits: [hb(f(3), f(5), [0.15, 1.0, 0.75 * R], 0.6 * R, 2.5 * P, 20, 8, 20, { sfx: sfxS, blood: 0.6 })],
    },
    jab2: {
      dur: f(16), iasa: f(13), next: 'jab3', nextWin: [f(5), f(15)], pose: 'jab2', combo: true,
      hits: [hb(f(3), f(5), [-0.15, 1.0, 0.8 * R], 0.6 * R, 2.5 * P, 20, 8, 20, { sfx: sfxS, blood: 0.6 })],
    },
    jab3: {
      dur: f(30), iasa: f(28), pose: 'jab3',
      vel: [{ f: [3, 5], fwd: 3 }],
      hits: [hb(f(5), f(8), [0, 1.0, 0.95 * R], 0.8 * R, 5 * P, 40, 34, 90, { sfx: sfxM, blood: 1.2 })],
    },
    // A + direction tapped: quick hits that chain into each other (combos); A held: the smash below
    // side A tapped three times: kick, coup de fesse, coup de tête
    ftilt: {
      dur: f(24), iasa: f(18), pose: 'ftilt', next: 'ftilt2', nextWin: [f(10), f(22)], combo: true,
      hits: [hb(f(6), f(8), [0, 1.0, 0.95 * R], 0.72 * R, 5.5 * P, 32, 14, 40, { sfx: sfxM, blood: 0.9 })],
    },
    ftilt2: {
      dur: f(26), iasa: f(20), pose: 'buttbump', next: 'ftilt3', nextWin: [f(15), f(24)], combo: true,
      vel: [{ f: [f(6), f(9)], fwd: 3.5 }],
      hits: [hb(f(9), f(11), [0, 0.9, 0.9 * R], 0.8 * R, 5 * P, 40, 16, 40, { sfx: 'slap', blood: 0.5 })],
    },
    ftilt3: {
      dur: f(32), iasa: f(28), pose: 'headbutt',
      vel: [{ f: [f(7), f(10)], fwd: 4.5 }],
      hits: [hb(f(9), f(12), [0, 1.55, 0.85 * R], 0.75 * R, 8.5 * P, 40, 34, 88, { sfx: sfxL, blood: 1.6, hitlag: 1.15 })],
    },
    utilt: {
      dur: f(24), iasa: f(17), pose: 'headbuttUp', combo: true,
      hits: [hb(f(6), f(10), [0, 2.0, 0.25], 0.9 * R, 6 * P, 88, 26, 66, { sfx: sfxM, blood: 0.9, dir: 'radial' })],
    },
    dtilt: {
      dur: f(20), iasa: f(15), pose: 'dsmash', combo: true,
      hits: [hb(f(5), f(7), [0, 0.32, 0.9 * R], 0.72 * R, 5 * P, 74, 22, 48, { sfx: sfxS, blood: 0.7 })],
    },
    // A + direction held: big hit, hold A to charge
    smash: {
      dur: f(42), charge: { at: f(8), max: 60 }, pose: 'smash', tilt: 'ftilt',
      vel: [{ f: [f(10), f(12)], fwd: 6 * (t.smashLunge ?? 1) }],
      hits: [
        hb(f(12), f(15), [0, 1.0, 1.1 * R], 0.95 * R, 15 * P, 38, 38, 100, { sfx: sfxL, blood: 2.2, hitlag: 1.15 }),
        hb(f(12), f(15), [0, 1.0, 0.45 * R], 0.75 * R, 13 * P, 38, 32, 96, { sfx: sfxL, blood: 1.8, grp: 0 }),
      ],
    },
    // A + down on the ground: a low sweep on both sides at once
    dsmash: {
      dur: f(44), charge: { at: f(6), max: 60 }, pose: 'dsmash', tilt: 'dtilt',
      hits: [
        hb(f(10), f(13), [0, 0.35, 0.95 * R], 0.85 * R, 14 * P, 26, 34, 92, { sfx: sfxL, blood: 1.8, dir: 'away', hitlag: 1.1 }),
        hb(f(10), f(13), [0, 0.35, -0.95 * R], 0.85 * R, 14 * P, 26, 34, 92, { sfx: sfxL, blood: 1.8, dir: 'away', grp: 0 }),
        hb(f(10), f(12), [0, 0.45, 0], 0.7, 11 * P, 30, 30, 80, { sfx: sfxM, blood: 1.2, dir: 'away', grp: 0 }),
      ],
    },
    // A + up (or jump + A) on the ground: launcher upwards, hits all around
    usmash: {
      dur: f(42), charge: { at: f(6), max: 60 }, pose: 'usmash', tilt: 'utilt',
      hits: [
        hb(f(10), f(14), [0, 2.2, 0.25], 1.05 * R, 15 * P, 86, 36, 96, { sfx: sfxL, blood: 2.0, dir: 'radial' }),
        hb(f(10), f(12), [0, 0.8, 0.5], 1.0 * R, 13 * P, 80, 34, 92, { sfx: sfxL, blood: 1.6, grp: 0, dir: 'radial' }),
      ],
    },
    nair: {
      air: true, dur: f(34), landLag: 5, iasa: f(30), pose: 'nair', combo: true,
      hits: [
        hb(f(4), f(8), [0, 0.9, 0], 1.15 * R, 9 * P, 40, 24, 82, { sfx: sfxM, blood: 1.1, dir: 'radial' }),
        hb(f(9), f(18), [0, 0.9, 0], 1.0 * R, 5 * P, 40, 18, 70, { sfx: sfxS, blood: 0.7, dir: 'radial' }),
      ],
    },
    fair: {
      air: true, dur: f(38), landLag: 7, iasa: f(32), pose: 'fair', combo: true,
      hits: [hb(f(8), f(11), [0, 0.9, 1.0 * R], 0.95 * R, 12 * P, 40, 30, 92, { sfx: sfxL, blood: 1.6 })],
    },
    // A away from the facing in the air: a strong kick behind
    bair: {
      air: true, dur: f(36), landLag: 7, iasa: f(30), pose: 'bair', combo: true,
      hits: [
        hb(f(7), f(9), [0, 0.95, -1.0 * R], 0.9 * R, 13 * P, 36, 32, 96, { sfx: sfxL, blood: 1.6, back: true, hitlag: 1.1 }),
        hb(f(10), f(14), [0, 0.95, -0.85 * R], 0.75 * R, 8 * P, 40, 24, 70, { sfx: sfxM, blood: 0.9, back: true, grp: 0 }),
      ],
    },
    uair: {
      air: true, dur: f(30), landLag: 5, iasa: f(26), pose: 'uair', combo: true,
      hits: [hb(f(5), f(9), [0, 2.0, 0.1], 1.0 * R, 10 * P, 85, 30, 88, { sfx: sfxM, blood: 1.3, dir: 'radial' })],
    },
    // A + trigger in the air: meteor (spike) downwards
    dair: {
      air: true, dur: f(40), landLag: 10, iasa: f(36), pose: 'dair', combo: true,
      hits: [
        // the spike: a strong blow straight down while it is out (on the ground it pops the victim up instead)
        hb(f(9), f(18), [0, -0.05, 0.12], 1.05 * R, 13 * P, -80, 26, 86, { sfx: sfxL, blood: 2.0, hitlag: 1.35, spike: 1 }),
        hb(f(19), f(24), [0, 0.1, 0.1], 0.8 * R, 6 * P, 60, 20, 55, { sfx: sfxM, blood: 0.8, grp: 1 }),
      ],
    },
    // the grab: as far as the arms go (the hand closes on the body, not a metre in front of it)
    grab: {
      dur: 32, pose: 'grab', groundOnly: true,
      hits: [hb(6, 10, [0, 1.0, 0.62], 0.5, 0, 0, 0, 0, { effect: 'grab' })],
    },
    throw: {
      dur: 30, pose: 'throw',
      onFrame(F, W, f) {
        const V = W.fighters[F.mv.victim];
        if (!V || V.grabbedBy !== F.slot) return;
        // where the victim is carried before the release (local [right, up, forward]): forward, a swing; back,
        // over the head; up, lifted high; down, lifted then slammed into the floor
        const k = Math.min(1, f / 13), a = k * Math.PI;
        const kind = F.mv.kind || 'f';
        // (the victim's feet: lifted no higher than a person can hold someone, so the hands stay on it)
        const at = kind === 'b' ? [0, 0.25 + Math.sin(a) * 0.95, Math.cos(a) * 0.7]
          : kind === 'u' ? [0, 0.25 + k * 0.9, 0.65 - k * 0.35]
            : kind === 'd' ? (f < 9 ? [0, 0.25 + (f / 9) * 0.85, 0.65 - (f / 9) * 0.2] : [0, 1.1 - ((f - 9) / 4) * 1.0, 0.45 + ((f - 9) / 4) * 0.3])
              : [0, 0.25 + Math.sin(a) * 0.6, 0.65 + k * 0.45];
        const p = localToWorld(F, at);
        V.x = p[0]; V.y = p[1]; V.z = p[2];
        if (f === 13) {
          V.grabbedBy = -1;
          setState(V, 'air');
          // forward / back: far and flat; up: straight up; down: slammed into the floor, it bounces back up
          // (a combo starter, like Smash), over the void it goes down
          const T = {
            f: { dmg: 9, ang: 42, kbb: 70, kbg: 62 },
            b: { dmg: 10, ang: 40, kbb: 66, kbg: 72 },
            u: { dmg: 8, ang: 88, kbb: 72, kbg: 66 },
            d: { dmg: 7, ang: -82, kbb: 64, kbg: 30, spike: 1 },
          }[F.mv.kind || 'f'];
          if (F.mv.kind === 'd') V.grounded = false;
          W.hitDirect(F, V, { dmg: T.dmg * P, ang: T.ang, kbb: T.kbb, kbg: T.kbg, spike: T.spike, sfx: sfxL, blood: 2.2, dir: 'face', dirAngle: F.facing, hitlag: 1.2, key: 'throw' + F.mseq });
          if (F.mv.kind === 'd') W.emit('quake', { x: V.x, y: V.y, z: V.z, k: 0.25 });
        }
      },
    },
    // A while running: a lunge that carries the run's speed (each character has its own, see dashAttack)
    dashattack: dashAttack({ pose: 'slide', hits: [
      hb(5, 9, [0, 0.45, 0.9 * R], 0.75 * R, 9 * P, 38, 40, 70, { sfx: sfxM, blood: 1.1 }),
      hb(10, 16, [0, 0.45, 0.8 * R], 0.65 * R, 5 * P, 50, 30, 50, { sfx: sfxS, blood: 0.6, grp: 1 }),
    ] }),
    ledgeattack: {
      dur: 30, pose: 'jab3',
      hits: [hb(8, 11, [0, 0.8, 0.9], 0.95, 8, 35, 40, 50, { sfx: sfxM, blood: 1 })],
    },
  };
}

// dash attack: keeps (and boosts) the run's speed, slides to a stop, punishable if it misses
//   boost: speed on the first frames (m/s), fric: how fast it slides to a stop, dur / iasa: length
export function dashAttack(o) {
  return {
    dur: o.dur ?? 34, iasa: o.iasa ?? (o.dur ?? 34) - 4, pose: o.pose || 'slide', autoFace: false,
    groundFric: o.fric ?? 20, slideOff: !!o.slideOff, dash: true,
    vel: o.vel || [{ f: [1, o.boostF ?? 4], fwd: o.boost ?? 10.5 }],
    hits: o.hits, onFrame: o.onFrame, onEnd: o.onEnd, onStart: o.onStart, noGrav: o.noGrav,
  };
}

// small actions
export function lunge(F, speed, up = undefined) {
  F.vx = DMath.sin(F.facing) * speed; F.vz = 0;
  if (up !== undefined) { F.vy = up; if (up > 0) F.grounded = false; }
}

export function fwd(F, d, up = 0, side = 0) { return localToWorld(F, [side, up, d]); }

export function shoot(W, F, kind, speed, props = {}, at = [0, 1.0, 0.7], dirAngle = F.facing, upVel = 0) {
  const p = localToWorld(F, at);
  return W.spawn(kind, {
    owner: F.slot, x: p[0], y: p[1], z: p[2],
    vx: DMath.sin(dirAngle) * speed, vz: DMath.cos(dirAngle) * speed, vy: upVel, dir: dirAngle, ...props,
  });
}

export function ring(W, F, props) {
  return W.spawn('ring', { owner: F.slot, x: F.x, y: F.y, z: F.z, r: 0.5, ...props });
}

export function finish(F, W) { endMove(F, W); }

// a hit volume that lives one tick (custom hitboxes in onFrame)
export function hitNow(W, F, key, at, r, p) {
  const c = Array.isArray(at) && at.length === 3 && p.world ? at : localToWorld(F, at);
  W.addHit({ owner: F.slot, key: `c${F.slot}:${F.mseq}:${key}`, x: c[0], y: c[1], z: c[2], r, dir: 'face', dirAngle: F.facing, ox: F.x, oz: F.z, sfx: 'hitM', blood: 1, move: F.move, ...p });
}
