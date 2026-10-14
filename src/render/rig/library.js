// Animation library for the rigged fighters: stances, locomotion cycles, reactions and attack key poses.
// Directions are in character space (+X = character's left, +Y up, +Z forward) and written for the LEFT side;
// `L(...)`/`R(...)` build left/right bone specs, R mirrors automatically.
import { mirrorDir, mirrorRot, pitch, yaw, norm, mix, sample } from './animator.js';
import { moveTimeline } from '../poses.js';

const D = (x, y, z) => ({ dir: norm([x, y, z]) });
const ROT = (x, y, z) => ({ rot: [x, y, z] });
const side = (spec, right) => (!right ? spec : spec.dir ? { dir: mirrorDir(spec.dir), twist: spec.twist ? -spec.twist : 0 } : { rot: mirrorRot(spec.rot) });

// build a pose from left-side specs: { upperarm:{...}, forearm:{...} } -> bones .L and mirrored .R
export function sym(parts, only) {
  const b = {};
  for (const [k, v] of Object.entries(parts)) {
    if (only !== 'R') b[k + '.L'] = v;
    if (only !== 'L') b[k + '.R'] = side(v, true);
  }
  return b;
}
const P = (bones, extra = {}) => ({ bones, ...extra });
const merge = (...ps) => { let o = { bones: {} }; for (const p of ps) if (p) o = mix(o, p, 1); return o; };

// ---------------------------------------------------------------------------------------------------------------
// Stances: the character's look decides the guard (cfg from rig/chars.js)
export function stance(cfg, t, F) {
  const br = Math.sin(t * 3.1);
  const g = cfg.guard || 'boxer';
  let arms;
  if (g === 'boxer') arms = sym({ upperarm: D(0.45, -0.72, 0.42), forearm: D(-0.12, 0.62, 0.75) });
  else if (g === 'smug') arms = sym({ upperarm: D(0.35, -0.92, -0.12), forearm: D(0.25, -0.55, 0.75) });
  else if (g === 'brute') arms = sym({ upperarm: D(0.75, -0.6, 0.2), forearm: D(0.35, -0.35, 0.85) });
  else if (g === 'claws') arms = sym({ upperarm: D(0.6, -0.55, 0.55), forearm: D(0.2, -0.1, 1) });
  else if (g === 'low') arms = sym({ upperarm: D(0.6, -0.8, 0.15), forearm: D(0.3, -0.75, 0.55) });
  else arms = sym({ upperarm: D(0.5, -0.85, 0.1), forearm: D(0.35, -0.8, 0.4) });
  const crouch = cfg.crouch ?? 0.04;
  const legs = sym({ thigh: D(0.16 + (cfg.wide || 0), -1, 0.22 + crouch * 2), shin: D(0.06, -1, -0.15 - crouch * 2) });
  return P({
    ...arms, ...legs,
    spine: ROT(6 + (cfg.lean || 0) + br * 1.5, 0, 0), chest: ROT(br * 2.5, 0, 0), neck: ROT(-4, 0, 0), head: ROT(-4 - br * 1.5, 0, 0),
  }, { hips: { pos: [0, -crouch * cfg.h - br * 0.008 * cfg.h, 0], scl: [1 - br * 0.008, 1 + br * 0.012, 1 - br * 0.008] }, jaw: 0 });
}

// running / walking: phase driven by distance so the feet never slide much
export function locomotion(cfg, phase, amt, run) {
  const s = Math.sin(phase), c = Math.cos(phase);
  const swing = (run ? 42 : 26) * amt;
  const bendBack = (run ? 70 : 35) * amt;
  const leg = (sgn) => {
    const sw = s * sgn;
    const th = pitch([0.12, -1, 0.05], -swing * sw);
    const knee = 8 + bendBack * Math.max(0, -Math.cos(phase + (sgn > 0 ? 0 : Math.PI)) * 0.5 + 0.5 * Math.max(0, sw));
    const sh = pitch(th, knee);
    return { th, sh };
  };
  const Lg = leg(1), Rg = leg(-1);
  const arm = (sgn) => {
    const sw = -s * sgn;
    return { ua: pitch([0.42, -0.9, 0.05], -(run ? 50 : 30) * amt * sw), fa: pitch([0.3, -0.5, 0.8], -(run ? 30 : 15) * amt * sw) };
  };
  const La = arm(1), Ra = arm(-1);
  const bones = {
    'thigh.L': { dir: Lg.th }, 'shin.L': { dir: Lg.sh }, 'thigh.R': { dir: mirrorDir(Rg.th) }, 'shin.R': { dir: mirrorDir(Rg.sh) },
    'upperarm.L': { dir: La.ua }, 'forearm.L': { dir: La.fa }, 'upperarm.R': { dir: mirrorDir(Ra.ua) }, 'forearm.R': { dir: mirrorDir(Ra.fa) },
    spine: ROT((run ? 16 : 7) * amt + 4, s * 9 * amt, 0), chest: ROT(0, -s * 10 * amt, 0), head: ROT(-(run ? 10 : 4) * amt, s * 5 * amt, 0),
  };
  if (cfg.legs === 3) {
    // third leg behind (shark): a third of a cycle later
    const p3 = phase + 2.1, s3 = Math.sin(p3);
    const th = pitch([0, -1, -0.1], -swing * s3);
    bones['thigh.B'] = { dir: th }; bones['shin.B'] = { dir: pitch(th, 8 + bendBack * Math.max(0, -Math.cos(p3))) };
  }
  const bob = Math.abs(c) * (run ? 0.06 : 0.025) * cfg.h * amt;
  return { bones, hips: { pos: [0, -bob - (run ? 0.04 : 0.02) * cfg.h, 0], scl: [1, 1 + Math.abs(c) * 0.02 * amt, 1] } };
}

