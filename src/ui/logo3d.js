// The World of Bagarre logo in 3D, on the title screen (17 Oct 2026). Not a model: the painted logo itself (Codex,
// assets/ui/wob/logo.png) given a thickness, so its face stays the exact art, sharp: its silhouette is traced from the
// image's alpha (one outline per piece: the letters, the stars, the flying rocks), extruded with a rounded bevel, the
// sides in the navy of its outline; the face is the image, lit a little, with a shine sweeping across now and then.
// It flies in spinning from far away and slams in place (onSlam: the sound and the shake), then floats and sways, and
// leans toward the mouse; leave() sends it flying off. A transparent WebGL canvas of its own over the menus' scene,
// placed on the 640x360 grid like the menus (src/ui/pxgrid.js).
//   const L = new Logo3D(parent, url, { x: 320, y: 121, w: 340, onSlam }); ... L.leave(); L.dispose();
import * as THREE from 'three';

const VW = 640, VH = 360, D = 900; // the camera stands D grid units from the grid's plane
const FOV = 2 * Math.atan(VH / 2 / D) * 180 / Math.PI;

// ---- the outlines of the image's opaque parts (marching squares), outer outlines and the holes in them ------------
function contours(img, W) {
  const H = Math.round(img.height * W / img.width);
  const c = document.createElement('canvas'); c.width = W + 2; c.height = H + 2;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 1, 1, W, H);
  const d = g.getImageData(0, 0, W + 2, H + 2).data, w = W + 2, h = H + 2;
  const on = (x, y) => (x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 110 ? 1 : 0);
  // the segments of every cell (between four pixel centres), points on the cell edges
  const nb = new Map();
  const link = (a, b) => { (nb.get(a) || nb.set(a, []).get(a)).push(b); (nb.get(b) || nb.set(b, []).get(b)).push(a); };
  for (let y = 0; y < h - 1; y++) for (let x = 0; x < w - 1; x++) {
    const k = on(x, y) * 8 + on(x + 1, y) * 4 + on(x + 1, y + 1) * 2 + on(x, y + 1);
    if (k === 0 || k === 15) continue;
    const T = (x * 2 + 1) + ',' + (y * 2), R = (x * 2 + 2) + ',' + (y * 2 + 1), B = (x * 2 + 1) + ',' + (y * 2 + 2), L = (x * 2) + ',' + (y * 2 + 1);
    switch (k) {
      case 1: case 14: link(L, B); break;
      case 2: case 13: link(B, R); break;
      case 3: case 12: link(L, R); break;
      case 4: case 11: link(T, R); break;
      case 6: case 9: link(T, B); break;
      case 7: case 8: link(L, T); break;
      case 5: link(L, T); link(B, R); break;
      case 10: link(T, R); link(L, B); break;
      default: break;
    }
  }
  // walk them into closed loops
  const seen = new Set(), loops = [];
  for (const start of nb.keys()) {
    if (seen.has(start)) continue;
    const loop = []; let prev = null, cur = start;
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      const [px, py] = cur.split(',').map(Number);
      loop.push([px / 2 - 1, py / 2 - 1]); // back to image pixels (the 1 px border)
      const n = nb.get(cur) || [];
      const next = n.find((q) => q !== prev && !seen.has(q));
      prev = cur; cur = next;
    }
    if (loop.length >= 8) loops.push(loop);
  }
  return { loops, W, H };
}
const area = (p) => { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return a / 2; };
function inside(pt, poly) {
  let r = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) r = !r;
  }
  return r;
}
// fewer points, same shape (Ramer-Douglas-Peucker, on a closed loop split in two)
function rdp(p, eps) {
  if (p.length < 4) return p;
  const keep = new Uint8Array(p.length); keep[0] = keep[p.length - 1] = 1;
  const st = [[0, p.length - 1]];
  while (st.length) {
    const [a, b] = st.pop();
    let best = -1, bi = -1;
    const [ax, ay] = p[a], [bx, by] = p[b], L = Math.hypot(bx - ax, by - ay) || 1;
    for (let i = a + 1; i < b; i++) { const dd = Math.abs((bx - ax) * (ay - p[i][1]) - (ax - p[i][0]) * (by - ay)) / L; if (dd > best) { best = dd; bi = i; } }
    if (best > eps) { keep[bi] = 1; st.push([a, bi], [bi, b]); }
  }
  return p.filter((_, i) => keep[i]);
}
function simplifyLoop(p, eps) {
  const h = p.length >> 1;
  const a = rdp(p.slice(0, h + 1), eps), b = rdp(p.slice(h).concat([p[0]]), eps);
  return a.slice(0, -1).concat(b.slice(0, -1));
}
// the shapes: each outer outline with the holes right inside it (nesting depth even = outer, odd = hole)
function shapesOf(img, W, toXY) {
  const { loops, H } = contours(img, W);
  const L = loops.map((p) => simplifyLoop(p, 0.45)).filter((p) => p.length >= 4 && Math.abs(area(p)) > 6);
  const depth = L.map((p, i) => L.reduce((n, q, j) => n + (j !== i && Math.abs(area(q)) > Math.abs(area(p)) && inside(p[0], q) ? 1 : 0), 0));
  const shapes = [];
  L.forEach((p, i) => {
    if (depth[i] % 2) return;
    const s = new THREE.Shape(p.map(([x, y]) => toXY(x, y, H)));
    L.forEach((q, j) => { if (depth[j] === depth[i] + 1 && inside(q[0], p)) s.holes.push(new THREE.Path(q.map(([x, y]) => toXY(x, y, H)))); });
    shapes.push(s);
  });
  return { shapes, H };
}

