// Évasion de la télé (tvbreak), l'affichage : un salon la nuit, deux vieilles télés cathodiques (J1 à gauche, J2 à
// droite), chaque joueur enfermé dans la sienne (son vrai modèle 3D, derrière la vitre teintée à sa couleur). Chaque coup :
// un gant de boxe à sa couleur cogne la vitre de l'intérieur, une fêlure de plus, des éclats, la télé tremble. La jauge
// de la vitre sous chaque télé ; à la sortie, la vitre explose et il saute dehors pour danser devant.
import { COLORS } from '../../sim/constants.js';
import { TVB, stageOf } from '../../sim/mg/tvbreak.js';

const CX = [160, 480], CY = 170, BW = 236, BH = 178, SW = 196, SH = 130; // la télé : centre, boîtier, écran
const SX = (i) => CX[i] - SW / 2, SY = CY - BH / 2 + 10;
const INK = '#0b0610';
const STAGE_TXT = [null, ['CRAC !', 'ÇA FÊLE !', 'TOC TOC'], ['ÇA CÈDE !', 'KRAK !', 'ENCORE !'], ['PRESQUE !', 'ÇA VA PÉTER', 'DERNIER EFFORT']];

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
  if (!X.ok) {
    X.ok = 1; X.cr = [[], []]; X.sh = [0, 0]; X.fist = [null, null]; X.ts = [[], []]; X.out = [0, 0]; X.pop = [0, 0]; X.spot = [[0, 0], [0, 0]];
    X.dust = Array.from({ length: 18 }, () => ({ x: Math.random() * 640, y: Math.random() * 360, s: 0.5 + Math.random() }));
  }
  return X;
}

// une fêlure de plus sur la vitre du joueur i, partant de (x, y) (en coordonnées de l'écran) : quelques branches en zigzag
function addCrack(X, i, x, y, st) {
  const br = 2 + Math.floor(Math.random() * 2), list = X.cr[i];
  for (let b = 0; b < br; b++) {
    let a = Math.random() * Math.PI * 2, px = x, py = y;
    const pts = [[px, py]], n = 2 + Math.floor(Math.random() * 2), seg = 5 + st * 3 + Math.random() * 5;
    for (let k = 0; k < n; k++) { a += (Math.random() - 0.5) * 1.1; px += Math.cos(a) * seg; py += Math.sin(a) * seg; pts.push([Math.max(-4, Math.min(SW + 4, px)), Math.max(-4, Math.min(SH + 4, py))]); }
    list.push({ pts, w: 0.7 + st * 0.3 });
  }
  if (st >= 1 && Math.random() < 0.5) list.push({ ring: 1, x, y, r: 5 + st * 3 }); // l'impact en étoile
  while (list.length > 60) list.shift();
}

// la vitre : reflets, fêlures (sombres puis claires), voile qui blanchit avec les fêlures
function drawGlass(ctx, X, i, h, t) {
  const sx = SX(i), sy = SY, st = stageOf(h);
  ctx.save(); ctx.translate(sx, sy);
  // le reflet en biais
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(60, 0); ctx.lineTo(20, SH); ctx.lineTo(-28, SH); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.beginPath(); ctx.moveTo(80, 0); ctx.lineTo(96, 0); ctx.lineTo(56, SH); ctx.lineTo(40, SH); ctx.closePath(); ctx.fill();
  ctx.fillStyle = `rgba(220,240,255,${0.03 + st * 0.045})`; ctx.fillRect(0, 0, SW, SH);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (const c of X.cr[i]) {
    if (c.ring) { ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); ctx.stroke(); continue; }
    ctx.beginPath(); ctx.moveTo(c.pts[0][0], c.pts[0][1]); for (let k = 1; k < c.pts.length; k++) ctx.lineTo(c.pts[k][0], c.pts[k][1]);
    ctx.strokeStyle = 'rgba(11,6,16,0.55)'; ctx.lineWidth = c.w + 1.6; ctx.stroke();
    ctx.strokeStyle = 'rgba(235,248,255,0.95)'; ctx.lineWidth = c.w; ctx.stroke();
  }
  ctx.restore();
}

