// La vapoteuse de J'san (vape), l'affichage : le salon de J'san en 3D (fait en code, loin de l'arène : quelques boîtes,
// des matières Lambert un peu lumineuses d'elles-mêmes pour ne pas dépendre de l'éclairage de l'arène), vu d'une caméra
// fixe. Chaque meuble est posé là où la simulation a son cadre à l'écran (VAPE.SPOTS) : on retrouve le point du sol
// sous le bas du cadre (un rayon depuis la caméra) et on lui donne la taille du cadre. J'san (son vrai modèle) cherche,
// râle, puis danse quand on la trouve. Par-dessus, sur le canevas : les deux mains (à la couleur des joueurs), le meuble
// survolé, les croix des meubles déjà soulevés, les scores, la bulle de J'san.
import * as THREE from 'three';
import { COLORS } from '../../sim/constants.js';
import { VAPE, spotAt } from '../../sim/mg/vape.js';
import { sceneActor } from '../puppets.js';
import { glowTex } from '../materials.js';

const C = VAPE;
const O = new THREE.Vector3(600, 0, 0); // le salon : loin de l'arène
const CAM_P = new THREE.Vector3(0, 4.4, 8.6), CAM_L = new THREE.Vector3(0, 0.9, -0.5);
const NAMES = ['l\'étagère', 'le lampadaire', 'la télé', 'la plante', 'le canapé', 'la table', 'le fauteuil', 'la poubelle', 'le linge sale'];
const JSAN_AT = [458, 200]; // où se tient J'san (à l'écran, ses pieds)
const LOST = ['OÙ EST MA VAPE ?!', 'Quelqu\'un a vu ma vapoteuse ?', 'Elle était là y\'a 2 min...', 'J\'ai besoin d\'une taffe...', 'Saveur mangue glacée, introuvable...'];
const EMPTY = ['RIEN !', 'VIDE !', 'NOPE', 'QUE DALLE', 'PAS LÀ', 'UNE CHAUSSETTE'];
const FOUND = ['MA VAPE ! 😮‍💨', 'MERCI FRÉROT !', 'ENFIN !!', 'LA SAINTE TAFFE'];
let S3 = null;

// --- la scène ------------------------------------------------------------------------------------------------------
const mats = {};
const lam = (c, e = 0.35) => mats[c + e] || (mats[c + e] = new THREE.MeshLambertMaterial({ color: c, emissive: new THREE.Color(c).multiplyScalar(e) }));
function bx(g, w, h, d, c, x, y, z, e) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(c, e)); m.position.set(x, y, z); g.add(m); return m; }
function cyl(g, r0, r1, h, c, x, y, z, e, s = 10) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, s), lam(c, e)); m.position.set(x, y, z); g.add(m); return m; }
function ball(g, r, c, x, y, z, sx = 1, sy = 1, sz = 1, e) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), lam(c, e)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); g.add(m); return m; }

