// « ALLER AU BAR » (menu principal) : le bar en 3D (src/render/barScene.js), tous les persos y traînent, animés. Le
// joueur promène le sien (ZQSD, flèches, stick), parle aux potes (A : une bulle, leurs répliques dans barLines.js) et
// trinque avec eux (X ou E) ; chaque bière fait tourner un peu plus la tête (la caméra tangue, l'image ondule, les pas
// dérivent), et ça redescend tout seul. Espace / Y : un selfie à deux, publié sur « toktok » (src/ui/toktok.js, affichage
// seul). Skanky, lui, raconte sa vie (des monologues). Bouclier : prendre la place d'un pote. Échap / Start, ou la porte : sortir.
// Rien ici ne passe par la simulation : les persos sont des FighterView posées à la main (comme la vitrine de sélection).
import * as THREE from 'three';
import { Input } from '../core/input.js';
import { CHARS, CHAR_ORDER } from '../sim/chars/index.js';
import { createFighter } from '../sim/fighter.js';
import { FighterView } from '../render/fighterView.js';
import { RIGS } from '../render/rig/chars.js';
import { EMOTES } from '../render/rig/nativeMoves.js';
import { Particles } from '../render/particles.js';
import { buildBar, ROOM, mug } from '../render/barScene.js';
import { LINES, WILD, ENOUGH, BARMAN } from './barLines.js';
import { VW, VH } from './pxgrid.js';
import { TokTok } from './toktok.js';
import { burst, flash } from './juice.js';

const GROUND = {};
const NO_W = { fighters: [], list: [], stage: { findLanding: () => GROUND, heightAt: () => 0 } };
const B_A = 0, B_X = 1, B_JUMP = 2, B_SHIELD = 3, B_START = 4, B_GRAB = 5; // index des boutons dans dev.cnt (input.js : BTN_BITS)
const MAX_BEERS = 8;    // au-delà, plus personne ne trinque avec toi
const FULL = 6;         // le tournis est au plus fort à 6 bières
const SOBER_RATE = 1 / 9; // bières « éliminées » par seconde
const TALK_R = 2.0;     // distance pour parler à quelqu'un
const SPEED = 4.3;      // m/s, stick à fond
const IDLE_FUN = ['laugh_01', 'laugh_02', 'agree', 'clap', 'cheer', 'greet_01'];
const TALK_FUN = ['laugh_01', 'agree', 'laugh_02', 'greet_01', 'select'];
// les potes qui ont leur petite scène (src/ui/barCine.js, chargé à la demande) : maintenir A près d'eux
const CINE = { nymano: 'souvenirs.txt', bido: 'une histoire d\'amour', jsan: '3 h 47', skanky: 'le casse du TER' };
const CINE_HOLD = 0.75; // secondes
const POSE_FUN = ['heart_pose', 'cheer', 'victory_celebration', 'greet_01', 'select', 'freaky']; // les poses du selfie

const wrapA = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

// un perso posé dans le bar : son modèle (FighterView) et un état de combat inventé (au sol, à l'arrêt ou en marche)
export class Actor {
  constructor(root, char, slot, x, z, yaw, label) {
    this.root = root; this.char = char;
    this.F = createFighter(slot, { char }, { x, y: 0, z, facing: 0 });
    this.view = new FighterView(root, this.F, label);
    this.view.snapTo(this.F);
    this.label = label;
    this.x = x; this.z = z; this.yaw = yaw; this.speed = 0;
    this.h = (RIGS[char] && RIGS[char].h) || 1.8;
    this.em = null; this.emT = 0; this.emEnd = 0; this.emLoop = false;
    this.tilt = [0, 0];
    this.mug = null;
  }
  get mixer() { return this.view.rigModel && this.view.rigModel.mixer; }
  // une animation ('select' et 'win' : celles du perso ; sans le clip, sa provocation ou rien), au plus `dur` secondes
  emote(name, loop = false, dur = 1e9) {
    const X = this.mixer;
    if (!X) return false;
    const E = EMOTES[this.char] || {};
    if (name === 'select' || name === 'win') name = E[name] && E[name].emote;
    if (name && !X.has(name)) name = (E.select && X.has(E.select.emote)) ? (loop ? (E.win && E.win.emote) : E.select.emote) : null;
    if (!name || !X.has(name)) return false;
    const C = X.clips[name];
    this.em = name; this.emT = C.t0; this.emStart = C.t0; this.emEnd = Math.min(C.t1, C.t0 + dur); this.emLoop = loop;
    return true;
  }
  stopEmote() { this.em = null; }
  hand(out) {
    const RM = this.view.rigModel, b = RM && RM.rig && RM.rig.bones && (RM.rig.bones['hand.R'] || RM.rig.bones['hand.L']);
    if (b) return b.getWorldPosition(out);
    return out.set(this.x + Math.sin(this.yaw) * 0.3, this.h * 0.6, this.z + Math.cos(this.yaw) * 0.3);
  }
  head(out) { return out.set(this.x, this.h * 1.05 + 0.25, this.z); }
  update(dt, t, stars = false) {
    const F = this.F;
    if (this.em) { this.emT += dt; if (this.emT >= this.emEnd) { if (this.emLoop) this.emT = this.emStart; else this.em = null; } }
    const moving = this.speed > 0.3;
    if (moving && this.em && !this.emLoop) this.em = null;
    const st = moving ? (this.speed > 3.2 ? 'run' : 'walk') : 'idle';
    if (F.state !== st) { F.state = st; F.st = 0; } else F.st++;
    F.x = this.x; F.y = this.y || 0; F.z = this.z; F.vx = this.speed; F.vz = 0; F.vy = 0;
    F.grounded = true; F.move = null; F.mf = 0; F.hitlag = 0; F.invuln = 0; F.intangible = 0; F.speedMul = 1;
    F.emote = this.em; F.emoteT = this.emT;
    F.facing = this.yaw;
    this.view.capture(F); this.view.capture(F);
    this.view.update(F, NO_W, dt, t, 1);
    // le regard est libre dans le bar (en combat il ne va qu'à gauche ou à droite) ; le tournis penche le corps
    this.view.root.rotation.set(this.tilt[0], this.yaw, this.tilt[1]);
    this.view.marker.visible = !!this.label;
    if (this.label) { this.view.marker.position.y = this.h + 0.5; this.view.marker.scale.set(2.6, 0.65, 1); } // « TOI », juste au-dessus de la tête
    if (this.view.cdRing) this.view.cdRing.visible = false;
    if (this.view.stars) {
      this.view.stars.visible = stars;
      if (stars) { this.view.stars.position.y = this.h + 0.3; this.view.stars.rotation.y = t * 4; }
    }
  }
  dispose() { this.view.dispose(); if (this.mug) this.root.remove(this.mug); }
}

