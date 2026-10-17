// Où passe le temps pendant un mini-jeu, carte graphique comprise : une trace Chrome (comme l'onglet Performance) prise
// pendant un jeu dans un vrai Chrome (même lancement que mgbench.mjs), puis résumée : par fil (page, GPU, compositeur),
// les tâches qui prennent le plus de temps par image.
//   node tools/dev/mgtrace.mjs <jeu> [port du serveur=8642]
// PRE='<js>' : évalué dans la page juste avant la trace (pour couper une partie du dessin et voir ce qu'elle coûte) ;
// SUMMARY=1 : seulement le total par image des tâches de dessin de la page et du GPU ;
// PHASE=outro : la trace prise à la fin du jeu (« EZ WIN », la télé qui remonte, le retour dans l'arène et la facture),
// avec en plus chaque tâche de plus de 8 ms, dans l'ordre (LONG=<ms> pour un autre seuil)
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [kind = 'slap', srv = '8642'] = process.argv.slice(2);
const CHROME = process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  : process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'google-chrome';
const port = 9700 + Math.floor(Math.random() * 200);
const prof = join(tmpdir(), `mgtrace-${port}`);
mkdirSync(prof, { recursive: true });
const proc = spawn(CHROME, [`--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--window-size=1280,720', '--window-position=-3000,0',
  '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
  '--mute-audio', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const done = (code) => { try { proc.kill(); } catch (e) { /* */ } try { rmSync(prof, { recursive: true, force: true }); } catch (e) { /* */ } process.exit(code); };
let ver = null;
for (let i = 0; i < 100 && !ver; i++) { try { ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch (e) { /* */ } await wait(200); }
if (!ver) { console.log('Chrome ne répond pas'); done(1); }
// the browser target (tracing covers every process), and the page target to drive the game
const bws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((r) => bws.addEventListener('open', r));
const pages = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).filter((p) => p.type === 'page');
const pws = new WebSocket(pages[0].webSocketDebuggerUrl);
await new Promise((r) => pws.addEventListener('open', r));
const mk = (ws) => { let id = 0; const pend = new Map(); const on = []; ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } else on.forEach((f) => f(m)); }); return { send: (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); }), on }; };
const B = mk(bws), Pg = mk(pws);
const evalJS = async (expr) => { const r = await Pg.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.result && r.result.result ? r.result.result.value : null; };
await Pg.send('Page.navigate', { url: `http://localhost:${srv}/?quick=1&chars=pandrezz,nymano,jsan,bido&humans=0&bot=2&hazards=0&stage=cemetery&mute=1` });
for (let i = 0; i < 120; i++) { if (await evalJS('!!(window.__app && __app.match && __app.match.W && __app.match.W.phase === "play")')) break; await wait(500); }
await wait(2000);
// the game, up to its play phase
await evalJS(`(() => { const W = __app.match.W; for (const F of W.list) F.stocks = 9; W.mgNextKind = ${JSON.stringify(kind)}; W.mgClock = W.mgNext - 330; return 1; })()`);
const PH = process.env.PHASE || 'play';
for (let i = 0; i < 200; i++) { if (await evalJS('!!(__app.match.W.mg && __app.match.W.mg.ph === "play" && __app.match.W.mg.t > 60)')) break; await wait(100); }
if (PH === 'outro') {
  // (le jeu avancé à ses dernières images, puis la trace dès « EZ WIN »)
  await evalJS('(() => { const M = __app.match.W.mg; if (M && M.ph === "play") M.t = Math.max(M.t, 570); return 1; })()');
  for (let i = 0; i < 400; i++) { if (await evalJS('!!(!__app.match.W.mg || __app.match.W.mg.ph === "outro")')) break; await wait(20); }
}
if (process.env.PRE) console.log('PRE', await evalJS(process.env.PRE));
const events = [];
B.on.push((m) => { if (m.method === 'Tracing.dataCollected') events.push(...m.params.value); });
const doneP = new Promise((r) => B.on.push((m) => { if (m.method === 'Tracing.tracingComplete') r(); }));
await B.send('Tracing.start', { traceConfig: { recordMode: 'recordAsMuchAsPossible', includedCategories: ['toplevel', 'devtools.timeline', 'disabled-by-default-devtools.timeline', 'gpu', 'viz', 'cc', 'blink', 'v8.execute'] }, transferMode: 'ReportEvents' });
await wait(4000);
await B.send('Tracing.end');
await doneP;
// threads
const tname = {};
for (const e of events) if (e.ph === 'M' && e.name === 'thread_name') tname[e.pid + ':' + e.tid] = e.args.name;
const pname = {};
for (const e of events) if (e.ph === 'M' && e.name === 'process_name') pname[e.pid] = e.args.name;
// frames seen: the page's main thread animation frames
const frames = events.filter((e) => e.name === 'FireAnimationFrame' && e.ph === 'X').length || 1;
const by = {};
for (const e of events) {
  if (e.ph !== 'X' || !e.dur) continue;
  const th = (pname[e.pid] || e.pid) + ' / ' + (tname[e.pid + ':' + e.tid] || e.tid);
  const k = th + ' :: ' + e.name;
  const b = by[k] || (by[k] = { n: 0, dur: 0, max: 0 });
  b.n++; b.dur += e.dur / 1000; b.max = Math.max(b.max, e.dur / 1000);
}
console.log(`${kind}: 4 s de jeu, ${frames} images d'animation`);
if (process.env.SUMMARY) {
  const pick = (re) => Object.entries(by).filter(([k]) => re.test(k)).reduce((a, [, b]) => a + b.dur, 0) / frames;
  console.log('commit (page)', pick(/CrRendererMain :: Commit$/).toFixed(2), 'ms/img   raster (page)', pick(/CrRendererMain :: RasterImplementation::RasterCHROMIUM$/).toFixed(2), '   GPU', pick(/CrGpuMain :: GPUTask$/).toFixed(2), '   rAF', pick(/CrRendererMain :: FireAnimationFrame$/).toFixed(2));
  done(0);
}
const rows = Object.entries(by).filter(([k]) => !/ThreadControllerImpl|RunTask$|MessageLoop|TaskQueue/.test(k)).sort((a, b) => b[1].dur - a[1].dur).slice(0, 40);
for (const [k, b] of rows) console.log(`${(b.dur / frames).toFixed(2).padStart(7)} ms/img  max ${b.max.toFixed(1).padStart(6)}  x${String(b.n).padStart(5)}  ${k}`);
if (PH !== 'play' || process.env.LONG) {
  const lim = Number(process.env.LONG || 8) * 1000, t0 = Math.min(...events.filter((e) => e.ts).map((e) => e.ts));
  console.log(`
== tâches de plus de ${lim / 1000} ms`);
  for (const e of events.filter((e) => e.ph === 'X' && e.dur > lim && !/ThreadControllerImpl|RunTask$|MessageLoop|TaskQueue|ThreadPool_RunTask/.test(e.name)).sort((a, b) => a.ts - b.ts))
    console.log(`${((e.ts - t0) / 1000).toFixed(0).padStart(6)} ms  ${(e.dur / 1000).toFixed(1).padStart(6)} ms  ${(pname[e.pid] || e.pid)} / ${tname[e.pid + ':' + e.tid] || e.tid} :: ${e.name}${e.args && e.args.data && e.args.data.functionName ? ' ' + e.args.data.functionName : ''}`);
}
done(0);
