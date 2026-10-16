// Le médiator d'Epektase (mediator), l'affichage : deux bureaux en bazar vus de dessus, identiques (un par joueur, cadre
// à sa couleur), une grille d'objets du quotidien ; la main du joueur (à sa couleur) passe de l'un à l'autre, le soulève :
// dessous, une bricole et la chaleur (🔥 BRÛLANT, 🌡️ TIÈDE, ❄️ FROID), ou le médiator rose d'Epektase. Au milieu, le vrai
// Epektase en 3D, guitare en main, qui s'impatiente ; il exulte quand on le lui rend.
import { COLORS } from '../../sim/constants.js';
import { MED } from '../../sim/mg/mediator.js';

const PINK = '#ff3a8a';
const OBJ = ['☕', '📓', '🧦', '🍕', '🎧', '📱', '🥤', '🧢', '📦', '🍔', '🧻', '💿', '📚', '🎮'];
const GAG = ['🍟', '🕷️', '🪙', '🧀', '📎', '🦷', '🍬', '🔑', '🪳', '🧷'];
const HEAT = [['❄️ FROID', '#5ac8ff'], ['🌡️ TIÈDE', '#ffa83a'], ['🔥 BRÛLANT', '#ff3a3a']];
const DW = 246, DH = 214, DY = 46, CW = (DW - 14) / MED.COLS, CH = (DH - 14) / MED.ROWS;
const DX = (i) => (i === 0 ? 16 : 640 - 16 - DW);
const cell = (g, i, c) => {
  const j = g.jit[c] || [0, 0, 0];
  return [DX(i) + 7 + ((c % MED.COLS) + 0.5) * CW + j[0], DY + 7 + (((c / MED.COLS) | 0) + 0.5) * CH + j[1], j[2] * Math.PI / 180];
};
const WAIT = ['Il est où ?!', 'Mon médiator !!', 'Je joue dans 5 min !', 'Plus vite !', 'Pas sous la pizza...', 'C\'est mon préféré !', 'Vous le faites exprès ?'];
const HOT = ['CHAUD !!!', 'Tout près !', 'OUIII, là !'];

function ensure(xs) {
  if (xs.on) return xs;
  xs.on = 1; xs.say = { s: WAIT[0], t0: -9 }; xs.mood = { k: '', t0: -9 }; xs.shown = [0, 0]; xs.cur = [null, null]; xs.drop = 0;
  return xs;
}

