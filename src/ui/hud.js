// In-match HUD: one card per fighter (portrait, damage %, stocks), timer, pause hint.
import { COLORS } from '../sim/constants.js';
import { CHARS } from '../sim/chars/index.js';

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
    this.el = document.createElement('div');
    this.el.className = 'hud';
    root.appendChild(this.el);
    this.timer = document.createElement('div');
    this.timer.className = 'timer';
    root.appendChild(this.timer);
    this.cards = {};
    this.last = {};
  }

  setup(W, names = {}) {
    this.el.innerHTML = '';
    this.cards = {};
    for (const F of W.list) {
      const c = document.createElement('div');
      c.className = 'card';
      c.style.setProperty('--pc', COLORS[F.slot]);
      const def = CHARS[F.char];
      c.innerHTML = `
        <div class="portrait" style="--cc:${def.color}"><img src="${portraitURL(F.char)}" onerror="this.style.display='none'"><span>${def.name[0]}</span></div>
        <div class="info">
          <div class="pname">${names[F.slot] || 'J' + (F.slot + 1)}${F.bot ? ' <i>CPU</i>' : ''}</div>
          <div class="cname">${def.name}</div>
          <div class="pct"><b>0</b><small>%</small></div>
          <div class="stocks"></div>
        </div>`;
      this.el.appendChild(c);
      this.cards[F.slot] = { el: c, pct: c.querySelector('.pct b'), pctBox: c.querySelector('.pct'), stocks: c.querySelector('.stocks'), shake: 0 };
      this.last[F.slot] = { dmg: -1, stocks: -1 };
    }
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
        c.stocks.innerHTML = '<span class="skull"></span>'.repeat(Math.min(n, 9));
        L.stocks = F.stocks;
      }
      c.el.classList.toggle('out', !!F.out);
      if (c.shake > 0) {
        c.shake = Math.max(0, c.shake - dt * 2.5);
        const s = c.shake * 8;
        c.pctBox.style.transform = `translate(${(Math.random() - 0.5) * s}px, ${(Math.random() - 0.5) * s}px) scale(${1 + c.shake * 0.35})`;
      } else c.pctBox.style.transform = '';
    }
    if (W.rules.mode === 'time') {
      const s = Math.max(0, Math.ceil(W.timeLeft / 60));
      this.timer.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      this.timer.classList.toggle('low', s <= 10);
    }
  }

  show(v) { this.el.style.display = v ? 'flex' : 'none'; if (!v) this.timer.style.display = 'none'; }
}
