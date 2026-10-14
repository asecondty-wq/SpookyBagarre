// Stage collision: floating surfaces (discs), the solid main platform volume, ledges and stage motion.
// A stage module (src/sim/stages/*.js) gives a definition and optional hooks; StageSim does the physics.
//
// Surface (disc): { cx, cz, y, r, solid, thick, depth, spin, tiltX, tiltZ, vx, vz, vy, soft }
//   solid  : blocks from the sides and below (main platform); ledges on its rim
//   soft   : can be landed on from above only
//   spin   : rad/s, purely visual (the game is played in 2D on the plane z = 0: a disc is its segment on that plane)
//   tiltX/Z: slope (dy/dx, dy/dz), fighters slide along x
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

  // 2D gameplay: a surface is the slice of its disc on the plane z = 0, i.e. the segment [cx - r, cx + r]
  inside(s, x, z, margin = 0.15) {
    return Math.abs(x - s.cx) <= s.r + margin;
  }

  // the real 3D disc (for the scenery: particles, props that live off the plane)
  inside3(s, x, z, margin = 0.15) {
    const dx = x - s.cx, dz = z - s.cz;
    return dx * dx + dz * dz <= (s.r + margin) * (s.r + margin);
  }

  // a falling fighter crossing a surface top between yPrev and yNew lands on it (skipSoft: dropping through)
  findLanding(x, z, yPrev, yNew, skipSoft = false) {
    let best = null, bestY = -Infinity;
    for (const s of this.surfaces) {
      if (!s.active || !this.inside(s, x, z)) continue;
      if (skipSoft && s.soft && !s.pad) continue; // the swamp lily pads always hold (below them is the swamp)
      const h = this.heightAt(s, x, 0);
      if (yPrev >= h - 0.25 && yNew <= h + 0.02 && h > bestY) { best = s; bestY = h; }
    }
    return best;
  }

  // same, on the real discs (renderer side)
  findLanding3(x, z, yPrev, yNew) {
    let best = null, bestY = -Infinity;
    for (const s of this.surfaces) {
      if (!s.active || !this.inside3(s, x, z)) continue;
      const h = this.heightAt(s, x, z);
      if (yPrev >= h - 0.25 && yNew <= h + 0.02 && h > bestY) { best = s; bestY = h; }
    }
    return best;
  }

  supports(s, x, z) {
    return s && s.active && this.inside(s, x, z, 0.2);
  }

  // movement of the surface under x during the last step: translation only (a spinning disc is scenery in 2D)
  carry(s) {
    return [s.dx, 0, 0];
  }

  // push a fighter out of solid platform volumes (rim wall and the rocky cone below), in the x-y plane
  pushOut(F) {
    const fr = F.radius;
    for (const s of this.surfaces) {
      if (!s.solid || !s.active) continue;
      const top = this.heightAt(s, F.x, 0);
      const headY = F.y + F.height;
      if (F.y > top - 0.12) continue; // standing on or above
      const bottomRim = top - s.thick;
      const coneTip = bottomRim - s.depth;
      if (headY < coneTip) continue;
      const dx = F.x - s.cx;
      const d = Math.abs(dx) || 0.0001, nx = dx < 0 ? -1 : 1;
      // half width of the volume at the fighter's height range (widest point the body overlaps)
      const yTest = Math.min(headY, top);
      let rAt;
      if (yTest >= bottomRim) rAt = s.r;
      else rAt = s.r * Math.max(0, (yTest - coneTip) / s.depth);
      if (d >= rAt + fr) continue;
      const radialPen = rAt + fr - d;
      let belowPen = Infinity;
      if (F.y < bottomRim) {
        const coneY = coneTip + s.depth * Math.min(1, Math.max(0, (d - fr * 0.5) / s.r));
        belowPen = headY - coneY;
      }
      if (belowPen > 0 && belowPen < radialPen && F.y < bottomRim) {
        F.y -= belowPen;
        if (F.vy > 0) F.vy = 0;
        if (F.ky > 0) F.ky = -F.ky * 0.3;
        F.bonk = true;
      } else {
        F.x = s.cx + nx * (rAt + fr);
        if (F.vx * nx < 0) F.vx = 0;
        const kr = F.kx * nx;
        if (kr < 0) { F.kx -= nx * kr * 1.6; F.wallHit = Math.abs(kr); }
      }
    }
  }

  // ledge near a falling fighter (both ends of solid platforms)
  // reach: extra grab distance (the recoveries snap to the ledge from further away)
  ledgeFor(F, reach = 0) {
    for (const s of this.surfaces) {
      if (!s.solid || !s.active || s.noLedge) continue;
      const dx = F.x - s.cx;
      const d = Math.abs(dx);
      if (d < s.r - 0.35 || d > s.r + 1.15 + reach) continue;
      const nx = dx < 0 ? -1 : 1;
      const top = this.heightAt(s, s.cx + nx * s.r, 0);
      const feet = F.y;
      if (feet > top - 0.25 || feet < top - 2.6 - reach) continue;
      return { s, nx, nz: 0, top, x: s.cx + nx * (s.r + 0.38), z: 0 };
    }
    return null;
  }

  main() { return this.surfaces[0]; }

  spawnPoints(n) {
    if (this.def.spawns) return this.def.spawns(n, this);
    const m = this.main();
    const R = m.r;
    const xs = n <= 2 ? [-0.45, 0.45] : n === 3 ? [-0.55, 0.55, 0] : [-0.6, 0.6, -0.22, 0.22];
    const out = [];
    for (let i = 0; i < n; i++) {
      const x = m.cx + xs[i % xs.length] * R;
      out.push({ x, z: 0, y: this.heightAt(m, x, 0), facing: x > m.cx ? -Math.PI / 2 : Math.PI / 2 });
    }
    return out;
  }

  respawnPoint(slot) {
    const m = this.main();
    const k = [-0.32, 0.32, -0.12, 0.12][slot % 4];
    return { x: m.cx + k * m.r, z: 0, y: this.heightAt(m, m.cx, 0) + 7 };
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
