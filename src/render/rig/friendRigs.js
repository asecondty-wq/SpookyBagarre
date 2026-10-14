// Rig settings of the seven friends (Aboueb, Tices, OMFU, Lolobiscotto, J'san, Nymano, BIDO): stance, and the props
// their moves bring out. Each prop sits on a socket and is shown while its F.va[] flag is up during a move
// (the flags are set by src/sim/chars/<id>.js).
import * as THREE from 'three';
import { mat, G, mesh } from '../materials.js';
import { ROT } from './library.js';
import { FRIEND_PROPS, FRIEND_BODY } from '../friendsView.js';
import { greyHeld } from '../entityView.js';

const grp = (...c) => { const g = new THREE.Group(); c.forEach((o) => o && g.add(o)); return g; };
const hidden = (o) => { o.visible = false; return o; };

// the middle of the right hand (character space: +X left, +Y up, +Z forward), measured on the rigs
const HAND = {
  aboueb: [-0.505, 0.755, 0.055], tices: [-0.49, 0.83, 0.055], omfu: [-0.5, 0.76, 0.055], lolobiscotto: [-0.475, 0.775, 0.055],
  jsan: [-0.51, 0.8, 0.055], nymano: [-0.5, 0.725, 0.055], bido: [-0.55, 0.805, 0.055],
};
const left = (p) => [-p[0], p[1], p[2]];
const inHand = (id, build, side = 'R') => ({ bone: 'hand.' + side, at: side === 'R' ? HAND[id] : left(HAND[id]), build: () => hidden(build()) });
const onBone = (bone, at, build) => ({ bone, at, build: () => hidden(build()) });

// a prop is out while the move runs and its flag is up
const out = (F, i) => F.state === 'move' && (F.va[i] || 0) > 0.02;
function show(V, F, map) {
  for (const [name, i] of Object.entries(map)) {
    const s = V.sockets[name];
    if (s && s.obj) s.obj.visible = typeof i === 'function' ? i(F) : out(F, i);
  }
}

// keep a prop under the feet whatever the hips do (the sockets follow the hips)
const tmp = new THREE.Vector3();
function toFloor(V, o, lift = 0) {
  o.position.set(0, 0, 0);
  o.getWorldPosition(tmp);
  tmp.set(V.root.position.x, V.root.position.y + lift, V.root.position.z);
  o.parent.worldToLocal(tmp);
  o.position.copy(tmp);
}

// Aboueb's curls: a rope of curls out of the back of his head, as long as F.va[0] (metres)
function hairRope() {
  const g = new THREE.Group();
  const pivot = new THREE.Group();
  g.add(pivot);
  const m = mat('#3a2412', { roughness: 0.9 }), m2 = mat('#4e3018', { roughness: 0.9 });
  const balls = [];
  for (let i = 0; i < 26; i++) { const b = mesh(G.ball(0.13, 1), i % 2 ? m : m2); pivot.add(b); balls.push(b); }
  g.userData = { pivot, balls };
  g.visible = false;
  return g;
}
function layHair(o, len, t) {
  const { balls } = o.userData;
  const n = balls.length;
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    const b = balls[i];
    b.position.set(Math.sin(k * 9 + t * 20) * 0.05, Math.cos(k * 7 + t * 16) * 0.05 - k * 0.1, k * len);
    b.scale.setScalar(1.1 - k * 0.45);
  }
}

