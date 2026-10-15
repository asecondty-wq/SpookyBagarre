// WebGL renderer. The 3D scene is drawn into an off-screen target, then composed through a post shader
// (impact frames, chromatic aberration, radial blur, flash, vignette, bloom).
//  - smooth look (default): full resolution, MSAA, soft shadows, bloom, linear upscale
//  - retro look: low resolution, nearest upscale, ordered dithering and 15-bit colour (N64 feel)
import * as THREE from 'three';
import { STYLE } from './style.js';

const VS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

const POST_FS = `
precision highp float;
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform float uBloom;
uniform vec2 uRes;
uniform float uChroma;
uniform vec3 uFlash;
uniform float uFlashAmt;
uniform float uImpact;
uniform vec2 uRadialC;
uniform float uRadial;
uniform float uVignette;
uniform float uRed;
uniform float uDither;
uniform float uGray;
uniform float uRetro;
varying vec2 vUv;

float bayer(vec2 p) {
  vec2 q = mod(floor(p), 4.0);
  int i = int(q.x + q.y * 4.0);
  float m[16];
  m[0]=0.0; m[1]=8.0; m[2]=2.0; m[3]=10.0; m[4]=12.0; m[5]=4.0; m[6]=14.0; m[7]=6.0;
  m[8]=3.0; m[9]=11.0; m[10]=1.0; m[11]=9.0; m[12]=15.0; m[13]=7.0; m[14]=13.0; m[15]=5.0;
  for (int k = 0; k < 16; k++) if (k == i) return m[k] / 16.0;
  return 0.0;
}
vec3 sampleScene(vec2 uv) {
  if (uChroma > 0.0005) {
    vec2 d = (uv - 0.5) * uChroma;
    return vec3(texture2D(tScene, uv + d).r, texture2D(tScene, uv).g, texture2D(tScene, uv - d).b);
  }
  return texture2D(tScene, uv).rgb;
}
vec3 toSRGB(vec3 c) { c = max(c, vec3(0.0)); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }

void main() {
  vec2 uv = vUv;
  vec3 col;
  if (uRadial > 0.001) {
    col = vec3(0.0);
    vec2 dir = uv - uRadialC;
    for (int i = 0; i < 10; i++) col += sampleScene(uv - dir * (float(i) / 10.0) * uRadial);
    col /= 10.0;
  } else col = sampleScene(uv);
  col += texture2D(tBloom, uv).rgb * uBloom;
  col = uRetro > 0.5 ? col : aces(col * 1.08);
  col = toSRGB(col);
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(l), col, 1.1);
  col = mix(col, vec3(l), uGray);
  if (uImpact > 0.0) {
    float b = step(0.4, l);
    col = mix(col, mix(vec3(0.05, 0.0, 0.02), vec3(1.0, 0.97, 0.9), b), uImpact);
  }
  col = mix(col, uFlash, uFlashAmt);
  vec2 q = uv - 0.5;
  float v = dot(q, q);
  col *= 1.0 - v * uVignette;
  col = mix(col, vec3(0.55, 0.0, 0.02), uRed * smoothstep(0.12, 0.5, v));
  if (uRetro > 0.5) {
    float d = (bayer(uv * uRes) - 0.5) / 32.0 * uDither;
    col = floor((col + d) * 32.0 + 0.5) / 32.0;
  }
  gl_FragColor = vec4(col, 1.0);
}`;

const BRIGHT_FS = `
precision highp float; uniform sampler2D t; uniform float uTh; varying vec2 vUv;
void main() { vec3 c = texture2D(t, vUv).rgb; float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(uTh, uTh + 0.6, l), 1.0); }`;
const BLUR_FS = `
precision highp float; uniform sampler2D t; uniform vec2 uDir; varying vec2 vUv;
void main() {
  vec3 c = texture2D(t, vUv).rgb * 0.227;
  c += texture2D(t, vUv + uDir * 1.385).rgb * 0.316; c += texture2D(t, vUv - uDir * 1.385).rgb * 0.316;
  c += texture2D(t, vUv + uDir * 3.231).rgb * 0.070; c += texture2D(t, vUv - uDir * 3.231).rgb * 0.070;
  gl_FragColor = vec4(c, 1.0);
}`;

