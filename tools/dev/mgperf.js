// Mesure des ralentissements des mini-jeux, dans le vrai navigateur (fenêtre visible : sinon les images sont
// ralenties par le navigateur). Coller dans la console d'un match CPU :
//   ?quick=1&chars=pandrezz,nymano,jsan,bido&humans=0&bot=2&hazards=0&stage=cemetery&mute=1
//   const P = (await import('/tools/dev/mgperf.js')); P.start(['candy', 'fps:0']);  ...  P.report()
// Chaque image : le temps du JS (et l'écart entre deux images), et pour les images lentes le détail par fonction
// (méthodes de la vue des mini-jeux, rendu, simulation, filtre de la télé, jeux de src/render/mg/).
export const acc = {}, log = [], all = [];
export const state = { prog: [], done: false };
function T(o, n, tag) {
  const f = o[n]; if (typeof f !== 'function' || f.__w) return;
  const g = function (...a) { const t = performance.now(); try { return f.apply(this, a); } finally { acc[tag] = (acc[tag] || 0) + performance.now() - t; } };
  g.__w = 1; o[n] = g;
}
export async function install() {
  const app = window.__app, view = app.match.view, mv = view.mgView, R = app.renderer, W = app.match.W;
  const P = Object.getPrototypeOf(mv);
  for (const n of Object.getOwnPropertyNames(P)) { const d = Object.getOwnPropertyDescriptor(P, n); if (typeof d.value === 'function' && n !== 'constructor') T(mv, n, 'mv.' + n); }
  T(R, 'render', 'R.render'); T(view, 'render', 'view.render'); T(view, 'onTick', 'view.onTick'); T(W, 'advance', 'W.advance');
  if (mv.crt) T(mv.crt, 'run', 'crt.run');
  if (view.fx) T(view.fx, 'onTick', 'fx.onTick');
  const { EXTRA_VIEWS } = await import('/src/render/mg/index.js');
  for (const [k, X] of Object.entries(EXTRA_VIEWS)) for (const n of ['draw', 'enter3D', 'exit3D', 'warm', 'frame', 'update']) T(X, n, 'X.' + k + '.' + n);
  let last = performance.now();
  const fr = app.frame;
  app.frame = function (t) {
    for (const k in acc) acc[k] = 0;
    const a = performance.now(); const r = fr.call(this, t); const js = performance.now() - a, gap = a - last; last = a;
    const M = W.mg, ph = M ? M.kind + ':' + M.ph + ':' + Math.round(M.t) : W.mgResume ? 'resume:' + W.mgResume.t : (W.mgNextKind && W.mgNext - W.mgClock < 330 ? 'cd:' + Math.round(W.mgNext - W.mgClock) : 'fight');
    all.push([ph, js, gap]);
    if (js > 18 || gap > 34) log.push({ ph, js: Math.round(js), gap: Math.round(gap), top: Object.entries(acc).filter((e) => e[1] > 1.5).sort((x, y) => y[1] - x[1]).slice(0, 7).map(([k, v]) => k + ' ' + v.toFixed(1)).join(', ') });
    return r;
  };
}
export async function start(kinds) {
  await install();
  const W = window.__app.match.W;
  setInterval(() => { for (const F of W.list) { if (F.stocks < 3) F.stocks = 3; } }, 500);
  for (const k of kinds) {
    while (W.mg || W.mgResume) await new Promise((r) => setTimeout(r, 100));
    for (const F of W.list) F.damage = 0;
    await new Promise((r) => setTimeout(r, 1500));
    W.mgNextKind = k; W.mgClock = W.mgNext - 330;
    const t0 = performance.now();
    while (!W.mg && performance.now() - t0 < 9000) await new Promise((r) => setTimeout(r, 50));
    while ((W.mg || W.mgResume) && performance.now() - t0 < 40000) await new Promise((r) => setTimeout(r, 100));
    await new Promise((r) => setTimeout(r, 2500));
    state.prog.push(k);
  }
  state.done = true;
}
// moyenne et pire image par jeu et par phase
export function report() {
  const by = {};
  for (const [ph, js, gap] of all) {
    const p = ph.split(':'), key = p[0] === 'cd' || p[0] === 'fight' || p[0] === 'resume' ? p[0] : p[0] + ':' + p[1];
    const b = by[key] || (by[key] = { n: 0, js: 0, max: 0, gmax: 0, slow: 0 });
    b.n++; b.js += js; b.max = Math.max(b.max, js); b.gmax = Math.max(b.gmax, gap); if (gap > 20) b.slow++;
  }
  return Object.entries(by).map(([k, b]) => `${k.padEnd(18)} ${String(b.n).padStart(5)} img  js moy ${(b.js / b.n).toFixed(1).padStart(5)}  max ${b.max.toFixed(0).padStart(4)}  écart max ${b.gmax.toFixed(0).padStart(4)}  lentes ${b.slow}`).join('\n');
}