export class Bar {
  constructor(app, layer, opts = {}) {
    this.app = app; this.opts = opts;
    const R = app.renderer;
    this.root = new THREE.Group();
    R.scene.add(this.root);
    this.scene = buildBar();
    this.root.add(this.scene.group);
    this.prevFog = R.scene.fog; this.prevBg = R.scene.background;
    R.scene.fog = new THREE.Fog(...this.scene.fog);
    R.scene.background = new THREE.Color(this.scene.bg);
    this.particles = new Particles(this.root);
    this.particles.camera = R.camera;
    this.t = 0;
    this.drunk = +(app.params.get('drunk') || 0); // (tests : &drunk=5)
    this.drinks = 0; this.talks = 0; this.talked = new Set();
    this.lines = {}; // chaque perso déroule ses répliques dans le désordre, sans se répéter avant d'avoir tout dit
    // le perso du joueur : le dernier joué au bar, sinon Pandrezz (&barchar=<id> pour les tests)
    let me = app.params.get('barchar') || app.settings.barChar || 'pandrezz';
    if (!CHARS[me]) me = 'pandrezz';
    const D = this.scene.door;
    this.player = new Actor(this.root, me, 0, D.x + 1.6, D.z, Math.PI / 2, 'TOI');
    this.vel = new THREE.Vector2();
    this.npcs = [];
    CHAR_ORDER.filter((c) => c !== me).forEach((c, i) => this.addNpc(c, i));
    this.lastCnt = new Map();
    this.readButtons(true); // les appuis d'avant (celui qui a ouvert le bar) ne comptent pas
    this.busy = 0; // le joueur trinque : il ne bouge pas
    this.events = []; // [temps, fn] : les moments d'un trinquage
    this.cam = { x: this.player.x, z: this.player.z, init: false };
    this.mono = null; this.monoI = 0; // le monologue en cours (Skanky), et lequel vient ensuite
    this.shot = null; // le selfie en cours
    this.selfieCam = new THREE.PerspectiveCamera(58, 1, 0.1, 80);
    this.v3 = new THREE.Vector3(); this.v3b = new THREE.Vector3();
    this.buildUI(layer);
    this.say(this.scene.barman, BARMAN.talk[1], 'Le barman', '#9dff3a', 3.5);
  }

  addNpc(char, i) {
    const S = this.scene.spots[i % this.scene.spots.length];
    const a = new Actor(this.root, char, i + 1, S[0], S[1], S[2]);
    const N = { a, spot: S, role: S[3], home: S[2], next: 2 + Math.random() * 8, face: 0, talkT: 0 };
    if (N.role === 'dance') a.emote('win', true) || a.emote('dance_01', true);
    this.npcs[i] = N;
    return N;
  }

