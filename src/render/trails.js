// The trail of a blow: a short ribbon behind the hand, foot or weapon that strikes (src/render/rig/reach.js
// strikePoint), from a little before the hitbox to a little after, gone in a tenth of a second. White at its head,
// the player's colour along its tail, thin: it shows the arc of the blow, it never hides anything.
import * as THREE from 'three';

const N = 14;          // points kept
const LIFE = 0.11;     // seconds a point lives
const WIDTH = 0.16;    // metres at the head

export class Trail {
  constructor(scene, color) {
    this.scene = scene;
    this.pts = [];
    const pos = new Float32Array(N * 2 * 3), col = new Float32Array(N * 2 * 4);
    const idx = [];
    for (let i = 0; i < N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
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
    for (let i = 0; i < N; i++) {
      const q = this.pts[Math.min(i, n - 1)];
      const a = this.pts[Math.max(0, Math.min(i, n - 1) - 1)].p, b = this.pts[Math.min(n - 1, Math.min(i, n - 1) + 1)].p;
      // across the direction of travel, in the screen plane (the camera looks down -z)
      let dx = a.x - b.x, dy = a.y - b.y;
      const l = Math.hypot(dx, dy) || 1;
      dx /= l; dy /= l;
      const k = i < n ? 1 - i / (n - 1) : 0;                 // 1 at the head, 0 at the tail
      const fade = i < n ? Math.max(0, 1 - q.age / LIFE) : 0;
      const w = WIDTH * (0.25 + 0.75 * k) * 0.5;
      const o = i * 6;
      pos[o] = q.p.x - dy * w; pos[o + 1] = q.p.y + dx * w; pos[o + 2] = q.p.z;
      pos[o + 3] = q.p.x + dy * w; pos[o + 4] = q.p.y - dx * w; pos[o + 5] = q.p.z;
      const al = fade * (0.15 + 0.6 * k);
      const r = c.r + (1 - c.r) * k * 0.7, g = c.g + (1 - c.g) * k * 0.7, bl = c.b + (1 - c.b) * k * 0.7;
      const ci = i * 8;
      col[ci] = col[ci + 4] = r * al; col[ci + 1] = col[ci + 5] = g * al; col[ci + 2] = col[ci + 6] = bl * al; col[ci + 3] = col[ci + 7] = al;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.color.needsUpdate = true;
  }

  dispose() { this.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
