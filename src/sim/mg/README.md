# Écrire un ulti (mini-jeu)

Un ulti (mini-jeu) se joue à deux (`M.a`, joueur 0, et `M.v`, joueur 1, deux combattants tirés au hasard), toutes les
30 à 60 s de combat (au hasard), tiré au hasard parmi tous (`src/sim/minigames.js`). Pour en lancer un à la main : menu principal →
MINI-JEUX. Déroulé commun, déjà fait : 3,5 s de présentation (`M.ph === 'intro'` : un mouvement de caméra sur les
deux duellistes, le titre, **le but du jeu en une phrase** (écrite et dite) et les touches de chaque joueur), **10 s de jeu** (`M.ph === 'play'`, `M.t` de 1 à 600), puis l'écran « EZ WIN »
(`'outro'`) et l'animation des dégâts du perdant, le retour dans l'arène figée 2 s, le coup au perdant (il prend ses %
à ce moment-là), les faux succès et le flash info. Un jeu, ce sont deux fichiers :

- `src/sim/mg/<jeu>.js` : la règle, dans la simulation ;
- `src/render/mg/<jeu>.js` : l'affichage et les sons.

Les deux sont déclarés dans `src/sim/mg/index.js` et `src/render/mg/index.js`. Modèles complets à lire : les jeux de
`src/sim/minigames.js` (`candy`, `moral`, `dance`, `surgery`) et leur affichage dans `src/render/minigameView.js`
(`drawCandy`, `drawMoral`, `drawDance`, `drawSurgery`, leurs cas dans `onEvent`). Code et commentaires en français,
dans le style du projet (lignes longues, peu de commentaires mais utiles).

## La simulation (`src/sim/mg/<jeu>.js`)

```js
import { BTN, MOUSE, MV_L, MV_R, MV_D, DMath, MG_PLAY, clampN, payout, scorePayout, botLevel, slotOf } from './common.js';
export default {
  name: 'Concours de baffes',          // le nom affiché (succès, aide)
  init(W, A, V) { return { /* l'état g */ over: 0 }; },
  step(W, M, g, ia, iv) { /* une image de jeu */ },
  result(W, M, g) { return scorePayout(W, M, scoreA, scoreV, 15, 30); },
};
```

- **Déterministe, toujours** (le match en ligne rejoue les images, rollback) : le hasard vient de `W.rng()` (0..1) ou
  `W.rng.int(a, b)`, rien d'autre (jamais `Math.random`, `Date`, `performance`). Trigonométrie : `DMath.sin/cos/atan2/hypot`,
  jamais `Math.sin/cos/atan2/hypot/pow` ni `**` (`Math.sqrt/abs/min/max/floor/round` sont permis).
- **L'état `g` est du JSON simple** : nombres finis, chaînes, booléens, tableaux, objets simples. Pas de `Map`, `Set`,
  classes, fonctions, ni de références partagées entre deux endroits de `g`. Il est sauvegardé et rechargé tel quel.
- `step` est appelé à chaque image de jeu (60 par seconde). `ia`, `iv` : les entrées des joueurs 0 et 1, ou `null`
  quand c'est un CPU : le jeu fait alors jouer le CPU lui-même (`botLevel(W, M, i)` : 1 facile, 2 normal, 3 brutal ; un
  CPU doit pouvoir gagner comme perdre, et deux CPU ne doivent pas jouer exactement pareil).
- Une entrée : `{ mx, my, held, pressed }`. `mx, my` : le stick, -1..1, `my > 0` = haut. `pressed` : les boutons
  appuyés à cette image, `held` : tenus. Boutons : `BTN.A` (attaque, clic gauche), `BTN.X` (spécial, clic droit),
  `BTN.JUMP`, `BTN.SHIELD`, `BTN.GRAB`.
