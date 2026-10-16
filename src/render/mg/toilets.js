// Toilettes propres (toilets), l'affichage : deux couloirs de toilettes publiques côte à côte (J1 à gauche, J2 à droite),
// carrelage douteux, néon qui grésille ; une rangée de portes de cabines, le vrai perso du joueur devant celle qu'il vise
// (une flèche à sa couleur au-dessus). Sous les portes sales, des mouches qui tournent (et une odeur verte) ; sous la
// propre, un éclat qui scintille de temps en temps. Une porte sale ouverte : la cuvette verdâtre, les mouches, les
// vapeurs, « BEURK » ; la propre : elle brille, chœur d'anges, « PROPRE ✨ ».
import { WC } from '../../sim/mg/toilets.js';
import { COLORS } from '../../sim/constants.js';

const X0 = [8, 328], ZW = 304, TOP = 58, DOOR_Y = 100, DOOR_H = 124, FLOOR = 232, PUP_Y = 294;
const DOOR_COL = ['#3a8adf', '#d0503a', '#3aa86a', '#c89a2a', '#8a5ad0', '#d05a9a'];
const GROSS = ['BEURK 🤢', 'ATROCE 🤮', 'NOPE.', 'AU SECOURS', 'MES YEUX 😵', 'QUI A FAIT ÇA ?!', 'C\'EST VIVANT ?!'];
const CLEAN = ['PROPRE ✨', 'LE PARADIS 😇', 'ÇA SENT LA ROSE 🌹', 'ENFIN !', 'TRÔNE ROYAL 👑'];
const SAY_G = ['Beurk !', 'Oh non !', 'Au secours !', 'C\'est quoi ça ?!', 'Mes yeux !'];
const SAY_C = ['Propre !', 'Enfin !', 'Le paradis !', 'Ça brille !'];

const doorX = (i, n, d) => { const w = ZW / n; return X0[i] + w * d + w / 2; };
const doorW = (n) => Math.min(48, ZW / n - 8);

function ensure(xs, g) {
  if (xs.on) return xs;
  xs.on = 1; xs.px = [0, 0]; xs.mvT = [0, 0]; xs.shake = [0, 0]; xs.flash = [0, 0]; xs.openT = [{}, {}]; xs.shown = [0, 0]; xs.pop = [0, 0]; xs.slide = [0, 0];
  for (let i = 0; i < 2; i++) { const R = g.rounds[g.p[i].r % WC.ROUNDS]; xs.px[i] = doorX(i, R.n, g.p[i].c); }
  return xs;
}

