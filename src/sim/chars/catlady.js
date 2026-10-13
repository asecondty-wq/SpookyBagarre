// La Folle Du Bus : la vieille sorcière mal fagotée qui a perdu son chat... et qui vous jette tous les autres.
// Minou volant (le chat s'agrippe et griffe), Gros Matou (boule de poils qui roule), Balai magique, Nuée de minous.
import { normals, hb, shoot } from '../kit.js';
import { ENTITIES, nearestEnemy } from '../entities.js';
import { stickToWorld } from '../util.js';

// at most 4 cats per witch on the platform: the oldest goes home
function makeRoom(W, owner, max = 4) {
  const mine = W.entities.filter((m) => !m.dead && m.owner === owner && (m.kind === 'clingcat' || (m.kind === 'minion' && (m.look === 'cat' || m.look === 'kitten'))));
  while (mine.length >= max) { const o = mine.shift(); o.dead = true; W.emit('catPoof', { x: o.x, y: o.y, z: o.z }); }
}

// --- the thrown cat: clings to whoever it hits, lands as a feral cat otherwise ---------------------------------
ENTITIES.catThrow = {
  onHitFighter(e, V, W) {
    if (V.state === 'dead' || V.out) return;
    makeRoom(W, e.owner);
    W.spawn('clingcat', { owner: e.owner, vic: V.slot, x: V.x, y: V.y + V.height * 0.8, z: V.z, life: 110 });
    W.emit('sfx', { s: e.owner, n: 'yowl' });
  },
  onLand(e, W) {
    makeRoom(W, e.owner);
    W.spawn('minion', { owner: e.owner, x: e.x, y: e.y + 0.05, z: e.z, look: 'cat', a: Math.atan2(e.vx, e.vz), hp: 7, life: 210, speed: 7.5, dmg: 5, reach: 0.9, atkCD: 30, ang: 50, kbb: 24, kbg: 40, h: 0.6, r: 0.45 });
    W.emit('sfx', { s: e.owner, n: 'hiss' });
  },
};

// --- a cat clinging to a fighter's head: scratches without knocking back, shake it off by mashing ---------------
ENTITIES.clingcat = {
  pack: (e) => ['clingcat', e.s ?? 1, e.a ?? 0, e.vic ?? -1],
  unpack: (e, x) => { if (x) { [e.look, e.s, e.a, e.vic] = x; } },
  defaults: () => ({ life: 110, r: 0.4 }),
  step(e, W) {
    const V = W.fighters[e.vic];
    const gone = !V || V.out || V.state === 'dead' || V.state === 'respawn' || V.state === 'held';
    if (gone || e.life <= 2) { e.dead = true; W.emit('catOff', { x: e.x, y: e.y, z: e.z }); return; }
    e.x = V.x; e.y = V.y + V.height * 0.82; e.z = V.z;
    e.a = V.facing + Math.sin(e.t * 0.7) * 0.5;
    if (V.mash) { e.life -= V.mash * 7; V.mash = 0; }
    if (V.state === 'hitstun' && V.launchKb > 70) e.life = Math.min(e.life, 4); // a big hit sends it flying
    if (e.t % 11 === 5) e.scratchNow = 1;
  },
  hits(e, W) {
    if (!e.scratchNow) return null;
    e.scratchNow = 0;
    const V = W.fighters[e.vic];
    if (!V) return null;
    return { owner: e.owner, key: 'cc' + e.id + ':' + e.t, x: V.x, y: V.y + V.height * 0.6, z: V.z, r: 0.9, dmg: 1.4, ang: 80, kbb: 0, kbg: 0,
      dir: 'radial', noLaunch: true, ent: e.id, src: 'proj', sfx: 'scratch', blood: 0.9, multi: true, hitlag: 0.25, move: 'clingcat' };
  },
};

