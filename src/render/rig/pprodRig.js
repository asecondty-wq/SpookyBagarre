// PPROD's rig settings and props: the gaming chair under him (F.va[0]) and the laptop on his lap (F.va[1]) for the
// Compilation and the turbo chair (spinning: F.va[2]), coins in the hand (F.va[3]), a pizza in the hand (F.va[4]),
// a plate of spaghetti under his feet while he runs (he slides on it). Chair and laptop: Meshy models where they
// exist (assets/models/props/chair.glb, laptop.glb), simple shapes otherwise. Flags set by src/sim/chars/pprod.js.
import * as THREE from 'three';
import { mat, basic, G, mesh, canvasTex } from '../materials.js';
import { fitProp } from '../propModels.js';
import { PASS_PROPS } from '../passView.js';

const grp = (...c) => { const g = new THREE.Group(); c.forEach((o) => o && g.add(o)); return g; };
const hidden = (o) => { o.visible = false; return o; };

// the middle of the right palm at rest (character space: +X his left, +Y up, +Z forward; A-pose), measured on the rig
const PALM_R = [-0.36, 0.8, 0.02];

// --- the gaming chair: seat top at y = 0 (it sits under the hips), legs and wheels below ---------------------------
function chair() {
  const blk = mat('#1c1c22', { roughness: 0.6 }), gry = mat('#5a5e68', { roughness: 0.5 }), red = mat('#c8202a');
  const shape = grp(
    mesh(G.box(0.52, 0.1, 0.5), blk, [0, -0.05, 0]),
    mesh(G.box(0.5, 0.78, 0.1), blk, [0, 0.38, -0.27], [-0.12, 0, 0]),
    mesh(G.box(0.08, 0.6, 0.12), red, [0.2, 0.36, -0.25], [-0.12, 0, 0]),
    mesh(G.cyl(0.04, 0.04, 0.32, 8), gry, [0, -0.26, 0]),
    ...[0, 1, 2, 3, 4].map((i) => { const a = i / 5 * Math.PI * 2; return mesh(G.box(0.05, 0.04, 0.34), gry, [Math.sin(a) * 0.16, -0.44, Math.cos(a) * 0.16], [0, a, 0]); }),
    ...[0, 1, 2, 3, 4].map((i) => { const a = i / 5 * Math.PI * 2; return mesh(G.ball(0.045, 1), blk, [Math.sin(a) * 0.32, -0.5, Math.cos(a) * 0.32]); }),
  );
  return fitProp('chair', shape);
}
// --- the laptop on his lap: open, the screen toward him, full of green code ---------------------------------------
function codeTex() {
  return canvasTex('pprod_code', 64, (g, s) => {
    g.fillStyle = '#081208'; g.fillRect(0, 0, s, s);
    for (let y = 3; y < s; y += 4) {
      let x = 2 + ((y * 7) % 9);
      while (x < s - 4) { const w = 2 + ((x * 13 + y * 5) % 9); g.fillStyle = ['#3dff6a', '#22c84a', '#9cff5a', '#ff5ad0'][(x + y) % 4]; g.fillRect(x, y, w, 2); x += w + 2; }
    }
  });
}
function laptop() {
  const body = mat('#2c2e36', { roughness: 0.4 });
  const screen = new THREE.MeshBasicMaterial({ map: codeTex() });
  const lid = grp(mesh(G.box(0.38, 0.26, 0.02), body, [0, 0.13, 0]), mesh(new THREE.PlaneGeometry(0.34, 0.22), screen, [0, 0.13, -0.012], [0, Math.PI, 0]));
  lid.position.set(0, 0.012, 0.13); lid.rotation.x = 0.35; // hinged at the back edge, leaning back away from him
  const shape = grp(mesh(G.box(0.38, 0.025, 0.27), body, [0, 0, 0]), lid);
  return fitProp('laptop', shape);
}
// --- in the hand -------------------------------------------------------------------------------------------------
const GOLD = () => mat('#f2c230', { metalness: 0.7, roughness: 0.3, emissive: '#3a2a00' });
function coinsInHand() {
  const m = GOLD();
  return grp(...[0, 1, 2, 3].map((i) => mesh(G.cyl(0.07, 0.07, 0.018, 12), m, [(i % 2) * 0.05 - 0.02, i * 0.022, (i > 1 ? 0.03 : -0.02)], [0.3 * i, 0, 0.2])));
}
function pizzaTex() {
  return canvasTex('pprod_pizza', 128, (g, s) => {
    const c = s / 2;
    g.fillStyle = '#c9862e'; g.beginPath(); g.arc(c, c, c, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#c8321e'; g.beginPath(); g.arc(c, c, c * 0.84, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f6d878';
    for (let i = 0; i < 40; i++) { const a = i * 2.4, r = (i % 7) / 7 * c * 0.78; g.beginPath(); g.arc(c + Math.cos(a) * r, c + Math.sin(a) * r, 9, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#9a1a1a';
    for (let i = 0; i < 9; i++) { const a = i * 0.7 + 0.3, r = c * (0.25 + (i % 3) * 0.2); g.beginPath(); g.arc(c + Math.cos(a) * r, c + Math.sin(a) * r, 8, 0, Math.PI * 2); g.fill(); }
  });
}
export function pizza(s = 1) {
  const top = mat('#ffffff', { map: pizzaTex(), roughness: 0.7 });
  return grp(mesh(G.cyl(0.36 * s, 0.36 * s, 0.05 * s, 20), [mat('#c9862e'), top, mat('#b07024')], [0, 0, 0]));
}
// --- spaghetti: a tangle of noodles and a blob of sauce (the plate he surfs on, the puddles he leaves) -------------
export function noodles(r = 0.55, n = 14) {
  const g = new THREE.Group();
  const nm = mat('#f2cf72', { roughness: 0.5 });
  for (let i = 0; i < n; i++) {
    const pts = [];
    const a0 = i * 2.39, cx = Math.cos(a0) * r * 0.5 * ((i % 4) / 4), cz = Math.sin(a0) * r * 0.5 * ((i % 5) / 5);
    for (let k = 0; k < 6; k++) { const a = a0 + k * 1.1; pts.push(new THREE.Vector3(cx + Math.cos(a) * r * 0.45, 0.03 + (k % 2) * 0.025, cz + Math.sin(a) * r * 0.45)); }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 14, 0.018, 4, false), nm));
  }
  g.add(mesh(G.ball(0.13, 1), mat('#b8241a', { roughness: 0.4 }), [0, 0.04, 0], null, [1.4, 0.35, 1.2]));
  g.add(mesh(G.ball(0.05, 1), mat('#6a3a1e'), [0.06, 0.08, 0.03]));
  return g;
}
function spaghettiPlate() {
  return grp(mesh(G.cyl(0.42, 0.36, 0.04, 20), mat('#f4f4f0', { roughness: 0.3 }), [0, 0.02, 0]), noodles(0.5, 12));
}

