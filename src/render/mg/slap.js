// Concours de baffes (slap), l'affichage : un ring de championnat, les deux têtes face à face (le portrait découpé en
// rond, posé sur un buste à la couleur du joueur), la jauge de chaque joueur (trois arrêts d'aiguille), le baffomètre au
// centre. À l'impact : la tête tourne sur elle-même, les yeux sortent au bout de ressorts, la langue pend, les larmes
// jaillissent ; au verdict, tout le monde pleure (le perdant des torrents, le gagnant de joie) et la flaque monte.
import { COLORS } from '../../sim/constants.js';
import { portraitURL } from '../../ui/hud.js';
import { SLAP, needle } from '../../sim/mg/slap.js';
import { drawPuppet } from '../puppets.js';

const HX = [168, 472], HY = 140, HR = 52;
const STAGES = ['ÉPAULE', 'COUDE', 'POIGNET'];
const SKIN = '#f2c9a0', INK = '#0b0610';
const BAM = ['PAF !', 'SCHLAK !', 'BLAM !', 'CLAC !', 'SPLAF !', 'TCHAK !'];
const imgs = {};
function img(char) {
  if (!imgs[char]) { const im = new Image(); im.src = portraitURL(char); imgs[char] = im; }
  return imgs[char];
}
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeIn = (t) => t * t * t;

// l'état d'affichage (vidé à chaque ulti) : les têtes, les sons à venir, la flaque
function S(view) {
  const X = view.xs;
  if (!X.ok) {
    X.ok = 1;
    X.h = [0, 1].map(() => ({ hit: -99, f: 0, dir: 0, cry: 0, joy: 0, mark: 0, brace: 0 }));
    X.q = []; X.hb = [null, null]; X.hs = [null, null]; X.taunt = [0, 0]; X.lock = [null, null]; X.meter = [0, 0]; X.boom = null; X.ex = 0; X.pud = 0; X.ring = [-1, -1]; X.verdict = null;
  }
  return X;
}
const later = (view, d, fn) => S(view).q.push({ at: view.time + d, fn });
// où est la tête du joueur i à l'écran (le vrai modèle si on l'a trouvée, sinon la place du portrait)
const headAt = (X, i) => (!X.no3 && X.hs[i]) || { x: HX[i], y: HY, r: HR };

// une tête : le portrait découpé en rond (ou un visage dessiné pour la démo), tournée de o.rot ; les yeux à ressort,
// la langue, les larmes, la trace de main, dessinés par-dessus (headFx)
function drawHead(view, im, x, y, R, o) {
  const ctx = view.g;
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot);
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0, 0, R + 3, 0, Math.PI * 2); ctx.fill();
  const gr = ctx.createRadialGradient(-R * 0.3, -R * 0.4, R * 0.2, 0, 0, R);
  gr.addColorStop(0, '#fff6ea'); gr.addColorStop(1, o.col || '#c8a0a0');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.clip();
  if (im && im.complete && im.naturalWidth) {
    const s = R * 4;
    ctx.save(); if (o.flip) ctx.scale(-1, 1); ctx.drawImage(im, -s * 0.5, -s * 0.36, s, s); ctx.restore();
  } else {
    ctx.fillStyle = SKIN; ctx.beginPath(); ctx.arc(0, R * 0.1, R * 0.86, 0, Math.PI * 2); ctx.fill();
    if (o.eyes < 0.05) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(-R * 0.3, -R * 0.1, R * 0.1, 0, Math.PI * 2); ctx.arc(R * 0.3, -R * 0.1, R * 0.1, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, R * 0.3, R * 0.25, 0.2, Math.PI - 0.2); ctx.stroke();
  }
  if (o.red > 0) { ctx.fillStyle = `rgba(255,30,30,${o.red})`; ctx.fillRect(-R, -R, R * 2, R * 2); }
  ctx.restore();
  ctx.lineWidth = 3; ctx.strokeStyle = o.col || INK; ctx.beginPath(); ctx.arc(0, 0, R + 1, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  headFx(view, x, y, R, o);
}

