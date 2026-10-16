// A fighter on screen: floating parts posed procedurally, springs for juicy motion, hit flashes,
// shield bubble, player marker, blob shadow, dizzy stars, charge glow.
import * as THREE from 'three';
const WHITE = new THREE.Color('#ffffff');
import { VISUALS } from './chars.js';
import { restPose, computePose, PARTS } from './poses.js';
import { CHARS } from '../sim/chars/index.js';
import { COLORS } from '../sim/constants.js';
import { blobTex, glowTex, basic, G, mesh } from './materials.js';
import { applyModel } from './models.js';
import { RigModel, hasRig } from './rig/rigModel.js';
import { RIGS } from './rig/chars.js';
import { NATIVE_STATES, LEDGE_CLIMB } from './rig/nativeMoves.js';
import { makeShield, updateShield } from './shield.js';
import { Trail } from './trails.js';
import { addBlood, setBlood } from './bloodSkin.js';
import { strikePoint } from './rig/reach.js';

const tmpV = new THREE.Vector3();

// the marker over the head: the player's name (the one chosen in the options, or the lobby's), J1..J4 without one
function makeMarker(slot, name) {
  let label = String(name || '').trim().slice(0, 12);
  if (!label || /^(Clavier|Manette|Virtuelle|\?)/.test(label)) label = 'J' + (slot + 1); // no name chosen: the pad's
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 26px Lilita One, sans-serif';
  const tw = Math.min(250, g.measureText(label).width + 12);
  g.fillStyle = COLORS[slot];
  g.beginPath(); g.moveTo(110, 32); g.lineTo(146, 32); g.lineTo(128, 58); g.closePath(); g.fill();
  g.textAlign = 'center'; g.lineWidth = 6; g.strokeStyle = '#000'; g.lineJoin = 'round';
  g.strokeText(label, 128, 26); g.fillText(label, 128, 26);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(3.6, 0.9, 1);
  s.userData.w = tw;
  s.renderOrder = 10;
  return s;
}

