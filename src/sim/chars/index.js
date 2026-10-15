// Character registry. Each file exports a definition: stats, moves (normals + 4 specials), extra entities.
import frog from './frog.js';
import micron from './micron.js';
import bubba from './bubba.js';
import parmesan from './parmesan.js';
import pika from './pika.js';
import tung from './tung.js';
import shark from './shark.js';
import catlady from './catlady.js';
import pandrezz from './pandrezz.js';
import aboueb from './aboueb.js';
import tices from './tices.js';
import omfu from './omfu.js';
import lolobiscotto from './lolobiscotto.js';
import jsan from './jsan.js';
import nymano from './nymano.js';
import bido from './bido.js';
import epektase from './epektase.js';
import pprod from './pprod.js';
import skanky from './skanky.js';
import { applySpecialTuning } from './specialTuning.js';
import { applyReachFit } from './reachFit.js';

export const CHARS = { frog, micron, bubba, parmesan, pika, tung, shark, catlady, pandrezz, aboueb, tices, omfu, lolobiscotto, jsan, nymano, bido, epektase, pprod, skanky };
applySpecialTuning(CHARS); // cooldowns of the ranged specials, capped pokes (specialTuning.js)
applyReachFit(CHARS); // the normals' hitboxes where the stretched limbs reach (reachFit.js)
export const CHAR_ORDER = ['frog', 'micron', 'bubba', 'parmesan', 'pika', 'tung', 'shark', 'catlady', 'pandrezz', 'aboueb', 'tices', 'omfu', 'lolobiscotto', 'jsan', 'nymano', 'bido', 'epektase', 'pprod', 'skanky'];
