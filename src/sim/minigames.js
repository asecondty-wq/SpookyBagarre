// Mini-jeux « Bagarre » (les ultis) : toutes les 60 à 80 s de combat, au hasard (tickMinigameClock), le match se fige et deux combattants
// tirés au hasard s'affrontent 10 s dans un mini-jeu tiré au hasard (pickKind : un sac mélangé de tous les jeux, jamais
// deux fois le même de suite). Après, le match reste figé 2 s (stepResume), puis le
// perdant prend ses % et une éjection. Tout se passe ici, dans la simulation (déterministe, rejoué tel quel en
// rollback, les CPU y jouent aussi) ; l'affichage est dans src/render/minigameView.js.
//   duel au pistolet (fps) : face à face en écran partagé, chacun bouge, s'accroupit derrière ses tombes, saute et tire ;
//     tête = abattu d'un coup, corps = 34 à 42 PV sur 100. Premier à 3 éliminations (ou le plus à la fin) : le perdant
//     prend 40 à 80 %.
//   duel de bonbons (candy) : chacun sa grille (la même au départ), trois bonbons alignés ou plus ; 4 = citrouille
//     (explose en 3x3), 5 = crâne (ligne + colonne). Le perdant prend 12 % + l'écart de score / 40 (65 % au plus).
//   tiercé de la pinte (horses) : chacun parie sur un cheval à la télé, puis le fouette (A, sans s'emballer) et boit sa
//     pinte (X) pour un coup de turbo. Le cheval arrivé avant l'autre gagne : le perdant prend 35 à 70 %.
//   la bonne parole (moral) : des questions morales à la chaîne, gauche ou droite ; le meilleur score gagne, le perdant
//     prend 20 % + 6 % par point d'écart (70 % au plus).
//   danse kawaii (dance) : des flèches montent au rythme (150 à la minute), la bonne direction au bon moment ; parfait,
//     super, bien, raté ; le combo multiplie. Le perdant prend 15 % + l'écart / 30 (70 % au plus).
//   bistouri bagarre (surgery) : chacun opère l'autre ; aller sur un objet coincé dans le corps, tenir A pour le tirer
//     sans que la pince ne touche le bord (elle tremble de plus en plus) : sinon BZZZT. Le perdant prend 15 % + l'écart / 8.
//   et les jeux écrits chacun dans son fichier : src/sim/mg/ (registre EXTRA_GAMES, contrat dans src/sim/mg/README.md).
// Avant chaque jeu, 3,5 s de présentation (MG_INTRO) : un mouvement de caméra sur les deux duellistes et une phrase.
// Tous se jouent au clavier seul (DIGITAL : voir le duel, le bistouri ; src/sim/mg/ pour les autres).
import { BTN, MOUSE, MV_L, MV_R, MV_D, DIGITAL, MG_INTRO, MG_PLAY, MG_RESUME, HURT_AT, HURT_SHARE, mgOutro, clampN, payout } from './mg/common.js';
import { EXTRA_GAMES } from './mg/index.js';
import duel, { forceDuelVariant, nextDuelVariant, DUEL_VARIANTS } from './mg/duel.js';
export { MG_INTRO, MG_PLAY, MG_WIN, MG_RESUME, MG_READY, HURT_AT, HURT_SHARE, mgOutro } from './mg/common.js';

// un mini-jeu toutes les 60 à 80 s de combat (70 s en moyenne), tiré au hasard à chaque fois (rules.mgEvery : un délai fixe en secondes ;
// 0 : jamais tout seul) ; seules les 5 dernières secondes s'affichent (la surprise)
export const MG_EVERY = [60, 80];
const NONE = { mx: 0, my: 0, held: 0, pressed: 0 };

export const ULTI_NAMES = { fps: 'Duel au pistolet', candy: 'Bagarre sucrée', horses: 'Tiercé de la pinte', moral: 'La bonne parole', dance: 'Danse kawaii', surgery: 'Bistouri bagarre' };
for (const [k, G] of Object.entries(EXTRA_GAMES)) ULTI_NAMES[k] = G.name;

// le prochain mini-jeu : un sac mélangé de tous les jeux (W.mgBag, dans l'état sauvegardé), où le duel au pistolet (et
// ses variantes) est FPS_WEIGHT fois, jamais le même deux fois de suite
export const FPS_WEIGHT = 3;
export function pickKind(W) {
  const kinds = Object.keys(GAMES);
  if (!W.mgBag || !W.mgBag.length) {
    // tirés un à un parmi ceux qui ne répètent pas le précédent (le dernier du sac part en premier : pop)
    const pool = kinds.slice(), bag = [];
    for (let k = 1; k < FPS_WEIGHT; k++) pool.push('fps');
    let prev = W.mgLast;
    while (pool.length) {
      // (trop de duels restants pour les séparer tous : on en place un tout de suite)
      const nf = pool.filter((k) => k === 'fps').length, must = prev !== 'fps' && nf * 2 > pool.length;
      const ok = pool.map((k, n) => n).filter((n) => (must ? pool[n] === 'fps' : pool[n] !== prev)), from = ok.length ? ok : pool.map((k, n) => n);
      prev = pool.splice(from[(W.rng() * from.length) | 0], 1)[0];
      bag.unshift(prev);
    }
    W.mgBag = bag;
  }
  W.mgLast = W.mgBag.pop();
  return W.mgLast;
}

export function minigamesOn(W) { return W.rules.minigames !== false && !W.mg && !W.mgResume && W.phase === 'play'; }

// le délai avant le prochain mini-jeu, en images (0 : jamais tout seul) : tiré à la première image de combat qui suit
// (W.mgNext, dans l'état sauvegardé), puis de nouveau après chaque mini-jeu
function mgDelay(W) {
  if (W.rules.mgEvery != null) return W.rules.mgEvery * 60;
  if (!W.mgNext) W.mgNext = W.rng.int(MG_EVERY[0] * 60, MG_EVERY[1] * 60);
  return W.mgNext;
}
// pour l'affichage : le nom du prochain mini-jeu (tiré d'avance), '' s'il ne l'est pas encore
export function mgNextName(W) {
  const k = W.mgNextKind;
  if (!k) return '';
  return k.startsWith('fps:') ? (DUEL_VARIANTS[+k.slice(4)] || DUEL_VARIANTS[0]).name : ULTI_NAMES[k] || '';
}
// pour l'affichage : les images avant le prochain mini-jeu, -1 s'il n'y en a pas de prévu
export function mgLeft(W) {
  if (W.rules.minigames === false || W.phase !== 'play' || W.mg || W.mgResume) return -1;
  const d = W.rules.mgEvery != null ? W.rules.mgEvery * 60 : W.mgNext;
  return d ? Math.max(0, d - W.mgClock) : -1;
}