export class Logo3D {
  constructor(parent, url, o = {}) {
    this.o = { x: 320, y: 121, w: 340, ...o };
    this.t = 0; this.state = 'wait'; this.slammed = false; this.tilt = { x: 0, y: 0, tx: 0, ty: 0 };
    const cv = this.cv = document.createElement('canvas');
    cv.className = 'logo3d';
    Object.assign(cv.style, { position: 'fixed', pointerEvents: 'none', zIndex: 5 });
    parent.appendChild(cv);
    try {
      this.gl = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true, premultipliedAlpha: true });
    } catch (e) { this.failed = true; return; }
    this.gl.setClearColor(0x000000, 0);
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(FOV, VW / VH, 10, 4000);
    this.cam.position.set(0, 0, D);
    this.scene.add(new THREE.AmbientLight('#ffffff', 1.1));
    const key = new THREE.DirectionalLight('#fff4e0', 2.2); key.position.set(-300, 400, 600);
    const rim = new THREE.DirectionalLight('#7ad8ff', 1.6); rim.position.set(400, -100, -300);
    this.scene.add(key, rim);
    this.pivot = new THREE.Group();
    this.scene.add(this.pivot);
    this.shine = { value: -1 };
    this.fit = () => this.resize();
    addEventListener('resize', this.fit);
    this.onMove = (e) => { this.tilt.tx = (e.clientX / innerWidth - 0.5) * 2; this.tilt.ty = (e.clientY / innerHeight - 0.5) * 2; };
    addEventListener('pointermove', this.onMove);
    this.resize();
    const img = new Image();
    img.onload = () => { if (!this.dead) this.build(img); };
    img.src = url;
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  build(img) {
    const W = 300, sw = this.o.w, sh = sw * img.height / img.width; // the logo's size on the grid
    const { shapes } = shapesOf(img, W, (x, y, H) => new THREE.Vector2((x / W - 0.5) * sw, (0.5 - y / H) * sh));
    const depth = sw * 0.035, bev = sw * 0.012;
    const geo = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.7, bevelSegments: 4, curveSegments: 1 });
    geo.translate(0, 0, -depth / 2);
    // the faces: the image, placed by position (the side walls take the navy)
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / sw + 0.5, pos.getY(i) / sh + 0.5);
    const tex = new THREE.Texture(img); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; tex.needsUpdate = true;
    const face = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.55, roughness: 0.35, metalness: 0.05 });
    // a band of light sweeping across the face
    face.onBeforeCompile = (s) => {
      s.uniforms.uShine = this.shine;
      s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uShine;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  { float b = vMapUv.x * 0.8 + vMapUv.y * 0.35 - uShine; totalEmissiveRadiance += vec3(1.0, 0.97, 0.9) * smoothstep(0.07, 0.0, abs(b)) * 0.9; }`);
    };
    const side = new THREE.MeshStandardMaterial({ color: '#16224a', roughness: 0.4, metalness: 0.35 });
    this.mesh = new THREE.Mesh(geo, [face, side]);
    this.pivot.add(this.mesh);
    // a glow behind it
    const gc = document.createElement('canvas'); gc.width = gc.height = 128;
    const gg = gc.getContext('2d'), gr = gg.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,200,90,0.55)'); gr.addColorStop(1, 'rgba(255,200,90,0)'); gg.fillStyle = gr; gg.fillRect(0, 0, 128, 128);
    this.glow = new THREE.Mesh(new THREE.PlaneGeometry(sw * 1.5, sh * 1.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gc), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    this.glow.position.z = -depth * 3;
    this.pivot.add(this.glow);
    this.state = 'in'; this.t = 0;
  }

  // the canvas covers the 640x360 grid exactly (like the .px boxes), at the screen's own pixels
  resize() {
    const k = Math.min(innerWidth / VW, innerHeight / VH), dpr = Math.min(2, window.devicePixelRatio || 1);
    Object.assign(this.cv.style, { left: Math.round((innerWidth - VW * k) / 2) + 'px', top: Math.round((innerHeight - VH * k) / 2) + 'px', width: Math.round(VW * k) + 'px', height: Math.round(VH * k) + 'px' });
    if (this.gl) this.gl.setSize(Math.round(VW * k * dpr), Math.round(VH * k * dpr), false);
  }

  leave() { if (this.state !== 'wait') { this.state = 'out'; this.t = 0; } }

  frame(now) {
    if (this.dead) return;
    this.raf = requestAnimationFrame((t) => this.frame(t));
    const dt = Math.min(0.05, this.last ? (now - this.last) / 1000 : 1 / 60);
    this.last = now;
    if (this.state === 'wait' || !this.mesh) return;
    this.t += dt;
    const T = this.t, P = this.pivot, o = this.o;
    const L = this.tilt; L.x += (L.tx - L.x) * Math.min(1, dt * 4); L.y += (L.ty - L.y) * Math.min(1, dt * 4);
    const bx = o.x - VW / 2, by = VH / 2 - o.y;
    if (this.state === 'in') {
      // from far away, spinning, then the slam (a little overshoot)
      const u = Math.min(1, T / 0.7), e = 1 - Math.pow(1 - u, 3);
      P.position.set(bx, by + (1 - e) * 60, -2600 * (1 - e) + Math.sin(u * Math.PI) * 40);
      P.rotation.set((1 - e) * 0.6, (1 - e) * Math.PI * 3, (1 - e) * -0.4);
      if (u >= 1) {
        this.state = 'idle'; this.idleT = 0;
        if (!this.slammed) { this.slammed = true; this.kick = 1; if (this.o.onSlam) this.o.onSlam(); }
      }
    } else if (this.state === 'idle') {
      this.idleT += dt;
      const t = this.idleT;
      this.kick = Math.max(0, (this.kick || 0) - dt * 4);
      const s = 1 + this.kick * 0.12 * Math.cos(t * 30);
      P.scale.setScalar(s);
      P.position.set(bx, by + Math.sin(t * 1.6) * 3, Math.sin(t * 0.9) * 10);
      P.rotation.set(Math.sin(t * 1.1) * 0.05 - L.y * 0.12, Math.sin(t * 0.7) * 0.16 + L.x * 0.22, Math.sin(t * 0.9 + 1) * 0.025);
      // the shine sweeps across every 3.5 s
      const k = (t % 3.5) / 0.9;
      this.shine.value = k < 1 ? -0.3 + k * 1.6 : -1;
    } else if (this.state === 'out') {
      const u = Math.min(1, T / 0.26);
      P.position.z += dt * 2600; P.rotation.x -= dt * 2; P.scale.setScalar(1 + u * 0.3);
      this.mesh.material.forEach((m) => { m.transparent = true; m.opacity = 1 - u; });
    }
    if (this.glow) this.glow.material.opacity = this.state === 'idle' ? 0.5 + 0.15 * Math.sin(this.idleT * 2) : this.state === 'out' ? 0 : Math.min(0.5, T);
    this.gl.render(this.scene, this.cam);
  }

  dispose() {
    this.dead = true;
    cancelAnimationFrame(this.raf);
    removeEventListener('resize', this.fit);
    removeEventListener('pointermove', this.onMove);
    if (this.mesh) { this.mesh.geometry.dispose(); this.mesh.material.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); }
    if (this.gl) { this.gl.dispose(); this.gl.forceContextLoss(); }
    this.cv.remove();
  }
}
