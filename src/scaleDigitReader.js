/**
 * Module de lecture des chiffres d'une balance via caméra.
 *
 * Méthode principale : reconnaissance 7-segments (LCD/LED),
 * bien plus adaptée aux balances cuisine que l'OCR généraliste.
 *
 * Pipeline :
 * 1. Cadre fixe (ROI) sur l'écran
 * 2. Prétraitement + essai des deux polarités
 * 3. Découpe des digits + lecture des 7 segments
 * 4. Vote temporel (médiane) sur plusieurs frames
 */

import { readSevenSegment } from "./sevenSegment.js";

const DIGIT_PATTERN = /(\d+[.,]?\d*)/g;

/**
 * @typedef {object} ScaleReading
 * @property {number|null} grams
 * @property {string} rawText
 * @property {number} confidence
 * @property {string[]} samples
 * @property {string} method
 */

export class ScaleDigitReader {
  /** @param {{ invert?: boolean|null, samples?: number }} [options] */
  constructor(options = {}) {
    /** @type {boolean|null} null = auto */
    this.invert = options.invert === undefined ? null : options.invert;
    this.sampleCount = options.samples ?? 7;
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
      forceInvert: this.invert,
      debugCanvas: previewCanvas ?? null,
    });
    return {
      grams: result.value,
      rawText: result.text || "(vide)",
      confidence: result.confidence,
      method: "7seg",
      inverted: result.inverted,
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
