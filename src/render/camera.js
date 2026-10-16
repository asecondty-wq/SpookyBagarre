// Shared camera, Smash style: the fight is played in 2D, the camera looks at it from the side (a little from
// above), frames every living fighter in x and y, zooms with their spread, shakes on hits and punches in on big blows.
import * as THREE from 'three';

export class CameraRig {
  constructor(camera) {
    this.cam = camera;
    this.target = new THREE.Vector3(0, 2, 0);
    this.dist = 30;
    this.pitch = 0.13;
    this.yaw = 0;
    this.trauma = 0;
    this.punch = 0;
    this.roll = 0;
    this.kickX = 0;      // a short shove of the whole frame along a blow's launch (decays fast), in -1..1
    this.kickY = 0;
    this.settings = null; // player settings (set by FX): `shake` (0..1 factor) and `reduced` tone the screen effects down
    this.focus = null;   // {x,y,z,t} temporary focus (KO, finish)
    this.focusK = 0;
    this.t = 0;
    this.tmp = new THREE.Vector3();
  }

  // 0..1 factor from the options: `shake` (0 none, 0.5 light, 1 normal), and "reduced effects" brings it down further
  fxScale() {
    const s = this.settings;
    if (!s) return 1;
    const k = Number.isFinite(s.shake) ? Math.max(0, Math.min(1, s.shake)) : 1;
    return k * (s.reduced ? 0.3 : 1);
  }

  // hits shake the camera a little (the fight must stay readable): every caller's amount is scaled down here.
  // `dir` ([x, y] along the launch, optional) also shoves the frame that way for a moment: a heavy blow is felt in
  // the direction it sends the victim, not only as a random tremble.
  shake(amount, dir) {
    if (!Number.isFinite(amount)) return;
    const k = this.fxScale();
    this.trauma = Math.min(0.55, this.trauma + amount * 0.3 * k);
    if (dir && k > 0 && Number.isFinite(dir[0]) && Number.isFinite(dir[1])) {
      const a = Math.min(1, amount) * k;
      this.kickX = Math.max(-1, Math.min(1, this.kickX + dir[0] * a));
      this.kickY = Math.max(-1, Math.min(1, this.kickY + dir[1] * a));
    }
  }
  // gain: how far a full punch zooms in (the default is the usual hit; a KO asks for a little more)
  punchIn(amount, gain = 0.6) { if (Number.isFinite(amount)) this.punch = Math.max(this.punch, amount * gain * (this.settings && this.settings.reduced ? 0.5 : 1)); }
  focusOn(p, seconds = 0.6, k = 1) { this.focus = { x: p.x, y: p.y, z: p.z, t: seconds }; this.focusK = k; }

  update(dt, points, stageR = 13, opts = {}) {
    this.t += dt;
    if (!Number.isFinite(this.dist) || !Number.isFinite(this.target.x) || !Number.isFinite(this.punch)) {
      this.target.set(0, 2, 0); this.dist = 30; this.punch = 0; this.trauma = 0; this.focus = null;
    }
    if (!Number.isFinite(this.kickX) || !Number.isFinite(this.kickY)) { this.kickX = 0; this.kickY = 0; }
    if (!Number.isFinite(this.cam.aspect) || this.cam.aspect <= 0) return;
    // bounds of the fighters in the plane: the camera comes close when they fight close
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of points) {
      const x = Math.max(-34, Math.min(34, p.x)), y = Math.max(-14, Math.min(24, p.y));
      minX = Math.min(minX, x - 3.2); maxX = Math.max(maxX, x + 3.2);
      minY = Math.min(minY, y - 1.0); maxY = Math.max(maxY, y + 3.4);
    }
    if (!Number.isFinite(minX)) { minX = -stageR * 0.55; maxX = stageR * 0.55; minY = -0.5; maxY = 3.5; }
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const spanX = maxX - minX, spanY = maxY - minY;
    const aspect = this.cam.aspect;
    const tanH = Math.tan((this.cam.fov * Math.PI) / 360);
    // close on a tight fight, wide when they spread out (never closer than CLOSE)
    const CLOSE = 10.5;
    const need = Math.max(spanX / (2 * tanH * aspect), spanY / (2 * tanH), CLOSE);
    let wantDist = Math.min(62, need * 1.06);
    // aim a bit below the action: the HUD covers the bottom of the screen
    let tx = cx, ty = cy - wantDist * 0.012, tz = 0;
    if (opts.menu) { wantDist = opts.menuDist || 34; tx = 0; ty = 2.4; tz = 0; }
    if (this.focus) {
      this.focus.t -= dt;
      const k = this.focusK;
      tx = tx + (this.focus.x - tx) * k * 0.7; ty = ty + (this.focus.y - ty) * k * 0.7;
      wantDist = Math.max(wantDist * (1 - 0.25 * k), CLOSE);
      if (this.focus.t <= 0) this.focus = null;
    }
    const lk = 1 - Math.exp(-dt * 3.0);
    this.target.x += (tx - this.target.x) * lk;
    this.target.y += (ty - this.target.y) * lk;
    this.target.z += (tz - this.target.z) * lk;
    // zooming out is quicker than zooming in: nobody leaves the screen, and the close-ups settle smoothly
    this.dist += (wantDist - this.dist) * (1 - Math.exp(-dt * (wantDist > this.dist ? 3.2 : 1.4)));
    this.punch *= Math.exp(-dt * 6);
    const d = this.dist * (1 - this.punch * 0.08);
    // a touch of yaw with the action, for the 3D scenery to slide behind (parallax)
    const yaw = this.yaw + Math.max(-0.12, Math.min(0.12, this.target.x * 0.006));
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const pos = this.tmp.set(
      this.target.x + Math.sin(yaw) * cp * d,
      this.target.y + sp * d,
      this.target.z + Math.cos(yaw) * cp * d,
    );
    // shake (trauma squared)
    this.trauma = Math.max(0, this.trauma - dt * 2.4);
    const s = this.trauma * this.trauma * (0.5 + this.dist / 40); // the same on screen, close or far
    const n1 = Math.sin(this.t * 41.3) * Math.cos(this.t * 27.1), n2 = Math.sin(this.t * 37.7 + 1.3);
    pos.x += n1 * s * 0.5; pos.y += n2 * s * 0.4;
    // the shove along a launch: the camera and its aim slide together (a pan, not a tilt), at most ~2% of the distance
    const kd = Math.exp(-dt * 13);
    this.kickX *= kd; this.kickY *= kd;
    if (Math.abs(this.kickX) < 0.001) this.kickX = 0;
    if (Math.abs(this.kickY) < 0.001) this.kickY = 0;
    const ks = this.dist * 0.02, kx = this.kickX * ks, ky = this.kickY * ks;
    pos.x += kx; pos.y += ky;
    this.cam.position.copy(pos);
    this.cam.lookAt(this.target.x + n1 * s * 0.5 + kx, this.target.y + n2 * s * 0.4 + ky, this.target.z);
    this.roll *= Math.exp(-dt * 6);
    this.cam.rotateZ(this.roll * 0.4);
  }
}
