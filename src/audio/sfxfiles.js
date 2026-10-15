// Your own sound effects, in assets/sfx/ (see assets/sfx/README.md):
//   hitS.ogg, hitM.ogg, jump.ogg ...   one file per sound, named like the sound (the names are listed below)
// A sound that has a file there is played from that file instead of the built-in synthesised one. A missing file is
// fine: nothing changes for that sound. The folder cannot be listed on a static host (GitHub Pages), so each name is
// asked for in turn (ogg first, then mp3, then wav), like the music files in tracks.js.
const DIR = 'assets/sfx/';

// the sounds that can be replaced by a file (names of the sounds in audio.js); add a name here to open another one
export const SFX_FILES = [
  // blows
  'hitS', 'hitM', 'hitL', 'punchHeavy', 'slap', 'whoosh', 'pummel',
  // defence, grabs, KO
  'shield', 'parry', 'grab', 'tech', 'ko', 'glass',
  // movement
  'jump', 'jump2', 'land', 'thud', 'slip', 'ledge', 'respawn',
  // menus, countdown, match
  'click', 'menuMove', 'menuOk', 'menuBack', 'countHi', 'countGo', 'game', 'crowd',
  // general
  'boom', 'quake', 'charge', 'flash', 'poof',
];

// the formats this browser plays, best first: Safari often cannot play .ogg (Vorbis), then only mp3 and wav count
function formats() {
  let ogg = false;
  try { ogg = !!new window.Audio().canPlayType('audio/ogg; codecs="vorbis"'); } catch (e) { /* */ }
  return ogg ? ['ogg', 'mp3', 'wav'] : ['mp3', 'wav'];
}

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

// { name: url } for every sound that has a file
export function probeSfx(names = SFX_FILES) {
  const fmts = formats();
  return Promise.all(names.map(async (name) => {
    for (const f of fmts) {
      const url = DIR + name + '.' + f;
      if (await exists(url)) return [name, url];
    }
    return null;
  })).then((list) => Object.fromEntries(list.filter(Boolean)));
}

// decodes the files found: { name: AudioBuffer }. A file that cannot be read is left out (the synthesised sound stays)
export async function loadSfx(ctx, urls) {
  const out = {};
  await Promise.all(Object.entries(urls).map(async ([name, url]) => {
    try {
      const r = await fetch(url);
      if (!r.ok) return;
      out[name] = await ctx.decodeAudioData(await r.arrayBuffer());
    } catch (e) { console.warn('[SpookyBagarre] son illisible :', url, e && e.message); }
  }));
  return out;
}
