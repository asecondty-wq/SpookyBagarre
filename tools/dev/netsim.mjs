// Node launcher for netsim.js: a few network conditions in a row (see netsim.js for the options)
//   ~/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe tools/dev/netsim.mjs [seconds]
globalThis.window = { addEventListener() {}, __vpads: [] }; // src/core/input.js listens to the keyboard at load
const { run } = await import('./netsim.js');
const seconds = +process.argv[2] || 40;
let ok = true;
for (const o of [
  { lagA: 15, lagB: 25, jitter: 5, loss: 0 },
  { lagA: 40, lagB: 90, jitter: 20, loss: 0.05 },
  { lagA: 80, lagB: 130, jitter: 40, loss: 0.15, stage: 'sea', chars: ['bubba', 'pandrezz', 'jsan', 'nymano'] },
  { lagA: 50, lagB: 60, jitter: 15, loss: 0.05, leaveAt: Math.round(seconds / 2), stage: 'attic', chars: ['tices', 'omfu', 'shark', 'micron'] },
  { lagA: 40, lagB: 90, jitter: 20, loss: 0.05, hostPlays: false, chars: ['epektase', 'pprod', 'aboueb', 'lolobiscotto'] },
]) {
  const r = await run({ seconds, ...o });
  ok = ok && r.ok;
}
process.exit(ok ? 0 : 1);
