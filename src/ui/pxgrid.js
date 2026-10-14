// The 640x360 grid of the pixel art interface (menus, HUD): every .px box is scaled by --k and centered (--ox, --oy)
// to fit the window. Kept up to date on resize; call fitPx() once before showing a .px box.
export const VW = 640, VH = 360;

let installed = false;
export function fitPx() {
  const k = Math.min(innerWidth / VW, innerHeight / VH);
  const r = document.documentElement.style;
  r.setProperty('--k', k);
  r.setProperty('--ox', Math.round((innerWidth - VW * k) / 2) + 'px');
  r.setProperty('--oy', Math.round((innerHeight - VH * k) / 2) + 'px');
  if (!installed) { installed = true; window.addEventListener('resize', fitPx); }
}
