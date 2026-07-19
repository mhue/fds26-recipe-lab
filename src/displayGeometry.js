/**
 * Géométrie d'écran digital de balance :
 * - détection des 4 sommets du quadrilatère le plus vraisemblable
 * - homographie (redressement) vers un rectangle
 * - découpage en 7 cases : XXXXX.XX
 */

/** @typedef {{ x: number, y: number, w: number, h: number }} Rect */
/** @typedef {{ x: number, y: number }} Point */

export const SLOT_COUNT = 7;
export const INT_SLOTS = 5;
export const FRAC_SLOTS = 2;

const WARP_W = 320;
const WARP_H = 120;
const WARP_W_FAST = 224;
const WARP_H_FAST = 84;

/**
 * @param {ImageData} imageData
 * @param {{ inverted?: boolean, fast?: boolean }} [opts]
 * @returns {{
 *   frame: Rect,
 *   slots: Rect[],
 *   inverted: boolean,
 *   binary: Uint8Array,
 *   width: number,
 *   height: number,
 *   corners: Point[],
 *   warpedGray: Uint8Array,
 * } | null}
 */
export function analyzeDisplay(imageData, opts = {}) {
  const fast = Boolean(opts.fast);
  const srcW = imageData.width;
  const srcH = imageData.height;
  const fullGray = toGray(imageData);

  // Détection de coins sur une version réduite (gros gain de temps)
  const detectMax = fast ? 220 : 360;
  const scaled = downscaleGray(fullGray, srcW, srcH, detectMax);
  let corners = fast
    ? detectBestQuadFast(scaled.gray, scaled.width, scaled.height)
    : detectBestQuad(scaled.gray, scaled.width, scaled.height);

  if (!corners) {
    const binaryGuess = binarize(scaled.gray, scaled.width, scaled.height, false);
    const aabb = detectOuterFrame(scaled.gray, binaryGuess, scaled.width, scaled.height);
    if (!aabb) return null;
    corners = rectToCorners(aabb);
  }

  // Remonter les coins dans le repère image source
  corners = corners.map((p) => ({
    x: (p.x / scaled.scaleX),
    y: (p.y / scaled.scaleY),
  }));
  corners = expandQuad(corners, fast ? 1.04 : 1.06);
  corners = orderCorners(corners);

  const warpW = fast ? WARP_W_FAST : WARP_W;
  const warpH = fast ? WARP_H_FAST : WARP_H;
  // Warp depuis l'image réduite si fast (suffisant pour templates 16×28)
  const warpSrc = fast ? scaled.gray : fullGray;
  const warpSrcW = fast ? scaled.width : srcW;
  const warpSrcH = fast ? scaled.height : srcH;
  const warpCorners = fast
    ? corners.map((p) => ({ x: p.x * scaled.scaleX, y: p.y * scaled.scaleY }))
    : corners;

  const warpedGray = warpPerspectiveGray(
    warpSrc,
    warpSrcW,
    warpSrcH,
    warpCorners,
    warpW,
    warpH,
  );

  const invertOptions =
    opts.inverted === true || opts.inverted === false ? [opts.inverted] : [false, true];

  /** @type {any[]} */
  const candidates = [];
  const frame = {
    x: Math.round(warpW * 0.02),
    y: Math.round(warpH * 0.08),
    w: Math.round(warpW * 0.96),
    h: Math.round(warpH * 0.84),
  };
  const slots = splitSevenSlots(frame);

  for (const inverted of invertOptions) {
    const binary = binarize(warpedGray, warpW, warpH, inverted);
    const score = scoreLayout(binary, warpW, slots, inverted);
    candidates.push({
      frame,
      slots,
      inverted,
      binary,
      width: warpW,
      height: warpH,
      corners,
      warpedGray,
      score,
    });
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
    corners: best.corners,
    warpedGray: best.warpedGray,
  };
}

/**
 * @param {string} label
 * @returns {(string|null)[] | null}
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
 * @param {string[]} slotDigits
 */
