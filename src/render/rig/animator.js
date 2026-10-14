// Procedural skeletal animation for the rigged fighters (Blender skeletons, see tools/blender/rig.py).
// Every frame a target pose is built (stance + state + move keyframes, all synced to the simulation frames),
// turned into local bone rotations, and each bone follows its target through a damped rotational spring:
// snappy strikes, overshoot, follow-through. Secondary bones (tails, ears, ties) lag behind on their own springs.
//
// Pose format (character space: +X = character's left, +Y up, +Z forward):
//   { bones: { name: { dir:[x,y,z] } | { rot:[x,y,z] /* degrees, delta in the parent's rest frame */ } },
//     hips: { pos:[x,y,z] /* metres */, rot:[x,y,z], scl:[x,y,z] }, jaw: 0..1, k: stiffness multiplier }
import * as THREE from 'three';

const Y = new THREE.Vector3(0, 1, 0);
const D2R = Math.PI / 180;
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
const _e = new THREE.Euler();

export class Rig {
  constructor(root, opts = {}) {
    this.root = root;
    this.bones = {};
    this.order = [];
    root.traverse((o) => { if (o.isBone) { this.bones[o.name] = o; this.order.push(o); } });
    root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    this.rest = {};
    const m = new THREE.Matrix4(), p = new THREE.Vector3(), s = new THREE.Vector3();
    for (const b of this.order) {
      m.multiplyMatrices(inv, b.matrixWorld);
      const q = new THREE.Quaternion();
      m.decompose(p, q, s);
      this.rest[b.name] = {
        world: q.clone(),               // rest orientation in model (character) space
        worldInv: q.clone().invert(),
        local: b.quaternion.clone(),
        pos: b.position.clone(),
        scl: b.scale.clone(),
        sclM: s.clone(),                 // its scale in model space (a packed Tripo skeleton is scaled ~x2)
        head: p.clone(),
        parent: b.parent && b.parent.isBone ? b.parent.name : null,
      };
      // a top bone under a turned node (the Armature of a packed Tripo model): its local rotation is relative to
      // that node, not to the model
      if (!(b.parent && b.parent.isBone) && b.parent && b.parent !== root) {
        m.multiplyMatrices(inv, b.parent.matrixWorld);
        const pq = new THREE.Quaternion();
        m.decompose(_v, pq, _v2);
        this.rest[b.name].preInv = pq.invert();
      }
    }
    // spring state per bone
    this.state = {};
    for (const b of this.order) this.state[b.name] = { q: b.quaternion.clone(), w: new THREE.Vector3() };
    this.targetLocal = {};
    this.cur = {};
    this.hips = opts.hips || 'hips';
    this.hipState = { p: new THREE.Vector3(), v: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1), sv: new THREE.Vector3() };
    this.secondary = opts.secondary || {}; // bone -> { k, c, gravity, inertia }
    this.sec = {};
    this.prevRootPos = null;
    this.rootVel = new THREE.Vector3(); this.rootAcc = new THREE.Vector3();
    this.has = (n) => !!this.bones[n];
  }

  // two-bone leg IK in character space: ankle target -> thigh/shin directions (knee bends toward `bend`)
  legIK(side, target, hipOffset, bend = [0, 0, 1]) {
    const th = this.rest['thigh.' + side], sh = this.rest['shin.' + side], ft = this.rest['foot.' + side];
    if (!th || !sh || !ft) return null;
    if (!th.L1) { th.L1 = th.head.distanceTo(sh.head); th.L2 = sh.head.distanceTo(ft.head); }
    const H = _v.copy(th.head).add(hipOffset);
    const d = _v2.set(target[0], target[1], target[2]).sub(H);
    const L1 = th.L1, L2 = th.L2;
    const dist = Math.min(Math.max(d.length(), 0.02), L1 + L2 - 1e-4);
    d.normalize();
    const ca = Math.max(-1, Math.min(1, (L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist)));
    const a = Math.acos(ca);
    const n = new THREE.Vector3(bend[0], bend[1], bend[2]);
    n.addScaledVector(d, -n.dot(d));
    if (n.lengthSq() < 1e-6) n.set(0, 0, 1);
    n.normalize();
    const thighDir = d.clone().multiplyScalar(Math.cos(a)).addScaledVector(n, Math.sin(a));
    const K = H.clone().addScaledVector(thighDir, L1);
    const shinDir = new THREE.Vector3(target[0], target[1], target[2]).sub(K).normalize();
    return { thigh: [thighDir.x, thighDir.y, thighDir.z], shin: [shinDir.x, shinDir.y, shinDir.z] };
  }

  // rest ankle position (character space) and rest foot direction, for planted feet
  ankle(side) { const f = this.rest['foot.' + side]; return f ? [f.head.x, f.head.y, f.head.z] : null; }
  footDir(side) {
    const f = this.rest['foot.' + side];
    if (!f) return null;
    if (!f.dir0) { const v = new THREE.Vector3(0, 1, 0).applyQuaternion(f.world); f.dir0 = [v.x, v.y, v.z]; }
    return f.dir0;
  }

  applyIK(pose) {
    if (!pose.ik) return;
    const off = new THREE.Vector3(...(pose.hips && pose.hips.pos ? pose.hips.pos : [0, 0, 0]));
    pose.bones = { ...(pose.bones || {}) };
    for (const [side, tgt] of Object.entries(pose.ik)) {
      if (!tgt) continue;
      if (pose.bones['thigh.' + side] && pose.bones['thigh.' + side].fk) continue; // explicit kick wins
      const base = this.ankle(side);
      if (!base) continue;
      const t = tgt === true ? base : [base[0] + (tgt[0] || 0), base[1] + (tgt[1] || 0), base[2] + (tgt[2] || 0)];
      const r = this.legIK(side, t, off, pose.bend || [side === 'L' ? 0.25 : side === 'R' ? -0.25 : 0, 0, 1]);
      if (!r) continue;
      pose.bones['thigh.' + side] = { dir: r.thigh };
      pose.bones['shin.' + side] = { dir: r.shin };
      if (tgt === true || tgt[3] === undefined) pose.bones['foot.' + side] = { dir: this.footDir(side) };
      else pose.bones['foot.' + side] = { dir: pitchV(this.footDir(side), tgt[3]) };
    }
  }

  // pose -> local target quaternions
  solve(pose) {
    this.applyIK(pose);
    const P = pose.bones || {};
    for (const b of this.order) {
      const n = b.name, R = this.rest[n];
      const pw = R.parent ? this.cur[R.parent] : null;
      const parentWorld = pw || _q3.identity();
      const spec = P[n];
      let world = this.cur[n] || (this.cur[n] = new THREE.Quaternion());
      if (spec && spec.dir) {
        // keep the rest twist, swing the bone axis onto the wanted direction
        world.multiplyQuaternions(pw ? parentWorld : _q3.identity(), this.restParentInvTimesWorld(n));
        _v.copy(Y).applyQuaternion(world);
        _v2.set(spec.dir[0], spec.dir[1], spec.dir[2]).normalize();
        _q.setFromUnitVectors(_v, _v2);
        world.premultiply(_q);
        if (spec.twist) { _q.setFromAxisAngle(_v2, spec.twist * D2R); world.premultiply(_q); }
      } else if (spec && spec.rot) {
        // W = Wparent * Rparent^-1 * delta * R
        _e.set(spec.rot[0] * D2R, spec.rot[1] * D2R, spec.rot[2] * D2R, 'YXZ');
        _q.setFromEuler(_e);
        const RpInv = R.parent ? this.rest[R.parent].worldInv : _q2.identity();
        world.copy(pw ? parentWorld : _q3.identity()).multiply(RpInv).multiply(_q).multiply(R.world);
      } else {
        world.multiplyQuaternions(pw ? parentWorld : _q3.identity(), this.restParentInvTimesWorld(n));
      }
      // local = parentWorld^-1 * world
      const tl = this.targetLocal[n] || (this.targetLocal[n] = new THREE.Quaternion());
      if (pw) { _q.copy(parentWorld).invert(); tl.multiplyQuaternions(_q, world); }
      else if (R.preInv) tl.multiplyQuaternions(R.preInv, world);
      else tl.copy(world);
    }
  }

  restParentInvTimesWorld(n) {
    const R = this.rest[n];
    if (!R._pl) {
      R._pl = R.parent ? this.rest[R.parent].worldInv.clone().multiply(R.world) : R.world.clone();
    }
    return R._pl;
  }

  // follow the targets with damped springs; stiffness k (1/s^2-ish), damping ratio z
  // clip: optional { q: {bone: Quaternion}, p: {bone: Vector3}, w } from nativeClips.ClipMixer: the clips own the
  // bones they animate by w (1 = played exactly), the springs go on from there
  update(pose, dt, rootPos, clip) {
    this.solve(pose);
    const kmul = pose.k || 1;
    if (rootPos) {
      if (this.prevRootPos) {
        _v.copy(rootPos).sub(this.prevRootPos).divideScalar(Math.max(1e-3, dt));
        this.rootAcc.copy(_v).sub(this.rootVel).divideScalar(Math.max(1e-3, dt));
        this.rootVel.copy(_v);
      } else this.prevRootPos = new THREE.Vector3();
      this.prevRootPos.copy(rootPos);
    }
    const sub = Math.max(2, Math.ceil(dt * 120));
    const h = dt / sub;
    for (const b of this.order) {
      const n = b.name;
      const S = this.state[n], T = this.targetLocal[n];
      const sec = this.secondary[n];
      let k = (sec ? sec.k : 520) * (sec ? 1 : kmul), z = sec ? sec.z : 0.62;
      if (pose.stiff && pose.stiff[n]) k *= pose.stiff[n];
      const c = 2 * Math.sqrt(k) * z;
      for (let i = 0; i < sub; i++) {
        // error rotation T * S^-1 as an axis-angle vector
        _q.copy(S.q).invert().premultiply(T);
        if (_q.w < 0) { _q.x = -_q.x; _q.y = -_q.y; _q.z = -_q.z; _q.w = -_q.w; }
        const sinHalf = Math.sqrt(_q.x * _q.x + _q.y * _q.y + _q.z * _q.z);
        const ang = 2 * Math.atan2(sinHalf, _q.w);
        if (sinHalf > 1e-6) _v.set(_q.x / sinHalf, _q.y / sinHalf, _q.z / sinHalf).multiplyScalar(ang); else _v.set(0, 0, 0);
        // inertia for secondary bones: the root's acceleration pushes them back
        if (sec && sec.inertia) {
          _v2.copy(this.rootAcc).multiplyScalar(-sec.inertia * 0.0006);
          // convert into a rotation tendency around the axis perpendicular to the bone (approximate in local space)
          _v.x += _v2.z; _v.z -= _v2.x;
        }
        S.w.addScaledVector(_v, k * h).multiplyScalar(Math.max(0, 1 - c * h));
        const wl = S.w.length();
        if (wl > 1e-7) { _q2.setFromAxisAngle(_v.copy(S.w).divideScalar(wl), wl * h); S.q.premultiply(_q2).normalize(); }
      }
      const cq = clip && clip.w > 0 ? clip.q[n] : null;
      if (cq) { S.q.slerp(cq, clip.w); S.w.multiplyScalar(1 - clip.w); }
      b.quaternion.copy(S.q);
    }
    // hips offset & squash (spring on position and scale)
    const hb = this.bones[this.hips];
    if (hb) {
      const R = this.rest[this.hips], H = this.hipState, hp = pose.hips || {};
      const tp = _v.set(...(hp.pos || [0, 0, 0]));
      const kp = 380 * kmul, cp = 2 * Math.sqrt(kp) * 0.6;
      H.v.addScaledVector(_v2.copy(tp).sub(H.p), kp * dt).multiplyScalar(Math.max(0, 1 - cp * dt));
      H.p.addScaledVector(H.v, dt);
      const ts = _v2.set(...(hp.scl || [1, 1, 1]));
      const ks = 300, cs = 2 * Math.sqrt(ks) * 0.35;
      H.sv.addScaledVector(_v.copy(ts).sub(H.s), ks * dt).multiplyScalar(Math.max(0, 1 - cs * dt));
      H.s.addScaledVector(H.sv, dt);
      // the offset is in model metres: into the parent's local frame, its rotation and its scale (without the scale,
      // the Tripo skeletons, scaled about x2, crouched, landed and shielded twice as low as the others)
      _v.copy(H.p).applyQuaternion(R.parent ? this.rest[R.parent].worldInv : _q.identity());
      if (R.parent) _v.divide(this.rest[R.parent].sclM);
      hb.position.copy(R.pos).add(_v);
      const clipHip = clip && clip.w > 0 ? clip.p[this.hips] : null;
      if (clipHip) hb.position.lerp(clipHip, clip.w);
    }
    this.squash = this.hipState.s; // the view scales the whole model about the feet
  }

  // kick the hips spring (landing squash, hit recoil)
  impulse(sy = 0, dz = 0) { this.hipState.sv.y += sy; this.hipState.sv.x -= sy * 0.5; this.hipState.sv.z -= sy * 0.5; this.hipState.v.z += dz; }

  // instantly copy the targets (after a teleport / respawn)
  snap() { for (const b of this.order) { const S = this.state[b.name]; const T = this.targetLocal[b.name]; if (T) S.q.copy(T); S.w.set(0, 0, 0); b.quaternion.copy(S.q); } }
}

