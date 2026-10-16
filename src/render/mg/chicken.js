// Master poulet (chicken), l'affichage : un fast-food la nuit, chacun derrière sa table (J1 à gauche, J2 à droite), son
// vrai modèle 3D à grosse tête, le morceau en cours devant la bouche (il se fait croquer bouchée après bouchée), son seau
// « MASTER POULET » d'un côté, la pile d'os qui monte de l'autre. Chaque bouchée : graisse, miettes, crunch ; chaque
// morceau fini : l'os vole sur la pile, +1 (+2 le doré).
import { COLORS } from '../../sim/constants.js';
import { CHK } from '../../sim/mg/chicken.js';

const CX = [160, 480], TABLE = 236, INK = '#0b0610';
const NAMES = ['AILE', 'PILON', 'CUISSE', 'PILON DORÉ'];
const MEAT = [[13, 11, 9], [14, 19, 15], [19, 21, 11], [14, 19, 15]]; // rx, ry de la chair, longueur de l'os
const PIECE_Y = 160, PIECE_DX = 30; // le morceau devant la bouche (décalé vers le milieu de l'écran)
const BONES = (i) => CX[i] + (i === 0 ? 92 : -92), BUCKET = (i) => CX[i] + (i === 0 ? -98 : 98);

// la grosse touche à presser (le nom de SA touche : J, NUM 1, A...), qui s'enfonce à chaque appui (press : 1 juste
// appuyé, puis retombe à 0) et s'allume en jaune quand c'est le moment (hot) ; un mot dessous (word)
function keyCap(view, M, i, x, y, s, press, hot, word, col) {
  const ctx = view.g, key = view.keyName(M, i, 'A'), d = Math.max(0, Math.min(1, press)) * 4 * s;
  ctx.save(); ctx.font = `${Math.round(15 * s)}px 'Arial Black', Impact, sans-serif`;
  const w = Math.max(30 * s, ctx.measureText(key).width + 16 * s), h = 26 * s;
  ctx.fillStyle = INK; ctx.beginPath(); ctx.roundRect(x - w / 2 - 3, y - h / 2 - 3, w + 6, h + 10 * s, 7 * s); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2 + 4 * s, w, h, 6 * s); ctx.fill();
  ctx.fillStyle = hot ? '#ffe24a' : '#f4ead6'; ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2 + d, w, h - 2 * s, 6 * s); ctx.fill();
  ctx.restore();
  view.text(key, x, y - s + d, 15 * s, INK, { mono: true, stroke: false });
  if (word) view.text(word, x, y + h / 2 + 15 * s, 11 * s, hot ? '#ffe24a' : '#ffffff', { mono: true });
}

function S(view) {
  const X = view.xs;
  if (!X.ok) { X.ok = 1; X.pop = [0, 0]; X.chew = [0, 0]; X.fly = []; X.sc = [0, 0]; X.bone = [0, 0]; }
  return X;
}

