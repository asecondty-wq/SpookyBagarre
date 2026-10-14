// Shared pieces of the seven friends (Aboueb, Tices, OMFU, Lolobiscotto, J'san, Nymano, BIDO):
// burning, a cone of fire, a companion that fights for its owner (J'san's shiba), puddles and clouds.
import { ENTITIES, nearestEnemy } from '../entities.js';
import { localToWorld } from '../util.js';
import { DT, GRAVITY } from '../constants.js';
import { DMath } from '../dmath.js';

// --- burning: a fighter on fire takes small hits for a while (no launch) ----------------------------------------
ENTITIES.burn = {
  pack: (e) => ['burn', 1, 0, e.vic ?? -1],
  unpack: (e, x) => { if (x) { [e.look, , , e.vic] = x; } },
  defaults: () => ({ life: 120, every: 20, dmg: 1.6 }),
  step(e, W) {
    const V = W.fighters[e.vic];
    if (!V || V.out || V.state === 'dead' || V.state === 'respawn') { e.dead = true; return; }
    e.x = V.x; e.y = V.y + V.height * 0.5; e.z = V.z;
    if (e.t % e.every === 0) e.tickNow = 1;
    if (e.t % 6 === 0) W.emit('burnFx', { x: V.x, y: V.y + V.height * 0.5, z: V.z, s: e.vic });
  },
  hits(e, W) {
    if (!e.tickNow) return null;
    e.tickNow = 0;
    const V = W.fighters[e.vic];
    if (!V) return null;
    return { owner: e.owner, key: 'burn' + e.id + ':' + e.t, x: V.x, y: V.y + V.height * 0.5, z: V.z, r: 1.2, dmg: e.dmg, ang: 80, kbb: 0, kbg: 0,
      dir: 'radial', noLaunch: true, ent: e.id, src: 'proj', sfx: 'sizzle', blood: 0, multi: true, hitlag: 0.2, move: 'burn', unblockable: true };
  },
};
export function setOnFire(W, owner, V, ticks = 5, dmg = 1.6) {
  for (const o of W.entities) if (o.kind === 'burn' && o.vic === V.slot && !o.dead) { o.life = Math.max(o.life, ticks * 20); return o; }
  W.emit('ignite', { x: V.x, y: V.y + 1, z: V.z });
  return W.spawn('burn', { owner, vic: V.slot, x: V.x, y: V.y, z: V.z, life: ticks * 20 + 2, dmg });
}

// --- a cone of fire (or of anything) in front of the fighter: a few small hits along it ---------------------------
export function cone(W, F, key, len, h, r, p) {
  for (let i = 1; i <= 3; i++) {
    const d = (len * i) / 3;
    const c = localToWorld(F, [0, h, 0.4 + d]);
    W.addHit({ owner: F.slot, key: `${key}${F.mseq}:${i}`, x: c[0], y: c[1], z: c[2], r: r * (0.6 + i * 0.2), dir: 'face', dirAngle: F.facing,
      ox: F.x, oz: F.z, sfx: 'hitS', blood: 0.4, move: F.move, rehit: 6, ...p });
  }
}

