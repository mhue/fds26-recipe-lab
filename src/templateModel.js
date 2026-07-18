/**
 * Reconnaissance aidée par le petit dataset + géométrie fixe XXXXX.XX.
 *
 * 1. Détecte le cadre de l'afficheur
 * 2. Découpe 7 cases (5 avant le point, 2 après)
 * 3. Compare chaque case aux templates appris (sinon 7-segments)
 */

import {
  INT_SLOTS,
  analyzeDisplay,
  inkRatio,
  labelToSlots,
  slotsToReading,
} from "./displayGeometry.js";
import { maskToDigit } from "./sevenSegment.js";

const MODEL_KEY = "recipe-lab-template-model-v2";
const TW = 16;
const TH = 28;
const BLANK_INK = 0.045;

/**
 * @typedef {object} DigitModel
 * @property {boolean} inverted
 * @property {number} segmentThreshold
 * @property {number} digitsBeforeDecimal
 * @property {string[]} coveredDigits
 * @property {Record<string, number[][]>} templates
 * @property {number} sampleCount
 * @property {string} learnedAt
 * @property {string} layout
 */

/**
 * @typedef {object} TemplateReading
 * @property {string} text
 * @property {number|null} value
 * @property {number} confidence
 * @property {string[]} digits
 * @property {string} method
 */

/**
 * @param {{ label: string, image: Blob }[]} samples
 * @returns {Promise<{ model: DigitModel|null, message: string, perSample: string[] }>}
 */
export async function learnDigitModel(samples) {
  if (!samples.length) {
    return { model: null, message: "Aucun exemple annoté.", perSample: [] };
  }

  /** @type {Record<string, number[][]>} */
  const templates = {};
  /** @type {boolean[]} */
  const invertVotes = [];
  /** @type {string[]} */
  const perSample = [];

  for (const sample of samples) {
    const expected = labelToSlots(sample.label);
    if (!expected) {
      perSample.push(`${sample.label}: label invalide`);
      continue;
    }

    const imageData = await blobToImageData(sample.image);
    const layout = analyzeDisplay(imageData);
    if (!layout) {
      perSample.push(`${sample.label}: cadre introuvable`);
      continue;
    }

    invertVotes.push(layout.inverted);
    let used = 0;
    for (let i = 0; i < 7; i++) {
      const want = expected[i];
      if (want == null) continue;
      const box = layout.slots[i];
      const ink = inkRatio(layout.binary, layout.width, box);
      if (ink < BLANK_INK * 0.5) {
        // case attendue non vide mais peu d'encre — on prend quand même
      }
      const vec = cropToTemplate(layout.binary, layout.width, box);
      if (!templates[want]) templates[want] = [];
      templates[want].push(vec);
      used += 1;
    }
    perSample.push(
      `${sample.label}: OK cadre→7 cases (${used} glyphes, polarité ${layout.inverted ? "LCD" : "LED"})`,
    );
  }

  const covered = Object.keys(templates).sort();
  if (!covered.length) {
    return {
      model: null,
      message: "Impossible d’extraire des chiffres. Recadrez l’écran entier dans le jaune.",
      perSample,
    };
  }

  /** @type {DigitModel} */
  const model = {
    inverted: majority(invertVotes) ?? false,
    segmentThreshold: 0.28,
    digitsBeforeDecimal: INT_SLOTS,
    coveredDigits: covered,
    templates,
    sampleCount: samples.length,
    learnedAt: new Date().toISOString(),
    layout: "XXXXX.XX",
  };

  saveModel(model);
  const missing = "0123456789".split("").filter((d) => !templates[d]);
  const missTxt = missing.length ? ` · manquants: ${missing.join("")}` : "";
  return {
    model,
    message: `Modèle XXXXX.XX · chiffres ${covered.join("")}${missTxt}`,
    perSample,
  };
}

/**
 * @param {ImageData} imageData
 * @param {DigitModel|null} model
 * @param {HTMLCanvasElement|null} [debugCanvas]
 * @returns {TemplateReading}
 */
