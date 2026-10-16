// Impacts à la Smash Ultimate (d'après le « Visual Effect Dictionary » : sys_hit_normal, sys_hit_elec, sys_hit_magic…).
// Pas d'image à charger : tout est dessiné au démarrage dans des canevas (cornes de flamme dentelées au liseré orange,
// éclairs blancs à la lueur rouge, étoile blanche, anneaux, éclats bleus) puis posé en sprites par `hit()`, en une courte
// séquence (flash blanc, cornes, anneau, éclats, fumée : ~0,35 s) qui se règle sur la force du coup et le style.
import * as THREE from 'three';
import { addHitTex } from './hitSprites.js';

const SRGB = THREE.SRGBColorSpace;
const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const rng = (a) => () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const toTex = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = SRGB; t.anisotropy = 4; return t; };

// les palettes : rim = le liseré qui rougeoie, hi / mid / edge = le dégradé de la forme (du centre vers les pointes)
const PAL = {
  yellow: { rim: '#ff8a14', hi: '#ffffff', mid: '#fff59a', edge: '#ffd531' },
  magic: { rim: '#b24cff', hi: '#ffffff', mid: '#fff08a', edge: '#e79bff' },
  blue: { rim: '#2d6bff', hi: '#f2fbff', mid: '#a6dcff', edge: '#5aaaff' },
  fire: { rim: '#ff3512', hi: '#fff6c8', mid: '#ffc232', edge: '#ff7b1f' },
  purple: { rim: '#6b2dff', hi: '#ffffff', mid: '#c9a0ff', edge: '#7a5cff' },
};

// ---- des cornes de flamme en éventail (sys_hit_normal_l), la pointe vers le haut : on tourne le sprite pour viser ----
function spikes(pal, seed) {
  const S = 512, [c, g] = cv(S, S), R = rng(seed), ox = S / 2, oy = S * 0.76;
  const list = [];
  // tall narrow horns that curl outward like flames, a few needles low down, two small wings
  const fan = [[-76, 0.4], [-54, 0.6], [-31, 0.74], [-9, 0.92], [13, 0.82], [34, 0.68], [56, 0.56], [77, 0.42]];
  for (const [a, l] of fan) list.push({ a: a + (R() - 0.5) * 8, L: l * S * 0.66 * (0.94 + R() * 0.12), w: 0.085 + R() * 0.035, bow: (a < 0 ? -1 : 1) * (0.45 + R() * 0.55), big: 1 });
  for (let i = 0; i < 11; i++) list.push({ a: -80 + i * 16 + (R() - 0.5) * 7, L: (0.1 + R() * 0.17) * S, w: 0.04 + R() * 0.025, bow: (R() - 0.5) * 0.3 });
  list.push({ a: -104, L: 0.18 * S, w: 0.11, bow: -0.4 }, { a: 104, L: 0.18 * S, w: 0.11, bow: 0.4 });
  const shapes = [];
  const horn = (px, py, a, L, w, bow) => {
    const r = a * Math.PI / 180, dx = Math.sin(r), dy = -Math.cos(r), qx = Math.cos(r), qy = Math.sin(r), bw = L * w;
    const tx = px + dx * L + qx * bow * L * 0.3, ty = py + dy * L + qy * bow * L * 0.3;
    shapes.push(() => {
      g.beginPath();
      g.moveTo(px + qx * bw, py + qy * bw);
      g.quadraticCurveTo(px + dx * L * 0.55 + qx * (bw * 0.85 + bow * L * 0.25), py + dy * L * 0.55 + qy * (bw * 0.85 + bow * L * 0.25), tx, ty);
      g.quadraticCurveTo(px + dx * L * 0.5 + qx * (-bw * 0.4 + bow * L * 0.18), py + dy * L * 0.5 + qy * (-bw * 0.4 + bow * L * 0.18), px - qx * bw, py - qy * bw);
      g.closePath();
    });
  };
  for (const s of list) {
    horn(ox, oy, s.a, s.L, s.w, s.bow);
    // a small prong on the side of the big horns: the ragged look of the originals
    if (s.big && s.L > 0.4 * S) {
      const r = s.a * Math.PI / 180, k = 0.4, side = s.a < 0 ? -1 : 1;
      horn(ox + Math.sin(r) * s.L * k, oy - Math.cos(r) * s.L * k, s.a + side * (34 + R() * 14), s.L * 0.36, 0.1, side * 0.5);
    }
  }
  g.lineJoin = 'round';
  g.shadowColor = pal.rim; g.shadowBlur = 26; g.strokeStyle = pal.rim; g.lineWidth = 13;
  for (const sh of shapes) { sh(); g.stroke(); }
  g.shadowBlur = 0;
  const gr = g.createRadialGradient(ox, oy, 4, ox, oy, S * 0.58);
  gr.addColorStop(0, pal.hi); gr.addColorStop(0.3, pal.mid); gr.addColorStop(1, pal.edge);
  g.fillStyle = gr;
  for (const sh of shapes) { sh(); g.fill(); }
  const hot = g.createRadialGradient(ox, oy, 0, ox, oy, 60);
  hot.addColorStop(0, 'rgba(255,255,255,1)'); hot.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = hot; g.fillRect(ox - 70, oy - 70, 140, 140);
  return toTex(c);
}

