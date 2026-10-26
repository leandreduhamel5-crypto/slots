# Illustrations professionnelles

Déposez ici vos fichiers (PNG transparent conseillé) et déclarez-les dans `manifest.json`.
Tout fichier déclaré remplace automatiquement la version dessinée par le code.

```json
{
  "symbols": {
    "codex": "symbols/codex.png",
    "zero": "symbols/infecte.png",
    "mask": "symbols/masque.png",
    "antidote": "symbols/antidote.png",
    "blood": "symbols/poche.png",
    "a": "symbols/a.png",
    "k": "symbols/k.png",
    "q": "symbols/q.png",
    "j": "symbols/j.png",
    "ten": "symbols/10.png"
  },
  "background": "background.jpg",
  "logo": "logo.png"
}
```

| Élément | Taille conseillée | Notes |
|---|---|---|
| Symboles | 640 × 640 px | Carré, fond transparent, sujet centré avec ~5 % de marge |
| Décor | 3840 × 2160 px | Cadré pour un écran 16:9 ; le centre est couvert par les rouleaux |
| Logo | 2200 × 720 px | Fond transparent |

Un symbole remplacé garde toutes les animations génériques (rebond, rayons, balayage de lumière, éclat),
mais pas les animations de pièces (œil, paupière, mâchoire) qui dépendent des calques d'origine.
