// Aboueb : maillot de basket et des cheveux bouclés qui s'allongent comme un fouet : presque tous ses coups sont
// donnés avec la chevelure (bonne allonge, dégâts et puissance moyens). Un réflecteur magique, un ballon de basket
// qui revient et se relance, les boucles-grappin qui ramènent l'ennemi, un tapis volant pour remonter.
import { normals, dashAttack, hb, shoot } from '../kit.js';
import { ENTITIES } from '../entities.js';
import { endMove, startMove, stunFor } from '../fighter.js';
import { localToWorld } from '../util.js';
import { steerX, nearestLedge, pullTo, xHeld } from './recovery.js';
import { DMath } from '../dmath.js';
import { DT } from '../constants.js';

// --- the curls ----------------------------------------------------------------------------------------------------
// The rope of curls leaves the back of his head (HAIR_H metres up) and points at `ang` (0 forward, PI/2 up, -PI/2
// down, PI behind); its tip is 0.35 + len away. The rig draws it exactly there (src/render/rig/friendRigs.js), so
// the hitboxes below sit on the curls: F.va[0] = len, F.va[5] = ang.
const HAIR_H = 1.45;
const tipAt = (len, ang) => [0, HAIR_H + DMath.sin(ang) * (0.35 + len), DMath.cos(ang) * (0.35 + len)];
const hairTip = (F, len, ang = 0) => localToWorld(F, tipAt(len, ang));

// a blow of the curls: they shoot out over [a, b], stay out (the hitboxes) over [b, c], come back over [c, d]
function lash(o) {
  // (the curls stay out two frames longer than they were drawn first: they connected too little, 16 Oct balance)
  const { a, b, len, ang } = o, c = o.c + 2, d = o.d + 2;
  o = { ...o, dur: o.dur + 2, iasa: (o.iasa ?? o.dur - 2) + 2 };
  const M = {
    dur: o.dur, iasa: o.iasa ?? o.dur - 2, pose: o.pose, combo: o.combo ?? true, air: o.air, landLag: o.landLag,
    next: o.next, nextWin: o.nextWin, charge: o.charge, tilt: o.tilt,
    onFrame(F, W, f) {
      const k = f < a ? 0 : f < b ? (f - a) / (b - a) : f <= c ? 1 : f < d ? 1 - (f - c) / (d - c) : 0;
      F.va[0] = len * k; F.va[5] = ang;
      if (f === a) W.emit('sfx', { s: F.slot, n: 'whip' });
      if (o.onFrame) o.onFrame(F, W, f);
    },
    onEnd(F) { F.va[0] = 0; F.va[5] = 0; },
    // the tip hits hardest, the middle of the rope a little less
    hits: [
      hb(b, c, tipAt(len, ang), o.r, o.dmg, o.kang, o.kbb, o.kbg, { sfx: 'whip', blood: o.blood ?? 1, hitlag: o.hitlag ?? 1, back: Math.abs(ang) > 2 ? true : undefined, spike: o.spike, ...(o.extra || {}) }),
      hb(b, c, tipAt(len * 0.5, ang), o.r * 0.85, o.dmg * 0.82, o.kang, o.kbb * 0.85, o.kbg * 0.85, { sfx: 'slap', blood: (o.blood ?? 1) * 0.6, grp: 0, back: Math.abs(ang) > 2 ? true : undefined }),
      // and the root of the curls, right by his head: a foe up close is hit too (the start of the lash)
      hb(b, c, tipAt(len * 0.12, ang), Math.max(0.42, o.r * 0.85), o.dmg * 0.72, o.kang, o.kbb * 0.8, o.kbg * 0.8, { sfx: 'slap', blood: (o.blood ?? 1) * 0.5, grp: 0, back: Math.abs(ang) > 2 ? true : undefined }),
    ],
  };
  return M;
}

