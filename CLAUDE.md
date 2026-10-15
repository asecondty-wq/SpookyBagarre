# SpookyBagarre (par VibePandrezz) : entrée pour Claude Code

Guide du projet pour qui veut l'avancer (toi, un pote, ou son Claude Code). Les notes privées du créateur (comptes,
crédits, chemins de sa machine) sont dans `CLAUDE.local.md`, non publié.

Jeu de baston à la Smash Bros : graphismes en 3D, combat en 2D (plan z = 0), jusqu'à 4 joueurs, local ou en ligne.
Three.js sans build (import map dans `index.html`), JavaScript en modules ES, réseau PeerJS (WebRTC).
Publié sur GitHub Pages : <https://redpandrezz.github.io/SpookyBagarre/> (dépôt `redpandrezz/SpookyBagarre`).

Le projet est en français : échanges, docs, textes du jeu.

## Règles de travail

- **Pas de commit ni de push sans demande explicite.** Republier le site = commit + `git push` sur `main` (GitHub Pages se met à jour tout seul).
- Ne jamais publier : photos de vraies personnes (`refs personnages/`, `tools/art/friends/`), `CLAUDE.local.md`, journaux de tâches (`*ledger.jsonl`), `*.log` (voir `.gitignore`).
- Le travail non commité est le travail en cours : ne pas l'annuler, le déplacer ni le « nettoyer ».
- **Tests toujours muets** : `?quick=1` est muet d'office ; sinon ajouter `&mute=1`. Ne jamais ouvrir le menu sans `&mute=1` (une touche débloque l'audio).
- Services payants (Meshy, Tripo, Uthana, PixelLab) : clés d'API (`MESHY_API_KEY`, `TRIPO_API_KEY`, `UTHANA_API_KEY`, `PIXELAB_API_KEY`) seulement dans les variables d'environnement de l'utilisateur, jamais écrites dans le projet, affichées ni recopiées.
- **Ne jamais dépenser sans accord** : uniquement les crédits existants, jamais d'achat. Une étape payante à la fois : lancer, vérifier le résultat (le regarder, le mesurer), le montrer, attendre l'accord avant la suivante. Lire le solde avant chaque lot, journaliser chaque tâche (`ledger.jsonl`, non publié). Une seule tentative par objet (un échec peut avoir été débité).
- Images de référence et sprites d'impact : Codex ; ses copies échouent souvent : `python tools/art/codex_recover.py <dossier> [noms]`.
- Outils Python : Python 3 avec `numpy` et `Pillow`. Node pour les tests de netcode (`tools/dev/*.mjs`).
- Fins de ligne : beaucoup de fichiers sont en CRLF, d'autres en LF. Les préserver (vérifier avec `git diff --ignore-cr-at-eol --stat`).

## Lancer et tester

- Serveur : `Jouer.cmd` ou `python tools/serve.py 8642`, puis <http://localhost:8642>. Il peut s'être arrêté entre deux sessions : le relancer.
- Match de test : `?quick=1&chars=<a>,<b>&humans=1&dev=vpad0&bot=0&hazards=0&stage=cemetery` (manette virtuelle `window.__vpads[0] = { axes:[mx,my], buttons:{a,x,jump,shield,grab} }`).
- Matchs CPU : `?quick=1&chars=a,b,c,d&humans=0&stage=<id>&mute=1`. Vérifier les erreurs avec un écouteur `error` / `unhandledrejection` (les 404 de `assets/music/*.mp3|ogg` sont des essais de formats, normaux).
- `tools/dev/posecheck.js` : fige la boucle, `P.stepN(n)` avance de n images, `P.go(slot, move, ...)`, `P.strip(...)` planche d'images. Neutraliser `__app.renderer.kick` pour des captures propres.
- `tools/dev/balance.js` : matchs CPU sans affichage, stats par perso et par coup. Mesure de référence : éjections − chutes par match sur 800 matchs (deux graines) ; écart −0,43 à +0,47 au 14 oct. 2026.
- `tools/dev/propsheet.js` : planche des accessoires 3D.
- Banc d'animation : `?animtest=<id>&anim=states|moves|walk|run|<coup>&yaw=<deg>`.
- Remplacer les entrées de tous les joueurs : surcharger `__app.match.inputs` (retourne `{ slot: { mx, my, held, pressed } }`).

## Architecture

