// La pluie de Pandrezz (coins), l'affichage : en 3D dans l'arène du match. Pandrezz, le vrai modèle 3D, géant au-dessus
// de l'arène (grosse tête, auréole de rayons, yeux dollars quand on attrape, rouges quand il vise) : il jubile, ricane,
// plonge la tête la première dans un chapeau (les jambes qui pédalent dehors), part en vrille quand il prend la baffe.
// Les deux chapeaux haut-de-forme retournés au sol, la pile d'or qui monte dedans, les combattants (grosse tête) qui
// marchent derrière (faux combattants) et réagissent. Par-dessus, sur le canevas : les scores, les bulles de Pandrezz,
// l'alerte quand il descend et le gros « TAPE ! ».
import * as THREE from 'three';
import { COINS } from '../../sim/mg/coins.js';
import { COLORS } from '../../sim/constants.js';
import { sceneActor } from '../puppets.js';
import { glowTex } from '../materials.js';

const RIGHT = Math.PI / 2, LEFT = -Math.PI / 2, ZERO6 = [0, 0, 0, 0, 0, 0];
const GOLD = ['#ffe24a', '#ffb800', '#fff6c0', '#ffffff'];
const JOY = ['OUIII !', 'MIAM !', 'ENCORE !', 'C\'EST BEAU !', 'MES SOUS !', 'BRAVO !', 'J\'ADORE !', 'TOUT DOUX !', 'KA-CHING !'];
const EVIL = ['Hé hé hé...', 'Je prends juste un peu...', 'C\'est pour une bonne cause !', 'Personne ne regarde...', 'Petit impôt !'];
const BONK = ['AÏE !', 'MA PIÈCE !', 'C\'ÉTAIT POUR RIRE !', 'OUILLE !', 'PARDON !'];
const FLED = ['MERCI !', 'IMPÔT PRÉLEVÉ !', 'À LA PROCHAINE !', 'TROP FACILE !'];
const Z_SKY = -1.6, HAT_Z = 0.3, FIGHTER_Z = -0.75;
// Pandrezz en 3D : sa taille (fois la normale) dans le ciel et la tête dans un chapeau, sa hauteur, sa grosse tête
const SC_SKY = 2.0, SC_LOW = 1.3, PAN_H = 1.85, HEAD = 1.75;
const _hv = new THREE.Vector3(), _cv = new THREE.Vector3(), _uv = new THREE.Vector3(), _hq = new THREE.Quaternion();
let HEADS = []; // les têtes grossies des deux joueurs (remises à 1 à la sortie)

// --- textures faites au canevas ----------------------------------------------------------------------------------
const texCache = {};
function emojiTex(ch) {
  if (texCache[ch]) return texCache[ch];
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.font = "100px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(ch, 64, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (texCache[ch] = t);
}
function raysTex() {
  if (texCache.rays) return texCache.rays;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.translate(128, 128);
  for (let i = 0; i < 16; i++) {
    const gr = g.createLinearGradient(0, 0, 128, 0); gr.addColorStop(0, 'rgba(255,230,120,0.9)'); gr.addColorStop(1, 'rgba(255,200,40,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 128, i * Math.PI / 8, i * Math.PI / 8 + Math.PI / 16); g.closePath(); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (texCache.rays = t);
}
// les yeux par-dessus ses lunettes : 1 des dollars, 2 rouges qui brillent (deux ronds côte à côte, face à la caméra)
function eyesTex(kind) {
  const key = 'eyes' + kind;
  if (texCache[key]) return texCache[key];
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  for (const x of [70, 186]) {
    if (kind === 1) {
      g.fillStyle = 'rgba(30,150,50,0.92)'; g.strokeStyle = '#0b0610'; g.lineWidth = 7; g.beginPath(); g.ellipse(x, 64, 50, 42, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.font = 'bold 76px Arial Black, Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffe24a'; g.lineWidth = 9; g.strokeText('$', x, 68); g.fillText('$', x, 68);
    } else {
      const gr = g.createRadialGradient(x, 64, 2, x, 64, 56); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.25, '#ff3030'); gr.addColorStop(1, 'rgba(255,0,0,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, 64, 56, 0, Math.PI * 2); g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (texCache[key] = t);
}

// --- la scène 3D (faite une fois, réutilisée) -------------------------------------------------------------------
let S3 = null;
function build() {
  const group = new THREE.Group();
  const gold = new THREE.MeshLambertMaterial({ color: '#ffcc2a', emissive: '#a06a00', emissiveIntensity: 1 });
  const cursed = new THREE.MeshLambertMaterial({ color: '#8a3ad0', emissive: '#3a0a6a', emissiveIntensity: 1 });
  const black = new THREE.MeshLambertMaterial({ color: '#1c1824', emissive: '#08060c', emissiveIntensity: 1, side: THREE.DoubleSide });
  const inside = new THREE.MeshBasicMaterial({ color: '#050307', side: THREE.DoubleSide });
  // les chapeaux haut-de-forme, retournés (l'ouverture en haut)
  const hats = [0, 1].map((i) => {
    const h = new THREE.Group();
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.4, 0.78, 24, 1, true), black); crown.position.y = 0.41;
    const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 24), black); bottom.position.y = 0.04;
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.43, 24), inside); hole.rotation.x = -Math.PI / 2; hole.position.y = 0.06;
    const brim = new THREE.Mesh(new THREE.RingGeometry(0.44, 0.72, 28), black); brim.rotation.x = -Math.PI / 2; brim.position.y = 0.8;
    const roll = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.05, 6, 28), black); roll.rotation.x = Math.PI / 2; roll.position.y = 0.82;
    const bandM = new THREE.MeshLambertMaterial({ color: COLORS[i], emissive: COLORS[i], emissiveIntensity: 0.35 });
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.455, 0.45, 0.14, 24, 1, true), bandM); band.position.y = 0.66;
    const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1, 20), gold); pile.position.y = 0.06;
    const heap = new THREE.Mesh(new THREE.ConeGeometry(0.44, 1, 20), gold);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.05, 32), new THREE.MeshBasicMaterial({ color: '#ff2a2a', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05;
    const alert = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex('❗'), transparent: true, depthWrite: false }));
    alert.scale.setScalar(0.8); alert.visible = false;
    h.add(crown, bottom, hole, brim, roll, band, pile, heap, ring, alert);
    h.userData = { pile, heap, ring, alert, squash: 0, n: 0, tilt: 0 };
    group.add(h);
    return h;
  });
  // les pièces qui tombent (une ombre au sol sous chacune), les sacs, les têtes de mort des maudites
  const coinGeo = new THREE.CylinderGeometry(0.27, 0.27, 0.06, 18);
  const shadowMat = new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.35, depthWrite: false });
  const mk = (n, f) => { const a = []; for (let i = 0; i < n; i++) { const o = f(i); o.visible = false; group.add(o); a.push(o); } return a; };
  const coins = mk(64, () => { const m = new THREE.Mesh(coinGeo, gold); m.rotation.order = 'YXZ'; return m; });
  const curses = mk(16, () => { const m = new THREE.Mesh(coinGeo, cursed); m.rotation.order = 'YXZ'; m.scale.setScalar(1.15); return m; });
  const skulls = mk(16, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex('💀'), transparent: true, depthWrite: false })); s.scale.setScalar(0.34); return s; });
  const bags = mk(12, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex('💰'), transparent: true, depthWrite: false })); s.scale.setScalar(0.78); return s; });
  const shadows = mk(64, () => { const m = new THREE.Mesh(new THREE.CircleGeometry(0.22, 14), shadowMat); m.rotation.x = -Math.PI / 2; return m; });
  const ground = mk(24, () => { const m = new THREE.Mesh(coinGeo, gold); m.userData.t = 0; return m; });
  const flyers = mk(18, () => { const m = new THREE.Mesh(coinGeo, gold); m.rotation.order = 'YXZ'; m.userData = { t: 0, life: 0 }; return m; });
  // Pandrezz (le vrai modèle, ajouté à chaque ulti par enter3D) : derrière lui des rayons et une auréole ; par-dessus ses
  // lunettes, des yeux (dollars, rouges) ; à côté de sa tête, l'émoji de son humeur
  const pan = new THREE.Group();
  const rays = new THREE.Sprite(new THREE.SpriteMaterial({ map: raysTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 }));
  rays.scale.setScalar(2.6);
  const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: '#ffd23a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 }));
  aura.scale.setScalar(1.9);
  pan.add(rays, aura);
  group.add(pan);
  const eyes = new THREE.Sprite(new THREE.SpriteMaterial({ map: eyesTex(1), transparent: true, depthWrite: false, depthTest: false }));
  eyes.renderOrder = 6; eyes.visible = false;
  const moodS = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex('🤑'), transparent: true, depthWrite: false, depthTest: false }));
  moodS.renderOrder = 6; moodS.scale.setScalar(0.38);
  group.add(eyes, moodS);
  // la main qui gifle
  const slap = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex('✋'), transparent: true, depthWrite: false }));
  slap.scale.setScalar(1.1); slap.visible = false;
  group.add(slap);
  return { group, hats, coins, curses, skulls, bags, shadows, ground, flyers, pan, rays, aura, eyes, moodS, slap };
}

