// Everything drawn during a match: stage, fighters, entities, particles, stains, effects, HUD.
// It only reads a World (the host's real one, or the client's snapshot copy).
import * as THREE from 'three';
import { buildStageView, syncStageView } from '../render/stages/index.js';
import { FighterView } from '../render/fighterView.js';
import { EntityViews } from '../render/entityView.js';
import { Particles } from '../render/particles.js';
import { Decals } from '../render/decals.js';
import { FX } from '../render/fx.js';
import { CameraRig } from '../render/camera.js';
import { Popups } from '../ui/popups.js';
import { HUD } from '../ui/hud.js';
import { STAGES } from '../sim/stages/index.js';

export class MatchView {
  constructor(app, W, opts = {}) {
    this.app = app;
    this.W = W;
    const R = app.renderer;
    this.root = new THREE.Group();
    R.scene.add(this.root);
    const def = STAGES[W.stageId];
    this.stageView = buildStageView(def);
    this.root.add(this.stageView.group);
    const fog = this.stageView.fog;
    // the side camera stands further back than the old top-down one: the fog starts behind the fighters
    R.scene.fog = new THREE.Fog(fog[0], fog[1] + 14, fog[2] + 30);
    this.fogBase = [fog[1], fog[2]];
    R.scene.background = new THREE.Color(this.stageView.bg || fog[0]);
    this.rig = new CameraRig(R.camera);
    this.rig.yaw = W.camYaw || 0;
    this.particles = new Particles(this.root);
    this.particles.camera = app.renderer.camera;
    this.particles.stage = W.stage;
    const main = W.stage.main();
    this.decals = new Decals(main.r, 512);
    this.root.add(this.decals.mesh);
    const blood = app.settings.blood ?? 3;
    this.particles.onGround = (x, y, z, kind, s) => {
      if (kind === 'blood' && blood >= 2 && Math.random() < 0.55) this.decals.splat(x, z, 0.25 + s * 0.25, blood === 1 ? '#c81818' : '#6e0007', false);
      if (kind === 'chunk' && blood >= 2) this.decals.splat(x, z, 0.5 + s * 0.3, '#5a0006', true);
    };
    this.views = {};
    for (const F of W.list) this.views[F.slot] = new FighterView(this.root, F, (opts.names || {})[F.slot]);
    for (const v of Object.values(this.views)) v.peers = this.views; // the grabs reach for the victim (rig/reach.js)
    this.entities = new EntityViews(this.root);
    this.popups = new Popups(app.ui, R);
    this.hud = new HUD(app.ui);
    this.hud.setup(W, opts.names || {});
    this.fx = new FX({
      renderer: R, rig: this.rig, particles: this.particles, decals: this.decals, views: this.views, popups: this.popups,
      audio: app.audio, rumble: opts.rumble, settings: app.settings,
    });
    this.fx.stageView = this.stageView;
    this.fx.lightning = (x, z, y) => { if (this.stageView.flashL) this.stageView.flashL.intensity = 6; this.spawnBolt(x, z, y); };
    this.bolts = [];
    this.t = 0;
    this.points = [];
    this.smears = {};
  }

