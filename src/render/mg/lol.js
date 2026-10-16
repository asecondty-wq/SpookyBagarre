// Le larbin de J'san (lol), l'affichage : la chambre de J'san (néons, posters), son écran (une partie de MOBA générique :
// la carte, les couloirs, les sbires, son champion, la barre de la partie, sa facecam en 3D, le chat qui défile), le vrai
// J'san en 3D de dos sur sa chaise de gamer (il joue ; il se retourne, se lève de rage, grosse tête quand il crie), son
// shiba qui dort. Sa bulle réclame (de plus en plus fort) ; chaque larbin (le vrai perso du joueur, en 3D) a son plateau
// en croix (haut whey, droite canette « MONSTRE », bas créatine, gauche riz-poulet), court lui tendre la chose : il boit,
// il mange, « let's go ! », ou il la renvoie à la tête du larbin (BONK, sonné) et rage.
import { LOL } from '../../sim/mg/lol.js';
import { COLORS } from '../../sim/constants.js';

const GREEN = '#3cff7a';
const EMO = ['💪', '⚡', '💊', '🍗'];
const LABEL = ['WHEY', 'MONSTRE', 'CRÉATINE', 'RIZ-POULET'];
const SAY = ['Whey !', 'Monstre !', 'Créatine !', 'Riz poulet !'];
const ARROW = ['▲', '▶', '▼', '◀'];
const DIR = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // où est chaque objet sur le plateau
const TRAY_Y = 298, TRAY_R = 34;
const MON = { x: 150, y: 36, w: 340, h: 166 };
const GOOD = ['LET\'S GO !', 'MERCI FRÉROT', 'LE GOAT 🐐', 'GAINS +1 💪', 'C\'EST ÇA !', 'T\'ES UN BOSS'];
const RAGE = ['T\'ES SÉRIEUX ?!', 'TILT 💢', 'C\'EST PAS ÇA !', 'MAIS NOOON', 'TU VEUX MA MORT ?'];
const NICKS = ['shibalover', 'gymbro92', 'xX_larbin_Xx', 'maman_de_jsan', 'protein_queen', 'le_coach', 'tilté_du_75', 'monstre_addict', 'riz_au_poulet', 'jungler_afk'];
const CHAT = {
  good: ['LET\'S GOOO', 'GG', 'gains +1', 'il est chaud', 'propre', 'le larbin est carré', 'BOSS'],
  bad: ['😂😂😂', 'tilt', 'c\'est pas ça frérot', 'le larbin fait exprès', 'report larbin', 'LOL'],
  late: ['ff 15', 'il est mort lol', 'personne ?', 'gg go next', 'les larbins dorment'],
  ask: ['il a soif', 'vite vite', 'WHEY WHEY WHEY', 'il va tilt', 'go go go'],
};
const X = (i, x) => (i === 0 ? x : 640 - x);
const LAR_X = 186, LAR_Y = 356, JS_X = 320, JS_Y = 432; // les larbins (leurs pieds), J'san (ses pieds, sous le bureau)

function ensure(xs) {
  if (xs.on) return xs;
  xs.on = 1; xs.fly = []; xs.reach = null; xs.face = { k: 'idle', t: 0 }; xs.chat = []; xs.bub = 0; xs.rage = 0; xs.kill = 0; xs.dead = 0;
  xs.shown = [0, 0]; xs.shake = [0, 0]; xs.press = [-1, -1]; xs.pressT = [0, 0]; xs.typ = 0; xs.ask = 0; xs.bonk = [0, 0]; xs.lar = [null, null];
  return xs;
}
function chat(view, kind) {
  const xs = view.xs;
  xs.chat.push({ n: view.pick(NICKS), m: view.pick(CHAT[kind]), c: `hsl(${(Math.random() * 360) | 0},90%,70%)`, t: 0 });
  if (xs.chat.length > 9) xs.chat.shift();
}