  // ---- entrées --------------------------------------------------------------------------------------------------------
  readButtons(init = false) {
    const p = [0, 0, 0, 0, 0, 0];
    for (const d of Input.list()) {
      // une manette branchée après l'entrée dans le bar : ses appuis comptent dès le premier
      const last = this.lastCnt.get(d.id) || (init ? null : [0, 0, 0, 0, 0, 0]);
      if (last) for (let i = 0; i < 6; i++) if (d.cnt[i] > last[i]) p[i] = 1;
      this.lastCnt.set(d.id, d.cnt.slice());
    }
    return p;
  }
  stick() {
    let x = 0, y = 0;
    for (const d of Input.list()) {
      if (Math.hypot(d.mx || 0, d.my || 0) < 0.22) continue; // la zone morte des sticks
      x += d.mx; y += d.my;
    }
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    return [x, y];
  }

  // ---- l'interface : la jauge du tournis, les touches, la bulle, le nom du pote le plus proche ------------------------
  buildUI(layer) {
    const el = h('div', 'px bar-ui');
    el.innerHTML = `<div class="bar-keys txt"><b>ZQSD</b> / <b>flèches</b> / stick : bouger · <b>A</b> <b>J</b> <b>Entrée</b> clic gauche : parler (<b>maintenir</b> : sa scène) · <b>X</b> <b>K</b> <b>E</b> clic droit : trinquer · <b>Espace</b> / <b>Y</b> : selfie · <b>Shift</b> : sa place · <b>Échap</b> ou la porte : sortir</div>
      <div class="bar-prompt"></div><div class="bar-bubble"><span><b></b><em></em></span></div>`;
    layer.appendChild(el);
    this.ui = { el, prompt: el.querySelector('.bar-prompt'), bubble: el.querySelector('.bar-bubble') };
    this.tok = new TokTok(el);
    this.bubble = null;
  }

  // la grille 640x360 (pxgrid.js) : un point de la scène -> ses coordonnées dans la grille
  toGrid(v) {
    const k = Math.min(innerWidth / VW, innerHeight / VH), ox = (innerWidth - VW * k) / 2, oy = (innerHeight - VH * k) / 2;
    const p = this.app.renderer.project(v);
    return { x: (p.x - ox) / k, y: (p.y - oy) / k, vis: p.vis };
  }

  // une bulle au-dessus de `who` (un Actor, ou le barman)
  say(who, text, name, color, dur = 4.2) {
    const B = this.ui.bubble;
    B.querySelector('b').textContent = name;
    B.querySelector('b').style.color = color;
    B.querySelector('em').innerHTML = esc(text);
    B.classList.remove('bpop'); void B.offsetWidth; B.classList.add('bpop', 'on');
    this.bubble = { who, t: dur };
    this.app.audio.sfx('blabla', 0, 0.5);
  }

