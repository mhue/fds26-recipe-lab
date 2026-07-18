/**
 * Stockage local d'exemples annotés (ROI caméra + label texte).
 * Persistance IndexedDB, export ZIP (images PNG + labels.csv + manifest.json).
 */

import JSZip from "jszip";

const DB_NAME = "recipe-lab-dataset";
const DB_VERSION = 1;
const STORE = "samples";

/**
 * @typedef {object} DatasetSample
 * @property {string} id
 * @property {string} label
 * @property {Blob} image
 * @property {number} width
 * @property {number} height
 * @property {number} capturedAt
 */

/** @returns {Promise<IDBDatabase>} */
function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * @template T
 * @param {IDBRequest<T>} request
 * @returns {Promise<T>}
 */
function idbReq(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** @returns {Promise<DatasetSample[]>} */
export async function listSamples() {
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const rows = await idbReq(tx.objectStore(STORE).getAll());
  rows.sort((a, b) => b.capturedAt - a.capturedAt);
  return rows;
}

/** @param {DatasetSample} sample */
export async function saveSample(sample) {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  await idbReq(tx.objectStore(STORE).put(sample));
  await txDone(tx);
}

/** @param {string} id */
export async function deleteSample(id) {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  await idbReq(tx.objectStore(STORE).delete(id));
  await txDone(tx);
}

/** @param {string} id @param {string} label */
export async function updateSampleLabel(id, label) {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  const sample = await idbReq(store.get(id));
  if (!sample) throw new Error("Exemple introuvable");
  sample.label = normalizeLabel(label);
  await idbReq(store.put(sample));
  await txDone(tx);
  return sample;
}

export async function clearSamples() {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  await idbReq(tx.objectStore(STORE).clear());
  await txDone(tx);
}

/**
 * Capture la ROI vidéo en PNG.
 * @param {HTMLVideoElement} video
 * @param {{ x: number, y: number, w: number, h: number }} roiNorm
 * @param {{ maxWidth?: number }} [options]
 * @returns {Promise<{ blob: Blob, width: number, height: number, dataUrl: string }>}
 */
export async function captureRoiPng(video, roiNorm, options = {}) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) throw new Error("Flux vidéo pas encore prêt");

  const sx = Math.round(roiNorm.x * vw);
  const sy = Math.round(roiNorm.y * vh);
  const sw = Math.max(8, Math.round(roiNorm.w * vw));
  const sh = Math.max(8, Math.round(roiNorm.h * vh));

  const maxWidth = options.maxWidth ?? 480;
  const scale = Math.min(4, Math.max(1, maxWidth / sw));
  const width = Math.round(sw * scale);
  const height = Math.round(sh * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, width, height);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Échec capture PNG"))),
      "image/png",
    );
  });

  const dataUrl = canvas.toDataURL("image/png");
  return { blob, width, height, dataUrl };
}

/**
 * @param {{ blob: Blob, width: number, height: number }} capture
 * @param {string} label
 */
export async function addSampleFromCapture(capture, label) {
  const sample = {
    id: crypto.randomUUID(),
    label: normalizeLabel(label),
    image: capture.blob,
    width: capture.width,
    height: capture.height,
    capturedAt: Date.now(),
  };
  await saveSample(sample);
  return sample;
}

/** @param {string} label */
export function normalizeLabel(label) {
  return String(label || "")
    .trim()
    .replace(",", ".")
    .replace(/[^\d.]/g, "")
    .replace(/(\..*)\./g, "$1");
}

/** @param {string} label */
export function isValidLabel(label) {
  const n = normalizeLabel(label);
  if (!n || n === ".") return false;
  return Number.isFinite(Number.parseFloat(n));
}

/**
 * Exporte le dataset en ZIP téléchargeable.
 * @returns {Promise<{ count: number, filename: string }>}
 */
export async function exportDatasetZip() {
  const samples = await listSamples();
  if (!samples.length) {
    throw new Error("Aucun exemple à exporter");
  }

  const zip = new JSZip();
  const folder = zip.folder("images");
  const rows = ["filename,label,width,height,captured_at"];
  /** @type {object[]} */
  const manifestSamples = [];

  samples
    .slice()
    .sort((a, b) => a.capturedAt - b.capturedAt)
    .forEach((sample, index) => {
      const name = `sample_${String(index + 1).padStart(4, "0")}.png`;
      const path = `images/${name}`;
      folder.file(name, sample.image);
      rows.push(
        [
          path,
          csvEscape(sample.label),
          sample.width,
          sample.height,
          new Date(sample.capturedAt).toISOString(),
        ].join(","),
      );
      manifestSamples.push({
        id: sample.id,
        file: path,
        label: sample.label,
        width: sample.width,
        height: sample.height,
        capturedAt: new Date(sample.capturedAt).toISOString(),
      });
    });

  zip.file("labels.csv", `${rows.join("\n")}\n`);
  zip.file(
    "manifest.json",
    JSON.stringify(
      {
        name: "recipe-lab-scale-digits",
        createdAt: new Date().toISOString(),
        count: samples.length,
        labelType: "display_value",
        notes:
          "Chaque image est un crop de l'écran de balance. Le label est la valeur affichée (ex: 0.00, 125.4).",
        samples: manifestSamples,
      },
      null,
      2,
    ),
  );

  const blob = await zip.generateAsync({ type: "blob" });
  const filename = `scale-dataset-${stamp()}.zip`;
  downloadBlob(blob, filename);
  return { count: samples.length, filename };
}

/** @param {IDBTransaction} tx */
function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("Transaction aborted"));
  });
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

/** @param {string} value */
function csvEscape(value) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** @param {Blob} blob @param {string} filename */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
