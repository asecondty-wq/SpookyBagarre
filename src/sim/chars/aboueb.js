// Aboueb : maillot de basket, des cheveux bouclés qui s'allongent comme un fouet, du couscous en projectile
// et un tapis volant pour remonter.
import { normals, dashAttack, hb, shoot } from '../kit.js';
import { ENTITIES } from '../entities.js';
import { endMove } from '../fighter.js';
import { localToWorld } from '../util.js';
import { steerX, nearestLedge, pullTo, xAgain, xHeld } from './recovery.js';
import { DMath } from '../dmath.js';

// the plate of couscous: bursts where it lands, leaves a carpet of semolina (slippery)
ENTITIES.couscous = {
  onLand(e, W) { spill(e, W); },
  onHitFighter(e, V, W) { spill(e, W); },
};
function spill(e, W) {
  if (e.spilled) return;
  e.spilled = 1;
  W.addHit({ owner: e.owner, key: 'cs' + e.id, x: e.x, y: e.y + 0.4, z: 0, r: 1.5, dmg: 7, ang: 60, kbb: 30, kbg: 55, dir: 'radial',
    ent: e.id, src: 'proj', sfx: 'couscous', blood: 0.3, move: 'sp_n', fx: 'couscous' });
  W.spawn('puddle', { owner: e.owner, x: e.x, y: e.y, z: 0, r: 1.8, life: 420, look: 'couscous', safeOwner: true });
  W.emit('couscous', { x: e.x, y: e.y, z: 0 });
}

const HAIR_H = 1.45;
const hairTip = (F, len) => localToWorld(F, [0, HAIR_H, 0.35 + len]);

