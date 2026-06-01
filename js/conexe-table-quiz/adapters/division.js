(function (global) {
  "use strict";

  const CONEXE_TYPES = ["missing-left", "missing-right", "bond-left", "bond-right"];
  const DIVISOR_OPTION_MIN = 1;
  const DIVISOR_OPTION_MAX = 12;

  function listLevelFacts(level) {
    const facts = [];
    for (let quotient = 1; quotient <= 20; quotient += 1) {
      facts.push(
        global.FactCatalog.createFact({
          operation: "div",
          promptForm: global.FactCatalog.PROMPT_FORMS.result,
          values: { a: level * quotient, b: level, result: quotient },
        })
      );
    }
    return facts;
  }

  function promptLabel(fact, conexeType) {
    const { a, b, result: c } = fact.values;
    switch (conexeType) {
      case "missing-left":
        return `?:${b}=${c}`;
      case "missing-right":
        return `${a}:?=${c}`;
      case "bond-left":
        return `${c}=?:${b}`;
      case "bond-right":
        return `${c}=${a}:?`;
      default:
        return "—";
    }
  }

  function correctAnswer(fact, conexeType) {
    const { a, b } = fact.values;
    if (conexeType === "missing-left" || conexeType === "bond-left") return String(a);
    return String(b);
  }

  function answersDividend(conexeType) {
    return conexeType === "missing-left" || conexeType === "bond-left";
  }

  function pickNearWrongAnswers(correct, count, shuffle) {
    const correctNum = Number(correct);
    const optMax = Math.max(12, correctNum + 2);
    const used = new Set([correct]);
    const candidates = [];

    for (let delta = 1; delta <= optMax - DIVISOR_OPTION_MIN; delta++) {
      for (const value of [correctNum - delta, correctNum + delta]) {
        if (value < DIVISOR_OPTION_MIN || value > optMax) continue;
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

  function pickDividendWrongAnswers(dividend, quotient, count, shuffle) {
    const correct = String(dividend);
    const used = new Set([correct]);
    const candidates = [];

    for (let value = dividend - quotient; value <= dividend + quotient; value += 1) {
      if (value <= 0) continue;
      const label = String(value);
      if (used.has(label)) continue;
      candidates.push(label);
      used.add(label);
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
    const { a, result: quotient } = fact.values;
    const wrong = answersDividend(conexeType)
      ? pickDividendWrongAnswers(a, quotient, 2, shuffle)
      : pickNearWrongAnswers(correctLabel, 2, shuffle);

    const optMax = Math.max(12, Number(correctLabel) + 2);
    const fallback = (offset) => {
      if (answersDividend(conexeType)) {
        return String(Math.max(1, a + offset));
      }
      return String(
        Math.min(optMax, Math.max(DIVISOR_OPTION_MIN, Number(correctLabel) + offset))
      );
    };

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

  global.ConexeTableQuizDivisionAdapter = {
    conexeTypes: CONEXE_TYPES,
    listLevelFacts,
    getLevelLabel: (level) => `Nivel ${level} · :${level} (cât 1..20)`,
    getLevelButtonTitle: (level) => `Nivel ${level}: împărțitor ${level}, câturi 1-20`,
    promptLabel,
    correctAnswer,
    buildOptions,
    buildRoundView,
  };
})(window);
