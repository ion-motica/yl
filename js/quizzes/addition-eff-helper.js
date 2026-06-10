(function (global) {
  "use strict";

  global.QuizRegistry.register({
    id: "addition-eff",
    title: "T+ EFF — Adunare extended fact family",
    description: "Adunare: serii {same QF, diff facts} și {same fact, diff QF}. Niveluri 1–20.",
    order: -199,
    gestionareGreseli: { activ: false },
    create() {
      return global.EFFQuiz.create({
        quizId: "addition-eff",
        adapter: global.EFFQuizAdditionAdapter,
        minLevel: 1,
        aam: {
          enabled: true,
          sameIllustrationInSeries(ctx) {
            return ctx.seriesType === "B";
          },
          illustrationKey(ctx) {
            return ctx.currentFact?.factId ?? null;
          },
        },
      });
    },
  });
})(window);
