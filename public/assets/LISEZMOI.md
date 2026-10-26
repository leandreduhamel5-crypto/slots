# Illustrations professionnelles

Déposez ici vos fichiers (PNG transparent conseillé) et déclarez-les dans `manifest.json`.
Tout fichier déclaré remplace automatiquement la version dessinée par le code. Tous les effets
(bloom, halos, rayons, reflets, particules, animations de gain, fumée et lévitation du personnage)
s'appliquent aussi aux images que vous ajoutez.

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
  "logo": "logo.png",
  "mascot": "mascot.png"
}
```

| Élément | Taille conseillée | Notes |
|---|---|---|
| Symboles | 640 × 640 px | Carré, fond transparent, sujet centré avec ~5 % de marge |
| Décor | 3840 × 2160 px | Cadré pour un écran 16:9 ; le centre est couvert par les rouleaux |
| Logo | 2200 × 720 px | Fond transparent |
| Personnage | 1000 × 1500 px | Fond transparent, le bas de l'image = le point où il flotte |

Un symbole remplacé garde toutes les animations génériques (rebond, rayons, balayage de lumière, éclat),
mais pas les animations de pièces (œil, paupière, mâchoire) qui dépendent des calques d'origine.
Un personnage remplacé garde la lévitation, l'aura, la fumée, les braises et les réactions, mais pas la
cape animée ni la mâchoire.

## Brief artistique (pour un illustrateur ou un générateur d'images)

**Direction :** horreur cartoon premium, façon grandes slots (Hacksaw, Nolimit City, Pragmatic).
Contours encrés épais, ombrage cel net, volumes forts, éclairage de contre-jour rouge, matières lisibles
(cuir, verre, métal, tissu). Palette : nuit violette `#120a18`, rouge infection `#ff3347`, cyan antidote
`#38dcff`, vert toxique `#7be05a`, laiton `#f2b642`. Inspiration d'ambiance : un asile/labo de jeu de
déduction horrifique en coopération, sans reprendre aucun personnage ni logo existant.

N'utilisez que des images dont la licence permet l'usage commercial, et pas d'œuvres d'autres jeux.

### Prompts (en anglais, ils fonctionnent mieux avec les générateurs)

Suffixe commun à ajouter à chaque prompt :
`premium slot machine symbol, cartoon horror style, thick black ink outlines, cel shading, strong rim light in red, high detail, game asset, centered, isolated on transparent background, no text`

| Fichier | Prompt |
|---|---|
| `symbols/codex.png` | an ancient grimoire bound in stitched red flesh-leather, brass corner guards, a single living reptilian red eye in the middle of the cover, glowing red veins spreading from the eye, blood dripping from the bottom edge |
| `symbols/infecte.png` | bust of a hooded infected monster, dark teal hood, charcoal skin cracked with glowing molten orange lines, burning yellow eyes, huge grin full of sharp fangs |
| `symbols/masque.png` | a battered olive rubber gas mask, brass lens rims with rivets, one cracked lens, glowing red eyes behind the glass, filter canister with yellow and black hazard stripes, green toxic smoke leaking |
| `symbols/antidote.png` | a glass syringe full of glowing cyan antidote liquid with bubbles, steel plunger, medical label with a red cross, a cyan droplet at the needle tip, sparkles |
| `symbols/poche.png` | a glossy plastic blood bag full of infected blood, biohazard label, red tube hanging, highlights on the plastic |
| `symbols/a.png` … `symbols/10.png` | the letter "A" (then "K", "Q", "J", "10") as chunky 3D cartoon lettering on a themed emblem: A blood splash, K cracked steel shield with bone crown, Q purple toxic cloud with an eyeball, J radioactive hazard disc, 10 rusty sawblade |
| `logo.png` | game logo reading "CODEX INFECTA", chunky bone-white 3D letters with blood dripping from the top, red jagged splash behind, purple ribbon with "INFECTA", two red eyes, transparent background |
| `mascot.png` | full body floating hooded wraith, tattered dark navy cloak, void face with burning yellow eyes and a wide fanged grin, one skeletal clawed hand holding a red flesh grimoire with an eye, the other levitating a glowing green orb, smoke at the hem, facing left, transparent background |
| `background.jpg` | (sans le suffixe) wide 16:9 painting of an abandoned infected asylum corridor in one-point perspective, tiled walls, metal doors with glowing red portholes, hanging lamps casting light cones, red veins crawling from a sealed door at the far end, checkered floor, toxic barrels in the foreground, cartoon horror style, cinematic lighting |
