// Battle d'aura (aura), l'affichage : un plateau violet de vidéo TikTok (rayons qui tournent, phonk et cloche), le vrai
// perso de chaque joueur (J1 à gauche, J2 à droite) dans son aura qui flambe à sa couleur (de plus en plus grande, grise
// quand elle est négative), son compteur d'aura en gros ; à côté, son panneau : le mème du moment (MEWING 🤫, SIGMA 🐺...)
// avec la barre où file le curseur et la zone à sa couleur (sa touche à lui qui clignote quand c'est le moment), ou le
// « 6-7 » : les deux touches ◀ ▶, celle à presser qui pulse, le compte. +1000 AURA, -500 AURA 💀, 🗿 au milieu.
import { AURA } from '../../sim/mg/aura.js';
import { COLORS } from '../../sim/constants.js';

const X = (i, x) => (i === 0 ? x : 640 - x);
const PUP_X = 92, FLOOR = 250, PX = 226, PY = 192;
const MEMES = ['MEWING 🤫', 'SIGMA 🐺', 'RIZZ 😏', 'SKIBIDI 🚽', 'OHIO 🌽', 'FANUM TAX 🍟', 'GOOFY AHH 🤪', 'AURA FARMING 🌾', 'MOGGING 🗿', 'GYATT 😳'];
const SAY = ['Mewing.', 'Sigma.', 'Rizz.', 'Skibidi.', 'Ohio.', 'Fanum tax.', 'Goofy ahh.', 'Aura farming.', 'Mogging.', 'Gyatt.'];
const LOST = ['IL A PERDU SON AURA 💀', 'AURA NÉGATIVE 💀', 'GOOFY AHH 🤡', 'C\'EST OHIO ÇA 🌽', 'L + RATIO', 'MOGGÉ 😭'];
const WIN = ['SIGMA 🐺', 'AURA FARMING 🌾', 'ÇA RIZZ 😏', 'MOGGING 🗿', 'LE GOAT 🐐', 'W 🔥'];

// le nom de la touche d'une direction (1 droite, 3 gauche) pour l'appareil du joueur i (rien de plus que la flèche à la manette)
function dirKey(view, M, i, d) {
  const dev = view.deviceOf(i === 0 ? M.a : M.v);
  return (dev === 'kb1' ? ['Z', 'D', 'S', 'Q'] : dev === 'kb2' ? ['↑', '→', '↓', '←'] : ['', '', '', ''])[d];
}

