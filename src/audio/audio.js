// Audio: every sound effect is synthesised once into a buffer (no samples to download), played with random pitch,
// stereo pan, and a bus compressor. The announcer uses the browser's speech synthesis, pitched down.
import { Music } from './music.js';

const SR = 44100;

// --- tiny offline synth ---------------------------------------------------------------------------------------------
function biquad(type, f, q, sr = SR) {
  const w = (2 * Math.PI * f) / sr, c = Math.cos(w), s = Math.sin(w), a = s / (2 * q);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; a0 = 1 + a; a1 = -2 * c; a2 = 1 - a; }
  else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; a0 = 1 + a; a1 = -2 * c; a2 = 1 - a; }
  else { b0 = a; b1 = 0; b2 = -a; a0 = 1 + a; a1 = -2 * c; a2 = 1 - a; }
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0, x1: 0, x2: 0, y1: 0, y2: 0 };
}
function runBq(q, x) {
  const y = q.b0 * x + q.b1 * q.x1 + q.b2 * q.x2 - q.a1 * q.y1 - q.a2 * q.y2;
  q.x2 = q.x1; q.x1 = x; q.y2 = q.y1; q.y1 = y;
  return y;
}

// layer: { w: 'noise'|'sine'|'square'|'saw'|'tri', f:[f0,f1], d: seconds, a: attack, curve: decay power, g: gain,
//          flt: { t:'lp'|'hp'|'bp', f:[f0,f1], q }, dist, start, vib:[rate, depth], am:[rate, depth], seed }
function render(ctx, layers) {
  let len = 0;
  for (const L of layers) len = Math.max(len, (L.start || 0) + L.d);
  const n = Math.ceil((len + 0.02) * SR);
  const buf = ctx.createBuffer(1, n, SR);
  const out = buf.getChannelData(0);
  for (const L of layers) {
    const s0 = Math.floor((L.start || 0) * SR), ns = Math.floor(L.d * SR);
    let ph = 0, seed = L.seed || 12345;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 * 2 - 1; };
    const f0 = L.f ? L.f[0] : 440, f1 = L.f ? L.f[1] ?? f0 : f0;
    const flt = L.flt ? biquad(L.flt.t, L.flt.f[0], L.flt.q || 1) : null;
    let brown = 0;
    for (let i = 0; i < ns; i++) {
      const t = i / ns;
      const f = f0 * Math.pow(f1 / f0, t) * (L.vib ? 1 + Math.sin((i / SR) * L.vib[0] * 6.283) * L.vib[1] : 1);
      ph += f / SR;
      let v;
      switch (L.w) {
        case 'noise': v = rnd(); break;
        case 'brown': brown = (brown + rnd() * 0.12) * 0.985; v = brown * 3; break;
        case 'square': v = (ph % 1) < 0.5 ? 1 : -1; break;
        case 'saw': v = 2 * (ph % 1) - 1; break;
        case 'tri': v = 4 * Math.abs((ph % 1) - 0.5) - 1; break;
        default: v = Math.sin(ph * 6.283);
      }
      if (flt) {
        if (L.flt.f[1] && i % 64 === 0) { const ff = L.flt.f[0] * Math.pow(L.flt.f[1] / L.flt.f[0], t); Object.assign(flt, (({ b0, b1, b2, a1, a2 }) => ({ b0, b1, b2, a1, a2 }))(biquad(L.flt.t, ff, L.flt.q || 1))); }
        v = runBq(flt, v);
      }
      const att = L.a ? Math.min(1, i / (L.a * SR)) : 1;
      let env = att * Math.pow(1 - t, L.curve ?? 2);
      if (L.am) env *= 1 - L.am[1] * (0.5 + 0.5 * Math.sin((i / SR) * L.am[0] * 6.283));
      v *= env * (L.g ?? 0.5);
      if (L.dist) v = Math.tanh(v * L.dist) / Math.tanh(L.dist);
      out[s0 + i] += v;
    }
  }
  // normalise peaks
  let pk = 0;
  for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(out[i]));
  if (pk > 0.98) for (let i = 0; i < n; i++) out[i] *= 0.98 / pk;
  return buf;
}

