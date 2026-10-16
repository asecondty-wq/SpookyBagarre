// The trail of a blow: a ribbon behind the hand, foot or weapon that strikes (src/render/rig/reach.js strikePoint), from
// a little before the hitbox to a little after, gone in a sixth of a second. Like the sword trails of the Smash
// Ultimate "spectrum" mods it is a rainbow ribbon: across its width a gradient (magenta, blue, cyan, green, yellow, white),
// a soft wavy edge, a bright head and a tail that thins and fades; the player's colour tints it a little.
// It shows the arc of the blow, it never hides anything.
import * as THREE from 'three';

const N = 16;          // points kept
const LIFE = 0.2;     // seconds a point lives
const WIDTH = 0.7;    // metres at the head
const M = 5;           // vertices across the width
const TINT = 0.22;     // how much of the player's colour is mixed into the rainbow
// the rainbow across the width (0 = one edge, 1 = the other)
const RAMP = [[1, 0.1, 0.8], [0.25, 0.3, 1], [0, 0.88, 1], [0.2, 1, 0.3], [1, 0.9, 0.05], [1, 0.45, 0.35]].map((c) => new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace));
const _r = new THREE.Color();
function ramp(u, out) {
  const f = Math.max(0, Math.min(0.9999, u)) * (RAMP.length - 1), i = Math.floor(f);
  return out.copy(RAMP[i]).lerp(RAMP[i + 1], f - i);
}

export class Trail {
  constructor(scene, color) {
    this.scene = scene;
    this.pts = [];
    this.t = Math.random() * 6;
    const pos = new Float32Array(N * M * 3), col = new Float32Array(N * M * 4);
    const idx = [];
    for (let i = 0; i < N - 1; i++) for (let j = 0; j < M - 1; j++) { const a = i * M + j, b = a + M; idx.push(a, a + 1, b, a + 1, b + 1, b); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 20;
    this.mesh.visible = false;
    scene.add(this.mesh);
    this.color = new THREE.Color(color);
  }

  // p: the striking point this frame (world), or null when no blow is out
  update(p, dt) {
    for (const q of this.pts) q.age += dt;
    while (this.pts.length && this.pts[this.pts.length - 1].age > LIFE) this.pts.pop();
    if (p) {
      // a jump (a new blow far from the last one, a teleport): start over
      if (this.pts.length && this.pts[0].p.distanceToSquared(p) > 0.8) this.pts.length = 0;
      const last = this.pts[0];
      if (!last || last.p.distanceToSquared(p) > 0.0004) this.pts.unshift({ p: p.clone(), age: 0 });
      else last.age = 0;
      if (this.pts.length > N) this.pts.length = N;
    }
    const n = this.pts.length;
    this.mesh.visible = n >= 3;
    if (!this.mesh.visible) return;
    const pos = this.mesh.geometry.attributes.position.array, col = this.mesh.geometry.attributes.color.array;
    const c = this.color;
    this.t += dt;
    for (let i = 0; i < N; i++) {
      const q = this.pts[Math.min(i, n - 1)];
      const a = this.pts[Math.max(0, Math.min(i, n - 1) - 1)].p, b = this.pts[Math.min(n - 1, Math.min(i, n - 1) + 1)].p;
      // across the direction of travel, in the screen plane (the camera looks down -z)
      let dx = a.x - b.x, dy = a.y - b.y;
      const l = Math.hypot(dx, dy) || 1;
      dx /= l; dy /= l;
      const k = i < n ? 1 - i / (n - 1) : 0;                 // 1 at the head, 0 at the tail
      const fade = i < n ? Math.max(0, 1 - q.age / LIFE) : 0;
      // the wavy edge of the ribbon, and a width that thins toward the tail
      const wave = 1 + 0.16 * Math.sin(i * 1.9 + this.t * 38) + 0.08 * Math.sin(i * 3.7 - this.t * 21);
      const w = WIDTH * (0.12 + 0.88 * k) * wave * 0.5;
      const al0 = fade * (0.3 + 0.7 * Math.pow(k, 0.7));
      for (let j = 0; j < M; j++) {
        const u = j / (M - 1), t = u * 2 - 1;                   // -1 .. 1 across
        const o = (i * M + j) * 3;
        pos[o] = q.p.x - dy * w * t; pos[o + 1] = q.p.y + dx * w * t; pos[o + 2] = q.p.z;
        ramp(u, _r).lerp(c, TINT);
        // bright head: white-hot; the edges fade out
        const hot = k * k * k * 0.18;
        const al = al0 * (1 - Math.pow(Math.abs(t), 3) * 0.7);
        const ci = (i * M + j) * 4;
        col[ci] = (_r.r + (1 - _r.r) * hot) * 1.7; col[ci + 1] = (_r.g + (1 - _r.g) * hot) * 1.7; col[ci + 2] = (_r.b + (1 - _r.b) * hot) * 1.7; col[ci + 3] = al; // the additive blend multiplies by the alpha itself
      }
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.color.needsUpdate = true;
  }

  dispose() { this.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
