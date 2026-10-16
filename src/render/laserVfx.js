// Le rayon de l'ultime d'Anbuu : l'animation image par image de la vidéo « laser » (œuvre de CMZW, une charge violette, trois plans
// d'impact noir et blanc, le rayon rose et cyan avec ses éclairs, puis son extinction), découpée par tools/art/laser_cut.py en
// assets/fx/laser/ (atlas.png + atlas.json + flash<N>.png). CHAQUE image de la vidéo est dans la chronologie (`tl`, à 30 i/s) : le
// dessin est animé « à la 3 » ou « à la 4 », la planche ne garde qu'un exemplaire de chaque dessin.
//   - la charge (images 8 à 46) : au bout de la main du lanceur, pendant l'entrée en scène ;
//   - les trois plans d'impact noir sur blanc (images 47 à 57) : plein écran, au départ du rayon (canevas de devant, ultimate.js) ;
//   - le rayon (images 58 à 123) : en vrai 3D (`BEAM_3D`) : un corps de plasma rose (energyBeam 'laser') autour d'un cœur blanc, deux hélices
//     rose et cyan qui s'enroulent, des anneaux qui filent, des éclairs, un coup de gonflement à chaque note ; sinon (BEAM_3D = false) un plan
//     derrière les combattants, du bout de la main vers l'avant, révélé jusqu'à `len`.
// Rien n'est dans la simulation : l'image jouée ne dépend que du temps de l'ultime (`frameFor`).
import * as THREE from 'three';
import { energyBeam, updateEnergyBeam, ENERGY } from './fxShaders.js';

const BASE = 'assets/fx/laser/';
const BEAM_3D = true;       // le rayon est un vrai objet 3D (corps de plasma, deux hélices, anneaux, éclairs) ; false : les images de la vidéo
const IMPACT_FRAMES = true; // les plans d'impact noir et blanc plein écran (0,37 s) ; false pour les couper
const FLASH_TICKS = 2;      // 30 i/s de la vidéo = une image tous les 2 pas de simulation (60 Hz)
const FADE_FRAME = 100;     // le rayon commence à s'éteindre à cette image de la vidéo
const FADE_TICKS = 16;      // et finit sur le dernier coup (images 100 à 123 sur ce temps)
const SY = 0.85;            // l'image est un peu aplatie (le rayon est moins épais que dans la vidéo)

const VS = `uniform vec4 uRectPx; varying vec2 vUv; varying vec2 vVid;
void main() {
  vUv = uv;
  vVid = vec2(uRectPx.x + uv.x * uRectPx.z, uRectPx.y + (1.0 - uv.y) * uRectPx.w);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const FS = `varying vec2 vUv; varying vec2 vVid;