// keep a prop under the feet whatever the hips do
const tmp = new THREE.Vector3();
function toFloor(V, o, lift = 0) {
  o.position.set(0, 0, 0);
  tmp.set(V.root.position.x, V.root.position.y + lift, V.root.position.z);
  o.parent.worldToLocal(tmp);
  o.position.copy(tmp);
}

const inMove = (F) => F.state === 'move';
const _mA = new THREE.Vector3(), _mB = new THREE.Vector3(), _mQ = new THREE.Quaternion(), _mQ2 = new THREE.Quaternion();
const on = (F, i) => inMove(F) && (F.va[i] || 0) > 0.5;

export const PPROD_RIG = {
  pprod: {
    h: 1.78, guard: 'boxer', crouch: 0.03, wide: 0.03, lean: 3, stride: 1.0,
    sockets: {
      // the chair under his backside (the seat top a little under the hips joint), the laptop on his thighs where
      // his hands type (measured seated in m_typing: hips 0.67 m up, hands 0.2 m in front of them)
      chair: { bone: 'hips', at: [0, 0.83, -0.06], build: () => hidden(grp(chair())) },
      laptop: { bone: 'hips', at: [0, 0.92, 0.22], build: () => hidden(grp(laptop())) },
      coins: { bone: 'hand.R', at: PALM_R, build: () => hidden(grp(coinsInHand())) },
      pizza: { bone: 'hand.R', at: PALM_R, build: () => { const p = pizza(0.9); p.position.set(0, 0.05, 0.1); return hidden(grp(p)); } },
      plate: { bone: 'hips', at: [0, 0.0, 0], build: () => hidden(spaghettiPlate()) },
      // the big pass: the computer screen held up (side smash), the old PC (side special), what the neutral A throws
      monitor: { bone: 'chest', at: [0, 1.5, 0.3], build: () => { const m = PASS_PROPS.monitor(); m.position.set(0, -0.12, 0.08); return hidden(grp(m)); } }, // held in both hands (placed between them)
      crtpc: { bone: 'hand.R', at: PALM_R, build: () => { const m = PASS_PROPS.crtpc(); m.position.set(0.1, 0.05, 0.15); return hidden(grp(m)); } },
      loot: { bone: 'hand.R', at: PALM_R, build: () => hidden(grp(...['coin', 'coinpile', 'billwad', 'diamond', 'goldbar'].map((k) => PASS_PROPS[k]()))) },
    },
    reach: { far: 0.85, moves: { ftilt: true, ftilt2: true, ftilt3: true, utilt: true, dtilt: true, fair: true, bair: true, dair: true, nair: true, uair: true, ledgeattack: true,
      jab1: false, jab2: false, jab3: false, jab4: false, jab5: false, smash: 'hand.R', dsmash: false, usmash: false, sp_u: false } },
    update(V, F, o, t) {
      const S = V.sockets;
      if (S.chair && S.chair.obj) {
        S.chair.obj.visible = on(F, 0);
        // the turbo chair spins under him
        S.chair.obj.rotation.y = on(F, 2) ? t * 22 : 0;
      }
      if (S.laptop && S.laptop.obj) S.laptop.obj.visible = on(F, 1);
      if (S.coins && S.coins.obj) S.coins.obj.visible = on(F, 3);
      if (S.pizza && S.pizza.obj) S.pizza.obj.visible = on(F, 4);
      if (S.monitor && S.monitor.obj) {
        const m = S.monitor.obj;
        m.visible = on(F, 5);
        // between his two hands, the screen to the front, tipped down as he brings it down
        const B = V.rig.bones;
        if (m.visible && B['hand.L'] && B['hand.R'] && V.model) {
          B['hand.L'].getWorldPosition(_mA); B['hand.R'].getWorldPosition(_mB); _mA.add(_mB).multiplyScalar(0.5);
          const hy = _mA.y - V.root.position.y;
          m.parent.updateWorldMatrix(true, false); m.position.copy(m.parent.worldToLocal(_mA));
          m.parent.getWorldQuaternion(_mQ); V.model.scene.getWorldQuaternion(_mQ2); m.quaternion.copy(_mQ.invert().multiply(_mQ2));
          m.rotateX(Math.max(0, Math.min(1.3, (1.9 - hy) * 1.1)));
        }
      }
      if (S.crtpc && S.crtpc.obj) S.crtpc.obj.visible = on(F, 6);
      const L = S.loot && S.loot.obj;
      if (L) { const n = inMove(F) ? Math.round(F.va[7] || 0) : 0; L.visible = n > 0; L.children.forEach((c, i) => { c.visible = i === n - 1; }); }
      // flattened on the spinning chair (down smash), spinning with it (the smashes on the chair)
      const RM = V.model, flat = inMove(F) ? F.va[8] || 0 : 0;
      if (RM && RM.squashG && flat > 0) RM.squashG.scale.set(RM.squashG.scale.x * (1 + flat * 0.7), RM.squashG.scale.y * (1 - flat * 0.5), RM.squashG.scale.z * (1 + flat * 0.7));
      if (RM && RM.pivot && on(F, 2) && (F.move === 'dsmash' || F.move === 'usmash')) RM.pivot.rotation.y += t * 24;
      const p = S.plate && S.plate.obj;
      if (p) {
        p.visible = F.grounded && (F.state === 'run' || F.move === 'dashattack');
        if (p.visible) { toFloor(V, p, 0.01); p.rotation.y = Math.sin(t * 9) * 0.08; }
      }
    },
  },
};

