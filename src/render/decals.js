// Persistent stains on the main platform: a canvas mapped on its top surface, in the platform's local frame
// (so stains turn with a spinning platform). Blood, ketchup, cheese, the 49.3 stamp...
import * as THREE from 'three';

export class Decals {
  constructor(radius, size = 512) {
    this.R = radius;
    this.size = size;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = size;
    this.g = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.magFilter = THREE.NearestFilter;
    this.tex.minFilter = THREE.LinearFilter;
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.dirty = false;
    this.angle = 0; this.cx = 0; this.cz = 0;
    this.mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), new THREE.MeshLambertMaterial({
      map: this.tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }));
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.renderOrder = 2;
    this.mesh.receiveShadow = true;
    this.amount = 0;
  }

  // world -> canvas pixel (platform local frame)
  toPx(x, z) {
    const dx = x - this.cx, dz = z - this.cz;
    const c = Math.cos(-this.angle), s = Math.sin(-this.angle);
    const lx = dx * c + dz * s, lz = -dx * s + dz * c;
    // CircleGeometry after rotation.x=-PI/2: u from x, v from -z
    return [(lx / (2 * this.R) + 0.5) * this.size, (lz / (2 * this.R) + 0.5) * this.size];
  }

  inside(x, z) { return Math.hypot(x - this.cx, z - this.cz) < this.R; }

  splat(x, z, size = 1, color = '#7a0008', drips = true) {
    if (!this.inside(x, z)) return;
    const [px, py] = this.toPx(x, z);
    const g = this.g;
    const k = (this.size / (2 * this.R)) * 0.18 * size;
    g.fillStyle = color;
    g.globalAlpha = 0.85;
    g.beginPath(); g.arc(px, py, k * (0.8 + Math.random() * 0.6), 0, Math.PI * 2); g.fill();
    const n = drips ? 3 + Math.floor(Math.random() * 5) : 0;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, d = k * (1 + Math.random() * 2.2);
      g.beginPath(); g.arc(px + Math.cos(a) * d, py + Math.sin(a) * d, k * (0.2 + Math.random() * 0.4), 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
    this.dirty = true;
    this.amount += size;
  }

  // a big pool of blood (KO landings, gore)
  pool(x, z, size = 3, color = '#5e0006') {
    if (!this.inside(x, z)) return;
    const [px, py] = this.toPx(x, z);
    const g = this.g;
    const k = (this.size / (2 * this.R)) * 0.3 * size;
    g.fillStyle = color; g.globalAlpha = 0.9;
    for (let i = 0; i < 9; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.random() * k * 0.8;
      g.beginPath(); g.ellipse(px + Math.cos(a) * d, py + Math.sin(a) * d, k * (0.4 + Math.random() * 0.5), k * (0.3 + Math.random() * 0.4), Math.random() * 3, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
    this.dirty = true;
  }

  // drag smear (fighter sliding on the ground after a hit)
  smear(x0, z0, x1, z1, w = 1, color = '#6a0007') {
    if (!this.inside(x0, z0) && !this.inside(x1, z1)) return;
    const [a, b] = this.toPx(x0, z0), [c, d] = this.toPx(x1, z1);
    const g = this.g;
    g.strokeStyle = color; g.globalAlpha = 0.7; g.lineCap = 'round';
    g.lineWidth = (this.size / (2 * this.R)) * 0.25 * w;
    g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke();
    g.globalAlpha = 1;
    this.dirty = true;
  }

  stamp(x, z, angle, text = '49.3', color = '#c4141a') {
    if (!this.inside(x, z)) return;
    const [px, py] = this.toPx(x, z);
    const g = this.g;
    const k = (this.size / (2 * this.R));
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
    if (this.dirty) { this.tex.needsUpdate = true; this.dirty = false; }
  }

  clear() { this.g.clearRect(0, 0, this.size, this.size); this.dirty = true; this.amount = 0; }
}
