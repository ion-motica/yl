(function (global) {
  "use strict";

  const QUIZ_ID = "bagare-sub-radical";
  const MIN_LEVEL = 1;
  const MAX_LEVEL = 8;
  const QUESTIONS_PER_LEVEL = 21;
  const CONSECUTIVE_NEEDED = 2;
  const MIXED_QUESTIONS = 6;
  const HINT = "Alege răspunsul corect.";

  const N_VALUES = [2, 3, 5, 6, 7, 10];
  const PLAUSIBLE = [2, 3, 4, 5, 6, 7, 8, 9, 10];
  const SQUARE_POOL = [4, 9, 16, 25, 36, 49, 64, 81];

  const PHASE = {
    ONE: "phase1",
    TWO: "phase2",
    THREE: "phase3",
    FOUR: "phase4",
    FIVE: "phase5",
    SIX: "phase6",
  };

  const PHASE_ORDER = [
    PHASE.ONE,
    PHASE.TWO,
    PHASE.THREE,
    PHASE.FOUR,
    PHASE.FIVE,
    PHASE.SIX,
  ];

  const MIXABLE = [PHASE.ONE, PHASE.TWO, PHASE.THREE];

  function kForLevel(level) {
    return level + 1;
  }

  function qMarkHtml() {
    return '<span class="q-mark">?</span>';
  }

  function renderSqrt(contentHtml) {
    return (
      '<span class="sqrt">' +
      '<span class="sqrt-symbol">√</span>' +
      `<span class="sqrt-content">${contentHtml}</span>` +
      "</span>"
    );
  }

  function renderPower(baseHtml, expHtml) {
    return `${baseHtml}<sup>${expHtml}</sup>`;
  }

  function leftSide(k, n) {
    return `${k} · ${renderSqrt(String(n))}`;
  }

  function buildPromptHtml(phase, k, n) {
    const left = leftSide(k, n);

    if (phase === PHASE.ONE) {
      return `${left} = ${renderSqrt(`${qMarkHtml()} · ${renderPower(k, 2)}`)}`;
    }
    if (phase === PHASE.TWO) {
      return `${left} = ${renderSqrt(`${n} · ${renderPower(qMarkHtml(), 2)}`)}`;
    }
    if (phase === PHASE.THREE) {
      return `${left} = ${renderSqrt(`${n} · ${k}<sup>${qMarkHtml()}</sup>`)}`;
    }
    if (phase === PHASE.FIVE) {
      return `${left} = ${renderSqrt(`${n} · ${qMarkHtml()}`)}`;
    }
    if (phase === PHASE.SIX) {
      return `${left} = ${renderSqrt(qMarkHtml())}`;
    }

    return "—";
  }

  function buildPromptText(phase, k, n) {
    const left = `${k} · sqrt(${n})`;

    if (phase === PHASE.ONE) {
      return `${left} = sqrt(? · ${k}^2)`;
    }
    if (phase === PHASE.TWO) {
      return `${left} = sqrt(${n} · ?^2)`;
    }
    if (phase === PHASE.THREE) {
      return `${left} = sqrt(${n} · ${k}^?)`;
    }
    if (phase === PHASE.FIVE) {
      return `${left} = sqrt(${n} · ?)`;
    }
    if (phase === PHASE.SIX) {
      return `${left} = sqrt(?)`;
    }

    return "—";
  }

  function correctAnswer(phase, k, n) {
    if (phase === PHASE.ONE) return n;
    if (phase === PHASE.TWO) return k;
    if (phase === PHASE.THREE) return 2;
    if (phase === PHASE.FIVE) return k * k;
    if (phase === PHASE.SIX) return n * k * k;
    return null;
  }

  function pickTwoTraps(correct, candidates) {
    const used = new Set([correct]);
    const traps = [];

    function tryAdd(value) {
      if (!Number.isInteger(value) || value <= 0) return;
      if (used.has(value)) return;
      used.add(value);
      traps.push(value);
    }

    for (const value of candidates) {
      if (traps.length >= 2) break;
      tryAdd(value);
    }

    for (let value = 1; traps.length < 2 && value <= 200; value++) {
      tryAdd(value);
    }

    return traps.slice(0, 2);
  }

  function trapsForPhase(phase, k, n, correct) {
    if (phase === PHASE.ONE || phase === PHASE.TWO || phase === PHASE.THREE) {
      const pool = PLAUSIBLE.filter((value) => value !== correct);
      return pickTwoTraps(correct, pool);
    }

    if (phase === PHASE.FIVE) {
      const pool = SQUARE_POOL.filter((value) => value !== correct);
      return pickTwoTraps(correct, pool);
    }

    if (phase === PHASE.SIX) {
      const k2 = k * k;
      const product = n * k2;
      const pool = [
        n * k,
        n + k2,
        product - n,
        product + n,
        product - k,
        product + k,
        product - k2,
        product + k2,
        (n + 1) * k2,
        (n - 1) * k2,
        n * (k + 1),
        n * (k - 1),
      ];
      return pickTwoTraps(correct, pool);
    }

    return pickTwoTraps(correct, PLAUSIBLE);
  }

  function buildQuestion(phase, k, n) {
    const { shuffle } = global.GameUtils;
    const correct = correctAnswer(phase, k, n);
    const traps = trapsForPhase(phase, k, n, correct);
    const options = shuffle([
      String(correct),
      String(traps[0]),
      String(traps[1]),
    ]);

    return {
      phase,
      k,
      n,
      correct,
      prompt: buildPromptText(phase, k, n),
      promptHtml: buildPromptHtml(phase, k, n),
      options,
      correctIndex: options.indexOf(String(correct)),
    };
  }

  function createQuiz(config = {}) {
    const { randomInt } = global.GameUtils;
    const ProgressDisplay = global.ProgressDisplay;

    let level = MIN_LEVEL;
    let questionCount = 0;
    let consecutiveCorrect = 0;
    let currentPhase = PHASE.ONE;
    let mixedQuestionCount = 0;
    let current = null;
    let gameCompleted = false;

    function getLevelLabel(targetLevel = level) {
      return `Nivel ${targetLevel} · k = ${kForLevel(targetLevel)}`;
    }

    function getLevelButtonTitle(targetLevel) {
      return `Nivel ${targetLevel}: k = ${kForLevel(targetLevel)}`;
    }

    function resetLevelState() {
      questionCount = 0;
      consecutiveCorrect = 0;
      currentPhase = PHASE.ONE;
      mixedQuestionCount = 0;
      current = null;
    }

    function goToPhase(nextPhase) {
      currentPhase = nextPhase;
      consecutiveCorrect = 0;
      if (nextPhase === PHASE.FOUR) {
        mixedQuestionCount = 0;
      }
    }

    function advanceToNextPhase() {
      const index = PHASE_ORDER.indexOf(currentPhase);
      if (index >= 0 && index < PHASE_ORDER.length - 1) {
        goToPhase(PHASE_ORDER[index + 1]);
      }
    }

    function pickN(k, excludeN) {
      let pool = N_VALUES.filter((value) => value !== k);
      if (excludeN != null) {
        pool = pool.filter((value) => value !== excludeN);
      }
      if (!pool.length) {
        pool = N_VALUES.filter((value) => value !== k);
      }
      return pool[randomInt(0, pool.length - 1)];
    }

    function pickNewQuestion(excludeN) {
      const k = kForLevel(level);
      const n = pickN(k, excludeN);
      let phase = currentPhase;

      if (phase === PHASE.FOUR) {
        phase = MIXABLE[randomInt(0, MIXABLE.length - 1)];
      }

      return buildQuestion(phase, k, n);
    }

    function roundView(extra = {}) {
      return {
        prompt: current?.prompt ?? "—",
        promptHtml: current?.promptHtml,
        options: current ? [...current.options] : ["—", "—", "—"],
        correctIndex: current?.correctIndex ?? 0,
        hintMessage: HINT,
        ...extra,
      };
    }

    function advanceLevel(via) {
      if (level >= MAX_LEVEL) {
        gameCompleted = true;
        return {
          outcome: "run-complete",
          correct: true,
          runComplete: true,
          gameComplete: true,
          flash: "win",
          banner: "Felicitări! Ai terminat toate nivelele!",
          message: "Felicitări! Ai terminat toate nivelele!",
          ...roundView(),
        };
      }

      level += 1;
      resetLevelState();
      current = pickNewQuestion();

      const message =
        via === "streak"
          ? "2 corecte consecutive! Next level!"
          : "21 întrebări! Next level!";

      return {
        outcome: "run-complete",
        correct: true,
        runComplete: true,
        levelAdvanced: true,
        flash: "win",
        banner: getLevelLabel(),
        message,
        nextRound: roundView(),
      };
    }

    function finishPhase4Step(isCorrect) {
      mixedQuestionCount += 1;

      if (mixedQuestionCount >= MIXED_QUESTIONS) {
        goToPhase(PHASE.FIVE);
        current = pickNewQuestion();
      } else {
        const excludeN = isCorrect ? undefined : current?.n;
        current = pickNewQuestion(excludeN);
      }

      return {
        outcome: "step-correct",
        correct: isCorrect,
        flash: isCorrect ? undefined : "wrong",
        resetFall: !isCorrect,
        bounce: isCorrect,
        message: isCorrect ? "Corect!" : "Nu e corect.",
        ...roundView(),
      };
    }

    function afterAnswer(isCorrect) {
      questionCount += 1;

      if (questionCount >= QUESTIONS_PER_LEVEL) {
        return advanceLevel("count");
      }

      if (currentPhase === PHASE.FOUR) {
        if (!isCorrect) consecutiveCorrect = 0;
        return finishPhase4Step(isCorrect);
      }

      if (!isCorrect) {
        consecutiveCorrect = 0;
        current = pickNewQuestion(current?.n);
        return {
          outcome: "step-correct",
          correct: false,
          flash: "wrong",
          resetFall: true,
          message: "Nu e corect.",
          ...roundView(),
        };
      }

      consecutiveCorrect += 1;

      if (consecutiveCorrect >= CONSECUTIVE_NEEDED) {
        if (currentPhase === PHASE.SIX) {
          return advanceLevel("streak");
        }

        advanceToNextPhase();
        current = pickNewQuestion();
        return {
          outcome: "step-correct",
          correct: true,
          bounce: true,
          message: "Corect!",
          ...roundView(),
        };
      }

      current = pickNewQuestion();
      return {
        outcome: "step-correct",
        correct: true,
        bounce: true,
        message: "Corect!",
        ...roundView(),
      };
    }

    return {
      getQuizId: () => config.quizId ?? QUIZ_ID,
      getLevel: () => level,
      getMinLevel: () => MIN_LEVEL,
      getMaxLevel: () => MAX_LEVEL,
      getLevelLabel: () => getLevelLabel(level),
      getLevelButtonTitle,

      getProgressDisplay() {
        const percent = Math.round((questionCount / QUESTIONS_PER_LEVEL) * 100);
        return {
          green: ProgressDisplay.greenPercent(Math.min(100, percent)),
          red: ProgressDisplay.redNone(),
        };
      },

      isCompleted: () => gameCompleted,
      setCompleted: (value) => {
        gameCompleted = Boolean(value);
      },

      resetLevelState,

      switchLevel(nextLevel) {
        level = Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, nextLevel));
        gameCompleted = false;
        resetLevelState();
        return null;
      },

      pickNextRound() {
        return pickNewQuestion();
      },

      beginRound(next) {
        current = next ?? pickNewQuestion();
        return roundView();
      },

      onTimeout() {
        return {
          outcome: "round",
          resetFall: true,
          ...roundView(),
        };
      },

      onAnswer(index) {
        const chosen = Number(current.options[index]);
        const isCorrect = chosen === current.correct;
        return afterAnswer(isCorrect);
      },
    };
  }

  global.BagareSubRadicalQuiz = { create: createQuiz };

  global.QuizRegistry.register({
    id: QUIZ_ID,
    title: "Bagare sub radical",
    description:
      "k · √n = √(n · k²). Niveluri k=2..9, 6 faze progresive, 21 răspunsuri sau final de level.",
    order: -3,
    gestionareGreseli: { activ: false },
    create(meta) {
      return global.BagareSubRadicalQuiz.create({ quizId: meta.id });
    },
  });
})(window);