export function slotsToReading(slotDigits) {
  const intDigits = slotDigits.slice(0, INT_SLOTS).filter((d) => d && d !== "?");
  const fracDigits = slotDigits.slice(INT_SLOTS);
  const hasUnknown = slotDigits.some((d) => d === "?");
  const intText = intDigits.length ? intDigits.join("") : "0";
  const fracText = fracDigits.map((d) => (d && d !== "?" ? d : "0")).join("");
  const text = `${intText}.${fracText}`;
  if (hasUnknown) return { text, value: null, ok: false };
  const value = Number.parseFloat(text);
  if (!Number.isFinite(value) || value < 0 || value > 100000) {
    return { text, value: null, ok: false };
  }
  return { text, value, ok: true };
}

/**
 * Cherche le quadrilatère (4 coins) le plus vraisemblable pour l'afficheur.
 * @param {Uint8Array} gray
 * @param {number} width
 * @param {number} height
 * @returns {Point[]|null} TL,TR,BR,BL
 */
export function detectBestQuad(gray, width, height) {
  const edges = sobelEdges(gray, width, height);
  const thr = edgeThreshold(edges, 0.82);
  const bin = new Uint8Array(width * height);
  for (let i = 0; i < edges.length; i++) bin[i] = edges[i] >= thr ? 1 : 0;

  const contours = findContours(bin, width, height, 12);
  /** @type {{ corners: Point[], score: number }[]} */
  const quads = [];

  for (const contour of contours) {
    if (contour.length < 20) continue;
    const area = Math.abs(polygonArea(contour));
    if (area < width * height * 0.08) continue;
    if (area > width * height * 0.98) continue;

    // Sous-échantillonner le contour avant Douglas-Peucker
    const slim = subsampleContour(contour, 80);
    const peri = perimeter(slim);
    let corners = approxPolyDP(slim, Math.max(3, peri * 0.04));
    if (corners.length !== 4) {
      corners = rectToCorners(boundingRect(slim));
    } else {
      corners = orderCorners(corners);
    }

    const score = scoreQuad(corners, width, height, area);
    if (score > 0) quads.push({ corners, score });
    if (quads.length >= 8) break;
  }

  const aabb = frameFromEdges(gray, width, height);
  if (aabb) {
    const c = orderCorners(rectToCorners(aabb));
    quads.push({
      corners: c,
      score: scoreQuad(c, width, height, aabb.w * aabb.h) * 0.85,
    });
  }

  if (!quads.length) return null;
  quads.sort((a, b) => b.score - a.score);
  return quads[0].corners;
}

/**
 * Version rapide : projections d'arêtes / AABB (pour l'apprentissage).
 * @param {Uint8Array} gray
 * @param {number} width
 * @param {number} height
 * @returns {Point[]|null}
 */
export function detectBestQuadFast(gray, width, height) {
  const aabb = frameFromEdges(gray, width, height);
  if (aabb && aabb.w > width * 0.35 && aabb.h > height * 0.25) {
    return orderCorners(rectToCorners(aabb));
  }
  const binary = binarize(gray, width, height, false);
  const ink = frameFromInk(binary, width, height);
  if (ink) return orderCorners(rectToCorners(ink));
  return orderCorners(
    rectToCorners({
      x: Math.round(width * 0.04),
      y: Math.round(height * 0.08),
      w: Math.round(width * 0.92),
      h: Math.round(height * 0.84),
    }),
  );
}

/**
 * @param {Uint8Array} gray
 * @param {number} width
 * @param {number} height
 * @param {number} maxSide
 */
function downscaleGray(gray, width, height, maxSide) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  if (scale >= 0.999) {
    return { gray, width, height, scaleX: 1, scaleY: 1 };
  }
  const w = Math.max(16, Math.round(width * scale));
  const h = Math.max(12, Math.round(height * scale));
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(height - 1, Math.floor((y + 0.5) * (height / h)));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(width - 1, Math.floor((x + 0.5) * (width / w)));
      out[y * w + x] = gray[sy * width + sx];
    }
  }
  return { gray: out, width: w, height: h, scaleX: w / width, scaleY: h / height };
}