export default {
  title: "LE MÉDIATOR D'EPEKTASE", color: PINK, icon: '🎸',
  puppets: ['epektase'],
  goal: "Soulève les objets et trouve le médiator d'Epektase !",
  keys: [['dirs', 'bouger la main'], ['A', 'soulever']],
  ach: [["Roadie d'Epektase", 'Détecteur de médiators', 'Rangement Marie Kondo', 'Héros du rock'], ['A soulevé la pizza', 'Bureau en bazar', 'Main froide', 'Viré du groupe']],
  news: (L, d) => `${L} N'A PAS TROUVÉ LE MÉDIATOR : EPEKTASE ANNULE SA TOURNÉE (+${d} %)`,

  draw(view, W, M, dt) {
    const ctx = view.g, g = M.g, xs = ensure(view.xs), t = view.time;
    const L = -view.ox, R = 640 + view.ox, T = -view.oy, B = 360 + view.oy;
    xs.drop = Math.max(0, xs.drop - dt * 3);
    // la chambre : mur violet, posters de rock, moquette
    ctx.fillStyle = '#1e1028'; ctx.fillRect(L, T, R - L, B - T);
    ctx.fillStyle = '#28143a'; for (let k = 0; k < 9; k++) ctx.fillRect(L + k * 84, T, 42, B - T);
    ctx.fillStyle = '#2a1830'; ctx.fillRect(L, 300, R - L, B - 300);
    // Epektase au milieu, derrière les bureaux
    epek(view, W, M, g, xs, t);
    view.timer(M, 320, 30);
    for (let i = 0; i < 2; i++) desk(view, W, M, g, xs, i, t, dt);
  },

  onEvent(view, ev, W, M) {
    const A = view.audio, xs = ensure(view.xs);
    if (!M || !ev.type.startsWith('mgMediator')) return;
    const g = M.g, pan = (i) => (i ? 0.4 : -0.4);
    if (ev.type === 'mgMediatorDesk') {
      xs.drop = 1; xs.cur = [null, null];
      if (A) { A.sfx('wood', 0, 0.5); A.sfx('whoosh', 0, 0.3); }
      if (ev.n > 1) { xs.say = { s: view.pick(WAIT), t0: view.time }; }
    } else if (ev.type === 'mgMediatorMove') {
      if (A) A.sfx('menuMove', pan(ev.p), 0.22);
    } else if (ev.type === 'mgMediatorUp') {
      const [x, y] = cell(g, ev.p, ev.c);
      view.burst(x, y + 10, 6, ['#c8b8a0', '#8a7a6a'], { shape: 'dot', speed: 70, size: 3, life: 0.4 });
      if (A) { A.sfx('woodM', pan(ev.p), 0.4); A.sfx('whoosh', pan(ev.p), 0.2); }
    } else if (ev.type === 'mgMediatorLift') {
      const [x, y] = cell(g, ev.p, ev.c), [, col] = HEAT[ev.h];
      view.burst(x, y, ev.h === 2 ? 14 : 8, [col, '#ffffff'], { shape: ev.h === 2 ? 'star' : 'dot', speed: 120, size: 4, life: 0.5 });
      if (ev.h === 2) { view.sticker(view.pick(HOT), x, y - 30, { size: 12, color: '#ffffff', bg: '#ff3a3a', life: 0.7 }); xs.say = { s: view.pick(HOT), t0: view.time }; view.jolt(0.2, 0.02); }
      if (A) {
        if (ev.h === 2) { A.sfx('flame', pan(ev.p), 0.5); A.sfx('blip', pan(ev.p), 0.4, 5); }
        else if (ev.h === 1) A.sfx('sizzle', pan(ev.p), 0.35);
        else A.sfx('zapS', pan(ev.p), 0.3);
      }
    } else if (ev.type === 'mgMediatorFound') {
      const i = ev.p, slot = i === 0 ? M.a : M.v, [x, y] = cell(g, i, ev.c);
      xs.mood = { k: 'win', t0: view.time }; xs.say = { s: view.pick(['MON MÉDIATOR !!', 'MERCI !!!', 'ROCK\'N\'ROLL !']), t0: view.time };
      view.burst(x, y, 34, [PINK, '#ffffff', '#ffd23a', COLORS[slot]], { shape: 'star', speed: 280, size: 6 });
      view.burst(x, y, 5, ['#fff'], { shape: 'txt', ch: view.pick(['🎸', '🤘', '🎵']), speed: 160, up: 140, size: 12, life: 1.1 });
      view.sticker('TROUVÉ ! 🎸', x, y - 34, { size: 17, color: '#ffffff', bg: PINK, life: 1 });
      view.sticker(`+${ev.pts}`, DX(i) + DW / 2, DY + DH + 66, { size: 16, color: '#ffffff', bg: COLORS[slot], life: 0.8, rot: 0 });
      if (ev.f < 90) view.sticker('⚡ DU PREMIER COUP', DX(i) + DW / 2, DY + 30, { size: 12, color: '#0b0610', bg: '#ffe24a', life: 0.9 });
      if (ev.both) view.sticker('EX AEQUO !', 320, 200, { size: 16, color: '#ffffff', bg: '#7a3aff', life: 0.9 });
      view.jolt(0.6, 0.05, '#ffd0e8', 0.25); view.lines(0.3);
      if (A) { A.sfx('powerchord', pan(i), 0.6); A.sfx('cash', pan(i), 0.4); A.sfx('crowd', 0, 0.3); if (ev.n >= 2) A.sfx('airhorn', 0, 0.35); A.say(view.pick(['Mon médiator !', 'Merci !', 'Rock and roll !']), 0.4, 1.2); }
    }
  },
};

