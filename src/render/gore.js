// Gore that stays (16 Oct 2026). Display only: the simulation never sees it (rollback-safe; the frames a rollback
// plays again do not play it again). On top of the drops (particles.js) and the stains (decals.js):
//  - puddles: glossy pools of fresh blood (fxShaders.js puddleMat: a liquid edge, the night sky in it, ripples) that
//    spread where a fighter lands hard, bounces, or where a big gob falls, grow when more blood drips in, then dry
//    away into the stain painted under them;
//  - arterial jets: on the big blows, a stream (streamObj) that pulses three times out of the wound, stuck to the victim
//    as it flies, dripping onto the floor;
//  - bloody footprints: a fighter who steps in a puddle leaves prints, fainter and fainter, and splashes landing in one;
//  - at « À FOISON » (Hémoglobine 3), real liquid: the heavy gobs of a big blow are one continuous surface that merges and
//    splits in flight and flattens where it lands (marching cubes: three's MarchingCubes, a box of 2.6 m around the
//    blow, two at most at a time, skipped when the machine is slow).
// Nothing big or lasting in the air: what stays is on the floor (the screen must stay readable).
import * as THREE from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { puddleMat, streamObj } from './fxShaders.js';
import { STYLE } from './style.js';

export const FRESH = '#8c0a0e', DARK = '#5a0006', KETCHUP = '#c81818';

const MAX_PUDDLES = 20, MAX_JETS = 6, MAX_GUSH = 3;
// the liquid: the box (m), its resolution, the iso level and the falloff of the balls (MarchingCubes.addBall)
const MC_SIZE = 2.6, MC_RES = 34, ISO = 80, SUB = 36; // (SUB: how far a ball reaches past its surface: 1.7 times its radius)
const strength = (r) => (r / MC_SIZE) ** 2 * (ISO + SUB); // a ball whose surface is r metres from its centre
const SLOW = 1 / 42; // a frame longer than that (smoothed): no new liquid

// the liquid's matcap: a ball of fresh blood lit from the top left (drawn once)
let MATCAP = null;
function wetMatcap() {
  if (MATCAP) return MATCAP;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const body = g.createRadialGradient(54, 50, 6, 64, 64, 64);
  body.addColorStop(0, '#d0222a'); body.addColorStop(0.45, '#8a070c'); body.addColorStop(0.85, '#3a0204'); body.addColorStop(1, '#160001');
  g.fillStyle = body; g.fillRect(0, 0, 128, 128);
  const hl = g.createRadialGradient(42, 36, 0, 42, 36, 16);
  hl.addColorStop(0, 'rgba(255,240,240,0.95)'); hl.addColorStop(0.5, 'rgba(255,170,170,0.35)'); hl.addColorStop(1, 'rgba(255,120,120,0)');
  g.fillStyle = hl; g.fillRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(255,200,200,0.25)'; g.beginPath(); g.ellipse(88, 96, 10, 4, -0.6, 0, Math.PI * 2); g.fill(); // a second, soft light
  MATCAP = new THREE.CanvasTexture(c); MATCAP.colorSpace = THREE.SRGBColorSpace;
  return MATCAP;
}

export class Gore {
  // group: where its objects go (the stains' group: a mini-game that hides the arena hides them too), level: the
  // Hémoglobine option (0 none, 1 ketchup, 2 lots, 3 À FOISON)
  constructor(group, stage, particles, decals, level = 3) {
    this.group = group; this.stage = stage; this.P = particles; this.decals = decals; this.B = level;
    this.color = level === 1 ? KETCHUP : FRESH;
    this.disc = new THREE.CircleGeometry(1, 48);
    this.puddles = [];
    this.jets = [];
    for (let i = 0; i < MAX_JETS; i++) {
      const m = streamObj(this.color, { r: 0.06, op: 0.95 });
      m.visible = false; m.renderOrder = 3;
      group.add(m);
      this.jets.push({ m, t: 0, life: 0, dropT: 0 });
    }
    this.gushes = [];
    if (level >= 3 && STYLE.smooth) {
      // a wet look whatever the lights (a matcap: dark edges, a red body, a sharp highlight)
      this.mcMat = new THREE.MeshMatcapMaterial({ matcap: wetMatcap(), color: '#ffffff' });
      for (let i = 0; i < MAX_GUSH; i++) {
        const mc = new MarchingCubes(MC_RES, this.mcMat, false, false, 9000);
        mc.isolation = ISO;
        mc.scale.setScalar(MC_SIZE / 2);
        mc.visible = false; mc.frustumCulled = false; mc.castShadow = false;
        group.add(mc);
        this.gushes.push({ mc, gobs: [], on: false, t0: 0, c: new THREE.Vector3() });
      }
    }
    this.feet = {};
    this.ft = 1 / 60; // smoothed frame time
    this.t = 0;
  }

