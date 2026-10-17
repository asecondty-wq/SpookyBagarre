// ZINZIN BAGARRE (17 oct. 2026) : la destination finale. Une soucoupe ronde, sans plateformes ni pièges, lancée à toute
// vitesse à travers huit mondes, l'un après l'autre (LEG secondes chacun), reliés par un passage en hyperespace.
// Chaque monde : une peinture Codex de ce qui est devant (assets/stages/zz_<monde>/sky.jpg, qui grossit : on fonce
// dedans), un sol peint vu de haut qui défile sous l'arène (ground.jpg), des objets découpés qui passent de chaque côté
// (prop<N>.png, tools/art/zinzin.ps1 + stage_prep.py + cutout.py), et ce que le code fait de mieux : lumières (clair-obscur,
// éclairs, explosions, néons qui balaient l'arène), particules, hyperespace, sons (src/audio/audio.js, zz*).
// Affichage seul : l'heure du voyage vient de l'horloge du match (W.tick), la même chez tous les joueurs ; rien de tout
// ça ne touche la simulation (src/sim/stages/index.js : une dalle de 14 m, c'est tout).
// Rien ne passe devant les combattants : ce qui vole reste loin derrière, en hauteur ou sur les côtés (hors du cadre
// quand ça arrive près), le sol est 55 m plus bas ; tout est créé d'avance et toujours dessiné (shaders compilés au
// début du match, aucun à-coup à l'arrivée d'un monde).
import * as THREE from 'three';
import { STYLE } from '../style.js';
import { glowTex } from '../materials.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const LEG = 26;         // secondes par monde (hyperespace compris)
const WARP = 3.0;       // l'hyperespace, à la fin de chaque monde
const SPEED = 80;       // m/s
const GY = -55;         // le sol, sous l'arène
const ZS = -1150;       // où naissent les objets (loin, dans le brouillard : view.far repousse la caméra)
const ZM = -440;        // les particules et l'hyperespace, eux, restent près
const D2R = Math.PI / 180;
const C = (h) => new THREE.Color(h);
// test: &zzt=<seconds> starts the journey that far (each world: LEG s; 0 prairie, 26 music, 52 war, 78 castle...),
// or window.__zzt = <seconds> in the console
const ZZT = typeof location !== 'undefined' ? Number(new URLSearchParams(location.search).get('zzt')) || 0 : 0;

// les mondes : nom, couleurs de secours (avant que la peinture ne soit chargée : elle les remplace), lumières, accent
// de l'arène, objets (cards : par image du découpage, au sol ou en l'air, hauteur en m), effets et sons
const WORLDS = [
  { id: 'prairie', name: 'PRAIRIE ARC-EN-CIEL', zen: '#7fb6ff', hor: '#ffd1e8', bot: '#8fd36a', fog: '#f4c9dc', accent: '#ff5ad8',
    hemi: ['#fff1f8', '#6a8a4a', 1.15], key: ['#fff0d0', 2.1, [-0.6, 1, 0.45]], rim: ['#ff9ad8', 0.84], clouds: 1, stars: 0, motes: 'petal', rainbow: 1, rays: 1 },
  { id: 'music', name: 'ROYAUME MÉLODIQUE', zen: '#3a2a6a', hor: '#ffb04a', bot: '#7a4a2a', fog: '#e09a5a', accent: '#ffcc33',
    hemi: ['#ffe2b8', '#4a2a1a', 1.0], key: ['#ffc070', 2.2, [0.7, 0.8, 0.3]], rim: ['#ffd84a', 0.96], clouds: 0.7, stars: 0.2, motes: 'note', beat: 1 },
  { id: 'war', name: 'CHAMP DE BATAILLE', zen: '#2a1418', hor: '#c85a2a', bot: '#3a2a1e', fog: '#7a3a22', accent: '#ff5a1f',
    hemi: ['#ffb08a', '#2a1a12', 0.8], key: ['#ff9a5a', 2.0, [0.8, 0.55, 0.2]], rim: ['#ff4a1a', 1.08], clouds: 0.5, stars: 0, motes: 'ember', war: 1 },
  { id: 'castle', name: 'CHÂTEAU HANTÉ', zen: '#120a24', hor: '#5a3a8a', bot: '#1a1228', fog: '#2a1a44', accent: '#a45cff',
    hemi: ['#b8a8ff', '#120a1e', 0.7], key: ['#c8b8ff', 1.5, [-0.5, 0.9, 0.5]], rim: ['#9a5aff', 1.20], clouds: 0.8, stars: 0.4, motes: 'rain', storm: 1 },
  { id: 'cemetery', name: 'CIMETIÈRE FLIPPANT', zen: '#0a0608', hor: '#5a1a1a', bot: '#101a12', fog: '#24181a', accent: '#3dff8a',
    hemi: ['#ffb0a0', '#0a140c', 0.65], key: ['#ff7a5a', 1.6, [0.3, 0.7, -0.4]], rim: ['#3dff8a', 1.32], clouds: 0.3, stars: 0.6, motes: 'wisp', ghost: 1 },
  { id: 'abyss', name: 'ABYSSES LUMINEUSES', zen: '#0a3a6a', hor: '#0a2a5a', bot: '#04101e', fog: '#06244a', accent: '#2ef2ff',
    hemi: ['#7ad8ff', '#041020', 0.85], key: ['#8af0ff', 1.6, [0.1, 1, 0.2]], rim: ['#ff5ad0', 0.96], clouds: 0, stars: 0, motes: 'bubble', caustic: 1, rays: 1 },
  { id: 'neon', name: 'NÉO-ZINZIN CITY', zen: '#0a0620', hor: '#5a1a6a', bot: '#0a0818', fog: '#2a0e3a', accent: '#ff2bd6',
    hemi: ['#c8a8ff', '#0a0618', 0.7], key: ['#7af0ff', 1.5, [-0.7, 0.8, 0.3]], rim: ['#ff2bd6', 1.44], clouds: 0, stars: 0.3, motes: 'spark', neon: 1 },
  { id: 'space', name: 'ESPACE ABSURDE', zen: '#05020e', hor: '#2a0a4a', bot: '#05020e', fog: '#12061e', accent: '#7dff3a',
    hemi: ['#d0b8ff', '#100820', 0.8], key: ['#ffffff', 1.9, [0.6, 0.9, 0.5]], rim: ['#b48aff', 1.08], clouds: 0, stars: 1, motes: 'star', space: 1 },
];
// les objets de chaque monde (dans l'ordre du découpage de leur planche, tools/art/cutout.py) : air = en vol,
// h = hauteur en m [min, max], n = combien par seconde
const CARDS = {
  prairie: [{ h: [22, 40], n: 1.2 }, { h: [14, 26], n: 1.2 }, { air: 1, h: [24, 40], n: 0.35 }, { h: [20, 34], n: 1 }, { h: [10, 18], n: 0.8 }, { air: 1, h: [8, 14], n: 0.5 }],
  music: [{ h: [40, 70], n: 0.6 }, { h: [36, 60], n: 0.6 }, { h: [24, 40], n: 0.6 }, { h: [22, 36], n: 0.6 }, { h: [18, 30], n: 0.8 }, { air: 1, h: [14, 22], n: 0.4 }],
  war: [{ h: [8, 12], n: 1.2 }, { air: 1, h: [8, 12], n: 0.6 }, { h: [8, 12], n: 0.8 }, { h: [6, 9], n: 1 }, { h: [16, 26], n: 0.7 }, { air: 1, h: [16, 24], n: 0.2 }],
  castle: [{ h: [50, 90], n: 0.5 }, { h: [16, 26], n: 0.6 }, { h: [24, 40], n: 0.8 }, { air: 1, h: [8, 12], n: 0.4 }, { air: 1, h: [10, 16], n: 0.5 }, { h: [20, 34], n: 0.5 }],
  cemetery: [{ h: [24, 44], n: 0.5 }, { h: [8, 14], n: 2 }, { h: [16, 26], n: 0.6 }, { h: [14, 22], n: 0.6 }, { h: [10, 16], n: 0.7 }, { h: [10, 16], n: 0.9 }],
  abyss: [{ air: 1, h: [12, 22], n: 0.9, cut: 0.12 }, { air: 1, h: [10, 16], n: 0.4 }, { h: [30, 60], n: 0.9 }, { h: [16, 26], n: 0.4 }, { h: [30, 50], n: 0.4 }, { h: [8, 12], n: 0.4 }],
  neon: [{ h: [70, 130], n: 1.4 }, { air: 1, h: [6, 10], n: 0.9 }, { air: 1, h: [16, 28], n: 0.3, cut: 0.15 }, { h: [50, 90], n: 0.5 }, { air: 1, h: [14, 22], n: 0.25 }, { h: [24, 40], n: 0.5 }],
  space: [{ air: 1, h: [20, 40], n: 0.35 }, { air: 1, h: [14, 26], n: 0.3 }, { air: 1, h: [8, 14], n: 0.4 }, { air: 1, h: [20, 36], n: 0.3 }, { air: 1, h: [10, 18], n: 0.4 }, { air: 1, h: [8, 14], n: 0.4 }],
};

