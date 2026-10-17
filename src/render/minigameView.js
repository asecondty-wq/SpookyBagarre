// Affichage des ultis (src/sim/minigames.js). Il ne fait que lire W.mg :
//  - duel au pistolet : écran partagé dans l'arène même (une caméra par tireur, à hauteur de ses yeux, Renderer.split),
//    les deux combattants sont de faux combattants nourris par le mini-jeu ; tombes, pistolets, traçantes, sang ; HUD à
//    la Call of Duty (radar, munitions, fil des éliminations, marques de touche, +100, séries) ;
//  - duel de bonbons, tiercé de la pinte (une télé cathodique, deux pintes), la bonne parole : dessinés en 2D par-dessus
//    le match figé et assombri ;
//  - pour tous : annonce (les deux têtes face à face), chrono, puis l'écran « EZ WIN » avec la tête du gagnant.
// Tout est dessiné sur un canevas par-dessus tout, dans une grille virtuelle 640 x 360. Les joueurs y sont leurs vrais
// modèles 3D (marionnettes, src/render/puppets.js) à grosse tête, qui réagissent à tout (this.react / this.actor).
import * as THREE from 'three';
import { cacheCanvasText, spriteBudget } from './textSprites.js';
import { DUEL, CANDY, HORSES, QUESTIONS, MORAL, DANCE, SURGERY, MG_INTRO, MG_PLAY, MG_WIN, MG_RESUME, MG_READY, HURT_AT, mgOutro, mgLeft, duelEye, duelHead, duelVar, ULTI_NAMES } from '../sim/minigames.js';
import { duelScoped } from '../sim/mg/duel.js';
import { EMOTES } from './rig/nativeMoves.js';
import { EXTRA_VIEWS } from './mg/index.js';
import { drawPuppet, setPuppetQuality } from './puppets.js';
import { FighterView } from './fighterView.js';
import { COLORS } from '../sim/constants.js';
import { CHARS } from '../sim/chars/index.js';
import { Input } from '../core/input.js';
import { glowTex } from './materials.js';
import { portraitURL } from '../ui/hud.js';
import { ACCOUNTS } from '../ui/toktok.js';

const RIGHT = Math.PI / 2, LEFT = -Math.PI / 2;
const ZERO6 = [0, 0, 0, 0, 0, 0];
const CANDY_COL = ['#ff3355', '#ff9a1f', '#ffe23a', '#4ee05a', '#3ab8ff', '#b45cff'];
const CANDY_DARK = ['#8a0f25', '#8a4a06', '#8a7406', '#1d7a26', '#0f5a8a', '#5a1d8a'];
const CHAIN_WORDS = ['', 'Sucré !', 'Délicieux !', 'Divin !', 'Démoniaque !', 'BAGARRE SUCRÉE !'];
const STREAKS = ['', '', 'DOUBLE KILL', 'TRIPLE KILL', 'MULTI KILL', 'MÉGA KILL'];
const CELL = 26, BW = CANDY.W * CELL, BH = CANDY.H * CELL;
const BOARD_X = [320 - 26 - BW, 320 + 26], BOARD_Y = 78;
const TITLES = { fps: 'DUEL AU PISTOLET', candy: 'BAGARRE SUCRÉE', horses: 'TIERCÉ DE LA PINTE', moral: 'LA BONNE PAROLE', dance: 'DANSE KAWAII', surgery: 'BISTOURI BAGARRE' };
const TITLE_COL = { fps: '#ff4a3a', candy: '#ff8ad0', horses: '#f0c020', moral: '#7ee0ff', dance: '#ff9ae8', surgery: '#5affc8' };
const ICONS = { fps: '🔫', candy: '🍬', horses: '🐎', moral: '😇', dance: '💃', surgery: '🩺' };
// le but de chaque jeu en une phrase toute simple (écrite et dite pendant la présentation), et ses commandes : une liste
// [touche, action] pour tous, ou { pad, kb, kb1 } quand elles changent (kb1 : Clavier 1, qui a aussi la souris).
// Touches : dirs (les 4 directions), lr (gauche / droite), up, down, stick, rstick (stick droit), mouse, A, X, JUMP...
const GOALS = {
  fps: 'Tire dans la tête de l\'autre : 3 fois et tu gagnes !',
  candy: 'Aligne 3 bonbons pareils : le plus de points gagne !',
  horses: 'Choisis un cheval et fouette-le jusqu\'à l\'arrivée !',
  moral: 'Choisis vite la réponse gentille !',
  dance: 'Appuie sur la flèche quand elle touche la ligne !',
  surgery: 'Retire les objets du patient sans toucher les bords !',
};
const KEYS = {
  fps: (M) => {
    const F = FPS_VARS[duelVar(M.g).id], fire = F.fire || 'tirer';
    return {
      pad: [['stick', 'bouger'], ['rstick', 'viser'], ['A', fire], ['JUMP', F.jumps || 'sauter'], ['GRAB', 'accroupi / glisser'], ['X', 'recharger']],
      kb: [['dirs', 'bouger'], ['A', fire], ['SHIELD', 'viser la tête'], ['GRAB', 'accroupi / glisser'], ['JUMP', F.jumps || 'sauter']],
      kb1: [['dirs', 'bouger'], ['mouse', 'viser'], ['A', fire], ['GRAB', 'accroupi / glisser'], ['JUMP', F.jumps || 'sauter'], ['X', 'recharger']],
    };
  },
  candy: [['dirs', 'choisir'], ['A', 'prendre'], ['dirs', 'échanger']],
  horses: [['lr', 'choisir'], ['A', 'fouetter'], ['X', 'boire = turbo']],
  moral: [['lr', 'répondre']],
  dance: [['dirs', 'la flèche']],
  surgery: { pad: [['stick', 'la pince'], ['A', 'tenir = tirer']], kb: [['dirs', 'la pince'], ['A', 'tenir = tirer']], kb1: [['dirs', 'la pince'], ['mouse', 'aussi'], ['A', 'tenir = tirer']] },
};
// le nom des touches selon l'appareil du joueur (Clavier 1 : ZQSD d'un clavier AZERTY ; Clavier 2 : flèches et pavé numérique)
const KEY_NAMES = {
  kb1: { dirs: 'ZQSD', stick: 'ZQSD', lr: 'Q D', up: 'Z', down: 'S', A: 'J', X: 'K', JUMP: 'ESPACE', SHIELD: 'SHIFT', GRAB: 'E', mouse: 'SOURIS' },
  kb2: { dirs: '← ↑ → ↓', stick: '← ↑ → ↓', lr: '← →', up: '↑', down: '↓', A: 'NUM 1', X: 'NUM 2', JUMP: 'NUM 0', SHIELD: 'NUM 3', GRAB: 'NUM 4' },
  pad: { dirs: 'STICK', stick: 'STICK', lr: 'STICK ◀ ▶', up: 'STICK ▲', down: 'STICK ▼', rstick: 'STICK DROIT', A: 'A', X: 'X', JUMP: 'B', SHIELD: 'GÂCHETTE', GRAB: 'LB' },
};
const TEXT_CACHE = new Map(); // les textes déjà écrits (text) : leur petite image
if (typeof document !== 'undefined' && document.fonts) document.fonts.addEventListener('loadingdone', () => TEXT_CACHE.clear());
// comment jouer, là où on joue, pour les jeux d'avant view.hint (les nouveaux le posent eux-mêmes) : où (J1, J2, dans
// la grille 640 x 360) et quoi, au plus deux actions ; écrit pour l'appareil de chacun
const LEGACY_HINTS = {
  candy: { at: [[205, 282], [435, 282]], keys: [['dirs', 'choisir'], ['A', 'échanger']] },
  horses: { at: [[131, 340], [509, 340]], keys: [['A', 'fouetter'], ['X', 'turbo']] },
  moral: { at: [[160, 306], [480, 306]], keys: [['lr', 'répondre']] },
  dance: { at: [[108, 338], [532, 338]], keys: [['dirs', 'la flèche sur la ligne']] },
  surgery: { at: [[163, 318], [481, 318]], keys: [['dirs', 'la pince'], ['A', 'tenir = tirer']] },
  slap: { at: [[173, 328], [483, 328]], keys: [['A', 'quand la jauge est en haut']] },
  frisbee: { at: [[120, 62], [520, 62]], keys: [['dirs', 'courir'], ['A', 'lancer / attraper']] },
  coins: { at: [[70, 78], [570, 78]], keys: [['lr', 'bouger'], ['A', 'gifler']] },
  dog: { at: [[160, 296], [480, 296]], keys: [['dirs', 'frotter'], ['A', 'doucement']] },
  climb: { at: [[165, 336], [475, 336]], keys: [['lr', 'courir'], ['JUMP', 'sauter']] },
};
// les sept variantes du duel au pistolet (src/sim/mg/duel.js DUEL_VARIANTS) : titre, but, arme, couleur, voile sur l'image
const FPS_VARS = {
  colt: { title: 'DUEL : PÉTOIRES', goal: 'Tire dans la tête de l\'autre : 3 fois et tu gagnes !', gun: 'PÉTOIRE .44', say: 'Feu !', col: '#ff4a3a' },
  pompe: { title: 'DUEL : FUSIL À POMPE', goal: 'Colle-toi à lui et fais parler la pompe : 4 fois !', gun: 'POMPE CAL. 12', say: 'Pompe !', col: '#ff7a2a', tint: 'rgba(255,70,20,0.07)' },
  akimbo: { title: 'DUEL : AKIMBO', goal: 'Deux flingues, rafale sans fin : 5 éliminations !', gun: 'AKIMBO UZI', say: 'Arrosez !', col: '#7cff5a', fire: 'tenir = rafale', tint: 'rgba(80,255,60,0.05)' },
  rail: { title: 'DUEL : RAILGUN', goal: 'Charge, vise la tête, lâche : un tir, un mort !', gun: 'RAILGUN', say: 'Chargez !', col: '#5ae8ff', fire: 'tenir = charger', tint: 'rgba(120,60,255,0.08)' },
  roquette: { title: 'DUEL : ROQUETTES', goal: 'Envoie tes roquettes, saute pour esquiver les siennes !', gun: 'LANCE-ROQUETTES', say: 'Boum !', col: '#ffb030', tint: 'rgba(255,140,30,0.06)' },
  lune: { title: 'DUEL SUR LA LUNE', goal: 'Gravité lunaire : triple saut, tire en volant !', gun: 'PÉTOIRE .44', say: 'Décollage !', col: '#a8c8ff', jumps: '3 sauts', tint: 'rgba(60,110,255,0.10)' },
  awp: { title: 'DUEL : AWP', goal: 'De très loin : tiens pour viser à la lunette, lâche pour tirer !', gun: 'AWP', say: 'Un tir, un mort.', col: '#7cd85a', fire: 'tenir = lunette, lâcher = tir', zoom: 16 },
  champs: { title: 'DUEL : SNIPER DES CHAMPS', goal: 'À la lunette en permanence : vise la tête, c\'est fini !', gun: 'M40A3', say: 'Respirez...', col: '#c8a040', zoom: 22 },
  noir: { title: 'DUEL : NOIR TOTAL', goal: 'Il fait tout noir : repère-le aux flashs et tire !', gun: 'PÉTOIRE .44', say: 'Lumière !', col: '#ffe24a' },
};
const fpsVar = (M) => FPS_VARS[duelVar(M.g).id];
// le titre et le but d'un mini-jeu (le duel a les siens, selon sa variante)
const titleOf = (M) => (M.kind === 'fps' ? fpsVar(M).title : TITLES[M.kind]);
const goalOf = (M) => (M.kind === 'fps' ? fpsVar(M).goal : GOALS[M.kind]) || '';

const LANE_COL = ['#ff7ac8', '#7ad8ff', '#a8ff7a', '#ffd27a'];
const LANE_ROT = [Math.PI, Math.PI / 2, -Math.PI / 2, 0];
const ITEMS = ['🦆', '🍕', '💿', '🔑', '🧦', '🍌', '🎲', '🐟', '⚽', '🧸', '🌶️', '🍺'];
const DANCES = ['dance_01', 'dance_02', 'dance_03', 'dance_04', 'dance_05', 'dance_06'];
const PINT_X = [128, 512], FAN_X = [48, 592]; // tiercé : les pintes, les parieurs
const MORAL_GX = [215, 425], MORAL_PX = [85, 555]; // bonne parole : les mondes, les prêcheurs
const SURG_X = [40, 600]; // bistouri : les chirurgiens
const ACH = {
  fps: [['Tireur d\'élite', 'Pas de quartier'], ['Passoire humaine', 'Bon pour la morgue']],
  candy: [['Sugar Daddy', 'Dents en sucre'], ['Diabète de combat', 'Caramel mou']],
  horses: [['Roi du PMU', 'Turfiste de génie'], ['Parieur ruiné', 'Mauvais cheval']],
  moral: [['Saint patron', 'Gandhi de la Bagarre'], ['Hérétique certifié', 'Âme damnée']],
  dance: [['Kawaii no Kami', 'Pieds de fée'], ['Deux pieds gauches', 'Canard boiteux']],
  surgery: [['Docteur Maboul', 'Mains d\'or'], ['Boucher du dimanche', 'Radié de l\'Ordre']],
};
const NEWS = {
  fps: (L, d) => `${L} CRIBLÉ DE BALLES AU DUEL : ${d} % DANS LA VUE`,
  candy: (L, d) => `${L} INTOXIQUÉ AUX BONBONS, LES MÉDECINS PARLENT DE ${d} %`,
  horses: (L, d) => `${L} PERD TOUT AU TIERCÉ, SA PINTE AUSSI (+${d} %)`,
  moral: (L, d) => `${L} EXCOMMUNIÉ EN DIRECT : ${d} % ET UN SERMON`,
  dance: (L, d) => `${L} : « J'AI DEUX PIEDS GAUCHES » (+${d} %)`,
  surgery: (L, d) => `OPÉRATION RATÉE : ${L} RECOUSU À LA VA-VITE (+${d} %)`,
};
// les jeux écrits chacun dans son fichier (src/render/mg/) apportent leur titre, leurs règles, leurs succès, leur titre de flash info
for (const [k, X] of Object.entries(EXTRA_VIEWS)) {
  TITLES[k] = X.title; TITLE_COL[k] = X.color; ICONS[k] = X.icon; GOALS[k] = X.goal; KEYS[k] = X.keys; ACH[k] = X.ach; NEWS[k] = X.news;
}
// l'humiliation d'après le mini-jeu : les toktoks qui se moquent du perdant ({n} : le perdant, {w} : le gagnant) et les
// commentateurs qui surgissent en bas de l'écran pour en rajouter
const TOK_VIDS = [
  { who: 'l', emote: 'sob', cap: 'pov : tu perds contre {w} 💀', tags: '#EZ #ratio #pourtoi' },
  { who: 'l', state: 'dizzy', cap: '{n} a pris un aller simple', tags: '#RIP #KO #fail' },
  { who: 'w', emote: 'victory_celebration', cap: 'quand tu ez {n} en direct', tags: '#EZ #GG #skill' },
  { who: 'w', emote: 'laugh_01', cap: 'la tête de {n} 😭😭', tags: '#mdr #humiliation #crypte' },
];
const TOK_COMS = ['RIP {n} 🪦', 'j\'ai ri pendant 3 min', '{n} désinstalle stp', 'c\'était scripté ??', 'le replay est encore pire 😭', 'on a tous un pote comme {n}', '{w} le goat 🐐', 'ratio + EZ + {n} dehors', 'qqn a vu {n} quelque part ?', 'je montre ça à ta mère {n}', 'même mon chat joue mieux', 'F à {n}'];
const MOCK_LINES = ['Ah, {n}... Quelle tristesse.', 'On me dit que {n} a déjà demandé une revanche.', 'C\'est pas une défaite, c\'est une leçon.', 'Je n\'avais jamais vu ça. Et je commente depuis 1987.', '{w} vient de l\'humilier en direct !', 'Quelqu\'un peut appeler la maman de {n} ?', 'On va devoir couper ça au montage.', 'Honnêtement ? Mérité.', '{n}, rentre chez toi.', 'Ça, c\'est ce qu\'on appelle une facture.'];
const TICKER = ['La bourse du % s\'envole', 'Météo : pluie de coups sur le ring', 'Un pigeon témoigne : « j\'ai tout vu »', 'Sondage : 98 % des fantômes veulent une revanche', 'Le cimetière affiche complet ce soir', 'Pénurie de mouchoirs dans la crypte'];

// l'écran de la télé cathodique, en unités de la grille 640 x 360 (16 / 9, comme le jeu qu'on y recopie)
const TV = { x: 36, y: 20, w: 512, h: 288 }; // (grand : la zone de jeu doit rester bien lisible)
const ease = (t) => 1 - (1 - t) * (1 - t);
const bounce = (t) => { const n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375; return n * (t -= 2.625 / d) * t + 0.984375; };
const back = (t) => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

const portraits = {};
function portrait(char) {
  if (!portraits[char]) { const im = new Image(); im.src = portraitURL(char); portraits[char] = im; }
  return portraits[char];
}

