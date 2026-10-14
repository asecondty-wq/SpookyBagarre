// Shared helpers of the up specials (the recoveries): steering in the air, finding the ledge to come back to,
// being pulled to it (tongue, leash, hair, grind), and a second press of X during the move.
import { RIGHT, LEFT } from '../util.js';
import { BTN } from '../../core/input.js';
import { DMath } from '../dmath.js';

// horizontal steering with the stick (the fighter turns with it)
export function steerX(F, speed, k = 0.16) {
  if (Math.abs(F.mx) > 0.2) {
    F.vx += (F.mx * speed - F.vx) * k;
    F.facing = F.mx < 0 ? LEFT : RIGHT;
  } else F.vx *= 0.96;
}

// the closest ledge a fighter off the stage (or under its edge) could come back to, within maxD metres
export function nearestLedge(W, F, maxD) {
  let best = null, bd = maxD;
  for (const s of W.stage.surfaces) {
    if (!s.solid || !s.active || s.noLedge) continue;
    const dx = F.x - s.cx;
    const nx = dx < 0 ? -1 : 1;
    const top = W.stage.heightAt(s, s.cx + nx * s.r, 0);
    // only from outside the edge, or from below it
    if (Math.abs(dx) < s.r - 0.6 && F.y > top - 1) continue;
    if (F.y > top + 1.5) continue;
    const lx = s.cx + nx * (s.r + 0.38), ly = top - 1.25;
    const d = DMath.hypot(lx - F.x, ly - F.y);
    if (d < bd) { bd = d; best = { s, nx, top, x: lx, y: ly, d }; }
  }
  return best;
}

// fly straight to the ledge hanging point; returns the distance left (the ledge grab takes over near it)
export function pullTo(F, L, speed) {
  const dx = L.x - F.x, dy = L.y - F.y;
  const d = DMath.hypot(dx, dy) || 1e-3;
  const v = Math.min(speed, d * 60);
  F.vx = (dx / d) * v; F.vy = (dy / d) * v; F.vz = 0;
  F.facing = dx < 0 ? LEFT : RIGHT;
  return d;
}

// X pressed again during the move (consumes the press)
export function xAgain(F) {
  if (F.bufX > 0) { F.bufX = 0; return true; }
  return false;
}
export const xHeld = (F) => (F.held & BTN.X) !== 0;
