// Le verre parfait (tap), l'affichage : un comptoir de bar, chacun son robinet (la poignée à sa couleur) et son verre
// (J1 à gauche, J2 à droite), son vrai modèle 3D à côté qui suit l'affaire. Le trait doré sur le verre, l'eau qui monte
// de plus en plus vite ; A ferme le robinet : l'écart au trait en mm, les points ; trop tard, ça déborde (cascade, flaque).
import { COLORS } from '../../sim/constants.js';
import { TAP } from '../../sim/mg/tap.js';

const CX = [196, 444], GB = 292, GH = 156, GW0 = 40, GW1 = 50, SPOUT = 100, INK = '#0b0610';
const PX = [46, 594]; // les joueurs, sur les bords
const glassW = (y) => GW0 + (GW1 - GW0) * (GB - y) / GH; // la demi-largeur du verre à la hauteur y (il s'évase)
const MM = 160; // la hauteur du verre en mm (pour dire l'écart)

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
  if (!X.ok) { X.ok = 1; X.swap = -9; X.cut = [-9, -9]; X.spill = [-9, -9]; X.glug = [0, 0]; X.pop = [0, 0]; X.res = [null, null]; X.bub = [[], []]; }
  return X;
}

function drawFaucet(ctx, i, col, t, open, cutT) {
  const x = CX[i], d = i === 0 ? 1 : -1, wx = 320 - d * 4;
  // le tuyau qui sort du mur du milieu, le coude, le bec
  ctx.fillStyle = INK; ctx.fillRect(Math.min(x, wx) - 2, 62, Math.abs(wx - x) + 4, 18); ctx.fillRect(x - 11, 62, 22, SPOUT - 62 + 4);
  ctx.fillStyle = '#c8ccd8'; ctx.fillRect(Math.min(x, wx), 64, Math.abs(wx - x), 14); ctx.fillRect(x - 9, 64, 18, SPOUT - 64);
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(Math.min(x, wx), 66, Math.abs(wx - x), 3); ctx.fillRect(x - 6, 66, 3, SPOUT - 66);
  ctx.fillStyle = '#8a8ea0'; ctx.fillRect(x - 12, SPOUT - 6, 24, 8); ctx.fillStyle = INK; ctx.fillRect(x - 12, SPOUT + 1, 24, 2);
  // la poignée (à la couleur du joueur) : ouverte de travers, fermée droite
  const a = open ? 0.9 * d : Math.max(0, 1 - (t - cutT) / 0.12) * 0.9 * d;
  ctx.save(); ctx.translate(x + d * 28, 62); ctx.rotate(a);
  ctx.fillStyle = INK; ctx.fillRect(-3, -22, 6, 22); ctx.fillStyle = '#8a8ea0'; ctx.fillRect(-1.5, -20, 3, 20);
  ctx.fillStyle = INK; ctx.beginPath(); ctx.roundRect(-20, -32, 40, 14, 6); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(-18, -30, 36, 10, 5); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(-14, -29, 28, 3);
  ctx.restore();
}

