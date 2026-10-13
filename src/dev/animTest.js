// Animation test bench: ?animtest=<char>&anim=<what>[&n=8][&yaw=deg]
//   anim = a move id (jab1, smash, sp_n, ...), 'walk', 'run', 'idle', 'states' (one cell per state), 'moves' (each
//   move at its strike frame). Renders a grid of cells, each one a model instance driven by a fake fighter and
//   simulated from frame 0 up to its own frame, so the springs have their real history.
import * as THREE from 'three';
import { RigModel, preloadRigs, hasRig } from '../render/rig/rigModel.js';
import { CHARS } from '../sim/chars/index.js';
import { moveTimeline } from '../render/poses.js';
import { RIGS } from '../render/rig/chars.js';

const STATES = ['idle', 'walk', 'run', 'jumpsquat', 'air', 'fall', 'land', 'shield', 'dodge', 'hitstun', 'tumble', 'helpless', 'down', 'ledge', 'grabbing', 'grabbed', 'dizzy'];

function fakeF(char) {
  return { char, state: 'idle', grounded: true, vx: 0, vz: 0, vy: 0, jumps: 1, st: 0, mf: 0, mv: {}, move: null, va: [0, 0, 0, 0, 0, 0], launchKb: 0, hitlag: 0, size: 1 };
}

// build the timeline of one cell: returns a function(frame) -> sets F fields; and the frame to show
function plan(char, anim, i, n) {
  const def = CHARS[char];
  if (anim === 'walk' || anim === 'run' || anim === 'idle') {
    const sp = anim === 'walk' ? 3.4 : anim === 'run' ? 8.5 : 0;
    const total = 50 + Math.round(i * (anim === 'run' ? 24 : 40) / n);
    return { total, label: anim + ' ' + i, set: (F) => { F.state = anim; F.vz = sp; } };
  }
  if (anim === 'states') {
    const st = STATES[i % STATES.length];
    return {
      total: 40, label: st, set: (F, f) => {
        F.grounded = !['air', 'fall', 'tumble', 'helpless', 'hitstun', 'ledge', 'grabbed'].includes(st);
        F.state = st === 'fall' ? 'air' : st; F.vy = st === 'air' ? 0.15 : st === 'fall' ? -0.2 : 0; F.st = f; F.launchKb = st === 'hitstun' ? 40 : 0;
      },
    };
  }
  const ids = anim === 'moves' ? Object.keys(def.moves) : [anim];
  const id = ids[anim === 'moves' ? i % ids.length : 0];
  const M = def.moves[id];
  if (!M) return null;
  const tl = moveTimeline(M);
  const f = anim === 'moves' ? Math.round(tl.a + 1) : Math.round(i * (Math.max(tl.dur, tl.b + 3) - 1) / Math.max(1, n - 1));
  const air = /air$/.test(M.pose) || /^(nair|fair|uair|dair)$/.test(id);
  return { total: 20 + f, label: id + ' f' + f + (anim === 'moves' ? '' : ' (' + tl.a + '-' + tl.b + '/' + tl.dur + ')'), set: (F, fr) => {
    const m = fr - 20;
    F.grounded = !air; F.state = m >= 0 ? 'move' : (air ? 'air' : 'idle'); F.move = m >= 0 ? id : null; F.mf = Math.max(0, m); F.vy = air ? 0.02 : 0;
  } };
}

export async function animTest(app) {
  const p = app.params;
  const char = p.get('animtest');
  const anim = p.get('anim') || 'states';
  await preloadRigs([char]);
  if (!hasRig(char)) throw new Error('pas de modèle riggé pour ' + char);
  const nCells = anim === 'states' ? STATES.length : anim === 'moves' ? Object.keys(CHARS[char].moves).length : +(p.get('n') || 8);
  const cols = Math.min(nCells, +(p.get('cols') || (nCells > 9 ? 6 : 4)));
  const rows = Math.ceil(nCells / cols);
  const R = app.renderer;
  const scene = R.scene;
  scene.background = new THREE.Color('#2a2440');
  scene.add(new THREE.HemisphereLight('#c9c3ff', '#3a2f2a', 1.1));
  const sun = new THREE.DirectionalLight('#fff1dc', 2.2);
  sun.position.set(4, 9, 6);
  scene.add(sun);
  const yaw = (+(p.get('yaw') || 35)) * Math.PI / 180;
  const cells = [];
  for (let i = 0; i < nCells; i++) {
    const pl = plan(char, anim, i, nCells);
    if (!pl) continue;
    const m = new RigModel(char);
    const holder = new THREE.Group();
    holder.position.set(i * 6, 0, 0);
    holder.add(m.pivot);
    scene.add(holder);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(1.4, 32), new THREE.MeshStandardMaterial({ color: '#5b5470' }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(i * 6, -0.001, 0);
    scene.add(ground);
    const F = fakeF(char);
    const pos = new THREE.Vector3(i * 6, 0, 0);
    for (let f = 0; f <= pl.total; f++) {
      pl.set(F, f);
      const M = F.move ? CHARS[char].moves[F.move] : null;
      if (F.grounded) pos.z += F.vz / 60;
      const out = m.update(F, M, f / 60, 1 / 60, pos);
      if (RIGS[char].update) RIGS[char].update({ root: holder, rig: m.rig, sockets: m.sockets, model: m }, F, out, f / 60);
    }
    cells.push({ m, label: pl.label, x: i * 6 });
  }
  const labels = document.createElement('div');
  labels.style.cssText = 'position:fixed;inset:0;pointer-events:none;font:12px monospace;color:#ffe066;';
  document.body.appendChild(labels);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const h = cells[0].m.h;
  const draw = () => {
    const w = innerWidth, hh = innerHeight;
    const cw = w / cols, ch = hh / rows;
    const g = R.gl;
    g.setRenderTarget(null);
    g.setScissorTest(true);
    labels.innerHTML = '';
    cells.forEach((c, i) => {
      const cx = (i % cols) * cw, cy = Math.floor(i / cols) * ch;
      g.setViewport(cx, hh - cy - ch, cw, ch); g.setScissor(cx, hh - cy - ch, cw, ch);
      cam.aspect = cw / ch; cam.updateProjectionMatrix();
      const d = h * 2.4;
      cam.position.set(c.x + Math.sin(yaw) * d, h * 0.75, Math.cos(yaw) * d);
      cam.lookAt(c.x, h * 0.48, 0);
      g.render(scene, cam);
      labels.innerHTML += `<div style="position:absolute;left:${cx + 6}px;top:${cy + 4}px">${c.label}</div>`;
    });
    g.setScissorTest(false);
  };
  window.__animDraw = draw;
  const loop = () => { draw(); requestAnimationFrame(loop); };
  draw();
  requestAnimationFrame(loop);
}
