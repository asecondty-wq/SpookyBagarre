// Les impacts de la vidéo de VFX du créateur (vfx_anbuu.mp4), découpés image par image par tools/art/vfx_cut.py en planches
// (assets/fx/vfx/*.png : l'effet seul sur noir, il s'ajoute à l'image). Chaque animation de la vidéo a son mot, et son rôle ici :
//   « Physical Hit Effect »          phys  : un coup qui compte (le gros éclat jaune, tourné le long de la projection)
//   « Spike Hit Effect »             spike : un coup qui envoie vers le bas (météore) : l'éclat + la pointe bleue vers le sol
//   « Alternate Physical Hit Effects » alt : les petits coups et un peu de variété sur les moyens
//   « Sword Slash Hit Effects »      slash : les coups tranchants (griffes, lames, fouets, crocs) : le papillon et son trait
//   « Kill Spark Effect »            kill  : le coup qui tue (le KO zoomé) : la grosse décharge à deux ailes
//   « Alternate Colors (Players 2-8) » : la couleur selon le joueur qui frappe (rotation de teinte, le blanc des cœurs reste blanc)
// Un plan toujours tourné vers la caméra par animation, additif, une image des planches tous les 1/30 s. Rien n'est dans la
// simulation : c'est de l'affichage seul (les évènements `hit` et `zoom` de fx.js).
import * as THREE from 'three';

// cols : colonnes de la planche ; n : images ; tw, th : le carreau en pixels ; hue : la teinte de départ de l'animation (degrés)
// (les chiffres viennent de assets/fx/vfx/vfx.json, écrit par vfx_cut.py)
const SETS = {
  phys:  { cols: 4, n: 8,  tw: 256, th: 256, hue: 42,  axis: 0.785 },
  spike: { cols: 4, n: 9,  tw: 256, th: 320, hue: 42 },
  alt:   { cols: 4, n: 11, tw: 256, th: 256, hue: 48 },
  slash: { cols: 3, n: 7,  tw: 384, th: 256, hue: 55 },
  kill:  { cols: 2, n: 15, tw: 512, th: 256, hue: 120 },
};
const FPS = 30;
// la teinte de chaque joueur (J1 rouge, J2 bleu, J3 jaune, J4 vert : COLORS de sim/constants.js), en degrés
const SLOT_HUE = [0, 215, 48, 135];
// la teinte de certains effets de coups (le `fx` d'un coup), qui prime sur celle du joueur
const FX_HUE = { zap: 195, fire: 18, water: 205, light: 52, love: 330, poison: 110 };

const VS = `uniform vec2 uSize; uniform float uRot; uniform float uFlip; varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vec2 p = position.xy * uSize; p.x *= uFlip;
  float c = cos(uRot), s = sin(uRot);
  mv.xy += vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  gl_Position = projectionMatrix * mv;
}`;
const FS = `varying vec2 vUv; uniform sampler2D uMap; uniform vec4 uCell; uniform float uHue; uniform float uSat; uniform float uOp;
vec3 hueRot(vec3 c, float a) { const vec3 k = vec3(0.57735026); float ca = cos(a), sa = sin(a); return c * ca + cross(k, c) * sa + k * dot(k, c) * (1.0 - ca); }
void main() {
  vec2 uv = vec2((uCell.x + vUv.x) / uCell.z, 1.0 - (uCell.y + 1.0 - vUv.y) / uCell.w);
  vec3 c = hueRot(texture2D(uMap, uv).rgb, uHue);
  float l = dot(c, vec3(0.3, 0.59, 0.11));
  c = mix(vec3(l), c, uSat);
  gl_FragColor = vec4(max(c, vec3(0.0)) * uOp, 1.0);
  #include <colorspace_fragment>
}`;

const MAX_LIVE = 14;
let GEO = null;

export class VidFx {
  constructor(scene) {
    this.scene = scene;
    GEO = GEO || new THREE.PlaneGeometry(1, 1);
    this.live = [];
    this.free = [];
    this.ready = false;
    this.failed = false;
    this.loaded = 0;
    this.tex = {};
    const loader = new THREE.TextureLoader();
    const names = Object.keys(SETS);
    for (const k of names) {
      this.tex[k] = loader.load(`assets/fx/vfx/${k}.png`, () => { if (++this.loaded === names.length && !this.failed) this.ready = true; }, undefined, () => { this.failed = true; this.ready = false; /* une planche manque : on reste sur les anciens impacts */ });
      this.tex[k].colorSpace = THREE.SRGBColorSpace;
      this.tex[k].anisotropy = 2;
    }
    this.free.push(this._make()); // un plan prêt d'avance : prewarm() compile son shader avant le premier coup
  }