/**
 * Homographie + échantillonnage bilinéaire.
 * @param {Uint8Array} srcGray
 * @param {number} srcW
 * @param {number} srcH
 * @param {Point[]} srcCorners TL,TR,BR,BL
 * @param {number} dstW
 * @param {number} dstH
 */
export function warpPerspectiveGray(srcGray, srcW, srcH, srcCorners, dstW, dstH) {
  const dstCorners = [
    { x: 0, y: 0 },
    { x: dstW - 1, y: 0 },
    { x: dstW - 1, y: dstH - 1 },
    { x: 0, y: dstH - 1 },
  ];
  const H = getPerspectiveTransform(srcCorners, dstCorners);
  const Hinv = invert3x3(H);
  const out = new Uint8Array(dstW * dstH);
  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const p = applyHomography(Hinv, x, y);
      out[y * dstW + x] = sampleBilinear(srcGray, srcW, srcH, p.x, p.y);
    }
  }
  return out;
}

/**
 * @param {Point[]} corners
 * @param {number} scale >1 agrandit (débordement)
 */
export function expandQuad(corners, scale) {
  const c = {
    x: corners.reduce((s, p) => s + p.x, 0) / corners.length,
    y: corners.reduce((s, p) => s + p.y, 0) / corners.length,
  };
  return corners.map((p) => ({
    x: c.x + (p.x - c.x) * scale,
    y: c.y + (p.y - c.y) * scale,
  }));
}

/** @param {Point[]} pts */
export function orderCorners(pts) {
  const sorted = [...pts].sort((a, b) => a.y - b.y || a.x - b.x);
  const top = sorted.slice(0, 2).sort((a, b) => a.x - b.x);
  const bot = sorted.slice(2).sort((a, b) => a.x - b.x);
  return [top[0], top[1], bot[1], bot[0]];
}

/**
 * @param {Rect} frame
 * @returns {Rect[]}
 */
export function splitSevenSlots(frame) {
  const padY = Math.max(1, Math.round(frame.h * 0.1));
  const gap = Math.max(1, Math.round(frame.w * 0.028));
  const usable = frame.w - gap;
  const slotW = usable / SLOT_COUNT;
  const innerH = Math.max(4, frame.h - padY * 2);

  /** @type {Rect[]} */
  const slots = [];
  for (let i = 0; i < SLOT_COUNT; i++) {
    const gapBefore = i >= INT_SLOTS ? gap : 0;
    const x = frame.x + gapBefore + i * slotW;
    const insetX = Math.max(1, Math.round(slotW * 0.1));
    slots.push({
      x: Math.round(x + insetX),
      y: frame.y + padY,
      w: Math.max(3, Math.round(slotW - insetX * 2)),
      h: Math.round(innerH),
    });
  }
  return slots;
}

export function detectOuterFrame(gray, binary, width, height) {
  const byEdges = frameFromEdges(gray, width, height);
  const byInk = frameFromInk(binary, width, height);
  const candidates = [byEdges, byInk].filter(Boolean);
  if (!candidates.length) {
    return {
      x: Math.round(width * 0.03),
      y: Math.round(height * 0.06),
      w: Math.round(width * 0.94),
      h: Math.round(height * 0.88),
    };
  }
  candidates.sort((a, b) => b.w * b.h - a.w * a.h);
  let frame = candidates[0];
  // Moins de contraction : le cadre peut déborder un peu
  frame = insetRect(frame, -0.01, -0.02, width, height);
  if (frame.w < width * 0.3 || frame.h < height * 0.2) return null;
  return frame;
}

/** @param {Rect} rect @returns {Point[]} */
export function rectToCorners(rect) {
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.w - 1, y: rect.y },
    { x: rect.x + rect.w - 1, y: rect.y + rect.h - 1 },
    { x: rect.x, y: rect.y + rect.h - 1 },
  ];
}

