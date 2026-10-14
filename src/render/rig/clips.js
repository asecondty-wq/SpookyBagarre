// Motion-captured looking clips (Tripo presets, converted by tools/art/anim_dirs.py into bone directions in
// character space): idle, walk, run, jump, fall, hurt, hit_to_body_01, box_01, flip, victory_celebration.
// Directions fit every skeleton, so one set of clips drives all the fighters; the poser mixes them under the moves
// and the springs smooth everything.
import { norm } from './animator.js';

export const CLIPS = {};
export const clipsReady = fetch('assets/anims/clips.json')
  .then((r) => (r.ok ? r.json() : {}))
  .then((j) => { Object.assign(CLIPS, j); })
  .catch(() => {});

export const hasClip = (name) => !!CLIPS[name];
export const clipLength = (name) => (CLIPS[name] ? CLIPS[name].frames / CLIPS[name].fps : 1);

// pose of a clip at time t (seconds); loop wraps, otherwise holds the last frame.
// hipK: metres per hip height (the clip's hip motion is stored relative to its hip height)
// mirror: swap the sides (left arm <-> right arm), so the strikes are thrown with the arm on the camera side
const MIRROR_NAME = (b) => (b.endsWith('.L') ? b.slice(0, -2) + '.R' : b.endsWith('.R') ? b.slice(0, -2) + '.L' : b);
export function clipPose(name, t, { loop = true, hipK = 0.9, only = null, mirror = false } = {}) {
  const C = CLIPS[name];
  if (!C) return null;
  const n = C.frames;
  let f = t * C.fps;
  if (loop) f = ((f % (n - 1)) + (n - 1)) % (n - 1);
  else f = Math.max(0, Math.min(n - 1, f));
  const i = Math.floor(f), k = f - i, i2 = Math.min(n - 1, i + 1);
  const bones = {};
  for (const [b, arr] of Object.entries(C.bones)) {
    if (only && !only(b)) continue;
    const a = arr[i], c = arr[i2];
    const d = norm([a[0] + (c[0] - a[0]) * k, a[1] + (c[1] - a[1]) * k, a[2] + (c[2] - a[2]) * k]);
    if (mirror) { d[0] = -d[0]; bones[MIRROR_NAME(b)] = { dir: d }; } else bones[b] = { dir: d };
  }
  const h0 = C.hips[i], h1 = C.hips[i2];
  const hips = { pos: [0, 1, 2].map((j) => (h0[j] + (h1[j] - h0[j]) * k) * hipK) };
  if (mirror) hips.pos[0] = -hips.pos[0];
  // directions lose the twist of the torso: put it back from the line of the shoulders (punches turn the chest)
  const sl = bones['shoulder.L'], sr = bones['shoulder.R'];
  if (sl && sr && bones.chest) {
    const dx = sl.dir[0] - sr.dir[0], dz = sl.dir[2] - sr.dir[2];
    const yaw = Math.atan2(-dz, dx) * 180 / Math.PI;
    bones.chest.twist = yaw * 0.6;
    if (bones.spine) bones.spine.twist = yaw * 0.4;
  }
  return { bones, hips };
}
