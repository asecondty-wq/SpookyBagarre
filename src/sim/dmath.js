// Deterministic math for the simulation: Math.sin / cos / atan2 / hypot are left to each browser and may differ
// in the last bit from one engine to another, which is enough to split two online games apart (rollback needs every
// machine to compute exactly the same thing). These are ports of fdlibm 5.3 (the library V8 itself uses), made of
// + - * / and Math.sqrt only, which are exact everywhere: same results on every browser, close to Math's to the bit.

const F64 = new Float64Array(1);
const I32 = new Int32Array(F64.buffer);
const LE = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;
const HI = LE ? 1 : 0, LO = LE ? 0 : 1;
const hiWord = (x) => { F64[0] = x; return I32[HI]; };
const loWord = (x) => { F64[0] = x; return I32[LO]; };
const fromWords = (hi, lo) => { I32[HI] = hi; I32[LO] = lo; return F64[0]; };

// --- sin / cos -------------------------------------------------------------------------------------------------
const S1 = -1.66666666666666324348e-01, S2 = 8.33333333332248946124e-03, S3 = -1.98412698298579493134e-04,
  S4 = 2.75573137070700676789e-06, S5 = -2.50507602534068634195e-08, S6 = 1.58969099521155010221e-10;
const C1 = 4.16666666666666019037e-02, C2 = -1.38888888888741095749e-03, C3 = 2.48015872894767294178e-05,
  C4 = -2.75573143513906633035e-07, C5 = 2.08757232129817482790e-09, C6 = -1.13596475577881948265e-11;

function kSin(x, y, iy) {
  const ix = hiWord(x) & 0x7fffffff;
  if (ix < 0x3e400000 && (x | 0) === 0) return x; // |x| < 2^-27
  const z = x * x, v = z * x;
  const r = S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)));
  if (iy === 0) return x + v * (S1 + z * r);
  return x - ((z * (0.5 * y - v * r) - y) - v * S1);
}

function kCos(x, y) {
  const ix = hiWord(x) & 0x7fffffff;
  if (ix < 0x3e400000 && (x | 0) === 0) return 1; // |x| < 2^-27
  const z = x * x;
  const r = z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6)))));
  if (ix < 0x3fd33333) return 1 - (0.5 * z - (z * r - x * y)); // |x| < 0.3
  const qx = ix > 0x3fe90000 ? 0.28125 : fromWords(ix - 0x00200000, 0);
  const hz = 0.5 * z - qx, a = 1 - qx;
  return a - (hz - (z * r - x * y));
}

const INVPIO2 = 6.36619772367581382433e-01,
  PIO2_1 = 1.57079632673412561417e+00, PIO2_1T = 6.07710050650619224932e-11,
  PIO2_2 = 6.07710050630396597660e-11, PIO2_2T = 2.02226624879595063154e-21,
  PIO2_3 = 2.02226624871116645580e-21, PIO2_3T = 8.47842766036889956997e-32;
const Y = [0, 0];

// x reduced to Y[0] + Y[1] in [-pi/4, pi/4], returns the quadrant (|x| up to 2^19 * pi/2, plenty for a game)
function remPio2(x) {
  const hx = hiWord(x), ix = hx & 0x7fffffff;
  if (ix < 0x4002d97c) { // |x| < 3pi/4
    if (hx > 0) {
      let z = x - PIO2_1;
      if (ix !== 0x3ff921fb) { Y[0] = z - PIO2_1T; Y[1] = (z - Y[0]) - PIO2_1T; }
      else { z -= PIO2_2; Y[0] = z - PIO2_2T; Y[1] = (z - Y[0]) - PIO2_2T; }
      return 1;
    }
    let z = x + PIO2_1;
    if (ix !== 0x3ff921fb) { Y[0] = z + PIO2_1T; Y[1] = (z - Y[0]) + PIO2_1T; }
    else { z += PIO2_2; Y[0] = z + PIO2_2T; Y[1] = (z - Y[0]) + PIO2_2T; }
    return -1;
  }
  if (ix > 0x413921fb) { // huge: never happens in a match, reduced roughly (still deterministic)
    const k = Math.round(x / (2 * Math.PI));
    return remPio2(x - k * (2 * Math.PI));
  }
  let t = Math.abs(x);
  const n = (t * INVPIO2 + 0.5) | 0, fn = n;
  let r = t - fn * PIO2_1, w = fn * PIO2_1T;
  const j = ix >> 20;
  Y[0] = r - w;
  let i = j - ((hiWord(Y[0]) >> 20) & 0x7ff);
  if (i > 16) { // 2nd iteration
    t = r; w = fn * PIO2_2; r = t - w; w = fn * PIO2_2T - ((t - r) - w); Y[0] = r - w;
    i = j - ((hiWord(Y[0]) >> 20) & 0x7ff);
    if (i > 49) { t = r; w = fn * PIO2_3; r = t - w; w = fn * PIO2_3T - ((t - r) - w); Y[0] = r - w; }
  }
  Y[1] = (r - Y[0]) - w;
  if (hx < 0) { Y[0] = -Y[0]; Y[1] = -Y[1]; return -n; }
  return n;
}

