// Texts on a 2D canvas drawn once (17 Oct 2026). Chrome draws the text of an accelerated canvas again, glyph by glyph,
// at every frame, on the page's main thread when it hands the frame to the GPU: 5 to 8 ms an image in the mini-games
// that write a lot (emojis, big fonts), not counted in the game's own time (tools/dev/mgtrace.mjs). Here the fillText /
// strokeText of a context draw each different text once into a small image kept in a cache, then paste it: the same
// font, colour, alignment, baseline, line width, maximum width; drawn at the scale of the context's transform, pasted
// with its transform, alpha and shadow. A gradient or a pattern as colour, or fonts still loading: drawn as before.
//   cacheCanvasText(ctx)  (src/render/minigameView.js: the mini-games' overlay)
//   spriteBudget(): true while a new small image may still be made in this frame (BUDGET a frame: a burst of new texts,
//   confetti of emojis in many sizes, made 30 to 70 ms in one frame; past it, the text is written directly this time)
const CACHE = new Map();
const BUDGET = 8;
let made = 0, armed = false;
export function spriteBudget() {
  if (!armed && typeof requestAnimationFrame !== 'undefined') { armed = true; requestAnimationFrame(() => { made = 0; armed = false; }); }
  return made++ < BUDGET;
}
const MAX = 900; // texts kept (a timer that changes every frame makes new ones; past that, the cache starts over)
let scratch = null;
if (typeof document !== 'undefined' && document.fonts) document.fonts.addEventListener('loadingdone', () => CACHE.clear());

export function cacheCanvasText(ctx) {
  const fill0 = ctx.fillText.bind(ctx), stroke0 = ctx.strokeText.bind(ctx);
  ctx.fillText = (s, x, y, mw) => draw(ctx, false, fill0, s, x, y, mw);
  ctx.strokeText = (s, x, y, mw) => draw(ctx, true, stroke0, s, x, y, mw);
}

function draw(ctx, stroke, native, s, x, y, mw) {
  s = String(s);
  const style = stroke ? ctx.strokeStyle : ctx.fillStyle;
  if (!s || typeof style !== 'string' || (document.fonts && document.fonts.status !== 'loaded')) return native(s, x, y, mw);
  const m = ctx.getTransform();
  const sc = Math.max(0.25, Math.min(6, Math.round(Math.hypot(m.a, m.b) * 4) / 4)); // pixels per unit, in quarter steps
  const lw = stroke ? ctx.lineWidth : 0;
  const key = `${stroke ? 1 : 0}|${ctx.font}|${style}|${lw}|${ctx.lineJoin}|${ctx.textAlign}|${ctx.textBaseline}|${ctx.direction}|${mw ?? ''}|${sc}|${s}`;
  let sp = CACHE.get(key);
  if (!sp) {
    if (!spriteBudget()) return native(s, x, y, mw);
    if (CACHE.size > MAX) CACHE.clear();
    if (!scratch) scratch = document.createElement('canvas').getContext('2d');
    const g = scratch;
    g.font = ctx.font; g.textAlign = ctx.textAlign; g.textBaseline = ctx.textBaseline; g.direction = ctx.direction;
    const mt = g.measureText(s);
    // (a maximum width squeezes the text about its anchor)
    const k = mw !== undefined && mw !== null && mt.width > mw ? mw / mt.width : 1, pad = 2 + lw;
    const left = -mt.actualBoundingBoxLeft * k - pad, right = mt.actualBoundingBoxRight * k + pad;
    const top = -mt.actualBoundingBoxAscent - pad, bot = mt.actualBoundingBoxDescent + pad;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil((right - left) * sc)); c.height = Math.max(1, Math.ceil((bot - top) * sc));
    const cg = c.getContext('2d');
    cg.scale(sc, sc); cg.translate(-left, -top);
    cg.font = ctx.font; cg.textAlign = ctx.textAlign; cg.textBaseline = ctx.textBaseline; cg.direction = ctx.direction;
    if (stroke) { cg.strokeStyle = style; cg.lineWidth = lw; cg.lineJoin = ctx.lineJoin; cg.miterLimit = ctx.miterLimit; cg.strokeText(s, 0, 0, mw ?? undefined); }
    else { cg.fillStyle = style; cg.fillText(s, 0, 0, mw ?? undefined); }
    sp = { c, left, top, w: c.width / sc, h: c.height / sc };
    CACHE.set(key, sp);
  }
  // (smooth: the image is at the canvas's own scale, but a turned or growing text must not look jagged)
  const sm = ctx.imageSmoothingEnabled;
  if (!sm) ctx.imageSmoothingEnabled = true;
  ctx.drawImage(sp.c, x + sp.left, y + sp.top, sp.w, sp.h);
  if (!sm) ctx.imageSmoothingEnabled = false;
}
