// Les marionnettes des mini-jeux : le vrai modèle 3D d'un perso (ou le shiba Reyji), animé comme en combat (courir,
// sauter, prendre un coup, être à terre, danser, provoquer...), rendu par un petit moteur à part (fond transparent) puis
// collé sur le canevas 2D des mini-jeux comme un sprite.
// Pour les petites machines (et Safari, où recopier une image WebGL vers un canevas 2D coûte très cher) : toutes les
// marionnettes d'une image sont rendues ENSEMBLE, chacune dans sa case d'une grande image (ATLAS), recopiée d'un seul
// coup vers un canevas 2D ; on dessine depuis ce canevas-là. Une marionnette demandée à une image est rendue au début de
// la suivante (une image de retard, invisible), et seulement une image sur EVERY (son animation à 30 images/s ou moins) ;
// la première fois, tout de suite (rien ne surgit à vide).
//   view.puppet(char, x, y, h, opts) (src/render/minigameView.js) : voir le contrat src/sim/mg/README.md.
import * as THREE from 'three';
import { FighterView } from './fighterView.js';
import { createFighter } from '../sim/fighter.js';
import { RIGS } from './rig/chars.js';
import { EMOTES } from './rig/nativeMoves.js';
import { petObj, updatePet } from './friendsView.js';
import { ENTITY_MODELS } from './entityView.js';

const CW = 300, CH = 410; // une case de rendu (portrait)
let SCALE = 0.85; // sa résolution (setPuppetQuality : moins de pixels sur les petites machines)
let EVERY = 2; // une marionnette n'est rendue qu'une image sur EVERY (setPuppetQuality)
const COLS = 4, ROWS = 3; // l'atlas : 12 cases (les marionnettes en trop prennent la case de la plus ancienne)
let FRAME = 0; // les images de l'écran (le rendu groupé se fait à la première demande de chaque image)
if (typeof requestAnimationFrame === 'function') { const tick = () => { FRAME++; requestAnimationFrame(tick); }; requestAnimationFrame(tick); }
const TOP = 1.5, BOT = 0.1; // ce qu'on cadre, en hauteurs du perso : de 0,1 sous les pieds à 1,5 au-dessus (place pour une grosse tête)
const FACES = { front: 0.34, left: -Math.PI / 2, right: Math.PI / 2, back: Math.PI, three: 0.9, threeL: -0.9 };
const NO_W = { fighters: [], list: [], stage: { findLanding: () => null, heightAt: () => 0 } };

let stage = null;

function makeStage() {
  const canvas = document.createElement('canvas');
  let gl;
  try { gl = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'high-performance' }); } catch (e) { return null; }
  gl.setPixelRatio(1);
  gl.autoClear = false;
  gl.setClearColor(0x000000, 0);
  gl.outputColorSpace = THREE.SRGBColorSpace;
  gl.toneMapping = THREE.ACESFilmicToneMapping;
  gl.toneMappingExposure = 1.15;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#fff4e8', '#3a2a4a', 2.2));
  const key = new THREE.DirectionalLight('#ffffff', 2.4); key.position.set(2, 4, 5); scene.add(key);
  const rim = new THREE.DirectionalLight('#b8a0ff', 1.2); rim.position.set(-3, 2, -4); scene.add(rim);
  const camera = new THREE.PerspectiveCamera(28, CW / CH, 0.05, 50);
  const S = { canvas, gl, scene, camera, items: {}, atlas: document.createElement('canvas'), slots: {}, req: {}, flushed: -1 };
  sizeStage(S);
  return S;
}

// la taille des cases (selon SCALE) ; les images déjà rendues ne valent plus rien
function sizeStage(S) {
  S.sw = Math.round(CW * SCALE); S.sh = Math.round(CH * SCALE);
  S.gl.setSize(S.sw * COLS, S.sh * ROWS, false);
  S.atlas.width = S.sw * COLS; S.atlas.height = S.sh * ROWS;
  S.ag = S.atlas.getContext('2d');
  S.slots = {};
}