uniform sampler2D uMap; uniform vec4 uAtlas; uniform vec2 uFeather; uniform vec2 uOrigin; uniform float uSx; uniform float uLen; uniform float uOp; uniform float uGain; uniform float uOcc; uniform float uHue;
vec3 hueRot(vec3 c, float a) { float k = cos(a), s = sin(a); vec3 w = vec3(0.57735); return c * k + cross(w, c) * s + w * dot(w, c) * (1.0 - k); }
void main() {
  vec2 auv = vec2(mix(uAtlas.x, uAtlas.z, vUv.x), mix(uAtlas.y, uAtlas.w, vUv.y));
  vec3 c = hueRot(texture2D(uMap, auv).rgb, uHue) * uGain;
  vec2 e = min(vUv, 1.0 - vUv);
  float f = smoothstep(0.0, uFeather.x, e.x) * smoothstep(0.0, uFeather.y, e.y);
  float bx = (vVid.x - uOrigin.x) * uSx;                       // metres along the beam from its start
  f *= bx > 0.0 ? smoothstep(uLen, uLen - 1.6, bx) : 1.0;      // the front of the beam travels to uLen
  float m = max(c.r, max(c.g, c.b));
  float a = smoothstep(0.08, 0.5, m) * uOcc;                   // the bright parts cover what is behind them, the glow stays additive
  gl_FragColor = vec4(min(c, vec3(1.6)) * uOp * f, a * uOp * f);
  #include <colorspace_fragment>
}`;


// une hélice : un fil qui s'enroule autour de l'axe +Z du rayon (le fil lui-même est un petit tube, tordu dans le shader)
const HVS = `uniform float uLen; uniform float uTime; uniform float uRho; uniform float uPh; uniform float uTurns; uniform float uW; varying float vZ; varying float vN;
void main() {
  float z = (position.z + 0.5) * uLen;
  float a = z * uTurns - uTime * 7.0 + uPh;
  float rho = uRho * (1.0 + 0.12 * sin(z * 2.3 - uTime * 9.0));
  vec3 p = vec3(cos(a) * rho + position.x * uW, sin(a) * rho + position.y * uW, z);
  vZ = z; vN = position.z + 0.5;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const HFS = `uniform vec3 uCol; uniform float uLen; uniform float uTime; uniform float uOp; varying float vZ; varying float vN;
void main() {
  float pulse = 0.65 + 0.35 * sin(vZ * 5.0 - uTime * 18.0);
  float f = smoothstep(0.0, 0.05, vN) * smoothstep(1.0, 0.9, vN);
  gl_FragColor = vec4(mix(uCol, vec3(1.0), pulse * 0.55) * pulse * uOp * f * 1.5, 1.0);
}`;
function helixMat(col, ph, rho) {
  return new THREE.ShaderMaterial({
    uniforms: { uLen: { value: 1 }, uTime: { value: 0 }, uRho: { value: rho }, uPh: { value: ph }, uTurns: { value: 1.7 }, uW: { value: 0.07 }, uCol: { value: new THREE.Color(col) }, uOp: { value: 1 } },
    vertexShader: HVS, fragmentShader: HFS, transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}

export class LaserVfx {
  constructor(root, looks = []) {
    this.root = root;
    this.meta = null; this.ready = false; this.failed = false;
    this.flashImgs = [];
    let pending = 2;
    const done = () => { if (--pending === 0 && !this.failed && this.meta) this.ready = true; };
    const fail = () => { this.failed = true; this.ready = false; /* il manque un fichier : on garde l'ancien rayon */ };
    const tex = new THREE.TextureLoader().load(BASE + 'atlas.png', done, undefined, fail);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
    this.tex = tex;
    fetch(BASE + 'atlas.json').then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status)))).then((m) => {
      this.meta = m;
      if (IMPACT_FRAMES) m.flash.forEach((f, i) => { const im = new Image(); im.onload = () => { this.flashImgs[i] = im; }; im.src = BASE + f; });
      done();
    }).catch(fail);
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: tex }, uRectPx: { value: new THREE.Vector4(0, 0, 1, 1) }, uAtlas: { value: new THREE.Vector4(0, 0, 1, 1) }, uFeather: { value: new THREE.Vector2(0.05, 0.05) },
        uOrigin: { value: new THREE.Vector2(200, 380) }, uSx: { value: 0.01 }, uLen: { value: 99 }, uOp: { value: 1 }, uGain: { value: 1.1 }, uOcc: { value: 0.8 }, uHue: { value: 0 },
      },
      vertexShader: VS, fragmentShader: FS, transparent: true, depthTest: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    // le rayon en 3D : le plasma (corps, cœur, éclairs, poussières), deux hélices et des anneaux ; le tout part du bout de la main, vers +Z local
    this.b3 = new THREE.Group(); this.b3.visible = false; this.b3.frustumCulled = false;
    this.beams = {}; this.beam = null; this.lookId = null;
    this.baseHue = 0.89; // la teinte du rose de la vidéo (0 à 1)
    const cyl = new THREE.CylinderGeometry(1, 1, 1, 8, 64, true); cyl.rotateX(Math.PI / 2); // l'axe du tube suit Z, de -0,5 à 0,5
    this.helix = [helixMat('#7fe9ff', 0, 1), helixMat('#ff9ae6', Math.PI, 1)].map((m) => { const h = new THREE.Mesh(cyl, m); h.frustumCulled = false; h.renderOrder = 41; this.b3.add(h); return h; });
    const tor = new THREE.TorusGeometry(1, 0.035, 8, 48);
    this.rings = [0, 1, 2, 3, 4].map(() => {
      const r = new THREE.Mesh(tor, new THREE.MeshBasicMaterial({ color: 0xffd6f6, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      r.frustumCulled = false; r.renderOrder = 41; this.b3.add(r); return r;
    });
    root.add(this.b3);
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.mat);
    this.mesh.frustumCulled = false; this.mesh.visible = false; this.mesh.renderOrder = 40;
    root.add(this.mesh);
    for (const U of looks) this._beam(U);
    this.look(looks[0] || null);
  }

  // le plasma aux couleurs d'un ultime (U.colors : [clair, principale, accent]) ; un par perso du match, créés au départ
  _beam(U) {
    const key = U.id;
    if (this.beams[key]) return this.beams[key];
    const col = new THREE.Color(U.colors[1]), hsl = {}; col.getHSL(hsl);
    const mk = (l, sd = 1) => new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s * sd), l).getStyle();
    ENERGY[key] = { c0: mk(0.34), c1: U.colors[1], c2: mk(0.96, 0.4), arc: U.colors[2], mote: U.colors[2], flare: U.colors[1] };
    const b = energyBeam(key); b.visible = false; this.b3.add(b);
    this.beams[key] = { beam: b, hue: hsl.h, cols: U.colors };
    return this.beams[key];
  }

  // le rayon et la charge prennent les couleurs de l'ultime joué
  look(U) {
    if (!U || U.id === this.lookId) return;
    const B = this._beam(U);
    if (this.beam) this.beam.visible = false;
    this.beam = B.beam; this.beam.visible = true; this.lookId = U.id;
    this.helix[0].material.uniforms.uCol.value.set(B.cols[2]);
    this.helix[1].material.uniforms.uCol.value.set(B.cols[1]);
    let dh = B.hue - this.baseHue; dh -= Math.round(dh);
    this.mat.uniforms.uHue.value = dh * Math.PI * 2;
    for (const m of this.rings) m.material.color.set(B.cols[0]);
  }

  // l'image de la vidéo (à virgule) qui correspond au temps `tt` de l'ultime (en pas de simulation, 60 par seconde) :
  // la charge pendant l'entrée en scène (images 8 à 46 sur `intro` pas), les plans d'impact au départ du rayon (1 image de la
  // vidéo tous les 2 pas), le rayon ensuite : tout le reste de la vidéo tient jusqu'au dernier coup (la dernière note), la fin
  // du rayon (images 100 à 123) sur les derniers pas, pour qu'il s'éteigne avec le coup final. À vide (aucune victime) : au rythme
  // de la vidéo, le rayon se rétracte de lui-même (ultimate.js).
  frameFor(tt, U, hit) {
    const R = this.meta.ranges, I = U.intro;
    const [c0, c1] = R.charge, [f0, f1] = R.flash, [b0, b1] = R.beam;
    if (tt < I) return c0 + Math.min(c1 - c0 + 0.999, (tt / I) * (c1 - c0 + 1));
    const nF = (f1 - f0 + 1) * FLASH_TICKS, t1 = I + nF;
    if (tt < t1) return f0 + (tt - I) / FLASH_TICKS;
    if (!hit) return Math.min(b1 + 0.999, b0 + (tt - t1) / FLASH_TICKS);
    const tEnd = I + U.strike + (U.notes - 1) * U.every + 3 + 1; // le tic du dernier coup
    const tFade = tEnd - FADE_TICKS;
    if (tt < tFade) return b0 + Math.min(1, (tt - t1) / (tFade - t1)) * (FADE_FRAME - b0);
    return Math.min(b1 + 0.999, FADE_FRAME + (tt - tFade) / FADE_TICKS * (b1 + 1 - FADE_FRAME));
  }

  entry(f) { const tl = this.meta.tl; return tl[Math.max(0, Math.min(tl.length - 1, Math.floor(f)))]; }

  // l'image de la vidéo `f`, le départ du rayon en (x, y, z) dans le monde, `dir` = ±1 (le côté où il part), `len` : jusqu'où le
  // rayon est révélé (m), `reach` : la longueur que représente la largeur de la vidéo. Retourne [type, n°] de l'image (voir atlas.json).
  show(f, x, y, z, dir, len, reach, op = 1) {
    const M = this.meta, e = this.entry(f);
    if (e[0] !== 1 || (BEAM_3D && f > M.ranges.charge[1] + 1)) { this.mesh.visible = false; return e; } // en 3D, seule la charge reste une image
    const c = M.cells[e[1]], U = this.mat.uniforms, [ox, oy] = M.origin;
    const sx = reach / (M.w - ox), sy = sx * SY;
    const AW = M.atlas[0], AH = M.atlas[1];
    U.uRectPx.value.set(c.rx, c.ry, c.rw, c.rh);
    U.uAtlas.value.set(c.x / AW, 1 - (c.y + c.h) / AH, (c.x + c.w) / AW, 1 - c.y / AH);
    U.uFeather.value.set(Math.min(0.5, 20 / c.rw), Math.min(0.5, 20 / c.rh));
    U.uOrigin.value.set(ox, oy); U.uSx.value = sx; U.uLen.value = len; U.uOp.value = op;
    const m = this.mesh;
    m.scale.set(c.rw * sx * dir, c.rh * sy, 1);
    m.position.set(x + dir * ((c.rx + c.rw / 2) - ox) * sx, y - ((c.ry + c.rh / 2) - oy) * sy, z);
    m.visible = true;
    return e;
  }


  // le rayon 3D : départ (x, y, z), `dir` = ±1, `len` : sa longueur (m), `r` : son rayon (0 = éteint), `kick` : le gonflement du dernier coup (0 à 1)
  show3(x, y, z, dir, len, r, kick, t) {
    const g = this.b3;
    if (!BEAM_3D || !this.beam || r <= 0.01 || len < 0.2) { g.visible = false; return; }
    g.visible = true;
    g.position.set(x, y, z); g.rotation.set(0, dir * Math.PI / 2, 0);
    const rr = r * (1 + kick * 0.45);
    updateEnergyBeam(this.beam, len, rr, t);
    this.helix.forEach((h, i) => {
      const U = h.material.uniforms;
      h.scale.set(1, 1, len); h.position.z = len / 2;
      U.uLen.value = len; U.uTime.value = t; U.uRho.value = rr * (1.05 + i * 0.12); U.uOp.value = 0.85 + kick * 0.5; U.uW.value = 0.05 + rr * 0.07;
    });
    this.rings.forEach((m, i) => {
      const k = (t * 0.9 + i / this.rings.length) % 1;             // 0 au départ du rayon, 1 au bout
      const zz = k * len;
      m.position.z = zz;
      const rs = rr * (1.55 + 0.5 * Math.sin(k * Math.PI));
      m.scale.set(rs, rs, 1);
      m.material.opacity = Math.sin(k * Math.PI) * (0.55 + kick * 0.4) * Math.min(1, len / 3);
    });
  }

  hide() { this.mesh.visible = false; this.b3.visible = false; }

  flashImage(i) { return this.flashImgs[i] || null; }

  // les shaders sont compilés avant le premier combat (le plan est montré une image avec une cellule quelconque)
  warm(on) {
    if (!this.ready) { this.mesh.visible = false; this.b3.visible = false; return; }
    if (on) { this.show(this.meta.ranges.charge[0] + 20, 0, -50, -50, 1, 99, 11); this.show3(0, -50, -50, 1, 6, 0.5, 0, 0); }
    else { this.mesh.visible = false; this.b3.visible = false; }
  }

  dispose() {
    this.root.remove(this.mesh); this.root.remove(this.b3);
    this.b3.traverse((o) => { if (o.isMesh && o.material && o !== this.mesh) { /* les matières du plasma sont libérées avec le groupe */ } });
    this.mat.dispose(); this.mesh.geometry.dispose(); this.tex.dispose();
  }
}
