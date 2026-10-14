// All the props in a row (the real model, the old shape behind it in grey wireframe), for a screenshot:
//   in a quick match: const S = await import('/tools/dev/propsheet.js'); S.show()
import * as THREE from 'three';
import { FRIEND_PROPS, FRIEND_BODY } from '/src/render/friendsView.js';

export function show(names) {
  const R = __app.renderer, root = new THREE.Group();
  const list = names || ['basketball', 'plate', 'peel', 'flamm', 'rum', 'ricard', 'chili', 'cowbell', 'bucket', 'turntable', 'vape', 'sampler', 'skate', 'dumbbell', 'kettlebell', 'barbell'];
  const body = { balloon: FRIEND_BODY.balloon, carpet: FRIEND_BODY.carpet, speaker: FRIEND_BODY.speaker };
  const all = [...list, 'balloon', 'carpet', 'speaker'];
  all.forEach((n, i) => {
    const f = FRIEND_PROPS[n] || body[n];
    if (!f) return;
    const o = f();
    o.traverse((m) => { m.visible = true; });
    const b = new THREE.Box3().setFromObject(o), s = b.getSize(new THREE.Vector3());
    const k = 1.1 / Math.max(s.x, s.y, s.z, 0.01);
    o.scale.multiplyScalar(k);
    o.position.set((i % 7) * 1.6 - 4.8, 3.6 - Math.floor(i / 7) * 1.5, 2);
    root.add(o);
  });
  R.scene.add(root);
  const cam = R.camera; cam.position.set(0, 2.2, 10.5); cam.lookAt(0, 2.2, 2); cam.updateMatrixWorld();
  R.render();
  return root;
}
