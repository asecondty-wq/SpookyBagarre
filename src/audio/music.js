// Spooky music, synthesised live with WebAudio (no audio files): a small step sequencer with
// organ, harpsichord, theremin, choir, bells, accordion, banjo, bass and drums. One song per arena.
const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const midi = (n) => { const m = /^([A-G][#b]?)(-?\d)$/.exec(n); return m ? 12 * (+m[2] + 1) + NOTE[m[1]] : null; };
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// chord symbols -> midi notes (root in octave 3)
function chord(sym) {
  const m = /^([A-G][#b]?)(m|dim|7|m7|maj7|sus4)?$/.exec(sym);
  const r = NOTE[m[1]] + 48;
  const q = m[2] || '';
  const iv = { '': [0, 4, 7], m: [0, 3, 7], dim: [0, 3, 6], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], sus4: [0, 5, 7] }[q];
  return iv.map((i) => r + i);
}

function noiseBuffer(ctx) {
  const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

// --- instruments: (ctx, out, t, freq, dur, vel) ----------------------------------------------------------------
const INST = {
  organ(ctx, out, t, f, d, v) {
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.09 * v, t + 0.06); g.gain.setValueAtTime(0.09 * v, t + d - 0.05); g.gain.linearRampToValueAtTime(0, t + d + 0.15);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    for (const [m, det, type] of [[1, -6, 'sawtooth'], [1, 7, 'square'], [2, 0, 'sine'], [0.5, 3, 'triangle']]) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f * m; o.detune.value = det;
      o.connect(lp); o.start(t); o.stop(t + d + 0.2);
    }
    lp.connect(g).connect(out);
  },
  harpsi(ctx, out, t, f, d, v) {
    const g = ctx.createGain(); g.gain.setValueAtTime(0.13 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + Math.min(0.9, d + 0.4));
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 300;
    for (const [type, m] of [['square', 1], ['sawtooth', 2]]) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f * m; o.connect(hp); o.start(t); o.stop(t + 1); }
    hp.connect(g).connect(out);
  },
  pluck(ctx, out, t, f, d, v) { // banjo / mandolin
    const g = ctx.createGain(); g.gain.setValueAtTime(0.16 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 3; bp.Q.value = 2;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f * 1.01, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
    o.connect(bp).connect(g).connect(out); o.start(t); o.stop(t + 0.4);
  },
  theremin(ctx, out, t, f, d, v, prev) {
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.14 * v, t + 0.08); g.gain.setValueAtTime(0.14 * v, t + d - 0.04); g.gain.linearRampToValueAtTime(0, t + d + 0.1);
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(prev || f, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.09);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 5.5; const lg = ctx.createGain(); lg.gain.value = f * 0.022;
    lfo.connect(lg).connect(o.frequency);
    const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f * 2; const g2 = ctx.createGain(); g2.gain.value = 0.15;
    o.connect(g); o2.connect(g2).connect(g); g.connect(out);
    o.start(t); o2.start(t); lfo.start(t); o.stop(t + d + 0.15); o2.stop(t + d + 0.15); lfo.stop(t + d + 0.15);
  },
  choir(ctx, out, t, f, d, v) {
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.06 * v, t + 0.25); g.gain.setValueAtTime(0.06 * v, t + d); g.gain.linearRampToValueAtTime(0, t + d + 0.4);
    for (const [ff, q] of [[700, 6], [1150, 8]]) {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = ff; bp.Q.value = q;
      for (const det of [-9, 0, 11]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; o.connect(bp); o.start(t); o.stop(t + d + 0.5); }
      bp.connect(g);
    }
    g.connect(out);
  },
  bell(ctx, out, t, f, d, v) {
    const g = ctx.createGain(); g.gain.setValueAtTime(0.12 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
    for (const [m, a] of [[1, 1], [2.76, 0.4], [5.4, 0.2], [8.9, 0.1]]) { const o = ctx.createOscillator(); o.frequency.value = f * m; const og = ctx.createGain(); og.gain.value = a; o.connect(og).connect(g); o.start(t); o.stop(t + 1.7); }
    g.connect(out);
  },
  accordion(ctx, out, t, f, d, v) {
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.08 * v, t + 0.04); g.gain.setValueAtTime(0.08 * v, t + d - 0.03); g.gain.linearRampToValueAtTime(0, t + d + 0.05);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.8;
    for (const det of [-14, 0, 13]) { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f; o.detune.value = det; o.connect(bp); o.start(t); o.stop(t + d + 0.1); }
    bp.connect(g).connect(out);
  },
  brass(ctx, out, t, f, d, v) {
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.1 * v, t + 0.03); g.gain.exponentialRampToValueAtTime(0.05 * v, t + d); g.gain.linearRampToValueAtTime(0, t + d + 0.06);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(400, t); lp.frequency.linearRampToValueAtTime(2600, t + 0.06); lp.frequency.linearRampToValueAtTime(1200, t + d);
    for (const det of [-5, 6]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; o.connect(lp); o.start(t); o.stop(t + d + 0.1); }
    lp.connect(g).connect(out);
  },
  lead(ctx, out, t, f, d, v) { // chiptune square lead
    const g = ctx.createGain(); g.gain.setValueAtTime(0.07 * v, t); g.gain.setValueAtTime(0.07 * v, t + d * 0.9); g.gain.linearRampToValueAtTime(0, t + d);
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 6; const lg = ctx.createGain(); lg.gain.value = f * 0.01; lfo.connect(lg).connect(o.frequency);
    o.connect(g).connect(out); o.start(t); lfo.start(t); o.stop(t + d + 0.02); lfo.stop(t + d + 0.02);
  },
  surf(ctx, out, t, f, d, v) { // tremolo guitar
    const g = ctx.createGain(); g.gain.setValueAtTime(0.09 * v, t); g.gain.exponentialRampToValueAtTime(0.01, t + d + 0.3);
    const trem = ctx.createGain(); const lfo = ctx.createOscillator(); lfo.frequency.value = 9; const lg = ctx.createGain(); lg.gain.value = 0.5; lfo.connect(lg).connect(trem.gain);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
    const ws = ctx.createWaveShaper(); const c = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; c[i] = Math.tanh(x * 3); } ws.curve = c;
    o.connect(ws).connect(lp).connect(trem).connect(g).connect(out); o.start(t); lfo.start(t); o.stop(t + d + 0.35); lfo.stop(t + d + 0.35);
  },
  bass(ctx, out, t, f, d, v) {
    const g = ctx.createGain(); g.gain.setValueAtTime(0.2 * v, t); g.gain.exponentialRampToValueAtTime(0.06 * v, t + d); g.gain.linearRampToValueAtTime(0, t + d + 0.05);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(220, t + d);
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
    const s = ctx.createOscillator(); s.type = 'sine'; s.frequency.value = f / 2; const sg = ctx.createGain(); sg.gain.value = 0.6;
    o.connect(lp); s.connect(sg).connect(lp); lp.connect(g).connect(out);
    o.start(t); s.start(t); o.stop(t + d + 0.1); s.stop(t + d + 0.1);
  },
};

