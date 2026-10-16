// Frame-exact check of the shield and the dodges (Ultimate's, per archetype: src/sim/chars/archetypes.js), in Node:
//   ~/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe tools/dev/dodgecheck.mjs [fighter]
// For each fighter: the frame its shield is up, its minimum time and its drop; its spot dodge, forward and back roll,
// neutral and sideways air dodge: the frames it is intangible and its first actionable frame (frame 1 = the frame
// the input is pressed, like Ultimate's frame data), against the expected ones; the staling of six spot dodges in a
// row; a slow tilt in shield (no roll) against a flick (a roll). Prints OK or the differences.
globalThis.window = { addEventListener() {}, __vpads: [] };
const { World } = await import('../../src/sim/world.js');
const { CHAR_ORDER, CHARS } = await import('../../src/sim/chars/index.js');
const { BTN } = await import('../../src/core/input.js');
const { setState } = await import('../../src/sim/fighter.js');

const only = process.argv[2];
const E = { mx: 0, my: 0, held: 0, pressed: 0 };
const mk = (char) => {
  const W = new World({ stage: 'cemetery', roster: [{ char, slot: 0, bot: 0 }, { char: 'micron', slot: 1, bot: 0 }], rules: { mode: 'stock', stocks: 3, hazards: false, minigames: false }, seed: 7 });
  for (let i = 0; i < 400 && W.phase !== 'play'; i++) W.step({});
  const O = W.fighters[1]; O.x = -11; // out of the way
  return W;
};
const reset = (W, air = false) => {
  const F = W.fighters[0];
  F.x = 3.2; F.y = air ? 24 : 0; F.vx = F.vy = 0; F.kx = F.ky = 0; F.grounded = !air; F.facing = Math.PI / 2;
  F.move = null; F.mv = {}; F.airdodged = false; F.invuln = 0; F.intangible = 0; F.shield = 50; F.shieldStun = 0; F.dodgeP = 0; F.dodgeT = -999;
  setState(F, air ? 'air' : 'idle');
  for (let i = 0; i < 70; i++) W.step({ 0: { ...E } }); // the buffers empty, the stick centred a while, the dodges fresh
  if (air) { F.x = 3.2; F.y = 24; F.vy = 0; F.vx = 0; }
  return F;
};
// press shield with the stick (mx, my) held: frames until the state is back to `idleStates`, intangible frames
function dodge(W, mx, my, air = false, stopState) {
  const F = reset(W, air);
  if (my && !mx && !air) W.step({ 0: { mx, my, held: 0, pressed: 0 } }); // down already held (a crouch); a roll: the stick and the shield on the same frame (held a frame before, the fighter would walk and turn)
  const inv = [];
  let faf = 0, state0 = '';
  for (let f = 1; f <= 200; f++) {
    W.step({ 0: { mx, my, held: f === 1 ? BTN.SHIELD : 0, pressed: f === 1 ? BTN.SHIELD : 0 } });
    if (f === 1) state0 = F.state;
    if (F.intangible > 0 || F.invuln > 0) inv.push(f);
    if (f > 1 && F.state !== stopState) { faf = f; break; }
  }
  return { state0, inv: inv.length ? [inv[0], inv[inv.length - 1], inv.length] : null, faf, F };
}
const rng = (a) => (a ? `${a[0]}-${a[1]}` : '—');

let bad = 0;
for (const id of CHAR_ORDER) {
  if (only && id !== only) continue;
  const S = CHARS[id].stats, D = S.dodge, W = mk(id), out = [];
  const check = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) bad++; out.push(`${name} ${ok ? 'ok' : `NON (${JSON.stringify(got)} au lieu de ${JSON.stringify(want)})`}`); };
  // the shield: up on frame 1; a tap: up 3 frames, then 11 to put it down
  {
    const F = reset(W);
    const seq = [];
    for (let f = 1; f <= 20; f++) { W.step({ 0: { mx: 0, my: 0, held: f === 1 ? BTN.SHIELD : 0, pressed: f === 1 ? BTN.SHIELD : 0 } }); seq.push(F.state); }
    const up = seq.indexOf('shield') + 1, lastUp = seq.lastIndexOf('shield') + 1, back = seq.indexOf('idle') + 1;
    check('bouclier (sorti, tenu jusqu\'à, jouable)', [up, lastUp, back], [1, 3, 15]);
  }
  // spot dodge, rolls (the fighter faces right: right = forward, left = back)
  const sp = dodge(W, 0, -1, false, 'dodge');
  check('esquive sur place', [sp.state0, rng(sp.inv), sp.faf], ['dodge', `${D.spot.s}-${D.spot.e}`, D.spot.total + 1]);
  const fr = dodge(W, 1, 0, false, 'dodge');
  check('roulade avant', [rng(fr.inv), fr.faf, fr.F.mv.back || 0], [`${D.froll.s}-${D.froll.e}`, D.froll.total + 1, 0]);
  const br = dodge(W, -1, 0, false, 'dodge');
  check('roulade arrière', [rng(br.inv), br.faf], [`${D.broll.s}-${D.broll.e}`, D.broll.total + 1]);
  // air dodges, high over the stage (nothing to land on)
  const na = dodge(W, 0, 0, true, 'airdodge');
  check('esquive aérienne sur place', [na.state0, rng(na.inv), na.faf], ['airdodge', `${D.nad.s}-${D.nad.e}`, D.nad.total + 1]);
  const sa = dodge(W, 1, 0, true, 'airdodge');
  check('esquive aérienne de côté', [rng(sa.inv), sa.faf], [`${D.ad.s}-${D.ad.e}`, D.ad.side + 1]);
  // staling: six spot dodges in a row (each as soon as possible)
  {
    const F = reset(W), lens = [], starts = [];
    for (let k = 0; k < 6; k++) {
      let f = 0, first = 0;
      W.step({ 0: { mx: 0, my: -1, held: BTN.SHIELD, pressed: BTN.SHIELD } }); f = 1;
      while (F.state === 'dodge' && f < 200) { W.step({ 0: { mx: 0, my: -1, held: 0, pressed: 0 } }); f++; if (!first && F.intangible > 0) first = f; }
      lens.push(f); starts.push(first);
      W.step({ 0: { mx: 0, my: 0, held: 0, pressed: 0 } }); // the stick back (a new press)
    }
    const want = [0, 0.06, 0.12, 0.18, 0.24, 0.3].map((p) => Math.round(D.spot.total * (1 + p)) + (p > 0 ? 1 : 0) + 1);
    check('usure (6 esquives : durées)', lens, want);
    out.push(`  1re image invincible : ${starts.join(' ')}`);
  }
  // in shield: a slow tilt (no roll), then a flick (a roll)
  {
    const F = reset(W);
    W.step({ 0: { mx: 0, my: 0, held: BTN.SHIELD, pressed: BTN.SHIELD } });
    let rolled = false;
    for (let i = 1; i <= 10; i++) { W.step({ 0: { mx: i / 10, my: 0, held: BTN.SHIELD, pressed: 0 } }); if (F.state === 'dodge') rolled = true; }
    W.step({ 0: { mx: 0, my: 0, held: BTN.SHIELD, pressed: 0 } });
    W.step({ 0: { mx: 1, my: 0, held: BTN.SHIELD, pressed: 0 } });
    check('bouclier : penché lentement / coup sec', [rolled, F.state], [false, 'dodge']);
  }
  console.log(`${id} (${S.archetype}) : ${out.join(' · ')}`);
}
console.log(bad ? `${bad} écart(s)` : 'tout est à l\'image près');
