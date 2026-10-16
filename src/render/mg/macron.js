// Le 49.3 (macron), l'affichage : l'hémicycle la nuit, le président (le vrai Micron en 3D, grosse tête) à son pupitre
// au milieu ; chaque joueur a son curseur (à sa couleur) qui fait des allers-retours tout seul : le chiffre en gros, une
// loupe sur ±3 autour (les dixièmes, le 49.3 marqué en or), la réglette de 0 à 100 ; « APPUIE SUR J ! » quand il approche. Figé : un tampon (ADOPTÉ, AMENDÉ, MOTION DE CENSURE) ; pile 49.3 : « 49.3 ! »
// en énorme, le président est mort de rire.
import { COLORS } from '../../sim/constants.js';
import { MAC } from '../../sim/mg/macron.js';

const GOLD = '#ffd23a';
const HW = 230, TY = 216, LY = 116, ZY = 168;
const CX = (i) => (i === 0 ? 140 : 500);
const fmt = (v) => (Math.round(v) / 10).toFixed(1);
const STAMP = (d) => (d === 0 ? ['49.3 !', GOLD] : d <= 5 ? ['ADOPTÉ', '#3cff7a'] : d <= 20 ? ['AMENDÉ', '#7ad8ff'] : d <= 80 ? ['RECALÉ', '#ffa83a'] : ['MOTION DE CENSURE', '#ff3a4a']);
const WANT = ['Je veux mon 49.3 !', 'Pas 49.2. Pas 49.4.', 'En même temps...', 'Le peuple attend !', 'Traversez la rue !', 'Quarante-neuf TROIS.'];
const HAPPY = ['Magnifique !', 'Adopté !', 'Ça, c\'est la France !', 'Bravo jeune homme !'];
const MAD = ['Mais non !', 'C\'est une honte !', 'Inadmissible !', 'Démission !'];

function ensure(xs) {
  if (xs.on) return xs;
  xs.on = 1; xs.say = { s: WANT[0], t0: -9 }; xs.mood = { k: '', t0: -9 }; xs.stamp = [null, null]; xs.lastV = [-1, -1]; xs.tick = 0; xs.big = -9;
  return xs;
}

