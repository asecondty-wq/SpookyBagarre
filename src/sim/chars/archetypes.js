// Each fighter moves like a Super Smash Bros. Ultimate character (its archetype): the numbers of that character
// (ultimateframedata.com/stats, read on 15 Oct 2026: public measured attributes, no game code or data copied) turned
// into ours as RATIOS to Mario's, Mario being our average fighter, so the stages, the recoveries and the hitboxes keep
// their scale while every fighter gets its archetype's differences: Falcon runs 45 % faster than Mario, Peach falls
// 20 % slower, Ganondorf barely drifts in the air...
//   walk, initial dash, run (units/frame), dash frames, air speed, max air acceleration, gravity, fall, fast fall,
//   full hop, short hop, air jump (units), weight, hard landing frames
const U = {
  mario: [1.155, 1.936, 1.76, 10, 1.208, 0.08, 0.087, 1.5, 2.4, 36.33, 17.54, 36.33, 98, 4],
  falcon: [0.987, 1.98, 2.552, 15, 1.218, 0.075, 0.12, 1.865, 2.984, 37.31, 17.98, 37.31, 104, 4],
  samus: [1.115, 1.87, 1.654, 10, 1.103, 0.09, 0.075, 1.33, 2.128, 37, 18, 37, 108, 4],
  ness: [0.907, 1.826, 1.609, 13, 1.007, 0.1, 0.077, 1.31, 2.096, 34.48, 16.65, 45.65, 94, 4],
  ganondorf: [0.767, 1.87, 1.34, 15, 0.83, 0.04, 0.108, 1.65, 2.64, 25.49, 12.24, 26, 118, 5],
  peach: [0.924, 1.826, 1.595, 15, 1.029, 0.12, 0.07, 1.19, 1.904, 30.03, 14.5, 30.03, 89, 4],
  iceclimbers: [1.008, 1.68, 1.53, 12, 0.83, 0.09, 0.082, 1.3, 2.08, 34.69, 16.75, 34.69, 92, 4],
  pikachu: [1.302, 1.98, 2.039, 13, 0.957, 0.1, 0.095, 1.55, 2.48, 35.5, 17.12, 35.5, 79, 4],
  dk: [1.365, 2.09, 1.873, 15, 1.208, 0.06, 0.085, 1.63, 2.608, 34, 17.3, 35.5, 127, 5],
  marth: [1.575, 2.255, 1.964, 10, 1.071, 0.08, 0.075, 1.58, 2.528, 33.66, 16.26, 33.66, 90, 4],
  gameandwatch: [1.18, 1.98, 1.679, 8, 1.176, 0.1, 0.08, 1.24, 1.984, 27.51, 13.26, 27.51, 75, 4],
  luigi: [1.134, 1.815, 1.65, 10, 0.77, 0.075, 0.083, 1.32, 2.112, 44, 19.98, 41.31, 97, 4],
  greninja: [1.502, 2.178, 2.288, 10, 1.239, 0.08, 0.18, 1.85, 2.96, 46, 22.11, 46, 88, 4],
  krool: [0.903, 1.936, 1.485, 10, 0.945, 0.05, 0.105, 1.7, 2.72, 33, 13.5, 32.61, 133, 6],
  wario: [0.889, 1.837, 1.65, 12, 1.271, 0.12, 0.107, 1.61, 2.576, 30.5, 14.7, 30.5, 107, 4],
  squirtle: [1.281, 1.936, 1.76, 10, 1.01, 0.105, 0.128, 1.35, 2.16, 35.35, 17.03, 35.35, 75, 4],
  link: [1.247, 1.98, 1.534, 12, 0.924, 0.05, 0.096, 1.6, 3.04, 27.8, 13.38, 29, 104, 5],
  wolf: [1.208, 2.09, 1.54, 10, 1.281, 0.09, 0.13, 1.8, 2.88, 32.02, 15.38, 30.71, 92, 4],
  villager: [1.092, 1.815, 1.397, 13, 0.987, 0.06, 0.078, 1.32, 2.112, 32.5, 15.69, 32.5, 92, 4],
  mewtwo: [1.26, 2.255, 2.255, 10, 1.313, 0.07, 0.082, 1.55, 2.48, 31.11, 17.5, 57.35, 79, 5], // Anbuu
};

// our fighters -> their archetype (the creator's picks; the eight first ones chosen by their style)
export const ARCHETYPE = {
  pandrezz: 'falcon', aboueb: 'samus', tices: 'ness', omfu: 'ganondorf', lolobiscotto: 'peach', jsan: 'iceclimbers',
  nymano: 'pikachu', bido: 'dk', epektase: 'marth', pprod: 'gameandwatch', skanky: 'luigi', anbuu: 'mewtwo',
  frog: 'greninja', micron: 'mario', bubba: 'krool', parmesan: 'wario', pika: 'squirtle', tung: 'link', shark: 'wolf', catlady: 'villager',
};

// our average fighter (what Mario becomes): m/s, m, the base gravity of constants.js (40 m/s² x gravity)
const BASE = { walk: 3.6, run: 8.6, air: 6.4, airAccel: 34, fall: 17.5, hop: 3.2 };
const G = 40;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function applyArchetypes(CHARS) {
  const M = U.mario;
  for (const [id, arch] of Object.entries(ARCHETYPE)) {
    const C = CHARS[id], A = U[arch];
    if (!C || !A) continue;
    const S = C.stats;
    const [walk, dash, run, dashF, air, acc, grav, fall, ff, fh, sh, dj, weight, land] = A;
    S.walkSpeed = +(BASE.walk * walk / M[0]).toFixed(3);
    S.runSpeed = +(BASE.run * run / M[2]).toFixed(3);
    S.dashSpeed = +(BASE.run * 1.12 * dash / M[1]).toFixed(3);
    S.dashFrames = dashF;
    S.airSpeed = +(BASE.air * air / M[4]).toFixed(3);
    S.airAccel = +clamp(BASE.airAccel * acc / M[5], 16, 56).toFixed(2);
    // gravity and fall speed: the archetype's differences, softened (our recoveries and launches were not made for
    // Greninja's or Fox's weight): half of the gravity gap, 70 % of the fall speed gap
    S.gravity = +(1 + (grav / M[6] - 1) * 0.5).toFixed(3);
    // the jump heights of the archetype (scaled like Mario's), whatever its gravity
    const g = G * S.gravity;
    S.jumpVel = +Math.sqrt(2 * g * BASE.hop * fh / M[9]).toFixed(3);
    S.airJumpVel = +Math.sqrt(2 * g * BASE.hop * 0.85 * dj / M[11]).toFixed(3);
    S.shortHop = +Math.sqrt(sh / fh).toFixed(3); // the jump speed of a short hop, as a share of the full hop's
    S.fallSpeed = +(BASE.fall * (1 + (fall / M[7] - 1) * 0.7)).toFixed(3);
    S.ffMul = +(ff / fall).toFixed(3);
    S.weight = Math.round(98 + (weight - 98) * 0.75); // three quarters of the weight gap (the feather weights died too early)
    S.landHard = land;
    S.archetype = arch;
  }
  // traction: Luigi's slippery shoes
  if (CHARS.skanky) CHARS.skanky.stats.friction = Math.round(CHARS.skanky.stats.friction * 0.55);
}
