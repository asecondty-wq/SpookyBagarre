// Painted art for the arenas (tools/art/stages.ps1 + stage_prep.py -> assets/stages/<id>/):
//  - top.jpg : the arena floor seen from above, laid on the main platform (and the small ones)
//  - sky.jpg : a panoramic matte painting on a sphere segment behind the arena (the camera never turns)
// plus atmosphere shared by every arena: mist layers under the platform, moon shafts, rim light, drifting motes,
// and a fog colour taken from the painting so the 3D scenery melts into it.
import * as THREE from 'three';
import { STYLE } from '../style.js';
import { glowTex } from '../materials.js';

const loader = new THREE.TextureLoader();
const cache = new Map();
const D2R = Math.PI / 180;

export function stageTex(id, name) {
  const url = `assets/stages/${id}/${name}.jpg`;
  if (cache.has(url)) return cache.get(url);
  const t = loader.load(url, (tx) => { tx.userData.ok = true; (tx.userData.wait || []).forEach((f) => f(tx)); tx.userData.wait = []; }, undefined, () => { t.userData.failed = true; });
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = STYLE.smooth ? 8 : 1;
  if (!STYLE.smooth) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapLinearFilter; }
  t.userData.wait = [];
  cache.set(url, t);
  return t;
}
const onLoad = (t, f) => { if (t.userData.ok) f(t); else t.userData.wait.push(f); };

// average colour of a horizontal band of an image (0..1 from the top), linear
function bandColor(img, v0, v1) {
  const c = document.createElement('canvas'); c.width = 32; c.height = 32;
  const g = c.getContext('2d');
  g.drawImage(img, 0, img.height * v0, img.width, img.height * (v1 - v0), 0, 0, 32, 32);
  const d = g.getImageData(0, 0, 32, 32).data;
  let r = 0, gg = 0, b = 0;
  for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
  const n = d.length / 4;
  return new THREE.Color().setRGB(r / n / 255, gg / n / 255, b / n / 255, THREE.SRGBColorSpace);
}

