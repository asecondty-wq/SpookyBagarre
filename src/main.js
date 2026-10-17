// spookyBagarre — boot, main loop and screen manager.
import { Renderer } from './render/renderer.js';
import { Input } from './core/input.js';
import { Audio } from './audio/audio.js';
import { LocalMatch } from './game/localMatch.js';
import { preloadRigs } from './render/rig/rigModel.js';
import { clipsReady } from './render/rig/clips.js';
import { setStyle } from './render/style.js';
import { preloadEntityModels } from './render/entityView.js';
import { preloadProps } from './render/propModels.js';
import { CHAR_ORDER } from './sim/chars/index.js';
import { loadSettings, saveSettings } from './core/settings.js';
import { Screens } from './ui/screens.js';

// "Xbox 360 Controller (XInput STANDARD GAMEPAD)" -> "Manette Xbox"
function padName(id = '') {
  if (/xbox|xinput/i.test(id)) return 'Manette Xbox';
  if (/054c|playstation|dualsense|dualshock|wireless controller/i.test(id)) return 'Manette PlayStation';
  if (/057e|nintendo|pro controller/i.test(id)) return 'Manette Nintendo';
  return 'Manette';
}

class App {
  constructor() {
    this.settings = loadSettings();
    Input.tapJump = this.settings.tapJump !== false;
    setStyle(this.settings);
    this.renderer = new Renderer(document.getElementById('game'));
    this.renderer.setRetro(this.settings.retro);
    this.renderer.setPixels(this.settings.pixel);
    this.ui = document.getElementById('ui');
    this.params = new URLSearchParams(location.search); this.capFps = this.params.get('fps') !== '0';
    this.audio = new Audio();
    this.audio.vol = { ...this.audio.vol, ...this.settings.volume };
    // silent for tests: ?mute=1, and the quick-match test hook unless ?sound=1
    this.audio.muted = this.params.get('mute') === '1' || (!!this.params.get('quick') && this.params.get('sound') !== '1');
    this.screen = null;
    this.last = performance.now();
    const unlock = () => { this.audio.unlock(); };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('gamepadconnected', unlock);
    // controller status, top right: browsers only show a gamepad to the page after a button press while the page
    // has the focus, so we say it instead of leaving the player wondering
    this.padBadge = document.createElement('div');
    this.padBadge.className = 'padbadge';
    this.ui.appendChild(this.padBadge);
    this.padToastT = 0;
    const toast = (txt) => { this.padToast = txt; this.padToastT = 3.5; };
    // only what goes wrong is shown (a working pad needs no badge over the menus)
    window.addEventListener('gamepaddisconnected', (e) => toast(`🎮 ${padName(e.gamepad.id)} débranchée`));
  }

  updatePadBadge(dt) {
    const b = this.padBadge;
    if (!b) return;
    const pads = Input.list().filter((d) => d.type === 'gamepad');
    const menus = this.screens && !this.screens.match;
    let txt = '', show = false, warn = false;
    const mute = !this.audio.ctx || this.audio.ctx.state !== 'running';
    if (this.padToastT > 0) { this.padToastT -= dt; txt = this.padToast; show = true; }
    else if (mute && !this.audio.muted && (this.audio.vol.master > 0)) { show = true; warn = true; txt = '🔇 Clique dans le jeu (ou appuie sur une touche) pour avoir le son'; }
    else if (!pads.length && menus) {
      show = true; warn = true;
      txt = !navigator.getGamepads ? '🎮 Ce navigateur ne gère pas les manettes : prends Chrome ou Edge'
        : !document.hasFocus() ? '🎮 Clique dans le jeu, puis appuie sur A de ta manette'
          : '🎮 Manette pas encore vue : appuie sur A (ou rebranche-la)';
    }
    if (b.textContent !== txt) b.textContent = txt;
    b.classList.toggle('show', show);
    b.classList.toggle('warn', warn);
  }

  saveSettings() { saveSettings(this.settings); Input.tapJump = this.settings.tapJump !== false; this.audio.vol = { ...this.audio.vol, ...this.settings.volume }; this.audio.applyVolumes(); this.renderer.setRetro(this.settings.retro); this.renderer.setPixels(this.settings.pixel); }

  setScreen(s) {
    if (this.screen && this.screen.dispose) this.screen.dispose();
    this.screen = s;
    if (s && s.enter) s.enter();
  }

  // tests: run the game for `seconds` of simulated time without waiting for the display (hidden tabs)
  advance(seconds, fps = 60, renderEvery = 4) {
    const n = Math.round(seconds * fps);
    for (let i = 0; i < n; i++) {
      Input.poll();
      if (this.screen && this.screen.update) this.screen.update(1 / fps);
      if (i % renderEvery === 0 || i === n - 1) { this.renderer.update(1 / fps); this.renderer.render(); }
    }
    this.last = performance.now();
  }

  frame(now) {
    requestAnimationFrame((t) => this.frame(t));
    // au plus ~60 images par seconde : la simulation avance à 60 Hz, et sur un écran à 144 ou 240 Hz (les PC de jeu) on
    // redessinait tout (3D, mini-jeux, marionnettes) 2 à 4 fois plus souvent pour rien : c'est ce qui faisait ramer les
    // grosses configs sous Chrome Windows. (?fps=0 : sans limite)
    if (this.capFps !== false && this.lastDrawn !== undefined && now - this.lastDrawn < 1000 / 60 - 3) return;
    if (this.lastDrawn !== undefined) this.renderer.noteFrame(now - this.lastDrawn); // (la résolution qui s'adapte)
    this.lastDrawn = now;
    this.lastFrame = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    Input.poll();
    this.updatePadBadge(dt);
    // a gamepad press also unlocks audio (no DOM event for it)
    if (!this.audio.ctx || this.audio.ctx.state !== 'running') { for (const d of Input.list()) if (d.type === 'gamepad' && d.held) this.audio.unlock(); }
    this.safeUpdate(dt);
    try { this.renderer.update(dt); this.renderer.render(); } catch (e) { this.report(e); }
    if (this.settings.showFps) this.fpsTick(now, performance.now() - this.lastFrame); else if (this.fpsEl) this.fpsEl.style.display = 'none';
  }

