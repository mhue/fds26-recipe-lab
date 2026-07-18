import {
  addSampleFromCapture,
  captureRoiPng,
  clearSamples,
  deleteSample,
  exportDatasetZip,
  isValidLabel,
  listSamples,
  normalizeLabel,
  updateSampleLabel,
} from "./datasetStore.js";

/**
 * @param {{
 *   getVideo: () => HTMLVideoElement,
 *   getRoi: () => { x: number, y: number, w: number, h: number },
 *   setStatus: (msg: string) => void,
 * }} deps
 */
export function initDatasetUi(deps) {
  const countEl = document.getElementById("dataset-count");
  const listEl = document.getElementById("sample-list");
  const pendingImg = document.getElementById("pending-preview");
  const labelInput = document.getElementById("label-input");
  const btnCapture = document.getElementById("btn-capture");
  const btnSave = document.getElementById("btn-save-sample");
  const btnExport = document.getElementById("btn-export-dataset");
  const btnClear = document.getElementById("btn-clear-dataset");

  /** @type {{ blob: Blob, width: number, height: number, dataUrl: string } | null} */
  let pending = null;

  btnCapture.addEventListener("click", onCapture);
  btnSave.addEventListener("click", onSave);
  btnExport.addEventListener("click", onExport);
  btnClear.addEventListener("click", onClear);
  labelInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onSave();
    }
  });

  refresh();

  async function onCapture() {
    const video = deps.getVideo();
    if (!video?.videoWidth) {
      deps.setStatus("Démarrez d’abord la caméra.");
      return;
    }
    try {
      pending = await captureRoiPng(video, deps.getRoi());
      pendingImg.src = pending.dataUrl;
      pendingImg.hidden = false;
      btnSave.disabled = false;
      labelInput.focus();
      labelInput.select();
      deps.setStatus("Capture OK — saisissez la valeur affichée sur la balance, puis Enregistrer.");
    } catch (err) {
      console.error(err);
      deps.setStatus("Échec de la capture.");
    }
  }

  async function onSave() {
    if (!pending) {
      deps.setStatus("Capturer d’abord une image.");
      return;
    }
    const label = normalizeLabel(labelInput.value);
    if (!isValidLabel(label)) {
      deps.setStatus("Label invalide — ex. 0.00 ou 125.4");
      labelInput.focus();
      return;
    }
    try {
      await addSampleFromCapture(pending, label);
      pending = null;
      pendingImg.hidden = true;
      pendingImg.removeAttribute("src");
      btnSave.disabled = true;
      labelInput.value = "";
      await refresh();
      deps.setStatus(`Exemple enregistré (${label}). Variez les poids et chiffres.`);
    } catch (err) {
      console.error(err);
      deps.setStatus("Impossible d’enregistrer l’exemple.");
    }
  }

  async function onExport() {
    try {
      const result = await exportDatasetZip();
      deps.setStatus(`Exporté ${result.count} exemples → ${result.filename}`);
    } catch (err) {
      console.error(err);
      deps.setStatus(err.message || "Export impossible.");
    }
  }

  async function onClear() {
    if (!confirm("Effacer tous les exemples collectés sur cet appareil ?")) return;
    await clearSamples();
    pending = null;
    pendingImg.hidden = true;
    btnSave.disabled = true;
    await refresh();
    deps.setStatus("Dataset vidé.");
  }

  async function refresh() {
    const samples = await listSamples();
    countEl.textContent = String(samples.length);
    listEl.innerHTML = "";

    if (!samples.length) {
      listEl.innerHTML = `<p class="dataset-empty">Aucun exemple. Cadrez l’écran, capturez, annotez.</p>`;
      return;
    }

    for (const sample of samples) {
      const url = URL.createObjectURL(sample.image);
      const card = document.createElement("article");
      card.className = "sample-card";
      card.innerHTML = `
        <img alt="exemple ${sample.label}" />
        <div class="sample-meta">
          <input class="sample-label" type="text" inputmode="decimal" value="${escapeAttr(sample.label)}" aria-label="Label" />
          <button type="button" class="ghost sample-delete">Suppr.</button>
        </div>
      `;
      const img = card.querySelector("img");
      img.src = url;
      img.onload = () => URL.revokeObjectURL(url);

      card.querySelector(".sample-delete").addEventListener("click", async () => {
        await deleteSample(sample.id);
        await refresh();
        deps.setStatus("Exemple supprimé.");
      });

      const input = card.querySelector(".sample-label");
      input.addEventListener("change", async () => {
        const next = normalizeLabel(input.value);
        if (!isValidLabel(next)) {
          input.value = sample.label;
          deps.setStatus("Label invalide.");
          return;
        }
        await updateSampleLabel(sample.id, next);
        input.value = next;
        deps.setStatus(`Label mis à jour → ${next}`);
      });

      listEl.appendChild(card);
    }
  }

  return {
    refresh,
    setCameraReady(ready) {
      btnCapture.disabled = !ready;
    },
  };
}

/** @param {string} value */
function escapeAttr(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}