// ---- un éclair en ruban blanc (épais, fin, épais) à la lueur colorée, avec des branches ----
function bolt(glow, seed) {
  const W = 1024, H = 256, [c, g] = cv(W, H), R = rng(seed);
  const pts = []; let x = -30, y = H / 2, walk = 0;
  while (x < W + 30) { pts.push([x, H / 2 + walk]); x += 28 + R() * 62; walk = Math.max(-78, Math.min(78, walk + (R() - 0.5) * 120)); }
  const ribbon = (P, k) => {
    g.beginPath();
    P.forEach((p, i) => { const w = (3 + ((i * 7 + seed) % 5) * 2.2 + (i % 3 === 0 ? 5 : 0)) * k; i ? g.lineTo(p[0], p[1] - w) : g.moveTo(p[0], p[1] - w); });
    for (let i = P.length - 1; i >= 0; i--) { const w = (3 + ((i * 7 + seed) % 5) * 2.2 + (i % 3 === 0 ? 5 : 0)) * k; g.lineTo(P[i][0], P[i][1] + w); }
    g.closePath();
  };
  const branches = [];
  for (let b = 0; b < 3; b++) {
    const i = 2 + Math.floor(R() * (pts.length - 5)), dir = R() < 0.5 ? -1 : 1, P = [pts[i].slice()];
    for (let j = 0; j < 4; j++) { const q = P[j]; P.push([q[0] + 22 + R() * 30, q[1] + dir * (14 + R() * 24) + (R() - 0.5) * 16]); }
    branches.push(P);
  }
  g.shadowColor = glow; g.shadowBlur = 34; g.fillStyle = glow;
  ribbon(pts, 2.4); g.fill(); for (const P of branches) { ribbon(P, 1.6); g.fill(); }
  g.shadowBlur = 8; g.shadowColor = '#ffffff'; g.fillStyle = '#ffffff';
  ribbon(pts, 1); g.fill(); for (const P of branches) { ribbon(P, 0.6); g.fill(); }
  g.shadowBlur = 0; g.globalCompositeOperation = 'destination-in';
  const m = g.createLinearGradient(0, 0, W, 0);
  m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(0.12, 'rgba(0,0,0,1)'); m.addColorStop(0.88, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = m; g.fillRect(0, 0, W, H);
  return toTex(c);
}

// ---- la nappe rouge à cœur noir qui file derrière les éclairs (sys_hit_elec) ----
function sheet(seed) {
  const W = 1024, H = 256, [c, g] = cv(W, H), R = rng(seed);
  const lens = (hh, jag) => {
    g.beginPath(); g.moveTo(0, H / 2);
    for (let i = 1; i <= 24; i++) { const t = i / 24, e = Math.sin(t * Math.PI), j = (i % 2 ? 1 : 0.55) * jag * (0.5 + R() * 0.8); g.lineTo(t * W, H / 2 - (hh * e + j * e)); }
    for (let i = 24; i >= 0; i--) { const t = i / 24, e = Math.sin(t * Math.PI), j = (i % 2 ? 1 : 0.55) * jag * (0.5 + R() * 0.8); g.lineTo(t * W, H / 2 + (hh * e * 0.8 + j * e)); }
    g.closePath();
  };
  g.shadowColor = '#ff1c3c'; g.shadowBlur = 36;
  const gr = g.createLinearGradient(0, 0, W, 0);
  gr.addColorStop(0, 'rgba(255,40,70,0)'); gr.addColorStop(0.3, 'rgba(255,40,70,0.85)'); gr.addColorStop(0.5, 'rgba(255,60,90,0.95)'); gr.addColorStop(0.7, 'rgba(255,40,70,0.85)'); gr.addColorStop(1, 'rgba(255,40,70,0)');
  g.fillStyle = gr; lens(40, 18); g.fill();
  g.shadowBlur = 0; g.fillStyle = 'rgba(22,0,12,0.88)'; lens(13, 5); g.fill();
  return toTex(c);
}

// ---- l'étoile blanche à quatre branches : le cœur du flash ----
function star4() {
  const S = 512, [c, g] = cv(S, S), o = S / 2;
  const halo = g.createRadialGradient(o, o, 0, o, o, o);
  halo.addColorStop(0, 'rgba(255,255,255,1)'); halo.addColorStop(0.1, 'rgba(210,245,255,0.85)'); halo.addColorStop(0.35, 'rgba(110,200,255,0.25)'); halo.addColorStop(1, 'rgba(110,200,255,0)');
  g.fillStyle = halo; g.fillRect(0, 0, S, S);
  const ray = (a, L, w) => { g.save(); g.translate(o, o); g.rotate(a); g.beginPath(); g.moveTo(-L, 0); g.quadraticCurveTo(-L * 0.12, -w * 0.5, 0, -w); g.quadraticCurveTo(L * 0.12, -w * 0.5, L, 0); g.quadraticCurveTo(L * 0.12, w * 0.5, 0, w); g.quadraticCurveTo(-L * 0.12, w * 0.5, -L, 0); g.closePath(); g.fill(); g.restore(); };
  g.shadowColor = '#bfefff'; g.shadowBlur = 18; g.fillStyle = '#ffffff';
  ray(0, 250, 16); ray(Math.PI / 2, 250, 16); ray(Math.PI / 4, 150, 9); ray(-Math.PI / 4, 150, 9);
  g.beginPath(); g.arc(o, o, 30, 0, 7); g.fill();
  return toTex(c);
}

// ---- la balafre rouge en diagonale à halo rouge (le premier instant de sys_hit_normal_s) ----
function redslash() {
  const S = 512, [c, g] = cv(S, S), o = S / 2;
  const halo = g.createRadialGradient(o, o, 0, o, o, 200);
  halo.addColorStop(0, 'rgba(255,40,50,0.95)'); halo.addColorStop(0.5, 'rgba(255,20,40,0.5)'); halo.addColorStop(1, 'rgba(255,20,40,0)');
  g.fillStyle = halo; g.fillRect(0, 0, S, S);
  g.save(); g.translate(o, o); g.rotate(-Math.PI / 4);
  g.shadowColor = '#ff1030'; g.shadowBlur = 24;
  g.fillStyle = '#ff2038'; g.beginPath(); g.moveTo(-240, 0); g.lineTo(0, -15); g.lineTo(240, 0); g.lineTo(0, 15); g.closePath(); g.fill();
  g.shadowBlur = 0; g.fillStyle = '#ffd9de'; g.beginPath(); g.moveTo(-200, 0); g.lineTo(0, -6); g.lineTo(200, 0); g.lineTo(0, 6); g.closePath(); g.fill();
  g.restore();
  g.fillStyle = '#ffffff'; g.shadowColor = '#ff3050'; g.shadowBlur = 16;
  for (const a of [0, Math.PI / 2]) { g.save(); g.translate(o, o); g.rotate(a); g.beginPath(); g.moveTo(-70, 0); g.lineTo(0, -9); g.lineTo(70, 0); g.lineTo(0, 9); g.closePath(); g.fill(); g.restore(); }
  return toTex(c);
}

// ---- deux lames blanches en croix et l'arc de cercle qui les entoure (le gros impact de sys_hit_elec) ----
function xslash() {
  const S = 512, [c, g] = cv(S, S), o = S / 2;
  g.shadowColor = '#ffffff'; g.shadowBlur = 22; g.fillStyle = '#ffffff';
  for (const a of [Math.PI / 4, -Math.PI / 4 + 0.06]) { g.save(); g.translate(o, o); g.rotate(a); g.beginPath(); g.moveTo(-250, 0); g.lineTo(-20, -9); g.lineTo(0, -13); g.lineTo(20, -9); g.lineTo(250, 0); g.lineTo(20, 9); g.lineTo(0, 13); g.lineTo(-20, 9); g.closePath(); g.fill(); g.restore(); }
  g.strokeStyle = '#ffffff'; g.lineWidth = 9; g.lineCap = 'round';
  g.beginPath(); g.arc(o, o, 108, Math.PI * 0.62, Math.PI * 1.55); g.stroke();
  g.lineWidth = 4; g.beginPath(); g.arc(o, o, 128, Math.PI * 1.65, Math.PI * 2.25); g.stroke();
  return toTex(c);
}

// ---- l'anneau blanc au liseré rouge (la vague du coup) ----
function ringW() {
  const S = 512, [c, g] = cv(S, S), o = S / 2;
  g.shadowColor = '#ff2a2a'; g.shadowBlur = 30; g.strokeStyle = '#ff3a3a'; g.lineWidth = 24;
  g.beginPath(); g.arc(o, o, 190, 0, 7); g.stroke();
  g.shadowBlur = 6; g.shadowColor = '#fff'; g.strokeStyle = '#ffffff'; g.lineWidth = 9;
  g.beginPath(); g.arc(o, o, 190, 0, 7); g.stroke();
  return toTex(c);
}

// ---- les anneaux penchés qui tournent autour de l'impact (blanc-turquoise, ou irisés pour la magie) ----
function ringE(iri) {
  const S = 512, [c, g] = cv(S, S), o = S / 2;
  g.translate(o, o); g.rotate(-0.32);
  const ell = (rx, ry, col, w, blur) => { g.shadowColor = col; g.shadowBlur = blur; g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, 7); g.stroke(); };
  if (iri) {
    ell(236, 86, '#ff7ad8', 7, 14); ell(224, 78, '#7affd8', 5, 10); ell(212, 70, '#7ab4ff', 5, 10); ell(190, 60, '#fff3a0', 4, 8);
  } else { ell(236, 88, '#a6fbff', 8, 20); g.shadowBlur = 0; ell(236, 88, '#ffffff', 3, 0); ell(206, 70, '#7be8ff', 4, 12); }
  return toTex(c);
}

