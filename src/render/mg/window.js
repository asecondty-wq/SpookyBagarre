// Lave-vitre lofi (window), l'affichage : la façade d'un immeuble, la nuit, sous la pluie ; deux fenêtres côte à côte (J1 à
// gauche, J2 à droite), chacune avec sa nacelle en dessous où se tient le laveur (son vrai modèle 3D). Derrière chaque
// vitre, la chambre lofi de Nymano : lampe chaude, étagère, plante, tasse qui fume, la ville sous la pluie au fond ; lui,
// casque sur les oreilles, pleure à son bureau (son vrai modèle). La saleté (la grille de la simulation) est une image
// minuscule agrandie en douceur (des traînées floues), les fientes dessinées par-dessus. L'éponge à la couleur du joueur.
import { COLORS } from '../../sim/constants.js';
import { WIN } from '../../sim/mg/window.js';

const C = WIN;
const WINS = [[18, 50], [338, 50]], WW = 284, WH = WW * C.H / C.W, S = WW / C.W; // les deux vitres (coin haut gauche), leur taille
const PLANK = 300;
const LOFI = [0, 3, 7, 10, 5, 3, 0, -2]; // la petite boucle lofi (en demi-tons ; un cran de variante = 2 demi-tons)
const SNIF = ['snif...', '*renifle*', 'c\'est si beau...', 'cette prod...', 'le lofi me comprend', 'bouhou...'];
const THANKS = ['MERCI 🥲', 'TU ME VOIS ?!', 'C\'EST BEAU 😭', 'ENFIN LA LUMIÈRE'];

function xs(view) {
  const X = view.xs;
  if (!X.dc) {
    X.dc = [0, 1].map(() => { const c = document.createElement('canvas'); c.width = C.GX; c.height = C.GY; return c; });
    X.id = [0, 1].map((i) => X.dc[i].getContext('2d').createImageData(C.GX, C.GY));
    X.sq = [0, 0]; X.shT = [0, 0]; X.lofiN = -1; X.sayT = -9; X.happy = [0, 0]; X.cheer = [0, 0]; X.bub = [null, null]; X.bubT = [1.5, 3.2]; X.end = null;
  }
  return X;
}
const wx = (i, x) => WINS[i][0] + x * S;
const wy = (i, y) => WINS[i][1] + y * S;

// la chambre de Nymano, derrière la vitre i
function drawRoom(view, ctx, i, x0, y0, t, pc) {
  const bg = ctx.createLinearGradient(0, y0, 0, y0 + WH); bg.addColorStop(0, '#2a1e44'); bg.addColorStop(1, '#5a3a5a');
  ctx.fillStyle = bg; ctx.fillRect(x0, y0, WW, WH);
  // sa fenêtre à lui, au fond : la ville sous la pluie
  const fx = x0 + WW * 0.58, fy = y0 + 14, fw = WW * 0.34, fh = WH * 0.42;
  ctx.fillStyle = '#141a3a'; ctx.fillRect(fx, fy, fw, fh);
  for (let k = 0; k < 7; k++) { ctx.fillStyle = '#0c1028'; const bh = 14 + (k * 17) % 26; ctx.fillRect(fx + k * fw / 7, fy + fh - bh, fw / 7 - 1, bh); }
  for (let k = 0; k < 12; k++) { ctx.fillStyle = (k * 7 + Math.floor(t)) % 5 ? '#ffd27a' : '#2a2a4a'; ctx.fillRect(fx + 3 + (k * 23) % (fw - 6), fy + fh - 6 - (k * 13) % 26, 2, 2); }
  ctx.strokeStyle = 'rgba(160,190,255,0.35)'; ctx.lineWidth = 1; ctx.beginPath();
  for (let k = 0; k < 9; k++) { const rx = fx + ((k * 29 + t * 30) % fw), ry = fy + ((k * 41 + t * 160) % fh); ctx.moveTo(rx, ry); ctx.lineTo(rx - 1, Math.min(fy + fh, ry + 6)); }
  ctx.stroke();
  ctx.strokeStyle = '#1a1028'; ctx.lineWidth = 3; ctx.strokeRect(fx, fy, fw, fh); ctx.beginPath(); ctx.moveTo(fx + fw / 2, fy); ctx.lineTo(fx + fw / 2, fy + fh); ctx.stroke();
  // l'étagère, les livres, la plante
  ctx.fillStyle = '#3a2430'; ctx.fillRect(x0 + 10, y0 + 40, 70, 4);
  const books = ['#c85a5a', '#5a8ac8', '#e8c05a', '#7ac87a', '#a87ac8'];
  for (let k = 0; k < 6; k++) { ctx.fillStyle = books[k % 5]; ctx.fillRect(x0 + 14 + k * 8, y0 + 26 + (k % 2) * 3, 6, 14 - (k % 2) * 3); }
  ctx.fillStyle = '#7a4a2a'; ctx.fillRect(x0 + 64, y0 + 30, 10, 10);
  ctx.fillStyle = '#4a9a4a'; for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.ellipse(x0 + 69 + (k - 2) * 4, y0 + 24 - Math.abs(k - 2) * -2, 3, 7, (k - 2) * 0.4, 0, 7); ctx.fill(); }
  // la lampe : une lueur chaude qui respire
  const lx = x0 + 34, ly = y0 + WH * 0.56, glow = ctx.createRadialGradient(lx, ly, 2, lx, ly, 90);
  glow.addColorStop(0, `rgba(255,190,110,${0.5 + 0.05 * Math.sin(t * 2)})`); glow.addColorStop(1, 'rgba(255,150,80,0)');
  ctx.fillStyle = glow; ctx.fillRect(x0, y0, WW, WH);
  return { lx, ly };
}

