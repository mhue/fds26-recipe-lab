/**
 * Besoins énergétiques moyens, filles et garçons confondus.
 * Collège national des pédiatres universitaires, tableau 14.2 :
 * https://www.pedia-univ.fr/deuxieme-cycle/referentiel/gastroenterologie-nutrition-chirurgie-abdomino-pelvienne/alimentation-besoins-nutritionnels-du-nourrisson-lenfant
 * Le déjeuner compte pour 35 % des apports du jour.
 */

/** @typedef {'cp'|'ce1'|'ce2'|'cm1'|'cm2'} LevelId */

/**
 * @typedef {object} SchoolLevel
 * @property {LevelId} id
 * @property {string} label
 * @property {number} age
 * @property {number} dailyKcal moyenne filles + garçons
 */

/** @type {SchoolLevel[]} */
export const SCHOOL_LEVELS = [
  { id: "cp", label: "CP", age: 6, dailyKcal: 1650 },
  { id: "ce1", label: "CE1", age: 7, dailyKcal: 1750 },
  { id: "ce2", label: "CE2", age: 8, dailyKcal: 1850 },
  { id: "cm1", label: "CM1", age: 9, dailyKcal: 1950 },
  { id: "cm2", label: "CM2", age: 10, dailyKcal: 2050 },
];

/** @param {LevelId|string} id */
export function levelById(id) {
  return SCHOOL_LEVELS.find((level) => level.id === id) || SCHOOL_LEVELS[0];
}

/** Cible du déjeuner, arrondie au kcal. */
export function lunchKcal(id) {
  return Math.round(levelById(id).dailyKcal * 0.35);
}
