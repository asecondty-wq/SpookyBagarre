// Sniper des corbeaux (birds), l'affichage : le ciel d'un cimetière la nuit, coupé en deux par un arbre mort (J1 à gauche,
// J2 à droite, les mêmes oiseaux en miroir). Corbeaux maléfiques (yeux rouges qui brillent), corbeaux d'or (étincelles),
// colombes innocentes (une auréole : ne pas tirer !). En bas, chaque tireur (son vrai modèle 3D) et son fusil qui suit
// le viseur ; le viseur à sa couleur, la lunette qui assombrit autour, le recul, la traînée du tir, les plumes, « HEADSHOT ».
import { COLORS } from '../../sim/constants.js';
import { BIRDS, birdPos, birdDir } from '../../sim/mg/birds.js';

const C = BIRDS;
const X0 = [10, 330], Y0 = 40, GROUND = 296;
const HS = ['HEADSHOT !', 'EN PLEINE TÊTE !', 'BOOM HEADSHOT !', 'PILE ENTRE LES YEUX !'];
const KILL = ['CROA... 💀', 'ABATTU !', 'TOUCHÉ !', 'PLUMÉ !', 'AU NID !'];
const MISS = ['RATÉ', 'DANS LE VIDE', 'À CÔTÉ', 'PLOUF'];

function xs(view) {
  const X = view.xs;
  if (!X.fall) { X.fall = []; X.kick = [0, 0]; X.tr = [null, null]; X.sayT = -9; X.sq = [0, 0]; X.hsN = 0; X.flash = [0, 0]; }
  return X;
}
const sx = (i, x) => X0[i] + x;
const sy = (y) => Y0 + y;

