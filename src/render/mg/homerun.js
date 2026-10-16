// Home run (homerun), l'affichage : un stade la nuit, chacun sur son marbre (J1 à gauche, J2 à droite, face au milieu),
// son vrai modèle 3D avec une batte. Les balles tombent du ciel en même temps des deux côtés : l'ombre au sol grandit,
// un anneau à la couleur du joueur se referme sur la zone de frappe, la jauge de timing en bas (le curseur arrive au
// milieu pile au bon moment). Frappée, la balle part dans le ciel, le compteur de mètres défile, et elle retombe sur la
// petite carte du terrain (au-delà de la clôture : HOME RUN, feux d'artifice).
import { COLORS } from '../../sim/constants.js';
import { HR, ballU } from '../../sim/mg/homerun.js';
import { MG_PLAY } from '../../sim/mg/common.js';

const CX = [160, 480], BX = [76, 564], SPX = [176, 464], SPY = 222, GROUND = 262, INK = '#0b0610';
const FLY = 0.7, COUNT = 0.9; // la balle part en FLY s, le compteur défile en COUNT s
const DIR = (i) => (i === 0 ? 1 : -1);

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
  if (!X.ok) { X.ok = 1; X.sw = [-9, -9]; X.landed = [[0, 0, 0], [0, 0, 0]]; X.pop = [0, 0]; X.crowd = 0; }
  return X;
}

function drawBall(ctx, x, y, r, spin) {
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x, y, r + 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fbf6ea'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#e0303a'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(x - r * 0.9, y, r * 0.75, -0.9 + spin, 0.9 + spin); ctx.stroke();
  ctx.beginPath(); ctx.arc(x + r * 0.9, y, r * 0.75, Math.PI - 0.9 + spin, Math.PI + 0.9 + spin); ctx.stroke();
}

// la batte, tenue en (x, y), angle a
function drawBat(ctx, x, y, a, col) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(-3, -4); ctx.lineTo(52, -7.5); ctx.arc(52, 0, 7.5, -Math.PI / 2, Math.PI / 2); ctx.lineTo(-3, 4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#d8a060'; ctx.beginPath(); ctx.moveTo(-1, -2.4); ctx.lineTo(52, -5.8); ctx.arc(52, 0, 5.8, -Math.PI / 2, Math.PI / 2); ctx.lineTo(-1, 2.4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(14, -3.5, 36, 1.5);
  ctx.fillStyle = col; ctx.fillRect(-2, -3, 14, 6); // le grip à la couleur du joueur
  ctx.restore();
}