function drawDesk(view, ctx, x0, y0, t, lamp) {
  const dy = y0 + WH * 0.7;
  ctx.fillStyle = '#0b0610'; ctx.fillRect(x0, dy - 2, WW, WH - (dy - y0) + 2);
  ctx.fillStyle = '#6a4030'; ctx.fillRect(x0, dy, WW, 7); ctx.fillStyle = '#4a2a22'; ctx.fillRect(x0, dy + 7, WW, WH);
  // la lampe de bureau
  ctx.fillStyle = '#0b0610'; ctx.fillRect(lamp.lx - 2, lamp.ly, 4, dy - lamp.ly); ctx.fillRect(lamp.lx - 9, dy - 3, 18, 4);
  ctx.fillStyle = '#e8a050'; ctx.beginPath(); ctx.moveTo(lamp.lx - 12, lamp.ly + 2); ctx.lineTo(lamp.lx + 12, lamp.ly + 2); ctx.lineTo(lamp.lx + 6, lamp.ly - 10); ctx.lineTo(lamp.lx - 6, lamp.ly - 10); ctx.fill();
  ctx.fillStyle = '#fff2c0'; ctx.fillRect(lamp.lx - 9, lamp.ly + 1, 18, 2);
  // la tasse qui fume, le carnet
  const mx = x0 + WW * 0.8;
  ctx.fillStyle = '#0b0610'; ctx.fillRect(mx - 7, dy - 13, 14, 13); ctx.fillStyle = '#e8e0f0'; ctx.fillRect(mx - 6, dy - 12, 12, 11); ctx.fillStyle = '#c85a8a'; ctx.fillRect(mx - 6, dy - 8, 12, 3);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1.5; ctx.beginPath();
  for (let k = 0; k < 2; k++) { const sx = mx - 2 + k * 4; ctx.moveTo(sx, dy - 15); for (let s = 1; s < 6; s++) ctx.lineTo(sx + Math.sin(t * 3 + s + k) * 2, dy - 15 - s * 4); }
  ctx.stroke();
  ctx.fillStyle = '#f4ead6'; ctx.fillRect(x0 + WW * 0.62, dy - 3, 22, 3);
}

// le casque sur la (grosse) tête de Nymano, et ses larmes
function drawPhones(ctx, x, hy, hr, t) {
  ctx.strokeStyle = '#0b0610'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x, hy, hr, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  ctx.strokeStyle = '#ff6ab0'; ctx.lineWidth = 3; ctx.stroke();
  for (const d of [-1, 1]) { ctx.fillStyle = '#0b0610'; ctx.fillRect(x + d * hr - 5, hy - 6, 10, 14); ctx.fillStyle = '#ff6ab0'; ctx.fillRect(x + d * hr - 4, hy - 5, 8, 12); }
  ctx.fillStyle = '#7ad8ff';
  for (let s = 0; s < 6; s++) { const u = ((t * 2 + s / 6) % 1); for (const d of [-1, 1]) ctx.fillRect(x + d * (hr * 0.4 + u * 16), hy + 6 + u * u * 26 - u * 6, 2.5, 2.5); }
}

