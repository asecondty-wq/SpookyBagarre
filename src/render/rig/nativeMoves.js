// Signature moves played from the characters' own Uthana clips (packed into their model by tools/art/tripo_pack.py,
// names "u_<file>"). Times are in clip seconds. Two ways to stretch a clip over a move:
//   strike: { from, strike, to }  the wind-up is squeezed before the move's first hitbox, the strike held while it
//                                 is out, then the follow-through (like the Tripo clips of poser.js CLIP_MOVES)
//   keys:   [[simFrame, clipTime], ...]  piecewise linear, for the specials whose strike is a projectile or an effect
//                                 thrown on a given frame (onFrame), not a hitbox
// mirror: the clip has a mirrored copy "<clip>__m", played facing right so the near arm does it.
// A clip a model does not have is simply skipped (the procedural pose stays).
export const NATIVE_MOVES = {
  aboueb: {
    usmash: { clip: 'u_aboueb_dunk', from: 0.35, strike: 1.15, to: 1.7 },                    // the slam dunk
  },
  tices: {
    sp_s: { clip: 'u_tices_firebreath', keys: [[0, 0.05], [20, 0.35], [26, 0.95], [54, 1.75], [66, 1.9]] }, // a swig of rum, then the fire
    sp_n: { clip: 'u_tices_frisbee', keys: [[0, 0.2], [9, 0.7], [32, 1.1]] },                  // the flammekueche flicked like a frisbee
    sp_d: { clip: 'u_tices_fart', keys: [[0, 0.05], [12, 0.33], [40, 1.3]] },                   // he squats... and lets go
    dashattack: { clip: 'u_tices_dash', from: 0.6, strike: 1.05, to: 1.33 },                   // trips and belly-slides
  },
  omfu: {
    sp_d: { clip: 'u_omfu_scratch', keys: [[0, 0.1], [12, 0.8], [36, 1.6], [58, 2.3]] },     // scratching the decks
    sp_s: { clip: 'u_omfu_throw', keys: [[0, 0.4], [15, 0.95], [44, 1.25]] },                   // the chicken bucket, underhand
    dashattack: { clip: 'u_omfu_dash', from: 0.25, strike: 0.6, to: 1.1 },                     // a flying body check
  },
  lolobiscotto: {
    sp_s: { clip: 'u_lolo_catthrow', keys: [[0, 0.5], [11, 1.35], [34, 1.9]], mirror: true }, // the grey cat thrown
    sp_d: { clip: 'u_lolo_pour', keys: [[0, 0.4], [20, 0.9], [44, 1.4]] },                     // she empties the Ricard on the floor
  },
  jsan: {
    sp_n: { clip: 'u_jsan_vape', keys: [[0, 0.9], [18, 1.6], [40, 2.3]] },                    // the big puff
    sp_s: { clip: 'u_jsan_sic', keys: [[0, 1.15], [6, 1.6], [34, 1.9]], mirror: true },       // "go get it!": he points
    sp_d: { clip: 'u_jsan_sic', keys: [[0, 0.25], [4, 0.6], [34, 1.3]], mirror: true },       // whistle: the shiba barks
    dashattack: { clip: 'u_jsan_dash', from: 0.25, strike: 0.62, to: 1.1 },                    // flying dropkick
  },
  nymano: {
    sp_d: { clip: 'u_nymano_cry', keys: [[0, 0.1], [56, 2.3]] },                               // all the tears of his body
    dsmash: { clip: 'u_nymano_cry', from: 0.5, strike: 1.1, to: 1.9 },                        // he bursts into tears
    sp_n: { clip: 'cast_a_spell', keys: [[0, 1.6], [7, 2.24], [28, 2.9]] },                    // the SP-404 blast pushed out
    sp_s: { clip: 'surf', keys: [[0, 0.3], [46, 2.0]] },                                       // riding the board
    dashattack: { clip: 'surf', keys: [[0, 0.3], [36, 1.6]] },                                 // a skate tackle, riding low
  },
  bido: {
    sp_d: { clip: 'u_bido_flex', keys: [[0, 0.1], [14, 0.75], [50, 1.05]] },                  // the charm: double biceps
    usmash: { clip: 'u_bido_press', from: 0.1, strike: 1.0, to: 1.85 },                       // overhead press
    sp_n: { clip: 'heart_pose', keys: [[0, 1.0], [10, 1.9], [34, 3.0]] },                      // a heart with the arms, then the kiss flies
    sp_s: { clip: 'u_bido_throw', keys: [[0, 0.25], [14, 0.8], [42, 1.25]] },                  // the dumbbell, like a shot put
    dsmash: { clip: 'lift_heavy', from: 14.0, strike: 17.6, to: 19.0 },                        // he drops the plates down
  },
  pandrezz: {
    sp_n: { clip: 'u_pandrezz_kame', keys: [[0, 0.1], [10, 0.5], [13, 0.9], [60, 1.6], [80, 2.3]] }, // ka-me-ha-me-HA
    sp_s: { clip: 'u_pandrezz_summon', keys: [[0, 0.1], [9, 0.5], [34, 1.1]] },                // he points: CD-Man comes
    sp_d: { clip: 'u_pandrezz_call', keys: [[0, 0.2], [8, 0.6], [40, 1.2]] },                  // he calls Vinylman
    dashattack: { clip: 'u_pandrezz_dash', from: 0.55, strike: 1.05, to: 1.3 },                // the flying side kick
  },
  // Epektase (Meshy rig, tools/art/meshy_pack.py): every move from his own pool of clips, nothing shared
  epektase: {
    // the three blows of a one-handed weapon combo (the guitar), each struck at full stretch
    jab1: { clip: 'm_tricombo', from: 0.45, strike: 0.95, to: 1.2 },
    jab2: { clip: 'm_tricombo', from: 1.2, strike: 1.72, to: 1.9 },
    jab3: { clip: 'm_tricombo', from: 2.0, strike: 2.55, to: 3.2 },
    ftilt: { clip: 'm_scarfwhip', from: 0.3, strike: 0.9, to: 1.6 },          // the Hermès scarf lashed out (text to motion)
    ftilt2: { clip: 'm_spartan', from: 0.2, strike: 0.62, to: 1.1 },          // a push kick, the leg straight out
    ftilt3: { clip: 'm_hammer', from: 0.7, strike: 1.5, to: 1.8 },              // the guitar like a sledgehammer
    utilt: { clip: 'm_windmill', from: 0.95, strike: 1.45, to: 2.1 },           // the windmill strum
    dtilt: { clip: 'm_legsweep', from: 0.4, strike: 0.85, to: 1.6 },
    smash: { clip: 'm_chargedslash', from: 0.2, strike: 1.17, to: 2.0 },        // the axe swing
    usmash: { clip: 'm_upslash', from: 0.45, strike: 1.07, to: 2.0 },
    dsmash: { clip: 'm_groundslam', from: 1.15, strike: 1.66, to: 2.6 },        // slammed into the floor
    nair: { clip: 'm_axespin', from: 0.35, strike: 0.92, to: 1.6 },
    fair: { clip: 'm_doublecombo', from: 0.3, strike: 0.68, to: 1.05 },
    bair: { clip: 'm_lslash', from: 1.0, strike: 1.3, to: 1.75 },
    uair: { clip: 'm_upslash', from: 0.6, strike: 1.07, to: 1.7 },
    dair: { clip: 'm_hammer', from: 0.8, strike: 1.5, to: 1.8 },
    grab: { clip: 'm_grabthrow', from: 0.35, strike: 0.8, to: 1.2 },            // the scarf lasso
    throw: { clip: 'm_grabthrow', keys: [[0, 3.0], [13, 3.45], [30, 4.2]] },
    dashattack: { clip: 'm_kneeslide', keys: [[0, 0.35], [8, 0.9], [30, 1.45], [42, 1.6]] }, // on his knees
    ledgeattack: { clip: 'm_rslash', from: 0.2, strike: 0.53, to: 1.1 },
    sp_n: { clip: 'm_solo', keys: [[0, 0.05], [66, 2.9]] },                      // the shred
    sp_s: { clip: 'm_powerchord', keys: [[0, 0.05], [12, 0.33], [22, 0.72], [48, 1.9]] },
    sp_u: { clip: 'm_rockjump', keys: [[0, 0.12], [6, 0.42], [40, 1.4], [60, 1.5]] },
    sp_d: { clip: 'm_larsen', keys: [[0, 0.05], [14, 0.6], [44, 1.8], [56, 2.4]] },
  },
  // PPROD (Meshy rig, his own pool of clips): punches and kicks thrown at full stretch, the chair, the throws
  pprod: {
    jab1: { clip: 'm_ljab', from: 0.15, strike: 0.47, to: 0.9 },
    jab2: { clip: 'm_rjab', from: 0.3, strike: 0.6, to: 1.0 },
    jab3: { clip: 'm_bothfists', from: 1.1, strike: 1.45, to: 2.0 },          // both fists pushed out
    ftilt: { clip: 'm_straightkick', from: 0.3, strike: 0.72, to: 1.2 },
    ftilt2: { clip: 'm_elbow', from: 0.9, strike: 1.35, to: 1.9 },
    ftilt3: { clip: 'm_roundhouse', from: 0.4, strike: 0.92, to: 1.5 },      // a lunging roundhouse
    utilt: { clip: 'm_uppercut', from: 0.3, strike: 0.6, to: 0.95 },
    dtilt: { clip: 'm_legsweep', from: 0.4, strike: 0.85, to: 1.5 },
    smash: { clip: 'm_prepunch', from: 1.0, strike: 1.9, to: 2.6 },          // the big straight, wound up
    usmash: { clip: 'm_highkick', from: 0.6, strike: 1.05, to: 1.6 },
    dsmash: { clip: 'm_sweepkick', from: 0.6, strike: 1.2, to: 1.6 },        // a spinning sweep
    nair: { clip: 'a_spinkick', from: 0.2, strike: 0.9, to: 1.2 },
    fair: { clip: 'a_flykick', from: 0.2, strike: 0.55, to: 0.9 },           // the flying kick
    bair: { clip: 'a_spinkick', from: 0.2, strike: 0.6, to: 1.0 },
    uair: { clip: 'm_highkick', from: 0.6, strike: 1.05, to: 1.5 },
    dair: { clip: 'a_jumppunch', from: 0.1, strike: 0.45, to: 0.8 },         // a punch down
    grab: { clip: 'm_grabthrow', from: 0.35, strike: 0.8, to: 1.2 },
    throw: { clip: 'm_grabthrow', keys: [[0, 3.0], [13, 3.45], [30, 4.2]] },
    dashattack: { clip: 'm_slide', keys: [[0, 0.05], [6, 0.4], [34, 0.95], [46, 1.3]] }, // the spaghetti slide
    ledgeattack: { clip: 'm_ljab', from: 0.15, strike: 0.47, to: 0.9 },
    sp_n: { clip: 'm_typing', keys: [[0, 0.0], [66, 3.6], [72, 3.9]] },     // on his chair, coding
    sp_s: { clip: 'm_overthrow', keys: [[0, 0.6], [10, 0.9], [14, 1.6], [19, 1.95], [44, 2.6]] }, // coins, then the cash
    sp_d: { clip: 'm_crouchthrow', keys: [[0, 4.6], [16, 5.4], [46, 6.3]] }, // the pizza, wound up and flung
    sp_u: { clip: 'm_sitthumbs', keys: [[0, 0.6], [62, 2.4]] },              // riding the turbo chair, thumbs up
  },
  // SKANKY (Meshy rig): the same fighting takes as PPROD on his own skeleton, his talk, the vault, the ollie, the funk
  skanky: {
    jab1: { clip: 'm_ljab', from: 0.15, strike: 0.47, to: 0.9 },
    jab2: { clip: 'm_rjab', from: 0.3, strike: 0.6, to: 1.0 },
    jab3: { clip: 'm_bothfists', from: 1.1, strike: 1.45, to: 2.0 },
    ftilt: { clip: 'm_straightkick', from: 0.3, strike: 0.72, to: 1.2 },
    ftilt2: { clip: 'm_elbow', from: 0.9, strike: 1.35, to: 1.9 },
    ftilt3: { clip: 'm_roundhouse', from: 0.4, strike: 0.92, to: 1.5 },
    utilt: { clip: 'm_uppercut', from: 0.3, strike: 0.6, to: 0.95 },
    dtilt: { clip: 'm_legsweep', from: 0.4, strike: 0.85, to: 1.5 },
    smash: { clip: 'm_roundhouse', from: 0.3, strike: 0.92, to: 1.6 },        // the lunging roundhouse, wound up
    usmash: { clip: 'm_highkick', from: 0.6, strike: 1.05, to: 1.6 },
    dsmash: { clip: 'm_sweepkick', from: 0.6, strike: 1.2, to: 1.6 },
    nair: { clip: 'a_spinkick', from: 0.2, strike: 0.9, to: 1.2 },
    fair: { clip: 'a_flykick', from: 0.2, strike: 0.55, to: 0.9 },
    bair: { clip: 'a_spinkick', from: 0.2, strike: 0.6, to: 1.0 },
    uair: { clip: 'm_highkick', from: 0.6, strike: 1.05, to: 1.5 },
    dair: { clip: 'a_jumppunch', from: 0.1, strike: 0.45, to: 0.8 },
    grab: { clip: 'm_grabthrow', from: 0.35, strike: 0.8, to: 1.2 },
    throw: { clip: 'm_grabthrow', keys: [[0, 3.0], [13, 3.45], [30, 4.2]] },
    dashattack: { clip: 'm_slide', keys: [[0, 0.05], [6, 0.4], [34, 0.95], [42, 1.3]] }, // thrown forward on the skateboard
    ledgeattack: { clip: 'm_ljab', from: 0.15, strike: 0.47, to: 0.9 },
    sp_n: { clip: 'm_talk', keys: [[0, 3.0], [64, 6.4]] },                   // talking, waving his arms, much too fast
    sp_s: { clip: 'a_vault', keys: [[0, 0.1], [14, 0.75], [30, 1.3], [50, 1.95]] }, // over the ticket gate
    sp_u: { clip: 'a_ollie', keys: [[0, 0.35], [5, 0.9], [26, 1.45], [56, 2.6]] },
    sp_d: { clip: 'm_funk', keys: [[0, 0.4], [16, 1.3], [34, 2.6], [54, 4.3], [70, 5.9]] }, // the funk de Lyon
  },
  // the eight first characters (their Blender skeletons get the clips through tools/art/legacy_pack.py); the others
  // keep a hand-made dash attack pose (it reads better than their generated take)
  micron: { dashattack: { clip: 'u_micron_dash', from: 0.3, strike: 0.75, to: 1.25 } },
  bubba: { dashattack: { clip: 'u_bubba_dash', from: 0.3, strike: 0.8, to: 1.35 } },
  shark: { dashattack: { clip: 'u_shark_dash', from: 0.25, strike: 0.6, to: 1.2 } },
};