// l'horloge des mini-jeux (une image de combat) : au bout du délai, deux combattants en jeu tirés au hasard
// s'affrontent ; si personne n'est disponible (un mort qui revient), on attend
export function tickMinigameClock(W) {
  if (!minigamesOn(W)) return;
  const every = mgDelay(W);
  if (!every) return;
  // le prochain jeu est tiré d'avance (et sa variante pour le duel) : le compte à rebours l'annonce
  if (!W.mgNextKind) { const k = pickKind(W); W.mgNextKind = k === 'fps' ? `fps:${nextDuelVariant(W)}` : k; }
  if (++W.mgClock < every) return;
  const free = W.list.filter((F) => !F.out && F.state !== 'dead' && F.state !== 'respawn');
  if (free.length < 2) return;
  const A = free[(W.rng() * free.length) | 0];
  let others = free.filter((F) => F !== A && (!W.rules.teams || F.team !== A.team));
  if (!others.length) others = free.filter((F) => F !== A);
  const V = others[(W.rng() * others.length) | 0];
  W.mgClock = 0;
  const kind = W.mgNextKind;
  W.mgNextKind = null;
  startMinigame(W, A.slot, V.slot, kind);
}

// --- déroulé -----------------------------------------------------------------------------------------------------
export function startMinigame(W, a, v, kind) {
  if (!minigamesOn(W)) return;
  // 'fps:3' : le duel au pistolet dans sa variante 3 (le menu des mini-jeux, les tests)
  let variant = -1;
  if (typeof kind === 'string' && kind.includes(':')) { variant = +kind.split(':')[1]; kind = kind.split(':')[0]; }
  let A = W.fighters[a], V = W.fighters[v];
  if (!A || !V || A === V || V.out) return;
  // à gauche (M.a, le joueur 0 de chaque jeu) : le joueur humain face à un CPU ; entre deux humains ou deux CPU, le plus
  // petit numéro (J1 avant J2), pour que chacun se retrouve toujours du même côté
  if ((A.bot && !V.bot) || (!A.bot === !V.bot && v < a)) { [a, v, A, V] = [v, a, V, A]; }
  kind = GAMES[kind] ? kind : pickKind(W);
  W.mgClock = 0; W.mgNext = 0;
  forceDuelVariant(variant);
  W.mg = { kind, a, v, ph: 'intro', t: 0, res: null, g: GAMES[kind].init(W, A, V) };
  forceDuelVariant(-1);
  W.slowT = 0;
  W.emit('mgStart', { k: kind, a, v });
}

// une image du mini-jeu (le reste du match est figé) ; inputs : { [slot]: {mx,my,held,pressed} }
export function stepMinigame(W, inputs) {
  const M = W.mg, G = GAMES[M.kind];
  M.t++;
  if (M.ph === 'intro') {
    if (M.t >= MG_INTRO) { M.ph = 'play'; M.t = 0; W.emit('mgGo', { k: M.kind }); }
    return;
  }
  if (M.ph === 'play') {
    const A = W.fighters[M.a], V = W.fighters[M.v];
    G.step(W, M, M.g, A.bot ? null : inputs[M.a] || NONE, V.bot ? null : inputs[M.v] || NONE);
    if (M.t >= MG_PLAY || M.g.over) {
      M.ph = 'outro'; M.t = 0;
      M.res = G.result(W, M, M.g);
      W.emit('mgEnd', { k: M.kind, ...M.res });
    }
    return;
  }
  if (M.t >= mgOutro(M)) finishMinigame(W);
}

// retour dans l'arène : tout reste figé MG_RESUME images (World.step appelle stepResume), puis le perdant prend ses %
// et un coup qui l'éjecte
function finishMinigame(W) {
  const M = W.mg, r = M.res || {};
  W.mg = null;
  const w = r.d > 0 ? r.w : -1, l = r.d > 0 ? r.l : -1;
  W.mgResume = { t: MG_RESUME, k: M.kind, w, l, d: r.d > 0 ? r.d : 0, kbb: r.kbb ?? 20, kbg: r.kbg ?? 190 };
  W.emit('mgOut', { k: M.kind, w, l, d: W.mgResume.d });
}

export function stepResume(W) {
  const R = W.mgResume;
  const L = R.l >= 0 ? W.fighters[R.l] : null, Wn = R.w >= 0 ? W.fighters[R.w] : null;
  // les coups de la facture, un à un : ses % montent dans le HUD du combat
  const e = MG_RESUME - R.t, n = HURT_AT.indexOf(e);
  if (L && Wn && n >= 0) {
    const d = Math.round(R.d * HURT_SHARE[n]) - (n ? Math.round(R.d * HURT_SHARE[n - 1]) : 0);
    L.damage = Math.min(999, L.damage + d); L.stats.taken += d; Wn.stats.dealt += d;
    W.emit('mgHurtHit', { w: R.w, l: R.l, d, n, last: n === HURT_AT.length - 1 ? 1 : 0 });
  }
  if (--R.t > 0) return;
  W.mgResume = null;
  if (L && Wn) W.hitDirect(Wn, L, { dmg: 0, ang: 50, kbb: R.kbb, kbg: R.kbg, dir: 'away', sfx: 'hitL', blood: 1.4, unblockable: true });
  W.emit('mgStrike', { k: R.k, w: R.w, l: R.l, d: R.d });
}


// Duel au pistolet (fps) et ses sept variantes : src/sim/mg/duel.js
export { DUEL, DUEL_VARIANTS, duelVar, duelEye, duelHead } from './mg/duel.js';

// =================================================================================================================
// Duel de bonbons : deux grilles de CW x CH. Une case vaut type (0..5) + 10 x pouvoir (1 citrouille, 2 crâne), -1 vide.
// États d'une grille : idle, swap (l'échange s'anime), back (échange raté, retour), clear (les bonbons fondent),
// fall (ils tombent). Chaque grille a son propre générateur (même graine au départ : même grille pour les deux).
export const CANDY = { W: 7, H: 7, TYPES: 6, SWAP: 5, CLEAR: 8, FALL: 7 };
const CW = CANDY.W, CH = CANDY.H, NT = CANDY.TYPES;

