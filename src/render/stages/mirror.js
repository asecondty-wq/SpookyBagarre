// Horizon des Reflets : une dalle sombre à néons qui flotte au-dessus d'une mer-miroir. Aucun piège, aucun éclair, rien qui
// bouge près des combattants : seul le ciel change, très lentement (nuit → aube → jour → couchant → crépuscule → nuit, un tour
// en CYCLE secondes), et la mer le reflète. Le décor reste sobre pour que les coups restent lisibles : les lumières sur les
// combattants ne varient presque pas (teinte seule), et le fond derrière eux reste doux.
// L'heure vient de l'horloge du match (W.tick, la même chez tous les joueurs) ; hors match (vitrine, miniature) du temps réel.
import * as THREE from 'three';
import { mat, basic } from '../materials.js';
import { STYLE } from '../style.js';
import { platform, softPlatform } from './common.js';

const CYCLE = 210; // secondes pour un tour complet du ciel
const WY = -5.5;   // le plan de la mer par rapport au dessus de la dalle (pour son reflet)

// les images clés de la journée : u de 0 à 1 (0 = nuit, comme au début du match)
const C = (h) => new THREE.Color(h);
const KEYS = [
  { u: 0.00, zen: C('#070b22'), mid: C('#111a48'), hor: C('#4b3a72'), glow: C('#7a3d6a'), sea: C('#05071a'), hemiS: C('#8c93d6'), hemiG: C('#171534'), dirC: C('#b9c6ff'), hemiI: 0.95, dirI: 1.35, stars: 1.0, neon: C('#a85cff') },
  { u: 0.17, zen: C('#0b1230'), mid: C('#1d2862'), hor: C('#6c4a86'), glow: C('#a8507a'), sea: C('#080a22'), hemiS: C('#9a98d6'), hemiG: C('#1a1736'), dirC: C('#c2c4f4'), hemiI: 1.0, dirI: 1.4, stars: 0.75, neon: C('#b660ff') },
  { u: 0.28, zen: C('#22346c'), mid: C('#5a5a98'), hor: C('#f09a74'), glow: C('#ff8a5a'), sea: C('#1a1a44'), hemiS: C('#cdb0cc'), hemiG: C('#2a2438'), dirC: C('#ffd2ac'), hemiI: 1.05, dirI: 1.5, stars: 0.12, neon: C('#ff6ad0') },
  { u: 0.46, zen: C('#2a5a92'), mid: C('#4f88ba'), hor: C('#a9cfd8'), glow: C('#f6efc8'), sea: C('#1b4570'), hemiS: C('#c2dcf8'), hemiG: C('#3a4658'), dirC: C('#fff1d8'), hemiI: 1.1, dirI: 1.65, stars: 0.0, neon: C('#46dcff') },
  { u: 0.64, zen: C('#2d3f88'), mid: C('#7a5c9c'), hor: C('#ff8f56'), glow: C('#ff7a40'), sea: C('#2a1f4c'), hemiS: C('#e2b2aa'), hemiG: C('#2c2238'), dirC: C('#ffb27c'), hemiI: 1.05, dirI: 1.55, stars: 0.1, neon: C('#ff72c4') },
  { u: 0.80, zen: C('#0d153a'), mid: C('#2b3272'), hor: C('#80508c'), glow: C('#b0507a'), sea: C('#0b0b28'), hemiS: C('#9a98d8'), hemiG: C('#181636'), dirC: C('#bcc4ff'), hemiI: 0.98, dirI: 1.38, stars: 0.7, neon: C('#b062ff') },
  { u: 1.00, zen: C('#070b22'), mid: C('#111a48'), hor: C('#4b3a72'), glow: C('#7a3d6a'), sea: C('#05071a'), hemiS: C('#8c93d6'), hemiG: C('#171534'), dirC: C('#b9c6ff'), hemiI: 0.95, dirI: 1.35, stars: 1.0, neon: C('#a85cff') },
];
const _off = new THREE.Vector3(0.017, 0.011, 0); // where the second disc sits to cut the crescent out of the moon
const sstep = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };

