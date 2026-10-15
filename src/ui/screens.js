// Menu flow: title (CPU fight behind) -> main menu -> local / host online / join online -> character select
// -> stage & rules -> match -> results. Gamepad first (stick / D-pad, A confirm, B back), keyboard and mouse too.
import * as THREE from 'three';
import { Input } from '../core/input.js';
import { CHARS, CHAR_ORDER } from '../sim/chars/index.js';
import { STAGES, STAGE_ORDER } from '../sim/stages/index.js';
import { COLORS } from '../sim/constants.js';
import { Session } from '../game/session.js';
import { LocalMatch } from '../game/localMatch.js';
import { ClientMatch } from '../game/clientMatch.js';
import { RollbackMatch } from '../game/rollbackMatch.js';
import { Showcase } from './showcase.js';
import { EMOTES } from '../render/rig/nativeMoves.js';
import { portraitURL } from './hud.js';
import { buildStageView, syncStageView } from '../render/stages/index.js';
import { World } from '../sim/world.js';
import { Crypt, VW, VH } from './crypt.js';
import { Slab } from './slab.js';
import { fitPx } from './pxgrid.js';

const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const GRID_COLS = 7; // 18 fighters and the random tile on 3 rows
const CS_TILES = [...CHAR_ORDER, 'random'];
const UI = 'assets/ui/crypt/';
let inputLock = false; // during a screen change

function anyMenu() {
  const ev = { up: 0, down: 0, left: 0, right: 0, confirm: 0, back: 0, start: 0, x: 0, y: 0, dev: null };
  if (inputLock) return ev;
  for (const d of Input.list()) {
    for (const k of Object.keys(ev)) if (k !== 'dev' && d.menu[k]) { ev[k] = 1; ev.dev = ev.dev || d.id; }
  }
  return ev;
}

function padLabel(dev) {
  const d = Input.get(dev);
  if (!d) return '?';
  if (d.type === 'keyboard') return dev === 'kb1' ? 'Clavier ZQSD' : 'Clavier flèches';
  if (d.type === 'virtual') return 'Virtuelle';
  return d.name;
}

// list menu: [{label, act, val, left, right, hint}]
class ListMenu {
  constructor(parent, items, opts = {}) {
    this.items = items; this.i = 0; this.opts = opts;
    this.el = h('div', 'list ' + (opts.cls || ''));
    parent.appendChild(this.el);
    this.render();
  }
  render() {
    this.el.innerHTML = '';
    this.items.forEach((it, i) => {
      const b = h('button', 'item' + (i === this.i ? ' focus' : '') + (it.disabled ? ' disabled' : ''));
      b.innerHTML = `<span class="lab">${it.label}</span>` + (it.val ? `<span class="val">◀ ${it.val()} ▶</span>` : '') + (it.hint ? `<small>${it.hint}</small>` : '');
      b.onmouseenter = () => { if (this.i !== i) { this.i = i; this.render(); } };
      b.onclick = (e) => {
        if (it.val && e.target.closest('.val')) { const r = e.target.getBoundingClientRect(); (e.clientX - r.left < r.width / 2 ? it.left : it.right)?.(); this.render(); return; }
        this.activate(i);
      };
      this.el.appendChild(b);
    });
  }
  activate(i) { const it = this.items[i]; if (!it || it.disabled) return; window.__app.audio.sfx('menuOk'); it.act ? it.act() : it.right?.(); this.render(); }
  update(ev) {
    const n = this.items.length;
    if (ev.up) { this.i = (this.i + n - 1) % n; window.__app.audio.sfx('menuMove'); this.render(); }
    if (ev.down) { this.i = (this.i + 1) % n; window.__app.audio.sfx('menuMove'); this.render(); }
    const it = this.items[this.i];
    if (ev.left && it.left) { it.left(); window.__app.audio.sfx('menuMove'); this.render(); }
    if (ev.right && it.right) { it.right(); window.__app.audio.sfx('menuMove'); this.render(); }
    if (ev.confirm) this.activate(this.i);
  }
}

// a menu of tomb slabs (pixel art): [{label, hint, act}], a skeleton hand points at the chosen one
class PixelMenu {
  constructor(parent, items, opts = {}) {
    this.items = items; this.i = 0; this.opts = opts;
    this.el = h('div', 'pmenu');
    this.el.style.top = (opts.top ?? 128) + 'px';
    parent.appendChild(this.el);
    this.btns = items.map((it, i) => {
      const b = h('div', 'pbtn', `<img src="${UI}hd/button.png" width="174" alt=""><img class="slime" src="${UI}hd/slime.png" width="194" alt=""><span class="lab">${it.label}</span>` + (it.hint ? `<span class="hint">${it.hint}</span>` : ''));
      b.style.top = i * (opts.gap ?? 44) + 'px';
      b.style.setProperty('--i', i);
      b.onmouseenter = () => this.focus(i);
      b.onclick = () => { this.focus(i); this.activate(); };
      this.el.appendChild(b);
      return b;
    });
    this.hand = h('img', 'hand');
    this.hand.src = UI + 'hd/hand.png'; this.hand.width = 42;
    this.el.appendChild(this.hand);
    this.focus(0, true);
  }
  focus(i, quiet) {
    if (i === this.i && !quiet) return;
    this.btns[this.i].classList.remove('on', 'pop');
    this.i = i;
    const b = this.btns[i];
    b.classList.add('on');
    b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
    this.hand.style.top = (parseInt(b.style.top, 10) + 11) + 'px';
    if (!quiet) window.__app.audio.sfx('menuMove');
  }
  activate() {
    const it = this.items[this.i];
    if (!it || it.disabled || this.done) return;
    this.done = true;
    const b = this.btns[this.i];
    b.classList.remove('press'); void b.offsetWidth; b.classList.add('press');
    window.__app.audio.sfx('menuOk');
    if (this.opts.crypt) this.opts.crypt.shake(2, 0.15);
    setTimeout(() => { this.done = false; it.act(); }, 110);
  }
  update(ev) {
    const n = this.items.length;
    if (ev.up) this.focus((this.i + n - 1) % n);
    if (ev.down) this.focus((this.i + 1) % n);
    if (ev.confirm) this.activate();
  }
}

