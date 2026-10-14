// Headless balance runs in the browser console (no rendering): CPU free-for-alls, stats per character and per move.
//   const B = await import('/tools/dev/balance.js'); const r = await B.run({ matches: 60, secs: 90, lvl: 3 }); console.table(r.specials)
import { World } from '/src/sim/world.js';
import { CHARS, CHAR_ORDER } from '/src/sim/chars/index.js';
import { STAGES } from '/src/sim/stages/index.js';

export async function run({ matches = 40, secs = 90, lvl = 3, chars = CHAR_ORDER, stage = 'cemetery', players = 4, seed = 1 } = {}) {
  const per = {}, mv = {}, ch = {};
  const C = (c) => ch[c] || (ch[c] = { char: c, games: 0, wins: 0, dealt: 0, taken: 0, kos: 0, falls: 0, sd: 0 });
  const M = (c, m) => { const k = c + ':' + m; return mv[k] || (mv[k] = { char: c, move: m, uses: 0, hits: 0, dmg: 0, kos: 0, kb: 0 }); };
  let rs = seed;
  const rnd = () => ((rs = (rs * 16807) % 2147483647) / 2147483647);
  for (let g = 0; g < matches; g++) {
    const pick = [];
    while (pick.length < players) { const c = chars[Math.floor(rnd() * chars.length)]; if (!pick.includes(c)) pick.push(c); }
    const W = new World({ stage, roster: pick.map((c, i) => ({ char: c, slot: i, bot: lvl })), rules: { mode: 'stock', stocks: 3, hazards: false }, seed: 1000 + g });
    const last = {};
    for (let t = 0; t < 180 + secs * 60 && W.phase !== 'over' && W.phase !== 'end'; t++) {
      W.step({});
      for (const e of W.events) {
        if (e.type === 'move' && /^(sp_|dashattack|smash|usmash|dsmash)/.test(e.m)) M(W.fighters[e.s].char, e.m).uses++;
        if (e.type === 'hit' && e.a >= 0 && e.a !== e.s && (e.sm || e.m)) {
          const A = W.fighters[e.a], mm = e.sm || e.m, r = M(A.char, mm); r.hits++; r.dmg += e.d || 0; r.kb += e.kb || 0;
          last[e.s] = { a: e.a, m: mm, t: W.tick };
        }
        if (e.type === 'ko' && last[e.s] && W.tick - last[e.s].t < 400) { M(W.fighters[last[e.s].a].char, last[e.s].m).kos++; }
      }
    }
    for (const F of W.list) {
      const r = C(F.char); r.games++; r.dealt += F.stats.dealt; r.taken += F.stats.taken; r.kos += F.stats.kos; r.falls += F.stats.falls; r.sd += F.stats.sd;
      if (W.winner === F.slot) r.wins++;
    }
    if (g % 5 === 4) await new Promise((res) => setTimeout(res, 0));
  }
  const chars_ = Object.values(ch).map((r) => ({ ...r, winPct: Math.round(100 * r.wins / r.games), dealtPerGame: Math.round(r.dealt / r.games), koPerGame: +(r.kos / r.games).toFixed(2), fallsPerGame: +(r.falls / r.games).toFixed(2) })).sort((a, b) => b.winPct - a.winPct);
  const moves = Object.values(mv).map((r) => ({ ...r, dmgPerUse: +(r.dmg / Math.max(1, r.uses)).toFixed(1), koPer100: +(100 * r.kos / Math.max(1, r.uses)).toFixed(1), hitPct: Math.round(100 * Math.min(r.hits, r.uses) / Math.max(1, r.uses)) }));
  return { chars: chars_, specials: moves.filter((m) => m.move.startsWith('sp_')).sort((a, b) => b.dmgPerUse - a.dmgPerUse), others: moves.filter((m) => !m.move.startsWith('sp_')) };
}