function crnd(b) { b.rs = (b.rs * 16807) % 2147483647; return b.rs / 2147483647; }
const typ = (v) => (v < 0 ? -1 : v % 10);

function makesLine(c, i) {
  const t = typ(c[i]);
  if (t < 0) return false;
  const x = i % CW, y = (i / CW) | 0;
  let n = 1;
  for (let k = x - 1; k >= 0 && typ(c[y * CW + k]) === t; k--) n++;
  for (let k = x + 1; k < CW && typ(c[y * CW + k]) === t; k++) n++;
  if (n >= 3) return true;
  n = 1;
  for (let k = y - 1; k >= 0 && typ(c[k * CW + x]) === t; k--) n++;
  for (let k = y + 1; k < CH && typ(c[k * CW + x]) === t; k++) n++;
  return n >= 3;
}

function fillBoard(b) {
  const c = b.c;
  for (let i = 0; i < CW * CH; i++) {
    let tries = 0;
    do { c[i] = (crnd(b) * NT) | 0; } while (makesLine(c, i) && ++tries < 20);
  }
  for (let i = 0; i < CW * CH; i++) b.drop[i] = CH;
}

function makeBoard(seed) {
  const b = { c: new Array(CW * CH).fill(-1), drop: new Array(CW * CH).fill(0), rs: seed, cx: 3, cy: 3, sel: -1, st: 'fall', t: 0,
    sw: [-1, -1], clr: [], chain: 0, score: 0, rep: 0, dir: 0, moves: 0, best: 0, bt: 40 };
  fillBoard(b);
  return b;
}

// les alignements : groupes d'indices (lignes puis colonnes) de 3 bonbons ou plus
function findGroups(c) {
  const out = [];
  for (let y = 0; y < CH; y++) {
    let x = 0;
    while (x < CW) {
      const t = typ(c[y * CW + x]);
      let e = x + 1;
      while (e < CW && t >= 0 && typ(c[y * CW + e]) === t) e++;
      if (t >= 0 && e - x >= 3) { const g = []; for (let k = x; k < e; k++) g.push(y * CW + k); out.push(g); }
      x = e;
    }
  }
  for (let x = 0; x < CW; x++) {
    let y = 0;
    while (y < CH) {
      const t = typ(c[y * CW + x]);
      let e = y + 1;
      while (e < CH && t >= 0 && typ(c[e * CW + x]) === t) e++;
      if (t >= 0 && e - y >= 3) { const g = []; for (let k = y; k < e; k++) g.push(k * CW + x); out.push(g); }
      y = e;
    }
  }
  return out;
}

// les échanges qui alignent quelque chose : [i, j, longueur du plus long alignement]
export function candyMoves(c) {
  const out = [];
  const tryPair = (i, j) => {
    if (c[i] < 0 || c[j] < 0 || typ(c[i]) === typ(c[j])) return;
    const a = c[i]; c[i] = c[j]; c[j] = a;
    if (makesLine(c, i) || makesLine(c, j)) {
      let best = 3;
      for (const g of findGroups(c)) if (g.includes(i) || g.includes(j)) best = Math.max(best, g.length);
      out.push([i, j, best]);
    }
    c[j] = c[i]; c[i] = a;
  };
  for (let i = 0; i < CW * CH; i++) {
    if (i % CW < CW - 1) tryPair(i, i + 1);
    if (i + CW < CW * CH) tryPair(i, i + CW);
  }
  return out;
}

function trySwap(W, b, slot, i, j) {
  if (b.st !== 'idle' || i < 0 || j < 0 || i >= CW * CH || j >= CW * CH) return;
  const a = b.c[i]; b.c[i] = b.c[j]; b.c[j] = a;
  b.sw = [i, j]; b.st = 'swap'; b.t = 0; b.sel = -1; b.chain = 0; b.moves++;
  b.cx = j % CW; b.cy = (j / CW) | 0;
  W.emit('mgSwap', { p: slot });
}

function resolve(W, b, slot, groups) {
  const set = new Set();
  for (const g of groups) for (const i of g) set.add(i);
  // une citrouille (4 alignés) ou un crâne (5 et plus) naît à la place de l'échange, sinon au milieu du groupe
  const keep = new Map();
  for (const g of groups) {
    if (g.length < 4) continue;
    const at = g.includes(b.sw[1]) ? b.sw[1] : g.includes(b.sw[0]) ? b.sw[0] : g[g.length >> 1];
    if (!keep.has(at)) keep.set(at, typ(b.c[at]) + 10 * (g.length >= 5 ? 2 : 1));
  }
  // les pouvoirs pris dans l'alignement explosent (et peuvent en faire exploser d'autres)
  const queue = [...set];
  let boom = 0;
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q], p = (b.c[i] / 10) | 0;
    if (p <= 0 || keep.has(i)) continue;
    boom++;
    const x = i % CW, y = (i / CW) | 0, area = [];
    if (p === 1) { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && X < CW && Y >= 0 && Y < CH) area.push(Y * CW + X); } }
    else { for (let k = 0; k < CW; k++) area.push(y * CW + k); for (let k = 0; k < CH; k++) area.push(k * CW + x); }
    for (const j of area) if (!set.has(j) && b.c[j] >= 0) { set.add(j); queue.push(j); }
  }
  let pts = 0, inLines = 0;
  for (const g of groups) { pts += g.length === 3 ? 60 : g.length === 4 ? 120 : 200; inLines += g.length; }
  pts += Math.max(0, set.size - inLines) * 20;
  pts *= 1 + b.chain;
  b.score += pts;
  b.clr = [...set].filter((i) => !keep.has(i)).sort((p, q) => p - q);
  for (const [i, v] of keep) b.c[i] = v;
  b.st = 'clear'; b.t = 0;
  W.emit('mgCandy', { p: slot, n: set.size, ch: b.chain, pts, boom, pw: keep.size });
}

function gravity(b) {
  for (let i = 0; i < CW * CH; i++) b.drop[i] = 0;
  for (const i of b.clr) b.c[i] = -1;
  b.clr = [];
  for (let x = 0; x < CW; x++) {
    let w = CH - 1;
    for (let y = CH - 1; y >= 0; y--) {
      const v = b.c[y * CW + x];
      if (v < 0) continue;
      if (w !== y) { b.c[w * CW + x] = v; b.c[y * CW + x] = -1; }
      b.drop[w * CW + x] = w - y;
      w--;
    }
    const n = w + 1;
    for (let y = w; y >= 0; y--) { b.c[y * CW + x] = (crnd(b) * NT) | 0; b.drop[y * CW + x] = n; }
  }
}