// un morceau de poulet (l'os en bas, la chair en haut), frac : la part qui reste (croquée par le haut, traces de dents)
function drawPiece(ctx, k, x, y, s, frac, t, rot = 0) {
  const [rx, ry, bl] = MEAT[k], gold = k === 3;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  // l'os
  ctx.fillStyle = INK; ctx.fillRect(-4.5, ry * 0.4, 9, bl + 2);
  ctx.fillStyle = '#f4ead6'; ctx.fillRect(-3, ry * 0.4, 6, bl);
  for (const sx of [-1, 1]) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(sx * 4, ry * 0.4 + bl + 1, 5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#f4ead6'; ctx.beginPath(); ctx.arc(sx * 4, ry * 0.4 + bl + 1, 3.6, 0, Math.PI * 2); ctx.fill(); }
  if (frac > 0.02) {
    // la chair : l'ellipse, rabotée par le haut jusqu'à cutY, avec les marques des dents
    const top = -ry, cutY = top + (1 - frac) * ry * 2, n = 30, pts = [];
    for (let j = 0; j < n; j++) {
      const a = (j / n) * Math.PI * 2, px = Math.cos(a) * rx; let py = Math.sin(a) * ry;
      if (frac < 0.999 && py < cutY) py = cutY + 2.4 * Math.abs(Math.sin(px * 0.42));
      pts.push([px, py]);
    }
    const path = () => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const q of pts) ctx.lineTo(q[0], q[1]); ctx.closePath(); };
    ctx.save(); ctx.translate(0, 0); ctx.scale(1.12, 1.1); path(); ctx.fillStyle = INK; ctx.fill(); ctx.restore();
    path(); ctx.fillStyle = gold ? '#ffc21a' : '#c8701c'; ctx.fill();
    // la panure : des bosses plus claires
    ctx.save(); path(); ctx.clip();
    ctx.fillStyle = gold ? '#fff07a' : '#e8a040';
    for (let j = 0; j < 9; j++) { const bx = ((j * 37) % 19) - 9, by = ((j * 23) % 26) - 13; ctx.beginPath(); ctx.arc(bx * rx / 11, by * ry / 14, 2.6, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.ellipse(-rx * 0.35, -ry * 0.2, rx * 0.25, ry * 0.4, -0.3, 0, Math.PI * 2); ctx.fill();
    // la chair blanche sur la tranche croquée
    if (frac < 0.999) { ctx.fillStyle = '#f8e6cc'; ctx.fillRect(-rx, cutY - 2, rx * 2, 6); ctx.fillStyle = 'rgba(200,120,60,0.5)'; ctx.fillRect(-rx, cutY + 3, rx * 2, 1.5); }
    ctx.restore();
    if (gold) for (let j = 0; j < 3; j++) { const a = t * 3 + j * 2.1; ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.cos(a) * (rx + 6) - 1.5, Math.sin(a) * (ry + 4) - 1.5, 3, 3); }
  }
  ctx.restore();
}

// le seau MASTER POULET, plein de morceaux
function drawBucket(view, x, y, col, t) {
  const ctx = view.g;
  for (let j = 0; j < 4; j++) drawPiece(ctx, j % 3, x - 24 + j * 16, y - 66 + Math.abs(j - 1.5) * 4, 0.8, 1, t, (j - 1.5) * 0.35);
  ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(x - 40, y - 64); ctx.lineTo(x + 40, y - 64); ctx.lineTo(x + 31, y + 2); ctx.lineTo(x - 31, y + 2); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.moveTo(x - 37, y - 62); ctx.lineTo(x + 37, y - 62); ctx.lineTo(x + 29, y); ctx.lineTo(x - 29, y); ctx.closePath(); ctx.clip();
  for (let j = -4; j < 5; j++) { ctx.fillStyle = j % 2 ? '#ffffff' : '#d8202a'; ctx.fillRect(x + j * 9 - 4.5, y - 64, 9, 66); }
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 40, y - 44, 80, 22); ctx.fillStyle = col; ctx.fillRect(x - 40, y - 44, 80, 3); ctx.fillRect(x - 40, y - 25, 80, 3);
  ctx.restore();
  view.text('MASTER', x, y - 37, 8, '#d8202a', { mono: true, stroke: false });
  view.text('POULET', x, y - 28, 8, '#d8202a', { mono: true, stroke: false });
  ctx.fillStyle = INK; ctx.fillRect(x - 42, y - 67, 84, 5);
}

