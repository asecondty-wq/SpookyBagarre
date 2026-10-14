// Epektase's rig settings: his Flying V (assets/models/props/guitar.glb, Meshy) held like an axe in the right hand,
// or played on the chest during the solos (F.va[0]); his Hermès scarf (F.va[1]: how far it reaches), a silk ribbon
// out of the left hand that lashes forward; the guitar glows while it screams (F.va[2]).
// The flags are set by src/sim/chars/epektase.js. Bones: the Meshy rig renamed by tools/art/meshy_pack.py.
import * as THREE from 'three';
import { mat, G, mesh, canvasTex } from '../materials.js';
import { fitProp } from '../propModels.js';

const grp = (...c) => { const g = new THREE.Group(); c.forEach((o) => o && g.add(o)); return g; };

// the middle of the palms at rest (character space: +X his left, +Y up, +Z forward), measured on the rig (T-pose)
const PALM_R = [-0.57, 1.27, 0.02], PALM_L = [0.57, 1.27, -0.02];

// the guitar as a plain shape (the model replaces it, propModels.js), the neck along `axis`
function guitarShape(along) {
  const body = mat('#c81e24', { roughness: 0.5 }), neck = mat('#2a1a12');
  const g = along === 'z'
    ? grp(mesh(G.box(0.45, 0.06, 0.42), body, [0, 0, 0.62]), mesh(G.box(0.07, 0.05, 0.62), neck, [0, 0, 0.12]))
    : grp(mesh(G.box(0.45, 0.42, 0.06), body, [0, -0.3, 0]), mesh(G.box(0.07, 0.62, 0.05), neck, [0, 0.22, 0]));
  return g;
}
// each guitar gets its own materials, so its glow does not light the other players' guitars
function ownMaterials(o) {
  const mats = [];
  o.traverse((m) => {
    if (!m.isMesh) return;
    m.material = m.material.clone();
    if (m.material.emissive) mats.push(m.material);
    m.castShadow = true;
  });
  o.userData.mats = mats;
  return o;
}
function axeGuitar() {
  // held by the neck near the head: the body is the axe's blade, out past the thumb
  const g = grp(ownMaterials(fitProp('guitar', guitarShape('z'))));
  g.visible = false;
  return g;
}
function playedGuitar() {
  // across the body: the neck up toward his left, the strings facing out
  const inner = ownMaterials(fitProp('guitar', guitarShape('y')));
  // undo the prop's flip (propModels FIX: made for the axe hold), then tilt the neck toward his left
  inner.rotation.set(Math.PI, 0, -1.0, 'ZYX');
  const g = grp(inner);
  g.visible = false;
  return g;
}

