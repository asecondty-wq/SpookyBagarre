// Input devices: Xbox-style gamepads (standard mapping), two keyboard layouts and virtual pads (tests).
// Each device exposes a state sampled every frame:
//   mx, my     left stick, -1..1, my > 0 = up / away from the camera
//   held       bitmask of held buttons (BTN.*)
//   cnt[i]     press counters, one per button bit: a tap is never lost between two sim ticks, even online.
// Menus read edge events (with auto-repeat on directions) through menuEvents(device).

export const BTN = { A: 1, X: 2, JUMP: 4, SHIELD: 8, START: 16, GRAB: 32 };
export const BTN_BITS = [1, 2, 4, 8, 16, 32];
// not a button: set in the samples of a keyboard (its "stick" jumps from 0 to 1 at once, so no flick-to-run)
export const DIGITAL = 64;
// The pistol duel (src/sim/minigames.js) needs two sticks, one to move and one to aim: for the devices of its players
// (Input.setDuel), mx, my become the aim (the right stick of a pad, the mouse of Clavier 1, where MOUSE says that they
// are a movement, MOUSE_PX pixels = 1, not a tilt) and the left stick / ZQSD become the MV_* bits.
export const MOUSE = 128, MV_L = 256, MV_R = 512, MV_D = 1024;
const MOUSE_PX = 22;
const moveBits = (x, y) => (x < -0.4 ? MV_L : 0) | (x > 0.4 ? MV_R : 0) | (y < -0.5 ? MV_D : 0);

const DEADZONE = 0.2;

// tap jump (Smash): the stick flicked up jumps, like the jump button, held while the stick stays up (full jump);
// a slow push up does not (up tilts). Pads only: on a keyboard, up stays up.
function tapJump(dev, my, now) {
  // a flick: from under 0.3 to over 0.7 within 6 polls and 100 ms
  if (my < 0.3) { dev.upLowT = now; dev.upPolls = 0; } else dev.upPolls = (dev.upPolls || 0) + 1;
  if (Input.tapJump && !dev.upJump && my > 0.7 && dev.upPolls <= 6 && now - (dev.upLowT || 0) < 100) dev.upJump = true;
  if (dev.upJump && my < 0.5) dev.upJump = false;
  return dev.upJump ? BTN.JUMP : 0;
}

const KEY_LAYOUTS = {
  // physical keys (e.code): ZQSD on an AZERTY keyboard, WASD on a QWERTY one; the mouse buttons count as keys
  kb1: {
    name: 'Clavier 1',
    up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'],
    a: ['KeyJ', 'Mouse0'], x: ['KeyK', 'Mouse2'], jump: ['Space'], shield: ['ShiftLeft', 'KeyL'], grab: ['KeyE', 'KeyU'], start: ['Escape'],
    confirm: ['Enter', 'KeyJ', 'Space'], back: ['Backspace', 'Escape', 'KeyK'],
  },
  kb2: {
    name: 'Clavier 2',
    up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
    a: ['Numpad1', 'Comma'], x: ['Numpad2', 'Period'], jump: ['Numpad0', 'ShiftRight'], shield: ['Numpad3', 'Slash'],
    grab: ['Numpad4'], start: ['NumpadEnter'],
    confirm: ['NumpadEnter', 'Numpad1', 'Comma'], back: ['Numpad2', 'Period', 'NumpadDecimal'],
  },
};

const keysDown = new Set();
const keyPressQueue = []; // codes pressed since the last poll (so a tap between two frames still counts)

