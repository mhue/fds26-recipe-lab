import {
  CATEGORIES,
  FOODS,
  foodImage,
  impactFor,
} from "./foods.js";
import { SCHOOL_LEVELS, levelById, lunchKcal } from "./levels.js";
import {
  NUTRISCORE_GRADES,
  NUTRISCORE_QUIZ,
  NUTRISCORE_STEPS,
} from "./nutriscore.js";
import {
  TEAM_COLORS,
  addScore,
  clearScores,
  rankingFor,
} from "./teams.js";
import { serialSupported, usbScale } from "./usbScale.js";

/** @typedef {'home'|'setup'|'compose'|'weigh'|'result'|'board'|'nutri'} Screen */
/** @typedef {'climat'|'energie'} Mode */
/** @typedef {'all'|Mode} BoardFilter */

const app = document.getElementById("app");

/** @type {{
 *   screen: Screen,
 *   mode: Mode,
 *   levelId: import('./levels.js').LevelId,
 *   boardFilter: BoardFilter,
 *   teamName: string,
 *   teamColor: string,
 *   plate: { foodId: string, grams: number }[],
 *   skipped: string[],
 *   weighFoodId: string|null,
 *   weighDraft: string,
 *   quizIndex: number,
 *   quizScore: number,
 *   lastResult: import('./teams.js').TeamScore|null,
 *   resultSaved: boolean,
 * }} */
const state = {
  screen: "home",
  mode: "energie",
  levelId: "cp",
  boardFilter: "all",
  teamName: "",
  teamColor: TEAM_COLORS[0].hex,
  plate: [],
  skipped: [],
  weighFoodId: null,
  weighDraft: "",
  quizIndex: 0,
  quizScore: 0,
  lastResult: null,
  resultSaved: false,
};

const MODE_LABEL = {
  climat: "Défi planète",
  energie: "Défi apports énergétiques",
};

const MODE_SHORT = {
  climat: "Planète",
  energie: "Énergie",
};

init();

function init() {
  // Import poids depuis la page balance (?grams=…)
  const params = new URLSearchParams(location.search);
  const grams = params.get("grams");
  if (grams && state.weighFoodId === null) {
    // Soft hint only if returning mid-session via hash
  }
  const hash = location.hash.replace("#", "");
  if (hash === "nutri") state.screen = "nutri";
  if (hash === "board") {
    state.screen = "board";
    state.boardFilter = "all";
  }
  render();
  usbScale.subscribe(applyScaleToWeighUi);
  window.addEventListener("hashchange", () => {
    const h = location.hash.replace("#", "");
    if (h === "nutri") state.screen = "nutri";
    else if (h === "board") {
      state.screen = "board";
      state.boardFilter = "all";
    } else if (h === "" || h === "home") state.screen = "home";
    render();
  });
}

function render() {
  app.innerHTML = "";
  app.appendChild(shell());
}

function shell() {
  const root = el("div", { class: "shell" });
  root.appendChild(header());
  const main = el("main", { class: "main", id: "main" });
  switch (state.screen) {
    case "home":
      main.appendChild(viewHome());
      break;
    case "setup":
      main.appendChild(viewSetup());
      break;
    case "compose":
      main.appendChild(viewCompose());
      break;
    case "weigh":
      main.appendChild(viewWeigh());
      break;
    case "result":
      main.appendChild(viewResult());
      break;
    case "board":
      main.appendChild(viewBoard());
      break;
    case "nutri":
      main.appendChild(viewNutri());
      break;
    default:
      main.appendChild(viewHome());
  }
  root.appendChild(main);
  return root;
}

function header() {
  const h = el("header", { class: "brand-bar" });
  const brand = el("button", {
    class: "brand",
    type: "button",
    "aria-label": "Retour à l’accueil",
  });
  brand.innerHTML = `<span class="brand-mark" aria-hidden="true"></span><span class="brand-name">Assiette Lab</span>`;
  brand.addEventListener("click", () => go("home"));
  h.appendChild(brand);

  const nav = el("nav", { class: "top-nav", "aria-label": "Navigation" });
  nav.append(
    navBtn("Défi", () => go(state.teamName ? "compose" : "home")),
    navBtn("Classement", () => go("board")),
    navBtn("Nutri-Score", () => go("nutri")),
  );
  h.appendChild(nav);
  return h;
}

