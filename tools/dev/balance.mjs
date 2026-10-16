// Node launcher for the balance runs (the same CPU free-for-alls as balance.js, without the browser):
//   ~/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe tools/dev/balance.mjs [matches] [seed] [secs]
// Prints, per character: KOs minus falls per match (the reference measure, CLAUDE.md), wins, damage dealt and taken;
// then the specials and smashes that pay the most and the least.
globalThis.window = { addEventListener() {}, __vpads: [] }; // src/core/input.js listens to the keyboard at load
const { World } = await import('../../src/sim/world.js');
const { CHAR_ORDER } = await import('../../src/sim/chars/index.js');

const [matches = 200, seed = 1, secs = 90] = process.argv.slice(2).map(Number);
const ch = {}, mv = {};
const C = (c) => ch[c] || (ch[c] = { char: c, games: 0, wins: 0, dealt: 0, taken: 0, kos: 0, falls: 0 });
const M = (c, m) => { const k = c + ':' + m; return mv[k] || (mv[k] = { char: c, move: m, uses: 0, hits: 0, dmg: 0, kos: 0 }); };
let rs = seed;
const rnd = () => ((rs = (rs * 16807) % 2147483647) / 2147483647);
const t0 = Date.now();
for (let g = 0; g < matches; g++) {
  const pick = [];
  while (pick.length < 4) { const c = CHAR_ORDER[Math.floor(rnd() * CHAR_ORDER.length)]; if (!pick.includes(c)) pick.push(c); }
  const W = new World({ stage: 'cemetery', roster: pick.map((c, i) => ({ char: c, slot: i, bot: 3 })), rules: { mode: 'stock', stocks: 3, hazards: false, minigames: false }, seed: seed * 1000 + g });
  const last = {};
  for (let t = 0; t < 180 + secs * 60 && W.phase !== 'over' && W.phase !== 'end'; t++) {
    W.step({});
    for (const e of W.events) {
      if (e.type === 'move' && /^(sp_|smash|usmash|dsmash|jab1)/.test(e.m)) M(W.fighters[e.s].char, e.m).uses++;
      if (e.type === 'hit' && e.a >= 0 && e.a !== e.s && (e.sm || e.m)) { const A = W.fighters[e.a], mm = e.sm || e.m, r = M(A.char, mm); r.hits++; r.dmg += e.d || 0; last[e.s] = { a: e.a, m: mm, t: W.tick }; }
      if (e.type === 'ko' && last[e.s] && W.tick - last[e.s].t < 400) M(W.fighters[last[e.s].a].char, last[e.s].m).kos++;
    }
  }
  for (const F of W.list) { const r = C(F.char); r.games++; r.dealt += F.stats.dealt; r.taken += F.stats.taken; r.kos += F.stats.kos; r.falls += F.stats.falls; if (W.winner === F.slot) r.wins++; }
}
const rows = Object.values(ch).map((r) => ({ char: r.char, games: r.games, net: +((r.kos - r.falls) / r.games).toFixed(2), win: Math.round(100 * r.wins / r.games), dealt: Math.round(r.dealt / r.games), taken: Math.round(r.taken / r.games) })).sort((a, b) => b.net - a.net);
console.log(`${matches} matchs, graine ${seed}, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
console.table(rows);
const moves = Object.values(mv).filter((m) => m.uses >= 5).map((m) => ({ move: m.char + ':' + m.move, uses: m.uses, dmgPerUse: +(m.dmg / m.uses).toFixed(1), koPer100: +(100 * m.kos / m.uses).toFixed(1) }));
moves.sort((a, b) => b.dmgPerUse - a.dmgPerUse);
console.log('le plus payant :'); console.table(moves.slice(0, 14));
console.log('le moins payant :'); console.table(moves.slice(-10));
