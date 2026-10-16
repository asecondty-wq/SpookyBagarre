// Drague de Skanky (dating), l'affichage : une ruelle rose bonbon façon jeu de drague (cœurs qui flottent, néon « LOVE »,
// tags sur le mur), le voyou au milieu (un vrai perso en 3D, sa fiche « KÉVIN, 23 ANS »), un Skanky en 3D de chaque côté
// (J1 à gauche, J2 à droite) avec sa jauge d'amour, la bulle du voyou (la phrase du moment, puis sa réaction) et les trois
// réponses en bas (◀ ▲ ▶, à la couleur du joueur). La bonne : il rougit, cœurs ; la vexante : il s'énerve.
import { DATING } from '../../sim/mg/dating.js';
import { COLORS } from '../../sim/constants.js';

const X = (i, x) => (i === 0 ? x : 640 - x);
const FLOOR = 238, VX = 320, SK_X = 72;
const ARROW = ['◀', '▲', '▶'];
// les phrases du voyou ; ses trois réponses : [la meilleure, bof, vexante]
const LINES = [
  { say: 'Qu\'est-ce tu regardes, toi ?', r: ['Tes beaux yeux. 😍', 'L\'horaire du TER.', 'Prête-moi 5 balles ?'] },
  { say: 'T\'as un problème ?', r: ['Oui : je pense qu\'à toi.', 'J\'ai perdu mon skate.', 'Ton survêt est faux.'] },
  { say: 'Tu fais quoi dans la vie ?', r: ['Du funk, rien que pour toi.', 'Je fraude le TER.', 'Des amendes, surtout.'] },
  { say: 'On se connaît, nous deux ?', r: ['Pas encore… 😏', 'T\'es contrôleur ?', 'Tu dois 20 € à mon cousin.'] },
  { say: 'T\'as du feu ?', r: ['Le seul feu ici, c\'est toi.', 'Un briquet du kebab.', 'Fumer tue. Toi aussi.'] },
  { say: 'Tu veux mon 06 ?', r: ['Je le sais déjà par cœur.', 'J\'ai plus de forfait.', 'Que si c\'est gratuit.'] },
  { say: 'Tu m\'emmènes où, alors ?', r: ['Coucher de soleil + kebab.', 'Chez moi. Tu paies le bus.', 'Au commissariat.'] },
  { say: 'Pourquoi tu souris comme ça ?', r: ['Parce que t\'es là. 💘', 'Chewing-gum coincé.', 'Je pense à mon ex.'] },
  { say: 'T\'es bizarre, toi.', r: ['Bizarre, mais fidèle.', 'On me le dit souvent.', 'Et toi t\'es moche.'] },
  { say: 'Bon, tu veux quoi, au final ?', r: ['Ton cœur. 💘', 'Un ticket de bus.', 'Mon skate. Rends-le.'] },
];
const REACT = [['Arrête… 😳', 'T\'es mignon, toi.', 'Ok… t\'as gagné. 💘', 'Hihi. 😊'], ['Bof.', 'Ok…', 'Mouais.', 'Et ?'], ['Hein ?! 😠', 'Tu cherches quoi, là ?', 'Dégage. 💢', 'Wesh ?!'], ['Tu dors ? 😴']];
// le voyou : un perso qui n'est pas dans le match
const VOY = ['shark', 'bubba', 'tung', 'parmesan'];
function voyChar(W, M) { const a = W.fighters[M.a].char, v = W.fighters[M.v].char; return VOY.find((c) => c !== a && c !== v); }

