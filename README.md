# Recipe Lab — lecture balance

Module web pour lire les chiffres digitaux d’une balance cuisine via la caméra du téléphone.

## Approche

Pour un stand Fête de la Science, on privilégie **ce qui marche avec peu de réglages** :

1. **Téléphone + navigateur** — pas d’app native
2. **Cadre fixe (ROI)** — téléphone posé face à l’écran
3. **Reconnaissance 7-segments** — adaptée aux LCD/LED de balance (plus fiable que l’OCR classique)
4. **Polarité auto** — essaie LED claire et LCD sombre, garde le meilleur score
5. **Vote sur plusieurs frames** — médiane pour stabiliser

## Lancer (ordinateur)

```bash
npm install
npm run dev
```

Vite démarre en **HTTPS** et expose le réseau local (nécessaire pour la caméra sur téléphone).

## Sur le téléphone

1. Mac et téléphone sur le **même Wi‑Fi**
2. Dans le terminal, noter l’URL Network, du type `https://192.168.x.x:5173`
3. Ouvrir cette URL dans Safari / Chrome sur le téléphone
4. Accepter l’avertissement de certificat (auto-signé) — iPhone : *Afficher les détails* → *Visiter ce site web*
5. Autoriser la **caméra**
6. Cadrez **uniquement les chiffres** (pas le « g »), puis *Lire le poids*

## Utilisation

1. Démarrer la caméra
2. Serrer le cadre jaune sur les digits
3. Polarité : *Auto* en général ; forcer *LCD sombre* / *LED claire* si besoin
4. *Lire le poids* ou *Lecture continue*

L’aperçu montre l’image binaire et les cadres détectés autour de chaque chiffre.

## Modules

- `src/sevenSegment.js` — décodage 7-segments
- `src/scaleDigitReader.js` — capture ROI + vote temporel (`ScaleDigitReader`)

## Suite possible

- Brancher le poids sur la sélection d’aliments / calcul nutrition
