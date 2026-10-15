// In-match HUD (the 640x360 grid of the menus, art direction "BD d'horreur", css/comic.css): one slanted comic panel
// per fighter (the bust popping out of it, the damage % in big inked letters, his stock heads, the three special
// cooldowns), the timer, the countdown to the next minigame (top right). Juice: the % jumps and shakes, ink flies out
// of a big hit, a lost stock head falls off the panel.
import { COLORS } from '../sim/constants.js';
import { CHARS } from '../sim/chars/index.js';
import { fitPx } from './pxgrid.js';
import { mgLeft } from '../sim/minigames.js';
import { splash, burst } from './juice.js';

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
    // le prochain mini-jeu (toutes les 30 à 60 s) : affiché seulement dans ses 5 dernières secondes
    this.mgEl = document.createElement('div');
    this.mgEl.className = 'phud-mg';
    this.el.appendChild(this.mgEl);
    this.fx = document.createElement('div');
    this.fx.className = 'jx-layer';
    this.el.appendChild(this.fx);
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
      const x = 320 - n * 69 + i * 138;
      c.style.left = x + 'px';
      const def = CHARS[F.char];
      c.style.setProperty('--cc', def.color);
      c.innerHTML = `<i class="hb"></i>
        <div class="pp"><img src="assets/ui/portraits/${F.char}.png" alt=""></div>
        <div class="pct"><b>0</b><small>%</small></div>
        <div class="tag"><b class="pj">${(names[F.slot] || 'J' + (F.slot + 1)).slice(0, 10)}${F.bot ? ' <i>CPU</i>' : ''}</b><span class="pn">${def.name}</span></div>
        <div class="stocks"></div>
        <div class="cds"><i></i><i></i><i></i></div>`;
      this.list.appendChild(c);
      this.cards[F.slot] = { el: c, x, char: F.char, pct: c.querySelector('.pct b'), pctBox: c.querySelector('.pct'), stocks: c.querySelector('.stocks'), cds: [...c.querySelectorAll('.cds i')], cdLast: [0, 0, 0], shake: 0 };
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
        if (d > L.dmg && L.dmg >= 0) {
          const hit = d - L.dmg;
          c.shake = Math.min(1, 0.3 + hit / 20); c.pctBox.classList.remove('bump'); void c.pctBox.offsetWidth; c.pctBox.classList.add('bump');
          // a big hit: ink and blood fly off the number
          if (hit >= 7) splash(this.fx, c.x + 76, 322, ['#120a1a', pctColor(d), '#e8202e'], Math.min(14, 4 + hit), { speed: 26 + hit * 2, size: 2.5 });
        }
        c.pct.textContent = d;
        c.pctBox.style.color = pctColor(d);
        c.el.classList.toggle('hot', d >= 100 && d < 150);
        c.el.classList.toggle('danger', d >= 150);
        L.dmg = d;
      }
      if (F.stocks !== L.stocks) {
        const n = W.rules.mode === 'stock' ? Math.max(0, F.stocks) : 0;
        // a lost stock: its little head falls off the panel, spinning
        if (L.stocks > F.stocks && L.stocks > 0) {
          const head = c.stocks.lastElementChild;
          if (head) {
            const r = head.getBoundingClientRect(), pr = this.el.getBoundingClientRect(), k = pr.width / 640;
            const f = head.cloneNode(true);
            f.classList.add('fall');
            f.style.left = (r.left - pr.left) / k + 'px'; f.style.top = (r.top - pr.top) / k + 'px';
            this.fx.appendChild(f);
            const dx = (Math.random() - 0.3) * 40;
            f.animate([{ transform: 'translate(0,0) rotate(0) scale(1.6)' }, { transform: `translate(${dx * 0.4}px,-18px) rotate(${dx * 4}deg) scale(1.8)`, offset: 0.25 },
              { transform: `translate(${dx}px,60px) rotate(${dx * 12}deg) scale(1)`, opacity: 0 }], { duration: 900, easing: 'cubic-bezier(.3,0,.8,1)' }).onfinish = () => f.remove();
          }
          if (F.stocks <= 0) burst(this.fx, c.x + 66, 312, 'K.O. !', { color: '#e8202e', text: '#fff3d6', size: 74, life: 900 });
        }
        c.stocks.innerHTML = n > 4 ? `<i class="st"><img src="assets/ui/portraits/${c.char}.png" alt=""></i><b class="sx">×${n}</b>`
          : `<i class="st"><img src="assets/ui/portraits/${c.char}.png" alt=""></i>`.repeat(n);
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
    // le prochain mini-jeu ne s'annonce que dans ses 5 dernières secondes (la surprise : il tombe toutes les 30 à 60 s)
    const f = mgLeft(W), left = f < 0 ? -1 : Math.ceil(f / 60);
    if (left !== this.mgLast) {
      this.mgLast = left;
      const on = left > 0 && left <= 5;
      this.mgEl.style.display = on ? 'block' : 'none';
      if (on) {
        this.mgEl.innerHTML = `<i>🎲 MINI-JEU DANS</i><b>${left}</b>`;
        this.mgEl.classList.remove('tick'); void this.mgEl.offsetWidth; this.mgEl.classList.add('tick');
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
