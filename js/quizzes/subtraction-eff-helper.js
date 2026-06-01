(function (global) {
  "use strict";

  global.QuizRegistry.register({
    id: "subtraction-eff",
    title: "T− EFF — Scădere extended fact family",
    description: "Scădere: serii {same QF, diff facts} și {same fact, diff QF}. Niveluri 1–20.",
    order: -4,
    gestionareGreseli: { activ: false },
    create() {
      return global.EFFQuiz.create({
        quizId: "subtraction-eff",
        adapter: global.EFFQuizSubtractionAdapter,
        minLevel: 1,
      });
    },
  });
})(window);