/**
 * @param {Point[]} corners
 * @param {number} width
 * @param {number} height
 * @param {number} area
 */
function scoreQuad(corners, width, height, area) {
  const ordered = orderCorners(corners);
  const [tl, tr, br, bl] = ordered;
  const top = dist(tl, tr);
  const bottom = dist(bl, br);
  const left = dist(tl, bl);
  const right = dist(tr, br);
  if (top < 8 || bottom < 8 || left < 4 || right < 4) return 0;

  const aspect = ((top + bottom) / 2) / Math.max(1, (left + right) / 2);
  // Afficheur large
  if (aspect < 1.2 || aspect > 8) return 0;

  const parallel =
    1 -
    Math.min(1, Math.abs(top - bottom) / Math.max(top, bottom)) * 0.5 -
    Math.min(1, Math.abs(left - right) / Math.max(left, right)) * 0.5;

  const imgArea = width * height;
  const fill = area / imgArea;
  // Ni trop petit ni quasi toute l'image
  if (fill < 0.1 || fill > 0.98) return 0;

  // Pénalité si très hors image (mais un peu hors OK)
  let outside = 0;
  for (const p of ordered) {
    if (p.x < -width * 0.15 || p.y < -height * 0.15) outside += 1;
    if (p.x > width * 1.15 || p.y > height * 1.15) outside += 1;
  }
  if (outside >= 3) return 0;

  return fill * 40 + parallel * 25 + Math.min(aspect, 4) * 5;
}

function sobelEdges(gray, width, height) {
  const out = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const gx =
        -gray[i - width - 1] -
        2 * gray[i - 1] -
        gray[i + width - 1] +
        gray[i - width + 1] +
        2 * gray[i + 1] +
        gray[i + width + 1];
      const gy =
        -gray[i - width - 1] -
        2 * gray[i - width] -
        gray[i - width + 1] +
        gray[i + width - 1] +
        2 * gray[i + width] +
        gray[i + width + 1];
      out[i] = Math.hypot(gx, gy);
    }
  }
  return out;
}

/** Seuil d'arêtes via histogramme (O(n)), sans tri. */
function edgeThreshold(arr, p) {
  let max = 0;
  for (let i = 0; i < arr.length; i++) if (arr[i] > max) max = arr[i];
  if (max <= 0) return 1;
  const bins = 64;
  const hist = new Uint32Array(bins);
  let counted = 0;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (v <= 0) continue;
    const b = Math.min(bins - 1, Math.floor((v / max) * bins));
    hist[b] += 1;
    counted += 1;
  }
  if (!counted) return 1;
  const target = Math.floor(counted * p);
  let acc = 0;
  for (let b = 0; b < bins; b++) {
    acc += hist[b];
    if (acc >= target) return ((b + 0.5) / bins) * max;
  }
  return max * 0.5;
}

function subsampleContour(points, maxPts) {
  if (points.length <= maxPts) return points;
  /** @type {Point[]} */
  const out = [];
  const step = points.length / maxPts;
  for (let i = 0; i < maxPts; i++) {
    out.push(points[Math.min(points.length - 1, Math.floor(i * step))]);
  }
  return out;
}

/**
 * Contours externes simplifiés (suivi de bord).
 * @param {Uint8Array} bin
 * @param {number} width
 * @param {number} height
 * @param {number} [maxContours]
 * @returns {Point[][]}
 */
function findContours(bin, width, height, maxContours = 24) {
  const visited = new Uint8Array(width * height);
  /** @type {Point[][]} */
  const contours = [];
  const dirs = [
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
    [0, -1],
    [1, -1],
  ];

  for (let y = 1; y < height - 1; y += 2) {
    for (let x = 1; x < width - 1; x += 2) {
      const i = y * width + x;
      if (!bin[i] || visited[i]) continue;
      let isBorder = false;
      for (const [dx, dy] of dirs) {
        if (!bin[(y + dy) * width + (x + dx)]) {
          isBorder = true;
          break;
        }
      }
      if (!isBorder) continue;

      const contour = traceContour(bin, visited, width, height, x, y, dirs);
      if (contour.length >= 16) contours.push(contour);
      if (contours.length >= maxContours) return contours;
    }
  }
  return contours;
}

