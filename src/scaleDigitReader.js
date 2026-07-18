/**
 * Module de lecture des chiffres d'une balance via caméra.
 *
 * Pipeline :
 * 1. Cadre fixe (ROI) sur l'écran
 * 2. Calibration optionnelle sur 0.00 (après tare)
 * 3. Reconnaissance 7-segments (+ cases figées si calibré)
 * 4. Vote temporel (médiane) sur plusieurs frames
 */

import {
  buildCalibrationFromZero,
  isZeroReading,
  mergeCalibrations,
  readSevenSegment,
} from "./sevenSegment.js";

const DIGIT_PATTERN = /(\d+[.,]?\d*)/g;
const STORAGE_KEY = "recipe-lab-scale-calibration";

/**
 * @typedef {import('./sevenSegment.js').ScaleCalibration} ScaleCalibration
 */

/**
 * @typedef {object} ScaleReading
 * @property {number|null} grams
 * @property {string} rawText
 * @property {number} confidence
 * @property {string[]} samples
 * @property {string} method
 * @property {boolean} calibrated
 */

export class ScaleDigitReader {
  /** @param {{ invert?: boolean|null, samples?: number, calibration?: ScaleCalibration|null }} [options] */
  constructor(options = {}) {
    /** @type {boolean|null} null = auto */
    this.invert = options.invert === undefined ? null : options.invert;
    this.sampleCount = options.samples ?? 7;
    /** @type {ScaleCalibration|null} */
    this.calibration = options.calibration ?? loadCalibration();
    this.ready = false;
  }

  async init() {
    this.ready = true;
  }

  /**
   * @param {boolean|null} invert true/false force, null = auto
   */
  setInvert(invert) {
    this.invert = invert;
  }

  /** @returns {ScaleCalibration|null} */
  getCalibration() {
    return this.calibration;
  }

  isCalibrated() {
    return Boolean(this.calibration?.digits?.length);
  }

