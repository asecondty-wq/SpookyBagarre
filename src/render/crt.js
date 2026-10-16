// Le petit filtre « télé cathodique » des mini-jeux : l'image de l'écran (un canevas 2D) passe par un shader avant d'être
// posée dans la télé (src/render/minigameView.js) : verre un peu bombé, lignes de balayage douces, grille de phosphore
// légère, un soupçon de franges de couleur vers les bords, coins assombris, lueur et scintillement discrets. Tout reste
// léger pour que le jeu soit lisible. Un moteur WebGL à part, minuscule (un seul rectangle) ; s'il ne marche pas, on
// pose l'image telle quelle.
import * as THREE from 'three';

const VERT = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const FRAG = `
precision mediump float;
uniform sampler2D t; uniform float lines; uniform float time; uniform vec2 px;
varying vec2 vUv;
// le verre bombé : les bords s'écartent un peu
vec2 bulge(vec2 uv) { uv = uv * 2.0 - 1.0; vec2 o = abs(uv.yx) / vec2(12.0, 10.0); uv += uv * o * o; return uv * 0.5 + 0.5; }
void main() {
  vec2 uv = bulge(vUv);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { gl_FragColor = vec4(0.015, 0.012, 0.025, 1.0); return; }
  // franges de couleur, nulles au centre, un peu vers les bords
  vec2 d = (uv - 0.5) * 0.0016;
  vec3 c = vec3(texture2D(t, uv + d).r, texture2D(t, uv).g, texture2D(t, uv - d).b);
  // un peu de lueur : l'image voisine, adoucie
  vec3 glow = (texture2D(t, uv + vec2(px.x * 2.0, 0.0)).rgb + texture2D(t, uv - vec2(px.x * 2.0, 0.0)).rgb) * 0.5;
  c = max(c, glow * 0.25) * 1.02; // (les couleurs restent celles du jeu : juste de quoi compenser les lignes)
  // lignes de balayage douces (une onde, pas des traits), plus discrètes là où l'image est claire
  float l = lines * uv.y * 3.14159;
  float s = 0.5 + 0.5 * sin(l);
  float lum = dot(c, vec3(0.3, 0.59, 0.11));
  c *= mix(0.95 + 0.04 * lum, 1.0, s);
  // grille de phosphore (rouge, vert, bleu en colonnes), à peine
  float m = mod(gl_FragCoord.x, 3.0);
  c *= vec3(m < 1.0 ? 1.0 : 0.985, (m >= 1.0 && m < 2.0) ? 1.0 : 0.985, m >= 2.0 ? 1.0 : 0.985);
  // coins assombris (le tube), scintillement
  vec2 v = uv * (1.0 - uv.yx);
  c *= pow(clamp(v.x * v.y * 34.0, 0.0, 1.0), 0.1);
  c *= 0.995 + 0.005 * sin(time * 63.0);
  gl_FragColor = vec4(c, 1.0);
}`;

export class CRT {
  constructor() {
    this.canvas = document.createElement('canvas');
    try {
      this.gl = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    } catch (e) { this.gl = null; return; }
    this.gl.setPixelRatio(1);
    this.tex = new THREE.CanvasTexture(document.createElement('canvas'));
    this.tex.colorSpace = THREE.NoColorSpace; // (les couleurs telles quelles : ni décodées ni réencodées, exactement celles du jeu)
    this.tex.minFilter = THREE.LinearFilter; this.tex.generateMipmaps = false;
    this.mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { t: { value: this.tex }, lines: { value: 270 }, time: { value: 0 }, px: { value: new THREE.Vector2() } }, depthTest: false });
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat));
    this.cam = new THREE.Camera();
  }

  // l'image src (un canevas) passée au filtre ; rend le canevas filtré (ou src si le filtre ne marche pas)
  run(src, time) {
    if (!this.gl) return src;
    const w = src.width, h = src.height;
    if (this.canvas.width !== w || this.canvas.height !== h) this.gl.setSize(w, h, false);
    // (une autre image, ou la même à une autre taille : la texture est refaite, sa place sur la carte est figée à sa taille)
    if (this.tex.image !== src || this.tw !== w || this.th !== h) { this.tex.image = src; this.tex.dispose(); this.tw = w; this.th = h; }
    this.tex.needsUpdate = true;
    this.mat.uniforms.time.value = time; this.mat.uniforms.px.value.set(1 / w, 1 / h);
    this.mat.uniforms.lines.value = Math.min(300, h / 2); // pas plus de lignes que de pixels / 2 (sinon elles moirent)
    this.gl.render(this.scene, this.cam);
    return this.canvas;
  }
}
