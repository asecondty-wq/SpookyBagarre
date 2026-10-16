// How much a special pays when spammed (Ultimate has no cooldowns: a move's own lag has to stop it), in Node:
//   ~/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe tools/dev/spamcheck.mjs [fighter]
// Each special (and, to compare, the jab and the forward smash) used again as soon as the fighter can act, for 10 s,
// on a dummy standing 1.5, 3 or 6 m away (the best of the three): damage a second, KOs. A special far above the
// fighter's own normal attacks is one to slow down (more lag) or to limit (one at a time).
globalThis.window = { addEventListener() {}, __vpads: [] };
const { World } = await import('../../src/sim/world.js');
const { CHAR_ORDER, CHARS } = await import('../../src/sim/chars/index.js');
const { BTN } = await import('../../src/core/input.js');
const { setState } = await import('../../src/sim/fighter.js');
const only = process.argv[2];
const T = 600;
const INPUT = { sp_n: [0, 0, BTN.X], sp_s: [1, 0, BTN.X], sp_d: [0, -1, BTN.X], jab1: [0, 0, BTN.A], smash: [1, 0, BTN.A] };
function spam(id, mv, dist) {
  const W = new World({ stage: 'cemetery', roster: [{ char: id, slot: 0, bot: 0 }, { char: 'micron', slot: 1, bot: 0 }], rules: { mode: 'stock', stocks: 99, hazards: false, minigames: false }, seed: 3 });
  for (let i = 0; i < 400 && W.phase !== 'play'; i++) W.step({});
  const [F, D] = W.fighters;
  F.x = -dist / 2; F.facing = Math.PI / 2; D.x = dist / 2; D.facing = -Math.PI / 2; setState(F, 'idle'); setState(D, 'idle');
  let dmg = 0, kos = 0, last = 0;
  const [mx, my, b] = INPUT[mv];
  for (let t = 0; t < T; t++) {
    // press on every other frame (a fresh press each time: the buffer catches the first actionable frame)
    const press = t % 2 === 0;
    const smash = mv === 'smash';
    W.step({ 0: { mx: smash ? (press ? 1 : 0) : mx, my, held: press ? b : 0, pressed: press ? b : 0 } });
    // the dummy stays put, unhurt (the knockback would carry it out of reach): only the damage dealt counts
    dmg += D.damage; D.damage = 0;
    for (const e of W.events) if (e.type === 'ko' && e.s === 1) kos++;
    D.x = dist / 2; D.y = 0; D.vx = D.vy = D.kx = D.ky = 0; D.pendingLaunch = null; D.grounded = true; D.invuln = 0;
    if (D.state === 'dead' || D.state === 'respawn' || D.state === 'tumble' || D.state === 'air') setState(D, 'idle');
    if (F.state === 'idle' || F.state === 'walk' || F.state === 'run') { F.x = -dist / 2; F.facing = Math.PI / 2; }
  }
  return { dps: dmg / (T / 60), kos };
}
const rows = [];
for (const id of CHAR_ORDER) {
  if (only && id !== only) continue;
  const r = {};
  for (const mv of Object.keys(INPUT)) {
    let best = { dps: 0, kos: 0 };
    for (const d of [1.2, 2.5, 5]) { const x = spam(id, mv, d); if (x.dps > best.dps) best = x; }
    r[mv] = best;
  }
  const ref = Math.max(r.jab1.dps, r.smash.dps);
  rows.push({ id, ...Object.fromEntries(Object.entries(r).map(([k, v]) => [k, +v.dps.toFixed(1)])), ref: +ref.toFixed(1), worst: ['sp_n', 'sp_s', 'sp_d'].map((k) => [k, r[k].dps / (ref || 1)]).sort((a, b) => b[1] - a[1])[0].map((v) => (typeof v === 'number' ? +v.toFixed(2) : v)).join(' x') });
}
console.table(rows);
