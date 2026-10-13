// Juice: turns simulation events into blood, sparks, shakes, flashes, slow-mo feel, popup texts, rumble and sounds.
import * as THREE from 'three';
import { COLORS } from '../sim/constants.js';
import { CHARS } from '../sim/chars/index.js';
import { commentate } from '../audio/commentator.js';

const v3 = new THREE.Vector3();

export class FX {
  constructor({ renderer, rig, particles, decals, views, popups, audio, rumble, settings }) {
    Object.assign(this, { renderer, rig, particles, decals, views, popups, audio, rumble, settings });
    this.blood = settings ? settings.blood ?? 3 : 3;
  }

  view(s) { return this.views[s]; }

  handle(ev, W) {
    const P = this.particles, R = this.renderer, A = this.audio;
    const B = this.blood;
    const bloodColor = B === 1 ? '#c81818' : '#7a0008';
    if (this.settings ? this.settings.commentator !== false : true) commentate(ev, W, A);
    switch (ev.type) {
      case 'hit': {
        const kb = ev.kb || 0, d = ev.d || 0;
        const V = this.view(ev.s), Av = ev.a >= 0 ? this.view(ev.a) : null;
        const dir = [ev.lx || 0, ev.ly || 0, ev.lz || 0];
        const m = Math.hypot(dir[0], dir[1], dir[2]) || 1;
        const nd = [dir[0] / m, dir[1] / m, dir[2] / m];
        const strong = kb > 95 || ev.smash;
        if (V) { V.flash(strong ? '#ffffff' : '#ffd0c0', strong ? 0.14 : 0.08); V.impulse(strong ? -3.5 : -1.6); }
        if (Av) Av.impulse(1.2);
        if (B > 0) {
          const n = Math.floor((4 + d * 3.2) * (ev.b ?? 1) * (B === 3 ? 1.6 : B === 2 ? 1 : 0.5));
          P.blood(ev.x, ev.y, ev.z, nd, n, 0.7 + Math.min(1.6, kb / 90));
          if (strong && B >= 2) P.blood(ev.x, ev.y, ev.z, [-nd[0], 0.5, -nd[2]], Math.floor(n * 0.5), 0.9);
          if (this.decals && B >= 2 && d > 4) this.decals.splat(ev.x + nd[0] * 0.8, ev.z + nd[2] * 0.8, 0.6 + d * 0.05, bloodColor);
        }
        const sparkC = ev.fx === 'zap' ? '#a8f0ff' : ev.fx === 'cheese' ? '#ffe28a' : ev.beat ? '#ffd23a' : '#fff4c0';
        P.sparks(ev.x, ev.y, ev.z, strong ? 26 : 10, sparkC, strong ? 14 : 8);
        if (strong) P.shockRing(ev.x, ev.y, ev.z, '#ffffff', 1 + kb / 120, 0.3);
        if (ev.fx === 'cheese') P.burst('flake', ev.x, ev.y, ev.z, 14, '#f2d77a', { speed: 5 });
        if (ev.fx === 'slime') P.burst('drop', ev.x, ev.y, ev.z, 30, '#9aff4a', { speed: 6 });
        if (ev.fx === 'ketchup') { P.burst('drop', ev.x, ev.y, ev.z, 40, '#d0141a', { speed: 8 }); P.burst('drop', ev.x, ev.y, ev.z, 20, '#f0c020', { speed: 7 }); }
        if (ev.fx === 'stamp') { this.popups.text('49.3 !', ev.x, ev.y + 1.5, ev.z, '#ff3030', 1.6); }
        // screen juice
        this.rig.shake(Math.min(0.9, 0.12 + kb / 220 + d / 60));
        if (strong) {
          this.rig.punchIn(Math.min(1, kb / 140));
          R.kick('chroma', 1 + kb / 100);
          R.kick('radial', Math.min(1.6, kb / 110), { c: this.toScreen(ev.x, ev.y, ev.z) });
          if (kb > 130 || ev.smash) R.kick('impact', 1);
        }
        if (ev.beat) this.popups.text('TUNG !', ev.x, ev.y + 1.2, ev.z, '#ffd23a', 1.1);
        if (kb > 150) this.popups.text(['BOUM !', 'CRAC !', 'SPLATCH !', 'AÏE !'][Math.floor(Math.random() * 4)], ev.x, ev.y + 1, ev.z, '#ffffff', 1.3);
        A && A.hit(ev.sfx, d, kb, this.pan(ev.x));
        if (this.rumble) { this.rumble(ev.s, 0.3 + kb / 180, 0.4 + d / 25, 90 + kb); if (ev.a >= 0) this.rumble(ev.a, 0.1 + kb / 400, 0.3, 60); }
        break;
      }
      case 'shieldHit':
        P.sparks(ev.x, ev.y, ev.z, 8, COLORS[ev.s], 7);
        A && A.sfx('shield', this.pan(ev.x));
        this.rig.shake(0.08);
        break;
      case 'parry':
        P.sparks(ev.x, ev.y, ev.z, 30, '#9fe8ff', 12);
        P.shockRing(ev.x, ev.y, ev.z, '#9fe8ff', 1.4, 0.4);
        R.kick('flash', 0.4, { color: '#bff0ff' });
        this.popups.text('PARADE !', ev.x, ev.y + 1, ev.z, '#9fe8ff', 1.3);
        A && A.sfx('parry');
        break;
      case 'shieldBreak':
        P.sparks(ev.x, ev.y, ev.z, 40, COLORS[ev.s], 14);
        this.popups.text('BOUCLIER BRISÉ !', ev.x, ev.y + 1.6, ev.z, '#ff4a4a', 1.4);
        A && A.sfx('glass');
        this.rig.shake(0.5);
        break;
      case 'ko': {
        const V = this.view(ev.s);
        const v = [ev.vx || 0, ev.vy || 0, ev.vz || 0];
        // gore burst at the blast zone edge, pulled back toward the arena so we see it
        const k = ev.kind === 'bottom' ? 0.0 : 0.15;
        const x = ev.x * (1 - k), y = Math.max(-12, Math.min(20, ev.y)), z = ev.z * (1 - k);
        if (B > 0) P.gore(x, y, z, v, B === 3 ? 24 : 12);
        P.sparks(x, y, z, 60, COLORS[ev.s], 20, 0.7);
        P.shockRing(x, y, z, COLORS[ev.s], 3, 0.6);
        this.renderer.kick('flash', 0.6, { color: COLORS[ev.s] });
        this.renderer.kick('chroma', 3);
        this.rig.shake(1.0);
        this.rig.focusOn({ x, y, z }, 0.5, 0.5);
        this.popups.banner(ev.left > 0 || ev.left === undefined ? `${CHARS[W.fighters[ev.s].char].name} ÉJECTÉ !` : `${CHARS[W.fighters[ev.s].char].name} EST HORS JEU !`, COLORS[ev.s]);
        A && A.ko(this.pan(ev.x));
        if (this.rumble) { this.rumble(ev.s, 1, 1, 450); if (ev.k >= 0) this.rumble(ev.k, 0.6, 0.8, 250); }
        if (V) V.flash('#ffffff', 0.3);
        if (this.onKO) this.onKO(ev, W);
        break;
      }
      case 'land':
        if (ev.v > 9) this.particles.dust(W.fighters[ev.s].x, W.fighters[ev.s].y, W.fighters[ev.s].z, ev.hard ? 14 : 6);
        if (this.view(ev.s)) this.view(ev.s).impulse(-Math.min(4, (ev.v || 0) * 0.18));
        if (ev.hard && B >= 2 && this.decals) { const F = W.fighters[ev.s]; if (F.damage > 40) this.decals.pool(F.x, F.z, 1 + F.damage / 150, bloodColor); }
        A && ev.v > 6 && A.sfx(ev.hard ? 'thud' : 'land', this.pan(W.fighters[ev.s].x), Math.min(1, ev.v / 20));
        break;
      case 'jump': {
        const F = W.fighters[ev.s];
        if (this.view(ev.s)) this.view(ev.s).impulse(ev.air ? 2.2 : 3);
        this.particles.dust(F.x, F.y, F.z, ev.air ? 4 : 7, '#c8c0b0', ev.air ? 0.6 : 1);
        if (ev.air) this.particles.shockRing(F.x, F.y, F.z, '#ffffff', 0.5, 0.25);
        A && A.sfx(ev.air ? 'jump2' : 'jump', this.pan(F.x));
        break;
      }
      case 'bounce':
        this.particles.dust(ev.x, ev.y, ev.z, 16, '#d8d0c0', 1.6);
        if (B >= 2 && this.decals) this.decals.pool(ev.x, ev.z, 1.6, bloodColor);
        if (B > 0) P.blood(ev.x, ev.y + 0.3, ev.z, [0, 1, 0], 30, 1.2);
        this.rig.shake(0.35);
        A && A.sfx('thud', this.pan(ev.x));
        break;
      case 'tech':
        P.sparks(ev.x, ev.y + 0.5, ev.z, 16, '#ffffff', 8);
        this.popups.text('TECH !', ev.x, ev.y + 1.5, ev.z, '#ffffff', 1);
        A && A.sfx('tech');
        break;
      case 'ledge': A && A.sfx('ledge', this.pan(W.fighters[ev.s].x)); break;
      case 'grab': A && A.sfx('grab'); break;
      case 'dodge': case 'airdodge': A && A.sfx('whoosh'); break;
      case 'charge': if (ev.c < 0.1) A && A.sfx('charge'); break;
      case 'move': if (A && ev.m && /smash|usmash|fair|nair|uair|dair|jab3|sp_/.test(ev.m)) A.sfx('whoosh', 0, 0.5); break;
      case 'countdown': this.popups.countdown(ev.n); A && A.countdown(ev.n); break;
      case 'go': this.popups.countdown('BAGARRE !'); A && A.go(); break;
      case 'game': this.popups.banner('GAME !', '#ffffff', 2.4); A && A.game(); this.renderer.kick('flash', 0.8); break;
      case 'respawn': A && A.sfx('respawn'); break;
      case 'strike':
        if (ev.k === 'lightning') { P.sparks(ev.x, 2, ev.z, 50, '#cfe0ff', 16, 0.5); this.renderer.kick('flash', 0.7, { color: '#dfe8ff' }); this.rig.shake(0.6); A && A.sfx('thunder'); this.lightning && this.lightning(ev.x, ev.z); }
        if (ev.k === 'gas') { P.burst('dust', ev.x, ev.y + 0.5, ev.z, 40, '#8aff4a', { speed: 6, g: -3, life: 1.6 }); A && A.sfx('gas'); }
        if (ev.k === 'fork') { this.rig.shake(0.7); A && A.sfx('stab'); P.dust(ev.x, ev.y, ev.z, 20); }
        if (ev.k === 'catfall') { this.rig.shake(0.75); A && A.sfx('yowl'); A && A.sfx('thud'); P.dust(ev.x, ev.y, ev.z, 26, '#e0c8a0', 2.4); this.popups.text('MIAAAOU !', ev.x, ev.y + 2.4, ev.z, '#ffb03a', 1.2); }
        break;
      case 'sweep': A && A.sfx(ev.k === 'wave' ? 'wave' : ev.k === 'cats' ? 'yowl' : 'grateHeavy'); if (ev.k === 'cats') this.popups.banner('LA MEUTE !', '#ffb03a', 1.2); break;
      case 'stamp':
        this.rig.shake(0.9); this.renderer.kick('flash', 0.5, { color: '#ff4040' }); this.renderer.kick('chroma', 2);
        P.dust(ev.x, ev.y, ev.z, 30, '#c8c0b0', 2.5);
        if (this.decals) this.decals.stamp(ev.x, ev.z, ev.a || 0);
        this.popups.text('49.3 !', ev.x, ev.y + 2.5, ev.z, '#ff3030', 1.8);
        A && A.sfx('stamp');
        break;
      case 'decree': this.popups.text('PAR DÉCRET !', W.fighters[ev.s].x, W.fighters[ev.s].y + 2.6, W.fighters[ev.s].z, '#4a7aff', 1.1); A && A.sfx('decree'); break;
      case 'powder': P.burst('dust', ev.x, ev.y + 0.5, ev.z, 50, '#ffffff', { speed: 5, g: -1, life: 1.8, s: 1.4 }); A && A.sfx('poof'); break;
      case 'sniff': this.popups.text('SNIIIFF !', ev.x, ev.y + 0.6, ev.z, '#ffffff', 1.2); A && A.sfx('sniff'); break;
      case 'burgerBoom': P.burst('drop', ev.x, ev.y + 0.3, ev.z, 50, '#d0141a', { speed: 9 }); P.burst('drop', ev.x, ev.y + 0.3, ev.z, 30, '#f0c020', { speed: 8 }); P.burst('flake', ev.x, ev.y + 0.3, ev.z, 20, '#4ac83a', { speed: 7 }); this.rig.shake(0.4); A && A.sfx('splat'); break;
      case 'quake': this.rig.shake(0.3 + ev.k * 0.6); P.dust(ev.x, ev.y, ev.z, 24, '#c8c0b0', 2.2); P.shockRing(ev.x, ev.y + 0.1, ev.z, '#ffffff', 2, 0.4); A && A.sfx('quake'); break;
      case 'tung': {
        const F = W.fighters[ev.s];
        this.popups.text(ev.n === 3 ? 'SAHUR !' : 'TUNG', F.x, F.y + 2.4 + ev.n * 0.2, F.z, ev.beat ? '#ffd23a' : '#e8b070', ev.n === 3 ? 1.3 : 0.9);
        A && A.sfx('tung', this.pan(F.x), 1, ev.n);
        if (ev.ground) P.shockRing(F.x, F.y + 0.1, F.z, ev.beat ? '#ffd23a' : '#e8a050', 1.2, 0.35);
        break;
      }
      case 'flakes': P.burst('flake', ev.x, ev.y, ev.z, ev.n || 5, '#f2d77a', { speed: 4, vx: Math.sin(ev.a) * 3, vz: Math.cos(ev.a) * 3, g: ev.down ? 9 : 6 }); break;
      // --- Pandrezz: kamehameha, CD-Man, Vinylman ---
      case 'kameStart': { const F = W.fighters[ev.s]; A && A.sfx('kameCharge', this.pan(F.x), 0.85); break; }
      case 'kameSyl': {
        const F = W.fighters[ev.s], n = Math.max(0, Math.min(3, ev.n));
        this.popups.text(['KA...', 'MÉ...', 'HA...', 'MÉ...'][n], F.x, F.y + 2.25 + n * 0.12, F.z, '#7fd8ff', 0.95 + n * 0.12);
        P.sparks(F.x, F.y + 1.1, F.z, 8 + n * 4, '#9fe8ff', 4 + n);
        if (A) { A.say(['Ka', 'Mé', 'Ha', 'Mé'][n], 0.95, 1.35); if (n > 0) A.sfx('kameCharge', this.pan(F.x), 0.35 + n * 0.15, n + 1); }
        this.rig.shake(0.04 + n * 0.03);
        break;
      }
      case 'kameFire': {
        const c = ev.c || 0;
        this.rig.shake(0.35 + c * 0.6);
        R.kick('flash', 0.2 + c * 0.45, { color: '#c8f2ff' });
        R.kick('chroma', 1 + c * 2.4);
        if (!ev.down) R.kick('radial', 0.4 + c, { c: this.toScreen(ev.x, ev.y, ev.z) });
        P.shockRing(ev.x, ev.y, ev.z, '#7fd8ff', 0.5 + c * 0.9, 0.3);
        P.sparks(ev.x, ev.y, ev.z, 20 + Math.floor(c * 30), '#bff0ff', 10 + c * 8);
        this.popups.text(ev.down ? 'HA !' : c > 0.55 ? 'HAAAAAAAA !' : c > 0.2 ? 'HAAAA !' : 'HA !', ev.x, ev.y + 1.3, ev.z, '#bff0ff', 1 + c * 0.7);
        if (A) { A.sfx('kameFire', this.pan(ev.x), 0.6 + c * 0.6, 0, 0.5 + c * 0.4); if (c > 0.25) A.say('Haaaaaaa !', 0.85, 0.75); }
        if (this.rumble) this.rumble(ev.s, 0.4 + c * 0.6, 0.6 + c * 0.4, 300 + c * 600);
        break;
      }
      case 'summon': {
        const cd = ev.k === 'cdman';
        this.popups.text(cd ? 'CD-MAN !' : 'VINYLMAN !', ev.x, ev.y + (cd ? 2.3 : 3.2), ev.z, cd ? '#bfe8ff' : '#ff6ac0', 1.25);
        P.sparks(ev.x, ev.y + 0.3, ev.z, 26, cd ? '#e8f6ff' : '#ff8ad0', 8);
        if (cd) P.shockRing(ev.x, ev.y + 0.05, ev.z, '#c8f0ff', 1.1, 0.4);
        if (A) { A.sfx('summon', this.pan(ev.x), 0.9); A.say(cd ? 'Cédé-Mane !' : 'Vinyle-Mane !', 1.05, 1.15); }
        break;
      }
      case 'cdThrow': A && A.sfx('cdThrow', this.pan(ev.x), ev.g ? 1 : 0.75, ev.g ? 2 : 0); if (ev.g) this.popups.text("DISQUE D'OR !", ev.x, ev.y + 1.2, ev.z, '#ffd23a', 1); break;
      case 'vinylLand':
        this.rig.shake(0.7); R.kick('chroma', 1.6);
        P.dust(ev.x, ev.y, ev.z, 10, '#d8d0c0', 1.4); P.shockRing(ev.x, ev.y + 0.1, ev.z, '#ff5ab8', 1.6, 0.4);
        this.popups.text('DROP !', ev.x, ev.y + 2.6, ev.z, '#ff5ab8', 1.2);
        if (A) { A.sfx('thud', this.pan(ev.x), 1); A.sfx('bassDrop', this.pan(ev.x), 0.7); }
        if (this.decals) this.decals.splat(ev.x, ev.z, 1.4, '#2a2228');
        break;
      case 'vinylScratch': A && A.sfx('vinylScratch', this.pan(ev.x), 0.85); P.sparks(ev.x, ev.y, ev.z, 6, '#ff8ad0', 6); break;
      case 'vinylDrop':
        this.rig.shake(0.6); R.kick('chroma', 2.2); R.kick('flash', 0.25, { color: '#ffb0e0' });
        P.shockRing(ev.x, ev.y + 0.2, ev.z, '#ff5ab8', 2.4, 0.45); P.dust(ev.x, ev.y, ev.z, 8, '#d8d0c0', 1.6);
        this.popups.text('BASS DROP !', ev.x, ev.y + 2.8, ev.z, '#ff5ab8', 1.35);
        A && A.sfx('bassDrop', this.pan(ev.x), 1.1, 0, 0.5);
        break;
      case 'buddyOuch': this.popups.text('AÏE !', ev.x, ev.y + 0.6, ev.z, '#ffffff', 0.8); A && A.sfx('pop', this.pan(ev.x), 0.6); break;
      case 'buddyKO': this.popups.text(ev.k === 'cdman' ? 'CD RAYÉ !' : 'DISQUE RAYÉ !', ev.x, ev.y + 1, ev.z, '#ff8080', 1.1); A && A.sfx('vinylScratch', this.pan(ev.x), 1, 3); break;
      case 'buddyBye': this.popups.text(ev.k === 'cdman' ? 'SALUT !' : 'À PLUS !', ev.x, ev.y + 0.4, ev.z, ev.k === 'cdman' ? '#bfe8ff' : '#ff8ad0', 0.75); break;
      case 'buddyLeave': P.sparks(ev.x, ev.y, ev.z, 18, ev.k === 'cdman' ? '#e8f6ff' : '#ff8ad0', 7); P.dust(ev.x, ev.y - 0.6, ev.z, 8, '#ffffff', 1); A && A.sfx('pop', this.pan(ev.x), 0.7); break;
      case 'humanOut': this.popups.text('UN HUMAIN SAUVAGE APPARAÎT !', ev.x, ev.y + 2.2, ev.z, '#ffd23a', 0.8); P.sparks(ev.x, ev.y + 0.5, ev.z, 20, '#ffffff', 7); A && A.sfx('pop'); break;
      case 'captured': this.popups.text('CAPTURÉ !', ev.x, ev.y + 1.8, ev.z, '#ff4040', 1.1); A && A.sfx('pop'); break;
      case 'wobble': this.popups.text(['...1', '...2', '...3'][ev.n - 1] || '', ev.x, ev.y + 1.4, ev.z, '#ffffff', 0.8); A && A.sfx('wobble'); break;
      case 'capBreak': P.sparks(ev.x, ev.y + 0.5, ev.z, 40, '#ff4040', 14); this.rig.shake(0.5); if (ev.crit) this.popups.text('CAPTURE CRITIQUE !', ev.x, ev.y + 2, ev.z, '#ff3030', 1.2); A && A.sfx('boom'); break;
      case 'minionHit': if (B > 0) P.blood(ev.x, ev.y, ev.z, null, 12, 0.8); A && A.sfx('hitS', this.pan(ev.x)); break;
      case 'minionGore': if (B > 0) P.gore(ev.x, ev.y, ev.z, [ev.vx, ev.vy, ev.vz], 10); this.rig.shake(0.3); A && A.sfx('splatter'); break;
      case 'thunderBlast': P.sparks(ev.x, ev.y + 1, ev.z, 40, '#fff4a0', 14); P.shockRing(ev.x, ev.y + 0.5, ev.z, '#fff4a0', 2, 0.4); this.renderer.kick('flash', 0.6, { color: '#fff8c0' }); this.rig.shake(0.5); A && A.sfx('thunder'); break;
      case 'bolt': this.renderer.kick('flash', 0.3, { color: '#fff4c0' }); this.lightning && this.lightning(ev.x, ev.z, ev.y); break;
      case 'swallow': A && A.sfx('gulp'); break;
      case 'spit': A && A.sfx('spit'); break;
      case 'geyser': P.burst('drop', ev.x, ev.y, ev.z, 40, '#a8d8ff', { speed: 7, vy: 8 }); break;
      case 'submerge': case 'surface': P.burst('drop', ev.x, ev.y + 0.2, ev.z, 26, '#a8d8ff', { speed: 6, vy: 5 }); if (ev.attack) this.popups.text('CHOMP !', ev.x, ev.y + 2, ev.z, '#ff4040', 1.2); A && A.sfx('splash'); break;
      case 'wake': P.burst('drop', ev.x, ev.y + 0.1, ev.z, 3, '#a8d8ff', { speed: 2, vy: 2 }); break;
      case 'dust': P.dust(ev.x, ev.y, ev.z, ev.n || 6); break;
      case 'catPoof': P.burst('dust', ev.x, ev.y + 0.4, ev.z, 18, '#f2a23a', { speed: 4, g: -1, life: 0.9 }); A && A.sfx('poof', this.pan(ev.x), 0.6); break;
      case 'catOff': P.burst('flake', ev.x, ev.y, ev.z, 10, '#f2a23a', { speed: 5, g: 6 }); this.popups.text('MIAOU !', ev.x, ev.y + 0.8, ev.z, '#ffb03a', 0.8); A && A.sfx('meow', this.pan(ev.x)); break;
      case 'projHit': case 'projBlock': case 'projLand': {
        const c = { burger: '#d0141a', powderbag: '#ffffff', fry: '#ffd34a', merguez: '#9a3a20', coffee: '#5a2a10', bill: '#7bc265' }[ev.k];
        if (c) P.burst('drop', ev.x, ev.y, ev.z, 8, c, { speed: 4 });
        if (ev.k === 'bill') P.burst('bill', ev.x, ev.y, ev.z, 3, '#7bc265', { speed: 3, flutter: true, g: 2, life: 2 });
        break;
      }
      case 'trip': this.popups.text('GLISSADE !', ev.x, ev.y + 1.5, ev.z, '#ffe08a', 0.9); A && A.sfx('slip'); break;
      case 'padSink': A && A.sfx('splash'); break;
      case 'drumPop': this.rig.shake(0.25); if (this.stageView && this.stageView.pop !== undefined) this.stageView.pop = 1; A && A.sfx('tung', 0, 1.2, 3); break;
      case 'crowdThrow': this.popups.text('LE PUBLIC LANCE UNE HUMANBALL !', ev.x, 6, ev.z, '#ffffff', 0.7); break;
      case 'squirt': A && A.sfx('splat'); break;
      case 'sfx': A && A.sfx(ev.n, ev.s !== undefined && W.fighters[ev.s] ? this.pan(W.fighters[ev.s].x) : 0); break;
      case 'walkOff': break;
      default: break;
    }
  }

  pan(x) { return Math.max(-1, Math.min(1, (x - this.rig.target.x) / 16)); }

  toScreen(x, y, z) {
    v3.set(x, y, z).project(this.renderer.camera);
    return new THREE.Vector2(v3.x * 0.5 + 0.5, v3.y * 0.5 + 0.5);
  }
}