// ---- les images (chargées pour le monde en cours et le suivant, libérées ensuite) -------------------------------------
// (decoded off the main thread: an ImageBitmap; a big JPEG decoded when it is first sent to the graphics card froze
// the game 60 to 75 ms)
const bitmaps = typeof createImageBitmap !== 'undefined';
const loader = bitmaps ? new THREE.ImageBitmapLoader().setOptions({ imageOrientation: 'flipY', premultiplyAlpha: 'none' }) : new THREE.TextureLoader();
const TEX = new Map();
function tex(url, o = {}) {
  let t = TEX.get(url);
  if (t) return t;
  if (bitmaps) {
    t = new THREE.Texture();
    t.flipY = false;
    loader.load(url, (bmp) => { if (t.userData.gone) { bmp.close && bmp.close(); return; } t.image = bmp; t.needsUpdate = true; t.userData.ok = true; for (const f of t.userData.wait) f(t); t.userData.wait = []; }, undefined, () => { t.userData.failed = true; });
  } else t = loader.load(url, (x) => { x.userData.ok = true; for (const f of x.userData.wait) f(x); x.userData.wait = []; }, undefined, () => { t.userData.failed = true; });
  t.userData.wait = [];
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = STYLE.smooth ? 8 : 1;
  if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  TEX.set(url, t);
  return t;
}
const whenLoaded = (t, f) => { if (t.userData.ok) f(t); else t.userData.wait.push(f); };
function release(prefix) {
  for (const [u, t] of TEX) if (u.startsWith(prefix)) { t.userData.gone = true; t.dispose(); TEX.delete(u); }
}
const PROPS = new Map(); // monde -> [{ w, h }] (props.json)
function propsOf(wid) {
  if (PROPS.has(wid)) return PROPS.get(wid);
  const list = [];
  PROPS.set(wid, list);
  fetch(`assets/stages/zz_${wid}/props.json`).then((r) => (r.ok ? r.json() : [])).then((a) => { a.forEach((p, i) => { list[i] = p; }); list.ready = true; }).catch(() => { list.ready = true; });
  return list;
}
// average colour of a band of an image (0..1 from the top)
function band(img, v0, v1) {
  const c = document.createElement('canvas'); c.width = c.height = 16;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, img.height * v0, img.width, Math.max(1, img.height * (v1 - v0)), 0, 0, 16, 16);
  const d = g.getImageData(0, 0, 16, 16).data;
  let r = 0, gg = 0, b = 0;
  for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
  const n = d.length / 4;
  return new THREE.Color().setRGB(r / n / 255, gg / n / 255, b / n / 255, THREE.SRGBColorSpace);
}

// ---- le ciel : dégradé, nuages qui filent au-dessus, étoiles, nébuleuse, trou noir ; l'hyperespace et l'éclair d'arrivée
const NOISE = `
float h31(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float h11(float x) { return fract(sin(x * 127.1) * 43758.5453); }
float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; } return s; }
`;
const SKY_FS = `
struct Wd { vec3 zen; vec3 hor; vec3 bot; vec3 acc; vec4 p; };
uniform Wd wA; uniform Wd wB;
uniform float uMix, uWarp, uFlash, uTime, uTravel, uBank, uBolt;
uniform vec3 uWarpCol;
varying vec3 vP;
${NOISE}
vec3 stars(vec3 d) {
  vec3 g = d * 160.0, id = floor(g), f = fract(g) - 0.5;
  float h = h31(id);
  if (h < 0.975) return vec3(0.0);
  vec3 o = vec3(h31(id + 7.1), h31(id + 13.3), h31(id + 3.7)) - 0.5;
  float b = smoothstep(0.25, 0.0, length(f - o * 0.5)) * (0.5 + 0.5 * (h - 0.975) / 0.025);
  return vec3(b * (0.8 + 0.2 * sin(uTime * 2.0 + h * 90.0))) * mix(vec3(0.8, 0.9, 1.0), vec3(1.0, 0.85, 0.75), fract(h * 11.0));
}
// p: x clouds, y stars, z nebula + black hole (space), w god rays
vec3 skyOf(Wd w, vec3 d) {
  float h = d.y;
  vec3 c = h >= 0.0 ? mix(w.hor, w.zen, smoothstep(0.0, 0.55, h)) : mix(w.hor, w.bot, smoothstep(0.0, 0.3, -h));
  c += w.hor * exp(-abs(h) * 18.0) * 0.25;
  // a deck of clouds rushing overhead (we fly under it)
  if (w.p.x > 0.0 && h > 0.0) {
    vec2 q = d.xz / (h + 0.05) * 0.035; q.y += uTravel * 0.0016;
    float n = fbm(vec3(q * 3.0, uTime * 0.03));
    float cl = smoothstep(0.48, 0.78, n) * smoothstep(0.02, 0.2, h) * w.p.x;
    c = mix(c, mix(w.hor, vec3(1.0), 0.45) * (0.7 + 0.5 * n), cl * 0.75);
  }
  c += stars(d) * w.p.y * (w.p.z > 0.0 ? 1.0 : smoothstep(0.0, 0.25, h));
  if (w.p.z > 0.0) {
    float n = fbm(d * 2.2 + vec3(0.0, 0.0, uTime * 0.01)), n2 = fbm(d * 4.0 + 7.0);
    c += mix(vec3(0.9, 0.2, 0.8), vec3(0.2, 0.6, 1.0), n2) * smoothstep(0.42, 0.85, n) * 0.55 * w.p.z;
    // the black hole, up on the right: a dark disc in a swirling ring of light
    vec3 bh = normalize(vec3(0.55, 0.32, -1.0));
    float r = acos(clamp(dot(d, bh), -1.0, 1.0));
    vec3 t1 = normalize(cross(bh, vec3(0.0, 1.0, 0.0))), t2 = cross(t1, bh);
    float a = atan(dot(d, t2), dot(d, t1));
    float ring = exp(-pow((r - 0.075) / 0.03, 2.0)) * (0.6 + 0.4 * sin(a * 3.0 - uTime * 2.5 + r * 60.0));
    c += mix(vec3(1.0, 0.55, 0.15), vec3(1.0, 0.95, 0.8), ring) * ring * 1.6 * w.p.z;
    c *= mix(1.0, smoothstep(0.035, 0.05, r), w.p.z);
  }
  // god rays from above, slowly turning
  if (w.p.w > 0.0 && h > -0.1) {
    float a = atan(d.x, -d.z);
    float r = pow(0.5 + 0.5 * sin(a * 22.0 + sin(a * 5.0 + uTime * 0.2) * 3.0 + uTime * 0.15), 6.0);
    c += w.acc * 0.0 + mix(w.hor, vec3(1.0), 0.6) * r * smoothstep(-0.1, 0.4, h) * 0.18 * w.p.w;
  }
  return c;
}
void main() {
  vec3 d = normalize(vP);
  float cb = cos(uBank), sb = sin(uBank);
  d = vec3(cb * d.x + sb * d.y, -sb * d.x + cb * d.y, d.z);
  vec3 c = mix(skyOf(wA, d), skyOf(wB, d), uMix);
  // a fork of lightning lights the whole sky
  c += vec3(0.75, 0.7, 1.0) * uBolt * (0.4 + 0.6 * smoothstep(-0.2, 0.5, d.y));
  // hyperspace: streaks of light rushing out of the vanishing point, the light at the end of the tunnel
  if (uWarp > 0.001) {
    vec3 f = normalize(vec3(0.0, -0.05, -1.0));
    float al = dot(d, f);
    vec3 sd = d - f * al;
    float r = length(sd) / max(al, 0.04);
    float a = atan(sd.y, sd.x);
    float fa = (a + 3.14159) / 6.28318 * 180.0;
    float id = floor(fa);
    float ln = h11(id), ln2 = h11(id + 51.0);
    // thin lines (across their lane), a bright head and a long fading tail (along the way)
    float across = pow(max(0.0, 1.0 - abs(fract(fa) - 0.5) * 2.0 / (0.25 + 0.25 * ln)), 2.0);
    float x = fract(ln * 17.0 + log(r + 0.02) * 0.9 - uTime * (1.2 + ln2 * 2.4));
    float st = pow(x, 5.0) * smoothstep(1.0, 0.97, x) * across;
    st *= smoothstep(0.03, 0.25, r) * step(0.3, ln2);
    vec3 wc = mix(uWarpCol, vec3(0.75, 0.85, 1.0), ln * 0.5);
    c = mix(c, c * 0.06 + uWarpCol * 0.05, uWarp * 0.95);
    c += wc * st * uWarp * 2.2;
    c += mix(uWarpCol, vec3(1.0), 0.4) * exp(-r * 9.0) * uWarp * 0.7;
  }
  c += vec3(1.0, 0.97, 0.92) * uFlash;
  gl_FragColor = vec4(c, 1.0);
}`;

// ---- la peinture de ce qui est devant (deux couches : l'ancien monde et le nouveau, en fondu) -------------------------
const PAINT_FS = `
uniform sampler2D map; uniform float uOp; uniform float uZoom; uniform float uGain; uniform float uWarp; varying vec2 vUv;
void main() {
  vec2 uv = vec2(1.0 - vUv.x, vUv.y);
  vec2 c0 = vec2(0.5, 0.7);
  uv = c0 + (uv - c0) / uZoom;
  vec4 c = texture2D(map, uv);
  float ex = smoothstep(0.0, 0.16, vUv.x) * smoothstep(0.0, 0.16, 1.0 - vUv.x);
  float ey = smoothstep(0.0, 0.1, vUv.y) * smoothstep(0.0, 0.14, 1.0 - vUv.y);
  gl_FragColor = vec4(c.rgb * uGain, ex * ey * uOp * (1.0 - uWarp));
}`;