// les meubles, (W, H, D) en mètres, l'origine au milieu du bas
const BUILD = [
  (g, W, H, D) => { // l'étagère
    bx(g, W, H, 0.06, '#3a2418', 0, H / 2, -D / 2 + 0.03); // (creuse : le fond, les côtés, le dessus)
    bx(g, 0.08, H, D, '#5a3a2a', -W / 2 + 0.04, H / 2, 0); bx(g, 0.08, H, D, '#5a3a2a', W / 2 - 0.04, H / 2, 0); bx(g, W, 0.08, D, '#5a3a2a', 0, H - 0.04, 0);
    const books = ['#c85a5a', '#5a8ac8', '#e8c05a', '#7ac87a', '#a87ac8', '#e88a4a'];
    for (let r = 0; r < 4; r++) {
      const y = H * (0.08 + r * 0.23);
      bx(g, W * 0.92, 0.06, D * 0.9, '#5a3a2a', 0, y, 0.02);
      for (let k = 0; k < 5; k++) bx(g, W * 0.13, H * 0.15 * (0.7 + ((k + r) % 3) * 0.15), D * 0.6, books[(k + r * 2) % 6], -W * 0.36 + k * W * 0.18, y + 0.03 + H * 0.06, D * 0.12, 0.45);
    }
  },
  (g, W, H, D) => { // le lampadaire
    cyl(g, W * 0.4, W * 0.45, 0.06, '#2a2a32', 0, 0.03, 0);
    cyl(g, 0.03, 0.03, H * 0.8, '#2a2a32', 0, H * 0.4, 0);
    const sh = cyl(g, W * 0.25, W * 0.5, H * 0.22, '#ffd9a0', 0, H * 0.86, 0, 0.9, 12);
    sh.material = new THREE.MeshBasicMaterial({ color: '#ffe0a8' });
  },
  (g, W, H, D) => { // la télé sur son meuble
    bx(g, W, H * 0.38, D, '#4a3040', 0, H * 0.19, 0);
    bx(g, W * 0.86, H * 0.58, 0.12, '#14101c', 0, H * 0.38 + H * 0.31, -D * 0.1);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.78, H * 0.48), new THREE.MeshBasicMaterial({ color: '#3a6ad0' }));
    scr.position.set(0, H * 0.69, -D * 0.1 + 0.065); g.add(scr); g.userData.scr = scr;
    bx(g, W * 0.3, 0.06, 0.25, '#14101c', 0, H * 0.39, -D * 0.1); // le pied
    bx(g, W * 0.18, H * 0.08, D * 0.5, '#2a2a32', -W * 0.25, H * 0.42, D * 0.1); // la console
  },
  (g, W, H, D) => { // la plante
    cyl(g, W * 0.38, W * 0.28, H * 0.34, '#c86a3a', 0, H * 0.17, 0);
    for (let k = 0; k < 5; k++) ball(g, W * 0.28, k % 2 ? '#3a8a3a' : '#5aaa4a', (k - 2) * W * 0.12, H * (0.5 + (k % 3) * 0.14), (k % 2) * 0.05, 0.7, 1.5, 0.7);
  },
  (g, W, H, D) => { // le canapé
    bx(g, W, H * 0.45, D, '#7a3a5a', 0, H * 0.225, 0);
    bx(g, W, H * 0.6, D * 0.25, '#6a2a4a', 0, H * 0.7, -D * 0.38);
    bx(g, W * 0.1, H * 0.7, D, '#6a2a4a', -W * 0.45, H * 0.35, 0); bx(g, W * 0.1, H * 0.7, D, '#6a2a4a', W * 0.45, H * 0.35, 0);
    for (let k = 0; k < 3; k++) bx(g, W * 0.26, H * 0.18, D * 0.6, ['#e8a0c0', '#a0c8e8', '#e8d080'][k], (k - 1) * W * 0.27, H * 0.54, D * 0.05, 0.5);
  },
  (g, W, H, D) => { // la table basse, une tasse, un magazine, une boîte de pizza
    bx(g, W, H * 0.18, D, '#8a5a3a', 0, H * 0.91, 0);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) bx(g, 0.07, H * 0.82, 0.07, '#5a3a2a', x * W * 0.42, H * 0.41, z * D * 0.38);
    cyl(g, 0.07, 0.07, 0.14, '#e8e0f0', W * 0.3, H + 0.07, 0, 0.5);
    bx(g, W * 0.3, 0.04, D * 0.4, '#f4e08a', -W * 0.25, H + 0.02, 0, 0.5);
  },
  (g, W, H, D) => { // le fauteuil
    bx(g, W, H * 0.45, D, '#3a5a7a', 0, H * 0.225, 0);
    bx(g, W, H * 0.65, D * 0.28, '#2a4a6a', 0, H * 0.67, -D * 0.36);
    bx(g, W * 0.16, H * 0.68, D, '#2a4a6a', -W * 0.42, H * 0.34, 0); bx(g, W * 0.16, H * 0.68, D, '#2a4a6a', W * 0.42, H * 0.34, 0);
    bx(g, W * 0.62, H * 0.16, D * 0.6, '#f4c060', 0, H * 0.53, 0.05, 0.5);
  },
  (g, W, H, D) => { // la poubelle
    cyl(g, W * 0.42, W * 0.36, H * 0.86, '#5a6a5a', 0, H * 0.43, 0);
    cyl(g, W * 0.46, W * 0.46, H * 0.1, '#3a4a3a', 0, H * 0.91, 0);
    bx(g, W * 0.3, H * 0.08, 0.06, '#3a4a3a', 0, H * 1.0, 0);
  },
  (g, W, H, D) => { // le linge sale
    const cs = ['#d85a5a', '#5a8ad8', '#e8e0d0', '#7ac87a', '#2a2a32'];
    for (let k = 0; k < 6; k++) ball(g, W * 0.22, cs[k % 5], (k % 3 - 1) * W * 0.25, H * (0.3 + (k > 2 ? 0.4 : 0)), (k % 2 - 0.5) * 0.15, 1.2, 0.6, 1, 0.45);
  },
];

