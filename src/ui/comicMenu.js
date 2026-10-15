// The main menu as a comic page (art direction "BD d'horreur", css/comic.css .cm-*): the entries are panels in
// columns (a title strip over each column), the chosen one jumps out in caption yellow with the skeleton hand
// pointing at it, its explanation is written big in a caption under the grid, and A slams it with a sound word.
// The entrance plays on each panel's frame (.cb), the choice on its inside (.ci): changing the choice never replays
// the entrance. items: [{ label, hint, icon, word, act }], cols: [{ title, items: [index...] }].
import { burst, splash, lines, flash } from './juice.js';

const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const realMove = (e) => !!(e.movementX || e.movementY);

export class ComicMenu {
  constructor(parent, items, opts) {
    this.items = items; this.opts = opts; this.i = 0; this.done = false;
    const { cols, x = 160, top = 128, w = 152, ph = 34, gap = 6, colGap = 16 } = opts;
    this.cols = cols;
    this.el = h('div', 'cm');
    parent.appendChild(this.el);
    this.pos = [];
    this.btns = [];
    cols.forEach((c, ci) => {
      const cx = x + ci * (w + colGap);
      const t = h('div', 'cm-col', c.title); t.style.cssText = `left:${cx}px;top:${top - 15}px;width:${w}px;--k:${ci}`;
      this.el.appendChild(t);
      c.items.forEach((idx, ri) => {
        const it = items[idx];
        const b = h('div', 'cb', `<div class="ci"><i class="cf"></i><b class="ic">${it.icon || ''}</b><span class="lab">${it.label}</span><i class="sh"></i></div>`);
        b.style.cssText = `left:${cx}px;top:${top + ri * (ph + gap)}px;width:${w}px;height:${ph}px;--k:${ci * 4 + ri}`;
        b.onmousemove = (e) => { if (realMove(e)) this.focus(idx); };
        b.onclick = () => { this.focus(idx); this.activate(); };
        this.el.appendChild(b);
        this.btns[idx] = b;
        this.pos[idx] = { c: ci, r: ri, x: cx, y: top + ri * (ph + gap), w, h: ph };
      });
    });
    this.hand = h('img', 'cm-hand'); this.hand.src = 'assets/ui/crypt/hd/hand.png'; this.hand.width = 40;
    this.el.appendChild(this.hand);
    this.cap = h('div', 'cm-cap');
    this.cap.style.cssText = `left:${x - 20}px;width:${cols.length * (w + colGap) - colGap + 40}px;top:${top + 4 * (ph + gap) + 8}px`;
    this.el.appendChild(this.cap);
    this.fx = h('div', 'jx-layer');
    this.el.appendChild(this.fx);
    this.focus(opts.start || 0, true);
  }

  focus(i, quiet) {
    if (i === this.i && !quiet) return;
    if (this.btns[this.i]) this.btns[this.i].classList.remove('on');
    this.i = i;
    const b = this.btns[i], p = this.pos[i], it = this.items[i];
    b.classList.add('on');
    const ci = b.querySelector('.ci');
    ci.classList.remove('pop'); void ci.offsetWidth; ci.classList.add('pop');
    // the hand points from the outer side of its column (mirrored on the right one)
    const right = p.c > 0 && p.c === this.cols.length - 1;
    this.hand.style.left = (right ? p.x + p.w + 2 : p.x - 40) + 'px';
    this.hand.classList.toggle('flip', right);
    this.hand.style.top = (p.y + p.h / 2 - 12) + 'px';
    this.cap.innerHTML = `<b>${it.label}</b><span>${it.hint || ''}</span>`;
    this.cap.classList.remove('in'); void this.cap.offsetWidth; this.cap.classList.add('in');
    if (!quiet) {
      window.__app.audio.sfx('menuMove');
      splash(this.fx, p.x + p.w - 6, p.y + 4, ['#120a1a', '#ffd84a'], 3, { speed: 16, size: 2.5 });
    }
  }

  activate() {
    const it = this.items[this.i];
    if (!it || this.done) return;
    this.done = true;
    const b = this.btns[this.i], p = this.pos[this.i];
    b.classList.add('hit');
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
    burst(this.fx, cx, cy - 4, it.word || 'GO !', { color: '#e8202e', text: '#fff3d6', size: 92, life: 700 });
    lines(this.fx, cx, cy, { n: 20, len: 170, life: 450 });
    splash(this.fx, cx, cy, ['#120a1a', '#ffd84a', '#fff3d6'], 14, { speed: 60 });
    flash(this.fx, '#fff3d6', 0.35);
    window.__app.audio.sfx('menuOk');
    window.__app.audio.sfx('stamp', 0, 0.5);
    if (this.opts.crypt) this.opts.crypt.shake(3, 0.2);
    setTimeout(() => { this.done = false; b.classList.remove('hit'); it.act(); }, 240);
  }

  update(ev) {
    const p = this.pos[this.i], col = this.cols[p.c].items;
    if (ev.up) this.focus(col[(p.r + col.length - 1) % col.length]);
    if (ev.down) this.focus(col[(p.r + 1) % col.length]);
    if (ev.left || ev.right) {
      const nc = this.cols[(p.c + (ev.right ? 1 : this.cols.length - 1)) % this.cols.length].items;
      this.focus(nc[Math.min(p.r, nc.length - 1)]);
    }
    if (ev.confirm) this.activate();
  }
}