export function recognizeWithModel(imageData, model, debugCanvas = null) {
  const layout = analyzeDisplay(imageData, {
    inverted: model ? model.inverted : undefined,
  });
  if (!layout) {
    return { text: "", value: null, confidence: 0, digits: [], method: "frame7" };
  }

  const thr = model?.segmentThreshold ?? 0.28;
  const templates = model?.templates ?? {};
  /** @type {string[]} */
  const slotDigits = [];
  /** @type {number[]} */
  const scores = [];

  for (let i = 0; i < 7; i++) {
    const box = layout.slots[i];
    const ink = inkRatio(layout.binary, layout.width, box);

    // Cases entières de tête vides autorisées
    if (i < INT_SLOTS && ink < BLANK_INK) {
      slotDigits.push("");
      scores.push(1);
      continue;
    }

    const vec = cropToTemplate(layout.binary, layout.width, box);
    const fromTpl = matchTemplates(vec, templates);
    if (fromTpl.digit != null && fromTpl.score >= 0.52) {
      slotDigits.push(fromTpl.digit);
      scores.push(fromTpl.score);
      continue;
    }

    const seg = readSevenSegBox(layout.binary, layout.width, box, thr);
    if (seg.digit != null) {
      slotDigits.push(seg.digit);
      scores.push(0.55);
    } else if (fromTpl.digit != null) {
      slotDigits.push(fromTpl.digit);
      scores.push(fromTpl.score);
    } else if (i < INT_SLOTS && ink < BLANK_INK * 1.8) {
      slotDigits.push("");
      scores.push(0.4);
    } else {
      slotDigits.push("?");
      scores.push(0);
    }
  }

  // Les 2 décimales ne doivent pas rester vides
  for (let i = INT_SLOTS; i < 7; i++) {
    if (!slotDigits[i] || slotDigits[i] === "") slotDigits[i] = "?";
  }

  paintDebug(debugCanvas, layout);

  const assembled = slotsToReading(slotDigits);
  const confidence = scores.length
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100)
    : 0;

  return {
    text: assembled.text,
    value: assembled.value,
    confidence,
    digits: slotDigits,
    method: "frame7",
  };
}

/** @returns {DigitModel|null} */
export function loadModel() {
  try {
    const raw = localStorage.getItem(MODEL_KEY);
    if (!raw) return null;
    const model = JSON.parse(raw);
    if (!model?.templates || !Object.keys(model.templates).length) return null;
    return model;
  } catch {
    return null;
  }
}

export function clearModel() {
  localStorage.removeItem(MODEL_KEY);
  localStorage.removeItem("recipe-lab-template-model-v1");
}

/** @param {DigitModel} model */
function saveModel(model) {
  localStorage.setItem(MODEL_KEY, JSON.stringify(model));
}

/**
 * @param {Uint8Array} binary
 * @param {number} width
 * @param {{ x: number, y: number, w: number, h: number }} box
 */
function cropToTemplate(binary, width, box) {
  const out = new Array(TW * TH).fill(0);
  for (let ty = 0; ty < TH; ty++) {
    for (let tx = 0; tx < TW; tx++) {
      const x = Math.min(box.x + box.w - 1, box.x + Math.floor(((tx + 0.5) * box.w) / TW));
      const y = Math.min(box.y + box.h - 1, box.y + Math.floor(((ty + 0.5) * box.h) / TH));
      out[ty * TW + tx] = binary[y * width + x];
    }
  }
  return out;
}

/**
 * @param {number[]} vec
 * @param {Record<string, number[][]>} templates
 */
function matchTemplates(vec, templates) {
  let bestDigit = null;
  let bestScore = -1;
  for (const [digit, list] of Object.entries(templates)) {
    for (const tpl of list) {
      const score = ncc(vec, tpl);
      if (score > bestScore) {
        bestScore = score;
        bestDigit = digit;
      }
    }
  }
  return { digit: bestDigit, score: bestScore };
}

function ncc(a, b) {
  const n = a.length;
  let sumA = 0;
  let sumB = 0;
  for (let i = 0; i < n; i++) {
    sumA += a[i];
    sumB += b[i];
  }
  const meanA = sumA / n;
  const meanB = sumB / n;
  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  if (denA < 1e-6 || denB < 1e-6) {
    let same = 0;
    for (let i = 0; i < n; i++) if (a[i] === b[i]) same += 1;
    return same / n;
  }
  return num / Math.sqrt(denA * denB);
}

