# Assiette Lab — défi repas (Fête de la science)

Application web pour composer un **repas de midi**, **peser** les aliments et découvrir la somme de **CO₂** (Agribalyse® ADEME) et de **calories**. Défi entre petites équipes (école primaire).

## Démarrer

```bash
npm install
npm run dev
```

Ouvrir l’URL affichée (HTTPS) sur tablette / téléphone.

- `/` — jeu **Assiette Lab**
- `/balance.html` — module caméra pour lire l’afficheur d’une balance (optionnel)

## Publier sur le web

Le jeu est une page statique. GitHub Pages le construit à chaque push sur `cursor/scale-digit-reader` :

[https://mhue.github.io/fds26-recipe-lab/](https://mhue.github.io/fds26-recipe-lab/)

Les scores restent dans le navigateur de chaque appareil (`localStorage`) : le classement n’est pas partagé entre visiteurs.

## Déroulement du jeu

1. Choisir le type de défi
2. Nommer l’**équipe**
3. Composer une assiette complète : féculent + protéine + légume + fruit
4. **Peser** chaque aliment sur une balance et saisir les grammes (pavé numérique)
5. Voir le total **CO₂e** + **kcal**, puis le **classement**

### Deux défis

| Défi | Objectif |
|------|----------|
| **Planète** | Minimiser le CO₂ du repas |
| **Énergie** | Approcher la cible calories (≈ 550 kcal) |

Les scores sont stockés dans le navigateur (`localStorage`) pour animer un challenge sur un stand.

## Données

- **CO₂** : indicateurs *Changement climatique* d’[Agribalyse®](https://agribalyse.ademe.fr/app) (ADEME), en kg CO₂e / kg d’aliment
- **Calories** : valeurs type CIQUAL (indicatives, pour le jeu)

Le catalogue est dans `src/game/foods.js` (codes CIQUAL + références Agribalyse).

## Nutri-Score & Yuka

L’atelier **Nutri-Score** explique où trouver la lettre A→E sur les emballages, ce qu’elle signifie, avec un mini-quiz. Un encart oriente vers [Yuka](https://yuka.io/) pour un scan code-barres encadré par un adulte.

> Nutri-Score = nutrition · Agribalyse = climat — deux lectures complémentaires.

## Balance connectée (ou non)

Pour le stand, le plus simple est une **balance de cuisine classique** : les enfants lisent l’écran et tapent les grammes dans l’appli.

Le module `/balance.html` permet d’entraîner une lecture par caméra (apprentissage de templates) si vous voulez expérimenter une balance « connectée » via le téléphone.

## Structure

```
src/game/foods.js      catalogue Agribalyse + kcal
src/game/teams.js      scores / classement local
src/game/nutriscore.js atelier pédagogique
src/game/gameApp.js    parcours du jeu
src/game/game.css      interface
balance.html           lecteur d’afficheur (caméra)
```

## Tests

```bash
npm test
```
