// Building blocks for the arenas: sky dome, floating platform, scattered props, ambient creatures.
import * as THREE from 'three';
import { mat, basic, G, mesh, canvasTex, glowTex, speckle } from '../materials.js';

export function skyDome(top, horizon, bottom = horizon, stars = 0) {
  const geo = new THREE.SphereGeometry(320, 24, 12);
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { cTop: { value: new THREE.Color(top) }, cHor: { value: new THREE.Color(horizon) }, cBot: { value: new THREE.Color(bottom) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 cTop; uniform vec3 cHor; uniform vec3 cBot; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(cHor, cTop, pow(h, 0.6)) : mix(cHor, cBot, pow(-h, 0.5)); gl_FragColor = vec4(c, 1.0); }',
  });
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, m));
  if (stars) {
    const pos = [];
    for (let i = 0; i < stars; i++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2;
      const y = Math.abs(u) * 0.9 + 0.08, r = Math.sqrt(1 - y * y);
      pos.push(Math.cos(a) * r * 300, y * 300, Math.sin(a) * r * 300);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, fog: false })));
  }
  return g;
}

export function moon(pos, color = '#fff6d8', size = 14, glowColor = '#bcd0ff') {
  const g = new THREE.Group();
  const m = mesh(G.ball(size, 2), new THREE.MeshBasicMaterial({ color, fog: false }));
  // craters
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * Math.PI * 2, b = Math.random() * 0.9;
    const c = mesh(G.ball(size * (0.12 + Math.random() * 0.12), 1), new THREE.MeshBasicMaterial({ color: '#d8ccb0', fog: false }));
    c.position.set(Math.cos(a) * Math.sin(b) * size * 0.95, Math.cos(b) * size * 0.95 * (Math.random() < 0.5 ? 1 : -1) * 0.6, Math.sin(a) * Math.sin(b) * size * 0.95);
    m.add(c);
  }
  const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: glowColor, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0.55 }));
  gl.scale.setScalar(size * 5);
  g.add(gl, m);
  g.position.set(pos[0], pos[1], pos[2]);
  return g;
}

// floating platform: textured top disc, rim, jagged rocky cone below
export function platform(surf, o) {
  const g = new THREE.Group();
  const r = surf.r, th = surf.thick ?? 1.4, depth = surf.depth ?? 6.5;
  const top = new THREE.CylinderGeometry(r, r, th, 48, 1, false);
  const mats = [o.side || mat('#666'), o.top || mat('#888'), o.side || mat('#666')];
  const disc = new THREE.Mesh(top, mats);
  disc.position.y = -th / 2;
  disc.receiveShadow = true;
  g.add(disc);
  // planar UVs on the top cap so its texture tiles in metres
  const uv = top.attributes.uv, pos = top.attributes.position;
  const torso = (48 + 1) * 2;
  for (let i = torso; i < pos.count; i++) {
    if (Math.abs(pos.getY(i) - th / 2) < 1e-4) uv.setXY(i, pos.getX(i) / (o.tile || 3), -pos.getZ(i) / (o.tile || 3));
  }
  // side texture wraps around: repeat along the circumference
  for (let i = 0; i < torso; i++) uv.setX(i, uv.getX(i) * Math.round((2 * Math.PI * r) / (o.sideTile || 3)));
  if (!o.noCone) {
    const cone = new THREE.ConeGeometry(r * 0.98, depth, 18, 4, true);
    const p = cone.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y < depth / 2 - 0.01) {
        const k = 1 + (Math.random() - 0.5) * 0.25;
        p.setXYZ(i, p.getX(i) * k, y + (Math.random() - 0.5) * 0.4, p.getZ(i) * k);
      }
    }
    cone.computeVertexNormals();
    const c = new THREE.Mesh(cone, o.under || o.side || mat('#3a3330'));
    c.rotation.x = Math.PI;
    c.position.y = -th - depth / 2;
    g.add(c);
  }
  if (o.rim) {
    const ring = mesh(new THREE.TorusGeometry(r, 0.12, 4, 48), o.rim, [0, 0.02, 0], [Math.PI / 2, 0, 0]);
    g.add(ring);
  }
  g.position.set(surf.cx, surf.y, surf.cz);
  return g;
}

export function softPlatform(surf, topMat, sideMat, thick = 0.35) {
  const g = new THREE.Group();
  const d = new THREE.Mesh(new THREE.CylinderGeometry(surf.r, surf.r * 0.85, thick, 20), [sideMat || topMat, topMat, sideMat || topMat]);
  d.position.y = -thick / 2;
  d.receiveShadow = true; d.castShadow = true;
  g.add(d);
  g.position.set(surf.cx, surf.y, surf.cz);
  return g;
}