function traceContour(bin, visited, width, height, startX, startY, dirs) {
  /** @type {Point[]} */
  const points = [];
  let x = startX;
  let y = startY;
  let dir = 0;
  const maxSteps = Math.min(width * height, 4000);
  for (let step = 0; step < maxSteps; step++) {
    const i = y * width + x;
    if (visited[i] && points.length > 8 && x === startX && y === startY) break;
    visited[i] = 1;
    points.push({ x, y });
    let moved = false;
    for (let k = 0; k < 8; k++) {
      const nd = (dir + 6 + k) % 8;
      const nx = x + dirs[nd][0];
      const ny = y + dirs[nd][1];
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (!bin[ny * width + nx]) continue;
      x = nx;
      y = ny;
      dir = nd;
      moved = true;
      break;
    }
    if (!moved) break;
    if (points.length > 8 && x === startX && y === startY) break;
  }
  return points;
}

/** Douglas-Peucker */
function approxPolyDP(points, epsilon) {
  if (points.length < 3) return points;
  let maxD = 0;
  let idx = 0;
  const first = points[0];
  const last = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i++) {
    const d = pointLineDistance(points[i], first, last);
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD > epsilon) {
    const left = approxPolyDP(points.slice(0, idx + 1), epsilon);
    const right = approxPolyDP(points.slice(idx), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [first, last];
}

function pointLineDistance(p, a, b) {
  const A = p.x - a.x;
  const B = p.y - a.y;
  const C = b.x - a.x;
  const D = b.y - a.y;
  const dot = A * C + B * D;
  const len2 = C * C + D * D || 1;
  const t = Math.max(0, Math.min(1, dot / len2));
  const xx = a.x + t * C;
  const yy = a.y + t * D;
  return Math.hypot(p.x - xx, p.y - yy);
}

function polygonArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    a += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return a / 2;
}

function perimeter(pts) {
  let p = 0;
  for (let i = 0; i < pts.length; i++) {
    p += dist(pts[i], pts[(i + 1) % pts.length]);
  }
  return p;
}

function boundingRect(pts) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * H mappe src -> dst. Retourne 9 coeffs (row-major), h33=1.
 * @param {Point[]} src
 * @param {Point[]} dst
 */
