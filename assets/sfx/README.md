# Bruitages perso (assets/sfx/)

Mets ici tes fichiers de bruitages : un fichier par son, nommé exactement comme le son.

- Format conseillé : `.ogg` (sinon `.mp3`, ou `.wav` en dernier recours), mono, 44,1 kHz, court (0,1 à 0,5 s).
- Un son qui a un fichier ici remplace le son synthétisé du jeu. Sans fichier, rien ne change.
- Variantes : `hitS`, `hitM`, `hitL`, `punchHeavy`, `slap`, `whoosh`, `jump` et `land` peuvent avoir plusieurs fichiers numérotés (`hitS1.ogg`, `hitS2.ogg`, `hitS3.ogg`... jusqu'à 6, sans trou) : le jeu en tire un au hasard à chaque coup, jamais deux fois de suite le même.

## Noms des sons

- Coups : `hitS`, `hitM`, `hitL`, `punchHeavy`, `slap`, `whoosh`, `pummel`
- Défense, attrape, KO : `shield`, `parry`, `grab`, `tech`, `ko`, `glass`
- Déplacements : `jump`, `jump2`, `land`, `thud`, `slip`, `ledge`, `respawn`
- Menus, décompte, match : `click`, `menuMove`, `menuOk`, `menuBack`, `countHi`, `countGo`, `game`, `crowd`
- Divers : `boom`, `quake`, `charge`, `flash`, `poof`

La liste est dans `SFX_FILES` (`src/audio/sfxfiles.js`) : pour ouvrir un autre son au remplacement, ajoute son nom dans cette liste.
