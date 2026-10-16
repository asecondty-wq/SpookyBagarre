// Les lignes de vitesse en vidéo du KO (assets/fx/speedlines.webm : des lignes de lumière sur fond noir, ~450 Ko).
// La vidéo n'est que la partie utile de l'originale (412 × 404 px à gauche, là où les lignes partent du point de fuite),
// gardée à sa résolution native puis agrandie 2,5 fois en Lanczos : à l'écran les lignes restent nettes (l'ancienne version, en
// 640 × 360 agrandie ~5 fois, était floue).
// Elles sont posées en 3D, derrière les combattants : deux plans additifs enfants de la caméra, dessinés juste après
// le ciel, avec le test de profondeur (les corps et le décor proche les recouvrent), l'un reflété pour que les lignes
// jaillissent du point d'impact dans tous les sens. La vidéo est dorée : le shader en garde la luminance et la teinte
// de la couleur du perso qui frappe.
import * as THREE from 'three';

const VS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const FS = `varying vec2 vUv; uniform sampler2D uMap; uniform vec3 uTint; uniform float uOp;
void main() {
  vec3 c = texture2D(uMap, vUv).rgb;
  float l = dot(c, vec3(0.3, 0.59, 0.11));
  float hot = smoothstep(0.55, 1.0, l);
  gl_FragColor = vec4((uTint * l * 2.0 + vec3(hot * 0.7)) * uOp, 1.0);
}`;
// Le recadrage dans l'image d'origine (1280 × 720, de 0 à 1), le point de fuite des lignes dans ce recadrage (0..1, y du haut)
// et le grossissement : l'image d'origine est agrandie 2,4 fois autour du point d'impact, il ne reste que des lignes.
const CROP = { w: 412 / 1280, h: 404 / 720 };
const VP = { x: -76.8 / 412, y: (0.78 * 720 - 316) / 404 };
const SCALE = 2.4;

export class SpeedVideo {
  constructor(renderer) {
    this.R = renderer;
    const v = document.createElement('video');
    v.src = 'assets/fx/speedlines.webm'; v.muted = true; v.playsInline = true; v.preload = 'auto'; v.loop = false;
    this.video = v;
    this.tex = new THREE.VideoTexture(v);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: this.tex }, uTint: { value: new THREE.Color(1, 0.8, 0.2) }, uOp: { value: 0 } },
      // transparent, juste après le dôme du ciel (renderOrder -1) et avec le test de profondeur : le ciel est recouvert, les corps et le décor proche (opaques) recouvrent les lignes
      vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const geo = new THREE.PlaneGeometry(1, 1);
    this.planes = [1, -1].map((f) => { const m = new THREE.Mesh(geo, this.mat); m.scale.x = f; m.renderOrder = 0; m.frustumCulled = false; m.visible = false; this.R.camera.add(m); return m; });
    this.t = 0; this.life = 0; this.sx = 0.5; this.sy = 0.5; this.d = 10; this.on = false;
  }

  // sx, sy : le point d'impact à l'écran (0..1) ; dist : sa distance à la caméra ; tint : la couleur des lignes
  play(sx, sy, dist, tint, life = 1.05) {
    this.sx = sx; this.sy = sy; this.d = dist + 2.5; this.t = 0; this.life = life; this.on = true;
    this.mat.uniforms.uTint.value.set(tint);
    const v = this.video;
    try { v.currentTime = 0; const p = v.play(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* pas de vidéo : tant pis */ }
    this.place();
    for (const m of this.planes) m.visible = true;
  }

  place() {
    const cam = this.R.camera, d = this.d;
    const H = 2 * d * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2), W = H * cam.aspect;
    const w = SCALE * W * CROP.w, h = SCALE * H * CROP.h;
    const tx = (this.sx * 2 - 1) * W / 2, ty = (1 - this.sy * 2) * H / 2;
    const off = (VP.x - 0.5) * w; // le point de fuite, à gauche du centre du plan non reflété
    this.planes[0].position.set(tx - off, ty - (0.5 - VP.y) * h, -d);
    this.planes[1].position.set(tx + off, ty - (0.5 - VP.y) * h, -d);
    for (const m of this.planes) { m.scale.y = h; m.scale.x = Math.sign(m.scale.x || 1) * w; }
  }

  update(dt) {
    if (!this.on) return;
    this.t += dt;
    const k = this.t / this.life;
    if (k >= 1) { this.stop(); return; }
    this.mat.uniforms.uOp.value = Math.min(1, k / 0.08) * (k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1) * 0.95;
    this.place();
  }

  stop() {
    this.on = false; this.mat.uniforms.uOp.value = 0;
    for (const m of this.planes) m.visible = false;
    this.video.pause();
  }

  // le tout début du match : une image à vide, pour que la carte graphique compile le shader avant le premier KO
  warm(on) { if (this.on) return; for (const m of this.planes) m.visible = on; }

  dispose() { this.stop(); for (const m of this.planes) this.R.camera.remove(m); this.tex.dispose(); this.mat.dispose(); this.video.removeAttribute('src'); this.video.load(); }
}