- **Tout ulti doit se jouer au clavier seul** (Clavier 1 : ZQSD, J, K, Espace... ; Clavier 2 : flèches et pavé
  numérique). Un clavier a le bit `DIGITAL` dans `held` : son stick vaut 0 ou ±1 (±0,707 en diagonale), jamais un peu.
  Là où il faut doser (un curseur à poser, une note à régler, une vitesse lente), le clavier a besoin de sa règle :
  partir doucement puis accélérer tant qu'on tient la touche (`P.kh`, les images tenues : voir `dog.js`, `tuning.js`, le
  bistouri), une touche pour « doucement », etc. Le vérifier avec `mgcheck` (il joue aussi au clavier).
  - Si la vue déclare `input: 'mouse'`, Clavier 1 envoie aussi la souris quand elle bouge : `held & MOUSE`, et
    `mx, my` sont alors un déplacement (environ 1 = 22 pixels de souris) ; sinon c'est un clavier normal.
  - `input: 'duel'` : deux sticks pour les manettes (stick droit dans `mx, my`, stick gauche dans `MV_*`) et pour
    Clavier 1 une fois sa souris utilisée ; un clavier seul reste un clavier (`DIGITAL`), au jeu de lui donner ses
    commandes (le duel au pistolet vise alors tout seul).
- Fin anticipée : `g.over = 1`. Sinon le jeu s'arrête à `M.t === MG_PLAY` (600).
- Évènements pour l'affichage et les sons : `W.emit('mgXxx', { ... })`, des nombres seulement, le nom commence par `mg`
  et porte le nom du jeu (`mgSlapHit`, `mgDogWoof`...). L'affichage ne lit que `W.mg` et ces évènements.
- `result` : `payout(W, slotGagnant, slotPerdant, pourcents, extra)` ou `scorePayout(W, M, sa, sv, base, div, max)` ; une
  égalité : `payout(W, -1, -1, 0)`. Le perdant prend entre 15 et 70 % environ (pas tout de suite : `payout` ne touche
  pas aux %, ils sont appliqués au coup de la reprise ; ne jamais modifier `damage` soi-même). `extra` peut porter des scores
  (`sa`, `sv`), affichés nulle part de force.

## L'affichage (`src/render/mg/<jeu>.js`)

```js
export default {
  title: 'CONCOURS DE BAFFES', color: '#ff5a3a', icon: '👋',
  goal: 'Appuie pile au bon moment pour mettre la plus grosse baffe !',  // le but, UNE phrase toute simple (dite à voix haute)
  keys: [['A', 'au bon moment']],   // les commandes montrées : [touche, action] ; touches : dirs, lr, up, down, stick,
                                    // rstick, mouse, A, X, JUMP, SHIELD, GRAB (le nom suit l'appareil : J, NUM 1, A...) ;
                                    // ou { pad: [...], kb: [...], kb1: [...] } quand elles changent selon l'appareil
  ach: [['Succès du gagnant', '...'], ['Succès du perdant', '...']],   // faux succès façon Steam
  news: (L, d) => `${L} GIFLÉ EN DIRECT : ${d} %`,                       // le titre du flash info (L : "J2 (PIKABOO)")
  draw(view, W, M, dt, alpha) { /* chaque image pendant le jeu et l'écran de victoire */ },
  onEvent(view, ev, W, M) { /* sons, particules, autocollants pour les évènements du jeu */ },
  // facultatif :
  input: 'mouse' | 'duel',          // voir plus haut
  gray: false,                      // ne pas griser la 3D derrière (par défaut grisée)
  countdown: false,                 // pas de gros chiffre rouge sur les 3 dernières secondes
  enter3D(view, W, M) {}, update3D(view, W, M, dt) {}, exit3D(view, W) {},   // jeu en 3D, dans l'arène
  proxy(view, F, W, M) {},          // pendant le jeu : null (normal), 'hide', ou un faux combattant à afficher
  warm(view, W, M) {},              // pendant la présentation : rendre une fois ce qui ferait un à-coup au premier dessin
};
```