function navBtn(label, onClick) {
  const b = el("button", { type: "button", class: "nav-link" });
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

function viewHome() {
  const level = currentLevel();
  const target = lunchKcal(level.id);
  const v = el("section", { class: "view home-view" });
  v.innerHTML = `
    <div class="hero-plane" aria-hidden="true"></div>
    <div class="hero-copy">
      <p class="eyebrow">Fête de la science</p>
      <h1 class="hero-title">Assiette Lab</h1>
      <p class="hero-lead">Trois activités séparées, pour ne pas mélanger les calories et le CO₂.</p>
    </div>
    <fieldset class="level-picker">
      <legend>Niveau de la classe</legend>
      <div class="chip-row" role="radiogroup" aria-label="Niveau">
        ${SCHOOL_LEVELS.map(
          (item) =>
            `<button type="button" class="chip ${state.levelId === item.id ? "is-on" : ""}" data-level="${item.id}">${item.label}</button>`,
        ).join("")}
      </div>
      <p class="level-target">Cible du défi énergie, ${level.label} (${level.age} ans) : <strong>${target} kcal</strong> au déjeuner.</p>
    </fieldset>
    <div class="activity-list">
      <button type="button" class="activity-card" data-act="energie">
        <strong>Défi apports énergétiques</strong>
        <span>Ni trop, ni trop peu : juste les ${target} kcal du niveau. Pour les plus jeunes.</span>
      </button>
      <button type="button" class="activity-card" data-act="nutri">
        <strong>Atelier Nutri-Score</strong>
        <span>La lettre sur l’emballage. On ne parle pas de CO₂.</span>
      </button>
      <button type="button" class="activity-card" data-act="climat">
        <strong>Défi planète</strong>
        <span>Le moins de CO₂ possible. Pour les plus grands, ou s’il reste du temps.</span>
      </button>
    </div>
  `;
  v.querySelectorAll("[data-level]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.levelId = /** @type {import('./levels.js').LevelId} */ (btn.getAttribute("data-level") || "cp");
      render();
    });
  });
  v.querySelector("[data-act=energie]")?.addEventListener("click", () => {
    state.mode = "energie";
    go("setup");
  });
  v.querySelector("[data-act=climat]")?.addEventListener("click", () => {
    state.mode = "climat";
    go("setup");
  });
  v.querySelector("[data-act=nutri]")?.addEventListener("click", () => go("nutri"));
  return v;
}

function viewSetup() {
  const level = currentLevel();
  const target = lunchKcal(level.id);
  const v = el("section", { class: "view setup-view" });
  v.appendChild(
    titleBlock(
      MODE_LABEL[state.mode],
      state.mode === "energie"
        ? "Le but est de manger juste ce qu’il faut : ni trop, ni trop peu."
        : "Le but est d’émettre le moins de CO₂ possible.",
    ),
  );

  const form = el("form", { class: "setup-form" });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = /** @type {HTMLInputElement} */ (form.querySelector("#team-name")).value.trim();
    if (!name) return;
    state.teamName = name.slice(0, 24);
    state.plate = [];
    state.skipped = [];
    go("compose");
  });

  form.innerHTML = `
    <fieldset class="level-picker">
      <legend>Niveau</legend>
      <div class="chip-row" role="radiogroup" aria-label="Niveau">
        ${SCHOOL_LEVELS.map(
          (item) =>
            `<button type="button" class="chip ${state.levelId === item.id ? "is-on" : ""}" data-level="${item.id}">${item.label}</button>`,
        ).join("")}
      </div>
      <p class="level-target">${
        state.mode === "energie"
          ? `${level.label}, ${level.age} ans : environ ${level.dailyKcal.toLocaleString("fr-FR")} kcal par jour. Le déjeuner en prend 35 %, soit <strong>${target} kcal</strong>.`
          : `Classe de ${level.label}. Ici on ne compte que le CO₂.`
      }</p>
    </fieldset>
    <fieldset>
      <legend>Couleur d’équipe</legend>
      <div class="color-row" role="radiogroup" aria-label="Couleur">
        ${TEAM_COLORS.map(
          (c) => `
          <button type="button" class="color-swatch ${state.teamColor === c.hex ? "is-on" : ""}"
            data-color="${c.hex}" style="--sw:${c.hex}" title="${c.label}" aria-label="${c.label}"></button>`,
        ).join("")}
      </div>
    </fieldset>
    <label class="field">
      <span>Nom de l’équipe</span>
      <input id="team-name" name="team" maxlength="24" placeholder="Les Petits Pois" autocomplete="off" required value="${escapeAttr(state.teamName)}" />
    </label>
    <button type="submit" class="btn primary wide">Composer le repas</button>
  `;

  form.querySelectorAll("[data-level]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.levelId = /** @type {import('./levels.js').LevelId} */ (btn.getAttribute("data-level") || "cp");
      go("setup");
    });
  });
  form.querySelectorAll("[data-color]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.teamColor = btn.getAttribute("data-color") || state.teamColor;
      go("setup");
    });
  });

  v.appendChild(form);
  return v;
}

