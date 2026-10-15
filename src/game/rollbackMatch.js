// An online match with rollback, for the host and the guests alike: every machine runs the match (RollbackCore,
// src/net/rollback.js) and only the inputs travel. This class feeds it the local pads, draws it and hooks it to the
// session (the host relays everybody's inputs).
import { RollbackCore, encodeInput, MAX_PREDICT } from '../net/rollback.js';
import { Input } from '../core/input.js';
import { MatchView } from './matchView.js';
import { STAGES } from '../sim/stages/index.js';

const READY_WAIT = 5000; // ms the host waits for the guests to have built the match before the clock starts
const DROP_AFTER = 3; // s without a guest's inputs before the CPU takes their fighter

export class RollbackMatch {
  constructor(app, session, cfg) {
    this.app = app;
    this.session = session;
    this.isHost = session.mode === 'host';
    const S = session, L = S.lobby;
    const humanSlots = [], localSlots = [], owners = {};
    for (const r of cfg.roster) {
      if (r.bot) continue;
      humanSlots.push(r.slot);
      const sl = L.slots[r.slot];
      if (sl && sl.owner === S.me && sl.dev) localSlots.push(r.slot);
      else if (sl) owners[r.slot] = sl.owner;
    }
    // the pads' press counters start from 0 for this match (the same on every machine)
    this.devices = {}; this.base = {}; this.last = {};
    for (const s of localSlots) {
      const d = L.slots[s].dev;
      this.devices[s] = d;
      this.base[s] = Input.sample(d).cnt.slice();
    }
    const send = (m, o = {}) => {
      const net = S.net;
      if (!net) return;
      if (!this.isHost) net.send(S.hostId(), m, o.fast);
      else if (o.to) net.send(o.to, m, o.fast);
      else for (const pid of net.peers.keys()) if (pid !== o.except) net.send(pid, m, o.fast);
    };
    this.core = new RollbackCore({ cfg, isHost: this.isHost, localSlots, humanSlots, owners, send, delay: cfg.delay });
    this.W = this.core.W;
    this.view = new MatchView(app, this.W, { names: cfg.names, deviceOf: (slot) => this.devices[slot], rumble: (slot, s, w, ms) => { const d = this.devices[slot]; if (d) Input.rumble(d, s, w, ms); } });
    app.audio.playMusic(STAGES[cfg.stage].music);
    if (this.isHost) {
      // the clock starts once every guest has built the match (or after a few seconds)
      this.waitReady = new Set(Object.values(owners));
      this.core.hold = this.waitReady.size > 0;
      this.holdUntil = performance.now() + READY_WAIT;
      this.core.onDesync = (pid, f) => {
        const sl = L.slots.find((x) => x && x.owner === pid);
        console.warn('[SpookyBagarre] écart avec ' + pid + ' à l\'image ' + f + ' : état renvoyé');
        if (S.onDiag) S.onDiag(null, 'Écart de simulation chez ' + ((sl && sl.name) || 'un invité') + ' à l\'image ' + f + ' (corrigé par l\'hôte)');
      };
    } else send({ t: 'rready' }, {});
    this.done = false;
  }

  // the Start menu is open over the match (it cannot pause it for everybody): this machine's fighters stand still,
  // and the presses made in the menu are not sent once it closes (the counters start again from there)
  block(on) {
    if (on === !!this.frozen) return;
    if (on) {
      this.frozen = {};
      for (const s in this.devices) { const x = Input.sample(this.devices[s]), b = this.base[s]; this.frozen[s] = x.cnt.map((c, i) => c - b[i]); }
    } else {
      for (const s in this.devices) { const x = Input.sample(this.devices[s]), f = this.frozen[s]; this.base[s] = x.cnt.map((c, i) => c - f[i]); }
      this.frozen = null;
    }
  }

  sampleLocal() {
    const out = {};
    if (this.frozen) {
      for (const s in this.devices) out[s] = this.last[s] = encodeInput({ mx: 0, my: 0, held: 0, cnt: this.frozen[s] });
      return out;
    }
    for (const s in this.devices) {
      const d = Input.get(this.devices[s]);
      if (!d || !d.connected) { if (this.last[s]) out[s] = this.last[s]; continue; } // pad unplugged: keep the last input
      const x = Input.sample(this.devices[s]), b = this.base[s];
      out[s] = this.last[s] = encodeInput({ mx: x.mx, my: x.my, held: x.held, cnt: x.cnt.map((c, i) => c - b[i]) });
    }
    return out;
  }

