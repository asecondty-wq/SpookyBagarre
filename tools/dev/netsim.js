// Online matches between virtual machines, headless (Node: tools/dev/netsim.mjs, or the browser console):
//   const N = await import('/tools/dev/netsim.js'); await N.run({ lagA: 40, lagB: 90, jitter: 20, loss: 0.05 })
// A host and two guests run RollbackCore over a fake network (one-way lag per guest, jitter, lost packets on the
// fast channel, reliable messages kept in order). Each machine has its own screen rate. Optionally a guest leaves
// in the middle (the CPU takes over its fighter). At the end, a reference world replays the match with the final
// inputs: every frame each machine confirmed must have the reference's exact fingerprint.
import { World } from '../../src/sim/world.js';
import { RollbackCore, RING } from '../../src/net/rollback.js';
import { hashSaved, saveState } from '../../src/sim/state.js';

function lcg(seed) { let s = (seed >>> 0) || 1; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; }

// a scripted human, sampled every screen frame of its machine
function scriptedPad(seed) {
  const rnd = lcg(seed);
  let mx = 0, my = 0, hold = 0, holdBtn = 0;
  const cnt = [0, 0, 0, 0, 0, 0];
  return () => {
    if (rnd() < 0.06) {
      const k = rnd();
      if (k < 0.3) { mx = 0; my = 0; } else if (k < 0.75) { mx = rnd() < 0.5 ? -1 : 1; my = 0; }
      else { mx = Math.round((rnd() * 2 - 1) * 1000) / 1000 || 0; my = Math.round((rnd() * 2 - 1) * 1000) / 1000 || 0; }
    }
    let held = 0;
    if (hold > 0) { hold--; held |= holdBtn; }
    if (rnd() < 0.07) { const i = [0, 0, 1, 1, 2, 2, 3, 5][Math.floor(rnd() * 8)]; cnt[i]++; held |= 1 << i; if (rnd() < 0.3) { hold = 5 + Math.floor(rnd() * 30); holdBtn = 1 << i; } }
    return [mx, my, held, ...cnt];
  };
}

