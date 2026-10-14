// Il Parmigiano : un bloc de parmesan armé d'une râpe. Il se râpe lui-même pour attaquer :
// plus il râpe, plus il rapetisse (plus rapide, mais plus léger à éjecter). Il repousse avec le temps.
import { normals, dashAttack, hb, shoot } from '../kit.js';
import { ENTITIES } from '../entities.js';
import { localToWorld } from '../util.js';
import { DT } from '../constants.js';
import { steerX, nearestLedge, pullTo, xAgain, xHeld } from './recovery.js';
import { DMath } from '../dmath.js';

const MIN_SIZE = 0.65;
const shrink = (F, k) => { F.size = Math.max(MIN_SIZE, F.size - k); };

// boomerang shard: flies out, then comes back to its owner
ENTITIES.boomerang = {
  stepExtra(e, W) {
    const F = W.fighters[e.owner];
    if (!F) return;
    if (e.t > (e.outT || 18)) {
      const dx = F.x - e.x, dy = F.y + 1.1 - e.y, dz = F.z - e.z, d = DMath.hypot(dx, dy, dz) || 1;
      const sp = Math.min(22, 8 + (e.t - (e.outT || 18)) * 0.9);
      e.vx += ((dx / d) * sp - e.vx) * 0.18; e.vy += ((dy / d) * sp - e.vy) * 0.18; e.vz += ((dz / d) * sp - e.vz) * 0.18;
      if (d < 0.9) { e.dead = true; W.emit('catch', { s: F.slot }); }
    } else {
      const k = Math.max(0, 1 - 3.2 * DT);
      e.vx *= k; e.vz *= k;
    }
  },
};

