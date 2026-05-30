(function (global) {
  "use strict";

  // Adapter pentru "Adunări succesive".
  // Nivel N => adunare cu N.
  // Start = multiplu aleator al lui N în [0, cap]:
  //   niveluri 1-10:  cap = min(200, N * 12)   → +3: 0..36, +10: 0..120
  //   niveluri 11-20: cap = N * 20             → +11: 0..220, +20: 0..400

  const START_FACTOR_LOW = 12;
  const START_ABS_MAX = 200;
  const START_FACTOR_HIGH = 20;
  const LEVEL_THRESHOLD = 10;

  function pickStartValue(level, { randomInt }) {
    const cap =
      level <= LEVEL_THRESHOLD
        ? Math.min(START_ABS_MAX, level * START_FACTOR_LOW)
        : level * START_FACTOR_HIGH;
    const maxMultiplier = Math.floor(cap / level);
    return randomInt(0, maxMultiplier) * level;
  }

  function buildStep(current, level) {
    const a = current;
    const b = level;
    const result = a + b;
    return {
      prompt: `${a}+${b}=?`,
      correctAnswer: result,
      a,
      b,
      factSeed: {
        operation: "add",
        promptForm: global.FactCatalog.PROMPT_FORMS.result,
        values: { a, b },
      },
    };
  }

  function buildOptions(correctAnswer, level, { shuffle }) {
    const correct = Number(correctAnswer);
    const used = new Set([correct]);
    const candidates = [];
    const offsets = [1, 2, level, level * 2, 10];

    for (const offset of offsets) {
      for (const value of [correct - offset, correct + offset]) {
        if (value < 0 || used.has(value)) continue;
        used.add(value);
        candidates.push(value);
      }
    }

    let extra = correct + 1;
    while (candidates.length < 2) {
      if (!used.has(extra)) { used.add(extra); candidates.push(extra); }
      extra += 1;
    }

    const wrong = shuffle(candidates).slice(0, 2);
    const triple = shuffle([correct, wrong[0], wrong[1]]).map(String);
    return {
      options: triple,
      correctIndex: triple.indexOf(String(correct)),
    };
  }

  global.SuccesiveAdditionAdapter = {
    operation: "add",
    getLevelLabel: (level) => `Nivel ${level} · +${level}`,
    getLevelButtonTitle: (level) => `Nivel ${level}: adunări succesive cu ${level}`,
    pickStartValue,
    buildStep,
    buildOptions,
  };
})(window);