// --- pose helpers ----------------------------------------------------------------------------------------------
function pitchV(d, a) { const c = Math.cos(a * D2R), s2 = Math.sin(a * D2R); return [d[0], d[1] * c - d[2] * s2, d[1] * s2 + d[2] * c]; }
export const mirrorDir = (d) => [-d[0], d[1], d[2]];
export const mirrorRot = (r) => [r[0], -r[1], -r[2]];
export const norm = (d) => { const l = Math.hypot(d[0], d[1], d[2]) || 1; return [d[0] / l, d[1] / l, d[2] / l]; };

// rotate a direction around the X axis (pitch) by a degrees
export function pitch(d, a) { const c = Math.cos(a * D2R), s = Math.sin(a * D2R); return [d[0], d[1] * c - d[2] * s, d[1] * s + d[2] * c]; }
export function yaw(d, a) { const c = Math.cos(a * D2R), s = Math.sin(a * D2R); return [d[0] * c + d[2] * s, d[1], -d[0] * s + d[2] * c]; }
export function roll(d, a) { const c = Math.cos(a * D2R), s = Math.sin(a * D2R); return [d[0] * c - d[1] * s, d[0] * s + d[1] * c, d[2]]; }

// mix two partial poses (b over a by t)
export function mix(a, b, t) {
  if (t <= 0) return a;
  if (t >= 1 && !a) return b;
  const out = { bones: { ...(a.bones || {}) }, hips: a.hips ? { ...a.hips } : undefined, jaw: a.jaw || 0, k: a.k, stiff: a.stiff };
  for (const [n, sb] of Object.entries(b.bones || {})) {
    const sa = out.bones[n];
    if (!sa) { out.bones[n] = t >= 1 ? sb : blendSpec(null, sb, t); continue; }
    out.bones[n] = blendSpec(sa, sb, t);
  }
  if (b.hips) {
    const ha = out.hips || {};
    out.hips = {
      pos: lerp3(ha.pos || [0, 0, 0], b.hips.pos || ha.pos || [0, 0, 0], t),
      scl: lerp3(ha.scl || [1, 1, 1], b.hips.scl || ha.scl || [1, 1, 1], t),
    };
  }
  if (b.jaw !== undefined) out.jaw = (out.jaw || 0) * (1 - t) + b.jaw * t;
  if (b.k) out.k = (a.k || 1) * (1 - t) + b.k * t;
  if (b.stiff) out.stiff = { ...(a.stiff || {}), ...b.stiff };
  if (a.ik || b.ik) {
    out.ik = { ...(a.ik || {}) };
    for (const [k, v] of Object.entries(b.ik || {})) {
      const av = out.ik[k];
      if (v === false || t >= 1 || !av) out.ik[k] = t >= 0.5 || !av ? v : av;
      else out.ik[k] = lerpIK(av, v, t);
    }
  }
  if (b.bend) out.bend = b.bend;
  return out;
}

