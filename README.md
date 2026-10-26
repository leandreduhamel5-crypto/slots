# Codex Infecta

Machine à sous vidéo de démonstration (crédits fictifs, aucune valeur réelle). Elle reprend la mécanique « Book » : 5 rouleaux × 3 rangées, 10 lignes et un symbole qui s'étend pendant les tours gratuits. L'univers est une horreur gothique « infectée ».

## Lancer

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # build de production dans dist/
npm run sim        # simulation Monte Carlo du modèle mathématique
```

En mode dev, la console permet de forcer une situation : `game.debug('feature' | 'big' | 'retrigger' | 'expand')`.

## Règles

- **Codex (joker + scatter)** : il remplace tous les symboles sur une ligne. 3, 4 ou 5 Codex n'importe où paient 2×, 20× ou 200× la mise totale.
- **3 Codex ou plus** déclenchent **10 tours gratuits**. Le Codex tire alors une **souche** : un symbole qui s'étend sur tout le rouleau et paie sur les 10 lignes, même si les rouleaux ne sont pas côte à côte.
- **Mutation** : chaque re-déclenchement donne +10 tours et ajoute une souche (3 souches actives au maximum).
- Gain maximal plafonné à **5 000×** la mise.

## Modèle mathématique

Résultats sur 20 millions de tours, avec deux graines différentes :

| | |
|---|---|
| RTP | ≈ 95,8 % (jeu de base ≈ 60 %, tours gratuits ≈ 36 %) |
| Fréquence de gain | ≈ 29 % (1 tour sur 3,4) |
| Tours gratuits | ≈ 1 tour sur 250, gain moyen ≈ 90× |
| Volatilité | élevée (écart-type ≈ 15) |

Les bandes de rouleaux sont fixes et générées de façon déterministe à partir du nombre de chaque symbole par rouleau (`src/math/config.ts`). Le tirage utilise `crypto.getRandomValues` avec échantillonnage par rejet, donc sans biais de modulo.

## Architecture

```
src/math/      moteur pur (sans rendu) : config, RNG, évaluation, tour complet
src/server/    serveur de jeu simulé (façon RGS) : solde, tirage, reprise de partie
src/game/      client PixiJS v8 : rouleaux, présentation des gains, overlays, décor, audio
src/game/art/  symboles dessinés à la main en SVG
src/ui/        HUD DOM, table des paiements
scripts/       simulateur Monte Carlo
```

- Le serveur calcule le tour entier (jeu de base et tous les tours gratuits) avant toute animation. Le client se contente de mettre en scène un résultat déjà décidé.
- La partie en cours est sauvegardée : si on recharge la page au milieu des tours gratuits, la partie reprend là où elle s'était arrêtée.
- Tout le visuel est généré dans le navigateur (SVG, Canvas 2D, PixiJS) et tout le son est synthétisé avec la Web Audio API. Le projet ne contient aucun fichier image ou audio.
- Des illustrations professionnelles peuvent remplacer les symboles, le décor ou le logo : déposez les fichiers dans `public/assets/` et déclarez-les dans `public/assets/manifest.json` (voir `public/assets/LISEZMOI.md`).
- `npm run dev` puis http://localhost:5173/gallery.html affiche une planche de tous les visuels (symboles, effets, mascotte) pour la revue artistique, et http://localhost:5173/lab.html les symboles premium peints en grand (`?only=codex` pour n'en voir qu'un).
- Un gain inférieur ou égal à la mise s'affiche sans célébration. Cela évite les « pertes déguisées en gains ».
