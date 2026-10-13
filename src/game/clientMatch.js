// Online client: renders the host's match from snapshots (interpolated ~100 ms in the past),
// replays the host's events at the right moment, and sends the local players' inputs.
import { World, unpackFighter } from '../sim/world.js';
import { MatchView } from './matchView.js';
import { STAGES } from '../sim/stages/index.js';

const INTERP = 105; // ms behind the newest snapshot

export class ClientMatch {
  constructor(app, session, cfg) {
    this.app = app;
    this.session = session;
    this.W = new World(cfg);
    this.view = new MatchView(app, this.W, { names: cfg.names });
    for (const V of Object.values(this.view.views)) V.cur = { ...V.cur };
    this.snaps = [];
    this.events = [];
    this.offset = null; // localNow - hostNow (smallest seen)
    this.done = false;
    this.sendT = 0;
    this.last = null;
    app.audio.playMusic(STAGES[cfg.stage].music);
  }

  onMessage(m) {
    const now = performance.now();
    if (m.t === 'snap') {
      this.lastSnapAt = now;
      const off = now - m.h;
      if (this.offset === null || off < this.offset) this.offset = off;
      else this.offset += (off - this.offset) * 0.002; // slow drift correction
      this.snaps.push({ h: m.h, s: m.s });
      if (this.snaps.length > 40) this.snaps.shift();
      this.snaps.sort((a, b) => a.h - b.h);
    } else if (m.t === 'ev') {
      for (const e of m.l) this.events.push({ h: m.h, e });
    }
  }

  // "waiting for the host" banner when no picture arrives (instead of a silent frozen screen)
  waiting(on) {
    if (on && !this.waitEl) {
      this.waitEl = document.createElement('div');
      this.waitEl.className = 'netwait';
      this.waitEl.textContent = 'En attente de l\'hôte…';
      this.app.ui.appendChild(this.waitEl);
    } else if (!on && this.waitEl) { this.waitEl.remove(); this.waitEl = null; }
  }

  update(dt) {
    this.sendT += dt;
    this.age = (this.age || 0) + dt;
    if (this.sendT >= 1 / 60) { this.session.sendInputs(); this.sendT = 0; }
    const now = performance.now();
    const silent = this.lastSnapAt ? (now - this.lastSnapAt) / 1000 : this.age;
    // nothing on the fast (unreliable) channel: ask the host to send the pictures on the reliable one
    if (silent > 1.5 && !this.askedReliable) { this.askedReliable = true; this.session.askReliableSnaps(); }
    this.waiting(silent > 1.2);
    if (this.offset === null || this.snaps.length === 0) { this.view.render(dt, 1); return; }
    const renderT = performance.now() - this.offset - INTERP;
    // pick the two snapshots around renderT
    let a = this.snaps[0], b = this.snaps[this.snaps.length - 1];
    for (let i = 0; i < this.snaps.length - 1; i++) {
      if (this.snaps[i].h <= renderT && this.snaps[i + 1].h >= renderT) { a = this.snaps[i]; b = this.snaps[i + 1]; break; }
    }
    if (renderT < this.snaps[0].h) { a = b = this.snaps[0]; }
    const t = b.h > a.h ? Math.min(1, Math.max(0, (renderT - a.h) / (b.h - a.h))) : 1;
    const W = this.W;
    W.applySnapshot(b.s);
    // fighter views interpolate between a and b
    for (const pf of a.s.f) {
      const V = this.view.views[pf[0]];
      if (!V) continue;
      V.prev.x = pf[1]; V.prev.y = pf[2]; V.prev.z = pf[3]; V.prev.facing = pf[7];
    }
    for (const F of W.list) {
      const V = this.view.views[F.slot];
      if (!V) continue;
      V.cur.x = F.x; V.cur.y = F.y; V.cur.z = F.z; V.cur.facing = F.facing;
      // positions used by effects follow the interpolated values
      const lx = V.prev.x + (F.x - V.prev.x) * t, ly = V.prev.y + (F.y - V.prev.y) * t, lz = V.prev.z + (F.z - V.prev.z) * t;
      F.x = lx; F.y = ly; F.z = lz;
    }
    // events due now
    W.events = [];
    while (this.events.length && this.events[0].h <= renderT) W.events.push(this.events.shift().e);
    if (W.events.length) for (const ev of W.events) this.view.fx.handle(ev, W);
    this.view.render(dt, t);
    if (W.phase === 'over' && !this.done) { this.done = true; if (this.onOver) this.onOver(W); }
  }

  dispose() { this.waiting(false); this.view.dispose(); }
}

export { unpackFighter };
