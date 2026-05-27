(function (global) {
  "use strict";

  global.QuizRegistry.register({
    id: "division-table-conexe-helper",
    title: "Tabla impartirii - intrebari ajutatoare 15:?=3",
    description:
      "Conexe pentru tabla împărțirii (?:b, a:?, c=?:b, c=a:?). Alternanță M1/M2, nivel 2–10.",
    order: -11,
    gestionareGreseli: { activ: false },
    create() {
      return global.ConexeTableQuiz.create({
        quizId: "division-table-conexe-helper",
        adapter: global.ConexeTableQuizDivisionAdapter,
      });
    },
  });
})(window);
