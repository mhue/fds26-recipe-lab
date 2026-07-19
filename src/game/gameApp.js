import {
  CATEGORIES,
  FOODS,
  KCAL_TARGET,
  foodsForLevel,
  impactFor,
} from "./foods.js";
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

/** @typedef {'home'|'setup'|'compose'|'weigh'|'result'|'board'|'nutri'} Screen */
/** @typedef {'cp'|'ce'|'cm'} Level */
/** @typedef {'climat'|'energie'} Mode */

const app = document.getElementById("app");

/** @type {{
 *   screen: Screen,
 *   level: Level,
 *   mode: Mode,
 *   teamName: string,
 *   teamColor: string,
 *   plate: { foodId: string, grams: number }[],
 *   weighFoodId: string|null,
 *   weighDraft: string,
 *   quizIndex: number,
 *   quizScore: number,
 *   lastResult: import('./teams.js').TeamScore|null,
 *   resultSaved: boolean,
 * }} */
const state = {
  screen: "home",
  level: "ce",
  mode: "climat",
  teamName: "",
  teamColor: TEAM_COLORS[0].hex,
  plate: [],
  weighFoodId: null,
  weighDraft: "",
  quizIndex: 0,
  quizScore: 0,
  lastResult: null,
  resultSaved: false,
};