  _make() {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: null }, uCell: { value: new THREE.Vector4(0, 0, 1, 1) }, uHue: { value: 0 }, uSat: { value: 1 }, uOp: { value: 1 },
        uSize: { value: new THREE.Vector2(1, 1) }, uRot: { value: 0 }, uFlip: { value: 1 },
      },
      vertexShader: VS, fragmentShader: FS, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const m = new THREE.Mesh(GEO, mat);
    m.frustumCulled = false;
    m.visible = false;
    m.renderOrder = 56;
    this.scene.add(m);
    return m;
  }

  _mesh() { return this.free.pop() || this._make(); }

  // kind : phys | spike | alt | slash | kill ; size : la largeur du carreau en mètres (l'effet en occupe la moitié à peu près) ;
  // o : rot (radians), hue (degrés : la teinte voulue ; sinon celle de départ), sat, flip (±1), speed (1 = 30 images/s), op
  play(kind, x, y, z, o = {}) {
    const S = SETS[kind];
    if (!S || !this.ready) return null;
    if (this.live.length >= MAX_LIVE) this._kill(this.live.shift());
    const m = this._mesh(), U = m.material.uniforms, size = o.size || 3;
    U.uMap.value = this.tex[kind];
    U.uHue.value = THREE.MathUtils.degToRad((o.hue ?? S.hue) - S.hue);
    U.uSat.value = o.sat ?? 1;
    U.uOp.value = o.op ?? 1;
    U.uSize.value.set(size, size * S.th / S.tw);
    U.uRot.value = o.rot || 0;
    U.uFlip.value = o.flip || 1;
    m.position.set(x, y, z + 0.35);
    m.visible = true;
    const speed = o.speed || 1;
    this.live.push({ m, S, t: 0, life: S.n / (FPS * speed), speed, op: o.op ?? 1 });
    this._cell(this.live[this.live.length - 1], 0);
    return m;
  }

  _cell(e, i) {
    const S = e.S, c = e.m.material.uniforms.uCell.value;
    c.set(i % S.cols, Math.floor(i / S.cols), S.cols, Math.ceil(S.n / S.cols));
  }

  _kill(e) { if (!e) return; e.m.visible = false; this.free.push(e.m); }

  // un coup de fx.js : o = { x, y, z, ang, sz, kb, d, strong, sharp, spike, fx, slot }
  hit(o) {
    if (!this.ready) return false;
    const { x, y, z, ang, sz, strong, sharp, spike, fx, slot } = o;
    const heavy = strong || o.d >= 3.5;
    let kind = 'alt';
    if (sharp) kind = 'slash';
    else if (spike && heavy) kind = 'spike';
    else if (heavy) kind = (!strong && Math.random() < 0.3) ? 'alt' : 'phys';
    const hue = FX_HUE[fx] ?? (slot >= 0 && slot < SLOT_HUE.length ? SLOT_HUE[slot] : undefined);
    const j = (Math.random() - 0.5) * 0.5;
    switch (kind) {
      case 'phys': this.play('phys', x, y, z, { size: 1.5 + sz * 2.6, rot: ang - SETS.phys.axis, hue }); break;
      case 'spike': this.play('spike', x, y, z, { size: 1.6 + sz * 2.6, flip: Math.random() < 0.5 ? 1 : -1, hue }); break;
      case 'slash': this.play('slash', x, y, z, { size: 2.0 + sz * 2.2, rot: ang + j, hue }); break;
      default: this.play('alt', x, y, z, { size: 0.9 + sz * 2.0, rot: ang + j * 3, hue }); break;
    }
    return true;
  }

  // le coup qui tue : la grosse décharge à deux ailes, à la couleur du joueur qui frappe
  kill(x, y, z, slot, hue) {
    return this.play('kill', x, y, z, { size: 8, hue: hue ?? (slot >= 0 && slot < SLOT_HUE.length ? SLOT_HUE[slot] : 0), speed: 0.9 });
  }

  update(dt) {
    let w = 0;
    for (const e of this.live) {
      e.t += dt;
      const k = e.t / e.life;
      if (k >= 1) { this._kill(e); continue; }
      const i = Math.min(e.S.n - 1, Math.floor(e.t * FPS * e.speed));
      this._cell(e, i);
      e.m.material.uniforms.uOp.value = e.op * (k > 0.85 ? (1 - k) / 0.15 : 1);
      this.live[w++] = e;
    }
    this.live.length = w;
  }

  clear() { for (const e of this.live) this._kill(e); this.live.length = 0; }

  // le début du match : le plan de réserve est montré le temps que la carte graphique compile le shader (matchView.prewarm),
  // sinon le premier coup du match gèle l'image un instant
  warm(on) { if (this.free.length) this.free[0].visible = on; }

  dispose() {
    this.clear();
    for (const m of this.free) { this.scene.remove(m); m.material.dispose(); }
    this.free.length = 0;
    for (const k of Object.keys(this.tex)) this.tex[k].dispose();
  }
}