  // the index of the platform under (x, y, z) and its height there
  surfaceUnder(x, y, z, margin = 0) {
    const st = this.stage;
    let si = -1, by = -Infinity;
    st.surfaces.forEach((s, i) => {
      if (!s.active || !st.inside3(s, x, z, margin)) return;
      const h = st.heightAt(s, x, z);
      if (h <= y + 0.4 && h > by) { si = i; by = h; }
    });
    return si < 0 ? null : { si, y: by };
  }

  // ---- puddles -------------------------------------------------------------------------------------------------
  // a puddle of radius r (m) on the platform under (x, y, z); a fresh one close by grows instead
  puddle(x, y, z, r = 1) {
    if (this.B < 2) return null;
    const S = this.surfaceUnder(x, y, z, -0.2);
    if (!S) return null;
    const near = this.puddles.find((p) => !p.gone && p.si === S.si && p.t < p.life && Math.hypot(p.wx - x, p.wz - z) < p.r * 0.8);
    if (near) { near.r = Math.min(near.r0 * 1.8, Math.hypot(near.r, r * 0.6)); this.decals.list[S.si].pool(x, z, r * 0.8, DARK); return near; }
    // the stain it leaves, painted at once under it (it shows as the puddle dries away)
    this.decals.pool(x, z, r * 0.85, DARK, S.y + 0.1);
    const live = this.puddles.filter((p) => p.t < p.life);
    if (live.length >= MAX_PUDDLES) live[0].life = live[0].t; // the oldest dries now
    const m = puddleMat(this.color, { op: 0.9, lit: this.B === 1 ? 0.9 : 0.7, sky: '#24101c', rim: 0.04, rip: 0.07 });
    const disc = new THREE.Mesh(this.disc, m);
    disc.renderOrder = 3;
    this.group.add(disc);
    // its place in the platform's own frame (it turns and moves with it)
    const s = this.stage.surfaces[S.si], a = -(s.angle || 0), dx = x - s.cx, dz = z - s.cz;
    const p = { disc, m, si: S.si, lx: dx * Math.cos(a) + dz * Math.sin(a), lz: -dx * Math.sin(a) + dz * Math.cos(a), r, r0: r, t: 0, life: 22 + Math.random() * 8, rot: Math.random() * 6, wx: x, wy: S.y, wz: z, k: 0 };
    this.puddles.push(p);
    return p;
  }

  // the fresh puddle under (x, y, z), if any
  puddleAt(x, y, z) {
    for (const p of this.puddles) {
      if (p.gone || p.t > p.life || Math.abs(y - p.wy) > 0.5) continue;
      const ex = (x - p.wx) / (p.r * 1.1 * p.k + 0.01), ez = (z - p.wz) / (p.r * 0.75 * p.k + 0.01);
      if (ex * ex + ez * ez < 1) return p;
    }
    return null;
  }

  updatePuddles(dt) {
    const st = this.stage;
    for (const p of this.puddles) {
      p.t += dt;
      const s = st.surfaces[p.si];
      const a = s.angle || 0, c = Math.cos(a), sn = Math.sin(a);
      // (the inverse of the turn that put it in the platform's frame)
      p.wx = s.cx + c * p.lx + sn * p.lz; p.wz = s.cz - sn * p.lx + c * p.lz;
      p.wy = st.heightAt(s, p.wx, p.wz);
      // it spreads fast where it lands, then slowly; it dries away at the end
      p.k = (1 - Math.pow(1 - Math.min(1, p.t / 1.6), 3)) * (1 + Math.min(0.25, p.t * 0.02));
      const fade = p.t > p.life ? Math.max(0, 1 - (p.t - p.life) / 2.5) : 1;
      p.disc.position.set(p.wx, p.wy + 0.035, p.wz);
      p.disc.rotation.set(-Math.PI / 2, 0, p.rot + a);
      p.disc.scale.set(p.r * 1.1 * p.k, p.r * 0.75 * p.k, 1);
      p.disc.visible = s.active !== false && fade > 0;
      const U = p.m.uniforms;
      U.uTime.value = this.t; U.uFade.value = fade; U.uBirth.value = Math.min(1, p.t / 1.2);
      if (fade <= 0) { p.gone = true; this.group.remove(p.disc); p.m.dispose(); }
    }
    if (this.puddles.some((p) => p.gone)) this.puddles = this.puddles.filter((p) => !p.gone);
  }

