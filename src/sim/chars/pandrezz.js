// Pandrezz : le héros de PANDREZZ, un rockeur barbu beaucoup trop fort. Il charge des kamehameha à mains nues
// et appelle ses deux potes à la rescousse : CD-Man (qui lance ses disques) et Vinylman (qui tombe du ciel et
// scratche tout le monde).
import { normals, dashAttack, hb, finish } from '../kit.js';
import { ENTITIES, nearestEnemy } from '../entities.js';
import { localToWorld, stickToWorld } from '../util.js';
import { DT, GRAVITY } from '../constants.js';
import { steerX, nearestLedge, pullTo, xAgain, xHeld } from './recovery.js';
import { DMath } from '../dmath.js';

// --- the beam: a capsule from the hands, it grows to its length, rakes whoever is inside, then blasts them away --
// Sim-only fields: at (hand offset in the owner's space), max (length), tick/fin (damage), down (rocket version).
ENTITIES.beam = {
  pack: (e) => [e.look || 'kame', Math.round((e.len || 0) * 100) / 100, Math.round((e.a || 0) * 1000) / 1000, Math.round((e.b || 0) * 1000) / 1000],
  unpack: (e, x) => { if (x) { [e.look, e.len, e.a, e.b] = x; } },
  defaults: () => ({ look: 'kame', len: 0, max: 8, r: 0.6, a: 0, b: 0, life: 40, tick: 1.2, fin: 8, grow: 60, c: 0 }),
  onSpawn(e) { e.life0 = e.life; },
  step(e, W) {
    const F = W.fighters[e.owner];
    const held = F && F.state === 'move' && F.mv && F.mv.beam === e.id;
    if (held) {
      const p = localToWorld(F, e.at || [0, 1.2, 0.6]);
      e.x = p[0]; e.y = p[1]; e.z = p[2];
      if (!e.down) e.a = F.facing;
    } else if (!e.cut) { e.cut = true; e.life = Math.min(e.life, 6); }
    e.len = Math.min(e.max, e.len + e.grow * DT);
    if (e.life <= 6) e.r *= 0.82; // collapses at the end
  },
  hits(e) {
    if (e.len < 0.3 || e.done) return null;
    const ca = DMath.cos(e.b), dx = DMath.sin(e.a) * ca, dy = DMath.sin(e.b), dz = DMath.cos(e.a) * ca;
    const base = {
      owner: e.owner, shape: 'capsule', x: e.x, y: e.y, z: e.z, x2: e.x + dx * e.len, y2: e.y + dy * e.len, z2: e.z + dz * e.len,
      r: Math.max(0.25, e.r), ent: e.id, src: 'proj', fx: 'zap', multi: true, unblockable: false, move: 'beam',
      dir: 'face', dirAngle: e.a, ox: e.x, oz: e.z,
    };
    // the final blast, once, a few frames before the beam fades
    if (e.life === 7 && !e.cut) {
      e.done = true; // nothing after the blast, so the launch is not overwritten by a rake
      return { ...base, key: 'bf' + e.id, dmg: e.fin, ang: e.finAng ?? (e.down ? 62 : 32), kbb: e.finKbb ?? (e.down ? 46 : 32 + e.c * 26),
        kbg: e.finKbg ?? (e.down ? 78 : 80 + e.c * 16), sfx: 'hitL', blood: 2, hitlag: 1.3, fx: e.finFx || 'kameBlast' };
    }
    // the rake: small pushes along the beam, every few frames
    // the downward one (the rocket): whoever is caught is sucked into the energy and carried up under him
    if (e.down) return { ...base, key: 'b' + e.id, rehit: 5, dmg: e.tick, ang: 80, fkb: 10, drag: [0.15, -1.25, 14], sfx: 'zap', blood: 0.5, hitlag: 0.3 };
    return { ...base, key: 'b' + e.id, rehit: 5, dmg: e.tick, ang: e.tickAng ?? 12, fkb: 9, sfx: 'zap', blood: 0.5, hitlag: 0.35, fx: e.tickFx };
  },
};

