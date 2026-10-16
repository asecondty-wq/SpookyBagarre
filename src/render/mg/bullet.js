// L'enfer des balles (bullet), l'affichage : les deux moitiés de l'arène (600 x 316 à l'écran, décalée de FX, FY ; J1 à
// gauche, J2 à droite, chacune à sa couleur), le ciel étoilé qui défile, le cercle magique derrière chaque Citrouille
// Suprême (chapeau de sorcière, yeux qui brûlent), les balles qui brillent (petites, grains de riz, orbes, étoiles,
// citrouilles qui éclatent), les deux têtes volantes (ailes, hitbox toujours visible), les cartes de sort, l'en-tête.
import { COLORS } from '../../sim/constants.js';
import { BULLET } from '../../sim/mg/bullet.js';

const B = BULLET, ST = B.ST, FX = 20, FY = 38;
const BC = ['#ff5aa8', '#ffd23a', '#ff3a3a', '#4ac8ff', '#b46aff', '#7cff8a', '#ff9a2a', '#ff6ad8', '#6ad8ff'];
const SPELLS = [
  ['Signe Citrouille', '« Fleur du caveau »'],
  ['Signe Larme', '« Spirale de Nymano »'],
  ['Signe Bagarre', '« Pluie de citrouilles »'],
  ['Dernier sort', '« Floraison infernale »'],
];
const OUCH = ['Aïe !', 'Touché !', 'Oups !', 'Ça pique !'];

function xs(view) {
  const X = view.xs;
  if (!X.init) { X.init = 1; X.flash = 0; X.mouth = 0; X.hurt = [0, 0]; X.spell = { n: -1, t: 9 }; X.react = [{ k: '', t: 0 }, { k: '', t: 0 }]; }
  return X;
}

