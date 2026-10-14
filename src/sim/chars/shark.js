// Tralalero Tralala : requin bleu sur trois pattes en Nike. Rapide, morsures sanglantes,
// et il plonge DANS la plateforme pour surgir sous ses victimes.
import { normals, dashAttack, hb, lunge } from '../kit.js';
import { endMove, setState } from '../fighter.js';
import { stickToWorld, faceOf } from '../util.js';
import { steerX, nearestLedge, pullTo, xAgain, xHeld } from './recovery.js';
import { DMath } from '../dmath.js';

const moves = {
  ...normals({ power: 1.11, reach: 1.06, speed: 1.0, sfxS: 'hitS', sfxM: 'chomp', sfxL: 'chompL' }),
  // A while running: its own dash attack
  dashattack: dashAttack({ pose: 'bite', boost: 14, fric: 18, dur: 34, hits: [hb(5, 9, [0, 1.0, 1.0], 0.85, 12, 35, 44, 76, { sfx: 'chompL', blood: 2 })] }),

  // Méga-morsure : il bondit mâchoire ouverte
  sp_n: {
    dur: 38, iasa: 34, pose: 'bite', airCtrl: 0.4,
    vel: [{ f: [6, 10], fwd: 9 }],
    onFrame(F, W, f) { if (f === 8) W.emit('sfx', { s: F.slot, n: 'jaws' }); },
    hits: [hb(9, 12, [0, 1.0, 1.05], 0.8, 13, 35, 40, 74, { sfx: 'chompL', blood: 3.2, hitlag: 1.5, fx: 'bite' })],
  },

  // Sprint en Nike : charge sur trois pattes, on peut tourner un peu (et tomber du bord...)
  sp_s: {
    dur: 40, iasa: 36, pose: 'sprint', noGrav: [0, 16], airCtrl: 0,
    onStart(F) { F.mv.sp = 18; if (!F.grounded) F.vy = Math.max(F.vy, 2); },
    onFrame(F, W, f) {
      if (f <= 30) {
        // 2D: pull the stick back hard to turn the sprint around (once)
        if (!F.mv.turned && f > 5 && Math.abs(F.mx) > 0.6 && Math.sign(F.mx) !== Math.sign(DMath.sin(F.facing))) { F.facing += Math.PI; F.mv.turned = 1; F.vx = 0; }
        const sp = f < 4 ? 10 : 18;
        lunge(F, sp);
        if (!F.grounded) F.vy = Math.max(F.vy - 0.4, -4);
        if (f % 4 === 0 && F.grounded) W.emit('dust', { x: F.x, y: F.y, z: F.z, n: 3 });
      } else { F.vx *= 0.8; F.vz *= 0.8; }
    },
    hits: [hb(4, 30, [0, 0.9, 0.85], 0.85, 9, 40, 46, 64, { sfx: 'chomp', blood: 1.8, rehit: 99 })],
  },

  // Geyser de Tralalero : une colonne d'eau le pousse longtemps vers le haut ; il nage dans les airs
  sp_u: {
    dur: 50, pose: 'breach', helpless: true, noGrav: [4, 26], airCtrl: 0.6, ledgeGrab: true,
    onFrame(F, W, f) {
      if (f === 4) { F.grounded = false; W.emit('geyser', { x: F.x, y: F.y, z: F.z }); W.emit('sfx', { s: F.slot, n: 'splash' }); }
      if (f >= 4 && f <= 26) { F.vy = 21; steerX(F, 7); if (f % 5 === 0) W.emit('geyser', { x: F.x, y: F.y - 1, z: F.z }); }
      if (f > 4) F.va[1] = (F.va[1] + 0.7) % (Math.PI * 2);
    },
    hits: [
      hb(4, 16, [0, 1.0, 0], 1.15, 2.5, 82, 0, 0, { fkb: 38, rehit: 5, sfx: 'chomp', blood: 1.2, dir: 'radial' }),
      hb(17, 20, [0, 1.3, 0.2], 1.2, 7, 70, 40, 74, { sfx: 'chompL', blood: 2.0, dir: 'radial', grp: 6 }),
    ],
  },

  // Aileron : il plonge dans la plateforme, nage dessous (seul l'aileron dépasse) et surgit sous l'ennemi
  sp_d: {
    dur: 140, pose: 'dive', fallMul: 2, groundFric: 0,
    onStart(F) { F.mv.ph = F.grounded ? 0 : -1; },
    onFrame(F, W, f, I) {
      const ph = F.mv.ph;
      if (ph === -1) { // falling first: dive on landing
        F.vy = Math.min(F.vy, -20);
        if (f > 60) endMove(F, W);
        return;
      }
      if (ph === 0) {
        F.vx *= 0.7; F.vz *= 0.7;
        F.va[0] = Math.min(1, f / 10);
        if (f >= 10) { F.mv.ph = 1; F.mv.t = 0; W.emit('submerge', { s: F.slot, x: F.x, y: F.y, z: F.z }); }
        return;
      }
      if (ph === 1) {
        F.intangible = 2;
        F.va[0] = 1;
        F.mv.t++;
        const mag = DMath.hypot(F.mx, F.my);
        const [dx, dz] = stickToWorld(F.mx, F.my, W.camYaw);
        if (mag > 0.2) { if (Math.abs(dx) > 0.2) F.facing = faceOf(dx); F.vx = (dx / mag) * 9.5 * Math.min(1, mag); F.vz = (dz / mag) * 9.5 * Math.min(1, mag); }
        else { F.vx *= 0.85; F.vz *= 0.85; }
        if (F.mv.t % 5 === 0) W.emit('wake', { s: F.slot, x: F.x, y: F.y, z: F.z, a: F.facing });
        if (!F.grounded) { F.mv.ph = 3; F.va[0] = 0; F.intangible = 0; setState(F, 'air'); F.move = null; W.emit('surface', { s: F.slot, x: F.x, y: F.y, z: F.z }); return; }
        if ((F.mv.t > 12 && (F.bufX > 0 || F.bufA > 0)) || F.mv.t > 100) {
          F.bufX = F.bufA = 0;
          F.mv.ph = 2; F.mf = 100;
          F.vy = 15; F.grounded = false; F.va[0] = 0;
          W.emit('surface', { s: F.slot, x: F.x, y: F.y, z: F.z, attack: 1 });
          W.emit('sfx', { s: F.slot, n: 'jaws' });
        } else F.mf = Math.min(F.mf, 50);
      }
    },
    onLand(F, W) {
      if (F.mv.ph === -1) { F.mv.ph = 0; F.mf = 0; return; }
      if (F.mv.ph === 2 && F.mf > 104) { F.mf = Math.max(F.mf, 126); }
    },
    hits: [hb(100, 106, [0, 1.0, 0.2], 1.35, 14, 85, 50, 82, { sfx: 'chompL', blood: 3.4, hitlag: 1.5, dir: 'radial', fx: 'bite' })],
    onEnd(F) { F.va[0] = 0; },
  },
};

export default {
  id: 'shark', name: 'Tralalero Tralala', title: 'Trois pattes, des Nike, aucune pitié',
  color: '#4aa8e8',
  stats: { weight: 108, runSpeed: 10.4, walkSpeed: 4.4, airSpeed: 6.0, airAccel: 30, groundAccel: 70, friction: 40,
    jumpVel: 14.5, airJumpVel: 12.5, airJumps: 1, gravity: 1.02, fallSpeed: 19, height: 1.6, radius: 0.7 },
  moves,
  specialsInfo: { n: 'Méga-morsure', s: 'Sprint en Nike', u: 'Saut du grand blanc', d: 'Aileron (nage sous la plateforme)' },
};
