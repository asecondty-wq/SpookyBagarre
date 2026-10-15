// The shield: an energy bubble in the player's colour. A bright rim (fresnel), a hexagon lattice that ripples across
// it, the middle clear so the fighter stays readable; weaker, it shrinks, pales toward red and flickers; a blow it
// stops sends a ripple from where it landed (hit(), from src/render/fx.js); broken, it bursts into shards (burst()).
import * as THREE from 'three';

const VERT = `
varying vec3 vN; varying vec3 vV; varying vec3 vP;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vP = position;
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const FRAG = `
uniform vec3 uColor; uniform float uTime; uniform float uHealth; uniform float uAlpha;
uniform vec3 uHitP; uniform float uHitT;
varying vec3 vN; varying vec3 vV; varying vec3 vP;
// distance to the nearest hexagon edge (0 on the edges), on a 2D coordinate
float hexEdge(vec2 p) {
  p *= vec2(1.0, 1.1547);
  vec2 a = mod(p, vec2(1.0, 1.732)) - vec2(0.5, 0.866);
  vec2 b = mod(p + vec2(0.5, 0.866), vec2(1.0, 1.732)) - vec2(0.5, 0.866);
  vec2 g = dot(a, a) < dot(b, b) ? a : b;
  vec2 q = abs(g);
  return 0.5 - max(dot(q, normalize(vec2(1.0, 1.732))), q.x);
}
void main() {
  vec3 n = normalize(vN);
  float fres = pow(1.0 - abs(dot(n, normalize(vV))), 2.2);
  // the lattice on the sphere (two projections blended, so it does not pinch at the poles)
  vec3 p = normalize(vP);
  vec2 uvA = vec2(atan(p.z, p.x) * 2.2, p.y * 3.4);
  float e = hexEdge(uvA * 1.6 + vec2(0.0, uTime * 0.25));
  float lines = smoothstep(0.06, 0.0, e);
  // a slow wave of light sweeping up the lattice
  float wave = smoothstep(0.85, 1.0, sin(p.y * 6.0 - uTime * 3.0) * 0.5 + 0.5);
  // the ripple of a stopped blow: a ring running out from where it landed
  float d = distance(p, normalize(uHitP));
  float age = uTime - uHitT;
  float ring = age < 0.6 ? smoothstep(0.12, 0.0, abs(d - age * 3.2)) * (1.0 - age / 0.6) : 0.0;
  float flash = age < 0.1 ? (1.0 - age / 0.1) * 0.18 : 0.0; // brief: it must not hide the fighter
  // weak: paler, toward red, flickering
  vec3 col = mix(vec3(1.0, 0.3, 0.25), uColor, smoothstep(0.15, 0.6, uHealth));
  float flick = uHealth < 0.3 ? 0.65 + 0.35 * step(0.5, fract(uTime * 9.0)) : 1.0;
  float a = (0.02 + fres * 0.6 + lines * (0.14 + wave * 0.3) * (0.35 + fres) + ring * 0.7 + flash) * uAlpha * flick;
  vec3 c = col * (0.55 + fres * 1.2 + lines * 0.5 + wave * lines) + vec3(1.0) * (ring * 0.6 + flash + fres * fres * 0.3);
  gl_FragColor = vec4(c, clamp(a, 0.0, 1.0));
}`;

export function makeShield(color) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uHealth: { value: 1 }, uAlpha: { value: 1 },
      uHitP: { value: new THREE.Vector3(1, 0, 0) }, uHitT: { value: -9 },
    },
  });
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), mat);
  g.add(shell);
  // a faint coloured core so the bubble reads as filled, not only as a rim
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.97, 24, 16), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.045, depthWrite: false }));
  g.add(core);
  g.userData = { mat, core, shards: [] };
  g.visible = false;
  return g;
}

// every frame while shielding: health 0..1, t the match time
export function updateShield(S, health, t, stun) {
  const u = S.userData.mat.uniforms;
  u.uTime.value = t;
  u.uHealth.value = health;
  u.uAlpha.value = stun > 0 ? 1.12 : 1;
}

// a blow stopped by the shield: the ripple from that point (world position)
const tmp = new THREE.Vector3();
export function hitShield(S, wx, wy, wz, t) {
  const u = S.userData.mat.uniforms;
  S.updateWorldMatrix(true, false);
  tmp.set(wx, wy, wz);
  S.worldToLocal(tmp);
  u.uHitP.value.copy(tmp.lengthSq() > 1e-6 ? tmp : tmp.set(1, 0, 0));
  u.uHitT.value = t;
}

// broken: flat shards flying out from the bubble (added to `scene`, they fade by themselves)
export function burstShield(scene, x, y, z, color, size = 1) {
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  const geo = new THREE.CircleGeometry(0.16 * size, 6);
  const parts = [];
  for (let i = 0; i < 26; i++) {
    const s = new THREE.Mesh(geo, m);
    const a = (i / 26) * Math.PI * 2, b = (Math.random() - 0.5) * Math.PI;
    const dir = new THREE.Vector3(Math.cos(a) * Math.cos(b), Math.sin(b) * 0.8 + 0.2, Math.sin(a) * Math.cos(b) * 0.5);
    s.position.set(x, y, z).addScaledVector(dir, 0.8 * size);
    s.userData = { v: dir.multiplyScalar(6 + Math.random() * 5), w: new THREE.Vector3(Math.random() * 9, Math.random() * 9, Math.random() * 9) };
    scene.add(s);
    parts.push(s);
  }
  let life = 0.7;
  return (dt) => {
    life -= dt;
    m.opacity = Math.max(0, life / 0.7) * 0.9;
    for (const s of parts) {
      s.userData.v.y -= 14 * dt;
      s.position.addScaledVector(s.userData.v, dt);
      s.rotation.x += s.userData.w.x * dt; s.rotation.y += s.userData.w.y * dt;
    }
    if (life <= 0) { for (const s of parts) scene.remove(s); geo.dispose(); m.dispose(); return false; }
    return true;
  };
}
