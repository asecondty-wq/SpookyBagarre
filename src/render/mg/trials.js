// Trial du cimetière (trials), l'affichage : deux lignes l'une sous l'autre (J1 en haut, J2 en bas), la même piste, chacune
// sa caméra qui suit sa moto. Ciel violet, lune, collines et croix au loin (parallaxe), le chemin de terre, tombes sur les
// tertres, citrouilles au bord des rampes, drapeau à damier à l'arrivée. La moto (à la couleur du joueur) est dessinée,
// le pilote est son vrai modèle 3D (penché avec la moto) ; la chute l'envoie valser. Le fantôme de l'autre moto passe en
// transparence dans sa ligne ; entre les deux lignes, la course (les deux têtes sur une barre).
import { COLORS } from '../../sim/constants.js';
import { TRIALS, trialsH, trialsSlopeS, score } from '../../sim/mg/trials.js';
import { MG_PLAY } from '../../sim/mg/common.js';

const C = TRIALS;
const LANES = [[36, 192], [204, 358]], PX = 150; // les lignes (haut, bas) ; où la moto se tient à l'écran
const BAR_Y = 198, BS = 1.4; // BS : la taille de la moto
const CRASH_W = ['AÏE !', 'OUILLE !', 'LA BOÎTE !', 'GAMELLE !', 'BOUM !', 'PAS LA TOMBE !', 'CHUTE !'];
const LAND_W = ['PROPRE !', 'POSÉ !', 'NICKEL !', 'TRANQUILLE !'];
const SAY_CRASH = ['Aïe, la gamelle !', 'Il a embrassé une tombe !', 'Retour au caveau !', 'Ça, c\'est du trial !'];

function xs(view, M) {
  const X = view.xs;
  if (!X.cx) {
    const g = M.g;
    X.cx = [g.p[0].x - PX, g.p[1].x - PX]; X.cy = [g.p[0].y, g.p[1].y]; X.wh = [0, 0]; X.rag = [null, null]; X.wreck = [null, null];
    X.ex = [0, 0]; X.sq = [0, 0]; X.sayT = -9; X.end = null; X.dt = 1 / 60;
  }
  return X;
}
const lane = (i) => LANES[i];
const sxOf = (X, i, x) => x - X.cx[i];
const syOf = (X, i, y) => lane(i)[1] - 46 - (y - X.cy[i]);
const chars = (W, M) => [W.fighters[M.a].char, W.fighters[M.v].char];

// la moto, à plat (sans le pilote) : roues, cadre à la couleur du joueur, phare
function drawBike(ctx, x, y, ang, col, wh, alpha = 1, lean = 0) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.rotate(-ang); ctx.scale(BS, BS);
  for (const wx of [-13, 13]) {
    ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.arc(wx, -7, 7.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#3a3440'; ctx.beginPath(); ctx.arc(wx, -7, 5, 0, 7); ctx.fill();
    ctx.strokeStyle = '#c8c0d0'; ctx.lineWidth = 1; ctx.beginPath();
    for (let k = 0; k < 3; k++) { const a = wh + k * 2.094; ctx.moveTo(wx, -7); ctx.lineTo(wx + Math.cos(a) * 5, -7 + Math.sin(a) * 5); }
    ctx.stroke();
  }
  // le cadre
  ctx.strokeStyle = '#0b0610'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-13, -7); ctx.lineTo(-3, -15); ctx.lineTo(9, -15); ctx.lineTo(13, -7); ctx.moveTo(9, -15); ctx.lineTo(11, -22); ctx.stroke();
  ctx.strokeStyle = col; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-13, -7); ctx.lineTo(-3, -15); ctx.lineTo(9, -15); ctx.lineTo(13, -7); ctx.moveTo(9, -15); ctx.lineTo(11, -22); ctx.stroke();
  ctx.fillStyle = '#0b0610'; ctx.fillRect(-9, -19, 12, 5); ctx.fillStyle = col; ctx.fillRect(-8, -18, 10, 3); // la selle
  ctx.fillStyle = '#0b0610'; ctx.fillRect(-2, -14, 9, 7); ctx.fillStyle = '#8a8098'; ctx.fillRect(-1, -13, 7, 5); // le moteur
  ctx.fillStyle = '#ffe9a0'; ctx.fillRect(12, -21, 3, 3); // le phare
  ctx.fillStyle = '#0b0610'; ctx.fillRect(8 + lean, -24, 7, 2); // le guidon
  ctx.restore();
}
// le point (dx, dy) de la moto (repère de la moto) à l'écran
function bikePt(x, y, ang, dx, dy) { dx *= BS; dy *= BS; const c = Math.cos(-ang), s = Math.sin(-ang); return [x + dx * c - dy * s, y + dx * s + dy * c]; }

