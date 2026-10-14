// Node launcher for rollbackcheck.js (Python is not in the PATH, Node neither: use the one shipped with Codex)
//   ~/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe tools/dev/rollbackcheck.mjs [games] [frames] [seed]
globalThis.window = { addEventListener() {}, __vpads: [] }; // src/core/input.js listens to the keyboard at load
const { run } = await import('./rollbackcheck.js');
const [games, frames, seed] = process.argv.slice(2).map(Number);
const r = await run({ games: games || 2, frames: frames || 2400, seed: seed || 1 });
process.exit(r.ok ? 0 : 1);
