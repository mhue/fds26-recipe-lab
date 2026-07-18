import { ScaleDigitReader } from "./scaleDigitReader.js";
import { initDatasetUi } from "./datasetUi.js";

const video = document.getElementById("camera");
const preview = document.getElementById("preview");
const roiEl = document.getElementById("roi");
const weightEl = document.getElementById("weight");
const statusEl = document.getElementById("status");
const calibEl = document.getElementById("calib-state");
const btnStart = document.getElementById("btn-start");
const btnCalibrate = document.getElementById("btn-calibrate");
const btnClearCalib = document.getElementById("btn-clear-calib");
const btnRead = document.getElementById("btn-read");
const btnLive = document.getElementById("btn-live");
const invertEl = document.getElementById("invert");

const reader = new ScaleDigitReader({ samples: 7, invert: null });
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
btnCalibrate.addEventListener("click", calibrate);
btnClearCalib.addEventListener("click", clearCalibration);
btnRead.addEventListener("click", () => readOnce());
btnLive.addEventListener("click", toggleLive);
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
    btnCalibrate.disabled = false;
    btnClearCalib.disabled = false;
    btnRead.disabled = false;
    btnLive.disabled = false;
    datasetUi.setCameraReady(true);
    await reader.init();
    statusEl.textContent =
      "Caméra prête — cadrez les chiffres, puis collectez des exemples annotés ci-dessous.";
    updateCalibrationUi();
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Impossible d’accéder à la caméra (HTTPS ou localhost requis).";
  }
}

async function calibrate() {
  if (!video.videoWidth) {
    statusEl.textContent = "Vidéo pas encore prête.";
    return;
  }
  setBusy(true);
  statusEl.textContent = "Calibration sur 0.00… (balance tarée)";
  try {
    const result = await reader.calibrateZero(video, getRoiNormalized(), preview);
    updateCalibrationUi();
    if (result.ok) {
      weightEl.textContent = "0";
      weightEl.classList.add("has-value");
      statusEl.textContent = `${result.message} · échantillons: ${result.samples.join(" · ")}`;
    } else {
      weightEl.textContent = "—";
      weightEl.classList.remove("has-value");
      statusEl.textContent = `${result.message} (${result.samples.join(" · ")})`;
    }
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
  statusEl.textContent = "Calibration effacée — refaites tare + Calibrer.";
}

async function readOnce() {
  if (!video.videoWidth) {
    statusEl.textContent = "Vidéo pas encore prête.";
    return;
  }
  setBusy(true);
  statusEl.textContent = "Lecture en cours…";
  try {
    const result = await reader.read(video, getRoiNormalized(), preview);
    showResult(result);
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Erreur de lecture.";
  } finally {
    setBusy(false);
  }
}

function showResult(result) {
  if (result.grams == null) {
    weightEl.textContent = "—";
    weightEl.classList.remove("has-value");
    statusEl.textContent = `Non lu (${result.samples.join(" · ")})`;
    return;
  }
  weightEl.textContent = formatWeight(result.grams);
  weightEl.classList.add("has-value");
  const tag = result.calibrated ? "calibré" : "auto";
  statusEl.textContent = `OK ${tag} (${result.confidence}%) · ${result.samples.join(" · ")}`;
}

function formatWeight(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function updateCalibrationUi() {
  if (reader.isCalibrated()) {
    const cal = reader.getCalibration();
    calibEl.textContent = `Calibré · ${cal.zeroText} · ${cal.digits.length} digits`;
    calibEl.dataset.state = "ready";
  } else {
    calibEl.textContent = "Non calibré";
    calibEl.dataset.state = "missing";
  }
}

function setBusy(busy) {
  if (live) return;
  btnCalibrate.disabled = busy || !video.srcObject;
  btnClearCalib.disabled = busy || !video.srcObject;
  btnRead.disabled = busy || !video.srcObject;
  btnLive.disabled = busy || !video.srcObject;
}

async function toggleLive() {
  live = !live;
  btnLive.setAttribute("aria-pressed", String(live));
  btnLive.textContent = live ? "Stop lecture" : "Lecture continue";
  btnRead.disabled = live;
  btnCalibrate.disabled = live;
  btnClearCalib.disabled = live;
  if (!live) {
    liveLoop += 1;
    statusEl.textContent = "Lecture continue arrêtée.";
    return;
  }
  const token = ++liveLoop;
  statusEl.textContent = "Lecture continue…";
  while (live && token === liveLoop) {
    await readOnce();
    await wait(400);
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
