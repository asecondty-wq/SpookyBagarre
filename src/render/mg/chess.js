// Échec et menace (chess), l'affichage : un salon d'échecs lugubre, un petit échiquier par joueur (cadre à sa couleur), le
// même problème sur les deux ; trois coups en grosses flèches de couleur, chacune avec sa direction (◀ ▲ ▶), rappelés en
// dessous. Au milieu, le vrai Epektase en 3D, grosse tête qui grossit à mesure que le temps passe, menace dans sa bulle ;
// un bon coup l'énerve (rouge, il tremble), un mauvais le fait jubiler.
import { COLORS } from '../../sim/constants.js';
import { PUZZLES, CHESS } from '../../sim/mg/chess.js';

const S = 21, BW = S * 8, BY = 46, ARW = ['◀', '▲', '▶'], AC = ['#b57aff', '#f4f0ff', '#ff6ad5'];
// les touches des trois flèches pour le joueur i, selon son appareil (Clavier 1 : Q Z D, Clavier 2 : ← ↑ →, manette : ◀ ▲ ▶)
function dirKeys(view, W, M, i) {
  const up = W.fighters[i === 0 ? M.a : M.v].bot ? '' : view.keyName(M, i, 'up');
  return up === 'Z' ? ['Q', 'Z', 'D'] : up === '↑' ? ['←', '↑', '→'] : ARW;
}
const BX = (i) => (i === 0 ? 22 : 640 - 22 - BW);
const GL = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟︎' };
const NAMES = { k: 'Roi', q: 'Dame', r: 'Tour', b: 'Fou', n: 'Cavalier', p: 'Pion' };
const FONT = "'Apple Symbols','Segoe UI Symbol','DejaVu Sans','Noto Sans Symbols2',serif";
const THREAT = ['Joue vite...', 'Je te regarde.', 'Mauvais coup = solo de 40 min', 'T\'as 3 secondes.', 'Échec... et MENACE.', 'Je connais ton adresse IP.', 'Tic tac, tic tac...', 'Mon médiator est aiguisé.'];
const GLOAT = ['HAHAHA !', 'NUL !', 'Même mon ampli joue mieux', 'Retourne aux dames', 'Facile, ça...'];
const ANGRY = ['GRRR...', 'Pas mal. PAS MAL.', 'Chanceux !', 'Il a triché ?!', 'Hmpf.'];

const cache = {};
// un problème : ses pièces [lettre, colonne, rangée, blanc ?] et ses coups [[c0, r0, c1, r1]]
function parse(k) {
  if (cache[k]) return cache[k];
  const P = PUZZLES[k], sq = (s) => [s.charCodeAt(0) - 97, +s[1] - 1];
  const pcs = P.p.split(' ').map((s) => { const [f, r] = sq(s.slice(1)); return [s[0].toLowerCase(), f, r, s[0] !== s[0].toLowerCase()]; });
  const mv = P.m.map((m) => [...sq(m.slice(0, 2)), ...sq(m.slice(2, 4))]);
  return (cache[k] = { pcs, mv, name: P.name });
}
const sqX = (i, f) => BX(i) + f * S + S / 2, sqY = (r) => BY + (7 - r) * S + S / 2;

function ensure(xs) {
  if (xs.on) return xs;
  xs.on = 1; xs.say = { s: THREAT[0], t0: -9, k: 'threat' }; xs.mood = { k: '', t0: -9 }; xs.fl = [0, 0]; xs.flc = ['', '']; xs.shown = [0, 0]; xs.nextSay = 1.2; xs.solved = -9;
  return xs;
}

