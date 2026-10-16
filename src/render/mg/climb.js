// Grimpe du bonheur (climb), l'affichage : deux colonnes côte à côte (la même tour pour les deux), chacune sa caméra qui
// suit son grimpeur ; le ciel passe de la nuit à l'aube en montant, le bonheur (un soleil qui sourit, un arc-en-ciel) brille
// tout en haut, hors d'atteinte ; la marée de larmes monte en bas. Qui tombe dedans pleure, et Nymano arrive sur son skate,
// flottant sur les larmes, lui jouer de la musique triste sur sa SP-404. À la fin, le plus bas pleure, Nymano joue.
import { COLORS } from '../../sim/constants.js';
import { CLIMB, platX } from '../../sim/mg/climb.js';
import { MG_PLAY, MG_WIN } from '../../sim/mg/common.js';

const C = CLIMB;
const COLX = [24, 336], VT = 52, VB = 352, VH = VB - VT;
const SKY = [[[18, 10, 42], [46, 22, 86]], [[70, 30, 100], [200, 80, 130]], [[255, 140, 110], [255, 214, 130]]]; // nuit, crépuscule, aube (bas, haut)
const SAD = ['C\'est pas grave... enfin si.', 'Je te joue un petit sample triste.', 'On pleure ensemble ?', 'Moi aussi je tombe tout le temps.',
  'Le bonheur, c\'était presque.', 'Allez, un sample pour toi.', 'La vie, c\'est un sample en boucle.', 'Pleure, ça fait du bien.'];
const MELODY = [0.5, -0.5, -1.5, -2.5, -1.5, -2, -3.5, -4]; // les variantes graves de « note » (une sur 12 images)
const COMBO_W = ['', '', 'BIEN !', 'SUPER !', 'GÉANT !', 'INCROYABLE !', 'BONHEUR !', 'EXTASE !'];
const ease = (t) => 1 - (1 - t) * (1 - t);

const mixc = (a, b, k) => `rgb(${Math.round(a[0] + (b[0] - a[0]) * k)},${Math.round(a[1] + (b[1] - a[1]) * k)},${Math.round(a[2] + (b[2] - a[2]) * k)})`;
function sky(h, top) {
  const u = Math.max(0, Math.min(1.999, h / (C.FLOOR * 14))), n = Math.floor(u), k = u - n;
  return mixc(SKY[n][top], SKY[n + 1][top], k);
}

function xs(view, M) {
  const X = view.xs;
  if (!X.cam) {
    X.cam = [M.g.p[0].y - 110, M.g.p[1].y - 110]; X.sq = [0, 0]; X.run = [0, 0]; X.trail = [[], []]; X.cs = [-1, -1];
    X.noteT = [0, 0]; X.spr = {}; X.spin = [0, 0]; X.wall = [0, 0]; X.dt = 1 / 60; X.lead = -1; X.sayT = -9; X.end = null; X.endN = -1; X.tearT = [0, 0];
  }
  return X;
}
// une position de la tour (colonne i) à l'écran
const sx = (i, x) => COLX[i] + x;
const sy = (X, i, y) => VB - (y - X.cam[i]);

