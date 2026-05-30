(function (global) {
  "use strict";

  // Motor reutilizabil pentru quiz-uri de tip "operații succesive în același lift":
  // ex. 20+5=?, apoi 25+5=?, apoi 30+5=? ... O serie (lift) are 3/5/7 întrebări.
  // Fiecare răspuns corect saltă liftul puțin în sus și afișează următoarea întrebare.
  // Avansare nivel: o serie perfect fără greșeli ȘI toate restanțele rezolvate de ≥2 ori.
  // Restanțele (adunări greșite) sunt injectate în seria următoare și stocate cross-session.

  const DEFAULTS = {
    MIN_LEVEL: 1,
    MAX_LEVEL: 20,
    SERIES_LENGTHS: [3, 5, 7],
    RUN_DELAY_MS: 500,
    HINT_MESSAGE: "Alege rezultatul corect.",
    TIMEOUT_MESSAGE: "Prea târziu! Alege rezultatul corect înainte să ajungă jos.",
    LEVEL_ADVANCED_BANNER: "Felicitări! Next level!",
  };

  function createSuccesiveQuiz(config) {
    const adapter = config.adapter;
    const quizId = config.quizId;
    const MIN_LEVEL = config.minLevel ?? DEFAULTS.MIN_LEVEL;
    const MAX_LEVEL = config.maxLevel ?? DEFAULTS.MAX_LEVEL;
    const SERIES_LENGTHS = config.seriesLengths ?? DEFAULTS.SERIES_LENGTHS;
    const RUN_DELAY_MS = config.runDelayMs ?? DEFAULTS.RUN_DELAY_MS;
    const HINT_MESSAGE = config.hintMessage ?? DEFAULTS.HINT_MESSAGE;
    const TIMEOUT_MESSAGE = config.timeoutMessage ?? DEFAULTS.TIMEOUT_MESSAGE;
    const LEVEL_ADVANCED_BANNER =
      config.levelAdvancedBanner ?? DEFAULTS.LEVEL_ADVANCED_BANNER;
    const GAME_COMPLETE_BANNER =
      config.gameCompleteBanner ?? `Felicitări! Ai terminat nivelul ${MAX_LEVEL}!`;

    const { randomInt, shuffle } = global.GameUtils;
    const { FactStore } = global;

    function reg() {
      return global.SuccesiveMistakeRegistry ?? null;
    }

    let level = MIN_LEVEL;
    let gameCompleted = false;

    let seriesLength = SERIES_LENGTHS[0];
    let stepIndex = 0;
    let currentValue = 0;       // valoarea curentă în lanțul succesiv
    let stepsQueue = [];        // [{ type:'chain' } | { type:'mistake', a:number }]
    let currentStep = null;     // { prompt, correctAnswer, a, b, factSeed }
    let options = [];
    let correctIndex = 0;
    let seriesFlawless = true;
    let seriesHistory = [];
    let currentStepWrongRecorded = false;

    function helpers() {
      return { randomInt, shuffle };
    }

    function pickSeriesLength() {
      return SERIES_LENGTHS[randomInt(0, SERIES_LENGTHS.length - 1)];
    }

    // Construiește lista de pași pentru o serie:
    // 2-3 restanțe din registru injectate la poziții aleatoare, restul pași de lanț.
    function buildStepsQueue() {
      const r = reg();
      const pending = r ? r.getPrioritized(level, 3) : [];
      const injectCount = Math.min(pending.length, Math.max(0, seriesLength - 1));
      const mistakesToInject = pending.slice(0, injectCount);

      // Alege poziții aleatoare pentru restanțe, sortate crescător
      const positions = shuffle(Array.from({ length: seriesLength }, (_, i) => i))
        .slice(0, injectCount)
        .sort((x, y) => x - y);
      const posSet = new Set(positions);

      const steps = [];
      let mi = 0;
      for (let i = 0; i < seriesLength; i++) {
        if (posSet.has(i) && mi < mistakesToInject.length) {
          steps.push({ type: "mistake", a: mistakesToInject[mi++] });
        } else {
          steps.push({ type: "chain" });
        }
      }
      return steps;
    }

    function prepareStep() {
      const qStep = stepsQueue[stepIndex];
      const valueToUse = qStep && qStep.type === "mistake" ? qStep.a : currentValue;
      currentStep = adapter.buildStep(valueToUse, level);
      const built = adapter.buildOptions(currentStep.correctAnswer, level, helpers());
      options = built.options.map(String);
      correctIndex = built.correctIndex;
      currentStepWrongRecorded = false;
    }

    function startSeries() {
      seriesLength = pickSeriesLength();
      currentValue = adapter.pickStartValue(level, helpers());
      stepIndex = 0;
      seriesFlawless = true;
      seriesHistory = [];
      stepsQueue = buildStepsQueue();
      currentStepWrongRecorded = false;
      prepareStep();
      return roundView();
    }

    function roundView(extra = {}) {
      return {
        prompt: currentStep?.prompt ?? "—",
        options: [...options],
        correctIndex,
        divisionHistory: seriesHistory.slice(-3),
        hintMessage: extra.hintMessage ?? HINT_MESSAGE,
        ...extra,
      };
    }

    function recordAttempt(correct, chosenAnswer, meta = {}) {
      if (!currentStep?.factSeed) return;
      FactStore.recordAttempt(
        currentStep.factSeed,
        {
          at: meta.at,
          correct,
          responseMs: meta.responseMs,
          answer: chosenAnswer,
          timedOut: Boolean(meta.timedOut),
          quizId,
        },
        currentStep.factSeed
      );
    }

    function promptWithAnswer(prompt, answer) {
      return String(prompt).includes("=?")
        ? String(prompt).replace("=?", `=${answer}`)
        : `${prompt} ${answer}`;
    }

    function canAdvanceLevel() {
      const r = reg();
      return seriesFlawless && (!r || r.allMasteredForLevel(level));
    }

    function completeSeries() {
      if (!canAdvanceLevel()) {
        const r = reg();
        const hasOpenMistakes = r && !r.allMasteredForLevel(level);
        let message;
        if (!seriesFlawless && hasOpenMistakes) {
          message = "Serie cu greșeli și restanțe. Continuă!";
        } else if (!seriesFlawless) {
          message = "Serie cu greșeli! Mai e nevoie de o serie perfectă ca să avansezi.";
        } else {
          message = "Serie perfectă! Rămân restanțe — răspunde-le corect de 2 ori ca să avansezi.";
        }
        return {
          outcome: "run-complete",
          correct: true,
          runComplete: true,
          runDelayMs: RUN_DELAY_MS,
          message,
          nextRound: startSeries(),
        };
      }

      if (level >= MAX_LEVEL) {
        gameCompleted = true;
        return {
          outcome: "run-complete",
          correct: true,
          runComplete: true,
          gameComplete: true,
          flash: "win",
          banner: GAME_COMPLETE_BANNER,
          message: GAME_COMPLETE_BANNER,
        };
      }

      level += 1;
      return {
        outcome: "run-complete",
        correct: true,
        runComplete: true,
        levelAdvanced: true,
        flash: "win",
        banner: LEVEL_ADVANCED_BANNER,
        message: `Felicitări! Nivel ${level}`,
        nextRound: startSeries(),
      };
    }

    function onAnswer(index, meta = {}) {
      const chosen = options[index];
      const correctVal = Number(currentStep.correctAnswer);
      const isCorrect = Number(chosen) === correctVal;

      recordAttempt(isCorrect, chosen, meta);

      if (!isCorrect) {
        seriesFlawless = false;
        if (!currentStepWrongRecorded) {
          reg()?.addWrong(level, currentStep.a);
          currentStepWrongRecorded = true;
        }
        return {
          outcome: "wrong-answer",
          correct: false,
          flash: "wrong",
          message: `${String(currentStep.prompt).replace("=?", "")} nu este ${chosen}. Încearcă din nou!`,
          ...roundView(),
        };
      }

      // Răspuns corect
      const qStep = stepsQueue[stepIndex];
      if (qStep?.type === "mistake") {
        reg()?.addCorrect(level, qStep.a);
      }

      const solvedPrompt = currentStep.prompt;
      const solvedAnswer = currentStep.correctAnswer;

      seriesHistory.push(promptWithAnswer(solvedPrompt, solvedAnswer));
      stepIndex += 1;
      currentValue = solvedAnswer; // lanțul continuă de la rezultatul curent

      if (stepIndex >= seriesLength) {
        return completeSeries();
      }

      prepareStep();
      return {
        outcome: "step-correct",
        correct: true,
        bounce: true,
        message: "Corect!",
        ...roundView(),
      };
    }

    return {
      getLevel: () => level,
      getMaxLevel: () => MAX_LEVEL,
      getMinLevel: () => MIN_LEVEL,
      getLevelLabel: () => adapter.getLevelLabel(level),
      getLevelButtonTitle: (targetLevel) => adapter.getLevelButtonTitle(targetLevel),

      getProgressDisplay: () => global.ProgressDisplay.hidden(),

      isCompleted: () => gameCompleted,
      setCompleted: (value) => { gameCompleted = value; },

      resetLevelState() {
        level = MIN_LEVEL;
        gameCompleted = false;
        stepIndex = 0;
        seriesFlawless = true;
        seriesHistory = [];
        stepsQueue = [];
        currentStep = null;
        options = [];
        correctIndex = 0;
        currentStepWrongRecorded = false;
      },

      switchLevel(nextLevel) {
        level = Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, nextLevel));
        gameCompleted = false;
        return null;
      },

      beginRound() {
        return startSeries();
      },

      onTimeout(meta = {}) {
        recordAttempt(false, null, { ...meta, timedOut: true });
        seriesFlawless = false;
        if (!currentStepWrongRecorded) {
          reg()?.addWrong(level, currentStep?.a);
          currentStepWrongRecorded = true;
        }
        return {
          outcome: "timeout",
          flash: "wrong",
          message: TIMEOUT_MESSAGE,
          resetFall: true,
          ...roundView(),
        };
      },

      onAnswer,

      pickNextRound() {
        return null;
      },
    };
  }

  global.SuccesiveQuiz = {
    create: createSuccesiveQuiz,
  };
})(window);
