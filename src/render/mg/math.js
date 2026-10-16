// Calcul mental (math), l'affichage : une salle de classe la nuit, le tableau noir au milieu (l'opération à la craie), et
// chaque joueur (son vrai perso en 3D, grosse tête qui réfléchit) entouré de ses trois bulles de réponse : ◀ à gauche,
// ▲ au-dessus, ▶ à droite, à sa couleur. Juste : la bulle explose, il exulte ; faux : la bulle se brise, la tête tourne.
import { COLORS } from '../../sim/constants.js';

const CHALK = '#f4f0e0', BOARD = '#1f4a32', GOOD = '#3cff7a', BAD = '#ff3a4a';
const ARW = ['◀', '▲', '▶'];
// les touches des trois bulles pour le joueur i, selon son appareil (Clavier 1 : Q Z D, Clavier 2 : ← ↑ →, manette : ◀ ▲ ▶)
export function dirKeys(view, W, M, i) {
  const up = W.fighters[i === 0 ? M.a : M.v].bot ? '' : view.keyName(M, i, 'up');
  return up === 'Z' ? ['Q', 'Z', 'D'] : up === '↑' ? ['←', '↑', '→'] : ARW;
}
const X = (i) => (i === 0 ? 150 : 490);
const bub = (i, d) => [X(i) + (d - 1) * 86, d === 1 ? 168 : 226];
const OPW = { '+': 'plus', '-': 'moins', '×': 'fois' };
const YES = ['CERVEAU 🧠', 'EINSTEIN', 'BOSS DES MATHS', 'BON ÉLÈVE', 'TABLEAU D\'HONNEUR', 'LA CALCULETTE'];
const NO = ['RETOUR EN CP', 'T\'AS SÉCHÉ ?', 'ZÉRO POINTÉ', 'CALCULETTE CASSÉE', 'BONNET D\'ÂNE', 'RECALCULE'];
const SAYNO = ['Faux !', 'Raté !', 'Non non non !', 'Zéro !'];

function ensure(xs) {
  if (xs.on) return xs;
  xs.on = 1; xs.re = [null, null]; xs.fl = [[0, 0, 0], [0, 0, 0]]; xs.flc = [['', '', ''], ['', '', '']]; xs.shown = [0, 0]; xs.qpop = 0; xs.late = 0;
  return xs;
}