// ---------------------------------------------------------------------------------------------------------------
// State poses (applied over the stance)
export const STATES = {
  jumpsquat: (cfg) => P({ ...sym({ thigh: D(0.2, -0.6, 0.8), shin: D(0.05, -1, -0.6), upperarm: D(0.5, -0.8, -0.3) }), spine: ROT(22, 0, 0) }, { hips: { pos: [0, -0.2 * cfg.h, 0], scl: [1.15, 0.82, 1.15] } }),
  land: (cfg) => P({ ...sym({ thigh: D(0.25, -0.6, 0.75), shin: D(0.05, -1, -0.5), upperarm: D(0.8, -0.5, 0.1) }), spine: ROT(18, 0, 0) }, { hips: { pos: [0, -0.16 * cfg.h, 0], scl: [1.12, 0.86, 1.12] } }),
  rise: (cfg) => P({ ...sym({ thigh: D(0.1, -0.85, 0.5), shin: D(0.05, -0.8, -0.6), upperarm: D(0.55, 0.3, 0.2), forearm: D(0.3, 0.8, 0.3) }), spine: ROT(-6, 0, 0), head: ROT(-10, 0, 0) }, { hips: { pos: [0, 0, 0], scl: [0.94, 1.08, 0.94] } }),
  fall: (cfg) => P({ ...sym({ thigh: D(0.2, -0.8, 0.45), shin: D(0.1, -1, 0.05), upperarm: D(0.8, 0.45, 0.1), forearm: D(0.6, 0.8, 0.1) }), spine: ROT(4, 0, 0), head: ROT(8, 0, 0) }),
  airjump: (cfg) => P({ ...sym({ thigh: D(0.1, -0.2, 1), shin: D(0.1, -1, 0.1), upperarm: D(0.7, 0.6, -0.2) }), spine: ROT(30, 0, 0) }),
  helpless: (cfg, t) => P({ ...sym({ upperarm: D(0.6, 0.75, Math.sin(t * 8) * 0.3), forearm: D(0.4, 0.9, 0.2), thigh: D(0.2, -1, 0.25), shin: D(0.1, -1, -0.3) }), head: ROT(15 + Math.sin(t * 6) * 10, 0, Math.sin(t * 5) * 10) }, { jaw: 0.6 }),
  hitstun: (cfg, t, F) => {
    const n = Math.sin(t * 31), m = Math.cos(t * 23);
    return P({
      ...sym({ upperarm: D(0.7, 0.45 + n * 0.2, -0.45), forearm: D(0.6, 0.6, -0.3 + m * 0.2), thigh: D(0.3, -0.7, 0.55), shin: D(0.15, -0.7, -0.4) }),
      'thigh.R': D(-0.1, -0.9, -0.5),
      spine: ROT(-24, n * 6, 0), chest: ROT(-14, 0, m * 6), neck: ROT(-10, 0, 0), head: ROT(-24 + n * 8, m * 10, 0),
    }, { jaw: 1, k: 1.4 });
  },
  tumble: (cfg, t) => P({ ...sym({ upperarm: D(0.8, 0.3, 0.2), forearm: D(0.5, 0.6, 0.4), thigh: D(0.3, -0.5, 0.7), shin: D(0.1, -0.9, -0.3) }), spine: ROT(25, 0, 0), head: ROT(20, 0, 0) }, { jaw: 0.8 }),
  down: (cfg) => P({ ...sym({ upperarm: D(0.95, 0.1, 0.2), forearm: D(0.7, 0.6, 0.2), thigh: D(0.2, -0.95, 0.15), shin: D(0.05, -1, 0.1) }), head: ROT(-10, 0, 20) }, { jaw: 0.4 }),
  shield: (cfg) => P({ ...sym({ upperarm: D(-0.15, -0.35, 0.92), forearm: D(-0.9, 0.3, 0.25), thigh: D(0.25, -0.75, 0.55), shin: D(0.05, -1, -0.4) }), spine: ROT(18, 0, 0), head: ROT(10, 0, 0) }, { hips: { pos: [0, -0.1 * cfg.h, 0], scl: [1.04, 0.95, 1.04] } }),
  // run turnaround: leaning back hard, the front foot braking
  skid: (cfg) => P({ 'thigh.L': D(0.15, -0.55, 0.85), 'shin.L': D(0.05, -0.95, 0.3), 'thigh.R': D(-0.12, -0.85, -0.45), ...sym({ upperarm: D(0.75, -0.2, 0.55), forearm: D(0.4, 0.4, 0.8) }), spine: ROT(-18, 0, 0), head: ROT(-8, 0, 0) }, { hips: { pos: [0, -0.1 * cfg.h, -0.05], scl: [1.05, 0.95, 1.05] } }),
  // crouched (down held): low on bent knees (the feet stay planted, the IK bends the legs), back rounded, the guard
  // close to the chest, the head up toward the fight; it breathes a little
  crouch: (cfg, t) => P({ ...sym({ thigh: D(0.25, -0.6, 0.75), shin: D(0.05, -1, -0.55), upperarm: D(0.3, -0.6, 0.72), forearm: D(-0.4, 0.5, 0.75) }), spine: ROT(22 + Math.sin(t * 3) * 1.5, 0, 0), chest: ROT(6, 0, 0), head: ROT(-14, 0, 0) },
    { hips: { pos: [0, -(0.19 + Math.sin(t * 3) * 0.006) * cfg.h, 0], scl: [1.06, 0.93, 1.06] } }),
  // the roll: curled into a ball (the view spins the whole body one turn about its side axis)
  roll: (cfg) => P({ ...sym({ thigh: D(0.15, 0.55, 0.82), shin: D(0.05, -0.95, 0.25), upperarm: D(0.3, -0.25, 0.9), forearm: D(0.1, -0.75, 0.6) }), spine: ROT(62, 0, 0), chest: ROT(24, 0, 0), neck: ROT(20, 0, 0), head: ROT(40, 0, 0) }, { hips: { pos: [0, -0.22 * cfg.h, 0], scl: [0.94, 0.94, 0.94] } }),
  dodge: (cfg) => P({ ...sym({ upperarm: D(0.1, -0.3, 0.95), forearm: D(-0.4, 0.4, 0.8), thigh: D(0.15, 0.2, 1), shin: D(0.05, -1, 0.1) }), spine: ROT(45, 0, 0), head: ROT(30, 0, 0) }, { hips: { pos: [0, -0.15 * cfg.h, 0], scl: [0.9, 0.85, 0.9] } }),
  ledge: (cfg, t) => P({ ...sym({ upperarm: D(0.2, 1, 0.4), forearm: D(0.1, 1, 0.3), thigh: D(0.15, -1, -0.05 + Math.sin(t * 3) * 0.1), shin: D(0.05, -1, -0.2) }), spine: ROT(8, 0, 0), head: ROT(-25, 0, 0) }, { hips: { pos: [0, 0.05 * cfg.h, 0] } }),
  grab: (cfg) => P({ ...sym({ upperarm: D(0.25, -0.15, 1), forearm: D(0.05, 0.05, 1) }), spine: ROT(18, 0, 0) }),
  grabbing: (cfg, t) => P({ ...sym({ upperarm: D(0.3, -0.35, 0.9), forearm: D(-0.2, 0.2, 1) }), spine: ROT(10, 0, 0), head: ROT(-5, 0, 0) }, { jaw: 0.3 + 0.2 * Math.sin(t * 6) }),
  grabbed: (cfg, t) => P({ ...sym({ upperarm: D(0.7, 0.6 + Math.sin(t * 22) * 0.3, 0.1), forearm: D(0.4, 0.9, 0.2), thigh: D(0.2, -0.8, 0.3 + Math.sin(t * 18) * 0.4), shin: D(0.1, -1, -0.2) }), head: ROT(-15, Math.sin(t * 14) * 20, 0) }, { jaw: 1 }),
  dizzy: (cfg, t) => P({ ...sym({ upperarm: D(0.5, -0.85, 0.2), forearm: D(0.4, -0.9, 0.3) }), spine: ROT(10, 0, Math.sin(t * 3) * 12), head: ROT(10, Math.sin(t * 2) * 25, Math.sin(t * 3 + 1) * 18) }, { jaw: 0.5 }),
  ko: (cfg) => P({}),
};

