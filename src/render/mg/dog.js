// Caresses à Reyji (dog), l'affichage : un salon douillet, deux Reyji côte à côte (le vrai shiba 3D de J'san, de trois
// quarts ; pour le ventre il se retourne d'un coup, les quatre pattes en l'air qui pédalent), son maître à côté (le vrai
// perso du joueur, grosse tête : il applaudit quand ça marche, pleure quand Reyji grogne), la bulle de son envie, la zone
// qui clignote sur lui, la main de chaque joueur. Il aboie et saute de joie à chaque envie comblée, tourne sur lui-même
// en série, montre les crocs quand ça ne va pas (GRRR). Sans 3D : le shiba dessiné au canevas.
import { DOG, DOG_ZONES } from '../../sim/mg/dog.js';
import { COLORS } from '../../sim/constants.js';
import { drawPuppet } from '../puppets.js';

const S = 2.2, OX = [80, 400], OY = 100, PX = [38, 358], FLOOR = 290;
// le shiba 3D : haut de H3 unités du plateau, les pattes en (50, 78), de trois quarts vers la gauche ; sur le dos, l'image
// retournée autour de y = 40 (les zones de src/sim/mg/dog.js sont calées dessus)
const H3 = 70, FX = 50, FY = 78, YC = 40;
const ZONE_LABEL = ['LA TÊTE', 'LES OREILLES', 'LE MENTON', 'LE DOS', 'LE VENTRE', 'LA QUEUE'];
const ZONE_ICON = ['🙂', '👂', '🥰', '🐾', '🤗', '🚫'];
const FUR = '#e08a34', FUR_D = '#b8621c', CREAM = '#fff1dc', LINE = '#3a1a08';
const HEARTS = ['#ff5a8a', '#ff8ad0', '#ffffff', '#ffd23a'];
const WOOFS = ['WOUF WOUF !', 'WOUF ! WOUF !', 'WAF WAF !', 'WOUF WOUF WOUF !'];

