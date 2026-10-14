// Président Micron : billets, poudre de perlimpinpin, ascension jupitérienne et le 49.3 qui traverse les boucliers.
import { normals, dashAttack, hb, shoot } from '../kit.js';
import { ENTITIES } from '../entities.js';
import { localToWorld } from '../util.js';
import { steerX, nearestLedge, pullTo, xAgain, xHeld } from './recovery.js';
import { DMath } from '../dmath.js';

// the powder bag bursts into a cloud; Micron walking into his own cloud gets a speed boost ("SNIFF")
ENTITIES.powderbag = {
  onLand(e, W) { burst(e, W); },
  onHitFighter(e, V, W) { burst(e, W); },
  onDie(e, W) { if (!e.burst) burst(e, W); },
};
function burst(e, W) {
  if (e.burst) return;
  e.burst = 1;
  W.spawn('cloud', { owner: e.owner, x: e.x, y: e.y + 0.6, z: e.z, r: 2.3, life: 200, look: 'powder', effect: 'stun', stun: 55, dmg: 2, rehit: 80, custom: 'powdercloud' });
  W.emit('powder', { x: e.x, y: e.y, z: e.z, o: e.owner });
}
ENTITIES.powdercloud = {};
// owner boost check is done here every tick (clouds are generic)
const cloudStep = ENTITIES.cloud.step;
ENTITIES.cloud.step = function (e, W) {
  cloudStep(e, W);
  if (e.custom === 'powdercloud' && e.t % 6 === 0) {
    const F = W.fighters[e.owner];
    if (F && !F.out && DMath.hypot(F.x - e.x, F.z - e.z) < e.r && Math.abs(F.y + 1 - e.y) < 2.5 && F.speedMul === 1) {
      F.speedMul = 1.5; F.speedT = 300;
      W.emit('sniff', { s: F.slot, x: F.x, y: F.y + 1.6, z: F.z });
    }
  }
};

// stamp that falls from the sky: telegraphed, unblockable ("le 49.3 passe les boucliers")
ENTITIES.stamp = {
  pack: (e) => [e.look || 'stamp', e.s ?? 1, e.a ?? 0, e.h ?? 8],
  unpack: (e, x) => { if (x) { [e.look, e.s, e.a, e.h] = x; } },
  defaults: () => ({ life: 70, h: 9, look: 'stamp', a: 0 }),
  step(e, W) {
    if (e.t < 16) e.h = 9 - e.t * 0.05;
    else if (e.t < 22) e.h = Math.max(0, e.h - 2.2);
    else e.h = 0;
    if (e.t === 21) {
      W.emit('stamp', { x: e.x, y: e.y, z: e.z, o: e.owner, a: e.a });
    }
  },
  hits(e) {
    if (e.t < 20 || e.t > 24) return null;
    return { owner: e.owner, key: 'e' + e.id, x: e.x, y: e.y + 0.8, z: e.z, r: 2.4, dmg: 19, ang: 72, kbb: 48, kbg: 84, dir: 'radial',
      unblockable: true, ent: e.id, src: 'proj', sfx: 'stamp', blood: 2.6, hitlag: 1.4, move: 'sp_d', fx: 'stamp' };
  },
};