// rows on a stone tablet: [{label, val, left, right, act}]; ←→ change a value, A acts, the hand points at the row
class PixelList {
  constructor(parent, items, opts = {}) {
    this.items = items; this.i = 0; this.rowH = opts.rowH ?? 18; // rows of fixed height (css .prow)
    this.el = h('div', 'plist stone');
    this.el.style.left = (opts.left ?? 170) + 'px';
    this.el.style.top = (opts.top ?? 64) + 'px';
    this.el.style.width = (opts.width ?? 300) + 'px';
    parent.appendChild(this.el);
    this.rows = items.map((it, i) => {
      const r = h('div', 'prow', `<span class="pl">${it.label}</span>` + (it.val ? `<span class="pv"><img class="al" src="${UI}hd/arrow_l.png" width="8" alt="">${it.bar ? '<i class="pbar"><i></i></i>' : ''}<b></b><img class="ar" src="${UI}hd/arrow_r.png" width="8" alt=""></span>` : ''));
      r.style.setProperty('--i', i);
      r.onmouseenter = () => this.focus(i);
      r.onclick = (e) => {
        this.focus(i);
        if (it.val && e.target.closest('.pv')) { const b = e.target.closest('.pv').getBoundingClientRect(); this.change(e.clientX - b.left < b.width / 2 ? -1 : 1); return; }
        this.activate();
      };
      this.el.appendChild(r);
      return r;
    });
    this.hand = h('img', 'hand');
    this.hand.src = UI + 'hd/hand.png'; this.hand.width = 42;
    this.el.appendChild(this.hand);
    this.focus(0, true);
    this.render();
  }
  render() {
    this.items.forEach((it, i) => {
      if (it.val) this.rows[i].querySelector('.pv b').textContent = it.val();
      if (it.bar) this.rows[i].querySelector('.pbar i').style.width = Math.round(it.bar() * 100) + '%';
    });
  }
  focus(i, quiet) {
    if (i === this.i && !quiet) return;
    this.rows[this.i].classList.remove('on');
    this.i = i;
    const r = this.rows[i];
    r.classList.add('on');
    this.hand.style.top = (i * this.rowH + 1) + 'px';
    if (!quiet) window.__app.audio.sfx('menuMove');
  }
  change(d) {
    const it = this.items[this.i];
    const f = d < 0 ? it.left : it.right;
    if (!f) return;
    f();
    window.__app.audio.sfx('menuMove');
    const b = this.rows[this.i].querySelector('.pv');
    if (b) { b.classList.remove('kick', 'kickl'); void b.offsetWidth; b.classList.add(d < 0 ? 'kickl' : 'kick'); }
    this.render();
  }
  activate() {
    const it = this.items[this.i];
    if (!it) return;
    if (!it.act) { this.change(1); return; }
    const r = this.rows[this.i];
    r.classList.remove('press'); void r.offsetWidth; r.classList.add('press');
    window.__app.audio.sfx('menuOk');
    it.act();
    this.render();
  }
  update(ev) {
    const n = this.items.length;
    if (ev.up) this.focus((this.i + n - 1) % n);
    if (ev.down) this.focus((this.i + 1) % n);
    if (ev.left) this.change(-1);
    if (ev.right) this.change(1);
    if (ev.confirm) this.activate();
  }
}

export class Screens {
  constructor(app) {
    this.app = app;
    this.layer = h('div', 'screens');
    app.ui.appendChild(this.layer);
    this.attract = null;
    this.session = null;
    this.thumbs = {};
    // the pixel art menus: the graveyard scene behind, the tomb door for screen changes, the 640x360 grid
    this.crypt = new Crypt(app.ui);
    this.crypt.show(false);
    this.slab = new Slab(app, this.crypt);
    fitPx();
  }

  // change screen behind the falling tomb door (input ignored meanwhile)
  go(fn) {
    if (this.slab.busy) return;
    inputLock = true;
    this.slab.go(() => fn());
    setTimeout(() => { inputLock = false; }, 700);
  }

  set(update, dispose) {
    this.layer.innerHTML = '';
    this.app.setScreen({ update, dispose });
  }

  // ---- behind the menus: the graveyard where the friends hang out (pixel art, src/ui/crypt.js) ----------------------
  // dim: how much the scene is darkened (the title and the main menu show it fully, the panels need it darker)
  startAttract(dim = 0.55, music = 'menu') {
    if (this.resShow) { this.resShow.dispose(); this.resShow = null; }
    this.crypt.setDim(dim);
    this.music(music);
    if (this.crypt.on) return;
    this.crypt.show(true);
  }
  // the music of a screen (only when it changes: a menu after another keeps its song going)
  music(id) { if (this.curMusic !== id) { this.curMusic = id; this.app.audio.playMusic(id); } }
  stopAttract() {
    this.crypt.show(false);
    this.curMusic = null; // a match or a 3D screen plays its own
    if (this.attract) { this.attract.dispose(); this.attract = null; }
    if (this.resShow) { this.resShow.dispose(); this.resShow = null; }
  }
  attractUpdate(dt) { this.crypt.update(dt); }

  // ---- title ---------------------------------------------------------------------------------------------------
  // the empty graveyard and the big logo; A and the friends burst out of the ground (main menu)
  title() {
    this.startAttract(0.5, 'title'); // the graveyard in the dark until the lightning (main menu)
    for (const c of this.crypt.cast) { c.rise = 0; c.delay = 1e9; } // hidden until the menu
    const el = h('div', 'px');
    el.innerHTML = `<div class="row" style="top:30px"><img class="logo-big" src="${UI}hd/logo.png" width="360" alt="Spooky Bagarre"></div>
      <div class="press txt">Appuie sur <b>A</b> ou <b>Entrée</b></div>
      <div class="credits txt">${CHAR_ORDER.length} monstres · ${STAGE_ORDER.length} arènes · jusqu'à 4 joueurs · en ligne · par VibePandrezz</div>`;
    let leaving = false;
    const go = () => {
      if (leaving) return;
      leaving = true;
      this.app.audio.unlock();
      this.app.audio.sfx('menuOk');
      this.app.audio.sfx('thud', 0, 0.7);
      el.querySelector('.logo-big').classList.add('out');
      el.querySelector('.press').remove();
      this.crypt.shake(4, 0.35);
      setTimeout(() => this.mainMenu(true), 240);
    };
    this.set((dt) => {
      this.attractUpdate(dt);
      const ev = anyMenu();
      if (ev.confirm || ev.start) go();
    }, () => {});
    this.layer.appendChild(el);
    el.onclick = go;
  }

  // fromTitle: the friends rise from their graves and the slabs fly in
  mainMenu(fromTitle) {
    this.startAttract(0);
    if (this.session) { this.session.close(); this.session = null; }
    if (fromTitle || this.crypt.cast.some((c) => c.rise < 1 && c.delay > 100)) { this.crypt.rise(); this.app.audio.sfx('thunder', 0, 0.55); }
    const el = h('div', 'px');
    el.innerHTML = `<div class="row" style="top:3px"><img class="logo-s" src="${UI}hd/logo_s.png" width="212" alt="Spooky Bagarre"></div>`;
    const menu = new PixelMenu(el, [
      { label: 'COMBAT LOCAL', hint: 'Sur ce PC, manettes et claviers', act: () => this.go(() => this.startLocal()) },
      { label: 'CRÉER UN SALON', hint: 'Tes potes te rejoignent avec un code', act: () => this.go(() => this.startHost()) },
      { label: 'REJOINDRE', hint: 'Entre le code de ton pote', act: () => this.go(() => this.joinScreen()) },
      { label: 'COMMENT JOUER', hint: 'Les coups, les règles, les astuces', act: () => this.go(() => this.howto()) },
      { label: 'OPTIONS', hint: 'Son, image, hémoglobine, manette', act: () => this.go(() => this.options()) },
    ], { crypt: this.crypt });
    this.set((dt) => {
      this.attractUpdate(dt);
      const ev = anyMenu();
      menu.update(ev);
      if (ev.back) { this.app.audio.sfx('menuBack'); this.crypt.sink(); this.title(); }
    });
    this.layer.appendChild(el);
  }

