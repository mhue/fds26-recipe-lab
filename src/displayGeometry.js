/**
 * Géométrie d'écran digital de balance :
 * - détection du cadre extérieur de l'afficheur
 * - découpage en 7 cases : XXXXX.XX
 *   (5 chiffres avant le point, 2 après — toujours 2 décimales,
 *    au moins 1 chiffre à gauche ; les cases de tête peuvent être vides)
 */

/** @typedef {{ x: number, y: number, w: number, h: number }} Rect */

export const SLOT_COUNT = 7;
export const INT_SLOTS = 5;
export const FRAC_SLOTS = 2;

/**
 * @param {ImageData} imageData
 * @param {{ inverted?: boolean }} [opts]
 * @returns {{ frame: Rect, slots: Rect[], inverted: boolean, binary: Uint8Array, width: number, height: number } | null}
 */
export function analyzeDisplay(imageData, opts = {}) {
  const { width, height } = imageData;
  const gray = toGray(imageData);

  const candidates = [];
  const invertOptions =
    opts.inverted === true || opts.inverted === false ? [opts.inverted] : [false, true];

  for (const inverted of invertOptions) {
    const binary = binarize(gray, width, height, inverted);
    const frame = detectOuterFrame(gray, binary, width, height);
    if (!frame) continue;
    const slots = splitSevenSlots(frame);
    const score = scoreLayout(binary, width, slots, inverted);
    candidates.push({ frame, slots, inverted, binary, width, height, score });
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  return {
    frame: best.frame,
    slots: best.slots,
    inverted: best.inverted,
    binary: best.binary,
    width: best.width,
    height: best.height,
  };
}

/**
 * Aligne un label sur 7 cases (droite pour la partie entière, 2 décimales).
 * @param {string} label
 * @returns {(string|null)[] | null} 7 entrées : digit ou null si case vide
 */
export function labelToSlots(label) {
  const n = normalizeLabel(label);
  if (!n || n === ".") return null;
  const parts = n.split(".");
  let intPart = (parts[0] || "").replace(/\D/g, "");
  let fracPart = (parts[1] || "").replace(/\D/g, "");
  if (!intPart) intPart = "0";
  if (fracPart.length === 0) fracPart = "00";
  else if (fracPart.length === 1) fracPart = `${fracPart}0`;
  else fracPart = fracPart.slice(0, 2);
  if (intPart.length > INT_SLOTS) intPart = intPart.slice(-INT_SLOTS);

  /** @type {(string|null)[]} */
  const slots = Array.from({ length: SLOT_COUNT }, () => null);
  const start = INT_SLOTS - intPart.length;
  for (let i = 0; i < intPart.length; i++) slots[start + i] = intPart[i];
  slots[5] = fracPart[0];
  slots[6] = fracPart[1];
  return slots;
}

/**
 * Assemble le texte / valeur depuis 7 lectures ('' = vide, '?' = inconnu).
 * @param {string[]} slotDigits length 7
 */
export function slotsToReading(slotDigits) {
  const intDigits = slotDigits.slice(0, INT_SLOTS).filter((d) => d && d !== "?");
  const fracDigits = slotDigits.slice(INT_SLOTS);
  const hasUnknown = slotDigits.some((d) => d === "?");
  // Au moins un chiffre à gauche
  const intText = intDigits.length ? intDigits.join("") : "0";
  const fracText = fracDigits.map((d) => (d && d !== "?" ? d : "0")).join("");
  const text = `${intText}.${fracText}`;
  if (hasUnknown) {
    return { text, value: null, ok: false };
  }
  const value = Number.parseFloat(text);
  if (!Number.isFinite(value) || value < 0 || value > 100000) {
    return { text, value: null, ok: false };
  }
  return { text, value, ok: true };
}

/**
 * Détecte le cadre extérieur de l'afficheur (rectangle).
 * @param {Uint8Array} gray
 * @param {Uint8Array} binary
 * @param {number} width
 * @param {number} height
 * @returns {Rect|null}
 */
export function detectOuterFrame(gray, binary, width, height) {
  const byEdges = frameFromEdges(gray, width, height);
  const byInk = frameFromInk(binary, width, height);
  const byBorder = frameFromBorderRing(gray, width, height);

  const candidates = [byEdges, byInk, byBorder].filter(Boolean);
  if (!candidates.length) {
    return { x: Math.round(width * 0.04), y: Math.round(height * 0.08), w: Math.round(width * 0.92), h: Math.round(height * 0.84) };
  }

  // Préférer un cadre assez large, pas trop collé aux digits seuls
  candidates.sort((a, b) => {
    const areaA = a.w * a.h;
    const areaB = b.w * b.h;
    const aspectA = a.w / Math.max(1, a.h);
    const aspectB = b.w / Math.max(1, b.h);
    // Les afficheurs sont plutôt larges
    const scoreA = areaA * (aspectA > 1.2 ? 1.3 : 1);
    const scoreB = areaB * (aspectB > 1.2 ? 1.3 : 1);
    return scoreB - scoreA;
  });

  let frame = candidates[0];
  // Légère contraction pour rester à l'intérieur du bezel
  frame = insetRect(frame, 0.03, 0.06, width, height);
  if (frame.w < width * 0.35 || frame.h < height * 0.25) return null;
  return frame;
}

/**
 * 7 cases horizontales dans le cadre ; espace décimal entre les cases 5 et 6 (index 4 et 5).
 * @param {Rect} frame
 * @returns {Rect[]}
 */
export function splitSevenSlots(frame) {
  const padY = Math.max(1, Math.round(frame.h * 0.08));
  const gap = Math.max(1, Math.round(frame.w * 0.025)); // place du point
  const usable = frame.w - gap;
  const slotW = usable / SLOT_COUNT;
  const innerH = Math.max(4, frame.h - padY * 2);

  /** @type {Rect[]} */
  const slots = [];
  for (let i = 0; i < SLOT_COUNT; i++) {
    const gapBefore = i >= INT_SLOTS ? gap : 0;
    const x = frame.x + gapBefore + i * slotW;
    const insetX = Math.max(1, Math.round(slotW * 0.08));
    slots.push({
      x: Math.round(x + insetX),
      y: frame.y + padY,
      w: Math.max(3, Math.round(slotW - insetX * 2)),
      h: Math.round(innerH),
    });
  }
  return slots;
}

/**
 * @param {Uint8Array} gray
 * @param {number} width
 * @param {number} height
 * @returns {Rect|null}
 */
function frameFromEdges(gray, width, height) {
  const col = new Float32Array(width);
  const row = new Float32Array(height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const dx = Math.abs(gray[y * width + x + 1] - gray[y * width + x - 1]);
      const dy = Math.abs(gray[(y + 1) * width + x] - gray[(y - 1) * width + x]);
      const e = dx + dy;
      col[x] += e;
      row[y] += e;
    }
  }
  smooth1D(col);
  smooth1D(row);

  const left = findBorderIndex(col, true);
  const right = findBorderIndex(col, false);
  const top = findBorderIndex(row, true);
  const bottom = findBorderIndex(row, false);
  if (right - left < width * 0.3 || bottom - top < height * 0.2) return null;
  return { x: left, y: top, w: right - left + 1, h: bottom - top + 1 };
}

