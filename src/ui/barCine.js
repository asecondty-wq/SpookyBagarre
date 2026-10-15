// Les petites scènes du bar (« ALLER AU BAR », src/ui/bar.js : maintenir A près de Nymano, BIDO, J'san ou Skanky).
// Une vingtaine de secondes chacune, en plans de cinéma : un décor fait en code (aucun fichier en plus : les persos sont
// leurs vrais modèles, les accessoires ceux du combat), des mouvements de caméra, des bandes noires, du grain, des
// fondus, des sous-titres. Chargé seulement quand une scène commence (import dynamique). Échap / Start : passer.
//   const c = new Cine(bar, 'nymano'); chaque image : c.update(dt, skip) ; c.done quand c'est fini
import * as THREE from 'three';
import { mat, basic, G, mesh, glowTex } from '../render/materials.js';
import { fitProp, hasProp } from '../render/propModels.js';
import { petObj, updatePet } from '../render/friendsView.js';
import { ENTITY_MODELS } from '../render/entityView.js';
import { burst } from './juice.js';
import { Actor } from './bar.js';

const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const sm = (k) => k * k * (3 - 2 * k);
const clamp01 = (k) => Math.max(0, Math.min(1, k));
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

// un écran (ordinateur, réveil, carte, affiche) : un canevas dessiné par `draw(g, w, h, t)` (à chaque image si `live`)
function screen(w, h2, pw, ph, draw, live = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h2;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph, 12, 8), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  draw(g, w, h2, 0);
  tex.needsUpdate = true;
  m.userData.redraw = live ? (t) => { draw(g, w, h2, t); tex.needsUpdate = true; } : null;
  m.userData.tex = tex;
  return m;
}
// un sprite qui flotte (cœur, Z...) : une lettre ou un symbole dessiné une fois
function glyphTex(ch, color, font = 'bold 96px Arial') {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color;
  g.shadowColor = color; g.shadowBlur = 16; g.fillText(ch, 64, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function glow(color, size, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(size);
  return s;
}
// un grain de film (un petit carré de bruit, déplacé à chaque image)
let grainURL = null;
function grain() {
  if (grainURL) return grainURL;
  const c = document.createElement('canvas'); c.width = c.height = 96;
  const g = c.getContext('2d'), d = g.createImageData(96, 96);
  for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 60; }
  g.putImageData(d, 0, 0);
  return (grainURL = c.toDataURL());
}

export class Cine {
  constructor(bar, id) {
    this.bar = bar; this.app = bar.app;
    const R = this.R = this.app.renderer;
    this.group = new THREE.Group();
    R.scene.add(this.group);
    this.saved = { fog: R.scene.fog, bg: R.scene.background, gray: R.fx.gray, vig: R.post.uniforms.uVignette.value };
    bar.root.visible = false;
    bar.ui.el.style.display = 'none';
    this.actors = []; this.shared = []; this.pets = []; this.screens = [];
    this.t = 0; this.fade = 1; this.fadeTo = 0; this.fadeK = 1.4; this.shakeA = 0;
    this.dom = h('div', 'cine', `<i class="cn-bar t"></i><i class="cn-bar b"></i><i class="cn-grain"></i>
      <div class="px cn-px"><div class="cn-title"></div><div class="cn-cap"></div><div class="cn-skip">Échap / Start : passer</div></div><i class="cn-fade"></i>`);
    this.dom.querySelector('.cn-grain').style.backgroundImage = `url(${grain()})`;
    this.app.ui.appendChild(this.dom);
    setTimeout(() => this.dom.classList.add('on'), 30); // (les bandes noires glissent en place)
    this.px = this.dom.querySelector('.cn-px');
    this.capEl = this.dom.querySelector('.cn-cap'); this.titleEl = this.dom.querySelector('.cn-title');
    this.cap = null;
    const S = SCENES[id](this);
    this.S = S;
    R.scene.fog = new THREE.Fog(...S.fog);
    R.scene.background = new THREE.Color(S.bg);
    R.fx.gray = S.gray || 0;
    R.post.uniforms.uVignette.value = S.vignette ?? 1.25;
    R.fx.wave = 0;
    this.beats = [...S.beats].sort((a, b) => a[0] - b[0]);
    this.app.audio.duck([0.3, 1]);
    this.cam = new THREE.PerspectiveCamera(40, R.camera.aspect, 0.05, 80);
    this.phase = 'play';
  }

  // ---- ce que les scènes utilisent ----------------------------------------------------------------------------------
  actor(char, x, z, yaw, y = 0) { const a = new Actor(this.group, char, 6, x, z, yaw); a.y = y; this.actors.push(a); return a; }
  // un accessoire du combat (son modèle 3D), à la taille `size` (son plus grand côté)
  prop(name, size, pos, rot = [0, 0, 0], shape = [1, 1, 1]) {
    const prim = mesh(G.box(size * shape[0], size * shape[1], size * shape[2]), mat('#8a8a90'));
    const p = hasProp(name) ? fitProp(name, prim) : prim;
    p.position.set(...pos); p.rotation.set(...rot);
    this.group.add(p);
    if (p !== prim) this.shared.push(p);
    return p;
  }
  pet(x, z, a) { const o = petObj(ENTITY_MODELS, 'shiba'); o.scale.setScalar(1.6); o.position.set(x, 0, z); this.group.add(o); const P = { o, e: { cmd: '', ct: 0, a } }; this.pets.push(P); return P; }
  screen(...args) { const m = screen(...args); this.screens.push(m); this.group.add(m); return m; }
  add(...o) { this.group.add(...o); return o[0]; }
  sfx(n, g = 0.8) { this.app.audio.sfx(n, 0, g); }
  // un sous-titre : style 'sub' (blanc), 'mono' (terminal, tapé), 'serif' (romance), 'heist' (film de casse), 'comic'
  say(text, style = 'sub', dur = 3.5) {
    this.cap = { text, style, t0: this.t, dur };
    this.capEl.dataset.s = style;
    this.capEl.classList.add('on');
    this.capEl.textContent = style === 'mono' ? '' : text;
  }
  title(main, sub, style = 'sub', dur = 3.2) {
    const T = this.titleEl;
    T.dataset.s = style;
    T.innerHTML = `<b>${main}</b>${sub ? `<small>${sub}</small>` : ''}`;
    T.classList.remove('on'); void T.offsetWidth; T.classList.add('on');
    this.titleT = this.t + dur;
  }
  slam(word, x, y, color, size = 110) { burst(this.px, x, y, word, { color, size, life: 1100 }); }
  shake(a) { this.shakeA = Math.max(this.shakeA, a); }

  // ---- chaque image -----------------------------------------------------------------------------------------------
  update(dt, skip) {
    if (this.phase === 'gone') return;
    this.t += dt;
    const t = this.t, S = this.S;
    if (this.phase === 'play' && (skip || t >= S.dur)) { this.phase = 'out'; this.fadeTo = 1; this.fadeK = skip ? 6 : 2.2; this.outT = 0; }
    while (this.beats.length && t >= this.beats[0][0]) this.beats.shift()[1]();
    // le plan en cours : la caméra glisse de p0 à p1 (et regarde de l0 à l1), un cut au plan suivant
    const shots = S.shots;
    let i = 0;
    while (i + 1 < shots.length && shots[i + 1].at <= t) i++;
    const sh = shots[i], end = i + 1 < shots.length ? shots[i + 1].at : S.dur;
    const k = sh.ease === false ? clamp01((t - sh.at) / (end - sh.at)) : sm(clamp01((t - sh.at) / (end - sh.at)));
    const cam = this.cam;
    cam.position.lerpVectors(sh.p0, sh.p1, k);
    const look = this._l || (this._l = new THREE.Vector3());
    look.lerpVectors(sh.l0, sh.l1, k);
    this.shakeA *= Math.exp(-dt * 6);
    const sa = this.shakeA + (sh.hand || 0); // la caméra à l'épaule
    if (sa > 0.001) { cam.position.x += Math.sin(t * 13.1) * sa * 0.5 + Math.sin(t * 2.3) * sa; cam.position.y += Math.cos(t * 11.7) * sa * 0.5 + Math.sin(t * 1.7) * sa * 0.6; }
    cam.lookAt(look);
    if (sh.roll) cam.rotateZ(sh.roll * (1 - k * 0.3));
    cam.fov = (sh.fov0 ?? 40) + ((sh.fov1 ?? sh.fov0 ?? 40) - (sh.fov0 ?? 40)) * k;
    cam.aspect = this.R.camera.aspect;
    cam.updateProjectionMatrix();
    const rc = this.R.camera;
    rc.position.copy(cam.position); rc.quaternion.copy(cam.quaternion); rc.fov = cam.fov; rc.updateProjectionMatrix();
    S.update(t, dt);
    for (const a of this.actors) a.update(dt, t);
    for (const a of this.actors) { a.view.shadow.visible = !a.y; a.view.marker.visible = false; }
    const now = performance.now() / 1000;
    for (const P of this.pets) { if ((P.e.cmd || '') !== P.e.prev) { P.e.prev = P.e.cmd; P.e.ct = 0; } else P.e.ct++; updatePet(P.o, P.e, dt, now); }
    for (const m of this.screens) if (m.userData.redraw) m.userData.redraw(t);
    // le sous-titre (tapé lettre par lettre en terminal), le titre, le grain, le fondu
    const C = this.cap;
    if (C) {
      const e = t - C.t0;
      if (C.style === 'mono') this.capEl.textContent = C.text.slice(0, Math.floor(e * 26)) + (Math.floor(t * 2.5) % 2 ? '▌' : ' ');
      if (e > C.dur) { this.capEl.classList.remove('on'); this.cap = null; }
    }
    if (this.titleT && t > this.titleT) { this.titleEl.classList.remove('on'); this.titleT = 0; }
    this.dom.querySelector('.cn-grain').style.backgroundPosition = `${(Math.random() * 96) | 0}px ${(Math.random() * 96) | 0}px`;
    this.fade += (this.fadeTo - this.fade) * (1 - Math.exp(-dt * this.fadeK * 3));
    if (this.phase === 'play' && S.fadeOut && t > S.dur - S.fadeOut) this.fadeTo = 1;
    this.dom.querySelector('.cn-fade').style.opacity = this.fade.toFixed(3);
    if (this.phase === 'out' && (this.outT += dt) > (this.fadeK > 3 ? 0.3 : 0.7)) this.finish();
  }

  // fin : on rend le bar (le fondu au noir repart en arrière, par-dessus le bar)
  finish() {
    this.phase = 'gone';
    this.dispose(true);
    const f = this.dom.querySelector('.cn-fade');
    this.dom.classList.remove('on');
    f.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 650, easing: 'ease-out' }).onfinish = () => this.dom.remove();
    setTimeout(() => this.dom.remove(), 900); // (même si l'animation ne va pas au bout : onglet caché)
    f.style.opacity = '0';
    this.done = true;
  }

  dispose(keepDom = false) {
    const R = this.R, bar = this.bar;
    if (this.S && this.S.dispose) this.S.dispose();
    for (const a of this.actors) a.dispose();
    for (const o of [...this.shared, ...this.pets.map((P) => P.o)]) o.parent && o.parent.remove(o);
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of ms) { if (m.map && m.map !== glowTex()) m.map.dispose(); m.dispose(); }
    });
    R.scene.remove(this.group);
    R.scene.fog = this.saved.fog; R.scene.background = this.saved.bg;
    R.fx.gray = this.saved.gray || 0; R.post.uniforms.uVignette.value = this.saved.vig;
    bar.root.visible = true;
    bar.ui.el.style.display = '';
    this.app.audio.duck(null);
    if (!keepDom) this.dom.remove();
  }
}