function drawPlat(ctx, view, p, x, y, br, t, used) {
  const w = p[2];
  let ox = 0;
  if (br > 0) ox = (Math.random() - 0.5) * 2.5 * br / C.CRACK;
  x += ox;
  ctx.fillStyle = '#0b0610'; ctx.fillRect(x - 2, y - 2, w + 4, 13);
  if (p[3] === 3) {
    ctx.fillStyle = '#c8901a'; ctx.fillRect(x, y, w, 9); ctx.fillStyle = '#ffe24a'; ctx.fillRect(x, y, w, 4); ctx.fillStyle = '#fff6c0'; ctx.fillRect(x + 2, y + 1, w - 4, 1);
    for (let k = 8; k < w - 4; k += 16) { ctx.fillStyle = '#a87010'; ctx.fillRect(x + k, y + 5, 6, 2); }
    if (w < C.CW) view.text(p[8] ? `ÉTAGE ${p[8]}` : 'DÉPART', x + w / 2, y - 9, 9, '#ffe24a', { mono: true });
  } else if (p[3] === 1) {
    ctx.fillStyle = '#9a6020'; ctx.fillRect(x, y, w, 9); ctx.fillStyle = '#e8b070'; ctx.fillRect(x, y, w, 6);
    ctx.fillStyle = '#8a5018'; for (let k = 5; k < w - 3; k += 9) ctx.fillRect(x + k, y + 2 + (k % 2), 2, 2);
    if (br > 0) { ctx.strokeStyle = '#3a1a08'; ctx.lineWidth = 1; ctx.beginPath(); const n = 1 + (br / 8 | 0); for (let c = 0; c < n; c++) { const cx = x + w * (0.2 + 0.6 * ((c * 0.37) % 1)); ctx.moveTo(cx, y); ctx.lineTo(cx + 3, y + 4); ctx.lineTo(cx - 1, y + 9); } ctx.stroke(); }
  } else if (p[3] === 2) {
    ctx.fillStyle = '#0b0610'; ctx.fillRect(x - 2, y - 2, w + 4, 13);
    ctx.fillStyle = '#9ac0ff'; ctx.fillRect(x, y + 3, w, 6);
    ctx.fillStyle = '#f2f8ff';
    for (let k = 0; k <= w; k += 12) { ctx.beginPath(); ctx.arc(x + k, y + 3, 5 + ((k / 12) % 2) * 2, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillRect(x, y, w, 5);
    view.text('↔', x + w / 2, y + 5, 8, '#5a7ac0', { stroke: false });
  } else {
    ctx.fillStyle = '#7a2a6a'; ctx.fillRect(x, y, w, 9); ctx.fillStyle = '#e070b8'; ctx.fillRect(x, y, w, 5); ctx.fillStyle = '#ffc0ea'; ctx.fillRect(x + 1, y + 1, w - 2, 1);
  }
  if (p[7] >= 0) { // le ressort
    const rx = x + p[7], q = used > 0 ? used / 0.4 : 0, hgt = 11 - q * 7 + Math.sin(t * 40) * q * 3;
    ctx.strokeStyle = '#0b0610'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(rx, y); for (let s = 1; s <= 4; s++) ctx.lineTo(rx + (s % 2 ? 4 : -4), y - hgt * s / 4); ctx.stroke();
    ctx.strokeStyle = '#ff3a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(rx, y); for (let s = 1; s <= 4; s++) ctx.lineTo(rx + (s % 2 ? 4 : -4), y - hgt * s / 4); ctx.stroke();
    ctx.fillStyle = '#0b0610'; ctx.fillRect(rx - 7, y - hgt - 4, 14, 5); ctx.fillStyle = '#ffd23a'; ctx.fillRect(rx - 6, y - hgt - 3, 12, 3);
  }
}

// Nymano, toujours triste, sur son skate, sa SP-404 sur les genoux ; il pleure aussi
function drawNymano(view, x, y, t, flip, a = 1, sc = 1) {
  const ctx = view.g;
  ctx.save(); ctx.globalAlpha = a;
  if (sc !== 1) { ctx.translate(x, y + 19); ctx.scale(sc, sc); ctx.translate(-x, -y - 19); }
  ctx.fillStyle = '#0b0610'; ctx.fillRect(x - 15, y + 13, 30, 5); ctx.fillStyle = '#c86a2a'; ctx.fillRect(x - 14, y + 13, 28, 3); // le skate
  ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.arc(x - 9, y + 19, 2.5, 0, 7); ctx.arc(x + 9, y + 19, 2.5, 0, 7); ctx.fill();
  ctx.fillStyle = '#3a4a7a'; ctx.fillRect(x - 7, y - 2, 14, 15); // le corps
  view.portraitAt('nymano', x, y - 13, 20, '#5a8aff', flip, a);
  // ses larmes, en deux arcs
  ctx.fillStyle = '#7ad8ff';
  for (let s = 0; s < 6; s++) { const u = ((t * 2.4 + s / 6) % 1); for (const d of [-1, 1]) { ctx.fillRect(x + d * (5 + u * 14), y - 14 + u * u * 22 - u * 6, 2, 2); } }
  // la SP-404 : des pads qui s'allument
  const px = x + (flip ? -16 : 16), py = y + 4;
  ctx.fillStyle = '#0b0610'; ctx.fillRect(px - 11, py - 7, 22, 14); ctx.fillStyle = '#6a6a72'; ctx.fillRect(px - 10, py - 6, 20, 12);
  for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) {
    const on = Math.floor(t * 6 + r * 3 + c * 5) % 5 === 0;
    ctx.fillStyle = on ? ['#ff5a8a', '#ffd23a', '#7cff8a', '#7ad8ff'][c] : '#2a2a32'; ctx.fillRect(px - 8 + c * 4.5, py - 4 + r * 5, 3.5, 3.5);
  }
  ctx.restore();
}

function drawBonheur(view, cx, cy, t, run) {
  const ctx = view.g;
  // l'arc-en-ciel
  const rb = ['#ff4a4a', '#ff9a3a', '#ffe24a', '#5adf6a', '#4aa8ff', '#9a6aff'];
  for (let k = 0; k < rb.length; k++) { ctx.strokeStyle = rb[k]; ctx.globalAlpha = 0.55; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy + 34, 92 - k * 4, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke(); }
  ctx.globalAlpha = 1;
  // les rayons qui tournent
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * 0.6);
  ctx.fillStyle = 'rgba(255,240,150,0.35)';
  for (let k = 0; k < 12; k++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 44 + Math.sin(t * 5 + k) * 4, k * Math.PI / 6, k * Math.PI / 6 + 0.16); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  const s = 1 + Math.sin(t * 3) * 0.05;
  ctx.save(); ctx.translate(cx + Math.sin(t * 1.7) * 6 * run, cy + Math.sin(t * 2.3) * 3); ctx.scale(s, s);
  ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.arc(0, 0, 21, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.arc(0, 0, 19, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff2a0'; ctx.beginPath(); ctx.arc(-5, -6, 8, 0, 7); ctx.fill();
  ctx.fillStyle = '#0b0610'; ctx.fillRect(-8, -5, 4, 5); ctx.fillRect(4, -5, 4, 5);
  ctx.strokeStyle = '#0b0610'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 2, 8, 0.25, Math.PI - 0.25); ctx.stroke();
  ctx.fillStyle = '#ff8ac0'; ctx.fillRect(-14, 3, 5, 3); ctx.fillRect(9, 3, 5, 3);
  ctx.restore();
}

// les persos du jeu (aussi pendant l'explication, d'après la clé de la vue « jeu:a:v ») et leurs clés de marionnette :
// deux fois le même perso = deux clés ; le Nymano musicien a la sienne par colonne (il peut aussi être un des grimpeurs)
function chars(view, W, M) {
  if (W && M) return [W.fighters[M.a].char, W.fighters[M.v].char];
  const k = String(view.key || '').split(':'), vs = view.mv && view.mv.views;
  const a = vs && vs[+k[1]], v = vs && vs[+k[2]];
  return a && v && a.char && v.char ? [a.char, v.char] : null;
}
const pkey = (cs, i) => (i && cs[1] === cs[0] ? cs[1] + '#2' : cs[i]);
const nkey = (cs, i) => (i === 0 && cs[0] !== 'nymano' && cs[1] !== 'nymano' ? 'nymano' : `nymano#${i}`);
const NO_EMOTE = { epektase: 1, pprod: 1 }; // pas de clip « sob » chez eux : ils restent sonnés, des étoiles autour de la tête

// Nymano en vrai 3D, sur les larmes : il glisse jusqu'au perdant en sanglotant (sa provocation), puis chante en jouant
// sa SP-404 (sa danse de victoire) ; sa SP-404 en 2D par-dessus (les pads qui s'allument), ses larmes en deux arcs
function nymano3D(view, key, x, y, h, t, side, mode, a = 1) {
  const ctx = view.g;
  const sing = mode === 'sing', bob = Math.sin(t * 3) * 0.03;
  const ok = view.puppet('nymano', x, y, h, {
    key, emote: sing ? 'sing_02' : 'select', face: side < 0 ? -0.75 : 0.75, head: 2.1, alpha: a, shadow: false,
    squash: [1 + bob, 1 - bob], rot: sing ? Math.sin(t * 2.2) * 0.06 : 0,
  });
  if (!ok) { drawNymano(view, x, y - 19 * h / 40, t, side < 0, a, h / 40); return; }
  ctx.save(); ctx.globalAlpha = a;
  // le skate sous ses pieds, qui flotte
  ctx.fillStyle = '#0b0610'; ctx.fillRect(x - h * 0.42, y - 1, h * 0.84, 5); ctx.fillStyle = '#c86a2a'; ctx.fillRect(x - h * 0.4, y - 1, h * 0.8, 3);
  ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.arc(x - h * 0.26, y + 5, 2.5, 0, 7); ctx.arc(x + h * 0.26, y + 5, 2.5, 0, 7); ctx.fill();
  // les larmes, en deux arcs, depuis sa (grosse) tête
  const hy = y - h * 1.08;
  ctx.fillStyle = '#7ad8ff';
  for (let s = 0; s < 7; s++) { const u = ((t * 2.4 + s / 7) % 1); for (const d of [-1, 1]) ctx.fillRect(x + d * (6 + u * 18), hy + u * u * 30 - u * 8, 2.5, 2.5); }
  if (sing) { // la SP-404, devant lui
    const px = x + side * h * 0.4, py = y - h * 0.4, k = Math.max(1, h / 40);
    ctx.translate(px, py); ctx.scale(k, k); ctx.rotate(side * -0.12);
    ctx.fillStyle = '#0b0610'; ctx.fillRect(-11, -7, 22, 14); ctx.fillStyle = '#6a6a72'; ctx.fillRect(-10, -6, 20, 12);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) {
      const on = Math.floor(t * 6 + r * 3 + c * 5) % 5 === 0;
      ctx.fillStyle = on ? ['#ff5a8a', '#ffd23a', '#7cff8a', '#7ad8ff'][c] : '#2a2a32'; ctx.fillRect(-8 + c * 4.5, -4 + r * 5, 3.5, 3.5);
    }
  }
  ctx.restore();
}

