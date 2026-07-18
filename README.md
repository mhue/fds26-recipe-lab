# Recipe Lab — lecture balance

Module web pour lire / collecter les chiffres digitaux d’une balance cuisine via la caméra du téléphone.

## Approche actuelle

La reconnaissance 7-segments + calibration reste disponible pour essais, mais n’est pas assez fiable sur toutes les balances.

**Piste prioritaire :** collecter des exemples annotés (image de l’écran + valeur lue), puis entraîner un petit réseau de neurones.

## Collecte d’exemples (recommandé)

1. `npm install && npm run dev`
2. Ouvrir l’URL HTTPS sur le téléphone (même Wi‑Fi)
3. Démarrer la caméra, cadrer **uniquement les chiffres**
4. Pour chaque exemple :
   - mettre un poids (ou tare `0.00`)
   - lire la valeur sur la balance
   - **Capturer la zone**
   - saisir la valeur → **Enregistrer**
5. Visez la diversité : `0.00`, puis beaucoup de chiffres/différentes longueurs, éclairages proches du stand
6. **Exporter .zip** quand vous avez une cinquantaine d’exemples (plus = mieux)

### Contenu du ZIP

```
images/sample_0001.png
...
labels.csv
manifest.json
```

`labels.csv` : `filename,label,width,height,captured_at`  
Le label est la valeur affichée (`0.00`, `125.4`, …).

Les exemples sont aussi stockés localement dans le navigateur (IndexedDB) jusqu’à export / effacement.

## Essais 7-segments (optionnel)

1. Cadrez les chiffres
2. Tarez (`0.00`) → **Calibrer sur 0.00**
3. **Lire le poids**

## Modules

- `src/datasetStore.js` / `src/datasetUi.js` — collecte + export
- `src/sevenSegment.js` / `src/scaleDigitReader.js` — tentative lecture 7-segments

## Suite

- Entraîner un classifieur / régresseur sur le dataset exporté
- Intégrer le modèle (ONNX / TF.js) dans l’app téléphone