function lerpIK(a, b, t) {
  const A = a === true ? [0, 0, 0, 0] : a, B = b === true ? [0, 0, 0, 0] : b;
  return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t, (A[3] || 0) + ((B[3] || 0) - (A[3] || 0)) * t];
}
function lerp3(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

function blendSpec(a, b, t) {
  if (!a) return b;
  if (a.dir && b.dir) return { dir: norm(lerp3(a.dir, b.dir, t)), twist: (a.twist || 0) * (1 - t) + (b.twist || 0) * t };
  if (a.rot && b.rot) return { rot: lerp3(a.rot, b.rot, t) };
  return t < 0.5 ? a : b;
}

export const ease = {
  out: (t) => 1 - (1 - t) * (1 - t),
  in: (t) => t * t,
  inout: (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)),
  snap: (t) => 1 - Math.pow(1 - t, 4),
};

// keyframe track: keys [{ f, pose, e }] (frames of the move), returns the pose at frame f
export function sample(keys, f) {
  if (!keys.length) return null;
  if (f <= keys[0].f) return keys[0].pose;
  for (let i = 0; i < keys.length - 1; i++) {
    const A = keys[i], B = keys[i + 1];
    if (f >= A.f && f <= B.f) {
      const t = B.f > A.f ? (f - A.f) / (B.f - A.f) : 1;
      return mix(A.pose, B.pose, (ease[B.e] || ease.inout)(t));
    }
  }
  return keys[keys.length - 1].pose;
}