function viewCompose() {
  const foods = FOODS;
  const totals = plateTotals();
  const v = el("section", { class: "view compose-view" });

  const head = el("div", { class: "compose-head" });
  head.innerHTML = `
    <div>
      <p class="team-pill" style="--team:${state.teamColor}"><span></span>${escapeHtml(state.teamName)}</p>
      <h2>Composez le repas</h2>
      <p class="muted">${MODE_LABEL[state.mode]}</p>
    </div>
  `;
  v.appendChild(head);
  const note = el("p", { class: "challenge-note" });
  note.textContent = challengeNote();
  v.appendChild(note);
  v.appendChild(meterBar(totals));

  const missing = CATEGORIES.filter((c) => !categoryChosen(c.id));

  const checklist = el("p", { class: "checklist" });
  checklist.textContent =
    missing.length === 0
      ? "Tous les composants sont choisis. Un repas peut être peu équilibré."
      : `Encore à choisir : ${missing.map((m) => m.label.toLowerCase()).join(", ")}.`;
  v.appendChild(checklist);

  const rows = plateRows();
  if (rows.length) {
    const plate = el("ul", { class: "plate-list" });
    for (const row of rows) {
      const li = el("li", { class: "plate-item" });
      if (row.kind === "rien") {
        li.innerHTML = `
          <span class="food-thumb rien-thumb" aria-hidden="true">—</span>
          <div>
            <strong>Rien</strong>
            <span>${escapeHtml(row.category.label)}</span>
          </div>
        `;
        const rm = el("button", { type: "button", class: "icon-btn", "aria-label": "Retirer" });
        rm.textContent = "×";
        rm.addEventListener("click", () => {
          state.skipped = state.skipped.filter((id) => id !== row.category.id);
          render();
        });
        li.appendChild(rm);
      } else {
        const imp = impactFor(row.food, row.item.grams);
        li.innerHTML = `
          <img class="food-thumb" src="${foodImage(row.food)}" alt="" width="48" height="48" />
          <div>
            <strong>${escapeHtml(row.food.name)}</strong>
            <span>${portionLine(row.item.grams, imp)}</span>
          </div>
        `;
        const rm = el("button", { type: "button", class: "icon-btn", "aria-label": "Retirer" });
        rm.textContent = "×";
        rm.addEventListener("click", () => {
          state.plate = state.plate.filter((p) => p.foodId !== row.item.foodId);
          render();
        });
        li.appendChild(rm);
      }
      plate.appendChild(li);
    }
    v.appendChild(plate);
  }

  for (const cat of CATEGORIES) {
    const groupFoods = foods.filter((f) => f.category === cat.id);
    if (!groupFoods.length) continue;
    const block = el("section", { class: "food-group" });
    block.innerHTML = `<h3>${cat.label}</h3>`;
    const grid = el("div", { class: "food-grid" });
    for (const food of groupFoods) {
      const onPlate = state.plate.some((p) => p.foodId === food.id);
      const btn = el("button", {
        type: "button",
        class: `food-card ${onPlate ? "is-on" : ""}`,
        style: `--h:${food.hue}`,
        "aria-label": onPlate ? `${food.name}, déjà dans l’assiette` : food.name,
      });
      btn.innerHTML = `
        <img class="food-photo" src="${foodImage(food)}" alt="" width="280" height="280" />
        <span class="food-name">${escapeHtml(food.name)}</span>
      `;
      btn.addEventListener("click", () => {
        state.weighFoodId = food.id;
        state.weighDraft = onPlate
          ? String(state.plate.find((p) => p.foodId === food.id)?.grams || "")
          : "";
        go("weigh");
      });
      grid.appendChild(btn);
    }
    const rienOn = state.skipped.includes(cat.id);
    const rien = el("button", {
      type: "button",
      class: `food-card is-rien ${rienOn ? "is-on" : ""}`,
      "aria-label": rienOn ? `Rien pour ${cat.label}, déjà choisi` : `Rien pour ${cat.label}`,
      "aria-pressed": rienOn ? "true" : "false",
    });
    rien.innerHTML = `
      <span class="food-photo rien-visual" aria-hidden="true">—</span>
      <span class="food-name">Rien</span>
    `;
    rien.addEventListener("click", () => {
      state.plate = state.plate.filter((p) => {
        const food = FOODS.find((f) => f.id === p.foodId);
        return food?.category !== cat.id;
      });
      if (!state.skipped.includes(cat.id)) state.skipped.push(cat.id);
      render();
    });
    grid.appendChild(rien);
    block.appendChild(grid);
    v.appendChild(block);
  }

  const photoSrc = el("p", { class: "source" });
  photoSrc.innerHTML =
    'Photos : <a href="https://commons.wikimedia.org/" target="_blank" rel="noopener">Wikimedia Commons</a>, <a href="https://pixabay.com/" target="_blank" rel="noopener">Pixabay</a>.';
  v.appendChild(photoSrc);

  const actions = el("div", { class: "sticky-actions" });
  const finish = el("button", {
    type: "button",
    class: "btn primary wide",
    disabled: missing.length > 0 || state.plate.length === 0 ? "true" : undefined,
  });
  finish.textContent = "Voir le résultat";
  finish.addEventListener("click", () => {
    if (missing.length || !state.plate.length) return;
    go("result");
  });
  actions.appendChild(finish);
  v.appendChild(actions);
  return v;
}

