// The player's own music files, in assets/music/:
//   menu.mp3                         played in the menus
//   combat1.ogg, combat2.ogg, ...    one of them, at random, for each fight (battle1.ogg, battle2.ogg... too)
// Missing files are fine: the built-in procedural music plays instead. The folder cannot be listed on a static
// host (GitHub Pages), so the combat tracks are found by asking for combat1, combat2... until one is missing.
const DIR = 'assets/music/';
const MAX_COMBAT = 40;

async function exists(url) {
  try {
    const r = await fetch(url, { method: 'HEAD', cache: 'no-cache' });
    if (r.ok) return true;
    if (r.status === 405 || r.status === 501) { // a server without HEAD
      const g = await fetch(url, { headers: { Range: 'bytes=0-1' }, cache: 'no-cache' });
      return g.ok;
    }
  } catch (e) { /* offline / blocked */ }
  return false;
}

// named tracks, all optional (a missing one falls back on menu.ogg or a random fight):
//   titre (title screen), persos (character and arena select), victoire (fanfare at the end of a match, once), bar (the bar),
//   resultats (results), options, salon (online lobby), finale (last stock or last 30 s), go (3-2-1, once),
//   combat_<arena id> (that arena's own fight music: combat_cemetery, combat_swamp...)
export const NAMED = ['titre', 'persos', 'victoire', 'resultats', 'options', 'salon', 'finale', 'go', 'bar',
  ...['cemetery', 'swamp', 'elysee', 'diner', 'cave', 'arena', 'village', 'sea', 'attic', 'mirror'].map((s) => 'combat_' + s)];

// the formats this browser plays, best first: Safari often cannot play .ogg (Vorbis), then only the .mp3 count
function formats() {
  let ogg = false;
  try { ogg = !!new window.Audio().canPlayType('audio/ogg; codecs="vorbis"'); } catch (e) { /* */ }
  return ogg ? ['ogg', 'mp3'] : ['mp3'];
}

// the first file of that name in a playable format (one request when it is there)
async function findFile(name, fmts) {
  for (const f of fmts) if (await exists(DIR + name + '.' + f)) return DIR + name + '.' + f;
  return null;
}

export function probeTracks() {
  const found = { menu: null, combat: [], named: {} };
  const fmts = formats();
  const ready = (async () => {
    found.menu = await findFile('menu', fmts);
    const urls = await Promise.all(NAMED.map((n) => findFile(n, fmts)));
    NAMED.forEach((n, i) => { if (urls[i]) found.named[n] = urls[i]; });
    for (const base of ['combat', 'battle']) {
      for (let i = 1; i <= MAX_COMBAT; i++) {
        const url = await findFile(base + i, fmts);
        if (!url) break;
        found.combat.push(url);
      }
    }
    return found;
  })();
  found.ready = ready;
  return found;
}

// one music file at a time, looped, through the music bus (so the music volume applies), with short fades
export class FilePlayer {
  constructor(ctx, out) {
    this.ctx = ctx;
    this.out = out;
    this.cur = null; // { url, el, gain }
  }

  playing(url) { return !!(this.cur && this.cur.url === url); }

  // once: play it a single time, then call `then` (a fanfare before the results music)
  play(url, once = false, then = null) {
    if (this.playing(url)) return;
    this.stop(0.5);
    const el = new window.Audio();
    el.src = url;
    el.loop = !once;
    if (once && then) el.onended = () => { if (this.cur && this.cur.el === el) then(); };
    el.preload = 'auto';
    const src = this.ctx.createMediaElementSource(el);
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + 0.8);
    src.connect(gain).connect(this.out);
    const cur = { url, el, gain, src };
    this.cur = cur;
    const start = () => el.play().catch(() => { cur.retry = true; });
    start();
  }

  // a play() refused before the first click: try again once the page may play sound
  resume() { if (this.cur && this.cur.retry) { this.cur.retry = false; this.cur.el.play().catch(() => { this.cur.retry = true; }); } }

  stop(fade = 0.6) {
    const c = this.cur;
    if (!c) return;
    this.cur = null;
    const now = this.ctx.currentTime;
    c.gain.gain.cancelScheduledValues(now);
    c.gain.gain.setValueAtTime(c.gain.gain.value, now);
    c.gain.gain.linearRampToValueAtTime(0, now + fade);
    setTimeout(() => { try { c.el.pause(); c.el.src = ''; c.src.disconnect(); c.gain.disconnect(); } catch (e) { /* */ } }, (fade + 0.2) * 1000);
  }
}
