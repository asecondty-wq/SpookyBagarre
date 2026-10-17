// The run, jumps, flips, crouch, slip and landing of a character (Mixamo clips: JUMPS in src/render/rig/nativeMoves.js),
// filmed frame by frame in a quick match, the camera close on it; the sheet goes to tools/dev/shots/<name>.png.
//   open  ?quick=1&chars=<id>,aboueb&humans=1&dev=vpad0&bot=0&hazards=0&stage=cemetery&mute=1&mg=0
//   then  const J = await import('/tools/dev/jumpcheck.js'); await J.ready();
//         await J.film('flip')   // 'jump', 'flip' (forward, then a twist in the air), 'back', 'crouch', 'trip', 'land', 'down', 'run', 'ledge', 'roll', 'dizzy', 'float'
import * as P from './posecheck.js';

export async function ready() {
  await P.ready();
  __app.renderer.kick = () => {};
  Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: 720, configurable: true });
  __app.renderer.resize();
}

const pad = (ax, btn) => { window.__vpads[0] = { axes: ax, buttons: btn }; };
const PLANS = {
  jump: { n: 18, plan: (f) => pad([0, 0], { jump: f < 8 }) },
  run: { n: 12, every: 2, plan: () => pad([1, 0], {}), setup: (F) => { F.x = -9; } },
  // falling by the right end of the main platform (the cemetery's: radius 13), facing it: it catches the ledge
  ledge: { n: 18, every: 4, plan: () => pad([0, 0], {}), setup: (F) => { F.x = 13.6; F.y = -0.6; F.grounded = false; F.state = 'air'; F.vy = -1; F.vx = 0; F.facing = -Math.PI / 2; } },
  // shield, then a flick of the stick: a roll
  roll: { n: 12, every: 3, plan: (f) => pad([f >= 8 && f < 14 ? 1 : 0, 0], { shield: f < 14 }) },
  dizzy: { n: 12, every: 6, plan: (f, F, fm) => { pad([0, 0], {}); if (f === 3) fm.stunFor(F, 160); } },
  // levitating (ANBUU's Confusion)
  float: { n: 12, every: 3, plan: (f, F, fm) => { pad([0, 0], {}); if (f === 3) { fm.stunFor(F, 42); F.levT = 42; F.grounded = false; F.vy = 3; F.y += 0.05; } } },
  flip: { n: 18, plan: (f) => pad([1, 0], { jump: (f >= 12 && f < 16) || (f >= 33 && f < 37) }) },
  back: { n: 18, plan: (f) => pad([f < 13 ? 0 : -1, 0], { jump: f >= 12 && f < 16 }) },
  crouch: { n: 12, plan: (f) => pad([0, f >= 6 && f < 30 ? -1 : 0], {}) },
  trip: { n: 18, every: 4, plan: (f, F, fm) => { pad([0, 0], {}); if (f === 6) fm.stunFor(F, 120, { lie: true }); } },
  land: { n: 12, plan: () => pad([0, 0], {}), setup: (F) => { F.y = 4; F.grounded = false; F.state = 'air'; F.vy = 0; } },
  // launched, it hits the floor without a tech: on its back, then up
  down: { n: 18, every: 4, plan: () => pad([0, 0], {}), setup: (F) => { F.y = 2.5; F.grounded = false; F.state = 'hitstun'; F.hitstun = 40; F.launchKb = 120; F.vy = -14; F.kx = 0; F.ky = 0; } },
};

export async function film(what, name = 'jump_' + what, dist = 6.5) {
  const fm = await import('/src/sim/fighter.js');
  const S = PLANS[what], n = S.n, every = S.every || 3;
  const w = P.W(), F = w.fighters[0], O = w.fighters[1];
  O.x = 11; F.x = -2; F.y = 0; F.vx = 0; F.vy = 0; F.state = 'idle'; F.facing = Math.PI / 2; F.grounded = true; F.damage = 0; F.stun = 0; F.lie = 0;
  pad([0, 0], {}); P.stepN(30);
  if (S.setup) S.setup(F);
  const cv = __app.renderer.gl.domElement, cw = 300, ch = 360;
  const o = document.createElement('canvas'); o.width = cw * Math.min(n, 6); o.height = ch * Math.ceil(n / 6);
  const g = o.getContext('2d');
  const cam = __app.renderer.camera;
  let f = 0;
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < every; k++) { S.plan(f, F, fm); P.stepN(1); f++; }
    const p = __app.match.view.views[0].root.position;
    cam.position.set(p.x + 0.2, p.y + 1.6, dist); cam.lookAt(p.x, p.y + 1.0, 0); cam.updateMatrixWorld();
    __app.renderer.render();
    g.drawImage(cv, 640 - cw * 0.6, 360 - ch * 0.744, cw * 1.2, ch * 1.2, (i % 6) * cw, Math.floor(i / 6) * ch, cw, ch);
    g.fillStyle = '#ff0'; g.font = '14px monospace'; g.fillText(F.state + ' ' + f, (i % 6) * cw + 4, Math.floor(i / 6) * ch + 16);
  }
  pad([0, 0], {});
  const b = await new Promise((r) => o.toBlob(r, 'image/png'));
  await fetch('/__shot/' + name + '.png', { method: 'POST', body: b });
  return name;
}