export function sin(x) {
  const ix = hiWord(x) & 0x7fffffff;
  if (ix <= 0x3fe921fb) return kSin(x, 0, 0);
  if (ix >= 0x7ff00000) return NaN;
  const n = remPio2(x);
  switch (n & 3) {
    case 0: return kSin(Y[0], Y[1], 1);
    case 1: return kCos(Y[0], Y[1]);
    case 2: return -kSin(Y[0], Y[1], 1);
    default: return -kCos(Y[0], Y[1]);
  }
}

export function cos(x) {
  const ix = hiWord(x) & 0x7fffffff;
  if (ix <= 0x3fe921fb) return kCos(x, 0);
  if (ix >= 0x7ff00000) return NaN;
  const n = remPio2(x);
  switch (n & 3) {
    case 0: return kCos(Y[0], Y[1]);
    case 1: return -kSin(Y[0], Y[1], 1);
    case 2: return -kCos(Y[0], Y[1]);
    default: return kSin(Y[0], Y[1], 1);
  }
}

// --- atan / atan2 ----------------------------------------------------------------------------------------------
const ATANHI = [4.63647609000806093515e-01, 7.85398163397448278999e-01, 9.82793723247329054082e-01, 1.57079632679489655800e+00];
const ATANLO = [2.26987774529616870924e-17, 3.06161699786838301793e-17, 1.39033110312309984516e-17, 6.12323399573676603587e-17];
const AT = [3.33333333333329318027e-01, -1.99999999998764832476e-01, 1.42857142725034663711e-01, -1.11111104054623557880e-01,
  9.09088713343650656196e-02, -7.69187620504482999495e-02, 6.66107313738753120669e-02, -5.83357013379057348645e-02,
  4.97687799461593236017e-02, -3.65315727442169155270e-02, 1.62858201153657823623e-02];

export function atan(x) {
  const hx = hiWord(x), ix = hx & 0x7fffffff;
  let id;
  if (ix >= 0x44100000) { // |x| >= 2^66
    if (x !== x) return x;
    return hx > 0 ? ATANHI[3] + ATANLO[3] : -ATANHI[3] - ATANLO[3];
  }
  if (ix < 0x3fdc0000) { // |x| < 0.4375
    if (ix < 0x3e200000) return x; // |x| < 2^-29
    id = -1;
  } else {
    x = Math.abs(x);
    if (ix < 0x3ff30000) { // |x| < 1.1875
      if (ix < 0x3fe60000) { id = 0; x = (2 * x - 1) / (2 + x); } else { id = 1; x = (x - 1) / (x + 1); }
    } else if (ix < 0x40038000) { id = 2; x = (x - 1.5) / (1 + 1.5 * x); } // |x| < 2.4375
    else { id = 3; x = -1 / x; }
  }
  const z = x * x, w = z * z;
  const s1 = z * (AT[0] + w * (AT[2] + w * (AT[4] + w * (AT[6] + w * (AT[8] + w * AT[10])))));
  const s2 = w * (AT[1] + w * (AT[3] + w * (AT[5] + w * (AT[7] + w * AT[9]))));
  if (id < 0) return x - x * (s1 + s2);
  const r = ATANHI[id] - ((x * (s1 + s2) - ATANLO[id]) - x);
  return hx < 0 ? -r : r;
}

const PI = 3.1415926535897931160e+00, PI_O_2 = 1.5707963267948965580e+00, PI_O_4 = 7.8539816339744827900e-01,
  PI_LO = 1.2246467991473531772e-16;

export function atan2(y, x) {
  if (x !== x || y !== y) return NaN;
  const hx = hiWord(x), ix = hx & 0x7fffffff, lx = loWord(x);
  const hy = hiWord(y), iy = hy & 0x7fffffff, ly = loWord(y);
  if (((hx - 0x3ff00000) | lx) === 0) return atan(y); // x = 1
  const m = ((hy >>> 31) & 1) | ((hx >>> 30) & 2); // 2 * sign(x) + sign(y)
  if ((iy | ly) === 0) { // y = 0
    if (m < 2) return y;
    return m === 2 ? PI : -PI;
  }
  if ((ix | lx) === 0) return hy < 0 ? -PI_O_2 : PI_O_2; // x = 0
  if (ix === 0x7ff00000) { // x infinite
    if (iy === 0x7ff00000) return [PI_O_4, -PI_O_4, 3 * PI_O_4, -3 * PI_O_4][m];
    return [0, -0, PI, -PI][m];
  }
  if (iy === 0x7ff00000) return hy < 0 ? -PI_O_2 : PI_O_2; // y infinite
  const k = (iy - ix) >> 20;
  let z;
  if (k > 60) z = PI_O_2 + 0.5 * PI_LO; // |y/x| > 2^60
  else if (hx < 0 && k < -60) z = 0; // |y|/x < -2^60
  else z = atan(Math.abs(y / x));
  switch (m) {
    case 0: return z;
    case 1: return -z;
    case 2: return PI - (z - PI_LO);
    default: return (z - PI_LO) - PI;
  }
}

// --- hypot -----------------------------------------------------------------------------------------------------
// plain sqrt of the sum (exact rounding everywhere); game values never come near the overflow Math.hypot guards
export function hypot(x, y, z) {
  return z === undefined ? Math.sqrt(x * x + y * y) : Math.sqrt(x * x + y * y + z * z);
}

export const DMath = { sin, cos, atan, atan2, hypot };
