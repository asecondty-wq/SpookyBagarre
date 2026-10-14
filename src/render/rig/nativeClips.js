// The clips stored in a packed Tripo model (tools/art/tripo_pack.py): sampled bone by bone, exactly as animated
// (no direction conversion, no springs), and mixed in layers with cross-fades. RigModel blends the result over the
// procedural pose (the special moves, the jumps, the reactions the clips do not cover).
import * as THREE from 'three';

// glTF node names lose their dots in three.js ("upperarm.L" -> "upperarmL"): put them back
export const fixName = (n) => n.replace(/^(shoulder|upperarm|forearm|hand|thigh|shin|foot|ear)([LRB])$/, '$1.$2');

const LOOPS = new Set(['idle', 'walk', 'run', 'crouch']);

export function buildClips(animations) {
  const clips = {};
  for (const a of animations || []) {
    const tracks = [];
    let t0 = Infinity, t1 = 0;
    for (const tr of a.tracks) {
      const dot = tr.name.lastIndexOf('.');
      const node = fixName(tr.name.slice(0, dot)), prop = tr.name.slice(dot + 1);
      if (prop !== 'quaternion' && prop !== 'position') continue;
      tracks.push({ bone: node, prop, times: tr.times, values: tr.values });
      t0 = Math.min(t0, tr.times[0]); t1 = Math.max(t1, tr.times[tr.times.length - 1]);
    }
    // the looping clips (walk, run, idle) must end where they start: some captures drift up (or aside) through the
    // cycle and then snap back, a sawtooth that makes the character climb and drop while it runs. Remove that trend.
    if (LOOPS.has(a.name) && t1 > t0) for (const tr of tracks) {
      if (tr.prop !== 'position') continue;
      const T = tr.times, V = tr.values = Float32Array.from(tr.values), n = T.length, e = (n - 1) * 3;
      const d = [V[e] - V[0], V[e + 1] - V[1], V[e + 2] - V[2]];
      for (let i = 0; i < n; i++) { const f = (T[i] - t0) / (t1 - t0); for (let k = 0; k < 3; k++) V[i * 3 + k] -= d[k] * f; }
    }
    clips[a.name] = { tracks, t0, t1 };
  }
  return clips;
}

const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();

// local pose of a clip at time t (seconds, in the clip's own time base): writes into pose.q[bone] / pose.p[bone]
function sampleClip(C, t, loop, pose) {
  const len = C.t1 - C.t0;
  if (loop && len > 0) t = C.t0 + (((t - C.t0) % len) + len) % len;
  else t = Math.max(C.t0, Math.min(C.t1, t));
  for (const tr of C.tracks) {
    const T = tr.times, V = tr.values, n = T.length;
    let i = 0;
    // binary search for the key before t
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (T[m] <= t) lo = m; else hi = m; }
    i = lo;
    const i2 = Math.min(n - 1, i + 1);
    const k = T[i2] > T[i] ? Math.max(0, Math.min(1, (t - T[i]) / (T[i2] - T[i]))) : 0;
    if (tr.prop === 'quaternion') {
      _qa.fromArray(V, i * 4); _qb.fromArray(V, i2 * 4);
      const q = pose.q[tr.bone] || (pose.q[tr.bone] = new THREE.Quaternion());
      q.copy(_qa).slerp(_qb, k);
    } else {
      const p = pose.p[tr.bone] || (pose.p[tr.bone] = new THREE.Vector3());
      p.set(V[i * 3] + (V[i2 * 3] - V[i * 3]) * k, V[i * 3 + 1] + (V[i2 * 3 + 1] - V[i * 3 + 1]) * k, V[i * 3 + 2] + (V[i2 * 3 + 2] - V[i * 3 + 2]) * k);
    }
  }
}

// layers: [{ name, t, loop, w }] -> one blended local pose { q, p, w } (w = how much the clips own the body)
export class ClipMixer {
  constructor(clips) {
    this.clips = clips;
    this.weights = {};   // smoothed weight of each clip name (cross-fades)
    this.times = {};     // last time asked for each clip (a fading-out clip keeps its last frame)
    this.loops = {};
    this.tmp = { q: {}, p: {} };
    this.out = { q: {}, p: {}, w: 0 };
  }

  has(name) { return !!this.clips[name]; }

  update(layers, dt, fade = 14) {
    const want = {};
    for (const L of layers) if (this.clips[L.name]) { want[L.name] = (want[L.name] || 0) + L.w; this.times[L.name] = L.t; this.loops[L.name] = !!L.loop; }
    const k = 1 - Math.exp(-dt * fade);
    for (const n of new Set([...Object.keys(this.weights), ...Object.keys(want)])) {
      const w = (this.weights[n] || 0) + ((want[n] || 0) - (this.weights[n] || 0)) * k;
      if (w < 0.002 && !want[n]) delete this.weights[n]; else this.weights[n] = w;
    }
    // blend: running normalised slerp over the active clips
    const out = this.out;
    let acc = 0;
    for (const [n, w] of Object.entries(this.weights)) {
      if (w <= 0) continue;
      sampleClip(this.clips[n], this.times[n] ?? 0, this.loops[n], this.tmp);
      const f = acc === 0 ? 1 : w / (acc + w);
      for (const [b, q] of Object.entries(this.tmp.q)) {
        const o = out.q[b] || (out.q[b] = new THREE.Quaternion());
        if (acc === 0) o.copy(q); else o.slerp(q, f);
      }
      for (const [b, p] of Object.entries(this.tmp.p)) {
        const o = out.p[b] || (out.p[b] = new THREE.Vector3());
        if (acc === 0) o.copy(p); else o.lerp(p, f);
      }
      acc += w;
    }
    out.w = Math.min(1, acc);
    return out;
  }
}
