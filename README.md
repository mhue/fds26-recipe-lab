# Recipe Lab — lecture balance

Module web pour lire les chiffres d’une balance via la caméra du téléphone.

## Approche (peu d’exemples)

1. Détection du **cadre** de l’afficheur dans la zone jaune
2. Découpage fixe en **7 cases** : `XXXXX.XX`
   - 5 chiffres avant le point (les premiers peuvent être vides)
   - **toujours 2** chiffres après le point
   - au moins 1 chiffre à gauche
3. Apprentissage des glyphes à partir de vos captures annotées
4. Lecture live = comparaison aux templates (+ secours 7-segments)

## Mode d’emploi

1. `npm install && npm run dev` → ouvrir l’URL HTTPS sur le téléphone
2. Cadrez **tout l’écran digital** (pas seulement 2–3 chiffres)
3. Capturer / annoter quelques valeurs → **Apprendre** → **Lire**

L’aperçu montre le cadre (bleu), les 7 cases (vert) et le point décimal (jaune).

## Modules

- `src/templateModel.js` — apprentissage + reconnaissance par templates
- `src/datasetStore.js` / `src/datasetUi.js` — collecte / export ZIP
- `src/sevenSegment.js` — fallback / options avancées

## Astuce

Si un chiffre manque (ex. jamais de `7` dans vos 4 images), le fallback 7-segments tente de le lire. Ajouter 1–2 exemples qui contiennent ce chiffre améliore beaucoup le résultat.
