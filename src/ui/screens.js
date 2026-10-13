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
import { Showcase } from './showcase.js';
import { portraitURL } from './hud.js';
import { buildStageView, syncStageView } from '../render/stages/index.js';
import { World } from '../sim/world.js';

const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const GRID_COLS = 4;
const CS_TILES = [...CHAR_ORDER, 'random'];

function anyMenu() {
  const ev = { up: 0, down: 0, left: 0, right: 0, confirm: 0, back: 0, start: 0, x: 0, y: 0, dev: null };
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

export class Screens {
  constructor(app) {
    this.app = app;
    this.layer = h('div', 'screens');
    app.ui.appendChild(this.layer);
    this.attract = null;
    this.session = null;
    this.thumbs = {};
  }

  set(update, dispose) {
    this.layer.innerHTML = '';
    this.app.setScreen({ update, dispose });
  }

  // ---- attract mode: four CPUs fighting behind the menus ---------------------------------------------------------
  startAttract() {
    if (this.attract) return;
    const chars = [...CHAR_ORDER].sort(() => Math.random() - 0.5).slice(0, 4);
    const stage = STAGE_ORDER[Math.floor(Math.random() * STAGE_ORDER.length)];
    const roster = chars.map((c, i) => ({ slot: i, char: c, bot: 3 }));
    this.attract = new LocalMatch(this.app, { stage, roster, rules: { stocks: 3, hazards: true }, seed: (Math.random() * 1e9) | 0, attract: true });
    this.attract.view.hud.show(false);
    this.app.audio.playMusic('menu');
  }
  stopAttract() { if (this.attract) { this.attract.dispose(); this.attract = null; } }
  attractUpdate(dt) {
    if (!this.attract) return;
    this.attract.update(dt);
    if (this.attract.W.phase === 'over') { this.stopAttract(); this.startAttract(); }
  }

  // ---- title ---------------------------------------------------------------------------------------------------
  title() {
    this.startAttract();
    const el = h('div', 'title-screen');
    el.innerHTML = `<div class="logo"><span class="l1">Spooky</span><span class="l2">Bagarre</span><span class="l3">(par VibePandrezz)</span></div>
      <div class="press">Appuie sur <b class="btnA">A</b> ou <b>Entrée</b></div>
      <div class="credits">${CHAR_ORDER.length} monstres · ${STAGE_ORDER.length} arènes · jusqu'à 4 · en ligne</div>`;
    this.set((dt) => {
      this.attractUpdate(dt);
      const ev = anyMenu();
      if (ev.confirm || ev.start) { this.app.audio.unlock(); this.app.audio.sfx('menuOk'); this.mainMenu(); }
    }, () => {});
    this.layer.appendChild(el);
    el.onclick = () => { this.app.audio.unlock(); this.mainMenu(); };
  }

  mainMenu() {
    this.startAttract();
    if (this.session) { this.session.close(); this.session = null; }
    const el = h('div', 'panel-screen');
    el.appendChild(h('div', 'logo small', '<span class="l1">Spooky</span><span class="l2">Bagarre</span><span class="l3">(par VibePandrezz)</span>'));
    const menu = new ListMenu(el, [
      { label: 'Combat local', hint: 'Sur ce PC, manettes et claviers', act: () => this.startLocal() },
      { label: 'Créer un salon en ligne', hint: 'Tes potes te rejoignent avec un code', act: () => this.startHost() },
      { label: 'Rejoindre un salon', hint: 'Entre le code de ton pote', act: () => this.joinScreen() },
      { label: 'Comment jouer', act: () => this.howto() },
      { label: 'Options', act: () => this.options() },
    ]);
    this.set((dt) => {
      this.attractUpdate(dt);
      const ev = anyMenu();
      menu.update(ev);
      if (ev.back) this.title();
    });
    this.layer.appendChild(el);
  }

  // ---- sessions -------------------------------------------------------------------------------------------------
  startLocal() {
    this.session = new Session(this.app, 'local');
    this.charSelect();
  }

  async startHost() {
    const transport = this.app.params.get('net') === 'local' ? 'local' : 'peer';
    this.session = new Session(this.app, 'host', transport);
    this.wait('Ouverture du salon…');
    try {
      await this.session.hostOnline();
      this.hookHost();
      this.charSelect();
    } catch (e) { this.error('Impossible de créer le salon : ' + (e.message || e.type || e)); }
  }

  joinScreen() {
    const el = h('div', 'panel-screen');
    el.appendChild(h('h1', 'screen-title', 'Rejoindre un salon'));
    const letters = 'ABCDEFGHJKMNPQRSTUVWXYZ';
    const code = (localStorage.getItem('spookybagarre.lastCode') || 'AAAA').split('');
    let pos = 0;
    const box = h('div', 'codebox');
    el.appendChild(box);
    const input = h('input', 'codeinput');
    input.maxLength = 4; input.placeholder = 'CODE';
    el.appendChild(h('div', 'hint', 'Stick ↑↓ pour changer la lettre, ←→ pour bouger · ou tape le code au clavier'));
    el.appendChild(input);
    const render = () => {
      box.innerHTML = code.map((c, i) => `<span class="${i === pos ? 'on' : ''}">${c}</span>`).join('');
    };
    render();
    input.oninput = () => { const v = input.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4); input.value = v; for (let i = 0; i < 4; i++) code[i] = v[i] || code[i]; render(); };
    const go = async () => {
      const c = code.join('');
      localStorage.setItem('spookybagarre.lastCode', c);
      const transport = this.app.params.get('net') === 'local' ? 'local' : 'peer';
      this.session = new Session(this.app, 'client', transport);
      this.wait('Connexion au salon ' + c + '…');
      try { await this.session.joinOnline(c); this.hookClient(); this.charSelect(); }
      catch (e) { this.error('Connexion impossible : ' + (e.message || e.type || e)); }
    };
    const btn = h('button', 'item focus', '<span class="lab">Rejoindre</span>');
    btn.onclick = go;
    el.appendChild(btn);
    this.set((dt) => {
      this.attractUpdate(dt);
      if (document.activeElement === input) return;
      const ev = anyMenu();
      if (ev.left) { pos = (pos + 3) % 4; render(); }
      if (ev.right) { pos = (pos + 1) % 4; render(); }
      if (ev.up || ev.down) { let k = letters.indexOf(code[pos]); k = (k + (ev.up ? 1 : -1) + letters.length) % letters.length; code[pos] = letters[k]; render(); this.app.audio.sfx('menuMove'); }
      if (ev.confirm) go();
      if (ev.back) this.mainMenu();
    });
    this.layer.appendChild(el);
  }

  wait(msg) {
    const el = h('div', 'panel-screen', `<div class="waiting">${msg}</div>`);
    this.set((dt) => this.attractUpdate(dt));
    this.layer.appendChild(el);
  }

  error(msg) {
    const el = h('div', 'panel-screen');
    el.appendChild(h('div', 'waiting err', msg));
    const menu = new ListMenu(el, [{ label: 'Retour', act: () => this.mainMenu() }]);
    this.set((dt) => { this.attractUpdate(dt); const ev = anyMenu(); menu.update(ev); if (ev.back) this.mainMenu(); });
    this.layer.appendChild(el);
  }

  // host: forward match messages; client: follow the host's phases
  hookHost() {
    const S = this.session;
    S.onPeerLeft = () => { if (this.match && this.match.W) { /* their fighter stays as a CPU */ for (const F of this.match.W.list) { const slot = S.lobby.slots[F.slot]; if (!slot) F.bot = 2; } } };
  }

  hookClient() {
    const S = this.session;
    S.onHostLost = () => { this.stopMatch(); this.error('L\'hôte a quitté le salon.'); };
    S.onClientMsg = (m) => {
      if (m.t === 'start') this.clientStart(m.cfg);
      else if (m.t === 'snap' || m.t === 'ev') { if (this.match && this.match.onMessage) this.match.onMessage(m); }
      else if (m.t === 'results') { this.stopMatch(); this.results(m.r); }
      else if (m.t === 'goto') {
        if (m.to === 'charsel') { this.stopMatch(); this.charSelect(); }
        if (m.to === 'stagesel') this.stageSelect();
      }
    };
  }

  goto(to) { if (this.session && this.session.mode === 'host') this.session.net.broadcast({ t: 'goto', to }); }

  // ---- character select ----------------------------------------------------------------------------------------
  charSelect() {
    this.stopAttract();
    const S = this.session, app = this.app;
    const show = new Showcase(app, 'cemetery');
    app.audio.playMusic('menu');
    const el = h('div', 'charsel');
    const top = h('div', 'cs-top');
    top.innerHTML = `<h1 class="screen-title">Choisis ton monstre</h1>` + (S.lobby.code ? `<div class="room">Salon <b>${S.lobby.code}</b><small>${S.mode === 'host' ? 'donne ce code à tes potes' : 'connecté'}</small></div>` : '');
    el.appendChild(top);
    const grid = h('div', 'cs-grid');
    CS_TILES.forEach((id, i) => {
      const t = h('div', 'tile');
      if (id === 'random') t.innerHTML = '<div class="tp q">?</div><div class="tn">Au hasard</div>';
      else {
        const d = CHARS[id];
        t.innerHTML = `<div class="tp" style="--cc:${d.color}"><img src="${portraitURL(id)}" onerror="this.remove()"><span>${d.name[0]}</span></div><div class="tn">${d.name}</div>`;
      }
      t.onclick = () => { const slot = S.mySlots()[0]; if (slot !== undefined) this.csPick(slot, i); };
      grid.appendChild(t);
    });
    el.appendChild(grid);
    const info = h('div', 'cs-info');
    el.appendChild(info);
    const cards = h('div', 'cs-slots');
    el.appendChild(cards);
    const help = h('div', 'cs-help', '<b class="btnA">A</b> rejoindre / choisir · <b class="btnB">B</b> annuler · <b class="btnY">Y</b> ajouter un CPU · <b class="btnX">X</b> retirer un CPU · <b>Start</b> c\'est parti');
    el.appendChild(help);
    this.layer.innerHTML = '';
    this.layer.appendChild(el);
    const tiles = [...grid.children];
    const lc = {}; // local cursors (instant on clients; the host gets them a few ms later)
    let lastV = -1;
    const render = () => {
      const L = S.lobby;
      tiles.forEach((t) => { t.querySelectorAll('.cursor').forEach((c) => c.remove()); });
      cards.innerHTML = '';
      L.slots.forEach((s, i) => {
        const c = h('div', 'slot' + (s ? ' used' : '') + (s && s.ready ? ' ready' : ''));
        c.style.setProperty('--pc', COLORS[i]);
        if (!s) c.innerHTML = `<div class="sj">J${i + 1}</div><div class="sn">Appuie sur A</div>`;
        else {
          const ch = s.char ? CHARS[s.char] : null;
          const who = s.cpu ? `CPU niv. ${s.cpu}` : (s.owner === S.me ? padLabel(s.dev) : s.name);
          c.innerHTML = `<div class="sj">J${i + 1}</div><div class="sc">${ch ? ch.name : '…'}</div><div class="sn">${who}</div>${s.ready ? '<div class="ok">PRÊT</div>' : ''}`;
          c.onclick = () => { if (s.cpu && S.mode !== 'client') { const k = (CHAR_ORDER.indexOf(s.char) + 1) % CHAR_ORDER.length; S.request({ k: 'cpuChar', slot: i, char: CHAR_ORDER[k] }); } };
          const sc = s.owner === S.me && s.dev && lc[s.dev] !== undefined ? lc[s.dev] : s.cursor;
          if (sc >= 0 && !s.cpu) {
            const cur = h('div', 'cursor', 'J' + (i + 1));
            cur.style.setProperty('--pc', COLORS[i]);
            cur.style.setProperty('--n', i);
            tiles[sc] && tiles[sc].appendChild(cur);
          }
        }
        cards.appendChild(c);
        show.set(i, s && s.char ? s.char : null);
      });
      // info panel: the character under the first local cursor
      const mine = S.mySlots();
      const cs = mine.length ? L.slots[mine[0]] : null;
      const id = cs ? CS_TILES[lc[cs.dev] ?? cs.cursor] : null;
      if (id && id !== 'random') {
        const d = CHARS[id];
        const sp = d.specialsInfo;
        info.innerHTML = `<div class="ci-name" style="color:${d.color}">${d.name}</div><div class="ci-title">${d.title}</div>
          <ul><li><b>X</b> ${sp.n}</li><li><b>X + stick</b> ${sp.s}</li><li><b>X + saut</b> ${sp.u}</li><li><b>X + gâchette</b> ${sp.d}</li></ul>`;
      } else info.innerHTML = '';
      const ready = S.allReady();
      help.classList.toggle('go', ready);
      if (ready) help.innerHTML = (S.mode === 'client' ? 'Tout le monde est prêt : l\'hôte choisit l\'arène…' : '<b>Start</b> ou <b class="btnA">A</b> : choisir l\'arène !');
      else help.innerHTML = '<b class="btnA">A</b> rejoindre / choisir · <b class="btnB">B</b> annuler · <b class="btnY">Y</b> ajouter un CPU · <b class="btnX">X</b> retirer un CPU · <b>Start</b> c\'est parti';
    };
    const off = S.onChange(() => render());
    render();
    if (S.mode !== 'client') S.request({ k: 'phase', phase: 'charsel' });
    this.set((dt) => {
      show.update(dt);
      const L = S.lobby;
      if (L.v !== lastV) { lastV = L.v; }
      for (const d of Input.list()) {
        const m = d.menu;
        const slot = S.slotOfDevice(d.id);
        if (slot < 0) {
          if (m.confirm || m.start) { S.request({ k: 'join', dev: d.id, name: app.settings.name || padLabel(d.id) }); app.audio.sfx('menuOk'); }
          if (m.back && S.mySlots().length === 0) { off(); show.dispose(); this.mainMenu(); return; }
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
          if ((m.start || m.confirm) && S.allReady() && S.mode !== 'client') { off(); show.dispose(); this.stageSelect(); return; }
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
    const rt = new THREE.WebGLRenderTarget(320, 180);
    R.gl.setRenderTarget(rt); R.gl.render(scene, cam); R.gl.setRenderTarget(null);
    const px = new Uint8Array(320 * 180 * 4);
    R.gl.readRenderTargetPixels(rt, 0, 0, 320, 180, px);
    const c = document.createElement('canvas'); c.width = 320; c.height = 180;
    const g = c.getContext('2d'), img = g.createImageData(320, 180);
    for (let y = 0; y < 180; y++) for (let x = 0; x < 320; x++) {
      const s = ((179 - y) * 320 + x) * 4, d = (y * 320 + x) * 4;
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
    this.startAttract();
    const el = h('div', 'stagesel');
    el.appendChild(h('h1', 'screen-title', 'Choisis l\'arène'));
    const grid = h('div', 'ss-grid');
    const all = [...STAGE_ORDER, 'random'];
    all.forEach((id, i) => {
      const t = h('div', 'stile');
      if (id === 'random') t.innerHTML = '<div class="sth q">?</div><div class="stn">Au hasard</div>';
      else t.innerHTML = `<div class="sth"><img src="${this.stageThumb(id)}"></div><div class="stn">${STAGES[id].name}</div>`;
      t.onclick = () => { if (S.mode !== 'client') { cursor = i; S.request({ k: 'stage', stage: id, cursor: i }); go(); } };
      grid.appendChild(t);
    });
    el.appendChild(grid);
    const blurb = h('div', 'ss-blurb');
    el.appendChild(blurb);
    const rulesEl = h('div', 'ss-rules');
    el.appendChild(rulesEl);
    this.layer.innerHTML = '';
    this.layer.appendChild(el);
    let cursor = Math.max(0, S.lobby.stageCursor || 0);
    let row = 0; // 0 = stages, 1.. = rules
    const R = () => S.lobby.rules;
    const ruleItems = [
      { label: 'Mode', val: () => (R().mode === 'stock' ? 'Vies' : 'Chrono'), ch: () => ({ mode: R().mode === 'stock' ? 'time' : 'stock' }) },
      { label: 'Vies', val: () => R().stocks, ch: (d) => ({ stocks: Math.max(1, Math.min(9, R().stocks + d)) }) },
      { label: 'Chrono', val: () => Math.round(R().time / 60) + ' min', ch: (d) => ({ time: Math.max(60, Math.min(600, R().time + d * 60)) }) },
      { label: 'Pièges', val: () => (R().hazards ? 'Oui' : 'Non'), ch: () => ({ hazards: !R().hazards }) },
      { label: 'Niveau CPU', val: () => ['', 'Facile', 'Normal', 'Brutal'][R().cpuLevel || 2], ch: (d) => ({ cpuLevel: Math.max(1, Math.min(3, (R().cpuLevel || 2) + d)) }) },
    ];
    const render = () => {
      [...grid.children].forEach((t, i) => t.classList.toggle('focus', i === (S.mode === 'client' ? S.lobby.stageCursor : cursor) && row === 0));
      const id = all[S.mode === 'client' ? S.lobby.stageCursor : cursor];
      blurb.innerHTML = id && id !== 'random' ? `<b>${STAGES[id].name}</b> — ${STAGES[id].blurb}` : 'Le destin choisira ton cimetière.';
      rulesEl.innerHTML = ruleItems.map((r, i) => `<div class="rule${row === i + 1 ? ' focus' : ''}"><span>${r.label}</span><b>◀ ${r.val()} ▶</b></div>`).join('') +
        `<div class="hint">${S.mode === 'client' ? 'L\'hôte choisit…' : '<b class="btnA">A</b> lancer le combat · <b class="btnB">B</b> retour · ↓ règles'}</div>`;
    };
    const off = S.onChange(render);
    render();
    const go = () => {
      let id = all[cursor];
      if (id === 'random') id = STAGE_ORDER[Math.floor(Math.random() * STAGE_ORDER.length)];
      S.request({ k: 'stage', stage: id, cursor });
      Object.assign(app.settings, { mode: R().mode, stocks: R().stocks, time: R().time, hazards: R().hazards, cpuLevel: R().cpuLevel });
      app.saveSettings();
      off();
      this.startMatch(id);
    };
    this.set((dt) => {
      this.attractUpdate(dt);
      if (S.mode === 'client') return;
      const ev = anyMenu();
      if (row === 0) {
        let c = cursor;
        if (ev.left) c = (c + all.length - 1) % all.length;
        if (ev.right) c = (c + 1) % all.length;
        if (ev.up) c = (c + all.length - GRID_COLS - 1 + 1) % all.length;
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
      if (ev.back) { off(); if (row > 0) { row = 0; } else { S.request({ k: 'phase', phase: 'charsel' }); this.goto('charsel'); this.charSelect(); return; } }
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
    const m = new ClientMatch(this.app, this.session, cfg);
    this.match = m;
    window.__match = m;
    this.layer.innerHTML = '';
    this.set((dt) => m.update(dt), () => {});
  }

  finishMatch(W) {
    const r = W.list.map((F) => ({ slot: F.slot, char: F.char, place: F.place, kos: F.stats.kos, falls: F.stats.falls, sd: F.stats.sd, dealt: Math.round(F.stats.dealt), taken: Math.round(F.stats.taken), bot: F.bot, name: (this.lastCfg && this.lastCfg.names[F.slot]) || '' }))
      .sort((a, b) => a.place - b.place);
    const blood = Math.round(r.reduce((s, x) => s + x.taken, 0) * 0.05 * 10) / 10;
    const res = { r, blood, stage: W.stageId };
    if (this.session && this.session.mode === 'host') this.session.net.broadcast({ t: 'results', r: res });
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
        this.pauseEl = h('div', 'panel-screen pause');
        this.pauseEl.appendChild(h('h1', 'screen-title', 'Pause'));
        this.pauseMenu = new ListMenu(this.pauseEl, [
          { label: 'Reprendre', act: () => this.unpause(m) },
          { label: 'Recommencer', act: () => { this.unpause(m); this.stopMatch(); this.startMatch(this.lastCfg.stage); } },
          { label: 'Changer de monstre', act: () => { this.unpause(m); this.stopMatch(); this.charSelect(); } },
          { label: 'Quitter', act: () => { this.unpause(m); this.stopMatch(); this.mainMenu(); } },
        ]);
        this.layer.appendChild(this.pauseEl);
      }
      return;
    }
    this.pauseMenu.update(ev);
    if (ev.start || ev.back) this.unpause(m);
  }
  unpause(m) { m.paused = false; if (this.pauseEl) this.pauseEl.remove(); this.pauseEl = null; }

  // ---- results ---------------------------------------------------------------------------------------------------
  results(res) {
    const S = this.session, app = this.app;
    this.startAttract();
    app.audio.playMusic('results');
    const el = h('div', 'results');
    const w = res.r[0];
    el.appendChild(h('div', 'winner', `<div class="wl">VICTOIRE</div><div class="wn" style="color:${COLORS[w.slot]}">${CHARS[w.char].name}</div><div class="wp">${w.name || 'J' + (w.slot + 1)}</div>`));
    const table = h('div', 'rtable');
    table.innerHTML = res.r.map((x) => `<div class="rrow" style="--pc:${COLORS[x.slot]}"><b class="place">${x.place}</b>
      <div class="rp" style="--cc:${CHARS[x.char].color}"><img src="${portraitURL(x.char)}" onerror="this.remove()"><span>${CHARS[x.char].name[0]}</span></div>
      <div class="rn">${CHARS[x.char].name}<small>${x.name || 'J' + (x.slot + 1)}</small></div>
      <div class="rs"><span>Éjections <b>${x.kos}</b></span><span>Chutes <b>${x.falls}</b></span><span>Dégâts infligés <b>${x.dealt}%</b></span></div></div>`).join('');
    el.appendChild(table);
    el.appendChild(h('div', 'blood-stat', `Hémoglobine répandue : <b>${res.blood} litres</b>`));
    const items = S.mode === 'client' ? [{ label: 'Attendre l\'hôte…', act: () => {} }, { label: 'Quitter le salon', act: () => { this.mainMenu(); } }]
      : [
        { label: 'Revanche !', act: () => this.startMatch(this.lastCfg.stage) },
        { label: 'Changer de monstre', act: () => { this.goto('charsel'); this.charSelect(); } },
        { label: 'Changer d\'arène', act: () => this.stageSelect() },
        { label: 'Menu principal', act: () => this.mainMenu() },
      ];
    const menu = new ListMenu(el, items, { cls: 'row' });
    this.layer.innerHTML = '';
    this.layer.appendChild(el);
    app.audio.say('Victoire ! ' + CHARS[w.char].name, 0.45, 0.95);
    this.set((dt) => { this.attractUpdate(dt); const ev = anyMenu(); ev.up = ev.left; ev.down = ev.right; menu.update(ev); });
    this.layer.appendChild(el);
  }

  // ---- options & help ---------------------------------------------------------------------------------------------
  options() {
    const app = this.app, s = app.settings;
    const el = h('div', 'panel-screen');
    el.appendChild(h('h1', 'screen-title', 'Options'));
    const vol = (k, label) => ({ label, val: () => Math.round(s.volume[k] * 10), left: () => { s.volume[k] = Math.max(0, +(s.volume[k] - 0.1).toFixed(1)); app.saveSettings(); }, right: () => { s.volume[k] = Math.min(1, +(s.volume[k] + 0.1).toFixed(1)); app.saveSettings(); app.audio.sfx('hitM'); } });
    const bloodNames = ['Aucune', 'Ketchup', 'Beaucoup', 'À FOISON'];
    // look: smooth (default) or the N64 retro filter at a few internal heights; changing it reloads the game
    const looks = [['smooth', 0, 'Lisse (HD)'], ['retro', 540, 'Rétro N64 540p'], ['retro', 360, 'Rétro N64 360p'], ['retro', 720, 'Rétro N64 720p']];
    const lookIdx = () => Math.max(0, looks.findIndex((l) => l[0] === (s.look || 'smooth') && (l[0] === 'smooth' || l[1] === s.retro)));
    const setLook = (i) => { const l = looks[(i + looks.length) % looks.length]; s.look = l[0]; if (l[0] === 'retro') s.retro = l[1]; app.saveSettings(); this.needReload = true; };
    const menu = new ListMenu(el, [
      vol('master', 'Volume général'), vol('music', 'Musique'), vol('sfx', 'Effets'), vol('voice', 'Annonceur'),
      { label: 'Hémoglobine', val: () => bloodNames[s.blood], left: () => { s.blood = Math.max(0, s.blood - 1); app.saveSettings(); }, right: () => { s.blood = Math.min(3, s.blood + 1); app.saveSettings(); } },
      { label: 'Commentateur', val: () => (s.commentator === false ? 'Muet' : 'Zinzin'), left: () => { s.commentator = s.commentator === false; app.saveSettings(); }, right: () => { s.commentator = s.commentator === false; app.saveSettings(); } },
      { label: 'Image', val: () => looks[lookIdx()][2] + (this.needReload ? ' (au retour)' : ''), left: () => setLook(lookIdx() - 1), right: () => setLook(lookIdx() + 1) },
      { label: 'Vibrations', val: () => (s.rumble ? 'Oui' : 'Non'), left: () => { s.rumble = !s.rumble; app.saveSettings(); }, right: () => { s.rumble = !s.rumble; app.saveSettings(); } },
      { label: 'Pseudo en ligne', val: () => s.name || '(manette)', act: () => { const n = prompt('Ton pseudo', s.name || ''); if (n !== null) { s.name = n.slice(0, 14); app.saveSettings(); } } },
      { label: 'Retour', act: () => { if (this.needReload) location.reload(); else this.mainMenu(); } },
    ]);
    this.set((dt) => { this.attractUpdate(dt); const ev = anyMenu(); menu.update(ev); if (ev.back) this.mainMenu(); });
    this.layer.appendChild(el);
  }

  howto() {
    const el = h('div', 'panel-screen howto');
    el.innerHTML = `<h1 class="screen-title">Comment jouer</h1>
      <div class="cols">
        <div class="col"><h2>Le but</h2><p>Éjecte tes adversaires de la plateforme ! Plus ton <b>%</b> monte, plus tu voles loin. Sors du cadre (en bas, sur les côtés ou très haut) et tu perds une vie.</p>
          <h2>Manette</h2>
          <table>
            <tr><td>Stick</td><td>Se déplacer (pousser fort = courir)</td></tr>
            <tr><td><b class="btnA">A</b></td><td>Coup · <b>A + stick</b> = <b>SMASH</b> (maintiens A pour charger)</td></tr>
            <tr><td><b class="btnA">A</b> + saut</td><td>Smash vers le haut (en l'air : coup aérien haut)</td></tr>
            <tr><td><b class="btnA">A</b> en l'air</td><td>Coup aérien · + stick = coup dans la direction · + gâchette = <b>météore</b></td></tr>
            <tr><td><b class="btnX">X</b></td><td>Spécial neutre · <b>X + stick</b> = spécial côté (360°)</td></tr>
            <tr><td><b class="btnX">X</b> + saut</td><td>Spécial haut (pour remonter !)</td></tr>
            <tr><td><b class="btnX">X</b> + gâchette</td><td>Spécial bas</td></tr>
            <tr><td><b class="btnB">B</b> / <b class="btnY">Y</b></td><td>Sauter (double saut en l'air)</td></tr>
            <tr><td>Gâchettes</td><td>Bouclier · + stick = roulade · en l'air = esquive · juste avant un coup = <b>PARADE</b></td></tr>
            <tr><td>Bouclier + <b class="btnA">A</b> ou <b>LB/RB</b></td><td>Saisir, puis stick = lancer, A = frapper</td></tr>
            <tr><td>Start</td><td>Pause</td></tr>
          </table>
          <h2>Clavier</h2><p><b>ZQSD</b> bouger · <b>J</b> coup · <b>K</b> spécial · <b>Espace</b> saut · <b>L</b> bouclier · <b>U</b> saisir (Maj = marcher)<br>2ᵉ joueur : <b>flèches</b> + pavé num. <b>1</b> coup <b>2</b> spécial <b>0</b> saut <b>3</b> bouclier</p></div>
        <div class="col"><h2>Les monstres</h2>${CHAR_ORDER.map((id) => { const d = CHARS[id]; const sp = d.specialsInfo; return `<div class="hc"><b style="color:${d.color}">${d.name}</b> — <i>${d.title}</i><br><small>X : ${sp.n} · X+stick : ${sp.s} · X+saut : ${sp.u} · X+gâchette : ${sp.d}</small></div>`; }).join('')}
          <p class="tip">Tung Tung Tung Sahur frappe 30 % plus fort sur le temps de la musique. Le Parmesan rapetisse en se râpant (plus rapide, mais plus léger). Le 49.3 de Micron traverse les boucliers.</p></div>
      </div><div class="hint"><b class="btnB">B</b> retour</div>`;
    this.set((dt) => { this.attractUpdate(dt); const ev = anyMenu(); if (ev.back || ev.confirm) this.mainMenu(); });
    this.layer.appendChild(el);
  }
}
