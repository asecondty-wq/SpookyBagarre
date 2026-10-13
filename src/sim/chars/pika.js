// Pikaboo : un pokémon qui dresse des humains. Il lance des Humanballs : un humain sauvage en sort et se bat pour lui.
// Sa Capture enferme un adversaire dans une balle qui tremble... et explose.
import { normals, hb, shoot } from '../kit.js';
import { ENTITIES, nearestEnemy } from '../entities.js';
import { setState } from '../fighter.js';
import { stickToWorld } from '../util.js';

const HUMANS = ['jogger', 'mamie', 'touriste', 'beauf', 'stagiaire'];

// --- humanball (neutral): opens on landing and releases a random human
ENTITIES.humanball = {
  onLand(e, W) { release(e, W); },
  onHitFighter(e, V, W) { release(e, W); },
};
function release(e, W) {
  if (e.opened) return;
  e.opened = 1;
  const owner = W.fighters[e.owner];
  // at most two humans per trainer: the oldest goes home
  const mine = W.entities.filter((m) => m.kind === 'minion' && m.owner === e.owner && !m.dead);
  if (mine.length >= 2) { mine[0].dead = true; W.emit('minionLeave', { id: mine[0].id }); }
  const look = HUMANS[Math.floor(W.rng() * HUMANS.length)];
  const s = W.stage.findLanding(e.x, e.z, e.y + 1, -60);
  const y = s ? W.stage.heightAt(s, e.x, e.z) : e.y;
  const base = { owner: e.owner, x: e.x, y: y + 0.05, z: e.z, look, a: owner ? owner.facing : 0, grounded: !!s, surf: s ? s.idx : 0 };
  const per = {
    jogger: { hp: 10, life: 150, speed: 9.5, dmg: 7 },
    mamie: { hp: 22, life: 420, speed: 2.6, dmg: 10, reach: 1.1, atkCD: 46, kbb: 42, kbg: 72 },
    touriste: { hp: 10, life: 160, speed: 3, dmg: 2 },
    beauf: { hp: 20, life: 420, speed: 1.8, dmg: 5, atkCD: 55 },
    stagiaire: { hp: 8, life: 300, speed: 4.5, dmg: 4, atkCD: 40 },
  }[look];
  W.spawn('minion', { ...base, ...per });
  W.emit('humanOut', { x: e.x, y, z: e.z, k: look, o: e.owner });
}