On dessine sur un canevas 2D par-dessus le jeu, dans une grille virtuelle **640 x 360** (`view.g`, contexte 2D déjà mis
à l'échelle ; la partie visible déborde de `view.ox` à gauche et à droite, `view.oy` en haut et en bas : remplir le fond
de `-view.ox` à `640 + view.ox`). Le jeu se dessine en entier à chaque image (rien ne reste d'une image à l'autre).
L'état d'affichage libre du jeu en cours va dans `view.xs` (un objet vidé à chaque nouvel ulti).

Aides de `view` (une `MinigameView`, `src/render/minigameView.js`) :

- texte : `view.text(str, x, y, size, color, { align, title (police d'horreur), mono (gras épais), alpha, stroke: false })`,
  `view.wrap(str, cx, y, maxW, size, color)` (centré, 2 lignes), `view.wrapLeft(...)`, `view.panel(x, y, w, h, fond, bord)` ;
- `view.portraitAt(char, x, y, taille, couleur, miroir, alpha)` (la tête d'un perso, `W.fighters[slot].char`),
  `view.pname(slot)` ("J1"), `view.label(W, slot)` ("J1 · Pikaboo"), `view.timer(M, x, y)` (le chrono), `COLORS[slot]`
  (`src/sim/constants.js`) pour la couleur d'un joueur ;
- l'effet « TDAH » (à utiliser beaucoup, c'est le ton du jeu) : `view.burst(x, y, n, couleurs, { shape: 'sq' | 'dot' |
  'star' | 'shell' | 'txt', ch (un emoji pour 'txt'), speed, size, life, up, g, dir, spread })`,
  `view.sticker(texte, x, y, { size, color, bg, life, rot })` (un autocollant qui claque), `view.jolt(secousse, zoom,
  couleurÉclair, forceÉclair)`, `view.lines(durée)` (lignes de vitesse), `view.hype(n)` (bords arc-en-ciel),
  `view.confetti(n)`, `view.emojiRain(['💀', '🔥'], n)`, `view.pick(liste)`, `view.beatPop` (1 sur le temps, puis
  retombe : faire pulser des choses), `view.time` (secondes) ;
- son : `const A = view.audio` (peut être `null`) ; `A.sfx(nom, pan, volume, variante)` (variante 1, 2, 3... monte la
  hauteur de 12 % à chaque cran), `A.say(texte, hauteur, vitesse)` (voix de synthèse), `A.crowd()`. Sons existants :
  `hitS hitM hitL punchHeavy slap splat splatter whoosh click jump jump2 land thud parry glass ko wood woodM woodL zap
  zapS zapL thunder cash poof pop boing tongue slurp whip gulp spit gurgle throw shotgun fizz zip go boom wobble flash
  slip stab wave quake charge grab respawn countHi countGo game menuMove menuOk menuBack crowd bassDrop meow yowl hiss
  scratch cowbell fart flame sizzle glug clink kiss heart bark skate kickflip sample sob vape typing riff powerchord shred
  note larsen guitarHit guitarHitL guitarSmash blip error airhorn hitmark whinny`. Pas de nouveau son dans `audio.js`.
- 3D : `view.mv.root` (le groupe de la scène du match, pour y ajouter des objets), `view.R.camera` (la caméra, à
  replacer à chaque image dans `update3D` ; elle reprend toute seule après), `view.mv.views[slot]` (les combattants),
  `view.mv.particles`. Matériaux sûrs (pas de nouvelle compilation de shader qui fige le jeu) : `MeshLambertMaterial`,
  `MeshBasicMaterial`, `SpriteMaterial`. Pas de nouvelle lumière. Tout retirer dans `exit3D`.