  // ---- arterial jets -------------------------------------------------------------------------------------------
  // out of the wound of V's fighter, hit at (x, y, z) and launched along nd: it trails behind it and up, pulsing
  jet(V, x, y, z, nd, power = 1) {
    if (this.B < 2 || !V) return;
    const J = this.jets.find((j) => j.life <= 0) || this.jets.reduce((a, b) => (a.t > b.t ? a : b));
    const R = V.root.position;
    const d = new THREE.Vector3(-nd[0] * 0.7, 0.75, (Math.random() - 0.5) * 0.3).normalize();
    Object.assign(J, { V, off: [x - R.x, Math.max(0.5, y - R.y), z - R.z], dir: d, len: 1.2 + power * 0.9, t: 0, life: 0.5 + power * 0.25, dropT: 0 });
    J.m.visible = true;
  }

  updateJets(dt) {
    for (const J of this.jets) {
      if (J.life <= 0) continue;
      J.t += dt;
      const R = J.V.root.position;
      if (J.t >= J.life || !J.V.root.visible) { J.life = 0; J.m.visible = false; continue; }
      const U = J.m.material.uniforms, d = J.dir;
      const env = Math.sin(Math.PI * J.t / J.life), pulse = 0.4 + 0.6 * Math.max(0, Math.sin(J.t * Math.PI * 2 * 4.5));
      const len = J.len * (0.5 + 0.5 * pulse) * Math.min(1, J.t / 0.06);
      U.uA.value.set(R.x + J.off[0], R.y + J.off[1], R.z + J.off[2]);
      const A = U.uA.value;
      U.uK.value.set(A.x + d.x * len * 0.55, A.y + d.y * len * 0.55 + len * 0.15, A.z + d.z * len * 0.55);
      U.uB.value.set(A.x + d.x * len, A.y + d.y * len * 0.35 - len * 0.45, A.z + d.z * len);
      U.uR.value = 0.055 * (0.45 + pulse * 0.65) * env;
      U.uEnd.value = 1; U.uTime.value = this.t;
      // what falls from its end: drops that stain the floor
      if ((J.dropT -= dt) <= 0) { J.dropT = 0.035; const B = U.uB.value; this.P.blood(B.x, B.y, B.z, [d.x, -0.3, d.z], 2, 0.35); }
    }
  }

  // ---- the liquid (marching cubes) -------------------------------------------------------------------------------
  // a big blow at « À FOISON »: a gush of heavy gobs, one liquid; false when there is none to give (the drops do it)
  gush(x, y, z, nd, power = 1) {
    if (!this.gushes.length || this.ft > SLOW) return false;
    const G = this.gushes.find((g) => !g.on) || this.gushes.reduce((a, b) => (a.t0 < b.t0 ? a : b));
    G.on = true; G.t0 = this.t;
    // the box: around the blow, a little toward where it sends, low enough to hold the floor under it
    G.c.set(x + nd[0] * 0.6, y - 0.25, z);
    G.mc.position.copy(G.c);
    G.mc.visible = true;
    G.gobs = [];
    const n = Math.round(9 + power * 7);
    for (let i = 0; i < n; i++) {
      const sp = (1.6 + Math.random() * 3.2) * (0.8 + power * 0.25);
      const vx = nd[0] * sp * 0.7 + (Math.random() - 0.5) * sp * 0.8, vz = (Math.random() - 0.5) * sp * 0.5;
      const vy = Math.max(0, nd[1]) * sp * 0.5 + Math.random() * sp * 0.6 + 0.8;
      G.gobs.push({ x, y, z, vx, vy, vz, r: 0.075 + Math.random() * 0.07, life: 1.6 + Math.random() * 0.8, landed: false, lt: 0 });
    }
    return true;
  }