export default {
  title: 'CALCUL MENTAL', color: '#7ad8ff', icon: '🧮',
  goal: 'Choisis la bonne réponse avant l\'autre !',
  keys: [['dirs', 'choisis ta bulle']],
  ach: [['Tableau d\'honneur', 'Calculatrice humaine', 'Prix Nobel de la crypte', 'Premier de la classe'], ['Bonnet d\'âne', 'Recalé au brevet', 'Compte sur ses doigts', 'Redouble le CP']],
  news: (L, d) => `${L} CROYAIT QUE 7 × 8 = 54 : ${d} % DE MALUS`,

  draw(view, W, M, dt) {
    const ctx = view.g, g = M.g, xs = ensure(view.xs), t = view.time;
    const L = -view.ox, R = 640 + view.ox, T = -view.oy, B = 360 + view.oy;
    xs.qpop = Math.max(0, xs.qpop - dt * 3); xs.late = Math.max(0, xs.late - dt);
    // la classe : mur sombre, lattes du parquet
    ctx.fillStyle = '#1a1424'; ctx.fillRect(L, T, R - L, B - T);
    ctx.fillStyle = '#231a30'; for (let k = 0; k < 8; k++) ctx.fillRect(L + k * 90, T, 44, 280 - T);
    ctx.fillStyle = '#3a2618'; ctx.fillRect(L, 284, R - L, B - 284);
    ctx.fillStyle = '#2a1a10'; for (let k = 0; k < 14; k++) ctx.fillRect(L + k * 60 + (k % 2) * 20, 284, 3, B - 284);
    // le tableau noir et la question
    const q = g.q, sc = 1 + xs.qpop * 0.25;
    ctx.fillStyle = '#5a3a1a'; ctx.fillRect(196, 40, 248, 92);
    ctx.fillStyle = BOARD; ctx.fillRect(202, 46, 236, 80);
    ctx.fillStyle = '#8a6a3a'; ctx.fillRect(196, 130, 248, 5);
    ctx.fillStyle = CHALK; ctx.fillRect(250, 128, 14, 3); ctx.fillStyle = '#ff8ad0'; ctx.fillRect(272, 128, 10, 3);
    if (q && M.ph === 'play') {
      const shown = g.ph === 'gap' && g.n > 0;
      view.text(`QUESTION ${g.n}`, 320, 58, 9, '#a8c8a8', { mono: true, stroke: false });
      ctx.save(); ctx.translate(320, 94); ctx.scale(sc, sc);
      view.text(`${q.a} ${q.op} ${q.b} = ${shown ? q.ans : '?'}`, 0, 4, 36, shown ? (g.last >= 0 ? GOOD : '#ffd23a') : CHALK, { stroke: false });
      ctx.restore();
      // le temps qui reste pour cette question
      if (g.ph === 'q') { const left = Math.max(0, 1 - g.t / 300); ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(214, 116, 212, 4); ctx.fillStyle = left > 0.3 ? CHALK : BAD; ctx.fillRect(214, 116, 212 * left, 4); }
    }
    view.timer(M, 320, 30);
    for (let i = 0; i < 2; i++) side(view, W, M, g, xs, i, t, dt);
  },

  onEvent(view, ev, W, M) {
    const A = view.audio, xs = ensure(view.xs);
    if (!M || !ev.type.startsWith('mgMath')) return;
    const g = M.g;
    if (ev.type === 'mgMathQ') {
      xs.qpop = 1; xs.fl = [[0, 0, 0], [0, 0, 0]];
      view.burst(320, 94, 10, [CHALK, '#ffffff'], { shape: 'dot', speed: 120, size: 3, life: 0.5 });
      if (A) { A.sfx('blip', 0, 0.5, 2 + Math.min(4, g.n)); A.sfx('whoosh', 0, 0.25); if (g.q) A.say(`${g.q.a} ${OPW[g.q.op]} ${g.q.b}`, 0.5, 1.35); }
    } else if (ev.type === 'mgMathGood') {
      const i = ev.p, slot = i === 0 ? M.a : M.v, [bx, by] = bub(i, ev.d);
      xs.fl[i][ev.d] = 1; xs.flc[i][ev.d] = GOOD; xs.re[i] = { k: 'good', t0: view.time };
      view.burst(bx, by, 26, [GOOD, '#ffffff', COLORS[slot], '#ffd23a'], { shape: 'star', speed: 260, size: 5 });
      view.burst(bx, by, 4, ['#fff'], { shape: 'txt', ch: view.pick(['🧠', '✨', '💯']), speed: 150, up: 120, size: 11, life: 1 });
      view.sticker(`+${ev.pts}`, X(i), 106, { size: 18, color: '#ffffff', bg: COLORS[slot], life: 0.8, rot: 0 });
      view.sticker(ev.f < 40 ? '⚡ ÉCLAIR' : view.pick(YES), X(i), 290, { size: 14, color: '#0b0610', bg: GOOD, life: 0.9 });
      if (ev.st === 3) { view.sticker('SÉRIE x3 🔥', 320, 160, { size: 16, color: '#ffffff', bg: '#ff3a3a', life: 1 }); view.hype(0.5); }
      if (ev.both) view.sticker('EX AEQUO !', 320, 190, { size: 16, color: '#ffffff', bg: '#7a3aff', life: 0.9 });
      view.jolt(0.35, 0.04, '#c0ffd0', 0.15);
      if (A) { A.sfx('cash', i ? 0.4 : -0.4, 0.6); A.sfx('hitmark', 0, 0.5); A.sfx('pop', i ? 0.4 : -0.4, 0.6, 3); if (ev.st >= 3) A.sfx('airhorn', 0, 0.35); }
    } else if (ev.type === 'mgMathWrong') {
      const i = ev.p, [bx, by] = bub(i, ev.d);
      xs.fl[i][ev.d] = 1; xs.flc[i][ev.d] = BAD; xs.re[i] = { k: 'bad', t0: view.time };
      view.burst(bx, by, 16, ['#ffffff', BAD, '#a8a8b8'], { speed: 200, size: 5, life: 0.6 });
      view.burst(X(i), 196, 3, ['#fff'], { shape: 'txt', ch: '💫', speed: 80, up: 40, size: 10, life: 0.9 });
      view.sticker(view.pick(NO), X(i), 290, { size: 14, color: '#ffffff', bg: BAD, life: 0.9 });
      view.jolt(0.5, 0.03, '#ff2020', 0.2);
      if (A) { A.sfx('error', i ? 0.4 : -0.4, 0.6); A.sfx('glass', i ? 0.4 : -0.4, 0.4); A.sfx('wobble', 0, 0.4); if (Math.random() < 0.5) A.say(view.pick(SAYNO), 0.6, 1.3); }
    } else if (ev.type === 'mgMathLate') {
      xs.late = 1;
      view.sticker(view.pick(['TROP LENTS 🐌', 'ÇA FAISAIT ' + ev.ans + ' !', 'Y A QUELQU\'UN ?']), 320, 168, { size: 16, color: '#ffffff', bg: '#5a1030', life: 1 });
      if (A) { A.sfx('thud', 0, 0.5); A.sfx('sob', 0, 0.3); }
    }
  },
};

