// Tetris express (tetris), l'affichage : deux grilles côte à côte (J1 à gauche, J2 à droite, cadres à leur couleur), la
// pièce qui tombe et son ombre, la ligne rouge de la hauteur de la pile (le chiffre à côté : plus bas = mieux), la pièce
// suivante, au milieu le tableau des hauteurs (👑 au plus bas) et les deux joueurs en grosse tête qui regardent leur grille.
import { TET, PIECES, stackH, dropY } from '../../sim/mg/tetris.js';
import { COLORS } from '../../sim/constants.js';

const INK = '#0b0610', C = 15, NW = TET.W, NH = TET.H;
const BX = [70, 420], BY = 50;
const PCOL = ['#3be8ff', '#ffd23a', '#c05aff', '#3bdc5a', '#ff4a4a', '#4a7aff', '#ff9a2a', '#6e5e86'];
const CLEAR_TXT = ['', 'LIGNE !', 'DOUBLE !', 'TRIPLE !!', 'TETRIS !!!'];

function S(view) {
  const xs = view.xs;
  if (!xs.on) { xs.on = 1; xs.pc = [null, null]; xs.fl = [0, 0]; xs.sh = [0, 0]; xs.hh = [0, 0]; xs.pop = [0, 0]; xs.h0 = -1; }
  return xs;
}

function cell(ctx, x, y, col, a = 1) {
  ctx.globalAlpha = a;
  ctx.fillStyle = col; ctx.fillRect(x, y, C - 1, C - 1);
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x, y, C - 1, 3);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x, y + C - 4, C - 1, 3);
  ctx.globalAlpha = 1;
}

function drawBoard(view, W, M, g, i, xs) {
  const ctx = view.g, P = g.p[i], slot = i === 0 ? M.a : M.v, col = COLORS[slot], t = view.time;
  const x0 = BX[i] + (Math.random() - 0.5) * xs.sh[i] * 8, y0 = BY + xs.sh[i] * 3, h = stackH(P.b), danger = h >= NH - 3;
  // le cadre (à la couleur du joueur, rouge qui clignote quand ça déborde presque)
  ctx.fillStyle = INK; ctx.fillRect(x0 - 7, y0 - 7, NW * C + 14, NH * C + 14);
  ctx.fillStyle = danger && Math.sin(t * 18) > 0 ? '#ff2a2a' : col; ctx.fillRect(x0 - 5, y0 - 5, NW * C + 10, NH * C + 10);
  ctx.fillStyle = '#120c1c'; ctx.fillRect(x0, y0, NW * C, NH * C);
  ctx.fillStyle = 'rgba(255,255,255,0.04)'; for (let x = 1; x < NW; x++) ctx.fillRect(x0 + x * C - 1, y0, 1, NH * C);
  // la hauteur de départ (pointillés gris)
  if (xs.h0 > 0) { ctx.fillStyle = 'rgba(255,255,255,0.25)'; for (let x = 0; x < NW * C; x += 8) ctx.fillRect(x0 + x, y0 + (NH - xs.h0) * C - 1, 4, 2); }
  // la pile
  for (let y = 0; y < NH; y++) for (let x = 0; x < NW; x++) { const v = P.b[y * NW + x]; if (v) cell(ctx, x0 + x * C, y0 + y * C, PCOL[v - 1]); }
  // l'ombre et la pièce
  const gy = dropY(P.b, P.k, P.r, P.x, P.y);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
  for (const [dx, dy] of PIECES[P.k][P.r]) if (gy + dy >= 0) ctx.strokeRect(x0 + (P.x + dx) * C + 1.5, y0 + (gy + dy) * C + 1.5, C - 4, C - 4);
  for (const [dx, dy] of PIECES[P.k][P.r]) if (P.y + dy >= 0) cell(ctx, x0 + (P.x + dx) * C, y0 + (P.y + dy) * C, PCOL[P.k]);
  // le flash des lignes
  if (xs.fl[i] > 0) { ctx.fillStyle = `rgba(255,255,255,${xs.fl[i] * 0.6})`; ctx.fillRect(x0, y0, NW * C, NH * C); }
  // la ligne de hauteur, et son chiffre (côté extérieur)
  xs.hh[i] += (h - xs.hh[i]) * 0.25;
  const ly = y0 + (NH - xs.hh[i]) * C;
  ctx.fillStyle = '#ff3a5a'; ctx.fillRect(x0 - 5, ly - 1.5, NW * C + 10, 3);
  const lx = i === 0 ? x0 - 10 : x0 + NW * C + 10;
  view.text(String(h + P.pen), lx, ly, 18 * (1 + xs.pop[i] * 0.4), danger ? '#ff3a5a' : '#ffffff', { align: i === 0 ? 'right' : 'left', mono: true });
  view.text('▼ BAS = BIEN', lx, ly + 16, 6, '#ff9ab0', { align: i === 0 ? 'right' : 'left', mono: true, stroke: false });
  if (danger) view.text('DANGER !', x0 + NW * C / 2, y0 + 20, 16 + Math.sin(t * 20) * 2, '#ff3a5a', { title: true });
  view.hint(W, M, i, BX[i] + NW * C / 2, y0 + NH * C + 16, [['lr', 'bouger'], ['A', 'tourner'], ['down', 'tomber']], { size: 0.9 });
  view.who(W, M, i, i === 0 ? BX[i] - 5 : BX[i] + NW * C + 5, y0 + NH * C + 30, { align: i === 0 ? 'left' : 'right', size: 0.75 });
}

