// Procedural poses for floating-part fighters (body, head, two hands, two or three feet, prop).
// A pose is a set of targets in fighter space (metres, forward = +z, right = -x):
//   { body:{p,r,s}, head:{p,r,s}, hr:{p,r}, hl:{p,r}, fr:{p,r}, fl:{p,r}, fm:{p,r}, prop:{p,r,s}, mouth, eyes }
// Moves give a pose key; the timeline (windup -> strike -> recovery) is derived from their hitbox frames.

export const PARTS = ['body', 'head', 'hr', 'hl', 'fr', 'fl', 'fm', 'prop'];

// rest layout from a character's proportions
export function restPose(L) {
  const h = L.height, w = L.width;
  return {
    body: { p: [0, L.bodyY ?? h * 0.42, 0], r: [0, 0, 0], s: [1, 1, 1] },
    head: { p: [0, L.headY ?? h * 0.8, L.headZ ?? 0.04], r: [0, 0, 0], s: [1, 1, 1] },
    hr: { p: [-w * 0.62, L.handY ?? h * 0.42, 0.18], r: [0, 0, 0] },
    hl: { p: [w * 0.62, L.handY ?? h * 0.42, 0.18], r: [0, 0, 0] },
    fr: { p: [-w * (L.footSpread ?? 0.28), 0.1, 0.04], r: [0, 0, 0] },
    fl: { p: [w * (L.footSpread ?? 0.28), 0.1, 0.04], r: [0, 0, 0] },
    fm: { p: [0, 0.1, -0.25], r: [0, 0, 0] },
    prop: { p: [0, 0, 0], r: [0, 0, 0], s: [1, 1, 1] },
    mouth: 0, eyes: 0,
  };
}

const clone = (P) => JSON.parse(JSON.stringify(P));
const add3 = (a, b, k = 1) => { a[0] += b[0] * k; a[1] += b[1] * k; a[2] += b[2] * k; };

// apply offsets {part:{p:[..], r:[..], s:[..]}} scaled by k onto pose P (in place)
function offset(P, o, k = 1, L) {
  const hs = L ? L.height : 1;
  for (const key of Object.keys(o)) {
    if (key === 'mouth' || key === 'eyes') { P[key] = Math.max(P[key], o[key] * k); continue; }
    const t = P[key], d = o[key];
    if (!t) continue;
    if (d.p) add3(t.p, [d.p[0] * hs, d.p[1] * hs, d.p[2] * hs], k);
    if (d.r) add3(t.r, d.r, k);
    if (d.s && t.s) { t.s[0] += (d.s[0] - 1) * k; t.s[1] += (d.s[1] - 1) * k; t.s[2] += (d.s[2] - 1) * k; }
  }
}

