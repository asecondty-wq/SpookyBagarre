// Frisbee de l'au-delà (frisbee), l'affichage : le terrain du cimetière vu de haut et de biais (tombes, citrouilles,
// fantômes qui passent), les deux joueurs en vrais modèles 3D à grosse tête (marionnettes : ils courent, plongent en
// Superman, s'écrasent à plat ventre, tournoient comme des lanceurs de disque), la cible qui balaie le camp d'en face, la
// jauge de lancer au sol autour du lanceur, la trajectoire prévue (effet compris), le frisbee fantôme et son ombre,
// l'anneau de saisie.
import { COLORS } from '../../sim/constants.js';
import { portraitURL } from '../../ui/hud.js';
import { FRIS, frisAt, frisZ, markerY } from '../../sim/mg/frisbee.js';

const SC = 4.4, SCY = 3.6, FX = 100, FY = 118; // le terrain écrasé en hauteur : vu de biais, les joueurs debout dessus
const PH = 68, BIG = 1.8; // la taille des joueurs (marionnettes), leur grosse tête
const INK = '#0b0610';
const px = (x) => FX + x * SC, py = (y) => FY + y * SCY;
const imgs = {};
function img(char) {
  if (!imgs[char]) { const im = new Image(); im.src = portraitURL(char); imgs[char] = im; }
  return imgs[char];
}
function S(view) {
  const X = view.xs;
  if (!X.ok) { X.ok = 1; X.yaw = [1.2, -1.2]; X.re = [null, null]; X.bump = [0, 0]; X.trail = []; X.marks = []; X.pop = [0, 0]; X.spin = 0; X.lastS = -1; X.flash = [0, 0]; X.ghosts = [0, 1, 2].map((k) => ({ x: Math.random() * 640, y: 60 + k * 110, s: 10 + Math.random() * 20 })); }
  return X;
}

// une tête ronde (le portrait découpé), avec l'anneau du joueur
function head(view, char, x, y, r, col, a = 1) {
  const ctx = view.g, im = img(char);
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x, y, r + 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r + 1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#efe4d4'; ctx.beginPath(); ctx.arc(x, y, r - 1, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r - 1, 0, Math.PI * 2); ctx.clip();
  if (im.complete && im.naturalWidth) { const s = r * 4.1; ctx.drawImage(im, x - s * 0.5, y - s * 0.36, s, s); }
  ctx.restore();
}

// le frisbee fantôme (vu un peu de biais), qui tourne
function disc(ctx, x, y, r, spin, glow = 1) {
  ctx.save(); ctx.translate(x, y);
  if (glow > 0) { const g = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 2.6); g.addColorStop(0, `rgba(140,255,230,${0.45 * glow})`); g.addColorStop(1, 'rgba(140,255,230,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 2.6, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(0, 0, r + 2, r * 0.62 + 2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#7affd8'; ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.62, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d8fff4'; ctx.beginPath(); ctx.ellipse(0, -r * 0.08, r * 0.62, r * 0.36, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#2a9a8a'; ctx.lineWidth = 1.5;
  for (let k = 0; k < 3; k++) { const a = spin + k * 2.094; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.18); ctx.lineTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.55); ctx.stroke(); }
  ctx.fillStyle = INK; ctx.fillRect(-r * 0.25, -r * 0.18, r * 0.12, r * 0.14); ctx.fillRect(r * 0.13, -r * 0.18, r * 0.12, r * 0.14); // les yeux du fantôme
  ctx.restore();
}