export default {
  title: 'ÉCHEC ET MENACE', color: '#e0d0a0', icon: '♟️',
  puppets: ['epektase'],
  goal: 'Trouve le coup gagnant : choisis la bonne flèche !',
  keys: [['dirs', 'choisis ta flèche']],
  ach: [['Grand maître de la crypte', 'Kasparov du dimanche', 'Échec et MAT', 'A survécu à Epektase'], ['A paniqué devant Epektase', 'Joue aux dames', 'Mat du berger subi', 'Gambit de la honte']],
  news: (L, d) => `${L} MENACÉ PAR EPEKTASE, IL JOUE LE PIRE COUP DE L'HISTOIRE : ${d} %`,

  draw(view, W, M, dt) {
    const ctx = view.g, g = M.g, xs = ensure(view.xs), t = view.time;
    const L = -view.ox, R = 640 + view.ox, T = -view.oy, B = 360 + view.oy;
    // le salon : mur bordeaux, damier au sol, une lueur rouge qui bat quand le temps file
    ctx.fillStyle = '#1c0e16'; ctx.fillRect(L, T, R - L, B - T);
    ctx.fillStyle = '#26121e'; for (let k = 0; k < 10; k++) ctx.fillRect(L + k * 80, T, 40, 270 - T);
    for (let y = 270, r = 0; y < B; y += 18, r++) for (let x = L - (r % 2) * 18; x < R; x += 36) { ctx.fillStyle = '#2a1a24'; ctx.fillRect(x, y, 18, 18); ctx.fillStyle = '#120a10'; ctx.fillRect(x + 18, y, 18, 18); }
    const press = g.ph === 'q' && M.ph === 'play' ? g.t / CHESS.DL : 0;
    if (press > 0.4) { ctx.fillStyle = `rgba(255,0,30,${(press - 0.4) * 0.25 * (0.6 + 0.4 * Math.sin(t * 10))})`; ctx.fillRect(L, T, R - L, B - T); }
    epek(view, W, M, g, xs, t, press);
    view.timer(M, 320, 30);
    if (g.pz >= 0 && M.ph === 'play') for (let i = 0; i < 2; i++) board(view, W, M, g, xs, i, t, dt);
    else for (let i = 0; i < 2; i++) { const slot = i === 0 ? M.a : M.v; view.who(W, M, i, BX(i) + BW / 2, 262, { align: 'center' }); void slot; }
  },

  onEvent(view, ev, W, M) {
    const A = view.audio, xs = ensure(view.xs);
    if (!M || !ev.type.startsWith('mgChess')) return;
    if (ev.type === 'mgChessQ') {
      xs.fl = [0, 0];
      if (A) { A.sfx('wood', 0, 0.6); A.sfx('woodM', 0, 0.4, 2); }
      if (ev.n === 1 || Math.random() < 0.5) { xs.say = { s: view.pick(THREAT), t0: view.time, k: 'threat' }; xs.nextSay = 1.6 + Math.random(); }
    } else if (ev.type === 'mgChessGood') {
      const i = ev.p, slot = i === 0 ? M.a : M.v, cx = BX(i) + BW / 2;
      xs.fl[i] = 1; xs.flc[i] = '#3cff7a'; xs.solved = view.time;
      xs.mood = { k: 'angry', t0: view.time }; xs.say = { s: view.pick(ANGRY), t0: view.time, k: 'angry' };
      const pz = parse(M.g.pz);
      view.burst(cx, BY + BW / 2, 30, ['#3cff7a', '#ffffff', COLORS[slot], '#ffd23a'], { shape: 'star', speed: 260, size: 5 });
      view.sticker(pz.name, cx, BY + BW / 2, { size: 15, color: '#0b0610', bg: '#3cff7a', life: 1, rot: (Math.random() - 0.5) * 0.3 });
      view.sticker(`+${ev.pts}`, cx, BY + BW + 30, { size: 16, color: '#ffffff', bg: COLORS[slot], life: 0.8, rot: 0 });
      if (ev.f < 70) view.sticker('⚡ COUP ÉCLAIR', cx, BY + 20, { size: 12, color: '#0b0610', bg: '#ffe24a', life: 0.8 });
      if (ev.both) view.sticker('EX AEQUO !', 320, 200, { size: 16, color: '#ffffff', bg: '#7a3aff', life: 0.9 });
      if (ev.st === 3) { view.sticker('GRAND MAÎTRE 👑', 320, 230, { size: 16, color: '#ffffff', bg: '#ff3a3a', life: 1 }); view.hype(0.5); }
      view.jolt(0.45, 0.04, '#c0ffd0', 0.15);
      if (A) { A.sfx('woodL', i ? 0.4 : -0.4, 0.8); A.sfx('cash', i ? 0.4 : -0.4, 0.5); A.sfx('hitmark', 0, 0.5); if (/MAT/.test(pz.name)) A.sfx('powerchord', 0, 0.45); A.say(/MAT/.test(pz.name) ? 'Échec et mat !' : view.pick(['Gratuit !', 'Miam !']), 0.5, 1.2); }
    } else if (ev.type === 'mgChessWrong') {
      const i = ev.p, cx = BX(i) + BW / 2;
      xs.fl[i] = 1; xs.flc[i] = '#ff3a4a';
      xs.mood = { k: 'gloat', t0: view.time }; xs.say = { s: view.pick(GLOAT), t0: view.time, k: 'gloat' };
      view.burst(cx, BY + BW / 2, 16, ['#ff3a4a', '#ffffff', '#1a1424'], { speed: 220, size: 5, life: 0.6 });
      view.sticker(view.pick(['GAFFE ??', 'BOURDE', 'DÉBUTANT', 'AÏE AÏE AÏE']), cx, BY + BW / 2, { size: 16, color: '#ffffff', bg: '#d01030', life: 0.9 });
      view.jolt(0.55, 0.03, '#ff2020', 0.22);
      if (A) { A.sfx('error', i ? 0.4 : -0.4, 0.6); A.sfx('guitarHit', 0, 0.45); A.sfx('larsen', 0, 0.15); if (Math.random() < 0.6) A.say('Ha ha ha !', 0.35, 1.1); }
    } else if (ev.type === 'mgChessLate') {
      xs.mood = { k: 'gloat', t0: view.time }; xs.say = { s: 'TROP LENTS. À MOI.', t0: view.time, k: 'gloat' };
      view.sticker('TEMPS ÉCOULÉ ⏰', 320, 200, { size: 16, color: '#ffffff', bg: '#5a1030', life: 1 });
      if (A) { A.sfx('thud', 0, 0.6); A.sfx('riff', 0, 0.4); }
    }
  },
};