function quadScene(material) {
  const s = new THREE.Scene();
  const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  q.frustumCulled = false;
  s.add(q);
  return s;
}

export class Renderer {
  constructor(container) {
    this.container = container;
    this.gl = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', alpha: false });
    this.gl.setPixelRatio(1);
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.shadowMap.enabled = STYLE.shadows;
    this.gl.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.gl.domElement);
    this.gl.domElement.id = 'view';
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.3, 500);
    this.scene.add(this.camera);
    this.lowHeight = 0;
    this.rt = null;
    this.post = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: null }, tBloom: { value: null }, uBloom: { value: 0 }, uRes: { value: new THREE.Vector2(960, 540) },
        uChroma: { value: 0 }, uFlash: { value: new THREE.Color(1, 1, 1) }, uFlashAmt: { value: 0 }, uImpact: { value: 0 },
        uRadialC: { value: new THREE.Vector2(0.5, 0.5) }, uRadial: { value: 0 }, uVignette: { value: 0.8 },
        uRed: { value: 0 }, uDither: { value: 1 }, uGray: { value: 0 }, uRetro: { value: 0 },
      },
      vertexShader: VS, fragmentShader: POST_FS, depthTest: false, depthWrite: false,
    });
    this.postScene = quadScene(this.post);
    this.bright = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, uTh: { value: 0.75 } }, vertexShader: VS, fragmentShader: BRIGHT_FS, depthTest: false, depthWrite: false });
    this.blur = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, uDir: { value: new THREE.Vector2() } }, vertexShader: VS, fragmentShader: BLUR_FS, depthTest: false, depthWrite: false });
    this.brightScene = quadScene(this.bright);
    this.blurScene = quadScene(this.blur);
    this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.fx = { chroma: 0, flash: 0, flashColor: new THREE.Color(1, 1, 1), impact: 0, radial: 0, radialC: new THREE.Vector2(0.5, 0.5), red: 0, gray: 0 };
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  setRetro(height) { this.lowHeight = height; this.resize(); }
  // the pixel filter of the options (0 = none, else the render height): big sharp pixels and dithering, at once
  setPixels(height) { height = height || 0; if (height === (this.menuLow || 0)) return; this.menuLow = height; this.resize(); }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    if (!w || !h) return;
    const smooth = STYLE.smooth && !this.menuLow;
    const pr = smooth ? Math.min(window.devicePixelRatio || 1, 1.5) : 1;
    this.gl.setPixelRatio(pr);
    this.gl.setSize(w, h, false);
    this.gl.domElement.style.width = w + 'px';
    this.gl.domElement.style.height = h + 'px';
    this.gl.domElement.style.imageRendering = smooth ? 'auto' : 'pixelated';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    let lw, lh;
    const low = this.menuLow || this.lowHeight;
    if (smooth || !low) { lw = Math.round(w * pr); lh = Math.round(h * pr); }
    else { lh = Math.min(low, h); lw = Math.round(lh * (w / h)); }
    if (this.rt) this.rt.dispose();
    const filt = smooth ? THREE.LinearFilter : THREE.NearestFilter;
    this.rt = new THREE.WebGLRenderTarget(lw, lh, { minFilter: filt, magFilter: filt, depthBuffer: true, type: THREE.HalfFloatType, samples: smooth ? 4 : 0 });
    const bw = Math.max(16, Math.round(lw / 4)), bh = Math.max(16, Math.round(lh / 4));
    if (this.bA) { this.bA.dispose(); this.bB.dispose(); }
    const o = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, type: THREE.HalfFloatType };
    this.bA = new THREE.WebGLRenderTarget(bw, bh, o);
    this.bB = new THREE.WebGLRenderTarget(bw, bh, o);
    this.post.uniforms.tScene.value = this.rt.texture;
    this.post.uniforms.tBloom.value = this.bA.texture;
    this.post.uniforms.uRes.value.set(lw, lh);
    this.post.uniforms.uRetro.value = smooth ? 0 : 1;
    this.lowW = lw; this.lowH = lh;
  }

  kick(kind, amount = 1, opts = {}) {
    const f = this.fx;
    // screen effects stay light: the fight has to remain readable (caps on top of every caller)
    if (kind === 'chroma') f.chroma = Math.min(0.006, Math.max(f.chroma, 0.004 * amount));
    if (kind === 'flash') { f.flash = Math.max(f.flash, Math.min(0.6, amount)); f.flashColor.set(opts.color || '#ffffff'); }
    if (kind === 'impact') f.impact = Math.max(f.impact, amount);
    if (kind === 'radial') { f.radial = Math.min(0.035, Math.max(f.radial, 0.03 * amount)); if (opts.c) f.radialC.copy(opts.c); }
  }

  update(dt) {
    const f = this.fx, u = this.post.uniforms;
    f.chroma *= Math.exp(-dt * 10); f.flash *= Math.exp(-dt * 11); f.impact = Math.max(0, f.impact - dt * 14); f.radial *= Math.exp(-dt * 12);
    u.uChroma.value = f.chroma + (STYLE.smooth ? 0.0006 : 0.0012);
    u.uFlash.value.copy(f.flashColor); u.uFlashAmt.value = Math.min(0.45, f.flash * 0.6);
    u.uImpact.value = f.impact > 0.5 ? 1 : 0;
    u.uRadial.value = f.radial; u.uRadialC.value.copy(f.radialC);
    u.uRed.value = f.red; u.uGray.value = f.gray;
    u.uBloom.value = STYLE.bloom ? (STYLE.smooth ? 0.9 : 0.5) : 0;
  }

  render() {
    const g = this.gl;
    if (!this.rt) { this.resize(); if (!this.rt) return; }
    if (this.split) {
      // écran partagé (duel au pistolet) : chaque vue { cam, x, w (fractions de la largeur), before() } dans sa bande
      const rt = this.rt, W = rt.width, H = rt.height;
      rt.scissorTest = true;
      for (const v of this.split) {
        const x = Math.round(v.x * W), w = Math.round(v.w * W);
        rt.viewport.set(x, 0, w, H); rt.scissor.set(x, 0, w, H);
        if (v.before) v.before();
        g.setRenderTarget(rt);
        g.render(this.scene, v.cam);
      }
      rt.scissorTest = false;
      rt.viewport.set(0, 0, W, H); rt.scissor.set(0, 0, W, H);
      if (this.split.after) this.split.after();
    } else {
      g.setRenderTarget(this.rt);
      g.render(this.scene, this.camera);
    }
    if (STYLE.bloom) {
      this.bright.uniforms.t.value = this.rt.texture;
      g.setRenderTarget(this.bA); g.render(this.brightScene, this.postCam);
      for (let i = 0; i < 2; i++) {
        this.blur.uniforms.t.value = this.bA.texture; this.blur.uniforms.uDir.value.set(1 / this.bA.width * (1 + i), 0);
        g.setRenderTarget(this.bB); g.render(this.blurScene, this.postCam);
        this.blur.uniforms.t.value = this.bB.texture; this.blur.uniforms.uDir.value.set(0, 1 / this.bA.height * (1 + i));
        g.setRenderTarget(this.bA); g.render(this.blurScene, this.postCam);
      }
    }
    g.setRenderTarget(null);
    g.render(this.postScene, this.postCam);
  }

  project(v, out = { x: 0, y: 0, vis: true }) {
    const p = v.clone().project(this.camera);
    out.x = (p.x * 0.5 + 0.5) * window.innerWidth;
    out.y = (-p.y * 0.5 + 0.5) * window.innerHeight;
    out.vis = p.z < 1 && p.z > -1;
    return out;
  }
}