export default {
  title: 'LE 49.3', color: '#3a6aff', icon: '🇫🇷',
  puppets: ['micron'],
  goal: 'Arrête le curseur pile sur 49.3 !',
  keys: [['A', 'STOP !']],
  ach: [['Premier ministre', '49.3 de diamant', 'Adopté sans vote', 'Maître des horloges'], ['Motion de censure', 'Dissous', 'Recalé au Conseil constitutionnel', 'Démission acceptée']],
  news: (L, d) => `${L} RATE SON 49.3 : LE PRÉSIDENT DISSOUT SON POURCENTAGE (+${d} %)`,

  draw(view, W, M, dt) {
    const ctx = view.g, g = M.g, xs = ensure(view.xs), t = view.time, A = view.audio;
    const L = -view.ox, R = 640 + view.ox, T = -view.oy, B = 360 + view.oy;
    // l'hémicycle : velours rouge, gradins, drapeaux
    ctx.fillStyle = '#1a0c18'; ctx.fillRect(L, T, R - L, B - T);
    for (let k = 0; k < 6; k++) { ctx.fillStyle = k % 2 ? '#3a1020' : '#2e0c1a'; ctx.beginPath(); ctx.ellipse(320, 420, 560 - k * 70, 330 - k * 46, 0, Math.PI, 0); ctx.fill(); }
    for (const [fx, s] of [[262, -1], [378, 1]]) {
      ctx.fillStyle = '#c8c8d0'; ctx.fillRect(fx - 1, 70, 2, 120);
      const w = Math.sin(t * 3 + fx) * 3;
      for (const [k, c] of [[0, '#2a4aff'], [1, '#f4f4f8'], [2, '#ff2a3a']]) { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(fx + s * k * 10, 72 + w * k * 0.3); ctx.lineTo(fx + s * (k + 1) * 10, 72 + w * (k + 1) * 0.3); ctx.lineTo(fx + s * (k + 1) * 10, 100 + w * (k + 1) * 0.3); ctx.lineTo(fx + s * k * 10, 100 + w * k * 0.3); ctx.closePath(); ctx.fill(); }
    }
    pres(view, W, M, g, xs, t);
    view.timer(M, 320, 30);
    if (g.r > 0 && M.ph === 'play') view.text(`MANCHE ${g.r} / ${MAC.ROUNDS}`, 320, 50, 10, '#e8d8f0', { mono: true });
    // le tic du curseur qui défile (à chaque 5.0 passé)
    if (A && M.ph === 'play' && g.ph === 'set') for (let i = 0; i < 2; i++) {
      const v = g.p[i].v, k = Math.floor(v / 50);
      if (xs.lastV[i] >= 0 && k !== xs.lastV[i] && !g.p[i].lock && t - xs.tick > 0.04) { xs.tick = t; A.sfx('click', i ? 0.4 : -0.4, 0.12, 1 + (Math.abs(v - 493) < 60 ? 3 : 0)); }
      xs.lastV[i] = k;
    }
    for (let i = 0; i < 2; i++) slider(view, W, M, g, xs, i, t);
    // pile 49.3 : en énorme
    const bt = t - xs.big;
    if (bt < 1.2) { const sc = bt < 0.12 ? 2.4 - bt / 0.12 * 1.4 : 1 + Math.sin(bt * 20) * 0.03; ctx.save(); ctx.translate(320, 150); ctx.rotate(-0.12); ctx.scale(sc, sc); view.text('49.3 !', 0, 0, 64, GOLD, { title: true, alpha: Math.min(1, (1.2 - bt) * 4) }); ctx.restore(); }
  },

  onEvent(view, ev, W, M) {
    const A = view.audio, xs = ensure(view.xs);
    if (!M || !ev.type.startsWith('mgMacron')) return;
    const g = M.g, pan = (i) => (i ? 0.4 : -0.4);
    if (ev.type === 'mgMacronRound') {
      xs.stamp = [null, null]; xs.lastV = [-1, -1];
      xs.say = { s: view.pick(WANT), t0: view.time };
      view.sticker(`MANCHE ${ev.r}`, 320, 214, { size: 18, color: '#ffffff', bg: '#2a4aff', life: 0.8, rot: 0 });
      if (A) { A.sfx('whoosh', 0, 0.4); A.sfx('blip', 0, 0.4, 2 + ev.r); if (ev.r === 1) A.say('Quarante-neuf trois !', 0.35, 1.1); }
    } else if (ev.type === 'mgMacronLock') {
      const i = ev.p, slot = i === 0 ? M.a : M.v, [txt, col] = STAMP(ev.d);
      xs.stamp[i] = { txt: ev.late ? 'TROP TARD' : txt, col: ev.late ? '#a8a0b8' : col, t0: view.time, rot: (Math.random() - 0.5) * 0.4 };
      view.burst(CX(i), LY, 12, [col, '#ffffff', COLORS[slot]], { shape: 'star', speed: 180, size: 4, life: 0.5 });
      view.jolt(ev.d === 0 ? 0.8 : 0.35, 0.04, ev.d === 0 ? '#fff0b0' : null, 0.3);
      if (ev.d === 0) {
        xs.big = view.time; xs.mood = { k: 'laugh', t0: view.time }; xs.say = { s: 'HA HA ! PARFAIT !', t0: view.time };
        view.confetti(50); view.hype(0.7); view.emojiRain(['🇫🇷', '🥖', '🍷'], 10);
        if (A) { A.sfx('airhorn', 0, 0.6); A.sfx('crowd', 0, 0.5); A.say('Quarante-neuf trois !', 0.35, 1.2); }
      } else if (ev.d <= 5) view.sticker(`À ${fmt(ev.d)} PRÈS !`, CX(i), ZY + 6, { size: 13, color: '#0b0610', bg: '#3cff7a', life: 0.9 });
      else if (ev.d > 80) { view.sticker(view.pick(['DISSOLUTION !', 'À CÔTÉ DE LA PLAQUE', 'RÉFORME RATÉE']), CX(i), ZY + 6, { size: 13, color: '#ffffff', bg: '#d01030', life: 0.9 }); }
      if (A) { A.sfx('punchHeavy', pan(i), 0.5); A.sfx('woodL', pan(i), 0.5); if (ev.d > 0 && ev.d <= 5) A.sfx('cash', pan(i), 0.5); if (ev.d > 80) A.sfx('error', pan(i), 0.4); }
    } else if (ev.type === 'mgMacronShow') {
      const best = Math.min(ev.d0, ev.d1);
      if (ev.d0 !== ev.d1) {
        const i = ev.d0 < ev.d1 ? 0 : 1, slot = i === 0 ? M.a : M.v;
        view.sticker(`${view.pname(slot)} PLUS PRÈS`, CX(i), 290, { size: 13, color: '#ffffff', bg: COLORS[slot], life: 1, rot: 0 });
      } else view.sticker('ÉGALITÉ !', 320, 120, { size: 15, color: '#ffffff', bg: '#7a3aff', life: 0.9 });
      if (best > 0) {
        const happy = best <= 10;
        xs.mood = { k: happy ? 'happy' : 'mad', t0: view.time }; xs.say = { s: view.pick(happy ? HAPPY : MAD), t0: view.time };
        if (A) { if (happy) A.sfx('crowd', 0, 0.3); else A.sfx('thud', 0, 0.4); A.say(xs.say.s, 0.35, 1.15); }
      }
      void g;
    }
  },
};