// un os sur la pile (rotation r)
function drawBone(ctx, x, y, r, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(r); ctx.scale(s, s);
  ctx.fillStyle = INK; ctx.fillRect(-9, -2.5, 18, 5);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * 9, sy * 2.6, 3.4, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#f4ead6'; ctx.fillRect(-9, -1.4, 18, 2.8);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * 9, sy * 2.6, 2.3, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}
// la place du n-ième os de la pile (une pyramide qui monte)
function bonePos(i, n) {
  let row = 0, cnt = 6, k = n;
  while (k >= cnt && cnt > 1) { k -= cnt; row++; cnt--; }
  const bx = BONES(i) + (k - (cnt - 1) / 2) * 13, by = TABLE + 4 - row * 7;
  return [bx, by, ((n * 2.3) % 1.2) - 0.6];
}

export default {
  title: 'MASTER POULET', color: '#ffcf3a', icon: '🍗',
  goal: 'Martèle ta touche pour croquer : le plus de poulet mangé gagne !',
  keys: [['A', 'martèle = croquer']],
  ach: [['Master Poulet 👑', 'Estomac sans fond', 'Le Colonel est fier'], ['Petit appétit', 'Régime forcé', 'Mâchoire en grève']],
  news: (L, d) => `${L} BATTU AU MASTER POULET : +${d} % DE GRAS ET D'HUMILIATION`,

  draw(view, W, M, dt) {
    const ctx = view.g, g = M.g, X = S(view), t = view.time, L = -view.ox, R = 640 + view.ox, T = -view.oy, B = 360 + view.oy;
    // le fast-food : mur rayé rouge et blanc, l'enseigne au néon, le carrelage
    ctx.fillStyle = '#2a0a10'; ctx.fillRect(L, T, R - L, B - T);
    for (let x = Math.floor(L / 40) * 40; x < R; x += 40) { ctx.fillStyle = 'rgba(255,60,60,0.16)'; ctx.fillRect(x, T, 20, TABLE - T); }
    ctx.fillStyle = 'rgba(255,207,58,0.06)'; ctx.fillRect(L, 120, R - L, 6);
    view.text('🍗 MASTER POULET', 320, 18, 18, Math.sin(t * 7) > -0.7 ? '#ffcf3a' : '#7a5a10', { title: true });
    view.timer(M, 320, 46);
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(319, 64, 2, TABLE - 66);
    // les joueurs derrière la table, la tête qui mâche
    for (let i = 0; i < 2; i++) {
      const P = g.p[i], slot = i === 0 ? M.a : M.v;
      X.pop[i] = Math.max(0, X.pop[i] - dt * 4); X.chew[i] = Math.max(0, X.chew[i] - dt * 7); X.sc[i] = Math.max(0, X.sc[i] - dt * 3);
      const ch = X.chew[i], o = { face: 'front', head: 1.9, squash: [1 + ch * 0.05, 1 - ch * 0.05] };
      if (M.t > 240 && P.s - g.p[1 - i].s >= 4) o.emote = 'select';
      if (!view.player(W, M, i, CX[i], TABLE + 112, 230, o)) view.portraitAt(W.fighters[slot].char, CX[i], 150, 64, COLORS[slot], i === 1);
    }
    // la table : nappe à carreaux
    ctx.fillStyle = INK; ctx.fillRect(L, TABLE - 2, R - L, B - TABLE + 2);
    for (let x = Math.floor(L / 16) * 16, c = 0; x < R; x += 16, c++) for (let r = 0; r < 2; r++) { ctx.fillStyle = (c + r) % 2 ? '#e8e0d8' : '#c8202a'; ctx.fillRect(x, TABLE + r * 8, 16, 8); }
    ctx.fillStyle = '#5a1a14'; ctx.fillRect(L, TABLE + 16, R - L, B - TABLE - 16);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(L, TABLE + 16, R - L, 4);
    for (let i = 0; i < 2; i++) {
      const P = g.p[i], slot = i === 0 ? M.a : M.v, col = COLORS[slot], k = g.seq[P.k % CHK.N], need = CHK.BITES[k], ch = X.chew[i];
      // le morceau en cours, tenu devant la bouche (il tremble quand on croque)
      const px = CX[i] + (i === 0 ? PIECE_DX : -PIECE_DX) + (Math.random() - 0.5) * ch * 4, py = PIECE_Y + ch * 5;
      drawPiece(ctx, k, px, py, 1.7 + X.pop[i] * 0.15, 1 - P.b / need, t, i === 0 ? -0.35 : 0.35);
      // le nom du morceau et ses bouchées (des petites dents à cocher), côté milieu de l'écran
      const ix = CX[i] + (i === 0 ? 100 : -100);
      view.text(NAMES[k], ix, PIECE_Y - 16, 10, k === 3 ? '#ffe24a' : '#f4ead6', { mono: true });
      for (let j = 0; j < need; j++) { const dx = ix + (j - (need - 1) / 2) * 11, dy = PIECE_Y; ctx.fillStyle = INK; ctx.fillRect(dx - 4.5, dy - 4.5, 9, 9); ctx.fillStyle = j < P.b ? col : '#f4ead6'; ctx.fillRect(dx - 3, dy - 3, 6, 6); }
      // comment jouer : la grosse touche qui s'enfonce à chaque bouchée, « MARTÈLE J ! »
      const early = M.t < 180, bot = W.fighters[slot].bot;
      keyCap(view, M, i, ix, PIECE_Y + 34, (early ? 1.3 + Math.max(0, Math.sin(t * 9)) * 0.12 : 1), X.chew[i] * 1.6, X.chew[i] > 0.4, bot ? null : 'MARTÈLE !', col);
      view.hint(W, M, i, ix, PIECE_Y - 38, [['A', 'croquer']]);
      // le seau et la pile d'os
      drawBucket(view, BUCKET(i), TABLE + 8, col, t);
      for (let n = 0; n < Math.min(P.n, 21); n++) { const [bx, by, r] = bonePos(i, n); drawBone(ctx, bx, by, r); }
      // le score
      view.text(`${P.s}`, CX[i], TABLE + 46, 26 + X.sc[i] * 12, col, { mono: true });
      view.text(P.s > 1 ? 'POINTS' : 'POINT', CX[i], TABLE + 66, 9, '#f4ead6', { mono: true, stroke: false });
      view.who(W, M, i, CX[i] + (i === 0 ? -108 : 108), TABLE + 34, { align: 'center', size: 0.85 });
    }
    // les os qui volent vers la pile
    X.fly = X.fly.filter((f) => t - f.t < 0.35);
    for (const f of X.fly) { const u = (t - f.t) / 0.35; drawBone(ctx, f.x0 + (f.x1 - f.x0) * u, f.y0 + (f.y1 - f.y0) * u - Math.sin(u * Math.PI) * 50, u * 9, 1.2); }
  },

  onEvent(view, ev, W, M) {
    if (!M || !ev.type.startsWith('mgChk')) return;
    const A = view.audio, X = S(view), i = ev.p, slot = i === 0 ? M.a : M.v, col = COLORS[slot], pan = i === 0 ? -0.5 : 0.5;
    const px = CX[i] + (i === 0 ? PIECE_DX : -PIECE_DX), py = PIECE_Y - 20;
    if (ev.type === 'mgChkBite') {
      X.pop[i] = 1; X.chew[i] = 1;
      view.react(i, { pop: 0.22, life: 0.12, weak: true });
      view.burst(px, py, 5, ['#ffe27a', '#ffd23a', '#fff6c0'], { shape: 'dot', speed: 130, size: 3, up: 70, life: 0.45 }); // la graisse
      view.burst(px, py, 4, ['#c8701c', '#e8a040', '#8a4a10'], { shape: 'sq', speed: 100, size: 3, up: 30, life: 0.5 }); // les miettes
      if (A) { A.sfx('wood', pan, 0.22, 2 + (ev.b % 3)); if (ev.b === 1) A.sfx('hitS', pan, 0.15, 4); }
      if (Math.random() < 0.18) view.sticker(view.pick(['CRONCH', 'MIAM', 'SCRONCH', 'CRAC']), px + (i === 0 ? 40 : -40), py - 30, { size: 11, color: '#ffffff', bg: '#a0501a', life: 0.4 });
    } else if (ev.type === 'mgChkDone') {
      X.sc[i] = 1;
      const [bx, by] = bonePos(i, Math.min(ev.n - 1, 20));
      X.fly.push({ x0: px, y0: py + 30, x1: bx, y1: by, t: view.time });
      view.react(i, { pop: 0.4, hop: 0.06, life: 0.3 });
      const gold = ev.k === 3;
      view.sticker(gold ? '+2 DORÉ ✨' : '+1', px, py - 40, { size: gold ? 18 : 15, color: gold ? INK : '#ffffff', bg: gold ? '#ffe24a' : col, life: 0.55 });
      if (A) { A.sfx('gulp', pan, 0.5); if (gold) { A.sfx('cash', pan, 0.6); A.sfx('hitmark', pan, 0.4); } }
      if (gold) view.burst(px, py, 16, ['#ffe24a', '#ffffff'], { shape: 'star', speed: 200, size: 5, life: 0.6 });
      if (ev.n % 6 === 0) {
        view.sticker(view.pick(['GLOUTON 🐷', 'ESTOMAC D\'ACIER', 'IL ASPIRE TOUT', 'MASTER POULET 👑', 'LE COLONEL APPROUVE']), CX[i], 110, { size: 17, color: '#ffffff', bg: col, life: 0.9 });
        view.jolt(0.25, 0.03); view.hype(0.3);
        if (A) { A.sfx('slurp', pan, 0.5); if (ev.n >= 12) A.say(view.pick(['Quel appétit !', 'Il dévore !', 'Encore !']), 0.55, 1.2); }
      }
    }
  },
};
