// Character visuals (built from low-poly primitives; Blender models can replace the parts, see models.js).
// Each builder returns parts (groups posed by poses.js), a layout, and an optional update hook.
import * as THREE from 'three';
import { mat, basic, G, mesh, speckle, stripes, canvasTex } from './materials.js';
import { restPose } from './poses.js';

function group(...children) { const g = new THREE.Group(); children.forEach((c) => c && g.add(c)); return g; }

// cartoon eyes: white + pupil, expression set later
function eyes(head, { y, z, spread, r = 0.11, pupil = 0.55, white = '#ffffff', iris = '#111111', top = false }) {
  const res = [];
  for (const s of [-1, 1]) {
    const e = new THREE.Group();
    e.position.set(spread * s, y, z);
    const w = mesh(G.ball(r, 1), basic(white), [0, 0, 0], null, [1, 1, 0.75]);
    const p = mesh(G.ball(r * pupil, 1), basic(iris), [0, 0, r * 0.62]);
    const lid = mesh(G.ball(r * 1.08, 1), mat(top || '#000000'), [0, r * 0.95, 0], null, [1, 0.35, 0.8]);
    lid.visible = false;
    e.add(w, p, lid);
    e.userData = { white: w, pupil: p, lid, r };
    head.add(e);
    res.push(e);
  }
  return res;
}

function mouth(head, { y, z, w = 0.22, h = 0.12, color = '#3a0008', tilt = 0 }) {
  const m = mesh(G.ball(1, 1), basic(color), [0, y, z], [tilt, 0, 0], [w, h * 0.15, 0.06]);
  m.userData = { w, h };
  head.add(m);
  return m;
}

const SKIN = '#f1b48a';