// --- cats on the ground: dash at the nearest enemy and pounce -------------------------------------------------
function catBrain(e, W) {
  if (e.st > 0) { e.st++; if (e.st > 16) e.st = 0; return; }
  if (!e.grounded) return;
  const T = nearestEnemy(W, e.owner, e.x, e.y, e.z, 30);
  if (!T) { e.vx *= 0.9; e.vz *= 0.9; return; }
  const dx = T.x - e.x, dz = T.z - e.z, d = Math.hypot(dx, dz) || 1;
  e.a = Math.atan2(dx, dz);
  if (d > 2.2) { e.vx = (dx / d) * e.speed; e.vz = (dz / d) * e.speed; }
  else if (--e.cd <= 0) {
    // pounce
    e.cd = e.atkCD;
    e.vx = (dx / d) * 9; e.vz = (dz / d) * 9; e.vy = 6.5; e.grounded = false;
    e.pounce = 14;
    W.emit('sfx', { s: e.owner, n: e.look === 'kitten' ? 'meow' : 'hiss' });
  } else { e.vx *= 0.7; e.vz *= 0.7; }
}
function pounceHit(e) {
  if (e.pounce > 0) {
    e.pounce--;
    if (e.pounce % 4 === 0) e.attackNow = { x: e.x + Math.sin(e.a) * 0.35, y: e.y + 0.4, z: e.z + Math.cos(e.a) * 0.35, r: 0.6, dmg: e.dmg, ang: e.ang, kbb: e.kbb, kbg: e.kbg, sfx: 'scratch', blood: 1.1 };
  }
}
ENTITIES.minion_cat = { brain(e, W) { pounceHit(e); catBrain(e, W); } };
ENTITIES.minion_kitten = { brain(e, W) { pounceHit(e); if (e.t < 14) { e.vx *= 0.96; e.vz *= 0.96; return; } catBrain(e, W); } };

// --- the big fat cat rolling like a bowling ball ---------------------------------------------------------------
ENTITIES.fatcat = {
  stepExtra(e, W) {
    if (e.vy === 0 && e.t % 9 === 0) W.emit('dust', { x: e.x, y: e.y, z: e.z });
  },
  onHitFighter(e, V, W) { W.emit('sfx', { s: e.owner, n: 'yowl' }); },
};

