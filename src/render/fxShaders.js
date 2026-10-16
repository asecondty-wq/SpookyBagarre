// Shaders for the energy attacks (Pandrezz's kamehameha, ANBUU's holy light) and the liquids (the slicks of tears
// and Ricard, the pour of the bottle). Display only. Built from a 3D simplex noise:
//   plasma: a living surface of energy (white core, coloured body, wispy edges), on tubes (beams) and spheres
//     (charge balls, orbs); energy(): the whole beam or ball (plasma layers, electric arcs, streaming motes)
//   puddle: a liquid on the floor (blobby edge, meniscus, sky reflection, ripples, glints)
//   stream: a stream of liquid falling along a curve, facing the camera
import * as THREE from 'three';
import { glowTex } from './materials.js';

// --- noise (Ashima / Stefan Gustavson simplex 3D) ----------------------------------------------------------------
const NOISE = `
vec3 mod289(vec3 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x){ return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v){
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0); const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy)); vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz); vec3 l = 1.0 - g; vec3 i1 = min(g.xyz, l.zxy); vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx; vec3 x2 = x0 - i2 + C.yyy; vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857; vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z); vec4 x_ = floor(j * ns.z); vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy; vec4 y = y_ * ns.x + ns.yyyy; vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy); vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0; vec4 s1 = floor(b1) * 2.0 + 1.0; vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy; vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x); vec3 p1 = vec3(a0.zw, h.y); vec3 p2 = vec3(a1.xy, h.z); vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0); m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * snoise(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }
`;

// --- plasma ------------------------------------------------------------------------------------------------------
// tube: object space x, y in [-1, 1] around the axis, z from 0 to 1 along it (scaled by the beam's length, uLen);
// sphere: unit sphere (scaled by its radius)
const plasmaVS = `${NOISE}
uniform float uTime; uniform float uLen; uniform float uWob; uniform float uTube;
varying vec3 vN; varying vec3 vV; varying vec3 vP;
void main(){
  vP = position;
  vec3 p = position;
  float w = snoise(vec3(p.x * 1.7, p.y * 1.7, p.z * mix(1.7, uLen * 0.9, uTube) - uTime * 4.0)) * uWob;
  p += normal * w;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const plasmaFS = `${NOISE}
