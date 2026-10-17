// The VS screen before every fight (17 Oct 2026), which is also its loading: while it shows, the match is built and
// drawn behind it, its simulation stopped (src/game/localMatch.js, rollbackMatch.js: `loading`), so the shaders,
// textures and mini-game puppets are ready before the countdown; online, every machine says when it is ready and the
// host starts them all together (Screens.matchLoop). It lasts about 3 s: the fighters' panels slam in face to face
// (the player's colour, the character's portrait, the PLAYER's name), a big VS lands in the middle with a shake, the
// narrator reads the players' names ("Léo VERSUS Max !"), a thin bar fills; then exit(): the panels fly apart, a
// flash, and the countdown of the match starts behind.
//   const V = new Versus(app, layer, { players: [{ name, char, color }], stage, round }); V.update(dt); V.exit(); V.dispose();
import { CHARS } from '../sim/chars/index.js';
import { STAGES } from '../sim/stages/index.js';
import { burst, flash, lines, splash, fitText } from './juice.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const portrait = (c) => `assets/ui/portraits/${c}.png`;

export class Versus {
  constructor(app, parent, { players, stage, round }) {
    this.app = app; this.t = 0; this.leaving = false; this.done = false;
    const n = Math.max(1, Math.min(4, players.length));
    const el = this.el = document.createElement('div');
    el.className = 'px vs2-px n' + n;
    const W = 640 / n;
    el.innerHTML = '<i class="vs2-bg"></i><i class="vs2-rays"></i>' + players.slice(0, 4).map((p, i) => {
      const ch = CHARS[p.char];
      return `<div class="vs2-panel${i >= n / 2 ? ' r' : ''}" style="--pc:${p.color};--i:${i};left:${(i * W - 18).toFixed(0)}px;width:${(W + 36).toFixed(0)}px">
        <i class="vs2-tone"></i><img src="${portrait(p.char || 'frog')}" alt=""><b><em>${esc(p.name)}</em></b><small>${ch ? esc(ch.name) : ''}</small></div>`;
    }).join('')
      + '<div class="vs2-bolt"></div><div class="vs2-vs"><b>VS</b></div>'
      + (round ? `<div class="vs2-round">${esc(round)}</div>` : '')
      + `<div class="vs2-stage">ARÈNE : <b>${esc(STAGES[stage] ? STAGES[stage].name : '?')}</b></div>`
      + '<div class="vs2-load"><i></i><span>Préparation de la bagarre…</span></div><div class="jx-layer"></div>';
    parent.appendChild(el);
    this.fx = el.querySelector('.jx-layer');
    requestAnimationFrame(() => el.querySelectorAll('.vs2-panel b em').forEach((e) => fitText(e, W - 30)));
    const A = app.audio;
    const humans = players.filter((p) => !p.cpu).map((p) => p.name).filter(Boolean), cpus = players.length - players.filter((p) => !p.cpu).length;
    const names = humans.concat(cpus ? [cpus === 1 ? 'l\'ordi' : ['', '', 'deux', 'trois'][cpus] + ' ordis'] : []);
    this.beats = [
      [0.05, () => A.sfx('whoosh', 0, 1)],
      [0.5, () => {
        flash(this.fx, '#ffffff', 0.75); lines(this.fx, 320, 170, { n: 32, len: 280, life: 650 });
        burst(this.fx, 320, 170, 'VS', { color: '#ffd84a', size: 120, life: 800 });
        A.sfx('punchHeavy', 0, 0.9); A.sfx('stamp', 0, 0.8);
        this.shake();
      }],
      // the narrator: the players' names, not the characters'
      [0.85, () => A.say(names.join(' VERSUS ') + ' !', 1.15, 1.08)],
      [1.4, () => players.slice(0, 4).forEach((p, i) => splash(this.fx, (i + 0.5) * W, 210, [p.color, '#120a1a', '#fff3d6'], 10, { speed: 60 }))],
    ];
  }

  shake() { this.el.classList.remove('shake'); void this.el.offsetWidth; this.el.classList.add('shake'); }

  // the line under the bar: online, while the others are not ready yet
  waiting(on) { const s = this.el.querySelector('.vs2-load span'); if (s) s.textContent = on ? 'En attente des autres joueurs…' : 'Préparation de la bagarre…'; }

  update(dt) {
    this.t += dt;
    while (this.beats.length && this.t >= this.beats[0][0]) this.beats.shift()[1]();
  }

  // the panels fly apart, the VS bursts, a flash: the arena appears and its countdown starts
  exit() {
    if (this.leaving) return;
    this.leaving = true;
    this.beats = [];
    this.el.classList.add('out');
    flash(this.fx, '#ffffff', 0.9);
    this.app.audio.sfx('whoosh', 0, 1);
    setTimeout(() => this.dispose(), 650);
  }

  dispose() { if (this.done) return; this.done = true; this.el.remove(); }
}