// --- a companion that follows its owner and attacks on command (J'san's shiba) ------------------------------------
// e.cmd: '' idle, 'bite' (lunge in front), 'dash' (runs far ahead and back), 'jump' (headbutt upward),
// 'spin' (around the owner), 'bark' (shockwave), 'lift' (jumps up, pulling the owner on the leash)
ENTITIES.pet = {
  pack: (e) => [e.look || 'shiba', Math.round((e.a || 0) * 1000) / 1000, e.cmd || '', e.ct || 0],
  unpack: (e, x) => { if (x) { [e.look, e.a, e.cmd, e.ct] = x; } },
  defaults: () => ({ look: 'shiba', r: 0.4, h: 0.7, life: undefined, cmd: '', ct: 0, grounded: false, a: Math.PI / 2, keepZ: true }),
  step(e, W) {
    const F = W.fighters[e.owner];
    if (!F || F.out) { e.dead = true; return; }
    const fx = DMath.sin(F.facing);
    const hidden = F.state === 'dead' || F.state === 'respawn';
    e.ct++;
    const yPrev = e.y;
    const go = (tx, ty, k) => { e.vx = (tx - e.x) * k; if (ty !== undefined) e.vy = (ty - e.y) * k; };
    switch (e.cmd) {
      case 'bite': {
        const tx = F.x + fx * (0.9 + Math.min(1, e.ct / 6) * 1.2);
        go(tx, undefined, 18); e.a = F.facing; e.z = 0.25;
        if (e.ct === 6) e.attackNow = { k: 'bite', r: 0.75, dmg: e.dmg || 7, ang: 40, kbb: 26, kbg: 55 };
        if (e.ct > 16) e.cmd = '';
        break;
      }
      case 'dash': {
        // Va chercher ! : it sprints from J'san's side, jumps at the first foe it meets, hangs on biting, then
        // a last big bite sends the foe flying; it trots back after
        if (e.ct === 1) { e.dir = fx; e.a = F.facing; e.x = F.x + fx * 0.5; e.latch = -1; e.lt = 0; W.emit('bark', { id: e.id, x: e.x, y: e.y + 0.6, z: e.z }); }
        e.z = 0.25;
        if (e.latch >= 0) {
          const V = W.fighters[e.latch];
          e.lt++;
          if (!V || V.state === 'dead' || V.out) { e.latch = -2; }
          else {
            e.x = V.x - e.dir * 0.35; e.y = V.y + 0.9; e.vx = 0; e.vy = 0; e.grounded = false; e.a = e.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
            if (e.lt % 6 === 0 && e.lt < 24) e.attackNow = { k: 'gnaw', r: 0.9, dmg: 2.5, ang: 70, kbb: 0, kbg: 0, fkb: 22, dy: -0.4, rehit: 1 };
            if (e.lt === 26) { e.attackNow = { k: 'shake', r: 1.0, dmg: (e.dmg || 1) * 9, ang: 40, kbb: 46, kbg: 74, dy: -0.4, rehit: 1 }; W.emit('bark', { id: e.id, x: e.x, y: e.y + 0.6, z: e.z }); }
            if (e.lt >= 28) { e.latch = -2; e.vy = 6; e.vx = -e.dir * 4; }
            e.hidden = hidden ? 1 : 0;
            return;
          }
        }
        const out = e.latch === -1 && e.ct < 24;
        if (out) {
          e.vx = e.dir * 21;
          for (const V of W.fighters) {
            if (V === F || V.out || V.state === 'dead' || V.intangible > 0 || V.invuln > 0) continue;
            if (V.team === F.team && W.rules.teams) continue;
            if (Math.abs(V.x - e.x) < 0.9 && V.y - e.y < 1.6 && e.y - V.y < 1.4) { e.latch = V.slot; e.lt = 0; break; }
          }
        } else { e.vx = (F.x - e.x) > 0 ? 12 : -12; e.a = e.vx > 0 ? Math.PI / 2 : -Math.PI / 2; }
        if (e.ct > 80 || (!out && Math.abs(e.x - F.x) < 0.9)) e.cmd = '';
        break;
      }
      case 'jump': {
        go(F.x + fx * 0.6, undefined, 14); e.a = F.facing; e.z = 0.25;
        if (e.ct === 3) { e.vy = 15; e.grounded = false; }
        if (e.ct >= 4 && e.ct <= 12 && e.ct % 4 === 0) e.attackNow = { k: 'jump', r: 1.0, dmg: e.ct === 8 ? 11 : 4, ang: 86, kbb: 34, kbg: e.ct === 8 ? 82 : 30, dy: 0.4 };
        if (e.ct > 30) e.cmd = '';
        break;
      }
      case 'spin': {
        const a = e.ct * 0.55;
        e.x = F.x + DMath.sin(a) * 1.4; e.z = DMath.cos(a) * 1.0; e.vx = 0; e.a = a + Math.PI / 2;
        if (e.ct % 5 === 0) e.attackNow = { k: 'spin', r: 0.9, dmg: e.ct >= 20 ? 9 : 2.5, ang: e.ct >= 20 ? 30 : 50, kbb: e.ct >= 20 ? 34 : 10, kbg: e.ct >= 20 ? 84 : 20, dir: 'away' };
        if (e.ct > 24) { e.cmd = ''; e.z = 0.25; }
        break;
      }
      case 'bark': {
        e.vx = 0; e.a = F.facing;
        if (e.ct === 4) { W.spawn('ring', { owner: e.owner, x: e.x, y: e.y, z: 0, look: 'bark', r: 0.5, grow: 13, life: 18, dmg: 6, ang: 70, kbb: 28, kbg: 46, w: 0.9, h: 1.4, sfx: 'bark', blood: 0.3 }); W.emit('bark', { id: e.id, x: e.x, y: e.y + 0.6, z: e.z }); }
        if (e.ct > 22) e.cmd = '';
        break;
      }
      case 'lift': {
        // the shiba jumps up first; the owner follows on the leash (moved by the owner's own move)
        e.x = F.x; e.y = F.y + 2.2; e.z = 0.3; e.vx = 0; e.vy = 0; e.a = F.facing; e.grounded = false;
        if (e.ct > 60 || F.move !== 'sp_u') e.cmd = '';
        return;
      }
      default: {
        // follows behind the owner, a step in front in depth so he never hides him
        const tx = F.x - fx * 1.0;
        const d = tx - e.x;
        e.vx = Math.abs(d) > 0.35 ? Math.sign(d) * Math.min(11, Math.abs(d) * 6) : e.vx * 0.6;
        if (Math.abs(e.vx) > 0.5) e.a = e.vx > 0 ? Math.PI / 2 : -Math.PI / 2; else e.a = F.facing;
        e.z += (0.25 - e.z) * 0.2;
        // far away (owner flew off, respawned...): it pops back next to him
        if (Math.abs(F.x - e.x) > 9 || Math.abs(F.y - e.y) > 7) { e.x = F.x - fx * 0.8; e.y = F.y + 0.5; e.vy = 0; e.grounded = false; }
      }
    }
    if (!e.grounded) e.vy -= GRAVITY * DT;
    e.x += e.vx * DT; e.y += e.vy * DT;
    if (e.vy <= 0) {
      const s = W.stage.findLanding(e.x, 0, yPrev, e.y);
      if (s) { e.y = W.stage.heightAt(s, e.x, 0); e.vy = 0; e.grounded = true; e.surf = s.idx; }
      else if (e.grounded) { const su = W.stage.surfaces[e.surf ?? 0]; if (!W.stage.supports(su, e.x, 0)) e.grounded = false; else e.y = W.stage.heightAt(su, e.x, 0); }
    }
    if (e.y < -16) { e.x = F.x; e.y = F.y + 1; e.vy = 0; }
    e.hidden = hidden ? 1 : 0;
  },
  hits(e) {
    const h = e.attackNow; e.attackNow = null;
    if (!h || e.hidden) return null;
    return { owner: e.owner, key: 'pet' + e.id + ':' + h.k + ':' + (h.rehit ? Math.floor(e.ct / h.rehit) : h.k === 'spin' || h.k === 'jump' ? e.ct : e.ct0 || 0), x: e.x + DMath.sin(e.a) * 0.4, y: e.y + 0.45 + (h.dy || 0), z: 0,
      r: h.r, dmg: h.dmg, ang: h.ang, kbb: h.kbb, kbg: h.kbg, fkb: h.fkb, dir: h.dir || 'face', dirAngle: e.a, ox: e.x, oz: 0, ent: e.id, src: 'pet',
      sfx: h.k === 'bite' || h.k === 'dash' || h.k === 'gnaw' || h.k === 'shake' ? 'chomp' : 'hitM', blood: 1, move: 'shiba:' + h.k, hitlag: 0.9 };
  },
};
export function petOf(W, F) { return W.entities.find((e) => e.kind === 'pet' && e.owner === F.slot && !e.dead); }
export function ensurePet(W, F, look = 'shiba') {
  let p = petOf(W, F);
  if (!p) p = W.spawn('pet', { owner: F.slot, look, x: F.x - DMath.sin(F.facing), y: F.y + 0.3, z: 0.25, keepZ: true });
  return p;
}
export function petCmd(W, F, cmd, dmg) { const p = ensurePet(W, F); p.cmd = cmd; p.ct = 0; p.dmg = dmg; p.ct0 = F.mseq; return p; }

export { nearestEnemy };