export const VISUALS = {
  frog(color) {
    const green = color || '#4fb83a';
    const skin = mat('#ffffff', { map: speckle('frogskin', green, ['#2f7d1f', '#3a9a28', '#8ae06b'], 64, 70, 1, 4) });
    const belly = mat('#d8f2a0');
    const body = group(
      mesh(G.ball(0.55, 2), skin, [0, 0, 0], null, [1.1, 0.82, 1.0]),
      mesh(G.ball(0.42, 2), belly, [0, -0.05, 0.22], null, [1, 0.8, 0.7]),
    );
    const head = group(mesh(G.ball(0.5, 2), skin, [0, 0, 0.05], null, [1.25, 0.62, 1.05]));
    const ey = eyes(head, { y: 0.24, z: 0.22, spread: 0.26, r: 0.16, pupil: 0.5 });
    for (const e of ey) { const bump = mesh(G.ball(0.19, 1), skin, [0, -0.04, -0.03], null, [1, 0.9, 0.9]); e.add(bump); bump.renderOrder = -1; e.userData.white.position.z = 0.05; e.userData.pupil.position.z = 0.15; }
    const mo = mouth(head, { y: -0.06, z: 0.5, w: 0.42, h: 0.2, color: '#b0153a' });
    const tongue = mesh(G.cyl(0.07, 0.07, 1, 6), mat('#ff5d8f'), [0, 0, 0.5], [Math.PI / 2, 0, 0]);
    tongue.geometry.translate(0, 0.5, 0);
    const tip = mesh(G.ball(0.13, 1), mat('#ff3a75'), [0, 1, 0]);
    tongue.add(tip);
    tongue.visible = false;
    head.add(tongue);
    const hand = () => group(mesh(G.ball(0.13, 1), skin, [0, 0, 0], null, [1, 0.8, 1.1]), mesh(G.ball(0.06, 0), skin, [0, 0, 0.12]));
    const foot = () => group(mesh(G.ball(0.2, 1), skin, [0, 0, 0.06], null, [1.1, 0.35, 1.5]));
    const L = { height: 1.45, width: 1.0, bodyY: 0.55, headY: 1.1, headZ: 0.08, handY: 0.6, footSpread: 0.32 };
    return {
      L, parts: { body, head, hr: hand(), hl: hand(), fr: foot(), fl: foot() }, eyes: ey, mouth: mo,
      update(V, F, P) {
        const len = F.va[0] || 0;
        tongue.visible = len > 0.05;
        if (tongue.visible) {
          // tongue goes from the mouth to the target length along the fighter's forward axis (in head space)
          tongue.scale.set(1, Math.max(0.1, len / 1), 1);
          tip.scale.set(1, 1 / Math.max(0.1, len), 1);
        }
        const belly2 = F.va[2] || 0;
        body.scale.setScalar(1 + belly2 * 0.35);
      },
    };
  },

  micron(color) {
    const suit = mat('#1d2c56', { map: stripes('suit', '#1d2c56', '#22346a', 16, 1, true) });
    const shirt = mat('#f4f4f4'), tie = mat(color || '#d02a2a'), skin = mat(SKIN), hair = mat('#5a5148');
    const body = group(
      mesh(G.rbox(0.75, 0.85, 0.48, 0.5), suit, [0, 0, 0]),
      mesh(G.box(0.26, 0.5, 0.05), shirt, [0, 0.12, 0.24], [0.08, 0, 0]),
      mesh(G.box(0.08, 0.42, 0.05), tie, [0, 0.08, 0.27], [0.08, 0, 0]),
      mesh(G.box(0.4, 0.1, 0.3), mat('#b88d2a'), [0, 0.42, 0], null, [0.6, 0.6, 0.6]),
    );
    const head = group(
      mesh(G.ball(0.3, 2), skin, [0, 0, 0], null, [0.9, 1.08, 0.95]),
      mesh(G.ball(0.31, 2), hair, [0, 0.09, -0.04], null, [0.95, 0.8, 1.0]),
      mesh(G.ball(0.08, 1), skin, [0.27, 0, -0.02], null, [0.5, 1, 0.8]),
      mesh(G.ball(0.08, 1), skin, [-0.27, 0, -0.02], null, [0.5, 1, 0.8]),
      mesh(G.ball(0.05, 1), skin, [0, -0.02, 0.29], null, [0.8, 1, 1.2]),
    );
    const ey = eyes(head, { y: 0.06, z: 0.24, spread: 0.1, r: 0.06, pupil: 0.62, iris: '#1a4fb5' });
    const mo = mouth(head, { y: -0.13, z: 0.26, w: 0.12, h: 0.07, color: '#5a0a12' });
    const smile = mesh(G.box(0.12, 0.02, 0.02), basic('#fff7ea'), [0, -0.12, 0.28]);
    head.add(smile);
    const hand = () => group(mesh(G.ball(0.1, 1), skin, [0, 0, 0], null, [1, 0.9, 1.2]));
    const shoe = () => group(mesh(G.rbox(0.18, 0.12, 0.34, 0.4), mat('#141414'), [0, 0, 0.06]));
    const cash = mesh(G.box(0.22, 0.08, 0.12), mat('#6fb35a', { map: stripes('bill', '#7bc265', '#5c9a4b', 8, 1) }), [0, 0, 0.08]);
    const hr = hand(); hr.add(cash);
    const legs = group(mesh(G.cyl(0.13, 0.13, 0.45, 6), suit, [-0.17, -0.55, 0]), mesh(G.cyl(0.13, 0.13, 0.45, 6), suit, [0.17, -0.55, 0]));
    body.add(legs);
    const L = { height: 1.85, width: 0.8, bodyY: 1.05, headY: 1.62, headZ: 0.02, handY: 0.98, footSpread: 0.22 };
    return {
      L, parts: { body, head, hr, hl: hand(), fr: shoe(), fl: shoe() }, eyes: ey, mouth: mo,
      update(V, F) { cash.visible = true; head.children[1].material.emissive?.setScalar((F.va[0] || 0) * 0.3); },
    };
  },

  bubba(color) {
    const skin = mat('#f2a07e'), tank = mat('#f2f2ea'), jeans = mat('#3b5d9b', { map: speckle('jeans', '#3b5d9b', ['#2f4f87', '#4a6fb0'], 32, 80, 0.5, 1.2) });
    const cap = mat(color || '#c42828'), beard = mat('#6b3e1f');
    const body = group(
      mesh(G.ball(0.72, 2), tank, [0, 0.1, 0.08], null, [1.05, 1.0, 1.0]),
      mesh(G.ball(0.55, 2), skin, [0, -0.12, 0.38], null, [1.05, 0.9, 0.7]),
      mesh(G.cyl(0.55, 0.62, 0.45, 8), jeans, [0, -0.55, 0]),
      mesh(G.ball(0.28, 1), skin, [0.55, 0.38, 0], null, [0.8, 0.6, 0.8]),
      mesh(G.ball(0.28, 1), skin, [-0.55, 0.38, 0], null, [0.8, 0.6, 0.8]),
    );
    // ketchup stain
    body.add(mesh(G.ball(0.12, 0), basic('#b81a1a'), [0.18, 0.35, 0.68], null, [1, 0.6, 0.3]));
    const head = group(
      mesh(G.ball(0.34, 2), skin, [0, 0, 0], null, [1.05, 1, 1]),
      mesh(G.ball(0.3, 1), beard, [0, -0.17, 0.1], null, [1.05, 0.7, 0.9]),
      mesh(G.ball(0.36, 2), cap, [0, 0.16, -0.02], null, [1.0, 0.55, 1.0]),
      mesh(G.box(0.4, 0.04, 0.3), cap, [0, 0.14, 0.32]),
      mesh(G.box(0.32, 0.08, 0.04), basic('#111111'), [0, 0.04, 0.32]),
    );
    const ey = eyes(head, { y: 0.04, z: 0.3, spread: 0.08, r: 0.05, white: '#222222', iris: '#000000' });
    const mo = mouth(head, { y: -0.12, z: 0.34, w: 0.12, h: 0.08 });
    const hand = () => group(mesh(G.ball(0.17, 1), skin, [0, 0, 0], null, [1, 0.9, 1.2]));
    const boot = () => group(mesh(G.rbox(0.26, 0.2, 0.42, 0.4), mat('#6a3d1d'), [0, 0.02, 0.06]));
    const burger = group(
      mesh(G.cyl(0.17, 0.2, 0.08, 8), mat('#d99a43'), [0, 0.07, 0]),
      mesh(G.cyl(0.19, 0.19, 0.05, 8), mat('#5a2d14'), [0, 0, 0]),
      mesh(G.cyl(0.2, 0.18, 0.04, 8), mat('#d99a43'), [0, -0.06, 0]),
    );
    const hl = hand(); hl.add(burger); burger.position.set(0, 0.12, 0.08);
    const L = { height: 2.0, width: 1.5, bodyY: 1.05, headY: 1.78, headZ: 0.1, handY: 1.0, footSpread: 0.26 };
    return {
      L, parts: { body, head, hr: hand(), hl, fr: boot(), fl: boot() }, eyes: ey, mouth: mo,
      update(V, F) {
        const shake = F.va[0] || 0;
        hl.rotation.z += shake * 0.4;
      },
    };
  },

  parmesan() {
    const cheese = mat('#ffffff', { map: speckle('parm', '#f2d77a', ['#e3c160', '#fae9a8', '#d8b04f', '#fff3c4'], 64, 140, 0.5, 2.2) });
    const rind = mat('#ffffff', { map: canvasTex('rind', 64, (g, s) => {
      g.fillStyle = '#c99632'; g.fillRect(0, 0, s, s);
      g.fillStyle = '#9b6d1f';
      for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) if ((i + j) % 2 === 0) g.fillRect(i * 8 + 3, j * 8 + 3, 2, 2);
    }) });
    const body = group(
      mesh(G.rbox(0.95, 1.1, 0.75, 0.15), cheese, [0, 0, 0]),
      mesh(G.box(0.98, 0.14, 0.78), rind, [0, -0.5, 0]),
      mesh(G.box(0.08, 1.12, 0.78), rind, [0.49, 0, 0]),
    );
    // face is on the head part (front plate) so it can move a little
    const head = group();
    const ey = eyes(head, { y: 0.08, z: 0.02, spread: 0.17, r: 0.1, pupil: 0.55 });
    const brows = group(mesh(G.box(0.2, 0.05, 0.04), basic('#3b2a10'), [0.17, 0.22, 0.04], [0, 0, -0.35]), mesh(G.box(0.2, 0.05, 0.04), basic('#3b2a10'), [-0.17, 0.22, 0.04], [0, 0, 0.35]));
    head.add(brows);
    const stache = group(mesh(G.ball(0.12, 1), basic('#3b2a10'), [0.1, -0.12, 0.05], null, [1.3, 0.45, 0.4]), mesh(G.ball(0.12, 1), basic('#3b2a10'), [-0.1, -0.12, 0.05], null, [1.3, 0.45, 0.4]));
    head.add(stache);
    const mo = mouth(head, { y: -0.24, z: 0.04, w: 0.12, h: 0.08 });
    const glove = () => group(mesh(G.ball(0.13, 1), mat('#ffffff'), [0, 0, 0], null, [1, 0.9, 1.2]), mesh(G.cyl(0.1, 0.12, 0.08, 8), mat('#ffffff'), [0, 0, -0.12], [Math.PI / 2, 0, 0]));
    const shoe = () => group(mesh(G.rbox(0.2, 0.12, 0.32, 0.4), mat('#5a3517'), [0, 0, 0.05]));
    const grater = group(
      mesh(G.box(0.32, 0.55, 0.08), mat('#c7ccd4', { map: canvasTex('grater', 32, (g, s) => { g.fillStyle = '#c7ccd4'; g.fillRect(0, 0, s, s); g.fillStyle = '#5c6470'; for (let i = 2; i < s; i += 6) for (let j = 2; j < s; j += 5) g.fillRect(i + (j % 2) * 2, j, 2, 2); }) }), [0, 0.3, 0.12], [0.3, 0, 0]),
      mesh(G.box(0.08, 0.2, 0.06), mat('#222222'), [0, -0.02, 0.06]),
    );
    const hr = glove(); hr.add(grater);
    const L = { height: 1.65, width: 1.05, bodyY: 0.85, headY: 1.0, headZ: 0.39, handY: 0.85, footSpread: 0.25 };
    return {
      L, parts: { body, head, hr, hl: glove(), fr: shoe(), fl: shoe(), prop: null }, eyes: ey, mouth: mo, headFollowsBody: true,
      update(V, F, P, t) { grater.rotation.z = (F.va[0] || 0) * Math.sin(t * 50) * 0.3; },
    };
  },

  pika(color) {
    const yellow = mat('#ffd23a'), black = mat('#1a1a1a'), red = mat('#e8382c');
    const body = group(mesh(G.ball(0.4, 2), yellow, [0, 0, 0], null, [1, 1.05, 0.95]));
    const tail = group(
      mesh(G.box(0.12, 0.4, 0.05), yellow, [0, 0.2, 0], [0, 0, 0.5]),
      mesh(G.box(0.12, 0.35, 0.05), yellow, [0.18, 0.45, 0], [0, 0, -0.6]),
      mesh(G.box(0.3, 0.32, 0.05), yellow, [0.12, 0.72, 0], [0, 0, 0.4]),
      mesh(G.box(0.12, 0.2, 0.05), mat('#8a5a1a'), [0, 0, 0], [0, 0, 0.5]),
    );
    tail.position.set(0, -0.1, -0.38);
    tail.rotation.set(-0.5, 0, 0);
    body.add(tail);
    const head = group(
      mesh(G.ball(0.42, 2), yellow, [0, 0, 0], null, [1.12, 0.95, 1]),
      mesh(G.ball(0.09, 1), red, [0.28, -0.1, 0.3], null, [1, 1, 0.5]),
      mesh(G.ball(0.09, 1), red, [-0.28, -0.1, 0.3], null, [1, 1, 0.5]),
    );
    for (const s of [-1, 1]) {
      const ear = group(mesh(G.cone(0.11, 0.6, 6), yellow, [0, 0.3, 0]), mesh(G.cone(0.065, 0.2, 6), black, [0, 0.55, 0]));
      ear.position.set(0.2 * s, 0.3, -0.05); ear.rotation.set(-0.1, 0, -0.35 * s);
      head.add(ear);
    }
    // backwards cap
    const capC = color || '#d22a2a';
    head.add(mesh(G.ball(0.36, 2), mat(capC), [0, 0.22, -0.02], null, [1.05, 0.5, 1.05]));
    head.add(mesh(G.box(0.36, 0.04, 0.24), mat(capC), [0, 0.2, -0.36]));
    head.add(mesh(G.box(0.12, 0.1, 0.02), mat('#ffffff'), [0, 0.3, 0.34]));
    const ey = eyes(head, { y: 0.06, z: 0.33, spread: 0.15, r: 0.075, white: '#111111', iris: '#ffffff', pupil: 0.35 });
    for (const e of ey) { e.userData.pupil.position.set(0.02, 0.025, 0.05); }
    const mo = mouth(head, { y: -0.12, z: 0.38, w: 0.1, h: 0.06, color: '#6a1010' });
    const paw = () => group(mesh(G.ball(0.09, 1), yellow, [0, 0, 0]));
    const foot = () => group(mesh(G.ball(0.12, 1), yellow, [0, 0, 0.04], null, [1, 0.6, 1.3]));
    const ball = group(mesh(new THREE.SphereGeometry(0.14, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat('#e8382c')), mesh(new THREE.SphereGeometry(0.14, 8, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat('#f4f4f4')), mesh(G.cyl(0.05, 0.05, 0.3, 8), mat('#222222'), [0, 0, 0], [0, 0, Math.PI / 2], [1, 1, 1]));
    const hr = paw(); hr.add(ball); ball.position.set(0, 0.12, 0.05);
    const L = { height: 1.2, width: 0.85, bodyY: 0.45, headY: 0.98, headZ: 0.04, handY: 0.5, footSpread: 0.2 };
    return {
      L, parts: { body, head, hr, hl: paw(), fr: foot(), fl: foot() }, eyes: ey, mouth: mo,
      update(V, F, P, t) {
        tail.rotation.z = Math.sin(t * 6) * 0.15;
        const e = F.va[0] || 0;
        body.children[0].material.emissive.setRGB(e * 0.6, e * 0.55, 0);
      },
    };
  },

  tung() {
    const bark = mat('#ffffff', { map: canvasTex('bark', 64, (g, s) => {
      g.fillStyle = '#9c6a36'; g.fillRect(0, 0, s, s);
      for (let i = 0; i < 26; i++) { g.fillStyle = i % 2 ? '#7d5228' : '#b07a42'; const x = (i * 37) % s; g.fillRect(x, 0, 2 + (i % 3), s); }
      g.fillStyle = '#5e3a18'; for (let i = 0; i < 8; i++) g.fillRect((i * 23) % s, (i * 41) % s, 3, 6);
    }) });
    const wood = mat('#e3b277');
    const body = group(
      mesh(G.cyl(0.42, 0.45, 1.9, 9), bark, [0, 0, 0]),
      mesh(G.cyl(0.4, 0.4, 0.02, 9), wood, [0, 0.96, 0]),
    );
    const head = group();
    const ey = eyes(head, { y: 0.15, z: 0.0, spread: 0.15, r: 0.12, pupil: 0.45 });
    const mo = mouth(head, { y: -0.12, z: 0.0, w: 0.2, h: 0.12, color: '#2a1405' });
    const hand = () => group(mesh(G.ball(0.1, 1), wood, [0, 0, 0]));
    const foot = () => group(mesh(G.ball(0.13, 1), wood, [0, 0, 0.05], null, [1, 0.6, 1.4]));
    const bat = group(mesh(G.cyl(0.11, 0.05, 1.2, 7), mat('#d8a868'), [0, 0.55, 0]), mesh(G.cyl(0.06, 0.06, 0.1, 6), mat('#4a2a10'), [0, -0.04, 0]));
    const hr = hand(); hr.add(bat); bat.rotation.set(0.5, 0, 0);
    // thin arms are just the floating hands, legs = small stubs under the log
    const L = { height: 2.05, width: 0.9, bodyY: 1.05, headY: 1.55, headZ: 0.43, handY: 1.05, footSpread: 0.22 };
    return {
      L, parts: { body, head, hr, hl: hand(), fr: foot(), fl: foot() }, eyes: ey, mouth: mo, headFollowsBody: true, bat,
      update(V, F, P) { bat.rotation.y = (F.va[1] || 0); },
    };
  },

  // Pandrezz (fallback when the rigged model is missing): long copper hair, glasses, black tee, jeans
  pandrezz(color) {
    const tee = mat('#1c1b20'), skin = mat('#e0a070'), hair = mat('#8a3e1a'), jean = mat('#2c4a8a'), glass = mat('#111111');
    const body = group(
      mesh(G.rbox(0.62, 0.62, 0.38, 0.35), tee, [0, 0.12, 0]),
      mesh(G.rbox(0.5, 0.36, 0.34, 0.3), jean, [0, -0.36, 0]),
      mesh(G.box(0.12, 0.1, 0.02), mat('#ff4fa3'), [-0.04, 0.22, 0.2]),
      mesh(G.box(0.1, 0.1, 0.02), mat('#3f7bff'), [0.06, 0.22, 0.2]),
    );
    const head = group(
      mesh(G.ball(0.23, 2), skin, [0, 0, 0]),
      mesh(G.ball(0.27, 1), hair, [0, 0.05, -0.07], null, [1.15, 1.05, 1]),
      mesh(G.ball(0.2, 1), hair, [0, -0.2, -0.12], null, [1.4, 1.2, 0.6]),
      mesh(G.ball(0.15, 1), mat('#a04a1e'), [0, -0.12, 0.12], null, [1.1, 0.8, 0.7]),
      mesh(G.box(0.34, 0.06, 0.03), glass, [0, 0.04, 0.22]),
    );
    const ey = eyes(head, { y: 0.04, z: 0.22, spread: 0.08, r: 0.045, pupil: 0.5 });
    const mo = mouth(head, { y: -0.1, z: 0.2, w: 0.1, h: 0.05 });
    const hand = () => group(mesh(G.ball(0.1, 1), skin, [0, 0, 0], null, [1, 0.9, 1.2]));
    const shoe = () => group(mesh(G.rbox(0.22, 0.14, 0.36, 0.5), mat('#e8e8ec'), [0, 0, 0.05]));
    const L = { height: 1.85, width: 1.0, bodyY: 0.95, headY: 1.55, headZ: 0.03, handY: 0.95, footSpread: 0.22 };
    return { L, parts: { body, head, hr: hand(), hl: hand(), fr: shoe(), fl: shoe() }, eyes: ey, mouth: mo };
  },

  // La Folle Du Bus (fallback when the rigged model is missing)
  catlady(color) {
    const coat = mat(color || '#5a2f7a'), dress = mat('#8a8f6a'), skin = mat('#e2c2a8'), hat = mat('#2a2230'), hair = mat('#b8b4bf');
    const body = group(
      mesh(G.cone(0.5, 1.0, 9), coat, [0, -0.1, 0]),
      mesh(G.ball(0.3, 1), coat, [0, 0.35, 0], null, [1.1, 0.8, 0.9]),
      mesh(G.ball(0.22, 1), mat('#f2902a'), [0.22, 0.55, -0.02], null, [1.3, 0.5, 0.6]),
    );
    const head = group(
      mesh(G.ball(0.24, 2), skin, [0, 0, 0]),
      mesh(G.ball(0.27, 1), hair, [0, 0.04, -0.06], null, [1.1, 0.9, 1]),
      mesh(G.cyl(0.42, 0.42, 0.04, 12), hat, [0, 0.18, 0]),
      mesh(G.cone(0.22, 0.55, 10), hat, [0.04, 0.45, 0], [0, 0, -0.25]),
      mesh(G.ball(0.05, 1), skin, [0, -0.02, 0.24], null, [0.8, 0.8, 1.6]),
    );
    const ey = eyes(head, { y: 0.05, z: 0.2, spread: 0.08, r: 0.06, pupil: 0.5 });
    const mo = mouth(head, { y: -0.11, z: 0.21, w: 0.09, h: 0.05 });
    const hand = () => group(mesh(G.ball(0.08, 1), skin, [0, 0, 0], null, [1, 0.8, 1.3]));
    const slipper = () => group(mesh(G.rbox(0.2, 0.12, 0.32, 0.5), mat('#d0507a'), [0, 0, 0.05]));
    const L = { height: 1.75, width: 0.9, bodyY: 0.75, headY: 1.38, headZ: 0.04, handY: 0.85, footSpread: 0.2 };
    return { L, parts: { body, head, hr: hand(), hl: hand(), fr: slipper(), fl: slipper() }, eyes: ey, mouth: mo };
  },

  shark(color) {
    const blue = mat('#ffffff', { map: canvasTex('sharkskin', 64, (g, s) => {
      const gr = g.createLinearGradient(0, 0, 0, s); gr.addColorStop(0, '#2f6fc0'); gr.addColorStop(0.55, '#4f93dc'); gr.addColorStop(0.6, '#e8eef5'); gr.addColorStop(1, '#f6f8fb');
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
    }) });
    const white = mat('#f4f6f8');
    const body = group(
      mesh(G.ball(0.5, 2), blue, [0, 0, 0], [Math.PI / 2, 0, 0], [0.85, 1.7, 0.8]),
      mesh(G.cone(0.2, 0.5, 4), blue, [0, 0.52, -0.1], [-0.3, 0, 0], [0.4, 1, 1.2]),
      mesh(G.cone(0.25, 0.6, 4), blue, [0, 0.1, -0.95], [-1.9, 0, 0], [0.4, 1, 1]),
      mesh(G.cone(0.2, 0.45, 4), blue, [0, -0.15, -0.9], [-1.1, 0, 0], [0.35, 1, 1]),
    );
    const head = group();
    const ey = eyes(head, { y: 0.1, z: -0.1, spread: 0.33, r: 0.065, white: '#111111', iris: '#ffffff', pupil: 0.3 });
    const jaw = group(mesh(G.ball(0.3, 1), white, [0, 0, 0], null, [1.1, 0.35, 1]));
    for (let i = 0; i < 6; i++) jaw.add(mesh(G.cone(0.04, 0.09, 3), basic('#ffffff'), [-0.22 + i * 0.09, 0.06, 0.2], [0, 0, 0]));
    jaw.position.set(0, -0.12, 0.05);
    head.add(jaw);
    const mo = mouth(head, { y: -0.05, z: 0.18, w: 0.3, h: 0.12, color: '#6a0a18' });
    const fin = () => group(mesh(G.cone(0.14, 0.42, 4), blue, [0, 0, 0], [0, 0, Math.PI / 2], [0.5, 1, 1.2]));
    const sneaker = (c) => group(
      mesh(G.cyl(0.07, 0.07, 0.45, 6), white, [0, 0.3, 0]),
      mesh(G.rbox(0.2, 0.13, 0.36, 0.4), mat(c), [0, 0, 0.06]),
      mesh(G.box(0.21, 0.04, 0.37), mat('#ffffff'), [0, -0.06, 0.06]),
      mesh(G.box(0.02, 0.05, 0.18), basic('#ffffff'), [0.105, 0.02, 0.04], [0, 0, 0.3]),
    );
    const shoeC = color || '#2c64d4';
    const L = { height: 1.6, width: 1.1, bodyY: 0.95, headY: 0.98, headZ: 0.72, handY: 0.82, footSpread: 0.25 };
    return {
      L, parts: { body, head, hr: fin(), hl: fin(), fr: sneaker(shoeC), fl: sneaker(shoeC), fm: sneaker(shoeC) }, eyes: ey, mouth: mo, jaw,
      update(V, F, P, t) {
        jaw.rotation.x = Math.min(0.9, (P.mouth || 0) * 0.9);
        const sub = F.va[0] || 0;
        V.root.position.y -= sub * 1.35;
      },
    };
  },
};
