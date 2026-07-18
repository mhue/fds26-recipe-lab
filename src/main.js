import { listSamples } from "./datasetStore.js";
import { initDatasetUi } from "./datasetUi.js";
import { ScaleDigitReader } from "./scaleDigitReader.js";
import {
  clearModel,
  learnDigitModel,
  loadModel,
  recognizeWithModel,
} from "./templateModel.js";

const video = document.getElementById("camera");
const preview = document.getElementById("preview");
const roiEl = document.getElementById("roi");
const weightEl = document.getElementById("weight");
const statusEl = document.getElementById("status");
const modelStateEl = document.getElementById("model-state");
const calibEl = document.getElementById("calib-state");
const btnStart = document.getElementById("btn-start");
const btnLearn = document.getElementById("btn-learn");
const btnRead = document.getElementById("btn-read");
const btnLive = document.getElementById("btn-live");
const btnCalibrate = document.getElementById("btn-calibrate");
const btnClearCalib = document.getElementById("btn-clear-calib");
const btnClearModel = document.getElementById("btn-clear-model");
const invertEl = document.getElementById("invert");
const morePanel = document.getElementById("more-panel");
const btnToggleMore = document.getElementById("btn-toggle-more");

const reader = new ScaleDigitReader({ samples: 5, invert: null });
/** @type {import('./templateModel.js').DigitModel|null} */
let digitModel = loadModel();
let live = false;
let liveLoop = 0;

const datasetUi = initDatasetUi({
  getVideo: () => video,
  getRoi: () => getRoiNormalized(),
  setStatus: (msg) => {
    statusEl.textContent = msg;
  },
});

btnStart.addEventListener("click", startCamera);
btnLearn.addEventListener("click", learnFromDataset);
btnRead.addEventListener("click", () => readOnce());
btnLive.addEventListener("click", toggleLive);
btnCalibrate.addEventListener("click", calibrate);
btnClearCalib.addEventListener("click", clearCalibration);
btnClearModel.addEventListener("click", () => {
  clearModel();
  digitModel = null;
  updateModelUi();
  statusEl.textContent = "Modèle effacé — recliquez Apprendre.";
});
btnToggleMore.addEventListener("click", () => {
  const open = morePanel.hasAttribute("hidden");
  if (open) morePanel.removeAttribute("hidden");
  else morePanel.setAttribute("hidden", "");
  btnToggleMore.setAttribute("aria-expanded", String(open));
  btnToggleMore.textContent = open ? "Fermer" : "Plus";
});
invertEl.addEventListener("change", () => {
  reader.setInvert(invertModeFromUi());
});

function invertModeFromUi() {
  const mode = invertEl.value;
  if (mode === "lcd") return true;
  if (mode === "led") return false;
  return null;
}

setupRoiInteraction(roiEl);
updateCalibrationUi();
updateModelUi();

async function startCamera() {
  statusEl.textContent = "Demande d’accès caméra…";
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });
    video.srcObject = stream;
    await video.play();
    btnStart.disabled = true;
    btnLearn.disabled = false;
    btnCalibrate.disabled = false;
    btnClearCalib.disabled = false;
    datasetUi.setCameraReady(true);
    await reader.init();
    updateModelUi();
    statusEl.textContent = digitModel
      ? "Caméra prête — Lire utilise vos exemples annotés."
      : "Caméra prête — Apprendre (vos 4 images), puis Lire.";
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Impossible d’accéder à la caméra (HTTPS ou localhost requis).";
  }
}

async function learnFromDataset() {
  setBusy(true);
  statusEl.textContent = "Apprentissage depuis les exemples…";
  try {
    const samples = await listSamples();
    const result = await learnDigitModel(samples);
    digitModel = result.model;
    updateModelUi();
    statusEl.textContent = result.message;
    if (result.perSample?.length) {
      console.log("learn per sample:", result.perSample);
    }
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Échec de l’apprentissage.";
  } finally {
    setBusy(false);
  }
}

