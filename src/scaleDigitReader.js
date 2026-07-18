/**
 * Module de lecture des chiffres d'une balance via caméra.
 *
 * Stratégie volontairement simple et robuste pour un stand :
 * 1. Cadre fixe (ROI) sur l'écran digital
 * 2. Prétraitement (niveaux de gris + seuil)
 * 3. OCR Tesseract limité aux chiffres et au point
 * 4. Vote temporel sur plusieurs frames pour stabiliser
 */

import { createWorker } from "tesseract.js";

const DIGIT_PATTERN = /(\d+[.,]?\d*)/g;

/**
 * @typedef {object} ScaleReading
 * @property {number|null} grams
 * @property {string} rawText
 * @property {number} confidence
 * @property {string[]} samples
 */

export class ScaleDigitReader {
  /** @param {{ invert?: boolean, samples?: number }} [options] */
  constructor(options = {}) {
    this.invert = Boolean(options.invert);
    this.sampleCount = options.samples ?? 5;
    /** @type {import('tesseract.js').Worker | null} */
    this.worker = null;
    this.ready = false;
  }

  async init() {
    if (this.worker) return;
    this.worker = await createWorker("eng", 1, {
      logger: () => {},
    });
    await this.worker.setParameters({
      tessedit_char_whitelist: "0123456789.,",
      tessedit_pageseg_mode: "7", // une seule ligne de texte
    });
    this.ready = true;
  }

  setInvert(invert) {
    this.invert = Boolean(invert);
  }

  /**
   * Découpe la ROI vidéo, prétraite, et affiche éventuellement le résultat.
   * @param {HTMLVideoElement} video
   * @param {{ x: number, y: number, w: number, h: number }} roiNorm coords 0–1
   * @param {HTMLCanvasElement} [previewCanvas]
   */
  extractRoi(video, roiNorm, previewCanvas) {
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
    // Upscale pour aider l'OCR sur petits écrans LCD
    const scale = Math.max(2, Math.min(4, 320 / sw));
    work.width = Math.round(sw * scale);
    work.height = Math.round(sh * scale);

    const ctx = work.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, work.width, work.height);

    const imageData = ctx.getImageData(0, 0, work.width, work.height);
    binarize(imageData, this.invert);
    ctx.putImageData(imageData, 0, 0);

    if (previewCanvas) {
      const pctx = previewCanvas.getContext("2d");
      pctx.fillStyle = "#111";
      pctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
      const fit = fitContain(work.width, work.height, previewCanvas.width, previewCanvas.height);
      pctx.imageSmoothingEnabled = false;
      pctx.drawImage(work, fit.x, fit.y, fit.w, fit.h);
    }

    return work;
  }

  /**
   * Une lecture OCR sur le canvas prétraité.
   * @param {HTMLCanvasElement} canvas
   */
  async recognizeOnce(canvas) {
    await this.init();
    const { data } = await this.worker.recognize(canvas);
    const rawText = (data.text || "").replace(/\s+/g, "");
    const grams = parseWeight(rawText);
    return {
      grams,
      rawText,
      confidence: data.confidence ?? 0,
    };
  }

  /**
   * Plusieurs captures rapides + vote majoritaire / médiane.
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

    for (let i = 0; i < this.sampleCount; i++) {
      const canvas = this.extractRoi(video, roiNorm, i === this.sampleCount - 1 ? previewCanvas : undefined);
      const result = await this.recognizeOnce(canvas);
      samples.push(result.rawText || "(vide)");
      lastConfidence = result.confidence;
      if (result.grams != null) values.push(result.grams);
      if (i < this.sampleCount - 1) {
        await sleep(80);
      }
    }

    return {
      grams: stabilize(values),
      rawText: samples[samples.length - 1] ?? "",
      confidence: lastConfidence,
      samples,
    };
  }

  async dispose() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.ready = false;
    }
  }
}

/**
 * Parse le texte OCR en grammes.
 * Accepte "123", "123.4", "123,4", parfois "g" collé.
 * @param {string} text
 * @returns {number|null}
 */
export function parseWeight(text) {
  if (!text) return null;
  const cleaned = text.replace(/[^\d.,]/g, "").replace(",", ".");
  const matches = cleaned.match(DIGIT_PATTERN);
  if (!matches?.length) return null;

  // Prendre le nombre le plus "probable" : le plus long, ou celui avec décimale
  let best = matches[0];
  for (const m of matches) {
    if (m.includes(".") || m.length > best.length) best = m;
  }

  const value = Number.parseFloat(best.replace(",", "."));
  if (!Number.isFinite(value)) return null;
  // Garde-fous pour une balance cuisine typique
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

/**
 * Seuil d'Otsu simplifié + option inversion pour LCD.
 * @param {ImageData} imageData
 * @param {boolean} invert
 */
function binarize(imageData, invert) {
  const { data, width, height } = imageData;
  const hist = new Array(256).fill(0);
  const gray = new Uint8Array(width * height);

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const g = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    gray[p] = g;
    hist[g]++;
  }

  const threshold = otsu(hist, gray.length);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    let v = gray[p] >= threshold ? 255 : 0;
    if (invert) v = 255 - v;
    data[i] = data[i + 1] = data[i + 2] = v;
    data[i + 3] = 255;
  }
}

/** @param {number[]} hist @param {number} total */
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

function fitContain(srcW, srcH, dstW, dstH) {
  const scale = Math.min(dstW / srcW, dstH / srcH);
  const w = srcW * scale;
  const h = srcH * scale;
  return { x: (dstW - w) / 2, y: (dstH - h) / 2, w, h };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
