// Screen change in the menus: a stone tomb door falls over the screen (thud, shake, dust), the next screen is built
// behind it, then the door is lifted and a flock of bats escapes. About 0.7 s; input is ignored meanwhile.
const FALL = 0.26, HOLD = 0.1, LIFT = 0.34;

export class Slab {
  constructor(app, crypt) {
    this.app = app;
    this.crypt = crypt;
    this.el = document.createElement('div');
    this.el.className = 'slab';
    this.el.innerHTML = '<img src="assets/ui/crypt/hd/slab.jpg" alt=""><i class="dust"></i>';
    app.ui.appendChild(this.el);
    this.busy = false;
  }

  // cover the screen, run `swap` (builds the next screen), uncover
  go(swap) {
    if (this.busy) { swap(); return; }
    this.busy = true;
    const A = this.app.audio, el = this.el;
    el.className = 'slab fall';
    A.sfx('whoosh', 0, 0.5);
    setTimeout(() => {
      A.sfx('stamp', 0, 0.9);
      A.sfx('thud', 0, 0.8);
      el.className = 'slab down';
      this.app.ui.classList.remove('shake'); void this.app.ui.offsetWidth; this.app.ui.classList.add('shake');
      if (this.crypt) this.crypt.shake(4, 0.3);
      try { swap(); } catch (e) { console.error(e); }
      setTimeout(() => {
        el.className = 'slab lift';
        A.sfx('whoosh', 0, 0.7);
        if (this.crypt && this.crypt.on) this.crypt.burst(16);
        setTimeout(() => { el.className = 'slab'; this.busy = false; }, LIFT * 1000);
      }, HOLD * 1000);
    }, FALL * 1000);
  }
}
