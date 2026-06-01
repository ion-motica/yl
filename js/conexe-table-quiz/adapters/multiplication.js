(function (global) {
  "use strict";

  const CONEXE_TYPES = ["missing-left", "missing-right", "bond-left", "bond-right"];
  const OPTION_MIN = 1;

  function listLevelFacts(level) {
    return global.FactCatalog.listTableFacts({
      operation: "mul",
      promptForm: global.FactCatalog.PROMPT_FORMS.result,
      fixedA: level,
      minB: 1,
      maxB: 20,
    });
  }

  function promptLabel(fact, conexeType) {
    const { a, b, result: c } = fact.values;
    switch (conexeType) {
      case "missing-left":
        return `?*${b}=${c}`;
      case "missing-right":
        return `${a}*?=${c}`;
      case "bond-left":
        return `${c}=?*${b}`;
      case "bond-right":
        return `${c}=${a}*?`;
      default:
        return "—";
    }
  }

  function correctAnswer(fact, conexeType) {
    const { a, b } = fact.values;
    if (conexeType === "missing-left" || conexeType === "bond-left") return String(a);
    return String(b);
  }

  function pickNearWrongAnswers(correct, count, shuffle) {
    const correctNum = Number(correct);
    const optMax = Math.max(12, correctNum + 2);
    const used = new Set([correct]);
    const candidates = [];

    for (let delta = 1; delta <= optMax - OPTION_MIN; delta++) {
      for (const value of [correctNum - delta, correctNum + delta]) {
        if (value < OPTION_MIN || value > optMax) continue;
        const label = String(value);
        if (used.has(label)) continue;
        candidates.push(label);
        used.add(label);
      }
    }

    const picked = [];
    for (const label of shuffle(candidates)) {
      if (picked.length >= count) break;
      picked.push(label);
    }
    return picked;
  }

  function buildOptions(fact, conexeType, shuffle) {
    const correctLabel = correctAnswer(fact, conexeType);
    const optMax = Math.max(12, Number(correctLabel) + 2);
    const wrong = pickNearWrongAnswers(correctLabel, 2, shuffle);
    const fallback = (offset) =>
      String(Math.min(optMax, Math.max(OPTION_MIN, Number(correctLabel) + offset)));

    const options = shuffle([correctLabel, wrong[0] ?? fallback(-1), wrong[1] ?? fallback(1)]);
    return {
      options,
      correctIndex: options.indexOf(correctLabel),
    };
  }

  function buildRoundView({ fact, conexeType, options, correctIndex, hintMessage, extra = {} }) {
    return {
      bondHistory: [],
      options: options.map((value) => String(value)),
      correctIndex,
      divisionHistory: [],
      hintMessage,
      questionFormat: null,
      prompt: promptLabel(fact, conexeType),
      ...extra,
    };
  }

  global.ConexeTableQuizMultiplicationAdapter = {
    conexeTypes: CONEXE_TYPES,
    listLevelFacts,
    getDifficultyPair: (fact) => [fact.values.a, fact.values.b],
    getLevelLabel: (level) => `Nivel ${level} · ${level}*1..20`,
    getLevelButtonTitle: (level) => `Nivel ${level}: ${level}*1..20`,
    promptLabel,
    correctAnswer,
    buildOptions,
    buildRoundView,
  };
})(window);
