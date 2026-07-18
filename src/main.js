import { ScaleDigitReader } from "./scaleDigitReader.js";

const video = document.getElementById("camera");
const overlay = document.getElementById("overlay");
const preview = document.getElementById("preview");
const roiEl = document.getElementById("roi");
const weightEl = document.getElementById("weight");
const statusEl = document.getElementById("status");
const btnStart = document.getElementById("btn-start");
const btnRead = document.getElementById("btn-read");
const btnLive = document.getElementById("btn-live");
const invertEl = document.getElementById("invert");

const reader = new ScaleDigitReader({ samples: 7, invert: null });
let live = false;
let liveLoop = 0;
let stream = null;

btnStart.addEventListener("click", startCamera);
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

async function startCamera() {
  statusEl.textContent = "Demande d’accès caméra…";
  try {
    stream = await navigator.mediaDevices.getUserMedia({
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
    btnRead.disabled = false;
    btnLive.disabled = false;
    await reader.init();
    statusEl.textContent = "Prêt — cadrez uniquement les chiffres (7-segments), puis lisez.";
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Impossible d’accéder à la caméra (HTTPS ou localhost requis).";
  }
}

async function readOnce() {
  if (!video.videoWidth) {
    statusEl.textContent = "Vidéo pas encore prête.";
    return;
  }
  btnRead.disabled = true;
  statusEl.textContent = "Lecture en cours…";
  try {
    const roi = getRoiNormalized();
    const result = await reader.read(video, roi, preview);
    showResult(result);
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Erreur de lecture.";
  } finally {
    if (!live) btnRead.disabled = false;
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
  statusEl.textContent = `OK (${result.confidence}%) · ${result.samples.join(" · ")}`;
}

function formatWeight(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

async function toggleLive() {
  live = !live;
  btnLive.setAttribute("aria-pressed", String(live));
  btnLive.textContent = live ? "Stop lecture" : "Lecture continue";
  btnRead.disabled = live;
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
