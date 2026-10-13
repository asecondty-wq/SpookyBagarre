# Porter spookyBagarre sur un vrai moteur

## La recommandation : Godot 4

Pour en faire un jeu à vendre (Steam, consoles plus tard), le meilleur choix ici est **Godot 4** :

- gratuit, sans redevance, léger, il exporte vers Windows, Mac, Linux, Web, Android et (via des partenaires) les consoles ;
- il lit nativement le **glTF** (`.glb`) : les 8 personnages riggés, le chat et les décors passent tels quels, squelette compris ;
- son langage, GDScript, ressemble beaucoup au JavaScript du jeu actuel : la logique se recopie presque ligne à ligne ;
- le multijoueur en ligne existe de base (ENet et WebRTC).

Unity marcherait aussi (C#, plus lourd, licence payante au-delà d'un certain chiffre d'affaires). Unreal est surdimensionné pour un jeu de ce style.

Tant que le jeu se joue entre copains via un lien, le garder en web (Three.js) reste le plus simple : rien à installer, le lien suffit.

## Comment le jeu est découpé (et pourquoi ça se porte bien)

```
src/sim/      la SIMULATION : règles, combats, personnages, arènes, bots. Aucun affichage, aucune dépendance.
src/render/   l'AFFICHAGE : Three.js, modèles, animations procédurales, particules, effets.
src/audio/    sons et musiques synthétisés (WebAudio).
src/net/      réseau pair-à-pair (PeerJS / WebRTC).
src/ui/       menus et HUD (HTML/CSS).
src/game/     colle entre tout ça : match local, client en ligne, salon.
```

La simulation est **pure** : un objet `World` avance d'un pas fixe de 1/60 s (`World.step(inputs)`), avec des données simples (nombres, chaînes, tableaux) que l'on peut sérialiser. Rien n'y dépend de Three.js ni du navigateur. C'est ce qui permet le jeu en ligne (l'hôte simule, les autres reçoivent des instantanés) et c'est ce qui rend le portage simple : on traduit `src/sim/` en GDScript (ou C#) fichier par fichier, puis on refait l'affichage avec les outils du moteur.

### Correspondances

| Ici | Dans Godot |
| --- | --- |
| `World.step()` appelé 60 fois par seconde | `_physics_process(delta)` avec `physics_ticks_per_second = 60` |
| `src/sim/chars/*.js` (stats, coups, spéciaux) | une ressource `.tres` par personnage + un script de coups |
| `src/sim/entities.js` (projectiles, chats, nuages…) | des scènes `Area3D` légères, ou la même logique en script |
| `assets/models/*.glb` (riggés) | glisser-déposer : `Skeleton3D` + `MeshInstance3D` automatiques |
| `src/render/rig/animator.js` (ressorts, IK) | `Skeleton3D.set_bone_pose_rotation()` chaque image, ou `SkeletonIK3D` pour les pieds |
| `src/render/rig/library.js` (poses) | même chose, ou des clips `AnimationPlayer` faits dans Blender |
| `src/render/fx.js` (sang, éclats, tremblements) | `GPUParticles3D`, `Camera3D` secouée par script, post-process `WorldEnvironment` |
| `src/audio/music.js` | fichiers audio exportés, ou `AudioStreamGenerator` |
| `src/net/net.js` (PeerJS) | `WebRTCMultiplayerPeer` ou `ENetMultiplayerPeer` ; même schéma hôte → instantanés |
| `src/ui/` | nœuds `Control` |

### Les animations

Les personnages n'ont **pas de clips d'animation** : chaque image, `src/render/rig/poser.js` calcule une pose (garde, marche aux pieds plantés par IK, réactions, images clés des coups calées sur les frames de la simulation), et `animator.js` fait suivre chaque os par un ressort amorti (rebond, retard, inertie des ventres, queues, chapeaux). On peut garder exactement ce système dans Godot (c'est du calcul sur des quaternions), ou exporter ces poses en clips.

## Ordre conseillé pour un portage

1. Créer le projet Godot, importer `assets/models/*.glb`, vérifier les squelettes.
2. Traduire `src/sim/util.js`, `constants.js`, `stage.js`, `fighter.js`, `world.js`, `kit.js`, puis un personnage simple (Gros Cainri Puant).
3. Brancher la manette et un affichage minimal (capsules), tester un combat.
4. Traduire les autres personnages, les entités, les arènes, les bots.
5. Refaire l'affichage : modèles, poses, effets, caméra, HUD, menus.
6. Le réseau en dernier.