// --- drums -------------------------------------------------------------------------------------------------------
const DRUM = {
  k(ctx, out, t, v) { const o = ctx.createOscillator(); const g = ctx.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12); g.gain.setValueAtTime(0.55 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3); o.connect(g).connect(out); o.start(t); o.stop(t + 0.32); },
  s(ctx, out, t, v, nb) { const n = ctx.createBufferSource(); n.buffer = nb; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; const g = ctx.createGain(); g.gain.setValueAtTime(0.32 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18); n.connect(f).connect(g).connect(out); n.start(t); n.stop(t + 0.2); const o = ctx.createOscillator(); const og = ctx.createGain(); o.frequency.value = 190; og.gain.setValueAtTime(0.2 * v, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.1); o.connect(og).connect(out); o.start(t); o.stop(t + 0.12); },
  h(ctx, out, t, v, nb) { const n = ctx.createBufferSource(); n.buffer = nb; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000; const g = ctx.createGain(); g.gain.setValueAtTime(0.12 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05); n.connect(f).connect(g).connect(out); n.start(t); n.stop(t + 0.06); },
  o(ctx, out, t, v, nb) { const n = ctx.createBufferSource(); n.buffer = nb; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000; const g = ctx.createGain(); g.gain.setValueAtTime(0.1 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25); n.connect(f).connect(g).connect(out); n.start(t); n.stop(t + 0.26); },
  t(ctx, out, t, v) { const o = ctx.createOscillator(); const g = ctx.createGain(); o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(90, t + 0.2); g.gain.setValueAtTime(0.4 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3); o.connect(g).connect(out); o.start(t); o.stop(t + 0.32); },
  w(ctx, out, t, v) { // wood block "tung"
    const o = ctx.createOscillator(); const g = ctx.createGain(); o.frequency.setValueAtTime(700, t); o.frequency.exponentialRampToValueAtTime(560, t + 0.1); g.gain.setValueAtTime(0.35 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16); o.connect(g).connect(out); o.start(t); o.stop(t + 0.18);
  },
  c(ctx, out, t, v, nb) { // clap
    for (let i = 0; i < 3; i++) { const n = ctx.createBufferSource(); n.buffer = nb; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1200; const g = ctx.createGain(); const tt = t + i * 0.012; g.gain.setValueAtTime(0.22 * v, tt); g.gain.exponentialRampToValueAtTime(0.001, tt + 0.1); n.connect(f).connect(g).connect(out); n.start(tt); n.stop(tt + 0.12); }
  },
  g(ctx, out, t, v) { // big gong / bedug
    const g = ctx.createGain(); g.gain.setValueAtTime(0.4 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
    for (const [f, a] of [[62, 1], [97, 0.5], [151, 0.3], [233, 0.15]]) { const o = ctx.createOscillator(); o.frequency.setValueAtTime(f * 1.1, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.08); const og = ctx.createGain(); og.gain.value = a; o.connect(og).connect(g); o.start(t); o.stop(t + 1.5); }
    g.connect(out);
  },
};

