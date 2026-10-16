// Simulation constants. Units: metres, seconds; the simulation runs at a fixed 60 ticks per second.
export const TPS = 60;
export const DT = 1 / TPS;

export const GRAVITY = 40;          // m/s², multiplied per character
export const KB_DECAY = 24;         // launch velocity loss, m/s per second
export const KB_TO_SPEED = 0.29;    // knockback units -> launch speed (m/s)
export const HITSTUN_PER_KB = 0.47; // frames of hitstun per knockback unit
export const TUMBLE_KB = 70;        // above this, the victim tumbles

// Smash-like 2D gameplay: every fighter lives on the plane z = 0 (the 3D world is only scenery around it)
export const PLANE_Z = 0;

export const BLAST = { bottom: -18, top: 30, side: 36 };

export const SHIELD_MAX = 50;
export const SHIELD_DRAIN = 0.15;   // per frame held (Ultimate)
export const SHIELD_MIN = 3;        // frames a shield stays up at least (Ultimate)
export const SHIELD_DROP = 11;      // frames to let the shield down before acting (Ultimate)
export const DODGE_RESET = 60;      // frames without dodging that make the dodges fresh again (Ultimate: about 1 s)
export const SHIELD_REGEN = 0.08;   // per frame not held
export const PARRY_WINDOW = 5;      // frames after pressing shield that parry a hit

export const LEDGE_INTANGIBLE = 60; // frames, first ledge grab since landing (Ultimate: about a second)
export const RESPAWN_DEAD_FRAMES = 75;
export const RESPAWN_INVULN = 120;

export const BUFFER = 7;            // input buffer, frames
export const CHORD = 3;             // frames to wait for a second button (shield+X, shield+A)
export const UP_WINDOW = 8;         // jump pressed this recently + X = up special (the stick up does it too)
export const STICK_DIR = 0.5;       // stick tilt that turns a button into a directional move

export const COLORS = ['#ff3b3b', '#3b8bff', '#ffd23b', '#3bdc5a'];
export const COLOR_NAMES = ['J1', 'J2', 'J3', 'J4'];
