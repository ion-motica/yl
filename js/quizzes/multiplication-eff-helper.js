(function (global) {
  "use strict";

  global.QuizRegistry.register({
    id: "multiplication-eff",
    title: "T× EFF — Înmulțire extended fact family - QUIZ NEFUNCTIONAL - IN REFACTORING",
    description: "Înmulțire: serii {same QF, diff facts} și {same fact, diff QF}. Niveluri 1–20.",
    order: -200,
    gestionareGreseli: { activ: false },
    create() {
      return global.EFFQuiz.create({
        quizId: "multiplication-eff",
        adapter: global.EFFQuizMultiplicationAdapter,
        minLevel: 1,
      });
    },
  });
})(window);