function viewWeigh() {
  const food = FOODS.find((f) => f.id === state.weighFoodId);
  const v = el("section", { class: "view weigh-view" });
  if (!food) {
    go("compose");
    return v;
  }

  const liveGrams = parseGrams(state.weighDraft);
  const imp = liveGrams > 0 ? impactFor(food, liveGrams) : null;

  v.appendChild(
    titleBlock(`Peser : ${food.name}`, food.tip + " · Données Agribalyse® ADEME."),
  );

  const panel = el("div", { class: "weigh-panel" });
  panel.innerHTML = `
    <div class="weigh-visual">
      <img class="weigh-photo" src="${foodImage(food)}" alt="" width="280" height="280" />
    </div>
    <div class="scale-bar" data-state="${usbScale.status}">
      <p id="scale-status" class="scale-status">${escapeHtml(usbScale.message)}</p>
      ${
        serialSupported()
          ? `<button type="button" class="btn ghost" id="btn-scale">${
              usbScale.status === "open" || usbScale.status === "connecting"
                ? "Déconnecter"
                : "Connecter la balance USB"
            }</button>`
          : ""
      }
    </div>
    <label class="field weigh-field">
      <span>Masse (grammes) — balance USB ou pavé</span>
      <input id="grams-input" type="number" inputmode="decimal" min="1" max="2000" step="1"
        placeholder="ex. 120" value="${escapeAttr(state.weighDraft)}" />
    </label>
    <div class="pad" aria-label="Pavé numérique">
      ${[1, 2, 3, 4, 5, 6, 7, 8, 9, "⌫", 0, "OK"]
        .map((k) => `<button type="button" class="pad-key" data-k="${k}">${k}</button>`)
        .join("")}
    </div>
    <p class="live-impact ${imp ? "" : "is-empty"}">
      ${imp ? liveImpactHtml(imp) : "Entrez le poids pour voir l’impact"}
    </p>
    <div class="weigh-links">
      <a class="btn ghost" href="${import.meta.env.BASE_URL}balance.html" target="_blank" rel="noopener">Aide lecture balance (caméra)</a>
    </div>
  `;

  const input = /** @type {HTMLInputElement} */ (panel.querySelector("#grams-input"));
  const liveEl = /** @type {HTMLElement} */ (panel.querySelector(".live-impact"));
  const refreshLive = () => {
    state.weighDraft = input.value;
    const g = parseGrams(state.weighDraft);
    const next = g > 0 ? impactFor(food, g) : null;
    liveEl.classList.toggle("is-empty", !next);
    liveEl.innerHTML = next ? liveImpactHtml(next) : "Entrez le poids pour voir l’impact";
  };
  input.addEventListener("input", refreshLive);

  const scaleBtn = panel.querySelector("#btn-scale");
  scaleBtn?.addEventListener("click", async () => {
    if (usbScale.status === "open" || usbScale.status === "connecting") {
      await usbScale.disconnect();
      return;
    }
    try {
      await usbScale.connect();
    } catch {
      /* message déjà affiché */
    }
  });

  panel.querySelectorAll("[data-k]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const k = btn.getAttribute("data-k");
      if (k === "⌫") {
        input.value = input.value.slice(0, -1);
      } else if (k === "OK") {
        state.weighDraft = input.value;
        confirmWeigh(food);
        return;
      } else {
        if (input.value.length >= 4) return;
        input.value += k;
      }
      refreshLive();
    });
  });

  const back = el("button", { type: "button", class: "btn ghost" });
  back.textContent = "Retour";
  back.addEventListener("click", () => go("compose"));

  const save = el("button", { type: "button", class: "btn primary" });
  save.textContent = "Ajouter à l’assiette";
  save.addEventListener("click", () => confirmWeigh(food));

  const row = el("div", { class: "btn-row" });
  row.append(back, save);

  v.append(panel, row);
  queueMicrotask(() => {
    const i = /** @type {HTMLInputElement|null} */ (document.getElementById("grams-input"));
    i?.focus();
  });
  return v;
}

