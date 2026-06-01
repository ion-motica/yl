(function (global) {
  "use strict";

  global.QuizRegistry.register({
    id: "addition-table-conexe-helper",
    title: "Tabla adunarii - intrebari ajutatoare 3+?=5",
    description:
      "Conexe pentru tabla adunarii (?+b, a+?, c=?+b, c=a+?). Alternanță M1/M2, nivel 2–20.",
    order: -6,
    gestionareGreseli: { activ: false },
    create() {
      return global.ConexeTableQuiz.create({
        quizId: "addition-table-conexe-helper",
        adapter: global.ConexeTableQuizAdditionAdapter,
      });
    },
  });
})(window);
