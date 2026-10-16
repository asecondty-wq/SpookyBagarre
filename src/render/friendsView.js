// Visuals of the seven friends (Aboueb, Tices, OMFU, Lolobiscotto, J'san, Nymano, BIDO): their projectiles,
// J'san's shiba, the props they hold (built for the rig sockets) and the effects of their moves.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { mat, basic, G, mesh, canvasTex, stripes, speckle } from './materials.js';
import { fitProp } from './propModels.js';

const grp = (...c) => { const g = new THREE.Group(); c.forEach((x) => x && g.add(x)); return g; };

// --- small shapes ------------------------------------------------------------------------------------------------
function heartShape(s = 1) {
  const sh = new THREE.Shape();
  sh.moveTo(0, -0.5 * s);
  sh.bezierCurveTo(0.1 * s, -0.35 * s, 0.55 * s, -0.1 * s, 0.5 * s, 0.2 * s);
  sh.bezierCurveTo(0.45 * s, 0.5 * s, 0.08 * s, 0.55 * s, 0, 0.25 * s);
  sh.bezierCurveTo(-0.08 * s, 0.55 * s, -0.45 * s, 0.5 * s, -0.5 * s, 0.2 * s);
  sh.bezierCurveTo(-0.55 * s, -0.1 * s, -0.1 * s, -0.35 * s, 0, -0.5 * s);
  return sh;
}
export const heartGeo = (s = 1, depth = 0.18) => { const g = new THREE.ExtrudeGeometry(heartShape(s), { depth: depth * s, bevelEnabled: true, bevelSize: 0.06 * s, bevelThickness: 0.06 * s, bevelSegments: 2, steps: 1 }); g.center(); return g; };

const basketTex = () => canvasTex('basket', 64, (g, s) => {
  g.fillStyle = '#e8762a'; g.fillRect(0, 0, s, s);
  g.strokeStyle = '#2a1408'; g.lineWidth = 2.5;
  g.beginPath(); g.moveTo(s / 2, 0); g.lineTo(s / 2, s); g.moveTo(0, s / 2); g.lineTo(s, s / 2); g.stroke();
  g.beginPath(); g.arc(0, s / 2, s * 0.32, -1.2, 1.2); g.stroke(); g.beginPath(); g.arc(s, s / 2, s * 0.32, 1.95, 4.35); g.stroke();
});
const tarteTex = () => canvasTex('flamm', 64, (g, s) => {
  g.fillStyle = '#f3d79a'; g.fillRect(0, 0, s, s);
  g.fillStyle = '#fff3d8'; g.fillRect(4, 4, s - 8, s - 8);
  for (let i = 0; i < 26; i++) { g.fillStyle = i % 3 ? '#b8452a' : '#f0f0d0'; g.fillRect(6 + Math.random() * (s - 16), 6 + Math.random() * (s - 16), 5, 3); }
  for (let i = 0; i < 18; i++) { g.fillStyle = '#7a3a12'; g.fillRect(Math.random() * s, Math.random() * s, 3, 3); }
});
const bucketTex = () => stripes('kfc', '#c8141a', '#f4f4f4', 6, 1);

