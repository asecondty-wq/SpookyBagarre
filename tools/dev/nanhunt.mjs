// Finds the first NaN (or Infinity) in the simulation state of a rollbackcheck match: the source of a desync whose
// fingerprints differ while diffSaved sees no difference (two NaN are "equal" to it, not to the hash).
//   node tools/dev/nanhunt.mjs [seed] [game] [frames]
globalThis.window = { addEventListener() {}, __vpads: [] };
const { World } = await import('../../src/sim/world.js');
const { CHAR_ORDER } = await import('../../src/sim/chars/index.js');
const { STAGES } = await import('../../src/sim/stages/index.js');
const { saveState } = await import('../../src/sim/state.js');

const [seed = 1, gi = 0, frames = 2400] = process.argv.slice(2).map(Number);
function lcg(s0) { let s = (s0 >>> 0) || 1; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; }
// the same scripted humans as rollbackcheck.js
function scriptInputs(sd, n) {
  const rnd = lcg(sd), out = new Array(n + 1);
  let mx = 0, my = 0, held = 0, hold = 0, holdBtn = 0;
  const cnt = [0, 0, 0, 0, 0, 0];
  for (let f = 0; f <= n; f++) {
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
const stages = Object.keys(STAGES);
const stage = stages[Math.floor(gi / 2) % stages.length];
const n = gi % 2;
const inputs = [scriptInputs(seed * 31 + gi * 2, frames), scriptInputs(seed * 31 + gi * 2 + 1, frames)];
const pick = [0, 1, 2, 3].map((i) => CHAR_ORDER[(gi + i * 5) % CHAR_ORDER.length]);
const W = new World({ stage, seed: seed * 1000 + gi, roster: pick.map((c, i) => ({ char: c, slot: i, bot: i >= 2 ? 3 : 0 })), rules: { mode: n ? 'time' : 'stock', stocks: 3, time: 120, hazards: true } });
const bad = (v, path, out) => {
  if (typeof v === 'number') { if (!Number.isFinite(v)) out.push(path + ' = ' + v); return; }
  if (v && typeof v === 'object') for (const k of Object.keys(v)) bad(v[k], path + '.' + k, out);
};
console.log(stage, pick.join(','));
for (let f = 1; f <= frames; f++) {
  W.advance({ 0: inputs[0][f], 1: inputs[1][f] });
  const out = [];
  bad(saveState(W), 'S', out);
  if (out.length) {
    console.log('frame', f, out.slice(0, 8).join('\n  '));
    for (const F of W.list) console.log('  ', F.slot, F.char, F.state, F.move, F.mf, F.x, F.y, F.vx, F.vy, F.kx, F.ky);
    process.exit(1);
  }
  if (W.phase === 'over') break;
}
console.log('no NaN');
