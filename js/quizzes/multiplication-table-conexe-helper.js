(function (global) {
  "use strict";

  global.QuizRegistry.register({
    id: "multiplication-table-conexe-helper",
    title: "Tabla inmultirii - intrebari ajutatoare 5*?=15",
    description:
      "Conexe pentru tabla înmulțirii (?*b, a*?, c=?*b, c=a*?). Alternanță M1/M2, nivel 1–20.",
    order: -13,
    gestionareGreseli: { activ: false },
    create() {
      return global.ConexeTableQuiz.create({
        quizId: "multiplication-table-conexe-helper",
        adapter: global.ConexeTableQuizMultiplicationAdapter,
        minLevel: 1,
        levelTooLowMessage: "Prea ușor. trecem la nivelul 1",
      });
    },
  });
})(window);