function shard(col) {
  const [c, g] = cv(128, 48);
  g.shadowColor = col; g.shadowBlur = 10;
  const gr = g.createLinearGradient(0, 0, 128, 0); gr.addColorStop(0, col); gr.addColorStop(0.55, '#ffffff'); gr.addColorStop(1, col);
  g.fillStyle = gr; g.beginPath(); g.moveTo(6, 24); g.quadraticCurveTo(50, 10, 122, 24); g.quadraticCurveTo(50, 38, 6, 24); g.closePath(); g.fill();
  return toTex(c);
}

function sparkle(col) {
  const S = 128, [c, g] = cv(S, S), o = S / 2;
  const h = g.createRadialGradient(o, o, 0, o, o, o); h.addColorStop(0, col); h.addColorStop(1, 'rgba(255,255,255,0)');
  g.globalAlpha = 0.5; g.fillStyle = h; g.fillRect(0, 0, S, S); g.globalAlpha = 1;
  g.shadowColor = col; g.shadowBlur = 8; g.fillStyle = '#ffffff';
  for (const a of [0, Math.PI / 2]) { g.save(); g.translate(o, o); g.rotate(a); g.beginPath(); g.moveTo(-60, 0); g.quadraticCurveTo(-6, -4, 0, -10); g.quadraticCurveTo(6, -4, 60, 0); g.quadraticCurveTo(6, 4, 0, 10); g.quadraticCurveTo(-6, 4, -60, 0); g.fill(); g.restore(); }
  return toTex(c);
}

