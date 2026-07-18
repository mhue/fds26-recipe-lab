/**
 * Reconnaissance 7-segments pour écrans LCD/LED de balance.
 *
 * Plus fiable que l'OCR généraliste sur ce type d'affichage :
 * on détecte quels segments sont allumés, puis on mappe le motif → chiffre.
 */

/** @typedef {{ x: number, y: number, w: number, h: number }} Rect */

/** Masques standard a,b,c,d,e,f,g (bits 0..6). */
const DIGIT_MASKS = {
  0: 0b0111111,
  1: 0b0000110,
  2: 0b1011011,
  3: 0b1001111,
  4: 0b1100110,
  5: 0b1101101,
  6: 0b1111101,
  7: 0b0000111,
  8: 0b1111111,
  9: 0b1101111,
};

/** Zones de prélèvement des 7 segments, en coords normalisées dans le digit. */
const SEGMENT_ZONES = [
  { bit: 0, x: 0.28, y: 0.04, w: 0.44, h: 0.12 }, // a top
  { bit: 1, x: 0.72, y: 0.14, w: 0.2, h: 0.28 }, // b top-right
  { bit: 2, x: 0.72, y: 0.54, w: 0.2, h: 0.28 }, // c bottom-right
  { bit: 3, x: 0.28, y: 0.84, w: 0.44, h: 0.12 }, // d bottom
  { bit: 4, x: 0.08, y: 0.54, w: 0.2, h: 0.28 }, // e bottom-left
  { bit: 5, x: 0.08, y: 0.14, w: 0.2, h: 0.28 }, // f top-left
  { bit: 6, x: 0.28, y: 0.44, w: 0.44, h: 0.12 }, // g middle
];

/**
 * @typedef {object} SevenSegResult
 * @property {string} text
 * @property {number|null} value
 * @property {number} confidence 0–100
 * @property {Rect[]} digits
 * @property {boolean} inverted
 */

/**
 * @param {ImageData} imageData pixels RGBA (sera interprété en niveaux de gris)
 * @param {{ forceInvert?: boolean|null, debugCanvas?: HTMLCanvasElement|null }} [options]
 * @returns {SevenSegResult}
 */
export function readSevenSegment(imageData, options = {}) {
  const forceInvert = options.forceInvert;
  const candidates =
    forceInvert === true || forceInvert === false
      ? [recognizePolarity(imageData, forceInvert, options.debugCanvas)]
      : [
          recognizePolarity(imageData, false, null),
          recognizePolarity(imageData, true, null),
        ];

  candidates.sort((a, b) => scoreResult(b) - scoreResult(a));
  const best = candidates[0];

  if (options.debugCanvas && best) {
    // Relancer la meilleure polarité pour peindre le debug
    return recognizePolarity(imageData, best.inverted, options.debugCanvas);
  }
  return best;
}

/**
 * Décode un masque 7-segments en chiffre, avec tolérance d'1 bit.
 * @param {number} mask
 * @returns {{ digit: string|null, distance: number }}
 */
export function maskToDigit(mask) {
  let best = null;
  let bestDist = 8;
  for (const [digit, pattern] of Object.entries(DIGIT_MASKS)) {
    const dist = hamming(mask, pattern);
    if (dist < bestDist) {
      bestDist = dist;
      best = digit;
    }
  }
  if (bestDist > 1) return { digit: null, distance: bestDist };
  return { digit: best, distance: bestDist };
}

/** @param {SevenSegResult} result */
function scoreResult(result) {
  if (!result?.text) return -1;
  const digits = result.text.replace(".", "").length;
  return result.confidence * 10 + digits * 20 + (result.value != null ? 50 : 0);
}

/**
 * @param {ImageData} source
 * @param {boolean} invert
 * @param {HTMLCanvasElement|null} debugCanvas
 * @returns {SevenSegResult}
 */
function recognizePolarity(source, invert, debugCanvas) {
  const { width, height } = source;
  const gray = toGray(source);
  const binary = binarizeGray(gray, width, height, invert);

  const content = contentBounds(binary, width, height);
  if (!content) {
    return emptyResult(invert);
  }

  const padX = Math.max(1, Math.round(content.w * 0.02));
  const padY = Math.max(1, Math.round(content.h * 0.04));
  const crop = {
    x: Math.max(0, content.x - padX),
    y: Math.max(0, content.y - padY),
    w: Math.min(width - Math.max(0, content.x - padX), content.w + padX * 2),
    h: Math.min(height - Math.max(0, content.y - padY), content.h + padY * 2),
  };

  const digits = findDigitBoxes(binary, width, height, crop);
  if (!digits.length) {
    paintDebug(debugCanvas, binary, width, height, [], invert);
    return emptyResult(invert);
  }

  /** @type {string[]} */
  const chars = [];
  let confidenceAcc = 0;
  let confidenceN = 0;

  for (let i = 0; i < digits.length; i++) {
    const box = digits[i];
    const { mask, onScores, offScores } = sampleSegments(binary, width, box);
    const { digit, distance } = maskToDigit(mask);

    // Confiance : contraste moyen on/off + pénalité distance
    const onAvg = average(onScores);
    const offAvg = average(offScores);
    const contrast = clamp01(onAvg - offAvg);
    const conf = (1 - distance / 2) * (0.45 + 0.55 * contrast);
    confidenceAcc += conf;
    confidenceN += 1;

    if (digit != null) chars.push(digit);

    if (i < digits.length - 1) {
      const gap = {
        x: box.x + box.w,
        y: box.y,
        w: Math.max(1, digits[i + 1].x - (box.x + box.w)),
        h: box.h,
      };
      if (detectDecimalPoint(binary, width, gap)) {
        chars.push(".");
      }
    }
  }

  paintDebug(debugCanvas, binary, width, height, digits, invert);

  const text = chars.join("");
  const value = parseWeightText(text);
  const confidence = confidenceN ? Math.round((confidenceAcc / confidenceN) * 100) : 0;

  return { text, value, confidence, digits, inverted: invert };
}

