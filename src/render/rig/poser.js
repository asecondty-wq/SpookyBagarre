// Target pose of a rigged fighter for the current frame: stance, feet planted with leg IK, a walk/run cycle driven
// by the distance travelled, air and reaction poses, and the move keyframes synced to the simulation frames.
// Returns { pose, key, charge, shake, spin, body } where `body` asks the view for whole-body motion (tumbles,
// lying down, spins) that a skeleton alone cannot do.
import { stance, STATES, ATTACKS, attackPose, merge, D, ROT } from './library.js';
import { pitch, mirrorDir, mix, sample } from './animator.js';
import { moveTimeline } from '../poses.js';

const GROUND = new Set(['idle', 'walk', 'run', 'land', 'jumpsquat', 'shield', 'grabbing', 'dizzy', 'stunned', 'getup', 'tech', 'respawn', 'dodge']);
const SPIN_KEYS = new Set(['nair', 'frogleap', 'breach']);

const sides = (cfg) => (cfg.legs === 3 ? ['L', 'R', 'B'] : ['L', 'R']);

// planted feet (offsets from the rest ankles), knees bent by the hips' drop
function plant(cfg, extra) {
  const ik = {};
  const w = (cfg.wide || 0) * cfg.h;
  for (const s of sides(cfg)) ik[s] = [s === 'L' ? w : s === 'R' ? -w : 0, 0, s === 'B' ? -0.02 * cfg.h : 0.02 * cfg.h, 0];
  return Object.assign(ik, extra || {});
}

// walk / run: each foot follows z = S cos(p), lifted during its forward swing; arms swing opposite
function gait(cfg, p, amt, run, t) {
  const h = cfg.h;
  const S = (run ? 0.34 : 0.2) * h * (cfg.stride || 1);
  const lift = (run ? 0.17 : 0.08) * h;
  const w = (cfg.wide || 0) * h;
  const foot = (ph, x) => {
    const c = Math.cos(ph), s = Math.sin(ph);
    const up = Math.max(0, -s);
    return [x, lift * up * amt, S * c * amt + 0.02 * h, 28 * up * amt];
  };
  const ik = { L: foot(p, w), R: foot(p + Math.PI, -w) };
  if (cfg.legs === 3) ik.B = foot(p + Math.PI * 0.5, 0);
  const A = (run ? 58 : 30) * amt;
  const c = Math.cos(p);
  const g = cfg.guard;
  const base = g === 'claws' || g === 'boxer' ? [0.45, -0.85, 0.25] : [0.38, -0.92, 0.05];
  const fa = run ? [0.2, 0.25, 0.95] : [0.25, -0.55, 0.75];
  const bones = {
    'upperarm.L': { dir: pitch(base, c * A) }, 'forearm.L': { dir: pitch(fa, c * A * 0.6) },
    'upperarm.R': { dir: mirrorDir(pitch(base, -c * A)) }, 'forearm.R': { dir: mirrorDir(pitch(fa, -c * A * 0.6)) },
    spine: ROT((run ? 16 : 6) * amt + (cfg.lean || 0), Math.sin(p) * 8 * amt, 0),
    chest: ROT(0, -Math.sin(p) * 11 * amt, Math.cos(2 * p) * 2 * amt),
    head: ROT(-(run ? 10 : 4) * amt, Math.sin(p) * 5 * amt, 0),
  };
  const bob = (run ? 0.07 : 0.03) * h * amt;
  const hy = run ? -bob * (0.5 - 0.5 * Math.cos(2 * p)) - 0.05 * h * amt : bob * (0.5 + 0.5 * Math.cos(2 * p + Math.PI)) - 0.04 * h * amt;
  return { bones, ik, hips: { pos: [Math.sin(p) * 0.02 * h * amt, hy, 0], scl: [1, 1 + 0.03 * Math.abs(Math.cos(p)) * amt, 1] } };
}

// scale the hips motion written for a ~1.7 m character
function scaleHips(pose, k) {
  if (!pose || !pose.hips || !pose.hips.pos) return pose;
  return { ...pose, hips: { ...pose.hips, pos: [pose.hips.pos[0] * k, pose.hips.pos[1] * k, pose.hips.pos[2] * k] } };
}

function legsUsed(A) {
  const out = {};
  for (const k of ['wind', 'hit', 'follow']) {
    const P = A && A[k];
    if (!P || !P.bones) continue;
    for (const n of Object.keys(P.bones)) {
      const m = /^(thigh|shin)\.(L|R|B)$/.exec(n);
      if (m) out[m[2]] = true;
    }
  }
  return out;
}

export class Poser {
  constructor(cfg) {
    this.cfg = cfg;
    this.dist = 0;     // distance travelled on the ground (drives the gait phase)
    this.walkAmt = 0;  // 0 idle .. 1 moving
    this.runAmt = 0;
    this.prevState = '';
    this.stateT = 0;
  }