// --- human brains
ENTITIES.minion_jogger = {
  brain(e, W) {
    // runs straight ahead through everything, never stops
    if (e.st > 0) { e.st++; if (e.st > 18) e.st = 0; return; }
    if (!e.grounded) return;
    e.vx = Math.sin(e.a) * e.speed; e.vz = Math.cos(e.a) * e.speed;
    if (e.t % 6 === 0) e.attackNow = { x: e.x + Math.sin(e.a) * 0.4, y: e.y + 0.9, z: e.z + Math.cos(e.a) * 0.4, r: 0.75, dmg: e.dmg, ang: 40, kbb: 34, kbg: 62, sfx: 'hitM' };
  },
};
ENTITIES.minion_touriste = {
  brain(e, W) {
    if (e.st > 0) { e.st++; if (e.st > 18) e.st = 0; return; }
    if (!e.grounded) return;
    const T = nearestEnemy(W, e.owner, e.x, e.y, e.z, 30);
    if (e.t < 45 && T) {
      const dx = T.x - e.x, dz = T.z - e.z, d = Math.hypot(dx, dz) || 1;
      e.a = Math.atan2(dx, dz);
      e.vx = d > 2.5 ? (dx / d) * e.speed : 0; e.vz = d > 2.5 ? (dz / d) * e.speed : 0;
    }
    if (e.t === 46) {
      // selfie flash: blinds (stuns) everyone in front
      W.addHit({ owner: e.owner, key: 'flash' + e.id, x: e.x + Math.sin(e.a) * 1.8, y: e.y + 1.2, z: e.z + Math.cos(e.a) * 1.8, r: 2.4, dmg: 3, ang: 0, kbb: 0, kbg: 0, effect: 'stun', stun: 48, dir: 'radial', ent: e.id, src: 'proj', sfx: 'flash', blood: 0, move: 'minion:touriste' });
      W.emit('flash', { x: e.x, y: e.y + 1.6, z: e.z, id: e.id });
    }
    if (e.t > 60) { e.a += Math.PI * (e.t === 61 ? 1 : 0); e.vx = Math.sin(e.a) * 6; e.vz = Math.cos(e.a) * 6; }
  },
};
ENTITIES.minion_beauf = {
  brain(e, W) {
    if (e.st > 0) { e.st++; if (e.st > 20) e.st = 0; return; }
    if (!e.grounded) return;
    const T = nearestEnemy(W, e.owner, e.x, e.y, e.z, 30);
    e.vx *= 0.8; e.vz *= 0.8;
    if (!T) return;
    e.a = Math.atan2(T.x - e.x, T.z - e.z);
    if (--e.cd <= 0) {
      e.cd = e.atkCD;
      const d = Math.hypot(T.x - e.x, T.z - e.z);
      const sp = Math.min(14, 5 + d * 1.1);
      W.spawn('proj', { owner: e.owner, x: e.x, y: e.y + 1.5, z: e.z, vx: Math.sin(e.a) * sp, vz: Math.cos(e.a) * sp, vy: 6, grav: 1,
        look: 'merguez', r: 0.3, dmg: 5, ang: 40, kbb: 22, kbg: 48, life: 90, spin: 12, sfx: 'splat', blood: 0.8 });
      W.emit('minionAttack', { id: e.id, k: 'beauf' });
    }
  },
};
ENTITIES.minion_stagiaire = {
  brain(e, W) {
    if (e.st > 0) { e.st++; if (e.st > 18) e.st = 0; return; }
    if (!e.grounded) return;
    const T = nearestEnemy(W, e.owner, e.x, e.y, e.z, 30);
    if (!T) return;
    const dx = T.x - e.x, dz = T.z - e.z, d = Math.hypot(dx, dz) || 1;
    e.a = Math.atan2(dx, dz);
    e.vx = d > 4 ? (dx / d) * e.speed : 0; e.vz = d > 4 ? (dz / d) * e.speed : 0;
    if (--e.cd <= 0 && d < 7) {
      e.cd = e.atkCD;
      // hot coffee
      W.spawn('proj', { owner: e.owner, x: e.x, y: e.y + 1.3, z: e.z, vx: Math.sin(e.a) * 11, vz: Math.cos(e.a) * 11, vy: 3, grav: 0.7,
        look: 'coffee', r: 0.3, dmg: 4, ang: 30, kbb: 16, kbg: 40, life: 60, spin: 4, sfx: 'splash', blood: 0.3 });
      W.emit('minionAttack', { id: e.id, k: 'stagiaire' });
    }
  },
};