function drawSky(ctx, view, i, X, t) {
  const [y0, y1] = lane(i), L = -view.ox, R = 640 + view.ox;
  const sk = ctx.createLinearGradient(0, y0, 0, y1); sk.addColorStop(0, '#1a0e36'); sk.addColorStop(0.7, '#5a2a6a'); sk.addColorStop(1, '#c0567a');
  ctx.fillStyle = sk; ctx.fillRect(L, y0, R - L, y1 - y0);
  // la lune
  ctx.fillStyle = 'rgba(255,240,200,0.15)'; ctx.beginPath(); ctx.arc(420, y0 + 34, 26, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff2c8'; ctx.beginPath(); ctx.arc(420, y0 + 34, 16, 0, 7); ctx.fill();
  ctx.fillStyle = '#e8d8a8'; ctx.beginPath(); ctx.arc(414, y0 + 30, 3, 0, 7); ctx.arc(425, y0 + 39, 2.5, 0, 7); ctx.fill();
  // les étoiles
  ctx.fillStyle = '#fff6d0';
  for (let s = 0; s < 14; s++) { const xx = ((s * 97 - X.cx[i] * 0.05) % (R - L) + (R - L)) % (R - L) + L, yy = y0 + 6 + (s * 37) % 60; ctx.globalAlpha = 0.4 + 0.5 * Math.abs(Math.sin(t * 2 + s)); ctx.fillRect(xx, yy, 2, 2); }
  ctx.globalAlpha = 1;
  // les collines au loin, puis les croix et arbres morts (plus près, plus vite)
  ctx.fillStyle = '#2a1644';
  ctx.beginPath(); ctx.moveTo(L, y1);
  for (let x = L; x <= R + 8; x += 8) { const wx = x + X.cx[i] * 0.2; ctx.lineTo(x, y1 - 40 - 16 * Math.sin(wx * 0.012) - 8 * Math.sin(wx * 0.031)); }
  ctx.lineTo(R, y1); ctx.fill();
  ctx.fillStyle = '#1c0e30';
  const off = X.cx[i] * 0.45;
  for (let k = Math.floor((L + off) / 70) - 1; k < (R + off) / 70 + 1; k++) {
    const x = k * 70 - off, h = 10 + ((k * 7919) % 13 + 13) % 13, yb = y1 - 22;
    if (((k * 31) % 5 + 5) % 5 === 0) { // un arbre mort
      ctx.fillRect(x, yb - h - 16, 3, h + 16); ctx.fillRect(x - 6, yb - h - 8, 8, 2); ctx.fillRect(x + 2, yb - h - 13, 8, 2);
    } else { ctx.fillRect(x, yb - h, 3, h); ctx.fillRect(x - 3, yb - h + 3, 9, 3); }
  }
}

function drawGround(ctx, view, g, i, X, t) {
  const [y0, y1] = lane(i), L = -view.ox, R = 640 + view.ox;
  ctx.fillStyle = '#24142a';
  ctx.beginPath(); ctx.moveTo(L, y1);
  for (let x = L; x <= R + 4; x += 4) ctx.lineTo(x, syOf(X, i, trialsH(g, X.cx[i] + x)));
  ctx.lineTo(R, y1); ctx.fill();
  // l'herbe sur le dessus, et des cailloux
  ctx.strokeStyle = '#0b0610'; ctx.lineWidth = 5; ctx.beginPath();
  for (let x = L; x <= R + 4; x += 4) { const y = syOf(X, i, trialsH(g, X.cx[i] + x)); if (x === L) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
  ctx.stroke();
  ctx.strokeStyle = '#5a9a3a'; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = '#3a2440';
  for (let k = Math.floor((X.cx[i] + L) / 36); k < (X.cx[i] + R) / 36; k++) {
    const wx = k * 36 + ((k * 13) % 17), x = wx - X.cx[i], y = syOf(X, i, trialsH(g, wx));
    ctx.fillRect(x, y + 8 + (k % 3) * 5, 4, 3);
  }
  // le départ, l'arrivée
  const sx0 = 60 - X.cx[i];
  if (sx0 > L - 10 && sx0 < R) { ctx.fillStyle = '#ffffff'; ctx.fillRect(sx0 - 1, syOf(X, i, 0) - 70, 2, 70); }
  const fx = C.FIN - X.cx[i];
  if (fx > L - 30 && fx < R + 30) {
    const fy = syOf(X, i, trialsH(g, C.FIN));
    ctx.fillStyle = '#0b0610'; ctx.fillRect(fx - 1, fy - 56, 3, 56);
    for (let a = 0; a < 4; a++) for (let b = 0; b < 3; b++) { ctx.fillStyle = (a + b) % 2 ? '#0b0610' : '#ffffff'; ctx.fillRect(fx + 2 + a * 6, fy - 56 + b * 6 + Math.sin(t * 6 + a) * 1.5, 6, 6); }
    view.text('ARRIVÉE', fx + 14, fy - 64, 10, '#ffe24a', { mono: true });
  }
  // les décors : tombes sur les tertres, citrouilles au bord des rampes
  for (const d of g.dec) {
    const x = d[1] - X.cx[i];
    if (x < L - 20 || x > R + 20) continue;
    const y = syOf(X, i, d[2]);
    if (d[0] === 1) {
      ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.roundRect(x - 8, y - 20, 16, 22, [7, 7, 0, 0]); ctx.fill();
      ctx.fillStyle = '#8a8098'; ctx.beginPath(); ctx.roundRect(x - 6, y - 18, 12, 19, [6, 6, 0, 0]); ctx.fill();
      ctx.fillStyle = '#5a5068'; ctx.fillRect(x - 1, y - 15, 2, 9); ctx.fillRect(x - 4, y - 12, 8, 2);
    } else {
      const py = y + 1;
      ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.ellipse(x - 4, py - 6, 8, 7, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#ff8a1a'; ctx.beginPath(); ctx.ellipse(x - 4, py - 6, 6.5, 5.5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = Math.sin(t * 9 + x) > -0.3 ? '#ffe24a' : '#c86a0a'; ctx.fillRect(x - 7, py - 8, 2, 2); ctx.fillRect(x - 2, py - 8, 2, 2); ctx.fillRect(x - 6, py - 4, 5, 1);
      ctx.fillStyle = '#3a7a2a'; ctx.fillRect(x - 5, py - 14, 2, 3);
    }
  }
}

function drawRider(view, W, M, X, i, P, t, cs, slot) {
  const ctx = view.g, col = COLORS[slot], key = view.pkey(W, M, i);
  const x = sxOf(X, i, P.x), y = syOf(X, i, P.y);
  if (P.cr > 0 && X.wreck[i]) { // la moto couchée, le pilote qui valse
    const k = X.wreck[i];
    drawBike(ctx, sxOf(X, i, k.x), syOf(X, i, k.y) - 4, k.a, col, X.wh[i], 1);
    const R = X.rag[i];
    if (R && view.pupOn(M)) {
      const rx = sxOf(X, i, R.x), ry = syOf(X, i, R.y);
      if (!view.puppet(cs[i], rx, ry, 40, { key, state: R.ground ? 'down' : 'tumble', face: 'right', rot: R.ground ? 0 : R.r, head: 1.6, shadow: false })) view.portraitAt(cs[i], rx, ry - 12, 18, col, false);
      if (R.ground) view.text('💫', rx, ry - 30 + Math.sin(t * 8) * 2, 12, '#fff', { stroke: false });
    }
    return;
  }
  const blink = P.inv > 0 && (P.inv >> 2) % 2 === 0 ? 0.45 : 1;
  const sq = X.sq[i];
  drawBike(ctx, x, y, P.ang, col, X.wh[i], blink, P.lean * 2);
  const [fx, fy] = bikePt(x, y, P.ang, -2 - P.lean * 3, -15 + sq * 3);
  if (view.pupOn(M)) {
    const o = { key, state: P.gr ? 'crouch' : 'air', vy: P.vy, face: 'right', rot: -P.ang + P.lean * 0.35, head: 1.5, alpha: blink, shadow: false, squash: [1 + sq * 0.15, 1 - sq * 0.2] };
    if (!view.puppet(cs[i], fx, fy, 40, o)) view.portraitAt(cs[i], fx, fy - 14, 18, col, false, blink);
  }
  // ses touches, juste devant sa moto
  view.hint(W, M, i, x + 44, y - 58, [['A', 'gaz'], ['lr', 'pencher']], { align: 'left' });
  // l'échappement, les gaz
  if (P.gas && P.gr && (X.ex[i] -= X.dt) <= 0) {
    X.ex[i] = 0.07;
    const [ex, ey] = bikePt(x, y, P.ang, -17, -10);
    view.burst(ex, ey, 1, ['#8a8098', '#5a5068', '#c8c0d0'], { shape: 'dot', dir: Math.PI + 0.3, spread: 0.6, speed: 40, up: 15, g: -20, life: 0.45, size: 3 });
  }
  // l'aide en l'air : la pente où il va retomber (une petite flèche), rouge si l'angle est mauvais
  if (!P.gr && P.air > 6) {
    let lx = P.x, ly = P.y, vy = P.vy;
    for (let f = 0; f < 90; f++) { vy -= C.G; lx += P.vx; ly += vy; if (ly <= trialsH(M.g, lx)) break; }
    let d = P.ang - trialsSlopeS(M.g, lx); d -= Math.round(d / 6.2832) * 6.2832;
    const bad = Math.abs(d) > C.CRASH_ANG * 0.8;
    const ax = sxOf(X, i, lx), ay = syOf(X, i, trialsH(M.g, lx));
    if (ax < 640 + view.ox) {
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 14); ctx.fillStyle = bad ? '#ff3a3a' : '#7cff8a';
      ctx.beginPath(); ctx.moveTo(ax, ay - 3); ctx.lineTo(ax - 5, ay - 11); ctx.lineTo(ax + 5, ay - 11); ctx.fill(); ctx.globalAlpha = 1;
    }
    // trop penché : une grosse flèche du côté où pencher, avec SA touche, qui clignote
    if (Math.abs(d) > C.CRASH_ANG * 0.55) {
      const dir = d > 0 ? 1 : -1, ax2 = x + dir * 46, ay2 = y - 30, on = Math.sin(t * 20) > -0.2;
      ctx.save(); ctx.globalAlpha = on ? 1 : 0.5; ctx.translate(ax2, ay2); ctx.scale(dir, 1);
      ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(0, -15); ctx.lineTo(0, -7); ctx.lineTo(-14, -7); ctx.lineTo(-14, 7); ctx.lineTo(0, 7); ctx.lineTo(0, 15); ctx.fill();
      ctx.fillStyle = '#ff3a3a'; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(2, -10); ctx.lineTo(2, -4); ctx.lineTo(-11, -4); ctx.lineTo(-11, 4); ctx.lineTo(2, 4); ctx.lineTo(2, 10); ctx.fill();
      ctx.restore();
      if (!W.fighters[slot].bot) view.text(sideKey(view, M, i, dir), ax2 + dir * 4, ay2 - 22, 12, '#ffffff', { mono: true });
      view.text('PENCHE !', x, y - 82, 11, '#ff6a6a', { mono: true, alpha: on ? 1 : 0.6 });
    }
  }
  // un humain arrêté au sol : « TIENS J ! » (les gaz)
  if (P.gr && !P.gas && P.vx < 1 && M.ph === 'play' && M.t > 40 && !W.fighters[slot].bot) view.text(`▲ TIENS ${view.keyName(M, i, 'A')} = GAZ !`, x, y + 22, 13, '#ffe24a', { mono: true, alpha: 0.75 + 0.25 * Math.sin(t * 12) });
}
// la touche pour pencher d'un côté (-1 en arrière ◀, 1 en avant ▶), pour l'appareil du joueur i
function sideKey(view, M, i, dir) {
  const n = view.keyName(M, i, 'lr'), parts = n.split(' ');
  if (parts.length === 2 && parts[0].length <= 2) return parts[dir < 0 ? 0 : 1];
  return dir < 0 ? '◀' : '▶';
}

export default {
  title: 'TRIAL DU CIMETIÈRE', color: '#c86a2a', icon: '🏍️',
  tags: false, // (chaque ligne porte l'étiquette de son pilote)
  goal: 'Garde le doigt sur le gaz, et penche la moto pour retomber à plat !',
  keys: [['A', 'tenir = gaz'], ['lr', 'pencher']],
  ach: [['Roi de la bécane', 'Motocross des morts', 'Sans les mains', 'Trial d\'or'], ['Gamelle éternelle', 'Embrasseur de tombes', 'Permis à points (zéro)', 'Piéton du cimetière']],
  news: (L, d) => `${L} SE VAUTRE SUR UNE TOMBE EN MOTO : ${d} % ET UN RÉTRO CASSÉ`,

  warm(view, W, M) {
    const cs = chars(W, M);
    for (let i = 0; i < 2; i++) for (const s of ['crouch', 'air', 'tumble', 'down']) view.puppet(cs[i], -9999, -9999, 10, { key: view.pkey(W, M, i), state: s, face: 'right', head: 1.5, shadow: false });
  },

  draw(view, W, M, dt) {
    const ctx = view.g, g = M.g;
    if (!g || !g.p) return;
    const X = xs(view, M), t = view.time, slots = [M.a, M.v], cs = chars(W, M), L = -view.ox, R = 640 + view.ox;
    X.dt = dt;
    ctx.fillStyle = '#0b0610'; ctx.fillRect(L, -view.oy, R - L, 360 + view.oy * 2);
    for (let i = 0; i < 2; i++) {
      const P = g.p[i], slot = slots[i], [y0, y1] = lane(i);
      // la caméra : en avance quand ça va vite ; pendant la chute, elle suit le pilote qui valse
      const tx = (P.cr > 0 && X.rag[i] ? X.rag[i].x : P.x) - PX - Math.max(0, P.vx) * 12;
      X.cx[i] += (tx - X.cx[i]) * (1 - Math.exp(-dt * 6));
      X.cy[i] += (P.y + (P.gr ? 0 : 10) - X.cy[i]) * (1 - Math.exp(-dt * 4));
      X.wh[i] += P.vx * dt * 60 / 7;
      X.sq[i] = Math.max(0, X.sq[i] - dt * 4);
      const Rg = X.rag[i];
      if (Rg && !Rg.ground) {
        Rg.vy -= C.G * dt * 60; Rg.x += Rg.vx * dt * 60; Rg.y += Rg.vy * dt * 60; Rg.r += Rg.vr * dt;
        const hh = trialsH(g, Rg.x);
        if (Rg.y <= hh) { Rg.y = hh; if (Rg.vy < -3) { Rg.vy = -Rg.vy * 0.35; Rg.vx *= 0.6; view.burst(sxOf(X, i, Rg.x), syOf(X, i, hh), 6, ['#5a3a2a', '#8a6a4a'], { shape: 'sq', speed: 70, up: 40, size: 3, life: 0.4 }); } else { Rg.ground = 1; Rg.r = 0; } }
      }
      ctx.save(); ctx.beginPath(); ctx.rect(L, y0, R - L, y1 - y0); ctx.clip();
      drawSky(ctx, view, i, X, t);
      drawGround(ctx, view, g, i, X, t);
      // le fantôme de l'autre moto
      const O = g.p[1 - i], ox = sxOf(X, i, O.x);
      if (ox > L - 30 && ox < R + 30 && !O.cr) {
        drawBike(ctx, ox, syOf(X, i, O.y), O.ang, COLORS[slots[1 - i]], X.wh[1 - i], 0.3);
        view.text(view.pname(slots[1 - i]), ox, syOf(X, i, O.y) - 32, 8, COLORS[slots[1 - i]], { mono: true, alpha: 0.6 });
      } else if (!O.cr && O.x > P.x) view.text(`${view.pname(slots[1 - i])} ▶`, R - 8, y1 - 14, 9, COLORS[slots[1 - i]], { align: 'right', mono: true, alpha: 0.8 });
      drawRider(view, W, M, X, i, P, t, cs, slot);
      ctx.restore();
      // le cadre de la ligne, à la couleur du joueur
      ctx.strokeStyle = '#0b0610'; ctx.lineWidth = 4; ctx.strokeRect(L + 2, y0, R - L - 4, y1 - y0);
      ctx.strokeStyle = COLORS[slot]; ctx.lineWidth = 2; ctx.strokeRect(L + 3, y0 + 1, R - L - 6, y1 - y0 - 2);
      // qui, combien
      const sc = score(g, i), lead = g.lead === i;
      if (i === 0) {
        const w = view.who(W, M, 0, 10, y0 + 6);
        view.text(`${sc} m`, 20 + w, y0 + 18, 18, '#ffffff', { align: 'left', mono: true });
        if (P.bon) view.text(`dont ${P.bon} de saltos`, 20 + w, y0 + 33, 8, '#ffe24a', { align: 'left', mono: true });
        if (lead) view.text('👑', 22, y0 + 4, 13, '#fff', { stroke: false });
      } else {
        const w = view.who(W, M, 1, 630, y0 + 6, { align: 'right' });
        view.text(`${sc} m`, 620 - w, y0 + 18, 18, '#ffffff', { align: 'right', mono: true });
        if (P.bon) view.text(`dont ${P.bon} de saltos`, 620 - w, y0 + 33, 8, '#ffe24a', { align: 'right', mono: true });
        if (lead) view.text('👑', 618, y0 + 4, 13, '#fff', { stroke: false });
      }
      if (P.fin) view.text('🏁 ARRIVÉ !', 320, y0 + 60, 26, '#ffe24a', { mono: true });
    }
    // la course : les deux têtes sur une barre, entre les deux lignes
    const bx0 = 40, bx1 = 600;
    ctx.fillStyle = '#3a2a4a'; ctx.fillRect(bx0, BAR_Y - 1, bx1 - bx0, 3);
    for (let k = 0; k < 2; k++) {
      const P = g.p[k], u = Math.min(1, P.best / C.FIN), x = bx0 + (bx1 - bx0) * u;
      ctx.fillStyle = COLORS[slots[k]]; ctx.fillRect(bx0, BAR_Y - 1 + (k ? 1 : -1), x - bx0, 2);
      view.portraitAt(cs[k], x, BAR_Y + (k ? 5 : -5), 8, COLORS[slots[k]], false);
    }
    view.text('🏁', bx1 + 12, BAR_Y, 10, '#fff', { stroke: false });
    view.timer(M, 320, 22);
    if (M.ph === 'outro' && X.end && X.end.l >= 0) {
      const l = X.end.l, [y0] = lane(l);
      view.text('🪦 ICI REPOSE SON PERMIS', 320, y0 + 80, 16, '#c8c0d0', { mono: true, alpha: 0.9 });
    }
  },

  onEvent(view, ev, W, M) {
    if (!M || M.kind !== 'trials' || !M.g || !M.g.p) return;
    if (!ev.type.startsWith('mgTrials') && ev.type !== 'mgEnd' && ev.type !== 'mgGo') return;
    const A = view.audio, X = xs(view, M), g = M.g;
    const i = ev.p, P = i === 0 || i === 1 ? g.p[i] : null;
    const px = P ? sxOf(X, i, P.x) : 320, py = P ? syOf(X, i, P.y) : 180, pan = i === 0 ? -0.3 : i === 1 ? 0.3 : 0;
    switch (ev.type) {
      case 'mgGo':
        view.sticker('GAZ ! 🏍️', 320, 196, { size: 30, color: '#0b0610', bg: '#ffb020', life: 0.9 });
        if (A) { A.sfx('zip', -0.3, 0.6, 1); A.sfx('zip', 0.3, 0.6, 2); A.say('Plein gaz !', 0.55, 1.2); }
        break;
      case 'mgTrialsLand': {
        X.sq[i] = Math.min(1, 0.4 + ev.air / 60);
        if (A) A.sfx(ev.hard ? 'thud' : 'land', pan, 0.6);
        view.burst(px, py, 8 + (ev.air / 4 | 0), ['#8a6a4a', '#5a3a2a', '#c8a080'], { shape: 'sq', dir: -Math.PI / 2, spread: 2.8, speed: 90, up: 20, size: 3, life: 0.5 });
        if (ev.air > 34) { view.sticker(view.pick(LAND_W), px + 30, py - 50, { size: 13, color: '#0b0610', bg: '#7cff8a', life: 0.6 }); view.jolt(0.25, 0.02); }
        break;
      }
      case 'mgTrialsFlip': {
        const n = Math.abs(ev.n);
        X.sq[i] = 1;
        view.sticker(`${n > 1 ? `${n}× ` : ''}SALTO ${ev.n > 0 ? 'ARRIÈRE' : 'AVANT'} ! +${n * C.SALTO} m`, px + 40, py - 60, { size: 18, color: '#ffffff', bg: '#ff3a8a', life: 1.1 });
        view.burst(px, py - 20, 30, ['#ffe24a', '#ff8ad0', '#7ad8ff', '#ffffff'], { shape: 'star', speed: 200, size: 5, life: 0.8 });
        view.jolt(0.5, 0.06, '#fff6c0', 0.2); view.hype(0.6); view.lines(0.4);
        if (A) { A.sfx('airhorn', pan, 0.6); A.sfx('kickflip', pan, 0.7); A.crowd(); if (view.time - X.sayT > 2) { X.sayT = view.time; A.say('Quel salto !', 0.6, 1.2); } }
        break;
      }
      case 'mgTrialsCrash': {
        X.wreck[i] = { x: ev.x, y: ev.y, a: ev.a + 1.6 };
        X.rag[i] = { x: ev.x, y: ev.y + 14, vx: 1 + ev.v * 0.5, vy: 3 + ev.v * 0.4, r: 0, vr: 9 + ev.v * 2, ground: 0 };
        if (A) { A.sfx('boom', pan, 0.5); A.sfx('punchHeavy', pan, 0.7); A.sfx('glass', pan, 0.4); if (view.time - X.sayT > 1.6) { X.sayT = view.time; A.say(view.pick(SAY_CRASH), 0.5, 1.15); } }
        view.sticker(view.pick(CRASH_W), px + 20, py - 50, { size: 22, color: '#ffffff', bg: '#d02a2a', life: 0.9 });
        view.burst(px, py - 6, 26, ['#ff8a1a', '#ffe24a', '#ffffff', '#5a5068'], { shape: 'sq', speed: 220, up: 60, size: 4, life: 0.7 });
        view.burst(px, py - 10, 4, ['#fff'], { shape: 'txt', ch: view.pick(['💥', '⭐', '🔩']), speed: 160, up: 80, size: 8, life: 0.9 });
        view.jolt(0.7, 0.06, '#ff3a3a', 0.25);
        break;
      }
      case 'mgTrialsBack':
        X.rag[i] = null; X.wreck[i] = null;
        if (A) { A.sfx('respawn', pan, 0.5); A.sfx('zip', pan, 0.4, 3); }
        view.burst(px, py - 14, 14, ['#7cff8a', '#ffffff', COLORS[i === 0 ? M.a : M.v]], { shape: 'star', speed: 130, size: 4, life: 0.6 });
        view.sticker(view.pick(['ON REMONTE !', 'ALLEZ !', 'ÇA REPART !']), px + 20, py - 44, { size: 12, color: '#ffffff', bg: '#2a9a5a', life: 0.7 });
        break;
      case 'mgTrialsWall':
        if (A) A.sfx('thud', pan, 0.6);
        view.burst(px + 16, py - 10, 10, ['#ffffff', '#ffe24a'], { shape: 'star', dir: Math.PI, spread: 1.4, speed: 120, size: 3, life: 0.4 });
        view.sticker('BONK !', px + 20, py - 40, { size: 13, color: '#0b0610', bg: '#ffe24a', life: 0.5 });
        break;
      case 'mgTrialsLead':
        view.sticker('👑 EN TÊTE !', i === 0 ? 120 : 520, lane(i)[0] + 56, { size: 13, color: '#0b0610', bg: '#ffe24a', life: 0.7 });
        if (A) { A.sfx('countHi', pan, 0.35); if (view.time - X.sayT > 2.5) { X.sayT = view.time; A.say(`${view.pname(i === 0 ? M.a : M.v)} passe devant !`, 0.55, 1.2); } }
        break;
      case 'mgTrialsFinish':
        view.sticker('🏁 ARRIVÉE !', 320, lane(i)[0] + 60, { size: 26, color: '#0b0610', bg: '#ffe24a', life: 1.2 });
        view.confetti(50); view.hype(0.8); view.jolt(0.5, 0.06, '#ffffff', 0.25);
        if (A) { A.sfx('airhorn', pan, 0.7); A.crowd(); }
        break;
      case 'mgEnd': {
        const l = ev.l === M.a ? 0 : ev.l === M.v ? 1 : -1;
        X.end = { l };
        if (l >= 0) view.emojiRain(['🏍️', '🪦', '💨', '🏁'], 10);
        break;
      }
      default: break;
    }
  },
};