function stepBoard(W, b, slot, I, lvl) {
  // --- commandes (humain) ou CPU
  if (I) {
    const ax = I.mx > 0.5 ? 1 : I.mx < -0.5 ? -1 : 0, ay = I.my > 0.5 ? -1 : I.my < -0.5 ? 1 : 0;
    const dir = Math.abs(I.mx) >= Math.abs(I.my) ? (ax ? 1 + (ax > 0 ? 0 : 1) : 0) : ay ? 3 + (ay > 0 ? 0 : 1) : 0; // 1 droite 2 gauche 3 bas 4 haut
    let act = false;
    if (!dir) { b.dir = 0; b.rep = 0; }
    else if (dir !== b.dir) { b.dir = dir; b.rep = 11; act = true; }
    else if (--b.rep <= 0) { b.rep = 4; act = true; }
    if (act) {
      const dx = dir === 1 ? 1 : dir === 2 ? -1 : 0, dy = dir === 3 ? 1 : dir === 4 ? -1 : 0;
      const nx = b.cx + dx, ny = b.cy + dy;
      if (nx >= 0 && nx < CW && ny >= 0 && ny < CH) {
        // un bonbon pris : la direction l'échange avec son voisin
        if (b.sel >= 0 && b.st === 'idle') { const sx = b.sel % CW, sy = (b.sel / CW) | 0; const tx = sx + dx, ty = sy + dy; if (tx >= 0 && tx < CW && ty >= 0 && ty < CH) trySwap(W, b, slot, b.sel, ty * CW + tx); }
        else { b.cx = nx; b.cy = ny; if (b.sel >= 0) b.sel = -1; }
      }
    }
    // (A ou X seulement : à la manette, un coup de stick vers le haut compte comme un saut, il prendrait des bonbons tout seul)
    if (I.pressed & (BTN.A | BTN.X)) {
      const cur = b.cy * CW + b.cx;
      if (b.sel === cur) b.sel = -1;
      else if (b.sel >= 0 && b.st === 'idle' && Math.abs(b.sel % CW - b.cx) + Math.abs(((b.sel / CW) | 0) - b.cy) === 1) trySwap(W, b, slot, b.sel, cur);
      else { b.sel = cur; W.emit('mgPick', { p: slot }); }
    }
  } else if (b.st === 'idle' && --b.bt <= 0) {
    // (le générateur du match, pas celui de la grille : deux CPU sur la même grille ne jouent pas pareil)
    const mv = candyMoves(b.c);
    if (mv.length) {
      let m = mv[(W.rng() * mv.length) | 0];
      if (lvl >= 3 || W.rng() < 0.4) for (const o of mv) if (o[2] > m[2]) m = o;
      trySwap(W, b, slot, m[0], m[1]);
    }
    b.bt = [44, 32, 22][lvl - 1] + ((W.rng() * 12) | 0);
  }
  // --- résolution
  b.t++;
  if (b.st === 'swap' && b.t >= CANDY.SWAP) {
    const g = findGroups(b.c);
    if (g.length) resolve(W, b, slot, g);
    else { const [i, j] = b.sw, a = b.c[i]; b.c[i] = b.c[j]; b.c[j] = a; b.st = 'back'; b.t = 0; W.emit('mgNope', { p: slot }); }
  } else if (b.st === 'back' && b.t >= CANDY.SWAP) { b.st = 'idle'; b.t = 0; }
  else if (b.st === 'clear' && b.t >= CANDY.CLEAR) { gravity(b); b.st = 'fall'; b.t = 0; }
  else if (b.st === 'fall' && b.t >= CANDY.FALL) {
    for (let i = 0; i < CW * CH; i++) b.drop[i] = 0;
    const g = findGroups(b.c);
    if (g.length) { b.chain++; b.sw = [-1, -1]; resolve(W, b, slot, g); }
    else {
      b.best = Math.max(b.best, b.chain); b.chain = 0; b.st = 'idle'; b.t = 0;
      if (!candyMoves(b.c).length) { fillBoard(b); b.st = 'fall'; W.emit('mgShuffle', { p: slot }); }
    }
  }
}

const candy = {
  init(W) {
    const seed = 1 + ((W.rng() * 2147483645) | 0);
    return { b: [makeBoard(seed), makeBoard(seed)], over: 0 };
  },
  step(W, M, g, ia, iv) {
    stepBoard(W, g.b[0], M.a, ia, W.fighters[M.a].bot || 2);
    stepBoard(W, g.b[1], M.v, iv, W.fighters[M.v].bot || 2);
  },
  result(W, M, g) {
    const sa = g.b[0].score, sv = g.b[1].score;
    if (sa === sv) return { w: -1, l: -1, d: 0, sa, sv };
    const w = sa > sv ? M.a : M.v, l = sa > sv ? M.v : M.a;
    const d = Math.round(clampN(12 + Math.abs(sa - sv) / 40, 12, 65));
    return payout(W, w, l, d, { sa, sv, kbb: 16, kbg: 170 });
  },
};


// =================================================================================================================
// Tiercé de la pinte : quatre chevaux à la télé. Pari (PICK images au plus) : stick gauche / droite, A pour valider (deux
// joueurs ne prennent pas le même). Course (TRACK mètres) : A = un coup de cravache (le cheval accélère ; trop vite, il
// s'emballe et s'arrête un moment : la chaleur), X = une gorgée de pinte (turbo, puis un hoquet où la cravache ne sert à
// rien ; SIPS gorgées). Les deux autres chevaux courent seuls. Le premier des deux chevaux pariés gagne.
export const HORSES = {
  PICK: 100, TRACK: 60, SIPS: 3, TURBO: 40, HIC: 18, GATE: 30,
  NAMES: ['Kebab Express', 'Tonnerre Mou', 'Pinte Royale', 'Gros Mollet'],
  COLORS: ['#d83a3a', '#3a8bff', '#f0c020', '#3cc85a'],
};

