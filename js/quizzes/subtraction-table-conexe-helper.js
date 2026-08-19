(function (global) {
  "use strict";

  global.QuizRegistry.register({
    id: "subtraction-table-conexe-helper",
    title: "Tabla scaderii - intrebari ajutatoare 5-?=3 - QUIZ NEFUNCTIONAL - IN REFACTORING",
    description:
      "Conexe pentru tabla scăderii (?-b, a-?, c=?-b, c=a-?). Alternanță M1/M2, nivel 1–20.",
    order: -12,
    gestionareGreseli: { activ: false },
    create() {
      return global.ConexeTableQuiz.create({
        quizId: "subtraction-table-conexe-helper",
        adapter: global.ConexeTableQuizSubtractionAdapter,
        minLevel: 1,
        levelTooLowMessage: "Prea ușor. trecem la nivelul 1",
      });
    },
  });
})(window);