/** @param {import('./foods.js').Food} food */
function confirmWeigh(food) {
  const grams = parseGrams(state.weighDraft);
  if (!(grams > 0)) return;
  state.plate = state.plate.filter((p) => p.foodId !== food.id);
  state.plate.push({ foodId: food.id, grams });
  state.skipped = state.skipped.filter((id) => id !== food.category);
  state.weighFoodId = null;
  state.weighDraft = "";
  go("compose");
}

function viewResult() {
  const totals = plateTotals();
  const target = lunchKcal(state.levelId);
  const level = currentLevel();
  if (!state.resultSaved) {
    state.lastResult = addScore({
      name: state.teamName,
      color: state.teamColor,
      mode: state.mode,
      items: plateRows().map((row) => {
        if (row.kind === "rien") {
          return {
            foodId: `rien:${row.category.id}`,
            foodName: `Rien — ${row.category.label}`,
            grams: 0,
            co2g: 0,
            kcal: 0,
          };
        }
        const imp = impactFor(row.food, row.item.grams);
        return {
          foodId: row.item.foodId,
          foodName: row.food.name,
          grams: row.item.grams,
          co2g: imp.co2g,
          kcal: imp.kcal,
        };
      }),
      totalCo2g: totals.co2g,
      totalKcal: totals.kcal,
      targetKcal: target,
      levelId: level.id,
    });
    state.resultSaved = true;
  }
  const saved = state.lastResult;
  if (!saved) {
    go("compose");
    return el("section");
  }

  const v = el("section", { class: "view result-view" });
  const gap = Math.abs(Math.round(totals.kcal) - target);
  const verdict =
    state.mode === "climat"
      ? totals.co2g < 400
        ? "Bravo : assiette légère pour la planète !"
        : totals.co2g < 900
          ? "Bien joué — on peut encore alléger le CO₂."
          : "Fort impact : essayez plus de légumes et de légumineuses."
      : gap <= 40
        ? `Juste ce qu’il faut. Écart de ${gap} kcal.`
        : totals.kcal < target
          ? `Un peu trop peu. Écart de ${gap} kcal : un écart plus petit serait meilleur.`
          : `Un peu trop. Écart de ${gap} kcal : un écart plus petit serait meilleur.`;

  const bar =
    state.mode === "energie"
      ? goalBarHtml(energyGoal(totals.kcal, target))
      : goalBarHtml(climateGoal(totals.co2g));

  v.innerHTML = `
    <p class="team-pill" style="--team:${state.teamColor}"><span></span>${escapeHtml(state.teamName)}</p>
    <h2>Résultat du repas</h2>
    <p class="verdict">${verdict}</p>
    ${
      state.mode === "energie"
        ? `<p class="challenge-note">${level.label}, ${level.age} ans : la cible du déjeuner est ${target} kcal. Ni trop, ni trop peu. Un plateau à 50 kcal de la cible vaut mieux qu’un plateau à 100 kcal, au-dessus ou en dessous.</p>`
        : `<p class="challenge-note">Défi planète : moins de CO₂, mieux c’est.</p>`
    }
    ${bar}
    <div class="result-metrics">
      ${
        state.mode === "climat"
          ? `<div class="metric">
        <span class="metric-label">CO₂</span>
        <strong class="metric-value">${fmtCo2(totals.co2g)}</strong>
        <span class="metric-hint">Agribalyse® ADEME</span>
      </div>`
          : `<div class="metric">
        <span class="metric-label">Calories</span>
        <strong class="metric-value">${Math.round(totals.kcal)} <small>kcal</small></strong>
        <span class="metric-hint">cible ${target} kcal</span>
      </div>
      <div class="metric">
        <span class="metric-label">Écart</span>
        <strong class="metric-value">${gap} <small>kcal</small></strong>
        <span class="metric-hint">plus petit, mieux c’est</span>
      </div>`
      }
      <div class="metric">
        <span class="metric-label">Score</span>
        <strong class="metric-value">${saved.score}</strong>
        <span class="metric-hint">${MODE_LABEL[state.mode]}</span>
      </div>
    </div>
  `;

  const detail = el("ul", { class: "plate-list" });
  for (const item of saved.items) {
    const food = FOODS.find((f) => f.id === item.foodId);
    const rien = item.foodId.startsWith("rien:");
    const li = el("li", { class: "plate-item" });
    li.innerHTML = `
      ${
        rien
          ? `<span class="food-thumb rien-thumb" aria-hidden="true">—</span>`
          : `<img class="food-thumb" src="${food ? foodImage(food) : ""}" alt="" width="48" height="48" />`
      }
      <div>
        <strong>${escapeHtml(item.foodName)}</strong>
        <span>${
          rien
            ? "Choix : rien"
            : portionLine(item.grams, { co2g: item.co2g, kcal: item.kcal })
        }</span>
      </div>
    `;
    detail.appendChild(li);
  }
  v.appendChild(detail);

  const row = el("div", { class: "btn-row wrap" });
  const board = el("button", { type: "button", class: "btn primary" });
  board.textContent = "Classement";
  board.addEventListener("click", () => go("board"));
  const again = el("button", { type: "button", class: "btn ghost" });
  again.textContent = "Nouvelle équipe";
  again.addEventListener("click", () => {
    state.teamName = "";
    state.plate = [];
    state.skipped = [];
    state.resultSaved = false;
    state.lastResult = null;
    go("setup");
  });
  const retry = el("button", { type: "button", class: "btn ghost" });
  retry.textContent = "Modifier l’assiette";
  retry.addEventListener("click", () => {
    state.resultSaved = false;
    state.lastResult = null;
    go("compose");
  });
  row.append(board, again, retry);
  v.appendChild(row);

  const src = el("p", { class: "source" });
  src.innerHTML =
    'Impacts climat : <a href="https://agribalyse.ademe.fr/app" target="_blank" rel="noopener">Agribalyse® ADEME</a>. Calories : valeurs type CIQUAL (indicatives).';
  v.appendChild(src);
  return v;
}