let READY = false;
export function initSsbuTex() {
  if (READY) return; READY = true;
  addHitTex('sp_yellow', spikes(PAL.yellow, 11)); addHitTex('sp_yellow2', spikes(PAL.yellow, 29));
  addHitTex('sp_magic', spikes(PAL.magic, 17)); addHitTex('sp_blue', spikes(PAL.blue, 23)); addHitTex('sp_fire', spikes(PAL.fire, 31)); addHitTex('sp_purple', spikes(PAL.purple, 37));
  addHitTex('bolt_red', bolt('#ff2a4a', 5)); addHitTex('bolt_red2', bolt('#ff2a4a', 9)); addHitTex('bolt_teal', bolt('#4fe8ff', 13)); addHitTex('bolt_purple', bolt('#c060ff', 19));
  addHitTex('sheet', sheet(3)); addHitTex('star4', star4()); addHitTex('redslash', redslash()); addHitTex('xslash', xslash());
  addHitTex('ringW', ringW()); addHitTex('ringE', ringE(false)); addHitTex('ringI', ringE(true));
  addHitTex('shard_b', shard('#4fb4ff')); addHitTex('shard_w', shard('#ffffff')); addHitTex('shard_y', shard('#ffe27a'));
  addHitTex('sparkle_y', sparkle('#ffe97a')); addHitTex('sparkle_p', sparkle('#e07aff')); addHitTex('sparkle_g', sparkle('#8affc4'));
}

