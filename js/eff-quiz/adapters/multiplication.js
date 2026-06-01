(function (global) {
  "use strict";

  function listLevelFacts(level) {
    const maxB = level >= 11 ? 20 : 10;
    return global.FactCatalog.listTableFacts({
      operation: "mul",
      promptForm: global.FactCatalog.PROMPT_FORMS.result,
      fixedA: level,
      minB: 0,
      maxB,
    });
  }

  global.EFFQuizMultiplicationAdapter = {
    listLevelFacts,
    getDifficultyPair: (fact) => [fact.values.a, fact.values.b],
    getLevelLabel:       (level) => `Nivel ${level} · ${level}×0..${level >= 11 ? 20 : 10}`,
    getLevelButtonTitle: (level) => `Nivel ${level}: ${level}×0..${level >= 11 ? 20 : 10}`,
  };
})(window);
