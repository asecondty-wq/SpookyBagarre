// Player settings kept in this browser (localStorage).
const KEY = 'spookybagarre.settings.v1';

export const DEFAULTS = {
  name: '',
  blood: 3,            // 0 none, 1 ketchup, 2 lots, 3 À FOISON
  commentator: true,   // the zany voice on big hits and KOs
  look: 'smooth',      // 'smooth' (lisse, défaut) or 'retro' (N64)
  retro: 540,          // internal render height in retro look (0 = native)
  volume: { master: 0.8, music: 0.55, sfx: 0.9, voice: 1 },
  stocks: 3,
  time: 180,
  mode: 'stock',
  hazards: true,
  cpuLevel: 2,
  rumble: true,
  tapJump: true,       // the stick flicked up jumps (Smash)
  shake: 1,
};

export function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { ...DEFAULTS, ...s, volume: { ...DEFAULTS.volume, ...(s.volume || {}) } };
  } catch (e) { return { ...DEFAULTS }; }
}

export function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* private mode */ }
}
