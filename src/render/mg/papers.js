// Faux papiers (papers), l'affichage : l'intérieur d'un TER (sièges à motifs, fenêtres où défile la campagne), le
// contrôleur au milieu (un vrai perso en 3D, casquette et sacoche dessinées), un Skanky en 3D de chaque côté (J1 à
// gauche, J2 à droite), chacun avec sa bulle (le papier que le contrôleur lui demande, le temps qui reste) et ses quatre
// faux papiers en croix (billet dessiné au feutre, carte d'identité avec moustache, abonnement de 1998, carte étudiant).
// Le bon : le papier vole, tampon VALIDÉ ; un mauvais : le contrôleur plisse les yeux, Skanky transpire ; trop lent :
// AMENDE.
import { PAPERS } from '../../sim/mg/papers.js';
import { COLORS } from '../../sim/constants.js';

const X = (i, x) => (i === 0 ? x : 640 - x);
const DIR = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const ARROW = ['▲', '▶', '▼', '◀'];
const SHORT = ['BILLET', 'IDENTITÉ', 'ABONNEMENT', 'ÉTUDIANT'];
const SAY = ['Billet, s\'il vous plaît !', 'Carte d\'identité !', 'Votre abonnement !', 'Carte étudiant !'];
const TRAY_X = 92, TRAY_Y = 258, TRAY_R = 46, SK_X = 222, FLOOR = 266, CX = 320;
const OKS = ['VALIDÉ ✅', 'BON VOYAGE', 'C\'EST BON...', 'CIRCULEZ'];
const SUS = ['C\'EST UN FAUX ?! 🤨', 'MOUAIS...', 'DESSINÉ AU FEUTRE ?', 'C\'EST VOUS, ÇA ?', 'EXPIRÉ EN 1998 ?!'];
// le contrôleur : un perso qui n'est pas dans le match, déguisé (casquette)
const CTRL = ['tung', 'parmesan', 'micron', 'bubba'];

function ctrlChar(W, M) {
  const a = W.fighters[M.a].char, v = W.fighters[M.v].char;
  return CTRL.find((c) => c !== a && c !== v);
}