export async function run({
  seconds = 60, lagA = 40, lagB = 90, jitter = 20, loss = 0.05, leaveAt = 0, delay = 2,
  stage = 'cemetery', chars = ['frog', 'tung', 'catlady', 'pika'], seed = 1, hzA = 60, hzB = 144, log = console.log,
} = {}) {
  const rnd = lcg(seed * 977);
  const cfg = { stage, seed: seed * 4242, rules: { mode: 'stock', stocks: 3, time: 180, hazards: true }, roster: chars.map((c, i) => ({ char: c, slot: i, bot: i === 3 ? 3 : 0 })) };
  let t = 0;
  const queue = [];
  const linkLag = { A: lagA, B: lagB };
  const lastRel = {};
  const gone = new Set();
  const stats = { sent: 0, lost: 0, bytes: 0 };
  // deliver a message from one machine to another, like PeerJS would (JSON on the wire)
  const post = (from, to, msg, fast) => {
    if (gone.has(from) || gone.has(to)) return;
    const json = JSON.stringify(msg);
    stats.sent++; stats.bytes += json.length;
    if (fast && rnd() < loss) { stats.lost++; return; }
    const lag = linkLag[from === 'H' ? to : from];
    let at = t + lag + rnd() * jitter;
    if (!fast) { const k = from + to; at = Math.max(at, lastRel[k] || 0); lastRel[k] = at; }
    queue.push({ at, to, from, json });
  };
  const peers = {};
  const mk = (id, isHost, localSlots) => {
    const send = (msg, o = {}) => {
      if (!isHost) return post(id, 'H', msg, o.fast);
      if (o.to) return post(id, o.to, msg, o.fast);
      for (const p of ['A', 'B']) if (p !== o.except) post(id, p, msg, o.fast);
    };
    return new RollbackCore({ cfg, isHost, localSlots, humanSlots: [0, 1, 2], owners: { 1: 'A', 2: 'B' }, send, now: () => t, delay });
  };
  peers.H = { core: mk('H', true, [0]), pad: { 0: scriptedPad(seed * 3 + 1) }, hz: 60, next: 0, hashes: [], done: 0, events: 0 };
  peers.A = { core: mk('A', false, [1]), pad: { 1: scriptedPad(seed * 3 + 2) }, hz: hzA, next: 3, hashes: [], done: 0, events: 0 };
  peers.B = { core: mk('B', false, [2]), pad: { 2: scriptedPad(seed * 3 + 3) }, hz: hzB, next: 7, hashes: [], done: 0, events: 0 };
  const end = seconds * 1000;
  let left = false;
  while (t < end) {
    t += 1;
    queue.sort((a, b) => a.at - b.at);
    while (queue.length && queue[0].at <= t) { const q = queue.shift(); if (!gone.has(q.to)) peers[q.to].core.receive(JSON.parse(q.json), q.from); }
    if (leaveAt && !left && t >= leaveAt * 1000) { left = true; gone.add('B'); }
    if (left && !peers.H.botDone && t >= leaveAt * 1000 + 500) { peers.H.botDone = true; peers.H.core.makeBot(2, 2); }
    for (const id of ['H', 'A', 'B']) {
      const P = peers[id];
      if (gone.has(id) || t < P.next) continue;
      const dt = (1000 / P.hz) * (0.9 + rnd() * 0.2);
      P.next = t + dt;
      let sample = {};
      for (const s in P.pad) sample[s] = P.pad[s]();
      P.core.update(dt / 1000, () => sample);
      P.events += P.core.drainEvents().length;
      // fingerprints of the frames this machine now considers final
      const c = P.core.confirmed();
      while (P.done < c) { P.done++; if (P.core.frame - P.done < RING - 1) P.hashes[P.done] = hashSaved(P.core.saved[P.done % RING]); }
    }
    if (t % 2000 === 0) await new Promise((r) => setTimeout(r, 0));
  }
  // reference: the match replayed with the host's final inputs
  const H = peers.H.core;
  const R = new World(cfg);
  const last = Math.min(...['H', 'A', 'B'].filter((id) => !gone.has(id)).map((id) => peers[id].done));
  let bad = null, refEvents = 0;
  for (let k = 1; k <= Math.max(last, peers.B.done); k++) {
    const samples = {};
    for (const s of [0, 1, 2]) { const a = H.inp[s][k]; if (!a) { bad = bad || `entrée manquante chez l'hôte : joueur ${s}, image ${k}`; break; } samples[s] = { mx: a[0], my: a[1], held: a[2], cnt: a.slice(3, 9), bot: a[9] }; }
    if (bad) break;
    R.advance(samples);
    refEvents += R.events.length;
    const h = hashSaved(saveState(R));
    for (const id of ['H', 'A', 'B']) {
      const ph = peers[id].hashes[k];
      if (ph !== undefined && ph !== h && !bad) bad = `${id} diffère à l'image ${k}`;
    }
  }
  const row = (id) => { const P = peers[id], S = P.core.stats; return `${id} : ${P.done} images confirmées (${P.core.frame} jouées), ${S.rollbacks} retours (max ${S.maxDepth} images), ${S.resim} recalculées, ${S.stalls} attentes, ${S.resyncs} resynchros, ${P.events} effets${id !== 'H' ? `, ping ${Math.round(P.core.rtt)} ms, avance ${P.core.lead.toFixed(1)}` : `, ${S.desyncs} écarts détectés`}`; };
  log(`lag A ${lagA} ms, B ${lagB} ms, gigue ${jitter} ms, pertes ${Math.round(loss * 100)} %${leaveAt ? ', B part à ' + leaveAt + ' s' : ''}`);
  for (const id of ['H', 'A', 'B']) log('  ' + row(id));
  log(`  réseau : ${stats.sent} messages, ${stats.lost} perdus, ${Math.round(stats.bytes / seconds / 1024)} Ko/s au total ; référence : ${refEvents} effets`);
  log(bad ? '  ÉCART : ' + bad : '  identique à la référence sur toutes les images confirmées');
  return { ok: !bad && peers.H.core.stats.desyncs === 0, peers, bad };
}