// le verre et l'eau : w le niveau (0..1), L le trait
function drawGlass(view, i, col, w, L, t, X, slide) {
  const ctx = view.g, x = CX[i] + slide, top = GB - GH, wy = GB - w * GH;
  // l'eau
  if (w > 0.002) {
    ctx.save(); ctx.beginPath(); ctx.moveTo(x - glassW(GB), GB); ctx.lineTo(x - glassW(top), top); ctx.lineTo(x + glassW(top), top); ctx.lineTo(x + glassW(GB), GB); ctx.closePath(); ctx.clip();
    const gr = ctx.createLinearGradient(0, wy, 0, GB); gr.addColorStop(0, 'rgba(120,210,255,0.85)'); gr.addColorStop(1, 'rgba(40,120,220,0.9)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x - 60, GB);
    for (let k = -60; k <= 60; k += 6) ctx.lineTo(x + k, wy + Math.sin(k * 0.2 + t * 10) * 1.6);
    ctx.lineTo(x + 60, GB); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(230,250,255,0.8)'; ctx.fillRect(x - 60, wy - 1, 120, 2);
    for (const b of X.bub[i]) { ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x + b.x, Math.max(wy + 3, GB - b.y), b.r, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  }
  // le verre
  ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x - glassW(top), top); ctx.lineTo(x - glassW(GB), GB); ctx.lineTo(x + glassW(GB), GB); ctx.lineTo(x + glassW(top), top); ctx.stroke();
  ctx.strokeStyle = 'rgba(220,240,255,0.9)'; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.moveTo(x - glassW(top) + 7, top + 6); ctx.lineTo(x - glassW(GB) + 6, GB - 8); ctx.lineTo(x - glassW(GB) + 12, GB - 8); ctx.lineTo(x - glassW(top) + 14, top + 6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = INK; ctx.fillRect(x - glassW(GB) - 3, GB, glassW(GB) * 2 + 6, 7); ctx.fillStyle = col; ctx.fillRect(x - glassW(GB), GB + 1, glassW(GB) * 2, 4); // le pied, à la couleur du joueur
  // le trait
  if (L > 0) {
    const ly = GB - L * GH, lw = glassW(ly);
    ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x - lw - 4, ly); ctx.lineTo(x + lw + 4, ly); ctx.stroke();
    ctx.strokeStyle = '#ffd23a'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.lineDashOffset = -t * 20; ctx.stroke(); ctx.setLineDash([]);
    const d = i === 0 ? -1 : 1, ax = x + d * (lw + 10);
    ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(ax - d * 2, ly); ctx.lineTo(ax + d * 12, ly - 8); ctx.lineTo(ax + d * 12, ly + 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.moveTo(ax, ly); ctx.lineTo(ax + d * 10, ly - 6); ctx.lineTo(ax + d * 10, ly + 6); ctx.closePath(); ctx.fill();
  }
}

export default {
  title: 'LE VERRE PARFAIT', color: '#4ab8ff', icon: '🚰',
  goal: 'Ferme le robinet pile quand l\'eau touche le trait doré !',
  keys: [['A', 'fermer le robinet']],
  ach: [['Barman diplômé', 'L\'œil du sommelier', 'Niveau laser'], ['Serpillière d\'or', 'Les chutes du Niagara', 'Le dégât des eaux']],
  news: (L, d) => `${L} INONDE LE BAR : L'ASSURANCE REFUSE (+${d} %)`,

  draw(view, W, M, dt) {
    const ctx = view.g, g = M.g, X = S(view), t = view.time, L = -view.ox, R = 640 + view.ox, T = -view.oy, B = 360 + view.oy;
    // le bar : carrelage de métro, le comptoir en bois
    ctx.fillStyle = '#1c2430'; ctx.fillRect(L, T, R - L, B - T);
    for (let y = 0; y < GB; y += 14) for (let x = Math.floor(L / 28) * 28 + ((y / 14) % 2) * 14; x < R; x += 28) { ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(x + 1, y + 1, 26, 12); }
    ctx.fillStyle = '#2a3442'; ctx.fillRect(316, 56, 8, GB - 56);
    ctx.fillStyle = INK; ctx.fillRect(L, GB + 6, R - L, B - GB - 6);
    ctx.fillStyle = '#6a3a1a'; ctx.fillRect(L, GB + 8, R - L, B - GB - 8);
    ctx.fillStyle = '#8a5028'; ctx.fillRect(L, GB + 8, R - L, 6);
    view.text('🚰 LE VERRE PARFAIT', 320, 18, 18, '#4ab8ff', { title: true });
    view.timer(M, 320, 46);
    const gl = g.k >= 0 && g.k < TAP.MAX ? g.gls[g.k] : null;
    if (g.k >= 0 && g.k < TAP.MAX) view.text(`VERRE ${g.k + 1}`, 320, 92, 12, '#c8d8e8', { mono: true });
    const sl = Math.max(0, 1 - (t - X.swap) / 0.25), slide0 = sl * sl * 200;
    for (let i = 0; i < 2; i++) {
      const P = g.p[i], slot = i === 0 ? M.a : M.v, col = COLORS[slot], d = i === 0 ? 1 : -1;
      const flowing = !!gl && g.wait <= 0 && !P.done, slide = slide0 * d;
      X.pop[i] = Math.max(0, X.pop[i] - dt * 3);
      // les bulles qui montent pendant que ça coule
      if (flowing && Math.random() < 0.5) X.bub[i].push({ x: (Math.random() - 0.5) * 50, y: 4, r: 1 + Math.random() * 2, v: 30 + Math.random() * 40 });
      X.bub[i] = X.bub[i].filter((b) => (b.y += b.v * dt) < GH);
      // le glouglou
      if (flowing) { X.glug[i] -= dt; if (X.glug[i] <= 0) { X.glug[i] = 0.22 - Math.min(0.12, g.u / 900); const A = view.audio; if (A) A.sfx('glug', i === 0 ? -0.5 : 0.5, 0.12, 1 + Math.floor(P.w * 4)); } }
      // le filet d'eau
      const wy = GB - P.w * GH;
      if (flowing) {
        ctx.fillStyle = 'rgba(120,210,255,0.85)';
        for (let y = SPOUT + 2; y < wy; y += 4) ctx.fillRect(CX[i] - 3 + Math.sin(y * 0.3 + t * 30) * 0.8, y, 6, 4);
        ctx.fillStyle = 'rgba(230,250,255,0.9)'; ctx.fillRect(CX[i] - 1, SPOUT + 2, 2, Math.max(0, wy - SPOUT - 2));
      }
      drawFaucet(ctx, i, col, t, flowing, X.cut[i]);
      drawGlass(view, i, col, P.w, gl ? gl.L : 0, t, X, slide);
      // le débordement : la cascade sur les côtés, la flaque
      const sp = t - X.spill[i];
      if (sp >= 0 && sp < 2.5) {
        const a = Math.min(1, (2.5 - sp) / 0.6);
        ctx.fillStyle = `rgba(120,210,255,${0.8 * a})`;
        for (const s of [-1, 1]) for (let y = GB - GH; y < GB; y += 5) ctx.fillRect(CX[i] + s * (glassW(y) + 3) + Math.sin(y * 0.2 + t * 20) * 1.2 - 2, y, 4, 5);
        ctx.beginPath(); ctx.ellipse(CX[i], GB + 10, 60 + Math.min(1, sp * 2) * 40, 6, 0, 0, Math.PI * 2); ctx.fill();
      }
      // le joueur à côté, qui suit son verre
      const o = { face: i === 0 ? 'three' : 'threeL', head: 1.9 };
      if (flowing && gl && P.w > gl.L * 0.8) o.state = 'shield'; // il se crispe près du trait
      if (!view.player(W, M, i, PX[i], 286, 126, o)) view.portraitAt(W.fighters[slot].char, PX[i], 230, 50, col, i === 1);
      // comment jouer : la grosse touche à hauteur du trait, « ATTENDS… » puis « MAINTENANT ! » (jaune, qui grossit)
      if (!P.done || !gl) {
        const ly = gl ? GB - gl.L * GH : GB - GH * 0.6, near = flowing && P.w >= gl.L - 0.1, bot = W.fighters[slot].bot;
        const sc = near ? 1.3 + Math.max(0, Math.sin(t * 30)) * 0.12 : M.t < 180 ? 1.2 : 1;
        keyCap(view, M, i, CX[i] - d * 96, ly, sc, 0, near && Math.sin(t * 30) > -0.5, bot ? null : near ? 'MAINTENANT !' : 'ATTENDS…', col);
      } else keyCap(view, M, i, CX[i] - d * 96, GB - P.w * GH, 1, 1 - (t - X.cut[i]) / 0.12, false, null, col);
      view.hint(W, M, i, CX[i], GB + 24, [['A', 'fermer le robinet']]);
      view.who(W, M, i, PX[i] + d * 6, GB + 16, { align: 'center', size: 0.85 });
      // le score, le dernier verre
      view.text(`${P.s}`, PX[i] + d * 10, 104, 26 + X.pop[i] * 12, col, { mono: true });
      view.text('POINTS', PX[i] + d * 10, 124, 9, '#c8d8e8', { mono: true, stroke: false });
      const r = X.res[i];
      if (r && g.k === r.k) view.text(r.txt, CX[i], GB - GH - 14, 13, r.col, { mono: true });
    }
  },

  onEvent(view, ev, W, M) {
    if (!M || !ev.type.startsWith('mgTap')) return;
    const A = view.audio, X = S(view);
    if (ev.type === 'mgTapGlass') {
      X.swap = view.time; X.res = [null, null]; X.bub = [[], []];
      if (A) A.sfx('clink', 0, 0.5, 1 + (ev.k % 3));
      if (ev.k > 0) view.sticker(ev.tl < 80 ? 'PLUS VITE ! 💨' : `VERRE ${ev.k + 1}`, 320, 150, { size: 14, color: INK, bg: '#4ab8ff', life: 0.6, rot: 0 });
      return;
    }
    if (ev.type === 'mgTapNext') return;
    const i = ev.p, slot = i === 0 ? M.a : M.v, col = COLORS[slot], pan = i === 0 ? -0.5 : 0.5, x = CX[i];
    if (ev.type === 'mgTapCut') {
      X.cut[i] = view.time; X.pop[i] = 1;
      const mm = Math.round(ev.d / 1000 * MM), y = GB - ev.w / 1000 * GH;
      X.res[i] = { k: ev.k, txt: ev.perf ? 'PILE !' : `${mm > 0 ? '+' : ''}${mm} mm`, col: ev.perf ? '#ffe24a' : Math.abs(mm) <= 6 ? '#3bdc5a' : '#ffffff' };
      view.burst(x, y, ev.perf ? 22 : 8, ev.perf ? ['#ffe24a', '#ffffff', col] : ['#9ad8ff', '#ffffff'], { shape: ev.perf ? 'star' : 'dot', speed: ev.perf ? 240 : 120, size: ev.perf ? 6 : 3, life: 0.6 });
      view.sticker(`+${ev.pts}`, x, y - 22, { size: ev.perf ? 22 : 16, color: ev.perf ? INK : '#ffffff', bg: ev.perf ? '#ffe24a' : col, life: 0.7 });
      if (A) { A.sfx('click', pan, 0.6); A.sfx('clink', pan, 0.4, 2); }
      if (ev.perf) {
        view.jolt(0.4, 0.05, '#ffffff', 0.15); view.hype(0.4);
        view.react(i, { emote: 'cheer', life: 1.3, pop: 0.3 });
        if (A) { A.sfx('hitmark', pan, 0.7); A.sfx('cash', pan, 0.5); A.say(view.pick(['Parfait !', 'Au millimètre !', 'Quel œil !']), 0.55, 1.2); }
      } else if (ev.pts >= 70) view.react(i, { emote: 'clap', life: 1, pop: 0.2 });
      else if (ev.pts < 30) { view.react(i, { emote: 'complain_01', life: 1 }); view.sticker(ev.d < 0 ? view.pick(['RADIN ! 🤏', 'À SEC 🏜️', 'UN FOND…']) : view.pick(['RAS LA GUEULE', 'TOUT JUSTE…']), x, GB - GH - 40, { size: 13, color: '#ffffff', bg: '#7a5a9a', life: 0.8 }); }
    } else if (ev.type === 'mgTapSpill') {
      X.spill[i] = view.time; X.pop[i] = 1;
      X.res[i] = { k: ev.k, txt: 'DÉBORDÉ !', col: '#ff5a5a' };
      view.burst(x, GB - GH, 30, ['#9ad8ff', '#4ab8ff', '#ffffff'], { shape: 'dot', speed: 220, size: 4, up: 120, life: 0.8 });
      view.sticker(view.pick(['ÇA DÉBORDE ! 🌊', 'INONDATION', 'LES CHUTES DU NIAGARA']), x, GB - GH - 40, { size: 14, color: '#ffffff', bg: '#a00010', life: 0.9 });
      view.jolt(0.35, 0.04);
      view.react(i, { emote: 'sob', life: 1.4 });
      if (A) { A.sfx('splatter', pan, 0.6); A.sfx('wave', pan, 0.4); A.sfx('error', pan, 0.3); }
    }
  },
};
