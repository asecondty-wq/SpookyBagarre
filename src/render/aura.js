// L'aura multicolore d'un combattant dont l'ultime est prêt (comme la lueur arc-en-ciel d'un Final Smash) : un grand
// plan toujours tourné vers la caméra, additif, de flammes qui montent autour du corps et dont la teinte glisse sur tout
// l'arc-en-ciel. Un seul plan par combattant, aucune texture : tout est dans le shader (bruit de valeur, deux couches).
import * as THREE from 'three';

const VS = `uniform vec2 uSize; uniform float uBack; varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  // pushed uBack metres away from the camera (behind the body: the body hides it, the glow only frames it), yet the
  // same size and place on the screen
  float zb = -mv.z;
  float k = (zb + uBack) / zb;
  mv.xy = (mv.xy + position.xy * uSize) * k;
  mv.z -= uBack;
  gl_Position = projectionMatrix * mv;
}`;

const FS = `varying vec2 vUv; uniform float uTime; uniform float uOp; uniform float uHue; uniform float uSat;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p) { return vn(p) * 0.55 + vn(p * 2.1) * 0.3 + vn(p * 4.3) * 0.15; }
vec3 hsv(vec3 c) { vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0); vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www); return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y); }
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float n1 = fbm(vec2(p.x * 2.4, p.y * 1.7 - uTime * 1.9));
  float n2 = fbm(vec2(p.x * 3.6 + 4.0, p.y * 2.5 - uTime * 2.8));
  float rise = n1 * 0.6 + n2 * 0.4;
  // a tall soft body (the fighter stands in it), licked by flames that climb and thin out toward the top
  float e = length(vec2(p.x * 1.05, (p.y + 0.06) * 0.78));
  float core = 1.0 - smoothstep(0.3, 1.0, e);
  float fl = core * 1.2 + (rise - 0.45) * 0.95 - max(p.y, 0.0) * 0.3 - 0.08;
  fl = smoothstep(0.08, 0.85, fl);
  float hue = fract(uHue + uTime * 0.3 + p.y * 0.32 + rise * 0.5 + p.x * 0.16);
  vec3 col = hsv(vec3(hue, uSat, 1.0));
  col = mix(col, vec3(1.0), smoothstep(0.8, 1.0, fl) * 0.3);
  gl_FragColor = vec4(col * fl * uOp, 1.0);
}`;

let GEO = null;
export function makeAura() {
  GEO = GEO || new THREE.PlaneGeometry(1, 1);
  const m = new THREE.Mesh(GEO, new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOp: { value: 0 }, uHue: { value: 0 }, uSat: { value: 0.78 }, uBack: { value: 0.9 }, uSize: { value: new THREE.Vector2(2, 3) } },
    vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  m.frustumCulled = false;
  m.renderOrder = 3;
  m.visible = false;
  return m;
}

// k: 0..1 how strong; w, h: size in metres (a figure of height 1.74 m: 2.4 x 3.2)
export function setAura(m, t, k, w, h, hue = 0) {
  m.visible = k > 0.01;
  if (!m.visible) return;
  const U = m.material.uniforms;
  U.uTime.value = t; U.uOp.value = k; U.uHue.value = hue; U.uSize.value.set(w, h);
}
