// Exact save / restore of a World (rollback netcode) and a fingerprint of its state (desync checks).
// Unlike the network snapshot (world.js, rounded, for display), a saved state is the whole simulation, bit for bit:
// restoring it then stepping with the same inputs gives exactly the same match.
//
// The simulation state is plain data (fighters, entities, stage surfaces and vars, bot memory); the only objects
// shared between two places are stage surfaces (a fighter on a ledge keeps its surface) and fighters, which are
// saved as references ({ $s: index } / { $f: slot }) and point back to the live objects once restored.

// world fields that change during a match (the rest is set once by the constructor)
const WORLD_KEYS = ['tick', 'frame', 'slowAcc', 'lastCnt', 'evSeq', 'entSeq', 'pendingHits', 'camYaw', 'phase', 'phaseT',
  'freeze', 'slowT', 'slowK', 'realTime', 'timeLeft', 'winner', 'placements', 'botMem', 'entities', 'mg', 'mgBag', 'mgLast', 'mgClock', 'zoomCd'];

function refTable(W) {
  const refs = new Map();
  W.stage.surfaces.forEach((s, i) => refs.set(s, { $s: i }));
  for (const F of W.list) refs.set(F, { $f: F.slot });
  return refs;
}

function save(v, refs) {
  if (v === null || typeof v !== 'object') return v;
  const r = refs.get(v);
  if (r) return r;
  if (Array.isArray(v)) {
    const out = new Array(v.length);
    for (let i = 0; i < v.length; i++) out[i] = save(v[i], refs);
    return out;
  }
  if (v instanceof Map) {
    const out = [];
    for (const [k, x] of v) out.push([k, save(x, refs)]);
    return { $map: out };
  }
  const out = {};
  for (const k in v) out[k] = save(v[k], refs);
  return out;
}

function load(v, W) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) {
    const out = new Array(v.length);
    for (let i = 0; i < v.length; i++) out[i] = load(v[i], W);
    return out;
  }
  if (v.$s !== undefined) return W.stage.surfaces[v.$s];
  if (v.$f !== undefined) return W.fighters[v.$f];
  if (v.$map) return new Map(v.$map.map(([k, x]) => [k, load(x, W)]));
  const out = {};
  for (const k in v) out[k] = load(v[k], W);
  return out;
}

// restore an object that other code holds on to (fighters, surfaces): same object, same key order
function loadInto(obj, data, W) {
  const have = Object.keys(obj), want = Object.keys(data);
  let same = have.length === want.length;
  for (let i = 0; same && i < want.length; i++) same = have[i] === want[i];
  if (!same) for (const k of have) delete obj[k];
  for (const k of want) obj[k] = load(data[k], W);
}

export function saveState(W) {
  const refs = refTable(W);
  const S = { rng: W.rng.state(), hitLog: [...W.hitLog], fighters: [], surfaces: [], stageT: W.stage.t, stageVars: save(W.stage.vars, refs) };
  for (const k of WORLD_KEYS) S[k] = save(W[k], refs);
  for (const F of W.list) {
    refs.delete(F); S.fighters.push(save(F, refs)); refs.set(F, { $f: F.slot });
  }
  for (const s of W.stage.surfaces) {
    const r = refs.get(s); refs.delete(s); S.surfaces.push(save(s, refs)); refs.set(s, r);
  }
  return S;
}

export function loadState(W, S) {
  // fighters and surfaces first: the other fields may point at them
  S.fighters.forEach((d) => loadInto(W.fighters[d.slot], d, W));
  S.surfaces.forEach((d, i) => loadInto(W.stage.surfaces[i], d, W));
  for (const k of WORLD_KEYS) W[k] = load(S[k], W);
  W.rng.setState(S.rng);
  W.hitLog = new Map(S.hitLog);
  W.stage.t = S.stageT;
  W.stage.vars = load(S.stageVars, W);
  W.events = [];
}

// --- fingerprint -----------------------------------------------------------------------------------------------
// 32-bit FNV-1a over every value (numbers by their exact bits, object keys sorted so the key order never matters)
const F64 = new Float64Array(1);
const U32 = new Uint32Array(F64.buffer);

function hashValue(h, v) {
  switch (typeof v) {
    case 'number':
      F64[0] = v;
      h = Math.imul(h ^ U32[0], 16777619);
      return Math.imul(h ^ U32[1], 16777619);
    case 'string':
      h = Math.imul(h ^ 0x73, 16777619);
      for (let i = 0; i < v.length; i++) h = Math.imul(h ^ v.charCodeAt(i), 16777619);
      return Math.imul(h ^ v.length, 16777619);
    case 'boolean': return Math.imul(h ^ (v ? 0x74 : 0x66), 16777619);
    case 'undefined': return Math.imul(h ^ 0x75, 16777619);
    case 'function': return Math.imul(h ^ 0x46, 16777619);
    default:
      if (v === null) return Math.imul(h ^ 0x6e, 16777619);
      if (Array.isArray(v)) {
        h = Math.imul(h ^ 0x5b, 16777619);
        for (let i = 0; i < v.length; i++) h = hashValue(h, v[i]);
        return Math.imul(h ^ 0x5d, 16777619);
      }
      h = Math.imul(h ^ 0x7b, 16777619);
      for (const k of Object.keys(v).sort()) {
        if (v[k] === undefined) continue; // a missing key and an undefined one are the same state
        h = hashValue(h, k); h = hashValue(h, v[k]);
      }
      return Math.imul(h ^ 0x7d, 16777619);
  }
}

export function hashSaved(S) { return hashValue(0x811c9dc5, S) >>> 0; }
export function hashState(W) { return hashSaved(saveState(W)); }

// first difference between two saved states (debugging a desync): "fighters.2.vx: 3.25 / 3.2500000001"
export function diffSaved(a, b, path = '') {
  if (typeof a !== typeof b || (a === null) !== (b === null) || Array.isArray(a) !== Array.isArray(b)) return `${path}: ${short(a)} / ${short(b)}`;
  if (a === null || typeof a !== 'object') return Object.is(a, b) || (a !== a && b !== b) ? null : `${path}: ${short(a)} / ${short(b)}`;
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  for (const k of keys) {
    if (a[k] === undefined && b[k] === undefined) continue;
    const d = diffSaved(a[k], b[k], path ? path + '.' + k : k);
    if (d) return d;
  }
  return null;
}
const short = (v) => { const s = typeof v === 'object' ? JSON.stringify(v) : String(v); return s && s.length > 80 ? s.slice(0, 80) + '…' : s; };
