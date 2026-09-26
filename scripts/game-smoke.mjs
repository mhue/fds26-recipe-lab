import { CATEGORIES, FOODS, impactFor } from "../src/game/foods.js";
import { lunchKcal } from "../src/game/levels.js";
import { computeScore } from "../src/game/teams.js";
import { NUTRISCORE_GRADES, NUTRISCORE_QUIZ } from "../src/game/nutriscore.js";
import {
  formatChipId,
  formatGrams,
  isUsbSerialPort,
  parseScaleLine,
  selectGrantedScalePort,
} from "../src/game/usbScale.js";

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

if (FOODS.length < 20) {
  console.error("catalog unexpected", FOODS.length);
  process.exit(1);
}

if (lunchKcal("cp") !== 578 || lunchKcal("cm2") !== 718) {
  console.error("lunch targets", lunchKcal("cp"), lunchKcal("cm2"));
  process.exit(1);
}

const removed = ["jambon", "oeuf", "saumon", "pois-chiches", "carotte", "tomate", "courgette", "fromage-blanc", "lait"];
const added = [
  "carottes-rapees",
  "friand",
  "soupe",
  "poisson-pane",
  "saucisses",
  "frites",
  "poelee",
  "creme-caramel",
  "gateau",
  "salade-fruits",
  "bonbons",
  "chips",
  "petit-beurre",
];
if (removed.some((id) => FOODS.some((f) => f.id === id))) {
  console.error("removed foods still in catalog");
  process.exit(1);
}
if (added.some((id) => !FOODS.some((f) => f.id === id)) || CATEGORIES.length !== 8) {
  console.error("meal components incomplete", CATEGORIES.map((c) => c.id));
  process.exit(1);
}

const low = computeScore({ mode: "climat", totalCo2g: 400, totalKcal: 500, targetKcal: 578 });
const mid = computeScore({ mode: "climat", totalCo2g: 900, totalKcal: 500, targetKcal: 578 });
const heavy = computeScore({ mode: "climat", totalCo2g: 3500, totalKcal: 500, targetKcal: 578 });
if (!(low > mid && mid > heavy && heavy > 0 && low < 1000)) {
  console.error("climat score order", { low, mid, heavy });
  process.exit(1);
}
// Ancien bug : 1000 − grammes → 0 dès 1 kg CO₂e
if (computeScore({ mode: "climat", totalCo2g: 1200, totalKcal: 500, targetKcal: 578 }) <= 0) {
  console.error("climat score still collapses above 1 kg");
  process.exit(1);
}

const closeEnergy = computeScore({ mode: "energie", totalCo2g: 0, totalKcal: 600, targetKcal: 550 });
const farEnergy = computeScore({ mode: "energie", totalCo2g: 0, totalKcal: 450, targetKcal: 550 });
if (!(closeEnergy > farEnergy)) {
  console.error("energy gap should reward the closer plate", closeEnergy, farEnergy);
  process.exit(1);
}

if (NUTRISCORE_GRADES.length !== 5 || NUTRISCORE_QUIZ.length < 3) {
  console.error("nutriscore content");
  process.exit(1);
}

const scaleLines = [
  [" +14.850g", 14.85],
  ["+    31.28g", 31.28],
  ["ST,GS,+  120.0 g", 120],
  ["0.125 kg", 125],
  ["  45,6", 45.6],
  ["C5-0", null],
  ["OL", null],
  ["10 pcs", null],
  ["0.00 g", null],
];
for (const [line, expected] of scaleLines) {
  const got = parseScaleLine(line);
  if (expected == null) {
    if (got != null) {
      console.error("parseScaleLine expected null", line, got);
      process.exit(1);
    }
  } else if (got == null || Math.abs(got - expected) > 0.01) {
    console.error("parseScaleLine fail", line, got, expected);
    process.exit(1);
  }
}
const ftdi = { getInfo: () => ({ usbVendorId: 0x0403, usbProductId: 0x6001 }) };
const bluetooth = { getInfo: () => ({}) };
if (formatChipId(ftdi) !== "FT232R USB UART · 0403:6001") {
  console.error("formatChipId fail", formatChipId(ftdi));
  process.exit(1);
}
if (formatChipId(bluetooth) !== "") {
  console.error("formatChipId empty fail");
  process.exit(1);
}
if (!isUsbSerialPort(ftdi) || isUsbSerialPort(bluetooth)) {
  console.error("isUsbSerialPort fail");
  process.exit(1);
}
const onlyBluetooth = selectGrantedScalePort([bluetooth]);
const onlyFtdi = selectGrantedScalePort([bluetooth, ftdi]);
const twoUsb = selectGrantedScalePort([ftdi, { getInfo: () => ({ usbVendorId: 0x1a86, usbProductId: 0x7523 }) }]);
if (onlyBluetooth !== null || onlyFtdi !== ftdi || twoUsb !== null) {
  console.error("selectGrantedScalePort fail");
  process.exit(1);
}
if (formatGrams(14.85) !== "14.9" || formatGrams(120) !== "120") {
  console.error("formatGrams fail", formatGrams(14.85), formatGrams(120));
  process.exit(1);
}

console.log("game-smoke ok", { foods: FOODS.length, lunchCp: lunchKcal("cp") });