// --- capture ball: holds an enemy, wobbles, then explodes (stronger above 100%)
ENTITIES.capball = {
  pack: (e) => ['capball', e.s ?? 1, e.a ?? 0, e.vic ?? -1],
  unpack: (e, x) => { if (x) { [e.look, e.s, e.a, e.vic] = x; } },
  defaults: () => ({ hurt: true, hurtByOwner: true, r: 0.6, h: 0.6, life: 400, a: 0 }),
  step(e, W) {
    const V = W.fighters[e.vic];
    if (!V || V.state !== 'held' || V.heldBy !== e.id) { e.dead = true; return; }
    e.vy -= 30 / 60; e.y += e.vy / 60; e.x += e.vx / 60; e.z += e.vz / 60; e.vx *= 0.9; e.vz *= 0.9;
    const s = W.stage.findLanding(e.x, e.z, e.y + 0.5, e.y);
    if (s) { e.y = W.stage.heightAt(s, e.x, e.z); e.vy = 0; }
    if (e.y < -18) { e.dead = true; return; }
    V.x = e.x; V.y = e.y; V.z = e.z;
    e.timer -= 1 + (V.mash || 0) * 3; V.mash = 0;
    const phase = Math.floor((1 - e.timer / e.timer0) * 3);
    if (phase !== e.phase && phase < 3) { e.phase = phase; W.emit('wobble', { id: e.id, n: phase + 1, x: e.x, y: e.y, z: e.z }); }
    e.a = Math.sin(e.t * 0.5) * (e.t % 30 < 12 ? 0.5 : 0.05);
    if (e.timer <= 0) {
      e.dead = true;
      setState(V, 'air'); V.heldBy = 0; V.grounded = false; V.intangible = 0;
      const crit = V.damage >= 100;
      W.hitDirect(W.fighters[e.owner], V, { dmg: crit ? 14 : 8, ang: 80, kbb: crit ? 70 : 50, kbg: crit ? 105 : 62, dir: 'radial', x: e.x, y: e.y, z: e.z, ox: e.x, oz: e.z, sfx: 'boom', blood: 2.5, hitlag: 1.2, key: 'cap' + e.id, fx: 'capture' });
      W.emit('capBreak', { id: e.id, x: e.x, y: e.y, z: e.z, crit: crit ? 1 : 0, v: V.slot });
    }
  },
  onHurt(e, hv, W) {
    // hitting the ball hurts whoever is inside
    const V = W.fighters[e.vic];
    if (V) { V.damage += (hv.dmg || 3) * 0.8; W.emit('minionHit', { id: e.id, x: e.x, y: e.y + 0.4, z: e.z, d: hv.dmg, k: 'capball' }); }
    e.vx += Math.sin(W.launchDir(hv, e)) * 4; e.vz += Math.cos(W.launchDir(hv, e)) * 4; e.vy = 4;
  },
};
ENTITIES.capthrow = {
  onHitFighter(e, V, W) {
    if (V.state === 'dead' || V.out) return;
    V.move = null; setState(V, 'held'); V.mash = 0;
    const b = W.spawn('capball', { owner: e.owner, x: V.x, y: V.y, z: V.z, vx: e.vx * 0.15, vz: e.vz * 0.15, vy: 3, vic: V.slot, timer: 70 + V.damage * 0.5, phase: -1 });
    b.timer0 = b.timer;
    V.heldBy = b.id;
    W.emit('captured', { s: e.owner, v: V.slot, x: V.x, y: V.y, z: V.z });
  },
};

// --- lightning bolt falling on Pikaboo
ENTITIES.skybolt = {
  pack: (e) => ['skybolt', e.s ?? 1, e.y0 ?? 0, 0],
  unpack: (e, x) => { if (x) { [e.look, e.s, e.y0] = x; } },
  defaults: () => ({ life: 40 }),
  step(e, W) {
    const F = W.fighters[e.owner];
    e.y -= 46 / 60;
    if (F && F.move === 'sp_d' && e.y <= F.y + 2.2 && !e.done) {
      e.done = 1; e.dead = true;
      W.addHit({ owner: F.slot, key: 'pkd' + e.id, x: F.x, y: F.y + 0.9, z: F.z, r: 2.1, dmg: 15, ang: 72, kbb: 42, kbg: 86, dir: 'radial', sfx: 'zap', blood: 2.0, hitlag: 1.5, move: 'sp_d', fx: 'zap' });
      W.emit('thunderBlast', { s: F.slot, x: F.x, y: F.y, z: F.z });
      F.va[0] = 1;
    }
    if (e.y < (F ? F.y - 3 : -20)) e.dead = true;
  },
  hits(e) {
    return { owner: e.owner, key: 'e' + e.id, shape: 'capsule', x: e.x, y: e.y, z: e.z, x2: e.x, y2: e.y + 3, z2: e.z, r: 0.55, dmg: 11, ang: -70, kbb: 20, kbg: 50, spike: 1, dir: 'radial', ent: e.id, src: 'proj', sfx: 'zap', blood: 1.2, fx: 'zap', move: 'sp_d' };
  },
};

