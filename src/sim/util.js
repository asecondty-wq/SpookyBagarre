// Small math helpers shared by the simulation (no Three.js here: the simulation also runs headless).
import { DMath } from './dmath.js';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const sign = (v) => (v < 0 ? -1 : 1);
export const len2 = (x, z) => DMath.hypot(x, z);
export const deg = (d) => (d * Math.PI) / 180;

export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// rotate angle `a` toward `b` by at most `step` radians
export function approachAngle(a, b, step) {
  const d = wrapAngle(b - a);
  if (Math.abs(d) <= step) return b;
  return a + Math.sign(d) * step;
}

export function approach(v, target, step) {
  if (v < target) return Math.min(v + step, target);
  return Math.max(v - step, target);
}

// facing angle convention: forward = (sin a, 0, cos a)
export const fwdX = (a) => DMath.sin(a);
export const fwdZ = (a) => DMath.cos(a);
export const angleOf = (x, z) => DMath.atan2(x, z);

// stick (mx right, my up) -> world direction on the ground: the game is played in 2D, along x only.
export function stickToWorld(mx) {
  return [mx, 0];
}

// facing in 2D: right = +x (pi/2), left = -x (-pi/2)
export const RIGHT = Math.PI / 2, LEFT = -Math.PI / 2;
export const faceSign = (a) => (DMath.sin(a) < 0 ? -1 : 1);
export const faceOf = (dx) => (dx < 0 ? LEFT : RIGHT);

// local offset [side(right), up, forward] in fighter space -> world
export function localToWorld(F, off) {
  const a = F.facing;
  const fx = DMath.sin(a), fz = DMath.cos(a);
  // character's right = forward rotated -90° around Y
  const rx = -fz, rz = fx;
  return [F.x + rx * off[0] + fx * off[2], F.y + off[1], F.z + rz * off[0] + fz * off[2]];
}

// Deterministic PRNG (mulberry32)
export function makeRng(seed) {
  let s = seed >>> 0;
  const rng = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.state = () => s;
  rng.setState = (v) => { s = v >>> 0; };
  rng.range = (a, b) => a + (b - a) * rng();
  rng.int = (a, b) => Math.floor(a + (b - a + 1) * rng());
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
  return rng;
}

// segment(p,q) vs point distance squared, used by capsule hurtboxes
export function segPointDist2(px, py, pz, ax, ay, az, bx, by, bz) {
  const abx = bx - ax, aby = by - ay, abz = bz - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const ab2 = abx * abx + aby * aby + abz * abz;
  let t = ab2 > 0 ? (apx * abx + apy * aby + apz * abz) / ab2 : 0;
  t = clamp(t, 0, 1);
  const dx = apx - abx * t, dy = apy - aby * t, dz = apz - abz * t;
  return dx * dx + dy * dy + dz * dz;
}