const S = {
  hitS: [{ w: 'noise', d: 0.05, g: 0.6, flt: { t: 'bp', f: [2400], q: 0.8 } }, { w: 'sine', f: [180, 60], d: 0.08, g: 0.8 }],
  hitM: [{ w: 'noise', d: 0.07, g: 0.7, flt: { t: 'bp', f: [1800, 600], q: 0.7 }, dist: 2 }, { w: 'sine', f: [140, 45], d: 0.14, g: 1, dist: 1.5 }],
  hitL: [{ w: 'noise', d: 0.12, g: 0.9, flt: { t: 'lp', f: [5000, 400], q: 0.7 }, dist: 3 }, { w: 'sine', f: [110, 32], d: 0.32, g: 1.1, dist: 2.5 }, { w: 'noise', d: 0.03, g: 0.7, flt: { t: 'hp', f: [3000] } }],
  punchHeavy: [{ w: 'sine', f: [95, 30], d: 0.38, g: 1.2, dist: 3 }, { w: 'noise', d: 0.15, g: 0.8, flt: { t: 'lp', f: [3000, 300] }, dist: 3 }],
  slap: [{ w: 'noise', d: 0.045, g: 0.9, flt: { t: 'bp', f: [3200], q: 1.2 }, curve: 3 }, { w: 'sine', f: [300, 120], d: 0.05, g: 0.4 }],
  briefcase: [{ w: 'square', f: [220, 90], d: 0.12, g: 0.4, flt: { t: 'lp', f: [1600] } }, { w: 'sine', f: [120, 40], d: 0.25, g: 1, dist: 2 }, { w: 'noise', d: 0.06, g: 0.6, flt: { t: 'bp', f: [1200] } }],
  splat: [{ w: 'noise', d: 0.22, g: 0.9, flt: { t: 'lp', f: [2500, 200], q: 2 }, am: [30, 0.5] }, { w: 'sine', f: [200, 60], d: 0.12, g: 0.5 }],
  splatter: [{ w: 'noise', d: 0.45, g: 1, flt: { t: 'lp', f: [3000, 150], q: 3 }, am: [22, 0.6] }, { w: 'noise', d: 0.2, g: 0.6, start: 0.08, flt: { t: 'bp', f: [800] }, am: [40, 0.8] }, { w: 'sine', f: [90, 30], d: 0.3, g: 0.8, dist: 2 }],
  whoosh: [{ w: 'noise', d: 0.22, g: 0.45, a: 0.08, curve: 1.5, flt: { t: 'bp', f: [400, 2200], q: 1.5 } }],
  jump: [{ w: 'square', f: [180, 520], d: 0.09, g: 0.18, flt: { t: 'lp', f: [3000] } }],
  jump2: [{ w: 'square', f: [300, 820], d: 0.1, g: 0.16, flt: { t: 'lp', f: [3500] } }, { w: 'noise', d: 0.1, g: 0.15, flt: { t: 'bp', f: [3000] } }],
  land: [{ w: 'noise', d: 0.06, g: 0.4, flt: { t: 'lp', f: [700] } }, { w: 'sine', f: [120, 60], d: 0.06, g: 0.4 }],
  thud: [{ w: 'sine', f: [90, 35], d: 0.25, g: 1, dist: 2 }, { w: 'noise', d: 0.12, g: 0.7, flt: { t: 'lp', f: [900, 200] } }],
  shield: [{ w: 'sine', f: [1200], d: 0.25, g: 0.4, curve: 3 }, { w: 'sine', f: [1820], d: 0.18, g: 0.25, curve: 3 }, { w: 'noise', d: 0.03, g: 0.3, flt: { t: 'hp', f: [4000] } }],
  parry: [{ w: 'sine', f: [1600, 2400], d: 0.4, g: 0.45, curve: 2 }, { w: 'sine', f: [2400, 3600], d: 0.3, g: 0.3 }, { w: 'tri', f: [800, 1600], d: 0.2, g: 0.3 }],
  glass: [{ w: 'noise', d: 0.5, g: 0.8, flt: { t: 'hp', f: [2500] }, am: [60, 0.7] }, { w: 'sine', f: [2600, 1800], d: 0.4, g: 0.25 }, { w: 'sine', f: [3400, 2900], d: 0.3, g: 0.2 }],
  ko: [{ w: 'noise', d: 1.4, g: 1, flt: { t: 'lp', f: [4000, 120], q: 0.8 }, dist: 3, curve: 1.6 }, { w: 'sine', f: [80, 22], d: 1.2, g: 1.2, dist: 3 }, { w: 'noise', d: 0.6, g: 0.5, start: 0.05, flt: { t: 'bp', f: [500] }, am: [18, 0.7] }],
  tung: [{ w: 'sine', f: [620, 560], d: 0.22, g: 0.8, curve: 4 }, { w: 'sine', f: [1240], d: 0.08, g: 0.3, curve: 4 }, { w: 'noise', d: 0.015, g: 0.5, flt: { t: 'bp', f: [2500] } }],
  tungL: [{ w: 'sine', f: [480, 400], d: 0.32, g: 1, curve: 3, dist: 1.5 }, { w: 'sine', f: [960], d: 0.12, g: 0.3 }, { w: 'noise', d: 0.03, g: 0.6, flt: { t: 'bp', f: [1800] } }, { w: 'sine', f: [100, 40], d: 0.2, g: 0.8 }],
  wood: [{ w: 'sine', f: [800, 700], d: 0.08, g: 0.6, curve: 4 }, { w: 'noise', d: 0.02, g: 0.5, flt: { t: 'bp', f: [2000] } }, { w: 'sine', f: [150, 70], d: 0.07, g: 0.6 }],
  woodM: [{ w: 'sine', f: [600, 500], d: 0.14, g: 0.8, curve: 4 }, { w: 'noise', d: 0.03, g: 0.6, flt: { t: 'bp', f: [1600] } }, { w: 'sine', f: [130, 50], d: 0.12, g: 0.8, dist: 1.5 }],
  woodL: [{ w: 'sine', f: [440, 360], d: 0.25, g: 1, curve: 3 }, { w: 'noise', d: 0.05, g: 0.7, flt: { t: 'bp', f: [1200] } }, { w: 'sine', f: [110, 35], d: 0.25, g: 1, dist: 2 }],
  zap: [{ w: 'saw', f: [180, 90], d: 0.2, g: 0.35, vib: [70, 0.3], flt: { t: 'lp', f: [3500] }, dist: 2 }, { w: 'noise', d: 0.15, g: 0.4, flt: { t: 'hp', f: [2000] }, am: [80, 0.8] }],
  zapS: [{ w: 'saw', f: [260, 160], d: 0.08, g: 0.3, vib: [90, 0.3], dist: 2 }, { w: 'noise', d: 0.05, g: 0.4, flt: { t: 'bp', f: [3000] } }],
  zapL: [{ w: 'saw', f: [140, 60], d: 0.35, g: 0.5, vib: [60, 0.4], dist: 3 }, { w: 'noise', d: 0.25, g: 0.5, flt: { t: 'hp', f: [1500] }, am: [70, 0.8] }, { w: 'sine', f: [100, 40], d: 0.2, g: 0.8 }],
  thunder: [{ w: 'brown', d: 2.0, g: 1, a: 0.01, curve: 1.3, flt: { t: 'lp', f: [900, 80] }, am: [8, 0.5] }, { w: 'noise', d: 0.2, g: 0.8, flt: { t: 'hp', f: [1500] } }],
  thunderCall: [{ w: 'saw', f: [60, 300], d: 0.6, g: 0.3, a: 0.5, curve: 0.2, vib: [40, 0.2], flt: { t: 'lp', f: [2000] } }],
  cash: [{ w: 'sine', f: [1568], d: 0.25, g: 0.4, curve: 3 }, { w: 'sine', f: [2093], d: 0.35, g: 0.4, start: 0.08, curve: 3 }, { w: 'noise', d: 0.05, g: 0.3, flt: { t: 'hp', f: [5000] } }],
  poof: [{ w: 'noise', d: 0.35, g: 0.6, flt: { t: 'lp', f: [1500, 300] }, a: 0.02 }],
  sniff: [{ w: 'noise', d: 0.5, g: 0.5, a: 0.4, curve: 0.3, flt: { t: 'bp', f: [800, 3000], q: 2 } }, { w: 'noise', d: 0.25, g: 0.4, start: 0.5, a: 0.2, curve: 0.4, flt: { t: 'bp', f: [1200, 3500], q: 2 } }],
  stamp: [{ w: 'sine', f: [70, 28], d: 0.6, g: 1.3, dist: 3 }, { w: 'noise', d: 0.3, g: 1, flt: { t: 'lp', f: [2500, 200] }, dist: 2 }, { w: 'noise', d: 0.05, g: 0.8, flt: { t: 'hp', f: [3000] } }],
  decree: [{ w: 'saw', f: [262], d: 0.18, g: 0.25, flt: { t: 'lp', f: [2000] } }, { w: 'saw', f: [330], d: 0.18, g: 0.25, start: 0.15, flt: { t: 'lp', f: [2000] } }, { w: 'saw', f: [392], d: 0.4, g: 0.3, start: 0.3, flt: { t: 'lp', f: [2200] }, curve: 1 }],
  grate: [{ w: 'noise', d: 0.12, g: 0.55, flt: { t: 'bp', f: [3200], q: 2 }, am: [55, 0.9] }],
  grateHeavy: [{ w: 'noise', d: 0.3, g: 0.8, flt: { t: 'bp', f: [2400, 1200], q: 1.5 }, am: [45, 0.9] }, { w: 'sine', f: [120, 50], d: 0.2, g: 0.7 }],
  chomp: [{ w: 'noise', d: 0.04, g: 0.8, flt: { t: 'bp', f: [1500] } }, { w: 'noise', d: 0.05, g: 0.8, start: 0.07, flt: { t: 'bp', f: [1100] } }, { w: 'sine', f: [160, 60], d: 0.15, g: 0.7, dist: 2 }],
  chompL: [{ w: 'noise', d: 0.06, g: 1, flt: { t: 'bp', f: [1300] } }, { w: 'saw', f: [70, 50], d: 0.35, g: 0.4, flt: { t: 'lp', f: [600] }, dist: 3 }, { w: 'sine', f: [120, 35], d: 0.3, g: 1, dist: 2.5 }, { w: 'noise', d: 0.25, g: 0.7, start: 0.05, flt: { t: 'lp', f: [2000, 200] }, am: [25, 0.6] }],
  jaws: [{ w: 'saw', f: [82], d: 0.3, g: 0.35, flt: { t: 'lp', f: [400] }, curve: 0.8 }, { w: 'saw', f: [87], d: 0.3, g: 0.35, start: 0.33, flt: { t: 'lp', f: [400] }, curve: 0.8 }],
  splash: [{ w: 'noise', d: 0.5, g: 0.8, flt: { t: 'lp', f: [5000, 300] }, a: 0.01, am: [16, 0.3] }],
  pop: [{ w: 'sine', f: [300, 1100], d: 0.08, g: 0.6 }, { w: 'noise', d: 0.02, g: 0.4, flt: { t: 'hp', f: [3000] } }],
  boing: [{ w: 'sine', f: [180, 760], d: 0.35, g: 0.5, vib: [18, 0.08] }],
  tongue: [{ w: 'noise', d: 0.18, g: 0.5, flt: { t: 'bp', f: [600, 3000], q: 3 } }, { w: 'sine', f: [300, 900], d: 0.12, g: 0.3 }],
  slurp: [{ w: 'noise', d: 0.35, g: 0.6, flt: { t: 'bp', f: [2500, 500], q: 4 }, am: [20, 0.6] }],
  whip: [{ w: 'noise', d: 0.05, g: 1, flt: { t: 'hp', f: [2500] }, curve: 4 }, { w: 'sine', f: [400, 150], d: 0.08, g: 0.5 }],
  gulp: [{ w: 'sine', f: [400, 120], d: 0.2, g: 0.6 }, { w: 'noise', d: 0.15, g: 0.4, flt: { t: 'lp', f: [800] } }],
  spit: [{ w: 'noise', d: 0.25, g: 0.8, flt: { t: 'bp', f: [1500, 600], q: 2 } }, { w: 'sine', f: [600, 200], d: 0.15, g: 0.4 }],
  gurgle: [{ w: 'sine', f: [150, 220], d: 0.3, g: 0.4, vib: [14, 0.4] }],
  throw: [{ w: 'noise', d: 0.15, g: 0.4, a: 0.03, flt: { t: 'bp', f: [600, 1800], q: 1.5 } }],
  shotgun: [{ w: 'noise', d: 0.3, g: 1, flt: { t: 'lp', f: [6000, 400] }, dist: 3 }, { w: 'sine', f: [120, 40], d: 0.25, g: 1, dist: 2 }],
  fizz: [{ w: 'noise', d: 1.2, g: 0.6, flt: { t: 'hp', f: [3000] }, am: [35, 0.7], a: 0.1, curve: 1 }],
  helico: [{ w: 'noise', d: 0.9, g: 0.6, flt: { t: 'lp', f: [900] }, am: [16, 0.9], curve: 1 }],
  zip: [{ w: 'saw', f: [400, 2400], d: 0.15, g: 0.3, flt: { t: 'lp', f: [5000] }, dist: 2 }, { w: 'noise', d: 0.1, g: 0.4, flt: { t: 'hp', f: [3000] } }],
  go: [{ w: 'square', f: [520], d: 0.08, g: 0.2 }, { w: 'square', f: [780], d: 0.15, g: 0.2, start: 0.08 }],
  sahur: [{ w: 'saw', f: [220, 260], d: 0.25, g: 0.3, flt: { t: 'bp', f: [900], q: 2 } }, { w: 'saw', f: [260, 180], d: 0.4, g: 0.3, start: 0.22, flt: { t: 'bp', f: [700], q: 2 } }],
  boom: [{ w: 'noise', d: 0.7, g: 1, flt: { t: 'lp', f: [3000, 100] }, dist: 3 }, { w: 'sine', f: [90, 25], d: 0.6, g: 1.2, dist: 3 }],
  wobble: [{ w: 'sine', f: [500, 300], d: 0.1, g: 0.3 }, { w: 'sine', f: [300, 500], d: 0.1, g: 0.3, start: 0.1 }],
  flash: [{ w: 'noise', d: 0.1, g: 0.5, flt: { t: 'hp', f: [4000] } }, { w: 'sine', f: [3000, 1500], d: 0.2, g: 0.2 }],
  slip: [{ w: 'sine', f: [900, 200], d: 0.4, g: 0.4 }, { w: 'noise', d: 0.2, g: 0.3, start: 0.3, flt: { t: 'lp', f: [800] } }],
  gas: [{ w: 'brown', d: 1.2, g: 0.9, a: 0.05, flt: { t: 'lp', f: [400, 150] }, am: [12, 0.6] }, { w: 'noise', d: 0.6, g: 0.4, start: 0.3, flt: { t: 'bp', f: [700] } }],
  stab: [{ w: 'noise', d: 0.15, g: 1, flt: { t: 'hp', f: [1500] } }, { w: 'sine', f: [800, 600], d: 0.6, g: 0.3, curve: 3 }, { w: 'sine', f: [80, 30], d: 0.3, g: 1, dist: 2 }],
  wave: [{ w: 'brown', d: 2.2, g: 1, a: 0.6, curve: 1.2, flt: { t: 'lp', f: [600, 1500] } }],
  quake: [{ w: 'brown', d: 0.8, g: 1, flt: { t: 'lp', f: [300, 60] }, am: [9, 0.5] }, { w: 'sine', f: [55, 30], d: 0.6, g: 1, dist: 2 }],
  charge: [{ w: 'saw', f: [110, 330], d: 0.9, g: 0.12, a: 0.2, curve: 0.5, flt: { t: 'lp', f: [800, 2500] }, vib: [12, 0.05] }],
  ledge: [{ w: 'noise', d: 0.05, g: 0.4, flt: { t: 'bp', f: [1200] } }, { w: 'sine', f: [300, 200], d: 0.05, g: 0.3 }],
  grab: [{ w: 'noise', d: 0.08, g: 0.5, flt: { t: 'bp', f: [900] } }],
  tech: [{ w: 'sine', f: [800, 1600], d: 0.15, g: 0.3 }, { w: 'noise', d: 0.05, g: 0.3, flt: { t: 'hp', f: [3000] } }],
  respawn: [{ w: 'tri', f: [300, 900], d: 0.5, g: 0.25, vib: [8, 0.04] }],
  pummel: [{ w: 'noise', d: 0.05, g: 0.6, flt: { t: 'bp', f: [1200] } }, { w: 'sine', f: [160, 70], d: 0.07, g: 0.6 }],
  slice: [{ w: 'noise', d: 0.12, g: 0.8, flt: { t: 'hp', f: [2500, 6000] } }, { w: 'saw', f: [900, 400], d: 0.1, g: 0.2 }],
  countHi: [{ w: 'square', f: [440], d: 0.25, g: 0.2, flt: { t: 'lp', f: [2000] } }],
  countGo: [{ w: 'square', f: [880], d: 0.6, g: 0.22, flt: { t: 'lp', f: [3000] }, curve: 1 }, { w: 'square', f: [1320], d: 0.6, g: 0.12, flt: { t: 'lp', f: [3000] }, curve: 1 }],
  game: [{ w: 'noise', d: 2.5, g: 0.7, flt: { t: 'lp', f: [2000, 100] }, curve: 1.2 }, { w: 'sine', f: [60, 30], d: 2, g: 1, dist: 2 }],
  menuMove: [{ w: 'square', f: [660], d: 0.04, g: 0.12, flt: { t: 'lp', f: [3000] } }],
  menuOk: [{ w: 'square', f: [660, 990], d: 0.1, g: 0.15, flt: { t: 'lp', f: [3000] } }, { w: 'noise', d: 0.05, g: 0.2, flt: { t: 'bp', f: [2000] } }],
  menuBack: [{ w: 'square', f: [440, 220], d: 0.1, g: 0.14, flt: { t: 'lp', f: [2000] } }],
  crowd: [{ w: 'noise', d: 1.6, g: 0.7, a: 0.3, curve: 1.4, flt: { t: 'bp', f: [700, 1100], q: 0.6 }, am: [6, 0.4] }],
  // Pandrezz: kamehameha, CD-Man, Vinylman
  kameCharge: [{ w: 'saw', f: [85, 190], d: 1.5, g: 0.14, a: 0.25, curve: 0.45, flt: { t: 'lp', f: [420, 2400] }, vib: [16, 0.05] },
    { w: 'noise', d: 1.5, g: 0.12, a: 0.35, curve: 0.6, flt: { t: 'bp', f: [2400, 5200], q: 2 }, am: [32, 0.75] },
    { w: 'sine', f: [220, 440], d: 1.4, g: 0.08, a: 0.4, curve: 0.5, am: [9, 0.5] }],
  kameFire: [{ w: 'noise', d: 1.4, g: 1, a: 0.015, curve: 1.2, flt: { t: 'lp', f: [6000, 500] }, dist: 2 },
    { w: 'saw', f: [240, 80], d: 1.2, g: 0.35, flt: { t: 'lp', f: [2000, 350] }, dist: 2.5, vib: [26, 0.04] },
    { w: 'sine', f: [75, 38], d: 1.1, g: 0.9, dist: 2 }, { w: 'noise', d: 1.2, g: 0.25, a: 0.05, flt: { t: 'bp', f: [3000, 1500], q: 1.5 }, am: [40, 0.6] }],
  summon: [{ w: 'tri', f: [520, 1700], d: 0.38, g: 0.22, vib: [22, 0.05] }, { w: 'sine', f: [1100, 2400], d: 0.32, g: 0.14, start: 0.1, am: [30, 0.6] },
    { w: 'noise', d: 0.3, g: 0.22, flt: { t: 'hp', f: [5000] } }, { w: 'sine', f: [180, 90], d: 0.25, g: 0.4 }],
  cdThrow: [{ w: 'noise', d: 0.24, g: 0.6, flt: { t: 'bp', f: [1800, 4200], q: 3 }, am: [44, 0.6] }, { w: 'sine', f: [1500, 900], d: 0.16, g: 0.14 }],
  vinylScratch: [{ w: 'noise', d: 0.17, g: 0.85, flt: { t: 'bp', f: [700, 2800], q: 4 } }, { w: 'noise', d: 0.16, g: 0.85, start: 0.16, flt: { t: 'bp', f: [2800, 650], q: 4 } },
    { w: 'saw', f: [180, 620], d: 0.15, g: 0.14, flt: { t: 'lp', f: [1500] } }, { w: 'saw', f: [620, 160], d: 0.15, g: 0.14, start: 0.16, flt: { t: 'lp', f: [1500] } }],
  bassDrop: [{ w: 'sine', f: [120, 34], d: 1.0, g: 1.2, dist: 3 }, { w: 'saw', f: [58, 40], d: 0.9, g: 0.4, flt: { t: 'lp', f: [320] }, dist: 2 },
    { w: 'noise', d: 0.35, g: 0.5, flt: { t: 'lp', f: [1000, 100] } }],
  // La Folle Du Bus and her cats
  meow: [{ w: 'saw', f: [480, 940], d: 0.2, g: 0.22, vib: [9, 0.05], flt: { t: 'bp', f: [1100, 1700], q: 2 } }, { w: 'saw', f: [940, 430], d: 0.32, g: 0.22, start: 0.18, vib: [7, 0.06], flt: { t: 'bp', f: [1700, 1000], q: 2 } }, { w: 'tri', f: [700, 900], d: 0.4, g: 0.1 }],
  yowl: [{ w: 'saw', f: [360, 880], d: 0.55, g: 0.3, vib: [14, 0.1], flt: { t: 'bp', f: [800, 1600], q: 1.5 }, dist: 1.5 }, { w: 'noise', d: 0.4, g: 0.25, flt: { t: 'hp', f: [3000] }, am: [24, 0.5] }],
  hiss: [{ w: 'noise', d: 0.5, g: 0.6, a: 0.04, curve: 1.2, flt: { t: 'hp', f: [3600] }, am: [28, 0.3] }],
  scratch: [{ w: 'noise', d: 0.06, g: 0.7, flt: { t: 'bp', f: [4200, 2400], q: 3 } }, { w: 'noise', d: 0.05, g: 0.6, start: 0.07, flt: { t: 'bp', f: [3800, 2100], q: 3 } }, { w: 'sine', f: [600, 300], d: 0.05, g: 0.2 }],
  broom: [{ w: 'noise', d: 1.0, g: 0.5, a: 0.05, curve: 1, flt: { t: 'bp', f: [500, 1600], q: 1.2 }, am: [11, 0.6] }],
};