export default {
  title: 'TOILETTES PROPRES', color: '#7ae0a0', icon: '🚽',
  goal: 'Ouvre les portes et trouve vite les toilettes propres !',
  keys: [['lr', 'choisir la porte'], ['A', 'ouvrir']],
  ach: [
    ['Sommelier de cuvettes', 'Flair de chien truffier', 'Inspecteur des WC', 'Le trône est à moi'],
    ['A tout vu, a tout senti', 'Ami des mouches', 'Narines en PLS', 'Abonné aux toilettes du TER'],
  ],
  news: (L, d) => `${L} OUVRE LA MAUVAISE PORTE : SES NARINES NE S'EN REMETTENT PAS (+${d} %)`,

  draw(view, W, M, dt) {
    const ctx = view.g, g = M.g, xs = ensure(view.xs, g), t = view.time;
    const L = -view.ox, Rr = 640 + view.ox, T = -view.oy, B = 360 + view.oy;
    // le fond : carrelage vert d'hôpital, le sol
    ctx.fillStyle = '#1a2a24'; ctx.fillRect(L, T, Rr - L, B - T);
    for (let i = 0; i < 2; i++) {
      const P = g.p[i], R = g.rounds[P.r % WC.ROUNDS], slot = i === 0 ? M.a : M.v, col = COLORS[slot], x0 = X0[i];
      xs.shake[i] = Math.max(0, xs.shake[i] - dt * 3); xs.flash[i] = Math.max(0, xs.flash[i] - dt * 2.5); xs.pop[i] = Math.max(0, xs.pop[i] - dt * 4);
      xs.slide[i] = Math.max(0, xs.slide[i] - dt * 3);
      const sh = xs.shake[i] > 0 ? (Math.random() - 0.5) * xs.shake[i] * 8 : 0;
      ctx.save();
      ctx.beginPath(); ctx.rect(x0 - 4, TOP - 4, ZW + 8, B - TOP + 4); ctx.clip();
      ctx.translate(sh, 0);
      // le mur carrelé (tuiles un peu jaunies), le néon
      ctx.fillStyle = '#cfe6d8'; ctx.fillRect(x0, TOP, ZW, FLOOR - TOP);
      ctx.fillStyle = '#b8d4c4';
      for (let y = TOP; y < FLOOR; y += 16) ctx.fillRect(x0, y, ZW, 1);
      for (let x = x0; x < x0 + ZW; x += 16) ctx.fillRect(x, TOP, 1, FLOOR - TOP);
      ctx.fillStyle = 'rgba(160,140,60,0.18)'; ctx.fillRect(x0 + 30, 160, 40, 70); ctx.fillRect(x0 + 200, 120, 26, 110);
      const neon = Math.sin(t * 37 + i * 3) > 0.93 ? 0.35 : 1;
      ctx.fillStyle = `rgba(240,255,250,${0.9 * neon})`; ctx.fillRect(x0 + ZW / 2 - 60, TOP + 3, 120, 5);
      ctx.fillStyle = `rgba(240,255,250,${0.12 * neon})`; ctx.beginPath(); ctx.moveTo(x0 + ZW / 2 - 60, TOP + 8); ctx.lineTo(x0 + ZW / 2 + 60, TOP + 8); ctx.lineTo(x0 + ZW / 2 + 120, FLOOR); ctx.lineTo(x0 + ZW / 2 - 120, FLOOR); ctx.closePath(); ctx.fill();
      // le sol en damier
      for (let y = FLOOR; y < B; y += 14) for (let x = x0; x < x0 + ZW; x += 14) { ctx.fillStyle = ((x - x0) / 14 + (y - FLOOR) / 14) % 2 ? '#6a7a74' : '#8a9a92'; ctx.fillRect(x, y, 14, 14); }
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x0, FLOOR, ZW, 6);
      // les portes
      const dw = doorW(R.n);
      for (let d = 0; d < R.n; d++) drawDoor(view, W, M, g, i, R, d, doorX(i, R.n, d), dw, t, xs);
      // la flèche et le perso devant la porte visée
      const tx = doorX(i, R.n, P.c);
      const was = xs.px[i]; xs.px[i] += (tx - xs.px[i]) * Math.min(1, dt * 14);
      const moving = Math.abs(xs.px[i] - was) > 0.4;
      if (P.wait <= 0) {
        const ay = DOOR_Y - 18 + Math.sin(t * 8) * 3;
        ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.moveTo(xs.px[i] - 11, ay - 9); ctx.lineTo(xs.px[i] + 11, ay - 9); ctx.lineTo(xs.px[i], ay + 6); ctx.closePath(); ctx.fill();
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(xs.px[i] - 8, ay - 7); ctx.lineTo(xs.px[i] + 8, ay - 7); ctx.lineTo(xs.px[i], ay + 3); ctx.closePath(); ctx.fill();
        // au-dessus de la porte visée : la touche pour ouvrir, et de chaque côté celle pour changer de porte
        const human = !W.fighters[slot].bot;
        view.text(human ? `${view.keyName(M, i, 'A')} = OUVRIR` : view.pname(slot), xs.px[i], ay - 16, human ? 12 : 10, col, { mono: true });
        if (human) {
          if (P.c > 0) view.text(`◀ ${dirKey(view, M, i, 3)}`.trim(), xs.px[i] - 22, ay - 2, 10, '#ffffff', { align: 'right', mono: true });
          if (P.c < R.n - 1) view.text(`${dirKey(view, M, i, 1)} ▶`.trim(), xs.px[i] + 22, ay - 2, 10, '#ffffff', { align: 'left', mono: true });
        }
        // le cadre de la porte visée, à sa couleur
        ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.strokeRect(tx - dw / 2 - 4, DOOR_Y - 4, dw + 8, DOOR_H + 8);
      }
      let po;
      const ot = xs.openT[i].last, ok = ot && t - ot.t < 1.2 ? ot : null;
      if (M.ph === 'outro') po = P.score >= g.p[1 - i].score ? { emote: 'win' } : { emote: 'sob' };
      else if (P.wait > 0) po = { emote: 'victory_celebration', emoteSpeed: 1.3 };
      else if (ok && ok.gross) po = t - ok.t < 0.3 ? { state: 'hitstun', kb: 120 } : { emote: 'sob' };
      else if (P.lock > 0) po = { state: 'dizzy' };
      else if (moving) po = { state: 'walk' };
      else po = { state: 'idle' };
      if (view.pupOn(M)) view.player(W, M, i, xs.px[i], PUP_Y, 76, { ...po, face: 'back', head: 1.6 });
      // le compteur : les toilettes trouvées, le score
      xs.shown[i] += (P.score - xs.shown[i]) * Math.min(1, dt * 10);
      ctx.restore();
      // en bas (au-dessus du bandeau du but) : le score côté extérieur, les touches côté intérieur
      const sx = X0[i] + (i ? ZW - 8 : 8), al = i ? 'right' : 'left';
      view.text(`🚽 ${P.found} · ${Math.round(xs.shown[i])}`, sx, 312, 15 * (1 + xs.pop[i] * 0.3), col, { align: al, mono: true });
      view.text('propre = ✨ sous la porte', sx, 294, 9, '#fff6a0', { align: al, mono: true });
      view.hint(W, M, i, X0[i] + (i ? 8 : ZW - 8), 312, [['lr', 'porte'], ['A', 'ouvrir']], { align: i ? 'left' : 'right' });
      // le cadre de la zone, à la couleur du joueur
      ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.strokeRect(x0 - 2, TOP - 2, ZW + 4, B - TOP + 10);
      if (xs.flash[i] > 0) { ctx.fillStyle = xs.openT[i].last && xs.openT[i].last.gross ? `rgba(120,200,40,${xs.flash[i] * 0.35})` : `rgba(255,250,200,${xs.flash[i] * 0.5})`; ctx.fillRect(x0, TOP, ZW, B - TOP); }
    }
    view.text('🚽 TOILETTES PROPRES', 320, 16, 15, '#7ae0a0', { title: true });
    view.timer(M, 320, 38);
  },

  onEvent(view, ev, W, M) {
    const A = view.audio, xs = view.xs, g = M && M.g;
    if (!g || !ev.type.startsWith('mgToilets') || !xs.on) return;
    const i = ev.p, P = g.p[i], R = g.rounds[P.r % WC.ROUNDS], slot = i === 0 ? M.a : M.v, pan = i ? 0.4 : -0.4;
    switch (ev.type) {
      case 'mgToiletsMove': if (A) A.sfx('menuMove', pan, 0.25); break;
      case 'mgToiletsAgain':
        view.sticker('DÉJÀ VU 🤢', doorX(i, R.n, ev.d), DOOR_Y + 40, { size: 12, color: '#ffffff', bg: '#5a7a3a', life: 0.5 });
        if (A) A.sfx('error', pan, 0.3);
        break;
      case 'mgToiletsGross': {
        const x = doorX(i, R.n, ev.d);
        xs.openT[i][ev.d] = view.time; xs.openT[i].last = { t: view.time, gross: 1 }; xs.shake[i] = 1; xs.flash[i] = 1;
        view.sticker(view.pick(GROSS), x, DOOR_Y + 30, { size: 15, color: '#ffffff', bg: '#4a8a1a', life: 0.8 });
        view.burst(x, DOOR_Y + 70, 16, ['#8aff3a', '#5ac81a', '#c8ff8a'], { shape: 'dot', speed: 120, size: 6, up: 90, life: 0.9, g: -40 });
        view.burst(x, DOOR_Y + 60, 6, ['#fff'], { shape: 'txt', ch: view.pick(['🪰', '🤢', '🦠', '💨']), speed: 130, size: 11, up: 60, life: 1 });
        view.floats.push({ text: `-${WC.GROSS}`, x, y: DOOR_Y + 10, t: 0, life: 0.8, color: '#9aff4a', size: 16 });
        view.jolt(0.4, 0.03, '#60c020', 0.18);
        if (A) { A.sfx('wood', pan, 0.6); A.sfx(view.pick(['splat', 'fart', 'gurgle']), pan, 0.6); A.sfx('wobble', pan, 0.3); if (Math.random() < 0.6) A.say(view.pick(SAY_G), 0.6, 1.3); }
        break;
      }
      case 'mgToiletsClean': {
        const x = doorX(i, R.n, ev.d);
        xs.openT[i][ev.d] = view.time; xs.openT[i].last = { t: view.time, gross: 0 }; xs.flash[i] = 1; xs.pop[i] = 1;
        view.sticker(view.pick(CLEAN), x, DOOR_Y + 20, { size: 17, color: '#0b0610', bg: '#fff6a0', life: 0.9 });
        view.burst(x, DOOR_Y + 70, 26, ['#ffffff', '#fff6a0', '#a0f0ff', '#ffd23a'], { shape: 'star', speed: 240, size: 6, life: 0.8 });
        view.burst(x, DOOR_Y + 60, 5, ['#fff'], { shape: 'txt', ch: view.pick(['✨', '🧻', '😇', '🌹']), speed: 140, size: 12, up: 120, life: 1 });
        view.floats.push({ text: `+${ev.pts}`, x, y: DOOR_Y - 4, t: 0, life: 0.9, color: COLORS[slot], size: 20 });
        if (ev.first) view.sticker(view.pick(['DU PREMIER COUP !', 'FLAIR DE CHIEN 🐕', 'NEZ D\'OR 👃']), X0[i] + ZW / 2, 140, { size: 13, color: '#ffffff', bg: '#d08a10', life: 0.8 });
        if (ev.st >= 3) { view.sticker(`SÉRIE x${ev.st} 🔥`, X0[i] + ZW / 2, 168, { size: 15, color: '#ffffff', bg: '#ff3a3a', life: 0.9 }); view.hype(0.4); }
        view.jolt(0.35, 0.04, '#fffad0', 0.25);
        if (A) { A.sfx('wood', pan, 0.5); A.sfx('heart', pan, 0.6, 1 + Math.min(5, ev.n)); A.sfx('cash', pan, 0.5); A.sfx('flash', pan, 0.25); if (Math.random() < 0.6) A.say(view.pick(SAY_C), 0.9, 1.25); if (ev.st >= 3) A.sfx('airhorn', 0, 0.35); }
        break;
      }
      case 'mgToiletsRound':
        xs.openT[i] = {}; xs.slide[i] = 1; xs.px[i] = doorX(i, ev.n, P.c);
        if (A) A.sfx('whoosh', pan, 0.4);
        break;
      default: break;
    }
  },
};

