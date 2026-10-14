// Does the blow look as long as it hits? For each move: the frame its hitbox comes out, the hitboxes drawn in red,
// and how far the hand / foot / weapon goes compared with the far edge of the hitbox.
//   in a quick match (posecheck.js loaded, P = await import('/tools/dev/posecheck.js'); await P.ready()):
//   const C = await import('/tools/dev/reachcheck.js'); C.measure(P, 0, ['jab1', 'ftilt']); await C.sheet(P, [[0, 'jab1', 'label'], ...], 'name')
import * as THREE from 'three';
import { CHARS } from '/src/sim/chars/index.js';
import { localToWorld } from '/src/sim/util.js';

const NORMALS = ['jab1', 'jab2', 'jab3', 'ftilt', 'ftilt2', 'ftilt3', 'utilt', 'dtilt', 'nair', 'fair', 'bair', 'uair', 'dair'];
const farHit = (M) => M.hits.reduce((a, b) => (Math.abs(b.at[2]) + b.r > Math.abs(a.at[2]) + a.r ? b : a));
const strikeFrame = (M) => farHit(M).f[0] + 1;

// how far forward (or back, for a hit behind) each limb and the weapon reach, against the hitbox's far edge
export function measure(P, slot, moves = NORMALS, frameOf = strikeFrame) {
  const F = P.W().fighters[slot], rows = {};
  for (const mv of moves) {
    const M = CHARS[F.char].moves[mv];
    if (!M || !M.hits) continue;
    const h = farHit(M), back = h.at[2] < 0;
    P.go(slot, mv, frameOf(M), 5, 1.0);
    const V = __app.match.view.views[slot], RM = V.rigModel;
    RM.scene.updateMatrixWorld(true);
    const fx = Math.sin(F.facing) * (back ? -1 : 1);
    let far = -9, who = '';
    for (const b of ['hand.R', 'hand.L', 'toe.R', 'toe.L', 'foot.R', 'foot.L']) {
      const B = RM.rig.bones[b]; if (!B) continue;
      const d = (B.getWorldPosition(new THREE.Vector3()).x - F.x) * fx;
      if (d > far) { far = d; who = b; }
    }
    for (const s of Object.values(RM.sockets || {})) {
      if (!s.obj || !s.obj.visible) continue;
      const bx = new THREE.Box3().setFromObject(s.obj);
      if (bx.isEmpty()) continue;
      const d = Math.max((bx.max.x - F.x) * fx, (bx.min.x - F.x) * fx);
      if (d > far) { far = d; who = 'prop'; }
    }
    const edge = Math.abs(h.at[2]) + h.r;
    rows[mv] = { edge: +edge.toFixed(2), limb: who, reach: +far.toFixed(2), gap: +(edge - far).toFixed(2) };
  }
  return rows;
}

// a sheet: [slot, move, label] per cell, the hitboxes out at that frame drawn in red; saved as tools/dev/shots/<name>.png
export async function sheet(P, list, name = 'reach', cols = 3, frameOf = strikeFrame) {
  const cv = __app.renderer.gl.domElement;
  if (cv.height < 300 || innerHeight < 300) {
    Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 720, configurable: true });
    __app.renderer.resize();
  }
  const W = cv.width, H = cv.height, cw = Math.round(H * 0.75), ch = Math.round(H * 0.8);
  const rows = Math.ceil(list.length / cols);
  const o = document.createElement('canvas'); o.width = cw * cols; o.height = ch * rows;
  const g = o.getContext('2d');
  g.font = 'bold 24px sans-serif'; g.textAlign = 'center';
  const scene = __app.renderer.scene;
  list.forEach(([slot, mv, label], i) => {
    const F = P.W().fighters[slot], M = CHARS[F.char].moves[mv];
    const f = frameOf(M);
    P.go(slot, mv, f, 5.2, 1.0);
    const balls = M.hits.filter((h) => f >= h.f[0] && f <= h.f[1]).map((h) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(h.r, 20, 12), new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.32, depthWrite: false }));
      m.position.set(...localToWorld(F, h.at)); scene.add(m); return m;
    });
    P.close(slot, 5.2, 1.0);
    const x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
    g.drawImage(cv, W / 2 - cw / 2, H * 0.08, cw, ch, x, y, cw, ch);
    balls.forEach((b) => scene.remove(b));
    g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(x, y + ch - 40, cw, 40);
    g.fillStyle = '#ffd23a'; g.fillText(label || mv, x + cw / 2, y + ch - 12);
  });
  const blob = await new Promise((ok) => o.toBlob(ok, 'image/png'));
  await fetch('/__shot/' + name + '.png', { method: 'POST', body: blob });
}
