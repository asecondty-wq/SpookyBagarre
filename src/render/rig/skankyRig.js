// SKANKY's rig settings and props: the skateboard under his feet while he rolls (run, dash attack) and for the ollie
// (F.va[0]), the ticket gate he jumps over for the fraud (F.va[1]), the speech bubbles of his talk and the train
// (merged into entityView's BUILD). Skateboard: the skate model (assets/models/props/skate.glb, shared with Nymano);
// train: the Meshy model (assets/models/props/train.glb). Flags set by src/sim/chars/skanky.js.
import * as THREE from 'three';
import { mat, G, mesh, canvasTex } from '../materials.js';
import { fitProp } from '../propModels.js';
import { skateboard } from '../friendsView.js';

const grp = (...c) => { const g = new THREE.Group(); c.forEach((o) => o && g.add(o)); return g; };
const hidden = (o) => { o.visible = false; return o; };

// --- the ticket gate of a station: two posts and the little flaps between them -----------------------------------
function gate() {
  const steel = mat('#9aa2ae', { metalness: 0.6, roughness: 0.35 }), dark = mat('#2a2e36'), red = mat('#d8202a', { emissive: '#3a0000' });
  return grp(
    mesh(G.box(0.18, 1.0, 0.8), steel, [-0.5, 0.5, 0]), mesh(G.box(0.18, 1.0, 0.8), steel, [0.5, 0.5, 0]),
    mesh(G.box(0.2, 0.06, 0.82), dark, [-0.5, 1.03, 0]), mesh(G.box(0.2, 0.06, 0.82), dark, [0.5, 1.03, 0]),
    mesh(G.box(0.36, 0.42, 0.04), red, [-0.24, 0.62, 0]), mesh(G.box(0.36, 0.42, 0.04), red, [0.24, 0.62, 0]),
    mesh(G.box(0.08, 0.06, 0.04), new THREE.MeshBasicMaterial({ color: '#ff3030' }), [-0.5, 1.08, 0.25]),
  );
}

// keep a prop on the floor under him, whatever the hips do
const tmp = new THREE.Vector3(), tA = new THREE.Vector3(), tB = new THREE.Vector3();
function toFloor(V, o, lift = 0, fwd = 0) {
  tmp.set(V.root.position.x + Math.sin(V.root.rotation.y) * fwd, V.root.position.y + lift, V.root.position.z + Math.cos(V.root.rotation.y) * fwd);
  o.parent.worldToLocal(tmp);
  o.position.copy(tmp);
}
// level with the floor, turned like him (whatever the hips do): the props hang on the hips bone
const qP = new THREE.Quaternion(), qR = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0);
function level(V, o) {
  o.parent.getWorldQuaternion(qP);
  qR.setFromAxisAngle(UP, V.root.rotation.y);
  o.quaternion.copy(qP.invert()).multiply(qR);
}
// under both feet (the ollie: the board goes up with them)
function underFeet(V, o) {
  const a = V.rig.bones['foot.L'], b = V.rig.bones['foot.R'];
  if (!a || !b) return toFloor(V, o, 0.02);
  a.getWorldPosition(tA); b.getWorldPosition(tB);
  tmp.copy(tA).add(tB).multiplyScalar(0.5);
  tmp.y = Math.min(tA.y, tB.y) - 0.08;
  o.parent.worldToLocal(tmp);
  o.position.copy(tmp);
}

const inMove = (F) => F.state === 'move';
const on = (F, i) => inMove(F) && (F.va[i] || 0) > 0.5;

export const SKANKY_RIG = {
  skanky: {
    h: 1.85, guard: 'boxer', crouch: 0.02, wide: 0.02, lean: 3, stride: 1.05,
    sockets: {
      board: { bone: 'hips', at: [0, 0, 0], build: () => hidden(grp(skateboard())) },
      gate: { bone: 'hips', at: [0, 0, 0], build: () => hidden(grp(gate())) },
    },
    update(V, F, o, t) {
      const S = V.sockets;
      const b = S.board && S.board.obj;
      if (b) {
        const roll = F.grounded && (F.state === 'run' || F.move === 'dashattack');
        const ollie = on(F, 0);
        b.visible = roll || ollie;
        if (b.visible) level(V, b);
        const tilt = b.children[0];
        if (roll) { toFloor(V, b, 0.01); tilt.rotation.set(0, 0, Math.sin(t * 7) * 0.03); }
        else if (ollie) { underFeet(V, b); tilt.rotation.set(-Math.max(0, Math.sin(F.mf * 0.2)) * 0.4, 0, 0); }
      }
      const g = S.gate && S.gate.obj;
      if (g) {
        g.visible = on(F, 1);
        // the gate stays where he jumped from (behind him as he flies over it)
        if (g.visible) { level(V, g); toFloor(V, g, 0, Math.max(-1.6, 0.7 - F.mf * 0.12)); }
      }
    },
  },
};

// --- his projectiles --------------------------------------------------------------------------------------------
export const BLABLA = ['BLA BLA', 'WESH', 'FRÈRE', 'BREF', "J'TE JURE", 'GENRE', 'ATTENDS', 'ÉCOUTE'];
function bubbleTex(i) {
  return canvasTex('skanky_bla' + i, 256, (g, s) => {
    g.clearRect(0, 0, s, s);
    const w = s * 0.92, h = s * 0.5, x = (s - w) / 2, y = s * 0.18, r = h * 0.45;
    g.fillStyle = '#ffffff'; g.strokeStyle = '#141018'; g.lineWidth = 10;
    g.beginPath(); g.roundRect(x, y, w, h, r); g.moveTo(s * 0.3, y + h - 2); g.lineTo(s * 0.22, s * 0.86); g.lineTo(s * 0.44, y + h - 2);
    g.fill(); g.stroke();
    g.fillStyle = '#ffffff'; g.fillRect(s * 0.3, y + h - 12, s * 0.13, 12);
    g.fillStyle = '#c8303a'; g.font = `900 ${BLABLA[i].length > 6 ? 46 : 60}px "Lilita One", "Arial Black", sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(BLABLA[i], s / 2, y + h / 2 + 3);
  });
}
function blabla(e) {
  const i = Math.abs((e && e.b) | 0) % BLABLA.length;
  const m = new THREE.SpriteMaterial({ map: bubbleTex(i), transparent: true, depthWrite: false });
  const s = new THREE.Sprite(m);
  s.scale.set(1.1, 1.1, 1);
  return grp(s);
}
// the train: along +Z (its way), its wheels on the floor 1 m under its centre (the projectile flies 1 m up), drawn
// a little behind the fighters (it hits them in their plane, it does not hide them)
function train(e) {
  const body = mat('#f4f4f6'), blue = mat('#2a50c8'), red = mat('#d8202a');
  const shape = grp(
    mesh(G.box(2.6, 3.0, 11), body, [0, 0.55, 0]),
    mesh(G.box(2.62, 0.25, 11.02), red, [0, 0.4, 0]),
    mesh(G.box(2.64, 3.02, 1.4), blue, [0, 0.55, 4.9]),
  );
  const t = fitProp('train', shape);
  t.position.x = Math.sign(Math.sin((e && e.dir) || 0)) * 1.8; // its local +x is the world's -z when it goes right
  return grp(t);
}
export const SKANKY_BUILD = {
  blabla: (e) => blabla(e),
  train: (e) => train(e),
};
