// Les haltères de BIDO (dumbbell), l'affichage : deux salles de muscu côte à côte. Dans chacune, le râtelier (côté
// extérieur, 5 haltères de couleurs et tailles différentes, le poids écrit dessus), BIDO en vrai modèle 3D (grosse tête)
// qui réclame son poids dans une bulle, et la main du joueur à sa couleur. Le bon haltère : BIDO le soulève, tout fier
// (💪, cœurs) ; le mauvais : il s'énerve et le renvoie au râtelier.
import { DB, slotXY } from '../../sim/mg/dumbbell.js';
import { COLORS } from '../../sim/constants.js';

const INK = '#0b0610';
const WCOL = ['#3bdc5a', '#3b8bff', '#ffd23a', '#ff8a2a', '#ff3b3b'];
const SX = (i, lx) => (i === 0 ? 10 + lx : 630 - lx);
const onBidoNow = (P) => P.x >= DB.BIDO[0] && P.x <= DB.BIDO[1] && P.y >= DB.BIDO[2] && P.y <= DB.BIDO[3];
const BIDO_LX = 227, FEET = 300;
const ASK = ['Donne-moi le {w} !', '{w} ! VITE !', 'Le {w}, mon cœur !', 'Je veux le {w} !', '{w}, s\'il te plaît !'];
const YES = ['MERCI BB 💪', 'LE BON ! ❤️', 'SEC ! 💪', 'GAINS +1', 'T\'ES MON COACH'];
const NO = ['C\'EST PAS ÇA ! 💢', 'TROP LÉGER ?!', 'TU ME VEUX DU MAL ?', 'NON NON NON'];

function S(view) {
  const xs = view.xs;
  if (!xs.on) { xs.on = 1; xs.bub = [0, 0]; xs.lift = [null, null]; xs.fly = []; xs.ask = ['', '']; xs.sc = [0, 0]; xs.pop = [0, 0]; xs.angry = [0, 0]; }
  return xs;
}