export default {
  title: 'DRAGUE DE SKANKY', color: '#ff4a8a', icon: '💘',
  puppets: ['skanky', 'shark'],
  goal: 'Choisis la meilleure réplique pour faire craquer le voyou !',
  keys: [['dirs', '◀ ▲ ▶ choisir la réplique']],
  ach: [
    ['Casanova du TER', 'Cœur de voyou volé', 'Maître de la tchatche', 'Rizz légendaire'],
    ['Friendzoné par un voyou', 'Râteau du siècle', 'Tchatche en panne', 'Zéro rizz'],
  ],
  news: (L, d) => `RÂTEAU HISTORIQUE : LE VOYOU PRÉFÈRE L'AUTRE, ${L} REPART SEUL (+${d} %)`,

  warm(view, W, M) {
    for (let i = 0; i < 2; i++) view.puppet('skanky', -9999, -9999, 10, { key: 'sk' + i, shadow: false });
    if (W && M) view.puppet(voyChar(W, M), -9999, -9999, 10, { key: 'voy', shadow: false });
  },

  draw(view, W, M, dt) {
    const ctx = view.g, g = M.g, t = view.time, xs = view.xs, L = -view.ox, Rr = 640 + view.ox, T = -view.oy, B = 360 + view.oy;
    if (!xs.on) Object.assign(xs, { on: 1, voy: voyChar(W, M), meter: [0, 0], pop: [0, 0], pick: [null, null], blush: 0, mad: 0 });
    xs.blush = Math.max(0, xs.blush - dt * 0.8); xs.mad = Math.max(0, xs.mad - dt * 1.2);
    // la ruelle : dégradé rose, mur de briques, néon LOVE, cœurs qui montent
    const sky = ctx.createLinearGradient(0, T, 0, FLOOR); sky.addColorStop(0, '#5a1a5a'); sky.addColorStop(1, '#ff7ab0');
    ctx.fillStyle = sky; ctx.fillRect(L, T, Rr - L, B - T);
    ctx.fillStyle = 'rgba(120,30,70,0.35)';
    for (let y = 60; y < FLOOR; y += 14) for (let x = L + ((y / 14) % 2) * 14; x < Rr; x += 28) ctx.fillRect(x, y, 26, 12);
    const on = Math.sin(t * 13) > -0.8;
    view.text('L♥VE', 320, 58, 22, on ? '#ff9ad0' : '#7a3a5a', { title: true, alpha: on ? 1 : 0.6 });
    view.text('KÉVIN WAS HERE', 470, 196, 10, '#ffe24a', { mono: true, alpha: 0.55, stroke: false });
    view.text('SKANK ♥ ?', 168, 200, 10, '#7affd0', { mono: true, alpha: 0.5, stroke: false });
    for (let k = 0; k < 10; k++) { const u = (t * 0.15 + k * 0.1) % 1; view.text('♥', ((k * 71) % 640), FLOOR - u * 200, 9 + (k % 3) * 3, '#ffb0d8', { stroke: false, alpha: 0.5 * (1 - u) }); }
    ctx.fillStyle = '#3a1a3a'; ctx.fillRect(L, FLOOR, Rr - L, B - FLOOR);
    ctx.fillStyle = '#4a2448'; for (let x = Math.floor(L / 40) * 40; x < Rr; x += 40) ctx.fillRect(x, FLOOR, 2, B - FLOOR);
    // le voyou
    let vo;
    if (M.ph === 'outro') vo = { emote: 'heart_pose' };
    else if (xs.mad > 0) vo = { state: 'idle', tint: '#ff2020', tintK: xs.mad * 0.4 };
    else if (xs.blush > 0) vo = { emote: 'heart_pose', tint: '#ff6aa0', tintK: xs.blush * 0.35 };
    else vo = { state: 'idle' };
    if (view.pupOn(M) && xs.voy) view.actor(xs.voy, 2, VX, FLOOR, 150, { key: 'voy', ...vo, face: 0.34 + Math.sin(t * 0.7) * 0.3, head: 1.6 });
    if (xs.blush > 0.2) view.text('😳', VX + 30, FLOOR - 150, 16, '#fff', { stroke: false });
    ctx.fillStyle = 'rgba(11,6,16,0.8)'; ctx.beginPath(); ctx.roundRect(VX - 52, 70, 104, 26, 6); ctx.fill();
    view.text('KÉVIN, 23 ANS', VX, 78, 10, '#ffffff', { mono: true, stroke: false });
    view.text('voyou · aime les kebabs', VX, 89, 7, '#ff9ad0', { stroke: false });
    for (let i = 0; i < 2; i++) {
      const P = g.p[i], slot = i === 0 ? M.a : M.v, col = COLORS[slot];
      xs.pop[i] = Math.max(0, xs.pop[i] - dt * 3);
      xs.meter[i] += (P.love - xs.meter[i]) * Math.min(1, dt * 7);
      // Skanky
      const pk = xs.pick[i], pt = pk ? t - pk.t0 : 9;
      let so;
      if (M.ph === 'outro') so = P.love >= g.p[1 - i].love ? { emote: 'win' } : { emote: 'sob' };
      else if (pk && pt < 0.8) so = pk.q === 0 ? { emote: 'heart_pose' } : pk.q === 2 ? { emote: 'sob' } : { emote: 'complain_01' };
      else if (P.love >= 70) so = { emote: 'freaky' };
      else so = { state: 'idle' };
      if (view.pupOn(M)) view.actor('skanky', i, X(i, SK_X), FLOOR, 120, { key: 'sk' + i, ...so, face: i === 0 ? 'three' : 'threeL', head: 1.6 });
      meter(view, i, P, xs, t, col);
      bubble(view, M, g, i, P, xs, t, col);
      replies(view, W, M, g, i, P, xs, t, col);
      view.hint(W, M, i, X(i, 196), 236, [['dirs', 'choisir']]);
      view.text(`${view.pname(slot)} · 💘 ${Math.round(xs.meter[i])} %`, X(i, 12), 52, 15 * (1 + xs.pop[i] * 0.3), col, { align: i ? 'right' : 'left', mono: true });
      if (P.streak >= 2) view.text(`🔥 x${P.streak}`, X(i, 12), 68, 11, '#ffd23a', { align: i ? 'right' : 'left', mono: true });
    }
    view.text('💘 DRAGUE DE SKANKY', 320, 16, 15, '#ff4a8a', { title: true });
    view.timer(M, 320, 36);
  },

  onEvent(view, ev, W, M) {
    const A = view.audio, xs = view.xs, g = M && M.g;
    if (!g || !ev.type.startsWith('mgDating') || !xs.on) return;
    const i = ev.p, slot = i === 0 ? M.a : M.v, pan = i ? 0.4 : -0.4, sx = X(i, SK_X);
    switch (ev.type) {
      case 'mgDatingLine':
        if (A) { A.sfx('blip', pan, 0.35, 2); if (i === 0 && Math.random() < 0.4) A.say(LINES[ev.id].say, 0.25, 1.05); }
        break;
      case 'mgDatingPick': {
        xs.pick[i] = { c: ev.c, q: ev.q, t0: view.time, re: view.pick(REACT[ev.q]) }; xs.pop[i] = 1;
        if (ev.q === 0) {
          xs.blush = 1;
          view.react(2, { hop: 0.06, life: 0.6, pop: 0.3 });
          view.burst(VX, FLOOR - 120, 18, ['#ff5a8a', '#ff9ad0', '#ffffff'], { shape: 'txt', ch: '♥', speed: 200, size: 9, up: 120, life: 0.9 });
          view.burst(sx, FLOOR - 90, 6, ['#fff'], { shape: 'txt', ch: view.pick(['💘', '😍', '💕']), speed: 140, size: 11, up: 100, life: 0.9 });
          view.sticker(ev.f < 60 ? 'RIZZ ÉCLAIR ⚡' : view.pick(['IL ROUGIT 😳', 'TOUCHÉ 💘', 'CRUSH !', 'OH LÀ LÀ']), X(i, 200), 150, { size: 15, color: '#ffffff', bg: '#ff4a8a', life: 0.8, rot: i ? 0.1 : -0.1 });
          if (ev.st >= 2) { view.sticker(`RIZZ x${ev.st} 🔥`, X(i, 190), 178, { size: 13, color: '#0b0610', bg: '#ffe24a', life: 0.8 }); view.hype(0.3 + ev.st * 0.1); }
          view.jolt(0.3, 0.04, '#ffb0d0', 0.2);
          if (A) { A.sfx('kiss', pan, 0.6); A.sfx('heart', pan, 0.6, 1 + Math.min(5, ev.st)); }
        } else if (ev.q === 2) {
          xs.mad = 1;
          view.react(2, { shake: 8, life: 0.6, pop: 0.4 });
          view.react(i, { state: 'hitstun', kb: 100, life: 0.35 });
          view.sticker(view.pick(['RÂTEAU 🧹', 'MALAISE 😬', 'AÏE AÏE AÏE', 'IL S\'ÉNERVE 💢']), X(i, 200), 150, { size: 15, color: '#ffffff', bg: '#5a1a3a', life: 0.85 });
          view.burst(VX, FLOOR - 130, 4, ['#fff'], { shape: 'txt', ch: '💢', speed: 120, size: 12, life: 0.7 });
          view.jolt(0.45, 0.03, '#ff2020', 0.15);
          if (A) { A.sfx('error', pan, 0.5); A.sfx('slap', pan, 0.4); }
        } else {
          view.sticker('BOF 😐', X(i, 200), 150, { size: 13, color: '#ffffff', bg: '#7a6a8a', life: 0.6 });
          if (A) A.sfx('wobble', pan, 0.35);
        }
        view.floats.push({ text: `${ev.d > 0 ? '+' : ''}${ev.d} 💘`, x: X(i, 30), y: 120, t: 0, life: 0.8, color: ev.d > 10 ? COLORS[slot] : ev.d > 0 ? '#ffffff' : '#ff4040', size: 17 });
        break;
      }
      case 'mgDatingBored':
        xs.pick[i] = { c: -1, q: 3, t0: view.time, re: REACT[3][0] };
        view.sticker('IL S\'ENNUIE 😴', X(i, 200), 150, { size: 13, color: '#ffffff', bg: '#5a5a7a', life: 0.7 });
        if (A) A.sfx('wobble', pan, 0.3);
        break;
      case 'mgDatingWin':
        view.sticker(`💘 ${view.pname(slot)} : COUP DE FOUDRE !`, 320, 120, { size: 22, color: '#ffffff', bg: '#ff2a7a', life: 1.4 });
        view.emojiRain(['💘', '💕', '😍', '💍'], 18); view.confetti(40); view.hype(1);
        view.jolt(0.8, 0.08, '#ffb0d0', 0.4);
        if (A) { A.sfx('airhorn', 0, 0.5); A.sfx('kiss', 0, 0.8); A.sfx('crowd', 0, 0.4); A.say('Coup de foudre !', 0.6, 1.2); }
        break;
      default: break;
    }
  },
};

