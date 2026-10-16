// Impacts de coup façon Smash Ultimate, version propre (refaite le 16 oct. 2026 : les cornes de flamme et les lueurs
// floues faisaient bouillie). Pas d'image à charger : quelques formes nettes dessinées au démarrage en blanc dans des
// canevas (couronne de rayons effilés, étoile à quatre branches, anneau fin, trait de projection, éclat), teintées à
// l'affichage. `hit()` les pose en une très courte séquence (~0,2 s) : éclat blanc, rayons colorés qui jaillissent,
// anneau, éclats projetés dans le sens du coup ; les gros coups ajoutent un trait de projection et un second anneau.
import * as THREE from 'three';
import { addHitTex } from './hitSprites.js';

const SRGB = THREE.SRGBColorSpace;
const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const rng = (a) => () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const toTex = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = SRGB; t.anisotropy = 4; return t; };
const S = 512, O = S / 2;

// ---- une couronne de rayons effilés, longs et courts en alternance, qui partent du centre (blanc : teinté ensuite) ----
function rays(seed, n, longL, shortL) {
  const [c, g] = cv(S, S), R = rng(seed);
  g.fillStyle = '#ffffff';
  g.shadowColor = '#ffffff'; g.shadowBlur = 5;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (R() - 0.5) * 0.28;
    const L = (i % 2 ? shortL : longL) * O * (0.82 + R() * 0.3), r0 = O * 0.07, w = (i % 2 ? 0.05 : 0.075) * (0.85 + R() * 0.3) * O;
    g.save(); g.translate(O, O); g.rotate(a);
    g.beginPath(); g.moveTo(r0, -w); g.quadraticCurveTo(L * 0.45, -w * 0.45, L, 0); g.quadraticCurveTo(L * 0.45, w * 0.45, r0, w); g.closePath(); g.fill();
    g.restore();
  }
  g.shadowBlur = 0;
  g.beginPath(); g.arc(O, O, O * 0.1, 0, 7); g.fill();
  return toTex(c);
}

// ---- l'étoile à quatre branches : le cœur du flash ----
function star4() {
  const [c, g] = cv(S, S);
  const halo = g.createRadialGradient(O, O, 0, O, O, O * 0.34);
  halo.addColorStop(0, 'rgba(255,255,255,0.85)'); halo.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = halo; g.fillRect(0, 0, S, S);
  g.fillStyle = '#ffffff'; g.shadowColor = '#ffffff'; g.shadowBlur = 8;
  const ray = (a, L, w) => { g.save(); g.translate(O, O); g.rotate(a); g.beginPath(); g.moveTo(-L, 0); g.quadraticCurveTo(-L * 0.1, -w * 0.5, 0, -w); g.quadraticCurveTo(L * 0.1, -w * 0.5, L, 0); g.quadraticCurveTo(L * 0.1, w * 0.5, 0, w); g.quadraticCurveTo(-L * 0.1, w * 0.5, -L, 0); g.closePath(); g.fill(); g.restore(); };
  ray(0, O * 0.98, 13); ray(Math.PI / 2, O * 0.98, 13); ray(Math.PI / 4, O * 0.5, 7); ray(-Math.PI / 4, O * 0.5, 7);
  g.beginPath(); g.arc(O, O, 20, 0, 7); g.fill();
  return toTex(c);
}

// ---- un anneau fin et net ----
function ring() {
  const [c, g] = cv(S, S);
  g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 16; g.beginPath(); g.arc(O, O, O * 0.78, 0, 7); g.stroke();
  g.strokeStyle = '#ffffff'; g.lineWidth = 6; g.beginPath(); g.arc(O, O, O * 0.78, 0, 7); g.stroke();
  return toTex(c);
}

// ---- le trait de projection : une lame effilée dans le sens du coup (vers +x, le centre au milieu du sprite) ----
function beam() {
  const [c, g] = cv(S, S);
  g.fillStyle = '#ffffff'; g.shadowColor = '#ffffff'; g.shadowBlur = 6;
  g.beginPath(); g.moveTo(O - O * 0.3, O); g.quadraticCurveTo(O, O - 17, S, O); g.quadraticCurveTo(O, O + 17, O - O * 0.3, O); g.closePath(); g.fill();
  return toTex(c);
}

// ---- un éclat effilé qui file ----
function shard() {
  const [c, g] = cv(128, 128);
  g.fillStyle = '#ffffff';
  g.beginPath(); g.moveTo(4, 64); g.quadraticCurveTo(56, 50, 124, 64); g.quadraticCurveTo(56, 78, 4, 64); g.closePath(); g.fill();
  return toTex(c);
}

