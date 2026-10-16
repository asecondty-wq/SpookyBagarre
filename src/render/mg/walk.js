// Promenade de Reyji (walk), l'affichage : deux trottoirs côte à côte (J1 à gauche, J2 à droite), la ville qui défile ;
// le vrai perso du joueur promène le vrai Reyji en 3D au bout d'une laisse à sa couleur. Les passants (dessinés, de
// grosses chaussures) arrivent en face ; quand Reyji va se jeter sur une chaussure : un énorme « ! » au-dessus de lui,
// la chaussure qui clignote dans un cercle, « TIRE ! ». Bien tiré : la laisse claque, Reyji revient en sautillant
// (cœurs) ; raté : il croque la chaussure, le passant sautille en chaussette, furieux.
import { WALK } from '../../sim/mg/walk.js';
import { COLORS } from '../../sim/constants.js';

const GY = 272, OWN_X = 58, REY_X = 160, SHOE_DX = 46;
const SHOE = [
  { n: 'BASKETS', c: '#e83a3a', s: '#ffffff' }, { n: 'MOCASSINS', c: '#7a4a22', s: '#3a2210' }, { n: 'TALONS', c: '#d02a8a', s: '#5a0a3a' },
  { n: 'CROCS', c: '#ffd23a', s: '#c89a10' }, { n: 'TONGS', c: '#3ac8e8', s: '#1a7a9a' }, { n: 'BOTTES', c: '#2a2a3a', s: '#5a5a6a' },
];
const COAT = ['#5a7ad0', '#c86a3a', '#6ab04a', '#a04ab0', '#d0a03a', '#4a5a6a'];
const OUCH = ['MES BASKETS !!', 'MES MOCASSINS !', 'MES TALONS 😭', 'MES CROCS !!', 'MA TONG !', 'MA BOTTE !'];
const GOOD = ['BON CHIEN 🐶', 'SAUVÉ !', 'PAS LA CHAUSSURE !', 'REYJI NON !', 'PROPRE !'];

