// Helpers to write moves: declarative hitboxes, generic normals (jab, smashes, aerials, grab, throw),
// and small actions used by specials (lunge, spawn, ring...).
import { localToWorld } from './util.js';
import { setState, endMove } from './fighter.js';

// hitbox: frames [f0,f1], at [right, up, forward], radius, damage, elevation angle, base kb, kb growth
export const hb = (f0, f1, at, r, dmg, ang, kbb, kbg, extra = {}) => ({ f: [f0, f1], at, r, dmg, ang, kbb, kbg, ...extra });

// generic normals, tuned per character with `t` (multipliers and visual names)
export function normals(t = {}) {
  const P = t.power ?? 1, R = t.reach ?? 1, S = t.speed ?? 1;
  const f = (n) => Math.max(1, Math.round(n / S));
  const sfxS = t.sfxS || 'hitS', sfxM = t.sfxM || 'hitM', sfxL = t.sfxL || 'hitL';
  return {
    jab1: {
      dur: f(16), iasa: f(14), next: 'jab2', nextWin: [f(6), f(15)], pose: 'jab1',
      hits: [hb(f(3), f(5), [0.15, 1.0, 0.75 * R], 0.6 * R, 2.5 * P, 20, 8, 20, { sfx: sfxS, blood: 0.6 })],
    },
    jab2: {
      dur: f(16), iasa: f(14), next: 'jab3', nextWin: [f(6), f(15)], pose: 'jab2',
      hits: [hb(f(3), f(5), [-0.15, 1.0, 0.8 * R], 0.6 * R, 2.5 * P, 20, 8, 20, { sfx: sfxS, blood: 0.6 })],
    },
    jab3: {
      dur: f(30), iasa: f(28), pose: 'jab3',
      vel: [{ f: [3, 5], fwd: 3 }],
      hits: [hb(f(5), f(8), [0, 1.0, 0.95 * R], 0.8 * R, 5 * P, 40, 34, 90, { sfx: sfxM, blood: 1.2 })],
    },
    // A + direction: big hit, hold A to charge
    smash: {
      dur: f(42), charge: { at: f(8), max: 60 }, pose: 'smash',
      vel: [{ f: [f(10), f(12)], fwd: 6 * (t.smashLunge ?? 1) }],
      hits: [
        hb(f(12), f(15), [0, 1.0, 1.1 * R], 0.95 * R, 15 * P, 38, 38, 100, { sfx: sfxL, blood: 2.2, hitlag: 1.15 }),
        hb(f(12), f(15), [0, 1.0, 0.45 * R], 0.75 * R, 13 * P, 38, 32, 96, { sfx: sfxL, blood: 1.8, grp: 0 }),
      ],
    },
    // A + jump on the ground: launcher upwards, hits all around
    usmash: {
      dur: f(42), charge: { at: f(6), max: 60 }, pose: 'usmash',
      hits: [
        hb(f(10), f(14), [0, 2.2, 0.25], 1.05 * R, 15 * P, 86, 36, 96, { sfx: sfxL, blood: 2.0, dir: 'radial' }),
        hb(f(10), f(12), [0, 0.8, 0.5], 1.0 * R, 13 * P, 80, 34, 92, { sfx: sfxL, blood: 1.6, grp: 0, dir: 'radial' }),
      ],
    },
    nair: {
      air: true, dur: f(34), landLag: 7, iasa: f(32), pose: 'nair',
      hits: [
        hb(f(4), f(8), [0, 0.9, 0], 1.15 * R, 9 * P, 40, 24, 82, { sfx: sfxM, blood: 1.1, dir: 'radial' }),
        hb(f(9), f(18), [0, 0.9, 0], 1.0 * R, 5 * P, 40, 18, 70, { sfx: sfxS, blood: 0.7, dir: 'radial' }),
      ],
    },
    fair: {
      air: true, dur: f(38), landLag: 10, iasa: f(34), pose: 'fair',
      hits: [hb(f(8), f(11), [0, 0.9, 1.0 * R], 0.95 * R, 12 * P, 40, 30, 92, { sfx: sfxL, blood: 1.6 })],
    },
    uair: {
      air: true, dur: f(30), landLag: 7, iasa: f(28), pose: 'uair',
      hits: [hb(f(5), f(9), [0, 2.0, 0.1], 1.0 * R, 10 * P, 85, 30, 88, { sfx: sfxM, blood: 1.3, dir: 'radial' })],
    },
    // A + trigger in the air: meteor (spike) downwards
    dair: {
      air: true, dur: f(40), landLag: 14, iasa: f(38), pose: 'dair',
      hits: [
        hb(f(12), f(14), [0, -0.1, 0.1], 0.9 * R, 13 * P, -70, 20, 80, { sfx: sfxL, blood: 2.0, hitlag: 1.3, spike: 1 }),
        hb(f(15), f(22), [0, 0.0, 0.1], 0.8 * R, 8 * P, 50, 20, 60, { sfx: sfxM, blood: 1.0, grp: 1 }),
      ],
    },
    grab: {
      dur: 32, pose: 'grab', groundOnly: true,
      hits: [hb(6, 9, [0, 1.0, 0.85], 0.75, 0, 0, 0, 0, { effect: 'grab' })],
    },
    throw: {
      dur: 30, pose: 'throw',
      onFrame(F, W, f) {
        const V = W.fighters[F.mv.victim];
        if (!V || V.grabbedBy !== F.slot) return;
        const lift = Math.min(1, f / 12);
        const p = localToWorld(F, [0, 0.3 + lift * 1.6, 0.9 - lift * 0.5]);
        V.x = p[0]; V.y = p[1]; V.z = p[2];
        F.va[0] = lift;
        if (f === 13) {
          V.grabbedBy = -1;
          setState(V, 'air');
          W.hitDirect(F, V, { dmg: 9 * P, ang: 42, kbb: 70, kbg: 62, sfx: sfxL, blood: 2.2, dir: 'face', dirAngle: F.facing, hitlag: 1.2, key: 'throw' + F.mseq });
        }
      },
    },
    ledgeattack: {
      dur: 30, pose: 'jab3',
      hits: [hb(8, 11, [0, 0.8, 0.9], 0.95, 8, 35, 40, 50, { sfx: sfxM, blood: 1 })],
    },
  };
}

// small actions
export function lunge(F, speed, up = undefined) {
  F.vx = Math.sin(F.facing) * speed; F.vz = Math.cos(F.facing) * speed;
  if (up !== undefined) { F.vy = up; if (up > 0) F.grounded = false; }
}

export function fwd(F, d, up = 0, side = 0) { return localToWorld(F, [side, up, d]); }

export function shoot(W, F, kind, speed, props = {}, at = [0, 1.0, 0.7], dirAngle = F.facing, upVel = 0) {
  const p = localToWorld(F, at);
  return W.spawn(kind, {
    owner: F.slot, x: p[0], y: p[1], z: p[2],
    vx: Math.sin(dirAngle) * speed, vz: Math.cos(dirAngle) * speed, vy: upVel, dir: dirAngle, ...props,
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
