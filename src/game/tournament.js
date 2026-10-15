// The tournament mode: single elimination duels (stock matches), humans only, 2 to 16 players, local (names, the pads
// passed around) or online (each machine brings its players, everybody watches the duel). This file is the bracket
// itself, without display: plain data (it travels in the lobby, src/game/session.js), and the functions that change
// it. The screens are in src/ui/tournament.js.
//
// Bracket: the next power of two above the player count; the drawn order fills the seeds and the classic seeding
// spreads the byes (a bye is the top seed's first round, never two byes in a match). Winners go up the tree; the two
// semi-final losers play the small final (3rd place) before the final when it is on.

export const MAX_PLAYERS = 16;
// one comic color per player (the plates of the bracket, the podium)
export const PCOLORS = ['#ff3b3b', '#3b8bff', '#ffd23b', '#3bdc5a', '#ff7ad9', '#9d6bff', '#ff9a3c', '#38e0d0',
  '#c8ff3a', '#ff5a8a', '#5ad1ff', '#e8c08a', '#c8c0e8', '#ff3bf0', '#7aff9a', '#ffb0a0'];

export const DEFAULT_RULES = { stocks: 3, stage: 'random', hazards: true, minigames: false, third: true };

// funny names when nobody typed one
export const FUN_NAMES = ['Le Boucher', 'Mamie Zombie', 'Gros Tonton', 'Le Fantôme', 'Bébé Requin', 'La Momie', 'Croque-Mort',
  'Le Vampire', 'Capitaine Os', 'Madame Crâne', 'Le Revenant', 'Petit Cadavre', 'La Goule', 'Le Rat', 'Le Squelette', 'Big Pépé'];

export function newTournament(rules = {}) {
  return { phase: 'setup', players: [], rules: { ...DEFAULT_RULES, ...rules }, size: 0, rounds: [], third: null, cur: null, seq: 0, last: null, order: [] };
}

export function addPlayer(T, name, owner = 'host') {
  if (T.phase !== 'setup' || T.players.length >= MAX_PLAYERS) return null;
  const used = new Set(T.players.map((p) => p.color));
  const color = PCOLORS.find((c) => !used.has(c)) || PCOLORS[T.players.length % PCOLORS.length];
  const id = 'p' + (T.seq++);
  const nm = (String(name || '').trim().slice(0, 14)) || FUN_NAMES.find((n) => !T.players.some((p) => p.name === n)) || 'Joueur ' + (T.players.length + 1);
  const P = { id, name: nm, owner, color, char: null, out: false, stats: { kos: 0, falls: 0, dealt: 0, wins: 0 } };
  T.players.push(P);
  return P;
}
export function removePlayer(T, id) { if (T.phase === 'setup') T.players = T.players.filter((p) => p.id !== id); }
export function renamePlayer(T, id, name) { const P = player(T, id); if (P && T.phase === 'setup') P.name = String(name || '').trim().slice(0, 14) || P.name; }

export const player = (T, id) => T.players.find((p) => p.id === id) || null;

// the seed order of a bracket of n: 1 meets n, 2 meets n-1... and the two best can only meet in the final
function seedOrder(n) {
  let r = [1, 2];
  while (r.length < n) { const m = r.length * 2 + 1; r = r.flatMap((s) => [s, m - s]); }
  return r;
}

// the draw: `order` is the players' ids, shuffled (by the caller: the animation shows that order)
export function draw(T, order) {
  const P = order.length;
  let n = 2;
  while (n < P) n *= 2;
  T.size = n;
  T.order = order.slice();
  const seeds = seedOrder(n);
  const R = Math.log2(n);
  T.rounds = [];
  for (let r = 0; r < R; r++) {
    const cnt = n >> (r + 1);
    T.rounds.push(Array.from({ length: cnt }, (_, i) => ({ id: `r${r}m${i}`, r, i, a: null, b: null, w: null, l: null, bye: false, forfeit: false, chars: {}, score: null })));
  }
  for (let i = 0; i < n / 2; i++) {
    const M = T.rounds[0][i];
    const sa = seeds[i * 2], sb = seeds[i * 2 + 1];
    M.a = sa <= P ? order[sa - 1] : null;
    M.b = sb <= P ? order[sb - 1] : null;
  }
  T.third = T.rules.third && P >= 4 ? { id: 'third', r: R - 1, i: 0, a: null, b: null, w: null, l: null, bye: false, forfeit: false, chars: {}, score: null, third: true } : null;
  // the byes go through at once
  for (const M of T.rounds[0]) if (!M.a || !M.b) { M.bye = true; win(T, M, M.a || M.b, null); }
  T.phase = 'bracket';
  T.cur = null;
  return T;
}

export function allMatches(T) {
  const out = [];
  for (const row of T.rounds) out.push(...row);
  if (T.third) out.push(T.third);
  return out;
}
export const matchById = (T, id) => allMatches(T).find((M) => M.id === id) || null;

// the next duel to play: round after round, left to right, the small final just before the final
export function nextMatch(T) {
  const R = T.rounds.length;
  for (let r = 0; r < R; r++) {
    if (r === R - 1 && T.third && !T.third.w && T.third.a && T.third.b) return T.third;
    for (const M of T.rounds[r]) if (M.a && M.b && !M.w) return M;
  }
  return null;
}

