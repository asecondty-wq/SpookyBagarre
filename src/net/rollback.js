// Rollback netcode (GGPO style), without any display: every machine runs the whole match itself and the players
// only exchange their inputs, relayed by the host (the network is a star around it).
//
// - A local input is played `delay` frames later (it has that long to reach the others before it is needed).
// - A remote player's input that has not arrived yet is guessed (their last known input). When the real one comes
//   and differs, the world goes back to the frame before it (saved states) and replays up to now, in a fraction of
//   a millisecond. Nobody can be guessed more than MAX_PREDICT frames ahead: then the game waits for them.
// - Each input message repeats the last REDUNDANCY frames: it travels on the fast (unreliable) channel and a lost
//   packet does not matter. When a player's inputs stay missing, they are asked again on the reliable channel.
// - The guests keep their clock on the host's (pings); every CHECK_EVERY frames each guest sends the fingerprint of
//   a final frame, and if it differs from the host's the host sends its whole state (it should never happen: the
//   simulation is deterministic, see tools/dev/rollbackcheck.js).
// - Sounds and effects of a replayed frame are not played twice (events already played are skipped).
import { World } from '../sim/world.js';
import { DT } from '../sim/constants.js';
import { saveState, loadState, hashSaved } from '../sim/state.js';

export const DEFAULT_DELAY = 2;
export const MAX_PREDICT = 8;
const REDUNDANCY = 10;
export const RING = 128;
const CHECK_EVERY = 60;
const PING_EVERY = 15;
const CHUNK = 16000;
const FRAME_MS = DT * 1000;

// an input on the wire: [mx, my, held, cnt0..cnt5, bot?]
const NEUTRAL = [0, 0, 0, 0, 0, 0, 0, 0, 0];
function sameInput(a, b) {
  if (a === b) return true;
  for (let i = 0; i < 10; i++) if (a[i] !== b[i]) return false;
  return true;
}
const toSample = (a) => ({ mx: a[0], my: a[1], held: a[2], cnt: a.slice(3, 9), bot: a[9] });
export const encodeInput = (s) => [s.mx || 0, s.my || 0, s.held, ...s.cnt]; // -0 would become 0 on the wire
// a run of frames on the wire: an input equal to the one before is written 0 (most frames repeat the last one)
const pack = (list) => list.map((a, i) => (i > 0 && sameInput(a, list[i - 1]) ? 0 : a));
const unpack = (list) => { const out = []; for (let i = 0; i < list.length; i++) out.push(list[i] === 0 ? out[i - 1] : list[i]); return out; };

// a whole saved state as text (resync): JSON, keeping the numbers JSON cannot write (-0, Infinity, NaN)
export function encodeState(S) {
  return JSON.stringify(S, (k, v) => (typeof v === 'number' && (!Number.isFinite(v) || Object.is(v, -0)) ? { $n: Object.is(v, -0) ? '-0' : String(v) } : v));
}
export function decodeState(str) {
  return JSON.parse(str, (k, v) => (v && typeof v === 'object' && typeof v.$n === 'string' ? (v.$n === '-0' ? -0 : Number(v.$n)) : v));
}