function emptyResult(inverted) {
  return { text: "", value: null, confidence: 0, digits: [], inverted };
}

/** @param {ImageData} imageData */
function toGray(imageData) {
  const { data, width, height } = imageData;
  const gray = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }
  return gray;
}

/**
 * Binarise : ink = 1 (segment allumé), fond = 0.
 * @param {Uint8Array} gray
 * @param {number} width
 * @param {number} height
 * @param {boolean} invert si true, les pixels sombres deviennent ink
 */
function binarizeGray(gray, width, height, invert) {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  const threshold = otsu(hist, gray.length);
  const out = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i++) {
    const bright = gray[i] >= threshold;
    // Par défaut : chiffres clairs (LED) → ink si bright
    // invert : chiffres sombres (LCD) → ink si sombre
    out[i] = invert ? (bright ? 0 : 1) : bright ? 1 : 0;
  }

  // Si très peu d'encre, polarité probablement mauvaise — on laisse le score trancher.
  return out;
}

function otsu(hist, total) {
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let max = 0;
  let threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > max) {
      max = between;
      threshold = t;
    }
  }
  return threshold;
}

/** @param {Uint8Array} binary @param {number} width @param {number} height */
function contentBounds(binary, width, height) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!binary[y * width + x]) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/**
 * Découpe en colonnes de digits via projection verticale.
 * @param {Uint8Array} binary
 * @param {number} width
 * @param {number} height
 * @param {Rect} crop
 * @returns {Rect[]}
 */
function findDigitBoxes(binary, width, height, crop) {
  const proj = new Float32Array(crop.w);
  for (let x = 0; x < crop.w; x++) {
    let sum = 0;
    for (let y = 0; y < crop.h; y++) {
      sum += binary[(crop.y + y) * width + (crop.x + x)];
    }
    proj[x] = sum / crop.h;
  }

  const inkThreshold = 0.04;
  /** @type {{ start: number, end: number }[]} */
  const runs = [];
  let active = null;
  for (let x = 0; x < proj.length; x++) {
    const on = proj[x] >= inkThreshold;
    if (on && active == null) active = x;
    if (!on && active != null) {
      runs.push({ start: active, end: x - 1 });
      active = null;
    }
  }
  if (active != null) runs.push({ start: active, end: proj.length - 1 });

  // Fusionner de tout petits gaps (segments discontinus)
  const merged = [];
  for (const run of runs) {
    const prev = merged[merged.length - 1];
    if (prev && run.start - prev.end <= Math.max(2, Math.round(crop.w * 0.015))) {
      prev.end = run.end;
    } else {
      merged.push({ ...run });
    }
  }

  const minDigitW = Math.max(4, Math.round(crop.h * 0.22));
  const maxDigitW = Math.round(crop.h * 0.95);
  /** @type {Rect[]} */
  const boxes = [];

  for (const run of merged) {
    const w = run.end - run.start + 1;
    if (w < minDigitW * 0.35) {
      // Possible point décimal isolé — ignoré ici, détecté dans les gaps
      continue;
    }

    // Si une run est très large, découper en digits estimés
    if (w > maxDigitW * 1.35) {
      const estimate = Math.max(2, Math.round(w / (crop.h * 0.55)));
      const slot = w / estimate;
      for (let i = 0; i < estimate; i++) {
        const sx = run.start + Math.round(i * slot);
        const ex = run.start + Math.round((i + 1) * slot) - 1;
        const box = tightBox(binary, width, crop, sx, ex);
        if (box && box.w >= minDigitW * 0.5) boxes.push(box);
      }
      continue;
    }

    const box = tightBox(binary, width, crop, run.start, run.end);
    if (box && box.w >= minDigitW * 0.45 && box.h >= crop.h * 0.45) {
      boxes.push(box);
    }
  }

  return boxes;
}