// --- his projectiles (merged into entityView's BUILD) -----------------------------------------------------------
function bug() {
  const shell = mat('#14161a', { roughness: 0.3, metalness: 0.3 }), glow = new THREE.MeshBasicMaterial({ color: '#3dff6a' });
  const g = grp(
    mesh(G.ball(0.22, 1), shell, [0, 0.16, 0], null, [1, 0.7, 1.35]),
    mesh(G.ball(0.12, 1), shell, [0, 0.18, 0.26]),
    mesh(G.box(0.04, 0.02, 0.3), glow, [0, 0.31, -0.02]),
    mesh(G.box(0.3, 0.02, 0.04), glow, [0, 0.3, 0.05]),
    mesh(G.ball(0.035, 1), glow, [0.05, 0.22, 0.36]), mesh(G.ball(0.035, 1), glow, [-0.05, 0.22, 0.36]),
  );
  for (let i = 0; i < 6; i++) { const sx = i % 2 ? 1 : -1, z = (Math.floor(i / 2) - 1) * 0.14; g.add(mesh(G.box(0.22, 0.025, 0.025), shell, [sx * 0.2, 0.08, z], [0, 0, sx * -0.6])); }
  const k = new THREE.Group(); g.position.y = -0.15; k.add(g);
  return k;
}
function popupTex() {
  return canvasTex('pprod_404', 128, (g, s) => {
    g.fillStyle = '#e8e8ee'; g.fillRect(0, 0, s, s);
    g.fillStyle = '#2a5ad8'; g.fillRect(0, 0, s, 22);
    g.fillStyle = '#e8303a'; g.fillRect(s - 22, 3, 18, 16);
    g.fillStyle = '#ffffff'; g.font = 'bold 14px sans-serif'; g.fillText('x', s - 17, 16); g.fillText('ERROR', 6, 16);
    g.fillStyle = '#1a1a22'; g.font = 'bold 46px sans-serif'; g.fillText('404', 18, 84);
    g.fillStyle = '#9aa0b0'; g.fillRect(36, 98, 56, 18);
    g.fillStyle = '#1a1a22'; g.font = 'bold 13px sans-serif'; g.fillText('OK', 56, 112);
  });
}
function popup() {
  const m = new THREE.MeshBasicMaterial({ map: popupTex(), side: THREE.DoubleSide });
  return grp(mesh(new THREE.PlaneGeometry(1.0, 1.0), m, [0, 0, 0]));
}
function coin() { return grp(mesh(G.cyl(0.12, 0.12, 0.03, 14), GOLD(), [0, 0, 0], [Math.PI / 2, 0, 0])); }
function cashstack() {
  const bill = mat('#6fb35a', { roughness: 0.8 }), band = mat('#c9a227');
  return grp(mesh(G.box(0.42, 0.16, 0.22), bill), mesh(G.box(0.08, 0.17, 0.23), band));
}
export const PPROD_BUILD = {
  bug: () => bug(),
  popup: () => popup(),
  coin: () => coin(),
  cashstack: () => cashstack(),
  pizza: () => pizza(1.1),
};
