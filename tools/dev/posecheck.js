// Browser console helper to look at one move frame by frame (props, poses) in a quick match:
//   open  ?quick=1&chars=<a>,<b>&humans=1&dev=vpad0&bot=0&hazards=0&stage=cemetery
//   then  const P = await import('/tools/dev/posecheck.js'); await P.ready();
//         P.go(slot, 'smash', frames, dist, dy, holdFrames)   // runs the move, then frames a close-up camera on it
// The real-time loop is frozen while it is loaded; P.step(n) advances n frames.
export async function ready() {
  await new Promise((r) => { const i = setInterval(() => { if (window.__app && __app.match && __app.match.W) { clearInterval(i); r(); } }, 200); });
  window.__vpads[0] = { axes: [0, 0], buttons: {} };
  const fm = await import('/src/sim/fighter.js');
  const s = __app.screen, upd = s.update;
  let run = false;
  s.update = (dt) => (run ? upd.call(s, dt) : null);
  step = (n) => { run = true; __app.advance(n / 60, 60, 1); run = false; };
  start = (F, W, mv) => fm.startMove(F, W, mv);
  moveOf = fm.moveOf;
  // skip the 3-2-1
  for (let k = 0; k < 400 && __app.match.W.phase === 'intro'; k++) step(1);
}
let step = () => {}, start = () => {}, moveOf = () => null;
export const W = () => __app.match.W;
export function stepN(n) { step(n); }
export { step as _step };
export function close(slot, dist = 5, dy = 1.0) {
  const F = W().fighters[slot];
  const cam = __app.renderer.camera;
  cam.position.set(F.x + 1.2, F.y + dy + 0.4, dist);
  cam.lookAt(F.x, F.y + dy, 0);
  cam.updateMatrixWorld();
  __app.renderer.render();
}
export function go(slot, mv, frames, dist = 5, dy = 1.0, hold = 0) {
  const w = W(), F = w.fighters[slot];
  for (const O of w.fighters) if (O !== F) O.x = F.x < 0 ? 9 : -9;
  F.x = 0; F.y = 0; F.vx = F.vy = 0; F.state = 'idle';
  window.__vpads[0].buttons = {};
  step(25);
  window.__vpads[0].buttons = { a: !!hold };
  start(F, w, mv);
  const M = moveOf(F), tilt = M && M.tilt;
  if (hold && tilt) delete M.tilt; // keep the charged version
  step(hold || frames);
  if (tilt) M.tilt = tilt;
  window.__vpads[0].buttons = {};
  if (hold) step(frames);
  close(slot, dist, dy);
  return [F.move, F.mf, JSON.stringify(F.va)];
}

// a sheet of n frames (every `every` sim frames, `fn(i)` before each one) shown over the game, for screenshots
export function strip(slot, n, every, dist = 5, dy = 1.0, fn) {
  const cv = __app.renderer.gl.domElement;
  // a hidden browser pane shrinks the page to 300x150: render the sheet at a fixed 1280x720
  if (cv.height < 300 || window.innerHeight < 300) {
    Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 720, configurable: true });
    __app.renderer.resize(); __app.renderer.render();
  }
  const W = cv.width, H = cv.height;
  const cw = Math.round(H * 0.55), ch = Math.round(H * 0.9);
  const o = document.createElement('canvas'); o.width = cw * Math.min(n, 6); o.height = ch * Math.ceil(n / 6);
  const g = o.getContext('2d');
  for (let i = 0; i < n; i++) {
    if (fn) fn(i);
    step(every); close(slot, dist, dy);
    g.drawImage(cv, W / 2 - cw / 2 - W * 0.06, H * 0.05, cw, ch, (i % 6) * cw, Math.floor(i / 6) * ch, cw, ch);
  }
  let d = document.getElementById('__strip');
  if (!d) { d = document.createElement('img'); d.id = '__strip'; d.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;object-fit:contain;z-index:9999;background:#222'; document.body.appendChild(d); }
  d.src = o.toDataURL(); d.style.display = 'block';
}
export function unstrip() { const d = document.getElementById('__strip'); if (d) d.style.display = 'none'; }

// every character's recovery from (edge + dx, dy) with no jump left, stick toward the stage:
// returns how high / far it went and whether it made it (ledge / land) or died
export function recTest(dx, dy, ids, dj = false) {
  ids = ids || ['frog', 'micron', 'bubba', 'parmesan', 'pika', 'tung', 'shark', 'catlady', 'pandrezz', 'aboueb', 'tices', 'omfu', 'lolobiscotto', 'jsan', 'nymano', 'bido'];
  const w = W(), F = w.fighters[0], O = w.fighters[1], R = w.stage.main().r, res = {};
  for (const id of ids) {
    F.char = id; O.x = -6;
    F.x = R + dx; F.y = dy; F.vx = F.vy = 0; F.grounded = false; F.state = 'air'; F.move = null; F.jumps = 0; F.damage = 0;
    F.hitlag = F.hitstun = 0; F.cd = { n: 0, s: 0, d: 0 }; F.facing = -Math.PI / 2; F.out = false; F.stocks = 3; F.ledgeCD = 0; F.size = 1;
    window.__vpads[0] = { axes: [-1, 1], buttons: {} }; step(1);
    F.x = R + dx; F.y = dy; F.vx = F.vy = 0;
    if (dj) { F.jumps = 1; window.__vpads[0] = { axes: [-1, 0], buttons: { jump: true } }; step(2); window.__vpads[0] = { axes: [-1, 0], buttons: {} }; step(22); }
    window.__vpads[0] = { axes: [-1, 1], buttons: { x: true } }; step(2);
    window.__vpads[0] = { axes: [-1, 0.6], buttons: { x: true } };
    let maxY = -99, minX = 99, ok = '';
    for (let i = 0; i < 220; i++) {
      // X tapped again twice (the multi-stage recoveries), held the rest of the time (the gliders)
      window.__vpads[0].buttons = { x: !(i === 18 || i === 19 || i === 30 || i === 31) };
      step(1); maxY = Math.max(maxY, F.y); minX = Math.min(minX, F.x);
      if (F.state === 'ledge') { ok = 'ledge@' + i; break; }
      if (F.grounded) { ok = 'land@' + i; break; }
      if (F.state === 'dead' || F.out || F.y < -17) { ok = 'DEAD'; break; }
    }
    res[id] = `rise ${(maxY - dy).toFixed(1)} reachX ${(R + dx - minX).toFixed(1)} ${ok || 'fail'}`;
  }
  window.__vpads[0] = { axes: [0, 0], buttons: {} };
  return res;
}