// Epektase : il s'impatiente (sa provocation), grosse tête, sa bulle ; il exulte (sa danse de victoire) quand on le trouve
function epek(view, W, M, g, xs, t) {
  const ctx = view.g, win = t - xs.mood.t0 < 1.4 && xs.mood.k === 'win';
  const o = M.ph === 'outro' || win ? { emote: 'win', head: 1.9 } : { emote: 'select', head: 1.7 + Math.min(0.5, (g.t || 0) / 600), emoteSpeed: 1 + Math.min(1, (g.t || 0) / 300) };
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(320, 318, 44, 9, 0, 0, Math.PI * 2); ctx.fill();
  if (!view.puppet('epektase', 320, 318, 176, { ...o, key: 'medepek', shadow: false })) view.portraitAt('epektase', 320, 230, 70, PINK, false);
  if (M.ph === 'play' && g.ph === 'look' && t - xs.say.t0 > 2.8) xs.say = { s: view.pick(WAIT), t0: t };
  const st = t - xs.say.t0;
  if (M.ph === 'play' && st < 2) {
    const s = xs.say.s, a = Math.min(1, st * 8, (2 - st) * 4), pop = st < 0.1 ? 1.25 - st * 2.5 : 1;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(320, 70); ctx.scale(pop, pop);
    ctx.font = "11px 'Lilita One', 'Trebuchet MS', sans-serif";
    const w = Math.min(112, ctx.measureText(s).width + 16);
    ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.roundRect(-w / 2 - 3, -14, w + 6, 28, 9); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-7, 12); ctx.lineTo(7, 12); ctx.lineTo(0, 26); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff4fa'; ctx.beginPath(); ctx.roundRect(-w / 2, -11, w, 22, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-4, 10); ctx.lineTo(4, 10); ctx.lineTo(0, 21); ctx.closePath(); ctx.fill();
    ctx.restore();
    view.text(s, 320, 74, 11, '#0b0610', { stroke: false, alpha: a, maxW: 108 });
  }
}

