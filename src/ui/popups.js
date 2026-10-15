// Punchy texts anchored in the 3D world (TUNG !, PARADE !...), big banners and the countdown.
import * as THREE from 'three';

export class Popups {
  constructor(root, renderer) {
    this.root = root;
    this.renderer = renderer;
    this.layer = document.createElement('div');
    this.layer.className = 'popups';
    root.appendChild(this.layer);
    this.items = [];
    this.v = new THREE.Vector3();
  }

  text(str, x, y, z, color = '#fff', scale = 1) {
    const el = document.createElement('div');
    el.className = 'pop';
    el.textContent = str;
    el.style.color = color;
    el.style.setProperty('--s', scale);
    el.style.setProperty('--r', ((Math.random() - 0.5) * 16).toFixed(1) + 'deg');
    this.layer.appendChild(el);
    this.items.push({ el, x, y, z, t: 0, life: 1.1 });
    if (this.items.length > 40) { const o = this.items.shift(); o.el.remove(); }
  }

  banner(str, color = '#fff', life = 1.6, cls = '') {
    const el = document.createElement('div');
    el.className = 'banner' + (cls ? ' ' + cls : '');
    el.textContent = str;
    el.style.color = color;
    this.layer.appendChild(el);
    setTimeout(() => el.remove(), life * 1000);
  }

  // manga speed lines around a point of the screen (the zoom of a duel's big blow), gone in `life` seconds
  zoomLines(sx, sy, big, life = 0.9) {
    const el = document.createElement('div');
    el.className = 'zoomlines' + (big ? ' big' : '');
    el.style.setProperty('--cx', (sx * 100).toFixed(1) + '%');
    el.style.setProperty('--cy', (sy * 100).toFixed(1) + '%');
    el.style.setProperty('--life', life + 's');
    this.layer.appendChild(el);
    setTimeout(() => el.remove(), life * 1000);
  }
  // screen position (0..1) of a point of the world
  screenOf(x, y, z) { this.v.set(x, y, z).project(this.renderer.camera); return [this.v.x * 0.5 + 0.5, -this.v.y * 0.5 + 0.5]; }

  countdown(n) {
    const el = document.createElement('div');
    el.className = 'countdown' + (typeof n === 'string' ? ' go' : '');
    el.textContent = n;
    this.layer.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }

  update(dt) {
    const w = window.innerWidth, h = window.innerHeight;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const o = this.items[i];
      o.t += dt;
      if (o.t > o.life) { o.el.remove(); this.items.splice(i, 1); continue; }
      this.v.set(o.x, o.y + o.t * 1.2, o.z).project(this.renderer.camera);
      o.el.style.left = ((this.v.x * 0.5 + 0.5) * w).toFixed(1) + 'px';
      o.el.style.top = ((-this.v.y * 0.5 + 0.5) * h).toFixed(1) + 'px';
      o.el.style.opacity = o.t > o.life * 0.7 ? (1 - (o.t - o.life * 0.7) / (o.life * 0.3)).toFixed(2) : 1;
    }
  }

  clear() { this.items.forEach((o) => o.el.remove()); this.items = []; this.layer.innerHTML = ''; }
}
