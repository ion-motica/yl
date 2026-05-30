(function (global) {
  "use strict";

  global.QuizRegistry.register({
    id: "addition-succesive",
    title: "Adunări succesive",
    description:
      "Lift cu adunări în lanț: 20+5, 25+5, 30+5... Serii de 3/5/7 întrebări. Nivel N = adunare cu N (1..20). Avansezi după o serie fără greșeli.",
    order: -100,
    gestionareGreseli: { activ: false },
    create() {
      return global.SuccesiveQuiz.create({
        quizId: "addition-succesive",
        adapter: global.SuccesiveAdditionAdapter,
      });
    },
  });
})(window);