/**
 * Cadre = bounding box de l'encre, expansée (souvent proche de l'afficheur si ROI serré).
 * @param {Uint8Array} binary
 * @param {number} width
 * @param {number} height
 */
function frameFromInk(binary, width, height) {
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
  const padX = Math.round((maxX - minX + 1) * 0.08);
  const padY = Math.round((maxY - minY + 1) * 0.18);
  const x = clamp(minX - padX, 0, width - 1);
  const y = clamp(minY - padY, 0, height - 1);
  const r = clamp(maxX + padX, 0, width - 1);
  const b = clamp(maxY + padY, 0, height - 1);
  return { x, y, w: r - x + 1, h: b - y + 1 };
}

/**
 * Cherche un anneau de bordure (contraste fort près des bords du ROI).
 * @param {Uint8Array} gray
 * @param {number} width
 * @param {number} height
 */
function frameFromBorderRing(gray, width, height) {
  // Moyenne sur bande périphérique vs centre
  const m = Math.max(2, Math.round(Math.min(width, height) * 0.06));
  let borderSum = 0;
  let borderN = 0;
  let centerSum = 0;
  let centerN = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = gray[y * width + x];
      const border = x < m || y < m || x >= width - m || y >= height - m;
      if (border) {
        borderSum += v;
        borderN += 1;
      } else if (x > width * 0.2 && x < width * 0.8 && y > height * 0.2 && y < height * 0.8) {
        centerSum += v;
        centerN += 1;
      }
    }
  }
  if (!borderN || !centerN) return null;
  // Si peu de contraste cadre/centre, peu fiable
  if (Math.abs(borderSum / borderN - centerSum / centerN) < 12) return null;
  return {
    x: m,
    y: m,
    w: width - 2 * m,
    h: height - 2 * m,
  };
}

