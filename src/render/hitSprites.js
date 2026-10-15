// Hit effect sprites (drawn by Codex, cut out by tools/art/hitfx_cut.py): a crisp graphic flash where a blow lands,
// gone in a fifth of a second. They pop (overshoot), turn along the launch and fade; they never linger like smoke,
// so a fight stays readable even with four fighters.
import * as THREE from 'three';

// the juice pass (15 Oct 2026, tools/art/hitfx2.ps1): comic impacts, stars, cracks, swipes, blood, a smoke puff
const NAMES = ['burst', 'heavy', 'slash', 'zap', 'ring', 'streak', 'pow', 'stars', 'crack', 'swipe', 'splat', 'smoke'];
const loader = new THREE.TextureLoader();
const TEX = {};
for (const n of NAMES) {
  const t = loader.load(`assets/fx/${n}.png`);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  TEX[n] = t;
}

export class HitSprites {
  constructor(scene) {
    this.scene = scene;
    this.live = [];
    this.free = [];
  }

  // kind: one of NAMES; size in metres; angle (radians, screen plane); life in seconds; tint (css colour or null)
  spawn(kind, x, y, z, size = 1, angle = 0, life = 0.18, tint = null, opts = {}) {
    let s = this.free.pop();
    if (!s) {
      s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false }));
      s.renderOrder = 50;
      this.scene.add(s);
    }
    s.material.map = TEX[kind] || TEX.burst;
    s.material.color.set(tint || '#ffffff');
    s.material.rotation = angle;
    s.material.opacity = 1;
    // soft (the smoke of a launch): behind the fighters, half transparent, it grows instead of popping
    s.material.depthTest = !!opts.soft;
    s.material.needsUpdate = true;
    s.position.set(x, y, z + (opts.soft ? -0.35 : 0.3));
    s.visible = true;
    s.scale.setScalar(size * 0.3);
    this.live.push({ s, t: 0, life, size, vx: opts.vx || 0, vy: opts.vy || 0, spin: opts.spin || 0, stretch: opts.stretch || 1, soft: !!opts.soft });
    return s;
  }

  update(dt) {
    let w = 0;
    for (const o of this.live) {
      o.t += dt;
      const k = o.t / o.life;
      if (k >= 1) { o.s.visible = false; this.free.push(o.s); continue; }
      if (o.soft) {
        o.s.scale.setScalar(o.size * (0.55 + k * 0.9));
        o.s.material.opacity = 0.42 * (1 - k) * Math.min(1, k * 6);
      } else {
        // pop: 30% -> 115% in the first quarter, settle, shrink a little while fading out
        const pop = k < 0.25 ? 0.3 + (k / 0.25) * 0.85 : 1.15 - (k - 0.25) * 0.35;
        o.s.scale.set(o.size * pop * o.stretch, o.size * pop, 1);
        o.s.material.opacity = k < 0.55 ? 1 : 1 - (k - 0.55) / 0.45;
      }
      o.s.material.rotation += o.spin * dt;
      o.s.position.x += o.vx * dt; o.s.position.y += o.vy * dt;
      this.live[w++] = o;
    }
    this.live.length = w;
  }

  clear() { for (const o of this.live) { o.s.visible = false; this.free.push(o.s); } this.live.length = 0; }
}