const moves = {
  ...normals({ power: 0.9, reach: 0.9, speed: 1.15, sfxS: 'zapS', sfxM: 'zap', sfxL: 'zapL' }),

  // Humanball, GO ! : un humain sauvage apparaît
  sp_n: {
    dur: 34, iasa: 30, pose: 'throw1', airCtrl: 0.6,
    onFrame(F, W, f) {
      if (f === 9) {
        shoot(W, F, 'proj', 10, { look: 'humanball', custom: 'humanball', r: 0.32, dmg: 4, ang: 40, kbb: 16, kbg: 30, life: 120, grav: 1, spin: 10, sfx: 'pop', blood: 0.3 }, [0, 1.0, 0.5], F.facing, 6);
        W.emit('sfx', { s: F.slot, n: 'go' });
      }
    },
  },

  // Capture ! : une balle rapide qui enferme l'adversaire touché
  sp_s: {
    dur: 40, iasa: 34, pose: 'throw1', airCtrl: 0.5,
    onFrame(F, W, f) {
      if (f === 11) {
        shoot(W, F, 'proj', 22, { look: 'capball', custom: 'capthrow', r: 0.38, dmg: 3, ang: 0, fkb: 0, life: 28, grav: 0, spin: 14, sfx: 'pop', blood: 0 }, [0, 1.0, 0.6], F.facing, 0);
        W.emit('sfx', { s: F.slot, n: 'throw' });
      }
    },
  },

  // Éclair-éclair : deux téléportations électriques (direction du stick, ou vers le haut)
  sp_u: {
    dur: 34, pose: 'zip', helpless: true, noGrav: [0, 24], airCtrl: 0.3, ledgeGrab: true,
    onStart(F, W) { zipDir(F, W); },
    onFrame(F, W, f) {
      if (f >= 4 && f <= 9) { F.vx = F.mv.zx * 27; F.vy = F.mv.zy * 27; F.vz = F.mv.zz * 27; F.grounded = false; F.va[0] = 1; }
      if (f === 4 || f === 14) W.emit('sfx', { s: F.slot, n: 'zip' });
      if (f > 9 && f < 14) { F.vx *= 0.3; F.vy *= 0.3; F.vz *= 0.3; F.va[0] = 0.3; }
      if (f === 13) zipDir(F, W);
      if (f >= 14 && f <= 18) { F.vx = F.mv.zx * 24; F.vy = F.mv.zy * 24; F.vz = F.mv.zz * 24; F.va[0] = 1; }
      if (f > 18) { F.vx *= 0.7; F.vz *= 0.7; F.vy *= 0.6; F.va[0] = 0; }
    },
    hits: [
      hb(4, 9, [0, 0.6, 0], 0.9, 4, 60, 30, 40, { sfx: 'zap', blood: 0.8, dir: 'radial', fx: 'zap' }),
      hb(14, 18, [0, 0.6, 0], 0.9, 4, 60, 30, 40, { sfx: 'zap', blood: 0.8, dir: 'radial', fx: 'zap', grp: 2 }),
    ],
  },

  // Tonnerre : appelle la foudre sur lui-même ; explosion électrique
  sp_d: {
    dur: 50, iasa: 46, pose: 'thunder', noGrav: [0, 30], airCtrl: 0.1,
    onStart(F) { F.vy = Math.max(0, F.vy * 0.2); },
    onFrame(F, W, f) {
      if (!F.grounded) { F.vy *= 0.85; F.vx *= 0.85; F.vz *= 0.85; }
      if (f === 2) { W.spawn('skybolt', { owner: F.slot, x: F.x, y: F.y + 13, z: F.z, y0: F.y + 13 }); W.emit('sfx', { s: F.slot, n: 'thunderCall' }); }
      if (f > 30) F.va[0] = Math.max(0, F.va[0] - 0.05);
    },
  },
};

function zipDir(F, W) {
  const mag = Math.hypot(F.mx, F.my);
  if (mag > 0.3) {
    const [dx, dz] = stickToWorld(F.mx / mag, F.my / mag, W.camYaw);
    const up = 0.55;
    const n = Math.hypot(dx, up, dz);
    F.mv.zx = dx / n; F.mv.zy = up / n; F.mv.zz = dz / n;
    F.facing = Math.atan2(dx, dz);
  } else { F.mv.zx = 0; F.mv.zy = 1; F.mv.zz = 0; }
}

export default {
  id: 'pika', name: 'Pikaboo', title: 'Dresseur d\'humains sauvages',
  color: '#ffd84a',
  stats: { weight: 74, runSpeed: 9.8, walkSpeed: 4.2, airSpeed: 7.0, airAccel: 40, groundAccel: 80, friction: 50,
    jumpVel: 15.5, airJumpVel: 13.5, airJumps: 1, gravity: 1.05, fallSpeed: 18, height: 1.2, radius: 0.5 },
  moves,
  specialsInfo: { n: 'Humanball, GO ! (humain aléatoire)', s: 'Capture !', u: 'Éclair-éclair', d: 'Tonnerre' },
};
