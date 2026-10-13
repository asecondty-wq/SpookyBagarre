# Fabrication des personnages 3D

Chaîne utilisée pour les 9 personnages et le chat de la Folle Du Bus. Tout se relance avec les scripts de `tools/`.

## 1. Images de référence (Codex)

- `tools/art/refs.ps1` : une planche de personnage par monstre (`tools/art/refs/<id>.png`).
- `tools/art/apose.ps1` : une image de face, en A-pose, mains vides (`tools/art/apose/<id>.png`). C'est ce qui se rigge le mieux.
- `tools/art/props.ps1` : créatures et accessoires (le chat : `tools/art/props/cat.png`).
- Si Codex dit qu'il n'a pas pu enregistrer le fichier, `python tools/art/recover.py <log> <dossier>` le récupère dans `~/.codex/generated_images`.

## 2. Modèle 3D (Tripo)

`tools/tripo/tripo.ps1 model -Id <id> -Image tools/art/apose/<id>.png -Out tools/art/tripo -Faces 16000 -Estimate 30`

- 30 crédits par modèle (v3.0, texture standard). La clé est lue dans la variable Windows `TRIPO_API_KEY`, jamais écrite dans le projet.
- Le script refuse de descendre sous un plancher de crédits ; chaque tâche est notée dans `tools/tripo/ledger.jsonl`.
- Ne pas relancer une génération ratée sans en parler.

## 3. Mesure et squelette (Blender, en arrière-plan)

Tous les scripts se lancent avec `tools/blender/run.ps1 <script>.py --id <id> ...` (Blender 5).

1. `yaw.py --id <id> --height <m> --rotz -90` : les modèles sortent un peu tournés ; donne l'angle pour les remettre de face.
2. `prep.py --id <id> --height <m> --rotz <deg> [--dx --dy]` puis `python tools/blender/grid.py <id>` : vues de face, profil, dos, dessus avec une grille en mètres (`tools/blender/work/<id>/grid.png`).
3. On lit les articulations sur la grille et on écrit `tools/blender/rigs/<id>.json` : hauteur, rotation, os (`head`/`tail` en mètres, Blender : x = gauche du perso, y = dos, z = haut). Les os `.L` sont recopiés en `.R` automatiquement. Os possibles en plus du corps : `jaw`, `belly`, `tail1..4`, `ear.L`, `hat`, `dorsal`, jambe arrière `thigh.B/shin.B/foot.B`.
4. `rig.py --id <id>` : construit le squelette, calcule les poids (heat weights, ou maillage voxel de secours), rend des poses de test, exporte `assets/models/<id>.glb` (maillage skinné, sans animation).
5. `python tools/blender/sheet.py <id>` : planche des poses de test pour vérifier les déformations.
6. `portrait.py` : portraits des menus (`assets/ui/portraits/<id>.png`).
7. `prop.py --id cat --size 1.0 --rotz -90` : accessoires et créatures statiques (`assets/models/cat.glb`).

## Pandrezz, CD-Man et Vinylman

- `tools/art/pandrezz.ps1` : images Codex d'après les artworks de PANDREZZ copiés dans `tools/art/refs/pandrezz_*.png` (A-pose de Pandrezz dans `tools/art/apose/`, vues de face de CD-Man et Vinylman dans `tools/art/refs/`). Codex n'arrive souvent pas à enregistrer : l'image est dans `~/.codex/generated_images`.
- Pandrezz : Tripo (30 crédits) puis la chaîne habituelle (`rigs/pandrezz.json`, rotz -70).
- CD-Man et Vinylman ne sont pas riggés : `python tools/art/buddy_faces.py` découpe leurs visages-disques dans les images Codex, puis `run.ps1 buddies.py` les modélise en formes simples (torse, tête, bras et jambes séparés, pivots aux épaules et aux hanches) et exporte `assets/models/cdman.glb` / `vinylman.glb`. Le jeu les anime pièce par pièce (`src/render/pandrezzView.js`) ; leur tête-disque reste tournée vers la caméra.
- Le kamehameha (boule d'énergie entre les mains, rayon) est dessiné par des shaders dans `src/render/pandrezzView.js`, sans texture.

## Décors des arènes

- `tools/art/stages.ps1` : pour chaque arène, le sol vu du dessus (`<id>_top`), un panorama peint (`<id>_sky`) et une planche de 6 accessoires sur fond magenta (`<id>_props`).
- `python tools/art/stage_prep.py` : `assets/stages/<id>/top.jpg` et `sky.jpg`. `python tools/art/cutout.py <id>` : découpe les accessoires (`prop0..5.png`, `props.json`).
- `src/render/stages/painted.js` (table `ART`) : cadrage du panorama, fondu du sol lointain, brumes, rayons de lune, accessoires debout autour des arènes basses (`cards`) ou sur des îlots flottants au loin (`islands`, placés au-delà de la zone d'éjection).

## 4. Dans le jeu

- `src/render/rig/chars.js` : réglages par perso (garde, accroupi, foulée, os secondaires qui ballottent, accessoires tenus en main sur des « sockets », poses spéciales).
- `src/render/rig/library.js` : la bibliothèque de poses (états, coups).
- Banc d'essai : `?animtest=<id>&anim=states|moves|walk|run|<coup>&yaw=<deg>` affiche une planche du perso image par image.

## Ajouter un personnage

1. Images → Tripo → mesures → `rigs/<id>.json` → `rig.py` (ci-dessus).
2. `src/sim/chars/<id>.js` : stats, coups normaux (`normals()`), 4 spéciaux ; l'ajouter dans `src/sim/chars/index.js`.
3. `src/render/rig/chars.js` : son entrée `RIGS.<id>`.
4. Un repli en formes simples dans `src/render/chars.js` (au cas où le modèle ne charge pas).
5. `portrait.py --ids <id>`.