export default {
  title: 'LE LARBIN DE J\'SAN', color: GREEN, icon: '🎮',
  puppets: ['jsan'],
  goal: 'Donne à J\'san ce qu\'il réclame, avant l\'autre !',
  keys: [['dirs', 'donner']],
  ach: [['Larbin de l\'année', 'Coach en nutrition', 'Meilleur pote de J\'san', 'Livreur Uber Whey'], ['Viré par J\'san', 'Créatine tiède', 'Tilteur professionnel', 'Larbin en carton']],
  news: (L, d) => `${L} VIRÉ PAR J'SAN : « TU M'AS RAMENÉ DE LA CRÉATINE TIÈDE » (+${d} %)`,

  draw(view, W, M, dt) {
    const ctx = view.g, g = M.g, xs = ensure(view.xs), t = view.time, A = view.audio;
    const L = -view.ox, Rr = 640 + view.ox, T = -view.oy, B = 360 + view.oy;
    for (const k of ['rage', 'kill', 'dead', 'bub', 'ask']) xs[k] = Math.max(0, xs[k] - dt * (k === 'dead' ? 1 : 2.5));
    xs.face.t += dt;
    if (xs.face.k !== 'idle' && xs.face.t > 1) xs.face = { k: 'idle', t: 0 };
    // l'ambiance : il tape sur son clavier, clique
    if (M.ph === 'play' && A && t - xs.typ > 0.9) { xs.typ = t; A.sfx(Math.random() < 0.7 ? 'typing' : 'click', 0, 0.12 + g.tilt / 600); }
    // --- la chambre : mur sombre, bande de LED, posters
    const wall = ctx.createLinearGradient(0, T, 0, B); wall.addColorStop(0, '#0c0a1c'); wall.addColorStop(1, '#1c1230');
    ctx.fillStyle = wall; ctx.fillRect(L, T, Rr - L, B - T);
    const hue = (t * 60) % 360;
    const led = ctx.createLinearGradient(0, T, 0, T + 60); led.addColorStop(0, `hsla(${hue},100%,60%,0.45)`); led.addColorStop(1, `hsla(${hue},100%,60%,0)`);
    ctx.fillStyle = led; ctx.fillRect(L, T, Rr - L, 60);
    ctx.fillStyle = `hsl(${hue},100%,65%)`; ctx.fillRect(L, T, Rr - L, 3);
    poster(view, L + 22, 46, 'NO PAIN', 'NO GAIN', '💪', '#d02a2a', -0.05);
    poster(view, Rr - 112, 44, 'SHIBA', 'GANG', '🐕', '#e08a2a', 0.06);
    // --- le bureau, l'écran
    ctx.fillStyle = '#0b0610'; ctx.fillRect(L, 208, Rr - L, 30);
    ctx.fillStyle = '#2a1e2e'; ctx.fillRect(L, 210, Rr - L, 26);
    ctx.fillStyle = `hsla(${(hue + 120) % 360},100%,60%,0.6)`; ctx.fillRect(L, 236, Rr - L, 2);
    monitor(view, W, M, g, dt);
    // le clavier RGB et la souris
    for (let k = 0; k < 14; k++) { ctx.fillStyle = `hsl(${(hue + k * 24) % 360},90%,${xs.rage > 0 && Math.random() < 0.5 ? 80 : 55}%)`; ctx.fillRect(266 + k * 5.5 + (xs.rage ? (Math.random() - 0.5) * 3 : 0), 218 + (k % 2) * 4, 4.5, 3.5); }
    ctx.fillStyle = '#0b0610'; rr(ctx, 262, 214, 82, 16, 3); ctx.globalAlpha = 0.35; ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.ellipse(366, 223, 7, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `hsl(${(hue + 200) % 360},90%,60%)`; ctx.fillRect(365, 216, 2, 4);
    // une canette vide, un pot de whey sur le bureau (le décor)
    drawItem(ctx, 1, 214, 220, 8, t); drawItem(ctx, 0, 436, 218, 10, t);
    // --- J'san de dos, sa bulle
    jsan(view, M, g, xs, t, dt);
    bubble(view, W, M, g, xs, t);
    // --- les larbins : un plateau chacun
    for (let i = 0; i < 2; i++) larbin(view, W, M, g, i, xs, t);
    for (let i = 0; i < 2; i++) tray(view, W, M, g, i, dt);
    shiba(view, JS_X + 4, 350, t, xs);
    // les objets qui volent
    xs.fly = xs.fly.filter((f) => (f.t += dt) < f.dur + (f.back ? 0.45 : 0));
    for (const f of xs.fly) {
      let q = Math.min(1, f.t / f.dur), x = f.x0 + (f.x1 - f.x0) * q, y = f.y0 + (f.y1 - f.y0) * q - Math.sin(q * Math.PI) * 50;
      if (f.back && f.t > f.dur) { const b = (f.t - f.dur) / 0.45, tx = X(f.p, LAR_X), ty = LAR_Y - 112; x = f.x1 + (tx - f.x1) * b; y = f.y1 + (ty - f.y1) * b - Math.sin(b * Math.PI) * 70; }
      ctx.save(); ctx.translate(x, y); ctx.rotate(f.t * (f.back ? 18 : 6) * (f.x1 > f.x0 ? 1 : -1)); drawItem(ctx, f.k, 0, 0, 12, t); ctx.restore();
    }
    // BONK : l'objet renvoyé arrive
    for (let i = 0; i < 2; i++) {
      if (!(xs.bonk[i] > 0) || (xs.bonk[i] -= dt) > 0) continue;
      view.sticker(view.pick(['BONK 💥', 'AÏE', 'DANS LA TÊTE']), X(i, LAR_X), LAR_Y - 150, { size: 16, color: '#0b0610', bg: '#ffe24a', life: 0.7 });
      view.burst(X(i, LAR_X), LAR_Y - 112, 14, ['#ffffff', '#ffe24a'], { shape: 'star', speed: 200, size: 5, life: 0.5 });
      view.burst(X(i, LAR_X), LAR_Y - 112, 3, ['#fff'], { shape: 'txt', ch: '💫', speed: 90, size: 10, up: 40, life: 0.9 });
      xs.lar[i] = { k: 'bonk', t0: t };
      view.jolt(0.4, 0.03);
      if (A) A.sfx('thud', i ? 0.4 : -0.4, 0.8);
    }
    // le titre, le chrono, le compteur de tilt
    view.text('🎮 LE LARBIN DE J\'SAN', L + 12, T + 16, 13, GREEN, { align: 'left', title: true });
    view.timer(M, 320, T + 18);
    tilt(view, g, t);
  },

  onEvent(view, ev, W, M) {
    const A = view.audio, xs = ensure(view.xs);
    if (!M || !ev.type.startsWith('mgLol')) return;
    const g = M.g;
    if (ev.type === 'mgLolAsk') {
      xs.bub = 1; xs.ask = 1;
      if (Math.random() < 0.5) chat(view, 'ask');
      const to = ev.to >= 0 ? (ev.to === 0 ? M.a : M.v) : -1;
      if (A) {
        A.sfx('blip', 0, 0.5, 2 + ev.loud * 2);
        if (ev.loud >= 2) A.sfx('whoosh', 0, 0.3);
        const what = ev.n > 1 ? `${SAY[ev.k].slice(0, -2)}, ${SAY[ev.k2].slice(0, -2)}${ev.n > 2 ? ', ' + SAY[ev.k3].slice(0, -2) : ''} !` : SAY[ev.k];
        A.say(to >= 0 ? `${view.pname(to)}, ${what}` : what, 0.3, 1.1 + ev.loud * 0.15);
      }
      if (ev.loud >= 2) view.jolt(0.25 + ev.loud * 0.1, 0.02);
      if (to >= 0) view.sticker(`${view.pname(to)} ! TOI !`, X(ev.to, 92), 196, { size: 14, color: '#0b0610', bg: COLORS[to], life: 0.9 });
    } else if (ev.type === 'mgLolStep') {
      const i = ev.p, s = from(i, ev.k);
      xs.fly.push({ k: ev.k, x0: s[0], y0: s[1], x1: 320, y1: 214, t: 0, dur: 0.22, back: 0 });
      xs.press[i] = ev.k; xs.pressT[i] = 0.25; xs.reach = { side: i, t: 0 }; xs.lar[i] = { k: 'run', t0: view.time };
      view.burst(s[0], s[1], 8, [GREEN, '#ffffff'], { shape: 'star', speed: 140, size: 4, life: 0.4 });
      view.sticker(`${ev.i}/${ev.n}`, X(i, 168), 276, { size: 14, color: '#ffffff', bg: COLORS[i === 0 ? M.a : M.v], life: 0.5, rot: 0 });
      if (A) { A.sfx('pop', i ? 0.4 : -0.4, 0.6, 2 + ev.i); A.sfx('whoosh', 0, 0.25); }
    } else if (ev.type === 'mgLolGood') {
      const i = ev.p, s = from(i, ev.k), slot = i === 0 ? M.a : M.v;
      xs.fly.push({ k: ev.k, x0: s[0], y0: s[1], x1: 320, y1: 214, t: 0, dur: 0.22, back: 0 });
      xs.press[i] = ev.k; xs.pressT[i] = 0.25; xs.reach = { side: i, t: 0 };
      xs.face = { k: 'hype', t: 0, side: i }; xs.kill = 1; xs.lar[i] = { k: 'good', t0: view.time };
      chat(view, 'good'); if (Math.random() < 0.5) chat(view, 'good');
      view.burst(320, 214, 26, [GREEN, '#ffffff', '#ffe24a'], { shape: 'star', speed: 240, size: 5 });
      view.burst(320, 200, 6, ['#fff'], { shape: 'txt', ch: EMO[ev.k], speed: 180, size: 10, up: 140, life: 1 });
      view.sticker(view.pick(GOOD), 320 + (i ? 70 : -70), 190, { size: 18, color: '#0b0610', bg: GREEN, life: 0.8 });
      view.sticker(`+${ev.pts}`, X(i, 172), 270, { size: 16, color: '#ffffff', bg: COLORS[slot], life: 0.7, rot: 0 });
      if (ev.f < 26) view.sticker(view.pick(['ÉCLAIR ⚡', 'RÉFLEXES DE FOU', 'TROP RAPIDE']), X(i, 120), 210, { size: 12, color: '#0b0610', bg: '#ffe24a', life: 0.7 });
      if (ev.both) view.sticker('EX AEQUO !', 320, 120, { size: 16, color: '#ffffff', bg: '#7a3aff', life: 0.8 });
      const st = { 3: 'SÉRIE x3 🔥', 5: 'LARBIN EN FEU 🔥🔥', 7: 'LARBIN LÉGENDAIRE 👑' }[ev.st];
      if (st) { view.sticker(st, X(i, 120), 186, { size: 16, color: '#ffffff', bg: '#ff3a3a', life: 1 }); view.hype(0.6); }
      if (ev.st >= 5) view.emojiRain(['💪', '🍗', '⚡', '🔥'], 10);
      view.jolt(0.3 + ev.n * 0.12, 0.03, ev.n >= 2 ? '#c0ffd0' : null, 0.2);
      if (A) {
        A.sfx(['gulp', 'fizz', 'gulp', 'slurp'][ev.k], 0, 0.8); A.sfx(['slurp', 'glug', 'pop', 'gulp'][ev.k], 0, 0.5);
        A.sfx('cash', i ? 0.4 : -0.4, 0.5); A.sfx('hitmark', 0, 0.5);
        if (ev.st >= 3) A.sfx('airhorn', 0, 0.45);
        if (Math.random() < 0.55) A.say(view.pick(['Let\'s go !', 'Merci frérot !', 'Let\'s gooo !', 'C\'est ça !']), 0.3, 1.2);
      }
    } else if (ev.type === 'mgLolWrong') {
      const i = ev.p, s = from(i, ev.k);
      xs.fly.push({ k: ev.k, x0: s[0], y0: s[1], x1: 320, y1: 214, t: 0, dur: 0.2, back: 1, p: i });
      xs.press[i] = ev.k; xs.pressT[i] = 0.25; xs.reach = { side: i, t: 0 }; xs.shake[i] = 1;
      xs.face = { k: 'rage', t: 0, side: i }; xs.rage = 1; xs.lar[i] = { k: 'run', t0: view.time };
      chat(view, 'bad');
      view.burst(268 + Math.random() * 70, 222, 12, ['#ff3a3a', '#3aff7a', '#3a8aff', '#ffe24a'], { speed: 200, size: 4, life: 0.6, up: 160 });
      view.sticker(ev.nf ? 'C\'EST PAS TOI QUE J\'APPELLE !' : view.pick(RAGE), 320, 112, { size: ev.nf ? 13 : 18, color: '#ffffff', bg: '#d01030', life: 0.9 });
      xs.bonk[i] = 0.62; // l'objet renvoyé arrive sur la tête du larbin
      view.jolt(0.7, 0.05, '#ff2020', 0.25);
      if (A) {
        A.sfx('throw', 0, 0.7); A.sfx('error', 0, 0.5);
        A.say(ev.nf ? 'C\'est pas toi !' : view.pick(['T\'es sérieux ?', 'C\'est quoi ça ?', `J'ai dit ${SAY[ev.w].slice(0, -2)} !`, 'Mais non !']), 0.3, 1.45);
      }
    } else if (ev.type === 'mgLolLate') {
      xs.face = { k: 'rage', t: 0, side: -1 }; xs.rage = 1; xs.dead = 1;
      for (let i = 0; i < 2; i++) if (!xs.lar[i] || xs.lar[i].k !== 'bonk') xs.lar[i] = { k: 'late', t0: view.time };
      chat(view, 'late'); chat(view, 'late');
      view.sticker(view.pick(['VOUS SERVEZ À RIEN', 'TROP LENTS !', 'IL EST MORT 💀', 'FF 15 ?']), 320, 120, { size: 18, color: '#ffffff', bg: '#5a1030', life: 1 });
      view.burst(320, 214, 8, ['#fff'], { shape: 'txt', ch: view.pick(['💀', '😡', '💢']), speed: 180, size: 11, up: 120, life: 1 });
      view.jolt(0.8, 0.06, '#400010', 0.4);
      if (A) { A.sfx('ko', 0, 0.6); A.sfx('bark', 0.2, 0.5); A.say(view.pick(['Vous servez à rien !', 'Trop lents !', 'Je suis mort !']), 0.3, 1.4); }
      void g;
    }
  },
};

// d'où part l'objet k du plateau du joueur i
function from(i, k) { return [X(i, 92) + DIR[k][0] * TRAY_R, TRAY_Y + DIR[k][1] * TRAY_R]; }

// un poster de chambre
function poster(view, x, y, l1, l2, em, col, rot) {
  const ctx = view.g;
  ctx.save(); ctx.translate(x + 45, y + 40); ctx.rotate(rot);
  ctx.fillStyle = '#0b0610'; ctx.fillRect(-47, -42, 94, 84);
  ctx.fillStyle = col; ctx.fillRect(-44, -39, 88, 78);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(-44, 14, 88, 25);
  view.text(em, 0, -10, 26, '#fff', { stroke: false });
  view.text(l1, 0, 20, 10, '#ffffff', { mono: true });
  view.text(l2, 0, 32, 10, '#ffe24a', { mono: true });
  ctx.fillStyle = '#c8c8c8'; ctx.fillRect(-3, -42, 6, 4);
  ctx.restore();
}

// l'écran : la partie de MOBA (carte, couloir, rivière, bases, sbires, champions), la barre de la partie, la facecam, le chat
function monitor(view, W, M, g, dt) {
  const ctx = view.g, xs = view.xs, t = view.time, { x, y, w, h } = MON;
  ctx.fillStyle = '#05050a'; rr(ctx, x - 6, y - 6, w + 12, h + 12, 6); ctx.fill();
  ctx.fillStyle = '#1a1a24'; ctx.fillRect(x + w / 2 - 14, y + h + 6, 28, 6); ctx.fillRect(x + w / 2 - 34, y + h + 10, 68, 4);
  const sx = x, sy = y, sw = w, sh = h;
  ctx.save(); ctx.beginPath(); ctx.rect(sx, sy, sw, sh); ctx.clip();
  // la carte
  ctx.fillStyle = '#2a5a32'; ctx.fillRect(sx, sy, sw, sh);
  ctx.fillStyle = '#23502c'; for (let k = 0; k < 9; k++) { ctx.beginPath(); ctx.ellipse(sx + ((k * 97) % sw), sy + ((k * 61) % sh), 26, 14, k, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = '#3a6aa8'; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(sx - 10, sy - 10); ctx.lineTo(sx + sw + 10, sy + sh + 10); ctx.stroke();
  ctx.strokeStyle = 'rgba(160,200,255,0.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx - 10, sy - 6 + Math.sin(t * 3) * 2); ctx.lineTo(sx + sw + 10, sy + sh + 14 + Math.sin(t * 3) * 2); ctx.stroke();
  const ax = sx + 84, ay = sy + sh - 20, bx = sx + sw - 114, by = sy + 40; // le couloir, de la base bleue à la rouge
  ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 18; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
  ctx.strokeStyle = '#a0804a'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
  const at = (u) => [ax + (bx - ax) * u, ay + (by - ay) * u];
  for (const [u, c] of [[0.02, '#3a8aff'], [0.98, '#ff3a3a']]) { const [px, py] = at(u); ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.arc(px, py, 15, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = c; ctx.beginPath(); ctx.arc(px, py, 12, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(px - 3, py - 9, 6, 12); }
  for (const u of [0.25, 0.75]) { const [px, py] = at(u); ctx.fillStyle = '#0b0610'; ctx.fillRect(px - 5, py - 14, 10, 16); ctx.fillStyle = u < 0.5 ? '#6a9aff' : '#ff6a6a'; ctx.fillRect(px - 3, py - 12, 6, 12); }
  // les sbires qui marchent (bleus vers la droite, rouges vers la gauche)
  const front = 0.5 + g.tug / 260;
  for (let k = 0; k < 6; k++) {
    const ub = Math.min(front - 0.02, 0.06 + ((t * 0.05 + k * 0.07) % 0.45)), ur = Math.max(front + 0.02, 0.94 - ((t * 0.05 + k * 0.07) % 0.45));
    const [p1x, p1y] = at(ub), [p2x, p2y] = at(ur);
    ctx.fillStyle = '#6ab0ff'; ctx.fillRect(p1x - 2 + (k % 2) * 4, p1y - 2 + (k % 3) * 2 - 2, 3, 3);
    ctx.fillStyle = '#ff7a7a'; ctx.fillRect(p2x - 2 + (k % 2) * 4, p2y - 2 + (k % 3) * 2 - 2, 3, 3);
  }
  // les champions : celui de J'san (bleu, une haltère au-dessus), deux rouges en face
  const [cx, cy] = at(front - 0.05), dead = xs.dead > 0;
  for (let k = 0; k < 2; k++) {
    const [ex, ey] = at(front + 0.07 + k * 0.05);
    const hit = xs.kill > 0 && k === 0;
    ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.arc(ex + k * 6, ey + k * 8, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = hit ? '#ffffff' : '#ff3a3a'; ctx.beginPath(); ctx.arc(ex + k * 6, ey + k * 8, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0b0610'; ctx.fillRect(ex + k * 6 - 7, ey + k * 8 - 11, 14, 3); ctx.fillStyle = '#ff3a3a'; ctx.fillRect(ex + k * 6 - 6, ey + k * 8 - 10, 12 * (hit ? 0.1 : 0.7), 1.5);
  }
  if (xs.kill > 0) { const [ex, ey] = at(front + 0.07); ctx.strokeStyle = '#ffe24a'; ctx.lineWidth = 2; for (let k = 0; k < 8; k++) { const a = k * 0.785 + t; ctx.beginPath(); ctx.moveTo(ex + Math.cos(a) * 6, ey + Math.sin(a) * 6); ctx.lineTo(ex + Math.cos(a) * (10 + (1 - xs.kill) * 16), ey + Math.sin(a) * (10 + (1 - xs.kill) * 16)); ctx.stroke(); } }
  ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.arc(cx, cy, 7.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = dead ? '#6a6a7a' : '#3a8aff'; ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - 6, cy - 14, 12, 2); ctx.fillRect(cx - 7, cy - 16, 3, 6); ctx.fillRect(cx + 4, cy - 16, 3, 6);
  if (!dead && Math.sin(t * 9) > 0) { ctx.strokeStyle = '#7ad8ff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx + 6, cy); ctx.lineTo(cx + 16, cy - 6 + Math.sin(t * 30) * 3); ctx.stroke(); }
  // le haut de l'écran : le nom, les éliminations, l'or, l'heure de la partie
  ctx.fillStyle = 'rgba(0,0,10,0.75)'; ctx.fillRect(sx, sy, sw, 15);
  view.text('J\'SAN_GYMBRO', sx + 6, sy + 8, 8, '#7ad8ff', { align: 'left', mono: true, stroke: false });
  view.text(`⚔ ${g.kills} / ${g.deaths}`, sx + 112, sy + 8, 8, '#ffffff', { align: 'left', mono: true, stroke: false });
  view.text(`🪙 ${1240 + g.kills * 300 + Math.floor(M.t / 6) * 3}`, sx + 164, sy + 8, 8, '#ffd23a', { align: 'left', mono: true, stroke: false });
  const gm = 23 + Math.floor((M.t / 60 + 40) / 60), gs = Math.floor(M.t / 60 + 40) % 60;
  view.text(`${gm}:${String(gs).padStart(2, '0')}`, sx + sw - 6, sy + 8, 8, '#ffffff', { align: 'right', mono: true, stroke: false });
  // la barre de la partie (bleu contre rouge)
  const q = 0.5 + g.tug / 200;
  ctx.fillStyle = '#0b0610'; ctx.fillRect(sx + 70, sy + 18, sw - 140, 7);
  ctx.fillStyle = '#3a8aff'; ctx.fillRect(sx + 71, sy + 19, (sw - 142) * q, 5);
  ctx.fillStyle = '#ff3a3a'; ctx.fillRect(sx + 71 + (sw - 142) * q, sy + 19, (sw - 142) * (1 - q), 5);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(sx + 70 + (sw - 140) * q - 1, sy + 16, 2, 11);
  // la facecam (en bas à gauche)
  const fx = sx + 34, fy = sy + sh - 34;
  ctx.fillStyle = '#0b0610'; ctx.fillRect(fx - 30, fy - 30, 60, 60);
  face(view, fx, fy, 26, xs.face.k, t);
  ctx.strokeStyle = GREEN; ctx.lineWidth = 2; ctx.strokeRect(fx - 28, fy - 28, 56, 56);
  view.text('● LIVE', fx - 26, fy - 22, 6, '#ff3a3a', { align: 'left', mono: true, stroke: false, alpha: Math.sin(t * 5) > 0 ? 1 : 0.5 });
  // le chat (à droite)
  ctx.fillStyle = 'rgba(0,0,10,0.55)'; ctx.fillRect(sx + sw - 92, sy + 30, 92, sh - 30);
  view.text('CHAT', sx + sw - 88, sy + 37, 6, '#9a9ab8', { align: 'left', mono: true, stroke: false });
  xs.chat.forEach((c, n) => {
    c.t += dt;
    const yy = sy + sh - 8 - (xs.chat.length - 1 - n) * 13;
    if (yy < sy + 44) return;
    view.text(c.n + ':', sx + sw - 88, yy - 4, 5.5, c.c, { align: 'left', mono: true, stroke: false });
    view.text(c.m, sx + sw - 86, yy + 2.5, 6.5, '#ffffff', { align: 'left', stroke: false });
  });
  // mort : l'écran grisé, l'heure de réapparition ; la fin : victoire ou défaite
  if (dead) {
    ctx.fillStyle = `rgba(40,40,50,${0.6 * Math.min(1, xs.dead * 2)})`; ctx.fillRect(sx, sy, sw - 92, sh);
    view.text('VOUS ÊTES MORT', sx + (sw - 92) / 2, sy + sh / 2 - 6, 16, '#ff4a4a', { mono: true, alpha: Math.min(1, xs.dead * 2) });
    view.text(`réapparition dans ${Math.ceil(xs.dead * 8)}`, sx + (sw - 92) / 2, sy + sh / 2 + 10, 8, '#e8e8f0', { mono: true, alpha: Math.min(1, xs.dead * 2) });
  }
  if (M.ph === 'outro') {
    const win = g.tug >= 0;
    ctx.fillStyle = 'rgba(0,0,10,0.6)'; ctx.fillRect(sx, sy, sw, sh);
    view.text(win ? 'VICTOIRE' : 'DÉFAITE', sx + sw / 2, sy + sh / 2, 34, win ? '#ffd23a' : '#ff3a3a', { title: true });
  }
  // le verre : reflet, lignes
  ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + sw * 0.4, sy); ctx.lineTo(sx + sw * 0.15, sy + sh); ctx.lineTo(sx, sy + sh); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// la tête de J'san dans un carré (sa facecam) : le vrai J'san en 3D, de face, grosse tête ; hype (il saute de joie),
// rage (rouge, il hurle) ; sans 3D, son portrait
function face(view, x, y, r, mood, t, key = 'jcam') {
  const ctx = view.g, sh = mood === 'rage' ? 3 : 0, up = mood === 'hype' ? Math.abs(Math.sin(t * 14)) * 3 : 0;
  ctx.save(); ctx.beginPath(); ctx.rect(x - r, y - r, r * 2, r * 2); ctx.clip();
  const o = mood === 'rage' ? { emote: 'angry_01', head: 1.9, tint: '#ff2020', tintK: 0.2 } : mood === 'hype' ? { emote: 'cheer', head: 1.75 } : { state: 'idle', head: 1.5 };
  const ok = view.puppet('jsan', x + (Math.random() - 0.5) * sh, y + r * 4 - up + (Math.random() - 0.5) * sh, r * 4.67, { ...o, key, shadow: false });
  if (!ok) {
    const sz = r * 2 / 0.62;
    view.portraitAt('jsan', x + (Math.random() - 0.5) * sh, y + 0.2 * sz - r * 0.15 - up + (Math.random() - 0.5) * sh, sz * (mood === 'hype' ? 1.06 : 1), '#1a1424', false);
  }
  if (mood === 'rage') { ctx.fillStyle = `rgba(255,30,30,${0.18 + Math.sin(t * 30) * 0.08})`; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
  ctx.restore();
  if (mood === 'rage') view.text('💢', x + r * 0.6, y - r * 0.6, r * 0.6, '#fff', { stroke: false });
  if (mood === 'hype') view.text('🔥', x - r * 0.65, y - r * 0.6 - up, r * 0.5, '#fff', { stroke: false });
}

// J'san de dos, sur sa chaise de gamer : le vrai J'san en 3D. Il joue (assis, les mains sur sa partie) ; il réclame
// (grosse tête) ; il se retourne vers le larbin qui le sert ; « let's go » : il se lève et lève les bras ; une erreur :
// il se lève de rage, tout rouge, la tête énorme, tourné vers le coupable. Sans 3D : le dessin au canevas (jsan2D).
function jsan(view, M, g, xs, t, dt) {
  const ctx = view.g, rage = xs.rage, sh = rage > 0 ? (Math.random() - 0.5) * rage * 6 : 0;
  let reach = -1;
  if (xs.reach) { xs.reach.t += dt; reach = xs.reach.side; if (xs.reach.t > 0.45) xs.reach = null; }
  const fk = xs.face.k, loud = g.ph === 'ask' && M.ph === 'play' ? Math.min(3, ((M.t / 150) | 0) + (g.tilt > 50 ? 1 : 0)) : 0;
  let o;
  if (M.ph === 'outro') o = g.tug >= 0 ? { emote: 'win', head: 1.7 } : { emote: 'sob', head: 1.8 };
  else if (fk === 'rage') o = { emote: xs.dead > 0 ? 'angry_01' : 'angry_02', head: 2.1 + Math.abs(Math.sin(t * 18)) * 0.15, tint: '#ff2020', tintK: 0.12 + 0.08 * Math.sin(t * 20) };
  else if (fk === 'hype') o = { emote: 'cheer', head: 1.8, emoteSpeed: 1.2 };
  else if (loud >= 2) o = { emote: 'complain_01', head: 1.45 + loud * 0.15 };
  else o = { emote: 'play_mobile_game', head: 1.35 };
  const side = fk !== 'idle' && xs.face.side >= 0 ? xs.face.side : reach;
  const turn = side === 0 ? 0.5 : side === 1 ? -0.5 : 0;
  const sit = o.emote === 'play_mobile_game'; // assis ; debout (il se lève), il descend un peu pour garder la tête sous la bulle
  if (!view.puppet('jsan', JS_X + sh, JS_Y + (sit ? 0 : 20), 265, { ...o, key: 'boss', face: Math.PI + turn, shadow: false })) { jsan2D(view, g, xs, t, reach); return; }
  chair(view, JS_X + sh * 0.3, 296);
  // la vapoteuse posée sur le bureau, un petit nuage de temps en temps
  if (Math.sin(t * 0.8) > 0.92) { ctx.fillStyle = 'rgba(230,230,255,0.35)'; ctx.beginPath(); ctx.arc(JS_X + 40 + (t % 1) * 10, 190 - (t % 1) * 20, 8 + (t % 1) * 8, 0, Math.PI * 2); ctx.fill(); }
  // la rage : des traits de colère au-dessus de la tête
  if (rage > 0) { ctx.strokeStyle = '#ff3a3a'; ctx.lineWidth = 3; for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(JS_X + k * 16, 168); ctx.lineTo(JS_X + k * 21, 154 - Math.random() * 5); ctx.stroke(); } }
}

// la chaise de gamer, de dos (le dossier cache le bas du dos de J'san)
function chair(view, hx, top) {
  const ctx = view.g, DARK = '#0b0610';
  ctx.fillStyle = DARK; rr(ctx, hx - 48, top, 96, 96, 12); ctx.fill();
  ctx.fillStyle = '#1e1e26'; rr(ctx, hx - 45, top + 3, 90, 90, 10); ctx.fill();
  ctx.fillStyle = GREEN; ctx.fillRect(hx - 37, top + 6, 6, 84); ctx.fillRect(hx + 31, top + 6, 6, 84);
  view.text('GYM', hx, top + 30, 9, GREEN, { mono: true, stroke: false });
  view.text('RAT', hx, top + 42, 9, GREEN, { mono: true, stroke: false });
}

// un larbin : le vrai perso du joueur, en 3D, grosse tête, à côté de son plateau ; il court tendre la chose à J'san,
// lève les bras quand c'est bon, prend le BONK (sonné, étoiles), se plaint quand J'san meurt
function larbin(view, W, M, g, i, xs, t) {
  const slot = i === 0 ? M.a : M.v, P = g.p[i], L = xs.lar[i], lt = L ? t - L.t0 : 99;
  const called = g.ph === 'ask' && M.ph === 'play' && g.to === i;
  let o, dx = 0;
  const lunge = (d) => { o = { state: 'run' }; dx = Math.sin(Math.min(1, lt / d) * Math.PI) * 30; };
  if (M.ph === 'outro') o = P.score >= g.p[1 - i].score ? { emote: 'win' } : { emote: 'sob' };
  else if (L && L.k === 'bonk' && lt < 1.3) o = lt < 0.35 ? { state: 'hitstun', kb: 150 } : { state: 'dizzy' };
  else if (L && L.k === 'run' && lt < 0.32) lunge(0.32);
  else if (L && L.k === 'good' && lt < 1.1) { if (lt < 0.3) lunge(0.3); else o = { emote: 'cheer', emoteSpeed: 1.3 }; }
  else if (L && L.k === 'late' && lt < 1.2) o = { emote: 'complain_01' };
  else if (P.lock > 0) o = { state: 'dizzy' };
  else if (called) o = { emote: 'agree' };
  else if (P.streak >= 5) o = { emote: 'dance_01' };
  else o = { state: 'idle' };
  const head = 1.45 + (L && lt < 0.6 ? (0.6 - lt) * 0.9 : 0);
  view.puppet(W.fighters[slot].char, X(i, LAR_X + dx), LAR_Y, 118, { ...o, key: 'lar' + i, face: i === 0 ? 'three' : 'threeL', head });
}

// (sans 3D) J'san dessiné de dos, sur sa chaise : cheveux bouclés, casque, débardeur, épaules de déménageur ; un bras
// part vers le larbin
function jsan2D(view, g, xs, t, reach) {
  const ctx = view.g, rage = xs.rage, sh = rage > 0 ? (Math.random() - 0.5) * rage * 5 : 0, bob = Math.sin(t * 3) * 1;
  const hx = 320 + sh, hy = 224 + bob;
  const SKIN = '#c98a5a', DARK = '#0b0610';
  // les bras : vers le clavier et la souris, ou tendu vers le plateau d'un larbin
  const rq = xs.reach ? Math.sin(Math.min(1, xs.reach.t / 0.45) * Math.PI) : 0;
  for (let s = 0; s < 2; s++) {
    const sx = hx + (s ? 40 : -40), sy = hy + 26;
    let ex = s ? 366 : 300, ey = 224;
    if (rage > 0.3) { ey = 216 + Math.abs(Math.sin(t * 25 + s)) * 10; ex = s ? 350 : 290; } // il tape sur le bureau
    if (reach === s) { ex = ex + (X(s, 140) - ex) * rq; ey = ey + (276 - ey) * rq; }
    ctx.lineCap = 'round';
    ctx.strokeStyle = DARK; ctx.lineWidth = 15; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.strokeStyle = SKIN; ctx.lineWidth = 11; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.fillStyle = DARK; ctx.beginPath(); ctx.arc(ex, ey, 7.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = SKIN; ctx.beginPath(); ctx.arc(ex, ey, 6, 0, Math.PI * 2); ctx.fill();
    ctx.lineCap = 'butt';
  }
  // le dos : épaules larges, débardeur blanc
  ctx.fillStyle = DARK; ctx.beginPath(); ctx.ellipse(hx, hy + 44, 52, 26, 0, Math.PI, 0); ctx.lineTo(hx + 44, hy + 90); ctx.lineTo(hx - 44, hy + 90); ctx.closePath(); ctx.fill();
  ctx.fillStyle = SKIN; ctx.beginPath(); ctx.ellipse(hx, hy + 44, 49, 23, 0, Math.PI, 0); ctx.lineTo(hx + 42, hy + 90); ctx.lineTo(hx - 42, hy + 90); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f4f4f8'; ctx.beginPath(); ctx.moveTo(hx - 30, hy + 30); ctx.lineTo(hx - 20, hy + 28); ctx.lineTo(hx - 12, hy + 52); ctx.lineTo(hx + 12, hy + 52); ctx.lineTo(hx + 20, hy + 28); ctx.lineTo(hx + 30, hy + 30); ctx.lineTo(hx + 36, hy + 90); ctx.lineTo(hx - 36, hy + 90); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(hx - 1, hy + 54, 2, 36);
  // la chaise de gamer (le dossier cache le bas du dos)
  ctx.fillStyle = DARK; rr(ctx, hx - 40, hy + 58, 80, 92, 12); ctx.fill();
  ctx.fillStyle = '#1e1e26'; rr(ctx, hx - 37, hy + 61, 74, 86, 10); ctx.fill();
  ctx.fillStyle = GREEN; ctx.fillRect(hx - 30, hy + 64, 6, 80); ctx.fillRect(hx + 24, hy + 64, 6, 80);
  view.text('GYM', hx, hy + 84, 9, GREEN, { mono: true, stroke: false });
  view.text('RAT', hx, hy + 96, 9, GREEN, { mono: true, stroke: false });
  // la tête de dos : la nuque, les boucles, le casque
  ctx.fillStyle = DARK; ctx.beginPath(); ctx.arc(hx, hy, 24, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = SKIN; ctx.fillRect(hx - 9, hy + 14, 18, 16);
  ctx.fillStyle = '#4a2a18'; ctx.beginPath(); ctx.arc(hx, hy - 1, 22, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#6a4028';
  for (let k = 0; k < 9; k++) { const a = k * 0.7 + 0.3, rr2 = k % 3 === 0 ? 8 : 14; ctx.beginPath(); ctx.arc(hx + Math.cos(a) * rr2, hy - 2 + Math.sin(a) * rr2 * 0.9, 5.5, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = DARK; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(hx, hy + 2, 25, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
  ctx.strokeStyle = '#2a2a34'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(hx, hy + 2, 25, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
  for (const s of [-1, 1]) { ctx.fillStyle = DARK; rr(ctx, hx + s * 25 - 7, hy - 2, 14, 20, 5); ctx.fill(); ctx.fillStyle = `hsl(${(t * 120) % 360},100%,60%)`; ctx.fillRect(hx + s * 25 - 2, hy + 3, 4, 10); }
  // la vapoteuse posée sur le bureau, un petit nuage de temps en temps
  if (Math.sin(t * 0.8) > 0.92) { ctx.fillStyle = 'rgba(230,230,255,0.35)'; ctx.beginPath(); ctx.arc(hx + 30 + (t % 1) * 10, hy - 30 - (t % 1) * 20, 8 + (t % 1) * 8, 0, Math.PI * 2); ctx.fill(); }
  // la rage : des traits de colère au-dessus de la tête
  if (rage > 0) { ctx.strokeStyle = '#ff3a3a'; ctx.lineWidth = 3; for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(hx + k * 14, hy - 30); ctx.lineTo(hx + k * 18, hy - 42 - Math.random() * 4); ctx.stroke(); } }
  void g;
}

// la bulle : ce qu'il veut (1 à 3 objets), le temps qui reste, qui il appelle, où en sont les deux larbins
function bubble(view, W, M, g, xs, t) {
  const ctx = view.g;
  if (g.ph !== 'ask' || M.ph !== 'play') {
    if (g.ph === 'gap' && M.ph === 'play' && g.t < 30) view.text(xs.dead > 0 ? '😡' : ['😋', '😎', '💪'][g.n % 3], 320, 170, 18, '#fff', { stroke: false, alpha: 1 - g.t / 30 });
    return;
  }
  const n = g.req.length, loud = Math.min(3, ((M.t / 150) | 0) + (g.tilt > 50 ? 1 : 0));
  const bw = 64 + n * 58, bh = 62, cx = 320, cy = 136;
  const pop = xs.bub > 0.6 ? 1 + (xs.bub - 0.6) * 1.2 : 1, shake = loud >= 2 ? (Math.random() - 0.5) * loud * 1.2 : 0;
  ctx.save(); ctx.translate(cx + shake, cy + shake); ctx.scale(pop, pop); ctx.rotate(Math.sin(t * 18) * 0.01 * loud);
  ctx.fillStyle = '#0b0610'; rr(ctx, -bw / 2 - 3, -bh / 2 - 3, bw + 6, bh + 6, 16); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-12, bh / 2); ctx.lineTo(12, bh / 2); ctx.lineTo(0, bh / 2 + 26); ctx.closePath(); ctx.fill();
  ctx.fillStyle = loud >= 3 ? '#ffe0e0' : '#ffffff'; rr(ctx, -bw / 2, -bh / 2, bw, bh, 14); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-9, bh / 2 - 2); ctx.lineTo(9, bh / 2 - 2); ctx.lineTo(0, bh / 2 + 21); ctx.closePath(); ctx.fill();
  for (let k = 0; k < n; k++) {
    const ix = -bw / 2 + 61 + k * 58, done0 = g.p[0].prog > k, done1 = g.p[1].prog > k;
    drawItem(ctx, g.req[k], ix, -8, 16 + (k === 0 ? Math.sin(t * 12) * 1 : 0), t);
    if (n > 1 && k < n - 1) view.text('+', ix + 29, -8, 16, '#0b0610', { stroke: false, mono: true });
    if (n > 1) {
      ctx.fillStyle = done0 ? COLORS[M.a] : 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.arc(ix - 7, 17, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = done1 ? COLORS[M.v] : 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.arc(ix + 7, 17, 3.5, 0, Math.PI * 2); ctx.fill();
    }
  }
  // le cri : de plus en plus fort
  const word = g.req.map((k) => LABEL[k]).join(' + ');
  const shout = loud === 0 ? `${word} stp` : loud === 1 ? `${word} !` : loud === 2 ? `${word} !!!` : `${word.replace(/E/g, 'EEE')} !!!!`;
  ctx.restore();
  view.text(shout, cx + shake, cy + bh / 2 + 34, loud >= 2 ? 13 : 11, loud >= 3 ? '#ff3a3a' : loud >= 2 ? '#ff8a3a' : '#ffffff', { mono: true });
  // le temps qui reste
  const left = Math.max(0, 1 - g.t / g.dl);
  ctx.fillStyle = '#0b0610'; ctx.fillRect(cx - bw / 2 + 10, cy + bh / 2 - 9, bw - 20, 6);
  ctx.fillStyle = left > 0.5 ? GREEN : left > 0.25 ? '#ffd23a' : (Math.sin(t * 30) > 0 ? '#ff3a3a' : '#ffffff');
  ctx.fillRect(cx - bw / 2 + 11, cy + bh / 2 - 8, (bw - 22) * left, 4);
  // il appelle quelqu'un
  if (g.to >= 0) {
    const slot = g.to === 0 ? M.a : M.v;
    view.text(`${g.to === 0 ? '◀ ' : ''}${view.pname(slot)}, TOI !${g.to === 1 ? ' ▶' : ''}`, cx, cy - bh / 2 - 12, 14, COLORS[slot], { mono: true });
  }
}

// le plateau d'un larbin : les quatre objets en croix, le nom, le score ; les mains prises après une erreur
function tray(view, W, M, g, i, dt) {
  const ctx = view.g, P = g.p[i], slot = i === 0 ? M.a : M.v, xs = view.xs, t = view.time;
  const col = COLORS[slot], lock = P.lock > 0, called = g.ph === 'ask' && g.to === i, other = g.ph === 'ask' && g.to >= 0 && g.to !== i;
  xs.shake[i] = Math.max(0, xs.shake[i] - dt * 2.5); xs.pressT[i] = Math.max(0, xs.pressT[i] - dt);
  const cx = X(i, 92) + (xs.shake[i] > 0 ? (Math.random() - 0.5) * xs.shake[i] * 8 : 0), cy = TRAY_Y;
  xs.shown[i] += (P.score - xs.shown[i]) * Math.min(1, dt * 10);
  // le plateau
  ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.arc(cx, cy, 52, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = lock ? '#3a1020' : called ? `rgba(${Math.sin(t * 16) > 0 ? '60,120,60' : '30,70,40'},1)` : '#2a2238'; ctx.beginPath(); ctx.arc(cx, cy, 49, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, 49, 0, Math.PI * 2); ctx.stroke();
  for (let k = 0; k < 4; k++) {
    if (xs.pressT[i] > 0 && xs.press[i] === k) continue; // il est parti en l'air
    const ix = cx + DIR[k][0] * TRAY_R, iy = cy + DIR[k][1] * TRAY_R, want = g.ph === 'ask' && g.req[P.prog] === k && !other;
    ctx.save(); if (lock) ctx.globalAlpha = 0.4;
    drawItem(ctx, k, ix, iy, 11.5 + (want ? 1.5 + Math.sin(t * 10) * 0.8 : 0), t);
    ctx.restore();
  }
  for (let k = 0; k < 4; k++) view.text(ARROW[k], cx + DIR[k][0] * 17, cy + DIR[k][1] * 17, 8, lock ? '#5a4060' : '#c8b8e8', { stroke: false });
  // le nom, le score
  view.text(view.pname(slot), cx, cy - 76, 13, col, { mono: true });
  view.text(String(Math.round(xs.shown[i])), cx, cy - 61, 15, '#ffffff', { title: true });
  if (P.streak >= 2) view.text(`🔥 x${P.streak}`, cx + (i ? -62 : 62), cy - 40, 10, '#ffd23a', { mono: true });
  if (lock) {
    view.text('MAINS PRISES', cx, cy - 10, 9, '#ff6a8a', { mono: true });
    ctx.fillStyle = '#0b0610'; ctx.fillRect(cx - 30, cy + 2, 60, 5); ctx.fillStyle = '#ff6a8a'; ctx.fillRect(cx - 29, cy + 3, 58 * P.lock / LOL.LOCK, 3);
  } else if (other) view.text('PAS TOI', cx, cy, 8, '#ff8aa8', { mono: true });
  else if (called) view.text('TOI !', cx, cy, 10, '#7cff8a', { mono: true, alpha: Math.sin(t * 12) > 0 ? 1 : 0.5 });
}

// le tilt-o-mètre (à droite de l'écran)
function tilt(view, g, t) {
  const ctx = view.g, x = MON.x + MON.w + 14, y = MON.y + 20, h = MON.h - 30, q = g.tilt / 100;
  ctx.fillStyle = '#0b0610'; ctx.fillRect(x - 6, y - 2, 12, h + 4);
  const gr = ctx.createLinearGradient(0, y + h, 0, y); gr.addColorStop(0, '#3cff7a'); gr.addColorStop(0.5, '#ffd23a'); gr.addColorStop(1, '#ff2a2a');
  ctx.fillStyle = gr; ctx.fillRect(x - 4, y + h * (1 - q), 8, h * q);
  view.text('TILT', x, y + h + 10, 7, q > 0.6 ? '#ff3a3a' : '#c8b8e8', { mono: true });
  if (q > 0.6) view.text('🔥', x + Math.sin(t * 20) * 2, y + h * (1 - q) - 8, 10, '#fff', { stroke: false });
}

// le shiba de J'san, qui dort (et sursaute quand ça crie)
function shiba(view, x, y, t, xs) {
  const ctx = view.g, up = xs.rage > 0.5 ? 6 : 0, br = Math.sin(t * 2) * 1.2;
  ctx.save(); ctx.translate(x, y - up);
  ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.ellipse(0, 0, 22 + br, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e0882a'; ctx.beginPath(); ctx.ellipse(0, 0, 20 + br, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f8ecd8'; ctx.beginPath(); ctx.ellipse(4, 4, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.arc(-18, -6, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e0882a'; ctx.beginPath(); ctx.arc(-18, -6, 8.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f8ecd8'; ctx.beginPath(); ctx.ellipse(-21, -3, 5, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e0882a'; ctx.beginPath(); ctx.moveTo(-25, -10); ctx.lineTo(-23, -19); ctx.lineTo(-18, -13); ctx.fill(); ctx.beginPath(); ctx.moveTo(-15, -12); ctx.lineTo(-11, -19); ctx.lineTo(-10, -9); ctx.fill();
  ctx.strokeStyle = '#0b0610'; ctx.lineWidth = 1.5;
  if (up) { ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.arc(-21, -8, 1.8, 0, Math.PI * 2); ctx.arc(-15, -8, 1.8, 0, Math.PI * 2); ctx.fill(); }
  else { ctx.beginPath(); ctx.moveTo(-23, -7); ctx.lineTo(-19, -7); ctx.moveTo(-17, -7); ctx.lineTo(-13, -7); ctx.stroke(); }
  ctx.fillStyle = '#e0882a'; ctx.beginPath(); ctx.arc(19, -6, 5 + Math.sin(t * (up ? 20 : 3)) * 1, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  if (!up) view.text('z', x - 8 + Math.sin(t * 2) * 3, y - 22 - (t * 8) % 12, 8, '#c8c8ff', { stroke: false, alpha: 0.7 });
  else view.text('!', x - 16, y - 34, 12, '#ffe24a', { mono: true });
}

// les objets, dessinés au pinceau du canevas (x, y : le centre ; s : la demi-hauteur, à peu près) :
// 0 un pot de whey chocolat, 1 une canette verte « MONSTRE », 2 un pot de créatine blanc, 3 une boîte de riz-poulet
function drawItem(ctx, k, x, y, s, t) {
  ctx.save(); ctx.translate(x, y);
  const O = '#0b0610';
  if (k === 0) {
    ctx.fillStyle = O; rr(ctx, -s * 0.85, -s, s * 1.7, s * 2, s * 0.3); ctx.fill();
    ctx.fillStyle = '#3a2418'; rr(ctx, -s * 0.72, -s * 0.62, s * 1.44, s * 1.5, s * 0.2); ctx.fill();
    ctx.fillStyle = '#f0f0f6'; ctx.fillRect(-s * 0.76, -s * 0.9, s * 1.52, s * 0.32);
    ctx.fillStyle = '#d07a2a'; ctx.fillRect(-s * 0.72, -s * 0.25, s * 1.44, s * 0.6);
    ctx.fillStyle = '#ffffff'; ctx.font = `bold ${Math.max(4, s * 0.42)}px 'Arial Black', sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('WHEY', 0, s * 0.06);
  } else if (k === 1) {
    ctx.fillStyle = O; rr(ctx, -s * 0.58, -s * 1.05, s * 1.16, s * 2.1, s * 0.2); ctx.fill();
    ctx.fillStyle = '#1aa83a'; ctx.fillRect(-s * 0.46, -s * 0.85, s * 0.92, s * 1.75);
    ctx.fillStyle = '#c8ccd4'; ctx.fillRect(-s * 0.46, -s * 0.95, s * 0.92, s * 0.18);
    ctx.fillStyle = '#7cff5a'; ctx.fillRect(-s * 0.46, -s * 0.85, s * 0.18, s * 1.75);
    ctx.fillStyle = '#ffe24a'; ctx.beginPath(); ctx.moveTo(s * 0.12, -s * 0.6); ctx.lineTo(-s * 0.28, s * 0.08); ctx.lineTo(-s * 0.02, s * 0.08); ctx.lineTo(-s * 0.12, s * 0.62); ctx.lineTo(s * 0.3, -s * 0.12); ctx.lineTo(s * 0.04, -s * 0.12); ctx.closePath(); ctx.fill();
  } else if (k === 2) {
    ctx.fillStyle = O; rr(ctx, -s * 0.7, -s * 0.9, s * 1.4, s * 1.85, s * 0.25); ctx.fill();
    ctx.fillStyle = '#f4f6ff'; rr(ctx, -s * 0.58, -s * 0.5, s * 1.16, s * 1.32, s * 0.15); ctx.fill();
    ctx.fillStyle = '#2a5aff'; ctx.fillRect(-s * 0.62, -s * 0.82, s * 1.24, s * 0.3);
    ctx.fillStyle = '#2a5aff'; ctx.fillRect(-s * 0.58, -s * 0.1, s * 1.16, s * 0.5);
    ctx.fillStyle = '#ffffff'; ctx.font = `bold ${Math.max(4, s * 0.38)}px 'Arial Black', sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('CRÉA', 0, s * 0.15);
  } else {
    ctx.fillStyle = O; rr(ctx, -s * 1.05, -s * 0.72, s * 2.1, s * 1.5, s * 0.25); ctx.fill();
    ctx.fillStyle = '#d8ecff'; rr(ctx, -s * 0.94, -s * 0.6, s * 1.88, s * 1.26, s * 0.18); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(-s * 0.84, -s * 0.2, s * 0.9, s * 0.76);
    ctx.fillStyle = '#e8e2d0'; for (let q = 0; q < 6; q++) ctx.fillRect(-s * 0.8 + (q % 3) * s * 0.28, -s * 0.1 + ((q / 3) | 0) * s * 0.3, s * 0.12, s * 0.08);
    ctx.fillStyle = '#c8783a'; ctx.fillRect(s * 0.12, -s * 0.2, s * 0.32, s * 0.3); ctx.fillRect(s * 0.5, -s * 0.15, s * 0.3, s * 0.28); ctx.fillRect(s * 0.2, s * 0.16, s * 0.36, s * 0.3);
    ctx.fillStyle = '#2a9a3a'; ctx.beginPath(); ctx.arc(s * 0.62, s * 0.32, s * 0.16, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(-s * 0.9, -s * 0.56, s * 1.8, s * 0.12);
  }
  ctx.restore();
  void t;
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}
