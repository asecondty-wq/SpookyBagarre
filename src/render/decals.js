// Persistent stains: a canvas mapped on the top of each platform, in the platform's local frame (so stains turn with a
// spinning platform), and a band around the side of the main one (the blood that runs down its edge). Blood, ketchup,
// cheese, the 49.3 stamp, bloody footprints...
// Blood is fresh when it lands (bright, glossy: a second canvas drives the roughness), then dries: it darkens and
// goes matte over ~20 s (dry()).
import * as THREE from 'three';
import { STYLE } from './style.js';

const TAU = Math.PI * 2;

function canvasTex(w, h, fill) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (fill) { g.fillStyle = fill; g.fillRect(0, 0, w, h); }
  const t = new THREE.CanvasTexture(c);
  t.minFilter = THREE.LinearFilter;
  return { c, g, t };
}

// the stain layer's material: lit like the floor; in the smooth look, wet where the wet canvas is dark
function stainMat(tex, wet, o = {}) {
  const base = { map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, ...o };
  if (wet) return new THREE.MeshStandardMaterial({ ...base, roughnessMap: wet, roughness: 1, metalness: 0 });
  return new THREE.MeshLambertMaterial(base);
}

// a blob that never looks drawn with a compass
function blob(g, x, y, r, n = 13, rough = 0.28) {
  g.beginPath();
  const ph = Math.random() * TAU;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU, k = 1 + rough * (Math.sin(a * 3 + ph) * 0.5 + (Math.random() - 0.5));
    const px = x + Math.cos(a) * r * k, py = y + Math.sin(a) * r * k;
    if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
  }
  g.closePath();
}

export class Decals {
  // radius: the platform's; size: the canvas width (px); band: only a strip that deep (m) along the line of the fight,
  // sharper for the same canvas (a platform that does not spin: the fight never leaves that strip)
  constructor(radius, size = 512, band = 0) {
    this.R = radius;
    this.hx = radius; this.hz = band ? band / 2 : radius;
    this.W = size; this.H = Math.round(size * this.hz / this.hx);
    this.size = size;
    this.k = this.W / (2 * this.hx); // px per metre
    const C = canvasTex(this.W, this.H);
    this.canvas = C.c; this.g = C.g; this.tex = C.t;
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.magFilter = STYLE.smooth ? THREE.LinearFilter : THREE.NearestFilter;
    if (STYLE.smooth) { const Wt = canvasTex(this.W, this.H, '#ffffff'); this.wc = Wt.g; this.wtex = Wt.t; }
    this.dirty = false;
    this.angle = 0; this.cx = 0; this.cz = 0;
    const geo = band ? new THREE.PlaneGeometry(2 * this.hx, 2 * this.hz) : new THREE.CircleGeometry(radius, 48);
    this.mesh = new THREE.Mesh(geo, stainMat(this.tex, this.wtex));
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.renderOrder = 2;
    this.mesh.receiveShadow = true;
    this.amount = 0;
    this.t = 0; this.wetUntil = -1; this.dryT = 0; this.upAt = 0;
  }

  // world -> canvas pixel (platform local frame)
  toPx(x, z) {
    const dx = x - this.cx, dz = z - this.cz;
    const c = Math.cos(-this.angle), s = Math.sin(-this.angle);
    const lx = dx * c + dz * s, lz = -dx * s + dz * c;
    // the mesh after rotation.x=-PI/2: u from x, v from -z
    return [(lx / (2 * this.hx) + 0.5) * this.W, (lz / (2 * this.hz) + 0.5) * this.H];
  }

  inside(x, z) {
    if (Math.hypot(x - this.cx, z - this.cz) >= this.R) return false;
    if (this.hz < this.R) { const [, py] = this.toPx(x, z); return py > 1 && py < this.H - 1; }
    return true;
  }

  // a fresh stain: painted, and marked wet (glossy) on the wet canvas
  fresh(draw) {
    const g = this.g;
    draw(g, false);
    if (this.wc) draw(this.wc, true);
    this.dirty = true;
    this.wetUntil = this.t + 30;
  }

