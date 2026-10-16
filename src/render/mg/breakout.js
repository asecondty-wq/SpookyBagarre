// Casse-briques de BIDO (breakout), l'affichage : deux terrains côte à côte (J1 à gauche, J2 à droite, cadres et raquettes
// à leur couleur), le même mur de briques (dures en métal, en or qui brillent), la balle et sa traînée. Dehors, de chaque
// côté, BIDO en vrai modèle 3D (grosse tête) qui encourage ; à chaque série de 3 briques, il envoie son poing 👊 casser une
// brique (POW !).
import { BK, brickW } from '../../sim/mg/breakout.js';
import { COLORS } from '../../sim/constants.js';

const INK = '#0b0610';
const FX = [90, 330], FY = 56;
const BIDO_X = [44, 596];
const ROWCOL = ['#ff4a6a', '#ff8a3a', '#ffd23a', '#3bdc5a', '#3bc8ff', '#a07aff'];
const POW = ['POW !', 'BAM !', 'PAF !', 'KRAK !', 'BOUM !'];
const CHEER = ['ALLEZ BB !', 'CASSE TOUT !', 'ENCORE !', 'LES GAINS !', 'J\'ADORE !'];

function S(view) {
  const xs = view.xs;
  if (!xs.on) { xs.on = 1; xs.tr = [[], []]; xs.fist = []; xs.sc = [0, 0]; xs.pop = [0, 0]; xs.fl = [0, 0]; xs.say = [null, null]; xs.sh = [0, 0]; }
  return xs;
}
const brickXY = (i, k) => [FX[i] + (k % BK.COLS) * brickW, FY + BK.BY + Math.floor(k / BK.COLS) * BK.BH];

function drawField(view, W, M, g, i, xs, dt) {
  const ctx = view.g, P = g.p[i], slot = i === 0 ? M.a : M.v, col = COLORS[slot], t = view.time;
  const x0 = FX[i] + (Math.random() - 0.5) * xs.sh[i] * 6, y0 = FY;
  ctx.fillStyle = INK; ctx.fillRect(x0 - 6, y0 - 6, BK.FW + 12, BK.FH + 10);
  ctx.fillStyle = col; ctx.fillRect(x0 - 4, y0 - 4, BK.FW + 8, BK.FH + 6);
  const bg = ctx.createLinearGradient(0, y0, 0, y0 + BK.FH); bg.addColorStop(0, '#1a1030'); bg.addColorStop(1, '#2e1838');
  ctx.fillStyle = bg; ctx.fillRect(x0, y0, BK.FW, BK.FH);
  if (xs.fl[i] > 0) { ctx.fillStyle = `rgba(255,40,40,${xs.fl[i] * 0.35})`; ctx.fillRect(x0, y0, BK.FW, BK.FH); }
  // les briques
  for (let k = 0; k < P.b.length; k++) {
    const v = P.b[k];
    if (!v) continue;
    const r = Math.floor(k / BK.COLS), bx = x0 + (k % BK.COLS) * brickW, by = y0 + BK.BY + r * BK.BH;
    ctx.fillStyle = INK; ctx.fillRect(bx, by, brickW - 1, BK.BH - 1);
    if (v === 4) {
      const sh = 0.5 + 0.5 * Math.sin(t * 6 + k);
      ctx.fillStyle = `rgb(255,${200 + sh * 40 | 0},${40 + sh * 80 | 0})`; ctx.fillRect(bx + 1, by + 1, brickW - 3, BK.BH - 3);
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(bx + 2 + ((t * 30 + k * 7) % (brickW - 6)), by + 2, 2, BK.BH - 5);
    } else if (v === 2) {
      ctx.fillStyle = '#8a8aa0'; ctx.fillRect(bx + 1, by + 1, brickW - 3, BK.BH - 3);
      ctx.fillStyle = '#c8c8d8'; ctx.fillRect(bx + 1, by + 1, brickW - 3, 2);
      ctx.fillStyle = INK; ctx.fillRect(bx + 3, by + 4, 1.5, 1.5); ctx.fillRect(bx + brickW - 6, by + 4, 1.5, 1.5);
    } else {
      ctx.fillStyle = ROWCOL[r % ROWCOL.length]; ctx.fillRect(bx + 1, by + 1, brickW - 3, BK.BH - 3);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(bx + 1, by + 1, brickW - 3, 2);
    }
  }
  // la balle et sa traînée
  const tr = xs.tr[i];
  tr.push([P.bx, P.by]); if (tr.length > 7) tr.shift();
  for (let n = 0; n < tr.length - 1; n++) { ctx.globalAlpha = (n + 1) / tr.length * 0.4; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x0 + tr[n][0], y0 + tr[n][1], BK.R * (0.5 + n / tr.length * 0.5), 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x0 + P.bx, y0 + P.by, BK.R + 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x0 + P.bx, y0 + P.by, BK.R, 0, Math.PI * 2); ctx.fill();
  if (!P.live && M.ph === 'play') view.text(P.launches ? 'ATTENTION…' : 'ÇA PART !', x0 + BK.FW / 2, y0 + BK.PY - 30, 11, '#ffffff', { mono: true, alpha: 0.6 + 0.4 * Math.sin(t * 12) });
  // la raquette
  const px = x0 + P.px - BK.PW / 2, py = y0 + BK.PY;
  ctx.fillStyle = INK; ctx.fillRect(px - 2, py - 2, BK.PW + 4, BK.PH + 4);
  ctx.fillStyle = col; ctx.fillRect(px, py, BK.PW, BK.PH);
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(px + 2, py + 1, BK.PW - 4, 2);
  if (W.fighters[slot].bot || M.ph !== 'play') view.text(view.pname(slot), px + BK.PW / 2, py + 15, 8, col, { mono: true });
  else view.hint(W, M, i, x0 + BK.FW / 2, y0 + BK.FH - 13, [['lr', 'raquette']], { size: 0.9 });
  // le score, en haut du terrain
  xs.sc[i] += (P.s - xs.sc[i]) * 0.25; xs.pop[i] = Math.max(0, xs.pop[i] - dt * 4);
  const lead = P.s > g.p[1 - i].s;
  view.text(`🧱 ${Math.round(xs.sc[i])}`, x0 + BK.FW / 2, y0 + 18, 20 * (1 + xs.pop[i] * 0.4), lead ? '#ffd23a' : '#ffffff', { mono: true });
  if (lead) view.text('👑', x0 + BK.FW / 2 + 42, y0 + 12 + Math.sin(t * 6) * 2, 12, '#fff', { stroke: false });
  if (P.combo >= 2) view.text(`SÉRIE ${P.combo}`, i === 0 ? x0 + 6 : x0 + BK.FW - 6, y0 + 14, 9, '#ff9a3a', { align: i === 0 ? 'left' : 'right', mono: true });
}