const horses = {
  init(W) {
    const H = [];
    for (let i = 0; i < 4; i++) {
      const q = (W.rng() - 0.5) * 0.6; // forme du jour (la cote)
      H.push({ q, odds: Math.max(2, Math.round(5 - q * 6)), pos: 0, v: 0, tv: 7.6, heat: 0, stum: 0, turbo: 0, hic: 0, fin: 0, whip: 0 });
    }
    const pl = () => ({ cur: 0, pick: -1, sips: HORSES.SIPS, armed: 1, bt: 0, sip: 0 });
    const p = [pl(), pl()]; p[1].cur = 3;
    return { ph: 'pick', t: 0, H, p, over: 0, endT: 0, lead: -1 };
  },

  step(W, M, g, ia, iv) {
    g.t++;
    const ins = [ia, iv];
    if (g.ph === 'pick') {
      for (let i = 0; i < 2; i++) {
        const P = g.p[i], O = g.p[1 - i];
        if (P.pick >= 0) continue;
        let I = ins[i];
        if (!I) { // CPU : regarde un peu, puis prend un cheval libre au hasard
          if (!P.bt) P.bt = 25 + (W.rng() * 40 | 0);
          I = { mx: 0, my: 0, held: 0, pressed: 0 };
          if (g.t >= P.bt) { let c = (W.rng() * 4) | 0; if (c === O.pick) c = (c + 1) % 4; P.cur = c; I.pressed = BTN.A; }
        }
        const sx = I.mx > 0.6 ? 1 : I.mx < -0.6 ? -1 : 0;
        if (!sx) P.armed = 1;
        else if (P.armed) { P.armed = 0; P.cur = (P.cur + sx + 4) % 4; W.emit('mgPick', { p: i }); }
        if ((I.pressed & (BTN.A | BTN.X)) && P.cur !== O.pick) { P.pick = P.cur; W.emit('mgBet', { p: i, h: P.cur }); }
      }
      if ((g.p[0].pick >= 0 && g.p[1].pick >= 0) || g.t >= HORSES.PICK) {
        for (let i = 0; i < 2; i++) {
          const P = g.p[i], O = g.p[1 - i];
          if (P.pick < 0) { let c = P.cur; if (c === O.pick) c = (c + 1) % 4; P.pick = c; W.emit('mgBet', { p: i, h: c }); }
        }
        g.ph = 'race'; g.t = 0;
        W.emit('mgRace', {});
      }
      return;
    }
    if (g.t < HORSES.GATE) return; // « À vos marques... »
    if (g.t === HORSES.GATE) W.emit('mgGate', {});
    // les joueurs : cravache et pinte
    for (let i = 0; i < 2; i++) {
      const P = g.p[i], h = g.H[P.pick];
      let I = ins[i];
      if (!I) I = horseBot(W, g, i, W.fighters[i === 0 ? M.a : M.v].bot || 2);
      if ((I.pressed & BTN.A) && !h.fin) {
        if (h.hic > 0 || h.stum > 0) { /* hoquet ou cheval arrêté : rien */ }
        else {
          h.v += 0.55; h.heat += 0.2; h.whip = 8;
          W.emit('mgWhip', { p: i });
          if (h.heat >= 1) { h.stum = 45; h.heat = 0; W.emit('mgBolt', { p: i, h: P.pick }); }
        }
      }
      if ((I.pressed & BTN.X) && P.sips > 0 && !h.turbo && !h.fin) { P.sips--; h.turbo = HORSES.TURBO; P.sip = 30; W.emit('mgSip', { p: i, n: P.sips }); }
      if (P.sip > 0) P.sip--;
    }
    // les chevaux
    let lead = -1, lp = -1;
    for (let k = 0; k < 4; k++) {
      const h = g.H[k];
      if (h.fin) continue;
      if (g.t % 24 === k * 6 % 24) h.tv = 7.4 + h.q + W.rng() * 1.6;
      if (h.heat > 0) h.heat = Math.max(0, h.heat - 0.018);
      if (h.whip > 0) h.whip--;
      let tv = h.tv;
      if (h.turbo > 0) { tv += 4; if (--h.turbo === 0) h.hic = HORSES.HIC; }
      else if (h.hic > 0) h.hic--;
      if (h.stum > 0) { h.stum--; tv *= 0.25; }
      h.v += (tv - h.v) * 0.05;
      h.pos += h.v / 60;
      if (h.pos >= HORSES.TRACK) { h.pos = HORSES.TRACK; h.fin = g.t; W.emit('mgFinish', { h: k, mine: g.p[0].pick === k ? 0 : g.p[1].pick === k ? 1 : -1 }); }
    }
    for (let k = 0; k < 4; k++) if (g.H[k].pos > lp) { lp = g.H[k].pos; lead = k; }
    if (lead !== g.lead && g.t > HORSES.GATE + 20) { g.lead = lead; W.emit('mgLead', { h: lead }); }
    if (!g.endT && g.H[g.p[0].pick].fin && g.H[g.p[1].pick].fin) g.endT = 40;
    if (g.endT && --g.endT <= 0) g.over = 1;
  },

  result(W, M, g) {
    const a = g.H[g.p[0].pick], b = g.H[g.p[1].pick];
    const ka = a.fin || 1e9, kb = b.fin || 1e9;
    let w = -1;
    if (ka !== kb) w = ka < kb ? 0 : 1;
    else if (a.pos !== b.pos) w = a.pos > b.pos ? 0 : 1;
    if (w < 0) return payout(W, -1, -1, 0);
    const slots = [M.a, M.v];
    return payout(W, slots[w], slots[1 - w], W.rng.int(35, 70), { hw: g.p[w].pick, kbb: 20, kbg: 190 });
  },
};

function horseBot(W, g, i, lvl) {
  const P = g.p[i], h = g.H[P.pick], I = { mx: 0, my: 0, held: 0, pressed: 0 };
  const rate = [16, 12, 9][lvl - 1] || 12;
  if (g.t % rate === i * 3 % rate && h.heat < [0.85, 0.7, 0.6][lvl - 1] && W.rng() < 0.9) I.pressed |= BTN.A;
  const O = g.H[g.p[1 - i].pick];
  if (P.sips > 0 && !h.turbo && !h.hic && O.pos > h.pos - 2 && W.rng() < 0.012 * lvl) I.pressed |= BTN.X;
  return I;
}