const moves = {
  ...normals({ power: 1.0, reach: 1.02, speed: 1.03, sfxS: 'slap', sfxM: 'hitM', sfxL: 'briefcase' }),
  // A while running: its own dash attack
  dashattack: dashAttack({ pose: 'shoulder', boost: 11, fric: 22, dur: 34, hits: [hb(6, 10, [0, 1.1, 0.8], 0.8, 10, 36, 46, 74, { sfx: 'briefcase', blood: 1.2 })] }),

  // Pluie de billets : éventail de billets qui volettent
  sp_n: {
    dur: 26, iasa: 22, pose: 'throw1', airCtrl: 0.6,
    onFrame(F, W, f) {
      if (f === 7) {
        for (let i = -2; i <= 2; i++) {
          shoot(W, F, 'proj', 15 + Math.abs(i) * -0.8, {
            look: 'bill', r: 0.33, dmg: 2.3, ang: 30, kbb: 6, kbg: 30, life: 34, drag: 1.5, grav: 0.08, spin: 9 + i,
            sfx: 'cash', blood: 0.5, hitlag: 0.6,
          }, [0, 1.25, 0.6], F.facing, 1.2 + i * 1.6); // a fan, from low to high
        }
        W.emit('sfx', { s: F.slot, n: 'cash' });
      }
    },
  },

  // Poudre de perlimpinpin : sachet lancé en cloche qui éclate en nuage étourdissant
  sp_s: {
    dur: 34, iasa: 30, pose: 'throw2', airCtrl: 0.6,
    onFrame(F, W, f) {
      if (f === 10) {
        shoot(W, F, 'proj', 12, { look: 'powderbag', custom: 'powderbag', r: 0.35, dmg: 3, ang: 40, kbb: 10, kbg: 20, life: 90, grav: 1, spin: 6, sfx: 'poof', blood: 0.2 }, [0, 1.4, 0.5], F.facing, 7);
        W.emit('sfx', { s: F.slot, n: 'throw' });
      }
    },
  },

  // Ascension jupitérienne : une colonne de foudre le porte très haut, dirigeable, puis un éclair vers le bas
  sp_u: {
    dur: 56, pose: 'jupiter', helpless: true, noGrav: [6, 42], airCtrl: 0.5, ledgeGrab: true,
    onFrame(F, W, f) {
      if (f < 6 && !F.grounded) F.vy = Math.max(F.vy, -1);
      if (f === 5) { F.grounded = false; W.emit('sfx', { s: F.slot, n: 'thunder' }); }
      if (f >= 6 && f <= 42) { F.vy = 17 - (f - 6) * 0.2 + F.my * 2; steerX(F, 8); F.va[0] = 1; }
      else F.va[0] = Math.max(0, F.va[0] - 0.08);
      if (f === 42) {
        // lightning bolt straight down
        W.addHit({ owner: F.slot, key: `mu${F.mseq}`, shape: 'capsule', x: F.x, y: F.y, z: F.z, x2: F.x, y2: F.y - 7, z2: F.z, r: 0.7,
          dmg: 10, ang: -60, kbb: 25, kbg: 60, spike: 1, dir: 'radial', ox: F.x, oz: F.z, sfx: 'zap', blood: 1.6, move: 'sp_u', fx: 'zap' });
        W.emit('bolt', { x: F.x, y: F.y, z: F.z, h: 7 });
      }
    },
    hits: [hb(6, 40, [0, 1.0, 0], 1.25, 2, 80, 0, 0, { fkb: 34, rehit: 6, sfx: 'zap', blood: 0.5, dir: 'radial', fx: 'zap' })],
  },

  // 49.3 : un tampon géant tombe du ciel devant lui. Imparable.
  sp_d: {
    dur: 58, pose: 'decree', airCtrl: 0.3,
    onFrame(F, W, f) {
      if (f === 6) {
        const p = localToWorld(F, [0, 0, 2.4]);
        const s = W.stage.findLanding(p[0], p[2], 50, -50);
        const y = s ? W.stage.heightAt(s, p[0], p[2]) : F.y;
        W.spawn('stamp', { owner: F.slot, x: p[0], y, z: p[2], a: F.facing });
        W.emit('decree', { s: F.slot });
      }
    },
  },
};

export default {
  id: 'micron', name: 'Président Micron', title: 'En marche… vers ta tête',
  color: '#3b6fd6',
  stats: { weight: 96, runSpeed: 8.3, walkSpeed: 3.6, airSpeed: 6.2, airAccel: 32, groundAccel: 62, friction: 42,
    jumpVel: 15, airJumpVel: 13, airJumps: 1, gravity: 1.0, fallSpeed: 18, height: 1.85, radius: 0.55 },
  moves,
  specialsInfo: { n: 'Pluie de billets', s: 'Poudre de perlimpinpin', u: 'Ascension jupitérienne', d: '49.3 (imparable)' },
};
