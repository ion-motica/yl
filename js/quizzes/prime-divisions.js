(function (global) {
  "use strict";

  const MAX_LEVEL = 10;
  const REPLAY_CHANCE = 0.65;
  const CORRECT_PROMPT_HOLD_MS = 160;
  const { isPrime, primeFactors, randomCompositeAtLeast } = global.QuizMath;

  function createPrimeDivisionsQuiz(config = {}) {
    const { randomInt, shuffle, levelRange, levelLabel } = global.GameUtils;

    let level = 1;
    let roundStartNumber = 0;
    let currentDividend = 0;
    let currentDivisor = 0;
    let currentQuotient = 0;
    let options = [];
    let correctIndex = 0;
    let activeComboTrap = null;
    let lastRoundStartNum = null;
    let gameCompleted = false;
    const solvedFactors = [];
    const divisionHistory = [];
    let orchestrator = null;

    const mistakes = global.QuizMistakes.create(config);

    // Faza E, sectiunea 12: orice quiz trebuie construit intern prin
    // SubquizOrchestrator (vezi prime-divisors.js pt. explicatia completa a
    // tiparului — fisier-frate, acelasi pas intermediar real). Chemata
    // explicit dupa `buildStep`/`buildStepFromCombo`, la cele 2 situri de
    // mutatie (`beginRound`, ramura intermediara din `dupaRaspunsCorect`).
    function sincronizeazaOrchestratorul() {
      orchestrator.getCurrentRuntime().setCurrentItem({
        prompt: currentPrompt(),
        options: [...options],
        correctIndex,
      });
    }

    function nextSetFloorForLevel(lv) {
      if (lv >= 5) return 20;
      if (lv >= 3) return 10;
      return 0;
    }

    function isBelowLevelFloor(n) {
      const floor = nextSetFloorForLevel(level);
      return floor > 0 && n > 1 && n < floor;
    }

    function shouldSkipFinalPrimeStep(n) {
      return n > 1 && isPrime(n);
    }

    function progressOpts() {
      const floor = nextSetFloorForLevel(level);
      return { comboRelevant: (combo) => (combo.dividend ?? combo.number) >= floor };
    }

    function canAdvanceNow() {
      return mistakes.canAdvanceLevel(progressOpts());
    }

    function uniquePrimeDivisorsOf(n) {
      return [...new Set(primeFactors(n))];
    }

    function pickPrimeDivisor(n) {
      const divisors = uniquePrimeDivisorsOf(n);
      if (!divisors.length) return n;
      return divisors[randomInt(0, divisors.length - 1)];
    }

    function pickWrongQuotients(dividend, correctQuotient, count, exclude = []) {
      const picked = [];
      const used = new Set([correctQuotient, ...exclude]);
      const half = Math.floor(dividend / 2);

      function tryAdd(value) {
        if (picked.length >= count) return;
        if (!Number.isInteger(value) || value < 1 || used.has(value)) return;
        picked.push(value);
        used.add(value);
      }

      const preferred = [];
      for (let value = 1; value <= half; value++) {
        if (value !== correctQuotient) preferred.push(value);
      }
      for (const value of shuffle(preferred)) tryAdd(value);

      if (picked.length < count) {
        const fallback = [];
        const fallbackMax = Math.max(dividend, correctQuotient + 4, 6);
        for (let value = half + 1; value <= fallbackMax; value++) {
          if (value !== correctQuotient) fallback.push(value);
        }
        for (const value of shuffle(fallback)) tryAdd(value);
      }

      for (let value = Math.max(dividend + 1, 7); picked.length < count; value++) {
        tryAdd(value);
      }

      return picked.slice(0, count);
    }

    function buildFactorizationLine(quotient) {
      const parts = [...solvedFactors];
      if (quotient > 1) parts.push(quotient);
      return `${roundStartNumber}=${parts.join("*")}`;
    }

    function formatOptionsForView(source = options) {
      return source.map((x) => {
        if (x == null || Number.isNaN(Number(x))) return "—";
        const s = String(x);
        return s === "undefined" ? "—" : s;
      });
    }

    function divisionPrompt(dividend, divisor) {
      return `${dividend}:${divisor}=?`;
    }

    function divisionPromptHtml(dividend, divisor, quotient) {
      return `${dividend}:${divisor}=<span class="q-correct">${quotient}</span>`;
    }

    function currentPrompt() {
      return divisionPrompt(currentDividend, currentDivisor);
    }

    function applyCorrectRevealToResult(result, dividend, divisor, quotient) {
      result.prompt = `${dividend}:${divisor}=${quotient}`;
      result.promptHtml = divisionPromptHtml(dividend, divisor, quotient);
      result.levelAdvanced = false;
      result.runDelayMs = CORRECT_PROMPT_HOLD_MS;
      return result;
    }

    function comboDividend(combo) {
      return combo.dividend ?? combo.number;
    }

    function buildMistakePayload({
      dividend = currentDividend,
      divisor = currentDivisor,
      correct = currentQuotient,
      wrong = null,
    } = {}) {
      const questionText = divisionPrompt(dividend, divisor);
      return {
        questionId: questionText,
        questionLabel: questionText,
        number: dividend,
        dividend,
        divisor,
        correct,
        wrong,
      };
    }

    function listPendingCombos() {
      return mistakes.pendingCombos(undefined, progressOpts());
    }

    function pickReplayStartCombo() {
      const pending = listPendingCombos().filter((combo) => comboDividend(combo) !== lastRoundStartNum);
      if (!pending.length || Math.random() >= REPLAY_CHANCE) return null;
      return pending[randomInt(0, pending.length - 1)];
    }

    function isResolvedCombo(combo, dividend, divisor, chosen, fallbackCorrect) {
      return Boolean(
        combo &&
          dividend === comboDividend(combo) &&
          divisor === combo.divisor &&
          chosen === (combo.correct ?? fallbackCorrect)
      );
    }

    function roundView(extra = {}) {
      return {
        prompt: currentPrompt(),
        options: formatOptionsForView(),
        correctIndex,
        divisionHistory: [...divisionHistory],
        hintMessage: extra.hintMessage ?? "Alege câtul corect.",
        ...extra,
      };
    }

    function solvedStepView(dividend, divisor) {
      return {
        prompt: divisionPrompt(dividend, divisor),
        options: formatOptionsForView(),
        correctIndex,
        divisionHistory: [...divisionHistory],
        hintMessage: "",
      };
    }

    function buildStepFromCombo(combo) {
      const dividend = comboDividend(combo);
      const divisor = combo.divisor;
      const correctQuotient = combo.correct ?? Math.floor(dividend / divisor);

      currentDividend = dividend;
      currentDivisor = divisor;
      currentQuotient = correctQuotient;

      let triple;
      if (combo.wrong !== null && combo.wrong !== correctQuotient) {
        const extra = pickWrongQuotients(dividend, correctQuotient, 1, [combo.wrong]);
        triple = shuffle([correctQuotient, combo.wrong, extra[0]]);
      } else {
        const wrong = pickWrongQuotients(dividend, correctQuotient, 2);
        triple = shuffle([correctQuotient, wrong[0], wrong[1]]);
      }

      options = triple.map((value) => Number(value));
      correctIndex = options.indexOf(correctQuotient);
      activeComboTrap = combo;
    }

    function findPendingComboForDividend(dividend) {
      return listPendingCombos().find((combo) => comboDividend(combo) === dividend);
    }

    function buildStep(dividend) {
      activeComboTrap = null;
      const trap = findPendingComboForDividend(dividend);
      if (trap) {
        buildStepFromCombo(trap);
        return;
      }

      currentDividend = dividend;
      currentDivisor = pickPrimeDivisor(dividend);
      currentQuotient = Math.floor(currentDividend / currentDivisor);

      const wrong = pickWrongQuotients(currentDividend, currentQuotient, 2);
      const triple = shuffle([currentQuotient, wrong[0], wrong[1]]);
      options = triple.map((value) => Number(value));
      correctIndex = options.indexOf(currentQuotient);
    }

    // Motor3Butoane apeleaza actiunile ca functii simple, fara `this` legat de
    // obiectul quizului — de-asta foloseste `quizApi` (setat imediat dupa ce
    // obiectul e construit, mai jos) in loc de `this.beginRound(...)`.
    function finishSeriesRun(reachedOne, finalView) {
      const snapshot = { ...finalView, divisionHistory: [...finalView.divisionHistory] };
      mistakes.noteRunFlawless();

      if (canAdvanceNow() && level >= MAX_LEVEL) {
        gameCompleted = true;
        return {
          outcome: "run-complete",
          ...snapshot,
          correct: true,
          runComplete: true,
          gameComplete: true,
          flash: "win",
          banner: "Felicitări! Ai terminat toate nivelele!",
          message: "Felicitări! Ai terminat toate nivelele!",
        };
      }

      if (canAdvanceNow()) {
        level++;
        mistakes.onLevelAdvanced();
        const next = pickRoundStart();
        return {
          outcome: "run-complete",
          ...snapshot,
          correct: true,
          runComplete: true,
          levelAdvanced: true,
          flash: "win",
          banner: "Felicitări! Next level!",
          message: reachedOne ? "Felicitări! Ai ajuns la 1." : "Rundă completă.",
          nextRound: quizApi.beginRound(next),
        };
      }

      const next = pickRoundStart();
      const flawless = mistakes.isRunFlawless();
      return {
        outcome: "run-complete",
        ...snapshot,
        correct: true,
        runComplete: true,
        flash: flawless ? "win" : undefined,
        message: flawless
          ? "Felicitări! Rundă perfectă."
          : reachedOne
            ? "Felicitări! Ai ajuns la 1."
            : "Rundă completă.",
        nextRound: quizApi.beginRound(next),
      };
    }

    function pickCompositeStart(exclude) {
      const { min, max } = levelRange(level);
      const floor = nextSetFloorForLevel(level);
      return randomCompositeAtLeast(floor, min, max, exclude);
    }

    function pickRoundStart() {
      const combo = pickReplayStartCombo();
      if (combo) return { startNum: comboDividend(combo), combo };

      return { startNum: pickCompositeStart(lastRoundStartNum), combo: null };
    }

    // Motor 3 butoane (M3B) — vezi documente de referinta/PLAN-motor-comun-raspuns.md.
    // Ca la prime-divisors.js: exista un pas intermediar real (lantul de
    // impartiri succesive), de-asta mutatia de stare + decizia terminal/continua
    // se fac in `dupaRaspunsCorect`. Spre deosebire de prime-divisors.js, aici
    // pasul intermediar are o pauza proprie (160ms, ca sa se vada rezultatul
    // impartirii curente inainte de urmatoarea) — azi exprimata prin campul
    // unic `pasUrmator: { dupa, continua }`. M3B il lasa sa treaca neatins, e
    // citit direct de falling-engine.js. Acesta e SINGURUL loc din aplicatie
    // care foloseste `dupa` (o pauza diferita de cea implicita din motor).
    //
    // Faza E, sectiunea 12: invelit intr-un SubquizOrchestrator (o singura
    // bucata "baza"). `options` proprii sunt NUMERE — `mesaje.gresit`/
    // `dupaApasare` citesc `options[ctx.index]` direct din closure, NU
    // `ctx.alesul` (ar fi string-ul normalizat de motor). Aici capcana are o
    // consecinta mai subtila decat un mesaj: `ctx.alesul` (string) ar fi ajuns
    // stocat ca `combo.wrong` prin `buildMistakePayload`, comparat mai tarziu
    // cu `!==` strict fata de un NUMAR (`correctQuotient`) in
    // `buildStepFromCombo` — un string ar fi picat mereu acea comparatie,
    // indiferent de valoare.
    function baseDefinition() {
      return global.SubquizDefinition.define({
        id: "base",
        title: "baza",
        hintMessage: "Alege câtul corect.",
        esteCorect: (_item, index) => options[index] === currentQuotient,
        generator: () => ({}),
        mesaje: {
          gresit: (ctx) => `La ${currentDividend}:${currentDivisor}=?, ${options[ctx.index]} nu e corect. Încearcă din nou!`,
        },
        actiuni: {
          dupaApasare: (ctx) => {
            if (!ctx.corect) {
              mistakes.recordMistake(
                buildMistakePayload({
                  dividend: currentDividend,
                  divisor: currentDivisor,
                  correct: currentQuotient,
                  wrong: options[ctx.index],
                })
              );
            }
            return { divisionHistory: [...divisionHistory] };
          },
          dupaRaspunsCorect: () => {
            const dividendBefore = currentDividend;
            const divisorBefore = currentDivisor;
            const quotientBefore = currentQuotient;

            if (isResolvedCombo(activeComboTrap, dividendBefore, divisorBefore, quotientBefore, quotientBefore)) {
              mistakes.resolveCombo(activeComboTrap);
            }

            solvedFactors.push(divisorBefore);
            divisionHistory.push(buildFactorizationLine(quotientBefore));

            if (quotientBefore === 1) {
              const result = finishSeriesRun(true, solvedStepView(dividendBefore, divisorBefore));
              return {
                action: "continue",
                view: applyCorrectRevealToResult(result, dividendBefore, divisorBefore, quotientBefore),
              };
            }

            if (shouldSkipFinalPrimeStep(quotientBefore) || isBelowLevelFloor(quotientBefore)) {
              const result = finishSeriesRun(false, solvedStepView(dividendBefore, divisorBefore));
              return {
                action: "continue",
                view: applyCorrectRevealToResult(result, dividendBefore, divisorBefore, quotientBefore),
              };
            }

            const answeredStep = {
              prompt: `${dividendBefore}:${divisorBefore}=${quotientBefore}`,
              promptHtml: divisionPromptHtml(dividendBefore, divisorBefore, quotientBefore),
              options: formatOptionsForView(),
              correctIndex,
              divisionHistory: [...divisionHistory],
              hintMessage: "",
            };

            buildStep(quotientBefore);
            sincronizeazaOrchestratorul();
            return {
              action: "continue",
              view: {
                outcome: "step-correct",
                correct: true,
                bounce: true,
                message: `Corect! ${dividendBefore}:${divisorBefore}=${quotientBefore}`,
                ...answeredStep,
                pasUrmator: {
                  dupa: CORRECT_PROMPT_HOLD_MS,
                  continua: roundView({ hintMessage: "" }),
                },
              },
            };
          },
        },
      });
    }

    orchestrator = global.SubquizOrchestrator.create({
      definitions: [baseDefinition()],
      activeSubquizIds: ["base"],
      context: {},
    });
    orchestrator.startFirst();

    const quizApi = {
      getLevel: () => level,
      getMaxLevel: () => MAX_LEVEL,
      isCompleted: () => gameCompleted,
      setCompleted: (value) => {
        gameCompleted = value;
      },

      resetLevelState() {
        mistakes.reset();
        lastRoundStartNum = null;
        roundStartNumber = 0;
        currentDividend = 0;
        currentDivisor = 0;
        currentQuotient = 0;
        options = [];
        correctIndex = 0;
        activeComboTrap = null;
        solvedFactors.length = 0;
        divisionHistory.length = 0;
      },

      switchLevel(lv) {
        level = lv;
        gameCompleted = false;
        quizApi.resetLevelState();
      },

      getLevelLabel: () => levelLabel(level),
      getProgress: () => mistakes.getProgressView(progressOpts()),

      getProgressDisplay() {
        return ProgressDisplay.fromMistakeProgress(mistakes.getProgressView(progressOpts()));
      },

      placeholderRaspuns: global.PlaceholderRaspuns.creeaza("?"),
      laSchimbareDeNivel: global.SchimbareDeNivel.standard(),
      beginRound({ startNum, combo } = pickRoundStart()) {
        if (isBelowLevelFloor(startNum)) {
          return quizApi.beginRound(pickRoundStart());
        }

        lastRoundStartNum = startNum;
        roundStartNumber = startNum;
        solvedFactors.length = 0;
        divisionHistory.length = 0;
        mistakes.startRun();
        activeComboTrap = null;
        if (combo) buildStepFromCombo(combo);
        else buildStep(startNum);
        sincronizeazaOrchestratorul();

        return roundView({
          hintMessage: combo
            ? "Exersează combinația greșită!"
            : "Rezolvă împărțirea și continuă cu câtul obținut.",
        });
      },

      onTimeout() {
        mistakes.recordMistake(buildMistakePayload());
        return {
          outcome: "timeout",
          flash: "wrong",
          message: "Prea târziu! Alege câtul corect înainte să ajungă jos.",
          resetFall: true,
          ...roundView({ hintMessage: "" }),
        };
      },

      // Migrat la Motor3Butoane (Faza D, lotul 2), invelit in SubquizOrchestrator
      // (Faza E, sectiunea 12) — vezi `baseDefinition`, mai sus.
      onAnswer(index, meta = {}) {
        return orchestrator.onAnswer(index, meta);
      },

      pickNextRound: () => pickRoundStart(),
    };
    return quizApi;
  }

  global.QuizRegistry.register({
    id: "prime-divisions",
    title: "Împărțiri la numere prime",
    description: "Alege câtul corect pentru împărțiri succesive cu divizori primi.",
    order: 1,
    gestionareGreseli: { activ: true, nrRepetariPtRecuperare: 2 },
    create: createPrimeDivisionsQuiz,
  });
})(window);
