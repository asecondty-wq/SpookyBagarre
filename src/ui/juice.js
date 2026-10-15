// Comic book juice for the menus and the HUD (the 640x360 .px grid, art direction "BD d'horreur", css/comic.css):
// a starburst with its sound word (BAM !), ink drops and sparks flying out, a flash. Everything is a few DOM nodes
// animated with the Web Animations API, removed when done. Positions and sizes are in pixels of the grid.
const WORDS = ['BAM !', 'POW !', 'CRAC !', 'SBLAF !', 'BOUM !', 'KRAK !', 'TCHAC !', 'VLAN !'];
const INK = '#120a1a';

export const randomWord = () => WORDS[(Math.random() * WORDS.length) | 0];

// a spiky starburst (SVG) with a word in it, slammed in then gone
export function burst(parent, x, y, word = randomWord(), { color = '#ffd400', size = 70, life = 650, rot = (Math.random() - 0.5) * 24, text = INK } = {}) {
  const n = 13, pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2, r = i % 2 ? 0.62 + Math.random() * 0.1 : 0.96 + Math.random() * 0.04;
    pts.push(`${(50 + Math.cos(a) * r * 48).toFixed(1)},${(50 + Math.sin(a) * r * 48 * 0.78).toFixed(1)}`);
  }
  const el = document.createElement('div');
  el.className = 'jx-burst';
  el.style.cssText = `left:${x - size / 2}px;top:${y - size * 0.4}px;width:${size}px;height:${size * 0.8}px;`;
  el.innerHTML = `<svg viewBox="0 0 100 80" width="100%" height="100%"><polygon points="${pts.join(' ')}" fill="${INK}" transform="translate(3 3)"/>` +
    `<polygon points="${pts.join(' ')}" fill="${color}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/></svg>` +
    `<b style="color:${text};font-size:${Math.round(size * 0.26)}px">${word}</b>`;
  parent.appendChild(el);
  el.animate([
    { transform: `scale(.1) rotate(${rot - 30}deg)`, opacity: 1 },
    { transform: `scale(1.25) rotate(${rot}deg)`, opacity: 1, offset: 0.22 },
    { transform: `scale(1) rotate(${rot}deg)`, opacity: 1, offset: 0.4 },
    { transform: `scale(1.05) rotate(${rot}deg)`, opacity: 1, offset: 0.8 },
    { transform: `scale(1.3) rotate(${rot + 6}deg)`, opacity: 0 },
  ], { duration: life, easing: 'ease-out' }).onfinish = () => el.remove();
  return el;
}

// ink drops and bright chips flying out of a point, falling a little
export function splash(parent, x, y, colors = [INK, '#ffd400', '#fff3d6'], n = 10, { speed = 40, size = 3 } = {}) {
  for (let i = 0; i < n; i++) {
    const d = document.createElement('i');
    d.className = 'jx-drop';
    const s = size * (0.5 + Math.random());
    d.style.cssText = `left:${x}px;top:${y}px;width:${s}px;height:${s}px;background:${colors[i % colors.length]};`;
    parent.appendChild(d);
    const a = Math.random() * Math.PI * 2, v = speed * (0.5 + Math.random() * 0.8);
    const dx = Math.cos(a) * v, dy = Math.sin(a) * v * 0.8;
    d.animate([
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
      { transform: `translate(calc(-50% + ${dx * 0.7}px), calc(-50% + ${dy * 0.7}px)) scale(1)`, opacity: 1, offset: 0.5 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + 14}px)) scale(.3)`, opacity: 0 },
    ], { duration: 420 + Math.random() * 260, easing: 'cubic-bezier(.2,.7,.4,1)' }).onfinish = () => d.remove();
  }
}

// speed lines: a fan of ink strokes radiating out of a point, for a big moment (all ready, a pick)
export function lines(parent, x, y, { n = 18, len = 120, color = '#fff3d6', life = 420 } = {}) {
  for (let i = 0; i < n; i++) {
    const l = document.createElement('i');
    l.className = 'jx-line';
    const a = (i / n) * 360 + Math.random() * 10;
    l.style.cssText = `left:${x}px;top:${y}px;width:${len * (0.6 + Math.random() * 0.5)}px;background:${color};transform:rotate(${a}deg)`;
    parent.appendChild(l);
    l.animate([
      { transform: `rotate(${a}deg) translateX(10px) scaleX(.1)`, opacity: 0.9 },
      { transform: `rotate(${a}deg) translateX(40px) scaleX(1)`, opacity: 0.8, offset: 0.4 },
      { transform: `rotate(${a}deg) translateX(90px) scaleX(.2)`, opacity: 0 },
    ], { duration: life, easing: 'ease-out' }).onfinish = () => l.remove();
  }
}

// the whole grid flashes in a color (very short: a hit of light, never a strobe)
export function flash(parent, color = '#fff3d6', a = 0.5) {
  const f = document.createElement('i');
  f.className = 'jx-flash';
  f.style.background = color;
  parent.appendChild(f);
  f.animate([{ opacity: a }, { opacity: 0 }], { duration: 220, easing: 'ease-out' }).onfinish = () => f.remove();
}

// squeeze a long name into its box (scaleX), the comic letters keep their height
export function fitText(el, max) {
  if (!el) return;
  const run = () => {
    el.style.transform = '';
    const w = el.offsetWidth;
    if (w > max) { el.style.transformOrigin = '0 50%'; el.style.transform = `scaleX(${(max / w).toFixed(3)})`; }
  };
  run();
  if (document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(run); // measured again in the comic font
}
