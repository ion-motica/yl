(function (global) {
  "use strict";

  const GREEN_CELL_COUNT = 5;
  const PERCENT_STEP = 20;

  function greenStreak(filled, total = GREEN_CELL_COUNT, cellLabel) {
    const cells = Math.max(1, total);
    const label =
      cellLabel ??
      ((index) => ({
        aria: `Rundă perfectă ${index + 1}`,
        title: `Rundă perfectă ${index + 1}`,
      }));

    return {
      mode: "streak",
      cells,
      filled: Math.min(cells, Math.max(0, filled)),
      cellLabel: label,
      title: null,
    };
  }

  function greenPercent(percent) {
    const clamped = Math.min(100, Math.max(0, Number(percent) || 0));
    const filled = Math.min(GREEN_CELL_COUNT, Math.floor(clamped / PERCENT_STEP));

    return {
      mode: "percent",
      cells: GREEN_CELL_COUNT,
      filled,
      cellLabel: (index) => ({
        aria: `${(index + 1) * PERCENT_STEP}% din întrebările nivelului`,
        title: `${(index + 1) * PERCENT_STEP}% acoperit`,
      }),
      title: `${clamped}% din întrebările nivelului`,
    };
  }

  function redNone() {
    return { mode: "none", items: [] };
  }

  function hidden() {
    return {
      green: { mode: "hidden", cells: 0, filled: 0, hidden: true },
      red: { mode: "none", items: [], hidden: true },
    };
  }

  function redCombos(items) {
    return {
      mode: "combos",
      items: Array.isArray(items) ? items : [],
    };
  }

  function fromMistakeProgress(view = {}) {
    return {
      green: greenStreak(view.flawlessRunsStreak ?? 0, view.flawlessNeeded ?? GREEN_CELL_COUNT),
      red: redCombos(view.combos ?? []),
    };
  }

  function resolve(quiz) {
    if (!quiz) {
      return {
        green: greenStreak(0),
        red: redNone(),
      };
    }

    if (typeof quiz.getProgressDisplay === "function") {
      return quiz.getProgressDisplay();
    }

    if (typeof quiz.getProgress === "function") {
      return fromMistakeProgress(quiz.getProgress());
    }

    return {
      green: greenStreak(0),
      red: redNone(),
    };
  }

  function cellMeta(green, index) {
    const raw = green.cellLabel?.(index);
    if (raw && typeof raw === "object") {
      return {
        aria: raw.aria ?? `Progres ${index + 1}`,
        title: raw.title ?? raw.aria ?? "",
      };
    }
    if (typeof raw === "string") {
      return { aria: raw, title: raw };
    }
    return { aria: `Progres ${index + 1}`, title: "" };
  }

  global.ProgressDisplay = {
    GREEN_CELL_COUNT,
    PERCENT_STEP,
    greenStreak,
    greenPercent,
    redNone,
    hidden,
    redCombos,
    fromMistakeProgress,
    resolve,
    cellMeta,
  };
})(window);