// --- songs ----------------------------------------------------------------------------------------------------------
// steps per bar `spb` (8 = eighths, 12 = triplet eighths). Track strings: one token per step, '.' rest, '-' hold.
// drum strings: one char per step per drum lane.
const SONGS = {
  menu: {
    bpm: 104, spb: 8, swing: 0.08,
    prog: ['Dm', 'Bb', 'Gm', 'A7', 'Dm', 'F', 'Gm', 'A7'],
    pad: 'organ', arp: 'harpsi', arpPat: [0, 1, 2, 1, 0, 2, 1, 2], bassPat: '0.0.0.5.',
    lead: { inst: 'theremin', bars: [
      'D5 - - F5 A5 - G5 F5', 'D5 - - - . . A4 -', 'Bb4 - D5 - G5 - F5 E5', 'E5 - - - C#5 - - -',
      'D5 - - F5 A5 - C6 Bb5', 'A5 - - - F5 - - -', 'G5 - Bb5 - A5 - G5 F5', 'E5 - - - - - . .'] },
    drums: { k: 'x...x...', s: '....x...', h: 'x.x.x.x.' },
    choirBars: [0, 4],
  },
  cemetery: {
    bpm: 112, spb: 8, swing: 0.05,
    prog: ['Am', 'F', 'Dm', 'E', 'Am', 'C', 'Dm', 'E7'.replace('7', '')],
    pad: 'organ', arp: 'harpsi', arpPat: [0, 2, 1, 2, 0, 2, 1, 2], bassPat: '0..00.4.',
    lead: { inst: 'bell', bars: [
      'A5 . C6 . E6 . D6 C6', 'C6 . A5 . . . F5 .', 'D6 . F6 . E6 . D6 . ', 'B5 - - - G#5 - - -',
      'A5 . E6 . A6 . G6 E6', 'G6 . E6 . C6 . . .', 'F6 . E6 . D6 . C6 .', 'B5 - G#5 - E5 - - -'] },
    lead2: { inst: 'theremin', from: 8 },
    drums: { k: 'x.....x.', s: '....x...', h: 'x.xxx.xx', t: '.......x' },
    choirBars: [0, 2, 4, 6],
  },
  swamp: {
    bpm: 96, spb: 8, swing: 0.22,
    prog: ['Em', 'Em', 'Am', 'Em', 'B', 'Am', 'Em', 'B'],
    pad: null, arp: 'pluck', arpPat: [0, -1, 1, 2, 0, -1, 2, 1], bassPat: '0.4.0.47',
    lead: { inst: 'theremin', bars: [
      'E5 - G5 - B5 - A5 G5', 'E5 - - - D5 - E5 -', 'A5 - C6 - B5 - A5 -', 'G5 - E5 - - - . .',
      'F#5 - A5 - B5 - D#6 -', 'C6 - B5 - A5 - G5 -', 'G5 - F#5 - E5 - D5 -', 'D#5 - - - B4 - - -'] },
    drums: { k: 'x..x..x.', s: '....x...', w: '.x..x.x.', h: '..x...x.' },
  },
  elysee: {
    bpm: 104, spb: 8, swing: 0.0,
    prog: ['Gm', 'D', 'Gm', 'Cm', 'Eb', 'D', 'Gm', 'D7'.replace('7', '')],
    pad: 'brass', padRhythm: 'x...x.x.', arp: 'accordion', arpPat: [0, 1, 2, 1, 0, 1, 2, 1], bassPat: '0.4.0.4.',
    lead: { inst: 'accordion', bars: [
      'G5 - G5 A5 Bb5 - A5 G5', 'F#5 - D5 - - - . .', 'G5 - Bb5 - D6 - C6 Bb5', 'C6 - - - G5 - - -',
      'Eb6 - D6 C6 Bb5 - C6 -', 'A5 - F#5 - D5 - . .', 'G5 - A5 - Bb5 - A5 G5', 'F#5 - - - D5 - - -'] },
    drums: { k: 'x...x...', s: 'x.xxx.xx', h: '........' },
  },
  diner: {
    bpm: 128, spb: 8, swing: 0.25,
    prog: ['Em', 'Em', 'Am', 'Em', 'C', 'B', 'Em', 'B'],
    pad: null, arp: 'surf', arpPat: [0, -1, 2, -1, 1, -1, 2, -1], bassPat: '02340234',
    lead: { inst: 'surf', bars: [
      'E5 - G5 E5 B5 - A5 G5', 'E5 - - - . . . .', 'A5 - C6 A5 E6 - D6 C6', 'B5 - G5 - E5 - . .',
      'C6 - E6 - G6 - E6 -', 'D#6 - - - B5 - - -', 'E6 - D6 B5 G5 - E5 -', 'F#5 - - - D#5 - - -'] },
    drums: { k: 'x...x...', s: '..x...x.', h: 'xxxxxxxx' },
  },
  cave: {
    bpm: 100, spb: 12, swing: 0,
    prog: ['Dm', 'Dm', 'A', 'A', 'Dm', 'Gm', 'A', 'Dm'],
    pad: null, arp: 'pluck', arpPat: [0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2], bassPat: '0..4..0..4..',
    lead: { inst: 'accordion', bars: [
      'D5 - - F5 - - A5 - - F5 - -', 'D5 - - E5 - - F5 - - E5 - -', 'C#5 - - E5 - - A5 - - G5 - -', 'E5 - - - - - C#5 - - - - -',
      'D5 - - F5 - - A5 - - D6 - -', 'Bb5 - - A5 - - G5 - - F5 - -', 'E5 - - G5 - - F5 - - E5 - -', 'D5 - - - - - . . . . . .'] },
    drums: { k: 'x.....x.....', s: '...x.....x..', h: 'x..x..x..x..' },
  },
  arena: {
    bpm: 140, spb: 8, swing: 0,
    prog: ['Cm', 'Ab', 'Bb', 'G', 'Cm', 'Ab', 'Fm', 'G'],
    pad: null, arp: 'lead', arpPat: [0, 1, 2, 3, 2, 1, 0, 1], arpOct: 1, bassPat: '00440044',
    lead: { inst: 'lead', bars: [
      'C6 - Eb6 - G6 - F6 Eb6', 'Eb6 - C6 - Ab5 - - -', 'Bb5 - D6 - F6 - Eb6 D6', 'D6 - - - B5 - - -',
      'C6 - G6 - C7 - Bb6 Ab6', 'Ab6 - Eb6 - C6 - - -', 'F6 - Ab6 - C7 - Bb6 Ab6', 'G6 - - - D6 - B5 -'] },
    drums: { k: 'x.x.x.x.', s: '..x...x.', h: 'xxxxxxxx' },
  },
  village: {
    bpm: 118, spb: 8, swing: 0.04,
    prog: ['Dm', 'Dm', 'C', 'Dm', 'Bb', 'C', 'Am', 'Dm'],
    pad: 'choir', arp: 'bell', arpPat: [0, -1, 2, -1, 1, -1, 2, 1], bassPat: '0...0.4.',
    lead: { inst: 'bell', scale: [62, 63, 65, 69, 70, 74, 75, 77, 81], bars: [
      'D6 . F6 . A6 . F6 .', 'Eb6 . D6 . . . A5 .', 'D6 . A6 . Bb6 . A6 F6', 'F6 . Eb6 . D6 . . .',
      'Bb5 . D6 . F6 . D6 .', 'Eb6 . F6 . A6 . F6 .', 'A6 . F6 . Eb6 . D6 .', 'D6 - - - . . . .'] },
    drums: { k: 'x...x...', w: 'x.x.x...', g: 'x.......', t: '......xx', h: '.x.x.x.x' },
  },
  sea: {
    bpm: 108, spb: 12, swing: 0,
    prog: ['Am', 'Am', 'G', 'G', 'F', 'E', 'Am', 'E'],
    pad: 'organ', arp: 'accordion', arpPat: [0, -1, -1, 1, -1, 2, 0, -1, -1, 1, -1, 2], bassPat: '0.....4.....',
    lead: { inst: 'theremin', bars: [
      'A5 - - - - - C6 - - E6 - -', 'D6 - - C6 - - B5 - - A5 - -', 'G5 - - - - - B5 - - D6 - -', 'C6 - - B5 - - A5 - - G5 - -',
      'F5 - - A5 - - C6 - - F6 - -', 'E6 - - - - - G#5 - - - - -', 'A5 - - C6 - - E6 - - A6 - -', 'G#6 - - - - - E6 - - - - -'] },
    drums: { k: 'x.....x.....', s: '......x.....', h: 'x..x..x..x..', t: '.........x.x' },
  },
  attic: {
    // a creaky music-box waltz for La Folle Du Bus's attic (3/4, eighth notes)
    bpm: 92, spb: 6, swing: 0.06,
    prog: ['Em', 'Am', 'B', 'Em', 'C', 'Am', 'B', 'Em'],
    pad: 'organ', arp: 'harpsi', arpPat: [0, -1, 1, -1, 2, -1], bassPat: '0.....',
    lead: { inst: 'bell', bars: [
      'E5 - - G5 - B5', 'A5 - - - C6 B5', 'F#5 - - A5 - D#5', 'E5 - - - - .',
      'C6 - - B5 - A5', 'A5 - - G5 - E5', 'F#5 - G5 - A5 -', 'B5 - - - - .'] },
    lead2: { inst: 'theremin', from: 8 },
    drums: { k: 'x.....', s: '..x.x.', h: '..x.x.' },
    choirBars: [3, 7],
  },
  results: {
    bpm: 90, spb: 8, swing: 0.1,
    prog: ['Dm', 'Gm', 'A', 'Dm'],
    pad: 'organ', arp: 'harpsi', arpPat: [0, 1, 2, 1, 0, 1, 2, 1], bassPat: '0...0...',
    lead: { inst: 'choir', bars: ['D5 - - - F5 - - -', 'G5 - - - Bb5 - - -', 'A5 - - - C#6 - - -', 'D6 - - - - - - -'] },
    drums: { k: 'x.......', s: '....x...' },
  },
};

