# Recipe Lab — lecture balance

Module web minimal pour lire les chiffres digitaux d’une balance cuisine via la caméra du téléphone (OCR).

## Pourquoi cette approche

Pour un stand Fête de la Science, on privilégie **ce qui marche avec peu de réglages** :

1. **Téléphone + navigateur** — pas d’app native à installer
2. **Cadre fixe (ROI)** — le téléphone est posé face à l’écran ; on cadre une fois les chiffres
3. **Tesseract.js** — OCR dans le navigateur, whitelist chiffres uniquement
4. **Vote sur 5 frames** — lisse les lectures instables

## Lancer

```bash
npm install
npm run dev
```

Ouvrir l’URL affichée **sur le téléphone** (même Wi‑Fi). La caméra exige HTTPS ou `localhost`.

## Utilisation

1. Démarrer la caméra
2. Ajuster le cadre jaune sur les chiffres de la balance
3. Cocher « Inverser » si l’écran LCD est sombre sur fond clair mal contrasté
4. « Lire le poids » (une fois) ou « Lecture continue »

## Module principal

La logique réutilisable est dans `src/scaleDigitReader.js` (`ScaleDigitReader`).

## Suite possible

- Brancher le poids lu sur la sélection d’aliments / calcul nutrition
- Si l’OCR peine sur un modèle de balance 7-segments très stylisé : reconnaître les segments plutôt que le texte