  spawnBolt(x, z, y0 = 30) {
    const pts = [];
    let px = x, pz = z;
    for (let i = 0; i <= 14; i++) { pts.push(new THREE.Vector3(px, y0 - (i / 14) * (y0 + 0.5), pz)); px += (Math.random() - 0.5) * 1.6; pz += (Math.random() - 0.5) * 1.6; }
    pts[pts.length - 1].set(x, 0, z);
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 28, 0.22, 4, false);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#f4f8ff', transparent: true, fog: false }));
    this.root.add(m);
    this.bolts.push({ m, t: 0.35 });
  }

  // called after every simulation tick (online with rollback: after the frames of a screen refresh, with their events)
  onTick(W, events = W.events) {
    for (const ev of events) this.fx.handle(ev, W);
    for (const F of W.list) {
      const V = this.views[F.slot];
      if (!V) continue;
      if (F.state === 'respawn' && F.st <= 1) V.snapTo(F); else V.capture(F);
      // blood smear when sliding along the ground while damaged
      if (F.grounded && (F.state === 'hitstun' || F.state === 'down') && F.damage > 30) {
        const s = this.smears[F.slot];
        if (s && Math.hypot(F.x - s.x, F.z - s.z) > 0.3) this.decals.smear(s.x, s.z, F.x, F.z, 0.8 + F.damage / 200);
        this.smears[F.slot] = { x: F.x, z: F.z };
      } else this.smears[F.slot] = null;
    }
  }

  render(dt, alpha) {
    const W = this.W, R = this.app.renderer;
    this.t += dt;
    syncStageView(this.stageView, W.stage);
    this.decals.sync(W.stage.main());
    if (this.stageView.update) this.stageView.update(dt, this.t, W.stage, W);
    this.points.length = 0;
    let danger = 0;
    for (const F of W.list) {
      const V = this.views[F.slot];
      if (!V) continue;
      V.update(F, W, dt, this.t, alpha);
      // launched hard: a thin trail of puffs behind (where it is flying from), sparse so it never hides anything
      if (F.state === 'hitstun' && F.hitlag <= 0 && (F.launchKb || 0) > 100 && !F.grounded && (this.trailT = (this.trailT || 0) + dt) > 0.05) {
        this.trailT = 0;
        this.particles.dust(V.root.position.x, V.root.position.y + 0.8, V.root.position.z, 1, '#eeeae2', 0.12);
      }
      if (!F.out && F.state !== 'dead') {
        this.points.push(V.root.position);
        // close to a blast zone: red edges
        const d = Math.abs(F.x - W.stage.main().cx);
        if (F.state === 'hitstun' && (d > 26 || F.y < -11 || F.y > 21)) danger = Math.max(danger, 0.6);
      }
    }
    this.entities.update(W.entities, dt, W.stage);
    this.particles.update(dt);
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i]; b.t -= dt; b.m.material.opacity = Math.max(0, b.t / 0.35) * (Math.random() < 0.3 ? 0.3 : 1);
      if (b.t <= 0) { this.root.remove(b.m); b.m.geometry.dispose(); this.bolts.splice(i, 1); }
    }
    const menu = W.phase === 'intro' && W.phaseT < 30;
    this.rig.update(dt, this.points, W.stage.main().r, { menu });
    // the fog follows the camera distance: the fighters stay clear, the far scenery melts away
    if (R.scene.fog && this.fogBase) { R.scene.fog.near = this.fogBase[0] + this.rig.dist * 0.75; R.scene.fog.far = this.fogBase[1] + this.rig.dist * 0.9; }
    // test view (?closeup=<slot>[&orbit=1]): camera close on one fighter, to judge models and animations
    const cu = this.app.params && this.app.params.get('closeup');
    if (cu !== null && cu !== undefined && this.views[+cu]) {
      const p = this.views[+cu].root.position, a = this.app.params.get('orbit') ? this.t * 0.4 : 0.5;
      const d = +(this.app.params.get('cd') || 4.2);
      R.camera.position.set(p.x + Math.sin(a) * d, p.y + d * 0.32, p.z + Math.cos(a) * d);
      R.camera.lookAt(p.x, p.y + 0.85, p.z);
    }
    R.fx.red += (danger - R.fx.red) * Math.min(1, dt * 6);
    R.fx.gray = W.phase === 'end' ? Math.min(0.6, R.fx.gray + dt * 0.5) : Math.max(0, R.fx.gray - dt * 2);
    this.popups.update(dt);
    this.hud.update(W, dt);
    if (!this.warm) { this.warm = true; this.prewarm(); }
  }

  // compiles every shader and uploads every texture the match can show before its first image: the fighters' props
  // hidden until a move, projectiles, buddies, puddles... Otherwise the first time a special shows something new, the
  // game freezes while the GPU compiles it (half a second for Pandrezz's kamehameha). Done after the first update, once
  // the fighters' lazily made pieces exist. The programs stay cached for the next matches.
  prewarm() {
    const R = this.app.renderer, gl = R.gl, t0 = performance.now();
    if (!R.rt) R.resize();
    const extra = this.entities.warmGroup();
    const prev = gl.getRenderTarget();
    try {
      gl.setRenderTarget(R.rt || null);
      gl.compile(R.scene, R.camera);
      gl.compile(extra, R.camera, R.scene);
    } catch (err) { console.warn('prewarm', err); }
    gl.setRenderTarget(prev);
    const seen = new Set();
    const tex = (v) => { if (v && v.isTexture && !seen.has(v)) { seen.add(v); try { gl.initTexture(v); } catch (err) { /* not loaded yet */ } } };
    const up = (o) => {
      const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of ms) {
        for (const k in m) tex(m[k]);
        if (m.uniforms) for (const k in m.uniforms) tex(m.uniforms[k].value);
      }
    };
    R.scene.traverse(up);
    extra.traverse(up);
    this.warmMs = performance.now() - t0;
  }

  dispose() {
    const R = this.app.renderer;
    R.scene.remove(this.root);
    R.scene.fog = null;
    this.popups.clear();
    this.popups.layer.remove();
    this.hud.el.remove();
    this.hud.timer.remove();
    this.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    R.fx.red = 0; R.fx.gray = 0;
  }
}