// style : 'normal' (jaune), 'elec', 'magic' (arc-en-ciel), 'fire', 'purple'
const STYLE = {
  normal: { sp: ['sp_yellow', 'sp_yellow2'], ring: 'ringW', shard: ['shard_b', 'shard_w'], bolt: null },
  elec: { sp: ['sp_yellow', 'sp_yellow2'], ring: 'ringW', shard: ['shard_w', 'shard_b'], bolt: ['bolt_red', 'bolt_red2'], sheet: 1 },
  magic: { sp: ['sp_magic'], ring: 'ringI', shard: ['shard_y', 'shard_w'], bolt: null, spark: ['sparkle_y', 'sparkle_p', 'sparkle_g'] },
  fire: { sp: ['sp_fire'], ring: 'ringW', shard: ['shard_y'], bolt: null },
  purple: { sp: ['sp_purple'], ring: 'ringE', shard: ['shard_b'], bolt: ['bolt_purple'] },
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
  hit(x, y, z, { ang = 0.8, tier = 1, style = 'normal', k = 1, rainbow = false } = {}) {
    const H = this.P.hit, st = STYLE[style] || STYLE.normal, n = ++this.seq;
    const big = tier >= 2, z0 = z + 0.35, sz = (tier === 0 ? 1.0 : tier === 1 ? 1.7 : 2.5) * k;
    const rot = ang - Math.PI / 2, dx = Math.cos(ang), dy = Math.sin(ang);
    const spin = (n % 2 ? 1 : -1);
    // 0 : le flash blanc et l'anneau, tout de suite
    H.spawn('star4', x, y, z0 + 0.05, sz * 0.9, n * 1.3, 0.14, null, { anim: 'flash' });
    H.spawn(st.ring, x, y, z0, sz * 0.75, 0, 0.22, null, { anim: 'ring', grow: 1.7 });
    // 1 : les cornes de flamme, dans le sens de l'éjection
    this.at(0.012, () => H.spawn(st.sp[n % st.sp.length], x, y + Math.sin(ang) * sz * 0.0, z0 + 0.02, sz * 1.75, rot, tier === 0 ? 0.2 : 0.3, null, { anim: 'slam' }));
    if (tier >= 1) {
      // 2 : la balafre rouge, l'anneau penché, les éclats
      this.at(0.025, () => H.spawn('redslash', x, y, z0 + 0.04, sz * 0.8, ang * 0 + (n % 2 ? 0 : Math.PI / 2), 0.15, null, { anim: 'flash' }));
      this.at(0.07, () => {
        H.spawn(style === 'magic' ? 'ringI' : 'ringE', x, y, z0 + 0.02, sz * 0.95, spin * (0.3 + (n % 5) * 0.2), 0.3, null, { anim: 'ring', grow: 1.5 });
        const cnt = big ? 7 : 4;
        for (let i = 0; i < cnt; i++) {
          const a = ang + (i / (cnt - 1) - 0.5) * 2.1 + ((n * 7 + i * 3) % 5 - 2) * 0.08, sp = 4 + (i % 3) * 2.2;
          H.spawn(st.shard[i % st.shard.length], x + Math.cos(a) * sz * 0.2, y + Math.sin(a) * sz * 0.2, z0 + 0.03, sz * 0.32, a, 0.26, null, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, add: true });
        }
      });
      if (st.spark) this.at(0.05, () => { for (let i = 0; i < (big ? 7 : 4); i++) { const a = (i + n) * 2.4, r = sz * (0.25 + (i % 3) * 0.17); H.spawn(st.spark[i % st.spark.length], x + Math.cos(a) * r, y + Math.sin(a) * r, z0 + 0.06, sz * (0.28 + (i % 2) * 0.12), 0, 0.3, null, { anim: 'flash', add: true, spin: 2 }); } });
      this.at(0.12, () => { for (let i = 0; i < 2; i++) H.spawn('smoke', x + (i - 0.5) * sz * 0.35, y + 0.1 + i * 0.2, z0 - 0.2, sz * 0.28, i * 2, 0.4, '#ffffff', { soft: true, spin: (i - 0.5) }); });
    }
    if (big) {
      // 3 : le gros coup : la croix blanche, et en électrique les nappes rouges et les éclairs en travers
      this.at(0.0, () => H.spawn('xslash', x, y, z0 + 0.08, sz * 1.1, 0.0, 0.2, null, { anim: 'flash' }));
      if (st.sheet) {
        for (let i = 0; i < 2; i++) this.at(0.01 + i * 0.03, () => H.spawn('sheet', x, y + (i ? -0.15 : 0.1) * sz, z0 - 0.05, sz * 1.5, (i ? -1 : 1) * 0.07, 0.22, null, { anim: 'flash' }));
      }
      if (st.bolt) {
        for (let i = 0; i < 2; i++) this.at(0.02 + i * 0.05, () => H.spawn(st.bolt[i % st.bolt.length], x, y + (i ? -0.3 : 0.25) * sz, z0 + 0.07, sz * 1.7, (i ? -1 : 1) * 0.12, 0.2, null, { anim: 'flash' }));
      }
    }
  }
}