export function basketball(r = 0.38) { return mesh(G.ball(r, 2), mat('#ffffff', { map: basketTex() })); }
function plate() {
  return grp(
    mesh(G.cyl(0.42, 0.32, 0.08, 16), mat('#e8e2d8'), [0, 0, 0]),
    mesh(G.ball(0.36, 1), mat('#ffffff', { map: speckle('semoule', '#f2d38a', ['#e8c070', '#fbe7b0', '#d8a850'], 64, 260, 0.6, 1.4) }), [0, 0.06, 0], null, [1, 0.38, 1]),
    mesh(G.ball(0.09, 1), mat('#e07a20'), [0.12, 0.17, 0.05]), mesh(G.ball(0.08, 1), mat('#7a9a3a'), [-0.12, 0.16, -0.06]), mesh(G.box(0.16, 0.08, 0.1), mat('#8a3a1a'), [0, 0.18, 0.12]),
  );
}
function flammekueche(w = 0.95) { return mesh(G.box(w, 0.05, w * 0.62), mat('#ffffff', { map: tarteTex() })); }
function peel() { return grp(flammekueche(0.62), mesh(G.box(0.7, 0.02, 0.5), mat('#c8945a'), [0, -0.035, 0]), mesh(G.box(0.07, 0.04, 0.85), mat('#a87040'), [0, -0.03, -0.62])); }
function cowbell(s = 1) {
  const g = grp(mesh(new THREE.CylinderGeometry(0.16 * s, 0.26 * s, 0.42 * s, 4, 1), mat('#c8ccd2', { metalness: 0.8, roughness: 0.3 }), [0, 0, 0], [0, Math.PI / 4, 0]),
    mesh(G.box(0.12 * s, 0.05 * s, 0.05 * s), mat('#5a5a60'), [0, 0.24 * s, 0]));
  return g;
}
function bucket() {
  return grp(mesh(G.cyl(0.38, 0.28, 0.6, 14, 1, false), mat('#ffffff', { map: bucketTex() })),
    ...[0, 1, 2, 3, 4].map((i) => mesh(G.ball(0.12, 1), mat('#c8782a'), [Math.cos(i * 1.3) * 0.18, 0.34, Math.sin(i * 1.3) * 0.18], null, [1, 0.8, 1.3])));
}
function drumstick() { return grp(mesh(G.ball(0.16, 1), mat('#b8662a'), [0, 0, 0.06], null, [1, 0.9, 1.4]), mesh(G.cyl(0.035, 0.035, 0.22, 5), mat('#f4ead8'), [0, 0, -0.16], [Math.PI / 2, 0, 0])); }
function chili() { const c = mesh(G.cone(0.1, 0.55, 8), mat('#d8141a', { emissive: '#3a0000' }), [0, 0, 0], [Math.PI / 2, 0, 0]); return grp(c, mesh(G.cyl(0.03, 0.04, 0.12, 5), mat('#2a8a2a'), [0, 0, -0.3], [Math.PI / 2, 0, 0])); }
function dumbbell(s = 1) {
  const bar = mat('#8a9098', { metalness: 0.8, roughness: 0.35 }), w = mat('#2a2a30', { metalness: 0.3, roughness: 0.6 });
  return grp(mesh(G.cyl(0.04 * s, 0.04 * s, 0.5 * s, 6), bar, [0, 0, 0], [0, 0, Math.PI / 2]),
    mesh(G.cyl(0.13 * s, 0.13 * s, 0.1 * s, 10), w, [0.2 * s, 0, 0], [0, 0, Math.PI / 2]), mesh(G.cyl(0.13 * s, 0.13 * s, 0.1 * s, 10), w, [-0.2 * s, 0, 0], [0, 0, Math.PI / 2]));
}
function kettlebell() { return grp(mesh(G.ball(0.24, 1), mat('#2a2a30', { metalness: 0.4, roughness: 0.5 }), [0, -0.08, 0]), mesh(new THREE.TorusGeometry(0.13, 0.035, 6, 14, Math.PI), mat('#2a2a30'), [0, 0.12, 0])); }
function barbell() {
  const bar = mat('#a8aeb6', { metalness: 0.85, roughness: 0.3 }), w = mat('#c8202a', { roughness: 0.5 });
  return grp(mesh(G.cyl(0.035, 0.035, 2.0, 6), bar, [0, 0, 0], [0, 0, Math.PI / 2]),
    ...[-0.8, -0.68, 0.68, 0.8].map((x) => mesh(G.cyl(0.32, 0.32, 0.08, 14), w, [x, 0, 0], [0, 0, Math.PI / 2])));
}
function plateWeight() { return mesh(G.cyl(0.36, 0.36, 0.09, 16), mat('#2a2a30', { metalness: 0.3 })); }
function turntable() {
  return grp(mesh(G.box(0.62, 0.1, 0.48), mat('#2a2a30'), [0, 0, 0]), mesh(G.cyl(0.2, 0.2, 0.02, 20), mat('#111111'), [-0.08, 0.06, 0]),
    mesh(G.cyl(0.06, 0.06, 0.022, 10), mat('#e8412c'), [-0.08, 0.07, 0]), mesh(G.box(0.03, 0.02, 0.26), mat('#c8ccd2', { metalness: 0.8 }), [0.2, 0.07, -0.02], [0, 0.4, 0]));
}
function record() { return grp(mesh(G.cyl(0.42, 0.42, 0.02, 24), mat('#111111', { roughness: 0.25 })), mesh(G.cyl(0.13, 0.13, 0.025, 14), mat('#2fae5b'))); }
function speaker() {
  return grp(mesh(G.box(1.0, 0.9, 0.8), mat('#1a1a1e'), [0, 0.45, 0]), mesh(G.cyl(0.34, 0.34, 0.04, 20), mat('#3a3a42'), [0, 0.45, 0.41], [Math.PI / 2, 0, 0]),
    mesh(G.cyl(0.12, 0.12, 0.06, 14), mat('#5a5a66'), [0, 0.45, 0.43], [Math.PI / 2, 0, 0]));
}
function bottle(label = '#f2c14e', glass = '#c8a040') {
  return grp(mesh(G.cyl(0.08, 0.09, 0.32, 10), mat(glass, { transparent: true, opacity: 0.85, roughness: 0.15 }), [0, 0.16, 0]),
    mesh(G.cyl(0.035, 0.05, 0.14, 8), mat(glass, { transparent: true, opacity: 0.85 }), [0, 0.39, 0]), mesh(G.cyl(0.092, 0.092, 0.12, 10), mat(label), [0, 0.16, 0]));
}
function sampler() {
  const g = grp(mesh(G.box(0.34, 0.07, 0.42), mat('#3a3a3e'), [0, 0, 0]));
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) g.add(mesh(G.box(0.06, 0.03, 0.06), basic(['#ff4fa3', '#ffd23a', '#3bdc5a', '#3b8bff'][(i + j) % 4]), [-0.12 + i * 0.08, 0.045, -0.04 + j * 0.08]));
  return g;
}
export function skateboard() {
  const deck = mat('#ffffff', { map: stripes('deck', '#3d7fd9', '#ffd23a', 4, 1) });
  const g = grp(mesh(G.rbox(0.24, 0.035, 0.85, 0.4), deck, [0, 0.11, 0]));
  for (const z of [-0.3, 0.3]) for (const x of [-0.09, 0.09]) g.add(mesh(G.cyl(0.04, 0.04, 0.035, 8), mat('#f4f4f4'), [x, 0.04, z], [0, 0, Math.PI / 2]));
  return g;
}
function carpet() {
  const tex = canvasTex('carpet', 64, (g, s) => { g.fillStyle = '#8a1a2a'; g.fillRect(0, 0, s, s); g.strokeStyle = '#e8b040'; g.lineWidth = 4; g.strokeRect(6, 6, s - 12, s - 12); g.fillStyle = '#e8b040'; g.beginPath(); g.moveTo(s / 2, 14); g.lineTo(s - 14, s / 2); g.lineTo(s / 2, s - 14); g.lineTo(14, s / 2); g.fill(); g.fillStyle = '#2a4a8a'; g.fillRect(s / 2 - 5, s / 2 - 5, 10, 10); });
  const geo = new THREE.PlaneGeometry(1.0, 1.6, 6, 8);
  const m = mesh(geo, mat('#ffffff', { map: tex, side: THREE.DoubleSide }), [0, 0, 0], [-Math.PI / 2, 0, 0]);
  const g = grp(m);
  g.userData.wave = m;
  return g;
}
function vape() { return grp(mesh(G.box(0.05, 0.16, 0.03), mat('#3a3a42', { metalness: 0.6 }), [0, 0.08, 0]), mesh(G.cyl(0.015, 0.02, 0.05, 6), mat('#111'), [0, 0.18, 0])); }
function balloon() {
  const g = grp(mesh(heartGeo(1.3, 0.5), mat('#ff3a6a', { roughness: 0.25, emissive: '#3a0010' }), [0, 0.9, 0]));
  g.add(mesh(G.cyl(0.01, 0.01, 0.9, 4), basic('#eeeeee'), [0, 0.2, 0]));
  return g;
}
function soundwave() {
  const g = grp();
  for (let i = 0; i < 3; i++) g.add(mesh(new THREE.TorusGeometry(0.25 + i * 0.16, 0.035, 4, 18, Math.PI * 0.9), new THREE.MeshBasicMaterial({ color: '#7fd8ff', transparent: true, opacity: 0.9 - i * 0.2, depthWrite: false }), [0, 0, i * 0.12], [0, Math.PI / 2, -Math.PI * 0.45]));
  return g;
}