// =================================================================================================================
// La bonne parole : chacun sa suite de questions (la même pour les deux, tirée au début), une bonne et une mauvaise
// réponse, gauche ou droite au stick. Bonne réponse : +1 et question suivante ; mauvaise : question suivante, mais
// bloqué WRONG images. Chaque bonne réponse fait baisser la haine dans le monde (à l'écran).
export const MORAL = { WRONG: 30 };
export const QUESTIONS = [
  ['Une mamie veut traverser', 'Tu l\'aides', 'Tu klaxonnes'],
  ['Ton pote a raté son gâteau', 'Tu en reprends', 'Tu le donnes au chat'],
  ['Quelqu\'un est seul à la soirée', 'Tu vas lui parler', 'Tu le filmes'],
  ['Tu trouves un portefeuille', 'Tu le rends', 'Tu payes ta tournée avec'],
  ['Un troll t\'insulte en ligne', 'Tu vis ta vie', 'Tu y passes la nuit'],
  ['Ton voisin fait la fête à 3 h', 'Tu toques poliment', 'Tu coupes son courant'],
  ['Quelqu\'un double dans la file', 'Tu lui dis gentiment', 'Tu le doubles aussi'],
  ['Nymano pleure encore', 'Tu lui fais un câlin', 'Tu glisses sur ses larmes'],
  ['Le serveur se trompe de plat', 'Pas grave, merci !', 'Avis à une étoile'],
  ['Il reste une part de pizza', 'Tu la partages', 'Tu lèches la part'],
  ['Ton adversaire tombe', 'Tu l\'aides à se relever', 'Tu fais un dab'],
  ['Un inconnu te sourit', 'Tu souris aussi', 'Tu appelles la police'],
  ['Tu casses un verre chez un ami', 'Tu le dis', 'Tu caches les morceaux'],
  ['Ton coloc a fini le lait', 'Tu en rachètes', 'Ses chaussettes au frigo'],
  ['Une araignée dans la maison', 'Tu la sors dehors', 'Tu brûles la maison'],
  ['Ton pote chante faux', 'Tu chantes avec lui', 'Tu coupes le micro'],
  ['Un enfant perd son ballon', 'Tu le lui renvoies', 'Tu le crèves'],
  ['On te prête un livre', 'Tu le rends', 'Tu le revends'],
  ['Ton équipe perd', 'GG, on rejoue', 'Tu ragequit'],
  ['Quelqu\'un a froid', 'Tu prêtes ta veste', 'Tu ouvres la fenêtre'],
  ['Ta mamie t\'appelle', 'Tu décroches', 'Mode silencieux'],
  ['Ton pote te bat à la Bagarre', 'Tu le félicites', 'Tu débranches la manette'],
  ['Un oiseau est blessé', 'Tu le soignes', 'Tu le donnes au chat'],
  ['Il pleut, un passant est trempé', 'Tu partages ton parapluie', 'Tu sautes dans la flaque'],
  ['Tu marches sur un pied', 'Pardon !', 'C\'est lui qui a commencé'],
  ['La caissière est fatiguée', 'Bonjour, merci !', 'Tu payes en centimes'],
  ['Ton voisin déménage', 'Tu portes des cartons', 'Tu prends sa place de parking'],
  ['Une rumeur court sur un pote', 'Tu l\'arrêtes net', 'Tu en rajoutes'],
  ['Quelqu\'un fait tomber ses courses', 'Tu ramasses avec lui', 'Tu prends une pomme'],
  ['La haine monte sur internet', 'Tu postes un chat mignon', 'Tu rajoutes une couche'],
  ['Ton ennemi juré a faim', 'Tu partages ton sandwich', 'Tu manges devant lui'],
  ['Un bébé pleure dans le train', 'Tu fais des grimaces', 'Tu soupires très fort'],
  ['Ton pote a une nouvelle coupe', 'Elle te va bien !', 'Tu ris dix minutes'],
  ['On te tient la porte', 'Merci !', 'Tu passes sans regarder'],
  ['Il reste un ticket de concert', 'Tu l\'offres', 'Tu le revends le double'],
  ['Ton chat a vomi sur le tapis', 'Tu nettoies', 'Tu accuses le coloc'],
  ['Le prof se trompe au tableau', 'Tu le dis gentiment', 'Tu prends une photo'],
  ['Un touriste est perdu', 'Tu lui montres le chemin', 'Tu l\'envoies à l\'opposé'],
];

const moral = {
  init(W) {
    const n = QUESTIONS.length, order = [];
    for (let i = 0; i < n; i++) order.push(i);
    for (let i = n - 1; i > 0; i--) { const j = (W.rng() * (i + 1)) | 0; const t = order[i]; order[i] = order[j]; order[j] = t; }
    const sides = order.map(() => (W.rng() < 0.5 ? 0 : 1)); // 0 : la bonne réponse à gauche
    const pl = () => ({ i: 0, score: 0, wrong: 0, streak: 0, lock: 0, armed: 1, bt: 0, last: -1, lastT: 0 });
    return { order, sides, p: [pl(), pl()], over: 0 };
  },

  step(W, M, g, ia, iv) {
    const ins = [ia, iv];
    for (let i = 0; i < 2; i++) {
      const P = g.p[i];
      if (P.lock > 0) { P.lock--; continue; }
      if (P.i >= g.order.length) continue;
      const good = g.sides[P.i];
      let choice = -1;
      const I = ins[i];
      if (I) {
        const sx = I.mx > 0.6 ? 1 : I.mx < -0.6 ? -1 : 0;
        if (!sx) P.armed = 1;
        else if (P.armed) { P.armed = 0; choice = sx < 0 ? 0 : 1; }
      } else { // CPU : réfléchit un peu, se trompe parfois
        const lvl = W.fighters[i === 0 ? M.a : M.v].bot || 2;
        if (!P.bt) P.bt = [46, 34, 26][lvl - 1] + (W.rng() * 18 | 0);
        if (--P.bt <= 0) { P.bt = 0; choice = W.rng() < [0.72, 0.82, 0.92][lvl - 1] ? good : 1 - good; }
      }
      if (choice < 0) continue;
      const ok = choice === good;
      P.last = ok ? 1 : 0; P.lastT = M.t;
      if (ok) { P.score++; P.streak++; }
      else { P.wrong++; P.streak = 0; P.lock = MORAL.WRONG; }
      W.emit('mgAnswer', { p: i, ok: ok ? 1 : 0, streak: P.streak });
      P.i++;
    }
  },

  result(W, M, g) {
    const [a, b] = g.p;
    if (a.score === b.score) return payout(W, -1, -1, 0, { sa: a.score, sv: b.score });
    const w = a.score > b.score ? 0 : 1, slots = [M.a, M.v];
    return payout(W, slots[w], slots[1 - w], clampN(20 + 6 * Math.abs(a.score - b.score), 20, 70), { sa: a.score, sv: b.score, kbb: 18, kbg: 180 });
  },
};