function onKey(e, down) {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  const code = e.code;
  if (down) {
    if (!keysDown.has(code)) keyPressQueue.push(code);
    keysDown.add(code);
    if (code === 'Space' || code.startsWith('Arrow') || code === 'Tab') e.preventDefault();
  } else {
    keysDown.delete(code);
  }
}
window.addEventListener('keydown', (e) => {
  // Ctrl is the walk key: Ctrl + a game key must not save the page (S), bookmark it (D)... (Ctrl+W, Ctrl+T, Ctrl+N
  // cannot be stopped by a page: on a QWERTY keyboard, mind Ctrl+W)
  if (e.ctrlKey && KB1_KEYS.has(e.code)) e.preventDefault();
  onKey(e, true);
});
window.addEventListener('keyup', (e) => onKey(e, false));
window.addEventListener('blur', () => keysDown.clear());
// the mouse buttons of the keyboard player: left = A, right = X (not on the menus' buttons and fields)
const uiTarget = (e) => e.target && e.target.closest && e.target.closest('button, a, input, textarea, select, .px *');
// mouse aim (pistol duel): the movements add up until the next sample; a click locks the pointer in the game
const mouseAcc = { x: 0, y: 0 };
const mouseAim = () => Input.duel.has('kb1');
window.addEventListener('mousemove', (e) => { if (mouseAim()) { mouseAcc.x += e.movementX || 0; mouseAcc.y += e.movementY || 0; } });
window.addEventListener('mousedown', (e) => {
  if (mouseAim() && e.button === 0 && !document.pointerLockElement && document.body.requestPointerLock) { try { const p = document.body.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (err) { /* refused */ } }
});
window.addEventListener('mousedown', (e) => { if (e.button === 0 || e.button === 2) { if (uiTarget(e) && e.button === 0) return; onKey({ code: 'Mouse' + e.button, target: e.target, preventDefault() {} }, true); } });
window.addEventListener('mouseup', (e) => { if (e.button === 0 || e.button === 2) keysDown.delete('Mouse' + e.button); });
window.addEventListener('contextmenu', (e) => { if (!(e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA'))) e.preventDefault(); });

const KB1_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyJ', 'KeyK', 'KeyL', 'KeyU', 'KeyI', 'Space']);

function makeDevice(id, type, name) {
  return {
    id, type, name,
    mx: 0, my: 0, rx: 0, ry: 0,
    held: 0, prevHeld: 0,
    cnt: [0, 0, 0, 0, 0, 0],
    lastActive: 0,
    connected: true,
    // menu
    menu: { up: 0, down: 0, left: 0, right: 0, confirm: 0, back: 0, start: 0, x: 0, y: 0 },
    menuHeld: { dir: '', since: 0, last: 0 },
    prevMenuBtn: { confirm: false, back: false, start: false, x: false, y: false },
    rumble: null,
  };
}

const devices = new Map();
for (const id of Object.keys(KEY_LAYOUTS)) devices.set(id, makeDevice(id, 'keyboard', KEY_LAYOUTS[id].name));

// Virtual pads for automated tests: window.__vpads[i] = { axes:[lx,ly], buttons:{a,x,jump,shield,grab,start,b,y,up,down,left,right} }
window.__vpads = window.__vpads || [];

function radial(x, y) {
  const m = Math.hypot(x, y);
  if (m < DEADZONE) return [0, 0];
  const k = Math.min(1, (m - DEADZONE) / (1 - DEADZONE)) / m;
  return [x * k, y * k];
}

function applyButtons(dev, held, now) {
  for (let i = 0; i < BTN_BITS.length; i++) {
    const b = BTN_BITS[i];
    if ((held & b) && !(dev.prevHeld & b)) dev.cnt[i]++;
  }
  if (held !== dev.prevHeld || dev.mx !== 0 || dev.my !== 0) dev.lastActive = now;
  dev.prevHeld = dev.held = held;
}

function updateMenu(dev, dirs, btns, now) {
  const m = dev.menu;
  for (const k of Object.keys(m)) m[k] = 0;
  // directions with auto repeat
  let dir = '';
  if (dirs.up) dir = 'up'; else if (dirs.down) dir = 'down'; else if (dirs.left) dir = 'left'; else if (dirs.right) dir = 'right';
  const h = dev.menuHeld;
  if (dir && dir !== h.dir) { m[dir] = 1; h.dir = dir; h.since = now; h.last = now; }
  else if (dir && now - h.since > 380 && now - h.last > 110) { m[dir] = 1; h.last = now; }
  else if (!dir) h.dir = '';
  for (const k of ['confirm', 'back', 'start', 'x', 'y']) {
    if (btns[k] && !dev.prevMenuBtn[k]) m[k] = 1;
    dev.prevMenuBtn[k] = !!btns[k];
  }
}

function pollKeyboard(dev, now, pressed) {
  const L = KEY_LAYOUTS[dev.id];
  const any = (list) => list.some((c) => keysDown.has(c));
  const tapped = (list) => list.some((c) => pressed.has(c));
  let x = (any(L.right) ? 1 : 0) - (any(L.left) ? 1 : 0);
  let y = (any(L.up) ? 1 : 0) - (any(L.down) ? 1 : 0);
  if (x && y) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
  // walk: hold Ctrl (layout 1), the stick at half (without it the keyboard runs at once, see fighter.js)
  if (dev.id === 'kb1' && (keysDown.has('ControlLeft') || keysDown.has('ControlRight'))) { x *= 0.6; y *= 0.6; }
  dev.mx = x; dev.my = y;
  let held = 0;
  if (any(L.a) || tapped(L.a)) held |= BTN.A;
  if (any(L.x) || tapped(L.x)) held |= BTN.X;
  if (any(L.jump) || tapped(L.jump)) held |= BTN.JUMP;
  if (any(L.shield) || tapped(L.shield)) held |= BTN.SHIELD;
  if (any(L.grab) || tapped(L.grab)) held |= BTN.GRAB;
  if (any(L.start) || tapped(L.start)) held |= BTN.START;
  // (a key pressed and released between two polls is in `pressed`, so it still counts as one press)
  applyButtons(dev, held, now);
  if (x || y || held) dev.lastActive = now;
  updateMenu(dev, { up: any(L.up), down: any(L.down), left: any(L.left), right: any(L.right) },
    { confirm: any(L.confirm) || tapped(L.confirm), back: any(L.back) || tapped(L.back), start: any(L.start) || tapped(L.start),
      x: dev.id === 'kb1' ? keysDown.has('KeyL') : keysDown.has('Numpad3'), y: dev.id === 'kb1' ? keysDown.has('KeyI') : keysDown.has('Numpad5') }, now);
}

function pollPad(dev, gp, now) {
  const B = (i) => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.35));
  const [lx, ly] = radial(gp.axes[0] || 0, gp.axes[1] || 0);
  let mx = lx, my = -ly;
  // D-pad also moves (full tilt)
  const dx = (B(15) ? 1 : 0) - (B(14) ? 1 : 0), dy = (B(12) ? 1 : 0) - (B(13) ? 1 : 0);
  if (dx || dy) { const k = (dx && dy) ? Math.SQRT1_2 : 1; mx = dx * k; my = dy * k; }
  dev.mx = mx; dev.my = my;
  const [rx, ry] = radial(gp.axes[2] || 0, gp.axes[3] || 0);
  dev.rx = rx; dev.ry = -ry;
  let held = 0;
  if (B(0)) held |= BTN.A;
  if (B(2)) held |= BTN.X;
  if (B(1) || B(3)) held |= BTN.JUMP;
  if (B(6) || B(7)) held |= BTN.SHIELD;
  if (B(4) || B(5)) held |= BTN.GRAB;
  if (B(9)) held |= BTN.START;
  const duel = Input.duel.has(dev.id);
  if (!duel) held |= tapJump(dev, my, now);
  // right stick, Smash's C-stick: a push is A + that direction for a few frames (a smash on the ground, the matching
  // aerial in the air); held, the smash charges. The menus keep reading the left stick only.
  const menuDirs = { up: B(12) || my > 0.6, down: B(13) || my < -0.6, left: B(14) || mx < -0.6, right: B(15) || mx > 0.6 };
  if (Math.hypot(rx, ry) > 0.6 && !duel) {
    if (!dev.cOn) {
      dev.cOn = true; dev.cT = now;
      const horiz = Math.abs(rx) >= Math.abs(-ry);
      dev.cDir = horiz ? [Math.sign(rx), 0] : [0, Math.sign(-ry)];
    }
    held |= BTN.A;
    if (now - dev.cT < 70) { dev.mx = dev.cDir[0]; dev.my = dev.cDir[1]; }
  } else dev.cOn = false;
  applyButtons(dev, held, now);
  updateMenu(dev, menuDirs, { confirm: B(0), back: B(1), start: B(9), x: B(2), y: B(3) }, now);
  dev.gp = gp;
}

function pollVirtual(dev, vp, now) {
  const b = vp.buttons || {};
  const ax = vp.axes || [0, 0];
  dev.mx = ax[0] || 0; dev.my = ax[1] || 0;
  dev.aim = vp.aim || null; // pistol duel: the aim (axes is then the move)
  let held = 0;
  if (b.a) held |= BTN.A;
  if (b.x) held |= BTN.X;
  if (b.jump) held |= BTN.JUMP;
  if (b.shield) held |= BTN.SHIELD;
  if (b.grab) held |= BTN.GRAB;
  if (b.start) held |= BTN.START;
  held |= tapJump(dev, dev.my, now);
  applyButtons(dev, held, now);
  updateMenu(dev, { up: b.up || dev.my > 0.6, down: b.down || dev.my < -0.6, left: b.left || dev.mx < -0.6, right: b.right || dev.mx > 0.6 },
    { confirm: b.a || b.confirm, back: b.b || b.back, start: b.start, x: b.x, y: b.y }, now);
}

export const Input = {
  devices,
  tapJump: true, // option « Saut avec le stick » (main.js applies the setting)
  duel: new Set(), // the devices playing the pistol duel (set by its view): two-stick samples, see MOUSE
  setDuel(ids) {
    const key = [...ids].sort().join(',');
    if (key === [...this.duel].sort().join(',')) return;
    this.duel = new Set(ids);
    mouseAcc.x = mouseAcc.y = 0;
    if (!this.duel.has('kb1') && document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
  },
  poll() {
    const now = performance.now();
    const pressed = new Set(keyPressQueue);
    keyPressQueue.length = 0;
    for (const id of Object.keys(KEY_LAYOUTS)) pollKeyboard(devices.get(id), now, pressed);
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const seen = new Set();
    for (let i = 0; i < pads.length; i++) {
      const gp = pads[i];
      if (!gp || !gp.connected) continue;
      const id = 'pad' + gp.index;
      seen.add(id);
      if (!devices.has(id)) devices.set(id, makeDevice(id, 'gamepad', 'Manette ' + (gp.index + 1)));
      const dev = devices.get(id);
      dev.connected = true;
      pollPad(dev, gp, now);
    }
    for (const [id, dev] of devices) if (dev.type === 'gamepad' && !seen.has(id)) dev.connected = false;
    const vps = window.__vpads;
    for (let i = 0; i < vps.length; i++) {
      if (!vps[i]) continue;
      const id = 'vpad' + i;
      if (!devices.has(id)) devices.set(id, makeDevice(id, 'virtual', 'Virtuelle ' + (i + 1)));
      pollVirtual(devices.get(id), vps[i], now);
    }
  },
  get(id) { return devices.get(id); },
  list() { return [...devices.values()].filter((d) => d.connected); },
  // snapshot used by the simulation (and sent online)
  sample(id) {
    const d = devices.get(id);
    if (!d || !d.connected) return { mx: 0, my: 0, held: 0, cnt: [0, 0, 0, 0, 0, 0] };
    if (this.duel.has(id)) {
      const r3 = (v) => Math.round(v * 1000) / 1000;
      const bits = moveBits(d.mx, d.my);
      if (id === 'kb1') {
        // the mouse movement since the last sample (at most MOUSE_PX pixels a sample, the rest carries over)
        const mx = r3(Math.max(-1, Math.min(1, mouseAcc.x / MOUSE_PX))), my = r3(Math.max(-1, Math.min(1, -mouseAcc.y / MOUSE_PX)));
        mouseAcc.x -= mx * MOUSE_PX; mouseAcc.y += my * MOUSE_PX;
        return { mx, my, held: d.held | DIGITAL | MOUSE | bits, cnt: d.cnt.slice() };
      }
      if (d.type === 'gamepad') return { mx: r3(d.rx), my: r3(d.ry), held: d.held | bits, cnt: d.cnt.slice() };
      if (d.aim) return { mx: r3(d.aim[0] || 0), my: r3(d.aim[1] || 0), held: d.held | bits, cnt: d.cnt.slice() };
      // Clavier 2: the arrows aim, no move
    }
    return { mx: Math.round(d.mx * 1000) / 1000, my: Math.round(d.my * 1000) / 1000, held: d.held | (d.type === 'keyboard' ? DIGITAL : 0), cnt: d.cnt.slice() };
  },
  menuEvents(id) { const d = devices.get(id); return d ? d.menu : null; },
  anyMenu(key) {
    for (const d of devices.values()) if (d.connected && d.menu[key]) return d;
    return null;
  },
  rumble(id, strong, weak, ms) {
    const d = devices.get(id);
    if (!d || d.type !== 'gamepad' || !d.gp) return;
    const act = d.gp.vibrationActuator;
    if (act && act.playEffect) {
      act.playEffect('dual-rumble', { startDelay: 0, duration: ms, weakMagnitude: Math.min(1, weak), strongMagnitude: Math.min(1, strong) }).catch(() => {});
    }
  },
  keyboardLayouts: KEY_LAYOUTS,
};

// Convert two consecutive samples into the per-tick input the simulation consumes.
export function toTickInput(sample, prevCnt) {
  let pressed = 0;
  for (let i = 0; i < BTN_BITS.length; i++) {
    if (prevCnt && sample.cnt[i] !== prevCnt[i]) pressed |= BTN_BITS[i];
  }
  return { mx: sample.mx, my: sample.my, held: sample.held, pressed };
}