function viewBoard() {
  const v = el("section", { class: "view board-view" });
  v.appendChild(
    titleBlock(
      "Classement des équipes",
      "Toutes les équipes du stand — filtrez par défi si besoin.",
    ),
  );

  const tabs = el("div", { class: "chip-row" });
  /** @type {{ id: BoardFilter, label: string }[]} */
  const filters = [
    { id: "all", label: "Toutes" },
    { id: "climat", label: "Planète" },
    { id: "energie", label: "Énergie" },
  ];
  for (const filter of filters) {
    const b = el("button", {
      type: "button",
      class: `chip ${state.boardFilter === filter.id ? "is-on" : ""}`,
    });
    b.textContent = filter.label;
    b.addEventListener("click", () => {
      state.boardFilter = filter.id;
      render();
    });
    tabs.appendChild(b);
  }
  v.appendChild(tabs);

  const rows = rankingFor(state.boardFilter);
  if (!rows.length) {
    const empty = el("p", { class: "muted" });
    empty.textContent = "Aucun score pour l’instant. Lancez un défi !";
    v.appendChild(empty);
  } else {
    const list = el("ol", { class: "rank-list" });
    rows.forEach((row, i) => {
      const li = el("li", { class: "rank-item" });
      const rowTarget = row.targetKcal || lunchKcal(row.levelId || state.levelId);
      const bar =
        row.mode === "energie"
          ? goalBarHtml({ ...energyGoal(row.totalKcal, rowTarget), compact: true })
          : goalBarHtml({ ...climateGoal(row.totalCo2g), compact: true });
      li.innerHTML = `
        <span class="rank-n">${i + 1}</span>
        <span class="rank-dot" style="--team:${row.color}"></span>
        <div>
          <strong>${escapeHtml(row.name)}</strong>
          <span>${MODE_SHORT[row.mode] || row.mode}</span>
          ${bar}
        </div>
        <strong class="rank-score">${row.score}</strong>
      `;
      list.appendChild(li);
    });
    v.appendChild(list);
  }

  const row = el("div", { class: "btn-row" });
  const play = el("button", { type: "button", class: "btn primary" });
  play.textContent = "Nouveau défi";
  play.addEventListener("click", () => go("setup"));
  const clear = el("button", { type: "button", class: "btn ghost danger" });
  clear.textContent = "Effacer scores";
  clear.addEventListener("click", () => {
    if (confirm("Effacer tous les scores de cet appareil ?")) {
      clearScores();
      render();
    }
  });
  row.append(play, clear);
  v.appendChild(row);
  return v;
}

