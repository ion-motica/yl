(function (global) {
  "use strict";

  /**
   * Progres comun pe nivel: 5 runde perfecte + combo greșite ×2 (implicit).
   * Quiz-urile furnizează doar cum se formează cheia și eticheta combo.
   */
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

      /** Combo-uri cu număr ≥ minNumber trebuie rezolvate de comboNeeded ori. */
      allCombosMasteredAtLeast(minNumber = 1) {
        const relevant = [...combos.values()].filter((c) => c.number >= minNumber);
        if (relevant.length === 0) return true;
        return relevant.every((c) => c.resolved >= comboNeeded);
      },

      canAdvanceLevel(opts = {}) {
        const minComboNumber = opts.minComboNumber ?? 1;
        return (
          flawlessRunsStreak >= flawlessNeeded &&
          this.allCombosMasteredAtLeast(minComboNumber)
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
        const minNumber = opts.minComboNumber ?? 1;
        const visible = [...combos.values()].filter((c) => c.number >= minNumber);
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

      pendingCombos(excludeKey, minNumber = 1) {
        return [...combos.values()].filter(
          (c) =>
            c.number >= minNumber &&
            c.resolved < comboNeeded &&
            comboKey(c) !== excludeKey
        );
      },
    };
  }

  global.LevelProgress = { create: createLevelProgress };
})(window);