  // ---- ce qu'on fait avec les potes -----------------------------------------------------------------------------------
  nextLine(char) {
    const L = LINES[char];
    if (!L) return '…';
    let q = this.lines[char];
    if (!q || !q.length) {
      q = this.lines[char] = L.talk.map((s, i) => [Math.random(), i]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
      if (this.lastLine && this.lastLine[char] === q[0] && q.length > 1) q.push(q.shift());
    }
    const i = q.shift();
    (this.lastLine || (this.lastLine = {}))[char] = i;
    return L.talk[i];
  }

  // plus le joueur a bu, plus on lui dit des dingueries (barLines.js : WILD) : aucune à jeun, presque que ça vers 6 bières,
  // et de plus en plus folles (palier 2 dès 4,5 bières). own : celles du perso ([palier 1, palier 2]), sinon les communes
  wildLine(own) {
    const d = this.drunk;
    if (Math.random() >= Math.min(0.9, Math.max(0, (d - 0.8) / 5))) return null;
    let tier = d >= 4.5 ? 1 : 0;
    if (tier && Math.random() < 0.2) tier = 0;
    const pool = own && own[tier].length && Math.random() < 0.65 ? own[tier] : WILD._[tier];
    let line = pick(pool);
    if (line === this.lastWild && pool.length > 1) line = pool[(pool.indexOf(line) + 1) % pool.length];
    this.lastWild = line;
    return line;
  }

  talk(T) {
    if (T.barman) { this.say(this.scene.barman, this.wildLine(BARMAN.wild) || pick(BARMAN.talk), 'Le barman', '#9dff3a'); return; }
    const N = T.npc, a = N.a, def = CHARS[a.char];
    this.talked.add(a.char);
    // Skanky raconte sa vie : A pendant son monologue passe à la phrase suivante
    if (LINES[a.char] && LINES[a.char].monologues) {
      if (this.mono && this.mono.N === N) this.monoNext(); else this.startMono(N);
      return;
    }
    this.mono = null;
    const line = this.wildLine(WILD[a.char]) || this.nextLine(a.char);
    this.say(a, line, def.name, def.color);
    N.talkT = 4.5;
    if (N.role !== 'dance') a.emote(pick(TALK_FUN), false, 3.2);
    this.talks++; this.talked.add(a.char);
  }

  // un monologue : ses phrases l'une après l'autre dans la bulle (« ▸ » : il y a une suite) ; on s'éloigne, il s'arrête.
  // Quand on a bu, une dinguerie s'y glisse
  startMono(N) {
    const all = LINES[N.a.char].monologues;
    const lines = [...all[this.monoI++ % all.length]];
    const w = this.wildLine(WILD[N.a.char]);
    if (w) lines.splice(2 + Math.floor(Math.random() * (lines.length - 2)), 0, w);
    this.mono = { N, lines, i: 0 };
    this.monoSay();
  }
  monoSay() {
    const M = this.mono, a = M.N.a, def = CHARS[a.char], line = M.lines[M.i];
    const last = M.i === M.lines.length - 1, dur = 1.6 + line.length * 0.04;
    this.say(a, line + (last ? '' : ' ▸'), def.name, def.color, dur);
    M.N.talkT = dur + 0.6;
    if (M.i % 2 === 0) a.emote(pick(TALK_FUN), false, 2.6);
  }
  monoNext() {
    const M = this.mono;
    if (!M) return;
    if (++M.i >= M.lines.length) { this.mono = null; return; }
    this.monoSay();
  }

  // ---- le selfie à deux, publié sur toktok --------------------------------------------------------------------------
  // le joueur se colle à son pote, les deux se tournent vers l'appareil et prennent la pose ; une caméra à part cadre les
  // deux modèles en portrait (9:16), l'image part sur le téléphone (toktok.js)
  selfie(T) {
    if (this.busy > 0 || this.shot) return;
    const P = this.player;
    if (!T || !T.npc) { this.say(P, pick(['Faut quelqu\'un avec qui poser !', 'Un selfie tout seul ? Triste.', 'Approche-toi d\'un pote, d\'abord.']), 'Toi', '#ffd84a', 2.2); return; }
    const N = T.npc, a = N.a;
    this.mono = null;
    // l'appareil : devant le pote, du côté de la caméra du bar (la salle est ouverte de ce côté)
    const cam = this.app.renderer.camera;
    let dx = cam.position.x - a.x, dz = cam.position.z - a.z;
    const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
    // le joueur à côté (du côté où il est déjà), à 0,75 m
    let sx = -dz, sz = dx;
    if ((P.x - a.x) * sx + (P.z - a.z) * sz < 0) { sx = -sx; sz = -sz; }
    const to = { x: a.x + sx * 0.75, z: a.z + sz * 0.75 };
    const mx = (a.x + to.x) / 2, mz = (a.z + to.z) / 2;
    const top = Math.max(a.h, P.h);
    const c = { x: mx + dx * 2.75, y: top + 0.25, z: mz + dz * 2.75 };
    this.shot = { N, t: 0, from: { x: P.x, z: P.z }, to, c, look: { x: mx, y: top * 0.48, z: mz }, done: false };
    this.busy = 1.9;
    this.vel.set(0, 0);
    N.talkT = 2.2;
    this.app.audio.sfx('blip', 0, 0.6);
    this.say(a, pick(['Attends, je me recoiffe !', 'Prends mon bon profil.', 'Tu postes où, là ?', 'Cheese ! Enfin… fromage.', 'Hop, la pose !']), CHARS[a.char].name, CHARS[a.char].color, 1.6);
  }

  updateSelfie(dt) {
    const S = this.shot;
    if (!S) return;
    S.t += dt;
    const P = this.player, a = S.N.a;
    const k = Math.min(1, S.t / 0.35), e = k * k * (3 - 2 * k);
    P.x = S.from.x + (S.to.x - S.from.x) * e; P.z = S.from.z + (S.to.z - S.from.z) * e;
    // les deux regardent l'appareil, un peu tournés l'un vers l'autre
    const yawTo = (o) => Math.atan2(S.c.x - o.x, S.c.z - o.z);
    P.yaw += wrapA(yawTo(P) - P.yaw) * (1 - Math.exp(-dt * 14));
    S.N.selfieYaw = yawTo(a);
    if (!S.posed && S.t > 0.3) { S.posed = true; a.emote(pick(POSE_FUN), false, 2.2); P.emote(pick(['cheer', 'greet_01', 'heart_pose', 'select']), false, 2.0); }
    if (!S.done && S.t > 1.0) {
      S.done = true;
      const img = this.capture(S);
      this.app.audio.sfx('flash', 0, 0.9);
      flash(this.ui.el, '#ffffff', 0.75);
      burst(this.ui.el, 220, 120, 'CLIC !', { color: '#ffd84a', size: 80 });
      if (img) this.events.push([this.t + 0.45, () => { this.tok.post({ img, me: P.char, friend: a.char, drunk: this.drunk }); this.app.audio.sfx('pop', 0, 0.8); this.app.audio.sfx('heart', 0, 0.5); }]);
    }
    if (S.t > 1.9) { S.N.selfieYaw = undefined; this.shot = null; }
  }

  // la photo : la scène vue par l'appareil du selfie, recadrée en portrait (9:16) ; le tournis s'y voit aussi
  capture(S) {
    const R = this.app.renderer, c0 = R.camera, cam = this.selfieCam;
    cam.aspect = c0.aspect; cam.fov = 62;
    cam.position.set(S.c.x, S.c.y, S.c.z);
    cam.lookAt(S.look.x, S.look.y, S.look.z);
    const k = Math.min(1, this.drunk / FULL);
    cam.rotateZ(0.06 + k * 0.12 * Math.sin(this.t * 1.7)); // un selfie, c'est toujours un peu penché
    cam.updateProjectionMatrix();
    const mk = this.player.view.marker, mv = mk.visible;
    mk.visible = false;
    R.camera = cam;
    try {
      R.render(); // la même tâche que la copie : l'image est encore dans le tampon
      const src = R.gl.domElement;
      let w = Math.round(src.height * 9 / 16), hh = src.height;
      if (w > src.width) { w = src.width; hh = Math.round(w * 16 / 9); }
      const c = document.createElement('canvas');
      c.width = 270; c.height = 480;
      c.getContext('2d').drawImage(src, Math.round((src.width - w) / 2), Math.round((src.height - hh) / 2), w, hh, 0, 0, 270, 480);
      return c.toDataURL('image/jpeg', 0.86);
    } catch (e) { return null; } finally { R.camera = c0; mk.visible = mv; }
  }

  // la petite scène d'un pote : chargée à la demande (rien de plus au lancement du jeu)
  startCine(N) {
    if (this.cineLoading || this.cine) return;
    this.cineLoading = true;
    this.holdT = 0;
    this.app.audio.sfx('whoosh', 0, 0.6);
    import('./barCine.js').then((m) => {
      this.cineLoading = false;
      if (this.leaving || this.cine) return;
      this.mono = null;
      if (this.bubble) { this.ui.bubble.classList.remove('on'); this.bubble = null; }
      this.cineNpc = N;
      this.cine = new m.Cine(this, N.a.char);
    }).catch((e) => { this.cineLoading = false; console.error(e); });
  }
  endCine() {
    const S = this.cine.S, N = this.cineNpc;
    this.cine = null;
    this.readButtons();
    if (N && S.after) { const def = CHARS[N.a.char]; N.talkT = 3.5; this.say(N.a, pick(S.after), def.name, def.color, 3.4); }
  }

  drink(T) {
    if (this.busy > 0) return;
    const P = this.player;
    if (this.drunk >= MAX_BEERS - 0.5) {
      if (T.barman) this.say(this.scene.barman, pick(BARMAN.enough), 'Le barman', '#9dff3a');
      else { const def = CHARS[T.npc.a.char]; this.say(T.npc.a, pick(ENOUGH), def.name, def.color); T.npc.talkT = 3; }
      this.app.audio.sfx('error', 0, 0.6);
      return;
    }
    this.busy = 1.6;
    this.vel.set(0, 0);
    const other = T.barman ? null : T.npc.a;
    if (other) {
      const def = CHARS[other.char];
      T.npc.talkT = 3.2;
      this.say(other, this.wildLine(WILD[other.char]) || pick((LINES[other.char] || {}).toast || ['Santé !']), def.name, def.color, 3);
      other.emote('cheer', false, 2.4);
      this.giveMug(other);
      this.talked.add(other.char);
    } else this.say(this.scene.barman, pick(BARMAN.serve), 'Le barman', '#9dff3a', 3);
    P.emote('cheer', false, 2.4);
    this.giveMug(P);
    const clinkAt = this.t + 0.45, glugAt = this.t + 0.95;
    this.events.push([clinkAt, () => {
      this.app.audio.sfx('clink', 0, 0.9);
      const p = P.hand(this.v3);
      if (other) p.lerp(other.hand(this.v3b), 0.5);
      this.particles.sparks(p.x, p.y + 0.15, p.z, 14, '#fff2c0', 4, 0.3);
      this.particles.burst('drop', p.x, p.y + 0.2, p.z, 14, '#f4b030', { speed: 2.6, g: 9, life: 0.6, s: 0.8 });
    }]);
    this.events.push([glugAt, () => { this.app.audio.sfx('glug', 0, 0.9); }]);
    this.events.push([this.t + 1.35, () => {
      this.drunk = Math.min(MAX_BEERS, this.drunk + 1);
      this.drinks++;
      this.app.audio.sfx('gulp', 0, 0.7);
    }]);
    this.events.push([this.t + 1.9, () => { this.takeMug(P); if (other) this.takeMug(other); }]);
  }

  giveMug(a) { if (!a.mug) { a.mug = mug(); a.mug.scale.setScalar(1.7); this.root.add(a.mug); } } // une grosse chope (dessin animé)
  takeMug(a) { if (a.mug) { this.root.remove(a.mug); a.mug = null; } }

  // prendre la place d'un pote : on échange les deux modèles
  swap(T) {
    if (T.barman || this.busy > 0) return;
    const N = T.npc, P = this.player;
    const mine = P.char, theirs = N.a.char;
    const px = P.x, pz = P.z, pyaw = P.yaw, nx = N.a.x, nz = N.a.z;
    P.dispose(); N.a.dispose();
    this.player = new Actor(this.root, theirs, 0, px, pz, pyaw, 'TOI');
    N.a = new Actor(this.root, mine, N.a.F.slot, nx, nz, N.home);
    if (N.role === 'dance') N.a.emote('win', true);
    this.app.settings.barChar = theirs;
    try { this.app.saveSettings(); } catch (e) { /* */ }
    for (const a of [this.player, N.a]) { this.particles.sparks(a.x, 1.1, a.z, 26, '#c8a0ff', 6); this.particles.dust(a.x, 0, a.z, 10); }
    this.app.audio.sfx('poof', 0, 0.7);
    const def = CHARS[mine];
    this.say(N.a, 'Hé ! Rends-moi mon corps !', def.name, def.color, 2.5);
  }

  // le pote (ou le barman) à qui on s'adresse : le plus proche à portée
  target() {
    const P = this.player;
    let best = null, bd = TALK_R;
    for (const N of this.npcs) {
      const d = Math.hypot(N.a.x - P.x, N.a.z - P.z);
      if (d < bd) { bd = d; best = { npc: N, d }; }
    }
    // le barman : au comptoir, près de lui (le milieu, entre les pompes à bière)
    const C = this.scene.counter, front = C.z + C.d / 2;
    const dc = Math.max(0, P.z - front - 0.15) + Math.max(0, Math.abs(P.x - 0.4) - 1.8) * 0.8;
    if (dc < 0.9 && (!best || bd > 1.3)) best = { barman: true, d: dc }; // un pote tout près passe avant
    return best;
  }

  // ---- chaque image -----------------------------------------------------------------------------------------------------
  update(dt) {
    // une petite scène (barCine.js) : le bar attend derrière ; Échap / Start (ou retour) la passe
    if (this.cine) {
      const b = this.readButtons();
      const skip = (b[B_START] || Input.list().some((d) => d.menu.back)) && this.cine.t > 0.6;
      this.cine.update(dt, skip);
      if (this.cine.done) this.endCine();
      return;
    }
    this.t += dt;
    const t = this.t, P = this.player;
    this.scene.update(dt, t);
    const btn = this.readButtons();
    if (!btn[B_JUMP] && Input.list().some((d) => d.menu.confirm)) btn[B_A] = 1; // Entrée aussi (Espace, c'est le selfie)
    if ((btn[B_START]) && !this.leaving) { this.leaving = true; if (this.opts.onExit) this.opts.onExit(); }

    // le tournis : il redescend tout seul
    this.drunk = Math.max(0, this.drunk - SOBER_RATE * dt);
    const k = Math.min(1, this.drunk / FULL);

    // déplacements (qui dérivent quand on a bu)
    this.busy = Math.max(0, this.busy - dt);
    let [mx, my] = this.stick();
    if (this.busy > 0 || this.leaving) { mx = 0; my = 0; }
    let dx = mx, dz = -my;
    if (k > 0) {
      const a = k * (0.4 * Math.sin(t * 0.63) + 0.22 * Math.sin(t * 1.71)); // jusqu'à 35° de travers
      const c = Math.cos(a), s = Math.sin(a);
      [dx, dz] = [dx * c - dz * s, dx * s + dz * c];
      if (this.busy <= 0 && !this.leaving) { // les pas qui partent tout seuls, même à l'arrêt
        const lurch = Math.max(0, k - 0.15) * 0.26; // des petits pas de côté, en avant, en arrière : on tangue sur place
        dx += lurch * Math.sin(t * 0.9 + 2 * Math.sin(t * 0.37)); dz += lurch * Math.sin(t * 0.7 + 1.5 * Math.cos(t * 0.29));
      }
    }
    const resp = 1 - Math.exp(-dt * (11 - 7 * k));
    this.vel.x += (dx * SPEED - this.vel.x) * resp;
    this.vel.y += (dz * SPEED - this.vel.y) * resp;
    P.x += this.vel.x * dt; P.z += this.vel.y * dt;
    this.collide(P);
    P.speed = Math.hypot(this.vel.x, this.vel.y);
    if (P.speed > 0.4 && this.busy <= 0) {
      const want = Math.atan2(this.vel.x, this.vel.y);
      P.yaw += wrapA(want - P.yaw) * (1 - Math.exp(-dt * 12));
    }
    P.tilt = [k * 0.09 * Math.sin(t * 0.9), k * 0.15 * Math.sin(t * 1.3 + 0.6)];

    // à qui on parle, ce qu'on fait
    const T = this.leaving ? null : this.target();
    if (T && this.busy <= 0) {
      if (btn[B_A]) this.talk(T);
      else if (btn[B_JUMP]) this.selfie(T);
      else if (btn[B_X] || btn[B_GRAB]) this.drink(T);
      else if (btn[B_SHIELD] && T.npc) this.swap(T);
    }
    if (!T && btn[B_JUMP] && this.busy <= 0 && !this.leaving) this.selfie(null);
    // A maintenu près de Nymano, BIDO, J'san ou Skanky : leur scène
    const holding = Input.list().some((d) => d.held & 1);
    if (T && T.npc && CINE[T.npc.a.char] && holding && this.busy <= 0 && !this.shot) {
      this.holdT = (this.holdT || 0) + dt;
      if (this.holdT >= CINE_HOLD) this.startCine(T.npc);
    } else this.holdT = 0;
    this.updateSelfie(dt);
    if (T && this.busy > 0 && T.npc && !this.shot) { const N = T.npc; P.yaw += wrapA(Math.atan2(N.a.x - P.x, N.a.z - P.z) - P.yaw) * (1 - Math.exp(-dt * 10)); }
    for (let i = this.events.length - 1; i >= 0; i--) if (t >= this.events[i][0]) { const f = this.events[i][1]; this.events.splice(i, 1); f(); }

    // sortir par la porte
    const D = this.scene.door;
    if (!this.leaving && P.x < ROOM.x0 + 0.75 && Math.abs(P.z - D.z) < D.w / 2) { this.leaving = true; if (this.opts.onExit) this.opts.onExit(); }

    // les potes : ils vivent leur vie, se tournent vers toi quand tu approches ou leur parles
    for (const N of this.npcs) {
      const a = N.a;
      N.talkT = Math.max(0, N.talkT - dt);
      const d = Math.hypot(P.x - a.x, P.z - a.z);
      const toP = Math.atan2(P.x - a.x, P.z - a.z);
      let want = N.home;
      if (N.selfieYaw !== undefined) want = N.selfieYaw;
      else if (N.talkT > 0) want = toP;
      else if (d < 2.4 && N.role !== 'dance') want = N.home + wrapA(toP - N.home) * 0.55;
      a.yaw += wrapA(want - a.yaw) * (1 - Math.exp(-dt * 5));
      if (N.role === 'dance') { if (!a.em) a.emote('win', true) || a.emote('dance_01', true); }
      else if ((N.next -= dt) <= 0 && !a.em && N.talkT <= 0) {
        N.next = 6 + Math.random() * 10;
        a.emote(N.role === 'darts' ? 'cheer' : pick(IDLE_FUN), false, 4);
      }
      a.speed = 0;
      a.update(dt, t);
    }
    P.update(dt, t, k > 0.66);
    // les chopes suivent la main
    for (const a of [P, ...this.npcs.map((N) => N.a)]) {
      if (!a.mug) continue;
      a.hand(a.mug.position);
      a.mug.position.y -= 0.2;
      a.mug.rotation.set(0, a.yaw, 0);
    }
    // le barman regarde le joueur quand il s'approche du comptoir
    const bm = this.scene.barman;
    bm.userData.look = P.z < -1 ? Math.max(-0.9, Math.min(0.9, Math.atan2(P.x - bm.position.x, P.z - bm.position.z))) : undefined;
    this.particles.update(dt);

    this.updateCamera(dt, k);
    this.updateUI(dt, T, k);
  }

  collide(P) {
    const B = this.scene.blockers, r = 0.38;
    P.x = Math.max(ROOM.x0 + r, Math.min(ROOM.x1 - r, P.x));
    P.z = Math.max(ROOM.z0 + r, Math.min(ROOM.z1 - 0.6, P.z));
    // la porte : on peut s'y engager (sortir), pas ailleurs dans le mur
    for (const [x0, z0, x1, z1] of B.boxes) {
      if (P.x > x0 - r && P.x < x1 + r && P.z > z0 - r && P.z < z1 + r) {
        const pushes = [[P.x - (x0 - r), 0], [(x1 + r) - P.x, 1], [P.z - (z0 - r), 2], [(z1 + r) - P.z, 3]].sort((a, b) => a[0] - b[0]);
        const [, side] = pushes[0];
        if (side === 0) P.x = x0 - r; else if (side === 1) P.x = x1 + r; else if (side === 2) P.z = z0 - r; else P.z = z1 + r;
      }
    }
    const circ = [...B.circles, ...this.npcs.map((N) => [N.a.x, N.a.z, 0.42])];
    for (const [cx, cz, cr] of circ) {
      const dx = P.x - cx, dz = P.z - cz, d = Math.hypot(dx, dz), m = cr + r;
      if (d < m && d > 1e-4) { P.x = cx + dx / d * m; P.z = cz + dz / d * m; }
    }
  }

  updateCamera(dt, k) {
    const cam = this.app.renderer.camera, P = this.player, t = this.t;
    const tx = Math.max(-6.2, Math.min(6.2, P.x)), tz = Math.max(-2.4, Math.min(4.6, P.z));
    const C = this.cam;
    if (!C.init) { C.x = tx; C.z = tz; C.init = true; }
    const f = 1 - Math.exp(-dt * 3.2);
    C.x += (tx - C.x) * f; C.z += (tz - C.z) * f;
    // le tournis : la caméra tangue (roulis, balancement, le champ qui respire), sans jamais perdre le perso de vue
    const sx = k * 0.7 * Math.sin(t * 0.71), sy = k * 0.35 * Math.sin(t * 1.13);
    cam.position.set(C.x + sx, 6.4 + sy, C.z + 9.8);
    cam.lookAt(C.x + sx * 0.4, 1.25, C.z - 2.0);
    cam.rotateZ(k * (0.07 * Math.sin(t * 0.83) + 0.025 * Math.sin(t * 2.1)));
    const fov = 40 + k * 2.4 * Math.sin(t * 0.77);
    if (Math.abs(cam.fov - fov) > 1e-3) { cam.fov = fov; cam.updateProjectionMatrix(); }
    const fx = this.app.renderer.fx;
    fx.wave = k;
    fx.chroma = Math.max(fx.chroma, 0.0028 * k);
  }

  updateUI(dt, T, k) {
    const U = this.ui;
    // le nom de celui à qui on s'adresse, à ses pieds (au-dessus de la tête, il cacherait le « TOI » du joueur, juste à côté)
    const pr = U.prompt;
    if (T && this.busy <= 0) {
      const p = T.barman ? this.v3.set(this.scene.barman.position.x, 2.45, this.scene.barman.position.z) : this.v3.set(T.npc.a.x, 0, T.npc.a.z + 0.35);
      const g = this.toGrid(p);
      const key = T.barman ? 'barman' : T.npc.a.char;
      if (pr.dataset.key !== key) {
        pr.dataset.key = key;
        const name = T.barman ? 'Le barman' : CHARS[T.npc.a.char].name, color = T.barman ? '#9dff3a' : CHARS[T.npc.a.char].color;
        pr.innerHTML = `<b style="color:${color}">${esc(name)}</b><span><i class="ka">A</i> parler · <i class="kx">X</i> trinquer${T.barman ? '' : ' · <i class="ky">Y</i> selfie · <i>⇆</i> sa place'}</span>${!T.barman && CINE[T.npc.a.char] ? `<span class="cine-h">maintiens <i class="ka">A</i> : ✦ ${esc(CINE[T.npc.a.char])}<u></u></span>` : ''}`;
      }
      pr.style.transform = `translate(${Math.round(g.x)}px, ${Math.round(Math.min(g.y, VH - 62))}px)`; // jamais sur les touches, en bas
      pr.style.setProperty('--hold', Math.min(1, (this.holdT || 0) / CINE_HOLD).toFixed(3));
      pr.classList.toggle('on', g.vis && (this.holdT > 0.05 || !(this.bubble && this.bubble.who === (T.barman ? this.scene.barman : T.npc.a))));
      pr.classList.toggle('feet', !T.barman);
    } else pr.classList.remove('on');
    // la bulle suit celui qui parle
    const B = this.bubble;
    if (B) {
      B.t -= dt;
      const who = B.who;
      const p = who === this.scene.barman ? this.v3.set(who.position.x, 2.5, who.position.z) : who.head(this.v3);
      const far = who !== this.scene.barman && Math.hypot(who.x - this.player.x, who.z - this.player.z) > 5;
      const g = this.toGrid(p);
      const x = Math.max(70, Math.min(VW - 70, g.x)), y = Math.max(40, Math.min(VH - 30, g.y));
      U.bubble.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      if (B.t <= 0 || far || !g.vis) {
        U.bubble.classList.remove('on'); this.bubble = null;
        const M = this.mono;
        if (M && (M.N.a !== who || far)) this.mono = null; // parti, ou quelqu'un d'autre a parlé : fin du monologue
        else if (M && B.t <= 0) this.monoNext();
      }
    } else if (this.mono && !this.shot) this.mono = null;
    this.tok.update(dt);
  }

  dispose() {
    const R = this.app.renderer;
    if (this.cine && !this.cine.done) this.cine.dispose();
    this.player.dispose();
    for (const N of this.npcs) N.a.dispose();
    this.scene.dispose();
    R.scene.remove(this.root);
    R.scene.fog = this.prevFog || null;
    R.scene.background = this.prevBg || null;
    R.fx.wave = 0;
    R.camera.fov = 38; R.camera.updateProjectionMatrix();
    if (this.tok) this.tok.dispose();
    if (this.ui) this.ui.el.remove();
  }
}
