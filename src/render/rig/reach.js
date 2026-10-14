// Reach: while a move's hitbox is out, the limb (or the weapon) that throws it is stretched toward it, so the blow
// looks as long as it hits. After the clip and the springs (the bones only, the spring state is untouched):
//   - the effector: the hand, the foot or the held weapon's tip nearest to the hitbox (or the one asked per move);
//   - a two-bone IK (upper arm / forearm, thigh / shin) puts it in the hitbox, toward its far side, the elbow or
//     knee bending in the plane it already bends in;
//   - out of reach: the spine and chest lean toward the hitbox first.
// cfg.reach (rig settings of the character): { moves: { <move>: effector | true }, weapon: socket name, far: 0..1 }
//   effector: 'hand.R' | 'hand.L' | 'foot.R' | 'foot.L' | 'weapon'; true = the nearest one.
import * as THREE from 'three';
import { moveTimeline } from '../poses.js';

const CHAINS = {
  'hand.R': ['upperarm.R', 'forearm.R', 'hand.R'], 'hand.L': ['upperarm.L', 'forearm.L', 'hand.L'],
  'foot.R': ['thigh.R', 'shin.R', 'foot.R'], 'foot.L': ['thigh.L', 'shin.L', 'foot.L'],
};
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _e = new THREE.Vector3(), _t = new THREE.Vector3();
const _u = new THREE.Vector3(), _v = new THREE.Vector3(), _n = new THREE.Vector3(), _w = new THREE.Vector3();
const _q = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _qw = new THREE.Quaternion(), _id = new THREE.Quaternion();

// turn a bone so that, seen from `pivot`, the point `from` goes toward `to` (world space), by weight w
function swing(bone, pivot, from, to, w) {
  _u.subVectors(from, pivot).normalize();
  _v.subVectors(to, pivot).normalize();
  if (_u.lengthSq() < 1e-8 || _v.lengthSq() < 1e-8) return;
  _q.setFromUnitVectors(_u, _v);
  if (w < 1) _q.slerpQuaternions(_id, _q, w);
  bone.getWorldQuaternion(_qw);
  _qw.premultiply(_q);
  bone.parent.getWorldQuaternion(_qp);
  bone.quaternion.copy(_qp.invert().multiply(_qw));
  bone.updateMatrixWorld(true);
}

// weight of the stretch along the move: in over the frames before the hitbox, held while it is out, then let go
function weightAt(M, mf) {
  const tl = moveTimeline(M);
  if (mf < tl.a - 4 || mf > tl.b + 7) return 0;
  if (mf < tl.a) return (mf - (tl.a - 4)) / 4;
  if (mf <= tl.b + 1) return 1;
  return 1 - (mf - tl.b - 1) / 6;
}

// every character without its own settings: the normals that go forward, back and down, the nearest limb throws them
// (not the head and backside blows of the shared kit: those are thrown by the body)
export const DEFAULT_REACH = {
  far: 0.85,
  moves: { jab1: true, jab2: true, jab3: true, ftilt: true, ftilt2: true, ftilt3: true, dtilt: true, fair: true, bair: true, dair: true, ledgeattack: true },
};
const BODY_BLOWS = new Set(['buttbump', 'headbutt', 'headbuttUp']);
const LUNGE = 0.5;

