// The tournament's screens (art direction "BD d'horreur", css/tournament.css): the menu (on this PC / online), the
// setup (players' names, rules), the bracket (the draw played as a roulette, the winners flying up the tree, the losers
// humiliated), the VS screen before each duel, the champion's coronation. The bracket itself is src/game/tournament.js,
// it lives in the lobby (src/game/session.js: the host decides, the guests follow); the duels use the character
// select and the matches of src/ui/screens.js. Installed on Screens by installTournament (end of screens.js).
import * as Tour from '../game/tournament.js';
import { Session } from '../game/session.js';
import { CHARS } from '../sim/chars/index.js';
import { STAGES, STAGE_ORDER } from '../sim/stages/index.js';
import { Showcase } from './showcase.js';
import { EMOTES } from '../render/rig/nativeMoves.js';
import { burst, splash, lines, flash, fitText } from './juice.js';

const SAVE = 'spookybagarre.tour', NAMES = 'spookybagarre.tourNames';
const load = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
const store = (k, v) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private window */ } };
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pick = (a) => a[(Math.random() * a.length) | 0];
const portrait = (c) => `assets/ui/portraits/${c}.png`;

// --- the bracket's geometry on the 640x360 grid: a two-sided tree, the final in the middle ---------------------------
function layout(T) {
  const R = T.rounds.length, top = 54, bot = 282, H = bot - top;
  const boxes = {};
  const finalW = R >= 4 ? 112 : 140;
  const fx = 320 - finalW / 2, fcy = top + H / 2 - (T.third ? 18 : 0);
  if (R > 1) {
    const cols = R - 1, edge = fx - 12, colW = (edge - 10) / cols;
    const pw = Math.min(124, colW - (cols > 1 ? 16 : 6));
    const n0 = T.rounds[0].length / 2;
    const ph = Math.max(11, Math.min(17, (H / n0 - 8) / 2));
    for (let r = 0; r < R - 1; r++) {
      const per = T.rounds[r].length / 2;
      for (let j = 0; j < per; j++) {
        const cy = top + (j + 0.5) * (H / per);
        boxes[T.rounds[r][j].id] = { x: 10 + r * colW, cy, w: pw, ph, side: -1, colW };
        boxes[T.rounds[r][j + per].id] = { x: 630 - pw - r * colW, cy, w: pw, ph, side: 1, colW };
      }
    }
  }
  boxes[T.rounds[R - 1][0].id] = { x: fx, cy: fcy, w: finalW, ph: 19, side: 0, final: true };
  if (T.third) boxes.third = { x: 320 - 64, cy: fcy + 84, w: 128, ph: 14, side: 0, third: true };
  return boxes;
}
const plateY = (B, which) => (which === 'a' ? B.cy - B.ph - 1 : B.cy + 1);

// where the winner of M goes: the plate of the next duel, or the champion's frame
function nextSpot(T, M) {
  const R = T.rounds.length;
  if (M.third) return null;
  if (M.r === R - 1) return { champ: true };
  return { id: T.rounds[M.r + 1][M.i >> 1].id, which: M.i & 1 ? 'b' : 'a' };
}