// une pièce d'or dessinée (l'émoji 🪙 sort gris sur certains systèmes)
function coinIcon(ctx, x, y, r, t) {
  const w = Math.max(0.25, Math.abs(Math.cos(t * 3)));
  ctx.save(); ctx.translate(x, y); ctx.scale(w, 1);
  ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.arc(0, 0, r + 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#c08000'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.arc(-r * 0.12, -r * 0.12, r * 0.78, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff6c0'; ctx.fillRect(-r * 0.45, -r * 0.5, r * 0.25, r * 0.5);
  ctx.restore();
}

// un point du monde -> la grille 640 x 360 du canevas
const tmpV = new THREE.Vector3();
function proj(view, x, y, z) {
  const k = view.k || 1;
  tmpV.set(x, y, z).project(view.R.camera);
  return [((tmpV.x + 1) / 2 * window.innerWidth) / k - (view.ox || 0), ((1 - tmpV.y) / 2 * window.innerHeight) / k - (view.oy || 0)];
}
const groundY = (W, x) => { const m = W.stage.main(); return W.stage.heightAt(m, x, 0); };
// la hauteur et la taille de Pandrezz selon sa descente (u : 1 dans le ciel, 0 la tête dans le chapeau)
function panPose(P) {
  const u = Math.max(0, Math.min(1, (P.y - COINS.RIM - 0.5) / (COINS.PAN_Y - COINS.RIM - 0.5)));
  return { u, z: HAT_Z + (Z_SKY - HAT_Z) * u, s: SC_LOW + (SC_SKY - SC_LOW) * u };
}
function sayPan(view, text, life = 1.1) { view.xs.bubble = { text, t: 0, life }; }
function popScore(view, i) { if (view.xs.pop) view.xs.pop[i] = 1; }
function flyCoin(view, x0, y0, z0, x1, y1, z1, life = 0.4, delay = 0) {
  const S = S3; if (!S) return;
  const f = S.flyers.find((o) => !o.visible) || S.flyers[0];
  f.visible = true; f.userData = { t: -delay, life, a: [x0, y0, z0], b: [x1, y1, z1] };
}

export default {
  title: 'LA PLUIE DE PANDREZZ', color: '#ffc61a', icon: '🎩',
  gray: false,
  puppets: ['pandrezz'],
  rules: [
    'Stick : bouge ton chapeau, attrape les pièces d\'or (💰 = +5, 💀 = -3)',
    'Pandrezz descend piquer dans ton chapeau : A quand il est en bas = PAF !',
    'A dans le vide = sonné · le plus de pièces gagne',
  ],
  ach: [
    ['Picsou de la crypte', 'Ministre des Finances', 'Chapeau magique', 'Pluie d\'or'],
    ['Chapeau troué', 'Contribuable modèle', 'Mécène de Pandrezz', 'Fauché comme les blés'],
  ],
  news: (L, d) => `${L} RUINÉ PAR PANDREZZ : SON CHAPEAU VIDE ET ${d} % DANS LA VUE`,

  demo(view, x, y, w, h, t) {
    const ctx = view.g, cy = y + h;
    const sky = ctx.createLinearGradient(0, y, 0, cy); sky.addColorStop(0, '#2a1450'); sky.addColorStop(1, '#5a3a20');
    ctx.fillStyle = sky; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#3a2a3a'; ctx.fillRect(x, cy - 10, w, 10);
    const cyc = (t * 0.45) % 1, dive = cyc > 0.62, hx = x + w / 2 + Math.sin(t * 2.2) * 70 * (dive ? 0.2 : 1);
    // les pièces
    for (let k = 0; k < 7; k++) {
      const ph = (t * 0.9 + k * 0.37) % 1, px = x + 24 + ((k * 53) % (w - 48)), py = y + 18 + ph * (h - 30);
      if (Math.abs(px - hx) < 14 && ph > 0.8) continue;
      if (k === 3) view.text('💰', px, py, 9, '#fff', { stroke: false }); else coinIcon(ctx, px, py, 4, t + k);
    }
    // Pandrezz : en haut, puis il plonge dans le chapeau
    const dy = dive ? Math.min(1, (cyc - 0.62) / 0.12) : 0, slapped = cyc > 0.82;
    const px = dive ? hx : x + w / 2 + Math.sin(t * 1.3) * 30, py = slapped ? y + 16 - (cyc - 0.82) * 200 : y + 16 + dy * (h - 44);
    ctx.save(); ctx.translate(px, py); ctx.rotate(slapped ? t * 20 : Math.sin(t * 6) * 0.15);
    if (!view.puppet('pandrezz', 0, 14, 26, { key: 'pdemo', head: 1.9, shadow: false, ...(slapped ? { state: 'hitstun', kb: 150 } : dive ? { state: 'air', vy: -8 } : { emote: 'cheer' }) })) view.portraitAt('pandrezz', 0, 0, 18 + (dive ? 0 : 4), '#ffc61a', false);
    ctx.restore();
    if (!dive) view.text('😍', px + 16, py - 8, 9, '#fff', { stroke: false });
    // le chapeau
    ctx.fillStyle = '#0b0610'; ctx.fillRect(hx - 16, cy - 30, 32, 4); ctx.fillStyle = '#1c1824'; ctx.fillRect(hx - 11, cy - 27, 22, 18);
    ctx.fillStyle = COLORS[0]; ctx.fillRect(hx - 11, cy - 23, 22, 3); ctx.fillStyle = '#ffc21a'; ctx.fillRect(hx - 9, cy - 28, 18, 2);
    if (dive && !slapped && dy >= 1) view.text('A !', hx + 26, cy - 34, 12, '#ff3030', { mono: true, alpha: Math.sin(t * 30) > 0 ? 1 : 0.4 });
    if (slapped) { view.text('✋', hx - 12, cy - 44, 16, '#fff', { stroke: false }); view.text('PAF !', hx + 32, y + 22, 14, '#ffe24a', { mono: true }); }
    else if (!dive) view.text('+1', hx, cy - 40, 9, '#ffe24a', { mono: true, alpha: (t * 3) % 1 });
  },

  proxy(view, F, W, M) {
    const i = F.slot === M.a ? 0 : F.slot === M.v ? 1 : -1;
    if (i < 0) return 'hide';
    const H = M.g.hats[i], xs = view.xs, p = Object.create(F);
    if (!xs.face) xs.face = [i === 0 ? 1 : -1, i === 0 ? 1 : -1];
    if (H.vx > 0.8) xs.face[i] = 1; else if (H.vx < -0.8) xs.face[i] = -1;
    const state = H.stun > 0 ? 'dizzy' : Math.abs(H.vx) > 4.5 ? 'run' : Math.abs(H.vx) > 0.6 ? 'walk' : 'idle';
    if (!xs.pst) xs.pst = [{ s: '', t0: 0 }, { s: '', t0: 0 }];
    const ps = xs.pst[i];
    if (ps.s !== state) { ps.s = state; ps.t0 = view.time; }
    p.x = H.x; p.y = groundY(W, H.x); p.z = FIGHTER_Z;
    p.facing = xs.face[i] > 0 ? RIGHT : LEFT;
    p.state = state; p.st = Math.round((view.time - ps.t0) * 60); p.move = null; p.mf = 0; p.af = -1; p.mv = {}; p.va = ZERO6;
    p.hitlag = 0; p.grounded = true; p.vx = H.vx; p.vy = 0; p.vz = 0; p.kx = p.ky = p.kz = 0;
    p.invuln = 0; p.intangible = 0; p.launchKb = 0; p.shieldStun = 0; p.out = false; p.grabbedBy = -1; p.speedMul = 1; p.emote = null;
    // les réactions (exagérées) : il danse quand il attrape un sac ou gifle Pandrezz, pleure quand on le vole, trépigne
    // quand Pandrezz pioche dans son chapeau
    const r = xs.react && xs.react[i], P = M.g.pan;
    if (H.stun <= 0 && r && view.time - r.t0 < r.life) { p.emote = r.e; p.emoteT = view.time - r.t0; }
    else if (H.stun <= 0 && P.tgt === i && P.ph === 'steal') { p.emote = 'angry_01'; p.emoteT = P.t / 60; }
    return p;
  },

  enter3D(view, W, M) {
    if (!S3) S3 = build();
    const S = S3;
    view.mv.root.add(S.group);
    Object.assign(view.xs, { pop: [0, 0], shown: [0, 0], joyT: 0, bubble: null, sayT: -9, dropT: 0, slapT: 0, slapX: 0, camKick: 0, tapT: 0, lastSteal: [0, 0], react: [null, null], hpop: [0, 0], headB: null, headW: null });
    if (view.xs.actor) view.xs.actor.dispose();
    view.xs.actor = sceneActor(view.mv.root, 'pandrezz');
    HEADS = [M.a, M.v].map((sl) => { const V = view.mv.views[sl], R = V && V.rigModel; return (R && R.rig && R.rig.bones && R.rig.bones.head) || null; });
    for (const o of [...S.coins, ...S.curses, ...S.skulls, ...S.bags, ...S.shadows, ...S.ground, ...S.flyers]) o.visible = false;
    S.slap.visible = false;
    for (let i = 0; i < 2; i++) {
      const F = W.fighters[i === 0 ? M.a : M.v], V = view.mv.views[F.slot], p = this.proxy(view, F, W, M);
      if (V && p && p !== 'hide') V.snapTo(p);
    }
    sayPan(view, 'IL PLEUT DES SOUS !', 1.4);
  },

  exit3D(view) {
    if (S3) view.mv.root.remove(S3.group);
    if (view.xs.actor) { view.xs.actor.dispose(); view.xs.actor = null; }
    for (const hb of HEADS) if (hb) hb.scale.setScalar(1);
    HEADS = [];
  },

  update3D(view, W, M, dt) {
    const S = S3, g = M.g, xs = view.xs, t = view.time, P = g.pan, cam = view.R.camera;
    const gy = groundY(W, g.gx);
    // la caméra : de face, assez loin pour voir le sol et Pandrezz dans le ciel ; elle s'approche un peu à chaque baffe
    xs.camKick = Math.max(0, (xs.camKick || 0) - dt * 2.5);
    const sh = view.jx.shake * view.jx.shake * 0.25;
    const fx = P.tgt >= 0 && P.ph !== 'sky' ? (g.hats[P.tgt].x - g.gx) * 0.12 : 0;
    cam.position.set(g.gx + fx + Math.sin(t * 0.4) * 0.25 + (Math.random() - 0.5) * sh, gy + 3.8 - xs.camKick * 0.5 + (Math.random() - 0.5) * sh, 12.6 - xs.camKick * 1.6);
    cam.lookAt(g.gx + fx * 1.2, gy + 3.35 - xs.camKick * 0.4, 0);
    cam.updateMatrixWorld();
    // les plateformes flottantes de l'arène gênent la vue du ciel : cachées le temps du jeu (l'arène les remet toute seule)
    const SV = view.mv.stageView;
    if (SV && SV.surfaces) for (let k = 1; k < SV.surfaces.length; k++) if (SV.surfaces[k]) SV.surfaces[k].visible = false;
    // les chapeaux
    for (let i = 0; i < 2; i++) {
      const H = g.hats[i], o = S.hats[i], u = o.userData;
      u.squash = Math.max(0, u.squash - dt * 5);
      u.n += (H.n - u.n) * Math.min(1, dt * 10);
      u.tilt += (-H.vx * 0.025 - u.tilt) * Math.min(1, dt * 10);
      o.position.set(H.x, groundY(W, H.x), HAT_Z);
      o.rotation.z = u.tilt + (H.stun > 0 ? Math.sin(t * 40) * 0.12 : 0);
      o.scale.set(1 + u.squash * 0.25, 1 - u.squash * 0.3, 1 + u.squash * 0.25);
      const h = Math.min(0.72, 0.02 + u.n * 0.024);
      u.pile.scale.y = h; u.pile.position.y = 0.06 + h / 2;
      const hh = Math.max(0, Math.min(0.75, (u.n - 30) * 0.03));
      u.heap.visible = hh > 0.02; u.heap.scale.set(1, hh, 1); u.heap.position.y = 0.8 + hh / 2;
      // la cible de Pandrezz : un anneau rouge qui clignote, un « ! » qui rebondit
      const tgt = P.tgt === i && (P.ph === 'warn' || P.ph === 'dive' || P.ph === 'steal');
      u.ring.material.opacity = tgt ? 0.35 + 0.35 * Math.sin(t * 18) : 0;
      u.ring.scale.setScalar(tgt && P.ph === 'warn' ? 1.6 - (P.t / COINS.WARN) * 0.6 : 1);
      u.alert.visible = tgt && P.ph === 'warn';
      u.alert.position.set(0, 2.9 + Math.abs(Math.sin(t * 9)) * 0.35, 0.2);
    }
    // les pièces qui tombent
    let nc = 0, nk = 0, nb = 0, ns = 0;
    for (const c of g.coins) {
      const gyc = groundY(W, c.x), y = gyc + c.y;
      if (c.k === 0 && nc < S.coins.length) { const m = S.coins[nc++]; m.visible = true; m.position.set(c.x, y, 0); m.rotation.set(Math.PI / 2, t * 6 + c.id, 0); }
      else if (c.k === 1 && nb < S.bags.length) { const s = S.bags[nb++]; s.visible = true; s.position.set(c.x, y + 0.1, 0); s.material.rotation = Math.sin(t * 8 + c.id) * 0.3; }
      else if (c.k === 2 && nk < S.curses.length) {
        const m = S.curses[nk], s = S.skulls[nk]; nk++;
        m.visible = s.visible = true; m.position.set(c.x, y, 0); m.rotation.set(Math.PI / 2, Math.sin(t * 5 + c.id) * 0.5, 0);
        s.position.set(c.x, y, 0.18); s.material.rotation = Math.sin(t * 10 + c.id) * 0.3;
      }
      if (ns < S.shadows.length) { const d = S.shadows[ns++]; d.visible = true; d.position.set(c.x, gyc + 0.02, 0); const k = Math.max(0.35, 1.2 - c.y * 0.1); d.scale.setScalar(k); }
    }
    for (let k = nc; k < S.coins.length; k++) S.coins[k].visible = false;
    for (let k = nb; k < S.bags.length; k++) S.bags[k].visible = false;
    for (let k = nk; k < S.curses.length; k++) S.curses[k].visible = S.skulls[k].visible = false;
    for (let k = ns; k < S.shadows.length; k++) S.shadows[k].visible = false;
    // les pièces tombées par terre : elles brillent un peu puis s'enfoncent
    for (const m of S.ground) if (m.visible) { m.userData.t += dt; const a = m.userData.t; m.scale.setScalar(Math.max(0.01, 1 - Math.max(0, a - 0.9) * 2)); if (a > 1.4) m.visible = false; }
    // les pièces qui volent (Pandrezz qui pioche, ou qui rend)
    for (const f of S.flyers) {
      if (!f.visible) continue;
      const d = f.userData; d.t += dt;
      const u = Math.max(0, Math.min(1, d.t / d.life));
      f.position.set(d.a[0] + (d.b[0] - d.a[0]) * u, d.a[1] + (d.b[1] - d.a[1]) * u + Math.sin(u * Math.PI) * 1.2, d.a[2] + (d.b[2] - d.a[2]) * u);
      f.rotation.set(Math.PI / 2, t * 14, 0);
      if (u >= 1) f.visible = false;
    }
    // Pandrezz, le vrai, géant au-dessus de l'arène : il jubile quand on attrape, ricane quand il vise, plonge la tête la
    // première dans le chapeau (les jambes qui gigotent dehors), part en vrille quand il prend la baffe, puis sonné
    const pp = panPose(P), joy = Math.min(1, (xs.joyT || 0) + P.joy * 0.25);
    xs.joyT = Math.max(0, (xs.joyT || 0) - dt * 1.6);
    const mood = P.ph === 'bonk' ? 3 : (P.ph === 'warn' || P.ph === 'dive' || P.ph === 'steal' || P.ph === 'flee') ? 2 : joy > 0.15 ? 1 : 0;
    const PI = Math.PI, ease = (q) => 1 - (1 - Math.min(1, q)) * (1 - Math.min(1, q));
    // la rotation (autour des hanches) : 0 debout, PI la tête en bas ; la baffe le fait tourner trois demi-tours de plus
    const rt = P.ph === 'dive' ? PI * ease(P.t / (COINS.DIVE * 0.75)) : P.ph === 'steal' ? PI + Math.sin(t * 22) * 0.06
      : P.ph === 'bonk' ? PI + 3 * PI * ease(P.t / COINS.BONK) : P.ph === 'flee' ? PI + PI * ease(P.t / 14) : 0;
    const sc = pp.s * (1 + (P.ph === 'sky' ? joy * 0.08 + (view.beatPop || 0) * 0.02 : 0)), hl = 0.52 * PAN_H * sc;
    const bob = P.ph === 'sky' ? Math.sin(t * 2) * 0.15 + Math.abs(Math.sin(t * 13)) * 0.45 * joy : 0;
    const hx = P.x, hy = gy + P.y + 0.1 - 1.9 * pp.u + bob;
    const Ac = xs.actor;
    if (Ac) {
      Ac.root.position.set(hx + hl * Math.sin(rt), hy - hl * Math.cos(rt), pp.z);
      Ac.root.rotation.set(0, 0, rt);
      Ac.root.scale.set(sc * (P.ph === 'steal' ? 1 + Math.sin(t * 30) * 0.04 : 1), sc * (P.ph === 'steal' ? 1 - Math.sin(t * 30) * 0.04 : 1), sc);
      let o;
      if (P.ph === 'sky') o = joy > 0.65 ? { emote: 'victory_celebration', emoteSpeed: 1.3 } : joy > 0.15 ? { emote: 'cheer', emoteSpeed: 1.2 } : { state: 'idle' };
      else if (P.ph === 'warn') o = { emote: 'laugh_02', tint: '#ff1a1a', tintK: 0.07 + 0.06 * Math.sin(t * 16) };
      else if (P.ph === 'dive') o = { state: 'air', vy: -12, tint: '#ff1a1a', tintK: 0.08 };
      else if (P.ph === 'steal') o = { state: 'run' }; // tête dans le chapeau : les jambes pédalent dehors
      else if (P.ph === 'bonk') o = P.t < 18 ? { state: 'hitstun', kb: 160, tint: '#9ab8ff', tintK: 0.35 } : { state: 'dizzy' };
      else o = { emote: 'laugh_01', emoteSpeed: 1.4 };
      o.face = 'front';
      o.head = HEAD * (1 + (mood === 1 ? joy * 0.25 + Math.abs(Math.sin(t * 9)) * 0.1 * joy : mood === 3 ? 0.15 : 0) + (view.beatPop || 0) * 0.04);
      Ac.pose(o);
      if (!xs.headB) xs.headB = Ac.root.getObjectByName('head') || null;
    }
    // la tête (pour les yeux, l'émoji, la bulle) : l'os de la tête, ou à peu près
    let hp = null;
    _uv.set(-Math.sin(rt), Math.cos(rt), 0);
    if (xs.headB) { Ac.root.updateMatrixWorld(true); hp = xs.headB.getWorldPosition(_hv); _uv.set(0, 1, 0).applyQuaternion(xs.headB.getWorldQuaternion(_hq)); } else hp = _hv.set(hx, hy + hl * 0.9, pp.z);
    const up = Math.cos(rt) > 0.6, hs = PAN_H * sc * HEAD;
    xs.headW = [hp.x + _uv.x * hs * 0.1, hp.y + _uv.y * hs * 0.1, hp.z];
    _cv.copy(cam.position).sub(hp).normalize();
    S.eyes.visible = up && (mood === 1 || mood === 2);
    if (S.eyes.visible) {
      S.eyes.material.map = eyesTex(mood);
      S.eyes.position.copy(hp).addScaledVector(_cv, hs * 0.075).addScaledVector(_uv, hs * 0.145);
      const k = hs * 0.085 * (1 + (mood === 1 ? Math.abs(Math.sin(t * 10)) * 0.25 : 0));
      S.eyes.scale.set(k * 2, k, 1);
    }
    S.moodS.visible = mood !== 0 || joy > 0.05;
    S.moodS.material.map = emojiTex(['😊', '🤑', '😈', '😵‍💫'][mood]);
    S.moodS.position.set(hp.x + _uv.x * hs * 0.17 + hs * 0.12, hp.y + _uv.y * hs * 0.17, hp.z + 0.4); S.moodS.scale.setScalar(hs * 0.07 * (1 + Math.abs(Math.sin(t * 6)) * 0.15));
    // l'auréole et les rayons, derrière lui (à sa poitrine), éteints quand il est dans un chapeau
    S.pan.position.set(hx, hy + hl * 0.45 * Math.cos(rt), pp.z - 0.6);
    S.aura.scale.setScalar(sc * 2.6 + Math.sin(t * 4) * 0.2); S.aura.material.color.set(mood === 2 ? '#ff3a3a' : mood === 3 ? '#8ab0ff' : '#ffd23a');
    S.aura.material.opacity = 0.25 + 0.55 * pp.u;
    S.rays.scale.setScalar(sc * 2.3 * (1 + joy * 0.2)); S.rays.material.rotation = t * 0.5; S.rays.material.opacity = (mood === 2 ? 0.1 : 0.2 + joy * 0.25) * pp.u;
    S.rays.material.color.set(mood === 2 ? '#ff6a6a' : '#ffffff');
    // les deux joueurs : grosse tête (qui gonfle quand ils attrapent)
    for (let i = 0; i < 2; i++) {
      const hb = HEADS[i];
      if (!hb) continue;
      xs.hpop[i] = Math.max(0, xs.hpop[i] - dt * 3);
      hb.scale.setScalar(1.35 + xs.hpop[i] * 0.45);
    }
    // la main qui gifle
    xs.slapT = Math.max(0, (xs.slapT || 0) - dt);
    S.slap.visible = xs.slapT > 0;
    if (S.slap.visible) {
      const u = 1 - xs.slapT / 0.35;
      S.slap.position.set(xs.slapX - 1.2 + u * 1.4, groundY(W, xs.slapX) + 1.6 - u * 0.2, 0.9);
      S.slap.material.rotation = -0.8 + u * 1.6; S.slap.scale.setScalar(1.1 + Math.sin(u * Math.PI) * 0.5);
    }
  },

  draw(view, W, M, dt) {
    const ctx = view.g, g = M.g, xs = view.xs, t = view.time, P = g.pan, T = -view.oy, B = 360 + view.oy;
    if (!xs.pop) return;
    // le chrono (le titre est en bas)
    view.timer(M, 320, T + 22);
    view.text('🎩 LA PLUIE DE PANDREZZ', -view.ox + 8, B - 12, 11, '#ffc61a', { title: true, align: 'left' });
    // les deux scores (portrait, nom, pièces)
    for (let i = 0; i < 2; i++) {
      const H = g.hats[i], slot = i === 0 ? M.a : M.v, left = i === 0, x = left ? 70 - view.ox * 0.3 : 570 + view.ox * 0.3;
      xs.pop[i] = Math.max(0, xs.pop[i] - dt * 4);
      if (xs.shown[i] !== H.n) { if (H.n > xs.shown[i]) xs.pop[i] = 1; xs.shown[i] = H.n; }
      const lead = H.n > g.hats[1 - i].n;
      view.panel(x - 58, T + 8, 116, 54, 'rgba(14,6,22,0.86)', lead ? '#ffc61a' : COLORS[slot]);
      view.portraitAt(W.fighters[slot].char, x - 34, T + 35, 34, COLORS[slot], !left);
      view.text(view.pname(slot), x + 18, T + 20, 10, COLORS[slot], { mono: true });
      const sc = 1 + xs.pop[i] * 0.5;
      coinIcon(ctx, x - 2, T + 42, 7 * sc, t);
      view.text(String(H.n), x + 8, T + 42, 20 * sc, lead ? '#ffe24a' : '#ffffff', { mono: true, align: 'left' });
      if (lead) view.text('👑', x - 34, T + 12 + Math.sin(t * 6) * 2, 14, '#fff', { stroke: false });
      // au-dessus du chapeau : le nom, le combo
      const [hx, hy] = proj(view, H.x, groundY(W, H.x) + 2.4, HAT_Z);
      view.text(view.pname(slot), hx, hy, 11, COLORS[slot], { mono: true });
      if (H.combo >= 3 && M.t - H.ct < 50) view.text(`x${H.combo} ${H.combo >= 8 ? '🔥🔥' : '🔥'}`, hx, hy - 15, 11 + Math.min(8, H.combo), '#ffe24a', { mono: true });
    }
    // la bulle de Pandrezz
    const pp = panPose(P), hw = xs.headW, [px, py] = hw ? proj(view, hw[0], hw[1] + pp.s * 0.35, hw[2]) : proj(view, P.x, (P.y + groundY(W, g.gx)) + pp.s * 0.5, pp.z);
    const b = xs.bubble;
    if (b) {
      b.t += dt;
      if (b.t > b.life) xs.bubble = null;
      else {
        const sc = b.t < 0.1 ? 0.6 + b.t * 4 : 1, a = Math.min(1, (b.life - b.t) / 0.2);
        ctx.save(); ctx.globalAlpha = a; ctx.translate(Math.min(560, Math.max(80, px + 74)), Math.max(T + 74, py - 8)); ctx.scale(sc, sc); ctx.rotate(-0.04);
        ctx.font = "13px 'Arial Black', Impact, sans-serif";
        const w = ctx.measureText(b.text).width + 18;
        ctx.fillStyle = '#0b0610'; ctx.fillRect(-w / 2 - 2, -14, w + 4, 28);
        ctx.beginPath(); ctx.moveTo(-w / 2 + 6, 10); ctx.lineTo(-w / 2 - 12, 22); ctx.lineTo(-w / 2 + 18, 10); ctx.fill();
        ctx.fillStyle = P.ph === 'bonk' ? '#bcd4ff' : (P.ph === 'sky' ? '#fff6c0' : '#ffb0b0'); ctx.fillRect(-w / 2, -12, w, 24);
        view.text(b.text, 0, 0, 13, '#0b0610', { mono: true, stroke: false });
        ctx.restore();
      }
    }
    // l'alerte : il vise quelqu'un, puis le gros « TAPE ! » quand il est à portée de baffe
    if (P.tgt >= 0 && (P.ph === 'warn' || P.ph === 'dive' || P.ph === 'steal')) {
      const H = g.hats[P.tgt], slot = P.tgt === 0 ? M.a : M.v, [hx, hy] = proj(view, H.x, groundY(W, H.x) + 1, HAT_Z);
      const open = (P.ph === 'dive' && P.t >= COINS.DIVE - COINS.OPEN) || P.ph === 'steal';
      if (P.ph === 'warn') {
        const u = P.t / COINS.WARN;
        ctx.save(); ctx.translate(320, 152); ctx.rotate(Math.sin(t * 20) * 0.02);
        ctx.fillStyle = '#0b0610'; ctx.fillRect(-150, -15, 300, 30); ctx.fillStyle = Math.sin(t * 16) > 0 ? '#d01020' : '#ff3a3a'; ctx.fillRect(-147, -12, 294, 24);
        view.text(`⚠ PANDREZZ VISE ${view.pname(slot)} ! PRÉPARE A`, 0, 0, 12, '#ffffff', { mono: true, stroke: false });
        ctx.fillStyle = '#ffe24a'; ctx.fillRect(-147, 10, 294 * (1 - u), 2);
        ctx.restore();
      } else if (open) {
        const k = 1 + Math.abs(Math.sin(t * 18)) * 0.25;
        ctx.save(); ctx.translate(hx, hy - 70); ctx.scale(k, k); ctx.rotate(Math.sin(t * 30) * 0.08);
        ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ff2a2a'; ctx.beginPath(); ctx.arc(0, 0, 23, 0, Math.PI * 2); ctx.fill();
        view.text('A', 0, 1, 26, '#ffffff', { mono: true });
        ctx.restore();
        view.text('TAPE-LE !', hx, hy - 106, 18, Math.sin(t * 20) > 0 ? '#ffe24a' : '#ffffff', { title: true });
      }
    }
    // le butin de Pandrezz
    if (P.loot > 0 || P.stolen > 0) {
      view.panel(250, B - 30, 140, 22, 'rgba(60,8,20,0.88)', '#ff5a5a');
      view.text(`Butin de Pandrezz : ${P.loot + P.stolen}`, 312, B - 19, 10, '#ffd0d0', { mono: true, stroke: false });
      coinIcon(ctx, 378, B - 19, 5, t);
    }
  },

  onEvent(view, ev, W, M) {
    const A = view.audio, xs = view.xs, g = M && M.g;
    if (!g || !ev.type.startsWith('mgCoin')) return;
    const P = g.pan;
    const at = (x, dy = 1) => proj(view, x, groundY(W, x) + dy, HAT_Z);
    const react = (i, e, life) => { if (xs.react) xs.react[i] = { e, t0: view.time, life }; };
    const hpop = (i, k) => { if (xs.hpop) xs.hpop[i] = Math.max(xs.hpop[i], k); };
    switch (ev.type) {
      case 'mgCoinCatch': {
        const [x, y] = at(ev.x, 1.1), H = S3 && S3.hats[ev.p];
        if (H) H.userData.squash = ev.k === 1 ? 1 : 0.6;
        popScore(view, ev.p);
        xs.joyT = Math.min(1.4, (xs.joyT || 0) + (ev.k === 1 ? 1 : 0.45));
        hpop(ev.p, ev.k === 1 ? 1 : 0.35);
        if (ev.k === 1) react(ev.p, 'cheer', 1.1);
        else if (ev.bonus) react(ev.p, 'victory_celebration', 1.2);
        view.burst(x, y, ev.k === 1 ? 30 : 10, GOLD, { shape: ev.k === 1 ? 'star' : 'sq', speed: ev.k === 1 ? 260 : 150, size: 4, up: 120, life: 0.6 });
        view.mv.particles.sparks(ev.x, groundY(W, ev.x) + 0.9, HAT_Z, ev.k === 1 ? 20 : 6, '#ffe24a', 6, 0.35);
        if (ev.k === 1) {
          view.sticker(view.pick(['JACKPOT 💰 +5', 'SAC D\'OR +5', 'RICHE !! +5']), x, y - 36, { size: 20, color: '#0b0610', bg: '#ffe24a', life: 0.9 });
          view.jolt(0.6, 0.06, '#ffe24a', 0.25); view.hype(0.4); view.emojiRain(['💰', '💸', '🤑'], 8);
          sayPan(view, view.pick(['QUEL SAC !', 'JACKPOT !!', 'JE PLEURE DE JOIE !']), 1);
          if (A) { A.sfx('cash', 0, 0.9, 3); A.sfx('airhorn', 0, 0.35); }
        } else {
          view.floats.push({ text: '+1', x: x + (Math.random() - 0.5) * 16, y: y - 18, t: 0, life: 0.6, color: '#ffe24a', size: 13 });
          if (A) A.sfx('cash', 0, 0.45, 1 + Math.min(7, ev.combo));
          if (view.time - xs.sayT > 1.3 && Math.random() < 0.6) { xs.sayT = view.time; sayPan(view, view.pick(JOY), 0.8); }
        }
        if (ev.bonus) {
          view.sticker(`COMBO x${ev.combo} +${ev.bonus} 🔥`, x, y - 56, { size: 16, color: '#ffffff', bg: '#ff5a1a', life: 0.8 });
          view.hype(0.3); view.jolt(0.3, 0.03);
          if (A) { A.sfx('pop', 0, 0.6, 1 + Math.min(6, ev.combo / 5)); A.sfx('cowbell', 0, 0.5); }
        }
        if (A && view.time - (xs.voiceT || -9) > 2.6 && (ev.k === 1 || ev.combo >= 5)) { xs.voiceT = view.time; A.say(view.pick(['Ouiii !', 'Encore !', 'Magnifique !']), 0.85, 1.25); }
        break;
      }
      case 'mgCoinCurse': {
        const [x, y] = at(ev.x, 1.1), H = S3 && S3.hats[ev.p];
        if (H) H.userData.squash = 1;
        view.burst(x, y, 24, ['#8a3ad0', '#d07aff', '#0b0610'], { speed: 220, size: 5, life: 0.6 });
        view.burst(x, y, 4, ['#fff'], { shape: 'txt', ch: '💀', speed: 140, size: 10, up: 100, life: 0.9 });
        hpop(ev.p, 0.8);
        view.sticker(`MAUDITE ! -${ev.lost} 💀`, x, y - 40, { size: 18, color: '#ffffff', bg: '#6a1aa0', life: 0.9 });
        view.jolt(0.6, 0.04, '#8a3ad0', 0.3);
        view.mv.particles.sparks(ev.x, groundY(W, ev.x) + 0.9, HAT_Z, 14, '#c07aff', 7, 0.4);
        sayPan(view, view.pick(['HA HA ! LA MAUDITE !', 'OUPS ! 😂', 'PAS CELLE-LÀ !']), 1);
        if (A) { A.sfx('zapS', 0, 0.8); A.sfx('error', 0, 0.5); A.sfx('wobble', 0, 0.5); }
        break;
      }
      case 'mgCoinDrop': {
        const [x, y] = at(ev.x, 0.05);
        view.burst(x, y, 4, ev.k === 2 ? ['#8a3ad0', '#d07aff'] : ['#ffe24a', '#c09020'], { speed: 80, size: 3, up: 80, life: 0.4 });
        if (S3 && ev.k !== 1) { const m = S3.ground.find((o) => !o.visible) || S3.ground[0]; m.visible = true; m.material = ev.k === 2 ? S3.curses[0].material : S3.coins[0].material; m.position.set(ev.x, groundY(W, ev.x) + 0.03, 0); m.rotation.set(0, Math.random() * 6, (Math.random() - 0.5) * 0.3); m.scale.setScalar(1); m.userData.t = 0; }
        if (A && view.time - (xs.dropT || 0) > 0.12) { xs.dropT = view.time; A.sfx('clink', 0, 0.18, 1 + ((Math.random() * 4) | 0)); }
        break;
      }
      case 'mgCoinBump': {
        const [x, y] = at(ev.x, 0.6);
        view.burst(x, y, 8, ['#ffffff', '#ffe24a'], { shape: 'star', speed: 140, size: 3, life: 0.35 });
        if (Math.random() < 0.4) view.sticker(view.pick(['BONK', 'POUSSE-TOI !', 'HÉ !']), x, y - 30, { size: 12, color: '#ffffff', life: 0.5 });
        if (A && view.time - (xs.bumpT || 0) > 0.25) { xs.bumpT = view.time; A.sfx('boing', 0, 0.35, 1 + ((Math.random() * 3) | 0)); }
        view.jolt(0.15, 0.01);
        break;
      }
      case 'mgCoinWhiff': {
        const [x, y] = at(ev.x, 1.4);
        view.sticker(view.pick(['DANS LE VIDE 💨', 'RATÉ !', 'TROP TÔT !']), x, y - 30, { size: 14, color: '#ffffff', bg: '#5a4a6a', life: 0.7 });
        view.burst(x, y, 6, ['#ffffff', '#c8bad8'], { shape: 'dot', speed: 120, size: 4, life: 0.4 });
        if (A) { A.sfx('whoosh', 0, 0.6); A.sfx('error', 0, 0.3); }
        break;
      }
      case 'mgCoinWarn': {
        sayPan(view, view.pick(EVIL), 1.4);
        react(ev.p, 'complain_01', 0.8);
        view.jolt(0.35, 0.03, '#ff2020', 0.15);
        const [x, y] = at(ev.x, 2.6);
        view.sticker('⚠ ATTENTION', x, y - 20, { size: 16, color: '#ffffff', bg: '#d01020', life: 0.8 });
        if (A) { A.sfx('charge', 0, 0.6); A.say(view.pick(['Hé hé hé...', 'Hmm, des sous...', 'Je prends juste un peu...']), 0.35, 0.9); }
        break;
      }
      case 'mgCoinDive':
        view.lines(0.4); view.jolt(0.3, 0.04);
        if (A) { A.sfx('whoosh', 0, 0.9); A.sfx('zip', 0, 0.5); }
        break;
      case 'mgCoinLand': {
        const [x, y] = at(ev.x, 0.9), H = S3 && S3.hats[ev.p];
        if (H) H.userData.squash = 1;
        view.jolt(0.55, 0.05); view.burst(x, y, 16, ['#c8b6a0', '#ffffff'], { shape: 'dot', speed: 160, size: 5, life: 0.5 });
        view.mv.particles.dust(ev.x, groundY(W, ev.x) + 0.2, HAT_Z, 8, '#b9b3a6', 1);
        sayPan(view, view.pick(['À MOI LES SOUS !', 'JE ME SERS !', 'MIAM MIAM MIAM']), 1.2);
        if (A) A.sfx('thud', 0, 0.8);
        break;
      }
      case 'mgCoinSteal': {
        const [x, y] = at(ev.x, 1.2);
        const pp = panPose(P);
        if (!ev.gulp) flyCoin(view, ev.x, groundY(W, ev.x) + 0.9, HAT_Z, P.x, groundY(W, ev.x) + P.y + 0.6, pp.z, 0.3);
        view.floats.push({ text: ev.gulp ? 'GLOUP !' : '-1', x: x + (Math.random() - 0.5) * 20, y: y - 10, t: 0, life: 0.7, color: '#ff4a4a', size: ev.gulp ? 14 : 16 });
        view.burst(x, y - 10, 5, GOLD, { speed: 110, size: 3, up: 160, life: 0.4 });
        popScore(view, ev.p);
        if (A) { A.sfx(ev.gulp ? 'gulp' : 'slurp', 0, 0.55, 1 + (ev.n % 4)); A.sfx('cash', 0, 0.25, 1); }
        if (ev.n === 3) view.sticker('IL SE SERT !!', x, y - 50, { size: 16, color: '#ffffff', bg: '#d01020', life: 0.7 });
        break;
      }
      case 'mgCoinSlap': {
        const [x, y] = at(ev.x, 1.4), H = S3 && S3.hats[ev.p];
        if (H) H.userData.squash = 0.8;
        xs.slapT = 0.35; xs.slapX = ev.x; xs.camKick = 1;
        react(ev.p, view.pick(['victory_celebration', 'dance_02', 'cheer']), 1.4); hpop(ev.p, 1);
        sayPan(view, view.pick(BONK), 1.2);
        view.sticker(ev.quick ? view.pick(['PAF ! PILE À TEMPS', 'BAFFE PARFAITE ✋', 'REFLEXES DE CHAT']) : view.pick(['PAF !', 'BIEN FAIT !', 'BAS LES PATTES !']), x, y - 50, { size: 26, color: '#ffffff', bg: '#ff2a6a', life: 1 });
        view.burst(x, y, 40, ['#ffe24a', '#ffffff', '#ff5a8a'], { shape: 'star', speed: 320, size: 6 });
        view.burst(x, y, 6, ['#fff'], { shape: 'txt', ch: view.pick(['✋', '💥', '⭐']), speed: 220, size: 12, life: 0.9 });
        view.jolt(1, 0.1, '#ffffff', 0.35); view.lines(0.35); view.hype(0.6);
        view.R.kick('flash', 0.3, { color: '#ffffff' });
        view.mv.particles.sparks(ev.x, groundY(W, ev.x) + 1.4, HAT_Z + 0.3, 24, '#ffffff', 9, 0.4);
        if (ev.back > 0) {
          view.floats.push({ text: `+${ev.back + COINS.BONUS} RENDUS !`, x, y: y - 80, t: 0, life: 1.1, color: '#7cff8a', size: 16 });
          for (let k = 0; k < Math.min(6, ev.back + COINS.BONUS); k++) flyCoin(view, P.x, groundY(W, ev.x) + 2, HAT_Z, ev.x, groundY(W, ev.x) + 0.9, HAT_Z, 0.35, k * 0.06);
        } else view.floats.push({ text: `+${COINS.BONUS} PRIME !`, x, y: y - 80, t: 0, life: 1, color: '#7cff8a', size: 15 });
        popScore(view, ev.p);
        if (A) { A.sfx('slap', 0, 1); A.sfx('punchHeavy', 0, 0.7); A.sfx('cash', 0, 0.6, 2); A.say(view.pick(['Aïe !', 'Ouille !', 'Pardon !']), 0.9, 1.3); }
        break;
      }
      case 'mgCoinFlee': {
        const [x, y] = at(ev.x, 1.4);
        sayPan(view, ev.n > 0 ? view.pick(FLED) : 'RADIN !', 1.2);
        if (ev.n > 0) {
          react(ev.p, 'sob', 1.6);
          view.sticker(`VOLÉ ! -${ev.n} PIÈCE${ev.n > 1 ? 'S' : ''}`, x, y - 40, { size: 20, color: '#ffffff', bg: '#a00010', life: 1 });
          view.jolt(0.5, 0.04, '#ff0000', 0.2);
          if (A) { A.sfx('sob', 0, 0.5); A.sfx('whoosh', 0, 0.6); A.say(view.pick(['Merci !', 'Hé hé !']), 0.4, 1.1); }
          view.burst(x, y, 3, ['#fff'], { shape: 'txt', ch: '😭', speed: 100, size: 10, up: 80, life: 1 });
        } else if (A) A.sfx('wobble', 0, 0.5);
        break;
      }
      default: break;
    }
  },
};
