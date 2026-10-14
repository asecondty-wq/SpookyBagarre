// Rollback / determinism check, headless (browser console or Node: tools/dev/rollbackcheck.mjs).
//   const R = await import('/tools/dev/rollbackcheck.js'); await R.run({ games: 2, frames: 2400 })
// For each match: a reference world plays straight; a second world plays the same match the way a rollback client
// does: one player's inputs arrive 1 to 8 frames late, so it guesses them (the last known input), and when the real
// ones arrive it goes back (loadState) and replays. Every confirmed frame must have the reference's exact fingerprint.
// A third world replays the first match at the very end: same inputs, same seed, same fingerprints (nothing leaks
// from one match to the next). Players 0 and 1 are scripted "humans", 2 and 3 are CPUs.
import { World } from '../../src/sim/world.js';
import { CHAR_ORDER } from '../../src/sim/chars/index.js';
import { STAGES } from '../../src/sim/stages/index.js';
import { saveState, loadState, hashSaved, diffSaved } from '../../src/sim/state.js';

function lcg(seed) { let s = (seed >>> 0) || 1; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; }

// a scripted human: the stick goes somewhere and stays a while, buttons get tapped or held
function scriptInputs(seed, frames) {
  const rnd = lcg(seed), out = new Array(frames + 1);
  let mx = 0, my = 0, held = 0, hold = 0, holdBtn = 0;
  const cnt = [0, 0, 0, 0, 0, 0];
  for (let f = 0; f <= frames; f++) {
    if (rnd() < 0.08) {
      const k = rnd();
      if (k < 0.3) { mx = 0; my = 0; } else if (k < 0.75) { mx = rnd() < 0.5 ? -1 : 1; my = 0; }
      else { mx = Math.round((rnd() * 2 - 1) * 1000) / 1000; my = Math.round((rnd() * 2 - 1) * 1000) / 1000; }
    }
    held = 0;
    if (hold > 0) { hold--; held |= holdBtn; }
    if (rnd() < 0.09) { const i = [0, 0, 1, 1, 2, 2, 3, 5][Math.floor(rnd() * 8)]; cnt[i]++; held |= 1 << i; if (rnd() < 0.3) { hold = 5 + Math.floor(rnd() * 30); holdBtn = 1 << i; } }
    out[f] = { mx, my, held, cnt: cnt.slice() };
  }
  return out;
}

function makeWorld(g) {
  const pick = [0, 1, 2, 3].map((i) => CHAR_ORDER[(g.base + i * 5) % CHAR_ORDER.length]);
  return new World({
    stage: g.stage, seed: g.seed,
    roster: pick.map((c, i) => ({ char: c, slot: i, bot: i >= 2 ? 3 : 0 })),
    rules: { mode: g.mode, stocks: 3, time: 120, hazards: true },
  });
}

const samplesAt = (g, f) => ({ 0: g.inputs[0][f], 1: g.inputs[1][f] });

