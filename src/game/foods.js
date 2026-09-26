/**
 * Catalogue repas de midi — impacts CO₂ Agribalyse® 3.1 (ADEME) + kcal type CIQUAL.
 * co2PerKg = kg CO₂e / kg d’aliment (indicateur Changement_climatique).
 * Source : https://agribalyse.ademe.fr/ et API agribalyse-synthese (data.ademe.fr)
 *
 * Les composants du repas (et non les familles féculent/protéine/légume/fruit)
 * laissent choisir un aliment apprécié, ou « Rien ».
 */

/** @typedef {'entree'|'proteine'|'acc1'|'acc2'|'laitage'|'dessert'|'pain'|'extra'} FoodCategory */

/**
 * @typedef {object} Food
 * @property {string} id
 * @property {string} name
 * @property {string} agribalyse
 * @property {string} ciqual
 * @property {number} co2PerKg
 * @property {number} kcalPer100g
 * @property {FoodCategory} category
 * @property {string} hue
 * @property {string} tip
 */

/** Photos d’ingrédients (Wikimedia Commons / Pixabay), dans /public/foods. */
export function foodImage(food) {
  const base = import.meta.env?.BASE_URL || "/";
  return `${base}foods/${food.id}.jpg`;
}

/** @type {Food[]} */
export const FOODS = [
  {
    id: "carottes-rapees",
    name: "Carottes râpées",
    agribalyse: "Carottes râpées, avec sauce, préemballées",
    ciqual: "26257",
    co2PerKg: 1.36,
    kcalPer100g: 80,
    category: "entree",
    hue: "#f08a3a",
    tip: "La sauce de l’entrée compte un peu dans le CO₂.",
  },
  {
    id: "friand",
    name: "Friand au fromage",
    agribalyse: "Feuilleté ou Friand au fromage",
    ciqual: "25401",
    co2PerKg: 4.38,
    kcalPer100g: 302,
    category: "entree",
    hue: "#e6c07a",
    tip: "Pâte et fromage : bien plus d’impact qu’une soupe.",
  },
  {
    id: "soupe",
    name: "Soupe de légumes",
    agribalyse: "Soupe aux légumes variés, préemballée à réchauffer",
    ciqual: "25903",
    co2PerKg: 0.504,
    kcalPer100g: 39,
    category: "entree",
    hue: "#c45c3e",
    tip: "Une entrée légère pour le climat.",
  },
  {
    id: "poulet",
    name: "Poulet",
    agribalyse: "Poulet, filet, sans peau, cru",
    ciqual: "36017",
    co2PerKg: 5.404,
    kcalPer100g: 110,
    category: "proteine",
    hue: "#e8a07a",
    tip: "Moins de CO₂ que le bœuf, plus que les lentilles.",
  },
  {
    id: "boeuf",
    name: "Steak haché",
    agribalyse: "Bœuf, steak haché 15% MG, cru",
    ciqual: "6254",
    co2PerKg: 33.785,
    kcalPer100g: 220,
    category: "proteine",
    hue: "#a63d40",
    tip: "Très fort impact climat : à comparer avec le poulet ou les lentilles.",
  },
  {
    id: "lentilles",
    name: "Lentilles",
    agribalyse: "Lentille, cuite",
    ciqual: "20505",
    co2PerKg: 0.664,
    kcalPer100g: 115,
    category: "proteine",
    hue: "#7a5c45",
    tip: "Championnes du défi climat parmi les protéines !",
  },
  {
    id: "poisson-pane",
    name: "Poisson pané",
    agribalyse: "Poisson pané, frit",
    ciqual: "26030",
    co2PerKg: 9.23,
    kcalPer100g: 193,
    category: "proteine",
    hue: "#e8b86a",
    tip: "Le panage et la friture pèsent plus qu’un filet nature.",
  },
  {
    id: "saucisses",
    name: "Saucisses de poulet",
    agribalyse: "Saucisse de volaille, façon charcutière",
    ciqual: "30130",
    co2PerKg: 12.5,
    kcalPer100g: 231,
    category: "proteine",
    hue: "#d4787a",
    tip: "Une viande transformée : l’impact reste élevé.",
  },
  {
    id: "pates",
    name: "Pâtes",
    agribalyse: "Pâtes sèches standard, crues",
    ciqual: "9810",
    co2PerKg: 1.75,
    kcalPer100g: 350,
    category: "acc1",
    hue: "#e8c547",
    tip: "Peser les pâtes sèches, ou diviser par ~2,5 si cuites.",
  },
  {
    id: "riz",
    name: "Riz",
    agribalyse: "Riz blanc, cru",
    ciqual: "9100",
    co2PerKg: 1.72,
    kcalPer100g: 350,
    category: "acc1",
    hue: "#f0e6d2",
    tip: "Le riz a un impact proche des pâtes.",
  },
  {
    id: "pdt",
    name: "Pomme de terre",
    agribalyse: "Pomme de terre, sans peau, crue",
    ciqual: "4008",
    co2PerKg: 0.812,
    kcalPer100g: 80,
    category: "acc1",
    hue: "#d4b483",
    tip: "Un féculent local souvent très doux pour le climat.",
  },
  {
    id: "frites",
    name: "Frites",
    agribalyse: "Frites de pommes de terre, surgelées, cuites en friteuse",
    ciqual: "4032",
    co2PerKg: 1.46,
    kcalPer100g: 285,
    category: "acc1",
    hue: "#f0c14e",
    tip: "Même pomme de terre, mais la friture change l’énergie.",
  },
  {
    id: "haricots",
    name: "Haricots verts",
    agribalyse: "Haricot vert, cru",
    ciqual: "20061",
    co2PerKg: 0.503,
    kcalPer100g: 30,
    category: "acc2",
    hue: "#4f8f4f",
    tip: "Un légume très léger pour la planète.",
  },
  {
    id: "salade",
    name: "Salade",
    agribalyse: "Laitue, crue",
    ciqual: "20031",
    co2PerKg: 0.9,
    kcalPer100g: 15,
    category: "acc2",
    hue: "#7cb87a",
    tip: "Peu de calories, peu de CO₂.",
  },
  {
    id: "poelee",
    name: "Poêlée de légumes",
    agribalyse: "Poêlée de légumes assaisonnés sans champignon, surgelée, crue",
    ciqual: "20262",
    co2PerKg: 0.933,
    kcalPer100g: 81,
    category: "acc2",
    hue: "#6fa86f",
    tip: "Des légumes déjà assaisonnés, toujours légers pour le climat.",
  },
  {
    id: "yaourt",
    name: "Yaourt",
    agribalyse: "Yaourt, lait fermenté ou spécialité laitière, nature",
    ciqual: "19593",
    co2PerKg: 1.591,
    kcalPer100g: 55,
    category: "laitage",
    hue: "#f5f0e6",
    tip: "Produit laitier à impact moyen.",
  },
  {
    id: "fromage",
    name: "Fromage",
    agribalyse: "Emmental ou emmenthal",
    ciqual: "12115",
    co2PerKg: 5.092,
    kcalPer100g: 370,
    category: "laitage",
    hue: "#f0d060",
    tip: "Concentré : beaucoup de calories et de CO₂ pour peu de grammes.",
  },
  {
    id: "creme-caramel",
    name: "Crème caramel",
    agribalyse: "Crème caramel, rayon frais",
    ciqual: "39209",
    co2PerKg: 1.9,
    kcalPer100g: 132,
    category: "laitage",
    hue: "#c4844a",
    tip: "Un laitage sucré : plus de calories qu’un yaourt nature.",
  },
  {
    id: "banane",
    name: "Banane",
    agribalyse: "Banane, pulpe, crue",
    ciqual: "13005",
    co2PerKg: 0.793,
    kcalPer100g: 90,
    category: "dessert",
    hue: "#e8c547",
    tip: "Voyage plus loin, mais reste raisonnable.",
  },
  {
    id: "compote",
    name: "Compote",
    agribalyse: "Compote de pomme",
    ciqual: "13038",
    co2PerKg: 1.311,
    kcalPer100g: 70,
    category: "dessert",
    hue: "#d4a574",
    tip: "Un peu plus transformée qu’une pomme fraîche.",
  },
  {
    id: "gateau",
    name: "Gâteau au chocolat",
    agribalyse: "Gâteau au chocolat",
    ciqual: "23585",
    co2PerKg: 8.41,
    kcalPer100g: 441,
    category: "dessert",
    hue: "#5c3317",
    tip: "Dessert très sucré : les calories montent vite.",
  },
  {
    id: "salade-fruits",
    name: "Salade de fruits",
    agribalyse: "Salade de fruits, crue",
    ciqual: "13134",
    co2PerKg: 1.63,
    kcalPer100g: 51,
    category: "dessert",
    hue: "#e07a5f",
    tip: "Un dessert fruité, bien plus léger que le gâteau.",
  },
  {
    id: "pain",
    name: "Pain",
    agribalyse: "Pain, baguette, courante",
    ciqual: "7001",
    co2PerKg: 0.777,
    kcalPer100g: 255,
    category: "pain",
    hue: "#c4a574",
    tip: "Le pain a un impact assez bas pour un féculent.",
  },
  {
    id: "bonbons",
    name: "Bonbons",
    agribalyse: "Bonbons, tout type",
    ciqual: "31003",
    co2PerKg: 1.41,
    kcalPer100g: 411,
    category: "extra",
    hue: "#e06a9a",
    tip: "Beaucoup de sucre : les calories montent, le CO₂ moins.",
  },
  {
    id: "chips",
    name: "Chips",
    agribalyse: "Chips de pommes de terre, standard",
    ciqual: "4004",
    co2PerKg: 1.4,
    kcalPer100g: 545,
    category: "extra",
    hue: "#e8c547",
    tip: "Très caloriques, même pour une petite poignée.",
  },
  {
    id: "petit-beurre",
    name: "Petit-beurre",
    agribalyse: "Biscuit sec petit beurre",
    ciqual: "24015",
    co2PerKg: 2.47,
    kcalPer100g: 444,
    category: "extra",
    hue: "#d4b483",
    tip: "Un biscuit apporte plus d’énergie qu’un fruit.",
  },
];

export const CATEGORIES = [
  { id: "entree", label: "Entrée", need: true },
  { id: "proteine", label: "Protéines", need: true },
  { id: "acc1", label: "1er accompagnement", need: true },
  { id: "acc2", label: "2e accompagnement", need: true },
  { id: "laitage", label: "Laitage", need: true },
  { id: "dessert", label: "Dessert", need: true },
  { id: "pain", label: "Pain", need: true },
  { id: "extra", label: "Extras", need: true },
];

/**
 * @param {Food} food
 * @param {number} grams
 */
export function impactFor(food, grams) {
  const kg = grams / 1000;
  const co2Kg = food.co2PerKg * kg;
  const kcal = (food.kcalPer100g * grams) / 100;
  return {
    co2g: co2Kg * 1000,
    co2Kg,
    kcal,
  };
}

