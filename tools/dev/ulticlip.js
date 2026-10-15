// Enregistre un ulti (src/sim/minigames.js) image par image, pour en faire une vidéo : la boucle du jeu est figée, la
// simulation avance de 1/30 s par image, la 3D et le canevas des ultis sont assemblés puis envoyés au serveur
// (tools/serve.py les écrit dans tools/dev/shots/<nom>_0001.png ..., non publié). Sans le son.
// Dans la console d'un match CPU contre CPU (par ex. ?quick=1&chars=pprod,jsan&humans=0&mute=1&hazards=0), fenêtre en 960x540 :
//   const C = await import('/tools/dev/ulticlip.js'); C.record('fps', 'v_fps');   // puis attendre C.state.done
// Assembler ensuite : ffmpeg -framerate 30 -i tools/dev/shots/v_fps_%04d.png -pix_fmt yuv420p v_fps.mp4
export const state = { frame: 0, done: false, err: null };

export async function record(kind, name, { fps = 30, tail = 0.6, w = 960, h = 540, every = 1 } = {}) {
  const app = window.__app, R = app.renderer, W = app.match.W;
  const mg = await import('/src/sim/minigames.js');
  const { Input } = await import('/src/core/input.js');
  Object.assign(state, { frame: 0, done: false, err: null });
  // la boucle normale ne fait plus rien : c'est nous qui avançons et dessinons
  const realRender = R.render.bind(R);
  let mine = false;
  R.render = () => { if (mine) realRender(); };
  const realUpdate = app.safeUpdate;
  app.safeUpdate = () => {};
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const g = out.getContext('2d');
  const overlay = () => document.querySelector('canvas.mg-overlay');
  const shot = async () => {
    mine = true; R.update(1 / fps); R.render(); mine = false;
    g.drawImage(R.gl.domElement, 0, 0, w, h);
    const o = overlay();
    if (o) g.drawImage(o, 0, 0, w, h);
    state.frame++;
    if ((state.frame - 1) % every) return; // every : une image sur `every` seulement (tools/dev/ultishot.mjs)
    const blob = await new Promise((res) => out.toBlob(res, 'image/png'));
    await fetch(`/__shot/${name}_${String(state.frame).padStart(4, '0')}.png`, { method: 'POST', body: blob });
  };
  const step = (n) => { for (let i = 0; i < n; i++) { Input.poll(); app.screen.update(1 / 60); } };
  try {
    while (W.phase !== 'play' || W.mg) step(1);
    W.list.forEach((F) => { F.meter = 0; });
    mg.startMinigame(W, 0, 1, kind);
    const per = Math.round(60 / fps);
    let after = -1;
    while (after < 0 || after > 0) {
      step(per);
      await shot();
      if (!W.mg && after < 0) after = Math.round(tail * fps);
      else if (after > 0) after--;
    }
  } catch (e) { state.err = String(e && e.stack || e); }
  R.render = realRender;
  app.safeUpdate = realUpdate;
  state.done = true;
  return state;
}