export class Audio {
  constructor() {
    this.ctx = null;
    this.buffers = {};
    this.vol = { master: 0.8, music: 0.6, sfx: 0.9, voice: 1 };
    this.voice = null;
    this.speaking = 0;
  }

  // must be called from a user gesture
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    this.ctx = new C();
    this.master = this.ctx.createGain();
    this.comp = this.ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14; this.comp.ratio.value = 6; this.comp.attack.value = 0.003; this.comp.release.value = 0.15;
    this.sfxBus = this.ctx.createGain();
    this.musicBus = this.ctx.createGain();
    this.sfxBus.connect(this.comp);
    this.musicBus.connect(this.master);
    this.comp.connect(this.master);
    this.master.connect(this.ctx.destination);
    // short room reverb for big hits
    this.verb = this.ctx.createConvolver();
    const len = Math.floor(SR * 1.6), ir = this.ctx.createBuffer(2, len, SR);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    this.verb.buffer = ir;
    this.verbSend = this.ctx.createGain(); this.verbSend.gain.value = 0.25;
    this.verbSend.connect(this.verb); this.verb.connect(this.comp);
    this.applyVolumes();
    this.music = new Music(this.ctx, this.musicBus);
    this.pickVoice();
  }

  applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = this.vol.master;
    this.sfxBus.gain.value = this.vol.sfx;
    this.musicBus.gain.value = this.vol.music;
  }

  buf(name) {
    if (!this.buffers[name]) {
      const def = S[name];
      if (!def) return null;
      this.buffers[name] = render(this.ctx, def);
    }
    return this.buffers[name];
  }

  sfx(name, pan = 0, gain = 1, variant = 0, verb = 0) {
    if (!this.ctx || !name) return;
    const b = this.buf(name) || this.buf('hitM');
    if (!b) return;
    const src = this.ctx.createBufferSource();
    src.buffer = b;
    src.playbackRate.value = (0.92 + Math.random() * 0.16) * (variant ? 1 + (variant - 1) * 0.12 : 1);
    const g = this.ctx.createGain();
    g.gain.value = gain;
    const p = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    if (p) { p.pan.value = Math.max(-1, Math.min(1, pan)); src.connect(g).connect(p).connect(this.sfxBus); if (verb) { const vg = this.ctx.createGain(); vg.gain.value = verb; p.connect(vg).connect(this.verbSend); } }
    else src.connect(g).connect(this.sfxBus);
    src.start();
  }

  hit(name, dmg, kb, pan) {
    const big = kb > 95;
    this.sfx(name, pan, 0.8 + Math.min(0.6, dmg / 20), 0, big ? 0.6 : 0.1);
    if (dmg > 6) this.sfx(big ? 'splatter' : 'splat', pan, 0.4 + dmg / 30);
    if (big) this.sfx('hitL', pan, 0.6, 0, 0.8);
    if (kb > 140) this.crowd();
  }

  ko(pan) { this.sfx('ko', pan, 1.1, 0, 1); this.sfx('splatter', pan, 1); this.crowd(); }
  crowd() { this.sfx('crowd', 0, 0.35); }
  countdown(n) { this.sfx('countHi', 0, 1); this.say(['', 'Un', 'Deux', 'Trois'][n] || String(n)); }
  go() { this.sfx('countGo', 0, 1); this.say('Bagarre !', 0.55, 1.1); }
  game() { this.sfx('game', 0, 1); this.say('Game !', 0.5, 0.9); }

  pickVoice() {
    if (!window.speechSynthesis) return;
    const choose = () => {
      const vs = speechSynthesis.getVoices();
      this.voice = vs.find((v) => /fr/i.test(v.lang) && /male|thomas|paul|henri|claude/i.test(v.name)) || vs.find((v) => /fr/i.test(v.lang)) || vs[0] || null;
    };
    choose();
    speechSynthesis.onvoiceschanged = choose;
  }

  // the zany commentator (src/audio/commentator.js): never over a fighter's shout, a pause between two lines,
  // a KO (prio 2) may cut a lesser comment
  comment(text, prio = 0, delay = 0) {
    if (!text || !window.speechSynthesis || this.vol.voice <= 0) return;
    if (delay) { clearTimeout(this._ct); this._ct = setTimeout(() => this.comment(text, prio, 0), delay * 1000); return; }
    const busy = speechSynthesis.speaking || speechSynthesis.pending;
    const mine = this.lastKind === 'comment';
    if (busy && !(mine && prio > (this.lastPrio || 0))) return;
    if (mine && performance.now() - (this.lastSay || 0) < [3400, 2200, 700][prio]) return;
    this.say(text, 1.25 + Math.random() * 0.2, 1.18, 'comment', prio);
  }

  say(text, pitch = 0.4, rate = 0.95, kind = 'voice', prio = 3) {
    if (!window.speechSynthesis || this.vol.voice <= 0 || !text) return;
    this.lastSay = performance.now(); this.lastKind = kind; this.lastPrio = prio;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (this.voice) u.voice = this.voice;
      u.lang = 'fr-FR'; u.pitch = pitch; u.rate = rate; u.volume = Math.min(1, this.vol.voice * this.vol.master * 1.2);
      speechSynthesis.speak(u);
    } catch (e) { /* ignore */ }
  }

  playMusic(id, opts) { if (this.music) this.music.play(id, opts); }
  stopMusic(fade = 0.6) { if (this.music) this.music.stop(fade); }
  musicTime() { return this.music ? this.music.songTime() : 0; }
}

export const SOUND_NAMES = Object.keys(S);