// moves shared by every packed character (the kit's combo enders), by pose
export const NATIVE_POSES = {
  headbutt: { clip: 'u_headbutt', from: 0.2, strike: 0.6, to: 1.2, mirror: true },
};

// emotes (Tripo presets): shown when the character is picked on the character select, and its victory dance
export const EMOTES = {
  aboueb: { select: { emote: 'crossover_dribble' }, win: { emote: 'dance_02' } },
  tices: { select: { emote: 'laugh_02' }, win: { emote: 'dance_04' } },
  omfu: { select: { emote: 'dance_03' }, win: { emote: 'dance_05' } },
  lolobiscotto: { select: { emote: 'greet_01' }, win: { emote: 'dance_06' } },
  jsan: { select: { emote: 'play_mobile_game' }, win: { emote: 'clap' } },
  nymano: { select: { emote: 'sob' }, win: { emote: 'sing_02' } },
  bido: { select: { emote: 'jump_rope_01' }, win: { emote: 'heart_pose' } },
  pandrezz: { select: { emote: 'angry_02' }, win: { emote: 'victory_celebration' } },
  frog: { select: { emote: 'dance_01' }, win: { emote: 'dance_03' } },
  micron: { select: { emote: 'bow' }, win: { emote: 'greet_01' } },
  bubba: { select: { emote: 'laugh_01' }, win: { emote: 'dance_05' } },
  parmesan: { select: { emote: 'agree' }, win: { emote: 'clap' } },
  pika: { select: { emote: 'cheer' }, win: { emote: 'victory_celebration' } },
  tung: { select: { emote: 'angry_01' }, win: { emote: 'dance_04' } },
  shark: { select: { emote: 'freaky' }, win: { emote: 'dance_06' } },
  catlady: { select: { emote: 'complain_01' }, win: { emote: 'laugh_02' } },
  epektase: { select: { emote: 'm_select' }, win: { emote: 'm_victory' } },
  pprod: { select: { emote: 'm_select' }, win: { emote: 'm_victory' } },
  skanky: { select: { emote: 'm_select' }, win: { emote: 'm_funk' } },
};