export default {
  title: 'BATTLE D\'AURA', color: '#b44aff', icon: '🗿',
  goal: 'Farme le plus d\'aura : appuie dans la zone, et au 6-7 alterne ◀ ▶ à fond !',
  keys: [['A', 'dans la zone'], ['lr', '6-7 : alterner vite']],
  ach: [
    ['Aura infinie 🗿', 'Sigma certifié', 'Aura farmer professionnel', 'Mogging en direct'],
    ['Aura négative', 'Il a perdu son aura', 'Goofy ahh', 'Né à Ohio'],
  ],
  news: (L, d) => `${L} PERD TOUTE SON AURA EN DIRECT : -${d * 100} AURA, « C'EST OHIO » SELON LES EXPERTS`,

  draw(view, W, M, dt) {
    const ctx = view.g, g = M.g, t = view.time, A = view.audio, L = -view.ox, Rr = 640 + view.ox, T = -view.oy, B = 360 + view.oy;
    const xs = view.xs;
    if (!xs.on) Object.assign(xs, { on: 1, shown: [0, 0], pop: [0, 0], beat: 0, st: {}, end: 0, flash: [0, 0], lastS: [0, 0] });
    // le fond : violet, rayons qui tournent, le phonk (une cloche sur le temps)
    ctx.fillStyle = '#1a0830'; ctx.fillRect(L, T, Rr - L, B - T);
    ctx.save(); ctx.translate(320, 190); ctx.rotate(t * 0.25);
    for (let k = 0; k < 12; k++) { ctx.fillStyle = k % 2 ? 'rgba(180,74,255,0.12)' : 'rgba(255,74,180,0.08)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 600, k * Math.PI / 6, (k + 0.5) * Math.PI / 6); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    ctx.fillStyle = '#0b0412'; ctx.fillRect(L, FLOOR, Rr - L, B - FLOOR);
    ctx.strokeStyle = 'rgba(180,74,255,0.4)'; ctx.lineWidth = 1;
    for (let k = -8; k <= 8; k++) { ctx.beginPath(); ctx.moveTo(320 + k * 20, FLOOR); ctx.lineTo(320 + k * 90, B); ctx.stroke(); }
    if (M.ph === 'play' && A && t - xs.beat > 0.42) { xs.beat = t; A.sfx('cowbell', 0, 0.12, (Math.floor(t / 0.42) % 4) ? 3 : 1); }
    // un nouveau moment (le même pour les deux) : le 6-7 s'annonce au milieu
    for (let n = 0; n < g.ev.length; n++) {
      const e = g.ev[n];
      if (M.ph !== 'play' || M.t < e.t || xs.st[n]) continue;
      xs.st[n] = 1;
      if (e.k === 1) {
        view.sticker('SIX SEVEN !! 🤲', 320, 120, { size: 26, color: '#ffffff', bg: '#ff2a8a', life: 0.9 });
        view.lines(0.5); view.hype(0.6); view.jolt(0.5, 0.05, '#ff6ad0', 0.25);
        if (A) { A.sfx('bassDrop', 0, 0.7); A.say('Six seven !', 0.5, 1.4); }
      } else if (A) { A.sfx('whoosh', 0, 0.3); if (Math.random() < 0.6) A.say(SAY[e.m], 0.3, 1.1); }
    }
    for (let i = 0; i < 2; i++) side(view, W, M, g, i, t, dt, xs);
    // le moai au milieu
    view.text('🗿', 320, 200 + Math.sin(t * 2) * 4, 34 + (view.beatPop || 0) * 6, '#fff', { stroke: false });
    view.text('VS', 320, 236, 18, '#ffe24a', { title: true });
    view.text('🗿 BATTLE D\'AURA', 320, 16, 15, '#d08aff', { title: true });
    view.timer(M, 320, 38);
    // la fin : aura infinie contre aura négative
    if (M.ph === 'outro' && !xs.end) {
      xs.end = 1;
      const w = g.p[0].aura === g.p[1].aura ? -1 : g.p[0].aura > g.p[1].aura ? 0 : 1;
      if (w >= 0) {
        view.sticker('AURA INFINIE 🗿', X(w, 160), 110, { size: 22, color: '#0b0610', bg: '#ffe24a', life: 1.4 });
        view.sticker('AURA NÉGATIVE 💀', X(1 - w, 160), 150, { size: 18, color: '#ffffff', bg: '#3a3a4a', life: 1.4 });
        if (A) { A.sfx('airhorn', 0, 0.6); A.say('Aura infinie !', 0.4, 1.0); }
      }
    }
  },

  onEvent(view, ev, W, M) {
    const A = view.audio, xs = view.xs, g = M && M.g;
    if (!g || !ev.type.startsWith('mgAura') || !xs.on) return;
    const i = ev.p, slot = i === 0 ? M.a : M.v, col = COLORS[slot], pan = i ? 0.4 : -0.4, px = X(i, PUP_X), cx = X(i, PX);
    switch (ev.type) {
      case 'mgAuraTap':
        xs.pop[i] = 1;
        if (ev.r === 3) {
          xs.flash[i] = -1;
          view.react(i, { emote: 'sob', life: 1, tint: '#5a6a8a', tintK: 0.5 });
          view.react(1 - i, { emote: 'laugh_01', life: 1, weak: 1 });
          view.sticker('-500 AURA', px, 110, { size: 22, color: '#ffffff', bg: '#3a3a4a', life: 0.9, rot: i ? 0.12 : -0.12 });
          view.sticker(view.pick(LOST), cx, PY + 44, { size: 12, color: '#ffffff', bg: '#7a1030', life: 0.9 });
          view.burst(px, 150, 8, ['#fff'], { shape: 'txt', ch: view.pick(['💀', '🤡', '😭']), speed: 160, size: 12, up: 90, life: 1 });
          view.jolt(0.45, 0.03, '#404050', 0.25);
          if (A) { A.sfx('wobble', pan, 0.6); A.sfx('sob', pan, 0.4); if (Math.random() < 0.5) A.say('Il a perdu son aura.', 0.2, 0.9); }
        } else {
          const perf = ev.r === 2;
          xs.flash[i] = 1;
          view.react(i, perf ? { emote: 'victory_celebration', life: 1.1, head: 2.1, hop: 0.12 } : { emote: view.pick(['dance_01', 'dance_03', 'select', 'freaky']), life: 0.9, pop: 0.35 });
          view.sticker(perf ? '+1500 AURA 🗿' : '+1000 AURA', px, 110, { size: perf ? 24 : 21, color: '#0b0610', bg: perf ? '#ffe24a' : col, life: 0.9, rot: i ? -0.1 : 0.1 });
          view.sticker(perf ? 'PILE 🎯 SIGMA' : view.pick(WIN), cx, PY + 44, { size: 12, color: '#ffffff', bg: '#7a3aff', life: 0.8 });
          view.burst(px, 170, perf ? 36 : 22, [col, '#ffffff', '#ffe24a'], { shape: 'star', speed: perf ? 320 : 240, size: 6, life: 0.7 });
          view.burst(px, 170, 4, ['#fff'], { shape: 'txt', ch: view.pick(['🗿', '🔥', '😎', '🐺']), speed: 180, size: 13, up: 120, life: 1 });
          if (ev.st >= 3) { view.sticker(`AURA x${ev.st} 🔥`, px, 140, { size: 15, color: '#ffffff', bg: '#ff3a3a', life: 0.8 }); view.hype(0.5); }
          view.jolt(perf ? 0.6 : 0.35, perf ? 0.07 : 0.04, perf ? '#fff6a0' : null, 0.25);
          if (A) { A.sfx(perf ? 'airhorn' : 'hitmark', pan, perf ? 0.45 : 0.6); A.sfx('bassDrop', pan, perf ? 0.5 : 0.25); A.sfx('cash', pan, 0.3, 1 + Math.min(5, ev.st)); }
        }
        break;
      case 'mgAura67':
        xs.lastS[i] = ev.s; xs.pop[i] = 0.5;
        view.burst(X(i, PUP_X) + ev.s * 26, 170, 2, [col, '#ffffff'], { shape: 'star', speed: 120, size: 4, life: 0.3 });
        if (A) A.sfx('clink', pan, 0.25, 1 + (ev.n % 6));
        break;
      case 'mgAura67End':
        view.sticker(ev.n > 0 ? `6-7 x${ev.n} : +${ev.pts} AURA` : '6-7 RATÉ 💀', px, 110, { size: 17, color: '#0b0610', bg: ev.n >= 10 ? '#ffe24a' : col, life: 1 });
        if (ev.n >= 10) { view.burst(px, 170, 26, [col, '#ffe24a', '#ffffff'], { shape: 'star', speed: 280, size: 6 }); view.react(i, { emote: 'victory_celebration', life: 1 }); }
        if (A) { A.sfx(ev.n >= 10 ? 'airhorn' : 'pop', pan, 0.5); }
        break;
      default: break;
    }
  },
};

// le côté d'un joueur : son aura, son perso, son compteur, son panneau (le mème ou le 6-7), ses touches
function side(view, W, M, g, i, t, dt, xs) {
  const ctx = view.g, P = g.p[i], slot = i === 0 ? M.a : M.v, col = COLORS[slot], px = X(i, PUP_X), cx = X(i, PX);
  xs.pop[i] = Math.max(0, xs.pop[i] - dt * 3);
  xs.flash[i] = xs.flash[i] > 0 ? Math.max(0, xs.flash[i] - dt * 2) : Math.min(0, xs.flash[i] + dt * 2);
  xs.shown[i] += (P.aura - xs.shown[i]) * Math.min(1, dt * 8);
  const e = g.ev[P.cur], live = M.ph === 'play' && e && M.t >= e.t, six = live && e.k === 1;
  // l'aura : des flammes à sa couleur, grandes avec l'aura ; grise quand elle est négative
  const neg = P.aura < 0, k = Math.min(1, Math.max(0, P.aura) / 7000), r = 34 + k * 58 + Math.abs(xs.flash[i]) * 20 + (six ? 10 : 0);
  ctx.save();
  ctx.globalAlpha = 0.38 + k * 0.3 + Math.max(0, xs.flash[i]) * 0.3;
  ctx.fillStyle = neg ? '#5a6a7a' : col;
  ctx.beginPath(); ctx.ellipse(px, FLOOR - 64, r * 0.75, r * 1.15, 0, 0, Math.PI * 2); ctx.fill();
  for (let f = 0; f < 9; f++) {
    const a = f / 9 * Math.PI * 2, fl = Math.sin(t * 9 + f * 1.7) * 0.25 + 1, fx = px + Math.cos(a) * r * 0.62, fy = FLOOR - 64 + Math.sin(a) * r * 0.95;
    ctx.beginPath(); ctx.moveTo(fx - 7, fy); ctx.lineTo(fx + Math.cos(a) * 4, fy - 18 * fl - k * 18); ctx.lineTo(fx + 7, fy); ctx.closePath(); ctx.fill();
  }
  ctx.globalAlpha = 0.5 + Math.max(0, xs.flash[i]) * 0.5; ctx.fillStyle = neg ? '#8a9aaa' : '#ffffff';
  ctx.beginPath(); ctx.ellipse(px, FLOOR - 64, r * 0.38, r * 0.7, 0, 0, Math.PI * 2); ctx.globalAlpha *= 0.25; ctx.fill();
  ctx.restore();
  // le perso : au 6-7, il jongle (des mains qui montent et descendent : 6, 7)
  let po;
  if (M.ph === 'outro') po = P.aura >= g.p[1 - i].aura ? { emote: 'win' } : { emote: 'sob' };
  else if (six) po = { emote: 'dance_02', emoteSpeed: 1.8 };
  else if (neg) po = { state: 'dizzy' };
  else po = { state: 'idle' };
  if (view.pupOn(M)) view.player(W, M, i, px, FLOOR, 126, { ...po, face: i === 0 ? 'three' : 'threeL', head: 1.7 + k * 0.4 });
  if (six) {
    const s = xs.lastS[i] || 1;
    for (const d of [-1, 1]) view.text(d < 0 ? '6' : '7', px + d * 34, FLOOR - 84 - (s === d ? 18 : 0), 26, '#ffe24a', { title: true });
  }
  // le compteur d'aura
  const sc = 1 + xs.pop[i] * 0.3;
  view.text(`${Math.round(xs.shown[i])}`, px, 60, 24 * sc, neg ? '#9aaabb' : col, { title: true });
  view.text(neg ? 'AURA NÉGATIVE' : 'AURA', px, 78, 10, '#ffffff', { mono: true });
  // le panneau du joueur
  ctx.fillStyle = 'rgba(11,6,16,0.82)'; ctx.beginPath(); ctx.roundRect(cx - 82, PY - 58, 164, 112, 10); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.stroke();
  const human = !W.fighters[slot].bot;
  if (!live) {
    const nx = e && M.ph === 'play' ? e : null;
    view.text(nx ? (nx.k === 1 ? 'LE 6-7 ARRIVE…' : 'PRÉPARE TON AURA…') : '🗿', cx, PY - 8, nx ? 11 : 26, '#c8b8e8', { mono: true });
    if (nx) view.text('🗿', cx, PY + 18, 20 + Math.sin(t * 6) * 2, '#fff', { stroke: false });
  } else if (!six) {
    // le mème : le curseur file vers la droite, A dans la zone
    const q = Math.min(1, (M.t - e.t) / e.d), bx = cx - 70, bw = 140, by = PY + 2;
    view.text(MEMES[e.m], cx, PY - 36, 15, '#ffffff', { mono: true, maxW: 150 });
    ctx.fillStyle = '#0b0610'; ctx.fillRect(bx - 2, by - 11, bw + 4, 22);
    ctx.fillStyle = '#3a2a4a'; ctx.fillRect(bx, by - 9, bw, 18);
    const zx = bx + (e.z - e.w / 2) * bw, zw = e.w * bw, inZ = Math.abs(q - e.z) <= e.w / 2;
    ctx.fillStyle = col; ctx.globalAlpha = inZ ? 1 : 0.7; ctx.fillRect(zx, by - 9, zw, 18); ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(bx + e.z * bw - 1.5, by - 9, 3, 18);
    const mx = bx + q * bw;
    ctx.fillStyle = '#0b0610'; ctx.fillRect(mx - 4, by - 15, 8, 30); ctx.fillStyle = inZ ? '#ffe24a' : '#ffffff'; ctx.fillRect(mx - 2.5, by - 13, 5, 26);
    // la touche qui clignote quand c'est le moment
    const key = human ? view.keyName(M, i, 'A') : 'A';
    if (inZ) view.text(`${key} !!!`, cx, PY + 34, 22 + Math.sin(t * 30) * 2, Math.sin(t * 24) > 0 ? '#ffe24a' : col, { mono: true });
    else view.text(human ? `${key} dans la zone` : 'CPU…', cx, PY + 34, 12, '#c8b8e8', { mono: true });
  } else {
    // le 6-7 : alterner ◀ ▶, celle à presser pulse
    const left = Math.max(0, 1 - (M.t - e.t) / e.d), nextR = P.side <= 0;
    view.text('6-7 !!', cx, PY - 36, 22, '#ffe24a', { title: true });
    for (const d of [3, 1]) {
      const on = (d === 1) === nextR, kx = cx + (d === 1 ? 34 : -34), kn = human ? dirKey(view, M, i, d) : '', lab = d === 1 ? `${kn} ▶`.trim() : `◀ ${kn}`.trim();
      const z = on ? 1.15 + Math.sin(t * 30) * 0.08 : 0.9;
      ctx.save(); ctx.translate(kx, PY + 2); ctx.scale(z, z);
      ctx.fillStyle = on ? '#f4ead6' : '#5a4a6a'; ctx.beginPath(); ctx.roundRect(-24, -13, 48, 26, 6); ctx.fill();
      ctx.fillStyle = col; ctx.fillRect(-24, 10, 48, 3);
      view.text(lab, 0, 0, 13, '#0b0610', { mono: true, stroke: false });
      ctx.restore();
    }
    view.text(`x${P.cnt}`, cx, PY + 32, 16 + Math.min(8, P.cnt * 0.5), '#ffffff', { mono: true });
    ctx.fillStyle = '#0b0610'; ctx.fillRect(cx - 66, PY + 44, 132, 5); ctx.fillStyle = '#ff4aa0'; ctx.fillRect(cx - 65, PY + 45, 130 * left, 3);
  }
  // les touches, sous le panneau ; l'étiquette du joueur
  view.hint(W, M, i, cx, PY + 72, six ? [['lr', 'alterner vite']] : [['A', 'dans la zone']]);
  view.who(W, M, i, X(i, 10), 290, { align: i ? 'right' : 'left', size: 0.9 });
}
