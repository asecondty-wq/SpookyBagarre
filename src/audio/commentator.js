// The zany commentator: short shouts on the big moments, spoken by the browser's speech synthesis
// (Audio.comment: never over another voice, never twice in a row the same line, a little pause between two).
const LINES = {
  bigHit: ['Grosse patate !', 'Oh la mandale !', 'Pleine poire !', 'Quelle tarte !', 'Bim, dans les dents !', 'Il l\'a pas volée, celle-là !',
    'Ça, c\'est du gratin !', 'Oh la châtaigne !', 'Prends ça dans ta face !', 'Paf, le chien !', 'Mais quelle beigne !', 'Il va le sentir demain, celle-là !'],
  hugeHit: ['Mais c\'est une boucherie !', 'Il est où son dentier ?', 'On appelle le Samu ?', 'Ah, ça, c\'est interdit dans quarante pays !',
    'J\'ai jamais vu ça de ma vie !', 'Mais il est fou, lui !'],
  ko: ['Aïe, ça doit faire mal !', 'Au revoir, à jamais !', 'Il est parti chercher du pain !', 'Bon voyage !', 'On le reverra pas de sitôt !',
    'Direction la lune !', 'Et il s\'envole, comme une crêpe !', 'Bye bye !', 'Il a pris un aller simple !', 'Adieu, petit ange !'],
  fall: ['Plouf ! Dans le vide !', 'Il a oublié de sauter !', 'Et il tombe comme une pierre !', 'Le vide, ça pardonne pas !', 'Oups ! La chute !'],
  lastStock: ['Plus qu\'une vie ! Ça sent le sapin !', 'Dernière vie ! On serre les fesses !'],
  red: ['Il est tout rouge, il va exploser !', 'Il a plus de pourcentage que de cerveau !', 'Ça sent le roussi, là !'],
  shieldBreak: ['Son bouclier a pété !', 'Oups, plus de bouclier !', 'Le bouclier, c\'est en carton !'],
  parry: ['Quelle parade ! Magnifique !', 'Oh, la parade de ouf !', 'Il a tout vu venir !'],
  tech: ['Joli rattrapage !', 'Retombé sur ses pattes !'],
  kame: ['Mais c\'est quoi ce rayon ?!', 'Il a mangé une centrale nucléaire !', 'Kamé quoi ? Kamé-ça-fait-mal !', 'Mais il va tout cramer !'],
  summon: ['Il appelle ses copains, c\'est pas du jeu !', 'Hé ! C\'est du deux contre un !', 'Les renforts arrivent !'],
  bounce: ['Ça rebondit !', 'Il a fait boing !'],
  combo: ['Quel combo !', 'Il l\'enchaîne, il l\'enchaîne !', 'Il le lâche plus !'],
};

const last = {};
function pick(kind) {
  const L = LINES[kind];
  if (!L) return null;
  let i = Math.floor(Math.random() * L.length);
  if (L.length > 1 && i === last[kind]) i = (i + 1) % L.length;
  last[kind] = i;
  return L[i];
}

// combo detector: same attacker, same victim, three hits within 1.6 s
const streak = {};

export function commentate(ev, W, A) {
  if (!A || !A.comment) return;
  switch (ev.type) {
    case 'hit': {
      const kb = ev.kb || 0;
      if (kb > 165 && Math.random() < 0.75) return A.comment(pick('hugeHit'), 2);
      if (kb > 105 && Math.random() < 0.55) return A.comment(pick('bigHit'), 1);
      const V = W && W.fighters && W.fighters[ev.s];
      if (V && V.damage > 150 && Math.random() < 0.08) return A.comment(pick('red'), 0);
      if (ev.a >= 0) {
        const k = ev.a + ':' + ev.s, now = performance.now();
        const s = streak[k] && now - streak[k].t < 1600 ? streak[k] : { n: 0 };
        s.n++; s.t = now; streak[k] = s;
        if (s.n === 4 && Math.random() < 0.6) return A.comment(pick('combo'), 0);
      }
      return;
    }
    case 'ko': {
      const F = W && W.fighters && W.fighters[ev.s];
      const left = ev.left ?? (F ? F.stocks : 2);
      if (left === 1 && Math.random() < 0.5) return A.comment(pick('lastStock'), 2);
      return A.comment(pick(ev.kind === 'bottom' ? 'fall' : 'ko'), 2);
    }
    case 'shieldBreak': return A.comment(pick('shieldBreak'), 2);
    case 'parry': return Math.random() < 0.7 && A.comment(pick('parry'), 1);
    case 'tech': return Math.random() < 0.4 && A.comment(pick('tech'), 0);
    case 'bounce': return Math.random() < 0.3 && A.comment(pick('bounce'), 0);
    case 'kameFire': return (ev.c || 0) > 0.55 && Math.random() < 0.7 && A.comment(pick('kame'), 1, 1.3);
    case 'summon': return Math.random() < 0.35 && A.comment(pick('summon'), 0, 1.6);
    default:
  }
}