async function readOnce() {
  if (!video.videoWidth) {
    statusEl.textContent = "Vidéo pas encore prête.";
    return;
  }
  setBusy(true);
  statusEl.textContent = "Lecture…";
  try {
    preview.hidden = false;
    if (digitModel) {
      const readings = [];
      for (let i = 0; i < 5; i++) {
        const frame = reader.captureRoi(video, getRoiNormalized());
        const fctx = frame.getContext("2d", { willReadFrequently: true });
        const data = fctx.getImageData(0, 0, frame.width, frame.height);
        const one = recognizeWithModel(data, digitModel, i === 4 ? preview : null);
        readings.push(one);
        if (i < 4) await wait(35);
      }
      showTemplateResult(readings);
    } else {
      // Même géométrie 7 cases, sans templates (fallback 7-segments seul)
      const readings = [];
      for (let i = 0; i < 5; i++) {
        const frame = reader.captureRoi(video, getRoiNormalized());
        const fctx = frame.getContext("2d", { willReadFrequently: true });
        const data = fctx.getImageData(0, 0, frame.width, frame.height);
        const one = recognizeWithModel(data, null, i === 4 ? preview : null);
        readings.push(one);
        if (i < 4) await wait(35);
      }
      showTemplateResult(readings);
    }
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Erreur de lecture.";
  } finally {
    setBusy(false);
  }
}

/** @param {import('./templateModel.js').TemplateReading[]} readings */
function showTemplateResult(readings) {
  const values = readings.map((r) => r.value).filter((v) => v != null);
  const texts = readings.map((r) => r.text || "?");
  const last = readings[readings.length - 1];
  const grams = stabilize(values);

  if (grams == null) {
    weightEl.textContent = "—";
    weightEl.classList.remove("has-value");
    statusEl.textContent = `Non lu · ${texts.join(" · ")}`;
    return;
  }
  weightEl.textContent = formatWeight(grams);
  weightEl.classList.add("has-value");
  statusEl.textContent = `XXXXX.XX (${last.confidence}%) · ${texts.join(" · ")}`;
}

function showSevenSegResult(result) {
  if (result.grams == null) {
    weightEl.textContent = "—";
    weightEl.classList.remove("has-value");
    statusEl.textContent = `Non lu (${result.samples.join(" · ")})`;
    return;
  }
  weightEl.textContent = formatWeight(result.grams);
  weightEl.classList.add("has-value");
  statusEl.textContent = `7-seg (${result.confidence}%) · ${result.samples.join(" · ")}`;
}

async function calibrate() {
  if (!video.videoWidth) {
    statusEl.textContent = "Vidéo pas encore prête.";
    return;
  }
  setBusy(true);
  statusEl.textContent = "Calibration 7-seg sur 0.00…";
  try {
    preview.hidden = false;
    const result = await reader.calibrateZero(video, getRoiNormalized(), preview);
    updateCalibrationUi();
    statusEl.textContent = result.message;
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Erreur de calibration.";
  } finally {
    setBusy(false);
  }
}

function clearCalibration() {
  reader.clearCalibration();
  updateCalibrationUi();
  statusEl.textContent = "Calibration 7-seg effacée.";
}

function formatWeight(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** @param {number[]} values */
function stabilize(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10;
  }
  return sorted[mid];
}

function updateModelUi() {
  const hasCam = Boolean(video.srcObject);
  btnRead.disabled = !hasCam;
  btnLive.disabled = !hasCam;
  btnLearn.disabled = !hasCam;

  if (digitModel) {
    modelStateEl.textContent = `Modèle XXXXX.XX · ${digitModel.coveredDigits.join("")} (${digitModel.sampleCount} ex.)`;
    modelStateEl.dataset.state = "ready";
  } else {
    modelStateEl.textContent = "Modèle : non appris — cliquez Apprendre";
    modelStateEl.dataset.state = "missing";
  }
}

