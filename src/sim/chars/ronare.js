// Ronare (21e perso, 17 oct. 2026) : son modèle vient du site de Meshy (tools/blender/fbx_textured.py, riggé par
// tools/meshy/meshy.py rig --glb), ses animations sont celles de Pandrezz recopiées sur son squelette
// (tools/art/meshy_transfer.py, CHARACTERS.ronare de meshy_pack.py). Pour l'instant, le moveset de Pandrezz à
// l'identique : kamehameha, CD-Man, Vinylman, la fusée, le même ultime (à ses couleurs). Une copie profonde de la
// fiche brute de Pandrezz (avant les réglages de index.js, qui modifient les coups en place : chacun les siens).
import pandrezz from './pandrezz.js';

const copy = (o) => (Array.isArray(o) ? o.map(copy)
  : o && typeof o === 'object' && Object.getPrototypeOf(o) === Object.prototype ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, copy(v)]))
    : o);

export default {
  ...copy(pandrezz),
  id: 'ronare', name: 'Ronare', title: 'Le gardien. Il a piqué les coups de Pandrezz (pour l\'instant).',
  color: '#e8b93a',
};
