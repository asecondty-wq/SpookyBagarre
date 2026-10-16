// Cartoon smoke, as in Smash Ultimate: round 3D puffs (toon shaded, white with blue-grey shadows) that come from the
// feet, swell in a blink, are thrown along the ground with the fighter's momentum, brake hard in the air (heavy:
// they hug the floor, rising only a little), roll, and shrink away to nothing instead of fading. They go all around
// the feet: in front of the fighter and behind it. One instanced mesh for every puff (src/render/particles.js).
import * as THREE from 'three';

const MAX = 420;
const dummy = new THREE.Object3D();
const rnd = (a, b) => a + Math.random() * (b - a);

function gradient() {
  // three tones: shadow, mid, lit (nearest: hard cartoon bands)
  const d = new Uint8Array([70, 150, 255]);
  const t = new THREE.DataTexture(d, 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}

export class Smoke {
  constructor(scene) {
    const geo = new THREE.IcosahedronGeometry(0.5, 2);
    const mat = new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: gradient(), emissive: '#262c3e' });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
    this.p = [];
  }

  // one puff: at (x, y, z), floor height fy, velocity v, radius r (metres), life (s)
  puff(x, y, z, fy, vx, vy, vz, r, life, tint = 1) {
    if (this.p.length >= MAX) this.p.shift();
    const c = tint * rnd(0.9, 1);
    this.p.push({ x, y, z, fy, vx, vy, vz, r, life, age: 0, rot: rnd(0, 6), spin: rnd(-3, 3), c: [c, c, c * 1.02], drag: rnd(3.6, 4.8), lift: rnd(0.4, 1.2) });
  }

  // a lumpy cloud: one puff and two or three smaller ones stuck to it, flying together (a little apart)
  cloud(x, y, z, fy, vx, vy, vz, r, life) {
    this.puff(x, y, z, fy, vx, vy, vz, r, life);
    for (let i = 0, n = 2 + (Math.random() < 0.5 ? 1 : 0); i < n; i++) {
      const a = rnd(0, 6.28), d = r * rnd(0.55, 0.85), f = rnd(0.82, 1.12);
      this.puff(x + Math.cos(a) * d, y + rnd(-0.2, 0.5) * r, z + Math.sin(a) * d * 0.8, fy, vx * f, vy * f + rnd(0, 0.6), vz * f, r * rnd(0.5, 0.72), life * rnd(0.8, 1));
    }
  }

  // a burst all around the feet along the floor (a landing): n puffs, speed sp, carried by the fighter's momentum
  // (mvx: its speed along x when it touched down), the biggest near the middle
  ring(x, fy, z, n, sp, size, mvx = 0) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd(-0.3, 0.3);
      const ca = Math.cos(a), sa = Math.sin(a);
      // flattened toward the screen plane: most of it flies left and right, some to the front and the back
      const s = sp * rnd(0.6, 1.15);
      this.cloud(x + ca * 0.4, fy + 0.12, z + sa * 0.25, fy, ca * s + mvx * 0.55, rnd(0.3, 1.4), sa * s * 0.45, size * rnd(0.6, 1.0) * (1.1 - Math.abs(ca) * 0.25), rnd(0.42, 0.62));
    }
  }

  // a kick from the heels (a dash, a turn, a skid): n puffs thrown toward dir (+1 / -1 along x), low and fast,
  // plus some of the fighter's own speed (mvx)
  kick(x, fy, z, dir, n, sp, size, mvx = 0) {
    for (let i = 0; i < n; i++) {
      const s = sp * rnd(0.5, 1.1);
      this.cloud(x + dir * rnd(0, 0.25), fy + rnd(0.08, 0.25), z + rnd(-0.25, 0.25), fy, dir * s + mvx * 0.35, rnd(0.4, 1.8), rnd(-1.6, 1.6), size * rnd(0.6, 1.1), rnd(0.35, 0.55));
    }
  }

  update(dt) {
    let w = 0;
    for (const o of this.p) {
      o.age += dt;
      if (o.age >= o.life) continue;
      const k = Math.exp(-o.drag * dt);
      o.vx *= k; o.vz *= k;
      o.vy = o.vy * Math.exp(-3 * dt) + o.lift * dt; // heavy: the upward kick dies, a slow rise stays
      o.x += o.vx * dt; o.y += o.vy * dt; o.z += o.vz * dt;
      o.rot += o.spin * dt * (0.3 + Math.hypot(o.vx, o.vz) * 0.25); // it rolls while it is pushed
      this.p[w++] = o;
    }
    this.p.length = w;
    let n = 0;
    for (const o of this.p) {
      const u = o.age / o.life;
      // swells in a blink (overshoot), holds, then shrinks to nothing
      const pop = u < 0.12 ? 1 - Math.pow(1 - u / 0.12, 3) * 0.85 : 1;
      const end = u > 0.4 ? 1 - Math.pow((u - 0.4) / 0.6, 1.6) : 1;
      const s = o.r * 2 * pop * end * (1 + u * 0.35);
      // squashed a little against the floor, never sinking into it
      const y = Math.max(o.y, o.fy + s * 0.32);
      dummy.position.set(o.x, y, o.z);
      dummy.rotation.set(o.rot * 0.5, o.rot, 0);
      dummy.scale.set(s * 1.08, s * 0.9, s * 1.08);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(n, dummy.matrix);
      this.mesh.instanceColor.setXYZ(n, o.c[0], o.c[1], o.c[2]);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }

  clear() { this.p.length = 0; this.mesh.count = 0; }
}