// =================================================================================================================
// Danse kawaii : la même suite de flèches pour les deux (tirée au début), quatre couloirs (gauche, bas, haut, droite).
// Une flèche arrive sur la ligne à son image n.t ; le stick poussé dans sa direction (un coup sec, il faut revenir au
// centre entre deux) la juge : à PERFECT images près parfait, GREAT super, GOOD bien, au-delà ratée. Un coup dans le vide
// coûte un peu. Le combo multiplie les points (jusqu'à x3).
export const DANCE = { BEAT: 24, PERFECT: 3, GREAT: 6, GOOD: 10, PTS: [0, 100, 60, 30], LANES: 4 };

const dance = {
  init(W) {
    const notes = [];
    let last = -1;
    for (let t = DANCE.BEAT * 2; t < MG_PLAY - 20; t += DANCE.BEAT / 2) {
      const on = t % DANCE.BEAT === 0;
      if (!on && W.rng() > 0.25 + 0.45 * t / MG_PLAY) continue; // de plus en plus de croches
      let lane = (W.rng() * 4) | 0;
      if (lane === last) lane = (lane + 1 + ((W.rng() * 3) | 0)) % 4;
      last = lane;
      notes.push([t, lane]);
    }
    const pl = () => ({ score: 0, combo: 0, maxc: 0, armed: 1, hit: notes.map(() => 0), bo: notes.map(() => 0), bh: notes.map(() => 1), counts: [0, 0, 0, 0, 0] });
    const p = [pl(), pl()];
    return { notes, p, over: 0, inited: 0 };
  },

  step(W, M, g, ia, iv) {
    if (!g.inited) {
      // les CPU : un décalage et une réussite par flèche (tirés ici : on connaît enfin leur niveau)
      g.inited = 1;
      [M.a, M.v].forEach((slot, i) => {
        const F = W.fighters[slot];
        if (!F.bot) return;
        const lvl = F.bot || 2, P = g.p[i];
        for (let k = 0; k < g.notes.length; k++) {
          P.bo[k] = Math.round((W.rng() - 0.5) * 2 * [7, 5, 3][lvl - 1]);
          P.bh[k] = W.rng() < [0.72, 0.85, 0.95][lvl - 1] ? 1 : 0;
        }
      });
    }
    const ins = [ia, iv];
    for (let i = 0; i < 2; i++) {
      const P = g.p[i], I = ins[i];
      // les flèches passées sans être jugées : ratées
      for (let k = 0; k < g.notes.length; k++) {
        const n = g.notes[k];
        if (n[0] > M.t) break;
        if (!P.hit[k] && M.t - n[0] > DANCE.GOOD) { P.hit[k] = 4; P.counts[4]++; if (P.combo >= 5) W.emit('mgBreak', { p: i, c: P.combo }); P.combo = 0; W.emit('mgStep', { p: i, k, g: 4, lane: n[1] }); }
      }
      let lane = -1;
      if (I) {
        const ax = Math.abs(I.mx), ay = Math.abs(I.my);
        if (ax < 0.35 && ay < 0.35) P.armed = 1;
        else if (P.armed && Math.max(ax, ay) > 0.6) { P.armed = 0; lane = ax >= ay ? (I.mx < 0 ? 0 : 3) : (I.my < 0 ? 1 : 2); }
      } else {
        for (let k = 0; k < g.notes.length; k++) { const n = g.notes[k]; if (n[0] + P.bo[k] === M.t && P.bh[k] && !P.hit[k]) { lane = n[1]; break; } if (n[0] > M.t + 10) break; }
      }
      if (lane < 0) continue;
      let best = -1, bd = 99;
      for (let k = 0; k < g.notes.length; k++) {
        const n = g.notes[k];
        if (n[1] !== lane || P.hit[k]) continue;
        const d = Math.abs(n[0] - M.t);
        if (d <= DANCE.GOOD && d < bd) { bd = d; best = k; }
        if (n[0] > M.t + DANCE.GOOD) break;
      }
      if (best < 0) { P.score = Math.max(0, P.score - 10); W.emit('mgStep', { p: i, k: -1, g: 0, lane }); continue; }
      const grade = bd <= DANCE.PERFECT ? 1 : bd <= DANCE.GREAT ? 2 : 3;
      P.hit[best] = grade; P.counts[grade]++;
      P.combo++; P.maxc = Math.max(P.maxc, P.combo);
      P.score += Math.round(DANCE.PTS[grade] * (1 + Math.min(P.combo, 40) / 20));
      W.emit('mgStep', { p: i, k: best, g: grade, lane, c: P.combo });
    }
  },

  result(W, M, g) {
    const [a, b] = g.p;
    if (a.score === b.score) return payout(W, -1, -1, 0, { sa: a.score, sv: b.score });
    const w = a.score > b.score ? 0 : 1, slots = [M.a, M.v];
    return payout(W, slots[w], slots[1 - w], Math.round(clampN(15 + Math.abs(a.score - b.score) / 30, 15, 70)), { sa: a.score, sv: b.score, kbb: 18, kbg: 180 });
  },
};

// =================================================================================================================
// Bistouri bagarre : chacun opère l'autre (le même corps, les mêmes objets coincés). Le plateau mesure 100 x 62 ; la
// pince va au stick (ou à la souris pour Clavier 1, voir Input.setDuel). Sur un objet, A tenu le tire : la pince tremble
// (de plus en plus à chaque objet) ; tant qu'elle reste dans le trou (rayon rin) ça avance, entre rin et le bord (rw)
// ça avance moins, au-delà du bord : BZZZT (sonné STUN images, des points en moins, l'objet reste).
export const SURGERY = { W: 100, H: 62, PULL: 44, STUN: 22, ITEMS: 6, SPEED: 60 };
const SURG_SPOTS = [[50, 14], [34, 26], [66, 26], [50, 34], [38, 48], [62, 48], [22, 40], [78, 40]];

