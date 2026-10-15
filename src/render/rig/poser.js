// Target pose of a rigged fighter for the current frame: stance, feet planted with leg IK, a walk/run cycle driven
// by the distance travelled, air and reaction poses, and the move keyframes synced to the simulation frames.
// Returns { pose, key, charge, shake, spin, body } where `body` asks the view for whole-body motion (tumbles,
// lying down, spins) that a skeleton alone cannot do.
import { stance, STATES, ATTACKS, attackPose, merge, D, ROT } from './library.js';
import { pitch, mirrorDir, mix, sample } from './animator.js';
import { moveTimeline } from '../poses.js';
import { hasClip, clipPose, clipLength, CLIPS } from './clips.js';
import { NATIVE_MOVES, NATIVE_POSES, NATIVE_STATES, LEDGE_CLIMB, GRABBED, keysAt } from './nativeMoves.js';

const GROUND = new Set(['idle', 'walk', 'run', 'crouch', 'land', 'jumpsquat', 'shield', 'grabbing', 'dizzy', 'stunned', 'getup', 'tech', 'respawn', 'dodge']);
const SPIN_KEYS = new Set(['nair', 'frogleap', 'breach']);

// moves played from the Tripo clips: the clip segment [from, to] (clip frames) is stretched over the move so that
// its strike frame lands on the hitbox; the springs smooth it all
const CLIP_MOVES = {
  jab1: { clip: 'box_01', from: 9, strike: 17, to: 27 },       // left straight
  jab2: { clip: 'box_02', from: 45, strike: 54, to: 64 },      // right straight
  jab3: { clip: 'box_03', from: 11, strike: 20, to: 32 },      // left hook
  ftilt: { clip: 'front_kick_01', from: 18, strike: 30, to: 46 }, // front kick
  smash: { clip: 'chop', from: 38, strike: 61, to: 67 },       // big two-handed blow
  fair: { clip: 'front_kick_01', from: 20, strike: 30, to: 40 },   // flying kick
  uair: { clip: 'volleyball', from: 50, strike: 59, to: 66 },      // volleyball spike, overhead
  throw1: { clip: 'pitch_baseball', from: 38, strike: 55, to: 62 },
  throw2: { clip: 'pitch_baseball', from: 38, strike: 55, to: 62 },
};