export default {
  title: 'PROMENADE DE REYJI', color: '#ffb03a', icon: '🐕',
  puppets: ['shiba'],
  goal: 'Quand Reyji fait « ! », tire la laisse avant qu\'il croque la chaussure !',
  keys: [['A', 'tirer la laisse (au « ! »)']],
  ach: [
    ['Maître du leash', 'Ami des passants', 'Dresseur certifié', 'Les chaussures sont sauves'],
    ['Reyji a dîné', 'Fétichiste des pieds (par procuration)', 'Facture de baskets', 'Laisse en mousse'],
  ],
  news: (L, d) => `REYJI DÉVORE UNE PAIRE DE CROCS : SON MAÎTRE ${L} CONDAMNÉ À REMBOURSER (+${d} %)`,

  warm(view) {
    for (let i = 0; i < 2; i++) view.puppet('shiba', -9999, -9999, 10, { key: 'rey' + i, shadow: false });
  },

  draw(view, W, M, dt) {
    const ctx = view.g, g = M.g, t = view.time, xs = view.xs, B = 360 + view.oy;
    if (!xs.on) Object.assign(xs, { on: 1, pull: [0, 0], munch: [0, 0], yank: [0, 0], shake: [0, 0], shown: [0, 0], own: [null, null] });
    const L = -view.ox, Rr = 640 + view.ox, T = -view.oy;
    ctx.fillStyle = '#0b0610'; ctx.fillRect(L, T, Rr - L, B - T);
    for (let i = 0; i < 2; i++) {
      const P = g.p[i], slot = i === 0 ? M.a : M.v, col = COLORS[slot], x0 = i === 0 ? L : 322, x1 = i === 0 ? 318 : Rr, ox = i * 320;
      for (const k of ['pull', 'munch', 'yank', 'shake']) xs[k][i] = Math.max(0, xs[k][i] - dt * (k === 'munch' ? 1 : 2.5));
      ctx.save(); ctx.beginPath(); ctx.rect(x0, 50, x1 - x0, B - 50); ctx.clip();
      street(view, ox, x0, x1, M, t, B);
      const e = g.ev[P.cur], open = e && M.ph === 'play' && M.t >= e.t && M.t < e.t + e.w, soon = e && M.ph === 'play' && M.t >= e.t - 14 && !open;
      const rx = ox + REY_X;
      // les passants (derrière Reyji)
      for (let n = 0; n < g.ev.length; n++) {
        const v = g.ev[n], dt0 = v.t - M.t;
        if (dt0 > 120) break;
        const res = P.res[n], rt = P.rt[n];
        // il arrive, s'arrête devant Reyji le temps de la fenêtre, puis repart (croqué : en sautillant, furieux)
        let x, angry = 0, walking = 1;
        if (dt0 > 0) x = rx + SHOE_DX + dt0 * v.sp;
        else {
          const end = res ? rt : M.t;
          x = rx + SHOE_DX - (Math.min(M.t, end) - v.t) * 0.3;
          if (!res) walking = 0;
          else {
            const since = M.t - end;
            x -= since * v.sp * (res === 2 ? 1 : 1.3);
            if (res === 2 && since < 45) { angry = 1; walking = 0; }
          }
        }
        if (x < ox - 60 || x > ox + 380) continue;
        const hl = n === P.cur && open;
        passer(view, x, GY + 4, v.k, M.t / 60 * v.sp * 2.2 + n, walking, angry, hl, res === 2, t);
      }
      // la laisse, le maître, Reyji
      const pull = xs.pull[i], lunge = open ? Math.min(1, (M.t - e.t) / 6) : soon ? 0.25 : 0;
      const rdx = lunge * 20 - Math.sin(Math.min(1, pull) * Math.PI) * 26 + (xs.munch[i] > 0.4 ? 16 : 0);
      const ry = GY + 2, hop = pull > 0 ? Math.abs(Math.sin(pull * Math.PI * 2)) * 14 : 0;
      let cmd = '', speed = 1.4;
      if (xs.munch[i] > 0.3) { cmd = 'bite'; speed = 0; }
      else if (open) { cmd = 'dash'; speed = 3; }
      else if (pull > 0.2) { cmd = 'jump'; }
      else if (soon) cmd = 'bark';
      const own = xs.own[i], ot = own ? t - own.t0 : 9;
      let po;
      if (M.ph === 'outro') po = P.score >= g.p[1 - i].score ? { emote: 'win' } : { emote: 'sob' };
      else if (own && ot < own.life) po = own.e === 'hit' ? (ot < 0.3 ? { state: 'hitstun', kb: 120 } : { emote: 'angry_01' }) : { emote: own.e, emoteSpeed: 1.2 };
      else po = { state: 'walk' };
      const hx = ox + OWN_X + 18, hy = GY - 52 + (open ? 4 : 0);
      if (view.pupOn(M)) view.player(W, M, i, ox + OWN_X - (open ? -6 : 0), GY + 4, 104, { ...po, face: 1.25, head: 1.55 });
      // la laisse : tendue quand il tire, molle sinon
      const cx = rx + rdx - 6, cy = ry - 30 - hop;
      ctx.strokeStyle = '#0b0610'; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.moveTo(hx, hy);
      const sag = open || pull > 0 ? 0 : 16 + Math.sin(t * 6) * 3;
      ctx.quadraticCurveTo((hx + cx) / 2, (hy + cy) / 2 + sag, cx, cy); ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo((hx + cx) / 2, (hy + cy) / 2 + sag, cx, cy); ctx.stroke();
      if (pull > 0.5) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(cx - 10 - k * 6, cy - 12 + k * 6); ctx.lineTo(cx - 20 - k * 6, cy - 16 + k * 6); ctx.stroke(); } }
      ctx.save(); ctx.globalAlpha = 0.28; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(rx + rdx, GY + 4, 30, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      if (view.pupOn(M) && !view.puppet('shiba', rx + rdx, ry + (xs.shake[i] ? (Math.random() - 0.5) * 3 : 0), 62, { key: 'rey' + i, cmd, speed, face: 'right', hop: hop / 40, shadow: false })) {
        ctx.fillStyle = '#e08a34'; ctx.beginPath(); ctx.ellipse(rx + rdx, ry - 20 - hop, 26, 16, 0, 0, Math.PI * 2); ctx.fill();
      }
      // le « ! » : il va croquer
      if (open || soon) {
        const k = open ? 1 + Math.sin(t * 30) * 0.12 : 0.7, ex = rx + rdx + 4, ey = ry - 92;
        ctx.save(); ctx.translate(ex, ey); ctx.scale(k, k);
        ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.arc(0, 0, 21, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = open ? (Math.sin(t * 40) > 0 ? '#ffe24a' : '#ff3a3a') : '#ffe24a'; ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill();
        view.text('!', 0, 2, 30, '#0b0610', { mono: true, stroke: false });
        ctx.restore();
        if (open) {
          view.text(W.fighters[slot].bot ? 'TIRE !' : `TIRE ! (${view.keyName(M, i, 'A')})`, ex, ey - 36, 22 + Math.sin(t * 25) * 2, Math.sin(t * 20) > 0 ? '#ffffff' : col, { mono: true });
          // ce qui reste de la fenêtre
          const left = 1 - (M.t - e.t) / e.w;
          ctx.fillStyle = '#0b0610'; ctx.fillRect(ex - 26, ey + 26, 52, 7); ctx.fillStyle = left > 0.4 ? '#ffe24a' : '#ff3a3a'; ctx.fillRect(ex - 25, ey + 27, 50 * left, 5);
        }
      }
      view.hint(W, M, i, ox + OWN_X + 52, 98, [['A', 'au « ! » : tirer']]);
      if (P.lock > 0 && M.ph === 'play') view.text('LAISSE BLOQUÉE', ox + OWN_X + 10, GY - 132, 11, '#ff8aa8', { mono: true });
      ctx.restore();
      // le score, en bas ; le cadre à la couleur du joueur
      xs.shown[i] += (P.score - xs.shown[i]) * Math.min(1, dt * 10);
      const sx = i ? 630 : 10, al = i ? 'right' : 'left';
      view.text(`${view.pname(slot)} · ${Math.round(xs.shown[i])}`, sx, 318, 18, col, { align: al, mono: true });
      view.text(`🐕 ${P.ok} sauvées   👟 ${P.miss} croquées`, sx, 338, 10, '#ffffff', { align: al, mono: true });
      if (P.streak >= 3) view.text(`🔥 x${P.streak}`, i ? 340 : 300, 318, 13, '#ffd23a', { align: i ? 'left' : 'right', mono: true });
      ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.strokeRect(x0 + 1, 51, x1 - x0 - 2, B - 50);
    }
    view.text('🐕 PROMENADE DE REYJI', 320, 16, 15, '#ffb03a', { title: true });
    view.timer(M, 320, 38);
  },

  onEvent(view, ev, W, M) {
    const A = view.audio, xs = view.xs, g = M && M.g;
    if (!g || !ev.type.startsWith('mgWalk') || !xs.on) return;
    const i = ev.p, slot = i === 0 ? M.a : M.v, pan = i ? 0.4 : -0.4, rx = i * 320 + REY_X;
    const own = (e, life) => { xs.own[i] = { e, t0: view.time, life }; };
    switch (ev.type) {
      case 'mgWalkTug':
        xs.pull[i] = 1; own(ev.st >= 3 ? 'victory_celebration' : 'cheer', 0.9);
        view.sticker(ev.f < 8 ? 'RÉFLEXE DE FOU ⚡' : view.pick(GOOD), rx, 120, { size: 15, color: '#0b0610', bg: '#ffe24a', life: 0.75 });
        view.burst(rx, GY - 40, 14, ['#ff5a8a', '#ffffff', '#ffd23a'], { shape: 'txt', ch: '♥', speed: 170, size: 8, up: 110, life: 0.8 });
        view.burst(rx - 20, GY - 40, 10, ['#ffffff', COLORS[slot]], { shape: 'star', speed: 200, size: 5, life: 0.4 });
        view.floats.push({ text: `+${ev.pts}`, x: rx + 40, y: GY - 120, t: 0, life: 0.8, color: COLORS[slot], size: 18 });
        if (ev.st === 3 || ev.st === 6) { view.sticker(ev.st === 3 ? 'SÉRIE x3 🔥' : 'DRESSEUR LÉGENDAIRE 👑', i * 320 + 160, 160, { size: 15, color: '#ffffff', bg: '#ff3a3a', life: 0.9 }); view.hype(0.5); }
        view.jolt(0.3, 0.03);
        if (A) { A.sfx('whip', pan, 0.7); A.sfx('bark', pan, 0.5, 2); A.sfx('heart', pan, 0.4, 1 + Math.min(5, ev.st)); if (ev.st >= 3) A.sfx('cash', pan, 0.4); if (Math.random() < 0.4) A.say(view.pick(['Non Reyji !', 'Bon chien !', 'Lâche ça !']), 0.6, 1.3); }
        break;
      case 'mgWalkMunch':
        xs.munch[i] = 1; xs.shake[i] = 1; own('hit', 1.2);
        view.sticker(OUCH[ev.k], rx + 50, GY - 12, { size: 15, color: '#ffffff', bg: '#c01020', life: 0.9 });
        view.sticker('CROC 🦷', rx + 20, GY - 70, { size: 14, color: '#0b0610', bg: '#ffffff', life: 0.6, rot: -0.2 });
        view.burst(rx + SHOE_DX, GY - 6, 16, [SHOE[ev.k].c, SHOE[ev.k].s, '#ffffff'], { shape: 'sq', speed: 200, size: 4, life: 0.6, up: 120 });
        view.burst(rx + SHOE_DX, GY - 30, 3, ['#fff'], { shape: 'txt', ch: view.pick(['💢', '🦷', '😡']), speed: 120, size: 11, up: 80, life: 0.9 });
        view.floats.push({ text: `-${WALK.MISS}`, x: rx + 40, y: GY - 120, t: 0, life: 0.8, color: '#ff4040', size: 18 });
        view.jolt(0.55, 0.04, '#ff2020', 0.2);
        if (A) { A.sfx('stab', pan, 0.6); A.sfx('bark', pan, 0.6, 0); A.sfx('yowl', pan, 0.4); if (Math.random() < 0.6) A.say(view.pick(['Mes chaussures !', 'Aïe ! Ton chien !', 'Mais tiens ton chien !']), 0.4, 1.35); }
        break;
      case 'mgWalkYank':
        xs.yank[i] = 1; xs.shake[i] = 0.6;
        view.sticker(view.pick(['POUR RIEN ?!', 'IL A RIEN FAIT 🥺', 'TROP TÔT !']), rx, 130, { size: 13, color: '#ffffff', bg: '#7a3a8a', life: 0.6 });
        view.floats.push({ text: `-${WALK.YANK}`, x: rx, y: GY - 110, t: 0, life: 0.7, color: '#ff8aa8', size: 14 });
        if (A) { A.sfx('whip', pan, 0.4); A.sfx('error', pan, 0.3); A.sfx('yowl', pan, 0.2, 3); }
        break;
      default: break;
    }
  },
};