// --- CD-Man and Vinylman: his friends come help for a moment, and leave (one of each at a time) -----------------
// act: 0 arriving, 1 busy, 2 leaving (the renderer animates from act + t)
ENTITIES.buddy = {
  pack: (e) => [e.look || 'cdman', Math.round((e.a || 0) * 1000) / 1000, e.act || 0, e.tA || 0],
  unpack: (e, x) => { if (x) { [e.look, e.a, e.act, e.tA] = x; } },
  defaults: () => ({ look: 'cdman', r: 0.45, h: 1.5, hurt: true, hp: 12, life: 92, act: 0, tA: 0, grounded: false, a: 0 }),
  step(e, W) {
    const yPrev = e.y;
    if (!e.grounded) e.vy -= GRAVITY * (e.look === 'vinylman' ? 1.4 : 1) * DT;
    e.x += e.vx * DT; e.y += e.vy * DT; e.z += e.vz * DT;
    e.vx *= 0.9; e.vz *= 0.9;
    if (e.vy <= 0) {
      const s = W.stage.findLanding(e.x, e.z, yPrev, e.y);
      if (s) {
        e.y = W.stage.heightAt(s, e.x, e.z);
        if (!e.grounded && e.look === 'vinylman' && e.act === 0) vinylLand(e, W);
        e.vy = 0; e.grounded = true; e.surf = s.idx;
      } else if (e.grounded) {
        const su = W.stage.surfaces[e.surf ?? 0];
        if (!su || !W.stage.supports(su, e.x, e.z)) e.grounded = false; else e.y = W.stage.heightAt(su, e.x, e.z);
      }
    }
    if (e.y < -18) { e.dead = true; return; }
    if (e.knocked) { if (e.life > 14) e.life = 14; return; }
    (e.look === 'vinylman' ? vinylBrain : cdBrain)(e, W);
    e.tA++;
  },
  hits(e) {
    const h = e.attackNow; e.attackNow = null;
    return h || null;
  },
  onHurt(e, hv, W) {
    if (e.knocked) return;
    e.hp -= hv.dmg || 4;
    if (e.hp > 0) { W.emit('buddyOuch', { id: e.id, x: e.x, y: e.y + 1.2, z: e.z, k: e.look }); return; }
    e.knocked = true; e.act = 2; e.tA = 0;
    const ha = W.launchDir(hv, { x: e.x, z: e.z });
    e.vx = DMath.sin(ha) * 9; e.vz = DMath.cos(ha) * 9; e.vy = 9; e.grounded = false;
    W.emit('buddyKO', { id: e.id, x: e.x, y: e.y + 1, z: e.z, k: e.look });
  },
  onDie(e, W) { W.emit('buddyLeave', { id: e.id, x: e.x, y: e.y + 0.8, z: e.z, k: e.look }); },
};

function aimAt(e, W, range = 22) {
  const T = nearestEnemy(W, e.owner, e.x, e.y, e.z, range);
  if (T) e.a = DMath.atan2(T.x - e.x, T.z - e.z);
  return T;
}