// un oiseau, en (x, y), qui regarde vers d (1 : la droite) ; kind 0 corbeau maléfique, 1 d'or, 2 colombe ; dead : yeux en croix
function drawBird(ctx, x, y, d, kind, flap, t, dead = false, rot = 0) {
  ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); ctx.scale(d * 1.75, 1.75);
  const body = kind === 1 ? '#ffc61a' : kind === 2 ? '#f4f0ff' : '#14101c', wing = kind === 1 ? '#e09a10' : kind === 2 ? '#d8d0f0' : '#2a2238';
  const w = Math.sin(flap) * 7;
  // les ailes
  ctx.fillStyle = '#0b0610';
  ctx.beginPath(); ctx.moveTo(-4, -1); ctx.lineTo(-12, -4 - w); ctx.lineTo(2, -2); ctx.fill();
  ctx.fillStyle = wing; ctx.beginPath(); ctx.moveTo(-3, -1); ctx.lineTo(-10, -3 - w * 0.9); ctx.lineTo(1, -2); ctx.fill();
  // le corps, la queue, la tête, le bec
  ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.ellipse(0, 0, 9, 5.5, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(7, -3, 4.6, 0, 7); ctx.fill();
  ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, 0, 7.5, 4.2, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(7, -3, 3.4, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-7, -1); ctx.lineTo(-13, -3); ctx.lineTo(-12, 2); ctx.fill();
  ctx.fillStyle = kind === 2 ? '#ff9a5a' : '#c8a020'; ctx.beginPath(); ctx.moveTo(10, -4); ctx.lineTo(14.5, -2.5); ctx.lineTo(10, -1.5); ctx.fill();
  // l'aile de devant
  ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(-8, -8 + w); ctx.lineTo(4, -1); ctx.fill();
  ctx.fillStyle = wing; ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(-7, -6.5 + w); ctx.lineTo(3, -1); ctx.fill();
  // l'œil : rouge et brillant (maléfique), noir (colombe), en croix (mort)
  if (dead) { ctx.strokeStyle = '#ff3a3a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(7, -5); ctx.lineTo(9, -3); ctx.moveTo(9, -5); ctx.lineTo(7, -3); ctx.stroke(); }
  else if (kind === 2) { ctx.fillStyle = '#0b0610'; ctx.fillRect(7.5, -4.5, 1.6, 1.6); }
  else { ctx.fillStyle = 'rgba(255,40,40,0.45)'; ctx.beginPath(); ctx.arc(8.2, -3.6, 3, 0, 7); ctx.fill(); ctx.fillStyle = '#ff2a2a'; ctx.fillRect(7.4, -4.4, 2, 2); ctx.fillStyle = '#ffffff'; ctx.fillRect(8, -4.4, 0.8, 0.8); }
  ctx.restore();
  if (kind === 2 && !dead) { // l'auréole de l'innocente
    ctx.strokeStyle = '#ffe24a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(x + d * 11, y - 18 + Math.sin(t * 4) * 1, 6, 2, 0, 0, 7); ctx.stroke();
  }
  if (kind === 1 && !dead && Math.sin(t * 13 + x) > 0.6) { ctx.fillStyle = '#fff6c0'; ctx.fillRect(x - 10 + ((t * 50) % 20), y - 9, 2, 2); }
}

function drawSky(view, ctx, i, t, M) {
  const x0 = X0[i];
  const sk = ctx.createLinearGradient(0, Y0, 0, GROUND); sk.addColorStop(0, '#0c0824'); sk.addColorStop(1, '#4a2050');
  ctx.fillStyle = sk; ctx.fillRect(x0, Y0, C.HW, GROUND - Y0);
  ctx.fillStyle = '#fff6d0';
  for (let s = 0; s < 22; s++) { const xx = x0 + (s * 83 + i * 29) % C.HW, yy = Y0 + (s * 47) % 200; ctx.globalAlpha = 0.3 + 0.6 * Math.abs(Math.sin(t * 1.7 + s)); ctx.fillRect(xx, yy, 2, 2); }
  ctx.globalAlpha = 1;
  // la lune (côté de l'arbre), des nuages qui passent
  const mx = 320; // (une seule lune, derrière l'arbre, à cheval sur les deux moitiés)
  ctx.fillStyle = 'rgba(255,240,200,0.12)'; ctx.beginPath(); ctx.arc(mx, Y0 + 60, 44, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff2c8'; ctx.beginPath(); ctx.arc(mx, Y0 + 60, 28, 0, 7); ctx.fill();
  ctx.fillStyle = '#e8d8a8'; ctx.beginPath(); ctx.arc(mx - 8, Y0 + 54, 5, 0, 7); ctx.arc(mx + 9, Y0 + 68, 4, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(40,24,60,0.7)';
  for (let k = 0; k < 3; k++) {
    const cx = x0 + ((k * 130 + t * (8 + k * 4)) % (C.HW + 120)) - 60, cy = Y0 + 30 + k * 60;
    ctx.beginPath(); ctx.arc(cx, cy, 14, 0, 7); ctx.arc(cx + 18, cy - 6, 18, 0, 7); ctx.arc(cx + 38, cy, 13, 0, 7); ctx.fill();
  }
}

// le sol du cimetière, les tombes, le tireur et son fusil qui suit le viseur
function drawShooter(view, W, M, X, i, P, t) {
  const ctx = view.g, slot = i === 0 ? M.a : M.v, col = COLORS[slot], ch = W.fighters[slot].char;
  const px = i === 0 ? X0[0] + 52 : X0[1] + C.HW - 52, py = 352;
  const ax = sx(i, P.x), ay = sy(P.y) - X.kick[i] * 10;
  const ox = px + (i === 0 ? 10 : -10), oy = py - 42, ang = Math.atan2(ay - oy, ax - ox), kb = X.kick[i] * 6;
  if (view.pupOn(M)) {
    if (!view.puppet(ch, px, py, 62, { key: view.pkey(W, M, i), state: X.sq[i] > 0.5 ? 'hitstun' : 'idle', kb: 20, face: i === 0 ? 'threeL' : 'three', head: 1.5, shadow: false })) view.portraitAt(ch, px, py - 26, 22, col, i === 1);
  }
  // le fusil (crosse, canon, lunette), qui recule au tir
  ctx.save(); ctx.translate(ox - Math.cos(ang) * kb, oy - Math.sin(ang) * kb); ctx.rotate(ang);
  ctx.fillStyle = '#0b0610'; ctx.fillRect(-14, -4, 62, 8); ctx.fillStyle = '#6a4030'; ctx.fillRect(-13, -3, 18, 6); ctx.fillStyle = '#4a4458'; ctx.fillRect(5, -2, 42, 4);
  ctx.fillStyle = '#0b0610'; ctx.fillRect(10, -9, 20, 6); ctx.fillStyle = col; ctx.fillRect(11, -8, 18, 4);
  if (X.flash[i] > 0) { ctx.fillStyle = '#fff6a0'; ctx.beginPath(); ctx.moveTo(48, 0); ctx.lineTo(64, -7); ctx.lineTo(60, 0); ctx.lineTo(64, 7); ctx.fill(); }
  ctx.restore();
  return [ox + Math.cos(ang) * 50, oy + Math.sin(ang) * 50];
}

function drawScope(view, ctx, i, P, col, X, t) {
  const x = sx(i, P.x), y = sy(P.y) - X.kick[i] * 10, r = 20 + X.kick[i] * 10;
  // la lunette : tout s'assombrit autour du viseur
  const v = ctx.createRadialGradient(x, y, 36, x, y, 150); v.addColorStop(0, 'rgba(6,2,12,0)'); v.addColorStop(1, 'rgba(6,2,12,0.5)');
  ctx.fillStyle = v; ctx.fillRect(X0[i], Y0, C.HW, GROUND - Y0);
  ctx.strokeStyle = '#0b0610'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
  ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
  ctx.lineWidth = 1.5; ctx.beginPath();
  ctx.moveTo(x - r - 8, y); ctx.lineTo(x - 5, y); ctx.moveTo(x + 5, y); ctx.lineTo(x + r + 8, y);
  ctx.moveTo(x, y - r - 8); ctx.lineTo(x, y - 5); ctx.moveTo(x, y + 5); ctx.lineTo(x, y + r + 8); ctx.stroke();
  ctx.fillStyle = '#ff3a3a'; ctx.fillRect(x - 1, y - 1, 2, 2);
  // le rechargement : un arc qui se remplit
  if (P.cd > 0) {
    ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = 0.8; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r + 6, -Math.PI / 2, -Math.PI / 2 + (1 - P.cd / C.RELOAD) * Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
  }
}

export default {
  title: 'SNIPER DES CORBEAUX', color: '#d03a3a', icon: '🐦‍⬛',
  input: 'mouse',
  goal: 'Mets ton viseur sur les corbeaux et tire ! Pas sur les colombes !',
  keys: { pad: [['stick', 'viser'], ['A', 'tirer']], kb: [['dirs', 'viser'], ['A', 'tirer']], kb1: [['dirs', 'viser'], ['mouse', 'aussi'], ['A', 'tirer']] },
  ach: [['Œil de faucon', 'Chasseur de corbeaux', 'Headshot en série', 'Fléau des plumes'], ['Ami des corbeaux', 'Tueur de colombes', 'Tireur du dimanche', 'Lunette embuée']],
  news: (L, d) => `${L} RATE TOUS LES CORBEAUX : ${d} % ET UNE FIENTE SUR LA LUNETTE`,

  warm(view, W, M) {
    for (let i = 0; i < 2; i++) for (const s of ['idle', 'hitstun']) view.puppet(W.fighters[i ? M.v : M.a].char, -9999, -9999, 10, { key: view.pkey(W, M, i), state: s, kb: 20, face: i === 0 ? 'threeL' : 'three', head: 1.5, shadow: false });
  },

  draw(view, W, M, dt) {
    const ctx = view.g, g = M.g;
    if (!g || !g.p) return;
    const X = xs(view), t = view.time, L = -view.ox, R = 640 + view.ox, T = -view.oy, B = 360 + view.oy, slots = [M.a, M.v];
    const tt = Math.min(M.ph === 'play' ? M.t : 600, 600);
    ctx.fillStyle = '#0b0610'; ctx.fillRect(L, T, R - L, B - T);
    for (let i = 0; i < 2; i++) {
      const P = g.p[i], col = COLORS[slots[i]];
      X.kick[i] = Math.max(0, X.kick[i] - dt * 7); X.flash[i] = Math.max(0, X.flash[i] - dt); X.sq[i] = Math.max(0, X.sq[i] - dt * 2);
      ctx.save(); ctx.beginPath(); ctx.rect(X0[i], Y0, C.HW, GROUND - Y0); ctx.clip();
      drawSky(view, ctx, i, t, M);
      // les oiseaux en vol (ceux de ce joueur qui ne sont pas tués)
      if (M.ph === 'play') {
        for (let k = 0; k < g.sp.length; k++) {
          const b = g.sp[k];
          if (b[0] > tt) break;
          if (P.dead[k]) continue;
          const q = birdPos(b, tt, i);
          if (q) drawBird(ctx, sx(i, q[0]), sy(q[1]), birdDir(b, i), b[6], t * 16 + k * 1.7, t);
        }
      }
      // les tués qui tombent en tournoyant
      for (const f of X.fall) if (f.i === i) drawBird(ctx, f.x, f.y, f.d, f.kind, 0.5, t, true, f.r);
      // la traînée du dernier tir
      const tr = X.tr[i];
      if (tr && tr.life > 0) { ctx.strokeStyle = `rgba(255,246,190,${tr.life / 0.12})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(tr.x0, tr.y0); ctx.lineTo(tr.x1, tr.y1); ctx.stroke(); tr.life -= dt; }
      drawScope(view, ctx, i, P, col, X, t);
      ctx.restore();
      // la légende, en haut de sa moitié : qui rapporte quoi
      for (const [k, kind, v, c] of [[0, 0, '+1', '#ffffff'], [1, 1, '+3', '#ffe24a'], [2, 2, '-2', '#ff6a6a']]) {
        const lx = X0[i] + C.HW / 2 - 80 + k * 70;
        ctx.globalAlpha = 0.85; drawBird(ctx, lx, Y0 + 18, 1, kind, 1, t); ctx.globalAlpha = 1;
        view.text(v, lx + 26, Y0 + 18, 11, c, { mono: true });
      }
      // ses touches, sous son viseur
      const hx = Math.max(X0[i] + 70, Math.min(X0[i] + C.HW - 70, sx(i, P.x))), hy = P.y > C.HH - 50 ? sy(P.y) - 42 : sy(P.y) + 40;
      view.hint(W, M, i, hx, hy, [['dirs', 'viser'], ['A', 'TIRER']]);
      // le cadre de sa moitié
      ctx.strokeStyle = '#0b0610'; ctx.lineWidth = 4; ctx.strokeRect(X0[i] - 1, Y0 - 1, C.HW + 2, GROUND - Y0 + 2);
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.strokeRect(X0[i] + 1, Y0 + 1, C.HW - 2, GROUND - Y0 - 2);
    }
    // les plumes tombées : mise à jour
    for (let n = X.fall.length - 1; n >= 0; n--) { const f = X.fall[n]; f.vy += 600 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.r += f.vr * dt; if (f.y > GROUND + 30) X.fall.splice(n, 1); }
    // l'arbre mort au milieu
    ctx.fillStyle = '#0b0610';
    ctx.fillRect(312, Y0 - 10, 16, B - Y0 + 10);
    ctx.beginPath(); ctx.moveTo(316, 120); ctx.lineTo(282, 84); ctx.lineTo(286, 80); ctx.lineTo(320, 110); ctx.fill();
    ctx.beginPath(); ctx.moveTo(324, 170); ctx.lineTo(362, 140); ctx.lineTo(364, 146); ctx.lineTo(326, 182); ctx.fill();
    ctx.beginPath(); ctx.moveTo(318, 230); ctx.lineTo(290, 214); ctx.lineTo(292, 209); ctx.lineTo(322, 222); ctx.fill();
    // le sol : herbe, tombes
    ctx.fillStyle = '#1a1424'; ctx.fillRect(L, GROUND, R - L, B - GROUND);
    ctx.fillStyle = '#2a4a2a'; ctx.fillRect(L, GROUND, R - L, 3);
    for (const gx of [150, 230, 410, 490]) {
      ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.roundRect(gx - 10, GROUND - 14, 20, 30, [8, 8, 0, 0]); ctx.fill();
      ctx.fillStyle = '#5a5068'; ctx.beginPath(); ctx.roundRect(gx - 8, GROUND - 12, 16, 28, [7, 7, 0, 0]); ctx.fill();
      ctx.fillStyle = '#3a3448'; ctx.fillRect(gx - 4, GROUND - 4, 8, 2); ctx.fillRect(gx - 4, GROUND, 8, 2);
    }
    for (let i = 0; i < 2; i++) {
      const P = g.p[i];
      const tip = drawShooter(view, W, M, X, i, P, t);
      if (X.tr[i] && X.tr[i].fresh) { X.tr[i].x0 = tip[0]; X.tr[i].y0 = tip[1]; X.tr[i].fresh = 0; }
      // qui, combien
      if (i === 0) { const w = view.who(W, M, 0, 96, GROUND + 8); view.text(`${P.n}`, 106 + w, GROUND + 22, 22 + X.sq[i] * 6, '#ffffff', { align: 'left', mono: true }); }
      else { const w = view.who(W, M, 1, 544, GROUND + 8, { align: 'right' }); view.text(`${P.n}`, 534 - w, GROUND + 22, 22 + X.sq[i] * 6, '#ffffff', { align: 'right', mono: true }); }
      if (g.lead === i) view.text('👑', i === 0 ? 300 : 340, GROUND + 22, 13, '#fff', { stroke: false, align: i === 0 ? 'right' : 'left' });
    }
    view.timer(M, 320, 22);
  },

  onEvent(view, ev, W, M) {
    if (!M || M.kind !== 'birds' || !M.g || !M.g.p) return;
    if (!ev.type.startsWith('mgBirds') && ev.type !== 'mgEnd' && ev.type !== 'mgGo') return;
    const A = view.audio, X = xs(view), i = ev.p, pan = i === 0 ? -0.45 : 0.45;
    switch (ev.type) {
      case 'mgGo':
        view.sticker('FEU À VOLONTÉ ! 🎯', 320, 150, { size: 26, color: '#ffffff', bg: '#d03a3a', life: 0.9 });
        if (A) A.say('Les corbeaux arrivent ! Pas les colombes !', 0.5, 1.15);
        break;
      case 'mgBirdsShot': {
        X.kick[i] = 1; X.flash[i] = 0.06;
        const x = sx(i, ev.x), y = sy(ev.y);
        X.tr[i] = { x0: x, y0: GROUND, x1: x, y1: y, life: 0.12, fresh: 1 };
        if (A) { A.sfx('shotgun', pan, 0.35, 3); A.sfx('whip', pan, 0.4, 2); }
        if (!ev.hit) {
          view.burst(x, y, 5, ['#c8c0d0', '#8a8098'], { shape: 'dot', speed: 50, up: 10, g: 40, life: 0.3, size: 2 });
          if (Math.random() < 0.35) view.sticker(view.pick(MISS), x, y - 22, { size: 10, color: '#c8bad8', bg: '#2a2238', life: 0.4 });
          break;
        }
        X.fall.push({ i, x, y, vx: ev.d * 40 + (Math.random() - 0.5) * 60, vy: -120, r: 0, vr: (Math.random() < 0.5 ? -1 : 1) * 9, d: ev.d, kind: ev.kind });
        if (X.fall.length > 24) X.fall.shift();
        X.sq[i] = 1;
        if (ev.kind === 2) {
          view.sticker('LA COLOMBE ?! -2 😇', x, y - 26, { size: 15, color: '#0b0610', bg: '#f4f0ff', life: 1 });
          view.burst(x, y, 18, ['#ffffff', '#e0d8f0'], { shape: 'sq', speed: 140, up: 30, g: 120, life: 1, size: 4 });
          view.burst(x, y, 3, ['#fff'], { shape: 'txt', ch: '💔', speed: 80, up: 60, size: 8, life: 1 });
          view.jolt(0.3, 0.02, '#ffffff', 0.2);
          if (A) { A.sfx('error', pan, 0.6); A.sfx('sob', pan, 0.5); if (view.time - X.sayT > 1.5) { X.sayT = view.time; A.say('Pas la colombe !', 0.6, 1.2); } }
          break;
        }
        const gold = ev.kind === 1;
        view.burst(x, y, 16, gold ? ['#ffe24a', '#ffc61a', '#fff6c0'] : ['#14101c', '#2a2238', '#4a3a5a'], { shape: 'sq', speed: 150, up: 20, g: 90, life: 1.1, size: 4 });
        view.burst(x, y, 3, ['#fff'], { shape: 'txt', ch: '🪶', speed: 90, up: 40, g: 60, size: 8, life: 1.3 });
        view.burst(x, y, 6, ['#ff3a3a', '#a01020'], { shape: 'dot', speed: 110, up: 30, life: 0.5, size: 3 });
        if (A) { A.sfx('hitmark', pan, 0.6); A.sfx('poof', pan, 0.4); }
        if (ev.head) {
          X.hsN++;
          view.sticker(view.pick(HS), x, y - 28, { size: 16, color: '#ffffff', bg: '#d02a2a', life: 0.8, rot: (Math.random() - 0.5) * 0.4 });
          view.jolt(0.35, 0.03, '#ff3a3a', 0.12);
          if (A && view.time - X.sayT > 1.3) { X.sayT = view.time; A.say('Headshot !', 0.55, 1.3); }
        } else view.sticker(gold ? 'CORBEAU D\'OR ! +3' : view.pick(KILL), x, y - 24, { size: gold ? 15 : 11, color: '#0b0610', bg: gold ? '#ffe24a' : '#f4ead6', life: 0.6 });
        if (gold) { view.burst(x, y, 20, ['#ffe24a', '#ffffff'], { shape: 'star', speed: 200, size: 5, life: 0.8 }); view.hype(0.4); if (A) A.sfx('cash', pan, 0.6); }
        break;
      }
      case 'mgBirdsLead':
        view.sticker('👑 EN TÊTE !', i === 0 ? 160 : 480, 70, { size: 12, color: '#0b0610', bg: '#ffe24a', life: 0.6 });
        if (A) A.sfx('countHi', pan, 0.3);
        break;
      case 'mgEnd':
        view.emojiRain(['🐦‍⬛', '🪶', '🎯', '💀'], 10);
        break;
      default: break;
    }
  },
};
