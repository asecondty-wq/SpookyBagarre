// CPU fighters: they produce the same inputs as a player (stick + buttons) from a small plan queue.
// The game is played in 2D: the stick x moves, the stick y aims (up / down moves, fast fall, recovery).
import { BTN } from '../core/input.js';
import { CHARS } from './chars/index.js';
import { DMath } from './dmath.js';

function nearestFoe(F, W) {
  let best = null, bd = 1e9;
  for (const o of W.list) {
    if (o === F || o.out || o.state === 'dead' || o.state === 'respawn') continue;
    if (W.rules.teams && o.team === F.team) continue;
    const d = Math.abs(o.x - F.x) + Math.abs(o.y - F.y) * 0.6;
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

const sgn = (v) => (v < 0 ? -1 : 1);

export function botInput(F, W) {
  const lvl = F.bot || 2; // 1 easy, 2 normal, 3 hard
  const mem = W.botMem[F.slot] || (W.botMem[F.slot] = { plan: [], prev: 0, cd: 0, rng: 1 + ((((W.seed >>> 0) ^ ((F.slot + 1) * 9973)) >>> 0) % 2147483645) });
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
  if (F.state === 'grabbed' || F.state === 'held') { if (W.tick % 4 === 0) held = BTN.A; mx = DMath.sin(W.tick * 0.7); return finish(); }

  const m = W.stage.main();
  const toC = sgn(m.cx - F.x);
  const edge = m.r - Math.abs(F.x - m.cx); // distance to the edge (negative: off stage)
  const top = W.stage.heightAt(m, F.x, 0);
  const face = DMath.sin(F.facing) < 0 ? -1 : 1;

  // --- ledge: get up one way or another
  if (F.state === 'ledge') {
    mem.plan.length = 0;
    if (F.ledgeT > 10 + rnd() * 30) { const r = rnd(); if (r < 0.35) held = BTN.JUMP; else if (r < 0.7) mx = toC; else if (r < 0.85) held = BTN.SHIELD; else held = BTN.A; }
    return finish();
  }

  // --- recovery: off stage, drift back, double jump, then the up special (stick up + X)
  const offStage = !F.grounded && (edge < 0.2 || F.y < top - 0.6);
  if (offStage && F.state !== 'hitstun') {
    mem.plan.length = 0;
    mx = toC;
    const bbu = CHARS[F.char] && CHARS[F.char].bot;
    if (F.state === 'move') return finish();
    const below = F.y < top - 0.3;
    if (below && F.jumps > 0 && F.vy < 1 && rnd() < 0.5) held = BTN.JUMP;
    else if (F.jumps === 0 && F.vy < 0 && (F.y < top - 1.5 || edge < -4) && F.state !== 'helpless') { my = 1; mx = toC * 0.5; held = BTN.X; }
    else if (F.state === 'helpless' && !F.usedUp && F.vy < 0 && (F.y < top - 1.0 || edge < -2)) { my = 1; mx = toC * 0.5; held = W.tick % 6 < 2 ? BTN.X : 0; }
    else if (!below && edge < -6 && F.jumps === 0 && F.state === 'air' && rnd() < 0.05) held = BTN.X; // side special toward the stage
    return finish();
  }
  if (offStage) { mx = toC; return finish(); }

  if (F.state === 'move' && F.move === 'omCarry') {
    mem.plan.length = 0;
    const out = sgn(F.x - m.cx);
    if ((F.mf > 25 && edge < 2.5) || F.mf > 110) { mx = out; held = BTN.A; return finish(); }
    mx = out * 0.6; return finish();
  }
  if (step()) return finish();

  const T = nearestFoe(F, W);
  if (!T) { if (edge < m.r * 0.5) mx = toC * 0.5; return finish(); }
  const dx = T.x - F.x, dy = T.y - F.y, adx = Math.abs(dx);
  const toT = sgn(dx);
  const react = lvl === 3 ? 0.9 : lvl === 2 ? 0.55 : 0.25;
  if (mem.cd > 0) mem.cd--;

  // --- a reflector (Aboueb): up when an enemy projectile comes at it
  const bbr = CHARS[F.char] && CHARS[F.char].bot;
  if (bbr && bbr.reflect && !(F.cd && F.cd.n > 0) && (F.state === 'idle' || F.state === 'run' || F.state === 'walk' || F.state === 'air') && rnd() < 0.5 * react) {
    const inc = W.entities.some((e) => e.kind === 'proj' && !e.dead && e.owner !== F.slot && e.owner >= 0 && Math.abs(e.x - F.x) < 3.2 && Math.abs(e.y - F.y - 1) < 1.6 && (e.vx || 0) * (F.x - e.x) > 0);
    if (inc) { push(14 + Math.floor(rnd() * 10), 0, 0, BTN.X); push(10, 0, 0, 0); return finish(); }
  }

  // --- defend against an incoming attack: shield, sometimes roll away (shield + stick)
  if (F.grounded && T.state === 'move' && adx < 2.8 && Math.abs(dy) < 2 && rnd() < 0.06 * react * 3) {
    if (rnd() < 0.35 && edge > 3) { push(3, 0, 0, BTN.SHIELD); push(2, -toT, 0, BTN.SHIELD); push(24, 0, 0, 0); }
    else push(10 + Math.floor(rnd() * 14), 0, 0, BTN.SHIELD);
    return finish();
  }

  // --- in the air near the foe: the right aerial for where he is
  if (!F.grounded && F.state === 'air' && adx < 2.4 && Math.abs(dy) < 2.6 && mem.cd === 0 && rnd() < 0.25 + react * 0.3) {
    mem.cd = 18 + Math.floor(rnd() * 20);
    if (dy > 1.3) push(1, 0, 1, BTN.A);                 // up air
    else if (dy < -1.1) push(1, 0, -1, BTN.A);          // down air
    else if (toT === face) push(1, toT, 0, BTN.A);      // forward air
    else if (rnd() < 0.7) push(1, toT, 0, BTN.A);       // back air (the stick away from the facing)
    else push(1, 0, 0, BTN.A);                          // neutral air
    push(18, toT * 0.4, -0.2, 0);
    return finish();
  }

  // --- keep away from the edge when not fighting
  if (edge < 1.8 && adx > 3 && F.grounded) { mx = toC; return finish(); }

  if (adx > 2.3 || Math.abs(dy) > 2.5) {
    mx = toT;
    // the foe is above: jump (and attack with an up air when close)
    if (dy > 2 && adx < 4 && F.grounded && rnd() < 0.06) { push(1, toT * 0.5, 0, BTN.JUMP); push(10, toT * 0.4, 0, 0); return finish(); }
    // the foe is below on a lower platform: drop through
    if (dy < -1.5 && adx < 3 && F.grounded && rnd() < 0.04) { push(1, 0, 0, 0); push(1, 0, -1, 0); push(8, toT * 0.3, 0, 0); return finish(); }
    // beam characters charge and fire their neutral special (no stick: it stays neutral)
    const bb = CHARS[F.char] && CHARS[F.char].bot;
    if (bb && bb.beam && mem.cd === 0 && !(F.cd && F.cd.n > 0) && adx > 3.5 && adx < 12 && Math.abs(dy) < 1.6 && F.grounded && rnd() < 0.01 * (1 + lvl)) {
      const hold = 8 + Math.floor(rnd() * (lvl === 3 ? 60 : 40));
      if (toT !== face) push(2, toT, 0, 0);
      push(hold, 0, 0, BTN.X); push(45, 0, 0, 0); mem.cd = 100;
      return finish();
    }
    // ranged specials sometimes (neutral or side special toward the foe)
    if (mem.cd === 0 && adx > 4 && adx < 11 && rnd() < 0.012 * (1 + lvl)) {
      const close = bb && (bb.closeN || bb.noN); // (a grab, a reflector: never thrown from afar)
      const side = (close || rnd() < 0.5) && !(F.cd && F.cd.s > 0);
      if (side || (!close && !(F.cd && F.cd.n > 0))) { push(2, side ? toT : 0, 0, BTN.X); push(25, toT * 0.2, 0, 0); mem.cd = 60; }
    }
    // running in: the dash attack when the foe is just ahead
    if (F.state === 'run' && adx < 3.8 && Math.abs(dy) < 1 && mem.cd === 0 && rnd() < 0.05 * (1 + lvl)) { push(1, toT, 0, BTN.A); push(24, 0, 0, 0); mem.cd = 40; return finish(); }
    // jump in for an aerial now and then
    if (F.grounded && adx < 5.5 && adx > 2.5 && Math.abs(dy) < 1 && rnd() < 0.025 * (1 + lvl)) { push(1, toT, 0, BTN.JUMP); push(8, toT, 0, 0); }
    return finish();
  }

  // --- close: pick a ground attack
  if (F.grounded && mem.cd === 0 && rnd() < 0.18 + react * 0.2) {
    const r = rnd();
    mem.cd = 20 + Math.floor(rnd() * (lvl === 3 ? 10 : 35));
    const hold = Math.floor(rnd() * 40 * Math.min(1.5, T.damage / 100));
    if (T.state === 'shield' && r < 0.6) {
      // grab the shield, then throw toward the edge (or up)
      push(2, 0, 0, BTN.SHIELD); push(4, 0, 0, BTN.SHIELD | BTN.A); push(16, 0, 0, 0);
      const t = rnd(); push(10, t < 0.6 ? -toC : 0, t < 0.6 ? 0 : t < 0.8 ? 1 : -1, 0);
    }
    else if (r < 0.28) { push(1, 0, 0, BTN.A); push(6, 0, 0, 0); push(1, 0, 0, BTN.A); push(6, 0, 0, 0); push(1, 0, 0, BTN.A); push(20, 0, 0, 0); }
    else if (r < 0.48) { push(1 + hold, toT, 0, BTN.A); push(30, 0, 0, 0); }      // forward smash
    else if (r < 0.6) { push(1 + hold, 0, -1, BTN.A); push(30, 0, 0, 0); }       // down smash
    else if (r < 0.7 || dy > 1) { push(1 + hold, 0, 1, BTN.A); push(34, 0, 0, 0); } // up smash
    else if (r < 0.76 && adx < 1.6 && CHARS[F.char].bot && CHARS[F.char].bot.closeN && !(F.cd && F.cd.n > 0)) { if (toT !== face) push(1, toT, 0, 0); push(1, 0, 0, BTN.X); push(30, 0, 0, 0); } // the grab up close
    else if (r < 0.82 && !(F.cd && F.cd.s > 0)) { push(1, toT, 0, BTN.X); push(30, 0, 0, 0); }           // side special (when it is back)
    else if (r < 0.9 && !(F.cd && F.cd.d > 0)) { push(1, 0, -1, BTN.X); push(30, 0, 0, 0); }             // down special
    else { push(1, 0, 0, BTN.JUMP); push(8, toT, 0, 0); push(1, toT, 0, BTN.A); push(20, 0, 0, 0); } // short hop forward air
    return finish();
  }
  // --- shuffle around the foe (spacing back and forth)
  const side = (W.tick + F.slot * 37) % 90 < 45 ? 1 : -1;
  mx = toT * 0.25 * side;
  return finish();
}