  updateGush(G, dt) {
    const st = this.stage, c = G.c, mc = G.mc;
    const m0 = 2 / MC_RES;
    let alive = 0;
    mc.reset();
    for (const g of G.gobs) {
      if (g.dead) continue;
      g.life -= dt;
      if (g.life <= 0) { g.dead = true; continue; }
      if (!g.landed) {
        const py = g.y;
        g.vy -= 22 * dt;
        g.x += g.vx * dt; g.y += g.vy * dt; g.z += g.vz * dt;
        const s = g.vy < 0 ? st.findLanding3(g.x, g.z, py, g.y) : null;
        if (s) {
          g.landed = true; g.y = st.heightAt(s, g.x, g.z); g.lt = 0;
          // where it lands: a stain thrown along its way; the big ones (or some) a puddle (a fresh one near grows)
          this.decals.splatOn(s.idx, g.x, g.z, 0.8 + g.r * 7, FRESH, true, [g.vx, g.vz]);
          if (g.r > 0.11 || Math.random() < 0.3) this.puddle(g.x, g.y, g.z, 0.3 + g.r * 3.5);
          g.life = Math.min(g.life, 0.9);
          g.vx *= 0.3; g.vz *= 0.3;
        }
      } else { g.lt += dt; const k = Math.exp(-g.lt * 5); g.x += g.vx * dt * k; g.z += g.vz * dt * k; }
      const ux = (g.x - c.x) / MC_SIZE + 0.5, uy = (g.y - c.y) / MC_SIZE + 0.5, uz = (g.z - c.z) / MC_SIZE + 0.5, mg = g.r / MC_SIZE + m0;
      // out of the box: it goes on as plain drops
      if (ux < mg || ux > 1 - mg || uy < mg || uy > 1 - mg || uz < mg || uz > 1 - mg) {
        if (!g.landed) this.P.blood(g.x, g.y, g.z, [g.vx * 0.05, 0.2, g.vz * 0.05], 3, 0.3);
        g.dead = true;
        continue;
      }
      alive++;
      if (!g.landed) {
        // a teardrop along its flight: its head and a smaller tail behind, merged
        const v = Math.hypot(g.vx, g.vy, g.vz) || 1, tl = Math.min(0.22, v * 0.03) / MC_SIZE;
        mc.addBall(ux, uy, uz, strength(g.r), SUB);
        if (tl > 0.004) mc.addBall(ux - (g.vx / v) * tl, uy - (g.vy / v) * tl, uz - (g.vz / v) * tl, strength(g.r * 0.7), SUB);
      } else {
        // flattened on the floor: lenses (balls sunk under it), shrinking as it soaks in
        const k = Math.max(0, 1 - g.lt / 0.9), R = g.r * 1.5 * (0.35 + 0.65 * k);
        for (let j = -1; j <= 1; j++) {
          const rr = j ? R * 0.75 : R;
          const yy = (g.y - rr * 0.62 - c.y) / MC_SIZE + 0.5;
          if (yy > m0) mc.addBall(ux + (j * R * 0.7) / MC_SIZE, yy, uz, strength(rr), SUB);
        }
      }
    }
    if (!alive) { G.on = false; mc.visible = false; return; }
    mc.update();
  }

  // ---- footprints ----------------------------------------------------------------------------------------------
  // each simulation tick: a fighter standing in a fresh puddle soaks its soles (and splashes landing in it); bloody
  // soles leave a print every 45 cm walked or run, one foot then the other, fainter and fainter
  tick(W, views = {}) {
    if (this.B < 2) return;
    for (const F of W.list) {
      const f = this.feet[F.slot] || (this.feet[F.slot] = { n: 0, d: 0, side: 1, x: F.x, g: false, bleed: 0, spurt: 2 });
      const on = F.grounded && !F.out && F.state !== 'dead' && F.state !== 'respawn';
      // past 60 %, the body bleeds: drops all the time (faster the higher the %), a trail on the floor; past 150 %,
      // a spurt now and then out of a wound
      const alive = !F.out && F.state !== 'dead' && F.state !== 'respawn' && !W.mg;
      if (alive && F.damage > 60) {
        f.bleed += Math.min(0.9, (F.damage - 60) * 0.004);
        while (f.bleed >= 1) {
          f.bleed -= 1;
          this.P.blood(F.x + (Math.random() - 0.5) * 0.35, F.y + 0.5 + Math.random() * 0.9, F.z + (Math.random() - 0.5) * 0.2, [0, -0.2, 0], 1, 0.12);
        }
        if (F.damage > 150 && (f.spurt -= 1 / 60) <= 0) {
          f.spurt = 0.9 + Math.random() * 1.6;
          const V = views[F.slot];
          if (V && V.root.visible) this.jet(V, F.x + (Math.random() - 0.5) * 0.3, F.y + 0.7 + Math.random() * 0.6, F.z, [(Math.random() - 0.5) * 2, 0, 0], 0.45);
        }
      }
      if (on) {
        const p = this.puddleAt(F.x, F.y, F.z);
        if (p) {
          f.n = 10;
          if (!f.g) this.P.blood(F.x, F.y + 0.05, F.z, [0, 1, 0], 10, 0.45);
        }
        if (f.n > 0 && (F.state === 'walk' || F.state === 'run')) {
          f.d += Math.abs(F.x - f.x);
          if (f.d > 0.45) {
            f.d = 0; f.side = -f.side;
            const dirx = Math.sign(F.x - f.x) || (Math.sin(F.facing) < 0 ? -1 : 1);
            this.decals.footprint(F.x, F.y, F.z + f.side * 0.13, dirx, Math.min(1, f.n / 6), this.color);
            f.n--;
          }
        }
      }
      f.g = on; f.x = F.x;
    }
  }

