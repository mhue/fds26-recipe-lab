/**
 * Catalogue repas de midi — impacts CO₂ Agribalyse® (ADEME) + kcal type CIQUAL.
 * co2PerKg = kg CO₂e / kg d’aliment (indicateur Changement_climatique).
 * Source : https://agribalyse.ademe.fr/ et API agribalyse-synthese (data.ademe.fr)
 */

/** @typedef {'feculent'|'proteine'|'legume'|'fruit'|'laitier'} FoodCategory */

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
    id: "pain",
    name: "Pain",
    agribalyse: "Pain, baguette, courante",
    ciqual: "7001",
    co2PerKg: 0.777,
    kcalPer100g: 255,
    category: "feculent",
    hue: "#c4a574",
    tip: "Le pain a un impact assez bas pour un féculent.",
  },
  {
    id: "pates",
    name: "Pâtes",
    agribalyse: "Pâtes sèches standard, crues",
    ciqual: "9810",
    co2PerKg: 1.75,
    kcalPer100g: 350,
    category: "feculent",
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
    category: "feculent",
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
    category: "feculent",
    hue: "#d4b483",
    tip: "Un féculent local souvent très doux pour le climat.",
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
    id: "jambon",
    name: "Jambon",
    agribalyse: "Jambon cuit, choix",
    ciqual: "28910",
    co2PerKg: 7.083,
    kcalPer100g: 120,
    category: "proteine",
    hue: "#d4787a",
    tip: "Comme beaucoup de viandes, son impact est élevé.",
  },
  {
    id: "oeuf",
    name: "Œuf",
    agribalyse: "Oeuf, cru",
    ciqual: "22000",
    co2PerKg: 2.117,
    kcalPer100g: 140,
    category: "proteine",
    hue: "#f2d27a",
    tip: "Bonne protéine avec un impact moyen.",
  },
  {
    id: "saumon",
    name: "Saumon",
    agribalyse: "Saumon, cru, élevage",
    ciqual: "26036",
    co2PerKg: 5.63,
    kcalPer100g: 200,
    category: "proteine",
    hue: "#e07a5f",
    tip: "Poisson : impact proche du poulet.",
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
    id: "pois-chiches",
    name: "Pois chiches",
    agribalyse: "Pois chiche, cuit",
    ciqual: "20507",
    co2PerKg: 0.799,
    kcalPer100g: 160,
    category: "proteine",
    hue: "#c9a66b",
    tip: "Légumineuse : peu de CO₂, beaucoup de fibres.",
  },
  {
    id: "carotte",
    name: "Carotte",
    agribalyse: "Carotte, crue",
    ciqual: "20009",
    co2PerKg: 0.405,
    kcalPer100g: 35,
    category: "legume",
    hue: "#f08a3a",
    tip: "Légume à très faible impact.",
  },
  {
    id: "tomate",
    name: "Tomate",
    agribalyse: "Tomate de saison, crue",
    ciqual: "20047",
    co2PerKg: 0.658,
    kcalPer100g: 18,
    category: "legume",
    hue: "#e05a4f",
    tip: "De saison, son impact reste bas.",
  },
  {
    id: "courgette",
    name: "Courgette",
    agribalyse: "Courgette, pulpe et peau, cuite",
    ciqual: "20021",
    co2PerKg: 1.394,
    kcalPer100g: 20,
    category: "legume",
    hue: "#6fa86f",
    tip: "Légume d’été, bon pour colorer l’assiette.",
  },
  {
    id: "haricots",
    name: "Haricots verts",
    agribalyse: "Haricot vert, cru",
    ciqual: "20061",
    co2PerKg: 0.503,
    kcalPer100g: 30,
    category: "legume",
    hue: "#4f8f4f",
    tip: "Encore un légume très léger pour la planète.",
  },
  {
    id: "salade",
    name: "Salade",
    agribalyse: "Laitue, crue",
    ciqual: "20031",
    co2PerKg: 0.9,
    kcalPer100g: 15,
    category: "legume",
    hue: "#7cb87a",
    tip: "Peu de calories, peu de CO₂.",
  },
  {
    id: "pomme",
    name: "Pomme",
    agribalyse: "Pomme, pulpe, crue",
    ciqual: "13050",
    co2PerKg: 0.529,
    kcalPer100g: 52,
    category: "fruit",
    hue: "#c45c5c",
    tip: "Fruit local souvent excellent pour le défi climat.",
  },
  {
    id: "banane",
    name: "Banane",
    agribalyse: "Banane, pulpe, crue",
    ciqual: "13005",
    co2PerKg: 0.793,
    kcalPer100g: 90,
    category: "fruit",
    hue: "#e8c547",
    tip: "Voyage plus loin, mais reste raisonnable.",
  },
  {
    id: "orange",
    name: "Orange",
    agribalyse: "Orange, pulpe, crue",
    ciqual: "13034",
    co2PerKg: 0.553,
    kcalPer100g: 45,
    category: "fruit",
    hue: "#f0a040",
    tip: "Bonne source de vitamine C, faible CO₂.",
  },
  {
    id: "compote",
    name: "Compote",
    agribalyse: "Compote de pomme",
    ciqual: "13038",
    co2PerKg: 1.311,
    kcalPer100g: 70,
    category: "fruit",
    hue: "#d4a574",
    tip: "Un peu plus transformée qu’une pomme fraîche.",
  },
  {
    id: "yaourt",
    name: "Yaourt",
    agribalyse: "Yaourt, lait fermenté ou spécialité laitière, nature",
    ciqual: "19593",
    co2PerKg: 1.591,
    kcalPer100g: 55,
    category: "laitier",
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
    category: "laitier",
    hue: "#f0d060",
    tip: "Concentré : beaucoup de calories et de CO₂ pour peu de grammes.",
  },
  {
    id: "fromage-blanc",
    name: "Fromage blanc",
    agribalyse: "Fromage blanc nature, 0% MG",
    ciqual: "19644",
    co2PerKg: 1.572,
    kcalPer100g: 48,
    category: "laitier",
    hue: "#f7f4ec",
    tip: "Plus léger que le fromage à pâte dure.",
  },
  {
    id: "lait",
    name: "Lait",
    agribalyse: "Lait demi-écrémé, UHT",
    ciqual: "19041",
    co2PerKg: 0.983,
    kcalPer100g: 46,
    category: "laitier",
    hue: "#f2f5f8",
    tip: "Utile pour atteindre l’objectif calories sans trop de CO₂.",
  },
];

export const CATEGORIES = [
  { id: "feculent", label: "Féculents", need: true },
  { id: "proteine", label: "Protéines", need: true },
  { id: "legume", label: "Légumes", need: true },
  { id: "fruit", label: "Fruits", need: true },
  { id: "laitier", label: "Laitiers", need: false },
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

/** Objectif calories repas de midi (indicatif) */
export const KCAL_TARGET = 550;
