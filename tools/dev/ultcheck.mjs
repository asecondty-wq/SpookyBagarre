// Ultimates sans navigateur : jauge, A + X, déroulé de la scène, victimes, et retour en arrière identique.
//   node tools/dev/ultcheck.mjs [graine]
globalThis.window = { addEventListener() {}, __vpads: [] };
const { World } = await import('../../src/sim/world.js');
const { saveState, loadState, hashState } = await import('../../src/sim/state.js');
const { ULT_MAX } = await import('../../src/sim/ultimate.js');
const { BTN } = await import('../../src/core/input.js');
const seed = +process.argv[2] || 7;
const mk = () => new World({ stage: 'cemetery', roster: [{ slot: 0, char: 'anbuu', name: 'A' }, { slot: 1, char: 'pandrezz', name: 'B' }], rules: { stocks: 3, hazards: false, minigames: false }, seed });
const idle = { mx: 0, my: 0, held: 0, pressed: 0 };
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗', m); } else console.log('  ✓', m); };

// 1. la jauge se remplit en donnant et en recevant
let W = mk();
for (let i = 0; i < 260; i++) W.step({ 0: idle, 1: idle });
ok(W.phase === 'play', 'le match est lancé');
const A = W.fighters[0], B = W.fighters[1];
W.applyHit({ owner: 0, key: 'k1', x: B.x, y: B.y + 1, z: 0, r: 1, dmg: 10, ang: 40, kbb: 5, kbg: 50, dir: 'face', dirAngle: 0, ox: A.x, oz: 0 }, B);
ok(A.ult > 0 && A.ult < ULT_MAX, `A gagne de la jauge en frappant (${A.ult.toFixed(1)})`);
ok(B.ult === 0, 'pandrezz n\'a pas d\'ultime : sa jauge reste à 0');
const before = A.ult;
W.applyHit({ owner: 1, key: 'k2', x: A.x, y: A.y + 1, z: 0, r: 1, dmg: 10, ang: 40, kbb: 5, kbg: 50, dir: 'face', dirAngle: 0, ox: B.x, oz: 0 }, A);
ok(A.ult > before, `A gagne aussi de la jauge en recevant (${A.ult.toFixed(1)})`);

const START = process.env.START !== undefined ? +process.env.START : 60; // calibré comme SSBU : un Final Smash tue vers 50-60 %
// 2. A + X avec la jauge pleine, l'adversaire devant lui
W = mk();
for (let i = 0; i < 260; i++) W.step({ 0: idle, 1: idle });
const a = W.fighters[0], b = W.fighters[1];
a.ult = ULT_MAX; b.x = a.x + (Math.sin(a.facing) < 0 ? -4 : 4); b.y = a.y; b.damage = START;
// seulement A : rien
W.step({ 0: { ...idle, held: BTN.A, pressed: BTN.A }, 1: idle });
ok(!W.ult, 'A seul : pas d\'ultime');
for (let i = 0; i < 40; i++) W.step({ 0: idle, 1: idle });
a.ult = ULT_MAX; a.state = 'idle'; a.move = null;
const h0 = hashState(W), snap = saveState(W);
W.step({ 0: { ...idle, held: BTN.A | BTN.X, pressed: BTN.A | BTN.X }, 1: idle });
ok(W.ult && a.ult === 0, 'A + X : l\'ultime part, la jauge est vidée');
const log = [];
const evs = [];
let frames = 0, hp = -1;
while (W.ult && frames < 600) {
  frames++;
  W.step({ 0: idle, 1: idle });
  for (const e of W.events) { evs.push(e.type); if (e.type === 'ultHit') log.push(e.n + (e.last ? 'L' : '')); }
}
ok(!W.ult, `l'ultime se termine (${frames} images)`);
console.log('   évènements :', [...new Set(evs)].join(', '), '| notes :', log.join(' '));
ok(evs.includes('ultStrike') && evs.includes('ultCine') && evs.includes('ultEnd'), 'strike, cinématique, fin');
ok(log.length === 7 && log[6] === '6L', 'sept notes dont la dernière est finale');
ok(b.damage > START + 6 * 2 && b.damage < START + 6 * 2.2 + 25, `dégâts reçus (${b.damage.toFixed(1)} %)`);
ok(b.hitlag > 0 || b.state === 'hitstun', 'la victime est éjectée par un vrai coup');
let kos = 0;
for (let i = 0; i < 400 && b.stocks === 3; i++) { W.step({ 0: idle, 1: idle }); }
ok(START < 50 ? true : b.stocks < 3, `victime à ${START} % : éjectée hors de l'écran (vies ${b.stocks}, ${b.damage.toFixed(0)} %)`);

// 3. à vide : personne devant
const W2 = mk();
for (let i = 0; i < 260; i++) W2.step({ 0: idle, 1: idle });
const a2 = W2.fighters[0], b2 = W2.fighters[1];
a2.ult = ULT_MAX; b2.x = a2.x - (Math.sin(a2.facing) < 0 ? -20 : 20);
W2.step({ 0: { ...idle, held: 3, pressed: 3 }, 1: idle });
let n2 = 0; const e2 = [];
while (W2.ult && n2 < 400) { n2++; W2.step({ 0: idle, 1: idle }); for (const e of W2.events) e2.push(e.type); }
ok(!W2.ult && !e2.includes('ultCine') && b2.damage === 0, `à vide : la scène se joue, personne n'est touché (${n2} images)`);

// 4. retour en arrière : sauvegarder au milieu de la scène, rejouer = même état
const W3 = mk();
for (let i = 0; i < 260; i++) W3.step({ 0: idle, 1: idle });
const a3 = W3.fighters[0], b3 = W3.fighters[1];
a3.ult = ULT_MAX; b3.x = a3.x + (Math.sin(a3.facing) < 0 ? -4 : 4); b3.y = a3.y;
W3.step({ 0: { ...idle, held: 3, pressed: 3 }, 1: idle });
for (let i = 0; i < 100; i++) W3.step({ 0: idle, 1: idle });
const S = saveState(W3), hMid = hashState(W3);
for (let i = 0; i < 200; i++) W3.step({ 0: idle, 1: idle });
const hEnd = hashState(W3);
loadState(W3, JSON.parse(JSON.stringify(S)));
ok(hashState(W3) === hMid, 'rechargé au milieu de la scène : même empreinte');
for (let i = 0; i < 200; i++) W3.step({ 0: idle, 1: idle });
ok(hashState(W3) === hEnd, 'rejoué : même empreinte à la fin (déterministe)');

console.log(fails.length ? `\n${fails.length} échec(s)` : '\ntout est bon');
process.exit(fails.length ? 1 : 0);