function updateCalibrationUi() {
  if (!calibEl) return;
  if (reader.isCalibrated()) {
    const cal = reader.getCalibration();
    calibEl.textContent = `Calibration 7-seg : ${cal.zeroText}`;
    calibEl.dataset.state = "ready";
  } else {
    calibEl.textContent = "Calibration 7-seg : non";
    calibEl.dataset.state = "missing";
  }
}

function setBusy(busy) {
  if (live) return;
  const hasCam = Boolean(video.srcObject);
  btnLearn.disabled = busy || !hasCam;
  btnRead.disabled = busy || !hasCam;
  btnLive.disabled = busy || !hasCam;
  btnCalibrate.disabled = busy || !hasCam;
  btnClearCalib.disabled = busy || !hasCam;
}

async function toggleLive() {
  live = !live;
  btnLive.setAttribute("aria-pressed", String(live));
  btnLive.textContent = live ? "Stop" : "Live";
  btnRead.disabled = live;
  btnLearn.disabled = live;
  btnCalibrate.disabled = live;
  if (!live) {
    liveLoop += 1;
    statusEl.textContent = "Live arrêté.";
    updateModelUi();
    return;
  }
  const token = ++liveLoop;
  statusEl.textContent = "Live…";
  while (live && token === liveLoop) {
    await readOnce();
    await wait(350);
  }
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function getRoiNormalized() {
  const box = roiEl.parentElement.getBoundingClientRect();
  const roi = roiEl.getBoundingClientRect();
  return {
    x: (roi.left - box.left) / box.width,
    y: (roi.top - box.top) / box.height,
    w: roi.width / box.width,
    h: roi.height / box.height,
  };
}

function setupRoiInteraction(el) {
  let mode = null;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;
  let startW = 0;
  let startH = 0;
  let handle = null;

  const onPointerDown = (event) => {
    const target = event.target;
    handle = target.dataset?.handle || null;
    mode = handle ? "resize" : "move";
    el.classList.add("dragging");
    el.setPointerCapture(event.pointerId);
    startX = event.clientX;
    startY = event.clientY;
    startLeft = el.offsetLeft;
    startTop = el.offsetTop;
    startW = el.offsetWidth;
    startH = el.offsetHeight;
    event.preventDefault();
  };

  const onPointerMove = (event) => {
    if (!mode) return;
    const parent = el.parentElement;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    const maxW = parent.clientWidth;
    const maxH = parent.clientHeight;

    if (mode === "move") {
      const left = clamp(startLeft + dx, 0, maxW - el.offsetWidth);
      const top = clamp(startTop + dy, 0, maxH - el.offsetHeight);
      el.style.left = `${(left / maxW) * 100}%`;
      el.style.top = `${(top / maxH) * 100}%`;
      return;
    }

    let left = startLeft;
    let top = startTop;
    let w = startW;
    let h = startH;

    if (handle.includes("e")) w = startW + dx;
    if (handle.includes("s")) h = startH + dy;
    if (handle.includes("w")) {
      left = startLeft + dx;
      w = startW - dx;
    }
    if (handle.includes("n")) {
      top = startTop + dy;
      h = startH - dy;
    }

    w = clamp(w, 40, maxW);
    h = clamp(h, 24, maxH);
    left = clamp(left, 0, maxW - w);
    top = clamp(top, 0, maxH - h);

    el.style.left = `${(left / maxW) * 100}%`;
    el.style.top = `${(top / maxH) * 100}%`;
    el.style.width = `${(w / maxW) * 100}%`;
    el.style.height = `${(h / maxH) * 100}%`;
  };

  const onPointerUp = (event) => {
    if (!mode) return;
    mode = null;
    handle = null;
    el.classList.remove("dragging");
    try {
      el.releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
  };

  el.addEventListener("pointerdown", onPointerDown);
  el.addEventListener("pointermove", onPointerMove);
  el.addEventListener("pointerup", onPointerUp);
  el.addEventListener("pointercancel", onPointerUp);
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}