export const FRIEND_RIGS = {
  aboueb: {
    h: 1.85, guard: 'boxer', crouch: 0.04, wide: 0.03, lean: 4, stride: 1.05,
    sockets: {
      plate: inHand('aboueb', FRIEND_PROPS.plate),
      ball: inHand('aboueb', FRIEND_PROPS.basketball),
      hair: { bone: 'head', at: [0, 1.68, -0.08], build: hairRope },
      carpet: onBone('hips', [0, 0.04, 0], FRIEND_BODY.carpet),
    },
    update(V, F, o, t) {
      show(V, F, { plate: 3, ball: 1, carpet: 4 });
      const h = V.sockets.hair && V.sockets.hair.obj;
      if (h) {
        const spin = F.state === 'move' ? F.va[2] || 0 : 0;
        const len = F.state === 'move' ? Math.max(F.va[0] || 0, spin > 0 ? 1.3 : 0) : 0;
        h.visible = len > 0.05;
        if (h.visible) { layHair(h, len, t); h.userData.pivot.rotation.y = spin ? spin * 2 : 0; }
      }
      const c = V.sockets.carpet && V.sockets.carpet.obj;
      if (c && c.visible) { toFloor(V, c, 0.05); c.rotation.z = Math.sin(t * 9) * 0.06; }
    },
  },

  tices: {
    h: 1.82, guard: 'brute', crouch: 0.05, wide: 0.04, stride: 0.95,
    sockets: {
      peel: inHand('tices', FRIEND_PROPS.peel),
      flamm: inHand('tices', FRIEND_PROPS.flamm),
      // the rum bottle tipped into his mouth
      rum: { bone: 'head', at: [0, 1.6, 0.15], build: () => { const b = FRIEND_PROPS.rum(); b.rotation.x = -2.0; b.position.set(0, 0.19, 0.41); return hidden(grp(b)); } },
    },
    update(V, F) { show(V, F, { peel: 0, flamm: 1, rum: 2 }); },
  },

  omfu: {
    h: 1.85, guard: 'brute', crouch: 0.05, wide: 0.05, stride: 0.85,
    sockets: {
      deck: inHand('omfu', FRIEND_PROPS.turntable),
      record: inHand('omfu', FRIEND_PROPS.record),
      cowbell: inHand('omfu', FRIEND_PROPS.cowbell),
      bucket: inHand('omfu', FRIEND_PROPS.bucket),
      // the turntables set on a stand in front of him (scratch-wave)
      decks: onBone('hips', [0, 0.92, 0.55], () => grp(FRIEND_BODY.turntable(), mesh(G.cyl(0.04, 0.04, 0.9, 6), mat('#333338'), [0, -0.45, 0]))),
      // the subwoofer: in front for the bass drop, under his feet for the catapult
      speaker: onBone('hips', [0, 0, 0.8], FRIEND_BODY.speaker),
    },
    update(V, F, o, t) {
      show(V, F, { deck: 0, record: 1, cowbell: 2, bucket: 4, decks: 5, speaker: 3 });
      const r = V.sockets.record && V.sockets.record.obj;
      if (r && r.visible) r.rotation.y = t * 30;
      const s = V.sockets.speaker && V.sockets.speaker.obj;
      if (s && s.visible) {
        const under = F.move === 'sp_u';
        s.position.set(0, under ? -0.95 : 0, under ? -0.8 : 0);
        s.rotation.y = -Math.sign(Math.sin(F.facing) || 1) * Math.PI / 2; // the cone toward the camera

        s.scale.setScalar(1 + Math.max(0, Math.sin(t * 40)) * 0.05);
      }
    },
  },

  lolobiscotto: {
    h: 1.68, guard: 'low', crouch: 0.05, lean: 6, stride: 1.05,
    sockets: {
      ricard: inHand('lolobiscotto', FRIEND_PROPS.ricard),
      chili: inHand('lolobiscotto', FRIEND_PROPS.chili),
      cat: inHand('lolobiscotto', () => greyHeld(0.5)),
    },
    update(V, F) { show(V, F, { ricard: 0, chili: 1, cat: 2 }); },
  },

  jsan: {
    h: 1.82, guard: 'smug', crouch: 0.02, lean: -2, stride: 1.0,
    sockets: { vape: { bone: 'head', at: [-0.03, 1.6, 0.14], build: () => { const v = FRIEND_PROPS.vape(); v.rotation.x = 1.4; return hidden(grp(v)); } } },
    update(V, F) { show(V, F, { vape: 0 }); },
  },

  nymano: {
    h: 1.8, guard: 'low', crouch: 0.03, lean: 12, stride: 1.0,
    sockets: {
      board: inHand('nymano', FRIEND_PROPS.skate),
      sampler: inHand('nymano', FRIEND_PROPS.sampler),
      // the kickflip above his head, and the board under his feet when he rides it
      flip: onBone('hips', [0, 2.05, 0.25], () => grp(FRIEND_BODY.skateboard())),
      ride: onBone('hips', [0, -0.02, 0], () => grp(FRIEND_BODY.skateboard())),
    },
    // always sad: the head hangs low when he is not attacking
    extra(pose, F) {
      if (F.state !== 'move') pose.bones = { ...pose.bones, head: ROT(20, 0, 0), neck: ROT(8, 0, 0) };
      return pose;
    },
    update(V, F) {
      show(V, F, { board: 0, sampler: 1, flip: 2, ride: 3 });
      const f = V.sockets.flip && V.sockets.flip.obj;
      if (f && f.visible) f.rotation.z = (F.va[2] || 0) * Math.PI * 4;
      const r = V.sockets.ride && V.sockets.ride.obj;
      if (r && r.visible) toFloor(V, r, -0.04);
    },
  },

  bido: {
    h: 1.9, guard: 'brute', crouch: 0.04, wide: 0.06, lean: 2, stride: 0.9,
    sockets: {
      dumbbell: inHand('bido', FRIEND_PROPS.dumbbell),
      kettlebell: inHand('bido', FRIEND_PROPS.kettlebell),
      plateR: inHand('bido', () => { const p = FRIEND_PROPS.plates(); p.rotation.z = Math.PI / 2; return grp(p); }),
      plateL: inHand('bido', () => { const p = FRIEND_PROPS.plates(); p.rotation.z = Math.PI / 2; return grp(p); }, 'L'),
      // the barbell pressed over his head
      barbell: onBone('chest', [0, 2.2, 0.05], () => { const b = FRIEND_PROPS.barbell(); b.rotation.y = Math.PI / 2; return grp(b); }),
      balloon: onBone('chest', [0, 1.8, -0.05], () => { const b = FRIEND_BODY.balloon(); b.rotation.y = Math.PI / 2; return grp(b); }),
    },
    update(V, F, o, t) {
      show(V, F, { dumbbell: 0, kettlebell: 1, barbell: 2, plateR: 3, plateL: 3, balloon: 4 });
      const b = V.sockets.balloon && V.sockets.balloon.obj;
      if (b && b.visible) b.rotation.z = Math.sin(t * 3) * 0.12;
    },
  },
};
