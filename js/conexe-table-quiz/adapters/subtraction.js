(function (global) {
  "use strict";

  const CONEXE_TYPES = ["missing-left", "missing-right", "bond-left", "bond-right"];
  const SMALL_OPTION_MIN = 1;
  const SMALL_OPTION_MAX = 12;

  function listLevelFacts(level) {
    const facts = [];
    for (let result = 0; result <= 10; result += 1) {
      facts.push(
        global.FactCatalog.createFact({
          operation: "sub",
          promptForm: global.FactCatalog.PROMPT_FORMS.result,
          values: { a: level + result, b: level, result },
        })
      );
    }
    return facts;
  }

  function promptLabel(fact, conexeType) {
    const { a, b, result: c } = fact.values;
    switch (conexeType) {
      case "missing-left":
        return `?-${b}=${c}`;
      case "missing-right":
        return `${a}-?=${c}`;
      case "bond-left":
        return `${c}=?-${b}`;
      case "bond-right":
        return `${c}=${a}-?`;
      default:
        return "—";
    }
  }

  function correctAnswer(fact, conexeType) {
    const { a, b } = fact.values;
    if (conexeType === "missing-left" || conexeType === "bond-left") return String(a);
    return String(b);
  }

  function answersMinuend(conexeType) {
    return conexeType === "missing-left" || conexeType === "bond-left";
  }

  function pickNearWrongAnswers(correct, count, shuffle) {
    const correctNum = Number(correct);
    const used = new Set([correct]);
    const candidates = [];

    for (let delta = 1; delta <= SMALL_OPTION_MAX - SMALL_OPTION_MIN; delta++) {
      for (const value of [correctNum - delta, correctNum + delta]) {
        if (value < SMALL_OPTION_MIN || value > SMALL_OPTION_MAX) continue;
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

  function pickMinuendWrongAnswers(minuend, difference, count, shuffle) {
    const correct = String(minuend);
    const used = new Set([correct]);
    const candidates = [];

    for (let value = minuend - difference; value <= minuend + difference; value += 1) {
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
    const { a, result: difference } = fact.values;
    const wrong = answersMinuend(conexeType)
      ? pickMinuendWrongAnswers(a, difference, 2, shuffle)
      : pickNearWrongAnswers(correctLabel, 2, shuffle);

    const fallback = (offset) => {
      if (answersMinuend(conexeType)) {
        return String(Math.max(1, a + offset));
      }
      return String(
        Math.min(
          SMALL_OPTION_MAX,
          Math.max(SMALL_OPTION_MIN, Number(correctLabel) + offset)
        )
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

  global.ConexeTableQuizSubtractionAdapter = {
    conexeTypes: CONEXE_TYPES,
    listLevelFacts,
    getLevelLabel: (level) => `Nivel ${level} · -${level} (diferență 0..10)`,
    getLevelButtonTitle: (level) => `Nivel ${level}: scăzător ${level}, diferențe 0-10`,
    promptLabel,
    correctAnswer,
    buildOptions,
    buildRoundView,
  };
})(window);