const SEG_ZONES = [
  { bit: 0, x: 0.28, y: 0.04, w: 0.44, h: 0.12 },
  { bit: 1, x: 0.72, y: 0.14, w: 0.2, h: 0.28 },
  { bit: 2, x: 0.72, y: 0.54, w: 0.2, h: 0.28 },
  { bit: 3, x: 0.28, y: 0.84, w: 0.44, h: 0.12 },
  { bit: 4, x: 0.08, y: 0.54, w: 0.2, h: 0.28 },
  { bit: 5, x: 0.08, y: 0.14, w: 0.2, h: 0.28 },
  { bit: 6, x: 0.28, y: 0.44, w: 0.44, h: 0.12 },
];

function readSevenSegBox(binary, width, box, thr) {
  let mask = 0;
  for (const z of SEG_ZONES) {
    const ratio = inkRatio(binary, width, {
      x: box.x + z.x * box.w,
      y: box.y + z.y * box.h,
      w: z.w * box.w,
      h: z.h * box.h,
    });
    if (ratio >= thr) mask |= 1 << z.bit;
  }
  return maskToDigit(mask);
}

/** @param {Blob} blob */
async function blobToImageData(blob) {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * @param {HTMLCanvasElement|null|undefined} canvas
 * @param {{
 *   binary: Uint8Array,
 *   width: number,
 *   height: number,
 *   frame: import('./displayGeometry.js').Rect,
 *   slots: import('./displayGeometry.js').Rect[],
 *   inverted: boolean,
 *   corners?: { x: number, y: number }[],
 * }} layout
 */
function paintDebug(canvas, layout) {
  if (!canvas) return;
  const { binary, width, height, frame, slots, inverted } = layout;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(width, height);
  for (let i = 0, p = 0; p < binary.length; p++, i += 4) {
    const v = binary[p] ? 255 : 0;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  const tmp = document.createElement("canvas");
  tmp.width = width;
  tmp.height = height;
  const tctx = tmp.getContext("2d");
  tctx.putImageData(img, 0, 0);

  // Rectangle redressé (après homographie)
  tctx.strokeStyle = "#4ea1ff";
  tctx.lineWidth = Math.max(2, Math.round(Math.min(width, height) * 0.02));
  tctx.strokeRect(frame.x + 0.5, frame.y + 0.5, frame.w - 1, frame.h - 1);

  // Coins du rectangle cible
  tctx.fillStyle = "#4ea1ff";
  const corners = [
    { x: frame.x, y: frame.y },
    { x: frame.x + frame.w, y: frame.y },
    { x: frame.x + frame.w, y: frame.y + frame.h },
    { x: frame.x, y: frame.y + frame.h },
  ];
  for (const p of corners) {
    tctx.beginPath();
    tctx.arc(p.x, p.y, Math.max(2, height * 0.04), 0, Math.PI * 2);
    tctx.fill();
  }

  tctx.strokeStyle = "#7cb87a";
  tctx.lineWidth = Math.max(1, Math.round(Math.min(width, height) * 0.015));
  for (const s of slots) {
    tctx.strokeRect(s.x + 0.5, s.y + 0.5, s.w - 1, s.h - 1);
  }

  const left = slots[4];
  const right = slots[5];
  const px = Math.round((left.x + left.w + right.x) / 2);
  const py = left.y + left.h * 0.82;
  tctx.fillStyle = "#ffd166";
  tctx.beginPath();
  tctx.arc(px, py, Math.max(2, left.h * 0.06), 0, Math.PI * 2);
  tctx.fill();

  tctx.fillStyle = inverted ? "#7cb87a" : "#e07a5f";
  tctx.fillRect(2, 2, 8, 8);

  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const scale = Math.min(canvas.width / width, canvas.height / height);
  const w = width * scale;
  const h = height * scale;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
}

/** @template T @param {T[]} values */
function majority(values) {
  if (!values.length) return null;
  const map = new Map();
  for (const v of values) map.set(v, (map.get(v) || 0) + 1);
  let best = values[0];
  let n = 0;
  for (const [v, c] of map) {
    if (c > n) {
      best = v;
      n = c;
    }
  }
  return best;
}