function star(ctx, x, y, r, rot) {
  ctx.beginPath();
  for (let k = 0; k < 10; k++) { const a = rot + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill();
}

// la Citrouille Suprême
function drawBoss(view, x, y, t, flash, mouth) {
  const ctx = view.g, s = 0.85 + Math.sin(t * 4) * 0.03;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  // l'aura
  const au = ctx.createRadialGradient(0, 0, 10, 0, 0, 62); au.addColorStop(0, 'rgba(255,140,40,0.45)'); au.addColorStop(1, 'rgba(255,60,120,0)');
  ctx.fillStyle = au; ctx.beginPath(); ctx.arc(0, 0, 62, 0, 7); ctx.fill();
  // le corps : des côtes
  ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.ellipse(0, 2, 36, 29, 0, 0, 7); ctx.fill();
  for (const [ox, rx, c] of [[-16, 17, '#d8601a'], [16, 17, '#d8601a'], [-7, 16, '#f07a20'], [7, 16, '#f07a20'], [0, 13, '#ff9a30']]) { ctx.fillStyle = flash > 0 ? '#ffffff' : c; ctx.beginPath(); ctx.ellipse(ox, 2, rx, 27, 0, 0, 7); ctx.fill(); }
  // les yeux, la bouche
  const glow = `rgba(255,${200 + Math.round(Math.sin(t * 20) * 40)},60,1)`;
  ctx.fillStyle = flash > 0 ? '#ff2020' : glow;
  ctx.beginPath(); ctx.moveTo(-18, -4); ctx.lineTo(-6, -2); ctx.lineTo(-12, -14); ctx.fill();
  ctx.beginPath(); ctx.moveTo(18, -4); ctx.lineTo(6, -2); ctx.lineTo(12, -14); ctx.fill();
  const mh = 5 + mouth * 9;
  ctx.beginPath(); ctx.moveTo(-18, 8); for (let k = 0; k <= 6; k++) ctx.lineTo(-18 + k * 6, 8 + (k % 2 ? 4 : 0)); ctx.lineTo(18, 8 + mh); for (let k = 6; k >= 0; k--) ctx.lineTo(-18 + k * 6, 8 + mh + (k % 2 ? -3 : 0)); ctx.fill();
  // le chapeau de sorcière
  ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.ellipse(0, -24, 30, 6, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#4a1a6a'; ctx.beginPath(); ctx.ellipse(0, -25, 28, 4.5, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.moveTo(-17, -25); ctx.lineTo(10 + Math.sin(t * 3) * 3, -66); ctx.lineTo(17, -25); ctx.fill();
  ctx.fillStyle = '#5a2a80'; ctx.beginPath(); ctx.moveTo(-14, -26); ctx.lineTo(9 + Math.sin(t * 3) * 3, -62); ctx.lineTo(14, -26); ctx.fill();
  ctx.fillStyle = '#ffd23a'; ctx.fillRect(-14, -31, 28, 4);
  ctx.restore();
}

// les persos du jeu (aussi pendant l'explication, d'après la clé de la vue « jeu:a:v ») et les clés de leurs
// marionnettes : le vaisseau (deux fois le même perso = deux clés) et le buste de l'en-tête
function chars(view, W, M) {
  if (W && M) return [W.fighters[M.a].char, W.fighters[M.v].char];
  const k = String(view.key || '').split(':'), vs = view.mv && view.mv.views;
  const a = vs && vs[+k[1]], v = vs && vs[+k[2]];
  return a && v && a.char && v.char ? [a.char, v.char] : null;
}
const skey = (cs, i) => (i && cs[1] === cs[0] ? cs[1] + '#2' : cs[i]);
function touchPuppets(view, cs) { // toutes les marionnettes du jeu rendues une fois (pendant l'explication)
  if (cs) for (let i = 0; i < 2; i++) view.puppet(cs[i], -9999, -9999, 10, { key: skey(cs, i), shadow: false });
}

// le vaisseau : le vrai modèle du perso, tout petit, grosse tête, qui vole bras en l'air (penché selon le stick), des
// ailes qui battent derrière ; la hitbox est au milieu du torse (dessinée plus tard, par-dessus les balles)
const SH = 24; // la hauteur du pilote (la hitbox est à 0,58 de sa hauteur au-dessus de ses pieds)
function drawShip(view, W, x, y, slot, P, t, X, i, cs) {
  const ctx = view.g, col = COLORS[slot];
  const blink = P.inv > 0 && Math.floor(t * 18) % 2;
  ctx.save(); ctx.translate(x, y);
  if (X.hurt[i] > 0) ctx.translate((Math.random() - 0.5) * 6 * X.hurt[i], (Math.random() - 0.5) * 6 * X.hurt[i]);
  ctx.globalAlpha = blink ? 0.3 : 1;
  // la lueur (rouge quand il vient d'être touché)
  const gl = ctx.createRadialGradient(0, -4, 2, 0, -4, 24); gl.addColorStop(0, X.hurt[i] > 0.3 ? '#ff2040' : col); gl.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha *= 0.45; ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, -4, 24, 0, 7); ctx.fill(); ctx.globalAlpha = blink ? 0.3 : 1;
  // les ailes qui battent, dans le dos
  const fl = Math.sin(t * 22 + i) * 3;
  ctx.rotate(P.mx * 0.25);
  ctx.fillStyle = '#0b0610';
  for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * 4, -2); ctx.lineTo(sd * 21, -12 - fl); ctx.lineTo(sd * 17, 3); ctx.closePath(); ctx.fill(); }
  ctx.fillStyle = col;
  for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * 4, -2); ctx.lineTo(sd * 19, -10 - fl); ctx.lineTo(sd * 16, 1); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  const hurt = X.hurt[i] > 0.35, rot = P.mx * 0.3 + (hurt ? Math.sin(t * 40) * 0.25 : 0);
  // les pieds sous la hitbox, tournés avec le corps (la hitbox reste au milieu du torse)
  const fx = x - Math.sin(rot) * SH * 0.58, fy = y + Math.cos(rot) * SH * 0.58;
  const ok = cs && view.puppet(cs[i], fx, fy, SH, {
    key: skey(cs, i), state: hurt ? 'hitstun' : 'helpless', kb: 90, vy: 3, head: 2.5, rot, shadow: false,
    face: 0.34 + P.mx * 0.7, alpha: blink ? 0.3 : 1,
  });
  if (!ok) view.portraitAt(W.fighters[slot].char, x, y - 1, 15, col, false, blink ? 0.3 : 1);
}
// la hitbox, par-dessus tout, à la couleur du joueur : elle se voit toujours, même au milieu des balles
function drawHitbox(ctx, x, y, col) {
  ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.arc(x, y, B.HIT + 3.2, 0, 7); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, B.HIT + 2.2, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, B.HIT + 0.6, 0, 7); ctx.fill();
}