// the states played from the character's own clips (the others keep the procedural poses): clip, playback rate
// (clip seconds per second in the state), from (clip time at the start), loop; body: false = the clip moves the
// whole body itself (the roll, lying down), the poser's spins and lying down are dropped
export const NATIVE_STATES = {
  epektase: {
    jumpsquat: { clip: 's_squat', rate: 1.6 }, land: { clip: 's_land', rate: 1.4 },
    rise: { clip: 's_rise', loop: true, rate: 0.6 }, fall: { clip: 's_fall', loop: true, rate: 0.6 },
    crouch: { clip: 's_crouch', rate: 1.5 },
    shield: { clip: 's_block', loop: true },
    dodge: { clip: 'm_dodge', rate: 1.6 }, roll: { clip: 'm_roll', rate: 1.7, body: false }, airdodge: { clip: 's_airdodge', rate: 1.6 },
    ledge: { clip: 's_ledge', loop: true },
    down: { clip: 's_down', rate: 1.5, body: false }, getup: { clip: 's_getup', rate: 2.2 }, tech: { clip: 's_getup', rate: 3 },
    dizzy: { clip: 's_dizzy', loop: true }, stunned: { clip: 's_dizzy', loop: true },
    grabbed: { clip: 'hit_to_stomach', from: 0.5, rate: 0.3 }, held: { clip: 'hit_to_stomach', from: 0.5, rate: 0.3 },
  },
};
// PPROD: the same states, out of his own clips
NATIVE_STATES.pprod = { ...NATIVE_STATES.epektase };
NATIVE_STATES.skanky = { ...NATIVE_STATES.epektase };

export function keysAt(keys, f) {
  if (f <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [f1, t1] = keys[i];
    if (f <= f1) { const [f0, t0] = keys[i - 1]; return t0 + (t1 - t0) * (f - f0) / Math.max(1e-6, f1 - f0); }
  }
  return keys[keys.length - 1][1];
}