function build(fov) {
  const group = new THREE.Group(); group.position.copy(O);
  // la pièce : sol en parquet, tapis, murs, plinthes, fenêtre de nuit, poster
  bx(group, 22, 0.1, 16, '#6a4a3a', 0, -0.05, -2, 0.3);
  for (let k = -10; k <= 10; k += 1.2) bx(group, 0.03, 0.005, 16, '#4a3020', k, 0.002, -2, 0.2);
  bx(group, 7, 0.02, 3.6, '#7a2a3a', 0.2, 0.01, 1.4, 0.35);
  bx(group, 24, 9, 0.2, '#4a3a6a', 0, 4.5, -4.6, 0.35);
  bx(group, 0.2, 9, 16, '#3e3060', -9.5, 4.5, 2, 0.35); bx(group, 0.2, 9, 16, '#3e3060', 9.5, 4.5, 2, 0.35);
  bx(group, 24, 0.25, 0.1, '#2a2040', 0, 0.12, -4.45);
  bx(group, 2.2, 1.4, 0.05, '#141a3a', -2.2, 3.2, -4.48, 0.6); bx(group, 0.08, 1.4, 0.06, '#2a2040', -2.2, 3.2, -4.46);
  const moon = new THREE.Mesh(new THREE.CircleGeometry(0.2, 12), new THREE.MeshBasicMaterial({ color: '#fff2c8' })); moon.position.set(-2.7, 3.5, -4.44); group.add(moon);
  bx(group, 1.0, 1.4, 0.04, '#ff5a8a', 2.6, 3.1, -4.48, 0.6); bx(group, 0.7, 0.5, 0.05, '#ffe24a', 2.6, 3.3, -4.46, 0.6);
  // la caméra fixe (la même que dans update3D) : de quoi retrouver le sol sous chaque cadre
  const cam = new THREE.PerspectiveCamera(fov, 16 / 9, 0.3, 500);
  cam.position.copy(O).add(CAM_P); cam.lookAt(O.clone().add(CAM_L)); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const floorAt = (gx, gy) => {
    const v = new THREE.Vector3(gx / 320 - 1, 1 - gy / 180, 0.5).unproject(cam).sub(cam.position).normalize();
    const t = (O.y - cam.position.y) / v.y;
    return cam.position.clone().addScaledVector(v, t).sub(O);
  };
  const ppm = (p) => 360 / (2 * p.clone().add(O).distanceTo(cam.position) * Math.tan(fov * Math.PI / 360));
  const spots = C.SPOTS.map(([cx, by, w, h], k) => {
    const p = floorAt(cx, by), s = ppm(p), W = w / s, H = h / s * 0.9, D = Math.min(W * 0.6, 1.3);
    const g = new THREE.Group(); BUILD[k](g, W, H, D);
    g.position.set(p.x, 0, p.z - D / 2); g.userData = { ...g.userData, base: g.position.clone(), H, lift: 0, hold: 0, side: k % 2 ? 1 : -1 };
    group.add(g);
    return g;
  });
  // la vapoteuse : corps, embout, voyant ; et les bouffées
  const vape = new THREE.Group();
  bx(vape, 0.2, 0.55, 0.1, '#1c1c2a', 0, 0.275, 0, 0.3); bx(vape, 0.08, 0.14, 0.06, '#7af0ff', 0, 0.62, 0, 0.7);
  bx(vape, 0.21, 0.1, 0.11, COLORS[2], 0, 0.32, 0, 0.6);
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.02), new THREE.MeshBasicMaterial({ color: '#7cff8a' })); led.position.set(0, 0.16, 0.06); vape.add(led);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: '#7af0ff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 }));
  glow.scale.setScalar(1.4); glow.position.y = 0.35; vape.add(glow);
  vape.visible = false; group.add(vape);
  const puffs = [];
  for (let k = 0; k < 16; k++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: '#e8f4ff', transparent: true, depthWrite: false, opacity: 0 }));
    s.visible = false; s.userData = { t: 0, life: 1, vx: 0, vy: 0, s0: 0.5 }; group.add(s); puffs.push(s);
  }
  return { group, cam, spots, vape, puffs, jsan: floorAt(JSAN_AT[0], JSAN_AT[1]), floorAt };
}