// --- le shiba -----------------------------------------------------------------------------------------------------
function ell(ctx, x, y, rx, ry, fill, rot = 0) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); ctx.stroke();
}
function tri(ctx, a, b, c, fill) { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.stroke(); }
function leg(ctx, x, y0, y1, w) {
  ctx.fillStyle = FUR; ctx.beginPath(); ctx.rect(x - w / 2, y0, w, y1 - y0); ctx.fill(); ctx.stroke();
  ell(ctx, x - 0.6, y1, w * 0.62, 2.2, CREAM);
}
// o : { t, wag (vitesse de la queue), mood (0 normal, 1 heureux, 2 grognon, 3 bof), jump, tongue, blush, shake }
// coordonnées du plateau (100 x 80), déjà mises à l'échelle par l'appelant
export function drawShiba(ctx, roll, o) {
  const t = o.t, mood = o.mood || 0;
  ctx.save();
  ctx.lineWidth = 0.9; ctx.strokeStyle = LINE; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // l'ombre
  ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(56, 76, 36 - (o.jump || 0) * 8, 3.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  ctx.translate((o.shake ? (Math.random() - 0.5) * o.shake : 0), -(o.jump || 0) * 9);
  const wag = Math.sin(t * (6 + (o.wag || 0) * 22)) * (0.15 + (o.wag || 0) * 0.55);
  if (!roll) {
    // la tête (centrée vers 28, 28) : oreilles (couchées quand il grogne), joues crème, le visage
function head(ctx, o, mood, t) {
  const ear = mood === 2 ? 0.6 : mood === 3 ? 0.35 : 0;
  tri(ctx, [12, 22], [17 - ear * 6, 2 + ear * 10], [25, 17], FUR); tri(ctx, [15, 19], [17.5 - ear * 5, 7 + ear * 9], [22, 17], '#f7b38a');
  tri(ctx, [31, 16], [38 + ear * 6, 1 + ear * 10], [44, 22], FUR); tri(ctx, [34, 16], [38 + ear * 5, 6 + ear * 9], [41, 20], '#f7b38a');
  ell(ctx, 28, 28, 16, 15, FUR);
  ctx.save(); ctx.strokeStyle = 'rgba(0,0,0,0)'; ell(ctx, 20, 37, 12, 8, CREAM); ell(ctx, 30, 41, 9, 5, CREAM); ctx.restore();
  face(ctx, o, 21, 26, 32, 25, 8.5, 34, mood, t);
}

// la queue en tire-bouchon (derrière)
    ctx.save(); ctx.translate(83, 40); ctx.rotate(wag);
    curl(ctx);
    ctx.restore();
    const step = o.happyFeet ? Math.sin(t * 18) * 1.5 : 0;
    leg(ctx, 79, 52, 74 - Math.max(0, step), 6.5); leg(ctx, 47, 52, 74 - Math.max(0, -step), 6.5);
    ell(ctx, 58, 48, 30, 15, FUR);
    ctx.save(); ctx.lineWidth = 0; ctx.strokeStyle = 'rgba(0,0,0,0)'; ell(ctx, 55, 56, 22, 6.5, CREAM); ctx.restore();
    leg(ctx, 71, 54, 75, 6.5); leg(ctx, 38, 54, 75, 6.5);
    // la tête
    ctx.save(); ctx.translate(28, 30); ctx.rotate(mood === 1 ? Math.sin(t * 9) * 0.08 : mood === 2 ? -0.06 : 0); ctx.translate(-28, -30);
    head(ctx, o, mood, t);
    ctx.restore();
  } else {
    // roulé sur le dos : les pattes en l'air qui gigotent, le ventre offert
    const wig = Math.sin(t * 14) * 2;
    ctx.save(); ctx.translate(84, 58); ctx.rotate(wag * 1.3 + 0.9); ctx.scale(0.85, 0.85);
    curl(ctx);
    ctx.restore();
    for (const [x, d] of [[42, 1], [51, -1], [64, 1], [73, -1]]) {
      ctx.save(); ctx.translate(x, 40); ctx.rotate(d * 0.2 + wig * 0.04 * d);
      ctx.fillStyle = FUR; ctx.beginPath(); ctx.rect(-2.8, -14, 5.6, 14); ctx.fill(); ctx.stroke(); ell(ctx, 0, -14.5, 3.6, 2.6, CREAM);
      ctx.restore();
    }
    ell(ctx, 56, 52, 32, 14, FUR);
    ctx.save(); ctx.strokeStyle = 'rgba(0,0,0,0)'; ell(ctx, 56, 46, 25, 9.5, CREAM); ctx.restore();
    ctx.fillStyle = '#f2b8a0'; for (const [x, y] of [[50, 47], [58, 48], [54, 43], [62, 44]]) { ctx.beginPath(); ctx.arc(x, y, 0.9, 0, Math.PI * 2); ctx.fill(); }
    // la tête renversée en arrière, qui regarde le joueur
    ctx.save(); ctx.translate(20, 54); ctx.rotate(-0.42 + Math.sin(t * 5) * 0.06); ctx.scale(0.85, 0.85); ctx.translate(-28, -28);
    head(ctx, o, mood, t);
    ctx.restore();
  }
  ctx.restore();
}
// la tête (centrée vers 28, 28) : oreilles (couchées quand il grogne), joues crème, le visage
function head(ctx, o, mood, t) {
  const ear = mood === 2 ? 0.6 : mood === 3 ? 0.35 : 0;
  tri(ctx, [12, 22], [17 - ear * 6, 2 + ear * 10], [25, 17], FUR); tri(ctx, [15, 19], [17.5 - ear * 5, 7 + ear * 9], [22, 17], '#f7b38a');
  tri(ctx, [31, 16], [38 + ear * 6, 1 + ear * 10], [44, 22], FUR); tri(ctx, [34, 16], [38 + ear * 5, 6 + ear * 9], [41, 20], '#f7b38a');
  ell(ctx, 28, 28, 16, 15, FUR);
  ctx.save(); ctx.strokeStyle = 'rgba(0,0,0,0)'; ell(ctx, 20, 37, 12, 8, CREAM); ell(ctx, 30, 41, 9, 5, CREAM); ctx.restore();
  face(ctx, o, 21, 26, 32, 25, 8.5, 34, mood, t);
}

// la queue en tire-bouchon (part de 0, 0 et s'enroule au-dessus), le bout crème
function curl(ctx) {
  const path = () => { ctx.beginPath(); ctx.moveTo(-2, 2); ctx.quadraticCurveTo(2, -6, 6, -13); ctx.arc(10, -10, 5, Math.PI * 1.25, Math.PI * 2.55); };
  ctx.lineCap = 'round';
  ctx.lineWidth = 8.5; ctx.strokeStyle = LINE; path(); ctx.stroke();
  ctx.lineWidth = 6.6; ctx.strokeStyle = FUR; path(); ctx.stroke();
  ctx.lineWidth = 2.4; ctx.strokeStyle = CREAM; ctx.beginPath(); ctx.arc(10, -10, 5, Math.PI * 1.7, Math.PI * 2.5); ctx.stroke();
  ctx.lineWidth = 0.9; ctx.strokeStyle = LINE;
}

// les yeux, la truffe, la bouche (et la langue, les joues roses, les dents)
function face(ctx, o, ex1, ey1, ex2, ey2, nx, ny, mood, t) {
  ctx.fillStyle = CREAM; ctx.beginPath(); ctx.arc(ex1, ey1 - 4, 1.4, 0, Math.PI * 2); ctx.arc(ex2, ey2 - 4, 1.4, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 1.2;
  for (const [x, y] of [[ex1, ey1], [ex2, ey2]]) {
    if (mood === 1) { ctx.beginPath(); ctx.arc(x, y + 0.8, 2.2, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
    else if (mood === 3) { ctx.beginPath(); ctx.moveTo(x - 2.2, y); ctx.lineTo(x + 2.2, y); ctx.stroke(); }
    else {
      const blink = Math.sin(t * 2.3 + x) > 0.97;
      ctx.fillStyle = '#1a0a04'; ctx.beginPath(); ctx.ellipse(x, y, 1.9, blink ? 0.3 : 2.3, 0, 0, Math.PI * 2); ctx.fill();
      if (!blink) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - 0.6, y - 0.8, 0.7, 0, Math.PI * 2); ctx.fill(); }
      if (mood === 2) { ctx.beginPath(); ctx.moveTo(x - 2.5, y - 4.2); ctx.lineTo(x + 2.5, y - 2.4 * (x === ex1 ? -1 : 1) - 3.2); ctx.stroke(); }
    }
  }
  ctx.lineWidth = 0.9;
  if (mood === 1 || o.blush) { ctx.fillStyle = 'rgba(255,90,140,0.45)'; ctx.beginPath(); ctx.ellipse(ex1 - 1, ey1 + 5, 2.6, 1.5, 0, 0, Math.PI * 2); ctx.ellipse(ex2 + 2, ey2 + 5, 2.6, 1.5, 0, 0, Math.PI * 2); ctx.fill(); }
  // la truffe
  ctx.fillStyle = '#1a0a04'; ctx.beginPath(); ctx.ellipse(nx, ny - 1, 2.6, 1.9, 0, 0, Math.PI * 2); ctx.fill();
  const mx = nx + 6, my = ny + 3;
  if (mood === 2) { // les dents
    ctx.fillStyle = '#5a0a10'; ctx.beginPath(); ctx.ellipse(mx, my, 4.5, 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; for (let k = -1; k <= 1; k++) tri(ctx, [mx + k * 2.4 - 1, my - 1.8], [mx + k * 2.4 + 1, my - 1.8], [mx + k * 2.4, my + 0.4], '#fff');
  } else {
    ctx.beginPath(); ctx.moveTo(mx - 3.5, my - 0.5); ctx.quadraticCurveTo(mx - 1.7, my + 1.5, mx, my - 0.3); ctx.quadraticCurveTo(mx + 1.7, my + 1.5, mx + 3.5, my - 0.5); ctx.stroke();
    if (o.tongue) { const l = 3 + Math.abs(Math.sin(t * 12)) * 1.6; ctx.fillStyle = '#ff7a9a'; ctx.beginPath(); ctx.ellipse(mx + 0.5, my + l * 0.6, 2, l * 0.7, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  }
}

// la main (un gant de dessin animé) ; good : elle brille, bad : elle tremble
function drawHand(ctx, x, y, col, t, rub, stun) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(-0.3 + (rub ? Math.sin(t * 30) * 0.12 : 0) + (stun ? Math.sin(t * 50) * 0.3 : 0));
  ctx.lineWidth = 2; ctx.strokeStyle = '#0b0610';
  ctx.fillStyle = col; ctx.fillRect(-6, 9, 12, 6); ctx.strokeRect(-6, 9, 12, 6);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.ellipse(0, 3, 8, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.ellipse(-5.4 + k * 3.6, -5 - (k === 1 || k === 2 ? 1.5 : 0), 1.8, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  ctx.beginPath(); ctx.ellipse(8, 4, 3.5, 2, -0.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
}

// le shiba 3D, rendu à part (la marionnette n'a pas d'ombre 3D), puis collé sur le plateau :
// k = l'échelle verticale (1 debout, -1 retourné sur le dos, entre les deux pendant qu'il se retourne)
let OFF = null;
function shiba3D(view, key, ox, oy, o, k, sx, dx, dy) {
  if (!OFF) { const c = document.createElement('canvas'); c.width = 240; c.height = 320; OFF = { c, g: c.getContext('2d') }; }
  const { c, g } = OFF;
  g.clearRect(0, 0, 240, 320);
  if (!drawPuppet(g, 'shiba', 120, 285, 187.5, { key, face: 1.1, flip: true, shadow: false, ...o })) return false;
  const ctx = view.g, sc = H3 * S / 187.5, yc = oy + YC * S;
  ctx.save();
  ctx.translate(dx, dy);
  ctx.translate(ox + FX * S, yc); ctx.scale(sx, k); ctx.translate(-(ox + FX * S), -yc);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(c, ox + FX * S - 120 * sc, oy + FY * S - 285 * sc, 240 * sc, 320 * sc);
  ctx.restore();
  return true;
}

function moodOf(P) {
  if (P.stun > 0 || P.grr > DOG.GRR * 0.55) return 2;
  if (P.goodT > 0 || P.ok === 2) return 1;
  if (P.wt > DOG.WISH_T * 0.7) return 3;
  return 0;
}

export default {
  title: 'CARESSES À REYJI', color: '#ffa24a', icon: '🐕',
  input: 'mouse',
  puppets: ['shiba'],
  rules: [
    'Stick ou souris : ta main · frotte en va-et-vient sur Reyji',
    'Là où dit sa bulle : 🐢 doucement ou ⚡ vite',
    'Ailleurs il grogne · LA QUEUE, JAMAIS ! · le plus heureux gagne',
  ],
  ach: [
    ['Chuchoteur de shibas', 'Meilleur ami de Reyji', 'Mains de velours', 'Wouf wouf certifié'],
    ['Mordu par Reyji', 'Allergique aux chiens', 'Tireur de queue', 'Ami des chats'],
  ],
  news: (L, d) => `REYJI PRÉFÈRE L'AUTRE : ${L} REPART AVEC ${d} % ET DES POILS PARTOUT`,

  demo(view, x, y, w, h, t) {
    const ctx = view.g, cyc = (t * 0.42) % 1, grr = cyc > 0.72, woof = cyc > 0.5 && cyc < 0.72;
    ctx.fillStyle = '#ffe2c8'; ctx.fillRect(x, y, w, h); ctx.fillStyle = '#c88a5a'; ctx.fillRect(x, y + h - 14, w, 14);
    // le vrai Reyji (de trois quarts), la main qui frotte sa tête... puis sa queue : GRRR
    const fx = x + 76, fy = y + h - 6, ph = 70, k = ph / H3;
    const ok = view.puppet('shiba', fx, fy - (woof ? Math.abs(Math.sin(t * 14)) * 8 : 0), ph, { key: 'demo', face: 1.1, flip: true, cmd: woof ? 'jump' : grr ? 'dash' : '' });
    if (!ok) {
      ctx.save(); ctx.translate(x + 50, y + 8); ctx.scale(0.86, 0.86);
      drawShiba(ctx, 0, { t, wag: woof ? 1 : 0.4, mood: grr ? 2 : woof ? 1 : 0, tongue: woof, jump: woof ? Math.abs(Math.sin(t * 14)) * 0.5 : 0, shake: grr ? 1.5 : 0 });
      ctx.restore();
    }
    const hx = grr ? fx + (71 - FX) * k + Math.sin(t * 30) * 4 : fx + (30 - FX) * k + Math.sin(t * 22) * 6, hy = fy + (grr ? 25 - FY : 22 - FY) * k;
    drawHand(ctx, hx, hy, COLORS[0], t, true, grr);
    if (!grr) {
      view.panel(x + 152, y + 10, 92, 30, 'rgba(255,255,255,0.95)', '#ffa24a');
      view.text('LA TÊTE 🐢', x + 198, y + 25, 11, '#0b0610', { mono: true, stroke: false });
    }
    if (woof) { view.text('WOUF WOUF !', x + 196, y + 60, 15, '#ff5a8a', { title: true }); view.text('♥', x + 60 + Math.sin(t * 9) * 10, y + 14 - ((t * 40) % 20), 10, '#ff5a8a', { stroke: false }); }
    if (grr) { view.text('GRRR !', x + 196, y + 56, 16, '#ff3030', { title: true }); view.text('💢', fx - 20, y + 12, 12, '#fff', { stroke: false }); }
  },

  draw(view, W, M, dt) {
    const ctx = view.g, g = M.g, xs = view.xs, t = view.time, L = -view.ox, Rr = 640 + view.ox, T = -view.oy, B = 360 + view.oy;
    if (!xs.bub) Object.assign(xs, { bub: [0, 0], jump: [0, 0], shake: [0, 0], woof: [null, null], hint: [null, null], rubT: [0, 0], shown: [0, 0], pop: [0, 0], gauge: [DOG.START, DOG.START], grrT: [0, 0], cmd: [null, null], own: [null, null], gd: [0, 0], flip: [g.p[0].roll ? -1 : 1, g.p[1].roll ? -1 : 1] });
    const A = view.audio;
    // le salon : papier peint à cœurs, plancher, tapis
    ctx.fillStyle = '#ffd9c2'; ctx.fillRect(L, T, Rr - L, B - T);
    ctx.fillStyle = '#ffcbb0'; for (let x = Math.floor(L / 24) * 24; x < Rr; x += 24) ctx.fillRect(x, T, 12, B - T);
    for (let k = 0; k < 22; k++) view.text('♥', ((k * 67) % 700) - 20 + Math.sin(t + k) * 3, ((k * 41) % 230) + 8, 10, '#ffb0c0', { stroke: false, alpha: 0.6 });
    ctx.fillStyle = '#b8743e'; ctx.fillRect(L, FLOOR, Rr - L, B - FLOOR);
    ctx.fillStyle = '#a0612e'; for (let x = Math.floor(L / 40) * 40; x < Rr; x += 40) ctx.fillRect(x, FLOOR, 2, B - FLOOR);
    view.text('🐕 CARESSES À REYJI', 320, T + 16, 18, '#e0662a', { title: true });
    view.timer(M, 320, T + 40);
    for (let i = 0; i < 2; i++) {
      const P = g.p[i], slot = i === 0 ? M.a : M.v, ox = OX[i], oy = OY, wish = g.wishes[P.w % g.wishes.length];
      xs.jump[i] = Math.max(0, xs.jump[i] - dt * 2.2); xs.bub[i] = Math.max(0, xs.bub[i] - dt * 3); xs.pop[i] = Math.max(0, xs.pop[i] - dt * 4);
      xs.gauge[i] += (P.hap - xs.gauge[i]) * Math.min(1, dt * 8);
      const mood = moodOf(P), angry = P.stun > 0 || P.grr > DOG.GRR * 0.55;
      // le tapis
      const rx = ox + FX * S, ry = oy + (FY + 2) * S;
      ctx.fillStyle = i === 0 ? '#ff8a8a' : '#8ab8ff'; ctx.beginPath(); ctx.ellipse(rx, ry, 50 * S, 7 * S, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.ellipse(rx, ry, 46 * S, 5.5 * S, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      // son maître (le vrai perso du joueur, grosse tête), à côté de son chien
      xs.gd[i] = P.goodT > 0 ? 1 : Math.max(0, xs.gd[i] - dt * 1.2);
      const ow = xs.own[i], owt = ow ? t - ow.t0 : 99;
      let po;
      if (M.ph === 'outro') po = P.hap >= g.p[1 - i].hap ? { emote: 'win' } : { emote: 'sob' };
      else if (ow && owt < ow.life) po = ow.e === 'grr' ? (owt < 0.35 ? { state: 'hitstun', kb: 130 } : { emote: 'sob' }) : { emote: ow.e, emoteSpeed: 1.2 };
      else if (xs.gd[i] > 0) po = { emote: 'clap' };
      else po = { state: 'idle' };
      const hd = 1.5 + (ow && owt < ow.life ? 0.35 * Math.max(0, 1 - owt * 1.5) + 0.15 : 0) + (view.beatPop || 0) * 0.05;
      view.puppet(W.fighters[slot].char, PX[i] + (ow && ow.e === 'grr' && owt < 0.35 ? (0.35 - owt) * 30 * -1 : 0), FLOOR - 2, 120, { ...po, key: 'own' + i, face: 'three', head: hd });
      // le chien : debout, ou il se retourne (P.lock) puis sur le dos ; il aboie, saute, tourne, grogne, mord dans le vide
      const rolling = P.lock > 0 ? 1 - P.lock / DOG.ROLL : 1;
      const kTo = P.roll ? -1 : 1, kFrom = -kTo;
      let k = P.lock > 0 ? kFrom + (kTo - kFrom) * (0.5 - 0.5 * Math.cos(rolling * Math.PI)) : kTo;
      if (Math.abs(k) < 0.08) k = k < 0 ? -0.08 : 0.08;
      const wf = xs.woof[i], wt = wf ? wf.t : 9;
      let cmd = '', speed = 0;
      if (wt < 0.22) cmd = P.roll ? 'lift' : 'bark';
      else if (wt < 0.85) cmd = P.roll ? 'lift' : (P.streak >= 3 ? 'spin' : 'jump');
      else if (P.roll) cmd = 'lift';
      else if (xs.cmd[i] && t - xs.cmd[i].t0 < 0.45) cmd = xs.cmd[i].c;
      else if (angry) cmd = 'dash';
      else if (P.ok === 2 || P.goodT > 0) speed = 1.6;
      const hop = (wt < 0.85 ? Math.abs(Math.sin(Math.min(1, wt / 0.85) * Math.PI)) * 26 : 0) + Math.abs(Math.sin(rolling * Math.PI)) * (P.lock > 0 ? 30 : 0);
      const shk = angry ? (Math.random() - 0.5) * 3 : 0;
      const sx = mood === 3 ? 1.06 : 1, ky = mood === 3 ? 0.93 : 1 + (P.roll ? Math.sin(t * 9) * 0.02 : 0);
      // l'ombre au sol
      ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(rx, ry - 1, (P.roll ? 30 : 24) * S * (1 - hop / 90), 4 * S, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      const ok3 = shiba3D(view, 'reyji' + i, ox, oy, { cmd, speed }, k * ky, sx, shk, -hop);
      if (!ok3) { // sans 3D : le shiba dessiné
        ctx.save(); ctx.translate(ox, oy); ctx.scale(S, S);
        drawShiba(ctx, P.roll, { t: t + i * 1.7, wag: Math.min(1, P.hap / 120 + (P.goodT > 0 ? 0.5 : 0) + xs.jump[i]), mood, tongue: mood === 1 || xs.jump[i] > 0, jump: Math.abs(Math.sin(xs.jump[i] * 9)) * xs.jump[i], shake: angry ? 1.2 : 0, happyFeet: xs.jump[i] > 0, blush: P.hap > 80 });
        ctx.restore();
      }
      // l'humeur au-dessus de lui (le modèle n'a pas de visage qui change)
      if (P.lock <= 0) {
        const hx0 = ox + (P.roll ? 20 : 30) * S, hy0 = oy + (P.roll ? 72 : 2) * S - hop;
        if (angry) view.text('💢', hx0 + 18 + Math.sin(t * 30) * 2, hy0 - 6, 16 + Math.abs(Math.sin(t * 12)) * 4, '#fff', { stroke: false });
        else if (mood === 1) view.text(view.beatPop > 0.5 ? '💖' : '💕', hx0 + 20, hy0 - 4 - Math.abs(Math.sin(t * 5)) * 6, 13, '#fff', { stroke: false });
        else if (mood === 3) view.text('💤', hx0 + 20, hy0 - 4 - ((t * 10) % 8), 12, '#fff', { stroke: false, alpha: 0.85 });
      }
      // la zone voulue : des pointillés qui clignotent ; la queue : interdit
      if (P.lock <= 0) {
        ctx.save(); ctx.translate(ox, oy); ctx.scale(S, S);
        const Z = DOG_ZONES[P.roll];
        ctx.lineWidth = 1; ctx.setLineDash([2, 1.6]); ctx.lineDashOffset = -t * 8;
        for (const c of Z[wish[0]] || []) { ctx.strokeStyle = Math.sin(t * 10) > 0 ? '#ffffff' : '#ff5a8a'; ctx.beginPath(); ctx.arc(c[0], c[1], c[2] + 1 + Math.sin(t * 6) * 0.8, 0, Math.PI * 2); ctx.stroke(); }
        ctx.setLineDash([]);
        const q = Z[5][0];
        ctx.save(); ctx.translate(q[0] + 7, q[1] - 7); ctx.globalAlpha = 0.85; ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#d01020'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, 0, 3.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-2.5, 2.5); ctx.lineTo(2.5, -2.5); ctx.stroke(); ctx.restore();
        ctx.restore();
      }
      if (P.lock > 0) view.burst(rx, ry - 10, 1, ['#ffffff', '#e8d0b0'], { shape: 'dot', speed: 80, size: 6, life: 0.4, up: 30 });
      // la jauge de grognement (au-dessus de la tête)
      if (P.grr > 4 && P.stun <= 0) {
        const kk = Math.min(1, P.grr / DOG.GRR), hx = ox + (P.roll ? 18 : 30) * S, hy = oy + (P.roll ? 50 : -8) * S;
        view.text('g' + 'r'.repeat(1 + Math.floor(kk * 5)) + '...', hx + (Math.random() - 0.5) * kk * 4, hy, 10 + kk * 8, `rgb(255,${Math.round(200 - kk * 170)},${Math.round(200 - kk * 170)})`, { mono: true });
        if (A && t - xs.grrT[i] > 0.5 - kk * 0.3) { xs.grrT[i] = t; A.sfx('wobble', 0, 0.15 + kk * 0.25, 1); }
      }
      // la main
      const hx = ox + P.x * S, hy = oy + P.y * S, rub = P.touch >= 0;
      drawHand(ctx, hx + (P.stun > 0 ? (Math.random() - 0.5) * 6 : 0), hy, COLORS[slot], t + i, rub, P.stun > 0);
      if (P.ok === 2) {
        // ça frotte bien : des cœurs, des poils, un petit son de temps en temps
        if (t - xs.rubT[i] > 0.12) {
          xs.rubT[i] = t;
          view.burst(hx, hy - 6, 1, HEARTS, { shape: 'txt', ch: view.pick(['♥', '💕', '✨', '♡']), speed: 60, size: 7, up: 90, life: 0.8, g: -20 });
          view.burst(hx, hy, 2, [FUR, CREAM], { speed: 70, size: 3, life: 0.35 });
          if (A) A.sfx(Math.random() < 0.5 ? 'heart' : 'kiss', 0, 0.18, 1 + Math.min(6, P.streak));
        }
      } else if (P.ok === 1 && t - xs.rubT[i] > 0.25) { xs.rubT[i] = t; view.burst(hx, hy, 2, [FUR, CREAM], { speed: 50, size: 3, life: 0.3 }); }
      // la bulle de l'envie
      const bx = ox + 168, by = oy - 30;
      if (P.lock <= 0) {
        const kb = 1 + xs.bub[i] * 0.35;
        ctx.save(); ctx.translate(bx, by); ctx.scale(kb, kb); ctx.rotate(Math.sin(t * 3 + i) * 0.04);
        ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.ellipse(0, 0, 58, 24, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(0, 0, 55.5, 21.5, 0, 0, Math.PI * 2); ctx.fill();
        for (const [dx, dy, r] of [[-52, 18, 5], [-64, 28, 3]]) { ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.arc(dx, dy, r + 2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(dx, dy, r, 0, Math.PI * 2); ctx.fill(); }
        view.text(`${ZONE_ICON[wish[0]]} ${ZONE_LABEL[wish[0]]}`, 0, -7, 10.5, '#0b0610', { mono: true, stroke: false });
        view.text(wish[1] ? '⚡ VITE !' : '🐢 doucement', 0, 8, 11, wish[1] ? '#e0661a' : '#2a8a5a', { mono: true, stroke: false });
        // l'avancée de l'envie, et sa patience qui baisse
        ctx.fillStyle = '#e8dcd0'; ctx.fillRect(-36, 15, 72, 4); ctx.fillStyle = P.ok === 2 ? '#ff5a8a' : '#ff9ac0'; ctx.fillRect(-36, 15, 72 * Math.min(1, P.prog / DOG.NEED), 4);
        ctx.fillStyle = '#c8bad8'; ctx.fillRect(-36, 20, 72 * Math.max(0, 1 - P.wt / DOG.WISH_T), 1.5);
        ctx.restore();
      }
      // l'aide de vitesse
      const hn = xs.hint[i];
      if (hn) { hn.t += dt; if (hn.t > 0.9) xs.hint[i] = null; else view.text(hn.text, hx, hy - 26 - hn.t * 20, 13, hn.col, { mono: true, alpha: 1 - hn.t / 0.9 }); }
      // le « wouf wouf »
      if (wf) {
        wf.t += dt;
        if (wf.t > 1) xs.woof[i] = null;
        else {
          const sc = wf.t < 0.1 ? 0.5 + wf.t * 8 : 1 + Math.sin(wf.t * 20) * 0.04;
          ctx.save(); ctx.translate(ox + (P.roll ? 40 : 14) * S, oy + (P.roll ? 4 : 2) * S); ctx.rotate(-0.12); ctx.scale(sc, sc);
          view.text(wf.text, 0, 0, 22, '#ff5a8a', { title: true, alpha: Math.min(1, (1 - wf.t) / 0.2) });
          ctx.restore();
        }
      }
      // en bas : le nom, le bonheur
      const gx = i * 320 + 24, gy2 = 318, gw = 272;
      view.portraitAt(W.fighters[slot].char, gx + 10, gy2 + 4, 22, COLORS[slot], i === 1);
      view.text(`Reyji de ${view.pname(slot)}`, gx + 28, gy2 - 4, 10, COLORS[slot], { align: 'left', mono: true });
      const hp = Math.round(P.hap);
      if (xs.shown[i] !== hp) { if (hp > xs.shown[i] + 3) xs.pop[i] = 1; xs.shown[i] = hp; }
      const lead = P.hap > g.p[1 - i].hap;
      view.text(`${hp} %`, gx + gw, gy2 - 4, 14 * (1 + xs.pop[i] * 0.4), lead ? '#ff3a7a' : '#ffffff', { align: 'right', mono: true });
      ctx.fillStyle = '#0b0610'; ctx.fillRect(gx + 26, gy2 + 4, gw - 26, 12);
      const lap = Math.floor(xs.gauge[i] / 100), frac = (xs.gauge[i] % 100) / 100;
      if (lap > 0) { ctx.fillStyle = `hsl(${(lap * 70 + 300) % 360},90%,62%)`; ctx.fillRect(gx + 28, gy2 + 6, gw - 30, 8); }
      ctx.fillStyle = lap > 0 ? `hsl(${(t * 300) % 360},100%,65%)` : '#ff5a8a'; ctx.fillRect(gx + 28, gy2 + 6, (gw - 30) * frac, 8);
      view.text('♥ BONHEUR' + (lap > 0 ? ` x${lap + 1} ✨` : ''), gx + 32, gy2 + 10, 7, '#ffffff', { align: 'left', mono: true, stroke: false });
      if (P.streak >= 2) view.text(`SÉRIE x${P.streak} 🔥`, bx, by + 38, 10 + Math.min(6, P.streak), '#ff7a1a', { mono: true });
      if (lead) view.text('👑', gx + 10, gy2 - 16 + Math.sin(t * 6) * 2, 12, '#fff', { stroke: false });
    }
    // le séparateur
    ctx.fillStyle = '#0b0610'; ctx.fillRect(318, 54, 4, 290); ctx.fillStyle = '#ffffff'; ctx.fillRect(319, 54, 2, 290);
  },

  onEvent(view, ev, W, M) {
    const A = view.audio, xs = view.xs, g = M && M.g;
    if (!g || !ev.type.startsWith('mgDog') || !xs.bub) return;
    const i = ev.p, P = g.p[i], ox = OX[i], cx = ox + FX * S;
    const own = (e, life) => { xs.own[i] = { e, t0: view.time, life }; };
    const hx = ox + P.x * S, hy = OY + P.y * S;
    switch (ev.type) {
      case 'mgDogWish':
        xs.bub[i] = 1;
        view.burst(ox + 168, OY - 30, 10, ['#ffffff', '#ffa24a', '#ff8ad0'], { shape: 'star', speed: 140, size: 4, life: 0.4 });
        if (A) A.sfx('pop', 0, 0.5, 2 + ev.z);
        if (ev.roll && P.lock > 0) { own('laugh_01', 0.9); view.sticker(view.pick(['IL SE ROULE ! 🐾', 'LE VENTRE !!', 'PATTES EN L\'AIR']), cx, OY + 40, { size: 15, color: '#ffffff', bg: '#ff8a3a', life: 0.8 }); if (A) A.sfx('boing', 0, 0.6); view.jolt(0.25, 0.03); }
        else if (P.lock > 0 && A) A.sfx('land', 0, 0.5);
        break;
      case 'mgDogWoof': {
        xs.jump[i] = 1; xs.woof[i] = { text: view.pick(WOOFS), t: 0 };
        own(ev.s >= 4 ? 'victory_celebration' : ev.s >= 2 ? 'cheer' : view.pick(['cheer', 'clap']), 1.3);
        view.burst(cx, OY + 90, 26, HEARTS, { shape: 'txt', ch: '♥', speed: 220, size: 8, up: 140, life: 1 });
        view.burst(cx, OY + 90, 20, ['#ffe24a', '#ffffff', '#ffa24a'], { shape: 'star', speed: 260, size: 5 });
        view.floats.push({ text: `+${ev.b} ♥`, x: cx + 60, y: OY + 40, t: 0, life: 0.9, color: '#ff3a7a', size: 18 });
        const st = { 2: 'TROP MIGNON 🥺', 3: 'MEILLEUR AMI 🐶', 4: 'CHIEN COMBLÉ 💯', 5: 'AMOUR INFINI 💖', 6: 'REYJI T\'ÉPOUSE 💍' }[Math.min(6, ev.s)];
        if (st) { view.sticker(st, cx, OY + 30, { size: 17 + Math.min(4, ev.s), color: '#ffffff', bg: '#ff5a8a', life: 0.95 }); view.hype(0.3 + ev.s * 0.1); }
        view.jolt(0.45, 0.05, '#ffb0d0', 0.2);
        if (ev.s >= 4) view.emojiRain(['🐶', '💖', '🦴', '🐾'], 8);
        if (A) { A.sfx('bark', 0, 0.9, 1); A.sfx('bark', 0, 0.7, 2); A.sfx('heart', 0, 0.5, 1 + Math.min(6, ev.s)); A.say(view.pick(['Wouf wouf !', 'Wouf wouf !', 'Waf waf !']), 0.95, 1.3); if (ev.s >= 3) A.sfx('crowd', 0, 0.3); }
        break;
      }
      case 'mgDogGrr': {
        xs.shake[i] = 1; own('grr', 1.5); xs.cmd[i] = { c: 'bite', t0: view.time };
        view.sticker(ev.tail ? view.pick(['PAS LA QUEUE !! 😡', 'TOUCHE PAS LA QUEUE', 'LA QUEUE, JAMAIS']) : view.pick(['GRRRR ! 😠', 'IL GROGNE', 'PAS LÀ !']), cx, OY + 60, { size: 18, color: '#ffffff', bg: '#c01020', life: 0.9 });
        view.burst(hx, hy, 18, ['#ff3030', '#ffffff', '#600000'], { speed: 220, size: 5, life: 0.5 });
        view.burst(hx, hy, 3, ['#fff'], { shape: 'txt', ch: view.pick(['💢', '😾', '🦷']), speed: 140, size: 10, life: 0.8 });
        view.floats.push({ text: `-${ev.loss} ♥`, x: cx + 50, y: OY + 90, t: 0, life: 0.9, color: '#ff3030', size: 17 });
        view.jolt(ev.tail ? 0.9 : 0.6, 0.05, '#ff2020', 0.25);
        if (A) { A.say(ev.tail ? 'Grrrrr ouaf !' : 'Grrrrr...', 0.15, 0.7); A.sfx('bark', 0, 0.6, 0); A.sfx('whip', 0, 0.5); if (ev.tail) A.sfx('error', 0, 0.5); }
        break;
      }
      case 'mgDogHint':
        xs.hint[i] = ev.want ? { text: 'PLUS VITE ! ⚡', col: '#ff8a1a', t: 0 } : { text: 'PLUS DOUCEMENT ! 🐢', col: '#2aaa6a', t: 0 };
        if (A) A.sfx('blip', 0, 0.35, ev.want ? 6 : 1);
        break;
      case 'mgDogBof':
        view.sticker(view.pick(['PFFF... 😒', 'IL S\'ENNUIE', 'BOF.']), cx, OY + 40, { size: 15, color: '#ffffff', bg: '#7a6a8a', life: 0.8 });
        own('complain_01', 1.2);
        view.burst(ox + 30 * S, OY + 10, 3, ['#fff'], { shape: 'txt', ch: '💤', speed: 50, size: 9, up: 60, life: 1 });
        if (A) { A.sfx('wobble', 0, 0.5); A.say('Pfff...', 0.3, 0.8); }
        break;
      default: break;
    }
  },
};