export function roundName(T, M) {
  if (M.third) return 'PETITE FINALE';
  const fromEnd = T.rounds.length - 1 - M.r;
  return ['FINALE', 'DEMI-FINALE', 'QUART DE FINALE', 'HUITIÈME DE FINALE'][fromEnd] || 'TOUR ' + (M.r + 1);
}

// a duel is over: the winner goes up the tree (or to the podium), the loser is out (or plays the small final)
export function win(T, M, wid, lid, info = null) {
  M.w = wid; M.l = lid;
  if (info) {
    M.score = info.score || null;
    if (info.chars) M.chars = info.chars;
    M.forfeit = !!info.forfeit;
    for (const [pid, s] of Object.entries(info.stats || {})) {
      const P = player(T, pid);
      if (P) { P.stats.kos += s.kos || 0; P.stats.falls += s.falls || 0; P.stats.dealt += s.dealt || 0; }
    }
    for (const [pid, c] of Object.entries(info.chars || {})) { const P = player(T, pid); if (P) P.char = c; }
  }
  const W = player(T, wid);
  if (W && !M.bye) W.stats.wins++;
  const R = T.rounds.length;
  if (M.third) {
    if (lid) { const L = player(T, lid); if (L) L.out = true; }
  } else if (M.r < R - 1) {
    const N = T.rounds[M.r + 1][M.i >> 1];
    if (M.i & 1) N.b = wid; else N.a = wid;
    if (lid) {
      // a semi-final loser plays the small final; the others are out
      if (T.third && M.r === R - 2) { if (M.i & 1) T.third.b = lid; else T.third.a = lid; }
      else { const L = player(T, lid); if (L) L.out = true; }
    }
  } else {
    if (lid) { const L = player(T, lid); if (L) L.out = true; }
    T.phase = 'done';
  }
  if (!M.bye) T.last = { id: M.id, w: wid, l: lid, n: (T.last ? T.last.n : 0) + 1, forfeit: !!(info && info.forfeit) };
  settleLeft(T);
  return T;
}

// a duel against a player who has left is won by forfeit as soon as both are known
function settleLeft(T) {
  const M = allMatches(T).find((x) => !x.w && x.a && x.b && (player(T, x.a)?.left || player(T, x.b)?.left));
  if (!M) return;
  const la = player(T, M.a)?.left;
  win(T, M, la ? M.b : M.a, la ? M.a : M.b, { forfeit: true });
}

// a player who leaves (an online machine gone): every duel he still had is lost by forfeit
export function forfeit(T, pid) {
  const P = player(T, pid);
  if (!P) return;
  if (T.phase === 'setup') { removePlayer(T, pid); return; }
  P.left = true;
  for (let k = 0; k < 8; k++) {
    const M = allMatches(T).find((x) => !x.w && (x.a === pid || x.b === pid) && x.a && x.b);
    if (!M) break;
    win(T, M, M.a === pid ? M.b : M.a, pid, { forfeit: true });
  }
  if (T.cur && matchById(T, T.cur) && matchById(T, T.cur).w) T.cur = null;
}

// the final ranking: champion, finalist, the small final, then by the round each one fell in (and wins, KOs)
export function standings(T) {
  const R = T.rounds.length;
  const fell = {};
  for (const M of allMatches(T)) if (M.l) fell[M.l] = M.third ? R - 0.5 : M.r;
  const F = T.rounds[R - 1] && T.rounds[R - 1][0];
  const rank = (p) => {
    if (F && F.w === p.id) return 1000;
    if (F && F.l === p.id) return 900;
    if (T.third && T.third.w === p.id) return 800;
    if (T.third && T.third.l === p.id) return 700;
    return (fell[p.id] ?? -1) * 10 + p.stats.wins;
  };
  return T.players.slice().sort((a, b) => rank(b) - rank(a) || b.stats.kos - a.stats.kos || b.stats.dealt - a.stats.dealt);
}

// --- humiliation (the bracket's eliminations, src/ui/tournament.js) -----------------------------------------------
export const SHAME = [
  '{L} rentre à la maison en pleurant', '{L} a été renvoyé à la niche', 'Merci d’être venu, {L}', '{L} : éliminé, humilié, oublié',
  '{L} retourne jouer à Candy Crush', 'On a retrouvé le dentier de {L} sur la piste', '{L} n’a même pas fait peur à un pigeon',
  'La maman de {L} a appelé : il doit rentrer', '{L} a été rangé dans un cercueil en carton', '{L} est officiellement une serpillière',
  'Personne ne se souviendra de {L}', '{L} demande un remboursement', '{L} vient de se faire recaler à l’entrée', 'Repose en paix, {L} (pas trop en paix)',
];
export const PRAISE = ['{W} passe au tour suivant !', '{W} n’a fait qu’une bouchée de {L} !', '{W} continue le massacre !', '{W} avance, couvert de sang !',
  '{W} est inarrêtable !', 'Personne ne peut stopper {W} !'];
