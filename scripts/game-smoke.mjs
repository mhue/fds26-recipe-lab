import { FOODS, impactFor, foodsForLevel, KCAL_TARGET } from "../src/game/foods.js";
import { computeScore } from "../src/game/teams.js";
import { NUTRISCORE_GRADES, NUTRISCORE_QUIZ } from "../src/game/nutriscore.js";

// 100 g de lentilles cuites ≈ 66 g CO₂e
const lentilles = FOODS.find((f) => f.id === "lentilles");
const beef = FOODS.find((f) => f.id === "boeuf");
if (!lentilles || !beef) {
  console.error("foods missing");
  process.exit(1);
}

const L = impactFor(lentilles, 100);
const B = impactFor(beef, 100);
if (Math.abs(L.co2g - 66.4) > 1) {
  console.error("lentilles co2 unexpected", L.co2g);
  process.exit(1);
}
if (B.co2g < L.co2g * 10) {
  console.error("beef should dwarf lentils", B.co2g, L.co2g);
  process.exit(1);
}

const cp = foodsForLevel("cp");
const cm = foodsForLevel("cm");
if (cp.length < 10 || cm.length < cp.length) {
  console.error("level catalogs unexpected", cp.length, cm.length);
  process.exit(1);
}

if (KCAL_TARGET.cp >= KCAL_TARGET.cm) {
  console.error("kcal targets");
  process.exit(1);
}

const low = computeScore({ mode: "climat", totalCo2g: 200, totalKcal: 500, targetKcal: 550 });
const high = computeScore({ mode: "climat", totalCo2g: 900, totalKcal: 500, targetKcal: 550 });
if (low <= high) {
  console.error("climat score order", low, high);
  process.exit(1);
}

if (NUTRISCORE_GRADES.length !== 5 || NUTRISCORE_QUIZ.length < 3) {
  console.error("nutriscore content");
  process.exit(1);
}

console.log("game-smoke ok", { foods: FOODS.length, cp: cp.length, cm: cm.length });
