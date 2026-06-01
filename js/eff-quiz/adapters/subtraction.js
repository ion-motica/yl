(function (global) {
  "use strict";

  // Nivel N = scăzătorul este N.
  // Faptele: (N+0)−N=0, (N+1)−N=1, ..., (N+maxResult)−N=maxResult

  function listLevelFacts(level) {
    const maxResult = level >= 11 ? 20 : 10;
    const facts = [];
    for (let result = 0; result <= maxResult; result++) {
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

  global.EFFQuizSubtractionAdapter = {
    listLevelFacts,
    getLevelLabel:       (level) => `Nivel ${level} · −${level} (diferență 0..${level >= 11 ? 20 : 10})`,
    getLevelButtonTitle: (level) => `Nivel ${level}: scăzător ${level}, diferențe 0-${level >= 11 ? 20 : 10}`,
  };
})(window);