export class RollbackCore {
  // cfg: World config; localSlots: players on this machine; humanSlots: every human player of the match;
  // owners (host): slot -> peer id of its guest; send(msg, { fast, to, except }); now(): milliseconds
  constructor({ cfg, isHost, localSlots, humanSlots, owners = {}, send, now, delay = DEFAULT_DELAY }) {
    this.W = new World(cfg);
    this.isHost = !!isHost;
    this.local = new Set(localSlots);
    this.remote = humanSlots.filter((s) => !this.local.has(s));
    this.owners = { ...owners };
    this.send = send;
    this.now = now || (() => performance.now());
    this.delay = delay;
    this.inp = {}; this.known = {}; this.maxRecv = {};
    for (const s of humanSlots) {
      this.inp[s] = [];
      for (let k = 0; k <= delay; k++) this.inp[s][k] = NEUTRAL; // the first frames are the same for everybody
      this.known[s] = this.maxRecv[s] = delay;
    }
    this.frame = 0;
    this.saved = new Array(RING);
    this.saved[0] = saveState(this.W);
    this.used = new Array(RING);
    this.rollFrom = Infinity;
    this.events = [];
    this.played = new Map();
    this.acc = 0;
    this.lead = 0; this.rtt = 0;
    this.bots = new Map(); // slot -> CPU level: the host plays for a player who left
    this.checks = new Map(); // host: frame -> { h, s }
    this.pending = []; // host: guests' fingerprints waiting for the host's own
    this.lastCheck = 0;
    this.stallT = 0; this.lastResend = 0; this.lastNeed = 0; this.lastOut = null;
    this.changed = false;
    this.stats = { rollbacks: 0, resim: 0, maxDepth: 0, stalls: 0, desyncs: 0, resyncs: 0 };
  }

  // ---- inputs ---------------------------------------------------------------------------------------------------
  // a player's input at frame k: the real one, or the guess (the last one known before it)
  inputAt(s, k) {
    const a = this.inp[s];
    if (a[k]) return a[k];
    for (let j = Math.min(k, this.maxRecv[s]); j > this.known[s]; j--) if (a[j]) return a[j];
    return a[this.known[s]];
  }

  minKnown() {
    let m = Infinity;
    for (const s of this.remote) if (this.known[s] < m) m = this.known[s];
    return m;
  }

  // every frame up to this one has all its real inputs (final on every machine)
  confirmed() { return Math.min(this.frame, this.minKnown()); }

  addInputs(s, f0, list) {
    const a = this.inp[s];
    if (!a || this.local.has(s)) return;
    for (let i = 0; i < list.length; i++) {
      const k = f0 + i;
      if (a[k] || k <= this.known[s]) continue;
      a[k] = list[i];
      if (k > this.maxRecv[s]) this.maxRecv[s] = k;
      if (k <= this.frame) {
        const u = this.used[k % RING];
        if (!u || !u[s] || !sameInput(u[s], list[i])) { if (k < this.rollFrom) this.rollFrom = k; }
      }
    }
    while (a[this.known[s] + 1]) this.known[s]++;
  }

  // ---- messages -------------------------------------------------------------------------------------------------
  receive(m, from) {
    if (!m || !m.t) return;
    switch (m.t) {
      case 'ri':
        for (const e of m.l || []) {
          if (this.isHost && this.owners[e[0]] !== from) continue; // a guest only speaks for its own players
          if (Array.isArray(e[2]) && e[2][0]) this.addInputs(e[0], e[1], unpack(e[2]));
        }
        if (this.isHost) this.send(m, { fast: true, except: from });
        break;
      case 'rp': if (this.isHost) this.send({ t: 'rq', c: m.c, hf: this.frame }, { fast: true, to: from }); break;
      case 'rq': {
        const rtt = Math.max(0, this.now() - m.c);
        this.rtt = this.rtt ? this.rtt * 0.8 + rtt * 0.2 : rtt;
        const lead = m.hf + rtt / 2 / FRAME_MS - this.frame;
        this.lead = this.leadSet ? this.lead * 0.7 + lead * 0.3 : lead;
        this.leadSet = true;
        break;
      }
      case 'rneed': {
        // inputs that went missing: sent again on the reliable channel (the host asks the owner if it lacks them)
        const a = this.inp[m.s];
        if (!a) break;
        const list = [];
        for (let k = m.f; a[k] && list.length < 120; k++) list.push(a[k]);
        if (list.length) this.send({ t: 'ri', l: [[m.s, m.f, pack(list)]] }, { to: from });
        else if (this.isHost && this.owners[m.s] && this.owners[m.s] !== from) this.send({ t: 'rneed', s: m.s, f: m.f }, { to: this.owners[m.s] });
        break;
      }
      case 'rh': if (this.isHost) { this.pending.push({ f: m.f, h: m.h, from }); this.checkPending(); } break;
      case 'rsync': this.onSync(m); break;
      default: break;
    }
  }