/**
 * @param {Uint8Array} binary
 * @param {number} width
 * @param {Rect} crop
 * @param {number} localStart
 * @param {number} localEnd
 */
function tightBox(binary, width, crop, localStart, localEnd) {
  let minX = crop.x + localEnd;
  let maxX = crop.x + localStart;
  let minY = crop.y + crop.h;
  let maxY = crop.y;
  let found = false;
  for (let x = crop.x + localStart; x <= crop.x + localEnd; x++) {
    for (let y = crop.y; y < crop.y + crop.h; y++) {
      if (!binary[y * width + x]) continue;
      found = true;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (!found) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/**
 * @param {Uint8Array} binary
 * @param {number} width
 * @param {Rect} box
 */
function sampleSegments(binary, width, box) {
  let mask = 0;
  /** @type {number[]} */
  const onScores = [];
  /** @type {number[]} */
  const offScores = [];

  for (const zone of SEGMENT_ZONES) {
    const score = regionInkRatio(binary, width, {
      x: box.x + zone.x * box.w,
      y: box.y + zone.y * box.h,
      w: zone.w * box.w,
      h: zone.h * box.h,
    });
    // Seuil relatif : un segment allumé est nettement plus rempli
    const on = score >= 0.28;
    if (on) {
      mask |= 1 << zone.bit;
      onScores.push(score);
    } else {
      offScores.push(score);
    }
  }
  return { mask, onScores, offScores };
}

/**
 * @param {Uint8Array} binary
 * @param {number} width
 * @param {Rect} rect
 */
function regionInkRatio(binary, width, rect) {
  const x0 = Math.max(0, Math.floor(rect.x));
  const y0 = Math.max(0, Math.floor(rect.y));
  const x1 = Math.max(x0 + 1, Math.ceil(rect.x + rect.w));
  const y1 = Math.max(y0 + 1, Math.ceil(rect.y + rect.h));
  let ink = 0;
  let total = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      total += 1;
      ink += binary[y * width + x];
    }
  }
  return total ? ink / total : 0;
}

/**
 * Point décimal : petit blob bas dans le gap entre deux digits.
 * @param {Uint8Array} binary
 * @param {number} width
 * @param {Rect} gap
 */
function detectDecimalPoint(binary, width, gap) {
  if (gap.w < 1 || gap.h < 4) return false;
  const region = {
    x: gap.x,
    y: gap.y + gap.h * 0.62,
    w: gap.w,
    h: gap.h * 0.38,
  };
  const ratio = regionInkRatio(binary, width, region);
  const upper = regionInkRatio(binary, width, {
    x: gap.x,
    y: gap.y,
    w: gap.w,
    h: gap.h * 0.45,
  });
  return ratio >= 0.12 && upper < 0.08 && gap.w <= gap.h * 0.55;
}

/**
 * @param {HTMLCanvasElement|null|undefined} canvas
 * @param {Uint8Array} binary
 * @param {number} width
 * @param {number} height
 * @param {Rect[]} digits
 * @param {boolean} inverted
 */
function paintDebug(canvas, binary, width, height, digits, inverted) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(width, height);
  for (let i = 0, p = 0; p < binary.length; p++, i += 4) {
    const v = binary[p] ? 255 : 0;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }

  // Dessiner hors-écran puis scale dans le preview
  const tmp = document.createElement("canvas");
  tmp.width = width;
  tmp.height = height;
  const tctx = tmp.getContext("2d");
  tctx.putImageData(img, 0, 0);
  tctx.strokeStyle = "#ffd166";
  tctx.lineWidth = Math.max(1, Math.round(Math.min(width, height) * 0.02));
  for (const d of digits) {
    tctx.strokeRect(d.x + 0.5, d.y + 0.5, d.w - 1, d.h - 1);
  }
  // Indicateur polarité
  tctx.fillStyle = inverted ? "#7cb87a" : "#e07a5f";
  tctx.fillRect(2, 2, 8, 8);

  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const fit = fitContain(width, height, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, fit.x, fit.y, fit.w, fit.h);
}

function parseWeightText(text) {
  if (!text) return null;
  const cleaned = text.replace(/[^\d.]/g, "");
  if (!cleaned || cleaned === ".") return null;
  // Garder un seul point
  const parts = cleaned.split(".");
  const normalized =
    parts.length === 1 ? parts[0] : `${parts[0]}.${parts.slice(1).join("").slice(0, 2)}`;
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value < 0 || value > 10000) return null;
  return value;
}

function hamming(a, b) {
  let x = a ^ b;
  let n = 0;
  while (x) {
    n += x & 1;
    x >>= 1;
  }
  return n;
}

function average(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function clamp01(v) {
  return Math.min(1, Math.max(0, v));
}

function fitContain(srcW, srcH, dstW, dstH) {
  const scale = Math.min(dstW / srcW, dstH / srcH);
  const w = srcW * scale;
  const h = srcH * scale;
  return { x: (dstW - w) / 2, y: (dstH - h) / 2, w, h };
}