// une porte de cabine : fermée (un numéro, des mouches ou un éclat dessous), ou ouverte sur ce qu'il y a dedans
function drawDoor(view, W, M, g, i, R, d, x, dw, t, xs) {
  const ctx = view.g, P = g.p[i], open = P.open & (1 << d), y = DOOR_Y, h = DOOR_H, clean = d === R.clean;
  // l'encadrement
  ctx.fillStyle = '#0b0610'; ctx.fillRect(x - dw / 2 - 3, y - 3, dw + 6, h + 3);
  if (open) {
    const ot = xs.openT[i][d] || 0, q = Math.min(1, (view.time - ot) / 0.18);
    // dedans : la cabine, la cuvette
    ctx.fillStyle = clean ? '#fffbe8' : '#3a4a1a'; ctx.fillRect(x - dw / 2, y, dw, h);
    if (clean) {
      const glow = 0.5 + 0.5 * Math.sin(t * 6);
      ctx.fillStyle = `rgba(255,240,140,${0.35 + glow * 0.25})`; ctx.beginPath(); ctx.arc(x, y + h * 0.62, dw * 0.7, 0, Math.PI * 2); ctx.fill();
    }
    toilet(ctx, x, y + h - 10, dw * 0.42, clean, t + d);
    if (!clean) {
      // les vapeurs vertes, les mouches
      for (let k = 0; k < 3; k++) { const u = (t * 0.8 + k / 3) % 1; ctx.fillStyle = `rgba(140,230,60,${0.45 * (1 - u)})`; ctx.beginPath(); ctx.arc(x + Math.sin(t * 3 + k * 2) * 8, y + h - 34 - u * 70, 6 + u * 10, 0, Math.PI * 2); ctx.fill(); }
      flies(view, x, y + h - 40, 4, t + d * 1.7, 16);
    } else if (Math.sin(t * 9 + d) > 0.3) view.text('✨', x + Math.sin(t * 4) * 12, y + 20 + Math.cos(t * 3) * 8, 12, '#fff', { stroke: false });
    // la porte rabattue contre la cloison
    const pw = dw * (1 - q * 0.82);
    ctx.fillStyle = DOOR_COL[R.col]; ctx.fillRect(x - dw / 2, y, pw, h);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x - dw / 2 + pw - 3, y, 3, h);
  } else {
    ctx.fillStyle = DOOR_COL[R.col]; ctx.fillRect(x - dw / 2, y, dw, h);
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x - dw / 2 + 4, y + 6, dw - 8, 3); ctx.fillRect(x - dw / 2 + 4, y + h - 34, dw - 8, 2);
    // la plaque, la poignée, le verrou « libre »
    ctx.fillStyle = '#f4f4f8'; ctx.fillRect(x - 10, y + 16, 20, 14);
    view.text(String(d + 1), x, y + 24, 10, '#0b0610', { mono: true, stroke: false });
    ctx.fillStyle = '#d8d8e0'; ctx.fillRect(x + dw / 2 - 9, y + h / 2, 5, 12);
    ctx.fillStyle = '#3ac85a'; ctx.fillRect(x + dw / 2 - 10, y + h / 2 - 9, 7, 5);
    // sous la porte : le jour (un trou de 8 de haut), et les indices
    ctx.fillStyle = clean ? '#fffbe0' : '#9ac86a'; ctx.fillRect(x - dw / 2, y + h - 2, dw, 4);
    if (clean) {
      // l'éclat de la propre : une seconde sur deux, environ
      const tw = Math.sin(t * 4.2 + d * 1.3);
      if (tw > 0.2) {
        const a = Math.min(1, (tw - 0.2) * 2);
        ctx.fillStyle = `rgba(255,250,200,${0.55 * a})`; ctx.beginPath(); ctx.ellipse(x, y + h + 2, dw * 0.55, 5, 0, 0, Math.PI * 2); ctx.fill();
        view.text('✨', x - dw * 0.3 + Math.sin(t * 2) * 4, y + h - 6, 10, '#fff', { stroke: false, alpha: a });
        view.text('✨', x + dw * 0.3, y + h - 14 + Math.cos(t * 3) * 3, 8, '#fff', { stroke: false, alpha: a });
      }
    } else if (R.flies & (1 << d)) {
      flies(view, x, y + h - 12, 3, t + d * 2.1, 14);
      ctx.strokeStyle = 'rgba(120,200,40,0.55)'; ctx.lineWidth = 2;
      for (let k = -1; k <= 1; k += 2) { ctx.beginPath(); const sx = x + k * dw * 0.25, u = (t * 1.3 + k) % 1; ctx.moveTo(sx, y + h - 2); ctx.quadraticCurveTo(sx + 6, y + h - 10 - u * 6, sx - 2, y + h - 22 - u * 6); ctx.stroke(); }
    }
  }
}

