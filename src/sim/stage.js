// Stage collision: floating surfaces (discs), the solid main platform volume, ledges and stage motion.
// A stage module (src/sim/stages/*.js) gives a definition and optional hooks; StageSim does the physics.
//
// Surface (disc): { cx, cz, y, r, solid, thick, depth, spin, tiltX, tiltZ, vx, vz, vy, soft }
//   solid  : blocks from the sides and below (main platform); ledges on its rim
//   soft   : can be landed on from above only
//   spin   : rad/s, carries whatever stands on it
//   tiltX/Z: slope (dy/dx, dy/dz), fighters slide
import { DT } from './constants.js';

export class StageSim {
  constructor(def, world) {
    this.def = def;
    this.world = world;
    this.t = 0;
    this.surfaces = def.surfaces.map((s, i) => ({
      idx: i, cx: 0, cz: 0, y: 0, r: 5, solid: false, thick: 1.2, depth: 5, spin: 0, angle: 0,
      tiltX: 0, tiltZ: 0, dx: 0, dz: 0, dy: 0, active: true, ...s,
    }));
    this.vars = {}; // stage-specific state (synced)
    if (def.init) def.init(this, world);
  }

  step(W) {
    this.t++;
    for (const s of this.surfaces) { s.dx = 0; s.dz = 0; s.dy = 0; s.dspin = 0; }
    if (this.def.step) this.def.step(this, W);
    for (const s of this.surfaces) {
      if (s.spin) { s.angle += s.spin * DT; s.dspin = s.spin * DT; }
    }
  }

  // height of surface at (x,z)
  heightAt(s, x, z) {
    return s.y + s.tiltX * (x - s.cx) + s.tiltZ * (z - s.cz);
  }

  inside(s, x, z, margin = 0.15) {
    const dx = x - s.cx, dz = z - s.cz;
    return dx * dx + dz * dz <= (s.r + margin) * (s.r + margin);
  }

  // a falling fighter crossing a surface top between yPrev and yNew lands on it
  findLanding(x, z, yPrev, yNew) {
    let best = null, bestY = -Infinity;
    for (const s of this.surfaces) {
      if (!s.active || !this.inside(s, x, z)) continue;
      const h = this.heightAt(s, x, z);
      if (yPrev >= h - 0.25 && yNew <= h + 0.02 && h > bestY) { best = s; bestY = h; }
    }
    return best;
  }

  supports(s, x, z) {
    return s && s.active && this.inside(s, x, z, 0.2);
  }

  // movement of the surface under (x,z) during the last step (rotation and translation)
  carry(s, x, z) {
    let mx = s.dx, mz = s.dz;
    if (s.dspin) {
      const px = x - s.cx, pz = z - s.cz;
      const c = Math.cos(s.dspin), sn = Math.sin(s.dspin);
      const nx = px * c + pz * sn, nz = -px * sn + pz * c;
      mx += nx - px; mz += nz - pz;
    }
    return [mx, mz, s.dspin || 0];
  }

  // push a fighter out of solid platform volumes (rim wall and the rocky cone below)
  pushOut(F) {
    const fr = F.radius;
    for (const s of this.surfaces) {
      if (!s.solid || !s.active) continue;
      const top = this.heightAt(s, F.x, F.z);
      const headY = F.y + F.height;
      if (F.y > top - 0.12) continue; // standing on or above
      const bottomRim = top - s.thick;
      const coneTip = bottomRim - s.depth;
      if (headY < coneTip) continue;
      const dx = F.x - s.cx, dz = F.z - s.cz;
      const d = Math.hypot(dx, dz) || 0.0001;
      // radius of the volume at the fighter's height range (widest point the body overlaps)
      const yTest = Math.min(headY, top);
      let rAt;
      if (yTest >= bottomRim) rAt = s.r;
      else rAt = s.r * Math.max(0, (yTest - coneTip) / s.depth);
      if (d >= rAt + fr) continue;
      // penetration: radial vs from below
      const radialPen = rAt + fr - d;
      let belowPen = Infinity;
      if (F.y < bottomRim) {
        // how far the head is above the cone surface right above the fighter
        const coneY = coneTip + s.depth * Math.min(1, Math.max(0, (d - fr * 0.5) / s.r));
        belowPen = headY - coneY;
      }
      if (belowPen > 0 && belowPen < radialPen && F.y < bottomRim) {
        F.y -= belowPen;
        if (F.vy > 0) F.vy = 0;
        if (F.ky > 0) F.ky = -F.ky * 0.3;
        F.bonk = true;
      } else {
        F.x = s.cx + (dx / d) * (rAt + fr);
        F.z = s.cz + (dz / d) * (rAt + fr);
        const vr = (F.vx * dx + F.vz * dz) / d;
        if (vr < 0) { F.vx -= (dx / d) * vr; F.vz -= (dz / d) * vr; }
        const kr = (F.kx * dx + F.kz * dz) / d;
        if (kr < 0) { F.kx -= (dx / d) * kr * 1.6; F.kz -= (dz / d) * kr * 1.6; F.wallHit = Math.abs(kr); }
      }
    }
  }

  // ledge near a falling fighter (rim of solid discs)
  ledgeFor(F) {
    for (const s of this.surfaces) {
      if (!s.solid || !s.active || s.noLedge) continue;
      const dx = F.x - s.cx, dz = F.z - s.cz;
      const d = Math.hypot(dx, dz);
      if (d < s.r - 0.35 || d > s.r + 1.15) continue;
      const nx = dx / (d || 1), nz = dz / (d || 1);
      const top = this.heightAt(s, s.cx + nx * s.r, s.cz + nz * s.r);
      const feet = F.y;
      if (feet > top - 0.25 || feet < top - 2.6) continue;
      return { s, nx, nz, top, x: s.cx + nx * (s.r + 0.38), z: s.cz + nz * (s.r + 0.38) };
    }
    return null;
  }

  main() { return this.surfaces[0]; }

  spawnPoints(n) {
    if (this.def.spawns) return this.def.spawns(n, this);
    const m = this.main();
    const R = Math.min(m.r * 0.55, 5);
    const ang = [-2.3, -0.84, 2.3, 0.84];
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = ang[i % 4];
      const x = m.cx + Math.sin(a) * R, z = m.cz + Math.cos(a) * R;
      out.push({ x, z, y: this.heightAt(m, x, z), facing: Math.atan2(m.cx - x, m.cz - z) });
    }
    return out;
  }

  respawnPoint(slot) {
    const m = this.main();
    const a = [-0.9, 0.9, -2.4, 2.4][slot % 4];
    return { x: m.cx + Math.sin(a) * 2.6, z: m.cz + Math.cos(a) * 2.6, y: this.heightAt(m, m.cx, m.cz) + 6.5 };
  }

  getState() {
    return { t: this.t, v: this.vars, s: this.surfaces.map((s) => [s.cx, s.cz, s.y, s.angle, s.tiltX, s.tiltZ, s.r, s.active ? 1 : 0]) };
  }

  setState(st) {
    this.t = st.t;
    this.vars = st.v;
    st.s.forEach((a, i) => {
      const s = this.surfaces[i];
      if (!s) return;
      [s.cx, s.cz, s.y, s.angle, s.tiltX, s.tiltZ, s.r] = a;
      s.active = !!a[7];
    });
  }
}
