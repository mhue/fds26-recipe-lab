const STORAGE_KEY = "assiette-lab-scores-v1";

/**
 * @typedef {object} MealItem
 * @property {string} foodId
 * @property {string} foodName
 * @property {number} grams
 * @property {number} co2g
 * @property {number} kcal
 */

/**
 * @typedef {object} TeamScore
 * @property {string} id
 * @property {string} name
 * @property {string} color
 * @property {'cp'|'ce'|'cm'} level
 * @property {'climat'|'energie'} mode
 * @property {MealItem[]} items
 * @property {number} totalCo2g
 * @property {number} totalKcal
 * @property {number} score
 * @property {number} at
 */

export const TEAM_COLORS = [
  { id: "vert", hex: "#2f6f4e", label: "Vert" },
  { id: "bleu", hex: "#2a6f8f", label: "Bleu" },
  { id: "orange", hex: "#c56a2d", label: "Orange" },
  { id: "prune", hex: "#6b4c7a", label: "Prune" },
  { id: "rouge", hex: "#a63d40", label: "Rouge" },
  { id: "moutarde", hex: "#b8942e", label: "Moutarde" },
];

/** @returns {TeamScore[]} */
export function loadScores() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** @param {TeamScore[]} scores */
export function saveScores(scores) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scores.slice(0, 40)));
}

/**
 * Score défi climat : plus bas CO₂ = mieux (on inverse pour le classement).
 * Score défi énergie : proximité de la cible kcal.
 * @param {{ mode: 'climat'|'energie', totalCo2g: number, totalKcal: number, targetKcal: number }} p
 */
export function computeScore(p) {
  if (p.mode === "climat") {
    // 1000 pts − grammes CO₂ (plancher 0)
    return Math.max(0, Math.round(1000 - p.totalCo2g));
  }
  const gap = Math.abs(p.totalKcal - p.targetKcal);
  return Math.max(0, Math.round(1000 - gap * 2));
}

/**
 * @param {Omit<TeamScore, 'id'|'at'|'score'> & { targetKcal: number }} entry
 */
export function addScore(entry) {
  const scores = loadScores();
  const score = computeScore({
    mode: entry.mode,
    totalCo2g: entry.totalCo2g,
    totalKcal: entry.totalKcal,
    targetKcal: entry.targetKcal,
  });
  /** @type {TeamScore} */
  const row = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: entry.name,
    color: entry.color,
    level: entry.level,
    mode: entry.mode,
    items: entry.items,
    totalCo2g: entry.totalCo2g,
    totalKcal: entry.totalKcal,
    score,
    at: Date.now(),
  };
  scores.unshift(row);
  saveScores(scores);
  return row;
}

export function clearScores() {
  localStorage.removeItem(STORAGE_KEY);
}

/** @param {'climat'|'energie'} mode */
export function rankingFor(mode) {
  return loadScores()
    .filter((s) => s.mode === mode)
    .sort((a, b) => b.score - a.score || a.totalCo2g - b.totalCo2g);
}
