// A rigged fighter model (assets/models/<id>.glb from tools/blender/rig.py): skinned mesh + skeleton, animated by
// the procedural Rig (springs) and Poser (stance, IK feet, gait, reactions, moves), with held props on sockets.
//   pivot (whole-body spins, lying down) -> squash (scaled about the feet) -> glTF scene (bones + skinned mesh)
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { Rig } from './animator.js';
import { Poser } from './poser.js';
import { RIGS } from './chars.js';
import { STYLE } from '../style.js';
import { buildClips, ClipMixer, fixName } from './nativeClips.js';
import { applyReach } from './reach.js';

const loader = new GLTFLoader();
const cache = {};
const clipCache = {}; // id -> clips baked in the model (Tripo characters, tools/art/tripo_pack.py)

export function preloadRigs(ids) {
  return Promise.all(ids.filter((id) => RIGS[id]).map((id) => new Promise((res) => {
    loader.load(`assets/models/${id}.glb`, (g) => { cache[id] = g.scene; if (g.animations && g.animations.length) clipCache[id] = buildClips(g.animations); res(); }, undefined, () => res());
  })));
}
export const hasRig = (id) => !!(cache[id] && RIGS[id]);

const TWO_PI = Math.PI * 2;
const wrap = (a) => a - TWO_PI * Math.round(a / TWO_PI);

export class RigModel {
  constructor(id) {
    const cfg = RIGS[id];
    this.cfg = cfg;
    this.h = cfg.h;
    this.pivot = new THREE.Group();
    this.squashG = new THREE.Group();
    this.pivot.add(this.squashG);
    this.pivot.position.y = this.h * 0.5;
    this.squashG.position.y = -this.h * 0.5;
    const scene = SkeletonUtils.clone(cache[id]);
    this.meshes = [];
    scene.traverse((o) => {
      if (o.isBone) o.name = fixName(o.name);
      if (o.isMesh) {
        const src = o.material;
        let m;
        if (STYLE.smooth) {
          m = new THREE.MeshStandardMaterial({ map: src.map || null, color: 0xffffff, roughness: 0.72, metalness: 0.0 });
          if (m.map) { m.map.anisotropy = 4; }
        } else {
          m = new THREE.MeshLambertMaterial({ map: src.map || null, color: 0xffffff });
          if (m.map) { m.map.magFilter = THREE.NearestFilter; m.map.minFilter = THREE.NearestMipmapLinearFilter; m.map.needsUpdate = true; }
        }
        o.material = m;
        o.castShadow = true;
        o.receiveShadow = false;
        o.frustumCulled = false; // skinned bounds do not follow the bones
        this.meshes.push(o);
      }
    });
    this.squashG.add(scene);
    this.scene = scene;
    this.rig = new Rig(scene, { secondary: cfg.secondary || {} });
    // a packed Tripo character plays its own clips (idle, walk, run, strikes, reactions...) over the procedural pose
    this.mixer = clipCache[id] ? new ClipMixer(clipCache[id]) : null;
    this.poser = new Poser(cfg, this.mixer);
    // sockets for props: placed at their rest point, oriented like the character at rest
    scene.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(scene.matrixWorld).invert();
    this.sockets = {};
    for (const [name, s] of Object.entries(cfg.sockets || {})) {
      const bone = this.rig.bones[s.bone];
      if (!bone) continue;
      const bw = new THREE.Matrix4().multiplyMatrices(inv, bone.matrixWorld);
      const local = new THREE.Matrix4().copy(bw).invert().multiply(new THREE.Matrix4().makeTranslation(s.at[0], s.at[1], s.at[2]));
      const sock = new THREE.Object3D();
      local.decompose(sock.position, sock.quaternion, sock.scale);
      bone.add(sock);
      const obj = s.build();
      obj.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      sock.add(obj);
      this.sockets[name] = { sock, obj };
    }
    this.spin = { x: 0, y: 0, lie: 0 };
    this.first = true;
  }

  // landing squash / hit recoil: victims (k < 0) are also shoved backward at the hips
  impulse(k) { this.rig.impulse(k * 2.2, k < 0 ? k * 0.45 : k * 0.15); }

  // F: rendered fighter state, M: its move (or null), t: time (s), dt: frame time (s), worldPos: root position
  update(F, M, t, dt, worldPos) {
    const out = this.poser.build(F, M, t, dt);
    const pose = out.pose;
    const cfg = this.cfg;
    if (cfg.jaw && this.rig.bones[cfg.jaw.bone]) {
      const j = Math.max(pose.jaw || 0, F.state === 'hitstun' ? 1 : 0);
      pose.bones = { ...pose.bones, [cfg.jaw.bone]: { rot: [cfg.jaw.open * j, 0, 0] } };
    }
    const clip = this.mixer ? this.mixer.update(out.layers || [], Math.min(dt, 1 / 20), out.fade || 14) : null;
    if (clip) clip.hip = out.hip; // a move whose clip must not move the hips (nativeMoves.js: hip 'none' | 'y')
    this.rig.update(pose, Math.min(dt, 1 / 20), worldPos, clip);
    if (this.first) { this.rig.snap(); this.first = false; }
    // squash & stretch of the whole model about the feet
    const s = this.rig.squash;
    this.squashG.scale.set(s.x, s.y, s.z);
    // whole-body motion asked by the poser
    const b = out.body || {};
    const S = this.spin, k = 1 - Math.exp(-dt * 12);
    if (b.spinX !== undefined) S.x = b.spinX; else S.x = wrap(S.x) * (1 - k);
    if (b.spinY !== undefined) S.y = b.spinY; else if (out.spin) S.y = out.spin; else S.y = wrap(S.y) * (1 - k);
    S.lie += ((b.lie ? 1 : 0) - S.lie) * k;
    // the spin centre: mid-height, or lower for a roll (the centre of the curled-up ball)
    const pv = b.pivot ?? 0.5;
    this.pivot.rotation.set(S.x - S.lie * 1.5, S.y, 0);
    this.pivot.position.y = this.h * (pv - S.lie * 0.36);
    this.squashG.position.y = -this.h * pv;
    // the limb (or weapon) that throws the blow stretched into its hitbox (cfg.reach, else DEFAULT_REACH: reach.js)
    this.pivot.position.z = 0;
    applyReach(this, F, M);
    return out;
  }

  dispose() {
    for (const m of this.meshes) m.material.dispose();
  }
}