// un joueur vu de dessus : l'ombre, le maillot, les mains (tendues quand il saisit), la tête
function drawPlayer(view, W, M, g, i, t) {
  const ctx = view.g, P = g.P[i], slot = i === 0 ? M.a : M.v, col = COLORS[slot], x = px(P.x), y = py(P.y);
  const face = i === 0 ? 1 : -1;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x, y + 12, 16, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.translate(x, y);
  if (P.dv > 0 || P.lie > 0) {
    // plongeon / à plat ventre : le corps allongé dans le sens du plongeon
    const a = Math.atan2(P.dy, P.dx);
    ctx.rotate(a);
    ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(-6, 0, 20, 11, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(-6, 0, 18, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2c9a0'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(22, s * 6, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    ctx.restore();
    head(view, W.fighters[slot].char, x + Math.cos(a) * 8, y + Math.sin(a) * 8, 11, col);
    if (P.lie > 0) view.text(P.lie % 20 < 10 ? '💫' : '😵', x, y - 22, 12, '#fff', { stroke: false });
    return;
  }
  const bob = Math.abs(Math.sin(t * 14)) * Math.min(1, DMathLike(P.vx, P.vy) / 20) * 3;
  ctx.translate(0, -bob);
  ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(0, 4, 15, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, 4, 13, 10, 0, 0, Math.PI * 2); ctx.fill();
  // les mains : tendues vers l'avant pendant une saisie, le frisbee dedans s'il l'a
  const reach = P.grab > 0 ? 1 : 0, hx = face * (reach ? 20 : 12), sp = reach ? 9 : 13;
  ctx.fillStyle = '#f2c9a0'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(hx, 6 + s * sp * 0.6, reach ? 5 : 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  if (g.hold === i) disc(ctx, hx + face * 4, 6, 8, t * 3, 0.6);
  ctx.restore();
  head(view, W.fighters[slot].char, x, y - 6 - bob, 13, col);
}
const DMathLike = (a, b) => Math.sqrt(a * a + b * b);

// --- les joueurs en vrais modèles 3D (marionnettes) : le regard suit la course (0 = de face, vers la caméra)
const yawOf = (dx, dy) => Math.atan2(dx * SC, dy * SCY);
const wrapA = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
function drawPlayer3D(view, W, M, g, i, t, X, dt) {
  const ctx = view.g, P = g.P[i], slot = i === 0 ? M.a : M.v, char = W.fighters[slot].char, x = px(P.x), y = py(P.y);
  const sp = DMathLike(P.vx, P.vy), thrower = g.ph === 'aim' && g.th === i, re = X.re[i], ra = re ? t - re.t : 99;
  // où il regarde : là où il court, là où il plonge, le frisbee qui arrive, ou l'autre
  let tgt;
  if (P.dv > 0 || P.lie > 0) tgt = yawOf(P.dx, P.dy);
  else if (sp > 4) tgt = yawOf(P.vx, P.vy);
  else if (g.ph === 'fly' && g.fr && 1 - g.th === i) { const b = frisAt(g.fr, g.fr.s); tgt = yawOf(b[0] - P.x, b[1] - P.y); }
  else if (thrower) tgt = i === 0 ? 1.2 : -1.2;
  else { const O = g.P[1 - i]; tgt = yawOf(O.x - P.x, O.y - P.y); }
  X.yaw[i] = wrapA(X.yaw[i] + wrapA(tgt - X.yaw[i]) * Math.min(1, dt * (P.dv > 0 ? 30 : 12)));
  let yaw = X.yaw[i], lift = 0, rot = 0, sq = [1, 1];
  const o = { head: BIG, key: `fris${i}`, shadow: false };
  if (P.dv > 0) {
    // le plongeon : à l'horizontale (Superman), un peu en l'air
    const k = 1 - P.dv / FRIS.DIVE_T;
    o.state = 'air'; o.vy = 2 - k * 4; lift = 4 + Math.sin(k * Math.PI) * 14;
    rot = Math.max(-1, Math.min(1, P.dx * 1.4)) * 1.3; sq = [1.12, 0.9];
  } else if (P.lie > 0) {
    o.state = 'down';
    if (P.lie > FRIS.LIE - 6) sq = [1.25, 0.8]; // l'écrasement à l'atterrissage
  } else if (thrower && P.hold >= 0) {
    // il charge : accroupi, il tremble de plus en plus
    o.state = 'crouch';
    const q = Math.min(1, P.hold / FRIS.HOLD_MAX);
    rot = (Math.random() - 0.5) * q * 0.12; sq = [1 + q * 0.12, 1 - q * 0.1];
  } else if (sp > 18) o.state = 'run';
  else if (sp > 4) o.state = 'walk';
  // les réactions : la toupie du lanceur de disque, la provocation après une prise, sonné après un raté
  if (re && re.k === 'spin' && ra < 0.5) { yaw += (i === 0 ? 1 : -1) * Math.PI * 2 * (1 - (1 - ra / 0.5) ** 2); lift += Math.sin(ra / 0.5 * Math.PI) * 6; }
  if (re && re.k === 'catch' && ra < 1.3 && sp < 6 && !(thrower && P.hold >= 0) && P.lie <= 0 && P.dv <= 0) o.emote = 'select';
  if (re && re.k === 'sad' && ra < 1.4 && sp < 6 && P.lie <= 0 && P.dv <= 0) o.state = 'dizzy';
  X.bump[i] = Math.max(0, X.bump[i] - dt * 3);
  if (X.bump[i] > 0) { const b = X.bump[i]; sq = [sq[0] * (1 + 0.35 * b * Math.cos((1 - b) * 14)), sq[1] * (1 - 0.3 * b * Math.cos((1 - b) * 14))]; }
  o.face = yaw + 0.34 * Math.max(0, Math.cos(yaw));
  o.rot = rot; o.squash = sq;
  // l'ombre au sol (plus petite quand il décolle)
  const sh = 1 - Math.min(0.5, lift / 40);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x, y, (P.dv > 0 || P.lie > 0 ? 22 : 15) * sh, 5.5 * sh, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = COLORS[slot]; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y, 17, 6.5, 0, 0, Math.PI * 2); ctx.stroke(); // l'anneau du joueur
  if (!view.puppet(char, x, y - lift, PH, o)) return false;
  // le frisbee dans les mains
  if (g.hold === i && P.lie <= 0) { const sd = Math.sin(yaw) >= 0 ? 1 : -1; disc(ctx, x + sd * 13, y - lift - PH * 0.5, 8, t * 3, 0.6); }
  if (P.lie > 0) view.text(P.lie % 20 < 10 ? '💫' : '😵', x, y - 26, 12, '#fff', { stroke: false });
  return true;
}

// le terrain du cimetière
function drawField(view, X, t) {
  const ctx = view.g, L = -view.ox, Rr = 640 + view.ox, T = -view.oy, B = 360 + view.oy;
  const sky = ctx.createLinearGradient(0, T, 0, B); sky.addColorStop(0, '#120a2a'); sky.addColorStop(1, '#1e1030');
  ctx.fillStyle = sky; ctx.fillRect(L, T, Rr - L, B - T);
  ctx.fillStyle = '#20402a'; ctx.fillRect(L, FY - 18, Rr - L, B - FY + 18);
  // l'herbe tondue en bandes
  for (let k = 0; k < 10; k++) { ctx.fillStyle = k % 2 ? '#2f7a3a' : '#368a42'; ctx.fillRect(px(k * 10), py(0), 10 * SC, 60 * SCY); }
  ctx.fillStyle = 'rgba(255,255,255,0.03)'; for (let k = 0; k < 40; k++) ctx.fillRect(px((k * 37) % 100), py((k * 23) % 60), 2, 3);
  // les lignes
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2.5; ctx.strokeRect(px(0), py(0), 100 * SC, 60 * SCY);
  ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.moveTo(px(50), py(0)); ctx.lineTo(px(50), py(60)); ctx.stroke(); ctx.setLineDash([]);
  ctx.beginPath(); ctx.ellipse(px(50), py(30), 9 * SC, 9 * SCY, 0, 0, Math.PI * 2); ctx.stroke();
  // les tombes et les citrouilles autour
  const tombs = [[-14, 6], [-16, 30], [-13, 52], [114, 10], [116, 34], [113, 54], [22, -4], [74, -4], [40, 64.5], [86, 64.5]];
  tombs.forEach(([tx, ty], k) => {
    const x = px(tx), y = py(ty);
    if (k % 3 === 2) { ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(x, y, 11, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#ff8a1a'; ctx.beginPath(); ctx.ellipse(x, y, 9, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = Math.sin(t * 6 + k) > -0.6 ? '#ffe24a' : INK; ctx.fillRect(x - 5, y - 2, 3, 3); ctx.fillRect(x + 2, y - 2, 3, 3); ctx.fillRect(x - 4, y + 2, 8, 2); return; }
    ctx.fillStyle = INK; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - 10, y - 14, 20, 24, [9, 9, 2, 2]) : ctx.rect(x - 10, y - 14, 20, 24); ctx.fill();
    ctx.fillStyle = '#8a8aa0'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - 8, y - 12, 16, 21, [7, 7, 1, 1]) : ctx.rect(x - 8, y - 12, 16, 21); ctx.fill();
    ctx.fillStyle = '#5a5a70'; ctx.fillRect(x - 4, y - 6, 8, 2); ctx.fillRect(x - 1, y - 9, 2, 8);
  });
  // des fantômes qui traversent le ciel
  for (const gh of X.ghosts) {
    gh.x += 0.3 + gh.s * 0.02; if (gh.x > Rr + 30) gh.x = L - 30;
    view.text('👻', gh.x, Math.max(T + 50, Math.min(B - 10, gh.y + Math.sin(t * 2 + gh.s) * 6)), gh.s, '#fff', { stroke: false, alpha: 0.18 });
  }
}

export default {
  title: 'FRISBEE DE L\'AU-DELÀ', color: '#7affd8', icon: '🥏',
  goal: 'Lance le frisbee loin de l\'autre, et rattrape le sien !',
  keys: [['A', 'tenir et lâcher = lancer'], ['dirs', 'courir'], ['A', 'attraper'], ['X', 'plonger']],
  tags: false, // (son en-tête dit déjà qui est qui : « J1 · Pandrezz »)
  ach: [['Ultimate Legend', 'Mains de velcro', 'Le chien d\'or'], ['Mains en beurre', 'Ramasse-frisbee', 'Plongeon dans le vide']],
  news: (L, d) => `${L} SE PREND UN FRISBEE DANS LES DENTS (+${d} %) : « JE L'AVAIS ! »`,

  draw(view, W, M, dt) {
    const ctx = view.g, g = M.g, X = S(view), t = view.time, T = -view.oy;
    drawField(view, X, t);
    // en-tête : les deux joueurs, leurs points, le chrono
    view.text('🥏 FRISBEE DE L\'AU-DELÀ', 320, T + 18, 19, '#7affd8', { title: true });
    view.timer(M, 320, T + 46);
    for (let i = 0; i < 2; i++) {
      const slot = i === 0 ? M.a : M.v, P = g.P[i], hx = i === 0 ? 40 : 600, al = i === 0 ? 'left' : 'right', d = i === 0 ? 1 : -1;
      X.pop[i] = Math.max(0, X.pop[i] - dt * 3);
      head(view, W.fighters[slot].char, hx, 36, 18 + X.pop[i] * 6, COLORS[slot]);
      view.text(view.label(W, slot), hx + d * 26, 24, 11, COLORS[slot], { align: al, mono: true });
      view.text(String(P.score), hx + d * 26, 46, 22 + X.pop[i] * 10, '#ffffff', { align: al, mono: true });
      const role = g.ph === 'aim' || g.ph === 'fly' ? (g.th === i ? 'LANCE' : 'ATTRAPE') : '';
      if (role) view.text(role, hx + d * 26 + d * 60, 46, 9, g.th === i ? '#ffd23a' : '#7affd8', { align: al, mono: true });
    }
    // les traces au sol (impacts, sorties)
    X.marks = X.marks.filter((m) => t - m.t < 2.5);
    for (const m of X.marks) {
      const a = 1 - (t - m.t) / 2.5;
      ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = m.out ? '#ff5a5a' : '#ffe24a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(m.x - 7, m.y - 7); ctx.lineTo(m.x + 7, m.y + 7); ctx.moveTo(m.x + 7, m.y - 7); ctx.lineTo(m.x - 7, m.y + 7); ctx.stroke();
      ctx.restore();
    }
    const th = g.th, cat = 1 - th, Tp = g.P[th];
    // l'anneau de saisie du receveur (jaune quand le frisbee est à portée)
    const C = g.P[cat];
    let inReach = false, fb = null;
    if (g.ph === 'fly' && g.fr) {
      fb = frisAt(g.fr, g.fr.s);
      const d = Math.hypot(fb[0] - C.x, fb[1] - C.y);
      inReach = g.fr.s >= FRIS.CATCH_S && d < FRIS.R;
      const near = g.fr.s >= FRIS.CATCH_S - 0.1 && d < FRIS.RD + 6;
      ctx.setLineDash([4, 4]); ctx.strokeStyle = inReach ? '#ffe24a' : near ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)'; ctx.lineWidth = inReach ? 3 : 1.5;
      ctx.beginPath(); ctx.ellipse(px(C.x), py(C.y), FRIS.R * SC, FRIS.R * SCY, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
    // la visée : la cible qui balaie le camp d'en face, la trajectoire prévue, la jauge autour du lanceur
    if (g.ph === 'aim') {
      const dir = th === 0 ? 1 : -1, hold = Tp.hold, p = hold < 0 ? 0.25 : Math.max(0.15, Math.min(1, hold / FRIS.FULL));
      const over = hold >= FRIS.FULL + FRIS.PERF, perf = hold >= FRIS.FULL && !over;
      const ym = markerY(g), x1 = 50 + dir * (20 + p * 24), y1 = ym + Tp.cv * FRIS.EFFET;
      const qx = (Tp.x + x1) / 2, qy = (Tp.y + ym) / 2 - Tp.cv * 16, col = COLORS[th === 0 ? M.a : M.v];
      // la bande de la cible
      ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(px(x1) - 8, py(4), 16, 52 * SCY);
      // la trajectoire prévue
      ctx.setLineDash([3, 5]); ctx.lineDashOffset = -t * 30; ctx.strokeStyle = over ? 'rgba(255,90,90,0.8)' : 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px(Tp.x), py(Tp.y)); ctx.quadraticCurveTo(px(qx), py(qy), px(x1), py(y1)); ctx.stroke(); ctx.setLineDash([]);
      // la cible
      const out = y1 < 0 || y1 > FRIS.H, r = 9 + Math.sin(t * 12) * 1.5;
      ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(px(x1), py(ym), r, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = col; ctx.fillRect(px(x1) - 1, py(ym) - r - 4, 2, 8); ctx.fillRect(px(x1) - 1, py(ym) + r - 4, 2, 8); ctx.fillRect(px(x1) - r - 4, py(ym) - 1, 8, 2); ctx.fillRect(px(x1) + r - 4, py(ym) - 1, 8, 2);
      if (Math.abs(Tp.cv) > 0.15) {
        ctx.strokeStyle = out ? '#ff3b3b' : '#ffe24a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px(x1), py(y1), 5, 0, Math.PI * 2); ctx.stroke();
        view.text(out ? 'DEHORS !' : '🍌', px(x1) + dir * 18, py(y1), out ? 9 : 11, out ? '#ff3b3b' : '#ffffff', { mono: true, stroke: out });
      }
      // la jauge (un anneau autour du lanceur) : blanche, dorée dans la fenêtre PARFAIT, rouge au-delà
      // (au sol, autour de ses pieds, quand il est en 3D)
      const flat = !X.no3, cx = px(Tp.x), cy = flat ? py(Tp.y) : py(Tp.y) - 4, R = flat ? 27 : 24, ry = flat ? 11 : R, fr = Math.min(1, Math.max(0, hold) / FRIS.HOLD_MAX);
      ctx.strokeStyle = 'rgba(11,6,16,0.7)'; ctx.lineWidth = 7; ctx.beginPath(); ctx.ellipse(cx, cy, R, ry, 0, 0, Math.PI * 2); ctx.stroke();
      const a0 = -Math.PI / 2, ang = (v) => a0 + Math.PI * 2 * v / FRIS.HOLD_MAX;
      ctx.strokeStyle = 'rgba(255,210,58,0.5)'; ctx.lineWidth = 7; ctx.beginPath(); ctx.ellipse(cx, cy, R, ry, 0, ang(FRIS.FULL), ang(FRIS.FULL + FRIS.PERF)); ctx.stroke();
      if (hold >= 0) { ctx.strokeStyle = over ? (Math.sin(t * 40) > 0 ? '#ff3b3b' : '#ffffff') : perf ? '#ffd23a' : '#ffffff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(cx, cy, R, ry, 0, a0, a0 + Math.PI * 2 * fr); ctx.stroke(); }
      const lbl = hold < 0 ? 'TIENS A !' : over ? 'LÂCHE !!' : perf ? 'MAINTENANT !' : 'CHARGE…';
      X.lbl = [lbl, cx, flat ? cy - PH * 1.5 : cy - R - 10, perf || over ? 12 : 10, perf ? '#ffd23a' : over ? '#ff3b3b' : '#ffffff', hold < 0 ? 0.6 + 0.4 * Math.sin(t * 10) : 1];
      if (hold < 0 && g.u > FRIS.AIM - 30) view.text(`${Math.ceil((FRIS.AIM - g.u) / 60 * 10) / 10}`, cx, cy + ry + 10, 9, '#ff9a2a', { mono: true });
    }
    // les joueurs (le plus haut d'abord), par-dessus leurs marques au sol
    const order = g.P[0].y < g.P[1].y ? [0, 1] : [1, 0];
    for (const i of order) if (X.no3 || !drawPlayer3D(view, W, M, g, i, t, X, dt)) { X.no3 = 1; drawPlayer(view, W, M, g, i, t); }
    if (g.ph === 'aim' && X.lbl) { const b = X.lbl; view.text(b[0], b[1], b[2], b[3], b[4], { mono: true, alpha: b[5] }); }
    if (inReach && C.dv <= 0 && C.lie <= 0) view.text('A !', px(C.x), py(C.y) - (X.no3 ? 34 : PH * 1.45), 16 + Math.max(0, Math.sin(t * 30)) * 3, '#ffe24a', { mono: true });
    // le frisbee : son ombre au sol, lui en l'air, sa traînée
    if (g.ph === 'fly' && g.fr) {
      const fr = g.fr, z = frisZ(fr.s), gx = px(fb[0]), gy = py(fb[1]), dy = z * 26;
      X.spin += dt * (14 + fr.p * 20);
      if (X.lastS > fr.s) X.trail = [];
      X.lastS = fr.s;
      X.trail.push([gx, gy - dy]); if (X.trail.length > 14) X.trail.shift();
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(gx, gy, 8 - z * 1.5, 4 - z * 0.6, 0, 0, Math.PI * 2); ctx.fill();
      X.trail.forEach(([tx, ty], k) => { ctx.fillStyle = `rgba(140,255,230,${(k / X.trail.length) * 0.45})`; ctx.beginPath(); ctx.arc(tx, ty, 2 + k * 0.4, 0, Math.PI * 2); ctx.fill(); });
      disc(ctx, gx, gy - dy, 9 + z * 2, X.spin, 1);
      if (fr.over) view.text('〰', gx, gy - dy - 14, 10, '#ff5a5a', { stroke: false });
      // la ligne d'arrivée prévue s'allume à la fin (le sol approche)
      if (fr.s > 0.7) { const a = (fr.s - 0.7) / 0.3; ctx.strokeStyle = fr.out ? `rgba(255,90,90,${a})` : `rgba(255,255,255,${a * 0.6})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px(fr.x1), py(fr.y1), 10 - a * 4, 0, Math.PI * 2); ctx.stroke(); }
    } else { X.trail = []; X.lastS = -1; }
  },

  onEvent(view, ev, W, M) {
    if (!M || !ev.type.startsWith('mgFris')) return;
    const A = view.audio, X = S(view), g = M.g, slotOf = (i) => (i === 0 ? M.a : M.v);
    switch (ev.type) {
      case 'mgFrisAim': {
        const P = g.P[ev.p];
        if (g.n > 0) view.sticker(`${view.pname(slotOf(ev.p))} LANCE !`, px(P.x), py(P.y) + 30, { size: 12, color: '#ffffff', bg: COLORS[slotOf(ev.p)], life: 0.7 });
        A && A.sfx('blip', 0, 0.4, 3);
        break;
      }
      case 'mgFrisCharge': A && A.sfx('charge', 0, 0.45); break;
      case 'mgFrisThrow': {
        X.re[ev.p] = { k: 'spin', t: view.time };
        const P = g.P[ev.p], x = px(g.fr ? g.fr.x0 : P.x), y = py(g.fr ? g.fr.y0 : P.y), dir = ev.p === 0 ? 0 : Math.PI;
        view.burst(x, y, 16, ['#7affd8', '#ffffff', '#d8fff4'], { shape: 'dot', speed: 220, size: 4, dir, spread: 1, life: 0.5 });
        view.lines(0.3); view.jolt(0.3, 0.03);
        if (A) { A.sfx('throw', 0, 0.8); A.sfx('whoosh', 0, 0.6); A.sfx('zip', 0, 0.4); }
        if (ev.perf) { view.sticker(view.pick(['LANCER PARFAIT ✨', 'MISSILE 🚀', 'TIR DE SNIPER']), x, y - 74, { size: 14, color: INK, bg: '#ffd23a', life: 0.8 }); A && A.sfx('hitmark', 0, 0.7); view.burst(x, y, 14, ['#ffd23a', '#ffffff'], { shape: 'star', speed: 200, size: 5 }); }
        else if (ev.over) { view.sticker('TROP TENU 😵', x, y - 74, { size: 14, color: '#ffffff', bg: '#a00010', life: 0.8 }); A && A.sfx('wobble', 0, 0.6); }
        else if (ev.limp) { view.sticker('LANCER MOU 🥱', x, y - 74, { size: 14, color: '#ffffff', bg: '#7a5a9a', life: 0.8 }); A && A.sfx('fart', 0, 0.5); }
        if (Math.abs(ev.c) > 50) { view.sticker('BANANE 🍌', 320, py(30), { size: 16, color: INK, bg: '#ffe24a', life: 0.7, rot: (ev.c > 0 ? 0.2 : -0.2) }); A && A.sfx('kickflip', 0, 0.5); }
        break;
      }
      case 'mgFrisDive': {
        const P = g.P[ev.p], x = px(P.x), y = py(P.y);
        view.burst(x, y + 8, 14, ['#8a6a3a', '#5a4a2a', '#3a8a42'], { speed: 120, size: 4, up: 40, life: 0.5 });
        view.sticker(view.pick(['PLONGEON !', 'SUPERMAN 🦸', 'EN VOL !']), x, y - 70, { size: 13, color: '#ffffff', bg: COLORS[slotOf(ev.p)], life: 0.6 });
        view.lines(0.25); view.jolt(0.25, 0.03);
        if (A) { A.sfx('jump2', 0, 0.7); A.sfx('whoosh', 0, 0.6); }
        break;
      }
      case 'mgFrisFlop': {
        const P = g.P[ev.p], x = px(P.x), y = py(P.y);
        X.bump[ev.p] = 0.8;
        view.burst(x, y + 6, 20, ['#8a6a3a', '#6a5030', '#2f7a3a', '#ffffff'], { speed: 150, size: 5, up: 60, life: 0.6 });
        view.jolt(0.3, 0.02);
        if (A) { A.sfx('thud', 0, 0.8); A.sfx('land', 0, 0.6); }
        break;
      }
      case 'mgFrisGrab': A && A.sfx('click', 0, 0.5); break;
      case 'mgFrisWhiff': {
        if (!ev.near) { A && A.sfx('error', 0, 0.3); break; }
        const P = g.P[ev.p];
        view.sticker(view.pick(['RATÉ DE PEU 😱', 'SI PRÈS…', 'MAINS EN BEURRE 🧈']), px(P.x), py(P.y) - 72, { size: 13, color: '#ffffff', bg: '#a00010', life: 0.8 });
        if (A) { A.sfx('whip', 0, 0.6); A.sfx('error', 0, 0.4); }
        break;
      }
      case 'mgFrisCatch': {
        const x = px(ev.x / 10), y = py(ev.y / 10), slot = slotOf(ev.p), both = ev.dive && ev.ext;
        X.pop[ev.p] = 1; X.bump[ev.p] = 1; X.re[ev.p] = { k: 'catch', t: view.time };
        view.burst(x, y, both ? 50 : 28, ['#ffe24a', '#ffffff', '#7affd8', COLORS[slot]], { shape: 'star', speed: both ? 360 : 240, size: 6, life: 0.7 });
        view.burst(x, y, 6, ['#fff'], { shape: 'txt', ch: view.pick(['🥏', '✨', '🔥', '💯']), speed: 160, size: 9, up: 120, life: 1 });
        const word = both ? 'PLONGEON IN EXTREMIS !!!' : ev.dive ? view.pick(['PLONGEON DE L\'ANGE', 'VOL PLANÉ 🕊️', 'SUPER SAUVETAGE']) : ev.ext ? view.pick(['IN EXTREMIS 😰', 'AU RAS DU SOL', 'SAUVÉ !']) : ev.far >= 40 ? 'QUELLE COURSE 🏃' : view.pick(['ATTRAPÉ !', 'DANS LA POCHE', 'PROPRE 👌']);
        view.sticker(word, both ? 320 : x, both ? 180 : y - 76, { size: both ? 28 : ev.dive || ev.ext ? 17 : 14, color: '#ffffff', bg: both ? '#ff2a6a' : COLORS[slot], life: both ? 1.2 : 0.9, rot: (Math.random() - 0.5) * 0.3 });
        view.sticker(`+${ev.pts}`, x, y - 48, { size: 18, color: '#ffe24a', life: 0.9 });
        view.jolt(both ? 1 : ev.dive || ev.ext ? 0.6 : 0.35, both ? 0.12 : 0.05, both ? '#ffffff' : null, 0.4);
        if (both) { view.confetti(70); view.emojiRain(['🥏', '🤯', '🔥', '💯'], 14); view.hype(1); view.lines(0.7); }
        else if (ev.dive || ev.ext) { view.hype(0.5); view.lines(0.4); }
        if (A) {
          A.sfx('grab', 0, 0.9); A.sfx('cash', 0, 0.6);
          if (ev.dive || ev.ext) { A.sfx('airhorn', 0, both ? 0.8 : 0.45); A.crowd(); A.say(both ? 'Incroyable !' : view.pick(['Quelle détente !', 'Magnifique !', 'Il l\'a eu !']), 0.55, 1.15); }
          if (both) A.sfx('bassDrop', 0, 0.7);
        }
        break;
      }
      case 'mgFrisLand': {
        const x = px(ev.x / 10), y = py(ev.y / 10), t = view.time;
        X.marks.push({ x, y, t, out: ev.out });
        X.re[ev.out ? ev.p : 1 - ev.p] = { k: 'sad', t: view.time }; // le lanceur qui l'a mis dehors, ou celui qui l'a laissé tomber
        if (ev.out) {
          const c = 1 - ev.p;
          X.pop[c] = 1;
          view.burst(x, y, 20, ['#ff5a5a', '#ffffff', '#8a8aa0'], { speed: 180, size: 4, life: 0.6 });
          view.sticker('DEHORS ! 🙅', Math.max(80, Math.min(560, x)), Math.max(70, Math.min(330, y - 26)), { size: 18, color: '#ffffff', bg: '#a00010', life: 0.9 });
          view.sticker(`+${ev.pts} ${view.pname(slotOf(c))}`, Math.max(80, Math.min(560, x)), Math.max(96, Math.min(350, y)), { size: 13, color: '#ffe24a', life: 0.8 });
          if (A) { A.sfx('poof', 0, 0.8); A.sfx('error', 0, 0.5); A.say(view.pick(['Dehors !', 'Out !', 'Trop loin !']), 0.6, 1.2); }
        } else {
          X.pop[ev.p] = 1;
          view.burst(x, y, 24, ['#8a6a3a', '#2f7a3a', '#ffe24a'], { speed: 200, size: 5, up: 80, life: 0.6 });
          view.sticker(view.pick(['IMPARABLE ! 🎯', 'ACE !', 'DANS LE MILLE']), x, y - 30, { size: 17, color: '#ffffff', bg: COLORS[slotOf(ev.p)], life: 0.9 });
          view.sticker(`+${ev.pts}`, x, y - 8, { size: 16, color: '#ffe24a', life: 0.8 });
          view.jolt(0.5, 0.05, '#ffe24a', 0.15); view.hype(0.3);
          if (A) { A.sfx('thud', 0, 0.9); A.sfx('hitM', 0, 0.6); A.sfx('cash', 0, 0.5); A.say(view.pick(['Imparable !', 'Trop fort !', 'Ace !']), 0.55, 1.15); }
        }
        break;
      }
      default: break;
    }
  },
};
