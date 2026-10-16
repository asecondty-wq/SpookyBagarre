// Checks for the big animation pass (16 Oct 2026), in a quick match with posecheck.js:
//   open  ?quick=1&chars=<a>,<b>&humans=1&dev=vpad0&bot=0&hazards=0&stage=cemetery&mg=0
//   const Q = await import('/tools/dev/passcheck.js'); await Q.ready();
//   await Q.sheet('aboueb_jabs', [['jab1', 0, 6], ['smash', 20, 8]])   // [move, hold frames, frame], hitboxes in red
//   await Q.film('aboueb_smash', 'smash', { hold: 20, n: 12, every: 3, opp: 2.2 })  // a strip of the move
//   Q.trace('sp_u', { opp: 0.5, n: 70, btn: 'x' })                       // where both fighters go, frame by frame
// Shots go to tools/dev/shots/<name>.png (tools/serve.py).
import * as THREE from 'three';
import { CHARS } from '/src/sim/chars/index.js';
import { localToWorld } from '/src/sim/util.js';

let P, fm;
export async function ready() {
  P = await import('/tools/dev/posecheck.js');
  fm = await import('/src/sim/fighter.js');
  window.__errs = [];
  addEventListener('error', (e) => window.__errs.push(String(e.message)));
  addEventListener('unhandledrejection', (e) => window.__errs.push(String(e.reason)));
  await P.ready();
  __app.renderer.kick = () => {};
  const cv = __app.renderer.gl.domElement;
  if (cv.height < 300 || innerHeight < 300) {
    Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 720, configurable: true });
    __app.renderer.resize();
  }
  return P;
}
export const W = () => P.W();
export const errs = () => window.__errs.slice();

// both fighters set apart, the opponent `opp` metres in front (oy up), fresh; then the move started (A held `hold`
// frames for a smash; btn: the button held at the start)
export function begin(mv, o = {}) {
  const w = W(), F = w.fighters[o.slot || 0];
  for (const O of w.fighters) if (O !== F) {
    O.x = o.opp ?? 9; O.y = o.oy ?? 0; O.vx = O.vy = 0; O.damage = o.odmg ?? 0; O.state = 'idle'; O.hitstun = 0; O.hitlag = 0;
    O.move = null; O.stun = 0; O.dizzy = 0; O.carryT = 0; O.ctrlBy = -1; O.kx = O.ky = O.kz = 0; O.pendingLaunch = null; O.launchKb = 0; O.lie = 0; O.speedMul = 1; O.speedT = 0; O.grabbedBy = -1; O.facing = -Math.PI / 2; O.grounded = (o.oy ?? 0) === 0;
  }
  F.x = 0; F.y = o.y ?? 0; F.vx = F.vy = 0; F.state = F.y > 0 ? 'air' : 'idle'; F.grounded = F.y === 0; F.facing = Math.PI / 2;
  F.cd = { n: 0, s: 0, d: 0 }; F.usedUp = false; F.move = null; F.damage = 0;
  window.__vpads[0] = { axes: [0, 0], buttons: {} };
  if (F.y === 0) P.stepN(12);
  const b = { a: !!o.hold };
  if (o.btn) b[o.btn] = true;
  window.__vpads[0].buttons = b;
  if (o.axes) window.__vpads[0].axes = o.axes;
  fm.startMove(F, w, mv);
  return F;
}
export function release() { window.__vpads[0] = { axes: [0, 0], buttons: {} }; }

// a strip of the move: n frames, every `every` sim frames; the camera on the fighter (dist, dy)
export async function film(name, mv, o = {}) {
  const w = W(), O = w.fighters[1];
  begin(mv, o);
  P.strip(o.slot || 0, o.n || 12, o.every || 3, o.dist || 6, o.dy ?? 1.2, (i) => {
    if (o.hold && i * (o.every || 3) >= o.hold) window.__vpads[0].buttons = { ...(o.btnHeld ? { [o.btn]: true } : {}) };
    if (!o.hold && o.btn && !o.btnHeld && i === 1) window.__vpads[0].buttons = {};
    if (o.fn) o.fn(i, w);
  });
  release();
  const d = document.getElementById('__strip');
  const b = await (await fetch(d.src)).blob();
  await fetch('/__shot/' + name + '.png', { method: 'POST', body: b });
  return { dmg: +O.damage.toFixed(1), ox: +O.x.toFixed(2), oy: +O.y.toFixed(2), ostate: O.state, errs: errs() };
}

// the hitboxes in red at a given frame of each move: [move, hold, frame]
export async function sheet(name, list, o = {}) {
  const cv = __app.renderer.gl.domElement, scene = __app.renderer.scene;
  const Wd = cv.width, H = cv.height, cw = Math.round(H * 0.75), ch = Math.round(H * 0.8), cols = o.cols || 3;
  const out = document.createElement('canvas'); out.width = cw * cols; out.height = ch * Math.ceil(list.length / cols);
  const g = out.getContext('2d');
  g.font = 'bold 24px sans-serif'; g.textAlign = 'center';
  for (let i = 0; i < list.length; i++) {
    const [mv, hold, frame, label] = list[i];
    const F = begin(mv, { hold, y: o.y, opp: 9 });
    const M = CHARS[F.char].moves[mv];
    // to the frame asked (the charge holds the move at charge.at while A is held)
    let n = 0;
    while (F.state === 'move' && F.mf < frame && n++ < 400) { if (hold && n >= hold) window.__vpads[0].buttons = {}; P.stepN(1); }
    release();
    const Mx = fm.moveOf(F) || M;
    const balls = (Mx.hits || []).filter((h) => F.mf >= h.f[0] && F.mf <= h.f[1]).map((h) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(h.r, 20, 12), new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.32, depthWrite: false }));
      m.position.set(...localToWorld(F, h.at)); scene.add(m); return m;
    });
    P.close(o.slot || 0, o.dist || 5.4, o.dy ?? 1.0);
    const x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
    g.drawImage(cv, Wd / 2 - cw / 2, H * 0.08, cw, ch, x, y, cw, ch);
    balls.forEach((b) => scene.remove(b));
    g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(x, y + ch - 40, cw, 40);
    g.fillStyle = '#ffd23a'; g.fillText(`${label || mv} f${F.mf}`, x + cw / 2, y + ch - 12);
  }
  const blob = await new Promise((ok) => out.toBlob(ok, 'image/png'));
  await fetch('/__shot/' + name + '.png', { method: 'POST', body: blob });
  return errs();
}

// both fighters, frame by frame: [frame, attacker, victim]
export function trace(mv, o = {}) {
  const w = W(), F = begin(mv, o), O = w.fighters[1], rows = [];
  for (let i = 0; i < (o.n || 60); i++) {
    if (o.releaseAt !== undefined && i === o.releaseAt) release();
    if (o.fn) o.fn(i, w);
    P.stepN(1);
    if (i % (o.every || 3) === 0) rows.push(`${i} A(${F.x.toFixed(1)},${F.y.toFixed(1)},${F.move || F.state}${F.mv && F.move ? ':' + F.mf : ''}) V(${O.x.toFixed(1)},${O.y.toFixed(1)},${O.state},${O.damage.toFixed(1)}%)`);
  }
  release();
  return rows.join('\n') + (errs().length ? '\nERR ' + errs().join(' | ') : '');
}