// la pièce suivante
function drawNext(view, M, g, i) {
  const ctx = view.g, P = g.p[i], slot = i === 0 ? M.a : M.v, k = g.seq[P.n], bx = i === 0 ? 232 : 364, by = 58;
  view.panel(bx, by, 44, 44, 'rgba(14,6,22,0.85)', COLORS[slot]);
  view.text('SUIVANTE', bx + 22, by - 6, 7, '#c8b8d8', { mono: true, stroke: false });
  if (k === undefined) return;
  const cs = PIECES[k][0]; let mx = 0, my = 0, Mx = 0, My = 0;
  for (const [x, y] of cs) { mx = Math.min(mx, x); Mx = Math.max(Mx, x); my = Math.min(my, y); My = Math.max(My, y); }
  const s = 9, ox = bx + 22 - ((Mx - mx + 1) * s) / 2, oy = by + 22 - ((My - my + 1) * s) / 2;
  for (const [x, y] of cs) { ctx.fillStyle = PCOL[k]; ctx.fillRect(ox + (x - mx) * s, oy + (y - my) * s, s - 1, s - 1); }
}

export default {
  title: 'TETRIS EXPRESS', color: '#a07aff', icon: '🧱',
  goal: 'Pose les pièces et finis avec la pile la plus BASSE possible !',
  keys: [['lr', 'bouger'], ['A', 'tourner'], ['down', 'tomber vite']],
  ach: [['Architecte du vide', 'Maître des lignes', 'Plat comme la Beauce', 'Le puits parfait'], ['Tour de Babel', 'Empileur fou', 'Trou de mémoire', 'Pile ou face ? Pile.']],
  news: (L, d) => `${L} CONSTRUIT UNE TOUR AU LIEU DE FAIRE DES LIGNES : ${d} %, LA PILE S'EFFONDRE SUR LUI`,

  draw(view, W, M, dt) {
    const ctx = view.g, g = M.g, xs = S(view), L = -view.ox, Rr = 640 + view.ox, T = -view.oy, B = 360 + view.oy, t = view.time, A = view.audio;
    if (xs.h0 < 0) xs.h0 = stackH(g.p[0].b);
    for (let i = 0; i < 2; i++) { xs.fl[i] = Math.max(0, xs.fl[i] - dt * 3); xs.sh[i] = Math.max(0, xs.sh[i] - dt * 3); xs.pop[i] = Math.max(0, xs.pop[i] - dt * 4); }
    // le fond : arcade, damier qui défile
    ctx.fillStyle = '#1a0e2e'; ctx.fillRect(L, T, Rr - L, B - T);
    const off = (t * 20) % 40;
    ctx.fillStyle = 'rgba(160,122,255,0.07)';
    for (let y = Math.floor(T / 40) * 40 - 40; y < B; y += 40) for (let x = Math.floor(L / 40) * 40 - 40; x < Rr; x += 40) if (((x + y) / 40) & 1) ctx.fillRect(x + off, y + off, 40, 40);
    view.text('🧱 TETRIS EXPRESS', 320, T + 16, 18, '#a07aff', { title: true });
    view.timer(M, 320, T + 42);
    // les bruits des pièces (bouger, tourner)
    for (let i = 0; i < 2; i++) {
      const P = g.p[i], q = xs.pc[i];
      if (q && q.n === P.n && A) { if (q.r !== P.r) A.sfx('click', i ? 0.4 : -0.4, 0.35, 3); else if (q.x !== P.x) A.sfx('blip', i ? 0.4 : -0.4, 0.15, 1); }
      xs.pc[i] = { n: P.n, r: P.r, x: P.x };
      drawBoard(view, W, M, g, i, xs);
      drawNext(view, M, g, i);
    }
    // le tableau des hauteurs
    const h = g.p.map((P) => stackH(P.b) + P.pen);
    view.panel(250, 118, 140, 64, 'rgba(14,6,22,0.88)', '#a07aff');
    view.text('HAUTEUR', 320, 130, 10, '#c8b8d8', { mono: true });
    for (let i = 0; i < 2; i++) {
      const slot = i === 0 ? M.a : M.v, x = i === 0 ? 286 : 354, best = h[i] < h[1 - i];
      view.text(String(h[i]), x, 158, 26 * (1 + xs.pop[i] * 0.3), COLORS[slot], { mono: true });
      if (best) view.text('👑', x, 140 + Math.sin(t * 6) * 2, 12, '#fff', { stroke: false });
    }
    view.text('VS', 320, 158, 12, '#ffffff', { title: true });
    // les deux joueurs, qui regardent leur grille
    if (view.pupOn(M)) {
      for (let i = 0; i < 2; i++) {
        const P = g.p[i], danger = stackH(P.b) >= NH - 3;
        const o = { face: i === 0 ? 'threeL' : 'three', head: 1.9 };
        if (danger) { o.state = 'shield'; o.tint = '#ff2a2a'; o.tintK = 0.15 + Math.max(0, Math.sin(t * 12)) * 0.1; }
        view.player(W, M, i, i === 0 ? 282 : 358, 312, 108, o);
      }
    }
  },

  onEvent(view, ev, W, M) {
    if (!M || !ev.type.startsWith('mgTetris')) return;
    const A = view.audio, xs = S(view), i = ev.p, slot = i === 0 ? M.a : M.v, x0 = BX[i], cx = x0 + NW * C / 2, pan = i ? 0.4 : -0.4;
    switch (ev.type) {
      case 'mgTetrisLock': {
        const px = x0 + (ev.x + 1.5) * C, py = BY + (ev.y + 1.5) * C;
        view.burst(px, py, 5, [PCOL[ev.k], '#ffffff'], { shape: 'sq', speed: 70, size: 3, life: 0.3 });
        xs.pop[i] = 0.4;
        if (A) A.sfx('land', pan, 0.35);
        break;
      }
      case 'mgTetrisDrop': {
        if (ev.d > 2) { xs.sh[i] = Math.min(1, 0.3 + ev.d * 0.04); view.burst(x0 + (ev.x + 1.5) * C, BY + NH * C - 20, 6, ['#ffffff', '#c8b8ff'], { shape: 'dot', speed: 90, size: 2, up: 60, life: 0.35 }); }
        if (A) A.sfx('whoosh', pan, 0.3);
        break;
      }
      case 'mgTetrisClear': {
        xs.fl[i] = 1; xs.pop[i] = 1; xs.sh[i] = 0.6;
        const n = Math.min(4, ev.n);
        view.burst(cx, BY + (NH - ev.h - 1) * C, 14 + n * 8, ['#ffffff', '#ffd23a', COLORS[slot], '#a07aff'], { shape: 'star', speed: 220 + n * 40, size: 5, life: 0.6 });
        view.sticker(CLEAR_TXT[n], cx, BY + 120, { size: 14 + n * 3, color: n >= 4 ? '#ffffff' : INK, bg: n >= 4 ? '#ff3a8a' : '#ffd23a', life: 0.8, rot: (Math.random() - 0.5) * 0.3 });
        view.floats.push({ text: '▼ PILE PLUS BASSE', x: cx, y: BY + 150, t: 0, life: 0.8, color: '#7cff8a', size: 11 });
        view.react(i, { emote: n >= 2 ? 'victory_celebration' : 'cheer', life: 1.1, weak: n < 2 });
        view.jolt(0.2 + n * 0.12, 0.02 + n * 0.012, n >= 4 ? '#ff8ad0' : null, 0.15);
        if (n >= 4) { view.hype(0.6); view.lines(0.4); }
        if (A) { A.sfx('zapS', pan, 0.6, n); A.sfx('cash', pan, 0.3 + n * 0.1); if (n >= 3) A.sfx('powerchord', 0, 0.5); }
        break;
      }
      case 'mgTetrisTop': {
        xs.sh[i] = 1; xs.fl[i] = 0.6;
        view.sticker('ÇA DÉBORDE ! +4 📈', cx, BY + 60, { size: 16, color: '#ffffff', bg: '#c01020', life: 1, rot: -0.1 });
        view.burst(cx, BY + 10, 26, ['#ff3a3a', '#ffd23a', '#5a4a6e'], { shape: 'sq', speed: 260, size: 5, up: 120, life: 0.8, g: 300 });
        view.react(i, { emote: 'sob', life: 1.2 });
        view.jolt(0.8, 0.08, '#ff2020', 0.3);
        if (A) { A.sfx('boom', pan, 0.6); A.sfx('error', pan, 0.5); }
        break;
      }
      default: break;
    }
  },
};
