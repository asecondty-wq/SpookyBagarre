// 3D backdrop for the character select: the picked fighters stand on the crypt slab and show off.
import * as THREE from 'three';
import { World } from '../sim/world.js';
import { buildStageView, syncStageView } from '../render/stages/index.js';
import { FighterView } from '../render/fighterView.js';
import { STAGES } from '../sim/stages/index.js';
import { CHARS } from '../sim/chars/index.js';
import { Particles } from '../render/particles.js';
import { EMOTES } from '../render/rig/nativeMoves.js';

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
      // its own emote when it has one (a clip of its model), else a smash for show
      const em = EMOTES[char] && EMOTES[char].select.emote;
      const mx = S.view.rigModel && S.view.rigModel.mixer;
      if (em && mx && mx.has(em)) { const C = mx.clips[em]; S.F.emote = em; S.F.emoteT = C.t0; S.F.emoteEnd = C.t1; }
      else { S.F.state = 'move'; S.F.move = Math.random() < 0.5 ? 'usmash' : 'smash'; S.F.mf = 0; }
      this.particles.blood(S.F.x, 1.5, S.F.z, [0, 1, 0], 40, 1.2);
      this.particles.shockRing(S.F.x, 0.1, S.F.z, '#ffffff', 1.4, 0.4);
    }
  }

  // plays an emote of the character's model (looped when asked), e.g. the victory dance on the results
  emote(slot, name, loop = false) {
    const S = this.slots[slot];
    const mx = S && S.view.rigModel && S.view.rigModel.mixer;
    if (!mx || !mx.has(name)) return false;
    const C = mx.clips[name];
    S.F.emote = name; S.F.emoteT = C.t0; S.F.emoteEnd = C.t1; S.F.emoteStart = C.t0; S.F.emoteLoop = loop;
    return true;
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
      if (F.emote) { F.emoteT += dt; if (F.emoteT >= F.emoteEnd) { if (F.emoteLoop) F.emoteT = F.emoteStart; else F.emote = null; } }
      if (F.state === 'move') {
        S.ft = (S.ft || 0) + dt * 60;
        while (S.ft >= 1) { F.mf++; S.ft -= 1; }
        const M = CHARS[F.char].moves[F.move];
        if (F.mf >= M.dur) { F.state = 'idle'; F.move = null; F.mf = 0; }
      }
      S.view.update(F, this.W, dt, this.t, 1);
      S.view.marker.visible = false;
      if (S.view.cdRing) S.view.cdRing.visible = false; // no cooldown arcs outside a fight
    }
    this.particles.update(dt);
    this.camAngle = Math.sin(this.t * 0.15) * 0.18;
    const cam = R.camera;
    if (this.focus) {
      // results: close on the winner, who stands on the left third of the screen
      const f = this.focus, a = Math.sin(this.t * 0.25) * 0.12;
      cam.position.set(f.x + f.side + Math.sin(a) * 6.5, 2.3, f.z + Math.cos(a) * 6.5);
      cam.lookAt(f.x + f.side, 1.15, f.z);
    } else {
      const d = (this.look && this.look.dist) || 13;
      cam.position.set(Math.sin(this.camAngle) * d, 4.2 * d / 13, Math.cos(this.camAngle) * d);
      cam.lookAt(0, (this.look && this.look.y) || 1.6, 0);
    }
  }

  dispose() {
    for (const S of this.slots) if (S) S.view.dispose();
    this.app.renderer.scene.remove(this.root);
    this.app.renderer.scene.fog = null;
  }
}