// --- projectiles (merged into entityView's BUILD) ------------------------------------------------------------
// the real 3D models replace these shapes where they exist (propModels.js: same size, same place)
const realProp = (name, fn) => (...a) => fitProp(name, fn(...a));
basketball = realProp('basketball', basketball); plate = realProp('plate', plate); peel = realProp('peel', peel);
flammekueche = realProp('flamm', flammekueche); chili = realProp('chili', chili); cowbell = realProp('cowbell', cowbell);
bucket = realProp('bucket', bucket); turntable = realProp('turntable', turntable); vape = realProp('vape', vape);
sampler = realProp('sampler', sampler); skateboard = realProp('skate', skateboard); dumbbell = realProp('dumbbell', dumbbell);
kettlebell = realProp('kettlebell', kettlebell); barbell = realProp('barbell', barbell); balloon = realProp('balloon', balloon);
carpet = realProp('carpet', carpet); speaker = realProp('speaker', speaker);

export function friendBuild(MODELS, catObj) {
  return {
    couscous: () => plate(),
    basketball: () => basketball(0.38),
    flammekueche: () => flammekueche(0.95),
    cowbell: () => cowbell(1.4),
    bucket: () => bucket(),
    drumstick: () => drumstick(),
    chili: () => chili(),
    greycat: () => greyCat(MODELS, catObj, 0.75),
    soundwave: () => soundwave(),
    heart: () => mesh(heartGeo(0.8), mat('#ff3a6a', { emissive: '#ff2050', emissiveIntensity: 0.5 })),
    dumbbell: () => dumbbell(1.6),
  };
}
export function greyCat(MODELS, catObj, s) {
  if (MODELS.greycat) {
    const c = MODELS.greycat.clone(true); c.scale.setScalar(s); c.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return grp(c);
  }
  return catObj(s, '#3a3a40');
}

