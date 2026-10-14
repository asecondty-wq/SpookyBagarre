# SpookyBagarre (par VibePandrezz)

Un jeu de baston à la Smash Bros : des graphismes en 3D, mais on se bat en 2D, de gauche à droite, comme dans Smash. Jusqu'à 4 joueurs, à la manette (Xbox de préférence) ou au clavier, en local ou **en ligne avec tes copains** : il suffit d'un lien.

Le but : éjecter les autres de la plateforme. Plus un adversaire a de pourcentage de dégâts, plus il vole loin.

## Jouer tout de suite (sur ton PC)

Le jeu tourne dans le navigateur. Il faut juste un petit serveur local (le navigateur refuse de charger les modèles 3D depuis un fichier ouvert directement) :

1. Double-clique sur `Jouer.cmd`, **ou** ouvre un terminal dans ce dossier et lance `python tools/serve.py 8642`.
2. Ouvre <http://localhost:8642> dans Chrome, Edge ou Firefox.
3. Branche ta manette avant ou après, elle est reconnue toute seule.

## Les commandes

| Manette Xbox | Clavier (joueur 1) | Action |
| --- | --- | --- |
| Stick gauche | ZQSD / WASD | Marcher. **Deux fois vite d'un côté = courir** (comme dans Smash : on peut repartir dans l'autre sens, et un saut en courant garde son élan). Bas = **s'accroupir** (le corps est plus bas, et on est un peu moins éjecté). **Deux fois bas** sur une plateforme fine = passer à travers ; **bas maintenu en l'air** = traverser les plateformes fines (jamais la plateforme principale). Bas en retombant = chute rapide. **Haut d'un coup sec** = sauter (option « Saut avec le stick ») |
| **A** en courant | J | Le **coup de course** de chaque monstre : glissade, plaquage, coup de pied sauté, corde à linge... |
| **A** | J | Coup normal. **A A A** = gauche, droite, coup final. **Côté + A A A** = coup de pied, coup de fesse, coup de tête. Haut + A = coup de tête vers le haut. A + direction **maintenu** = smash chargé. Un coup rapide qui touche s'annule dans le suivant |
| **A** en l'air | J | Aérien neutre, avant, arrière (stick vers l'arrière), haut, bas (météore) |
| **X** | K | Coup spécial. X seul, X + côté, X + bas : 3 spéciaux par perso, chacun avec un temps de recharge : trois arcs au sol sous le monstre (or = neutre, bleu = côté, rose = bas) se remplissent puis s'allument quand le spécial est prêt (un spécial appuyé trop tôt fait un « clic » et son arc clignote en rouge). Plus un spécial rapporte, plus il est long à revenir (mesuré sur des centaines de matchs CPU). **X + haut** (ou X + saut) : la remontée, propre à chaque perso, sans recharge ; elle attrape le bord de loin, même en montant |
| B ou Y | Espace | Sauter (deux fois en l'air, la grenouille en a plus) |
| LT / RT | L | Bouclier. Bouclier + côté = **roulade invincible** (environ 3,5 m, on finit retourné), bouclier + bas = esquive sur place, en l'air = esquive. Bouclier pile au bon moment = **parade** |
| LB / RB | U | Attraper, puis direction pour lancer (avant, arrière, haut, bas) |
| Start | Échap | Pause |

Joueur 2 au clavier : flèches, pavé numérique 1/2/0/3.

## Les 16 monstres

- **Croâssassin** — la grenouille : langue-fouet, langue-grappin, saut géant, il avale et recrache.
- **Président Micron** — billets, nuage de poudre de perlimpinpin, « Jupiter » et l'article 49.3 (imparable).
- **Gros Cainri Puant** — burger bombe, rafale de frites, soda-fusée, bide atomique.
- **Il Parmigiano** — un bloc de parmesan qui se râpe lui-même pour vous jeter dessus.
- **Pikaboo** — un petit monstre qui dresse des humains : ses Humanballs libèrent des humains sauvages.
- **Tung Tung Tung Sahur** — la bûche à la batte, plus forte sur le temps de la musique.
- **Tralalero Tralala** — le requin à trois pattes en baskets.
- **La Folle Du Bus** — la vieille sorcière qui a perdu son chat… et vous jette tous les autres : minou qui s'agrippe à la tête et griffe, gros matou qui roule, balai magique, nuée de chatons.
- **Pandrezz** — le héros de PANDREZZ, un rockeur barbu beaucoup trop fort : kamehameha à charger (maintenir X), kamehameha-fusée vers le bas pour remonter, et il appelle ses potes : **CD-Man** lance trois CD (le dernier en or), **Vinylman** tombe du ciel, tourne comme un disque et lâche les basses.

- **Aboueb** — le basketteur aux boucles infinies : assiettes de couscous (la semoule fait glisser), boucles-fouet et boucles-grappin, ballon de basket rebondissant, tapis volant.
- **Tices** — l'Alsacien : flammekueche-frisbee, une rasade de rhum puis il crache le feu (ça brûle), prouts toxiques, pet-propulsion.
- **OMFU** — le DJ : cowbells 808 (TONK sur la tête), bucket de poulet, platines en pleine figure, scratch-ondes, enceinte-catapulte.
- **Lolobiscotto** — piment qui met le feu, bouteille de Ricard (flaque glissante et vapeurs d'anis, pastis-fusée), et son petit chat gris et blanc qu'elle vous lance.
- **J'san** — sa vapoteuse et son shiba : c'est le chien qui mord, charge, saute, tournoie et aboie à sa place.
- **Nymano** — toujours triste, il pleure (on glisse sur ses larmes) ; il frappe et roule en skate, et balance des samples sur sa SP-404.
- **BIDO** — le gros musclé au grand cœur : haltères, kettlebell, barre, disques… et des bisous en cœur qui font mal.

## 9 arènes

Cimetière, Marais Croâssant, Élysée Hanté, Diner de la Mort, Cave d'Affinage, Arène Pikaboo, Village du Sahur, Mer Tralala et le Grenier de la Folle Du Bus. Chacune a son piège (foudre, tampon géant, râpe, meute de chats…), désactivable dans les règles.

## Jouer en ligne

Un joueur choisit **Créer un salon en ligne** : il obtient un code. Les autres choisissent **Rejoindre un salon** et entrent ce code. La connexion est directe entre vos navigateurs (pas de serveur à installer). Pour que tes copains puissent jouer depuis chez eux, le jeu doit être en ligne : voir juste en dessous.

## Mettre le jeu en ligne gratuitement (GitHub Pages)

1. Sur <https://github.com>, crée un dépôt (par exemple `spookyBagarre`), public.
2. Envoie ce dossier dedans (avec GitHub Desktop : *Add local repository* puis *Publish*).
3. Sur la page du dépôt : *Settings* → *Pages* → *Source : Deploy from a branch* → branche `main`, dossier `/ (root)` → *Save*.
4. Au bout d'une minute, ton jeu est sur `https://<ton-pseudo>.github.io/spookyBagarre/`. Envoie ce lien à tes copains.

## Tes musiques

Mets tes fichiers dans `assets/music/` : `menu.mp3` (ou `menu.ogg`) pour les menus, et `combat1.ogg`, `combat2.ogg`… ou `battle1.ogg`, `battle2.ogg`… (numérotés sans trou) : une est tirée au hasard à chaque combat. S'il n'y a pas de fichier, le jeu joue sa musique d'origine.

## Réglages

Dans *Options* : volumes, quantité d'hémoglobine (jusqu'à « À FOISON »), image **Lisse (HD)** ou **Rétro N64**, vibrations, pseudo.

## Pour aller plus loin

- `docs/PORTING.md` explique comment le jeu est construit et comment le passer sur Godot ou Unity pour en faire un « vrai » jeu.
- `docs/ASSETS.md` explique comment les personnages 3D ont été faits (images, Tripo, Blender, squelette) et comment en ajouter un.
- Banc d'équilibrage (tournoi de CPU, pourcentage de victoires par perso) : `http://localhost:8642/tools/balance.html?n=24`.
- Banc d'essai des animations : `http://localhost:8642/?animtest=frog&anim=states` (ou `anim=moves`, `anim=smash`, `anim=walk`…).
- Tests sans le son : ajoute `&mute=1` à l'adresse (les parties de test `?quick=1` sont muettes d'office, `&sound=1` pour les entendre).
