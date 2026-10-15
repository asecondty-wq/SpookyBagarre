// Blood on the fighters: dark glossy patches that spread over the body and run down in drips as the fighter takes
// damage (F.bloodied, 0..1), painted into the model's own material (a few lines of shader), stuck to the body parts
// (they move with them). The "Hémoglobine" option scales it (0: none).
import * as THREE from 'three';

const HEAD = /* glsl */`
uniform float uBlood; uniform vec3 uBO; uniform vec3 uBUp; uniform vec3 uBA; uniform vec3 uBB; uniform float uBInvH;
varying vec3 vBloodP;
float bHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float bNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(bHash(i), bHash(i + vec2(1.0, 0.0)), f.x), mix(bHash(i + vec2(0.0, 1.0)), bHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float bBlob(vec2 q) { return bNoise(q) * 0.65 + bNoise(q * 2.3 + 7.1) * 0.35; }
// 0..1: how much blood covers this point of the body
float bloodMask(float amt) {
  vec3 d = vBloodP - uBO;
  float y = dot(d, uBUp) * uBInvH;                       // 0 at the feet, 1 at the head
  float u = (dot(d, uBA) + dot(d, uBB) * 0.7) * uBInvH;  // around the body
  vec2 q = vec2(u * 7.0, y * 7.0);
  float th = 1.0 - amt * 0.5;
  float m = smoothstep(th, th + 0.05, bBlob(q));
  // drips: thin streaks running down from the patches above
  float col = smoothstep(0.55, 0.78, bNoise(vec2(u * 46.0, 3.0)));
  float drip = 0.0;
  for (int k = 1; k < 8; k++) {
    float b = bBlob(q + vec2(0.0, float(k) * 0.16));
    drip = max(drip, smoothstep(th, th + 0.05, b) * (1.0 - float(k) / 8.0));
  }
  return clamp(max(m, drip * col), 0.0, 1.0) * step(0.001, amt);
}
float bloodM = 0.0;
`;

// paints blood into every mesh of a rigged model; returns the uniforms to drive (setBlood)
export function addBlood(meshes) {
  const all = [];
  for (const o of meshes) {
    const m = o.material;
    if (!m || m.userData.blood) continue;
    const g = o.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox, size = bb.getSize(new THREE.Vector3());
    // the model's up axis is its longest side (a standing fighter), the two others go around it
    const ax = [0, 1, 2].sort((a, b) => size.getComponent(b) - size.getComponent(a));
    const vec = (i) => new THREE.Vector3(i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0);
    const U = {
      uBlood: { value: 0 }, uBO: { value: bb.min.clone() }, uBUp: { value: vec(ax[0]) }, uBA: { value: vec(ax[1]) }, uBB: { value: vec(ax[2]) },
      uBInvH: { value: 1 / Math.max(1e-4, size.getComponent(ax[0])) },
    };
    m.userData.blood = U;
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = 'varying vec3 vBloodP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vBloodP = position;');
      sh.fragmentShader = HEAD + sh.fragmentShader
        .replace('#include <map_fragment>', '#include <map_fragment>\n  bloodM = bloodMask(uBlood);\n  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.004, 0.01), bloodM * 0.9);')
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, 0.22, bloodM);');
    };
    m.customProgramCacheKey = () => 'blood1';
    m.needsUpdate = true;
    all.push(U);
  }
  return all;
}

export function setBlood(U, amount) {
  for (const u of U) u.uBlood.value = amount;
}
