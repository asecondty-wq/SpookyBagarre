// A piece of the model's own mesh that can come off (Tices' cap: he throws it). The vertices of the piece are found
// once on the bind pose, by height and by the colour of the texture under them; to take it off they are folded into
// the skull (the skinning keeps them there), and a cover made of the same triangles, a little smaller and the colour
// of his hair, shows instead (the scalp under the cap). No new file: it works on whatever the pack wrote.
//   const C = pieceSetup(RM, { minY, pick(rgb, p), cover: '#1a1410', shrink: 0.9 });  C.show(on)
import * as THREE from 'three';

function texReader(tex) {
  const img = tex && tex.image;
  if (!img || !img.width) return null;
  const cv = document.createElement('canvas');
  cv.width = img.width; cv.height = img.height;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const px = g.getImageData(0, 0, cv.width, cv.height).data;
  const flip = tex.flipY;
  return (u, v) => {
    const x = Math.min(cv.width - 1, Math.max(0, Math.floor(u * cv.width)));
    const y = Math.min(cv.height - 1, Math.max(0, Math.floor((flip ? 1 - v : v) * cv.height)));
    const k = (y * cv.width + x) * 4;
    return [px[k], px[k + 1], px[k + 2]];
  };
}

export function pieceSetup(RM, o) {
  let sm = null;
  RM.scene.traverse((n) => { if (n.isSkinnedMesh && !sm) sm = n; });
  if (!sm) return null;
  sm.geometry = sm.geometry.clone(); // its own copy: two of the same character share the loaded one
  const geo = sm.geometry, pos = geo.attributes.position, uv = geo.attributes.uv;
  const read = texReader(sm.material.map);
  if (!read || !uv) return null;
  // the bind pose in the character's space (feet at 0, +Z forward, its height in metres)
  RM.scene.updateMatrixWorld(true);
  const toChar = new THREE.Matrix4().copy(RM.scene.matrixWorld).invert().multiply(sm.matrixWorld);
  const v = new THREE.Vector3();
  const sel = new Uint8Array(pos.count);
  let n = 0;
  const cen = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(toChar);
    if (v.y < o.minY) continue;
    if (o.pick(read(uv.getX(i), uv.getY(i)), v)) { sel[i] = 1; n++; cen.add(v); }
  }
  if (!n) return null;
  cen.divideScalar(n);
  // where the piece folds to: inside the head, under its middle (in the mesh's own space)
  const fold = new THREE.Vector3(cen.x, cen.y - (o.foldDown ?? 0.12), cen.z - (o.foldBack ?? 0.02)).applyMatrix4(new THREE.Matrix4().copy(toChar).invert());
  const keep = new Float32Array(n * 3), idx = new Uint32Array(n);
  for (let i = 0, k = 0; i < pos.count; i++) if (sel[i]) { idx[k] = i; keep[k * 3] = pos.getX(i); keep[k * 3 + 1] = pos.getY(i); keep[k * 3 + 2] = pos.getZ(i); k++; }
  // the cover: the piece's triangles whose three corners are in it (those of o.coverPick only), pulled toward the
  // middle of the head
  let cover = null;
  if (o.cover) {
    const index = geo.index ? geo.index.array : null;
    const tri = [];
    const nt = index ? index.length / 3 : pos.count / 3;
    const okC = (i) => sel[i] && (!o.coverPick || o.coverPick(read(uv.getX(i), uv.getY(i))));
    for (let t = 0; t < nt; t++) {
      const a = index ? index[t * 3] : t * 3, b = index ? index[t * 3 + 1] : t * 3 + 1, c = index ? index[t * 3 + 2] : t * 3 + 2;
      if (okC(a) && okC(b) && okC(c)) tri.push(a, b, c);
    }
    if (tri.length) {
      const g2 = new THREE.BufferGeometry();
      const head = new THREE.Vector3(cen.x, cen.y - (o.headDown ?? 0.1), cen.z).applyMatrix4(new THREE.Matrix4().copy(toChar).invert());
      const P = new Float32Array(tri.length * 3);
      const SI = new (geo.attributes.skinIndex.array.constructor)(tri.length * 4), SW = new Float32Array(tri.length * 4);
      const sh = o.shrink ?? 0.9, shY = o.shrinkY ?? sh;
      // flattened toward the skull (in the character's frame: the up axis shrinks more)
      const toM = new THREE.Matrix4().copy(toChar).invert(), hc = new THREE.Vector3(cen.x, cen.y - (o.headDown ?? 0.1), cen.z);
      tri.forEach((i, k) => {
        v.fromBufferAttribute(pos, i).applyMatrix4(toChar).sub(hc);
        v.x *= sh; v.z *= sh; v.y *= shY;
        v.add(hc).applyMatrix4(toM);
        P[k * 3] = v.x; P[k * 3 + 1] = v.y; P[k * 3 + 2] = v.z;
        for (let j = 0; j < 4; j++) { SI[k * 4 + j] = geo.attributes.skinIndex.getComponent(i, j); SW[k * 4 + j] = geo.attributes.skinWeight.getComponent(i, j); }
      });
      g2.setAttribute('position', new THREE.BufferAttribute(P, 3));
      g2.setAttribute('skinIndex', new THREE.BufferAttribute(SI, 4));
      g2.setAttribute('skinWeight', new THREE.BufferAttribute(SW, 4));
      g2.computeVertexNormals();
      // curls: the surface bumped by a little noise along its normals, and dark shades from strand to strand
      const ks = Math.max(1e-4, new THREE.Vector3().setFromMatrixScale(toChar).x);
      const N = g2.attributes.normal, C = new Float32Array(tri.length * 3), base = new THREE.Color(o.cover), c2 = new THREE.Color();
      const q = (x, y, z) => Math.sin(x * 210 + Math.sin(z * 170)) * Math.sin(y * 190 + Math.sin(x * 150)) * Math.sin(z * 230 + y * 40);
      for (let k = 0; k < tri.length; k++) {
        v.set(P[k * 3], P[k * 3 + 1], P[k * 3 + 2]).applyMatrix4(toChar); // the noise in metres
        const b = q(v.x, v.y, v.z);
        const d = (o.curl ?? 0.012) * (0.5 + 0.5 * b) / ks; // metres in the mesh's own units
        P[k * 3] += N.getX(k) * d; P[k * 3 + 1] += N.getY(k) * d; P[k * 3 + 2] += N.getZ(k) * d;
        c2.copy(base).multiplyScalar(0.7 + 0.6 * (0.5 + 0.5 * b));
        C[k * 3] = c2.r; C[k * 3 + 1] = c2.g; C[k * 3 + 2] = c2.b;
      }
      g2.attributes.position.needsUpdate = true;
      g2.setAttribute('color', new THREE.BufferAttribute(C, 3));
      g2.computeVertexNormals();
      const m = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 1, metalness: 0 });
      cover = new THREE.SkinnedMesh(g2, m);
      cover.bind(sm.skeleton, sm.bindMatrix);
      cover.position.copy(sm.position); cover.quaternion.copy(sm.quaternion); cover.scale.copy(sm.scale);
      cover.frustumCulled = false; cover.castShadow = true; cover.visible = false;
      sm.parent.add(cover);
    }
  }
  let on = true;
  return {
    count: n,
    show(want) {
      if (want === on) return;
      on = want;
      for (let k = 0; k < n; k++) {
        const i = idx[k];
        if (on) pos.setXYZ(i, keep[k * 3], keep[k * 3 + 1], keep[k * 3 + 2]);
        else pos.setXYZ(i, fold.x, fold.y, fold.z);
      }
      pos.needsUpdate = true;
      if (cover) cover.visible = !on;
    },
  };
}