export default {
  title: 'FAUX PAPIERS', color: '#ffe24a', icon: '🎫',
  puppets: ['skanky', 'tung'],
  goal: 'Tends vite au contrôleur le faux papier qu\'il demande !',
  keys: [['dirs', 'tendre ce papier']],
  ach: [
    ['Faussaire de génie', 'Le contrôleur est un ami', 'Zéro amende', 'Voyageur modèle (presque)'],
    ['300 € d\'amende', 'Photo d\'identité au feutre', 'Fiché à la SNCF', 'Abonnement expiré en 1998'],
  ],
  news: (L, d) => `TER LYON-VILLEURBANNE : ${L} CONTRÔLÉ AVEC UN BILLET DESSINÉ AU FEUTRE (+${d} %)`,

  warm(view, W, M) {
    for (let i = 0; i < 2; i++) view.puppet('skanky', -9999, -9999, 10, { key: 'sk' + i, shadow: false });
    if (W && M) view.puppet(ctrlChar(W, M), -9999, -9999, 10, { key: 'ctrl', shadow: false });
  },

  draw(view, W, M, dt) {
    const ctx = view.g, g = M.g, t = view.time, xs = view.xs, L = -view.ox, Rr = 640 + view.ox, T = -view.oy, B = 360 + view.oy;
    if (!xs.on) Object.assign(xs, { on: 1, fly: [], shown: [0, 0], stamp: [null, null], shake: [0, 0], look: -1, lookT: 0, press: [-1, -1], pressT: [0, 0], ctrl: ctrlChar(W, M) });
    // le wagon : le mur, les fenêtres (la campagne défile), le sol, les sièges
    ctx.fillStyle = '#d8ccb0'; ctx.fillRect(L, T, Rr - L, B - T);
    ctx.fillStyle = '#1a6a9a'; ctx.fillRect(L, 186, Rr - L, 10);
    for (let k = 0; k < 4; k++) {
      const wx = -10 + k * 170, wy = 54, ww = 140, wh = 92;
      ctx.fillStyle = '#5a5a6a'; ctx.beginPath(); ctx.roundRect(wx - 5, wy - 5, ww + 10, wh + 10, 14); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.roundRect(wx, wy, ww, wh, 10); ctx.clip();
      ctx.fillStyle = '#8ad0ff'; ctx.fillRect(wx, wy, ww, wh);
      const sc = (t * 220) % 600;
      ctx.fillStyle = '#6ab04a'; ctx.fillRect(wx, wy + 58, ww, 40);
      for (let h = 0; h < 5; h++) { const hx = wx + ((h * 137 - sc * 0.4) % 300 + 300) % 300 - 60; ctx.fillStyle = '#4a8a3a'; ctx.beginPath(); ctx.arc(hx, wy + 62, 26, Math.PI, 0); ctx.fill(); }
      for (let h = 0; h < 4; h++) { const px = wx + ((h * 97 - sc) % 400 + 400) % 400 - 100; ctx.fillStyle = '#3a2a1a'; ctx.fillRect(px, wy + 40, 4, 30); ctx.fillStyle = '#2a7a2a'; ctx.beginPath(); ctx.arc(px + 2, wy + 38, 12, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.moveTo(wx + 20, wy); ctx.lineTo(wx + 50, wy); ctx.lineTo(wx + 10, wy + wh); ctx.lineTo(wx - 20, wy + wh); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#4a4a58'; ctx.fillRect(L, FLOOR, Rr - L, B - FLOOR);
    ctx.fillStyle = '#5a5a68'; for (let x = Math.floor(L / 30) * 30; x < Rr; x += 30) ctx.fillRect(x, FLOOR, 2, B - FLOOR);
    // les sièges à motifs (le fond, derrière les persos)
    for (const sx of [L + 30, Rr - 30]) {
      ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.roundRect(sx - 34, 150, 68, 118, 12); ctx.fill();
      ctx.fillStyle = '#2a4aa0'; ctx.beginPath(); ctx.roundRect(sx - 31, 153, 62, 112, 10); ctx.fill();
      ctx.fillStyle = '#e04a7a'; for (let k = 0; k < 8; k++) ctx.fillRect(sx - 26 + (k % 3) * 18, 160 + k * 13, 8, 4);
    }
    // le contrôleur, au milieu : il regarde celui à qui il parle
    xs.lookT = Math.max(0, xs.lookT - dt);
    const look = xs.lookT > 0 ? xs.look : -1, sus = g.p[0].sus > 0 || g.p[1].sus > 0;
    let co;
    if (M.ph === 'outro') co = { emote: 'win' };
    else if (sus) co = { state: 'idle', tint: '#ff4020', tintK: 0.12 };
    else co = { state: 'idle' };
    const cface = look === 0 ? -0.6 : look === 1 ? 0.9 + 0.3 : 0.34;
    if (view.pupOn(M) && xs.ctrl) view.actor(xs.ctrl, 2, CX, FLOOR, 168, { key: 'ctrl', ...co, face: cface, head: 1.6 });
    // sa casquette, son badge
    capAndBadge(view, CX, FLOOR, t, sus);
    for (let i = 0; i < 2; i++) {
      const P = g.p[i], slot = i === 0 ? M.a : M.v, col = COLORS[slot];
      xs.shake[i] = Math.max(0, xs.shake[i] - dt * 2.5); xs.pressT[i] = Math.max(0, xs.pressT[i] - dt);
      // Skanky
      let so;
      if (M.ph === 'outro') so = P.score >= g.p[1 - i].score ? { emote: 'win' } : { emote: 'sob' };
      else if (P.lock > 0) so = { state: 'dizzy' };
      else if (xs.pressT[i] > 0) so = { emote: 'greet_01', emoteSpeed: 1.6 };
      else if (P.streak >= 4) so = { emote: 'dance_01' };
      else so = { state: 'idle' };
      if (view.pupOn(M)) view.actor('skanky', i, X(i, SK_X) + (xs.shake[i] ? (Math.random() - 0.5) * 5 : 0), FLOOR, 122, { key: 'sk' + i, ...so, face: i === 0 ? 'three' : 'threeL', head: 1.6 });
      if (P.lock > 0) { view.text('💦', X(i, SK_X) + 22, FLOOR - 112 + Math.sin(t * 9) * 3, 14, '#fff', { stroke: false }); }
      bubble(view, W, M, g, i, t, xs);
      tray(view, W, M, g, i, t, xs);
      // le score, sous la bulle
      xs.shown[i] += (P.score - xs.shown[i]) * Math.min(1, dt * 10);
      view.text(`${view.pname(slot)} · ${Math.round(xs.shown[i])}${P.streak >= 2 ? '  🔥x' + P.streak : ''}`, X(i, 110), 160, 16, col, { mono: true });
      view.hint(W, M, i, X(i, 100), 182, [['dirs', 'tendre le papier']]);
    }
    // les papiers qui volent jusqu'au contrôleur
    xs.fly = xs.fly.filter((f) => (f.t += dt) < f.dur + (f.back ? 0.4 : 0));
    for (const f of xs.fly) {
      let q = Math.min(1, f.t / f.dur), x = f.x0 + (f.x1 - f.x0) * q, y = f.y0 + (f.y1 - f.y0) * q - Math.sin(q * Math.PI) * 40;
      if (f.back && f.t > f.dur) { const b = (f.t - f.dur) / 0.4; x = f.x1 + (f.x0 - f.x1) * b; y = f.y1 + (f.y0 - f.y1) * b - Math.sin(b * Math.PI) * 50; }
      ctx.save(); ctx.translate(x, y); ctx.rotate(f.t * (f.back ? 14 : 4) * (f.x1 > f.x0 ? 1 : -1)); drawDoc(view, f.k, 0, 0, 0.8, t); ctx.restore();
    }
    view.text('🎫 FAUX PAPIERS', 320, 16, 15, '#ffe24a', { title: true });
    view.timer(M, 320, 38);
  },

  onEvent(view, ev, W, M) {
    const A = view.audio, xs = view.xs, g = M && M.g;
    if (!g || !ev.type.startsWith('mgPapers') || !xs.on) return;
    const i = ev.p, slot = i === 0 ? M.a : M.v, pan = i ? 0.4 : -0.4, bx = X(i, 110);
    xs.look = i; xs.lookT = 0.8;
    switch (ev.type) {
      case 'mgPapersAsk':
        view.burst(bx, 96, 8, ['#ffffff', '#ffe24a'], { shape: 'star', speed: 120, size: 4, life: 0.35 });
        if (A) { A.sfx('pop', pan, 0.45, 1 + ev.k); if (i === 0 || W.fighters[M.a].bot) { if (Math.random() < 0.5) A.say(SAY[ev.k], 0.35, 1.25); } }
        break;
      case 'mgPapersOk': {
        const s = from(i, ev.k);
        xs.fly.push({ k: ev.k, x0: s[0], y0: s[1], x1: CX + (i ? 26 : -26), y1: FLOOR - 92, t: 0, dur: 0.22, back: 0 });
        xs.press[i] = ev.k; xs.pressT[i] = 0.3; xs.stamp[i] = { t0: view.time, ok: 1 };
        view.react(2, { hop: 0.08, life: 0.4 });
        view.sticker(ev.f < 30 ? 'ÉCLAIR ⚡' : view.pick(OKS), bx, 70, { size: 14, color: '#ffffff', bg: '#2a9a3a', life: 0.6, rot: -0.15 });
        view.burst(bx, 100, 16, ['#7cff8a', '#ffffff', '#ffe24a'], { shape: 'star', speed: 200, size: 5, life: 0.5 });
        view.floats.push({ text: `+${ev.pts}`, x: bx, y: 130, t: 0, life: 0.8, color: COLORS[slot], size: 18 });
        if (ev.st === 4 || ev.st === 7) { view.sticker(ev.st === 4 ? 'FAUSSAIRE PRO 🖊️' : 'INTOUCHABLE 😎', X(i, 160), 210, { size: 14, color: '#ffffff', bg: '#ff3a3a', life: 0.9 }); view.hype(0.5); }
        view.jolt(0.25, 0.02);
        if (A) { A.sfx('whoosh', pan, 0.4); A.sfx('thud', pan, 0.5); A.sfx('cash', pan, 0.35, 1 + Math.min(5, ev.st)); }
        break;
      }
      case 'mgPapersWrong': {
        const s = from(i, ev.k);
        xs.fly.push({ k: ev.k, x0: s[0], y0: s[1], x1: CX + (i ? 26 : -26), y1: FLOOR - 92, t: 0, dur: 0.2, back: 1 });
        xs.press[i] = ev.k; xs.pressT[i] = 0.3; xs.shake[i] = 1; xs.stamp[i] = { t0: view.time, ok: 0 };
        view.react(2, { tint: '#ff2020', tintK: 0.5, shake: 6, life: 0.7, pop: 0.4 });
        view.react(i, { state: 'hitstun', kb: 90, life: 0.3 });
        view.sticker(view.pick(SUS), CX, 74, { size: 15, color: '#ffffff', bg: '#c01020', life: 0.9 });
        view.floats.push({ text: `-${PAPERS.WRONG}`, x: bx, y: 130, t: 0, life: 0.8, color: '#ff4040', size: 18 });
        view.burst(X(i, SK_X), FLOOR - 100, 8, ['#8ad8ff', '#ffffff'], { shape: 'dot', speed: 120, size: 4, life: 0.6, up: 60 });
        view.jolt(0.5, 0.04, '#ff2020', 0.2);
        if (A) { A.sfx('error', pan, 0.6); A.sfx('throw', pan, 0.4); if (Math.random() < 0.6) A.say(view.pick(['C\'est un faux ?', 'Mouais...', 'Vous vous moquez de moi ?']), 0.35, 1.0); }
        break;
      }
      case 'mgPapersFine':
        xs.stamp[i] = { t0: view.time, ok: 2 }; xs.shake[i] = 1;
        view.react(i, { state: 'dizzy', life: 0.8 });
        view.sticker('AMENDE 💸', bx, 84, { size: 18, color: '#ffffff', bg: '#7a1030', life: 0.9, rot: 0.12 });
        view.floats.push({ text: `-${PAPERS.FINE}`, x: bx, y: 130, t: 0, life: 0.8, color: '#ff4040', size: 18 });
        view.burst(bx, 100, 6, ['#fff'], { shape: 'txt', ch: '💸', speed: 120, size: 10, up: 60, life: 0.9 });
        view.jolt(0.35, 0.03);
        if (A) { A.sfx('cash', pan, 0.5, 0); A.sfx('wobble', pan, 0.4); if (Math.random() < 0.5) A.say('Amende !', 0.35, 1.1); }
        break;
      default: break;
    }
  },
};

// d'où part le papier k du joueur i
function from(i, k) { return [X(i, TRAY_X) + DIR[k][0] * TRAY_R, TRAY_Y + DIR[k][1] * TRAY_R * 0.82]; }

// la bulle du contrôleur pour le joueur i : le papier demandé, son nom, le temps qui reste ; le tampon
function bubble(view, W, M, g, i, t, xs) {
  const ctx = view.g, P = g.p[i], slot = i === 0 ? M.a : M.v, cx = X(i, 110), cy = 100, w = 172, h = 70;
  if (M.ph !== 'play') return;
  ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.roundRect(cx - w / 2 - 3, cy - h / 2 - 3, w + 6, h + 6, 14); ctx.fill();
  // la queue vers le contrôleur
  ctx.beginPath(); ctx.moveTo(cx + (i ? -w / 2 : w / 2) - (i ? -2 : 2), cy - 6); ctx.lineTo(cx + (i ? -w / 2 - 30 : w / 2 + 30), cy + 8); ctx.lineTo(cx + (i ? -w / 2 : w / 2) - (i ? -2 : 2), cy + 12); ctx.closePath(); ctx.fill();
  ctx.fillStyle = P.sus > 0 ? '#ffe0e0' : '#ffffff'; ctx.beginPath(); ctx.roundRect(cx - w / 2, cy - h / 2, w, h, 12); ctx.fill();
  ctx.strokeStyle = COLORS[slot]; ctx.lineWidth = 2.5; ctx.stroke();
  if (P.gap > 0) {
    const st = xs.stamp[i];
    if (st && view.time - st.t0 < 0.6) {
      const k = 1 + Math.max(0, 0.15 - (view.time - st.t0)) * 6;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.15); ctx.scale(k, k);
      const c = st.ok === 1 ? '#2a9a3a' : '#c01020';
      ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.strokeRect(-60, -16, 120, 32);
      view.text(st.ok === 1 ? 'VALIDÉ' : 'AMENDE', 0, 1, 20, c, { mono: true, stroke: false });
      ctx.restore();
    } else view.text('...', cx, cy, 20, '#9a9aa8', { mono: true, stroke: false });
    return;
  }
  const k = g.req[P.n % g.req.length], pop = Math.max(0, 1 - P.t / 8) * 0.3;
  ctx.save(); ctx.translate(cx - 42, cy - 4); ctx.scale(1 + pop, 1 + pop); drawDoc(view, k, 0, 0, 1, t); ctx.restore();
  view.text(PAPERS.NAMES[k], cx + 34, cy - 10, PAPERS.NAMES[k].length > 12 ? 10 : 12, '#0b0610', { mono: true, stroke: false, maxW: 92 });
  view.text(P.sus > 0 ? 'UN VRAI, CETTE FOIS !' : 'S\'IL VOUS PLAÎT', cx + 34, cy + 6, 8, P.sus > 0 ? '#c01020' : '#5a5a6a', { mono: true, stroke: false, maxW: 92 });
  // le temps qui reste
  const q = Math.min(1, M.t / 600), dl = PAPERS.DL0 + (PAPERS.DL1 - PAPERS.DL0) * q, left = Math.max(0, 1 - P.t / dl);
  ctx.fillStyle = '#0b0610'; ctx.fillRect(cx - w / 2 + 10, cy + h / 2 - 12, w - 20, 7);
  ctx.fillStyle = left > 0.5 ? '#3ac85a' : left > 0.25 ? '#ffd23a' : (Math.sin(t * 30) > 0 ? '#ff3a3a' : '#ffffff');
  ctx.fillRect(cx - w / 2 + 11, cy + h / 2 - 11, (w - 22) * left, 5);
}

// les quatre faux papiers du joueur i, en croix ; les mains prises après une erreur
function tray(view, W, M, g, i, t, xs) {
  const ctx = view.g, P = g.p[i], slot = i === 0 ? M.a : M.v, cx = X(i, TRAY_X), cy = TRAY_Y, lock = P.lock > 0, col = COLORS[slot];
  const want = M.ph === 'play' && P.gap <= 0 && !lock ? g.req[P.n % g.req.length] : -1, dev = view.deviceOf(slot);
  const KN = dev === 'kb1' ? ['Z', 'D', 'S', 'Q'] : dev === 'kb2' ? ['↑', '→', '↓', '←'] : ARROW;
  ctx.fillStyle = 'rgba(11,6,16,0.75)'; ctx.beginPath(); ctx.ellipse(cx, cy, 86, 72, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = COLORS[slot]; ctx.lineWidth = 3; ctx.stroke();
  for (let k = 0; k < 4; k++) {
    if (xs.pressT[i] > 0 && xs.press[i] === k) continue;
    const [x, y] = from(i, k);
    // le papier demandé : il brille, à la couleur du joueur
    if (k === want) { const p = 1 + Math.sin(t * 14) * 0.08; ctx.fillStyle = col; ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.roundRect(x - 30 * p, y - 20 * p, 60 * p, 40 * p, 8); ctx.fill(); ctx.globalAlpha = 1; }
    ctx.save(); if (lock || (want >= 0 && k !== want)) ctx.globalAlpha = lock ? 0.4 : 0.6; drawDoc(view, k, x, y, k === want ? 0.95 : 0.82, t); ctx.restore();
    // sa touche (pour l'appareil du joueur) : côté extérieur, ou à gauche du papier du haut et du bas
    const kx = k % 2 ? x + DIR[k][0] * 36 : x - 42, ky = y, kw = Math.max(16, KN[k].length * 9 + 8);
    ctx.fillStyle = '#f4ead6'; ctx.fillRect(kx - kw / 2, ky - 8, kw, 16); ctx.fillStyle = col; ctx.fillRect(kx - kw / 2, ky + 6, kw, 2);
    ctx.strokeStyle = '#0b0610'; ctx.lineWidth = 1.5; ctx.strokeRect(kx - kw / 2, ky - 8, kw, 16);
    view.text(KN[k], kx, ky, 9, '#0b0610', { mono: true, stroke: false });
  }
  // au centre : une flèche vers le papier demandé
  if (want >= 0) {
    const d = DIR[want], len = 12 + Math.abs(Math.sin(t * 10)) * 4;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.atan2(d[1], d[0]));
    ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.moveTo(len + 8, 0); ctx.lineTo(len - 4, -10); ctx.lineTo(len - 4, -4); ctx.lineTo(-8, -4); ctx.lineTo(-8, 4); ctx.lineTo(len - 4, 4); ctx.lineTo(len - 4, 10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(len + 5, 0); ctx.lineTo(len - 2, -7); ctx.lineTo(len - 2, -2); ctx.lineTo(-6, -2); ctx.lineTo(-6, 2); ctx.lineTo(len - 2, 2); ctx.lineTo(len - 2, 7); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  if (lock) {
    view.text('MAINS MOITES', cx, cy - 4, 10, '#ff6a8a', { mono: true });
    ctx.fillStyle = '#0b0610'; ctx.fillRect(cx - 28, cy + 6, 56, 5); ctx.fillStyle = '#ff6a8a'; ctx.fillRect(cx - 27, cy + 7, 54 * P.lock / PAPERS.LOCK, 3);
  }
}

// un faux papier (x, y : le centre ; s : l'échelle, 1 = 56 x 36) : 0 billet de TER dessiné au feutre, 1 carte d'identité
// (Skanky avec une moustache), 2 abonnement de 1998, 3 carte étudiant
function drawDoc(view, k, x, y, s, t) {
  const ctx = view.g, w = 56 * s, h = 36 * s, O = '#0b0610';
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = O; ctx.beginPath(); ctx.roundRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4, 5 * s); ctx.fill();
  const bg = ['#ffb8a0', '#c8e0ff', '#b8f0b0', '#e0c8ff'][k];
  ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 4 * s); ctx.fill();
  const tx = (str, xx, yy, sz, c) => { ctx.fillStyle = c; ctx.font = `bold ${Math.max(4, sz * s)}px 'Arial Black', sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(str, xx * s, yy * s); };
  if (k === 0) {
    // le billet : perforations, « TER » au feutre, un smiley
    ctx.fillStyle = O; for (let q = 0; q < 5; q++) ctx.fillRect(w / 2 - 12 * s, -h / 2 + 3 * s + q * 7 * s, 2 * s, 4 * s);
    ctx.strokeStyle = '#d0201a'; ctx.lineWidth = 1.6 * s; ctx.beginPath(); ctx.moveTo(-22 * s, -8 * s); ctx.lineTo(4 * s, -11 * s); ctx.stroke();
    tx('TER', -8, 1, 12, '#2a3ad0'); tx('1ère cl. :)', -8, 11, 6, '#d0201a');
  } else if (k === 1) {
    // la carte d'identité : la photo (une tête et une moustache), les lignes
    ctx.fillStyle = '#ffffff'; ctx.fillRect(-w / 2 + 4 * s, -h / 2 + 5 * s, 16 * s, 22 * s);
    ctx.fillStyle = '#c89060'; ctx.beginPath(); ctx.arc(-w / 2 + 12 * s, -h / 2 + 14 * s, 5 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = O; ctx.fillRect(-w / 2 + 8 * s, -h / 2 + 16 * s, 8 * s, 1.6 * s);
    ctx.fillStyle = '#2a4aa0'; ctx.fillRect(-w / 2 + 6 * s, -h / 2 + 21 * s, 12 * s, 6 * s);
    ctx.fillStyle = '#6a7a9a'; for (let q = 0; q < 3; q++) ctx.fillRect(-4 * s, -8 * s + q * 6 * s, 26 * s, 2 * s);
    tx('RF', 8, -13, 6, '#2a4aa0');
  } else if (k === 2) {
    tx('PASS', 0, -6, 11, '#1a6a2a'); tx('expire 1998', 0, 8, 6, '#c01020');
    ctx.fillStyle = '#1a6a2a'; ctx.fillRect(-w / 2, h / 2 - 5 * s, w, 3 * s);
  } else {
    // la toque d'étudiant
    ctx.fillStyle = O; ctx.beginPath(); ctx.moveTo(-18 * s, -8 * s); ctx.lineTo(-8 * s, -13 * s); ctx.lineTo(2 * s, -8 * s); ctx.lineTo(-8 * s, -3 * s); ctx.closePath(); ctx.fill();
    ctx.fillRect(-12 * s, -6 * s, 8 * s, 5 * s);
    tx('ÉTUDIANT', 6, 6, 6.5, '#5a2aa0'); tx('âge : 19', 6, 13, 5, '#5a2aa0');
  }
  ctx.restore();
  void view; void t;
}

// la casquette du contrôleur (posée en haut de sa tête), sa sacoche, son brassard « CONTRÔLE »
function capAndBadge(view, x, y, t, sus) {
  const ctx = view.g, hy = y - 172;
  ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.roundRect(x - 30, hy - 4, 60, 20, 6); ctx.fill();
  ctx.fillStyle = '#1a2a6a'; ctx.beginPath(); ctx.roundRect(x - 27, hy - 1, 54, 15, 5); ctx.fill();
  ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.ellipse(x, hy + 16, 34, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffd23a'; ctx.fillRect(x - 8, hy + 3, 16, 7);
  view.text(sus ? 'CONTRÔLE 🤨' : 'CONTRÔLE', x, y + 14, 11, '#ffd23a', { mono: true });
  void t;
}
