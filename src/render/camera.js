// Shared camera: frames every living fighter from the front, a bit from above (fixed yaw, like Smash),
// zooms with their spread, shakes on hits and punches in on big blows.
import * as THREE from 'three';

export class CameraRig {
  constructor(camera) {
    this.cam = camera;
    this.target = new THREE.Vector3(0, 1, 0);
    this.dist = 22;
    this.pitch = 0.42;
    this.yaw = 0;
    this.trauma = 0;
    this.punch = 0;
    this.roll = 0;
    this.focus = null;   // {x,y,z,t} temporary focus (KO, finish)
    this.focusK = 0;
    this.t = 0;
    this.tmp = new THREE.Vector3();
  }

  shake(amount) { if (Number.isFinite(amount)) this.trauma = Math.min(1.2, this.trauma + amount); }
  punchIn(amount) { if (Number.isFinite(amount)) this.punch = Math.max(this.punch, amount); }
  focusOn(p, seconds = 0.6, k = 1) { this.focus = { x: p.x, y: p.y, z: p.z, t: seconds }; this.focusK = k; }

  update(dt, points, stageR = 9, opts = {}) {
    this.t += dt;
    if (!Number.isFinite(this.dist) || !Number.isFinite(this.target.x) || !Number.isFinite(this.punch)) {
      this.target.set(0, 1, 0); this.dist = 22; this.punch = 0; this.trauma = 0; this.focus = null;
    }
    if (!Number.isFinite(this.cam.aspect) || this.cam.aspect <= 0) return;
    // bounds of the interesting points (fighters), always keeping the platform centre a little
    let minX = -stageR * 0.45, maxX = stageR * 0.45, minZ = -stageR * 0.35, maxZ = stageR * 0.35, minY = 0, maxY = 2;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const p of points) {
      const x = Math.max(-26, Math.min(26, p.x)), z = Math.max(-26, Math.min(26, p.z)), y = Math.max(-10, Math.min(18, p.y));
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y + 2);
      sx += x; sy += y; sz += z; n++;
    }
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2, cy = (minY + maxY) / 2;
    const spanX = maxX - minX, spanZ = maxZ - minZ, spanY = maxY - minY;
    const aspect = this.cam.aspect;
    const tanH = Math.tan((this.cam.fov * Math.PI) / 360);
    const need = Math.max(spanX / aspect / tanH * 0.62, (spanY + spanZ * 0.55) / tanH * 0.6, 13);
    let wantDist = Math.min(44, need + 4);
    // aim a bit below the action: the HUD covers the bottom of the screen
    let tx = cx, ty = cy * 0.75 + 0.6 - wantDist * 0.07, tz = cz + 1.0 + wantDist * 0.05;
    if (opts.menu) { wantDist = opts.menuDist || 26; tx = 0; ty = 1.2; tz = 0; }
    if (this.focus) {
      this.focus.t -= dt;
      const k = this.focusK;
      tx = tx + (this.focus.x - tx) * k * 0.7; ty = ty + (this.focus.y - ty) * k * 0.7; tz = tz + (this.focus.z - tz) * k * 0.7;
      wantDist = wantDist * (1 - 0.35 * k);
      if (this.focus.t <= 0) this.focus = null;
    }
    const lk = 1 - Math.exp(-dt * 3.2);
    this.target.x += (tx - this.target.x) * lk;
    this.target.y += (ty - this.target.y) * lk;
    this.target.z += (tz - this.target.z) * lk;
    this.dist += (wantDist - this.dist) * (1 - Math.exp(-dt * 2.4));
    this.punch *= Math.exp(-dt * 6);
    const d = this.dist * (1 - this.punch * 0.18);
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const pos = this.tmp.set(
      this.target.x + Math.sin(this.yaw) * cp * d,
      this.target.y + sp * d,
      this.target.z + Math.cos(this.yaw) * cp * d,
    );
    // shake (trauma squared)
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const s = this.trauma * this.trauma;
    const n1 = Math.sin(this.t * 61.3) * Math.cos(this.t * 37.1), n2 = Math.sin(this.t * 53.7 + 1.3), n3 = Math.cos(this.t * 71.9 + 0.4);
    pos.x += n1 * s * 0.9; pos.y += n2 * s * 0.7; pos.z += n3 * s * 0.4;
    this.cam.position.copy(pos);
    this.cam.lookAt(this.target.x + n2 * s * 0.25, this.target.y + n1 * s * 0.2, this.target.z);
    this.roll *= Math.exp(-dt * 5);
    this.cam.rotateZ(this.roll + n3 * s * 0.04);
  }
}