// follow the simulation surface (spin, bob, tilt)
export function syncSurface(obj, s) {
  obj.position.set(s.cx, s.y, s.cz);
  if (s.tiltX || s.tiltZ) {
    const n = new THREE.Vector3(-s.tiltX, 1, -s.tiltZ).normalize();
    obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    obj.rotateY(s.angle || 0);
  } else obj.rotation.set(0, s.angle || 0, 0);
  obj.visible = s.active !== false || obj.userData.alwaysVisible;
}

// scatter instances of a mesh on a ring (background dressing)
export function scatter(group, make, n, rMin, rMax, y, opts = {}) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = rMin + Math.random() * (rMax - rMin);
    const o = make(i);
    o.position.set(Math.cos(a) * r, (typeof y === 'function' ? y(i) : y), Math.sin(a) * r);
    o.rotation.y = opts.face ? Math.atan2(-o.position.x, -o.position.z) + (Math.random() - 0.5) * 0.6 : Math.random() * Math.PI * 2;
    if (opts.tilt) { o.rotation.x = (Math.random() - 0.5) * opts.tilt; o.rotation.z = (Math.random() - 0.5) * opts.tilt; }
    const s = opts.scale ? opts.scale[0] + Math.random() * (opts.scale[1] - opts.scale[0]) : 1;
    o.scale.multiplyScalar(s);
    group.add(o);
  }
}