const surgery = {
  init(W) {
    const spots = SURG_SPOTS.map((p) => p.slice());
    for (let i = spots.length - 1; i > 0; i--) { const j = (W.rng() * (i + 1)) | 0; const t = spots[i]; spots[i] = spots[j]; spots[j] = t; }
    const cav = [];
    for (let i = 0; i < SURGERY.ITEMS; i++) {
      const rw = 3.2 + W.rng() * 1.6;
      cav.push({ x: spots[i][0] + (W.rng() - 0.5) * 4, y: spots[i][1] + (W.rng() - 0.5) * 3, rw, rin: rw * 0.55, item: (W.rng() * 12) | 0 });
    }
    const pl = () => ({ x: 50, y: 58, vx: 0, vy: 0, kh: 0, hold: -1, prog: 0, clean: 1, stun: 0, score: 0, done: 0, zaps: 0, got: cav.map(() => 0), tf: [0, 0], tt: 0, bt: 0, bx: 0, by: 0, bk: 0 });
    return { cav, p: [pl(), pl()], over: 0 };
  },

  step(W, M, g, ia, iv) {
    const ins = [ia, iv];
    for (let i = 0; i < 2; i++) {
      const P = g.p[i];
      let I = ins[i] || surgeryBot(W, g, i, W.fighters[i === 0 ? M.a : M.v].bot || 2);
      if (P.stun > 0) { P.stun--; continue; }
      // la pince : au stick une vitesse, à la souris un déplacement
      if (I.held & MOUSE) {
        P.x += I.mx * 4.5; P.y -= I.my * 4.5;
        const bx = ((I.held & MV_R) ? 1 : 0) - ((I.held & MV_L) ? 1 : 0);
        P.x += bx * 0.6;
      } else {
        // au clavier (tout ou rien) : la pince part doucement puis accélère (une touche tapée = un petit pas), plus lente en
        // tirant, pour viser le trou et corriger le tremblement
        let sp = SURGERY.SPEED;
        if (I.held & DIGITAL) { P.kh = I.mx || I.my ? P.kh + 1 : 0; sp *= Math.min(1, 0.25 + P.kh / 20) * (P.hold >= 0 ? 0.4 : 0.75); }
        const s = (v) => v * Math.abs(v) * 0.6 + v * 0.4;
        P.vx += (s(I.mx) * sp - P.vx) * 0.3; P.vy += (-s(I.my) * sp - P.vy) * 0.3;
        P.x += P.vx / 60; P.y += P.vy / 60;
      }
      // le tremblement pendant qu'on tire
      if (P.hold >= 0) {
        if (--P.tt <= 0) { const a = W.rng() * Math.PI * 2, f = 7 + P.done * 3.5; P.tf = [Math.cos(a) * f, Math.sin(a) * f]; P.tt = 8 + (W.rng() * 10 | 0); }
        P.x += P.tf[0] / 60; P.y += P.tf[1] / 60;
      }
      P.x = clampN(P.x, 0, SURGERY.W); P.y = clampN(P.y, 0, SURGERY.H);
      if (P.hold < 0) {
        if (I.pressed & BTN.A) {
          for (let k = 0; k < g.cav.length; k++) {
            const c = g.cav[k];
            if (P.got[k]) continue;
            if (Math.hypot(P.x - c.x, P.y - c.y) < c.rin) { P.hold = k; P.prog = 0; P.clean = 1; P.tt = 0; W.emit('mgGrab', { p: i, k }); break; }
          }
        }
        continue;
      }
      const c = g.cav[P.hold], d = Math.hypot(P.x - c.x, P.y - c.y);
      if (d > c.rw) {
        P.stun = SURGERY.STUN; P.score = Math.max(0, P.score - 40); P.zaps++;
        W.emit('mgZap', { p: i, k: P.hold, x: P.x, y: P.y });
        P.hold = -1; P.prog = 0;
        continue;
      }
      if (!(I.held & BTN.A)) { W.emit('mgDrop', { p: i, k: P.hold }); P.hold = -1; P.prog = 0; continue; }
      if (d > c.rin) P.clean = 0;
      P.prog += d <= c.rin ? 1 : 0.4;
      if (P.prog >= SURGERY.PULL) {
        P.got[P.hold] = 1; P.done++;
        const pts = 100 + (P.clean ? 50 : 0);
        P.score += pts;
        W.emit('mgPull', { p: i, k: P.hold, pts, clean: P.clean, n: P.done });
        P.hold = -1; P.prog = 0;
        if (P.done >= g.cav.length) g.over = 1;
      }
    }
  },

  result(W, M, g) {
    const [a, b] = g.p;
    if (a.score === b.score) return payout(W, -1, -1, 0, { sa: a.score, sv: b.score });
    const w = a.score > b.score ? 0 : 1, slots = [M.a, M.v];
    return payout(W, slots[w], slots[1 - w], Math.round(clampN(15 + Math.abs(a.score - b.score) / 8, 15, 70)), { sa: a.score, sv: b.score, kbb: 18, kbg: 180 });
  },
};

// CPU chirurgien : va au plus proche des objets restants, tire en corrigeant le tremblement (plus ou moins bien)
function surgeryBot(W, g, i, lvl) {
  const P = g.p[i], I = { mx: 0, my: 0, held: 0, pressed: 0 };
  if (!P.bk) P.bk = 0.65 + W.rng() * 0.7; // l'adresse de ce CPU (deux CPU ne jouent pas pareil)
  let k = P.hold, best = 1e9;
  if (k < 0) for (let j = 0; j < g.cav.length; j++) { if (P.got[j]) continue; const d = Math.hypot(P.x - g.cav[j].x, P.y - g.cav[j].y); if (d < best) { best = d; k = j; } }
  if (k < 0) return I;
  const c = g.cav[k];
  if (--P.bt <= 0) { P.bx = (W.rng() - 0.5) * [2.4, 1.4, 0.7][lvl - 1]; P.by = (W.rng() - 0.5) * [2.4, 1.4, 0.7][lvl - 1]; P.bt = 12 + (W.rng() * 12 | 0); }
  const ex = c.x + P.bx - P.x, ey = c.y + P.by - P.y, gain = (P.hold >= 0 ? [0.12, 0.2, 0.32][lvl - 1] : 0.09) * P.bk;
  I.mx = clampN(ex * gain, -1, 1); I.my = clampN(-ey * gain, -1, 1);
  if (P.hold >= 0) I.held |= BTN.A;
  else if (Math.hypot(ex, ey) < c.rin * 0.7 && W.rng() < 0.3) { I.pressed |= BTN.A; I.held |= BTN.A; }
  return I;
}

const GAMES = { fps: duel, candy, horses, moral, dance, surgery, ...EXTRA_GAMES };
