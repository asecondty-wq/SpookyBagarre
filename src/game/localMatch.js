// A match driven on this machine (offline, or as the online host): fixed-step simulation + rendering.
import { World } from '../sim/world.js';
import { DT } from '../sim/constants.js';
import { Input, toTickInput } from '../core/input.js';
import { MatchView } from './matchView.js';
import { STAGES } from '../sim/stages/index.js';

// the VS screen first gets painted and lands (0.9 s), then the heavy preparation starts behind it (compiling blocks
// the page: its CSS animations keep going, a panel not painted yet would wait)
const WARM_AFTER = 0.9;

export class LocalMatch {
  // roster: [{ slot, char, color, bot, name, device (local input device id) or remote:true }]
  // loading: the match waits (the VS screen shows) until release(): drawn and prepared behind it, not simulated
  constructor(app, { stage, roster, rules, seed, names, onTick, remoteInputs, attract, loading }) {
    this.app = app;
    this.W = new World({ stage, roster, rules: attract ? { ...rules, minigames: false, ult: false } : rules, seed });
    this.roster = roster;
    this.devices = {};
    for (const r of roster) if (r.device) this.devices[r.slot] = r.device;
    this.prevCnt = {};
    this.view = new MatchView(app, this.W, { names, deviceOf: (slot) => this.devices[slot], rumble: (slot, s, w, ms) => { const d = this.devices[slot]; if (d) Input.rumble(d, s, w, ms); } });
    this.acc = 0;
    this.onTick = onTick;            // host: broadcast snapshots/events
    this.remoteInputs = remoteInputs; // host: { [slot]: latest input sample from the network }
    this.realStart = performance.now();
    this.paused = false;
    this.done = false;
    this.attract = !!attract;
    this.loading = !!loading; this.ready = false;
    if (attract) {
      // demo fight behind the menus: no HUD, no texts, no sounds
      this.view.fx.audio = null;
      this.view.fx.rumble = null;
      this.view.popups.layer.style.display = 'none';
      this.view.hud.show(false);
    } else app.audio.playMusic(STAGES[stage].music);
  }

  inputs() {
    const out = {};
    for (const r of this.roster) {
      let sample = null;
      if (this.devices[r.slot]) sample = Input.sample(this.devices[r.slot]);
      else if (this.remoteInputs && this.remoteInputs[r.slot]) sample = this.remoteInputs[r.slot];
      if (!sample) continue;
      out[r.slot] = toTickInput(sample, this.prevCnt[r.slot] || sample.cnt);
      this.prevCnt[r.slot] = sample.cnt.slice();
    }
    return out;
  }

  canGo() { return this.ready; }
  go() { if (!this.loading) return; this.loading = false; this.acc = 0; this.realStart = performance.now(); }

  update(dt) {
    const W = this.W;
    if (this.loading) {
      this.loadT = (this.loadT || 0) + dt;
      if (this.loadT < WARM_AFTER) return;
      this.view.render(dt, 0);
      if (this.view.warmTick()) this.ready = true;
      return;
    }
    if (!this.paused) {
      this.acc += dt * W.timeScale;
      let n = 0;
      while (this.acc >= DT && n < 6) {
        W.realTime = this.app.audio.musicTime() || (performance.now() - this.realStart) / 1000;
        W.step(this.inputs());
        this.view.onTick(W);
        if (this.onTick) this.onTick(W);
        this.acc -= DT; n++;
      }
      if (n >= 6) this.acc = 0;
    }
    this.view.render(dt, Math.min(1, this.acc / DT));
    if (W.phase === 'over' && !this.done) { this.done = true; if (this.onOver) this.onOver(W); }
  }

  dispose() { this.view.dispose(); }
}
