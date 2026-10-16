// Ne rigole pas (nolaugh), l'affichage : chacun son téléphone toktok (la même vidéo débile, au même moment : un pote,
// le vrai modèle 3D, qui rate tout), la barre de la blague en dessous (le 🤣 glisse vers la zone 😐 : A pile dedans), et
// à côté le joueur lui-même, grosse tête, qui se retient (il rougit, tremble, 😬) ou éclate de rire (HAHAHA, il saute
// sur place), avec sa jauge de fou rire. Moquerie gentille seulement.
import { NL, nlPos } from '../../sim/mg/nolaugh.js';
import { COLORS } from '../../sim/constants.js';
import { ACCOUNTS } from '../../ui/toktok.js';
import { drawPuppet } from '../puppets.js';

const INK = '#0b0610';
// les vidéos (NL.NV) : le pote, sa pose avant, sa pose à la chute, la légende, la chute, le son, le fond
const VIDS = [
  { c: 'nymano', pre: { state: 'run' }, post: { state: 'tumble' }, run: 1, cap: 'Nymano tente son premier backflip', punch: 'SUR LA TÊTE 💥', sfx: 'thud', bg: ['#6ac8ff', '#d8f4ff'] },
  { c: 'bido', pre: { emote: 'heart_pose' }, post: { state: 'down' }, cap: 'BIDO soulève 200 kg pour sa story', punch: 'LE DOS A LÂCHÉ 💀', sfx: 'quake', bg: ['#ff9ac0', '#ffe0ec'] },
  { c: 'jsan', pre: { emote: 'play_mobile_game' }, post: { emote: 'angry_02' }, cap: "J'san, 1 PV, contre un bot facile", punch: 'DÉFAITE 🤡', sfx: 'error', bg: ['#7a5aff', '#c8b8ff'] },
  { c: 'pandrezz', pre: { emote: 'dance_02' }, post: { state: 'tumble' }, cap: 'Pandrezz danse sur la table du bar', punch: 'LA TABLE CASSE 🪑', sfx: 'woodL', bg: ['#ffb84a', '#fff0c8'] },
  { c: 'skanky', pre: { state: 'run' }, post: { state: 'down' }, run: 1, cap: 'Skanky : le kickflip du siècle', punch: 'RATÉ, EN PLEINE FACE 🛹', sfx: 'slip', bg: ['#4adc8a', '#d0ffe4'] },
  { c: 'omfu', pre: { emote: 'sing_02' }, post: { state: 'hitstun', kb: 120 }, cap: 'OMFU tente la note la plus haute', punch: 'LA VOIX CASSE 🎤', sfx: 'larsen', bg: ['#ff6a4a', '#ffd8c8'] },
  { c: 'tices', pre: { emote: 'jump_rope_01' }, post: { state: 'down' }, cap: 'Tices bat le record de corde à sauter', punch: 'LE PIED DANS LA CORDE', sfx: 'whip', bg: ['#4ab8ff', '#e0f4ff'] },
  { c: 'aboueb', pre: { state: 'run' }, post: { state: 'tumble' }, run: 1, cap: 'Aboueb s\'élance pour le dunk', punch: 'LE PANIER, DANS LA TÊTE 🏀', sfx: 'boing', bg: ['#ff8a2a', '#ffe8c8'] },
  { c: 'lolobiscotto', pre: { emote: 'bow' }, post: { state: 'dizzy' }, cap: 'Lolobiscotto fait sa plus belle révérence', punch: 'TÊTE DANS LE MUR 🧱', sfx: 'woodM', bg: ['#c87aff', '#f0e0ff'] },
  { c: 'anbuu', pre: { state: 'idle' }, post: { state: 'tumble' }, cap: 'Anbuu essaie de s\'envoler', punch: 'CHUTE LIBRE 🪽', sfx: 'fart', bg: ['#9ad0ff', '#ffffff'] },
];
const HOLD_TXT = ['IMPASSIBLE 😐', 'DE MARBRE 🗿', 'MÊME PAS DRÔLE', 'VISAGE DE PIERRE', 'ZÉRO ÉMOTION'];
const LAUGH_TXT = ['IL CRAQUE 😂', 'FOU RIRE !', 'MDRRR 🤣', 'IL A PAS TENU', 'PTDR 😭'];
const PHONE = { w: 136, h: 214, y: 50 };
const X = (i, x) => (i === 0 ? x : 640 - x);
const PX = [212, 428], FACE_X = [70, 570];
const VW = PHONE.w - 12, VH = PHONE.h - 22; // l'écran de la vidéo
const vkey = (c) => 'nlv' + c;
// la vidéo est rendue UNE fois par image dans ce canevas (au double de la grille), puis recopiée dans les deux téléphones
let VC = null;
function vcv() { if (!VC) { const c = document.createElement('canvas'); c.width = VW * 2; c.height = VH * 2; VC = { c, g: c.getContext('2d') }; } return VC; }
// la blague à l'écran (entre deux : la chute de la précédente reste), ou null avant la première
function jokeNow(g, t) {
  let J = g.jokes[Math.min(g.cur, g.jokes.length - 1)];
  if (J && t < J.s - 2 && g.cur > 0) J = g.jokes[g.cur - 1];
  return J && t >= J.s - 2 ? J : null;
}
// la pose du pote de la vidéo à l'instant t, et où il est (x dans l'écran de la vidéo)
function vidPose(J, t) {
  const V = VIDS[J.v % VIDS.length], after = t - J.p, pu = Math.min(1, (t - J.s) / (J.p - J.s));
  let o, px = VW / 2;
  if (after < 0) { o = { ...V.pre }; if (V.run) px = 22 + pu * (VW * 0.5 - 22); }
  else {
    const k = Math.min(1, after / 18);
    o = { ...V.post, rot: V.post.state === 'tumble' ? k * 1.4 : 0, squash: after < 8 ? [1.25, 0.75] : [1, 1] };
    if (V.run) px = VW * 0.5 + k * 10;
  }
  return { V, o: { ...o, key: vkey(V.c), face: V.run && after < 0 ? 'right' : 'front', head: 1.6, shadow: false }, px };
}

