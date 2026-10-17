// Arena visuals. Each builder returns { group, update(dt, t, stage, W), surfaces:[objects per sim surface], fog, ... }.
import * as THREE from 'three';
import { mat, basic, G, mesh, canvasTex, glowTex, speckle, stripes } from '../materials.js';
import { STYLE } from '../style.js';
import { enhanceStage } from './painted.js';
import { buildMirror } from './mirror.js';
import { buildZinzin } from './zinzin.js';
import { skyDome, moon, platform, softPlatform, syncSurface, tombstone, deadTree, Wisps, Bats, TEX, instanced, ringTransforms } from './common.js';

function lights(group, { hemiSky, hemiGround, hemiI = 1.1, dirColor, dirI = 1.4, dir = [-0.5, 1, 0.6] }) {
  const h = new THREE.HemisphereLight(hemiSky, hemiGround, hemiI);
  const d = new THREE.DirectionalLight(dirColor, dirI);
  d.position.set(dir[0] * 50, dir[1] * 50, dir[2] * 50);
  if (STYLE.shadows) {
    // soft shadows of the fighters on the platforms (the light looks at the arena centre)
    d.castShadow = true;
    const c = d.shadow.camera;
    c.left = -26; c.right = 26; c.top = 26; c.bottom = -26; c.near = 5; c.far = 140;
    d.shadow.mapSize.set(2048, 2048); // (3072 : lourd pour les petites cartes graphiques, sans différence à cette distance)
    d.shadow.bias = -0.0004; d.shadow.normalBias = 0.04; d.shadow.radius = 3;
  }
  group.add(h, d, d.target);
  return { h, d };
}

function flicker(light, base, t, ph) { light.intensity = base * (0.8 + 0.2 * Math.sin(t * 13 + ph) * Math.sin(t * 7.3 + ph * 2)); }

function torch(color = '#ff9a3a') {
  const g = new THREE.Group();
  g.add(mesh(G.cyl(0.08, 0.1, 0.9, 6), mat('#3a2a1a'), [0, 0.45, 0]));
  g.add(mesh(G.cyl(0.18, 0.12, 0.2, 6), mat('#2a2a2a'), [0, 0.95, 0]));
  const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  f.scale.setScalar(1.1); f.position.y = 1.2;
  g.add(f, mesh(G.cone(0.12, 0.35, 5), basic(color), [0, 1.2, 0]));
  g.userData.flame = f;
  return g;
}

function standardSurfaces(def, makeMain, makeSoft) {
  return def.surfaces.map((s, i) => (i === 0 ? makeMain(s) : makeSoft(s, i)));
}