// --- J'san's shiba ---------------------------------------------------------------------------------------------
// The model is rigged (tools/blender/rigs/shiba.json, rig.py): spine, neck, head, ears, a tail in three, four legs
// in three. Animated here, from what the sim's pet is doing (e.cmd, e.ct: friendKit.js): a trot or a gallop on the
// distance it covers, the wind-up and snap of a bite, a jump stretched out, legs tucked in the tornado, a bark
// puffed up then thrown forward, hanging on a foe and shaking it, dangling at the end of the leash; the tail wags.
export function petObj(MODELS, look) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  if (MODELS[look]) {
    const m = SkeletonUtils.clone(MODELS[look]);
    m.traverse((o) => {
      if (o.isMesh) { o.material = o.material.clone(); o.material.color.set('#fff2dc'); o.castShadow = true; o.frustumCulled = false; } // a lighter, beige sesame coat
    });
    m.scale.setScalar(0.95);
    // stand it on its paws
    const box = new THREE.Box3().setFromObject(m);
    m.position.y -= box.min.y;
    body.add(m);
    const bones = {};
    m.traverse((o) => { if (o.isBone) bones[o.name] = { b: o, rest: o.quaternion.clone(), cur: o.quaternion.clone() }; });
    g.userData.bones = bones;
  } else {
    const fur = mat('#e8c890'), cream = mat('#fbf0dc');
    body.add(mesh(G.ball(0.3, 1), fur, [0, 0.42, 0], null, [0.8, 0.75, 1.3]), mesh(G.ball(0.2, 1), fur, [0, 0.68, 0.36]), mesh(G.ball(0.12, 1), cream, [0, 0.62, 0.5]),
      mesh(G.cone(0.07, 0.16, 4), fur, [0.1, 0.86, 0.36]), mesh(G.cone(0.07, 0.16, 4), fur, [-0.1, 0.86, 0.36]), mesh(G.ball(0.14, 1), cream, [0, 0.62, -0.42]),
      ...[[-0.14, 0.24], [0.14, 0.24], [-0.14, -0.24], [0.14, -0.24]].map(([x, z]) => mesh(G.cyl(0.06, 0.06, 0.3, 6), cream, [x, 0.15, z])));
  }
  g.add(body);
  g.userData.body = body;
  const shadow = mesh(new THREE.CircleGeometry(0.4, 16), new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.3, depthWrite: false }), [0, 0.03, 0], [-Math.PI / 2, 0, 0]);
  g.add(shadow);
  return g;
}

