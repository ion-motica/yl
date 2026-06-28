(function (global) {
  "use strict";

  const Config = global.LayoutConfig;
  const CELEBRATE_LABEL = "Bravo! Nivelul urmator!";
  const PULSE_COUNT = 2;
  const PULSE_CYCLE_MS = 750;
  const READ_HOLD_MS = 500;
  const DURATION_MS = PULSE_COUNT * PULSE_CYCLE_MS + READ_HOLD_MS;
  const SPIRAL_PARTICLES = 8;

  /** Opțiuni cumulative la schimbare nivel (sub-goal ASNW). */
  const REWARD_OPTS = [
    {
      key: "starsPulse",
      storageKey: "levelChangeStarsPulse",
      label: "1. Stelute pulse",
      defaultOn: true,
    },
    {
      key: "celebrateLabel",
      storageKey: "levelChangeCelebrateLabel",
      label: `2. Etichetă „${CELEBRATE_LABEL}”`,
      defaultOn: true,
    },
    {
      key: "sparkle",
      storageKey: "levelChangeSparkle",
      label: "3. Spirală minimă — câte una per stea",
      defaultOn: false,
    },
  ];

  /** @type {Map<string, HTMLInputElement>} */
  const uiInputs = new Map();

  function isEnabled(key) {
    const def = REWARD_OPTS.find((o) => o.key === key);
    if (!def) return false;
    return Config?.get(def.storageKey, def.defaultOn) === true;
  }

  function setEnabled(key, on) {
    const def = REWARD_OPTS.find((o) => o.key === key);
    if (!def || !Config) return;
    Config.set(def.storageKey, on === true);
    syncUi();
  }

  function getEnabledKeys() {
    return REWARD_OPTS.filter((o) => isEnabled(o.key)).map((o) => o.key);
  }

  function isAnyEnabled() {
    return getEnabledKeys().length > 0;
  }

  function syncUi() {
    for (const def of REWARD_OPTS) {
      const input = uiInputs.get(def.key);
      if (input) input.checked = isEnabled(def.key);
    }
  }

  function ensureCelebrateLabel(starsRow) {
    if (!starsRow) return null;
    let label = starsRow.querySelector(".asnw-subgoal-label");
    if (!label) {
      label = document.createElement("span");
      label.className = "asnw-subgoal-label";
      label.textContent = CELEBRATE_LABEL;
      label.setAttribute("aria-hidden", "true");
      starsRow.appendChild(label);
    }
    return label;
  }

  /** @returns {HTMLElement[]} */
  function spawnStarSpirals(starsRow) {
    if (!starsRow) return [];
    const stars = starsRow.querySelectorAll(".asnw-star");
    const spirals = [];
    stars.forEach((star, starIndex) => {
      const wrap = document.createElement("div");
      wrap.className = "asnw-star-spiral";
      wrap.dataset.starIndex = String(starIndex);
      wrap.setAttribute("aria-hidden", "true");
      for (let i = 0; i < SPIRAL_PARTICLES; i++) {
        const particle = document.createElement("span");
        particle.className = "asnw-spiral-particle";
        particle.style.setProperty("--spiral-i", String(i));
        particle.style.setProperty(
          "--spiral-offset",
          `${(360 / SPIRAL_PARTICLES) * i}deg`
        );
        wrap.appendChild(particle);
      }
      star.appendChild(wrap);
      spirals.push(wrap);
    });
    return spirals;
  }

  function beginStarsHold(starsRow) {
    global.AsnwStars?.beginCelebration?.();
    starsRow?.classList.add("celebrate");
  }

  function cleanup({ starsRow, label, spirals }) {
    starsRow?.classList.remove("celebrate", "celebrate-pulse");
    label?.classList.remove("show");
    spirals?.forEach((el) => el.remove());
    global.AsnwStars?.endCelebration?.();
  }

  /**
   * Pornește animațiile bifate (simultan).
   * @param {{ fallingEl?: HTMLElement }} ctx
   * @returns {number} durata ms (0 dacă nimic activ)
   */
  function play(ctx = {}) {
    const keys = getEnabledKeys();
    if (!keys.length) return 0;

    const fallingEl = ctx.fallingEl ?? document.getElementById("falling");
    const starsRow = fallingEl?.querySelector("#asnw-stars-row");
    let label = null;
    /** @type {HTMLElement[]} */
    let spirals = [];

    const needsStarHold =
      keys.includes("starsPulse") ||
      keys.includes("celebrateLabel") ||
      keys.includes("sparkle");
    if (needsStarHold) beginStarsHold(starsRow);

    if (keys.includes("starsPulse") && starsRow) {
      starsRow.classList.add("celebrate-pulse");
      starsRow.style.setProperty("--asnw-pulse-cycle", `${PULSE_CYCLE_MS}ms`);
      starsRow.style.setProperty("--asnw-pulse-count", String(PULSE_COUNT));
    }
    if (keys.includes("celebrateLabel")) {
      label = ensureCelebrateLabel(starsRow);
      label?.classList.add("show");
    }
    if (keys.includes("sparkle")) {
      spirals = spawnStarSpirals(starsRow);
    }

    setTimeout(() => cleanup({ starsRow, label, spirals }), DURATION_MS);
    return DURATION_MS;
  }

  /**
   * @param {HTMLElement} mount
   */
  function appendLevelChangeControl(mount) {
    if (!mount) return null;

    const section = document.createElement("div");
    section.className = "control-panel-level-change";

    const heading = document.createElement("div");
    heading.className = "control-panel-level-change-heading";
    heading.textContent = "La schimbare nivel";

    const flags = document.createElement("div");
    flags.className = "control-panel-level-change-flags";

    for (const def of REWARD_OPTS) {
      const row = document.createElement("label");
      row.className = "control-panel-lift-row control-panel-level-change-flag";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = isEnabled(def.key);
      input.addEventListener("change", () => {
        setEnabled(def.key, input.checked);
      });

      const span = document.createElement("span");
      span.textContent = def.label;

      row.append(input, span);
      flags.appendChild(row);
      uiInputs.set(def.key, input);
    }

    section.append(heading, flags);
    mount.appendChild(section);
    syncUi();
    return section;
  }

  global.LevelChangeReward = {
    REWARD_OPTS,
    PULSE_COUNT,
    PULSE_CYCLE_MS,
    READ_HOLD_MS,
    DURATION_MS,
    SPIRAL_PARTICLES,
    CELEBRATE_LABEL,
    isEnabled,
    setEnabled,
    getEnabledKeys,
    isAnyEnabled,
    play,
    appendLevelChangeControl,
  };
})(window);
