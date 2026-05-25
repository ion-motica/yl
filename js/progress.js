(function (global) {
  "use strict";

  /**
   * Progres comun pe nivel: 5 runde perfecte + combo greșite ×2 (implicit).
   * Quiz-urile furnizează doar cum se formează cheia și eticheta combo.
   */
  function comboNumber(payload) {
    return payload.number ?? payload.dividend ?? 0;
  }

  function normalizeComboScope(scope = {}) {
    if (typeof scope === "function") return scope;
    if (typeof scope === "number") {
      return (combo) => comboNumber(combo) >= scope;
    }

    const comboRelevant = scope.comboRelevant ?? scope.isComboRelevant;
    if (typeof comboRelevant === "function") return comboRelevant;

    const minComboNumber = scope.minComboNumber ?? 1;
    return (combo) => comboNumber(combo) >= minComboNumber;
  }

  function filterRelevantCombos(combos, scope = {}) {
    const isRelevant = normalizeComboScope(scope);
    return [...combos.values()].filter((combo) => isRelevant(combo));
  }

  function createLevelProgress(config) {
    const flawlessNeeded = config.flawlessNeeded ?? 5;
    const comboNeeded = config.comboNeeded ?? 2;
    const comboKey = config.comboKey;
    const comboTitle = config.comboTitle;

    let flawlessRunsStreak = 0;
    let currentRunFlawless = true;
    const combos = new Map();

    return {
      flawlessNeeded,
      comboNeeded,

      reset() {
        flawlessRunsStreak = 0;
        currentRunFlawless = true;
        combos.clear();
      },

      startRun() {
        currentRunFlawless = true;
      },

      noteRunFlawless() {
        if (currentRunFlawless) flawlessRunsStreak++;
        else flawlessRunsStreak = 0;
      },

      markRunImperfect() {
        currentRunFlawless = false;
      },

      isRunFlawless() {
        return currentRunFlawless;
      },

      recordMistake(payload) {
        currentRunFlawless = false;
        const key = comboKey(payload);
        if (!combos.has(key)) {
          combos.set(key, { ...payload, resolved: 0 });
        }
      },

      resolveCombo(payload) {
        const entry = combos.get(comboKey(payload));
        if (entry && entry.resolved < comboNeeded) entry.resolved++;
      },

      allCombosMastered() {
        if (combos.size === 0) return true;
        return [...combos.values()].every((c) => c.resolved >= comboNeeded);
      },

      /** Combo-urile relevante pentru quiz trebuie rezolvate de comboNeeded ori. */
      allCombosMasteredRelevant(scope = {}) {
        const relevant = filterRelevantCombos(combos, scope);
        if (relevant.length === 0) return true;
        return relevant.every((c) => c.resolved >= comboNeeded);
      },

      allCombosMasteredAtLeast(minNumber = 1) {
        return this.allCombosMasteredRelevant({ minComboNumber: minNumber });
      },

      canAdvanceLevel(opts = {}) {
        return (
          flawlessRunsStreak >= flawlessNeeded &&
          this.allCombosMasteredRelevant(opts)
        );
      },

      onLevelAdvanced() {
        combos.clear();
        flawlessRunsStreak = 0;
      },

      getFlawlessStreak() {
        return flawlessRunsStreak;
      },

      getProgressView(opts = {}) {
        const visible = filterRelevantCombos(combos, opts);
        return {
          flawlessRunsStreak,
          flawlessNeeded,
          combos: visible.map((c) => ({
            resolved: c.resolved,
            needed: comboNeeded,
            title: comboTitle(c),
          })),
        };
      },

      pendingCombos(excludeKey, scope = {}) {
        return filterRelevantCombos(combos, scope).filter(
          (c) =>
            c.resolved < comboNeeded &&
            comboKey(c) !== excludeKey
        );
      },
    };
  }

  function defaultComboKey(payload) {
    const questionId =
      payload.questionId ?? payload.questionLabel ?? payload.number ?? payload.dividend ?? "?";
    const wrongId = payload.wrong === null ? "t" : payload.wrong;
    return `${questionId}:${wrongId}`;
  }

  function defaultComboTitle(payload, comboNeeded) {
    const questionLabel =
      payload.questionLabel ?? payload.questionId ?? payload.number ?? payload.dividend ?? "intrebare";
    const wrongLabel = payload.wrong === null ? "timp" : payload.wrong;
    return `${questionLabel} · ${wrongLabel} — ${payload.resolved}/${comboNeeded}`;
  }

  function createQuizMistakes(meta = {}, config = {}) {
    const settings = meta.gestionareGreseli ?? meta.mistakeHandling ?? {};
    const enabled = config.enabled ?? settings.activ ?? true;
    const comboNeeded =
      config.comboNeeded ?? settings.nrRepetariPtRecuperare ?? meta.comboNeeded ?? 2;
    const comboKey = config.comboKey ?? defaultComboKey;
    const comboTitleBuilder = config.comboTitle ?? defaultComboTitle;
    const progress = createLevelProgress({
      comboNeeded,
      comboKey,
      comboTitle: (payload) => comboTitleBuilder(payload, comboNeeded),
    });

    return {
      enabled,
      comboNeeded,

      reset() {
        progress.reset();
      },

      startRun() {
        progress.startRun();
      },

      noteRunFlawless() {
        progress.noteRunFlawless();
      },

      markRunImperfect() {
        progress.markRunImperfect();
      },

      isRunFlawless() {
        return progress.isRunFlawless();
      },

      recordMistake(payload) {
        if (!enabled) {
          progress.markRunImperfect();
          return;
        }
        progress.recordMistake(payload);
      },

      resolveCombo(payload) {
        if (!enabled) return;
        progress.resolveCombo(payload);
      },

      canAdvanceLevel(opts = {}) {
        return progress.canAdvanceLevel(opts);
      },

      onLevelAdvanced() {
        progress.onLevelAdvanced();
      },

      getProgressView(opts = {}) {
        const view = progress.getProgressView(opts);
        if (enabled) return view;
        return { ...view, combos: [] };
      },

      pendingCombos(excludeKey, minNumber = 1) {
        if (!enabled) return [];
        return progress.pendingCombos(excludeKey, minNumber);
      },
    };
  }

  global.LevelProgress = { create: createLevelProgress };
  global.QuizMistakes = { create: createQuizMistakes };
})(window);