// la moitié d'un joueur : son perso au milieu de ses trois bulles, son score, son étiquette
function side(view, W, M, g, xs, i, t, dt) {
  const ctx = view.g, slot = i === 0 ? M.a : M.v, col = COLORS[slot], P = g.p[i], cx = X(i), q = g.q;
  const lock = P.lock > 0, re = xs.re[i], rt = re ? t - re.t0 : 99, K = dirKeys(view, W, M, i);
  xs.shown[i] += (P.s - xs.shown[i]) * Math.min(1, dt * 10);
  // le perso
  let o;
  if (M.ph === 'outro') o = P.s >= g.p[1 - i].s ? { emote: 'win' } : { emote: 'sob' };
  else if (re && re.k === 'good' && rt < 1.1) o = { emote: 'cheer', emoteSpeed: 1.3 };
  else if (lock) o = { state: 'dizzy' };
  else if (re && re.k === 'bad' && rt < 0.3) o = { state: 'hitstun', kb: 120 };
  else o = { state: 'idle' };
  const head = 1.6 + (re && rt < 0.5 ? (0.5 - rt) * 1.2 : 0) + (g.ph === 'q' && !lock ? Math.sin(t * 6 + i) * 0.04 : 0);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(cx, 318, 40, 8, 0, 0, Math.PI * 2); ctx.fill();
  view.puppet(W.fighters[slot].char, cx, 318, 112, { ...o, key: 'mth' + i, face: i === 0 ? 'three' : 'threeL', head });
  // il réfléchit : des petites bulles de pensée ; bloqué : des étoiles
  if (g.ph === 'q' && !lock && M.ph === 'play') for (let k = 0; k < 3; k++) { ctx.fillStyle = `rgba(255,255,255,${0.25 + 0.2 * Math.sin(t * 5 + k)})`; ctx.beginPath(); ctx.arc(cx + 22 + k * 7, 210 - k * 9, 2 + k, 0, Math.PI * 2); ctx.fill(); }
  if (lock) view.text('🌀', cx, 196 + Math.sin(t * 10) * 3, 18, '#fff', { stroke: false });
  // les trois bulles
  for (let d = 0; d < 3; d++) {
    const [bx, by] = bub(i, d), fl = xs.fl[i][d];
    xs.fl[i][d] = Math.max(0, fl - dt * 1.6);
    const right = q && g.ph === 'gap' && d === q.ok && M.ph === 'play';
    const pop = 1 + (fl > 0.6 ? (fl - 0.6) * 0.8 : 0) + (right ? 0.08 * Math.sin(t * 12) : 0);
    const sh = fl > 0 && xs.flc[i][d] === BAD ? (Math.random() - 0.5) * fl * 8 : 0;
    ctx.save(); ctx.translate(bx + sh, by); ctx.scale(pop, pop);
    ctx.globalAlpha = lock ? 0.45 : 1;
    ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.arc(0, 0, 33, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = fl > 0 ? xs.flc[i][d] : right ? '#d8ffe0' : '#f4f0ff'; ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 27, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
    if (q && M.ph === 'play') view.text(String(q.ch[d]), 0, 9, String(q.ch[d]).length > 2 ? 22 : 27, '#0b0610', { mono: true, stroke: false, alpha: lock ? 0.5 : 1 });
    ctx.restore();
    // sa touche (la vraie : Q Z D, ← ↑ →, ou le stick), une touche de clavier à la couleur du joueur, qui pulse quand
    // c'est à lui de répondre
    const ax = bx + (d === 0 ? -44 : d === 2 ? 44 : 0), ay = by + (d === 1 ? -44 : 0);
    const go = g.ph === 'q' && !lock && M.ph === 'play', kz = go ? 1 + 0.12 * Math.max(0, Math.sin(t * 9 + d)) : 1;
    ctx.save(); ctx.translate(ax, ay); ctx.scale(kz, kz); ctx.globalAlpha = lock ? 0.45 : 1;
    ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.roundRect(-14, -13, 28, 27, 5); ctx.fill();
    ctx.fillStyle = '#f4ead6'; ctx.beginPath(); ctx.roundRect(-12, -11, 24, 21, 4); ctx.fill();
    ctx.fillStyle = col; ctx.fillRect(-12, 7, 24, 4);
    ctx.restore();
    view.text(K[d], ax, ay + 4, K[d].length > 1 ? 10 : 15, '#0b0610', { mono: true, stroke: false, alpha: lock ? 0.5 : 1 });
  }
  // comment jouer, là où il joue
  view.hint(W, M, i, cx, 274, [['dirs', 'choisis ta bulle']]);
  // le score et l'étiquette
  view.text(String(Math.round(xs.shown[i])), cx + (i === 0 ? -112 : 112), 132, 24, col, { mono: true });
  view.text('POINTS', cx + (i === 0 ? -112 : 112), 146, 8, '#c8c0d8', { mono: true, stroke: false });
  view.who(W, M, i, cx, 326, { align: 'center' });
}