uniform vec3 uC0; uniform vec3 uC1; uniform vec3 uC2;
uniform float uPow; uniform float uOp; uniform float uTime; uniform float uLen; uniform float uSpeed; uniform float uScale;
uniform float uWisp; uniform float uTube;
varying vec3 vN; varying vec3 vV; varying vec3 vP;
void main(){
  float f = abs(dot(normalize(vN), normalize(vV)));
  float along = vP.z * mix(1.0, uLen * 0.5, uTube);
  vec3 q = vec3(vP.x * uScale, vP.y * uScale, along * uScale - uTime * uSpeed);
  float n = fbm(q + vec3(sin(uTime * 0.9) * 0.6, cos(uTime * 0.7) * 0.6, 0.0));
  float streak = snoise(vec3(vP.x * uScale * 2.2, vP.y * uScale * 2.2, along * uScale * 0.45 - uTime * uSpeed * 1.7));
  float body = pow(f, uPow);
  float I = body * (0.62 + 0.7 * n) + 0.3 * max(streak, 0.0) * body;
  // the outer layer: only tendrils of energy, licking around the body
  if (uWisp > 0.0) I = smoothstep(0.42, 0.95, 0.5 + n * 0.75 + streak * 0.25) * pow(f, 0.7) * uWisp;
  if (uTube > 0.5) I *= smoothstep(0.0, 0.025, vP.z);
  I = clamp(I, 0.0, 1.35);
  vec3 col = mix(uC0, uC1, smoothstep(0.1, 0.55, I));
  col = mix(col, uC2, smoothstep(0.62, 1.05, I));
  gl_FragColor = vec4(col * I * uOp, 1.0);
}`;
export function plasmaMat(c0, c1, c2, o = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uC0: { value: new THREE.Color(c0) }, uC1: { value: new THREE.Color(c1) }, uC2: { value: new THREE.Color(c2) },
      uPow: { value: o.pow ?? 1.4 }, uOp: { value: o.op ?? 1 }, uTime: { value: 0 }, uLen: { value: 1 }, uSpeed: { value: o.speed ?? 6 },
      uScale: { value: o.scale ?? 1.6 }, uWisp: { value: o.wisp ?? 0 }, uTube: { value: o.tube ? 1 : 0 }, uWob: { value: o.wob ?? 0.05 },
    },
    vertexShader: plasmaVS, fragmentShader: plasmaFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}

// unit tube along +Z from 0 to 1 (radius 1)
function tubeGeo(seg = 28, rings = 40) {
  const g = new THREE.CylinderGeometry(1, 1, 1, seg, rings, true);
  g.rotateX(Math.PI / 2); g.translate(0, 0, 0.5);
  return g;
}

// --- motes: glowing specks animated on the GPU (along a beam, or drawn into a ball) --------------------------------
function motes(n, color, size, sphere) {
  const g = new THREE.BufferGeometry();
  const seed = new Float32Array(n * 4);
  for (let i = 0; i < n * 4; i++) seed[i] = Math.random();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
  const U = { uTime: { value: 0 }, uLen: { value: 1 }, uR: { value: 1 }, uSpeed: { value: sphere ? 1.6 : 1.1 } };
  const m = new THREE.PointsMaterial({ color, size, map: glowTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = 'uniform float uTime; uniform float uLen; uniform float uR; uniform float uSpeed; attribute vec4 seed; varying float vFade;\n' + sh.vertexShader.replace('#include <begin_vertex>', sphere
      // drawn in toward the centre from all around, faster as they get close
      ? `float ph = fract(seed.x + uTime * uSpeed * (0.6 + seed.y));
        float a = seed.z * 6.2832 + uTime * 2.0, b = seed.w * 3.1416;
        vec3 d = vec3(cos(a) * sin(b), cos(b), sin(a) * sin(b));
        vec3 transformed = d * uR * mix(3.2, 0.55, ph * ph);
        vFade = smoothstep(0.0, 0.25, ph) * (1.0 - smoothstep(0.85, 1.0, ph));`
      // streaming out along the beam, spiralling around it
      : `float ph = fract(seed.x + uTime * uSpeed * (0.55 + seed.y));
        float a = seed.z * 6.2832 + uTime * 5.0 * (seed.y - 0.5) + ph * 9.0;
        float rad = uR * (0.25 + seed.w * 1.15);
        vec3 transformed = vec3(cos(a) * rad, sin(a) * rad, ph * uLen);
        vFade = sin(ph * 3.1416);`);
    sh.fragmentShader = 'varying float vFade;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= vFade;');
  };
  m.customProgramCacheKey = () => (sphere ? 'motes-ball' : 'motes-beam'); // (the same code text: tell the two apart)
  const p = new THREE.Points(g, m);
  p.frustumCulled = false;
  p.userData.U = U;
  return p;
}

// --- electric arcs: jagged ribbons (two crossed planes: seen from anywhere), redrawn a few times a second -----------
function arcRibbon(color, n = 14) {
  const pos = new Float32Array(n * 4 * 3), idx = [];
  for (let i = 0; i < n - 1; i++) for (const o of [0, 2 * n]) { const a = o + i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  m.frustumCulled = false;
  m.userData.n = n;
  return m;
}
// the points of the arc: from a to b (local), jagged around the straight line, with a width w
function layArc(m, pts, w) {
  const n = m.userData.n, P = m.geometry.attributes.position;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const k = w * (1 - Math.abs(i / (n - 1) - 0.5) * 1.2);
    P.setXYZ(i * 2, p[0] + k, p[1], p[2]); P.setXYZ(i * 2 + 1, p[0] - k, p[1], p[2]);
    P.setXYZ(2 * n + i * 2, p[0], p[1] + k, p[2]); P.setXYZ(2 * n + i * 2 + 1, p[0], p[1] - k, p[2]);
  }
  P.needsUpdate = true;
}
const jag = (n, a, b, amp) => {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), s = Math.sin(t * Math.PI);
    out.push([a[0] + (b[0] - a[0]) * t + (Math.random() - 0.5) * amp * s, a[1] + (b[1] - a[1]) * t + (Math.random() - 0.5) * amp * s, a[2] + (b[2] - a[2]) * t + (Math.random() - 0.5) * amp * s * 0.5]);
  }
  return out;
};

// --- the palettes ----------------------------------------------------------------------------------------------------
export const ENERGY = {
  kame: { c0: '#0a2cff', c1: '#2aa8ff', c2: '#f2fdff', arc: '#bff2ff', mote: '#8fe0ff', flare: '#4fb8ff' },
  holy: { c0: '#ff6a00', c1: '#ffc83a', c2: '#fffdf2', arc: '#fff2b8', mote: '#ffe08a', flare: '#ffc060' },
};

// a beam: a group whose local +Z is its way, from 0 to len; radius r
export function energyBeam(look) {
  const C = ENERGY[look] || ENERGY.kame;
  const g = new THREE.Group();
  const geo = tubeGeo();
  const core = new THREE.Mesh(geo, plasmaMat(C.c1, C.c2, '#ffffff', { tube: 1, pow: 3.0, op: 0.85, speed: 9, scale: 2.2, wob: 0.03 }));
  const body = new THREE.Mesh(geo, plasmaMat(C.c0, C.c1, C.c2, { tube: 1, pow: 1.45, op: 0.72, speed: 7, scale: 1.5, wob: 0.08 }));
  const wisp = new THREE.Mesh(geo, plasmaMat(C.c1, C.c1, C.c2, { tube: 1, op: 0.85, speed: 5, scale: 1.1, wisp: 0.7, wob: 0.18 }));
  for (const m of [core, body, wisp]) { m.frustumCulled = false; g.add(m); }
  const sph = new THREE.SphereGeometry(1, 32, 20);
  const tip = new THREE.Mesh(sph, plasmaMat(C.c0, C.c1, C.c2, { pow: 1.0, op: 1.0, speed: 3, scale: 1.8, wob: 0.12 }));
  const tipCore = new THREE.Mesh(sph, plasmaMat(C.c1, C.c2, '#ffffff', { pow: 1.8, op: 1.0, speed: 4, scale: 2.4 }));
  const muzzle = new THREE.Mesh(sph, plasmaMat(C.c0, C.c1, C.c2, { pow: 1.0, op: 0.95, speed: 3, scale: 1.8, wob: 0.1 }));
  g.add(tip, tipCore, muzzle);
  const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: C.flare, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  g.add(flare);
  const arcs = [0, 1, 2, 3].map(() => { const a = arcRibbon(C.arc); g.add(a); return a; });
  const mo = motes(70, C.mote, 0.16, false);
  g.add(mo);
  const mats = [core, body, wisp, tip, tipCore, muzzle].map((m) => m.material);
  g.userData.energy = { core, body, wisp, tip, tipCore, muzzle, flare, arcs, mo, mats, arcT: -1 };
  return g;
}
export function updateEnergyBeam(g, len, r, t) {
  const E = g.userData.energy;
  const wob = 1 + Math.sin(t * 55) * 0.05 + Math.sin(t * 31) * 0.04;
  E.core.scale.set(r * 0.32 * wob, r * 0.32 * wob, len);
  E.body.scale.set(r * 0.9 * wob, r * 0.9 * wob, len);
  E.wisp.scale.set(r * 1.35, r * 1.35, len);
  for (const m of E.mats) { m.uniforms.uTime.value = t; m.uniforms.uLen.value = len; }
  E.tip.position.set(0, 0, len); E.tip.scale.setScalar(r * (1.2 + Math.sin(t * 40) * 0.08));
  E.tipCore.position.set(0, 0, len); E.tipCore.scale.setScalar(r * 0.7);
  E.muzzle.scale.setScalar(r * (0.95 + Math.sin(t * 47) * 0.07));
  E.flare.position.set(0, 0, len); E.flare.scale.setScalar(r * 3.2);
  const U = E.mo.userData.U; U.uTime.value = t; U.uLen.value = len; U.uR.value = r;
  // the arcs: new zigzags 18 times a second, crawling along the beam, a few at a time
  const step = Math.floor(t * 18);
  if (step !== E.arcT) {
    E.arcT = step;
    for (const a of E.arcs) {
      const on = Math.random() < 0.7 && len > 0.6;
      a.visible = on;
      if (!on) continue;
      const z0 = Math.random() * len * 0.85, z1 = Math.min(len, z0 + 0.8 + Math.random() * 2.2);
      const ang0 = Math.random() * 6.28, ang1 = ang0 + (Math.random() - 0.5) * 3;
      const ra = r * (0.7 + Math.random() * 0.6);
      layArc(a, jag(a.userData.n, [Math.cos(ang0) * ra, Math.sin(ang0) * ra, z0], [Math.cos(ang1) * ra, Math.sin(ang1) * ra, z1], r * 0.9), 0.022 + r * 0.02);
      a.material.opacity = 0.6 + Math.random() * 0.4;
    }
  }
}

// a ball of energy (unit radius: scale the group): the charge between the palms, ANBUU's orb
export function energyBall(look, o = {}) {
  const C = ENERGY[look] || ENERGY.kame;
  const g = new THREE.Group();
  const sph = new THREE.SphereGeometry(1, 32, 20);
  const shell = new THREE.Mesh(sph, plasmaMat(C.c1, C.c1, C.c2, { pow: 0.75, op: 1.05, speed: 2.5, scale: 1.6, wob: 0.14 }));
  const core = new THREE.Mesh(sph, plasmaMat(C.c1, C.c2, '#ffffff', { pow: 2.0, op: 0.8, speed: 3.5, scale: 2.2, wob: 0.05 }));
  core.scale.setScalar(0.5);
  const wisp = new THREE.Mesh(sph, plasmaMat(C.c1, C.c1, C.c2, { op: 1.0, speed: 2, scale: 1.3, wisp: 0.9, wob: 0.25 }));
  wisp.scale.setScalar(1.45);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: C.flare, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.setScalar(o.halo ?? 3.0);
  g.add(shell, core, wisp, halo);
  const arcs = [0, 1, 2].map(() => { const a = arcRibbon(C.arc, 10); g.add(a); return a; });
  const mo = o.motes === false ? null : motes(44, C.mote, 0.09, true);
  if (mo) g.add(mo);
  g.userData.energy = { shell, core, wisp, halo, arcs, mo, mats: [shell, core, wisp].map((m) => m.material), arcT: -1 };
  return g;
}
export function updateEnergyBall(g, t, k = 1) {
  const E = g.userData.energy;
  for (const m of E.mats) m.uniforms.uTime.value = t;
  E.shell.rotation.set(t * 0.7, t * 1.1, 0); E.wisp.rotation.set(-t * 0.5, t * 0.8, t * 0.3);
  E.halo.material.opacity = 0.32 + 0.14 * Math.sin(t * 27);
  if (E.mo) { E.mo.userData.U.uTime.value = t; E.mo.userData.U.uR.value = 1; }
  const step = Math.floor(t * 16);
  if (step !== E.arcT) {
    E.arcT = step;
    for (const a of E.arcs) {
      const on = Math.random() < 0.35 + k * 0.45;
      a.visible = on;
      if (!on) continue;
      const u = Math.random() * 6.28, v = Math.random() * 3.14, u2 = u + (Math.random() - 0.5) * 2.4, v2 = v + (Math.random() - 0.5) * 1.6;
      const R = 1.05 + Math.random() * 0.5;
      const A = [Math.cos(u) * Math.sin(v) * 0.95, Math.cos(v) * 0.95, Math.sin(u) * Math.sin(v) * 0.95];
      const B = [Math.cos(u2) * Math.sin(v2) * R, Math.cos(v2) * R, Math.sin(u2) * Math.sin(v2) * R];
      layArc(a, jag(a.userData.n, A, B, 0.5), 0.05);
      a.material.opacity = 0.55 + Math.random() * 0.45;
    }
  }
}

// --- liquids ---------------------------------------------------------------------------------------------------------
// a puddle on the floor: a disc of radius 1 in its XY plane (laid flat by its parent), the edge a blob that never
// looks drawn with a compass, a meniscus at the rim, the night sky in it (fresnel), ripples, glints of light
const puddleVS = `varying vec2 vP; varying vec3 vW;
void main(){ vP = position.xy; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const puddleFS = `${NOISE}
uniform vec3 uC; uniform vec3 uSky; uniform float uOp; uniform float uTime; uniform float uSeed; uniform float uFade; uniform float uMilk; uniform float uBirth; uniform float uLit;
varying vec2 vP; varying vec3 vW;
void main(){
  vec2 p = vP;
  float d = length(p) + 0.14 * snoise(vec3(p * 1.5, uSeed)) + 0.05 * snoise(vec3(p * 4.2, uSeed + 3.0));
  float edge = 1.0 - smoothstep(0.8, 0.86, d);
  if (edge < 0.01) discard;
  // ripples: rings from a few drops, and the splash of its birth
  float rip = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float tt = fract(uTime * 0.32 + fi * 0.37 + uSeed);
    vec2 c = vec2(sin(uSeed * 3.1 + fi * 2.1 + floor(uTime * 0.32 + fi * 0.37 + uSeed) * 1.7), cos(uSeed * 1.7 + fi * 1.3 + floor(uTime * 0.32 + fi * 0.37 + uSeed) * 2.3)) * 0.42;
    float r = length(p - c) - tt * 0.7;
    rip += exp(-r * r * 900.0) * (1.0 - tt) * 0.8;
  }
  float br = length(p) - uBirth * 1.1;
  rip += exp(-br * br * 300.0) * (1.0 - uBirth) * 1.5;
  float nx = 0.1 * snoise(vec3(p * 3.0, uTime * 0.35 + uSeed)) + rip * 0.35;
  float nz = 0.1 * snoise(vec3(p * 3.0 + 7.0, uTime * 0.35 + uSeed)) + rip * 0.35;
  vec3 N = normalize(vec3(nx, 1.0, -nz));
  vec3 V = normalize(cameraPosition - vW);
  float fres = pow(1.0 - max(dot(N, V), 0.0), 2.5);
  vec3 L1 = normalize(vec3(-0.35, 0.75, 0.55)), L2 = normalize(vec3(0.6, 0.6, 0.4));
  vec3 R = reflect(-V, N);
  float spec = pow(max(dot(R, L1), 0.0), 90.0) * 1.4 + pow(max(dot(R, L2), 0.0), 40.0) * 0.4;
  float rim = smoothstep(0.6, 0.83, d) * edge;
  vec3 col = mix(uC * uLit, uSky, fres * (1.0 - uMilk * 0.5));
  col = col * (0.75 + 0.25 * (1.0 - rim)) + vec3(min(spec, 1.2)) + rim * vec3(0.22) + rip * vec3(0.28);
  float a = edge * mix(uOp, 1.0, clamp(fres * 0.45 + rim * 0.35 + spec, 0.0, 1.0)) * uFade;
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
export function puddleMat(color, o = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uC: { value: new THREE.Color(color) }, uSky: { value: new THREE.Color(o.sky || '#3c3266') }, uLit: { value: o.lit ?? 0.55 }, uOp: { value: o.op ?? 0.7 }, uTime: { value: 0 },
      uSeed: { value: Math.random() * 10 }, uFade: { value: 1 }, uMilk: { value: o.milk ?? 0 }, uBirth: { value: 0 } },
    vertexShader: puddleVS, fragmentShader: puddleFS, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3,
  });
}

// a stream of liquid along a curve (world space: from A, pulled toward K, to B), a ribbon facing the camera
const streamVS = `uniform vec3 uA; uniform vec3 uB; uniform vec3 uK; uniform float uR; uniform float uTime; uniform float uEnd;
varying vec2 vUv;
vec3 bez(float t){ float s = 1.0 - t; return s * s * uA + 2.0 * s * t * uK + t * t * uB; }
void main(){
  float t = uv.y * uEnd;
  vec3 P = bez(t);
  vec4 vp = viewMatrix * vec4(P, 1.0);
  vec4 vt = viewMatrix * vec4(bez(min(1.0, t + 0.01)) - bez(max(0.0, t - 0.01)), 0.0);
  vec2 side = normalize(vec2(-vt.y, vt.x) + 1e-5);
  float r = uR * (1.0 - 0.4 * t) * (0.88 + 0.12 * sin(t * 37.0 - uTime * 28.0));
  vp.xy += side * (uv.x - 0.5) * 2.0 * r;
  vUv = vec2(uv.x, t);
  gl_Position = projectionMatrix * vp;
}`;
const streamFS = `${NOISE}
uniform vec3 uC; uniform float uOp; uniform float uTime;
varying vec2 vUv;
void main(){
  float x = vUv.x * 2.0 - 1.0;
  float body = 1.0 - x * x;
  float n = snoise(vec3(x * 2.5, vUv.y * 9.0 - uTime * 14.0, 0.0));
  float hl = pow(max(0.0, 1.0 - abs(x + 0.42) * 4.5), 2.0);
  vec3 col = uC * (0.62 + 0.38 * body) + vec3(hl) * 0.75 + n * 0.07;
  float a = smoothstep(1.0, 0.7, abs(x)) * uOp * (0.8 + 0.2 * body);
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
export function streamObj(color, o = {}) {
  const geo = new THREE.PlaneGeometry(1, 1, 1, 28);
  geo.translate(0.5, 0.5, 0); // uv and position from 0 to 1
  const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    uniforms: { uA: { value: new THREE.Vector3() }, uB: { value: new THREE.Vector3() }, uK: { value: new THREE.Vector3() }, uR: { value: o.r ?? 0.05 },
      uTime: { value: 0 }, uEnd: { value: 1 }, uOp: { value: o.op ?? 0.85 }, uC: { value: new THREE.Color(color) } },
    vertexShader: streamVS, fragmentShader: streamFS, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  }));
  m.frustumCulled = false;
  return m;
}
