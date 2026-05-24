(function (global) {
  "use strict";

  /**
   * Progres comun pe nivel: 5 runde perfecte + combo greșite × N.
   * Quiz-urile furnizează doar cum se formează cheia și eticheta combo.
   */
  function createLevelProgress(config) {
    const flawlessNeeded = config.flawlessNeeded ?? 5;
    const comboNeeded = config.comboNeeded ?? 3;
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

      canAdvanceLevel() {
        return flawlessRunsStreak >= flawlessNeeded && this.allCombosMastered();
      },

      onLevelAdvanced() {
        combos.clear();
        flawlessRunsStreak = 0;
      },

      getFlawlessStreak() {
        return flawlessRunsStreak;
      },

      getProgressView() {
        return {
          flawlessRunsStreak,
          flawlessNeeded,
          combos: [...combos.values()].map((c) => ({
            resolved: c.resolved,
            needed: comboNeeded,
            title: comboTitle(c),
          })),
        };
      },

      pendingCombos(excludeKey) {
        return [...combos.values()].filter(
          (c) => c.resolved < comboNeeded && comboKey(c) !== excludeKey
        );
      },
    };
  }

  global.LevelProgress = { create: createLevelProgress };
})(window);