// des mouches qui tournent autour de (x, y)
function flies(view, x, y, n, t, r) {
  const ctx = view.g;
  for (let k = 0; k < n; k++) {
    const a = t * (5 + k) + k * 2.1, fx = x + Math.cos(a) * r * (0.6 + 0.4 * Math.sin(t * 2 + k)), fy = y + Math.sin(a * 1.3) * r * 0.5;
    ctx.fillStyle = '#0b0610'; ctx.fillRect(fx - 1.5, fy - 1.5, 3, 3);
    ctx.fillStyle = Math.sin(t * 60 + k) > 0 ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)'; ctx.fillRect(fx - 3, fy - 3, 2, 2); ctx.fillRect(fx + 1, fy - 3, 2, 2);
  }
}

// la cuvette, de face : propre (blanche, brillante) ou dégoûtante (verte, qui bouillonne)
function toilet(ctx, x, y, s, clean, t) {
  const O = '#0b0610';
  ctx.fillStyle = O; ctx.fillRect(x - s * 0.7, y - s * 2.1, s * 1.4, s * 0.9);
  ctx.fillStyle = clean ? '#ffffff' : '#c8d0a0'; ctx.fillRect(x - s * 0.6, y - s * 2.0, s * 1.2, s * 0.75);
  ctx.fillStyle = O; ctx.beginPath(); ctx.ellipse(x, y - s * 0.75, s * 1.05, s * 0.6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = clean ? '#ffffff' : '#b8c088'; ctx.beginPath(); ctx.ellipse(x, y - s * 0.75, s * 0.95, s * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = clean ? '#9ae0ff' : '#6aa01a'; ctx.beginPath(); ctx.ellipse(x, y - s * 0.75, s * 0.62, s * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  if (!clean) { ctx.fillStyle = '#8ad83a'; for (let k = 0; k < 3; k++) { const u = (t * 1.5 + k / 3) % 1; ctx.beginPath(); ctx.arc(x - s * 0.3 + k * s * 0.3, y - s * 0.75 - u * 4, 1.5 + u * 2, 0, Math.PI * 2); ctx.fill(); } }
  ctx.fillStyle = O; ctx.fillRect(x - s * 0.45, y - s * 0.4, s * 0.9, s * 0.45);
  ctx.fillStyle = clean ? '#ffffff' : '#b8c088'; ctx.fillRect(x - s * 0.38, y - s * 0.38, s * 0.76, s * 0.38);
  if (clean) { ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(x - s * 0.5, y - s * 1.9, s * 0.15, s * 0.5); }
}

// le nom de la touche d'une direction (0 haut, 1 droite, 2 bas, 3 gauche) pour l'appareil du joueur i
function dirKey(view, M, i, d) {
  const dev = view.deviceOf(i === 0 ? M.a : M.v);
  return (dev === 'kb1' ? ['Z', 'D', 'S', 'Q'] : dev === 'kb2' ? ['↑', '→', '↓', '←'] : ['', '', '', ''])[d];
}