// un grimpeur : son vrai modèle, grosse tête ; il court, saute (salto sur les combos et les ressorts), s'écrase en
// atterrissant, se cogne aux murs, coule dans les larmes en culbutant puis y sanglote ; à la fin, le gagnant danse
function drawClimber(view, W, M, X, i, slot, P, t, sad, cs) {
  const ctx = view.g, x = sx(i, P.x), y = sy(X, i, P.y), cry = P.cry || sad, ch = cs[i];
  const sq = X.sq[i], air = P.gr < 0 && !cry;
  // la traînée quand ça va vite
  for (let k = 0; k < X.trail[i].length; k++) {
    const q = X.trail[i][k];
    ctx.globalAlpha = 0.1 + k * 0.035; ctx.fillStyle = COLORS[slot]; ctx.beginPath(); ctx.ellipse(q[0], sy(X, i, q[1]) - 22, 10, 21, 0, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
  const blink = P.inv > 0 && Math.floor(t * 20) % 2;
  // l'auréole de sa couleur, au sol (qui est qui)
  if (!air && !cry) { ctx.fillStyle = COLORS[slot]; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.ellipse(x, y + 1, 13, 3.5, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
  const H = 38, o = { key: pkey(cs, i), head: 2.1, shadow: false, alpha: blink ? 0.35 : 1, face: P.face < 0 ? -1.15 : 1.15 };
  let fx = x, fy = y;
  const e = P.cry ? C.CRY - P.cry : 99;
  const win = M.ph === 'outro' && X.end && X.end.l >= 0 && X.end.l !== i;
  if (cry) {
    if (e < 16) { // il coule : culbute, la tête la première
      o.state = 'hitstun'; o.kb = 120; o.rot = (P.face < 0 ? -1 : 1) * (1.2 + e * 0.35);
    } else if (NO_EMOTE[ch]) { o.state = 'dizzy'; o.face = 'front'; }
    else { o.emote = 'sob'; o.face = 'front'; o.squash = [1 + Math.sin(t * 14) * 0.05, 1 - Math.sin(t * 14) * 0.05]; }
    if (e < 16) { const r = o.rot, cx = x, cy = y - H * 0.5; fx = cx - Math.sin(r) * H * 0.5; fy = cy + Math.cos(r) * H * 0.5; }
  } else if (win) {
    o.emote = 'win'; o.face = 'front'; o.head = 2;
  } else if (air) {
    const flip = P.vy > 11 || P.combo >= 2; // salto : ressort, combo
    if (flip) { X.spin[i] += (P.face < 0 ? -1 : 1) * X.dt * 13; o.state = 'helpless'; } else { X.spin[i] = 0; o.state = 'air'; o.vy = P.vy * 0.6; }
    if (X.wall[i] > 0) { o.state = 'hitstun'; o.kb = 60; }
    const st = P.vy > 4 ? 0.18 : P.vy < -6 ? -0.08 : 0;
    o.squash = [1 - st * 0.6, 1 + st];
    if (X.spin[i]) { const r = X.spin[i], cx = x, cy = y - H * 0.5; o.rot = r; fx = cx - Math.sin(r) * H * 0.5; fy = cy + Math.cos(r) * H * 0.5; }
    else o.rot = P.vx * 0.04;
  } else {
    X.spin[i] = 0;
    const v = Math.abs(P.vx);
    o.state = v > 2.4 ? 'run' : v > 0.4 ? 'walk' : 'idle';
    o.squash = [1 + Math.max(0, sq) * 0.45 - Math.max(0, -sq) * 0.2, 1 - Math.max(0, sq) * 0.38 + Math.max(0, -sq) * 0.25];
    if (P.combo >= 2 && v < 0.4) o.emote = 'cheer';
  }
  if (!view.puppet(ch, fx, fy, H, o)) { // pas de 3D : la tête en portrait
    view.portraitAt(ch, x, y - 14, 20, COLORS[slot], P.face < 0, blink ? 0.35 : 1);
  }
  if (cry) {
    // les larmes à chaudes larmes : deux fontaines, depuis la grosse tête
    ctx.fillStyle = '#7ad8ff';
    for (let s = 0; s < 10; s++) { const u = ((t * 3 + s / 10) % 1); for (const d of [-1, 1]) ctx.fillRect(x + d * (8 + u * 28), y - 52 - u * 10 + u * u * 50, 2.5, 2.5); }
    view.text('😭', x + 22, y - 66 + Math.sin(t * 8) * 2, 14, '#fff', { stroke: false });
  } else if (P.combo >= 2) view.text(`x${P.combo}`, x, y - 70, 11 + Math.min(8, P.combo), '#ffe24a', { mono: true });
}

export default {
  title: 'GRIMPE DU BONHEUR', color: '#ffd23a', icon: '🌈', puppets: ['nymano'],
  goal: 'Saute de plateforme en plateforme : le plus haut gagne !',
  keys: [['lr', 'courir'], ['JUMP', 'sauter']],
  tags: false, // (son en-tête dit qui est qui)
  // pendant la présentation : toutes les marionnettes du jeu rendues une fois (pas d'à-coup au premier dessin)
  warm(view, W, M) {
    const cs = chars(view, W, M);
    for (const [c, k] of [[cs[0], pkey(cs, 0)], [cs[1], pkey(cs, 1)], ['nymano', nkey(cs, 0)], ['nymano', nkey(cs, 1)]]) view.puppet(c, -9999, -9999, 10, { key: k, shadow: false });
  },
  ach: [['Chercheur de bonheur', 'Toujours plus haut', 'Icy Tower d\'or', 'Grimpeur du dimanche (le meilleur)'], ['Fan de Nymano', 'Larmes de crocodile', 'Le bonheur, c\'est surfait', 'Abonné au sous-sol']],
  news: (L, d) => `${L} RESTE EN BAS DE LA TOUR : NYMANO LUI JOUE DU TRISTE (+${d} %)`,

  draw(view, W, M, dt) {
    const ctx = view.g, g = M.g, X = xs(view, M), t = view.time, L = -view.ox, Rr = 640 + view.ox, T = -view.oy, B = 360 + view.oy;
    const slots = [M.a, M.v], cs = chars(view, W, M);
    X.dt = dt;
    const top = Math.max(g.p[0].best, g.p[1].best);
    // le fond : la nuit en bas, l'aube en haut de la tour
    const bg = ctx.createLinearGradient(0, T, 0, B); bg.addColorStop(0, sky(top, 1)); bg.addColorStop(1, '#0b0610');
    ctx.fillStyle = bg; ctx.fillRect(L, T, Rr - L, B - T);
    const end = M.ph === 'outro' || M.t >= MG_PLAY - 1;
    for (let i = 0; i < 2; i++) {
      const P = g.p[i], slot = slots[i], x0 = COLX[i];
      // la caméra
      const want = P.y - (P.cry ? 150 : 110);
      X.cam[i] += (want - X.cam[i]) * (1 - Math.exp(-dt * (P.cry ? 3 : 7)));
      const cam = X.cam[i];
      X.sq[i] = X.sq[i] > 0 ? Math.max(0, X.sq[i] - dt * 5) : Math.min(0, X.sq[i] + dt * 4); X.wall[i] = Math.max(0, X.wall[i] - dt);
      X.run[i] += Math.abs(P.vx) * dt * 4;
      if (Math.abs(P.vx) > 3.6 || P.vy > 10) { X.trail[i].push([sx(i, P.x), P.y]); if (X.trail[i].length > 5) X.trail[i].shift(); } else if (X.trail[i].length) X.trail[i].shift();
      ctx.save(); ctx.beginPath(); ctx.rect(x0, VT, C.CW, VH); ctx.clip();
      const sk = ctx.createLinearGradient(0, VT, 0, VB); sk.addColorStop(0, sky(cam + VH, 1)); sk.addColorStop(1, sky(cam, 0));
      ctx.fillStyle = sk; ctx.fillRect(x0, VT, C.CW, VH);
      // étoiles (elles s'effacent à l'aube) et nuages lointains
      const night = Math.max(0, 1 - cam / (C.FLOOR * 16));
      for (let s = 0; s < 26; s++) {
        const yy = VB - ((s * 71 + 9999 - cam * 0.25) % 330), xx = x0 + (s * 97) % C.CW;
        ctx.globalAlpha = night * (0.4 + 0.6 * Math.abs(Math.sin(t * 2 + s))); ctx.fillStyle = '#fff6d0'; ctx.fillRect(xx, yy, 2, 2);
      }
      ctx.globalAlpha = 0.18 + (1 - night) * 0.2; ctx.fillStyle = '#ffffff';
      for (let s = 0; s < 5; s++) {
        const yy = VB - ((s * 123 + 9999 - cam * 0.5) % 380) + 20, xx = x0 + ((s * 151 + t * (6 + s * 3)) % (C.CW + 80)) - 40;
        ctx.beginPath(); ctx.arc(xx, yy, 14, 0, 7); ctx.arc(xx + 16, yy - 6, 18, 0, 7); ctx.arc(xx + 34, yy, 13, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
      // le bonheur, tout en haut, hors d'atteinte (il s'éloigne quand on monte vite)
      ctx.fillStyle = 'rgba(255,240,170,0.08)';
      ctx.beginPath(); ctx.moveTo(x0 + C.CW / 2 - 20, VT); ctx.lineTo(x0 + C.CW / 2 + 20, VT); ctx.lineTo(x0 + C.CW / 2 + 120, VB); ctx.lineTo(x0 + C.CW / 2 - 120, VB); ctx.fill();
      drawBonheur(view, x0 + C.CW / 2, VT + 24 - Math.min(10, Math.max(0, P.vy) * 0.8), t + i, Math.min(1, Math.abs(P.vx) / 4));
      // les murs de la tour
      for (const wx of [x0, x0 + C.CW - 7]) {
        ctx.fillStyle = '#3a2a4a'; ctx.fillRect(wx, VT, 7, VH);
        ctx.fillStyle = '#5a4470';
        for (let by = ((cam % 14) + 14) % 14 - 14; by < VH; by += 14) ctx.fillRect(wx + (Math.floor((by - cam) / 14) % 2 ? 0 : 3), VB - by - 12, 4, 6);
      }
      // les plateformes visibles
      const k0 = Math.max(0, Math.floor(cam / C.FLOOR) - 1), k1 = Math.min(C.FLOORS, Math.ceil((cam + VH) / C.FLOOR) + 1);
      for (let k = k0; k <= k1; k++) {
        const yy = sy(X, i, k * C.FLOOR);
        if (k % 5 === 0 && k) view.text(String(k), x0 + 14, yy - 14, 9, '#ffe24a', { mono: true });
        for (let j = g.fi[k]; j < g.fi[k + 1]; j++) {
          if (P.br[j] < 0) continue;
          const p = g.pl[j];
          drawPlat(ctx, view, p, x0 + platX(p, g.t), yy, P.br[j], t, X.spr[i * 1000 + j] ? X.spr[i * 1000 + j] - t : 0);
        }
      }
      // le record
      if (P.best > 0) {
        const ry = sy(X, i, P.best);
        if (ry > VT && ry < VB) { ctx.strokeStyle = 'rgba(255,226,74,0.6)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0 + 8, ry + 0.5); ctx.lineTo(x0 + C.CW - 8, ry + 0.5); ctx.stroke(); ctx.setLineDash([]); view.text('RECORD', x0 + C.CW - 12, ry - 6, 7, '#ffe24a', { align: 'right', mono: true, stroke: false }); }
      }
      drawClimber(view, W, M, X, i, slot, P, t, end && X.end && X.end.l === i, cs);
      // la marée de larmes
      const ty = sy(X, i, P.tide);
      if (ty < VB + 10) {
        ctx.fillStyle = 'rgba(70,150,255,0.62)'; ctx.fillRect(x0, ty, C.CW, VB - ty + 10);
        ctx.fillStyle = 'rgba(160,220,255,0.9)';
        for (let k = 0; k < C.CW; k += 4) ctx.fillRect(x0 + k, ty + Math.sin(t * 4 + k * 0.08 + i) * 2.5 - 1, 4, 3);
        ctx.fillStyle = 'rgba(220,245,255,0.6)';
        for (let s = 0; s < 8; s++) { const bx = x0 + ((s * 37 + t * 9) % C.CW), by = ty + 8 + ((s * 23 - t * 20) % 40 + 40) % 40; if (by < VB) { ctx.beginPath(); ctx.arc(bx, by, 1.5 + (s % 3), 0, 7); ctx.fill(); } }
        if (ty < VB - 14) view.text('~ LARMES ~', x0 + C.CW / 2, Math.max(ty + 12, VT + 10), 9, '#d8f0ff', { mono: true, alpha: 0.8 });
      } else if (!P.cry) { // les larmes, plus bas : à quelle distance
        const m = Math.max(0, Math.round((P.y - P.tide) / C.M)), hot = m < 12;
        ctx.fillStyle = hot ? `rgba(70,150,255,${0.35 + 0.25 * Math.sin(t * 12)})` : 'rgba(70,150,255,0.25)'; ctx.fillRect(x0, VB - 5, C.CW, 5);
        view.text(`💧 larmes ${m} m plus bas ▼`, x0 + C.CW / 2, VB - 13, hot ? 10 : 8, hot ? '#ffffff' : '#bfe8ff', { mono: true, alpha: hot ? 1 : 0.7 });
      }
      // Nymano : il vient jouer du triste à qui pleure
      if (P.cry > 0) {
        const e = C.CRY - P.cry, side = P.x > C.CW / 2 ? -1 : 1, inn = ease(Math.min(1, e / 14)), out = Math.min(1, P.cry / 10);
        const nx = sx(i, P.x) + side * (74 + (1 - inn) * 200 + (1 - out) * 160), ny = sy(X, i, P.tide) + 2 + Math.sin(t * 3) * 2;
        nymano3D(view, nkey(cs, i), nx, ny, 54, t, -side, e > 12 ? 'sing' : 'sob');
        if (e > 10) view.text(`♪ ${['la', 'ré', 'fa', 'do', 'mi', 'si', 'sol', 'la'][(e / 12 | 0) % 8]}... ♪`, nx, ny - 104, 12, '#bfe8ff', { mono: true });
        if (e > 6 && e < 50) view.text('NYMANO', nx, ny + 16, 10, '#7ad8ff', { mono: true });
      } else if (!end && M.t > MG_PLAY - 120 && g.lead === 1 - i) {
        // la fin approche : Nymano s'échauffe en bas de la colonne du dernier
        const ny = Math.min(VB - 4, sy(X, i, P.tide) + 2), nx = x0 + 40 + Math.sin(t * 1.3) * 10;
        nymano3D(view, nkey(cs, i), nx, ny, 44, t, 1, 'sob', Math.min(1, (M.t - (MG_PLAY - 120)) / 20));
        view.text('Nymano s\'échauffe...', nx + 22, ny - 66, 8, '#7ad8ff', { align: 'left', mono: true });
      }
      if (end && X.end && X.end.l === i) { // le perdant pleure, Nymano joue
        const nx = sx(i, P.x) + (P.x > C.CW / 2 ? -66 : 66), ny = sy(X, i, P.y) + 2;
        nymano3D(view, nkey(cs, i), nx, ny, 50, t, P.x > C.CW / 2 ? 1 : -1, 'sing');
      }
      ctx.restore();
      // le cadre de la colonne
      ctx.strokeStyle = '#0b0610'; ctx.lineWidth = 4; ctx.strokeRect(x0 - 1, VT - 1, C.CW + 2, VH + 2);
      ctx.strokeStyle = COLORS[slot]; ctx.lineWidth = 2; ctx.strokeRect(x0 + 1, VT + 1, C.CW - 2, VH - 2);
      // l'en-tête : la tête, le nom, la hauteur
      const lead = g.lead === i;
      view.portraitAt(W.fighters[slot].char, x0 + 16, VT - 22, 26 + (lead ? (view.beatPop || 0) * 4 : 0), COLORS[slot], false);
      view.text(view.label(W, slot), x0 + 36, VT - 34, 11, COLORS[slot], { align: 'left', mono: true });
      view.text(`${Math.round(P.best / C.M)} m`, x0 + 36, VT - 16, 20, '#ffffff', { align: 'left', mono: true });
      view.text(`étage ${P.f}`, x0 + 112, VT - 14, 9, '#c8bad8', { align: 'left', mono: true });
      if (lead) view.text('👑 EN TÊTE', x0 + C.CW - 4, VT - 34, 10, '#ffe24a', { align: 'right', mono: true });
      if (P.falls) view.text(`😭 x${P.falls}`, x0 + C.CW - 4, VT - 16, 11, '#7ad8ff', { align: 'right', mono: true });
      if (P.combo >= 2) view.text(`COMBO x${P.combo}`, x0 + C.CW / 2 + 40, VT - 16, 12 + Math.min(8, P.combo), '#ff8ad0', { mono: true });
    }
    // la jauge du milieu : qui est le plus près du bonheur
    const gx = 320, gt = VT + 46, gb = VB - 6, span = Math.max(C.FLOOR * 8, top * 1.15);
    ctx.fillStyle = '#0b0610'; ctx.fillRect(gx - 4, gt, 8, gb - gt); ctx.fillStyle = '#3a2a4a'; ctx.fillRect(gx - 2, gt, 4, gb - gt);
    view.text('☀', gx, gt - 8, 14, '#ffd23a', { stroke: false });
    for (let i = 1; i >= 0; i--) {
      const P = g.p[i], yy = gb - (gb - gt) * Math.min(1, P.y / span);
      ctx.fillStyle = COLORS[slots[i]]; ctx.fillRect(gx - 2, yy, 4, gb - yy);
      view.portraitAt(W.fighters[slots[i]].char, gx + (i ? 6 : -6), yy, 10, COLORS[slots[i]], false);
    }
    view.timer(M, 320, 24);
    // les notes tristes de Nymano (sur les images de la simulation : P.cry), pendant qu'un grimpeur pleure
    const A = view.audio;
    for (let i = 0; i < 2; i++) {
      const P = g.p[i];
      if (!P.cry) { X.cs[i] = -1; continue; }
      const e = C.CRY - P.cry;
      if (e >= 10 && Math.floor((e - 10) / 12) !== Math.floor((X.cs[i] - 10) / 12) && X.cs[i] >= 0) {
        const n = Math.floor((e - 10) / 12);
        if (A) A.sfx('note', i ? 0.4 : -0.4, 0.5, MELODY[n % MELODY.length]);
        const side = P.x > C.CW / 2 ? -1 : 1, nx = sx(i, P.x) + side * 74, ny = sy(X, i, P.tide) - 90;
        view.burst(nx, ny, 2, ['#7ad8ff', '#bfe8ff'], { shape: 'txt', ch: view.pick(['♪', '♫', '🎵']), dir: -Math.PI / 2, spread: 1.2, speed: 60, up: 20, g: 40, life: 1.2, size: 7 });
      }
      X.cs[i] = e;
      if ((X.tearT[i] -= dt) <= 0) { X.tearT[i] = 0.12; view.burst(sx(i, P.x), sy(X, i, P.y) - 46, 2, ['#7ad8ff', '#bfe8ff', '#ffffff'], { shape: 'dot', speed: 120, up: 90, g: 380, life: 0.6, size: 3 }); }
    }
    // l'écran de fin : la mélodie triste continue pour le perdant
    if (M.ph === 'outro' && X.end && X.end.l >= 0) {
      const n = Math.floor(M.t / 12);
      if (n !== X.endN && M.t < MG_WIN - 20) {
        X.endN = n;
        if (A) A.sfx('note', 0, 0.45, MELODY[n % MELODY.length] - 0.5);
        if (n % 2 === 0) view.burst(COLX[X.end.l] + C.CW / 2, 40, 3, ['#7ad8ff', '#bfe8ff'], { shape: 'txt', ch: view.pick(['♪', '♫', '🎵', '💧']), dir: Math.PI / 2, spread: 2, speed: 50, up: -10, g: 60, life: 1.6, size: 9 });
      }
    }
  },

  onEvent(view, ev, W, M) {
    if (!M || M.kind !== 'climb' || !M.g || !M.g.p) return;
    const A = view.audio, X = xs(view, M), g = M.g;
    if (!ev.type.startsWith('mgClimb') && ev.type !== 'mgEnd' && ev.type !== 'mgGo') return;
    const i = ev.p, P = i === 0 || i === 1 ? g.p[i] : null;
    const px = P ? sx(i, P.x) : 320, py = P ? sy(X, i, P.y) : 180, pan = i === 0 ? -0.4 : i === 1 ? 0.4 : 0;
    switch (ev.type) {
      case 'mgGo':
        view.sticker('GRIMPEZ ! ☀️', 320, 160, { size: 30, color: '#0b0610', bg: '#ffd23a', life: 0.9 });
        if (A) A.say('Grimpez vers le bonheur !', 0.55, 1.15);
        break;
      case 'mgClimbJump':
        X.sq[i] = -0.6;
        if (A) A.sfx(ev.v > 3.4 ? 'jump2' : 'jump', pan, 0.35 + Math.min(0.25, ev.v * 0.05), 1 + Math.round(ev.v));
        view.burst(px, py, ev.v > 3.4 ? 8 : 4, ['#ffffff', '#e8dcc4'], { shape: 'dot', speed: 60, up: 20, g: 100, life: 0.35, size: 3 });
        break;
      case 'mgClimbLand':
        X.sq[i] = Math.min(1, 0.5 + Math.max(0, ev.sk) * 0.2);
        if (A) A.sfx('land', pan, 0.3);
        view.burst(px, py, 6, ['#ffffff', '#ffc0ea'], { shape: 'sq', dir: -Math.PI / 2, spread: 2.6, speed: 70, up: 10, g: 120, life: 0.35, size: 3 });
        if (ev.sk >= 2) {
          const c = ev.c, word = COMBO_W[Math.min(COMBO_W.length - 1, c + 1)] || 'COMBO !';
          view.sticker(c >= 2 ? `${word} x${c}` : `${ev.sk} ÉTAGES !`, px, py - 76, { size: 13 + Math.min(10, c * 2), color: '#ffffff', bg: c >= 4 ? '#ff3a8a' : '#a04ae0', life: 0.8 });
          view.burst(px, py - 20, 10 + c * 4, ['#ffe24a', '#ff8ad0', '#ffffff'], { shape: 'star', speed: 160, size: 4, life: 0.6 });
          if (A) { A.sfx('blip', pan, 0.5, 2 + c * 2); if (c >= 3) A.sfx('airhorn', pan, 0.3); }
          view.jolt(0.2 + c * 0.06, 0.02 + c * 0.006); view.hype(0.15 + c * 0.08);
          if (c >= 4 && A && view.time - X.sayT > 2) { X.sayT = view.time; A.say(view.pick(['Quel combo !', 'Il vole !', 'Toujours plus haut !']), 0.6, 1.2); }
        }
        break;
      case 'mgClimbSpring': {
        for (let j = g.fi[P.f]; j < g.fi[P.f + 1]; j++) if (g.pl[j][7] >= 0) X.spr[i * 1000 + j] = view.time + 0.4;
        if (A) { A.sfx('boing', pan, 0.8); A.sfx('whoosh', pan, 0.4); }
        view.sticker('BOING !', px, py - 66, { size: 20, color: '#0b0610', bg: '#ffe24a', life: 0.7 });
        view.burst(px, py, 18, ['#ff3a3a', '#ffe24a', '#ffffff'], { shape: 'star', dir: -Math.PI / 2, spread: 1.6, speed: 200, size: 4, life: 0.6 });
        view.jolt(0.4, 0.05); view.lines(0.4);
        break;
      }
      case 'mgClimbCrack':
        if (A) A.sfx('wood', pan, 0.5);
        view.burst(px, py + 4, 5, ['#e8b070', '#9a6020'], { shape: 'sq', speed: 60, up: 10, size: 3, life: 0.5 });
        break;
      case 'mgClimbBreak': {
        const p = g.pl[ev.k], bx = COLX[i] + platX(p, g.t) + p[2] / 2, by = sy(X, i, p[1]);
        if (by > VT && by < VB) {
          if (A) A.sfx('woodM', pan, 0.6);
          view.burst(bx, by + 4, 16, ['#e8b070', '#9a6020', '#c88040'], { shape: 'sq', dir: Math.PI / 2, spread: 2, speed: 90, up: -20, g: 400, size: 5, life: 0.8 });
          view.sticker('CRAC !', bx, by - 14, { size: 14, color: '#ffffff', bg: '#9a6020', life: 0.6 });
        }
        break;
      }
      case 'mgClimbWall':
        X.wall[i] = 0.25;
        if (A) A.sfx('thud', pan, 0.5);
        view.burst(px + (ev.s < 0 ? -6 : 6), py - 12, 10, ['#ffffff', '#ffe24a'], { shape: 'star', dir: ev.s < 0 ? 0 : Math.PI, spread: 1.4, speed: 140, size: 3, life: 0.4 });
        view.sticker('REBOND !', px, py - 64, { size: 11, color: '#ffffff', bg: '#4a6aff', life: 0.5 });
        view.jolt(0.2, 0.02);
        break;
      case 'mgClimbComboEnd':
        if (ev.c >= 3) view.sticker(`COMBO x${ev.c} ✔`, COLX[i] + C.CW / 2, VT + 70, { size: 14, color: '#ffffff', bg: '#6a3aa0', life: 0.7 });
        break;
      case 'mgClimbFloor':
        view.sticker(`ÉTAGE ${ev.f} ! ☀️`, COLX[i] + C.CW / 2, 150, { size: 24, color: '#0b0610', bg: '#ffe24a', life: 1 });
        view.burst(COLX[i] + C.CW / 2, 150, 40, ['#ffe24a', '#ff8ad0', '#7cff8a', '#7ad8ff', '#ffffff'], { speed: 220, size: 5, life: 1 });
        if (A) { A.sfx('cash', pan, 0.6); A.sfx('airhorn', pan, 0.4); A.crowd(); }
        view.jolt(0.5, 0.06, '#fff6c0', 0.25); view.hype(0.6);
        break;
      case 'mgClimbLead':
        X.lead = i;
        view.sticker('👑 EN TÊTE !', COLX[i] + C.CW / 2, VT + 24, { size: 14, color: '#0b0610', bg: '#ffe24a', life: 0.7 });
        if (A) { A.sfx('countHi', pan, 0.35); if (view.time - X.sayT > 2.5) { X.sayT = view.time; A.say(`${view.pname(ev.p === 0 ? M.a : M.v)} passe devant !`, 0.55, 1.2); } }
        break;
      case 'mgClimbCry': {
        const ty = sy(X, i, P.tide);
        if (A) { A.sfx('wave', pan, 0.7); A.sfx('sob', pan, 0.9); A.sfx('sample', pan, 0.5); A.say(view.pick(SAD), 0.22, 0.8); }
        view.sticker(view.pick(['😭 BOUHOUHOU', '😭 SNIF SNIF', '😭 OUIN OUIN', '😢 PLOUF']), COLX[i] + C.CW / 2, VT + 50, { size: 20, color: '#ffffff', bg: '#3a6ad0', life: 1.1 });
        view.burst(px, Math.min(VB, ty), 30, ['#7ad8ff', '#bfe8ff', '#ffffff', '#4a90ff'], { shape: 'dot', dir: -Math.PI / 2, spread: 1.6, speed: 230, size: 4, life: 0.9 });
        view.burst(px, Math.min(VB, ty) - 10, 5, ['#fff'], { shape: 'txt', ch: '💧', dir: -Math.PI / 2, spread: 1.8, speed: 160, size: 8, life: 1 });
        view.jolt(0.6, 0.05, '#4a90ff', 0.25);
        break;
      }
      case 'mgClimbBack':
        if (A) { A.sfx('respawn', pan, 0.5); A.sfx('jump', pan, 0.4, 4); }
        view.sticker(view.pick(['ON SE RELÈVE !', 'ÇA REPART !', 'COURAGE !']), px, py - 64, { size: 13, color: '#ffffff', bg: '#2a9a5a', life: 0.8 });
        view.burst(px, py - 12, 16, ['#7cff8a', '#ffffff', '#ffe24a'], { shape: 'star', speed: 150, size: 4, life: 0.6 });
        break;
      case 'mgEnd': {
        const l = ev.l === M.a ? 0 : ev.l === M.v ? 1 : -1;
        X.end = { l };
        if (l < 0) break;
        view.sticker('😭 NYMANO JOUE DU TRISTE 🎹', 320, 66, { size: 16, color: '#ffffff', bg: '#3a6ad0', life: 2.2, rot: -0.05 });
        view.emojiRain(['😭', '💧', '🎵', '🎹'], 10);
        if (A) { A.sfx('sob', 0, 0.9); A.sfx('sample', 0, 0.6); setTimeout(() => A.say(view.pick(SAD), 0.22, 0.8), 900); }
        break;
      }
      default: break;
    }
  },
};
