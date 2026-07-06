(function (global) {
  "use strict";

  const STORAGE_KEY = "startupQuizId";
  const FALLBACK_QUIZ_ID = "addition-table-range";

  const Config = global.LayoutConfig;

  function listQuizOptions() {
    const Registry = global.QuizRegistry;
    if (!Registry) return [];
    return Registry.list().map((meta) => ({ id: meta.id, title: meta.title }));
  }

  function getStoredQuizId() {
    const stored = Config?.get(STORAGE_KEY, null);
    if (typeof stored === "string" && stored) return stored;
    return FALLBACK_QUIZ_ID;
  }

  function setStoredQuizId(id) {
    if (!Config || !id) return;
    Config.set(STORAGE_KEY, id);
  }

  function getRequestedQuizId() {
    try {
      const search = global.location?.search;
      if (typeof search !== "string" || !search) return null;
      const id = new URLSearchParams(search).get("quiz");
      return typeof id === "string" && id ? id : null;
    } catch (err) {
      return null;
    }
  }

  function decodeBase64Url(value) {
    try {
      const normalized = String(value).replace(/-/g, "+").replace(/_/g, "/");
      const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
      if (typeof global.atob === "function") return global.atob(padded);
    } catch (err) {
      return null;
    }
    return null;
  }

  function fallbackSearchParam(search, name) {
    const raw = String(search || "").replace(/^\?/, "");
    const escapedName = String(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = raw.match(new RegExp(`(?:^|&)${escapedName}(?:=|%20|\\s)+([^&]+)`));
    if (!match) return null;
    try {
      return decodeURIComponent(match[1].replace(/\+/g, "%20"));
    } catch (err) {
      return match[1];
    }
  }

  function readSearchParam(search, name) {
    const value = new URLSearchParams(search).get(name);
    if (typeof value === "string" && value) return value;
    return fallbackSearchParam(search, name);
  }

  function tryParseConfig(value) {
    if (typeof value !== "string" || !value) return null;
    const candidates = [value];
    const decoded = decodeBase64Url(value);
    if (decoded) candidates.push(decoded);
    for (const candidate of candidates) {
      if (!candidate) continue;
      try {
        const parsed = JSON.parse(candidate);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
      } catch (err) {
        // Invalid or stale shared config: ignore it and keep defaults.
      }
    }
    return null;
  }

  function getRequestedQuizConfig() {
    try {
      const search = global.location?.search;
      if (typeof search !== "string" || !search) return null;
      return tryParseConfig(readSearchParam(search, "cfg"));
    } catch (err) {
      return null;
    }
  }

  /** Quiz la pornirea aplicației (independent de profilul ASNW). */
  function resolveStartupQuizId() {
    const Registry = global.QuizRegistry;
    if (!Registry) return null;

    const requested = getRequestedQuizId();
    if (requested && Registry.get(requested)) return requested;

    const preferred = getStoredQuizId();
    if (preferred && Registry.get(preferred)) return preferred;

    for (const id of [
      FALLBACK_QUIZ_ID,
      "addition-eff",
      Registry.getDefaultId(),
      "addition-table",
      "prime-divisions",
    ]) {
      if (id && Registry.get(id)) return id;
    }
    return Registry.list()[0]?.id ?? null;
  }

  /**
   * @param {HTMLElement} mount
   * @param {{ onChange?: (quizId: string) => void }} opts
   */
  function appendStartupQuizControl(mount, opts) {
    const Registry = global.QuizRegistry;
    if (!mount || !Registry) return null;

    const row = document.createElement("div");
    row.className = "control-panel-lift-field control-panel-startup-quiz";

    const label = document.createElement("label");
    label.textContent = "Quiz de pornire default";

    const select = document.createElement("select");
    select.className = "control-panel-startup-quiz-select";

    const options = listQuizOptions();
    const storedId = getStoredQuizId();
    let selectedExists = false;

    for (const { id, title } of options) {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = title;
      if (id === storedId) {
        opt.selected = true;
        selectedExists = true;
      }
      select.appendChild(opt);
    }

    if (!selectedExists && options[0]) {
      select.value = options[0].id;
      setStoredQuizId(options[0].id);
    }

    select.addEventListener("change", () => {
      const id = select.value;
      if (!Registry.get(id)) return;
      setStoredQuizId(id);
      opts?.onChange?.(id);
    });

    row.append(label, select);
    mount.appendChild(row);
    return row;
  }

  global.StartupQuiz = {
    STORAGE_KEY,
    FALLBACK_QUIZ_ID,
    getStoredQuizId,
    getRequestedQuizId,
    getRequestedQuizConfig,
    setStoredQuizId,
    resolveStartupQuizId,
    appendStartupQuizControl,
  };
})(window);
