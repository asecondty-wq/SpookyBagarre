// The menus' world (art direction "Crypte"): a graveyard at night where the friends hang out.
// Laid out on a virtual 640x360 screen (the menus use the same grid), drawn at the window's real resolution with
// the high definition art (tools/art/ui_hd.py: assets/ui/crypt/hd/, 3 times the grid), smooth.
//
// Layers, back to front: background plate, back fog, the eight characters (two rows), front fog, foreground frame,
// particles (dust, smoke, tears, hearts, sparks, slime drips), bats. The layers drift a little with the cursor
// (parallax) and the whole scene can shake.
export const VW = 640, VH = 360;
const DIR = 'assets/ui/crypt/hd/';
const HD = 3; // the art is drawn at 3 times its size on the grid

// who stands where (feet position on the 640x360 screen); the right side looks to the left (mirrored).
// back: on the path behind the foreground frame; the others are in front of it. small: the smaller sprite (*_b),
// for the back row and for the two perched on the scenery (Tices on the crypt ledge, Nymano sulking on the tombstone).
const CAST = [
  { id: 'bido', x: 200, y: 314, back: true, small: true },
  { id: 'omfu', x: 442, y: 314, back: true, small: true, flip: true },
  { id: 'tices', x: 118, y: 171, small: true },
  { id: 'nymano', x: 611, y: 117, small: true, flip: true },
  { id: 'pandrezz', x: 58, y: 359 },
  { id: 'aboueb', x: 150, y: 360 },
  { id: 'jsan', x: 492, y: 360, flip: true },
  { id: 'lolobiscotto', x: 586, y: 359, flip: true },
].map((c) => ({ ...c, sprite: c.small ? c.id + '_b' : c.id }));

// small gags, one at a time: where on the sprite (fractions of its box, before mirroring) and what comes out
const GAGS = {
  jsan: { at: [0.78, 0.12], kind: 'smoke' },
  nymano: { at: [0.42, 0.2], kind: 'tears' },
  bido: { at: [0.6, 0.15], kind: 'hearts' },
  pandrezz: { at: [0.62, 0.5], kind: 'sparks' },
  omfu: { at: [0.15, 0.2], kind: 'tonk' },
  aboueb: { at: [0.82, 0.08], kind: 'ball' },
  tices: { at: [0.62, 0.22], kind: 'fire' },
  lolobiscotto: { at: [0.5, 0.18], kind: 'meow' },
};

// the same gags on the fresco (assets/ui/crypt/fresco.png, the friends painted in): screen points, side they face
const FRESCO_GAGS = {
  pandrezz: { x: 62, y: 290, kind: 'sparks', side: 1 },
  aboueb: { x: 176, y: 246, kind: 'ball', side: 1 },
  bido: { x: 197, y: 218, kind: 'hearts', side: 1 },
  tices: { x: 120, y: 95, kind: 'fire', side: 1 },
  jsan: { x: 494, y: 264, kind: 'smoke', side: -1 },
  omfu: { x: 462, y: 226, kind: 'tonk', side: -1 },
  nymano: { x: 614, y: 46, kind: 'tears', side: -1 },
  lolobiscotto: { x: 592, y: 330, kind: 'meow', side: -1 },
};

function load(src) {
  return new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
}