const D2R = Math.PI / 180;
const _qx = new THREE.Quaternion(), _qz = new THREE.Quaternion(), _qt = new THREE.Quaternion(), _ax = new THREE.Vector3(1, 0, 0), _az = new THREE.Vector3(0, 0, 1);
const LEGS = ['fl', 'fr', 'hl', 'hr'];
// the pose of the dog: { bone: [pitch, side] } in degrees (pitch: + swings a leg forward, bends the neck down;
// side: the tail and the head turned)
function dogPose(e, t, sp, air, u) {
  const P = {};
  const add = (n, x, z = 0) => { const p = P[n] || (P[n] = [0, 0]); p[0] += x; p[1] += z; };
  const ct = e.ct || 0;
  const cmd = e.cmd || '';
  // gait: a trot (diagonal pairs) walking, a gallop (pairs, the back flexing) running
  if (!air && sp > 0.6 && cmd !== 'spin') {
    const gal = sp > 7;
    const ph = u.dist * (gal ? 1.7 : 2.6);
    const amp = gal ? 42 : 30;
    const off = gal ? { fl: 0, fr: 0.35, hl: Math.PI, hr: Math.PI + 0.35 } : { fl: 0, hr: 0, fr: Math.PI, hl: Math.PI };
    for (const L of LEGS) {
      const s = Math.sin(ph + off[L]), c = Math.cos(ph + off[L]);
      add(L + '_up', s * amp);
      // the lower leg folds while it swings forward (off the ground)
      const lift = Math.max(0, c);
      add(L + '_lo', (L[0] === 'f' ? -1 : 1) * lift * (gal ? 55 : 40));
      add(L + '_paw', (L[0] === 'f' ? 1 : -1) * lift * 25);
    }
    if (gal) { const f = Math.sin(ph); add('hips', f * 9); add('chest', -f * 7); add('neck', -f * 6); }
    add('tail1', -10, Math.sin(ph * 0.5) * 12);
  }
  // idle: panting, the tail wagging, the ears twitching now and then
  if (!cmd && sp <= 0.6 && !air) {
    add('chest', Math.sin(t * 14) * 1.5);
    add('head', Math.sin(t * 14) * 3 + Math.sin(t * 0.7) * 4, Math.sin(t * 0.45) * 14);
    if (Math.sin(t * 1.3) > 0.97) { add('ear_l', -25); add('ear_r', -25); }
  }
  // the tail always wags (faster when it fights)
  const wag = cmd ? 16 : 9;
  add('tail1', 0, Math.sin(t * wag) * 28);
  add('tail2', 0, Math.sin(t * wag - 0.7) * 20);
  add('tail3', 0, Math.sin(t * wag - 1.4) * 14);
  const body = (dz, pitch, dy = 0) => { P.__b = [dz, pitch, dy]; }; // the whole dog: forward (m), nose down (rad), up (m)
  const pounce = (k) => { // 0 crouched .. 1 stretched out
    add('hips', 18 - k * 32); add('chest', -12 + k * 18);
    for (const L of ['hl', 'hr']) { add(L + '_up', 55 - k * 105); add(L + '_lo', -75 + k * 80); add(L + '_paw', 25 - k * 25); }
    for (const L of ['fl', 'fr']) { add(L + '_up', -35 + k * 110); add(L + '_lo', 50 - k * 65); }
    add('neck', 35 - k * 65); add('head', 15 - k * 35);
    add('ear_l', -50 * k); add('ear_r', -50 * k);
    body(k * 0.3, 0.25 - k * 0.45, -0.08 * (1 - k));
  };
  switch (cmd) {
    case 'bite': {
      // crouched, then the snap forward at frame 6, then back
      const k = ct < 5 ? 0 : ct < 9 ? (ct - 5) / 4 : Math.max(0, 1 - (ct - 9) / 7);
      pounce(ct < 5 ? 0.15 : k);
      if (ct >= 5 && ct <= 9) add('head', -20 + Math.sin(ct * 2.5) * 10);
      break;
    }
    case 'dash': {
      if (air && sp < 2) { // hanging on to the foe, gnawing and shaking it
        pounce(0.7);
        add('neck', 0, Math.sin(t * 40) * 28); add('head', Math.sin(t * 34) * 12, Math.sin(t * 40) * 20);
        for (const L of LEGS) add(L + '_lo', Math.sin(t * 30 + L.length) * 25);
      } else if (air) pounce(0.9);
      else { add('neck', -10); add('ear_l', -40); add('ear_r', -40); add('tail1', -25); }
      break;
    }
    case 'jump': {
      const k = ct < 3 ? 0 : Math.min(1, (ct - 3) / 4);
      pounce(k);
      if (ct >= 3 && ct <= 14) body(0, -0.75 * k, 0); // nose to the sky, the headbutt up
      if (ct > 14) { for (const L of LEGS) add(L + '_lo', L[0] === 'f' ? 60 : -60); add('neck', 30); body(0, 0.2, 0); } // tucked on the way down
      break;
    }
    case 'spin': {
      for (const L of LEGS) { add(L + '_up', L[0] === 'f' ? 70 : -70); add(L + '_lo', L[0] === 'f' ? -70 : 70); }
      add('tail1', -55, 0); add('tail2', -40); add('neck', -25); add('ear_l', -60); add('ear_r', -60);
      body(0, -0.15, 0.25 + Math.abs(Math.sin(ct * 0.55)) * 0.15);
      break;
    }
    case 'bark': {
      // puffed up (head back, chest out), then the bark thrown forward at frame 4
      if (ct < 4) { add('neck', -50); add('head', -25); add('chest', -14); add('ear_l', -45); add('ear_r', -45); for (const L of ['fl', 'fr']) add(L + '_up', 25); body(-0.08, -0.3, 0.05); }
      else if (ct < 14) {
        const k = Math.sin((ct - 4) / 10 * Math.PI);
        add('neck', 35 * k); add('head', -45 * k); add('chest', 10 * k); add('ear_l', -60 * k); add('ear_r', -60 * k);
        for (const L of ['fl', 'fr']) { add(L + '_up', -30 * k); add(L + '_lo', 15 * k); }
        body(0.18 * k, 0.12 * k);
      }
      for (const L of ['hl', 'hr']) add(L + '_up', 15);
      break;
    }
    case 'hold': { // in J'san's arms: curled up, the legs tucked
      for (const L of LEGS) { add(L + '_up', L[0] === 'f' ? 50 : -50); add(L + '_lo', L[0] === 'f' ? -60 : 60); }
      add('neck', -15); add('ear_l', -30); add('ear_r', -30); body(0, -0.2, 0);
      break;
    }
    case 'thrown': { // flung: stretched out like a missile, mouth first
      pounce(1); body(0.1, 0.15, 0);
      break;
    }
    case 'spin2': { // a sprint once around him
      for (const L of LEGS) { add(L + '_up', (L[0] === 'f' ? 55 : -55) * Math.sin(t * 34 + (L[0] === 'f' ? 0 : 3))); add(L + '_lo', 30); }
      add('neck', -20); add('ear_l', -60); add('ear_r', -60); add('tail1', -40);
      body(0, 0, 0.05);
      break;
    }
    case 'swing': { // held by the tail and swung: the body along the arc, the nose out
      for (const L of LEGS) { add(L + '_up', L[0] === 'f' ? -40 : 40); add(L + '_lo', 10); }
      add('neck', 20); add('ear_l', -70); add('ear_r', -70);
      body(0, -(e.ph || 0), 0);
      break;
    }
    case 'poop': { // squatting, the back curved, the tail up; it looks around
      const k = Math.min(1, ct / 6);
      add('hips', 35 * k); for (const L of ['hl', 'hr']) { add(L + '_up', 55 * k); add(L + '_lo', -70 * k); }
      add('tail1', -60 * k); add('head', Math.sin(t * 2.5) * 8, Math.sin(t * 1.7) * 25);
      body(0, -0.15 * k, -0.12 * k);
      break;
    }
    case 'lift': {
      if (e.o && e.o.wind) { // the shiba-copter: the tail straight up, spun like a rotor; the legs out (he holds two of them)
        add('tail1', -95, 0); add('tail2', 0, 0); add('tail3', 0, 0);
        for (const L of LEGS) add(L + '_up', L[0] === 'f' ? -50 : 50);
        add('neck', -10); add('ear_l', -80); add('ear_r', -80);
        break;
      }
      // the leash: it hauls him up, the legs dangling and paddling
      add('neck', -35); add('head', -20); add('hips', -10);
      for (const L of LEGS) { add(L + '_up', (L[0] === 'f' ? 20 : -20) + Math.sin(t * 18 + L.charCodeAt(1)) * 25); add(L + '_lo', Math.sin(t * 18 + 1 + L.charCodeAt(0)) * 20); }
      break;
    }
    default:
      if (air) { // a fall: legs out to land
        for (const L of LEGS) { add(L + '_up', L[0] === 'f' ? 25 : -25); add(L + '_lo', L[0] === 'f' ? -15 : 15); }
        add('ear_l', -20); add('ear_r', -20);
      }
  }
  return P;
}