const moves = {
  ...normals({ power: 1.21, reach: 1.16, speed: 1.0, sfxS: 'grate', sfxM: 'grate', sfxL: 'grateHeavy' }),
  // A while running: its own dash attack
  dashattack: dashAttack({ pose: 'slide', boost: 11, fric: 20, dur: 34, hits: [hb(5, 10, [0, 0.4, 0.95], 0.8, 10, 72, 46, 52, { sfx: 'grateHeavy', blood: 1.1, fx: 'cheese' })] }),

  // Râpage frénétique : maintenir X, il se râpe sur l'ennemi (multi-coups) et rapetisse
  sp_n: {
    dur: 26, charge: { at: 5, max: 80, btn: 'X' }, pose: 'grate', airCtrl: 0.5, groundFric: 30,
    onCharge(F, W) {
      const c = F.mv.charge;
      F.va[0] = 1;
      shrink(F, 0.0018);
      if (c % 5 === 0) {
        const p = localToWorld(F, [0, 0.95, 0.95]);
        W.addHit({ owner: F.slot, key: `pn${F.mseq}:${c}`, x: p[0], y: p[1], z: p[2], r: 0.85, dmg: 1.3, ang: 10, fkb: 8,
          dir: 'face', dirAngle: F.facing, ox: F.x, oz: F.z, sfx: 'grate', blood: 1.1, hitlag: 0.35, move: 'sp_n', fx: 'cheese' });
        W.emit('flakes', { x: p[0], y: p[1], z: p[2], a: F.facing, n: 6 });
      }
      if (F.grounded && DMath.hypot(F.mx, F.my) > 0.3) {
        F.vx = DMath.sin(F.facing) * 2; F.vz = DMath.cos(F.facing) * 2;
      }
    },
    onEnd(F) { F.va[0] = 0; },
    hits: [hb(7, 9, [0, 0.95, 1.0], 0.95, 5, 38, 32, 70, { sfx: 'grateHeavy', blood: 1.8, fx: 'cheese' })],
  },

  // Copeau-boomerang : un gros copeau tranchant qui part et revient
  sp_s: {
    dur: 30, iasa: 26, pose: 'throw1', airCtrl: 0.6,
    onFrame(F, W, f) {
      if (f === 8) {
        shoot(W, F, 'proj', 19, { look: 'shard', custom: 'boomerang', r: 0.45, dmg: 6, ang: 35, kbb: 24, kbg: 55, life: 110, pierce: true, rehit: 22, spin: 22, sfx: 'slice', blood: 1.8, outT: 17 }, [0, 1.1, 0.7], F.facing, 0);
        shrink(F, 0.03);
        W.emit('sfx', { s: F.slot, n: 'throw' });
      }
    },
  },

  // Parmesan-copter : il tourne comme une hélice ; X tenu, il continue de voler... en se râpant (il rétrécit)
  sp_u: {
    dur: 90, pose: 'helico', helpless: true, noGrav: [6, 84], airCtrl: 0.5, ledgeGrab: true,
    onFrame(F, W, f) {
      if (f === 6) { F.grounded = false; W.emit('sfx', { s: F.slot, n: 'helico' }); }
      if (f >= 6 && f <= 34) { F.vy = 13 - (f - 6) * 0.08; steerX(F, 7.5); }
      else if (f > 34 && f <= 84) {
        if (xHeld(F) && !F.mv.stop) {
          F.vy += (5 + F.my * 3 - F.vy) * 0.2; steerX(F, 7.5);
          shrink(F, 0.0022);
          if (f % 6 === 0) W.emit('flakes', { x: F.x, y: F.y + 1.6, z: 0, a: 0, n: 3, down: 1 });
        } else { F.mv.stop = 1; F.vy -= 0.65; }
      }
      F.va[1] = (F.va[1] + (f >= 4 && f <= 84 && !F.mv.stop ? 0.9 : 0.2)) % (Math.PI * 2);
    },
    hits: [
      hb(6, 34, [0, 2.0, 0], 1.25, 1.8, 80, 0, 0, { fkb: 32, rehit: 5, sfx: 'grate', blood: 1.0, dir: 'radial', fx: 'cheese' }),
      hb(35, 38, [0, 2.0, 0], 1.4, 6, 75, 38, 70, { sfx: 'grateHeavy', blood: 1.6, dir: 'radial', grp: 7 }),
    ],
  },

  // Saupoudrage : il se râpe sur le sol : tapis de parmesan glissant (il n'y glisse pas, lui)
  sp_d: {
    dur: 40, iasa: 36, pose: 'sprinkle', airCtrl: 0.5,
    onFrame(F, W, f) {
      if (f > 6 && f < 26) { F.va[0] = 1; if (f % 3 === 0) W.emit('flakes', { x: F.x, y: F.y + 1.2, z: F.z, a: F.facing, n: 4, down: 1 }); }
      if (f === 18) {
        const s = W.stage.findLanding(F.x, F.z, F.y + 0.5, -60);
        const y = s ? W.stage.heightAt(s, F.x, F.z) : F.y;
        W.spawn('puddle', { owner: F.slot, x: F.x, y, z: F.z, r: 2.7, life: 660, look: 'cheese', safeOwner: true, tripDmg: 3 });
        W.addHit({ owner: F.slot, key: 'pd' + F.mseq, x: F.x, y: F.y + 0.4, z: F.z, r: 1.9, dmg: 4, ang: 80, kbb: 30, kbg: 20, dir: 'radial', sfx: 'grate', blood: 0.8, move: 'sp_d', effect: 'slip' });
        shrink(F, 0.07);
      }
    },
    onEnd(F) { F.va[0] = 0; },
  },
};

export default {
  id: 'parmesan', name: 'Il Parmigiano', title: 'Vingt-quatre mois d\'affinage, zéro pitié',
  color: '#f0d26a',
  regrow: 0.0013,
  stats: { weight: 114, runSpeed: 7.6, walkSpeed: 3.4, airSpeed: 5.8, airAccel: 30, groundAccel: 58, friction: 44,
    jumpVel: 14.5, airJumpVel: 12.5, airJumps: 1, gravity: 1.02, fallSpeed: 18.5, height: 1.65, radius: 0.66 },
  moves,
  specialsInfo: { n: 'Râpage frénétique (maintenir)', s: 'Copeau-boomerang', u: 'Râpe-hélico', d: 'Saupoudrage glissant' },
};