  clearCalibration() {
    this.calibration = null;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  /**
   * Capture la ROI vidéo (couleur brute pour le décodeur).
   * @param {HTMLVideoElement} video
   * @param {{ x: number, y: number, w: number, h: number }} roiNorm
   */
  captureRoi(video, roiNorm) {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) {
      throw new Error("Flux vidéo pas encore prêt");
    }

    const sx = Math.round(roiNorm.x * vw);
    const sy = Math.round(roiNorm.y * vh);
    const sw = Math.max(8, Math.round(roiNorm.w * vw));
    const sh = Math.max(8, Math.round(roiNorm.h * vh));

    const work = document.createElement("canvas");
    const scale = Math.max(2, Math.min(5, 360 / sw));
    work.width = Math.round(sw * scale);
    work.height = Math.round(sh * scale);

    const ctx = work.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, work.width, work.height);
    return work;
  }

  /**
   * Une lecture 7-segments.
   * @param {HTMLCanvasElement} canvas
   * @param {HTMLCanvasElement} [previewCanvas]
   */
  recognizeOnce(canvas, previewCanvas) {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const result = readSevenSegment(imageData, {
      forceInvert: this.calibration ? this.calibration.inverted : this.invert,
      calibration: this.calibration,
      debugCanvas: previewCanvas ?? null,
    });
    return {
      grams: result.value,
      rawText: result.text || "(vide)",
      confidence: result.confidence,
      method: "7seg",
      inverted: result.inverted,
      digits: result.digits,
      imageData,
    };
  }

  /**
   * Calibre sur un affichage de tare (0 / 0.0 / 0.00).
   * @param {HTMLVideoElement} video
   * @param {{ x: number, y: number, w: number, h: number }} roiNorm
   * @param {HTMLCanvasElement} [previewCanvas]
   */
  async calibrateZero(video, roiNorm, previewCanvas) {
    await this.init();
    /** @type {import('./sevenSegment.js').ScaleCalibration[]} */
    const found = [];
    /** @type {string[]} */
    const samples = [];

    // Temporairement sans calibration figée, pour découvrir 0.00
    const previous = this.calibration;
    this.calibration = null;

    try {
      for (let i = 0; i < Math.max(8, this.sampleCount); i++) {
        const canvas = this.captureRoi(video, roiNorm);
        const showPreview = i === Math.max(8, this.sampleCount) - 1 ? previewCanvas : undefined;
        const reading = this.recognizeOnce(canvas, showPreview);
        samples.push(reading.rawText);

        if (isZeroReading(reading.rawText, reading.grams) && reading.digits?.length) {
          const cal = buildCalibrationFromZero(reading.imageData, {
            text: reading.rawText === "(vide)" ? "" : reading.rawText,
            value: reading.grams,
            confidence: reading.confidence,
            digits: reading.digits,
            inverted: reading.inverted,
            segmentThreshold: 0.28,
          });
          if (cal) found.push(cal);
        }
        if (i < Math.max(8, this.sampleCount) - 1) await sleep(50);
      }
    } finally {
      this.calibration = previous;
    }

    const merged = mergeCalibrations(found);
    if (!merged) {
      return {
        ok: false,
        samples,
        calibration: null,
        message: "Impossible de lire 0.00 — recadrez et vérifiez la tare.",
      };
    }

    this.calibration = merged;
    saveCalibration(merged);

    // Relecture de contrôle avec la calibration
    const checkCanvas = this.captureRoi(video, roiNorm);
    const check = this.recognizeOnce(checkCanvas, previewCanvas);

    return {
      ok: isZeroReading(check.rawText, check.grams),
      samples,
      calibration: merged,
      check,
      message: isZeroReading(check.rawText, check.grams)
        ? `Calibré sur ${merged.zeroText} (${merged.digits.length} digits)`
        : `Calibration enregistrée (${merged.zeroText}), contrôle: ${check.rawText}`,
    };
  }

  /**
   * Plusieurs captures rapides + médiane.
   * @param {HTMLVideoElement} video
   * @param {{ x: number, y: number, w: number, h: number }} roiNorm
   * @param {HTMLCanvasElement} [previewCanvas]
   * @returns {Promise<ScaleReading>}
   */
  async read(video, roiNorm, previewCanvas) {
    await this.init();
    /** @type {number[]} */
    const values = [];
    /** @type {string[]} */
    const samples = [];
    let lastConfidence = 0;
    let lastText = "";

    for (let i = 0; i < this.sampleCount; i++) {
      const canvas = this.captureRoi(video, roiNorm);
      const showPreview = i === this.sampleCount - 1 ? previewCanvas : undefined;
      const result = this.recognizeOnce(canvas, showPreview);
      samples.push(result.rawText);
      lastConfidence = result.confidence;
      lastText = result.rawText;
      if (result.grams != null) values.push(result.grams);
      if (i < this.sampleCount - 1) await sleep(40);
    }

    return {
      grams: stabilize(values),
      rawText: lastText,
      confidence: lastConfidence,
      samples,
      method: "7seg",
      calibrated: this.isCalibrated(),
    };
  }

  async dispose() {
    this.ready = false;
  }
}

/**
 * Parse le texte en grammes.
 * @param {string} text
 * @returns {number|null}
 */
export function parseWeight(text) {
  if (!text) return null;
  const cleaned = text.replace(/[^\d.,]/g, "").replace(",", ".");
  const matches = cleaned.match(DIGIT_PATTERN);
  if (!matches?.length) return null;

  let best = matches[0];
  for (const m of matches) {
    if (m.includes(".") || m.length > best.length) best = m;
  }

  const value = Number.parseFloat(best.replace(",", "."));
  if (!Number.isFinite(value)) return null;
  if (value < 0 || value > 10000) return null;
  return value;
}

/**
 * Médiane des lectures numériques valides.
 * @param {number[]} values
 * @returns {number|null}
 */
export function stabilize(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10;
  }
  return sorted[mid];
}

/** @returns {ScaleCalibration|null} */
function loadCalibration() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.digits?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** @param {ScaleCalibration} calibration */
function saveCalibration(calibration) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(calibration));
  } catch {
    /* ignore */
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