export class MinigameView {
  constructor(mv, opts = {}) {
    this.mv = mv;
    this.app = mv.app;
    this.R = mv.app.renderer;
    this.deviceOf = opts.deviceOf || (() => null);
    this.names = opts.names || {};
    this.cv = document.createElement('canvas');
    this.cv.className = 'mg-overlay';
    this.cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:4';
    this.app.ui.appendChild(this.cv);
    this.g = this.cv.getContext('2d');
    cacheCanvasText(this.g); // (each text written once into a small image: textSprites.js)
    this.key = null; this.fpsOn = false;
    this.time = 0;
    this.reset();
    this.pst = [{ state: '', t0: 0 }, { state: '', t0: 0 }];
    this.tmpV = new THREE.Vector3();
    for (const F of mv.W.list) portrait(F.char); // chargées d'avance
    // la qualité des mini-jeux (2 : tout ; 1 : image de la télé plus petite, fond en définition 1, moins de particules ;
    // 0 : petites machines : sans filtre cathodique, marionnettes en basse définition, ombres figées dans le duel). Elle
    // baisse toute seule si les images traînent (adaptQuality), et reste baissée pour la suite (app.mgQ) ; &mgq=0 en test.
    const pq = new URLSearchParams(location.search).get('mgq');
    // (une machine modeste, ou Safari, où les recopies d'images coûtent cher, commence d'un cran plus bas)
    const ua = navigator.userAgent || '', safari = /Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua);
    const modest = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4 || safari;
    this.q = pq !== null ? Math.max(0, Math.min(2, +pq | 0)) : (this.app.mgQ ?? (modest ? 1 : 2));
    this.slowT = 0; this.applyQuality();
  }

  reset() {
    this.floats = []; this.banner = null; this.boardShake = [0, 0]; this.shown = [0, 0];
    this.hit = [{ t: 0, kill: 0 }, { t: 0, kill: 0 }]; this.hurt = [0, 0]; this.xp = [[], []]; this.hb = [null, null];
    this.feed = []; this.radar = [-9, -9]; this.shake = [0, 0]; this.recoil = [0, 0]; this.muzzle = [0, 0]; this.slideT = [0, 0]; this.boomT = [0, 0]; this.matchPt = null;
    this.ticker = ''; this.tickerT = 0; this.sayT = 0; this.ans = [null, null];
    this.parts = []; this.stickers = []; this.jx = { shake: 0, punch: 0, flash: 0, col: '#ffffff', lines: 0, hype: 0 };
    this.beatT = 0; this.lastSec = -1; this.lastBeat = -1; this.hurtN = 0; this.dropT = this.time;
    this.dj = [null, null]; this.lane = [[0, 0, 0, 0], [0, 0, 0, 0]]; this.zapT = [0, 0];
    if (!this.toasts) this.toasts = [];
    this.mocks = []; this.tok = null; this.newsLater = null;
    this.rx = [null, null, null, null]; this.fanEm = [null, null]; // réactions des marionnettes (0, 1 : joueurs ; 2, 3 : patients)
    if (this.xs && this.xs.actorPre) this.xs.actorPre.dispose(); // (un acteur préparé d'avance et jamais servi)
    this.xs = {}; // l'état d'affichage libre du jeu en cours (src/render/mg/)
  }

  // --- la couche d'effets « TDAH » : particules, autocollants, secousses, coups de zoom, éclairs, lignes de vitesse --
  // (sur le canevas, en unités de la grille 640 x 360 ; rien de tout ça ne touche à la simulation)
  burst(x, y, n, colors, o = {}) {
    for (let i = 0; i < n && this.parts.length < (this.partCap || 700); i++) {
      const a = o.dir !== undefined ? o.dir + (Math.random() - 0.5) * (o.spread ?? 1.2) : Math.random() * Math.PI * 2;
      const sp = (o.speed ?? 160) * (0.35 + Math.random() * 0.8);
      this.parts.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.up ?? 60), g: o.g ?? 320, t: 0, life: (o.life ?? 0.8) * (0.6 + Math.random() * 0.6),
        s: (o.size ?? 4) * (0.6 + Math.random() * 0.8), c: colors[(Math.random() * colors.length) | 0], sh: o.shape || 'sq', ch: o.ch,
        r: Math.random() * 6, vr: (Math.random() - 0.5) * 16,
      });
    }
  }
  confetti(n = 60) { this.burst(320, -10, n, ['#ff3b3b', '#3b8bff', '#ffd23b', '#3bdc5a', '#ff8ad0', '#ffffff'], { dir: Math.PI / 2, spread: 2.6, speed: 140, up: -40, g: 160, life: 2, size: 5 }); }
  emojiRain(chs, n = 10) { for (let i = 0; i < n; i++) this.burst(Math.random() * 640, -20, 1, ['#fff'], { shape: 'txt', ch: chs[(Math.random() * chs.length) | 0], dir: Math.PI / 2, spread: 0.4, speed: 120, up: -60, g: 200, life: 2.2, size: 16 }); }
  sticker(text, x, y, o = {}) {
    if (this.stickers.length > 9) this.stickers.shift();
    this.stickers.push({ text, x, y, t: 0, life: o.life ?? 0.9, color: o.color ?? '#ffffff', size: o.size ?? 22, rot: o.rot ?? (Math.random() - 0.5) * 0.5, bg: o.bg ?? null });
  }
  jolt(shake = 0.5, punch = 0.04, flash = null, fa = 0.3) {
    const j = this.jx;
    j.shake = Math.max(j.shake, shake); j.punch = Math.max(j.punch, punch);
    if (flash) { j.col = flash; j.flash = Math.max(j.flash, fa); }
  }
  lines(t = 0.35) { this.jx.lines = Math.max(this.jx.lines, t); }
  hype(n = 0.3) { this.jx.hype = Math.min(1, this.jx.hype + n); }
  pick(list) { return list[(Math.random() * list.length) | 0]; }

  drawFx(M, dt) {
    const ctx = this.g, j = this.jx, L = -this.ox - 10, T = -this.oy - 10, Wd = 660 + this.ox * 2, Hd = 380 + this.oy * 2;
    // particules
    this.parts = this.parts.filter((p) => (p.t += dt) < p.life);
    for (const p of this.parts) {
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt; p.vx *= 1 - dt * 1.5;
      const a = Math.min(1, (p.life - p.t) / 0.25);
      ctx.save(); ctx.globalAlpha = a; ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
      if (p.sh === 'sq') ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      else if (p.sh === 'dot') { ctx.beginPath(); ctx.arc(0, 0, p.s / 2, 0, Math.PI * 2); ctx.fill(); }
      else if (p.sh === 'star') { ctx.beginPath(); for (let i = 0; i < 10; i++) { const an = i * Math.PI / 5, rr = i % 2 ? p.s * 0.4 : p.s; ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } ctx.closePath(); ctx.fill(); }
      else if (p.sh === 'shell') { ctx.fillStyle = '#0b0610'; ctx.fillRect(-3, -1.5, 6, 3); ctx.fillStyle = '#e8b030'; ctx.fillRect(-2.5, -1, 5, 2); }
      else { const fz = Math.max(6, Math.round(p.s * 1.6 / 4) * 4); ctx.scale(p.s * 1.6 / fz, p.s * 1.6 / fz); ctx.font = `${fz}px 'Apple Color Emoji','Segoe UI Emoji','Lilita One',sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.ch || '♥', 0, 0); } // (quelques tailles, mises à l'échelle : textSprites.js garde une image par taille)
      ctx.restore();
    }
    // autocollants qui claquent
    this.stickers = this.stickers.filter((k) => (k.t += dt) < k.life);
    for (const k of this.stickers) {
      const sc = k.t < 0.08 ? 2.4 - k.t / 0.08 * 1.6 : k.t < 0.16 ? 0.8 + (k.t - 0.08) / 0.08 * 0.25 : 1.05 + Math.sin(k.t * 22) * 0.04;
      const a = Math.min(1, (k.life - k.t) / 0.18);
      ctx.save(); ctx.translate(k.x, k.y - k.t * 8); ctx.rotate(k.rot + Math.sin(k.t * 30) * 0.03); ctx.scale(sc, sc);
      if (k.bg) {
        ctx.font = `${Math.round(k.size)}px 'Arial Black', Impact, sans-serif`;
        const w = ctx.measureText(k.text).width + 14;
        ctx.globalAlpha = a; ctx.fillStyle = '#0b0610'; ctx.fillRect(-w / 2 - 3, -k.size * 0.75 - 3, w + 6, k.size * 1.5 + 6);
        ctx.fillStyle = k.bg; ctx.fillRect(-w / 2, -k.size * 0.75, w, k.size * 1.5);
      }
      ctx.restore();
      ctx.save(); ctx.translate(k.x, k.y - k.t * 8); ctx.rotate(k.rot + Math.sin(k.t * 30) * 0.03); ctx.scale(sc, sc);
      this.text(k.text, 0, 0, k.size, k.color, { alpha: a, mono: true });
      ctx.restore();
    }
    // lignes de vitesse
    if (j.lines > 0) {
      j.lines -= dt;
      ctx.save(); ctx.globalAlpha = Math.min(0.55, j.lines * 2); ctx.strokeStyle = '#ffffff';
      for (let i = 0; i < 28; i++) {
        const a = Math.random() * Math.PI * 2, r0 = 150 + Math.random() * 80, r1 = r0 + 60 + Math.random() * 120;
        ctx.lineWidth = 1 + Math.random() * 3; ctx.beginPath(); ctx.moveTo(320 + Math.cos(a) * r0, 180 + Math.sin(a) * r0 * 0.7); ctx.lineTo(320 + Math.cos(a) * r1, 180 + Math.sin(a) * r1 * 0.7); ctx.stroke();
      }
      ctx.restore();
    }
    // les bords qui pulsent (arc-en-ciel) quand ça s'emballe
    j.hype = Math.max(0, j.hype - dt * 0.9);
    if (j.hype > 0.02) {
      const hue = (this.time * 360) % 360;
      ctx.save(); ctx.globalAlpha = j.hype * 0.8; ctx.strokeStyle = `hsl(${hue},100%,60%)`; ctx.lineWidth = 6 + j.hype * 6;
      ctx.strokeRect(L + 14, T + 14, Wd - 28, Hd - 28); ctx.restore();
    }
    // les 3 dernières secondes : le chiffre géant qui claque
    if (M && M.ph === 'play' && M.kind !== 'fps' && !(EXTRA_VIEWS[M.kind] && EXTRA_VIEWS[M.kind].countdown === false)) { // (le duel a son chrono)
      const left = (MG_PLAY - M.t) / 60;
      if (left <= 3 && left > 0) {
        const n = Math.ceil(left), f = n - left;
        ctx.save(); ctx.globalAlpha = 0.85 * (1 - f * 0.6);
        this.text(String(n), 320, 186, 120 * (1.4 - f * 0.5), '#ff3030', { title: true });
        ctx.restore();
        const gr = ctx.createRadialGradient(320, 180, 120, 320, 180, 380);
        gr.addColorStop(0, 'rgba(255,0,0,0)'); gr.addColorStop(1, `rgba(255,0,0,${0.35 * (1 - f)})`);
        ctx.fillStyle = gr; ctx.fillRect(L, T, Wd, Hd);
      }
    }
    // éclair
    if (j.flash > 0) { ctx.save(); ctx.globalAlpha = Math.min(0.7, j.flash); ctx.fillStyle = j.col; ctx.fillRect(L, T, Wd, Hd); ctx.restore(); j.flash = Math.max(0, j.flash - dt * 4); }
  }

  get audio() { return this.dry ? null : this.mv.fx.audio; }
  pname(slot) { return (this.names[slot] || 'J' + (slot + 1)).slice(0, 10); }
  label(W, slot) { const F = W.fighters[slot]; return `${this.pname(slot)} · ${CHARS[F.char].name}`; }

  // --- les combattants pendant le duel au pistolet -------------------------------------------------------------
  // null : affiché comme d'habitude ; 'hide' : caché ; sinon le faux combattant à afficher à sa place
  proxy(F, W) {
    const M = W.mg;
    const XV = M && EXTRA_VIEWS[M.kind];
    // (un jeu en 3D garde sa mise en scène jusqu'à ce que la télé soit partie : sinon les persos surgissaient dans l'arène
    // à « EZ WIN », sous la télé encore là, puis disparaissaient)
    const live3 = !!(XV && XV.enter3D && M.ph === 'outro' && M.t <= MG_WIN - 16);
    if (XV && XV.proxy && (M.ph === 'play' || live3)) return XV.proxy(this, F, W, M);
    if (M && (M.ph === 'intro' || (M.ph === 'outro' && M.kind !== 'fps' && !live3)) && (F.slot === M.a || F.slot === M.v)) return this.emoteProxy(F, W, M);
    if (!M || M.kind !== 'fps' || M.ph === 'intro') return null;
    const i = F.slot === M.a ? 0 : F.slot === M.v ? 1 : -1;
    if (i < 0) return 'hide';
    const g = M.g, P = g.p[i], p = Object.create(F);
    let state = P.dead > 0 ? (P.dead > DUEL.DEAD - 14 ? 'hitstun' : 'down') : P.flinch > 0 ? 'hitstun' : P.y > 0 ? 'air' : P.crouch ? 'crouch' : Math.hypot(P.vx || 0, P.vz) > 8 ? 'run' : Math.hypot(P.vx || 0, P.vz) > 1 ? 'walk' : 'idle';
    const ps = this.pst[i];
    if (state !== ps.state) { ps.state = state; ps.t0 = this.time; }
    p.x = P.x; p.y = g.gy + P.y; p.z = P.z;
    p.facing = P.sd > 0 ? RIGHT + 0.34 : LEFT - 0.34; // face à l'autre (FighterView tourne de 0,34 vers la caméra du combat)
    p.state = state; p.st = Math.round((this.time - ps.t0) * 60); p.move = null; p.mf = 0; p.af = -1; p.mv = {}; p.va = ZERO6;
    p.hitlag = 0; p.grounded = P.y <= 0; p.vx = 0; p.vy = P.vy; p.vz = P.vz; p.kx = p.ky = p.kz = 0;
    p.invuln = 0; p.intangible = 0; p.launchKb = 60; p.shieldStun = 0; p.out = false; p.grabbedBy = -1; p.speedMul = 1;
    return p;
  }

  // un duelliste qui se toise avec l'autre (sa provocation de la sélection), ou qui danse sa victoire
  emoteProxy(F, W, M) {
    const O = W.fighters[F.slot === M.a ? M.v : M.a], p = Object.create(F);
    const r = M.res || {};
    const kind = M.ph === 'intro' ? 'select' : r.w === F.slot ? 'win' : null;
    const e = kind && EMOTES[F.char] && EMOTES[F.char][kind];
    p.state = kind ? 'idle' : 'dizzy'; p.st = M.t; p.move = null; p.mf = 0; p.af = -1; p.mv = {}; p.va = ZERO6; p.hitlag = 0;
    p.grounded = true; p.vx = p.vy = p.vz = 0; p.kx = p.ky = p.kz = 0; p.invuln = 0; p.intangible = 0; p.out = false; p.grabbedBy = -1; p.speedMul = 1;
    p.facing = O.x > F.x ? RIGHT : LEFT;
    p.emote = e ? e.emote : null; p.emoteT = M.t / 60;
    return p;
  }

  // une marionnette 3D (src/render/puppets.js) : le vrai modèle du perso, animé, collé sur le canevas des mini-jeux
  // (le moteur des marionnettes les rend ensemble, une image sur 2 à 4 selon la qualité : src/render/puppets.js)
  puppet(char, x, y, h, o = {}) { return drawPuppet(this.g, char, x, y, h, o); }

  // la clé de la marionnette du joueur i du jeu (0 : M.a, 1 : M.v) ; deux fois le même perso = deux clés. L'explication,
  // l'écran EZ WIN et le flash info prennent 'w' + slot (jamais deux dessins de la même clé dans une image)
  pkey(W, M, i) { const a = W.fighters[M.a].char, v = W.fighters[M.v].char; return i === 0 ? a : a === v ? v + '#2' : v; }
  // les marionnettes du jeu se taisent dès que l'écran EZ WIN couvre tout
  pupOn(M) { return M.ph !== 'outro' || M.t < 6; }
  // une réaction exagérée de la marionnette i (0, 1 : joueurs ; 2, 3 : autres) pendant `life` s : `emote` ou `state`,
  // `hop` (saute, en hauteurs), `spin` (toupie, en tours), `tint` (`flick` : clignote), `shake`, `rot`, `head`, `pop` (écrasement) ; `weak` : n'interrompt pas une réaction plus forte
  react(i, o) { const r = this.rx[i]; if (o.weak && r && !r.weak && r.t < r.life) return; this.rx[i] = { t: 0, life: 1, ...o }; }
  actor(char, i, x, y, h, base = {}) {
    const o = { head: 1.7, ...base }, r = this.rx[i];
    let sq = o.squash ? o.squash.slice() : [1, 1];
    if (r) {
      r.t += this.dt || 0;
      if (r.t >= r.life) this.rx[i] = null;
      else {
        const u = r.t / r.life;
        if (r.emote !== undefined) { o.emote = r.emote; o.state = r.state || 'idle'; } else if (r.state) { o.state = r.state; o.emote = null; }
        if (r.kb) o.kb = r.kb;
        if (r.head) o.head = r.head;
        if (r.hop) y -= Math.abs(Math.sin(r.t * Math.PI * (r.hopF || 2.5))) * r.hop * h * (1 - u);
        if (r.spin) o.face = 0.34 + Math.min(1, u * 1.4) * Math.PI * 2 * r.spin;
        if (r.tint) { o.tint = r.tint; o.tintK = (r.tintK ?? 0.7) * (r.flick ? (Math.sin(r.t * 50) > 0 ? 1 : 0.15) : 1 - u); }
        if (r.shake) x += (Math.random() - 0.5) * r.shake * (1 - u);
        if (r.rot) o.rot = (o.rot || 0) + r.rot * Math.sin(u * Math.PI);
        const pop = Math.max(0, 1 - r.t / 0.2) * (r.pop ?? 0.3);
        sq = [sq[0] * (1 + pop), sq[1] * (1 - pop * 0.8)];
      }
    }
    o.squash = sq;
    return this.puppet(char, x, y, h, clipFor(char, o));
  }
  player(W, M, i, x, y, h, o = {}) { return this.actor(W.fighters[i === 0 ? M.a : M.v].char, i, x, y, h, { key: this.pkey(W, M, i), ...o }); }

  hideView(V) { V.root.visible = false; V.marker.visible = false; V.shadow.visible = false; V.cdRing.visible = false; V.slab.visible = false; }

  // --- évènements de la simulation : sons, effets, textes ---------------------------------------------------------
  onEvent(ev, W) {
    const A = this.audio, M = W.mg, P = this.mv.particles, R = this.R;
    const XV = M && EXTRA_VIEWS[M.kind];
    if (XV && XV.onEvent) XV.onEvent(this, ev, W, M);
    switch (ev.type) {
      case 'mgStart':
        // (tout doux : le combat se fige sous le fondu d'encre, qui découvre directement le jeu ; la voix dit le but)
        this.reset();
        R.kick('chroma', 0.4);
        if (A) { A.sfx('whoosh', 0, 0.8); A.sfx('bassDrop', 0, 0.5); if (M) A.say(goalOf(M), 0.5, 1.2); }
        break;
      case 'mgGo':
        R.kick('flash', 0.12);
        this.jolt(0.8, 0.1, TITLE_COL[ev.k], 0.35); this.lines(0.5); this.hype(0.8);
        this.sticker(this.pick(['GO GO GO !', 'C\'EST PARTI !', 'LET\'S GOOO']), 320, 180, { size: 40, color: '#ffffff', bg: '#ff2a2a', life: 0.8 });
        this.burst(320, 180, 40, ['#ffe24a', '#ff3b3b', '#ffffff'], { shape: 'star', speed: 320, size: 6 });
        if (A) { A.sfx('countGo', 0, 1); A.say({ fps: M && M.kind === 'fps' ? fpsVar(M).say : 'Feu !', candy: 'Sucrez-les !', horses: 'Faites vos jeux !', moral: 'Répandez l\'amour !' }[ev.k] || 'Go !', 0.55, 1.15); }
        break;
      // ---- duel au pistolet
      case 'mgShot': {
        // (façon Counter-Strike : le recul, la traçante, le son, le sang et la marque de touche ; pas d'autocollants)
        const i = ev.s, o = 1 - i, VR = duelVar(M.g);
        if (!ev.splash) {
          this.recoil[i] = VR.pellets || VR.rocket ? 1.6 : VR.auto ? 0.6 : VR.charge ? 1 + ev.pw : VR.scope ? 1.4 : 1; this.muzzle[i] = 0.05;
          this.shake[i] = Math.max(this.shake[i], VR.pellets || VR.charge || VR.scope ? 0.7 : VR.auto ? 0.18 : 0.3); this.radar[i] = this.time;
          if (ev.r === 'rocket') { if (A) { A.sfx('throw', 0, 0.8); A.sfx('whoosh', 0, 0.7); } break; }
          for (let k = 0; k < Math.min(ev.n || 1, 6); k++) this.tracer(W, i, ev, k ? 0.5 : 0, VR.charge ? '#5ae8ff' : null, VR.charge ? 0.09 + ev.pw * 0.12 : 0.03);
          if (A) {
            if (VR.charge) { A.sfx('zapL', 0, 0.9); A.sfx('thunder', 0, 0.35 + ev.pw * 0.4); }
            else if (VR.pellets) { A.sfx('shotgun', 0, 1); A.sfx('boom', 0, 0.25); }
            else if (VR.scope) { A.sfx('shotgun', 0, 1, 0); A.sfx('thunder', 0, 0.3); }
            else A.sfx('shotgun', 0, VR.auto ? 0.32 : 0.7, VR.auto ? 3 : 1);
          }
        }
        if (ev.splash) { this.hit[i] = { t: 0.25, kill: 0 }; this.hurt[o] = 1; this.shake[o] = 1.2; A && A.sfx('hitmark', 0, 1); break; }
        if (ev.r === 'head' || ev.r === 'body') {
          this.hit[i] = { t: 0.22, kill: ev.r === 'head' ? 1 : 0 };
          this.hurt[o] = 1; this.shake[o] = 1;
          if (ev.r === 'head') this.jolt(0.3, 0.02);
          P.blood(ev.x, ev.y, ev.z, [M.g.p[i].sd, 0.6, 0], ev.r === 'head' ? 40 : 16, ev.r === 'head' ? 2 : 1);
          const V = this.mv.views[M.g.p[o].slot]; if (V) V.flash('#ff2020', 0.12);
          A && A.sfx('hitmark', 0, 1);
          if (ev.r === 'body') A && A.sfx('hitM', 0, 0.6);
        } else if (ev.r === 'cover') {
          P.sparks(ev.x, ev.y, ev.z, 12, '#e8e2d0', 7); P.dust(ev.x, ev.y, ev.z, 4, '#9a968c', 0.6);
          A && A.sfx(ev.b > 0 ? 'clank' : 'thud', 0, 0.8);
          if (ev.b <= 0) P.dust(ev.x, ev.y - 0.4, ev.z, 12, '#8a867c', 1.4);
        } else P.sparks(ev.x, ev.y, ev.z, 5, '#fff2a8', 5);
        break;
      }
      case 'mgKill': {
        // le fil des éliminations (avec l'arme), un mot sobre sous le viseur, l'écran de mort de la victime
        const k = ev.k, v = ev.v, g = M.g, gun = fpsVar(M).gun;
        this.hit[k] = { t: 0.4, kill: 1 };
        this.feed.unshift({ k: g.p[k].slot, v: g.p[v].slot, head: ev.head, gun, t: 0 }); this.feed.length = Math.min(5, this.feed.length);
        this.boomT[k] = 0.18; // un arrêt sur image (la caméra fige un instant sur le kill)
        const streak = ev.streak >= 2 ? STREAKS[Math.min(ev.streak, STREAKS.length - 1)] : '';
        this.hb[k] = { text: ev.air ? 'NO SCOPE' : ev.head ? 'HEADSHOT' : 'ÉLIMINATION', sub: streak, t: 0, color: ev.head || ev.air ? '#ff4040' : '#ffffff' };
        this.hb[v] = { dead: 1, by: g.p[k].slot, gun, head: ev.head, t: 0 };
        R.kick('flash', 0.12, { color: '#ffffff' });
        const V = this.mv.views[g.p[v].slot]; if (V) V.impulse(-1.5);
        if (A) { A.sfx('hitL', 0, 0.9); if (ev.head) A.sfx('splatter', 0, 0.8); }
        if (ev.n === duelVar(g).kills - 1) this.matchPt = { slot: g.p[k].slot, t: this.time };
        break;
      }
      case 'mgReload': A && A.sfx('click', 0, 0.8); if (ev.dry) A && A.sfx('error', 0, 0.3); break;
      case 'mgReloaded': A && A.sfx('clink', 0, 0.6); break;
      case 'mgSpawn': A && A.sfx('respawn', 0, 0.4); break;
      case 'mgJump': A && A.sfx(ev.air ? 'jump2' : 'jump', 0, 0.5); if (ev.air) this.shake[ev.s] = Math.max(this.shake[ev.s], 0.25); break;
      case 'mgSlide': A && A.sfx('slip', 0, 0.55); A && A.sfx('whoosh', 0, 0.5); this.slideT[ev.s] = 0.28; this.shake[ev.s] = Math.max(this.shake[ev.s], 0.3); break;
      case 'mgLand': A && A.sfx('land', 0, 0.7); this.shake[ev.s] = Math.max(this.shake[ev.s], 0.5); break;
      case 'mgCharge': A && A.sfx('charge', 0, 0.5); break;
      case 'mgScope': A && A.sfx('click', 0, 0.6); break;
      case 'mgBoom': {
        const P3 = this.mv.particles;
        P3.sparks(ev.x, ev.y, ev.z, 30, '#ffb030', 9); P3.sparks(ev.x, ev.y, ev.z, 16, '#ffffff', 6); P3.dust(ev.x, ev.y, ev.z, 10, '#5a4a40', 1.6);
        this.boomFlash(ev);
        for (let k = 0; k < 2; k++) { const d = Math.abs(M.g.p[k].x - ev.x); this.shake[k] = Math.max(this.shake[k], d < 3 ? 1.4 : 0.6); }
        if (A) { A.sfx('boom', 0, 0.9); A.sfx('quake', 0, 0.4); }
        this.jolt(0.5, 0.04, '#ff9a1f', 0.15);
        break;
      }
      // ---- bonbons
      case 'mgPick': A && A.sfx('blip', 0, 0.5); break;
      case 'mgSwap': {
        A && A.sfx('menuMove', 0, 0.6);
        const side = M && ev.p === M.v ? 1 : 0, b = M && M.g.b[side];
        if (b) this.burst(BOARD_X[side] + (b.cx + 0.5) * CELL, BOARD_Y + (b.cy + 0.5) * CELL, 6, ['#ffffff', '#ffe24a'], { shape: 'star', speed: 90, size: 3, life: 0.3, g: 0 });
        break;
      }
      case 'mgNope': A && A.sfx('error', 0, 0.45); break;
      case 'mgShuffle': {
        const side = M && ev.p === M.v ? 1 : 0;
        this.floats.push({ text: 'Mélange !', x: BOARD_X[side] + BW / 2, y: BOARD_Y + BH / 2, t: 0, life: 1, color: '#ffffff', size: 22 });
        this.react(side, { emote: 'complain_01', life: 1.2 });
        A && A.sfx('wobble', 0, 0.7);
        break;
      }
      case 'mgCandy': {
        const side = M && ev.p === M.v ? 1 : 0;
        const x = BOARD_X[side] + BW / 2;
        this.floats.push({ text: `+${ev.pts}`, x: x + (Math.random() - 0.5) * 60, y: BOARD_Y + BH * 0.45, t: 0, life: 0.9, color: '#ffffff', size: 18 });
        if (ev.ch > 0) this.floats.push({ text: CHAIN_WORDS[Math.min(ev.ch, CHAIN_WORDS.length - 1)], x, y: BOARD_Y + BH * 0.3, t: 0, life: 1.2, color: CANDY_COL[(ev.ch + 1) % 6], size: 22 + Math.min(4, ev.ch) * 4 });
        if (ev.boom) { this.boardShake[side] = 1; A && A.sfx('boom', 0, 0.55); this.jolt(0.7, 0.05, '#ffb030', 0.25); this.sticker(this.pick(['KABOOM', 'EXPLOSION', '💥💥']), x, BOARD_Y + BH * 0.5, { size: 26, color: '#ffffff', bg: '#ff6a1a', life: 0.8 }); }
        // chaque bonbon qui fond éclate en morceaux de sa couleur
        const b = M && M.g.b[side];
        if (b) for (const ci of b.clr) {
          const col = CANDY_COL[b.c[ci] % 10] || '#ffffff';
          this.burst(BOARD_X[side] + (ci % CANDY.W + 0.5) * CELL, BOARD_Y + ((ci / CANDY.W | 0) + 0.5) * CELL, 5, [col, '#ffffff'], { speed: 150, size: 4, life: 0.55, up: 80 });
        }
        if (ev.ch >= 1) { this.sticker(`COMBO x${ev.ch + 1} ${ev.ch >= 3 ? '🔥🔥' : '🔥'}`, x, BOARD_Y - 6, { size: 16 + Math.min(4, ev.ch) * 4, color: '#ffffff', bg: CANDY_COL[ev.ch % 6], life: 0.8 }); this.hype(0.25 * ev.ch); this.jolt(0.2 + ev.ch * 0.15, 0.02 * ev.ch); }
        if (ev.ch >= 3) this.emojiRain(['🍬', '🍭', '🔥'], 8);
        // les marionnettes : il saute de joie (une toupie sur un gros combo, un fou rire sur une explosion), l'autre enrage
        if (ev.ch >= 3) this.react(side, { emote: 'victory_celebration', spin: 1, life: 1.1, hop: 0.25, hopF: 1.8, head: 2.3, pop: 0.4 });
        else if (ev.boom) this.react(side, { emote: 'laugh_01', life: 1.1, pop: 0.4, shake: 6 });
        else if (ev.ch >= 1) this.react(side, { emote: 'cheer', life: 0.9, hop: 0.15, hopF: 2.2, pop: 0.35 });
        else this.react(side, { pop: 0.2, life: 0.2, weak: 1 });
        if (ev.ch >= 2) this.react(1 - side, { emote: 'angry_01', life: 1.2, tint: '#ff2020', tintK: 0.4 });
        this.burst(BOARD_X[side] + (side ? BW - 10 : 10), BOARD_Y + BH * 0.5, 3 + Math.min(6, ev.ch * 2), CANDY_COL, { shape: 'dot', dir: side ? -0.4 : Math.PI + 0.4, spread: 0.5, speed: 260, size: 6, up: 160, life: 0.6 }); // des bonbons qui lui volent dans la bouche
        if (ev.pw) this.floats.push({ text: 'Bonbon spécial !', x, y: BOARD_Y + BH * 0.62, t: 0, life: 1, color: '#ffd23a', size: 14 });
        if (A) { A.sfx('pop', 0, 0.6 + Math.min(0.4, ev.ch * 0.12), 1 + Math.min(6, ev.ch)); A.sfx('chomp', 0, 0.35, 1 + Math.min(5, ev.ch)); if (ev.ch >= 2) A.sfx('cash', 0, 0.5); if (ev.ch >= 3) A.sfx('airhorn', 0, 0.4); }
        break;
      }
      // ---- tiercé
      case 'mgBet': {
        const h = HORSES.NAMES[ev.h];
        this.floats.push({ text: `${this.pname(ev.p === 0 ? M.a : M.v)} parie sur ${h} !`, x: 320, y: 300 - ev.p * 18, t: 0, life: 1.6, color: COLORS[ev.p === 0 ? M.a : M.v], size: 13 });
        A && A.sfx('cash', 0, 0.7);
        this.react(ev.p, { emote: 'agree', life: 1.3, pop: 0.4, hop: 0.08, hopF: 2 });
        break;
      }
      case 'mgRace': this.say('Ils sont dans les starting-blocks !'); break;
      case 'mgGate': this.tick('ET C\'EST PARTI !'); this.sticker('PARTEZ !', 320, 150, { size: 34, color: '#ffffff', bg: '#2a8a2a', life: 0.7 }); this.jolt(0.6, 0.06, '#ffffff', 0.25); this.lines(0.4); A && A.sfx('countGo', 0, 0.9); A && A.sfx('whinny', 0, 0.7); break;
      case 'mgWhip': {
        A && A.sfx('slap', 0, 0.4, 1 + Math.floor(Math.random() * 3));
        const x = FAN_X[ev.p] + (ev.p ? -24 : 24);
        this.burst(x, 180, 5, ['#ffe24a', '#ffffff'], { shape: 'star', speed: 120, size: 3, life: 0.3 });
        if (Math.random() < 0.35) this.sticker(this.pick(['CLAC !', 'HUE !', 'ALLEZ !', 'YEEHAW']), x + (Math.random() - 0.5) * 40, 120, { size: 13, color: '#ffe24a', life: 0.45 });
        this.jolt(0.12, 0.006);
        break;
      }
      case 'mgBolt': this.tick(`${HORSES.NAMES[ev.h]} s'emballe et s'arrête !`); this.sticker('😤 IL S\'EMBALLE', ev.p === 0 ? 150 : 490, 110, { size: 18, color: '#ffffff', bg: '#d02020', life: 1 }); this.jolt(0.6, 0.04, '#ff0000', 0.2); A && A.sfx('whinny', 0, 0.9); this.say('Oh, il s\'emballe !'); this.react(ev.p, { emote: 'angry_01', life: 1.2, shake: 8, tint: '#ff2020', tintK: 0.5, head: 2.3, pop: 0.4 }); break;
      case 'mgSip': A && A.sfx('glug', 0, 0.9); A && A.sfx('whoosh', 0, 0.5); this.burst(FAN_X[ev.p] + (ev.p ? -10 : 10), 168, 30, ['#fff6e0', '#f0b030', '#ffffff'], { shape: 'dot', speed: 160, size: 5, up: 140, life: 0.8 }); this.sticker('TURBO 🍺', ev.p === 0 ? 120 : 520, 120, { size: 20, color: '#ffffff', bg: '#d08010', life: 0.8 }); this.lines(0.4); this.jolt(0.4, 0.05); this.floats.push({ text: 'GLOUP !', x: FAN_X[ev.p] + (ev.p ? -20 : 20), y: 130, t: 0, life: 0.8, color: '#ffd23a', size: 18 }); this.react(ev.p, { pop: 0.5, life: 0.4, weak: 1 }); break;
      case 'mgLead': if (M && M.g.ph === 'race') { this.tick(`${HORSES.NAMES[ev.h]} prend la tête !`); if (this.time - this.sayT > 2.5) { this.sayT = this.time; this.say(`${HORSES.NAMES[ev.h]} en tête !`); } } break;
      case 'mgFinish': if (ev.mine >= 0) { this.tick(`${HORSES.NAMES[ev.h]} franchit la ligne !`); A && A.sfx('crowd', 0, 0.6); A && A.sfx('airhorn', 0, 0.5); this.confetti(40); this.jolt(0.7, 0.08, '#ffffff', 0.4); this.sticker('PHOTO FINISH 📸', 320, 150, { size: 22, color: '#0b0610', bg: '#ffe24a', life: 0.9 }); if (M && !M.g.H[M.g.p[1 - ev.mine].pick].fin) { this.react(ev.mine, { emote: 'victory_celebration', life: 0.8, hop: 0.2, hopF: 2, pop: 0.5 }); this.react(1 - ev.mine, { state: 'hitstun', kb: 160, life: 0.6, shake: 10, pop: 0.4 }); } } break;
      case 'mgLeadFx': break;
      // ---- bonne parole
      case 'mgAnswer': {
        this.ans[ev.p] = { ok: ev.ok, t: 0 };
        const x = MORAL_GX[ev.p];
        if (ev.ok) this.react(ev.p, { emote: 'cheer', life: 0.7, hop: 0.12, hopF: 2.4, pop: 0.35, ...({ 3: { spin: 1 }, 5: { spin: 1 }, 7: { spin: 2 }, 10: { spin: 3 } }[ev.streak] || {}) });
        else this.react(ev.p, { state: 'hitstun', kb: 140, life: 0.3, shake: 10, pop: 0.4 });
        if (ev.ok) {
          this.burst(x, 108, 14, ['#ff5a8a', '#ff8ad0', '#ffffff'], { shape: 'txt', ch: '♥', speed: 170, size: 7, up: 120, life: 0.9 });
          this.burst(x, 108, 12, ['#fff6a0', '#ffffff'], { shape: 'star', speed: 200, size: 4, life: 0.5 });
          const st = { 3: 'SAINT ✨', 5: 'PROPHÈTE 🙏', 7: 'MESSIE 😇', 10: 'DIEU VIVANT ☀️' }[ev.streak];
          if (st) { this.sticker(st, x, 60, { size: 24, color: '#ffffff', bg: '#3a8bff', life: 1 }); this.hype(0.6); this.jolt(0.4, 0.05, '#fff6c0', 0.3); A && A.sfx('airhorn', 0, 0.4); }
          A && A.sfx('blip', 0, 0.5, 1 + Math.min(8, ev.streak));
          this.floats.push({ text: ev.streak >= 3 ? `AMOUR x${ev.streak} !` : '+1 AMOUR', x, y: 150, t: 0, life: 0.8, color: '#7cff8a', size: 16 + Math.min(8, ev.streak * 2) });
          A && A.sfx('heart', 0, 0.6);
        } else {
          this.floats.push({ text: 'HÉRÉSIE !', x, y: 150, t: 0, life: 0.8, color: '#ff4040', size: 22 });
          this.burst(x, 108, 22, ['#ff2020', '#600000', '#ffb000'], { speed: 240, size: 5, life: 0.6 });
          this.sticker(this.pick(['😈 HÉRÉSIE', '🔥 HONTE', '👎 NUL']), x, 60, { size: 22, color: '#ffffff', bg: '#a00010', life: 0.8 });
          this.jolt(0.6, 0.03, '#ff0000', 0.25);
          A && A.sfx('fart', 0, 0.5);
          A && A.sfx('error', 0, 0.6);
        }
        break;
      }
      case 'mgEnd': {
        if (ev.w >= 0 && ev.d > 0) this.makeGhost(W, ev.w); // le fantôme du gagnant, prêt pour la facture (dans l'arène)
        this.lastRes = { ...ev };
        if (ev.w >= 0) {
          const [wa, la] = ACH[ev.k] || [['Bien joué'], ['Gros looser']];
          this.achieve(W, ev.w, this.pick(wa), `Gagner ${ULTI_NAMES[ev.k].toLowerCase()} (${ev.d} % infligés)`);
          this.achieve(W, ev.l, 'Gros looser', `Prendre ${ev.d} % dans la vue`);
          if (ev.d >= 50) this.achieve(W, ev.w, 'Bien joué', 'Une victoire écrasante');
          else this.achieve(W, ev.l, this.pick(la), 'Se faire humilier en 10 secondes');
        } else this.achieve(W, M ? M.a : 0, 'Match nul', 'Personne n\'a gagné, personne n\'a perdu');
        this.confetti(120); this.jolt(1, 0.12, '#ffffff', 0.5); this.lines(0.8); this.hype(1);
        if (ev.w >= 0) this.emojiRain(['🏆', '👑', '💯', '🔥', '😎'], 18);
        if (A) {
          if (ev.w >= 0) { A.sfx('airhorn', 0, 0.7); A.sfx('game', 0, 0.7); A.say('Izi ouine !', 0.4, 1.0); A.crowd(); }
          else A.say('Égalité !', 0.5, 1);
        }
        R.kick('flash', 0.6, { color: ev.w >= 0 ? COLORS[ev.w] : '#ffffff' });
        break;
      }
      case 'mgOut': {
        // retour dans l'arène (sous l'encre du fondu), tout figé 2 s : la caméra cadre le perdant qui va prendre son coup
        this.banner = null;
        const L = ev.l >= 0 ? W.fighters[ev.l] : null;
        // (le temps des coups seulement : ensuite la caméra recule, tout le monde dans le cadre, avant que ça reparte)
        if (L) this.mv.rig.focusOn({ x: L.x, y: L.y + 1, z: L.z }, (HURT_AT[HURT_AT.length - 1] + 14) / 60, 0.8);
        if (A) A.sfx('whoosh', 0, 0.6);
        break;
      }
      case 'mgHurtHit': {
        // un coup de la facture, dans l'arène figée : le perdant encaisse (sang, éclat, secousse), « +x % » au-dessus de lui
        const L = W.fighters[ev.l], V = L && this.mv.views[ev.l], P3 = this.mv.particles;
        if (!L) break;
        const big = ev.last, hx = L.x, hy = L.y + (L.height || 1.8) * 0.6, hz = L.z;
        if (ev.n === 0) this.startMock(W, ev.w, ev.l);
        P3.blood(hx, hy, hz, [hx > W.fighters[ev.w].x ? 1 : -1, 0.6, 0], big ? 50 : 22, big ? 2 : 1.2);
        P3.sparks(hx, hy, hz, big ? 30 : 14, '#fff2a8', big ? 11 : 7);
        if (V) { V.flash('#ff2020', 0.14); V.impulse(big ? -2 : -1); }
        this.mv.rig.shake(big ? 0.9 : 0.4); this.mv.rig.punchIn(big ? 0.8 : 0.3); R.kick('chroma', big ? 0.8 : 0.4);
        // la caméra plonge sur chaque coup du fantôme, de plus en plus près, puis relâche (le dernier : un grand zoom)
        this.mv.rig.zoomIn({ x: hx, y: hy }, big ? 0.5 : 0.32, big ? 1.1 : 0.45 + ev.n * 0.1);
        if (A) { A.sfx(big ? 'punchHeavy' : this.pick(['hitM', 'hitL', 'slap']), 0, big ? 1 : 0.8, 1 + ev.n * 0.3); if (big) A.crowd(); }
        const pr = this.R.project(this.tmpV.set(hx, L.y + (L.height || 1.8) + 0.5, hz)), k = this.k || 1;
        this.floats.push({ text: `+${ev.d} %`, x: pr.x / k - (this.ox || 0) + (Math.random() - 0.5) * 30, y: pr.y / k - (this.oy || 0), t: 0, life: 0.9, color: big ? '#ff3030' : '#ffe24a', size: big ? 26 : 17 });
        break;
      }
      case 'mgStrike': {
        if (this.ghost) this.ghost.fade = 0.35;
        // la reprise : le perdant prend ses % et le coup (src/sim/minigames.js stepResume), la caméra le suit, la télé en parle
        R.kick('flash', 0.6, { color: ev.w >= 0 ? COLORS[ev.w] : '#ffffff' });
        const L = ev.l >= 0 ? W.fighters[ev.l] : null;
        if (L) this.mv.rig.shake(0.5); // (le coup final, caméra large : les joueurs voient tout au moment où ça repart)
        if (A) { A.sfx('punchHeavy', 0, 1); A.sfx('go', 0, 0.6); }
        const tick = [...TICKER].sort(() => Math.random() - 0.5).slice(0, 3);
        if (L) {
          const lab = `${this.pname(ev.l)} (${CHARS[L.char].name})`.toUpperCase();
          tick.unshift(`${this.pname(ev.w)} déclare : « EZ »`);
          this.newsLater = { slot: ev.l, char: L.char, loser: 1, head: NEWS[ev.k](lab, ev.d), ticker: tick.join('   ·   ') };
        } else {
          const slot = W.list[0].slot;
          this.newsLater = { slot, char: W.fighters[slot].char, loser: 0, head: 'MATCH NUL : LA RÉDACTION S\'ENNUIE FERME', ticker: tick.join('   ·   ') };
        }
        // le flash info ne tombe pas à tous les coups, ni au même moment : une fois sur deux, entre 0,5 et 4 s après
        if (Math.random() < 0.5) this.newsLater.at = 0.5 + Math.random() * 3.5; else this.newsLater = null;
        break;
      }
      // ---- danse
      case 'mgStep': {
        const lx = (ev.p === 0 ? 40 : 464) + 17 + ev.lane * 34;
        const J = [['RATÉ ✗', '#9a8aa8'], ['PARFAIT ✨', '#ff4aa8'], ['SUPER ♡', '#ff8a3a'], ['BIEN', '#3aa8ff'], ['RATÉ ✗', '#8a7a9a']][ev.g];
        this.dj[ev.p] = { text: J[0], col: J[1], t: 0, g: ev.g };
        if (ev.g >= 1 && ev.g <= 3) {
          this.lane[ev.p][ev.lane] = 1;
          this.burst(lx, 72, ev.g === 1 ? 16 : 8, [LANE_COL[ev.lane], '#ffffff', '#ff9ae8'], { shape: ev.g === 1 ? 'star' : 'dot', speed: 180, size: 5, life: 0.5 });
          if (ev.g === 1) this.burst(lx, 72, 3, ['#fff'], { shape: 'txt', ch: this.pick(['♡', '✨', '🌸', '⭐']), speed: 140, size: 8, up: 100, life: 0.9 });
          A && A.sfx(ev.g === 1 ? 'note' : 'blip', 0, 0.5, 1 + ev.lane * 2 + (ev.g === 1 ? 2 : 0));
          this.react(ev.p, { pop: ev.g === 1 ? 0.35 : 0.2, hop: ev.g === 1 ? 0.1 : 0.05, hopF: 2, life: 0.3, weak: 1 });
          if (ev.c && ev.c % 10 === 0) this.react(ev.p, { spin: 1, life: 0.7, hop: 0.3, hopF: 1.4, pop: 0.45, head: 2.4 });
          if (ev.c && ev.c % 10 === 0) { this.sticker(`${ev.c} COMBO ${this.pick(['UwU', '♡♡♡', '(ﾉ◕ヮ◕)ﾉ', 'KAWAII'])}`, ev.p === 0 ? 250 : 390, 120, { size: 18, color: '#ffffff', bg: '#ff5ab8', life: 0.9 }); this.hype(0.5); this.jolt(0.3, 0.04); A && A.say('Kawaii !', 0.7, 1.3); }
        } else { A && A.sfx('error', 0, 0.25); this.jolt(0.15, 0); if (!(this.rx[ev.p] && this.rx[ev.p].state === 'dizzy')) this.react(ev.p, { state: 'hitstun', kb: 70, life: 0.35, shake: 8, pop: 0, rot: ev.p ? 0.12 : -0.12, weak: 1 }); }
        break;
      }
      case 'mgBreak': this.react(ev.p, { state: 'dizzy', life: 1.1, tint: '#7a5aff', tintK: 0.5, pop: 0.2 }); this.sticker('COMBO CASSÉ 💔', ev.p === 0 ? 250 : 390, 120, { size: 14, color: '#ffffff', bg: '#7a5a9a', life: 0.7 }); A && A.sfx('wobble', 0, 0.5); break;
      // ---- chirurgie
      case 'mgGrab': A && A.sfx('click', 0, 0.7); break;
      case 'mgDrop': A && A.sfx('pop', 0, 0.4); break;
      case 'mgZap': {
        this.zapT[ev.p] = 1;
        this.react(ev.p, { state: 'hitstun', kb: 160, life: 0.7, tint: '#fff6a0', tintK: 1, flick: 1, shake: 12, head: 2.4, pop: 0.5 });
        const ox = ev.p === 0 ? 22 : 342, x = ox + ev.x * 2.8, y = 96 + ev.y * 2.8;
        this.burst(x, y, 24, ['#fff6a0', '#ffffff', '#ff4040'], { shape: 'star', speed: 260, size: 4, life: 0.4 });
        this.sticker(this.pick(['BZZZT ⚡', 'ÉLECTROCHOC', 'CATASTROPHE']), ox + 140, 150, { size: 22, color: '#0b0610', bg: '#ffe24a', life: 0.8 });
        this.jolt(0.8, 0.05, '#ff2020', 0.3);
        if (A) { A.sfx('zapL', 0, 0.9); A.sfx('error', 0, 0.6); A.say(this.pick(['Aïe !', 'Ouille !', 'Bzzzt !']), 0.7, 1.3); }
        break;
      }
      case 'mgPull': {
        const ox = ev.p === 0 ? 22 : 342, c = M && M.g.cav[ev.k], x = ox + (c ? c.x : 50) * 2.8, y = 96 + (c ? c.y : 30) * 2.8;
        this.burst(x, y, 26, ['#ffe24a', '#ffffff', '#7cff8a'], { shape: 'star', speed: 220, size: 5 });
        this.sticker(ev.clean ? `+${ev.pts} PROPRE ✨` : `+${ev.pts}`, x, y - 20, { size: ev.clean ? 16 : 13, color: '#ffffff', bg: ev.clean ? '#2a9a5a' : null, life: 0.8 });
        if (ev.n >= 3 && ev.n % 3 === 0) { this.sticker(this.pick(['CHIRURGIE DE GÉNIE', 'DOCTEUR HOUSE', 'MAINS D\'OR']), 320, 170, { size: 20, color: '#ffffff', bg: '#0a8a6a', life: 1 }); this.hype(0.6); }
        if (A) { A.sfx('cash', 0, 0.6); A.sfx('pop', 0, 0.6, 1 + ev.n); }
        this.react(ev.p, { emote: ev.n >= 3 && ev.n % 3 === 0 ? 'victory_celebration' : 'cheer', life: 1, hop: 0.06, hopF: 2, pop: 0.35 });
        this.react(2 + ev.p, { emote: 'laugh_01', life: 0.9, pop: 0.3 });
        this.jolt(0.25, 0.03);
        break;
      }
      default: break;
    }
  }

  // le beat (150 à la minute, deux fois plus vite à la fin) et les bips des 3 dernières secondes
  // le beat, calé sur les images de la simulation (150 à la minute, la danse suit le même) : deux fois plus vite à la fin,
  // une petite mélodie pour la danse ; les bips des 3 dernières secondes du jeu
  pulse(M) {
    const A = this.audio, end = M.ph === 'play' ? MG_PLAY : MG_INTRO, left = (end - M.t) / 60;
    const per = M.ph === 'play' && left <= 3 ? DANCE.BEAT / 2 : DANCE.BEAT;
    const beat = Math.floor(M.t / per);
    if (beat !== this.lastBeat) {
      this.lastBeat = beat;
      if (A) {
        A.sfx('thud', 0, left <= 3 ? 0.45 : 0.28);
        if (M.kind === 'dance' && M.ph === 'play') A.sfx('note', 0, 0.3, [1, 3, 5, 8, 5, 3, 6, 4][beat % 8]);
        if (M.ph === 'intro' && beat % 2) A.sfx('click', 0, 0.4);
      }
      this.jx.punch = Math.max(this.jx.punch, left <= 3 ? 0.025 : 0.01);
      this.beatPop = 1;
    }
    const sec = Math.ceil(left);
    if (sec !== this.lastSec) {
      this.lastSec = sec;
      if (M.ph === 'play' && sec <= 3 && sec > 0) { if (A) { A.sfx('countHi', 0, 0.9); A.say(String(sec), 0.55, 1.3); } this.jolt(0.5, 0.06); this.hype(0.5); }
    }
  }

  say(text) { const A = this.audio; if (A) A.say(text, 0.5, 1.15); }
  tick(text) { this.ticker = text; this.tickerT = 0; }

  // --- chaque image -----------------------------------------------------------------------------------------------
  update(W, dt, alpha) {
    this.time += dt;
    const M = W.mg;
    const key = M ? `${M.kind}:${M.a}:${M.v}` : null;
    if (key !== this.key) {
      this.key = key;
      if (M) this.reset();
    }
    // (la télé éteinte remonte à la fin de « EZ WIN » : un jeu en 3D rend déjà la main à l'arène)
    const tvGone = !!M && M.ph === 'outro' && M.t > MG_WIN - 16;
    const fpsOn = !!(M && M.kind === 'fps' && M.ph !== 'intro' && !tvGone);
    if (fpsOn !== this.fpsOn) { this.fpsOn = fpsOn; if (fpsOn) this.enterFps(W, M); else this.exitFps(W); }
    if (fpsOn) this.updateFps(W, M, dt);
    if (this.ghost) this.updateGhost(W, dt);
    if (!M && !W.mgResume) this.prewarm(W);
    // les marionnettes du jeu sont rendues une fois pendant le fondu d'encre (leurs shaders se compilent là), une par
    // image pour ne pas faire d'à-coup ; le reste du jeu (warm) à la suite
    if (M && M.ph === 'intro' && M.t > 1 && this.warmed !== key) {
      this.warmed = key;
      const XW = EXTRA_VIEWS[M.kind], ca = W.fighters[M.a].char, cv = W.fighters[M.v].char;
      const q = [ca, cv, ...((XW && XW.puppets) || [])].map((c) => [c, undefined]);
      // et les autres clés de ce jeu (le même perso deux fois, les patients du chirurgien)
      if (ca === cv) q.push([cv, this.pkey(W, M, 1)]);
      if (M.kind === 'surgery') q.push([cv, 'pat0'], [ca, 'pat1']);
      this.warmQ = [...q.map(([c, k]) => () => drawPuppet(this.g, c, -9999, -9999, 10, k ? { key: k, shadow: false } : { shadow: false })), () => { if (XW && XW.warm) XW.warm(this, W, M); },
        // la première image du jeu, dessinée pour rien (ses marionnettes, leurs clés et leurs clips, ses textes : prêts)
        () => this.dryRun(W, M),
        // les deux fantômes possibles (le gagnant n'est pas encore connu), prêts d'avance : 10 à 20 ms de moins à « EZ WIN »
        () => this.prepGhost(W, M.a), () => this.prepGhost(W, M.v)];
    }
    if (M && M.ph === 'intro' && this.warmQ && this.warmQ.length) this.warmQ.shift()();
    // les mini-jeux en 2D : le décor 3D derrière est figé et grisé, on ne le redessine qu'une image sur deux
    const XT = M && EXTRA_VIEWS[M.kind], is3D = !!M && (M.kind === 'fps' || !!(XT && XT.enter3D));
    // un jeu en 2D : le combat figé n'est plus redessiné du tout (l'écran garde sa dernière image, grisée) une fois le
    // jeu lancé ; un jeu en 3D : seul l'écran de la télé est redessiné (renderer.tv), le reste garde le combat figé
    this.R.freeze3D = !!M && !is3D && (M.ph !== 'intro' || M.t > 3); // (dès la chute de la télé : le fond est prêt avant le jeu)
    if (M && M.ph === 'play') this.adaptQuality(dt);
    const w = window.innerWidth, h = window.innerHeight;
    // (un jeu en 3D se voit à travers l'écran de la télé, percé : la 3D est rendue juste dans ce cadre, un peu plus grand
    // que l'écran, le bord de la télé recouvre le surplus ; plus de recopie de l'image 3D vers le calque, très chère sur
    // Safari et les petites machines)
    const E = 4;
    this.R.tv = is3D && M.ph !== 'intro' && !tvGone && this.k && w > 0 && h > 0
      ? { x: (TV.x - E + this.ox) * this.k / w, y: (TV.y - E + this.oy) * this.k / h, w: (TV.w + 2 * E) * this.k / w, h: (TV.h + 2 * E) * this.k / h } : null;
    this.R.tvCopy = false;
    this.flat = is3D; // (la télé droite : la 3D, droite elle aussi, tombe pile dans l'écran)
    // un jeu en 3D (src/render/mg/) : il entre dans la scène à la fin de l'explication et en sort à la fin de l'ulti
    const XV = M && EXTRA_VIEWS[M.kind], on3 = !!(XV && XV.enter3D && M.ph !== 'intro' && !tvGone);
    if (on3 !== !!this.x3) {
      if (on3) { this.x3 = XV; XV.enter3D(this, W, M); }
      else { if (this.x3.exit3D) this.x3.exit3D(this, W); this.x3 = null; for (const F of W.list) { const V = this.mv.views[F.slot]; if (V) V.snapTo(F); } }
    }
    if (on3 && XV.update3D) XV.update3D(this, W, M, dt);
    // le HUD du match se cache pendant tout l'ulti (chaque jeu a le sien)
    if (!!M !== this.hudOff) { this.hudOff = !!M; this.mv.hud.show(!M); }
    // les deux sticks (bouger + viser) pour les manettes et claviers de ce PC qui jouent le duel ; la souris de Clavier 1
    // pour la pince du chirurgien
    const duel = [];
    const two = M && (M.kind === 'fps' || (XV && XV.input === 'duel')), mouse = M && (M.kind === 'surgery' || (XV && XV.input === 'mouse'));
    if (M && M.ph !== 'outro' && (two || mouse)) for (const s of [M.a, M.v]) { const d = this.deviceOf(s); if (d && (two || d === 'kb1')) duel.push(d); }
    Input.setDuel(duel, two ? 'duel' : 'mouse');
    if (M && M.kind !== 'fps' && !(XV && XV.gray === false)) this.R.fx.gray = Math.max(this.R.fx.gray, 0.6);
    if (M && M.ph !== 'outro') this.pulse(M);
    // les 5 dernières secondes avant le prochain mini-jeu (le seul moment où il s'annonce) : un bip par seconde, qui monte
    if (!M) {
      const f = mgLeft(W), left = f < 0 ? -1 : Math.ceil(f / 60);
      if (left !== this.soonSec) {
        this.soonSec = left;
        if (left > 0 && left <= 5 && this.audio) { this.audio.sfx('blip', 0, 0.3 + (5 - left) * 0.08, 6 - left); if (left <= 3) this.audio.say(String(left), 0.55, 1.3); }
      }
    }
    this.beatPop = Math.max(0, (this.beatPop || 0) - dt * 4);
    this.draw(W, M, dt, alpha);
  }

  // --- duel au pistolet : la scène -----------------------------------------------------------------------------
  // (une seule fois : les abris, une arme par variante et par tireur, les traçantes, les roquettes, les lasers du
  // railgun, les éclairs d'explosion ; chaque variante n'en montre qu'une partie)
  build3D() {
    const stone = new THREE.MeshLambertMaterial({ color: '#7d7f88', emissive: '#1a1a22', emissiveIntensity: 0.5 });
    const dark = new THREE.MeshLambertMaterial({ color: '#3c3e48', emissive: '#0a0a10', emissiveIntensity: 0.5 });
    const coverMat = new THREE.MeshLambertMaterial({ color: '#8a6a3a', emissive: '#8a6a3a', emissiveIntensity: 0.3 });
    const group = new THREE.Group();
    // une tombe de 1 m de haut (mise à la hauteur voulue à l'entrée) : dalle, haut arrondi, croix, socle ; face à x
    const ROUND = 0.3, slabH = 1 - DUEL.COVER_W * ROUND;
    const tombs = [];
    for (let i = 0; i < DUEL.MAX_COVERS; i++) {
      const t = new THREE.Group();
      const slab = new THREE.Mesh(new THREE.BoxGeometry(DUEL.COVER_W * 2, slabH, 0.3), stone);
      slab.position.y = slabH / 2;
      const top = new THREE.Mesh(new THREE.CylinderGeometry(DUEL.COVER_W, DUEL.COVER_W, 0.3, 20), stone);
      top.rotation.x = Math.PI / 2; top.scale.set(1, 1, ROUND); top.position.y = slabH;
      const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, 0.36), dark); c1.position.set(0, slabH * 0.62, 0);
      const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.09, 0.36), dark); c2.position.set(0, slabH * 0.72, 0);
      const base = new THREE.Mesh(new THREE.BoxGeometry(DUEL.COVER_W * 2.3, 0.14, 0.5), dark); base.position.y = 0.07;
      // ou une simple boîte (caisse, conteneur, bureau...) aux couleurs de la carte
      const cbox = new THREE.Mesh(new THREE.BoxGeometry(DUEL.COVER_W * 2, 1, 0.7), coverMat); cbox.position.y = 0.5;
      const pivot = new THREE.Group();
      pivot.add(slab, top, c1, c2, cbox);
      t.add(pivot, base);
      t.rotation.y = Math.PI / 2;
      t.userData = { pivot, tilt: 0, tomb: [slab, top, c1, c2, base], cbox };
      tombs.push(t); group.add(t);
    }
    const glowMat = (color) => new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    // traçantes
    const tracers = [];
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: '#ffe9a0', transparent: true, opacity: 0, depthWrite: false }));
      m.visible = false; group.add(m); tracers.push({ m, t: 0, life: 0.07 });
    }
    // les roquettes, les lasers du railgun, les éclairs d'explosion
    const rockets = [];
    for (let i = 0; i < DUEL.MAX_RK; i++) {
      const r = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.42, 8), new THREE.MeshLambertMaterial({ color: '#4a5a3a', emissive: '#10140a', emissiveIntensity: 0.6 }));
      body.rotation.z = Math.PI / 2;
      const fire = new THREE.Sprite(glowMat('#ffa030')); fire.material.opacity = 1; fire.scale.setScalar(0.7);
      r.add(body, fire); r.visible = false; r.userData = { fire };
      rockets.push(r); group.add(r);
    }
    const lasers = [0, 1].map(() => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: '#ff2a3a', transparent: true, opacity: 0, depthWrite: false }));
      m.visible = false; group.add(m); return m;
    });
    const booms = [0, 1, 2].map(() => { const sp = new THREE.Sprite(glowMat('#ffb040')); sp.visible = false; group.add(sp); return { sp, t: 0 }; });
    // une caméra et les armes de chaque variante, par tireur
    const metal = new THREE.MeshLambertMaterial({ color: '#2a2a30', emissive: '#0c0c12', emissiveIntensity: 0.6 });
    const wood = new THREE.MeshLambertMaterial({ color: '#6a3a1a', emissive: '#1a0a04', emissiveIntensity: 0.5 });
    const olive = new THREE.MeshLambertMaterial({ color: '#4a5a3a', emissive: '#10140a', emissiveIntensity: 0.6 });
    const cyan = new THREE.MeshBasicMaterial({ color: '#5ae8ff', transparent: true, opacity: 0.75 });
    const box = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; };
    const tube = (r, len, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), mat); m.rotation.x = Math.PI / 2; m.position.set(x, y, z); return m; };
    const flashAt = (g, z, sc = 0.55, x = 0) => { const f = new THREE.Sprite(glowMat('#ffd77a')); f.scale.setScalar(sc); f.position.set(x, 0.03, z); g.add(f); return f; };
    const mkGuns = () => {
      const guns = {};
      { const g = new THREE.Group(); const grip = box(0.07, 0.19, 0.1, wood, 0, -0.11, 0.04); grip.rotation.x = -0.3;
        g.add(box(0.08, 0.1, 0.4, metal, 0, 0, -0.12), tube(0.022, 0.32, metal, 0, 0.03, -0.42), grip, box(0.02, 0.03, 0.03, metal, 0, 0.065, -0.3));
        guns.colt = { g, flashes: [flashAt(g, -0.64)] }; }
      { const g = new THREE.Group(); const grip = box(0.07, 0.17, 0.12, wood, 0, -0.12, 0.12); grip.rotation.x = -0.35;
        g.add(box(0.1, 0.11, 0.42, wood, 0, -0.01, 0), tube(0.032, 0.72, metal, -0.034, 0.04, -0.5), tube(0.032, 0.72, metal, 0.034, 0.04, -0.5), box(0.12, 0.07, 0.2, wood, 0, -0.04, -0.42), grip);
        guns.pompe = { g, flashes: [flashAt(g, -0.92, 0.9)] }; }
      { const g = new THREE.Group(), flashes = [];
        for (const sx of [-0.27, 0.27]) {
          const u = new THREE.Group(); u.position.x = sx;
          u.add(box(0.07, 0.12, 0.3, metal, 0, 0, -0.1), tube(0.018, 0.16, metal, 0, 0.02, -0.32), box(0.05, 0.2, 0.06, metal, 0, -0.14, 0.02), box(0.04, 0.16, 0.05, olive, 0, -0.12, -0.12));
          flashes.push(flashAt(u, -0.44, 0.4)); g.add(u);
        }
        guns.akimbo = { g, flashes, two: 1 }; }
      { const g = new THREE.Group();
        g.add(box(0.1, 0.12, 0.7, metal, 0, 0, -0.25), tube(0.03, 0.5, metal, 0, 0.02, -0.75), box(0.06, 0.18, 0.1, metal, 0, -0.13, 0.04));
        for (let k = 0; k < 4; k++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.01, 6, 14), cyan); ring.position.set(0, 0.02, -0.3 - k * 0.12); g.add(ring); }
        const f = flashAt(g, -1.05, 0.8); f.material.color.set('#5ae8ff');
        guns.rail = { g, flashes: [f], rings: g.children.filter((m) => m.geometry && m.geometry.type === 'TorusGeometry') }; }
      { const g = new THREE.Group();
        g.add(tube(0.1, 0.95, olive, 0, 0.02, -0.3), tube(0.115, 0.08, metal, 0, 0.02, -0.76), box(0.06, 0.16, 0.08, metal, 0, -0.12, -0.1), box(0.08, 0.06, 0.14, metal, -0.1, 0.1, -0.3));
        guns.roquette = { g, flashes: [flashAt(g, -0.84, 0.9)] }; }
      { const g = new THREE.Group();
        g.add(box(0.08, 0.1, 0.62, wood, 0, -0.01, -0.12), tube(0.02, 0.62, metal, 0, 0.02, -0.72), tube(0.04, 0.3, metal, 0, 0.1, -0.2), box(0.06, 0.16, 0.12, wood, 0, -0.12, 0.08), box(0.03, 0.05, 0.04, metal, 0.05, 0.03, -0.05));
        guns.sniper = { g, flashes: [flashAt(g, -1.05, 0.7)] }; }
      return guns;
    };
    const cams = [0, 1].map(() => {
      const cam = new THREE.PerspectiveCamera(58, 1, 0.08, 400);
      const guns = mkGuns();
      for (const k in guns) cam.add(guns[k].g);
      return { cam, guns, gun: guns.colt.g, cur: guns.colt, pos: new THREE.Vector3(), look: new THREE.Vector3(), roll: 0, fovK: 0 };
    });
    for (const c of cams) group.add(c.cam);
    this.fps3 = { group, tombs, tracers, cams, rockets, lasers, booms, stone, dark, coverMat, maps: {} };
  }

  enterFps(W, M) {
    if (!this.fps3) this.build3D();
    const R = this.R, g = M.g, F3 = this.fps3, VR = duelVar(g);
    this.mv.root.add(F3.group);
    // la carte de la variante (à la place de l'arène), et ses abris : des boîtes à ses couleurs
    const MAP = DUEL_MAPS[VR.id];
    this.enterMap(W, M, MAP);
    // (petites machines : les ombres calculées une fois pour la carte, puis figées)
    if (this.q === 0) { R.gl.shadowMap.autoUpdate = false; R.gl.shadowMap.needsUpdate = true; }
    F3.coverMat.color.set(MAP.cover); F3.coverMat.emissive.set(MAP.cover);
    F3.tombs.forEach((t, i) => {
      const c = g.covers[i];
      t.visible = !!c;
      if (!c) return;
      for (const m of t.userData.tomb) m.visible = false;
      t.userData.cbox.visible = true;
      t.position.set(c[0], g.gy, c[1]); t.userData.tilt = 0; t.userData.pivot.rotation.set(0, 0, 0); t.userData.pivot.scale.set(1, c[2], 1);
    });
    const gunId = VR.id === 'lune' || VR.id === 'noir' ? 'colt' : VR.scope ? 'sniper' : VR.id;
    F3.cams.forEach((c, i) => {
      const P = g.p[i], O = g.p[1 - i], E = duelEye(g, P);
      c.pos.set(E[0], E[1], E[2]); c.look.set(O.x, P.ay, P.az); c.roll = 0; c.fovK = 0;
      for (const k in c.guns) c.guns[k].g.visible = k === gunId;
      c.cur = c.guns[gunId]; c.gun = c.cur.g;
      for (const f of c.cur.flashes) f.material.opacity = 0;
    });
    for (const r of F3.rockets) r.visible = false;
    for (const l of F3.lasers) l.visible = false;
    const views = (i) => this.mv.views[g.p[i].slot];
    const show = (i) => { for (let k = 0; k < 2; k++) { const V = views(k); if (V) V.root.visible = k !== i; } };
    R.split = [
      { cam: F3.cams[0].cam, x: 0, w: 0.5, before: () => show(0) },
      { cam: F3.cams[1].cam, x: 0.5, w: 0.5, before: () => show(1) },
    ];
    R.split.after = () => { for (let k = 0; k < 2; k++) { const V = views(k); if (V) V.root.visible = true; } };
    for (let i = 0; i < 2; i++) { const F = W.fighters[g.p[i].slot], V = this.mv.views[F.slot], p = this.proxy(F, W); if (V && p && p !== 'hide') V.snapTo(p); }
  }

  // la carte du duel : l'arène se cache (sauf ses lumières), la carte (faite une fois par variante) prend sa place, avec
  // son ciel et son brouillard
  enterMap(W, M, MAP) {
    const R = this.R, F3 = this.fps3, g = M.g, sv = this.mv.stageView;
    const id = duelVar(g).id;
    if (!F3.maps[id]) F3.maps[id] = buildDuelMap(MAP, g);
    this.map3 = { grp: F3.maps[id], bg: R.scene.background, fog: R.scene.fog ? R.scene.fog.color.clone() : null, hidden: [] };
    for (const o of sv.group.children) if (!o.isLight && o.visible) { o.visible = false; this.map3.hidden.push(o); }
    if (this.mv.decals) { this.mv.decals.mesh.visible = false; }
    this.mv.root.add(F3.maps[id]);
    R.scene.background = new THREE.Color(MAP.sky);
    if (R.scene.fog) R.scene.fog.color.set(MAP.fog || MAP.sky);
  }

  exitMap() {
    const R = this.R, m = this.map3;
    if (!m) return;
    this.mv.root.remove(m.grp);
    for (const o of m.hidden) o.visible = true;
    if (this.mv.decals) this.mv.decals.mesh.visible = true;
    R.scene.background = m.bg;
    if (R.scene.fog && m.fog) R.scene.fog.color.copy(m.fog);
    this.map3 = null;
  }

  exitFps(W) {
    const R = this.R, F3 = this.fps3;
    R.gl.shadowMap.autoUpdate = true;
    this.exitMap();
    if (F3) this.mv.root.remove(F3.group);
    R.split = null;
    for (const F of W.list) { const V = this.mv.views[F.slot]; if (V) V.snapTo(F); }
  }

  // une traçante du canon de i vers le point touché (dispersée pour les plombs ; épaisse et bleue pour le railgun)
  tracer(W, i, ev, spread = 0, color = null, thick = 0.03) {
    const F3 = this.fps3, M = W.mg;
    if (!F3 || !M) return;
    const tr = F3.tracers.find((t) => t.t <= 0) || F3.tracers[0];
    const c = F3.cams[i];
    const from = this.tmpV.set(c.cur.two ? (M.g.p[i].gl ? -0.27 : 0.27) : 0.26, -0.2, -0.7).applyMatrix4(c.cam.matrixWorld);
    const to = new THREE.Vector3(ev.x, ev.y + (Math.random() - 0.5) * spread, ev.z + (Math.random() - 0.5) * spread);
    const len = from.distanceTo(to);
    tr.m.position.copy(from).lerp(to, 0.5); tr.m.lookAt(to); tr.m.scale.set(thick, thick, len);
    tr.life = thick > 0.05 ? 0.3 : 0.07; tr.t = tr.life; tr.m.visible = true; tr.m.material.opacity = 0.9;
    tr.m.material.color.set(color || '#ffe9a0');
  }

  // l'éclair d'une explosion de roquette
  boomFlash(ev) {
    const F3 = this.fps3;
    if (!F3) return;
    const b = F3.booms.find((x) => x.t <= 0) || F3.booms[0];
    b.t = 0.35; b.sp.visible = true; b.sp.position.set(ev.x, ev.y, ev.z);
  }

  updateFps(W, M, dt) {
    const R = this.R, g = M.g, F3 = this.fps3, VR = duelVar(g);
    // (les plateformes de l'arène se remontrent à chaque image, syncStageView : on les recache, elles reviennent après)
    if (this.map3) { for (const o of this.mv.stageView.surfaces || []) if (o) o.visible = false; animDeco(this.map3.grp, this.time); }
    const tv = R.tv, aspect = tv ? (tv.w * window.innerWidth / 2) / Math.max(1, tv.h * window.innerHeight) : (window.innerWidth / 2) / Math.max(1, window.innerHeight);
    F3.cams.forEach((c, i) => {
      const P = g.p[i], O = g.p[1 - i], E = duelEye(g, P);
      const k = 1 - Math.exp(-dt * 48); // (la caméra colle aux yeux : réactive)
      let ey = E[1];
      if (P.dead > 0) ey = g.gy + 0.35; // à terre
      c.pos.x += (E[0] - c.pos.x) * k; c.pos.y += (ey - c.pos.y) * Math.min(1, k * (P.slide ? 1.4 : 1)); c.pos.z += (E[2] - c.pos.z) * k;
      c.look.x += (O.x - c.look.x) * k; c.look.y += (P.ay - c.look.y) * Math.min(1, k * 2); c.look.z += (P.az - c.look.z) * Math.min(1, k * 2);
      this.shake[i] = Math.max(0, this.shake[i] - dt * 3.5);
      this.recoil[i] = Math.max(0, this.recoil[i] - dt * 8);
      this.slideT[i] = Math.max(0, this.slideT[i] - dt);
      this.boomT[i] = Math.max(0, this.boomT[i] - dt);
      const s = this.shake[i] * 0.07;
      c.cam.position.set(c.pos.x + (Math.random() - 0.5) * s, c.pos.y + (Math.random() - 0.5) * s + Math.sin(this.time * 9) * Math.min(0.02, Math.hypot(P.vx, P.vz) * 0.004), c.pos.z + (Math.random() - 0.5) * s);
      c.cam.lookAt(c.look.x, c.look.y + this.recoil[i] * 0.12, c.look.z);
      // le cadre penche dans le sens du mouvement (plus fort en glissade)
      const want = P.dead > 0 ? P.sd * 0.5 : -P.vz * P.sd * 0.006 * (P.slide ? 2.2 : 1);
      c.roll += (want - c.roll) * Math.min(1, dt * 10);
      c.cam.rotateZ(c.roll);
      // champ de vision : il s'ouvre en glissade, se resserre en chargeant le railgun et sur un kill
      const sc = duelScoped(VR, P), FVz = fpsVar(M).zoom;
      const fovK = sc ? FVz - 58 : this.slideT[i] * 40 - (VR.charge ? P.ch / VR.charge * 26 : 0) - this.boomT[i] * 30;
      c.fovK += (fovK - c.fovK) * Math.min(1, dt * (sc ? 30 : 14));
      const fov = 58 + this.recoil[i] * 3 + c.fovK;
      if (c.cam.aspect !== aspect || Math.abs(c.cam.fov - fov) > 0.01) { c.cam.aspect = aspect; c.cam.fov = fov; c.cam.updateProjectionMatrix(); }
      // l'arme : au centre pour l'akimbo (deux pistolets, recul alterné), sur l'épaule pour le lance-roquettes
      const bob = Math.sin(this.time * (P.slide ? 0 : 2.1 + Math.hypot(P.vx, P.vz) * 1.2) + i) * (0.006 + Math.min(0.02, Math.hypot(P.vx, P.vz) * 0.002));
      const base = c.cur.two ? [0, -0.22, -0.55] : VR.rocket ? [0.3, -0.16, -0.5] : VR.charge ? [0.3, -0.26, -0.7] : [0.26, -0.22, -0.6];
      c.gun.position.set(base[0], base[1] + bob - (P.reload ? 0.15 : 0) - (P.slide ? 0.04 : 0), base[2] + this.recoil[i] * 0.08);
      c.gun.rotation.set(this.recoil[i] * (VR.pellets || VR.rocket ? 0.6 : 0.4) + (P.reload ? -0.6 : 0), 0.05, (P.reload ? 0.5 : 0) + (P.slide ? 0.25 : 0));
      if (c.cur.two) c.gun.children.forEach((u, n) => { u.position.z = n === P.gl ? this.recoil[i] * 0.07 : 0; });
      if (c.cur.rings) c.cur.rings.forEach((rg, n) => { const q = VR.charge ? P.ch / VR.charge : 0; rg.scale.setScalar(1 + (q > n / 4 ? 0.3 + Math.sin(this.time * 30 + n) * 0.1 : 0)); });
      c.gun.visible = P.dead <= 0 && !sc;
      this.muzzle[i] = Math.max(0, this.muzzle[i] - dt);
      c.cur.flashes.forEach((f, n) => { f.material.opacity = this.muzzle[i] > 0 && (!c.cur.two || n === 1 - P.gl) ? 1 : 0; f.material.rotation = Math.random() * 6; });
      // le laser du railgun en charge : une ligne rouge des yeux du tireur vers son viseur (l'autre la voit venir)
      const las = F3.lasers[i];
      if (VR.charge && P.ch > 0 && P.dead <= 0) {
        const q = P.ch / VR.charge, to = new THREE.Vector3(O.x, P.ay, P.az), from = this.tmpV.set(E[0], E[1] - 0.12, E[2]).lerp(to, 0.22); // (pas collé à la caméra du tireur)
        las.visible = true; las.position.copy(from).lerp(to, 0.5); las.lookAt(to); las.scale.set(0.01 + q * 0.012, 0.01 + q * 0.012, from.distanceTo(to));
        las.material.opacity = (0.25 + q * 0.6) * (0.75 + Math.random() * 0.25);
      } else las.visible = false;
    });
    for (const t of F3.tracers) if (t.t > 0) { t.t -= dt; t.m.material.opacity = Math.max(0, t.t / t.life) * 0.9; if (t.t <= 0) t.m.visible = false; }
    // les roquettes en vol, les éclairs d'explosion
    F3.rockets.forEach((r, n) => {
      const k = g.rk[n];
      r.visible = !!k;
      if (!k) return;
      r.position.set(k[0], k[1], k[2]); r.rotation.y = -Math.atan2(k[5], k[3]);
      r.userData.fire.scale.setScalar(0.5 + Math.random() * 0.4);
    });
    for (const b of F3.booms) if (b.t > 0) { b.t -= dt; const q = 1 - b.t / 0.35; b.sp.scale.setScalar(1 + q * 4); b.sp.material.opacity = Math.max(0, 1 - q); if (b.t <= 0) b.sp.visible = false; }
    if (R.scene.fog) { R.scene.fog.near = g.L * 2 + 14; R.scene.fog.far = g.L * 2 + 70; }
    g.covers.forEach((c, i) => {
      const t = F3.tombs[i], want = c[3] >= 3 ? 0 : c[3] > 0 ? 0.1 * (3 - c[3]) : 1.5;
      t.userData.tilt += (want - t.userData.tilt) * Math.min(1, dt * (want > 1 ? 7 : 14));
      t.userData.pivot.rotation.set(-t.userData.tilt, 0, c[3] > 0 && c[3] < 3 ? 0.05 : 0);
    });
    for (let i = 0; i < 2; i++) this.hurt[i] = Math.max(0, this.hurt[i] - dt * 2.5);
  }

  // --- le canevas par-dessus tout ----------------------------------------------------------------------------------
  draw(W, M, dt, alpha) {
    const cv = this.cv, ctx = this.g;
    this.dt = dt;
    const w = window.innerWidth, h = window.innerHeight, dpr = [0.75, 1, Math.min(window.devicePixelRatio || 1, 1.5)][this.q]; // (le calque : pas plus fin que 1,5 pixel par point, moins sur les petites machines)
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (const f of this.floats) f.t += dt;
    this.floats = this.floats.filter((f) => f.t < f.life);
    if (this.banner) { this.banner.t += dt; if (this.banner.t > this.banner.life) this.banner = null; }
    if (!(w > 0 && h > 0)) return; // fenêtre réduite ou cachée : rien à dessiner
    const k = Math.min(w / 640, h / 360);
    this.k = k; this.ox = (w - 640 * k) / 2 / k; this.oy = (h - 360 * k) / 2 / k; // marges (en unités de la grille)
    ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * (w - 640 * k) / 2, dpr * (h - 360 * k) / 2);
    ctx.imageSmoothingEnabled = false;
    ctx.textBaseline = 'middle';
    if (!M) {
      // de retour au combat : le match figé 2 s (« prêts ? »), le flash info, les succès, les dernières particules
      if (!W.mgResume && !this.news && !this.newsLater && !this.tok && !this.mocks.length && !this.toasts.length && !this.parts.length && !this.stickers.length && !this.floats.length) return;
      if (W.mgResume) {
        this.drawResume(W, W.mgResume);
      }
      this.drawFloats();
      this.drawMock(W, dt);
      this.drawNews(W, dt);
      this.drawFx(null, dt);
      this.drawToasts(dt);
      return;
    }
    // le jeu passe à la télé : il se dessine directement dans l'écran de la télé, sur le calque (les coordonnées de la
    // grille 640 x 360, mises à la taille et à la pente de l'écran), sur l'image 3D d'un jeu en 3D ou sur le combat figé.
    // (Avant : sur un canevas à part recopié ensuite ; la recopie forçait le navigateur à finir ce dessin sur-le-champ,
    // 5 à 17 ms d'attente à chaque image.)
    const cw = Math.max(320, Math.min([560, 720, 960][this.q], Math.round(TV.w * (this.k || 1) * dpr))), ch = Math.round(cw * 9 / 16);
    const XT = EXTRA_VIEWS[M.kind], is3D = M.kind === 'fps' || !!(XT && XT.enter3D);
    // la télé tombe et s'allume (son nom et son but à l'écran), passe le jeu, s'éteint à la fin
    let off = 0, power = 1;
    if (M.ph === 'intro') {
      // elle tombe du plafond (de plus en plus vite), les câbles la rattrapent : un petit rebond
      const d = M.t / 60; off = d < 0.3 ? 1 - (d / 0.3) * (d / 0.3) : -0.05 * Math.exp(-(d - 0.3) * 7) * Math.sin((d - 0.3) * 20);
      power = M.t < 14 ? 0 : Math.min(1, (M.t - 14) / 10);
    } else if (M.ph === 'outro' && M.t > MG_WIN - 30) {
      // la fin : l'image s'écrase en un point, puis la télé remonte tout de suite (partie avant le retour dans l'arène)
      power = Math.max(0, 1 - (M.t - (MG_WIN - 30)) / 14);
      if (M.t > MG_WIN - 16) { const u = (M.t - (MG_WIN - 16)) / 16; off = u * u; }
    }
    this.R.tvOut = is3D ? [cw, ch] : null; // (le moteur recopie la 3D de l'écran directement à cette taille)
    // autour de la télé : le combat figé, assombri (pour un jeu en 3D, pas l'écran : on y voit la 3D, à travers)
    ctx.fillStyle = 'rgba(6,2,12,0.3)';
    if (is3D && this.R.tv) { ctx.save(); this.tvPose(ctx, off); ctx.beginPath(); ctx.rect(-2000, -2000, 4640, 4360); ctx.roundRect(TV.x, TV.y, TV.w, TV.h, 16); ctx.fill('evenodd'); ctx.restore(); }
    else ctx.fillRect(-this.ox - 2, -this.oy - 2, 644 + this.ox * 2, 364 + this.oy * 2);
    this.drawTVBody(off);
    this.drawTVScreen(off, cw, ch, () => {
      if (is3D && M.ph !== 'intro' && power >= 1 && this.R.tv) { /* rien : l'écran est percé, la 3D est derrière */ }
      else if (!is3D && M.ph !== 'intro' && power >= 1 && this.R.frozenCanvas) {
        // un jeu en 2D se joue sur le combat figé et grisé, comme avant la télé (l'image réduite une fois à la taille de l'écran)
        if (this.bgVer !== this.R.frozenVer || !this.bgC || this.bgC.width !== cw) {
          this.bgVer = this.R.frozenVer; this.bgC = this.bgC || document.createElement('canvas'); this.bgC.width = cw; this.bgC.height = ch;
          this.bgC.getContext('2d').drawImage(this.R.frozenCanvas, 0, 0, cw, ch);
        }
        ctx.drawImage(this.bgC, 0, 0, 640, 360);
      } else { ctx.fillStyle = '#0c0a12'; ctx.fillRect(0, 0, 640, 360); }
      ctx.imageSmoothingEnabled = false;
      if (power >= 1 && M.ph !== 'intro') {
        ctx.save(); this.drawGame(W, M, dt, alpha); ctx.restore();
        if (M.kind !== 'fps' && M.ph === 'play' && !(XT && XT.tags === false)) this.drawTags(W, M);
        // le début du jeu : le but en une phrase, en bas de l'écran, 3 s
        // (1,5 s seulement : la voix le dit aussi, et chaque jeu montre ses touches là où on joue)
        if (M.ph === 'play' && M.t < 100) {
          const a = Math.min(1, (100 - M.t) / 25, M.t / 12);
          ctx.globalAlpha = 0.7 * a; ctx.fillStyle = '#0b0610'; ctx.fillRect(0, 326, 640, 28); ctx.globalAlpha = 1;
          this.text(goalOf(M), 320, 340, 17, '#ffffff', { alpha: a });
        }
      } else if (power >= 1) {
        ctx.fillStyle = TITLE_COL[M.kind] || '#ff2a6a'; ctx.globalAlpha = 0.25; ctx.fillRect(0, 0, 640, 360); ctx.globalAlpha = 1;
        this.text(`${ICONS[M.kind]} ${titleOf(M)}`, 320, 168, 52, '#ffffff', { title: true });
        this.text(goalOf(M), 320, 222, 20, '#e8e0f0');
      } else if (power > 0) {
        // allumage (une ligne blanche qui s'ouvre) ou extinction (l'image s'écrase en une ligne, puis en un point)
        const q = power, hh = Math.max(3, 360 * Math.max(0, (q - 0.35) / 0.65)), ww = q < 0.35 ? 640 * (q / 0.35) : 640;
        ctx.fillStyle = '#f4f0ff'; ctx.globalAlpha = q < 0.35 ? 1 : 1 - (q - 0.35) / 0.65 * 0.85;
        ctx.fillRect(320 - ww / 2, 180 - hh / 2, ww, hh); ctx.globalAlpha = 1;
      }
    });
    // la neige du début (le temps que l'image se cale)
    if (M.ph === 'play' && M.t < 10) {
      ctx.save(); this.tvPose(ctx, 0); ctx.beginPath(); ctx.roundRect(TV.x, TV.y, TV.w, TV.h, 16); ctx.clip(); ctx.globalAlpha = 0.5 * (1 - M.t / 10);
      for (let n = 0; n < 140; n++) { ctx.fillStyle = Math.random() < 0.5 ? '#fff' : '#555'; ctx.fillRect(TV.x + Math.random() * TV.w, TV.y + Math.random() * TV.h, 3, 2); }
      ctx.restore();
    }
    // les touches des joueurs de ce PC, sous la télé, tout le jeu (bien visibles les 3 premières secondes)
    if (M.ph === 'play') {
      const a = M.t < 200 ? Math.min(1, M.t / 12) : 0.85, B = 360 + this.oy;
      this.drawKeys(W, M, B - 12, a);
    }
    this.drawToasts(dt);
  }

  // le contenu du mini-jeu (sur le canevas de la télé)
  drawGame(W, M, dt, alpha) {
    const ctx = this.g;
    // secousse et coup de zoom (tout le canevas)
    const j = this.jx;
    j.shake = Math.max(0, j.shake - dt * 3); j.punch *= Math.exp(-dt * 9);
    const sh = j.shake * j.shake * 9, pz = 1 + j.punch;
    ctx.translate(320 + (Math.random() - 0.5) * sh, 180 + (Math.random() - 0.5) * sh); ctx.scale(pz, pz); ctx.translate(-320, -180);
    if (M.kind === 'fps' && M.ph !== 'intro') this.drawFps(W, M, dt);
    if (M.kind === 'candy' && M.ph !== 'intro') this.drawCandy(W, M, dt, alpha);
    if (M.kind === 'horses' && M.ph !== 'intro') this.drawHorses(W, M, dt);
    if (M.kind === 'moral' && M.ph !== 'intro') this.drawMoral(W, M, dt);
    if (M.kind === 'dance' && M.ph !== 'intro') this.drawDance(W, M, dt);
    if (M.kind === 'surgery' && M.ph !== 'intro') this.drawSurgery(W, M, dt);
    if (EXTRA_VIEWS[M.kind] && M.ph !== 'intro') EXTRA_VIEWS[M.kind].draw(this, W, M, dt, alpha);
    const LH = LEGACY_HINTS[M.kind];
    if (LH && M.ph === 'play') for (let i = 0; i < 2; i++) this.hint(W, M, i, LH.at[i][0], LH.at[i][1], LH.keys);
    this.drawFloats();
    if (this.banner) {
      const b = this.banner, t = b.t;
      const sc = t < 0.15 ? 2.2 - t / 0.15 * 1.2 : 1 + Math.sin(t * 9) * 0.02;
      const a = Math.min(1, (b.life - t) / 0.3);
      this.text(b.text, 320, b.y ?? 96, (b.size || 52) * sc, b.color, { alpha: a, title: true });
      if (b.sub) this.text(b.sub, 320, (b.y ?? 96) + 40, 18, '#ffffff', { alpha: a });
    }
    if (M.ph === 'outro') this.drawWin(W, M);
    this.drawFx(M, dt);
  }

  drawFloats() {
    for (const f of this.floats) {
      const a = 1 - Math.max(0, (f.t - f.life * 0.6) / (f.life * 0.4));
      const sc = f.t < 0.12 ? 0.5 + f.t / 0.12 * 0.7 : 1.2 - Math.min(0.2, (f.t - 0.12));
      this.text(f.text, f.x, f.y - f.t * 26, f.size * sc, f.color, { alpha: a });
    }
  }

  // un texte (contour sombre, puis la couleur) ; dessiné une fois dans une petite image gardée (TEXT_CACHE), puis juste
  // collé : écrire coûte cher (surtout le contour), et les mêmes textes reviennent à chaque image. Tant que les polices
  // ne sont pas toutes chargées, on écrit directement (sinon l'image garderait la police de secours).
  text(str, x, y, size, color, o = {}) {
    const ctx = this.g;
    str = String(str);
    if (!str) return;
    // (une taille qui change à chaque image, un chiffre qui grossit : écrit à la taille ronde la plus proche, 9 % près, puis
    // agrandi au collage ; sinon une nouvelle petite image à chaque image)
    const fq = size > 14 ? Math.round(2 ** (Math.round(Math.log2(size) * 8) / 8)) : Math.round(size), kq = size / fq;
    const font = `${o.bold ? '900 ' : ''}${fq}px ${o.title ? "Creepster, 'Lilita One', fantasy" : o.mono ? "'Arial Black', Impact, sans-serif" : "'Lilita One', 'Trebuchet MS', sans-serif"}`;
    const stroke = o.stroke !== false, lw = Math.max(2, fq / 7), al = o.align || 'center';
    const m = ctx.getTransform(), sc = Math.max(0.5, Math.min(4, Math.round(Math.hypot(m.a, m.b) * kq * 4) / 4));
    const key = `${font}|${color}|${stroke ? 1 : 0}|${o.maxW || 0}|${sc}|${str}`;
    let sp = TEXT_CACHE.get(key);
    if (!sp && ((typeof document !== 'undefined' && document.fonts && document.fonts.status !== 'loaded') || !spriteBudget())) {
      ctx.save();
      ctx.globalAlpha = o.alpha ?? 1; ctx.textAlign = al; ctx.lineJoin = 'round'; ctx.textBaseline = 'middle';
      ctx.translate(x, y); ctx.scale(kq, kq); ctx.font = font;
      const mw = o.maxW ? o.maxW / kq : undefined;
      if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = '#0b0610'; ctx.strokeText(str, 0, 0, mw); }
      ctx.fillStyle = color; ctx.fillText(str, 0, 0, mw);
      ctx.restore();
      return;
    }
    if (!sp) {
      if (TEXT_CACHE.size > 600) TEXT_CACHE.clear();
      const c = document.createElement('canvas'), g = c.getContext('2d');
      g.font = font;
      let tw = g.measureText(str).width;
      if (o.maxW && tw > o.maxW / kq) tw = o.maxW / kq;
      const pad = (stroke ? lw : 0) + 2, h = fq * 1.5 + pad * 2;
      c.width = Math.max(1, Math.ceil((tw + pad * 2) * sc)); c.height = Math.max(1, Math.ceil(h * sc));
      g.scale(sc, sc); g.font = font; g.textBaseline = 'middle'; g.textAlign = 'left'; g.lineJoin = 'round';
      if (stroke) { g.lineWidth = lw; g.strokeStyle = '#0b0610'; g.strokeText(str, pad, h / 2, o.maxW ? o.maxW / kq : undefined); }
      g.fillStyle = color; g.fillText(str, pad, h / 2, o.maxW ? o.maxW / kq : undefined);
      sp = { c, w: c.width / sc, h: c.height / sc, pad, tw };
      TEXT_CACHE.set(key, sp);
    }
    const tw = sp.tw * kq, left = al === 'center' ? x - tw / 2 : al === 'right' ? x - tw : x;
    const prev = ctx.globalAlpha;
    ctx.globalAlpha = o.alpha ?? 1;
    ctx.drawImage(sp.c, left - sp.pad * kq, y - sp.h * kq / 2, sp.w * kq, sp.h * kq);
    ctx.globalAlpha = prev;
  }

  panel(x, y, w, h, color = 'rgba(14,6,22,0.82)', border = '#e0b020') {
    const ctx = this.g;
    ctx.fillStyle = color; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#0b0610'; ctx.lineWidth = 4; ctx.strokeRect(x - 1, y - 1, w + 2, h + 2);
    ctx.strokeStyle = border; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  }

  secsLeft(M) { return Math.max(0, Math.ceil((MG_PLAY - (M.ph === 'play' ? M.t : MG_PLAY)) / 60)); }
  timer(M, x, y) {
    const left = this.secsLeft(M);
    this.text(String(left), x, y, 30, left <= 5 ? '#ff4040' : '#f4ead6', { title: true });
  }

  // un texte coupé en lignes de maxW au plus (police normale de taille size)
  splitLines(str, maxW, size) {
    const ctx = this.g;
    ctx.font = `${size}px 'Lilita One', 'Trebuchet MS', sans-serif`;
    const out = [];
    let cur = '';
    for (const w of str.split(' ')) { const tt = cur ? cur + ' ' + w : w; if (ctx.measureText(tt).width > maxW && cur) { out.push(cur); cur = w; } else cur = tt; }
    if (cur) out.push(cur);
    return out;
  }

  // les touches d'un jeu pour les joueurs de ce PC (pas les CPU, ni les joueurs d'un autre PC) : J1 sur la moitié gauche,
  // J2 sur la droite, sur plusieurs lignes s'il le faut (la dernière ligne en y)
  drawKeys(W, M, y, alpha) {
    const ctx = this.g, K = typeof KEYS[M.kind] === 'function' ? KEYS[M.kind](M) : KEYS[M.kind];
    if (!K) return;
    [M.a, M.v].forEach((slot, i) => {
      const dev = this.deviceOf(slot);
      if (!dev || W.fighters[slot].bot) return;
      const kb = dev === 'kb1' || dev === 'kb2', names = KEY_NAMES[kb ? dev : 'pad'];
      const list = Array.isArray(K) ? K : (dev === 'kb1' && K.kb1) || (kb ? K.kb : K.pad) || K.pad;
      ctx.font = "9px 'Arial Black', Impact, sans-serif";
      const items = list.map(([k, what]) => { const key = names[k] || k; return { key, what, kw: ctx.measureText(key).width + 10 }; });
      ctx.font = "11px 'Lilita One', 'Trebuchet MS', sans-serif";
      for (const it of items) { it.ww = ctx.measureText(it.what).width; it.w = it.kw + 5 + it.ww; }
      // les lignes, dans sa moitié de l'écran
      const tag = 26, maxW = 320 + this.ox - 24 - tag, rows = [[]];
      let rw = 0;
      for (const it of items) { if (rw && rw + 12 + it.w > maxW) { rows.push([]); rw = 0; } rows[rows.length - 1].push(it); rw += (rw ? 12 : 0) + it.w; }
      // en jeu, un fond sombre derrière (le jeu a ses propres affichages en bas)
      if (M.ph === 'play') { ctx.globalAlpha = 0.72 * alpha; ctx.fillStyle = '#0b0610'; ctx.fillRect(i === 0 ? -this.ox : 320, y - rows.length * 20 + 8, 320 + this.ox, rows.length * 20 + 6); }
      ctx.globalAlpha = alpha;
      rows.forEach((row, r) => {
        const ry = y - (rows.length - 1 - r) * 20, total = row.reduce((s2, it, n) => s2 + it.w + (n ? 12 : 0), 0);
        let x = i === 0 ? -this.ox + 10 + tag : 640 + this.ox - 10 - total;
        if (r === 0) this.text(this.pname(slot), i === 0 ? x - tag : x - 6, ry, 12, COLORS[slot], { align: i === 0 ? 'left' : 'right', mono: true, alpha });
        for (const it of row) {
          ctx.globalAlpha = alpha;
          ctx.fillStyle = '#f4ead6'; ctx.fillRect(x, ry - 8, it.kw, 16);
          ctx.fillStyle = COLORS[slot]; ctx.fillRect(x, ry + 6, it.kw, 2);
          ctx.strokeStyle = '#0b0610'; ctx.lineWidth = 2; ctx.strokeRect(x, ry - 8, it.kw, 16);
          this.text(it.key, x + it.kw / 2, ry, 9, '#0b0610', { mono: true, stroke: false, alpha });
          this.text(it.what, x + it.kw + 5, ry, 11, '#ffffff', { align: 'left', alpha });
          x += it.w + 12;
        }
      });
      ctx.globalAlpha = 1;
    });
  }


  portraitAt(char, x, y, size, color, flip, alpha = 1) {
    const ctx = this.g, im = portrait(char);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    if (flip) ctx.scale(-1, 1);
    ctx.fillStyle = '#0b0610'; ctx.fillRect(-size / 2 - 5, -size / 2 - 5, size + 10, size + 10);
    ctx.fillStyle = color; ctx.fillRect(-size / 2 - 3, -size / 2 - 3, size + 6, size + 6);
    ctx.fillStyle = '#1a1424'; ctx.fillRect(-size / 2, -size / 2, size, size);
    if (im.complete && im.naturalWidth) ctx.drawImage(im, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  // le nom d'une touche pour l'appareil du joueur i (k : un nom du contrat, 'A', 'X', 'dirs', 'lr'...) : « J », « NUM 1 »,
  // « A »... ; pour un CPU, le nom manette
  keyName(M, i, k) {
    const dev = this.deviceOf(i === 0 ? M.a : M.v), kb = dev === 'kb1' || dev === 'kb2';
    return KEY_NAMES[kb ? dev : 'pad'][k] || k;
  }

  // les touches d'un joueur, LÀ OÙ IL JOUE (près de ce qu'il pilote) : list = [[touche, action], ...] (les noms du contrat :
  // 'A', 'X', 'JUMP', 'dirs', 'lr', 'up', 'down', 'mouse'...), écrites pour son appareil (clavier 1, clavier 2, manette) ;
  // rien pour un CPU. Grande et qui pulse les 3 premières secondes, puis discrète. (x, y) : le milieu (align 'center'), ou
  // un bord ; rend la largeur.
  hint(W, M, i, x, y, list, o = {}) {
    const slot = i === 0 ? M.a : M.v, F = W.fighters[slot];
    if (!F || F.bot || !list || !list.length || M.ph !== 'play') return 0;
    const ctx = this.g, col = COLORS[slot], early = M.t < 180, z = (o.size || 1) * (early ? 1.25 + (this.beatPop || 0) * 0.08 : 0.9);
    const al = early ? 1 : (o.alpha ?? 0.8);
    ctx.save();
    const items = list.map(([k, what]) => {
      const key = this.keyName(M, i, k);
      ctx.font = `${Math.round(9 * z)}px 'Arial Black', Impact, sans-serif`; const kw = ctx.measureText(key).width + 10 * z;
      ctx.font = `${Math.round(10 * z)}px 'Lilita One', 'Trebuchet MS', sans-serif`; const ww = what ? ctx.measureText(what).width : 0;
      return { key, what, kw, ww, w: kw + (what ? 4 * z + ww : 0) };
    });
    const gap = 9 * z, total = items.reduce((s2, it, n) => s2 + it.w + (n ? gap : 0), 0) + 10 * z, hh = 18 * z;
    const a = o.align || 'center', x0 = a === 'center' ? x - total / 2 : a === 'right' ? x - total : x;
    ctx.globalAlpha = al * 0.85; ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.roundRect(x0, y - hh / 2, total, hh, 5 * z); ctx.fill();
    ctx.globalAlpha = al; ctx.strokeStyle = col; ctx.lineWidth = 1.5 * z; ctx.stroke();
    let cx = x0 + 5 * z;
    for (const it of items) {
      ctx.fillStyle = '#f4ead6'; ctx.fillRect(cx, y - 7 * z, it.kw, 14 * z);
      ctx.fillStyle = col; ctx.fillRect(cx, y + 5 * z, it.kw, 2 * z);
      this.text(it.key, cx + it.kw / 2, y, 9 * z, '#0b0610', { mono: true, stroke: false, alpha: al });
      if (it.what) this.text(it.what, cx + it.kw + 4 * z, y, 10 * z, '#ffffff', { align: 'left', stroke: false, alpha: al });
      cx += it.w + gap;
    }
    ctx.restore();
    return total;
  }

  // qui est qui : l'étiquette d'un joueur (i : 0 l'attaquant, à gauche ; 1 sa cible, à droite) : sa tête, son pseudo et son
  // perso, à sa couleur, et « CPU » pour l'ordinateur. (x, y) : le coin haut de l'étiquette, align 'left' / 'right' /
  // 'center' ; size : l'échelle (1 : 26 de haut). Rend la largeur. À poser près de la zone de chaque joueur.
  who(W, M, i, x, y, o = {}) {
    const ctx = this.g, slot = i === 0 ? M.a : M.v, F = W.fighters[slot];
    if (!F) return 0;
    const z = o.size || 1, h = 26 * z, col = COLORS[slot], name = this.pname(slot).toUpperCase(), ch = (CHARS[F.char] ? CHARS[F.char].name : F.char).toUpperCase();
    ctx.save();
    ctx.font = `${Math.round(11 * z)}px 'Lilita One', 'Trebuchet MS', sans-serif`;
    const w1 = ctx.measureText(name + (F.bot ? '  CPU' : '')).width;
    ctx.font = `${Math.round(8 * z)}px 'Lilita One', 'Trebuchet MS', sans-serif`;
    const w = h + 8 * z + Math.max(w1, ctx.measureText(ch).width), al = o.align || 'left';
    const x0 = al === 'right' ? x - w : al === 'center' ? x - w / 2 : x;
    ctx.globalAlpha = o.alpha ?? 1;
    ctx.fillStyle = 'rgba(10,6,16,0.85)'; ctx.beginPath(); ctx.roundRect(x0, y, w, h, 6 * z); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 2 * z; ctx.stroke();
    ctx.restore();
    this.portraitAt(F.char, x0 + h / 2, y + h / 2, h - 10 * z, col, i === 1, o.alpha ?? 1);
    const tx = x0 + h + 3 * z;
    this.text(name, tx, y + 9 * z, 11 * z, '#ffffff', { align: 'left', stroke: false, alpha: o.alpha });
    if (F.bot) this.text('CPU', tx + ctx.measureText(name).width + 6 * z, y + 9 * z, 8 * z, '#9a8aa8', { align: 'left', stroke: false, alpha: o.alpha, mono: true });
    this.text(ch, tx, y + 19 * z, 8 * z, col, { align: 'left', stroke: false, alpha: o.alpha });
    return w;
  }

  // les deux étiquettes en haut de l'écran (chaque jeu sauf le duel : son propre HUD ; tags: false dans sa vue pour les
  // poser soi-même), un peu plus grandes les 3 premières secondes
  drawTags(W, M) {
    const z = M.ph === 'play' && M.t < 180 ? 1.15 : 1;
    this.who(W, M, 0, 6, 6, { size: z });
    this.who(W, M, 1, 634, 6, { size: z, align: 'right' });
  }

  // l'écran de victoire : la tête du gagnant en gros, « EZ WIN », puis (s'il y a un perdant) ses dégâts
  drawWin(W, M) {
    const r = M.res || {};
    const ctx = this.g, t = M.t / 60;
    const a = Math.min(1, M.t / 6) * Math.min(1, ((r.d > 0 ? MG_WIN : mgOutro(M)) - M.t) / 10);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(6,2,12,0.82)';
    ctx.fillRect(-this.ox - 10, -this.oy - 10, 660 + this.ox * 2, 380 + this.oy * 2);
    if (r.w >= 0) {
      const col = COLORS[r.w];
      // rayons qui tournent
      ctx.save(); ctx.translate(320, 160); ctx.rotate(t * 0.8);
      for (let i = 0; i < 16; i++) {
        ctx.fillStyle = i % 2 ? col : '#ffd23a'; ctx.globalAlpha = a * 0.22;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 520, i * Math.PI / 8, (i + 0.5) * Math.PI / 8); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      ctx.globalAlpha = a;
      // le perdant à l'écart, tout petit, bleu de chagrin, qui pleure à chaudes larmes
      if (r.l >= 0) {
        const lx = 104, ly = 322, lh = 96;
        ctx.fillStyle = 'rgba(60,120,255,0.25)'; ctx.beginPath(); ctx.ellipse(lx, ly, 40, 8, 0, 0, Math.PI * 2); ctx.fill();
        this.puppet(W.fighters[r.l].char, lx + Math.sin(t * 40) * 0.8, ly, lh, clipFor(W.fighters[r.l].char, { key: 'w' + r.l, emote: 'sob', head: 2.1, face: 'three', tint: '#2a50ff', tintK: 0.35, squash: [1.06, 0.94] }));
        if (Math.random() < 0.3) this.burst(lx + (Math.random() < 0.5 ? -9 : 9), ly - lh * 1.08, 1, ['#fff'], { shape: 'txt', ch: '💧', speed: 70, dir: Math.random() < 0.5 ? -2.4 : -0.7, spread: 0.5, up: 40, g: 420, size: 6, life: 0.7 });
        this.text('*snif*', lx - 40, ly - lh * 1.1 + Math.sin(t * 5) * 3, 11, '#9ac0ff', { mono: true });
      }
      // le gagnant en grand, grosse tête : il tombe du ciel, s'écrase, et fait sa danse de victoire
      const s = M.t < 14 ? back(M.t / 14) : 1;
      const land = M.t >= 14 && M.t < 24 ? 1 - (M.t - 14) / 10 : 0;
      const sh = M.t < 20 ? (20 - M.t) * 0.6 : 0;
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(320, 300, 70 + land * 30, 12, 0, 0, Math.PI * 2); ctx.fill();
      if (!this.puppet(W.fighters[r.w].char, 320 + (Math.random() - 0.5) * sh, 300 - (1 - s) * 260, 196, clipFor(W.fighters[r.w].char, { key: 'w' + r.w, emote: 'win', head: 2.1 + Math.sin(t * 6) * 0.06, squash: [1 + land * 0.35, 1 - land * 0.3], shadow: false })))
        this.portraitAt(W.fighters[r.w].char, 320, 150, 190 * s, col, false, a);
      const ez = M.t < 10 ? 3 - M.t / 10 * 2 : 1 + Math.sin(t * 10) * 0.03;
      ctx.save(); ctx.translate(320, 284); ctx.rotate(-0.06);
      this.text('EZ WIN', 0, 0, 64 * ez, '#ffe24a', { title: true, alpha: a });
      ctx.restore();
      this.text(this.label(W, r.w), 320, 34, 18, col, { alpha: a });
    } else {
      // égalité : les deux sonnés, de chaque côté
      [M.a, M.v].forEach((slot, i) => this.puppet(W.fighters[slot].char, i ? 500 : 140, 320, 130, { key: 'w' + slot, state: 'dizzy', head: 2, face: i ? 'threeL' : 'three', rot: Math.sin(t * 4 + i) * 0.08 }));
      this.text('ÉGALITÉ', 320, 160, 60, '#ffffff', { title: true, alpha: a });
      this.text('Personne ne prend de %', 320, 210, 16, '#e8dcc4', { alpha: a });
    }
    ctx.restore();
  }

  // de retour dans l'arène, tout figé (MG_RESUME) : le perdant encaisse ses % coup après coup, dans le vrai jeu (son % monte
  // dans le HUD du combat, les coups sont des évènements mgHurtHit), puis « PRÊTS ? » juste avant que tout reparte
  drawResume(W, R) {
    const e = MG_RESUME - R.t, got = HURT_AT.filter((f) => e >= f).length, ctx = this.g;
    if (R.l >= 0 && R.d > 0 && e < HURT_AT[HURT_AT.length - 1] + 40 && R.t >= MG_READY) {
      const a = Math.min(1, e / 10);
      ctx.globalAlpha = 0.7 * a; ctx.fillStyle = '#0b0610'; ctx.fillRect(210, 14, 220, 36); ctx.globalAlpha = 1;
      this.text(`${this.label(W, R.w)} ENVOIE LA FACTURE`, 320, 24, 10, COLORS[R.w], { mono: true, alpha: a });
      const shown = got ? Math.round(R.d * [0.1, 0.25, 0.45, 0.68, 1][got - 1]) : 0;
      this.text(`${this.pname(R.l)} +${shown} %`, 320, 40, 15 + (got === HURT_AT.length ? 5 : 0), '#ff4a3a', { title: true, alpha: a });
    }
    // « PRÊTS ? » et le compte à rebours 3, 2, 1, caméra large : le temps de se remettre en place avant que tout reparte
    if (R.t < MG_READY) {
      const n = Math.ceil(R.t / (MG_READY / 3)), u = 1 - (R.t % (MG_READY / 3)) / (MG_READY / 3), sc = u < 0.2 ? 1.8 - u / 0.2 * 0.8 : 1;
      if (n !== this.readyN) { this.readyN = n; if (this.audio) this.audio.sfx('countHi', 0, 0.7, 4 - n); }
      this.text('PRÊTS ?', 320, 58, 22, '#ffe24a', { title: true });
      ctx.save(); ctx.translate(320, 104); ctx.scale(sc, sc);
      this.text(String(n), 0, 0, 56, '#ffffff', { title: true });
      ctx.restore();
    } else this.readyN = 0;
  }

  // --- le fantôme du gagnant : pendant la facture, dans l'arène figée, une copie translucide et lumineuse du gagnant
  // apparaît à côté du perdant, enchaîne de vrais coups (calés pour toucher pile aux coups HURT_AT, où ses % montent),
  // se téléporte d'un côté à l'autre, met une grosse frappe au dernier et donne le coup final qui l'éjecte
  // un fantôme prêt d'avance (pendant la présentation), caché ; makeGhost prend celui du gagnant
  // (un par joueur, gardé d'un mini-jeu à l'autre, caché entre deux : rien à refaire ni à renvoyer à la carte graphique)
  // (warm = false : le modèle seulement, ses shaders à un prochain appel ; prewarm le fait en deux images au début du match)
  prepGhost(W, w, warm = true) {
    const Fw = W.fighters[w], pool = this.ghostPool || (this.ghostPool = {});
    if (!Fw) return null;
    let G = pool[w];
    if (!G || G.char !== Fw.char) {
      if (G) G.V.dispose();
      const V = new FighterView(this.mv.root, Object.create(Fw), '');
      G = pool[w] = { V, char: Fw.char, cold: true };
      this.ghostify(V, 0.6, new THREE.Color(COLORS[w] || '#ffffff'));
      V.root.visible = false; V.marker.visible = false; V.cdRing.visible = false; V.shadow.visible = false;
    }
    if (warm && G.cold) { G.cold = false; this.warm3D(G.V.root); }
    return G;
  }

  dropPool() {
    for (const G of Object.values(this.ghostPool || {})) G.V.dispose();
    this.ghostPool = null;
  }

  // la première image du jeu, dessinée sur un canevas de côté sans bruit ni effet qui reste : tout ce qu'elle demande
  // (marionnettes sous leurs clés, clips, textes) est prêt quand la télé s'allume
  dryRun(W, M) {
    const save = { g: this.g, floats: this.floats.length, parts: this.parts.length, stickers: this.stickers.length, banner: this.banner, ox: this.ox, oy: this.oy };
    const c = this.dryC || (this.dryC = document.createElement('canvas')); c.width = 640; c.height = 360;
    const P = Object.create(M); P.ph = 'play'; P.t = 1;
    this.dry = true; this.g = c.getContext('2d'); this.ox = 0; this.oy = 0;
    try { this.drawGame(W, P, 1 / 60, 1); } catch (e) { /* un jeu qui ne supporte pas ce faux départ : tant pis */ }
    this.dry = false; this.g = save.g; this.ox = save.ox; this.oy = save.oy;
    this.floats.length = save.floats; this.parts.length = save.parts; this.stickers.length = save.stickers; this.banner = save.banner;
  }

  makeGhost(W, w) {
    this.dropGhost();
    const Fw = W.fighters[w];
    if (!Fw) return;
    const V = this.prepGhost(W, w).V; // (prêt d'avance pendant la présentation, sauf imprévu)
    const def = CHARS[Fw.char], pick = (list) => list.find((k) => def.moves[k] && (def.moves[k].hits || []).length) || 'jab1';
    const plan = [...HURT_AT, MG_RESUME].map((h, n) => {
      const name = pick([['jab1'], ['ftilt', 'jab1'], ['uair', 'utilt', 'jab1'], ['fair', 'nair', 'ftilt'], ['smash', 'fsmash', 'usmash'], ['usmash', 'smash', 'uair']][n]);
      const Mv = def.moves[name] || {}, hf = Mv.hits && Mv.hits[0] ? Mv.hits[0].f[0] : 6;
      return { name, start: h - hf, dur: Mv.dur || 30, side: n % 2 ? 1 : -1, air: /air$/.test(name) };
    });
    this.ghost = { V, w, plan, k: -1, fade: 0, op: 0, col: new THREE.Color(COLORS[w] || '#ffffff') };
    // ses matières (translucides) prêtes et compilées tout de suite : pas d'à-coup quand il apparaît
    this.hideGhost();
  }

  hideGhost() { const G = this.ghost; if (!G) return; G.V.root.visible = false; G.V.marker.visible = false; G.V.cdRing.visible = false; G.V.shadow.visible = false; }

  dropGhost() { if (this.ghost) { this.hideGhost(); this.ghost = null; } } // (il retourne caché dans la réserve, ghostPool)

  updateGhost(W, dt) {
    const G = this.ghost, R = W.mgResume;
    if (G.fade > 0) { G.fade -= dt; G.op = Math.max(0, G.fade / 0.35) * 0.6; if (G.fade <= 0) { this.dropGhost(); return; } }
    else if (!R || R.w !== G.w || R.l < 0) { if (!W.mg) this.dropGhost(); else this.hideGhost(); return; }
    const L = W.fighters[R ? R.l : -1] || G.L, e = R ? MG_RESUME - R.t : G.e + 1, Fw = W.fighters[G.w];
    G.L = L; G.e = e;
    if (!L || !Fw) return;
    // le coup en cours (ou le dernier commencé), le moment où le fantôme apparaît
    let k = -1;
    for (let n = 0; n < G.plan.length; n++) if (e >= G.plan[n].start - 6) k = n;
    if (k < 0) { this.hideGhost(); return; }
    const pl = G.plan[k], mf = e - pl.start, inMove = mf >= 0 && mf < pl.dur, size = L.size || 1;
    const x = L.x + pl.side * 1.0 * size, y = L.y + (pl.air ? 0.7 : 0), z = L.z;
    const tele = k !== G.k;
    if (tele) {
      // il se téléporte : une gerbe d'étincelles à sa couleur là où il apparaît
      G.k = k;
      const P3 = this.mv.particles, hex = '#' + G.col.getHexString();
      P3.sparks(x, y + 1, z, 22, hex, 8); P3.sparks(x, y + 1, z, 10, '#ffffff', 5); P3.dust(x, y + 0.2, z, 6, hex, 1.2);
      if (this.audio) { this.audio.sfx('whoosh', 0, 0.7); this.audio.sfx('zapS', 0, 0.35); }
    }
    if (G.fade <= 0) G.op = Math.min(0.62, G.op + dt * 5);
    const p = Object.create(Fw);
    p.x = x; p.y = y; p.z = z; p.facing = pl.side < 0 ? RIGHT + 0.34 : LEFT - 0.34;
    p.state = inMove ? 'move' : pl.air ? 'air' : 'idle'; p.st = Math.max(0, inMove ? mf : mf - pl.dur); p.move = inMove ? pl.name : null;
    p.mf = inMove ? mf : 0; p.af = inMove ? mf : -1; p.mseq = 9000 + k; p.mv = {}; p.va = ZERO6;
    p.hitlag = 0; p.grounded = !pl.air; p.vx = 0; p.vy = 0; p.vz = 0; p.kx = p.ky = p.kz = 0; p.invuln = 0; p.intangible = 0;
    p.launchKb = 0; p.shieldStun = 0; p.out = false; p.grabbedBy = -1; p.speedMul = 1;
    const V = G.V;
    V.root.visible = true;
    if (tele) V.snapTo(p); else V.capture(p); // (sa position : d'un coup quand il se téléporte)
    V.update(p, W, dt, this.time, 1);
    V.marker.visible = false; V.cdRing.visible = false; V.shadow.visible = false;
    // l'aspect : translucide, lumineux, à la couleur du gagnant, qui vacille un peu (matières copiées une fois)
    this.ghostify(V, G.op * (0.85 + Math.random() * 0.15));
  }

  ghostify(V, op = 0.6, col = this.ghost.col) {
    // (une matière, ou plusieurs : un tableau, sur certains accessoires ; les sprites et les points aussi)
    const ghost = (m) => { m = m.clone(); m.transparent = true; m.depthWrite = false; return m; };
    V.root.traverse((o) => {
      if (!o.material) return;
      if (!o.userData.ghost) { o.material = Array.isArray(o.material) ? o.material.map(ghost) : ghost(o.material); o.castShadow = false; o.receiveShadow = false; o.userData.ghost = 1; } // (un fantôme n'a pas d'ombre)
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        m.opacity = op;
        if (m.emissive) { m.emissive.copy(col); m.emissiveIntensity = 0.9; }
      }
    });
  }

  // prépare un objet 3D (et tout ce qu'il contient, même caché) pour qu'il ne fasse pas d'à-coup à sa première
  // apparition. L'objet doit être dans la scène.
  warm3D(objs) {
    const R = this.R, gl = R.gl, hid = [], culled = [], tex = new Set();
    for (const obj of [].concat(objs)) obj.traverse((o) => {
      if (!o.visible) { hid.push(o); o.visible = true; }
      if (o.frustumCulled) { culled.push(o); o.frustumCulled = false; }
      for (const m of o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []) for (const k of ['map', 'alphaMap', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap']) if (m[k]) tex.add(m[k]);
    });
    // un vrai rendu, dans une toute petite image du même genre que R.rt (la cible où la scène est vraiment rendue : pour
    // l'écran directement, ce seraient d'autres variantes des shaders, recompilées quand même au premier dessin) : les
    // shaders, ceux des ombres aussi, les formes et les textures envoyées à la carte graphique, rien d'écarté hors champ.
    // (compile() seul ne suffisait pas : il saute ce qui est caché et ne fait ni les ombres ni l'envoi des formes ; la
    // pluie de pièces figeait 1 s puis 100 ms à son ouverture.)
    const rt = R.rt;
    if (!this.miniRT && rt) { this.miniRT = new THREE.WebGLRenderTarget(16, 16, { type: rt.texture.type }); this.miniRT.texture.colorSpace = rt.texture.colorSpace; }
    const prev = gl.getRenderTarget(), su = gl.shadowMap.needsUpdate;
    try {
      gl.setRenderTarget(rt ? this.miniRT : null);
      gl.shadowMap.needsUpdate = true;
      gl.render(R.scene, R.camera);
    } catch (e) { /* tant pis : à son premier dessin */ }
    gl.setRenderTarget(prev); gl.shadowMap.needsUpdate = su;
    for (const t of tex) { try { gl.initTexture(t); } catch (e) { /* idem */ } }
    for (const o of hid) o.visible = false;
    for (const o of culled) o.frustumCulled = true;
  }

  // tout ce qui ferait un à-coup à l'arrivée de la télé est préparé d'avance, une chose par image, pendant le « 3, 2, 1 »
  // du début du match (personne ne joue encore) : l'image et le filtre de la télé à leur taille, les marionnettes des
  // persos du match et de tous les mini-jeux, la scène du duel ; ce qui manquerait encore (une marionnette d'un perso
  // arrivé plus tard) l'est pendant les 5 s du compte à rebours
  prewarm(W) {
    const done = this.pwDone || (this.pwDone = new Set());
    if (!this.pwQ) this.pwQ = [];
    const add = (key, fn) => { if (!done.has(key)) { done.add(key); this.pwQ.push(fn); } };
    const f = mgLeft(W), soon = f > 0 && f <= 300;
    if (W.phase === 'intro' || soon) {
      add('tv', () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2), k = Math.min(window.innerWidth / 640, window.innerHeight / 360);
        const cw = Math.max(320, Math.min([560, 720, 960][this.q], Math.round(TV.w * k * dpr)));
        this.crtOver(cw, Math.round(cw * 9 / 16));
      });
      const chars = new Set(W.list.map((F) => F.char));
      const kinds = W.phase === 'intro' ? Object.keys(EXTRA_VIEWS) : [String(W.mgNextKind || '').split(':')[0]];
      for (const k of kinds) for (const c of EXTRA_VIEWS[k] ? [...(EXTRA_VIEWS[k].puppets || []), ...(EXTRA_VIEWS[k].cast || [])] : []) chars.add(c); // (cast : les persos qu'un jeu montre en plus, préparés ici seulement)
      for (const c of chars) add('p:' + c, () => drawPuppet(this.g, c, -9999, -9999, 10, { shadow: false }));
      // l'humiliation : les trois commentateurs (et leur rire), les persos du match sous leurs clés et leurs clips du toktok
      for (const c of this.mockPool(W).slice(0, 3)) add('m:' + c, () => drawPuppet(this.g, c, -9999, -9999, 10, clipFor(c, { emote: 'laugh_01', head: 2.2, shadow: false })));
      for (const F of W.list) for (const e of ['sob', 'victory_celebration', 'laugh_01', 'win', null]) add('t:' + F.slot + e, () => drawPuppet(this.g, F.char, -9999, -9999, 10, clipFor(F.char, e ? { key: 'w' + F.slot, emote: e, shadow: false } : { key: 'w' + F.slot, state: 'dizzy', shadow: false })));
      // les polices du jeu, à plusieurs tailles (la première fois qu'une police sert, ses lettres se préparent : 25 ms)
      add('fonts', () => {
        const g = this.g; g.save();
        for (const f of ["Creepster, 'Lilita One', fantasy", "'Arial Black', Impact, sans-serif", "'Lilita One', 'Trebuchet MS', sans-serif", "'Barlow Condensed', 'Arial Narrow', sans-serif", "Bangers, sans-serif"])
          for (const z of [8, 13, 20, 32, 52]) { g.font = `700 ${z}px ${f}`; g.fillText('AZaz09%!?éÈÀÇ+-×✗✨♡★', -9999, -9999); g.strokeText('AZaz09', -9999, -9999); }
        g.restore();
      });
      // le jeu qui vient, s'il se prépare sans connaître ses joueurs (warm(view) : la scène 3D de la pluie de pièces)
      const nk = String(W.mgNextKind || '').split(':')[0], NX = EXTRA_VIEWS[nk];
      if (soon && NX && NX.warm && NX.warm.length <= 1) add('x:' + nk, () => NX.warm(this));
      add('freeze', () => this.R.warmFreeze()); // (les shaders du combat figé)
      // les fantômes de la facture, un par joueur (gardés d'un jeu à l'autre) : son modèle, puis ses shaders à l'image
      // suivante (40 à 140 ms chacun s'ils se faisaient pendant la présentation d'un jeu)
      for (const F of W.list) { add('g:' + F.slot + F.char, () => this.prepGhost(W, F.slot, false)); add('gw:' + F.slot + F.char, () => this.prepGhost(W, F.slot)); }
      add('fps', () => {
        if (!this.fps3) this.build3D();
        this.mv.root.add(this.fps3.group); this.warm3D(this.fps3.group); this.mv.root.remove(this.fps3.group);
      });
    }
    if (this.pwQ.length) this.pwQ.shift()();
  }

  applyQuality() {
    const q = this.q;
    this.partCap = [200, 400, 700][q];
    setPuppetQuality([0.5, 0.65, 0.8][q], [4, 3, 2][q]); // (résolution, et une image sur combien)
    this.app.mgQ = q;
  }

  // les images traînent (plus de 1,2 s au-dessous de ~42 images par seconde, pendant un jeu) : un cran de qualité en moins
  adaptQuality(dt) {
    if (this.q <= 0 || !(dt > 0) || dt > 0.25) return;
    this.slowT = Math.max(0, this.slowT + (dt > 0.024 ? dt : -dt * 0.5));
    if (this.slowT > 1.2) { this.q--; this.slowT = 0; this.applyQuality(); }
  }

  // la télé est suspendue au plafond par deux câbles : elle tombe, les câbles la rattrapent (un petit rebond), elle se
  // balance comme un pendule puis se calme, en gardant un léger mouvement (assez peu pour rester lisible) ;
  // off : la hauteur où elle se trouve (0 : à sa place, 1 : hors de l'écran, en haut)
  tvPose(ctx, off) {
    const td = this.time - (this.dropT ?? this.time) - 0.3, sw = td > 0 ? 0.055 * Math.exp(-td * 1.3) * Math.sin(td * 4.4) : 0;
    const px = TV.x + TV.w / 2 + 23, py = -(this.oy || 0) - 90; // le point d'accroche, au plafond
    ctx.translate(0, -off * 420);
    if (!this.flat) { ctx.translate(px, py); ctx.rotate(-0.018 + sw + Math.sin(this.time * 0.8) * 0.005); ctx.translate(-px, -py); }
  }

  // la télé : boîtier en bois avec son épaisseur (le dessus et le flanc, plus sombres), l'écran, deux boutons, la grille
  // du haut-parleur, les deux câbles qui montent au plafond
  drawTVBody(off) {
    const ctx = this.g, S = TV;
    // l'ombre au sol, qui suit le balancement
    const sw = Math.sin(this.time * 0.8);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(330 + sw * 6, S.y + S.h + 58 - off * 420, 230, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); this.tvPose(ctx, off);
    const bx = S.x - 16, by = S.y - 14, bw = S.w + 16 + 74, bh = S.h + 34, top = -(this.oy || 0) - 100;
    // les câbles et leurs attaches
    const cable = () => { ctx.beginPath(); ctx.moveTo(bx + 46, by - 4); ctx.lineTo(bx + 46, top); ctx.moveTo(bx + bw - 46, by - 4); ctx.lineTo(bx + bw - 46, top); ctx.stroke(); };
    ctx.strokeStyle = '#0b0a0e'; ctx.lineWidth = 3.5; cable(); ctx.strokeStyle = '#8a8a96'; ctx.lineWidth = 1.5; cable();
    ctx.fillStyle = '#3a3a42'; for (const x of [bx + 46, bx + bw - 46]) { ctx.beginPath(); ctx.roundRect(x - 5, by - 9, 10, 8, 2); ctx.fill(); }
    // l'épaisseur du boîtier : le dessus et le flanc droit (une boîte vue un peu d'en haut et de côté)
    const DX = 12, DY = -9;
    ctx.fillStyle = '#2a1a0e'; ctx.beginPath(); ctx.roundRect(bx + DX, by + DY, bw, bh, 14); ctx.roundRect(S.x, S.y, S.w, S.h, 16); ctx.fill('evenodd'); // (percé lui aussi : un jeu en 3D se voit à travers l'écran)
    ctx.fillStyle = '#4a3018'; ctx.beginPath(); ctx.moveTo(bx + 12, by); ctx.lineTo(bx + 12 + DX, by + DY); ctx.lineTo(bx + bw - 12 + DX, by + DY); ctx.lineTo(bx + bw - 12, by); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#20140a'; ctx.beginPath(); ctx.moveTo(bx + bw, by + 12); ctx.lineTo(bx + bw + DX, by + 12 + DY); ctx.lineTo(bx + bw + DX, by + bh - 12 + DY); ctx.lineTo(bx + bw, by + bh - 12); ctx.closePath(); ctx.fill();
    // le boîtier (bois verni), percé à l'endroit de l'écran
    const wood = ctx.createLinearGradient(0, by, 0, by + bh); wood.addColorStop(0, '#6a4428'); wood.addColorStop(1, '#3e2614');
    ctx.fillStyle = wood; ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 14); ctx.roundRect(S.x, S.y, S.w, S.h, 16); ctx.fill('evenodd');
    ctx.strokeStyle = '#1a0e06'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 14); ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.rect(bx, by, bw, bh); ctx.roundRect(S.x - 8, S.y - 8, S.w + 16, S.h + 16, 18); ctx.clip('evenodd');
    ctx.strokeStyle = 'rgba(255,220,170,0.12)'; ctx.lineWidth = 1;
    for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(bx + 8, by + 10 + k * bh / 6); ctx.bezierCurveTo(bx + bw * 0.3, by + 14 + k * bh / 6, bx + bw * 0.6, by + 4 + k * bh / 6, bx + bw - 8, by + 12 + k * bh / 6); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = '#1a1210'; ctx.beginPath(); ctx.roundRect(S.x - 8, S.y - 8, S.w + 16, S.h + 16, 18); ctx.roundRect(S.x, S.y, S.w, S.h, 16); ctx.fill('evenodd');
    const px = S.x + S.w + 14;
    ctx.fillStyle = '#2a1c14'; ctx.beginPath(); ctx.roundRect(px, S.y, 46, S.h, 6); ctx.fill();
    for (const [ky, sz] of [[S.y + 34, 13], [S.y + 78, 10]]) {
      ctx.fillStyle = '#c8b898'; ctx.beginPath(); ctx.arc(px + 23, ky, sz, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#5a4a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px + 23, ky); ctx.lineTo(px + 23 + sz * 0.8, ky - sz * 0.5); ctx.stroke();
    }
    ctx.fillStyle = '#120c08'; for (let k = 0; k < 7; k++) ctx.fillRect(px + 8, S.y + 110 + k * 9, 30, 4);
    ctx.fillStyle = this.time % 1 < 0.9 ? '#ff3a2a' : '#5a1a10'; ctx.beginPath(); ctx.arc(px + 23, S.y + S.h - 16, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.font = "700 7px 'Barlow Condensed', sans-serif"; ctx.textAlign = 'center'; ctx.fillStyle = '#c8b898'; ctx.fillText('SPOOKY-VISION', px + 23, S.y + S.h - 30);
    ctx.restore();
  }

  // l'écran : l'image de la télé (src, déjà composée à sa taille) passée par le filtre cathodique (src/render/crt.js ; pas
  // sur les petites machines), posée dans la télé avec un léger reflet
  // --- la télé cathodique : le mini-jeu y passe, par-dessus le combat figé ---------------------------------------
  // (le jeu est dessiné directement dans l'écran penché ; autour, le vrai combat figé ; pour un jeu en 3D, le moteur ne
  // rend la 3D que dans le cadre de l'écran : renderer.tv)
  // le verre de la télé, dessiné une fois à la taille de l'image (refait seulement si elle change) : lignes de balayage
  // douces, grille de phosphore à peine visible, coins assombris, reflet. Avant : un shader dans un moteur WebGL à part,
  // mais recopier l'image vers lui puis la reprendre coûtait 3 à 40 ms par image (les ralentissements des mini-jeux).
  crtOver(w, h) {
    if (this.crtC && this.crtC.width === w && this.crtC.height === h) return this.crtC;
    const c = this.crtC || (this.crtC = document.createElement('canvas'));
    c.width = w; c.height = h;
    const g = c.getContext('2d'), k = h / 270;
    g.clearRect(0, 0, w, h);
    // lignes : une ombre douce toutes les ~2 lignes de la grille
    const step = Math.max(2, Math.round(2 * k));
    for (let y = 0; y < h; y += step) { g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(0, y + step / 2, w, step / 2); }
    // phosphore : des colonnes rouge, vert, bleu à peine teintées
    if (w >= 600) for (let x = 0; x < w; x += 3) { g.fillStyle = 'rgba(255,40,40,0.018)'; g.fillRect(x, 0, 1, h); g.fillStyle = 'rgba(40,40,255,0.018)'; g.fillRect(x + 2, 0, 1, h); }
    // coins sombres (le tube bombé)
    const v = g.createRadialGradient(w / 2, h / 2, h * 0.42, w / 2, h / 2, w * 0.62);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.42)');
    g.fillStyle = v; g.fillRect(0, 0, w, h);
    // le reflet sur le verre, très léger
    const r = g.createLinearGradient(0, 0, w * 0.45, h * 0.55);
    r.addColorStop(0, 'rgba(255,255,255,0.07)'); r.addColorStop(0.5, 'rgba(255,255,255,0.02)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, h);
    return c;
  }

  // content() dessine l'image de l'écran dans les coordonnées de la grille (640 x 360), déjà posées sur l'écran penché ;
  // sans content, l'écran est éteint ; cw x ch : la taille de l'écran en pixels (celle du verre)
  drawTVScreen(off, cw, ch, content) {
    const S = TV, ctx = this.g, sox = this.ox, soy = this.oy;
    ctx.save(); this.tvPose(ctx, off);
    ctx.beginPath(); ctx.roundRect(S.x, S.y, S.w, S.h, 16); ctx.clip();
    ctx.translate(S.x, S.y); ctx.scale(S.w / 640, S.h / 360);
    this.ox = 0; this.oy = 0; // (l'écran de la télé est exactement la grille : pas de marges)
    ctx.save();
    if (content) content(); else { ctx.fillStyle = '#0c0a12'; ctx.fillRect(0, 0, 640, 360); }
    ctx.restore();
    this.ox = sox; this.oy = soy;
    // le verre (lignes, phosphore, coins sombres, reflet) : une seule image posée par-dessus, au scintillement près
    ctx.imageSmoothingEnabled = true; ctx.globalAlpha = 0.94 + 0.06 * Math.sin(this.time * 63);
    ctx.drawImage(this.crtOver(cw, ch), 0, 0, 640, 360);
    ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = false;
    ctx.restore();
  }

  // --- duel au pistolet : le HUD (une moitié d'écran chacun), façon Counter-Strike -----------------------------------
  // police étroite et sobre, réticule vert, vie en bas à gauche, munitions en bas à droite, radar carré en haut à gauche,
  // fil des éliminations sur fond sombre en haut à droite, score et chrono en haut au milieu
  cs(str, x, y, size, color, o = {}) {
    const ctx = this.g;
    ctx.save();
    ctx.globalAlpha = o.alpha ?? 1;
    ctx.font = `${o.w || 700} ${Math.round(size)}px 'Barlow Condensed', 'Arial Narrow', sans-serif`;
    ctx.textAlign = o.align || 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillText(str, x + 1, y + 1);
    ctx.fillStyle = color; ctx.fillText(str, x, y);
    ctx.restore();
  }

  drawFps(W, M, dt) {
    const ctx = this.g, g = M.g, VR = duelVar(g), FV = fpsVar(M);
    const L = -this.ox, Rr = 640 + this.ox, T = -this.oy, B = 360 + this.oy, mid = 320;
    const PANEL = 'rgba(8,10,14,0.62)';
    for (let i = 0; i < 2; i++) {
      const P = g.p[i], O = g.p[1 - i], x0 = i === 0 ? L : mid, x1 = i === 0 ? mid : Rr, cx = (x0 + x1) / 2;
      ctx.save();
      ctx.beginPath(); ctx.rect(x0, T, x1 - x0, B - T); ctx.clip();
      // l'ambiance de la variante (un voile de couleur), et le noir total : on ne voit qu'aux flashs (tirs, explosions)
      // et au stroboscope, qui claque un temps sur deux
      if (FV.tint) { ctx.fillStyle = FV.tint; ctx.fillRect(x0, T, x1 - x0, B - T); }
      if (VR.dark) {
        const shot = Math.max(0, 1 - (this.time - Math.max(this.radar[0], this.radar[1])) / 0.16), strobe = (this.time % 0.62) < 0.06 ? 0.8 : 0;
        const lit = Math.max(shot, strobe, this.boomT[0] + this.boomT[1] > 0 ? 0.6 : 0);
        ctx.fillStyle = `rgba(0,0,0,${0.87 * (1 - lit)})`; ctx.fillRect(x0, T, x1 - x0, B - T); // (les guirlandes percent un peu le noir)
      }
      // la glissade : des lignes de vitesse discrètes sur les bords
      if (this.slideT[i] > 0) {
        const a = this.slideT[i] / 0.28;
        ctx.strokeStyle = `rgba(255,255,255,${0.35 * a})`; ctx.lineWidth = 1;
        ctx.beginPath();
        for (let n = 0; n < 14; n++) { const an = n / 14 * Math.PI * 2 + this.time * 3, r0 = 90 + Math.random() * 30; ctx.moveTo(cx + Math.cos(an) * r0, 180 + Math.sin(an) * r0 * 0.7); ctx.lineTo(cx + Math.cos(an) * (r0 + 50 + a * 40), 180 + Math.sin(an) * (r0 + 50 + a * 40) * 0.7); }
        ctx.stroke();
      }
      // touché : les bords rougissent un instant (et un peu plus quand on a peu de vie)
      const hurt = Math.max(this.hurt[i] * 0.55, (1 - P.hp / DUEL.HP) * 0.3);
      if (hurt > 0.01) {
        const gr = ctx.createRadialGradient(cx, 180, 70, cx, 180, 250);
        gr.addColorStop(0, 'rgba(160,0,0,0)'); gr.addColorStop(1, `rgba(150,0,0,${hurt})`);
        ctx.fillStyle = gr; ctx.fillRect(x0, T, x1 - x0, B - T);
      }
      const scoped = duelScoped(VR, P) && P.dead <= 0;
      if (scoped) {
        // la lunette : tout noir autour d'un cercle, une croix fine qui le traverse
        const r = Math.min((x1 - x0) * 0.46, (B - T) * 0.44);
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.rect(x0, T, x1 - x0, B - T); ctx.arc(cx, 180, r, 0, Math.PI * 2, true); ctx.fill();
        ctx.strokeStyle = '#000'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(cx - r, 180); ctx.lineTo(cx + r, 180); ctx.moveTo(cx, 180 - r); ctx.lineTo(cx, 180 + r); ctx.stroke();
        const gr = ctx.createRadialGradient(cx, 180, r * 0.8, cx, 180, r); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.7)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, 180, r, 0, Math.PI * 2); ctx.fill();
      }
      if (P.dead > 0) {
        // l'écran de mort : grisé, qui m'a tué et avec quoi, le retour
        ctx.fillStyle = 'rgba(20,0,0,0.45)'; ctx.fillRect(x0, T, x1 - x0, B - T);
        const hb = this.hb[i] && this.hb[i].dead ? this.hb[i] : null;
        ctx.fillStyle = PANEL; ctx.fillRect(cx - 96, B - 92, 192, 40);
        ctx.fillStyle = COLORS[O.slot]; ctx.fillRect(cx - 96, B - 92, 3, 40);
        this.cs('ÉLIMINÉ PAR', cx - 86, B - 82, 9, '#b8b8b8', { align: 'left', w: 600 });
        this.cs(this.label(W, O.slot).toUpperCase(), cx - 86, B - 66, 14, COLORS[O.slot], { align: 'left' });
        if (hb) this.cs(`${hb.gun}${hb.head ? '  ·  HEADSHOT' : ''}`, cx + 90, B - 66, 9, hb.head ? '#ff6060' : '#d8d8d8', { align: 'right', w: 600 });
        ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(cx - 96, B - 50, 192, 3);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - 96, B - 50, 192 * (1 - P.dead / DUEL.DEAD), 3);
      } else {
        // le réticule vert de Counter-Strike (sauf à la lunette) : quatre traits fins, l'écart s'ouvre au tir et en mouvement
        if (!scoped) {
          const gap = (VR.pellets ? 9 : 3) + this.recoil[i] * 5 + Math.min(3, Math.hypot(P.vx, P.vz) * 0.4) + (P.y > 0 ? 3 : 0);
          const bars = [[cx - gap - 6, 179.5, 6, 1.5], [cx + gap, 179.5, 6, 1.5], [cx - 0.75, 180 - gap - 6, 1.5, 6], [cx - 0.75, 180 + gap, 1.5, 6]];
          ctx.fillStyle = 'rgba(0,0,0,0.7)'; for (const [x, y, w, h] of bars) ctx.fillRect(x - 0.6, y - 0.6, w + 1.2, h + 1.2);
          ctx.fillStyle = '#4cff4c'; for (const [x, y, w, h] of bars) ctx.fillRect(x, y, w, h);
        }
        // la charge du railgun : un fin cercle qui se remplit
        if (VR.charge && P.ch > 0) {
          const q = P.ch / VR.charge;
          ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, 180, 16, 0, Math.PI * 2); ctx.stroke();
          ctx.strokeStyle = q >= 1 ? '#ffffff' : '#5ae8ff'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(cx, 180, 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * q); ctx.stroke();
        }
        // la marque de touche : une petite croix blanche (rouge sur un kill)
        const hm = this.hit[i];
        if (hm.t > 0) {
          hm.t -= dt;
          ctx.strokeStyle = hm.kill ? '#ff3030' : '#ffffff'; ctx.lineWidth = 1.5;
          ctx.beginPath();
          for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { ctx.moveTo(cx + sx * 5, 180 + sy * 5); ctx.lineTo(cx + sx * 10, 180 + sy * 10); }
          ctx.stroke();
        }
        // le mot sous le viseur (HEADSHOT, ÉLIMINATION, la série)
        const hb = this.hb[i];
        if (hb && !hb.dead) {
          hb.t += dt;
          if (hb.t > 1.4) this.hb[i] = null;
          else { const a = Math.min(1, (1.4 - hb.t) * 3); this.cs(hb.text, cx, 214, 12, hb.color, { alpha: a, w: 800 }); if (hb.sub) this.cs(hb.sub, cx, 228, 10, '#ffd23a', { alpha: a }); }
        }
        // la vie (en bas à gauche) et les munitions (en bas à droite)
        const hp = Math.max(0, P.hp), low = hp <= 40;
        ctx.fillStyle = PANEL; ctx.fillRect(x0 + 8, B - 34, 86, 26);
        this.cs('✚', x0 + 20, B - 21, 14, low ? '#ff5050' : '#e8e2d0');
        this.cs(String(hp), x0 + 34, B - 20, 22, low ? '#ff5050' : '#f2ede0', { align: 'left', w: 800 });
        ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(x0 + 64, B - 22, 26, 3); ctx.fillStyle = low ? '#ff5050' : '#f2ede0'; ctx.fillRect(x0 + 64, B - 22, 26 * hp / DUEL.HP, 3);
        ctx.fillStyle = PANEL; ctx.fillRect(x1 - 104, B - 34, 96, 26);
        this.cs(String(P.ammo), x1 - 66, B - 20, 22, P.ammo <= Math.max(1, VR.mag * 0.2) ? '#ff5050' : '#f2ede0', { align: 'right', w: 800 });
        this.cs('/ ∞', x1 - 62, B - 18, 11, '#9a9a9a', { align: 'left' });
        this.cs(FV.gun, x1 - 12, B - 40, 9, '#d8d8d8', { align: 'right', w: 600 });
        if (P.reload) {
          const q = 1 - P.reload / VR.reload;
          this.cs('RECHARGEMENT', cx, 244, 9, '#e8e8e8', { w: 600 });
          ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(cx - 34, 251, 68, 3); ctx.fillStyle = '#e8e8e8'; ctx.fillRect(cx - 34, 251, 68 * q, 3);
        }
        // le radar (en haut à gauche) : carré sombre ; l'ennemi y paraît quand il tire
        const rx = x0 + 10, ry = T + 50, rs = 50;
        ctx.fillStyle = 'rgba(8,14,10,0.7)'; ctx.fillRect(rx, ry, rs, rs);
        ctx.strokeStyle = 'rgba(160,200,160,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(rx + 0.5, ry + 0.5, rs - 1, rs - 1);
        ctx.beginPath(); ctx.moveTo(rx + rs / 2, ry + 3); ctx.lineTo(rx + rs / 2, ry + rs - 3); ctx.moveTo(rx + 3, ry + rs / 2); ctx.lineTo(rx + rs - 3, ry + rs / 2); ctx.strokeStyle = 'rgba(160,200,160,0.15)'; ctx.stroke();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(rx + rs / 2, ry + rs * 0.72); ctx.lineTo(rx + rs / 2 - 3, ry + rs * 0.72 + 6); ctx.lineTo(rx + rs / 2 + 3, ry + rs * 0.72 + 6); ctx.closePath(); ctx.fill();
        if (this.time - this.radar[1 - i] < 1.5 || O.dead > 0) {
          const span = Math.max(4, Math.abs(O.x - P.x)), px = rx + rs / 2 + (O.z - P.z) * P.sd * (rs * 0.12), py = ry + rs * 0.72 - Math.abs(O.x - P.x) / span * rs * 0.55;
          ctx.fillStyle = O.dead > 0 ? 'rgba(255,60,60,0.4)' : '#ff3a3a';
          ctx.beginPath(); ctx.arc(Math.max(rx + 3, Math.min(rx + rs - 3, px)), Math.max(ry + 3, py), 2.5, 0, Math.PI * 2); ctx.fill();
        }
      }
      // le nom du joueur, sous son radar
      this.cs(this.label(W, P.slot).toUpperCase(), x0 + 10, T + 110, 9, COLORS[P.slot], { align: 'left' });
      ctx.restore();
    }
    // la séparation
    ctx.fillStyle = '#05060a'; ctx.fillRect(mid - 1.5, T, 3, B - T);
    // le score et le chrono (en haut au milieu)
    const [a, b] = g.p, left = this.secsLeft(M);
    ctx.fillStyle = PANEL; ctx.fillRect(272, T + 6, 96, 24);
    ctx.fillStyle = COLORS[a.slot]; ctx.fillRect(244, T + 6, 26, 24); ctx.fillStyle = COLORS[b.slot]; ctx.fillRect(370, T + 6, 26, 24);
    this.cs(String(a.kills), 257, T + 19, 17, '#ffffff', { w: 800 });
    this.cs(String(b.kills), 383, T + 19, 17, '#ffffff', { w: 800 });
    this.cs(`0:${String(left).padStart(2, '0')}`, 320, T + 19, 15, left <= 3 ? '#ff5050' : '#f2ede0', { w: 800 });
    this.cs(this.matchPt && this.time - this.matchPt.t < 2 ? 'BALLE DE MATCH' : `PREMIER À ${VR.kills}`, 320, T + 38, 8, this.matchPt && this.time - this.matchPt.t < 2 ? '#ffd23a' : '#b8b8b8', { w: 600 });
    // le fil des éliminations (en haut à droite) : le tueur, l'arme, la victime
    this.feed = this.feed.filter((e) => (e.t += dt) < 6);
    this.feed.forEach((e, n) => {
      const y = T + 50 + n * 15, xr = Rr - 8, w = 170, alpha = Math.min(1, (6 - e.t) * 2);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = PANEL; ctx.fillRect(xr - w, y - 6.5, w, 13);
      if (e.t < 0.3) { ctx.strokeStyle = '#ff3a3a'; ctx.lineWidth = 1; ctx.strokeRect(xr - w + 0.5, y - 6, w - 1, 12); }
      ctx.globalAlpha = 1;
      this.cs(this.pname(e.k), xr - w + 6, y + 0.5, 9, COLORS[e.k], { align: 'left', alpha });
      this.cs(`${e.gun || ''}${e.head ? '  ◉' : ''}`, xr - w / 2, y + 0.5, 8, e.head ? '#ff6060' : '#e8e8e8', { alpha, w: 600 });
      this.cs(this.pname(e.v), xr - 6, y + 0.5, 9, COLORS[e.v], { align: 'right', alpha });
    });
  }

  drawCandy(W, M, dt, alpha) {
    const ctx = this.g, G = M.g;
    const intro = M.ph === 'intro';
    ctx.fillStyle = 'rgba(6,2,12,0.6)';
    ctx.fillRect(-1000, -1000, 2640, 2360);
    if (!intro) this.timer(M, 320, 26);
    // les deux gourmands, de chaque côté, tournés vers leur plateau : moqueurs en tête, furieux derrière, ils sautent de
    // joie sur un combo
    if (this.pupOn(M)) for (let i = 0; i < 2; i++) {
      const lead = G.b[i].score - G.b[1 - i].score, x = i ? 582 : 58;
      ctx.fillStyle = COLORS[i ? M.v : M.a]; ctx.globalAlpha = 0.3; ctx.beginPath(); ctx.ellipse(x, 318, 40 + this.beatPop * 6, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      this.player(W, M, i, x, 326, 165, { face: i ? 'threeL' : 'three', emote: lead > 450 ? 'laugh_02' : lead < -450 ? 'angry_02' : null, head: 1.7 + Math.min(0.5, Math.max(0, lead) / 2000), squash: [1 + this.beatPop * 0.05, 1 - this.beatPop * 0.05], shadow: false });
    }
    [M.a, M.v].forEach((slot, side) => {
      const b = G.b[side], x0 = BOARD_X[side], y0 = BOARD_Y;
      this.boardShake[side] = Math.max(0, this.boardShake[side] - dt * 4);
      const sh = this.boardShake[side] * 4;
      const ox = x0 + (Math.random() - 0.5) * sh, oy = y0 + (Math.random() - 0.5) * sh;
      // en-tête : nom et score qui monte
      this.shown[side] += (b.score - this.shown[side]) * Math.min(1, dt * 10);
      this.panel(ox - 6, oy - 40, BW + 12, BH + 46, 'rgba(14,6,22,0.88)', COLORS[slot]);
      this.text((this.names[slot] || 'J' + (slot + 1)).slice(0, 10), ox, oy - 24, 14, COLORS[slot], { align: 'left' });
      this.text(String(Math.round(this.shown[side])), ox + BW, oy - 22, 22, '#ffffff', { align: 'right', title: true });
      // la grille
      ctx.save();
      ctx.beginPath(); ctx.rect(ox, oy, BW, BH); ctx.clip();
      for (let i = 0; i < CANDY.W * CANDY.H; i++) {
        const x = i % CANDY.W, y = (i / CANDY.W) | 0;
        ctx.fillStyle = (x + y) % 2 ? '#241632' : '#2c1c3c';
        ctx.fillRect(ox + x * CELL, oy + y * CELL, CELL, CELL);
      }
      for (let i = 0; i < CANDY.W * CANDY.H; i++) {
        const v = b.c[i];
        if (v < 0) continue;
        let x = i % CANDY.W, y = (i / CANDY.W) | 0, s = 1, flash = 0;
        if ((b.st === 'swap' || b.st === 'back') && (i === b.sw[0] || i === b.sw[1])) {
          const o = i === b.sw[0] ? b.sw[1] : b.sw[0], q = ease(Math.min(1, (b.t + alpha) / CANDY.SWAP));
          x = (o % CANDY.W) + (x - (o % CANDY.W)) * q; y = ((o / CANDY.W) | 0) + (y - ((o / CANDY.W) | 0)) * q;
        } else if (b.st === 'fall' && b.drop[i]) {
          y -= b.drop[i] * (1 - bounce(Math.min(1, (b.t + alpha) / CANDY.FALL)));
        } else if (b.st === 'clear' && b.clr.includes(i)) {
          const q = Math.min(1, (b.t + alpha) / CANDY.CLEAR);
          s = q < 0.3 ? 1 + q : 1.3 * (1 - (q - 0.3) / 0.7); flash = 1 - q;
        }
        if (b.sel === i) s *= 1.12 + Math.sin(this.time * 14) * 0.06;
        drawCandy(ctx, v % 10, (v / 10) | 0, ox + (x + 0.5) * CELL, oy + (y + 0.5) * CELL, CELL * 0.42 * s, this.time, flash);
      }
      ctx.restore();
      // le curseur (et le bonbon pris)
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 10);
      if (b.sel >= 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(ox + (b.sel % CANDY.W) * CELL, oy + ((b.sel / CANDY.W) | 0) * CELL, CELL, CELL);
      }
      ctx.strokeStyle = '#0b0610'; ctx.lineWidth = 5;
      ctx.strokeRect(ox + b.cx * CELL + 1, oy + b.cy * CELL + 1, CELL - 2, CELL - 2);
      ctx.strokeStyle = COLORS[slot]; ctx.lineWidth = 2 + pulse;
      ctx.strokeRect(ox + b.cx * CELL + 1, oy + b.cy * CELL + 1, CELL - 2, CELL - 2);
      if (b.chain > 0 && b.st !== 'idle') this.text(`x${b.chain + 1}`, ox + BW - 4, oy + BH + 14, 16, '#ffd23a', { align: 'right', title: true });
    });
    // l'écart au milieu : ce que le perdant prendrait
    const sa = G.b[0].score, sv = G.b[1].score;
    if (!intro && sa !== sv) {
      const lead = sa > sv ? M.a : M.v, d = Math.round(Math.max(12, Math.min(65, 12 + Math.abs(sa - sv) / 40)));
      this.text(sa > sv ? '◀' : '▶', 320, BOARD_Y + BH / 2 - 14, 18, COLORS[lead]);
      this.text(`${d} %`, 320, BOARD_Y + BH / 2 + 8, 15, '#ffffff');
    }
  }


  // --- tiercé de la pinte : une télé cathodique sur une table, une pinte de chaque côté ----------------------------
  drawHorses(W, M, dt) {
    const ctx = this.g, g = M.g, L = -this.ox, Rr = 640 + this.ox, T = -this.oy, B = 360 + this.oy;
    // la pièce : papier peint sombre, la table
    const wall = ctx.createLinearGradient(0, T, 0, 260);
    wall.addColorStop(0, '#1c1028'); wall.addColorStop(1, '#2c1a1a');
    ctx.fillStyle = wall; ctx.fillRect(L, T, Rr - L, 270 - T);
    ctx.fillStyle = 'rgba(255,220,160,0.04)';
    for (let x = Math.floor(L / 24) * 24; x < Rr; x += 24) ctx.fillRect(x, T, 10, 270 - T);
    // les deux parieurs derrière la table, tournés vers la télé : ils hurlent quand leur cheval mène, enragent derrière,
    // s'enfilent la pinte, ont le hoquet, puis pleurent ou exultent
    if (this.pupOn(M)) for (let i = 0; i < 2; i++) this.player(W, M, i, FAN_X[i], 352, 165, this.fanPose(M, g, i));
    ctx.fillStyle = '#5a3418'; ctx.fillRect(L, 262, Rr - L, B - 262);
    ctx.fillStyle = '#7a4a22'; ctx.fillRect(L, 262, Rr - L, 6);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let x = Math.floor(L / 40) * 40; x < Rr; x += 40) ctx.fillRect(x, 268, 2, B - 268);
    // la télé
    const tx = 168, ty = 40, tw = 304, th = 222;
    ctx.fillStyle = '#0b0610'; ctx.fillRect(tx - 3, ty - 3, tw + 6, th + 6);
    const caseG = ctx.createLinearGradient(tx, ty, tx, ty + th);
    caseG.addColorStop(0, '#6a5a4a'); caseG.addColorStop(1, '#3a2e24');
    ctx.fillStyle = caseG; ctx.fillRect(tx, ty, tw, th);
    // antenne
    ctx.strokeStyle = '#a0a0a8'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(320, ty); ctx.lineTo(282, ty - 34); ctx.moveTo(320, ty); ctx.lineTo(362, ty - 30); ctx.stroke();
    ctx.fillStyle = '#2a2a30'; ctx.fillRect(306, ty - 6, 28, 8);
    // boutons
    ctx.fillStyle = '#2a2018'; ctx.fillRect(tx + tw - 42, ty + 16, 32, th - 32);
    for (let k = 0; k < 2; k++) { ctx.fillStyle = '#1a1410'; ctx.beginPath(); ctx.arc(tx + tw - 26, ty + 42 + k * 34, 9, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#8a8070'; ctx.fillRect(tx + tw - 27, ty + 34 + k * 34, 2, 8); }
    ctx.fillStyle = Math.sin(this.time * 4) > 0 ? '#ff3030' : '#601010'; ctx.fillRect(tx + tw - 30, ty + th - 34, 6, 6);
    ctx.fillStyle = '#2a2018'; ctx.fillRect(tx + 30, ty + th, 26, 10); ctx.fillRect(tx + tw - 56, ty + th, 26, 10);
    // l'écran
    const sx = tx + 14, sy = ty + 14, sw = tw - 70, sh = th - 28;
    ctx.save();
    ctx.beginPath(); ctx.moveTo(sx + 14, sy); ctx.lineTo(sx + sw - 14, sy); ctx.quadraticCurveTo(sx + sw, sy, sx + sw, sy + 14); ctx.lineTo(sx + sw, sy + sh - 14);
    ctx.quadraticCurveTo(sx + sw, sy + sh, sx + sw - 14, sy + sh); ctx.lineTo(sx + 14, sy + sh); ctx.quadraticCurveTo(sx, sy + sh, sx, sy + sh - 14); ctx.lineTo(sx, sy + 14); ctx.quadraticCurveTo(sx, sy, sx + 14, sy); ctx.closePath();
    ctx.clip();
    if (g.ph === 'pick' || M.ph === 'intro') this.drawBets(W, M, g, sx, sy, sw, sh);
    else this.drawRace(W, M, g, sx, sy, sw, sh, dt);
    // le verre bombé : lignes de balayage, reflet, bords sombres, petit tremblement
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    for (let y = sy + ((this.time * 30) % 3); y < sy + sh; y += 3) ctx.fillRect(sx, y, sw, 1);
    const vg = ctx.createRadialGradient(sx + sw / 2, sy + sh / 2, sh * 0.3, sx + sw / 2, sy + sh / 2, sw * 0.7);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = vg; ctx.fillRect(sx, sy, sw, sh);
    ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.beginPath(); ctx.ellipse(sx + sw * 0.32, sy + sh * 0.22, sw * 0.3, sh * 0.12, -0.3, 0, Math.PI * 2); ctx.fill();
    if (Math.random() < 0.03) { ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(sx, sy + Math.random() * sh, sw, 4); }
    ctx.restore();
    ctx.strokeStyle = '#1a1410'; ctx.lineWidth = 4; ctx.strokeRect(sx - 2, sy - 2, sw + 4, sh + 4);
    // les pintes
    for (let i = 0; i < 2; i++) this.drawPint(W, M, g, i, PINT_X[i], 262);
    if (M.ph !== 'intro' && g.ph === 'race') this.timer(M, 564, 36);
  }

  // la pose d'un parieur (tiercé)
  fanPose(M, g, i) {
    const P = g.p[i], o = { face: i ? 'threeL' : 'three', head: 1.8, shadow: false };
    if (g.ph !== 'race' || M.ph === 'intro') return o;
    const me = g.H[P.pick], ot = g.H[g.p[1 - i].pick];
    if (me.fin || ot.fin) {
      const won = me.fin && (!ot.fin || me.fin < ot.fin);
      o.emote = won ? 'victory_celebration' : 'sob'; o.head = won ? 2.2 : 2; o.face = 'front';
      if (!won) { o.tint = '#2a50ff'; o.tintK = 0.25; }
      return o;
    }
    if (P.sip > 0) { const q = Math.sin((30 - P.sip) / 30 * Math.PI); o.rot = (i ? 0.16 : -0.16) * q; o.head = 1.8 + q * 0.5; o.face = 'front'; return o; }
    if (me.stum > 0) { o.emote = 'complain_01'; o.tint = '#ff2020'; o.tintK = 0.35; return o; }
    if (me.hic > 0) { const s = Math.sin(this.time * 30) * 0.07; o.squash = [1 - s, 1 + s]; o.state = 'hitstun'; o.kb = 30; return o; }
    if (g.t > HORSES.GATE) {
      const d = me.pos - ot.pos;
      if (d > 1.5) this.fanEm[i] = 'cheer'; else if (d < -1.5) this.fanEm[i] = 'angry_02';
      o.emote = this.fanEm[i];
    }
    if (me.whip > 0) { o.rot = (i ? -0.06 : 0.06) * me.whip / 8; o.squash = [1 + me.whip * 0.01, 1 - me.whip * 0.01]; }
    return o;
  }

  drawBets(W, M, g, sx, sy, sw, sh) {
    const ctx = this.g;
    ctx.fillStyle = '#10204a'; ctx.fillRect(sx, sy, sw, sh);
    this.text('FAITES VOS JEUX !', sx + sw / 2, sy + 18, 16, '#ffe24a', { mono: true });
    const left = Math.max(0, Math.ceil((HORSES.PICK - g.t) / 60));
    if (M.ph === 'play') this.text(`${left}`, sx + sw - 14, sy + 18, 14, '#ffffff', { mono: true });
    for (let k = 0; k < 4; k++) {
      const y = sy + 38 + k * 36, h = g.H[k];
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(sx + 8, y, sw - 16, 30);
      this.drawHorse(sx + 30, y + 24, k, this.time * 6 + k, 0.62);
      this.text(HORSES.NAMES[k], sx + 58, y + 10, 11, HORSES.COLORS[k], { align: 'left', mono: true });
      this.text(`Cote ${h.odds} contre 1`, sx + 58, y + 22, 8, '#c8d0ff', { align: 'left', mono: true, stroke: false });
      for (let i = 0; i < 2; i++) {
        const P = g.p[i], slot = i === 0 ? M.a : M.v;
        const on = P.pick === k || (P.pick < 0 && P.cur === k);
        if (!on) continue;
        ctx.strokeStyle = COLORS[slot]; ctx.lineWidth = P.pick === k ? 3 : 1 + (Math.sin(this.time * 12) > 0 ? 1 : 0);
        ctx.strokeRect(sx + 8 + i * 2, y + i * 2, sw - 16 - i * 4, 30 - i * 4);
        this.text(P.pick === k ? `${this.pname(slot)} ✓` : this.pname(slot), sx + sw - 14, y + 9 + i * 12, 9, COLORS[slot], { align: 'right', mono: true });
      }
    }
  }

  drawRace(W, M, g, sx, sy, sw, sh, dt) {
    const ctx = this.g;
    const ppm = 11; // pixels par mètre
    const mine = [g.H[g.p[0].pick], g.H[g.p[1].pick]];
    const focus = Math.max(mine[0].pos, mine[1].pos) * 0.6 + Math.min(mine[0].pos, mine[1].pos) * 0.4;
    const camX = Math.max(0, Math.min(HORSES.TRACK + 6 - sw / ppm, focus - sw * 0.45 / ppm));
    // ciel, tribunes, herbe
    const sky = ctx.createLinearGradient(0, sy, 0, sy + 60); sky.addColorStop(0, '#5a8ad8'); sky.addColorStop(1, '#a8c8f0');
    ctx.fillStyle = sky; ctx.fillRect(sx, sy, sw, 60);
    for (let k = -1; k < sw / 30 + 2; k++) {
      const x = sx + k * 30 - ((camX * ppm * 0.4) % 30);
      ctx.fillStyle = '#6a4a6a'; ctx.fillRect(x, sy + 34, 28, 26);
      for (let j = 0; j < 6; j++) { ctx.fillStyle = ['#e8c0a0', '#a07050', '#f0d0b0'][(k + j) % 3]; ctx.fillRect(x + 3 + j * 4, sy + 40 + ((j + k) % 2) * 6 + (Math.sin(this.time * 9 + j + k) > 0.6 ? -1 : 0), 3, 3); }
    }
    ctx.fillStyle = '#3c8a3c'; ctx.fillRect(sx, sy + 60, sw, sh - 60);
    ctx.fillStyle = '#c8a070'; ctx.fillRect(sx, sy + 70, sw, sh - 92);
    ctx.fillStyle = '#ffffff';
    for (let k = -1; k < sw / 20 + 2; k++) { const x = sx + k * 20 - ((camX * ppm) % 20); ctx.fillRect(x, sy + 64, 2, 8); }
    ctx.fillRect(sx, sy + 68, sw, 2);
    // poteaux tous les 10 m, ligne d'arrivée
    for (let m = 0; m <= HORSES.TRACK; m += 10) {
      const x = sx + (m - camX) * ppm;
      if (x < sx - 10 || x > sx + sw + 10) continue;
      if (m === HORSES.TRACK) {
        for (let y = sy + 70; y < sy + sh - 22; y += 6) for (let c = 0; c < 2; c++) { ctx.fillStyle = ((y / 6 | 0) + c) % 2 ? '#000' : '#fff'; ctx.fillRect(x + c * 4, y, 4, 6); }
        this.text('ARRIVÉE', x + 4, sy + 62, 8, '#ff3030', { mono: true });
      } else this.text(String(HORSES.TRACK - m), x, sy + 78, 7, '#ffffff', { mono: true, stroke: false });
    }
    // les chevaux (du plus loin au plus proche)
    const laneY = (k) => sy + 92 + k * 22;
    for (let k = 0; k < 4; k++) {
      const h = g.H[k], x = sx + (h.pos - camX) * ppm, y = laneY(k);
      const run = (h.v * 1.3 * this.time) + k;
      if (h.turbo > 0) { for (let n = 0; n < 4; n++) { ctx.fillStyle = `rgba(255,${180 + n * 15},60,${0.6 - n * 0.12})`; ctx.fillRect(x - 26 - n * 8, y - 10 + Math.sin(this.time * 30 + n) * 2, 7, 5); } }
      if (h.v > 4 && Math.random() < 0.5) { ctx.fillStyle = 'rgba(200,170,120,0.6)'; ctx.fillRect(x - 22 - Math.random() * 10, y - 2, 4, 3); }
      this.drawHorse(x, y, k, run, 1.2, h.stum > 0);
      const who = g.p[0].pick === k ? 0 : g.p[1].pick === k ? 1 : -1;
      if (who >= 0) {
        const slot = who === 0 ? M.a : M.v;
        this.text(this.pname(slot), x, y - 50, 10, COLORS[slot], { mono: true });
        if (h.whip > 0) this.text('CLAC !', x - 18, y - 22, 9, '#ffffff', { mono: true });
        if (h.stum > 0) this.text('IL S\'EMBALLE !', x, y - 40, 9, '#ff4040', { mono: true });
      }
      if (h.fin) this.text(String(1 + g.H.filter((o) => o.fin && o.fin < h.fin).length), x + 18, y - 22, 12, '#ffe24a', { mono: true });
    }
    // bandeau du bas : la course en petit, le commentaire
    const by = sy + sh - 20;
    ctx.fillStyle = 'rgba(0,0,40,0.85)'; ctx.fillRect(sx, by, sw, 20);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(sx + 8, by + 5, sw - 16, 1);
    for (let k = 0; k < 4; k++) { ctx.fillStyle = HORSES.COLORS[k]; ctx.fillRect(sx + 8 + (sw - 20) * g.H[k].pos / HORSES.TRACK, by + 2, 4, 6); }
    this.tickerT += dt;
    if (this.ticker) this.text(this.ticker, sx + sw / 2, by + 14, 8, '#ffe24a', { mono: true, stroke: false });
    if (g.t < 50) this.text(g.t < 25 ? 'À VOS MARQUES...' : 'PRÊTS...', sx + sw / 2, sy + 40, 16, '#ffffff', { mono: true });
    this.text('● EN DIRECT', sx + 8, sy + 10, 8, '#ff3030', { align: 'left', mono: true, alpha: Math.sin(this.time * 5) > 0 ? 1 : 0.5 });
  }

  // un cheval au galop, de profil, vers la droite (x, y = les sabots)
  drawHorse(x, y, k, run, s = 1, rear = false) {
    const ctx = this.g, coat = ['#6a3a1a', '#2a2020', '#e8e0d0', '#9a6a3a'][k];
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    if (rear) ctx.rotate(-0.45);
    const leg = (dx, ph) => { const a = Math.sin(run * 1.0 + ph) * 0.7; ctx.save(); ctx.translate(dx, -12); ctx.rotate(a); ctx.fillStyle = '#0b0610'; ctx.fillRect(-1.5, 0, 3, 12); ctx.restore(); };
    leg(-8, 0); leg(-5, 2); leg(7, 1); leg(10, 3);
    ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.ellipse(0, -16, 14, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = coat; ctx.beginPath(); ctx.ellipse(0, -16, 12.5, 5.6, 0, 0, Math.PI * 2); ctx.fill();
    // cou, tête
    ctx.save(); ctx.translate(10, -19); ctx.rotate(-0.8 + Math.sin(run) * 0.1);
    ctx.fillStyle = '#0b0610'; ctx.fillRect(-2, -12, 8, 14); ctx.fillStyle = coat; ctx.fillRect(-1, -11, 6, 12);
    ctx.fillStyle = '#0b0610'; ctx.fillRect(-2, -16, 13, 7); ctx.fillStyle = coat; ctx.fillRect(-1, -15, 11, 5);
    ctx.restore();
    // queue
    ctx.strokeStyle = '#1a1010'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-12, -18); ctx.quadraticCurveTo(-20, -18 + Math.sin(run * 2) * 3, -22, -10); ctx.stroke();
    // jockey
    ctx.fillStyle = '#0b0610'; ctx.fillRect(-4, -31, 9, 11);
    ctx.fillStyle = HORSES.COLORS[k]; ctx.fillRect(-3, -30, 7, 9);
    ctx.fillStyle = '#f0c8a0'; ctx.fillRect(-1, -35, 5, 5);
    ctx.fillStyle = HORSES.COLORS[k]; ctx.fillRect(-2, -37, 7, 3);
    ctx.fillStyle = '#ffffff'; ctx.font = "bold 6px 'Arial Black', sans-serif"; ctx.textAlign = 'center'; ctx.fillText(String(k + 1), 0, -24);
    ctx.restore();
  }

  // une pinte : le niveau descend à chaque gorgée, la mousse, les bulles ; la jauge d'emballement du cheval dessous
  drawPint(W, M, g, i, x, y) {
    const ctx = this.g, P = g.p[i], slot = i === 0 ? M.a : M.v;
    // une gorgée : la pinte part vers la bouche du parieur et se renverse dedans
    const q = P.sip > 0 ? Math.sin((30 - P.sip) / 30 * Math.PI) : 0, tilt = q * (i === 0 ? -1.05 : 1.05);
    ctx.save(); ctx.translate(x + (i === 0 ? -16 : 16) * q, y - 28 * q); ctx.rotate(tilt);
    const w0 = 44, w1 = 34, hgt = 96;
    const glass = () => { ctx.beginPath(); ctx.moveTo(-w0 / 2, -hgt); ctx.lineTo(w0 / 2, -hgt); ctx.lineTo(w1 / 2, 0); ctx.lineTo(-w1 / 2, 0); ctx.closePath(); };
    const lvl = P.sips / HORSES.SIPS, top = -hgt * (0.08 + 0.84 * lvl);
    ctx.save(); glass(); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(-30, -hgt, 60, hgt);
    if (lvl > 0) {
      const bg = ctx.createLinearGradient(0, top, 0, 0); bg.addColorStop(0, '#f0b030'); bg.addColorStop(1, '#b06a10');
      ctx.fillStyle = bg; ctx.fillRect(-30, top, 60, -top);
      ctx.fillStyle = '#fff6e0'; ctx.fillRect(-30, top - 10, 60, 11);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      for (let b = 0; b < 6; b++) { const by = -((this.time * 30 + b * 17) % (-top)); ctx.fillRect(-12 + b * 5, by, 2, 2); }
    }
    ctx.restore();
    glass(); ctx.strokeStyle = '#0b0610'; ctx.lineWidth = 4; ctx.stroke();
    glass(); ctx.strokeStyle = 'rgba(230,240,255,0.7)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(-w0 / 2 + 5, -hgt + 8, 3, hgt - 16);
    ctx.restore();
    this.text(this.pname(slot), x, y + 14, 12, COLORS[slot], { mono: true });
    this.text(`${P.sips} gorgée${P.sips > 1 ? 's' : ''}`, x, y + 28, 8, '#e8dcc4', { mono: true });
    if (g.ph === 'race') {
      const h = g.H[P.pick];
      ctx.fillStyle = '#0b0610'; ctx.fillRect(x - 30, y + 36, 60, 8);
      ctx.fillStyle = h.heat > 0.7 ? '#ff3030' : '#ffd23a'; ctx.fillRect(x - 29, y + 37, 58 * Math.min(1, h.heat), 6);
      this.text('FOUGUE', x, y + 52, 7, h.heat > 0.7 ? '#ff4040' : '#a99cba', { mono: true, stroke: false });
    }
  }

  // --- la bonne parole ----------------------------------------------------------------------------------------------
  drawMoral(W, M, dt) {
    const ctx = this.g, g = M.g, L = -this.ox, Rr = 640 + this.ox, T = -this.oy, B = 360 + this.oy;
    const bg = ctx.createLinearGradient(0, T, 0, B); bg.addColorStop(0, '#0a1a3a'); bg.addColorStop(1, '#2a0a2a');
    ctx.fillStyle = bg; ctx.fillRect(L, T, Rr - L, B - T);
    // rayons divins
    ctx.save(); ctx.translate(320, -40); ctx.globalAlpha = 0.07;
    for (let i = 0; i < 12; i++) { ctx.fillStyle = '#fff6c0'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 600, Math.PI * 0.5 - 0.36 + i * 0.06 + Math.sin(this.time * 0.5) * 0.02, Math.PI * 0.5 - 0.36 + i * 0.06 + 0.025); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    if (M.ph !== 'intro') { this.text('RÉPANDS LA BONNE PAROLE', 320, T + 18, 18, '#7ee0ff', { title: true }); this.timer(M, 320, T + 44); }
    for (let i = 0; i < 2; i++) {
      const P = g.p[i], slot = i === 0 ? M.a : M.v, cx = i === 0 ? 160 : 480;
      // le monde : rouge de haine, il verdit à chaque bonne réponse
      const hate = Math.max(0, 100 - P.score * 9), q = hate / 100;
      const gx = MORAL_GX[i], gy = 108, gr = 40;
      const an = this.ans[i];
      if (an) { an.t += dt; if (an.t > 0.6) this.ans[i] = null; }
      const shake = an && !an.ok ? (0.6 - an.t) * 8 : 0;
      // le prêcheur derrière sa chaire : il déclame, exulte sur une bonne réponse (auréole en série), pleure sa honte
      const pxx = MORAL_PX[i], lock = P.lock > 0;
      if (P.streak >= 3 && !lock) { ctx.save(); ctx.globalAlpha = 0.18 + 0.1 * Math.sin(this.time * 6); ctx.fillStyle = '#fff6a0'; ctx.beginPath(); ctx.moveTo(pxx - 30, 178); ctx.lineTo(pxx + 30, 178); ctx.lineTo(pxx + 12, T); ctx.lineTo(pxx - 12, T); ctx.closePath(); ctx.fill(); ctx.restore(); }
      if (this.pupOn(M)) this.player(W, M, i, pxx, 176, 122, { emote: lock ? 'sob' : P.streak >= 5 ? 'victory_celebration' : 'sing_02', head: 1.8 + Math.min(0.5, P.streak * 0.06), face: i ? 'threeL' : 'three', tint: lock ? '#ff2010' : P.streak >= 3 ? '#fff0a0' : null, tintK: lock ? 0.45 : 0.12, shadow: false });
      if (P.streak >= 3 && !lock) { const hy = 176 - 122 * 1.32 + Math.sin(this.time * 4) * 2; ctx.strokeStyle = '#0b0610'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(pxx, hy, 17, 5, 0, 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = '#ffe24a'; ctx.lineWidth = 3; ctx.stroke(); }
      if (lock) for (let f = 0; f < 3; f++) this.text('🔥', pxx - 24 + f * 24, 136 + Math.sin(this.time * 18 + f) * 3, 14 + f % 2 * 4, '#fff', { stroke: false });
      // la chaire, son nom dessus
      ctx.fillStyle = '#0b0610'; ctx.fillRect(pxx - 34, 134, 68, 44);
      ctx.fillStyle = '#6a3a1a'; ctx.fillRect(pxx - 31, 137, 62, 39);
      ctx.fillStyle = '#8a5228'; ctx.fillRect(pxx - 36, 132, 72, 7);
      ctx.fillStyle = COLORS[slot]; ctx.fillRect(pxx - 22, 148, 44, 18);
      this.text(this.pname(slot), pxx, 157, 11, '#ffffff', { mono: true });
      ctx.save(); ctx.translate(gx + (Math.random() - 0.5) * shake, gy);
      ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.arc(0, 0, gr + 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgb(${Math.round(40 + 180 * q)},${Math.round(90 + 60 * (1 - q))},${Math.round(200 * (1 - q) + 30)})`;
      ctx.beginPath(); ctx.arc(0, 0, gr, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(0, 0, gr, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = q > 0.5 ? '#8a2020' : '#3cb84a';
      const rot = this.time * 12;
      for (const [lx, ly, rw, rh] of [[-20, -14, 22, 16], [8, -20, 18, 12], [4, 6, 26, 18], [-30, 10, 16, 14], [40, -6, 18, 22]]) {
        const xx = ((lx + rot + 80) % 120) - 60; ctx.beginPath(); ctx.ellipse(xx, ly, rw / 2, rh / 2, 0.3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      if (q > 0.3) { ctx.fillStyle = `rgba(255,40,20,${q * 0.5})`; for (let f = 0; f < 4; f++) { const a = this.time * 2 + f * 1.6; ctx.fillRect(Math.cos(a) * gr * 0.8 - 2, Math.sin(a) * gr * 0.7 - 6 + Math.sin(this.time * 20 + f) * 2, 4, 8); } }
      if (an && an.ok) { ctx.strokeStyle = `rgba(120,255,140,${1 - an.t / 0.6})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, gr + 6 + an.t * 30, 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore();
      this.text(`HAINE : ${hate} %`, gx, gy + gr + 14, 9, q > 0.5 ? '#ff6a5a' : '#7cff8a', { mono: true });
      this.text(String(P.score), i ? cx - 128 : cx + 128, 72, 28, '#ffffff', { align: i ? 'left' : 'right', mono: true });
      // la question
      const qi = g.order[Math.min(P.i, g.order.length - 1)], Q = QUESTIONS[qi], good = g.sides[Math.min(P.i, g.order.length - 1)];
      this.panel(cx - 140, 178, 280, 38, 'rgba(14,6,22,0.9)', COLORS[slot]);
      this.text(Q[0] + ' ?', cx, 197, 13, '#ffffff');
      const opts = good === 0 ? [Q[1], Q[2]] : [Q[2], Q[1]];
      for (let s = 0; s < 2; s++) {
        const bx = cx - 140 + s * 144, by = 226;
        const locked = P.lock > 0;
        this.panel(bx, by, 136, 46, locked ? 'rgba(60,10,10,0.9)' : 'rgba(30,20,50,0.92)', locked ? '#802020' : '#7ee0ff');
        this.wrap(opts[s], bx + 68, by + 23, 128, 11, locked ? '#806060' : '#ffffff');
        this.text(s === 0 ? '◀' : '▶', s === 0 ? bx + 8 : bx + 128, by + 23, 12, '#7ee0ff', { stroke: false });
      }
      if (P.lock > 0) {
        ctx.fillStyle = '#0b0610'; ctx.fillRect(cx - 60, 280, 120, 6);
        ctx.fillStyle = '#ff4040'; ctx.fillRect(cx - 59, 281, 118 * P.lock / MORAL.WRONG, 4);
        this.text('HONTE !', cx, 296, 12, '#ff4040', { mono: true });
      } else if (P.streak >= 3) this.text(`SÉRIE D'AMOUR x${P.streak}`, cx, 294, 12, '#ff8ad0', { mono: true });
    }
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(319, 60, 2, 250);
  }

  // un texte sur deux lignes au plus, centré
  wrap(str, x, y, maxW, size, color) {
    const ctx = this.g;
    ctx.font = `${size}px 'Lilita One', 'Trebuchet MS', sans-serif`;
    const words = str.split(' '), lines = [];
    let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
    if (cur) lines.push(cur);
    lines.slice(0, 2).forEach((l, n) => this.text(l, x, y + (n - (Math.min(2, lines.length) - 1) / 2) * (size + 2), size, color));
  }


  // --- danse kawaii ---------------------------------------------------------------------------------------------------
  drawDance(W, M, dt) {
    const ctx = this.g, g = M.g, L = -this.ox, Rr = 640 + this.ox, T = -this.oy, B = 360 + this.oy, t = this.time;
    // fond pastel, rayons qui tournent, cœurs et étoiles qui flottent
    const bg = ctx.createLinearGradient(0, T, 0, B); bg.addColorStop(0, '#ffd6f0'); bg.addColorStop(1, '#c8b6ff');
    ctx.fillStyle = bg; ctx.fillRect(L, T, Rr - L, B - T);
    ctx.save(); ctx.translate(320, 200); ctx.rotate(t * 0.4);
    for (let i = 0; i < 12; i++) { ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.35)' : 'rgba(255,180,230,0.25)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 700, i * Math.PI / 6, (i + 0.5) * Math.PI / 6); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    for (let i = 0; i < 18; i++) {
      const fx = ((i * 97 + t * (14 + i % 5 * 6)) % 700) - 30, fy = ((i * 53) % 360) + Math.sin(t * 2 + i) * 10;
      this.text(i % 3 ? '♡' : '☆', fx, fy, 12 + (i % 4) * 4, i % 2 ? '#ff7ac8' : '#ffffff', { stroke: false, alpha: 0.5 });
    }
    const beat = (this.beatPop || 0);
    this.text('✿ DANSE KAWAII ✿', 320, T + 18, 20, '#ff4aa8', { title: true });
    this.timer(M, 320, T + 42);
    for (let i = 0; i < 2; i++) {
      const P = g.p[i], slot = i === 0 ? M.a : M.v, x0 = i === 0 ? 40 : 464, lw = 34, ry = 72;
      // le danseur : le vrai modèle qui danse (une danse par phrase de 8 temps, pas la même que l'autre), écrasé sur le
      // temps, la tête qui gonfle avec le combo ; il trébuche sur un raté, tourne comme une toupie tous les 10 combos
      const dx = i === 0 ? 250 : 390, last = this.dj && this.dj[i];
      ctx.fillStyle = 'rgba(255,90,184,0.35)'; ctx.beginPath(); ctx.ellipse(dx, 306, 46 + beat * 10, 9 + beat * 2, 0, 0, Math.PI * 2); ctx.fill();
      if (this.pupOn(M)) {
        const phrase = Math.floor(M.t / (DANCE.BEAT * 8));
        this.player(W, M, i, dx, 306 - beat * 5, 150, { emote: DANCES[(phrase + i * 3) % 6], head: 1.6 + Math.min(0.7, P.combo / 25), squash: [1 + beat * 0.09, 1 - beat * 0.08], rot: Math.sin(t * 3.93 + i * 3) * 0.04 });
      }
      if (last && last.t < 0.5) { last.t += dt; this.text(last.text, dx, 104 - last.t * 30, 16 + (last.g === 1 ? 4 : 0), last.col, { mono: true, alpha: 1 - last.t * 2 }); }
      this.text(this.pname(slot), dx, 322, 13, COLORS[slot], { mono: true });
      this.text(`${P.score}`, dx, 342, 18, '#ffffff', { mono: true });
      if (P.combo >= 3) this.text(`${P.combo} COMBO ${P.combo >= 15 ? '🔥' : '♡'}`, dx, 78, 12 + Math.min(10, P.combo / 3), '#ff4aa8', { mono: true });
      // les couloirs
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x0 - 4, ry - 22, lw * 4 + 8, B - ry + 22);
      for (let l = 0; l < 4; l++) {
        const lx = x0 + lw / 2 + l * lw, fl = this.lane && this.lane[i] ? this.lane[i][l] : 0;
        drawArrow(ctx, lx, ry, 14 + fl * 4, l, fl > 0 ? LANE_COL[l] : 'rgba(80,40,110,0.45)', false, t);
      }
      for (let k = 0; k < g.notes.length; k++) {
        const n = g.notes[k], dtf = n[0] - M.t;
        if (dtf > 140) break;
        if (P.hit[k] && P.hit[k] < 4) continue;
        const y = ry + dtf * 2.2;
        if (y < ry - 40) continue;
        drawArrow(ctx, x0 + lw / 2 + n[1] * lw, y, 13, n[1], P.hit[k] === 4 ? '#9a8aa8' : LANE_COL[n[1]], P.hit[k] !== 4, t + k);
      }
    }
    if (this.lane) for (const ln of this.lane) for (let l = 0; l < 4; l++) ln[l] = Math.max(0, ln[l] - dt * 5);
  }

  // --- bistouri bagarre --------------------------------------------------------------------------------------------------
  drawSurgery(W, M, dt) {
    const ctx = this.g, g = M.g, L = -this.ox, Rr = 640 + this.ox, T = -this.oy, B = 360 + this.oy, t = this.time;
    // le bloc : carrelage vert d'eau, la lampe
    ctx.fillStyle = '#9fd8cc'; ctx.fillRect(L, T, Rr - L, B - T);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (let x = Math.floor(L / 20) * 20; x < Rr; x += 20) ctx.fillRect(x, T, 1, B - T);
    for (let y = Math.floor(T / 20) * 20; y < B; y += 20) ctx.fillRect(L, y, Rr - L, 1);
    const lamp = ctx.createRadialGradient(320, 40, 10, 320, 120, 380); lamp.addColorStop(0, 'rgba(255,255,230,0.7)'); lamp.addColorStop(1, 'rgba(255,255,230,0)');
    ctx.fillStyle = lamp; ctx.fillRect(L, T, Rr - L, B - T);
    this.text('🩺 BISTOURI BAGARRE', 320, T + 18, 20, '#0a5a48', { title: true });
    this.timer(M, 320, T + 42);
    const S = 2.8;
    for (let i = 0; i < 2; i++) {
      const P = g.p[i], slot = i === 0 ? M.a : M.v, pat = i === 0 ? M.v : M.a, ox = i === 0 ? 22 : 342, oy = 96;
      const zap = this.zapT && this.zapT[i] > 0 ? this.zapT[i] : 0;
      // la table, le drap
      ctx.fillStyle = '#2a7a6a'; ctx.fillRect(ox - 10, oy - 30, 300, 230);
      ctx.fillStyle = '#3aa08a'; ctx.fillRect(ox - 4, oy - 24, 288, 218);
      // le patient (l'adversaire) : son vrai modèle couché sous le drap (le corps du jeu), seule son énorme tête dépasse ;
      // électrocuté avec la pince, il rit aux éclats quand on lui retire un objet (ça chatouille)
      const pp = this.pupOn(M), pat3 = pp && this.actor(W.fighters[pat].char, 2 + i, ox + 50 * S, oy + 6 * S + 112, 124, { key: 'pat' + i, head: 2.4, state: zap ? 'hitstun' : 'idle', kb: 140, tint: zap ? '#ff2020' : null, tintK: zap * 0.8, shadow: false, rot: Math.sin(t * 3) * 0.05 + (zap ? Math.sin(t * 60) * 0.04 : 0) });
      ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(ox + 20 * S - 3, oy + 6 * S - 3, 60 * S + 6, 56 * S + 6, 26) : ctx.rect(ox + 20 * S - 3, oy + 6 * S - 3, 60 * S + 6, 56 * S + 6); ctx.fill();
      ctx.fillStyle = '#f2c9a0'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(ox + 20 * S, oy + 6 * S, 60 * S, 56 * S, 24) : ctx.rect(ox + 20 * S, oy + 6 * S, 60 * S, 56 * S); ctx.fill();
      ctx.fillStyle = '#e0a888'; ctx.fillRect(ox + 49 * S, oy + 40 * S, 2 * S, 2 * S);
      if (pp && !pat3) {
        ctx.save(); ctx.translate(ox + 50 * S, oy - 2); ctx.rotate(Math.sin(t * 3) * 0.08 + (zap ? Math.sin(t * 60) * 0.2 : 0)); ctx.scale(1.15, 0.95);
        this.portraitAt(W.fighters[pat].char, 0, 0, 40, COLORS[pat], false);
        ctx.fillStyle = zap ? (Math.sin(t * 40) > 0 ? '#ff2020' : '#ffd0d0') : '#c02020'; ctx.beginPath(); ctx.arc(0, 4, zap ? 6 : 4, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      // le haut du drap, rabattu sous son menton
      ctx.fillStyle = '#0b0610'; ctx.fillRect(ox + 20 * S - 3, oy + 6 * S - 3, 60 * S + 6, 9);
      ctx.fillStyle = '#5ac0a8'; ctx.fillRect(ox + 20 * S, oy + 6 * S - 1, 60 * S, 6);
      if (zap) this.text(this.pick(['AÏE !', 'OUILLE !', 'AAAH !']) , ox + 50 * S + 34, oy - 14, 12, '#ff2020', { mono: true });
      // les trous et les objets
      g.cav.forEach((c, k) => {
        const cx = ox + c.x * S, cy = oy + c.y * S, rw = c.rw * S;
        ctx.fillStyle = '#d0a030'; ctx.beginPath(); ctx.arc(cx, cy, rw + 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#5a0a10'; ctx.beginPath(); ctx.arc(cx, cy, rw, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,120,120,0.35)'; ctx.setLineDash([2, 2]); ctx.beginPath(); ctx.arc(cx, cy, c.rin * S, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        if (!P.got[k] && P.hold !== k) this.text(ITEMS[c.item], cx, cy, rw * 1.1, '#fff', { stroke: false });
      });
      // le plateau des objets sortis
      // (du côté opposé au chirurgien)
      const trx = i === 0 ? ox + 232 : ox + 4;
      ctx.fillStyle = '#c8d0d8'; ctx.fillRect(trx, oy + 150, 44, 34);
      g.cav.forEach((c, k) => { if (P.got[k]) this.text(ITEMS[c.item], trx + 8 + (k % 3) * 12, oy + 160 + ((k / 3) | 0) * 14, 10, '#fff', { stroke: false }); });
      // le chirurgien, au premier plan dans son coin, tourné vers la table : concentré (grosse tête, il tremble) quand il
      // tire, électrocuté (clignote, sonné) sur un BZZZT, il exulte sur un objet sorti
      const sx = SURG_X[i];
      if (pp) this.player(W, M, i, sx, 404, 176, { face: i ? 'threeL' : 'three', head: P.hold >= 0 ? 2.1 : 1.8, state: P.hold >= 0 ? 'crouch' : 'idle', shadow: false, rot: P.hold >= 0 ? Math.sin(t * 40) * 0.01 : 0 });
      // la pince (tenue par le chirurgien)
      const hx = sx + (i ? -26 : 26), hy = 300;
      const px = ox + P.x * S + (zap ? (Math.random() - 0.5) * 6 : 0), py = oy + P.y * S + (zap ? (Math.random() - 0.5) * 6 : 0);
      if (P.hold >= 0) {
        const c = g.cav[P.hold];
        this.text(ITEMS[c.item], px, py - P.prog / SURGERY.PULL * 10, c.rw * S * (1 + P.prog / SURGERY.PULL * 0.4), '#fff', { stroke: false });
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(px, py, 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * P.prog / SURGERY.PULL); ctx.stroke();
      }
      ctx.strokeStyle = '#0b0610'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(px + 2, py + 1); ctx.stroke();
      ctx.strokeStyle = '#d8dce8'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(hx + 2, hy - 4); ctx.lineTo(px + 3, py - 1); ctx.moveTo(hx - 4, hy + 2); ctx.lineTo(px - 1, py + 3); ctx.stroke();
      ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.arc(hx, hy, 6, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#e8f0f0'; ctx.beginPath(); ctx.arc(hx, hy, 4, 0, Math.PI * 2); ctx.fill(); // le gant
      if (zap) {
        ctx.strokeStyle = '#fff6a0'; ctx.lineWidth = 2;
        for (let z = 0; z < 4; z++) { ctx.beginPath(); let zx = px, zy = py; ctx.moveTo(zx, zy); for (let q = 0; q < 5; q++) { zx += (Math.random() - 0.5) * 24; zy += (Math.random() - 0.5) * 24; ctx.lineTo(zx, zy); } ctx.stroke(); }
        ctx.fillStyle = `rgba(255,40,40,${zap * 0.4})`; ctx.fillRect(ox - 10, oy - 30, 300, 230);
        this.zapT[i] = Math.max(0, this.zapT[i] - dt * 1.5);
      }
      // en-tête : le chirurgien, son score, l'électrocardiogramme
      this.text(`Dr ${this.pname(slot)}`, ox, oy - 42, 13, COLORS[slot], { align: 'left', mono: true });
      this.text(String(P.score), ox + 280, oy - 42, 20, '#0b0610', { align: 'right', mono: true, stroke: false });
      const ex = i === 0 ? ox + 150 : ox + 10; // l'électrocardiogramme, du côté opposé au chirurgien
      ctx.fillStyle = '#0b1a14'; ctx.fillRect(ex, oy + 200, 130, 22);
      ctx.strokeStyle = zap ? '#ff4040' : '#40ff90'; ctx.lineWidth = 1.5; ctx.beginPath();
      const bpm = 1 + P.zaps * 0.5 + (zap ? 2 : 0);
      for (let q = 0; q < 130; q += 2) { const ph = ((q / 130) + t * bpm) % 1; const yy = ph > 0.45 && ph < 0.5 ? -8 : ph >= 0.5 && ph < 0.55 ? 7 : 0; if (q === 0) ctx.moveTo(ex + q, oy + 211 + yy); else ctx.lineTo(ex + q, oy + 211 + yy); }
      ctx.stroke();
      this.text(`${Math.round(70 + bpm * 30)} BPM`, i === 0 ? ex - 4 : ex + 134, oy + 211, 8, '#0a3a30', { align: i === 0 ? 'right' : 'left', mono: true, stroke: false });
    }
  }

  // --- les faux succès (façon Steam) et le flash info, par-dessus le combat après un ulti --------------------------
  achieve(W, slot, title, desc) { this.toasts.push({ slot, char: W.fighters[slot].char, title, desc, t: -this.toasts.length * 1.1 }); }

  drawToasts(dt) {
    const ctx = this.g, Rr = 640 + this.ox, B = 360 + this.oy;
    this.toasts = this.toasts.filter((k) => (k.t += dt) < 3.2);
    let row = 0;
    for (const k of this.toasts) {
      if (k.t < 0) continue;
      if (k.t < dt * 1.5 && this.audio) { this.audio.sfx('menuOk', 0, 0.7); this.audio.sfx('blip', 0, 0.5, 5); }
      const slide = k.t < 0.25 ? 1 - ease(k.t / 0.25) : k.t > 2.9 ? (k.t - 2.9) / 0.3 : 0;
      const w = 200, h = 46, x = Rr - w - 8, y = B - 8 - h - row * (h + 6) + slide * (h + 14);
      row++;
      const gr = ctx.createLinearGradient(x, y, x, y + h); gr.addColorStop(0, '#2a475e'); gr.addColorStop(1, '#1b2838');
      ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
      ctx.fillStyle = gr; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#66c0f4'; ctx.fillRect(x, y, w, 1);
      this.portraitAt(k.char, x + 23, y + 23, 34, COLORS[k.slot], false);
      this.text('🏆 Succès débloqué !', x + 46, y + 10, 8, '#66c0f4', { align: 'left', stroke: false });
      this.text(k.title, x + 46, y + 23, 11, '#ffffff', { align: 'left', stroke: false, mono: true });
      this.text(k.desc, x + 46, y + 36, 7, '#acb2b8', { align: 'left', stroke: false });
    }
  }

  // l'humiliation : un téléphone toktok à gauche (deux vidéos qui se moquent, likes et commentaires qui défilent) et
  // trois commentateurs (des persos absents du match) qui surgissent en bas de l'écran avec leur pique ; affichage seul
  // les commentateurs (persos absents du match) : tirés une fois par match, leurs marionnettes préparées d'avance (prewarm)
  mockPool(W) {
    if (!this.pool) {
      const inMatch = new Set(W.list.map((F) => F.char));
      this.pool = Object.keys(ACCOUNTS).filter((c) => CHARS[c] && !inMatch.has(c)).sort(() => Math.random() - 0.5);
    }
    return this.pool;
  }

  startMock(W, w, l) {
    const fill = (t) => t.replace(/\{n\}/g, this.pname(l)).replace(/\{w\}/g, this.pname(w));
    const vids = [...TOK_VIDS].sort(() => Math.random() - 0.5).slice(0, 2).map((v) => ({ ...v, slot: v.who === 'w' ? w : l, cap: fill(v.cap) }));
    const pool = this.mockPool(W);
    const coms = [...TOK_COMS].sort(() => Math.random() - 0.5).slice(0, 7).map((t, i) => [ACCOUNTS[pool[(i + 3) % pool.length]][0], fill(t)]);
    this.tok = { t: 0, vids, coms, likes: 800 + Math.random() * 3000, acc: ACCOUNTS[W.fighters[w].char] ? ACCOUNTS[W.fighters[w].char][0] : 'crypte_tv' };
    const lines = [...MOCK_LINES].sort(() => Math.random() - 0.5), xs = [180, 300, 420].sort(() => Math.random() - 0.5);
    this.mocks = [0, 1, 2].map((i) => ({ t: -(0.3 + i * 1.1 + Math.random() * 0.5), char: pool[i % pool.length], x: xs[i], line: fill(lines[i]), said: i > 0 }));
  }

  drawMock(W, dt) {
    const ctx = this.g, A = this.audio, B = 360 + this.oy;
    // les commentateurs : une petite caméra qui jaillit du bas, sa bulle au-dessus
    this.mocks = this.mocks.filter((m) => (m.t += dt) < 2.2);
    for (const m of this.mocks) {
      if (m.t < 0) continue;
      if (!m.said) { m.said = true; if (A) A.say(m.line, 0.9, 1.15, 'comment', 2); }
      if (m.t < dt * 1.5 && A) A.sfx('blip', 0, 0.5, 3);
      const u = m.t < 0.18 ? 1 - ease(m.t / 0.18) : m.t > 1.9 ? (m.t - 1.9) / 0.3 : 0;
      const bw = 72, bh = 60, x = m.x - bw / 2, y = B - bh - 6 + u * (bh + 20), wob = Math.sin(m.t * 30) * (m.t < 0.3 ? 2 : 0);
      ctx.save(); ctx.translate(m.x, y + bh / 2); ctx.rotate((m.x % 3 - 1) * 0.04 + wob * 0.01); ctx.translate(-m.x, -(y + bh / 2));
      ctx.fillStyle = '#0b0610'; ctx.fillRect(x - 2, y - 2, bw + 4, bh + 4);
      ctx.fillStyle = CHARS[m.char].color || '#ffe24a'; ctx.fillRect(x - 1, y - 1, bw + 2, bh + 2);
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, bw, bh); ctx.clip();
      ctx.fillStyle = '#26143a'; ctx.fillRect(x, y, bw, bh);
      const ok = this.puppet(m.char, m.x + Math.sin(m.t * 4) * 2, y + bh + 44, 96, clipFor(m.char, { emote: 'laugh_01', head: 2.2, shadow: false, every: 3, cid: 'cm' + m.char }));
      if (!ok) this.portraitAt(m.char, m.x, y + bh / 2, 40, CHARS[m.char].color, false);
      ctx.restore();
      ctx.fillStyle = '#d01020'; ctx.fillRect(x, y + bh - 11, bw, 11);
      this.text(`🎙 ${CHARS[m.char].name}`.toUpperCase(), m.x, y + bh - 5.5, 6, '#ffffff', { mono: true, stroke: false, maxW: bw - 4 });
      if (m.t % 1 < 0.6) { ctx.fillStyle = '#ff3030'; ctx.beginPath(); ctx.arc(x + 6, y + 6, 2.5, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
      // la bulle
      const a = Math.min(1, m.t / 0.12, (2.2 - m.t) / 0.25);
      ctx.font = "9px 'Lilita One', 'Trebuchet MS', sans-serif";
      const tw = Math.min(170, ctx.measureText(m.line).width + 14), bx = Math.max(-this.ox + 4, Math.min(640 + this.ox - tw - 4, m.x - tw / 2)), by = y - 26;
      ctx.globalAlpha = a; ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#0b0610'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(bx, by, tw, 18, 6); ctx.moveTo(m.x - 5, by + 18); ctx.lineTo(m.x, by + 25); ctx.lineTo(m.x + 5, by + 18); ctx.fill(); ctx.stroke();
      ctx.globalAlpha = 1;
      this.text(m.line, bx + tw / 2, by + 9, 9, '#0b0610', { stroke: false, alpha: a, maxW: tw - 8 });
    }
    // le téléphone toktok, à gauche
    const T = this.tok;
    if (!T) return;
    T.t += dt;
    if (T.t > 6.2) { this.tok = null; return; }
    const pw = 108, ph = 192, slide = T.t < 0.3 ? 1 - ease(T.t / 0.3) : T.t > 5.8 ? (T.t - 5.8) / 0.4 : 0;
    const px = -this.ox + 10 - slide * (pw + 30), py = 70;
    ctx.save(); ctx.translate(px + pw / 2, py + ph / 2); ctx.rotate(-0.05); ctx.translate(-(px + pw / 2), -(py + ph / 2));
    ctx.fillStyle = '#0a0a0e'; ctx.beginPath(); ctx.roundRect(px - 5, py - 5, pw + 10, ph + 10, 14); ctx.fill();
    ctx.strokeStyle = '#3a3a44'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 9); ctx.clip();
    // les deux vidéos, la seconde arrive par un glissé vers le haut
    const sw = Math.max(0, Math.min(1, (T.t - 2.9) / 0.25)), off = -ease(sw) * ph;
    T.vids.forEach((v, i) => {
      const vy = py + off + i * ph;
      if (vy > py + ph || vy + ph < py) return;
      const F = W.fighters[v.slot];
      ctx.fillStyle = i ? '#22102e' : '#0c1a30'; ctx.fillRect(px, vy, pw, ph);
      const lt = T.t - i * 3;
      if (F) {
        const o = { key: 'w' + v.slot, head: 2.3, shadow: false, squash: [1 + Math.sin(lt * 9) * 0.03, 1], every: 3, cid: 'tk' + i };
        if (v.emote) o.emote = v.emote; if (v.state) o.state = v.state;
        if (v.who === 'l') { o.tint = '#2a50ff'; o.tintK = 0.25; }
        if (!this.puppet(F.char, px + pw / 2 + Math.sin(lt * 2) * 3, vy + ph - 30, 120, clipFor(F.char, o))) this.portraitAt(F.char, px + pw / 2, vy + ph / 2, 50, COLORS[v.slot], false);
      }
      // le zoom qui tremble façon montage
      if (v.who === 'l' && lt % 1.4 < 0.12) { ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(px, vy, pw, ph); }
      // la légende
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(px, vy + ph - 40, pw, 40);
      this.text('@' + T.acc, px + 6, vy + ph - 33, 7, '#ffffff', { align: 'left', mono: true, stroke: false });
      this.text(v.cap, px + 6, vy + ph - 22, 7, '#ffffff', { align: 'left', stroke: false, maxW: pw - 26 });
      this.text(v.tags, px + 6, vy + ph - 11, 6, '#9ad8ff', { align: 'left', stroke: false, maxW: pw - 26 });
    });
    // le haut : le logo ; à droite : le cœur et les likes qui s'envolent
    this.text('toktok', px + pw / 2, py + 10, 9, '#ffffff', { mono: true, stroke: false });
    T.likes *= 1 + dt * 0.9;
    const lk = T.likes < 1000 ? String(Math.floor(T.likes)) : (T.likes / 1000).toFixed(1).replace('.', ',') + ' k';
    const hp = 1 + Math.max(0, Math.sin(T.t * 7)) * 0.15;
    this.text('❤', px + pw - 11, py + ph - 92, 12 * hp, '#ff2a5a', { stroke: false });
    this.text(lk, px + pw - 11, py + ph - 80, 6, '#ffffff', { stroke: false, mono: true });
    this.text('💬', px + pw - 11, py + ph - 66, 10, '#ffffff', { stroke: false });
    this.text(String(Math.floor(T.likes / 37)), px + pw - 11, py + ph - 56, 6, '#ffffff', { stroke: false, mono: true });
    // les commentaires qui montent
    const nc = Math.min(T.coms.length, Math.floor(T.t / 0.55));
    for (let i = Math.max(0, nc - 3); i < nc; i++) {
      const k = nc - 1 - i, cy = py + ph - 52 - k * 17, a = k === 2 ? 0.5 : 1;
      ctx.globalAlpha = 0.55 * a; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.roundRect(px + 4, cy - 7, pw - 26, 15, 4); ctx.fill(); ctx.globalAlpha = 1;
      this.text(T.coms[i][0], px + 7, cy - 2.5, 5, '#c8c8d0', { align: 'left', stroke: false, alpha: a, maxW: pw - 32 });
      this.text(T.coms[i][1], px + 7, cy + 3.5, 6.5, '#ffffff', { align: 'left', stroke: false, alpha: a, maxW: pw - 32 });
    }
    ctx.restore(); ctx.restore();
  }

  drawNews(W, dt) {
    if (!this.news && this.newsLater && (this.newsLater.at -= dt) <= 0) {
      this.news = { ...this.newsLater, t: 0 }; this.newsLater = null;
      const A = this.audio; if (A) { A.sfx('countHi', 0, 0.6); A.sfx('blip', 0, 0.5, 4); A.say('Flash info !', 0.5, 1.1); }
    }
    const N = this.news;
    if (!N) return;
    N.t += dt;
    if (N.t > 6.5) { this.news = null; return; }
    const ctx = this.g, L = -this.ox, Rr = 640 + this.ox, T = -this.oy;
    const slide = N.t < 0.3 ? 1 - ease(N.t / 0.3) : N.t > 6.1 ? (N.t - 6.1) / 0.4 : 0;
    const y = T + 8 - slide * 90;
    // le bandeau : FLASH INFO, la caricature, le titre, le défilant
    ctx.fillStyle = 'rgba(10,10,30,0.92)'; ctx.fillRect(L + 6, y, Rr - L - 12, 64);
    ctx.fillStyle = '#d01020'; ctx.fillRect(L + 6, y, 112, 20);
    this.text('⚡ FLASH INFO', L + 62, y + 10, 11, '#ffffff', { mono: true, stroke: false, alpha: Math.sin(N.t * 8) > -0.3 ? 1 : 0.6 });
    this.text('CRYPTE-TV 24/7 · EN DIRECT', L + 124, y + 10, 8, '#c8c8ff', { align: 'left', mono: true, stroke: false });
    // la caricature : sa marionnette en buste, énorme tête écrasée, qui pleure (ou rit, au match nul), « photo d'archive »
    const cx = L + 44, cy = y + 42;
    ctx.fillStyle = COLORS[N.slot]; ctx.fillRect(cx - 32, y + 20, 64, 40);
    ctx.save(); ctx.beginPath(); ctx.rect(cx - 30, y + 22, 60, 36); ctx.clip();
    const bgN = ctx.createLinearGradient(0, y + 22, 0, y + 58); bgN.addColorStop(0, '#2a2a5a'); bgN.addColorStop(1, '#101030');
    ctx.fillStyle = bgN; ctx.fillRect(cx - 30, y + 22, 60, 36);
    const ok = this.puppet(N.char, cx + Math.sin(N.t * 3) * 2, y + 94, 62, clipFor(N.char, { key: 'w' + N.slot, emote: N.loser ? null : 'laugh_01', tint: N.loser ? '#2a50ff' : null, tintK: 0.2, head: 2.4, squash: [1.2 + Math.sin(N.t * 5) * 0.05, 0.92], rot: Math.sin(N.t * 3) * 0.04, shadow: false, every: 3, cid: 'news' }));
    ctx.restore();
    if (!ok) { ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.sin(N.t * 3) * 0.08); ctx.scale(1.25 + Math.sin(N.t * 5) * 0.05, 0.85); this.portraitAt(N.char, 0, 0, 36, COLORS[N.slot], false); ctx.restore(); }
    if (N.loser) { this.text('💧', cx - 14, cy + 2 + (N.t * 20) % 14, 8, '#fff', { stroke: false }); this.text('💧', cx + 12, cy + 4 + (N.t * 24) % 14, 8, '#fff', { stroke: false }); }
    else this.text('👑', cx, cy - 22, 14, '#fff', { stroke: false });
    this.text('PHOTO D\'ARCHIVE', cx, y + 61, 5, '#c8c8c8', { stroke: false, mono: true });
    ctx.save(); ctx.beginPath(); ctx.rect(L + 76, y + 20, Rr - L - 88, 44); ctx.clip();
    this.text(N.head, L + 82, y + 34, 13, '#ffffff', { align: 'left', mono: true });
    ctx.fillStyle = '#ffd23a'; ctx.fillRect(L + 76, y + 48, Rr - L - 88, 14);
    const crawl = N.ticker, tw = crawl.length * 5.2;
    this.text(crawl, L + 76 + (Rr - L) - ((N.t * 80) % (tw + Rr - L)), y + 55, 8, '#0b0610', { align: 'left', stroke: false, mono: true });
    ctx.restore();
  }

  dispose() {
    Input.setDuel([]);
    if (this.x3 && this.x3.exit3D) this.x3.exit3D(this, this.mv.W);
    this.exitMap();
    if (this.fps3) this.mv.root.remove(this.fps3.group);
    this.R.split = null; this.R.throttle = 1; this.R.tv = null; this.R.freeze3D = false;
    this.dropGhost(); this.dropPool();
    this.cv.remove();
  }
}

// les options d'une marionnette, ajustées au perso. Epektase et PPROD n'ont que leurs deux clips à eux ('select', 'win') : les autres provocations y sont remplacées
// (joie : sa danse de victoire ; peine, colère : sonné ; le reste : sa provocation)
const BASIC = new Set(['epektase', 'pprod']);
const JOY = /^(dance|cheer|clap|victory|heart|laugh|sing|jump_rope|greet)/, SAD = /^(sob|angry|complain)/;
const HEADK = { pika: 0.35 }; // les persos qui ont déjà une grosse tête : moins de caricature (sinon elle sort du cadre)
function clipFor(char, o) {
  if (o.head && HEADK[char]) o.head = 1 + (o.head - 1) * HEADK[char];
  const e = o.emote;
  if (!e || e === 'select' || e === 'win' || !BASIC.has(char)) return o;
  if (SAD.test(e)) { o.emote = null; o.state = 'dizzy'; } else o.emote = /^dance_0[246]/.test(e) ? 'select' : JOY.test(e) ? 'win' : 'select';
  return o;
}

// une flèche kawaii (couloir 0 gauche, 1 bas, 2 haut, 3 droite), avec un petit visage si `face`
function drawArrow(ctx, x, y, r, lane, col, face, t) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(LANE_ROT[lane]);
  const path = () => { ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(0, -r); ctx.lineTo(0, -r * 0.45); ctx.lineTo(-r, -r * 0.45); ctx.lineTo(-r, r * 0.45); ctx.lineTo(0, r * 0.45); ctx.lineTo(0, r); ctx.closePath(); };
  ctx.lineJoin = 'round'; path(); ctx.lineWidth = 5; ctx.strokeStyle = '#4a2060'; ctx.stroke();
  path(); ctx.fillStyle = col; ctx.fill();
  ctx.rotate(-LANE_ROT[lane]);
  if (face) {
    const bl = Math.sin(t * 3) > 0.95;
    ctx.fillStyle = '#2a1030';
    if (bl) { ctx.fillRect(-r * 0.4, -r * 0.1, r * 0.25, 1.5); ctx.fillRect(r * 0.15, -r * 0.1, r * 0.25, 1.5); }
    else { ctx.beginPath(); ctx.arc(-r * 0.28, -r * 0.08, r * 0.12, 0, Math.PI * 2); ctx.arc(r * 0.28, -r * 0.08, r * 0.12, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,90,140,0.7)'; ctx.fillRect(-r * 0.5, r * 0.12, r * 0.2, r * 0.1); ctx.fillRect(r * 0.3, r * 0.12, r * 0.2, r * 0.1);
  }
  ctx.restore();
}

// un bonbon dessiné au pinceau du canevas : 0 rond rouge, 1 carré orange, 2 étoile jaune, 3 œil vert, 4 losange bleu,
// 5 papillote violette ; pouvoir 1 : visage de citrouille et halo, 2 : crâne
function drawCandy(ctx, t, p, x, y, r, time, flash) {
  if (r <= 0.3) return;
  const c = CANDY_COL[t], d = CANDY_DARK[t];
  ctx.save();
  ctx.translate(x, y);
  if (p) {
    ctx.fillStyle = p === 1 ? 'rgba(255,150,30,0.45)' : 'rgba(255,255,255,0.4)';
    const gr = r * (1.25 + Math.sin(time * 8) * 0.1);
    ctx.beginPath(); ctx.arc(0, 0, gr, 0, Math.PI * 2); ctx.fill();
  }
  ctx.lineWidth = Math.max(1.5, r * 0.18); ctx.strokeStyle = '#0b0610'; ctx.fillStyle = c;
  ctx.beginPath();
  if (t === 0) ctx.arc(0, 0, r, 0, Math.PI * 2);
  else if (t === 1) { const s = r * 0.88; ctx.moveTo(-s + 3, -s); ctx.lineTo(s - 3, -s); ctx.lineTo(s, -s + 3); ctx.lineTo(s, s - 3); ctx.lineTo(s - 3, s); ctx.lineTo(-s + 3, s); ctx.lineTo(-s, s - 3); ctx.lineTo(-s, -s + 3); ctx.closePath(); }
  else if (t === 2) { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.5 : r * 1.08; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); }
  else if (t === 3) ctx.arc(0, 0, r * 0.95, 0, Math.PI * 2);
  else if (t === 4) { ctx.moveTo(0, -r * 1.1); ctx.lineTo(r * 0.85, 0); ctx.lineTo(0, r * 1.1); ctx.lineTo(-r * 0.85, 0); ctx.closePath(); }
  else { ctx.moveTo(-r * 1.15, -r * 0.6); ctx.lineTo(-r * 0.55, 0); ctx.lineTo(-r * 1.15, r * 0.6); ctx.closePath(); ctx.moveTo(r * 1.15, -r * 0.6); ctx.lineTo(r * 0.55, 0); ctx.lineTo(r * 1.15, r * 0.6); ctx.closePath(); ctx.moveTo(r * 0.68, 0); ctx.ellipse(0, 0, r * 0.68, r * 0.62, 0, 0, Math.PI * 2); }
  ctx.fill(); ctx.stroke();
  // détails
  if (t === 3) { ctx.fillStyle = '#f4f0e0'; ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.arc(Math.sin(time * 2 + x) * r * 0.12, 0, r * 0.26, 0, Math.PI * 2); ctx.fill(); }
  else if (t === 0) { ctx.strokeStyle = d; ctx.lineWidth = r * 0.16; ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0.3, 4.2); ctx.stroke(); }
  else if (t === 5) { ctx.strokeStyle = d; ctx.lineWidth = r * 0.14; ctx.beginPath(); ctx.moveTo(-r * 0.3, -r * 0.5); ctx.lineTo(r * 0.3, r * 0.5); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillRect(-r * 0.5, -r * 0.62, r * 0.32, r * 0.22);
  if (p === 1) {
    // visage de citrouille
    ctx.fillStyle = '#0b0610';
    ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.1); ctx.lineTo(-r * 0.2, -r * 0.1); ctx.lineTo(-r * 0.35, -r * 0.42); ctx.closePath();
    ctx.moveTo(r * 0.5, -r * 0.1); ctx.lineTo(r * 0.2, -r * 0.1); ctx.lineTo(r * 0.35, -r * 0.42); ctx.closePath(); ctx.fill();
    ctx.fillRect(-r * 0.5, r * 0.18, r, r * 0.22);
    ctx.fillStyle = '#ffb030'; ctx.fillRect(-r * 0.3, r * 0.18, r * 0.16, r * 0.1); ctx.fillRect(r * 0.12, r * 0.18, r * 0.16, r * 0.1);
  } else if (p === 2) {
    // crâne
    ctx.fillStyle = '#f4f0e0'; ctx.strokeStyle = '#0b0610'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, -r * 0.12, r * 0.55, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillRect(-r * 0.3, r * 0.2, r * 0.6, r * 0.3);
    ctx.fillStyle = '#0b0610';
    ctx.beginPath(); ctx.arc(-r * 0.2, -r * 0.12, r * 0.14, 0, Math.PI * 2); ctx.arc(r * 0.2, -r * 0.12, r * 0.14, 0, Math.PI * 2); ctx.fill();
  }
  if (flash > 0) { ctx.globalAlpha = flash; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, r * 1.1, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}


// =================================================================================================================
// Les cartes du duel au pistolet, une par variante, faites de boîtes (aucun fichier : le projet reste léger) et
// inspirées de cartes connues. Repère : x de p[0] (x = -L) vers p[1] (x = +L), z sur le côté (les tireurs vont de -zr
// à +zr), y vers le haut, à partir du sol de la plateforme. Chaque carte : ciel, brouillard, couleur des abris, et la
// liste de ses boîtes [x, y, z, largeur (x), hauteur, profondeur (z), couleur, éclat], y = le bas de la boîte.
// (s : -1 côté p[0], +1 côté p[1] ; Wd : le bord du couloir où l'on se bat)
const each = (f) => [...f(-1), ...f(1)];
// des guirlandes tendues en travers du couloir, au-dessus des têtes (n, en x, de -L à L)
const zig = (L, Wd, y, n) => Array.from({ length: n }, (_, k) => { const x = n === 1 ? 0 : -L * 0.75 + k * (1.5 * L / (n - 1)); return [[x - 0.6, y, -Wd], [x + 0.6, y, Wd], 14, 0.7]; });
// les couleurs des ampoules, comme les vieilles guirlandes d'Halloween des films : orange, violet, vert, blanc chaud, rouge
const BULBS = ['#ff9a2a', '#b45cff', '#7cff5a', '#ffe2a0', '#ff9a2a', '#ff4a3a', '#b45cff'];
const DUEL_MAPS = {
  // Nuketown (Call of Duty : Black Ops) : deux maisons pastel face à face, palissades blanches, le bus scolaire jaune
  colt: { sky: '#2a2148', fog: '#3a2d58', cover: '#c8c8c0', deco: (L, Wd) => ({
    strings: [...each((s) => [[[s * (L + 2.9), 3.45, -5.2], [s * (L + 2.9), 3.45, 5.2], 14, 0.25], [[-L - 2, 1, s * Wd], [L + 2, 1, s * Wd], 22, 0.12]]), ...zig(L, Wd, 3.7, 3)],
    pumpkins: [...each((s) => [[s * (L + 2.5), 0, -1.6, 0.5], [s * (L + 2.5), 0, 1.4, 0.38], [s * (L + 2.6), 0, 0.6, 0.3]]), [L * 0.3, 0, Wd - 0.5, 0.42], [-L * 0.4, 0, -Wd + 0.5, 0.4]],
    ghosts: [[-L - 2.6, 2.4, -3.4], [L + 2.6, 2.6, 3.2]],
  }), boxes: (L, Wd) => [
    [0, -0.1, 0, 2 * L + 40, 0.1, 2 * Wd + 30, '#6aa84f'], [0, -0.09, 0, 2 * L + 40, 0.1, 3.2, '#8a8a8a'],
    ...each((s) => [
      [s * (L + 5), 0, 0, 4, 3.2, 10, s < 0 ? '#f0d26a' : '#86cbbf'], [s * (L + 5), 3.2, 0, 4.6, 0.5, 10.6, '#7a2a24'],
      [s * (L + 2.95), 1.4, -2.4, 0.12, 1, 1.4, '#ffc870', 0.95], [s * (L + 2.95), 1.4, 2.4, 0.12, 1, 1.4, '#ffc870', 0.95], [s * (L + 2.95), 0, 0, 0.12, 2, 1, '#6a3a22'],
      [0, 0.35, s * Wd, 2 * L + 6, 0.1, 0.08, '#f4f4f4'], [0, 0.8, s * Wd, 2 * L + 6, 0.1, 0.08, '#f4f4f4'],
      ...[-3, -1.5, 0, 1.5, 3].map((u) => [u * L / 3, 0, s * Wd, 0.12, 1, 0.12, '#f4f4f4']),
    ]),
    [0, 0.4, Wd + 2.6, 7, 2.3, 2.4, '#f2b51b'], [0, 1.6, Wd + 1.38, 6, 0.6, 0.06, '#2a3a4a', 0.5], [0, 0, Wd + 2.6, 6.4, 0.45, 2, '#1a1a1a'],
  ] },
  // Shipment (Call of Duty 4) : un petit carré d'asphalte coincé entre des conteneurs de toutes les couleurs
  pompe: { sky: '#262a36', fog: '#323848', cover: '#c0682a', deco: (L, Wd) => ({
    strings: [...each((s) => [[[-L - 6, 2.62, s * (Wd + 0.1)], [L + 6, 2.62, s * (Wd + 0.1)], 26, 0.2], [[-L - 5, 5.22, s * (Wd + 0.1)], [L + 6, 5.22, s * (Wd + 0.1)], 22, 0.3]]), ...zig(L, Wd + 0.2, 4.6, 3)],
    pumpkins: [...each((s) => [[s * (L + 3.5), 5.2, 0, 0.45], [s * (L + 2.2), 0, -2.6, 0.4], [-L * 0.5 * s, 2.6, s * (Wd + 1.3), 0.4]])],
    ghosts: [[0, 4.2, Wd + 1.2]],
  }), boxes: (L, Wd) => {
    const C = ['#b8322a', '#2a5a9a', '#3a8a3a', '#d08a2a', '#8a8a8a'], out = [[0, -0.1, 0, 2 * L + 40, 0.1, 2 * Wd + 30, '#3e4246']];
    let n = 0;
    for (const s of [-1, 1]) for (let x = -L - 6; x <= L + 6; x += 6.3) { out.push([x, 0, s * (Wd + 1.3), 6, 2.6, 2.4, C[n++ % 5]]); if (n % 2) out.push([x + 1, 2.6, s * (Wd + 1.3), 6, 2.6, 2.4, C[(n + 2) % 5]]); }
    for (const s of [-1, 1]) for (const z of [-3.2, 0, 3.2]) { out.push([s * (L + 3.5), 0, z, 2.4, 2.6, 3, C[n++ % 5]]); if (z === 0) out.push([s * (L + 3.5), 2.6, z, 2.4, 2.6, 3, C[(n + 1) % 5]]); }
    return out;
  } },
  // Rust (Modern Warfare 2) : du sable, de la tôle rouillée, des tuyaux et le grand derrick au milieu
  akimbo: { sky: '#b8643c', fog: '#9a5a44', cover: '#7a4a2a', deco: (L, Wd) => ({
    strings: [[[0, 10.8, -(Wd + 4)], [-L - 2, 0.2, -(Wd + 0.6)], 18, 0.5], [[0, 10.8, -(Wd + 4)], [L + 2, 0.2, -(Wd + 0.6)], 18, 0.5], [[0, 10.8, -(Wd + 4)], [0, 0.2, Wd + 1.2], 16, 0.6], ...each((s) => [[[s * (L + 2.4), 3.05, -2.6], [s * (L + 2.4), 3.05, 2.6], 10, 0.2]])],
    pumpkins: [...each((s) => [[s * (L + 2.2), 0, -1.8, 0.45], [s * L * 0.5, 0, s * (Wd - 0.6), 0.4]]), [1.6, 0, -(Wd + 2.6), 0.5]],
    ghosts: [[0, 6.5, -(Wd + 3)]],
  }), boxes: (L, Wd) => [
    [0, -0.1, 0, 2 * L + 40, 0.1, 2 * Wd + 30, '#c9a46a'],
    ...each((s) => [
      ...[-1, -0.33, 0.33, 1].map((u) => [u * (L + 2), 0, s * (Wd + 0.4), (L + 2) * 0.55, 1.8 + (u > 0 ? 0.6 : 0), 0.15, s < 0 ? '#8a4a2a' : '#7a5a3a']),
      [s * (L + 4), 0, 0, 3, 3, 5, '#6a5a4a'], [s * (L + 4), 3, 0, 3.4, 0.2, 5.4, '#4a3a2a'],
    ]),
    ...[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([a, b]) => [a * 1.2, 0, -(Wd + 4) + b * 1.2, 0.25, 11, 0.25, '#6a3a22']),
    [0, 5, -(Wd + 4), 3, 0.2, 3, '#5a3020'], [0, 10.6, -(Wd + 4), 3.2, 0.4, 3.2, '#5a3020'],
    [0, 0.25, Wd + 1.6, 2 * L + 10, 0.5, 0.5, '#7a5a3a'], [0, 0.85, Wd + 1.6, 2 * L + 10, 0.5, 0.5, '#6a4a2a'],
  ] },
  // Dust 2 (Counter-Strike) : de hauts murs de pierre ocre, les portes bleues et leur arche, des caisses en bois
  rail: { sky: '#5a3a68', fog: '#6a4a72', cover: '#9a7444', deco: (L, Wd) => ({
    strings: [...each((s) => [[[-L - 6, 5.15, s * Wd], [L + 6, 5.15, s * Wd], 30, 0.3]]), ...zig(L + 2, Wd, 4.6, 4), [[L + 2.4, 4.9, -2], [L + 2.4, 4.9, 2], 9, 0.35]],
    pumpkins: [[L + 2.2, 0, -1.8, 0.45], [L + 2.2, 0, 1.8, 0.45], [-L - 1.9, 2.4, -2, 0.35], ...each((s) => [[-L * 0.7, 1.1, s * (Wd - 0.6), 0.32], [L * 0.75, 1.1, s * (Wd - 0.6), 0.32]])],
    ghosts: [[0, 3.6, -Wd + 0.6]],
  }), boxes: (L, Wd) => [
    [0, -0.1, 0, 2 * L + 40, 0.1, 2 * Wd + 30, '#c8a878'],
    ...each((s) => [
      [0, 0, s * (Wd + 0.6), 2 * L + 12, 5, 1.2, '#d6b88a'], [0, 5, s * (Wd + 0.6), 2 * L + 12, 0.3, 1.4, '#b89868'],
      ...[-0.7, 0.2, 0.75].map((u) => [u * L, 0, s * (Wd - 0.6), 1.1, 1.1, 1.1, '#8a6a3a']),
    ]),
    [L + 3, 0, -3.5, 1, 5, 2 * Wd - 4, '#d6b88a'], [L + 3, 0, 3.5, 1, 5, 2 * Wd - 4, '#d6b88a'], [L + 3, 3.2, 0, 1, 1.8, 3, '#d6b88a'],
    [L + 2.45, 0, -0.66, 0.15, 3.2, 1.28, '#2e5a86'], [L + 2.45, 0, 0.66, 0.15, 3.2, 1.28, '#2e5a86'],
    [-L - 3, 0, 0, 1, 5, 2 * Wd + 2, '#d6b88a'], [-L - 1.9, 0, -2, 1.2, 1.2, 1.2, '#8a6a3a'], [-L - 1.9, 1.2, -2, 1.2, 1.2, 1.2, '#7a5a2a'], [-L - 1.9, 0, 2.4, 1.2, 1.2, 1.2, '#8a6a3a'],
  ] },
  // Blood Gulch (Halo) : un canyon d'herbe, ses parois, la base bleue et la base rouge
  roquette: { sky: '#3a3460', fog: '#4a4470', cover: '#7a6e60', deco: (L, Wd) => ({
    strings: [...each((s) => [[[s * (L + 2.4), 3.4, -3.8], [s * (L + 2.4), 3.4, 3.8], 12, 0.25], [[s * (L + 2.4), 0.2, -3.8], [s * (L + 2.4), 3.3, -3.8], 6, 0], [[s * (L + 2.4), 0.2, 3.8], [s * (L + 2.4), 3.3, 3.8], 6, 0]]), ...zig(L, Wd + 2, 6, 3)],
    pumpkins: [...each((s) => [[s * (L + 2.1), 0, -2.4, 0.5], [s * (L + 2.1), 0, 2.4, 0.5], [s * L * 0.35, 0, s * (Wd - 0.3), 0.42]])],
    ghosts: [[-L * 0.4, 4.6, Wd + 1.8], [L * 0.5, 5, -Wd - 1.6]],
  }), boxes: (L, Wd) => [
    [0, -0.1, 0, 2 * L + 40, 0.1, 2 * Wd + 30, '#5f8f3a'],
    ...each((s) => [
      ...[-1.2, -0.4, 0.4, 1.2].map((u, k) => [u * (L + 4), 0, s * (Wd + 3 + k % 2), (L + 4) * 0.9, 6 + ((k * 7 + (s > 0 ? 3 : 0)) % 4), 4, k % 2 ? '#8a7a68' : '#7a6a5a']),
      [s * (L + 4.5), 0, 0, 4, 3, 7, '#6a6f78'], [s * (L + 4.5), 3, 0, 4.4, 0.4, 7.4, '#4a4e56'],
      [s * (L + 2.45), 0.9, 0, 0.1, 0.25, 6, s < 0 ? '#3a8aff' : '#ff3a3a', 1], [s * (L + 2.45), 0, 0, 0.1, 2.2, 1.6, '#2a2c32'],
    ]),
  ] },
  // Moon (Call of Duty : Black Ops) : sol gris criblé de cratères, modules blancs, la Terre dans le ciel noir
  lune: { sky: '#05050a', fog: '#0a0a14', cover: '#d8d8d8', deco: (L, Wd) => ({
    strings: [...each((s) => [[[s * (L + 2.5), 2.65, -4], [s * (L + 2.5), 2.65, 4], 14, 0.3], [[-L - 4, 0.85, s * (Wd + 1)], [L + 4, 0.85, s * (Wd + 1)], 24, 0.15]])],
    pumpkins: [...each((s) => [[s * (L + 2.3), 0, -0.9, 0.42], [s * L * 0.6, 0, s * (Wd - 0.4), 0.38]])],
    ghosts: [[0, 4, Wd + 2], [L * 0.6, 3.4, -Wd - 1]],
  }), boxes: (L, Wd) => [
    [0, -0.1, 0, 2 * L + 40, 0.1, 2 * Wd + 30, '#8a8a8a'],
    ...[[-0.5, 1.6, 1.4], [0.4, -1.2, 1.8], [0.1, 2.4, 0.9], [-0.9, -2.2, 1.2], [0.8, 0.9, 1.1]].map(([u, z, r]) => [u * L, -0.04, z, r * 2, 0.05, r * 2, '#6a6a6a']),
    ...each((s) => [
      [s * (L + 4), 0, -2.5, 3, 2.6, 3, '#e8e8e8'], [s * (L + 4), 0, 2.5, 3, 2.6, 3, '#e8e8e8'], [s * (L + 4), 0.6, 0, 2, 1.4, 2, '#c8c8c8'],
      [s * (L + 2.45), 1.2, -2.5, 0.1, 0.6, 1.6, '#5ae8ff', 0.9], [s * (L + 2.45), 1.2, 2.5, 0.1, 0.6, 1.6, '#5ae8ff', 0.9],
      [0, 0, s * (Wd + 1.5), 2 * L + 8, 0.8, 1, '#7a7a7a'],
    ]),
    [L + 45, 14, 0, 14, 14, 14, '#2a6ad0', 0.9, 'ball'], [-L - 45, 16, -6, 10, 10, 10, '#c86a3a', 0.8, 'ball'],
  ] },
  // awp_india (Counter-Strike) : la vieille carte de snipers, une cour de sable, des murets à arches, deux maisons au bout
  awp: { sky: '#b8604a', fog: '#a8604a', cover: '#9a7444', deco: (L, Wd) => ({
    strings: [...each((s) => [[[-L - 6, 2.25, s * (Wd + 0.3)], [L + 6, 2.25, s * (Wd + 0.3)], 34, 0.25], [[s * (L + 2.9), 3.6, -4.5], [s * (L + 2.9), 3.6, 4.5], 12, 0.3]])],
    pumpkins: [...each((s) => [[s * (L + 2.4), 0, -1.6, 0.45], [s * (L + 2.4), 0, 1.6, 0.45], [s * L * 0.3, 0, s * (Wd - 0.6), 0.4]])],
    ghosts: [[0, 3.2, Wd + 2.5]],
  }), boxes: (L, Wd) => [
    [0, -0.1, 0, 2 * L + 40, 0.1, 2 * Wd + 30, '#c9a878'],
    ...each((s) => [
      ...[-0.8, -0.4, 0, 0.4, 0.8].map((u) => [u * (L + 4), 0, s * (Wd + 0.3), (L + 4) * 0.3, 2.2, 0.6, '#cfae80']),
      [s * (L + 4.5), 0, 0, 3, 3.8, 10, '#b8946a'], [s * (L + 2.95), 0, 0, 0.12, 2.2, 1.3, '#6a4a2a'],
      [s * (L + 2.95), 1.8, -3, 0.12, 0.9, 1, '#ffc870', 0.9], [s * (L + 2.95), 1.8, 3, 0.12, 0.9, 1, '#ffc870', 0.9],
      [s * L * 0.55, 0, s * (Wd + 2.6), 0.35, 4.5, 0.35, '#7a5a3a'], [s * L * 0.55, 4.4, s * (Wd + 2.6), 2.4, 1.2, 2.4, '#3a7a3a', 0.35, 'ball'],
      [-s * L * 0.5, 0, s * (Wd - 0.7), 1.1, 1.1, 1.1, '#8a6a3a'], [s * L * 0.15, 0, s * (Wd - 0.7), 1.1, 1.1, 1.1, '#8a6a3a'],
    ]),
  ] },
  // Overgrown (Call of Duty 4) : les champs, des fermes en ruine, des bottes de foin, des arbres, le paradis des snipers
  champs: { sky: '#28304a', fog: '#343c58', cover: '#c8a040', deco: (L, Wd) => ({
    strings: [...each((s) => [[[s * (L + 2.8), 2.6, -4.5], [s * (L + 2.8), 2.2, 4.5], 12, 0.3], [[-L - 4, 1.05, s * (Wd + 0.6)], [L + 4, 1.05, s * (Wd + 0.6)], 30, 0.2]])],
    pumpkins: [...[-0.75, -0.45, -0.15, 0.2, 0.5, 0.8].map((u, k) => [u * L, 0, (k % 2 ? 1 : -1) * (Wd + 1.2 + (k % 3) * 0.6), 0.4 + (k % 3) * 0.08])],
    ghosts: [[-L * 0.3, 3.4, -Wd - 2], [L * 0.4, 3, Wd + 2.2]],
  }), boxes: (L, Wd) => [
    [0, -0.1, 0, 2 * L + 40, 0.1, 2 * Wd + 30, '#4f7a34'],
    ...each((s) => [
      [s * (L + 3.5), 0, -3.5, 0.6, 3.2, 3, '#8a4a3a'], [s * (L + 3.5), 0, 0, 0.6, 1.6, 4, '#8a4a3a'], [s * (L + 3.5), 0, 3.6, 0.6, 2.6, 2.8, '#7a3e30'],
      [s * (L + 5.2), 0, 0, 3, 0.6, 9, '#6a3a2a'],
      [0, 0, s * (Wd + 0.6), 2 * L + 8, 0.12, 0.1, '#6a4a2a'], [0, 0.7, s * (Wd + 0.6), 2 * L + 8, 0.12, 0.1, '#6a4a2a'],
      ...[-0.9, -0.3, 0.35, 0.85].map((u, k) => [u * L, 0, s * (Wd + 3 + (k % 2) * 1.5), 0.4, 3.5, 0.4, '#5a3a22']),
      ...[-0.9, -0.3, 0.35, 0.85].map((u, k) => [u * L, 3.2, s * (Wd + 3 + (k % 2) * 1.5), 2.6, 2.2, 2.6, '#2f5a2a', 0.3, 'ball']),
      [s * L * 0.6, 0, s * (Wd - 0.6), 1.4, 0.9, 1, '#c8a040'],
    ]),
  ] },
  // Office (Counter-Strike) : moquette, bureaux, cloisons, néons au plafond et la neige derrière les fenêtres
  noir: { sky: '#020204', fog: '#04040a', cover: '#6a4a2a', deco: (L, Wd) => ({
    strings: [...each((s) => [[[-L - 6, 3.18, s * (Wd - 0.1)], [L + 6, 3.18, s * (Wd - 0.1)], 28, 0.15]]), ...zig(L, Wd, 3.15, 3)],
    pumpkins: [...each((s) => [[-L * 0.6, 0.75, s * (Wd - 0.9), 0.3], [L * 0.7, 0.75, s * (Wd - 0.9), 0.3]])],
    ghosts: [[0, 2.4, Wd - 0.8]],
  }), boxes: (L, Wd) => [
    [0, -0.1, 0, 2 * L + 40, 0.1, 2 * Wd + 30, '#4a4a58'], [0, 3.3, 0, 2 * L + 12, 0.2, 2 * Wd + 4, '#c8c8c0'],
    ...each((s) => [
      [0, 0, s * (Wd + 0.5), 2 * L + 12, 3.3, 0.6, '#c8c4b8'],
      ...[-0.75, -0.25, 0.25, 0.75].map((u) => [u * L, 1.1, s * (Wd + 0.15), 1.6, 1.3, 0.1, '#e8f4ff', 0.9]),
      [s * (L + 2.5), 0, 0, 0.6, 3.3, 2 * Wd + 1, '#c8c4b8'], [s * (L + 2.15), 1.2, 0, 0.1, 1, 2.4, '#f4f4f4', 0.4],
      ...[-0.6, 0.15, 0.7].map((u) => [u * L, 0, s * (Wd - 0.9), 1.6, 0.75, 0.8, '#7a5a3a']), [s * L * 0.4, 0, s * (Wd - 1.5), 0.08, 1.4, 1.6, '#6a6a78'],
      ...[-0.5, 0.5].map((u) => [u * L, 3.25, 0, 1.2, 0.06, 0.3, '#ffffff', 1]),
    ]),
  ] },
};

function buildDuelMap(MAP, g) {
  const grp = new THREE.Group(), mats = new Map(), Wd = g.zr + 2.4;
  const matOf = (c, e) => { const k = c + e; if (!mats.has(k)) mats.set(k, new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: e })); return mats.get(k); };
  const boxG = new THREE.BoxGeometry(1, 1, 1), ballG = new THREE.SphereGeometry(0.5, 20, 14);
  for (const [x, y, z, w, h, d, c, e = 0.32, shape] of MAP.boxes(g.L, Wd)) {
    const m = new THREE.Mesh(shape === 'ball' ? ballG : boxG, matOf(c, e));
    m.scale.set(w, h, d); m.position.set(g.gx + x, g.gy + y + (shape === 'ball' ? 0 : h / 2), z);
    m.receiveShadow = true;
    grp.add(m);
  }
  if (MAP.deco) addDeco(grp, MAP.deco(g.L, Wd), g, matOf);
  // tout est immobile (sauf les fantômes) : les matrices sont calculées une fois, pas à chaque image (deux fois par image
  // en écran partagé)
  const moving = new Set(grp.userData.deco ? grp.userData.deco.ghosts : []);
  grp.updateMatrixWorld(true);
  grp.traverse((o) => { if (o !== grp && !moving.has(o) && !(o.parent && moving.has(o.parent))) { o.matrixAutoUpdate = false; o.matrixWorldAutoUpdate = false; } });
  return grp;
}

// les décorations d'Halloween (rien d'autre à charger, pas de nouvelle lumière) : les ampoules des guirlandes et les
// lueurs des citrouilles en deux nuages de points (un appel de dessin chacun), qui scintillent (animDeco) ; le fil ;
// les citrouilles (une boule orange, des yeux et une bouche sombres tournés vers le couloir) ; des fantômes en drap
function addDeco(grp, D, g, matOf) {
  const bulbs = [], wire = [], big = [];
  for (const [a, b, n, sag] of D.strings || []) {
    let prev = null;
    for (let k = 0; k <= n; k++) {
      const t = k / n, y = a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t);
      const p = [g.gx + a[0] + (b[0] - a[0]) * t, g.gy + y, a[2] + (b[2] - a[2]) * t];
      if (prev) wire.push(...prev, ...p);
      prev = p;
      if (k > 0 && k < n || n <= 6) bulbs.push([...p, BULBS[(bulbs.length * 3 + k) % BULBS.length]]);
    }
  }
  if (wire.length) {
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3));
    grp.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: '#1a1410' })));
  }
  const face = matOf('#1a0800', 0), orange = matOf('#e8781a', 0.55), stem = matOf('#4a6a2a', 0.3);
  const ballG = new THREE.SphereGeometry(0.5, 14, 10), boxG = new THREE.BoxGeometry(1, 1, 1);
  for (const [x, y, z, r] of D.pumpkins || []) {
    const p = new THREE.Group();
    const body = new THREE.Mesh(ballG, orange); body.scale.set(r * 2.2, r * 1.7, r * 2.2); body.position.y = r * 0.85;
    const st = new THREE.Mesh(boxG, stem); st.scale.set(r * 0.25, r * 0.4, r * 0.25); st.position.y = r * 1.75;
    p.add(body, st);
    for (const [fx, fy, w, h] of [[-0.32, 1.05, 0.32, 0.26], [0.32, 1.05, 0.32, 0.26], [0, 0.62, 0.8, 0.18]]) {
      const f = new THREE.Mesh(boxG, face); f.scale.set(r * w, r * h, r * 0.2); f.position.set(r * fx, r * fy, r * 1.08); p.add(f);
    }
    p.position.set(g.gx + x, g.gy + y, z);
    p.lookAt(g.gx, g.gy + y, Math.abs(x) > g.L ? z : 0); // la grimace vers le couloir
    grp.add(p);
    big.push([g.gx + x, g.gy + y + r * 0.9, z, '#ff8a1a']);
  }
  const sheet = new THREE.MeshLambertMaterial({ color: '#f4f0ff', emissive: '#c8c0ff', emissiveIntensity: 0.55, transparent: true, opacity: 0.85 });
  const ghosts = [];
  for (const [x, y, z] of D.ghosts || []) {
    const gh = new THREE.Group();
    const head = new THREE.Mesh(ballG, sheet); head.scale.setScalar(0.62); head.position.y = 0.55;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.46, 0.9, 10, 1, true), sheet); body.position.y = 0.05;
    gh.add(head, body);
    for (const ex of [-0.11, 0.11]) { const e = new THREE.Mesh(boxG, face); e.scale.set(0.07, 0.11, 0.05); e.position.set(ex, 0.6, 0.29); gh.add(e); }
    gh.position.set(g.gx + x, g.gy + y, z); gh.lookAt(g.gx, g.gy + y, 0);
    gh.userData = { y: g.gy + y, ph: ghosts.length * 2.1 };
    grp.add(gh); ghosts.push(gh);
  }
  const cloud = (list, size) => {
    const pos = [], col = [], base = [];
    for (const [x, y, z, c] of list) { pos.push(x, y, z); const cc = new THREE.Color(c); col.push(cc.r, cc.g, cc.b); base.push(cc.r, cc.g, cc.b); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: glowTex(), size, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
    pts.userData = { base, ph: list.map((_, k) => (k * 2.399) % 6.283) };
    grp.add(pts);
    return pts;
  };
  grp.userData.deco = { bulbs: bulbs.length ? cloud(bulbs, 0.55) : null, glows: big.length ? cloud(big, 1.4) : null, ghosts };
}