// a bat (wings up or down) and a heart, drawn as shapes (sizes in grid pixels)
function drawBat(g, x, y, up) {
  g.fillStyle = '#0c0814';
  g.beginPath();
  const w = up ? -3.2 : 2.2;
  g.moveTo(x, y);
  g.quadraticCurveTo(x - 2.5, y + w, x - 5.5, y + w * 0.6);
  g.quadraticCurveTo(x - 3.5, y + 0.6, x - 1.2, y + 1.6);
  g.lineTo(x, y + 2.4);
  g.lineTo(x + 1.2, y + 1.6);
  g.quadraticCurveTo(x + 3.5, y + 0.6, x + 5.5, y + w * 0.6);
  g.quadraticCurveTo(x + 2.5, y + w, x, y);
  g.fill();
  g.beginPath(); g.arc(x, y + 0.9, 1.3, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#e8202a'; g.beginPath(); g.arc(x + 0.5, y + 0.7, 0.35, 0, Math.PI * 2); g.fill();
}
function drawHeart(g, x, y, s = 3.4) {
  g.fillStyle = '#ff78c8';
  g.beginPath();
  g.moveTo(x, y + s * 0.9);
  g.bezierCurveTo(x - s * 1.2, y + s * 0.1, x - s * 0.7, y - s * 0.8, x, y - s * 0.25);
  g.bezierCurveTo(x + s * 0.7, y - s * 0.8, x + s * 1.2, y + s * 0.1, x, y + s * 0.9);
  g.fill();
}
// the size of a piece on the grid (the HD art is HD times larger); the smaller copies of the back row: 0.8
const lw = (im, c) => (im.width / HD) * (c && c.small ? 0.8 : 1);
const lh = (im, c) => (im.height / HD) * (c && c.small ? 0.8 : 1);
// the two candle stands painted on the fresco (x0 y0 x1 y1 on its grid): the only places with a flame light; the
// other warm bright pixels of the painting are skin, shirts and slime, and must stay still
const CANDLE_ZONES = [[92, 168, 154, 252], [528, 170, 586, 252]];

export class Crypt {
  constructor(parent) {
    this.cv = document.createElement('canvas');
    this.cv.width = VW; this.cv.height = VH;
    this.cv.className = 'crypt';
    parent.prepend(this.cv);
    this.g = this.cv.getContext('2d');
    this.S = 1;
    this.t = 0;
    this.on = false;
    this.parts = [];
    this.bats = [];
    this.shakeT = 0; this.shakeA = 0;
    this.look = { x: 0, y: 0, tx: 0, ty: 0 };
    this.cast = CAST.map((c, i) => ({ ...c, rise: 1, delay: 0, phase: i * 0.7, hop: 0 }));
    this.gagT = 3;
    this.dim = 0; this.dimTo = 0;
    this.ready = this.loadAll();
    this.onMove = (e) => {
      const r = this.cv.getBoundingClientRect();
      // hidden during a match (no size): a mouse moved then must not divide by zero (NaN stuck in the parallax)
      if (!(r.width > 0 && r.height > 0)) return;
      this.look.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      this.look.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
    };
    window.addEventListener('pointermove', this.onMove);
    this.fit = () => this.resize();
    window.addEventListener('resize', this.fit);
    this.resize();
  }

  async loadAll() {
    // the fresco (one painting, the friends painted in); the separate layers and sprites only if it is missing
    const fresco = await load(DIR + 'fresco.jpg');
    const names = fresco ? [] : ['bg', 'fg', ...new Set(CAST.map((c) => c.id))];
    const ims = await Promise.all(names.map((n) => load(DIR + n + (n === 'bg' ? '.jpg' : '.png'))));
    this.img = { fresco, ...Object.fromEntries(names.map((n, i) => [n, ims[i]])) };
    this.moon = this.img.fresco ? { x: 508, y: 6, r: 68 } : { x: 515, y: 30, r: 70 }; // the full moon (screen pixels)
    // candle flames: the warm bright pixels of the foreground, to make them flicker
    this.flames = [];
    const fg = this.img.fresco || this.img.fg; // the warm pixels of the painting with the candles
    if (fg) {
      // found on the painting brought down to the grid (grid coordinates)
      const c = document.createElement('canvas'); c.width = Math.round(lw(fg)); c.height = Math.round(lh(fg));
      const g = c.getContext('2d'); g.drawImage(fg, 0, 0, c.width, c.height);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4, r = d[i], gg = d[i + 1], b = d[i + 2];
        const inZone = !this.img.fresco || CANDLE_ZONES.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
        if (inZone && d[i + 3] > 0 && r > 230 && gg > 150 && b < 150) this.flames.push([x, y]);
      }
      // a glow per flame cluster (coarse grid)
      const cells = new Map();
      for (const [x, y] of this.flames) { const k = ((x / 10) | 0) + ',' + ((y / 10) | 0); const e = cells.get(k) || { x: 0, y: 0, n: 0 }; e.x += x; e.y += y; e.n++; cells.set(k, e); }
      this.glows = [...cells.values()].filter((e) => e.n >= 3).map((e, i) => ({ x: e.x / e.n, y: e.y / e.n, n: e.n, ph: i * 2.39 }));
    }
    return this;
  }

  // the canvas covers the window (the scene can be cut at the edges); the menus sit on the same grid (contain)
  resize() {
    const k = Math.max(innerWidth / VW, innerHeight / VH);
    // drawn at the screen's own pixels (capped: a 4K screen does not need more than the art has)
    this.S = Math.min(HD, k * (window.devicePixelRatio || 1));
    this.cv.width = Math.round(VW * this.S); this.cv.height = Math.round(VH * this.S);
    this.cv.style.width = Math.ceil(VW * k) + 'px';
    this.cv.style.height = Math.ceil(VH * k) + 'px';
    this.cv.style.left = Math.round((innerWidth - VW * k) / 2) + 'px';
    this.cv.style.top = Math.round((innerHeight - VH * k) / 2) + 'px';
    this.k = k;
  }

  show(on) { this.on = on; this.cv.style.display = on ? 'block' : 'none'; }

  // lightning: the scene flashes white twice, thunder (with the fresco: the arrival on the main menu)
  reveal() { this.bolt = 0.5; this.shake(4, 0.4); this.burst(10, 120); }

  // the friends burst out of the ground, one after the other
  rise(stagger = 0.09) {
    if (this.img && this.img.fresco) { this.reveal(); return; }
    const order = [4, 6, 5, 7, 0, 1, 2, 3]; // the front row first, the perched ones last
    order.forEach((ci, n) => { const c = this.cast[ci]; c.rise = 0; c.delay = n * stagger; c.dusted = false; });
  }
  sink() { for (const c of this.cast) { c.rise = 1; c.sinking = true; } }

  shake(a = 3, t = 0.25) { this.shakeA = Math.max(this.shakeA, a); this.shakeT = Math.max(this.shakeT, t); }
  setDim(v) { this.dimTo = v; }

  // ---- particles ---------------------------------------------------------------------------------------------
  puff(x, y, n, color, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = (o.dir ?? -Math.PI / 2) + (Math.random() - 0.5) * (o.spread ?? 2.4);
      const v = (o.speed ?? 40) * (0.4 + Math.random() * 0.8);
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: o.g ?? 60, life: (o.life ?? 0.6) * (0.6 + Math.random() * 0.6), t: 0, c: Array.isArray(color) ? color[(Math.random() * color.length) | 0] : color, s: o.size ?? 1, grow: o.grow || 0, drag: o.drag ?? 0, kind: o.kind });
    }
  }

  gag(c) {
    const im = this.img[c.id];
    const G = GAGS[c.id];
    if (!im || !G) return;
    const w = lw(im, c), h = lh(im, c);
    const fx = c.flip ? 1 - G.at[0] : G.at[0];
    this.burstGag(Math.round(c.x - w / 2 + fx * w), Math.round(c.y - h + G.at[1] * h), G.kind, c.flip ? -1 : 1, c);
  }

  burstGag(x, y, kind, side, c = {}) {
    switch (kind) {
      case 'smoke': this.puff(x, y, 14, ['#f2e8d0', '#c8bad8', '#ffffff'], { dir: -Math.PI / 2 + side * 0.5, spread: 0.9, speed: 22, g: -8, life: 1.6, size: 2, grow: 2.2, drag: 1.2 }); break;
      case 'tears': for (let i = 0; i < 6; i++) setTimeout(() => this.puff(x + (i % 2 ? 4 : -4), y, 1, '#5ab0ff', { dir: Math.PI / 2, spread: 0.3, speed: 10, g: 160, life: 0.9 }), i * 130); break;
      case 'hearts': for (let i = 0; i < 3; i++) this.parts.push({ x: x + (Math.random() - 0.5) * 16, y, vx: (Math.random() - 0.5) * 8, vy: -16 - Math.random() * 10, g: 0, life: 1.6, t: 0, sprite: 'heart', wob: Math.random() * 6 }); break;
      case 'sparks': this.puff(x, y, 16, ['#ffffff', '#5ab0ff', '#2864dc'], { speed: 60, spread: 6.3, g: 0, life: 0.35, drag: 3 }); this.flash = { x, y, t: 0.18 }; break;
      case 'tonk': this.say(x, y - 4, 'TONK !', '#ffdc3c'); c.jig = 0.3; break;
      case 'ball': this.puff(x, y, 8, ['#f08c28', '#ffdc3c'], { speed: 34, spread: 6.3, g: 0, life: 0.3 }); c.hop = 0.35; break;
      case 'fire': this.puff(x, y, 18, ['#fffae6', '#ffe28a', '#ffb03a', '#ff7a1a', '#d64a12'], { dir: side > 0 ? -0.15 : Math.PI + 0.15, spread: 0.5, speed: 90, g: -30, life: 0.5, size: 1, grow: 2, drag: 1.5 }); break;
      case 'meow': this.say(x, y - 6, 'miaou', '#f2e8d0'); break;
      default: break;
    }
  }

  // a word floating up
  say(x, y, text, color) { this.parts.push({ x, y, vx: 0, vy: -14, g: 0, life: 1.1, t: 0, text, c: color }); }

  // ---- frame -------------------------------------------------------------------------------------------------
  update(dt) {
    if (!this.on || !this.img) return;
    this.t += dt;
    const L = this.look;
    if (!Number.isFinite(L.tx + L.ty + L.x + L.y)) { L.x = L.y = L.tx = L.ty = 0; } // (never stuck on a bad value)
    if (!Number.isFinite(dt)) dt = 0;
    L.x += (L.tx - L.x) * Math.min(1, dt * 3); L.y += (L.ty - L.y) * Math.min(1, dt * 3);
    this.dim += (this.dimTo - this.dim) * Math.min(1, dt * 6);
    if (this.shakeT > 0) this.shakeT -= dt; else this.shakeA = 0;
    // gags
    this.gagT -= dt;
    if (this.gagT <= 0 && this.img.fresco) {
      const k = Object.keys(FRESCO_GAGS), G = FRESCO_GAGS[k[(Math.random() * k.length) | 0]];
      this.burstGag(G.x, G.y, G.kind, G.side);
      this.gagT = 1.4 + Math.random() * 2;
    } else if (this.gagT <= 0 && this.cast.every((c) => c.rise >= 1)) {
      this.gag(this.cast[(Math.random() * this.cast.length) | 0]);
      this.gagT = 1.6 + Math.random() * 2.2;
    }
    // bats now and then
    if (Math.random() < dt * 0.35 && this.bats.length < 5) {
      const fromLeft = Math.random() < 0.5;
      this.bats.push({ x: fromLeft ? -10 : VW + 10, y: 30 + Math.random() * 110, vx: (fromLeft ? 1 : -1) * (50 + Math.random() * 40), ph: Math.random() * 6, amp: 6 + Math.random() * 10 });
    }
    this.draw(dt);
  }

  draw(dt) {
    const g = this.g, T = this.t, L = this.look;
    g.setTransform(this.S, 0, 0, this.S, 0, 0);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    const sx = this.shakeA ? (Math.random() - 0.5) * 2 * this.shakeA * (this.shakeT / 0.25 + 0.2) : 0;
    const sy = this.shakeA ? (Math.random() - 0.5) * 2 * this.shakeA * (this.shakeT / 0.25 + 0.2) : 0;
    const par = (k) => [-L.x * k + Math.sin(T * 0.2) * k * 0.3 + sx, -L.y * k * 0.5 + sy];
    g.fillStyle = '#0c0814'; g.fillRect(0, 0, VW, VH);
    let [px, py] = par(3);
    // the fresco: the whole scene in one painting (the friends painted in); only the light, fog and particles move
    if (this.img.fresco) {
      g.drawImage(this.img.fresco, px - 6, py - 3, lw(this.img.fresco), lh(this.img.fresco));
      this.moonGlow(g, px, py);
      this.candles(g, px - 6, py - 3);
      this.fog(g, 0.3, 236, 0.12, par(5));
      this.fog(g, 0.45, 326, 0.2, par(8));
      this.drawParts(g, dt, px, py);
      this.drawBats(g, dt);
      if (this.flash) { this.flash.t -= dt; if (this.flash.t <= 0) this.flash = null; }
      if (this.bolt > 0) {
        this.bolt -= dt;
        g.fillStyle = `rgba(235,230,255,${Math.max(0, this.bolt / 0.5).toFixed(3)})`;
        if (this.bolt > 0.38 || (this.bolt > 0.22 && this.bolt < 0.3)) g.fillRect(0, 0, VW, VH); // a double flash
      }
      if (this.dim > 0.01) { g.fillStyle = `rgba(8,4,16,${(this.dim * 0.6).toFixed(3)})`; g.fillRect(0, 0, VW, VH); }
      return;
    }
    // background plate
    if (this.img.bg) g.drawImage(this.img.bg, px - 6, py - 3, lw(this.img.bg), lh(this.img.bg)); // with its margin (room for the drift)
    this.moonGlow(g, px, py);
    this.fog(g, 0.35, 230, 0.12, par(5));
    // back row, low fog, the foreground frame, then the front row in front of it
    [px, py] = par(6);
    for (const c of this.cast) if (c.back) this.drawChar(g, c, px, py, dt);
    this.fog(g, 0.55, 318, 0.2, par(9));
    [px, py] = par(12);
    if (this.img.fg) { g.drawImage(this.img.fg, px - 14, py - 8, lw(this.img.fg), lh(this.img.fg)); this.candles(g, px - 14, py - 8); }
    [px, py] = par(15);
    for (const c of this.cast) if (!c.back) this.drawChar(g, c, px, py, dt);
    this.drawParts(g, dt, px, py);
    this.drawBats(g, dt);
    if (this.flash) { this.flash.t -= dt; if (this.flash.t <= 0) this.flash = null; }
    if (this.dim > 0.01) { g.fillStyle = `rgba(8,4,16,${(this.dim * 0.6).toFixed(3)})`; g.fillRect(0, 0, VW, VH); }
  }

  drawChar(g, c, ox, oy, dt) {
    const im = this.img[c.id];
    if (!im) return;
    const iw = lw(im, c), ih = lh(im, c);
    // rising from the ground (the perched ones drop from the sky): delay, then a fast pop with an overshoot
    const perched = c.small && !c.back;
    if (c.rise < 1) {
      if (c.delay > 0) c.delay -= dt;
      else {
        if (!c.dusted && !perched) { c.dusted = true; this.puff(c.x + ox, c.y + oy, 14, ['#5a4a6a', '#3a2e48', '#8c7c9c'], { speed: 50, spread: 1.6, g: 120, life: 0.5, size: 2 }); this.shake(1.5, 0.12); }
        c.rise = Math.min(1, c.rise + dt * 4);
        if (perched && c.rise >= 1 && !c.dusted) { c.dusted = true; this.puff(c.x + ox, c.y + oy, 10, ['#5a4a6a', '#8c7c9c'], { speed: 40, spread: 2, g: 120, life: 0.4 }); this.shake(1, 0.1); }
      }
    }
    if (c.rise <= 0 && c.delay > 0) return;
    const p = c.rise;
    const e = p < 1 ? 1 - Math.pow(1 - p, 3) * Math.cos(p * 7) : 1; // overshoot
    let lift = (1 - e) * (ih + 6);
    if (perched) lift = -(1 - e) * (c.y + 10); // from above, nothing hides it
    const bob = Math.sin(this.t * 2.2 + c.phase) * 1; // breathing
    if (c.hop > 0) c.hop -= dt;
    const hop = c.hop > 0 ? Math.sin((c.hop / 0.35) * Math.PI) * 5 : 0;
    let jx = 0;
    if (c.jig > 0) { c.jig -= dt; jx = Math.sin(this.t * 60); }
    const x = c.x - iw / 2 + ox + jx, y = c.y - ih + lift + bob - hop + oy;
    // the ground hides the part still under it
    const visible = ih - Math.max(0, lift);
    if (visible <= 0) return;
    const sv = visible / ih * im.height; // the same part of the HD picture
    g.save();
    if (c.back) g.filter = 'brightness(0.72) saturate(0.8)';
    if (c.flip) { g.translate(x + iw, 0); g.scale(-1, 1); g.drawImage(im, 0, 0, im.width, sv, 0, y, iw, visible); }
    else g.drawImage(im, 0, 0, im.width, sv, x, y, iw, visible);
    g.restore();
    // a soft shadow at the feet
    g.fillStyle = 'rgba(8,4,16,.4)';
    g.beginPath(); g.ellipse(c.x + ox, c.y + oy, iw * 0.32, 1.6, 0, 0, Math.PI * 2); g.fill();
  }

  // dithered moon halo, breathing slowly
  moonGlow(g, ox, oy) {
    if (!this.moon) return;
    const r = this.moon.r + Math.sin(this.t * 0.8) * 2;
    g.fillStyle = 'rgba(220,210,255,0.06)';
    for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(this.moon.x + ox, this.moon.y + oy, r + 8 + k * 7, 0, Math.PI * 2); g.fill(); }
  }

  // bands of fog: soft blobs drifting sideways
  fog(g, alpha, y0, speed, [ox, oy]) {
    const T = this.t;
    for (let i = 0; i < 26; i++) {
      const x = ((i * 53 + T * 30 * speed * (i % 3 + 1)) % (VW + 80)) - 40 + ox;
      const y = y0 + Math.sin(i * 1.7 + T * 0.4) * 6 + (i % 4) * 5 + oy;
      const w = 30 + (i * 37) % 40, h = 3 + (i % 3);
      const r = g.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, w / 2);
      const a = alpha * (0.25 + (i % 5) * 0.05);
      r.addColorStop(0, `rgba(150,136,190,${a.toFixed(3)})`); r.addColorStop(1, 'rgba(150,136,190,0)');
      g.fillStyle = r;
      g.beginPath(); g.ellipse(x + w / 2, y + h / 2, w / 2, h * 1.4, 0, 0, Math.PI * 2); g.fill();
    }
  }

  candles(g, ox, oy) {
    if (!this.glows) return;
    const T = this.t;
    // a soft warm halo breathing slowly over each candle: the light of a flame, not a strobe (no flashing points)
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const e of this.glows) {
      const f = 0.86 + 0.09 * Math.sin(T * 2.1 + e.ph) + 0.05 * Math.sin(T * 3.7 + e.ph * 1.7);
      const r = (9 + Math.min(e.n, 30) * 0.45) * f, x = e.x + ox, y = e.y + oy;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(255,170,60,${(0.14 * f).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,120,30,0)');
      g.fillStyle = gr;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }

  drawParts(g, dt) {
    const P = this.parts;
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.t += dt;
      if (p.t >= p.life) { P.splice(i, 1); continue; }
      if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
      p.vy += (p.g || 0) * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      const k = p.t / p.life;
      if (p.text) {
        g.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
        g.font = '10px "Lilita One"'; g.textAlign = 'center';
        g.fillStyle = '#0c0814'; g.fillText(p.text, p.x + 0.7, p.y + 0.7);
        g.fillStyle = p.c; g.fillText(p.text, p.x, p.y);
        g.globalAlpha = 1;
        continue;
      }
      if (p.sprite) {
        g.globalAlpha = k > 0.6 ? (1 - k) / 0.4 : 1;
        drawHeart(g, p.x + Math.sin(p.t * 4 + p.wob) * 2 + 3.5, p.y + 3);
        g.globalAlpha = 1;
        continue;
      }
      const s = Math.max(1, p.s + p.grow * k);
      g.globalAlpha = p.grow ? 1 - k * 0.8 : (k > 0.7 ? (1 - k) / 0.3 : 1);
      g.fillStyle = p.c;
      g.beginPath(); g.arc(p.x + s / 2, p.y + s / 2, s * 0.6, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
    }
    if (this.flash) {
      g.fillStyle = 'rgba(160,210,255,.35)';
      g.beginPath(); g.arc(this.flash.x, this.flash.y, 10, 0, Math.PI * 2); g.fill();
    }
  }

  drawBats(g, dt) {
    for (let i = this.bats.length - 1; i >= 0; i--) {
      const b = this.bats[i];
      b.x += b.vx * dt; b.ph += dt * 9;
      const y = b.y + Math.sin(b.ph * 0.35) * b.amp;
      if (b.x < -20 || b.x > VW + 20) { this.bats.splice(i, 1); continue; }
      drawBat(g, b.x + 4.5, y + 1.5, (b.ph | 0) % 2 === 0);
    }
  }

  // a flock of bats bursting out (transitions)
  burst(n = 18, y = VH) {
    for (let i = 0; i < n; i++) this.bats.push({ x: Math.random() * VW, y: y - Math.random() * 40, vx: (Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * 120), ph: Math.random() * 6, amp: 20 + Math.random() * 30 });
  }

  dispose() {
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('resize', this.fit);
    this.cv.remove();
  }
}