// Epektase au milieu : il menace (sa provocation en boucle, la tête qui grossit avec le temps), jubile ou enrage
function epek(view, W, M, g, xs, t, press) {
  const ctx = view.g, mt = t - xs.mood.t0, mood = mt < 1.3 ? xs.mood.k : '';
  let o;
  if (M.ph === 'outro') o = { emote: 'win', head: 1.8 };
  else if (mood === 'angry') o = { emote: 'select', head: 2.1 + Math.abs(Math.sin(t * 20)) * 0.12, tint: '#ff2020', tintK: 0.25, emoteSpeed: 1.6 };
  else if (mood === 'gloat') o = { emote: 'win', head: 2.0, emoteSpeed: 1.3 };
  else o = { emote: 'select', head: 1.7 + press * 0.7, emoteSpeed: 0.8 + press };
  const sh = mood === 'angry' ? (Math.random() - 0.5) * 5 : press > 0.6 ? (Math.random() - 0.5) * 2 : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(320, 312, 54, 10, 0, 0, Math.PI * 2); ctx.fill();
  if (!view.puppet('epektase', 320 + sh, 312, 210, { ...o, key: 'chepek', shadow: false })) view.portraitAt('epektase', 320, 200, 90, '#e0d0a0', false);
  // les yeux rouges qui brillent quand ça presse
  if (press > 0.5 && mood !== 'angry') { ctx.fillStyle = `rgba(255,30,30,${(press - 0.5) * 0.6})`; ctx.beginPath(); ctx.arc(320, 170, 40 + Math.sin(t * 8) * 4, 0, Math.PI * 2); ctx.fill(); }
  // sa bulle : une menace de temps en temps
  if (M.ph === 'play' && t - xs.say.t0 > 2.6 && g.ph === 'q' && g.t / 60 > xs.nextSay) { xs.say = { s: view.pick(THREAT), t0: t, k: 'threat' }; xs.nextSay = g.t / 60 + 2.2; }
  const st = t - xs.say.t0;
  if (M.ph === 'play' && st < 2.2) {
    const s = xs.say.s, a = Math.min(1, st * 8, (2.2 - st) * 4), pop = st < 0.1 ? 1.25 - st * 2.5 : 1;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(320, 66); ctx.scale(pop, pop);
    ctx.font = "12px 'Lilita One', 'Trebuchet MS', sans-serif";
    const w = Math.min(240, ctx.measureText(s).width + 22), col = xs.say.k === 'angry' ? '#ffd0d0' : xs.say.k === 'gloat' ? '#fff4b0' : '#ffffff';
    ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.roundRect(-w / 2 - 3, -15, w + 6, 30, 10); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-8, 13); ctx.lineTo(8, 13); ctx.lineTo(0, 28); ctx.closePath(); ctx.fill();
    ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(-w / 2, -12, w, 24, 8); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-5, 11); ctx.lineTo(5, 11); ctx.lineTo(0, 23); ctx.closePath(); ctx.fill();
    ctx.restore();
    view.text(s, 320, 70, 12, '#0b0610', { stroke: false, alpha: a, maxW: 232 });
  }
}