export function getPerspectiveTransform(src, dst) {
  /** @type {number[][]} */
  const A = [];
  /** @type {number[]} */
  const b = [];
  for (let i = 0; i < 4; i++) {
    const x = src[i].x;
    const y = src[i].y;
    const u = dst[i].x;
    const v = dst[i].y;
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  const h8 = solveLinearSystem(A, b);
  return new Float64Array([h8[0], h8[1], h8[2], h8[3], h8[4], h8[5], h8[6], h8[7], 1]);
}

/** @param {Float64Array} H @param {number} x @param {number} y */
function applyHomography(H, x, y) {
  const w = H[6] * x + H[7] * y + H[8];
  return {
    x: (H[0] * x + H[1] * y + H[2]) / w,
    y: (H[3] * x + H[4] * y + H[5]) / w,
  };
}

/** @param {Float64Array} H */
function invert3x3(H) {
  const a = H[0];
  const b = H[1];
  const c = H[2];
  const d = H[3];
  const e = H[4];
  const f = H[5];
  const g = H[6];
  const h = H[7];
  const i = H[8];
  const A = e * i - f * h;
  const B = c * h - b * i;
  const C = b * f - c * e;
  const D = f * g - d * i;
  const E = a * i - c * g;
  const F = c * d - a * f;
  const G = d * h - e * g;
  const Hh = b * g - a * h;
  const I = a * e - b * d;
  const det = a * A + b * D + c * G;
  if (Math.abs(det) < 1e-12) {
    return new Float64Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }
  const invDet = 1 / det;
  // cofactor transpose
  return new Float64Array([
    A * invDet,
    B * invDet,
    C * invDet,
    D * invDet,
    E * invDet,
    F * invDet,
    G * invDet,
    Hh * invDet,
    I * invDet,
  ]);
}

function sampleBilinear(gray, width, height, x, y) {
  if (x < 0 || y < 0 || x >= width - 1 || y >= height - 1) {
    const xi = clamp(Math.round(x), 0, width - 1);
    const yi = clamp(Math.round(y), 0, height - 1);
    return gray[yi * width + xi];
  }
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const i00 = gray[y0 * width + x0];
  const i10 = gray[y0 * width + x0 + 1];
  const i01 = gray[(y0 + 1) * width + x0];
  const i11 = gray[(y0 + 1) * width + x0 + 1];
  return Math.round(i00 * (1 - fx) * (1 - fy) + i10 * fx * (1 - fy) + i01 * (1 - fx) * fy + i11 * fx * fy);
}

/** Gaussien naïf / élimination pour Ax=b */
function solveLinearSystem(A, b) {
  const n = b.length;
  /** @type {number[][]} */
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    if (Math.abs(M[pivot][col]) < 1e-12) continue;
    if (pivot !== col) {
      const tmp = M[col];
      M[col] = M[pivot];
      M[pivot] = tmp;
    }
    const div = M[col][col];
    for (let c = col; c <= n; c++) M[col][c] /= div;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col];
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row) => row[n]);
}

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
  if (right - left < width * 0.25 || bottom - top < height * 0.18) return null;
  return { x: left, y: top, w: right - left + 1, h: bottom - top + 1 };
}

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
  const padX = Math.round((maxX - minX + 1) * 0.1);
  const padY = Math.round((maxY - minY + 1) * 0.22);
  const x = clamp(minX - padX, 0, width - 1);
  const y = clamp(minY - padY, 0, height - 1);
  const r = clamp(maxX + padX, 0, width - 1);
  const b = clamp(maxY + padY, 0, height - 1);
  return { x, y, w: r - x + 1, h: b - y + 1 };
}

function findBorderIndex(proj, fromStart) {
  const n = proj.length;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += proj[i];
  const mean = sum / n;
  const thr = mean * 1.1;
  const band = Math.max(3, Math.floor(n * 0.42));
  if (fromStart) {
    let bestI = Math.floor(n * 0.04);
    let bestV = -1;
    for (let i = 0; i < band; i++) {
      if (proj[i] > bestV && proj[i] >= thr * 0.65) {
        bestV = proj[i];
        bestI = i;
      }
    }
    return bestI;
  }
  let bestI = Math.floor(n * 0.96);
  let bestV = -1;
  for (let i = n - 1; i >= n - band; i--) {
    if (proj[i] > bestV && proj[i] >= thr * 0.65) {
      bestV = proj[i];
      bestI = i;
    }
  }
  return bestI;
}

function smooth1D(arr) {
  const copy = Float32Array.from(arr);
  for (let i = 1; i < arr.length - 1; i++) {
    arr[i] = (copy[i - 1] + copy[i] * 2 + copy[i + 1]) / 4;
  }
}

function scoreLayout(binary, width, slots, inverted) {
  let inkSlots = 0;
  let totalInk = 0;
  for (const slot of slots) {
    const r = inkRatio(binary, width, slot);
    totalInk += r;
    if (r > 0.06) inkSlots += 1;
  }
  const slotScore = inkSlots >= 3 && inkSlots <= 7 ? 1 : 0.3;
  return slotScore * 10 + totalInk + (inverted ? 0.01 : 0);
}

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
  const y1 = Math.min(
    // height unknown — use rect bound only; callers keep rect inside image
    Math.ceil(rect.y + rect.h),
  );
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
