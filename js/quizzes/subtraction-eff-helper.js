(function (global) {
  "use strict";

  global.QuizRegistry.register({
    id: "subtraction-eff",
    title: "T− EFF — Scădere extended fact family - QUIZ NEFUNCTIONAL - IN REFACTORING",
    description: "Scădere: serii {same QF, diff facts} și {same fact, diff QF}. Niveluri 1–20.",
    order: -198,
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