export default {
  title: 'L\'ENFER DES BALLES', color: '#ff5aa8', icon: '🎃',
  goal: 'Esquive les balles : le moins touché gagne !',
  keys: [['dirs', 'esquiver']],
  tags: false, // (son en-tête à lui : les étiquettes et les touches de chacun)
  // pendant la présentation : toutes les marionnettes du jeu rendues une fois (pas d'à-coup au premier dessin)
  warm(view, W, M) { touchPuppets(view, chars(view, W, M)); },
  ach: [['Miko du cimetière', 'Esquive divine', 'Danmaku no Kami', 'Pilote de l\'extrême'], ['Passoire céleste', 'Aimant à balles', 'Hitbox de camion', 'Game over (mais en vrai)']],
  news: (L, d) => `${L} CRIBLÉ PAR UNE CITROUILLE GÉANTE : ${d} % ET DES BALLES PARTOUT`,

  draw(view, W, M, dt) {
    const ctx = view.g, g = M.g, X = xs(view), t = view.time, L = -view.ox, Rr = 640 + view.ox, T = -view.oy, Bt = 360 + view.oy;
    const slots = [M.a, M.v], cs = chars(view, W, M);
    for (let i = 0; i < 2; i++) { X.react[i].t -= dt; X.hurt[i] = Math.max(0, X.hurt[i] - dt * 2.5); }
    X.flash = Math.max(0, X.flash - dt * 6); X.mouth = Math.max(0, X.mouth - dt * 3);
    // le cadre
    ctx.fillStyle = '#0b0610'; ctx.fillRect(L, T, Rr - L, Bt - T);
    const p3 = g.ph >= 3 ? 1 : 0, b = g.b;
    // les deux moitiés : chacune son ciel, sa citrouille, ses balles, son pilote
    for (let i = 0; i < 2; i++) {
      const x0 = FX + i * B.HW, col = COLORS[slots[i]], bx = FX + (i ? B.FW - g.bx : g.bx), by = FY + g.by;
      ctx.save(); ctx.beginPath(); ctx.rect(x0, FY, B.HW, B.FH); ctx.clip();
      const sky = ctx.createLinearGradient(0, FY, 0, FY + B.FH);
      sky.addColorStop(0, p3 ? '#3a0a2a' : '#1a0838'); sky.addColorStop(1, p3 ? '#120418' : '#06030f');
      ctx.fillStyle = sky; ctx.fillRect(x0, FY, B.HW, B.FH);
      ctx.globalAlpha = 0.07; ctx.fillStyle = col; ctx.fillRect(x0, FY, B.HW, B.FH); ctx.globalAlpha = 1;
      for (let s = 0; s < 36; s++) {
        const sp = 20 + (s % 3) * 35, yy = FY + ((s * 47 + t * sp) % B.FH), xx = x0 + (s * 89) % B.HW;
        ctx.fillStyle = s % 3 === 2 ? 'rgba(255,255,255,0.8)' : 'rgba(180,170,255,0.45)'; ctx.fillRect(xx, yy, s % 3 === 2 ? 2 : 1.5, s % 3 === 2 ? 3 : 1.5);
      }
      ctx.save(); ctx.translate(bx, by); ctx.rotate((i ? -t : t) * 0.5); ctx.strokeStyle = 'rgba(255,90,170,0.28)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 70, 0, 7); ctx.stroke();
      for (let k = 0; k < 2; k++) { ctx.beginPath(); for (let j = 0; j <= 3; j++) { const a = k * Math.PI / 3 + j * Math.PI * 2 / 3; ctx.lineTo(Math.cos(a) * 58, Math.sin(a) * 58); } ctx.stroke(); }
      ctx.restore();
      drawBoss(view, bx, by, t, X.flash, X.mouth);
      drawShip(view, W, FX + g.p[i].x, FY + g.p[i].y, slots[i], g.p[i], t, X, i, cs);
      // les balles : une lueur additive, puis le corps et le cœur blanc
      ctx.globalCompositeOperation = 'lighter';
      for (let q = 0; q < b.length; q += ST) {
        if (b[q + 6] !== i) continue;
        const k = b[q + 4], r = B.KR[k];
        ctx.fillStyle = BC[b[q + 5]]; ctx.globalAlpha = k === 2 ? 0.3 : 0.18;
        ctx.beginPath(); ctx.arc(FX + b[q], FY + b[q + 1], r * 2.4 + 2, 0, 7); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      for (let q = 0; q < b.length; q += ST) {
        if (b[q + 6] !== i) continue;
        const x = FX + b[q], y = FY + b[q + 1], k = b[q + 4], c = BC[b[q + 5]];
        if (k === 1) {
          const a = Math.atan2(b[q + 3], b[q + 2]);
          ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, 5.5, 3, a, 0, 7); ctx.fill();
          ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(x, y, 3.2, 1.4, a, 0, 7); ctx.fill();
        } else if (k === 3) {
          ctx.fillStyle = c; star(ctx, x, y, 6, t * 5 + q);
          ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, 1.8, 0, 7); ctx.fill();
        } else if (k === 4) {
          const blink = b[q + 10] < 18 && Math.floor(t * 20) % 2;
          ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.arc(x, y, 9.5, 0, 7); ctx.fill();
          ctx.fillStyle = blink ? '#ffffff' : '#ff8a20'; ctx.beginPath(); ctx.ellipse(x, y, 8.5, 7.5, 0, 0, 7); ctx.fill();
          ctx.fillStyle = '#3a8a2a'; ctx.fillRect(x - 1, y - 10, 2, 4);
          ctx.fillStyle = '#ffe24a'; ctx.fillRect(x - 5, y - 3, 3, 3); ctx.fillRect(x + 2, y - 3, 3, 3); ctx.fillRect(x - 4, y + 2, 8, 2);
        } else {
          const r = k === 2 ? 7.5 : 4.4;
          ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
          ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, r * 0.52, 0, 7); ctx.fill();
        }
      }
      drawHitbox(ctx, FX + g.p[i].x, FY + g.p[i].y, col);
      ctx.restore();
      view.hint(W, M, i, x0 + B.HW / 2, FY + B.FH - 14, [['dirs', 'esquiver']]); // (sous son pilote : comment bouger)
      ctx.strokeStyle = '#0b0610'; ctx.lineWidth = 4; ctx.strokeRect(x0 - 1, FY - 1, B.HW + 2, B.FH + 2);
      ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.strokeRect(x0 + 1, FY + 1, B.HW - 2, B.FH - 2);
    }
    // la carte de sort en cours, au milieu
    if (g.ph >= 0) {
      X.spell.t += dt;
      const sp = SPELLS[g.ph], big = X.spell.t < 1.3;
      if (big) {
        const a = Math.min(1, (1.3 - X.spell.t) / 0.3, X.spell.t / 0.15);
        ctx.save(); ctx.globalAlpha = 0.8 * a; ctx.fillStyle = 'rgba(40,0,40,0.9)'; ctx.fillRect(170, FY + 120, 300, 46); ctx.restore();
        view.text(sp[0], 320, FY + 132, 11, '#ffb0d8', { mono: true, alpha: a });
        view.text(sp[1], 320, FY + 152, 18, '#ffffff', { alpha: a });
      }
    }
    // l'en-tête : qui est qui, ses touches reçues
    const lead = g.p[0].hits === g.p[1].hits ? -1 : g.p[0].hits < g.p[1].hits ? 0 : 1;
    for (let i = 0; i < 2; i++) {
      const P = g.p[i], right = i === 1, x = right ? 640 - FX : FX, al = right ? 'right' : 'left', sd = right ? -1 : 1;
      const w = view.who(W, M, i, x, 6, { align: al });
      const hx = x + sd * (w + 10);
      view.text(`TOUCHÉ ${P.hits}` + (lead === i ? ' 👑' : ''), hx, 19, 13, P.hits ? '#ff7a7a' : '#a8ffb0', { align: al, mono: true });
    }
    view.timer(M, 320, 20);
  },

  onEvent(view, ev, W, M) {
    if (!M || M.kind !== 'bullet' || !M.g || !M.g.p) return;
    if (!ev.type.startsWith('mgBullet') && ev.type !== 'mgGo') return;
    const A = view.audio, X = xs(view), g = M.g;
    const i = ev.p, P = i === 0 || i === 1 ? g.p[i] : null, px = P ? FX + P.x : 320, py = P ? FY + P.y : 180, pan = P ? (P.x / B.FW - 0.5) : 0;
    const slot = i === 0 ? M.a : M.v;
    switch (ev.type) {
      case 'mgGo':
        view.sticker('ESQUIVEZ ! 🎃', 320, 190, { size: 30, color: '#ffffff', bg: '#ff3a8a', life: 0.9 });
        if (A) A.say('Esquivez tout !', 0.5, 1.2);
        break;
      case 'mgBulletSpell':
        X.spell = { n: ev.n, t: 0 }; X.mouth = 1; X.flash = 0.3;
        view.sticker(ev.n === 3 ? 'DERNIER SORT !' : 'CARTE DE SORT !', 320, 170, { size: ev.n === 3 ? 30 : 24, color: '#ffffff', bg: ev.n === 3 ? '#d01040' : '#7a2ad0', life: 0.9 });
        view.jolt(0.5 + ev.n * 0.15, 0.05, '#ff5aa8', 0.25); view.lines(0.4); view.hype(0.3 + ev.n * 0.15);
        for (let k = 0; k < 2; k++) view.burst(FX + (k ? B.FW - g.bx : g.bx), FY + g.by, 18, BC, { shape: 'star', speed: 200, size: 5, life: 0.7 });
        if (A) { A.sfx('charge', 0, 0.6); A.sfx(ev.n === 3 ? 'thunder' : 'zapL', 0, 0.6); if (ev.n) A.say(ev.n === 3 ? 'Dernier sort !' : 'Carte de sort !', 0.45, 1.1); }
        break;
      case 'mgBulletWave':
        X.mouth = Math.max(X.mouth, 0.6);
        if (A) A.sfx(['zapS', 'whip', 'pop', 'throw'][ev.k] || 'zapS', (g.bx / B.FW - 0.5), ev.k === 0 ? 0.25 : 0.3, 1 + (g.ph || 0));
        break;
      case 'mgBulletBurst':
        if (A) A.sfx('pop', (ev.x / B.FW - 0.5), 0.45, 2);
        view.burst(FX + ev.x, FY + ev.y, 12, ['#ff8a20', '#ffe24a', '#3a8a2a'], { speed: 120, size: 4, life: 0.5 });
        break;
      case 'mgBulletHit':
        X.hurt[i] = 1; X.react[i] = { k: ev.n >= 3 ? 'sob' : 'hit', t: ev.n >= 3 ? 1.6 : ev.n === 2 ? 1.5 : 0.8 };
        if (A) { A.sfx('hitL', pan, 0.8); A.sfx('glass', pan, 0.5); A.sfx('error', pan, 0.4); if (view.time - (X.sayT || 0) > 1.5) { X.sayT = view.time; A.say(view.pick(OUCH), 0.6, 1.25); } }
        view.sticker('TOUCHÉ !', px, py - 34, { size: 16, color: '#ffffff', bg: '#d01030', life: 0.8 });
        view.burst(px, py, 28, [COLORS[slot], '#ffffff', '#ff3a3a'], { speed: 240, size: 5, life: 0.7 });
        view.burst(px, py, 4, ['#fff'], { shape: 'txt', ch: view.pick(['💥', '😵', '💫']), speed: 120, size: 9, life: 0.8 });
        view.jolt(0.8, 0.05, '#ff2020', 0.3);
        if (ev.n === 3) view.sticker('PASSOIRE 🧀', 320, 140, { size: 20, color: '#0b0610', bg: '#ffe24a', life: 1 });
        break;
      default: break;
    }
  },
};