// CD-Man pops up out of a disc and throws three CDs (the last one golden), then waves and leaves
function cdBrain(e, W) {
  if (e.act === 0 && e.tA >= 14) { e.act = 1; e.tA = 0; }
  if (e.act === 1) {
    if (e.tA % 16 === 0) aimAt(e, W);
    if (e.tA === 6 || e.tA === 13 || e.tA === 20) {
      const gold = e.tA === 20;
      const T = aimAt(e, W);
      const dy = T ? Math.max(-4, Math.min(4, T.y + 1 - (e.y + 1.15))) : 0;
      const sp = gold ? 19 : 16.5;
      W.spawn('proj', { owner: e.owner, x: e.x + DMath.sin(e.a) * 0.5, y: e.y + 1.15, z: e.z + DMath.cos(e.a) * 0.5,
        vx: DMath.sin(e.a) * sp, vz: DMath.cos(e.a) * sp, vy: dy * 1.6, dir: e.a,
        look: gold ? 'cdgold' : 'cd', r: gold ? 0.55 : 0.42, dmg: gold ? 8 : 4, ang: gold ? 42 : 35, kbb: gold ? 34 : 16, kbg: gold ? 74 : 42,
        life: 70, spin: 26, home: 0.05, homeDelay: 4, homeRange: 16, sfx: 'slice', blood: gold ? 1.4 : 0.7, hitlag: gold ? 1 : 0.6, grp: 'cd' + e.id });
      W.emit('cdThrow', { id: e.id, x: e.x, y: e.y + 1.2, z: e.z, g: gold ? 1 : 0 });
    }
    if (e.tA >= 40) { e.act = 2; e.tA = 0; e.life = Math.min(e.life, 16); W.emit('buddyBye', { id: e.id, x: e.x, y: e.y + 1.6, z: e.z, k: e.look }); }
  }
}

// Vinylman crashes down from the sky (shockwave), spins like a record on the platter (scratch), drops the bass
function vinylLand(e, W) {
  e.act = 1; e.tA = 0;
  W.spawn('ring', { owner: e.owner, x: e.x, y: e.y, z: e.z, look: 'vinyl', r: 0.6, grow: 15, life: 22, dmg: 9, ang: 62, kbb: 38, kbg: 52, w: 0.9, h: 1.3, sfx: 'hitL', blood: 1.4 });
  W.emit('vinylLand', { id: e.id, x: e.x, y: e.y, z: e.z });
}
function vinylBrain(e, W) {
  if (e.act !== 1) return;
  const spin = e.tA >= 10 && e.tA < 46;
  if (spin && e.tA % 6 === 0) {
    e.attackNow = { owner: e.owner, key: 'vs' + e.id + ':' + e.tA, x: e.x, y: e.y + 0.8, z: e.z, r: 1.45, dmg: 1.6, ang: 30, fkb: 16,
      dir: 'radial', ent: e.id, src: 'proj', sfx: 'scratch', blood: 0.6, hitlag: 0.3, multi: true, move: 'vinylman' };
    if (e.tA % 12 === 0) W.emit('vinylScratch', { id: e.id, x: e.x, y: e.y + 1, z: e.z });
  }
  if (e.tA === 50) {
    // DROP THE BASS
    e.attackNow = { owner: e.owner, key: 'vd' + e.id, x: e.x, y: e.y + 0.8, z: e.z, r: 2.1, dmg: 7, ang: 55, kbb: 44, kbg: 70,
      dir: 'radial', ent: e.id, src: 'proj', sfx: 'hitL', blood: 1.6, hitlag: 1.1, move: 'vinylman' };
    W.emit('vinylDrop', { id: e.id, x: e.x, y: e.y, z: e.z });
  }
  if (e.tA >= 62) { e.act = 2; e.tA = 0; e.life = Math.min(e.life, 18); e.vy = 13; e.grounded = false; W.emit('buddyBye', { id: e.id, x: e.x, y: e.y + 1.6, z: e.z, k: e.look }); }
}

// one friend of each at a time: calling him again sends the old one home
function callBuddy(W, F, look, props) {
  for (const o of W.entities) if (!o.dead && o.kind === 'buddy' && o.owner === F.slot && o.look === look) { o.dead = true; }
  return W.spawn('buddy', { owner: F.slot, look, a: F.facing, ...props });
}

// the beam of the neutral special (also the bot's favourite)
function fireBeam(F, W, c) {
  const e = W.spawn('beam', {
    owner: F.slot, at: [0, 1.2, 0.6], a: F.facing, b: 0, c,
    max: 5.5 + 6.5 * c, r: 0.42 + 0.38 * c, life: 22 + Math.round(24 * c), tick: 1.0 + 0.6 * c, fin: 5 + 10 * c, grow: 55 + 25 * c,
  });
  const p = localToWorld(F, e.at); e.x = p[0]; e.y = p[1]; e.z = p[2];
  F.mv.beam = e.id; F.mv.beamEnd = F.mf + e.life + 6;
  W.emit('kameFire', { s: F.slot, c, x: p[0], y: p[1], z: p[2], a: F.facing });
  return e;
}

