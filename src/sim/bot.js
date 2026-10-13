// CPU fighters: they produce the same inputs as a player (stick + buttons) from a small plan queue.
import { BTN } from '../core/input.js';
import { CHARS } from './chars/index.js';

function worldToStick(dx, dz, yaw = 0) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  // inverse of stickToWorld
  const x = dx * c - dz * s, z = dx * s + dz * c;
  const m = Math.hypot(x, z) || 1;
  return [x / m, -z / m];
}

function nearestFoe(F, W) {
  let best = null, bd = 1e9;
  for (const o of W.list) {
    if (o === F || o.out || o.state === 'dead' || o.state === 'respawn') continue;
    if (W.rules.teams && o.team === F.team) continue;
    const d = Math.hypot(o.x - F.x, o.z - F.z) + Math.abs(o.y - F.y) * 0.5;
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

export function botInput(F, W) {
  const lvl = F.bot || 2; // 1 easy, 2 normal, 3 hard
  const mem = W.botMem[F.slot] || (W.botMem[F.slot] = { plan: [], prev: 0, cd: 0, think: 0, rng: (F.slot + 1) * 9973 });
  const rnd = () => { mem.rng = (mem.rng * 16807) % 2147483647; return mem.rng / 2147483647; };
  let mx = 0, my = 0, held = 0;

  const step = () => {
    const p = mem.plan[0];
    if (!p) return false;
    mx = p.mx ?? 0; my = p.my ?? 0; held = p.held ?? 0;
    if (--p.n <= 0) mem.plan.shift();
    return true;
  };
  const push = (n, mxv, myv, h) => mem.plan.push({ n, mx: mxv, my: myv, held: h });
  const finish = () => {
    const pressed = held & ~mem.prev;
    mem.prev = held;
    return { mx, my, held, pressed };
  };

  if (F.state === 'dead') return finish();
  if (F.state === 'respawn') { if (F.st > 40 + rnd() * 60) held = BTN.JUMP; return finish(); }
  if (F.state === 'grabbed' || F.state === 'held') { if (W.tick % 4 === 0) held = BTN.A; mx = Math.sin(W.tick * 0.7); return finish(); }

  const m = W.stage.main();
  const dC = Math.hypot(F.x - m.cx, F.z - m.cz);
  const toC = worldToStick(m.cx - F.x, m.cz - F.z, W.camYaw);
  const top = W.stage.heightAt(m, F.x, F.z);

  // --- recovery: off stage, drift back and use jumps / up special
  if (F.state === 'ledge') {
    if (F.ledgeT > 10 + rnd() * 30) { const r = rnd(); if (r < 0.4) held = BTN.JUMP; else if (r < 0.8) { mx = toC[0]; my = toC[1]; } else held = BTN.A; }
    mem.plan.length = 0;
    return finish();
  }
  const offStage = !F.grounded && (dC > m.r - 0.2 || F.y < top - 0.6);
  if (offStage && F.state !== 'hitstun' && F.state !== 'move') {
    mem.plan.length = 0;
    mx = toC[0]; my = toC[1];
    const below = F.y < top - 0.4;
    if (below && F.jumps > 0 && F.vy < 1 && rnd() < 0.5) held = BTN.JUMP;
    else if (below && F.jumps === 0 && F.vy < 0 && (F.y < top - 2.2 || dC > m.r + 4) && F.state !== 'helpless') held = BTN.JUMP | BTN.X;
    else if (!below && dC > m.r + 5 && F.jumps === 0 && F.state === 'air' && rnd() < 0.08) held = BTN.X; // side special toward the stage
    return finish();
  }
  if (offStage) { mx = toC[0]; my = toC[1]; return finish(); }

  if (step()) return finish();

  const T = nearestFoe(F, W);
  if (!T) { if (dC > m.r * 0.5) { mx = toC[0] * 0.5; my = toC[1] * 0.5; } return finish(); }
  const dx = T.x - F.x, dz = T.z - F.z, dist = Math.hypot(dx, dz);
  const toT = worldToStick(dx, dz, W.camYaw);
  const react = lvl === 3 ? 0.9 : lvl === 2 ? 0.55 : 0.25;

  // defend against an incoming attack
  if (T.state === 'move' && dist < 2.6 && Math.abs(T.y - F.y) < 2 && rnd() < 0.06 * react * 3) {
    push(10 + Math.floor(rnd() * 14), 0, 0, BTN.SHIELD);
    return finish();
  }
  if (mem.cd > 0) mem.cd--;

  // keep away from the edge when not fighting
  if (dC > m.r - 1.6 && dist > 3 && F.grounded) { mx = toC[0]; my = toC[1]; return finish(); }

  if (dist > 2.3 || Math.abs(T.y - F.y) > 2.5) {
    mx = toT[0]; my = toT[1];
    if (T.y > F.y + 2 && F.grounded && rnd() < 0.05) held = BTN.JUMP;
    // beam characters charge and fire their neutral special (stick at mid tilt: aims without becoming a side special)
    const bb = CHARS[F.char] && CHARS[F.char].bot;
    if (bb && bb.beam && mem.cd === 0 && dist > 3.5 && dist < 13 && Math.abs(T.y - F.y) < 1.6 && rnd() < 0.01 * (1 + lvl)) {
      const hold = 8 + Math.floor(rnd() * (lvl === 3 ? 70 : 45));
      push(hold, toT[0] * 0.45, toT[1] * 0.45, BTN.X); push(45, 0, 0, 0); mem.cd = 90;
      return finish();
    }
    // ranged specials sometimes
    if (mem.cd === 0 && dist > 4 && dist < 11 && rnd() < 0.012 * (1 + lvl)) {
      push(2, toT[0], toT[1], BTN.X); push(25, toT[0] * 0.2, toT[1] * 0.2, 0); mem.cd = 50;
    }
    return finish();
  }

  // close: pick an attack
  if (mem.cd === 0 && rnd() < 0.18 + react * 0.2) {
    const r = rnd();
    mem.cd = 20 + Math.floor(rnd() * (lvl === 3 ? 10 : 35));
    if (T.state === 'shield' && r < 0.6) { push(2, 0, 0, BTN.SHIELD); push(4, 0, 0, BTN.SHIELD | BTN.A); push(16, 0, 0, 0); push(1, toC[0], toC[1], 0); push(10, -toC[0], -toC[1], 0); }
    else if (r < 0.32) { push(1, 0, 0, BTN.A); push(6, 0, 0, 0); push(1, 0, 0, BTN.A); push(6, 0, 0, 0); push(1, 0, 0, BTN.A); push(20, 0, 0, 0); }
    else if (r < 0.55) { const hold = Math.floor(rnd() * 40 * (T.damage / 100)); push(1 + hold, toT[0], toT[1], BTN.A); push(30, 0, 0, 0); }
    else if (r < 0.68) { push(1, 0, 0, BTN.JUMP | BTN.A); push(36, 0, 0, 0); }
    else if (r < 0.82) { push(1, toT[0], toT[1], BTN.X); push(30, 0, 0, 0); }
    else if (r < 0.9) { push(2, 0, 0, BTN.SHIELD); push(1, 0, 0, BTN.SHIELD | BTN.X); push(30, 0, 0, 0); }
    else { push(1, 0, 0, BTN.JUMP); push(8, toT[0], toT[1], 0); push(1, toT[0], toT[1], BTN.A); push(20, 0, 0, 0); }
    return finish();
  }
  // shuffle around the target
  const side = (F.slot % 2 ? 1 : -1);
  mx = toT[0] * 0.3 + -toT[1] * 0.4 * side; my = toT[1] * 0.3 + toT[0] * 0.4 * side;
  return finish();
}