// ---- un éclair en ruban blanc (épais, fin, épais), avec des branches : les gros coups électriques ----
function bolt(seed) {
  const W = 1024, H = 256, [c, g] = cv(W, H), R = rng(seed);
  const pts = []; let x = -30, walk = 0;
  while (x < W + 30) { pts.push([x, H / 2 + walk]); x += 30 + R() * 60; walk = Math.max(-70, Math.min(70, walk + (R() - 0.5) * 110)); }
  const ribbon = (P, k) => {
    g.beginPath();
    P.forEach((p, i) => { const w = (2.5 + ((i * 7 + seed) % 5) * 1.6) * k; i ? g.lineTo(p[0], p[1] - w) : g.moveTo(p[0], p[1] - w); });
    for (let i = P.length - 1; i >= 0; i--) { const w = (2.5 + ((i * 7 + seed) % 5) * 1.6) * k; g.lineTo(P[i][0], P[i][1] + w); }
    g.closePath();
  };
  g.fillStyle = '#ffffff'; g.shadowColor = '#ffffff'; g.shadowBlur = 8;
  ribbon(pts, 1); g.fill();
  for (let b = 0; b < 2; b++) {
    const i = 2 + Math.floor(R() * (pts.length - 5)), dir = R() < 0.5 ? -1 : 1, P = [pts[i].slice()];
    for (let j = 0; j < 4; j++) { const q = P[j]; P.push([q[0] + 22 + R() * 30, q[1] + dir * (14 + R() * 24) + (R() - 0.5) * 16]); }
    ribbon(P, 0.6); g.fill();
  }
  g.shadowBlur = 0; g.globalCompositeOperation = 'destination-in';
  const m = g.createLinearGradient(0, 0, W, 0);
  m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(0.15, 'rgba(0,0,0,1)'); m.addColorStop(0.85, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = m; g.fillRect(0, 0, W, H);
  return toTex(c);
}

// ---- une lueur ronde et douce, petite : le chaud autour du point d'impact ----
function dot() {
  const [c, g] = cv(256, 256);
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  return toTex(c);
}

// ---- l'éclaboussure dentelée : le corps de l'impact (pointes inégales, une ou deux très longues, creux marqués) ----
function splat(seed, n, needles) {
  const [c, g] = cv(S, S), R = rng(seed), pts = [];
  for (let j = 0; j < n; j++) {
    const aj = (j / n) * Math.PI * 2 + (R() - 0.5) * 0.35, long = j < needles, tip = long ? 0.96 : 0.5 + R() * 0.34;
    const w = (long ? 0.09 : 0.14 + R() * 0.1) * (6.283 / n) * 3, vr = 0.24 + R() * 0.12;
    pts.push([aj - w, vr], [aj, tip], [aj + w, vr]);
  }
  g.fillStyle = '#ffffff'; g.shadowColor = '#ffffff'; g.shadowBlur = 4;
  g.beginPath();
  pts.forEach(([a, r], i) => { const px = O + Math.cos(a) * r * O * 0.95, py = O + Math.sin(a) * r * O * 0.95; i ? g.lineTo(px, py) : g.moveTo(px, py); });
  g.closePath(); g.fill();
  g.beginPath(); g.arc(O, O, O * 0.3, 0, 7); g.fill();
  return toTex(c);
}

// ---- deux ailes dentelées, de part et d'autre du centre : les gerbes latérales du coup (vers ±x) ----
function wings(seed) {
  const [c, g] = cv(S, S), R = rng(seed);
  g.fillStyle = '#ffffff'; g.shadowColor = '#ffffff'; g.shadowBlur = 4;
  const side = (dir) => {
    const r0 = O * 0.12, L = O * 0.98, top = [], bot = [];
    for (let i = 1; i <= 5; i++) { const t = i / 6; const h = O * 0.2 * Math.sin(Math.PI * Math.pow(t, 0.7)) * (0.7 + R() * 0.5); top.push([r0 + (L - r0) * t, -h * (i % 2 ? 1 : 0.55)]); bot.push([r0 + (L - r0) * t, h * (0.7 + R() * 0.4) * (i % 2 ? 0.6 : 1)]); }
    g.beginPath(); g.moveTo(O + dir * r0, O - O * 0.05);
    for (const [x, y] of top) g.lineTo(O + dir * x, O + y);
    g.lineTo(O + dir * L, O);
    for (let i = bot.length - 1; i >= 0; i--) g.lineTo(O + dir * bot[i][0], O + bot[i][1]);
    g.lineTo(O + dir * r0, O + O * 0.05); g.closePath(); g.fill();
  };
  side(1); side(-1);
  return toTex(c);
}

// ---- un losange effilé (lentille) : les traits qui filent ou se croisent en X ----
function lens() {
  const [c, g] = cv(S, S);
  g.fillStyle = '#ffffff'; g.shadowColor = '#ffffff'; g.shadowBlur = 6;
  g.beginPath(); g.moveTo(O - O * 0.98, O); g.quadraticCurveTo(O, O - 22, O + O * 0.98, O); g.quadraticCurveTo(O, O + 22, O - O * 0.98, O); g.closePath(); g.fill();
  return toTex(c);
}

// ---- l'étoile aiguille : une pointe verticale très longue, une horizontale courte, un croissant autour ----
function starN() {
  const [c, g] = cv(S, S);
  g.fillStyle = '#ffffff'; g.shadowColor = '#ffffff'; g.shadowBlur = 6;
  const sp = (a, L, w) => { g.save(); g.translate(O, O); g.rotate(a); g.beginPath(); g.moveTo(-L, 0); g.quadraticCurveTo(-L * 0.08, -w * 0.5, 0, -w); g.quadraticCurveTo(L * 0.08, -w * 0.5, L, 0); g.quadraticCurveTo(L * 0.08, w * 0.5, 0, w); g.quadraticCurveTo(-L * 0.08, w * 0.5, -L, 0); g.fill(); g.restore(); };
  sp(Math.PI / 2, O * 0.98, 9); sp(0, O * 0.4, 7);
  g.strokeStyle = '#ffffff'; g.lineWidth = 6; g.lineCap = 'round';
  g.beginPath(); g.arc(O, O, O * 0.3, Math.PI * 0.62, Math.PI * 1.38); g.stroke();
  g.beginPath(); g.arc(O, O, O * 0.3, -Math.PI * 0.38, Math.PI * 0.38); g.stroke();
  return toTex(c);
}

let READY = false;
export function initSsbuTex() {
  if (READY) return; READY = true;
  addHitTex('rays_a', rays(11, 16, 1, 0.55)); addHitTex('rays_b', rays(29, 12, 1, 0.5)); addHitTex('rays_s', rays(41, 8, 0.9, 0.55));
  addHitTex('star4', star4()); addHitTex('ring_n', ring()); addHitTex('beam', beam()); addHitTex('shard', shard());
  addHitTex('splat_a', splat(7, 9, 1)); addHitTex('splat_b', splat(19, 11, 2)); addHitTex('splat_c', splat(33, 8, 1)); addHitTex('wings_a', wings(5)); addHitTex('wings_b', wings(13)); addHitTex('lens', lens()); addHitTex('star_n', starN());
  addHitTex('bolt_a', bolt(5)); addHitTex('bolt_b', bolt(9)); addHitTex('dot', dot());
}

// les couleurs de chaque style : out = les rayons, hot = le cœur, ring = l'anneau, bolt = les éclairs
const STYLE = {
  normal: { rim: '#ff7a14', mid: '#ffd531', hot: '#fffbe0', ring: '#ffffff', acc: '#ff3a2a', bolt: '#ffe27a' },
  elec: { rim: '#ff2a4a', mid: '#ffd531', hot: '#ffffff', ring: '#ffffff', acc: '#ff2a4a', bolt: '#ffffff' },
  magic: { rim: '#a040ff', mid: '#ff9ae8', hot: '#fff0fb', ring: '#ffd0f4', acc: '#6ad0ff', bolt: '#d890ff' },
  fire: { rim: '#ff3512', mid: '#ff9a2a', hot: '#fff0c8', ring: '#ffd9a0', acc: '#ffd531', bolt: '#ffb040' },
  purple: { rim: '#5a2dff', mid: '#b090ff', hot: '#f4ecff', ring: '#d6c4ff', acc: '#ff6ad8', bolt: '#b890ff' },
};

export class SsbuFx {
  constructor(particles) { initSsbuTex(); this.P = particles; this.q = []; this.seq = 0; }

  at(delay, fn) { if (delay <= 0) fn(); else this.q.push({ t: delay, fn }); }

  update(dt) {
    if (!this.q.length) return;
    let w = 0;
    for (const o of this.q) { o.t -= dt; if (o.t <= 0) o.fn(); else this.q[w++] = o; }
    this.q.length = w;
  }

  clear() { this.q.length = 0; }

  // x, y, z : l'impact ; ang : l'angle de l'éjection (radians, 0 = vers +x) ; tier : 0 petit, 1 moyen, 2 gros ; k : taille
  hit(x, y, z, { ang = 0.8, tier = 1, style = 'normal', k = 1 } = {}) {
    const H = this.P.hit, st = STYLE[style] || STYLE.normal, n = ++this.seq;
    const z0 = z + 0.35, sz = (tier === 0 ? 0.85 : tier === 1 ? 1.45 : 2.1) * k;
    const rot = n * 1.1, splat = ['splat_a', 'splat_b', 'splat_c'][n % 3];
    const shards = (cnt, spread, spd, size, life) => {
      for (let i = 0; i < cnt; i++) {
        const a = ang + (i / Math.max(1, cnt - 1) - 0.5) * spread + ((n * 7 + i * 3) % 5 - 2) * 0.07, sp = spd * (0.8 + (i % 3) * 0.25);
        H.spawn('shard', x + Math.cos(a) * sz * 0.15, y + Math.sin(a) * sz * 0.15, z0 + 0.03, size, a, life, i % 2 ? st.hot : st.mid, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, add: true });
      }
    };
    // le corps de l'impact : trois éclaboussures empilées (liseré sombre, corps clair, cœur blanc), nettes, qui jaillissent
    const body = (size, life) => {
      H.spawn(splat, x, y, z0 - 0.02, size, rot, life, st.rim, { anim: 'slam' });
      H.spawn(splat, x, y, z0, size * 0.82, rot, life, st.mid, { anim: 'slam' });
      H.spawn(splat, x, y, z0 + 0.02, size * 0.5, rot + 0.5, life * 0.9, st.hot, { anim: 'slam' });
    };
    H.spawn('star4', x, y, z0 + 0.06, sz * (tier === 0 ? 1.0 : 1.3), rot * 0.3, tier === 0 ? 0.1 : 0.13, st.hot, { anim: 'flash', add: true });
    if (tier === 0) {
      body(sz * 1.35, 0.1);
      shards(3, 2.4, 4.5, sz * 0.3, 0.16);
      return;
    }
    body(sz * 2.0, 0.14);
    // les ailes qui filent de part et d'autre, dans l'axe du coup, et un trait fin
    H.spawn(n % 2 ? 'wings_a' : 'wings_b', x, y, z0 + 0.03, sz * 2.3, ang, 0.15, st.acc, { anim: 'flash', add: true });
    H.spawn('lens', x, y, z0 + 0.04, sz * 2.0, ang + 0.0, 0.12, st.hot, { anim: 'flash', add: true });
    H.spawn('ring_n', x, y, z0, sz * 0.8, 0, 0.2, st.ring, { anim: 'ring', grow: 2.1, add: true });
    this.at(0.03, () => shards(tier === 1 ? 5 : 8, 2.2, 6.5, sz * 0.3, 0.2));
    this.at(0.1, () => H.spawn('smoke', x, y + 0.1, z0 - 0.2, sz * 0.3, n, 0.36, '#ffffff', { soft: true, spin: 0.4 }));
    if (tier >= 2) {
      // le gros coup : la croix de deux lames blanches, l'étoile aiguille, le trait de projection, un second anneau, des éclairs en électrique
      for (const d of [Math.PI / 4, -Math.PI / 4]) H.spawn('lens', x, y, z0 + 0.06, sz * 2.4, d + ang * 0.15, 0.14, st.hot, { anim: 'flash', add: true });
      H.spawn('star_n', x, y, z0 + 0.07, sz * 1.9, ang - Math.PI / 2, 0.14, st.hot, { anim: 'flash', add: true });
      H.spawn('beam', x, y, z0 + 0.04, sz * 3.2, ang, 0.14, st.mid, { anim: 'flash', add: true });
      this.at(0.05, () => H.spawn('ring_n', x, y, z0, sz * 0.7, 0, 0.26, st.rim, { anim: 'ring', grow: 2.8, add: true }));
      if (style === 'elec') for (let i = 0; i < 2; i++) this.at(0.02 + i * 0.05, () => H.spawn(i ? 'bolt_b' : 'bolt_a', x, y, z0 + 0.08, sz * 1.6, ang + (i ? 1 : -1) * 0.5, 0.16, st.bolt, { anim: 'flash', add: true }));
    }
  }
}
