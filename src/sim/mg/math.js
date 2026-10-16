// Calcul mental (math) : une opération au tableau (la même pour les deux, en même temps), trois réponses en bulles,
// chacune sur une direction (◀ ▲ ▶). Le stick (ou une flèche) d'un coup donne sa réponse ; il faut revenir au centre entre
// deux. Le premier juste marque (100 + la vitesse) et on passe à la suivante ; une fausse : -20 et la tête qui tourne LOCK
// images (l'autre peut encore répondre) ; personne à temps : la suivante. De plus en plus dur : petites additions, puis
// dizaines et soustractions, puis tables de multiplication. Le meilleur score gagne.
import { clampN, scorePayout, botLevel } from './common.js';

export const MATH = { LOCK: 40, GAP: 34, DL: 300, WRONG: 20 };

// la question n (0, 1, 2...) : [a, op, b, réponse, [trois réponses], la bonne (0 ◀, 1 ▲, 2 ▶)]
function makeQ(W, n) {
  const lv = n < 2 ? 0 : n < 4 ? 1 : 2, R = (a, b) => W.rng.int(a, b);
  let a, b, op, ans;
  const k = W.rng();
  if (lv === 0) { a = R(2, 9); b = R(2, 9); op = '+'; ans = a + b; }
  else if (lv === 1) {
    if (k < 0.55) { a = R(12, 39); b = R(3, 9); op = '+'; ans = a + b; } else { a = R(11, 19); b = R(3, 9); op = '-'; ans = a - b; }
  } else if (k < 0.7) { a = R(3, 9); b = R(3, 9); op = '×'; ans = a * b; }
  else { a = R(11, 39); b = R(11, 29); op = '+'; ans = a + b; }
  // les fausses : tout près (±1, ±2, ±10, la table d'à côté), jamais deux fois la même
  const near = op === '×' ? [ans + a, ans - a, ans + b, ans - b, ans + 1, ans - 1, ans + 10] : [ans + 1, ans - 1, ans + 2, ans - 2, ans + 10, ans - 10];
  const wrong = [];
  for (let t = 0; t < 20 && wrong.length < 2; t++) {
    const v = near[(W.rng() * near.length) | 0];
    if (v > 0 && v !== ans && wrong.indexOf(v) < 0) wrong.push(v);
  }
  while (wrong.length < 2) wrong.push(ans + 3 + wrong.length * 4);
  const ok = W.rng.int(0, 2), ch = [];
  for (let d = 0, w = 0; d < 3; d++) ch.push(d === ok ? ans : wrong[w++]);
  return { a, op, b, ans, ch, ok, lv };
}

export default {
  name: 'Calcul mental',

  init(W, A, V) {
    const pl = (F) => ({ s: 0, lock: 0, armed: 1, ok: 0, bad: 0, streak: 0, pick: -1, b: { k: 0.8 + W.rng() * 0.45, rt: 0, err: 0, seen: -1 } });
    void A; void V;
    return { ph: 'gap', t: 0, gap: 12, n: 0, q: null, p: [pl(), pl()], last: -1, over: 0 };
  },

  step(W, M, g, ia, iv) {
    g.t++;
    if (g.ph === 'gap' && g.t >= g.gap) {
      g.q = makeQ(W, g.n); g.n++; g.ph = 'q'; g.t = 0; g.last = -1;
      for (const P of g.p) { P.lock = 0; P.pick = -1; }
      W.emit('mgMathQ', { n: g.n, lv: g.q.lv });
    }
    const ins = [ia, iv], good = [];
    for (let i = 0; i < 2; i++) {
      const P = g.p[i];
      if (P.lock > 0) P.lock--;
      const I = ins[i];
      let d = -1;
      if (I) {
        const ax = Math.abs(I.mx), ay = Math.abs(I.my);
        if (ax < 0.35 && ay < 0.35) P.armed = 1;
        else if (P.armed && Math.max(ax, ay) > 0.6) { P.armed = 0; d = ax >= ay ? (I.mx > 0 ? 2 : 0) : (I.my > 0 ? 1 : -1); }
      } else d = mathBot(W, M, g, P, i);
      if (d < 0 || g.ph !== 'q' || P.lock > 0) continue;
      P.pick = d;
      if (d === g.q.ok) good.push(i);
      else {
        P.lock = MATH.LOCK; P.bad++; P.streak = 0; P.s = Math.max(0, P.s - MATH.WRONG);
        W.emit('mgMathWrong', { p: i, d, v: g.q.ch[d] });
      }
    }
    if (g.ph !== 'q') return;
    if (good.length) {
      for (const i of good) {
        const P = g.p[i], pts = 100 + Math.round(60 * clampN(1 - g.t / 180, 0, 1));
        P.s += pts; P.ok++; P.streak++;
        W.emit('mgMathGood', { p: i, d: g.q.ok, pts, f: g.t, st: P.streak, both: good.length > 1 ? 1 : 0 });
      }
      g.last = good.length > 1 ? 2 : good[0];
      g.ph = 'gap'; g.t = 0; g.gap = MATH.GAP;
    } else if (g.t >= MATH.DL) {
      for (const P of g.p) P.streak = 0;
      W.emit('mgMathLate', { ans: g.q.ans });
      g.ph = 'gap'; g.t = 0; g.gap = MATH.GAP;
    }
  },

  result(W, M, g) {
    return scorePayout(W, M, g.p[0].s, g.p[1].s, 15, 25, 70, { oa: g.p[0].ok, ov: g.p[1].ok });
  },
};

// le CPU : le temps de calculer (plus long pour une multiplication), parfois il se trompe ; après une erreur, il relit
function mathBot(W, M, g, P, i) {
  const b = P.b, lvl = botLevel(W, M, i);
  if (g.ph !== 'q' || P.lock > 0) return -1;
  if (b.seen !== g.n * 10 + P.bad) {
    b.seen = g.n * 10 + P.bad;
    const hard = g.q.op === '×' ? 1.35 : g.q.lv === 2 ? 1.25 : g.q.lv === 1 ? 1.1 : 1;
    b.rt = Math.round(([64, 44, 34][lvl - 1] + W.rng() * [56, 38, 30][lvl - 1]) * b.k * hard);
    b.err = W.rng() < [0.26, 0.13, 0.05][lvl - 1] * hard ? 1 : 0;
  }
  if (--b.rt > 0) return -1;
  b.rt = 999;
  if (b.err) { b.err = 0; return (g.q.ok + 1 + ((W.rng() * 2) | 0)) % 3; }
  return g.q.ok;
}