// la case d'une clé (la plus ancienne reprise s'il n'y en a plus de libre)
function slotOf(S, key) {
  let sl = S.slots[key];
  if (sl) return sl;
  const used = new Set(Object.values(S.slots).map((v) => v.i));
  let i = -1;
  for (let k = 0; k < COLS * ROWS; k++) if (!used.has(k)) { i = k; break; }
  if (i < 0) {
    let old = null;
    for (const k in S.slots) if (!old || S.slots[k].seen < S.slots[old].seen) old = k;
    i = S.slots[old].i; delete S.slots[old];
  }
  sl = S.slots[key] = { i, x: (i % COLS) * S.sw, y: ((i / COLS) | 0) * S.sh, ok: false, at: -99, seen: FRAME };
  return sl;
}

// rend des cases (r : [{ key, char, o }]) dans l'atlas WebGL, puis les recopie vers l'atlas 2D (une seule lecture)
function renderSlots(S, list) {
  const g = S.gl, H = S.sh * ROWS, now = performance.now() / 1000, done = [];
  g.setScissorTest(true);
  for (const r of list) {
    const it = item(S, r.key, r.char);
    if (!it) continue;
    const sl = slotOf(S, r.key);
    const dt = it.last ? Math.min(0.1, Math.max(0, now - it.last)) : 1 / 60;
    it.last = now;
    for (const k in S.items) S.items[k].root.visible = S.items[k] === it;
    poseItem(it, r.char, r.o, dt, now);
    // la caméra cadre de BOT sous les pieds à TOP au-dessus, de face
    const hm = it.h, span = (TOP + BOT) * hm, cy = (TOP - BOT) * hm / 2;
    const dist = (span / 2) / Math.tan((S.camera.fov * Math.PI / 180) / 2);
    S.camera.position.set(0, cy + hm * 0.05, dist);
    S.camera.lookAt(0, cy, 0);
    const gy = H - sl.y - S.sh; // (WebGL compte depuis le bas)
    g.setViewport(sl.x, gy, S.sw, S.sh); g.setScissor(sl.x, gy, S.sw, S.sh);
    try { g.clear(); g.render(S.scene, S.camera); } catch (e) { continue; }
    sl.at = FRAME; done.push(sl);
  }
  g.setScissorTest(false);
  for (const sl of done) {
    S.ag.clearRect(sl.x, sl.y, S.sw, S.sh);
    S.ag.drawImage(S.canvas, sl.x, sl.y, S.sw, S.sh, sl.x, sl.y, S.sw, S.sh);
    sl.ok = true;
  }
}

// au début de chaque image : rendre ce qui a été demandé à la précédente (chacun une image sur EVERY, en décalé)
function flush(S) {
  const list = [];
  for (const key in S.req) {
    const r = S.req[key], sl = S.slots[key];
    const every = r.o.every || EVERY;
    if (!sl || !sl.ok || FRAME - sl.at >= every) list.push(r);
  }
  S.req = {};
  if (list.length) renderSlots(S, list);
}

