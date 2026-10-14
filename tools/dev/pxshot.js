// Pixel-exact capture of the pixel art menus, even when the browser window is tiny or hidden: the 640x360 scene
// canvas, then the menu pieces (.px: images and texts) redrawn on the same grid, scaled up by whole pixels and sent
// to the dev server (tools/serve.py saves it in tools/dev/shots/<name>.png).
//   const S = await import('/tools/dev/pxshot.js'); await S.shot('menu')
// CSS filters and glows are not reproduced (the outline of the chosen button, for instance); positions, sizes,
// clipping of the slime and texts are.
export async function shot(name = 'shot', scale = 2) {
  const W = 640, H = 360;
  // a hidden tab pauses the CSS animations: finish the ones that end (entrances), keep the looping ones
  for (const a of document.getAnimations()) { try { if (a.effect.getComputedTiming().endTime !== Infinity) a.finish(); } catch (e) { /* */ } }
  const c = document.createElement('canvas');
  c.width = W * scale; c.height = H * scale;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.scale(scale, scale);
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  const crypt = document.querySelector('canvas.crypt');
  if (crypt && crypt.style.display !== 'none') g.drawImage(crypt, 0, 0);
  else if (window.__app && __app.renderer) { __app.renderer.render(); g.drawImage(__app.renderer.gl.domElement, 0, 0, W, H); } // the 3D (same task: still in the buffer)
  for (const px of document.querySelectorAll('#ui .px')) {
    const pr = px.getBoundingClientRect();
    const k = pr.width / W;
    const cache = {};
    const imgOf = async (url) => cache[url] || (cache[url] = await new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = url; }));
    for (const el of px.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
      const er = el.getBoundingClientRect();
      const ex = (er.left - pr.left) / k, ey = (er.top - pr.top) / k, ew = er.width / k, eh = er.height / k;
      // background: a plain color, or the first color of a gradient
      const bgc = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ? cs.backgroundColor : (/(rgba?\([^)]*\))/.exec(cs.backgroundImage || '') || [])[1];
      if (bgc && ew > 0) { g.fillStyle = bgc; g.fillRect(ex, ey, ew, eh); }
      // 9-slice border image (the stone panels and frames)
      const bis = /url\("?([^")]+)"?\)/.exec(cs.borderImageSource || '');
      if (bis && ew > 0) {
        const im = await imgOf(bis[1]);
        const s = parseFloat(cs.borderImageSlice), b = parseFloat(cs.borderTopWidth) || s, fill = /fill/.test(cs.borderImageSlice);
        if (im) {
          const W2 = im.width, H2 = im.height;
          const cols = [[0, s, ex, b], [s, W2 - 2 * s, ex + b, ew - 2 * b], [W2 - s, s, ex + ew - b, b]];
          const rows = [[0, s, ey, b], [s, H2 - 2 * s, ey + b, eh - 2 * b], [H2 - s, s, ey + eh - b, b]];
          for (let r = 0; r < 3; r++) for (let c2 = 0; c2 < 3; c2++) {
            if (r === 1 && c2 === 1 && !fill) continue;
            const [sx, sw, dx, dw] = cols[c2], [sy, sh, dy, dh] = rows[r];
            if (dw > 0 && dh > 0) g.drawImage(im, sx, sy, sw, sh, dx, dy, dw, dh);
          }
        }
      }
      if (el.tagName === 'IMG') {
        const r = el.getBoundingClientRect();
        let sx = 0, sy = 0, sw = el.naturalWidth, sh = el.naturalHeight;
        const m = /inset\(([\d.]+)(?:px|%)? ([\d.]+)(?:px|%)? ([\d.]+)(%|px)?/.exec(cs.clipPath || '');
        if (m && m[4] === '%' && +m[3] >= 99) continue; // fully clipped (the slime of a button not chosen)
        g.globalAlpha = +cs.opacity;
        g.drawImage(el, sx, sy, sw, sh, (r.left - pr.left) / k, (r.top - pr.top) / k, r.width / k, r.height / k);
        g.globalAlpha = 1;
      }
      for (const n of el.childNodes) {
        if (n.nodeType !== 3 || !n.textContent.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(n);
        const rects = range.getClientRects();
        if (!rects.length) continue;
        const r = rects[0];
        g.font = `${cs.fontWeight} ${parseFloat(cs.fontSize)}px ${cs.fontFamily}`;
        g.textBaseline = 'top';
        const x = (r.left - pr.left) / k, y = (r.top - pr.top) / k + (r.height / k - parseFloat(cs.fontSize)) / 2;
        g.fillStyle = '#0c0814'; g.fillText(n.textContent.trim(), x + 1, y + 1);
        g.fillStyle = cs.color; g.fillText(n.textContent.trim(), x, y);
      }
    }
  }
  const slab = document.querySelector('.slab.down img');
  if (slab) g.drawImage(slab, 0, 0, W, H);
  const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
  const r = await fetch('/__shot/' + name + '.png', { method: 'POST', body: blob });
  return r.status;
}