// BIDO, dehors, à côté de chaque terrain
function drawBido(view, W, M, g, i, xs) {
  const P = g.p[i], x = BIDO_X[i], t = view.time;
  const o = { key: 'bkbido' + i, face: i === 0 ? 'three' : 'threeL', head: 1.9 };
  if (M.ph === 'outro') o.emote = P.s >= g.p[1 - i].s ? 'win' : 'sob';
  else if (!P.live && P.launches) o.emote = 'complain_01';
  if (view.pupOn(M) && !view.actor('bido', 2 + i, x, 268, 132, o)) view.portraitAt('bido', x, 200, 50, '#ff5a3a', i === 1);
  const s = xs.say[i];
  if (s && t - s.t < 1) view.text(s.txt, x, 108 - (t - s.t) * 10, 11, '#ffd23a', { mono: true, alpha: 1 - Math.max(0, (t - s.t - 0.7) / 0.3), maxW: 92 });
  view.who(W, M, i, i === 0 ? FX[0] - 8 : FX[1] + BK.FW + 8, 292, { align: i === 0 ? 'right' : 'left', size: 0.72 });
}

export default {
  title: 'CASSE-BRIQUES DE BIDO', color: '#ff5a3a', icon: '🧱',
  goal: 'Renvoie la balle avec ta raquette et casse plus de briques que l\'autre !',
  keys: [['lr', 'raquette']],
  puppets: ['bido'],
  ach: [['Démolisseur', 'Le poing de BIDO', 'Mur de Berlin', 'Raquette d\'or'], ['Passoire', 'Balle perdue', 'Mur intact', 'Raquette en mousse']],
  news: (L, d) => `${L} PERD SA BALLE TROIS FOIS : ${d} %, BIDO A DÛ TOUT CASSER À SA PLACE`,
  warm(view) { for (let i = 0; i < 2; i++) view.puppet('bido', -9999, -9999, 10, { key: 'bkbido' + i, shadow: false }); },

  draw(view, W, M, dt) {
    const ctx = view.g, g = M.g, xs = S(view), L = -view.ox, Rr = 640 + view.ox, T = -view.oy, B = 360 + view.oy, t = view.time;
    for (let i = 0; i < 2; i++) { xs.fl[i] = Math.max(0, xs.fl[i] - dt * 2.5); xs.sh[i] = Math.max(0, xs.sh[i] - dt * 3); }
    // la salle d'arcade
    const bg = ctx.createLinearGradient(0, T, 0, B); bg.addColorStop(0, '#20102a'); bg.addColorStop(1, '#0e0814');
    ctx.fillStyle = bg; ctx.fillRect(L, T, Rr - L, B - T);
    ctx.strokeStyle = 'rgba(255,90,58,0.12)'; ctx.lineWidth = 1;
    for (let k = 0; k < 12; k++) { const y = 270 + k * k * 1.6; ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(Rr, y); ctx.stroke(); }
    view.text('🧱 CASSE-BRIQUES DE BIDO', 320, T + 16, 17, '#ff5a3a', { title: true });
    view.timer(M, 320, T + 42);
    for (let i = 0; i < 2; i++) { drawField(view, W, M, g, i, xs, dt); drawBido(view, W, M, g, i, xs); }
    // les poings de BIDO en vol
    xs.fist = xs.fist.filter((f) => {
      const u = (t - f.t) / 0.22;
      if (u >= 1) return false;
      const x = f.x0 + (f.x1 - f.x0) * u, y = f.y0 + (f.y1 - f.y0) * u - Math.sin(u * Math.PI) * 30;
      view.text('👊', x, y, 22 + u * 8, '#fff', { stroke: false });
      return true;
    });
  },

  onEvent(view, ev, W, M) {
    if (!M || !ev.type.startsWith('mgBreak')) return;
    const A = view.audio, xs = S(view), i = ev.p, g = M.g, P = g.p[i], slot = i === 0 ? M.a : M.v, pan = i ? 0.4 : -0.4;
    switch (ev.type) {
      case 'mgBreakLaunch': if (A) A.sfx('zip', pan, 0.4); break;
      case 'mgBreakWall': if (A) A.sfx('blip', pan, 0.12, 1); break;
      case 'mgBreakPaddle': {
        const x = FX[i] + P.px, y = FY + BK.PY;
        view.burst(x, y, 5, [COLORS[slot], '#ffffff'], { shape: 'dot', speed: 80, size: 3, up: 50, life: 0.3 });
        if (A) A.sfx('hitS', pan, 0.35);
        break;
      }
      case 'mgBreakHit': {
        const [bx, by] = brickXY(i, ev.k), cx = bx + brickW / 2, cy = by + BK.BH / 2, r = Math.floor(ev.k / BK.COLS);
        xs.pop[i] = 1;
        if (ev.left) { view.burst(cx, cy, 6, ['#c8c8d8', '#ffffff'], { shape: 'sq', speed: 90, size: 3, life: 0.3 }); if (A) A.sfx('clink', pan, 0.5); break; }
        const c = ev.t === 4 ? '#ffd23a' : ev.t === 2 ? '#8a8aa0' : ROWCOL[r % ROWCOL.length];
        view.burst(cx, cy, ev.t === 4 ? 18 : 9, [c, '#ffffff'], { shape: 'sq', speed: ev.t === 4 ? 200 : 130, size: 4, life: 0.45, g: 300 });
        if (ev.t === 4) { view.floats.push({ text: '+3 💰', x: cx, y: cy - 6, t: 0, life: 0.8, color: '#ffd23a', size: 14 }); view.jolt(0.2, 0.02, '#ffd23a', 0.08); if (A) A.sfx('cash', pan, 0.6); }
        else if (A) A.sfx('glass', pan, 0.3, Math.min(6, ev.combo));
        break;
      }
      case 'mgBreakPunch': {
        const [bx, by] = brickXY(i, ev.k);
        xs.fist.push({ t: view.time, x0: BIDO_X[i], y0: 180, x1: bx + brickW / 2, y1: by + BK.BH / 2 });
        xs.say[i] = { txt: view.pick(CHEER), t: view.time };
        view.react(2 + i, { emote: 'victory_celebration', life: 0.9, pop: 0.35, hop: 0.08 });
        setPow(view, bx + brickW / 2, by + BK.BH / 2, i);
        if (A) { A.sfx('whoosh', pan, 0.5); A.sfx('punchHeavy', pan, 0.7); }
        break;
      }
      case 'mgBreakLose': {
        xs.fl[i] = 1; xs.sh[i] = 1; xs.pop[i] = 1;
        view.sticker(view.pick(['BALLE PERDUE 😱', 'OUPS !', 'LA PASSOIRE', 'RATÉ !']), FX[i] + BK.FW / 2, FY + 180, { size: 15, color: '#ffffff', bg: '#c01020', life: 0.8, rot: (Math.random() - 0.5) * 0.3 });
        view.floats.push({ text: `-${BK.LOSE}`, x: FX[i] + BK.FW / 2, y: FY + 210, t: 0, life: 0.8, color: '#ff4a4a', size: 16 });
        view.react(2 + i, { emote: 'angry_01', life: 0.8, shake: 4 });
        view.jolt(0.45, 0.04, '#ff2020', 0.18);
        if (A) { A.sfx('error', pan, 0.5); A.sfx('wobble', pan, 0.4); }
        break;
      }
      case 'mgBreakWave': {
        view.sticker('MUR CASSÉ ! UN AUTRE 🧱', FX[i] + BK.FW / 2, FY + 140, { size: 16, color: INK, bg: '#ffd23a', life: 1 });
        view.confetti(30); if (A) A.sfx('airhorn', pan, 0.5);
        break;
      }
      default: break;
    }
  },
};

// l'impact du poing de BIDO (un peu après le départ du poing)
function setPow(view, x, y, i) {
  view.sticker(view.pick(POW), x, y - 4, { size: 18, color: '#ffffff', bg: '#ff3a3a', life: 0.55, rot: (i ? 0.2 : -0.2) });
  view.burst(x, y, 22, ['#ffd23a', '#ff5a3a', '#ffffff'], { shape: 'star', speed: 260, size: 5, life: 0.5 });
  view.jolt(0.35, 0.05, '#ffd23a', 0.12);
}
