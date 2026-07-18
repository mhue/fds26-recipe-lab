import { parseWeight, stabilize } from "../src/scaleDigitReader.js";
import { isZeroReading, maskToDigit } from "../src/sevenSegment.js";
import { isValidLabel, normalizeLabel } from "../src/datasetStore.js";
import {
  expandQuad,
  getPerspectiveTransform,
  labelToSlots,
  orderCorners,
  slotsToReading,
} from "../src/displayGeometry.js";

const asserts = [
  ["123g", 123],
  ["45,6", 45.6],
  ["12.0", 12],
  ["abc", null],
];

for (const [text, expected] of asserts) {
  const got = parseWeight(text);
  if (got !== expected) {
    console.error("parseWeight fail", text, got, expected);
    process.exit(1);
  }
}

if (stabilize([10, 12, 11]) !== 11) {
  console.error("stabilize fail");
  process.exit(1);
}

const masks = [
  [0b0111111, "0"],
  [0b0000110, "1"],
  [0b1111111, "8"],
  [0b1011011, "2"],
];

for (const [mask, digit] of masks) {
  const got = maskToDigit(mask).digit;
  if (got !== digit) {
    console.error("maskToDigit fail", mask.toString(2), got, digit);
    process.exit(1);
  }
}

if (!isZeroReading("0.00", 0) || !isZeroReading("0", 0) || isZeroReading("12.3", 12.3)) {
  console.error("isZeroReading fail");
  process.exit(1);
}

if (normalizeLabel(" 12,5 g ") !== "12.5" || !isValidLabel("0.00") || isValidLabel("abc")) {
  console.error("label helpers fail");
  process.exit(1);
}

const slots = labelToSlots("12.5");
if (!slots || slots.join("|") !== "|||1|2|5|0") {
  console.error("labelToSlots fail", slots);
  process.exit(1);
}
const zeroSlots = labelToSlots("0.00");
if (!zeroSlots || zeroSlots.join("|") !== "||||0|0|0") {
  console.error("labelToSlots zero fail", zeroSlots);
  process.exit(1);
}
const reading = slotsToReading(["", "", "", "1", "2", "5", "0"]);
if (reading.text !== "12.50" || reading.value !== 12.5) {
  console.error("slotsToReading fail", reading);
  process.exit(1);
}

const ordered = orderCorners([
  { x: 80, y: 10 },
  { x: 10, y: 12 },
  { x: 90, y: 50 },
  { x: 5, y: 55 },
]);
if (ordered[0].x !== 10 || ordered[1].x !== 80 || ordered[2].x !== 90 || ordered[3].x !== 5) {
  console.error("orderCorners fail", ordered);
  process.exit(1);
}

const expanded = expandQuad(
  [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ],
  1.2,
);
if (Math.abs(expanded[0].x - -1) > 1e-6 || Math.abs(expanded[1].x - 11) > 1e-6) {
  console.error("expandQuad fail", expanded);
  process.exit(1);
}

const src = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 50 },
  { x: 0, y: 50 },
];
const dst = [
  { x: 0, y: 0 },
  { x: 200, y: 0 },
  { x: 200, y: 100 },
  { x: 0, y: 100 },
];
const H = getPerspectiveTransform(src, dst);
const w = H[6] * 50 + H[7] * 0 + H[8];
const ux = (H[0] * 50 + H[1] * 0 + H[2]) / w;
const uy = (H[3] * 50 + H[4] * 0 + H[5]) / w;
if (Math.abs(ux - 100) > 0.5 || Math.abs(uy - 0) > 0.5) {
  console.error("homography fail", ux, uy, Array.from(H));
  process.exit(1);
}

console.log("ok");