// le président à son pupitre : il attend (bras croisés), rit (pile 49.3), applaudit (tout près), s'énerve (loin)
function pres(view, W, M, g, xs, t) {
  const ctx = view.g, mt = t - xs.mood.t0, mood = mt < 1.5 ? xs.mood.k : '';
  let o;
  if (M.ph === 'outro') o = { emote: 'clap', head: 1.8 };
  else if (mood === 'laugh') o = { emote: 'laugh_01', head: 2.1 };
  else if (mood === 'happy') o = { emote: 'clap', head: 1.8 };
  else if (mood === 'mad') o = { emote: 'angry_01', head: 2.1, tint: '#ff2020', tintK: 0.15 };
  else o = { state: 'idle', head: 1.8 };
  const sh = mood === 'mad' ? (Math.random() - 0.5) * 4 : 0;
  if (!view.puppet('micron', 320 + sh, 302, 180, { ...o, key: 'mac', shadow: false })) view.portraitAt('micron', 320, 200, 80, '#3a6aff', false);
  // le pupitre
  ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.moveTo(268, 250); ctx.lineTo(372, 250); ctx.lineTo(362, 330); ctx.lineTo(278, 330); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#6a3a1a'; ctx.beginPath(); ctx.moveTo(272, 254); ctx.lineTo(368, 254); ctx.lineTo(359, 326); ctx.lineTo(281, 326); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#2a4aff'; ctx.fillRect(292, 268, 18, 22); ctx.fillStyle = '#f4f4f8'; ctx.fillRect(310, 268, 18, 22); ctx.fillStyle = '#ff2a3a'; ctx.fillRect(328, 268, 18, 22);
  view.text('49.3', 320, 312, 18, GOLD, { mono: true });
  // sa bulle
  if (M.ph === 'play' && g.ph === 'set' && t - xs.say.t0 > 3.2) xs.say = { s: view.pick(WANT), t0: t };
  const st = t - xs.say.t0;
  if (M.ph === 'play' && st < 2.2) {
    const s = xs.say.s, a = Math.min(1, st * 8, (2.2 - st) * 4), pop = st < 0.1 ? 1.25 - st * 2.5 : 1;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(320, 82); ctx.scale(pop, pop);
    ctx.font = "11px 'Lilita One', 'Trebuchet MS', sans-serif";
    const w = Math.min(124, ctx.measureText(s).width + 16);
    ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.roundRect(-w / 2 - 3, -14, w + 6, 28, 9); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-7, 12); ctx.lineTo(7, 12); ctx.lineTo(0, 26); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect(-w / 2, -11, w, 22, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-4, 10); ctx.lineTo(4, 10); ctx.lineTo(0, 21); ctx.closePath(); ctx.fill();
    ctx.restore();
    view.text(s, 320, 86, 11, '#0b0610', { stroke: false, alpha: a, maxW: 120 });
  }
}

