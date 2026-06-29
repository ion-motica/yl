(function (global) {
  "use strict";

  const STORAGE_KEY = "liftTypeId";
  const DEFAULT_LIFT_TYPE = "question-in-lift";

  /** id tip lift -> mod de prezentare folosit de layout/motor. */
  const TYPE_TO_MODE = {
    "question-in-lift": "content",
    "fixed-question-bar": "bar",
    "fixed-question-ball": "ball",
  };

  const Config = global.LayoutConfig;

  /** Opțiuni exclusive; doar `implemented: true` schimbă comportamentul (deocamdată doar #1). */
  const LIFT_TYPES = [
    {
      id: "question-in-lift",
      label: "Intrebarea in lift (variant din momentul acesta)",
      implemented: true,
    },
    {
      id: "fixed-question-bar",
      label: "Intrebare fixa si lift bara",
      implemented: true,
    },
    {
      id: "fixed-question-ball",
      label: "Intrebare fixa si lift mingie",
      implemented: true,
    },
  ];

  function defForId(id) {
    return LIFT_TYPES.find((t) => t.id === id);
  }

  function getStoredLiftTypeId() {
    const stored = Config?.get(STORAGE_KEY, null);
    if (typeof stored === "string" && defForId(stored)) return stored;
    return DEFAULT_LIFT_TYPE;
  }

  function setStoredLiftTypeId(id) {
    const def = defForId(id);
    if (!def || !Config) return;
    Config.set(STORAGE_KEY, id);
  }

  /** Tip efectiv pe arena — fallback la default dacă opțiunea nu e implementată încă. */
  function getEffectiveLiftTypeId() {
    if (global.AsnwProfile?.isEffective?.("liftFixedQuestionBar")) {
      return "fixed-question-bar";
    }
    const stored = getStoredLiftTypeId();
    const def = defForId(stored);
    if (def?.implemented) return stored;
    return DEFAULT_LIFT_TYPE;
  }

  function isImplemented(id) {
    return defForId(id)?.implemented === true;
  }

  /** Modul efectiv de prezentare: content | bar | ball. */
  function getEffectiveLiftMode() {
    return TYPE_TO_MODE[getEffectiveLiftTypeId()] ?? "content";
  }

  /**
   * @param {HTMLElement} mount
   * @param {{ onChange?: (liftTypeId: string) => void }} opts
   */
  function appendLiftTypeControl(mount, opts) {
    if (!mount) return null;

    const wrap = document.createElement("div");
    wrap.className = "control-panel-lift-type";

    const list = document.createElement("fieldset");
    list.className = "control-panel-lift-type-options";
    list.setAttribute("role", "radiogroup");
    list.setAttribute("aria-label", "Tip lift");

    const storedId = getStoredLiftTypeId();
    /** @type {HTMLInputElement[]} */
    const inputs = [];

    for (const def of LIFT_TYPES) {
      const row = document.createElement("label");
      row.className = "control-panel-lift-type-option";
      if (!def.implemented) row.classList.add("is-pending");

      const input = document.createElement("input");
      input.type = "radio";
      input.name = "lift-type";
      input.value = def.id;
      input.checked = storedId === def.id;
      input.disabled = !def.implemented;
      input.addEventListener("change", () => {
        if (!input.checked || !def.implemented) return;
        setStoredLiftTypeId(def.id);
        opts?.onChange?.(def.id);
      });

      const span = document.createElement("span");
      span.textContent = def.label;

      row.append(input, span);
      list.appendChild(row);
      inputs.push(input);
    }

    wrap.appendChild(list);
    mount.appendChild(wrap);

    return {
      syncUi() {
        const current = getStoredLiftTypeId();
        inputs.forEach((input) => {
          input.checked = input.value === current;
        });
      },
    };
  }

  global.LiftType = {
    STORAGE_KEY,
    DEFAULT_LIFT_TYPE,
    LIFT_TYPES,
    getStoredLiftTypeId,
    setStoredLiftTypeId,
    getEffectiveLiftTypeId,
    getEffectiveLiftMode,
    isImplemented,
    appendLiftTypeControl,
  };
})(window);