// ---------------------------------------------------------------------------------------------------------------
const BUILDERS = {
  mirror: buildMirror,
  zinzin: buildZinzin,

  cemetery(def) {
    const group = new THREE.Group();
    group.add(skyDome('#0b0820', '#3a2550', '#120c18', 900));
    group.add(moon([-70, 80, -170], '#fff3cf', 16, '#9fb4ff'));
    const L = lights(group, { hemiSky: '#7a6aa8', hemiGround: '#1a2a1a', hemiI: 1.0, dirColor: '#bcd0ff', dirI: 1.6, dir: [-0.4, 0.9, 0.5] });
    // ground far below with graves
    const ground = mesh(new THREE.CircleGeometry(220, 40), mat('#ffffff', { map: TEX.grass('#22351f') }), [0, -34, 0], [-Math.PI / 2, 0, 0]);
    ground.material.map.repeat.set(60, 60);
    group.add(ground);
    instanced(group, tombstone(0), ringTransforms(160, 14, 90, -34, { face: true, tilt: 0.35, scale: [1.5, 3.2] }));
    instanced(group, tombstone(1), ringTransforms(80, 16, 90, -34, { face: true, tilt: 0.4, scale: [1.5, 3] }));
    instanced(group, tombstone(2), ringTransforms(40, 18, 80, -34, { face: true, tilt: 0.1, scale: [1.6, 2.6] }));
    for (let i = 0; i < 12; i++) {
      const tr = deadTree(7 + Math.random() * 6);
      const a = Math.random() * 6.28, r = 22 + Math.random() * 60;
      tr.position.set(Math.cos(a) * r, -34, Math.sin(a) * r);
      tr.scale.setScalar(1.8);
      group.add(tr);
    }
    // mausoleums
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Group();
      const st = mat('#6d6a78', { map: TEX.stoneTiles('#6d6a78') });
      m.add(mesh(G.box(6, 5, 6), st, [0, 2.5, 0]), mesh(G.cone(4.8, 3, 4), st, [0, 6.5, 0], [0, Math.PI / 4, 0]));
      m.add(mesh(G.box(1.8, 3, 0.2), basic('#0a0810'), [0, 1.5, 3.05]));
      const a = i * 1.57 + 0.6, r = 45;
      m.position.set(Math.cos(a) * r, -34, Math.sin(a) * r);
      m.rotation.y = Math.atan2(-m.position.x, -m.position.z);
      m.scale.setScalar(1.5);
      group.add(m);
    }
    const stone = mat('#ffffff', { map: TEX.stoneTiles('#7c7888', '#2c2934') });
    const rock = mat('#ffffff', { map: TEX.rock('#463f4c') });
    const surfaces = standardSurfaces(def,
      (s) => platform(s, { top: stone, side: rock, under: rock, tile: 2.5, rim: mat('#2a2632') }),
      (s) => softPlatform(s, mat('#ffffff', { map: TEX.stoneTiles('#8a8694', '#3a3642') }), rock, 0.4));
    surfaces.forEach((o) => group.add(o));
    // candles on the rim + two torch lights
    const lightsT = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const t = torch('#ffb04a');
      const R0 = def.surfaces[0].r + 0.6;
      t.position.set(Math.cos(a) * R0, -0.6, Math.sin(a) * R0);
      surfaces[0].add(t);
    }
    for (let i = 0; i < 2; i++) {
      const p = new THREE.PointLight('#ff9a4a', 30, 18, 1.8);
      p.position.set(i ? 10 : -10, 2, 3);
      group.add(p); lightsT.push(p);
    }
    const wisps = new Wisps(group, 26, '#7affd8', 40, [-20, 12]);
    const bats = new Bats(group, 14);
    // lightning flash light
    const flashL = new THREE.DirectionalLight('#e0e8ff', 0);
    flashL.position.set(10, 40, 20);
    group.add(flashL);
    return {
      group, surfaces, fog: ['#1b1430', 40, 170], bg: '#0b0820', R: 9,
      flashL,
      update(dt, t) {
        wisps.update(t); bats.update(t);
        lightsT.forEach((l, i) => flicker(l, 30, t, i * 2));
        flashL.intensity *= Math.exp(-dt * 8);
        if (Math.random() < dt * 0.04) flashL.intensity = 5;
      },
    };
  },

  swamp(def) {
    const group = new THREE.Group();
    group.add(skyDome('#050c06', '#2a3d1a', '#0a120a', 400));
    group.add(moon([60, 70, -160], '#e8ffb0', 12, '#a8ff6a'));
    lights(group, { hemiSky: '#6a9a4a', hemiGround: '#0a1a08', hemiI: 1.0, dirColor: '#d8ffb0', dirI: 1.3 });
    const water = new THREE.Mesh(new THREE.PlaneGeometry(400, 400, 40, 40), new THREE.MeshLambertMaterial({ color: '#2a4a1a', emissive: '#0a1a04', map: speckle('swampw', '#2a4a1a', ['#1f3a12', '#365a22', '#4a7a2a'], 64, 90, 1, 3) }));
    water.material.map.repeat.set(40, 40);
    water.rotation.x = -Math.PI / 2; water.position.y = -2.2;
    group.add(water);
    const pad = mat('#ffffff', { map: canvasTex('lily', 64, (g, s) => {
      g.fillStyle = '#3d8a2a'; g.fillRect(0, 0, s, s);
      g.strokeStyle = '#2a6a1c'; g.lineWidth = 2;
      for (let i = 0; i < 12; i++) { g.beginPath(); g.moveTo(s / 2, s / 2); g.lineTo(s / 2 + Math.cos(i * 0.52) * s, s / 2 + Math.sin(i * 0.52) * s); g.stroke(); }
      g.fillStyle = '#5aa83a'; for (let i = 0; i < 40; i++) g.fillRect(Math.random() * s, Math.random() * s, 2, 2);
    }) });
    const stem = mat('#2e5a20');
    const surfaces = standardSurfaces(def,
      (s) => { const p = platform(s, { top: pad, side: mat('#2e6a20'), under: stem, tile: 18, noCone: true }); p.add(mesh(G.cyl(1.2, 2.2, 30, 8), stem, [0, -16, 0])); return p; },
      (s) => { const p = softPlatform(s, pad, mat('#2e6a20'), 0.25); p.add(mesh(G.cyl(0.2, 0.3, 3, 6), stem, [0, -1.6, 0])); return p; });
    surfaces.forEach((o) => group.add(o));
    // cattails & mushrooms & dead trees
    const cat = new THREE.Group();
    cat.add(mesh(G.cyl(0.05, 0.05, 3, 4), mat('#3a5a20'), [0, 1.5, 0]), mesh(G.cyl(0.14, 0.14, 0.7, 6), mat('#5a3a1a'), [0, 3, 0]));
    instanced(group, cat, ringTransforms(160, 14, 60, -2.2, { tilt: 0.3, scale: [0.8, 1.8] }));
    const shroom = new THREE.Group();
    shroom.add(mesh(G.cyl(0.25, 0.35, 2, 6), mat('#d8d0b0'), [0, 1, 0]), mesh(new THREE.SphereGeometry(1.1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat('#8a2aa8', { emissive: '#4a0a6a' }), [0, 2, 0]));
    instanced(group, shroom, ringTransforms(30, 16, 55, -2.2, { scale: [1, 3] }));
    for (let i = 0; i < 10; i++) { const tr = deadTree(8, '#1a2414'); const a = Math.random() * 6.28, r = 25 + Math.random() * 45; tr.position.set(Math.cos(a) * r, -2.2, Math.sin(a) * r); tr.scale.setScalar(2); group.add(tr); }
    // glowing eyes in the dark
    const eyesG = new THREE.Group();
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * 6.28, r = 30 + Math.random() * 40;
      const e = new THREE.Group();
      e.add(mesh(G.ball(0.25, 0), basic('#e8ff4a', { fog: false }), [-0.4, 0, 0]), mesh(G.ball(0.25, 0), basic('#e8ff4a', { fog: false }), [0.4, 0, 0]));
      e.position.set(Math.cos(a) * r, -1.6, Math.sin(a) * r); e.lookAt(0, -1.6, 0);
      e.userData.ph = Math.random() * 10;
      eyesG.add(e);
    }
    group.add(eyesG);
    const wisps = new Wisps(group, 40, '#c8ff5a', 35, [-1, 8]);
    return {
      group, surfaces, fog: ['#13200e', 30, 150], bg: '#050c06', R: 8.2,
      update(dt, t) {
        wisps.update(t);
        eyesG.children.forEach((e) => { e.visible = Math.sin(t * 0.7 + e.userData.ph) > -0.6; e.scale.y = Math.sin(t * 3 + e.userData.ph) > 0.97 ? 0.1 : 1; });
        const p = water.geometry.attributes.position;
        for (let i = 0; i < p.count; i += 1) p.setZ(i, Math.sin(p.getX(i) * 0.15 + t) * 0.15 + Math.cos(p.getY(i) * 0.12 + t * 0.8) * 0.15);
        p.needsUpdate = true;
      },
    };
  },

  elysee(def) {
    const group = new THREE.Group();
    group.add(skyDome('#050a24', '#24305e', '#0a0a18', 600));
    group.add(moon([80, 90, -160], '#fff8e8', 13, '#c8d4ff'));
    lights(group, { hemiSky: '#8a9ad8', hemiGround: '#1a1a30', dirColor: '#fff0d0', dirI: 1.4 });
    // seine & city
    const river = mesh(new THREE.PlaneGeometry(500, 40), mat('#14204a', { emissive: '#050a20' }), [0, -40, 0], [-Math.PI / 2, 0, 0.3]);
    group.add(river);
    const winTex = canvasTex('windows', 32, (g, s) => { g.fillStyle = '#2a2a3a'; g.fillRect(0, 0, s, s); for (let y = 2; y < s; y += 8) for (let x = 2; x < s; x += 8) { g.fillStyle = Math.random() < 0.45 ? '#ffd27a' : '#1a1a28'; g.fillRect(x, y, 4, 5); } });
    const bld = new THREE.Group();
    bld.add(mesh(G.box(10, 14, 10), mat('#ffffff', { map: winTex, emissive: '#ffffff', emissiveMap: winTex, emissiveIntensity: 0.5 }), [0, 7, 0]), mesh(G.box(10.4, 2.5, 10.4), mat('#3a3a4a'), [0, 15, 0]));
    instanced(group, bld, ringTransforms(70, 50, 140, -40, { face: true, scale: [0.8, 1.6], jitter: 0.1 }));
    // eiffel tower
    const eif = new THREE.Group();
    const gold = mat('#c89a3a', { emissive: '#6a4a10' });
    for (let i = 0; i < 4; i++) { const leg = mesh(G.cyl(0.6, 2.5, 28, 4), gold, [0, 14, 0]); const a = i * 1.57 + 0.78; leg.position.set(Math.cos(a) * 6, 14, Math.sin(a) * 6); leg.rotation.set(Math.sin(a) * 0.22, 0, -Math.cos(a) * 0.22); eif.add(leg); }
    eif.add(mesh(G.box(9, 1, 9), gold, [0, 20, 0]), mesh(G.cyl(0.8, 2.2, 40, 4), gold, [0, 48, 0]), mesh(G.box(5, 0.8, 5), gold, [0, 40, 0]));
    const beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: '#ffe8a0', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    beacon.scale.setScalar(10); beacon.position.y = 69; eif.add(beacon);
    eif.position.set(-60, -40, -110);
    group.add(eif);
    // rotunda platform with the presidential seal
    const seal = mat('#ffffff', { map: canvasTex('seal', 256, (g, s) => {
      g.fillStyle = '#e9e4da'; g.fillRect(0, 0, s, s);
      const c = s / 2;
      const rings = [['#1d3f9a', 0.5], ['#f4f0e8', 0.43], ['#c62a2a', 0.36], ['#f4f0e8', 0.29], ['#1d3f9a', 0.22]];
      for (const [col, r] of rings) { g.fillStyle = col; g.beginPath(); g.arc(c, c, r * s, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#c8a03a'; g.font = 'bold 54px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('RF', c, c + 4);
      g.strokeStyle = '#c8a03a'; g.lineWidth = 3; for (let i = 0; i < 24; i++) { const a = i / 24 * 6.28; g.beginPath(); g.moveTo(c + Math.cos(a) * s * 0.44, c + Math.sin(a) * s * 0.44); g.lineTo(c + Math.cos(a) * s * 0.49, c + Math.sin(a) * s * 0.49); g.stroke(); }
    }) });
    seal.map.repeat.set(1, 1);
    const marble = mat('#ffffff', { map: speckle('marble', '#e8e4dc', ['#d8d0c4', '#c8c0b4', '#f4f0ea'], 64, 60, 1, 3) });
    const surfaces = standardSurfaces(def,
      (s) => {
        const p = platform(s, { top: seal, side: marble, under: mat('#ffffff', { map: TEX.rock('#5a5468') }), tile: s.r * 2, rim: mat('#c8a03a', { emissive: '#4a3010' }) });
        // offset the planar uv so the seal is centred
        const disc = p.children[0];
        const uv = disc.geometry.attributes.uv;
        for (let i = 98; i < uv.count; i++) uv.setXY(i, uv.getX(i) + 0.5, uv.getY(i) + 0.5);
        for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28; p.add(mesh(G.cyl(0.18, 0.18, 0.7, 6), marble, [Math.cos(a) * (s.r - 0.2), -0.95, Math.sin(a) * (s.r - 0.2)])); }
        return p;
      },
      (s) => softPlatform(s, mat('#c8a03a', { emissive: '#3a2808' }), marble, 0.3));
    surfaces.forEach((o) => group.add(o));
    // floating tricolour flags
    const flags = [];
    for (let i = 0; i < 6; i++) {
      const f = new THREE.Group();
      const tex = canvasTex('fr', 32, (g, s) => { g.fillStyle = '#1d3f9a'; g.fillRect(0, 0, s / 3, s); g.fillStyle = '#f4f4f4'; g.fillRect(s / 3, 0, s / 3, s); g.fillStyle = '#c62a2a'; g.fillRect((2 * s) / 3, 0, s / 3, s); });
      f.add(mesh(G.cyl(0.05, 0.05, 4, 4), gold, [0, 2, 0]));
      const cloth = mesh(new THREE.PlaneGeometry(2, 1.3, 6, 1), mat('#ffffff', { map: tex, side: THREE.DoubleSide }), [1, 3.3, 0]);
      f.add(cloth);
      const a = i / 6 * 6.28 + 0.4;
      const fr = def.surfaces[0].r + 5;
      f.position.set(Math.cos(a) * fr, -2 + Math.sin(i) * 2, Math.sin(a) * fr);
      group.add(f); flags.push(cloth);
    }
    return {
      group, surfaces, fog: ['#0c1430', 50, 200], bg: '#050a24', R: 9.2,
      update(dt, t) {
        for (const c of flags) { const p = c.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 3 + t * 6) * 0.15 * (p.getX(i) + 1)); p.needsUpdate = true; }
        beacon.material.opacity = 0.6 + 0.4 * Math.sin(t * 4);
      },
    };
  },

  diner(def) {
    const group = new THREE.Group();
    group.add(skyDome('#14051a', '#7a2a3a', '#2a0a10', 300));
    group.add(moon([-50, 60, -170], '#ffd8b0', 18, '#ff8a6a'));
    lights(group, { hemiSky: '#ff9a8a', hemiGround: '#3a1a10', hemiI: 0.9, dirColor: '#ffd0a0', dirI: 1.5 });
    const desert = mesh(new THREE.CircleGeometry(250, 32), mat('#ffffff', { map: speckle('sand', '#7a4a2a', ['#6a3a20', '#8a5a34', '#5a2a18'], 64, 120, 1, 3) }), [0, -38, 0], [-Math.PI / 2, 0, 0]);
    desert.material.map.repeat.set(50, 50);
    group.add(desert);
    group.add(mesh(G.box(500, 0.1, 10), mat('#2a2a2a'), [0, -37.9, 30]));
    // diner building with neon
    const din = new THREE.Group();
    din.add(mesh(G.box(30, 8, 12), mat('#c8ccd4'), [0, 4, 0]), mesh(G.box(31, 1.2, 13), mat('#c42828'), [0, 8.5, 0]));
    const neon = mesh(G.box(14, 3, 0.4), basic('#ff3a6a', { fog: false }), [0, 12, 5]);
    din.add(neon, mesh(G.box(0.6, 6, 0.6), mat('#444'), [0, 9, 5]));
    din.position.set(25, -38, -60);
    group.add(din);
    // giant cups and cacti
    const cup = new THREE.Group();
    cup.add(mesh(G.cyl(3, 2.2, 9, 10), mat('#e83a3a'), [0, 4.5, 0]), mesh(G.cyl(3.1, 3.1, 0.6, 10), mat('#ffffff'), [0, 9.2, 0]), mesh(G.cyl(0.3, 0.3, 6, 6), mat('#ffffff'), [1, 12, 0], [0, 0, 0.3]));
    instanced(group, cup, ringTransforms(8, 40, 90, -38, { scale: [1, 2] }));
    const cactus = new THREE.Group();
    const cg = mat('#3a7a3a');
    cactus.add(mesh(G.cyl(0.8, 0.9, 7, 7), cg, [0, 3.5, 0]), mesh(G.cyl(0.5, 0.5, 3, 6), cg, [1.4, 4, 0]), mesh(G.cyl(0.5, 0.5, 2.5, 6), cg, [-1.3, 5, 0]));
    instanced(group, cactus, ringTransforms(40, 30, 120, -38, { scale: [0.8, 2] }));
    // the burger platform
    const bun = mat('#ffffff', { map: speckle('bun', '#d48a3a', ['#c47a2a', '#e09a4a', '#b86a20'], 64, 50, 1, 3) });
    const patty = mat('#ffffff', { map: speckle('patty', '#5a2a14', ['#4a2010', '#6a3a1e', '#3a180a'], 64, 140, 1, 3) });
    const surfaces = standardSurfaces(def,
      (s) => {
        const p = platform(s, { top: patty, side: bun, under: bun, tile: 4, noCone: true });
        p.add(mesh(new THREE.SphereGeometry(s.r, 24, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), bun, [0, -1.4, 0], null, [1, 0.45, 1]));
        // lettuce frills + cheese drips on the rim
        for (let i = 0; i < 28; i++) {
          const a = i / 28 * 6.28;
          p.add(mesh(G.box(1.2, 0.18, 0.7), mat('#4ac83a'), [Math.cos(a) * (s.r + 0.1), -0.3, Math.sin(a) * (s.r + 0.1)], [0.3, -a, 0]));
          if (i % 3 === 0) p.add(mesh(G.box(1.1, 0.9, 0.08), mat('#ffc82a'), [Math.cos(a + 0.1) * (s.r + 0.05), -0.5, Math.sin(a + 0.1) * (s.r + 0.05)], [0, -a - 1.57, 0]));
        }
        return p;
      },
      (s) => {
        const p = new THREE.Group();
        p.add(mesh(new THREE.SphereGeometry(s.r, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), bun, [0, -0.3, 0], null, [1, 0.5, 1]));
        p.add(mesh(G.cyl(s.r, s.r, 0.3, 20), bun, [0, -0.3, 0]));
        for (let i = 0; i < 24; i++) { const a = Math.random() * 6.28, r = Math.random() * s.r * 0.85; p.add(mesh(G.ball(0.08, 0), mat('#f8f0d8'), [Math.cos(a) * r, -0.2 + 0.5 * Math.sqrt(1 - (r / s.r) ** 2) * s.r * 0.5, Math.sin(a) * r], null, [1, 0.5, 1.6])); }
        p.position.set(s.cx, s.y, s.cz);
        return p;
      });
    surfaces.forEach((o) => group.add(o));
    return {
      group, surfaces, fog: ['#2a0e18', 50, 200], bg: '#14051a', R: 9.4,
      update(dt, t) { neon.material.color.setHSL(0.95 + Math.sin(t * 2) * 0.03, 1, Math.sin(t * 11) > -0.9 ? 0.55 : 0.2); },
    };
  },

  cave(def) {
    const group = new THREE.Group();
    group.add(skyDome('#0a0604', '#1a120a', '#050302', 0));
    lights(group, { hemiSky: '#c89a5a', hemiGround: '#1a1008', hemiI: 0.8, dirColor: '#ffc880', dirI: 0.9 });
    const brick = mat('#ffffff', { map: TEX.stoneTiles('#5a4636', '#2a1e14'), side: THREE.BackSide });
    brick.map.repeat.set(40, 8);
    const wall = mesh(new THREE.CylinderGeometry(42, 42, 80, 24, 1, true), brick, [0, -10, 0]);
    group.add(wall);
    group.add(mesh(new THREE.CircleGeometry(42, 24), mat('#1a120a'), [0, -45, 0], [-Math.PI / 2, 0, 0]));
    // shelves of cheese wheels on the walls
    const wheel = new THREE.Group();
    wheel.add(mesh(G.cyl(1.4, 1.4, 1, 10), mat('#e8b84a'), [0, 0.5, 0]), mesh(G.cyl(1.42, 1.42, 0.2, 10), mat('#b8862a'), [0, 1, 0]));
    const tr = [];
    for (let row = 0; row < 6; row++) for (let i = 0; i < 26; i++) {
      const a = i / 26 * 6.28 + row * 0.1, r = 39;
      tr.push({ x: Math.cos(a) * r, y: -30 + row * 7, z: Math.sin(a) * r, ry: 0, rx: Math.PI / 2 * (row % 2), s: 0.9 + Math.random() * 0.4 });
    }
    instanced(group, wheel, tr);
    const plank = new THREE.Group();
    plank.add(mesh(G.box(9, 0.4, 3), mat('#ffffff', { map: TEX.wood('#5a3a1e') }), [0, 0, 0]));
    const ptr = [];
    for (let row = 0; row < 6; row++) for (let i = 0; i < 18; i++) { const a = i / 18 * 6.28; ptr.push({ x: Math.cos(a) * 39.5, y: -30.6 + row * 7, z: Math.sin(a) * 39.5, ry: -a + Math.PI / 2 }); }
    instanced(group, plank, ptr);
    // torches
    const torches = [];
    for (let i = 0; i < 4; i++) {
      const a = i * 1.57 + 0.78;
      const p = new THREE.PointLight('#ff9a3a', 60, 40, 1.6);
      p.position.set(Math.cos(a) * 20, 4, Math.sin(a) * 20);
      group.add(p); torches.push(p);
      const tt = torch(); tt.position.set(Math.cos(a) * 20, 2.5, Math.sin(a) * 20); tt.scale.setScalar(2); group.add(tt);
    }
    const parmTop = mat('#ffffff', { map: canvasTex('parmtop', 128, (g, s) => {
      g.fillStyle = '#f0d27a'; g.fillRect(0, 0, s, s);
      for (let i = 0; i < 260; i++) { g.fillStyle = ['#e3c160', '#fae9a8', '#d8b04f'][i % 3]; g.fillRect(Math.random() * s, Math.random() * s, 2, 2); }
      g.strokeStyle = '#d0a64a'; g.lineWidth = 2;
      for (let i = 1; i < 6; i++) { g.beginPath(); g.arc(s / 2, s / 2, i * s / 12, 0, Math.PI * 2); g.stroke(); }
    }) });
    const rind = mat('#ffffff', { map: canvasTex('rindtext', 128, (g, s) => {
      g.fillStyle = '#c99632'; g.fillRect(0, 0, s, s);
      g.fillStyle = '#7a5216'; g.font = 'bold 20px monospace';
      g.fillText('PARMIGIANO', 4, 40); g.fillText('REGGIANO', 14, 90);
    }) });
    const surfaces = standardSurfaces(def,
      (s) => { const p = platform(s, { top: parmTop, side: rind, under: mat('#ffffff', { map: TEX.rock('#3a2a1e') }), tile: s.r * 2, sideTile: 9 });
        const disc = p.children[0]; const uv = disc.geometry.attributes.uv; for (let i = 98; i < uv.count; i++) uv.setXY(i, uv.getX(i) + 0.5, uv.getY(i) + 0.5); return p; },
      (s) => softPlatform(s, parmTop, rind));
    surfaces.forEach((o) => group.add(o));
    const dust = new Wisps(group, 30, '#ffd8a0', 30, [-5, 15]);
    return {
      group, surfaces, fog: ['#140c06', 25, 95], bg: '#0a0604', R: 9,
      update(dt, t) { torches.forEach((l, i) => flicker(l, 60, t, i)); dust.update(t * 0.3); },
    };
  },

  arena(def) {
    const group = new THREE.Group();
    group.add(skyDome('#0a0a1a', '#2a1a4a', '#0a0a14', 500));
    lights(group, { hemiSky: '#c8c8ff', hemiGround: '#1a1a2a', hemiI: 1.2, dirColor: '#ffffff', dirI: 1.6, dir: [0.2, 1, 0.4] });
    // stands
    const stand = mat('#ffffff', { map: stripes('seats', '#3a2a6a', '#2a1a4a', 16, 2) });
    for (let i = 0; i < 6; i++) {
      const r = 30 + i * 4;
      const ring = mesh(new THREE.CylinderGeometry(r + 4, r, 4, 40, 1, true), stand, [0, -24 + i * 4, 0]);
      ring.material.side = THREE.DoubleSide;
      group.add(ring);
    }
    group.add(mesh(new THREE.CircleGeometry(30, 32), mat('#ffffff', { map: TEX.grass('#2a5a2a') }), [0, -26, 0], [-Math.PI / 2, 0, 0]));
    // ghost crowd
    const ghost = new THREE.Group();
    ghost.add(mesh(new THREE.ConeGeometry(0.9, 2.4, 7), mat('#e8eaf8', { emissive: '#3a3a5a' }), [0, 1.2, 0]), mesh(G.ball(0.12, 0), basic('#111'), [0.25, 1.7, 0.7]), mesh(G.ball(0.12, 0), basic('#111'), [-0.25, 1.7, 0.7]));
    const crowd = [];
    for (let i = 0; i < 6; i++) for (let j = 0; j < 40; j++) {
      const a = j / 40 * 6.28 + i * 0.07, r = 32 + i * 4;
      crowd.push({ x: Math.cos(a) * r, y: -24 + i * 4 + 0.5, z: Math.sin(a) * r, ry: Math.atan2(-Math.cos(a), -Math.sin(a)), s: 1 + Math.random() * 0.3 });
    }
    const crowdG = new THREE.Group();
    instanced(crowdG, ghost, crowd);
    group.add(crowdG);
    // floodlights
    for (let i = 0; i < 4; i++) {
      const a = i * 1.57 + 0.78;
      const f = new THREE.Group();
      f.add(mesh(G.cyl(0.6, 0.8, 40, 6), mat('#444'), [0, 0, 0]), mesh(G.box(6, 3, 1), basic('#ffffe8', { fog: false }), [0, 21, 0]));
      const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: '#ffffe0', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      gl.scale.setScalar(26); gl.position.y = 21; f.add(gl);
      f.position.set(Math.cos(a) * 58, -10, Math.sin(a) * 58);
      f.lookAt(0, -10, 0);
      group.add(f);
    }
    // humanball platform
    const ballTop = mat('#ffffff', { map: canvasTex('ballTop', 256, (g, s) => {
      g.fillStyle = '#e8382c'; g.fillRect(0, 0, s, s / 2); g.fillStyle = '#f2f2f2'; g.fillRect(0, s / 2, s, s / 2);
      g.fillStyle = '#1a1a1a'; g.fillRect(0, s / 2 - 10, s, 20);
      g.beginPath(); g.arc(s / 2, s / 2, 40, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#f2f2f2'; g.beginPath(); g.arc(s / 2, s / 2, 26, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#1a1a1a'; g.font = 'bold 22px sans-serif'; g.textAlign = 'center'; g.fillText('HUMAN', s / 2, s * 0.25); g.fillText('BALL', s / 2, s * 0.8);
    }) });
    const surfaces = standardSurfaces(def,
      (s) => { const p = platform(s, { top: ballTop, side: mat('#1a1a1a'), under: mat('#ffffff', { map: TEX.rock('#4a4a5a') }), tile: s.r * 2, rim: mat('#f2f2f2') });
        const disc = p.children[0]; const uv = disc.geometry.attributes.uv; for (let i = 98; i < uv.count; i++) uv.setXY(i, uv.getX(i) + 0.5, uv.getY(i) + 0.5); return p; },
      (s) => softPlatform(s, mat('#f2f2f2'), mat('#e8382c'), 0.35));
    surfaces.forEach((o) => group.add(o));
    return {
      group, surfaces, fog: ['#100c22', 60, 220], bg: '#0a0a1a', R: 10, crowd: crowdG,
      cheer: 0,
      update(dt, t) {
        this.cheer = Math.max(0, this.cheer - dt);
        crowdG.position.y = Math.abs(Math.sin(t * (this.cheer > 0 ? 14 : 3))) * (this.cheer > 0 ? 0.8 : 0.15);
      },
    };
  },

  village(def) {
    const group = new THREE.Group();
    group.add(skyDome('#0a1238', '#d8784a', '#1a1028', 300));
    // crescent moon
    const cres = new THREE.Group();
    cres.add(mesh(G.ball(10, 2), basic('#fff4c8', { fog: false })), mesh(G.ball(9.4, 2), basic('#0e1640', { fog: false }), [3.5, 1.5, 2]));
    cres.position.set(60, 85, -150); group.add(cres);
    lights(group, { hemiSky: '#ffb08a', hemiGround: '#1a1030', hemiI: 1.0, dirColor: '#ffd0a0', dirI: 1.3, dir: [0.6, 0.6, -0.4] });
    group.add(mesh(new THREE.CircleGeometry(220, 32), mat('#ffffff', { map: TEX.grass('#1f3420') }), [0, -30, 0], [-Math.PI / 2, 0, 0]));
    group.children[group.children.length - 1].material.map.repeat.set(50, 50);
    group.add(mesh(new THREE.PlaneGeometry(400, 20), mat('#2a3a6a', { emissive: '#0a1030' }), [0, -29.9, 20], [-Math.PI / 2, 0, 0]));
    // stilt houses
    const house = new THREE.Group();
    const wood = mat('#ffffff', { map: TEX.wood('#7a4a26') });
    for (const [x, z] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) house.add(mesh(G.cyl(0.2, 0.2, 3, 5), wood, [x, 1.5, z]));
    house.add(mesh(G.box(4.4, 3, 4.4), wood, [0, 4.5, 0]), mesh(G.cone(4.2, 2.8, 4), mat('#6a2a1a'), [0, 7.4, 0], [0, Math.PI / 4, 0]), mesh(G.box(1, 1, 0.1), basic('#ffc86a'), [0, 4.6, 2.25]));
    instanced(group, house, ringTransforms(30, 30, 90, -30, { face: true, scale: [1.6, 2.6] }));
    const palm = new THREE.Group();
    palm.add(mesh(G.cyl(0.25, 0.4, 9, 5), mat('#6a4a2a'), [0, 4.5, 0], [0.1, 0, 0]));
    for (let i = 0; i < 6; i++) palm.add(mesh(G.box(0.6, 0.08, 3.5), mat('#2a6a2a'), [Math.cos(i) * 1.3, 9, Math.sin(i) * 1.3], [0.5, -i, 0]));
    instanced(group, palm, ringTransforms(40, 25, 100, -30, { scale: [1.5, 2.5] }));
    // a distant dome silhouette
    const dome = new THREE.Group();
    dome.add(mesh(G.box(20, 12, 20), mat('#2a2040'), [0, 6, 0]), mesh(new THREE.SphereGeometry(9, 12, 6, 0, 6.28, 0, Math.PI / 2), mat('#3a2a5a'), [0, 12, 0]), mesh(G.cyl(1.2, 1.5, 30, 6), mat('#2a2040'), [14, 15, 0]));
    dome.position.set(-40, -30, -140); dome.scale.setScalar(1.6); group.add(dome);
    // drum platform
    const skin = mat('#ffffff', { map: canvasTex('drumskin', 128, (g, s) => {
      g.fillStyle = '#e8d4a8'; g.fillRect(0, 0, s, s);
      for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(120,80,40,${Math.random() * 0.12})`; g.fillRect(Math.random() * s, Math.random() * s, 3, 3); }
      g.strokeStyle = 'rgba(90,60,30,0.4)'; g.lineWidth = 3; g.beginPath(); g.arc(s / 2, s / 2, s * 0.2, 0, 6.28); g.stroke();
    }) });
    const drumWood = mat('#ffffff', { map: TEX.wood('#8a3a1a') });
    const surfaces = standardSurfaces(def,
      (s) => { const p = platform(s, { top: skin, side: drumWood, under: drumWood, tile: s.r * 2, noCone: true });
        const disc = p.children[0]; const uv = disc.geometry.attributes.uv; for (let i = 98; i < uv.count; i++) uv.setXY(i, uv.getX(i) + 0.5, uv.getY(i) + 0.5);
        p.add(mesh(G.cyl(s.r, s.r * 0.9, 5, 32, 1, true), drumWood, [0, -3.9, 0]));
        for (let i = 0; i < 24; i++) { const a = i / 24 * 6.28; p.add(mesh(G.ball(0.14, 0), mat('#c8a03a', { emissive: '#3a2808' }), [Math.cos(a) * (s.r + 0.02), -0.4, Math.sin(a) * (s.r + 0.02)])); }
        for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28; p.add(mesh(G.box(0.08, 3.5, 0.08), mat('#c8b080'), [Math.cos(a) * (s.r + 0.05), -2.4, Math.sin(a) * (s.r + 0.05)], [0, -a, 0.35])); }
        return p; },
      (s) => { const p = softPlatform(s, skin, drumWood, 0.4); const lamp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: '#ff9a4a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); lamp.scale.setScalar(2.2); lamp.position.y = -0.8; p.add(lamp); return p; });
    surfaces.forEach((o) => group.add(o));
    const lanterns = new Wisps(group, 30, '#ffaa4a', 40, [0, 16]);
    return {
      group, surfaces, fog: ['#3a2440', 50, 200], bg: '#0a1238', R: 8.6, pop: 0,
      update(dt, t) {
        lanterns.update(t * 0.4);
        this.pop = Math.max(0, this.pop - dt * 4);
        const disc = surfaces[0].children[0];
        disc.scale.y = 1 + this.pop * 0.25;
      },
    };
  },

  sea(def) {
    const group = new THREE.Group();
    group.add(skyDome('#0a1014', '#3a4a50', '#0a1418', 0));
    lights(group, { hemiSky: '#8aa8b8', hemiGround: '#0a1a20', hemiI: 1.1, dirColor: '#d8e8f0', dirI: 1.2 });
    const ocean = new THREE.Mesh(new THREE.PlaneGeometry(400, 400, 64, 64), new THREE.MeshLambertMaterial({ color: '#1a4a6a', emissive: '#041420', flatShading: true }));
    ocean.rotation.x = -Math.PI / 2; ocean.position.y = -3;
    group.add(ocean);
    // shark fins circling
    const fins = [];
    for (let i = 0; i < 6; i++) {
      const f = mesh(new THREE.ConeGeometry(0.8, 2, 3), mat('#3a5a7a'), [0, 0, 0], null, [0.35, 1, 1.2]);
      f.userData = { a: Math.random() * 6.28, r: def.surfaces[0].r + 4 + Math.random() * 10, sp: 0.2 + Math.random() * 0.2 };
      group.add(f); fins.push(f);
    }
    // rain
    const rainN = 1500;
    const rp = new Float32Array(rainN * 3);
    for (let i = 0; i < rainN; i++) { rp[i * 3] = (Math.random() - 0.5) * 80; rp[i * 3 + 1] = Math.random() * 50 - 5; rp[i * 3 + 2] = (Math.random() - 0.5) * 80; }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
    const rain = new THREE.Points(rg, new THREE.PointsMaterial({ color: '#a8c8e0', size: 0.12, transparent: true, opacity: 0.6 }));
    group.add(rain);
    const plank = mat('#ffffff', { map: canvasTex('raft', 64, (g, s) => { g.fillStyle = '#8a6a3a'; g.fillRect(0, 0, s, s); for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#7a5a2e' : '#9a7a44'; g.fillRect(0, i * 8, s, 7); g.fillStyle = '#3a2a14'; g.fillRect(0, i * 8 + 7, s, 1); } }) });
    const surfaces = standardSurfaces(def,
      (s) => { const p = platform(s, { top: plank, side: mat('#ffffff', { map: TEX.wood('#6a4a26') }), under: mat('#3a2a14'), tile: 4, noCone: true });
        for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28; p.add(mesh(new THREE.TorusGeometry(0.55, 0.22, 5, 10), mat(i % 2 ? '#e83a2a' : '#f4f4f4'), [Math.cos(a) * (s.r + 0.25), -0.5, Math.sin(a) * (s.r + 0.25)], [0, -a + Math.PI / 2, 0])); }
        for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; p.add(mesh(G.cyl(0.35, 0.35, 1.8, 8), mat('#5a3a1a'), [Math.cos(a) * (s.r * 0.7), -1.2, Math.sin(a) * (s.r * 0.7)])); }
        return p; },
      (s) => softPlatform(s, plank));
    surfaces.forEach((o) => group.add(o));
    const flashL = new THREE.DirectionalLight('#e0f0ff', 0); flashL.position.set(-20, 40, 10); group.add(flashL);
    return {
      group, surfaces, fog: ['#1a2a30', 30, 140], bg: '#0a1014', R: 9, flashL,
      update(dt, t) {
        const p = ocean.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, Math.sin(x * 0.12 + t * 1.3) * 0.9 + Math.cos(y * 0.1 + t * 0.9) * 0.8 + Math.sin((x + y) * 0.3 + t * 2) * 0.2); }
        p.needsUpdate = true; ocean.geometry.computeVertexNormals();
        for (const f of fins) { const u = f.userData; const a = u.a + t * u.sp; f.position.set(Math.cos(a) * u.r, -2.6 + Math.sin(t * 2 + u.a) * 0.2, Math.sin(a) * u.r); f.rotation.y = -a; }
        const r = rain.geometry.attributes.position;
        for (let i = 0; i < rainN; i++) { let y = r.getY(i) - dt * 40; if (y < -5) y += 50; r.setY(i, y); }
        r.needsUpdate = true;
        flashL.intensity *= Math.exp(-dt * 7);
        if (Math.random() < dt * 0.08) flashL.intensity = 4;
      },
    };
  },

  attic(def) {
    const group = new THREE.Group();
    group.add(skyDome('#0c0812', '#1c1220', '#06040a', 0));
    lights(group, { hemiSky: '#c8a8ff', hemiGround: '#1a1018', hemiI: 0.75, dirColor: '#cfd8ff', dirI: 1.1, dir: [0.4, 1, 0.7] });
    const plank = mat('#ffffff', { map: TEX.wood('#4a3020') });
    // the attic: a huge round wooden roof with rafters, far away in the dark
    const roofMat = mat('#ffffff', { map: TEX.wood('#3a2418'), side: THREE.DoubleSide });
    roofMat.map.repeat.set(30, 6);
    group.add(mesh(new THREE.ConeGeometry(46, 30, 24, 1, true), roofMat, [0, 22, 0]));
    group.add(mesh(new THREE.CylinderGeometry(46, 46, 60, 24, 1, true), mat('#ffffff', { map: TEX.wood('#2e1c12'), side: THREE.BackSide }), [0, -23, 0]));
    const rafter = new THREE.Group();
    rafter.add(mesh(G.box(0.8, 0.8, 47), plank, [0, 0, 23]));
    const rtr = [];
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; rtr.push({ x: 0, y: 36, z: 0, ry: a, rx: 0.56 }); }
    instanced(group, rafter, rtr);
    // a round window with the moon behind
    const win = new THREE.Group();
    win.add(mesh(new THREE.TorusGeometry(6, 0.6, 8, 32), plank));
    win.add(mesh(G.box(12, 0.5, 0.5), plank), mesh(G.box(0.5, 12, 0.5), plank));
    win.add(mesh(new THREE.CircleGeometry(6, 32), new THREE.MeshBasicMaterial({ color: '#b8c8ff', transparent: true, opacity: 0.35, fog: false }), [0, 0, -0.2]));
    win.position.set(0, 12, -44); group.add(win);
    group.add(moon([0, 13, -70], '#f4f0ff', 5));
    // junk piled against the walls: crates, trunks, old armchairs (instanced boxes)
    const crate = new THREE.Group(); crate.add(mesh(G.box(3, 3, 3), mat('#ffffff', { map: TEX.wood('#6a4628') })));
    const ctr = [];
    for (let i = 0; i < 70; i++) { const a = Math.random() * Math.PI * 2, r = 30 + Math.random() * 12; ctr.push({ x: Math.cos(a) * r, y: -14 + Math.random() * 18, z: Math.sin(a) * r, ry: Math.random() * 3, s: 0.6 + Math.random() * 1.4 }); }
    instanced(group, crate, ctr);
    // glowing cat eyes in the dark, blinking
    const eyeMat = new THREE.SpriteMaterial({ map: glowTex(), color: '#c8ff3a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const eyes = [];
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2, r = 22 + Math.random() * 16, y = -8 + Math.random() * 16;
      const pair = new THREE.Group();
      for (const sx of [-0.35, 0.35]) { const e = new THREE.Sprite(eyeMat); e.scale.setScalar(0.55); e.position.x = sx; pair.add(e); }
      pair.position.set(Math.cos(a) * r, y, Math.sin(a) * r); pair.lookAt(0, y, 0);
      pair.userData.ph = Math.random() * 20;
      group.add(pair); eyes.push(pair);
    }
    // hanging bulbs
    const bulbs = [];
    for (let i = 0; i < 3; i++) {
      // hanging behind the fight (2D: nothing between the camera and the fighters)
      const p = new THREE.PointLight('#ffc070', 55, 34, 1.6);
      p.position.set([-9, 9, 0][i], [9.5, 9.5, 11][i], [-6, -6, -10][i]);
      group.add(p); bulbs.push(p);
      group.add(mesh(G.cyl(0.02, 0.02, 14, 4), basic('#222'), [p.position.x, 16, p.position.z]));
      group.add(mesh(G.ball(0.3, 1), basic('#ffe0a0'), [p.position.x, 9, p.position.z]));
    }
    // the rug: concentric braided rings and a fringe of tassels
    const rug = mat('#ffffff', { map: canvasTex('rug', 256, (g, sz) => {
      const cols = ['#5a2a6a', '#8a3a3a', '#c88a3a', '#3a5a6a', '#6a3a7a', '#a84a3a', '#d8b05a', '#2e4a5a'];
      for (let i = 0; i < 16; i++) {
        g.fillStyle = cols[i % cols.length];
        g.beginPath(); g.arc(sz / 2, sz / 2, sz / 2 * (1 - i / 16), 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1;
        for (let k = 0; k < 40; k++) { const t = k / 40 * Math.PI * 2; const rr = sz / 2 * (1 - (i + 0.5) / 16); g.beginPath(); g.arc(sz / 2 + Math.cos(t) * rr, sz / 2 + Math.sin(t) * rr, 1.2, 0, 6.3); g.stroke(); }
      }
      for (let i = 0; i < 400; i++) { g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(Math.random() * sz, Math.random() * sz, 1, 1); }
    }) });
    const surfaces = standardSurfaces(def,
      (s) => {
        const p = platform(s, { top: rug, side: plank, under: mat('#ffffff', { map: TEX.wood('#2a1a10') }), tile: s.r * 2, sideTile: 3 });
        const disc = p.children[0]; const uv = disc.geometry.attributes.uv; for (let i = 98; i < uv.count; i++) uv.setXY(i, uv.getX(i) + 0.5, uv.getY(i) + 0.5);
        const fr = new THREE.Group(); fr.add(mesh(G.box(0.12, 0.35, 0.08), mat('#d8b05a'), [0, -0.15, 0]));
        const ftr = []; for (let i = 0; i < 80; i++) { const a = i / 80 * Math.PI * 2; ftr.push({ x: Math.cos(a) * (s.r + 0.03), y: 0.02, z: Math.sin(a) * (s.r + 0.03), ry: -a }); }
        instanced(p, fr, ftr);
        return p;
      },
      (s, i) => {
        if (i === 3) {
          // the cat tree: a sisal post and a cushion on top
          const g = softPlatform(s, mat('#9a5a8a'), mat('#c8b08a'), 0.3);
          g.add(mesh(G.cyl(0.35, 0.45, 9, 8), mat('#c8b08a', { map: stripes('sisal', '#c8b08a', '#a88a6a', 8, 1) }), [0, -4.8, 0]));
          return g;
        }
        // trunk lids
        const g = softPlatform(s, mat('#ffffff', { map: TEX.wood('#7a4a2a') }), mat('#5a3420'), 0.4);
        g.add(mesh(G.box(s.r * 1.8, 2.4, s.r * 1.4), mat('#ffffff', { map: TEX.wood('#5a3420') }), [0, -1.6, 0]));
        g.add(mesh(G.box(s.r * 1.85, 0.18, 0.12), mat('#c8a040'), [0, -0.6, s.r * 0.7]));
        return g;
      });
    surfaces.forEach((o) => group.add(o));
    const dust = new Wisps(group, 40, '#ffe8c0', 30, [-4, 14]);
    return {
      group, surfaces, fog: ['#100a14', 28, 100], bg: '#0c0812', R: 9,
      update(dt, t) {
        bulbs.forEach((l, i) => flicker(l, 55, t, i * 3));
        dust.update(t * 0.25);
        for (const e of eyes) { const k = (t + e.userData.ph) % 7; e.visible = !(k > 6.6 && k < 6.8); }
      },
    };
  },
};

export function buildStageView(def) {
  const b = BUILDERS[def.id] || BUILDERS.cemetery;
  const v = b(def);
  v.surfaces.forEach((o, i) => { if (i === 0) o.userData.alwaysVisible = true; });
  try { enhanceStage(v, def); } catch (e) { console.warn('stage art', def.id, e); }
  try { clearCameraSide(v, def.surfaces[0].r); } catch (e) { console.warn('stage clear', def.id, e); }
  return v;
}

// 2D: the camera stands in front of the arena (toward +z). Props of the scenery between the camera and the fight
// (in front of the platform, at fighting height) would hide the fighters: they are removed.
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _m = new THREE.Matrix4(), _w = new THREE.Matrix4();
function blocking(x, y, z, R) { return z > R + 0.8 && y > -9 && y < 30 && Math.abs(x) < 60; }
function clearCameraSide(v, R) {
  const keep = new Set(v.surfaces);
  v.group.updateMatrixWorld(true);
  const visit = (o) => {
    if (keep.has(o)) return;
    if (o.isInstancedMesh) {
      let changed = false;
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, _m);
        _w.multiplyMatrices(o.matrixWorld, _m).decompose(_p, _q, _s);
        if (blocking(_p.x, _p.y, _p.z, R)) { _m.makeScale(0, 0, 0); o.setMatrixAt(i, _m); changed = true; }
      }
      if (changed) o.instanceMatrix.needsUpdate = true;
      return;
    }
    if (o.isMesh || o.isSprite || o.isPoints) {
      const g = o.geometry;
      if (g) { if (!g.boundingSphere) g.computeBoundingSphere(); if (g.boundingSphere && g.boundingSphere.radius * Math.max(o.scale.x, o.scale.z) > 40) return; }
      o.getWorldPosition(_p);
      if (blocking(_p.x, _p.y, _p.z, R)) o.visible = false;
      return;
    }
    // a small group (a tree, a mushroom, a tombstone...): judged by its position
    if (o !== v.group && o.isGroup && o.children.length && o.children.length < 40 && o.parent === v.group) {
      o.getWorldPosition(_p);
      if (blocking(_p.x, _p.y, _p.z, R)) { o.visible = false; return; }
    }
    for (const c of o.children) visit(c);
  };
  visit(v.group);
}

export function syncStageView(view, stage) {
  stage.surfaces.forEach((s, i) => { const o = view.surfaces[i]; if (o) syncSurface(o, s); });
}