/**
 * @param {Float32Array} proj
 * @param {boolean} fromStart
 */
function findBorderIndex(proj, fromStart) {
  const n = proj.length;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += proj[i];
  const mean = sum / n;
  const thr = mean * 1.15;
  const band = Math.max(3, Math.floor(n * 0.4));

  if (fromStart) {
    let bestI = Math.floor(n * 0.05);
    let bestV = -1;
    for (let i = 0; i < band; i++) {
      if (proj[i] > bestV && proj[i] >= thr * 0.7) {
        bestV = proj[i];
        bestI = i;
      }
    }
    return bestI;
  }
  let bestI = Math.floor(n * 0.95);
  let bestV = -1;
  for (let i = n - 1; i >= n - band; i--) {
    if (proj[i] > bestV && proj[i] >= thr * 0.7) {
      bestV = proj[i];
      bestI = i;
    }
  }
  return bestI;
}

/** @param {Float32Array} arr */
function smooth1D(arr) {
  const copy = Float32Array.from(arr);
  for (let i = 1; i < arr.length - 1; i++) {
    arr[i] = (copy[i - 1] + copy[i] * 2 + copy[i + 1]) / 4;
  }
}

/**
 * @param {Uint8Array} binary
 * @param {number} width
 * @param {Rect[]} slots
 * @param {boolean} inverted
 */
function scoreLayout(binary, width, slots, inverted) {
  let inkSlots = 0;
  let totalInk = 0;
  for (const slot of slots) {
    const r = inkRatio(binary, width, slot);
    totalInk += r;
    if (r > 0.06) inkSlots += 1;
  }
  // On attend souvent 3–7 cases actives (ex. 0.00 → 3)
  const slotScore = inkSlots >= 3 && inkSlots <= 7 ? 1 : 0.3;
  return slotScore * 10 + totalInk + (inverted ? 0.01 : 0);
}

/**
 * @param {Rect} rect
 * @param {number} fx
 * @param {number} fy
 * @param {number} width
 * @param {number} height
 */
function insetRect(rect, fx, fy, width, height) {
  const dx = Math.round(rect.w * fx);
  const dy = Math.round(rect.h * fy);
  const x = clamp(rect.x + dx, 0, width - 1);
  const y = clamp(rect.y + dy, 0, height - 1);
  const r = clamp(rect.x + rect.w - 1 - dx, 0, width - 1);
  const b = clamp(rect.y + rect.h - 1 - dy, 0, height - 1);
  return { x, y, w: Math.max(4, r - x + 1), h: Math.max(4, b - y + 1) };
}

export function inkRatio(binary, width, rect) {
  const x0 = Math.max(0, Math.floor(rect.x));
  const y0 = Math.max(0, Math.floor(rect.y));
  const x1 = Math.min(width, Math.ceil(rect.x + rect.w));
  const y1 = Math.ceil(rect.y + rect.h);
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

export function toGray(imageData) {
  const { data, width, height } = imageData;
  const gray = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }
  return gray;
}

export function binarize(gray, width, height, invert) {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  const threshold = otsu(hist, gray.length);
  const out = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i++) {
    const bright = gray[i] >= threshold;
    out[i] = invert ? (bright ? 0 : 1) : bright ? 1 : 0;
  }
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

function normalizeLabel(label) {
  return String(label || "")
    .trim()
    .replace(",", ".")
    .replace(/[^\d.]/g, "")
    .replace(/(\..*)\./g, "$1");
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}
