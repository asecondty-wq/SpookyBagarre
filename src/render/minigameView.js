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
import { DUEL, CANDY, HORSES, QUESTIONS, MORAL, DANCE, SURGERY, MG_INTRO, MG_PLAY, MG_WIN, MG_HURT, MG_RESUME, mgOutro, mgLeft, duelEye, duelHead, ULTI_NAMES } from '../sim/minigames.js';
import { EMOTES } from './rig/nativeMoves.js';
import { EXTRA_VIEWS } from './mg/index.js';
import { drawPuppet, warmPuppets } from './puppets.js';
import { COLORS } from '../sim/constants.js';
import { CHARS } from '../sim/chars/index.js';
import { Input } from '../core/input.js';
import { glowTex } from './materials.js';
import { portraitURL } from '../ui/hud.js';

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
  fps: {
    pad: [['stick', 'bouger'], ['rstick', 'viser'], ['A', 'tirer']],
    kb: [['lr', 'bouger'], ['down', 'se cacher'], ['up', 'viser la tête'], ['A', 'tirer']],
    kb1: [['lr', 'bouger'], ['down', 'se cacher'], ['up', 'viser la tête'], ['A', 'tirer'], ['mouse', 'viser']],
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
const TICKER = ['La bourse du % s\'envole', 'Météo : pluie de coups sur le ring', 'Un pigeon témoigne : « j\'ai tout vu »', 'Sondage : 98 % des fantômes veulent une revanche', 'Le cimetière affiche complet ce soir', 'Pénurie de mouchoirs dans la crypte'];

// l'animation des dégâts (drawHurt) : les coups (images après « EZ WIN ») et la part du % que chacun fait monter
const HURT_AT = [14, 32, 48, 62, 80], HURT_SHARE = [0.1, 0.25, 0.45, 0.68, 1];
const ease = (t) => 1 - (1 - t) * (1 - t);
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const lerp = (a, b, q) => a + (b - a) * q;
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
    this.key = null; this.fpsOn = false;
    this.time = 0;
    this.reset();
    this.pst = [{ state: '', t0: 0 }, { state: '', t0: 0 }];
    this.tmpV = new THREE.Vector3();
    for (const F of mv.W.list) portrait(F.char); // chargées d'avance
  }

  reset() {
    this.floats = []; this.banner = null; this.boardShake = [0, 0]; this.shown = [0, 0];
    this.hit = [{ t: 0, kill: 0 }, { t: 0, kill: 0 }]; this.hurt = [0, 0]; this.xp = [[], []]; this.hb = [null, null];
    this.feed = []; this.radar = [-9, -9]; this.shake = [0, 0]; this.recoil = [0, 0]; this.muzzle = [0, 0];
    this.ticker = ''; this.tickerT = 0; this.sayT = 0; this.ans = [null, null];
    this.parts = []; this.stickers = []; this.jx = { shake: 0, punch: 0, flash: 0, col: '#ffffff', lines: 0, hype: 0 };
    this.beatT = 0; this.lastSec = -1; this.lastBeat = -1; this.said = 0; this.hurtN = 0;
    this.dj = [null, null]; this.lane = [[0, 0, 0, 0], [0, 0, 0, 0]]; this.zapT = [0, 0];
    if (!this.toasts) this.toasts = [];
    this.rx = [null, null, null, null]; this.fanEm = [null, null]; // réactions des marionnettes (0, 1 : joueurs ; 2, 3 : patients)
    this.xs = {}; // l'état d'affichage libre du jeu en cours (src/render/mg/)
  }

  // --- la couche d'effets « TDAH » : particules, autocollants, secousses, coups de zoom, éclairs, lignes de vitesse --
  // (sur le canevas, en unités de la grille 640 x 360 ; rien de tout ça ne touche à la simulation)
  burst(x, y, n, colors, o = {}) {
    for (let i = 0; i < n && this.parts.length < 700; i++) {
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
      else { ctx.font = `${Math.round(p.s * 1.6)}px 'Apple Color Emoji','Segoe UI Emoji','Lilita One',sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.ch || '♥', 0, 0); }
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
    if (M && M.ph === 'play' && !(EXTRA_VIEWS[M.kind] && EXTRA_VIEWS[M.kind].countdown === false)) {
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

  get audio() { return this.mv.fx.audio; }
  pname(slot) { return (this.names[slot] || 'J' + (slot + 1)).slice(0, 10); }
  label(W, slot) { const F = W.fighters[slot]; return `${this.pname(slot)} · ${CHARS[F.char].name}`; }

  // --- les combattants pendant le duel au pistolet -------------------------------------------------------------
  // null : affiché comme d'habitude ; 'hide' : caché ; sinon le faux combattant à afficher à sa place
  proxy(F, W) {
    const M = W.mg;
    const XV = M && EXTRA_VIEWS[M.kind];
    if (XV && XV.proxy && M.ph === 'play') return XV.proxy(this, F, W, M);
    if (M && (M.ph === 'intro' || (M.ph === 'outro' && M.kind !== 'fps')) && (F.slot === M.a || F.slot === M.v)) return this.emoteProxy(F, W, M);
    if (!M || M.kind !== 'fps' || M.ph === 'intro') return null;
    const i = F.slot === M.a ? 0 : F.slot === M.v ? 1 : -1;
    if (i < 0) return 'hide';
    const g = M.g, P = g.p[i], p = Object.create(F);
    let state = P.dead > 0 ? (P.dead > DUEL.DEAD - 14 ? 'hitstun' : 'down') : P.flinch > 0 ? 'hitstun' : P.y > 0 ? 'air' : P.crouch ? 'crouch' : Math.abs(P.vz) > 1 ? 'walk' : 'idle';
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
  puppet(char, x, y, h, o) { return drawPuppet(this.g, char, x, y, h, o); }

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
        this.reset();
        this.jolt(1, 0.12, '#ffffff', 0.6); this.lines(0.6); this.hype(1); this.confetti(50);
        this.sticker('MINI-JEU !!', 320, 180, { size: 46, color: '#ffe24a', bg: '#ff2a6a', life: 0.7 });
        R.kick('flash', 0.7, { color: '#ffffff' }); R.kick('chroma', 1);
        this.mv.rig.shake(0.5);
        if (A) { A.sfx('bassDrop', 0, 1); A.sfx('airhorn', 0, 0.55); A.say(ULTI_NAMES[ev.k] + ' !', 0.45, 1.1); }
        break;
      case 'mgGo':
        R.kick('flash', 0.45);
        this.jolt(0.8, 0.1, TITLE_COL[ev.k], 0.35); this.lines(0.5); this.hype(0.8);
        this.sticker(this.pick(['GO GO GO !', 'C\'EST PARTI !', 'LET\'S GOOO']), 320, 180, { size: 40, color: '#ffffff', bg: '#ff2a2a', life: 0.8 });
        this.burst(320, 180, 40, ['#ffe24a', '#ff3b3b', '#ffffff'], { shape: 'star', speed: 320, size: 6 });
        if (A) { A.sfx('countGo', 0, 1); A.say({ fps: 'Feu !', candy: 'Sucrez-les !', horses: 'Faites vos jeux !', moral: 'Répandez l\'amour !' }[ev.k] || 'Go !', 0.55, 1.15); }
        break;
      // ---- duel au pistolet
      case 'mgShot': {
        const i = ev.s, o = 1 - i;
        this.recoil[i] = 1; this.muzzle[i] = 0.05; this.shake[i] = Math.max(this.shake[i], 0.3); this.radar[i] = this.time;
        this.tracer(W, i, ev);
        A && A.sfx('shotgun', 0, 0.7);
        { const cx = i === 0 ? 160 : 480; this.burst(cx + 70, 260, 1, ['#e8b030'], { shape: 'shell', dir: -1.2, spread: 0.4, speed: 200, g: 600, life: 0.8 }); this.burst(cx, 180, 6, ['#fff2a8', '#ffb030'], { shape: 'dot', speed: 120, size: 3, life: 0.2, g: 0 }); }
        this.jolt(0.18, 0.012);
        if (ev.r === 'head' || ev.r === 'body') {
          const cx = i === 0 ? 160 : 480, ox = i === 0 ? 480 : 160;
          this.burst(cx, 180, ev.r === 'head' ? 30 : 12, ['#ff2020', '#a00010', '#ffffff'], { speed: 220, size: 4, life: 0.5 });
          this.burst(ox, 180, 18, ['#c00010', '#7a0008'], { shape: 'dot', speed: 260, size: 9, life: 0.6, g: 500 });
          this.sticker(ev.r === 'head' ? this.pick(['HEADSHOT 🎯', 'BOOM 🎯', 'DANS LA TÊTE']) : this.pick(['+10', 'TOUCHÉ', 'PAF', 'BIM']), cx + (Math.random() - 0.5) * 60, 140, { size: ev.r === 'head' ? 22 : 14, color: ev.r === 'head' ? '#ff3030' : '#ffffff', life: 0.6 });
          this.jolt(ev.r === 'head' ? 0.8 : 0.35, ev.r === 'head' ? 0.06 : 0.02, ev.r === 'head' ? '#ff0000' : null, 0.2);
        }
        if (ev.r === 'head' || ev.r === 'body') {
          this.hit[i] = { t: 0.22, kill: ev.r === 'head' ? 1 : 0 };
          this.hurt[o] = 1; this.shake[o] = 1;
          this.xp[i].push({ text: ev.r === 'head' ? '+50 HEADSHOT' : '+10', t: 0, y: 0 });
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
        const k = ev.k, v = ev.v, g = M.g;
        this.hit[k] = { t: 0.4, kill: 1 };
        this.feed.unshift({ k: g.p[k].slot, v: g.p[v].slot, head: ev.head, t: 0 }); this.feed.length = Math.min(4, this.feed.length);
        const air = g.p[k].y > 0.3;
        let text = ev.head ? 'HEADSHOT' : 'ENNEMI ABATTU', sub = ev.head ? '+150' : '+100';
        if (air) { text = '360 NO SCOPE !!'; sub = '+500'; }
        else if (ev.streak >= 2) { text = STREAKS[Math.min(ev.streak, STREAKS.length - 1)]; sub = `+${100 * ev.streak}`; }
        this.hb[k] = { text, sub, t: 0, color: ev.head || air ? '#ff3030' : '#ffd23a' };
        this.hb[v] = { text: 'ABATTU', sub: `par ${this.pname(g.p[k].slot)}`, t: 0, color: '#ff3030' };
        R.kick('chroma', 1); R.kick('flash', 0.25, { color: ev.head ? '#ff2020' : '#ffffff' });
        const V = this.mv.views[g.p[v].slot]; if (V) V.impulse(-1.5);
        if (A) {
          A.sfx('bassDrop', 0, 0.8);
          if (ev.head || air) { A.sfx('splatter', 0, 1); A.sfx('airhorn', 0, 0.6); }
          A.say(air ? 'No scope !' : ev.streak >= 2 ? STREAKS[Math.min(ev.streak, STREAKS.length - 1)].toLowerCase() + ' !' : ev.head ? 'Headshot !' : 'Abattu !', 0.4, 1.05);
        }
        { const cx = k === 0 ? 160 : 480;
          this.sticker(air ? '360 NO SCOPE' : this.pick(['REKT', 'OWNED', 'SHEESH', 'GG EZ', 'NOOB', 'ÇA DÉGAGE', '💀💀💀']), cx, 80, { size: 30, color: '#ffffff', bg: ev.head || air ? '#ff2020' : '#ff9a1f', life: 1.1 });
          this.burst(cx, 180, 50, ['#ffe24a', '#ffffff', '#ff3b3b'], { shape: 'star', speed: 340, size: 6 });
          this.burst(cx, 140, 8, ['#fff'], { shape: 'txt', ch: this.pick(['💀', '🔥', '💯', '😵']), speed: 220, size: 14, life: 1.2 });
          this.jolt(1, 0.12, ev.head ? '#ff0000' : '#ffffff', 0.35); this.lines(0.5); this.hype(0.8);
          if (ev.head || air) this.emojiRain(['💀', '🎯', '🔥'], 14);
        }
        if (ev.n === DUEL.KILLS - 1) this.banner = { text: 'BALLE DE MATCH', color: COLORS[g.p[k].slot], t: 0, life: 1.4, y: 300, size: 26 };
        break;
      }
      case 'mgReload': A && A.sfx('click', 0, 0.8); if (ev.dry) A && A.sfx('error', 0, 0.3); break;
      case 'mgReloaded': A && A.sfx('clink', 0, 0.6); break;
      case 'mgSpawn': A && A.sfx('respawn', 0, 0.4); break;
      case 'mgJump': A && A.sfx('jump', 0, 0.5); break;
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
        // retour dans l'arène, tout figé 2 s : la caméra cadre le perdant qui va prendre son coup
        R.kick('flash', 0.5); this.banner = null;
        const L = ev.l >= 0 ? W.fighters[ev.l] : null;
        if (L) this.mv.rig.focusOn({ x: L.x, y: L.y + 1, z: L.z }, MG_RESUME / 60 + 0.6, 0.8);
        if (A) A.sfx('whoosh', 0, 0.6);
        break;
      }
      case 'mgStrike': {
        // la reprise : le perdant prend ses % et le coup (src/sim/minigames.js stepResume), la caméra le suit, la télé en parle
        R.kick('flash', 0.6, { color: ev.w >= 0 ? COLORS[ev.w] : '#ffffff' });
        const L = ev.l >= 0 ? W.fighters[ev.l] : null;
        if (L) { this.mv.rig.focusOn({ x: L.x, y: L.y + 1, z: L.z }, 1.1, 1); this.mv.rig.punchIn(1); this.mv.rig.shake(0.7); }
        if (A) { A.sfx('punchHeavy', 0, 1); A.sfx('go', 0, 0.6); }
        const tick = [...TICKER].sort(() => Math.random() - 0.5).slice(0, 3);
        if (L) {
          const lab = `${this.pname(ev.l)} (${CHARS[L.char].name})`.toUpperCase();
          tick.unshift(`${this.pname(ev.w)} déclare : « EZ »`);
          this.news = { t: 0, slot: ev.l, char: L.char, loser: 1, head: NEWS[ev.k](lab, ev.d), ticker: tick.join('   ·   ') };
        } else {
          const slot = W.list[0].slot;
          this.news = { t: 0, slot, char: W.fighters[slot].char, loser: 0, head: 'MATCH NUL : LA RÉDACTION S\'ENNUIE FERME', ticker: tick.join('   ·   ') };
        }
        if (A) { A.sfx('countHi', 0, 0.6); A.sfx('blip', 0, 0.5, 4); A.say('Flash info !', 0.5, 1.1); }
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

  // la présentation : un seul mouvement de caméra, de haut et de loin, qui plonge sur les deux duellistes face à face, puis
  // tourne doucement autour d'eux en contre-plongée en se rapprochant (le cadre penché se redresse)
  introCam(W, M) {
    const cam = this.R.camera, t = M.t / 60, A = W.fighters[M.a], V = W.fighters[M.v];
    const s = smooth(Math.min(1, t / 1.7)), after = Math.max(0, t - 1.7);
    // au plus près, les deux tiennent dans le cadre (un peu de marge de chaque côté), quelle que soit la forme de la fenêtre
    const tanH = Math.tan((cam.fov || 40) * Math.PI / 360) * (cam.aspect || 16 / 9);
    const mx = (A.x + V.x) / 2, my = (A.y + V.y) / 2, near = Math.max(4.5, (Math.abs(A.x - V.x) / 2 + 1.6) / tanH);
    const dist = lerp(near * 2.8, near * 1.12, s) * (1 - 0.06 * after), h = lerp(near * 1.1 + 4, 0.7, s), a = lerp(-0.95, 0.1, s) + after * 0.1;
    cam.position.set(mx + Math.sin(a) * dist, my + h, Math.cos(a) * dist);
    cam.lookAt(mx, my + lerp(0.5, 1.25, s), 0);
    cam.rotateZ(lerp(0.12, -0.03, s) + (this.jx.shake > 0 ? (Math.random() - 0.5) * this.jx.shake * 0.02 : 0));
  }

  say(text) { const A = this.audio; if (A) A.say(text, 0.5, 1.15); }
  tick(text) { this.ticker = text; this.tickerT = 0; }

  // --- chaque image -----------------------------------------------------------------------------------------------
  update(W, dt, alpha) {
    this.time += dt;
    const M = W.mg;
    const key = M ? `${M.kind}:${M.a}:${M.v}` : null;
    if (key !== this.key) { this.key = key; if (M) this.reset(); }
    const fpsOn = !!(M && M.kind === 'fps' && M.ph !== 'intro');
    if (fpsOn !== this.fpsOn) { this.fpsOn = fpsOn; if (fpsOn) this.enterFps(W, M); else this.exitFps(W); }
    if (fpsOn) this.updateFps(W, M, dt);
    if (M && M.ph === 'intro') {
      this.introCam(W, M);
      // la phrase du jeu, dite une fois le titre posé
      if (M.t >= 36 && !this.said) { this.said = 1; if (this.audio) this.audio.say(GOALS[M.kind], 0.5, 1.2); }
    }
    // les marionnettes du jeu sont rendues une fois pendant l'explication (leurs shaders se compilent là)
    if (M && M.ph === 'intro' && M.t > 20 && this.warmed !== key) {
      this.warmed = key;
      const XW = EXTRA_VIEWS[M.kind];
      warmPuppets(this.g, [W.fighters[M.a].char, W.fighters[M.v].char, ...((XW && XW.puppets) || [])]);
      // et les autres clés de ce jeu (le même perso deux fois, les patients du chirurgien)
      const ca = W.fighters[M.a].char, cv = W.fighters[M.v].char, more = [];
      if (ca === cv) more.push([cv, this.pkey(W, M, 1)]);
      if (M.kind === 'surgery') more.push([cv, 'pat0'], [ca, 'pat1']);
      for (const [c, key] of more) drawPuppet(this.g, c, -9999, -9999, 10, { key, shadow: false });
      if (XW && XW.warm) XW.warm(this, W, M);
    }
    // un jeu en 3D (src/render/mg/) : il entre dans la scène à la fin de l'explication et en sort à la fin de l'ulti
    const XV = M && EXTRA_VIEWS[M.kind], on3 = !!(XV && XV.enter3D && M.ph !== 'intro');
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
    if (M && M.kind !== 'fps' && M.ph !== 'intro' && !(XV && XV.gray === false)) this.R.fx.gray = Math.max(this.R.fx.gray, 0.6);
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
  build3D() {
    const stone = new THREE.MeshLambertMaterial({ color: '#7d7f88', emissive: '#1a1a22', emissiveIntensity: 0.5 });
    const dark = new THREE.MeshLambertMaterial({ color: '#3c3e48', emissive: '#0a0a10', emissiveIntensity: 0.5 });
    const group = new THREE.Group();
    // une tombe de 1 m de haut (mise à la hauteur voulue à l'entrée) : dalle, haut arrondi, croix, socle ; face à x
    const ROUND = 0.3, slabH = 1 - DUEL.COVER_W * ROUND;
    const tombs = [];
    for (let i = 0; i < 4; i++) {
      const t = new THREE.Group();
      const slab = new THREE.Mesh(new THREE.BoxGeometry(DUEL.COVER_W * 2, slabH, 0.3), stone);
      slab.position.y = slabH / 2;
      const top = new THREE.Mesh(new THREE.CylinderGeometry(DUEL.COVER_W, DUEL.COVER_W, 0.3, 20), stone);
      top.rotation.x = Math.PI / 2; top.scale.set(1, 1, ROUND); top.position.y = slabH;
      const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, 0.36), dark); c1.position.set(0, slabH * 0.62, 0);
      const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.09, 0.36), dark); c2.position.set(0, slabH * 0.72, 0);
      const base = new THREE.Mesh(new THREE.BoxGeometry(DUEL.COVER_W * 2.3, 0.14, 0.5), dark); base.position.y = 0.07;
      const pivot = new THREE.Group();
      pivot.add(slab, top, c1, c2);
      t.add(pivot, base);
      t.rotation.y = Math.PI / 2;
      t.userData = { pivot, tilt: 0 };
      tombs.push(t); group.add(t);
    }
    // traçantes
    const tracers = [];
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: '#ffe9a0', transparent: true, opacity: 0, depthWrite: false }));
      m.visible = false; group.add(m); tracers.push({ m, t: 0 });
    }
    // une caméra et un pistolet par tireur
    const metal = new THREE.MeshLambertMaterial({ color: '#2a2a30', emissive: '#0c0c12', emissiveIntensity: 0.6 });
    const wood = new THREE.MeshLambertMaterial({ color: '#6a3a1a', emissive: '#1a0a04', emissiveIntensity: 0.5 });
    const cams = [0, 1].map(() => {
      const cam = new THREE.PerspectiveCamera(58, 1, 0.08, 400);
      const gun = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.4), metal); body.position.set(0, 0, -0.12);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.32, 8), metal); barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.03, -0.42);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.19, 0.1), wood); grip.position.set(0, -0.11, 0.04); grip.rotation.x = -0.3;
      const sight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.03), metal); sight.position.set(0, 0.065, -0.3);
      const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: '#ffd77a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
      flash.scale.setScalar(0.55); flash.position.set(0, 0.03, -0.64);
      gun.add(body, barrel, grip, sight, flash);
      cam.add(gun);
      return { cam, gun, flash, pos: new THREE.Vector3(), look: new THREE.Vector3() };
    });
    for (const c of cams) group.add(c.cam);
    this.fps3 = { group, tombs, tracers, cams };
  }

  enterFps(W, M) {
    if (!this.fps3) this.build3D();
    const R = this.R, g = M.g, F3 = this.fps3;
    this.mv.root.add(F3.group);
    g.covers.forEach((c, i) => {
      const t = F3.tombs[i];
      t.position.set(c[0], g.gy, c[1]); t.userData.tilt = 0; t.userData.pivot.rotation.set(0, 0, 0); t.userData.pivot.scale.set(1, c[2], 1); t.visible = true;
    });
    F3.cams.forEach((c, i) => {
      const P = g.p[i], O = g.p[1 - i], E = duelEye(g, P);
      c.pos.set(E[0], E[1], E[2]); c.look.set(O.x, P.ay, P.az);
    });
    const views = (i) => this.mv.views[g.p[i].slot];
    const show = (i) => { for (let k = 0; k < 2; k++) { const V = views(k); if (V) V.root.visible = k !== i; } };
    R.split = [
      { cam: F3.cams[0].cam, x: 0, w: 0.5, before: () => show(0) },
      { cam: F3.cams[1].cam, x: 0.5, w: 0.5, before: () => show(1) },
    ];
    R.split.after = () => { for (let k = 0; k < 2; k++) { const V = views(k); if (V) V.root.visible = true; } };
    for (let i = 0; i < 2; i++) { const F = W.fighters[g.p[i].slot], V = this.mv.views[F.slot], p = this.proxy(F, W); if (V && p && p !== 'hide') V.snapTo(p); }
  }

  exitFps(W) {
    const R = this.R, F3 = this.fps3;
    if (F3) this.mv.root.remove(F3.group);
    R.split = null;
    for (const F of W.list) { const V = this.mv.views[F.slot]; if (V) V.snapTo(F); }
  }

  tracer(W, i, ev) {
    const F3 = this.fps3, M = W.mg;
    if (!F3 || !M) return;
    const tr = F3.tracers.find((t) => t.t <= 0) || F3.tracers[0];
    const c = F3.cams[i];
    const from = this.tmpV.set(0.26, -0.2, -0.7).applyMatrix4(c.cam.matrixWorld);
    const to = new THREE.Vector3(ev.x, ev.y, ev.z);
    const len = from.distanceTo(to);
    tr.m.position.copy(from).lerp(to, 0.5); tr.m.lookAt(to); tr.m.scale.set(0.03, 0.03, len);
    tr.t = 0.07; tr.m.visible = true; tr.m.material.opacity = 0.9;
  }

  updateFps(W, M, dt) {
    const R = this.R, g = M.g, F3 = this.fps3;
    const aspect = (window.innerWidth / 2) / Math.max(1, window.innerHeight);
    F3.cams.forEach((c, i) => {
      const P = g.p[i], O = g.p[1 - i], E = duelEye(g, P);
      const k = 1 - Math.exp(-dt * 30);
      let ey = E[1];
      if (P.dead > 0) ey = g.gy + 0.35; // à terre
      c.pos.x += (E[0] - c.pos.x) * k; c.pos.y += (ey - c.pos.y) * k; c.pos.z += (E[2] - c.pos.z) * k;
      c.look.x += (O.x - c.look.x) * k; c.look.y += (P.ay - c.look.y) * Math.min(1, k * 1.6); c.look.z += (P.az - c.look.z) * Math.min(1, k * 1.6);
      this.shake[i] = Math.max(0, this.shake[i] - dt * 3.5);
      this.recoil[i] = Math.max(0, this.recoil[i] - dt * 8);
      const s = this.shake[i] * 0.07;
      c.cam.position.set(c.pos.x + (Math.random() - 0.5) * s, c.pos.y + (Math.random() - 0.5) * s + Math.sin(this.time * 9) * Math.min(0.02, Math.abs(P.vz) * 0.004), c.pos.z + (Math.random() - 0.5) * s);
      c.cam.lookAt(c.look.x, c.look.y + this.recoil[i] * 0.12, c.look.z);
      if (P.dead > 0) c.cam.rotateZ(P.sd * 0.5);
      const fov = 58 + this.recoil[i] * 3;
      if (c.cam.aspect !== aspect || c.cam.fov !== fov) { c.cam.aspect = aspect; c.cam.fov = fov; c.cam.updateProjectionMatrix(); }
      c.gun.position.set(0.26, -0.22 + Math.sin(this.time * 2.1 + i) * 0.006 - (P.reload ? 0.15 : 0), -0.6 + this.recoil[i] * 0.08);
      c.gun.rotation.set(this.recoil[i] * 0.4 + (P.reload ? -0.6 : 0), 0.05, P.reload ? 0.5 : 0);
      c.gun.visible = P.dead <= 0;
      this.muzzle[i] = Math.max(0, this.muzzle[i] - dt);
      c.flash.material.opacity = this.muzzle[i] > 0 ? 1 : 0;
      c.flash.material.rotation = Math.random() * 6;
    });
    for (const t of F3.tracers) if (t.t > 0) { t.t -= dt; t.m.material.opacity = Math.max(0, t.t / 0.07) * 0.9; if (t.t <= 0) t.m.visible = false; }
    if (R.scene.fog && this.mv.fogBase) { R.scene.fog.near = this.mv.fogBase[0] + 10; R.scene.fog.far = this.mv.fogBase[1] + 24; }
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
    const w = window.innerWidth, h = window.innerHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
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
      if (!W.mgResume && !this.news && !this.toasts.length && !this.parts.length && !this.stickers.length) return;
      if (W.mgResume) this.drawResume(W, W.mgResume);
      this.drawNews(W, dt);
      this.drawFx(null, dt);
      this.drawToasts(dt);
      return;
    }
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
    if (M.ph === 'intro') this.drawIntro(W, M);
    // les touches des joueurs de ce PC, encore 3 s au début du jeu
    if (M.ph === 'play' && M.t < 200) this.drawKeys(W, M, 360 + this.oy - 16, Math.min(1, (200 - M.t) / 50));
    for (const f of this.floats) {
      const a = 1 - Math.max(0, (f.t - f.life * 0.6) / (f.life * 0.4));
      const sc = f.t < 0.12 ? 0.5 + f.t / 0.12 * 0.7 : 1.2 - Math.min(0.2, (f.t - 0.12));
      this.text(f.text, f.x, f.y - f.t * 26, f.size * sc, f.color, { alpha: a });
    }
    if (this.banner) {
      const b = this.banner, t = b.t;
      const sc = t < 0.15 ? 2.2 - t / 0.15 * 1.2 : 1 + Math.sin(t * 9) * 0.02;
      const a = Math.min(1, (b.life - t) / 0.3);
      this.text(b.text, 320, b.y ?? 96, (b.size || 52) * sc, b.color, { alpha: a, title: true });
      if (b.sub) this.text(b.sub, 320, (b.y ?? 96) + 40, 18, '#ffffff', { alpha: a });
    }
    if (M.ph === 'outro') this.drawWin(W, M);
    this.drawFx(M, dt);
    this.drawToasts(dt);
  }

  text(str, x, y, size, color, o = {}) {
    const ctx = this.g;
    ctx.save();
    ctx.globalAlpha = o.alpha ?? 1;
    ctx.font = `${o.bold ? '900 ' : ''}${Math.round(size)}px ${o.title ? "Creepster, 'Lilita One', fantasy" : o.mono ? "'Arial Black', Impact, sans-serif" : "'Lilita One', 'Trebuchet MS', sans-serif"}`;
    ctx.textAlign = o.align || 'center';
    ctx.lineJoin = 'round';
    if (o.stroke !== false) {
      ctx.lineWidth = Math.max(2, size / 7);
      ctx.strokeStyle = '#0b0610';
      ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
    ctx.restore();
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

  // la présentation (3,5 s) : bandes de cinéma, le titre qui claque, le but en une phrase (qui s'écrit), les touches de
  // chaque joueur de ce PC (selon sa manette ou son clavier), le compte à rebours. La caméra fait le reste (introCam).
  drawIntro(W, M) {
    const ctx = this.g, t = M.t / 60, col = TITLE_COL[M.kind], T = -this.oy, B = 360 + this.oy, L = -this.ox, Rr = 640 + this.ox;
    const bar = 48 * ease(Math.min(1, t / 0.35));
    ctx.fillStyle = '#000'; ctx.fillRect(L - 10, T - 10, Rr - L + 20, bar + 10); ctx.fillRect(L - 10, B - bar, Rr - L + 20, bar + 10);
    // en haut : qui contre qui, le compte à rebours
    if (t > 0.2) {
      const a = Math.min(1, (t - 0.2) * 5);
      this.text(this.label(W, M.a), 300, T + 22, 13, COLORS[M.a], { align: 'right', mono: true, alpha: a });
      this.text('VS', 320, T + 22, 16, '#ffffff', { title: true, alpha: a });
      this.text(this.label(W, M.v), 340, T + 22, 13, COLORS[M.v], { align: 'left', mono: true, alpha: a });
      const left = Math.max(0, (MG_INTRO - M.t) / 60);
      ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.globalAlpha = a;
      ctx.beginPath(); ctx.arc(Rr - 30, T + 22, 11, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (left / (MG_INTRO / 60))); ctx.stroke(); ctx.globalAlpha = 1;
    }
    // le titre
    if (t > 0.12) {
      const u = t - 0.12, sc = u < 0.16 ? 2.4 - u / 0.16 * 1.4 : 1 + this.beatPop * 0.03;
      ctx.save(); ctx.translate(320, 96); ctx.rotate(-0.03); ctx.scale(sc, sc);
      this.text(`${ICONS[M.kind]} ${TITLES[M.kind]}`, 0, 0, 34, col, { title: true });
      ctx.restore();
    }
    // le but, qui s'écrit, sur un bandeau
    const goal = GOALS[M.kind] || '', shown = Math.floor(Math.max(0, t - 0.45) * 48);
    if (shown > 0) {
      const lines = this.splitLines(goal, 560, 21), lh = 25, y0 = 262 - (lines.length - 1) * lh / 2;
      const a = Math.min(1, (t - 0.45) * 6);
      ctx.globalAlpha = 0.78 * a; ctx.fillStyle = '#0b0610'; ctx.fillRect(L - 10, y0 - 20, Rr - L + 20, lines.length * lh + 14);
      ctx.fillStyle = col; ctx.fillRect(L - 10, y0 - 20, Rr - L + 20, 2); ctx.fillRect(L - 10, y0 - 8 + lines.length * lh, Rr - L + 20, 2); ctx.globalAlpha = 1;
      let n = shown;
      lines.forEach((l, k) => { if (n > 0) this.text(l.slice(0, n), 320, y0 + k * lh, 21, '#ffffff'); n -= l.length + 1; });
    }
    if (t > 0.9) this.drawKeys(W, M, B - 13, Math.min(1, (t - 0.9) * 5));
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
    const ctx = this.g, K = KEYS[M.kind];
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

  // l'écran de victoire : la tête du gagnant en gros, « EZ WIN », puis (s'il y a un perdant) ses dégâts
  drawWin(W, M) {
    const r = M.res || {};
    if (r.d > 0 && M.t >= MG_WIN) { this.drawHurt(W, M, r); return; }
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

  // les dégâts du perdant : le gagnant lui met une série de coups (HURT_AT), son % monte coup après coup jusqu'au nouveau
  // total, puis « +42 % » claque. Sons et effets au passage de chaque coup (affichage seul : la simulation n'a que M.t).
  drawHurt(W, M, r) {
    const ctx = this.g, u = M.t - MG_WIN, t = M.t / 60, Wn = W.fighters[r.w], L = W.fighters[r.l], A = this.audio;
    const n = HURT_AT.filter((f) => u >= f).length, age = n ? u - HURT_AT[n - 1] : 99, last = n === HURT_AT.length;
    if (n !== this.hurtN) {
      if (n > (this.hurtN || 0)) {
        const big = last;
        this.burst(452, 190, big ? 40 : 18, ['#ff2020', '#ffe24a', '#ffffff'], { shape: 'star', speed: big ? 360 : 240, size: big ? 7 : 5 });
        this.burst(330, 196, 1, ['#fff'], { shape: 'txt', ch: this.pick(['👊', '💥', '🦶', '🖐️']), dir: 0, spread: 0.4, speed: 260, up: 0, g: 0, size: 20, life: 0.25 });
        this.sticker(big ? 'K.O. TECHNIQUE' : this.pick(['PAF', 'BIM', 'BAM', 'POW', 'SBAM']), 452 + (Math.random() - 0.5) * 80, 120 + (Math.random() - 0.5) * 30, { size: big ? 24 : 18, color: '#ffffff', bg: big ? '#ff2a2a' : null, life: 0.5, rot: (Math.random() - 0.5) * 0.4 });
        this.jolt(big ? 1 : 0.45, big ? 0.1 : 0.04, big ? '#ff0000' : null, big ? 0.35 : 0.12);
        if (A) { A.sfx(big ? 'punchHeavy' : this.pick(['hitM', 'hitL', 'slap']), 0, big ? 1 : 0.8, 1 + n * 0.3); if (big) { A.sfx('airhorn', 0, 0.5); A.crowd(); } }
      }
      this.hurtN = n;
    }
    const a = Math.min(1, u / 6); // pas de fondu à la fin : le flash du retour dans l'arène fait la coupe
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(6,2,12,0.96)'; ctx.fillRect(-this.ox - 10, -this.oy - 10, 660 + this.ox * 2, 380 + this.oy * 2);
    const flash = Math.max(0, 1 - age / 10);
    const gr = ctx.createRadialGradient(452, 190, 20, 452, 190, 300);
    gr.addColorStop(0, `rgba(255,40,40,${0.25 + flash * 0.4})`); gr.addColorStop(1, 'rgba(255,40,40,0)');
    ctx.fillStyle = gr; ctx.fillRect(-this.ox - 10, -this.oy - 10, 660 + this.ox * 2, 380 + this.oy * 2);
    // le gagnant (qui s'élance à chaque coup) et le perdant (qui encaisse, rougit, recule)
    const lunge = Math.max(0, 1 - age / 9);
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(200 + lunge * 50, 300, 54, 9, 0, 0, Math.PI * 2); ctx.ellipse(452, 300, 54, 9, 0, 0, Math.PI * 2); ctx.fill();
    this.puppet(Wn.char, 200 + lunge * 50, 300, 170, clipFor(Wn.char, { key: 'w' + r.w, emote: last && age > 20 ? 'win' : null, face: 'right', head: 1.9, rot: lunge * 0.25, squash: [1 + lunge * 0.15, 1 - lunge * 0.1], shadow: false }));
    this.puppet(L.char, 452 + flash * 22 + (Math.random() - 0.5) * flash * 8, 300, 170, { key: 'w' + r.l, state: n ? 'hitstun' : 'idle', kb: 100 + n * 30, face: 'left', head: 2 + flash * 0.4, rot: -flash * 0.2, tint: '#ff2020', tintK: flash * 0.8, shadow: false });
    // le compteur de % : de l'ancien total au nouveau, un morceau à chaque coup (la couleur vire au rouge comme au combat)
    const k = n ? HURT_SHARE[n - 1] : 0, pct = Math.round(L.damage + r.d * k), sc = 1 + flash * 0.5;
    const hot = Math.min(1, pct / 150), col = `rgb(255,${Math.round(240 - hot * 200)},${Math.round(220 - hot * 200)})`;
    // (en haut : les faux succès s'empilent en bas à droite)
    this.text(this.label(W, r.l), 452, 30, 14, COLORS[r.l], { mono: true });
    ctx.save(); ctx.translate(452, 72); ctx.rotate(-0.04); ctx.scale(sc, sc);
    this.text(`${pct} %`, 0, 0, 48, col, { title: true });
    ctx.restore();
    if (last) {
      const s2 = age < 8 ? 2.6 - age / 8 * 1.6 : 1 + Math.sin(t * 9) * 0.04;
      ctx.save(); ctx.translate(250, 326); ctx.rotate(-0.08); ctx.scale(s2, s2);
      this.text(`+${r.d} %`, 0, 0, 58, '#ff3030', { title: true });
      ctx.restore();
    }
    this.text(`${this.pname(r.w)} ENVOIE LA FACTURE`, 200, 30, 14, COLORS[r.w], { mono: true });
    ctx.restore();
  }

  // de retour dans l'arène, tout figé 2 s (le temps de reprendre ses esprits) : « PRÊTS ? » et l'anneau qui se vide ;
  // le perdant, cadré par la caméra, sait ce qui l'attend
  drawResume(W, R) {
    const ctx = this.g, left = R.t / MG_RESUME, u = 1 - left;
    const sc = u < 0.1 ? 2 - u / 0.1 : 1 + this.beatPop * 0.03;
    ctx.save(); ctx.translate(320, 70); ctx.scale(sc, sc);
    this.text('PRÊTS ?', 0, 0, 40, '#ffe24a', { title: true });
    ctx.restore();
    ctx.strokeStyle = '#0b0610'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(320, 116, 13, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#ffe24a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(320, 116, 13, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left); ctx.stroke();
    if (R.l >= 0) this.text(`${this.label(W, R.l)} va prendre ${R.d} %`, 320, 148, 14, '#ffffff', { mono: true, alpha: 0.6 + 0.4 * Math.sin(this.time * 10) });
  }

  // --- duel au pistolet : le HUD (une moitié d'écran chacun) ------------------------------------------------------
  drawFps(W, M, dt) {
    const ctx = this.g, g = M.g;
    const L = -this.ox, Rr = 640 + this.ox, T = -this.oy, B = 360 + this.oy, mid = 320;
    for (let i = 0; i < 2; i++) {
      const P = g.p[i], O = g.p[1 - i], x0 = i === 0 ? L : mid, x1 = i === 0 ? mid : Rr, cx = (x0 + x1) / 2;
      ctx.save();
      ctx.beginPath(); ctx.rect(x0, T, x1 - x0, B - T); ctx.clip();
      // sang à l'écran : plus on a pris, plus les bords rougissent
      const hurt = Math.max(this.hurt[i] * 0.7, (1 - P.hp / DUEL.HP) * 0.55);
      if (hurt > 0.01) {
        const gr = ctx.createRadialGradient(cx, 180, 40, cx, 180, 260);
        gr.addColorStop(0, 'rgba(160,0,0,0)'); gr.addColorStop(1, `rgba(170,0,0,${hurt})`);
        ctx.fillStyle = gr; ctx.fillRect(x0, T, x1 - x0, B - T);
      }
      if (P.dead > 0) {
        ctx.fillStyle = 'rgba(30,0,0,0.55)'; ctx.fillRect(x0, T, x1 - x0, B - T);
        this.text('ABATTU', cx, 150, 34, '#ff3030', { title: true });
        this.text(`par ${this.pname(O.slot)}`, cx, 182, 14, COLORS[O.slot]);
        this.text(`Retour dans ${Math.ceil(P.dead / 60 * 10) / 10}`, cx, 206, 11, '#e8dcc4');
      } else {
        // viseur qui s'écarte au tir et en mouvement ; rouge sur une tête
        const hd = duelHead(g, O), onHead = O.dead <= 0 && Math.hypot(P.az - hd[0], P.ay - hd[1]) < hd[2];
        const c = onHead ? '#ff2a2a' : '#ffffff';
        const gap = 4 + this.recoil[i] * 8 + Math.min(4, Math.abs(P.vz) * 0.6) + (P.y > 0 ? 4 : 0);
        const bars = [[cx - gap - 8, 179, 8, 2], [cx + gap, 179, 8, 2], [cx - 1, 180 - gap - 8, 2, 8], [cx - 1, 180 + gap, 2, 8]];
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; for (const [x, y, w, h] of bars) ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
        ctx.fillStyle = c; for (const [x, y, w, h] of bars) ctx.fillRect(x, y, w, h);
        // marque de touche
        const hm = this.hit[i];
        if (hm.t > 0) {
          hm.t -= dt;
          ctx.strokeStyle = hm.kill ? '#ff2020' : '#ffffff'; ctx.lineWidth = hm.kill ? 3 : 2;
          const r1 = 6, r2 = 13 + (hm.kill ? 4 : 0);
          ctx.beginPath();
          for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { ctx.moveTo(cx + sx * r1, 180 + sy * r1); ctx.lineTo(cx + sx * r2, 180 + sy * r2); }
          ctx.stroke();
        }
        // points qui montent
        this.xp[i] = this.xp[i].filter((e) => (e.t += dt) < 1);
        this.xp[i].forEach((e, n) => this.text(e.text, cx + 34, 160 - n * 13 - e.t * 10, 11, '#ffe24a', { alpha: 1 - e.t, align: 'left', mono: true }));
        // munitions (en bas à droite)
        const bx = x1 - 104, by = B - 46;
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(bx - 4, by - 4, 100, 40);
        this.text(String(P.ammo), bx + 30, by + 14, 26, P.ammo <= 1 ? '#ff4040' : '#ffffff', { align: 'right', mono: true });
        this.text('/ ∞', bx + 34, by + 18, 11, '#c8c8c8', { align: 'left', mono: true });
        this.text('PÉTOIRE .44', bx + 92, by + 3, 8, '#e8e8e8', { align: 'right', mono: true });
        for (let b = 0; b < DUEL.MAG; b++) { ctx.fillStyle = b < P.ammo ? '#f0d070' : 'rgba(255,255,255,0.18)'; ctx.fillRect(bx + 62 + b * 5, by + 14, 3, 12); }
        if (P.reload) {
          const q = 1 - P.reload / DUEL.RELOAD;
          this.text('RECHARGE', cx, 222, 11, '#ffffff', { mono: true });
          ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(cx - 40, 232, 80, 5);
          ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - 39, 233, 78 * q, 3);
        } else if (P.ammo <= 2) this.text('Recharge : saisie (E)', cx, 222, 9, '#ffd23a', { mono: true });
        // radar (en bas à gauche) : l'ennemi y paraît quand il tire
        const rx = x0 + 40, ry = B - 42, rr = 30;
        ctx.fillStyle = 'rgba(10,30,10,0.75)'; ctx.beginPath(); ctx.arc(rx, ry, rr, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(120,255,120,0.5)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(rx, ry, rr, 0, Math.PI * 2); ctx.moveTo(rx - rr, ry); ctx.lineTo(rx + rr, ry); ctx.moveTo(rx, ry - rr); ctx.lineTo(rx, ry + rr); ctx.stroke();
        const sw = this.time * 3;
        ctx.strokeStyle = 'rgba(140,255,140,0.8)'; ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + Math.cos(sw) * rr, ry + Math.sin(sw) * rr); ctx.stroke();
        ctx.fillStyle = '#ffe24a'; ctx.beginPath(); ctx.moveTo(rx, ry - 5); ctx.lineTo(rx - 4, ry + 4); ctx.lineTo(rx + 4, ry + 4); ctx.closePath(); ctx.fill();
        const seen = this.time - this.radar[1 - i] < 1.5 || O.dead > 0;
        if (seen) {
          const dxw = (O.x - P.x) * P.sd, dzw = (O.z - P.z) * P.sd; // devant = haut du radar, droite de l'écran = droite
          const s = rr / 14, px = rx + dzw * s * 3, py = ry - dxw * s;
          ctx.fillStyle = O.dead > 0 ? 'rgba(255,60,60,0.4)' : '#ff3030';
          ctx.beginPath(); ctx.arc(Math.max(rx - rr + 3, Math.min(rx + rr - 3, px)), Math.max(ry - rr + 3, py), 3.5, 0, Math.PI * 2); ctx.fill();
        }
        // bannière d'élimination
        const hb = this.hb[i];
        if (hb) {
          hb.t += dt;
          if (hb.t > 1.6) this.hb[i] = null;
          else {
            const s = hb.t < 0.1 ? 2 - hb.t * 10 : 1;
            this.text(hb.text, cx, 112, 22 * s, hb.color, { mono: true, alpha: Math.min(1, (1.6 - hb.t) * 3) });
            this.text(hb.sub, cx, 134, 13, '#ffe24a', { mono: true, alpha: Math.min(1, (1.6 - hb.t) * 3) });
          }
        }
      }
      // nom du joueur, PV
      this.text(this.pname(P.slot), x0 + 10, T + 52, 12, COLORS[P.slot], { align: 'left', mono: true });
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x0 + 10, T + 62, 70, 6);
      ctx.fillStyle = P.hp > 40 ? '#e8e8e8' : '#ff3030'; ctx.fillRect(x0 + 11, T + 63, 68 * Math.max(0, P.hp) / DUEL.HP, 4);
      ctx.restore();
    }
    // la séparation
    ctx.fillStyle = '#0b0610'; ctx.fillRect(mid - 2, T, 4, B - T);
    // le tableau des scores (en haut au milieu)
    const [a, b] = g.p;
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(250, T + 6, 140, 36);
    ctx.fillStyle = COLORS[a.slot]; ctx.fillRect(250, T + 6, 4, 36);
    ctx.fillStyle = COLORS[b.slot]; ctx.fillRect(386, T + 6, 4, 36);
    this.text(String(a.kills), 278, T + 24, 24, COLORS[a.slot], { mono: true });
    this.text(String(b.kills), 362, T + 24, 24, COLORS[b.slot], { mono: true });
    const left = this.secsLeft(M);
    this.text(`0:${String(left).padStart(2, '0')}`, 320, T + 20, 13, left <= 5 ? '#ff4040' : '#ffffff', { mono: true });
    this.text(`PREMIER À ${DUEL.KILLS}`, 320, T + 35, 7, '#c8c8c8', { mono: true });
    // le fil des éliminations (en haut à droite)
    this.feed = this.feed.filter((e) => (e.t += dt) < 5);
    this.feed.forEach((e, n) => {
      const y = T + 58 + n * 14, xr = Rr - 8;
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(xr - 150, y - 6, 150, 12);
      this.text(this.pname(e.v), xr - 4, y, 9, COLORS[e.v], { align: 'right', mono: true, stroke: false });
      this.text(e.head ? '☠ ⌐╦╦═─' : '⌐╦╦═─', xr - 62, y, 9, e.head ? '#ff4040' : '#ffffff', { align: 'center', mono: true, stroke: false });
      this.text(this.pname(e.k), xr - 146, y, 9, COLORS[e.k], { align: 'left', mono: true, stroke: false });
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
      this.text('A cravache · X boire', x, y + 66, 7, '#c8bad8', { mono: true, stroke: false });
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

  drawNews(W, dt) {
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
    const ok = this.puppet(N.char, cx + Math.sin(N.t * 3) * 2, y + 94, 62, clipFor(N.char, { key: 'w' + N.slot, emote: N.loser ? null : 'laugh_01', tint: N.loser ? '#2a50ff' : null, tintK: 0.2, head: 2.4, squash: [1.2 + Math.sin(N.t * 5) * 0.05, 0.92], rot: Math.sin(N.t * 3) * 0.04, shadow: false }));
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
    if (this.fps3) this.mv.root.remove(this.fps3.group);
    this.R.split = null;
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