// le curseur d'un joueur : le chiffre en gros, la loupe (±3 autour, les dixièmes, 49.3 en or), la réglette, le tampon,
// ses écarts des manches passées, son étiquette
function slider(view, W, M, g, xs, i, t) {
  const ctx = view.g, slot = i === 0 ? M.a : M.v, col = COLORS[slot], P = g.p[i], cx = CX(i), x0 = cx - HW / 2;
  const v = P.v, d = Math.abs(Math.round(v) - MAC.GOAL), live = M.ph === 'play' && g.r > 0;
  // le chiffre
  ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.roundRect(cx - 70, LY - 30, 140, 52, 8); ctx.fill();
  ctx.fillStyle = '#10201a'; ctx.beginPath(); ctx.roundRect(cx - 66, LY - 26, 132, 44, 6); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.stroke();
  const dc = !live ? '#5a7a6a' : d === 0 ? GOLD : d <= 5 ? '#3cff7a' : d <= 30 ? '#d8ff7a' : '#e8f0e8';
  view.text(live ? fmt(v) : '--.-', cx, LY + 10, 34, dc, { mono: true, stroke: false });
  if (P.lock && live) view.text('🔒', cx + 58, LY - 22, 12, '#fff', { stroke: false });
  // la loupe : ±3 autour du curseur
  const zw = HW, zx = x0, zh = 30, per = zw / 60; // 60 dixièmes visibles
  ctx.fillStyle = '#0b0610'; ctx.fillRect(zx - 3, ZY - zh / 2 - 3, zw + 6, zh + 6);
  ctx.fillStyle = '#f4ecd8'; ctx.fillRect(zx, ZY - zh / 2, zw, zh);
  ctx.save(); ctx.beginPath(); ctx.rect(zx, ZY - zh / 2, zw, zh); ctx.clip();
  const lo = Math.floor(v - 32), hi = Math.ceil(v + 32);
  for (let u = Math.max(0, lo); u <= Math.min(MAC.MAX, hi); u++) {
    const x = cx + (u - v) * per, big = u % 10 === 0, mid = u % 5 === 0;
    ctx.fillStyle = '#2a1a2a'; ctx.fillRect(x - (big ? 1 : 0.5), ZY + zh / 2 - (big ? 14 : mid ? 9 : 5), big ? 2 : 1, big ? 14 : mid ? 9 : 5);
    if (big) view.text(String(u / 10), x, ZY - 4, 9, '#2a1a2a', { mono: true, stroke: false });
  }
  const gx = cx + (MAC.GOAL - v) * per;
  if (Math.abs(MAC.GOAL - v) < 34) { ctx.fillStyle = GOLD; ctx.fillRect(gx - 2, ZY - zh / 2, 4, zh); ctx.fillStyle = 'rgba(255,210,58,0.25)'; ctx.fillRect(gx - 6, ZY - zh / 2, 12, zh); }
  ctx.restore();
  // l'aiguille au milieu de la loupe
  ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.moveTo(cx - 7, ZY - zh / 2 - 9); ctx.lineTo(cx + 7, ZY - zh / 2 - 9); ctx.lineTo(cx, ZY - zh / 2 + 3); ctx.closePath(); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(cx - 5, ZY - zh / 2 - 8); ctx.lineTo(cx + 5, ZY - zh / 2 - 8); ctx.lineTo(cx, ZY - zh / 2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = col; ctx.fillRect(cx - 1, ZY - zh / 2, 2, zh);
  // la réglette de 0 à 100
  ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.roundRect(x0 - 4, TY - 7, HW + 8, 14, 7); ctx.fill();
  ctx.fillStyle = '#3a2a48'; ctx.beginPath(); ctx.roundRect(x0 - 2, TY - 5, HW + 4, 10, 5); ctx.fill();
  const tx = x0 + (v / MAC.MAX) * HW, gx2 = x0 + (MAC.GOAL / MAC.MAX) * HW;
  ctx.fillStyle = col; ctx.globalAlpha = 0.5; ctx.fillRect(x0, TY - 3, tx - x0, 6); ctx.globalAlpha = 1;
  ctx.fillStyle = GOLD; ctx.fillRect(gx2 - 1.5, TY - 11, 3, 22);
  view.text('49.3', gx2, TY + 22, 9, GOLD, { mono: true });
  view.text('0', x0, TY + 20, 8, '#a898b8', { mono: true, stroke: false }); view.text('100', x0 + HW, TY + 20, 8, '#a898b8', { mono: true, stroke: false });
  ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.arc(tx, TY, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(tx, TY, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(tx - 2, TY - 2, 2.5, 0, Math.PI * 2); ctx.fill();
  // le tampon, une fois figé
  const S = xs.stamp[i];
  if (S && live) {
    const st = t - S.t0, sc = st < 0.1 ? 2.2 - st / 0.1 * 1.2 : 1;
    ctx.save(); ctx.translate(cx, LY - 2); ctx.rotate(S.rot); ctx.scale(sc, sc);
    ctx.font = "16px 'Arial Black', Impact, sans-serif";
    const w = ctx.measureText(S.txt).width + 16;
    ctx.globalAlpha = 0.9; ctx.strokeStyle = S.col; ctx.lineWidth = 3; ctx.strokeRect(-w / 2, -14, w, 28); ctx.globalAlpha = 1;
    ctx.restore();
    ctx.save(); ctx.translate(cx, LY - 2); ctx.rotate(S.rot); ctx.scale(sc, sc);
    view.text(S.txt, 0, 6, 16, S.col, { mono: true });
    ctx.restore();
  }
  // comment jouer : A = STOP, et « APPUIE ! » qui clignote quand l'aiguille arrive sur 49.3
  if (live && g.ph === 'set' && !P.lock) {
    view.hint(W, M, i, cx, ZY + 30, [['A', 'STOP !']]);
    const f = (MAC.GOAL - v) / (P.vel || 1);
    if (!W.fighters[slot].bot && f > -2 && f < 8 && Math.sin(t * 30) > -0.3) view.text(`APPUIE SUR ${view.keyName(M, i, 'A')} !`, cx, LY - 38, 15, GOLD, { mono: true });
  }
  // les écarts des manches
  const ds = P.d.map((x) => fmt(x)).join(' + ');
  view.text(P.d.length ? `écart : ${ds}${P.d.length > 1 ? ' = ' + fmt(P.tot) : ''}` : 'écart : -', cx, TY + 40, 11, '#e8d8f0', { mono: true });
  view.who(W, M, i, cx, TY + 52, { align: 'center' });
}