function makeRotor(o) {
  const disc = new THREE.Mesh(new THREE.RingGeometry(0.08, 0.75, 24), new THREE.MeshBasicMaterial({ color: '#e8b070', transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }));
  const blade = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.03, 0.12), new THREE.MeshStandardMaterial({ color: '#c8843a', roughness: 0.9 }));
  const tilt = new THREE.Group(); tilt.add(disc); tilt.add(blade); disc.rotation.x = -Math.PI / 2;
  const r = new THREE.Group(); r.add(tilt);
  r.position.set(0, 0.95, -0.3); r.rotation.x = 0.45; // tipped toward the camera: the disc reads from the side
  r.userData.spin = tilt;
  r.visible = false;
  o.add(r);
  return r;
}
export function updatePet(o, e, dt, t) {
  o.visible = !e.hidden;
  const b = o.userData.body;
  const target = e.a || 0;
  let d = target - (o.userData.yaw ?? target);
  while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
  o.userData.yaw = (o.userData.yaw ?? target) + d * Math.min(1, dt * 14);
  o.rotation.y = o.userData.yaw - Math.sign(Math.sin(o.userData.yaw) || 1) * 0.35;
  // its speed and whether it is airborne, from where it is drawn (the same on every machine)
  const u = o.userData;
  const px = o.position.x, py = o.position.y;
  const vx = u.lx === undefined ? 0 : (px - u.lx) / Math.max(dt, 1e-3), vy = u.ly === undefined ? 0 : (py - u.ly) / Math.max(dt, 1e-3);
  u.lx = px; u.ly = py;
  u.sp = (u.sp || 0) + (Math.abs(vx) - (u.sp || 0)) * Math.min(1, dt * 10);
  u.dist = (u.dist || 0) + Math.abs(vx) * dt;
  u.ground = u.ground ?? py;
  if (Math.abs(vy) < 0.3) u.ground = Math.min(u.ground + dt * 0.5, py);
  const air = py - u.ground > 0.25 || e.cmd === 'lift';
  if (!air) u.ground = py;
  // whole body: a bob at the trot, the old tilts when there is no rig
  const bones = u.bones;
  b.position.y = u.sp > 0.6 && !air ? Math.abs(Math.sin(u.dist * 2.6)) * 0.05 : Math.sin(t * 3) * 0.01;
  b.rotation.z = e.cmd === 'spin' ? Math.sin(t * 30) * 0.2 : 0;
  if (!bones) {
    b.rotation.x = e.cmd === 'jump' ? -0.6 : e.cmd === 'bite' ? 0.25 : 0;
    return;
  }
  const P = dogPose(e, t, u.sp, air, u);
  // the rotor: a blur disc spinning over its tail (the shiba-copter)
  const rot = u.rotor || (u.rotor = makeRotor(o));
  rot.visible = e.cmd === 'lift' && !!(e.o && e.o.wind);
  if (rot.visible) { rot.userData.spin.rotation.y = t * 38; rot.userData.spin.children[0].material.opacity = 0.32 + Math.sin(t * 60) * 0.08; }
  const k = 1 - Math.exp(-dt * (e.cmd ? 26 : 12));
  // the whole body: lunges, rears up, stretches (smoothed like the bones)
  const W = P.__b || [0, 0, 0];
  u.bz = (u.bz || 0) + (W[0] - (u.bz || 0)) * k; u.bp = (u.bp || 0) + (W[1] - (u.bp || 0)) * k; u.by = (u.by || 0) + (W[2] - (u.by || 0)) * k;
  b.position.z = u.bz; b.position.y += u.by; b.rotation.x = u.bp;
  for (const [n, B] of Object.entries(bones)) {
    const p = P[n];
    _qt.copy(B.rest);
    if (p) { _qx.setFromAxisAngle(_ax, p[0] * D2R); _qz.setFromAxisAngle(_az, p[1] * D2R); _qt.multiply(_qx).multiply(_qz); }
    B.cur.slerp(_qt, k);
    B.b.quaternion.copy(B.cur);
  }
}