const VS = 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const FS = `
uniform vec3 cZen; uniform vec3 cMid; uniform vec3 cHor; uniform vec3 cGlow; uniform vec3 cSea;
uniform vec3 uSun; uniform vec3 uMoon; uniform vec3 uMoonB;
uniform float uSunI; uniform float uMoonI; uniform float uStars; uniform float uTime;
varying vec3 vP;
float h31(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
vec3 stars(vec3 d) {
  vec3 g = d * 150.0, id = floor(g), f = fract(g) - 0.5;
  float h = h31(id);
  if (h < 0.972) return vec3(0.0);
  vec3 o = vec3(h31(id + 7.1), h31(id + 13.3), h31(id + 3.7)) - 0.5;
  float b = smoothstep(0.24, 0.0, length(f - o * 0.5)) * (0.45 + 0.55 * (h - 0.972) / 0.028);
  float tw = 0.85 + 0.15 * sin(uTime * 1.6 + h * 90.0);
  return vec3(b * tw) * mix(vec3(0.78, 0.88, 1.0), vec3(1.0, 0.9, 0.78), fract(h * 11.0));
}
vec3 sky(vec3 d) {
  float h = max(d.y, 0.0);
  vec3 c = mix(cHor, cMid, smoothstep(0.0, 0.2, h));
  c = mix(c, cZen, smoothstep(0.1, 0.8, h));
  // the glow of the horizon, stronger on the side where the sun is
  vec2 hd = normalize(d.xz + 1e-4), hs = normalize(uSun.xz + 1e-4);
  float side = pow(max(dot(hd, hs), 0.0), 4.0);
  c += cGlow * exp(-h * 14.0) * (0.22 + 0.78 * side) * uSunI;
  float ds = distance(d, uSun);
  c += cGlow * exp(-ds * 9.0) * 0.5 * uSunI;
  c = mix(c, vec3(1.0, 0.96, 0.86), smoothstep(0.046, 0.040, ds) * step(0.0, uSun.y) * sqrt(uSunI));
  // the crescent moon: a disc minus a shifted disc
  float dm = distance(d, uMoon);
  float cres = clamp(smoothstep(0.030 + 0.0012, 0.030 - 0.0012, dm) - smoothstep(0.030 + 0.0012, 0.030 - 0.0012, distance(d, uMoonB)), 0.0, 1.0);
  c += vec3(0.42, 0.52, 1.0) * exp(-dm * 16.0) * 0.1 * uMoonI;
  c = mix(c, vec3(1.0, 0.96, 0.84), cres * uMoonI);
  c += stars(d) * uStars * smoothstep(0.02, 0.22, d.y) * (1.0 - cres);
  return c;
}
vec3 sea(vec3 d) {
  float t = 1.0 / max(-d.y, 0.015);
  vec2 q = d.xz * t;
  float k = clamp(-d.y * 9.0, 0.0, 1.0);
  float w = sin(q.x * 3.1 + uTime * 0.5) + sin(q.y * 2.3 - uTime * 0.4) + 0.5 * sin((q.x + q.y) * 7.0 + uTime * 0.9);
  vec3 r = vec3(d.x + w * 0.004 * k, -d.y + w * 0.011 * k, d.z);
  vec3 refl = sky(normalize(r));
  float fres = mix(0.985, 0.3, smoothstep(0.0, 0.5, -d.y));
  return mix(cSea, refl, fres);
}
void main() {
  vec3 d = normalize(vP);
  gl_FragColor = vec4(d.y >= 0.0 ? sky(d) : sea(d), 1.0);
}`;

function skyMirror() {
  const U = {
    cZen: { value: new THREE.Color() }, cMid: { value: new THREE.Color() }, cHor: { value: new THREE.Color() }, cGlow: { value: new THREE.Color() }, cSea: { value: new THREE.Color() },
    uSun: { value: new THREE.Vector3(0, -1, -1) }, uMoon: { value: new THREE.Vector3(0, 0.3, -1) }, uMoonB: { value: new THREE.Vector3(0, 0.3, -1) },
    uSunI: { value: 0 }, uMoonI: { value: 1 }, uStars: { value: 1 }, uTime: { value: 0 },
  };
  const m = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: U, vertexShader: VS, fragmentShader: FS });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(320, 32, 20), m);
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  return { dome, U };
}

// a direction from an azimuth (0 = straight ahead, behind the arena) and an elevation, in radians
function dirOf(out, az, el) {
  return out.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
}