function drawDirt(view, ctx, X, i, P, g, x0, y0, t) {
  const id = X.id[i], dd = id.data;
  for (let k = 0; k < P.d.length; k++) {
    const v = P.d[k], o = k * 4, h = (k * 2654435761) >>> 28;
    // (une crasse bien opaque, brun-vert, qu'on voit de loin : le moindre reste se repère)
    dd[o] = 70 + h * 3; dd[o + 1] = 58 + h * 2; dd[o + 2] = 30 + h; dd[o + 3] = v <= 0 ? 0 : Math.min(252, 150 + v * 1.4);
  }
  X.dc[i].getContext('2d').putImageData(id, 0, 0);
  ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'low';
  ctx.drawImage(X.dc[i], x0 - S * C.CELL * 0.5, y0 - S * C.CELL * 0.5, WW + S * C.CELL, WH + S * C.CELL);
  ctx.restore();
  // les fientes (de corbeau maléfique, sans doute), bien collées
  for (const [cx, cy] of g.pp) {
    const v = P.d[cy * C.GX + cx];
    if (v <= 0) continue;
    const a = Math.min(1, v / 200), px = x0 + (cx + 0.5) * C.CELL * S, py = y0 + (cy + 0.5) * C.CELL * S;
    ctx.globalAlpha = a; ctx.fillStyle = '#f4f0e0';
    ctx.beginPath(); ctx.arc(px, py, 9, 0, 7); ctx.arc(px + 7, py + 4, 5, 0, 7); ctx.arc(px - 6, py + 5, 4, 0, 7); ctx.fill();
    ctx.fillRect(px - 2, py + 6, 3, 10); ctx.fillRect(px + 4, py + 8, 2, 7);
    ctx.fillStyle = '#c8c0a0'; ctx.beginPath(); ctx.arc(px + 1, py - 1, 4, 0, 7); ctx.fill();
    ctx.fillStyle = '#4a4a3a'; ctx.fillRect(px - 1, py - 2, 3, 3);
  }
  ctx.globalAlpha = 1;
  // les reflets de la vitre, et les gouttes de pluie qui glissent dessus
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath(); ctx.moveTo(x0 + 20, y0); ctx.lineTo(x0 + 60, y0); ctx.lineTo(x0 + 10, y0 + WH); ctx.lineTo(x0 - 30, y0 + WH); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x0 + 80, y0); ctx.lineTo(x0 + 92, y0); ctx.lineTo(x0 + 42, y0 + WH); ctx.lineTo(x0 + 30, y0 + WH); ctx.fill();
  ctx.fillStyle = 'rgba(200,220,255,0.55)';
  for (let k = 0; k < 6; k++) { const rx = x0 + 12 + (k * 47) % (WW - 20), ry = y0 + ((k * 61 + t * (18 + k * 5)) % WH); ctx.fillRect(rx, ry, 2, 4); ctx.fillRect(rx, ry - 8, 1, 7); }
}

function drawSponge(view, ctx, i, P, col, t, slot) {
  const x = wx(i, P.x), y = wy(i, P.y), sp = P.spray > 0, r = C.R * S * (sp ? C.SPRAY_R : 1);
  // la zone qui frotte
  ctx.strokeStyle = col; ctx.globalAlpha = 0.5; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.lineDashOffset = -t * 20;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
  if (sp) { ctx.fillStyle = 'rgba(160,230,255,0.22)'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
  const wob = Math.sin(t * 30) * Math.min(1, P.mv) * 2;
  ctx.save(); ctx.translate(x, y); ctx.rotate(wob * 0.05);
  ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.roundRect(-18, -12, 36, 24, 6); ctx.fill();
  ctx.fillStyle = '#ffe24a'; ctx.beginPath(); ctx.roundRect(-16, -10, 32, 20, 5); ctx.fill();
  ctx.fillStyle = col; ctx.fillRect(-16, 2, 32, 8);
  ctx.fillStyle = '#c8a020'; for (let k = 0; k < 5; k++) ctx.fillRect(-12 + k * 6, -6 + (k % 2) * 3, 2, 2);
  ctx.restore();
  // la mousse
  if (P.mv > 0.4 || sp) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let k = 0; k < 6; k++) { const a = k * 1.05 + t * 3, rr = 16 + Math.sin(t * 7 + k) * 4; ctx.beginPath(); ctx.arc(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.7, 2 + (k % 3), 0, 7); ctx.fill(); }
  }
  view.text(view.pname(slot), x, y - 20, 9, col, { mono: true });
}