Le ton : ultra dynamique, très « juicy » (chaque action a un son, des particules, un autocollant ; les gros moments
secouent l'écran), drôle, pixel art / cartoon. Les persos sont des potes du créateur : moquerie gentille seulement.

## Les modèles 3D des persos (marionnettes)

Les vrais modèles 3D des persos, animés, sur le canevas 2D : `view.puppet(char, x, y, h, opts)` dessine le perso
`char` (`W.fighters[slot].char`, ou n'importe quel perso : `'nymano'`, `'epektase'`... ou `'shiba'` pour Reyji) les
pieds en (x, y), haut de `h` (unités de la grille 640 x 360). Chaque appel rend le modèle (environ 1 ms) : 8 au plus
par image. Options :

- `state` : la pose du combat, `'idle'` (défaut), `'walk'`, `'run'`, `'air'` (`vy` > 0 monte, < 0 descend), `'crouch'`,
  `'shield'`, `'hitstun'` (sonné, `kb` = la force du coup), `'tumble'`, `'helpless'`, `'down'` (à terre), `'dizzy'`
  (étoiles), `'grabbed'`... ;
- `emote` : une animation entière par-dessus : `'select'` (sa provocation de la sélection) et `'win'` (sa danse de
  victoire) marchent pour tous ; aussi `'dance_01'` à `'dance_06'`, `'cheer'`, `'clap'`, `'sob'`, `'laugh_01'`,
  `'laugh_02'`, `'angry_01'`, `'angry_02'`, `'bow'`, `'greet_01'`, `'heart_pose'`, `'freaky'`, `'jump_rope_01'`,
  `'play_mobile_game'`, `'sing_02'`, `'victory_celebration'`, `'agree'`, `'complain_01'` (absents chez Epektase et
  PPROD, qui n'ont que `'select'` et `'win'` : sans le clip, il reste en pose) ; `emoteSpeed` ;
- `face` : `'front'` (défaut), `'left'`, `'right'`, `'back'`, `'three'` / `'threeL'` (trois quarts), ou un angle ;
- le côté décalé : `head` (grosse tête, 1 = normale, 1,5 à 2,2 = caricature), `squash: [sx, sy]` (écrasé / étiré),
  `rot` (rotation en radians, autour des pieds), `flip`, `alpha`, `tint` (une couleur d'éclat, `tintK` sa force),
  `shadow: false` (pas d'ombre au sol) ;
- `key` : une marionnette par clé (par défaut le nom du perso) ; deux fois le même perso à l'écran = deux clés ;
- Reyji (`'shiba'`) : `cmd` (`''`, `'bark'`, `'jump'`, `'spin'`, `'bite'`, `'dash'`), `speed` (m/s : il trotte, galope),
  `hop` (le soulever), `face`.

Déclarer `puppets: ['nymano', 'shiba']` dans la vue fait rendre ces persos-là une fois pendant la présentation (les deux
joueurs le sont toujours) : pas d'à-coup au premier dessin. D'autres clés (le même perso deux fois, une marionnette
dans un canevas à part) : les rendre dans `warm`.

Dans un jeu en 3D (`enter3D`), `sceneActor(view.mv.root, char)` (`src/render/puppets.js`) ajoute un vrai modèle dans la
scène de l'arène : `a.root` (à placer, agrandir, tourner), `a.pose(opts)` à chaque image (mêmes options), `a.dispose()`
dans `exit3D`.

## Vérifier

- `node tools/dev/mgcheck.mjs <jeu> 3` : CPU contre CPU et un « humain » aléatoire, état propre, retour en arrière à
  l'identique, déterminisme, gain raisonnable. Doit afficher « tout va bien ».
- `node tools/dev/ultishot.mjs <jeu> 30 <port>` (serveur `python3 tools/serve.py 8642` lancé) : un Chrome sans fenêtre
  joue l'ulti et enregistre une image sur 30 dans `tools/dev/shots/s_<jeu>_NNNN.png` ; les regarder (la présentation, le
  jeu, la fin). Avec `HUMANS=2` devant, les deux sont des joueurs au clavier : on voit leurs touches. Un port à soi si plusieurs tournent en même temps (9341, 9342...).