function stadium(view, X, t) {
  const ctx = view.g, L = -view.ox, R = 640 + view.ox, T = -view.oy, B = 360 + view.oy;
  const sky = ctx.createLinearGradient(0, T, 0, GROUND); sky.addColorStop(0, '#060a24'); sky.addColorStop(1, '#1a2a5a');
  ctx.fillStyle = sky; ctx.fillRect(L, T, R - L, GROUND - T);
  for (let k = 0; k < 30; k++) { ctx.fillStyle = `rgba(255,255,255,${0.3 + 0.3 * Math.sin(t * 2 + k)})`; ctx.fillRect((k * 97) % 640, (k * 53) % 150 + 4, 1.5, 1.5); }
  // les projecteurs
  for (const lx of [250, 390]) {
    const gr = ctx.createRadialGradient(lx, 74, 2, lx, 74, 70); gr.addColorStop(0, 'rgba(255,250,220,0.5)'); gr.addColorStop(1, 'rgba(255,250,220,0)');
    ctx.fillStyle = gr; ctx.fillRect(lx - 70, 4, 140, 140);
    ctx.fillStyle = '#20263a'; ctx.fillRect(lx - 2, 84, 4, 120);
    ctx.fillStyle = INK; ctx.fillRect(lx - 16, 66, 32, 18);
    for (let k = 0; k < 6; k++) { ctx.fillStyle = '#fff8d8'; ctx.fillRect(lx - 14 + (k % 3) * 10, 68 + Math.floor(k / 3) * 8, 7, 6); }
  }
  // les tribunes et la foule
  ctx.fillStyle = '#141a30'; ctx.fillRect(L, 196, R - L, GROUND - 196);
  X.crowd = Math.max(0, X.crowd - 0.012);
  for (let k = 0; k < 48; k++) {
    const x = L + k * ((R - L) / 47), j = Math.abs(Math.sin(t * (4 + (k % 5)) + k)) * (1 + X.crowd * 8), y = 212 + (k % 3) * 14 - j;
    ctx.fillStyle = ['#2a3050', '#323a60', '#262c48'][k % 3]; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(x - 6, y + 4, 12, 14);
  }
  ctx.fillStyle = '#2a7a3a'; ctx.fillRect(L, GROUND, R - L, B - GROUND);
  for (let x = Math.floor(L / 48) * 48; x < R; x += 48) { ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(x, GROUND, 24, B - GROUND); }
  ctx.fillStyle = '#b07a44'; for (const x of BX) { ctx.beginPath(); ctx.ellipse(x + (x < 320 ? 50 : -50), GROUND + 6, 90, 12, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(319, 70, 2, 190);
}

export default {
  title: 'HOME RUN', color: '#7aff7a', icon: '⚾',
  goal: 'Frappe quand la balle arrive dans le cercle : le plus loin possible !',
  keys: [['A', 'frapper (pile dans le cercle)']],
  ach: [['Babe Ruth du dimanche', 'Batte en or', 'Orbite basse'], ['Trois prises, dehors', 'Brasseur d\'air', 'Moulin à vent']],
  news: (L, d) => `${L} FRAPPE DANS LE VIDE TROIS FOIS : LE STADE SIFFLE (+${d} %)`,

  draw(view, W, M, dt) {
    const ctx = view.g, g = M.g, X = S(view), t = view.time, tf = M.ph === 'outro' ? MG_PLAY + M.t : M.t; // (le temps du jeu, qui continue sous EZ WIN)
    stadium(view, X, t);
    view.text('⚾ HOME RUN', 320, 18, 18, '#7aff7a', { title: true });
    view.timer(M, 320, 46);
    // la balle en jeu (la dernière lâchée)
    let k = -1;
    for (let j = 0; j < HR.N; j++) if (tf >= g.balls[j].t0) k = j;
    for (let i = 0; i < 2; i++) {
      const P = g.p[i], slot = i === 0 ? M.a : M.v, col = COLORS[slot], d = DIR(i), sx = SPX[i];
      X.pop[i] = Math.max(0, X.pop[i] - dt * 3);
      // le batteur et sa batte (armée, puis le swing et l'accompagnement)
      const sa = t - X.sw[i], hx = BX[i] + d * 16, hy = GROUND - 52;
      let a;
      if (sa < 0.1) a = -2.3 + (sa / 0.1) * 2.6; else if (sa < 0.5) a = 0.3 + Math.min(1, (sa - 0.1) / 0.15) * 1.6; else a = -2.3 + Math.sin(t * 2.5 + i) * 0.08;
      const o = { face: i === 0 ? 'three' : 'threeL', head: 1.8, state: 'idle' };
      if (!view.player(W, M, i, BX[i], GROUND + 6, 116, o)) view.portraitAt(W.fighters[slot].char, BX[i], GROUND - 60, 46, col, i === 1);
      ctx.save(); if (i === 1) { ctx.translate(hx, 0); ctx.scale(-1, 1); ctx.translate(-hx, 0); }
      drawBat(ctx, hx, hy, a, col);
      ctx.restore();
      view.who(W, M, i, BX[i] + d * 20, 64, { align: 'center', size: 0.85 });
      // les balles
      for (let j = 0; j <= k; j++) {
        const b = g.balls[j], m = P.m[j], u = ballU(b, tf);
        if (m > 0) {
          // frappée : elle part dans le ciel (vers le milieu de l'écran, dans sa moitié)
          const f = (tf - (b.t1 + P.sw[j])) / 60;
          if (f < FLY) {
            const q = f / FLY, bx = sx + d * q * 120, by = SPY - q * (260 + m) + q * q * 40;
            for (let n = 1; n < 6; n++) { const qq = Math.max(0, q - n * 0.03); ctx.fillStyle = `rgba(255,255,255,${0.35 - n * 0.05})`; ctx.beginPath(); ctx.arc(sx + d * qq * 120, SPY - qq * (260 + m) + qq * qq * 40, 6 - n * 0.6, 0, Math.PI * 2); ctx.fill(); }
            drawBall(ctx, bx, by, 6 - q * 2, t * 20);
          }
          continue;
        }
        if (u > 2 || (m === 0 && P.sw[j] === 99 && u > 1.7)) continue;
        // elle tombe (et continue si on la rate : elle rebondit derrière)
        let by = -20 + (SPY + 20) * u * u, bx = sx;
        if (u > 1) { const v = u - 1; by = Math.min(GROUND - 6, SPY + v * 150) - (v > 0.27 ? Math.abs(Math.sin((v - 0.27) * 9)) * 26 * Math.max(0, 1 - v) : 0); bx = sx - d * v * 160; }
        if (j === k && u <= 1) {
          // l'ombre au sol et l'anneau qui se referme
          ctx.fillStyle = `rgba(0,0,0,${0.15 + 0.35 * u})`; ctx.beginPath(); ctx.ellipse(sx, GROUND + 2, 4 + 14 * u, 2 + 4 * u, 0, 0, Math.PI * 2); ctx.fill();
          if (m < 0) {
            const rr = 10 + 34 * (1 - u), hot = u > 0.8;
            ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(sx, SPY, rr, 0, Math.PI * 2); ctx.stroke();
            ctx.strokeStyle = hot ? '#ffe24a' : col; ctx.lineWidth = 3; ctx.stroke();
            ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(sx, SPY, 10, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
          }
        }
        if (by > -12) drawBall(ctx, bx, by, 6, t * 4);
        else view.text('!', sx, 76 + Math.sin(t * 20) * 2, 16, '#ffe24a', { mono: true });
      }
      // comment jouer : la grosse touche à côté de la zone de frappe, « ATTENDS… » puis « MAINTENANT ! » (jaune, qui grossit)
      {
        const b = k >= 0 ? g.balls[k] : null, dd = b ? tf - b.t1 : -99, live = b && P.m[k] < 0, bot = W.fighters[slot].bot;
        const now = live && dd >= -8 && dd <= 6, more = !b || k < HR.N - 1 || live;
        const word = now ? 'MAINTENANT !' : live && dd > 6 ? 'TROP TARD…' : more ? 'ATTENDS…' : null;
        const sc = now ? 1.3 + Math.max(0, Math.sin(t * 30)) * 0.12 : M.t < 180 ? 1.25 : 1;
        if (word || bot) keyCap(view, M, i, sx + d * 84, SPY - 14, sc, 1 - (t - X.sw[i]) / 0.12, now && Math.sin(t * 30) > -0.5, bot ? null : word, col);
        view.hint(W, M, i, sx + d * 84, SPY + 42, [['A', 'frapper']]);
      }
      // la jauge de timing : le curseur arrive au milieu pile au bon moment
      const gx = CX[i], gy = 284, pf = 3, half = HR.EARLY * pf;
      ctx.fillStyle = INK; ctx.fillRect(gx - half - 3, gy - 7, half * 2 + 6, 14);
      ctx.fillStyle = '#5a1a20'; ctx.fillRect(gx - half, gy - 5, half * 2, 10);
      ctx.fillStyle = '#c8a020'; ctx.fillRect(gx - HR.WIN * pf, gy - 5, HR.WIN * pf * 2, 10);
      ctx.fillStyle = '#3bdc5a'; ctx.fillRect(gx - 6 * pf, gy - 5, 12 * pf, 10);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(gx - (HR.PERF + 0.5) * pf, gy - 5, (HR.PERF * 2 + 1) * pf, 10);
      ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.strokeRect(gx - half - 1.5, gy - 6.5, half * 2 + 3, 13);
      if (k >= 0) {
        const b = g.balls[k], m = P.m[k], dd = m >= 0 ? (P.sw[k] === 99 ? HR.WIN + 1 : P.sw[k]) : tf - b.t1;
        if (dd >= -HR.EARLY - 30 && dd <= HR.EARLY) {
          const cx = gx + Math.max(-HR.EARLY, Math.min(HR.EARLY, dd)) * pf;
          ctx.fillStyle = INK; ctx.fillRect(cx - 3.5, gy - 12, 7, 24); ctx.fillStyle = m >= 0 ? col : '#ffffff'; ctx.fillRect(cx - 2, gy - 10, 4, 20);
        }
      }
      // le total (ce qui a déjà atterri) et les trois balles (la distance de chacune), à côté
      let tot = 0;
      for (let j = 0; j < HR.N; j++) {
        const m = P.m[j], qx = i === 0 ? gx - 62 - (HR.N - 1 - j) * 26 : gx + 62 + j * 26, qy = gy + 22;
        const f = m > 0 ? (tf - (g.balls[j].t1 + P.sw[j])) / 60 : 0, shown = m > 0 ? Math.round(m * Math.min(1, Math.max(0, f - 0.15) / COUNT)) : m;
        if (m > 0) tot += shown;
        ctx.fillStyle = 'rgba(11,6,16,0.6)'; ctx.fillRect(qx - 12, qy - 8, 24, 16);
        view.text(m < 0 ? '⚾' : m === 0 ? '✖' : shown === 0 ? '…' : `${shown}`, qx, qy, m < 0 ? 10 : 11, m < 0 ? 'rgba(255,255,255,0.45)' : m === 0 ? '#ff5a5a' : m >= HR.FENCE ? '#ffe24a' : '#ffffff', { mono: true, stroke: m >= 0 });
        if (m > 0 && f > COUNT + 0.15 && !X.landed[i][j]) {
          X.landed[i][j] = 1; X.pop[i] = 1;
          const big = m >= HR.FENCE;
          view.sticker(big ? 'HOME RUN !!!' : `${m} m`, CX[i], 136, { size: big ? 26 : 20, color: big ? INK : '#ffffff', bg: big ? '#ffe24a' : col, life: 1 });
          if (big) { view.burst(CX[i], 110, 40, ['#ffe24a', '#ff3b3b', '#3b8bff', '#ffffff', col], { shape: 'star', speed: 260, size: 6, life: 1, up: 40 }); view.hype(0.6); X.crowd = 1; }
          const A = view.audio; if (A) { A.sfx(big ? 'boom' : 'thud', i === 0 ? -0.5 : 0.5, big ? 0.6 : 0.5); if (big) A.sfx('airhorn', 0, 0.5); }
        }
      }
      view.text(`${tot} m`, gx + d * 40, gy + 23, 18 + X.pop[i] * 10, col, { mono: true });
      // le compteur de mètres pendant que la balle vole
      for (let j = 0; j <= k; j++) {
        const m = P.m[j]; if (m <= 0) continue;
        const f = (tf - (g.balls[j].t1 + P.sw[j])) / 60;
        if (f > 0.15 && f < COUNT + 0.5) view.text(`${Math.round(m * Math.min(1, (f - 0.15) / COUNT))} m`, CX[i] + d * 30, 108, 30, '#ffffff', { mono: true, alpha: f > COUNT + 0.2 ? Math.max(0, 1 - (f - COUNT - 0.2) / 0.3) : 1 });
      }
    }
  },

  onEvent(view, ev, W, M) {
    if (!M || !ev.type.startsWith('mgHr')) return;
    const A = view.audio, X = S(view);
    if (ev.type === 'mgHrDrop') {
      view.sticker(`BALLE ${ev.k + 1} / ${HR.N}`, 320, 90, { size: 16, color: INK, bg: '#7aff7a', life: 0.7, rot: 0 });
      if (A) { A.sfx('blip', 0, 0.5, 3); A.sfx('whoosh', 0, 0.3); }
      return;
    }
    const i = ev.p, slot = i === 0 ? M.a : M.v, col = COLORS[slot], pan = i === 0 ? -0.5 : 0.5, sx = SPX[i];
    if (ev.type === 'mgHrSwing') {
      X.sw[i] = view.time;
      if (A) A.sfx('whoosh', pan, 0.6);
      if (ev.m > 0) {
        const perf = ev.hr, good = Math.abs(ev.d) <= 6;
        X.pop[i] = 1; X.crowd = Math.max(X.crowd, perf ? 1 : 0.5);
        view.burst(sx, SPY, perf ? 30 : 16, ['#ffffff', '#ffe24a', col], { shape: 'star', speed: perf ? 320 : 200, size: 5, life: 0.6 });
        view.sticker(perf ? 'PILE !! 🔥' : good ? view.pick(['BIEN FRAPPÉ !', 'PROPRE 👌', 'BOUM !']) : ev.d < 0 ? 'UN PEU TÔT' : 'UN PEU TARD', sx + DIR(i) * 40, SPY - 40, { size: perf ? 20 : 14, color: perf ? INK : '#ffffff', bg: perf ? '#ffe24a' : good ? col : '#7a5a9a', life: 0.8 });
        view.jolt(perf ? 0.7 : 0.35, perf ? 0.08 : 0.04, perf ? '#ffffff' : null, 0.25);
        if (perf) view.lines(0.5);
        view.react(i, { emote: perf || good ? 'cheer' : undefined, pop: 0.3, life: perf || good ? 1.4 : 0.3 });
        if (A) { A.sfx('woodL', pan, 0.9); A.sfx(perf ? 'punchHeavy' : 'hitM', pan, 0.6); if (perf) { A.crowd(); A.say(view.pick(['Quelle frappe !', 'Partie !', 'Au revoir la balle !']), 0.55, 1.15); } }
      } else {
        view.sticker(view.pick(['DANS LE VENT 💨', 'BRASSEUR D\'AIR', 'RATÉ !']), sx, SPY - 40, { size: 15, color: '#ffffff', bg: '#a00010', life: 0.8 });
        view.react(i, { state: 'dizzy', life: 1 });
        if (A) { A.sfx('whip', pan, 0.6); A.sfx('error', pan, 0.4); }
      }
    } else if (ev.type === 'mgHrMiss') {
      view.sticker(view.pick(['PRISE ! ⚾', 'IL A DORMI 😴', 'STRIKE !']), sx, SPY - 40, { size: 16, color: '#ffffff', bg: '#a00010', life: 0.8 });
      view.react(i, { state: 'dizzy', life: 1 });
      if (A) { A.sfx('thud', pan, 0.5); A.sfx('error', pan, 0.4); }
    }
  },
};