function item(S, key, char, inScene = false) {
  const old = S.items[key];
  if (old && old.char === char) return old;
  // une clé nouvelle (chaque mini-jeu nomme ses marionnettes à sa façon) : on reprend une marionnette du même perso qui
  // ne sert plus depuis un moment, plutôt que d'en refaire une (un modèle complet : 100 à 230 ms la première fois)
  if (!old && !inScene) {
    const now = performance.now() / 1000;
    for (const k in S.items) {
      const it = S.items[k];
      if (it.char !== char || now - it.last < 0.4) continue;
      delete S.items[k];
      it.state = ''; it.st = 0; it.em = undefined; it.emT = 0; it.last = 0;
      S.items[key] = it;
      return it;
    }
  }
  if (old) { S.scene.remove(old.root); if (old.view) old.view.dispose && old.view.dispose(); }
  let it;
  if (char === 'shiba' || char === 'reyji') {
    const o = petObj(ENTITY_MODELS, 'shiba');
    o.scale.setScalar(1.6);
    if (!inScene) for (const c of o.children) if (c !== o.userData.body) c.visible = false; // son ombre 3D : la marionnette a la sienne, en 2D
    S.scene.add(o);
    it = { char, root: o, pet: o, e: { cmd: '', ct: 0, a: 0 }, h: 1.25, last: 0, st: 0, state: '' };
  } else {
    if (!RIGS[char]) return null;
    const F = createFighter(0, { char }, { x: 0, y: 0, z: 0, facing: 0 });
    const view = new FighterView(S.scene, F);
    view.marker.visible = false; view.shadow.visible = false; view.cdRing.visible = false; view.slab.visible = false;
    view.snapTo(F);
    it = { char, root: view.root, view, F, h: RIGS[char].h || 1.8, last: 0, st: 0, state: '' };
  }
  S.items[key] = it;
  return it;
}


// pose une marionnette (ou un acteur) d'après les options : état, provocation, regard, grosse tête, teinte
function poseItem(it, char, o, dt, now) {
  const face = typeof o.face === 'number' ? o.face : FACES[o.face || 'front'] ?? FACES.front;
  if (it.pet) {
    // le shiba : cmd = '', 'bark', 'jump', 'spin', 'bite', 'dash' ; speed (m/s) fait trotter ou galoper
    const e = it.e;
    if ((o.cmd || '') !== e.cmd) { e.cmd = o.cmd || ''; e.ct = 0; } else e.ct++;
    e.a = face;
    // updatePet déduit sa vitesse de son déplacement : on lui fait croire qu'il vient de parcourir speed * dt
    it.root.position.set(0, o.hop || 0, 0); it.root.userData.lx = -(o.speed || 0) * dt;
    updatePet(it.root, e, dt, now);
  } else {
    const F = it.F;
    const state = o.state || 'idle';
    if (state !== it.state) { it.state = state; it.st = 0; } else it.st++;
    F.state = state; F.st = it.st; F.move = null; F.mf = 0; F.af = -1; F.mv = {}; F.hitlag = 0;
    F.grounded = !(state === 'air' || state === 'tumble' || state === 'helpless');
    F.vx = state === 'run' ? 9 : state === 'walk' ? 3 : 0; F.vy = o.vy ?? (state === 'air' ? 4 : 0);
    F.launchKb = o.kb ?? 80;
    let em = o.emote || null;
    if (em === 'select' || em === 'win') em = EMOTES[char] && EMOTES[char][em] ? EMOTES[char][em].emote : null;
    // une animation que ce perso n'a pas (Epektase, PPROD n'ont que les leurs) : la joie devient sa danse de victoire,
    // la peine et la colère le laissent sonné
    const X = it.view.rigModel && it.view.rigModel.mixer;
    if (em && X && !X.has(em)) {
      if (/sob|complain|angry/.test(em)) { em = null; if (state === 'idle') F.state = 'dizzy'; }
      else { const w = EMOTES[char] && EMOTES[char].win; em = w && X.has(w.emote) ? w.emote : null; }
    }
    if (em !== it.em) { it.em = em; it.emT = 0; } else it.emT += dt;
    F.emote = em; F.emoteT = it.emT * (o.emoteSpeed || 1);
    F.facing = face; // (FighterView tourne de 0,34 vers la caméra : 'front' vaut 0,34 pour être pile de face)
    F.size = 1;
    it.view.capture(F); it.view.capture(F);
    it.view.vyaw = undefined;
    it.view.update(F, NO_W, dt, now, 1);
    it.view.marker.visible = false; it.view.shadow.visible = false; it.view.cdRing.visible = false; it.view.slab.visible = false;
    // la grosse tête (décalé) : l'os de la tête grossit
    const RM = it.view.rigModel, head = RM && RM.rig && RM.rig.bones && RM.rig.bones.head;
    if (head) head.scale.setScalar(o.head || 1);
    // la teinte : posée à chaque dessin qui la demande, enlevée au premier qui ne la demande plus
    if (o.tint) { for (const m of it.view.mats) { if (m.emissive) m.emissive.set(o.tint); m.emissiveIntensity = o.tintK ?? 0.6; } it.tinted = true; }
    else if (it.tinted) { for (const m of it.view.mats) { if (m.emissive) m.emissive.setScalar(0); m.emissiveIntensity = 1; } it.tinted = false; }
  }
}

