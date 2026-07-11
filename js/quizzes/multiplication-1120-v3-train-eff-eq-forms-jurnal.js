(function (global) {
  "use strict";

  const QUIZ_ID = "multiplication-1120-v3-train-eff-eq-forms-jurnal";
  const QUIZ_NAME = "T*/ 11-20 - v3 - train w eff si eq forms - jurnal";

  global.QuizRegistry.register({
    id: QUIZ_ID,
    title: QUIZ_NAME,
    description: "Clona de test pentru jurnalul simplu al intrebarilor.",
    order: 2.21,
    gestionareGreseli: { activ: false },
    create(meta = {}) {
      return global.Mul1120V3TrainEffEqFormsQuiz.create({
        ...meta,
        quizId: QUIZ_ID,
        quizName: QUIZ_NAME,
        jurnalIntrebariActiv: true,
      });
    },
  });
})(window);