// la jauge d'amour, verticale, côté extérieur
function meter(view, i, P, xs, t, col) {
  const ctx = view.g, x = X(i, 14), y0 = 92, h = 130, q = xs.meter[i] / DATING.FULL;
  ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.roundRect(x - 8, y0 - 2, 16, h + 4, 6); ctx.fill();
  const gr = ctx.createLinearGradient(0, y0 + h, 0, y0); gr.addColorStop(0, '#ff9ad0'); gr.addColorStop(1, '#ff1a6a');
  ctx.fillStyle = gr; ctx.fillRect(x - 6, y0 + h * (1 - q), 12, h * q);
  ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x - 8, y0 - 2, 16, h + 4, 6); ctx.stroke();
  const beat = 1 + Math.abs(Math.sin(t * (4 + q * 6))) * 0.15;
  view.text('💘', x, y0 - 12, 16 * beat, '#fff', { stroke: false });
  void P;
}

// la bulle du voyou pour le joueur i : sa phrase, ou sa réaction juste après
function bubble(view, M, g, i, P, xs, t, col) {
  if (M.ph !== 'play') return;
  const ctx = view.g, cx = X(i, 200), cy = 112, w = 196, h = 50;
  const pk = xs.pick[i], react = P.gap > 0 && pk && view.time - pk.t0 < 1.5;
  if (P.gap > 0 && !react) return;
  ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.roundRect(cx - w / 2 - 3, cy - h / 2 - 3, w + 6, h + 6, 14); ctx.fill();
  const ex = cx + (i ? -w / 2 : w / 2);
  ctx.beginPath(); ctx.moveTo(ex, cy - 8); ctx.lineTo(ex + (i ? -26 : 26), cy - 18); ctx.lineTo(ex, cy + 6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = react ? (pk.q === 0 ? '#ffe0ee' : pk.q === 2 ? '#ffd8d8' : '#f0eef4') : '#ffffff'; ctx.beginPath(); ctx.roundRect(cx - w / 2, cy - h / 2, w, h, 12); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
  if (react) view.text(pk.re, cx, cy + 1, 15, pk.q === 0 ? '#ff2a7a' : pk.q === 2 ? '#c01020' : '#5a5a6a', { mono: true, stroke: false, maxW: w - 16 });
  else {
    const L = LINES[g.lines[P.n % DATING.LINES].id], pop = Math.max(0, 1 - P.t / 8) * 0.2;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(1 + pop, 1 + pop);
    view.text('« ' + L.say + ' »', 0, -5, 12, '#0b0610', { stroke: false, maxW: w - 16 });
    ctx.restore();
    // sa patience
    const left = Math.max(0, 1 - P.t / DATING.DL);
    ctx.fillStyle = '#e8dce8'; ctx.fillRect(cx - w / 2 + 14, cy + 12, w - 28, 4);
    ctx.fillStyle = left > 0.35 ? '#ff5a9a' : '#ff2a2a'; ctx.fillRect(cx - w / 2 + 14, cy + 12, (w - 28) * left, 4);
  }
}

// les trois réponses du joueur i (en bas de sa moitié) : ◀ ▲ ▶ à sa couleur ; après un choix, la choisie reste, verte ou rouge
function replies(view, W, M, g, i, P, xs, t, col) {
  if (M.ph !== 'play') return;
  const ctx = view.g, x0 = i ? 326 : 6, w = 308, pk = xs.pick[i];
  const showN = P.gap > 0 ? P.n - 1 : P.n;
  if (showN < 0 || (P.gap > 0 && !pk)) return;
  const Ln = g.lines[showN % DATING.LINES], R = LINES[Ln.id].r, dev = view.deviceOf(i === 0 ? M.a : M.v);
  // la touche de chaque réponse pour l'appareil du joueur (◀ ▲ ▶)
  const KN = dev === 'kb1' ? ['Q', 'Z', 'D'] : dev === 'kb2' ? ['←', '↑', '→'] : ARROW;
  for (let c = 0; c < 3; c++) {
    const y = 254 + c * 27, chosen = P.gap > 0 && pk && pk.c === c, dim = P.gap > 0 && !chosen;
    const q = Ln.ord[c], txt = R[q];
    ctx.globalAlpha = dim ? 0.3 : 1;
    ctx.fillStyle = chosen ? (q === 0 ? '#ff4a8a' : q === 2 ? '#8a1a2a' : '#5a5a7a') : 'rgba(11,6,16,0.82)';
    ctx.beginPath(); ctx.roundRect(x0, y - 12, w, 25, 7); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
    // la touche : la flèche, et le nom de la touche au clavier
    ctx.fillStyle = '#f4ead6'; ctx.beginPath(); ctx.roundRect(x0 + 3, y - 9, 40, 19, 4); ctx.fill();
    ctx.fillStyle = col; ctx.fillRect(x0 + 3, y + 7, 40, 3);
    view.text(KN[c] === ARROW[c] ? ARROW[c] : `${ARROW[c]} ${KN[c]}`, x0 + 23, y, 11, '#0b0610', { mono: true, stroke: false, alpha: dim ? 0.3 : 1 });
    view.text(txt, x0 + 50, y + 1, 14, '#ffffff', { align: 'left', stroke: false, alpha: dim ? 0.3 : 1, maxW: w - 56 });
    ctx.globalAlpha = 1;
  }
  void t;
}