export default {
  title: 'LAVE-VITRE LOFI', color: '#8ad8ff', icon: '🧽',
  input: 'mouse',
  puppets: ['nymano'],
  goal: 'Bouge ton éponge partout sur la vitre : la plus propre gagne !',
  keys: { pad: [['stick', 'bouge = frotte'], ['A', 'pschitt']], kb: [['dirs', 'bouge = frotte'], ['A', 'pschitt']], kb1: [['dirs', 'bouge = frotte'], ['mouse', 'aussi'], ['A', 'pschitt']] },
  ach: [['Vitre de cathédrale', 'Monsieur Propre', 'Lofi beats to clean to', 'Zéro trace'], ['Vitre de tripot', 'Fiente éternelle', 'Nymano te voit pas', 'Éponge en grève']],
  news: (L, d) => `${L} LAISSE UNE FIENTE SUR LA VITRE DE NYMANO : ${d} % ET UNE TRACE`,

  warm(view, W, M) {
    for (let i = 0; i < 2; i++) for (const e of ['sob', 'heart_pose']) view.puppet('nymano', -9999, -9999, 10, { key: 'nym' + i, emote: e, head: 2, face: 'front', shadow: false });
    for (let i = 0; i < 2; i++) for (const e of [null, 'cheer']) view.puppet(W.fighters[i ? M.v : M.a].char, -9999, -9999, 10, e ? { key: view.pkey(W, M, i), emote: e, shadow: false } : { key: view.pkey(W, M, i), shadow: false });
  },

  draw(view, W, M, dt) {
    const ctx = view.g, g = M.g;
    if (!g || !g.p) return;
    const X = xs(view), t = view.time, slots = [M.a, M.v], L = -view.ox, R = 640 + view.ox, T = -view.oy, B = 360 + view.oy;
    // la façade : des briques sombres sous la pluie
    ctx.fillStyle = '#1e1428'; ctx.fillRect(L, T, R - L, B - T);
    ctx.fillStyle = '#281a34';
    for (let y = T - (T % 12); y < B; y += 12) for (let x = L - 30 + ((y / 12) % 2) * 15; x < R; x += 30) ctx.fillRect(x, y, 28, 10);
    for (let i = 0; i < 2; i++) {
      const P = g.p[i], slot = slots[i], col = COLORS[slot], [x0, y0] = WINS[i];
      X.sq[i] = Math.max(0, X.sq[i] - dt * 3); X.cheer[i] = Math.max(0, X.cheer[i] - dt);
      // le cadre de la fenêtre
      ctx.fillStyle = '#0b0610'; ctx.fillRect(x0 - 9, y0 - 9, WW + 18, WH + 18);
      ctx.fillStyle = '#d8d0e0'; ctx.fillRect(x0 - 7, y0 - 7, WW + 14, WH + 14);
      ctx.fillStyle = col; ctx.fillRect(x0 - 7, y0 - 7, WW + 14, 4); ctx.fillRect(x0 - 7, y0 + WH + 3, WW + 14, 4);
      ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, WW, WH); ctx.clip();
      const lamp = drawRoom(view, ctx, i, x0, y0, t, P.pc);
      // Nymano, derrière son bureau, casque sur les oreilles
      const nx = x0 + WW * 0.47, ny = y0 + WH * 1.02, nh = 104, happy = P.done || (M.ph === 'outro' && X.end && X.end.w === i);
      const ok = view.pupOn(M) && view.puppet('nymano', nx, ny, nh, { key: 'nym' + i, emote: happy ? 'heart_pose' : 'sob', head: 2, face: 'front', shadow: false, squash: [1 + Math.sin(t * 2 + i) * 0.02, 1 - Math.sin(t * 2 + i) * 0.02] });
      if (!ok) view.portraitAt('nymano', nx, ny - nh * 0.9, 40, '#5a8aff', false);
      if (!happy) drawPhones(ctx, nx, ny - nh * 1.05, 22, t + i);
      // les notes lofi qui flottent
      for (let k = 0; k < 4; k++) {
        const u = (t * 0.35 + k / 4) % 1;
        view.text(['♪', '♫', '♪', '♬'][k], nx + (k % 2 ? 30 : -34) + Math.sin(t * 2 + k) * 8, ny - nh * 1.1 - u * 60, 12, ['#ffb0e0', '#b0e0ff', '#fff0a0', '#c0ffc0'][k], { stroke: false, alpha: Math.sin(u * Math.PI) });
      }
      drawDesk(view, ctx, x0, y0, t, lamp);
      if (happy) view.text(THANKS[i % THANKS.length], nx, y0 + 26 + Math.sin(t * 6) * 3, 16, '#ff8ad0', { mono: true });
      else if (X.bub[i]) view.text(X.bub[i], nx + 50, y0 + WH * 0.36, 10, '#bfe8ff', { mono: true, alpha: 0.9 });
      drawDirt(view, ctx, X, i, P, g, x0, y0, t);
      ctx.restore();
      // le croisillon de la fenêtre
      ctx.fillStyle = '#d8d0e0'; ctx.fillRect(x0 + WW / 2 - 2, y0, 4, WH); ctx.fillStyle = 'rgba(11,6,16,0.5)'; ctx.fillRect(x0 + WW / 2 + 2, y0, 1, WH);
      drawSponge(view, ctx, i, P, col, t, slot);
      // ses touches, collées à son éponge ; immobile, l'éponge le réclame
      const sx2 = wx(i, P.x), sy2 = wy(i, P.y), human = !W.fighters[slot].bot;
      view.hint(W, M, i, Math.max(x0 + 84, Math.min(x0 + WW - 84, sx2)), sy2 > y0 + WH - 40 ? sy2 - 40 : sy2 + 30, [['dirs', 'bouge = frotte'], ['A', 'pschitt']]);
      if (human && M.ph === 'play' && M.t > 40 && P.mv < 0.3 && !P.done) view.text('↔ BOUGE ! ↕', sx2, sy2 - 32, 12, '#ffe24a', { mono: true, alpha: 0.7 + 0.3 * Math.sin(t * 12) });
      // le rebord, la nacelle (deux câbles), le laveur dessus
      ctx.fillStyle = '#0b0610'; ctx.fillRect(x0 - 14, y0 + WH + 8, WW + 28, 8); ctx.fillStyle = '#8a8098'; ctx.fillRect(x0 - 12, y0 + WH + 9, WW + 24, 5);
      ctx.strokeStyle = '#0b0610'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x0 + 6, T); ctx.lineTo(x0 + 6, PLANK); ctx.moveTo(x0 + WW - 6, T); ctx.lineTo(x0 + WW - 6, PLANK); ctx.stroke();
      ctx.fillStyle = '#0b0610'; ctx.fillRect(x0 - 4, PLANK - 2, WW + 8, 12);
      ctx.fillStyle = col; ctx.fillRect(x0 - 2, PLANK, WW + 4, 8);
      ctx.fillStyle = '#0b0610'; for (let k = 0; k < 6; k++) ctx.fillRect(x0 + 10 + k * (WW - 20) / 5, PLANK - 22, 2, 22);
      ctx.fillRect(x0 - 2, PLANK - 23, WW + 4, 3);
      const ch = W.fighters[slot].char, px = i === 0 ? x0 + 36 : x0 + WW - 36;
      if (view.pupOn(M)) {
        const em = X.cheer[i] > 0 || P.done ? 'cheer' : null;
        if (!view.puppet(ch, px, PLANK, 54, em ? { key: view.pkey(W, M, i), emote: em, head: 1.5, shadow: false } : { key: view.pkey(W, M, i), state: P.mv > 0.5 ? 'walk' : 'idle', face: i === 0 ? 'threeL' : 'three', head: 1.5, shadow: false })) view.portraitAt(ch, px, PLANK - 20, 20, col, i === 1);
      }
      // qui, combien
      const pcs = `${Math.floor(P.pc)} %`;
      if (i === 0) { view.who(W, M, 0, x0 + 70, PLANK - 54); view.text(pcs, x0 + WW - 6, PLANK - 38, 22 + X.sq[i] * 8, P.done ? '#7cff8a' : '#ffffff', { align: 'right', mono: true }); }
      else { view.who(W, M, 1, x0 + WW - 70, PLANK - 54, { align: 'right' }); view.text(pcs, x0 + 6, PLANK - 38, 22 + X.sq[i] * 8, P.done ? '#7cff8a' : '#ffffff', { align: 'left', mono: true }); }
      if (g.lead === i) view.text('👑', i === 0 ? x0 + WW - 6 : x0 + 6, PLANK - 62, 13, '#fff', { stroke: false, align: i === 0 ? 'right' : 'left' });
      // la jauge de pschitt
      const k = P.cd > 0 ? 1 - P.cd / C.SPRAY_CD : 1, gx = i === 0 ? x0 + 70 : x0 + WW - 70 - 90, gy = PLANK - 20;
      ctx.fillStyle = '#0b0610'; ctx.fillRect(gx, gy - 4, 90, 9); ctx.fillStyle = k >= 1 ? '#7ad8ff' : '#3a5a7a'; ctx.fillRect(gx + 1, gy - 3, 88 * k, 7);
      view.text(k >= 1 ? 'PSCHITT PRÊT' : 'pschitt...', gx + 45, gy + 12, 8, k >= 1 ? '#bfe8ff' : '#6a7a8a', { mono: true, stroke: false });
      // la bulle de Nymano, de temps en temps
      if ((X.bubT[i] -= dt) <= 0) { X.bub[i] = X.bub[i] ? null : view.pick(SNIF); X.bubT[i] = X.bub[i] ? 1.6 : 2 + Math.random() * 2; }
      // le bruit de l'éponge
      if (P.rub > 0 && P.mv > 0.5 && (X.shT[i] -= dt) <= 0) {
        X.shT[i] = 0.16;
        if (view.audio) view.audio.sfx('zip', i ? 0.4 : -0.4, 0.12, 6 + ((Math.random() * 4) | 0));
        view.burst(wx(i, P.x), wy(i, P.y), 2, ['#ffffff', '#e0f4ff'], { shape: 'dot', speed: 50, up: 20, g: 60, life: 0.5, size: 3 });
      }
    }
    // la pluie, devant tout
    ctx.strokeStyle = 'rgba(170,200,255,0.25)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let k = 0; k < 40; k++) { const rx = L + ((k * 53 + t * 40) % (R - L)), ry = T + ((k * 97 + t * 420) % (B - T)); ctx.moveTo(rx, ry); ctx.lineTo(rx - 2, ry + 10); }
    ctx.stroke();
    view.timer(M, 320, 22);
    // la boucle lofi, toute douce (sur le temps du jeu)
    const A = view.audio, n = Math.floor((M.ph === 'play' ? M.t : 600) / 30);
    if (A && M.ph === 'play' && n !== X.lofiN) { X.lofiN = n; A.sfx('note', 0, 0.16, LOFI[n % LOFI.length] / 2 - 2); if (n % 8 === 0) A.sfx('sample', 0, 0.12); }
  },

  onEvent(view, ev, W, M) {
    if (!M || M.kind !== 'window' || !M.g || !M.g.p) return;
    if (!ev.type.startsWith('mgWindow') && ev.type !== 'mgEnd' && ev.type !== 'mgGo') return;
    const A = view.audio, X = xs(view), g = M.g, i = ev.p, P = i === 0 || i === 1 ? g.p[i] : null, pan = i === 0 ? -0.4 : 0.4;
    const col = P ? COLORS[i === 0 ? M.a : M.v] : '#fff';
    switch (ev.type) {
      case 'mgGo':
        view.sticker('FROTTEZ ! 🧽', 320, 150, { size: 28, color: '#0b0610', bg: '#8ad8ff', life: 0.9 });
        if (A) A.say('Frottez ! Nymano veut voir la lumière.', 0.5, 1.1);
        break;
      case 'mgWindowShine': {
        // chaque coin rendu propre : une étincelle, un éclat de lumière, et un petit « couic » de vitre (pas à chaque fois)
        const cx = ev.k % C.GX, cy = (ev.k / C.GX) | 0, px = wx(i, (cx + 0.5) * C.CELL), py = wy(i, (cy + 0.5) * C.CELL);
        view.burst(px, py, 1, ['#fff'], { shape: 'txt', ch: '✨', speed: 30, up: 20, g: 0, life: 0.6, size: 7 });
        view.burst(px, py, 3, ['#ffffff', '#bfe8ff'], { shape: 'dot', speed: 70, up: 0, g: 0, life: 0.3, size: 2.5 });
        X.squeak = (X.squeak || 0) + 1;
        if (A && X.squeak % 3 === 0) A.sfx('blip', pan, 0.18, 6 + (X.squeak % 5));
        break;
      }
      case 'mgWindowSpray':
        if (A) { A.sfx('fizz', pan, 0.6); A.sfx('whoosh', pan, 0.3); }
        view.burst(wx(i, ev.x), wy(i, ev.y), 22, ['#bfe8ff', '#ffffff', '#7ad8ff'], { shape: 'dot', speed: 160, up: 0, g: 40, life: 0.6, size: 4 });
        view.sticker('PSCHITT !', wx(i, ev.x), wy(i, ev.y) - 34, { size: 14, color: '#0b0610', bg: '#bfe8ff', life: 0.5 });
        break;
      case 'mgWindowMile':
        X.sq[i] = 1; X.cheer[i] = 1;
        view.sticker(`${ev.pc} % !`, wx(i, C.W / 2), WINS[i][1] + 20, { size: 18, color: '#ffffff', bg: col, life: 0.7 });
        view.burst(wx(i, C.W / 2), WINS[i][1] + 20, 14, ['#ffe24a', '#ffffff', col], { shape: 'star', speed: 140, size: 4, life: 0.6 });
        if (A) A.sfx('blip', pan, 0.5, ev.pc / 25 * 2);
        if (ev.pc === 75 && A && view.time - X.sayT > 2) { X.sayT = view.time; A.say('Nymano commence à te voir !', 0.5, 1.15); }
        break;
      case 'mgWindowDone':
        X.sq[i] = 1; X.cheer[i] = 3;
        view.sticker('100 % PROPRE ! ✨', wx(i, C.W / 2), WINS[i][1] + WH / 2, { size: 22, color: '#0b0610', bg: '#7cff8a', life: 1.4 });
        view.burst(wx(i, C.W / 2), WINS[i][1] + WH / 2, 40, ['#ffffff', '#bfe8ff', '#ffe24a', '#ff8ad0'], { shape: 'star', speed: 220, size: 5, life: 1 });
        view.burst(wx(i, C.W / 2), WINS[i][1] + 30, 8, ['#fff'], { shape: 'txt', ch: '💖', speed: 120, up: 60, size: 9, life: 1.2 });
        view.jolt(0.4, 0.05, '#ffffff', 0.3); view.hype(0.7);
        if (A) { A.sfx('airhorn', pan, 0.5); A.sfx('cash', pan, 0.6); A.sfx('kiss', pan, 0.6); A.say('Nymano te voit enfin ! Il est ému.', 0.5, 1.1); }
        break;
      case 'mgWindowLead':
        view.sticker('👑 PLUS PROPRE !', wx(i, C.W / 2), WINS[i][1] + WH - 16, { size: 12, color: '#0b0610', bg: '#ffe24a', life: 0.6 });
        if (A) A.sfx('countHi', pan, 0.3);
        break;
      case 'mgEnd': {
        const w = ev.w === M.a ? 0 : ev.w === M.v ? 1 : -1;
        X.end = { w };
        if (w >= 0) { view.emojiRain(['🧽', '✨', '🎧', '😭'], 10); if (A) A.sfx('sob', 0, 0.6); }
        break;
      }
      default: break;
    }
  },
};
