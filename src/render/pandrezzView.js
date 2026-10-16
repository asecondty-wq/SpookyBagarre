// Pandrezz on screen: the kamehameha (energy ball between the palms, the beam itself) and his two friends
// CD-Man and Vinylman (assets/models/cdman.glb, vinylman.glb from tools/blender/buddies.py, animated here).
import * as THREE from 'three';
import { glowTex, mat, G, mesh } from './materials.js';

// --- a soft volumetric glow: brightest where the surface faces the camera, additive ----------------------------
const glowVS = `varying vec3 vN; varying vec3 vV; varying vec2 vUv;
void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const glowFS = `uniform vec3 uColor; uniform float uPow; uniform float uOp; uniform float uTime; uniform float uFlow; uniform float uLen;
varying vec3 vN; varying vec3 vV; varying vec2 vUv;
void main(){
  float f = abs(dot(normalize(vN), normalize(vV)));
  float k = pow(f, uPow);
  float flow = 0.72 + 0.28 * sin(vUv.y * uLen * 5.0 - uTime * 34.0 + vUv.x * 18.85) * sin(vUv.y * uLen * 2.3 - uTime * 21.0);
  gl_FragColor = vec4(uColor * k * mix(1.0, flow, uFlow) * uOp, 1.0);
}`;
function glowMat(color, pow, op, flow = 0) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uPow: { value: pow }, uOp: { value: op }, uTime: { value: 0 }, uFlow: { value: flow }, uLen: { value: 1 } },
    vertexShader: glowVS, fragmentShader: glowFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}

// unit tube along +Z from 0 to 1
function tubeGeo(r, seg = 20) {
  const g = new THREE.CylinderGeometry(r, r, 1, seg, 8, true);
  g.rotateX(Math.PI / 2); g.translate(0, 0, 0.5);
  return g;
}

// the colours of the beam: Pandrezz's kamehameha (blue), ANBUU's light (gold and white)
const BEAM_C = {
  kame: { out: '#1a5cff', mid: '#3fb8ff', core: '#e8fbff', tip: '#2a7cff', muzzle: '#2a8cff', ring: '#a8ecff', flare: '#7fd4ff', flare2: '#9fe0ff' },
  holy: { out: '#ff9a1a', mid: '#ffd860', core: '#fffbe8', tip: '#ffb030', muzzle: '#ffc040', ring: '#fff0b0', flare: '#ffe0a0', flare2: '#fff4c8' },
};
export function beamObj(look) {
  const C = BEAM_C[look] || BEAM_C.kame;
  const g = new THREE.Group();
  const dirG = new THREE.Group();
  dirG.rotation.order = 'YXZ';
  g.add(dirG);
  const layers = [
    { r: 1.1, c: C.out, p: 1.7, o: 0.6, fl: 0.6 },
    { r: 0.68, c: C.mid, p: 1.8, o: 0.95, fl: 0.45 },
    { r: 0.32, c: C.core, p: 1.2, o: 1.25, fl: 0.2 },
  ].map((L) => { const m = new THREE.Mesh(tubeGeo(L.r), glowMat(L.c, L.p, L.o, L.fl)); m.frustumCulled = false; dirG.add(m); return m; });
  const sph = new THREE.SphereGeometry(1, 24, 14);
  const tip = new THREE.Group();
  tip.add(new THREE.Mesh(sph, glowMat(C.tip, 1.0, 1.0)), new THREE.Mesh(sph, glowMat(C.core, 1.6, 1.2)));
  tip.children[1].scale.setScalar(0.62);
  const muzzle = new THREE.Group();
  muzzle.add(new THREE.Mesh(sph, glowMat(C.muzzle, 1.0, 1.0)), new THREE.Mesh(sph, glowMat('#ffffff', 1.8, 1.3)));
  muzzle.children[1].scale.setScalar(0.6);
  dirG.add(tip, muzzle);
  // rings riding the beam, and a flat glow card at the tip
  const rings = [];
  for (let i = 0; i < 5; i++) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.05, 6, 28), new THREE.MeshBasicMaterial({ color: C.ring, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
    r.userData.ph = i / 5; dirG.add(r); rings.push(r);
  }
  const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: C.flare, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  dirG.add(flare);
  const flare2 = flare.clone(); flare2.material = flare.material.clone(); flare2.material.color.set(C.flare2);
  dirG.add(flare2);
  g.userData.beam = { dirG, layers, tip, muzzle, rings, flare, flare2, mats: [] };
  g.traverse((o) => { if (o.material && o.material.uniforms) g.userData.beam.mats.push(o.material); });
  return g;
}

export function updateBeam(o, e, t) {
  const B = o.userData.beam;
  const len = Math.max(0.05, e.len || 0), r = Math.max(0.05, e.r || 0.5);
  B.dirG.rotation.set(-(e.b || 0), e.a || 0, 0);
  const wob = 1 + Math.sin(t * 60) * 0.06 + Math.sin(t * 37) * 0.04;
  for (const L of B.layers) L.scale.set(r * wob, r * wob, len);
  B.tip.position.set(0, 0, len); B.tip.scale.setScalar(r * (1.25 + Math.sin(t * 45) * 0.1));
  B.muzzle.scale.setScalar(r * (0.85 + Math.sin(t * 52) * 0.08));
  B.flare.position.set(0, 0, len); B.flare.scale.setScalar(r * 5);
  B.flare2.position.set(0, 0, 0); B.flare2.scale.setScalar(r * 3.2);
  for (const m of B.mats) { m.uniforms.uTime.value = t; m.uniforms.uLen.value = len; }
  for (const ring of B.rings) {
    const p = (ring.userData.ph + t * 1.6) % 1;
    ring.position.set(0, 0, p * len);
    ring.scale.setScalar(r * (0.75 + p * 0.35));
    ring.material.opacity = 0.45 * Math.sin(p * Math.PI);
  }
}

// --- the energy ball between the palms (child of the fighter root) ------------------------------------------------
export function kameBall() {
  const g = new THREE.Group();
  const sph = new THREE.SphereGeometry(1, 24, 14);
  const outer = new THREE.Mesh(sph, glowMat('#2a7cff', 1.0, 1.0));
  const inner = new THREE.Mesh(sph, glowMat('#ffffff', 1.5, 1.3));
  inner.scale.setScalar(0.55);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: '#58c8ff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.setScalar(3.4);
  g.add(outer, inner, halo);
  // crackling sparks orbiting the ball
  const sparks = [];
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: '#c8f4ff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.userData.ph = i * 0.9; s.userData.ax = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    g.add(s); sparks.push(s);
  }
  // the light is not in the group: it stays in the scene, off at rest (a light appearing or disappearing makes
  // three.js recompile the shaders of every lit material in view: a long freeze the first time)
  const light = new THREE.PointLight('#5ccfff', 0, 4.5, 1.8);
  g.userData.ball = { outer, inner, halo, sparks, light, mats: [outer.material, inner.material] };
  return g;
}

const tA = new THREE.Vector3(), tB = new THREE.Vector3(), tQ = new THREE.Quaternion();
// lvl 0..1 (charge), fire 0..1 (beam pouring out of the hands)
export function updateKame(V, F, t) {
  const R = V.root;
  let b = V.model.kame;
  if (!b) { b = V.model.kame = kameBall(); R.add(b); (R.parent || R).add(b.userData.ball.light); }
  const B = b.userData.ball;
  // the kamehameha (neutral special, the rocket, the side smash's short one), and the spirit bomb (up smash, va[2]):
  // the same ball of energy between his palms, much bigger over his head
  const active = F.state === 'move' && (F.move === 'sp_n' || F.move === 'sp_u' || F.move === 'smash');
  const genki = F.state === 'move' && F.move === 'usmash' ? Math.min(1.4, F.va[2] || 0) : 0;
  const lvl = active ? Math.min(1, F.va[0] || 0) : 0;
  const fire = active ? Math.min(1, F.va[1] || 0) : 0;
  const k = Math.max(lvl, fire * 0.55, genki);
  b.visible = k > 0.015;
  B.light.intensity = b.visible ? 1.5 + k * 7 + Math.sin(t * 50) * 0.6 : 0;
  if (!b.visible) return;
  const hl = V.rig.bones['hand.L'], hr = V.rig.bones['hand.R'];
  if (!hl || !hr) return;
  hl.updateWorldMatrix(true, false); hr.updateWorldMatrix(true, false);
  hl.localToWorld(tA.set(0, 0.07, 0)); hr.localToWorld(tB.set(0, 0.07, 0));
  tA.add(tB).multiplyScalar(0.5);
  const s = genki ? 0.08 + genki * 0.34 : 0.05 + k * 0.19;
  if (genki) tA.y += s * 1.1; // the spirit bomb sits on his raised palms
  B.light.parent.worldToLocal(B.light.position.copy(tA));
  R.updateWorldMatrix(true, false);
  R.worldToLocal(tA);
  b.position.copy(tA);
  b.scale.setScalar(s * (1 + Math.sin(t * 40) * 0.08));
  for (const m of B.mats) m.uniforms.uTime.value = t;
  B.halo.material.opacity = 0.6 + Math.sin(t * 31) * 0.2;
  for (const sp of B.sparks) {
    const a = t * 9 + sp.userData.ph;
    tQ.setFromAxisAngle(sp.userData.ax, a);
    sp.position.set(1.25, 0, 0).applyQuaternion(tQ);
    sp.scale.setScalar(0.35 + 0.3 * Math.abs(Math.sin(a * 3)));
    sp.material.opacity = Math.sin(a * 5) > -0.2 ? 0.9 : 0;
  }
}

// --- CD-Man / Vinylman --------------------------------------------------------------------------------------------
export function buddyObj(look, MODELS) {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  g.add(inner);
  const M = MODELS[look];
  let parts = {};
  if (M) {
    const c = M.clone(true);
    c.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      const m = o.material = o.material.clone();
      m.metalness = 0;
      if (o.parent && o.parent.name === 'head' || o.name.startsWith('head')) {
        // the painted disc faces read better a little self-lit (there is no environment map to reflect)
        if (m.map) { m.emissive = new THREE.Color('#ffffff'); m.emissiveMap = m.map; m.emissiveIntensity = look === 'cdman' ? 0.35 : 0.18; m.roughness = 0.3; }
      }
    });
    inner.add(c);
    for (const n of ['head', 'torso', 'armL', 'armR', 'legL', 'legR']) parts[n] = c.getObjectByName(n);
  } else {
    // fallback: a little body with a disc head
    const top = mat(look === 'cdman' ? '#d4141c' : '#77787d'), low = mat(look === 'cdman' ? '#25386e' : '#36373c');
    const torso = mesh(G.rbox(0.48, 0.46, 0.32, 0.4), top, [0, 0.79, 0]);
    const head = mesh(G.cyl(look === 'cdman' ? 0.34 : 0.38, look === 'cdman' ? 0.34 : 0.38, 0.04, 28), mat(look === 'cdman' ? '#d8dbe2' : '#111114'), [0, 1.4, 0.03], [Math.PI / 2, 0, 0]);
    const mk = (x, y, m, h) => { const p = new THREE.Group(); p.position.set(x, y, 0); const l = mesh(G.box(0.14, h, 0.14), m, [0, -h / 2, 0]); p.add(l); return p; };
    parts = { torso, head, armL: mk(0.27, 0.93, top, 0.36), armR: mk(-0.27, 0.93, top, 0.36), legL: mk(0.1, 0.55, low, 0.5), legR: mk(-0.1, 0.55, low, 0.5) };
    Object.values(parts).forEach((p) => inner.add(p));
  }
  for (const p of Object.values(parts)) if (p) p.userData.r0 = p.rotation.clone();
  // the arrival: a glowing disc portal on the ground (CD-Man) / a falling streak (Vinylman)
  const portal = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.75, 40), new THREE.MeshBasicMaterial({
    color: look === 'cdman' ? '#c8f0ff' : '#ff4fa3', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  portal.rotation.x = -Math.PI / 2; portal.position.y = 0.04;
  g.add(portal);
  g.userData.buddy = { inner, parts, portal, look };
  return g;
}

const rot = (p, x = 0, y = 0, z = 0) => { if (!p) return; const r = p.userData.r0; p.rotation.set(r.x + x, r.y + y, r.z + z); };

// animated from the packed state: act (0 arriving, 1 busy, 2 leaving), tA (frames in the act), t (age)
export function updateBuddy(o, e, dt, time) {
  const U = o.userData.buddy, P = U.parts, I = U.inner;
  const tA = e.tA || 0, act = e.act || 0;
  o.rotation.set(0, e.a || 0, 0);
  I.position.set(0, 0, 0); I.rotation.set(0, 0, 0); I.scale.setScalar(1);
  ['head', 'armL', 'armR', 'legL', 'legR'].forEach((n) => rot(P[n]));
  // the disc head keeps facing the camera (it looks toward -Z and never turns), like the sprites of PANDREZZ:
  // seen edge-on a disc would vanish. headYaw is added to every head pose below.
  let ba = (e.a || 0) % (Math.PI * 2); if (ba > Math.PI) ba -= Math.PI * 2; if (ba < -Math.PI) ba += Math.PI * 2;
  U.headYaw = -ba * 0.85;
  rot(P.head, 0, U.headYaw, 0);
  const breathe = Math.sin(time * 5 + e.id) * 0.03;
  rot(P.armL, 0, 0, 0.12 + breathe); rot(P.armR, 0, 0, -0.12 - breathe);
  U.portal.material.opacity = 0;
  if (U.look === 'cdman') {
    if (act === 0) {
      // rises out of a spinning disc portal
      const k = Math.min(1, tA / 14);
      const ease = 1 - Math.pow(1 - k, 3);
      I.position.y = -1.6 * (1 - ease);
      I.scale.set(0.6 + ease * 0.4, 0.4 + ease * 0.6 + Math.sin(k * Math.PI) * 0.25, 0.6 + ease * 0.4);
      U.portal.material.opacity = 0.9 * (1 - k * 0.6);
      U.portal.rotation.z = time * 6; U.portal.scale.setScalar(1 + k * 0.5);
      rot(P.armL, 0, 0, 1.2 * (1 - k)); rot(P.armR, 0, 0, -1.2 * (1 - k));
    } else if (act === 1) {
      // three overhand throws (at tA 6, 22, 40), a little hop each time
      const w = [6, 22, 40].map((f) => tA - f).find((d) => d > -7 && d < 9);
      if (w !== undefined) {
        const s = w < 0 ? (w + 7) / 7 : 1 - w / 9; // wind up then follow through
        rot(P.armR, w < 0 ? 2.6 * s : 2.6 - (w / 9) * 3.6, 0, -0.2);
        I.rotation.y = w < 0 ? 0.35 * s : -0.4 * (1 - w / 9);
        I.position.y = Math.max(0, Math.sin(Math.max(0, w) / 9 * Math.PI)) * 0.12;
      }
      rot(P.head, 0, U.headYaw, Math.sin(time * 6) * 0.08);
      I.position.y += Math.abs(Math.sin(time * 9)) * 0.03;
    } else {
      // waves goodbye, then spins away into a disc
      const k = Math.min(1, tA / 16);
      rot(P.armR, 0, 0, -2.6 - Math.sin(tA * 0.9) * 0.4);
      if (k > 0.45) { const q = (k - 0.45) / 0.55; I.rotation.y = q * 14; I.scale.set(1 - q * 0.9, 1 - q * 0.6, 1 - q * 0.9); I.position.y = q * 0.6; }
    }
  } else {
    // Vinylman
    const spd = Math.hypot(e.vx || 0, e.vy || 0, e.vz || 0);
    if (act === 0) {
      // falling from the sky, stretched, arms up
      I.scale.set(0.82, 1.25, 0.82);
      rot(P.armL, 0, 0, 2.7); rot(P.armR, 0, 0, -2.7);
      rot(P.legL, 0.5, 0, 0); rot(P.legR, -0.3, 0, 0);
      I.rotation.y = time * 8;
      rot(P.head, 0, U.headYaw - I.rotation.y, 0);
    } else if (act === 1) {
      if (tA < 10) {
        // superhero landing squash
        const k = tA / 10;
        I.scale.set(1.3 - k * 0.3, 0.62 + k * 0.38, 1.3 - k * 0.3);
        rot(P.armL, 0, 0, 1.4 * (1 - k) + 0.2); rot(P.armR, 0, 0, -1.4 * (1 - k) - 0.2);
      } else if (tA < 46) {
        // spinning like a record on the platter, the disc head scratching back and forth
        const k = (tA - 10) / 36;
        I.rotation.y = (tA - 10) * 0.75 * (0.6 + Math.sin(k * Math.PI) * 0.8);
        rot(P.head, 0, U.headYaw - I.rotation.y, Math.sin(tA * 0.9) * 1.6);
        rot(P.armL, 0, 0, 1.45); rot(P.armR, 0, 0, -1.45);
        I.position.y = Math.abs(Math.sin(tA * 0.5)) * 0.08;
      } else {
        // drops the bass: crouch, then the big stomp
        const k = Math.min(1, (tA - 46) / 4);
        I.scale.set(1 + (1 - k) * 0.15, 1 - (1 - k) * 0.25 + (tA > 50 ? Math.sin((tA - 50) * 0.8) * 0.06 : 0), 1 + (1 - k) * 0.15);
        rot(P.armL, 0, 0, 2.6 * k); rot(P.armR, 0, 0, -2.6 * k);
        rot(P.head, 0, U.headYaw, (tA - 46) * 0.4);
      }
    } else {
      // jumps back to the sky
      I.scale.set(0.85, 1.2, 0.85);
      rot(P.armL, 0, 0, 2.7); rot(P.armR, 0, 0, -2.7);
      I.rotation.y = tA * 0.6;
      rot(P.head, 0, U.headYaw - I.rotation.y, 0);
    }
    if (spd > 20) I.scale.y *= 1.05;
  }
  if (e.knocked) { I.rotation.x = -1.2; I.rotation.z = (time * 14) % 6.28; }
}

// projectile looks thrown by CD-Man
export const DISC_BUILD = {
  cd: () => discProj('#dfe3ea', 0.34, 'cd'),
  cdgold: () => discProj('#ffd23a', 0.46, 'gold'),
};
const discTex = {};
function discMap(kind) {
  if (discTex[kind]) return discTex[kind];
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createConicGradient ? g.createConicGradient(0, 64, 64) : null;
  if (grd && kind === 'cd') {
    ['#e8ecf2', '#ff9ad0', '#c8a8ff', '#8fe0ff', '#a8ffb8', '#fff0a0', '#ffb08a', '#e8ecf2'].forEach((col, i, a) => grd.addColorStop(i / (a.length - 1), col));
    g.fillStyle = grd;
  } else g.fillStyle = kind === 'gold' ? '#ffd23a' : '#dfe3ea';
  g.beginPath(); g.arc(64, 64, 63, 0, 6.29); g.fill();
  if (kind === 'gold') { g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 3; for (let r = 30; r < 60; r += 7) { g.beginPath(); g.arc(64, 64, r, -0.6, 0.9); g.stroke(); } }
  g.fillStyle = '#c0c4cc'; g.beginPath(); g.arc(64, 64, 22, 0, 6.29); g.fill();
  g.fillStyle = '#22252b'; g.beginPath(); g.arc(64, 64, 9, 0, 6.29); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (discTex[kind] = t);
}
function discProj(rim, r, kind) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ map: discMap(kind), roughness: 0.25, metalness: 0, emissive: '#ffffff', emissiveMap: discMap(kind), emissiveIntensity: kind === 'gold' ? 0.5 : 0.3 });
  const d = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.025, 28), [new THREE.MeshStandardMaterial({ color: rim, roughness: 0.3 }), m, m]);
  g.add(d);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: kind === 'gold' ? '#ffd23a' : '#bfe8ff', transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.scale.setScalar(r * 4);
  g.add(glow);
  g.userData.disc = d;
  return g;
}
