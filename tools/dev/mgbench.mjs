// Banc de mesure des mini-jeux, sans y toucher : un vrai Chrome (avec la carte graphique, fenêtre hors de l'écran, sans
// le ralentissement des fenêtres cachées) joue un match CPU, lance chaque mini-jeu à la suite avec tools/dev/mgperf.js,
// et écrit le bilan (temps JS moyen et pire image par jeu et par phase, détail par fonction des images lentes).
// Le serveur (tools/serve.py) doit tourner.
//   node tools/dev/mgbench.mjs [jeux séparés par des virgules | all] [port du serveur=8642] [nom=mgbench]
// -> tools/dev/shots/<nom>.txt (non publié)
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [list = 'all', srv = '8642', name = 'mgbench'] = process.argv.slice(2);
const ALL = ['fps:0', 'fps:3', 'fps:6', 'candy', 'horses', 'moral', 'dance', 'surgery', 'slap', 'frisbee', 'coins', 'lol', 'dog', 'climb', 'bullet',
  'mediator', 'tvbreak', 'toilets', 'tap', 'chess', 'walk', 'nolaugh', 'tetris', 'dumbbell', 'trials', 'window', 'chicken', 'homerun', 'birds',
  'papers', 'dating', 'vape', 'math', 'macron', 'breakout', 'aura'];
const kinds = list === 'all' ? ALL : list.split(',');
const CHROME = process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  : process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'google-chrome';
const port = 9400 + Math.floor(Math.random() * 300);
const prof = join(tmpdir(), `mgbench-${port}`);
mkdirSync(prof, { recursive: true });
const proc = spawn(CHROME, [`--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--window-size=1280,720', '--window-position=-3000,0',
  '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
  '--mute-audio', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const done = (code) => { try { proc.kill(); } catch (e) { /* */ } try { rmSync(prof, { recursive: true, force: true }); } catch (e) { /* */ } process.exit(code); };

let pages = [];
for (let i = 0; i < 100 && !pages.length; i++) { try { pages = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).filter((p) => p.type === 'page'); } catch (e) { /* pas encore */ } await wait(200); }
if (!pages.length) { console.log('Chrome ne répond pas'); done(1); }
const ws = new WebSocket(pages[0].webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pending = new Map(); const errors = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evalJS = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.result && r.result.result ? r.result.result.value : r; };
await send('Runtime.enable');
await send('Page.navigate', { url: `http://localhost:${srv}/?quick=1&chars=pandrezz,nymano,jsan,bido&humans=0&bot=2&hazards=0&stage=cemetery&mute=1` });
for (let i = 0; i < 120; i++) { if (await evalJS('!!(window.__app && __app.match && __app.match.W && __app.match.W.phase === "play")')) break; await wait(500); }
await evalJS(`(async () => { window.__P = await import('/tools/dev/mgperf.js'); __P.start(${JSON.stringify(kinds)}); return 1; })()`);
const t0 = Date.now();
let last = -1;
while (true) {
  const s = await evalJS('JSON.stringify({ n: __P.state.prog.length, done: __P.state.done })');
  const { n, done: fin } = JSON.parse(s || '{}');
  if (n !== last) { console.log(`${n}/${kinds.length} ${kinds[n - 1] || ''}  ${Math.round((Date.now() - t0) / 1000)} s`); last = n; }
  if (fin || Date.now() - t0 > kinds.length * 60000) break;
  await wait(2000);
}
const report = await evalJS('__P.report()');
const slow = await evalJS('JSON.stringify(__P.log.slice(-400))');
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'shots', name + '.txt');
mkdirSync(join(here, 'shots'), { recursive: true });
writeFileSync(out, report + '\n\n== images lentes (js > 18 ms ou écart > 34 ms)\n' + JSON.parse(slow || '[]').map((l) => `${l.ph.padEnd(22)} js ${String(l.js).padStart(4)}  écart ${String(l.gap).padStart(4)}  ${l.top}`).join('\n') + '\n\n== erreurs\n' + errors.join('\n'));
console.log(report);
console.log('->', out, errors.length ? `(${errors.length} erreurs)` : '');
done(0);