const shot = (at, p0, l0, p1, l1, o = {}) => ({ at, p0: V(p0), l0: V(l0), p1: V(p1 || p0), l1: V(l1 || l0), ...o });

// ---- les scènes -----------------------------------------------------------------------------------------------------
const SCENES = {
  // NYMANO : « souvenirs.txt ». La nuit, la pluie, un vieil ordinateur ; il relit une conversation avec lui-même, en 2009
  nymano(C) {
    const room = new THREE.Group();
    room.add(new THREE.HemisphereLight('#3a4a6a', '#05060a', 0.35));
    room.add(mesh(new THREE.PlaneGeometry(8, 8), mat('#1a1614'), [0, 0, 0], [-Math.PI / 2, 0, 0]));
    room.add(mesh(new THREE.PlaneGeometry(8, 4), mat('#232838'), [0, 2, -2.4]));
    room.add(mesh(new THREE.PlaneGeometry(6, 4), mat('#1c2030'), [-2.6, 2, 0.4], [0, Math.PI / 2, 0]));
    // le bureau, la vieille tour beige, le clavier jauni, une tasse, le SP-404
    const beige = mat('#8e8468', { roughness: 0.75 });
    room.add(mesh(G.box(1.7, 0.06, 0.75), mat('#3a2a1e'), [0, 0.75, -1.65]));
    for (const x of [-0.78, 0.78]) room.add(mesh(G.box(0.06, 0.75, 0.68), mat('#2a1e16'), [x, 0.375, -1.65]));
    room.add(mesh(G.box(0.62, 0.5, 0.52), beige, [0, 1.04, -1.78]));
    room.add(mesh(G.box(0.4, 0.06, 0.32), beige, [0, 0.8, -1.8]));
    room.add(mesh(G.box(0.56, 0.03, 0.18), mat('#d8cba4'), [0, 0.795, -1.38], [0.08, 0, 0]));
    room.add(mesh(G.cyl(0.05, 0.045, 0.1, 10), mat('#6a2a2a'), [0.48, 0.83, -1.45]));
    C.add(room);
    C.prop('sampler', 0.26, [-0.52, 0.84, -1.55], [0, 0.4, 0]);
    // l'écran : une conversation archivée de 2009, et ses réponses d'aujourd'hui, tapées
    const MSG = [
      [6.3, 'nymano_2009', 'dans 15 ans on sera trop forts au skate'],
      [8.0, 'nymano_2009', 'et on se lâche jamais. promis ?'],
      [9.9, 'nymano', 'promis.'],
      [11.3, 'nymano', 'j\'ai encore la cassette de l\'été 2009.'],
      [13.0, 'nymano', 'je l\'écoute quand il pleut. donc tout le temps.'],
      [19.4, 'nymano', 't\'inquiète pas pour nous.'],
      [20.8, 'nymano', 'on est au bar. ils sont tous là.'],
      [22.2, '*', 'nymano_2009 s\'est déconnecté (2009)'],
    ];
    const OFF = 23.6;
    const crt = C.screen(512, 384, 0.5, 0.375, (g, w, hh, t) => {
      g.fillStyle = '#020604'; g.fillRect(0, 0, w, hh);
      if (t > OFF + 0.7) return;
      g.save();
      if (t > OFF) { // l'extinction d'un vieux tube : l'image s'écrase en une ligne, puis en un point
        const e = t - OFF, sy = Math.max(0.006, 1 - e / 0.22), sx = e < 0.22 ? 1 : Math.max(0.01, 1 - (e - 0.22) / 0.25);
        g.translate(w / 2, hh / 2); g.scale(sx, sy); g.translate(-w / 2, -hh / 2);
        if (e > 0.22) { g.fillStyle = '#e8fff0'; g.fillRect(0, hh / 2 - 6, w, 12); g.restore(); return; }
      }
      const grd = g.createRadialGradient(w / 2, hh / 2, 40, w / 2, hh / 2, w * 0.7);
      grd.addColorStop(0, '#0f2a1c'); grd.addColorStop(1, '#030a06');
      g.fillStyle = grd; g.fillRect(0, 0, w, hh);
      g.font = 'bold 17px "Courier New", monospace'; g.textBaseline = 'top';
      g.fillStyle = '#5adc8c'; g.shadowColor = '#5adc8c'; g.shadowBlur = 8;
      g.fillText('MESSAGERIE 98 — conversation archivée', 22, 16);
      g.fillRect(22, 40, w - 44, 2);
      let y = 56;
      for (const [at, who, txt] of MSG) {
        if (t < at) break;
        const n = who === 'nymano' ? Math.floor((t - at) * 14) : txt.length; // ses réponses d'aujourd'hui sont tapées
        const past = who === 'nymano_2009', sys = who === '*';
        g.fillStyle = sys ? '#9aa8a0' : past ? '#3e9a64' : '#bfffd6';
        g.shadowColor = g.fillStyle;
        const line = (sys ? '' : `<${who}> `) + txt.slice(0, n);
        // retour à la ligne
        const words = line.split(' '); let cur = '';
        for (const wd of words) { if (g.measureText(cur + wd).width > w - 50) { g.fillText(cur, 24, y); y += 22; cur = ''; } cur += wd + ' '; }
        g.fillText(cur, 24, y);
        if (n < txt.length && Math.floor(t * 3) % 2) g.fillRect(24 + g.measureText(cur).width, y, 10, 17);
        y += 30;
      }
      g.shadowBlur = 0;
      for (let s = 0; s < hh; s += 3) { g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(0, s, w, 1); } // les lignes du tube
      g.fillStyle = `rgba(160,255,200,${0.025 + Math.random() * 0.025})`; g.fillRect(0, 0, w, hh); // il scintille
      g.restore();
    });
    // un écran bombé
    const pos = crt.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i); pos.setZ(i, -(x * x * 0.4 + y * y * 0.5)); }
    crt.position.set(0, 1.06, -1.47);
    // le cadre du tube (il cache les bords de l'écran bombé)
    for (const [x, y, w2, h2] of [[0, 1.27, 0.6, 0.07], [0, 0.85, 0.6, 0.07], [-0.28, 1.06, 0.06, 0.48], [0.28, 1.06, 0.06, 0.48]]) room.add(mesh(G.box(w2, h2, 0.05), mat('#6e6652'), [x, y, -1.5]));
    const crtLight = C.add(new THREE.PointLight('#7fe8b8', 3.5, 4, 1.7));
    crtLight.position.set(0, 1.3, -0.85);
    const halo = C.add(glow('#7fe8b8', 0.8, 0.12)); halo.position.set(0, 1.06, -1.4);
    // la fenêtre : la ville au loin, la pluie qui coule
    for (const [x, y, w2, h2] of [[-1.25, 1.75, 1.3, 0.06], [-1.25, 1.05, 1.3, 0.06], [-1.9, 1.4, 0.06, 0.76], [-0.6, 1.4, 0.06, 0.76], [-1.25, 1.4, 0.04, 0.76]]) C.add(mesh(G.box(w2, h2, 0.08), mat('#151515'), [x, y, -2.36]));
    C.screen(256, 160, 1.26, 0.7, (g, w, hh, t) => {
      g.fillStyle = '#0a1426'; g.fillRect(0, 0, w, hh);
      for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,${200 + (i % 3) * 20},120,${0.25 + (i % 4) * 0.12})`; g.fillRect((i * 53) % w, 100 + ((i * 37) % 50), 2, 2); }
      g.strokeStyle = 'rgba(170,200,255,0.35)'; g.lineWidth = 1;
      for (let i = 0; i < 70; i++) { const x = (i * 29.7) % w, y = ((t * (90 + (i % 5) * 30) + i * 41) % (hh + 30)) - 15; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 1, y + 10 + (i % 4) * 3); g.stroke(); }
    }).position.set(-1.25, 1.4, -2.37);
    const moon = C.add(new THREE.DirectionalLight('#6a80b8', 0.35)); moon.position.set(-2, 3, -4);
    const N = C.actor('nymano', 0, -0.62, Math.PI);
    return {
      dur: 28, fog: ['#04050a', 4, 14], bg: '#04050a', gray: 0.5, vignette: 1.5, fadeOut: 2.4,
      shots: [
        shot(0, [1.7, 1.75, 1.9], [0, 1.1, -1.5], [0.9, 1.55, 0.55], [0, 1.05, -1.6], { fov0: 42, hand: 0.004 }),
        shot(6, [0.12, 1.1, -0.5], [0, 1.05, -1.5], [0.03, 1.07, -0.78], [0, 1.05, -1.5], { fov0: 40, fov1: 36 }),
        shot(14.6, [0.95, 1.5, -1.3], [0, 1.45, -0.6], [0.8, 1.52, -1.2], [0, 1.5, -0.6], { fov0: 44, fov1: 40, hand: 0.003 }),
        shot(19.1, [0.45, 1.3, -0.45], [0, 1.05, -1.5], [0.12, 1.18, -0.78], [0, 1.05, -1.5], { fov0: 40, fov1: 36 }),
        shot(24.3, [0.12, 1.18, -0.78], [0, 1.05, -1.5], [0.1, 1.2, -0.7], [0, 1.05, -1.5], { fov0: 36 }),
      ],
      beats: [
        [0.4, () => C.title('NYMANO', 'souvenirs.txt', 'mono', 4)],
        [6.3, () => C.sfx('blip', 0.4)], [8.0, () => C.sfx('blip', 0.4)],
        [9.9, () => C.sfx('typing', 0.5)], [11.3, () => C.sfx('typing', 0.5)], [13.0, () => C.sfx('typing', 0.5)],
        [15.2, () => { N.emote('sob', false, 4); C.sfx('sob', 0.6); }],
        [15.6, () => C.say('il pleut. comme d\'habitude.', 'mono', 3)],
        [19.4, () => C.sfx('typing', 0.5)], [20.8, () => C.sfx('typing', 0.5)], [22.2, () => C.sfx('blip', 0.3)],
        [OFF, () => C.sfx('zapS', 0.5)],
        [25, () => C.say('certaines boucles ne s\'arrêtent jamais.', 'mono', 3)],
      ],
      update(t) {
        const on = t < OFF ? 1 : Math.max(0, 1 - (t - OFF) * 3);
        crtLight.intensity = (3.5 + Math.sin(t * 50) * 0.25) * on;
        halo.material.opacity = 0.12 * on;
      },
      after: ['…pardon. Une poussière dans l\'œil.', 'Ça va, ça va. C\'est la pluie.'],
    };
  },

  // BIDO : « Une histoire d'amour ». Un roman-photo à la salle de sport : lui, et l'amour de sa vie (en fonte)
  bido(C) {
    C.add(new THREE.HemisphereLight('#ff9ad0', '#2a0818', 0.7));
    C.add(mesh(new THREE.PlaneGeometry(12, 12), mat('#141014'), [0, 0, 0], [-Math.PI / 2, 0, 0]));
    for (let i = -4; i <= 4; i++) C.add(mesh(G.box(0.02, 0.005, 12), basic('#2a1a26'), [i * 1.2, 0.003, 0]));
    C.add(mesh(new THREE.PlaneGeometry(12, 5), mat('#2a1824', { metalness: 0.6, roughness: 0.25 }), [0, 2.5, -3]));
    // l'enseigne au néon
    C.screen(512, 128, 3.2, 0.8, (g, w, hh) => {
      g.clearRect(0, 0, w, hh); g.font = 'bold 84px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = '#ff4fa0'; g.shadowBlur = 26; g.fillStyle = '#ffd0ea'; g.fillText('♥ GYM ♥', w / 2, hh / 2 + 4);
    }, false).position.set(0, 2.55, -2.95);
    C.screens[C.screens.length - 1].material.transparent = true;
    // le banc, la barre, le piédestal de l'haltère, la kettlebell
    C.add(mesh(G.box(0.5, 0.12, 1.4), mat('#5a1030'), [0, 0.5, -1.3]), mesh(G.box(0.3, 0.45, 0.3), mat('#202020'), [0, 0.22, -1.3]));
    for (const x of [-0.55, 0.55]) C.add(mesh(G.box(0.06, 1.2, 0.06), mat('#303030', { metalness: 0.7 }), [x, 0.6, -1.9]));
    C.prop('barbell', 1.7, [0, 1.15, -1.9], [0, 0, 0], [1, 0.2, 0.2]);
    C.add(mesh(G.cyl(0.32, 0.38, 0.9, 16), mat('#7a4a66', { roughness: 0.35 }), [1.6, 0.45, -0.6]));
    const db = C.prop('dumbbell', 0.45, [1.6, 0.99, -0.6], [0, 0, 0], [1, 0.4, 0.4]);
    const kb = C.prop('kettlebell', 0.38, [-1.6, 0.19, -0.3]);
    const kl = C.add(new THREE.PointLight('#ff8ac8', 4, 2.2, 1.6)); kl.position.set(-1.4, 0.9, 0.3);
    const spot = C.add(new THREE.SpotLight('#ffb0dc', 30, 8, 0.3, 0.6, 1.5)); spot.position.set(1.6, 4, 0.2); spot.target = db;
    const spot2 = C.add(new THREE.SpotLight('#ff7ab8', 26, 9, 0.5, 0.7, 1.5)); spot2.position.set(0, 4.5, 2.5);
    C.add(spot2.target); spot2.target.position.set(0, 0.8, 0.6);
    // des cœurs qui montent et des pétales qui tombent
    const heartT = glyphTex('♥', '#ff5fa8');
    const hearts = [];
    for (let i = 0; i < 26; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartT, transparent: true, depthWrite: false, opacity: 0.85 })); s.scale.setScalar(0.18 + (i % 4) * 0.06); C.add(s); hearts.push({ s, x: (i * 0.61) % 5 - 2.5, z: (i * 0.37) % 3 - 1.8, sp: 0.25 + (i % 5) * 0.08, ph: i }); }
    const B = C.actor('bido', 0, 0.75, 0);
    let held = false;
    return {
      dur: 25, fog: ['#1a0612', 6, 18], bg: '#1a0612', gray: 0, vignette: 1.35, fadeOut: 1.6,
      shots: [
        shot(0, [0, 2.6, 6], [0, 1.2, -0.5], [0, 1.9, 4.2], [0, 1.2, -0.4], { fov0: 40 }),
        shot(5, [2.4, 1.3, 0.4], [1.6, 1.05, -0.6], [2.1, 1.2, 0.1], [1.6, 1.05, -0.6], { fov0: 34, fov1: 28 }),
        shot(10, [1.1, 1.55, 3.3], [0, 1.3, 0.75], [0.8, 1.55, 2.9], [0, 1.35, 0.75], { fov0: 40 }),
        shot(15, [-1.0, 0.45, 0.9], [-1.6, 0.25, -0.3], [-1.3, 0.5, 0.6], [-1.6, 0.25, -0.3], { fov0: 38, fov1: 32 }),
        shot(19.5, [1.8, 0.6, 2.9], [0, 1.5, 0.75], [-1.6, 0.7, 2.7], [0, 1.6, 0.75], { fov0: 42, ease: true }),
      ],
      beats: [
        [0.5, () => C.title('BIDO', 'une histoire d\'amour', 'serif', 4)],
        [1.6, () => B.emote('greet_01', false, 3)],
        [5.4, () => { C.say('« Elle, c\'était Haltère. Douze kilos de tendresse. »', 'serif', 4.2); C.sfx('heart', 0.5); }],
        [10.3, () => { B.emote('heart_pose', false, 4); C.say('« Elle ne m\'a jamais laissé tomber. Enfin… une fois. Sur le pied. »', 'serif', 4.4); C.sfx('kiss', 0.5); }],
        [15.3, () => C.say('« Kettlebell… Non. Ce n\'est pas ce que tu crois. »', 'serif', 4)],
        [19.6, () => { held = true; B.emote('cheer', false, 5); C.sfx('clank', 0.6); C.say('« Samedi, on se marie. Témoin : le banc de musculation. »', 'serif', 4.6); }],
        [21, () => C.slam('JE T\'AIME !', 320, 150, '#ff5fa8', 120)],
      ],
      update(t, dt) {
        db.rotation.y = held ? 0 : t * 0.8;
        if (held) { B.hand(db.position); db.rotation.set(0, B.yaw + Math.PI / 2, 0); } // il la soulève, enfin
        for (const H of hearts) { const y = ((t * H.sp + H.ph * 0.37) % 4); H.s.position.set(H.x + Math.sin(t + H.ph) * 0.25, y, H.z); H.s.material.opacity = Math.sin(Math.PI * y / 4) * 0.85; }
        kb.rotation.y = Math.sin(t * 0.7) * 0.2;
      },
      after: ['Pardon, j\'étais… ailleurs. Avec elle.', 'Tu crois qu\'elle m\'aime aussi ?'],
    };
  },

  // J'SAN : « 3 h 47 ». Il dort. Il rêve d'une partie. Il se réveille d'un coup : GANK MID
  jsan(C) {
    C.add(new THREE.HemisphereLight('#4a5a9a', '#08080e', 0.45));
    const moon = C.add(new THREE.DirectionalLight('#8aa0ff', 1.1)); moon.position.set(-3, 4, 2.5);
    C.add(mesh(new THREE.PlaneGeometry(10, 10), mat('#2a2230'), [0, 0, 0], [-Math.PI / 2, 0, 0]));
    C.add(mesh(new THREE.PlaneGeometry(10, 4), mat('#2c3048'), [0, 2, -1.6]));
    // le lit (la tête au fond), la couette
    C.add(mesh(G.box(1.15, 0.35, 2.15), mat('#3a2a20'), [0, 0.18, 0]), mesh(G.box(1.05, 0.18, 2.0), mat('#d8d4e8'), [0, 0.44, 0]));
    C.add(mesh(G.box(0.7, 0.12, 0.38), mat('#f0eef8'), [0, 0.58, -0.72]), mesh(G.box(1.15, 0.8, 0.08), mat('#3a2a20'), [0, 0.55, -1.1]));
    const quilt = C.add(mesh(G.box(1.12, 0.12, 1.25), mat('#3a58a8'), [0, 0.8, 0.38]));
    // la table de nuit : le téléphone, le réveil
    C.add(mesh(G.box(0.5, 0.5, 0.4), mat('#4a3626'), [0.9, 0.25, -0.75]));
    const phone = C.add(mesh(G.box(0.08, 0.012, 0.16), basic('#101018'), [0.85, 0.51, -0.7]));
    let hour = '03:47';
    const clock = C.screen(128, 64, 0.22, 0.11, (g, w, hh) => { g.fillStyle = '#100404'; g.fillRect(0, 0, w, hh); g.font = 'bold 44px "Courier New", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ff3a2a'; g.shadowColor = '#ff3a2a'; g.shadowBlur = 10; g.fillText(hour, w / 2, hh / 2 + 2); });
    clock.position.set(1.0, 0.58, -0.6); clock.rotation.y = -0.5;
    C.add(mesh(G.box(0.26, 0.14, 0.1), mat('#202020'), [1.02, 0.57, -0.66], [0, -0.5, 0]));
    const clockGlow = C.add(new THREE.PointLight('#ff3a2a', 1.2, 1.6, 2)); clockGlow.position.set(1.0, 0.65, -0.45);
    // la fenêtre, la lune ; l'affiche
    C.add(mesh(new THREE.PlaneGeometry(1.0, 1.2), basic('#1a2a5a'), [-1.6, 1.6, -1.58]));
    const moonS = C.add(glow('#dfe6ff', 0.7, 0.9)); moonS.position.set(-1.45, 1.85, -1.5);
    C.screen(256, 320, 0.6, 0.75, (g, w, hh) => { g.fillStyle = '#16101c'; g.fillRect(0, 0, w, hh); g.fillStyle = '#c8a050'; g.font = 'bold 54px Impact, sans-serif'; g.textAlign = 'center'; g.fillText('GANK', w / 2, 120); g.fillText('MID', w / 2, 180); g.strokeStyle = '#c8a050'; g.lineWidth = 6; g.beginPath(); g.moveTo(40, 280); g.lineTo(216, 230); g.stroke(); }, false).position.set(1.5, 1.7, -1.58);
    const phoneLight = C.add(new THREE.PointLight('#7ab0ff', 0, 2.5, 1.6));
    const reyji = C.pet(-0.95, 1.1, 2.2);
    // J'san couché sur le dos (pivoté autour des pieds, au bout du lit), il se redressera d'un coup, comme un vampire
    const J = C.actor('jsan', 0, 0.75, 0, 0.72);
    J.tilt = [-Math.PI / 2, 0];
    let rise = -1; // l'instant où il se lève
    const zT = glyphTex('Z', '#c8d4ff', 'bold 90px Georgia');
    const zs = [];
    for (let i = 0; i < 4; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: zT, transparent: true, depthWrite: false })); C.add(s); zs.push(s); }
    // le rêve : une petite carte d'une partie (une bulle par-dessus l'image)
    const dream = h('canvas', 'cn-dream'); dream.width = 220; dream.height = 150;
    C.px.appendChild(dream);
    const dg = dream.getContext('2d');
    return {
      dur: 23, fog: ['#07070e', 5, 16], bg: '#07070e', gray: 0.15, vignette: 1.45, fadeOut: 1.6,
      shots: [
        shot(0, [2.6, 2.3, 2.9], [0, 0.6, -0.2], [1.9, 2.0, 2.0], [0, 0.6, -0.3], { fov0: 40 }),
        shot(6, [1.05, 1.25, -1.15], [0, 0.72, -0.62], [0.85, 1.12, -1.05], [0, 0.72, -0.62], { fov0: 38, fov1: 33 }),
        shot(11, [2.0, 1.3, 3.4], [0, 1.65, 0.75], [1.5, 1.45, 2.8], [0, 1.75, 0.75], { fov0: 50, fov1: 42 }),
        shot(13, [-1.1, 1.85, 3.0], [0, 1.8, 0.75], [-0.8, 1.9, 2.6], [0, 1.85, 0.75], { fov0: 40 }),
        shot(17.3, [2.8, 1.8, 2.8], [0, 1.3, 0], [2.6, 1.9, 2.6], [0, 1.3, 0], { fov0: 40, ease: false }),
      ],
      beats: [
        [0.5, () => C.title('J\'SAN', '3 h 47', 'comic', 3.6)],
        [6.2, () => { dream.classList.add('on'); C.say('… gank mid …', 'sub', 1.8); }],
        [8.2, () => C.say('… il est où le jungler …', 'sub', 1.6)],
        [9.9, () => C.say('… flash … FLASH …', 'sub', 1.2)],
        [11, () => { rise = 11; dream.classList.remove('on'); C.shake(0.08); C.sfx('thud', 0.8); C.sfx('error', 0.6); C.slam('GANK MID !!!', 320, 130, '#ffd84a', 140); reyji.e.cmd = 'bark'; C.sfx('bark', 0.6); }],
        [12.4, () => { reyji.e.cmd = ''; }],
        [13.3, () => { J.emote('play_mobile_game', false, 4.4); phoneLight.intensity = 3; C.say('« Juste une partie. »', 'sub', 3); C.sfx('blip', 0.5); }],
        [17.3, () => { phoneLight.intensity = 3; J.emote('play_mobile_game', false, 6); }],
        [19.3, () => C.say('06 h 47. Le soleil se lève. Il a perdu sa série.', 'sub', 3.6)],
      ],
      update(t, dt) {
        // couché, puis debout d'un seul coup ; la couette s'envole
        if (rise > 0) {
          const k = clamp01((t - rise) / 0.28);
          J.tilt[0] = -Math.PI / 2 * (1 - k * k);
          quilt.position.set(0.9 * k, 0.8 + Math.sin(k * Math.PI) * 0.6 - k * 0.55, 0.38 + k * 0.7); quilt.rotation.z = -k * 1.2;
        }
        for (let i = 0; i < zs.length; i++) { const e = ((t * 0.45 + i * 0.25) % 1); zs[i].visible = t < 11; zs[i].position.set(0.1 + e * 0.4, 0.85 + e * 0.8, -0.66); zs[i].scale.setScalar(0.08 + e * 0.12); zs[i].material.opacity = Math.sin(e * Math.PI); }
        // la lumière du téléphone sur son visage, le réveil qui file, l'aube
        if (phoneLight.intensity > 0) { const hp = J.hand(phoneLight.position); phone.position.copy(hp); phone.rotation.set(-1.2, J.yaw, 0); phoneLight.intensity = 2.6 + Math.random() * 0.6; }
        if (t > 17.3) {
          const k = clamp01((t - 17.3) / 3);
          const m = Math.round(3 * 60 + 52 + k * (6 * 60 + 47 - 3 * 60 - 52));
          hour = String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
          moon.color.setRGB(0.54 + k * 0.46, 0.63 + k * 0.1, 1 - k * 0.6); moon.intensity = 0.9 + k * 1.2;
          C.R.scene.background.setRGB(0.03 + k * 0.25, 0.03 + k * 0.12, 0.05 + k * 0.05);
        }
        clockGlow.intensity = 1.2;
        // le rêve : la carte, sa voie du milieu, l'ennemi disparu, le « ? » qui clignote
        if (dream.classList.contains('on')) {
          const w = 220, hh = 150;
          dg.clearRect(0, 0, w, hh);
          dg.fillStyle = '#16301e'; dg.fillRect(40, 10, 140, 130);
          dg.strokeStyle = '#5a7a4a'; dg.lineWidth = 9;
          dg.beginPath(); dg.moveTo(52, 128); dg.lineTo(52, 22); dg.lineTo(168, 22); dg.moveTo(52, 128); dg.lineTo(168, 128); dg.lineTo(168, 22); dg.moveTo(52, 128); dg.lineTo(168, 22); dg.stroke();
          dg.strokeStyle = '#2a5a8a'; dg.lineWidth = 6; dg.beginPath(); dg.moveTo(40, 30); dg.lineTo(180, 120); dg.stroke();
          dg.fillStyle = '#4ab0ff'; dg.beginPath(); dg.arc(104, 82, 6, 0, 7); dg.fill();
          const blink = Math.floor(t * 3) % 2;
          dg.fillStyle = '#ff4a3a'; if (t < 8.4) { dg.beginPath(); dg.arc(126, 62, 5, 0, 7); dg.fill(); }
          if (t > 8.4 && blink) { dg.font = 'bold 26px Arial'; dg.textAlign = 'center'; dg.fillText('?', 126, 70); }
          dg.font = 'bold 13px Arial'; dg.textAlign = 'center'; dg.fillStyle = '#ffd84a'; dg.fillText(t > 8.4 ? 'ENNEMI DISPARU — MID' : 'VOIE DU MILIEU', 110, 146);
        }
      },
      dispose() { dream.remove(); },
      after: ['… Quoi ? Non, j\'ai pas joué cette nuit.', 'Le mid était ouvert. J\'avais pas le choix.'],
    };
  },

  // SKANKY : « Le casse du TER ». Un film de casse dans un garage : la carte, le plan, la maquette du train
  skanky(C) {
    C.add(new THREE.HemisphereLight('#6a5a4a', '#0a0806', 0.4));
    C.add(mesh(new THREE.PlaneGeometry(10, 10), mat('#2a2826'), [0, 0, 0], [-Math.PI / 2, 0, 0]));
    C.add(mesh(new THREE.PlaneGeometry(10, 4), mat('#3a2a24'), [0, 2, -2.2]));
    // la table et la carte (le trajet du TER se trace tout seul)
    C.add(mesh(G.box(2.2, 0.08, 1.3), mat('#4a3424'), [0, 0.85, 0]));
    for (const [x, z] of [[-1, -0.55], [1, -0.55], [-1, 0.55], [1, 0.55]]) C.add(mesh(G.box(0.07, 0.85, 0.07), mat('#2a1e16'), [x, 0.42, z]));
    let route = 0;
    const map = C.screen(512, 300, 2.0, 1.17, (g, w, hh) => {
      g.fillStyle = '#e8dcc0'; g.fillRect(0, 0, w, hh);
      g.strokeStyle = 'rgba(80,60,40,0.25)'; g.lineWidth = 1; for (let i = 0; i < w; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, hh); g.stroke(); } for (let i = 0; i < hh; i += 32) { g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); }
      g.strokeStyle = '#4a4a4a'; g.lineWidth = 5; g.setLineDash([14, 8]); g.beginPath(); g.moveTo(30, 230); g.bezierCurveTo(160, 230, 220, 90, 480, 80); g.stroke(); g.setLineDash([]);
      g.font = 'bold 20px "Barlow Condensed", Arial'; g.fillStyle = '#2a2018';
      g.fillText('LYON PART-DIEU', 24, 262); g.fillText('VILLEURBANNE', 380, 62); g.fillText('(porte du milieu)', 170, 190);
      // le trait rouge du plan
      g.strokeStyle = '#d0201a'; g.lineWidth = 7; g.lineCap = 'round';
      g.beginPath(); for (let i = 0; i <= 40 * route; i++) { const u = i / 40, x = (1 - u) ** 3 * 30 + 3 * (1 - u) ** 2 * u * 160 + 3 * (1 - u) * u * u * 220 + u ** 3 * 480, y = (1 - u) ** 3 * 230 + 3 * (1 - u) ** 2 * u * 230 + 3 * (1 - u) * u * u * 90 + u ** 3 * 80; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
      if (route > 0.98) { g.font = 'bold 44px Arial'; g.fillStyle = '#d0201a'; g.fillText('X', 462, 108); }
      g.fillStyle = '#ffe36a'; g.fillRect(300, 210, 120, 64); g.fillStyle = '#2a2018'; g.font = 'bold 16px "Barlow Condensed", Arial'; g.fillText('CONTRÔLEUR :', 308, 232); g.fillText('PARLER DE FUNK', 308, 252); g.fillText('40 MIN MINI', 308, 270);
    });
    map.rotation.x = -Math.PI / 2; map.position.set(0, 0.895, 0);
    // le tableau de liège : les photos, le fil rouge
    C.add(mesh(G.box(1.8, 1.1, 0.05), mat('#9a6a3a'), [0, 1.9, -2.15]));
    C.screen(360, 220, 1.7, 1.04, (g, w, hh) => {
      g.clearRect(0, 0, w, hh);
      const pics = [[30, 30, 'TER 22H14', '#6a8aa0'], [140, 20, 'LE CONTRÔLEUR', '#a06a5a'], [250, 40, 'PORTE DU MILIEU', '#7a8a5a'], [80, 120, 'VILLEURBANNE', '#8a7aa0'], [210, 125, 'PLAN B : COURIR', '#a0905a']];
      g.strokeStyle = '#d0201a'; g.lineWidth = 3; g.beginPath(); pics.forEach(([x, y], i) => (i ? g.lineTo(x + 40, y + 30) : g.moveTo(x + 40, y + 30))); g.stroke();
      for (const [x, y, t, c] of pics) { g.fillStyle = '#f4efe2'; g.fillRect(x, y, 84, 70); g.fillStyle = c; g.fillRect(x + 6, y + 6, 72, 46); g.fillStyle = '#2a2018'; g.font = 'bold 11px Arial'; g.fillText(t, x + 6, y + 64); g.fillStyle = '#d0201a'; g.beginPath(); g.arc(x + 42, y + 4, 4, 0, 7); g.fill(); }
    }, false).position.set(0, 1.9, -2.12);
    C.screens[C.screens.length - 1].material.transparent = true;
    C.screens[C.screens.length - 1].material.color.set('#8a7a6a'); // dans la pénombre
    // la lumière de la lampe renvoyée par la carte, sur son visage
    const bounce = C.add(new THREE.PointLight('#ffc890', 2.6, 3, 1.6)); bounce.position.set(0.3, 1.1, -0.2);
    // la lampe suspendue
    C.add(mesh(G.cone(0.32, 0.26, 16), mat('#2a3a2a', { side: THREE.DoubleSide }), [0, 2.35, 0]), mesh(G.cyl(0.01, 0.01, 1.6, 4), mat('#111'), [0, 3.2, 0]));
    const bulb = C.add(glow('#ffd48a', 0.5, 0.9)); bulb.position.set(0, 2.25, 0);
    const lamp = C.add(new THREE.SpotLight('#ffcf8a', 38, 6, 0.75, 0.5, 1.4)); lamp.position.set(0, 2.25, 0);
    C.add(lamp.target); lamp.target.position.set(0, 0.85, 0);
    // la maquette du train sur la carte
    const train = C.prop('train', 0.55, [-0.7, 0.98, 0.28], [0, 0, 0], [1, 0.3, 0.25]);
    const S = C.actor('skanky', 0.15, -1.0, 0);
    return {
      dur: 25, fog: ['#070605', 5, 16], bg: '#070605', gray: 0.1, vignette: 1.5, fadeOut: 1.4,
      shots: [
        shot(0, [1.5, 2.7, 1.3], [0, 0.85, 0], [-1.1, 2.55, 1.5], [0, 0.85, 0], { fov0: 44, roll: 0.2 }),
        shot(4.6, [0.9, 1.45, 1.5], [0.1, 1.45, -1.0], [0.6, 1.5, 1.1], [0.15, 1.55, -1.0], { fov0: 36, fov1: 32, hand: 0.004 }),
        shot(9.2, [-1.0, 1.9, -0.6], [-0.5, 1.9, -2.12], [0.9, 1.9, -0.6], [0.5, 1.9, -2.12], { fov0: 40, ease: false }),
        shot(13.7, [-1.3, 1.08, 1.0], [-0.6, 0.98, 0.25], [0.9, 1.08, 1.0], [0.6, 0.98, 0.25], { fov0: 38, ease: false }),
        shot(18.3, [0.35, 1.35, 1.9], [0.15, 1.5, -1.0], [0.25, 1.45, 1.2], [0.15, 1.55, -1.0], { fov0: 38, fov1: 30 }),
      ],
      beats: [
        [0.4, () => C.title('SKANKY', 'le casse du TER', 'heist', 3.8)],
        [4.8, () => { S.emote('select', false, 4); C.say('« Étape 1 : je monte par la porte du milieu. Personne regarde jamais celle du milieu. »', 'heist', 4.3); }],
        [9.4, () => C.say('« Étape 2 : le contrôleur arrive. Je lui parle du funk de Lyon. Quarante minutes. Minimum. »', 'heist', 4.3)],
        [13.9, () => { C.say('« Étape 3 : Villeurbanne. Je descends. Libre comme un ollie. »', 'heist', 4.2); C.sfx('rails', 0.5); }],
        [18.5, () => { S.emote('win', false, 6); C.say('« Plan B… acheter un billet ? »', 'heist', 2.2); }],
        [21.2, () => { C.say('« … Non. »', 'heist', 2.2); C.sfx('funk', 0.6); C.slam('CE SOIR, 22 H 14', 320, 120, '#d0201a', 120); }],
      ],
      update(t) {
        route = clamp01((t - 4.6) / 8);
        const u = clamp01((t - 13.7) / 4.6);
        train.position.x = -0.7 + u * 1.4;
        lamp.intensity = 38 * (0.92 + Math.sin(t * 9) * 0.04 + (Math.random() < 0.01 ? -0.4 : 0));
      },
      after: ['Tu as rien vu. Rien entendu.', 'Si on te demande : j\'étais au bar. Toute la soirée.'],
    };
  },
};