// l'échiquier d'un joueur, ses trois flèches, le rappel des coups dessous, son score et son étiquette
function board(view, W, M, g, xs, i, t, dt) {
  const ctx = view.g, slot = i === 0 ? M.a : M.v, col = COLORS[slot], P = g.p[i], pz = parse(g.pz), bx = BX(i);
  const K = dirKeys(view, W, M, i), lock = P.lock > 0, fl = xs.fl[i], solved = g.ph === 'gap' && g.last >= 0;
  xs.fl[i] = Math.max(0, fl - dt * 1.5);
  xs.shown[i] += (P.s - xs.shown[i]) * Math.min(1, dt * 10);
  const sh = fl > 0 && xs.flc[i] !== '#3cff7a' ? (Math.random() - 0.5) * fl * 8 : 0;
  ctx.save(); ctx.translate(sh, 0);
  // le cadre (à la couleur du joueur), les cases
  ctx.fillStyle = '#0b0610'; ctx.fillRect(bx - 7, BY - 7, BW + 14, BW + 14);
  ctx.fillStyle = fl > 0 ? xs.flc[i] : col; ctx.fillRect(bx - 5, BY - 5, BW + 10, BW + 10);
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) { ctx.fillStyle = (r + f) % 2 ? '#ecdcb8' : '#9a7450'; ctx.fillRect(bx + f * S, BY + (7 - r) * S, S, S); }
  // la solution jouée (après le bon coup, ou quand personne n'a trouvé) : la pièce glisse
  const m0 = pz.mv[0], st = solved || (g.ph === 'gap' && g.n > 0) ? Math.min(1, (g.t / 60) / 0.25) : 0;
  if (st > 0) { ctx.fillStyle = 'rgba(80,255,120,0.45)'; ctx.fillRect(bx + m0[0] * S, BY + (7 - m0[1]) * S, S, S); ctx.fillRect(bx + m0[2] * S, BY + (7 - m0[3]) * S, S, S); }
  // les trois flèches (pas une fois le problème résolu)
  if (g.ph === 'q') for (let d = 0; d < 3; d++) {
    const m = pz.mv[g.ord[d]], picked = P.pick === d;
    ctx.globalAlpha = lock && !picked ? 0.35 : 1; ctx.strokeStyle = '#0b0610'; ctx.lineWidth = 4; ctx.strokeRect(bx + m[2] * S + 2, BY + (7 - m[3]) * S + 2, S - 4, S - 4);
    ctx.strokeStyle = AC[d]; ctx.lineWidth = 2; ctx.strokeRect(bx + m[2] * S + 2, BY + (7 - m[3]) * S + 2, S - 4, S - 4); ctx.globalAlpha = 1;
    arrow(ctx, sqX(i, m[0]), sqY(m[1]), sqX(i, m[2]), sqY(m[3]), AC[d], lock && !picked ? 0.35 : 1, picked && lock);
  }
  for (const [k, f, r, white] of pz.pcs) {
    let x = sqX(i, f), y = sqY(r);
    if (st > 0) {
      if (f === m0[2] && r === m0[3]) continue; // la pièce prise
      if (f === m0[0] && r === m0[1]) { x += (sqX(i, m0[2]) - x) * st; y += (sqY(m0[3]) - y) * st - Math.sin(st * Math.PI) * 10; }
    }
    piece(ctx, k, white, x, y, S);
  }
  if (g.ph === 'q') for (let d = 0; d < 3; d++) {
    const m = pz.mv[g.ord[d]], x = sqX(i, m[2]) + S / 2 - 1, y = sqY(m[3]) - S / 2 + 1;
    const pop = 1 + 0.1 * Math.sin(t * 8 + d * 2);
    ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.arc(x, y, 10 * pop, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = AC[d]; ctx.beginPath(); ctx.arc(x, y, 8.5 * pop, 0, Math.PI * 2); ctx.fill();
    view.text(K[d], x, y + 3.5, 10, '#0b0610', { stroke: false, mono: K !== ARW });
  }
  // bloqué après une gaffe
  if (lock) {
    ctx.fillStyle = 'rgba(40,0,10,0.55)'; ctx.fillRect(bx, BY, BW, BW);
    view.text('🔒', bx + BW / 2, BY + BW / 2 - 4, 26, '#fff', { stroke: false });
    view.text('BLOQUÉ', bx + BW / 2, BY + BW / 2 + 22, 14, '#ff6a7a', { mono: true });
  }
  ctx.restore();
  // le rappel des coups : ◀ ▲ ▶, la pièce et sa case d'arrivée
  const ly = BY + BW + 22, cw = 64;
  for (let d = 0; d < 3; d++) {
    const m = pz.mv[g.ord[d]], cx = bx + BW / 2 + (d - 1) * cw;
    const pc = pz.pcs.find((p) => p[1] === m[0] && p[2] === m[1]), dest = String.fromCharCode(97 + m[2]) + (m[3] + 1);
    const right = g.ph === 'gap' && g.ord[d] === 0, a = g.ph === 'q' ? (lock ? 0.4 : 1) : right ? 1 : 0.3;
    ctx.globalAlpha = a;
    ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.roundRect(cx - cw / 2 + 2, ly - 15, cw - 4, 30, 6); ctx.fill();
    ctx.fillStyle = right ? '#3cff7a' : AC[d]; ctx.beginPath(); ctx.roundRect(cx - cw / 2 + 4, ly - 13, cw - 8, 26, 5); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.globalAlpha = a; ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.roundRect(cx - 28, ly - 11, 22, 22, 4); ctx.fill();
    ctx.fillStyle = '#f4ead6'; ctx.beginPath(); ctx.roundRect(cx - 27, ly - 10, 20, 20, 3); ctx.fill(); ctx.fillStyle = col; ctx.fillRect(cx - 27, ly + 6, 20, 4); ctx.globalAlpha = 1;
    view.text(K[d], cx - 17, ly + 4, K === ARW ? 11 : 14, '#0b0610', { mono: true, stroke: false, alpha: a });
    if (pc) piece(ctx, pc[0], true, cx + 2, ly + 1, 19, a);
    view.text(dest, cx + 19, ly + 5, 13, '#0b0610', { mono: true, stroke: false, alpha: a });
    void NAMES;
  }
  // le score, l'étiquette
  view.who(W, M, i, bx + BW / 2, ly + 22, { align: 'center' });
  view.hint(W, M, i, bx + BW / 2, ly + 62, [['dirs', 'choisis ta flèche']]);
  view.text(`${Math.round(xs.shown[i])} PTS`, bx + BW / 2, ly + 84, 14, col, { mono: true });
}