// ---- le sol peint qui défile (deux couches en fondu), qui se fond dans la peinture au loin ----------------------------
const GROUND_VS = 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
const GROUND_FS = `
uniform sampler2D mapA; uniform sampler2D mapB; uniform float uHasA, uHasB, uMix, uTile, uTravelA, uTravelB, uFadeN, uFadeF, uWarp, uTime;
uniform vec3 uFogA, uFogB, uTintA, uTintB; uniform vec4 uBlast; uniform vec3 uBlastCol;
varying vec3 vW;
void main() {
  vec2 pA = vec2(vW.x, vW.z - uTravelA) / uTile, pB = vec2(vW.x, vW.z - uTravelB) / uTile;
  vec3 a = texture2D(mapA, pA).rgb * uTintA, b = texture2D(mapB, pB).rgb * uTintB;
  float hA = uHasA, hB = uHasB;
  vec3 c = mix(a, b, uMix);
  float has = mix(hA, hB, uMix);
  vec3 fogc = mix(uFogA, uFogB, uMix);
  float dist = distance(cameraPosition, vW);
  float f = smoothstep(uFadeN, uFadeF, dist);
  c = mix(c, fogc, pow(f, 0.7)); // (far away it takes the colour of the painting just under its horizon)
  // an explosion lights the ground around it
  c += uBlastCol * uBlast.w * exp(-distance(vW.xz, uBlast.xy) / uBlast.z);
  float alpha = has * (1.0 - smoothstep(uFadeN + (uFadeF - uFadeN) * 0.6, uFadeF, dist)) * (1.0 - uWarp * 0.85);
  gl_FragColor = vec4(c, alpha);
}`;

// ---- les flammes des réacteurs, le halo ---------------------------------------------------------------------------
const FLAME_FS = `
uniform vec3 uCol; uniform float uTime; uniform float uPow; varying vec2 vUv;
${NOISE}
void main() {
  float y = vUv.y; // 1 = at the nozzle
  float n = vnoise(vec3(vUv.x * 6.0, y * 4.0 - uTime * 14.0, uTime * 3.0));
  float core = smoothstep(0.0, 0.9, y) * (0.6 + 0.5 * n);
  float edge = 1.0 - abs(vUv.x - 0.5) * 2.0;
  vec3 c = mix(uCol, vec3(1.0, 0.98, 0.9), smoothstep(0.55, 1.0, y) * edge);
  gl_FragColor = vec4(c * core * uPow * 1.6, core * uPow);
}`;
const UV_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';

