// Materials and small procedural textures in an N64 spirit (low-res, nearest filtering, Gouraud lighting).
import * as THREE from 'three';
import { STYLE } from './style.js';

const texCache = new Map();
const loader = new THREE.TextureLoader();

export function pixelTex(tex, repeat = 1) {
  tex.magFilter = STYLE.smooth ? THREE.LinearFilter : THREE.NearestFilter;
  tex.minFilter = STYLE.smooth ? THREE.LinearMipmapLinearFilter : THREE.NearestMipmapLinearFilter;
  tex.anisotropy = STYLE.smooth ? 8 : 1;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  if (repeat !== 1) tex.repeat.set(repeat, repeat);
  return tex;
}

export function loadTex(url, repeat = 1) {
  const key = url + '|' + repeat;
  if (texCache.has(key)) return texCache.get(key);
  const t = pixelTex(loader.load(url), repeat);
  texCache.set(key, t);
  return t;
}

export function canvasTex(key, size, draw, repeat = 1) {
  const k = key + '|' + repeat;
  if (texCache.has(k)) return texCache.get(k);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size);
  const t = pixelTex(new THREE.CanvasTexture(c), repeat);
  texCache.set(k, t);
  return t;
}

// deterministic noise for textures
function hash(n) { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }

export function speckle(key, base, dots, size = 64, n = 60, rmin = 1, rmax = 3) {
  return canvasTex(key, size, (g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    for (let i = 0; i < n; i++) {
      g.fillStyle = dots[i % dots.length];
      const r = rmin + hash(i * 3.1) * (rmax - rmin);
      g.beginPath(); g.arc(hash(i * 7.7) * s, hash(i * 1.3 + 5) * s, r, 0, Math.PI * 2); g.fill();
    }
  });
}

export function stripes(key, a, b, size = 32, w = 4, vertical = false) {
  return canvasTex(key, size, (g, s) => {
    g.fillStyle = a; g.fillRect(0, 0, s, s);
    g.fillStyle = b;
    for (let i = 0; i < s; i += w * 2) vertical ? g.fillRect(i, 0, w, s) : g.fillRect(0, i, s, w);
  });
}

export function mat(color, opts = {}) {
  const m = STYLE.smooth
    ? new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.82, metalness: 0, ...opts })
    : new THREE.MeshLambertMaterial({ color: new THREE.Color(color), ...opts });
  if (opts.map) m.map = opts.map;
  return m;
}

export function basic(color, opts = {}) {
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(color), ...opts });
}

// soft round blob shadow / glow texture
export const blobTex = (() => {
  let t = null;
  return () => {
    if (t) return t;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
    gr.addColorStop(0, 'rgba(0,0,0,0.85)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    t = new THREE.CanvasTexture(c);
    return t;
  };
})();

export const glowTex = (() => {
  let t = null;
  return () => {
    if (t) return t;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 1, 32, 32, 31);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    t = new THREE.CanvasTexture(c);
    return t;
  };
})();

// low-poly geometry helpers
const seg = (s) => (STYLE.smooth ? Math.max(s, Math.min(48, s * 3)) : s);
export const G = {
  ball: (r, d = 1) => new THREE.IcosahedronGeometry(r, STYLE.smooth ? Math.max(d, 1) + 2 : d),
  box: (x, y, z) => (STYLE.smooth ? G.rbox(x, y, z, 0.12) : new THREE.BoxGeometry(x, y, z)),
  cyl: (rt, rb, h, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s <= 4 ? s : seg(s)),
  cone: (r, h, s = 8) => new THREE.ConeGeometry(r, h, s <= 4 ? s : seg(s)),
  rbox(x, y, z, round = 0.25) {
    // rounded box: a box with a few segments pushed toward a superellipsoid
    const g = new THREE.BoxGeometry(x, y, z, 3, 3, 3);
    const p = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const nx = v.x / (x / 2), ny = v.y / (y / 2), nz = v.z / (z / 2);
      const k = 1 - round * 0.35 * (Math.abs(nx * ny) + Math.abs(ny * nz) + Math.abs(nx * nz)) / 3;
      v.set(v.x * k, v.y * k, v.z * k);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  },
};

export function mesh(geo, material, pos, rot, scale) {
  const m = new THREE.Mesh(geo, material);
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  if (scale) typeof scale === 'number' ? m.scale.setScalar(scale) : m.scale.set(scale[0], scale[1], scale[2]);
  return m;
}

// soft smoke puff (several blurred blobs), shared by dust particles and clouds
export const puffTex = (() => {
  let t = null;
  return () => {
    if (t) return t;
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    for (let i = 0; i < 9; i++) {
      const a = i * 0.7, r = i ? 22 + (i % 3) * 6 : 34;
      const x = 64 + (i ? Math.cos(a) * 20 : 0), y = 64 + (i ? Math.sin(a) * 18 : 0);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.29); g.fill();
    }
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
})();
