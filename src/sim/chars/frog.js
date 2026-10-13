// Croâssassin, la grenouille : tout à la langue. Léger, sauts énormes (2 sauts en l'air).
import { normals, hb, lunge } from '../kit.js';
import { startMove, startGrab, setState, endMove } from '../fighter.js';
import { localToWorld, clamp } from '../util.js';

const TONGUE_H = 0.95;

function tongueTip(F, len, elev = 0) {
  const fx = Math.sin(F.facing), fz = Math.cos(F.facing);
  return [F.x + fx * (0.45 + len), F.y + TONGUE_H + elev * len, F.z + fz * (0.45 + len)];
}

function enemyAt(W, F, p, r) {
  for (const V of W.list) {
    if (V === F || V.out || V.state === 'dead' || V.state === 'respawn' || V.intangible > 0 || V.invuln > 0) continue;
    if (Math.hypot(V.x - p[0], V.z - p[2]) < r + V.radius && p[1] > V.y - 0.2 && p[1] < V.y + V.height + 0.2) return V;
  }
  return null;
}

const moves = {
  ...normals({ power: 0.92, reach: 1.05, speed: 1.1, sfxS: 'slap', sfxM: 'hitM', sfxL: 'hitL' }),

  // Langue-fouet : la langue claque loin devant (bout = coup sec)
  sp_n: {
    dur: 36, iasa: 34, pose: 'tongue', airCtrl: 0.5,
    onFrame(F, W, f) {
      const out = f < 6 ? 0 : f < 13 ? (f - 5) / 7 : f < 20 ? 1 - (f - 12) / 8 : 0;
      F.va[0] = out * 4.4;
      if (f === 6) W.emit('sfx', { s: F.slot, n: 'tongue' });
      if (f >= 10 && f <= 14) {
        const tip = tongueTip(F, F.va[0]);
        W.addHit({ owner: F.slot, key: `fn${F.mseq}`, x: tip[0], y: tip[1], z: tip[2], r: 0.55, dmg: 9, ang: 35, kbb: 34, kbg: 72,
          dir: 'face', dirAngle: F.facing, ox: F.x, oz: F.z, sfx: 'whip', blood: 1.6, move: 'sp_n', hitlag: 1.2 });
        const mid = tongueTip(F, F.va[0] * 0.5);
        W.addHit({ owner: F.slot, key: `fn${F.mseq}`, x: mid[0], y: mid[1], z: mid[2], r: 0.4, dmg: 4, ang: 30, kbb: 18, kbg: 40,
          dir: 'face', dirAngle: F.facing, ox: F.x, oz: F.z, sfx: 'slap', blood: 0.8, move: 'sp_n' });
      }
    },
    onEnd(F) { F.va[0] = 0; },
  },

  // Langue-grappin : attrape un ennemi au loin et le ramène dans la bouche, ou tire la grenouille vers le bord
  sp_s: {
    dur: 40, pose: 'tongue', airCtrl: 0.2, noGrav: [0, 22], ledgeGrab: true,
    onStart(F) { F.vy = Math.max(F.vy, 0) * 0.3; F.mv.len = 0; F.mv.hit = 0; },
    onFrame(F, W, f) {
      if (!F.grounded) { F.vx *= 0.9; F.vz *= 0.9; if (F.vy < 0) F.vy *= 0.6; }
      if (f === 3) W.emit('sfx', { s: F.slot, n: 'tongue' });
      if (F.mv.zip) {
        // pulled toward the ledge point
        const dx = F.mv.tx - F.x, dz = F.mv.tz - F.z, dy = F.mv.ty - F.y;
        const d = Math.hypot(dx, dy, dz);
        F.va[0] = Math.max(0, d - 0.4);
        if (d < 1.2 || f > 34) { F.mv.zip = 0; F.vx = F.vz = 0; F.vy = 0; endMove(F, W); return; }
        const sp = 24;
        F.vx = (dx / d) * sp; F.vz = (dz / d) * sp; F.vy = (dy / d) * sp;
        return;
      }
      if (f >= 4 && f <= 18) {
        F.mv.len = Math.min(6.8, F.mv.len + 0.62);
        F.va[0] = F.mv.len;
        const tip = tongueTip(F, F.mv.len, F.grounded ? 0 : 0.1);
        const V = enemyAt(W, F, tip, 0.55);
        if (V && V.state !== 'shield' && V.grabbedBy < 0) {
          startGrab(F, V, W);
          startMove(F, W, 'sp_s_pull', { victim: V.slot, keepFacing: true, len: F.mv.len });
          W.emit('sfx', { s: F.slot, n: 'slurp' });
          return;
        }
        if (V && V.state === 'shield') { V.shield -= 6; W.emit('shieldHit', { s: V.slot, a: F.slot, x: tip[0], y: tip[1], z: tip[2], d: 4 }); F.mv.len = 99; }
        // tether: the tip reaches the platform rim while the frog is off stage
        if (!F.grounded) {
          const m = W.stage.main();
          const d = Math.hypot(tip[0] - m.cx, tip[2] - m.cz);
          const top = W.stage.heightAt(m, tip[0], tip[2]);
          if (Math.abs(d - m.r) < 1.0 && tip[1] > top - 2.2 && tip[1] < top + 1.0 && Math.hypot(F.x - m.cx, F.z - m.cz) > m.r - 0.3) {
            const nx = (tip[0] - m.cx) / d, nz = (tip[2] - m.cz) / d;
            F.mv.zip = 1; F.mv.tx = m.cx + nx * (m.r + 0.3); F.mv.tz = m.cz + nz * (m.r + 0.3); F.mv.ty = top - 1.3;
            F.jumps = Math.max(F.jumps, 1);
            W.emit('sfx', { s: F.slot, n: 'slurp' });
          }
        }
        if (F.mv.len >= 99) F.mv.len = 6.8;
      } else if (f > 18) {
        F.mv.len = Math.max(0, F.mv.len - 0.8);
        F.va[0] = F.mv.len;
      }
    },
    onEnd(F) { F.va[0] = 0; },
  },
  sp_s_pull: {
    dur: 12, pose: 'tongue',
    onFrame(F, W, f) {
      const V = W.fighters[F.mv.victim];
      if (!V || V.grabbedBy !== F.slot) { endMove(F, W); return; }
      const len = F.mv.len * (1 - f / 11);
      F.va[0] = len;
      const tip = tongueTip(F, Math.max(0.6, len));
      V.x = tip[0]; V.z = tip[2]; V.y = F.y + 0.25 + len * 0.05;
      if (f >= 11) {
        F.move = null; F.va[0] = 0;
        setState(F, 'grabbing'); F.grabbing = V.slot; F.grabT = 0; F.mv = { pummel: 0 };
      }
    },
  },

  // Super bond : saut géant en vrille, coups de pattes
  sp_u: {
    dur: 34, pose: 'frogleap', helpless: true, airCtrl: 0.8, ledgeGrab: true,
    onFrame(F, W, f) {
      if (f === 3) { F.vy = 22; F.grounded = false; W.emit('sfx', { s: F.slot, n: 'boing' }); W.emit('dust', { x: F.x, y: F.y, z: F.z, n: 10 }); }
      if (f > 3) F.va[1] = (F.va[1] + 0.6) % (Math.PI * 2);
    },
    hits: [
      hb(4, 16, [0, 0.8, 0], 1.0, 2.2, 80, 0, 0, { fkb: 40, rehit: 5, sfx: 'slap', blood: 0.6, dir: 'radial' }),
      hb(18, 21, [0, 0.6, 0.3], 1.1, 6, 50, 40, 70, { sfx: 'hitM', blood: 1.4, grp: 3 }),
    ],
  },

  // Gobe et crache : avale l'ennemi, le garde dans le bide, le recrache comme un missile
  sp_d: {
    dur: 34, pose: 'gulp',
    onFrame(F, W, f) {
      if (f === 4) W.emit('sfx', { s: F.slot, n: 'gulp' });
      F.va[2] = f >= 5 && f <= 14 ? 0.5 : 0;
      if (f >= 6 && f <= 13) {
        const p = localToWorld(F, [0, 0.9, 0.95]);
        const V = enemyAt(W, F, p, 0.75);
        if (V && V.state !== 'shield' && V.grabbedBy < 0 && V.grabbing < 0) {
          startGrab(F, V, W);
          startMove(F, W, 'sp_d_hold', { victim: V.slot, keepFacing: true });
          W.emit('swallow', { s: F.slot, v: V.slot });
        }
      }
    },
  },
  sp_d_hold: {
    dur: 80, pose: 'full', airCtrl: 0.5, groundFric: 20,
    onFrame(F, W, f, I) {
      const V = W.fighters[F.mv.victim];
      if (!V || V.grabbedBy !== F.slot) { endMove(F, W); return; }
      V.x = F.x; V.y = F.y + 0.3; V.z = F.z;
      F.va[2] = 1 + Math.sin(f * 0.6) * 0.15;
      if (F.grounded) {
        const mag = Math.hypot(F.mx, F.my);
        if (mag > 0.2) { const a = Math.atan2(F.mx, -F.my); F.facing = a; F.vx = Math.sin(a) * 3; F.vz = Math.cos(a) * 3; }
      }
      if (f % 15 === 0) { V.damage += 1; W.emit('sfx', { s: F.slot, n: 'gurgle' }); }
      const spit = f > 16 && (F.bufX > 0 || F.bufA > 0);
      if (spit || f >= 78 || V.mv.escape <= 0) {
        F.bufX = F.bufA = 0;
        V.grabbedBy = -1; F.grabbing = -1;
        const p = localToWorld(F, [0, 0.9, 0.9]);
        V.x = p[0]; V.y = p[1]; V.z = p[2];
        setState(V, 'air');
        W.hitDirect(F, V, { dmg: spit ? 11 : 5, ang: 22, kbb: spit ? 55 : 35, kbg: spit ? 72 : 30, sfx: 'spit', blood: 1.4, dir: 'face', dirAngle: F.facing, fx: 'slime', key: 'spit' + F.mseq });
        W.emit('spit', { s: F.slot, v: V.slot });
        F.va[2] = 0;
        F.move = 'sp_d_end'; F.mf = 0; F.mv = {};
      }
    },
  },
  sp_d_end: { dur: 14, pose: 'gulp' },
};

export default {
  id: 'frog', name: 'Croâssassin', title: 'La grenouille à la langue qui tue',
  color: '#5ad13b',
  stats: { weight: 82, runSpeed: 8.8, walkSpeed: 3.8, airSpeed: 6.8, airAccel: 38, groundAccel: 75, friction: 46,
    jumpVel: 16.5, airJumpVel: 14, airJumps: 2, gravity: 0.95, fallSpeed: 17, height: 1.45, radius: 0.55 },
  moves,
  specialsInfo: {
    n: 'Langue-fouet', s: 'Langue-grappin (attrape ou s\'accroche au bord)', u: 'Super bond', d: 'Gobe et crache',
  },
};

export { clamp, lunge };
