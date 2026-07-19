/** Contenu pédagogique Nutri-Score (atelier CP–CM2). */

export const NUTRISCORE_GRADES = [
  {
    letter: "A",
    color: "#038141",
    meaning: "Très favorable",
    kid: "Super choix ! Souvent des fruits, légumes, légumineuses…",
  },
  {
    letter: "B",
    color: "#85bb2f",
    meaning: "Favorable",
    kid: "Bon choix. On peut le manger souvent.",
  },
  {
    letter: "C",
    color: "#fecb02",
    meaning: "Moyen",
    kid: "Correct de temps en temps. On regarde aussi la quantité.",
  },
  {
    letter: "D",
    color: "#ee8100",
    meaning: "Peu favorable",
    kid: "À limiter. Souvent plus sucré, salé ou gras.",
  },
  {
    letter: "E",
    color: "#e63e11",
    meaning: "Moins favorable",
    kid: "Occasionnel. On préfère autre chose au quotidien.",
  },
];

export const NUTRISCORE_STEPS = [
  {
    title: "Où le trouver ?",
    body: "Sur le devant de l’emballage : une lettre de A à E dans une pastille colorée. Cherchez surtout en haut ou en bas du paquet.",
  },
  {
    title: "Comment ça marche ?",
    body: "Le Nutri-Score résume la qualité nutritionnelle pour 100 g (ou 100 ml). Il tient compte du sucre, du sel, des graisses saturées, mais aussi des fibres, protéines, fruits et légumes.",
  },
  {
    title: "Astuce pour le jeu",
    body: "Comparez deux produits du même type (deux yaourts, deux céréales). La lettre la plus proche de A est en général le meilleur choix nutritionnel.",
  },
  {
    title: "Avec Yuka",
    body: "L’appli Yuka scanne le code-barres et explique le Nutri-Score, les additifs et parfois l’impact. Parfait pour un atelier « chasse au logo » avec un adulte.",
  },
];

export const NUTRISCORE_QUIZ = [
  {
    q: "Quelle lettre est la plus favorable ?",
    choices: ["E", "C", "A"],
    answer: 2,
    explain: "A (vert foncé) est le meilleur score nutritionnel.",
  },
  {
    q: "Où cherche-t-on le Nutri-Score ?",
    choices: ["Sur le ticket de caisse", "Sur le devant de l’emballage", "Dans le frigo"],
    answer: 1,
    explain: "Il est affiché sur le devant du paquet, bien visible.",
  },
  {
    q: "Le Nutri-Score parle surtout de…",
    choices: ["Le goût", "La nutrition", "Le prix"],
    answer: 1,
    explain: "Il résume la qualité nutritionnelle, pas le prix ni le goût.",
  },
];