// --- props held on the rig sockets (character space: +Y up, +Z forward, origin = the palm) --------------------
export const FRIEND_PROPS = {
  basketball: () => basketball(0.24),
  plate: () => { const p = plate(); p.scale.setScalar(0.7); p.rotation.x = Math.PI / 2; return grp(p); }, // shown face on (readable)
  peel: () => { const p = peel(); p.rotation.x = -1.2; p.position.z = 0.15; return grp(p); },
  flamm: () => flammekueche(0.5),
  rum: () => fitProp('rum', bottle('#3a1a08', '#8a4a1a')),
  ricard: () => fitProp('ricard', bottle('#f2d23a', '#e8d870')),
  chili: () => { const c = chili(); c.scale.setScalar(0.7); return c; },
  cowbell: () => cowbell(0.9),
  bucket: () => { const b = bucket(); b.scale.setScalar(0.7); return b; },
  turntable: () => { const t = turntable(); t.rotation.x = -1.3; return grp(t); },
  record: () => record(),
  vape: () => vape(),
  sampler: () => sampler(),
  skate: () => { const s = skateboard(); s.rotation.x = -Math.PI / 2; s.position.z = 0.3; return grp(s); },
  dumbbell: () => dumbbell(1.0),
  kettlebell: () => kettlebell(),
  barbell: () => barbell(),
  plates: () => grp(plateWeight()),
  greycat: (MODELS, catObj) => greyCat(MODELS, catObj, 0.5),
};
// things attached to the body (feet / hips / above the head) rather than a hand
export const FRIEND_BODY = { carpet, skateboard, speaker, balloon, turntable };