export function installTournament(Screens, K) {
  const { h, anyMenu, PixelMenu, PixelList, UI, locked } = K;
  const P = Screens.prototype;

  P.tourSave = function () {
    const S = this.session;
    if (!S || S.mode !== 'local' || !S.lobby.tour) return;
    store(SAVE, S.lobby.tour.phase === 'done' && S.lobby.phase === 'tchamp' ? null : S.lobby.tour);
  };

  // ---- the menu: on this PC, online, carry on ------------------------------------------------------------------------
  P.tourMenu = function () {
    this.startAttract(0.55, 'lobby');
    if (this.session) { this.session.close(); this.session = null; }
    const el = h('div', 'px tour-px');
    el.innerHTML = '<div class="ptitle txt">TOURNOI</div><div class="tm-sub">Que des duels. Que des humains. Un seul survivant.</div>';
    const saved = load(SAVE);
    const items = [
      { label: 'SUR CE PC', hint: 'Les pseudos, les manettes passent de main en main', act: () => this.go(() => this.tourLocal()) },
      { label: 'EN LIGNE', hint: 'Crée un salon : tes potes rejoignent avec le code', act: () => this.go(() => this.tourHost()) },
    ];
    if (saved && saved.phase !== 'setup') items.unshift({ label: 'REPRENDRE', hint: `Le tournoi en cours (${saved.players.length} joueurs)`, act: () => this.go(() => this.tourLocal(saved)) });
    items.push({ label: 'RETOUR', hint: 'Au menu principal', act: () => this.go(() => this.mainMenu()) });
    const menu = new PixelMenu(el, items, { crypt: this.crypt, top: 110, gap: 44 });
    this.set((dt) => { this.attractUpdate(dt); const ev = anyMenu(); menu.update(ev); if (ev.back) { this.app.audio.sfx('menuBack'); this.go(() => this.mainMenu()); } });
    this.layer.appendChild(el);
  };

  P.tourLocal = function (resume) {
    this.session = new Session(this.app, 'local');
    this.session.onCmd = (k, a) => this.lobbyCmd(k, a);
    if (resume) {
      this.session.request({ k: 'tNew', tour: resume });
      this._tourSeen = resume.last ? resume.last.n : 0; this._drawSeen = resume.drawn || 0;
      this.tourBracket();
      return;
    }
    const last = load(NAMES);
    this.session.request({ k: 'tNew', rules: last && last.rules });
    const S = this.session;
    for (const n of (last && last.names) || []) S.request({ k: 'tAdd', name: n });
    this.tourSetup();
  };

  P.tourHost = async function () {
    const transport = this.app.params.get('net') === 'local' ? 'local' : 'peer';
    this.session = new Session(this.app, 'host', transport);
    this.session.onCmd = (k, a) => this.lobbyCmd(k, a);
    this.wait('Ouverture du salon du tournoi…');
    try {
      await this.session.hostOnline();
      this.hookHost();
      const last = load(NAMES);
      this.session.request({ k: 'tNew', rules: last && last.rules });
      this.session.request({ k: 'tAdd', name: this.app.settings.name || '' });
      this.tourSetup();
    } catch (e) { this.error('Impossible de créer le salon : ' + (e.message || e.type || e)); }
  };

  // ---- the setup: the players (names typed, or a funny one), the rules, the draw ------------------------------------
  P.tourSetup = function () {
    const S = this.session, app = this.app;
    this.startAttract(0.7, 'lobby');
    if (S.mode === 'host') this.goto('tsetup');
    const el = h('div', 'px tour-px ts-px');
    el.innerHTML = `<div class="tt-title"><span>TOURNOI</span> <b>DE LA BAGARRE</b></div>` +
      `<div class="ts-where">${S.mode === 'local' ? 'SUR CE PC · LES MANETTES SE PASSENT DE MAIN EN MAIN' : `SALON <b>${S.lobby.code || ''}</b> · ${S.mode === 'host' ? 'DONNE CE CODE À TES POTES' : 'TU ES CONNECTÉ'}`}</div>`;
    const grid = h('div', 'ts-grid'); el.appendChild(grid);
    const rulesEl = h('div', 'ts-rules'); el.appendChild(rulesEl);
    const help = h('div', 'ts-help'); el.appendChild(help);
    const fx = h('div', 'jx-layer'); el.appendChild(fx);
    this.layer.innerHTML = ''; this.layer.appendChild(el);
    const host = S.mode !== 'client';
    const T = () => S.lobby.tour;
    const stages = ['random', ...STAGE_ORDER];
    const RULES = [
      { label: 'VIES PAR DUEL', val: () => T().rules.stocks, ch: (d) => ({ stocks: ((T().rules.stocks - 1 + d + 9) % 9) + 1 }) },
      { label: 'ARÈNE', val: () => (T().rules.stage === 'random' ? 'AU HASARD' : STAGES[T().rules.stage].name), ch: (d) => ({ stage: stages[(stages.indexOf(T().rules.stage) + d + stages.length) % stages.length] }) },
      { label: 'PIÈGES', val: () => (T().rules.hazards ? 'OUI' : 'NON'), ch: () => ({ hazards: !T().rules.hazards }) },
      { label: 'MINI-JEUX', val: () => (T().rules.minigames ? 'OUI' : 'NON'), ch: () => ({ minigames: !T().rules.minigames }) },
      { label: 'PETITE FINALE', val: () => (T().rules.third ? 'OUI' : 'NON'), ch: () => ({ third: !T().rules.third }) },
    ];
    let col = 0, i = 0, editing = null;
    const players = () => T().players;
    const canEdit = (p) => p && (host || p.owner === S.me);
    const cells = () => players().length + (players().length < Tour.MAX_PLAYERS ? 1 : 0);
    const rows = () => RULES.length + 1; // + the launch
    let lastKey = '';
    const render = (force) => {
      if (!T()) return;
      const key = JSON.stringify([players(), T().rules, col, i, editing && editing.id]);
      if (key === lastKey && !force) return;
      lastKey = key;
      const ps = players();
      grid.innerHTML = ps.map((p, k) => `<div class="ts-cell${col === 0 && i === k ? ' on' : ''}${canEdit(p) ? '' : ' far'}" style="--pc:${p.color};--k:${k}" data-k="${k}">
          <b class="n">${k + 1}</b><span class="nm"><em>${esc(p.name)}</em></span>${S.mode !== 'local' ? `<small>${p.owner === S.me ? 'ICI' : 'EN LIGNE'}</small>` : ''}</div>`).join('') +
        (ps.length < Tour.MAX_PLAYERS ? `<div class="ts-cell add${col === 0 && i === ps.length ? ' on' : ''}" data-k="${ps.length}" style="--k:${ps.length}"><b class="n">+</b><span class="nm"><em>AJOUTER UN JOUEUR</em></span></div>` : '');
      [...grid.children].forEach((c) => { c.style.left = (c.dataset.k % 2) * 186 + 'px'; c.style.top = Math.floor(c.dataset.k / 2) * 27 + 'px'; const e = c.querySelector('.nm em'); if (e) fitText(e, 128); });
      rulesEl.innerHTML = RULES.map((r, k) => `<div class="ts-rule${col === 1 && i === k ? ' on' : ''}${host ? '' : ' ro'}" data-k="${k}"><small>${r.label}</small><b>${r.val()}</b></div>`).join('') +
        `<div class="ts-go${col === 1 && i === RULES.length ? ' on' : ''}${ps.length < 2 ? ' off' : ''}" data-k="${RULES.length}">${host ? (ps.length < 2 ? 'IL FAUT 2 JOUEURS' : 'LANCER LE TIRAGE !') : 'L’HÔTE LANCE LE TIRAGE…'}</div>`;
      help.innerHTML = col === 0 ? '<b class="ka">A</b> renommer / ajouter · <b class="ky">Y</b> pseudo au hasard · <b class="kx">X</b> retirer · <b>→</b> les règles · <b class="kb">B</b> retour'
        : '<b>←→</b> changer · <b class="ka">A</b> valider · <b>←</b> les joueurs · <b>START</b> le tirage · <b class="kb">B</b> retour';
    };
    const off = S.onChange(() => render());
    render(true);
    // the name being typed: a field over the cell (the keyboard), A or Entrée validates, Échap / B cancels
    const edit = (p) => {
      const k = p ? players().indexOf(p) : players().length;
      const inp = h('input', 'ts-input');
      inp.maxLength = 14; inp.value = p ? p.name : pick(Tour.FUN_NAMES.filter((n) => !players().some((x) => x.name === n))) || '';
      inp.style.left = (k % 2) * 186 + 30 + 'px'; inp.style.top = Math.floor(k / 2) * 27 + 56 + 'px';
      el.appendChild(inp);
      editing = { id: p ? p.id : null, inp };
      inp.focus(); inp.select();
      const done = (ok) => {
        if (!editing) return;
        const v = inp.value.trim();
        inp.remove(); editing = null;
        if (ok && v) {
          if (p) S.request({ k: 'tName', id: p.id, name: v });
          else { S.request({ k: 'tAdd', name: v }); burst(fx, 110 + (k % 2) * 186, 70 + Math.floor(k / 2) * 27, 'BIENVENUE !', { color: '#ffd84a', size: 70 }); app.audio.sfx('stamp', 0, 0.5); }
        }
        render(true);
      };
      inp.onkeydown = (e) => { if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); };
      inp.onblur = () => setTimeout(() => done(true), 50);
      editing.done = done;
    };
    grid.onclick = (e) => { const c = e.target.closest('.ts-cell'); if (!c || editing) return; col = 0; i = +c.dataset.k; act(); };
    rulesEl.onclick = (e) => { const c = e.target.closest('.ts-rule, .ts-go'); if (!c) return; col = 1; i = +c.dataset.k; act(); };
    const act = () => {
      if (col === 0) {
        const p = players()[i];
        if (!p && players().length < Tour.MAX_PLAYERS) { edit(null); return; }
        if (canEdit(p)) edit(p);
      } else if (i < RULES.length) { if (host) { S.request({ k: 'tRules', rules: RULES[i].ch(1) }); app.audio.sfx('menuMove'); } }
      else launch();
    };
    const launch = () => {
      if (!host || players().length < 2) { app.audio.sfx('menuBack'); return; }
      store(NAMES, { names: players().filter((p) => p.owner === S.me).map((p) => p.name), rules: T().rules });
      app.audio.sfx('menuOk');
      lines(fx, 320, 180, { n: 26, len: 220 }); flash(fx, '#fff3d6', 0.5);
      off();
      S.request({ k: 'tDraw' });
    };
    const leave = () => { off(); if (S.mode !== 'local') S.close(); this.session = null; this.go(() => this.mainMenu()); };
    this.set((dt) => {
      this.attractUpdate(dt);
      if (!T()) { leave(); return; }
      // (the keys typed in the field never reach the game's keyboard: here the confirm is a pad's A)
      if (editing) { const ev = anyMenu(); if (ev.confirm) editing.done(true); if (ev.back) editing.done(false); return; }
      if (locked()) return;
      const ev = anyMenu();
      const n = col === 0 ? cells() : rows();
      if (col === 0) {
        if (ev.up && i >= 2) i -= 2;
        if (ev.down && i + 2 < n) i += 2;
        if (ev.left && i % 2 === 1) i--;
        if (ev.right) { if (i % 2 === 0 && i + 1 < n) i++; else { col = 1; i = 0; } }
        if (ev.y) { const p = players()[i]; if (canEdit(p)) S.request({ k: 'tName', id: p.id, name: pick(Tour.FUN_NAMES) }); else if (!p) S.request({ k: 'tAdd', name: '' }); app.audio.sfx('menuMove'); }
        if (ev.x) { const p = players()[i]; if (canEdit(p)) { S.request({ k: 'tDel', id: p.id }); app.audio.sfx('menuBack'); i = Math.max(0, Math.min(i, cells() - 2)); } }
      } else {
        if (ev.up) i = (i + n - 1) % n;
        if (ev.down) i = (i + 1) % n;
        if (ev.left) { if (i < RULES.length && host) { S.request({ k: 'tRules', rules: RULES[i].ch(-1) }); app.audio.sfx('menuMove'); } else { col = 0; i = 0; } }
        if (ev.right && i < RULES.length && host) { S.request({ k: 'tRules', rules: RULES[i].ch(1) }); app.audio.sfx('menuMove'); }
      }
      if (ev.up || ev.down || ev.left || ev.right) app.audio.sfx('menuMove');
      if (ev.confirm) act();
      if (ev.start) launch();
      if (ev.back) { app.audio.sfx('menuBack'); leave(); return; }
      render();
    }, () => { off(); if (editing) editing.inp.remove(); });
    this.layer.appendChild(el); // (set() empties the layer)
  };

  // ---- the bracket ---------------------------------------------------------------------------------------------------
  P.tourBracket = function () {
    const S = this.session, app = this.app, T = S.lobby.tour;
    if (!T) { this.mainMenu(); return; }
    this.stopAttract();
    this.startAttract(0.78, 'lobby');
    if (S.mode === 'host') this.goto('tbracket');
    this.tourSave();
    const host = S.mode !== 'client';
    const el = h('div', 'px tour-px tb-px');
    const B = layout(T);
    const R = T.rounds.length;
    el.innerHTML = `<div class="tt-title"><span>TOURNOI</span> <b>DE LA BAGARRE</b></div><div class="tb-count">${T.players.length} JOUEURS · ${T.rules.stocks} ${T.rules.stocks > 1 ? 'VIES' : 'VIE'}</div>`;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'tb-lines'); svg.setAttribute('viewBox', '0 0 640 360'); svg.setAttribute('width', '640'); svg.setAttribute('height', '360');
    el.appendChild(svg);
    const tree = h('div', 'tb-tree'); el.appendChild(tree);
    const spot = h('i', 'tb-spot'); el.appendChild(spot);
    const champ = h('div', 'tb-champ'); el.appendChild(champ);
    const panel = h('div', 'tb-next'); el.appendChild(panel);
    const cap = h('div', 'tb-cap'); el.appendChild(cap);
    const fx = h('div', 'jx-layer'); el.appendChild(fx);
    this.layer.innerHTML = ''; this.layer.appendChild(el);
    const F = T.rounds[R - 1][0];
    // labels of the rounds over the columns
    const labels = [];
    for (let r = 0; r < R - 1; r++) { const M = T.rounds[r][0]; const b = B[M.id]; labels.push(`<div class="tb-round" style="left:${b.x}px;width:${b.w}px">${Tour.roundName(T, M)}</div>`); const M2 = T.rounds[r][T.rounds[r].length - 1]; const b2 = B[M2.id]; labels.push(`<div class="tb-round" style="left:${b2.x}px;width:${b2.w}px">${Tour.roundName(T, M2)}</div>`); }
    labels.push(`<div class="tb-round fin" style="left:${B[F.id].x}px;width:${B[F.id].w}px;top:${B[F.id].cy - 44}px">FINALE</div>`);
    if (T.third) labels.push(`<div class="tb-round third" style="left:${B.third.x}px;width:${B.third.w}px;top:${B.third.cy - 30}px">PETITE FINALE</div>`);

    // hide: plates not to show yet (the draw, a winner on his way); keep: a loser still standing (before his shame)
    const view = { hide: new Set(), standing: null, drawing: false };
    const plateHTML = (M, which) => {
      const b = M.third ? B.third : B[M.id];
      const pid = M[which];
      const y = plateY(b, which);
      const key = M.id + ':' + which;
      const p = pid && Tour.player(T, pid);
      let cls = 'tp', inner;
      if (!p || view.hide.has(key)) {
        cls += M.bye && M.r === 0 && !view.drawing ? ' bye' : ' empty';
        inner = M.bye && M.r === 0 && !view.drawing ? '<span class="nm"><em>EXEMPTÉ</em></span>' : '<span class="nm"><em>?</em></span>';
      } else {
        if (M.w === pid) cls += ' win';
        if (M.l === pid && view.standing !== key) cls += ' lose' + (M.forfeit ? ' ff' : '');
        inner = (p.char ? `<img src="${portrait(p.char)}" alt="">` : '<i class="q">?</i>') + `<span class="nm"><em>${esc(p.name)}</em></span>` +
          (M.l === pid && view.standing !== key ? `<b class="rip">${M.forfeit ? 'FORFAIT' : M.third ? '4E' : '✝'}</b>` : '') +
          (M.w === pid && M.third ? '<b class="med">3E</b>' : '');
      }
      return `<div class="${cls}" data-k="${key}" style="left:${b.x}px;top:${y}px;width:${b.w}px;height:${b.ph}px;--pc:${p ? p.color : '#3a2a50'};--fs:${Math.min(13, b.ph * 0.72)}px">${inner}</div>`;
    };
    const lineSVG = () => {
      let out = '';
      for (let r = 0; r < R - 1; r++) for (const M of T.rounds[r]) {
        const b = B[M.id], nx = nextSpot(T, M), nb = B[nx.id] || B[F.id];
        const sx = b.side < 0 ? b.x + b.w : b.x, ex = b.side < 0 ? nb.x : nb.x + nb.w;
        const ey = nb.final ? (b.side < 0 ? nb.cy - nb.ph / 2 - 1 : nb.cy + nb.ph / 2 + 1) : plateY(nb, nx.which) + nb.ph / 2;
        const mx = (sx + ex) / 2;
        const d = `M${sx},${b.cy} H${mx} V${ey} H${ex}`;
        const won = M.w && !view.hide.has(nx.id + ':' + nx.which);
        out += `<path class="ink" d="${d}"/><path class="bone${won ? ' won' : ''}" d="${d}" style="--pc:${won ? Tour.player(T, M.w).color : '#fff'}"/>`;
      }
      return out;
    };
    const champHTML = () => {
      const wp = F.w && !view.hide.has('champ') && Tour.player(T, F.w);
      champ.innerHTML = `<small>CHAMPION</small><b>${wp ? esc(wp.name) : '???'}</b>`;
      champ.style.cssText = `left:${B[F.id].x - 6}px;top:${B[F.id].cy - B[F.id].ph * 2 - 50}px;width:${B[F.id].w + 12}px;--pc:${wp ? wp.color : '#ffd84a'}`;
      champ.classList.toggle('on', !!wp);
    };
    const render = () => {
      tree.innerHTML = labels.join('') + Tour.allMatches(T).map((M) => plateHTML(M, 'a') + plateHTML(M, 'b')).join('');
      tree.querySelectorAll('.tp .nm em').forEach((e) => fitText(e, e.closest('.tp').offsetWidth - (e.closest('.tp').querySelector('img,.q') ? 26 : 12)));
      svg.innerHTML = lineSVG();
      champHTML();
    };
    const plateEl = (key) => tree.querySelector(`[data-k="${key}"]`);
    const plateBox = (key) => { const [id, which] = key.split(':'); const M = Tour.matchById(T, id); const b = M.third ? B.third : B[M.id]; return { x: b.x, y: plateY(b, which), w: b.w, h: b.ph }; };
    const focus = (M, on = true) => {
      if (!M || !on) { spot.classList.remove('on'); return; }
      const b = M.third ? B.third : B[M.id];
      spot.style.setProperty('--sx', (b.x + b.w / 2) + 'px'); spot.style.setProperty('--sy', b.cy + 'px');
      spot.classList.add('on');
    };
    // the next duel's panel at the bottom
    const nextPanel = () => {
      const M = Tour.nextMatch(T);
      if (T.phase === 'done') {
        const wp = Tour.player(T, F.w);
        panel.innerHTML = `<small>LE TOURNOI EST TERMINÉ</small><b>${esc(wp.name)} EST CHAMPION !</b><span>${host ? '<b class="ka">A</b> LE SACRE DU CHAMPION' : 'L’hôte lance le sacre…'}</span>`;
      } else if (M) {
        const a = Tour.player(T, M.a), b = Tour.player(T, M.b);
        const me = S.mode !== 'local' && (a.owner === S.me || b.owner === S.me);
        panel.innerHTML = `<small>PROCHAIN DUEL · ${Tour.roundName(T, M)}</small><b><i style="color:${a.color}">${esc(a.name)}</i> <u>VS</u> <i style="color:${b.color}">${esc(b.name)}</i></b>` +
          `<span>${host ? '<b class="ka">A</b> C’EST PARTI ! · <b class="kb">B</b> MENU' : me ? 'C’EST TON DUEL : PRÉPARE TA MANETTE !' : 'L’hôte lance le duel…'}</span>`;
        tree.querySelectorAll(`[data-k="${M.id}:a"],[data-k="${M.id}:b"]`).forEach((p) => p.classList.add('next'));
      } else panel.innerHTML = '';
      panel.classList.remove('in'); void panel.offsetWidth; panel.classList.add('in');
    };
    // a shame caption at the bottom, and the commentator reads it
    const shame = (txt, color) => {
      cap.innerHTML = `<span>${txt}</span>`; cap.style.setProperty('--pc', color || '#e8202e');
      cap.classList.remove('in'); void cap.offsetWidth; cap.classList.add('in');
      app.audio.comment(txt.replace(/<[^>]+>/g, ''), 2);
    };

    // --- the animations: a timeline that A skips ---
    let skip = false, busy = false;
    const waits = new Set();
    const wait = (ms) => new Promise((res) => { if (skip) { res(); return; } const o = { res }; o.t = setTimeout(() => { waits.delete(o); res(); }, ms); waits.add(o); });
    const skipAll = () => { skip = true; for (const o of waits) { clearTimeout(o.t); o.res(); } waits.clear(); };
    const flyTo = async (fromKey, toBox, color, ms = 520) => {
      const src = plateEl(fromKey);
      if (!src || skip) return;
      const fb = plateBox(fromKey);
      const c = src.cloneNode(true);
      c.classList.add('fly'); c.classList.remove('next', 'lose', 'win');
      fx.appendChild(c);
      const dx = toBox.x - fb.x, dy = toBox.y - fb.y;
      c.animate([{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${dx * 0.5}px,${dy * 0.5 - 26}px) scale(1.35) rotate(${dx > 0 ? 6 : -6}deg)`, offset: 0.5 },
        { transform: `translate(${dx}px,${dy}px) scale(1)` }], { duration: ms, easing: 'cubic-bezier(.3,.1,.3,1)' });
      for (let k = 1; k <= 4; k++) setTimeout(() => splash(fx, fb.x + fb.w / 2 + dx * k / 5, fb.y + fb.h / 2 + dy * k / 5 - 10 * Math.sin(Math.PI * k / 5), [color, '#fff3d6'], 3, { speed: 14, size: 2.5 }), ms * k / 5);
      await wait(ms);
      c.remove();
    };
    const humiliate = async (key, P) => {
      const pe = plateEl(key);
      const b = plateBox(key), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      const kind = pick(['tomb', 'crumble', 'flush', 'stamp', 'kick']);
      app.audio.sfx('thud', 0, 0.8);
      if (kind === 'tomb') {
        const t = h('div', 'th-tomb', '<b>R.I.P.</b><small>' + esc(P.name) + '</small>');
        t.style.left = cx - 22 + 'px'; t.style.top = b.y - 40 + 'px'; fx.appendChild(t);
        await wait(380); splash(fx, cx, b.y + b.h, ['#5a4a6a', '#8c7c9c', '#120a1a'], 14, { speed: 40 }); this.uiShake(); app.audio.sfx('stamp', 0, 0.6);
        await wait(900); t.classList.add('out'); setTimeout(() => t.remove(), 500);
      } else if (kind === 'crumble') {
        if (pe) pe.classList.add('shake');
        await wait(420);
        if (pe) pe.style.visibility = 'hidden';
        for (let k = 0; k < 4; k++) {
          const c = h('i', 'th-chunk'); c.style.cssText = `left:${b.x + k * b.w / 4}px;top:${b.y}px;width:${b.w / 4}px;height:${b.h}px;--pc:${P.color}`;
          fx.appendChild(c);
          const dx = (k - 1.5) * 14;
          c.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${dx}px,70px) rotate(${dx * 6}deg)`, opacity: 0 }], { duration: 900, easing: 'cubic-bezier(.5,0,.9,.6)' }).onfinish = () => c.remove();
        }
        app.audio.sfx('glass', 0, 0.6); burst(fx, cx, cy, 'CRAC !', { color: '#c8c0e8', size: 56 });
        await wait(800);
        if (pe) pe.style.visibility = '';
      } else if (kind === 'flush') {
        if (pe) pe.classList.add('flush');
        const w = h('i', 'th-swirl'); w.style.left = cx - 26 + 'px'; w.style.top = cy - 26 + 'px'; fx.appendChild(w);
        burst(fx, cx, cy - 18, 'GLOU GLOU !', { color: '#5ad1ff', size: 70, life: 1000 });
        app.audio.sfx('whoosh', 0, 1);
        await wait(1100); w.remove(); if (pe) pe.classList.remove('flush');
      } else if (kind === 'stamp') {
        const st = h('div', 'th-stamp', 'ÉLIMINÉ'); st.style.left = cx - 46 + 'px'; st.style.top = cy - 14 + 'px'; fx.appendChild(st);
        await wait(160); splash(fx, cx, cy, ['#e8202e', '#120a1a'], 16, { speed: 50 }); this.uiShake(); app.audio.sfx('stamp', 0, 0.8);
        for (let k = 0; k < 3; k++) setTimeout(() => splash(fx, cx + (k - 1) * 10, cy + 6, ['#5ad1ff', '#9fe8ff'], 4, { speed: 12, size: 2.5 }), 300 + k * 220);
        await wait(1000); st.classList.add('out'); setTimeout(() => st.remove(), 400);
      } else {
        const boot = h('div', 'th-boot', '🥾'); boot.style.top = cy - 22 + 'px'; boot.style.left = (b.x > 320 ? b.x + b.w + 40 : b.x - 70) + 'px'; fx.appendChild(boot);
        const dir = b.x > 320 ? -1 : 1;
        boot.animate([{ transform: 'translateX(0) rotate(0)' }, { transform: `translateX(${dir * 60}px) rotate(${dir * -25}deg)`, offset: 0.55 }, { transform: `translateX(${dir * 40}px) rotate(0)` }], { duration: 520, easing: 'cubic-bezier(.5,0,.5,1.6)' });
        await wait(300);
        burst(fx, cx, cy, 'SHPLAF !', { color: '#ff9a3c', size: 64 }); app.audio.sfx('hitL', 0, 0.7); this.uiShake();
        if (pe) pe.animate([{ transform: 'none' }, { transform: `translate(${dir * 120}px,-60px) rotate(${dir * 540}deg) scale(.4)`, opacity: 0, offset: 0.5 }, { transform: 'none', opacity: 1 }], { duration: 900, easing: 'ease-in-out' });
        await wait(900); boot.remove();
      }
    };

    // a name flying from the roulette (the middle of the screen) to its plate
    const flyName = async (txt, color, to, ms) => {
      if (skip) return;
      const c = h('div', 'tp fly', '<span class="nm"><em>' + esc(txt) + '</em></span>');
      const x0 = 320 - to.w / 2, y0 = 176;
      c.style.cssText = 'left:' + x0 + 'px;top:' + y0 + 'px;width:' + to.w + 'px;height:' + to.h + 'px;--pc:' + color + ';--fs:' + Math.min(13, to.h * 0.72) + 'px';
      fx.appendChild(c);
      c.animate([{ transform: 'scale(1.8)' }, { transform: 'translate(' + (to.x - x0) + 'px,' + (to.y - y0) + 'px) scale(1)' }], { duration: ms, easing: 'cubic-bezier(.5,0,.2,1)' });
      await wait(ms);
      c.remove();
    };
    // the draw: a roulette spins the names, each one slams into its plate
    const playDraw = async () => {
      view.drawing = true;
      const order = [];
      const sides = T.rounds[0].length > 1 ? [T.rounds[0].slice(0, T.rounds[0].length / 2), T.rounds[0].slice(T.rounds[0].length / 2)] : [T.rounds[0]];
      for (const side of sides) for (const M of side) for (const w of ['a', 'b']) if (M[w]) order.push(M.id + ':' + w);
      for (const M of T.rounds[0]) { view.hide.add(M.id + ':a'); view.hide.add(M.id + ':b'); }
      for (let r = 1; r < R; r++) for (const M of T.rounds[r]) { view.hide.add(M.id + ':a'); view.hide.add(M.id + ':b'); }
      render();
      const rou = h('div', 'tb-roulette', '<small>TIRAGE AU SORT</small><b></b>');
      el.appendChild(rou);
      const names = T.players.map((p) => p.name);
      let k = 0;
      for (const key of order) {
        const [id, w] = key.split(':'); const M = Tour.matchById(T, id); const p = Tour.player(T, M[w]);
        const spins = skip ? 0 : Math.max(3, 9 - k);
        for (let s = 0; s < spins; s++) { rou.querySelector('b').textContent = pick(names); app.audio.sfx('click', 0, 0.25); await wait(55); }
        rou.querySelector('b').textContent = p.name; rou.style.setProperty('--pc', p.color);
        rou.classList.remove('hit'); void rou.offsetWidth; rou.classList.add('hit');
        await wait(skip ? 0 : 140);
        await flyName(p.name, p.color, plateBox(key), 300);
        view.hide.delete(key); render();
        const pe = plateEl(key); if (pe && !skip) { pe.classList.add('slam'); const bx = plateBox(key); splash(fx, bx.x + bx.w / 2, bx.y + bx.h / 2, [p.color, '#120a1a', '#fff3d6'], 8, { speed: 30 }); app.audio.sfx('stamp', 0, 0.3); }
        k++;
        await wait(Math.max(90, 260 - k * 14));
      }
      rou.classList.add('out'); setTimeout(() => rou.remove(), 400);
      view.drawing = false;
      render();
      // the byes: straight to the next round
      for (const M of T.rounds[0]) if (M.bye && M.w) {
        const nx = nextSpot(T, M), from = M.id + ':' + (M.a ? 'a' : 'b');
        const p = Tour.player(T, M.w);
        if (!skip) burst(fx, plateBox(from).x + plateBox(from).w / 2, plateBox(from).y, 'EXEMPTÉ !', { color: '#c8ff3a', size: 60 });
        await flyTo(from, plateBox(nx.id + ':' + nx.which), p.color, 380);
        view.hide.delete(nx.id + ':' + nx.which); render();
      }
      for (let r = 1; r < R; r++) for (const M of T.rounds[r]) { view.hide.delete(M.id + ':a'); view.hide.delete(M.id + ':b'); }
      render();
    };

    // the last duel's result: the spotlight on it, the loser's shame, the winner flies to his next plate
    const playResult = async () => {
      const M = Tour.matchById(T, T.last.id);
      if (!M) return;
      const wk = M.id + ':' + (M.a === M.w ? 'a' : 'b'), lk = M.id + ':' + (M.a === M.l ? 'a' : 'b');
      const Wp = Tour.player(T, M.w), Lp = Tour.player(T, M.l);
      const nx = nextSpot(T, M);
      // the semi-final loser going to the small final
      const toThird = T.third && !M.third && M.r === R - 2 ? 'third:' + (M.i & 1 ? 'b' : 'a') : null;
      if (nx && !nx.champ) view.hide.add(nx.id + ':' + nx.which);
      if (nx && nx.champ) view.hide.add('champ');
      if (toThird) view.hide.add(toThird);
      view.standing = lk;
      render(); focus(M);
      await wait(500);
      // the loser
      if (Lp) {
        view.standing = null; await humiliate(lk, Lp); render();
        const txt = (toThird ? pick(['{L} est recalé en petite finale', '{L} ira se battre pour les miettes', 'Pas de finale pour {L} : direction la petite']) : pick(Tour.SHAME))
          .replace('{L}', `<em>${esc(Lp.name)}</em>`);
        shame(M.forfeit ? `<em>${esc(Lp.name)}</em> a fui le tournoi : FORFAIT !` : txt, Lp.color);
        if (toThird) { await flyTo(lk, plateBox(toThird), Lp.color, 600); view.hide.delete(toThird); render(); }
        await wait(700);
      }
      // the winner
      if (nx && !nx.champ) {
        await flyTo(wk, plateBox(nx.id + ':' + nx.which), Wp.color, 560);
        view.hide.delete(nx.id + ':' + nx.which); render();
        const bx = plateBox(nx.id + ':' + nx.which);
        if (!skip) { burst(fx, bx.x + bx.w / 2, bx.y, 'QUALIFIÉ !', { color: Wp.color, size: 66 }); splash(fx, bx.x + bx.w / 2, bx.y + bx.h / 2, [Wp.color, '#fff3d6', '#120a1a'], 14, { speed: 40 }); app.audio.sfx('stamp', 0, 0.6); }
      } else if (M.third) {
        if (!skip) { const bx = plateBox(wk); burst(fx, bx.x + bx.w / 2, bx.y, '3E PLACE !', { color: '#e8a050', size: 66 }); app.audio.sfx('stamp', 0, 0.6); }
      } else if (nx && nx.champ) {
        const fb = B[F.id];
        await flyTo(wk, { x: fb.x, y: fb.cy - fb.ph * 2 - 40, w: fb.w, h: 20 }, Wp.color, 700);
        view.hide.delete('champ'); render();
        if (!skip) {
          lines(fx, 320, fb.cy - fb.ph * 2 - 30, { n: 30, len: 260, life: 700 }); flash(fx, '#ffd84a', 0.6); this.uiShake();
          burst(fx, 320, fb.cy - fb.ph * 2 - 30, 'CHAMPION !', { color: '#ffd84a', size: 130, life: 1400 });
          app.audio.sfx('game', 0, 0.7); app.audio.comment(`${Wp.name} est le champion du tournoi !`, 2);
        }
      }
      focus(null);
      render();
    };

    const run = async () => {
      busy = true;
      render();
      if ((T.drawn || 0) !== this._drawSeen) { this._drawSeen = T.drawn || 0; this._tourSeen = T.last ? T.last.n : 0; await playDraw(); }
      if (T.last && T.last.n !== this._tourSeen) { this._tourSeen = T.last.n; skip = false; await playResult(); }
      skip = false; busy = false;
      render(); nextPanel();
      const M = Tour.nextMatch(T); if (M) focus(M);
      // the champion: straight to his coronation
      if (T.phase === 'done' && host) setTimeout(() => { if (this.session === S && S.lobby.phase === 'tbracket' && this._tbEl === el) S.request({ k: 'tChamp' }); }, 2600);
    };
    this._tbEl = el;
    run();
    // the menu over the bracket (B): carry on, or stop the tournament
    let menu = null, menuEl = null;
    const openMenu = () => {
      menuEl = h('div', 'px ppause'); menuEl.innerHTML = '<div class="pdim"></div><div class="ptitle txt">TOURNOI</div>';
      const close = () => { menuEl.remove(); menuEl = null; menu = null; };
      const items = [{ label: 'Reprendre', act: close }];
      if (S.mode === 'local') items.push({ label: 'Pause (reprendre plus tard)', act: () => { close(); this.tourSave(); this.session = null; this.go(() => this.mainMenu()); } });
      items.push({ label: S.mode === 'client' ? 'Quitter le salon' : 'Abandonner le tournoi', act: () => { close(); if (S.mode === 'local') store(SAVE, null); else if (S.mode === 'host') S.request({ k: 'tQuit' }); if (S.mode !== 'local') S.close(); this.session = null; this.go(() => this.mainMenu()); } });
      menu = new PixelList(menuEl, items, { left: 200, top: 130, width: 240 });
      el.appendChild(menuEl);
    };
    let lastV = S.lobby.v;
    this.set((dt) => {
      this.attractUpdate(dt);
      const ev = anyMenu();
      if (menu) { menu.update(ev); if (ev.back) { menuEl.remove(); menuEl = null; menu = null; } return; }
      if (busy) { if (ev.confirm || ev.start) skipAll(); return; }
      if (locked()) return;
      // a guest: the state changed under it (a forfeit, the host's quit)
      if (S.lobby.v !== lastV) { lastV = S.lobby.v; if (!S.lobby.tour) { this.error('L’hôte a arrêté le tournoi.'); return; } render(); nextPanel(); }
      if ((ev.confirm || ev.start) && host) {
        app.audio.sfx('menuOk');
        if (T.phase === 'done') S.request({ k: 'tChamp' });
        else if (Tour.nextMatch(T)) S.request({ k: 'tNext' });
        return;
      }
      if (ev.back) { app.audio.sfx('menuBack'); openMenu(); }
    });
    this.layer.appendChild(el);
  };

  // ---- VS: the duel's VS screen is the match's loading screen (src/ui/versus.js, with the round's name) ------------
  P.tourVS = function (stage) {
    const S = this.session;
    if (this.csShow) { this.csShow.dispose(); this.csShow = null; }
    // the host and a local tournament start the match at once; a guest waits for it (the host's 'start')
    if (S.mode !== 'client') { this.startMatch(stage); return; }
    this.stopAttract();
    this.startAttract(0.9, 'charsel');
    this.set(() => this.attractUpdate(1 / 60));
  };

  // ---- the coronation: the champion in 3D with the music video camera, the podium, confetti -----------------------------
  P.tourChamp = function () {
    const S = this.session, app = this.app, T = S.lobby.tour;
    if (!T) { this.mainMenu(); return; }
    this.stopAttract();
    if (S.mode === 'host') this.goto('tchamp');
    const st = Tour.standings(T);
    const C = st[0], char = C.char || 'frog';
    const show = new Showcase(app, 'cemetery');
    this.resShow = show;
    show.set(0, char);
    show.emote(0, (EMOTES[char] && EMOTES[char].win.emote) || 'victory_celebration', true);
    show.startVictoryCam(-4.2, 0.6);
    this.music('victory');
    if (S.mode === 'local') store(SAVE, null);
    const el = h('div', 'px tour-px tc-px');
    el.style.setProperty('--pc', C.color);
    const podium = st.slice(0, Math.min(4, st.length));
    el.innerHTML = `<i class="rs-cover"></i>
      <div class="tc-title">${[...'CHAMPION !'].map((c, i) => `<b style="--i:${i}">${c === ' ' ? '&nbsp;' : c}</b>`).join('')}</div>
      <div class="tc-name"><em>${esc(C.name)}</em></div>
      <div class="tc-sub">${C.char ? CHARS[C.char].name.toUpperCase() + ' · ' : ''}${C.stats.wins} DUELS GAGNÉS · ${C.stats.kos} ÉJECTIONS · ${Math.round(C.stats.dealt)} % DE DÉGÂTS</div>
      <div class="tc-podium">${podium.map((p, i) => `<div class="tc-step p${i + 1}" style="--pc:${p.color};--i:${i}">${p.char ? `<img src="${portrait(p.char)}" alt="">` : ''}<b>${i + 1}</b><span><em>${esc(p.name)}</em></span></div>`).join('')}</div>`;
    const fx = h('div', 'jx-layer'); el.appendChild(fx);
    const host = S.mode !== 'client';
    const items = host ? [
      { label: 'Nouveau tournoi (mêmes joueurs)', act: () => {
        const fresh = Tour.newTournament(T.rules);
        for (const p of T.players.filter((x) => !x.left)) Tour.addPlayer(fresh, p.name, p.owner);
        S.request({ k: 'tNew', tour: fresh });
        this.go(() => this.tourSetup());
      } },
      { label: 'Menu principal', act: () => { if (S.mode === 'host') S.request({ k: 'tQuit' }); if (S.mode !== 'local') S.close(); this.session = null; this.go(() => this.mainMenu()); } },
    ] : [{ label: 'Quitter le salon', act: () => { S.close(); this.session = null; this.go(() => this.mainMenu()); } }];
    const menu = new PixelList(el, items, { left: 404, top: 290, width: 226 });
    menu.el.classList.add('rs-menu');
    this.layer.innerHTML = ''; this.layer.appendChild(el);
    requestAnimationFrame(() => { fitText(el.querySelector('.tc-name em'), 270); el.querySelectorAll('.tc-step span em').forEach((e) => fitText(e, 58)); });
    show.onCut = () => { flash(fx, '#fff3d6', 0.22); this.uiShake(); };
    const COLS = ['#ffd84a', '#e8202e', '#fff3d6', '#9dff3a', C.color, '#5ad1ff'];
    // paper confetti raining over the cover
    const confetti = () => {
      for (let k = 0; k < 7; k++) {
        const c = h('i', 'tc-conf');
        const x = Math.random() * 640;
        c.style.cssText = `left:${x}px;top:-10px;background:${pick(COLS)};width:${3 + Math.random() * 4}px;height:${5 + Math.random() * 5}px`;
        fx.appendChild(c);
        const dx = (Math.random() - 0.5) * 80, r = (Math.random() - 0.5) * 1080;
        c.animate([{ transform: 'translate(0,0) rotate(0)' }, { transform: `translate(${dx}px,380px) rotate(${r}deg)` }], { duration: 2200 + Math.random() * 1600, easing: 'linear' }).onfinish = () => c.remove();
      }
    };
    const beats = [
      [0.05, () => { flash(fx, '#ffffff', 0.8); lines(fx, 150, 200, { n: 30, len: 240, life: 700 }); }],
      [0.95, () => { burst(fx, 480, 90, 'N°1 !', { color: '#ffd84a', size: 120, life: 1000 }); splash(fx, 480, 100, COLS, 26, { speed: 100, size: 4 }); app.audio.sfx('stamp', 0, 0.8); this.uiShake(); }],
      [1.5, () => app.audio.say(`${C.name}, champion du tournoi !`, 0.5, 0.95)],
    ];
    let t = 0, ct = 0;
    this.set((dt) => {
      if (this.resShow) this.resShow.update(dt);
      t += dt; ct -= dt;
      while (beats.length && t >= beats[0][0]) beats.shift()[1]();
      if (t > 0.8 && ct <= 0) { ct = 0.35; confetti(); }
      if (t > 1.6) menu.update(anyMenu());
    });
    this.layer.appendChild(el);
  };
}