  // ---- simulation -----------------------------------------------------------------------------------------------
  step(resim) {
    const k = ++this.frame;
    const samples = {}, used = {};
    for (const s in this.inp) { const a = this.inputAt(s, k); used[s] = a; samples[s] = toSample(a); }
    this.used[k % RING] = used;
    this.W.advance(samples);
    this.saved[k % RING] = saveState(this.W);
    if (this.W.events.length) {
      const seen = {};
      for (const ev of this.W.events) {
        let key = ev.type + '|' + ev.tick + '|' + (ev.s ?? '') + '|' + (ev.a ?? '') + '|' + (ev.id ?? '') + '|' + (ev.m ?? '') + '|' + (ev.k ?? '') + '|' + (ev.n ?? '');
        seen[key] = (seen[key] || 0) + 1;
        key += '#' + seen[key];
        if (this.played.has(key)) continue; // already played before the rollback
        this.played.set(key, k);
        this.events.push(ev);
      }
    }
    if (resim) this.stats.resim++;
  }

  // a real input differed from the guess: back to the frame before it, then replay up to now
  replay() {
    if (this.rollFrom > this.frame) { this.rollFrom = Infinity; return; }
    const from = this.rollFrom;
    this.rollFrom = Infinity;
    if (this.frame - from + 1 >= RING - 1) return; // cannot happen (MAX_PREDICT), but never load a lost state
    loadState(this.W, this.saved[(from - 1) % RING]);
    const end = this.frame;
    this.stats.rollbacks++;
    this.stats.maxDepth = Math.max(this.stats.maxDepth, end - from + 1);
    this.frame = from - 1;
    while (this.frame < end) this.step(true);
    this.changed = true;
  }

  canAdvance() {
    if (this.hold) return false;
    return this.frame + 1 <= this.minKnown() + MAX_PREDICT;
  }

  // one frame of the match; local: { slot: wire input } sampled now (played `delay` frames later)
  tick(local) {
    this.replay();
    const now = this.now();
    if (!this.canAdvance()) {
      if (!this.stallT) { this.stallT = now; this.stats.stalls++; }
      // waiting for someone: our last inputs again (they may be waiting for us), then ask for theirs
      if (this.lastOut && now - this.lastResend > 100) { this.lastResend = now; this.send(this.lastOut, { fast: true }); }
      if (now - this.stallT > 250 && now - this.lastNeed > 250) {
        this.lastNeed = now;
        const f = this.frame + 1 - MAX_PREDICT;
        for (const s of this.remote) if (this.known[s] < f) this.send({ t: 'rneed', s: +s, f: this.known[s] + 1 }, this.isHost ? { to: this.owners[s] } : {});
      }
      return false;
    }
    this.stallT = 0;
    const f = this.frame + 1 + this.delay;
    const out = [];
    for (const s of this.local) {
      const a = this.inp[s];
      if (this.bots.has(s)) { const p = a[f - 1] || NEUTRAL; a[f] = [0, 0, 0, ...p.slice(3, 9), this.bots.get(s)]; }
      else a[f] = (local && local[s]) || a[f - 1] || NEUTRAL;
      const f0 = Math.max(1, f - REDUNDANCY + 1);
      out.push([s, f0, pack(a.slice(f0, f + 1))]);
    }
    if (out.length) { this.lastOut = { t: 'ri', l: out }; this.send(this.lastOut, { fast: true }); }
    this.step(false);
    this.changed = true;
    if (!this.isHost && this.frame % PING_EVERY === 0) this.send({ t: 'rp', c: now }, { fast: true });
    this.checkpoints();
    if (this.frame % 120 === 0) for (const [key, k] of this.played) if (k < this.frame - RING) this.played.delete(key);
    return true;
  }

