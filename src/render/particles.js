// Instanced particles: blood droplets (that stain the ground), gore chunks, sparks, dust, cheese flakes, money...
import * as THREE from 'three';
import { STYLE } from './style.js';
import { puffTex } from './materials.js';

const dummy = new THREE.Object3D();
const col = new THREE.Color();

class Pool {
  constructor(scene, geo, material, max, opts = {}) {
    this.mesh = new THREE.InstancedMesh(geo, material, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
    this.max = max;
    this.p = [];
    this.opts = opts;
  }
  add(o) {
    if (this.p.length >= this.max) this.p.shift();
    this.p.push(o);
  }
}

export class Particles {
  constructor(scene) {
    this.scene = scene;
    const lam = (o = {}) => new THREE.MeshLambertMaterial({ color: '#ffffff', ...o });
    const add = (o = {}) => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, ...o });
    this.pools = {
      blood: STYLE.smooth
        ? new Pool(scene, new THREE.IcosahedronGeometry(0.06, 1), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.22, metalness: 0.05, emissive: '#2a0000' }), 4000)
        : new Pool(scene, new THREE.TetrahedronGeometry(0.07, 0), lam({ emissive: '#300000' }), 4000),
      chunk: new Pool(scene, new THREE.BoxGeometry(0.16, 0.12, 0.14), lam({ emissive: '#200000' }), 500),
      bone: new Pool(scene, new THREE.CylinderGeometry(0.035, 0.035, 0.3, 5), lam(), 120),
      spark: new Pool(scene, new THREE.OctahedronGeometry(0.09, 0), add(), 900),
      dust: STYLE.smooth
        ? new Pool(scene, new THREE.PlaneGeometry(0.8, 0.8), new THREE.MeshBasicMaterial({ map: puffTex(), color: '#ffffff', transparent: true, opacity: 0.85, depthWrite: false }), 500, { billboard: true })
        : new Pool(scene, new THREE.IcosahedronGeometry(0.22, 0), lam({ transparent: true, opacity: 0.7, depthWrite: false }), 500),
      flake: new Pool(scene, new THREE.BoxGeometry(0.1, 0.02, 0.06), lam(), 800),
      bill: new Pool(scene, new THREE.PlaneGeometry(0.28, 0.14), lam({ side: THREE.DoubleSide }), 500),
      drop: new Pool(scene, new THREE.IcosahedronGeometry(0.06, STYLE.smooth ? 1 : 0), STYLE.smooth ? new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.25, emissive: '#111111' }) : lam({ emissive: '#111' }), 1200),
      ring: new Pool(scene, new THREE.TorusGeometry(0.5, 0.06, 4, 16), add({ side: THREE.DoubleSide }), 80),
    };
    this.onGround = null; // callback(x, y, z, kind, size)
    this.stage = null;
  }

  // ---- emitters ----------------------------------------------------------------------------------------------
  blood(x, y, z, dir, n, power = 1) {
    const P = this.pools.blood;
    for (let i = 0; i < n; i++) {
      const sp = (2 + Math.random() * 9) * power;
      const dx = (dir ? dir[0] : 0) * sp * 0.8 + (Math.random() - 0.5) * sp;
      const dz = (dir ? dir[2] : 0) * sp * 0.8 + (Math.random() - 0.5) * sp;
      const dy = (dir ? Math.max(0, dir[1]) : 0) * sp * 0.6 + Math.random() * sp * 0.7 + 1;
      const shade = 0.45 + Math.random() * 0.45;
      P.add({ x, y, z, vx: dx, vy: dy, vz: dz, life: 2.5 + Math.random(), s: 0.6 + Math.random() * 1.4, r: [0.85 * shade + 0.1, 0.02, 0.03 * shade], rot: Math.random() * 6, spin: (Math.random() - 0.5) * 20, g: 22, kind: 'blood', stick: true });
    }
  }

  gore(x, y, z, v, n = 14) {
    const C = this.pools.chunk, B = this.pools.bone;
    for (let i = 0; i < n; i++) {
      const sp = 6 + Math.random() * 14;
      const a = Math.random() * Math.PI * 2, e = Math.random() * 1.2;
      const vx = Math.cos(a) * Math.cos(e) * sp + (v ? v[0] * 0.3 : 0), vz = Math.sin(a) * Math.cos(e) * sp + (v ? v[2] * 0.3 : 0), vy = Math.sin(e) * sp + 4;
      const red = Math.random() < 0.25;
      C.add({ x, y, z, vx, vy, vz, life: 4 + Math.random() * 2, s: 0.7 + Math.random() * 1.3, r: red ? [0.95, 0.75, 0.7] : [0.55 + Math.random() * 0.25, 0.04, 0.05], rot: Math.random() * 6, spin: (Math.random() - 0.5) * 18, g: 26, kind: 'chunk', stick: true, bounce: 0.3 });
      if (i % 4 === 0) B.add({ x, y, z, vx: vx * 0.8, vy: vy * 1.1, vz: vz * 0.8, life: 4, s: 1, r: [0.95, 0.93, 0.85], rot: Math.random() * 6, spin: (Math.random() - 0.5) * 25, g: 26, kind: 'bone', bounce: 0.4 });
    }
    this.blood(x, y, z, v ? [v[0] * 0.05, 0.5, v[2] * 0.05] : null, 120, 1.6);
  }

  sparks(x, y, z, n, color = '#fff2a8', speed = 9, life = 0.35) {
    const P = this.pools.spark;
    col.set(color);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = (Math.random() - 0.3) * 2;
      const sp = speed * (0.4 + Math.random());
      P.add({ x, y, z, vx: Math.cos(a) * sp, vy: e * sp * 0.5, vz: Math.sin(a) * sp, life: life * (0.6 + Math.random() * 0.8), s: 1 + Math.random(), r: [col.r, col.g, col.b], rot: 0, spin: 10, g: 0, drag: 6, kind: 'spark', shrink: true });
    }
  }

  dust(x, y, z, n, color = '#b9b3a6', spread = 1) {
    const P = this.pools.dust;
    col.set(color);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = (1 + Math.random() * 3) * spread;
      P.add({ x: x + Math.cos(a) * 0.2, y: y + 0.1, z: z + Math.sin(a) * 0.2, vx: Math.cos(a) * sp, vy: 0.5 + Math.random() * 1.5, vz: Math.sin(a) * sp, life: 0.5 + Math.random() * 0.4, s: 0.6 + Math.random() * 0.8, r: [col.r, col.g, col.b], rot: 0, spin: 0, g: -0.5, drag: 3, kind: 'dust', grow: true });
    }
  }

  burst(kind, x, y, z, n, color, opts = {}) {
    const P = this.pools[kind];
    col.set(color);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * 1.4 - 0.2;
      const sp = (opts.speed || 6) * (0.3 + Math.random());
      P.add({ x, y, z, vx: Math.cos(a) * Math.cos(e) * sp + (opts.vx || 0), vy: Math.sin(e) * sp + (opts.vy || 0), vz: Math.sin(a) * Math.cos(e) * sp + (opts.vz || 0),
        life: (opts.life || 1.2) * (0.6 + Math.random() * 0.6), s: (opts.s || 1) * (0.6 + Math.random() * 0.8), r: [col.r * (0.85 + Math.random() * 0.3), col.g * (0.85 + Math.random() * 0.3), col.b * (0.85 + Math.random() * 0.3)],
        rot: Math.random() * 6, spin: (Math.random() - 0.5) * (opts.spin || 12), g: opts.g ?? 14, drag: opts.drag || 0, kind, flutter: opts.flutter, stick: opts.stick, shrink: opts.shrink, bounce: opts.bounce });
    }
  }

  shockRing(x, y, z, color = '#ffffff', size = 1, life = 0.35) {
    col.set(color);
    this.pools.ring.add({ x, y, z, vx: 0, vy: 0, vz: 0, life, l0: life, s: 0.2, grow: size * 9, r: [col.r, col.g, col.b], rot: 0, spin: 0, g: 0, kind: 'ring', flat: true });
  }

  // ---- update ------------------------------------------------------------------------------------------------
  update(dt) {
    const st = this.stage;
    for (const name of Object.keys(this.pools)) {
      const P = this.pools[name];
      const arr = P.p;
      let w = 0;
      for (let i = 0; i < arr.length; i++) {
        const o = arr[i];
        o.life -= dt;
        if (o.life <= 0) continue;
        if (!o.landed) {
          const py = o.y;
          o.vy -= o.g * dt;
          if (o.drag) { const k = Math.exp(-o.drag * dt); o.vx *= k; o.vy *= o.g ? 1 : k; o.vz *= k; }
          if (o.flutter) { o.vx += Math.sin(o.life * 9 + o.rot) * 6 * dt; o.vz += Math.cos(o.life * 7 + o.rot) * 6 * dt; o.vy = Math.max(o.vy, -1.6); }
          o.x += o.vx * dt; o.y += o.vy * dt; o.z += o.vz * dt;
          o.rot += o.spin * dt;
          if (st && o.vy < 0 && (o.stick || o.bounce)) {
            const s = st.findLanding(o.x, o.z, py, o.y);
            if (s) {
              const gy = st.heightAt(s, o.x, o.z);
              o.y = gy + 0.02;
              if (o.bounce && Math.abs(o.vy) > 3) { o.vy = -o.vy * o.bounce; o.vx *= 0.6; o.vz *= 0.6; if (this.onGround && o.kind === 'chunk') this.onGround(o.x, gy, o.z, 'chunk', o.s); }
              else {
                o.landed = true; o.surf = s.idx;
                if (this.onGround) this.onGround(o.x, gy, o.z, o.kind, o.s);
                if (o.kind === 'blood') o.life = Math.min(o.life, 0.15);
                else o.life = Math.min(o.life, 2.5);
              }
            }
          }
          if (o.y < -30) o.life = 0;
        }
        arr[w++] = o;
      }
      arr.length = w;
      const mesh = P.mesh;
      let n = 0;
      for (const o of arr) {
        let s = o.s;
        if (o.shrink) s *= Math.max(0, o.life * 3);
        if (o.grow) s *= 1 + (1 - o.life) * 2.5;
        if (o.kind === 'ring') { s = o.s + (o.l0 - o.life) * o.grow; }
        dummy.position.set(o.x, o.y, o.z);
        if (P.opts.billboard && this.camera) {
          // soft puffs face the camera, rolling slowly, and shrink away at the end of their life
          dummy.quaternion.copy(this.camera.quaternion); dummy.rotateZ(o.rot);
          s *= Math.min(1, o.life / 0.25);
          dummy.scale.setScalar(s * 1.6);
        } else if (o.kind === 'spark' && STYLE.smooth) {
          // sparks stretch along their velocity: bright streaks
          const v = Math.hypot(o.vx, o.vy, o.vz);
          dummy.lookAt(o.x + o.vx, o.y + o.vy, o.z + o.vz);
          dummy.scale.set(s * 0.55, s * 0.55, s * (1 + v * 0.12));
        } else {
          if (o.flat) dummy.rotation.set(Math.PI / 2, 0, 0);
          else dummy.rotation.set(o.rot, o.rot * 0.7, o.rot * 0.3);
          if (o.landed && o.kind !== 'bill') dummy.scale.set(s * 1.4, s * 0.25, s * 1.4); else dummy.scale.setScalar(s);
        }
        dummy.updateMatrix();
        mesh.setMatrixAt(n, dummy.matrix);
        const fade = o.kind === 'ring' ? Math.max(0, o.life / o.l0) : 1;
        mesh.instanceColor.setXYZ(n, o.r[0] * fade, o.r[1] * fade, o.r[2] * fade);
        n++;
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
    }
  }

  clear() { for (const P of Object.values(this.pools)) { P.p.length = 0; P.mesh.count = 0; } }
}
