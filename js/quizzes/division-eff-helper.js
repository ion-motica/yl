(function (global) {
  "use strict";

  global.QuizRegistry.register({
    id: "division-eff",
    title: "T÷ EFF — Împărțire extended fact family",
    description: "Împărțire: serii {same QF, diff facts} și {same fact, diff QF}. Niveluri 1–20.",
    order: -197,
    gestionareGreseli: { activ: false },
    create() {
      return global.EFFQuiz.create({
        quizId: "division-eff",
        adapter: global.EFFQuizDivisionAdapter,
        minLevel: 1,
      });
    },
  });
})(window);