// --- effects of their moves (called from fx.js) ----------------------------------------------------------------
export function friendFx(fx, ev, W) {
  const P = fx.particles, A = fx.audio;
  const pan = (x) => fx.pan(x);
  switch (ev.type) {
    case 'flame': { // a cone of fire (or straight up)
      const n = 5;
      for (let i = 0; i < n; i++) {
        const k = 0.3 + Math.random() * 0.7;
        const vx = ev.up ? (Math.random() - 0.5) * 2 : Math.sin(ev.a) * (9 + Math.random() * 5);
        const vy = ev.up ? 9 + Math.random() * 5 : (Math.random() - 0.3) * 2.5;
        P.burst('spark', ev.x, ev.y, 0.3, 1, i % 2 ? '#ffb02a' : '#ff5a1a', { speed: 0.8, vx, vy, g: -6, life: 0.32 * k + 0.12, s: 1.6 });
      }
      if (Math.random() < 0.4) P.burst('dust', ev.x + (ev.up ? 0 : Math.sin(ev.a) * 2.4), ev.y + (ev.up ? 2 : 0.4), 0.3, 1, '#3a3030', { speed: 1, vy: 2, g: -2, life: 0.8, s: 0.9 });
      return true;
    }
    case 'burnFx': P.burst('spark', ev.x + (Math.random() - 0.5) * 0.5, ev.y, 0.4, 2, Math.random() < 0.5 ? '#ff7a1a' : '#ffd23a', { speed: 1.5, vy: 3, g: -4, life: 0.4 }); return true;
    case 'ignite': P.burst('spark', ev.x, ev.y, ev.z, 9, '#ff6a1a', { speed: 4, g: -3, life: 0.35, s: 0.75 }); fx.popups.text('ÇA BRÛLE !', ev.x, ev.y + 1.2, ev.z, '#ff7a1a', 0.9); A && A.sfx('flameL', pan(ev.x), 0.6); return true;
    case 'fart': {
      const n = ev.trail ? 2 : ev.big ? 9 : 6;
      P.burst('dust', ev.x, ev.y, 0.2, ev.big ? 6 : n, ev.trail ? '#9ac83a' : '#7aa82a', { speed: ev.jet ? 3 : 4, vy: ev.jet ? -4 : 0.5, g: -1, life: ev.trail ? 0.6 : 1.0, s: ev.big ? 1.15 : 0.9 });
      if (!ev.trail) { A && A.sfx('fart', pan(ev.x), ev.big ? 1 : 0.8); if (Math.random() < 0.6) fx.popups.text(['PROUT !', 'PFFRRT !', 'BRRAP !'][Math.floor(Math.random() * 3)], ev.x, ev.y + 1.2, 0, '#9ad83a', ev.big ? 1.2 : 0.9); }
      return true;
    }
    case 'couscous': P.burst('flake', ev.x, ev.y + 0.3, 0.2, 18, '#f2d38a', { speed: 7, g: 14, life: 1.0 }); P.burst('drop', ev.x, ev.y + 0.3, 0.2, 8, '#e07a20', { speed: 5 }); A && A.sfx('couscous', pan(ev.x)); return true;
    case 'bucket': P.burst('flake', ev.x, ev.y + 0.3, 0.2, 20, '#c8782a', { speed: 6, g: 14 }); fx.rig.shake(0.25); fx.popups.text('POULET !', ev.x, ev.y + 1.4, 0, '#ff4040', 0.9); return true;
    case 'pastis': {
      // poured: a thin stream of small drops falling to the floor (not a spray of balls)
      if (ev.pour) { P.burst('drop', ev.x, ev.y, 0.2, 2, '#d8bd5a', { speed: 1.2, vy: -2, g: 16, life: 0.4, s: 0.45 }); return true; }
      // the rocket's jet: a tight stream of pastis behind her (against the way she flies), foam and fizz in it
      if (ev.jet) {
        const sx = -Math.sin(ev.a || 0), sy = -Math.cos(ev.a || 0);
        P.burst('drop', ev.x + sx * 0.1, ev.y + sy * 0.1, 0.2, 8, '#f6e27a', { speed: 1.2, vx: sx * 11, vy: sy * 11, g: 8, life: 0.4, s: 0.75 });
        P.burst('dust', ev.x, ev.y, 0.15, 2, '#fff4c4', { speed: 1, vx: sx * 3, vy: sy * 3, g: -0.5, life: 0.35, s: 0.38 });
        P.burst('spark', ev.x, ev.y, 0.15, 2, '#fff2a0', { speed: 2.5, vx: sx * 6, vy: sy * 6, g: 4, life: 0.22 });
        return true;
      }
      const vx = ev.up || ev.jet ? (Math.random() - 0.5) * 2 : ev.pour ? Math.sin(W.fighters[0] ? 0 : 0) : Math.sin(ev.a || 0) * 5;
      P.burst('drop', ev.x, ev.y, 0.3, ev.jet ? 6 : 8, '#f6e27a', { speed: ev.jet ? 2 : 3, vx, vy: ev.up ? 10 : ev.jet ? -9 : 1, g: 16, life: 0.8 });
      return true;
    }
    case 'chiliDust': P.burst('flake', ev.x, ev.y, 0.2, 18, '#d81a1a', { speed: 8, g: 6, life: 0.6 }); P.burst('spark', ev.x, ev.y, 0.2, 6, '#ff8a1a', { speed: 6, g: -2, life: 0.4 }); return true;
    case 'bark': {
      const F = W.fighters[ev.s];
      if (ev.id !== undefined) { if (!ev.dash) P.shockRing(ev.x, ev.y, 0.3, '#8c7c52', 0.7, 0.28); fx.popups.text('WOUF !', ev.x, ev.y + 0.9, 0, '#ffe08a', 1.1); A && A.sfx('bark', pan(ev.x), 1); if (!ev.dash) fx.rig.shake(0.2); }
      else if (F) { fx.popups.text(ev.small ? 'Wouf !' : 'WOUAF !', F.x, F.y + 1.2, 0, '#ffe08a', ev.small ? 0.7 : 1); A && A.sfx('bark', pan(F.x), ev.small ? 0.6 : 0.9); }
      return true;
    }
    case 'vape': P.burst('dust', ev.x, ev.y, 0.3, 7, '#f4f4ff', { speed: 3, vx: Math.sin(ev.a) * 4, g: -1, life: 1.1, s: 1.0 }); return true;
    case 'sample': P.shockRing(ev.x, ev.y, 0.3, '#7fd8ff', 0.8, 0.25); return true;
    case 'sob': { const F = W.fighters[ev.s]; if (!F) return true; for (const sd of [-1, 1]) P.burst('drop', ev.x + sd * 0.08, ev.y, 0.4, ev.big ? 14 : 5, '#7cc4ff', { speed: 0.7, vx: sd * (ev.big ? 4.5 : 2.8), vy: 2.2, g: 14, life: 0.65, s: 0.3 }); A && A.sfx('sob', pan(ev.x), 0.7); if (ev.big || Math.random() < 0.3) fx.popups.text(['OUIIIN !', 'Snif...', 'Bouhouhou !'][Math.floor(Math.random() * 3)], ev.x, ev.y + 0.8, 0, '#8ad8ff', 0.9); return true; }
    case 'tear': { const F = W.fighters[ev.s]; if (F) P.burst('drop', F.x + Math.sin(F.facing) * 0.12, F.y + F.height * 0.82, 0.35, 2, '#8ad8ff', { speed: 1, vy: 0.5, g: 14, life: 0.7 }); return true; }
    case 'hearts': for (let i = 0; i < Math.min(8, ev.n || 8); i++) P.burst('heart', ev.x, ev.y, 0.3, 1, i % 2 ? '#ff3a6a' : '#ff8ab4', { speed: 6, g: -2, life: 1.0, s: 1.2 }); fx.popups.text('ENVOÛTÉ !', ev.x, ev.y + 1.6, 0, '#ff6fb1', 1.1); A && A.sfx('heart', pan(ev.x)); return true;
    case 'speakerBoom': P.shockRing(ev.x, ev.y + 0.2, 0.3, '#ffffff', 2.2, 0.4); P.dust(ev.x, ev.y, 0, 18, '#c8c0b0', 1.8); fx.rig.shake(0.4); fx.popups.text('BOOM !', ev.x, ev.y + 1, 0, '#ffd23a', 1.2); A && A.sfx('bassDrop', pan(ev.x), 1.1); return true;
    default: return false;
  }
}