// la rue (un côté de l'écran) : le ciel du soir, les immeubles qui défilent, le trottoir, le caniveau
function street(view, ox, x0, x1, M, t, B) {
  const ctx = view.g, scroll = (M.t || 0) * 1.4 + (M.ph === 'outro' ? 0 : 0);
  ctx.fillStyle = '#ffb88a'; ctx.fillRect(x0, 50, x1 - x0, 120);
  ctx.fillStyle = '#ffd0a8'; ctx.fillRect(x0, 50, x1 - x0, 30);
  for (let k = -1; k < 6; k++) {
    const w = 70, bx = ox + k * w - (scroll * 0.5) % w, h = 70 + ((k + Math.floor(scroll * 0.5 / w)) * 37 % 3) * 22;
    ctx.fillStyle = ['#6a4a6a', '#5a5a7a', '#7a5a5a'][((k + Math.floor(scroll * 0.5 / w)) % 3 + 3) % 3]; ctx.fillRect(bx, 210 - h, w - 4, h);
    ctx.fillStyle = '#ffe8a0'; for (let wy = 0; wy < 3; wy++) for (let wx = 0; wx < 3; wx++) if ((wx + wy + k) % 3) ctx.fillRect(bx + 8 + wx * 20, 210 - h + 10 + wy * 22, 10, 12);
  }
  ctx.fillStyle = '#9a9aa8'; ctx.fillRect(x0, 210, x1 - x0, GY - 210 + 10);
  ctx.fillStyle = '#8a8a98'; for (let k = -1; k < 10; k++) { const bx = ox + k * 40 - scroll % 40; ctx.fillRect(bx, 210, 2, GY - 200); }
  ctx.fillStyle = '#5a5a66'; ctx.fillRect(x0, GY + 10, x1 - x0, 8);
  ctx.fillStyle = '#3a3a44'; ctx.fillRect(x0, GY + 18, x1 - x0, B - GY - 18);
  ctx.fillStyle = '#e8e8e8'; for (let k = -1; k < 8; k++) { const bx = ox + k * 60 - (scroll * 1.6) % 60; ctx.fillRect(bx, GY + 40, 30, 4); }
  // un lampadaire de temps en temps
  const lx = ox + 300 - (scroll % 400);
  ctx.fillStyle = '#2a2a34'; ctx.fillRect(lx, 100, 5, GY - 90); ctx.fillRect(lx - 12, 100, 20, 5);
  ctx.fillStyle = 'rgba(255,240,160,0.8)'; ctx.fillRect(lx - 12, 105, 12, 4);
}