// le scintillement des guirlandes (chaque ampoule à son rythme, quelques-unes qui clignotent comme les vieilles), les
// citrouilles qui vacillent comme une bougie, les fantômes qui flottent
function animDeco(grp, t) {
  const D = grp.userData.deco;
  if (!D) return;
  for (const [pts, kind] of [[D.bulbs, 0], [D.glows, 1]]) {
    if (!pts) continue;
    const c = pts.geometry.attributes.color, { base, ph } = pts.userData;
    for (let k = 0; k < ph.length; k++) {
      const f = kind ? 0.75 + 0.25 * Math.sin(t * 11 + ph[k]) * Math.sin(t * 6.3 + ph[k] * 2) : (k % 7 === 3 ? (Math.sin(t * 2.2 + ph[k]) > 0 ? 1 : 0.15) : 0.7 + 0.3 * Math.sin(t * 1.7 + ph[k]));
      c.array[k * 3] = base[k * 3] * f; c.array[k * 3 + 1] = base[k * 3 + 1] * f; c.array[k * 3 + 2] = base[k * 3 + 2] * f;
    }
    c.needsUpdate = true;
  }
  for (const gh of D.ghosts) { gh.position.y = gh.userData.y + Math.sin(t * 1.6 + gh.userData.ph) * 0.18; gh.rotation.z = Math.sin(t * 1.1 + gh.userData.ph) * 0.08; }
}