function puff(S, at, n, big = 1) {
  for (let k = 0; k < n; k++) {
    const s = S.puffs.find((o) => !o.visible) || S.puffs[k % S.puffs.length];
    s.visible = true; s.position.set(at.x + (Math.random() - 0.5) * 0.3 * big, at.y + 0.3 + Math.random() * 0.3, at.z + 0.2);
    s.userData = { t: -k * 0.04, life: 1.1 + Math.random() * 0.6, vx: (Math.random() - 0.5) * 0.6 * big, vy: 0.7 + Math.random() * 0.6, s0: (0.5 + Math.random() * 0.5) * big };
  }
}
// un point de la scène (coordonnées du salon) -> la grille 640 x 360
const _v = new THREE.Vector3();
function toGrid(S, x, y, z) { _v.set(x, y, z).add(O).project(S.cam); return [(_v.x + 1) * 320, (1 - _v.y) * 180]; }
const spotTop = (k) => { const s = C.SPOTS[k]; return [s[0], s[1] - s[3]]; };

function xs(view) {
  const X = view.xs;
  if (!X.init) Object.assign(X, { init: 1, say: LOST[0], sayT: 0, sayL: 2.2, voT: -9, joy: 0, mad: 0, pop: [0, 0], hand: [0, 0], end: null });
  return X;
}