// dessine la marionnette `char` sur le contexte 2D `ctx`, les pieds en (x, y), haute de h (unités du contexte)
// la résolution des marionnettes (1 : normale ; 0,6 : petites machines) ; le dessin garde sa taille
// la qualité des marionnettes : s leur résolution (1 normale, 0,6 petites machines), every une image sur combien
export function setPuppetQuality(s, every = EVERY) {
  EVERY = every;
  if (s === SCALE) return;
  SCALE = s;
  if (stage) sizeStage(stage);
}

export function drawPuppet(ctx, char, x, y, h, o = {}) {
  if (!stage) stage = makeStage();
  const S = stage;
  if (!S) return false;
  if (S.flushed !== FRAME) { S.flushed = FRAME; flush(S); }
  const key = o.key || char;
  // la demande, rendue au début de l'image suivante ; la première fois, tout de suite
  S.req[key] = { key, char, o: { ...o } }; // (une copie : l'appelant peut réutiliser son objet)
  let sl = S.slots[key];
  if (!sl || !sl.ok) { renderSlots(S, [S.req[key]]); sl = S.slots[key]; if (!sl || !sl.ok) return false; }
  sl.seen = FRAME;
  // la recopie sur le canevas 2D (h = la hauteur du perso à l'écran)
  const dh = h * (TOP + BOT), dw = dh * CW / CH;
  ctx.save();
  ctx.translate(x, y);
  if (o.rot) ctx.rotate(o.rot);
  const sq = o.squash || [1, 1];
  ctx.scale((o.flip ? -1 : 1) * sq[0], sq[1]);
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  if (o.shadow !== false) {
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(0, 0, h * 0.26, h * 0.06, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(S.atlas, sl.x, sl.y, S.sw, S.sh, -dw / 2, -dh * TOP / (TOP + BOT), dw, dh);
  ctx.restore();
  return true;
}

// rend les marionnettes une fois à l'avance (les shaders se compilent pendant l'explication, pas pendant le jeu)
export function warmPuppets(ctx, chars) { for (const c of chars) drawPuppet(ctx, c, -9999, -9999, 10, { shadow: false }); }

// un acteur dans une scène 3D (les mini-jeux en 3D, dans l'arène) : le vrai modèle, posé comme une marionnette.
//   const a = sceneActor(view.mv.root, 'pandrezz'); a.root.position.set(x, y, z); a.root.scale.setScalar(4);
//   chaque image : a.pose({ state, emote, face, head }); à la fin : a.dispose()
export function sceneActor(scene, char) {
  const holder = { scene: new THREE.Group(), items: {} };
  scene.add(holder.scene);
  const it = item(holder, 'a', char, true);
  const root = new THREE.Group();
  if (it) { holder.scene.remove(it.root); root.add(it.root); }
  scene.add(root);
  scene.remove(holder.scene);
  return {
    root,
    pose(o = {}) {
      if (!it) return;
      const now = performance.now() / 1000, dt = it.last ? Math.min(0.1, Math.max(0, now - it.last)) : 1 / 60;
      it.last = now;
      poseItem(it, char, o, dt, now);
    },
    dispose() {
      scene.remove(root);
      if (it && it.view) it.view.dispose();
      // les matériaux sont propres à cet acteur (les géométries et les textures sont partagées : on les garde)
      root.traverse((m) => { const ms = Array.isArray(m.material) ? m.material : m.material ? [m.material] : []; for (const x of ms) x.dispose(); });
    },
  };
}