export class Music {
  constructor(ctx, out) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.connect(out);
    this.nb = noiseBuffer(ctx);
    this.song = null;
    this.timer = null;
  }

  play(id, { from = 0 } = {}) {
    if (this.id === id && this.song) return;
    this.stop(0.05, true);
    const S = SONGS[id];
    if (!S) return;
    this.id = id;
    this.song = S;
    this.gain = this.ctx.createGain();
    this.gain.gain.value = 1;
    this.gain.connect(this.out);
    this.stepDur = 60 / S.bpm / (S.spb / 2); // spb steps per bar of 4 beats -> spb/4 steps per beat... 8 steps per bar = eighths
    this.stepDur = (60 / S.bpm) * (4 / S.spb);
    this.step = Math.floor(from / this.stepDur);
    this.t0 = this.ctx.currentTime + 0.08 - this.step * this.stepDur;
    this.next = this.t0 + this.step * this.stepDur;
    this.prevLead = 0;
    this.timer = setInterval(() => this.schedule(), 25);
    this.schedule();
  }

  songTime() { return this.song ? Math.max(0, this.ctx.currentTime - this.t0) : 0; }

  stop(fade = 0.6, immediate = false) {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.gain) {
      const g = this.gain;
      const now = this.ctx.currentTime;
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.linearRampToValueAtTime(0, now + fade);
      setTimeout(() => { try { g.disconnect(); } catch (e) { /* */ } }, (fade + 2) * 1000);
    }
    this.song = null; this.id = null; this.gain = null;
  }

  schedule() {
    const S = this.song;
    if (!S) return;
    const ahead = this.ctx.currentTime + 0.15;
    while (this.next < ahead) {
      this.playStep(this.step, this.next);
      this.step++;
      this.next = this.t0 + this.step * this.stepDur;
    }
  }

  playStep(step, t) {
    const S = this.song, ctx = this.ctx, out = this.gain;
    const spb = S.spb, barLen = S.prog.length;
    const bar = Math.floor(step / spb) % (barLen * 2); // two passes: second pass adds variations
    const pass = Math.floor(step / (spb * barLen)) % 2;
    const s = step % spb;
    const swing = S.swing && s % 2 === 1 ? S.swing * this.stepDur : 0;
    const tt = t + swing;
    const ch = chord(S.prog[bar % barLen]);
    // pad chords
    if (S.pad && s === 0 && !S.padRhythm) {
      for (const n of ch) INST[S.pad](ctx, out, tt, hz(n + 12), this.stepDur * spb * 0.98, 0.9);
    }
    if (S.pad && S.padRhythm && S.padRhythm[s] === 'x') for (const n of ch) INST[S.pad](ctx, out, tt, hz(n + 12), this.stepDur * 0.9, 0.7);
    if (S.choirBars && s === 0 && S.choirBars.includes(bar % barLen) && pass === 1) INST.choir(ctx, out, tt, hz(ch[0] + 12), this.stepDur * spb * 1.9, 1);
    // arpeggio
    if (S.arp) {
      const a = S.arpPat[s % S.arpPat.length];
      if (a >= 0) INST[S.arp](ctx, out, tt, hz(ch[a % ch.length] + 12 * (1 + (S.arpOct || 0)) + (a >= ch.length ? 12 : 0)), this.stepDur * 0.9, 0.7 + (s === 0 ? 0.3 : 0));
    }
    // bass
    const bp = S.bassPat[s % S.bassPat.length];
    if (bp && bp !== '.') {
      const iv = { 0: 0, 2: 2, 3: 3, 4: 7, 5: 5, 7: 10 }[bp] ?? 0;
      INST.bass(ctx, out, tt, hz(ch[0] - 12 + iv), this.stepDur * 1.6, 0.9);
    }
    // lead melody (second pass louder, first pass sparser)
    const L = S.lead;
    if (L) {
      const toks = L.bars[bar % L.bars.length].trim().split(/\s+/);
      const tok = toks[s];
      if (tok && tok !== '.' && tok !== '-') {
        let len = 1;
        while (toks[s + len] === '-') len++;
        const m = midi(tok);
        if (m) {
          const inst = (pass === 1 && S.lead2) ? S.lead2.inst : L.inst;
          INST[inst](ctx, out, tt, hz(m), this.stepDur * len * 0.95, pass ? 1 : 0.85, this.prevLead);
          this.prevLead = hz(m);
        }
      }
    }
    // drums
    if (S.drums) {
      for (const [k, pat] of Object.entries(S.drums)) {
        const c = pat[s % pat.length];
        if (c === 'x' && (pass === 1 || k !== 'h' || s % 2 === 0)) DRUM[k](ctx, out, tt, 1, this.nb);
      }
      // fill at the end of every 4 bars
      if (bar % 4 === 3 && s >= spb - 2) DRUM.t(ctx, out, tt, 0.8);
    }
  }
}

export const SONG_IDS = Object.keys(SONGS);