// ---------------------------------------------------------------------------------------------------------------
// Attack key poses: { wind, hit, [follow] } (partial poses over the stance). Characters override them in chars.js.
export const ATTACKS = {
  jab1: {
    wind: P({ 'upperarm.R': D(-0.55, -0.45, -0.3), 'forearm.R': D(-0.2, 0.5, 0.7), chest: ROT(0, 22, 0), spine: ROT(4, 8, 0) }),
    hit: P({ 'upperarm.R': D(-0.1, 0.04, 1), 'forearm.R': D(-0.04, 0.05, 1), chest: ROT(0, -26, 0), spine: ROT(12, -10, 0), 'upperarm.L': D(0.5, -0.6, -0.4) }, { jaw: 0.5 }),
  },
  jab2: {
    wind: P({ 'upperarm.L': D(0.55, -0.45, -0.3), 'forearm.L': D(0.2, 0.5, 0.7), chest: ROT(0, -22, 0), spine: ROT(4, -8, 0) }),
    hit: P({ 'upperarm.L': D(0.1, 0.04, 1), 'forearm.L': D(0.04, 0.05, 1), chest: ROT(0, 26, 0), spine: ROT(12, 10, 0), 'upperarm.R': D(-0.5, -0.6, -0.4) }, { jaw: 0.5 }),
  },
  jab3: {
    wind: P({ 'thigh.R': D(-0.1, -0.2, 0.95), 'shin.R': D(0, -0.95, 0.2), spine: ROT(-6, 0, 0), ...sym({ upperarm: D(0.7, -0.4, -0.3) }) }, { hips: { pos: [0, 0.03, 0] } }),
    hit: P({ 'thigh.R': D(-0.05, 0.15, 1), 'shin.R': D(0, 0.1, 1), spine: ROT(-18, 0, 0), ...sym({ upperarm: D(0.8, -0.2, -0.4) }), 'thigh.L': D(0.1, -1, -0.15) }, { jaw: 1, hips: { pos: [0, 0.04, 0.1] } }),
  },
  smash: {
    wind: P({ 'upperarm.R': D(-0.4, 0.55, -0.7), 'forearm.R': D(-0.1, 0.95, -0.2), 'upperarm.L': D(0.5, 0.3, 0.6), chest: ROT(-12, 42, 0), spine: ROT(-14, 18, 0), 'thigh.L': D(0.2, -0.9, 0.45), head: ROT(-6, -20, 0) }, { hips: { pos: [0, -0.06, -0.08], scl: [0.95, 1.06, 0.95] } }),
    hit: P({ 'upperarm.R': D(-0.08, -0.12, 1), 'forearm.R': D(0.05, -0.3, 1), 'upperarm.L': D(0.6, -0.5, -0.6), chest: ROT(20, -40, 0), spine: ROT(26, -15, 0), 'thigh.L': D(0.12, -0.7, 0.75), 'shin.L': D(0, -1, 0.05), 'thigh.R': D(-0.15, -0.9, -0.45) }, { jaw: 1, hips: { pos: [0, -0.1, 0.25], scl: [1.1, 0.92, 1.1] } }),
  },
  usmash: {
    wind: P({ ...sym({ upperarm: D(0.5, -0.8, 0.3), forearm: D(0.2, -0.6, 0.8), thigh: D(0.3, -0.55, 0.8), shin: D(0.05, -1, -0.6) }), spine: ROT(28, 0, 0) }, { hips: { pos: [0, -0.22, 0], scl: [1.18, 0.8, 1.18] } }),
    hit: P({ ...sym({ upperarm: D(0.2, 1, 0.1), forearm: D(0.05, 1, 0.05), thigh: D(0.1, -1, 0), shin: D(0, -1, 0) }), spine: ROT(-14, 0, 0), chest: ROT(-10, 0, 0), head: ROT(-30, 0, 0) }, { jaw: 1, hips: { pos: [0, 0.12, 0], scl: [0.86, 1.2, 0.86] } }),
  },
  // down smash: crouched, one arm sweeps the floor in front, the other behind
  dsmash: {
    wind: P({ ...sym({ upperarm: D(0.55, 0.55, 0.1), forearm: D(0.3, 0.9, 0.2) }), spine: ROT(12, 0, 0), chest: ROT(0, 25, 0), head: ROT(-8, 0, 0) }, { hips: { pos: [0, -0.16, 0], scl: [1.08, 0.9, 1.08] } }),
    hit: P({ 'upperarm.R': D(-0.25, -0.55, 0.85), 'forearm.R': D(-0.1, -0.5, 1), 'upperarm.L': D(0.25, -0.55, -0.85), 'forearm.L': D(0.1, -0.5, -1), spine: ROT(30, 0, 0), chest: ROT(0, -30, 0), head: ROT(10, 0, 0) }, { jaw: 1, hips: { pos: [0, -0.28, 0], scl: [1.14, 0.84, 1.14] } }),
  },
  // coup de fesse: he turns his back (the view spins the body half a turn), bends over and bumps with the hips
  buttbump: {
    wind: P({ ...sym({ upperarm: D(0.7, 0.35, 0.3), forearm: D(0.4, 0.8, 0.2), thigh: D(0.2, -0.85, 0.35), shin: D(0.05, -1, -0.35) }), spine: ROT(24, 0, 0), chest: ROT(8, 0, 0), head: ROT(-10, 0, 0) }, { hips: { pos: [0, -0.1, 0.08], scl: [1.08, 0.92, 1.08] } }),
    hit: P({ ...sym({ upperarm: D(0.85, 0.45, 0.1), forearm: D(0.6, 0.75, -0.1), thigh: D(0.15, -0.95, 0.2), shin: D(0.05, -1, -0.2) }), spine: ROT(48, 0, 0), chest: ROT(14, 0, 0), head: ROT(-36, 0, 0) }, { jaw: 1, hips: { pos: [0, -0.04, -0.32], scl: [1.12, 0.94, 1.12] } }),
    follow: P({ ...sym({ upperarm: D(0.7, 0.2, 0.2), forearm: D(0.4, 0.6, 0.3) }), spine: ROT(30, 0, 0), head: ROT(-20, 0, 0) }, { hips: { pos: [0, -0.06, -0.2] } }),
    turn: true,
  },
  // coup de tête: he leans far back, then throws the whole upper body into a forehead blow
  headbutt: {
    wind: P({ ...sym({ upperarm: D(0.55, -0.6, -0.5), forearm: D(0.3, -0.4, 0.4), thigh: D(0.2, -0.85, 0.4), shin: D(0.05, -1, -0.4) }), spine: ROT(-22, 0, 0), chest: ROT(-14, 0, 0), neck: ROT(-14, 0, 0), head: ROT(-26, 0, 0) }, { hips: { pos: [0, -0.06, -0.12], scl: [0.96, 1.04, 0.96] } }),
    hit: P({ ...sym({ upperarm: D(0.6, -0.55, -0.55), forearm: D(0.35, -0.5, 0.3), thigh: D(0.15, -0.8, 0.6), shin: D(0.05, -1, -0.15) }), 'thigh.R': D(-0.1, -0.9, -0.45), spine: ROT(34, 0, 0), chest: ROT(18, 0, 0), neck: ROT(14, 0, 0), head: ROT(26, 0, 0) }, { jaw: 1, hips: { pos: [0, -0.04, 0.2], scl: [1.06, 0.95, 1.06] } }),
    follow: P({ spine: ROT(20, 0, 0), head: ROT(12, 0, 0), ...sym({ upperarm: D(0.6, -0.6, -0.3) }) }, { hips: { pos: [0, -0.04, 0.12] } }),
  },
  // upward headbutt (up tilt): crouch, then springs up forehead first
  headbuttUp: {
    wind: P({ ...sym({ upperarm: D(0.5, -0.7, 0.3), forearm: D(0.2, -0.5, 0.8), thigh: D(0.3, -0.6, 0.75), shin: D(0.05, -1, -0.55) }), spine: ROT(30, 0, 0), head: ROT(16, 0, 0) }, { hips: { pos: [0, -0.2, 0], scl: [1.14, 0.84, 1.14] } }),
    hit: P({ ...sym({ upperarm: D(0.55, -0.8, -0.2), forearm: D(0.3, -0.6, 0.3), thigh: D(0.1, -1, 0.05), shin: D(0, -1, 0) }), spine: ROT(-16, 0, 0), chest: ROT(-12, 0, 0), neck: ROT(-14, 0, 0), head: ROT(-34, 0, 0) }, { jaw: 1, hips: { pos: [0, 0.14, 0], scl: [0.88, 1.16, 0.88] } }),
  },
  // back air: a kick behind, looking over the shoulder
  bair: {
    wind: P({ 'thigh.L': D(0.1, -0.5, 0.85), 'shin.L': D(0.05, -1, 0.3), spine: ROT(8, 0, 0), head: ROT(0, 35, 0), ...sym({ upperarm: D(0.6, -0.5, 0.4) }) }, { hips: { scl: [0.95, 0.95, 0.95] } }),
    hit: P({ 'thigh.L': D(0.12, 0.05, -1), 'shin.L': D(0.05, 0.12, -1), 'thigh.R': D(-0.12, -0.8, 0.5), spine: ROT(38, 0, 0), chest: ROT(12, 0, 0), head: ROT(-20, 50, 0), ...sym({ upperarm: D(0.75, -0.45, 0.45) }) }, { jaw: 1 }),
  },
  nair: {
    wind: P({ ...sym({ thigh: D(0.2, -0.4, 0.8), shin: D(0.1, -1, -0.1), upperarm: D(0.6, 0.2, 0.6) }), spine: ROT(30, 0, 0) }, { hips: { scl: [0.9, 0.9, 0.9] } }),
    hit: P({ ...sym({ upperarm: D(1, 0.05, 0), forearm: D(1, 0, 0.1), thigh: D(0.8, -0.5, 0.3), shin: D(0.95, -0.3, 0.1) }), spine: ROT(0, 0, 0) }, { jaw: 0.8 }),
  },
  fair: {
    wind: P({ ...sym({ upperarm: D(0.3, 0.7, -0.6), forearm: D(0.1, 1, -0.2) }), spine: ROT(-20, 0, 0), chest: ROT(-15, 0, 0), ...sym({ thigh: D(0.15, -0.9, 0.4) }) }),
    hit: P({ ...sym({ upperarm: D(0.15, -0.35, 0.95), forearm: D(0.05, -0.6, 0.8) }), spine: ROT(36, 0, 0), chest: ROT(20, 0, 0), ...sym({ thigh: D(0.15, -0.7, -0.6) }) }, { jaw: 1 }),
  },
  uair: {
    wind: P({ ...sym({ thigh: D(0.2, -0.7, 0.6), shin: D(0.05, -1, -0.4) }), spine: ROT(15, 0, 0) }),
    hit: P({ 'thigh.R': D(-0.1, 0.85, 0.5), 'shin.R': D(0, 1, 0.1), 'thigh.L': D(0.15, -0.6, -0.7), ...sym({ upperarm: D(0.85, -0.3, -0.3) }), spine: ROT(-40, 0, 0), head: ROT(-25, 0, 0) }, { jaw: 1 }),
  },
  dair: {
    wind: P({ ...sym({ thigh: D(0.25, -0.1, 0.95), shin: D(0.05, -1, 0.1), upperarm: D(0.6, 0.75, 0.1), forearm: D(0.3, 0.95, 0.1) }), spine: ROT(10, 0, 0) }, { hips: { scl: [1.1, 0.9, 1.1] } }),
    hit: P({ ...sym({ thigh: D(0.12, -1, 0.05), shin: D(0.05, -1, 0.05), upperarm: D(0.7, 0.7, -0.1), forearm: D(0.3, 1, 0) }), spine: ROT(-6, 0, 0), head: ROT(20, 0, 0) }, { jaw: 1, hips: { scl: [0.88, 1.18, 0.88] } }),
  },
  grab: {
    wind: P({ ...sym({ upperarm: D(0.6, -0.3, 0.6), forearm: D(0.3, 0.1, 0.9) }), spine: ROT(5, 0, 0) }),
    hit: P({ ...sym({ upperarm: D(0.22, -0.1, 1), forearm: D(0.05, 0, 1) }), spine: ROT(22, 0, 0) }, { jaw: 0.4 }),
  },
  throw: {
    wind: P({ ...sym({ upperarm: D(0.35, 1, -0.2), forearm: D(0.1, 1, 0.3) }), spine: ROT(-24, 0, 0), chest: ROT(-12, 0, 0) }, { hips: { scl: [0.95, 1.08, 0.95] } }),
    hit: P({ ...sym({ upperarm: D(0.2, -0.1, 1), forearm: D(0.05, -0.3, 1) }), spine: ROT(32, 0, 0), chest: ROT(15, 0, 0) }, { jaw: 1, hips: { pos: [0, -0.05, 0.15] } }),
  },
  throw1: {
    wind: P({ 'upperarm.R': D(-0.3, 0.7, -0.6), 'forearm.R': D(-0.05, 1, -0.2), chest: ROT(-8, 35, 0), spine: ROT(-10, 15, 0), 'upperarm.L': D(0.6, -0.1, 0.8) }),
    hit: P({ 'upperarm.R': D(-0.15, 0.2, 1), 'forearm.R': D(-0.05, 0.05, 1), chest: ROT(14, -35, 0), spine: ROT(18, -12, 0), 'upperarm.L': D(0.6, -0.6, -0.5) }, { jaw: 0.8 }),
  },
  throw2: {
    wind: P({ ...sym({ upperarm: D(0.3, 1, -0.4), forearm: D(0.1, 1, -0.5) }), spine: ROT(-26, 0, 0), chest: ROT(-14, 0, 0) }, { hips: { scl: [0.95, 1.07, 0.95] } }),
    hit: P({ ...sym({ upperarm: D(0.2, 0.25, 1), forearm: D(0.05, 0, 1) }), spine: ROT(28, 0, 0), chest: ROT(12, 0, 0) }, { jaw: 1 }),
  },
  shotgun: {
    wind: P({ 'upperarm.R': D(-0.25, -0.2, 0.95), 'forearm.R': D(0.1, 0.1, 1), 'upperarm.L': D(0.2, -0.3, 0.9), 'forearm.L': D(-0.5, 0.1, 0.85) }),
    hit: P({ 'upperarm.R': D(-0.25, 0.1, 0.95), 'forearm.R': D(0.1, 0.35, 1), spine: ROT(-14, 0, 0), chest: ROT(-10, 0, 0) }, { jaw: 1, hips: { pos: [0, 0, -0.12] } }),
  },
  bite: {
    wind: P({ spine: ROT(-18, 0, 0), chest: ROT(-12, 0, 0), head: ROT(-25, 0, 0), ...sym({ upperarm: D(0.7, -0.3, -0.4) }) }, { jaw: 1 }),
    hit: P({ spine: ROT(28, 0, 0), chest: ROT(15, 0, 0), head: ROT(15, 0, 0), ...sym({ upperarm: D(0.8, -0.4, 0.3) }) }, { jaw: 0, hips: { pos: [0, -0.05, 0.3] } }),
  },
  helico: {
    wind: P({ ...sym({ upperarm: D(0.3, 1, 0.1), forearm: D(0.1, 1, 0.2) }) }),
    hit: P({ ...sym({ upperarm: D(0.25, 1, 0.05), forearm: D(0.05, 1, 0.05), thigh: D(0.15, -1, 0.2) }), spine: ROT(-5, 0, 0) }, { jaw: 1 }),
  },
  thunder: {
    wind: P({ ...sym({ upperarm: D(0.5, 0.85, 0), forearm: D(0.3, 1, 0) }), head: ROT(-30, 0, 0) }),
    hit: P({ ...sym({ upperarm: D(0.9, 0.45, 0), forearm: D(0.8, 0.6, 0), thigh: D(0.35, -0.95, 0) }), spine: ROT(-12, 0, 0), head: ROT(-40, 0, 0) }, { jaw: 1, hips: { scl: [1.1, 1.05, 1.1] } }),
  },
  zip: {
    wind: P({ ...sym({ upperarm: D(0.3, -0.5, -0.8), thigh: D(0.1, -0.7, -0.6) }), spine: ROT(40, 0, 0) }, { hips: { scl: [0.85, 1.15, 0.85] } }),
    hit: P({ ...sym({ upperarm: D(0.25, -0.2, -1), forearm: D(0.1, 0, -1), thigh: D(0.1, -0.4, -0.9), shin: D(0.05, -0.2, -1) }), spine: ROT(70, 0, 0) }, { jaw: 0.6, hips: { scl: [0.8, 1.25, 0.8] } }),
  },
  jupiter: {
    wind: P({ ...sym({ upperarm: D(0.6, 0.75, 0.2), forearm: D(0.2, 1, 0.1) }), head: ROT(-25, 0, 0) }),
    hit: P({ ...sym({ upperarm: D(0.3, 1, 0.05), forearm: D(0.1, 1, 0), thigh: D(0.1, -1, 0.1), shin: D(0.05, -1, -0.1) }), head: ROT(-35, 0, 0), spine: ROT(-8, 0, 0) }, { jaw: 1 }),
  },
  decree: {
    wind: P({ ...sym({ upperarm: D(0.25, 1, 0.1), forearm: D(-0.3, 1, 0.2) }), head: ROT(-30, 0, 0), spine: ROT(-14, 0, 0) }, { hips: { scl: [0.95, 1.06, 0.95] } }),
    hit: P({ ...sym({ upperarm: D(0.2, -0.3, 1), forearm: D(-0.2, -0.5, 0.85) }), spine: ROT(32, 0, 0), chest: ROT(14, 0, 0) }, { jaw: 1, hips: { pos: [0, -0.1, 0.1], scl: [1.08, 0.9, 1.08] } }),
  },
  soda: {
    wind: P({ ...sym({ upperarm: D(0.3, -0.2, 0.95), forearm: D(-0.4, 0.4, 0.8) }) }),
    hit: P({ ...sym({ upperarm: D(0.2, 1, 0.1), forearm: D(0.05, 1, 0.1), thigh: D(0.2, -1, -0.1) }), head: ROT(-30, 0, 0) }, { jaw: 1 }),
  },
  bellyflop: {
    wind: P({ ...sym({ upperarm: D(0.5, 0.85, -0.1), forearm: D(0.3, 1, 0) }), spine: ROT(-20, 0, 0) }, { hips: { scl: [1.12, 0.88, 1.12] } }),
    hit: P({ ...sym({ upperarm: D(1, 0.1, 0.2), forearm: D(1, 0.1, 0.3), thigh: D(0.3, -0.3, -0.9), shin: D(0.1, 0, -1) }), spine: ROT(40, 0, 0) }, { jaw: 1, hips: { scl: [1.2, 0.85, 1.2] } }),
  },
  grate: {
    wind: P({ 'upperarm.R': D(-0.4, -0.3, 0.85), 'forearm.R': D(0, 0.2, 1) }),
    hit: P({ 'upperarm.R': D(-0.2, -0.1, 1), 'forearm.R': D(0.05, 0.1, 1), spine: ROT(10, 0, 0) }, { jaw: 1 }),
  },
  sprinkle: {
    wind: P({ 'upperarm.R': D(-0.3, 0.6, 0.6), 'forearm.R': D(0, 0.2, 1) }),
    hit: P({ 'upperarm.R': D(-0.3, 0.5, 0.7), 'forearm.R': D(-0.1, -0.2, 1), spine: ROT(14, 0, 0) }, { jaw: 0.5 }),
  },
  tongue: {
    wind: P({ spine: ROT(-8, 0, 0), head: ROT(-14, 0, 0), ...sym({ upperarm: D(0.7, -0.6, 0.1) }) }, { hips: { scl: [1.06, 0.94, 1.06] } }),
    hit: P({ spine: ROT(22, 0, 0), head: ROT(10, 0, 0), ...sym({ upperarm: D(0.8, -0.4, -0.3) }) }, { jaw: 1, hips: { pos: [0, -0.05, 0.1] } }),
  },
  gulp: { wind: P({ head: ROT(-15, 0, 0), spine: ROT(-5, 0, 0) }, { jaw: 0.3 }), hit: P({ head: ROT(12, 0, 0), spine: ROT(24, 0, 0), ...sym({ upperarm: D(0.6, -0.2, 0.8) }) }, { jaw: 1 }) },
  full: { wind: P({ ...sym({ upperarm: D(0.85, -0.3, 0.3) }) }), hit: P({ ...sym({ upperarm: D(0.9, -0.2, 0.3) }) }, { hips: { scl: [1.3, 1.1, 1.3] } }) },
  frogleap: {
    wind: P({ ...sym({ thigh: D(0.35, -0.4, 0.85), shin: D(0.1, -1, -0.7), upperarm: D(0.6, -0.8, -0.2) }), spine: ROT(30, 0, 0) }, { hips: { pos: [0, -0.25, 0], scl: [1.2, 0.75, 1.2] } }),
    hit: P({ ...sym({ thigh: D(0.2, -1, -0.15), shin: D(0.05, -1, -0.1), upperarm: D(0.5, 1, 0.2), forearm: D(0.2, 1, 0) }), spine: ROT(-10, 0, 0) }, { jaw: 1, hips: { scl: [0.82, 1.28, 0.82] } }),
  },
  sprint: {
    wind: P({ spine: ROT(35, 0, 0) }),
    hit: P({ spine: ROT(40, 0, 0), ...sym({ upperarm: D(0.5, -0.3, -0.8) }) }, { jaw: 0.6 }),
  },
  breach: {
    wind: P({ ...sym({ thigh: D(0.3, -0.5, 0.8), shin: D(0.1, -1, -0.6) }), spine: ROT(30, 0, 0) }, { hips: { pos: [0, -0.2, 0], scl: [1.15, 0.8, 1.15] } }),
    hit: P({ ...sym({ thigh: D(0.1, -1, 0), shin: D(0, -1, 0), upperarm: D(0.9, 0.3, 0) }), spine: ROT(-30, 0, 0) }, { jaw: 1, hips: { scl: [0.85, 1.25, 0.85] } }),
  },
  dive: { wind: P({ spine: ROT(50, 0, 0), ...sym({ upperarm: D(0.3, 0.2, 0.95) }) }), hit: P({ spine: ROT(60, 0, 0) }) },
  tungtung: {
    wind: P({ 'upperarm.R': D(-0.35, 0.7, -0.4), 'forearm.R': D(0, 1, 0.2), chest: ROT(0, 25, 0), spine: ROT(-5, 10, 0) }),
    hit: P({ 'upperarm.R': D(-0.15, -0.2, 1), 'forearm.R': D(0, -0.4, 0.95), chest: ROT(10, -25, 0), spine: ROT(16, -10, 0) }, { jaw: 1 }),
  },
  // --- dash attacks (A while running) ---
  // sliding kick: dropped low, the front leg straight out, leaning back on one hand
  slide: {
    wind: P({ 'thigh.R': D(-0.1, -0.6, 0.8), 'shin.R': D(0, -0.9, 0.4), 'thigh.L': D(0.15, -0.5, -0.8), spine: ROT(-12, 0, 0), ...sym({ upperarm: D(0.6, -0.5, -0.5) }) }, { hips: { pos: [0, -0.3, 0], scl: [1.06, 0.94, 1.06] } }),
    hit: P({ 'thigh.R': D(-0.08, -0.15, 1), 'shin.R': D(0, -0.1, 1), 'thigh.L': D(0.2, -0.6, -0.75), 'shin.L': D(0.05, -0.9, 0.45), spine: ROT(-34, 0, 0), chest: ROT(-10, 0, 0), 'upperarm.L': D(0.5, -0.8, -0.4), 'upperarm.R': D(-0.6, 0.3, 0.6) }, { jaw: 1, hips: { pos: [0, -0.62, 0.1], scl: [1.08, 0.92, 1.08] } }),
    follow: P({ 'thigh.R': D(-0.08, -0.4, 0.9), spine: ROT(-20, 0, 0) }, { hips: { pos: [0, -0.45, 0] } }),
  },
  // shoulder charge: head down, the near shoulder first
  shoulder: {
    wind: P({ ...sym({ upperarm: D(0.5, -0.7, -0.4), forearm: D(0.2, 0.2, 0.9) }), spine: ROT(18, -20, 0), chest: ROT(8, -24, 0), head: ROT(10, 15, 0) }, { hips: { pos: [0, -0.12, 0], scl: [1.06, 0.94, 1.06] } }),
    hit: P({ 'upperarm.R': D(-0.6, -0.5, 0.6), 'forearm.R': D(0.3, 0.3, 0.9), 'upperarm.L': D(0.6, -0.6, -0.4), spine: ROT(34, -34, 0), chest: ROT(14, -30, 0), head: ROT(24, 25, 0), 'thigh.L': D(0.15, -0.7, 0.7), 'thigh.R': D(-0.1, -0.85, -0.5) }, { jaw: 1, hips: { pos: [0, -0.16, 0.3], scl: [1.1, 0.92, 1.1] } }),
  },
  // flying kick: one leg shot forward at chest height, the body leaning back
  flykick: {
    wind: P({ 'thigh.R': D(-0.1, 0.1, 0.95), 'shin.R': D(0, -0.9, 0.3), 'thigh.L': D(0.15, -0.7, -0.6), spine: ROT(-10, 0, 0), ...sym({ upperarm: D(0.7, 0.2, 0.3) }) }, { hips: { pos: [0, 0.12, 0] } }),
    hit: P({ 'thigh.R': D(-0.05, 0.3, 1), 'shin.R': D(0, 0.32, 1), 'thigh.L': D(0.15, -0.85, -0.5), 'shin.L': D(0.05, -0.6, -0.8), spine: ROT(-30, 0, 0), chest: ROT(-8, 0, 0), ...sym({ upperarm: D(0.8, 0.35, -0.3) }) }, { jaw: 1, hips: { pos: [0, 0.3, 0.15] } }),
  },
  // drop kick: both feet forward
  dropkick: {
    wind: P({ ...sym({ thigh: D(0.15, -0.3, 0.9), shin: D(0.05, -1, 0.1), upperarm: D(0.7, 0.4, -0.2) }), spine: ROT(-14, 0, 0) }, { hips: { pos: [0, 0.2, 0] } }),
    hit: P({ ...sym({ thigh: D(0.12, 0.35, 1), shin: D(0.05, 0.35, 1), upperarm: D(0.8, 0.3, -0.4), forearm: D(0.6, 0.6, -0.3) }), spine: ROT(-52, 0, 0), chest: ROT(-14, 0, 0), head: ROT(20, 0, 0) }, { jaw: 1, hips: { pos: [0, 0.35, 0.1] } }),
  },
  // clothesline: the arm swung out wide at neck height
  lariat: {
    wind: P({ 'upperarm.R': D(-1, 0.1, -0.35), 'forearm.R': D(-0.95, 0.15, 0.1), chest: ROT(0, 35, 0), spine: ROT(4, 14, 0), 'upperarm.L': D(0.6, -0.5, 0.4) }),
    hit: P({ 'upperarm.R': D(-0.75, 0.05, 0.65), 'forearm.R': D(-0.6, 0.05, 0.8), chest: ROT(10, -38, 0), spine: ROT(14, -18, 0), 'upperarm.L': D(0.6, -0.6, -0.5), head: ROT(6, -15, 0) }, { jaw: 1, hips: { pos: [0, -0.05, 0.2] } }),
  },
  // diving tackle / belly slide: thrown forward, arms ahead
  divetackle: {
    wind: P({ ...sym({ upperarm: D(0.3, 0.2, 0.95), forearm: D(0.1, 0.1, 1), thigh: D(0.2, -0.6, 0.7) }), spine: ROT(40, 0, 0) }, { hips: { pos: [0, -0.15, 0] } }),
    hit: P({ ...sym({ upperarm: D(0.25, 0.05, 1), forearm: D(0.1, 0, 1), thigh: D(0.12, -0.3, -0.95), shin: D(0.05, 0.2, -1) }), spine: ROT(78, 0, 0), chest: ROT(8, 0, 0), head: ROT(-50, 0, 0) }, { jaw: 1, hips: { pos: [0, -0.55, 0.1], scl: [1.06, 0.95, 1.06] } }),
  },
  // running layup: up off one foot, the ball arm stretched high in front
  layup: {
    wind: P({ 'thigh.L': D(0.15, -0.3, 0.9), 'shin.L': D(0.05, -1, 0.1), 'upperarm.R': D(-0.3, 0.2, 0.9), spine: ROT(10, 0, 0) }, { hips: { pos: [0, -0.1, 0] } }),
    hit: P({ 'thigh.L': D(0.15, 0.2, 1), 'shin.L': D(0.05, -0.9, 0.3), 'upperarm.R': D(-0.15, 0.95, 0.3), 'forearm.R': D(-0.05, 1, 0.1), 'upperarm.L': D(0.6, -0.4, 0.5), spine: ROT(-14, 0, 0), head: ROT(-30, 0, 0) }, { jaw: 1, hips: { pos: [0, 0.4, 0.1] } }),
  },
  drum: {
    wind: P({ ...sym({ upperarm: D(0.3, 0.9, 0.4), forearm: D(0.05, 1, 0.3) }), spine: ROT(-14, 0, 0) }, { hips: { scl: [0.96, 1.05, 0.96] } }),
    hit: P({ ...sym({ upperarm: D(0.2, -0.6, 0.8), forearm: D(0.05, -0.95, 0.4) }), spine: ROT(36, 0, 0) }, { jaw: 1, hips: { pos: [0, -0.1, 0], scl: [1.12, 0.9, 1.12] } }),
  },
};

// timeline of a move pose: key frames derived from its active frames (windup peak just before, strike, hold, recover)
export function attackPose(A, M, f, charge) {
  const tl = moveTimeline(M);
  const a = tl.a, b = tl.b, dur = tl.dur;
  const keys = [
    { f: 0, pose: { bones: {} } },
    { f: Math.max(1, a - 1), pose: A.wind || { bones: {} }, e: 'out' },
    { f: a + 0.6, pose: A.hit || A.wind, e: 'snap' },
    { f: b + 2, pose: A.follow || A.hit || A.wind, e: 'inout' },
    { f: Math.max(b + 3, dur), pose: { bones: {} }, e: 'inout' },
  ];
  if (M.charge && charge > 0) return A.wind;
  return sample(keys, f);
}

export { merge, P, D, ROT };