  // pace the frames on real time; returns how many were played
  update(dt, sampleLocal) {
    this.replay();
    this.acc += Math.min(dt, 0.1) * this.rate();
    let n = 0;
    while (this.acc >= DT && n < 5) {
      if (!this.tick(sampleLocal ? sampleLocal() : null)) { this.acc = Math.min(this.acc, DT); break; }
      this.acc -= DT; n++;
    }
    return n;
  }

  // a guest runs a little faster or slower to stay on the host's clock
  rate() {
    if (this.isHost || !this.leadSet) return 1;
    const l = this.lead;
    if (Math.abs(l) < 0.5) return 1;
    return 1 + Math.max(-0.3, Math.min(1, l * 0.1));
  }

  // how far between two steps the picture is (display interpolation)
  alpha() { return Math.max(0, Math.min(1, this.W.slowAcc + (this.acc / DT) * this.W.timeScale)); }

  waitingFor() { return this.stallT ? (this.now() - this.stallT) / 1000 : 0; }

  drainEvents() { const e = this.events; this.events = []; return e; }

  // ---- the host plays for a player who left (from the frame after their last input, on every machine) ------------
  makeBot(s, level = 2) {
    if (!this.isHost || !this.inp[s] || this.local.has(s)) return;
    const a = this.inp[s];
    const last = a[this.known[s]] || NEUTRAL;
    const f0 = this.known[s] + 1, list = [];
    for (let k = f0; k <= this.frame + this.delay; k++) list.push(a[k] && k <= this.maxRecv[s] ? a[k] : [0, 0, 0, ...last.slice(3, 9), level]);
    this.addInputs(s, f0, list);
    this.remote = this.remote.filter((x) => x !== s);
    this.local.add(s);
    this.bots.set(s, level);
    this.owners[s] = null;
    this.send({ t: 'ri', l: [[s, f0, pack(list)]] }, {});
  }

  // ---- fingerprints and resync --------------------------------------------------------------------------------------
  checkpoints() {
    const c = this.confirmed();
    while (this.lastCheck + CHECK_EVERY <= c) {
      const k = (this.lastCheck += CHECK_EVERY);
      if (this.frame - k >= RING - 1) continue;
      const S = this.saved[k % RING], h = hashSaved(S);
      if (this.isHost) {
        this.checks.set(k, { h, s: S });
        for (const old of this.checks.keys()) if (old < k - CHECK_EVERY * 6) this.checks.delete(old);
        this.checkPending();
      } else this.send({ t: 'rh', f: k, h }, {});
    }
  }

  checkPending() {
    this.pending = this.pending.filter((p) => {
      const mine = this.checks.get(p.f);
      if (!mine) return p.f > this.lastCheck - CHECK_EVERY * 6; // not there yet (or too old: forget it)
      if (mine.h !== p.h) {
        this.stats.desyncs++;
        if (this.onDesync) this.onDesync(p.from, p.f);
        const str = encodeState(mine.s), n = Math.ceil(str.length / CHUNK);
        for (let i = 0; i < n; i++) this.send({ t: 'rsync', f: p.f, i, n, p: str.slice(i * CHUNK, (i + 1) * CHUNK) }, { to: p.from });
      }
      return false;
    });
  }

  onSync(m) {
    if (!this.sync || this.sync.f !== m.f) this.sync = { f: m.f, parts: [], got: 0 };
    if (this.sync.parts[m.i] === undefined) { this.sync.parts[m.i] = m.p; this.sync.got++; }
    if (this.sync.got < m.n) return;
    const S = decodeState(this.sync.parts.join(''));
    this.sync = null;
    if (m.f > this.frame || this.frame - m.f >= RING - 1) return;
    loadState(this.W, S);
    this.saved[m.f % RING] = saveState(this.W);
    this.W.frame = m.f;
    // replay from the host's state up to now (rollFrom - 1 is the frame just restored)
    const end = this.frame;
    this.frame = m.f;
    while (this.frame < end) this.step(true);
    this.stats.resyncs++;
    this.changed = true;
  }
}
