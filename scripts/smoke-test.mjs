import { parseWeight, stabilize } from "../src/scaleDigitReader.js";
import { isZeroReading, maskToDigit } from "../src/sevenSegment.js";
import { isValidLabel, normalizeLabel } from "../src/datasetStore.js";

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

console.log("ok");
