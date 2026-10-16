// J'san : il ne se bat jamais vraiment lui-même, presque tout passe par son shiba (aboiements, lancé, tournoiements,
// morsures qui ramènent l'ennemi, la queue qui fait hélice, le caca où l'on glisse) pendant qu'il tire sur sa
// vapoteuse.
import { normals, dashAttack, hb } from '../kit.js';
import { ensurePet, petCmd } from './friendKit.js';
import { localToWorld } from '../util.js';
import { steerX } from './recovery.js';
import { DMath } from '../dmath.js';

const charged = (F) => 1 + 0.45 * (F.mv.charge || 0) / 60;

const moves = {
  ...normals({ power: 1.18, reach: 1.04, speed: 1.02, sfxS: 'slap', sfxM: 'hitM', sfxL: 'hitL' }),
  // A while running: its own dash attack
  dashattack: dashAttack({ pose: 'dropkick', boost: 12, fric: 20, dur: 38, iasa: 34, hits: [hb(7, 11, [0, 1.0, 1.0], 0.85, 11, 38, 46, 76, { sfx: 'hitL', blood: 1.3 })] }),

  // neutral A: one bark (quick to come back): a ring of noise around the dog, it hurts a little and barely pushes
  jab1: {
    dur: 26, iasa: 22, pose: 'thunder',
    onStart(F, W) { petCmd(W, F, 'bark', 4.5, { kbb: 10, kbg: 6, grow: 11, life: 16 }); },
  },
  // side smash: he throws his dog (short range, it sends like a smash)
  smash: {
    dur: 44, charge: { at: 8, max: 60 }, pose: 'throw1', tilt: 'ftilt',
    onStart(F, W) { petCmd(W, F, 'hold', 0); },
    onFrame(F, W, f) { if (f === 11) { petCmd(W, F, 'thrown', 15 * charged(F), { kbb: 40 + 12 * (F.mv.charge || 0) / 60 }); W.emit('petThrow', { s: F.slot, x: F.x, y: F.y + 1.2, z: 0 }); } },
  },
  // up smash: the dog swung by the tail from low in front up over his head, slammed
  usmash: {
    dur: 44, charge: { at: 6, max: 60 }, pose: 'thunder', tilt: 'utilt',
    onStart(F, W) { petCmd(W, F, 'hold', 0); },
    onFrame(F, W, f) { if (f === 6) petCmd(W, F, 'swing', 15 * charged(F)); }, // (after the charge)
  },
  // down smash: the dog runs once around him, in front first, then behind
  dsmash: {
    dur: 46, charge: { at: 6, max: 60 }, pose: 'dsmash', tilt: 'dtilt',
    onFrame(F, W, f) { if (f === 8) petCmd(W, F, 'spin2', 13 * charged(F)); },
  },

  // Nuage de vape : une grosse bouffée de vapeur devant lui, on ne voit plus rien (étourdit)
  sp_n: {
    dur: 40, iasa: 34, pose: 'bite', airCtrl: 0.6,
    onFrame(F, W, f) {
      F.va[0] = f < 16 ? 1 : 0; // the vape at the mouth
      if (f === 6) W.emit('sfx', { s: F.slot, n: 'vape' });
      if (f === 18) {
        const p = localToWorld(F, [0, 1.5, 1.4]);
        W.spawn('cloud', { owner: F.slot, x: p[0], y: p[1], z: 0, vx: DMath.sin(F.facing) * 5, r: 2.0, life: 130, look: 'vape', effect: 'stun', stun: 34, dmg: 2.5, rehit: 70, sfx: 'poof' });
        W.emit('vape', { x: p[0], y: p[1], z: 0, a: F.facing });
      }
    },
    onEnd(F) { F.va[0] = 0; },
  },

  // Va chercher ! : le shiba file vers où on pousse ; il mord le premier qu'il croise et le ramène à J'san en le
  // mâchouillant (on s'en libère en martelant les boutons, plus dur quand on a pris cher). Un bouclier, ou un coup
  // qui le cueille avant qu'il arrive, et il rebondit.
  sp_s: {
    dur: 30, iasa: 26, pose: 'throw1', airCtrl: 0.6,
    onFrame(F, W, f) { if (f === 6) { petCmd(W, F, 'dash', 1); W.emit('bark', { s: F.slot, small: 1 }); } },
  },

  // Caca ! : le shiba fait sa crotte derrière lui ; elle reste là jusqu'à ce qu'un ennemi marche dedans (il glisse,
  // tombe, se fait mal, et reste au sol 3 s) ; quatre au plus, la plus vieille disparaît
  sp_d: {
    dur: 30, iasa: 26, pose: 'thunder', airCtrl: 0.5,
    onFrame(F, W, f) { if (f === 3) { petCmd(W, F, 'poop', 0); W.emit('sfx', { s: F.slot, n: 'sniff' }); } },
  },

  // Shiba-hélico : il s'accroche aux pattes de son shiba, dont la queue tourne comme une hélice ; celui que la queue
  // touche est emporté (des petits coups tout du long), le dernier l'éjecte un peu
  sp_u: {
    dur: 64, pose: 'jupiter', helpless: true, noGrav: [6, 48], airCtrl: 0.5, ledgeGrab: true,
    onFrame(F, W, f) {
      if (f === 2) { petCmd(W, F, 'lift', 1, { wind: 1 }); W.emit('bark', { s: F.slot }); }
      if (f < 6 && !F.grounded) F.vy = Math.max(F.vy, -1);
      if (f === 6) F.grounded = false;
      if (f >= 6 && f <= 48) { F.vy = 16 - (f - 6) * 0.22; steerX(F, 9); }
    },
    hits: [
      // at the take-off his body catches whoever stands next to him; then the rotor
      hb(6, 10, [0, 1.0, 0.35], 1.0, 2, 80, 10, 10, { sfx: 'hitS', blood: 0.3, drag: [0.45, 0.3, 14] }),
      hb(8, 44, [0, 2.4, 0.1], 1.0, 1.1, 80, 10, 10, { sfx: 'whoosh', blood: 0.2, rehit: 5, drag: [0.45, 0.3, 12], grp: 1 }),
      hb(46, 48, [0, 2.5, 0.2], 1.1, 4, 80, 32, 60, { sfx: 'chomp', blood: 0.8, dir: 'radial', grp: 2 }),
    ],
  },
};

export default {
  id: 'jsan', name: "J'san", title: 'Lui, sa vapoteuse et son shiba',
  color: '#d9a35f',
  // the shiba is always with him (spawned on the first frame, follows him everywhere)
  tick(F, W) { if (!F.out) ensurePet(W, F, 'shiba'); },
  stats: { weight: 108, runSpeed: 8.6, walkSpeed: 3.7, airSpeed: 6.4, airAccel: 34, groundAccel: 66, friction: 46,
    jumpVel: 15.6, airJumpVel: 13.8, airJumps: 1, gravity: 1.0, fallSpeed: 17.5, height: 1.82, radius: 0.52 },
  moves,
  specialsInfo: { n: 'Nuage de vape', s: 'Va chercher ! (il ramène)', u: 'Shiba-hélico', d: 'Caca ! (on glisse dessus)' },
};