  // ---- sessions -------------------------------------------------------------------------------------------------
  startLocal() {
    this.session = new Session(this.app, 'local');
    this.session.onCmd = (k, a) => this.lobbyCmd(k, a);
    this.charSelect();
  }

  // local and host: the screen changes of the lobby, asked by whoever chooses the arena (a guest too: the player who
  // pressed START; the others, the host included, watch)
  lobbyCmd(k, stage) {
    // the tomb door is still moving (the previous screen change): do it right after, not never
    if (this.slab.busy) { setTimeout(() => this.lobbyCmd(k, stage), 120); return; }
    if (k === 'stagesel') this.go(() => this.stageSelect());
    else if (k === 'charsel') this.go(() => { this.goto('charsel'); this.charSelect(); });
    else if (k === 'launch') this.go(() => this.startMatch(stage));
  }

  async startHost() {
    const transport = this.app.params.get('net') === 'local' ? 'local' : 'peer';
    this.session = new Session(this.app, 'host', transport);
    this.session.onCmd = (k, a) => this.lobbyCmd(k, a);
    this.wait('Ouverture du salon…');
    try {
      await this.session.hostOnline();
      this.hookHost();
      this.charSelect();
    } catch (e) { this.error('Impossible de créer le salon : ' + (e.message || e.type || e)); }
  }