const moves = {
  ...normals({ power: 0.95, reach: 1.0, speed: 1.05, sfxS: 'slap', sfxM: 'scratch', sfxL: 'hitL' }),

  // Minou volant : un chat lancé à bout de bras ; s'il touche, il s'agrippe à la tête et griffe
  sp_n: {
    dur: 34, iasa: 30, pose: 'throw1', airCtrl: 0.5,
    onFrame(F, W, f) {
      if (f === 6) W.emit('sfx', { s: F.slot, n: 'meow' });
      if (f === 11) {
        shoot(W, F, 'proj', 15.5, { look: 'cat', custom: 'catThrow', r: 0.5, dmg: 3, ang: 45, kbb: 4, kbg: 8, life: 70, grav: 0.55, spin: 9, sfx: 'scratch', blood: 0.6 }, [0, 1.25, 0.6], F.facing, 3.5);
        W.emit('sfx', { s: F.slot, n: 'throw' });
      }
    },
  },

  // Gros Matou : elle lance son gros chat qui roule à terre comme une boule de bowling
  sp_s: {
    dur: 46, iasa: 42, pose: 'throw2', airCtrl: 0.35,
    onFrame(F, W, f) {
      if (f === 8) W.emit('sfx', { s: F.slot, n: 'yowl' });
      if (f === 16) {
        shoot(W, F, 'proj', 11.5, { look: 'fatcat', custom: 'fatcat', r: 0.8, dmg: 13, ang: 38, kbb: 36, kbg: 72, life: 130, grav: 1.3, slide: true, drag: 0.35, spin: 7, sfx: 'punchHeavy', blood: 1.6, hitlag: 1.1 }, [0, 1.3, 0.8], F.facing, 4);
        W.emit('sfx', { s: F.slot, n: 'throw' });
      }
    },
  },

  // Balai magique : elle enfourche son balai et file vers le ciel (dirigeable au stick)
  sp_u: {
    dur: 58, pose: 'broom', helpless: true, noGrav: [6, 44], airCtrl: 0.2, ledgeGrab: true,
    onStart(F) { F.mv.dx = Math.sin(F.facing); F.mv.dz = Math.cos(F.facing); },
    onFrame(F, W, f) {
      if (f === 6) { F.grounded = false; W.emit('sfx', { s: F.slot, n: 'broom' }); }
      if (f >= 6 && f <= 44) {
        const mag = Math.hypot(F.mx, F.my);
        if (mag > 0.3) {
          const [sx, sz] = stickToWorld(F.mx / mag, F.my / mag, W.camYaw);
          F.mv.dx += (sx - F.mv.dx) * 0.08; F.mv.dz += (sz - F.mv.dz) * 0.08;
          const n = Math.hypot(F.mv.dx, F.mv.dz) || 1; F.mv.dx /= n; F.mv.dz /= n;
          F.facing = Math.atan2(F.mv.dx, F.mv.dz);
        }
        const sp = 6.5;
        F.vx = F.mv.dx * sp; F.vz = F.mv.dz * sp;
        F.vy = 11.5 - (f - 6) * 0.16;
        F.va[1] = 1;
      } else if (f > 44) { F.vx *= 0.92; F.vz *= 0.92; F.va[1] = Math.max(0, F.va[1] - 0.1); }
    },
    hits: [
      hb(6, 12, [0, 0.4, 0.5], 0.9, 7, 72, 40, 58, { sfx: 'slap', blood: 1.1 }),
      hb(13, 40, [0, 0.2, -0.6], 0.6, 3, 50, 20, 30, { rehit: 9, sfx: 'scratch', blood: 0.7, grp: 2 }),
    ],
    onEnd(F) { F.va[1] = 0; },
  },

  // Nuée de minous : elle secoue son gilet, trois chatons en tombent et se ruent sur l'ennemi le plus proche
  sp_d: {
    dur: 48, iasa: 44, pose: 'drum', airCtrl: 0.3,
    onFrame(F, W, f) {
      F.va[0] = f > 4 && f < 18 ? Math.sin(f * 1.9) : 0;
      if (f === 4) W.emit('sfx', { s: F.slot, n: 'meow' });
      if (f === 16) {
        for (let i = 0; i < 3; i++) {
          makeRoom(W, F.slot, 5);
          const a = F.facing + (i - 1) * 0.9;
          W.spawn('minion', { owner: F.slot, x: F.x + Math.sin(a) * 0.5, y: F.y + 0.9, z: F.z + Math.cos(a) * 0.5, vx: Math.sin(a) * 6, vz: Math.cos(a) * 6, vy: 5,
            look: 'kitten', a, hp: 4, life: 240, speed: 8.5, dmg: 3.5, reach: 0.7, atkCD: 26, ang: 55, kbb: 18, kbg: 30, h: 0.45, r: 0.32, grounded: false });
        }
        W.emit('sfx', { s: F.slot, n: 'yowl' });
      }
    },
    hits: [hb(14, 18, [0, 0.9, 0], 1.3, 4, 60, 30, 34, { dir: 'radial', sfx: 'scratch', blood: 0.8 })],
    onEnd(F) { F.va[0] = 0; },
  },
};

export default {
  id: 'catlady', name: 'La Folle Du Bus', title: 'Elle a perdu son chat. Elle vous jette les autres.',
  color: '#8a4fc0',
  stats: { weight: 90, runSpeed: 7.6, walkSpeed: 3.3, airSpeed: 6.0, airAccel: 32, groundAccel: 60, friction: 44,
    jumpVel: 15.2, airJumpVel: 13.2, airJumps: 1, gravity: 0.92, fallSpeed: 16.5, height: 1.75, radius: 0.55 },
  moves,
  specialsInfo: { n: 'Minou volant', s: 'Gros Matou', u: 'Balai magique', d: 'Nuée de minous' },
};