function S(view, g) {
  const xs = view.xs;
  if (!xs.on) { xs.on = 1; xs.lm = [0, 0]; xs.flash = [0, 0]; xs.res = [null, null]; xs.pop = [0, 0]; xs.score = [0, 0]; xs.shake = [0, 0]; xs.tick = -1; void g; }
  return xs;
}

// la vidéo dans l'écran du téléphone (sx, sy, sw, sh) : le pote, la légende, les likes ; la chute
function drawVideo(view, W, M, g, i, sx, sy, sw, sh, xs) {
  const ctx = view.g, t = M.t, cx = sx + sw / 2, J = jokeNow(g, t);
  if (!J) { // avant la première : l'écran de chargement
    ctx.fillStyle = '#16101e'; ctx.fillRect(sx, sy, sw, sh);
    view.text('toktok', cx, sy + sh / 2 - 8, 16, '#ff4a8a', { title: true });
    view.text('chargement…', cx, sy + sh / 2 + 12, 9, '#c8b8d8', { mono: true, stroke: false });
    return;
  }
  const V = VIDS[J.v % VIDS.length], after = t - J.p, slide = Math.max(0, 1 - (t - J.s) / 10);
  ctx.save(); ctx.beginPath(); ctx.rect(sx, sy, sw, sh); ctx.clip();
  ctx.translate(0, slide * sh);
  if (after >= 0 && after < 14) ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
  const bg = ctx.createLinearGradient(0, sy, 0, sy + sh); bg.addColorStop(0, V.bg[0]); bg.addColorStop(1, V.bg[1]);
  ctx.fillStyle = bg; ctx.fillRect(sx, sy, sw, sh);
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(sx, sy + sh - 62, sw, 62);
  // le pote (rendu une fois pour les deux téléphones, dans draw)
  if (xs.vok) ctx.drawImage(vcv().c, sx, sy, sw, sh); else view.portraitAt(VIDS[J.v % VIDS.length].c, cx, sy + sh - 100, 50, '#ffffff', false);
  // les likes à droite
  const likes = 120 + J.v * 37 + Math.max(0, after) * 61;
  view.text('♥', sx + sw - 12, sy + 70, 14, after >= 0 ? '#ff3a6a' : '#ffffff');
  view.text(likes > 999 ? `${(likes / 1000).toFixed(1)}k` : String(likes), sx + sw - 12, sy + 84, 7, '#ffffff', { mono: true });
  view.text('💬', sx + sw - 12, sy + 104, 11, '#ffffff', { stroke: false });
  // l'en-tête et la légende
  const acc = ACCOUNTS[V.c] ? ACCOUNTS[V.c][0] : V.c;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(sx, sy, sw, 18);
  view.text('toktok', sx + 6, sy + 10, 10, '#ff4a8a', { align: 'left', title: true });
  view.text('@' + acc, sx + sw - 4, sy + 10, 7, '#ffffff', { align: 'right', mono: true, stroke: false, maxW: sw - 50 });
  view.wrap(V.cap, cx, sy + sh - 26, sw - 14, 9, '#ffffff');
  // la chute : l'écran clignote, le gros titre
  if (after >= 0 && after < 60) {
    if (after < 5) { ctx.fillStyle = `rgba(255,255,255,${0.8 - after * 0.15})`; ctx.fillRect(sx, sy, sw, sh); }
    const sc = after < 6 ? 1.6 - after * 0.1 : 1 + Math.sin(after * 0.4) * 0.03;
    ctx.save(); ctx.translate(cx, sy + 40); ctx.rotate(-0.08); ctx.scale(sc, sc);
    ctx.fillStyle = INK; ctx.fillRect(-sw / 2 + 4, -12, sw - 8, 24); ctx.fillStyle = '#ffe24a'; ctx.fillRect(-sw / 2 + 6, -10, sw - 12, 20);
    view.text(V.punch, 0, 1, 10, INK, { mono: true, stroke: false, maxW: sw - 18 });
    ctx.restore();
  }
  ctx.restore();
  void W; void i;
}