// --- attack pose library: { wind, hit } offsets (positions in units of character height) -----------------------------
export const ATTACKS = {
  jab1: { wind: { hr: { p: [0, 0.02, -0.12] }, body: { r: [0, 0.25, 0] } }, hit: { hr: { p: [0.25, 0.08, 0.55], r: [0, 0, 0] }, body: { r: [0.1, -0.35, 0] }, mouth: 0.6 } },
  jab2: { wind: { hl: { p: [0, 0.02, -0.12] }, body: { r: [0, -0.25, 0] } }, hit: { hl: { p: [-0.25, 0.08, 0.55] }, body: { r: [0.1, 0.35, 0] }, mouth: 0.6 } },
  jab3: { wind: { fr: { p: [0, 0.15, -0.2] }, body: { r: [-0.2, 0, 0] } }, hit: { fr: { p: [0.1, 0.5, 0.65], r: [-1.2, 0, 0] }, body: { r: [-0.25, 0, 0.1] }, hl: { p: [0, 0.15, -0.2] }, mouth: 1 } },
  smash: {
    wind: { body: { r: [-0.35, 0.5, 0], s: [0.92, 1.08, 0.92] }, hr: { p: [0.1, 0.25, -0.45] }, hl: { p: [-0.1, 0.25, -0.35] }, head: { r: [-0.2, 0, 0] }, prop: { r: [0, 0, 1.4] } },
    hit: { body: { r: [0.45, -0.4, 0], s: [1.12, 0.9, 1.12] }, hr: { p: [0.3, 0.05, 0.75] }, hl: { p: [-0.3, 0.05, 0.7] }, fr: { p: [0, 0, -0.25] }, fl: { p: [0, 0, 0.3] }, head: { r: [0.25, 0, 0] }, mouth: 1, eyes: 1, prop: { r: [0, 0, -1.6] } },
  },
  usmash: {
    wind: { body: { p: [0, -0.12, 0], s: [1.15, 0.8, 1.15] }, hr: { p: [0, -0.2, 0.1] }, hl: { p: [0, -0.2, 0.1] } },
    hit: { body: { p: [0, 0.1, 0], s: [0.85, 1.25, 0.85] }, hr: { p: [0.2, 0.75, 0.05] }, hl: { p: [-0.2, 0.75, 0.05] }, head: { r: [-0.4, 0, 0] }, mouth: 1, eyes: 1, prop: { r: [-1.5, 0, 0] } },
  },
  nair: { wind: { body: { s: [0.9, 0.9, 0.9] } }, hit: { hr: { p: [-0.25, 0, 0.1] }, hl: { p: [0.25, 0, 0.1] }, fr: { p: [-0.2, 0.15, 0] }, fl: { p: [0.2, 0.15, 0] }, mouth: 0.8, spin: 1 } },
  fair: {
    wind: { body: { r: [-0.4, 0, 0] }, hr: { p: [0.1, 0.4, -0.3] }, hl: { p: [-0.1, 0.35, -0.3] } },
    hit: { body: { r: [0.6, 0, 0] }, hr: { p: [0.15, -0.05, 0.75] }, hl: { p: [-0.15, -0.05, 0.7] }, mouth: 1, prop: { r: [-2, 0, 0] } },
  },
  uair: { wind: { body: { r: [0.3, 0, 0] } }, hit: { body: { r: [-1.2, 0, 0] }, fr: { p: [0, 0.75, 0.2] }, fl: { p: [0, 0.6, 0.1] }, hr: { p: [0, 0.5, 0] }, hl: { p: [0, 0.5, 0] }, mouth: 1 } },
  dair: {
    wind: { fr: { p: [0, 0.35, 0.1] }, fl: { p: [0, 0.35, 0.1] }, body: { s: [1.1, 0.9, 1.1] }, hr: { p: [0, 0.35, 0] }, hl: { p: [0, 0.35, 0] } },
    hit: { fr: { p: [0, -0.35, 0] }, fl: { p: [0, -0.35, 0] }, body: { s: [0.88, 1.2, 0.88] }, hr: { p: [0, 0.4, 0] }, hl: { p: [0, 0.4, 0] }, mouth: 1, eyes: 1 },
  },
  grab: { wind: { hr: { p: [0.1, 0.05, 0.2] }, hl: { p: [-0.1, 0.05, 0.2] } }, hit: { hr: { p: [0.22, 0.05, 0.62] }, hl: { p: [-0.22, 0.05, 0.62] }, body: { r: [0.25, 0, 0] }, mouth: 0.5 } },
  throw: { wind: { hr: { p: [0.2, 0.75, 0] }, hl: { p: [-0.2, 0.75, 0] }, body: { r: [-0.3, 0, 0] } }, hit: { hr: { p: [0.2, 0.2, 0.7] }, hl: { p: [-0.2, 0.2, 0.7] }, body: { r: [0.5, 0, 0] }, mouth: 1 } },
  // specials (generic shapes; characters may override)
  throw1: { wind: { hr: { p: [0.05, 0.45, -0.35] }, body: { r: [-0.25, 0.45, 0] } }, hit: { hr: { p: [0.2, 0.2, 0.7] }, body: { r: [0.35, -0.45, 0] }, mouth: 0.8 } },
  throw2: { wind: { hr: { p: [0.2, 0.7, -0.15] }, hl: { p: [-0.2, 0.7, -0.15] }, body: { r: [-0.35, 0, 0] } }, hit: { hr: { p: [0.2, 0.35, 0.7] }, hl: { p: [-0.2, 0.35, 0.7] }, body: { r: [0.4, 0, 0] }, mouth: 1 } },
  shotgun: { wind: { hr: { p: [0.2, 0.05, 0.4] }, hl: { p: [-0.1, 0.05, 0.45] } }, hit: { hr: { p: [0.2, 0.1, 0.55] }, hl: { p: [-0.1, 0.1, 0.6] }, body: { r: [-0.25, 0, 0] }, mouth: 1 } },
  tongue: { wind: { head: { p: [0, -0.02, 0.05] }, body: { s: [1.08, 0.92, 1.08] } }, hit: { head: { p: [0, 0, 0.12], r: [0.15, 0, 0] }, mouth: 1, body: { r: [0.2, 0, 0] } } },
  gulp: { wind: { head: { p: [0, 0, 0.1] } }, hit: { head: { p: [0, 0, 0.2] }, mouth: 1, body: { r: [0.25, 0, 0] } } },
  full: { wind: { body: { s: [1.45, 1.25, 1.45] } }, hit: { body: { s: [1.5, 1.3, 1.5] }, hr: { p: [-0.25, 0, 0] }, hl: { p: [0.25, 0, 0] } } },
  frogleap: { wind: { body: { p: [0, -0.15, 0], s: [1.25, 0.7, 1.25] } }, hit: { body: { s: [0.8, 1.35, 0.8] }, fr: { p: [0, -0.2, 0] }, fl: { p: [0, -0.2, 0] }, spin: 1, mouth: 1 } },
  jupiter: { wind: { body: { s: [1, 1, 1] }, hr: { p: [0, 0.6, 0.1] }, hl: { p: [0, 0.6, 0.1] } }, hit: { hr: { p: [0.15, 0.85, 0] }, hl: { p: [-0.15, 0.85, 0] }, head: { r: [-0.4, 0, 0] }, mouth: 1, eyes: 1 } },
  decree: { wind: { hr: { p: [0.25, 0.8, 0] }, hl: { p: [-0.25, 0.8, 0] }, head: { r: [-0.3, 0, 0] } }, hit: { hr: { p: [0.2, 0.25, 0.55] }, hl: { p: [-0.2, 0.25, 0.55] }, body: { r: [0.35, 0, 0] }, mouth: 1, eyes: 1 } },
  soda: { wind: { hr: { p: [0.2, 0.3, 0.2] }, hl: { p: [-0.2, 0.3, 0.2] } }, hit: { hr: { p: [0.2, 0.75, 0] }, hl: { p: [-0.2, 0.75, 0] }, body: { s: [0.9, 1.15, 0.9] }, mouth: 1 } },
  bellyflop: { wind: { body: { s: [1.15, 0.85, 1.15] }, hr: { p: [0, 0.6, 0] }, hl: { p: [0, 0.6, 0] } }, hit: { body: { r: [1.2, 0, 0], s: [1.25, 0.8, 1.25] }, hr: { p: [-0.3, 0.2, 0.3] }, hl: { p: [0.3, 0.2, 0.3] }, mouth: 1, eyes: 1 } },
  grate: { wind: { hr: { p: [0.1, 0.15, 0.45] } }, hit: { hr: { p: [0.15, 0.1, 0.65] }, mouth: 1, eyes: 1, grate: 1 } },
  sprinkle: { wind: { hr: { p: [0.1, 0.45, 0.3] } }, hit: { hr: { p: [0.1, 0.3, 0.3] }, grate: 1, mouth: 0.5 } },
  helico: { wind: { hr: { p: [0.35, 0.9, 0] }, hl: { p: [-0.35, 0.9, 0] } }, hit: { hr: { p: [0.35, 0.95, 0] }, hl: { p: [-0.35, 0.95, 0] }, mouth: 1, propSpin: 1 } },
  zip: { wind: { body: { s: [0.8, 1.2, 0.8] } }, hit: { body: { s: [0.75, 1.3, 0.75], r: [0.8, 0, 0] }, hr: { p: [0, 0, -0.4] }, hl: { p: [0, 0, -0.4] }, mouth: 1 } },
  thunder: { wind: { hr: { p: [0.2, 0.8, 0] }, hl: { p: [-0.2, 0.8, 0] } }, hit: { hr: { p: [0.3, 0.95, 0] }, hl: { p: [-0.3, 0.95, 0] }, body: { s: [1.1, 1.1, 1.1] }, head: { r: [-0.5, 0, 0] }, mouth: 1, eyes: 1 } },
  bite: { wind: { body: { r: [-0.3, 0, 0] }, head: { r: [-0.4, 0, 0] } }, hit: { body: { r: [0.35, 0, 0] }, head: { p: [0, 0, 0.15], r: [0.3, 0, 0] }, mouth: 1, eyes: 1 } },
  sprint: { wind: { body: { r: [0.5, 0, 0] } }, hit: { body: { r: [0.6, 0, 0] }, run: 2, mouth: 0.6 } },
  breach: { wind: { body: { p: [0, -0.15, 0], s: [1.2, 0.8, 1.2] } }, hit: { body: { r: [-0.6, 0, 0], s: [0.9, 1.2, 0.9] }, spin: 1, mouth: 1 } },
  dive: { wind: { body: { r: [0.8, 0, 0] } }, hit: { body: { r: [0.9, 0, 0] } } },
  tungtung: { wind: { hr: { p: [0.2, 0.55, -0.25] }, body: { r: [-0.2, 0.3, 0] } }, hit: { hr: { p: [0.2, 0.0, 0.6] }, body: { r: [0.35, -0.3, 0] }, mouth: 1, prop: { r: [-1.4, 0, 0] } } },
  drum: { wind: { hr: { p: [0.15, 0.7, 0.3] }, hl: { p: [-0.15, 0.7, 0.3] } }, hit: { hr: { p: [0.15, -0.1, 0.45] }, hl: { p: [-0.15, -0.1, 0.45] }, body: { r: [0.4, 0, 0], s: [1.1, 0.9, 1.1] }, mouth: 1, prop: { r: [-1.6, 0, 0] } } },
};

