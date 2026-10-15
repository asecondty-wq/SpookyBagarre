// L'accordeur d'Epektase (tuning), l'affichage : une scène de concert kawaii, écran partagé. Chacun sa Flying V (la tête
// du manche, six chevilles, les cordes qui vibrent), son accordeur à pince (un petit boîtier rose qui a un visage, l'aiguille
// qui glisse et tremble), sa main sur la cheville. Au milieu, Epektase en vrai modèle 3D à grosse tête (marionnette), son
// éventail en papier qui flotte à côté : il danse et des cœurs montent quand c'est juste ; quand c'est faux il gonfle, rougit,
// tremble de rage (« BAKA ! ») et l'éventail tape sur les doigts ; le joueur tapé apparaît en médaillon, sonné, tout rouge.
// (Sans marionnettes, l'ancien Epektase en chibi dessiné.)
import { TUNE } from '../../sim/mg/tuning.js';
import { COLORS } from '../../sim/constants.js';

const PINK = '#ff6ad5';
const NECK_Y = 252, NUT_X = 104, NECK_END = 258;
const TUNER = [140, 112]; // le centre de l'accordeur (moitié gauche)
const SEMI = [0, 5, 10, 15, 19, 24]; // les cordes, en demi-tons au-dessus du mi grave
const GRADE = [null, ['PARFAIT ✨', '#7cff8a', '#1f9a4a'], ['JUSTE ♪', '#ffe24a', '#b07a10'], ['PRESQUE…', '#ffb04a', '#a0501a']];
const BAKA = ['BAKA !', 'BAKA BAKA !', 'C\'EST FAUX !', 'ÇA SONNE FAUX', 'NON NON NON', 'ARRÊTE ÇA !'];
const SUGOI = ['SUGOI !', 'KAWAII ♡', 'ÇA SONNE !', 'TROP BIEN ♡', 'NYAA ♪', 'OUI OUI !'];
const STR_NAME = ['MI grave', 'LA', 'RÉ', 'SOL', 'SI', 'MI aigu'];
const X = (i, x) => (i === 0 ? x : 640 - x);

// où sont les chevilles et la main (moitié gauche ; s : la corde, 0 = la 6 en haut à droite de la tête)
function peg(s) {
  const top = s < 3, x = 86 - (top ? s : 5 - s) * 26, d = 30 - (x - 18) / (NUT_X - 18) * 15; // le bord de la tête, à cet endroit
  return { x, y: NECK_Y + (top ? -d + 6 : d - 6), ky: NECK_Y + (top ? -d - 13 : d + 13), sy: NECK_Y + (s - 2.5) * 4.2, top };
}

// l'état d'affichage (view.xs), créé au premier besoin
function ensure(xs) {
  if (xs.on) return xs;
  xs.on = 1; xs.mood = { k: 'idle', t: 0, side: 0 }; xs.sm = [0, 0]; xs.ok = [0, 0]; xs.pl = [0, 0]; xs.snap = [0, 0];
  xs.gl = [null, null]; xs.glT = [0, 0]; xs.shown = [0, 0]; xs.bub = null; xs.warn = [0, 0]; xs.why = [0, 0]; xs.cam = [null, null];
  return xs;
}