export function applyReach(RM, F, M) {
  const R = RM.cfg.reach || DEFAULT_REACH;
  if (!M || F.state !== 'move' || !M.hits || !M.hits.length) return;
  const want = R.moves && R.moves[F.move];
  if (!want || (want === true && BODY_BLOWS.has(M.pose))) return;
  const w = weightAt(M, F.mf);
  if (w <= 0) return;
  const B = RM.rig.bones;
  // the hitbox that reaches farthest, among those out now (or the first ones to come)
  const tl = moveTimeline(M);
  const f = Math.max(tl.a, Math.min(tl.b, F.mf));
  let h = null;
  for (const x of M.hits) if (f >= x.f[0] && f <= x.f[1] && (!h || Math.abs(x.at[2]) + x.r > Math.abs(h.at[2]) + h.r)) h = x;
  if (!h) return;
  RM.pivot.updateWorldMatrix(true, true);
  // in the model's space: +X its left, +Z forward (the sim's at[0] is to its right); toward the far side of the hitbox
  const far = R.far ?? 0.45;
  const len = Math.hypot(h.at[0], h.at[1] - 1.0, h.at[2]) || 1;
  _t.set(-h.at[0], h.at[1], h.at[2]);
  _t.x += (-h.at[0] / len) * h.r * far; _t.y += ((h.at[1] - 1.0) / len) * h.r * far; _t.z += (h.at[2] / len) * h.r * far;
  RM.scene.localToWorld(_t);
  // the effector
  const weaponObj = R.weapon && RM.sockets[R.weapon] && RM.sockets[R.weapon].obj;
  const tipOf = (out) => {
    // the weapon's far end: the point of its box farthest from the hand holding it
    const hb = B[R.weaponHand || 'hand.R'];
    hb.getWorldPosition(_w);
    const box = new THREE.Box3().setFromObject(weaponObj);
    let best = -1;
    for (let i = 0; i < 8; i++) {
      _v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
      const d = _v.distanceToSquared(_w);
      if (d > best) { best = d; out.copy(_v); }
    }
    // a corner of the box is off the guitar: pull it back toward the middle of the far end
    out.lerp(box.getCenter(_v), 0.3);
    return out;
  };
  let eff = want === true ? null : want;
  if (eff === 'weapon' && !(weaponObj && weaponObj.visible)) eff = R.weaponHand || 'hand.R';
  // the nearest limb, chosen once per move (it must not switch from one limb to another during the blow)
  if (!eff && RM._reach && RM._reach.seq === F.mseq && RM._reach.move === F.move) eff = RM._reach.eff;
  if (!eff) {
    let bd = Infinity;
    for (const k of Object.keys(CHAINS)) {
      if (!B[CHAINS[k][2]]) continue;
      const d = B[CHAINS[k][2]].getWorldPosition(_e).distanceTo(_t);
      if (d < bd) { bd = d; eff = k; }
    }
    if (weaponObj && weaponObj.visible && tipOf(_e).distanceTo(_t) < bd) eff = 'weapon';
    RM._reach = { seq: F.mseq, move: F.move, eff };
  }
  const chain = CHAINS[eff === 'weapon' ? (R.weaponHand || 'hand.R') : eff];
  if (!chain || !B[chain[0]] || !B[chain[1]] || !B[chain[2]]) return;
  const [ua, la, en] = chain.map((n) => B[n]);
  // out of reach: the whole body steps into the blow (up to LUNGE metres, toward the hitbox), a look only (the
  // fighter does not move in the sim)
  {
    ua.getWorldPosition(_a); la.getWorldPosition(_b);
    if (eff === 'weapon') tipOf(_e); else en.getWorldPosition(_e);
    const L = _a.distanceTo(_b) + _b.distanceTo(_e);
    const over = _a.distanceTo(_t) - L * 0.97;
    if (over > 0) {
      const local = RM.scene.worldToLocal(_w.copy(_t));
      RM.pivot.position.z = Math.sign(local.z || 1) * Math.min(R.lunge ?? LUNGE, over) * w;
      RM.pivot.updateWorldMatrix(true, true);
    }
  }
  if (eff === 'weapon') { reachWeapon(RM, ua, la, en, tipOf, w); return; }
  const end = (out) => en.getWorldPosition(out);
  ua.getWorldPosition(_a); la.getWorldPosition(_b); end(_e);
  const L1 = _a.distanceTo(_b), L2 = _b.distanceTo(_e), reach = (L1 + L2) * 0.985;
  // out of reach: lean the spine and chest toward it (up to ~28 degrees together)
  const dist = _a.distanceTo(_t);
  if (dist > reach && eff !== 'foot.R' && eff !== 'foot.L') {
    const k = Math.min(1, (dist - reach) / 0.6) * w * 0.5;
    for (const n of ['spine', 'chest']) {
      const sb = B[n];
      if (!sb) continue;
      sb.getWorldPosition(_w);
      swing(sb, _w, _a, _t, k * 0.35);
      ua.getWorldPosition(_a);
    }
    la.getWorldPosition(_b); end(_e);
  }
  // the two-bone solve: where the elbow / knee goes, then the lower bone onto the target
  _u.subVectors(_t, _a);
  const d = Math.min(Math.max(_u.length(), 1e-3), reach);
  _u.normalize();
  const goal = _w.copy(_a).addScaledVector(_u, d);
  // the bend plane: the one the limb bends in now (else a default: elbows down and back, knees forward)
  _n.subVectors(_b, _a).cross(_v.subVectors(_e, _b));
  if (_n.lengthSq() < 1e-6) _n.set(1, 0, 0).applyQuaternion(RM.scene.getWorldQuaternion(_q));
  _n.normalize();
  _v.crossVectors(_n, _u).normalize();
  if (_v.dot(_e.subVectors(_b, _a)) < 0) _v.negate(); // the elbow / knee stays on the side it is on
  end(_e);
  const ca = Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d)));
  const ang = Math.acos(ca);
  const elbow = new THREE.Vector3().copy(_a).addScaledVector(_u, L1 * Math.cos(ang)).addScaledVector(_v, L1 * Math.sin(ang));
  swing(ua, _a, _b, elbow, w);
  la.getWorldPosition(_b); end(_e);
  swing(la, _b, _e, goal, w);
}

