// Every special's cooldown in one table: the ones that pay a lot wait a long time before coming back, the little
// pokes come back fast but barely push and barely hurt. The recoveries (up specials) have none.
//   cd:   frames (60 a second) before the special can be used again, counted once it is over
//   poke: the projectiles it throws are capped (damage, knockback): a nuisance, not a finisher
export const POKE = { dmg: 3, kbb: 4, kbg: 10, fkb: 14 };

// Cooldowns measured (tools/dev/balance.js: 80 CPU free-for-alls, damage and KOs per use of each special, 14 Oct
// 2026): what pays a lot waits a long time. Frames at 60 per second, counted once the special is over.
//   cheap pokes 0.8-1.2 s, mid projectiles 1.5-2.5 s, summons and AoE 3-5 s, stuns and kill moves 3.5-4.5 s
export const SPECIAL_TUNING = {
  frog: { sp_n: { cd: 70 }, sp_s: { cd: 110 }, sp_d: { cd: 150 } },                         // spit, tongue grab, swallow
  micron: { sp_n: { cd: 50, poke: true }, sp_s: { cd: 100, poke: true }, sp_d: { cd: 270 } }, // bills, powder, the 49.3 stamp (kills)
  bubba: { sp_n: { cd: 72, poke: true }, sp_s: { cd: 60, poke: true }, sp_d: { cd: 210 } },  // burger, fries, armoured belly flop
  parmesan: { sp_n: { cd: 70 }, sp_s: { cd: 150 }, sp_d: { cd: 120 } },                     // grater, cheese shards, cheese wheel
  pika: { sp_n: { cd: 180 }, sp_s: { cd: 270 }, sp_d: { cd: 210 } },                         // humanball, capture ball (kills), skybolt
  tung: { sp_n: { cd: 90 }, sp_s: { cd: 180 }, sp_d: { cd: 270 } },                          // drum, thrown bat, three shockwaves
  shark: { sp_n: { cd: 90 }, sp_s: { cd: 120 }, sp_d: { cd: 270 } },                         // spit, charge, the dive (intangible)
  catlady: { sp_n: { cd: 150 }, sp_s: { cd: 240 }, sp_d: { cd: 300 } },                      // cling cat, fat cat, the kittens
  pandrezz: { sp_n: { cd: 220 }, sp_s: { cd: 200 }, sp_d: { cd: 240 } },                     // kamehameha, CD-Man, Vinylman
  aboueb: { sp_n: { cd: 70, poke: true }, sp_s: { cd: 110 }, sp_d: { cd: 180 } },            // couscous, curls grab, basketball
  tices: { sp_n: { cd: 210 }, sp_s: { cd: 180 }, sp_d: { cd: 210 } },                        // flammekueche, rum and fire, the fart (stuns)
  omfu: { sp_n: { cd: 140 }, sp_s: { cd: 90, poke: true }, sp_d: { cd: 240 } },              // cowbells, chicken bucket, scratch waves
  lolobiscotto: { sp_n: { cd: 70, poke: true }, sp_s: { cd: 160 }, sp_d: { cd: 200 } },      // chili (it still burns), grey cat, Ricard puddle
  jsan: { sp_n: { cd: 210 }, sp_s: { cd: 150 }, sp_d: { cd: 140 } },                         // vape cloud (stuns), fetch, woof
  nymano: { sp_n: { cd: 150 }, sp_s: { cd: 120 }, sp_d: { cd: 160 } },                       // sample wave, skate dash, tears
  bido: { sp_n: { cd: 160 }, sp_s: { cd: 180 }, sp_d: { cd: 240 } },                         // homing kiss, dumbbell, the charm (stuns)
  epektase: { sp_n: { cd: 190 }, sp_s: { cd: 150 }, sp_d: { cd: 230 } },                     // the solo (a stream of notes), power chord, larsen (stuns)
  pprod: { sp_n: { cd: 220 }, sp_s: { cd: 120 }, sp_d: { cd: 160 } },                        // the bugs out of the PC, coins and cash, the pizza
  skanky: { sp_n: { cd: 200 }, sp_s: { cd: 250 }, sp_d: { cd: 200 } },                       // the talk (stuns), the fraud (the train), the funk
};

// applied once to the character definitions (src/sim/chars/index.js)
export function applySpecialTuning(CHARS) {
  for (const [id, moves] of Object.entries(SPECIAL_TUNING)) {
    const C = CHARS[id];
    if (!C) continue;
    for (const [mv, t] of Object.entries(moves)) {
      const M = C.moves[mv];
      if (!M) continue;
      if (t.cd !== undefined) M.cd = t.cd;
      if (t.poke) M.poke = true;
    }
  }
}

// a projectile thrown during a poke special: capped damage and knockback
export function capPoke(props) {
  if (props.dmg !== undefined) props.dmg = Math.min(props.dmg, POKE.dmg);
  if (props.kbb !== undefined) props.kbb = Math.min(props.kbb, POKE.kbb);
  if (props.kbg !== undefined) props.kbg = Math.min(props.kbg, POKE.kbg);
  if (props.fkb !== undefined && props.fkb !== null) props.fkb = Math.min(props.fkb, POKE.fkb);
  return props;
}