const moves = {
  ...normals({ power: 1.12, reach: 1.04, speed: 0.88, smashLunge: 1.0, sfxS: 'slap', sfxM: 'hitM', sfxL: 'hitL' }),
  // neutral A: three big open-hand slaps (m_slaps3): a forehand across, one from high down, a crushing low one
  jab1: {
    dur: 22, iasa: 18, next: 'jab2', nextWin: [7, 21], pose: 'jab1', combo: true,
    hits: [hb(5, 7, [0.05, 1.2, 0.62], 0.5, 4.4, 35, 14, 26, { sfx: 'slap', blood: 0.9, fx: 'slap' })],
  },
  jab2: {
    dur: 24, iasa: 20, next: 'jab3', nextWin: [8, 23], pose: 'jab2', combo: true,
    hits: [hb(7, 9, [0, 1.3, 0.75], 0.55, 4.8, 40, 16, 30, { sfx: 'slap', blood: 1, fx: 'slap' })],
  },
  jab3: {
    dur: 40, iasa: 34, pose: 'jab3',
    vel: [{ f: [6, 9], fwd: 3 }],
    hits: [hb(11, 14, [0, 0.55, 0.85], 0.62, 9.5, 45, 44, 92, { sfx: 'hitL', blood: 1.8, hitlag: 1.25, fx: 'slap' })],
  },
  // side smash: a short kamehameha, blue energy right out of the palms (longer and stronger with the charge)
  smash: {
    dur: 50, charge: { at: 9, max: 60 }, pose: 'kame', tilt: 'ftilt', timeline: { a: 13, b: 26 },
    onCharge(F) { F.va[0] = 0.15 + (F.mv.charge / 60) * 0.5; },
    onFrame(F, W, f) {
      if (f < 13) F.va[0] = Math.max(F.va[0], (f / 13) * 0.2);
      if (f === 13) {
        const c = (F.mv.charge || 0) / 60;
        const e = W.spawn('beam', { owner: F.slot, at: [0, 1.2, 0.55], a: F.facing, b: 0, c, max: 2.3 + 1.1 * c, r: 0.5 + 0.18 * c, life: 15,
          tick: 1.4, fin: 13 + 7 * c, finAng: 36, finKbb: 40 + 12 * c, finKbg: 96, grow: 90 });
        const p = localToWorld(F, e.at); e.x = p[0]; e.y = p[1]; e.z = p[2];
        F.mv.beam = e.id; F.va[1] = 1; F.va[0] = 0;
        W.emit('kameFire', { s: F.slot, c: 0.25 + c * 0.4, x: p[0], y: p[1], z: p[2], a: F.facing });
      }
      if (f > 30) F.va[1] = Math.max(0, F.va[1] - 0.12);
    },
    onEnd(F) { F.va[0] = 0; F.va[1] = 0; },
  },
  // down smash: he drops into the splits, both legs stretched straight out: it hits in front and behind at once
  dsmash: {
    dur: 50, charge: { at: 5, max: 60 }, pose: 'dsmash', tilt: 'dtilt',
    hits: [
      // the feet (about 0.95 m out on each side, measured): the sweet spots; the thighs, a little weaker
      hb(9, 13, [0, 0.3, 0.9], 0.5, 14, 28, 36, 94, { sfx: 'hitL', blood: 1.8, dir: 'away', hitlag: 1.15 }),
      hb(9, 13, [0, 0.3, -0.9], 0.5, 14, 28, 36, 94, { sfx: 'hitL', blood: 1.8, dir: 'away', grp: 0 }),
      hb(9, 12, [0, 0.3, 0.35], 0.45, 11, 30, 30, 84, { sfx: 'hitM', blood: 1.2, dir: 'away', grp: 0 }),
      hb(9, 12, [0, 0.3, -0.35], 0.45, 11, 30, 30, 84, { sfx: 'hitM', blood: 1.2, dir: 'away', grp: 0 }),
    ],
  },
  // up smash: the spirit bomb, arms raised, a ball of energy bursts out of his palms over his head
  usmash: {
    dur: 50, charge: { at: 9, max: 60 }, pose: 'usmash', tilt: 'utilt',
    onCharge(F) { F.va[2] = 0.3 + (F.mv.charge / 60) * 0.5; },
    onFrame(F, W, f) {
      if (f >= 9 && f <= 22) F.va[2] = Math.min(1.4, Math.max(F.va[2], 0.3 + (f - 9) * 0.1));
      else if (f > 22) F.va[2] = Math.max(0, F.va[2] - 0.12);
      if (f === 14) W.emit('genki', { s: F.slot });
    },
    hits: [
      hb(14, 19, [0, 2.5, 0.15], 0.8, 16, 88, 38, 98, { sfx: 'hitL', blood: 1.6, dir: 'radial', fx: 'kameBlast' }),
      hb(14, 17, [0, 1.8, 0.2], 0.6, 12, 84, 32, 90, { sfx: 'hitM', blood: 1.2, dir: 'radial', grp: 0 }),
    ],
    onEnd(F) { F.va[2] = 0; },
  },
  // A while running: its own dash attack
  dashattack: dashAttack({ pose: 'flykick', boost: 12, fric: 20, dur: 36, hits: [hb(6, 10, [0, 1.25, 1.0], 0.8, 11, 40, 46, 78, { sfx: 'hitL', blood: 1.4 })] }),

  // Kamehameha : maintenir X pour charger (KA... ME... HA... ME...), relâcher : HAAAAA !
  sp_n: {
    dur: 80, charge: { at: 10, max: 100, btn: 'X' }, pose: 'kame', airCtrl: 0.25, groundFric: 40, timeline: { a: 11, b: 60 },
    onStart(F, W) { W.emit('kameStart', { s: F.slot }); },
    onCharge(F, W) {
      const c = F.mv.charge;
      F.va[0] = c / 100;
      if (!F.grounded) F.vy = Math.max(F.vy, -2.5); // he hovers a little while charging in the air
      if (c === 1 || c === 26 || c === 52 || c === 78) W.emit('kameSyl', { s: F.slot, n: Math.round(c / 26) });
    },
    onFrame(F, W, f) {
      if (f <= 10) { F.va[0] = Math.max(F.va[0], (f / 10) * 0.12); return; }
      if (f === 11) { fireBeam(F, W, (F.mv.charge || 0) / 100); F.va[1] = 1; }
      if (F.mv.beam !== undefined && f < F.mv.beamEnd - 6) {
        // recoil and hover while the beam pours out
        const back = 1.4 + (F.mv.charge || 0) * 0.015;
        F.vx = -DMath.sin(F.facing) * back; F.vz = -DMath.cos(F.facing) * back;
        if (!F.grounded) F.vy = Math.max(F.vy * 0.85, -0.6);
        F.va[0] = Math.max(0, F.va[0] - 0.03);
      } else { F.va[1] = Math.max(0, F.va[1] - 0.15); }
      if (F.mv.beamEnd !== undefined && f >= F.mv.beamEnd) finish(F, W);
    },
    onEnd(F) { F.va[0] = 0; F.va[1] = 0; },
  },

  // CD-Man ! Il sort d'un disque à côté de Pandrezz et lance trois CD (le dernier en or) sur l'ennemi le plus proche
  sp_s: {
    dur: 34, iasa: 28, pose: 'summon', airCtrl: 0.5,
    onFrame(F, W, f) {
      if (f === 9) {
        // he pops up just beside Pandrezz, a step behind him in depth, so he does not hide him (keepZ)
        const side = localToWorld(F, [0, 0, 0.7]);
        const s = W.stage.findLanding(side[0], 0, F.y + 1.5, F.y - 30);
        const y = s ? W.stage.heightAt(s, side[0], 0) : F.y;
        const e = callBuddy(W, F, 'cdman', { x: side[0], y, z: -1.0, keepZ: true, grounded: !!s, surf: s ? s.idx : 0, hp: 12, life: 92 });
        W.emit('summon', { s: F.slot, k: 'cdman', id: e.id, x: e.x, y: e.y, z: e.z });
      }
    },
  },

  // Vinylman ! Il tombe du ciel devant Pandrezz (onde de choc), tourne comme un disque sur la platine, et lâche les basses
  sp_d: {
    dur: 40, iasa: 34, pose: 'call', airCtrl: 0.4,
    onFrame(F, W, f) {
      if (f === 8) {
        const p = localToWorld(F, [0, 0, 2.4]);
        const e = callBuddy(W, F, 'vinylman', { x: p[0], y: F.y + 9, z: p[2], vy: -22, hp: 16, life: 130 });
        W.emit('summon', { s: F.slot, k: 'vinylman', id: e.id, x: p[0], y: F.y, z: p[2] });
      }
    },
  },

  // Kamé-fusée : le kamehameha tiré vers le bas le propulse, dans toutes les directions du stick
  sp_u: {
    dur: 56, pose: 'kamedown', helpless: true, noGrav: [0, 42], airCtrl: 0.15, ledgeGrab: true,
    onStart(F, W) { W.emit('kameStart', { s: F.slot }); },
    onFrame(F, W, f) {
      if (f < 7) { F.vx *= 0.7; F.vz *= 0.7; F.vy *= 0.5; F.va[0] = f / 7 * 0.45; }
      if (f === 7) {
        const e = W.spawn('beam', { owner: F.slot, at: [0, 0.8, 0.28], a: F.facing, b: -Math.PI / 2, down: true, c: 0.3,
          max: 4.2, r: 0.55, life: 36, tick: 1.6, fin: 6, grow: 70 });
        const p = localToWorld(F, e.at); e.x = p[0]; e.y = p[1]; e.z = p[2];
        F.mv.beam = e.id; F.grounded = false; F.va[1] = 1;
        W.emit('kameFire', { s: F.slot, c: 0.3, x: p[0], y: p[1], z: p[2], a: F.facing, down: 1 });
      }
      if (f >= 7 && f <= 40) {
        F.vy = 18.5 - (f - 7) * 0.24 + F.my * 2;
        const mag = DMath.hypot(F.mx, F.my);
        if (mag > 0.3) {
          const [sx] = stickToWorld(F.mx / mag, F.my / mag, W.camYaw);
          F.vx += (sx * 9.5 - F.vx) * 0.16;
        } else { F.vx *= 0.95; F.vz *= 0.95; }
        F.va[0] = Math.max(0, F.va[0] - 0.02);
      }
      if (f > 42) { F.mv.beam = -1; F.va[1] = Math.max(0, F.va[1] - 0.1); }
    },
    // the blast-off sucks whoever stands next to him into the energy under his feet (drag), the beam carries them up
    hits: [hb(7, 10, [0, 0.6, 0], 1.1, 4, 80, 10, 10, { sfx: 'hitM', blood: 1, fx: 'zap', drag: [0.1, -1.25, 16] })],
    onEnd(F) { F.va[0] = 0; F.va[1] = 0; },
  },
};

export default {
  id: 'pandrezz', name: 'Pandrezz', title: 'Un mec très fort. Genre vraiment très fort.',
  color: '#ff4fa3',
  stats: { weight: 102, runSpeed: 8.4, walkSpeed: 3.6, airSpeed: 6.4, airAccel: 34, groundAccel: 64, friction: 46,
    jumpVel: 16.2, airJumpVel: 14.2, airJumps: 1, gravity: 1.0, fallSpeed: 17.5, height: 1.85, radius: 0.55 },
  moves,
  bot: { beam: true },
  specialsInfo: { n: 'Kamehameha (maintenir)', s: 'CD-Man !', u: 'Kamehameha-fusée', d: 'Vinylman !' },
};