function clipMove(CM, F, M, tl, base, hipK, charging) {
  const C = CLIPS[CM.clip];
  // wind-up squeezed before the hitbox, the strike held while it is out (+2 frames), then the follow-through
  const fh = Math.max(1, tl.a - 2), hold = Math.max(fh + 1, tl.b + 2), end = Math.max(hold + 2, M.dur);
  const mf = F.mf;
  let cf;
  if (charging) cf = CM.from + (CM.strike - CM.from) * 0.6;
  else if (mf <= fh) cf = CM.from + (CM.strike - CM.from) * Math.pow(mf / fh, 1.6);
  else if (mf <= hold) cf = CM.strike;
  else cf = CM.strike + (CM.to - CM.strike) * Math.min(1, (mf - hold) / (end - hold));
  // facing right, the character's left side is away from the camera: mirror the clip so the near arm strikes
  const p = clipPose(CM.clip, cf / C.fps, { loop: false, hipK, mirror: Math.sin(F.facing) > 0 });
  const k = Math.min(1, (mf + 1) / 3, (end - mf) / 5);
  return mix(base, p, Math.max(0, k));
}

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
  constructor(cfg, mixer = null) {
    this.cfg = cfg;
    this.mixer = mixer; // packed Tripo characters: their own clips are played natively (see nativeLayers)
    this.dist = 0;     // distance travelled on the ground (drives the gait phase)
    this.walkAmt = 0;  // 0 idle .. 1 moving
    this.runAmt = 0;
    this.prevState = '';
    this.stateT = 0;
  }

  build(F, M, t, dt) {
    const cfg = this.cfg, h = cfg.h;
    const st = F.state;
    if (st !== this.prevState) { this.prevState = st; this.stateT = 0; this.rolling = false; } else this.stateT += dt;
    const grounded = F.grounded && GROUND.has(st) || (st === 'move' && F.grounded);
    const speed = Math.hypot(F.vx || 0, F.vz || 0); // units per second
    const moving = grounded && (st === 'walk' || st === 'run' || (st === 'move' && M && M.pose === 'sprint'));
    this.walkAmt += ((moving ? 1 : 0) - this.walkAmt) * Math.min(1, dt * 10);
    this.runAmt += ((moving && (st === 'run' || speed > 7) ? 1 : 0) - this.runAmt) * Math.min(1, dt * 8);
    if (grounded) this.dist += speed * dt;

    // --- base: stance (+ gait) ------------------------------------------------------------------------------
    let base = stance(cfg, t, F);
    const out = { key: null, charge: 0, shake: 0, spin: 0, body: null };
    const hipK = h * 0.5; // the clips' hip motion is relative to the hip height
    if (grounded) {
      base.ik = plant(cfg);
      // the idle clip breathes and shifts the weight under the character's own guard
      if (hasClip('idle')) base = mix(base, clipPose('idle', t + (F.slot || 0) * 3.1, { hipK }), cfg.idleClip ?? 0.55);
      if (this.walkAmt > 0.02) {
        const S = (this.runAmt > 0.5 ? 0.34 : 0.2) * h * (cfg.stride || 1);
        if (hasClip('walk') && hasClip('run')) {
          // walk / run clips, their cycle driven by the distance travelled: each clip plays at its own speed when
          // the character moves at WALK_V / RUN_V metres a second (cartoon strides: faster than the capture)
          const k = h / 1.8 * (cfg.stride || 1);
          const w = clipPose('walk', this.dist / (2.4 * k), { hipK });
          const r = clipPose('run', this.dist / (5.0 * k), { hipK: hipK * 0.5 });
          const g = mix(w, r, this.runAmt);
          base = mix(base, g, Math.min(1, this.walkAmt * 1.3));
          if (this.walkAmt > 0.35) delete base.ik; else base.ik = plant(cfg);
        } else {
          const p = this.dist / (4 * S) * Math.PI * 2;
          const run = this.runAmt > 0.5;
          const g = gait(cfg, p, this.walkAmt, run, t);
          base = mix(base, g, Math.min(1, this.walkAmt * 1.2));
          base.ik = g.ik;
        }
      }
    }

    // --- state poses -----------------------------------------------------------------------------------------
    let statePose = null;
    switch (st) {
      case 'jumpsquat': statePose = STATES.jumpsquat(cfg); break;
      case 'land': statePose = STATES.land(cfg); break;
      case 'crouch': statePose = STATES.crouch(cfg, t); out.fade = 26; break;
      case 'air': {
        // rising to falling as a blend over the apex (no pose switch)
        const up = F.jumps < (cfg.airJumps || 1) && this.stateT < 0.3 ? STATES.airjump(cfg) : STATES.rise(cfg);
        statePose = mix(up, STATES.fall(cfg), Math.max(0, Math.min(1, 0.5 - (F.vy || 0) / 9)));
        break;
      }
      case 'run': if (F.skidT > 0) { statePose = STATES.skid(cfg); out.fade = 30; } break;
      case 'tumble': statePose = STATES.tumble(cfg, t); out.body = { spinX: t * 9 }; break;
      case 'helpless': statePose = STATES.helpless(cfg, t); break;
      case 'hitstun':
        statePose = STATES.hitstun(cfg, t, F);
        // a real body blow reaction on the light hits (the hard ones send the body spinning)
        if (hasClip('hit_to_body_01') && (F.launchKb || 0) < 90) statePose = mix(statePose, clipPose('hit_to_body_01', 0.1 + this.stateT * 1.6, { loop: false, hipK }), 0.75);
        if (F.launchKb > 90 && !F.grounded) out.body = { spinX: -t * 14 };
        break;
      case 'down': statePose = STATES.down(cfg); out.body = { lie: 1 }; break;
      case 'getup': case 'tech': statePose = STATES.land(cfg); break;
      case 'shield': statePose = STATES.shield(cfg); break;
      case 'dodge': {
        // a roll moves (a spot dodge stays put): curled up, one full forward turn, then back on the feet
        const rolling = Math.abs(F.vx || 0) > 1.5 || ((F.st || 0) < 4 && F.mv && F.mv.dx);
        if (rolling || (F.st > 2 && F.st < 24 && this.rolling)) {
          this.rolling = true;
          const k = Math.max(0, Math.min(1, ((F.st || 0) - 2) / 19));
          const e = k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) * (1 - k);
          statePose = k < 0.97 ? STATES.roll(cfg) : null; // back on the feet into the guard
          out.body = { spinX: e * Math.PI * 2, pivot: 0.26 };
          out.fade = 40;
        } else { this.rolling = false; statePose = STATES.dodge(cfg); }
        break;
      }
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
    if (!grounded || (st === 'dodge' && this.rolling)) delete base.ik; // a roll tucks the legs (no planted feet)
    else if (base.ik && (st === 'jumpsquat' || st === 'land' || st === 'crouch' || st === 'shield' || st === 'getup' || st === 'tech')) base.ik = plant(cfg);

    // --- moves ------------------------------------------------------------------------------------------------
    let pose = base;
    if (st === 'move' && M) {
      const ov = cfg.moves || {};
      const key = ov[F.move] ? F.move : M.pose;
      const A = ov[F.move] || ov[M.pose] || ATTACKS[M.pose];
      out.key = key;
      const CM = !ov[F.move] && !ov[M.pose] && CLIP_MOVES[M.pose];
      if (CM && hasClip(CM.clip)) {
        const tl = moveTimeline(M);
        const charging = M.charge && F.mf === M.charge.at && F.mv && F.mv.charge > 0;
        pose = clipMove(CM, F, M, tl, base, hipK, charging);
        pose = { ...pose, bones: { ...pose.bones } };
        delete pose.ik; // the clip moves the legs too (kicks, steps)
        pose.k = Math.max(pose.k || 1, F.mf <= tl.b + 2 ? 4.5 : 2);
        if (charging) { const c = F.mv.charge / M.charge.max; out.shake = 0.03 + c * 0.06; out.charge = c; }
      } else if (A) {
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
        // the coup de fesse: half a turn to present the backside, then back
        if (A.turn) {
          const fw = Math.max(1, tl.a - 2), back = tl.b + 5;
          const u = F.mf <= fw ? F.mf / fw : F.mf <= tl.b + 1 ? 1 : Math.max(0, 1 - (F.mf - tl.b - 1) / Math.max(1, back - tl.b - 1));
          out.body = { spinY: Math.PI * (u * u * (3 - 2 * u)) };
        }
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
    if (this.mixer) {
      out.layers = this.nativeLayers(F, M, t, grounded, st);
      // a character with its own pool of clips: when its clip plays a move or a whole-body state, the procedural
      // spins and lying down are not added on top (the clip already turns the body)
      if (this.ownBody) { out.body = null; out.spin = 0; }
    }
    if (st === 'move' && !out.fade) out.fade = 24; // attacks blend in fast (crisp starts)
    return out;
  }

  // which of the character's own clips play now (exactly as animated), with their weights; [] = procedural pose
  nativeLayers(F, M, t, grounded, st) {
    const X = this.mixer, h = this.cfg.h;
    const L = [];
    const own = NATIVE_STATES[F.char];
    this.ownBody = false;
    // an emote (character select, victory): the whole clip, as animated
    if (F.emote && X.has(F.emote)) { L.push({ name: F.emote, t: F.emoteT || 0, w: 1 }); return L; }
    if (st === 'move' && M) {
      const ov = this.cfg.moves || {};
      // the character's own signature clip (Uthana) first, then the shared Tripo strikes
      let CM = (NATIVE_MOVES[F.char] || {})[F.move] || NATIVE_POSES[M.pose];
      let sec = true;
      if (!CM || !X.has(CM.clip)) {
        CM = !ov[F.move] && !ov[M.pose] && CLIP_MOVES[M.pose];
        sec = false;
      }
      if (CM && own && X.has(CM.clip)) this.ownBody = true;
      if (CM) {
        const tl = moveTimeline(M);
        const charging = M.charge && F.mf === M.charge.at && F.mv && F.mv.charge > 0;
        const fh = Math.max(1, tl.a - 2), hold = Math.max(fh + 1, tl.b + 2);
        const end = CM.keys ? M.dur : Math.max(hold + 2, M.dur);
        const mf = F.mf;
        let cf;
        if (CM.keys) cf = keysAt(CM.keys, mf);
        else if (charging) cf = CM.from + (CM.strike - CM.from) * 0.6;
        else if (mf <= fh) cf = CM.from + (CM.strike - CM.from) * Math.pow(mf / fh, 1.6);
        else if (mf <= hold) cf = CM.strike;
        else cf = CM.strike + (CM.to - CM.strike) * Math.min(1, (mf - hold) / (end - hold));
        // the arm on the camera side throws it: mirrored clip when facing right
        const name = Math.sin(F.facing) > 0 && X.has(CM.clip + '__m') ? CM.clip + '__m' : CM.clip;
        const k = Math.max(0, Math.min(1, (mf + 1) / 2, (end - mf) / 4));
        L.push({ name, t: sec ? cf : cf / 30, w: k });
      }
      return L;
    }
    // the states the character plays from its own clips (NATIVE_STATES)
    if (own) {
      let key = st;
      if (st === 'air') key = 'air';
      else if (st === 'getup' && F.mv && F.mv.ledge) key = own.ledgeclimb && X.has(own.ledgeclimb.clip) ? 'ledgeclimb' : 'jumpsquat'; // climbing over the edge, not up from the floor
      else if (st === 'dodge') key = Math.abs(F.vx || 0) > 1.5 || ((F.st || 0) < 4 && F.mv && F.mv.dx) || this.rolling ? 'roll' : 'dodge';
      if (key === 'air') {
        const R = own.rise, Fa = own.fall;
        if (R && Fa && X.has(R.clip) && X.has(Fa.clip)) {
          const k = Math.max(0, Math.min(1, 0.5 + (F.vy || 0) / 9));
          L.push({ name: R.clip, t: this.stateT * (R.rate || 1), loop: true, w: k });
          L.push({ name: Fa.clip, t: this.stateT * (Fa.rate || 1), loop: true, w: 1 - k });
          return L;
        }
      }
      const d = own[key];
      if (d && X.has(d.clip)) {
        if (d.body === false) this.ownBody = true;
        L.push({ name: d.clip, t: (d.from || 0) + this.stateT * (d.rate || 1), loop: !!d.loop, w: 1 });
        return L;
      }
    }
    // the climb over a ledge (the shared clip, for those without their own)
    if ((st === 'grabbed' || st === 'held') && X.has(GRABBED.clip)) {
      L.push({ name: GRABBED.clip, t: this.stateT * GRABBED.rate, loop: true, w: 1 });
      return L;
    }
    if (st === 'getup' && F.mv && F.mv.ledge && X.has(LEDGE_CLIMB.clip)) {
      L.push({ name: LEDGE_CLIMB.clip, t: this.stateT * LEDGE_CLIMB.rate, w: 1 });
      return L;
    }
    if (st === 'hitstun' && (F.launchKb || 0) < 90) {
      const pick = ['hit_to_body_01', 'hit_to_head', 'hit_to_side', 'hit_to_stomach'][(F.lastHitTick || 0) % 4];
      if (X.has(pick)) L.push({ name: pick, t: 0.05 + this.stateT * 1.4, w: 1 });
      return L;
    }
    if (grounded && (st === 'idle' || st === 'walk' || (st === 'run' && !(F.skidT > 0)))) {
      const k = h / 1.8 * (this.cfg.stride || 1);
      const wa = Math.min(1, this.walkAmt * 1.3);
      L.push({ name: 'idle', t: t + (F.slot || 0) * 3.1, loop: true, w: 1 - wa });
      if (wa > 0) {
        L.push({ name: 'walk', t: this.dist / (2.4 * k), loop: true, w: wa * (1 - this.runAmt) });
        L.push({ name: 'run', t: this.dist / (5.0 * k), loop: true, w: wa * this.runAmt });
      }
    }
    return L;
  }
}

export { D, ROT, merge };
