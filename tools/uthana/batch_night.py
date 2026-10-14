"""Night batch of Uthana clips (14 Oct 2026). Files land in tools/art/uthana/: '<char>_<name>.glb' for one character,
'<name>.glb' (no underscore) for everyone. Existing files are skipped. Stops when the pay-as-you-go balance would
fall under RESERVE dollars (the account has no card: it cannot be charged)."""
import importlib.util, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('uth', os.path.join(HERE, 'uth.py')); u = importlib.util.module_from_spec(spec); spec.loader.exec_module(u)
OUT = os.path.join(HERE, '..', 'art', 'uthana')
CHAR = 'cpKDQb6DXVnt'
RESERVE = 0.6
JOBS = [
  ('roll', 1.3, 'a fighter does a fast forward roll on the ground, tucking into a tight ball, rolling over the shoulder and springing back up into a crouched fighting stance'),
  ('aboueb_dash', 1.4, 'a basketball player sprinting forward leaps into a running layup, one arm reaching high forward, then lands running'),
  ('tices_dash', 1.4, 'a clumsy drunk man sprinting forward trips and dives, sliding forward on his belly with both arms stretched ahead'),
  ('omfu_dash', 1.3, 'a heavy man running forward lowers his shoulder and slams into a big powerful shoulder charge'),
  ('lolo_dash', 1.3, 'a woman sprinting forward drops into a low sliding kick on the ground with one leg extended straight ahead'),
  ('jsan_dash', 1.4, 'a man sprinting forward jumps into a flying dropkick with both feet thrust forward, then lands and stands up'),
  ('nymano_dash', 1.3, 'a skater running forward crouches low and lunges into a diving shoulder tackle with arms spread'),
  ('bido_dash', 1.4, 'a muscular wrestler running forward swings one arm straight out to the side for a huge clothesline lariat'),
  ('pandrezz_dash', 1.4, 'a martial artist running forward launches a powerful flying side kick with one leg fully extended, then lands'),
  ('aboueb_whip', 1.3, 'a man violently whips his head forward and down, swinging his long hair like a whip in front of him'),
  ('aboueb_spin', 1.4, 'a man crouches and spins his head and shoulders in fast circles, swinging his long hair all around him'),
  ('tices_peel', 1.4, 'a man swings a long wooden pizza peel horizontally in a big powerful arc with both hands'),
  ('tices_frisbee', 1.2, 'a man throws a frisbee forward with a fast sideways backhand flick of his arm'),
  ('tices_fart', 1.4, 'a man squats down, pushes his butt out backward and strains, then straightens up relieved, fanning the air behind him'),
  ('omfu_slam', 1.4, 'a man lifts a heavy object high over his head with both hands and smashes it down forward hard'),
  ('omfu_throw', 1.3, 'a heavy man throws a bucket forward with a big underhand swing of both arms'),
  ('lolo_bottle', 1.3, 'a woman swings a bottle in a big wide sideways arc with one arm, hitting forward'),
  ('lolo_pour', 1.5, 'a woman bends forward and pours a bottle onto the ground in front of her, shaking it'),
  ('nymano_skate', 1.3, 'a man swings a skateboard like a baseball bat in a big horizontal arc with both hands'),
  ('nymano_pads', 1.3, 'a man holds a small box at his hip with one hand and slaps it rhythmically with the other hand, nodding his head'),
  ('bido_kettle', 1.4, 'a muscular man swings a heavy kettlebell in a big arc from between his legs up forward with both hands'),
  ('bido_plates', 1.4, 'a muscular man lifts two heavy weight plates and slams them down on the ground on both sides of him, squatting'),
  ('bido_throw', 1.3, 'a muscular man throws a heavy dumbbell forward overhand like a shot put'),
  ('pandrezz_call', 1.3, 'a man cups both hands around his mouth and shouts loudly forward, leaning in'),
  ('frog_dash', 1.4, 'a frog-like man running forward leaps low and lands on his belly, sliding forward with both arms stretched ahead'),
  ('micron_dash', 1.3, 'a confident politician in a suit runs forward and slams into a firm shoulder charge'),
  ('bubba_dash', 1.4, 'an obese man runs forward and bumps hard with his big belly pushed out, arms thrown back'),
  ('pika_dash', 1.3, 'a small energetic person sprints and dives headfirst forward in a flying tackle'),
  ('tung_dash', 1.4, 'a man running forward swings a baseball bat overhead with both hands and smashes it down in front of him'),
  ('shark_dash', 1.3, 'a hunched heavy creature runs forward and lunges with a huge biting headbutt, jaws first'),
  ('catlady_dash', 1.4, 'an old woman runs forward and sweeps a broom low across the ground in front of her with both hands'),
  ('pandrezz_summon', 1.3, 'a man thrusts one arm forward dramatically pointing, summoning something, with a confident wide stance'),
]
def balance():
    return float(u.gql('{ org { payg_total_usd } }')['org']['payg_total_usd'])
for name, secs, prompt in JOBS:
    out = os.path.join(OUT, name + '.glb')
    if os.path.exists(out): print('skip', name); continue
    b = balance()
    if b - secs * 0.03 < RESERVE: print('stop: balance', b); break
    try:
        d = u.gql('mutation ($c: String, $l: Float, $m: String, $p: String!) { create_text_to_motion(character_id: $c, length: $l, model: $m, prompt: $p, foot_ik: true) { motion { id name } } }',
                  {'c': CHAR, 'l': secs, 'm': 'text-to-motion-bucmd', 'p': prompt})
        mid = d['create_text_to_motion']['motion']['id']
        u.download(CHAR, mid, out)
        print('ok', name, mid, 'balance before', b, flush=True)
    except SystemExit as e:
        print('FAIL', name, e, flush=True)
print('balance now', balance())
