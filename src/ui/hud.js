// In-match HUD in pixel art (the 640x360 grid of the menus): one stone plaque per fighter (pixel portrait, damage %,
// stocks as little skulls, the three special cooldowns), the timer, the countdown to the next minigame (top right).
import { COLORS } from '../sim/constants.js';
import { CHARS } from '../sim/chars/index.js';
import { fitPx } from './pxgrid.js';
import { mgEvery } from '../sim/minigames.js';

export function portraitURL(char) { return `assets/ui/portraits/${char}.png`; }

export function pctColor(p) {
  // white -> yellow -> orange -> red -> dark red
  const t = Math.min(1, p / 160);
  const r = 255, g = Math.round(255 - t * 230), b = Math.round(255 - Math.min(1, t * 2.2) * 255);
  const dark = Math.max(0, (p - 160) / 140);
  return `rgb(${Math.round(r * (1 - dark * 0.5))},${Math.round(g * (1 - dark))},${Math.round(b * (1 - dark))})`;
}

export class HUD {
  constructor(root) {
    this.root = root;
    fitPx();
    this.el = document.createElement('div');
    this.el.className = 'px phud';
    root.appendChild(this.el);
    this.list = document.createElement('div');
    this.list.className = 'phud-cards';
    this.el.appendChild(this.list);
    this.timer = document.createElement('div');
    this.timer.className = 'phud-timer';
    this.el.appendChild(this.timer);
    // le prochain mini-jeu (un toutes les 40 s) : discret, en haut à droite
    this.mgEl = document.createElement('div');
    this.mgEl.className = 'phud-mg';
    this.el.appendChild(this.mgEl);
    this.mgLast = -1;
    this.cards = {};
    this.last = {};
  }

  setup(W, names = {}) {
    this.list.innerHTML = '';
    this.cards = {};
    const n = W.list.length;
    W.list.forEach((F, i) => {
      const c = document.createElement('div');
      c.className = 'phc';
      c.style.setProperty('--pc', COLORS[F.slot]);
      c.style.setProperty('--i', i);
      c.style.left = (320 - n * 66 + i * 132) + 'px';
      const def = CHARS[F.char];
      c.innerHTML = `
        <div class="pp"><img src="assets/ui/portraits/${F.char}.png" alt=""></div>
        <b class="pj">${(names[F.slot] || 'J' + (F.slot + 1)).slice(0, 10)}${F.bot ? ' <i>CPU</i>' : ''}</b>
        <span class="pn">${def.name}</span>
        <div class="pct"><b>0</b><small>%</small></div>
        <div class="stocks"></div>
        <div class="cds"><i></i><i></i><i></i></div>`;
      this.list.appendChild(c);
      this.cards[F.slot] = { el: c, pct: c.querySelector('.pct b'), pctBox: c.querySelector('.pct'), stocks: c.querySelector('.stocks'), cds: [...c.querySelectorAll('.cds i')], cdLast: [0, 0, 0], shake: 0 };
      this.last[F.slot] = { dmg: -1, stocks: -1 };
    });
    this.timer.style.display = W.rules.mode === 'time' ? 'block' : 'none';
  }

  update(W, dt) {
    for (const F of W.list) {
      const c = this.cards[F.slot];
      if (!c) continue;
      const L = this.last[F.slot];
      const d = Math.floor(F.damage);
      if (d !== L.dmg) {
        if (d > L.dmg && L.dmg >= 0) { c.shake = Math.min(1, 0.3 + (d - L.dmg) / 20); c.pctBox.classList.remove('bump'); void c.pctBox.offsetWidth; c.pctBox.classList.add('bump'); }
        c.pct.textContent = d;
        c.pctBox.style.color = pctColor(d);
        c.el.classList.toggle('danger', d >= 120);
        L.dmg = d;
      }
      if (F.stocks !== L.stocks) {
        const n = W.rules.mode === 'stock' ? Math.max(0, F.stocks) : 0;
        c.stocks.innerHTML = `<img src="assets/ui/crypt/hd/skull.png" width="9" alt="">`.repeat(Math.min(n, 9));
        if (L.stocks > F.stocks) { c.el.classList.remove('lost'); void c.el.offsetWidth; c.el.classList.add('lost'); }
        L.stocks = F.stocks;
      }
      c.el.classList.toggle('out', !!F.out);
      // special cooldowns (X, X + side, X + down): the dark part is what is left; a flash when it is back
      for (let i = 0; i < 3; i++) {
        const k = 'nsd'[i];
        const f = F.cdFrac ? F.cdFrac[i] : (F.cd ? F.cd[k] / (F.cdMax[k] || 1) : 0);
        const q = Math.round(f * 12) / 12;
        if (q !== c.cdLast[i]) {
          const pip = c.cds[i];
          pip.style.setProperty('--f', q);
          pip.classList.toggle('wait', q > 0);
          if (q === 0 && c.cdLast[i] > 0) { pip.classList.remove('ready'); void pip.offsetWidth; pip.classList.add('ready'); }
          c.cdLast[i] = q;
        }
      }
      if (c.shake > 0) {
        c.shake = Math.max(0, c.shake - dt * 2.5);
        const s = c.shake * 4; // pixels of the grid
        c.pctBox.style.transform = `translate(${Math.round((Math.random() - 0.5) * s)}px, ${Math.round((Math.random() - 0.5) * s)}px) scale(${(1 + c.shake * 0.4).toFixed(2)})`;
      } else c.pctBox.style.transform = '';
    }
    const every = W.rules.minigames === false ? 0 : mgEvery(W);
    const left = every && W.phase === 'play' ? Math.max(0, Math.ceil((every - (W.mgClock || 0)) / 60)) : -1;
    if (left !== this.mgLast) {
      this.mgLast = left;
      this.mgEl.style.display = left < 0 ? 'none' : 'block';
      if (left >= 0) {
        this.mgEl.innerHTML = `<i>🎲</i> MINI-JEU <b>${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}</b>`;
        this.mgEl.classList.toggle('soon', left <= 5);
        if (left <= 5) { this.mgEl.classList.remove('tick'); void this.mgEl.offsetWidth; this.mgEl.classList.add('tick'); }
      }
    }
    if (W.rules.mode === 'time') {
      const s = Math.max(0, Math.ceil(W.timeLeft / 60));
      this.timer.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      this.timer.classList.toggle('low', s <= 10);
    }
  }

  show(v) { this.el.style.display = v ? 'block' : 'none'; }
}
