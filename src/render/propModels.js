// Real 3D models for the props (Tripo, from Codex reference images: tools/art/props3d.ps1, tools/art/props3d_models.ps1).
// The props are still built as simple shapes (friendsView.js, rig/chars.js); when a model exists in assets/models/props,
// it replaces the shape exactly where the shape was: same size (its largest side), same centre, its axes turned to
// match the shape's (longest to longest, thinnest to thinnest), so every socket, hand and projectile keeps working.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const PROP_NAMES = ['basketball', 'plate', 'peel', 'flamm', 'rum', 'ricard', 'chili', 'cowbell', 'bucket', 'turntable', 'vape',
  'sampler', 'skate', 'dumbbell', 'kettlebell', 'barbell', 'balloon', 'carpet', 'speaker', 'burger', 'grater', 'bat', 'guitar'];
// per prop fixes after the automatic fit: extra rotation (radians, applied in the shape's frame), size factor, and `up`:
// keep the model standing (its up axis on the shape's up axis), for shapes about as tall as they are wide
const FIX = { cowbell: { up: true }, kettlebell: { up: true }, bucket: { up: true },
  bat: { rot: [Math.PI, 0, 0] }, grater: { rot: [Math.PI, 0, 0] },
  guitar: { rot: [Math.PI, 0, 0] } }; // the head of the guitar in the palm, its body out // handle in the palm (the shapes start at the palm)
const GLB = {};

export function preloadProps(names = PROP_NAMES) {
  const loader = new GLTFLoader();
  return Promise.all(names.map((n) => new Promise((res) => {
    loader.load(`assets/models/props/${n}.glb`, (g) => {
      g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; if (o.material && o.material.map) o.material.map.anisotropy = 4; } });
      GLB[n] = g.scene; res();
    }, undefined, () => res()); // no model yet: the shape stays
  })));
}

export const hasProp = (n) => !!GLB[n];

const _b = new THREE.Box3(), _s = new THREE.Vector3(), _c = new THREE.Vector3();
function sortedAxes(size) { return [0, 1, 2].sort((a, b) => size.getComponent(b) - size.getComponent(a)); }

// returns a group holding the model fitted to the shape `prim` (or `prim` itself when there is no model)
export function fitProp(name, prim) {
  const src = GLB[name];
  if (!src) return prim;
  prim.updateMatrixWorld(true);
  _b.setFromObject(prim); _b.getSize(_s); _b.getCenter(_c);
  const ps = _s.clone(), pc = _c.clone();
  const m = src.clone(true);
  // turn the model so its axes (sorted by length) land on the shape's
  const mb = new THREE.Box3().setFromObject(m), ms = mb.getSize(new THREE.Vector3());
  const fix = FIX[name] || {};
  let pa = sortedAxes(ps), ma = sortedAxes(ms);
  if (fix.up) { // y stays y; the longer horizontal side of each goes together
    const hor = (v) => (v.x >= v.z ? [0, 2] : [2, 0]);
    pa = [...hor(ps), 1]; ma = [...hor(ms), 1];
  }
  const basis = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  for (let i = 0; i < 3; i++) basis[ma[i]].setComponent(pa[i], 1);
  const M = new THREE.Matrix4().makeBasis(basis[0], basis[1], basis[2]);
  if (M.determinant() < 0) basis[ma[fix.up ? 1 : 2]].negate(), M.makeBasis(basis[0], basis[1], basis[2]);
  const holder = new THREE.Group();
  const inner = new THREE.Group();
  inner.add(m);
  inner.quaternion.setFromRotationMatrix(M);
  if (fix.rot) inner.quaternion.premultiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...fix.rot)));
  holder.add(inner);
  holder.updateMatrixWorld(true);
  const hb = new THREE.Box3().setFromObject(holder), hs = hb.getSize(new THREE.Vector3());
  const k = (Math.max(ps.x, ps.y, ps.z) / Math.max(hs.x, hs.y, hs.z, 1e-4)) * (fix.size || 1);
  inner.scale.setScalar(k);
  holder.updateMatrixWorld(true);
  const hc = new THREE.Box3().setFromObject(holder).getCenter(new THREE.Vector3());
  inner.position.add(pc.sub(hc));
  holder.userData = prim.userData; // keep what the effects look for (spinning disc, ...)
  return holder;
}