const moves = {
  ...normals({ power: 1.08, reach: 1.1, speed: 1.08, sfxS: 'slap', sfxM: 'whip', sfxL: 'hitL' }),
  // A while running: its own dash attack
  dashattack: dashAttack({ pose: 'layup', boost: 11, fric: 22, dur: 36, onFrame(F) { F.va[1] = F.mf < 22 ? 1 : 0; }, onEnd(F) { F.va[1] = 0; }, hits: [hb(7, 11, [0, 1.8, 0.7], 0.85, 10, 82, 50, 66, { sfx: 'hitL', blood: 1.2, dir: 'radial' })] }),

  // neutral A, last hit: a lash of hair
  jab3: {
    dur: 28, iasa: 26, pose: 'jab3',
    onFrame(F, W, f) { F.va[0] = f >= 4 && f <= 12 ? Math.min(1.6, (f - 3) * 0.4) : Math.max(0, F.va[0] - 0.3); },
    hits: [hb(6, 9, [0, HAIR_H, 1.4], 0.75, 5, 40, 32, 84, { sfx: 'whip', blood: 1.1 })],
  },
  // side smash: the hair shoots out far like a whip, the tip hits hardest
  smash: {
    dur: 46, charge: { at: 8, max: 60 }, pose: 'smash', tilt: 'ftilt',
    onFrame(F, W, f) {
      const out = f < 12 ? 0 : f < 17 ? (f - 11) / 5 : f < 26 ? 1 - (f - 16) / 10 : 0;
      F.va[0] = out * 3.2;
      if (f === 12) W.emit('sfx', { s: F.slot, n: 'whip' });
    },
    hits: [
      hb(14, 17, [0, HAIR_H, 3.2], 0.8, 16, 36, 40, 98, { sfx: 'whip', blood: 2.2, hitlag: 1.2 }),
      hb(14, 17, [0, HAIR_H, 1.8], 0.7, 11, 38, 32, 84, { sfx: 'slap', blood: 1.2, grp: 0 }),
    ],
  },
  // up smash: the slam dunk
  usmash: {
    dur: 44, charge: { at: 6, max: 60 }, pose: 'usmash', tilt: 'utilt',
    vel: [{ f: [9, 10], up: 7 }],
    onFrame(F, W, f) { F.va[1] = f >= 4 && f <= 22 ? 1 : 0; },
    hits: [
      hb(12, 16, [0, 2.6, 0.4], 1.1, 16, 86, 38, 96, { sfx: 'hitL', blood: 2, dir: 'radial', fx: 'dunk' }),
      hb(12, 14, [0, 1.2, 0.6], 0.9, 12, 80, 32, 90, { sfx: 'hitM', blood: 1.4, grp: 0, dir: 'radial' }),
    ],
    onEnd(F) { F.va[1] = 0; },
  },
  // down smash: he spins his head, the long curls sweep both sides
  dsmash: {
    dur: 46, charge: { at: 6, max: 60 }, pose: 'dsmash', tilt: 'dtilt',
    onFrame(F, W, f) { F.va[2] = f >= 8 && f <= 20 ? (f - 8) * 0.6 : 0; },
    hits: [
      hb(10, 15, [0, 0.7, 1.6], 0.85, 13, 28, 34, 92, { sfx: 'whip', blood: 1.6, dir: 'away' }),
      hb(10, 15, [0, 0.7, -1.6], 0.85, 13, 28, 34, 92, { sfx: 'whip', blood: 1.6, dir: 'away', grp: 0 }),
    ],
    onEnd(F) { F.va[2] = 0; },
  },

  // Couscous royal : une assiette lancée en cloche, elle éclate et laisse de la semoule glissante
  sp_n: {
    dur: 36, iasa: 32, pose: 'throw2', airCtrl: 0.5,
    onFrame(F, W, f) {
      F.va[3] = f < 12 ? 1 : 0;
      if (f === 12) {
        shoot(W, F, 'proj', 10.5, { look: 'couscous', custom: 'couscous', r: 0.45, dmg: 4, ang: 45, kbb: 12, kbg: 20, life: 120, grav: 1.0, spin: 8, sfx: 'couscous', blood: 0.2 }, [0, 1.6, 0.6], F.facing, 8.5);
        W.emit('sfx', { s: F.slot, n: 'throw' });
      }
    },
    onEnd(F) { F.va[3] = 0; },
  },

  // Boucles-grappin : la chevelure part loin, ramène l'ennemi accroché, ou accroche le bord
  sp_s: {
    dur: 44, pose: 'smash', airCtrl: 0.2, noGrav: [0, 24], ledgeGrab: true,
    onStart(F) { F.mv.len = 0; if (!F.grounded) F.vy = Math.max(F.vy, 0) * 0.3; },
    onFrame(F, W, f) {
      if (!F.grounded) { F.vx *= 0.9; if (F.vy < 0) F.vy *= 0.6; }
      if (f === 4) W.emit('sfx', { s: F.slot, n: 'whip' });
      if (F.mv.zip) {
        const dx = F.mv.tx - F.x, dy = F.mv.ty - F.y, d = DMath.hypot(dx, dy);
        F.va[0] = Math.max(0, d - 0.4);
        if (d < 1.1 || f > 40) { F.mv.zip = 0; F.vx = 0; F.vy = 0; endMove(F, W); return; }
        F.vx = (dx / d) * 22; F.vy = (dy / d) * 22;
        return;
      }
      if (f >= 5 && f <= 20) {
        F.mv.len = Math.min(7, F.mv.len + 0.6);
        F.va[0] = F.mv.len;
        const tip = hairTip(F, F.mv.len);
        // pulls whoever it catches back toward Aboueb
        W.addHit({ owner: F.slot, key: 'ah' + F.mseq, x: tip[0], y: tip[1], z: 0, r: 0.6, dmg: 7, ang: 18, fkb: 46,
          dir: 'in', ox: F.x, oz: 0, sfx: 'whip', blood: 1, move: 'sp_s', hitlag: 1, onHit: () => { F.mv.len = 99; } });
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
        if (F.mv.len >= 99) { F.mv.len = 7; F.mf = Math.max(F.mf, 20); }
      } else if (f > 20) { F.mv.len = Math.max(0, Math.min(F.mv.len, 7) - 0.7); F.va[0] = F.mv.len; }
    },
    onEnd(F) { F.va[0] = 0; },
  },

  // Panier ! : un ballon de basket qui rebondit partout
  sp_d: {
    dur: 34, iasa: 28, pose: 'throw1', airCtrl: 0.5,
    onFrame(F, W, f) {
      F.va[1] = f < 10 ? 1 : 0;
      if (f === 10) {
        shoot(W, F, 'proj', 12, { look: 'basketball', r: 0.38, dmg: 7, ang: 50, kbb: 24, kbg: 52, life: 150, grav: 1.2, bounce: 0.78, spin: 9, sfx: 'bounceBall', blood: 0.4, rehit: 30, pierce: true }, [0, 1.3, 0.6], F.facing, 3);
        W.emit('sfx', { s: F.slot, n: 'throw' });
      }
    },
    onEnd(F) { F.va[1] = 0; },
  },

  // Tapis volant : un long vol dirigeable ; près d'un bord, ses boucles s'y accrochent et le tirent
  sp_u: {
    dur: 90, pose: 'jupiter', helpless: true, noGrav: [4, 78], airCtrl: 0.3, ledgeGrab: true,
    onFrame(F, W, f) {
      if (f === 4) { F.grounded = false; W.emit('sfx', { s: F.slot, n: 'carpet' }); }
      if (f >= 4 && f <= 78) {
        if (!F.mv.L && f >= 10) { const L = nearestLedge(W, F, 6.5); if (L && L.y > F.y - 0.5) { F.mv.L = L; W.emit('sfx', { s: F.slot, n: 'whip' }); } }
        if (F.mv.L) { const d = pullTo(F, F.mv.L, 20); F.va[0] = Math.min(6, d + 0.5); }
        else {
          F.va[4] = 1;
          F.vy = 11.5 - Math.max(0, f - 50) * 0.3 + F.my * 3;
          steerX(F, 8.5, 0.12);
        }
      } else { F.va[4] = Math.max(0, F.va[4] - 0.08); F.va[0] = Math.max(0, F.va[0] - 0.6); }
    },
    hits: [hb(4, 10, [0, 0.2, 0.3], 1.1, 7, 72, 40, 60, { sfx: 'slap', blood: 0.8, dir: 'radial' })],
    onEnd(F) { F.va[4] = 0; F.va[0] = 0; },
  },
};

export default {
  id: 'aboueb', name: 'Aboueb', title: 'Le couscous, les boucles, le dunk.',
  color: '#e8412c',
  stats: { weight: 95, runSpeed: 9.0, walkSpeed: 3.8, airSpeed: 6.6, airAccel: 34, groundAccel: 70, friction: 46,
    jumpVel: 16, airJumpVel: 14, airJumps: 1, gravity: 1.0, fallSpeed: 17.5, height: 1.85, radius: 0.52 },
  moves,
  specialsInfo: { n: 'Couscous royal', s: 'Boucles-grappin', u: 'Tapis volant', d: 'Panier ! (ballon de basket)' },
};