// --- the Hermès scarf: a silk square printed with gold chains and bits on navy, an orange border ----------------
function silk() {
  return canvasTex('hermes', 128, (g, s) => {
    g.fillStyle = '#e86c12'; g.fillRect(0, 0, s, s);
    g.fillStyle = '#f6e6c4'; g.fillRect(6, 6, s - 12, s - 12);
    g.fillStyle = '#1c2848'; g.fillRect(10, 10, s - 20, s - 20);
    g.strokeStyle = '#d9a63a'; g.lineWidth = 3;
    // a chain of links around, and a horse bit in the middle
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.beginPath(); g.ellipse(s / 2 + Math.cos(a) * 34, s / 2 + Math.sin(a) * 34, 9, 5, a, 0, Math.PI * 2); g.stroke();
    }
    g.beginPath(); g.arc(s / 2 - 12, s / 2, 10, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(s / 2 + 12, s / 2, 10, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#d9a63a'; g.fillRect(s / 2 - 12, s / 2 - 2, 24, 4);
    g.fillStyle = '#c23a2a';
    for (const [x, y] of [[22, 22], [s - 22, 22], [22, s - 22], [s - 22, s - 22]]) { g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill(); }
  });
}
const SEG = 18, SCARF_LEN = 2.25, SCARF_W = 0.32;
function scarf() {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array((SEG + 1) * 2 * 3), uv = new Float32Array((SEG + 1) * 2 * 2), idx = [];
  for (let i = 0; i <= SEG; i++) {
    uv.set([i / SEG * 4, 0, i / SEG * 4, 1], i * 4);
    if (i < SEG) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const m = mat('#ffffff', { map: silk(), side: THREE.DoubleSide, roughness: 0.35 });
  const ribbon = new THREE.Mesh(geo, m);
  ribbon.frustumCulled = false;
  ribbon.castShadow = true;
  const g = grp(ribbon);
  g.userData.ribbon = ribbon;
  g.visible = false;
  return g;
}
const _p = new THREE.Vector3(), _w = new THREE.Vector3(), _root = new THREE.Vector3();
// lay the ribbon in the world (from the hand toward the front, rippling), then back into the hand's space
function layScarf(o, F, ext, t) {
  const R = o.userData.ribbon;
  o.updateWorldMatrix(true, false);
  o.getWorldPosition(_root);
  const fx = Math.sin(F.facing), fz = Math.cos(F.facing);
  const L = SCARF_LEN * ext;
  const P = R.geometry.attributes.position;
  for (let i = 0; i <= SEG; i++) {
    const s = i / SEG;
    // out in front, a ripple running down it, the tip lagging and curling while it is still going out
    const d = L * s;
    const rip = Math.sin(s * 9 - t * 26) * 0.09 * s + Math.sin(s * 3.1 - t * 11) * 0.05;
    const curl = (1 - ext) * Math.sin(s * Math.PI) * 0.35;
    const cx = _root.x + fx * d, cy = _root.y + rip + curl - s * s * 0.12, cz = _root.z + fz * d + 0.04;
    const tw = Math.sin(s * 5 + t * 14) * 0.6;
    const wy = Math.cos(tw) * SCARF_W * (0.6 + 0.4 * s), wz = Math.sin(tw) * SCARF_W * 0.5;
    for (let k = 0; k < 2; k++) {
      const sg = k ? 0.5 : -0.5;
      _p.set(cx, cy + wy * sg, cz + wz * sg);
      o.worldToLocal(_w.copy(_p));
      P.setXYZ(i * 2 + k, _w.x, _w.y, _w.z);
    }
  }
  P.needsUpdate = true;
  R.geometry.computeVertexNormals();
  R.geometry.computeBoundingSphere();
}

const inMove = (F) => F.state === 'move';

export const EPEKTASE_RIG = {
  epektase: {
    h: 1.8, guard: 'brute', crouch: 0.03, wide: 0.03, lean: 4, stride: 1.0,
    // the blows stretched into their hitboxes (reach.js): the guitar's tip, the scarf hand, a foot
    reach: {
      weapon: 'axe', weaponHand: 'hand.R', far: 0.85,
      moves: { jab1: 'weapon', jab2: 'weapon', jab3: 'weapon', ftilt: 'hand.L', ftilt2: 'foot.R', ftilt3: 'weapon', utilt: 'weapon', dtilt: 'foot.R',
        nair: 'weapon', fair: 'weapon', bair: 'weapon', uair: 'weapon', dair: 'weapon', ledgeattack: 'weapon' },
    },
    sockets: {
      axe: { bone: 'hand.R', at: PALM_R, build: axeGuitar },
      play: { bone: 'chest', at: [0.06, 1.05, 0.22], build: playedGuitar },
      scarf: { bone: 'hand.L', at: PALM_L, build: scarf },
    },
    update(V, F, o, t) {
      const S = V.sockets;
      // played on the chest during the solos, and while he shows off on the character select
      const playing = (inMove(F) && (F.va[0] || 0) > 0.5) || F.emote === 'm_select';
      if (S.axe && S.axe.obj) S.axe.obj.visible = !playing;
      if (S.play && S.play.obj) {
        S.play.obj.visible = playing;
        // the camera sees him from the side: the guitar turned toward it, so its face shows (whichever way he faces)
        S.play.obj.rotation.y = Math.sin(F.facing) > 0 ? -0.95 : 0.95;
      }
      // the guitar screams: it glows red, pulsing with the notes
      const glow = inMove(F) ? F.va[2] || 0 : 0;
      for (const s of [S.axe, S.play]) {
        const ms = s && s.obj && s.obj.children[0] && s.obj.children[0].userData.mats;
        if (ms) for (const m of ms) { m.emissive.setRGB(1, 0.12, 0.05); m.emissiveIntensity = glow * (0.35 + 0.25 * Math.sin(t * 40)); }
      }
      const sc = S.scarf && S.scarf.obj;
      if (sc) {
        const ext = inMove(F) ? F.va[1] || 0 : 0;
        sc.visible = ext > 0.02;
        if (sc.visible) layScarf(sc, F, Math.max(0.08, ext), t);
      }
    },
  },
};

// --- his projectiles (merged into entityView's BUILD): the notes of the solo, the power chord's wall of sound ----
const NOTE_COLORS = ['#ff3b30', '#ffb020', '#ff5ad0'];
function note(s, color, beamed) {
  const m = mat(color, { emissive: color, emissiveIntensity: 0.7, roughness: 0.4 });
  const g = grp(
    mesh(G.ball(0.13 * s, 1), m, [0, 0, 0], null, [1.25, 0.9, 0.6]),
    mesh(G.box(0.035 * s, 0.42 * s, 0.035 * s), m, [0.14 * s, 0.21 * s, 0]),
    mesh(G.box(0.17 * s, 0.05 * s, 0.035 * s), m, [0.21 * s, 0.4 * s, 0], [0, 0, -0.5]),
  );
  if (beamed) {
    g.add(mesh(G.ball(0.13 * s, 1), m, [0.42 * s, 0.08 * s, 0], null, [1.25, 0.9, 0.6]));
    g.add(mesh(G.box(0.035 * s, 0.42 * s, 0.035 * s), m, [0.56 * s, 0.29 * s, 0]));
    g.add(mesh(G.box(0.46 * s, 0.07 * s, 0.035 * s), m, [0.35 * s, 0.47 * s, 0], [0, 0, 0.17]));
  }
  return g;
}
function chordWave() {
  const g = grp();
  for (let i = 0; i < 4; i++) {
    g.add(mesh(new THREE.TorusGeometry(0.35 + i * 0.2, 0.05, 4, 20, Math.PI * 0.85),
      new THREE.MeshBasicMaterial({ color: i % 2 ? '#ffb020' : '#ff3b30', transparent: true, opacity: 0.9 - i * 0.17, depthWrite: false }),
      [0, 0, i * 0.14], [0, Math.PI / 2, -Math.PI * 0.425]));
  }
  return g;
}
export const EPEKTASE_BUILD = {
  note: (e) => note(1, NOTE_COLORS[(e && e.b) || 0] || NOTE_COLORS[0], false),
  bignote: () => note(1.7, '#ff3b30', true),
  chord: () => chordWave(),
};