- `src/sim/` : simulation déterministe à pas fixe 60 Hz (`World.step(inputs)`), RNG à graine. Persos dans `src/sim/chars/` (`normals()`, `dashAttack()`, 4 spéciaux), temps de recharge dans `specialTuning.js`, contrôles et physique dans `fighter.js` (course : coup sec du stick en ≤ 4 images, ou double appui, au clavier la course part dès l'appui (bit `DIGITAL` des échantillons), Ctrl = marcher (stick à 0,6) ; clavier 1 : ZQSD, Espace saut, clic gauche A, clic droit X, Shift bouclier, E chope ; A dans les `SMASH_WIN` = 5 images après le coup sec = smash, pas coup de course ; stick droit = A + direction 70 ms, géré dans `input.js` ; esquive aérienne une fois après un B+haut (`adHelpless`) ; accroupi, saut, plateformes fines), bots dans `bot.js`, arènes dans `src/sim/stages/`.
- `src/render/` : affichage. Squelettes et poses : `src/render/rig/` (`animator.js` ressorts, `poser.js` poses + couches de clips natifs, `library.js` poses procédurales, `nativeClips.js` / `nativeMoves.js` clips Tripo et Uthana, `chars.js` / `friendRigs.js` réglages par perso). Impacts : `fx.js`, `hitSprites.js`, `particles.js`. Accessoires 3D : `propModels.js` (`fitProp`, table `FIX`).
- `src/core/input.js` (manettes, clavier, saut au stick), `src/core/settings.js` (réglages en localStorage), `src/ui/` (menus, HUD, vitrine de sélection).
- Interface en pixel art (direction « Crypte », 14 oct. 2026) : tout est posé sur une grille virtuelle 640×360 (`src/ui/pxgrid.js`, boîtes `.px` mises à l'échelle par `--k`). Scène des menus `src/ui/crypt.js` (fresque `assets/ui/crypt/fresco.png` où les potes sont peints, brouillard, chauves-souris, bougies, gags), dalle de tombeau des transitions `src/ui/slab.js` (`Screens.go(fn)`), styles `css/crypt.css`, HUD `src/ui/hud.js`. Filtre pixel sur la 3D (combats et menus) : option « Filtre pixel » (`settings.pixel` : 0, 360, 540, 720), appliqué à chaud par `renderer.setPixels` ; l'ancien rendu « rétro N64 » (au chargement) y est converti. Images : Codex (`tools/art/ui_crypt.ps1`, puis `codex_recover.py tools/art/ui/crypt`), mise à la grille et palette commune `tools/art/ui_cut.py`, petites pièces dessinées au pixel `tools/art/ui_kit.py` (panneaux 9-slice, cadres, portraits `kit/p40`). Captures exactes même fenêtre cachée : `tools/dev/pxshot.js` (le serveur les écrit dans `tools/dev/shots/`, non publié).
- Musiques (`src/audio/tracks.js`) : `menu`, `battle1..`, et facultatifs `titre`, `persos`, `victoire` (une fois, puis `resultats` ou le menu), `options`, `salon`, `finale`, `go`, `combat_<arène>`.
- En ligne : `src/net/net.js` (PeerJS, ou onglets du même navigateur avec `?net=local`), `src/game/session.js` (salon : quand tout le monde est prêt, n'importe quel joueur appuie sur START et choisit l'arène (`lobby.chooser`), les autres, l'hôte compris, regardent ; il décide aussi de la suite aux résultats ; l'hôte sans perso est spectateur), `src/net/rollback.js` + `src/game/rollbackMatch.js` (rollback, voir plus bas). L'ancien mode (l'hôte envoie des images, `src/game/clientMatch.js`) reste accessible avec `?netmode=snap` chez l'hôte.
- Modèles : 8 persos sur rig Tripo (`tools/art/tripo_pack.py`), 8 sur squelettes Blender recevant les mêmes clips (`tools/art/legacy_pack.py`, originaux dans `tools/art/legacy_old8/`). Les deux scripts ne gardent que les clips utilisés (`used_clips()` lit `poser.js` et `nativeMoves.js`).
- PPROD (18e perso, Meshy, même chaîne) : `src/sim/chars/pprod.js`, `src/render/rig/pprodRig.js` (chaise et PC Meshy dans `assets/models/props/`, pièces, pizza, spaghettis faits en code), clips dans `CHARACTERS.pprod` de `meshy_pack.py`.
- Epektase (17e perso, Meshy) : ses animations sont toutes à lui (`NATIVE_MOVES.epektase`, `NATIVE_STATES` dans `nativeMoves.js`). Chaîne : `tools/meshy/meshy.py` (payant, une étape à la fois), `tools/art/meshy_transfer.py` (transfert gratuit de clips d'un squelette à un autre), `tools/art/meshy_pack.py` (modèle du jeu, extraits `derive`, `--prop`). Détails dans `docs/ASSETS.md`. Les sources Meshy (`tools/art/meshy/`, 200 Mo : modèles bruts, clips achetés) restent sur la machine du créateur, non publiées.
- Allonge des coups : pendant un coup normal, `src/render/rig/reach.js` étire le membre (ou l'arme, `cfg.reach.weapon`) qui frappe jusqu'à sa zone de frappe et fait avancer le corps (jusqu'à 0,5 m, à l'affichage seulement) ; les zones de frappe trop longues sont recalées dans `src/sim/chars/reachFit.js` (membre tendu + 0,3 m, au moins 65 % de l'ancienne portée). Vérifier avec `tools/dev/reachcheck.js` (`sheet` : planche avec les zones en rouge, `measure`, `fitTable`). Un nouveau perso ou un coup changé : refaire la mesure.
- Doc détaillée : `docs/ASSETS.md` (chaîne des modèles, décors, accessoires, impacts, équilibrage), `docs/PORTING.md` (portage conseillé : Godot 4).

## Pièges connus

- Un `Armature` tourné : l'os du haut est relatif à lui (`preInv` dans `animator.js`), sinon le perso montre son dos quand il regarde à gauche. Toujours vérifier les deux sens.
- Les squelettes Tripo sont à l'échelle ~×2 : les décalages de hanches sont convertis dans l'échelle du parent (`sclM` dans `animator.js`).
- Les clips en boucle (`idle`, `walk`, `run`) sont nettoyés de leur dérive au chargement (`nativeClips.js`).
- Lisibilité : pas de fumées ni d'effets qui couvrent l'écran (choix du créateur) ; secousse et flou plafonnés (`camera.shake`, `renderer.kick`).
- Codex depuis PowerShell 5.1 : script en UTF-8 avec BOM, pas de guillemets droits dans les descriptions (mettre “ ”), le texte avant `-i` (qui avale plusieurs fichiers). Il ignore souvent le fond magenta demandé : `ui_cut.py` détoure aussi les fonds unis.
- Le menu caché du navigateur réduit la page à 300×150 : forcer `innerWidth/innerHeight` à 1280×720 puis `__app.renderer.resize()` avant une capture.

## Netcode : rollback (fait le 14 oct. 2026, pas encore essayé entre vrais PC)

1. ✅ Déterminisme : `src/sim/dmath.js` (fdlibm, identique au bit près à `Math` de V8, mais pareil sur tous les navigateurs). Dans `src/sim`, utiliser `DMath.sin/cos/atan2/hypot`, jamais `Math.sin/cos/atan2/hypot/pow/**` ; `Math.sqrt/abs/min/max/floor/round` sont exacts partout.
2. ✅ État : `src/sim/state.js` (`saveState`, `loadState`, `hashState`, `diffSaved`). `World.advance(samples)` = une image de 1/60 s à partir des entrées brutes `{mx,my,held,cnt}` (ralentis, horloge du rythme `realTime` et appuis calculés dans la simulation). Un nouveau champ de `World` modifié pendant le match doit être ajouté à `WORLD_KEYS`. Vérification : `node tools/dev/rollbackcheck.mjs [matchs] [images] [graine]`, aussi utilisable dans la console.
3. ✅ Session : `RollbackCore` (`src/net/rollback.js`, sans affichage) : chaque PC fait tourner le match, les entrées passent par l'hôte (étoile) sur le canal rapide, répétées sur 10 images ; retard d'entrée 2 images (`?idelay=` chez l'hôte), prédiction jusqu'à 8 images puis attente ; les invités se calent sur l'horloge de l'hôte (pings) ; sons et effets d'une image rejouée pas rejoués. Un invité muet 3 s est joué par l'ordinateur (`makeBot`, via le flux d'entrées : même image partout) et retiré du salon.
4. ✅ Empreintes toutes les 60 images confirmées ; en cas d'écart, l'hôte renvoie son état (`rsync`, découpé en morceaux) et l'affiche en bas de son écran.
5. ✅ Tests : `node tools/dev/netsim.mjs [secondes]` (3 PC virtuels, lag, gigue, pertes, départ d'un joueur, comparés à une partie de référence). Dans le navigateur : deux onglets `?net=local&mute=1&netlag=50&jitter=20&loss=0.05`, le transport local simule alors le mauvais réseau.
- À faire : essai réel avec des potes ; retard d'entrée choisi selon le ping ; le relais par l'hôte double le trajet entre deux invités (un maillage direct entre invités le réduirait).