export function buildMirror(def) {
  const group = new THREE.Group();
  const sk = skyMirror();
  group.add(sk.dome);

  // --- lights: almost constant, only tinted ---
  const hemi = new THREE.HemisphereLight('#8c93d6', '#171534', 1.0);
  const dir = new THREE.DirectionalLight('#b9c6ff', 1.4);
  if (STYLE.shadows) {
    dir.castShadow = true;
    const c = dir.shadow.camera;
    c.left = -26; c.right = 26; c.top = 26; c.bottom = -26; c.near = 5; c.far = 140;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.bias = -0.0004; dir.shadow.normalBias = 0.04; dir.shadow.radius = 3;
  }
  group.add(hemi, dir, dir.target);

  // --- the neon: one material for every line, one for its halo (their colour follows the sky) ---
  const neon = basic('#a85cff', { fog: false });
  const halo = new THREE.MeshBasicMaterial({ color: '#a85cff', transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const tagN = (o) => { o.userData.neon = true; return o; };
  const tagH = (o) => { o.userData.halo = true; o.renderOrder = 3; return o; };
  const flatRing = (r0, r1, a0 = 0, len = Math.PI * 2, seg = 64) => {
    const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, seg, 1, a0, len), neon);
    m.rotation.x = -Math.PI / 2; m.position.y = 0.014;
    return tagN(m);
  };
  const edgeHalo = (r, y, w = 0.4) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, w, 6, 72), halo);
    m.rotation.x = Math.PI / 2; m.scale.z = 0.22; m.position.y = y;
    return tagH(m);
  };

  const darkTop = mat('#1d1c3a'), darkSide = mat('#12112a'), darkUnder = mat('#0c0b1e');
  const mainPlatform = (s) => {
    const p = platform(s, { top: darkTop, side: darkSide, under: darkUnder, tile: 6, sideTile: 6, noCone: true, rim: neon });
    p.children.forEach((o) => { if (o.geometry && o.geometry.type === 'TorusGeometry') tagN(o); });
    const r = s.r;
    // the base: a dark inverted cone under the slab, the same shape the simulation gives the underside (thick, depth)
    const th = s.thick ?? 1.0, dp = s.depth ?? 2.5;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.98, 0.25, dp, 56, 1, true), darkUnder);
    base.position.y = -th - dp / 2;
    p.add(base);
    // the lines on the slab: a full ring near the edge, a broken one inside, short ticks between them
    p.add(flatRing(r * 0.8 - 0.07, r * 0.8 + 0.07));
    for (let i = 0; i < 12; i++) p.add(flatRing(r * 0.46 - 0.07, r * 0.46 + 0.07, i * Math.PI / 6 + 0.12, Math.PI / 6 - 0.24, 6));
    for (let i = 0; i < 24; i++) p.add(flatRing(r * 0.8 + 0.5, r * 0.8 + 1.7, i * Math.PI / 12 + 0.07, 0.04, 2));
    // a strip of light round the flank, and the halos
    const strip = new THREE.Mesh(new THREE.TorusGeometry(r * 0.995, 0.06, 4, 72), neon);
    strip.rotation.x = Math.PI / 2; strip.position.y = -(s.thick ?? 1.0) + 0.16;
    p.add(tagN(strip));
    p.add(edgeHalo(r, 0.05, 0.42), edgeHalo(r * 0.995, strip.position.y, 0.3));
    return p;
  };
  const sidePlatform = (s) => {
    const p = softPlatform(s, darkTop, darkSide, 0.4);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(s.r, 0.07, 4, 40), neon);
    rim.rotation.x = Math.PI / 2; rim.position.y = 0.01;
    p.add(tagN(rim), edgeHalo(s.r, 0.05, 0.26));
    p.add(flatRing(s.r * 0.62 - 0.04, s.r * 0.62 + 0.04, 0, Math.PI * 2, 32));
    return p;
  };
  const surfaces = def.surfaces.map((s, i) => {
    const o = i === 0 ? mainPlatform(s) : sidePlatform(s);
    group.add(o);
    return o;
  });

  // --- the reflections of the slabs in the sea: dark, translucent copies upside down under the sea plane ---
  const reflDark = new THREE.MeshBasicMaterial({ color: '#0a0c24', transparent: true, opacity: 0.38, depthWrite: false });
  const reflNeon = new THREE.MeshBasicMaterial({ color: '#a85cff', transparent: true, opacity: 0.4, depthWrite: false });
  const refls = surfaces.map((o) => {
    const c = o.clone(true);
    c.traverse((n) => {
      if (n.userData.halo) { n.visible = false; return; }
      if (n.isMesh) n.material = n.userData.neon ? reflNeon : reflDark;
      n.castShadow = false; n.receiveShadow = false;
    });
    c.scale.y = -1;
    group.add(c);
    return c;
  });

  // --- per frame: the time of day ---
  const cur = {
    zen: new THREE.Color(), mid: new THREE.Color(), hor: new THREE.Color(), glow: new THREE.Color(), sea: new THREE.Color(),
    hemiS: new THREE.Color(), hemiG: new THREE.Color(), dirC: new THREE.Color(), neon: new THREE.Color(),
  };
  const sunV = new THREE.Vector3(), moonV = new THREE.Vector3(), moonB = new THREE.Vector3();
  const fogCol = new THREE.Color();
  let scene = null;
  const view = {
    group, surfaces, fog: ['#161432', 60, 260], bg: '#070b22', R: 9, phase: 0,
    update(dt, t, stage, W) {
      const tk = W && W.tick > 0 ? W.tick / 60 : t;
      const u = (((tk / CYCLE) % 1) + 1) % 1;
      view.phase = u;
      let i = 0;
      while (i < KEYS.length - 2 && u > KEYS[i + 1].u) i++;
      const A = KEYS[i], B = KEYS[i + 1], k = sstep(0, 1, (u - A.u) / (B.u - A.u));
      for (const n of ['zen', 'mid', 'hor', 'glow', 'sea', 'hemiS', 'hemiG', 'dirC', 'neon']) cur[n].copy(A[n]).lerp(B[n], k);
      const hemiI = A.hemiI + (B.hemiI - A.hemiI) * k, dirI = A.dirI + (B.dirI - A.dirI) * k, stars = A.stars + (B.stars - A.stars) * k;

      // the sun crosses the sky from u = 0.20 to 0.72, the moon from 0.74 to 1.26 (it is up when the match starts)
      const sa = (u - 0.2) / 0.52;
      const sunUp = sa >= 0 && sa <= 1;
      dirOf(sunV, (sa - 0.5) * 1.0 - 0.1, sunUp ? Math.sin(Math.PI * sa) * 0.38 : -0.3);
      const ma = u >= 0.74 ? (u - 0.74) / 0.52 : (u + 0.26) / 0.52;
      const moonUp = ma >= 0 && ma <= 1;
      dirOf(moonV, (ma - 0.5) * 1.0 + 0.3, moonUp ? Math.sin(Math.PI * ma) * 0.17 + 0.03 : -0.3);
      moonB.copy(moonV).add(_off).normalize();
      const sunEl = sunV.y;
      const U = sk.U;
      U.cZen.value.copy(cur.zen); U.cMid.value.copy(cur.mid); U.cHor.value.copy(cur.hor); U.cGlow.value.copy(cur.glow); U.cSea.value.copy(cur.sea);
      U.uSun.value.copy(sunV); U.uMoon.value.copy(moonV); U.uMoonB.value.copy(moonB);
      U.uSunI.value = sstep(-0.16, 0.04, sunEl);
      U.uMoonI.value = moonUp ? sstep(0.0, 0.1, moonV.y) * (0.35 + 0.65 * stars) : 0;
      U.uStars.value = stars;
      U.uTime.value = tk;

      // the lights follow: tinted by the hour, nearly the same strength all day, from the side of the sun (or the moon)
      hemi.color.copy(cur.hemiS); hemi.groundColor.copy(cur.hemiG); hemi.intensity = hemiI;
      dir.color.copy(cur.dirC); dir.intensity = dirI;
      const dayK = sstep(-0.05, 0.25, sunEl);
      const lx = (moonV.x + (sunV.x - moonV.x) * dayK) * 0.9;
      dir.position.set(lx * 50, 50, 0.6 * 50);

      // the neon takes the colour of the hour
      neon.color.copy(cur.neon); halo.color.copy(cur.neon); reflNeon.color.copy(cur.neon);
      reflDark.color.copy(cur.sea).lerp(cur.hor, 0.12);

      // the fog is the colour of the horizon, a little darker
      fogCol.copy(cur.hor).multiplyScalar(0.55).lerp(cur.sea, 0.35);
      if (!scene) { let p = group; while (p.parent) p = p.parent; scene = p.isScene ? p : false; }
      if (scene && scene.fog) scene.fog.color.copy(fogCol);

      // the reflections follow their slab (upside down under the sea)
      for (let j = 0; j < surfaces.length; j++) {
        const o = surfaces[j], c = refls[j];
        c.position.set(o.position.x, 2 * WY - o.position.y, o.position.z);
        c.visible = o.visible;
      }
    },
  };
  return view;
}
