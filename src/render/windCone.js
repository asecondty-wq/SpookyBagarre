// The wind of a fall: a cone of air from the feet, opening behind the fighter along its flight (up when it drops
// straight, leaning when it drifts). Bright at its rims, clear in the middle (the body shows through), lines of air
// spiralling up it, the near side brighter than the far one (behind the body); it fades out toward its open end.
// One per fighter (src/game/matchView.js).
import * as THREE from 'three';

const geo = new THREE.CylinderGeometry(1, 0.03, 1, 28, 1, true).translate(0, 0.5, 0); // apex at 0, opening up +Y
const _up = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3();

const VERT = `
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main() {
  vUv = uv;
  vN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = `
uniform float uT, uK; uniform vec3 uC;
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main() {
  float v = clamp(vUv.y, 0.0, 1.0);                           // 0 at the feet, 1 at the open end
  float rim = 1.0 - abs(dot(normalize(vN), normalize(vV)));
  rim = rim * rim;
  float a = vUv.x * 6.2832;
  // lines of air spiralling up the cone as they stream past: they wrap around the body (in front of it, then behind)
  float line = smoothstep(0.72, 1.0, sin(a * 7.0 + v * 8.0 - uT * 11.0));
  float flow = 0.55 + 0.45 * sin(v * 6.0 - uT * 15.0 + a * 3.0);
  float along = smoothstep(0.0, 0.1, v) * pow(max(1.0 - v, 0.0), 1.5);
  // the near side (facing the camera, in front of the fighter) bright; the far side, seen through it and hidden by
  // the body where it passes behind, dimmer: the cone reads as round
  float side = gl_FrontFacing ? 1.0 : 0.42;
  float al = max(0.0, uK * along * side * (rim * 0.85 + line * flow * 0.85 + 0.05));
  gl_FragColor = vec4(uC * al, al);
}`;

export class WindCone {
  constructor(scene) {
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, uniforms: { uT: { value: 0 }, uK: { value: 0 }, uC: { value: new THREE.Color('#cfdcff') } },
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 20;
    scene.add(this.mesh);
    this.k = 0;
    this.dir = new THREE.Vector3(0, 1, 0);
    this.warm = 2; // drawn (invisible) the first frames: the shader compiles at the start of the match, not mid-fall
  }

  // on: blowing; feet: world position of the feet; vx, vy: velocity; h, w: the fighter's height and width
  update(on, feet, vx, vy, h, w, t, dt) {
    const sp = Math.hypot(vx, vy);
    const want = on ? Math.max(0.45, Math.min(1, (sp - 9) / 9)) : 0;
    this.k += (want - this.k) * Math.min(1, dt * (want > this.k ? 10 : 7));
    if (sp > 1) this.dir.lerp(_d.set(-vx / sp, -vy / sp, 0), Math.min(1, dt * 12)).normalize();
    this.mat.uniforms.uT.value = t;
    this.mat.uniforms.uK.value = this.k;
    if (this.warm > 0) this.warm--;
    this.mesh.visible = this.warm > 0 || this.k > 0.01;
    if (!this.mesh.visible) return;
    const L = h * (1.25 + Math.min(0.6, sp * 0.02)), R = w * 0.75 + 0.3;
    this.mesh.position.set(feet.x - this.dir.x * 0.12, feet.y - this.dir.y * 0.12, feet.z);
    this.mesh.quaternion.setFromUnitVectors(_up, this.dir);
    this.mesh.scale.set(R, L, R);
  }

  dispose() { this.mesh.parent && this.mesh.parent.remove(this.mesh); this.mat.dispose(); }
}
