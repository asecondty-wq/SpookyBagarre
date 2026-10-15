// Regarde un ulti sans fenêtre : un Chrome headless joue un match CPU contre CPU, lance l'ulti, et enregistre une image
// toutes les `every` images (à 30 par seconde) avec tools/dev/ulticlip.js. Le serveur (tools/serve.py, port 8642) doit
// tourner ; les images vont dans tools/dev/shots/<nom>_0001.png ... (non publié), les erreurs de la page s'affichent.
//   node tools/dev/ultishot.mjs <jeu> [every=30] [port=9333] [nom=s_<jeu>] [persos=pandrezz,nymano]
// HUMANS=2 : les deux duellistes sont des joueurs (Clavier 1 et Clavier 2, sans rien toucher), pour voir leurs touches.
// Plusieurs à la fois : un port différent chacun. Vidéo : every=1, puis ffmpeg (voir ulticlip.js).
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [kind, every = '30', port = '9333', name, chars = 'pandrezz,nymano'] = process.argv.slice(2);
if (!kind) { console.log('node tools/dev/ultishot.mjs <jeu> [every] [port] [nom] [persos]'); process.exit(1); }
const CHROME = process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : 'google-chrome';
const prof = join(tmpdir(), `ultishot-${port}`);
mkdirSync(prof, { recursive: true });
const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--window-size=960,540',
  '--mute-audio', '--no-first-run', '--no-default-browser-check', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore' });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const done = (code) => { try { proc.kill(); } catch (e) { /* */ } try { rmSync(prof, { recursive: true, force: true }); } catch (e) { /* */ } process.exit(code); };

let pages = [];
for (let i = 0; i < 80 && !pages.length; i++) { try { pages = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).filter((p) => p.type === 'page'); } catch (e) { /* pas encore */ } await wait(200); }
if (!pages.length) { console.log('Chrome ne répond pas'); done(1); }
const ws = new WebSocket(pages[0].webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pending = new Map(); const errors = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 960, height: 540, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: `http://localhost:8642/?quick=1&chars=${chars}&humans=${+(process.env.HUMANS || 0)}&bot=2&hazards=0&stage=cemetery&mute=1` });
await wait(1500);
const out = `${name || 's_' + kind}`;
const r = await send('Runtime.evaluate', {
  awaitPromise: true, returnByValue: true, expression: `(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    for (let i = 0; i < 300 && !(window.__app && __app.match && __app.match.W.phase === 'play'); i++) await wait(100);
    await wait(1200);
    const C = await import('/tools/dev/ulticlip.js');
    const s = await C.record(${JSON.stringify(kind)}, ${JSON.stringify(out)}, { tail: 3, every: ${+every} });
    const W = __app.match.W;
    return { frames: s.frame, err: s.err, res: (W.lastMgRes || null) };
  })()`,
});
const v = r.result && r.result.result ? r.result.result.value : r;
console.log(`${kind} : ${v && v.frames} images (une sur ${every} gardée) -> tools/dev/shots/${out}_NNNN.png`);
if (v && v.err) console.log('ERREUR : ' + v.err);
const real = errors.filter((e) => !/assets\/music\/.*\.(mp3|ogg)|404/.test(String(e)));
console.log(real.length ? 'erreurs de la page :\n  ' + real.slice(0, 10).join('\n  ') : 'aucune erreur de la page');
ws.close();
done(v && !v.err && !real.length ? 0 : 1);