  // the blow that kills (a duel's KO zoom, in slow motion): the body bursts open where it is hit. Three jets, a burst
  // of drops all round, lumps of flesh, a gush of liquid (« À FOISON »), a big puddle and a splat under it
  explode(V, x, y, z, nd = [1, 0.4, 0]) {
    if (this.B < 2) return;
    for (let i = 0; i < 3; i++) {
      const a = (i - 1) * 0.9;
      this.jet(V, x, y + (i - 1) * 0.25, z, [nd[0] * Math.cos(a) - 0.6 * Math.sin(a), nd[1], nd[2]], 1.3);
    }
    this.P.blood(x, y, z, null, 140, 1.5);
    this.P.blood(x, y, z, nd, 80, 2);
    const C = this.P.pools.chunk;
    for (let i = 0; i < 8; i++) {
      const sp = 4 + Math.random() * 8, a = Math.random() * Math.PI * 2;
      const q = Math.random();
      C.add({ x, y, z, vx: Math.cos(a) * sp * 0.7 + nd[0] * 5, vy: 3 + Math.random() * 7, vz: Math.sin(a) * sp * 0.4, life: 8, s: 0.5 + Math.random() * 1.1,
        r: q < 0.6 ? [0.42, 0.02, 0.03] : [0.85, 0.4, 0.4], rot: Math.random() * 6, spin: (Math.random() - 0.5) * 18, g: 26, kind: 'chunk', stick: true, bounce: 0.3, trail: true });
    }
    if (this.B === 3) { this.gush(x, y, z, nd, 1.8); this.gush(x, y, z, [-nd[0], 0.6, 0], 1.2); }
    const S = this.surfaceUnder(x, y, z);
    if (S) { this.puddle(x + nd[0] * 0.8, S.y, z, 1.4); this.decals.splat(x + nd[0] * 1.5, z, 3.5, FRESH, true, S.y + 0.1, [nd[0] * 8, 0]); }
  }

  update(dt) {
    this.t += dt;
    this.ft += (Math.min(0.1, dt) - this.ft) * 0.05;
    this.updatePuddles(dt);
    this.updateJets(dt);
    for (const G of this.gushes) if (G.on) this.updateGush(G, dt);
  }

  // one of each, for MatchView.prewarm (compiled before the match: no freeze the first time)
  warm() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(this.disc, puddleMat(this.color)), streamObj(this.color));
    if (this.mcMat) {
      const mc = new MarchingCubes(8, this.mcMat, false, false, 300);
      mc.reset(); mc.addBall(0.5, 0.5, 0.5, 0.05, SUB); mc.update();
      g.add(mc);
    }
    return g;
  }

  clear() {
    for (const p of this.puddles) { this.group.remove(p.disc); p.m.dispose(); }
    this.puddles = [];
    for (const J of this.jets) { J.life = 0; J.m.visible = false; }
    for (const G of this.gushes) { G.on = false; G.mc.visible = false; }
    this.feet = {};
  }

  dispose() { this.clear(); if (this.mcMat) this.mcMat.dispose(); for (const G of this.gushes) G.mc.geometry.dispose(); }
}