  // dir: [vx, vz] of the drop that made it: its spatters fly on that way, stretched
  splat(x, z, size = 1, color = '#7a0008', drips = true, dir = null) {
    if (!this.inside(x, z)) return;
    const [px, py] = this.toPx(x, z);
    const k = this.k * 0.18 * size;
    const r0 = k * (0.8 + Math.random() * 0.6);
    let da = 0, stretch = 0;
    if (dir) { const [ax, ay] = this.toPx(x + dir[0], z + dir[1]); da = Math.atan2(ay - py, ax - px); stretch = Math.min(1.6, Math.hypot(dir[0], dir[1]) * 0.12); }
    const n = drips ? 3 + Math.floor(Math.random() * 5) : (stretch > 0.3 ? 1 + Math.floor(Math.random() * 2) : 0);
    const sat = [];
    for (let i = 0; i < n; i++) {
      const a = dir ? da + (Math.random() - 0.5) * 1.1 : Math.random() * TAU, d = k * (1 + Math.random() * (2.2 + stretch));
      sat.push([px + Math.cos(a) * d, py + Math.sin(a) * d, k * (0.2 + Math.random() * 0.4), a]);
    }
    this.fresh((g, wet) => {
      g.fillStyle = wet ? '#1c1c1c' : color;
      g.globalAlpha = wet ? 1 : 0.88;
      g.save(); g.translate(px, py); g.rotate(da); g.scale(1 + stretch * 0.6, 1);
      blob(g, 0, 0, r0); g.fill();
      g.restore();
      for (const [sx, sy, sr, a] of sat) { g.beginPath(); g.ellipse(sx, sy, sr * (1 + stretch), sr, a, 0, TAU); g.fill(); }
      g.globalAlpha = 1;
    });
    this.amount += size;
  }

  // a big pool of blood (KO landings, gore)
  pool(x, z, size = 3, color = '#5e0006') {
    if (!this.inside(x, z)) return;
    const [px, py] = this.toPx(x, z);
    const k = this.k * 0.3 * size;
    const parts = [];
    for (let i = 0; i < 9; i++) {
      const a = Math.random() * TAU, d = Math.random() * k * 0.8;
      parts.push([px + Math.cos(a) * d, py + Math.sin(a) * d, k * (0.4 + Math.random() * 0.5), k * (0.3 + Math.random() * 0.4), Math.random() * 3]);
    }
    this.fresh((g, wet) => {
      g.fillStyle = wet ? '#141414' : color; g.globalAlpha = wet ? 1 : 0.9;
      for (const [ex, ey, rx, ry, rot] of parts) { g.beginPath(); g.ellipse(ex, ey, rx, ry, rot, 0, TAU); g.fill(); }
      g.globalAlpha = 1;
    });
  }

  // drag smear (fighter sliding on the ground after a hit)
  smear(x0, z0, x1, z1, w = 1, color = '#6a0007') {
    if (!this.inside(x0, z0) && !this.inside(x1, z1)) return;
    const [a, b] = this.toPx(x0, z0), [c, d] = this.toPx(x1, z1);
    this.fresh((g, wet) => {
      g.strokeStyle = wet ? '#262626' : color; g.globalAlpha = wet ? 1 : 0.7; g.lineCap = 'round';
      g.lineWidth = this.k * 0.25 * w;
      g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke();
      g.globalAlpha = 1;
    });
  }

  // a bloody footprint: dirx the way the fighter walks (+1 / -1 along x), side -1 / +1 the foot, alpha how much
  // blood is left on the sole
  footprint(x, z, dirx, alpha = 1, color = '#7a0008') {
    if (!this.inside(x, z)) return;
    const [hx, hy] = this.toPx(x, z), [tx, ty] = this.toPx(x + dirx * 0.34, z); // (a cartoon foot: big enough to read)
    const ang = Math.atan2(ty - hy, tx - hx), L = Math.hypot(tx - hx, ty - hy);
    this.fresh((g, wet) => {
      g.save();
      g.translate(hx, hy); g.rotate(ang);
      g.fillStyle = wet ? '#2a2a2a' : color; g.globalAlpha = wet ? alpha : 0.85 * alpha;
      // heel, ball of the foot, toes
      g.beginPath(); g.ellipse(L * 0.16, 0, L * 0.19, L * 0.17, 0, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(L * 0.6, 0, L * 0.27, L * 0.22, 0, 0, TAU); g.fill();
      for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(L * (0.95 - Math.abs(i - 1.5) * 0.05), (i - 1.5) * L * 0.12, L * 0.07, 0, TAU); g.fill(); }
      g.restore();
      g.globalAlpha = 1;
    });
  }