// un haltère (k : l'indice du poids), centré en (x, y), échelle s
function bell(view, x, y, k, s = 1, a = 0) {
  const ctx = view.g, r = (8 + k * 2.4) * s, half = (20 + k * 2) * s;
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  ctx.fillStyle = INK; ctx.fillRect(-half - 2, -3.5 * s, half * 2 + 4, 7 * s);
  ctx.fillStyle = '#c8c8d0'; ctx.fillRect(-half, -2 * s, half * 2, 4 * s);
  for (const sx of [-1, 1]) {
    const px = sx * (half - 4 * s);
    ctx.fillStyle = INK; ctx.fillRect(px - 5 * s, -r - 2, 10 * s, r * 2 + 4);
    ctx.fillStyle = WCOL[k]; ctx.fillRect(px - 3.5 * s, -r, 7 * s, r * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(px - 3.5 * s, -r, 2 * s, r * 2);
  }
  ctx.restore();
  if (s >= 0.9) { ctx.fillStyle = INK; ctx.beginPath(); ctx.roundRect(x - 13 * s, y - 7 * s, 26 * s, 14 * s, 4 * s); ctx.fill(); }
  view.text(`${DB.KG[k]}`, x, y + 0.5, 10 * s, WCOL[k], { mono: true, stroke: s < 0.9 });
}

// la main du joueur (un gant à sa couleur), fermée quand elle tient quelque chose
function hand(ctx, x, y, col, closed, stun) {
  ctx.save(); ctx.translate(x, y); ctx.scale(1.3, 1.3); if (stun) ctx.rotate(Math.sin(performance.now() / 40) * 0.3);
  ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(0, 0, 13, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, 0, 10.5, 9.5, 0, 0, Math.PI * 2); ctx.fill();
  if (!closed) for (let k = 0; k < 4; k++) { ctx.fillStyle = INK; ctx.fillRect(-9 + k * 5, -19, 5, 11); ctx.fillStyle = col; ctx.fillRect(-8 + k * 5, -18, 3, 10); }
  else { ctx.fillStyle = 'rgba(0,0,0,0.3)'; for (let k = 0; k < 3; k++) ctx.fillRect(-7 + k * 5, -6, 1.5, 8); }
  ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.ellipse(-3, -3, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawRoom(view, W, M, g, i, xs, dt) {
  const ctx = view.g, P = g.p[i], slot = i === 0 ? M.a : M.v, col = COLORS[slot], t = view.time;
  const want = g.req[P.n % g.req.length], bx = SX(i, BIDO_LX);
  // le râtelier
  const rx = SX(i, DB.RACK_X), top = DB.RACK_Y - 26, bot = DB.RACK_Y + 4 * DB.RACK_DY + 24;
  ctx.fillStyle = INK; ctx.fillRect(rx - 46, top - 2, 92, bot - top + 4);
  ctx.fillStyle = '#5a3a24'; ctx.fillRect(rx - 44, top, 88, bot - top);
  ctx.fillStyle = '#7a5234'; ctx.fillRect(rx - 44, top, 88, 4);
  view.text('RÂTELIER', rx, top - 8, 8, col, { mono: true });
  let near = -1;
  if (P.hold < 0 && P.stun <= 0) { let bd = DB.GRAB_R * DB.GRAB_R; for (let k = 0; k < 5; k++) { const [sx, sy] = slotXY(k), d = (sx - P.x) ** 2 + (sy - P.y) ** 2; if (d < bd) { bd = d; near = k; } } }
  for (let k = 0; k < 5; k++) {
    const [, sy] = slotXY(k), w = g.rack[k];
    ctx.fillStyle = '#3a2416'; ctx.fillRect(rx - 40, sy + 18, 80, 4);
    if (P.hold === w || xs.fly.some((f) => f.i === i && f.w === w) || (xs.lift[i] && xs.lift[i].w === w && t - xs.lift[i].t < 0.9)) { view.text('…', rx, sy, 10, '#8a7a6a', { stroke: false }); continue; }
    if (k === near) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.setLineDash([3, 3]); ctx.strokeRect(rx - 42, sy - 21, 84, 42); ctx.setLineDash([]); }
    // celui que BIDO veut : il brille, une flèche le montre (quand la main est vide)
    if (w === want && P.hold < 0 && P.wait <= 0 && M.ph === 'play') {
      const pl = 0.5 + 0.5 * Math.sin(t * 10);
      ctx.save(); ctx.globalAlpha = 0.35 + pl * 0.35; ctx.fillStyle = WCOL[w]; ctx.fillRect(rx - 44, sy - 22, 88, 44); ctx.restore();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.strokeRect(rx - 44, sy - 22, 88, 44);
      view.text(i === 0 ? '◀ ICI' : 'ICI ▶', SX(i, DB.RACK_X + 70 + pl * 6), sy, 14, '#ffffff', { mono: true });
    }
    bell(view, rx, sy, w, 1 + (k === near ? 0.08 : 0));
  }
  // BIDO (le vrai modèle, grosse tête) ; il soulève le bon, s'énerve sur le mauvais
  const lift = xs.lift[i], lt = lift ? t - lift.t : 9;
  const o = { key: 'bido' + i, face: i === 0 ? 'threeL' : 'three', head: 1.8 };
  if (M.ph === 'outro') o.emote = P.s >= g.p[1 - i].s ? 'win' : 'sob';
  else if (P.stun > 0) { o.emote = 'angry_01'; o.tint = '#ff2020'; o.tintK = 0.25; }
  else if (lt < 1) o.emote = 'victory_celebration';
  else if (P.hold >= 0) o.emote = 'agree';
  if (view.pupOn(M) && !view.actor('bido', 2 + i, bx + (P.stun > 0 ? Math.sin(t * 50) * 2 : 0), FEET, 170, o)) view.portraitAt('bido', bx, FEET - 90, 70, col, i === 1);
  if (lift && lt < 1) { // l'haltère au-dessus de sa tête
    const up = Math.abs(Math.sin(lt * 9)) * 16;
    bell(view, bx, 110 - up, lift.w, 1.3);
    if (lt < 0.5) view.text('💪', bx + (i === 0 ? -48 : 48), 130 - lt * 30, 20, '#fff', { stroke: false });
  }
  if (P.stun > 0) view.text('💢', bx + 30, 105 + Math.sin(t * 20) * 3, 22, '#fff', { stroke: false });
  // la zone de BIDO quand on porte un haltère
  if (P.hold >= 0 && M.ph === 'play') {
    const x0 = Math.min(SX(i, DB.BIDO[0]), SX(i, DB.BIDO[1])), w = DB.BIDO[1] - DB.BIDO[0];
    ctx.strokeStyle = `rgba(255,255,255,${0.5 + 0.4 * Math.sin(t * 10)})`; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.lineDashOffset = -t * 20;
    ctx.strokeRect(x0, DB.BIDO[2], w, DB.BIDO[3] - DB.BIDO[2] - 34); ctx.setLineDash([]);
    view.text(`LÂCHE ICI (${view.keyName(M, i, 'A')})`, x0 + w / 2, DB.BIDO[3] - 46, 10, '#ffffff', { mono: true });
  }
  // la bulle : le poids voulu
  xs.bub[i] = Math.max(0, xs.bub[i] - dt * 3);
  if (P.wait <= 0 && M.ph === 'play') {
    const k = 1 + xs.bub[i] * 0.4, by = 76;
    ctx.save(); ctx.translate(bx, by); ctx.scale(k, k); ctx.rotate(Math.sin(t * 4 + i) * 0.04);
    ctx.fillStyle = INK; ctx.beginPath(); ctx.roundRect(-58, -26, 116, 46, 12); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect(-55, -23, 110, 40, 10); ctx.fill();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(-6, 18); ctx.lineTo(6, 18); ctx.lineTo(0, 30); ctx.fill();
    ctx.restore();
    view.text(`${DB.KG[want]} KG !`, bx, by - 4, 21 * k, WCOL[want], { mono: true });
    view.text(xs.ask[i], bx, by + 12, 7, '#4a3a5a', { mono: true, stroke: false });
  }
  // la main (et l'haltère qu'elle porte)
  const hx = SX(i, P.x), hy = P.y;
  if (P.hold >= 0) bell(view, hx, hy + 14, P.hold, 1, Math.sin(t * 6) * 0.08 * (1 + P.hold * 0.5));
  // en portant : une flèche de la main vers BIDO
  if (P.hold >= 0 && M.ph === 'play') {
    const tx = bx, ty = 200, dx = tx - hx, dy = ty - hy, L = Math.hypot(dx, dy);
    if (L > 40) {
      ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.setLineDash([8, 6]); ctx.lineDashOffset = -t * 40;
      ctx.beginPath(); ctx.moveTo(hx + dx / L * 24, hy + dy / L * 24); ctx.lineTo(tx - dx / L * 22, ty - dy / L * 22); ctx.stroke(); ctx.setLineDash([]);
      const a = Math.atan2(dy, dx), ex = tx - dx / L * 18, ey = ty - dy / L * 18;
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(ex + Math.cos(a) * 10, ey + Math.sin(a) * 10); ctx.lineTo(ex + Math.cos(a + 2.5) * 12, ey + Math.sin(a + 2.5) * 12); ctx.lineTo(ex + Math.cos(a - 2.5) * 12, ey + Math.sin(a - 2.5) * 12); ctx.fill();
      ctx.restore();
    }
  }
  hand(ctx, hx, hy, col, P.hold >= 0, P.stun > 0);
  if (M.ph === 'play' && P.stun <= 0) view.hint(W, M, i, hx, hy + 34, P.hold >= 0 ? [['A', onBidoNow(P) ? 'LÂCHE !' : 'lâcher sur BIDO']] : [['dirs', 'main'], ['A', 'prendre']], { size: 0.85 });
  if (P.hold >= 3) view.text('😰', hx + 16, hy - 16, 11, '#fff', { stroke: false });
  // en bas : qui, le score
  xs.sc[i] += (P.s - xs.sc[i]) * 0.2; xs.pop[i] = Math.max(0, xs.pop[i] - dt * 4);
  view.who(W, M, i, SX(i, 4), 306, { align: i === 0 ? 'left' : 'right', size: 0.9 });
  view.text(`💪 ${Math.round(xs.sc[i])}`, bx, 318, 16 * (1 + xs.pop[i] * 0.4), P.s >= g.p[1 - i].s ? '#ffd23a' : '#ffffff', { mono: true });
}

export default {
  title: 'LES HALTÈRES DE BIDO', color: '#ff8a3a', icon: '🏋️',
  input: 'mouse',
  puppets: ['bido'],
  goal: 'Prends l\'haltère que BIDO demande et lâche-le sur lui !',
  keys: { pad: [['stick', 'main'], ['A', 'prendre / lâcher']], kb: [['dirs', 'main'], ['A', 'prendre / lâcher']], kb1: [['dirs', 'main'], ['A', 'prendre / lâcher'], ['mouse', 'aussi']] },
  ach: [['Coach de BIDO', 'Le bon poids, toujours', 'Gainé du cerveau', 'Partenaire de muscu'], ['Haltère dans le pied', 'Ne sait pas compter', 'BIDO est déçu', 'Allergique à la fonte']],
  news: (L, d) => `${L} DONNE LE MAUVAIS HALTÈRE À BIDO : ${d} %, BIDO NE LUI PARLE PLUS`,
  warm(view) { for (let i = 0; i < 2; i++) view.puppet('bido', -9999, -9999, 10, { key: 'bido' + i, shadow: false }); },

  draw(view, W, M, dt) {
    const ctx = view.g, g = M.g, xs = S(view), L = -view.ox, Rr = 640 + view.ox, T = -view.oy, B = 360 + view.oy, t = view.time;
    // la salle : murs carrelés, miroirs, sol en caoutchouc
    ctx.fillStyle = '#2a2236'; ctx.fillRect(L, T, Rr - L, B - T);
    ctx.fillStyle = 'rgba(255,255,255,0.04)'; for (let y = Math.floor(T / 24) * 24; y < 290; y += 24) ctx.fillRect(L, y, Rr - L, 1);
    for (const mx of [150, 490]) { const gm = ctx.createLinearGradient(mx - 60, 0, mx + 60, 0); gm.addColorStop(0, 'rgba(180,220,255,0.05)'); gm.addColorStop(0.5, 'rgba(220,240,255,0.12)'); gm.addColorStop(1, 'rgba(180,220,255,0.05)'); ctx.fillStyle = gm; ctx.fillRect(mx - 60, 50, 120, 200); }
    ctx.fillStyle = '#18141e'; ctx.fillRect(L, 290, Rr - L, B - 290);
    ctx.fillStyle = '#ff8a3a'; ctx.fillRect(L, 290, Rr - L, 3);
    view.text('🏋️ LES HALTÈRES DE BIDO', 320, T + 16, 17, '#ff8a3a', { title: true });
    view.timer(M, 320, T + 42);
    // les haltères renvoyés au râtelier
    xs.fly = xs.fly.filter((f) => {
      const u = (t - f.t) / 0.5;
      if (u >= 1) return false;
      const x = f.x0 + (f.x1 - f.x0) * u, y = f.y0 + (f.y1 - f.y0) * u - Math.sin(u * Math.PI) * 60;
      bell(view, x, y, f.w, 1, u * 12);
      return true;
    });
    for (let i = 0; i < 2; i++) drawRoom(view, W, M, g, i, xs, dt);
    ctx.fillStyle = INK; ctx.fillRect(318, 60, 4, 290); ctx.fillStyle = '#ff8a3a'; ctx.fillRect(319, 60, 2, 290);
  },

  onEvent(view, ev, W, M) {
    if (!M || !ev.type.startsWith('mgDumb')) return;
    const A = view.audio, xs = S(view), g = M.g, i = ev.p, P = g.p[i], slot = i === 0 ? M.a : M.v, bx = SX(i, BIDO_LX), pan = i ? 0.4 : -0.4;
    switch (ev.type) {
      case 'mgDumbAsk': {
        xs.bub[i] = 1; xs.ask[i] = view.pick(ASK).replace('{w}', `${DB.KG[ev.w]} kg`);
        if (A && ev.n > 0) A.sfx('pop', pan, 0.5, 2);
        if (A && i === 0) A.say(`${DB.KG[ev.w]} kilos !`, 0.3, 1.1);
        break;
      }
      case 'mgDumbGrab': {
        const [sx, sy] = slotXY(ev.k);
        view.burst(SX(i, sx), sy, 6, [WCOL[ev.w], '#ffffff'], { shape: 'dot', speed: 80, size: 3, life: 0.3 });
        if (A) { A.sfx('grab', pan, 0.5); A.sfx('clink', pan, 0.4, ev.w); }
        break;
      }
      case 'mgDumbDrop': {
        const k = g.rack.indexOf(ev.w), [sx, sy] = slotXY(k);
        xs.fly.push({ i, w: ev.w, t: view.time, x0: SX(i, P.x), y0: P.y + 14, x1: SX(i, sx), y1: sy });
        if (A) A.sfx('throw', pan, 0.4);
        break;
      }
      case 'mgDumbGive': {
        if (ev.ok) {
          xs.lift[i] = { w: ev.w, t: view.time }; xs.pop[i] = 1;
          view.react(2 + i, { emote: 'victory_celebration', life: 1, hop: 0.06, pop: 0.3 });
          view.sticker(view.pick(YES), bx, 160, { size: 14 + Math.min(4, ev.n), color: INK, bg: '#7cff8a', life: 0.8, rot: (Math.random() - 0.5) * 0.3 });
          view.burst(bx, 120, 16, ['#fff'], { shape: 'txt', ch: view.pick(['💪', '❤️', '✨']), speed: 160, size: 9, up: 120, life: 0.9 });
          view.burst(bx, 120, 18, [WCOL[ev.w], '#ffd23a', COLORS[slot]], { shape: 'star', speed: 220, size: 5, life: 0.5 });
          view.floats.push({ text: `+${DB.OK}`, x: bx, y: 290, t: 0, life: 0.8, color: '#7cff8a', size: 16 });
          if (ev.n >= 3) view.sticker(`SÉRIE x${ev.n} 🔥`, bx, 200, { size: 12, color: '#ffffff', bg: COLORS[slot], life: 0.8 });
          view.jolt(0.2 + ev.w * 0.08, 0.03, null, 0);
          if (A) { A.sfx('thud', pan, 0.5); A.sfx('cash', pan, 0.4); A.sfx('heart', pan, 0.4, Math.min(5, ev.n)); if (ev.w >= 3) A.say('Hmmmpf ! Léger !', 0.3, 1.1); }
        } else {
          xs.angry[i] = 1;
          const k = g.rack.indexOf(ev.w), [sx, sy] = slotXY(k);
          xs.fly.push({ i, w: ev.w, t: view.time, x0: bx, y0: 140, x1: SX(i, sx), y1: sy });
          view.react(2 + i, { emote: 'angry_02', life: 0.7, shake: 6 });
          view.sticker(`${view.pick(NO)}`, bx, 160, { size: 14, color: '#ffffff', bg: '#c01020', life: 0.9, rot: (Math.random() - 0.5) * 0.3 });
          view.floats.push({ text: `IL VOULAIT ${DB.KG[ev.want]} KG`, x: bx, y: 200, t: 0, life: 1, color: '#ff9a9a', size: 11 });
          view.floats.push({ text: `-${DB.BAD}`, x: bx, y: 290, t: 0, life: 0.8, color: '#ff4a4a', size: 16 });
          view.burst(bx, 130, 3, ['#fff'], { shape: 'txt', ch: '💢', speed: 120, size: 12, life: 0.7 });
          view.jolt(0.5, 0.05, '#ff2020', 0.2);
          if (A) { A.sfx('error', pan, 0.6); A.sfx('whip', pan, 0.5); A.say(view.pick(['Non !', 'C\'est pas le bon !', 'Grrr !']), 0.2, 1); }
        }
        break;
      }
      default: break;
    }
  },
};
