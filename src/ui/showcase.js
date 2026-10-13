// 3D backdrop for the character select: the picked fighters stand on the crypt slab and show off.
import * as THREE from 'three';
import { World } from '../sim/world.js';
import { buildStageView, syncStageView } from '../render/stages/index.js';
import { FighterView } from '../render/fighterView.js';
import { STAGES } from '../sim/stages/index.js';
import { CHARS } from '../sim/chars/index.js';
import { Particles } from '../render/particles.js';

const SPOTS = [[-4.2, 0.6], [-1.4, 1.3], [1.4, 1.3], [4.2, 0.6]];

export class Showcase {
  constructor(app, stageId = 'cemetery') {
    this.app = app;
    const R = app.renderer;
    this.root = new THREE.Group();
    R.scene.add(this.root);
    this.W = new World({ stage: stageId, roster: [], rules: {} });
    this.stageView = buildStageView(STAGES[stageId]);
    this.root.add(this.stageView.group);
    const fog = this.stageView.fog;
    R.scene.fog = new THREE.Fog(fog[0], fog[1], fog[2]);
    R.scene.background = new THREE.Color(this.stageView.bg);
    this.particles = new Particles(this.root);
    this.particles.camera = app.renderer.camera;
    this.particles.stage = this.W.stage;
    this.slots = [null, null, null, null];
    this.t = 0;
    this.camAngle = 0;
  }

  fake(slot, char) {
    const [x, z] = SPOTS[slot];
    const def = CHARS[char];
    return {
      slot, char, x, y: 0, z, facing: Math.atan2(-x * 0.2, 8), state: 'idle', st: 0, move: null, mf: 0, mv: {}, va: [0, 0, 0, 0, 0, 0],
      hitlag: 0, invuln: 0, intangible: 0, shield: 50, grounded: true, size: 1, speedMul: 1, out: false, grabbedBy: -1, damage: 0,
      vx: 0, vy: 0, vz: 0, radius: def.stats.radius, height: def.stats.height,
    };
  }

  set(slot, char, flourish = false) {
    const cur = this.slots[slot];
    if (!char) { if (cur) { cur.view.dispose(); this.slots[slot] = null; } return; }
    if (!cur || cur.F.char !== char) {
      if (cur) cur.view.dispose();
      const F = this.fake(slot, char);
      const view = new FighterView(this.root, F);
      view.snapTo(F);
      view.marker.visible = false;
      this.slots[slot] = { F, view, flourishT: 0 };
      this.particles.sparks(F.x, 1.2, F.z, 30, '#ffffff', 8);
      this.particles.dust(F.x, 0, F.z, 12);
    }
    if (flourish) {
      const S = this.slots[slot];
      S.flourishT = 0.01;
      S.F.state = 'move'; S.F.move = Math.random() < 0.5 ? 'usmash' : 'smash'; S.F.mf = 0;
      this.particles.blood(S.F.x, 1.5, S.F.z, [0, 1, 0], 40, 1.2);
      this.particles.shockRing(S.F.x, 0.1, S.F.z, '#ffffff', 1.4, 0.4);
    }
  }

  update(dt) {
    this.t += dt;
    const R = this.app.renderer;
    syncStageView(this.stageView, this.W.stage);
    if (this.stageView.update) this.stageView.update(dt, this.t, this.W.stage, this.W);
    for (const S of this.slots) {
      if (!S) continue;
      const F = S.F;
      F.st++;
      if (F.state === 'move') {
        S.ft = (S.ft || 0) + dt * 60;
        while (S.ft >= 1) { F.mf++; S.ft -= 1; }
        const M = CHARS[F.char].moves[F.move];
        if (F.mf >= M.dur) { F.state = 'idle'; F.move = null; F.mf = 0; }
      }
      S.view.update(F, this.W, dt, this.t, 1);
      S.view.marker.visible = false;
    }
    this.particles.update(dt);
    this.camAngle = Math.sin(this.t * 0.15) * 0.18;
    const cam = R.camera;
    cam.position.set(Math.sin(this.camAngle) * 13, 4.2, Math.cos(this.camAngle) * 13);
    cam.lookAt(0, 1.6, 0);
  }

  dispose() {
    for (const S of this.slots) if (S) S.view.dispose();
    this.app.renderer.scene.remove(this.root);
    this.app.renderer.scene.fog = null;
  }
}
