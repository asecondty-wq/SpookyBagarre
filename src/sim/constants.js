// Simulation constants. Units: metres, seconds; the simulation runs at a fixed 60 ticks per second.
export const TPS = 60;
export const DT = 1 / TPS;

export const GRAVITY = 40;          // m/s², multiplied per character
export const KB_DECAY = 24;         // launch velocity loss, m/s per second
export const KB_TO_SPEED = 0.34;    // knockback units -> launch speed (m/s)
export const HITSTUN_PER_KB = 0.42; // frames of hitstun per knockback unit
export const TUMBLE_KB = 70;        // above this, the victim tumbles

export const BLAST = { bottom: -16, top: 26, side: 32 };

export const SHIELD_MAX = 50;
export const SHIELD_DRAIN = 0.13;   // per frame held
export const SHIELD_REGEN = 0.08;   // per frame not held
export const PARRY_WINDOW = 5;      // frames after pressing shield that parry a hit

export const LEDGE_INTANGIBLE = 40;
export const RESPAWN_DEAD_FRAMES = 75;
export const RESPAWN_INVULN = 120;

export const BUFFER = 7;            // input buffer, frames
export const CHORD = 3;             // frames to wait for a second button (shield+X, shield+A)
export const UP_WINDOW = 10;        // jump pressed this recently + X/A = up special / up attack

export const COLORS = ['#ff3b3b', '#3b8bff', '#ffd23b', '#3bdc5a'];
export const COLOR_NAMES = ['J1', 'J2', 'J3', 'J4'];