  joinScreen() {
    this.startAttract(0.6, 'lobby');
    const el = h('div', 'px');
    el.innerHTML = '<div class="ptitle txt">REJOINDRE UN SALON</div>';
    const letters = 'ABCDEFGHJKMNPQRSTUVWXYZ';
    const code = (localStorage.getItem('spookybagarre.lastCode') || 'AAAA').split('');
    let pos = 0;
    const box = h('div', 'pcode');
    el.appendChild(box);
    el.appendChild(h('div', 'phint txt', 'Stick ↑↓ : la lettre · ←→ : bouger · ou tape le code au clavier'));
    const input = h('input', 'pinput');
    input.maxLength = 4; input.placeholder = 'CODE';
    el.appendChild(input);
    const render = (bump) => {
      box.innerHTML = code.map((c, i) => `<div class="pslot${i === pos ? ' on' : ''}${i === bump ? ' bump' : ''}">${i === pos ? `<img class="up" src="${UI}hd/arrow_r.png" width="8" alt=""><img class="dn" src="${UI}hd/arrow_r.png" width="8" alt="">` : ''}<b>${c}</b></div>`).join('');
    };
    render();
    input.oninput = () => { const v = input.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4); input.value = v; for (let i = 0; i < 4; i++) code[i] = v[i] || code[i]; render(); };
    const go = () => {
      const c = code.join('');
      localStorage.setItem('spookybagarre.lastCode', c);
      const transport = this.app.params.get('net') === 'local' ? 'local' : 'peer';
      this.go(async () => {
        this.session = new Session(this.app, 'client', transport);
        this.wait('Connexion au salon ' + c);
        try { await this.session.joinOnline(c); this.hookClient(); this.charSelect(); }
        catch (e) { this.error('Connexion impossible : ' + (e.message || e.type || e)); }
      });
    };
    const menu = new PixelMenu(el, [{ label: 'REJOINDRE', hint: 'le code est sur l\'écran de ton pote', act: go }], { crypt: this.crypt, top: 252 });
    this.set((dt) => {
      this.attractUpdate(dt);
      if (document.activeElement === input) { if (anyMenu().confirm) go(); return; }
      const ev = anyMenu();
      if (ev.left) { pos = (pos + 3) % 4; render(); this.app.audio.sfx('menuMove'); }
      if (ev.right) { pos = (pos + 1) % 4; render(); this.app.audio.sfx('menuMove'); }
      if (ev.up || ev.down) { let k = letters.indexOf(code[pos]); k = (k + (ev.up ? 1 : -1) + letters.length) % letters.length; code[pos] = letters[k]; render(pos); this.app.audio.sfx('menuMove'); }
      if (ev.confirm) menu.activate();
      if (ev.back) { this.app.audio.sfx('menuBack'); this.go(() => this.mainMenu()); }
    });
    this.layer.appendChild(el);
  }

  // a message on a stone tablet while something happens (opening a lobby, joining one)
  wait(msg) {
    this.startAttract(0.6, 'lobby');
    const el = h('div', 'px');
    el.innerHTML = `<div class="pwait stone"><img class="skull" src="${UI}hd/skull.png" width="9" alt=""><span class="txt">${msg}</span><i class="dots"><b>.</b><b>.</b><b>.</b></i></div>`;
    this.set((dt) => this.attractUpdate(dt));
    this.layer.appendChild(el);
  }

  error(msg) {
    this.startAttract(0.6);
    const el = h('div', 'px');
    el.innerHTML = `<div class="pwait err stone"><span class="txt">${msg}</span></div>`;
    const back = () => this.go(() => this.mainMenu());
    const menu = new PixelMenu(el, [{ label: 'RETOUR', hint: 'au menu principal', act: back }], { crypt: this.crypt, top: 236 });
    this.set((dt) => { this.attractUpdate(dt); const ev = anyMenu(); menu.update(ev); if (ev.back) back(); });
    this.layer.appendChild(el);
  }

  // host: forward match messages; client: follow the host's phases
  hookHost() {
    const S = this.session;
    S.onDiag = (name, msg) => this.diagLine(name, msg);
    S.onHostMsg = (m, pid) => { if (this.match && this.match.onMessage) this.match.onMessage(m, pid); };
    S.onPeerLeft = (pid) => {
      if (this.match && this.match.peerLeft) { this.match.peerLeft(pid); return; }
      if (this.match && this.match.W) { /* their fighter stays as a CPU */ for (const F of this.match.W.list) { const slot = S.lobby.slots[F.slot]; if (!slot) F.bot = 2; } }
    };
  }

  // a guest's error, written at the bottom of the host's screen (so it can be sent to whoever fixes the game)
  diagLine(name, msg) {
    console.warn('[SpookyBagarre] erreur chez ' + name + ' : ' + msg);
    let box = document.querySelector('.netdiag');
    if (!box) { box = h('div', 'netdiag'); this.app.ui.appendChild(box); }
    const line = h('div', '', '');
    line.textContent = name ? '⚠ Erreur chez ' + name + ' : ' + msg : '⚠ ' + msg; // no name: a plain notice
    box.appendChild(line);
    while (box.children.length > 4) box.firstChild.remove();
    clearTimeout(this.diagT);
    this.diagT = setTimeout(() => box.remove(), 30000);
  }

  hookClient() {
    const S = this.session;
    S.onHostLost = () => { this.stopMatch(); this.error('L\'hôte a quitté le salon.'); };
    S.onClientMsg = (m) => {
      if (m.t === 'start') this.clientStart(m.cfg);
      else if (m.t === 'results') { this.stopMatch(); this.results(m.r); }
      else if (m.t === 'goto') {
        if (m.to === 'charsel') { this.stopMatch(); this.charSelect(); }
        if (m.to === 'stagesel') this.stageSelect();
      }
      else if (this.match && this.match.onMessage) this.match.onMessage(m, S.hostId()); // the match's own messages
    };
  }

  goto(to) { if (this.session && this.session.mode === 'host') this.session.net.broadcast({ t: 'goto', to }); }

  // ---- character select (pixel art over the 3D crypt slab, both on the 640x360 grid) --------------------------------
  charSelect() {
    this.stopAttract();
    const S = this.session, app = this.app;
    const show = new Showcase(app, 'cemetery');
    show.look = { y: 2.5, dist: 10 }; // closer, the fighters lower: the grid and the cards keep the top and the bottom
    this.music('charsel');
    const el = h('div', 'px charsel-px');
    el.innerHTML = `<div class="cs-title txt">CHOISIS TON MONSTRE</div>` +
      (S.lobby.code ? `<div class="cs-room"><small>SALON</small><b>${S.lobby.code}</b><i>${S.mode === 'host' ? 'donne ce code à tes potes' : 'connecté'}</i></div>` : '');
    const grid = h('div', 'cs-grid2');
    CS_TILES.forEach((id, i) => {
      const t = h('div', 'cs-tile');
      t.style.left = (i % GRID_COLS) * 47 + 'px';
      t.style.top = Math.floor(i / GRID_COLS) * 47 + 'px';
      t.innerHTML = id === 'random' ? '<b class="q">?</b>' : `<img src="assets/ui/portraits/${id}.png" alt="">`;
      t.onclick = () => { const slot = S.mySlots()[0]; if (slot !== undefined) this.csPick(slot, i); };
      grid.appendChild(t);
    });
    el.appendChild(grid);
    const info = h('div', 'cs-info2');
    el.appendChild(info);
    const banner = h('div', 'cs-ready', '<span>PRÊT POUR LA BAGARRE !</span><small></small>');
    el.appendChild(banner);
    const cards = h('div', 'cs-cards');
    el.appendChild(cards);
    const help = h('div', 'cs-help2 txt', '<b class="ka">A</b> rejoindre / choisir · <b class="kb">B</b> annuler · <b class="ky">Y</b> + CPU · <b class="kx">X</b> − CPU · <b>START</b> c\'est parti');
    el.appendChild(help);
    this.layer.innerHTML = '';
    this.layer.appendChild(el);
    const tiles = [...grid.children];
    const lc = {}; // local cursors (instant on clients; the host gets them a few ms later)
    const was = []; // what each card showed last time (to animate only the changes)
    let lastInfo = null;
    const render = () => {
      const L = S.lobby;
      tiles.forEach((t) => { t.querySelectorAll('.cs-tok').forEach((c) => c.remove()); t.classList.remove('hot'); });
      L.slots.forEach((s, i) => {
        let c = cards.children[i];
        if (!c) { c = h('div', 'cs-card'); c.style.left = i * 158 + 'px'; c.style.setProperty('--pc', COLORS[i]); cards.appendChild(c); }
        const key = s ? [s.char, s.ready, s.cpu, s.name].join('|') : '';
        if (was[i] !== key) {
          const before = was[i];
          was[i] = key;
          if (!s) c.innerHTML = `<b class="cj">J${i + 1}</b><span class="cw">Appuie sur A</span>`;
          else {
            const ch = s.char ? CHARS[s.char] : null;
            const who = s.cpu ? `CPU niveau ${s.cpu}` : (s.owner === S.me ? padLabel(s.dev) : s.name);
            c.innerHTML = `<div class="cp">${ch ? `<img src="assets/ui/portraits/${s.char}.png" alt="">` : '<b class="q">?</b>'}</div><b class="cj">J${i + 1}</b>
              <span class="cn">${ch ? ch.name : '…'}</span><span class="cw">${who}</span>${s.ready ? '<b class="stamp">PRÊT !</b>' : ''}`;
            c.onclick = () => { if (s.cpu && S.mode !== 'client') { const k = (CHAR_ORDER.indexOf(s.char) + 1) % CHAR_ORDER.length; S.request({ k: 'cpuChar', slot: i, char: CHAR_ORDER[k] }); } };
            // a new pick: the portrait slams in, the stamp falls
            if (s.ready && (!before || !before.split('|')[1] || before.split('|')[1] === 'false' || before.split('|')[0] !== s.char)) {
              c.classList.remove('slam'); void c.offsetWidth; c.classList.add('slam');
              if (!s.cpu) { app.audio.sfx('stamp', 0, 0.5); this.uiShake(); }
            }
          }
          c.classList.toggle('used', !!s);
          c.classList.toggle('ready', !!(s && s.ready));
        }
        show.set(i, s && s.char ? s.char : null);
        if (s && !s.cpu && !s.ready) {
          const sc = s.owner === S.me && s.dev && lc[s.dev] !== undefined ? lc[s.dev] : s.cursor;
          if (tiles[sc]) {
            const tok = h('div', 'cs-tok', `<img src="${UI}hd/token${i + 1}.png" width="14" alt=""><b>${i + 1}</b>`);
            tok.style.left = (i % 2) * 24 - 4 + 'px';
            tok.style.top = Math.floor(i / 2) * 22 - 6 + 'px';
            tiles[sc].appendChild(tok);
            tiles[sc].classList.add('hot');
          }
        }
      });
      // info: the character under the first local cursor
      const mine = S.mySlots();
      const cs = mine.length ? L.slots[mine[0]] : null;
      const id = cs ? (cs.ready ? cs.char : CS_TILES[lc[cs.dev] ?? cs.cursor]) : null;
      if (id !== lastInfo) {
        lastInfo = id;
        if (id && id !== 'random') {
          const d = CHARS[id], sp = d.specialsInfo;
          info.innerHTML = `<div class="ci-n" style="color:${d.color}">${d.name}</div><div class="ci-t">${d.title}</div>
            <div class="ci-s"><b>X</b> ${sp.n}</div><div class="ci-s"><b>X + côté</b> ${sp.s}</div><div class="ci-s"><b>X + haut</b> ${sp.u}</div><div class="ci-s"><b>X + bas</b> ${sp.d}</div>`;
          info.classList.remove('flip'); void info.offsetWidth; info.classList.add('flip');
        } else info.innerHTML = id === 'random' ? '<div class="ci-n">AU HASARD</div><div class="ci-t">Le cimetière choisira pour toi.</div>' : '<div class="ci-t">Appuie sur A pour rejoindre la bagarre.</div>';
      }
      const ready = S.allReady();
      if (ready !== banner.classList.contains('on')) {
        banner.classList.toggle('on', ready);
        if (ready) { app.audio.sfx('go', 0, 0.6); this.uiShake(); }
      }
      banner.querySelector('small').textContent = S.mode !== 'client' || S.mySlots().length ? 'START ou A : choisir l\'arène' : 'un joueur va lancer la bagarre…';
    };
    const off = S.onChange(() => render());
    render();
    if (S.mode !== 'client') S.request({ k: 'phase', phase: 'charsel' });
    const leave = (fn) => { off(); this.go(() => { show.dispose(); fn(); }); };
    this.set((dt) => {
      show.update(dt);
      const L = S.lobby;
      for (const d of Input.list()) {
        if (inputLock) break;
        const m = d.menu;
        const slot = S.slotOfDevice(d.id);
        if (slot < 0) {
          // the host without a fighter can still launch (it then only watches)
          if (m.start && S.mode !== 'client' && S.allReady()) { app.audio.sfx('menuOk'); S.request({ k: 'toStage' }); return; }
          if (m.confirm || m.start) { S.request({ k: 'join', dev: d.id, name: (!S.mySlots().length && app.settings.name) || padLabel(d.id) }); app.audio.sfx('menuOk'); }
          if (m.back && S.mySlots().length === 0) { app.audio.sfx('menuBack'); leave(() => this.mainMenu()); return; }
          continue;
        }
        const s = L.slots[slot];
        if (!s) continue;
        if (!s.ready) {
          const c0 = lc[d.id] ?? s.cursor;
          let c = c0;
          if (m.left) c = (c + CS_TILES.length - 1) % CS_TILES.length;
          if (m.right) c = (c + 1) % CS_TILES.length;
          if (m.up) c = (c + CS_TILES.length - GRID_COLS) % CS_TILES.length;
          if (m.down) c = (c + GRID_COLS) % CS_TILES.length;
          if (c !== c0) { lc[d.id] = c; S.request({ k: 'cursor', slot, c }); app.audio.sfx('menuMove'); render(); }
          if (m.confirm) this.csPick(slot, c);
          if (m.back) { S.request({ k: 'leave', slot }); app.audio.sfx('menuBack'); }
        } else {
          if (m.back) { S.request({ k: 'pick', slot, char: null }); app.audio.sfx('menuBack'); }
          if ((m.start || m.confirm) && S.allReady()) { app.audio.sfx('menuOk'); S.request({ k: 'toStage' }); return; }
        }
        if (S.mode !== 'client') {
          if (m.y) { S.request({ k: 'cpu+' }); app.audio.sfx('menuOk'); }
          if (m.x) { S.request({ k: 'cpu-' }); app.audio.sfx('menuBack'); }
        }
      }
    }, () => { off(); show.dispose(); });
    this.layer.appendChild(el);
    this.csShow = show;
  }

  // a small shake of the whole interface (a stamp, a pick)
  uiShake() { const u = this.app.ui; u.classList.remove('shake'); void u.offsetWidth; u.classList.add('shake'); }

  csPick(slot, cursor) {
    const S = this.session;
    let id = CS_TILES[cursor];
    if (id === 'random') id = CHAR_ORDER[Math.floor(Math.random() * CHAR_ORDER.length)];
    S.request({ k: 'pick', slot, char: id });
    this.app.audio.sfx('menuOk');
    this.app.audio.say(CHARS[id].name + ' !', 0.5, 1.05);
    if (this.csShow) setTimeout(() => this.csShow && this.csShow.set(slot, id, true), 30);
  }

  // ---- stage & rules ----------------------------------------------------------------------------------------------
  stageThumb(id) {
    if (this.thumbs[id]) return this.thumbs[id];
    const TW = 330, TH = 186; // 3 times its size on the 640x360 grid (sharp on a 1080p screen)
    const R = this.app.renderer;
    const scene = new THREE.Scene();
    const v = buildStageView(STAGES[id]);
    scene.add(v.group);
    scene.fog = new THREE.Fog(v.fog[0], v.fog[1], v.fog[2]);
    scene.background = new THREE.Color(v.bg);
    const W = new World({ stage: id, roster: [], rules: {} });
    syncStageView(v, W.stage);
    if (v.update) v.update(0.016, 3, W.stage, W);
    const cam = new THREE.PerspectiveCamera(42, 16 / 9, 0.3, 400);
    cam.position.set(0, 12, 20); cam.lookAt(0, -1, 0);
    const rt = new THREE.WebGLRenderTarget(TW, TH);
    R.gl.setRenderTarget(rt); R.gl.render(scene, cam); R.gl.setRenderTarget(null);
    const px = new Uint8Array(TW * TH * 4);
    R.gl.readRenderTargetPixels(rt, 0, 0, TW, TH, px);
    const c = document.createElement('canvas'); c.width = TW; c.height = TH;
    const g = c.getContext('2d'), img = g.createImageData(TW, TH);
    for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
      const s = ((TH - 1 - y) * TW + x) * 4, d = (y * TW + x) * 4;
      for (let k = 0; k < 3; k++) { const lin = px[s + k] / 255; img.data[d + k] = 255 * (lin <= 0.0031308 ? lin * 12.92 : 1.055 * Math.pow(lin, 1 / 2.4) - 0.055); }
      img.data[d + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    rt.dispose();
    scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    this.thumbs[id] = c.toDataURL();
    return this.thumbs[id];
  }

  stageSelect() {
    const S = this.session, app = this.app;
    if (S.mode === 'host') this.goto('stagesel');
    if (S.mode !== 'client') S.request({ k: 'phase', phase: 'stagesel' });
    this.startAttract(0.65, 'charsel');
    const el = h('div', 'px');
    el.innerHTML = '<div class="cs-title txt">CHOISIS L\'ARÈNE</div>';
    const grid = h('div', 'ss-grid2');
    const all = [...STAGE_ORDER, 'random'];
    all.forEach((id, i) => {
      const t = h('div', 'ss-tile');
      t.style.left = (i % 5) * 122 + 'px';
      t.style.top = Math.floor(i / 5) * 74 + 'px';
      t.style.setProperty('--i', i);
      t.innerHTML = id === 'random' ? '<b class="q">?</b>' : `<img src="${this.stageThumb(id)}" width="110" height="62" alt="">`;
      t.onclick = () => { if (S.choosing()) { cursor = i; S.request({ k: 'stage', stage: id, cursor: i }); go(); } };
      grid.appendChild(t);
    });
    el.appendChild(grid);
    const blurb = h('div', 'ss-blurb2 stone');
    el.appendChild(blurb);
    const rulesEl = h('div', 'ss-rules2');
    el.appendChild(rulesEl);
    const help = h('div', 'cs-help2 txt ss-help');
    el.appendChild(help);
    let cursor = Math.max(0, S.lobby.stageCursor || 0);
    let row = 0; // 0 = stages, 1.. = rules
    let shown = -1;
    const R = () => S.lobby.rules;
    const ruleItems = [
      { label: 'MODE', val: () => (R().mode === 'stock' ? 'Vies' : 'Chrono'), ch: () => ({ mode: R().mode === 'stock' ? 'time' : 'stock' }) },
      { label: 'VIES', val: () => R().stocks, ch: (d) => ({ stocks: Math.max(1, Math.min(9, R().stocks + d)) }) },
      { label: 'CHRONO', val: () => Math.round(R().time / 60) + ' min', ch: (d) => ({ time: Math.max(60, Math.min(600, R().time + d * 60)) }) },
      { label: 'PIÈGES', val: () => (R().hazards ? 'Oui' : 'Non'), ch: () => ({ hazards: !R().hazards }) },
      { label: 'NIVEAU CPU', val: () => ['', 'Facile', 'Normal', 'Brutal'][R().cpuLevel || 2], ch: (d) => ({ cpuLevel: Math.max(1, Math.min(3, (R().cpuLevel || 2) + d)) }) },
    ];
    const render = () => {
      const cur = S.choosing() ? cursor : S.lobby.stageCursor;
      [...grid.children].forEach((t, i) => t.classList.toggle('on', i === cur && row === 0));
      if (cur !== shown) {
        shown = cur;
        const id = all[cur];
        blurb.innerHTML = id && id !== 'random' ? `<b>${STAGES[id].name}</b><span>${STAGES[id].blurb}</span>` : '<b>AU HASARD</b><span>Le destin choisira ton cimetière.</span>';
        blurb.classList.remove('flip'); void blurb.offsetWidth; blurb.classList.add('flip');
      }
      rulesEl.innerHTML = ruleItems.map((r, i) => `<div class="ss-rule${row === i + 1 ? ' on' : ''}"><small>${r.label}</small><span><img src="${UI}hd/arrow_l.png" width="8" alt=""><b>${r.val()}</b><img src="${UI}hd/arrow_r.png" width="8" alt=""></span></div>`).join('');
      const who = S.lobby.slots.find((x) => x && !x.cpu && x.owner === S.lobby.chooser);
      if (S.choosing()) help.innerHTML = '<b class="ka">A</b> lancer le combat · <b class="kb">B</b> retour · <b>↓</b> les règles';
      else help.textContent = (who ? who.name : 'L\'hôte') + ' choisit l\'arène…';
    };
    const off = S.onChange(render);
    render();
    const go = () => {
      let id = all[cursor];
      if (id === 'random') id = STAGE_ORDER[Math.floor(Math.random() * STAGE_ORDER.length)];
      S.request({ k: 'stage', stage: id, cursor });
      Object.assign(app.settings, { mode: R().mode, stocks: R().stocks, time: R().time, hazards: R().hazards, cpuLevel: R().cpuLevel });
      app.saveSettings();
      const t = grid.children[cursor];
      if (t) { t.classList.remove('pick'); void t.offsetWidth; t.classList.add('pick'); }
      S.request({ k: 'launch', stage: id }); // the host starts it (lobbyCmd)
    };
    this.set((dt) => {
      this.attractUpdate(dt);
      if (!S.choosing() || inputLock) return;
      const ev = anyMenu();
      if (row === 0) {
        let c = cursor;
        if (ev.left) c = (c + all.length - 1) % all.length;
        if (ev.right) c = (c + 1) % all.length;
        if (ev.up) c = (c + all.length - 5) % all.length;
        if (ev.down) { if (c + 5 >= all.length) row = 1; else c = (c + 5) % all.length; }
        if (c !== cursor) { cursor = c; S.request({ k: 'stage', stage: all[c] === 'random' ? S.lobby.stage : all[c], cursor: c }); app.audio.sfx('menuMove'); }
        if (ev.confirm || ev.start) { app.audio.sfx('menuOk'); go(); return; }
      } else {
        const r = ruleItems[row - 1];
        if (ev.up) row--;
        if (ev.down) row = Math.min(ruleItems.length, row + 1);
        if (ev.left || ev.right || ev.confirm) { S.request({ k: 'rules', rules: r.ch(ev.left ? -1 : 1) }); app.audio.sfx('menuMove'); }
        if (ev.start) { go(); return; }
      }
      if (ev.back) { if (row > 0) { row = 0; } else { app.audio.sfx('menuBack'); S.request({ k: 'toChars' }); return; } }
      render();
    }, () => off());
    this.layer.appendChild(el);
  }

  // ---- matches ------------------------------------------------------------------------------------------------------
  stopMatch() { if (this.match) { this.match.dispose(); this.match = null; } }

  matchConfig(stage) {
    const S = this.session;
    const L = S.lobby;
    const names = {};
    L.slots.forEach((s, i) => { if (s) names[i] = s.cpu ? 'CPU' : s.name; });
    return { stage, rules: { ...L.rules }, seed: (Math.random() * 1e9) | 0, names, roster: S.roster().map((r) => ({ slot: r.slot, char: r.char, bot: r.bot, name: r.name })) };
  }

  startMatch(stage) {
    this.stopAttract();
    const S = this.session, app = this.app;
    S.request({ k: 'phase', phase: 'match' });
    const cfg = this.matchConfig(stage);
    this.lastCfg = cfg;
    const roster = S.roster().map((r) => ({ ...r }));
    // online: rollback (every machine runs the match), unless ?netmode=snap (the old way: the host sends pictures)
    if (S.mode === 'host' && app.params.get('netmode') !== 'snap') {
      cfg.rb = 1;
      cfg.delay = Math.max(1, Math.min(6, +(app.params.get('idelay') || 2)));
      S.net.broadcast({ t: 'start', cfg });
      this.runRollback(cfg);
      return;
    }
    let snapT = 0;
    const onTick = S.mode === 'host' ? (W) => {
      const now = performance.now();
      if (W.events.length) S.net.broadcast({ t: 'ev', h: now, l: W.events.slice() });
      if (++snapT % 2 === 0) S.sendSnap({ t: 'snap', h: now, s: W.snapshot() });
    } : null;
    if (S.mode === 'host') S.net.broadcast({ t: 'start', cfg });
    const m = new LocalMatch(app, { stage, roster, rules: cfg.rules, seed: cfg.seed, names: cfg.names, onTick, remoteInputs: S.remoteInputs });
    this.match = m;
    window.__match = m;
    this.layer.innerHTML = '';
    this.pauseUI(m);
    m.onOver = (W) => setTimeout(() => this.finishMatch(W), 400);
    this.set((dt) => { m.update(dt); this.pauseUpdate(m); }, () => {});
  }

  clientStart(cfg) {
    this.stopAttract();
    this.stopMatch();
    if (this.csShow) { this.csShow.dispose(); this.csShow = null; }
    if (cfg.rb) { this.runRollback(cfg); return; }
    const m = new ClientMatch(this.app, this.session, cfg);
    this.match = m;
    window.__match = m;
    this.layer.innerHTML = '';
    this.set((dt) => { m.update(dt); this.netMenuUpdate(m); }, () => { this.pauseEl = null; });
  }

  // an online match with rollback, host or guest (the host decides when it is over)
  runRollback(cfg) {
    const m = new RollbackMatch(this.app, this.session, cfg);
    this.lastCfg = cfg;
    this.match = m;
    window.__match = m;
    this.layer.innerHTML = '';
    if (this.session.mode === 'host') m.onOver = (W) => setTimeout(() => this.finishMatch(W), 400);
    else m.onDropped = () => { this.stopMatch(); this.session.close(); this.error('La connexion avec l\'hôte a coupé trop longtemps : l\'ordinateur a pris ton perso.'); };
    this.set((dt) => { m.update(dt); this.netMenuUpdate(m); }, () => { this.pauseEl = null; });
  }

  finishMatch(W) {
    const r = W.list.map((F) => ({ slot: F.slot, char: F.char, place: F.place, kos: F.stats.kos, falls: F.stats.falls, sd: F.stats.sd, dealt: Math.round(F.stats.dealt), taken: Math.round(F.stats.taken), bot: F.bot, name: (this.lastCfg && this.lastCfg.names[F.slot]) || '' }))
      .sort((a, b) => a.place - b.place);
    const blood = Math.round(r.reduce((s, x) => s + x.taken, 0) * 0.05 * 10) / 10;
    const res = { r, blood, stage: W.stageId };
    if (this.session && this.session.mode === 'host') this.session.net.broadcast({ t: 'results', r: res });
    if (this.session && this.session.mode !== 'client') this.session.request({ k: 'phase', phase: 'results' });
    this.stopMatch();
    this.results(res);
  }

  // pause (Start during a local/host match)
  pauseUI(m) {
    this.pauseEl = null;
    this.pauseMenu = null;
  }
  pauseUpdate(m) {
    const ev = anyMenu();
    if (!this.pauseEl) {
      if (ev.start && this.session.mode === 'local') {
        m.paused = true;
        this.app.audio.sfx('menuOk');
        this.pauseEl = h('div', 'px ppause');
        this.pauseEl.innerHTML = '<div class="pdim"></div><div class="ptitle txt">PAUSE</div>';
        const leave = (fn) => { this.pauseEl.remove(); this.pauseEl = null; this.go(() => { m.paused = false; this.stopMatch(); fn(); }); }; // stays paused under the falling door
        this.pauseMenu = new PixelList(this.pauseEl, [
          { label: 'Reprendre', act: () => this.unpause(m) },
          { label: 'Recommencer', act: () => leave(() => this.startMatch(this.lastCfg.stage)) },
          { label: 'Changer de monstre', act: () => leave(() => this.charSelect()) },
          { label: 'Quitter', act: () => leave(() => this.mainMenu()) },
        ], { left: 210, top: 120, width: 220 });
        this.layer.appendChild(this.pauseEl);
      }
      return;
    }
    this.pauseMenu.update(ev);
    if (ev.start || ev.back) this.unpause(m);
  }
  unpause(m) { m.paused = false; if (this.pauseEl) this.pauseEl.remove(); this.pauseEl = null; }

  // online: Start opens a menu over the match (it goes on for the others; this machine's fighters stand still)
  netMenuUpdate(m) {
    const S = this.session, ev = anyMenu();
    const close = () => { if (m.block) m.block(false); if (this.pauseEl) this.pauseEl.remove(); this.pauseEl = null; };
    if (!this.pauseEl) {
      if (!ev.start) return;
      this.app.audio.sfx('menuOk');
      if (m.block) m.block(true);
      this.pauseEl = h('div', 'px ppause');
      this.pauseEl.innerHTML = '<div class="pdim"></div><div class="ptitle txt">MENU</div>';
      const leaveRoom = () => { close(); this.go(() => { this.stopMatch(); S.close(); this.mainMenu(); }); };
      const items = [{ label: 'Reprendre', act: close }];
      // the host can stop the match for everybody: back to the character select
      if (S.mode === 'host') items.push({ label: 'Arrêter le match', act: () => { close(); this.go(() => { this.stopMatch(); this.goto('charsel'); this.charSelect(); }); } });
      items.push({ label: 'Quitter le salon', act: leaveRoom });
      this.pauseMenu = new PixelList(this.pauseEl, items, { left: 210, top: 120, width: 220 });
      this.layer.appendChild(this.pauseEl);
      return;
    }
    this.pauseMenu.update(ev);
    if (ev.start || ev.back) close();
  }

  // ---- results ---------------------------------------------------------------------------------------------------
  results(res) {
    const S = this.session, app = this.app;
    // the winner dances on the crypt slab (its victory emote, in 3D on the pixel grid), the scores beside it
    this.stopAttract();
    const w0 = res.r[0];
    const show = new Showcase(app, 'cemetery');
    this.resShow = show;
    show.set(0, w0.char);
    show.emote(0, (EMOTES[w0.char] && EMOTES[w0.char].win.emote) || 'victory_celebration', true);
    show.focus = { x: -4.2, z: 0.6, side: 2.4 }; // the camera frames the winner, on the left of the screen
    this.music('victory');
    const el = h('div', 'px');
    const W = 'VICTOIRE';
    el.innerHTML = `<div class="rs-title">${[...W].map((c, i) => `<b style="--i:${i}">${c}</b>`).join('')}</div>
      <div class="rs-win"><span style="color:${COLORS[w0.slot]}">${CHARS[w0.char].name}</span><small>${w0.name || 'J' + (w0.slot + 1)}</small></div>`;
    const PLACE = ['#ffd23b', '#d8d8e8', '#d8904a', '#a99cba'];
    const rows = h('div', 'rs-rows');
    rows.innerHTML = res.r.map((x, i) => `<div class="rs-row stone" style="--i:${i};--pc:${COLORS[x.slot]}"><b class="pl" style="color:${PLACE[Math.min(3, x.place - 1)]}">${x.place}</b>
      <div class="rp"><img src="assets/ui/portraits/${x.char}.png" alt=""></div>
      <span class="rn">${CHARS[x.char].name}<small>${x.name || 'J' + (x.slot + 1)}</small></span>
      <span class="rst">ÉJECTIONS <b data-n="${x.kos}">0</b></span><span class="rst">CHUTES <b data-n="${x.falls}">0</b></span><span class="rst">DÉGÂTS <b data-n="${x.dealt}" data-s="%">0</b></span></div>`).join('');
    el.appendChild(rows);
    el.appendChild(h('div', 'rs-blood txt', `Hémoglobine répandue : <b data-n="${res.blood}" data-s=" litres" data-d="1">0</b>`));
    // what comes next: the host decides, and the guest who chose the arena too
    const next = [
      { label: 'Revanche !', act: () => S.request({ k: 'launch', stage: S.mode === 'client' ? S.lobby.stage : this.lastCfg.stage }) },
      { label: 'Changer de monstre', act: () => S.request({ k: 'toChars' }) },
      { label: 'Changer d\'arène', act: () => S.request({ k: 'toStage' }) },
    ];
    const quit = { label: S.mode === 'client' ? 'Quitter le salon' : 'Menu principal', act: () => this.go(() => this.mainMenu()) };
    const items = S.mode !== 'client' || S.lobby.chooser === S.me ? [...next, quit] : [{ label: 'Attendre la suite…', act: () => {} }, quit];
    const menu = new PixelList(el, items, { left: 404, top: 268, width: 228 });
    app.audio.say('Victoire ! ' + CHARS[w0.char].name, 0.45, 0.95);
    // the numbers count up, row after row
    const nums = [...el.querySelectorAll('[data-n]')];
    let t = 0;
    this.set((dt) => {
      if (this.resShow) this.resShow.update(dt);
      t += dt;
      nums.forEach((b, i) => {
        const k = Math.max(0, Math.min(1, (t - 0.6 - i * 0.05) / 0.7)), n = +b.dataset.n;
        const v = b.dataset.d ? (n * k).toFixed(1) : Math.round(n * k);
        const txt = v + (b.dataset.s || '');
        if (b.textContent !== txt) { b.textContent = txt; if (k < 1 && Math.random() < 0.3) app.audio.sfx('click', 0, 0.15); }
      });
      const ev = anyMenu();
      menu.update(ev);
    });
    this.layer.appendChild(el);
  }

  // ---- options & help ---------------------------------------------------------------------------------------------
  options() {
    const app = this.app, s = app.settings;
    this.startAttract(0.6, 'options');
    const el = h('div', 'px');
    el.innerHTML = '<div class="ptitle txt">OPTIONS</div>';
    const vol = (k, label) => ({ label, bar: () => s.volume[k], val: () => Math.round(s.volume[k] * 10), left: () => { s.volume[k] = Math.max(0, +(s.volume[k] - 0.1).toFixed(1)); app.saveSettings(); }, right: () => { s.volume[k] = Math.min(1, +(s.volume[k] + 0.1).toFixed(1)); app.saveSettings(); app.audio.sfx('hitM'); } });
    const bloodNames = ['Aucune', 'Ketchup', 'Beaucoup', 'À FOISON'];
    // the pixel filter (big sharp pixels and dithering on the 3D, menus and fights alike): applied at once
    const pix = [[0, 'Non'], [360, 'Gros pixels (360p)'], [540, 'Moyen (540p)'], [720, 'Fin (720p)']];
    const pixIdx = () => Math.max(0, pix.findIndex((p) => p[0] === (s.pixel || 0)));
    const setPix = (i) => { s.pixel = pix[(i + pix.length) % pix.length][0]; app.saveSettings(); };
    const toggle = (get, set) => ({ val: () => (get() ? 'Oui' : 'Non'), left: () => { set(!get()); app.saveSettings(); }, right: () => { set(!get()); app.saveSettings(); } });
    const back = () => { this.app.audio.sfx('menuBack'); this.go(() => this.mainMenu()); };
    const menu = new PixelList(el, [
      vol('master', 'Volume général'), vol('music', 'Musique'), vol('sfx', 'Effets'), vol('voice', 'Annonceur'),
      { label: 'Hémoglobine', val: () => bloodNames[s.blood], left: () => { s.blood = Math.max(0, s.blood - 1); app.saveSettings(); }, right: () => { s.blood = Math.min(3, s.blood + 1); app.saveSettings(); } },
      { label: 'Commentateur', val: () => (s.commentator === false ? 'Muet' : 'Zinzin'), left: () => { s.commentator = s.commentator === false; app.saveSettings(); }, right: () => { s.commentator = s.commentator === false; app.saveSettings(); } },
      { label: 'Filtre pixel', val: () => pix[pixIdx()][1], left: () => setPix(pixIdx() - 1), right: () => setPix(pixIdx() + 1) },
      { label: 'Saut avec le stick', ...toggle(() => s.tapJump !== false, (v) => { s.tapJump = v; }) },
      { label: 'Vibrations', ...toggle(() => !!s.rumble, (v) => { s.rumble = v; }) },
      { label: 'Pseudo en ligne', val: () => s.name || '(manette)', act: () => { const n = prompt('Ton pseudo', s.name || ''); if (n !== null) { s.name = n.slice(0, 14); app.saveSettings(); } } },
      { label: 'Retour', act: back },
    ], { left: 150, top: 50, width: 340 });
    this.set((dt) => { this.attractUpdate(dt); const ev = anyMenu(); menu.update(ev); if (ev.back) back(); });
    this.layer.appendChild(el);
  }

  howto() {
    const el = h('div', 'panel-screen howto');
    el.innerHTML = `<h1 class="screen-title">Comment jouer</h1>
      <div class="cols">
        <div class="col"><h2>Le but</h2><p>Éjecte tes adversaires de la plateforme ! Plus ton <b>%</b> monte, plus tu voles loin. Sors du cadre (en bas, sur les côtés ou très haut) et tu perds une vie.</p>
          <h2>Manette</h2>
          <table>
            <tr><td>Stick</td><td>Marcher · <b>deux fois vite d'un côté = COURIR</b> (on peut changer de sens en courant) · bas = s'accroupir · <b>deux fois bas</b> sur une plateforme fine (ou bas maintenu en l'air) = passer à travers · haut d'un coup sec = sauter</td></tr>
            <tr><td><b class="btnA">A</b> en courant</td><td>Le <b>coup de course</b> de chaque monstre (glissade, plaquage, coup de pied sauté...)</td></tr>
            <tr><td><b class="btnA">A</b></td><td><b>A A A</b> = gauche, droite, coup final · <b>côté + A A A</b> = pied, fesse, tête · tapé = coups rapides qui s'enchaînent · <b>maintenu</b> = <b>SMASH</b> chargé</td></tr>
            <tr><td><b class="btnA">A</b> en l'air</td><td>Neutre · + avant = aérien avant · + arrière = aérien arrière · + haut = aérien haut · + bas = <b>météore</b></td></tr>
            <tr><td><b class="btnX">X</b></td><td>Spécial neutre · <b>X + côté</b> = spécial côté · chacun se recharge : les <b>trois arcs au sol sous ton monstre</b> (or = neutre, bleu = côté, rose = bas) se remplissent et s'allument quand c'est prêt. Plus un spécial est fort, plus il est long à revenir.</td></tr>
            <tr><td><b class="btnX">X</b> + haut</td><td>La remontée de chaque perso, pour revenir de loin (X + saut marche aussi) · elle attrape le bord même en montant</td></tr>
            <tr><td><b class="btnX">X</b> + bas</td><td>Spécial bas</td></tr>
            <tr><td><b class="btnB">B</b> / <b class="btnY">Y</b></td><td>Sauter (double saut en l'air) · stick bas en retombant = chute rapide</td></tr>
            <tr><td>Gâchettes</td><td>Bouclier · bouclier + côté = <b>roulade invincible</b> (une vraie roulade, assez longue pour passer derrière) · bouclier + bas = esquive sur place · en l'air = esquive dans la direction du stick · juste avant un coup = <b>PARADE</b></td></tr>
            <tr><td>Bouclier + <b class="btnA">A</b> ou <b>LB/RB</b></td><td>Saisir, puis stick = lancer (avant, arrière, haut, bas), A = frapper</td></tr>
            <tr><td>Start</td><td>Pause</td></tr>
          </table>
          <h2>Clavier + souris</h2><p><b>ZQSD</b> bouger (on court tout de suite) · <b>Ctrl</b> marcher · <b>clic gauche</b> coup · <b>clic droit</b> spécial · <b>Espace</b> saut · <b>Shift</b> bouclier / esquive · <b>E</b> saisir (aussi J, K, L, U)<br>2ᵉ joueur : <b>flèches</b> + pavé num. <b>1</b> coup <b>2</b> spécial <b>0</b> saut <b>3</b> bouclier</p></div>
        <div class="col"><h2>Les monstres</h2>${CHAR_ORDER.map((id) => { const d = CHARS[id]; const sp = d.specialsInfo; return `<div class="hc"><b style="color:${d.color}">${d.name}</b> — <i>${d.title}</i><br><small>X : ${sp.n} · X+côté : ${sp.s} · X+haut : ${sp.u} · X+bas : ${sp.d}</small></div>`; }).join('')}
          <p class="tip">Tung Tung Tung Sahur frappe 25 % plus fort sur le temps de la musique d'origine. Le Parmesan rapetisse en se râpant (plus rapide, mais plus léger). Le 49.3 de Micron traverse les boucliers.</p></div>
      </div><div class="hint"><b class="btnB">B</b> retour</div>`;
    this.set((dt) => { this.attractUpdate(dt); const ev = anyMenu(); if (ev.back || ev.confirm) this.mainMenu(); });
    this.layer.appendChild(el);
  }
}