  build(F, M, t, dt) {
    const cfg = this.cfg, h = cfg.h;
    const st = F.state;
    if (st !== this.prevState) { this.prevState = st; this.stateT = 0; } else this.stateT += dt;
    const grounded = F.grounded && GROUND.has(st) || (st === 'move' && F.grounded);
    const speed = Math.hypot(F.vx || 0, F.vz || 0); // units per second
    const moving = grounded && (st === 'walk' || st === 'run' || (st === 'move' && M && M.pose === 'sprint'));
    this.walkAmt += ((moving ? 1 : 0) - this.walkAmt) * Math.min(1, dt * 10);
    this.runAmt += ((moving && (st === 'run' || speed > 7) ? 1 : 0) - this.runAmt) * Math.min(1, dt * 8);
    if (grounded) this.dist += speed * dt;

    // --- base: stance (+ gait) ------------------------------------------------------------------------------
    let base = stance(cfg, t, F);
    const out = { key: null, charge: 0, shake: 0, spin: 0, body: null };
    if (grounded) {
      base.ik = plant(cfg);
      if (this.walkAmt > 0.02) {
        const S = (this.runAmt > 0.5 ? 0.34 : 0.2) * h * (cfg.stride || 1);
        const p = this.dist / (4 * S) * Math.PI * 2;
        const run = this.runAmt > 0.5;
        const g = gait(cfg, p, this.walkAmt, run, t);
        base = mix(base, g, Math.min(1, this.walkAmt * 1.2));
        base.ik = g.ik;
      }
    }

    // --- state poses -----------------------------------------------------------------------------------------
    let statePose = null;
    switch (st) {
      case 'jumpsquat': statePose = STATES.jumpsquat(cfg); break;
      case 'land': statePose = STATES.land(cfg); break;
      case 'air': statePose = (F.vy > 0.02 ? (F.jumps < (cfg.airJumps || 1) && this.stateT < 0.3 ? STATES.airjump(cfg) : STATES.rise(cfg)) : STATES.fall(cfg)); break;
      case 'tumble': statePose = STATES.tumble(cfg, t); out.body = { spinX: t * 9 }; break;
      case 'helpless': statePose = STATES.helpless(cfg, t); break;
      case 'hitstun': statePose = STATES.hitstun(cfg, t, F); if (F.launchKb > 90 && !F.grounded) out.body = { spinX: -t * 14 }; break;
      case 'down': statePose = STATES.down(cfg); out.body = { lie: 1 }; break;
      case 'getup': case 'tech': statePose = STATES.land(cfg); break;
      case 'shield': statePose = STATES.shield(cfg); break;
      case 'dodge': statePose = STATES.dodge(cfg); break;
      case 'airdodge': statePose = STATES.dodge(cfg); out.body = { spinY: (F.st || 0) * 0.35 }; break;
      case 'ledge': statePose = STATES.ledge(cfg, t); break;
      case 'grabbing': statePose = STATES.grabbing(cfg, t); break;
      case 'grabbed': case 'held': statePose = STATES.grabbed(cfg, t); break;
      case 'dizzy': case 'stunned': statePose = STATES.dizzy(cfg, t); break;
      case 'respawn': statePose = STATES.rise(cfg); break;
      default: break;
    }
    if (statePose) {
      statePose = scaleHips(statePose, 1);
      base = mix(base, statePose, 1);
      if (statePose.bones) for (const s of sides(cfg)) if (statePose.bones['thigh.' + s] && !grounded) { if (base.ik) base.ik[s] = false; }
    }
    if (!grounded) delete base.ik;
    else if (base.ik && (st === 'jumpsquat' || st === 'land' || st === 'shield' || st === 'getup' || st === 'tech')) base.ik = plant(cfg);

    // --- moves ------------------------------------------------------------------------------------------------
    let pose = base;
    if (st === 'move' && M) {
      const ov = cfg.moves || {};
      const key = ov[F.move] ? F.move : M.pose;
      const A = ov[F.move] || ov[M.pose] || ATTACKS[M.pose];
      out.key = key;
      if (A) {
        const k = h / 1.7;
        const over = (P) => (P ? mix(base, scaleHips(P, k), 1) : null);
        const A2 = { wind: over(A.wind), hit: over(A.hit), follow: over(A.follow) };
        const tl = moveTimeline(M);
        // the strike pose is the target one frame before the hitbox comes out, so the (stiff) springs land it on time
        const fw = Math.max(1, tl.a - 2), fh = Math.max(fw + 0.5, tl.a - 1);
        const keys = [
          { f: 0, pose: base },
          { f: fw, pose: A2.wind || base, e: 'out' },
          { f: fh, pose: A2.hit || A2.wind || base, e: 'snap' },
          { f: tl.b + 2, pose: A2.follow || A2.hit || A2.wind || base, e: 'inout' },
          { f: Math.max(tl.b + 4, tl.dur), pose: base, e: 'inout' },
        ];
        const charging = M.charge && F.mf === M.charge.at && F.mv && F.mv.charge > 0;
        pose = charging ? (A2.wind || base) : (sample(keys, F.mf) || base);
        pose = { ...pose, bones: { ...pose.bones } };
        // a move that kicks takes that leg off the IK
        if (pose.ik) {
          const used = legsUsed(A);
          pose.ik = { ...pose.ik };
          for (const s of Object.keys(used)) pose.ik[s] = false;
        }
        if (SPIN_KEYS.has(M.pose) && F.mf >= tl.a && F.mf <= tl.b + 4) out.spin = (F.mf - tl.a) * 0.9;
        if (A.grate && F.mf >= tl.a) out.grate = 1;
        if (A.propSpin) out.propSpin = F.va ? F.va[1] || 0 : 0;
        if (F.mf >= fw && F.mf <= tl.b + 1) pose.k = Math.max(pose.k || 1, 3);
        if (charging) {
          const c = F.mv.charge / M.charge.max;
          out.shake = 0.03 + c * 0.06;
          out.charge = c;
        }
      }
      if (M.pose === 'sprint' && F.grounded) {
        const S = 0.34 * h;
        const g = gait(cfg, this.dist / (4 * S) * Math.PI * 2, 1, true, t);
        pose = mix(pose, { bones: { ...g.bones, spine: ROT(35, 0, 0) }, hips: g.hips }, 1);
        pose.ik = g.ik;
      }
    }
    if (cfg.extra) pose = cfg.extra(pose, F, M, t, out) || pose;
    out.pose = pose;
    return out;
  }
}

export { D, ROT, merge };