// one match: returns { frames, rollbacks, resim, error? }
function checkMatch(g, frames, rnd) {
  const R = makeWorld(g), T = makeWorld(g);
  const refHash = [hashSaved(saveState(R))];
  const ref = new Map(); // a few recent reference states, to name the first difference
  const saved = [saveState(T)]; // T's state after each frame
  const used = []; // the input T used for player 1 at each frame (guessed or real)
  let known = 0; // player 1's inputs are known up to this frame
  let rollbacks = 0, resim = 0;
  const lagAt = (f) => 1 + Math.floor(4 + 3.5 * Math.sin(f * 0.05) + rnd() * 1.5); // 1..8 frames, varying
  for (let f = 1; f <= frames; f++) {
    R.advance(samplesAt(g, f));
    const rs = saveState(R);
    refHash[f] = hashSaved(rs);
    ref.set(f, rs); ref.delete(f - 40);
    // inputs of player 1 arriving now
    const nowKnown = Math.max(known, f - Math.min(8, lagAt(f)));
    let wrongFrom = 0;
    for (let k = known + 1; k <= nowKnown && k < f; k++) {
      const a = used[k], b = g.inputs[1][k];
      if (!wrongFrom && (a.mx !== b.mx || a.my !== b.my || a.held !== b.held || a.cnt.join() !== b.cnt.join())) wrongFrom = k;
    }
    known = nowKnown;
    const guess = (k) => (k <= known ? g.inputs[1][k] : g.inputs[1][known]);
    if (wrongFrom) {
      rollbacks++;
      loadState(T, saved[wrongFrom - 1]);
      for (let k = wrongFrom; k < f; k++) {
        used[k] = guess(k);
        T.advance({ 0: g.inputs[0][k], 1: used[k] });
        saved[k] = saveState(T); resim++;
      }
    }
    used[f] = guess(f);
    T.advance({ 0: g.inputs[0][f], 1: used[f] });
    saved[f] = saveState(T);
    // every frame up to `known` is final: it must match the reference
    for (let k = Math.max(1, known - 8); k <= known; k++) {
      if (hashSaved(saved[k]) !== refHash[k]) {
        const where = ref.has(k) ? diffSaved(ref.get(k), saved[k]) : '(état de référence trop ancien)';
        return { frames: f, rollbacks, resim, error: `image ${k} : ${where}` };
      }
    }
    if (f > 60) saved[f - 60] = null;
    if (R.phase === 'over') return { frames: f, rollbacks, resim, hashes: refHash };
  }
  return { frames, rollbacks, resim, hashes: refHash };
}

function replayHashes(g, frames) {
  const W = makeWorld(g), out = [hashSaved(saveState(W))];
  for (let f = 1; f <= frames; f++) { W.advance(samplesAt(g, f)); out[f] = hashSaved(saveState(W)); if (W.phase === 'over') break; }
  return out;
}

export async function run({ games = 2, frames = 2400, stages = Object.keys(STAGES), seed = 1, log = console.log } = {}) {
  const rnd = lcg(seed * 7919);
  const report = [];
  let first = null, firstRes = null, bad = 0;
  const t0 = Date.now();
  let gi = 0;
  for (const stage of stages) {
    for (let n = 0; n < games; n++, gi++) {
      const g = { stage, base: gi, seed: seed * 1000 + gi, mode: n % 2 ? 'time' : 'stock', inputs: [scriptInputs(seed * 31 + gi * 2, frames), scriptInputs(seed * 31 + gi * 2 + 1, frames)] };
      let res;
      try { res = checkMatch(g, frames, rnd); } catch (e) { res = { frames: 0, rollbacks: 0, resim: 0, error: 'plantage : ' + (e && e.stack || e) }; }
      if (!first) { first = g; firstRes = res; }
      if (res.error) bad++;
      const chars = [0, 1, 2, 3].map((i) => CHAR_ORDER[(g.base + i * 5) % CHAR_ORDER.length]).join(',');
      report.push({ stage, chars, frames: res.frames, rollbacks: res.rollbacks, resim: res.resim, ok: !res.error, error: res.error || '' });
      log(`${res.error ? 'ÉCART' : 'ok   '} ${stage.padEnd(9)} ${chars.padEnd(36)} ${String(res.frames).padStart(5)} images, ${res.rollbacks} retours, ${res.resim} images recalculées${res.error ? '\n      ' + res.error : ''}`);
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  // same first match again, after all the others: identical fingerprints?
  if (first && firstRes.hashes) {
    const again = replayHashes(first, firstRes.frames);
    const k = again.findIndex((h, i) => h !== firstRes.hashes[i]);
    if (k >= 0) { bad++; log(`ÉCART en rejouant le premier match : image ${k}`); } else log('ok    premier match rejoué à l\'identique');
  }
  log(`${bad ? bad + ' problème(s)' : 'tout est identique'} en ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  return { ok: bad === 0, report };
}