export default {
  title: 'LA VAPOTEUSE DE J\'SAN', color: '#7af0ff', icon: '😮‍💨',
  input: 'mouse',
  gray: false,
  goal: 'Mets ta main sur un meuble et soulève-le : trouve la vapoteuse de J\'san !',
  keys: { pad: [['stick', 'bouger la main'], ['A', 'soulever']], kb: [['dirs', 'bouger la main'], ['A', 'soulever']], kb1: [['dirs', 'la main'], ['mouse', 'aussi'], ['A', 'soulever']] },
  ach: [['Renifleur de mangue', 'Meilleur pote de J\'san', 'Détecteur de vapeur', 'Fouilleur d\'élite'], ['Poumons propres', 'A soulevé la poubelle', 'Aveugle du salon', 'Pas de taffe pour toi']],
  news: (L, d) => `${L} FOUILLE LE LINGE SALE DE J'SAN POUR RIEN : ${d} %`,

  // pendant la présentation : le salon, J'san et leurs shaders prêts d'avance (pas d'à-coup à l'ouverture)
  warm(view) {
    if (!S3) S3 = build(view.R.camera.fov);
    view.mv.root.add(S3.group);
    if (view.xs.actorPre) view.xs.actorPre.dispose();
    const a = view.xs.actorPre = sceneActor(view.mv.root, 'jsan');
    view.warm3D([S3.group, a.root]);
    a.root.visible = false; view.mv.root.remove(S3.group);
  },

  enter3D(view, W, M) {
    if (!S3) S3 = build(view.R.camera.fov);
    const S = S3;
    view.mv.root.add(S.group);
    if (view.xs.actor) view.xs.actor.dispose();
    view.xs.actor = view.xs.actorPre || sceneActor(view.mv.root, 'jsan'); view.xs.actorPre = null;
    const a = view.xs.actor;
    a.root.visible = true; a.root.position.copy(O).add(S.jsan); a.root.position.z -= 0.2; a.root.scale.setScalar(1.15);
    S.vape.visible = false;
    for (const s of S.spots) { const u = s.userData; u.lift = 0; u.hold = 0; s.position.copy(u.base); s.rotation.set(0, 0, 0); }
    for (const p of S.puffs) p.visible = false;
    xs(view);
  },

  exit3D(view) {
    if (S3) view.mv.root.remove(S3.group);
    if (view.xs.actor) { view.xs.actor.dispose(); view.xs.actor = null; }
    if (view.xs.actorPre) { view.xs.actorPre.dispose(); view.xs.actorPre = null; }
  },

  update3D(view, W, M, dt) {
    const S = S3, X = xs(view), t = view.time, cam = view.R.camera;
    if (!S) return;
    // la caméra : fixe (les cadres de la simulation restent sous les meubles), à peine secouée
    const sh = view.jx.shake * view.jx.shake * 0.04;
    cam.position.copy(O).add(CAM_P); cam.position.x += (Math.random() - 0.5) * sh; cam.position.y += (Math.random() - 0.5) * sh;
    cam.lookAt(O.x + CAM_L.x, O.y + CAM_L.y, O.z + CAM_L.z); cam.updateMatrixWorld();
    // les meubles soulevés
    for (const s of S.spots) {
      const u = s.userData;
      if (u.hold > 0) u.hold -= dt; else u.lift = Math.max(0, u.lift - dt * 3);
      const e = u.lift < 1 ? u.lift * u.lift * (3 - 2 * u.lift) : 1;
      s.position.set(u.base.x, u.base.y + e * (0.45 + u.H * 0.35), u.base.z);
      s.rotation.z = e * 0.28 * u.side + (u.hold > 0 ? Math.sin(t * 30) * 0.02 : 0);
    }
    if (S.spots[2].userData.scr) S.spots[2].userData.scr.material.color.setHSL(0.6 + Math.sin(t * 0.7) * 0.05, 0.6, 0.35 + 0.1 * Math.sin(t * 5));
    // la vapoteuse trouvée : elle tourne et brille
    if (S.vape.visible) { S.vape.rotation.y += dt * 4; S.vape.position.y = Math.min(S.vape.userData.y1 || 0, S.vape.position.y + dt * 3); }
    for (const p of S.puffs) {
      if (!p.visible) continue;
      const u = p.userData; u.t += dt;
      if (u.t < 0) { p.material.opacity = 0; continue; }
      const k = u.t / u.life;
      if (k >= 1) { p.visible = false; continue; }
      p.position.x += u.vx * dt; p.position.y += u.vy * dt; u.vy *= 0.985;
      p.scale.setScalar(u.s0 * (1 + k * 2.5)); p.material.opacity = 0.75 * (1 - k);
    }
    // J'san : il cherche (râle), sautille de joie quand on la trouve
    const a = view.xs.actor;
    if (a) {
      X.joy = Math.max(0, X.joy - dt); X.mad = Math.max(0, X.mad - dt);
      a.pose(X.joy > 0 ? { emote: 'victory_celebration', face: 'front', head: 1.4 } : X.mad > 0 ? { emote: 'angry_01', face: 'front', head: 1.4 } : { emote: 'complain_01', face: Math.sin(t * 0.9) > 0 ? 'three' : 'threeL', head: 1.4 });
    }
  },

  draw(view, W, M, dt) {
    const ctx = view.g, g = M.g, S = S3;
    if (!g || !g.p) return;
    const X = xs(view), t = view.time, slots = [M.a, M.v];
    X.sayT += dt;
    // la bulle de J'san (au-dessus de sa tête)
    if (S) {
      const [hx, hy] = toGrid(S, S.jsan.x, 2.6, S.jsan.z);
      if (X.sayT < X.sayL) {
        ctx.font = "11px 'Lilita One', 'Trebuchet MS', sans-serif";
        const w = Math.min(220, ctx.measureText(X.say).width + 16), bxx = Math.min(632 - w, Math.max(8, hx - w / 2)), byy = Math.max(46, hy - 30);
        ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.roundRect(bxx - 2, byy - 2, w + 4, 24, 8); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect(bxx, byy, w, 20, 7); ctx.fill();
        ctx.beginPath(); ctx.moveTo(hx - 5, byy + 19); ctx.lineTo(hx + 5, byy + 19); ctx.lineTo(hx, byy + 27); ctx.fill();
        view.text(X.say, bxx + w / 2, byy + 10, 11, '#0b0610', { stroke: false, maxW: w - 8 });
      } else if (X.sayT > X.sayL + 1.6 && g.pause <= 0) { X.say = view.pick(LOST); X.sayT = 0; X.sayL = 2; }
    }
    // les meubles déjà soulevés (cette manche), une croix à la couleur de chacun ; le meuble survolé
    for (let i = 0; i < 2; i++) {
      const P = g.p[i], col = COLORS[slots[i]];
      for (let k = 0; k < C.SPOTS.length; k++) {
        if (!(P.chk & (1 << k))) continue;
        const [x, y] = spotTop(k), ox = i === 0 ? -9 : 9;
        ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.arc(x + ox, y - 6, 7, 0, 7); ctx.fill();
        view.text('✗', x + ox, y - 6, 11, col, { stroke: false });
      }
      if (g.pause > 0) continue;
      const k = spotAt(P.x, P.y);
      if (k >= 0 && !(P.chk & (1 << k))) {
        const [cx, by, w, h] = C.SPOTS[k];
        ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.lineDashOffset = -t * 24 * (i ? -1 : 1);
        ctx.strokeRect(cx - w / 2 - 3, by - h - 3, w + 6, h + 6); ctx.setLineDash([]);
      }
    }
    // les mains
    for (let i = 0; i < 2; i++) {
      const P = g.p[i], col = COLORS[slots[i]], pop = X.pop[i] = Math.max(0, X.pop[i] - dt * 4);
      const x = P.x, y = P.y + (P.lock > 0 ? -Math.sin(P.lock / C.LOOK * Math.PI) * 6 : 0);
      ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.arc(x, y, 11 + pop * 6, 0, 7); ctx.fill();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 9 + pop * 6, 0, 7); ctx.fill();
      view.text(P.lock > 0 ? '✊' : '🖐️', x + 1, y + 1, 14, '#fff', { stroke: false });
      view.text(view.pname(slots[i]), x, y + 19, 9, col, { mono: true });
      // ses touches, collées à sa main : sur un meuble pas encore soulevé, la touche pour le soulever
      const k = g.pause > 0 ? -1 : spotAt(P.x, P.y), over = k >= 0 && !(P.chk & (1 << k)), hx = Math.max(70, Math.min(570, x));
      view.hint(W, M, i, hx, y > 300 ? y - 30 : y + 36, over ? [['A', 'SOULEVER']] : [['dirs', 'bouger'], ['A', 'soulever']], over ? { size: 1.2 } : {});
    }
    // les scores, à côté des étiquettes du haut
    for (let i = 0; i < 2; i++) {
      const P = g.p[i], col = COLORS[slots[i]], x = i === 0 ? 196 : 444;
      ctx.fillStyle = 'rgba(10,6,16,0.85)'; ctx.beginPath(); ctx.roundRect(i === 0 ? x : x - 50, 8, 50, 26, 6); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
      view.text(`😮‍💨 ${P.n}`, i === 0 ? x + 25 : x - 25, 21, 15, '#ffffff', { mono: true });
    }
    view.timer(M, 320, 22);
    view.text(g.pause > 0 ? 'TROUVÉE !' : `MANCHE ${g.round}`, 320, 46, 10, g.pause > 0 ? '#7cff8a' : '#bfe8ff', { mono: true });
  },

  onEvent(view, ev, W, M) {
    if (!M || M.kind !== 'vape' || !M.g || !M.g.p) return;
    if (!ev.type.startsWith('mgVape') && ev.type !== 'mgEnd' && ev.type !== 'mgGo') return;
    const A = view.audio, X = xs(view), S = S3, i = ev.p, pan = i === 0 ? -0.4 : 0.4;
    const say = (s, l = 1.8) => { X.say = s; X.sayT = 0; X.sayL = l; };
    const lift = (k, hold) => { if (S) { const u = S.spots[k].userData; u.lift = 1; u.hold = hold; } };
    switch (ev.type) {
      case 'mgGo':
        say('OÙ EST MA VAPOTEUSE ?!', 2.4);
        view.sticker('CHERCHEZ ! 🔍', 320, 120, { size: 26, color: '#0b0610', bg: '#7af0ff', life: 0.9 });
        if (A) A.say('J\'san a perdu sa vapoteuse ! Cherchez-la !', 0.5, 1.15);
        break;
      case 'mgVapeEmpty': {
        lift(ev.k, 0.25);
        const [x, y] = spotTop(ev.k);
        X.pop[i] = 1;
        view.sticker(view.pick(EMPTY), x, y - 16, { size: 12, color: '#ffffff', bg: COLORS[i === 0 ? M.a : M.v], life: 0.55 });
        view.burst(x, y + 10, 8, ['#c8b090', '#8a7060', '#ffffff'], { shape: 'dot', speed: 80, up: 30, size: 3, life: 0.5 });
        if (ev.k === 7) view.burst(x, y, 3, ['#fff'], { shape: 'txt', ch: view.pick(['🍌', '🧦', '🥫']), speed: 100, up: 80, size: 8, life: 0.8 });
        if (ev.k === 8) view.burst(x, y, 2, ['#fff'], { shape: 'txt', ch: '🧦', speed: 100, up: 80, size: 8, life: 0.8 });
        if (A) { A.sfx(ev.k === 7 ? 'clink' : ev.k === 8 ? 'poof' : 'wood', pan, 0.5); A.sfx('error', pan, 0.15); }
        X.mad = 0.5;
        break;
      }
      case 'mgVapeMiss':
        X.pop[i] = 0.6;
        if (A) A.sfx('click', pan, 0.25);
        break;
      case 'mgVapeAgain': {
        const [x, y] = spotTop(ev.k);
        view.sticker('DÉJÀ VU !', x, y - 16, { size: 10, color: '#0b0610', bg: '#c8bad8', life: 0.4 });
        if (A) A.sfx('click', pan, 0.25, -2);
        break;
      }
      case 'mgVapeFound': {
        lift(ev.k, 0.8);
        const [x, y] = spotTop(ev.k), col = COLORS[i === 0 ? M.a : M.v];
        X.pop[i] = 1; X.joy = 1.8;
        if (S) {
          const b = S.spots[ev.k].userData.base;
          S.vape.visible = true; S.vape.position.set(b.x, 0, b.z + 0.4); S.vape.userData.y1 = 0.5; S.vape.scale.setScalar(1.6);
          puff(S, S.vape.position, 10, 1.6);
        }
        say(view.pick(FOUND), 1.6);
        view.sticker(ev.both ? 'TOUS LES DEUX ?! 😮‍💨' : `${view.pname(i === 0 ? M.a : M.v)} L'A TROUVÉE ! 😮‍💨`, x, Math.max(80, y - 24), { size: 18, color: '#0b0610', bg: col, life: 1.2 });
        view.burst(x, y + 20, 30, ['#7af0ff', '#ffffff', '#ffe24a', col], { shape: 'star', speed: 220, size: 5, life: 0.9 });
        view.burst(x, y + 10, 5, ['#fff'], { shape: 'txt', ch: '💨', speed: 120, up: 90, size: 10, life: 1.1 });
        view.jolt(0.5, 0.06, '#7af0ff', 0.25); view.hype(0.6);
        if (A) { A.sfx('vape', pan, 0.9); A.sfx('cash', pan, 0.5); A.sfx('airhorn', pan, 0.35); if (view.time - X.voT > 1.5) { X.voT = view.time; A.say(view.pick(['Ma vapoteuse !', 'Merci frérot !', 'La sainte taffe !']), 0.6, 1.2); } }
        break;
      }
      case 'mgVapeHide':
        if (S) S.vape.visible = false;
        say(view.pick(['Oups, je l\'ai reperdue...', 'Attends, elle est où là ?', 'Je l\'ai posée où ?!']), 1.8);
        view.sticker(`MANCHE ${ev.r}`, 320, 120, { size: 20, color: '#0b0610', bg: '#ffe24a', life: 0.7 });
        if (A) { A.sfx('whoosh', 0, 0.4); A.sfx('countHi', 0, 0.3); }
        break;
      case 'mgVapeHint': {
        if (S) { const b = S.spots[ev.k].userData.base; puff(S, new THREE.Vector3(b.x, S.spots[ev.k].userData.H * 0.5, b.z + 0.3), 4, 0.8); }
        if (Math.random() < 0.6) say(view.pick(['Ça sent la mangue par là...', '*sniff sniff*', 'Je sens une odeur de fraise...']), 1.4);
        if (A) A.sfx('fizz', 0, 0.25);
        break;
      }
      case 'mgEnd':
        view.emojiRain(['😮‍💨', '💨', '🥭', '🔍'], 10);
        break;
      default: break;
    }
  },
};
