// First-use freezes: plays every move of a fighter once, next to the other one (so the blows land), and lists the
// frames slower than `ms` and the shader programs compiled meanwhile (MatchView.prewarm should leave none).
//   in a quick match: const P = await import('/tools/dev/posecheck.js'); await P.ready();
//   const H = await import('/tools/dev/hitchcheck.js'); H.run(P, 0)        // or H.run(P, 0, ['sp_n', 'sp_s'])
import { CHARS } from '/src/sim/chars/index.js';
import { startMove } from '/src/sim/fighter.js';

export function run(P, slot, moves, ms = 30, frames = 90) {
  const w = P.W(), F = w.fighters[slot], gl = __app.renderer.gl, rows = [];
  for (const mv of moves || Object.keys(CHARS[F.char].moves)) {
    for (const X of w.fighters) {
      if (X.stocks !== undefined) X.stocks = Math.max(X.stocks, 3);
      X.y = 0; X.vx = X.vy = 0; X.damage = 0; X.state = 'idle';
      X.x = X === F ? 0 : 1.6 * Math.sign(Math.sin(F.facing) || 1);
    }
    window.__vpads[0].buttons = {};
    P.stepN(20);
    const p0 = gl.info.programs.length;
    let worst = 0, at = -1;
    try { startMove(F, w, mv); } catch (err) { rows.push({ mv, error: String(err) }); continue; }
    for (let i = 0; i < frames; i++) {
      const t = performance.now();
      P.stepN(1);
      const d = performance.now() - t;
      if (d > worst) { worst = d; at = i; }
    }
    const programs = gl.info.programs.length - p0;
    if (worst > ms || programs) rows.push({ mv, worst: +worst.toFixed(1), frame: at, programs });
  }
  return rows;
}