export class FighterView {
  constructor(scene, F, name) {
    this.slot = F.slot;
    this.char = F.char;
    this.def = CHARS[F.char];
    this.root = new THREE.Group();
    this.inner = new THREE.Group(); // shaken during hitlag
    this.root.add(this.inner);
    this.parts = {};
    // rigged Blender model when available, floating primitive parts otherwise
    if (hasRig(F.char)) {
      this.rigModel = new RigModel(F.char);
      this.inner.add(this.rigModel.pivot);
    }
    const V = this.rigModel ? { L: { height: RIGS[F.char].h, width: (VISUALS[F.char] ? VISUALS[F.char]().L.width : 0.9) }, parts: {} } : (VISUALS[F.char] || VISUALS.micron)(); // the seven friends have no primitive look: a stand-in if their model fails to load
    this.vis = V;
    this.L = V.L;
    this.L.rest = restPose(this.L);
    for (const k of PARTS) {
      const p = V.parts[k];
      if (!p) continue;
      this.parts[k] = p;
      this.inner.add(p);
      const r = this.L.rest[k];
      p.position.set(r.p[0], r.p[1], r.p[2]);
    }
    if (V.headFollowsBody && this.parts.head) {
      // head is a plate on the body: parent it to the body so it squashes with it
      this.inner.remove(this.parts.head);
      this.parts.body.add(this.parts.head);
      this.headLocal = true;
    }
    if (!this.rigModel) applyModel(this);
    this.springs = {};
    for (const k of Object.keys(this.parts)) {
      const r = this.L.rest[k];
      this.springs[k] = { p: r.p.slice(), r: r.r.slice(), s: r.s ? r.s.slice() : [1, 1, 1], vs: [0, 0, 0] };
    }
    // materials for flashes (each one's own glow kept: the self-lit props, Anbuu's wings, a screen, go back to it)
    this.mats = [];
    this.root.traverse((o) => { if (o.isMesh && o.material && o.material.emissive) { o.material = o.material.clone(); o.material.userData.e0 = o.material.emissive.clone(); this.mats.push(o.material); } });
    // shield
    this.shield = makeShield(COLORS[F.slot]);
    this.trail = new Trail(scene, COLORS[F.slot]); // behind the striking limb
    this.shield.visible = false;
    this.root.add(this.shield);
    // marker, shadow
    this.marker = makeMarker(F.slot, name);
    scene.add(this.marker);
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false, opacity: 0.75 }));
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.renderOrder = 1;
    scene.add(this.shadow);
    // special cooldowns, shown on the floor around the shadow (in the world, under the fighter): three arcs facing the
    // camera, gold = neutral, cyan = side, pink = down special; an arc fills while its special recharges, then lights
    // up with a little flash when it is ready again
    this.cdRing = new THREE.Group();
    this.cdRing.renderOrder = 2;
    this.cdArcs = ['#ffd23a', '#5ad8ff', '#ff5ab8'].map((c, i) => {
      const start = (212 + i * 58 - 25) * Math.PI / 180, len = 50 * Math.PI / 180;
      const bg = new THREE.Mesh(new THREE.RingGeometry(0.46, 0.63, 12, 1, start, len), new THREE.MeshBasicMaterial({ color: '#101018', transparent: true, opacity: 0.45, depthWrite: false }));
      const geos = [];
      for (let q = 0; q <= 10; q++) geos.push(q === 0 ? null : new THREE.RingGeometry(0.47, 0.62, 12, 1, start, len * q / 10));
      const fill = new THREE.Mesh(geos[10], new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85, depthWrite: false }));
      bg.rotation.x = fill.rotation.x = -Math.PI / 2; bg.renderOrder = fill.renderOrder = 2;
      this.cdRing.add(bg, fill);
      return { bg, fill, geos, q: 10, pulse: 0, deny: 0, color: new THREE.Color(c) };
    });
    scene.add(this.cdRing);
    // glow (charge, boosts)
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: '#ffffff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    this.glow.scale.setScalar(3);
    this.root.add(this.glow);
    this.glow.position.y = this.L.height * 0.5;
    // dizzy stars
    this.stars = new THREE.Group();
    for (let i = 0; i < 4; i++) this.stars.add(mesh(G.ball(0.08, 0), basic('#ffe24a'), [Math.cos(i * 1.57) * 0.45, 0, Math.sin(i * 1.57) * 0.45]));
    this.stars.visible = false;
    this.root.add(this.stars);
    // respawn slab (a floating tombstone lid)
    this.slab = mesh(G.box(1.9, 0.25, 1.4), new THREE.MeshLambertMaterial({ color: '#8b8f99', emissive: '#223', emissiveIntensity: 0.5 }));
    this.slab.visible = false;
    scene.add(this.slab);
    scene.add(this.root);
    this.flashT = 0; this.flashColor = new THREE.Color(1, 1, 1);
    this.squash = 0; this.squashV = 0;
    this.prev = { x: F.x, y: F.y, z: F.z, facing: F.facing };
    this.cur = { x: F.x, y: F.y, z: F.z, facing: F.facing };
    this.scene = scene;
    this.blinkT = 2 + Math.random() * 3;
    this.spinAcc = 0;
  }

  // store the last two simulation states for interpolation
  capture(F) {
    this.prev.x = this.cur.x; this.prev.y = this.cur.y; this.prev.z = this.cur.z; this.prev.facing = this.cur.facing;
    this.cur.x = F.x; this.cur.y = F.y; this.cur.z = F.z; this.cur.facing = F.facing;
  }
  snapTo(F) { this.prev.x = this.cur.x = F.x; this.prev.y = this.cur.y = F.y; this.prev.z = this.cur.z = F.z; this.prev.facing = this.cur.facing = F.facing; this.vyaw = undefined; }

  flash(color = '#ffffff', t = 0.12) { this.flashT = t; this.flashColor.set(color); }
  impulse(k) { this.squashV += k; if (this.rigModel) this.rigModel.impulse(k); }

  update(F, W, dt, t, alpha, ctx) {
    const hidden = F.state === 'dead' || F.out || F.state === 'held' ||
      (F.state === 'grabbed' && W.fighters[F.grabbedBy] && W.fighters[F.grabbedBy].move === 'sp_d_hold');
    this.root.visible = !hidden;
    this.marker.visible = !hidden && !F.out;
    this.shadow.visible = !hidden;
    this.slab.visible = F.state === 'respawn';
    if (hidden) { this.shield.visible = false; if (this.trail) this.trail.update(null, dt); return; }

    // interpolated position
    const a = alpha;
    let x = this.prev.x + (this.cur.x - this.prev.x) * a;
    let y = this.prev.y + (this.cur.y - this.prev.y) * a;
    let z = this.prev.z + (this.cur.z - this.prev.z) * a;
    if (Math.hypot(this.cur.x - this.prev.x, this.cur.z - this.prev.z) > 4) { x = this.cur.x; y = this.cur.y; z = this.cur.z; }
    let df = this.cur.facing - this.prev.facing;
    while (df > Math.PI) df -= Math.PI * 2; while (df < -Math.PI) df += Math.PI * 2;
    const simFacing = this.prev.facing + df * a;
    // 2D: the fighter faces left or right, turned a little toward the camera (three-quarter view, like Smash),
    // and turns around quickly instead of snapping
    const tgt = simFacing - (Math.sin(simFacing) < 0 ? -1 : 1) * 0.34;
    if (this.vyaw === undefined) this.vyaw = tgt;
    let dyaw = tgt - this.vyaw;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2; while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    this.vyaw += dyaw * (1 - Math.exp(-dt * 20));
    const facing = this.vyaw;
    // the ledge: hanging, the model hangs lower and against the wall (the head near the edge, the hands on it:
    // rig/reach.js); the sim snaps the fighter onto the hanging point and back onto the stage, the model gets there
    // along a path instead: quickly on the grab; out of the hang it rises first, then steps in over the edge
    const onLedge = F.state === 'ledge';
    if (onLedge) {
      const hh = (this.L && this.L.height) || 1.8;
      x -= (F.ledgeNx || 0) * 0.16; y -= 0.42 * hh / 1.8;
      this.corner = { x: this.cur.x - (F.ledgeNx || 0) * 0.38, y: this.cur.y + 1.35, nx: F.ledgeNx || 0 };
      if (this.rigModel) this.rigModel.ledge = this.corner;
    } else if (this.rigModel) this.rigModel.ledge = null;
    if (this.wasLedge !== undefined && this.wasLedge !== onLedge && this.shown) {
      if (onLedge) { x = this.cur.x - (F.ledgeNx || 0) * 0.16; y = this.cur.y - 0.42 * ((this.L && this.L.height) || 1.8) / 1.8; }
      else { x = this.cur.x; y = this.cur.y; }
      const ox = this.shown.x - x, oy = this.shown.y - y;
      // a character with its own climb clip rises in the clip itself: only the step in over the edge is drawn here
      const mx = this.rigModel && this.rigModel.mixer, own = NATIVE_STATES[F.char];
      const ownClimb = !onLedge && F.state === 'getup' && mx && ((own && own.ledgeclimb && mx.has(own.ledgeclimb.clip)) || mx.has(LEDGE_CLIMB.clip));
      if (Math.hypot(ox, oy) < 3.5) this.ledgeOff = { x: ox, y: ownClimb ? oy * 0.55 : oy, out: !onLedge, own: !!ownClimb };
    }
    this.wasLedge = onLedge;
    if (this.ledgeOff) {
      const o = this.ledgeOff;
      if (o.own) {
        // the climb clip: against the wall while pulling up, over the edge once the body is above it (the second half
        // of the half-second climb), the small height gap with the hang eased out at the start
        o.t = (o.t || 0) + dt;
        o.x0 = o.x0 ?? o.x; o.y0 = o.y0 ?? o.y;
        const k = Math.max(0, Math.min(1, (o.t - 0.24) / 0.22)), s = k * k * (3 - 2 * k);
        o.x = o.x0 * (1 - s); o.y = o.y0 * Math.max(0, 1 - o.t / 0.14);
      }
      x += o.x; y += o.y;
      if (!o.own) { o.y *= Math.exp(-dt * (o.out ? 15 : 20)); o.x *= Math.exp(-dt * (o.out ? 6.5 : 20)); }
      if (o.own ? o.t > 0.5 : Math.abs(o.x) + Math.abs(o.y) < 0.01) this.ledgeOff = null;
      // pulling himself up: the hands stay on the edge until the body is over it
      else if (o.out && !o.own && o.y < -0.2 && this.rigModel && this.corner) this.rigModel.ledge = { ...this.corner, climb: true };
    }
    this.shown = { x, y };
    // hit freeze: the victim trembles while the blow holds it (stronger blows, harder shake), Smash style
    if (F.hitlag > 0 && F.state === 'hitstun') {
      const amp = Math.min(0.11, 0.025 + (F.launchKb || 0) / 1400);
      x += Math.sin(t * 95) * amp; y += Math.cos(t * 77) * amp * 0.4;
    }
    this.root.position.set(x, y, z);
    this.root.rotation.set(0, facing, 0);
    const size = F.size || 1;
    this.root.scale.setScalar(size);

    const M = F.move ? this.def.moves[F.move] : null;
    if (this.rigModel) { this.updateRigged(F, W, M, dt, t, x, y, z, facing, size); return; }
    const P = computePose(F, M, this.L, t, this.vis.poses);

    // springs toward the pose (snappier when striking)
    const striking = F.state === 'move' && M && P.key && F.hitlag === 0;
    const kPos = 1 - Math.exp(-dt * (striking ? 34 : 18));
    const kRot = 1 - Math.exp(-dt * (striking ? 30 : 14));
    for (const k of Object.keys(this.parts)) {
      const tgt = P[k];
      const sp = this.springs[k];
      const part = this.parts[k];
      if (!tgt) continue;
      for (let i = 0; i < 3; i++) { sp.p[i] += (tgt.p[i] - sp.p[i]) * kPos; sp.r[i] += (tgt.r[i] - sp.r[i]) * kRot; }
      if (tgt.s) for (let i = 0; i < 3; i++) sp.s[i] += (tgt.s[i] - sp.s[i]) * kPos;
      if (this.headLocal && k === 'head') {
        const rb = this.L.rest.body.p;
        part.position.set(sp.p[0] - rb[0] * 0, sp.p[1] - rb[1], sp.p[2]);
      } else part.position.set(sp.p[0], sp.p[1], sp.p[2]);
      part.rotation.set(sp.r[0], sp.r[1], sp.r[2]);
      if (tgt.s) part.scale.set(sp.s[0], sp.s[1], sp.s[2]);
    }
    // global squash impulse (landings, jumps, hits)
    this.squashV += -this.squash * 260 * dt;
    this.squashV *= Math.exp(-dt * 10);
    this.squash += this.squashV * dt;
    const sq = Math.max(-0.45, Math.min(0.45, this.squash));
    this.inner.scale.set(1 - sq * 0.5, 1 + sq, 1 - sq * 0.5);

    // hitlag shake / charge shake
    let shake = 0;
    if (F.hitlag > 0 && (F.state === 'hitstun')) shake = 0.12;
    else if (F.hitlag > 0) shake = 0.04;
    if (P.shake) shake = Math.max(shake, P.shake);
    this.inner.position.set((Math.random() - 0.5) * shake * 2, (Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake * 2);

    // eyes & mouth
    this.blinkT -= dt;
    let blink = false;
    if (this.blinkT < 0) { blink = true; if (this.blinkT < -0.12) this.blinkT = 2 + Math.random() * 3; }
    const eyeState = P.eyes || 0;
    for (const e of this.vis.eyes || []) {
      const u = e.userData;
      let sy = 1;
      if (blink && eyeState === 0) sy = 0.12;
      if (eyeState === 1) sy = 0.55;
      if (eyeState === 2) sy = 0.3;
      e.scale.set(1, sy, 1);
      u.pupil.scale.setScalar(eyeState === 2 ? 0.5 : eyeState === 3 ? 0.8 : 1);
      if (eyeState === 3) u.pupil.position.x = Math.sin(t * 10 + e.position.x * 9) * u.r * 0.35;
      else u.pupil.position.x *= 0.8;
    }
    if (this.vis.mouth) {
      const mo = this.vis.mouth;
      const open = Math.max(P.mouth || 0, F.state === 'hitstun' ? 1 : 0);
      mo.scale.set(mo.userData.w, mo.userData.h * (0.18 + open * 0.95), 0.06);
    }

    // per-character extras
    if (this.vis.update) this.vis.update(this, F, P, t);

    // spinning moves (frog leap, helicopters...) use va[1] as a spin angle for the prop / body
    if (P.key === 'helico' && this.parts.hr) { this.parts.hr.rotation.y = (F.va[1] || 0) * 4; }
    if ((P.key === 'frogleap' || P.key === 'breach') && F.va[1]) this.inner.rotation.y = F.va[1] * 2;
    else this.inner.rotation.y *= 0.8;

    // flashes: hit, invulnerability blink, charge pulse
    this.flashT -= dt;
    const flashing = this.flashT > 0;
    const chargePulse = P.charge ? (0.12 + 0.18 * P.charge) * (0.5 + 0.5 * Math.sin(t * 40)) : 0;
    // invincible: a soft pale-blue shimmer (a dodge must stay readable, not a white blob); respawn blinks a bit more
    const invBlink = (F.invuln > 0 || F.intangible > 0) && F.state !== 'move' ? (F.invuln > 0 ? (Math.sin(t * 30) > 0 ? 0.22 : 0.04) : 0.05 + 0.035 * Math.sin(t * 40)) : 0;
    for (const m of this.mats) {
      if (flashing) m.emissive.copy(this.flashColor);
      else if (chargePulse) m.emissive.setRGB(chargePulse, chargePulse * 0.85, chargePulse * 0.4);
      else if (F.speedMul > 1) m.emissive.setRGB(0.25, 0.25, 0.3);
      else if (invBlink) m.emissive.setRGB(invBlink * 0.8, invBlink * 0.95, invBlink * 1.2);
      else if (m.userData.e0) m.emissive.copy(m.userData.e0);
      else m.emissive.setScalar(0);
    }
    // blood on the fighter: darken / redden the body as damage climbs (subtle)
    // glow
    const gm = this.glow.material;
    gm.opacity = P.charge ? 0.1 + P.charge * 0.25 : F.speedMul > 1 ? 0.2 : 0;
    gm.color.set(P.charge ? '#ffd27a' : '#ffffff');

    // shield bubble
    if (F.state === 'shield') {
      this.shield.visible = true;
      const s = 0.45 + (F.shield / 50) * 0.75;
      this.shield.scale.setScalar(s * Math.max(1, this.L.height * 0.6));
      this.shield.position.y = this.L.height * 0.5;
      updateShield(this.shield, Math.max(0, F.shield) / 50, t, F.shieldStun || 0); this.shieldT = t;
    } else this.shield.visible = false;

    // dizzy stars
    this.stars.visible = F.state === 'dizzy' || F.state === 'stunned';
    if (this.stars.visible) { this.stars.position.y = this.L.height + 0.25; this.stars.rotation.y = t * 6; }

    // marker above the head
    this.marker.position.set(x, y + this.L.height * size + 0.75, z);

    // blob shadow on the ground under the fighter
    const s = W.stage.findLanding(x, z, y + 0.3, -40);
    if (s) {
      const gy = W.stage.heightAt(s, x, z);
      const hgt = Math.max(0, y - gy);
      const sc = Math.max(0.35, 1.5 - hgt * 0.08) * (this.L.width * 0.95) * size;
      this.shadow.visible = true;
      this.shadow.position.set(x, gy + 0.03, z);
      this.shadow.scale.set(sc, sc, sc);
      this.shadow.material.opacity = Math.max(0.2, 0.8 - hgt * 0.04);
      this.updateCdRing(F, x, gy, z, sc, dt, hgt);
    } else { this.shadow.visible = false; this.cdRing.visible = false; }
    // respawn slab
    if (F.state === 'respawn') { this.slab.position.set(x, y - 0.14, z); this.slab.rotation.y = facing; }
  }

  // rigged model: skeleton pose, then the same flashes / shield / marker / shadow as the primitive fighters
  updateRigged(F, W, M, dt, t, x, y, z, facing, size) {
    const RM = this.rigModel;
    RM.peers = this.peers;
    const out = RM.update(F, M, t, dt, this.root.position);
    let shake = 0;
    if (F.hitlag > 0 && F.state === 'hitstun') shake = 0.12;
    else if (F.hitlag > 0) shake = 0.04;
    if (out.shake) shake = Math.max(shake, out.shake);
    this.inner.position.set((Math.random() - 0.5) * shake * 2, (Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake * 2);
    const cfg = RIGS[F.char];
    if (cfg.update) cfg.update({ root: this.root, rig: RM.rig, sockets: RM.sockets, model: RM }, F, out, t);
    // blood on the body: it builds up with the damage taken (the Hémoglobine option, bloodK, scales it)
    if (this.bloodK > 0) { if (!RM.bloodU) RM.bloodU = addBlood(RM.meshes); setBlood(RM.bloodU, Math.min(1, F.bloodied * 1.2) * this.bloodK); }
    const sp = this._sp || (this._sp = new THREE.Vector3());
    this.trail.update(strikePoint(RM, F, M, sp) ? sp : null, dt);
    this.afterPose(F, W, { key: out.key, charge: out.charge }, dt, t, x, y, z, facing, size);
  }

  denyCd(k) { const A = this.cdArcs[{ n: 0, s: 1, d: 2 }[k]]; if (A) A.deny = 1; }

  updateCdRing(F, x, gy, z, sc, dt, hgt) {
    const show = !F.out && F.state !== 'dead' && F.state !== 'respawn' && hgt < 6;
    this.cdRing.visible = show;
    if (!show) return;
    const r = Math.max(1.0, sc * 0.82);
    this.cdRing.position.set(x, gy + 0.035, z);
    this.cdRing.scale.set(r, 1, r);
    ['n', 's', 'd'].forEach((k, i) => {
      const A = this.cdArcs[i];
      const f = F.cdFrac ? F.cdFrac[i] : (F.cd ? F.cd[k] / (F.cdMax[k] || 1) : 0);
      const q = Math.max(0, Math.min(10, Math.round((1 - f) * 10)));
      if (q !== A.q) {
        if (q === 10 && A.q < 10) A.pulse = 1; // ready again
        A.q = q;
        A.fill.visible = q > 0;
        if (q > 0) A.fill.geometry = A.geos[q];
      }
      // charging: dim; ready: bright, with a flash when it comes back
      A.pulse = Math.max(0, A.pulse - dt * 3);
      A.fill.material.opacity = q < 10 ? 0.45 : 0.8 + A.pulse * 0.2;
      A.fill.material.color.copy(A.color);
      if (A.pulse > 0) A.fill.material.color.lerp(WHITE, A.pulse * 0.7);
      // tried while it recharges: the arc blinks red
      if (A.deny > 0) { A.deny = Math.max(0, A.deny - dt * 4); A.bg.material.color.setRGB(0.06 + A.deny * 0.8, 0.06, 0.09); } else A.bg.material.color.set('#101018');
      const ps = 1 + A.pulse * 0.25;
      A.fill.scale.set(ps, ps, 1); A.bg.scale.set(ps, ps, 1);
    });
  }

  afterPose(F, W, P, dt, t, x, y, z, facing, size) {
    this.flashT -= dt;
    const flashing = this.flashT > 0;
    const chargePulse = P.charge ? (0.12 + 0.18 * P.charge) * (0.5 + 0.5 * Math.sin(t * 40)) : 0;
    // invincible: a soft pale-blue shimmer (a dodge must stay readable, not a white blob); respawn blinks a bit more
    const invBlink = (F.invuln > 0 || F.intangible > 0) && F.state !== 'move' ? (F.invuln > 0 ? (Math.sin(t * 30) > 0 ? 0.22 : 0.04) : 0.05 + 0.035 * Math.sin(t * 40)) : 0;
    const cc = (RIGS[F.char] && RIGS[F.char].chargeTint) || [1, 0.85, 0.4];
    for (const m of this.mats) {
      if (flashing) m.emissive.copy(this.flashColor);
      else if (chargePulse) m.emissive.setRGB(chargePulse * cc[0], chargePulse * cc[1], chargePulse * cc[2]);
      else if (F.speedMul > 1) m.emissive.setRGB(0.25, 0.25, 0.3);
      else if (invBlink) m.emissive.setRGB(invBlink * 0.8, invBlink * 0.95, invBlink * 1.2);
      else if (m.userData.e0) m.emissive.copy(m.userData.e0);
      else m.emissive.setScalar(0);
    }
    const gm = this.glow.material;
    gm.opacity = P.charge ? 0.1 + P.charge * 0.25 : F.speedMul > 1 ? 0.2 : 0;
    gm.color.set(P.charge ? ((RIGS[F.char] && RIGS[F.char].chargeGlow) || '#ffd27a') : '#ffffff');
    if (F.state === 'shield') {
      this.shield.visible = true;
      const s = 0.45 + (F.shield / 50) * 0.75;
      this.shield.scale.setScalar(s * Math.max(1, this.L.height * 0.6));
      this.shield.position.y = this.L.height * 0.5;
      updateShield(this.shield, Math.max(0, F.shield) / 50, t, F.shieldStun || 0); this.shieldT = t;
    } else this.shield.visible = false;
    this.stars.visible = F.state === 'dizzy' || F.state === 'stunned';
    if (this.stars.visible) { this.stars.position.y = this.L.height + 0.25; this.stars.rotation.y = t * 6; }
    this.marker.position.set(x, y + this.L.height * size + 0.75, z);
    const s = W.stage.findLanding(x, z, y + 0.3, -40);
    if (s) {
      const gy = W.stage.heightAt(s, x, z);
      const hgt = Math.max(0, y - gy);
      const sc = Math.max(0.35, 1.5 - hgt * 0.08) * (this.L.width * 0.95) * size;
      this.shadow.visible = true;
      this.shadow.position.set(x, gy + 0.03, z);
      this.shadow.scale.set(sc, sc, sc);
      this.shadow.material.opacity = Math.max(0.2, 0.8 - hgt * 0.04) * (this.rigModel ? 0.7 : 1);
      this.updateCdRing(F, x, gy, z, sc, dt, hgt);
    } else { this.shadow.visible = false; this.cdRing.visible = false; }
    if (F.state === 'respawn') { this.slab.position.set(x, y - 0.14, z); this.slab.rotation.y = facing; }
  }

  // world position of the head / center (for effects)
  headPos(out = tmpV) { return out.set(this.root.position.x, this.root.position.y + this.L.height * 0.85, this.root.position.z); }

  dispose() {
    this.scene.remove(this.root); this.scene.remove(this.marker); this.scene.remove(this.shadow); this.scene.remove(this.slab); this.scene.remove(this.cdRing);
    if (this.rigModel) this.rigModel.dispose();
    if (this.trail) this.trail.dispose();
  }
}