  // the FPS counter (options → Compteur d'images) : images drawn per second, and the worst frame of the last half
  // second (what the game itself spent on it, in ms) ; green, orange or red
  fpsTick(now, ms) {
    if (!this.fpsEl) {
      this.fpsEl = document.createElement('div');
      this.fpsEl.style.cssText = 'position:fixed;left:6px;top:6px;z-index:9999;padding:2px 6px;border-radius:4px;background:rgba(10,6,16,0.8);color:#9dff3a;font:700 12px/1.3 ui-monospace,Menlo,Consolas,monospace;pointer-events:none;';
      document.body.appendChild(this.fpsEl);
      this.fpsN = 0; this.fpsT0 = now; this.fpsWorst = 0;
    }
    this.fpsEl.style.display = '';
    this.fpsN++; this.fpsWorst = Math.max(this.fpsWorst, ms);
    if (now - this.fpsT0 >= 500) {
      const fps = Math.round(this.fpsN * 1000 / (now - this.fpsT0));
      this.fpsEl.textContent = `${fps} FPS · ${this.fpsWorst.toFixed(1)} ms`;
      this.fpsEl.style.color = fps >= 55 ? '#9dff3a' : fps >= 40 ? '#ffc23a' : '#ff4a3a';
      this.fpsN = 0; this.fpsT0 = now; this.fpsWorst = 0;
    }
  }

  // an error in one frame must not freeze the game for good (online, it would freeze everyone)
  safeUpdate(dt) {
    try { if (this.screen && this.screen.update) this.screen.update(dt); } catch (e) { this.report(e); }
  }
  report(e) {
    const k = String(e && e.message);
    if (this.lastErr !== k) {
      this.lastErr = k; console.error(e);
      if (this.screens && this.screens.diagLine) try { this.screens.diagLine('', 'Erreur du jeu : ' + k + ' (' + String(e && e.stack || '').split(String.fromCharCode(10)).slice(1, 2).join(' ').replace(/\s+/g, ' ').replace(/https?:\/\/[^/]+\//, '').slice(0, 90) + ')'); } catch (x) { /* */ }
      // an online guest also tells the host, whose screen shows it
      const S = this.screens && this.screens.session;
      if (S && S.mode === 'client' && S.sendDiag) try { S.sendDiag('boucle : ' + k + ' | ' + String(e && e.stack || '').split(String.fromCharCode(10)).slice(1, 3).join(' ').replace(/\s+/g, ' ')); } catch (x) { /* */ }
    }
  }

  // Chrome stops requestAnimationFrame in a hidden or covered window. The host runs the match of everybody, so a
  // worker clock keeps the game going (without drawing) while the window is not shown.
  startBackgroundClock() {
    try {
      const src = 'setInterval(() => postMessage(0), 1000 / 60);';
      const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      w.onmessage = () => {
        const now = performance.now();
        if (now - (this.lastFrame || 0) < 250) return; // the normal loop is running
        const dt = Math.min(0.1, (now - this.last) / 1000);
        this.last = now;
        Input.poll();
        this.safeUpdate(dt);
      };
      this.bgClock = w;
    } catch (e) { /* no worker: the game pauses when hidden, as before */ }
  }

  quickMatch() {
    const p = this.params;
    const chars = (p.get('chars') || 'frog,micron,bubba,shark').split(',');
    const stage = p.get('stage') || 'cemetery';
    const humans = +(p.get('humans') ?? 1);
    const roster = chars.map((c, i) => ({ slot: i, char: c, bot: i >= humans ? (+(p.get('bot') || 2)) : 0, device: i === 0 && humans > 0 ? (p.get('dev') || 'kb1') : i === 1 && humans > 1 ? 'kb2' : null }));
    const m = new LocalMatch(this, { stage, roster, rules: { stocks: +(p.get('stocks') || 3), hazards: p.get('hazards') !== '0', minigames: p.get('mg') !== '0', ult: p.get('ult') !== '0' }, seed: 1234 });
    this.setScreen({ update: (dt) => m.update(dt), dispose: () => m.dispose() });
    this.match = m;
    window.__match = m;
  }
}

async function boot() {
  const app = new App();
  window.__app = app;
  if (app.params.get('animtest')) {
    const { animTest } = await import('./dev/animTest.js');
    document.getElementById('boot').remove();
    await animTest(app);
    return;
  }
  await Promise.all([preloadRigs(CHAR_ORDER), preloadEntityModels(), clipsReady, preloadProps()]);
  document.getElementById('boot').remove();
  app.startBackgroundClock();
  if (app.params.get('quick')) app.quickMatch();
  else { app.screens = new Screens(app); if (app.params.get('bar')) app.screens.bar(); else app.screens.title(); } // ?bar=1 : droit au bar (tests)
  requestAnimationFrame((t) => app.frame(t));
}

boot().catch((e) => {
  console.error(e);
  const b = document.getElementById('boot');
  if (b) b.textContent = 'Erreur : ' + e.message;
});