// procedural textures
export const TEX = {
  stoneTiles: (base = '#7d7a86', joint = '#3e3b45') => canvasTex('tiles' + base, 64, (g, s) => {
    g.fillStyle = joint; g.fillRect(0, 0, s, s);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const v = 0.85 + Math.random() * 0.3;
      const c = new THREE.Color(base).multiplyScalar(v);
      g.fillStyle = '#' + c.getHexString();
      g.fillRect(x * 16 + 1 + (y % 2) * 0, y * 16 + 1, 14, 14);
      g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x * 16 + 2 + Math.random() * 8, y * 16 + 2 + Math.random() * 8, 3, 2);
    }
  }),
  rock: (base = '#4a4250') => speckle('rock' + base, base, ['#3a3340', '#5a5262', '#2e2832', '#6a6272'], 64, 120, 1, 4),
  grass: (base = '#2f4a2a') => speckle('grass' + base, base, ['#26401f', '#3a5a32', '#203a1a', '#4a6a3a'], 64, 160, 0.5, 2),
  wood: (base = '#7a4f2a') => canvasTex('wood' + base, 64, (g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(0,0,0,${0.08 + Math.random() * 0.12})`; g.fillRect(0, (i * 13) % s, s, 1 + (i % 2)); }
    for (let i = 0; i < 8; i++) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, i * 8, s, 1); }
  }),
};

export function tombstone(kind = 0) {
  const stone = mat('#8a8794', { map: TEX.rock('#8a8794') });
  if (kind === 0) {
    const g = new THREE.Group();
    g.add(mesh(G.box(0.8, 1.1, 0.22), stone, [0, 0.55, 0]));
    g.add(mesh(G.cyl(0.4, 0.4, 0.22, 8, 1), stone, [0, 1.1, 0], [Math.PI / 2, 0, 0]));
    g.add(mesh(G.box(0.4, 0.08, 0.02), basic('#3a3842'), [0, 0.75, 0.12]));
    return g;
  }
  if (kind === 1) {
    const g = new THREE.Group();
    g.add(mesh(G.box(0.18, 1.5, 0.18), stone, [0, 0.75, 0]));
    g.add(mesh(G.box(0.8, 0.18, 0.18), stone, [0, 1.1, 0]));
    return g;
  }
  const g = new THREE.Group();
  g.add(mesh(G.box(1.0, 0.5, 1.8), stone, [0, 0.25, 0]));
  g.add(mesh(G.box(0.7, 0.9, 0.2), stone, [0, 0.7, -0.75]));
  return g;
}

export function deadTree(h = 6, color = '#2a2026') {
  const m = mat(color);
  const g = new THREE.Group();
  const branch = (len, rad, depth, parent, rx, rz) => {
    const b = new THREE.Group();
    const c = mesh(G.cyl(rad * 0.6, rad, len, 5), m, [0, len / 2, 0]);
    b.add(c);
    b.rotation.set(rx, Math.random() * 6, rz);
    parent.add(b);
    if (depth > 0) {
      const n = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < n; i++) {
        const sub = branch(len * (0.55 + Math.random() * 0.2), rad * 0.6, depth - 1, b, (Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 1.6);
        sub.position.y = len * (0.6 + Math.random() * 0.35);
      }
    }
    return b;
  };
  branch(h * 0.45, h * 0.06, 3, g, 0, 0);
  return g;
}

// merge a prototype object (meshes with any materials) and instance it at many transforms
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
export function instanced(group, proto, transforms) {
  proto.updateMatrixWorld(true);
  const byMat = new Map();
  proto.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const key = o.material.uuid;
    if (!byMat.has(key)) byMat.set(key, { m: o.material, geos: [] });
    byMat.get(key).geos.push(g.index ? g.toNonIndexed() : g);
  });
  const dummy = new THREE.Object3D();
  for (const { m, geos } of byMat.values()) {
    const geo = mergeGeometries(geos, false);
    const im = new THREE.InstancedMesh(geo, m, transforms.length);
    transforms.forEach((t, i) => {
      dummy.position.set(t.x, t.y, t.z); dummy.rotation.set(t.rx || 0, t.ry || 0, t.rz || 0); dummy.scale.setScalar(t.s || 1);
      dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
    });
    group.add(im);
  }
}

export function ringTransforms(n, rMin, rMax, y, opts = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, r = rMin + Math.random() * (rMax - rMin);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    out.push({ x, y: typeof y === 'function' ? y(x, z) : y, z, ry: opts.face ? Math.atan2(-x, -z) + (Math.random() - 0.5) * (opts.jitter ?? 0.6) : Math.random() * 6.28,
      rx: opts.tilt ? (Math.random() - 0.5) * opts.tilt : 0, rz: opts.tilt ? (Math.random() - 0.5) * opts.tilt : 0, s: opts.scale ? opts.scale[0] + Math.random() * (opts.scale[1] - opts.scale[0]) : 1 });
  }
  return out;
}

// wandering ghostly lights / fireflies around the arena
export class Wisps {
  constructor(group, n, color, area = 30, y = [2, 10]) {
    this.items = [];
    const m = new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(m);
      s.scale.setScalar(0.6 + Math.random() * 0.8);
      const o = { s, a: Math.random() * 6.28, r: 10 + Math.random() * area, y: y[0] + Math.random() * (y[1] - y[0]), sp: 0.05 + Math.random() * 0.15, ph: Math.random() * 6 };
      group.add(s);
      this.items.push(o);
    }
  }
  update(t) {
    for (const o of this.items) {
      const a = o.a + t * o.sp;
      o.s.position.set(Math.cos(a) * o.r, o.y + Math.sin(t * 0.8 + o.ph) * 1.2, Math.sin(a) * o.r);
    }
  }
}

// a bat wing silhouette (scalloped edge), drawn once
function batWingTex() {
  if (batWingTex.t) return batWingTex.t;
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.beginPath(); g.moveTo(0, 18); g.quadraticCurveTo(60, 0, 126, 6);
  g.quadraticCurveTo(112, 30, 118, 52); g.quadraticCurveTo(96, 38, 82, 58); g.quadraticCurveTo(66, 40, 46, 60);
  g.quadraticCurveTo(30, 42, 0, 46); g.closePath(); g.fill();
  batWingTex.t = new THREE.CanvasTexture(c);
  return batWingTex.t;
}

export class Bats {
  constructor(group, n, color = '#120a14') {
    this.items = [];
    const m = new THREE.MeshBasicMaterial({ color, map: batWingTex(), alphaTest: 0.5, side: THREE.DoubleSide });
    const body = basic(color);
    for (let i = 0; i < n; i++) {
      const b = new THREE.Group();
      const wing = (sx) => {
        const geo = new THREE.PlaneGeometry(0.95, 0.48);
        geo.translate(0.475, 0, 0); geo.rotateX(-Math.PI / 2);
        const w = new THREE.Mesh(geo, m);
        w.scale.x = sx;
        return w;
      };
      const wl = wing(1), wr = wing(-1);
      b.add(mesh(G.ball(0.13, 1), body, [0, 0, 0], null, [0.8, 0.7, 1.4]), mesh(G.cone(0.05, 0.14, 3), body, [0.06, 0.12, 0.12]), mesh(G.cone(0.05, 0.14, 3), body, [-0.06, 0.12, 0.12]), wl, wr);
      b.scale.setScalar(1.3 + Math.random() * 0.6);
      b.userData = { wl, wr, a: Math.random() * 6.28, r: 14 + Math.random() * 25, y: 6 + Math.random() * 14, sp: 0.2 + Math.random() * 0.3, ph: Math.random() * 6 };
      group.add(b);
      this.items.push(b);
    }
  }
  update(t) {
    for (const b of this.items) {
      const u = b.userData;
      const a = u.a + t * u.sp;
      b.position.set(Math.cos(a) * u.r, u.y + Math.sin(t * 1.3 + u.ph) * 2, Math.sin(a) * u.r);
      b.rotation.y = -a;
      const f = Math.sin(t * 16 + u.ph) * 0.8;
      u.wl.rotation.z = f; u.wr.rotation.z = -f;
    }
  }
}