// ---- textures faites en code ---------------------------------------------------------------------------------------
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// les petites particules de chaque monde : pétale, note, braise, goutte, feu follet, bulle, étincelle, étoile
const MOTES = {};
function moteTex(kind) {
  if (MOTES[kind]) return MOTES[kind];
  const t = canvasTex(64, 64, (g, w, h) => {
    g.translate(32, 32);
    const glow = (r, c) => { const gr = g.createRadialGradient(0, 0, 0, 0, 0, r); gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill(); };
    if (kind === 'petal') { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(0, 0, 26, 12, 0.6, 0, 7); g.fill(); }
    else if (kind === 'note') { glow(30, 'rgba(255,255,255,0.35)'); g.fillStyle = '#fff'; g.beginPath(); g.ellipse(-6, 14, 11, 8, -0.4, 0, 7); g.fill(); g.fillRect(3, -24, 5, 38); g.beginPath(); g.moveTo(8, -24); g.quadraticCurveTo(24, -14, 18, 2); g.quadraticCurveTo(20, -12, 8, -14); g.fill(); }
    else if (kind === 'rain') { const gr = g.createLinearGradient(0, -30, 0, 30); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,0.9)'); g.fillStyle = gr; g.fillRect(-1.5, -30, 3, 60); }
    else if (kind === 'bubble') { g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 22, 0, 7); g.stroke(); g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.arc(-8, -8, 5, 0, 7); g.fill(); }
    else if (kind === 'star') { glow(30, 'rgba(255,255,255,0.5)'); g.fillStyle = '#fff'; g.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5, r = i % 2 ? 7 : 22; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.fill(); }
    else glow(30, 'rgba(255,255,255,1)');
  });
  MOTES[kind] = t;
  return t;
}
// ---- des objets qui défilent : une InstancedMesh par image, toujours dessinée (des copies à l'échelle 0 en réserve) --
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
class Flock {
  constructor(parent, geo, mat, cap) {
    this.cap = cap; this.items = []; this.n = 0;
    this.mesh = new THREE.InstancedMesh(geo, mat, cap);
    this.mesh.frustumCulled = false;
    for (let i = 0; i < cap; i++) this.mesh.setMatrixAt(i, ZERO);
    parent.add(this.mesh);
  }
  add(it) { if (this.items.length >= this.cap) return null; this.items.push(it); return it; }
  update(dt, dz, t) {
    let n = 0;
    const keep = [];
    for (const it of this.items) {
      it.z += dz * (it.k ?? 1) + (it.vz || 0) * dt;
      it.x += (it.vx || 0) * dt;
      if (it.step) it.step(it, dt, t);
      if (it.z > (it.zEnd ?? 40)) continue;
      _e.set(it.rx || 0, it.ry || 0, it.rz || 0);
      _m.compose(_p.set(it.x, it.y + (it.bob ? Math.sin(t * it.bobF + it.ph) * it.bob : 0), it.z), _q.setFromEuler(_e), _s.set(it.sx, it.sy, it.sz ?? 1));
      this.mesh.setMatrixAt(n++, _m);
      keep.push(it);
    }
    for (let i = n; i < this.n; i++) this.mesh.setMatrixAt(i, ZERO);
    this.items = keep; this.n = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  clear() { this.items = []; }
}

export function buildZinzin(def) {
  const group = new THREE.Group();
  const scenery = new THREE.Group(); // banks a little with the flight (the arena stays level: it is the simulation)
  group.add(scenery);
  const R0 = def.surfaces[0].r;

  // --- the sky (and hyperspace) ---
  const mkW = (w) => ({ zen: C(w.zen), hor: C(w.hor), bot: C(w.bot), acc: C(w.accent), p: new THREE.Vector4(w.clouds || 0, w.stars || 0, w.space ? 1 : 0, w.rays || 0) });
  const SU = {
    wA: { value: mkW(WORLDS[0]) }, wB: { value: mkW(WORLDS[1]) }, uMix: { value: 0 }, uWarp: { value: 0 }, uFlash: { value: 0 },
    uTime: { value: 0 }, uTravel: { value: 0 }, uBank: { value: 0 }, uBolt: { value: 0 }, uWarpCol: { value: C('#9a6aff') },
  };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1550, 40, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: SU,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: SKY_FS,
  }));
  sky.frustumCulled = false; sky.renderOrder = -10;
  group.add(sky);

  // --- the paintings ahead (A: the world we are in, B: the next one, during hyperspace) ---
  const span = 132 * D2R, tall = 88, hz = 0.3, eh = -3, ptop = eh + hz * tall, pbot = ptop - tall;
  // (behind everything that flies past: the props are born up to -ZS away, and a painting in front of them drew over
  // them, the ground then showing through their shape)
  const paintGeo = new THREE.SphereGeometry(1450, 64, 32, Math.PI * 1.5 - span / 2, span, (90 - ptop) * D2R, tall * D2R);
  const mkPaint = () => {
    const m = new THREE.ShaderMaterial({ side: THREE.BackSide, transparent: true, depthWrite: false, fog: false,
      uniforms: { map: { value: null }, uOp: { value: 0 }, uZoom: { value: 1 }, uGain: { value: 1 }, uWarp: { value: 0 } }, vertexShader: UV_VS, fragmentShader: PAINT_FS });
    const o = new THREE.Mesh(paintGeo, m);
    o.frustumCulled = false; o.renderOrder = -9;
    scenery.add(o);
    return o;
  };
  const paints = [mkPaint(), mkPaint()];
  const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1); blank.needsUpdate = true; // (transparent: nothing shows until the image is there)
  for (const p of paints) p.material.uniforms.map.value = blank;

  // --- the ground far below, scrolling ---
  const GU = {
    mapA: { value: blank }, mapB: { value: blank }, uHasA: { value: 0 }, uHasB: { value: 0 }, uMix: { value: 0 }, uTile: { value: 320 },
    uTravelA: { value: 0 }, uTravelB: { value: 0 }, uFadeN: { value: 420 }, uFadeF: { value: 1300 }, uWarp: { value: 0 }, uTime: { value: 0 },
    uFogA: { value: C('#888') }, uFogB: { value: C('#888') }, uTintA: { value: C('#fff') }, uTintB: { value: C('#fff') },
    uBlast: { value: new THREE.Vector4(0, -200, 40, 0) }, uBlastCol: { value: C('#ff7a2a') },
  };
  const groundGeo = new THREE.PlaneGeometry(3600, 1500, 1, 1);
  groundGeo.rotateX(-Math.PI / 2); groundGeo.translate(0, GY, -650);
  const ground = new THREE.Mesh(groundGeo, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, uniforms: GU, vertexShader: GROUND_VS, fragmentShader: GROUND_FS }));
  ground.frustumCulled = false; ground.renderOrder = -8;
  scenery.add(ground);

  // --- lights: a key light that throws the shadows (chiaroscuro), a coloured rim from behind, a fill, and one light
  //     for the events (explosions, neon sweeping past, ghost fire): always there, at 0 when idle (no shader recompiled)
  const hemi = new THREE.HemisphereLight('#ffffff', '#333333', 1);
  const key = new THREE.DirectionalLight('#ffffff', 2);
  if (STYLE.shadows) {
    key.castShadow = true;
    const c = key.shadow.camera;
    c.left = -26; c.right = 26; c.top = 26; c.bottom = -26; c.near = 5; c.far = 140;
    key.shadow.mapSize.set(2048, 2048); // (like the other arenas: 3072 is heavy for small graphics cards)
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.04; key.shadow.radius = 3;
  }
  const rim = new THREE.DirectionalLight('#ffffff', 1.5);
  rim.position.set(0, 18, -40);
  const ev = new THREE.PointLight('#ff7a2a', 0, 90, 1.2);
  ev.position.set(0, 10, -20);
  group.add(hemi, key, key.target, rim, rim.target, ev);

  // --- the arena: a flying saucer ---
  const arena = new THREE.Group();
  const topTex = tex('assets/stages/zinzin/top.jpg');
  const th = def.surfaces[0].thick ?? 1, dp = def.surfaces[0].depth ?? 3.2;
  const metal = new THREE.MeshStandardMaterial({ color: '#3a3d4a', roughness: 0.38, metalness: 0.35 });
  const dark = new THREE.MeshStandardMaterial({ color: '#16171e', roughness: 0.5, metalness: 0.3 });
  const deck = new THREE.MeshStandardMaterial({ color: '#2a2c36', roughness: 0.85, metalness: 0.1 }); // (matte: a shiny deck caught the key light as a white glare)
  // (the painted floor also glows by itself: its neon lines light up in the bloom)
  whenLoaded(topTex, () => { deck.map = topTex; deck.emissiveMap = topTex; deck.emissive.set('#ffffff'); deck.emissiveIntensity = 0.22; deck.color.set('#ffffff'); deck.needsUpdate = true; });
  const discGeo = new THREE.CylinderGeometry(R0, R0, th, 72, 1, false);
  { // top cap UVs: the painted floor fills the disc
    const uv = discGeo.attributes.uv, pos = discGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) if (Math.abs(pos.getY(i) - th / 2) < 1e-4) uv.setXY(i, pos.getX(i) / (2 * R0) + 0.5, -pos.getZ(i) / (2 * R0) + 0.5);
  }
  const disc = new THREE.Mesh(discGeo, [metal, deck, dark]);
  disc.position.y = -th / 2; disc.receiveShadow = true; disc.castShadow = false;
  arena.add(disc);
  // the hull under it: a smooth lathe down to the engines' core
  const prof = [];
  for (let i = 0; i <= 14; i++) { const u = i / 14; prof.push(new THREE.Vector2(Math.max(0.01, R0 * (1 - u) * (1 - 0.35 * u) + 1.6 * u), -th - dp * Math.sin(u * Math.PI / 2))); }
  const hull = new THREE.Mesh(new THREE.LatheGeometry(prof.reverse(), 72), metal);
  arena.add(hull);
  const accentMat = new THREE.MeshBasicMaterial({ color: '#ff5ad8', toneMapped: false });
  const haloMat = new THREE.MeshBasicMaterial({ color: '#ff5ad8', transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
  const strip = new THREE.Mesh(new THREE.TorusGeometry(R0 + 0.02, 0.08, 6, 96), accentMat);
  strip.rotation.x = Math.PI / 2; strip.position.y = -th + 0.18;
  const lip = new THREE.Mesh(new THREE.TorusGeometry(R0 - 0.05, 0.06, 6, 96), accentMat);
  lip.rotation.x = Math.PI / 2; lip.position.y = 0.02;
  const halo = new THREE.Mesh(new THREE.TorusGeometry(R0, 0.5, 8, 96), haloMat);
  halo.rotation.x = Math.PI / 2; halo.scale.z = 0.25; halo.position.y = -th * 0.5; halo.renderOrder = 3;
  // the core ring under the hull, turning
  const core = new THREE.Group();
  const coreRing = new THREE.Mesh(new THREE.TorusGeometry(5.5, 0.18, 8, 64), accentMat);
  coreRing.rotation.x = Math.PI / 2;
  const coreHalo = new THREE.Mesh(new THREE.TorusGeometry(5.5, 0.9, 8, 64), haloMat);
  coreHalo.rotation.x = Math.PI / 2; coreHalo.scale.z = 0.3;
  for (let i = 0; i < 6; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 2.2), accentMat);
    fin.position.set(Math.cos(i * Math.PI / 3) * 5.5, 0, Math.sin(i * Math.PI / 3) * 5.5); fin.rotation.y = -i * Math.PI / 3;
    core.add(fin);
  }
  core.add(coreRing, coreHalo); core.position.y = -th - dp * 0.82;
  arena.add(strip, lip, halo, core);
  // engines under the hull, blowing down and back (toward the camera, under the fighters)
  const flameMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uCol: { value: C('#ff5ad8') }, uTime: { value: 0 }, uPow: { value: 1 } }, vertexShader: UV_VS, fragmentShader: FLAME_FS });
  const flameGeo = new THREE.ConeGeometry(1.1, 9, 16, 1, true); flameGeo.translate(0, -4.5, 0);
  const flames = [];
  for (const [x, z] of [[-6.5, -3], [6.5, -3], [-3.5, 4.5], [3.5, 4.5]]) {
    const r = Math.hypot(x, z), yy = -th - dp * Math.sin((1 - Math.min(1, (r - 1.6) / (R0 - 1.6))) * Math.PI / 2) + 0.3;
    const noz = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.35, 1.4, 20, 1, true), dark);
    noz.position.set(x, yy - 0.4, z);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.1, 6, 24), accentMat);
    ring.rotation.x = Math.PI / 2; ring.position.set(x, yy - 1.05, z);
    const fl = new THREE.Mesh(flameGeo, flameMat);
    fl.position.set(x, yy - 1.1, z); fl.rotation.x = -0.55;
    arena.add(noz, ring, fl);
    flames.push(fl);
  }
  scenery.parent.add(arena);

  // --- what flies past: the painted props of each world (cards facing the camera) ---
  const cardGeoG = new THREE.PlaneGeometry(1, 1); cardGeoG.translate(0, 0.5, 0); // standing on the ground
  const cardGeoA = new THREE.PlaneGeometry(1, 1);                                // in the air
  const cards = {}; // world -> [Flock x6]
  const cardMats = {};
  // the cards are opaque (no fog: the fog made them a flat colour far away, which looked see-through against the
  // painting); they appear out of the horizon by a screen-door dissolve (no sorting), with a touch of the air's colour
  const CU = { uFade0: { value: -ZS * 0.93 }, uFade1: { value: -ZS * 1.02 }, uAir: { value: C('#888') } };
  const cardMat = (cut) => {
    const m = new THREE.MeshBasicMaterial({ map: blank, alphaTest: cut, side: THREE.DoubleSide, fog: false, color: '#ffffff' });
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, CU);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vZd;').replace('#include <project_vertex>', '#include <project_vertex>\n  vZd = -mvPosition.z;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vZd; uniform float uFade0, uFade1; uniform vec3 uAir;')
        .replace('#include <alphatest_fragment>', `#include <alphatest_fragment>
  {
    float k = 1.0 - smoothstep(uFade0, uFade1, vZd);
    vec2 q = mod(floor(gl_FragCoord.xy), 4.0);
    float b = mod(q.x * 2.0 + q.y * 3.0 + q.x * q.y, 16.0) / 16.0; // a 4x4 screen-door pattern
    if (b >= k) discard;
    diffuseColor.rgb = mix(diffuseColor.rgb, uAir, smoothstep(200.0, uFade1, vZd) * 0.22);
  }`);
    };
    m.customProgramCacheKey = () => 'zzcard';
    return m;
  };
  for (const w of WORLDS) {
    cards[w.id] = CARDS[w.id].map((c, i) => {
      const m = cardMat(c.cut ?? 0.3);
      (cardMats[w.id] || (cardMats[w.id] = [])).push(m);
      return new Flock(scenery, c.air ? cardGeoA : cardGeoG, m, c.air ? 22 : 48);
    });
  }
  const loaded = {}; // world -> true once its images are asked for
  // (each image is sent to the graphics card as soon as it is loaded, during the world before: 40 to 50 ms at the
  // arrival of a world otherwise, one image per frame)
  const upQ = [];
  const upload = (t) => whenLoaded(t, () => upQ.push(t));
  function loadWorld(i) {
    const w = WORLDS[i], base = `assets/stages/zz_${w.id}/`;
    if (loaded[w.id]) return;
    loaded[w.id] = true;
    const sk = tex(base + 'sky.jpg');
    upload(sk);
    // its particles, made now too
    upQ.push(moteTex(w.motes));
    whenLoaded(sk, (t) => {
      // the sky dome takes the painting's colours: the top for the zenith, around the horizon, the bottom
      try { w.pzen = band(t.image, 0.0, 0.06); w.phor = band(t.image, 0.27, 0.34); w.pbot = band(t.image, 0.85, 1.0); w.pfog = band(t.image, 0.34, 0.5); } catch (e) { /* */ }
    });
    upload(tex(base + 'ground.jpg', { repeat: true }));
    const list = propsOf(w.id);
    cardMats[w.id].forEach((m, k) => {
      const t = tex(`${base}prop${k}.png`);
      t.anisotropy = 4;
      upload(t);
      whenLoaded(t, () => { m.map = t; m.needsUpdate = true; });
    });
    void list;
  }
  function unloadWorld(i) {
    const w = WORLDS[i];
    if (!loaded[w.id]) return;
    loaded[w.id] = false;
    for (const m of cardMats[w.id]) { m.map = blank; m.needsUpdate = true; }
    for (const f of cards[w.id]) f.clear();
    release(`assets/stages/zz_${w.id}/`);
  }

  // --- code effects ---
  // particles streaming past (petals, notes, embers, rain, ghost lights, bubbles, sparks, stars)
  const NM = 360;
  const mp = new Float32Array(NM * 3), mv = new Float32Array(NM * 3);
  const moteGeo = new THREE.BufferGeometry(); moteGeo.setAttribute('position', new THREE.BufferAttribute(mp, 3));
  const moteMat = new THREE.PointsMaterial({ size: 1.6, map: moteTex('dot'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#ffffff', fog: true, opacity: 0.9 });
  const motes = new THREE.Points(moteGeo, moteMat);
  motes.frustumCulled = false;
  scenery.add(motes);
  const spawnMote = (i, z) => {
    // behind the arena, above it or below it, never in front of the fighters
    const side = Math.random();
    let x, y;
    if (side < 0.45) { x = (Math.random() - 0.5) * 260; y = -8 - Math.random() * 40; }
    else if (side < 0.8) { x = (Math.random() < 0.5 ? -1 : 1) * (22 + Math.random() * 100); y = -10 + Math.random() * 50; }
    else { x = (Math.random() - 0.5) * 200; y = 22 + Math.random() * 40; }
    mp[i * 3] = x; mp[i * 3 + 1] = y; mp[i * 3 + 2] = z ?? (ZM + Math.random() * (ZM * -0.9));
    mv[i * 3] = (Math.random() - 0.5) * 3; mv[i * 3 + 1] = 0; mv[i * 3 + 2] = Math.random();
  };
  for (let i = 0; i < NM; i++) spawnMote(i);

  // warp streaks: long thin lights rushing past, around the way ahead (only in hyperspace)
  const NW = 140;
  const streakTex = canvasTex(128, 8, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.85, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,1)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); const v = g.createLinearGradient(0, 0, 0, h); v.addColorStop(0, 'rgba(0,0,0,1)'); v.addColorStop(0.5, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,1)'); g.globalCompositeOperation = 'destination-out'; g.fillStyle = v; g.fillRect(0, 0, w, h); });
  const warpMat = new THREE.MeshBasicMaterial({ color: '#b48aff', map: streakTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false, side: THREE.DoubleSide });
  // two crossed ribbons along z (u along the length: the head toward the camera)
  const ribA = new THREE.PlaneGeometry(1, 0.7); ribA.rotateY(-Math.PI / 2);
  const ribB = ribA.clone(); ribB.rotateZ(Math.PI / 2);
  const warpGeo = new THREE.BufferGeometry();
  for (const k of ['position', 'uv']) warpGeo.setAttribute(k, new THREE.BufferAttribute(new Float32Array([...ribA.toNonIndexed().attributes[k].array, ...ribB.toNonIndexed().attributes[k].array]), k === 'uv' ? 2 : 3));
  const warp = new THREE.InstancedMesh(warpGeo, warpMat, NW);
  warp.frustumCulled = false;
  const ws = [];
  for (let i = 0; i < NW; i++) {
    const a = Math.random() * Math.PI * 2, r = 26 + Math.random() * 150;
    ws.push({ x: Math.cos(a) * r, y: 4 + Math.sin(a) * r * 0.75, z: ZM + Math.random() * 400, l: 20 + Math.random() * 60, c: new THREE.Color().setHSL(Math.random(), 0.8, 0.7) });
  }
  for (let k = 0; k < NW; k++) { warp.setMatrixAt(k, ZERO); warp.setColorAt(k, ws[k].c); } // (colours from the start: the shader is compiled with them)
  scenery.add(warp);
  // the shock ring of the arrival
  const shockMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const shock = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 6, 96), shockMat);
  shock.position.set(0, 6, -160); shock.frustumCulled = false;
  scenery.add(shock);

  // rainbow arcs (the prairie): a ribbon of colour spanning the way, the arena flies under it
  const rainbowMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uOp: { value: 0 } }, vertexShader: 'varying vec3 vL; void main(){ vL = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uOp; varying vec3 vL;
      vec3 hue(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
      void main(){ float r = length(vL.xy); float u = (r - 118.0) / 16.0; float e = smoothstep(0.0, 0.15, u) * smoothstep(1.0, 0.85, u);
        gl_FragColor = vec4(hue(u * 0.82) * e * uOp, 1.0); }` });
  const rainbowGeo = new THREE.RingGeometry(118, 134, 96, 1, 0, Math.PI);
  const rainbows = new Flock(scenery, rainbowGeo, rainbowMat, 5);

  // searchlights (war): wide cones of light sweeping the dark sky
  const beamMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uOp: { value: 0 }, uCol: { value: C('#fff2c8') } }, vertexShader: UV_VS,
    fragmentShader: 'uniform float uOp; uniform vec3 uCol; varying vec2 vUv; void main(){ float e = 1.0 - abs(vUv.x - 0.5) * 2.0; gl_FragColor = vec4(uCol * pow(e, 3.0) * (1.0 - vUv.y) * 0.5 * uOp, 1.0); }' });
  const beamGeo = new THREE.ConeGeometry(14, 220, 24, 1, true); beamGeo.translate(0, -110, 0); beamGeo.rotateX(Math.PI);
  const beams = [];
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(beamGeo, beamMat);
    b.position.set((i - 1.5) * 110, GY + 5, -320 - (i % 2) * 60); b.frustumCulled = false;
    scenery.add(b); beams.push(b);
  }
  // flashes in the distance (explosions, flak, muzzle flashes) and the lightning bolt
  const flashMat = new THREE.SpriteMaterial({ map: glowTex(), color: '#ffb060', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0 });
  const flashes = [];
  for (let i = 0; i < 6; i++) { const s = new THREE.Sprite(flashMat.clone()); s.position.set(0, -500, -300); scenery.add(s); flashes.push({ s, t: 9, life: 1 }); }
  const boltMat = new THREE.MeshBasicMaterial({ color: '#e8e0ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false, side: THREE.DoubleSide });
  const boltGeo = new THREE.BufferGeometry();
  boltGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(40 * 6 * 3), 3));
  const bolt = new THREE.Mesh(boltGeo, boltMat);
  bolt.frustumCulled = false;
  scenery.add(bolt);
  function makeBolt(x0, z0) {
    // a jagged ribbon from high in the sky down to the ground, with a branch
    const pts = [];
    let x = x0, y = 110;
    while (y > GY && pts.length < 30) { pts.push([x, y]); x += (Math.random() - 0.5) * 14; y -= 6 + Math.random() * 6; }
    pts.push([x, GY]);
    const a = boltGeo.attributes.position.array;
    a.fill(0);
    let k = 0;
    for (let i = 0; i < pts.length - 1 && k < 40 * 18; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1], w = 1.4 * (1 - i / pts.length) + 0.4;
      const q = [ax - w, ay, z0, ax + w, ay, z0, bx + w, by, z0, ax - w, ay, z0, bx + w, by, z0, bx - w, by, z0];
      for (const v of q) a[k++] = v;
    }
    boltGeo.attributes.position.needsUpdate = true;
  }

  // --- the giants: big 3D models (Meshy, assets/models/props/) crossing the far background of their world, one at a
  //     time, swimming or flying across. Always in the scene (scale 0 when away: compiled with the rest at the start)
  const GIANTS = [
    // the whale of the abyss: 110 m long, its tail fluke beating (a wave along its body, in the shader)
    { world: 'abyss', model: 'whale', mode: 'swim', len: 110, every: 11, speed: 40, zR: [-420, -330], yR: [8, 38], swim: 1, sfx: 'zzWhale', gain: 0.55 },
    // the giant rubber duck of space, 60 m, drifting across and tumbling slowly
    { world: 'space', model: 'duck', mode: 'spin', len: 60, every: 9, speed: 30, zR: [-400, -300], yR: [15, 48], sfx: 'zzTheremin', gain: 0.4 },
    // a floating island of the prairie, its waterfall pouring into the void, drifting across
    { world: 'prairie', model: 'island', mode: 'drift', len: 75, every: 9, speed: 20, zR: [-430, -330], yR: [12, 45], sfx: 'zzChime', gain: 0.3 },
    // the jester's hot air balloon of the musical kingdom, bells and all, drifting across to a fanfare
    { world: 'music', model: 'jester', mode: 'drift', len: 50, every: 9, speed: 18, zR: [-400, -300], yR: [20, 50], sfx: 'zzFanfare', gain: 0.3 },
    // a red biplane of the battlefield, banking across the sky, machine gun rattling
    { world: 'war', model: 'biplane', mode: 'fly', yaw: Math.PI / 2, len: 34, every: 6, speed: 75, zR: [-330, -220], yR: [25, 55], sfx: 'zzRattle', gain: 0.3 },
    // the ghost of the haunted castle: glowing, drifting across with a wail
    { world: 'castle', model: 'ghost', mode: 'drift', len: 45, every: 8, speed: 22, zR: [-380, -280], yR: [10, 40], sfx: 'zzWail', gain: 0.4, glow: '#c8b8ff' },
    // a giant skeletal hand bursting out of the cemetery ground as we fly toward it, earth rumbling
    { world: 'cemetery', model: 'hand', mode: 'rise', len: 80, every: 6, xR: [95, 175], zR: [-760, -700], yR: [0, 0], sfx: 'zzBoomFar', gain: 0.35 },
    // a flying car of the neon city, zooming across behind the arena, its neon trim glowing
    { world: 'neon', model: 'hovercar', mode: 'zoom', yaw: Math.PI / 2, len: 24, every: 4, speed: 170, far: 700, zR: [-210, -120], yR: [6, 26], sfx: 'zzCar', gain: 0.4, glow: '#ff6ae6' },
  ];
  const gLoader = new GLTFLoader();
  for (const G of GIANTS) {
    G.root = new THREE.Group(); G.root.scale.setScalar(0.0001); G.on = false; G.t = 0; G.wait = 3;
    scenery.add(G.root);
    gLoader.load(`assets/models/props/${G.model}.glb`, (gl) => {
      const m = gl.scene;
      const box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
      // its length along z (Meshy faces +z: the head toward +z), centred, 1 unit long
      const L = Math.max(size.x, size.y, size.z);
      G.hy = size.y / L; // (its height, for the ones that stand on the ground)
      m.position.sub(c);
      const holder = new THREE.Group(); holder.add(m); holder.scale.setScalar(1 / L);
      G.uT = { value: 0 };
      m.traverse((o) => {
        if (!o.isMesh) return;
        o.frustumCulled = false; o.castShadow = false; o.receiveShadow = false;
        // (a glow that follows its painting: dark eyes stay dark; see-through, its face washed out)
        if (G.glow) { o.material.emissive = new THREE.Color(G.glow); o.material.emissiveMap = o.material.map; o.material.emissiveIntensity = 0.4; }
        if (G.swim) {
          const z0 = box.min.z, len = size.z;
          o.material.onBeforeCompile = (sh) => {
            sh.uniforms.uT = G.uT;
            sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
uniform float uT;`).replace('#include <begin_vertex>', `#include <begin_vertex>
  {
    float sB = clamp((transformed.z - (${z0.toFixed(4)})) / ${len.toFixed(4)}, 0.0, 1.0); // 0 at the tail, 1 at the head
    float amp = pow(1.0 - sB, 2.2) * ${(len * 0.09).toFixed(4)};
    transformed.y += sin(sB * 5.0 - uT * 1.7) * amp;
  }`);
          };
          o.material.customProgramCacheKey = () => 'zzswim' + G.model;
        }
      });
      G.root.add(holder);
    }, undefined, () => { /* not there: no giant */ });
  }
  // how each giant moves (mode): swim (across, its body waving), spin (across, tumbling), drift (across, slow, swaying,
  // facing us), fly (across, banking, its nose ahead), zoom (across, very fast, in front of the far scenery), rise (on
  // the ground ahead, rushing toward us like the ground, rising out of it as it comes). yaw: turns its nose (Meshy: +z)
  function stepGiants(w, dtk, dz, tk, live) {
    for (const G of GIANTS) {
      if (G.uT) G.uT.value = tk;
      if (!G.on) {
        G.root.scale.setScalar(0.0001);
        if (live && w.id === G.world && G.root.children.length) { G.wait -= dtk; if (G.wait <= 0) launch(G); }
        continue;
      }
      G.t += dtk;
      const t = G.t, side = G.dir > 0 ? Math.PI / 2 : -Math.PI / 2, yaw = G.yaw || 0;
      let y = G.y, rx = 0, ry = side + yaw, rz = 0;
      if (G.mode === 'rise') {
        G.z += dz;
        // out of the ground as it comes (from 600 m to 300 m away)
        const k = 1 - THREE.MathUtils.smoothstep(-G.z, 300, 620);
        const h = G.len * (G.hy || 1);
        y = GY + h * 0.5 - h * 1.02 * (1 - k) + Math.sin(t * 7) * 0.4 * (1 - k);
        ry = (G.x > 0 ? -0.5 : 0.5) + yaw; rz = (G.x > 0 ? 0.08 : -0.08);
      } else {
        G.x += G.dir * G.speed * dtk;
        G.z += dz * (G.k ?? 0.08);
        if (G.mode === 'swim') { y += Math.sin(t * 0.6) * 4; rx = Math.sin(t * 0.6 + 1.2) * 0.07; rz = Math.sin(t * 0.4) * 0.05; }
        else if (G.mode === 'spin') { y += Math.sin(t * 0.6) * 4; rx = Math.sin(t * 0.5) * 0.5; ry = t * 0.35 * G.dir; rz = Math.sin(t * 0.37 + 1) * 0.4; }
        else if (G.mode === 'drift') { y += Math.sin(t * 0.7) * 3; ry = yaw + G.dir * 0.35 + Math.sin(t * 0.3) * 0.15; rz = Math.sin(t * 0.9) * 0.06; }
        else if (G.mode === 'fly') { y += Math.sin(t * 0.8) * 6; rz = -G.dir * (0.25 + Math.sin(t * 1.3) * 0.12); rx = Math.sin(t * 0.8 + 1) * 0.08; }
        else if (G.mode === 'zoom') { y += Math.sin(t * 2) * 1.5; rz = -G.dir * 0.12; }
      }
      G.root.position.set(G.x, y, G.z);
      G.root.rotation.set(rx, ry, rz);
      G.root.scale.setScalar(G.len);
      if (!G.sang && (G.mode === 'rise' ? G.z > -420 : Math.abs(G.x) < 80)) { G.sang = true; if (G.sfx) sfx(G.sfx, G.x, G.gain ?? 0.5); }
      const gone = G.mode === 'rise' ? G.z > 40 : Math.abs(G.x) > (G.far ?? 620);
      if (gone || (w.id !== G.world && (G.mode === 'rise' || Math.abs(G.x) > 300))) { G.on = false; G.wait = G.every * (0.8 + rng() * 0.4); }
    }
  }
  function launch(G) {
    G.on = true; G.t = 0; G.sang = false;
    G.dir = rng() < 0.5 ? 1 : -1;
    G.y = G.yR[0] + rng() * (G.yR[1] - G.yR[0]); G.z = G.zR[0] + rng() * (G.zR[1] - G.zR[0]);
    G.x = G.mode === 'rise' ? G.dir * (G.xR[0] + rng() * (G.xR[1] - G.xR[0])) : -G.dir * (G.far ?? 620) * 0.9;
  }

  // --- the journey ---
  let lastTk = -1, travel = 0, travelB = 0, legN = -1, warpOn = false, flash = 0, boltT = 9, shake = 0;
  const cur = { zen: C('#000'), hor: C('#000'), bot: C('#000'), fog: C('#000'), acc: C('#fff'), hemiS: C('#fff'), hemiG: C('#000'), key: C('#fff'), rim: C('#fff') };
  const tmp = C('#000'), tmp2 = C('#000');
  const evs = { boom: 2, bolt: 4, bell: 3, whale: 6, car: 1, organ: 2, chime: 2, duck: 5, wail: 7, beat: 0 };
  const rng = Math.random;
  let scene = null;
  const sfx = (name, x = 0, g = 0.5) => { const A = view.fx && view.fx.audio; if (A && view.live) A.sfx(name, Math.max(-0.8, Math.min(0.8, x / 120)), g); };

  // the world i's colours (from its painting once loaded)
  const colOf = (w, k) => (w['p' + k] || (w['_' + k] || (w['_' + k] = C(w[k]))));
  function setW(u, w) {
    u.zen.copy(colOf(w, 'zen')); u.hor.copy(colOf(w, 'hor')); u.bot.copy(colOf(w, 'bot')); u.acc.set(w.accent);
    u.p.set(w.clouds || 0, w.stars || 0, w.space ? 1 : 0, w.rays || 0);
  }

  // fill a world's sky with its props, spread along the way (at its arrival, behind the flash)
  function spawnCard(w, k, z) {
    const c = CARDS[w.id][k], f = cards[w.id][k], info = propsOf(w.id)[k];
    const ar = info && info.h ? info.w / info.h : 0.8;
    const h = c.h[0] + rng() * (c.h[1] - c.h[0]);
    const side = rng() < 0.5 ? -1 : 1;
    if (c.air) {
      const hi = rng() < 0.35;
      return f.add({ x: side * (hi ? rng() * 120 : 50 + rng() * 150), y: hi ? 40 + rng() * 40 : -20 + rng() * 55, z, sx: h * ar * (rng() < 0.5 ? -1 : 1), sy: h, k: 0.55 + rng() * 0.3,
        vx: (rng() - 0.5) * 8, bob: 1.5 + rng() * 2, bobF: 0.8 + rng(), ph: rng() * 6, rz: (rng() - 0.5) * 0.15, zEnd: -30 });
    }
    return f.add({ x: side * (28 + Math.pow(rng(), 0.8) * 520), y: GY - 0.5, z, sx: h * ar * (rng() < 0.5 ? -1 : 1), sy: h, k: 1, zEnd: 30 });
  }
  function populate(i) {
    const w = WORLDS[i];
    CARDS[w.id].forEach((c, k) => {
      const n = Math.round(c.n * (-ZS / SPEED) * 0.9); // (as many as the way holds)
      for (let j = 0; j < n; j++) spawnCard(w, k, ZS + rng() * (ZS * -0.93));
    });
  }
  const acc = {};

  function arrive(i, live) {
    const w = WORLDS[i];
    travel = 0;
    // the props of the world we left keep flying away; this one fills the sky
    populate(i);
    if (live) {
      flash = 1;
      shake = 0.5;
      sfx('zzArrive', 0, 0.7);
      const A = view.fx;
      if (A && A.rig && A.rig.shake) A.rig.shake(0.35);
    }
    // the moodiest motes of the world
    moteMat.map = moteTex(w.motes); moteMat.needsUpdate = true;
    for (let k = 0; k < NM; k++) spawnMote(k);
  }

  const view = {
    cards, // (tests)
    get giants() { return GIANTS; },
    group, surfaces: [arena], fog: [WORLDS[0].fog, 300, 1200], bg: WORLDS[0].zen, R: 12, live: false,
    far: 1700, // (the camera sees this far here: matchView.js; 500 elsewhere)
    update(dt, t, stage, W) {
      const tk = (W && W.tick > 0 ? W.tick / 60 : t) + (typeof window !== 'undefined' && window.__zzt !== undefined ? window.__zzt : ZZT);
      view.live = !!(W && W.tick > 0);
      if (upQ.length) { const t = upQ.shift(), R = view.fx && view.fx.renderer; if (R && R.gl && !t.userData.gone) try { R.gl.initTexture(t); } catch (e) { /* at its first draw then */ } }
      let dtk = lastTk < 0 ? 0 : tk - lastTk;
      if (dtk < 0 || dtk > 0.5) dtk = 0; // (a rollback or a pause: no jump)
      lastTk = tk;
      const n = Math.floor(tk / LEG), u = tk - n * LEG, i = n % WORLDS.length, j = (i + 1) % WORLDS.length;
      const w = WORLDS[i], wn = WORLDS[j];
      if (n !== legN) {
        const first = legN < 0;
        legN = n;
        loadWorld(i); loadWorld(j);
        // (the worlds further away are let go: two at a time in memory)
        for (let k = 0; k < WORLDS.length; k++) if (k !== i && k !== j) unloadWorld(k);
        arrive(i, !first && view.live);
      }
      // hyperspace: the end of each world
      const wk = u > LEG - WARP ? (u - (LEG - WARP)) / WARP : 0;
      const after = u < 0.9 ? 1 - u / 0.9 : 0;
      const warpK = wk > 0 ? Math.min(1, wk / 0.3) : after * after;
      if (wk > 0 && !warpOn) { warpOn = true; if (view.live) { sfx('zzWarp', 0, 0.75); const A = view.fx; if (A && A.rig && A.rig.shake) A.rig.shake(0.2); } }
      if (wk === 0) warpOn = false;
      const speed = SPEED * (1 + 7 * warpK * warpK);
      const dz = speed * dtk;
      travel += dz; travelB += dz;
      const mixK = wk > 0 ? THREE.MathUtils.smoothstep(wk, 0.25, 0.85) : 0;
      // the scenery banks gently, and corkscrews in hyperspace
      const bank = 0.04 * Math.sin(tk * 0.21) + 0.025 * Math.sin(tk * 0.57 + 1) + warpK * 0.12 * Math.sin(tk * 2.2);
      scenery.rotation.z = bank;

      // colours of the moment
      setW(SU.wA.value, w); setW(SU.wB.value, wn);
      SU.uMix.value = mixK; SU.uWarp.value = warpK; SU.uTime.value = tk; SU.uTravel.value = travel; SU.uBank.value = -bank;
      SU.uWarpCol.value.copy(C(w.accent)).lerp(tmp.set(wn.accent), mixK);
      flash = Math.max(0, flash - dt * 2.2);
      SU.uFlash.value = flash * flash * 0.9;
      cur.zen.copy(colOf(w, 'zen')).lerp(colOf(wn, 'zen'), mixK);
      cur.fog.copy(colOf(w, 'fog')).lerp(colOf(wn, 'fog'), mixK);
      cur.acc.set(w.accent).lerp(tmp.set(wn.accent), mixK);
      cur.hemiS.set(w.hemi[0]).lerp(tmp.set(wn.hemi[0]), mixK); cur.hemiG.set(w.hemi[1]).lerp(tmp.set(wn.hemi[1]), mixK);
      cur.key.set(w.key[0]).lerp(tmp.set(wn.key[0]), mixK); cur.rim.set(w.rim[0]).lerp(tmp.set(wn.rim[0]), mixK);
      const lerpN = (a, b) => a + (b - a) * mixK;

      // the paintings: the one ahead grows (we rush toward it); the next one fades in during hyperspace
      const pA = paints[0], pB = paints[1];
      const skA = TEX.get(`assets/stages/zz_${w.id}/sky.jpg`), skB = TEX.get(`assets/stages/zz_${wn.id}/sky.jpg`);
      pA.material.uniforms.map.value = skA && skA.userData.ok ? skA : blank;
      pB.material.uniforms.map.value = skB && skB.userData.ok ? skB : blank;
      pA.material.uniforms.uOp.value = (skA && skA.userData.ok ? 1 : 0) * (1 - mixK);
      pB.material.uniforms.uOp.value = (skB && skB.userData.ok ? 1 : 0) * mixK;
      pA.material.uniforms.uZoom.value = 1 + 0.16 * (u / LEG) + warpK * 0.25;
      pB.material.uniforms.uZoom.value = 0.92 + 0.08 * mixK;
      pA.material.uniforms.uWarp.value = pB.material.uniforms.uWarp.value = warpK * 0.92;
      pB.renderOrder = -8.5;

      // the ground
      const gA = TEX.get(`assets/stages/zz_${w.id}/ground.jpg`), gB = TEX.get(`assets/stages/zz_${wn.id}/ground.jpg`);
      GU.mapA.value = gA && gA.userData.ok ? gA : blank; GU.uHasA.value = gA && gA.userData.ok && !w.space ? 1 : 0;
      GU.mapB.value = gB && gB.userData.ok ? gB : blank; GU.uHasB.value = gB && gB.userData.ok && !wn.space ? 1 : 0;
      GU.uMix.value = mixK; GU.uTravelA.value = travel % 1e5; GU.uTravelB.value = travelB % 1e5; GU.uWarp.value = warpK;
      GU.uFogA.value.copy(colOf(w, 'fog')); GU.uFogB.value.copy(colOf(wn, 'fog')); GU.uTime.value = tk;
      GU.uBlast.value.w = Math.max(0, GU.uBlast.value.w - dt * 3);

      // fog and background
      if (!scene) { let p = group; while (p.parent) p = p.parent; scene = p.isScene ? p : false; }
      cur.fog.lerp(tmp.set('#08040f'), warpK * 0.85); // (the tunnel is dark: only its streaks shine)
      if (scene && scene.fog) scene.fog.color.copy(cur.fog);
      if (scene && scene.background && scene.background.isColor) scene.background.copy(cur.fog);

      // lights: hard key light from the world's sun (deep shadows), coloured rim from behind, a dim fill
      hemi.color.copy(cur.hemiS); hemi.groundColor.copy(cur.hemiG);
      hemi.intensity = lerpN(w.hemi[2], wn.hemi[2]) * (1 - warpK * 0.35);
      key.color.copy(cur.key).lerp(tmp2.copy(cur.acc), warpK * 0.6);
      key.intensity = lerpN(w.key[1], wn.key[1]);
      const kd = w.key[2], kn = wn.key[2];
      key.position.set(lerpN(kd[0], kn[0]) * 50, lerpN(kd[1], kn[1]) * 50, lerpN(kd[2], kn[2]) * 50);
      rim.color.copy(cur.rim); rim.intensity = lerpN(w.rim[1], wn.rim[1]) * (1 + warpK);
      ev.intensity = Math.max(0, ev.intensity - dt * 60);

      // the saucer: accent of the world, engines roaring in hyperspace
      accentMat.color.copy(cur.acc).multiplyScalar(1.6);
      haloMat.color.copy(cur.acc);
      haloMat.opacity = 0.18 + warpK * 0.3 + (w.beat ? 0.12 * Math.pow(Math.max(0, Math.cos(tk * Math.PI * 128 / 60)), 8) : 0);
      flameMat.uniforms.uCol.value.copy(cur.acc); flameMat.uniforms.uTime.value = tk;
      flameMat.uniforms.uPow.value = 0.75 + 0.15 * Math.sin(tk * 37) + warpK * 0.9;
      for (const f of flames) f.scale.set(1, 1 + warpK * 1.6 + 0.08 * Math.sin(tk * 23 + f.position.x), 1);
      core.rotation.y += dt * (0.8 + warpK * 6);

      // the props fly past
      const live = wk === 0 && u > 0.05;
      if (live) {
        CARDS[w.id].forEach((c, k) => {
          acc[w.id + k] = (acc[w.id + k] || 0) + c.n * dtk * (speed / SPEED);
          while (acc[w.id + k] >= 1) { acc[w.id + k] -= 1; spawnCard(w, k, ZS); }
        });
      }
      for (const id in cards) for (const f of cards[id]) f.update(dtk, dz, tk);
      stepGiants(w, dtk, dz, tk, live);
      // tint: the props take the light of their world (darker in the gloomy ones)
      for (const id in cardMats) { const ww = WORLDS.find((x) => x.id === id); for (const m of cardMats[id]) m.color.copy(cur.hemiS).lerp(tmp.set('#ffffff'), 0.55).multiplyScalar(ww.space ? 1.05 : 0.95); }
      CU.uAir.value.copy(cur.fog);

      // rainbows (prairie)
      rainbowMat.uniforms.uOp.value = (w.rainbow ? 1 - mixK : 0) * 0.55 + (wn.rainbow ? mixK * 0.55 : 0);
      if (w.rainbow && live && rng() < dtk / 7) rainbows.add({ x: (rng() - 0.5) * 60, y: GY, z: ZS, sx: 1, sy: 1, k: 1, zEnd: 60 });
      rainbows.update(dtk, dz, tk);

      // searchlights, explosions, tracer flashes (war)
      const warK = (w.war ? 1 - mixK : 0) + (wn.war ? mixK : 0);
      beamMat.uniforms.uOp.value = warK;
      beams.forEach((b, k) => { b.rotation.z = Math.sin(tk * (0.35 + k * 0.08) + k * 2) * 0.55; b.rotation.x = -0.25 + Math.sin(tk * 0.27 + k) * 0.15; });
      for (const f of flashes) {
        f.t += dt;
        const k = Math.max(0, 1 - f.t / f.life);
        f.s.material.opacity = k * k;
        f.s.scale.setScalar(f.size * (0.6 + (1 - k) * 0.8));
      }
      const boom = (x, y, z, size, col, gain) => {
        const f = flashes.reduce((a, b) => (a.t > b.t ? a : b));
        f.t = 0; f.life = 0.5 + rng() * 0.5; f.size = size; f.s.position.set(x, y, z); f.s.material.color.set(col);
        if (y < GY + 20) { GU.uBlast.value.set(x, z, 30 + size, 1.4); }
        sfx('zzBoomFar', x, gain);
      };
      if (live && w.war) {
        evs.boom -= dtk;
        if (evs.boom <= 0) {
          evs.boom = 0.7 + rng() * 1.8;
          const x = (rng() - 0.5) * 700, z = -180 - rng() * 750;
          if (rng() < 0.6) boom(x, GY + 4, z, 60 + rng() * 50, '#ff8a3a', 0.35);
          else boom(x * 0.8, 30 + rng() * 50, z, 25 + rng() * 15, '#ffd080', 0.2); // flak
          // a close one now and then: its light hits the arena from below
          if (rng() < 0.3) { ev.color.set('#ff7a2a'); ev.position.set((rng() - 0.5) * 30, -6, -14); ev.intensity = 160; }
          if (rng() < 0.25) sfx('zzRattle', (rng() - 0.5) * 200, 0.15);
        }
      }

      // lightning (haunted castle)
      boltT += dt;
      boltMat.opacity = boltT < 0.25 ? (boltT < 0.06 || (boltT > 0.1 && boltT < 0.16) ? 1 : 0.3) : 0;
      SU.uBolt.value = boltT < 0.2 ? (boltT < 0.05 || (boltT > 0.1 && boltT < 0.14) ? 0.45 : 0.12) : 0;
      if (boltT < 0.2) { key.color.set('#e8e0ff'); key.intensity = 4.2; }
      if (live && w.storm) {
        evs.bolt -= dtk;
        if (evs.bolt <= 0) {
          evs.bolt = 2.5 + rng() * 4;
          const x = (rng() - 0.5) * 260;
          makeBolt(x, -180 - rng() * 150);
          boltT = 0;
          setTimeout(() => sfx('thunder', x, 0.55), 250 + rng() * 500);
        }
      }

      // ghost fire and the bell (cemetery)
      if (live && w.ghost) {
        evs.bell -= dtk;
        if (evs.bell <= 0) { evs.bell = 7 + rng() * 5; sfx(rng() < 0.6 ? 'zzBell' : 'zzWail', (rng() - 0.5) * 200, 0.35); }
        ev.color.set('#3dff8a'); ev.position.set(Math.sin(tk * 0.7) * 16, -5, -6);
        ev.intensity = Math.max(ev.intensity, 22 + 14 * Math.sin(tk * 9) * Math.sin(tk * 3.3));
      }
      // caustics (abyss): the key light shimmers (the whale sings as it passes: stepGiants)
      if (w.caustic || wn.caustic) {
        const ck = (w.caustic ? 1 - mixK : 0) + (wn.caustic ? mixK : 0);
        key.intensity *= 1 + ck * 0.35 * Math.sin(tk * 3.1) * Math.sin(tk * 4.7 + 1);
      }
      // neon: coloured lights sweeping across the arena as the towers rush past
      if (live && w.neon) {
        evs.car -= dtk;
        if (evs.car <= 0) {
          evs.car = 0.9 + rng() * 1.4;
          ev.color.set(rng() < 0.5 ? '#ff2bd6' : '#2ef2ff');
          ev.userData.sw = { x: (rng() < 0.5 ? -1 : 1) * (20 + rng() * 6), y: 3 + rng() * 6, t: 0 };
          sfx('zzCar', ev.userData.sw.x * 3, 0.3);
        }
        const S = ev.userData.sw;
        if (S && S.t < 1.2) { S.t += dt; ev.position.set(S.x, S.y, -40 + S.t * 70); ev.intensity = 120 * Math.sin(Math.PI * Math.min(1, S.t / 1.2)); }
      }
      // music: the saucer pulses on the beat; an organ chord or a fanfare now and then
      if (live && w.beat) {
        evs.organ -= dtk;
        if (evs.organ <= 0) { evs.organ = 6 + rng() * 5; sfx(rng() < 0.5 ? 'zzOrgan' : 'zzFanfare', (rng() - 0.5) * 160, 0.3); }
      }
      if (live && w.rainbow) { evs.chime -= dtk; if (evs.chime <= 0) { evs.chime = 5 + rng() * 4; sfx('zzChime', (rng() - 0.5) * 160, 0.25); } }

      // particles
      const mk = w.motes;
      const fall = mk === 'rain' ? -60 : mk === 'bubble' ? 6 : mk === 'ember' || mk === 'wisp' ? 3 : mk === 'petal' ? -1.5 : 0;
      moteMat.color.copy(mk === 'rain' ? tmp.set('#c8c0ff') : mk === 'petal' ? tmp.set('#ffc8ea') : mk === 'ember' ? tmp.set('#ff8a3a') : mk === 'wisp' ? tmp.set('#5aff9a') : mk === 'bubble' ? tmp.set('#a8f4ff') : cur.acc);
      moteMat.size = mk === 'rain' ? 2.2 : mk === 'note' ? 2.6 : mk === 'star' ? 1.8 : 1.4;
      moteMat.opacity = 0.85 * (1 - warpK);
      for (let k = 0; k < NM; k++) {
        mp[k * 3] += mv[k * 3] * dtk;
        mp[k * 3 + 1] += (fall + (mk === 'petal' || mk === 'wisp' ? Math.sin(tk * 2 + k) * 2 : 0)) * dtk;
        mp[k * 3 + 2] += dz * (0.9 + mv[k * 3 + 2] * 0.4);
        if (mp[k * 3 + 2] > 30 || mp[k * 3 + 1] < -70 || mp[k * 3 + 1] > 90) spawnMote(k, ZM * (0.4 + rng() * 0.6));
      }
      moteGeo.attributes.position.needsUpdate = true;

      // hyperspace streaks
      warpMat.opacity = warpK * 0.9;
      warpMat.color.set('#ffffff');
      for (let k = 0; k < NW; k++) {
        const s = ws[k];
        s.z += speed * dtk * 1.4;
        if (s.z > -30) s.z = ZM + rng() * 80;
        _m.compose(_p.set(s.x, s.y, s.z), _q.identity(), _s.set(1, 1, s.l * (0.3 + warpK * 1.4)));
        warp.setMatrixAt(k, warpK > 0.01 ? _m : ZERO);
        warp.setColorAt(k, tmp2.copy(s.c).lerp(SU.uWarpCol.value, 0.55));
      }
      warp.instanceMatrix.needsUpdate = true;
      if (warp.instanceColor) warp.instanceColor.needsUpdate = true;
      // the arrival: a ring of light rushes out
      const sk = Math.max(0, 1 - u / 1.2);
      shockMat.opacity = sk * sk * (legN > 0 ? 1 : 0);
      shock.scale.setScalar(10 + (1 - sk) * 260);
      shock.material.color.copy(cur.acc).lerp(tmp.set('#ffffff'), 0.5);
      void shake;
    },
  };
  return view;
}
