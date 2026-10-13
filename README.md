# SpookyBagarre (par VibePandrezz)

Un jeu de baston à la Smash Bros, en 3D, au-dessus d'un cimetière hanté. Jusqu'à 4 joueurs, à la manette (Xbox de préférence) ou au clavier, en local ou **en ligne avec tes copains** : il suffit d'un lien.

Le but : éjecter les autres de la plateforme. Plus un adversaire a de pourcentage de dégâts, plus il vole loin.

## Jouer tout de suite (sur ton PC)

Le jeu tourne dans le navigateur. Il faut juste un petit serveur local (le navigateur refuse de charger les modèles 3D depuis un fichier ouvert directement) :

1. Double-clique sur `Jouer.cmd`, **ou** ouvre un terminal dans ce dossier et lance `python tools/serve.py 8642`.
2. Ouvre <http://localhost:8642> dans Chrome, Edge ou Firefox.
3. Branche ta manette avant ou après, elle est reconnue toute seule.

## Les commandes

| Manette Xbox | Clavier (joueur 1) | Action |
| --- | --- | --- |
| Stick gauche | ZQSD / WASD | Se déplacer (pousser fort = courir) |
| **A** | J | Coup normal. **A + direction en même temps = smash** (A + haut = smash haut) |
| **X** | K | Coup spécial. X seul, X + côté, X en l'air ou + haut, X + gâchette = 4 spéciaux différents par perso |
| B ou Y | Espace | Sauter (deux fois en l'air, la grenouille en a plus) |
| LT / RT | L | Bouclier. Bouclier pile au bon moment = **parade** |
| LB / RB | U | Attraper, puis direction pour lancer |
| Start | Échap | Pause |

Joueur 2 au clavier : flèches, pavé numérique 1/2/0/3.

## Les 9 monstres

- **Croâssassin** — la grenouille : langue-fouet, langue-grappin, saut géant, il avale et recrache.
- **Président Micron** — billets, nuage de poudre de perlimpinpin, « Jupiter » et l'article 49.3 (imparable).
- **Gros Cainri Puant** — burger bombe, rafale de frites, soda-fusée, bide atomique.
- **Il Parmigiano** — un bloc de parmesan qui se râpe lui-même pour vous jeter dessus.
- **Pikaboo** — un petit monstre qui dresse des humains : ses Humanballs libèrent des humains sauvages.
- **Tung Tung Tung Sahur** — la bûche à la batte, plus forte sur le temps de la musique.
- **Tralalero Tralala** — le requin à trois pattes en baskets.
- **La Folle Du Bus** — la vieille sorcière qui a perdu son chat… et vous jette tous les autres : minou qui s'agrippe à la tête et griffe, gros matou qui roule, balai magique, nuée de chatons.
- **Pandrezz** — le héros de PANDREZZ, un rockeur barbu beaucoup trop fort : kamehameha à charger (maintenir X), kamehameha-fusée vers le bas pour remonter, et il appelle ses potes : **CD-Man** lance trois CD (le dernier en or), **Vinylman** tombe du ciel, tourne comme un disque et lâche les basses.

## 9 arènes

Cimetière, Marais Croâssant, Élysée Hanté, Diner de la Mort, Cave d'Affinage, Arène Pikaboo, Village du Sahur, Mer Tralala et le Grenier de la Folle Du Bus. Chacune a son piège (foudre, tampon géant, râpe, meute de chats…), désactivable dans les règles.

## Jouer en ligne

Un joueur choisit **Créer un salon en ligne** : il obtient un code. Les autres choisissent **Rejoindre un salon** et entrent ce code. La connexion est directe entre vos navigateurs (pas de serveur à installer). Pour que tes copains puissent jouer depuis chez eux, le jeu doit être en ligne : voir juste en dessous.

## Mettre le jeu en ligne gratuitement (GitHub Pages)

1. Sur <https://github.com>, crée un dépôt (par exemple `spookyBagarre`), public.
2. Envoie ce dossier dedans (avec GitHub Desktop : *Add local repository* puis *Publish*).
3. Sur la page du dépôt : *Settings* → *Pages* → *Source : Deploy from a branch* → branche `main`, dossier `/ (root)` → *Save*.
4. Au bout d'une minute, ton jeu est sur `https://<ton-pseudo>.github.io/spookyBagarre/`. Envoie ce lien à tes copains.

## Réglages

Dans *Options* : volumes, quantité d'hémoglobine (jusqu'à « À FOISON »), image **Lisse (HD)** ou **Rétro N64**, vibrations, pseudo.

## Pour aller plus loin

- `docs/PORTING.md` explique comment le jeu est construit et comment le passer sur Godot ou Unity pour en faire un « vrai » jeu.
- `docs/ASSETS.md` explique comment les personnages 3D ont été faits (images, Tripo, Blender, squelette) et comment en ajouter un.
- Banc d'essai des animations : `http://localhost:8642/?animtest=frog&anim=states` (ou `anim=moves`, `anim=smash`, `anim=walk`…).