// une pièce (le même dessin plein pour les deux camps : blanche cerclée de noir, noire cerclée de blanc)
function piece(ctx, k, white, x, y, s, a = 1) {
  ctx.save(); ctx.globalAlpha = a;
  ctx.font = `${Math.round(s * 0.92)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.lineWidth = 2.5; ctx.strokeStyle = white ? '#0b0610' : '#f4f0e0';
  ctx.strokeText(GL[k], x, y + 1);
  ctx.fillStyle = white ? '#ffffff' : '#1a1020';
  ctx.fillText(GL[k], x, y + 1);
  ctx.restore();
}

// une grosse flèche d'une case à l'autre (cerclée de noir) ; barrée si c'était le mauvais choix
function arrow(ctx, x0, y0, x1, y1, col, a, cross) {
  const dx = x1 - x0, dy = y1 - y0, d = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / d, uy = dy / d;
  const ex = x1 - ux * 14, ey = y1 - uy * 14, hx = x1 - ux * 4, hy = y1 - uy * 4;
  ctx.save(); ctx.globalAlpha = a; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [w, c] of [[8, '#0b0610'], [4.5, col]]) {
    ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0 + ux * 5, y0 + uy * 5); ctx.lineTo(ex, ey); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(ex - uy * 8, ey + ux * 8); ctx.lineTo(ex + uy * 8, ey - ux * 8); ctx.closePath();
  ctx.fillStyle = col; ctx.strokeStyle = '#0b0610'; ctx.lineWidth = 2; ctx.fill(); ctx.stroke();
  ctx.restore();
  if (cross) { ctx.strokeStyle = '#ff2a3a'; ctx.lineWidth = 4; const mx = (x0 + x1) / 2, my = (y0 + y1) / 2; ctx.beginPath(); ctx.moveTo(mx - 8, my - 8); ctx.lineTo(mx + 8, my + 8); ctx.moveTo(mx + 8, my - 8); ctx.lineTo(mx - 8, my + 8); ctx.stroke(); }
}