// a weapon: arm and weapon lined up from the shoulder toward the hitbox (the longest reach), the tip in it if it can
// get there; the hand turned so the weapon points at it
const _h = new THREE.Vector3(), _tip = new THREE.Vector3(), _s = new THREE.Vector3(), _gt = new THREE.Vector3();
function reachWeapon(RM, ua, la, hand, tipOf, w) {
  const B = RM.rig.bones;
  ua.getWorldPosition(_s); la.getWorldPosition(_b); hand.getWorldPosition(_h); tipOf(_tip);
  _gt.copy(_t);
  const L1 = _s.distanceTo(_b), L2 = _b.distanceTo(_h), G = _h.distanceTo(_tip);
  const arm = (L1 + L2) * 0.97;
  // out of reach even lined up: lean toward it
  if (_s.distanceTo(_gt) > arm + G) {
    const k = Math.min(1, (_s.distanceTo(_gt) - arm - G) / 0.6) * w * 0.5;
    for (const n of ['spine', 'chest']) {
      const sb = B[n];
      if (!sb) continue;
      sb.getWorldPosition(_w);
      swing(sb, _w, _s, _gt, k * 0.35);
      ua.getWorldPosition(_s);
    }
    la.getWorldPosition(_b); hand.getWorldPosition(_h);
  }
  _u.subVectors(_gt, _s);
  const dist = _u.length();
  _u.normalize();
  // where the hand goes: the tip on the target, or as far as the arm goes
  const hd = Math.min(arm, Math.max(0.25, dist - G));
  const goal = _w.copy(_s).addScaledVector(_u, hd);
  // elbow: in the plane the arm bends in now
  _n.subVectors(_b, _s).cross(_v.subVectors(_h, _b));
  if (_n.lengthSq() < 1e-6) _n.set(1, 0, 0).applyQuaternion(RM.scene.getWorldQuaternion(_q));
  _n.normalize();
  _v.crossVectors(_n, _u).normalize();
  if (_v.dot(_e.subVectors(_b, _s)) < 0) _v.negate();
  const ca = Math.max(-1, Math.min(1, (L1 * L1 + hd * hd - L2 * L2) / (2 * L1 * hd)));
  const ang = Math.acos(ca);
  const elbow = new THREE.Vector3().copy(_s).addScaledVector(_u, L1 * Math.cos(ang)).addScaledVector(_v, L1 * Math.sin(ang));
  const g2 = goal.clone();
  swing(ua, _s, _b, elbow, w);
  la.getWorldPosition(_b); hand.getWorldPosition(_h);
  swing(la, _b, _h, g2, w);
  // the weapon along the same line
  hand.getWorldPosition(_h); tipOf(_tip);
  _e.copy(_h).addScaledVector(_u, G);
  swing(hand, _h, _tip, _e, w);
}