  onMessage(m, pid) {
    if (m.t === 'rready') { this.ready(pid); return; }
    if (m.t === 'rdrop') { if (this.onDropped) this.onDropped(); return; } // too long without news: the host took our fighter
    this.core.receive(m, pid);
  }

  ready(pid) {
    if (!this.waitReady) return;
    this.waitReady.delete(pid);
    if (!this.waitReady.size) this.core.hold = false;
  }

  // a guest left: the CPU plays their fighter from now on (on every machine, at the same frame)
  peerLeft(pid) {
    this.ready(pid);
    for (const s in this.core.owners) if (this.core.owners[s] === pid) this.core.makeBot(+s, 2);
  }

  update(dt) {
    const C = this.core;
    if (C.hold && performance.now() > this.holdUntil) C.hold = false;
    try { C.update(dt, () => this.sampleLocal()); } catch (e) { this.diag('simulation', e); }
    // host: a guest silent for a few seconds (gone without a word, or a dead connection) is played by the CPU
    if (this.isHost && C.waitingFor() > DROP_AFTER) {
      const f = C.frame + 1 - MAX_PREDICT;
      for (const s of [...C.remote]) {
        if (C.known[s] >= f) continue;
        const pid = C.owners[s], sl = this.session.lobby.slots[s];
        C.makeBot(s, 2);
        if (pid) {
          this.session.net.send(pid, { t: 'rdrop' });
          setTimeout(() => this.session.dropPeer(pid), 500); // the message first, then the door
        }
        if (this.session.onDiag) this.session.onDiag(null, ((sl && sl.name) || 'Un invité') + ' ne répond plus : l\'ordinateur joue son perso');
      }
    }
    if (C.changed) {
      C.changed = false;
      try { this.view.onTick(this.W, C.drainEvents()); } catch (e) { this.diag('effets', e); }
    }
    this.waiting(C.waitingFor() > 0.4 || (C.hold && C.frame === 0 && this.isHost));
    try { this.view.render(dt, C.alpha()); } catch (e) { this.diag('affichage', e); }
    // the host ends the match on a final frame (the results go to everybody)
    if (this.isHost && this.W.phase === 'over' && !this.done) {
      if (this.overAt === undefined) this.overAt = C.frame;
      if (C.confirmed() >= this.overAt) { this.done = true; if (this.onOver) this.onOver(this.W); }
    }
  }

  // "waiting for…" banner when someone's inputs do not come (instead of a silent frozen screen)
  waiting(on) {
    if (on && !this.waitEl) {
      this.waitEl = document.createElement('div');
      this.waitEl.className = 'netwait';
      this.waitEl.textContent = this.isHost && this.core.frame === 0 ? 'En attente des invités…' : 'En attente des autres joueurs…';
      this.app.ui.appendChild(this.waitEl);
    } else if (!on && this.waitEl) { this.waitEl.remove(); this.waitEl = null; }
  }

  // an error on a guest: logged, and sent to the host so it shows on the host's screen (a few times at most)
  diag(where, e) {
    const msg = where + ' : ' + ((e && e.message) || e) + (e && e.stack ? ' | ' + String(e.stack).split('\n').slice(1, 3).join(' ').replace(/\s+/g, ' ') : '');
    if (this.lastDiag === msg) return;
    this.lastDiag = msg;
    console.error('[SpookyBagarre]', msg);
    this.diagN = (this.diagN || 0) + 1;
    if (!this.isHost && this.diagN <= 6) this.session.sendDiag(msg);
  }

  // network numbers for the debug overlay (?netstats=1)
  netStats() {
    const C = this.core, S = C.stats;
    return { frame: C.frame, confirmed: C.confirmed(), rtt: Math.round(C.rtt), lead: +C.lead.toFixed(1), delay: C.delay, ...S };
  }

  dispose() { this.waiting(false); this.view.dispose(); }
}