function viewNutri() {
  const v = el("section", { class: "view nutri-view" });
  v.appendChild(
    titleBlock(
      "Comprendre le Nutri-Score",
      "Repérer la lettre sur l’emballage et savoir ce qu’elle veut dire.",
    ),
  );

  const grades = el("div", { class: "ns-grades", role: "list" });
  for (const g of NUTRISCORE_GRADES) {
    const item = el("div", { class: "ns-grade", role: "listitem", style: `--ns:${g.color}` });
    item.innerHTML = `
      <span class="ns-letter">${g.letter}</span>
      <div>
        <strong>${g.meaning}</strong>
        <p>${g.kid}</p>
      </div>
    `;
    grades.appendChild(item);
  }
  v.appendChild(grades);

  const steps = el("ol", { class: "ns-steps" });
  for (const s of NUTRISCORE_STEPS) {
    const li = el("li");
    li.innerHTML = `<strong>${s.title}</strong><p>${s.body}</p>`;
    steps.appendChild(li);
  }
  v.appendChild(steps);

  const yuka = el("aside", { class: "yuka-card" });
  yuka.innerHTML = `
    <h3>Atelier Yuka</h3>
    <p>Avec un adulte, scannez 2 produits du même rayon. Comparez le Nutri-Score et discutez : sucre, sel, fibres…</p>
    <a class="btn ghost" href="https://yuka.io/" target="_blank" rel="noopener">Site Yuka</a>
  `;
  v.appendChild(yuka);

  // Mini quiz
  const quizWrap = el("section", { class: "quiz" });
  quizWrap.appendChild(el("h3", {}, "Mini-quiz"));
  if (state.quizIndex >= NUTRISCORE_QUIZ.length) {
    quizWrap.innerHTML += `<p class="verdict">Score : ${state.quizScore} / ${NUTRISCORE_QUIZ.length}. Bravo les détectives Nutri-Score !</p>`;
    const reset = el("button", { type: "button", class: "btn ghost" });
    reset.textContent = "Rejouer le quiz";
    reset.addEventListener("click", () => {
      state.quizIndex = 0;
      state.quizScore = 0;
      render();
    });
    quizWrap.appendChild(reset);
  } else {
    const q = NUTRISCORE_QUIZ[state.quizIndex];
    const qEl = el("p", { class: "quiz-q" });
    qEl.textContent = q.q;
    quizWrap.appendChild(qEl);
    const choices = el("div", { class: "quiz-choices" });
    q.choices.forEach((c, i) => {
      const b = el("button", { type: "button", class: "btn ghost wide" });
      b.textContent = c;
      b.addEventListener("click", () => {
        if (i === q.answer) state.quizScore += 1;
        alert(q.explain);
        state.quizIndex += 1;
        render();
      });
      choices.appendChild(b);
    });
    quizWrap.appendChild(choices);
  }
  v.appendChild(quizWrap);

  const note = el("p", { class: "source" });
  note.textContent =
    "Le Nutri-Score évalue la nutrition, Agribalyse le climat : deux infos complémentaires pour bien choisir.";
  v.appendChild(note);
  return v;
}

function meterBar(totals) {
  const target = lunchKcal(state.levelId);
  const wrap = el("div", { class: "meters" });
  wrap.innerHTML =
    state.mode === "energie"
      ? goalBarHtml(energyGoal(totals.kcal, target))
      : goalBarHtml(climateGoal(totals.co2g));
  return wrap;
}

function currentLevel() {
  return levelById(state.levelId);
}

function challengeNote() {
  const level = currentLevel();
  const target = lunchKcal(level.id);
  if (state.mode === "energie") {
    return `${level.label}, ${level.age} ans : le déjeuner vise ${target} kcal. Ni trop, ni trop peu. L’écart à la cible compte, pas seulement d’être au-dessus ou en dessous.`;
  }
  return "Défi planète : on regarde le CO₂. Moins, c’est mieux.";
}

/**
 * @param {number} grams
 * @param {{ co2g: number, kcal: number }} imp
 */
function portionLine(grams, imp) {
  if (state.mode === "energie") return `${grams} g · ${Math.round(imp.kcal)} kcal`;
  return `${grams} g · ${fmtCo2(imp.co2g)}`;
}

/** @param {{ co2g: number, kcal: number }} imp */
function liveImpactHtml(imp) {
  if (state.mode === "energie") return `<strong>${Math.round(imp.kcal)} kcal</strong>`;
  return `<strong>${fmtCo2(imp.co2g)}</strong>`;
}

/** @param {number} kcal @param {number} target */
function energyGoal(kcal, target) {
  const rounded = Math.round(kcal);
  const gap = Math.abs(rounded - target);
  const scale = Math.max(target * 1.5, rounded, 1);
  return {
    kind: "kcal",
    label: "Calories",
    valueText: `${rounded} kcal`,
    fill: Math.min(100, (rounded / scale) * 100),
    mark: (target / scale) * 100,
    caption: `Cible ${target} kcal · écart ${gap} kcal`,
  };
}