// timeline of a move: windup until the first active frame, strike while active, then recovery
export function moveTimeline(M) {
  if (M._tl) return M._tl;
  if (M.timeline) { M._tl = { a: M.timeline.a, b: M.timeline.b, dur: M.dur }; return M._tl; }
  let a = Infinity, b = -1;
  for (const h of M.hits || []) { a = Math.min(a, h.f[0]); b = Math.max(b, h.f[1]); }
  if (!isFinite(a)) { a = Math.min(8, Math.floor(M.dur * 0.3)); b = Math.min(M.dur - 1, a + 6); }
  if (M.charge) a = Math.max(a, M.charge.at + 1);
  M._tl = { a, b, dur: M.dur };
  return M._tl;
}

// pose target for a fighter (F is the rendered fighter state, L its layout, t global time)
export function computePose(F, M, L, t, overrides) {
  const P = clone(L.rest);
  const st = F.state;
  const h = L.height;
  const run = (speed, amp) => {
    const c = Math.sin(t * speed), c2 = Math.cos(t * speed);
    P.fr.p[2] += c * amp; P.fl.p[2] -= c * amp;
    P.fr.p[1] += Math.max(0, c2) * amp * 0.6; P.fl.p[1] += Math.max(0, -c2) * amp * 0.6;
    P.fm.p[2] += Math.sin(t * speed + 2) * amp; P.fm.p[1] += Math.max(0, Math.sin(t * speed + 3.6)) * amp * 0.5;
    P.hr.p[2] -= c * amp * 0.9; P.hl.p[2] += c * amp * 0.9;
    P.body.p[1] += Math.abs(c) * amp * 0.25;
    P.body.r[0] += 0.12 * amp;
  };
  switch (st) {
    case 'idle': {
      const b = Math.sin(t * 3.1);
      P.body.p[1] += b * 0.02 * h; P.body.s[1] += b * 0.025; P.body.s[0] -= b * 0.015; P.body.s[2] -= b * 0.015;
      P.head.p[1] += b * 0.025 * h; P.hr.p[1] += Math.sin(t * 3.1 + 0.6) * 0.03 * h; P.hl.p[1] += Math.sin(t * 3.1 + 0.9) * 0.03 * h;
      break;
    }
    case 'walk': run(9, 0.18); break;
    case 'run': run(15, 0.32); P.body.r[0] += 0.18; P.hr.p[1] += 0.05; P.hl.p[1] += 0.05; break;
    case 'jumpsquat': P.body.s[0] += 0.22; P.body.s[1] -= 0.28; P.body.s[2] += 0.22; P.body.p[1] -= 0.1 * h; P.head.p[1] -= 0.15 * h; break;
    case 'land': P.body.s[0] += 0.18; P.body.s[1] -= 0.22; P.body.s[2] += 0.18; P.body.p[1] -= 0.08 * h; P.head.p[1] -= 0.12 * h; break;
    case 'air': case 'tumble': {
      const up = F.vy > 0;
      P.fr.p[1] += up ? 0.1 * h : 0.02; P.fl.p[1] += up ? 0.18 * h : 0.05; P.fr.p[2] += 0.08;
      P.hr.p[1] += up ? 0.18 * h : 0.3 * h; P.hl.p[1] += up ? 0.12 * h : 0.32 * h;
      P.body.s[1] += up ? 0.08 : -0.03;
      if (st === 'tumble') { P.body.r[0] += t * 9; P.spin = 0; }
      break;
    }
    case 'helpless': {
      P.hr.p[1] += 0.35 * h; P.hl.p[1] += 0.35 * h; P.fr.p[1] += 0.1 * h;
      P.body.r[2] += Math.sin(t * 7) * 0.2; P.eyes = 2; P.mouth = 0.6;
      break;
    }
    case 'hitstun': {
      const k = Math.sin(t * 30) * 0.6;
      P.body.r[0] -= 0.5; P.head.r[0] -= 0.4;
      P.hr.p[1] += 0.35 * h; P.hl.p[1] += 0.3 * h; P.hr.p[2] -= 0.3; P.hl.p[2] -= 0.25;
      P.fr.p[2] += 0.35; P.fl.p[2] -= 0.15; P.fr.p[1] += 0.2 * h;
      P.hr.p[0] += k * 0.1; P.hl.p[0] -= k * 0.1;
      P.eyes = 2; P.mouth = 1;
      if (F.launchSpin) P.body.r[0] -= t * 14;
      break;
    }
    case 'down': P.body.p[1] = 0.22 * h; P.body.r[0] = -1.45; P.head.p[1] = 0.25 * h; P.head.p[2] = -0.65 * h; P.fr.p[2] += 0.5; P.fl.p[2] += 0.45; P.hr.p[2] -= 0.2; P.hl.p[2] -= 0.2; P.eyes = 2; break;
    case 'getup': case 'tech': P.body.s[1] -= 0.15; P.body.s[0] += 0.1; P.body.s[2] += 0.1; break;
    case 'shield': P.body.s[0] += 0.08; P.body.s[1] -= 0.12; P.body.s[2] += 0.08; P.hr.p = [-0.2, h * 0.5, 0.45]; P.hl.p = [0.2, h * 0.5, 0.45]; P.head.p[1] -= 0.05 * h; break;
    case 'dodge': case 'airdodge': P.body.s = [0.8, 0.8, 0.8]; P.body.r[0] = F.st * 0.4; P.hr.p = [-0.15, h * 0.4, 0.2]; P.hl.p = [0.15, h * 0.4, 0.2]; P.fr.p[1] += 0.2 * h; P.fl.p[1] += 0.2 * h; break;
    case 'ledge': P.hr.p = [-0.3, h * 1.25, 0.3]; P.hl.p = [0.3, h * 1.25, 0.3]; P.body.p[1] += 0.12 * h; P.fr.p[2] -= 0.1; P.fr.p[1] += Math.max(0, Math.sin(t * 4)) * 0.15; break;
    case 'grabbing': P.hr.p = [-0.25, h * 0.48, 0.65]; P.hl.p = [0.25, h * 0.48, 0.65]; if (F.va && F.va[0] > 0.5) { P.hr.p[1] += 0.2; } P.mouth = 0.5; break;
    case 'grabbed': case 'held': {
      const k = Math.sin(t * 20);
      P.hr.p[1] += 0.3 * h + k * 0.1; P.hl.p[1] += 0.3 * h - k * 0.1; P.fr.p[2] += k * 0.2; P.fl.p[2] -= k * 0.2; P.eyes = 2; P.mouth = 1;
      break;
    }
    case 'dizzy': case 'stunned': P.body.r[2] = Math.sin(t * 3) * 0.3; P.head.r[2] = Math.sin(t * 3 + 0.5) * 0.4; P.hr.p[1] -= 0.1; P.hl.p[1] -= 0.1; P.eyes = 3; P.mouth = 0.4; break;
    case 'respawn': P.hr.p[1] += 0.2 * h; P.hl.p[1] += 0.2 * h; P.hr.p[0] -= 0.1; P.hl.p[0] += 0.1; break;
    default: break;
  }

  if (st === 'move' && M) {
    const key = (overrides && overrides[F.move]) ? F.move : M.pose;
    const A = (overrides && (overrides[F.move] || overrides[M.pose])) || ATTACKS[M.pose];
    const tl = moveTimeline(M);
    const f = F.mf + (F.mv && F.mv.charge && F.mf === (M.charge && M.charge.at) ? 0 : 0);
    if (A) {
      if (A.custom) A.custom(P, F, M, L, t, tl);
      else {
        let kw = 0, kh = 0;
        if (f < tl.a) { kw = Math.min(1, (f + 1) / Math.max(1, tl.a)); }
        else if (f <= tl.b + 1) { kh = 1; }
        else { kh = Math.max(0, 1 - (f - tl.b - 1) / Math.max(1, (tl.dur - tl.b) * 0.7)); }
        if (M.charge && F.mf === M.charge.at && F.mv.charge > 0) { kw = 1; kh = 0; }
        if (kw > 0 && A.wind) offset(P, A.wind, kw, L);
        if (kh > 0 && A.hit) offset(P, A.hit, kh, L);
        if (A.hit && A.hit.spin && f >= tl.a && f <= tl.b + 4) P.body.r[1] += (f - tl.a) * 0.9;
        if (A.hit && A.hit.run && f >= tl.a) run(22, 0.35);
        if (A.hit && A.hit.grate) { P.hr.p[2] += Math.sin(t * 60) * 0.12; P.hr.p[1] += Math.cos(t * 60) * 0.05; }
        P.key = key;
      }
    }
    if (M.charge && F.mf === M.charge.at && F.mv && F.mv.charge > 0) {
      const c = F.mv.charge / M.charge.max;
      P.shake = 0.03 + c * 0.06;
      P.charge = c;
    }
  }
  return P;
}