// le médiator rose (un triangle arrondi), à plat sur le bureau
function pick(ctx, x, y, s, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-s, -s * 0.75); ctx.quadraticCurveTo(0, -s * 1.15, s, -s * 0.75); ctx.quadraticCurveTo(s * 0.7, s * 0.3, 0, s * 1.1); ctx.quadraticCurveTo(-s * 0.7, s * 0.3, -s, -s * 0.75); ctx.closePath();
  ctx.lineWidth = 3; ctx.strokeStyle = '#0b0610'; ctx.stroke(); ctx.fillStyle = PINK; ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.ellipse(-s * 0.35, -s * 0.45, s * 0.25, s * 0.12, -0.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// le bureau d'un joueur : le plateau en bois (cadre à sa couleur), les objets, les chaleurs, sa main
function desk(view, W, M, g, xs, i, t, dt) {
  const ctx = view.g, slot = i === 0 ? M.a : M.v, col = COLORS[slot], P = g.p[i], dx = DX(i), drop = xs.drop;
  xs.shown[i] += (P.s - xs.shown[i]) * Math.min(1, dt * 10);
  const oy = -drop * drop * 30;
  ctx.save(); ctx.translate(0, oy);
  ctx.fillStyle = '#0b0610'; ctx.fillRect(dx - 6, DY - 6, DW + 12, DH + 12);
  ctx.fillStyle = col; ctx.fillRect(dx - 4, DY - 4, DW + 8, DH + 8);
  ctx.fillStyle = '#7a4a2a'; ctx.fillRect(dx, DY, DW, DH);
  ctx.fillStyle = '#6a3e22'; for (let k = 0; k < 9; k++) ctx.fillRect(dx, DY + 10 + k * 24, DW, 2);
  ctx.strokeStyle = 'rgba(60,30,10,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(dx + 40, DY + DH - 24, 9, 0, Math.PI * 2); ctx.stroke(); // une trace de tasse
  if (M.ph === 'play' && g.kinds.length) {
    const found = g.ph === 'gap' && g.n > 0;
    for (let c = 0; c < MED.COLS * MED.ROWS; c++) {
      const [x, y, rot] = cell(g, i, c), up = P.up[c], lifting = P.lift > 0 && P.lc === c;
      if (up >= 0 || (found && c === g.pick)) {
        // soulevé : ce qu'il y avait dessous, la chaleur ; l'objet poussé de côté
        if (c === g.pick) { ctx.fillStyle = 'rgba(255,58,138,0.35)'; ctx.beginPath(); ctx.arc(x, y, 24 + Math.sin(t * 10) * 3, 0, Math.PI * 2); ctx.fill(); pick(ctx, x, y, 12, rot); }
        else {
          const [lab, hc] = HEAT[up];
          ctx.fillStyle = hc; ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(x, y, 24, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
          view.text(GAG[(g.kinds[c] + c) % GAG.length], x, y - 2, 14, '#fff', { stroke: false, alpha: 0.85 });
          view.text(lab, x, y + 20, 9, hc, { mono: true });
        }
        view.text(OBJ[g.kinds[c]], x + 20, y - 18, 14, '#fff', { stroke: false, alpha: 0.5 });
        continue;
      }
      // pas encore soulevé (ou en train de l'être : il monte et penche)
      const q = lifting ? 1 - P.lift / MED.LIFT : 0;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x, y + 14, 18 - q * 4, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.translate(x, y - q * 22); ctx.rotate(rot + q * 0.6); ctx.scale(1 + q * 0.25, 1 + q * 0.25);
      view.text(OBJ[g.kinds[c]], 0, 10, 30, '#fff', { stroke: false });
      ctx.restore();
    }
    // la main (à la couleur du joueur), qui glisse d'un objet à l'autre
    const [hx, hy] = cell(g, i, P.c);
    const cu = xs.cur[i] || (xs.cur[i] = [hx, hy]);
    cu[0] += (hx - cu[0]) * Math.min(1, dt * 18); cu[1] += (hy - cu[1]) * Math.min(1, dt * 18);
    if (g.ph === 'look') {
      const pul = 1 + Math.sin(t * 9) * 0.06;
      ctx.strokeStyle = '#0b0610'; ctx.lineWidth = 6; ctx.beginPath(); ctx.roundRect(cu[0] - 27 * pul, cu[1] - 27 * pul, 54 * pul, 54 * pul, 10); ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = 3.5; ctx.stroke();
      const press = P.lift > 0 ? 6 : 0;
      view.text('✋', cu[0] + 16, cu[1] + 26 + press, 22, '#fff', { stroke: false });
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cu[0] + 25, cu[1] + 32, 3, 0, Math.PI * 2); ctx.fill();
      // la touche pour soulever, juste au-dessus de l'objet visé (pas sur un objet déjà soulevé)
      if (P.up[P.c] < 0 && P.lift <= 0) view.hint(W, M, i, Math.min(dx + DW - 62, Math.max(dx + 62, cu[0])), cu[1] - 34, [['A', 'soulever']]);
    }
  }
  ctx.restore();
  // l'étiquette, le score
  view.who(W, M, i, dx + DW / 2, DY + DH + 8, { align: 'center' });
  if (g.ph === 'look') view.hint(W, M, i, dx + DW / 2, DY + DH + 46, [['dirs', 'bouger la main']]);
  view.text(`🎸 ${P.found}   ${Math.round(xs.shown[i])} PTS`, dx + DW / 2, DY + DH + 68, 13, col, { mono: true });
}