// un passant de profil qui marche vers la gauche : ses jambes, sa grosse chaussure (k : le modèle), son manteau, sa
// tête ; hl : la chaussure visée (elle clignote dans un cercle) ; angry : il sautille en chaussette ; bare : un pied nu
function passer(view, x, y, k, ph, walking, angry, hl, bare, t) {
  const ctx = view.g, O = '#0b0610', S = SHOE[k], hop = angry ? Math.abs(Math.sin(t * 14)) * 10 : 0;
  ctx.save(); ctx.translate(x, y - hop);
  const sw = walking ? Math.sin(ph) * 9 : 0;
  // les jambes
  for (const [d, front] of [[-sw, 0], [sw, 1]]) {
    const fx = d - (front ? 0 : 4), lift = angry && front ? -12 : 0;
    ctx.fillStyle = O; ctx.fillRect(fx - 5, -64, 10, 58 + lift);
    ctx.fillStyle = ['#3a4a7a', '#4a3a2a', '#2a2a2a', '#6a6a3a', '#7a3a3a', '#3a5a3a'][k]; ctx.fillRect(fx - 3.5, -63, 7, 56 + lift);
    const shoe = !(bare && front);
    if (shoe) { ctx.fillStyle = O; roundRect(ctx, fx - 13, -10 + lift, 22, 11, 4); ctx.fill(); ctx.fillStyle = S.c; roundRect(ctx, fx - 11.5, -8.5 + lift, 19, 8, 3); ctx.fill(); ctx.fillStyle = S.s; ctx.fillRect(fx - 11.5, -2.5 + lift, 19, 2); }
    else { ctx.fillStyle = '#f4f4f8'; roundRect(ctx, fx - 10, -9 + lift, 16, 9, 4); ctx.fill(); ctx.fillStyle = '#d0d0d8'; ctx.fillRect(fx - 9, -4 + lift, 3, 3); }
    if (hl && front) {
      const p = 1 + Math.sin(t * 30) * 0.15;
      ctx.strokeStyle = Math.sin(t * 40) > 0 ? '#ffe24a' : '#ff3a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(fx - 2, -5, 18 * p, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,240,120,0.3)'; ctx.beginPath(); ctx.arc(fx - 2, -5, 18 * p, 0, Math.PI * 2); ctx.fill();
    }
  }
  // le manteau, les bras, la tête
  ctx.fillStyle = O; roundRect(ctx, -15, -118, 30, 60, 8); ctx.fill();
  ctx.fillStyle = COAT[k]; roundRect(ctx, -13, -116, 26, 56, 7); ctx.fill();
  ctx.fillStyle = O; ctx.save(); ctx.translate(0, -108); ctx.rotate(angry ? -2.4 + Math.sin(t * 20) * 0.3 : -sw * 0.03); ctx.fillRect(-4, 0, 8, 40); ctx.restore();
  ctx.fillStyle = O; ctx.beginPath(); ctx.arc(-2, -132, 15, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ['#f0c8a0', '#c89060', '#8a5a3a', '#f4d0b0', '#d8a878', '#a87048'][(k + 2) % 6]; ctx.beginPath(); ctx.arc(-2, -132, 13, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = O; ctx.beginPath(); ctx.arc(-9, -134, 2, 0, Math.PI * 2); ctx.fill();
  if (angry) { ctx.strokeStyle = O; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-13, -126); ctx.lineTo(-5, -124); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-13, -140); ctx.lineTo(-5, -137); ctx.stroke(); }
  else { ctx.fillStyle = O; ctx.fillRect(-12, -125, 6, 2); }
  ctx.fillStyle = ['#2a1a10', '#d0a040', '#1a1a1a', '#8a2a2a', '#4a3020', '#c8c8d0'][k]; ctx.beginPath(); ctx.arc(0, -138, 13, Math.PI * 0.95, Math.PI * 2.1); ctx.fill();
  ctx.restore();
  if (angry) view.text('💢', x + 10, y - 150 - hop, 14, '#fff', { stroke: false });
}

function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