// --- the basketball: thrown, it bounces off whoever it hits and comes back; X + down again just as it reaches him
// sends it back out faster (and it comes back faster), and so on. Missed, he pockets it. A dodge lets it through,
// a perfect guard sends it back (World.reflect): the loop is broken.
const BALL_V = 15, BALL_MAX = 36, BALL_OUT = 9; // m/s, m/s, metres out before it turns back
ENTITIES.bball = {
  stepExtra(e, W) {
    const F = W.fighters[e.owner];
    if (!F || F.out || F.state === 'dead' || F.state === 'respawn') { e.dead = true; return; }
    const sp = e.sp || BALL_V;
    if (!e.back && (Math.abs(e.x - e.x0) > BALL_OUT || e.t > 70)) e.back = 1;
    if (e.back) {
      // home in on his chest
      const dx = F.x - e.x, dy = F.y + 1.2 - e.y, d = DMath.hypot(dx, dy) || 1e-3;
      e.vx += ((dx / d) * sp - e.vx) * 0.35; e.vy += ((dy / d) * sp - e.vy) * 0.35;
      e.dir = e.vx < 0 ? -Math.PI / 2 : Math.PI / 2;
      if (d < 0.8) {
        // caught: relaunched if he is throwing it back right now, else pocketed
        if (F.state === 'move' && F.move === 'sp_d2' && F.mv.ball === e.id) { F.mv.got = 1; e.noHit = true; e.hold = 1; }
        else if (!e.hold) { e.dead = true; W.emit('bballPocket', { s: F.slot, x: e.x, y: e.y, z: e.z }); }
      }
    }
    if (e.hold) { const p = localToWorld(F, [0, 1.25, 0.55]); e.x = p[0]; e.y = p[1]; e.vx = 0; e.vy = 0; e.life = Math.max(e.life, 30); }
  },
  onHitFighter(e, V, W) {
    // it bounces off the body and heads back to him
    e.back = 1;
    e.vx = -e.vx * 0.6; e.vy = Math.abs(e.vy) * 0.3 + 3;
    W.emit('bounceProj', { id: e.id, x: e.x, y: e.y, z: e.z, k: 'basketball' });
  },
  onShield(e, V, W) { e.back = 1; e.vx = -e.vx * 0.5; e.vy = 4; W.emit('bounceProj', { id: e.id, x: e.x, y: e.y, z: e.z, k: 'basketball' }); },
};
const myBall = (F, W) => W.entities.find((e) => e.kind === 'proj' && e.custom === 'bball' && !e.dead && e.owner === F.slot);
// the ball on its way back, close enough to be sent back out
function ballToRelaunch(F, W) {
  const e = myBall(F, W);
  return e && e.back && !e.hold && DMath.hypot(F.x - e.x, F.y + 1.2 - e.y) < 3.2 ? e : null;
}
function throwBall(F, W, e) {
  const n = e ? (e.n || 0) + 1 : 0;
  const sp = Math.min(BALL_MAX, BALL_V * Math.pow(1.2, n));
  const props = { look: 'basketball', custom: 'bball', r: 0.4, dmg: Math.min(12, 5 + n * 1.2), ang: 40, kbb: 12 + n * 2, kbg: 26 + n * 4,
    life: 200, grav: 0, spin: 14, sfx: 'bounceBall', blood: 0.4, pierce: true, rehit: 18, hitlag: 0.6, sp, n, back: 0 };
  const p = localToWorld(F, [0, 1.25, 0.6]);
  if (e) {
    Object.assign(e, props, { x: p[0], y: p[1], vx: DMath.sin(F.facing) * sp, vy: 0, dir: F.facing, noHit: false, hold: 0, x0: p[0], t: 0 });
    W.emit('bballRelaunch', { s: F.slot, n, x: p[0], y: p[1], z: 0 });
    return e;
  }
  const b = shoot(W, F, 'proj', sp, props, [0, 1.25, 0.6], F.facing, 0);
  b.x0 = b.x;
  return b;
}