/** @param {number} co2g */
function climateGoal(co2g) {
  const scale = 4000;
  return {
    kind: "co2",
    label: "CO₂",
    valueText: fmtCo2(co2g),
    fill: Math.min(100, (co2g / scale) * 100),
    mark: null,
    caption: "Plus la barre est courte, mieux c’est.",
  };
}

/**
 * @param {{ kind: string, label: string, valueText: string, fill: number, mark: number|null, caption: string, compact?: boolean }} goal
 */
function goalBarHtml(goal) {
  const mark =
    goal.mark == null
      ? ""
      : `<b class="goal-mark" style="left:${goal.mark.toFixed(1)}%" title="Cible"></b>`;
  return `
    <div class="goal-bar ${goal.compact ? "is-compact" : ""} ${goal.kind === "kcal" ? "is-kcal" : "is-co2"}">
      <div class="goal-top"><span>${escapeHtml(goal.label)}</span><strong>${escapeHtml(goal.valueText)}</strong></div>
      <div class="goal-track" aria-hidden="true">
        <i style="width:${goal.fill.toFixed(1)}%"></i>
        ${mark}
      </div>
      <p class="goal-caption">${escapeHtml(goal.caption)}</p>
    </div>
  `;
}

/** @param {string} categoryId */
function categoryChosen(categoryId) {
  if (state.skipped.includes(categoryId)) return true;
  return state.plate.some((p) => FOODS.find((f) => f.id === p.foodId)?.category === categoryId);
}

function plateRows() {
  /** @type {({ kind: 'rien', category: (typeof CATEGORIES)[number] } | { kind: 'food', item: { foodId: string, grams: number }, food: (typeof FOODS)[number] })[]} */
  const rows = [];
  for (const category of CATEGORIES) {
    if (state.skipped.includes(category.id)) {
      rows.push({ kind: "rien", category });
      continue;
    }
    for (const item of state.plate) {
      const food = FOODS.find((f) => f.id === item.foodId);
      if (food?.category === category.id) rows.push({ kind: "food", item, food });
    }
  }
  return rows;
}

function plateTotals() {
  let co2g = 0;
  let kcal = 0;
  for (const item of state.plate) {
    const food = FOODS.find((f) => f.id === item.foodId);
    if (!food) continue;
    const imp = impactFor(food, item.grams);
    co2g += imp.co2g;
    kcal += imp.kcal;
  }
  return { co2g, kcal };
}

/** @param {Screen} screen */
function go(screen) {
  state.screen = screen;
  if (screen === "board") state.boardFilter = "all";
  const hash =
    screen === "nutri" ? "nutri" : screen === "board" ? "board" : screen === "home" ? "home" : "";
  if (hash) location.hash = hash;
  else if (location.hash) history.replaceState(null, "", location.pathname);
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function titleBlock(title, sub) {
  const d = el("div", { class: "title-block" });
  d.innerHTML = `<h2>${title}</h2><p class="muted">${sub}</p>`;
  return d;
}

/** @param {number} co2g */
function fmtCo2(co2g) {
  if (co2g < 1000) return `${Math.round(co2g)} g CO₂e`;
  return `${(co2g / 1000).toFixed(2)} kg CO₂e`;
}

/** @param {import('./usbScale.js').ScaleEvent} evt */
function applyScaleToWeighUi(evt) {
  if (state.screen !== "weigh") return;
  const statusEl = document.getElementById("scale-status");
  const bar = statusEl?.closest(".scale-bar");
  const btn = /** @type {HTMLButtonElement|null} */ (document.getElementById("btn-scale"));
  if (statusEl) statusEl.textContent = evt.message;
  if (bar) bar.setAttribute("data-state", evt.status);
  if (btn) {
    const open = evt.status === "open" || evt.status === "connecting";
    btn.textContent = open ? "Déconnecter" : "Connecter la balance USB";
    btn.disabled = evt.status === "connecting";
  }
  if (evt.status !== "open" || evt.grams == null) return;
  const input = /** @type {HTMLInputElement|null} */ (document.getElementById("grams-input"));
  if (!input) return;
  const g = Math.round(evt.grams);
  if (g < 1 || g > 2000) return;
  if (input.value === String(g)) return;
  input.value = String(g);
  input.dispatchEvent(new Event("input"));
}

function parseGrams(raw) {
  const n = Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(2000, Math.round(n));
}

/**
 * @param {string} tag
 * @param {Record<string, string>} [attrs]
 * @param {string} [text]
 */
function el(tag, attrs = {}, text) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== undefined) node.setAttribute(k, v);
  }
  if (text !== undefined) node.textContent = text;
  return node;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(s) {
  return escapeHtml(s).replaceAll("'", "&#39;");
}