const LEVEL_LABEL = { cp: "CP / CE1", ce: "CE2 / CM1", cm: "CM2" };
const MODE_LABEL = {
  climat: "Défi planète (moins de CO₂)",
  energie: "Défi énergie (calories)",
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
  if (hash === "board") state.screen = "board";
  render();
  window.addEventListener("hashchange", () => {
    const h = location.hash.replace("#", "");
    if (h === "nutri") state.screen = "nutri";
    else if (h === "board") state.screen = "board";
    else if (h === "" || h === "home") state.screen = "home";
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
    navBtn("Défi", () => go(state.teamName ? "compose" : "setup")),
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
  const v = el("section", { class: "view home-view" });
  v.innerHTML = `
    <div class="hero-plane" aria-hidden="true"></div>
    <div class="hero-copy">
      <p class="eyebrow">Fête de la science</p>
      <h1 class="hero-title">Assiette Lab</h1>
      <p class="hero-lead">Composez un repas de midi, pesez les aliments, découvrez le CO₂ et les calories — en équipe.</p>
      <div class="hero-actions">
        <button type="button" class="btn primary" data-act="start">Lancer le défi</button>
        <button type="button" class="btn ghost" data-act="nutri">Atelier Nutri-Score</button>
      </div>
    </div>
    <ul class="home-cards">
      <li><strong>Pesée</strong><span>Balance + saisie des grammes</span></li>
      <li><strong>Agribalyse</strong><span>Données CO₂ ADEME</span></li>
      <li><strong>Équipes</strong><span>Classement en direct</span></li>
    </ul>
  `;
  v.querySelector("[data-act=start]")?.addEventListener("click", () => go("setup"));
  v.querySelector("[data-act=nutri]")?.addEventListener("click", () => go("nutri"));
  return v;
}

function viewSetup() {
  const v = el("section", { class: "view setup-view" });
  v.appendChild(titleBlock("Préparer l’équipe", "Choisissez le niveau, le défi, puis un nom d’équipe."));

  const form = el("form", { class: "setup-form" });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = /** @type {HTMLInputElement} */ (form.querySelector("#team-name")).value.trim();
    if (!name) return;
    state.teamName = name.slice(0, 24);
    state.plate = [];
    go("compose");
  });

  form.innerHTML = `
    <fieldset>
      <legend>Niveau</legend>
      <div class="chip-row" role="radiogroup" aria-label="Niveau">
        ${levelChip("cp", LEVEL_LABEL.cp)}
        ${levelChip("ce", LEVEL_LABEL.ce)}
        ${levelChip("cm", LEVEL_LABEL.cm)}
      </div>
    </fieldset>
    <fieldset>
      <legend>Type de défi</legend>
      <div class="chip-row" role="radiogroup" aria-label="Défi">
        ${modeChip("climat", "Planète · moins de CO₂")}
        ${modeChip("energie", "Énergie · viser les calories")}
      </div>
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
      state.level = /** @type {Level} */ (btn.getAttribute("data-level"));
      go("setup");
    });
  });
  form.querySelectorAll("[data-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.mode = /** @type {Mode} */ (btn.getAttribute("data-mode"));
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

function levelChip(id, label) {
  return `<button type="button" class="chip ${state.level === id ? "is-on" : ""}" data-level="${id}">${label}</button>`;
}
function modeChip(id, label) {
  return `<button type="button" class="chip ${state.mode === id ? "is-on" : ""}" data-mode="${id}">${label}</button>`;
}

function viewCompose() {
  const foods = foodsForLevel(state.level);
  const totals = plateTotals();
  const v = el("section", { class: "view compose-view" });

  const head = el("div", { class: "compose-head" });
  head.innerHTML = `
    <div>
      <p class="team-pill" style="--team:${state.teamColor}"><span></span>${escapeHtml(state.teamName)}</p>
      <h2>Composez le repas</h2>
      <p class="muted">${MODE_LABEL[state.mode]} · ${LEVEL_LABEL[state.level]}</p>
    </div>
  `;
  v.appendChild(head);
  v.appendChild(meterBar(totals));

  const needed = CATEGORIES.filter((c) => c.need);
  const missing = needed.filter(
    (c) => !state.plate.some((p) => FOODS.find((f) => f.id === p.foodId)?.category === c.id),
  );

  const checklist = el("p", { class: "checklist" });
  checklist.textContent =
    missing.length === 0
      ? "Assiette complète : féculent + protéine + légume + fruit."
      : `Encore besoin : ${missing.map((m) => m.label.toLowerCase()).join(", ")}.`;
  v.appendChild(checklist);

  if (state.plate.length) {
    const plate = el("ul", { class: "plate-list" });
    for (const item of state.plate) {
      const food = FOODS.find((f) => f.id === item.foodId);
      if (!food) continue;
      const imp = impactFor(food, item.grams);
      const li = el("li", { class: "plate-item" });
      li.innerHTML = `
        <span class="food-dot" style="--h:${food.hue}"></span>
        <div>
          <strong>${escapeHtml(food.name)}</strong>
          <span>${item.grams} g · ${fmtCo2(imp.co2g)} · ${Math.round(imp.kcal)} kcal</span>
        </div>
      `;
      const rm = el("button", { type: "button", class: "icon-btn", "aria-label": "Retirer" });
      rm.textContent = "×";
      rm.addEventListener("click", () => {
        state.plate = state.plate.filter((p) => p.foodId !== item.foodId);
        render();
      });
      li.appendChild(rm);
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
      });
      btn.innerHTML = `
        <span class="food-swatch" aria-hidden="true"></span>
        <span class="food-name">${escapeHtml(food.name)}</span>
        <span class="food-meta">${state.level === "cp" ? co2Clouds(food.co2PerKg) : `${food.co2PerKg.toFixed(1)} kg CO₂/kg`}</span>
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
    block.appendChild(grid);
    v.appendChild(block);
  }

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
    <div class="weigh-visual" style="--h:${food.hue}">
      <span class="weigh-blob" aria-hidden="true"></span>
      <p class="weigh-food">${escapeHtml(food.name)}</p>
    </div>
    <label class="field weigh-field">
      <span>Masse lue sur la balance (grammes)</span>
      <input id="grams-input" type="number" inputmode="decimal" min="1" max="2000" step="1"
        placeholder="ex. 120" value="${escapeAttr(state.weighDraft)}" />
    </label>
    <div class="pad" aria-label="Pavé numérique">
      ${[1, 2, 3, 4, 5, 6, 7, 8, 9, "⌫", 0, "OK"]
        .map((k) => `<button type="button" class="pad-key" data-k="${k}">${k}</button>`)
        .join("")}
    </div>
    <p class="live-impact ${imp ? "" : "is-empty"}">
      ${
        imp
          ? `<strong>${fmtCo2(imp.co2g)}</strong> de CO₂ · <strong>${Math.round(imp.kcal)} kcal</strong>`
          : "Entrez le poids pour voir l’impact"
      }
    </p>
    <div class="weigh-links">
      <a class="btn ghost" href="/balance.html" target="_blank" rel="noopener">Aide lecture balance (caméra)</a>
    </div>
  `;

  const input = /** @type {HTMLInputElement} */ (panel.querySelector("#grams-input"));
  const liveEl = /** @type {HTMLElement} */ (panel.querySelector(".live-impact"));
  const refreshLive = () => {
    state.weighDraft = input.value;
    const g = parseGrams(state.weighDraft);
    const next = g > 0 ? impactFor(food, g) : null;
    liveEl.classList.toggle("is-empty", !next);
    liveEl.innerHTML = next
      ? `<strong>${fmtCo2(next.co2g)}</strong> de CO₂ · <strong>${Math.round(next.kcal)} kcal</strong>`
      : "Entrez le poids pour voir l’impact";
  };
  input.addEventListener("input", refreshLive);

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
  state.weighFoodId = null;
  state.weighDraft = "";
  go("compose");
}

function viewResult() {
  const totals = plateTotals();
  const target = KCAL_TARGET[state.level];
  if (!state.resultSaved) {
    state.lastResult = addScore({
      name: state.teamName,
      color: state.teamColor,
      level: state.level,
      mode: state.mode,
      items: state.plate.map((p) => {
        const food = FOODS.find((f) => f.id === p.foodId);
        const imp = food ? impactFor(food, p.grams) : { co2g: 0, kcal: 0 };
        return {
          foodId: p.foodId,
          foodName: food?.name || p.foodId,
          grams: p.grams,
          co2g: imp.co2g,
          kcal: imp.kcal,
        };
      }),
      totalCo2g: totals.co2g,
      totalKcal: totals.kcal,
      targetKcal: target,
    });
    state.resultSaved = true;
  }
  const saved = state.lastResult;
  if (!saved) {
    go("compose");
    return el("section");
  }

  const v = el("section", { class: "view result-view" });
  const verdict =
    state.mode === "climat"
      ? totals.co2g < 400
        ? "Bravo : assiette légère pour la planète !"
        : totals.co2g < 900
          ? "Bien joué — on peut encore alléger le CO₂."
          : "Fort impact : essayez plus de légumes et de légumineuses."
      : Math.abs(totals.kcal - target) < 80
        ? "Pile dans la cible calories !"
        : totals.kcal < target
          ? "Un peu juste en énergie — ajoutez un féculent ?"
          : "Un peu au-dessus — réduisez une portion.";

  v.innerHTML = `
    <p class="team-pill" style="--team:${state.teamColor}"><span></span>${escapeHtml(state.teamName)}</p>
    <h2>Résultat du repas</h2>
    <p class="verdict">${verdict}</p>
    <div class="result-metrics">
      <div class="metric">
        <span class="metric-label">CO₂</span>
        <strong class="metric-value">${fmtCo2(totals.co2g)}</strong>
        <span class="metric-hint">Agribalyse® ADEME</span>
      </div>
      <div class="metric">
        <span class="metric-label">Calories</span>
        <strong class="metric-value">${Math.round(totals.kcal)} <small>kcal</small></strong>
        <span class="metric-hint">cible ${target} kcal</span>
      </div>
      <div class="metric">
        <span class="metric-label">Score</span>
        <strong class="metric-value">${saved.score}</strong>
        <span class="metric-hint">${MODE_LABEL[state.mode]}</span>
      </div>
    </div>
  `;

  const detail = el("ul", { class: "plate-list" });
  for (const item of saved.items) {
    const li = el("li", { class: "plate-item" });
    li.innerHTML = `
      <span class="food-dot" style="--h:${FOODS.find((f) => f.id === item.foodId)?.hue || "#888"}"></span>
      <div>
        <strong>${escapeHtml(item.foodName)}</strong>
        <span>${item.grams} g · ${fmtCo2(item.co2g)} · ${Math.round(item.kcal)} kcal</span>
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
  v.appendChild(titleBlock("Classement des équipes", "Défi entre petites équipes — scores enregistrés sur cet appareil."));

  const tabs = el("div", { class: "chip-row" });
  for (const mode of /** @type {Mode[]} */ (["climat", "energie"])) {
    const b = el("button", {
      type: "button",
      class: `chip ${state.mode === mode ? "is-on" : ""}`,
    });
    b.textContent = mode === "climat" ? "Planète" : "Énergie";
    b.addEventListener("click", () => {
      state.mode = mode;
      render();
    });
    tabs.appendChild(b);
  }
  v.appendChild(tabs);

  const rows = rankingFor(state.mode);
  if (!rows.length) {
    const empty = el("p", { class: "muted" });
    empty.textContent = "Aucun score pour l’instant. Lancez un défi !";
    v.appendChild(empty);
  } else {
    const list = el("ol", { class: "rank-list" });
    rows.slice(0, 15).forEach((row, i) => {
      const li = el("li", { class: "rank-item" });
      li.innerHTML = `
        <span class="rank-n">${i + 1}</span>
        <span class="rank-dot" style="--team:${row.color}"></span>
        <div>
          <strong>${escapeHtml(row.name)}</strong>
          <span>${LEVEL_LABEL[row.level]} · ${fmtCo2(row.totalCo2g)} · ${Math.round(row.totalKcal)} kcal</span>
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
  const target = KCAL_TARGET[state.level];
  const co2Max = 1500;
  const co2Pct = Math.min(100, (totals.co2g / co2Max) * 100);
  const kcalPct = Math.min(100, (totals.kcal / (target * 1.4)) * 100);
  const bar = el("div", { class: "meters" });
  bar.innerHTML = `
    <div class="meter">
      <div class="meter-top"><span>CO₂</span><strong>${fmtCo2(totals.co2g)}</strong></div>
      <div class="meter-track"><i style="width:${co2Pct}%"></i></div>
    </div>
    <div class="meter">
      <div class="meter-top"><span>Calories</span><strong>${Math.round(totals.kcal)} / ${target}</strong></div>
      <div class="meter-track kcal"><i style="width:${kcalPct}%"></i></div>
    </div>
  `;
  return bar;
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

/** @param {number} co2PerKg */
function co2Clouds(co2PerKg) {
  if (co2PerKg < 1.2) return "peu de nuages";
  if (co2PerKg < 5) return "quelques nuages";
  return "beaucoup de nuages";
}

/** @param {number} co2g */
function fmtCo2(co2g) {
  if (co2g < 1000) return `${Math.round(co2g)} g CO₂e`;
  return `${(co2g / 1000).toFixed(2)} kg CO₂e`;
}

/** @param {string} raw */
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
