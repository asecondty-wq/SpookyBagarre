// Optional Blender models (assets/models/<char>.glb) replacing the primitive parts of a fighter.
// A model contains objects named Body, Head, HandR, HandL, FootR, FootL, FootM, Prop (any subset);
// each object's origin is its pivot. Missing objects keep the primitive part.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const cache = {};
const NAMES = { Body: 'body', Head: 'head', HandR: 'hr', HandL: 'hl', FootR: 'fr', FootL: 'fl', FootM: 'fm' };

export async function preloadModels(ids) {
  await Promise.all(ids.map((id) => new Promise((res) => {
    loader.load(`assets/models/${id}.glb`, (g) => { cache[id] = g.scene; res(); }, undefined, () => res());
  })));
}

export function hasModel(id) { return !!cache[id]; }

export function applyModel(view) {
  const src = cache[view.char];
  if (!src) return;
  const scene = src.clone(true);
  const found = {};
  scene.traverse((o) => {
    if (NAMES[o.name]) found[NAMES[o.name]] = o;
    if (o.isMesh) {
      o.material = o.material.clone();
      const m = o.material;
      if (m.map) { m.map.magFilter = THREE.NearestFilter; m.map.minFilter = THREE.NearestMipmapLinearFilter; }
      // N64-style Gouraud: convert PBR to Lambert keeping the texture
      const lam = new THREE.MeshLambertMaterial({ map: m.map || null, color: m.color || new THREE.Color(1, 1, 1), vertexColors: !!o.geometry.attributes.color, transparent: m.transparent, alphaTest: m.alphaTest || 0 });
      o.material = lam;
    }
  });
  for (const [k, obj] of Object.entries(found)) {
    const part = view.parts[k];
    if (!part) continue;
    // replace the primitive meshes of the part, keep its extra children (eyes, props...) if the model says so
    const keep = obj.userData && obj.userData.keepExtras;
    const extras = part.children.filter((c) => c.userData && (c.userData.white || c.userData.keep));
    part.clear();
    obj.position.set(0, 0, 0);
    part.add(obj);
    if (keep) extras.forEach((c) => part.add(c));
  }
  view.modelLoaded = true;
}