export default {
  title: 'L\'ACCORDEUR D\'EPEKTASE', color: PINK, icon: '🎸',
  puppets: ['epektase'],
  rules: [
    'Stick ◀ ▶ : tourne la cheville (la note glisse et dépasse !)',
    'A : valide quand l\'aiguille est au vert · 6 cordes',
    'Faux = Epektase te tape sur les doigts (baka !)',
  ],
  ach: [['Oreille absolue', 'Luthier de l\'enfer', 'Accordé au cent près', 'Disciple d\'Epektase'], ['Doigts en compote', 'Sourd comme un pot', 'Baka certifié', 'Corde à linge']],
  news: (L, d) => `${L} A DÉSACCORDÉ LA FLYING V D'EPEKTASE : ${d} % ET LES DOIGTS TOUT ROUGES`,

  demo(view, x, y, w, h, t) {
    // les médaillons des joueurs ont leurs propres marionnettes : rendues une fois pendant l'explication (pas d'à-coup)
    const W0 = view.mv && view.mv.W, M0 = W0 && W0.mg;
    if (M0 && M0.ph === 'intro' && M0.t > 40 && !view.xs.warm3) {
      view.xs.warm3 = 1;
      for (let i = 0; i < 2; i++) view.puppet(W0.fighters[i === 0 ? M0.a : M0.v].char, -9999, -9999, 10, { key: `tunP${i}`, shadow: false });
      view.puppet('epektase', -9999, -9999, 10, { key: 'tunSensei', shadow: false, head: 1.8 });
    }
    const ctx = view.g, u = t % 6, bad = u >= 3, v = bad ? u - 3 : u;
    // le petit accordeur : l'aiguille glisse, dépasse, se pose au vert (A : parfait) ; ou A trop tôt (baka !)
    const cx = x + 66, n = bad ? (v < 1.1 ? -1 + v * 1.4 : 0.55 + Math.sin(t * 30) * 0.03) : (v < 1.6 ? -Math.exp(-2.4 * v) * Math.cos(5.5 * v) : 0);
    ctx.fillStyle = '#0b0610'; rr(ctx, cx - 58, y + 13, 116, 58, 10); ctx.fill();
    ctx.fillStyle = '#ff8ad8'; rr(ctx, cx - 56, y + 15, 112, 54, 9); ctx.fill();
    ctx.fillStyle = '#14202a'; rr(ctx, cx - 50, y + 19, 100, 44, 5); ctx.fill();
    gauge(ctx, cx + 10, y + 59, 26, n, 0.8, t);
    view.text(bad ? 'SOL' : 'LA', cx - 36, y + 53, 11, '#ffffff', { title: true });
    const say = !bad && v >= 1.6 ? ['A ✔ PARFAIT !', '#7cff8a'] : bad && v >= 1.1 ? ['A ✘ TROP AIGU', '#ff4a6a'] : ['stick ◀ ▶', '#ffe24a'];
    view.text(say[0], cx, y + 79, 10, say[1], { mono: true, alpha: say[0][0] === 's' && Math.sin(t * 12) < 0 ? 0.5 : 1 });
    // la tête de la guitare, la main sur la cheville, Epektase qui surveille
    ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.moveTo(w + x, y + 60); ctx.lineTo(x + 160, y + 52); ctx.lineTo(x + 150, y + 64); ctx.lineTo(x + 160, y + 76); ctx.lineTo(x + w, y + 70); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c81e24'; ctx.beginPath(); ctx.moveTo(w + x, y + 61); ctx.lineTo(x + 161, y + 54); ctx.lineTo(x + 153, y + 64); ctx.lineTo(x + 161, y + 74); ctx.lineTo(x + w, y + 69); ctx.closePath(); ctx.fill();
    const hx = x + 172, hy = y + 46, hit = bad && v >= 1.1 && v < 2.6;
    chibi(view, x + 228, y + 26, 13, hit ? 'angry' : !bad && v >= 1.6 ? 'happy' : 'idle', t, hit ? -1 : 0);
    hand(ctx, hx, hy, 8, hit ? Math.min(1, (v - 1.1) * 4) : 0, Math.sin(t * 6) * 0.4, true);
    if (hit) {
      const q = Math.min(1, (v - 1.1) / 0.12);
      harisen(ctx, hx, hy - 34, 0.5, -1.6 + q * 1.6);
      if (v < 1.9) view.text('BAKA !', hx - 10, y + 16, 13, '#ff4aa8', { mono: true });
    }
  },

  draw(view, W, M, dt) {
    const ctx = view.g, g = M.g, xs = ensure(view.xs), t = view.time;
    const L = -view.ox, Rr = 640 + view.ox, T = -view.oy, B = 360 + view.oy;
    // --- la scène : nuit violette, projecteurs qui balaient, notes et cœurs qui montent, le plancher
    const bg = ctx.createLinearGradient(0, T, 0, B); bg.addColorStop(0, '#1a0830'); bg.addColorStop(0.6, '#3a0f4a'); bg.addColorStop(1, '#5a1a5a');
    ctx.fillStyle = bg; ctx.fillRect(L, T, Rr - L, B - T);
    for (let k = 0; k < 2; k++) {
      const a = Math.sin(t * 0.9 + k * 2.2) * 0.5 + (k ? -0.35 : 0.35), ox = k ? Rr - 20 : L + 20;
      ctx.save(); ctx.translate(ox, T - 10); ctx.rotate(a); ctx.globalAlpha = 0.1 + view.beatPop * 0.05;
      ctx.fillStyle = k ? '#7ad8ff' : '#ff6ad5'; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.lineTo(90, 420); ctx.lineTo(-90, 420); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    for (let k = 0; k < 16; k++) {
      const fx = L + ((k * 83) % (Rr - L)), fy = B - ((t * (16 + (k % 4) * 7) + k * 47) % (B - T + 40));
      view.text(['♪', '♡', '♫', '✦'][k % 4], fx + Math.sin(t * 2 + k) * 8, fy, 10 + (k % 3) * 4, k % 2 ? '#ff9ae8' : '#ffffff', { stroke: false, alpha: 0.25 });
    }
    ctx.fillStyle = '#2a1020'; ctx.fillRect(L, 322, Rr - L, B - 322);
    ctx.fillStyle = '#4a2030'; for (let x = Math.floor(L / 46) * 46; x < Rr; x += 46) ctx.fillRect(x, 322, 2, B - 322);
    ctx.fillStyle = '#ff6ad5'; ctx.globalAlpha = 0.5; ctx.fillRect(L, 320, Rr - L, 2); ctx.globalAlpha = 1;
    // --- chaque moitié : l'accordeur, la tête de la guitare, la main
    for (let i = 0; i < 2; i++) half(view, W, M, g, i, dt);
    // --- le milieu : le titre, le chrono, Epektase
    view.text('🎸 L\'ACCORDEUR D\'EPEKTASE', 320, T + 16, 15, PINK, { title: true });
    view.timer(M, 320, T + 46);
    const md = xs.mood;
    md.t += dt;
    if (md.k !== 'idle' && md.t > (md.k === 'angry' ? 0.9 : 0.8)) { md.k = g.p[0].done || g.p[1].done ? 'happy' : 'idle'; md.t = 0; }
    const shk = md.k === 'angry' && md.t < 0.4 ? (0.4 - md.t) * 10 : 0;
    if (xs.no3 || !sensei(view, md, t, shk)) { xs.no3 = 1; chibi(view, 320 + (Math.random() - 0.5) * shk, 214 - (md.k === 'happy' ? Math.abs(Math.sin(t * 10)) * 6 : 0), 34, md.k, t, md.k === 'angry' ? (md.side ? 1 : -1) : 0); }
    // sa bulle
    if (xs.bub) {
      const b = xs.bub; b.t += dt;
      if (b.t > 1.1) xs.bub = null;
      else {
        const s = b.t < 0.1 ? 0.5 + b.t * 5 : 1;
        ctx.save(); ctx.translate(320, xs.no3 ? 128 : 96); ctx.scale(s, s); ctx.rotate(Math.sin(t * 20) * (b.angry ? 0.04 : 0.01));
        ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.ellipse(0, 0, 50, 18, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = b.angry ? '#ffe0f0' : '#ffffff'; ctx.beginPath(); ctx.ellipse(0, 0, 47, 15.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-6, 13); ctx.lineTo(4, 13); ctx.lineTo(-2, 30); ctx.closePath(); ctx.fill();
        view.text(b.text, 0, 1, b.text.length > 10 ? 10 : 13, b.angry ? '#ff2a7a' : '#d0208a', { mono: true, stroke: false });
        ctx.restore();
      }
    }
    // le portrait officiel, façon badge de concert (sans marionnette) ; sinon son titre à ses pieds
    if (xs.no3) { view.portraitAt('epektase', 320, 300, 22, PINK, false); view.text('SENSEI', 320, 318, 7, '#ffe0f4', { mono: true }); }
    else view.text('SENSEI', 320, 346, 9, '#ffe0f4', { mono: true });
    // les médaillons : le joueur tapé (sonné, tout rouge), qui a cassé sa corde, ou qui a fini (sa danse de victoire)
    if (!xs.no3) for (let i = 0; i < 2; i++) cam(view, W, M, i, dt);
  },

  onEvent(view, ev, W, M) {
    const A = view.audio, xs = ensure(view.xs);
    if (!M || ev.p === undefined) return;
    const i = ev.p, pan = i === 0 ? -0.5 : 0.5;
    if (ev.type === 'mgTuneOk') {
      const P = peg(Math.min(5, ev.s)), x = X(i, P.x), y = P.ky;
      const G = GRADE[ev.g];
      xs.ok[i] = 1; xs.pl[i] = 1;
      view.burst(x, y, ev.g === 1 ? 26 : 14, [G[1], '#ffffff', PINK], { shape: 'star', speed: 200, size: 5 });
      view.burst(X(i, TUNER[0]), TUNER[1], ev.g === 1 ? 10 : 5, ['#fff'], { shape: 'txt', ch: view.pick(['♡', '♪', '✨', '🎵']), speed: 150, size: 8, up: 120, life: 0.9 });
      view.sticker(`${G[0]} +${ev.pts}`, X(i, 140), 186, { size: ev.g === 1 ? 18 : 14, color: '#ffffff', bg: G[2], life: 0.8 });
      if (ev.f < 90) view.sticker(view.pick(['RAPIDE ⚡', 'EXPRESS', 'VITE FAIT']), X(i, 200), 60, { size: 12, color: '#0b0610', bg: '#7ad8ff', life: 0.7 });
      xs.mood = { k: 'happy', t: 0, side: i };
      xs.bub = { text: view.pick(SUGOI), t: 0, angry: 0 };
      view.jolt(ev.g === 1 ? 0.35 : 0.15, ev.g === 1 ? 0.04 : 0.015, ev.g === 1 ? '#c0ffd0' : null, 0.15);
      if (ev.g === 1) view.hype(0.3);
      if (A) {
        A.sfx('note', pan, 0.7, 1 + SEMI[ev.s] / 2);
        if (ev.g === 1) { A.sfx('powerchord', pan, 0.45); A.sfx('heart', 0, 0.4); }
        else A.sfx(ev.g === 2 ? 'blip' : 'wobble', pan, 0.4, 3);
      }
    } else if (ev.type === 'mgTuneBad') {
      const P = peg(ev.s), x = X(i, P.x), y = P.ky;
      xs.sm[i] = 1; xs.pl[i] = 1.4; xs.why[i] = 1; xs.cam[i] = { k: 'bad', t: view.time };
      xs.mood = { k: 'angry', t: 0, side: i };
      xs.bub = { text: view.pick(BAKA), t: 0, angry: 1 };
      view.burst(x, y, 22, ['#ffffff', '#ffe24a', '#ff4aa8'], { shape: 'star', speed: 260, size: 6, life: 0.5 });
      view.burst(x, y - 10, 5, ['#fff'], { shape: 'txt', ch: view.pick(['💢', '💔', '😵', '💥']), speed: 160, size: 10, up: 100, life: 0.9 });
      view.sticker(view.pick(['BAKA !', 'PAF !', 'AÏE !', 'TAC !']), X(i, 180), P.top ? 206 : 300, { size: 24, color: '#ffffff', bg: '#ff2a7a', life: 0.8 });
      view.sticker(`${ev.sd > 0 ? 'TROP AIGU' : 'TROP GRAVE'} (${ev.c} c)`, X(i, 140), 186, { size: 11, color: '#ffffff', bg: '#5a1030', life: 0.8, rot: 0 });
      view.jolt(0.7, 0.05, '#ff2a7a', 0.25);
      if (A) {
        A.sfx('slap', pan, 1); A.sfx('guitarHit', pan, 0.6); A.sfx('error', pan, 0.35);
        if (Math.random() < 0.6) A.say(view.pick(['Baka !', 'Baka baka !', 'C\'est faux !', 'Nan nan nan !']), 1.9, 1.35);
      }
    } else if (ev.type === 'mgTuneSnap') {
      const P = peg(ev.s);
      xs.snap[i] = 1; xs.pl[i] = 2; xs.why[i] = 2; xs.cam[i] = { k: 'snap', t: view.time };
      xs.mood = { k: 'shock', t: 0, side: i };
      xs.bub = { text: 'MA CORDE !!', t: 0, angry: 1 };
      view.burst(X(i, 180), NECK_Y, 30, ['#e8e8f0', '#ffe24a', '#ffffff'], { speed: 300, size: 4, life: 0.5 });
      view.sticker('CORDE CASSÉE 💥', X(i, 150), P.top ? 200 : 300, { size: 18, color: '#ffffff', bg: '#d0102a', life: 1 });
      view.jolt(1, 0.08, '#ffffff', 0.4); view.lines(0.3);
      if (A) { A.sfx('whip', pan, 1); A.sfx('guitarHitL', pan, 0.8); A.sfx('larsen', pan, 0.35); A.say('Ma corde !', 1.7, 1.3); }
    } else if (ev.type === 'mgTuneDone') {
      xs.mood = { k: 'happy', t: 0, side: i }; xs.cam[i] = { k: 'done', t: view.time };
      xs.bub = { text: 'ROCK STAR ♡', t: 0, angry: 0 };
      view.sticker(`ROCK STAR 🤘 +${ev.pts}`, X(i, 140), 150, { size: 20, color: '#0b0610', bg: '#ffe24a', life: 1.4 });
      if (ev.n >= 4) view.sticker(`${ev.n} PARFAITS !`, X(i, 140), 210, { size: 14, color: '#ffffff', bg: '#1f9a4a', life: 1.2 });
      view.confetti(50); view.hype(0.8); view.jolt(0.8, 0.08, '#fff0a0', 0.35); view.lines(0.4);
      view.emojiRain(['🎸', '🤘', '♡', '🎵'], 12);
      if (A) { A.sfx('shred', pan, 0.7); A.sfx('powerchord', pan, 0.6); A.sfx('airhorn', 0, 0.45); A.crowd(); }
    }
  },
};

// une moitié : en-tête, accordeur, tête de la guitare, cordes, main
function half(view, W, M, g, i, dt) {
  const ctx = view.g, P = g.p[i], slot = i === 0 ? M.a : M.v, xs = view.xs, t = view.time, A = view.audio, T = -view.oy;
  const col = COLORS[slot], pan = i === 0 ? -0.5 : 0.5;
  const s = Math.min(TUNE.STR - 1, P.s), e = P.done ? 0 : P.e;
  // la note qui glisse : un petit « ding » à chaque palier de 25 cents franchi, à la bonne hauteur
  const bk = Math.round(e / 25);
  if (M.ph === 'play' && !P.done && xs.gl[i] !== null && bk !== xs.gl[i] && t - xs.glT[i] > 0.06 && Math.abs(P.v) > 0.4) {
    xs.glT[i] = t;
    if (A) A.sfx('note', pan, 0.14, Math.max(0.2, Math.min(16, 1 + SEMI[s] / 2 + e / 200)));
  }
  xs.gl[i] = bk;
  // trop tendue : l'alarme
  const danger = !P.done && P.e > TUNE.SNAP - 160 && P.st <= 0;
  if (danger && M.ph === 'play' && t - xs.warn[i] > 0.5) { xs.warn[i] = t; if (A) A.sfx('wobble', pan, 0.3, 6); }
  for (const k of ['sm', 'ok', 'snap']) xs[k][i] = Math.max(0, xs[k][i] - dt * (k === 'sm' ? 1.4 : 2));
  xs.pl[i] = Math.max(0, xs.pl[i] - dt * 1.2);
  // en-tête : nom, score qui monte, les six cordes
  xs.shown[i] += (P.score - xs.shown[i]) * Math.min(1, dt * 10);
  const hx = X(i, 16), al = i === 0 ? 'left' : 'right';
  view.text(view.pname(slot), hx, T + 20, 14, col, { align: al, mono: true });
  view.text(String(Math.round(xs.shown[i])), hx, T + 44, 24, '#ffffff', { align: al, title: true });
  for (let k = 0; k < TUNE.STR; k++) {
    const dx = X(i, 92 + k * 16), gr = P.gr[k], cur = k === P.s && !P.done;
    ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.arc(dx, T + 44, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = gr ? GRADE[gr][1] : cur ? (Math.sin(t * 10) > 0 ? col : '#5a3a6a') : '#3a2a4a';
    ctx.beginPath(); ctx.arc(dx, T + 44, 5.5, 0, Math.PI * 2); ctx.fill();
    view.text(String(6 - k), dx, T + 45, 6, '#0b0610', { stroke: false, mono: true });
  }
  // --- l'accordeur à pince : un boîtier rose qui a un petit visage
  const cx = X(i, TUNER[0]), cy = TUNER[1], ok = Math.abs(e) <= TUNE.OK[0], good = Math.abs(e) <= TUNE.OK[2];
  const bump = xs.ok[i] * 4;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(1 + bump * 0.02, 1 + bump * 0.02); ctx.rotate(xs.sm[i] > 0.5 ? Math.sin(t * 50) * 0.04 : 0);
  ctx.fillStyle = '#0b0610'; rr(ctx, -104, -56, 208, 120, 22); ctx.fill();
  ctx.fillStyle = '#ff8ad8'; rr(ctx, -101, -53, 202, 114, 20); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; rr(ctx, -94, -50, 120, 8, 4); ctx.fill();
  // le visage du boîtier (sous l'écran)
  const face = P.done || xs.ok[i] > 0.2 ? 'happy' : xs.sm[i] > 0.2 || danger ? 'sad' : 'idle';
  ctx.fillStyle = '#0b0610';
  if (face === 'happy') { ctx.lineWidth = 2; ctx.strokeStyle = '#0b0610'; ctx.beginPath(); ctx.arc(-14, 52, 4, Math.PI, 0); ctx.stroke(); ctx.beginPath(); ctx.arc(14, 52, 4, Math.PI, 0); ctx.stroke(); }
  else if (face === 'sad') { view.text('>', -14, 52, 10, '#0b0610', { stroke: false, mono: true }); view.text('<', 14, 52, 10, '#0b0610', { stroke: false, mono: true }); }
  else { const bl = Math.sin(t * 2.3 + i) > 0.96; ctx.fillRect(-16, bl ? 52 : 49, 4, bl ? 1.5 : 5); ctx.fillRect(12, bl ? 52 : 49, 4, bl ? 1.5 : 5); }
  ctx.fillStyle = 'rgba(255,60,120,0.5)'; ctx.fillRect(-28, 54, 7, 3); ctx.fillRect(21, 54, 7, 3);
  ctx.fillStyle = '#14202a'; rr(ctx, -92, -40, 184, 82, 8); ctx.fill();
  if (ok && !P.done) { ctx.fillStyle = `rgba(80,255,140,${0.12 + Math.sin(t * 20) * 0.06})`; rr(ctx, -92, -40, 184, 82, 8); ctx.fill(); }
  // l'aiguille : ±50 cents sur l'arc, elle tremble près du but (et pendant le coup d'éventail)
  const jit = (Math.abs(e) < 30 ? 0.6 : 0.25) + xs.sm[i] * 6;
  const n = Math.max(-1.15, Math.min(1.15, (e + (Math.random() - 0.5) * jit) / 50));
  gauge(ctx, 0, 40, 52, P.done ? Math.sin(t * 3) * 0.05 : n, 1.5, t);
  // la note, la corde, l'écart en cents
  view.text(P.done ? '♡' : TUNE.NAMES[s], -66, 26, 20, P.done ? PINK : ok ? '#7cff8a' : good ? '#ffe24a' : '#ffffff', { title: true });
  view.text(P.done ? 'ACCORDÉE !' : `corde ${6 - s} · ${STR_NAME[s]}`, 0, -32, 8, '#9ab8c8', { mono: true, stroke: false });
  if (!P.done) {
    view.text('♭', -60, 2, 13, e < -TUNE.OK[0] ? '#ff9a5a' : '#3a4a5a', { stroke: false });
    view.text('♯', 60, 2, 13, e > TUNE.OK[0] ? '#ff9a5a' : '#3a4a5a', { stroke: false });
    view.text(`${e > 0 ? '+' : ''}${Math.round(e)}`, 68, 24, 12, ok ? '#7cff8a' : '#c8d8e8', { mono: true, stroke: false });
    view.text('cents', 68, 35, 6, '#7a8a9a', { mono: true, stroke: false });
    ctx.fillStyle = ok ? (Math.sin(t * 16) > 0 ? '#7cff8a' : '#2a8a4a') : good ? '#ffe24a' : '#5a2020';
    ctx.beginPath(); ctx.arc(-80, -32, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // les flèches qui disent où tourner
  if (!P.done && P.st <= 0) {
    const far = Math.abs(e) > 50, blink = Math.sin(t * 14) > 0;
    if (far) view.text(e > 0 ? '◀ ◀ TROP AIGU' : 'TROP GRAVE ▶ ▶', cx, cy + 74, 11, e > 0 ? '#ff9a5a' : '#7ad8ff', { mono: true, alpha: blink ? 1 : 0.55 });
    else if (ok) view.text('A ! A ! A !', cx, cy + 74, 13, '#7cff8a', { mono: true, alpha: blink ? 1 : 0.6 });
    if (danger) view.text('⚠ ÇA VA CASSER !', cx, cy + 90, 11, '#ff3a3a', { mono: true, alpha: blink ? 1 : 0.4 });
  } else if (!P.done && P.st > 0) {
    const snap = xs.why[i] === 2, q = P.st / (snap ? TUNE.SNAPT : TUNE.SMACK);
    view.text(snap ? 'CORDE NEUVE…' : 'AÏE AÏE AÏE', cx, cy + 74, 11, '#ff6a9a', { mono: true });
    ctx.fillStyle = '#0b0610'; ctx.fillRect(cx - 40, cy + 84, 80, 5); ctx.fillStyle = '#ff6a9a'; ctx.fillRect(cx - 39, cy + 85, 78 * Math.min(1, q), 3);
  }
  // --- la tête de la Flying V (dessinée pour la moitié gauche, en miroir pour la droite)
  ctx.save();
  if (i) { ctx.translate(640, 0); ctx.scale(-1, 1); }
  // le manche
  ctx.fillStyle = '#0b0610'; ctx.fillRect(NUT_X - 2, NECK_Y - 16, NECK_END - NUT_X + 4, 32);
  ctx.fillStyle = '#3a2216'; ctx.fillRect(NUT_X, NECK_Y - 14, NECK_END - NUT_X, 28);
  for (let f = 0; f < 5; f++) { const fx = NUT_X + 30 + f * 30 - f * f * 1.4; ctx.fillStyle = '#c8c8d0'; ctx.fillRect(fx, NECK_Y - 14, 2, 28); if (f === 1 || f === 3) { ctx.fillStyle = '#f0e8d8'; ctx.beginPath(); ctx.arc(fx - 13, NECK_Y, 2.5, 0, Math.PI * 2); ctx.fill(); } }
  // la tête : en pointe, rouge comme la guitare d'Epektase
  ctx.fillStyle = '#0b0610';
  ctx.beginPath(); ctx.moveTo(NUT_X + 2, NECK_Y - 18); ctx.lineTo(16, NECK_Y - 34); ctx.lineTo(4, NECK_Y); ctx.lineTo(16, NECK_Y + 34); ctx.lineTo(NUT_X + 2, NECK_Y + 18); ctx.closePath(); ctx.fill();
  ctx.fillStyle = P.done ? `hsl(${(t * 200) % 360},80%,55%)` : '#c81e24';
  ctx.beginPath(); ctx.moveTo(NUT_X, NECK_Y - 15); ctx.lineTo(18, NECK_Y - 30); ctx.lineTo(8, NECK_Y); ctx.lineTo(18, NECK_Y + 30); ctx.lineTo(NUT_X, NECK_Y + 15); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.moveTo(NUT_X - 4, NECK_Y - 12); ctx.lineTo(22, NECK_Y - 26); ctx.lineTo(26, NECK_Y - 22); ctx.lineTo(NUT_X - 4, NECK_Y - 8); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f0e8d8'; ctx.fillRect(NUT_X - 2, NECK_Y - 15, 4, 30); // le sillet
  // les cordes et les chevilles
  for (let k = 0; k < TUNE.STR; k++) {
    const p = peg(k), cur = k === P.s && !P.done;
    const amp = (cur ? xs.pl[i] * 3 + Math.min(2, Math.abs(P.v) * 0.4) : k < P.s ? 0.3 : 0) * (P.st > 0 && xs.snap[i] > 0 && cur ? 0 : 1);
    const tense = cur ? Math.max(0, Math.min(1, P.e / TUNE.SNAP)) : 0;
    ctx.strokeStyle = cur ? (tense > 0.6 ? `rgb(255,${Math.round(220 - tense * 160)},${Math.round(200 - tense * 160)})` : '#ffffff') : k < P.s ? '#e8d890' : '#a8a8b8';
    ctx.lineWidth = cur ? 1.8 : 1 + (5 - k) * 0.12;
    if (cur && xs.snap[i] > 0) {
      // la corde cassée : enroulée, qui pendouille
      ctx.beginPath(); ctx.moveTo(p.x, p.y);
      for (let q = 0; q < 14; q++) ctx.lineTo(p.x + 10 + q * 3 + Math.sin(q * 1.7 + t * 20) * 4, p.sy + Math.cos(q * 1.7) * 5 + q * 1.5);
      ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(NUT_X, p.sy);
      for (let q = 0; q <= 16; q++) { const x = NUT_X + (NECK_END + 20 - NUT_X) * q / 16; ctx.lineTo(x, p.sy + Math.sin(q / 16 * Math.PI) * Math.sin(t * 70 + k) * amp); }
      ctx.stroke();
    }
    // la cheville : un axe sur la tête, une clé qui dépasse (elle tourne pour la corde en cours)
    ctx.fillStyle = '#d8d8e0'; ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0b0610'; ctx.fillRect(p.x - 2, Math.min(p.y, p.ky), 4, Math.abs(p.ky - p.y));
    const rot = cur ? P.pk * 0.05 : k * 0.7;
    ctx.save(); ctx.translate(p.x, p.ky); ctx.scale(Math.abs(Math.cos(rot)) * 0.8 + 0.2, 1);
    ctx.fillStyle = '#0b0610'; ctx.fillRect(-7, -6, 14, 12);
    ctx.fillStyle = k < P.s || P.done ? GRADE[P.gr[k] || 1][1] : cur ? '#f0f0f8' : '#b8b8c8'; ctx.fillRect(-5.5, -4.5, 11, 9);
    ctx.restore();
  }
  ctx.restore();
  // la main sur la cheville en cours (rouge et pansée après un coup d'éventail)
  if (!P.done) {
    const p = peg(s), hx = X(i, p.x), hy = p.ky + (p.top ? -10 : 10);
    const red = Math.min(1, xs.sm[i] * 1.5 + (P.sk ? 0.25 : 0));
    hand(ctx, hx + (xs.sm[i] > 0.7 ? (Math.random() - 0.5) * 4 : 0), hy, 13, red, P.pk * 0.05, p.top);
    if (P.sk) view.text('🩹', hx + 6, hy - 4, 9, '#fff', { stroke: false });
    if (xs.sm[i] > 0) {
      // le coup d'éventail : il tombe vite, claque, puis repart
      const u = 1 - xs.sm[i], down = Math.min(1, u / 0.1), up = u > 0.45 ? (u - 0.45) / 0.55 : 0;
      const a = -1.6 * (1 - down) - 1.3 * up, rot = i ? -a : a;
      ctx.save(); ctx.globalAlpha = 1 - up;
      harisen(ctx, hx, hy - 60, 0.95, rot, i === 1);
      ctx.restore();
      if (u < 0.15) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; for (let k = 0; k < 6; k++) { const a = k * 1.05 + 0.3; ctx.beginPath(); ctx.moveTo(hx + Math.cos(a) * 14, hy + Math.sin(a) * 14); ctx.lineTo(hx + Math.cos(a) * 26, hy + Math.sin(a) * 26); ctx.stroke(); } }
      if (u > 0.1 && u < 0.7) view.text('💢', hx + (i ? -18 : 18), hy - 18 - u * 10, 12, '#fff', { stroke: false });
    }
  } else {
    view.text('🤘', X(i, 60), NECK_Y - 50 + Math.sin(t * 8 + i) * 4, 22, '#fff', { stroke: false });
    view.text('ROCK STAR', X(i, 180), NECK_Y - 34, 13, `hsl(${(t * 300) % 360},100%,65%)`, { mono: true });
  }
}

// l'arc de l'accordeur et son aiguille (n : -1 à 1 = -50 à +50 cents) ; r : rayon
function gauge(ctx, cx, cy, r, n, lw, t) {
  const a0 = -Math.PI / 2, span = Math.PI / 3;
  const zone = (from, to, c) => { ctx.strokeStyle = c; ctx.lineWidth = 5 * lw; ctx.beginPath(); ctx.arc(cx, cy, r, a0 + from * span, a0 + to * span); ctx.stroke(); };
  zone(-1, 1, '#3a2030'); zone(-0.5, 0.5, '#7a5a20'); zone(-0.24, 0.24, '#9a8a20'); zone(-0.1, 0.1, '#2aaa5a');
  ctx.strokeStyle = '#8aa0b0'; ctx.lineWidth = 1;
  for (let k = -5; k <= 5; k++) { const a = a0 + k / 5 * span, l = k % 5 === 0 ? 9 : 5; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (r + 4), cy + Math.sin(a) * (r + 4)); ctx.lineTo(cx + Math.cos(a) * (r + 4 + l), cy + Math.sin(a) * (r + 4 + l)); ctx.stroke(); }
  const a = a0 + Math.max(-1.15, Math.min(1.15, n)) * span, ok = Math.abs(n) <= 0.1;
  ctx.strokeStyle = '#0b0610'; ctx.lineWidth = 4 * lw; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * (r + 6), cy + Math.sin(a) * (r + 6)); ctx.stroke();
  ctx.strokeStyle = ok ? '#7cff8a' : '#ff5a8a'; ctx.lineWidth = 2 * lw; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * (r + 6), cy + Math.sin(a) * (r + 6)); ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(cx, cy, 3 * lw, 0, Math.PI * 2); ctx.fill();
  void t;
}

// une petite main kawaii (un poing rond, le pouce) ; red : 0..1 (tapée), flip : tournée vers le haut
function hand(ctx, x, y, r, red, rot, flip) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(rot) * 0.25); if (flip) ctx.scale(1, -1);
  const sk = `rgb(${Math.round(242 + 13 * red)},${Math.round(201 - 120 * red)},${Math.round(160 - 110 * red)})`;
  ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.ellipse(0, 0, r + 2, r * 0.85 + 2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = sk; ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.85, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(80,30,20,0.5)'; ctx.lineWidth = 1;
  for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(k * r * 0.4, r * 0.1); ctx.lineTo(k * r * 0.4, r * 0.7); ctx.stroke(); }
  ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.ellipse(-r * 0.9, -r * 0.2, r * 0.42, r * 0.3, -0.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = sk; ctx.beginPath(); ctx.ellipse(-r * 0.9, -r * 0.2, r * 0.32, r * 0.22, -0.5, 0, Math.PI * 2); ctx.fill();
  // le bras (une manche noire, comme le sweat d'Epektase... ou le tien)
  ctx.fillStyle = '#0b0610'; ctx.fillRect(-r * 0.5, r * 0.6, r, r * 1.6);
  ctx.fillStyle = '#4a3a5a'; ctx.fillRect(-r * 0.4, r * 0.7, r * 0.8, r * 1.5);
  if (red > 0.3) { ctx.fillStyle = `rgba(255,40,60,${(red - 0.3) * 0.6})`; ctx.beginPath(); ctx.arc(0, 0, r * 1.25, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

// l'éventail en papier (harisen) : le manche à l'origine, les plis roses vers le bas (rot : 0 = il tape vers le bas)
function harisen(ctx, x, y, s, rot, flip) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(flip ? -s : s, s);
  ctx.fillStyle = '#0b0610'; ctx.fillRect(-5, -2, 10, 25);
  ctx.fillStyle = '#ffe24a'; ctx.fillRect(-3.5, 0, 7, 22);
  ctx.fillStyle = '#ff2a7a'; ctx.fillRect(-3.5, 5, 7, 3); ctx.fillRect(-3.5, 12, 7, 3);
  ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.moveTo(-4, 20); ctx.lineTo(4, 20); ctx.lineTo(31, 67); ctx.lineTo(-31, 67); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ff9ae0'; ctx.beginPath(); ctx.moveTo(-3, 22); ctx.lineTo(3, 22); ctx.lineTo(28, 65); ctx.lineTo(-28, 65); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
  for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(k * 0.8, 22); ctx.lineTo(k * 8, 65); ctx.stroke(); }
  ctx.font = "bold 12px 'Arial Black', sans-serif"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ff2a7a'; ctx.fillText('♡', 0, 52);
  ctx.restore();
}

// Epektase en chibi : sa vraie tête (le portrait, dans un rond), ses cheveux longs, un corps de poche en sweat noir,
// son carré Hermès, sa Flying V dans le dos, l'éventail à la main. mood : idle, happy, angry, shock ; look : -1 / 1
function chibi(view, x, y, r, mood, t, look) {
  const ctx = view.g;
  ctx.save(); ctx.translate(x, y);
  // la Flying V dans le dos
  ctx.save(); ctx.translate(0, r * 1.3); ctx.rotate(0.5);
  ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.moveTo(0, -r * 1.6); ctx.lineTo(r * 0.75, r * 0.9); ctx.lineTo(r * 0.1, r * 0.3); ctx.lineTo(-r * 0.1, r * 0.3); ctx.lineTo(-r * 0.75, r * 0.9); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#c81e24'; ctx.beginPath(); ctx.moveTo(0, -r * 0.2); ctx.lineTo(r * 0.68, r * 0.84); ctx.lineTo(r * 0.12, r * 0.24); ctx.lineTo(-r * 0.12, r * 0.24); ctx.lineTo(-r * 0.68, r * 0.84); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#3a2216'; ctx.fillRect(-r * 0.06, -r * 1.5, r * 0.12, r * 1.35);
  ctx.restore();
  // les cheveux longs, derrière
  ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.ellipse(0, r * 0.45, r * 1.12, r * 1.25, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#5a3420'; ctx.beginPath(); ctx.ellipse(0, r * 0.45, r * 1.06, r * 1.19, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#7a4a2a'; for (let k = -2; k <= 2; k++) ctx.fillRect(k * r * 0.4 - 1, r * 0.4, 2, r * 1.1);
  // le corps : sweat noir, carré Hermès orange, petits bras
  const bob = mood === 'happy' ? Math.sin(t * 14) * r * 0.05 : 0;
  ctx.fillStyle = '#0b0610'; rr(ctx, -r * 0.62, r * 0.85 + bob, r * 1.24, r * 0.95, r * 0.25); ctx.fill();
  ctx.fillStyle = '#2a2430'; rr(ctx, -r * 0.56, r * 0.9 + bob, r * 1.12, r * 0.86, r * 0.22); ctx.fill();
  ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.moveTo(-r * 0.45, r * 0.82); ctx.lineTo(r * 0.45, r * 0.82); ctx.lineTo(0, r * 1.32); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e86c12'; ctx.beginPath(); ctx.moveTo(-r * 0.4, r * 0.85); ctx.lineTo(r * 0.4, r * 0.85); ctx.lineTo(0, r * 1.26); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#1c2848'; ctx.fillRect(-r * 0.12, r * 0.92, r * 0.24, r * 0.14);
  ctx.fillStyle = '#d9a63a'; ctx.fillRect(-r * 0.05, r * 0.95, r * 0.1, r * 0.08);
  // les jambes
  ctx.fillStyle = '#0b0610'; ctx.fillRect(-r * 0.42, r * 1.75, r * 0.32, r * 0.4); ctx.fillRect(r * 0.1, r * 1.75, r * 0.32, r * 0.4);
  // la tête : le portrait dans un rond (tourné un peu vers celui qu'il gronde)
  const tilt = (look || 0) * 0.15 + (mood === 'happy' ? Math.sin(t * 7) * 0.1 : 0);
  ctx.save(); ctx.rotate(tilt);
  ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.arc(0, 0, r + 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip();
  const sz = r / 0.29;
  view.portraitAt('epektase', -0.075 * sz, 0.15 * sz, sz, '#5a3420', false);
  // les joues roses, la rougeur de la colère
  if (mood === 'angry') { ctx.fillStyle = 'rgba(255,40,60,0.28)'; ctx.fillRect(-r, -r, r * 2, r * 2); }
  ctx.fillStyle = mood === 'angry' ? 'rgba(255,40,80,0.6)' : 'rgba(255,110,170,0.4)';
  ctx.beginPath(); ctx.ellipse(-r * 0.36, r * 0.12, r * 0.13, r * 0.07, 0, 0, Math.PI * 2); ctx.ellipse(r * 0.4, r * 0.12, r * 0.13, r * 0.07, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.restore();
  // un bras tient l'éventail : levé à côté de la tête, agité quand il est content, brandi vers celui qu'il gronde
  const side = look < 0 ? -1 : 1, ang = mood === 'angry' ? 1.25 + Math.sin(t * 30) * 0.25 : mood === 'happy' ? 0.2 + Math.sin(t * 10) * 0.35 : 0.3 + Math.sin(t * 2) * 0.05;
  ctx.save(); ctx.translate(r * 0.6 * side, r * 1.0); ctx.rotate(ang * side);
  ctx.fillStyle = '#0b0610'; ctx.fillRect(-r * 0.13, -r * 0.6, r * 0.26, r * 0.66);
  ctx.fillStyle = '#2a2430'; ctx.fillRect(-r * 0.08, -r * 0.55, r * 0.16, r * 0.58);
  ctx.fillStyle = '#f2c9a0'; ctx.beginPath(); ctx.arc(0, -r * 0.62, r * 0.14, 0, Math.PI * 2); ctx.fill();
  harisen(ctx, 0, -r * 0.5, r / 52, Math.PI, look >= 0);
  ctx.restore();
  // les petits signes kawaii
  if (mood === 'angry') {
    view.text('💢', r * 0.85, -r * 0.8 + Math.sin(t * 20) * 2, r * 0.6, '#fff', { stroke: false });
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; for (let k = 0; k < 3; k++) { const q = (t * 2 + k / 3) % 1; ctx.beginPath(); ctx.arc(-r * 0.9 - q * r * 0.5, -r * 0.6 - q * r * 0.6, r * 0.12 * (1 - q) + 1, 0, Math.PI * 2); ctx.fill(); }
  } else if (mood === 'happy') {
    for (let k = 0; k < 3; k++) { const q = (t * 0.9 + k / 3) % 1; view.text('♡', (k - 1) * r * 0.8 + Math.sin(t * 4 + k) * 4, -r * 1.1 - q * r, r * 0.4 * (1 - q * 0.5), '#ff6ad5', { stroke: false, alpha: 1 - q }); }
  } else if (mood === 'shock') {
    view.text('!!', r * 0.9, -r * 0.9, r * 0.55, '#ffe24a', { mono: true });
  } else {
    if (Math.sin(t * 1.3) > 0.7) view.text('♪', r * 0.95, -r * 0.7 - Math.sin(t * 3) * 3, r * 0.4, '#ff9ae8', { stroke: false });
  }
  ctx.restore();
}

// Epektase en vrai modèle 3D, chibi (grosse tête), au milieu : il se dandine au rythme ; content, il danse sa victoire ;
// fâché, il gonfle, rougit et tremble en regardant le fautif ; choqué (corde cassée), il est sonné et s'étire. Son
// éventail en papier flotte à côté de lui (brandi quand il gronde). false si les marionnettes ne marchent pas ici.
function sensei(view, md, t, shk) {
  const ctx = view.g, x = 320 + (Math.random() - 0.5) * shk * 1.5, y = 336, h = 150, look = md.side ? 1 : -1;
  const o = { key: 'tunSensei', head: 2.1, face: 'front' };
  let sq = [1 + view.beatPop * 0.04, 1 - view.beatPop * 0.04], rot = 0, hop = 0;
  if (md.k === 'happy') { o.emote = 'win'; hop = Math.abs(Math.sin(t * 10)) * 6; }
  else if (md.k === 'angry') {
    o.state = 'idle'; o.face = look > 0 ? 'three' : 'threeL'; o.tint = '#ff1a3a'; o.tintK = 0.45 * Math.max(0, 1 - md.t / 0.9);
    const k = Math.max(0, 1 - md.t / 0.9); sq = [1 + 0.16 * k, 1 - 0.1 * k]; rot = Math.sin(t * 60) * 0.06 * k;
  } else if (md.k === 'shock') { o.state = 'dizzy'; const k = Math.max(0, 1 - md.t / 0.8); sq = [1 - 0.15 * k, 1 + 0.22 * k]; }
  else o.emote = Math.sin(t * 0.7) > 0.75 ? 'select' : null;
  if (!view.puppet('epektase', x, y - hop, h, { ...o, squash: sq, rot })) return false;
  // l'éventail (harisen) qui flotte à sa main
  const side = md.k === 'angry' ? look : 1, ang = md.k === 'angry' ? Math.PI + side * (1.1 + Math.sin(t * 30) * 0.5) : md.k === 'happy' ? Math.PI + Math.sin(t * 10) * 0.5 : Math.PI + 0.3 + Math.sin(t * 2) * 0.08;
  harisen(ctx, x + side * h * 0.38, y - hop - h * 0.62, 0.62, ang, side < 0);
  // les petits signes kawaii au-dessus de sa (grosse) tête
  const hy = y - hop - h * 1.22, r = 40;
  if (md.k === 'angry') {
    view.text('💢', x + r * 0.95, hy + Math.sin(t * 20) * 2, 22, '#fff', { stroke: false });
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; for (let k = 0; k < 3; k++) { const q = (t * 2 + k / 3) % 1; ctx.beginPath(); ctx.arc(x - r - q * r * 0.6, hy + 10 - q * r * 0.6, r * 0.14 * (1 - q) + 1, 0, Math.PI * 2); ctx.fill(); }
  } else if (md.k === 'happy') {
    for (let k = 0; k < 3; k++) { const q = (t * 0.9 + k / 3) % 1; view.text('♡', x + (k - 1) * r * 0.9 + Math.sin(t * 4 + k) * 4, hy - q * r, 15 * (1 - q * 0.5), '#ff6ad5', { stroke: false, alpha: 1 - q }); }
  } else if (md.k === 'shock') view.text('!!', x + r, hy, 20, '#ffe24a', { mono: true });
  else if (Math.sin(t * 1.3) > 0.7) view.text('♪', x + r, hy + 10 - Math.sin(t * 3) * 3, 14, '#ff9ae8', { stroke: false });
  return true;
}

// le médaillon d'un joueur (le vrai modèle) : tapé sur les doigts (sonné, rouge, écrasé), corde cassée (étoiles), fini (danse)
function cam(view, W, M, i, dt) {
  const xs = view.xs, c = xs.cam[i];
  if (!c) return;
  const a = view.time - c.t, life = c.k === 'done' ? 1.8 : 1.1;
  if (a > life) { xs.cam[i] = null; return; }
  void dt;
  const ctx = view.g, slot = i === 0 ? M.a : M.v, cx = X(i, 214), cy = 150, w = 76, h = 96;
  const s = a < 0.12 ? 0.4 + a / 0.12 * 0.75 : a > life - 0.15 ? Math.max(0, (life - a) / 0.15) : 1.15 - Math.min(0.15, (a - 0.12) * 1.2);
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s); ctx.rotate((i ? 1 : -1) * 0.07);
  ctx.fillStyle = '#0b0610'; rr(ctx, -w / 2 - 3, -h / 2 - 3, w + 6, h + 6, 10); ctx.fill();
  ctx.fillStyle = c.k === 'done' ? '#ffe24a' : '#ff2a7a'; rr(ctx, -w / 2, -h / 2, w, h, 8); ctx.fill();
  ctx.fillStyle = c.k === 'done' ? '#fff6b0' : '#ffd0e4'; rr(ctx, -w / 2 + 4, -h / 2 + 4, w - 8, h - 8, 6); ctx.fill();
  ctx.save(); rr(ctx, -w / 2 + 4, -h / 2 + 4, w - 8, h - 8, 6); ctx.clip();
  const o = { key: `tunP${i}`, head: 1.7, shadow: false, face: i === 0 ? 'three' : 'threeL' };
  if (c.k === 'done') o.emote = 'win';
  else if (c.k === 'snap') o.state = 'dizzy';
  else { o.state = 'hitstun'; o.kb = 25; o.tint = '#ff1a1a'; o.tintK = 0.5 * Math.max(0, 1 - a); }
  const k = c.k === 'bad' ? Math.exp(-5 * a) : 0;
  view.puppet(W.fighters[slot].char, 0, h / 2 + (c.k === 'bad' ? 24 : 44), 100, { ...o, squash: [1 + 0.3 * k, 1 - 0.25 * k], rot: (Math.random() - 0.5) * 0.2 * k });
  ctx.restore();
  view.text(c.k === 'done' ? 'ROCK STAR 🤘' : c.k === 'snap' ? 'MA CORDE…' : 'AÏE !', 0, h / 2 - 8, 10, '#ffffff', { mono: true });
  if (c.k === 'bad') view.text('💢', w / 2 - 10, -h / 2 + 12, 16, '#fff', { stroke: false });
  ctx.restore();
}

// un rectangle aux coins arrondis (le chemin seulement)
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}
