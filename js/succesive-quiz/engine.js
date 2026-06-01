(function (global) {
  "use strict";

  // Motor reutilizabil pentru quiz-uri de tip "operații succesive în același lift".
  //
  // Planificarea seriei (planNextSeries):
  //   - Dacă nu sunt restanțe: serie normală aleatoare (3/5/7 pași, start aleator).
  //   - Dacă există restanțe apropiate (≤5 pași distanță): serie cluster — startul e la
  //     cea mai mică restanță din pereche, lanțul trece natural prin toate restanțele
  //     clustered, lungime = pași necesari (max 7).
  //   - Dacă restanțele sunt prea depărtate: serie de exact 3 pași, cu restanța injectată
  //     la o poziție aleatoare.
  //
  // Avansare nivel: o serie perfectă (fără greșeli) ȘI toate restanțele rezolvate de ≥2 ori.

  const DEFAULTS = {
    MIN_LEVEL: 1,
    MAX_LEVEL: 20,
    SERIES_LENGTHS: [3, 5, 7],
    RUN_DELAY_MS: 500,
    HINT_MESSAGE: "Alege rezultatul corect.",
    TIMEOUT_MESSAGE: "Prea târziu! Alege rezultatul corect înainte să ajungă jos.",
    LEVEL_ADVANCED_BANNER: "Felicitări! Next level!",
    CLUSTER_MAX_STEPS: 5,
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
    const LEVEL_ADVANCED_BANNER = config.levelAdvancedBanner ?? DEFAULTS.LEVEL_ADVANCED_BANNER;
    const GAME_COMPLETE_BANNER =
      config.gameCompleteBanner ?? `Felicitări! Ai terminat nivelul ${MAX_LEVEL}!`;
    const CLUSTER_MAX_STEPS = config.clusterMaxSteps ?? DEFAULTS.CLUSTER_MAX_STEPS;

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
    let activeMistakeAs = new Set(); // valorile 'a' care sunt restanțe în seria curentă
    let currentStep = null;     // { prompt, correctAnswer, a, b, factSeed }
    let options = [];
    let correctIndex = 0;
    let seriesFlawless = true;
    let consecutivePerfectSeries = 0; // câte serii perfecte consecutive s-au acumulat
    let seriesHistory = [];
    let currentStepWrongRecorded = false;

    function helpers() {
      return { randomInt, shuffle };
    }

    // Construiește HTML-ul în format coloană pentru restanțele de azi:
    //   168
    // +  14
    // ─────
    function buildVerticalPromptHtml(step) {
      const aStr = String(step.a);
      const bStr = String(step.b);
      const numWidth = Math.max(aStr.length, bStr.length);
      const totalWidth = numWidth + 2; // „+ " prefix pe linia a doua
      const topLine = aStr.padStart(totalWidth);
      const midLine = `+ ${bStr.padStart(numWidth)}`;
      return [
        `<div class="vertical-addition">`,
        `<div class="va-row">${topLine}</div>`,
        `<div class="va-row">${midLine}</div>`,
        `<div class="va-line"></div>`,
        `</div>`,
      ].join("");
    }

    function isRecoveryToday(a) {
      if (!activeMistakeAs.has(a)) return false;
      return reg()?.isFromToday(level, a) ?? false;
    }

    function pickSeriesLength() {
      return SERIES_LENGTHS[randomInt(0, SERIES_LENGTHS.length - 1)];
    }

    // Planifică tipul și conținutul seriei următoare.
    function planNextSeries() {
      const r = reg();
      const pendingByPriority = r ? r.getPrioritized(level, 50) : [];

      if (pendingByPriority.length === 0) {
        return {
          type: "normal",
          startValue: adapter.pickStartValue(level, helpers()),
          len: pickSeriesLength(),
        };
      }

      // Sortează după a pentru detecția clusterului.
      const sortedByA = [...pendingByPriority].sort((x, y) => x - y);

      // Găsește perechea cea mai apropiată.
      let minDist = Infinity;
      let closestIdx = -1;
      for (let i = 0; i < sortedByA.length - 1; i++) {
        const dist = (sortedByA[i + 1] - sortedByA[i]) / level;
        if (dist < minDist) {
          minDist = dist;
          closestIdx = i;
        }
      }

      if (minDist <= CLUSTER_MAX_STEPS) {
        // Construiește cluster: extinde în ambele direcții față de perechea apropiată.
        const clusterSet = new Set([sortedByA[closestIdx], sortedByA[closestIdx + 1]]);

        // Extinde spre dreapta
        let prev = sortedByA[closestIdx + 1];
        for (let i = closestIdx + 2; i < sortedByA.length; i++) {
          if ((sortedByA[i] - prev) / level <= CLUSTER_MAX_STEPS) {
            clusterSet.add(sortedByA[i]);
            prev = sortedByA[i];
          } else break;
        }
        // Extinde spre stânga
        let next = sortedByA[closestIdx];
        for (let i = closestIdx - 1; i >= 0; i--) {
          if ((next - sortedByA[i]) / level <= CLUSTER_MAX_STEPS) {
            clusterSet.add(sortedByA[i]);
            next = sortedByA[i];
          } else break;
        }

        const clusterArr = [...clusterSet].sort((x, y) => x - y);
        const startA = clusterArr[0];
        const endA = clusterArr[clusterArr.length - 1];
        const stepsNeeded = Math.round((endA - startA) / level) + 1;
        const len = Math.min(7, Math.max(2, stepsNeeded));

        return { type: "cluster", startValue: startA, len, mistakeAs: clusterSet };
      }

      // Restanță izolată: serie de 3, injectată la poziție aleatoare.
      return {
        type: "isolated",
        startValue: adapter.pickStartValue(level, helpers()),
        len: 3,
        mistakeA: pendingByPriority[0], // cea mai prioritară
        injectPos: randomInt(0, 2),
      };
    }

    function prepareStep() {
      const qStep = stepsQueue[stepIndex];
      const valueToUse = qStep?.type === "mistake" ? qStep.a : currentValue;
      currentStep = adapter.buildStep(valueToUse, level);
      const built = adapter.buildOptions(currentStep.correctAnswer, level, helpers());
      options = built.options.map(String);
      correctIndex = built.correctIndex;
      currentStepWrongRecorded = false;
    }

    function startSeries() {
      const plan = planNextSeries();

      if (plan.type === "cluster") {
        seriesLength = plan.len;
        currentValue = plan.startValue;
        stepsQueue = Array.from({ length: seriesLength }, () => ({ type: "chain" }));
        activeMistakeAs = plan.mistakeAs;
      } else if (plan.type === "isolated") {
        seriesLength = 3;
        currentValue = plan.startValue;
        stepsQueue = Array.from({ length: 3 }, (_, i) =>
          i === plan.injectPos ? { type: "mistake", a: plan.mistakeA } : { type: "chain" }
        );
        activeMistakeAs = new Set([plan.mistakeA]);
      } else {
        // normal
        seriesLength = plan.len;
        currentValue = plan.startValue;
        stepsQueue = Array.from({ length: seriesLength }, () => ({ type: "chain" }));
        activeMistakeAs = new Set();
      }

      stepIndex = 0;
      seriesFlawless = true;
      seriesHistory = [];
      currentStepWrongRecorded = false;
      prepareStep();
      return roundView();
    }

    function roundView(extra = {}) {
      const showVertical = currentStep && isRecoveryToday(currentStep.a);
      return {
        prompt: currentStep?.prompt ?? "—",
        promptHtml: showVertical ? buildVerticalPromptHtml(currentStep) : undefined,
        options: [...options],
        correctIndex,
        successionHistory: seriesHistory.slice(-3),
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

    // (păstrat pentru compatibilitate internă dacă e necesar în viitor)
    function _promptWithAnswer(prompt, answer) {
      return String(prompt).includes("=?")
        ? String(prompt).replace("=?", `=${answer}`)
        : `${prompt} ${answer}`;
    }
    void _promptWithAnswer; // suprima warning unused

    function canAdvanceLevel() {
      const r = reg();
      return consecutivePerfectSeries >= 2 && (!r || r.allMasteredForLevel(level));
    }

    function completeSeries() {
      if (seriesFlawless) {
        consecutivePerfectSeries += 1;
      } else {
        consecutivePerfectSeries = 0;
      }

      if (!canAdvanceLevel()) {
        const r = reg();
        const hasOpen = r && !r.allMasteredForLevel(level);
        let message;
        if (!seriesFlawless && hasOpen) {
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
      consecutivePerfectSeries = 0;
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
        // SpeedManager — apelat la fiecare greșeală (inclusiv repetiții pe același pas).
        global.SpeedManager?.recordWrong(quizId, level, currentStep.a);
        return {
          outcome: "wrong-answer",
          correct: false,
          flash: "wrong",
          message: `${String(currentStep.prompt).replace("=?", "")} nu este ${chosen}. Încearcă din nou!`,
          ...roundView(),
        };
      }

      // Răspuns corect — notează dacă pasul era o restanță activă.
      // SDP per zi = corect din prima în această serie ȘI nu a mai fost greșit azi.
      const isRestanta = activeMistakeAs.has(currentStep.a);
      if (isRestanta) {
        reg()?.addCorrect(level, currentStep.a);
      }
      const isSDP = !currentStepWrongRecorded && !(reg()?.isFromToday(level, currentStep.a) ?? false);
      global.SpeedManager?.recordCorrect(quizId, level, currentStep.a, meta.responseMs, isRestanta && isSDP);

      const solvedPrompt = currentStep.prompt;
      const solvedAnswer = currentStep.correctAnswer;

      seriesHistory.push({ prompt: solvedPrompt, answer: solvedAnswer });
      stepIndex += 1;
      currentValue = solvedAnswer;

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

      // Factor de viteză combinat: bază per nivel × SpeedManager (dificultate) × recuperare azi (−20%).
      getFallSpeedFactor() {
        if (!currentStep) return 1.0;
        const baseFactor = level >= 11 ? 0.79 : 1.0;
        const difficultyFactor = global.SpeedManager?.getEffectiveFactor(quizId, level, currentStep.a) ?? 1.0;
        const recoveryFactor = isRecoveryToday(currentStep.a) ? 0.8 : 1.0;
        return Math.max(0.40, baseFactor * difficultyFactor * recoveryFactor);
      },

      // Bounce la vârf dacă nivelul a acumulat greșeli (levelFactor < 1).
      shouldBounceToTop() {
        return global.SpeedManager?.shouldBounceToTop(quizId, level) ?? false;
      },

      isCompleted: () => gameCompleted,
      setCompleted: (value) => { gameCompleted = value; },

      resetLevelState() {
        level = MIN_LEVEL;
        gameCompleted = false;
        stepIndex = 0;
        seriesFlawless = true;
        consecutivePerfectSeries = 0;
        seriesHistory = [];
        stepsQueue = [];
        activeMistakeAs = new Set();
        currentStep = null;
        options = [];
        correctIndex = 0;
        currentStepWrongRecorded = false;
      },

      switchLevel(nextLevel) {
        level = Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, nextLevel));
        gameCompleted = false;
        consecutivePerfectSeries = 0;
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
        if (currentStep?.a != null) {
          global.SpeedManager?.recordWrong(quizId, level, currentStep.a);
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
      pickNextRound() { return null; },
    };
  }

  global.SuccesiveQuiz = {
    create: createSuccesiveQuiz,
  };
})(window);