// ce qu'on dessine par-dessus une tête (le portrait ou le vrai modèle 3D) : la trace de main, les orbites vides, la langue
// qui pend, les larmes, les yeux au bout de leurs ressorts, la goutte de sueur. Les repères du visage (o.ex, o.ey : le
// milieu des yeux, o.es : leur écart, o.my : la bouche, en rayons de tête) suivent la rotation o.rot autour de (x, y).
function headFx(view, x, y, R, o) {
  const ctx = view.g, cs = Math.cos(o.rot), sn = Math.sin(o.rot), t = view.time;
  const ex = (o.ex || 0) * R, ey = (o.ey ?? -0.12) * R, es = (o.es || 0.28) * R, my = (o.my ?? 0.44) * R;
  const at = (ax, ay) => [x + ax * cs - ay * sn, y + ax * sn + ay * cs];
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot);
  // la trace de main, sur la joue qui a pris
  if (o.mark > 0) {
    ctx.save(); ctx.translate(ex + o.markSide * R * 0.5, ey + R * 0.3); ctx.rotate(o.markSide * 0.3); ctx.globalAlpha = Math.min(0.75, o.mark);
    ctx.fillStyle = '#e0202a'; ctx.beginPath(); ctx.ellipse(0, 0, R * 0.2, R * 0.24, 0, 0, Math.PI * 2); ctx.fill();
    for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.ellipse(-R * 0.15 + k * R * 0.1, -R * 0.36, R * 0.045, R * 0.16, (k - 1.5) * 0.12, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  // les orbites vides quand les yeux sont sortis
  if (o.eyes > 0.15) { ctx.fillStyle = '#1a0610'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(ex + sx * es, ey, R * 0.13, R * 0.1, 0, 0, Math.PI * 2); ctx.fill(); } }
  ctx.restore();
  // la langue qui pend (vers le bas de l'écran, quel que soit l'angle de la tête), qui se balance
  if (o.tongue > 0.02) {
    const [mx, my2] = at(ex, my), L = R * 0.85 * o.tongue, a = Math.PI / 2 + o.swing;
    const tx = mx + Math.cos(a) * L, ty = my2 + Math.sin(a) * L;
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK; ctx.lineWidth = R * 0.34 + 4; ctx.beginPath(); ctx.moveTo(mx, my2); ctx.quadraticCurveTo(mx + Math.cos(a - 0.4) * L * 0.6, my2 + Math.sin(a - 0.4) * L * 0.6, tx, ty); ctx.stroke();
    ctx.strokeStyle = '#ff5a7a'; ctx.lineWidth = R * 0.34; ctx.stroke();
    ctx.strokeStyle = '#c02a4a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(mx, my2); ctx.lineTo((mx + tx) / 2 + 1, (my2 + ty) / 2); ctx.stroke();
    ctx.fillStyle = 'rgba(200,240,255,0.9)'; ctx.beginPath(); ctx.arc(tx, ty + R * 0.2 + ((t * 40) % 14), 2.5, 0, Math.PI * 2); ctx.fill(); // la bave
    ctx.lineCap = 'butt';
  }
  // les larmes : deux jets par œil, en arc, plus un ruisseau sur les joues
  const sockets = [at(ex - es, ey), at(ex + es, ey)];
  if (o.cry > 0.02) {
    const c = Math.min(1.8, o.cry), pw = 30 + c * 46, up = 14 + c * 16, drop = 34 + c * 30;
    ctx.lineCap = 'round';
    sockets.forEach(([sx, sy], e) => {
      for (const side of [-1, 1]) {
        if (c < 0.6 && side === (e ? -1 : 1)) continue; // un petit sanglot : un jet par œil, vers l'extérieur
        const tx = sx + side * pw, ty = sy + drop, qx = sx + side * pw * 0.45, qy = sy - up * 2;
        ctx.setLineDash([7, 5]); ctx.lineDashOffset = -t * 60 - e * 5;
        ctx.strokeStyle = 'rgba(11,6,16,0.6)'; ctx.lineWidth = 3 + c * 3.4; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(qx, qy, tx, ty); ctx.stroke();
        ctx.strokeStyle = '#6ac8ff'; ctx.lineWidth = 1.6 + c * 2.6; ctx.stroke();
        ctx.strokeStyle = 'rgba(230,250,255,0.9)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.setLineDash([]);
        for (let k = 0; k < 3; k++) { // les gouttes qui se détachent au bout
          const u = (t * 2.2 + k / 3 + e * 0.3) % 1;
          ctx.fillStyle = '#9ae0ff'; ctx.beginPath(); ctx.arc(tx + side * u * 10, ty + u * u * 40, 1.5 + c * 1.6, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.fillStyle = 'rgba(120,200,255,0.8)'; ctx.fillRect(sx - 2, sy + 4, 4, R * 0.55 * Math.min(1, c));
    });
    ctx.lineCap = 'butt';
  }
  // les yeux, au bout de leurs ressorts
  if (o.eyes > 0.02) {
    sockets.forEach(([sx, sy], e) => {
      const a = -Math.PI / 2 + (e ? 0.75 : -0.75) + Math.sin(t * (6 + e) + e * 2) * 0.35;
      const L = (R * 0.25 + o.eyeLen) * o.eyes, qx = sx + Math.cos(a) * L, qy = sy + Math.sin(a) * L;
      ctx.strokeStyle = '#c0c4cc'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx, sy);
      for (let k = 1; k <= 8; k++) { const u = k / 8, w = (k % 2 ? 5 : -5) * (k < 8 ? 1 : 0); ctx.lineTo(sx + (qx - sx) * u - Math.sin(a) * w, sy + (qy - sy) * u + Math.cos(a) * w); }
      ctx.stroke();
      const r = R * 0.22;
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(qx, qy, r + 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(qx, qy, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ff4a5a'; ctx.lineWidth = 1; for (let v = 0; v < 3; v++) { const va = v * 2.1 + e; ctx.beginPath(); ctx.moveTo(qx + Math.cos(va) * r, qy + Math.sin(va) * r); ctx.lineTo(qx + Math.cos(va + 0.3) * r * 0.5, qy + Math.sin(va + 0.3) * r * 0.5); ctx.stroke(); }
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(qx + Math.sin(t * 23 + e) * r * 0.35, qy + Math.cos(t * 19 + e) * r * 0.35, r * 0.42, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(qx - r * 0.25, qy - r * 0.3, r * 0.15, 0, Math.PI * 2); ctx.fill();
    });
  }
  // la goutte de sueur (la peur)
  if (o.fear > 0.05) {
    const [sx, sy] = at(ex + R * 0.7, ey - R * 0.43), dy = ((t * 1.4) % 1) * 16;
    ctx.globalAlpha = Math.min(1, o.fear); ctx.fillStyle = '#9ae0ff'; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(sx, sy - 8 + dy); ctx.quadraticCurveTo(sx + 6, sy + 3 + dy, sx, sy + 5 + dy); ctx.quadraticCurveTo(sx - 6, sy + 3 + dy, sx, sy - 8 + dy); ctx.fill(); ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

// une grosse main ouverte (la paume vers l'écran), s : l'échelle, a : l'angle, flip : main gauche
function drawHand(ctx, x, y, s, a, flip, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.rotate(a); ctx.scale(flip ? -s : s, s);
  const part = (fn) => { ctx.beginPath(); fn(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = SKIN; ctx.fill(); };
  for (let k = 0; k < 4; k++) part(() => ctx.ellipse(-9 + k * 7, -20 - (k === 1 || k === 2 ? 4 : 0), 3.6, 11, (k - 1.5) * 0.12, 0, Math.PI * 2));
  part(() => ctx.ellipse(14, -2, 4, 10, 0.9, 0, Math.PI * 2));
  part(() => ctx.ellipse(0, 0, 14, 15, 0, 0, Math.PI * 2));
  ctx.fillStyle = SKIN; ctx.beginPath(); ctx.ellipse(0, -2, 12.5, 13, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(160,90,60,0.6)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(-2, 4, 7, -2.6, -0.6); ctx.stroke();
  ctx.fillStyle = '#e8b890'; ctx.fillRect(-8, 13, 16, 9); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(-8, 13, 16, 9);
  ctx.restore();
}

// un buste (sous la tête), à la couleur du joueur
function drawBody(ctx, x, y, col, sh) {
  ctx.save(); ctx.translate(x + sh, y);
  ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(-38, HR - 6); ctx.lineTo(38, HR - 6); ctx.lineTo(66, HR + 120); ctx.lineTo(-66, HR + 120); ctx.closePath(); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-34, HR - 3); ctx.lineTo(34, HR - 3); ctx.lineTo(62, HR + 120); ctx.lineTo(-62, HR + 120); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(-4, HR + 4, 8, 120);
  ctx.fillStyle = SKIN; ctx.fillRect(-12, HR - 12, 24, 14); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(-12, HR - 12, 24, 14);
  ctx.restore();
}

// l'état animé d'une tête à l'instant présent
function headState(view, X, i, g) {
  const H = X.h[i], tau = view.time - H.hit, t = view.time;
  const o = { rot: 0, dx: 0, eyes: 0, eyeLen: 18 + H.f / 14, tongue: 0, swing: 0, cry: H.cry, mark: H.mark, markSide: i === 0 ? 1 : -1, fear: 0, red: 0 };
  if (tau >= 0 && tau < 6) {
    const turns = 1 + Math.min(3, Math.floor(H.f / 130));
    o.rot = H.dir * Math.PI * 2 * turns * (1 - Math.exp(-3.2 * tau)) + H.dir * 0.3 * Math.sin(tau * 16) * Math.exp(-2.5 * tau);
    o.dx = H.dir * 40 * Math.exp(-4.5 * tau) * Math.cos(tau * 11);
    const env = (1 - Math.exp(-16 * tau)) * (tau < 2.3 ? 1 : clamp01(1 - (tau - 2.3) * 2.2));
    o.eyes = env * (1 + 0.28 * Math.sin(tau * 19) * Math.exp(-1.6 * tau));
    o.tongue = env; o.swing = 0.9 * Math.sin(tau * 8) * Math.exp(-0.7 * tau) + 0.12 * Math.sin(tau * 3);
    o.cry = Math.max(H.cry, tau > 0.12 ? 1.3 * Math.exp(-0.45 * (tau - 0.12)) : 0);
  }
  if (g.ph === 'charge') o.red = g.p[i].k * 0.07 + (g.p[i].k < SLAP.STOPS ? Math.max(0, Math.sin(t * 9)) * 0.04 : 0);
  if (g.ph === 'slap' && 1 - g.cur === i && g.u < SLAP.IMPACT) { o.fear = 0.4 + g.u / SLAP.IMPACT; o.dx += (Math.random() - 0.5) * (g.u / SLAP.IMPACT) * 4; }
  if (g.ph === 'slap' && g.cur === i && g.u < SLAP.IMPACT) o.red = 0.06 + 0.16 * g.u / SLAP.IMPACT;
  return o;
}

// --- les combattants en vrai modèle 3D (marionnettes, src/render/puppets.js), à grosse tête. Chacun est rendu deux fois
// dans des canevas à part, avec la même pose : en entier (F) et sans tête (B : la tête réduite à rien). F privé de B = la
// tête seule (Hd), dont on retrouve le cadre (centre, taille) en relisant ses pixels en petit. Au repos on colle F ; quand
// la tête tourne, on colle le corps B puis la tête Hd qui tourne sur elle-même ; les yeux, la langue, les larmes par-dessus.
const PW = 220, PHT = 300, PH = 187.5, PFX = 110, PFY = 281.25; // le canevas d'une marionnette, à l'échelle 1 (src/render/puppets.js)
const FEET = 330, BODY_H = 190, BIG = 1.75;
let PC = null;
const cv2 = (w, h, rf) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return { c, g: c.getContext('2d', rf ? { willReadFrequently: true } : undefined) }; };
function pcv() {
  if (!PC) PC = { F: [cv2(PW, PHT), cv2(PW, PHT)], B: [cv2(PW, PHT), cv2(PW, PHT)], Hd: [cv2(PW, PHT), cv2(PW, PHT)], R: cv2(PW / 4, PHT / 4, true) };
  return PC;
}
const noSob = (c) => c === 'epektase' || c === 'pprod'; // pas de clip « sob » chez eux : sonnés à la place
// rend la marionnette du joueur i dans son canevas (F : entière, B : sans tête)
function renderInto(cv, char, key, o) {
  cv.g.clearRect(0, 0, PW, PHT);
  return drawPuppet(cv.g, char, PFX, PFY, PH, { ...o, shadow: false, key });
}
// la tête seule (Hd = F - B) et son cadre, en pixels du canevas de la marionnette (null si on ne la trouve pas)
function headBox(i) {
  const P = pcv(), Hd = P.Hd[i], R = P.R, w = PW / 4, h = PHT / 4; // (relu au quart : 16 fois moins de pixels)
  Hd.g.globalCompositeOperation = 'copy'; Hd.g.drawImage(P.F[i].c, 0, 0);
  Hd.g.globalCompositeOperation = 'destination-out'; Hd.g.drawImage(P.B[i].c, 0, 0); Hd.g.drawImage(P.B[i].c, 0, 0);
  Hd.g.globalCompositeOperation = 'source-over';
  R.g.clearRect(0, 0, w, h); R.g.drawImage(Hd.c, 0, 0, w, h);
  const d = R.g.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1, n = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 110) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (n < 6) return null;
  return { x: (x0 + x1 + 1) * 2, y: (y0 + y1 + 1) * 2, w: (x1 - x0 + 1) * 4, h: (y1 - y0 + 1) * 4 };
}

// la pose 3D du joueur i à cet instant (état, provocation, regard, teinte), d'après la baffe et le verdict
function pose3D(view, X, W, M, g, i, o) {
  const H = X.h[i], tau = view.time - H.hit, char = W.fighters[i === 0 ? M.a : M.v].char;
  const p = { face: i === 0 ? 'three' : 'threeL', head: BIG, tint: '#ff1a1a', tintK: Math.min(0.32, o.red * 1.3) };
  if (g.ph === 'verdict' || M.ph === 'outro') { if (noSob(char)) p.state = 'dizzy'; else p.emote = 'sob'; return p; }
  if (tau >= 0 && tau < 1.5) { p.state = 'hitstun'; p.kb = 60 + H.f / 3; return p; }
  if (tau >= 1.5 && tau < 3.4) { p.state = 'dizzy'; return p; }
  const tt = view.time - X.taunt[i];
  if (X.taunt[i] && tt >= 0 && tt < 1.8) { p.emote = 'select'; return p; }
  if (g.ph === 'slap' && 1 - g.cur === i && g.u < SLAP.IMPACT) { p.state = H.brace === 2 ? 'shield' : 'crouch'; return p; }
  if (g.ph === 'charge' && g.p[i].k >= SLAP.STOPS) { p.emote = 'select'; return p; }
  return p;
}

// dessine le joueur i en 3D, les pieds en (x, FEET) ; false si les marionnettes ne marchent pas ici (on garde les bustes)
function fighter3D(view, X, W, M, g, i, o) {
  const P = pcv(), slot = i === 0 ? M.a : M.v, char = W.fighters[slot].char, ctx = view.g;
  const p = pose3D(view, X, W, M, g, i, o);
  if (!renderInto(P.F[i], char, `slapF${i}`, p)) return false;
  renderInto(P.B[i], char, `slapB${i}`, { ...p, head: 0.001 });
  const spin = Math.abs(o.rot) > 0.02;
  const fx = o.eyes > 0.02 || o.tongue > 0.02 || o.cry > 0.02 || o.fear > 0.05 || o.mark > 0;
  if ((spin && (X.fr + i) % 2 === 0) || ((fx || !X.hb[i]) && (X.fr + i * 2) % 4 === 0)) { // (relire des pixels coûte : une fois sur 4 hors des tours de tête)
    const hb = headBox(i);
    if (hb) { const q = X.hb[i]; X.hb[i] = q && !spin ? { x: q.x + (hb.x - q.x) * 0.6, y: q.y + (hb.y - q.y) * 0.6, w: q.w + (hb.w - q.w) * 0.6, h: q.h + (hb.h - q.h) * 0.6 } : hb; }
  }
  const hb = X.hb[i], k = BODY_H / PH, x = HX[i] + o.dx * 0.5, H = X.h[i], tau = view.time - H.hit;
  // le corps valse : il penche sous la baffe, s'écrase puis rebondit
  let brot = 0, sq = [1, 1];
  if (tau >= 0 && tau < 3) {
    const e = Math.exp(-3 * tau);
    brot = H.dir * (0.34 * e * Math.cos(tau * 9) + 0.05 * Math.sin(tau * 3) * Math.exp(-tau));
    const s = 0.22 * Math.exp(-6 * tau) * Math.cos(tau * 18);
    sq = [1 + s, 1 - s];
  }
  if (g.ph === 'slap' && g.cur === i && g.u < SLAP.IMPACT) { const u = g.u / SLAP.IMPACT; brot = -(i === 0 ? 1 : -1) * 0.12 * u; } // il arme : penché en arrière
  // l'ombre au sol (derrière le pupitre)
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x, FEET, 46, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.translate(x, FEET); ctx.rotate(brot); ctx.scale(sq[0] * k, sq[1] * k);
  if (spin && hb) {
    ctx.drawImage(P.B[i].c, -PFX, -PFY);
    // la tête seule, qui tourne sur elle-même (on n'en garde que le cadre : pas de fantôme du corps)
    const cx = hb.x - PFX, cy = hb.y - PFY, rr = Math.max(hb.w, hb.h) * 0.62;
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.clip();
    ctx.translate(cx, cy); ctx.rotate(o.rot); ctx.drawImage(P.Hd[i].c, -hb.x, -hb.y);
    ctx.restore();
  } else ctx.drawImage(P.F[i].c, -PFX, -PFY);
  ctx.restore();
  // les yeux à ressort, la langue, les larmes : sur la vraie tête (là où elle est à l'écran)
  if (hb) {
    const lx = (hb.x - PFX) * k * sq[0], ly = (hb.y - PFY) * k * sq[1], cs = Math.cos(brot), sn = Math.sin(brot);
    const R = Math.max(hb.w, hb.h) * k * 0.5, look = i === 0 ? 1 : -1;
    headFx(view, x + lx * cs - ly * sn, FEET + lx * sn + ly * cs, R, { ...o, rot: o.rot + brot, ex: 0.16 * look, ey: 0.08, es: 0.22, my: 0.5 });
    X.hs[i] = { x: x + lx * cs - ly * sn, y: FEET + lx * sn + ly * cs, r: R };
  }
  return true;
}

// le décor : un ring de championnat, les projecteurs, la foule
function drawStage(view, X, M) {
  const ctx = view.g, L = -view.ox, Rr = 640 + view.ox, T = -view.oy, B = 360 + view.oy, t = view.time;
  const bg = ctx.createLinearGradient(0, T, 0, B); bg.addColorStop(0, '#2c0c2a'); bg.addColorStop(0.62, '#4a1420'); bg.addColorStop(1, '#14060e');
  ctx.fillStyle = bg; ctx.fillRect(L, T, Rr - L, B - T);
  // rayons qui tournent derrière
  ctx.save(); ctx.translate(320, 150); ctx.rotate(t * 0.25);
  for (let k = 0; k < 14; k++) { ctx.fillStyle = k % 2 ? 'rgba(255,90,58,0.07)' : 'rgba(255,210,60,0.05)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 700, k * Math.PI / 7, (k + 0.5) * Math.PI / 7); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  // les projecteurs sur les deux têtes
  for (let i = 0; i < 2; i++) {
    const x = HX[i], sp = ctx.createLinearGradient(0, T, 0, 300);
    sp.addColorStop(0, 'rgba(255,250,220,0.32)'); sp.addColorStop(1, 'rgba(255,250,220,0)');
    ctx.fillStyle = sp; ctx.beginPath(); ctx.moveTo(x - 18 + (i ? 40 : -40), T); ctx.lineTo(x + 18 + (i ? 40 : -40), T); ctx.lineTo(x + 110, 300); ctx.lineTo(x - 110, 300); ctx.closePath(); ctx.fill();
  }
  // les cordes du ring
  for (let k = 0; k < 3; k++) { ctx.fillStyle = ['#ff3b3b', '#ffffff', '#3b8bff'][k]; ctx.fillRect(L, 214 + k * 14, Rr - L, 3); }
  ctx.fillStyle = '#d8c8a8'; ctx.fillRect(L, 258, Rr - L, B - 258); ctx.fillStyle = 'rgba(0,0,0,0.18)'; for (let x = Math.floor(L / 40) * 40; x < Rr; x += 40) ctx.fillRect(x, 258, 2, B - 258);
  // la flaque de larmes qui monte
  if (X.pud > 0.5) {
    const top = B - X.pud;
    ctx.fillStyle = 'rgba(90,180,255,0.55)'; ctx.beginPath(); ctx.moveTo(L, B);
    for (let x = L; x <= Rr + 8; x += 8) ctx.lineTo(x, top + Math.sin(x * 0.06 + t * 4) * 2.5);
    ctx.lineTo(Rr, B); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(220,245,255,0.6)'; for (let x = L; x < Rr; x += 37) ctx.fillRect(x + ((t * 20) % 37), top + 3, 10, 2);
  }
  // la foule (des silhouettes qui sautent plus fort quand ça claque)
  X.ex = Math.max(0, X.ex - 0.012);
  for (let k = 0; k < 26; k++) {
    const x = L + 10 + k * ((Rr - L) / 25), j = Math.abs(Math.sin(t * (5 + (k % 4)) + k * 1.7)) * (2 + X.ex * 16), y = B - 12 - (k % 2) * 8 - j;
    ctx.fillStyle = k % 3 ? '#1a0a16' : '#240e1e';
    ctx.beginPath(); ctx.arc(x, y - 14, 10, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(x - 13, y - 6, 26, 40);
    if (X.ex > 0.3 && k % 2) { ctx.fillRect(x - 15, y - 34, 5, 22); ctx.fillRect(x + 10, y - 34, 5, 22); }
  }
  void M;
}

// le panneau de chargement d'un joueur : la jauge, la zone, l'aiguille, les trois arrêts
function drawGauge(view, X, W, M, g, i) {
  const ctx = view.g, P = g.p[i], slot = i === 0 ? M.a : M.v, col = COLORS[slot], cx = HX[i], x0 = cx - 92, y0 = 270;
  view.panel(cx - 104, y0 - 16, 208, 62, 'rgba(14,6,22,0.9)', col);
  if (g.ph === 'charge') {
    const k = Math.min(P.k, SLAP.STOPS - 1), z = g.zones[k], lk = X.lock[i];
    const showLock = lk && view.time - lk.t < 0.35;
    view.text(P.k < SLAP.STOPS ? `${STAGES[k]} · A !` : 'BAFFE ARMÉE ✔', cx - 96, y0 - 4, 10, P.k < SLAP.STOPS ? '#ffffff' : '#7cff8a', { align: 'left', mono: true });
    for (let s = 0; s < SLAP.STOPS; s++) {
      const bx = cx + 36 + s * 22, v = P.sc[s];
      ctx.fillStyle = INK; ctx.fillRect(bx - 1, y0 - 12, 20, 16);
      ctx.fillStyle = v === undefined ? '#4a3a5a' : v >= 100 ? '#ffd23a' : v >= 75 ? '#3bdc5a' : v >= 40 ? '#ff9a2a' : '#ff3b3b';
      ctx.fillRect(bx, y0 - 11, 18, 14);
      view.text(v !== undefined ? String(v) : '?', bx + 9, y0 - 4, 8, v !== undefined ? INK : '#8a7a9a', { mono: true, stroke: false });
    }
    // la barre
    const bw = 184, by = y0 + 10;
    ctx.fillStyle = INK; ctx.fillRect(x0 - 2, by - 2, bw + 4, 18);
    const hg = ctx.createLinearGradient(x0, 0, x0 + bw, 0); hg.addColorStop(0, '#3a1030'); hg.addColorStop(1, '#5a1a3a');
    ctx.fillStyle = hg; ctx.fillRect(x0, by, bw, 14);
    if (P.k < SLAP.STOPS || showLock) {
      const zz = showLock ? g.zones[lk.k] : z;
      ctx.fillStyle = '#3bdc5a'; ctx.fillRect(x0 + (zz - SLAP.ZONE) * bw, by, SLAP.ZONE * 2 * bw, 14);
      ctx.fillStyle = '#ffd23a'; ctx.fillRect(x0 + (zz - SLAP.PERF) * bw, by, SLAP.PERF * 2 * bw, 14);
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(x0 + zz * bw - 0.5, by, 1, 14);
      const pos = showLock ? lk.pos : P.wait > 0 ? 0 : needle(P), nx = x0 + pos * bw;
      const fl = showLock ? 1 - (view.time - lk.t) / 0.35 : 0;
      ctx.fillStyle = showLock ? '#ffffff' : '#ffffff'; ctx.fillRect(nx - 1.5, by - 5, 3, 24);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(nx - 7, by - 9); ctx.lineTo(nx + 7, by - 9); ctx.lineTo(nx, by - 1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = showLock ? '#ffd23a' : '#ffffff'; ctx.beginPath(); ctx.moveTo(nx - 5, by - 8); ctx.lineTo(nx + 5, by - 8); ctx.lineTo(nx, by - 2); ctx.closePath(); ctx.fill();
      if (fl > 0) { ctx.strokeStyle = `rgba(255,255,255,${fl})`; ctx.lineWidth = 2; ctx.strokeRect(nx - 10 - (1 - fl) * 10, by - 6 - (1 - fl) * 6, 20 + (1 - fl) * 20, 26 + (1 - fl) * 12); }
    } else view.text('PRÊT À BAFFER', cx, by + 7, 11, '#7cff8a', { mono: true });
    view.text(`PUISSANCE ${P.pw}`, cx, y0 + 36, 10, '#ffd23a', { mono: true });
  } else {
    view.text(`PUISSANCE ${P.pw} / 300`, cx, y0, 11, '#ffd23a', { mono: true });
    const f = g.f[i];
    if (f >= 0) view.text(`BAFFE : ${Math.round(X.meter[i])} KM/H`, cx, y0 + 24, 16, '#ffffff', { mono: true });
    else view.text(g.ph === 'slap' && g.cur === i ? 'ARME SA BAFFE…' : 'ATTEND SON TOUR', cx, y0 + 24, 12, '#c8bad8', { mono: true });
  }
}

export default {
  countdown: false, // pas de gros chiffre rouge à la fin : il couvrirait le verdict
  title: 'CONCOURS DE BAFFES', color: '#ff5a3a', icon: '🖐️',
  goal: 'Appuie pile au bon moment pour mettre la plus grosse baffe !',
  keys: [['A', 'au bon moment']],
  // pendant la présentation : les persos rendus une fois dans leurs canevas (pas d'à-coup au premier dessin)
  warm(view, W, M) {
    for (let i = 0; i < 2; i++) { const c = W.fighters[i === 0 ? M.a : M.v].char; renderInto(pcv().F[i], c, `slapF${i}`, { head: BIG }); renderInto(pcv().B[i], c, `slapB${i}`, { head: 0.001 }); }
  },
  ach: [['Main de fer', 'Paume d\'or', 'Champion de Sibérie'], ['Joue en compote', 'Yeux à ressort', 'Fontaine humaine']],
  news: (L, d) => `${L} REÇOIT LA BAFFE DU SIÈCLE : ${d} %, LES YEUX TOUJOURS PAS RETROUVÉS`,

  draw(view, W, M, dt) {
    const ctx = view.g, g = M.g, X = S(view), T = -view.oy;
    // les sons et effets programmés
    if (X.q.length) { const now = view.time; X.q = X.q.filter((e) => { if (e.at > now) return true; e.fn(); return false; }); }
    for (let i = 0; i < 2; i++) { const f = g.f[i]; if (f >= 0) X.meter[i] += (f - X.meter[i]) * Math.min(1, dt * 7); }
    const crying = X.h.reduce((s, H) => s + H.cry, 0) + X.h.filter((H) => view.time - H.hit < 3).length * 0.8;
    X.pud = Math.min(46, X.pud + crying * dt * 3.2);
    drawStage(view, X, M);
    view.text('🖐️ CONCOURS DE BAFFES', 320, T + 18, 20, '#ff5a3a', { title: true });
    view.timer(M, 320, T + 44);
    // les deux combattants
    const st = [0, 1].map((i) => headState(view, X, i, g));
    // les vrais modèles 3D (grosse tête) ; sinon (pas de WebGL pour les marionnettes) les bustes et les portraits
    X.fr = (X.fr || 0) + 1;
    if (!X.no3) for (let i = 0; i < 2; i++) if (!fighter3D(view, X, W, M, g, i, st[i])) { X.no3 = 1; break; }
    if (X.no3) for (let i = 0; i < 2; i++) drawBody(ctx, HX[i], HY, COLORS[(i === 0 ? M.a : M.v)], st[i].dx * 0.3);
    // les mains de baffe (qui flottent à côté, et s'arment pendant le chargement)
    for (let i = 0; i < 2; i++) {
      if (g.ph === 'slap' && g.cur === i) continue;
      const out = i === 0 ? -1 : 1, P = g.p[i], lv = g.ph === 'charge' ? P.k + (P.k < SLAP.STOPS ? 0.3 * Math.sin(view.time * 8) : 0) : 0, hd = headAt(X, i);
      drawHand(ctx, hd.x + out * (HR + 26 + lv * 6), hd.y + 56 - lv * 22, 1.05 + lv * 0.08, out * (0.5 + lv * 0.35), i === 1);
    }
    for (let i = 0; i < 2; i++) {
      const slot = i === 0 ? M.a : M.v, o = st[i];
      o.col = COLORS[slot]; o.flip = i === 1;
      if (X.no3) drawHead(view, img(W.fighters[slot].char), HX[i] + o.dx, HY, HR, o);
      view.text(view.label(W, slot), HX[i], 58, 12, COLORS[slot], { mono: true });
    }
    // la baffe en cours : la main qui s'arme puis part, le cercle qui se referme sur la joue
    if (g.ph === 'slap') {
      const s = g.cur, v = 1 - s, out = s === 0 ? -1 : 1, u = g.u + 0, hv = headAt(X, v), hs0 = headAt(X, s), cxv = hv.x + out * hv.r * 0.62, cyv = hv.y + hv.r * 0.2;
      const pw = g.p[s].pw / 300, wind = SLAP.IMPACT - 9;
      let hx, hy, ha, hs = 1.25 + pw * 0.5;
      const rest = [hs0.x + out * (HR + 26), hs0.y + 56];
      const back = [hs0.x + out * (HR + 50), hs0.y - 46];
      if (u < wind) {
        const k = clamp01(u / 22), tr = (u / wind) * (2 + pw * 4);
        hx = rest[0] + (back[0] - rest[0]) * k + (Math.random() - 0.5) * tr; hy = rest[1] + (back[1] - rest[1]) * k + (Math.random() - 0.5) * tr; ha = out * (0.5 + k * 1.2);
      } else if (u < SLAP.IMPACT) {
        const k = easeIn((u - wind) / (SLAP.IMPACT - wind));
        hx = back[0] + (cxv - back[0]) * k; hy = back[1] + (cyv - back[1]) * k; ha = out * (1.7 - k * 3.1);
        for (let gh = 1; gh <= 3; gh++) { const k2 = easeIn(Math.max(0, (u - gh * 1.2 - wind) / (SLAP.IMPACT - wind))); drawHand(ctx, back[0] + (cxv - back[0]) * k2, back[1] + (cyv - back[1]) * k2, hs, out * (1.7 - k2 * 3.1), s === 1, 0.25); }
      } else {
        const k = clamp01((u - SLAP.IMPACT - 8) / 24);
        hx = cxv + (rest[0] - cxv) * k; hy = cyv + (rest[1] - cyv) * k; ha = out * (-1.4 + k * 1.9); hs = hs + (1.05 - hs) * k;
      }
      drawHand(ctx, hx, hy, hs, ha, s === 1);
      // le cercle du timing
      const d = SLAP.IMPACT - u;
      if (d >= 0 && d <= SLAP.WIN + 14) {
        const r = 13 + d * 2.6, hot = d <= SLAP.CRIT, ok = d <= SLAP.GOOD;
        ctx.setLineDash([3, 3]); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cxv, cyv, 13, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cxv, cyv, r, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = hot ? '#ffd23a' : ok ? '#3bdc5a' : '#ffffff'; ctx.lineWidth = 3.5; ctx.stroke();
        if (d <= SLAP.WIN) {
          const pulse = 1 + Math.max(0, Math.sin(view.time * 30)) * 0.15;
          view.text('A !', cxv, cyv - r - 12, 16 * pulse, hot ? '#ffd23a' : '#ffffff', { mono: true });
        }
      }
      if (u < SLAP.IMPACT) {
        view.text(`${view.pname(s === 0 ? M.a : M.v)} : A = FRAPPE`, HX[s], 210, 10, '#ffd23a', { mono: true, alpha: 0.7 + 0.3 * Math.sin(view.time * 12) });
        view.text(`${view.pname(v === 0 ? M.a : M.v)} : A = SERRE LES DENTS`, HX[v], 210, 10, '#9ae0ff', { mono: true, alpha: 0.7 + 0.3 * Math.sin(view.time * 12) });
      }
    }
    // l'onomatopée de l'impact
    if (X.boom) {
      const b = X.boom, k = (view.time - b.t) / 0.55;
      if (k >= 1) X.boom = null;
      else {
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot); ctx.scale(0.6 + Math.min(1, k * 5) * 0.8, 0.6 + Math.min(1, k * 5) * 0.8); ctx.globalAlpha = 1 - k * k;
        ctx.fillStyle = INK; ctx.beginPath(); for (let n = 0; n < 24; n++) { const a = n * Math.PI / 12, rr = n % 2 ? 34 : 66; ctx.lineTo(Math.cos(a) * rr * 1.25, Math.sin(a) * rr); } ctx.closePath(); ctx.fill();
        ctx.fillStyle = b.crit ? '#ff2a6a' : '#ffe24a'; ctx.beginPath(); for (let n = 0; n < 24; n++) { const a = n * Math.PI / 12, rr = n % 2 ? 28 : 58; ctx.lineTo(Math.cos(a) * rr * 1.25, Math.sin(a) * rr); } ctx.closePath(); ctx.fill();
        view.text(b.txt, 0, 0, 26, '#ffffff', { title: true });
        ctx.restore();
      }
    }
    // le baffomètre, au centre
    {
      const mx = 320, top = 84, bot = 236, hgt = bot - top, MAX = 480;
      view.panel(mx - 20, top - 22, 40, hgt + 44, 'rgba(14,6,22,0.88)', '#ff5a3a');
      view.text('KM/H', mx, top - 12, 8, '#ff5a3a', { mono: true });
      const tube = ctx.createLinearGradient(0, bot, 0, top); tube.addColorStop(0, '#3bdc5a'); tube.addColorStop(0.5, '#ffd23a'); tube.addColorStop(0.8, '#ff5a3a'); tube.addColorStop(1, '#ff1a6a');
      ctx.fillStyle = '#1a0a1a'; ctx.fillRect(mx - 8, top, 16, hgt);
      const cur = g.ph === 'slap' && g.u >= SLAP.IMPACT ? g.cur : g.ph === 'slap' ? -1 : (g.f[0] >= g.f[1] ? 0 : 1);
      if (cur >= 0 && g.f[cur] >= 0) { const v = Math.min(1, X.meter[cur] / MAX); ctx.fillStyle = tube; ctx.fillRect(mx - 8, bot - hgt * v, 16, hgt * v); }
      for (let k = 1; k < 6; k++) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(mx - 8, bot - hgt * k / 6, 6, 1); }
      for (let i = 0; i < 2; i++) {
        if (g.f[i] < 0) continue;
        const yy = bot - hgt * Math.min(1, X.meter[i] / MAX), slot = i === 0 ? M.a : M.v, sx = i === 0 ? mx - 22 : mx + 22;
        ctx.fillStyle = COLORS[slot]; ctx.beginPath(); ctx.moveTo(sx, yy); ctx.lineTo(sx + (i === 0 ? -10 : 10), yy - 6); ctx.lineTo(sx + (i === 0 ? -10 : 10), yy + 6); ctx.closePath(); ctx.fill();
        view.text(String(Math.round(X.meter[i])), sx + (i === 0 ? -14 : 14), yy, 11, COLORS[slot], { align: i === 0 ? 'right' : 'left', mono: true });
      }
      if (g.ph === 'charge') view.text('VS', mx, bot + 30, 22, '#ffffff', { title: true });
    }
    for (let i = 0; i < 2; i++) drawGauge(view, X, W, M, g, i);
    // le verdict
    if (g.ph === 'verdict' && X.verdict) {
      const V = X.verdict, k = view.time - V.t, sc = k < 0.15 ? 2.4 - k / 0.15 * 1.4 : 1 + Math.sin(k * 8) * 0.03;
      ctx.save(); ctx.translate(320, 92); ctx.rotate(-0.05); ctx.scale(sc, sc);
      if (V.w >= 0) {
        const slot = V.w === 0 ? M.a : M.v;
        ctx.fillStyle = INK; ctx.fillRect(-150, -26, 300, 52); ctx.fillStyle = COLORS[slot]; ctx.fillRect(-146, -22, 292, 44);
        view.text(`${view.pname(slot)} GAGNE !`, 0, -6, 26, '#ffffff', { title: true });
        view.text(`${Math.max(V.fa, V.fv)} KM/H CONTRE ${Math.min(V.fa, V.fv)}`, 0, 14, 11, '#ffffff', { mono: true });
      } else { ctx.fillStyle = INK; ctx.fillRect(-120, -22, 240, 44); view.text('ÉGALITÉ PARFAITE', 0, 0, 22, '#ffffff', { title: true }); }
      ctx.restore();
    }
  },

  onEvent(view, ev, W, M) {
    if (!M || !ev.type.startsWith('mgSlap')) return;
    const A = view.audio, X = S(view), g = M.g;
    switch (ev.type) {
      case 'mgSlapLock': {
        const cx = HX[ev.p], by = 287, nx = cx - 92 + (ev.pos / 1000) * 184;
        X.lock[ev.p] = { pos: ev.pos / 1000, k: ev.k, t: view.time };
        if (ev.late) { view.sticker('TROP LENT 🐢', cx, 236, { size: 14, color: '#ffffff', bg: '#7a5a9a', life: 0.8 }); A && A.sfx('wobble', 0, 0.5); break; }
        if (ev.perf) {
          view.burst(nx, by, 24, ['#ffd23a', '#ffffff', '#ff5a3a'], { shape: 'star', speed: 240, size: 6, life: 0.6 });
          view.sticker(view.pick(['PARFAIT ✨', 'PILE-POIL 🎯', 'CHIRURGICAL']), cx, 232, { size: 16, color: INK, bg: '#ffd23a', life: 0.8 });
          view.jolt(0.35, 0.04, '#ffd23a', 0.15); X.ex = Math.min(1, X.ex + 0.4);
          if (A) { A.sfx('hitmark', 0, 0.8); A.sfx('charge', 0, 0.5, 1 + ev.k * 2); }
        } else if (ev.s >= 75) {
          view.burst(nx, by, 14, ['#3bdc5a', '#ffffff'], { shape: 'dot', speed: 180, size: 4, life: 0.5 });
          view.sticker(`+${ev.s}`, nx, 248, { size: 14, color: '#7cff8a', life: 0.6 });
          if (A) { A.sfx('click', 0, 0.7); A.sfx('blip', 0, 0.5, 2 + ev.k * 2); }
        } else {
          view.burst(nx, by, 10, ['#ff3b3b', '#600010'], { speed: 140, size: 4, life: 0.5 });
          view.sticker(ev.s < 30 ? view.pick(['À CÔTÉ 😬', 'MOLLASSON', 'BOF']) : `+${ev.s}`, cx, 236, { size: 13, color: '#ffffff', bg: ev.s < 30 ? '#a00010' : null, life: 0.7 });
          if (A) { A.sfx('click', 0, 0.6); if (ev.s < 30) A.sfx('error', 0, 0.4); }
        }
        if (ev.k === SLAP.STOPS - 1) {
          const P = g.p[ev.p];
          view.sticker(`BAFFE ARMÉE : ${P.pw}`, HX[ev.p], 250, { size: 13, color: '#ffffff', bg: COLORS[ev.p === 0 ? M.a : M.v], life: 0.9 });
          A && A.sfx('powerchord', 0, 0.45);
        }
        break;
      }
      case 'mgSlapWind': {
        const s = ev.p, slot = s === 0 ? M.a : M.v;
        view.sticker(s === 0 ? 'PREMIÈRE BAFFE !' : 'LA REVANCHE !', 320, 338, { size: 20, color: '#ffffff', bg: COLORS[slot], life: 0.9 });
        view.lines(0.4); view.jolt(0.4, 0.05);
        if (A) { A.sfx('whoosh', 0, 0.7); A.say(view.pick(['Attention…', 'Il arme…', 'Ça va claquer !', 'Tendez la joue !']), 0.55, 1.1); A.sfx('charge', 0, 0.6); }
        break;
      }
      case 'mgSlapTime': {
        const i = ev.p, x = HX[i];
        if (ev.r === 0) {
          if (ev.q === 2) { view.sticker('TIMING PARFAIT ⚡', x, 32 + 190, { size: 15, color: INK, bg: '#ffd23a', life: 0.8 }); A && A.sfx('zapS', 0, 0.7); view.jolt(0.3, 0.04, '#ffd23a', 0.2); }
          else if (ev.q === 1) { view.sticker('BIEN LANCÉE', x, 222, { size: 13, color: '#7cff8a', life: 0.6 }); A && A.sfx('click', 0, 0.6); }
          else { view.sticker('TROP TÔT !', x, 222, { size: 14, color: '#ffffff', bg: '#a00010', life: 0.7 }); A && A.sfx('error', 0, 0.5); }
        } else {
          X.h[i].brace = ev.q;
          if (ev.q === 2) { view.sticker('DENTS SERRÉES 😬', x, 222, { size: 15, color: INK, bg: '#9ae0ff', life: 0.8 }); A && A.sfx('parry', 0, 0.7); }
          else if (ev.q === 1) { view.sticker('IL ENCAISSE', x, 222, { size: 13, color: '#9ae0ff', life: 0.6 }); A && A.sfx('wood', 0, 0.6); }
          else { view.sticker('IL A TRESSAILLI 😱', x, 222, { size: 13, color: '#ffffff', bg: '#7a5a9a', life: 0.7 }); A && A.sfx('wobble', 0, 0.5); }
        }
        break;
      }
      case 'mgSlapHit': {
        const s = ev.p, v = 1 - s, out = s === 0 ? -1 : 1, H = X.h[v], f = ev.f, hd = headAt(X, v);
        const cx = hd.x + out * hd.r * 0.62, cy = hd.y + hd.r * 0.2;
        X.taunt[s] = view.time + 0.5; // celui qui a frappé provoque (sa provocation de la sélection)
        H.hit = view.time; H.f = f; H.dir = s === 0 ? 1 : -1; H.cry = 0.45; H.mark = 1;
        X.meter[s] = 0; X.ex = 1;
        const crit = ev.c === 2, big = f >= 300, huge = f >= 400;
        X.boom = { x: cx + out * 6, y: cy - 30, t: view.time, txt: crit ? 'CRITIQUE !' : view.pick(BAM), rot: (Math.random() - 0.5) * 0.4, crit };
        view.jolt(huge ? 1.4 : big ? 1.1 : 0.8, huge ? 0.2 : 0.13, crit ? '#ff2a6a' : '#ffffff', huge ? 0.8 : 0.55);
        view.lines(0.7); view.hype(huge ? 1 : 0.6);
        view.burst(cx, cy, 40, ['#ffe24a', '#ffffff', '#ff5a3a'], { shape: 'star', speed: 340, size: 6, life: 0.7, dir: s === 0 ? 0 : Math.PI, spread: 2.2 });
        view.burst(cx, cy, 3 + Math.floor(f / 120), ['#fff'], { shape: 'txt', ch: '🦷', speed: 260, size: 9, up: 220, life: 1.4, g: 500, dir: s === 0 ? -0.5 : Math.PI + 0.5, spread: 1 });
        view.burst(hd.x, hd.y - 10, 18, ['#9ae0ff', '#c8f0ff', '#ffffff'], { shape: 'dot', speed: 260, size: 5, up: 160, life: 1 });
        view.burst(hd.x, hd.y - hd.r - 10, 5, ['#fff'], { shape: 'txt', ch: '💫', speed: 90, size: 10, up: 60, life: 1.6, g: 40 });
        const tier = huge ? ['BAFFE NUCLÉAIRE ☢️', '#ff1a6a'] : big ? ['BAFFE MONUMENTALE', '#ff5a3a'] : f >= 200 ? ['BELLE BAFFE', '#ff9a2a'] : ['BAFFE MOLLE 🧽', '#7a5a9a'];
        view.sticker(`${f} KM/H`, 320, 186, { size: 30, color: '#ffffff', bg: tier[1], life: 1.1, rot: -0.08 });
        later(view, 0.2, () => view.sticker(tier[0], HX[v], 36, { size: 16, color: '#ffffff', bg: tier[1], life: 1.1 }));
        if (huge) view.emojiRain(['😵', '💫', '🖐️', '😭'], 14);
        if (ev.b === 2) later(view, 0.35, () => view.sticker('IL A TOUT ENCAISSÉ 💪', HX[v], 236, { size: 13, color: '#ffffff', bg: '#2a6aa0', life: 0.8 }));
        if (A) {
          A.sfx('slap', 0, 1); A.sfx('punchHeavy', 0, 0.9); A.sfx('hitL', 0, 0.7);
          if (crit) { A.sfx('airhorn', 0, 0.6); A.sfx('flash', 0, 0.6); }
          if (huge) A.sfx('boom', 0, 0.7);
          A.crowd();
        }
        later(view, 0.1, () => { if (A) { A.sfx('boing', 0, 0.9); A.sfx('boing', 0, 0.6, 3); } view.burst(hd.x, hd.y - 20, 10, ['#ffffff', '#ff4a5a'], { shape: 'dot', speed: 160, size: 4, up: 120, life: 0.5 }); });
        later(view, 0.3, () => { if (A) A.sfx('tongue', 0, 0.8); });
        later(view, 0.55, () => { if (A) { A.sfx('sob', 0, 0.9); A.say(view.pick(['Ouiiin !', 'Maman !', 'Aïe aïe aïe !', 'Snif…', 'Pourquoi ?!']), 0.95, 1.25); } view.sticker('😭', hd.x + out * 60, hd.y - 40, { size: 28, life: 0.9 }); });
        later(view, 1.1, () => { if (A) A.sfx('gurgle', 0, 0.5); view.burst(hd.x, hd.y, 16, ['#7ad0ff', '#c8f0ff'], { shape: 'dot', speed: 200, size: 4, up: 180, life: 0.9 }); });
        break;
      }
      case 'mgSlapVerdict': {
        X.verdict = { w: ev.w, fa: ev.fa, fv: ev.fv, t: view.time };
        if (ev.w >= 0) {
          const l = 1 - ev.w;
          X.h[l].cry = 1.6; X.h[ev.w].cry = 0.7; X.h[ev.w].joy = 1;
          view.confetti(60); view.jolt(0.9, 0.12, COLORS[ev.w === 0 ? M.a : M.v], 0.45); view.hype(1); view.lines(0.5);
          view.emojiRain(['😭', '💧', '😭', '🖐️'], 16);
          view.sticker('LARMES DE JOIE 🥲', HX[ev.w], 36, { size: 14, color: '#ffffff', bg: '#2a8a5a', life: 1.4 });
          later(view, 0.25, () => view.sticker('TORRENTS DE LARMES 😭', HX[l], 36, { size: 14, color: '#ffffff', bg: '#2a6aa0', life: 1.4 }));
          if (A) { A.sfx('airhorn', 0, 0.7); A.sfx('sob', 0, 1); A.sfx('sob', 0, 0.7, 2); A.crowd(); A.say(view.pick(['Quelle baffe !', 'Champion de la baffe !', 'Pleurez, mes amis !']), 0.5, 1.1); }
        } else { X.h[0].cry = 1; X.h[1].cry = 1; if (A) { A.sfx('sob', 0, 1); A.say('Égalité ! Tout le monde pleure.', 0.5, 1.1); } view.emojiRain(['😭', '💧'], 14); }
        break;
      }
      default: break;
    }
  },
};