// the matte painting: azimuth span centred behind the arena, elevation from `top` to `bottom` degrees
// The camera looks down ~24 deg: the top of the screen is ~5 deg below the horizon. The painting's horizon row
// (`horizon`, 0..1 from the top) is put just at the top of the screen, so the far landscape fills the background.
function paintedDome(id, o) {
  const tex = stageTex(id, 'sky');
  const tall = o.tall ?? 88, h = o.horizon ?? 0.3, eh = o.eh ?? -3;
  const span = (o.span ?? 130) * D2R, top = o.top ?? (eh + h * tall), bottom = o.bottom ?? (top - tall);
  const geo = new THREE.SphereGeometry(o.radius ?? 290, 64, 32, Math.PI * 1.5 - span / 2 + (o.yaw || 0) * D2R, span, (90 - top) * D2R, (top - bottom) * D2R);
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, depthWrite: false, fog: false,
    uniforms: { map: { value: tex }, uFade: { value: o.fade ?? 0.14 }, uGain: { value: o.gain ?? 1 }, uOp: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D map; uniform float uFade; uniform float uGain; uniform float uOp; varying vec2 vUv;
      void main(){ vec2 uv = vec2(1.0 - vUv.x, vUv.y); vec4 c = texture2D(map, uv);
        float ex = smoothstep(0.0, uFade, vUv.x) * smoothstep(0.0, uFade, 1.0 - vUv.x);
        float ey = smoothstep(0.0, uFade * 0.7, vUv.y) * smoothstep(0.0, uFade * 0.9, 1.0 - vUv.y);
        gl_FragColor = vec4(c.rgb * uGain, ex * ey * uOp); }`,
  });
  const mesh = new THREE.Mesh(geo, m);
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  onLoad(tex, () => { m.uniforms.uOp.value = 1; });
  if (o.y) mesh.position.y = o.y;
  return { mesh, tex };
}

function mistTex() {
  if (mistTex.t) return mistTex.t;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  for (let i = 0; i < 70; i++) {
    const x = 30 + Math.random() * 196, y = 30 + Math.random() * 196, r = 18 + Math.random() * 50;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.29); g.fill();
  }
  // fade to nothing at the border so the layer has no edge
  const e = g.createRadialGradient(128, 128, 60, 128, 128, 128);
  e.addColorStop(0, 'rgba(0,0,0,1)'); e.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in'; g.fillStyle = e; g.fillRect(0, 0, 256, 256);
  mistTex.t = new THREE.CanvasTexture(c);
  return mistTex.t;
}

function shaftTex() {
  if (shaftTex.t) return shaftTex.t;
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const g = c.getContext('2d');
  const h = g.createLinearGradient(0, 0, 64, 0);
  h.addColorStop(0, 'rgba(255,255,255,0)'); h.addColorStop(0.5, 'rgba(255,255,255,1)'); h.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = h; g.fillRect(0, 0, 64, 256);
  const v = g.createLinearGradient(0, 0, 0, 256);
  // the shaft fades out a few metres above the floor (no pale smudge where the plane meets the ground)
  v.addColorStop(0, 'rgba(0,0,0,0.0)'); v.addColorStop(0.22, 'rgba(0,0,0,1)'); v.addColorStop(0.5, 'rgba(0,0,0,0.55)'); v.addColorStop(0.68, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in'; g.fillStyle = v; g.fillRect(0, 0, 64, 256);
  shaftTex.t = new THREE.CanvasTexture(c);
  return shaftTex.t;
}

// per-arena settings (dome framing, which extras, near-ground clean-up)
export const ART = {
  cemetery: { islands: { n: 7, r: [33, 43], y: [-6, -3.6], arc: 0.95, size: 1.3 }, dome: { gain: 1.0, horizon: 0.25 }, ground: [55, 95], softTop: true, mist: { color: '#7a6aa8', y: [-7, -16], op: 0.28 }, shafts: { color: '#c8d4ff', n: 4 }, rim: '#9fb4ff', motes: '#c8ffe8', fog: 0.75, hideBelow: 0 },
  swamp: { cards: { y: -2.2, r: [13, 36], h: [3, 7.5], n: 14, arc: 1.7 }, dome: { gain: 1.0, horizon: 0.1 }, ground: [16, 40], softTop: true, mist: { color: '#6a9a58', y: [-0.8, -1.7], op: 0.3, r: 70 }, shafts: { color: '#d8ffb0', n: 3 }, rim: '#c8ff5a', motes: '#e8ff7a', fog: 0.7 },
  elysee: { islands: { n: 6, r: [33, 43], y: [-6, -3.6], arc: 0.95, size: 1.3 }, dome: { gain: 1.0, horizon: 0.3 }, ground: [40, 72], softTop: false, mist: { color: '#6a78b8', y: [-9, -22], op: 0.28 }, shafts: { color: '#dfe4ff', n: 4 }, rim: '#ffe08a', motes: '#ffe8b0', fog: 0.7 },
  diner: { islands: { n: 6, r: [33, 43], y: [-6.2, -3.8], arc: 0.95, size: 1.3 }, dome: { gain: 1.0, horizon: 0.22 }, ground: [55, 95], softTop: false, mist: { color: '#b87868', y: [-10, -26], op: 0.22 }, rim: '#ff5a8a', motes: '#ffd0a0', fog: 0.7 },
  cave: { islands: { n: 6, r: [28, 36], y: [-5, -3], arc: 0.95, size: 1.2 }, dome: { gain: 1.05, radius: 60, span: 150, horizon: 0.3, eh: -14 }, cull: 30, softTop: true, removeWall: true, mist: { color: '#ffd8a0', y: [-8, -20], op: 0.3, r: 50 }, shafts: { color: '#ffd8a0', n: 3 }, rim: '#ffcc66', motes: '#ffe0a0', fog: 0.6 },
  arena: { islands: { n: 5, r: [34, 44], y: [-6.4, -4], arc: 0.85, size: 1.3 }, dome: { gain: 1.0, horizon: 0.32 }, ground: [30, 60], softTop: true, mist: { color: '#8878b8', y: [-14, -22], op: 0.22 }, shafts: { color: '#fffff0', n: 5, wide: 1.4 }, rim: '#e8d8ff', motes: '#ffffff', fog: 0.6 },
  village: { islands: { n: 6, r: [33, 43], y: [-6, -3.6], arc: 0.95, size: 1.3 }, dome: { gain: 1.0, horizon: 0.27 }, ground: [55, 95], softTop: false, mist: { color: '#9a7aa8', y: [-8, -20], op: 0.28 }, shafts: { color: '#ffe0c0', n: 3 }, rim: '#ffd23a', motes: '#ffcf6a', fog: 0.7 },
  sea: { cards: { y: -3, r: [14, 38], h: [4, 10], n: 11, arc: 1.7 }, dome: { gain: 1.0, horizon: 0.27 }, ground: [18, 44], softTop: false, mist: { color: '#7898a8', y: [-1.2, -2.5], op: 0.28, r: 80 }, shafts: { color: '#d8f0ff', n: 3 }, rim: '#a8e0ff', motes: '#e0f4ff', fog: 0.65 },
  attic: { islands: { n: 6, r: [26, 34], y: [-4.6, -2.8], arc: 0.95, size: 1.2 }, dome: { gain: 1.05, radius: 43, span: 160, horizon: 0.36, eh: -20 }, removeWall: true, cull: 28, softTop: false, mist: { color: '#e8d8c8', y: [-6, -14], op: 0.25, r: 45 }, shafts: { color: '#d8e0ff', n: 4 }, rim: '#ffcf6a', motes: '#fff0d0', fog: 0.55 },
};

function radialAlpha(f0, f1) {
  const k = 'ra' + f0.toFixed(3) + f1.toFixed(3);
  if (radialAlpha[k]) return radialAlpha[k];
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 128 * f0, 128, 128, 128 * f1);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#000000');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  return (radialAlpha[k] = new THREE.CanvasTexture(c));
}

// melt the far 3D ground into the painting: fade the big ground meshes out between r0 and r1 (metres from the
// arena centre) and drop the props standing beyond r1 (they would float over the painting)
function fadeGround(g, r0, r1, allHeights = false) {
  g.updateMatrixWorld(true);
  const v = new THREE.Vector3(), m4 = new THREE.Matrix4(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  g.traverse((o) => {
    if (o === g) return;
    o.getWorldPosition(v);
    if (o.isInstancedMesh) {
      let changed = false;
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m4); v.setFromMatrixPosition(m4).applyMatrix4(o.matrixWorld);
        if ((allHeights || v.y < -1) && Math.hypot(v.x, v.z) > r1) { o.setMatrixAt(i, zero); changed = true; }
      }
      if (changed) o.instanceMatrix.needsUpdate = true;
      return;
    }
    if (!o.isMesh) {
      if (o.parent === g && o.isGroup && v.y < -1 && Math.hypot(v.x, v.z) > r1) o.visible = false;
      return;
    }
    const P = o.geometry.parameters || {};
    const t = o.geometry.type;
    let R = 0;
    if (t === 'CircleGeometry' && P.radius >= 100) R = P.radius;
    if (t === 'PlaneGeometry' && P.width >= 250) R = P.width / 2;
    if (!R || v.y > -0.5 || Array.isArray(o.material)) return;
    const m = o.material.clone();
    m.alphaMap = radialAlpha(r0 / R, Math.min(1, r1 / R));
    m.transparent = true;
    o.material = m;
    o.renderOrder = 1;
  });
}

export function enhanceStage(view, def) {
  const A = ART[def.id];
  if (!A) return view;
  const g = view.group;
  if (A.ground) fadeGround(g, A.ground[0], A.ground[1]);
  if (A.cull) fadeGround(g, A.cull, A.cull, true);
  const extras = { mist: [], shafts: [], motes: null };
  // 1. painted floor
  const topTex = stageTex(def.id, 'top');
  const main = view.surfaces[0];
  const disc = main && main.children[0];
  if (disc && disc.isMesh && Array.isArray(disc.material)) {
    const r = def.surfaces[0].r;
    const topMat = new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.78, metalness: 0 });
    onLoad(topTex, () => {
      disc.material = [disc.material[0], topMat, disc.material[2]];
      const pos = disc.geometry.attributes.position, uv = disc.geometry.attributes.uv;
      const th = disc.geometry.parameters.height;
      for (let i = 0; i < pos.count; i++) if (Math.abs(pos.getY(i) - th / 2) < 1e-4) uv.setXY(i, pos.getX(i) / (2 * r) + 0.5, -pos.getZ(i) / (2 * r) + 0.5);
      uv.needsUpdate = true;
    });
  }
  if (A.softTop) {
    for (let i = 1; i < view.surfaces.length; i++) {
      const o = view.surfaces[i];
      const d = o && o.children[0];
      if (d && d.isMesh && Array.isArray(d.material) && d.geometry.type === 'CylinderGeometry') {
        const m = new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.8 });
        onLoad(topTex, () => { d.material = [d.material[0], m, d.material[2]]; });
      }
    }
  }
  // 2. painting behind the arena
  if (A.removeWall) g.traverse((o) => { if (o.isMesh && o.geometry.type === 'CylinderGeometry' && o.geometry.parameters.radiusTop >= 40 && o.geometry.parameters.openEnded) o.visible = false; });
  const dome = paintedDome(def.id, A.dome || {});
  g.add(dome.mesh);
  if (A.fog) {
    onLoad(dome.tex, (t) => {
      // the far scenery fogs toward the painting's colour around the horizon line
      const c = bandColor(t.image, 0.4, 0.62);
      view.fogTint = { color: c, k: A.fog };
    });
  }
  // 2b. painted props (cut out of a Codex sheet) standing as cards: the camera never turns, so a card facing +Z
  // always looks right. On low arenas they stand in the water around; on high arenas they ride small floating
  // islets behind and beside the platform (the ground far below is hidden by the platform anyway).
  const islets = [];
  if (A.cards || A.islands) {
    const C = A.cards || {}, I = A.islands;
    fetch(`assets/stages/${def.id}/props.json`).then((r) => (r.ok ? r.json() : [])).then((list) => {
      if (!list.length) return;
      let seed = 7 + def.id.length * 13;
      const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      const mats = list.map((p) => {
        const t = loader.load(`assets/stages/${def.id}/${p.file}`);
        t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
        return new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.4, side: THREE.DoubleSide, fog: true, color: (C.tint || (I && I.tint)) || '#dcdce4' });
      });
      const card = (k, h, maxW) => {
        const p = list[k];
        let w = h * p.w / p.h;
        if (w > maxW) { h *= maxW / w; w = maxW; }
        const geo = new THREE.PlaneGeometry(w, h); geo.translate(0, h / 2, 0);
        const m = new THREE.Mesh(geo, mats[k]);
        m.rotation.y = (rnd() - 0.5) * 0.3;
        if (rnd() < 0.5) m.scale.x = -1;
        return m;
      };
      if (A.cards) {
        const arc = C.arc ?? 1.35;
        for (let i = 0; i < C.n; i++) {
          const k = Math.floor(rnd() * list.length);
          const a = Math.PI + (i / Math.max(1, C.n - 1) - 0.5) * 2 * arc + (rnd() - 0.5) * 0.25;
          const r = C.r[0] + rnd() * (C.r[1] - C.r[0]);
          const m = card(k, C.h[0] + rnd() * (C.h[1] - C.h[0]), C.h[1] * 1.1);
          m.position.set(Math.sin(a) * r, C.y - 0.3, Math.cos(a) * r);
          g.add(m);
        }
      }
      if (I) {
        const rock = (disc && Array.isArray(disc.material)) ? disc.material[0] : new THREE.MeshStandardMaterial({ color: '#4a4250' });
        const topM = new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.85 });
        for (let i = 0; i < I.n; i++) {
          // far behind the arena (beyond the blast line, so nobody tries to land on them), just peeking over the back edge
          const k = I.size ?? 1.5;
          const ir = (1.4 + rnd() * 1.6) * k;
          const isl = new THREE.Group();
          const top = new THREE.Mesh(new THREE.CylinderGeometry(ir, ir * 0.92, 0.5, 20), [rock, topM, rock]);
          top.position.y = -0.25; top.receiveShadow = true;
          const under = new THREE.Mesh(new THREE.ConeGeometry(ir * 0.9, ir * 1.8, 9), rock);
          under.rotation.x = Math.PI; under.position.y = -0.5 - ir * 0.9;
          isl.add(top, under);
          const nc = rnd() < 0.4 ? 2 : 1;
          for (let j = 0; j < nc; j++) {
            const hh = I.h || [2.4, 4.4];
            const m = card(Math.floor(rnd() * list.length), (hh[0] + rnd() * (hh[1] - hh[0])) * k, ir * 1.7);
            m.position.set(nc === 2 ? (j ? 0.5 : -0.5) * ir : 0, 0, nc === 2 ? (j ? -0.3 : 0.2) * ir : 0);
            isl.add(m);
          }
          // spread over the back half and the sides, never in front of the camera
          const a = Math.PI + (i / Math.max(1, I.n - 1) - 0.5) * 2 * (I.arc ?? 1.5) + (rnd() - 0.5) * 0.2;
          const r = I.r[0] + rnd() * (I.r[1] - I.r[0]);
          isl.position.set(Math.sin(a) * r, I.y[0] + rnd() * (I.y[1] - I.y[0]), Math.cos(a) * r);
          isl.userData = { y0: isl.position.y, ph: rnd() * 6.28 };
          g.add(isl); islets.push(isl);
        }
      }
    }).catch(() => {});
  }
  // 3. mist layers drifting under the platform
  if (A.mist) {
    const mt = mistTex();
    for (const [i, y] of A.mist.y.entries()) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: mt, color: A.mist.color, transparent: true, opacity: A.mist.op * (1 - i * 0.15), depthWrite: false, fog: true }));
      const s = (A.mist.r || 120) * (1 + i * 0.35);
      m.scale.set(s, s, 1); m.rotation.x = -Math.PI / 2; m.position.y = y;
      m.renderOrder = 3;
      g.add(m); extras.mist.push(m);
    }
  }
  // 4. moon shafts slanting over the arena
  if (A.shafts && STYLE.smooth) {
    const st = shaftTex();
    for (let i = 0; i < A.shafts.n; i++) {
      const w = (3 + Math.random() * 4) * (A.shafts.wide || 1);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 60), new THREE.MeshBasicMaterial({ map: st, color: A.shafts.color, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      m.position.set(-14 + i * (28 / Math.max(1, A.shafts.n - 1)) + (Math.random() - 0.5) * 3, 18, -8 - Math.random() * 10);
      m.rotation.set(0, (Math.random() - 0.5) * 0.4, 0.38 + (Math.random() - 0.5) * 0.15);
      m.userData.ph = Math.random() * 10;
      g.add(m); extras.shafts.push(m);
    }
  }
  // 5. a soft light along the platform edge (reads where the edge is)
  if (A.rim && main) {
    const r = def.surfaces[0].r;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.02, 0.05, 6, 96), new THREE.MeshBasicMaterial({ color: A.rim, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.03;
    main.add(ring); extras.rim = ring;
  }
  // 6. drifting motes in the light
  if (A.motes && STYLE.smooth) {
    const n = 160, pos = new Float32Array(n * 3), ph = new Float32Array(n);
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, rr = Math.sqrt(Math.random()) * 22; pos[i * 3] = Math.cos(a) * rr; pos[i * 3 + 1] = -4 + Math.random() * 18; pos[i * 3 + 2] = Math.sin(a) * rr; ph[i] = Math.random() * 6.28; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: glowTex(), color: A.motes, size: 0.22, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
    pts.userData.ph = ph; pts.userData.base = pos.slice();
    g.add(pts); extras.motes = pts;
  }
  const up = view.update;
  view.update = function (dt, t, stage, W) {
    if (up) up.call(view, dt, t, stage, W);
    extras.mist.forEach((m, i) => { m.rotation.z = t * (0.006 + i * 0.004) * (i % 2 ? -1 : 1); });
    for (const isl of islets) { isl.position.y = isl.userData.y0 + Math.sin(t * 0.6 + isl.userData.ph) * 0.45; isl.rotation.y = Math.sin(t * 0.2 + isl.userData.ph) * 0.08; }
    extras.shafts.forEach((m) => { m.material.opacity = 0.075 + 0.045 * Math.sin(t * 0.4 + m.userData.ph); });
    // lightning (cemetery, sea...) also lights up the painted landscape
    if (view.flashL) dome.mesh.material.uniforms.uGain.value = (A.dome && A.dome.gain || 1) + Math.min(1.2, view.flashL.intensity * 0.18);
    if (extras.rim) extras.rim.material.opacity = 0.4 + 0.15 * Math.sin(t * 2);
    if (extras.motes) {
      const p = extras.motes.geometry.attributes.position, b = extras.motes.userData.base, ph = extras.motes.userData.ph;
      for (let i = 0; i < ph.length; i++) { p.array[i * 3] = b[i * 3] + Math.sin(t * 0.3 + ph[i]) * 1.2; p.array[i * 3 + 1] = b[i * 3 + 1] + Math.sin(t * 0.5 + ph[i] * 2) * 0.8; p.array[i * 3 + 2] = b[i * 3 + 2] + Math.cos(t * 0.27 + ph[i]) * 1.2; }
      p.needsUpdate = true;
    }
    if (view.fogTint && !view.fogApplied) {
      let s = g; while (s.parent) s = s.parent;
      if (s.isScene && s.fog) { s.fog.color.lerp(view.fogTint.color, view.fogTint.k); view.fogApplied = true; }
    }
  };
  return view;
}