const moves = {
  ...normals({ power: 1.0, reach: 1.1, speed: 1.0, sfxS: 'slap', sfxM: 'whip', sfxL: 'hitL' }),
  // A while running: its own dash attack
  dashattack: dashAttack({ pose: 'layup', boost: 11, fric: 22, dur: 36, onFrame(F) { F.va[1] = F.mf < 22 ? 1 : 0; }, onEnd(F) { F.va[1] = 0; }, hits: [hb(7, 11, [0, 1.8, 0.7], 0.85, 10, 82, 50, 66, { sfx: 'hitL', blood: 1.2, dir: 'radial' })] }),

  // neutral A: two flicks of the curls, then a long lash
  jab1: lash({ dur: 18, iasa: 15, next: 'jab2', nextWin: [6, 17], pose: 'jab1', a: 2, b: 4, c: 6, d: 11, len: 0.95, ang: -0.12, r: 0.45, dmg: 3.3, kang: 30, kbb: 8, kbg: 18 }),
  jab2: lash({ dur: 18, iasa: 15, next: 'jab3', nextWin: [6, 17], pose: 'jab2', a: 2, b: 4, c: 6, d: 11, len: 1.1, ang: 0.12, r: 0.45, dmg: 3.3, kang: 30, kbb: 8, kbg: 18 }),
  jab3: lash({ dur: 30, iasa: 27, pose: 'jab3', a: 4, b: 7, c: 10, d: 18, len: 1.75, ang: 0, r: 0.55, dmg: 6.5, kang: 40, kbb: 34, kbg: 86, blood: 1.1 }),
  // the tilts: the curls straight out, up in an arc, low along the floor
  ftilt: lash({ dur: 28, iasa: 24, pose: 'ftilt', a: 4, b: 8, c: 10, d: 18, len: 2.0, ang: 0.02, r: 0.55, dmg: 8.5, kang: 36, kbb: 20, kbg: 72 }),
  utilt: lash({ dur: 26, iasa: 20, pose: 'headbuttUp', a: 3, b: 7, c: 11, d: 18, len: 1.35, ang: 1.1, r: 0.62, dmg: 7, kang: 88, kbb: 26, kbg: 66, extra: { dir: 'radial' } }),
  dtilt: lash({ dur: 22, iasa: 17, pose: 'dsmash', a: 3, b: 6, c: 8, d: 15, len: 1.6, ang: -0.55, r: 0.5, dmg: 5.5, kang: 74, kbb: 22, kbg: 48 }),
  // side smash: he throws his head forward and the curls shoot out far like a whip, the tip hits hardest
  smash: lash({ dur: 46, pose: 'headbutt', tilt: 'ftilt', charge: { at: 8, max: 60 }, a: 9, b: 14, c: 17, d: 27, len: 3.2, ang: 0, r: 0.75, dmg: 17, kang: 36, kbb: 42, kbg: 106, blood: 2.2, hitlag: 1.2 }),
  // up smash: the slam dunk
  usmash: {
    dur: 44, charge: { at: 6, max: 60 }, pose: 'usmash', tilt: 'utilt',
    vel: [{ f: [9, 10], up: 7 }],
    onFrame(F, W, f) { F.va[1] = f >= 4 && f <= 22 ? 1 : 0; },
    hits: [
      hb(12, 16, [0, 2.6, 0.4], 1.0, 17, 86, 40, 104, { sfx: 'hitL', blood: 2, dir: 'radial', fx: 'dunk' }),
      hb(12, 14, [0, 1.2, 0.6], 0.8, 12, 80, 32, 90, { sfx: 'hitM', blood: 1.4, grp: 0, dir: 'radial' }),
    ],
    onEnd(F) { F.va[1] = 0; },
  },
  // down smash: head down, the curls pour onto the floor and spread out on both sides
  dsmash: {
    dur: 46, charge: { at: 6, max: 60 }, pose: 'dsmash', tilt: 'dtilt',
    onFrame(F, W, f) {
      F.va[6] = f < 8 ? 0 : f < 11 ? ((f - 7) / 3) * 2.2 : f <= 16 ? 2.2 : f < 26 ? 2.2 * (1 - (f - 16) / 10) : 0;
      if (f === 9) W.emit('sfx', { s: F.slot, n: 'whip' });
    },
    hits: [
      hb(11, 16, [0, 0.3, 2.35], 0.55, 14, 28, 36, 100, { sfx: 'whip', blood: 1.6, dir: 'away', hitlag: 1.1 }),
      hb(11, 16, [0, 0.3, -2.35], 0.55, 14, 28, 36, 100, { sfx: 'whip', blood: 1.6, dir: 'away', grp: 0 }),
      hb(11, 16, [0, 0.3, 1.3], 0.5, 10, 30, 30, 84, { sfx: 'slap', blood: 1.1, dir: 'away', grp: 0 }),
      hb(11, 16, [0, 0.3, -1.3], 0.5, 10, 30, 30, 84, { sfx: 'slap', blood: 1.1, dir: 'away', grp: 0 }),
    ],
    onEnd(F) { F.va[6] = 0; },
  },
  // the aerials: the curls spun all around, lashed forward, behind, up, and straight down (the spike)
  nair: {
    air: true, dur: 34, landLag: 5, iasa: 30, pose: 'nair', combo: true,
    onFrame(F, W, f) { F.va[2] = f >= 4 && f <= 20 ? (f - 4) * 0.55 : 0; if (f === 4) W.emit('sfx', { s: F.slot, n: 'whip' }); },
    onEnd(F) { F.va[2] = 0; },
    hits: [
      hb(5, 9, [0, 0.8, 1.15], 0.6, 8, 40, 24, 80, { sfx: 'whip', blood: 1.1, dir: 'away' }),
      hb(5, 9, [0, 0.8, -1.15], 0.6, 8, 40, 24, 80, { sfx: 'whip', blood: 1.1, dir: 'away', grp: 0 }),
      hb(10, 19, [0, 0.8, 1.15], 0.55, 4.5, 40, 18, 66, { sfx: 'slap', blood: 0.7, dir: 'away', grp: 1 }),
      hb(10, 19, [0, 0.8, -1.15], 0.55, 4.5, 40, 18, 66, { sfx: 'slap', blood: 0.7, dir: 'away', grp: 1 }),
    ],
  },
  fair: lash({ air: true, dur: 36, landLag: 7, iasa: 31, pose: 'fair', a: 5, b: 9, c: 12, d: 20, len: 1.6, ang: -0.2, r: 0.58, dmg: 12, kang: 40, kbb: 34, kbg: 98, blood: 1.5 }),
  bair: lash({ air: true, dur: 36, landLag: 7, iasa: 31, pose: 'bair', a: 4, b: 8, c: 11, d: 19, len: 1.6, ang: Math.PI, r: 0.6, dmg: 13, kang: 36, kbb: 36, kbg: 104, blood: 1.6, hitlag: 1.1 }),
  uair: lash({ air: true, dur: 30, landLag: 5, iasa: 26, pose: 'uair', a: 3, b: 6, c: 10, d: 16, len: 1.4, ang: Math.PI / 2, r: 0.6, dmg: 9, kang: 85, kbb: 30, kbg: 86, extra: { dir: 'radial' } }),
  dair: lash({ air: true, dur: 40, landLag: 10, iasa: 36, pose: 'dair', a: 6, b: 10, c: 16, d: 24, len: 1.3, ang: -Math.PI / 2, r: 0.85, dmg: 12, kang: -80, kbb: 26, kbg: 84, blood: 1.8, hitlag: 1.3, spike: 1 }),

  // Réflecteur magique (X maintenu) : un bouclier d'énergie autour de lui qui renvoie les projectiles, comme celui
  // de Fox ; il repousse un peu en sortant
  sp_n: {
    dur: 24, iasa: 22, pose: 'shield', airCtrl: 0.4, noGrav: [0, 999],
    onStart(F, W) { F.mv.held = 0; W.emit('reflectorOn', { s: F.slot }); },
    onFrame(F, W, f) {
      F.va[3] = f < 2 ? 0.6 : f < 16 ? 1 : Math.max(0, 1 - (f - 15) / 6);
      if (!F.grounded) { F.vx *= 0.9; F.vy = Math.max(F.vy - 0.25, -2.5); } // he hovers a little while it is up
      // held: it stays up (up to 3 s)
      if (f === 8 && xHeld(F) && F.mv.held < 180) { F.mv.held++; F.mf = 7; }
      if (f >= 2 && f <= 15) {
        // every enemy projectile that reaches it goes back where it came from
        const cx = F.x, cy = F.y + 1.0;
        for (const e of W.entities) {
          if (e.kind !== 'proj' || e.dead || e.owner === F.slot || e.owner < 0) continue;
          const nx = e.x + (e.vx || 0) * DT, ny = e.y + (e.vy || 0) * DT;
          if (DMath.hypot(e.x - cx, e.y - cy) < 1.35 + e.r || DMath.hypot(nx - cx, ny - cy) < 1.35 + e.r) {
            W.reflect(e, F, W.fighters[e.owner], e.x, e.y, e.z);
            W.emit('reflectorHit', { s: F.slot, x: e.x, y: e.y, z: e.z });
          }
        }
      }
    },
    onEnd(F) { F.va[3] = 0; },
    hits: [hb(2, 3, [0, 1.0, 0], 1.2, 3, 60, 30, 10, { sfx: 'zap', blood: 0, dir: 'radial', fx: 'zap' })],
  },

  // Boucles-grappin : la chevelure part loin, ramène l'ennemi accroché devant lui, immobilisé un instant (le temps
  // d'enchaîner), ou accroche le bord
  sp_s: {
    dur: 44, pose: 'smash', airCtrl: 0.2, noGrav: [0, 24], ledgeGrab: true,
    onStart(F) { F.mv.len = 0; F.mv.caught = -1; if (!F.grounded) F.vy = Math.max(F.vy, 0) * 0.3; },
    onFrame(F, W, f) {
      F.va[5] = 0;
      if (!F.grounded) { F.vx *= 0.9; if (F.vy < 0) F.vy *= 0.6; }
      if (f === 4) W.emit('sfx', { s: F.slot, n: 'whip' });
      if (F.mv.zip) {
        const dx = F.mv.tx - F.x, dy = F.mv.ty - F.y, d = DMath.hypot(dx, dy);
        F.va[0] = Math.max(0, d - 0.4);
        if (d < 1.1 || f > 40) { F.mv.zip = 0; F.vx = 0; F.vy = 0; endMove(F, W); return; }
        F.vx = (dx / d) * 22; F.vy = (dy / d) * 22;
        return;
      }
      // reeling in the one it caught: carried on the tip of the curls until it stands right in front of him
      if (F.mv.caught >= 0) {
        const V = W.fighters[F.mv.caught];
        F.mv.len = Math.max(0.55, F.mv.len - 0.6);
        F.va[0] = F.mv.len;
        if (V && !V.out && V.state !== 'dead' && V.state !== 'respawn') {
          const tip = tipAt(F.mv.len, 0);
          V.carryBy = F.slot; V.carryT = 3; V.carryX = DMath.sin(F.facing) * tip[2]; V.carryY = tip[1] - 1.05;
          V.hitstun = Math.max(V.hitstun, 4);
          if (F.mv.len <= 0.55) {
            V.carryT = 0;
            if (stunFor(V, 28)) W.emit('hairBind', { s: V.slot, x: V.x, y: V.y + 1, z: V.z });
            F.mv.caught = -1; F.mv.len = 0.55; F.mf = Math.max(F.mf, 34); // a short end: the combo is his
          }
        } else F.mv.caught = -1;
        return;
      }
      if (f >= 5 && f <= 20) {
        F.mv.len = Math.min(7, F.mv.len + 0.6);
        F.va[0] = F.mv.len;
        const tip = hairTip(F, F.mv.len);
        // catches whoever it touches
        W.addHit({ owner: F.slot, key: 'ah' + F.mseq, x: tip[0], y: tip[1], z: 0, r: 0.55, dmg: 6, ang: 20, fkb: 12,
          dir: 'in', ox: F.x, oz: 0, sfx: 'whip', blood: 0.8, move: 'sp_s', hitlag: 0.8, onHit: (V) => { if (V) F.mv.caught = V.slot; } });
        // tether: the curls reach the edge of the platform while he is off stage
        if (!F.grounded) {
          const m = W.stage.main();
          const top = W.stage.heightAt(m, tip[0], 0);
          if (Math.abs(Math.abs(tip[0] - m.cx) - m.r) < 1.0 && tip[1] > top - 2.4 && tip[1] < top + 1.0 && Math.abs(F.x - m.cx) > m.r - 0.3) {
            const nx = tip[0] < m.cx ? -1 : 1;
            F.mv.zip = 1; F.mv.tx = m.cx + nx * (m.r + 0.3); F.mv.ty = top - 1.3;
            F.jumps = Math.max(F.jumps, 1);
          }
        }
      } else if (f > 20) { F.mv.len = Math.max(0, Math.min(F.mv.len, 7) - 0.7); F.va[0] = F.mv.len; }
    },
    onEnd(F, W) { F.va[0] = 0; const V = W && W.fighters[F.mv.caught]; if (V && V.carryBy === F.slot) V.carryT = 0; },
  },

  // Panier ! : la passe à deux mains ; le ballon rebondit sur l'ennemi et revient. X + bas au moment où il revient
  // le relance, plus vite à chaque fois ; raté, il l'empoche.
  sp_d: {
    dur: 34, iasa: 28, pose: 'throw1', airCtrl: 0.5,
    cdBypass: (F, W) => !!ballToRelaunch(F, W),
    onStart(F, W) {
      const e = ballToRelaunch(F, W);
      if (e) { startMove(F, W, 'sp_d2', { keepFacing: true }); F.mv.ball = e.id; }
    },
    onFrame(F, W, f) {
      F.va[1] = f < 10 ? 1 : 0;
      if (f === 10) {
        if (myBall(F, W)) return; // one ball at a time
        throwBall(F, W, null);
        W.emit('sfx', { s: F.slot, n: 'throw' });
      }
    },
    onEnd(F) { F.va[1] = 0; },
  },
  // the ball sent back out (started from sp_d): caught on the chest, thrown at once, harder
  sp_d2: {
    dur: 18, iasa: 14, pose: 'throw1', airCtrl: 0.6, noCd: true,
    onFrame(F, W, f) {
      const e = W.entities.find((x) => x.id === F.mv.ball && !x.dead);
      F.va[1] = f < 6 && (F.mv.got || f < 3) ? 1 : 0;
      if (!e) return;
      // the ball still on its way in: it has those frames to reach his hands
      if (f >= 6 && !F.mv.got) { if (f > 9) { e.dead = true; W.emit('bballPocket', { s: F.slot, x: e.x, y: e.y, z: e.z }); F.mv.ball = -1; } else F.mf = 5; return; }
      if (f === 6 && F.mv.got) { throwBall(F, W, e); F.mv.ball = -1; }
    },
    onEnd(F, W) { F.va[1] = 0; const e = W && W.entities.find((x) => x.id === F.mv.ball && !x.dead); if (e && e.hold) { e.dead = true; } },
  },

  // Tapis volant : assis en tailleur sur son tapis, il monte en se dirigeant ; un ennemi pris dedans reste coincé
  // sur le tapis (les coups l'emportent), le dernier l'éjecte. Près d'un bord, ses boucles s'y accrochent et le tirent
  sp_u: {
    dur: 72, pose: 'jupiter', helpless: true, noGrav: [4, 58], airCtrl: 0.3, ledgeGrab: true,
    onFrame(F, W, f) {
      if (f === 4) { F.grounded = false; W.emit('sfx', { s: F.slot, n: 'carpet' }); }
      if (f >= 4 && f <= 58) {
        if (!F.mv.L && f >= 10) { const L = nearestLedge(W, F, 6.5); if (L && L.y > F.y - 0.5) { F.mv.L = L; W.emit('sfx', { s: F.slot, n: 'whip' }); } }
        if (F.mv.L) { const d = pullTo(F, F.mv.L, 20); F.va[0] = Math.min(6, d + 0.5); F.va[5] = 0; }
        else {
          F.va[4] = 1;
          F.vy = 12.5 - Math.max(0, f - 40) * 0.35 + F.my * 3;
          steerX(F, 8.5, 0.12);
        }
      } else { F.va[4] = Math.max(0, F.va[4] - 0.08); F.va[0] = Math.max(0, F.va[0] - 0.6); }
    },
    hits: [
      // a little magnetic on the way up: whoever it touches is caught on the carpet, next to him
      hb(5, 8, [0, 0.4, 0.3], 1.25, 3, 85, 10, 10, { sfx: 'slap', blood: 0.5, drag: [0.55, 0.15, 14] }),
      hb(11, 46, [0, 0.4, 0.3], 1.1, 1.0, 85, 10, 10, { sfx: 'hitS', blood: 0.3, drag: [0.55, 0.15, 14], rehit: 6, grp: 1 }),
      // ...and thrown off it at the top
      hb(48, 50, [0, 0.6, 0.4], 1.25, 4, 78, 46, 86, { sfx: 'hitL', blood: 1.2, dir: 'radial', grp: 2 }),
    ],
    onEnd(F) { F.va[4] = 0; F.va[0] = 0; },
  },
};

export default {
  id: 'aboueb', name: 'Aboueb', title: 'Les boucles, le dunk, le tapis volant.',
  color: '#e8412c',
  stats: { weight: 100, runSpeed: 9.0, walkSpeed: 3.8, airSpeed: 6.6, airAccel: 34, groundAccel: 70, friction: 46,
    jumpVel: 16, airJumpVel: 14, airJumps: 1, gravity: 1.0, fallSpeed: 17.5, height: 1.85, radius: 0.52 },
  moves,
  bot: { reflect: true, noN: true }, // the reflector only against projectiles
  specialsInfo: { n: 'Réflecteur magique (maintenir)', s: 'Boucles-grappin', u: 'Tapis volant', d: 'Panier ! (le ballon revient : X + bas pour le relancer)' },
};
