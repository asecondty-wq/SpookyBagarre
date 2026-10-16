// A tier list from CPU duels (Node, several processes at once):
//   ~/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe tools/dev/tierlist.mjs [duels per pair] [seed]
// Every pair of fighters plays `duels` 1 v 1 matches (3 stocks, CPU level 3, sides swapped every match, the arenas in
// turn, no hazards, no mini-games; past 4 minutes: more stocks, then less damage wins). Prints each fighter's win
// rate, its best and worst matchups, and the tiers (S to D: how far its win rate is from the average, in standard
// deviations). A CPU's tier list: it tells which kits pay off in the bots' hands, not what a human makes of them.
import { fork } from 'node:child_process';
import { cpus } from 'node:os';
import { fileURLToPath } from 'node:url';

const [duels = 24, seed = 1] = process.argv.slice(2).map(Number);
globalThis.window = { addEventListener() {}, __vpads: [] };
const { World } = await import('../../src/sim/world.js');
const { CHAR_ORDER, CHARS } = await import('../../src/sim/chars/index.js');
const { STAGE_ORDER } = await import('../../src/sim/stages/index.js');
const pairs = [];
for (let i = 0; i < CHAR_ORDER.length; i++) for (let j = i + 1; j < CHAR_ORDER.length; j++) pairs.push([CHAR_ORDER[i], CHAR_ORDER[j]]);
const MAX_T = 180 + 240 * 60;

function duel(a, b, k) {
  const W = new World({ stage: STAGE_ORDER[k % STAGE_ORDER.length], roster: [{ char: a, slot: 0, bot: 3 }, { char: b, slot: 1, bot: 3 }], rules: { mode: 'stock', stocks: 3, hazards: false, minigames: false }, seed: seed * 100000 + k });
  for (let t = 0; t < MAX_T && W.phase !== 'over' && W.phase !== 'end'; t++) W.step({});
  const [A, B] = W.fighters;
  if (W.winner === 0 || W.winner === 1) return W.winner;
  if (A.stocks !== B.stocks) return A.stocks > B.stocks ? 0 : 1;
  return A.damage <= B.damage ? 0 : 1;
}

if (process.env.TIER_WORKER !== undefined) {
  const w = +process.env.TIER_WORKER, n = +process.env.TIER_N, res = [];
  pairs.forEach(([a, b], p) => {
    if (p % n !== w) return;
    let wa = 0;
    for (let k = 0; k < duels; k++) {
      const swap = k % 2 === 1;
      const win = swap ? duel(b, a, p * 1000 + k) : duel(a, b, p * 1000 + k);
      if ((win === 0) !== swap) wa++;
    }
    res.push([a, b, wa, duels]);
  });
  process.send(res);
  process.exit(0);
}

const N = Math.max(1, Math.min(pairs.length, cpus().length - 2));
const t0 = Date.now();
const all = (await Promise.all([...Array(N).keys()].map((w) => new Promise((ok, ko) => {
  const c = fork(fileURLToPath(import.meta.url), process.argv.slice(2), { env: { ...process.env, TIER_WORKER: String(w), TIER_N: String(N) } });
  c.on('message', ok); c.on('error', ko);
})))).flat();
const st = {}, mu = {};
for (const id of CHAR_ORDER) { st[id] = { w: 0, g: 0 }; mu[id] = {}; }
for (const [a, b, wa, g] of all) {
  st[a].w += wa; st[a].g += g; st[b].w += g - wa; st[b].g += g;
  mu[a][b] = wa / g; mu[b][a] = 1 - wa / g;
}
const rows = CHAR_ORDER.map((id) => ({ id, rate: st[id].w / st[id].g })).sort((x, y) => y.rate - x.rate);
const mean = rows.reduce((s, r) => s + r.rate, 0) / rows.length;
const sd = Math.sqrt(rows.reduce((s, r) => s + (r.rate - mean) ** 2, 0) / rows.length) || 1;
const tier = (r) => { const z = (r - mean) / sd; return z >= 1.2 ? 'S' : z >= 0.4 ? 'A' : z >= -0.4 ? 'B' : z >= -1.2 ? 'C' : 'D'; };
const name = (id) => CHARS[id].name;
console.log(`${all.reduce((s, x) => s + x[3], 0)} duels (${duels} par paire), ${N} processus, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
for (const r of rows) {
  const m = Object.entries(mu[r.id]).sort((x, y) => y[1] - x[1]);
  console.log(`${tier(r.rate)}  ${name(r.id).padEnd(14)} ${(r.rate * 100).toFixed(1).padStart(5)} %   meilleur : ${name(m[0][0])} ${(m[0][1] * 100).toFixed(0)} %   pire : ${name(m[m.length - 1][0])} ${(m[m.length - 1][1] * 100).toFixed(0)} %`);
}
console.log(JSON.stringify({ rows: rows.map((r) => [r.id, +r.rate.toFixed(4), tier(r.rate)]), mu }));