  stamp(x, z, angle, text = '49.3', color = '#c4141a') {
    if (!this.inside(x, z)) return;
    const [px, py] = this.toPx(x, z);
    const g = this.g;
    const k = this.k;
    g.save();
    g.translate(px, py); g.rotate(-angle + this.angle + 0.2);
    g.globalAlpha = 0.85;
    g.strokeStyle = color; g.lineWidth = k * 0.25;
    g.strokeRect(-k * 2.1, -k * 1.0, k * 4.2, k * 2.0);
    g.fillStyle = color;
    g.font = `bold ${Math.round(k * 1.3)}px Lilita One, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 0, k * 0.05);
    g.font = `bold ${Math.round(k * 0.45)}px Lilita One, sans-serif`;
    g.fillText('ADOPTÉ', 0, k * 0.75);
    g.restore();
    g.globalAlpha = 1;
    this.dirty = true;
  }

  // the blood dries: whatever is painted darkens toward a brown-red, the wet canvas goes back to matte
  dry() {
    const g = this.g;
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(62,9,8,0.07)'; g.fillRect(0, 0, this.W, this.H);
    g.globalCompositeOperation = 'source-over';
    if (this.wc) { this.wc.fillStyle = 'rgba(255,255,255,0.07)'; this.wc.fillRect(0, 0, this.W, this.H); }
    this.dirty = true;
  }

  update(dt) {
    this.t += dt;
    if (this.t < this.wetUntil && (this.dryT += dt) > 0.8) { this.dryT = 0; this.dry(); }
  }

  sync(surface) {
    this.angle = surface.angle || 0; this.cx = surface.cx; this.cz = surface.cz;
    this.mesh.position.set(surface.cx, surface.y + 0.025, surface.cz);
    this.mesh.rotation.set(-Math.PI / 2 + (surface.tiltZ ? Math.atan(surface.tiltZ) : 0), 0, 0);
    this.mesh.rotation.z = this.angle;
    if (surface.tiltX || surface.tiltZ) {
      this.mesh.rotation.set(0, 0, 0);
      const n = new THREE.Vector3(-surface.tiltX, 1, -surface.tiltZ).normalize();
      this.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
      this.mesh.rotateZ(this.angle);
    }
    // (the big canvases go up at most 30 times a second)
    const now = performance.now();
    if (this.dirty && now - this.upAt >= 33) { this.tex.needsUpdate = true; if (this.wtex) this.wtex.needsUpdate = true; this.dirty = false; this.upAt = now; }
  }

  clear() {
    this.g.clearRect(0, 0, this.W, this.H);
    if (this.wc) { this.wc.fillStyle = '#ffffff'; this.wc.fillRect(0, 0, this.W, this.H); }
    this.dirty = true; this.amount = 0;
  }
}

// the side of the main platform: the blood that reaches its edge runs down it
export class RimDecal {
  constructor(surf) {
    const r = surf.r + 0.015, th = surf.thick ?? 1.4;
    this.th = th; this.W = 2048; this.H = 64;
    const C = canvasTex(this.W, this.H);
    this.g = C.g; this.tex = C.t; this.tex.colorSpace = THREE.SRGBColorSpace;
    if (STYLE.smooth) { const Wt = canvasTex(this.W, this.H, '#ffffff'); this.wc = Wt.g; this.wtex = Wt.t; }
    this.mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, th, 96, 1, true), stainMat(this.tex, this.wtex, { polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    this.mesh.renderOrder = 2;
    this.angle = 0; this.cx = 0; this.cz = 0;
    this.t = 0; this.wetUntil = -1; this.dryT = 0; this.dirty = false;
  }

  // a drip from the top of the edge at the point of the rim nearest (x, z): amount 0..1 how long it runs
  drip(x, z, amount = 0.5, color = '#7a0008') {
    const th = Math.atan2(x - this.cx, z - this.cz) - this.angle;
    const u = ((th / TAU) % 1 + 1) % 1, px = u * this.W, H = this.H;
    const w = 2 + Math.random() * 3, L = H * Math.min(0.95, 0.2 + amount * (0.5 + Math.random() * 0.5));
    const draw = (g, wet) => {
      g.fillStyle = wet ? '#1c1c1c' : color; g.globalAlpha = wet ? 1 : 0.9;
      g.beginPath(); g.ellipse(px, 1, w * 1.6, 3, 0, 0, TAU); g.fill(); // what reached the edge
      g.fillRect(px - w / 2, 0, w, L);
      g.beginPath(); g.arc(px, L, w * 0.85, 0, TAU); g.fill(); // the drop at the end of the run
      g.globalAlpha = 1;
    };
    draw(this.g, false);
    if (this.wc) draw(this.wc, true);
    this.dirty = true; this.wetUntil = this.t + 30;
  }

  update(dt) {
    this.t += dt;
    if (this.t < this.wetUntil && (this.dryT += dt) > 0.8) {
      this.dryT = 0;
      const g = this.g;
      g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(62,9,8,0.07)'; g.fillRect(0, 0, this.W, this.H); g.globalCompositeOperation = 'source-over';
      if (this.wc) { this.wc.fillStyle = 'rgba(255,255,255,0.07)'; this.wc.fillRect(0, 0, this.W, this.H); }
      this.dirty = true;
    }
  }

  sync(s) {
    this.angle = s.angle || 0; this.cx = s.cx; this.cz = s.cz;
    this.mesh.position.set(s.cx, s.y - this.th / 2, s.cz);
    this.mesh.rotation.set(0, this.angle, 0);
    this.mesh.visible = s.active !== false;
    if (this.dirty) { this.tex.needsUpdate = true; if (this.wtex) this.wtex.needsUpdate = true; this.dirty = false; }
  }

  clear() { this.g.clearRect(0, 0, this.W, this.H); if (this.wc) { this.wc.fillStyle = '#ffffff'; this.wc.fillRect(0, 0, this.W, this.H); } this.dirty = true; }
}

// the stains of every platform of the arena. The old one-platform calls (splat, pool, smear, stamp with no height)
// go to the main platform; with a height, to the platform under that point
export class DecalSet {
  constructor(stage) {
    this.stage = stage;
    this.mesh = new THREE.Group();
    this.list = stage.surfaces.map((s) => {
      // small ones: the whole disc; the main one: a sharp strip along the fight, the whole disc if it spins
      const d = s.r < 5 ? new Decals(s.r, 512) : s.spin ? new Decals(s.r, 1024) : new Decals(s.r, 1536, Math.min(2 * s.r, 7));
      this.mesh.add(d.mesh);
      return d;
    });
    const m = stage.surfaces[0];
    this.rim = m && m.solid ? new RimDecal(m) : null;
    if (this.rim) this.mesh.add(this.rim.mesh);
  }

  get main() { return this.list[0]; }
  get amount() { return this.list[0].amount; }

  // the platform whose top is just under (x, y, z): the highest at or below y + 0.3
  under(x, y, z) {
    const st = this.stage;
    let best = -1, by = -Infinity;
    st.surfaces.forEach((s, i) => {
      if (!s.active || !st.inside3(s, x, z, 0)) return;
      const h = st.heightAt(s, x, z);
      if (h <= y + 0.3 && h > by) { best = i; by = h; }
    });
    return best >= 0 ? this.list[best] : null;
  }
  pick(x, z, y) { return y === undefined ? this.list[0] : this.under(x, y, z); }

  // on a platform near the edge of the main one, the blood also runs down its side
  edge(d, x, z, size, color) {
    if (d !== this.list[0] || !this.rim) return;
    const s = this.stage.surfaces[0], r = Math.hypot(x - s.cx, z - s.cz);
    if (r > s.r - 0.5 && r < s.r && z - s.cz > -s.r * 0.3) this.rim.drip(x, z, Math.min(1, size), color);
  }

  splat(x, z, size, color, drips, y, dir) { const d = this.pick(x, z, y); if (!d) return; d.splat(x, z, size, color, drips, dir); this.edge(d, x, z, size, color); }
  splatOn(i, x, z, size, color, drips, dir) { const d = this.list[i]; if (!d) return; d.splat(x, z, size, color, drips, dir); this.edge(d, x, z, size, color); }
  pool(x, z, size, color, y) { const d = this.pick(x, z, y); if (!d) return; d.pool(x, z, size, color); this.edge(d, x, z, size, color); }
  smear(x0, z0, x1, z1, w, color, y) { const d = this.pick(x1, z1, y); if (d) d.smear(x0, z0, x1, z1, w, color); }
  stamp(x, z, angle, text, color) { this.list[0].stamp(x, z, angle, text, color); }
  footprint(x, y, z, dirx, alpha, color) { const d = this.under(x, y, z); if (d) d.footprint(x, z, dirx, alpha, color); }

  update(dt) { for (const d of this.list) d.update(dt); if (this.rim) this.rim.update(dt); }

  sync(stage) {
    stage.surfaces.forEach((s, i) => { const d = this.list[i]; if (!d) return; d.sync(s); d.mesh.visible = s.active !== false; });
    if (this.rim) this.rim.sync(stage.surfaces[0]);
  }

  clear() { for (const d of this.list) d.clear(); if (this.rim) this.rim.clear(); }
}
