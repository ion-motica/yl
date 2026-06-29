(function (global) {
  "use strict";

  const MASTER_KEY = "asnwProfileOn";

  /** Valori implicite când profilul ASNW master este activ (reset la bifare master). */
  const ASNW_PRESET = {
    handOverButtons: true,
    simulateTap: true,
    tapRippleOnQuestion: true,
    hideDivLabels: true,
    emptyArenaIllustration: true,
    simplifiedQuizTitle: true,
    hideLevelInfo: true,
    hideProgressVisual: true,
    hideHintMessage: true,
    emptySuccessionList: true,
    liftCloneStatic: true,
    starsProgress: true,
    liftNoRiseTeleport: true,
    liftFixedQuestionBar: true,
  };

  /**
   * implemented: true  → efect activ + bife vizibile (canonical + duplicat ASNW)
   * implemented: false → ascuns din CP până la pasul de implementare
   */
  const FLAG_DEFS = [
    {
      key: "handOverButtons",
      storageKey: "asnwHandOverButtons",
      label: "manuta peste butoane",
      cssClass: null,
      implemented: true,
    },
    {
      key: "simulateTap",
      storageKey: "asnwSimulateTap",
      label: "simuleaza tap pe buton",
      cssClass: null,
      implemented: true,
    },
    {
      key: "tapRippleOnQuestion",
      storageKey: "asnwTapRippleOnQuestion",
      label: "Cerculete si peste un buton si peste semnul ?",
      cssClass: null,
      implemented: true,
    },
    {
      key: "hideDivLabels",
      storageKey: "asnwHideDivLabels",
      label: "Titluri div-uri — ascunse",
      cssClass: "asnw-hide-div-labels",
      implemented: true,
    },
    {
      key: "emptyArenaIllustration",
      storageKey: "asnwEmptyArenaIllustration",
      label: "Ilustrare din arena — gol",
      cssClass: "asnw-empty-arena-illustration",
      implemented: true,
    },
    {
      key: "simplifiedQuizTitle",
      storageKey: "asnwSimplifiedQuizTitle",
      label: "Titlu quiz — simplificat (Adunari)",
      cssClass: null,
      implemented: true,
    },
    {
      key: "hideLevelInfo",
      storageKey: "asnwHideLevelInfo",
      label: "Nume nivel — ascuns",
      cssClass: "asnw-hide-level-info",
      implemented: true,
    },
    {
      key: "hideProgressVisual",
      storageKey: "asnwHideProgressVisual",
      label: "Progres pătrățele v/r — ascuns",
      cssClass: "asnw-hide-progress-visual",
      implemented: true,
    },
    {
      key: "hideHintMessage",
      storageKey: "asnwHideHintMessage",
      label: "Mesaj hint — ascuns",
      cssClass: "asnw-hide-hint-message",
      implemented: true,
    },
    {
      key: "emptySuccessionList",
      storageKey: "asnwEmptySuccessionList",
      label: "Listă operații — fără conținut",
      cssClass: "asnw-empty-succession-list",
      implemented: true,
    },
    {
      key: "liftCloneStatic",
      storageKey: "asnwLiftCloneStatic",
      label: "Lift clonă static — ecran duplicat",
      cssClass: null,
      implemented: false,
    },
    {
      key: "starsProgress",
      storageKey: "asnwStarsProgress",
      label: "Stelute 3× + sub-goal",
      cssClass: null,
      implemented: true,
    },
    {
      key: "liftNoRiseTeleport",
      storageKey: "asnwLiftNoRiseTeleport",
      label: "Lift — fără urcare, teleport sus",
      cssClass: null,
      implemented: true,
    },
    {
      key: "liftFixedQuestionBar",
      storageKey: "asnwLiftFixedQuestionBar",
      label: "Tip lift = Intrebare fixa si lift bara",
      cssClass: null,
      implemented: true,
    },
  ];

  const Config = global.LayoutConfig;

  /** @type {Map<string, Set<{ input: HTMLInputElement, role: 'canonical'|'asnwDuplicate' }>>} */
  const uiBindings = new Map();

  /** @type {{ gameEl?: HTMLElement, onChange?: () => void } | null} */
  let panelOpts = null;

  function defForKey(key) {
    return FLAG_DEFS.find((f) => f.key === key);
  }

  function implementedDefs() {
    return FLAG_DEFS.filter((f) => f.implemented === true);
  }

  function readStoredFlag(key) {
    const def = defForKey(key);
    if (!def) return false;
    const presetVal = ASNW_PRESET[key] === true;
    return Config?.get(def.storageKey, presetVal) === true;
  }

  function writeStoredFlag(key, value) {
    const def = defForKey(key);
    if (!def || !Config) return;
    Config.set(def.storageKey, value === true);
  }

  function isMasterOn() {
    return Config?.get(MASTER_KEY, true) !== false;
  }

  /** Master ON → reset preset în storage. Master OFF → doar master key. */
  function setMasterOn(on) {
    Config?.set(MASTER_KEY, on === true);
    if (on === true) {
      for (const [key, val] of Object.entries(ASNW_PRESET)) {
        writeStoredFlag(key, val);
      }
    }
  }

  /**
   * stored = valoare în LayoutConfig
   * effective = master ON && stored (ce se aplică pe arena)
   */
  function getConfig() {
    const masterOn = isMasterOn();
    const stored = {};
    const effective = {};
    for (const def of FLAG_DEFS) {
      const val = readStoredFlag(def.key);
      stored[def.key] = val;
      effective[def.key] = masterOn && val;
    }
    return { masterOn, stored, effective, flags: effective };
  }

  function isEffective(key) {
    return getConfig().effective[key] === true;
  }

  const SIMPLIFIED_TITLES = {
    "addition-table-range": "Adunari",
  };

  function getSimplifiedQuizTitle(quizId) {
    return SIMPLIFIED_TITLES[quizId] ?? null;
  }

  /** Titlu afișat pe arena: simplificat dacă flag ASNW activ, altfel titlul complet. */
  function resolveQuizTitle(quizId, fullTitle) {
    if (isEffective("simplifiedQuizTitle")) {
      const simple = getSimplifiedQuizTitle(quizId);
      if (simple) return simple;
    }
    return fullTitle;
  }

  function applyDomClasses(gameEl) {
    const el = gameEl ?? panelOpts?.gameEl;
    if (!el) return;
    const { effective } = getConfig();
    for (const def of FLAG_DEFS) {
      if (!def.cssClass) continue;
      el.classList.toggle(def.cssClass, effective[def.key] === true);
    }
  }

  function notifyChange() {
    applyDomClasses();
    panelOpts?.onChange?.();
  }

  function bindFlagInput(key, input, role) {
    if (!uiBindings.has(key)) uiBindings.set(key, new Set());
    uiBindings.get(key).add({ input, role });
  }

  /** Sincronizează toate bifele (canonical + duplicat ASNW) cu starea curentă. */
  function syncAllUi() {
    const { masterOn, stored } = getConfig();
    for (const def of implementedDefs()) {
      const bindings = uiBindings.get(def.key);
      if (!bindings) continue;
      const checked = masterOn && stored[def.key];
      for (const { input } of bindings) {
        input.checked = checked;
        input.disabled = !masterOn;
      }
    }
  }

  function setFlagFromUi(key, checked) {
    writeStoredFlag(key, checked);
    syncAllUi();
    notifyChange();
  }

  function createFlagRow(def, role) {
    const row = document.createElement("label");
    row.className =
      role === "asnwDuplicate"
        ? "control-panel-lift-row control-panel-asnw-flag"
        : "control-panel-lift-row control-panel-asnw-canonical";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.dataset.asnwKey = def.key;
    input.dataset.asnwRole = role;
    input.addEventListener("change", () => {
      setFlagFromUi(def.key, input.checked);
    });
    const span = document.createElement("span");
    span.textContent =
      role === "asnwDuplicate" ? `${def.label} (duplicat ASNW)` : def.label;
    row.append(input, span);
    bindFlagInput(def.key, input, role);
    return { row, input };
  }

  /**
   * Bifă canonicală în CP (în afara blocului ASNW) — duplicată sub master.
   * @param {HTMLElement} mount
   * @param {string} key
   */
  function appendCanonicalFlagRow(mount, key) {
    const def = defForKey(key);
    if (!def?.implemented) return null;
    const { row } = createFlagRow(def, "canonical");
    mount.appendChild(row);
    syncAllUi();
    return row;
  }

  /**
   * Panou ASNW: master + duplicate sub-bife (doar opțiuni implementate).
   * @param {HTMLElement} mount
   * @param {{ gameEl: HTMLElement, onChange?: () => void }} opts
   */
  function buildAsnwSection(mount, opts) {
    panelOpts = opts ?? null;
    uiBindings.clear();

    const masterRow = document.createElement("label");
    masterRow.className = "control-panel-lift-row control-panel-asnw-master";
    const masterInput = document.createElement("input");
    masterInput.type = "checkbox";
    masterInput.checked = isMasterOn();
    const masterSpan = document.createElement("span");
    masterSpan.textContent = "Profil ASNW — arena simplă pt new user";
    masterRow.append(masterInput, masterSpan);

    const subWrap = document.createElement("div");
    subWrap.className = "control-panel-asnw-flags";

    for (const def of implementedDefs()) {
      const { row } = createFlagRow(def, "asnwDuplicate");
      subWrap.appendChild(row);
    }

    masterInput.addEventListener("change", () => {
      setMasterOn(masterInput.checked);
      syncAllUi();
      notifyChange();
    });

    mount.appendChild(masterRow);
    mount.appendChild(subWrap);

    syncAllUi();
    notifyChange();
  }

  global.AsnwProfile = {
    MASTER_KEY,
    ASNW_PRESET,
    FLAG_DEFS,
    isMasterOn,
    setMasterOn,
    getConfig,
    isEffective,
    readStoredFlag,
    writeStoredFlag,
    getSimplifiedQuizTitle,
    resolveQuizTitle,
    applyDomClasses,
    buildAsnwSection,
    appendCanonicalFlagRow,
    syncAllUi,
  };
})(window);
