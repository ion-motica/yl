(function (global) {
  "use strict";

  // Nivel N = împărțitorul este N.
  // Faptele: (N×0)÷N=0, (N×1)÷N=1, ..., (N×maxQuotient)÷N=maxQuotient
  // Nota: 0÷N=0 este inclus (valid, N≥1).

  function listLevelFacts(level) {
    const maxQuotient = level >= 11 ? 20 : 10;
    const facts = [];
    for (let quotient = 0; quotient <= maxQuotient; quotient++) {
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

  global.EFFQuizDivisionAdapter = {
    listLevelFacts,
    getDifficultyPair: (fact) => [fact.values.b, fact.values.result],
    getLevelLabel:       (level) => `Nivel ${level} · ÷${level} (cât 0..${level >= 11 ? 20 : 10})`,
    getLevelButtonTitle: (level) => `Nivel ${level}: împărțitor ${level}, câturi 0-${level >= 11 ? 20 : 10}`,
  };
})(window);