// le gant de boxe (à la couleur du joueur) qui cogne la vitre de l'intérieur
function drawGlove(ctx, x, y, s, col, flip) {
  ctx.save(); ctx.translate(x, y); ctx.scale(flip ? -s : s, s);
  ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(0, 0, 15, 13, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, 0, 13, 11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.ellipse(-4, -4, 5, 3, -0.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(9, 4, 6, 5, 0.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(9, 4, 4.5, 3.6, 0.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f4ead6'; ctx.fillRect(-12, 9, 18, 5); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.strokeRect(-12, 9, 18, 5);
  ctx.restore();
}

// le boîtier en bois, les boutons, les antennes ; dx, dy : la secousse
function drawCabinet(view, i, col, t, out, dx, dy) {
  const ctx = view.g, x0 = CX[i] - BW / 2 + dx, y0 = CY - BH / 2 + dy;
  // les pieds, les antennes
  ctx.strokeStyle = INK; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(x0 + 34, y0 + BH); ctx.lineTo(x0 + 24, y0 + BH + 18); ctx.moveTo(x0 + BW - 34, y0 + BH); ctx.lineTo(x0 + BW - 24, y0 + BH + 18); ctx.stroke();
  ctx.lineWidth = 3; ctx.strokeStyle = '#a8a8b8';
  const wob = Math.sin(t * 3 + i) * 0.08;
  ctx.beginPath(); ctx.moveTo(x0 + BW / 2, y0); ctx.lineTo(x0 + BW / 2 - 40 + wob * 60, y0 - 42); ctx.moveTo(x0 + BW / 2, y0); ctx.lineTo(x0 + BW / 2 + 40 - wob * 60, y0 - 40); ctx.stroke();
  ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(x0 + BW / 2, y0 - 2, 14, 7, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#ff4a4a'; ctx.beginPath(); ctx.arc(x0 + BW / 2 - 40 + wob * 60, y0 - 42, 3, 0, Math.PI * 2); ctx.arc(x0 + BW / 2 + 40 - wob * 60, y0 - 40, 3, 0, Math.PI * 2); ctx.fill();
  // le bois
  ctx.fillStyle = INK; ctx.beginPath(); ctx.roundRect(x0 - 4, y0 - 4, BW + 8, BH + 8, 18); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(x0 - 2, y0 - 2, BW + 4, BH + 4, 17); ctx.fill(); // le liseré du joueur
  const wd = ctx.createLinearGradient(0, y0, 0, y0 + BH); wd.addColorStop(0, '#9a5a2a'); wd.addColorStop(1, '#5a3014');
  ctx.fillStyle = wd; ctx.beginPath(); ctx.roundRect(x0 + 2, y0 + 2, BW - 4, BH - 4, 15); ctx.fill();
  ctx.strokeStyle = 'rgba(40,16,4,0.35)'; ctx.lineWidth = 1;
  for (let k = 0; k < 7; k++) { ctx.beginPath(); ctx.moveTo(x0 + 8, y0 + 12 + k * 24); ctx.bezierCurveTo(x0 + 70, y0 + 6 + k * 24, x0 + 150, y0 + 22 + k * 24, x0 + BW - 8, y0 + 12 + k * 24); ctx.stroke(); }
  // le bandeau du bas : grille du haut-parleur, deux boutons, le voyant
  const by = y0 + BH - 26;
  ctx.fillStyle = '#2a1a10'; ctx.fillRect(x0 + 16, by, BW - 32, 18);
  for (let k = 0; k < 14; k++) { ctx.fillStyle = '#140a06'; ctx.fillRect(x0 + 22 + k * 7, by + 3, 4, 12); }
  for (let k = 0; k < 2; k++) {
    const kx = x0 + BW - 60 + k * 22, ky = by + 9;
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(kx, ky, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c8c0b0'; ctx.beginPath(); ctx.arc(kx, ky, 6, 0, Math.PI * 2); ctx.fill();
    const a = t * (k ? -2 : 1.5) + i; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(kx + Math.cos(a) * 5, ky + Math.sin(a) * 5); ctx.stroke();
  }
  ctx.fillStyle = out ? '#3bdc5a' : (Math.sin(t * 8) > 0 ? '#ff3b3b' : '#601010'); ctx.beginPath(); ctx.arc(x0 + BW - 20, by + 9, 3, 0, Math.PI * 2); ctx.fill();
  // l'encadrement de l'écran
  ctx.fillStyle = INK; ctx.beginPath(); ctx.roundRect(SX(i) - 7 + dx, SY - 7 + dy, SW + 14, SH + 14, 16); ctx.fill();
  ctx.fillStyle = '#3a3438'; ctx.beginPath(); ctx.roundRect(SX(i) - 5 + dx, SY - 5 + dy, SW + 10, SH + 10, 14); ctx.fill();
}

export default {
  title: 'ÉVASION DE LA TÉLÉ', color: '#5ad8ff', icon: '📺',
  goal: 'Martèle ta touche pour casser la vitre et sortir de ta télé le premier !',
  keys: [['A', 'martèle = cogne la vitre']],
  ach: [['Évadé de la TNT', 'Poing de verre', 'Prison Break (version Thomson)'], ['Abonné à vie', 'Prisonnier du 4/3', 'Rediffusion éternelle']],
  news: (L, d) => `${L} TOUJOURS COINCÉ DANS SA TÉLÉ : LE SAV PARLE DE +${d} %`,

  draw(view, W, M, dt) {
    const ctx = view.g, g = M.g, X = S(view), t = view.time, L = -view.ox, R = 640 + view.ox, T = -view.oy, B = 360 + view.oy;
    // le salon : papier peint à rayures, plancher, la lampe
    ctx.fillStyle = '#1e1430'; ctx.fillRect(L, T, R - L, B - T);
    for (let x = Math.floor(L / 28) * 28; x < R; x += 28) { ctx.fillStyle = 'rgba(255,220,180,0.035)'; ctx.fillRect(x, T, 12, 268 - T); }
    ctx.fillStyle = '#3a2214'; ctx.fillRect(L, 268, R - L, B - 268);
    for (let x = Math.floor(L / 54) * 54; x < R; x += 54) { ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(x, 268, 2, B - 268); }
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(L, 268, R - L, 4);
    for (const d of X.dust) { d.y -= d.s * 6 * dt; if (d.y < T) d.y = B; ctx.fillStyle = 'rgba(255,240,200,0.12)'; ctx.fillRect(d.x, d.y, 2, 2); }
    view.text('📺 ÉVASION DE LA TÉLÉ', 320, 18, 18, '#5ad8ff', { title: true });
    view.timer(M, 320, 46);
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(319, 70, 2, 260); // la frontière entre les deux
    for (let i = 0; i < 2; i++) {
      const P = g.p[i], slot = i === 0 ? M.a : M.v, col = COLORS[slot], st = stageOf(P.h), out = !!P.out;
      X.sh[i] = Math.max(0, X.sh[i] - dt * 6); X.pop[i] = Math.max(0, X.pop[i] - dt * 4);
      const sh = X.sh[i] * X.sh[i] * 5, dx = (Math.random() - 0.5) * sh, dy = (Math.random() - 0.5) * sh * 0.6;
      // l'ombre de la télé sur le plancher
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(CX[i], 286, 120, 10, 0, 0, Math.PI * 2); ctx.fill();
      drawCabinet(view, i, col, t, out, dx, dy);
      // l'écran : la lueur du joueur, lui derrière la vitre
      const sx = SX(i) + dx, sy = SY + dy;
      ctx.save(); ctx.beginPath(); ctx.roundRect(sx, sy, SW, SH, 12); ctx.clip();
      const gl = ctx.createRadialGradient(sx + SW / 2, sy + SH / 2, 10, sx + SW / 2, sy + SH / 2, SW * 0.7);
      gl.addColorStop(0, out ? '#141018' : '#2a4a6a'); gl.addColorStop(1, out ? '#060408' : '#0c1424');
      ctx.fillStyle = gl; ctx.fillRect(sx, sy, SW, SH);
      ctx.fillStyle = col; ctx.globalAlpha = out ? 0.05 : 0.16; ctx.fillRect(sx, sy, SW, SH); ctx.globalAlpha = 1;
      for (let y = 0; y < SH; y += 3) { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(sx, sy + y, SW, 1); }
      if (!out) {
        const opp = g.p[1 - i].out;
        const o = { face: 'front', head: 1.75 };
        if (opp) o.emote = 'complain_01';
        else if (st >= 3) o.state = 'shield';
        const px = sx + SW / 2 + (Math.random() - 0.5) * X.pop[i] * 4;
        if (!view.player(W, M, i, px, sy + SH + 40, 166, o)) view.portraitAt(W.fighters[slot].char, sx + SW / 2, sy + SH / 2, 70, col, i === 1);
        // le gant qui cogne
        const f = X.fist[i];
        if (f && t - f.t < 0.12) { const u = (t - f.t) / 0.12; drawGlove(ctx, sx + f.x, sy + f.y, 1.25 - u * 0.35, col, f.x > SW / 2); }
        drawGlass(ctx, X, i, P.h, t);
      } else {
        // le trou : quelques dents de verre sur les bords
        ctx.fillStyle = 'rgba(200,230,255,0.55)'; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1;
        const teeth = [[0, 0, 40, 0, 0, 30], [SW, 0, SW - 50, 0, SW, 24], [0, SH, 30, SH, 0, SH - 40], [SW, SH, SW - 36, SH, SW, SH - 28], [SW / 2 - 20, 0, SW / 2 + 14, 0, SW / 2 - 4, 16], [SW / 2, SH, SW / 2 + 26, SH, SW / 2 + 10, SH - 14]];
        for (const q of teeth) { ctx.beginPath(); ctx.moveTo(sx + q[0], sy + q[1]); ctx.lineTo(sx + q[2], sy + q[3]); ctx.lineTo(sx + q[4], sy + q[5]); ctx.closePath(); ctx.fill(); ctx.stroke(); }
        view.text('NO SIGNAL', sx + SW / 2, sy + SH / 2, 14, 'rgba(255,255,255,0.35)', { mono: true, stroke: false });
      }
      ctx.restore();
      // comment jouer, sur la vitre : la grosse touche qui s'enfonce à chaque coup, « MARTÈLE J ! »
      if (!out) {
        const last = X.ts[i].length ? X.ts[i][X.ts[i].length - 1] : -9, pr = 1 - (t - last) / 0.1, early = M.t < 180;
        const bot = W.fighters[slot].bot, s = (early ? 1.35 : 1) + (early ? Math.max(0, Math.sin(t * 9)) * 0.12 : 0);
        keyCap(view, M, i, sx + SW / 2, sy + SH - 34, s, pr, pr > 0, bot ? null : `MARTÈLE ${view.keyName(M, i, 'A')} !`, col);
        view.hint(W, M, i, sx + SW / 2, sy - 16, [['A', 'cogner la vitre']]);
      }
      // la jauge de la vitre et le compteur de coups par seconde
      const bx = CX[i] - 90, by = 276, fr = Math.min(1, P.h / TVB.HITS);
      X.ts[i] = X.ts[i].filter((s) => t - s < 1);
      if (!out) {
        ctx.fillStyle = INK; ctx.fillRect(bx - 3, by - 3, 186, 16);
        ctx.fillStyle = '#2a2034'; ctx.fillRect(bx, by, 180, 10);
        ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.strokeRect(bx - 1.5, by - 1.5, 183, 13);
        ctx.fillStyle = col; ctx.fillRect(bx, by, 180 * fr, 10);
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(bx, by, 180 * fr, 3);
        for (const s of TVB.STAGES) { ctx.fillStyle = INK; ctx.fillRect(bx + 180 * s / TVB.HITS - 1, by, 2, 10); }
        const rate = X.ts[i].length;
        view.text(`VITRE ${Math.round(fr * 100)} %${rate > 1 ? `  ⚡${rate}/s` : ''}`, CX[i], by + 19, 12 + X.pop[i] * 3, rate >= 8 ? '#ffe24a' : '#ffffff', { mono: true });
      } else view.text(`${g.first === i ? '🏆 1ER DEHORS' : '🐌 2E DEHORS'} : ${(P.out / 60).toFixed(1).replace('.', ',')} s`, CX[i], by + 19, 13, g.first === i ? '#3bdc5a' : '#c8b8d8', { mono: true });
      view.who(W, M, i, CX[i], 300, { align: 'center', size: 0.85 });
      // dehors : il danse devant sa télé
      if (out) {
        const e = t - X.out[i], jump = e < 0.45 ? Math.sin(e / 0.45 * Math.PI) * 60 : 0;
        if (!view.player(W, M, i, CX[i] + (i === 0 ? -6 : 6), 272 - jump, 112, { emote: g.first === i ? 'win' : 'select', face: 'front', head: 1.9 })) view.portraitAt(W.fighters[slot].char, CX[i], 230 - jump, 50, col, i === 1);
      }
    }
  },

  onEvent(view, ev, W, M) {
    if (!M || !ev.type.startsWith('mgTvb')) return;
    const A = view.audio, X = S(view), slot = ev.p === 0 ? M.a : M.v, col = COLORS[slot], pan = ev.p === 0 ? -0.5 : 0.5;
    if (ev.type === 'mgTvbHit') {
      const i = ev.p, st = ev.st;
      // le point d'impact : il se promène un peu autour d'un coin de la vitre
      const sp = X.spot[i];
      sp[0] = Math.max(-60, Math.min(60, sp[0] + (Math.random() - 0.5) * 40)); sp[1] = Math.max(-34, Math.min(34, sp[1] + (Math.random() - 0.5) * 30));
      const x = SW / 2 + sp[0], y = SH / 2 + sp[1];
      X.fist[i] = { x, y, t: view.time }; X.sh[i] = Math.min(1, X.sh[i] + 0.45); X.pop[i] = 1; X.ts[i].push(view.time);
      addCrack(X, i, x, y, st);
      view.react(i, { pop: 0.3, life: 0.14, weak: true });
      view.burst(SX(i) + x, SY + y, 3 + st, ['#e8f6ff', '#ffffff', '#9ad8ff'], { shape: 'sq', speed: 120 + st * 30, size: 3, up: 40, life: 0.4 });
      if (A) { A.sfx('hitS', pan, 0.35, 1 + st); if (ev.h % 3 === 0) A.sfx('glass', pan, 0.12 + st * 0.05, 2 + st); }
      if (ev.up && st < 4) {
        view.sticker(view.pick(STAGE_TXT[st]), CX[i], SY + 20, { size: 15 + st * 2, color: INK, bg: col, life: 0.6 });
        view.burst(SX(i) + x, SY + y, 14, ['#e8f6ff', '#ffffff', '#9ad8ff'], { shape: 'sq', speed: 200, size: 4, life: 0.6 });
        view.jolt(0.2 + st * 0.08, 0.02);
        if (A) { A.sfx('glass', pan, 0.4, st); A.sfx('hitM', pan, 0.5); }
      }
    } else if (ev.type === 'mgTvbOut') {
      const i = ev.p, cx = CX[i], cy = SY + SH / 2;
      X.out[i] = view.time; X.cr[i] = []; X.sh[i] = 1; X.pop[i] = 1;
      view.burst(cx, cy, 60, ['#e8f6ff', '#ffffff', '#9ad8ff', '#c8e8ff'], { shape: 'sq', speed: 380, size: 6, up: 80, life: 1 });
      view.burst(cx, cy, 16, [col, '#ffe24a'], { shape: 'star', speed: 260, size: 6, life: 0.8 });
      view.jolt(ev.first ? 0.9 : 0.5, ev.first ? 0.1 : 0.05, '#ffffff', ev.first ? 0.35 : 0.15);
      if (ev.first) {
        view.sticker(view.pick(['LIBRE ! 🏃', 'ÉVADÉ !', 'PRISON BREAK 🔨']), cx, cy - 10, { size: 26, color: '#ffffff', bg: col, life: 1.1 });
        view.sticker(`${(ev.t / 60).toFixed(1).replace('.', ',')} s`, cx, cy + 26, { size: 16, color: '#ffe24a', life: 1 });
        view.lines(0.6); view.hype(0.8); view.confetti(40);
        if (A) { A.sfx('glass', pan, 1); A.sfx('boom', pan, 0.6); A.sfx('airhorn', 0, 0.6); A.crowd(); A.say(view.pick(['Il est sorti !', 'Libéré !', 'Évasion réussie !']), 0.55, 1.15); }
      } else {
        view.sticker(view.pick(['ENFIN… 🐌', 'TROP TARD', 'MÉDAILLE EN CHOCOLAT 🍫']), cx, cy - 10, { size: 20, color: '#ffffff', bg: '#7a5a9a', life: 1 });
        if (A) { A.sfx('glass', pan, 0.8); A.sfx('wobble', pan, 0.5); }
      }
    }
  },
};
