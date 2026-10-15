// Vérifie un ulti (src/sim/minigames.js, src/sim/mg/) sans affichage, dans Node :
//   node tools/dev/mgcheck.mjs <jeu> [graines]        (par ex. node tools/dev/mgcheck.mjs slap 4)
// Pour chaque graine : un match CPU contre CPU, puis un « humain » aux entrées aléatoires contre un CPU. Il vérifie que le
// jeu va au bout sans erreur, que son état reste du JSON propre (pas de NaN, pas d'objets spéciaux), qu'un retour en
// arrière (saveState / loadState, comme le rollback) rejoue à l'identique, que deux parties identiques donnent la même
// empreinte, et que le gain reste raisonnable (0 à 80 %).
globalThis.window = { addEventListener() {}, __vpads: [] }; // src/core/input.js écoute le clavier au chargement
const { World } = await import('../../src/sim/world.js');
const MG = await import('../../src/sim/minigames.js');
const { saveState, loadState, hashSaved } = await import('../../src/sim/state.js');

const kind = process.argv[2];
const seeds = +(process.argv[3] || 3);
if (!kind || !MG.ULTI_NAMES[kind]) { console.log('jeux :', Object.keys(MG.ULTI_NAMES).join(', ')); process.exit(1); }

function lcg(seed) { let s = (seed >>> 0) || 1; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; }
function humanInputs(seed) {
  const rnd = lcg(seed);
  let mx = 0, my = 0, hold = 0;
  return () => {
    if (rnd() < 0.1) { const k = rnd(); if (k < 0.25) { mx = 0; my = 0; } else { mx = Math.round((rnd() * 2 - 1) * 1000) / 1000; my = Math.round((rnd() * 2 - 1) * 1000) / 1000; } }
    let pressed = 0, held = 0;
    if (rnd() < 0.12) pressed |= [1, 1, 2, 4, 8, 32][(rnd() * 6) | 0];
    if (hold > 0) { hold--; held |= 1; } else if (rnd() < 0.03) hold = 10 + ((rnd() * 40) | 0);
    held |= pressed;
    if (rnd() < 0.3) held |= [256, 512, 1024][(rnd() * 3) | 0]; // les bits de déplacement du mode deux sticks
    return { mx, my, held, pressed };
  };
}
function badValue(v, path = 'g') {
  if (typeof v === 'number') return Number.isFinite(v) ? null : `${path} = ${v}`;
  if (v === null || typeof v === 'string' || typeof v === 'boolean') return null;
  if (typeof v === 'undefined') return null;
  if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) { const b = badValue(v[i], `${path}[${i}]`); if (b) return b; } return null; }
  if (typeof v === 'object') {
    if (Object.getPrototypeOf(v) !== Object.prototype) return `${path} n'est pas un objet simple`;
    for (const k of Object.keys(v)) { const b = badValue(v[k], `${path}.${k}`); if (b) return b; }
    return null;
  }
  return `${path} est un ${typeof v}`;
}

function play(seed, human, rewind) {
  const roster = [{ slot: 0, char: 'pandrezz', bot: human ? 0 : 1 + (seed % 3) }, { slot: 1, char: 'nymano', bot: 1 + ((seed + 1) % 3) }];
  const W = new World({ stage: 'cemetery', roster, rules: { stocks: 3, minigames: true }, seed: 1000 + seed });
  while (W.phase !== 'play') W.step({});
  MG.startMinigame(W, 0, 1, kind);
  if (!W.mg || W.mg.kind !== kind) throw new Error('le jeu ne démarre pas');
  const next = humanInputs(seed * 7 + 3);
  const log = [];
  let frames = 0, playF = 0, res = null, ev = {};
  const step = (I) => { W.step(I); for (const e of W.events) { ev[e.type] = (ev[e.type] || 0) + 1; if (e.type === 'mgEnd') res = e; } };
  while (W.mg && frames < 3000) {
    const I = human ? { 0: next() } : {};
    log.push(I);
    if (W.mg.ph === 'play') playF++;
    if (rewind && W.mg.ph === 'play' && W.mg.t === 300) {
      // retour en arrière : 60 images, puis on recharge et on rejoue les mêmes
      const S = saveState(W), I60 = [I];
      step(I);
      for (let k = 1; k < 60; k++) { const J = human ? { 0: next() } : {}; I60.push(J); step(J); }
      const h1 = hashSaved(saveState(W));
      loadState(W, S);
      for (const J of I60) W.step(J);
      const h2 = hashSaved(saveState(W));
      if (h1 !== h2) throw new Error(`rejeu différent après un retour en arrière (${h1} / ${h2})`);
      frames += 60; continue;
    }
    step(I);
    frames++;
    if (W.mg && frames % 50 === 0) { const b = badValue(W.mg.g); if (b) throw new Error('état pas propre : ' + b); }
  }
  if (W.mg) throw new Error('le jeu ne se termine pas');
  return { res, playF, ev, hash: hashSaved(saveState(W)) };
}

let ok = true;
for (let s = 0; s < seeds; s++) {
  for (const human of [false, true]) {
    try {
      const a = play(s, human, true), b = play(s, human, false);
      if (a.hash !== b.hash) throw new Error('deux parties identiques ne finissent pas pareil');
      const r = a.res;
      if (!r) throw new Error('pas de résultat (mgEnd)');
      if (r.d < 0 || r.d > 80) throw new Error(`gain bizarre : ${r.d} %`);
      const evs = Object.entries(a.ev).filter(([k]) => k.startsWith('mg') && !/^mg(Start|Go|Rdy|Hype|End|Out)$/.test(k)).map(([k, n]) => `${k}:${n}`).join(' ');
      console.log(`ok    graine ${s} ${human ? 'humain' : 'CPU   '}  ${a.playF} images  gagnant ${r.w}  ${r.d} %  ${r.sa !== undefined ? `scores ${r.sa}-${r.sv}` : ''}  ${evs}`);
    } catch (e) {
      ok = false;
      console.log(`ÉCHEC graine ${s} ${human ? 'humain' : 'CPU'} : ${e.message}`);
      if (process.env.DEBUG) console.log(e.stack);
    }
  }
}
console.log(ok ? `${kind} : tout va bien` : `${kind} : des échecs`);
process.exit(ok ? 0 : 1);