// le téléphone d'un joueur, à sa couleur
function drawPhone(view, W, M, g, i, xs) {
  const ctx = view.g, slot = i === 0 ? M.a : M.v, col = COLORS[slot], cx = PX[i] + xs.shake[i] * (Math.random() - 0.5) * 6, x0 = cx - PHONE.w / 2, y0 = PHONE.y;
  ctx.fillStyle = INK; ctx.beginPath(); ctx.roundRect(x0 - 4, y0 - 4, PHONE.w + 8, PHONE.h + 8, 18); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(x0 - 1, y0 - 1, PHONE.w + 2, PHONE.h + 2, 15); ctx.fill();
  ctx.fillStyle = '#1a1424'; ctx.beginPath(); ctx.roundRect(x0 + 3, y0 + 3, PHONE.w - 6, PHONE.h - 6, 12); ctx.fill();
  drawVideo(view, W, M, g, i, x0 + 6, y0 + 12, PHONE.w - 12, PHONE.h - 22, xs);
  ctx.fillStyle = INK; ctx.beginPath(); ctx.roundRect(cx - 18, y0 + 4, 36, 6, 3); ctx.fill(); // l'encoche
  if (xs.flash[i] > 0) { ctx.save(); ctx.globalAlpha = xs.flash[i]; ctx.strokeStyle = xs.res[i] && xs.res[i].q > 0 ? '#7cff8a' : '#ff3a3a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.roundRect(x0 - 6, y0 - 6, PHONE.w + 12, PHONE.h + 12, 20); ctx.stroke(); ctx.restore(); }
}

// la barre de la blague sous le téléphone : le 🤣 glisse vers la grosse zone « APPUIE ! » ; quand il y est, la touche
// du joueur grossit et clignote dedans
const BAR_Y = 288, BAR_H = 24;
function drawBar(view, W, M, g, i, xs) {
  const ctx = view.g, slot = i === 0 ? M.a : M.v, col = COLORS[slot], cx = PX[i], w = PHONE.w + 16, x0 = cx - w / 2, y = BAR_Y, J = g.jokes[g.cur], P = g.p[i], t = view.time;
  ctx.fillStyle = INK; ctx.fillRect(x0 - 3, y - BAR_H / 2 - 3, w + 6, BAR_H + 6);
  ctx.fillStyle = '#2a1e3a'; ctx.fillRect(x0, y - BAR_H / 2, w, BAR_H);
  const zx = x0 + w - 34, track = zx - x0 - 12, dur = J ? J.p - J.s : 70, zw = Math.max(26, (NL.GOOD / dur) * track * 2);
  const u = J && M.t >= J.s ? nlPos(J, M.t) : -1, d = J ? M.t - J.p : -99, open = u >= 0 && d >= -NL.GOOD && d <= NL.GOOD && P.res[g.cur] === -1;
  const res = J && M.t >= J.s ? P.res[g.cur] : -1;
  // la zone
  ctx.fillStyle = open ? (Math.sin(t * 40) > 0 ? '#ffffff' : '#ffd23a') : res > 0 ? '#3bdc5a' : res === 0 ? '#ff3a3a' : '#2f8a4a';
  ctx.fillRect(zx - zw / 2, y - BAR_H / 2, zw, BAR_H);
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.strokeRect(zx - zw / 2, y - BAR_H / 2, zw, BAR_H);
  const soon = u >= 0 && P.res[g.cur] === -1 && d >= -NL.GOOD - 24;
  if (!soon) view.text(res > 0 ? '✔' : res === 0 ? '😂' : 'APPUIE !', zx, y + 1, res === -1 ? 9 : 14, '#ffffff', { mono: true });
  if (u >= 0) {
    const mx = x0 + 12 + track * Math.min(1.15, u);
    ctx.fillStyle = 'rgba(255,90,160,0.45)'; ctx.fillRect(x0 + 2, y - 3, Math.max(0, mx - x0 - 2), 6);
    // bientôt : la touche apparaît au-dessus de la zone, et grossit
    if (P.res[g.cur] === -1 && d >= -NL.GOOD - 24) {
      const k = open ? 1.25 + Math.max(0, Math.sin(t * 30)) * 0.25 : 0.7 + Math.max(0, (d + NL.GOOD + 24) / 24) * 0.35, key = view.keyName(M, i, 'A');
      ctx.save(); ctx.translate(zx, y); ctx.scale(k, k);
      ctx.font = "13px 'Arial Black', Impact, sans-serif"; const kw = Math.max(22, ctx.measureText(key).width + 12);
      ctx.fillStyle = INK; ctx.fillRect(-kw / 2 - 2, -12, kw + 4, 24);
      ctx.fillStyle = open ? '#ffd23a' : '#f4ead6'; ctx.fillRect(-kw / 2, -10, kw, 18); ctx.fillStyle = col; ctx.fillRect(-kw / 2, 8, kw, 3);
      view.text(key, 0, 0, 13, INK, { mono: true, stroke: false });
      ctx.restore();
      if (open) view.text('MAINTENANT !', zx - 20, y - 24, 12, '#ffd23a', { mono: true });
    }
    view.text('🤣', mx, y + 1, 20, '#fff', { stroke: false });
  } else if (J) view.text('la blague arrive…', x0 + 12, y + 1, 8, '#c8b8d8', { align: 'left', mono: true, stroke: false });
  view.hint(W, M, i, cx, 314, [['A', 'quand 🤣 est dans la zone']]);
  xs.score[i] += (P.s - xs.score[i]) * 0.2; if (Math.abs(P.s - xs.score[i]) < 0.6) xs.score[i] = P.s;
  view.text(`SÉRIEUX : ${Math.round(xs.score[i])}`, cx, 334, 12 * (1 + xs.pop[i] * 0.35), P.s >= g.p[1 - i].s ? '#ffffff' : '#c8b8d8', { mono: true });
}

// le joueur lui-même : il se retient, ou il éclate de rire ; sa jauge de fou rire en dessous
function drawFace(view, W, M, g, i, xs, dt) {
  const ctx = view.g, P = g.p[i], J = g.jokes[g.cur], slot = i === 0 ? M.a : M.v, fx = FACE_X[i], fy = 262, t = view.time;
  let tense = 0;
  if (J && M.t >= J.s && P.res[g.cur] === -1) tense = Math.max(0, Math.min(1, (nlPos(J, M.t) - 0.45) / 0.55));
  const laughing = P.lt > 0;
  const o = { face: i === 0 ? 'three' : 'threeL', head: 2 + tense * 0.25 };
  if (laughing) { o.emote = 'laugh_01'; o.tint = '#ff8ac0'; o.tintK = 0.12; }
  else if (tense > 0) { o.tint = '#ff2a2a'; o.tintK = tense * 0.2; o.squash = [1 + tense * 0.06, 1 - tense * 0.05]; }
  const shk = tense * 2.5 * (Math.random() - 0.5) + (laughing ? Math.sin(t * 40) * 2 : 0);
  if (view.pupOn(M)) view.player(W, M, i, fx + shk, fy - (laughing ? Math.abs(Math.sin(t * 14)) * 10 : 0), 140, o);
  // la bulle d'humeur au-dessus de la tête
  const em = laughing ? '😂' : tense > 0.7 ? '😬' : tense > 0.2 ? '🫢' : '😐';
  view.text(em, fx + (i === 0 ? 46 : -46), 110 + Math.sin(t * 5) * 3, 22 + (laughing ? Math.sin(t * 20) * 3 : tense * 4), '#fff', { stroke: false });
  if (laughing) view.text('HA HA HA', fx + Math.sin(t * 30) * 2, 96 - (P.lt % 20), 15, '#ff8ad0', { title: true, alpha: Math.min(1, P.lt / 10) });
  // la jauge de fou rire
  xs.lm[i] += (P.laugh / Math.max(1, g.jokes.length) - xs.lm[i]) * Math.min(1, dt * 6);
  const bw = 104, bx = fx - bw / 2, by = 272;
  ctx.fillStyle = INK; ctx.fillRect(bx - 2, by - 2, bw + 4, 12);
  ctx.fillStyle = '#2a1e3a'; ctx.fillRect(bx, by, bw, 8);
  const lg = ctx.createLinearGradient(bx, 0, bx + bw, 0); lg.addColorStop(0, '#ffd23a'); lg.addColorStop(1, '#ff3a8a');
  ctx.fillStyle = lg; ctx.fillRect(bx, by, bw * Math.min(1, xs.lm[i]), 8);
  view.text('FOU RIRE 😂', fx, by + 18, 8, '#ff8ad0', { mono: true });
  view.who(W, M, i, X(i, 8), 296, { align: i === 0 ? 'left' : 'right', size: 0.95 });
  void slot;
}

export default {
  title: 'NE RIGOLE PAS', color: '#ff6ad0', icon: '😐',
  goal: 'Appuie quand le 🤣 est dans la zone : sinon tu éclates de rire !',
  keys: [['A', 'quand 🤣 est dans la zone']],
  ach: [['Visage de pierre', 'Moine tibétain', 'Insensible à l\'humour', 'Le sérieux incarné'], ['Pouffeur professionnel', 'Rire nerveux', 'Bon public', 'Fou rire en direct']],
  news: (L, d) => `${L} PIQUE UN FOU RIRE DEVANT UNE VIDÉO DE CHUTE : ${d} %, IL NE S'EN REMET PAS`,
  puppets: [],
  // chaque pote des vidéos (et les fous rires des joueurs) préparé pendant la présentation, un par image (pas d'à-coup)
  warm(view, W, M) {
    const g = M.g;
    if (!g || !g.jokes) return;
    const jobs = [], seen = {};
    for (const J of g.jokes) {
      const V = VIDS[J.v % VIDS.length];
      if (seen[V.c]) continue;
      seen[V.c] = 1;
      jobs.push(() => { const c = vcv(); drawPuppet(c.g, V.c, -9999, -9999, 10, { ...V.pre, key: vkey(V.c), shadow: false }); drawPuppet(c.g, V.c, -9999, -9999, 10, { ...V.post, key: vkey(V.c), shadow: false }); });
    }
    jobs.push(() => { for (let i = 0; i < 2; i++) view.player(W, M, i, -9999, -9999, 10, { emote: 'laugh_01', shadow: false }); });
    if (Array.isArray(view.warmQ)) view.warmQ.unshift(...jobs); else for (const f of jobs) f();
  },

  draw(view, W, M, dt) {
    const ctx = view.g, g = M.g, xs = S(view, g), L = -view.ox, Rr = 640 + view.ox, T = -view.oy, B = 360 + view.oy, t = view.time;
    for (let i = 0; i < 2; i++) { xs.flash[i] = Math.max(0, xs.flash[i] - dt * 2.5); xs.pop[i] = Math.max(0, xs.pop[i] - dt * 4); xs.shake[i] = Math.max(0, xs.shake[i] - dt * 3); }
    // le salon, le soir : canapé, lampe, papier peint
    const bg = ctx.createLinearGradient(0, T, 0, B); bg.addColorStop(0, '#2a1640'); bg.addColorStop(1, '#120a1c');
    ctx.fillStyle = bg; ctx.fillRect(L, T, Rr - L, B - T);
    ctx.fillStyle = 'rgba(255,255,255,0.03)'; for (let x = Math.floor(L / 30) * 30; x < Rr; x += 30) ctx.fillRect(x, T, 14, B - T);
    for (let i = 0; i < 2; i++) { // la lueur du téléphone sur chacun
      const gl = ctx.createRadialGradient(PX[i], 160, 10, PX[i], 160, 190); gl.addColorStop(0, 'rgba(160,200,255,0.16)'); gl.addColorStop(1, 'rgba(160,200,255,0)');
      ctx.fillStyle = gl; ctx.fillRect(PX[i] - 200, -20, 400, 400);
    }
    ctx.fillStyle = '#3a1a2a'; ctx.fillRect(L, 300, Rr - L, B - 300);
    ctx.fillStyle = '#4a2234'; ctx.fillRect(L, 300, Rr - L, 4);
    view.text('😐 NE RIGOLE PAS', 320, T + 16, 18, '#ff6ad0', { title: true });
    view.timer(M, 320, T + 42);
    // le tic-tac de la blague
    const J = g.jokes[g.cur];
    if (J && M.t >= J.s && M.t < J.p && view.audio) {
      const step = Math.floor(nlPos(J, M.t) * 8);
      if (step !== xs.tick) { xs.tick = step; view.audio.sfx('blip', 0, 0.18, 1 + step); }
    }
    // la chute de la vidéo (la même pour les deux)
    if (J && M.t >= J.p && xs.punched !== g.cur) {
      xs.punched = g.cur;
      const V = VIDS[J.v % VIDS.length];
      if (view.audio) { view.audio.sfx(V.sfx, 0, 0.8); view.audio.sfx('boing', 0, 0.4); }
      for (let i = 0; i < 2; i++) view.burst(PX[i], PHONE.y + 120, 10, ['#fff'], { shape: 'txt', ch: view.pick(['😂', '🤣', '💀']), speed: 120, size: 9, up: 80, life: 0.9 });
    }
    // le pote de la vidéo : une seule marionnette, recopiée dans les deux téléphones
    const JV = jokeNow(g, M.t);
    xs.vok = false;
    if (JV && view.pupOn(M)) {
      const c = vcv(), p = vidPose(JV, M.t);
      c.g.setTransform(1, 0, 0, 1, 0, 0); c.g.clearRect(0, 0, c.c.width, c.c.height); c.g.setTransform(2, 0, 0, 2, 0, 0);
      xs.vok = drawPuppet(c.g, p.V.c, p.px, VH - 52, 96, p.o);
    }
    for (let i = 0; i < 2; i++) { drawPhone(view, W, M, g, i, xs); drawBar(view, W, M, g, i, xs); drawFace(view, W, M, g, i, xs, dt); }
    // le séparateur
    ctx.fillStyle = INK; ctx.fillRect(318, 64, 4, 236); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(319, 64, 2, 236);
    void t;
  },

  onEvent(view, ev, W, M) {
    if (!M || !ev.type.startsWith('mgNolaugh')) return;
    const A = view.audio, g = M.g, xs = S(view, g);
    switch (ev.type) {
      case 'mgNolaughJoke': {
        xs.tick = -1;
        if (A) { A.sfx('whoosh', 0, 0.5); A.sfx('pop', 0, 0.5, 2); }
        break;
      }
      case 'mgNolaughHold': {
        const i = ev.p, slot = i === 0 ? M.a : M.v;
        xs.res[i] = { q: ev.q }; xs.flash[i] = 1; xs.pop[i] = 1;
        view.react(i, { life: 0.5, tint: '#7cff8a', tintK: 0.1, pop: 0.25, shake: 4 });
        view.sticker(ev.q === 2 ? 'PARFAIT 😐' : view.pick(HOLD_TXT), PX[i], 250, { size: ev.q === 2 ? 16 : 13, color: INK, bg: ev.q === 2 ? '#ffd23a' : '#7cff8a', life: 0.8, rot: (Math.random() - 0.5) * 0.2 });
        view.burst(PX[i] + PHONE.w / 2 - 18, 280, ev.q === 2 ? 22 : 12, ['#ffd23a', '#ffffff', COLORS[slot]], { shape: 'star', speed: 200, size: 5, life: 0.5 });
        if (ev.n >= 3) view.sticker(`SÉRIE x${ev.n} 🗿`, FACE_X[i], 80, { size: 12, color: '#ffffff', bg: COLORS[slot], life: 0.8 });
        if (ev.q === 2) view.jolt(0.25, 0.03, '#ffd23a', 0.12);
        if (A) { A.sfx('parry', 0, 0.6); if (ev.q === 2) A.sfx('hitmark', 0, 0.7); }
        break;
      }
      case 'mgNolaughLaugh': {
        const i = ev.p;
        xs.res[i] = { q: 0 }; xs.flash[i] = 1; xs.shake[i] = 1; xs.pop[i] = 1;
        view.react(i, { emote: 'laugh_01', life: NL.LT / 60, hop: 0.12, hopF: 4, head: 2.5 });
        view.sticker(ev.late ? view.pick(LAUGH_TXT) : 'TROP TÔT : IL POUFFE 🤭', FACE_X[i], 150, { size: 14, color: '#ffffff', bg: '#ff3a8a', life: 0.9, rot: (Math.random() - 0.5) * 0.3 });
        view.burst(FACE_X[i], 160, 16, ['#fff'], { shape: 'txt', ch: view.pick(['😂', '🤣', '😆']), speed: 180, size: 10, up: 140, life: 1, g: 200 });
        view.floats.push({ text: `-${NL.LAUGH}`, x: FACE_X[i], y: 240, t: 0, life: 0.8, color: '#ff4a6a', size: 15 });
        view.jolt(0.5, 0.05, '#ff8ad0', 0.15);
        if (A) { A.say(view.pick(['Ha ha ha ha !', 'Hi hi hi hi !', 'Pfffrrt ha ha !', 'Mouahaha !']), 1.15 + i * 0.15, 1.4); A.sfx('spit', 0, 0.5); }
        break;
      }
      default: break;
    }
  },
};
